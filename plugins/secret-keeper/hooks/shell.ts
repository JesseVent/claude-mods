// How a Bash command gets the secrets: exported as env vars ahead of it, so the command itself only names them.

export const TOKEN = /\[(secret:[A-Z_][A-Z0-9_]*|pii:[A-Z_]+#\d+)\]/g

/** Single-quoted for the shell: nothing inside expands, a quote is closed, escaped and reopened. */
export const quote = (v: string) => `'${v.replaceAll("'", `'\\''`)}'`

/** `export A='…' B='…'; <command>`, or the command untouched when there is nothing to export. */
export function withEnv(command: string, env: Readonly<Record<string, string>>): string {
  const pairs = Object.entries(env)
  if (pairs.length === 0) return command
  return `export ${pairs.map(([k, v]) => `${k}=${quote(v)}`).join(' ')}; ${command}`
}

/**
 * `[secret:NAME]` written into a command becomes `"${NAME}"`.
 * ponytail: inside single quotes that reads as literal text; the note tells Claude to write $NAME, which has the same limit.
 */
export const refsToVars = (command: string) => command.replace(/\[secret:([A-Z_][A-Z0-9_]*)\]/g, '"${$1}"')

/** The placeholders a piece of text carries, as `secret:NAME` / `pii:LABEL#n` keys. */
export const tokensIn = (text: string) => [...text.matchAll(TOKEN)].map(m => m[1]!)
