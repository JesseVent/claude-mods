<img width="1376" height="768" alt="claudemods" src="https://github.com/user-attachments/assets/1a771356-a6e2-4099-9167-c18a4cf6775a" />


# claude-mods

Claude Code mods for safer secrets, better session awareness, and more autonomous work.

A small toolkit for Claude Code that helps you:

- keep API keys out of the transcript and hidden from Claude,
- see what the session actually has in context,
- let sessions drive themselves with guarded automation,
- swap the skills, MCP servers and instructions in effect for what you're working on.

This repo includes four mods:

- `secret-keeper` — hides pasted API keys from Claude and stores them in your macOS Keychain.
- `context-compass` — shows the live budget, files in context, disk changes, helper agents, and more.
- `autopilot` — asks pointed questions when a prompt is unclear, rewrites prompts, decides permission prompts, and keeps a goal moving across turns.
- `loadouts` — equips a named loadout of skills, MCP servers and instructions per project, and switches the rest off.

## Quick install

```bash
/plugin marketplace add JesseVent/claude-mods
/plugin install secret-keeper@claude-mods
/plugin install context-compass@claude-mods
/plugin install autopilot@claude-mods
/plugin install loadouts@claude-mods
```

On Claude Code 2.1.275 or later, this also works:

```bash
/plugin install secret-keeper --marketplace JesseVent/claude-mods
/plugin install context-compass --marketplace JesseVent/claude-mods
/plugin install autopilot --marketplace JesseVent/claude-mods
/plugin install loadouts --marketplace JesseVent/claude-mods
```

## What each mod does

### secret-keeper

Paste an API key and keep working. It is hidden before Claude or the transcript sees it, stored securely in your macOS Keychain for this project, and injected back as env vars without leaking it in plain text.

Best for:
- API tokens and credentials
- local dev environments
- clean transcripts that shouldn't expose secrets

See: [plugins/secret-keeper](plugins/secret-keeper)

### context-compass

Know what is in context. It shows your token budget, files read, disk changes, helper agents, skills, and compaction summaries so you know what Claude actually knows.

Best for:
- debugging context bloat
- checking what was loaded into the session
- spotting stale or unexpectedly read files

See: [plugins/context-compass](plugins/context-compass)

### autopilot

Let sessions drive themselves. When a prompt leaves the goal, constraints or how to check the result unclear, it asks you pointed questions first; then prompts are rewritten, permission decisions are automated, and the next step is chosen across turns so a goal can continue without constant prompting.

Best for:
- long-running implementation tasks
- permission-heavy workflows
- letting Claude keep moving without repeated hand-holding

See: [plugins/autopilot](plugins/autopilot)

### loadouts

Requip, as in Fairy Tail. A loadout is a JSON file naming skills, MCP servers and instructions: equip `supabase` in the backend repo and `nextjs` in the frontend one, from the `/loadout` picker or by Claude itself. The equipped loadout's set is in effect and every other loadout's is off, with no restart.

Best for:
- projects on different stacks
- keeping unrelated MCP servers and skills out of Claude's way
- per-stack instructions that follow the project

See: [plugins/loadouts](plugins/loadouts)

## Mod summary

| Mod | What it does |
| --- | --- |
| [secret-keeper](plugins/secret-keeper) | Keeps pasted API keys hidden from Claude and the transcript, stores them in your macOS Keychain, and re-injects them as env vars. |
| [context-compass](plugins/context-compass) | Shows what a session has in context: budget, file reads, disk changes, helper agents, skills, and compaction summaries. |
| [autopilot](plugins/autopilot) | Lets sessions keep driving toward a goal by asking pointed questions when a prompt is unclear, rewriting prompts, deciding permission prompts, and choosing the next step automatically. |
| [loadouts](plugins/loadouts) | Equips one named loadout of skills, MCP servers and instructions per project, from a picker or by Claude, and switches every other loadout's set off. |

## Notes

Each mod has its own README with details on installation, options, limits, and uninstall steps.

Built with TypeScript, JavaScript, and a bit of shell tooling.

MIT.
