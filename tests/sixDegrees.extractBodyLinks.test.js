// tests/sixDegrees.extractBodyLinks.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractBodyLinks } from '../src/lib/sixDegrees/extractBodyLinks.js'
import { fetchAndSanitizeWiki } from '../src/lib/wikipedia.js'

afterEach(() => vi.unstubAllGlobals())

const FIXTURE_HTML = `
<div class="mw-parser-output">
  <p>Brazil is a country in <a href="/wiki/South_America">South America</a>.</p>
  <p>It borders <a href="/wiki/Argentina">Argentina</a>.</p>
  <p>See also <a href="/wiki/Special:Search">search</a> and <a href="https://external.com">external</a>.</p>
  <div class="navbox"><a href="/wiki/Navbox_Link">should be stripped</a></div>
  <table class="infobox"><a href="/wiki/Infobox_Link">infobox link kept by game</a></table>
  <div class="reflist"><a href="/wiki/Reflist_Link">cited work — stripped</a></div>
</div>
`

describe('extractBodyLinks', () => {
  it('returns internal wiki links from the body', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).toContain('South_America')
    expect(links).toContain('Argentina')
  })

  it('excludes Special: and external links', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).not.toContain('Special:Search')
    expect(links.some(l => l.includes('external.com'))).toBe(false)
  })

  it('strips navbox links (a player cannot click them)', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).not.toContain('Navbox_Link')
  })

  it('keeps infobox links (the live game keeps the infobox)', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).toContain('Infobox_Link')
  })

  it('strips reference-list links (citation clicks are wasted)', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).not.toContain('Reflist_Link')
  })

  it('PARITY: matches fetchAndSanitizeWiki validLinks for the same html', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ parse: { title: 'Brazil', text: { '*': FIXTURE_HTML } } }),
    }))
    const { validLinks } = await fetchAndSanitizeWiki('Brazil')
    const links = extractBodyLinks(FIXTURE_HTML)
    expect([...links].sort()).toEqual([...validLinks].sort())
  })
})