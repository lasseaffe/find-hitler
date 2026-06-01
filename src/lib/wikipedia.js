import * as cheerio from 'cheerio'

export async function fetchAndSanitizeWiki(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`
  const response = await fetch(url)
  const data = await response.json()

  if (data.error) throw new Error(`Wikipedia page not found: ${pageTitle}`)

  const html = data.parse.text['*']
  const $ = cheerio.load(html)
  // Wikipedia's parse API returns the content as a top-level mw-parser-output div
  // (not wrapped in #mw-content-text like the full page HTML)
  const body = $('.mw-parser-output').first()

  // Strip navigation/cheat elements. Keep: hatnotes (authentic), infobox (authentic), reflist (authentic but dimmed via CSS).
  body.find('.navbox, .navbox-inner, .navbox-subgroup, #mw-navigation, .sistersitebox, .vertical-navbox').remove()
  // Remove [edit] section links
  body.find('.mw-editsection').remove()
  // Remove navbox "v t e" abbreviation remnants
  body.find('.navbar').remove()
  // Remove reference superscripts in body text (clutter without footnote targets)
  body.find('sup.reference, sup.noprint').remove()
  // Remove coordinates, geo spans, maintenance tags
  body.find('.geo-nondefault, .geo-multi-punct, .noprint, .mw-empty-elt').remove()

  const validLinks = new Set()

  body.find('a').each((_, el) => {
    const href = $(el).attr('href') || ''

    if (href.startsWith('/wiki/') && !href.includes(':')) {
      const title = decodeURIComponent(href.replace('/wiki/', ''))
      validLinks.add(title)
      $(el).attr('data-wiki-target', title).attr('href', '#')
    } else {
      // Strip non-game links but preserve their visible text
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
