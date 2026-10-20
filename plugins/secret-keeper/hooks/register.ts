import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { StoredEntry } from '../types'
import { find, type FindOptions, type Hit } from './detect'
import * as keychain from './keychain'
import { prefixFor, refsToVars, SLOTS, TOKEN, tokensIn } from './shell'

/** Placeholder key (`secret:NAME`, `pii:EMAIL#1`) → the real value, for this session. */
const vault = atom({ plugin: 'secret-keeper', key: 'vault' } as const, {} as Record<string, string>)
/** Names of stored secrets this session exports to Bash. */
const exported = atom({ plugin: 'secret-keeper', key: 'exported' } as const, [] as string[])
/** The project this session belongs to: its root and the hash Keychain accounts use. */
const project = atom({ plugin: 'secret-keeper', key: 'project' } as const, { id: '', root: '' })

type Project = { id: string; root: string }
type Index = Record<string, StoredEntry>
type Block = { type: string; [field: string]: unknown }
type Cfg = FindOptions & { keychain: boolean }

const GLOBAL = 'global'

// Bash calls running now: the slots are set while any is, so hooks, MCP servers and commands
// started between calls never inherit them.
let running = 0
let slotsSet = 0
let envRefused = false
let overflowSaid = false

/** Sets slot `i` (0-based) to a value, or unsets it. `$.env.set` takes literal names only, hence the switch. */
function setSlot($: EngineInterface, i: number, value: string | undefined) {
  switch (i) {
    case 0: return $.env.set('SECRET_KEEPER_1', value)
    case 1: return $.env.set('SECRET_KEEPER_2', value)
    case 2: return $.env.set('SECRET_KEEPER_3', value)
    case 3: return $.env.set('SECRET_KEEPER_4', value)
    case 4: return $.env.set('SECRET_KEEPER_5', value)
    case 5: return $.env.set('SECRET_KEEPER_6', value)
    case 6: return $.env.set('SECRET_KEEPER_7', value)
    case 7: return $.env.set('SECRET_KEEPER_8', value)
    case 8: return $.env.set('SECRET_KEEPER_9', value)
    case 9: return $.env.set('SECRET_KEEPER_10', value)
    case 10: return $.env.set('SECRET_KEEPER_11', value)
    case 11: return $.env.set('SECRET_KEEPER_12', value)
    case 12: return $.env.set('SECRET_KEEPER_13', value)
    case 13: return $.env.set('SECRET_KEEPER_14', value)
    case 14: return $.env.set('SECRET_KEEPER_15', value)
    default: return $.env.set('SECRET_KEEPER_16', value)
  }
}

const write = ($: EngineInterface, i: number, value: string | undefined) =>
  Promise.resolve(setSlot($, i, value)).catch((err: unknown) => ({ deny: String(err) }))

/** Fills the first slots with values, counting each as it lands; resolves with why not when a write is refused. */
async function fillSlots($: EngineInterface, values: readonly string[]): Promise<string | undefined> {
  for (let i = 0; i < values.length; i++) {
    const r = await write($, i, values[i])
    if (r.deny) return r.deny
    slotsSet = Math.max(slotsSet, i + 1)
  }
  return undefined
}

/** Unsets every slot set; one that will not unset stays counted, to try again. Resolves with why, if any did not. */
async function clearSlots($: EngineInterface): Promise<string | undefined> {
  let failed: string | undefined
  let left = 0
  for (let i = 0; i < slotsSet; i++) {
    const r = await write($, i, undefined)
    if (r.deny) {
      failed ??= r.deny
      left = i + 1
    }
  }
  slotsSet = left
  return failed
}
const WITHHELD = '[secret-keeper withheld this content: it could not be scanned]'
const UNCHECKED = 'secret-keeper could not check this call for secrets, so it was not run.'

// Fail closed: a row that could not be scanned is never stored or sent as it came.
const withheld = (blocks: readonly Block[]) =>
  blocks.map(b => (b.type === 'text' ? { ...b, text: WITHHELD } : b.type === 'tool_result' ? { ...b, content: WITHHELD } : b))

