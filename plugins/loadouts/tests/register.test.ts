import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import { parse, servers } from '../hooks/register'

type Check = { decision: 'allow' | 'ask' | 'deny'; reason?: string }

const SUPABASE = {
  name: 'supabase',
  skills: ['supabase:supabase', 'supabase:supabase-postgres-best-practices'],
  mcpServers: { supabase: { type: 'http', url: 'https://mcp.supabase.com/mcp' } },
  instructions: 'Run SQL through execute_sql.',
}
const NEXTJS = {
  name: 'nextjs',
  skills: ['nextjs-best-practices'],
  mcpServers: { 'next-devtools': { command: 'bunx', args: ['next-devtools-mcp@latest'] } },
  instructions: 'Prefer Server Components.',
}
const EXAMPLES = { 'loadouts/supabase.json': SUPABASE, 'loadouts/nextjs.json': NEXTJS }

/**
 * The engine beneath the mod: a session whose project root is `w.root`, a store kept in memory, the mod's files kept
 * in memory by their path under the mod (`loadouts/nextjs.json`), and an engine that allows every tool call.
 */
function world(on: On, files: Record<string, unknown> = EXAMPLES) {
  const w = {
    root: '/work/app',
    store: new Map<string, unknown>(),
    files: new Map(Object.entries(files).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])),
    closed: [] as string[],
    logs: [] as string[],
    invalidated: [] as string[],
    reloads: 0,
    status: undefined as string | undefined,
    clock: mock.clock(on),
  }
  const at = (path: string) => [...w.files.keys()].find(k => path.endsWith(`/${k}`))
  on('fs.list', () => ({ value: [...w.files.keys()].filter(k => k.startsWith('loadouts/')).map(k => ({ name: k.slice(9), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  on('fs.read', ($, e) => {
    const k = at(e.path)
    return k ? { value: w.files.get(k)! } : { deny: 'ENOENT' }
  })
  on('fs.write', ($, e) => (w.files.set(e.path.slice(e.path.lastIndexOf('/') + 1), e.text), { value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', ($, e) => (w.closed.push(e.id), { value: undefined }))
  on('ui.invalidate', ($, e) => (w.invalidated.push(e.event), { value: undefined }))
  on('ui.status', ($, e) => ((w.status = e.text), { value: undefined }))
  on('ui.log', ($, e) => (w.logs.push(e.text), { value: undefined }))
  on('session.root', () => ({ value: w.root }))
  on('store.get', ($, e) => ({ value: w.store.get(e.key) }))
  on('store.set', ($, e) => (w.store.set(e.key, e.value), { value: undefined }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('tool.register', ($, e) => ({ value: { tool: `mcp__loadouts__${e.name}` } }))
  on('command.run', ($, e) => (e.command === 'reload-plugins' && w.reloads++, { text: '' }))
  on('tool.check', () => ({ decision: 'allow' as const }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('prompt.attachment', ($, e) => ({ text: e.text }))
  on('prompt.section', ($, e) => ({ text: e.text }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  return w
}

const loadout = ($: { command: { run: unknown } }, args = '') =>
  ($.command.run as (a: unknown) => Promise<{ text: string }>)({ command: 'loadout', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }).then(r => r.text)
const check = ($: { tool: { check: unknown } }, tool: string, input: unknown = {}) => ($.tool.check as (e: unknown) => Promise<Check>)({ tool, input, tool_use_id: 'u1' })
const start = ($: { session: { start: unknown } }) => ($.session.start as (e: unknown) => Promise<unknown>)({ cwd: '/work/app', surface: null, isInteractive: true })
const skill = ($: { skill: { prompt: unknown } }, name: string) =>
  ($.skill.prompt as (e: unknown) => Promise<{ text: string }>)({ skill: name, text: `${name} body`, frontmatter: {}, source: 'plugin' }).then(r => r.text)
const listing = ($: { prompt: { attachment: unknown } }, text: string) =>
  ($.prompt.attachment as (e: unknown) => Promise<{ text: string | null }>)({ type: 'skill_listing', text, origin: { kind: 'engine' } }).then(r => r.text)
const prompt = ($: { prompt: { section: unknown } }) =>
  ($.prompt.section as (e: unknown) => Promise<{ text: string }>)({ name: 'env_info_simple', text: 'Working directory: /work/app' }).then(r => r.text)
const written = (w: { files: Map<string, string> }) => (JSON.parse(w.files.get('loadouts.mcp.json') ?? '{}') as { mcpServers?: Record<string, unknown> }).mcpServers

const tool = (server: string, name = 'list_tables') => `mcp__plugin_loadouts_${server}__${name}`
const LISTING = ['- supabase:supabase: Supabase work', '- supabase:supabase-postgres-best-practices', '- nextjs-best-practices: Next.js standards', '- commit: Writes a commit'].join('\n')

const PANE = {
  plugin: 'loadouts',
  component: 'Pane',
  requestId: 'loadouts',
  props: { title: 'Loadouts', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

describe('loading the loadout files', () => {
  test('every good file is a loadout; a bad one is skipped with why, and the rest still load', async ($, on) => {
    const w = world(on, { ...EXAMPLES, 'loadouts/broken.json': '{ "name": ', 'loadouts/caps.json': { name: 'Big Name' }, 'loadouts/notes.txt': 'not a loadout' })
    await start($)
    expect(w.logs).toEqual(["skipped broken.json isn't JSON", 'skipped caps.json: "name" is up to 30 lowercase letters, digits and dashes'])
    const out = await loadout($)
    expect(out).toContain('nextjs   skills: nextjs-best-practices · servers: next-devtools')
    expect(out).toContain('supabase   skills: supabase:supabase, supabase:supabase-postgres-best-practices · servers: supabase')
    expect(out).toContain("Skipped broken.json isn't JSON.")
    expect(out).not.toContain('notes')
  })

  test('the start writes every loadout\'s servers to the manifest\'s list and reloads once; unchanged, it reloads nothing', async ($, on) => {
    const w = world(on)
    await start($)
    await w.clock.settle()
    expect(written(w)).toEqual({ 'next-devtools': NEXTJS.mcpServers['next-devtools'], supabase: SUPABASE.mcpServers.supabase })
    expect(w.reloads).toBe(1)
    await start($)
    await w.clock.settle()
    expect(w.reloads).toBe(1)
  })

  test('parse holds names, skills and servers to their shapes', () => {
    expect(parse('a.json', JSON.stringify({ name: 'a' }))).toEqual({ name: 'a', skills: [], mcpServers: {}, instructions: '' })
    expect(parse('a.json', JSON.stringify({ name: 'a', skills: 'x' }))).toContain('"skills" is a list')
    expect(parse('a.json', JSON.stringify({ name: 'a', mcpServers: [] }))).toContain('"mcpServers" is an object')
    expect(parse('a.json', JSON.stringify({ name: 'a', mcpServers: { My_Server: {} } }))).toContain('server "My_Server"')
    expect(parse('a.json', JSON.stringify({ name: 'a', instructions: ['x'] }))).toContain('"instructions" is a string')
    expect(parse('a.json', 'null')).toContain('"name"')
  })

  test('two loadouts share a server only when they define it the same; a clash or a taken name skips the later file', async ($, on) => {
    const w = world(on, {
      'loadouts/a.json': { name: 'a', mcpServers: { docs: { type: 'http', url: 'https://docs.example/mcp' } } },
      'loadouts/b.json': { name: 'b', mcpServers: { docs: { type: 'http', url: 'https://docs.example/mcp' } } },
      'loadouts/c.json': { name: 'c', mcpServers: { docs: { type: 'http', url: 'https://other.example/mcp' } } },
      'loadouts/d.json': { name: 'a' },
    })
    await start($)
    expect(w.logs).toEqual(['skipped c.json: server "docs" is defined differently by another loadout', 'skipped d.json: the name a is taken by another file'])
    expect(written(w)).toEqual({ docs: { type: 'http', url: 'https://docs.example/mcp' } })
    expect(servers([{ name: 'x', skills: [], instructions: '', mcpServers: { s: { url: 'u' } } }])).toEqual({ mcpServers: { s: { url: 'u' } } })
  })
})

describe('equipping and switching', () => {
  test('with nothing equipped every loadout server and skill is off', async ($, on) => {
    world(on)
    await start($)
    expect(await check($, tool('supabase'))).toMatchObject({ decision: 'deny', reason: expect.stringContaining('equip supabase with') })
    expect(await skill($, 'supabase:supabase')).toContain("isn't equipped")
    expect(await listing($, LISTING)).toBe('- commit: Writes a commit')
    expect(await prompt($)).toContain('No loadout is equipped in this project.')
  })

  test('supabase, then nextjs: the gate, the skills, the instructions and the status move with the switch, no reload', async ($, on) => {
    const w = world(on)
    await start($)
    await w.clock.settle()
    const reloads = w.reloads

    expect(await loadout($, 'supabase')).toBe('Equipped supabase in /work/app.')
    expect((await check($, tool('supabase'))).decision).toBe('allow')
    expect((await check($, tool('supabase', 'authenticate'))).decision).toBe('allow')
    expect((await check($, 'ReadMcpResourceTool', { server: 'plugin:loadouts:supabase', uri: 'x' })).decision).toBe('allow')
    expect(await check($, tool('next-devtools', 'nextjs_docs'))).toMatchObject({ decision: 'deny', reason: expect.stringContaining('The next-devtools server is in the nextjs loadout and supabase is equipped: if the task needs it, equip nextjs') })
    expect((await check($, 'ReadMcpResourceTool', { server: 'plugin:loadouts:next-devtools', uri: 'x' })).decision).toBe('deny')
    expect(await skill($, 'supabase:supabase')).toBe('supabase:supabase body')
    expect(await skill($, 'nextjs-best-practices')).toContain("isn't equipped")
    expect((await check($, 'Skill', { skill: 'supabase:supabase' })).decision).toBe('allow')
    expect(await check($, 'Skill', { skill: 'nextjs-best-practices' })).toMatchObject({ decision: 'deny', reason: expect.stringContaining('The nextjs-best-practices skill is in a loadout that isn\'t equipped') })
    expect(await listing($, LISTING)).toBe(['- supabase:supabase: Supabase work', '- supabase:supabase-postgres-best-practices', '- commit: Writes a commit'].join('\n'))
    const one = await prompt($)
    expect(one).toStartWith('Working directory: /work/app\n\nLoadouts (loadouts mod): The supabase loadout is equipped in this project.')
    expect(one).toContain('Its instructions: Run SQL through execute_sql.')
    expect(one).toContain('(the mcp__plugin_loadouts_supabase__* tools)')
    expect(one).toContain('Not equipped: nextjs (skills: nextjs-best-practices · servers: next-devtools)')
    expect(w.status).toBe('loadout: supabase')
    expect(w.invalidated).toEqual(expect.arrayContaining(['prompt.section', 'prompt.attachment']))

    expect(await loadout($, 'nextjs')).toBe('Unequipped supabase; equipped nextjs in /work/app.')
    expect((await check($, tool('next-devtools', 'nextjs_docs'))).decision).toBe('allow')
    expect(await check($, tool('supabase'))).toMatchObject({ decision: 'deny', reason: expect.stringContaining('equip supabase with') })
    expect((await check($, 'ReadMcpResourceTool', { server: 'plugin_loadouts_supabase', uri: 'x' })).decision).toBe('deny')
    expect(await skill($, 'nextjs-best-practices')).toBe('nextjs-best-practices body')
    expect(await skill($, 'supabase:supabase-postgres-best-practices')).toContain("isn't equipped")
    expect((await check($, 'Skill', { skill: 'supabase:supabase' })).decision).toBe('deny')
    expect((await check($, 'Skill', { skill: 'commit' })).decision).toBe('allow')
    expect(await listing($, LISTING)).toBe(['- nextjs-best-practices: Next.js standards', '- commit: Writes a commit'].join('\n'))
    const two = await prompt($)
    expect(two).toContain('The nextjs loadout is equipped in this project.')
    expect(two).toContain('Its instructions: Prefer Server Components.')
    expect(two).not.toContain('Run SQL through execute_sql.')
    expect(w.status).toBe('loadout: nextjs')

    await w.clock.settle()
    expect(w.reloads).toBe(reloads)
  })

  test('Claude equips with the equip tool, the same as the person', async ($, on) => {
    world(on)
    await start($)
    const ran = (await ($.tool.call as (e: unknown) => Promise<{ result?: unknown }>)({ tool: 'mcp__loadouts__equip', loadout: 'nextjs' })).result
    expect(ran).toBe('Equipped nextjs in /work/app.')
    expect((await check($, tool('next-devtools', 'nextjs_docs'))).decision).toBe('allow')
  })

  test('the equipped loadout is per project, and an unknown name equips nothing', async ($, on) => {
    const w = world(on)
    await loadout($, 'supabase')
    w.root = '/work/other'
    expect((await check($, tool('supabase'))).decision).toBe('deny')
    expect(await loadout($, 'rails')).toBe("There's no loadout named rails: nextjs, supabase.")
    w.root = '/work/app'
    expect((await check($, tool('supabase'))).decision).toBe('allow')
  })

  test('a server added to a loadout file mid-session is written on the next equip, which reloads the servers', async ($, on) => {
    const w = world(on)
    await start($)
    await w.clock.settle()
    w.files.set('loadouts/nextjs.json', JSON.stringify({ ...NEXTJS, mcpServers: { ...NEXTJS.mcpServers, vercel: { type: 'http', url: 'https://mcp.vercel.com' } } }))
    await loadout($, 'nextjs')
    await w.clock.settle()
    expect(Object.keys(written(w) ?? {})).toEqual(['next-devtools', 'vercel', 'supabase'])
    expect(w.reloads).toBe(2)
    expect((await check($, tool('vercel', 'list_projects'))).decision).toBe('allow')
  })

  test('skills, servers and tools no loadout names are left alone; a listing of every server is refused', async ($, on) => {
    world(on)
    await loadout($, 'supabase')
    expect((await check($, 'Bash')).decision).toBe('allow')
    expect((await check($, 'mcp__plugin_supabase_supabase__list_tables')).decision).toBe('allow')
    expect((await check($, 'ListMcpResourcesTool', { server: 'plugin:supabase:supabase' })).decision).toBe('allow')
    expect(await check($, 'ListMcpResourcesTool', {})).toMatchObject({ decision: 'deny', reason: expect.stringContaining('Name a server') })
    expect(await skill($, 'commit')).toBe('commit body')
    expect(await check($, tool('rails'))).toMatchObject({ decision: 'deny', reason: expect.stringContaining('No loadout has a rails server') })
  })
})

describe('the picker', () => {
  test('/loadout lists every loadout with ● on the equipped one; Enter equips it and closes, on every surface', async ($, on) => {
    const w = world(on)
    for (const [surface, before] of [['terminal', '  supabase'], ['desktop', '● supabase']] as const) {
      await loadout($)
      const ui = await $.ui.mount({ ...PANE, surface })
      expect((await ui.findAll({ type: 'Button' })).map(b => b.props.label)).toEqual(['  nextjs', before])
      expect((await ui.find({ type: 'Text', text: /next-devtools/ }))?.text).toBe('  skills: nextjs-best-practices · servers: next-devtools')
      await ui.press({ key: 'supabase' })
      expect((await check($, tool('supabase'))).decision).toBe('allow')
      expect(w.closed.at(-1)).toBe('loadouts')
      expect(w.status).toBe('loadout: supabase')
      await ui.unmount()
    }
  })
})
