// What env var a secret is kept under: the name it was pasted with, else its provider's usual one.

/** `apiKey`, `api-key`, `db.password` → `API_KEY`, `API_KEY`, `DB_PASSWORD`. */
export function envName(raw: string): string {
  const snake = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
  return /^[A-Z_]/.test(snake) ? snake : `_${snake}`
}

// `NAME=`, `export NAME=`, `NAME: `, `"NAME": "`, `$env:NAME = '` right before the value, on the same line.
const BEFORE = /(?:^|[^A-Za-z0-9_.-])(?:export\s{1,4}|set\s{1,4}|\$env:)?["']?([A-Za-z_][A-Za-z0-9_]{0,80})["']?\s{0,4}(?::=|=>|:|=)\s{0,4}["'`]?$/

/** The env-style (UPPER_SNAKE) name assigned the value starting at `at`, if the text gives one. */
export function nameBefore(text: string, at: number): string | undefined {
  const from = Math.max(text.lastIndexOf('\n', at - 1) + 1, at - 160)
  const raw = BEFORE.exec(text.slice(from, at))?.[1]
  return raw && /^[A-Z][A-Z0-9_]*$/.test(raw) ? raw : undefined
}
