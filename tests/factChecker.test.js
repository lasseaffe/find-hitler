import { describe, it, expect } from 'vitest'
import {
  normalizeSelection,
  scoreAccusation,
  SCORE_CONFIG,
} from '../src/lib/factChecker.js'

describe('normalizeSelection', () => {
  it('strips leading/trailing whitespace', () => {
    expect(normalizeSelection('  corporal  ')).toBe('corporal')
  })
  it('strips leading article "the"', () => {
    expect(normalizeSelection('the corporal')).toBe('corporal')
  })
  it('strips leading article "a"', () => {
    expect(normalizeSelection('a sergeant')).toBe('sergeant')
  })
  it('strips leading article "an"', () => {
    expect(normalizeSelection('an officer')).toBe('officer')
  })
  it('lowercases result', () => {
    expect(normalizeSelection('CORPORAL')).toBe('corporal')
  })
  it('handles multi-word span', () => {
    expect(normalizeSelection('  Iron Cross First Class  ')).toBe('iron cross first class')
  })
  it('does not strip "the" from middle of text', () => {
    expect(normalizeSelection('in the army')).toBe('in the army')
  })
})

describe('scoreAccusation', () => {
  const mistakes = [
    { span: 'corporal', correct: 'lance corporal', explanation: 'He held the rank of lance corporal.' },
    { span: 'april 20', correct: 'April 20 is correct', explanation: 'April 20 is actually correct.' },
  ]

  it('returns correct=true and score delta for matching span', () => {
    const result = scoreAccusation('corporal', mistakes, 'easy')
    expect(result.correct).toBe(true)
    expect(result.delta).toBe(SCORE_CONFIG.easy.correct)
    expect(result.explanation).toBe('He held the rank of lance corporal.')
  })

  it('returns correct=false and negative delta for wrong span', () => {
    const result = scoreAccusation('braunau', mistakes, 'easy')
    expect(result.correct).toBe(false)
    expect(result.delta).toBe(SCORE_CONFIG.easy.wrong)
  })

  it('normalizes the input before matching', () => {
    const result = scoreAccusation('the corporal', mistakes, 'medium')
    expect(result.correct).toBe(true)
  })

  it('uses correct score config per difficulty', () => {
    const easy = scoreAccusation('corporal', mistakes, 'easy')
    const hard = scoreAccusation('corporal', mistakes, 'hard')
    expect(hard.delta).toBeGreaterThan(easy.delta)
  })

  it('returns correct=false with wrong-penalty delta for no match', () => {
    const result = scoreAccusation('nonexistent', mistakes, 'medium')
    expect(result.correct).toBe(false)
    expect(result.delta).toBe(SCORE_CONFIG.medium.wrong)
  })
})
