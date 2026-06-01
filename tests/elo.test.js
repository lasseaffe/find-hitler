import { describe, it, expect } from 'vitest'
import { calculateElo, getRankTier, RANKS } from '../src/lib/elo.js'

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
  it('returns BRONZE for 0-1199', () => {
    expect(getRankTier(0)).toBe('BRONZE')
    expect(getRankTier(1199)).toBe('BRONZE')
  })
  it('returns SILVER for 1200-1499', () => {
    expect(getRankTier(1200)).toBe('SILVER')
    expect(getRankTier(1499)).toBe('SILVER')
  })
  it('returns GOLD for 1500-1799', () => {
    expect(getRankTier(1500)).toBe('GOLD')
  })
  it('returns MASTER for 1800+', () => {
    expect(getRankTier(1800)).toBe('MASTER')
    expect(getRankTier(9999)).toBe('MASTER')
  })
})
