# loadouts

Requip for Claude Code, after Erza Scarlet's magic in Fairy Tail: named loadouts of skills, MCP servers and instructions, one equipped per project. A `supabase` loadout for the backend repo, a `nextjs` loadout for the frontend: equip one and its skills, servers and instructions are in effect, and the previously equipped loadout's go out. You equip from the `/loadout` picker, and Claude can requip itself with its `equip` tool when the work changes. Switching never needs a restart.

```
/loadout                 → opens the picker:
                             ● nextjs
                               skills: nextjs-best-practices, vercel-react-best-practices · servers: next-devtools
                               supabase
                               skills: supabase:supabase, supabase:supabase-postgres-best-practices · servers: supabase
                             Enter equips · Esc closes
Claude calls supabase    → refused: The supabase server is in the supabase loadout and nextjs is equipped …
/loadout supabase        → Unequipped nextjs; equipped supabase in ~/code/app.
```

Built and tested on Claude Code 2.1.310.

## Install

```
/plugin install loadouts --marketplace JesseVent/claude-mods
```

## Loadouts

One JSON file per loadout in the mod's `loadouts/` folder. Add a file or edit one; the mod reads the folder each time it's used.

```json
{
  "name": "supabase",
  "skills": ["supabase:supabase", "supabase:supabase-postgres-best-practices"],
  "mcpServers": {
    "supabase": { "type": "http", "url": "https://mcp.supabase.com/mcp" }
  },
  "instructions": "This project's backend is Supabase. Use the supabase MCP server's tools for the database…"
}
```

| Field | What it holds |
| --- | --- |
| `name` | Lowercase letters, digits and dashes, up to 30 characters |
| `skills` | Skill names as `/skills` lists them: `supabase:supabase` for a plugin's skill, `nextjs-best-practices` for one of your own |
| `mcpServers` | Servers in the same shape as a `.mcp.json`'s `mcpServers`. Their names follow the loadout name's rules, because they become tool names: `mcp__plugin_loadouts_<server>__<tool>` |
| `instructions` | Text added to Claude's system prompt while the loadout is equipped |

The mod ships two examples, `supabase` and `nextjs` (the `next-devtools-mcp` server, run with `bunx`). A file that doesn't parse, or breaks a rule above, is skipped, and the start and `/loadout` say which and why. Two loadouts can share a server only if they define it the same way.

## Commands

| Command | What it does |
| --- | --- |
| `/loadout` | Opens the picker: every loadout, `●` on the one equipped in this project, its skills and servers beneath. Enter (or a click) equips one and closes the picker; Tab or the arrow keys move between rows |
| `/loadout <name>` | Equips that loadout in this project (the project root), remembered across sessions |

Claude has one tool, `mcp__loadouts__equip`, that does the same as `/loadout <name>`. The status line shows `loadout: <name>`.

## How it works

- **A loadout only manages what it names.** A skill or server some loadout names is on only while that loadout is equipped, and with no loadout equipped all of them are off. Skills, servers and tools that no loadout names are left alone.
- **Every loadout's servers are loaded; the gate decides.** The mod writes all of them to `loadouts.mcp.json`, which its manifest names, so the servers join at the start. A call to a server of a loadout that isn't equipped is refused before it runs. So is a read of its MCP resources (`ReadMcpResourceTool` and the other resource tools, matched by the server they name). Equipping changes the gate, not the server list, so it never needs a reload.
  - A resource listing that names no server is always refused, since it would reach every server; Claude names one and retries.
  - If the check itself fails, a call to a loadout server is refused too.
- **Skills.** The skills of loadouts that aren't equipped are left out of the skill listing Claude reads, the listing already in the conversation included. A call to one through the Skill tool is refused, and so is a typed `/name`.
- **Claude knows.** The system prompt's environment section names the equipped loadout with its instructions, skills and server tool prefixes, plus the other loadouts and what's in them. Claude re-reads it from the next request after each equip.

## What it can reach

    ❯ ./register.tsx hooks: session.start, tool.check, tool.call{tool=mcp__loadouts__equip}, skill.prompt, prompt.attachment{type=skill_listing}, prompt.section{name=env_info_simple}, ui.render{component=Pane, requestId=loadouts}, command.run{command=loadout}
    ❯ ./register.tsx calls: $.clock.after (via reload), $.command.register, $.command.run (via reload), $.fs.list (via load), $.fs.read (via load, sync), $.fs.write (via sync), $.session.root (via equip, equipped), $.store.get (via get), $.store.set (via equip), $.tool.register, $.ui.close, $.ui.invalidate (via equip), $.ui.log, $.ui.open, $.ui.resolve, $.ui.status

It reads its own `loadouts/` folder and writes one file, `loadouts.mcp.json` in its own folder. Its store holds each project root's equipped loadout.

## Limits

- **Adding or changing a loadout's servers takes a reload, which the mod runs.** Claude Code reads a plugin's server list only when it loads the plugin, and saving a loadout file reloads nothing by itself. The mod rewrites the list at each start, and again when you equip after editing a loadout's `mcpServers`, then queues `/reload-plugins`. After `/loadout <name>` that reload runs as soon as the command ends, and the new server connects: checked live with a server added mid-session. If Claude Code refuses the reload, the mod logs a line asking you to run `/reload-plugins`. Editing skills or instructions takes effect at once.
- **An unequipped server stays connected.** Its tools are still listed for Claude, behind tool search; every call to them is refused, and the system prompt says they're off.
- **A loadout server takes over another server with the same URL.** Claude Code runs one server per URL. With the `supabase` example, equipped or not, the official Supabase plugin's `plugin:supabase:supabase` server doesn't load, and `/mcp` shows the claude.ai Supabase connector as hidden: same URL as `plugin:loadouts:supabase`. That keeps Supabase behind the loadout's gate. Keep the Supabase plugin enabled, since the example's skills are its own, and sign the loadout's server in once: `/mcp` → `plugin:loadouts:supabase` → Authenticate.
- **The loadout files live in the mod's folder.** Installed from GitHub, that folder is a copy, and an update replaces it: keep your loadouts in a clone of the repository, installed as a folder marketplace (`claude plugin marketplace add <folder>`), and edits take effect with no reinstall.
- **Projects are keyed by the session's root,** the folder the session started in (or `/cd` moved it to). A session started in a subfolder of a repo is its own project.

## Uninstall

```
/plugin uninstall loadouts@claude-mods
```
