import * as cheerio from 'cheerio'
import { STRIP_SELECTOR, collectWikiLinks } from './sixDegrees/extractBodyLinks.js'

export async function fetchAndSanitizeWiki(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`
  const response = await fetch(url)
  const data = await response.json()

  if (data.error) throw new Error(`Wikipedia page not found: ${pageTitle}`)

  const html = data.parse.text['*']
  const $ = cheerio.load(html)
  const body = $('.mw-parser-output').first()

  // Strip the same elements the measurement extractor strips (single source of truth).
  body.find(STRIP_SELECTOR).remove()

  // validLinks via the shared collector (guarantees parity with extractBodyLinks).
  const validLinks = collectWikiLinks($, body)

  // Rewrite anchors for the playable HTML: internal -> data-wiki-target, others -> text.
  body.find('a').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (href.startsWith('/wiki/') && !href.includes(':')) {
      const title = decodeURIComponent(href.replace('/wiki/', ''))
      $(el).attr('data-wiki-target', title).attr('href', '#')
    } else {
      $(el).replaceWith($(el).text())
    }
  })

  return {
    cleanHtml: body.html(),
    validLinks: Array.from(validLinks),
    title: data.parse.title,
  }
}

export async function getRandomWikiPage() {
  const url = 'https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*'
  const res = await fetch(url)
  const data = await res.json()
  return data.query.random[0].title
}
