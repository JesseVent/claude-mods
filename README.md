# claude-mods

Claude Code mods by Jesse Davies.

```
/plugin marketplace add JesseVent/claude-mods
/plugin install secret-keeper@claude-mods
/plugin install context-compass@claude-mods
```

On Claude Code 2.1.275 or later, one line each also works: `/plugin install secret-keeper --marketplace JesseVent/claude-mods`.

| Mod | What it does |
| --- | --- |
| [secret-keeper](plugins/secret-keeper) | Paste an API key and keep working: it's hidden before Claude or the transcript sees it, stored in your macOS Keychain for this project, and exported to every Bash command as an env var (`$ELEVENLABS_API_KEY`). Claude never sees the value and doesn't lecture you for pasting it. Optional PII hiding. |
| [context-compass](plugins/context-compass) | Shows what a session has in context: the budget, every file and how much of it was read, files changed on disk since, skills, helper agents, and what compaction summarised. A pane inside Claude Code's fullscreen layout, or a sidebar in tmux or iTerm2. |

Each mod's README covers options, limits and uninstalling.

MIT.
