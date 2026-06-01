import * as cheerio from 'cheerio'

export async function fetchAndSanitizeWiki(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=text&format=json&origin=*`
  const response = await fetch(url)
  const data = await response.json()

  if (data.error) throw new Error(`Wikipedia page not found: ${pageTitle}`)

  const html = data.parse.text['*']
  const $ = cheerio.load(html)
  const body = $('#mw-content-text')

  // Strip Wikipedia UI elements that could be used for navigation or cheating
  body.find('.navbox, .infobox, .reflist, .reference, #mw-navigation, .sistersitebox, .ambox, .hatnote').remove()
  body.find('sup.reference').remove()

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
