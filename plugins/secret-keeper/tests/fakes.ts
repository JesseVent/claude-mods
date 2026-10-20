// Fake keys built at run time from a seeded generator: nothing key-shaped sits in the source for a scanner to flag.

let seed = 0x5ec2e7
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const HEX = '0123456789abcdef'
export const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
export const URLSAFE = `${ALNUM}_-`
export const UPPER32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const chars = (alphabet: string, n: number) => Array.from({ length: n }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('')
export const join = (...parts: string[]) => parts.join('')

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** One fake per provider rule id, each the shape that rule documents. */
export const PROVIDER_FAKES: Record<string, () => string> = {
  anthropic: () => join('sk-', 'ant-api03-', chars(URLSAFE, 93), 'AA'),
  openai: () => join('sk-', 'proj-', chars(URLSAFE, 20), 'T3Blbk', 'FJ', chars(URLSAFE, 20)),
  'openai-scoped': () => join('sk-', 'svcacct-', chars(URLSAFE, 64)),
  openrouter: () => join('sk-', 'or-v1-', chars(HEX, 64)),
  elevenlabs: () => join('sk', '_', chars(HEX, 48)),
  deepseek: () => join('sk', '-', chars(HEX, 32)),
  'aws-access-key': () => join('AK', 'IA', chars(UPPER32, 16)),
  github: () => join('gh', 'p_', chars(ALNUM, 36)),
  'github-fine-grained': () => join('github', '_pat_', chars(`${ALNUM}_`, 82)),
  gitlab: () => join('gl', 'pat-', chars(URLSAFE, 20)),
  slack: () => join('xo', 'xb-', chars(HEX.slice(0, 10), 12), '-', chars(HEX.slice(0, 10), 13), '-', chars(ALNUM, 24)),
  'slack-webhook': () => join('https://hooks.', 'slack.com/services/T', chars(UPPER32, 8), '/B', chars(UPPER32, 8), '/', chars(ALNUM, 24)),
  stripe: () => join('sk', '_live_', chars(ALNUM, 99)),
  'stripe-webhook': () => join('wh', 'sec_', chars(ALNUM, 32)),
  sendgrid: () => join('S', 'G.', chars(URLSAFE, 22), '.', chars(URLSAFE, 43)),
  twilio: () => join('S', 'K', chars(HEX, 32)),
  google: () => join('AI', 'za', chars(URLSAFE, 35)),
  'google-oauth': () => join('GOC', 'SPX-', chars(URLSAFE, 28)),
  'supabase-pat': () => join('sb', 'p_', chars(HEX, 40)),
  'supabase-secret': () => join('sb_', 'secret_', chars(URLSAFE, 32)),
  posthog: () => join('ph', 'x_', chars(ALNUM, 47)),
  xai: () => join('xa', 'i-', chars(ALNUM, 80)),
  groq: () => join('gs', 'k_', chars(ALNUM, 52)),
  replicate: () => join('r8', '_', chars(ALNUM, 37)),
  perplexity: () => join('pp', 'lx-', chars(ALNUM, 48)),
  huggingface: () => join('h', 'f_', chars(ALNUM.slice(0, 52), 34)),
  npm: () => join('np', 'm_', chars(ALNUM, 36)),
  pypi: () => join('pypi-', 'AgEIcHlwaS5vcmc', chars(URLSAFE, 70)),
  linear: () => join('lin_', 'api_', chars(ALNUM, 40)),
  notion: () => join('nt', 'n_', chars(ALNUM, 46)),
  resend: () => join('r', 'e_', chars(ALNUM, 8), '_', chars(ALNUM, 24)),
  shopify: () => join('shp', 'at_', chars(HEX, 32)),
  databricks: () => join('da', 'pi', chars(HEX, 32)),
  sentry: () => join('sntr', 'ys_', chars(ALNUM, 120)),
  'discord-bot': () => join('M', chars(URLSAFE, 25), '.', chars(URLSAFE, 6), '.', chars(URLSAFE, 38)),
  'discord-webhook': () => join('https://discord.', 'com/api/webhooks/', chars('0123456789', 18), '/', chars(URLSAFE, 68)),
  telegram: () => join(chars('123456789', 10), ':A', 'A', chars(URLSAFE, 33)),
  mailgun: () => join('ke', 'y-', chars(HEX, 32)),
  mailchimp: () => join(chars(HEX, 32), '-us', '14'),
  doppler: () => join('dp', '.pt.', chars(ALNUM, 43)),
  digitalocean: () => join('do', 'p_v1_', chars(HEX, 64)),
  mapbox: () => join('s', 'k.eyJ', chars(URLSAFE, 60), '.', chars(URLSAFE, 22)),
  fireworks: () => join('f', 'w_', chars(ALNUM, 24)),
  figma: () => join('fi', 'gd_', chars(URLSAFE, 43)),
  atlassian: () => join('ATA', 'TT3', chars(URLSAFE, 180)),
  square: () => join('EA', 'AA', chars(URLSAFE, 60)),
  age: () => join('AGE-', 'SECRET-KEY-1', chars(UPPER32.slice(0, 26) + '0123456789', 58)),
}

export const pem = () => join('-----BEGIN ', 'RSA PRIVATE KEY-----\n', Array.from({ length: 6 }, () => chars(`${ALNUM}+/`, 64)).join('\n'), '\n-----END ', 'RSA PRIVATE KEY-----')

export const jwt = () => join(b64url('{"alg":"HS256","typ":"JWT"}'), '.', b64url(`{"sub":"${chars(ALNUM, 12)}","role":"service_role"}`), '.', chars(URLSAFE, 43))
