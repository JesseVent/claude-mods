import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import { fromHex, SERVICE, toHex } from '../hooks/keychain'
import { quote, refsToVars, withEnv } from '../hooks/shell'
import { chars, ALNUM, join, PROVIDER_FAKES } from './fakes'

const submit = ($: { prompt: { submit: unknown } }, text: string) => ($.prompt.submit as (e: { text: string }) => Promise<{ text: string }>)({ text })
type Call = { tool: 'Bash'; command: string } | { tool: 'Write'; file_path: string; content: string } | { tool: 'Edit'; file_path: string; old_string: string; new_string: string }
const call = ($: { tool: { call: unknown } }, e: Call) => ($.tool.call as (e: Call) => Promise<{ deny?: string; result?: { stdout?: string } }>)(e)

const ROOT = '/work/app'
const ok = (stdout = '') => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
const fail = () => ({ value: { exitCode: 44, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

/** The world beneath the mod: a git repo at ROOT, a Keychain in memory, tools that echo what they got. */
function world(on: On, store: Record<string, unknown> = {}, items = new Map<string, string>()) {
  const argvs: string[][] = []
  const ran: string[] = []
  const written: string[] = []
  mock.store(on, store)
  on('session.cwd', () => ({ value: `${ROOT}/src` }))
  on('process.run', ($, e) => {
    argvs.push([...e.argv])
    const [bin, sub] = e.argv
    if (bin === 'git') return ok(`${ROOT}\n`)
    if (bin !== 'security') return fail()
    if (sub === '-i') {
      const m = /^add-generic-password -U -s (\S+) -a (\S+) -l \S+ -w ([0-9a-f]+)\n$/.exec(e.init?.stdin ?? '')
      if (!m || m[1] !== SERVICE) return fail()
      items.set(m[2]!, m[3]!)
      return ok()
    }
    const acct = e.argv[e.argv.indexOf('-a') + 1]!
    if (sub === 'find-generic-password') return items.has(acct) ? ok(`${items.get(acct)}\n`) : fail()
    if (sub === 'delete-generic-password') return items.delete(acct) ? ok() : fail()
    return fail()
  })
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('prompt.section', ($, e) => ({ text: e.text }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', { tool: 'Bash' }, ($, e) => (ran.push(e.command), { result: { stdout: 'ok', stderr: '', interrupted: false } }))
  on('tool.call', { tool: 'Write' }, ($, e) => (written.push(e.content), { result: { type: 'create', filePath: e.file_path, content: e.content, structuredPatch: [] } }))
  on('tool.call', { tool: 'Edit' }, ($, e) => (written.push(`${e.old_string}=>${e.new_string}`), { result: { filePath: e.file_path, oldString: e.old_string, newString: e.new_string, originalFile: '', structuredPatch: [], userModified: false, replaceAll: false } }))
  return { argvs, ran, written, items }
}

const append = ($: { session: { append: unknown } }, text: string) =>
  ($.session.append as (a: unknown) => Promise<{ message: { content: Array<{ type: string; content?: string; text?: string }> } }>)({
    message: { type: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: text }] },
  }).then(r => r.message.content[0]!.content ?? r.message.content[0]!.text)

const secrets = ($: { command: { run: unknown } }, args = '') =>
  ($.command.run as (a: unknown) => Promise<{ text: string }>)({ command: 'secrets', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }).then(r => r.text)

describe('pasting', () => {
  test('a pasted key is hidden, stored for this project through stdin, and exported to Bash', async ($, on) => {
    const w = world(on)
    const key = PROVIDER_FAKES.elevenlabs!()
    const r = await submit($, `here: ELEVENLABS_API_KEY=${key} use it`)
    expect(r.text).toBe('here: ELEVENLABS_API_KEY=[secret:ELEVENLABS_API_KEY] use it')
    expect(w.argvs.filter(a => a[0] === 'security')).toEqual([['security', '-i']])
    expect(w.argvs.flat().join(' ')).not.toContain(key)
    expect([...w.items.values()].map(fromHex)).toEqual([key])

    await call($, { tool: 'Bash', command: 'bun run tts.ts' })
    expect(w.ran).toEqual([`export ELEVENLABS_API_KEY=${quote(key)}; bun run tts.ts`])
  })

  test('the note says pasting is expected and lists what Bash has', async ($, on) => {
    world(on)
    await submit($, `GITHUB_TOKEN=${PROVIDER_FAKES.github!()}`)
    const { text } = await $.prompt.section({ name: 'env_info_simple', text: 'Working directory: /work/app' })
    expect(text).toMatch(/^Working directory: \/work\/app\n\nSecret handling \(secret-keeper\)/)
    expect(text).toMatch(/do not warn them/)
    expect(text).toMatch(/Available in Bash: GITHUB_TOKEN\./)
  })

  test('pasting a new value under the same name replaces it (rotation)', async ($, on) => {
    const w = world(on)
    const [a, b] = [PROVIDER_FAKES.openrouter!(), PROVIDER_FAKES.openrouter!()]
    await submit($, `OPENROUTER_API_KEY=${a}`)
    const r = await submit($, `new one OPENROUTER_API_KEY=${b}`)
    expect(r.text).toBe('new one OPENROUTER_API_KEY=[secret:OPENROUTER_API_KEY]')
    expect([...w.items.values()].map(fromHex)).toEqual([b])
  })

  test('keychain off keeps it for the session, with no process call', { options: { keychain: false } }, async ($, on) => {
    const w = world(on)
    await submit($, PROVIDER_FAKES.groq!())
    expect(w.argvs.filter(a => a[0] === 'security')).toEqual([])
    await call($, { tool: 'Bash', command: 'env' })
    expect(w.ran[0]).toMatch(/^export GROQ_API_KEY='gsk_/)
  })
})

describe('later sessions', () => {
  test("a stored key loads in a fresh session, this project's over a global one of the same name", async ($, on) => {
    const local = PROVIDER_FAKES.github!()
    const global = PROVIDER_FAKES.github!()
    const other = PROVIDER_FAKES.npm!()
    const items = new Map([
      ['proj:GITHUB_TOKEN', toHex(local)],
      ['global:GITHUB_TOKEN', toHex(global)],
      ['elsewhere:NPM_TOKEN', toHex(other)],
    ])
    const w = world(
      on,
      {
        index: {
          'proj:GITHUB_TOKEN': { name: 'GITHUB_TOKEN', scope: ROOT, saved: '2026-10-20' },
          'global:GITHUB_TOKEN': { name: 'GITHUB_TOKEN', scope: 'global', saved: '2026-10-01' },
          'elsewhere:NPM_TOKEN': { name: 'NPM_TOKEN', scope: '/work/other', saved: '2026-10-02' },
        },
      },
      items,
    )
    await call($, { tool: 'Bash', command: 'gh auth status' })
    expect(w.ran).toEqual([`export GITHUB_TOKEN=${quote(local)}; gh auth status`])
    expect(await secrets($)).toBe(['Stored in the Keychain:', '  GITHUB_TOKEN  this project  2026-10-20', '  GITHUB_TOKEN  global  2026-10-01', '1 more stored for other projects.'].join('\n'))
  })

  test('/secrets rm, global and local move items between accounts', async ($, on) => {
    const w = world(on)
    const key = PROVIDER_FAKES.linear!()
    await submit($, `LINEAR_API_KEY=${key}`)
    expect(await secrets($, 'global LINEAR_API_KEY')).toBe("LINEAR_API_KEY is now global: every project's sessions export it.")
    expect([...w.items.keys()]).toEqual(['global:LINEAR_API_KEY'])
    expect(await secrets($, 'local LINEAR_API_KEY')).toBe('LINEAR_API_KEY now belongs to this project only.')
    expect([...w.items.keys()]).toHaveLength(1)
    expect([...w.items.keys()][0]).not.toBe('global:LINEAR_API_KEY')
    expect(await secrets($, 'rm LINEAR_API_KEY')).toBe('Removed LINEAR_API_KEY (this project) from the Keychain.')
    expect(w.items.size).toBe(0)
    await call($, { tool: 'Bash', command: 'true' })
    expect(w.ran).toEqual(['true'])
  })

  test('/secrets rm all empties the Keychain everywhere', async ($, on) => {
    const items = new Map([['a:X_TOKEN', toHex('one-value-123')], ['global:Y_TOKEN', toHex('two-value-456')]])
    const w = world(on, { index: { 'a:X_TOKEN': { name: 'X_TOKEN', scope: '/elsewhere', saved: '2026-10-20' }, 'global:Y_TOKEN': { name: 'Y_TOKEN', scope: 'global', saved: '2026-10-20' } } }, items)
    expect(await secrets($, 'rm all')).toBe('Removed 2 stored secrets from the Keychain, every project.')
    expect(w.items.size).toBe(0)
  })
})

describe('what Claude reads', () => {
  test('a stored value in output is hidden again, raw, base64 or hex', async ($, on) => {
    world(on)
    const key = PROVIDER_FAKES.anthropic!()
    await submit($, key)
    const b64 = btoa(key)
    expect(await append($, `> x-api-key: ${key}\n${b64}\n${toHex(key)}`)).toBe('> x-api-key: [secret:ANTHROPIC_API_KEY]\n[secret:ANTHROPIC_API_KEY]\n[secret:ANTHROPIC_API_KEY]')
  })

  test('a key read from a file is hidden and usable in Edit, but not exported or stored', async ($, on) => {
    const w = world(on)
    const key = PROVIDER_FAKES.stripe!()
    expect(await append($, `STRIPE_SECRET_KEY=${key}\nOTHER=1`)).toBe('STRIPE_SECRET_KEY=[secret:STRIPE_SECRET_KEY]\nOTHER=1')
    expect(w.items.size).toBe(0)

    await call($, { tool: 'Edit', file_path: '/work/app/.env', old_string: 'STRIPE_SECRET_KEY=[secret:STRIPE_SECRET_KEY]', new_string: 'STRIPE_KEY=[secret:STRIPE_SECRET_KEY]' })
    expect(w.written).toEqual([`STRIPE_SECRET_KEY=${key}=>STRIPE_KEY=${key}`])

    const r = await call($, { tool: 'Bash', command: 'curl -u [secret:STRIPE_SECRET_KEY]: https://api.stripe.com' })
    expect(r.deny).toMatch(/not available in the shell/)
    expect(w.ran).toEqual([])
  })

  test('a different value under a name already taken gets a suffix', async ($, on) => {
    world(on)
    const [a, b] = [PROVIDER_FAKES.npm!(), PROVIDER_FAKES.npm!()]
    expect(await append($, `${a} ${b} ${a}`)).toBe('[secret:NPM_TOKEN] [secret:NPM_TOKEN_2] [secret:NPM_TOKEN]')
  })

  test('PII is hidden only with the option on, numbered per value', { options: { pii: true } }, async ($, on) => {
    world(on)
    expect(await append($, 'a@b.io wrote to c@d.io, cc a@b.io')).toBe('[pii:EMAIL#1] wrote to [pii:EMAIL#2], cc [pii:EMAIL#1]')
    const r = await call($, { tool: 'Bash', command: 'mail [pii:EMAIL#1]' })
    expect(r.deny).toMatch(/keep personal data out of commands/)
  })
})

describe('tools', () => {
  test('Write puts the real value in the file; an unknown placeholder is refused', async ($, on) => {
    const w = world(on)
    const key = PROVIDER_FAKES.resend!()
    await submit($, `RESEND_API_KEY=${key}`)
    await call($, { tool: 'Write', file_path: '/work/app/.env', content: 'RESEND_API_KEY=[secret:RESEND_API_KEY]\n' })
    expect(w.written).toEqual([`RESEND_API_KEY=${key}\n`])
    const r = await call($, { tool: 'Write', file_path: '/work/app/.env', content: '[secret:NOT_HERE]' })
    expect(r.deny).toMatch(/\[secret:NOT_HERE\] is not a value this session holds/)
  })

  test('Bash: a placeholder becomes a variable reference; the Keychain service is off limits', async ($, on) => {
    const w = world(on)
    const key = PROVIDER_FAKES.huggingface!()
    await submit($, `HF_TOKEN=${key}`)
    await call($, { tool: 'Bash', command: 'echo [secret:HF_TOKEN] | wc -c' })
    expect(w.ran).toEqual([`export HF_TOKEN=${quote(key)}; echo "\${HF_TOKEN}" | wc -c`])
    const r = await call($, { tool: 'Bash', command: `security find-generic-password -s ${SERVICE} -w` })
    expect(r.deny).toMatch(/read by secret-keeper alone/)
  })
})

describe('shell helpers', () => {
  test('quoting survives quotes, dollars, backslashes and newlines', () => {
    expect(quote(`a'b`)).toBe(`'a'\\''b'`)
    expect(quote('$HOME `x` \\n\nend')).toBe("'$HOME `x` \\n\nend'")
    expect(withEnv('ls', {})).toBe('ls')
    expect(withEnv('ls', { A: 'x', B: "y'z" })).toBe(`export A='x' B='y'\\''z'; ls`)
    expect(refsToVars('a [secret:X_1] b')).toBe('a "${X_1}" b')
  })

  test('hex round-trips any text', () => {
    const v = join(chars(ALNUM, 10), " é ' \" $ \n ✓")
    expect(fromHex(toHex(v))).toBe(v)
    expect(fromHex('zz')).toBeUndefined()
  })
})
