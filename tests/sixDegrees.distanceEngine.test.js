// tests/sixDegrees.distanceEngine.test.js
import { describe, it, expect, vi } from 'vitest'
import { precomputeReverseLayers, measureDistance } from '../src/lib/sixDegrees/distanceEngine.js'

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

describe('measureDistance', () => {
  // helper: forward adjacency as a plain object
  const linksFrom = (graph) => async (n) => graph[n] || []

  it('returns 0 clicks when start equals target', async () => {
    const r = await measureDistance('T', 'T', { reverseLayers: new Map([['T', { dist: 0, next: null }]]) })
    expect(r).toEqual({ minClicks: 0, path: ['T'], status: 'exact' })
  })

  it('finds a 1-click direct path via forward BFS hitting the target', async () => {
    const reverseLayers = new Map([['T', { dist: 0, next: null }]])
    const getLinks = linksFrom({ Start: ['T'] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.status).toBe('exact')
    expect(r.minClicks).toBe(1)
    expect(r.path).toEqual(['Start', 'T'])
  })

  it('meets in the middle: Start->A->B->T = 3 clicks', async () => {
    const reverseLayers = new Map([
      ['T', { dist: 0, next: null }],
      ['B', { dist: 1, next: 'T' }],
    ])
    const getLinks = linksFrom({ Start: ['A'], A: ['B'], B: ['T'] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.minClicks).toBe(3)
    expect(r.path).toEqual(['Start', 'A', 'B', 'T'])
  })

  it('uses start membership in the backward map (Start at dist 2)', async () => {
    const reverseLayers = new Map([
      ['T', { dist: 0, next: null }],
      ['M', { dist: 1, next: 'T' }],
      ['Start', { dist: 2, next: 'M' }],
    ])
    const getLinks = linksFrom({ Start: ['Other'], Other: [] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.minClicks).toBe(2)
    expect(r.path).toEqual(['Start', 'M', 'T'])
  })

  it('returns capped when the target is not found within cap (infinite chain, no meeting)', async () => {
    const reverseLayers = new Map([['T', { dist: 0, next: null }]])
    // every page links forward to a fresh page; never reaches T or a backward node
    const getLinks = async (n) => [`${n}x`]
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.status).toBe('capped')
    expect(r.minClicks).toBeNull()
  })

  it('returns unreachable when the forward component is exhausted with no meeting', async () => {
    const reverseLayers = new Map([['T', { dist: 0, next: null }]])
    const getLinks = linksFrom({ Start: [] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.status).toBe('unreachable')
    expect(r.minClicks).toBeNull()
  })
})
