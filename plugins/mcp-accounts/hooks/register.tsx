import type { EngineInterface, Register } from 'claude-code'

type Engine = EngineInterface
/** What every account of a service is cloned from: its remote MCP server, and the OAuth client it signs in with when that is fixed. */
type Service = { url: string; oauth?: { clientId: string; callbackPort: number } }
/** Account names per service. */
type Accounts = Record<string, string[]>
/** Per project root, the accounts each service uses there. */
type Active = Record<string, Record<string, string[]>>

/** Copied from the official Slack and Supabase plugins; anything else is added by URL. */
export const BUILT_IN: Record<string, Service> = {
  slack: { url: 'https://mcp.slack.com/mcp', oauth: { clientId: '1601185624273.8899143856786', callbackPort: 3118 } },
  supabase: { url: 'https://mcp.supabase.com/mcp' },
}

/** How the engine names this mod's servers' tools: `mcp__plugin_mcp-accounts_<service>-<account>__<tool>`. */
const PREFIX = 'mcp__plugin_mcp-accounts_'
/** Signing an account in acts on no workspace, so it is never blocked. */
const SIGN_IN = new Set(['authenticate', 'complete_authentication'])
const SERVICE = /^[a-z0-9]+$/
const LABEL = /^[a-z0-9][a-z0-9-]{0,29}$/
const VERBS = new Set(['add', 'remove'])
const FILE = 'accounts.mcp.json'

const USAGE = `/account                                  pick in a pane; also lists accounts, * on those this project uses
/account <service> <account> [<account>…]  use those accounts in this project; the rest stay blocked
/account add <service> <account> [url]    add an account (the URL for a service other than ${Object.keys(BUILT_IN).join(' or ')})
/account remove <service> <account>       remove one`

const get = async <T,>($: Engine, key: string, empty: T) => ((await $.store.get(key)) ?? empty) as T
const services = async ($: Engine) => ({ ...BUILT_IN, ...(await get<Record<string, Service>>($, 'services', {})) })
const and = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)
const tools = (service: string, labels: readonly string[]) => labels.map(l => `${PREFIX}${service}-${l}__*`).join(' and ')

/** The accounts a service uses in this project: the ones chosen here, else its only one. */
async function inUse($: Engine, service: string) {
  const labels = (await get<Accounts>($, 'accounts', {}))[service] ?? []
  const chosen = [(await get<Active>($, 'active', {}))[await $.session.root()]?.[service] ?? []].flat().filter(l => labels.includes(l))
  return chosen.length ? chosen : labels.length === 1 ? labels : []
}

/** One server per account. The URL carries the account, since the engine runs servers that share a URL as one, under one login. */
export function servers(accounts: Accounts, known: Record<string, Service>) {
  const mcpServers: Record<string, unknown> = {}
  for (const service of Object.keys(accounts).sort()) {
    const s = known[service]
    if (!s) continue
    for (const label of [...accounts[service]!].sort()) {
      mcpServers[`${service}-${label}`] = { type: 'http', url: `${s.url}${s.url.includes('?') ? '&' : '?'}account=${label}`, ...(s.oauth && { oauth: s.oauth }) }
    }
  }
  return { mcpServers }
}

/** Writes the manifest's server list from the stored accounts: true when it changed, and the engine has to reload it. */
async function sync($: Engine) {
  const text = `${JSON.stringify(servers(await get($, 'accounts', {}), await services($)), null, 2)}\n`
  const path = `${$.plugin.root}/${FILE}`
  if ((await $.fs.read(path).catch(() => '')) === text) return false
  await $.fs.write(path, text)
  return true
}

/** At a start only: run from a command's hook, the host refuses it while that hook holds the turn. */
function reload($: Engine) {
  $.clock.after(0, () => void $.command.run({ command: 'reload-plugins' }).catch(err => $.ui.log(`could not reload the account servers (${String(err)}): run /reload-plugins`)))
}

async function status($: Engine) {
  const parts: string[] = []
  for (const service of Object.keys(await get<Accounts>($, 'accounts', {})).sort()) parts.push(`${service}:${(await inUse($, service)).join('+') || '?'}`)
  $.ui.status(parts.length ? parts.join(' · ') : undefined)
}

async function note($: Engine) {
  const lines: string[] = []
  for (const [service, labels] of Object.entries(await get<Accounts>($, 'accounts', {}))) {
    const a = await inUse($, service)
    lines.push(
      a.length === 1
        ? `${service} uses its ${a[0]} account in this project: the ${tools(service, a)} tools.`
        : a.length
          ? `${service} uses its ${and(a)} accounts in this project (the ${tools(service, a)} tools): use the one the task names, and ask the person when it doesn't say.`
          : `${service} has several accounts (${labels.join(', ')}) and none is chosen for this project: ask the person which, and they pick with /account ${service} <account>.`,
    )
  }
  return lines.length ? `MCP accounts (mcp-accounts): ${lines.join(' ')} A call to any other account's tools is refused; only the person changes which accounts are in use.` : ''
}

