import { describe, it, expect } from 'vitest'
import {
  normalizeSelection,
  matchesSpan,
  scoreAccusation,
  SCORE_CONFIG,
} from '../src/lib/factChecker.js'

describe('normalizeSelection', () => {
  it('trims, lowercases, strips leading article', () => {
    expect(normalizeSelection('  The Corporal ')).toBe('corporal')
    expect(normalizeSelection('an officer')).toBe('officer')
  })
  it('does not strip "the" mid-string', () => {
    expect(normalizeSelection('in the army')).toBe('in the army')
  })
})

describe('matchesSpan (free-select overlap, server-side guard)', () => {
  it('matches exact', () => {
    expect(matchesSpan('1879', '1879')).toBe(true)
  })
  it('matches when selection is part of the false text', () => {
    expect(matchesSpan('Munich', 'Munich')).toBe(true)
    expect(matchesSpan('1879', '20 April 1879')).toBe(true) // span fully contains selection
  })
  it('matches when selection contains the false text plus a little context', () => {
    expect(matchesSpan('20 April 1879', '1879')).toBe(true) // 12 chars <= 4*3
  })
  it('rejects over-selection (drag a whole sentence to win)', () => {
    expect(matchesSpan('he was born on 20 April 1879 in a small town', '1879')).toBe(false)
  })
  it('rejects unrelated selection', () => {
    expect(matchesSpan('Bavarian Army', '1879')).toBe(false)
  })
  it('rejects empty', () => {
    expect(matchesSpan('', '1879')).toBe(false)
  })
})

describe('scoreAccusation by fcId', () => {
  const mistakes = [
    { fcId: 'a1', span: '1879', correct: '1889', explanation: 'Born 1889.' },
    { fcId: 'b2', span: 'Munich', correct: 'Berlin', explanation: 'Died in Berlin.' },
  ]

  it('correct mistake id → positive delta + reveal + foundId', () => {
    const r = scoreAccusation({ fcId: 'a1' }, mistakes, 'easy')
    expect(r.correct).toBe(true)
    expect(r.delta).toBe(SCORE_CONFIG.easy.correct)
    expect(r.answer).toBe('1889')
    expect(r.explanation).toBe('Born 1889.')
    expect(r.foundId).toBe('a1')
  })

  it('REGRESSION: id match works even though correct value "1889" is unrelated to span "1879"', () => {
    const r = scoreAccusation({ fcId: 'a1' }, mistakes, 'medium')
    expect(r.correct).toBe(true)
  })

  it('decoy / stray id → wrong penalty', () => {
    const r = scoreAccusation({ fcId: 'decoy-xyz' }, mistakes, 'medium')
    expect(r.correct).toBe(false)
    expect(r.delta).toBe(SCORE_CONFIG.medium.wrong)
  })
})

describe('scoreAccusation by selection (hard/hardcore)', () => {
  const mistakes = [{ fcId: 'a1', span: '1879', correct: '1889', explanation: 'Born 1889.' }]

  it('overlapping selection → correct, returns foundId', () => {
    const r = scoreAccusation({ selection: '20 April 1879' }, mistakes, 'hard')
    expect(r.correct).toBe(true)
    expect(r.delta).toBe(SCORE_CONFIG.hard.correct)
    expect(r.foundId).toBe('a1')
  })
  it('non-overlapping selection → wrong', () => {
    const r = scoreAccusation({ selection: 'Bavarian Army' }, mistakes, 'hard')
    expect(r.correct).toBe(false)
    expect(r.delta).toBe(SCORE_CONFIG.hard.wrong)
  })
})

describe('SCORE_CONFIG', () => {
  it('falls back to medium for unknown difficulty', () => {
    const r = scoreAccusation({ fcId: 'a1' }, [{ fcId: 'a1', span: 'x', correct: 'y', explanation: 'z' }], 'legendary')
    expect(r.delta).toBe(SCORE_CONFIG.medium.correct)
  })
})
