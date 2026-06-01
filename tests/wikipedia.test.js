import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAndSanitizeWiki } from '../src/lib/wikipedia.js'

const FIXTURE_HTML = `
<div class="mw-parser-output">
  <p>Brazil is a country in <a href="/wiki/South_America">South America</a>.</p>
  <p>It borders <a href="/wiki/Argentina">Argentina</a>.</p>
  <p>See also <a href="/wiki/Special:Search">search</a> and <a href="https://external.com">external</a>.</p>
  <div class="navbox">Nav content — should be stripped</div>
  <table class="infobox">Infobox — should be stripped</table>
  <div class="reflist">References — should be stripped</div>
</div>
`

function makeMockFetch(html, title = 'Brazil') {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve({
      parse: { title, text: { '*': html } }
    })
  })
}

describe('fetchAndSanitizeWiki', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeMockFetch(FIXTURE_HTML))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the page title', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.title).toBe('Brazil')
  })

  it('includes valid internal wiki links in validLinks', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.validLinks).toContain('South_America')
    expect(result.validLinks).toContain('Argentina')
  })

  it('excludes Special: pages and external links from validLinks', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.validLinks).not.toContain('Special:Search')
    expect(result.validLinks).not.toContain('https://external.com')
  })

  it('rewrites internal links to data-wiki-target="#"', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.cleanHtml).toContain('data-wiki-target="South_America"')
    expect(result.cleanHtml).toContain('href="#"')
  })

  it('strips navbox, infobox, and reflist elements', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.cleanHtml).not.toContain('navbox')
    expect(result.cleanHtml).not.toContain('infobox')
    expect(result.cleanHtml).not.toContain('reflist')
  })

  it('strips external links but keeps their text', async () => {
    const result = await fetchAndSanitizeWiki('Brazil')
    expect(result.cleanHtml).not.toContain('href="https://external.com"')
    expect(result.cleanHtml).toContain('external')
  })
})
