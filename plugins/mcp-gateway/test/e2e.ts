// End-to-end check: two MCP HTTP servers, a REST API and a canary the config doesn't list, and the built gateway driven
// over stdio by an MCP client, all in one session. Run with `bun run test` (builds first).
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

type Seen = { auth: string[]; keys: string[]; initializes: number };

/** A stateless MCP HTTP server with one tool, recording each request's Authorization and x-api-key headers and every initialize. */
function testServer(tool: string, inputSchema: Record<string, z.ZodType>, run: (args: Record<string, unknown>) => string, seen: Seen): Server {
  return createServer(async (req, res) => {
    seen.auth.push(req.headers.authorization ?? "");
    seen.keys.push(String(req.headers["x-api-key"] ?? ""));
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    seen.initializes += [body].flat().filter(m => m?.method === "initialize").length;
    const mcp = new McpServer({ name: `test-${tool}`, version: "1.0.0" });
    mcp.registerTool(tool, { description: `test tool ${tool}`, inputSchema }, async args => ({ content: [{ type: "text", text: run(args) }] }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => void transport.close().then(() => mcp.close()));
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  });
}

const listen = (s: Server, port = 0) => new Promise<number>(ok => s.listen(port, "127.0.0.1", () => ok((s.address() as { port: number }).port)));
const stop = (s: Server) => new Promise<void>(ok => (s.closeAllConnections(), s.close(() => ok())));

const seenA: Seen = { auth: [], keys: [], initializes: 0 };
const seenB: Seen = { auth: [], keys: [], initializes: 0 };
const seenCanary: Seen = { auth: [], keys: [], initializes: 0 };
const makeB = () => testServer("shout", { text: z.string() }, ({ text }) => String(text).toUpperCase(), seenB);
const alpha = testServer("add", { a: z.number(), b: z.number() }, ({ a, b }) => String(Number(a) + Number(b)), seenA);
let beta = makeB();
const canary = testServer("leak", {}, () => "reached", seenCanary);
const portA = await listen(alpha);
const portB = await listen(beta);
const portCanary = await listen(canary);

type Hit = { method: string; url: string; key: string; type: string; body: string };
const hits: Hit[] = [];
/** A plain REST API under /v1 that echoes each request as JSON: /v1/missing is a 404, /v1/moved redirects to the canary, /v1/logo is a PNG. */
const rest = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString();
  hits.push({ method: req.method ?? "", url: req.url ?? "", key: String(req.headers["x-api-key"] ?? ""), type: req.headers["content-type"] ?? "", body });
  const path = new URL(req.url ?? "/", "http://x").pathname;
  if (path === "/v1/moved") return void res.writeHead(302, { location: `http://127.0.0.1:${portCanary}/mcp` }).end();
  if (path === "/v1/logo") return void res.writeHead(200, { "content-type": "image/png" }).end(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  res.writeHead(path === "/v1/missing" ? 404 : 200, { "content-type": "application/json", "set-cookie": "session=s3cret", "access-control-allow-origin": "*", "x-total-count": "7" }).end(JSON.stringify({ method: req.method, path, body }));
});
const portR = await listen(rest);

const config = join(tmpdir(), `mcp-gateway-e2e-${process.pid}.json`);
writeFileSync(
  config,
  JSON.stringify({
    alpha: { url: `http://127.0.0.1:${portA}/mcp`, headers: { "x-api-key": "test-key-alpha" } },
    beta: { url: `http://127.0.0.1:${portB}/mcp`, token: "test-token-beta" },
    rest: { kind: "api", url: `http://127.0.0.1:${portR}/v1`, headers: { "x-api-key": "test-key-rest" }, query: { api_key: "test-query-key" } },
  }),
);

const gateway = new Client({ name: "e2e", version: "1.0.0" });
await gateway.connect(
  new StdioClientTransport({ command: process.execPath, args: ["dist/index.js"], env: { ...(process.env as Record<string, string>), MCP_GATEWAY_CONFIG: config } }),
);

