import type { On } from 'claude-code'
import { describe, expect, mock, test } from 'claude-code/testing'

import { PUSH, RISKY, verdict } from '../hooks/register'

type Decision = 'allow' | 'ask' | 'deny'
type Check = { decision: Decision; reason?: string }

const usage = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const said = (text: string) => ({ value: { isAnswered: true as const, text, usage } })
const failed = { value: { isAnswered: false, reason: 'api-error', status: 500, error: 'server_error', usage } } as const

/**
 * The engine beneath the mod: a session at /work/app on `branch`, a model whose rewrite echoes its prompt, a fork
 * that answers through `fork` (undefined: an API error), and a permission check that answers `engine`.
 */
type WorldOptions = { fork?: (prompt: string) => string | undefined; branch?: string; engine?: Decision }
function world(on: On, o: WorldOptions = {}) {
  const w = { forks: [] as string[], rewrites: [] as string[], submitted: [] as string[], files: new Map<string, string>(), clock: mock.clock(on) }
  on('session.cwd', () => ({ value: '/work/app' }))
  on('session.id', () => ({ value: 's1' }))
  on('env.get', () => ({ value: '/home/me' }))
  on('fs.write', ($, e) => (w.files.set(e.path, e.text), { value: undefined }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: `${o.branch ?? 'feat/x'}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('model.complete', ($, e) => (w.rewrites.push(e.prompt), said(`rewritten: ${e.prompt}`)))
  on('model.fork', ($, e) => {
    w.forks.push(e.prompt)
    const text = o.fork?.(e.prompt)
    return text === undefined ? failed : said(text)
  })
  on('prompt.submit', ($, e) => (w.submitted.push(e.text), { text: e.text }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.notify', () => ({ value: { isSent: true as const, channel: 'terminal_bell' as const } }))
  on('tool.check', () => ({ decision: o.engine ?? 'ask', reason: 'no rule allows it' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  return w
}

const drive = ($: { command: { run: unknown } }, args: string) =>
  ($.command.run as (a: unknown) => Promise<{ text: string }>)({ command: 'drive', args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 100 } }).then(r => r.text)
const type = ($: { prompt: { submit: unknown } }, text: string, kind = 'composer') =>
  ($.prompt.submit as (e: unknown) => Promise<{ text: string }>)({ text, wait: false, origin: { kind } }).then(r => r.text)
const check = ($: { tool: { check: unknown } }, tool: string, input: unknown) =>
  ($.tool.check as (e: unknown) => Promise<Check>)({ tool, input, tool_use_id: 'u1' })
const ended = ($: { turn: { complete: unknown } }, reason: 'answer' | 'aborted' | 'error' = 'answer') =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({ answer: 'did it', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason })

const ALLOW = '{"decision":"allow","reason":"stays inside the repository"}'

describe('engaging', () => {
  test('/drive <goal> rewrites the goal, submits it and records the session', async ($, on) => {
    const w = world(on)
    expect(await drive($, 'add tests')).toBe('Autopilot on.')
    await w.clock.settle()
    expect(w.submitted).toEqual(['rewritten: add tests'])
    const row = JSON.parse(w.files.get('/home/me/.claude/autopilot/s1.json')!) as { goal: string; status: string }
    expect(row).toMatchObject({ goal: 'rewritten: add tests', status: 'driving' })
  })

  test('typed prompts are rewritten only while driving, and its own prompts never', async ($, on) => {
    const w = world(on)
    expect(await type($, 'hello')).toBe('hello')
    await drive($, 'add tests')
    expect(await type($, 'then lint')).toBe('rewritten: then lint')
    expect(await type($, 'from a plugin', 'plugin')).toBe('from a plugin')
    expect(w.rewrites).toEqual(['add tests', 'then lint'])
  })

  test('/drive off stops it deciding', async ($, on) => {
    const w = world(on, { fork: () => ALLOW })
    await drive($, 'add tests')
    await drive($, 'off')
    expect((await check($, 'Bash', { command: 'rm -rf build' })).decision).toBe('ask')
    expect(w.forks).toEqual([])
  })
})

describe('permission asks', () => {
  test('an ask goes to the fork with the live facts, and its verdict stands', async ($, on) => {
    let answer = ALLOW
    const w = world(on, { fork: () => answer })
    await drive($, 'add tests')
    expect((await check($, 'Bash', { command: 'rm -rf build' })).decision).toBe('allow')
    expect(w.forks[0]).toContain('Working directory: /work/app\nGit branch: feat/x')
    expect(w.forks[0]).toContain('rm -rf build')
    answer = '{"decision":"deny","reason":"deletes outside the goal"}'
    expect(await check($, 'Bash', { command: 'rm -rf ~' })).toMatchObject({ decision: 'deny', reason: 'Autopilot refused this: deletes outside the goal' })
  })

  test('an unsure fork, or one that fails, leaves the ask to the person', async ($, on) => {
    let answer: string | undefined = '{"decision":"ask","reason":"which bucket is meant"}'
    world(on, { fork: () => answer })
    await drive($, 'add tests')
    expect((await check($, 'Bash', { command: 'aws s3 rm s3://x' })).decision).toBe('ask')
    answer = undefined
    expect((await check($, 'Bash', { command: 'aws s3 rm s3://x' })).decision).toBe('ask')
  })

  test("the engine's allow stands without a model call", async ($, on) => {
    const w = world(on, { engine: 'allow', fork: () => ALLOW })
    await drive($, 'add tests')
    expect((await check($, 'Read', { file_path: '/work/app/a.ts' })).decision).toBe('allow')
    expect(w.forks).toEqual([])
  })

  test('force-pushes and pushes to main are refused even where a rule allows them', async ($, on) => {
    world(on, { engine: 'allow', branch: 'main' })
    await drive($, 'ship it')
    for (const command of ['git push --force', 'git -C app push origin main', 'git push']) {
      expect((await check($, 'Bash', { command })).decision).toBe('deny')
    }
  })

  test('a branch push from a branch is left to the engine', async ($, on) => {
    world(on, { engine: 'allow', branch: 'feat/x' })
    await drive($, 'ship it')
    expect((await check($, 'Bash', { command: 'git push -u origin feat/x' })).decision).toBe('allow')
  })

  test('questions are answered from the session, and plan mode is skipped', async ($, on) => {
    world(on, { fork: () => 'Take Postgres: the repo already uses it.' })
    await drive($, 'add a database')
    const asked = await check($, 'AskUserQuestion', { questions: [{ question: 'Which database?' }] })
    expect(asked.decision).toBe('deny')
    expect(asked.reason).toContain('Take Postgres: the repo already uses it.')
    expect((await check($, 'EnterPlanMode', {})).decision).toBe('deny')
  })
})

describe('driving', () => {
  test('after a turn the next instruction is sent and counted', async ($, on) => {
    const w = world(on, { fork: () => 'Now run the tests.' })
    await drive($, 'add tests')
    await w.clock.settle()
    await ended($)
    await w.clock.settle()
    expect(w.submitted).toEqual(['rewritten: add tests', 'Now run the tests.'])
    expect(JSON.parse(w.files.get('/home/me/.claude/autopilot/s1.json')!)).toMatchObject({ turns: 1 })
  })

  test('DONE stops it without sending anything', async ($, on) => {
    const w = world(on, { fork: () => 'DONE: tests added and green' })
    await drive($, 'add tests')
    await w.clock.settle()
    await ended($)
    await w.clock.settle()
    expect(w.submitted).toEqual(['rewritten: add tests'])
    expect(JSON.parse(w.files.get('/home/me/.claude/autopilot/s1.json')!)).toMatchObject({ status: 'done: tests added and green' })
  })

  test('it stops at the turn cap', { options: { maxTurns: 1 } }, async ($, on) => {
    const w = world(on, { fork: () => 'Keep going.' })
    await drive($, 'add tests')
    await w.clock.settle()
    await ended($)
    await ended($)
    await w.clock.settle()
    expect(w.submitted).toEqual(['rewritten: add tests', 'Keep going.'])
  })

  test('an interrupted turn pauses it until /drive on', async ($, on) => {
    const w = world(on, { fork: () => 'Keep going.' })
    await drive($, 'add tests')
    await ended($, 'aborted')
    await ended($)
    await w.clock.settle()
    expect(w.forks).toEqual([])
    expect(w.submitted).toEqual(['rewritten: add tests'])
    await drive($, 'on')
    await w.clock.settle()
    expect(w.submitted.at(-1)).toBe('Carry on toward the goal: rewritten: add tests')
  })
})

describe('the push guard and verdicts', () => {
  test('RISKY catches force and protected-branch pushes, not branch pushes', () => {
    for (const c of ['git push -f', 'git push -uf origin x', 'git push --force-with-lease', 'git push origin +HEAD', 'git -c a=b push origin master', 'cd x && git push origin main']) {
      expect(RISKY.test(c), c).toBe(true)
    }
    for (const c of ['git push -u origin feat/maintenance', 'git push --follow-tags', 'git status && echo main']) {
      expect(RISKY.test(c), c).toBe(false)
    }
    expect(PUSH.test('git -C app push')).toBe(true)
    expect(PUSH.test('git pull')).toBe(false)
  })

  test('verdict reads the first JSON object and nothing else', () => {
    expect(verdict('Sure. {"decision":"allow","reason":"ok"}')).toEqual({ decision: 'allow', reason: 'ok' })
    expect(verdict('{"decision":"maybe","reason":"x"}')).toBeUndefined()
    expect(verdict('no json')).toBeUndefined()
  })
})
