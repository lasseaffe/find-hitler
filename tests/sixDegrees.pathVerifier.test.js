// tests/sixDegrees.pathVerifier.test.js
import { describe, it, expect } from 'vitest'
import { verifyPath } from '../src/lib/sixDegrees/pathVerifier.js'

const graph = { Start: ['A', 'X'], A: ['B'], B: ['Adolf Hitler'] }
const getBodyLinks = async (n) => graph[n] || []

describe('verifyPath', () => {
  it('accepts a valid path that ends at the target', async () => {
    const r = await verifyPath(['Start', 'A', 'B', 'Adolf Hitler'], 'Adolf Hitler', { getBodyLinks })
    expect(r).toEqual({ valid: true, brokenAt: null })
  })

  it('reports the index of the first severed edge', async () => {
    // A does not link to X -> edge at index 1 (A -> X) is broken
    const r = await verifyPath(['Start', 'A', 'X', 'Adolf Hitler'], 'Adolf Hitler', { getBodyLinks })
    expect(r.valid).toBe(false)
    expect(r.brokenAt).toBe(1)
  })

  it('rejects a path whose final node is not the target', async () => {
    const r = await verifyPath(['Start', 'A', 'B'], 'Adolf Hitler', { getBodyLinks })
    expect(r.valid).toBe(false)
    expect(r.brokenAt).toBe(2) // last index — endpoint mismatch
  })

  it('accepts a redirect-equivalent endpoint via canonicalize match', async () => {
    const r = await verifyPath(['Start', 'A', 'B', 'adolf_hitler'], 'Adolf Hitler', {
      getBodyLinks: async (n) => (n === 'B' ? ['adolf_hitler'] : graph[n] || []),
    })
    expect(r.valid).toBe(true)
  })
})
