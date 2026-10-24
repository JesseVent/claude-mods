import type { EngineInterface, Register } from 'claude-code'

type Engine = EngineInterface
/** One file in loadouts/: what equipping it puts in effect. */
export type Loadout = { name: string; skills: string[]; mcpServers: Record<string, unknown>; instructions: string }
/** Per project root, the loadout equipped there. */
type Equipped = Record<string, string>

const DIR = 'loadouts'
const FILE = 'loadouts.mcp.json'
/** How the engine names this mod's servers' tools: `mcp__plugin_loadouts_<server>__<tool>`. */
const PREFIX = 'mcp__plugin_loadouts_'
const EQUIP = 'mcp__loadouts__equip'
const PANE = 'loadouts'
/** Loadout and server names: a server's becomes part of its tools' names, which keep only these. */
const NAME = /^[a-z0-9][a-z0-9-]{0,29}$/

const get = async <T,>($: Engine, key: string, empty: T) => ((await $.store.get(key)) ?? empty) as T
const list = (xs: readonly string[]) => xs.join(', ') || 'none'

/** A loadout file read, or why it isn't one. */
export function parse(file: string, text: string): Loadout | string {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return `${file} isn't JSON`
  }
  const l = (raw ?? {}) as Partial<Record<keyof Loadout, unknown>>
  if (typeof l.name !== 'string' || !NAME.test(l.name)) return `${file}: "name" is up to 30 lowercase letters, digits and dashes`
  if (l.skills !== undefined && !(Array.isArray(l.skills) && l.skills.every(s => typeof s === 'string'))) return `${file}: "skills" is a list of skill names`
  const servers = l.mcpServers ?? {}
  if (typeof servers !== 'object' || servers === null || Array.isArray(servers)) return `${file}: "mcpServers" is an object, as in .mcp.json`
  const bad = Object.entries(servers).find(([k, v]) => !NAME.test(k) || typeof v !== 'object' || v === null)
  if (bad) return `${file}: server "${bad[0]}" needs a name of lowercase letters, digits and dashes, and an object as in .mcp.json`
  if (l.instructions !== undefined && typeof l.instructions !== 'string') return `${file}: "instructions" is a string`
  return { name: l.name, skills: (l.skills as string[] | undefined) ?? [], mcpServers: servers as Record<string, unknown>, instructions: l.instructions ?? '' }
}

/** Every loadout in the mod's loadouts/ folder, by file name; a file that isn't one is left out and said why. */
async function load($: Engine) {
  const dir = `${$.plugin.root}/${DIR}`
  const loadouts: Loadout[] = []
  const problems: string[] = []
  const defs = new Map<string, string>()
  const files = (await $.fs.list(dir).catch(() => [])).filter(f => f.kind === 'file' && f.name.endsWith('.json')).map(f => f.name).sort()
  for (const file of files) {
    const l = parse(file, await $.fs.read(`${dir}/${file}`).catch(() => ''))
    if (typeof l === 'string') {
      problems.push(l)
      continue
    }
    if (loadouts.some(o => o.name === l.name)) {
      problems.push(`${file}: the name ${l.name} is taken by another file`)
      continue
    }
    // Two loadouts may share a server only as one server: the same definition.
    const clash = Object.keys(l.mcpServers).find(k => defs.has(k) && defs.get(k) !== JSON.stringify(l.mcpServers[k]))
    if (clash) {
      problems.push(`${file}: server "${clash}" is defined differently by another loadout`)
      continue
    }
    for (const [k, v] of Object.entries(l.mcpServers)) defs.set(k, JSON.stringify(v))
    loadouts.push(l)
  }
  return { loadouts, problems }
}

async function equipped($: Engine, loadouts: readonly Loadout[]) {
  const name = (await get<Equipped>($, 'equipped', {}))[await $.session.root()]
  return loadouts.find(l => l.name === name)
}

/** The manifest's server list: every loadout's servers, so equipping changes the gate and never the servers loaded. */
export function servers(loadouts: readonly Loadout[]) {
  return { mcpServers: Object.assign({}, ...loadouts.map(l => l.mcpServers)) as Record<string, unknown> }
}

/** Writes the manifest's server list: true when it changed, and the engine has to reload it. */
async function sync($: Engine, loadouts: readonly Loadout[]) {
  const text = `${JSON.stringify(servers(loadouts), null, 2)}\n`
  const path = `${$.plugin.root}/${FILE}`
  if ((await $.fs.read(path).catch(() => '')) === text) return false
  await $.fs.write(path, text)
  return true
}

/** From a timer, since the host refuses it from a hook the turn waits on; when it is refused anyway, the person runs it. */
function reload($: Engine) {
  $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }).catch(err => $.ui.log(`could not reload the loadout servers (${String(err)}): run /reload-plugins`)))
}

const contents = (l: Loadout) => `skills: ${list(l.skills)} · servers: ${list(Object.keys(l.mcpServers))}`
const tools = (l: Loadout) => Object.keys(l.mcpServers).map(s => `${PREFIX}${s}__*`)

