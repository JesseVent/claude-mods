// Personal data, hidden only when the `pii` option is on. Numbers with a check digit must pass it.
import type { Rule } from './detect'

const digits = (v: string) => v.replace(/\D/g, '').split('').map(Number)

export function luhn(v: string): boolean {
  const d = digits(v).reverse()
  const sum = d.reduce((s, n, i) => s + (i % 2 ? (n * 2 > 9 ? n * 2 - 9 : n * 2) : n), 0)
  return d.length >= 13 && sum % 10 === 0
}

export function iban(v: string): boolean {
  const s = v.replace(/\s/g, '')
  const moved = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55))
  let rest = 0
  for (const c of moved) rest = (rest * 10 + Number(c)) % 97
  return rest === 1
}

/** Australian tax file number: weighted sum divisible by 11. */
export function tfn(v: string): boolean {
  const d = digits(v)
  const w = [1, 4, 3, 7, 5, 8, 6, 9, 10]
  return d.length === 9 && d.reduce((s, n, i) => s + n * w[i]!, 0) % 11 === 0
}

/** Medicare card: the ninth digit checks the first eight. */
export function medicare(v: string): boolean {
  const d = digits(v)
  const w = [1, 3, 7, 9, 1, 3, 7, 9]
  return d.length >= 10 && d[0]! >= 2 && d[0]! <= 6 && w.reduce((s, x, i) => s + x * d[i]!, 0) % 10 === d[8]
}

/** Australian business number: first digit minus one, weighted sum divisible by 89. */
export function abn(v: string): boolean {
  const d = digits(v)
  const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  if (d.length !== 11) return false
  d[0]! -= 1
  return d.reduce((s, n, i) => s + n * w[i]!, 0) % 89 === 0
}

export const PII: Rule[] = [
  { id: 'email', kind: 'pii', name: 'EMAIL', re: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,8}\.[A-Za-z]{2,24}(?![A-Za-z0-9-])/g },
  { id: 'card', kind: 'pii', name: 'CARD', re: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, check: luhn },
  { id: 'iban', kind: 'pii', name: 'IBAN', re: /(?<![A-Z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}(?![A-Z0-9])/g, check: iban },
  { id: 'au-tfn', kind: 'pii', name: 'TFN', re: /(?<!\d)\d{3}[ -]?\d{3}[ -]?\d{3}(?!\d)/g, check: tfn },
  { id: 'au-medicare', kind: 'pii', name: 'MEDICARE', re: /(?<!\d)[2-6]\d{3}[ -]?\d{5}[ -]?\d(?:[ -]?\d)?(?!\d)/g, check: medicare },
  { id: 'au-abn', kind: 'pii', name: 'ABN', re: /(?<!\d)\d{2} ?\d{3} ?\d{3} ?\d{3}(?!\d)/g, check: abn },
  { id: 'us-ssn', kind: 'pii', name: 'SSN', re: /(?<!\d)(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}(?!\d)/g },
  { id: 'phone', kind: 'pii', name: 'PHONE', re: /(?<![\w+])(?:\+\d{1,3}[ -]?(?:\(\d{1,4}\)[ -]?)?\d{2,4}(?:[ -]?\d{2,4}){1,3}|\(?0[2-478]\)?[ -]?\d{4}[ -]?\d{4}|04\d{2}[ -]?\d{3}[ -]?\d{3})(?![\w])/g },
]
