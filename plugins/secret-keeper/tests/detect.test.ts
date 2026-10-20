import { describe, expect, test } from 'claude-code/testing'

import { entropy, find, isTemplate, RULES } from '../hooks/detect'
import { envName, nameBefore } from '../hooks/naming'
import { abn, iban, luhn, medicare, tfn } from '../hooks/pii'
import { ALNUM, chars, HEX, join, jwt, pem, PROVIDER_FAKES } from './fakes'

const only = (text: string, opts = {}) => {
  const hits = find(text, opts)
  expect(hits).toHaveLength(1)
  return hits[0]!
}

describe('providers', () => {
  test('every provider rule has a fake, and finds it bare, assigned and quoted', () => {
    const ids = RULES.filter(r => r.named && r.name !== 'PRIVATE_KEY' && !['jwt', 'url-credentials'].includes(r.id)).map(r => r.id)
    expect(Object.keys(PROVIDER_FAKES).sort()).toEqual(ids.sort())
    for (const [id, make] of Object.entries(PROVIDER_FAKES)) {
      const key = make()
      for (const text of [key, `X_TOKEN=${key}`, `{"token": "${key}"}`, `curl -H 'Authorization: Bearer ${key}' https://api.example.com`]) {
        const hit = only(text)
        expect({ id, rule: hit.rule, value: hit.value }).toEqual({ id, rule: id, value: key })
      }
    }
  })

  test('a token glued to more token characters is not one', () => {
    const key = PROVIDER_FAKES.elevenlabs!()
    expect(find(`${key}0`)).toEqual([])
    expect(find(`x${key}`)).toEqual([])
    expect(find(key.slice(0, -1))).toEqual([])
  })
})

describe('names', () => {
  test('the name it was pasted with, else the provider default', () => {
    const key = PROVIDER_FAKES.elevenlabs!()
    expect(only(`ELEVENLABS_API_KEY=${key}`).name).toBe('ELEVENLABS_API_KEY')
    expect(only(`export VOICE_KEY="${key}"`).name).toBe('VOICE_KEY')
    expect(only(`"TTS_KEY": "${key}"`).name).toBe('TTS_KEY')
    expect(only(key).name).toBe('ELEVENLABS_API_KEY')
    expect(only(`apiKey: '${key}'`).name).toBe('ELEVENLABS_API_KEY')
    expect(only(`curl -H "xi-api-key: ${key}"`).name).toBe('ELEVENLABS_API_KEY')
  })

  test('envName and nameBefore', () => {
    expect(envName('apiKey')).toBe('API_KEY')
    expect(envName('db.password')).toBe('DB_PASSWORD')
    expect(envName('client-secret')).toBe('CLIENT_SECRET')
    expect(envName('2fa_secret')).toBe('_2FA_SECRET')
    const line = 'A=1\nexport MY_KEY='
    expect(nameBefore(line, line.length)).toBe('MY_KEY')
    expect(nameBefore('apiKey: ', 8)).toBeUndefined()
  })
})

describe('assignments', () => {
  test('a secret-named assignment with a secret-looking value', () => {
    const value = join(chars(ALNUM, 14), '!', chars(HEX, 6))
    const hit = only(`DB_PASSWORD=${value}`)
    expect(hit).toMatchObject({ rule: 'assignment', name: 'DB_PASSWORD', value })
    expect(only(`clientSecret = "${value}"`).name).toBe('CLIENT_SECRET')
    expect(only(`  password: '${value}',`).name).toBe('PASSWORD')
  })

  test('references, templates, code and low-entropy values are not secrets', () => {
    for (const text of [
      'password: string',
      'const token = req.headers.authorization;',
      'API_KEY=${API_KEY}',
      'api_key: process.env.OPENAI_API_KEY',
      'max_tokens=4096',
      'SECRET=changeme',
      'PASSWORD=xxxxxxxxxx',
      'token = getToken(user)',
      'AUTH_SECRET=<generate-me>',
      'SECRET_KEY={{ secrets.KEY }}',
      'password="aaaaaaaaaaaa"',
      `NEXT_PUBLIC_SUPABASE_ANON_KEY=${join('sb_', 'publishable_', 'abc123def456ghi789')}`,
      'token: [secret:GITHUB_TOKEN]',
      // from a sweep of 154k files of other people's code
      'if(e.root),this.authStorage=config.root??null',
      'PROXY_SHARED_SECRET: "MF-Proxy-Shared-Secret",',
      'export type Web3Credentials = EthereumWeb3Credentials',
      'new he,this._manuallySetToken=!1,this._x=null',
      'auth: DEFAULT_DB_OPTIONS$1,',
      "password: 'Password123_', repeatPassword: 'Password123_'",
      'const token = "token-1a"',
      'apiKey: process.env.GOOGLE_API_KEY',
      'postgres://someuser:somepassword@somehost:381/somedatabase',
    ]) {
      expect({ text, hits: find(text) }).toEqual({ text, hits: [] })
    }
  })

  test('entropy and templates', () => {
    expect(entropy('aaaa')).toBe(0)
    expect(entropy('abcd')).toBe(2)
    expect(isTemplate('$HOME')).toBe(true)
    expect(isTemplate(chars(ALNUM, 20))).toBe(false)
  })
})

