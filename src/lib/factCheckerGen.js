import * as cheerio from 'cheerio'
import { randomUUID } from 'node:crypto'

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

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

// Wrap the FIRST exact occurrence of `find` in a text node. Returns the fcId if wrapped,
// or null if `find` was not found anywhere (→ caller discards the item, guaranteeing that
// every recorded mistake corresponds to a real, reachable region).
// The visible text is HTML-escaped so a false value can never inject markup; `before`/`after`
// are the surrounding slices of the same parsed text node, re-inserted verbatim.
function wrapFirstOccurrence($, find, isMistake, replacement) {
  const fcId = randomUUID()
  let wrapped = false
  $('*').contents().each((_, node) => {
    if (wrapped || node.type !== 'text') return
    const idx = node.data.indexOf(find)
    if (idx === -1) return
    const before = node.data.slice(0, idx)
    const after = node.data.slice(idx + find.length)
    const visible = escapeHtml(replacement ?? find)
    const span = `<span data-fc-id="${fcId}" data-fc-mistake="${isMistake ? 'true' : 'false'}">${visible}</span>`
    $(node).replaceWith(before + span + after)
    wrapped = true
  })
  return wrapped ? fcId : null
}

export function wrapAndValidate(html, llm) {
  const $ = cheerio.load(html, null, false)
  const mistakes = []
  const decoys = []

  for (const m of llm?.mistakes ?? []) {
    if (!m?.find || !m?.replacement) continue
    const fcId = wrapFirstOccurrence($, m.find, true, m.replacement)
    if (fcId) mistakes.push({ fcId, span: m.replacement, correct: m.find, explanation: m.explanation ?? '' })
  }
  for (const d of llm?.decoys ?? []) {
    if (!d?.find) continue
    const fcId = wrapFirstOccurrence($, d.find, false, null)
    if (fcId) decoys.push({ fcId, span: d.find })
  }

  return { tampered: $.html(), mistakes, decoys }
}
