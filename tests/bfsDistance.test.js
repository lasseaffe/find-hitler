import { describe, it, expect, vi } from 'vitest'
import { calculateHpDamage } from '../src/lib/bfsDistance.js'

describe('calculateHpDamage', () => {
  it('unreachable within 6 hops → max damage 2500', async () => {
    const fetchLinks = vi.fn().mockResolvedValue([])
    const damage = await calculateHpDamage('Nowhere', 'Adolf Hitler', { fetchLinks })
    expect(damage).toBe(2500)
  })

  it('1 hop away → 500 damage', async () => {
    const fetchLinks = vi.fn()
      .mockResolvedValueOnce(['Adolf Hitler', 'Germany'])
    const damage = await calculateHpDamage('CurrentPage', 'Adolf Hitler', { fetchLinks })
    expect(damage).toBe(500)
  })

  it('2 hops away → 1000 damage', async () => {
    const fetchLinks = vi.fn()
      .mockResolvedValueOnce(['Germany', 'France'])
      .mockResolvedValueOnce(['Adolf Hitler', 'Austria'])
      .mockResolvedValueOnce(['something'])
    const damage = await calculateHpDamage('CurrentPage', 'Adolf Hitler', { fetchLinks })
    expect(damage).toBe(1000)
  })

  it('caps at depth 6 even if target exists deeper', async () => {
    const fetchLinks = vi.fn().mockResolvedValue(['SomePage'])
    const damage = await calculateHpDamage('Start', 'NeverReached', { fetchLinks })
    expect(damage).toBe(2500)
  })
})
