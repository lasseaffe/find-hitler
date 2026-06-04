import { describe, it, expect, vi, beforeEach } from 'vitest'

// These tests verify the session state-machine logic in isolation.
// They mock prisma so no real DB is needed.

const mockPrisma = {
  studySession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  studyResult: { create: vi.fn() },
  studyPack: { update: vi.fn() },
}

vi.mock('../src/lib/db.js', () => ({ default: mockPrisma }))

import { buildSessionUpdate } from '../src/lib/study/sessionHelpers.js'

describe('buildSessionUpdate', () => {
  it('increments articlesCompleted', () => {
    const update = buildSessionUpdate({ articlesCompleted: 2, totalScore: 200, avgAccuracy: 0.8 }, {
      score: 150, correctCount: 3, wrongCount: 1,
    })
    expect(update.articlesCompleted).toBe(3)
  })

  it('recalculates avgAccuracy as rolling average', () => {
    const update = buildSessionUpdate({ articlesCompleted: 1, totalScore: 100, avgAccuracy: 1.0 }, {
      score: 100, correctCount: 2, wrongCount: 2,
    })
    // new accuracy = 2/(2+2) = 0.5; rolling avg of [1.0, 0.5] = 0.75
    expect(update.avgAccuracy).toBeCloseTo(0.75)
  })

  it('sets completedAt when all articles done', () => {
    const update = buildSessionUpdate(
      { articlesCompleted: 4, totalScore: 400, avgAccuracy: 0.9 },
      { score: 100, correctCount: 3, wrongCount: 1 },
      { totalArticles: 5 }
    )
    expect(update.completedAt).toBeDefined()
  })

  it('leaves completedAt undefined when articles remain', () => {
    const update = buildSessionUpdate(
      { articlesCompleted: 2, totalScore: 200, avgAccuracy: 0.9 },
      { score: 100, correctCount: 3, wrongCount: 1 },
      { totalArticles: 5 }
    )
    expect(update.completedAt).toBeUndefined()
  })
})
