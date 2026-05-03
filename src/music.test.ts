import { describe, expect, it } from 'vitest'
import {
  centsFromTET,
  gcd,
  multiply,
  noteNameFromFreq,
  octaveBound,
  parseNoteName,
  power,
  ratioValue,
  reduce,
} from './music'

describe('gcd', () => {
  it('handles common cases', () => {
    expect(gcd(12, 8)).toBe(4)
    expect(gcd(7, 13)).toBe(1)
    expect(gcd(100, 25)).toBe(25)
    expect(gcd(0, 5)).toBe(5)
  })
})

describe('reduce', () => {
  it('reduces to lowest terms', () => {
    expect(reduce(6, 4)).toEqual({ upper: 3, lower: 2 })
    expect(reduce(9, 3)).toEqual({ upper: 3, lower: 1 })
    expect(reduce(8, 6)).toEqual({ upper: 4, lower: 3 })
  })
  it('throws on zero denominator', () => {
    expect(() => reduce(1, 0)).toThrow()
  })
})

describe('multiply', () => {
  it('multiplies and reduces', () => {
    expect(multiply({ upper: 3, lower: 2 }, { upper: 3, lower: 2 })).toEqual({
      upper: 9,
      lower: 4,
    })
    expect(multiply({ upper: 5, lower: 4 }, { upper: 4, lower: 5 })).toEqual({
      upper: 1,
      lower: 1,
    })
  })
})

describe('power', () => {
  it('handles positive integer exponents', () => {
    expect(power({ upper: 3, lower: 2 }, 2)).toEqual({ upper: 9, lower: 4 })
    expect(power({ upper: 3, lower: 2 }, 3)).toEqual({ upper: 27, lower: 8 })
  })
  it('handles zero', () => {
    expect(power({ upper: 3, lower: 2 }, 0)).toEqual({ upper: 1, lower: 1 })
  })
  it('handles negative integer exponents', () => {
    expect(power({ upper: 3, lower: 2 }, -1)).toEqual({ upper: 2, lower: 3 })
    expect(power({ upper: 3, lower: 2 }, -2)).toEqual({ upper: 4, lower: 9 })
  })
})

describe('octaveBound', () => {
  it('passes through when already bounded', () => {
    expect(octaveBound({ upper: 3, lower: 2 })).toEqual({ upper: 3, lower: 2 })
    expect(octaveBound({ upper: 1, lower: 1 })).toEqual({ upper: 1, lower: 1 })
  })
  it('keeps the octave (2:1) intact since the range is inclusive', () => {
    expect(octaveBound({ upper: 2, lower: 1 })).toEqual({ upper: 2, lower: 1 })
  })
  it('halves down when above 2', () => {
    expect(octaveBound({ upper: 9, lower: 4 })).toEqual({ upper: 9, lower: 8 })
    expect(octaveBound({ upper: 27, lower: 8 })).toEqual({ upper: 27, lower: 16 })
  })
  it('halves powers of 2 down to the octave', () => {
    expect(octaveBound({ upper: 4, lower: 1 })).toEqual({ upper: 2, lower: 1 })
    expect(octaveBound({ upper: 8, lower: 1 })).toEqual({ upper: 2, lower: 1 })
  })
  it('doubles up when below 1', () => {
    expect(octaveBound({ upper: 2, lower: 3 })).toEqual({ upper: 4, lower: 3 })
    expect(octaveBound({ upper: 4, lower: 9 })).toEqual({ upper: 16, lower: 9 })
  })
  it('produces ratio in [1, 2]', () => {
    for (const r of [
      { upper: 7, lower: 1 },
      { upper: 1, lower: 7 },
      { upper: 81, lower: 64 },
      { upper: 5, lower: 3 },
      { upper: 2, lower: 1 },
      { upper: 1, lower: 2 },
    ]) {
      const v = ratioValue(octaveBound(r))
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(2)
    }
  })
})

describe('noteNameFromFreq', () => {
  it('identifies A4', () => {
    const n = noteNameFromFreq(440)
    expect(n.name).toBe('A')
    expect(n.octave).toBe(4)
    expect(Math.abs(n.centsOffset)).toBeLessThan(0.01)
  })
  it('identifies middle C (~261.63)', () => {
    const n = noteNameFromFreq(261.63)
    expect(n.name).toBe('C')
    expect(n.octave).toBe(4)
  })
  it('identifies G4 from 3:2 above C4', () => {
    const g = noteNameFromFreq(261.63 * 1.5)
    expect(g.name).toBe('G')
    expect(g.octave).toBe(4)
  })
})

describe('parseNoteName', () => {
  it('parses A4 as 440', () => {
    const f = parseNoteName('A4')
    expect(f).not.toBeNull()
    expect(Math.abs(f! - 440)).toBeLessThan(0.001)
  })
  it('parses C4 close to middle C', () => {
    const f = parseNoteName('C4')
    expect(f).not.toBeNull()
    expect(Math.abs(f! - 261.63)).toBeLessThan(0.05)
  })
  it('rejects garbage', () => {
    expect(parseNoteName('blah')).toBeNull()
    expect(parseNoteName('Z3')).toBeNull()
  })
  it('parses sharps and flats', () => {
    const cs = parseNoteName('C#4')
    const db = parseNoteName('Db4')
    expect(cs).not.toBeNull()
    expect(db).not.toBeNull()
    expect(Math.abs(cs! - db!)).toBeLessThan(0.001)
  })
})

describe('centsFromTET', () => {
  it('returns ~0 for octaves and unison', () => {
    expect(Math.abs(centsFromTET({ upper: 1, lower: 1 }))).toBeLessThan(0.001)
    expect(Math.abs(centsFromTET({ upper: 2, lower: 1 }))).toBeLessThan(0.001)
  })
  it('returns ~+1.96 for the just perfect fifth (3:2)', () => {
    // 1200*log2(1.5) = 701.955; mod 100 → 1.955
    const c = centsFromTET({ upper: 3, lower: 2 })
    expect(Math.abs(c - 1.955)).toBeLessThan(0.01)
  })
  it('returns ~-13.69 for the syntonic major third (5:4)', () => {
    // 1200*log2(1.25) = 386.31; deviation from 400 → -13.69
    const c = centsFromTET({ upper: 5, lower: 4 })
    expect(Math.abs(c - -13.686)).toBeLessThan(0.01)
  })
  it('stays in [-50, 50]', () => {
    for (const r of [
      { upper: 7, lower: 4 },
      { upper: 11, lower: 8 },
      { upper: 13, lower: 8 },
      { upper: 16, lower: 15 },
    ]) {
      const c = centsFromTET(r)
      expect(c).toBeGreaterThan(-50)
      expect(c).toBeLessThanOrEqual(50)
    }
  })
})
