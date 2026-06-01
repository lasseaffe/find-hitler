import { describe, it, expect } from 'vitest'
import { getDailyPair, seedFromDate } from '../src/lib/dailyChallenge.js'

describe('dailyChallenge', () => {
  it('seedFromDate produces an integer from a date string', () => {
    const seed = seedFromDate('2026-06-01')
    expect(typeof seed).toBe('number')
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThan(0)
  })

  it('same date always returns same pair', () => {
    const pair1 = getDailyPair('2026-06-01')
    const pair2 = getDailyPair('2026-06-01')
    expect(pair1.start).toBe(pair2.start)
    expect(pair1.target).toBe(pair2.target)
  })

  it('different dates return different pairs (with very high probability)', () => {
    const p1 = getDailyPair('2026-06-01')
    const p2 = getDailyPair('2026-06-02')
    const different = p1.start !== p2.start || p1.target !== p2.target
    expect(different).toBe(true)
  })

  it('returned pair has start and target strings', () => {
    const pair = getDailyPair('2026-06-01')
    expect(typeof pair.start).toBe('string')
    expect(typeof pair.target).toBe('string')
    expect(pair.start.length).toBeGreaterThan(0)
    expect(pair.target.length).toBeGreaterThan(0)
    expect(pair.start).not.toBe(pair.target)
  })
})
