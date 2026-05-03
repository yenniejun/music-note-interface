import type { Ratio } from './types'

export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a))
  b = Math.abs(Math.round(b))
  while (b) {
    ;[a, b] = [b, a % b]
  }
  return a || 1
}

export function reduce(num: number, den: number): Ratio {
  if (den === 0) throw new Error('denominator cannot be zero')
  if (den < 0) {
    num = -num
    den = -den
  }
  const g = gcd(num, den)
  return { upper: Math.round(num / g), lower: Math.round(den / g) }
}

export function ratioValue(r: Ratio): number {
  return r.upper / r.lower
}

export function multiply(a: Ratio, b: Ratio): Ratio {
  return reduce(a.upper * b.upper, a.lower * b.lower)
}

export function power(r: Ratio, n: number): Ratio {
  // built so that non-integer exponents could be supported later, but for now
  // we operate on integers and keep the result exact as a reduced fraction.
  if (!Number.isInteger(n)) {
    const v = Math.pow(ratioValue(r), n)
    return reduce(Math.round(v * 1e9), 1e9)
  }
  if (n === 0) return { lower: 1, upper: 1 }
  if (n > 0) {
    return reduce(Math.pow(r.upper, n), Math.pow(r.lower, n))
  }
  return reduce(Math.pow(r.lower, -n), Math.pow(r.upper, -n))
}

export function octaveBound(r: Ratio): Ratio {
  let { upper, lower } = r
  // 1 ≤ upper/lower ≤ 2 (both endpoints included, so 2:1 stays as 2:1)
  while (upper / lower > 2) lower *= 2
  while (upper / lower < 1) upper *= 2
  return reduce(upper, lower)
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const A4 = 440

export function noteNameFromFreq(freq: number): { name: string; octave: number; centsOffset: number } {
  if (!isFinite(freq) || freq <= 0) return { name: '–', octave: 0, centsOffset: 0 }
  const semis = 12 * Math.log2(freq / A4)
  const rounded = Math.round(semis)
  const centsOffset = (semis - rounded) * 100
  const idx = ((9 + rounded) % 12 + 12) % 12
  const octave = 4 + Math.floor((9 + rounded) / 12)
  return { name: NOTE_NAMES[idx], octave, centsOffset }
}

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, 'C♯': 1, Db: 1, 'D♭': 1,
  D: 2, 'D#': 3, 'D♯': 3, Eb: 3, 'E♭': 3,
  E: 4, F: 5, 'F#': 6, 'F♯': 6, Gb: 6, 'G♭': 6,
  G: 7, 'G#': 8, 'G♯': 8, Ab: 8, 'A♭': 8,
  A: 9, 'A#': 10, 'A♯': 10, Bb: 10, 'B♭': 10,
  B: 11,
}

export function parseNoteName(input: string): number | null {
  const m = input.trim().match(/^([A-Ga-g])([#♯b♭]?)\s*(-?\d+)$/)
  if (!m) return null
  const letter = m[1].toUpperCase() + (m[2] === '♭' ? 'b' : m[2] === '♯' ? '#' : m[2])
  const idx = NOTE_INDEX[letter]
  if (idx === undefined) return null
  const octave = parseInt(m[3], 10)
  // semitones from A4: idx is C=0…B=11; A4 is idx 9 octave 4.
  const semitonesFromA4 = (octave - 4) * 12 + (idx - 9)
  return A4 * Math.pow(2, semitonesFromA4 / 12)
}

export function centsFromTET(r: Ratio): number {
  const cents = 1200 * Math.log2(ratioValue(r))
  let mod = cents % 100
  if (mod > 50) mod -= 100
  if (mod <= -50) mod += 100
  return mod
}

export function formatRatio(r: Ratio): string {
  return `${r.upper}:${r.lower}`
}

export function formatHz(hz: number): string {
  return hz.toFixed(2)
}
