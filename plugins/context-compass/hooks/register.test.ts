import { expect, mock, test } from 'claude-code/testing'
import type { RenderElement } from 'claude-code'

import { depth } from './register'

import type { ContextFile, HookText, LoadedSkill } from '../types'

// The tool.call argument union spans every connected MCP tool, past what tsc will instantiate; the test needs two.
type Call = { tool: 'Read'; file_path: string; offset?: number; limit?: number } | { tool: 'Bash'; command: string }
const call = ($: { tool: { call: unknown } }, e: Call) => ($.tool.call as (e: Call) => Promise<unknown>)(e)

const text = (startLine: number, numLines: number) => ({
  result: {
    type: 'text' as const,
    file: { filePath: '/repo/a.ts', content: 'x'.repeat(40), numLines, startLine, totalLines: 100 },
  },
})

test('reads merge into one partial entry; a compaction makes it pre-compact; a re-read starts over', async ($, on) => {
  const reads = [text(1, 10), text(5, 26), text(50, 10)]
  on('tool.call', { tool: 'Read' }, () => reads.shift()!)
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: 'ok', stderr: '', interrupted: false } }))
  const said = (text: string) => [{ role: 'user' as const, text, toolUses: [] }]
  on('session.compact', () => ({ messages: said('summary') }))
  let files: ContextFile[] = []
  let shell: string[] = []
  on('state.set', ($, e, next) => {
    if (e.plugin === 'context-compass' && e.key === 'files') files = e.value
    if (e.plugin === 'context-compass' && e.key === 'shell') shell = e.value
    return next(e)
  })

  await call($, { tool: 'Read', file_path: '/repo/a.ts', limit: 10 })
  await call($, { tool: 'Read', file_path: '/repo/a.ts', offset: 5, limit: 26 })
  const merged = files
  expect(merged).toHaveLength(1)
  expect(merged[0]).toMatchObject({ ranges: [[1, 30]], total: 100, isCompacted: false })
  expect(depth(merged[0]!)).toBe('partial 30%')

  await $.session.compact({ trigger: 'manual', messages: said('before') })
  expect(files[0]?.isCompacted).toBe(true)

  await call($, { tool: 'Read', file_path: '/repo/a.ts', offset: 50, limit: 10 })
  expect(files[0]).toMatchObject({ ranges: [[50, 59]], isCompacted: false })

  await call($, { tool: 'Bash', command: 'rg -n foo src' })
  expect(shell).toEqual(['rg -n foo src'])
})

