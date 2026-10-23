# claude-mods

Claude Code mods by [JesseVent](https://github.com/JesseVent).

```
/plugin marketplace add JesseVent/claude-mods
/plugin install secret-keeper@claude-mods
/plugin install context-compass@claude-mods
/plugin install autopilot@claude-mods
```

On Claude Code 2.1.275 or later, one line each also works: `/plugin install secret-keeper --marketplace JesseVent/claude-mods`.

| Mod | What it does |
| --- | --- |
| [secret-keeper](plugins/secret-keeper) | Paste an API key and keep working: it's hidden before Claude or the transcript sees it, stored in your macOS Keychain for this project, and exported to every Bash command as an env var (`$ELEVENLABS_API_KEY`). Claude never sees the value and doesn't lecture you for pasting it. Optional PII hiding. |
| [context-compass](plugins/context-compass) | Shows what a session has in context: the budget, every file and how much of it was read, files changed on disk since, skills, helper agents, and what compaction summarised. A pane inside Claude Code's fullscreen layout, or a sidebar in tmux or iTerm2. |
| [autopilot](plugins/autopilot) | Sessions drive themselves: when a prompt leaves the goal, constraints or check unclear it asks you pointed questions first, your prompts are rewritten so Claude can finish them without asking, permission asks and questions are decided from the whole conversation, and after each turn it works out the practical next step (fix, verify, commit on a branch, push, open the PR) and sends it until only you can decide what's left. On by default; `/drive off` per session. Force-pushes and pushes to main are always refused. A model approves calls for you, so read its README's warning first. |

Each mod's README covers options, limits and uninstalling.

MIT.
