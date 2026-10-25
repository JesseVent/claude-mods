# mcp-gateway

A stdio MCP server that talks to whichever remote MCP server or REST API you name, so you can switch between them mid-session without reloading or restarting Claude Code. Its generic tools take a target. It connects to an MCP target on demand over Streamable HTTP and reuses the connection after that. It never re-registers the remote tools as its own and never sends `tools/list_changed`, since clients handle that unevenly. Each target's credentials (a bearer token, any headers, an API's query key) come from the config, never from a tool argument.

| Tool | Arguments | Returns |
| --- | --- | --- |
| `list_remote_tools` | `target` | The remote MCP server's tools (name, description, input schema) as JSON text |
| `call_remote_tool` | `target`, `name`, `args` (default `{}`) | The remote tool's result, as the remote server returned it |
| `call_api` | `target`, `method` (default `GET`), `path`, `query`, `body` | The REST API's status line, response headers and body, as text |

For the MCP tools, `target` is an MCP alias from the config, or a URL on one of those aliases' hosts. For `call_api` it is an API alias, and `path` goes under that API's base URL. To switch, pass another target.

Built and tested on Claude Code 2.1.310.

## Install

```
/plugin install mcp-gateway@claude-mods
```

The plugin runs `dist/index.js` with `node`. That file is the gateway bundled with its dependencies, so the install needs no `npm install`.

## Config

Write `~/.config/mcp-gateway/config.json` (or point `MCP_GATEWAY_CONFIG` at another file): a JSON file that maps each alias to its MCP server or REST API, plus the credentials to send:

```json
{
  "docs": { "url": "https://mcp.context7.com/mcp" },
  "internal": { "url": "https://mcp.internal.example.com/mcp", "token": "eyJhbGciOi..." },
  "github": { "kind": "api", "url": "https://api.github.com", "token": "ghp_...", "headers": { "Accept": "application/vnd.github+json" } },
  "anthropic": { "kind": "api", "url": "https://api.anthropic.com/v1", "headers": { "x-api-key": "sk-ant-...", "anthropic-version": "2023-06-01" } },
  "weather": { "kind": "api", "url": "https://api.openweathermap.org/data/2.5", "query": { "appid": "..." } }
}
```

| Field | Default | What it is |
| --- | --- | --- |
| `kind` | `mcp` | `mcp` for a remote MCP server, `api` for a REST API |
| `url` | | The MCP server's URL, or the API's base URL (`path` goes under it) |
| `token` | | Sent as `Authorization: Bearer <token>` |
| `headers` | `{}` | Sent on every request as is: `x-api-key`, `Authorization: Basic …`, a version header, `Accept` |
| `query` | `{}` | APIs only: added to every request's query, for APIs that take the key as `?key=` |

Keep the file out of any repository and readable only by you (`chmod 600`). Credentials live only in this file: no tool takes one, so none reaches the transcript. An alias's credentials go only to that alias's own URL.

The config is read once, when the gateway starts. After editing it, reconnect `plugin:mcp-gateway:gateway` in `/mcp`.

## Use

Claude calls `mcp__plugin_mcp-gateway_gateway__list_remote_tools` with `{ "target": "docs" }`, `…__call_remote_tool` with `{ "target": "docs", "name": "...", "args": { ... } }`, and `…__call_api` with `{ "target": "github", "path": "repos/owner/name/issues", "query": { "state": "open" } }` or `{ "target": "github", "method": "POST", "path": "repos/owner/name/issues", "body": { "title": "..." } }`.

## Security

- **Allowlist.** The MCP tools connect only to the hosts (with port) of the configured MCP aliases, and `call_api` only to its alias's origin. An unknown alias, a URL on any other host, or a non-http(s) URL is refused with an error before any request is made, so the gateway can't be pointed at arbitrary hosts (SSRF).
- **Base path.** A `path` that climbs out of the API's base path is refused before any request: `../` and `%2e%2e/`, and a `..` hidden behind an encoded separator (`..%2f`, `..%5c`), which a server that decodes before resolving would climb with. An encoded slash inside a segment (`projects/group%2Fproject`, as GitLab wants) goes as is, and `//other.host/…` stays a path on the API. Either way, an alias's credentials only ever go to its own origin.
- **Redirects.** For an MCP target, a redirect off its origin fails instead of being followed (`redirectPolicy: "same-origin"`). For an API, no redirect is followed: the 3xx comes back with its `location`, so the credentials never follow it.
- **Cookies.** An API's `set-cookie` headers are left out of what Claude sees, and so are the CORS and browser-security headers (`access-control-*`, `content-security-policy` and the like), which only cost tokens. The API's own headers (`link`, `x-ratelimit-*`, `retry-after`) are kept.
- **One permission covers everything.** Claude Code sees three tools, so a permission rule allowing `mcp__plugin_mcp-gateway_gateway__call_remote_tool` allows every tool on every configured server, and allowing `mcp__plugin_mcp-gateway_gateway__call_api` allows every method, `DELETE` included, on every configured API. Leave them on ask if any target can change things.

## Behaviour

- **Connections.** MCP connections are cached by URL: one per server, shared by calls that race to it.
- **Failures.** A connection or call that throws is dropped from the cache, and the error comes back as a tool error (`isError`), so the gateway keeps running. The next call to that target reconnects. A remote tool that answers with `isError` is passed through as is, and its connection kept.
- **API calls.** `call_api` returns `HTTP <status>`, the response headers, a blank line and the body. Status 400 and up is a tool error, with the body kept. A JSON `body` is sent as `application/json` (unless the alias's headers set a content type), and a string as is. A text, JSON or XML response comes back whole; any other (an image, a PDF) as its size and type. A request that takes over 30 seconds fails.
- **Startup.** A missing or invalid config stops the gateway at start, with the reason on stderr, which `/mcp` shows. That includes an unknown field, so a typo like `header` fails loudly.

## Test

```
bun install
bun run test
```

This bundles the gateway into `dist/index.js`, type-checks it, and starts two MCP HTTP servers and a REST API on local ports, plus a canary server the config doesn't list. One test client then drives the gateway over stdio, in one session, and checks:
- both MCP aliases, and switching between them;
- the remote calls' results;
- connection reuse;
- the allowlist, which the canary proves by receiving no request;
- the bearer and `x-api-key` headers, each only to its own alias;
- the API's configured header and query key, JSON and string bodies, a 404, a PNG, and `set-cookie` left out;
- `path`s that climb out of the base path, and a redirect to the canary, which isn't followed;
- an API alias on the MCP tools and an MCP alias on `call_api`;
- a stopped server, and its reconnect after a restart.

The tests need Node 22.18 or later. Commit `dist/index.js` with any change to `src/`, since that is what the plugin runs.

## Limits

- **Static credentials only.** A token, headers or a query key, fixed in the config. A server or API that requires an OAuth sign-in can't be reached through the gateway; add an MCP server like that to Claude Code directly.
- **Claude has to know the API.** There's no discovery for REST APIs: Claude works from what it knows of the API, or from its docs.
- **No per-call headers.** Claude can't set a header, so no credential can be passed in a call. A header an API needs on every request (a version, `Accept`) goes in the alias's `headers`.
- **Streamable HTTP only.** There's no SSE or stdio transport for MCP targets.
- **Remote tools aren't native tools.** Claude reads their schemas from `list_remote_tools` output, and Claude Code's tool search and per-tool permissions don't apply to them.

## Uninstall

```
/plugin uninstall mcp-gateway@claude-mods
```

The config file stays in `~/.config/mcp-gateway/`; delete it if you want its keys gone.