test('each row says main or helper, full or partial, live or pre-compact', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => text(1, 10))
  await call($, { tool: 'Read', file_path: '/repo/a.ts', limit: 10 })

  // 100 columns is the one-line layout; 60, a docked sidebar, puts the labels under the path.
  for (const [surface, bodyColumns] of [['terminal', 100], ['terminal', 60], ['desktop', 100], ['desktop', 60]] as const) {
    const ui = await $.ui.mount({
      plugin: 'context-compass',
      surface,
      component: 'Pane',
      requestId: 'context-compass',
      props: {
        title: 'Context compass',
        isFocused: false,
        bodyColumns,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 30 },
        view: {},
      },
    })
    expect(await ui.find({ text: /^main/ })).toBeDefined()
    expect(await ui.find({ text: /partial 10%/ })).toBeDefined()
    expect(await ui.find({ text: /^live/ })).toBeDefined()
    expect(await ui.find({ text: /L1-10 of 100/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a pane the person closed stays closed next session until /context-compass', async ($, on) => {
  const opened: string[] = []
  mock.env(on, { HOME: '/home/me' })
  mock.store(on, { open: false })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })

  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
  expect(opened).toEqual([])

  const { text } = await $.command.run({
    command: 'context-compass',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect(opened).toEqual(['context-compass'])
  expect(text).toContain('Context compass pane')
})

test('a sidebar only: the pane where it docks, a terminal split where it would sit inline', async ($, on) => {
  const opened: string[] = []
  const ran: string[] = []
  mock.store(on, {})
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })
  on('process.run', ($, e) => {
    ran.push(e.argv.join(' '))
    return { value: { exitCode: 0, stdout: 'context-compass: opened beside this iTerm2 pane.\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // Stands for the engine drawing the band beneath the mod.
  on('ui.render', ($, e) => h($.ui.resolve(e).Text, {}, '') as RenderElement)
  const band = (isFullscreen: boolean) =>
    $.ui.mount({
      plugin: 'context-compass',
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 5, bodyColumns: 160, scroll: { offset: 0, bodyRows: 5 }, view: {} },
      viewport: { columns: 160, rows: 40, isFullscreen },
    })

  await (await band(false)).unmount()
  const asked = (isFullscreen: boolean, columns: number) =>
    $.command.run({ command: 'context-compass', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen, columns } })
  expect((await asked(false, 160)).text).toBe('context-compass: opened beside this iTerm2 pane.')
  await asked(true, 90)
  expect(ran).toHaveLength(2)
  expect(ran[0]).toContain('ctx-open.sh')
  expect(opened).toEqual([])

  await (await band(true)).unmount()
  expect(opened).toEqual(['context-compass'])
})

test('skills are listed with their source and the prompt they added, summed over loads', async ($, on) => {
  on('skill.prompt', ($, e) => ({ text: e.text }))
  let skills: LoadedSkill[] = []
  on('state.set', ($, e, next) => {
    if (e.plugin === 'context-compass' && e.key === 'skills') skills = e.value
    return next(e)
  })

  await $.skill.prompt({ skill: 'superpowers:brainstorming', text: 'x'.repeat(4000), source: 'plugin', pluginName: 'superpowers' })
  await $.skill.prompt({ skill: 'tdd', text: 'y'.repeat(400), source: 'userSettings' })
  await $.skill.prompt({ skill: 'tdd', text: 'y'.repeat(400), source: 'userSettings' })
  expect(skills).toEqual([
    { name: 'superpowers:brainstorming', source: 'superpowers', tokens: 1000 },
    { name: 'tdd', source: 'userSettings', tokens: 200 },
  ])

  const ui = await $.ui.mount({
    plugin: 'context-compass',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'context-compass',
    props: { title: 'Context compass', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  expect(await ui.find({ text: /^Skills \(2\)/ })).toBeDefined()
  expect(await ui.find({ text: /superpowers:brainstorming/ })).toBeDefined()
  await ui.unmount()
})

test('hook text: grouped by event and first line, the skill it names as its label, cleared by a compaction', async ($, on) => {
  on('session.compact', () => ({ messages: [{ role: 'user' as const, text: 'summary', toolUses: [] }] }))
  let hooks: HookText[] = []
  on('state.set', ($, e, next) => {
    if (e.plugin === 'context-compass' && e.key === 'hookText') hooks = e.value
    return next(e)
  })
  const hookRow = (event: string, text: string, n: number) =>
    $.session.append({
      door: 'attachment',
      origin: { kind: 'hook', event },
      uuid: `u${n}`,
      message: { type: 'attachment', name: 'hook_success', role: 'user', isMeta: true, content: [{ type: 'text', text }] },
    })

  await hookRow('SessionStart', "SessionStart hook additional context: <EXTREMELY_IMPORTANT>\nthe full content of your 'superpowers:using-superpowers' skill\n" + 'u'.repeat(2000), 1)
  await hookRow('SessionStart', 'SessionStart:clear hook success: === REMEMBER ===\n' + 'r'.repeat(400), 2)
  await hookRow('UserPromptSubmit', 'UserPromptSubmit hook success: [13:41 ACDT -- me]', 3)
  await hookRow('UserPromptSubmit', 'UserPromptSubmit hook success: [13:49 ACDT -- me]', 4)
  expect(hooks.map(h => [h.label, h.count])).toEqual([
    ['superpowers:using-superpowers', 1],
    ['REMEMBER', 1],
    ['[13:49 ACDT -- me]', 2],
  ])

  const ui = await $.ui.mount({
    plugin: 'context-compass',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'context-compass',
    props: { title: 'Context compass', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
  })
  expect(await ui.find({ text: /^Hook text \(3\)/ })).toBeDefined()
  expect(await ui.find({ text: /UserPromptSubmit ×2/ })).toBeDefined()
  await ui.unmount()

  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user' as const, text: 'before', toolUses: [] }] })
  expect(hooks).toEqual([])
})

test('an edit is partial, a write is full', () => {
  expect(depth({ path: '/a', via: 'edit', isSnippet: true, tokens: 1, isCompacted: false })).toBe('partial')
  expect(depth({ path: '/a', via: 'write', tokens: 1, isCompacted: false })).toBe('full')
})
