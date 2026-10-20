// Finds secrets, and PII when asked, in a piece of text. Every quantifier is bounded, so a hostile row cannot stall a scan.
import { envName, nameBefore } from './naming'
import { PII } from './pii'

export type Kind = 'secret' | 'pii'
export type Hit = { start: number; end: number; value: string; rule: string; kind: Kind; name: string }
export type Rule = {
  id: string
  kind: Kind
  /** The env var a hit is stored under when the text around it names none */
  name: string
  re: RegExp
  /** Capture group holding the value; 0 is the whole match */
  group?: number
  check?: (value: string) => boolean
  /** Use a NAME= before the hit when there is one */
  named?: boolean
}

// A token's edges: not glued to more token characters on either side.
const L = '(?<![A-Za-z0-9_-])'
const R = '(?![A-Za-z0-9_-])'

// Prefix formats as each provider documents them. Order breaks ties between rules matching the same span.
const PROVIDERS: Array<[id: string, name: string, pattern: string]> = [
  ['anthropic', 'ANTHROPIC_API_KEY', 'sk-ant-[a-z]{2,8}\\d{2}-[A-Za-z0-9_-]{32,200}'],
  ['openai', 'OPENAI_API_KEY', 'sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{8,200}T3BlbkFJ[A-Za-z0-9_-]{8,200}'],
  ['openai-scoped', 'OPENAI_API_KEY', 'sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,250}'],
  ['openrouter', 'OPENROUTER_API_KEY', 'sk-or-v1-[a-f0-9]{64}'],
  ['elevenlabs', 'ELEVENLABS_API_KEY', 'sk_[a-f0-9]{48}'],
  ['deepseek', 'DEEPSEEK_API_KEY', 'sk-[a-f0-9]{32}'],
  ['aws-access-key', 'AWS_ACCESS_KEY_ID', '(?:AKIA|ASIA|ABIA|ACCA)[A-Z2-7]{16}'],
  ['github', 'GITHUB_TOKEN', 'gh[pousr]_[A-Za-z0-9]{36,251}'],
  ['github-fine-grained', 'GITHUB_TOKEN', 'github_pat_[A-Za-z0-9_]{82}'],
  ['gitlab', 'GITLAB_TOKEN', 'gl(?:pat|dt|ptt|rt|oas)-[A-Za-z0-9_.-]{20,80}'],
  ['slack', 'SLACK_TOKEN', 'xox[abposre]-[A-Za-z0-9-]{10,250}'],
  ['slack-webhook', 'SLACK_WEBHOOK_URL', 'https://hooks\\.slack\\.com/(?:services|workflows|triggers)/[A-Za-z0-9_/-]{20,200}'],
  ['stripe', 'STRIPE_SECRET_KEY', '(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,250}'],
  ['stripe-webhook', 'STRIPE_WEBHOOK_SECRET', 'whsec_[A-Za-z0-9+/=]{32,100}'],
  ['sendgrid', 'SENDGRID_API_KEY', 'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}'],
  ['twilio', 'TWILIO_API_KEY', 'SK[a-f0-9]{32}'],
  ['google', 'GOOGLE_API_KEY', 'AIza[A-Za-z0-9_-]{35}'],
  ['google-oauth', 'GOOGLE_CLIENT_SECRET', 'GOCSPX-[A-Za-z0-9_-]{28}'],
  ['supabase-pat', 'SUPABASE_ACCESS_TOKEN', 'sbp_[a-f0-9]{40}'],
  ['supabase-secret', 'SUPABASE_SECRET_KEY', 'sb_secret_[A-Za-z0-9_-]{20,80}'],
  ['posthog', 'POSTHOG_PERSONAL_API_KEY', 'phx_[A-Za-z0-9]{40,60}'],
  ['xai', 'XAI_API_KEY', 'xai-[A-Za-z0-9]{70,90}'],
  ['groq', 'GROQ_API_KEY', 'gsk_[A-Za-z0-9]{52}'],
  ['replicate', 'REPLICATE_API_TOKEN', 'r8_[A-Za-z0-9]{37}'],
  ['perplexity', 'PERPLEXITY_API_KEY', 'pplx-[A-Za-z0-9]{48}'],
  ['huggingface', 'HF_TOKEN', 'hf_[A-Za-z]{34}'],
  ['npm', 'NPM_TOKEN', 'npm_[A-Za-z0-9]{36}'],
  ['pypi', 'PYPI_TOKEN', 'pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,300}'],
  ['linear', 'LINEAR_API_KEY', 'lin_api_[A-Za-z0-9]{40}'],
  ['notion', 'NOTION_TOKEN', '(?:ntn_[A-Za-z0-9]{40,50}|secret_[A-Za-z0-9]{43})'],
  ['resend', 'RESEND_API_KEY', 're_[A-Za-z0-9]{8}_[A-Za-z0-9]{24}'],
  ['shopify', 'SHOPIFY_ACCESS_TOKEN', 'shp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}'],
  ['databricks', 'DATABRICKS_TOKEN', 'dapi[a-f0-9]{32}(?:-\\d)?'],
  ['sentry', 'SENTRY_AUTH_TOKEN', '(?:sntrys_[A-Za-z0-9+/=_-]{60,400}|sntryu_[a-f0-9]{64})'],
  ['discord-bot', 'DISCORD_BOT_TOKEN', '[MN][A-Za-z0-9_-]{23,25}\\.[A-Za-z0-9_-]{6}\\.[A-Za-z0-9_-]{27,38}'],
  ['discord-webhook', 'DISCORD_WEBHOOK_URL', 'https://(?:ptb\\.|canary\\.)?discord(?:app)?\\.com/api/webhooks/\\d{5,30}/[A-Za-z0-9_-]{50,100}'],
  ['telegram', 'TELEGRAM_BOT_TOKEN', '\\d{8,10}:AA[A-Za-z0-9_-]{33}'],
  ['mailgun', 'MAILGUN_API_KEY', 'key-[a-f0-9]{32}'],
  ['mailchimp', 'MAILCHIMP_API_KEY', '[a-f0-9]{32}-us\\d{1,2}'],
  ['doppler', 'DOPPLER_TOKEN', 'dp\\.(?:pt|st|sa|ct|scim|audit)\\.[A-Za-z0-9]{40,44}'],
  ['digitalocean', 'DIGITALOCEAN_TOKEN', 'do[opr]_v1_[a-f0-9]{64}'],
  ['mapbox', 'MAPBOX_SECRET_TOKEN', 'sk\\.eyJ[A-Za-z0-9_-]{30,300}\\.[A-Za-z0-9_-]{20,30}'],
  ['fireworks', 'FIREWORKS_API_KEY', 'fw_[A-Za-z0-9]{24}'],
  ['figma', 'FIGMA_TOKEN', 'figd_[A-Za-z0-9_-]{40,60}'],
  ['atlassian', 'ATLASSIAN_API_TOKEN', 'ATATT3[A-Za-z0-9_=-]{150,250}'],
  ['square', 'SQUARE_ACCESS_TOKEN', '(?:EAAA[A-Za-z0-9_-]{60}|sq0csp-[A-Za-z0-9_-]{43})'],
  ['age', 'AGE_SECRET_KEY', 'AGE-SECRET-KEY-1[0-9A-Z]{58}'],
]