type Text = { content: { type: string; text: string }[]; isError?: boolean };
const call = async (name: string, args: Record<string, unknown>) => (await gateway.callTool({ name, arguments: args })) as Text;
const text = (r: Text) => r.content.map(c => c.text).join("");
const remoteTools = async (target: string) => {
  const r = await call("list_remote_tools", { target });
  assert.ok(!r.isError, text(r));
  return (JSON.parse(text(r)) as { name: string; inputSchema: { properties: object } }[]).map(t => `${t.name}(${Object.keys(t.inputSchema.properties).join(",")})`);
};
const ok = (what: string) => console.log(`ok - ${what}`);

try {
  // No tool takes a credential.
  const exposed = (await gateway.listTools()).tools;
  assert.deepEqual(exposed.map(t => t.name).sort(), ["call_api", "call_remote_tool", "list_remote_tools"]);
  for (const t of exposed) for (const p of Object.keys(t.inputSchema.properties ?? {})) assert.doesNotMatch(p, /token|auth|bearer|header|secret/i);
  ok(`gateway exposes ${exposed.map(t => `${t.name}(${Object.keys(t.inputSchema.properties ?? {}).join(",")})`).join(", ")}: no credential argument`);

  // Switching targets in one session.
  assert.deepEqual(await remoteTools("alpha"), ["add(a,b)"]);
  assert.deepEqual(await remoteTools("beta"), ["shout(text)"]);
  assert.deepEqual(await remoteTools("alpha"), ["add(a,b)"]);
  ok("list_remote_tools alpha → add(a,b), beta → shout(text), alpha again → add(a,b), one session");

  const sum = await call("call_remote_tool", { target: "alpha", name: "add", args: { a: 2, b: 3 } });
  assert.equal(text(sum), "5");
  const loud = await call("call_remote_tool", { target: "beta", name: "shout", args: { text: "requip" } });
  assert.equal(text(loud), "REQUIP");
  ok('call_remote_tool alpha add {a:2,b:3} → "5"; beta shout {text:"requip"} → "REQUIP"');

  // A URL on an allowlisted host that is an alias's own reuses that alias's connection.
  assert.deepEqual(await remoteTools(`http://127.0.0.1:${portA}/mcp`), ["add(a,b)"]);
  assert.equal(seenA.initializes, 1);
  assert.equal(seenB.initializes, 1);
  ok("connections reused: alpha and beta each saw one initialize across all calls (alpha's URL as target included)");

  // The allowlist.
  for (const target of ["gamma", `http://127.0.0.1:${portCanary}/mcp`, `http://127.0.0.1:${portR}/v1`, "http://169.254.169.254/latest/meta-data", "https://example.com/mcp", "file:///etc/passwd"]) {
    const r = await call("list_remote_tools", { target });
    assert.equal(r.isError, true, target);
    assert.match(text(r), /Unknown target|is not allowed/);
    console.log(`     ${target} → ${text(r)}`);
  }
  assert.equal(seenCanary.auth.length, 0);
  ok("unknown alias and off-allowlist URLs refused; the canary server got no request");

  // The token travels as a header, to its own alias only.
  assert.ok(seenB.auth.length > 0 && seenB.auth.every(h => h === "Bearer test-token-beta"), JSON.stringify(seenB.auth));
  assert.ok(seenA.auth.every(h => h === ""), JSON.stringify(seenA.auth));
  assert.ok(seenA.keys.length > 0 && seenA.keys.every(k => k === "test-key-alpha"), JSON.stringify(seenA.keys));
  assert.ok(seenB.keys.every(k => k === ""), JSON.stringify(seenB.keys));
  ok(`beta saw "Authorization: Bearer test-token-beta" on all ${seenB.auth.length} requests, alpha "x-api-key: test-key-alpha" on all ${seenA.keys.length}; neither saw the other's`);

  // REST APIs: the alias's headers and query on every request, the path kept under the base path.
  const api = (args: Record<string, unknown>) => call("call_api", { target: "rest", ...args });
  const body = (r: Text) => JSON.parse(text(r).slice(text(r).indexOf("\n\n") + 2)) as unknown;
  const got = await api({ path: "/items", query: { limit: 2, open: true } });
  assert.equal(got.isError, false, text(got));
  assert.match(text(got), /^HTTP 200 OK\n/);
  assert.match(text(got), /^content-type: application\/json$/m);
  assert.match(text(got), /^x-total-count: 7$/m);
  assert.doesNotMatch(text(got), /set-cookie|s3cret|access-control/i);
  assert.deepEqual(body(got), { method: "GET", path: "/v1/items", body: "" });
  assert.deepEqual(hits.at(-1), { method: "GET", url: "/v1/items?limit=2&open=true&api_key=test-query-key", key: "test-key-rest", type: "", body: "" });
  ok("call_api rest GET /items {limit:2,open:true} → HTTP 200, the configured x-api-key and api_key query sent; set-cookie and CORS headers left out, the API's own kept");

  const posted = await api({ method: "POST", path: "items", body: { name: "requip" } });
  assert.deepEqual(body(posted), { method: "POST", path: "/v1/items", body: '{"name":"requip"}' });
  assert.equal(hits.at(-1)?.type, "application/json");
  await api({ method: "PUT", path: "items/1", body: "raw text" });
  assert.deepEqual(hits.at(-1), { method: "PUT", url: "/v1/items/1?api_key=test-query-key", key: "test-key-rest", type: "text/plain;charset=UTF-8", body: "raw text" });
  ok("a JSON body goes as application/json, a string body as is");

  const missing = await api({ path: "missing" });
  assert.equal(missing.isError, true);
  assert.match(text(missing), /^HTTP 404 Not Found\n/);
  assert.match(text(await api({ path: "logo" })), /\n\n\(4 bytes of image\/png, not shown\)$/);
  ok("a 404 is a tool error with its status and body; a PNG body is summarised, not dumped");

  const before = hits.length;
  for (const path of ["../admin", "%2e%2e/admin", "items/../../admin", "items/..%2f..%2fadmin", "..%5Cadmin", ".%2e%2fadmin", "items/%zz"]) {
    const r = await api({ path });
    assert.equal(r.isError, true, path);
    assert.match(text(r), /climbs out of rest's base path/);
  }
  assert.equal(hits.length, before);
  await api({ path: `//127.0.0.1:${portCanary}/mcp` });
  assert.equal(hits.at(-1)?.url.split("?")[0], `/v1/127.0.0.1:${portCanary}/mcp`);
  await api({ path: "projects/group%2Fproject" });
  assert.equal(hits.at(-1)?.url.split("?")[0], "/v1/projects/group%2Fproject");
  ok("../, %2e%2e/, items/../../, encoded ..%2f and ..%5c, and a malformed escape refused before any request; //host/… stays a path on the API, and group%2Fproject goes as is");

  const moved = await api({ path: "moved" });
  assert.match(text(moved), /^HTTP 302 Found\n/);
  assert.match(text(moved), new RegExp(`^location: http://127\\.0\\.0\\.1:${portCanary}/mcp$`, "m"));
  assert.equal(seenCanary.auth.length, 0);
  ok("a redirect comes back as the 302 and its location, not followed: the canary got no request");

  assert.match(text(await call("list_remote_tools", { target: "rest" })), /rest is a REST API: use call_api/);
  assert.match(text(await call("call_api", { target: "alpha" })), /alpha is an MCP server/);
  assert.match(text(await call("call_api", { target: "nope" })), /Unknown API "nope": use a configured API alias \(rest\)/);
  ok("an API alias on the MCP tools, an MCP alias on call_api, and an unknown API are refused");

  // A stopped server is an error, not a crash; the other keeps working; a restarted one reconnects.
  await stop(beta);
  const down = await call("call_remote_tool", { target: "beta", name: "shout", args: { text: "x" } });
  assert.equal(down.isError, true);
  console.log(`     beta stopped → ${text(down)}`);
  assert.equal(text(await call("call_remote_tool", { target: "alpha", name: "add", args: { a: 1, b: 1 } })), "2");
  ok("beta stopped: its call is a tool error, the gateway stays up, alpha still answers");

  beta = makeB();
  await listen(beta, portB);
  assert.equal(text(await call("call_remote_tool", { target: "beta", name: "shout", args: { text: "back" } })), "BACK");
  assert.equal(seenB.initializes, 2);
  ok("beta restarted on its port: the next call reconnects (a second initialize) and answers");
} finally {
  await gateway.close();
  await Promise.all([stop(alpha), stop(beta), stop(canary), stop(rest)]);
  rmSync(config, { force: true });
}
