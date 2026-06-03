import { describe, it, expect, vi, afterEach } from 'vitest'
import { findStartPageAtDistance } from '../src/lib/wikipedia.js'

afterEach(() => vi.unstubAllGlobals())

describe('findStartPageAtDistance', () => {
  it('returns a page matching the hop range when found quickly', async () => {
    const mockBfs = vi.fn().mockResolvedValue(3 * 500) // 3 hops × DAMAGE_PER_HOP=500
    const page = await findStartPageAtDistance('Adolf Hitler', 3, 4, {
      fetchRandomPage: () => Promise.resolve('France'),
      measureDistance: mockBfs,
    })
    expect(page).toBe('France')
    expect(mockBfs).toHaveBeenCalledWith('France', 'Adolf Hitler')
  })

  it('skips pages outside hop range and tries next', async () => {
    let call = 0
    const pages = ['TooClose', 'JustRight']
    const mockBfs = vi.fn().mockImplementation((page) =>
      page === 'TooClose' ? Promise.resolve(1 * 500) : Promise.resolve(3 * 500)
    )
    const page = await findStartPageAtDistance('Adolf Hitler', 3, 4, {
      fetchRandomPage: () => Promise.resolve(pages[call++ % pages.length]),
      measureDistance: mockBfs,
    })
    expect(page).toBe('JustRight')
  })

  it('falls back to a random page after timeout', async () => {
    const mockBfs = vi.fn().mockResolvedValue(1 * 500)
    const page = await findStartPageAtDistance('Adolf Hitler', 5, 6, {
      fetchRandomPage: () => Promise.resolve('AlwaysWrong'),
      measureDistance: mockBfs,
      timeoutMs: 0,
    })
    expect(page).toBe('AlwaysWrong') // fallback = last random page tried
  })
})
