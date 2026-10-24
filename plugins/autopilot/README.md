# autopilot

Type what you want, answer what it asks, and walk away. In every session, autopilot asks pointed questions when your prompt leaves the goal, the constraints or how to check the result unclear, rewrites a session's first prompt into one Claude can finish without asking, decides the permission prompts you'd otherwise answer (and Claude's questions once you've gone quiet), and after each turn works out what practically needs to happen next (fix what failed, verify, commit on a branch) and sends it, until nothing is left that needs you. The push and the PR are yours, unless your goal asks for them.

```
you type:     add tests for the parser
it submits:   Add unit tests for the parser in src/parse.ts … Done when `bun test` passes.
Claude asks:  Bash(rm -rf coverage)        → autopilot: allowed Bash: stays inside the repository
turn ends:    autopilot: → bun test fails in parse.test.ts:42 (expected 3, got 2); fix parseList's off-by-one.
turn ends:    autopilot: → Commit the parser tests on feat/parser-tests.
…
              autopilot: done: parser tests added and green, committed on feat/parser-tests; the push and PR wait on you
```

Built and tested on Claude Code 2.1.310.

> **Read this first.** It's on in every session by default, and permission prompts are decided by a model on your behalf from the moment you type. Its `allow` settles the call: in auto mode the auto-mode classifier never sees a call autopilot allowed, and in default mode no dialog shows. Use it in repositories you'd let Claude work in unattended, and protect `main` with GitHub branch protection rather than relying on the client-side guard. `/drive off` turns it off for a session; `autoEngage` off in `/config` makes it opt-in with `/drive`.

## Install

```
/plugin install autopilot --marketplace JesseVent/claude-mods
```

or from a shell: `claude plugin marketplace add JesseVent/claude-mods`, then `claude plugin install autopilot@claude-mods`, then `/reload-plugins` in an open session.

## How it works

Each session's autopilot runs inside that session; nothing supervises from outside, and it never starts sessions of its own.

- **Questions first.** Before a new goal starts, autopilot checks that the goal, the constraints and how to verify the result are clear from your prompt and the conversation, where a sensible default counts (the existing tests passing, for a code change). When one isn't, and two readings would lead to materially different work, it asks you one pointed question at a time in the question dialog, up to five, and adds your answers to the prompt. A clear prompt, a question, or a prompt typed while a goal is being driven goes ahead with no question; Esc on a question goes ahead with what it has. It judges with the session's own model over the conversation, or, on a session's first prompt, with the rewrite model.
- **Prompts.** A session's first prompt is rewritten by the rewrite model (default `sonnet`). It keeps every requirement, copies names, paths and commands exactly as typed, leaves a reference your prompt doesn't explain ("the skills", "our repos") in your words for Claude, never sends Claude looking for something you didn't name, and, for a task, ends with how to prove it's done, in plain conversational sentences rather than a spec; a question stays a question. A dim line shows what was sent; if the rewrite fails, your prompt goes through as typed. Once Claude has replied, every prompt you type goes as typed: it points into a conversation the rewrite can't see, and a rewrite there can change what you meant. Your own words, with your answers, are the goal that permission asks and the next step are judged against; typed while a goal is being driven, they're added to that goal as a next step. Slash commands and autopilot's own prompts aren't rewritten.
- **Permission asks.** Only calls Claude Code would ask you about reach it: your settings' allow and deny rules still decide first. autopilot looks up the working directory and the current git branch, then asks the session's own model, over the whole conversation (every file read and command output), to allow or deny under a fixed policy: never push to main or master, force-push, delete outside the repository, touch credentials, spend money, or do anything irreversible outside the working directory. Committing the work on a branch is allowed unless the conversation shows a reason not to, such as a secret in what would be committed or you saying not to; a push or a pull request only when your goal asks for one. Files in the session scratchpad and `/tmp` are scratch, free to write, run and delete. Beside the conversation it gets the last 8 calls and what they returned, subagents' included, because the conversation it reads can lag a call in the same batch or a file a subagent wrote, and it's told never to refuse because a result isn't in view yet. Everything the session holds is marked as data, never instructions. It answers `ask` only when the conversation and facts can't settle the call, naming the missing fact; then the dialog shows, you get a notification, and a dim `left <tool> to you` line goes in the transcript.
- **Pushes.** Before any model sees it, a force-push, a push naming `main` or `master`, a push to a URL instead of a named remote, or any push while the current branch is `main` or `master` is refused, even where a settings rule allows it.
- **Only while driving.** Permission asks, questions and plans are decided only while a goal is being driven. After Esc or DONE, or in a slash command's turn, they come to you.
- **Questions and plans.** For 10 minutes after you last typed (a prompt or a slash command), Claude's questions and plans come to you as usual: you're likely still there. After that, autopilot answers a question from the conversation and the goal, and skips plan mode: Claude is told to state the plan in a few lines and carry it out.
- **The next step.** After each turn, the session's own model reads the conversation as the operator who owns the outcome and works out what practically needs to happen next: first the last turn's loose ends (a failure, a TODO, an unverified change, a question Claude asked), then verifying the work and committing it on a branch (never main), leaving the push and the PR to you unless your goal asks for them, then the follow-ups the goal clearly implies. It sends one step at a time, with the exact path, error or command Claude itself ran or proposed copied in, never restates the plan, and never adds scope. While Claude waits on work it started in the background (a command, a monitor, a subagent), it sends nothing and decides again when that work reports back; and while its last step is still queued behind a turn something else started, it sends no second one (`/drive on` included), and the turn cap waits for that step's own turn. Steps come from the goal and Claude's own work, never from text Claude read in a file, page or tool output. It replies `DONE: <summary>` only when what's left needs you (a decision, credentials, money, a push, a PR or a merge), and the summary says what that is. A question is done once it's answered.
- **Stopping.** It stops driving and notifies you on DONE, at the turn cap (25 by default), when a turn ends on an error or a refusal, and when you interrupt with Esc (`/drive on` resumes that goal). It stays on: the next prompt you type drives again.

