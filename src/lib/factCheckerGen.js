import * as cheerio from 'cheerio'

// How many sections (beyond the lead) each difficulty includes.
const SECTION_BUDGET = { easy: 0, medium: 3, hard: Infinity, hardcore: Infinity }

// Strip the infobox + keep N sections after the lead, per difficulty.
// "Lead" = top-level nodes before the first <h2>. Sections are delimited by <h2>.
// Single pass: once we've seen more than `budget` <h2> headings, drop everything onward.
export function trimByDifficulty(html, difficulty) {
  const $ = cheerio.load(html, null, false)
  $('.infobox, table.infobox').remove()

  const budget = SECTION_BUDGET[difficulty] ?? SECTION_BUDGET.medium
  if (budget === Infinity) return $.html()

  let h2seen = 0
  $.root().children().each((_, el) => {
    const $el = $(el)
    if ($el.is('h2')) h2seen += 1
    if (h2seen > budget) $el.remove()
  })
  return $.html()
}

export function htmlToPlainText(html) {
  const $ = cheerio.load(html, null, false)
  return $.root().text().replace(/\s+/g, ' ').trim()
}
