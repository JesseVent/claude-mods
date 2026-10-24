import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import { servers } from '../hooks/register'

type Check = { decision: 'allow' | 'ask' | 'deny'; reason?: string }

/**
 * The engine beneath the mod: a session whose project root is `w.root`, a store and a file system kept in memory,
 * an engine that allows every tool call, and servers that answer `mcp.connect` as needing sign-in.
 */
function world(on: On) {
  const w = { root: '/work/app', store: new Map<string, unknown>(), files: new Map<string, string>(), reloads: 0, status: undefined as string | undefined, clock: mock.clock(on) }
  on('session.root', () => ({ value: w.root }))
  on('store.get', ($, e) => ({ value: w.store.get(e.key) }))
  on('store.set', ($, e) => (w.store.set(e.key, e.value), { value: undefined }))
  on('fs.read', ($, e) => (w.files.has(e.path) ? { value: w.files.get(e.path)! } : { deny: 'ENOENT' }))
  on('fs.write', ($, e) => (w.files.set(e.path, e.text), { value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.run', ($, e) => (e.command === 'reload-plugins' && w.reloads++, { text: '' }))
  on('mcp.connect', ($, e) => ({ value: { isConnected: false as const, reason: 'auth' as const, message: `${e.server} needs sign-in` } }))
  on('ui.status', ($, e) => ((w.status = e.text), { value: undefined }))
  on('ui.log', () => ({ value: undefined }))
  on('tool.check', () => ({ decision: 'allow' as const }))
  on('prompt.section', ($, e) => ({ text: e.text }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return w
}

const account = ($: { command: { run: unknown } }, args: string) =>
  ($.command.run as (a: unknown) => Promise<{ text: string }>)({ command: 'account', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }).then(r => r.text)
const check = ($: { tool: { check: unknown } }, tool: string) => ($.tool.check as (e: unknown) => Promise<Check>)({ tool, input: {}, tool_use_id: 'u1' })
const start = ($: { session: { start: unknown } }) => ($.session.start as (e: unknown) => Promise<unknown>)({ cwd: '/work/app', surface: null, isInteractive: true })
const written = (w: { files: Map<string, string> }) => {
  const [path, text] = [...w.files].find(([p]) => p.endsWith('/accounts.mcp.json'))!
  return { path, servers: (JSON.parse(text) as { mcpServers: Record<string, { url: string; oauth?: unknown }> }).mcpServers }
}

const tool = (server: string, name = 'slack_send_message') => `mcp__plugin_mcp-accounts_${server}__${name}`

describe('adding accounts', () => {
  test('each account is its own server, its URL tagged with the account, loaded by /reload-plugins', async ($, on) => {
    const w = world(on)
    await account($, 'add slack acme')
    expect(await account($, 'add slack foo')).toContain('Run /reload-plugins to load it, then sign it in: /mcp → plugin:mcp-accounts:slack-foo → Authenticate')
    await w.clock.settle()
    const { servers: s } = written(w)
    expect(Object.keys(s)).toEqual(['slack-acme', 'slack-foo'])
    expect(s['slack-acme']).toMatchObject({ url: 'https://mcp.slack.com/mcp?account=acme', oauth: { callbackPort: 3118 } })
    expect(w.reloads).toBe(0)
  })

  test('a new service needs an https URL with its first account, and names are checked', async ($, on) => {
    const w = world(on)
    expect(await account($, 'add linear work')).toContain('give its MCP server')
    expect(await account($, 'add linear work http://mcp.linear.app/mcp')).toContain('https')
    expect(await account($, 'add slack Bad_Name')).toContain("isn't one")
    expect(await account($, 'add add x')).toContain("isn't one")
    await account($, 'add linear work https://mcp.linear.app/mcp')
    await account($, 'add linear home')
    expect(written(w).servers['linear-home']!.url).toBe('https://mcp.linear.app/mcp?account=home')
    expect(await account($, 'add linear x https://elsewhere.example/mcp')).toContain('already points at')
  })

  test('removing an account drops its server', async ($, on) => {
    const w = world(on)
    await account($, 'add slack acme')
    await account($, 'add slack foo')
    await account($, 'remove slack acme')
    expect(Object.keys(written(w).servers)).toEqual(['slack-foo'])
    expect(await account($, 'remove slack nope')).toContain("There's no slack account")
    await account($, 'add linear work https://mcp.linear.app/mcp')
    await account($, 'remove linear work')
    expect(await account($, 'add linear work')).toContain('give its MCP server')
  })

  test('a start rebuilds a missing server list once, and one with nothing changed reloads nothing', async ($, on) => {
    const w = world(on)
    await start($)
    await w.clock.settle()
    expect(w.files.get(written(w).path)).toBe('{\n  "mcpServers": {}\n}\n')
    await start($)
    await w.clock.settle()
    expect(w.reloads).toBe(1)
  })
})

describe('the gate', () => {
  test("an only account is in use; with two, nothing goes through until one is picked, then only it", async ($, on) => {
    const w = world(on)
    await account($, 'add slack acme')
    expect((await check($, tool('slack-acme'))).decision).toBe('allow')
    await account($, 'add slack foo')
    expect(await check($, tool('slack-acme'))).toMatchObject({ decision: 'deny', reason: expect.stringContaining('No slack account is chosen') })
    expect(await account($, 'slack foo')).toBe('slack → foo in /work/app.')
    expect((await check($, tool('slack-foo'))).decision).toBe('allow')
    expect(await check($, tool('slack-acme'))).toMatchObject({ decision: 'deny', reason: expect.stringContaining('/account slack acme') })
    expect(w.status).toBe('slack:foo')
  })

  test('the choice is per project', async ($, on) => {
    const w = world(on)
    await account($, 'add slack acme')
    await account($, 'add slack foo')
    await account($, 'slack acme')
    w.root = '/work/other'
    expect((await check($, tool('slack-acme'))).decision).toBe('deny')
    w.root = '/work/app'
    expect((await check($, tool('slack-acme'))).decision).toBe('allow')
  })

  test('signing in any account, and every other tool, is left to the engine', async ($, on) => {
    world(on)
    await account($, 'add slack acme')
    await account($, 'add slack foo')
    expect((await check($, tool('slack-acme', 'authenticate'))).decision).toBe('allow')
    expect((await check($, 'Bash')).decision).toBe('allow')
    expect((await check($, 'mcp__plugin_slack_slack__slack_send_message')).decision).toBe('allow')
  })
})

describe('telling Claude and the person', () => {
  test('the prompt names the account in use, or says none is chosen', async ($, on) => {
    world(on)
    await account($, 'add slack acme')
    const one = await $.prompt.section({ name: 'env_info_simple', text: 'Working directory: /work/app' })
    expect(one.text).toContain('slack uses its acme account in this project: the mcp__plugin_mcp-accounts_slack-acme__* tools.')
    await account($, 'add slack foo')
    const two = await $.prompt.section({ name: 'env_info_simple', text: 'Working directory: /work/app' })
    expect(two.text).toContain('slack has several accounts (acme, foo) and none is chosen')
  })

  test('/account lists each account, which is in use, and how to sign it in', async ($, on) => {
    world(on)
    expect(await account($, '')).toContain('No accounts yet.')
    await account($, 'add supabase personal')
    const out = await account($, '')
    expect(out).toContain('* supabase · personal   sign in: /mcp → plugin:mcp-accounts:supabase-personal → Authenticate')
    expect(await account($, 'supabase')).toContain('supabase: personal.')
  })

  test('servers joins the account onto a URL that already has a query', () => {
    expect(servers({ x: ['a'] }, { x: { url: 'https://h/mcp?read_only=true' } }).mcpServers).toEqual({ 'x-a': { type: 'http', url: 'https://h/mcp?read_only=true&account=a' } })
  })
})