const fnv1a = (s: string) => {
  let h = 0x811c9dc5
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 0x01000193) >>> 0
  return h.toString(16).padStart(8, '0')
}
const today = () => new Date().toLocaleDateString('en-CA')
const runner = ($: EngineInterface): Parameters<typeof keychain.save>[0] => (argv, init) => $.process.run(argv, init)
const getIndex = async ($: EngineInterface) => ((await $.store.get('index')) ?? {}) as Index

function note(names: readonly string[], keychainOn: boolean): string {
  return [
    'Secret handling (secret-keeper): secrets in this conversation appear as [secret:NAME], and personal data as [pii:LABEL#n]; the real values never reach you.',
    keychainOn
      ? 'A key the person pastes is hidden before you see it and saved to their macOS Keychain, so pasting is safe and expected: do not warn them about it or suggest rotating it.'
      : 'A key the person pastes is hidden before you see it, so pasting is safe and expected: do not warn them about it or suggest rotating it.',
    'Stored secrets are already exported as environment variables in every Bash command: write $NAME, and scripts read them from the environment too.',
    'In Edit, Write and NotebookEdit, writing [secret:NAME] writes the real value (for a .env file, write NAME=[secret:NAME]).',
    'Never ask for a hidden value or try to reconstruct one. If you see what looks like a real secret in plain text, it was missed: say so once, briefly, so they can rotate it.',
    names.length ? `Available in Bash: ${names.join(', ')}.` : 'No secrets are stored for this project yet.',
  ].join(' ')
}

/** Every encoding of a value that output could carry it in. */
function forms(value: string): string[] {
  const bytes = new TextEncoder().encode(value)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const b64 = btoa(bin)
  const url = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const json = JSON.stringify(value).slice(1, -1)
  return [...new Set([value, json, b64, url, keychain.toHex(value)])].filter(f => f.length >= 8)
}

/** The key a hit is kept under. Same value, same key; a pasted value takes its name over, a found one gets a suffix. */
function assign(v: Record<string, string>, hit: Hit, pasted: boolean): string {
  const known = Object.keys(v).find(k => v[k] === hit.value)
  if (known) return known
  let key: string
  if (hit.kind === 'pii') key = `pii:${hit.name}#${Object.keys(v).filter(k => k.startsWith(`pii:${hit.name}#`)).length + 1}`
  else {
    key = `secret:${hit.name}`
    for (let i = 2; !pasted && v[key] !== undefined; i++) key = `secret:${hit.name}_${i}`
  }
  v[key] = hit.value
  return key
}

/** Hides known values (in any encoding), then new finds. Adds new finds to `v`; returns the text and what was new. */
function scrub(text: string, v: Record<string, string>, cfg: Cfg, pasted: boolean) {
  const needles = Object.entries(v).flatMap(([key, value]) => forms(value).map(f => [f, `[${key}]`] as const))
  needles.sort((a, b) => b[0].length - a[0].length)
  for (const [needle, token] of needles) if (text.includes(needle)) text = text.split(needle).join(token)

  const fresh: Array<{ key: string; hit: Hit; replaced: boolean }> = []
  let out = ''
  let at = 0
  for (const hit of find(text, cfg)) {
    const replaced = pasted && hit.kind === 'secret' && v[`secret:${hit.name}`] !== undefined && v[`secret:${hit.name}`] !== hit.value
    const isNew = !Object.values(v).includes(hit.value)
    const key = assign(v, hit, pasted)
    if (isNew || pasted) fresh.push({ key, hit, replaced })
    out += `${text.slice(at, hit.start)}[${key}]`
    at = hit.end
  }
  return { text: out + text.slice(at), fresh }
}

function mapBlocks(blocks: readonly Block[], fn: (text: string) => string): Block[] | undefined {
  let changed = false
  const out = blocks.map(b => {
    if (b.type === 'text' && typeof b.text === 'string') {
      const text = fn(b.text)
      if (text !== b.text) return (changed = true), { ...b, text }
    }
    if (b.type === 'tool_result' && typeof b.content === 'string') {
      const content = fn(b.content)
      if (content !== b.content) return (changed = true), { ...b, content }
    }
    if (b.type === 'tool_result' && Array.isArray(b.content)) {
      const content = mapBlocks(b.content as Block[], fn)
      if (content) return (changed = true), { ...b, content }
    }
    return b
  })
  return changed ? out : undefined
}