describe('structure', () => {
  test('a whole PEM key, and one cut off before its END line', () => {
    const key = pem()
    expect(only(`key:\n${key}\nthat was it`)).toMatchObject({ rule: 'private-key', value: key, name: 'PRIVATE_KEY' })
    const cut = key.split('\n').slice(0, 4).join('\n')
    expect(only(cut).rule).toBe('private-key-partial')
    expect(only(JSON.stringify({ private_key: key })).rule).toBe('private-key')
  })

  test('a JWT', () => {
    const token = jwt()
    expect(only(`SUPABASE_SERVICE_ROLE_KEY=${token}`)).toMatchObject({ rule: 'jwt', name: 'SUPABASE_SERVICE_ROLE_KEY', value: token })
  })

  test('a URL with a real password, not a local default', () => {
    const pass = join(chars(ALNUM, 12), '9')
    const url = `postgres://app:${pass}@db.internal:5432/app`
    expect(only(`connect to ${url} now`)).toMatchObject({ rule: 'url-credentials', value: url, name: 'DATABASE_URL' })
    expect(only(`REDIS_URL=redis://default:${pass}@cache:6379`).name).toBe('REDIS_URL')
    expect(find('postgres://postgres:postgres@localhost:5432/db')).toEqual([])
    expect(find('postgres://user:${DB_PASSWORD}@localhost/db')).toEqual([])
  })

  test('an Authorization header with an unknown token shape', () => {
    const token = chars(ALNUM, 40)
    expect(only(`-H "Authorization: Bearer ${token}"`)).toMatchObject({ rule: 'auth-header', value: token, name: 'AUTH_TOKEN' })
  })

  test('rules can be switched off', () => {
    const key = PROVIDER_FAKES.github!()
    expect(find(key, { off: new Set(['github']) })).toEqual([])
  })
})

describe('pii', () => {
  test('off by default; on, each kind with its check digit', () => {
    const text = 'mail jo@example.org, card 4111 1111 1111 1111, IBAN GB82 WEST 1234 5698 7654 32, TFN 123 456 782, ABN 51 824 753 556, Medicare 2123 45670 1, SSN 123-45-6789, mobile 0412 345 678'
    expect(find(text)).toEqual([])
    expect(find(text, { pii: true }).map(h => h.name)).toEqual(['EMAIL', 'CARD', 'IBAN', 'TFN', 'ABN', 'MEDICARE', 'SSN', 'PHONE'])
  })

  test('checksums reject near misses', () => {
    expect(luhn('4111 1111 1111 1112')).toBe(false)
    expect(iban('GB82 WEST 1234 5698 7654 33')).toBe(false)
    expect(tfn('123 456 789')).toBe(false)
    expect(abn('51 824 753 557')).toBe(false)
    expect(medicare('2123 45671 1')).toBe(false)
  })
})

describe('performance', () => {
  test('2 MB of random base64 and 2 MB of near misses each scan in under a second', () => {
    const blob = chars(`${ALNUM}+/`, 2_000_000)
    const near = Array.from({ length: 40_000 }, () => join('sk', '_', chars(HEX, 47), ' ')).join('')
    for (const text of [blob, near]) {
      const t = performance.now()
      find(text, { pii: true })
      expect(performance.now() - t).toBeLessThan(1000)
    }
  })
})
