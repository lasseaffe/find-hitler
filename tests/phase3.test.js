// tests/phase3.test.js
import { describe, it, expect } from 'vitest'
import { isHubPage } from '../src/lib/hubBlocklist.js'
import { getDailyPair } from '../src/lib/dailyChallenge.js'
import { calculateGolfScore, calculateParGrade } from '../src/lib/scoring.js'
import { createGame, getGame, getPlayer } from '../src/lib/gameState.js'

describe('No-Hub mode — isHubPage', () => {
  it('blocks countries', () => {
    expect(isHubPage('France')).toBe(true)
    expect(isHubPage('Brazil')).toBe(true)
  })

  it('blocks major years', () => {
    expect(isHubPage('1945')).toBe(true)
    expect(isHubPage('2001')).toBe(true)
  })

  it('does not block niche pages', () => {
    expect(isHubPage('Beekeeping')).toBe(false)
    expect(isHubPage('Accordion')).toBe(false)
  })
})

describe('Golf mode scoring', () => {
  it('score equals click count', () => {
    expect(calculateGolfScore({ clicks: 4 })).toBe(4)
  })

  it('lower clicks = better (smaller score)', () => {
    const three = calculateGolfScore({ clicks: 3 })
    const seven = calculateGolfScore({ clicks: 7 })
    expect(three).toBeLessThan(seven)
  })
})

describe('5 Clicks to Jesus — par scoring', () => {
  it('grade table is correct', () => {
    const cases = [
      [1, 'Hole-in-One'], [2, 'Albatross'], [3, 'Eagle'],
      [4, 'Birdie'], [5, 'Par'], [6, 'Bogey'], [7, 'Double Bogey'], [9, 'Double Bogey'],
    ]
    for (const [clicks, expectedGrade] of cases) {
      expect(calculateParGrade(clicks).grade).toBe(expectedGrade)
    }
  })
})

describe('Hardcore mode — game state', () => {
  it('undoTokens is 0 for hardcore game', () => {
    const gameId = createGame({
      target: 'Jesus', mode: 'classic', hardcore: true,
      playerId: 'hc1', playerName: 'Test',
      startPage: 'Coffee', cleanHtml: '<p>x</p>', validLinks: [],
    })
    expect(getPlayer(gameId, 'hc1').undoTokens).toBe(0)
  })

  it('game stores hardcore flag', () => {
    const gameId = createGame({
      target: 'Jesus', mode: 'golf', hardcore: true,
      playerId: 'hc2', playerName: 'Test',
      startPage: 'Coffee', cleanHtml: '<p>x</p>', validLinks: [],
    })
    expect(getGame(gameId).hardcore).toBe(true)
  })
})

describe('Daily Challenge', () => {
  it('returns same pair for same date string', () => {
    expect(getDailyPair('2026-01-01')).toEqual(getDailyPair('2026-01-01'))
  })

  it('pair has start and target', () => {
    const { start, target } = getDailyPair('2026-06-01')
    expect(start).toBeTruthy()
    expect(target).toBeTruthy()
  })
})