// Passwords people leave in local connection strings on purpose; hiding them only gets in the way.
const DEV_PASSWORDS = new Set(['password', 'pass', 'postgres', 'root', 'admin', 'secret', 'test', 'example', 'changeme', 'mysql', 'guest'])

const urlPassword = (url: string): boolean => {
  const m = /^[^:]+:\/\/([^:/@]*):([^@]*)@/.exec(url)
  const [user, pass] = [m?.[1] ?? '', m?.[2] ?? '']
  return (
    pass.length >= 6 &&
    pass !== user &&
    (/\d/.test(pass) || pass.length >= 16) &&
    !/pass(?:word)?/i.test(pass) &&
    !DEV_PASSWORDS.has(pass.toLowerCase()) &&
    !isTemplate(pass)
  )
}

/**
 * A value with no prefix to go on must look generated: a letter and a digit, 3+ bits of entropy per character,
 * not a reference or a template. Constants (`MF-Proxy-Shared-Secret`), member access (`this.authStorage`) and
 * doc samples have no digit; generated keys almost always do.
 */
export const looksSecret = (v: string) =>
  /\d/.test(v) &&
  /[A-Za-z]/.test(v) &&
  // short test values (`token-1a`, `abcd1234`) stay; a short real password mixes cases
  (v.length >= 12 || (/[a-z]/.test(v) && /[A-Z]/.test(v))) &&
  !isTemplate(v) &&
  !wordy(v) &&
  entropy(v) >= 3

