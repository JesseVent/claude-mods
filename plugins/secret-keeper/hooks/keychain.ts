// The login Keychain through /usr/bin/security. Values travel on stdin as hex, never in argv, and hex needs no quoting in `security -i`.
import type { EngineInterface } from 'claude-code'

export const SERVICE = 'claude-secret-keeper'

type Run = EngineInterface['process']['run']

export const toHex = (s: string) => [...new TextEncoder().encode(s)].map(b => b.toString(16).padStart(2, '0')).join('')

export function fromHex(h: string): string | undefined {
  if (!/^(?:[0-9a-f]{2})+$/.test(h)) return undefined
  return new TextDecoder().decode(Uint8Array.from(h.match(/../g)!, b => parseInt(b, 16)))
}

/** `<scope>:<NAME>`, where scope is `global` or a hash of the project root: no spaces, so `security -i` reads it as one word. */
export const account = (scope: string, name: string) => `${scope}:${name}`

export async function save(run: Run, acct: string, value: string): Promise<void> {
  const r = await run(['security', '-i'], {
    stdin: `add-generic-password -U -s ${SERVICE} -a ${acct} -l ${SERVICE} -w ${toHex(value)}\n`,
    timeoutMs: 10_000,
  })
  if (r.exitCode !== 0 || r.stderr.trim()) throw new Error(r.stderr.trim() || `security exited ${r.exitCode}`)
}

export async function load(run: Run, acct: string): Promise<string | undefined> {
  const r = await run(['security', 'find-generic-password', '-s', SERVICE, '-a', acct, '-w'], { timeoutMs: 10_000 })
  return r.exitCode === 0 ? fromHex(r.stdout.trim()) : undefined
}

export async function remove(run: Run, acct: string): Promise<boolean> {
  const r = await run(['security', 'delete-generic-password', '-s', SERVICE, '-a', acct], { timeoutMs: 10_000 })
  return r.exitCode === 0
}
