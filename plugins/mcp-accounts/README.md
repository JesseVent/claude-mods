# mcp-accounts

Several logins for the same MCP server, each signed in once, and `/account` to pick which ones a project uses: one, or as many as you need. Six Slack workspaces, a personal and a client Supabase, two Linears: add each as an account, and switching between them is instant, with no restart. The accounts a project isn't using are blocked, so nothing posts to the wrong workspace.

```
/account add slack acme          → Run /reload-plugins to load it, then sign it in: /mcp → plugin:mcp-accounts:slack-acme → Authenticate …
/account add slack sidegig
/account                         → opens the picker:
                                   ╭──────────────────────────────────────────────────────────────╮
                                   │ slack                                                        │
                                   │ ● acme     −                                                 │
                                   │   sidegig  +                                                 │
                                   │ Enter on a name uses only it · + adds, − drops · Esc closes  │
                                   ╰──────────────────────────────────────────────────────────────╯
Claude calls slack-sidegig       → refused: This project uses slack acme, not sidegig …
/account slack acme sidegig      → slack → acme and sidegig: both work, any others stay blocked
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
4. **Pick per project:** `/account` opens the picker. Enter (or a click) on a name uses that account alone and closes the picker. `+` beside an account adds it to those in use, and `−` drops it, with the picker staying open. Tab or the arrow keys move between them. Without the picker: `/account slack acme` for one, `/account slack acme sidegig` for several. A service with a single account needs no pick.

Turn off the official Slack and Supabase plugins (and the claude.ai Slack connector, if you have it) once their accounts are here, so Claude doesn't see two sets of the same tools.

## Commands

| Command | What it does |
| --- | --- |
| `/account` | Opens the picker: each service's accounts, `●` on those this project uses. A name uses that account alone; `+` and `−` add and drop one (Esc closes). Also lists every account, whether it's connected or still needs sign-in, with `*` on those in use |
| `/account <service> <account> [<account>…]` | Uses those accounts in this project (the project root), remembered across sessions; the service's other accounts stay blocked |
| `/account <service>` | Lists that service's accounts |
| `/account add <service> <account> [url]` | Adds an account; the URL only for a service's first account, when it isn't built in |
| `/account remove <service> <account>` | Removes one; `/reload-plugins` drops its server |

Service names are lowercase letters and digits. Account names are lowercase letters, digits and dashes, up to 30 characters, because they become server and tool names.

## How it works

- **One server per account.** Each account is its own MCP server in this mod's manifest, cloned from its service (URL, plus the OAuth client for Slack). Claude Code keys a server's sign-in by its name, so each account keeps its own login.
- **Each account's URL carries `?account=<name>`.** Claude Code runs servers that share a URL as one server under one login, and a different header doesn't change that. The tag never reaches the sign-in: Slack's and Supabase's OAuth discovery name the bare server as the resource.
- **The account list lives in the mod's store**, which survives updates. At each start the mod rebuilds its server file from that list. If that changed anything (say an update replaced the file), it runs `/reload-plugins` itself.
- **The gate.** A call to the tools of an account this project doesn't use is refused before it runs, and so is a read of its MCP resources (`ReadMcpResourceTool` and the other resource tools, matched by the server they name).
  - The reason names the accounts in use and their tool prefixes, plus the `/account` command that would add the blocked one.
  - Signing an account in is never blocked.
  - With several accounts and none picked, every call is refused until you pick.
  - If the check itself fails, the call is refused too.
  - A resource listing that names no server is always refused, since it would reach every server; Claude names one and retries. Which of this mod's servers are loaded can't be told reliably: a removed account's server stays until the reload, and a server with resources but no tools leaves no trace.
- **Claude knows.** The system prompt's environment section names the accounts each service uses here and their tool prefixes (`mcp__plugin_mcp-accounts_slack-acme__*`). With several in use, Claude uses the one the task names and asks when it doesn't say. The status line shows `slack:acme+sidegig · supabase:personal`.

## What it can reach

    ❯ ./register.tsx hooks: session.start, tool.check, ui.render{component=Pane, requestId=accounts}, prompt.section{name=env_info_simple}, command.run{command=account}
    ❯ ./register.tsx calls: $.clock.after (via reload), $.command.register, $.command.run (via reload), $.fs.read (via sync), $.fs.write (via sync), $.mcp.connect (via list), $.session.root (via choose, inUse, list), $.store.get (via get), $.store.set (via add, choose, remove), $.ui.close, $.ui.invalidate (via choose), $.ui.log (via reload), $.ui.open (via picker), $.ui.resolve, $.ui.status (via status)

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
