import * as cheerio from 'cheerio'
import { STRIP_SELECTOR, collectWikiLinks } from './sixDegrees/extractBodyLinks.js'

export async function fetchAndSanitizeWiki(pageTitle, targetTitle = null) {
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
