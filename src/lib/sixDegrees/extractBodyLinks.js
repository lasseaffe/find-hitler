// src/lib/sixDegrees/extractBodyLinks.js
import * as cheerio from 'cheerio'

// Elements removed BEFORE link collection. Must stay identical to the strip
// rules in src/lib/wikipedia.js so the measured graph == the played graph.
// NOTE: the infobox is intentionally KEPT (high-value, intuitive navigation).
// Reference lists (.reflist/.references) ARE stripped — citation-list links are
// tangential "wasted" clicks, not real navigation. Inline [n] markers are the
// sup.reference entries below.
export const STRIP_SELECTOR = [
  '.navbox', '.navbox-inner', '.navbox-subgroup', '#mw-navigation',
  '.sistersitebox', '.vertical-navbox', '.mw-editsection', '.navbar',
  'sup.reference', 'sup.noprint', '.geo-nondefault', '.geo-multi-punct',
  '.noprint', '.mw-empty-elt',
  '.reflist', '.references', '.refbegin', 'ol.references',
].join(', ')

// Collect internal wiki link targets (decoded) from an already-stripped body node.
export function collectWikiLinks($, body) {
  const links = new Set()
  body.find('a').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (href.startsWith('/wiki/') && !href.includes(':')) {
      links.add(decodeURIComponent(href.replace('/wiki/', '')))
    }
  })
  return links
}

// Pure: raw parser-output HTML -> array of clickable body-link titles.
export function extractBodyLinks(html) {
  const $ = cheerio.load(html)
  const body = $('.mw-parser-output').first()
  body.find(STRIP_SELECTOR).remove()
  return Array.from(collectWikiLinks($, body))
}