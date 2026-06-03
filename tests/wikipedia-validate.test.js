import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateWikiTitle } from '../src/lib/wikipedia.js'

function mockSummaryFetch(status, body) {
  return vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('validateWikiTitle', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns valid=true and canonicalTitle for an existing page', async () => {
    vi.stubGlobal('fetch', mockSummaryFetch(200, {
      title: 'Adolf Hitler',
      titles: { normalized: 'Adolf Hitler' },
      extract: 'German politician.',
    }))
    const result = await validateWikiTitle('Adolf Hitler')
    expect(result.valid).toBe(true)
    expect(result.canonicalTitle).toBe('Adolf Hitler')
    expect(result.extract).toBe('German politician.')
  })

  it('returns valid=false for a non-existent page', async () => {
    vi.stubGlobal('fetch', mockSummaryFetch(404, { title: 'Not Found' }))
    const result = await validateWikiTitle('Xyzzy_Nonexistent_Page_12345')
    expect(result.valid).toBe(false)
  })

  it('returns valid=false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const result = await validateWikiTitle('Anything')
    expect(result.valid).toBe(false)
  })

  it('uses titles.normalized when available', async () => {
    vi.stubGlobal('fetch', mockSummaryFetch(200, {
      title: 'Taylor_Swift',
      titles: { normalized: 'Taylor Swift' },
      extract: 'American singer.',
    }))
    const result = await validateWikiTitle('taylor swift')
    expect(result.canonicalTitle).toBe('Taylor Swift')
  })
})