/** Why a call reaching one of this mod's servers (`slack-foo`) through tool `name` is refused, or undefined when it may go ahead. */
async function refusal($: Engine, server: string, name: string) {
  if (SIGN_IN.has(name)) return undefined
  const cut = server.indexOf('-')
  const service = server.slice(0, cut)
  const label = server.slice(cut + 1)
  const a = await inUse($, service)
  if (cut > 0 && a.includes(label)) return undefined
  return a.length
    ? `This project uses ${service} ${and(a)}, not ${label}: use the ${tools(service, a)} tools, or ask the person to add ${label} with /account ${service} ${[...a, label].join(' ')}.`
    : `No ${service} account is chosen for this project: ask the person which to use; they pick with /account ${service} <account>.`
}

/** The mod's server a call reaches: by its own tool name, or by the `server` the MCP resource tools take (`plugin:mcp-accounts:slack-foo`). */
function target(tool: string, input: unknown) {
  if (tool.startsWith(PREFIX)) {
    const [server = '', name = ''] = tool.slice(PREFIX.length).split('__')
    return { server, name }
  }
  const named = (input as { server?: unknown } | null)?.server
  const m = typeof named === 'string' ? /^plugin[:_]mcp-accounts[:_](.+)$/.exec(named) : null
  return m ? { server: m[1]!, name: '' } : undefined
}

/**
 * A resource listing that names no server reaches every server, so it is always refused: whether one of this mod's
 * is loaded for an account not in use can't be told reliably (a removed account's stays until the reload, and a
 * server with resources but no tools leaves no trace in the tool list).
 */
const unnamed = (tool: string, input: unknown) => tool === 'ListMcpResourcesTool' && !(input as { server?: unknown } | null)?.server

async function list($: Engine) {
  const accounts = await get<Accounts>($, 'accounts', {})
  const rows: string[] = []
  for (const service of Object.keys(accounts).sort()) {
    const a = await inUse($, service)
    for (const label of accounts[service]!) {
      const c = await $.mcp.connect(`${service}-${label}`)
      const state = c.isConnected ? 'connected' : c.reason === 'auth' ? `sign in: /mcp → plugin:mcp-accounts:${service}-${label} → Authenticate` : c.message
      rows.push(`${a.includes(label) ? '*' : ' '} ${service} · ${label}   ${state}`)
    }
  }
  return rows.length ? `${rows.join('\n')}\n\nMarked *: in use in ${await $.session.root()}` : `No accounts yet.\n\n${USAGE}`
}

async function add($: Engine, service: string, label: string, url?: string) {
  if (!SERVICE.test(service) || VERBS.has(service)) return `A service name is lowercase letters and digits, and not add or remove: "${service}" isn't one.`
  if (!LABEL.test(label)) return `An account name is up to 30 lowercase letters, digits and dashes: "${label}" isn't one.`
  const known = await services($)
  if (url) {
    let u: URL
    try {
      u = new URL(url)
    } catch {
      return `"${url}" isn't a URL.`
    }
    if (u.protocol !== 'https:') return 'The server URL has to be https.'
    if (known[service] && known[service].url !== url) return `${service} already points at ${known[service].url}: add the account without a URL, or name a new service.`
    if (!known[service]) await $.store.set('services', { ...(await get($, 'services', {})), [service]: { url } })
  } else if (!known[service]) {
    return `${service} is new: give its MCP server's URL with the first account, /account add ${service} ${label} https://…`
  }
  const accounts = await get<Accounts>($, 'accounts', {})
  if (accounts[service]?.includes(label)) return `${service} · ${label} is already added.`
  await $.store.set('accounts', { ...accounts, [service]: [...(accounts[service] ?? []), label] })
  await sync($)
  await status($)
  return `Added ${service} · ${label}. Run /reload-plugins to load it, then sign it in: /mcp → plugin:mcp-accounts:${service}-${label} → Authenticate, and pick that workspace, or log in as that account, in the browser.`
}

async function remove($: Engine, service: string, label: string) {
  const accounts = await get<Accounts>($, 'accounts', {})
  const left = (accounts[service] ?? []).filter(l => l !== label)
  if (left.length === (accounts[service] ?? []).length) return `There's no ${service} account named ${label}.`
  const { [service]: _, ...others } = accounts
  await $.store.set('accounts', left.length ? { ...accounts, [service]: left } : others)
  // A service added by URL goes with its last account; adding it again takes the URL again.
  if (!left.length) {
    const { [service]: _gone, ...kept } = await get<Record<string, Service>>($, 'services', {})
    await $.store.set('services', kept)
  }
  await sync($)
  await status($)
  return `Removed ${service} · ${label}; /reload-plugins drops its server. Claude Code keeps its stored sign-in, so adding the account again reuses it.`
}

