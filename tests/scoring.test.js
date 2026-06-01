import { describe, it, expect } from 'vitest'
import { calculateScore, calculateGolfScore, calculateParGrade } from '../src/lib/scoring.js'

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

describe('calculateGolfScore', () => {
  it('returns clicks as score (lower is better)', () => {
    expect(calculateGolfScore({ clicks: 3 })).toBe(3)
    expect(calculateGolfScore({ clicks: 7 })).toBe(7)
  })
})

describe('calculateParGrade', () => {
  it('hole-in-one at 1 click', () => {
    expect(calculateParGrade(1)).toEqual({ grade: 'Hole-in-One', delta: -4 })
  })

  it('eagle at 3 clicks', () => {
    expect(calculateParGrade(3)).toEqual({ grade: 'Eagle', delta: -2 })
  })

  it('birdie at 4 clicks', () => {
    expect(calculateParGrade(4)).toEqual({ grade: 'Birdie', delta: -1 })
  })

  it('par at 5 clicks', () => {
    expect(calculateParGrade(5)).toEqual({ grade: 'Par', delta: 0 })
  })

  it('bogey at 6 clicks', () => {
    expect(calculateParGrade(6)).toEqual({ grade: 'Bogey', delta: +1 })
  })

  it('double bogey at 7+ clicks', () => {
    expect(calculateParGrade(7)).toEqual({ grade: 'Double Bogey', delta: +2 })
    expect(calculateParGrade(10)).toEqual({ grade: 'Double Bogey', delta: +2 })
  })

  it('2 clicks is albatross (-3 from par)', () => {
    expect(calculateParGrade(2)).toEqual({ grade: 'Albatross', delta: -3 })
  })
})