/** Placeholders in tool arguments swapped for real values; one this session does not hold refuses the call. */
function restore(v: Record<string, string>, fields: Record<string, string | undefined>) {
  const unknown = Object.values(fields).flatMap(f => (f ? tokensIn(f) : [])).filter(k => v[k] === undefined)
  if (unknown.length) {
    return {
      deny: `[${unknown[0]}] is not a value this session holds (it may come from a session that was cleared). Ask the person to paste it again, or leave that text as it is.`,
    }
  }
  const out: Record<string, string> = {}
  for (const [k, f] of Object.entries(fields)) if (f !== undefined) out[k] = f.replace(TOKEN, (_, key: string) => v[key]!)
  return { fields: out, changed: Object.entries(out).some(([k, f]) => f !== fields[k]) }
}

async function loadStored($: EngineInterface, p: Project) {
  const index = await getIndex($)
  const mine = Object.entries(index).filter(([, e]) => e.scope === GLOBAL || e.scope === p.root)
  // A project's own key wins over a global one with the same name.
  mine.sort(([, a], [, b]) => Number(a.scope !== GLOBAL) - Number(b.scope !== GLOBAL))
  const values = await Promise.all(mine.map(([acct]) => keychain.load(runner($), acct)))
  const add: Record<string, string> = {}
  mine.forEach(([, e], i) => values[i] !== undefined && (add[`secret:${e.name}`] = values[i]!))
  if (Object.keys(add).length === 0) return
  await update($, vault, v => ({ ...v, ...add }))
  await update($, exported, names => [...new Set([...names, ...Object.keys(add).map(k => k.slice('secret:'.length))])])
}

/** Works out the project once per session and loads its stored secrets; every hook calls it, since /clear starts state over. */
async function ensure($: EngineInterface, cfg: Cfg, cwd?: string): Promise<Project> {
  const current = await read($, project)
  if (current.id) return current
  const dir = cwd ?? (await $.session.cwd())
  const git = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { cwd: dir, timeoutMs: 5_000 }).catch(() => undefined)
  const root = git?.exitCode === 0 && git.stdout.trim() ? git.stdout.trim() : dir
  const mine = { id: fnv1a(root), root }
  let claimed = false
  await update($, project, p => (p.id ? p : ((claimed = true), mine)))
  if (claimed && cfg.keychain) await loadStored($, mine).catch(err => $.ui.log(`could not read stored secrets from the Keychain: ${String(err)}`))
  return (await read($, project)) as Project
}

/** Saves to the Keychain and indexes the name; returns why it failed, if it did. */
async function store($: EngineInterface, p: Project, name: string, value: string): Promise<string | undefined> {
  const acct = keychain.account(p.id, name)
  try {
    await keychain.save(runner($), acct, value)
  } catch (err) {
    return String(err instanceof Error ? err.message : err)
  }
  await $.store.set('index', { ...(await getIndex($)), [acct]: { name, scope: p.root, saved: today() } })
  return undefined
}