/** Sets the accounts a service uses in this project; the project root it set them for. */
async function choose($: Engine, service: string, labels: readonly string[]) {
  const root = await $.session.root()
  const all = await get<Active>($, 'active', {})
  await $.store.set('active', { ...all, [root]: { ...all[root], [service]: [...new Set(labels)] } })
  await status($)
  // Claude's note names the accounts in use: it changes from the next request on.
  $.ui.invalidate('prompt.section')
  $.ui.invalidate('ui.render')
  return root
}

async function use($: Engine, service: string, picked: readonly string[]) {
  const labels = (await get<Accounts>($, 'accounts', {}))[service] ?? []
  if (!labels.length) return `No ${service} accounts yet: /account add ${service} <account>.`
  if (!picked.length) return `${service}: ${labels.join(', ')}. /account ${service} <account> [<account>…] picks for this project.`
  const unknown = picked.filter(l => !labels.includes(l))
  if (unknown.length) return `There's no ${service} account named ${and(unknown)}: ${labels.join(', ')}.`
  return `${service} → ${and(picked)} in ${await choose($, service, picked)}.`
}

const PANE = 'accounts'

async function picker($: Engine) {
  const accounts = await get<Accounts>($, 'accounts', {})
  const rows = Object.values(accounts).reduce((n, labels) => n + labels.length + 1, 2)
  await $.ui.open({ id: PANE, title: 'MCP accounts', focus: true, closeOnEscape: true, rows })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'account', description: 'Pick which logins an MCP service uses in this project, or add one', argumentHint: '[<service> <account>… | add <service> <account> [url] | remove <service> <account>]' })
    if (await sync($)) reload($)
    await status($)
    return next(e)
  })

  // Refused, never waved through, when the check itself fails: the call could reach the wrong workspace.
  on('tool.check', async ($, e, next) => {
    if (unnamed(e.tool, e.input)) {
      return { decision: 'deny', reason: "Name a server: mcp-accounts refuses a listing of every server's resources, which could include an MCP account this project doesn't use." }
    }
    const t = target(e.tool, e.input)
    const reason = t && (await refusal($, t.server, t.name))
    return reason ? { decision: 'deny', reason } : next(e)
  }).catch(($, e, next) => (target(e.tool, e.input) ? { decision: 'deny', reason: 'mcp-accounts could not tell which account this project uses.' } : next(e)))

  // The picker: each service, then a row per account, ● on those this project uses. The name uses that account alone
  // and closes; beside it, + adds it to those in use and − drops it, the pane staying open.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const accounts = await get<Accounts>($, 'accounts', {})
    const only = async (service: string, label: string) => {
      await choose($, service, [label])
      await $.ui.close({ id: PANE })
    }
    const toggle = async (service: string, label: string) => {
      const a = await inUse($, service)
      await choose($, service, a.includes(label) ? a.filter(l => l !== label) : [...a, label])
    }
    const rows = []
    for (const service of Object.keys(accounts).sort()) {
      const labels = accounts[service]!
      const a = await inUse($, service)
      const width = Math.max(...labels.map(l => l.length)) + 3
      rows.push(<Text bold>{service}</Text>)
      for (const label of labels) {
        const used = a.includes(label)
        rows.push(
          <Box flexDirection="row">
            <Box width={width}>
              <Button key={`${service}-${label}`} plain label={`${used ? '●' : ' '} ${label}`} {...(used ? { autoFocus: true as const } : {})} onPress={() => only(service, label)} />
            </Box>
            {labels.length > 1 && <Button key={`${service}-${label}+`} plain dimColor label={used ? '−' : '+'} onPress={() => toggle(service, label)} />}
          </Box>,
        )
      }
    }
    return (
      <Box flexDirection="column">
        {rows.length ? rows : <Text dimColor>No accounts yet: /account add {'<service> <account>'}</Text>}
        <Text dimColor>Enter on a name uses only it · + adds, − drops · Esc closes</Text>
      </Box>
    )
  })

  on('prompt.section', { name: 'env_info_simple' }, async ($, e, next) => {
    const r = await next(e)
    const n = await note($)
    return n ? { text: [r.text, n].filter(Boolean).join('\n\n') } : r
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'account' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/).filter(Boolean)
    const [service = '', label = '', url] = rest
    if (!verb) {
      await picker($)
      return { text: await list($) }
    }
    if (verb === 'add') return { text: service && label ? await add($, service, label, url) : USAGE }
    if (verb === 'remove') return { text: service && label ? await remove($, service, label) : USAGE }
    return { text: await use($, verb, rest) }
  })
}
