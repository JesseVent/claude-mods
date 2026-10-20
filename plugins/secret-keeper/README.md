# secret-keeper

Paste an API key into Claude Code and keep working. secret-keeper hides the key before Claude or the transcript sees it, stores it in your macOS Keychain for this project, and exports it to every Bash command as an environment variable. Claude writes `$ELEVENLABS_API_KEY`, your scripts read `process.env.ELEVENLABS_API_KEY`, and the value never enters the conversation.

```
you paste:    ELEVENLABS_API_KEY=sk_…
Claude sees:  ELEVENLABS_API_KEY=[secret:ELEVENLABS_API_KEY]
Claude runs:  bun run tts.ts
Bash runs:    export ELEVENLABS_API_KEY="$SECRET_KEEPER_1"; bun run tts.ts
              with SECRET_KEEPER_1 holding the value for that call only
```

Built and tested on Claude Code 2.1.303.

## Install

```
/plugin install secret-keeper --marketplace JesseVent/claude-mods
```

or from a shell: `claude plugin marketplace add JesseVent/claude-mods`, then `claude plugin install secret-keeper@claude-mods`, then `/reload-plugins` in an open session.

## How it works

- **Pasting.** Each secret in a prompt becomes `[secret:NAME]`. The name is the one you pasted it with (`NAME=value`, `export NAME=…`, `"NAME": "…"`). With no name, it's the provider's usual variable, such as `OPENAI_API_KEY` or `GITHUB_TOKEN`. The value goes to the login Keychain (service `claude-secret-keeper`), on stdin, never in a process argument. Pasting a new value under a name you already stored replaces it.
- **Per project.** A stored secret belongs to the project you pasted it in: the git root, else the working directory. Sessions in that project load it; sessions in other projects don't. `/secrets global NAME` shares one with every project.
- **Bash.** Values travel in the environment, never in the command text.
  - While a Bash call runs, the process variables `SECRET_KEEPER_1` to `SECRET_KEEPER_16` hold this project's secrets.
  - The command gets a prefix of plain exports that name those slots, such as `export GITHUB_TOKEN="$SECRET_KEEPER_1" NPM_TOKEN="$SECRET_KEEPER_2";`.
  - Why: the hooks beneath a mod and the permission check see the command as rewritten. Some hooks log it, and the auto-mode classifier reads it. None of them ever see a value.
  - Allow rules such as `Bash(git push:*)` still match, because the prefix is ordinary `export`s.
  - The transcript keeps the command as Claude wrote it, with `$NAME`.
  - A `[secret:NAME]` Claude writes into a command becomes `"${NAME}"`.
  - If an environment write is refused, Bash runs without the secrets. They are never put in the command instead.
- **Files.** In `Edit`, `Write` and `NotebookEdit`, `[secret:NAME]` is written as the real value, so `NAME=[secret:NAME]` in a `.env` file works, and so does an edit to a line that holds a key.
- **Everything Claude reads.** Tool output, file contents, Claude's own text and notices are scanned before they're stored or sent:
  - a new secret found there is hidden for the session, but not stored or exported;
  - a value it already knows is hidden again wherever it shows up: raw, JSON-escaped, base64, base64url or hex.
- **The standing note.** One paragraph in the environment section tells Claude:
  - how placeholders work;
  - that pasting a key is expected and needs no warning;
  - that a secret it does see in plain text was missed and is worth saying so once;
  - which names Bash has.
- **Failing closed.** If a scan fails, the row is withheld, the prompt is not sent, or the tool call is refused. Nothing gets through unscanned.

## Commands

