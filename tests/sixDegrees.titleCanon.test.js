// tests/sixDegrees.titleCanon.test.js
import { describe, it, expect, vi } from 'vitest'
import { canonicalize, resolveRedirects } from '../src/lib/sixDegrees/titleCanon.js'

describe('canonicalize', () => {
  it('converts underscores to spaces and trims', () => {
    expect(canonicalize('South_America ')).toBe('South America')
  })
  it('collapses internal whitespace', () => {
    expect(canonicalize('Adolf   Hitler')).toBe('Adolf Hitler')
  })
  it('uppercases only the first character (Wikipedia rule)', () => {
    expect(canonicalize('adolf Hitler')).toBe('Adolf Hitler')
  })
  it('is idempotent', () => {
    expect(canonicalize(canonicalize('adolf_hitler'))).toBe(canonicalize('adolf_hitler'))
  })
})

describe('resolveRedirects', () => {
  it('maps each input title to its canonical redirect target', async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      query: {
        normalized: [{ from: 'hitler', to: 'Hitler' }],
        redirects: [{ from: 'Hitler', to: 'Adolf Hitler' }],
        pages: { '1': { title: 'Adolf Hitler' } },
      },
    })
    const map = await resolveRedirects(['hitler'], { fetchJson })
    expect(map.get('hitler')).toBe('Adolf Hitler')
  })

  it('returns the canonicalized title unchanged when there is no redirect', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ query: { pages: { '1': { title: 'Argentina' } } } })
    const map = await resolveRedirects(['Argentina'], { fetchJson })
    expect(map.get('Argentina')).toBe('Argentina')
  })
})
