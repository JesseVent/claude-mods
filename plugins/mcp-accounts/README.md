# mcp-accounts

Several logins for the same MCP server, each signed in once, and `/account` to pick which one a project uses. Six Slack workspaces, a personal and a client Supabase, two Linears: add each as an account, and switching between them is instant, with no restart. The accounts a project isn't using are blocked, so nothing posts to the wrong workspace.

```
/account add slack acme          → Run /reload-plugins to load it, then sign it in: /mcp → plugin:mcp-accounts:slack-acme → Authenticate …
/account add slack sidegig
/account slack acme              → slack → acme in /Users/you/Dev/acme-app.
/account
                                 * slack · acme      connected
                                   slack · sidegig   connected
Claude calls slack-sidegig       → refused: This project uses the acme slack account, not sidegig …
```

Built and tested on Claude Code 2.1.310.

## Install

```
/plugin install mcp-accounts --marketplace JesseVent/claude-mods
```

## Setup

1. **Add each account:** `/account add <service> <account>`. Slack and Supabase are built in. For any other remote MCP server, give its URL with the first account: `/account add linear work https://mcp.linear.app/mcp`. Later accounts of that service take no URL.
2. **Load them:** run `/reload-plugins`. The new servers join the session with no restart.
3. **Sign each one in, once:** `/mcp` → `plugin:mcp-accounts:<service>-<account>` → Authenticate. The browser opens on that service's sign-in.
   - **Slack:** pick the workspace in the top-right switcher before you allow.
   - **Supabase or another per-login service:** the browser has to be logged in as that account. Use a private window or another browser profile for the second login.

   Claude Code stores each account's sign-in separately, and it lasts across sessions.
4. **Pick one per project:** `/account slack acme`. A service with a single account needs no pick.

Turn off the official Slack and Supabase plugins (and the claude.ai Slack connector, if you have it) once their accounts are here, so Claude doesn't see two sets of the same tools.

## Commands

| Command | What it does |
| --- | --- |
| `/account` | Lists every account, whether it's connected or still needs sign-in, and marks the one this project uses with `*` |
| `/account <service> <account>` | Uses that account in this project (the project root), remembered across sessions |
| `/account <service>` | Lists that service's accounts |
| `/account add <service> <account> [url]` | Adds an account; the URL only for a service's first account, when it isn't built in |
| `/account remove <service> <account>` | Removes one; `/reload-plugins` drops its server |

Service names are lowercase letters and digits. Account names are lowercase letters, digits and dashes, up to 30 characters, because they become server and tool names.

## How it works

- **One server per account.** Each account is its own MCP server in this mod's manifest, cloned from its service (URL, plus the OAuth client for Slack). Claude Code keys a server's sign-in by its name, so each account keeps its own login.
- **Each account's URL carries `?account=<name>`.** Claude Code runs servers that share a URL as one server under one login, and a different header doesn't change that. The tag never reaches the sign-in: Slack's and Supabase's OAuth discovery name the bare server as the resource.
- **The account list lives in the mod's store**, which survives updates. At each start the mod rebuilds its server file from that list. If that changed anything (say an update replaced the file), it runs `/reload-plugins` itself.
- **The gate.** A call to any account's tools other than the one this project uses is refused before it runs, and so is a read of its MCP resources (`ReadMcpResourceTool` and the other resource tools, matched by the server they name). While any service has several accounts, a resource listing that names no server is refused too, since it would include the blocked ones. It's refused with the right tool prefix and the `/account` command in the reason. Signing an account in is never blocked. With several accounts and none picked, every call is refused until you pick. If the check itself fails, the call is refused too.
- **Claude knows.** The system prompt's environment section names the account each service uses here and its tool prefix (`mcp__plugin_mcp-accounts_slack-acme__*`). The status line shows `slack:acme · supabase:personal`.

## What it can reach

    ❯ ./register.ts hooks: session.start, tool.check, prompt.section{name=env_info_simple}, command.run{command=account}
    ❯ ./register.ts calls: $.clock.after (via reload), $.command.register, $.command.run (via reload), $.fs.read (via sync), $.fs.write (via sync), $.mcp.connect (via list), $.session.root (via active, list, use), $.store.get (via get), $.store.set (via add, remove, use), $.ui.log (via reload), $.ui.status (via status)

It writes one file, `accounts.mcp.json` in its own folder, and runs `/reload-plugins` only at a start when that file changed. Its store holds account names, the URLs of services you added, and each project root's picks. Sign-ins stay in Claude Code's own credential store.

## Limits

- **claude.ai connectors can't be switched.** Gmail, Calendar, Drive and the other claude.ai connectors belong to your claude.ai login. For several Google accounts, add a remote Google MCP server here by URL.
- **Adding or removing takes `/reload-plugins`.** Claude Code refuses a reload started from inside a slash command, so the mod asks you to run it. Switching between accounts never needs it.
- **A server has to ignore the `account` query parameter.** Context7, and the OAuth discovery of Slack and Supabase, were checked with it. A server that rejects unknown parameters won't work here.
- **Projects are keyed by the session's root,** the folder the session started in (or `/cd` moved it to). A session started in a subfolder of a repo is its own project.
- **Removing an account keeps its sign-in.** Claude Code keeps the stored token, and adding the same account again reuses it. To clear it, use `/mcp` → the server → Clear authentication before you remove it.

## Uninstall

Pick each account's sign-in to clear in `/mcp` first if you want them gone, then:

```
/plugin uninstall mcp-accounts@claude-mods
```
