// tests/sixDegrees.bodyLinkCache.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getBodyLinks, createDiskCache } from '../src/lib/sixDegrees/bodyLinkCache.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

afterEach(() => vi.unstubAllGlobals())

const HTML = `<div class="mw-parser-output">
  <p><a href="/wiki/South_America">SA</a> and <a href="/wiki/Argentina">Arg</a></p>
</div>`

function memCache() {
  const m = new Map()
  return { has: k => m.has(k), get: k => m.get(k), set: (k, v) => m.set(k, v) }
}

describe('getBodyLinks', () => {
  it('fetches, extracts, and canonicalizes links on a miss', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(HTML)
    const links = await getBodyLinks('Brazil', { fetchHtml, cache: memCache() })
    expect(links).toContain('South America') // canonicalized (underscore -> space)
    expect(links).toContain('Argentina')
    expect(fetchHtml).toHaveBeenCalledTimes(1)
  })

  it('serves from cache on a hit without re-fetching', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(HTML)
    const cache = memCache()
    await getBodyLinks('Brazil', { fetchHtml, cache })
    await getBodyLinks('Brazil', { fetchHtml, cache })
    expect(fetchHtml).toHaveBeenCalledTimes(1)
  })

  it('returns [] when the page cannot be fetched', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(null)
    const links = await getBodyLinks('Nope', { fetchHtml, cache: memCache() })
    expect(links).toEqual([])
  })

  it('returns [] when the default network fetch throws (resilient crawl)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const links = await getBodyLinks('Brazil', { cache: memCache() })
    expect(links).toEqual([])
  })
})

describe('createDiskCache', () => {
  it('persists across instances (NDJSON round-trip)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sixdeg-'))
    const file = join(dir, 'cache.ndjson')
    const c1 = createDiskCache(file)
    c1.set('Brazil', ['South America', 'Argentina'])
    const c2 = createDiskCache(file)
    expect(c2.has('Brazil')).toBe(true)
    expect(c2.get('Brazil')).toEqual(['South America', 'Argentina'])
    rmSync(dir, { recursive: true, force: true })
  })
})
