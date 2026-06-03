// tests/sixDegrees.fetchSdow.test.js
import { describe, it, expect } from 'vitest'
import { parseLatestDumpDate } from '../scripts/six-degrees/c-fetch-sdow.mjs'

describe('parseLatestDumpDate', () => {
  it('returns the max YYYYMMDD across bucket prefixes', () => {
    const listing = { prefixes: ['dumps/20231220/', 'dumps/20240615/', 'dumps/20231201/'] }
    expect(parseLatestDumpDate(listing)).toBe('20240615')
  })

  it('ignores prefixes that are not dump dates', () => {
    const listing = { prefixes: ['dumps/latest/', 'dumps/20230101/'] }
    expect(parseLatestDumpDate(listing)).toBe('20230101')
  })

  it('returns null when there are no dated prefixes', () => {
    expect(parseLatestDumpDate({ prefixes: [] })).toBeNull()
    expect(parseLatestDumpDate({})).toBeNull()
  })
})
