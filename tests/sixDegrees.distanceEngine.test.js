// tests/sixDegrees.distanceEngine.test.js
import { describe, it, expect, vi } from 'vitest'
import { precomputeReverseLayers } from '../src/lib/sixDegrees/distanceEngine.js'

describe('precomputeReverseLayers', () => {
  it('builds confirmed body-backlink layers, rejecting navbox-only proposals', async () => {
    // Proposed predecessors (linkshere superset). 'NavOnly' proposes T but does
    // NOT body-link to it -> must be rejected.
    const getBacklinkCandidates = vi.fn(async (v) => ({
      'T': ['A', 'NavOnly'],
      'A': ['C'],
    })[v] || [])
    const getLinks = vi.fn(async (n) => ({
      'A': ['T'],          // A body-links to T -> confirmed at dist 1
      'NavOnly': ['Z'],    // does not link T -> rejected
      'C': ['A'],          // C body-links to A -> confirmed at dist 2
    })[n] || [])

    const map = await precomputeReverseLayers('T', 3, { getLinks, getBacklinkCandidates })
    expect(map.get('T')).toEqual({ dist: 0, next: null })
    expect(map.get('A')).toEqual({ dist: 1, next: 'T' })
    expect(map.get('C')).toEqual({ dist: 2, next: 'A' })
    expect(map.has('NavOnly')).toBe(false)
  })

  it('seeds target aliases at dist 0', async () => {
    const getBacklinkCandidates = vi.fn(async () => [])
    const getLinks = vi.fn(async () => [])
    const map = await precomputeReverseLayers('T', 2, {
      getLinks, getBacklinkCandidates, targetAliases: ['T alias'],
    })
    expect(map.get('T alias')).toEqual({ dist: 0, next: null })
  })
})
