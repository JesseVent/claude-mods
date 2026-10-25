#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type Target = { kind: "mcp" | "api"; url: string; headers: Record<string, string>; query: Record<string, string> };

/** alias → remote MCP server or REST API. Read from the file MCP_GATEWAY_CONFIG names, so credentials never pass through tool arguments. */
const Config = z.record(
  z.string(),
  z
    .strictObject({
      kind: z.enum(["mcp", "api"]).default("mcp"),
      url: z.url({ protocol: /^https?$/ }),
      token: z.string().min(1).optional(),
      headers: z.record(z.string(), z.string()).default({}),
      query: z.record(z.string(), z.string()).default({}),
    })
    .refine(t => t.kind === "api" || !Object.keys(t.query).length, 'query is for "kind": "api" only'),
);

function loadTargets(): Map<string, Target> {
  const path = process.env.MCP_GATEWAY_CONFIG || join(homedir(), ".config", "mcp-gateway", "config.json");
  if (!existsSync(path)) throw new Error(`No config at ${path}: create it, a JSON file of alias → { kind?, url, token?, headers?, query? }, or point MCP_GATEWAY_CONFIG at one`);
  const config = Config.parse(JSON.parse(readFileSync(path, "utf8")));
  return new Map(
    Object.entries(config).map(([alias, { kind, url, token, headers, query }]) => [
      alias,
      { kind, url: new URL(url).href, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...headers }, query },
    ]),
  );
}

