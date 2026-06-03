import * as cheerio from 'cheerio'

export async function fetchAndSanitizeWiki(pageTitle, targetTitle = null) {
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

  // If the target name appears as plain text (no hyperlink), inject clickable <a> tags
  // so the player isn't blocked when they can see the target but can't click it.
  if (targetTitle) {
    const targetText = decodeURIComponent(targetTitle).replace(/_/g, ' ')
    const wikiKey = targetText.replace(/ /g, '_')
    const alreadyLinked = validLinks.has(wikiKey) || validLinks.has(targetText)

    if (!alreadyLinked) {
      const escaped = targetText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'gi')
      let injected = false

      function injectInto(node) {
        $(node).contents().each((_, child) => {
          if (child.type === 'text') {
            const newHtml = child.data.replace(regex, (match) =>
              `<a data-wiki-target="${wikiKey}" href="#">${match}</a>`
            )
            if (newHtml !== child.data) {
              $(child).replaceWith(newHtml)
              injected = true
            }
          } else if (child.type === 'tag' && child.name !== 'a') {
            injectInto(child)
          }
        })
      }

      injectInto(body[0])
      if (injected) validLinks.add(wikiKey)
    }
  }

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

export async function validateWikiTitle(title) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
    )
    if (!res.ok) return { valid: false }
    const data = await res.json()
    return {
      valid: true,
      canonicalTitle: data.titles?.normalized || data.title || title,
      extract: data.extract || '',
    }
  } catch {
    return { valid: false }
  }
}

export async function findStartPageAtDistance(
  target,
  minHops,
  maxHops,
  {
    fetchRandomPage = getRandomWikiPage,
    measureDistance = async (page, tgt) => {
      const { calculateHpDamage } = await import('./bfsDistance.js')
      return calculateHpDamage(page, tgt)
    },
    timeoutMs = 3000,
  } = {}
) {
  const DAMAGE_PER_HOP = 500
  const deadline = Date.now() + timeoutMs
  let lastPage = await fetchRandomPage()

  while (Date.now() < deadline) {
    const damage = await measureDistance(lastPage, target)
    const hops = damage / DAMAGE_PER_HOP
    if (hops >= minHops && hops <= maxHops) return lastPage
    if (Date.now() >= deadline) break
    lastPage = await fetchRandomPage()
  }

  return lastPage // fallback
}