/** Skills some loadout names and the equipped one doesn't: off. A skill no loadout names is left alone. */
async function offSkills($: Engine) {
  const { loadouts } = await load($)
  const on = new Set((await equipped($, loadouts))?.skills)
  return new Set(loadouts.flatMap(l => l.skills).filter(s => !on.has(s)))
}

async function note($: Engine) {
  const { loadouts } = await load($)
  if (!loadouts.length) return ''
  const on = await equipped($, loadouts)
  const others = loadouts.filter(l => l !== on).map(l => `${l.name} (${contents(l)})`)
  const head = on
    ? [
        `The ${on.name} loadout is equipped in this project.`,
        on.instructions && `Its instructions: ${on.instructions}`,
        `Its skills: ${list(on.skills)}. Its MCP servers: ${list(Object.keys(on.mcpServers))}${tools(on).length ? ` (the ${tools(on).join(' and ')} tools)` : ''}.`,
      ]
    : ['No loadout is equipped in this project.']
  return [
    `Loadouts (loadouts mod): ${head[0]}`,
    ...head.slice(1).filter(Boolean),
    others.length ? `Not equipped: ${others.join('; ')}. Their skills and MCP servers are off: calls to them are refused, and the skill listing leaves their skills out, so earlier turns may name skills that are off now.` : '',
    `When the work calls for another loadout, equip it with the ${EQUIP} tool; the one equipped now is unequipped.`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Why a call reaching this mod's server `server` is refused, or undefined when its loadout is equipped. */
async function refusal($: Engine, server: string) {
  const { loadouts } = await load($)
  const on = await equipped($, loadouts)
  if (on && Object.hasOwn(on.mcpServers, server)) return undefined
  const owners = loadouts.filter(l => Object.hasOwn(l.mcpServers, server)).map(l => l.name)
  const now = on ? `${on.name} is equipped` : 'no loadout is equipped'
  return owners.length
    ? `The ${server} server is in the ${owners.join(' and ')} loadout and ${now}: if the task needs it, equip ${owners[0]} with the ${EQUIP} tool.`
    : `No loadout has a ${server} server any more, and ${now}.`
}

const skillOff = (name: string) => `The ${name} skill is in a loadout that isn't equipped in this project, so it is off: if the task needs it, equip its loadout with the ${EQUIP} tool.`

/** The mod's server a call reaches: by its own tool name, or by the `server` the MCP resource tools take (`plugin:loadouts:supabase`). */
function target(tool: string, input: unknown) {
  if (tool.startsWith(PREFIX)) return tool.slice(PREFIX.length).split('__')[0]
  const named = (input as { server?: unknown } | null)?.server
  const m = typeof named === 'string' ? /^plugin[:_]loadouts[:_](.+)$/.exec(named) : null
  return m?.[1]
}

/** A resource listing that names no server reaches every server, unequipped loadouts' included, so it is refused. */
const unnamed = (tool: string, input: unknown) => tool === 'ListMcpResourcesTool' && !(input as { server?: unknown } | null)?.server

/** Equips `name` in this project, unequipping the one before. */
async function equip($: Engine, name: string) {
  const { loadouts } = await load($)
  if (!loadouts.some(l => l.name === name)) return `There's no loadout named ${name}: ${list(loadouts.map(l => l.name))}.`
  const root = await $.session.root()
  const all = await get<Equipped>($, 'equipped', {})
  const was = all[root]
  await $.store.set('equipped', { ...all, [root]: name })
  // A loadout file gained or changed a server since the start: that one needs the engine to reload the manifest.
  if (await sync($, loadouts)) reload($)
  $.ui.status(`loadout: ${name}`)
  // Claude's note and the skill listing it already holds change from the next request on.
  $.ui.invalidate('prompt.section')
  $.ui.invalidate('prompt.attachment')
  $.ui.invalidate('ui.render')
  return was && was !== name ? `Unequipped ${was}; equipped ${name} in ${root}.` : `Equipped ${name} in ${root}.`
}

const pad = (n: number) => String(n).padStart(2, '0')
/** `loadout-20261024-151830`: the capture's moment in local time, within the name rules. */
const stamp = (d: Date) => `loadout-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`

/** Saves what is in effect here, the equipped loadout's skills, servers and instructions, as a new loadout file. */
async function capture($: Engine) {
  const { loadouts } = await load($)
  const now = await equipped($, loadouts)
  const name = stamp(new Date())
  const path = `${$.plugin.root}/${DIR}/${name}.json`
  if (loadouts.some(l => l.name === name) || (await $.fs.exists(path))) throw new Error(`${name} already exists`)
  const loadout: Loadout = { name, skills: now?.skills ?? [], mcpServers: now?.mcpServers ?? {}, instructions: now?.instructions ?? '' }
  await $.fs.write(path, `${JSON.stringify(loadout, null, 2)}\n`)
  return name
}

/** Opens the picker, or resizes the open one, to fit `count` loadouts: two rows each, the button and the hint. */
const picker = ($: Engine, count: number) => $.ui.open({ id: PANE, title: 'Loadouts', focus: true, closeOnEscape: true, rows: count * 2 + 2 })

/** What /loadout records when it opens the picker: no ●, since a pick in the pane would leave it stale in the transcript. */
async function summary($: Engine) {
  const { loadouts, problems } = await load($)
  const rows = loadouts.map(l => `${l.name}   ${contents(l)}`)
  return [rows.length ? rows.join('\n') : `No loadouts in ${$.plugin.root}/${DIR}.`, ...problems.map(p => `Skipped ${p}.`)].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'loadout', description: 'Equip a loadout of skills, MCP servers and instructions in this project', argumentHint: '[<loadout>]' })
    await $.tool.register({
      name: 'equip',
      description: "Equips a loadout in this project: its skills, MCP servers and instructions go into effect and the previously equipped loadout's go out. The system prompt's Loadouts note lists the loadouts.",
      inputSchema: { type: 'object', properties: { loadout: { type: 'string', description: "The loadout's name" } }, required: ['loadout'] },
      isDeferred: false,
    })
    const { loadouts, problems } = await load($)
    for (const p of problems) $.ui.log(`skipped ${p}`)
    if (await sync($, loadouts)) reload($)
    const now = await equipped($, loadouts)
    $.ui.status(now && `loadout: ${now.name}`)
    return next(e)
  })

  // Refused, never waved through, when the check itself fails: the call could reach an unequipped loadout's server.
  on('tool.check', async ($, e, next) => {
    if (unnamed(e.tool, e.input)) {
      return { decision: 'deny', reason: "Name a server: loadouts refuses a listing of every server's resources, which could include a loadout that isn't equipped." }
    }
    const named = e.tool === 'Skill' ? (e.input as { skill?: unknown } | null)?.skill : undefined
    if (typeof named === 'string' && (await offSkills($)).has(named)) return { decision: 'deny', reason: skillOff(named) }
    const server = target(e.tool, e.input)
    const reason = server && (await refusal($, server))
    return reason ? { decision: 'deny', reason } : next(e)
  }).catch(($, e, next) => (target(e.tool, e.input) ? { decision: 'deny', reason: 'loadouts could not tell which loadout is equipped.' } : next(e)))

  on('tool.call', { tool: EQUIP }, async ($, e) => {
    const name = (e as { loadout?: unknown }).loadout
    return { result: typeof name === 'string' ? await equip($, name) : 'Name the loadout to equip.' }
  })

  // A skill typed as /name or preloaded; the Skill tool is refused before this, at tool.check.
  on('skill.prompt', async ($, e, next) => ((await offSkills($)).has(e.skill) ? { text: skillOff(e.skill) } : next(e)))

  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    const r = await next(e)
    const off = await offSkills($)
    if (r.text === null || !off.size) return r
    const isOff = (line: string) => [...off].some(s => line === `- ${s}` || line.startsWith(`- ${s}:`) || line.startsWith(`- ${s} `))
    return { text: r.text.split('\n').filter(line => !isOff(line)).join('\n') }
  }).catch(($, e, next) => next(e))

  // A section, not prompt.compose: the engine keeps the system prompt it composed, and asks a section again on invalidate.
  on('prompt.section', { name: 'env_info_simple' }, async ($, e, next) => {
    const r = await next(e)
    const n = await note($)
    return n ? { text: [r.text, n].filter(Boolean).join('\n\n') } : r
  }).catch(($, e, next) => next(e))

  // The picker: a row per loadout, ● on the one equipped here, its skills and servers beneath. Enter equips and closes;
  // Save as loadout copies what's equipped into a new file, which the list then shows, and the pane stays open.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const { loadouts } = await load($)
    const now = await equipped($, loadouts)
    const pick = async (name: string) => {
      await equip($, name)
      await $.ui.close({ id: PANE })
    }
    const save = async () => {
      try {
        $.ui.toast(`Saved ${await capture($)}`)
        await picker($, loadouts.length + 1)
      } catch (err) {
        $.ui.log(`could not save the loadout (${String(err)})`)
      }
      $.ui.invalidate('ui.render')
    }
    const rows = []
    for (const l of loadouts) {
      rows.push(<Button key={l.name} plain label={`${l === now ? '●' : ' '} ${l.name}`} {...(l === now ? { autoFocus: true as const } : {})} onPress={() => pick(l.name)} />)
      rows.push(<Text dimColor>{`  ${contents(l)}`}</Text>)
    }
    return (
      <Box flexDirection="column">
        {rows.length ? rows : <Text dimColor>No loadouts in {`${$.plugin.root}/${DIR}`}</Text>}
        <Button key="save" label="Save as loadout" onPress={save} />
        <Text dimColor>Enter equips · Esc closes</Text>
      </Box>
    )
  })

  on('command.run', { command: 'loadout' }, async ($, e) => {
    const name = e.args.trim()
    if (name) return { text: await equip($, name) }
    await picker($, (await load($)).loadouts.length)
    return { text: await summary($) }
  })
}
