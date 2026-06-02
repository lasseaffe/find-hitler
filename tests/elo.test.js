import { describe, it, expect } from 'vitest'
import { calculateElo, getRankTier, RANKS } from '../src/lib/elo.js'
import { getRankLabel, getRankFromElo, TIER_THRESHOLDS } from '../src/lib/elo.js'

describe('calculateElo', () => {
  it('winner gains points, loser loses matching points', () => {
    const { newWinner, newLoser } = calculateElo(1000, 1000)
    expect(newWinner).toBeGreaterThan(1000)
    expect(newLoser).toBeLessThan(1000)
    expect(newWinner + newLoser).toBe(2000) // zero-sum
  })

  it('upset: low-rated player beating high-rated gains more', () => {
    const { newWinner: upsetWin } = calculateElo(800, 1400)
    const { newWinner: normalWin } = calculateElo(1200, 1000)
    expect(upsetWin - 800).toBeGreaterThan(normalWin - 1200)
  })

  it('expected win against much weaker opponent gains very few points', () => {
    const { newWinner } = calculateElo(1800, 800)
    expect(newWinner - 1800).toBeLessThan(5)
  })
})

describe('getRankTier', () => {
  it('returns BRONZE for 0-999', () => {
    expect(getRankTier(0)).toBe('BRONZE')
    expect(getRankTier(999)).toBe('BRONZE')
  })
  it('returns SILVER for 1000-1999', () => {
    expect(getRankTier(1000)).toBe('SILVER')
    expect(getRankTier(1999)).toBe('SILVER')
  })
  it('returns GOLD for 2000-2999', () => {
    expect(getRankTier(2000)).toBe('GOLD')
  })
  it('returns DIAMOND for 4000+', () => {
    expect(getRankTier(4000)).toBe('DIAMOND')
    expect(getRankTier(9999)).toBe('DIAMOND')
  })
})

describe('getRankLabel', () => {
  it('returns Bronze 5 for ELO 0', () => {
    expect(getRankLabel(0)).toBe('Bronze 5')
  })
  it('returns Bronze 4 for ELO 200', () => {
    expect(getRankLabel(200)).toBe('Bronze 4')
  })
  it('returns Bronze 1 for ELO 800', () => {
    expect(getRankLabel(800)).toBe('Bronze 1')
  })
  it('returns Silver 5 for ELO 1000', () => {
    expect(getRankLabel(1000)).toBe('Silver 5')
  })
  it('returns Gold 3 for ELO 2400', () => {
    expect(getRankLabel(2400)).toBe('Gold 3')
  })
  it('returns Diamond 1 for ELO 4800', () => {
    expect(getRankLabel(4800)).toBe('Diamond 1')
  })
})

describe('getRankFromElo', () => {
  it('returns tier and division for Bronze', () => {
    const r = getRankFromElo(350)
    expect(r.tier).toBe('BRONZE')
    expect(r.division).toBe(4)
  })
  it('returns tier SILVER for ELO 1500', () => {
    expect(getRankFromElo(1500).tier).toBe('SILVER')
  })
  it('clamps division to 1 at top of non-Challenger tier', () => {
    expect(getRankFromElo(4999).division).toBe(1)
  })
})
