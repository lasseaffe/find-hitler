// tests/leaderboard.test.js
import { describe, it, expect, beforeEach } from 'vitest'

// Mock localStorage for node environment
const store = {}
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v },
  removeItem: (k) => { delete store[k] },
}

// Import AFTER mocking localStorage (dynamic to avoid top-level hoisting issues)
const { addEntry, getEntries, STORAGE_KEY } = await import('../src/lib/leaderboard.js')

describe('leaderboard', () => {
  beforeEach(() => {
    delete store[STORAGE_KEY]
  })

  it('getEntries returns empty array when storage is empty', () => {
    expect(getEntries()).toEqual([])
  })

  it('addEntry stores an entry retrievable by getEntries', () => {
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'lasse' })
    const entries = getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].playerName).toBe('lasse')
    expect(entries[0].score).toBe(7530)
  })

  it('getEntries returns entries sorted by score descending', () => {
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'a' })
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 3, time: 30, score: 8500, playerName: 'b' })
    const entries = getEntries()
    expect(entries[0].score).toBe(8500)
    expect(entries[1].score).toBe(7530)
  })

  it('getEntries filters by mode when provided', () => {
    addEntry({ mode: 'classic',  target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'a' })
    addEntry({ mode: 'speedrun', target: 'Adolf Hitler', clicks: 3, time: 20, score: 9000, playerName: 'b' })
    expect(getEntries({ mode: 'classic' })).toHaveLength(1)
    expect(getEntries({ mode: 'speedrun' })).toHaveLength(1)
    expect(getEntries()).toHaveLength(2)
  })

  it('caps at 50 entries, dropping the lowest score among existing entries when over the limit', () => {
    for (let i = 0; i < 50; i++) {
      addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 5, time: 60, score: 1000 + i, playerName: `p${i}` })
    }
    // Add one more — it should be kept; p0 (lowest score 1000) should be evicted
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 10, time: 90, score: 500, playerName: 'worst' })
    const entries = getEntries()
    expect(entries).toHaveLength(50)
    expect(entries.find(e => e.playerName === 'worst')).toBeDefined()   // the new entry is kept
    expect(entries.find(e => e.playerName === 'p0')).toBeUndefined()    // p0 (score 1000) is evicted
  })

  it('addEntry attaches a date string to each entry', () => {
    addEntry({ mode: 'classic', target: 'Adolf Hitler', clicks: 4, time: 47, score: 7530, playerName: 'lasse' })
    const [entry] = getEntries()
    expect(typeof entry.date).toBe('string')
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
