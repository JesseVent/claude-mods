# autopilot

Give a Claude Code session a goal and walk away. autopilot rewrites the prompt you type into one Claude can finish without asking, decides the permission prompts and questions you'd otherwise answer, and after each turn sends the next instruction itself, until the goal is done, the turn cap is reached or you interrupt.

```
you type:     /drive add tests for the parser
it submits:   Add unit tests for the parser in src/parse.ts … Done when `bun test` passes.
Claude asks:  Bash(rm -rf coverage)        → autopilot allowed: stays inside the repository
turn ends:    autopilot → Now run bun test and fix any failure.
…
              autopilot done: parser tests added, bun test green
```

Built and tested on Claude Code 2.1.304.

> **Read this first.** Permission prompts are decided by a model on your behalf. Its `allow` settles the call: in auto mode the auto-mode classifier never sees a call autopilot allowed, and in default mode no dialog shows. Use it in repositories you'd let Claude work in unattended, and protect `main` with GitHub branch protection rather than relying on the client-side guard.

## Install

```
/plugin install autopilot --marketplace JesseVent/claude-mods
```

or from a shell: `claude plugin marketplace add JesseVent/claude-mods`, then `claude plugin install autopilot@claude-mods`, then `/reload-plugins` in an open session.

## How it works

Each session's autopilot runs inside that session; nothing supervises from outside, and it never starts sessions of its own.

- **Prompts.** While it drives, each prompt you type is rewritten by the rewrite model (default `sonnet`) to keep every requirement, settle ambiguity with the most reasonable reading and end with how to prove it's done. The rewrite becomes the goal. Typed while a turn runs, it's added to the goal as a next step. A dim line shows what was sent; if the rewrite fails, your prompt goes through as typed. Slash commands and autopilot's own prompts aren't rewritten.
- **Permission asks.** Only calls Claude Code would ask you about reach it: your settings' allow and deny rules still decide first. autopilot looks up the working directory and the current git branch, then asks the session's own model, over the whole conversation (every file read and command output), to allow or deny under a fixed policy: never push to main or master, force-push, delete outside the repository, touch credentials, spend money, or do anything irreversible outside the working directory. Everything the session holds is marked as data, never instructions. It answers `ask` only when the conversation and facts can't settle the call, naming the missing fact; then the dialog shows and you get a notification.
- **Pushes.** Before any model sees it, a force-push, a push naming `main` or `master`, or any push while the current branch is `main` or `master` is refused, even where a settings rule allows it.
- **Questions and plans.** When Claude asks a question, autopilot answers it from the conversation and the goal. Plan mode is skipped: Claude is told to state the plan in a few lines and carry it out.
- **The next step.** After each turn, the session's own model reads the conversation as the operator and replies with the next instruction, or `DONE: <summary>` when the goal is done and verified. The instruction is submitted as a new prompt and counted.
- **Stopping.** It stops and notifies you on DONE, at the turn cap (25 by default), when a turn ends on an error or a refusal, and when you interrupt with Esc (`/drive on` resumes).

## Commands

| Command | What it does |
| --- | --- |
| `/drive <goal>` | Rewrite the goal, start driving, submit it |
| `/drive on` | Resume toward the last goal, or with none, take the next prompt you type as the goal |
| `/drive off` | Stop driving |
| `/drive` | List every session's autopilot: when it last moved, its state, turns, folder and goal (`*` is this session) |

The status line shows `autopilot 3/25 · <goal>` while it drives.

## Options

Set in `/config` or under `pluginConfigs.autopilot` in settings:

| Option | Default | What it does |
| --- | --- | --- |
| `model` | `sonnet` | The model that rewrites your prompts. Permission asks, questions and the next step use the session's own model. |
| `maxTurns` | `25` | The most turns it starts on its own for one goal. |
| `autoEngage` | `false` | Start every session driving, so your first prompt becomes the goal. |

## What it can reach

    ❯ ./register.ts hooks: session.start, prompt.submit, tool.check, turn.complete, command.run{command=drive}
    ❯ ./register.ts calls: $.clock.after (via later), $.command.register, $.env.get (via folder), $.fs.list (via list), $.fs.read (via list), $.fs.write (via record), $.model.complete (via rewrite), $.model.fork, $.process.run (via branch), $.prompt.submit (via submit), $.session.cwd, $.session.id (via list, record), $.state.get, $.state.set, $.ui.log, $.ui.notify, $.ui.status (via set)
    ❯ ./register.ts env reads: HOME
    ❯ ./register.ts state writes: autopilot.pilot

It runs one local program, `git branch --show-current`, on permission asks and pushes. Model calls go through the session's own client. Each session writes one status file, `~/.claude/autopilot/<session id>.json` (goal, turns, state, folder, time), which `/drive` reads.

## Limits

- **A model approving calls can be talked into one.** Text Claude reads (a web page, a file, a command's output) could argue a harmful call past the decider. The policy, the push guard and the data marking narrow that, not close it. Run it with `/sandbox` on, or in a repository you can lose.
- **The push guard reads the command text.** It catches `git … push` with a force flag, a `+` refspec or a protected branch name, and any push from `main` or `master` in the session's folder. A push from another folder (`cd x && git push`), through a script or an alias isn't caught.
- **Costs add up.** Each permission ask and each turn is a model call over the whole conversation (served mostly from the prompt cache), and it keeps going for up to `maxTurns` turns per goal.
- **`/autopilot` is taken** by a command Claude Code ships, so the command is `/drive`.

## Uninstall

Disable it in `/plugin`. `~/.claude/autopilot/` holds the status files; delete the folder if you like.