/**
 * Made of words, so a name rather than a key: `EthereumWeb3Credentials`, `x-d1-session-commit-token`.
 * Words are 3+ letter runs with a vowel; a generated key splits into short, mostly vowel-less runs.
 */
export function wordy(v: string): boolean {
  const runs = v.split(/[^A-Za-z]+|(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/).filter(Boolean)
  const letters = runs.reduce((n, r) => n + r.length, 0)
  const words = runs.filter(r => r.length >= 3 && /[aeiouy]/i.test(r))
  return words.length >= 2 && words.reduce((n, r) => n + r.length, 0) >= 0.7 * letters
}

export const RULES: Rule[] = [
  ...PROVIDERS.map(([id, name, pattern]): Rule => ({ id, kind: 'secret', name, re: new RegExp(`${L}${pattern}${R}`, 'g'), named: true })),
  {
    id: 'private-key',
    kind: 'secret',
    name: 'PRIVATE_KEY',
    re: /-----BEGIN ((?:[A-Z0-9]{1,12} ){0,3})PRIVATE KEY(?: BLOCK)?-----[\s\S]{20,65536}?-----END \1PRIVATE KEY(?: BLOCK)?-----/g,
    named: true,
  },
  {
    // A key cut off before its END line (head of a file, a truncated log) still leaks its body.
    id: 'private-key-partial',
    kind: 'secret',
    name: 'PRIVATE_KEY',
    re: /-----BEGIN (?:[A-Z0-9]{1,12} ){0,3}PRIVATE KEY(?: BLOCK)?-----(?:\r?\n|\\n)[A-Za-z0-9+/=\r\n\\]{40,65536}/g,
    named: true,
  },
  { id: 'jwt', kind: 'secret', name: 'JWT', re: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{8,2000}\.eyJ[A-Za-z0-9_-]{8,8000}\.[A-Za-z0-9_-]{16,2000}(?![A-Za-z0-9_-])/g, named: true },
  {
    id: 'url-credentials',
    kind: 'secret',
    name: 'DATABASE_URL',
    re: /(?<![A-Za-z0-9+.-])[a-z][a-z0-9+.-]{1,20}:\/\/[^\s:/@'"`<>]{1,256}:[^\s@/'"`<>]{1,256}@[^\s'"`<>]{1,2048}/g,
    check: urlPassword,
    named: true,
  },
  {
    id: 'auth-header',
    kind: 'secret',
    name: 'AUTH_TOKEN',
    re: /(?:proxy-)?authorization["']?\s{0,4}[:=]\s{0,4}["']?(?:bearer|basic|token)\s{1,4}([A-Za-z0-9._~+/=-]{16,4096})/gi,
    group: 1,
    check: looksSecret,
  },
  {
    id: 'api-key-header',
    kind: 'secret',
    name: 'API_KEY',
    re: /(?:x-api-key|xi-api-key|api-key|apikey|x-auth-token)["']?\s{0,4}:\s{0,4}["']?([A-Za-z0-9._~+/=-]{16,1024})/gi,
    group: 1,
    check: looksSecret,
  },
]

const SECRET_NAME = /(?:^|_)(?:API_?KEY|SECRET|SECRETS|TOKEN|PASSWORD|PASSWD|PWD|PASS|CREDENTIALS?|PRIVATE_?KEY|ACCESS_?KEY|AUTH_?KEY|AUTH|CLIENT_?SECRET|SIGNING_?KEY|ENCRYPTION_?KEY|MASTER_?KEY|SERVICE_?ROLE(?:_?KEY)?)(?:_|$)/
const ASSIGNMENT = /(?<![A-Za-z0-9_.-])(?:export\s{1,4})?(["']?)([A-Za-z_][A-Za-z0-9_.-]{0,80})\1\s{0,4}(?::=|=>|:|=)\s{0,4}(["'`]?)([^\s"'`]{8,512})\3/g

/** A value that stands for a secret instead of being one: a reference, a template slot, a sample. */
export function isTemplate(v: string): boolean {
  return (
    /^(?:\$|%|\{\{|<|@|~|\.{0,2}\/|process\.env|os\.environ|env\(|import\.meta|https?:)/i.test(v) ||
    /\[(?:secret|pii):/.test(v) ||
    /^(?:true|false|null|none|undefined|nil|string|number|boolean|required|optional)[;,]?$/i.test(v) ||
    /^(.)\1*$/.test(v) ||
    /x{4,}|\*{3,}|\.{3}|<|>|\$\{|changeme|placeholder|example|dummy|sample|redacted|passw(?:or)?d|secret|test|fake|mock|demo|your[-_]?(?:api[-_]?)?(?:key|token)/i.test(v) ||
    // code, not a value: a member access, a call, an index
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+[;,]?$/.test(v) ||
    /[()[\]{};]/.test(v)
  )
}

/** Shannon entropy in bits per character. */
export function entropy(v: string): number {
  const counts = new Map<string, number>()
  for (const c of v) counts.set(c, (counts.get(c) ?? 0) + 1)
  let bits = 0
  for (const n of counts.values()) bits -= (n / v.length) * Math.log2(n / v.length)
  return bits
}

/** A bare value assigned to a name that says it is secret: `OPENAI_KEY=…`, `password: "…"`, `apiKey = '…'`. */
function assignments(text: string): Hit[] {
  const hits: Hit[] = []
  for (const m of text.matchAll(ASSIGNMENT)) {
    const name = envName(m[2]!)
    const value = m[4]!
    // Unquoted, it is an env file, YAML or a shell line: their values don't carry code punctuation (`,` `$` `|` `&` `?`, brackets), minified JS does.
    if (!m[3] && (/[,$|&?(){}[\];<>\\]/.test(value) || value.startsWith('!'))) continue
    if (!SECRET_NAME.test(name) || !looksSecret(value)) continue
    const start = m.index! + m[0].length - value.length - m[3]!.length
    hits.push({ start, end: start + value.length, value, rule: 'assignment', kind: 'secret', name })
  }
  return hits
}

export type FindOptions = { pii?: boolean; off?: ReadonlySet<string> }

/** Every secret (and PII when asked) in `text`, sorted, overlaps resolved: leftmost, then longest, then rule order. */
export function find(text: string, opts: FindOptions = {}): Hit[] {
  const rules = [...RULES, ...(opts.pii ? PII : [])].filter(r => !opts.off?.has(r.id))
  const all: Array<Hit & { order: number }> = []
  rules.forEach((rule, order) => {
    for (const m of text.matchAll(rule.re)) {
      const value = m[rule.group ?? 0]
      if (!value || (rule.check && !rule.check(value))) continue
      const start = m.index! + (rule.group ? m[0].lastIndexOf(value) : 0)
      const before = rule.named && rule.kind === 'secret' ? nameBefore(text, start) : undefined
      all.push({ start, end: start + value.length, value, rule: rule.id, kind: rule.kind, name: before ?? rule.name, order })
    }
  })
  if (!opts.off?.has('assignment')) all.push(...assignments(text).map(h => ({ ...h, order: rules.length })))

  all.sort((a, b) => a.start - b.start || b.end - a.end || a.order - b.order)
  const kept: Hit[] = []
  let reach = -1
  for (const { order: _, ...h } of all) {
    if (h.start < reach) continue
    kept.push(h)
    reach = h.end
  }
  return kept
}