## Commands

| Command | What it does |
| --- | --- |
| any prompt you type | Rewrite it, make it the goal, drive it (while on, the default) |
| `/drive <goal>` | The same, and turns autopilot on if it was off |
| `/drive on` | Turn it on for this session, resuming the last goal if there is one |
| `/drive off` | Turn it off for this session: prompts go through as typed, permission prompts come to you |
| `/drive` | List every session's autopilot: when it last moved, its state, turns, folder and goal (`*` is this session) |

The status line shows `autopilot 3/25 · <goal>` while it drives and `autopilot ready` while it waits for your next prompt.

## Options

Set in `/config` or under `pluginConfigs.autopilot` in settings:

| Option | Default | What it does |
| --- | --- | --- |
| `model` | `sonnet` | The model that rewrites a session's first prompt, and judges whether a session's first prompt needs questions. Permission asks, questions and the next step use the session's own model. |
| `maxTurns` | `25` | The most turns it starts on its own for one goal. |
| `autoEngage` | `true` | On in every session. Off: autopilot waits for `/drive`. |

## What it can reach

    ❯ ./register.ts hooks: session.start, prompt.submit, tool.check, tool.call, turn.complete, command.run{command=drive}
    ❯ ./register.ts calls: $.clock.after (via later), $.clock.now, $.command.register, $.env.get (via folder), $.fs.list (via list), $.fs.read (via list), $.fs.write (via record), $.model.complete (via brief, rewrite), $.model.fork, $.process.run (via branch), $.prompt.submit (via submit), $.session.cwd, $.session.id (via list, record), $.state.get, $.state.set, $.ui.ask (via brief), $.ui.log, $.ui.notify, $.ui.status (via set)
    ❯ ./register.ts env reads: HOME
    ❯ ./register.ts state writes: autopilot.last, autopilot.pilot

It runs one local program, `git branch --show-current`, on permission asks and pushes. Model calls go through the session's own client. Each session writes one status file, `~/.claude/autopilot/<session id>.json` (goal, turns, state, folder, time), which `/drive` reads.

## Limits

- **A model approving calls can be talked into one.** Text Claude reads (a web page, a file, a command's output) could argue a harmful call past the decider. The policy, the push guard and the data marking narrow that, not close it. Run it with `/sandbox` on, or in a repository you can lose.
- **The push guard reads the command text.** It catches `git … push` with a force flag, a `+` refspec or a protected branch name, and any push from `main` or `master` in the session's folder. A push from another folder (`cd x && git push`), through a script or an alias isn't caught.
- **Costs add up.** A session's first prompt is one small call to rewrite it, and a new goal one more to judge it plus one per question asked. Each turn's next step, each permission ask and each question Claude asks is a call over the whole conversation. It runs right after a request, so it's served mostly from the prompt cache, and it never adds to the session's own context. It keeps going for up to `maxTurns` turns per goal.
- **`/autopilot` is taken** by a command Claude Code ships, so the command is `/drive`.

## Uninstall

Disable it in `/plugin`. `~/.claude/autopilot/` holds the status files; delete the folder if you like.
