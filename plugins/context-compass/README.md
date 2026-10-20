# context-compass

A live sidebar for Claude Code that shows what the session has in context: the budget, every file and how much of it was read, files that changed on disk after the read, the skills loaded, helper agents, and what compaction turned into summary.

It reads the session transcript Claude Code already writes (`~/.claude/projects/…/<session>.jsonl`). Nothing is sent anywhere. No dependencies beyond Node 18+.

```
 CONTEXT                42k / 200k  21%
 ━━━━━━━╸━━━━━━━━━━━━━━━━━━━━━┃━━━━━━━━
 118k free             compacts ≈160k
 ██████████████████████████████████████
 ■ sys 13k ■ chat 22k ■ files 7k ■ 330
 ──────────────────────────────────────
 FILES 7           ●4 △1 ■1 ○1   size ↓
 ▾ arcsql                          4.8k
 ● schema.generated.ts             4.3k
 ● pyodideService.ts          38%   416
 ▾ drive-eqms                       832
 △ release_guard_test.ts      14%   311
 ...
```

## Install

### As a plugin (recommended)

In Claude Code:

```
/plugin install context-compass --marketplace JesseVent/claude-mods
```

While developing it, load the folder in every session instead, so edits to the mod reload as you save:

```
export CLAUDE_CODE_PLUGIN_DIRS="/path/to/claude-mods/plugins/context-compass"
```

Restart Claude Code once so the hooks load. Then:

```
/context-compass
```

In Claude Code's fullscreen layout, 110 columns or wider, that docks the Context compass pane beside the transcript, and the pane opens there by itself in later sessions until you close it. Anywhere else it splits a 42-column terminal pane to the right (tmux, or iTerm2 without tmux) and leaves focus on Claude. `CTX_SIDEBAR_WIDTH=48` changes the width.

The plugin adds two hooks (`SessionStart`, `UserPromptSubmit`) that record which transcript belongs to which directory, and where the plugin is installed, in `~/.claude/context-compass/`. That keeps the sidebar on the right session after `/clear` or `/resume`.

### Without the plugin

Run it in any terminal, in the same directory as the Claude Code session:

```
node /path/to/claude-mods/plugins/context-compass/bin/context-compass.mjs
```

It follows the newest transcript for that directory.

### tmux key binding (optional)

```
# ~/.tmux.conf: prefix + C opens the sidebar beside the current pane
bind-key C run-shell -c "#{pane_current_path}" "TMUX_PANE=#{pane_id} sh /path/to/claude-mods/plugins/context-compass/bin/ctx-open.sh"
```

### One-line status in Claude Code (optional)

The same data as a single line under the prompt. Add to `~/.claude/settings.json`:

```json
{ "statusLine": { "type": "command", "command": "node /path/to/claude-mods/plugins/context-compass/bin/context-compass.mjs --band" } }
```

```
ctx ━━╸━━━━━━━┃━━ 42k/200k · ●5 △1 · ◆1
```

## Reading it

| Glyph | Meaning |
|---|---|
| ● | in context, full text |
| △ | changed on disk after Claude last read or edited it |
| ■ | image |
| ○ | summarised: read before a compaction, only the summary remains |
| ◆ | helper agent; its reads stay out of main context, only its summary counts |
| ✦ | skill loaded, by the Skill tool or a typed `/name`, with the tokens its text added |
| » | text a hook put in context: a SessionStart or UserPromptSubmit hook's output, or any hook's additional context. Labelled with the skill it names, else its first line; `×5` means a per-prompt hook added it five times |
| `38%` | share of the file's lines Claude has seen (blank means the whole file) |

The top bar is the window; `┃` marks the auto-compact point. The second bar splits what is in context: system prompt and tools, conversation, files, helper summaries.

## Opening files

File names are terminal hyperlinks. Cmd-click (macOS) or ctrl-click opens the file in your system's default app for that file type. In file detail, the folder path is a link too.

This works in iTerm2, WezTerm, Kitty, Ghostty and the VS Code terminal. Terminals without hyperlink support show plain text.

Inside tmux (3.4 or later), add this to `~/.tmux.conf` and restart tmux:

```
set -as terminal-features ",*:hyperlinks"
```

To open in an editor instead, set a URL template. `{path}` is the file and `{line}` is the first line Claude read:

```
export CTX_LINK_URL='vscode://file/{path}:{line}'   # or cursor://file/{path}:{line}
```

`CTX_LINKS=0` or `--no-links` turns links off.

## Keys

| Key | Action |
|---|---|
| `↑↓` `j k` | move |
| `enter` | file detail (line ranges seen, cost, read history), or fold a project |
| `space` | fold the project |
| `/` | filter by path |
| `s` | sort: size, name, recent |
| `o` | open in `$EDITOR` in a new tmux window |
| `y` | copy the path |
| `r` | type "read the parts of … you have not seen" (or "re-read …") into the Claude pane, without pressing enter |
| `?` | keys and legend |
| `q` | quit |

`r` needs tmux, and the sidebar opened with `ctx-open.sh` or `/context-compass`, which records the Claude pane.

## Options

| Flag / env | Default | |
|---|---|---|
| `--window N`, `CTX_WINDOW` | 200k, or 1M once a session passes 200k | context window |
| `--compact-at N`, `CTX_COMPACT_AT` | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` if set, else 80% (shown as `≈`) | auto-compact point |
| `--root DIR`, `CTX_ROOT` | common parent of the files read | where project groups start |
| `--transcript FILE`, `CTX_TRANSCRIPT` | follow this directory's session | pin one transcript |
| `--cwd DIR` | current directory | which session to follow |
| `--ascii`, `CTX_ASCII=1` | auto from locale | ASCII glyphs only |
| `--no-color`, `NO_COLOR` | | |
| `--no-links`, `CTX_LINKS=0` | links on | clickable file names |
| `CTX_LINK_URL` | `file://` (system default app) | link template, `{path}` and `{line}` |
| `--once --cols N --rows N` | | print one frame and exit |
| `--band` | | one-line status; reads Claude Code's statusLine JSON on stdin |

Colours use truecolor when `COLORTERM=truecolor`, otherwise the nearest xterm-256 values.

## How the numbers are made

- **Context total** is exact: the API usage Claude Code records on the latest assistant message (input + cache read + cache write + output).
- **System + tools** is the first request's input minus the first prompt.
- **Files** and **helper summaries** are estimates at 4 characters per token, from the tool results in the transcript. Images use width × height / 750.
- **Conversation** is the remainder.
- **Seen %** merges every line range read since the last compaction.
- **Stale** compares the file's modified time with the last time Claude read or edited it.

## Limits

- The transcript format is not a public API. A Claude Code update can change it; the parser skips what it does not recognise rather than failing.
- The window size is not in the transcript, so 1M sessions are recognised only once usage passes 200k. Set `--window` to be exact.
- The auto-compact point is a guess unless you set it.
- Subagent reads are counted per helper but not listed by file.
- The pane needs tmux or iTerm2. Elsewhere, run the sidebar in a second terminal.

## Tests

```
npm test
```

They build a transcript in the same shape as real ones and check coverage, compaction, staleness, helpers, totals, and that every rendered line is exactly the pane width at several sizes, in Unicode and ASCII, and that file links are well formed.
