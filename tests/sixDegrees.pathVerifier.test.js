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

  it('accepts an underscore/whitespace-variant endpoint via canonicalize match', async () => {
    // canonicalize('Adolf_Hitler') === canonicalize('Adolf Hitler'); case is NOT
    // normalized (Wikipedia titles are case-sensitive after char 1 — that is a
    // redirect concern handled by resolveRedirects, not verifyPath).
    const r = await verifyPath(['Start', 'A', 'B', 'Adolf_Hitler'], 'Adolf Hitler', {
      getBodyLinks: async (n) => (n === 'B' ? ['Adolf_Hitler'] : graph[n] || []),
    })
    expect(r.valid).toBe(true)
  })
})