let targets: Map<string, Target>;
try {
  targets = loadTargets();
} catch (err) {
  console.error(`mcp-gateway: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
const names = (kind: Target["kind"]) => [...targets].filter(([, t]) => t.kind === kind).map(([alias]) => alias).join(", ") || "none";
const mcpTargets = [...targets.values()].filter(t => t.kind === "mcp");
/** The allowlist: the hosts (with port) of the configured MCP aliases. */
const allowedHosts = new Set(mcpTargets.map(t => new URL(t.url).host));

/** An alias, or a URL on an allowlisted host; anything else is refused, so the gateway can't be pointed at arbitrary hosts. */
function resolve(target: string): Target {
  const alias = targets.get(target);
  if (alias) return alias;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    throw new Error(`Unknown target "${target}": use a configured MCP alias (${names("mcp")}) or a URL on one of their hosts.`);
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !allowedHosts.has(url.host)) {
    throw new Error(`${url.href} is not allowed: the gateway connects only to its configured hosts (${[...allowedHosts].join(", ")}).`);
  }
  // A URL that is an alias's own gets that alias's headers; any other URL gets none.
  return mcpTargets.find(t => t.url === url.href) ?? { kind: "mcp", url: url.href, headers: {}, query: {} };
}

/** Connected clients by URL. A promise, so calls racing to the same target share one connection. */
const clients = new Map<string, Promise<Client>>();

function connect({ url, headers }: Target): Promise<Client> {
  const cached = clients.get(url);
  if (cached) return cached;
  const client = (async () => {
    const c = new Client({ name: "mcp-gateway", version: "0.2.0" });
    await c.connect(
      new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers },
        // A redirect off the allowlisted origin fails instead of being followed.
        redirectPolicy: "same-origin",
      }),
    );
    return c;
  })();
  clients.set(url, client);
  return client;
}

/** Forgets a connection that failed, so the next call to that target reconnects. */
async function drop(url: string) {
  const cached = clients.get(url);
  clients.delete(url);
  await cached?.then(c => c.close()).catch(() => {});
}

/** The error's message, with its cause's code when there is one ("fetch failed (ECONNREFUSED)"). */
const message = (err: unknown) => {
  if (!(err instanceof Error)) return String(err);
  const code = (err.cause as { code?: unknown } | undefined)?.code;
  return typeof code === "string" ? `${err.message} (${code})` : err.message;
};
const failure = (text: string): CallToolResult => ({ content: [{ type: "text", text }], isError: true });

async function onRemote(target: string, use: (client: Client) => Promise<CallToolResult>): Promise<CallToolResult> {
  let t: Target;
  try {
    t = resolve(target);
  } catch (err) {
    return failure(message(err));
  }
  if (t.kind === "api") return failure(`${target} is a REST API: use call_api.`);
  try {
    return await use(await connect(t));
  } catch (err) {
    await drop(t.url);
    return failure(`${target}: ${message(err)}`);
  }
}

/**
 * A `.` or `..` segment that only appears once the path is decoded (`..%2f`, `..%5c`): the URL parser keeps those
 * escapes, but a server that decodes before resolving would climb with them. A malformed escape counts too.
 */
function hidesDotSegment(pathname: string) {
  try {
    return decodeURIComponent(pathname).split(/[/\\]/).some(s => s === "." || s === "..");
  } catch {
    return true;
  }
}

/** `path` under the API's base URL, with the call's query and then the configured one; undefined when `path` climbs out of the base path. */
function apiUrl({ url, query: fixed }: Target, path: string, query: Record<string, string | number | boolean>) {
  const base = new URL(url);
  const root = base.pathname.replace(/\/?$/, "/");
  const u = new URL(root + path.replace(/^\/+/, ""), base);
  if (u.origin !== base.origin || !`${u.pathname}/`.startsWith(root) || hidesDotSegment(u.pathname)) return undefined;
  for (const [k, v] of [...base.searchParams, ...Object.entries(query), ...Object.entries(fixed)]) u.searchParams.set(k, String(v));
  return u;
}

/** Response headers left out of call_api's result: cookies, and the CORS and browser-security ones that only cost tokens. */
const BROWSER_ONLY = /^(set-cookie|access-control-|content-security-policy|strict-transport-security|referrer-policy|permissions-policy|x-frame-options|x-xss-protection|x-content-type-options)/;

const targetArg = z.string().describe(`A configured MCP alias (${names("mcp")}), or an http(s) URL on one of their hosts`);
const server = new McpServer({ name: "mcp-gateway", version: "0.2.0" });

server.registerTool(
  "list_remote_tools",
  {
    description: "Lists the tools of the remote MCP server `target` names: each tool's name, description and input schema, as JSON. Switch servers by passing another target.",
    inputSchema: { target: targetArg },
  },
  ({ target }) =>
    onRemote(target, async client => {
      const tools: { name: string; description?: string; inputSchema: unknown }[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor ? { cursor } : undefined);
        tools.push(...page.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })));
        cursor = page.nextCursor;
      } while (cursor);
      return { content: [{ type: "text", text: JSON.stringify(tools, null, 2) }] };
    }),
);

server.registerTool(
  "call_remote_tool",
  {
    description: "Calls tool `name` on the remote MCP server `target` names, with `args` as its arguments, and returns its result. Run list_remote_tools first for the names and schemas.",
    inputSchema: {
      target: targetArg,
      name: z.string().describe("The remote tool's name, as list_remote_tools gives it"),
      args: z.record(z.string(), z.unknown()).default({}).describe("The remote tool's arguments"),
    },
  },
  ({ target, name, args }) => onRemote(target, async client => (await client.callTool({ name, arguments: args })) as CallToolResult),
);

server.registerTool(
  "call_api",
  {
    description:
      "Sends an HTTP request to the REST API `target` names, at `path` under its base URL, and returns the status line, the response headers and the body. The API's credentials come from the config. Switch APIs by passing another target.",
    inputSchema: {
      target: z.string().describe(`A configured API alias (${names("api")})`),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
      path: z.string().default("").describe("The path under the API's base URL, e.g. repos/owner/name/issues"),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}).describe("Query parameters"),
      body: z.unknown().optional().describe("The request body: a JSON value is sent as JSON, a string as is"),
    },
  },
  async ({ target, method, path, query, body }) => {
    const t = targets.get(target);
    if (t?.kind !== "api") {
      return failure(t ? `${target} is an MCP server: use list_remote_tools and call_remote_tool.` : `Unknown API "${target}": use a configured API alias (${names("api")}).`);
    }
    const url = apiUrl(t, path, query);
    if (!url) return failure(`"${path}" climbs out of ${target}'s base path.`);
    try {
      const headers = new Headers(t.headers);
      if (body !== undefined && typeof body !== "string" && !headers.has("content-type")) headers.set("content-type", "application/json");
      const res = await fetch(url, {
        method,
        headers,
        body: body === undefined || typeof body === "string" ? body : JSON.stringify(body),
        // A redirect comes back as is, status and location, so the credentials never follow it off the API's origin.
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      const type = res.headers.get("content-type") ?? "";
      const head = [`HTTP ${res.status} ${res.statusText}`.trimEnd(), ...[...res.headers].filter(([k]) => !BROWSER_ONLY.test(k)).map(([k, v]) => `${k}: ${v}`)];
      const text = !type || /json|text|xml|javascript|urlencoded/.test(type) ? await res.text() : `(${(await res.arrayBuffer()).byteLength} bytes of ${type}, not shown)`;
      return { content: [{ type: "text", text: `${head.join("\n")}\n\n${text}` }], isError: res.status >= 400 };
    } catch (err) {
      return failure(`${target}: ${message(err)}`);
    }
  },
);

await server.connect(new StdioServerTransport());
