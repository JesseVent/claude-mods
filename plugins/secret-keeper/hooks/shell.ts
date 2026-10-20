// How a Bash command gets the secrets: through the environment, never its text. Hooks beneath a mod and the
// permission check see the command as rewritten, and a hook may log it; the text only names slot variables.

export const TOKEN = /\[(secret:[A-Z_][A-Z0-9_]*|pii:[A-Z_]+#\d+)\]/g

/** How many secrets one command can get: `$.env.set` takes literal names, so the slots are spelled out. */
export const SLOTS = 16

/** `export A="$SECRET_KEEPER_1" B="$SECRET_KEEPER_2"; `: plain exports of references, which permission rules accept. */
export const prefixFor = (names: readonly string[]) =>
  names.length ? `export ${names.map((n, i) => `${n}="$SECRET_KEEPER_${i + 1}"`).join(' ')}; ` : ''

/**
 * `[secret:NAME]` written into a command becomes `"${NAME}"`.
 * ponytail: inside single quotes that reads as literal text; the note tells Claude to write $NAME, which has the same limit.
 */
export const refsToVars = (command: string) => command.replace(/\[secret:([A-Z_][A-Z0-9_]*)\]/g, '"${$1}"')

/** The placeholders a piece of text carries, as `secret:NAME` / `pii:LABEL#n` keys. */
export const tokensIn = (text: string) => [...text.matchAll(TOKEN)].map(m => m[1]!)