export const register: Register = (on, options) => {
  const cfg: Cfg = {
    pii: options.pii === true,
    keychain: options.keychain !== false,
    off: new Set(String(options.off ?? '').split(',').map(s => s.trim()).filter(Boolean)),
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'secrets',
      description: 'List the secrets stored for this project; rm, global or local one',
      argumentHint: '[rm <NAME|all> | global <NAME> | local <NAME>]',
    })
    await ensure($, cfg, e.cwd)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command) return next(e)
    const p = await ensure($, cfg)
    const v = { ...(await read($, vault)) }
    const { text, fresh } = scrub(e.text, v, cfg, true)
    if (fresh.length === 0 && text === e.text) return next(e)

    const said: string[] = []
    const stored: string[] = []
    for (const { key, hit, replaced } of fresh) {
      if (hit.kind === 'pii') continue
      const name = key.slice('secret:'.length)
      if (!cfg.keychain) {
        said.push(`hid ${name} for this session`)
        stored.push(name)
        continue
      }
      const failed = await store($, p, name, hit.value)
      said.push(failed ? `kept ${name} for this session only (the Keychain refused it: ${failed})` : `${replaced ? 'replaced' : 'stored'} ${name} in the Keychain for this project`)
      stored.push(name)
    }
    const pii = fresh.filter(f => f.hit.kind === 'pii').length
    if (pii) said.push(`hid ${pii} personal ${pii === 1 ? 'detail' : 'details'}`)

    await update($, vault, cur => ({ ...cur, ...v }))
    if (stored.length) {
      await update($, exported, names => [...new Set([...names, ...stored])])
      $.ui.invalidate('prompt.section')
    }
    if (said.length) $.ui.log(said.join('; '))
    return next({ ...e, text })
  }).catch(($, e, next) => (next.called ? next(e) : { drop: 'secret-keeper could not scan this prompt, so it was not sent. Send it again, or turn the mod off in /plugin.' }))

  on('session.append', async ($, e, next) => {
    try {
      await ensure($, cfg)
      const v = { ...(await read($, vault)) }
      const before = Object.keys(v).length
      const content = mapBlocks(e.message.content as Block[], t => scrub(t, v, cfg, false).text)
      if (Object.keys(v).length !== before) await update($, vault, cur => ({ ...v, ...cur }))
      return next(content ? { ...e, message: { ...e.message, content } } : e)
    } catch (err) {
      $.ui.log(`withheld a row it could not scan: ${String(err)}`, { to: 'debug' })
      return next({ ...e, message: { ...e.message, content: withheld(e.message.content as Block[]) } })
    }
  }).catch(($, e, next) => (next.called ? next(e) : next({ ...e, message: { ...e.message, content: withheld(e.message.content as Block[]) } })))

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    await ensure($, cfg)
    const r = restore(await read($, vault), { old_string: e.old_string, new_string: e.new_string })
    if ('deny' in r) return { deny: r.deny! }
    return r.changed ? next({ ...e, ...r.fields }) : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: UNCHECKED }))

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    await ensure($, cfg)
    const r = restore(await read($, vault), { content: e.content })
    if ('deny' in r) return { deny: r.deny! }
    return r.changed ? next({ ...e, ...r.fields }) : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: UNCHECKED }))

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    await ensure($, cfg)
    const r = restore(await read($, vault), { new_source: e.new_source })
    if ('deny' in r) return { deny: r.deny! }
    return r.changed ? next({ ...e, ...r.fields }) : next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { deny: UNCHECKED }))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    if (e.command.includes(keychain.SERVICE)) return { deny: 'Stored secrets are read by secret-keeper alone; use them as $NAME.' }
    await ensure($, cfg)
    const v = await read($, vault)
    const names = await read($, exported)
    const blocked = tokensIn(e.command).filter(k => !k.startsWith('secret:') || !names.includes(k.slice('secret:'.length)))
    if (blocked.length) {
      return {
        deny: `[${blocked[0]}] is not available in the shell: only secrets the person pasted or stored are, as $NAME. Read a value found in a file from that file (for example \`set -a; . ./.env\`), and keep personal data out of commands.`,
      }
    }
    const command = refsToVars(e.command)
    const plain = () => (command === e.command ? next(e) : next({ ...e, command }))
    const have = [...names].sort().filter(n => v[`secret:${n}`] !== undefined)
    // Slots an earlier unset left behind get another try before anything else runs.
    if (running === 0 && slotsSet > 0) await clearSlots($)
    if (have.length === 0 || envRefused) return plain()
    if (have.length > SLOTS && !overflowSaid) {
      overflowSaid = true
      $.ui.log(`only ${SLOTS} stored secrets fit in a Bash call; ${have.slice(SLOTS).join(', ')} ${have.length - SLOTS === 1 ? 'is' : 'are'} left out`)
    }
    const used = have.slice(0, SLOTS)

    running++
    try {
      const refused = await fillSlots($, used.map(n => v[`secret:${n}`]!))
      if (refused) {
        // Never fall back to putting values in the command: hooks beneath would see and might log them.
        envRefused = true
        $.ui.log(`stored secrets are not available in Bash this session: the environment write was refused (${refused})`)
        return await plain()
      }
      return await next({ ...e, command: prefixFor(used) + command })
    } finally {
      const stuck = --running === 0 ? await clearSlots($) : undefined
      if (stuck) {
        // Say so, and stop handing secrets to Bash: a value left in Claude Code's environment reaches whatever it starts next.
        envRefused = true
        $.ui.log(`a stored secret could not be cleared from Claude Code's environment (${stuck}); stored secrets stay out of Bash for this session, and a restart drops it`)
      }
    }
  }).catch(($, e, next) => (next.called ? next(e) : { deny: UNCHECKED }))

  on('prompt.section', { name: 'env_info_simple' }, async ($, e, next) => {
    const r = await next(e)
    await ensure($, cfg)
    return { text: [r.text, note(await read($, exported), cfg.keychain)].filter(Boolean).join('\n\n') }
  })

  on('command.run', { command: 'secrets' }, async ($, e) => {
    const p = await ensure($, cfg)
    const [verb = '', name = ''] = e.args.trim().split(/\s+/)
    const index = await getIndex($)
    const label = (scope: string) => (scope === GLOBAL ? 'global' : scope === p.root ? 'this project' : scope)

    if (!verb) {
      const here = Object.values(index).filter(x => x.scope === GLOBAL || x.scope === p.root)
      const elsewhere = Object.keys(index).length - here.length
      const v = await read($, vault)
      const names = await read($, exported)
      const found = Object.keys(v).filter(k => k.startsWith('secret:') && !names.includes(k.slice('secret:'.length))).length
      const pii = Object.keys(v).filter(k => k.startsWith('pii:')).length
      const width = Math.max(0, ...here.map(x => x.name.length))
      return {
        text: [
          !cfg.keychain
            ? 'The Keychain is off: pasted secrets last this session only.'
            : here.length
              ? ['Stored in the Keychain:', ...here.map(x => `  ${x.name.padEnd(width)}  ${label(x.scope)}  ${x.saved}`)].join('\n')
              : 'Nothing stored for this project. Paste a key (NAME=value works best) and it is kept for this project.',
          elsewhere ? `${elsewhere} more stored for other projects.` : '',
          found || pii ? `Hidden this session: ${found} found in files (not stored), ${pii} personal.` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }

    if (verb === 'rm' && name === 'all') {
      const accts = Object.keys(index)
      await Promise.all(accts.map(a => keychain.remove(runner($), a)))
      await $.store.set('index', {})
      const gone = new Set(Object.values(index).map(x => x.name))
      await update($, exported, names => names.filter(n => !gone.has(n)))
      return { text: `Removed ${accts.length} stored ${accts.length === 1 ? 'secret' : 'secrets'} from the Keychain, every project.` }
    }

    // A name means this project's entry, else the global one.
    const pick = (scope?: string) =>
      Object.entries(index)
        .filter(([, x]) => x.name === name && (scope ? x.scope === scope : x.scope === p.root || x.scope === GLOBAL))
        .sort(([, a]) => (a.scope === p.root ? -1 : 1))[0]

    if (verb === 'rm' && name) {
      const hit = pick()
      if (!hit) return { text: `${name} is not stored for this project. /secrets lists what is.` }
      await keychain.remove(runner($), hit[0])
      const { [hit[0]]: _, ...rest } = index
      await $.store.set('index', rest)
      await update($, exported, names => names.filter(n => n !== name))
      return { text: `Removed ${name} (${label(hit[1].scope)}) from the Keychain.` }
    }

    if ((verb === 'global' || verb === 'local') && name) {
      const hit = pick(verb === 'global' ? p.root : GLOBAL)
      if (!hit) return { text: `${name} is not stored ${verb === 'global' ? 'for this project' : 'globally'}.` }
      const value = (await read($, vault))[`secret:${name}`] ?? (await keychain.load(runner($), hit[0]))
      if (value === undefined) return { text: `Could not read ${name} from the Keychain.` }
      const scope = verb === 'global' ? GLOBAL : p.root
      const acct = keychain.account(verb === 'global' ? GLOBAL : p.id, name)
      await keychain.save(runner($), acct, value)
      await keychain.remove(runner($), hit[0])
      const { [hit[0]]: _, ...rest } = index
      await $.store.set('index', { ...rest, [acct]: { ...hit[1], scope } })
      return { text: verb === 'global' ? `${name} is now global: every project's sessions export it.` : `${name} now belongs to this project only.` }
    }

    return { text: 'Usage: /secrets, /secrets rm <NAME|all>, /secrets global <NAME>, /secrets local <NAME>' }
  })
}
