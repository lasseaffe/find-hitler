import { describe, it, expect } from 'vitest'
import { calculateScore } from '../src/lib/scoring.js'

describe('calculateScore', () => {
  it('classic: penalizes clicks at 500 each, seconds at 10 each', () => {
    expect(calculateScore({ mode: 'classic', clicks: 4, seconds: 30 })).toBe(7700)
    // 10000 - (4 * 500) - (30 * 10) = 10000 - 2000 - 300 = 7700
  })

  it('speedrun: penalizes seconds at 100 each, clicks at 50 each', () => {
    expect(calculateScore({ mode: 'speedrun', clicks: 4, seconds: 30 })).toBe(6800)
    // 10000 - (30 * 100) - (4 * 50) = 10000 - 3000 - 200 = 6800
  })

  it('never returns a negative score', () => {
    expect(calculateScore({ mode: 'classic', clicks: 100, seconds: 1000 })).toBe(0)
  })

  it('perfect game: 1 click, 1 second', () => {
    expect(calculateScore({ mode: 'classic', clicks: 1, seconds: 1 })).toBe(9490)
    // 10000 - 500 - 10 = 9490
  })
})