| | |
| --- | --- |
| `/secrets` | What's stored for this project and globally, plus a count for other projects and what this session hid |
| `/secrets rm NAME` | Remove one (this project's first, then the global one) |
| `/secrets rm all` | Remove every secret secret-keeper stored, in every project |
| `/secrets global NAME` | Share this project's secret with every project |
| `/secrets local NAME` | Make a global secret this project's only |

## Options

Set in `/plugin`; they're stored under `pluginConfigs` in settings.

- `pii` (default `false`): also hide personal data, checking the check digit where there is one:
  - email addresses and phone numbers;
  - payment cards (Luhn) and IBANs (mod-97);
  - Australian TFN, Medicare and ABN numbers;
  - US SSNs.

  Each appears as `[pii:EMAIL#1]`. It's never stored or exported, and a Bash command that names one is refused.
- `keychain` (default `true`): off keeps pasted secrets for the session only.
- `off` (default empty): comma-separated rule ids to skip, for example `assignment,jwt`.

## Rules

**Providers, by documented prefix:**
`anthropic`, `openai`, `openai-scoped`, `openrouter`, `elevenlabs`, `deepseek`, `aws-access-key`, `github`, `github-fine-grained`, `gitlab`, `slack`, `slack-webhook`, `stripe`, `stripe-webhook`, `sendgrid`, `twilio`, `google`, `google-oauth`, `supabase-pat`, `supabase-secret`, `posthog`, `xai`, `groq`, `replicate`, `perplexity`, `huggingface`, `npm`, `pypi`, `linear`, `notion`, `resend`, `shopify`, `databricks`, `sentry`, `discord-bot`, `discord-webhook`, `telegram`, `mailgun`, `mailchimp`, `doppler`, `digitalocean`, `mapbox`, `fireworks`, `figma`, `atlassian`, `square`, `age`.

**By structure:**
- `private-key`: a PEM block;
- `private-key-partial`: a PEM block cut off before its END line;
- `jwt`;
- `url-credentials`: a URL with a real password. Local defaults like `postgres:postgres@` are left alone.
- `auth-header`: an `Authorization: Bearer …` value;
- `api-key-header`: an `x-api-key: …` value.

**`assignment`:** a value assigned to a name that says it's secret (`*_API_KEY`, `*_SECRET`, `*_TOKEN`, `PASSWORD`, …). It has no prefix to go on, so the value must also look generated:
- a letter and a digit;
- 12 or more characters, or 8 or more mixing upper and lower case;
- at least 3 bits of entropy per character;
- not mostly made of words (that's a name, like `EthereumWeb3Credentials`);
- not a reference or a sample (`$VAR`, `process.env.X`, `changeme`, `your-api-key`, `test`, …);
- unquoted, no code punctuation (that's minified JavaScript).

**False positives.** A sweep of 154,425 files (1.07 GB: a `node_modules` tree, a large TypeScript codebase, an archived app with its dependencies) gave these results:
- **The provider rules:** no hits on ordinary code.
- **All the rules together:** 23 hits, and every one is a credential-shaped test fixture or a documentation example: sample PEM keys, JWT test vectors, UUID access tokens in fixtures. Hiding those costs nothing, since an `Edit` still restores them.

## What it can reach

    ❯ ./register.ts hooks: session.start, prompt.submit, session.append, tool.call{tool=Edit}, tool.call{tool=Write}, tool.call{tool=NotebookEdit}, tool.call{tool=Bash}, prompt.section{name=env_info_simple}, command.run{command=secrets}
    ❯ ./register.ts calls: $.command.register, $.env.set (via setSlot), $.process.run (via ensure, runner), $.session.cwd (via ensure), $.state.get, $.state.set, $.store.get (via getIndex), $.store.set, $.ui.invalidate, $.ui.log
    ❯ ./register.ts env writes: SECRET_KEEPER_1, SECRET_KEEPER_10, SECRET_KEEPER_11, SECRET_KEEPER_12, SECRET_KEEPER_13, SECRET_KEEPER_14, SECRET_KEEPER_15, SECRET_KEEPER_16, SECRET_KEEPER_2, SECRET_KEEPER_3, SECRET_KEEPER_4, SECRET_KEEPER_5, SECRET_KEEPER_6, SECRET_KEEPER_7, SECRET_KEEPER_8, SECRET_KEEPER_9
    ❯ ./register.ts env reads: nothing
    ❯ ./register.ts state writes: secret-keeper.exported, secret-keeper.project, secret-keeper.vault
    ❯ ./register.ts state reads: secret-keeper.exported, secret-keeper.project, secret-keeper.vault

It runs two local programs and makes no network calls:
- `git rev-parse --show-toplevel`, once per session, to find the project;
- `/usr/bin/security`, to add, find and delete its own Keychain items.

`$.store` holds an index of names, scopes and dates, never values.

## Limits

- **It doesn't stop a value leaving the machine.** Bash has your stored secrets in its environment, so an instruction hidden in a page or file Claude reads could have it send one out (`curl … -d "$OPENAI_API_KEY"`). Turn on `/sandbox` with a network allowlist; that's what stops the send. Keeping secrets per project limits how many one session holds.
- **During a Bash call, what Claude Code starts inherits the slot variables.** That's the command itself, the settings hooks that run for it, and anything else started in that window. Between calls they're unset. A hook that logs commands sees only the `export NAME="$SECRET_KEEPER_n"` prefix.
- **16 secrets per project at most reach Bash.** They're taken in name order, and the rest are left out with one log line.
- **Hooks on `Edit`, `Write` and `NotebookEdit` see restored values**, because the value has to reach the tool for the file to get it.
- **Other programs running as you can read the items.** The items trust `/usr/bin/security`, so any script you run can read them without a prompt, the same as your `.env` files. Claude's shell is refused any command that names the service.
- **macOS only for storage.** Elsewhere, saving fails with one log line and pasted secrets last the session.
- **A secret with no known shape and no secret-sounding name** stays visible: a bare 40-character token pasted on its own, for example. Paste it as `NAME=value` and the name carries it. When Claude does see one in plain text, the note tells it to say so once.
- **The model's own tool-call blocks aren't rewritable**, and neither are the tool records the engine keeps beside the conversation. A `Write` record keeps the file as written, with the value in it.
- **A slash command's arguments** aren't scanned (`prompt.submit` doesn't rewrite commands). Paste keys as a normal message.
- **Single quotes.** `[secret:NAME]` inside single quotes in a shell command stays literal, as `$NAME` would.
- **Images aren't scanned.**

## Uninstall

Run `/secrets rm all`, then disable it in `/plugin`. Disabling it alone leaves the items in your login Keychain under the service `claude-secret-keeper`.
