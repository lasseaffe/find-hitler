// tests/sixDegrees.fetchDumps.test.js
import { describe, it, expect } from 'vitest'
import { dumpFileSpecs } from '../scripts/six-degrees/d-fetch-dumps.mjs'

describe('dumpFileSpecs', () => {
  it('lists the four enwiki dump files with URLs and local names', () => {
    const specs = dumpFileSpecs()
    expect(specs.map(s => s.table).sort()).toEqual(['linktarget', 'page', 'pagelinks', 'redirect'])
    for (const s of specs) {
      expect(s.url).toBe(`https://dumps.wikimedia.org/enwiki/latest/${s.file}`)
      expect(s.file).toMatch(/^enwiki-latest-.*\.sql\.gz$/)
    }
  })
})
