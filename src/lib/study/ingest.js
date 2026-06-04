import * as cheerio from 'cheerio'
import { fetchAndSanitizeWiki } from '../wikipedia.js'
import { htmlToPlainText } from '../factCheckerGen.js'
import { callGenerateLLM } from '../llm.js'

const WIKI_RE = /^https?:\/\/en\.wikipedia\.org\/wiki\/.+/

/**
 * Determine ingestion lane from request input.
 * @returns {'wiki'|'paste'|'ai-gen'|'url'|'file'|'existing'}
 */
export function detectIngestType(input) {
  if (input.articleId) return 'existing'
  if (input.file)      return 'file'
  const str = (input.text ?? '').trim()
  if (!str) throw new Error('No input provided')
  if (WIKI_RE.test(str))        return 'wiki'
  if (/^https?:\/\//.test(str)) return 'url'
  if (str.length > 80)          return 'paste'
  return 'ai-gen'
}

/** Wikipedia URL → { text, title } */
export async function ingestWiki(url, deps = {}) {
  const fetchWiki = deps.fetchWiki ?? fetchAndSanitizeWiki
  const rawTitle = url.split('/wiki/')[1]?.split('#')[0] ?? ''
  if (!rawTitle) throw new Error(`Invalid Wikipedia URL: ${url}`)
  // Decode percent-encoding so the title is human-readable (e.g. Porter's_five_forces_analysis)
  const decodedTitle = decodeURIComponent(rawTitle)
  const { cleanHtml } = await fetchWiki(decodedTitle)
  return { text: htmlToPlainText(cleanHtml), title: decodedTitle }
}

/** Raw pasted text → { text, title } — no network calls */
export function ingestPaste(text) {
  const trimmed = text.trim()
  if (trimmed.length < 80) throw new Error('Pasted text is too short (minimum 80 characters)')
  return { text: trimmed, title: trimmed.slice(0, 60).replace(/\n/g, ' ') }
}

/** Short topic string → LLM-generated study article → { text, title } */
export async function ingestAiGen(topic, grade = '', subject = '', deps = {}) {
  const callLLM = deps.callLLM ?? callGenerateLLM
  const gradeLabel   = grade   ? ` appropriate for ${grade} level` : ''
  const subjectLabel = subject ? ` ${subject}` : ''
  const prompt = `Write a factual, educational study article about "${topic}"${gradeLabel}${subjectLabel} students. Write 400–600 words in clear prose. Include key definitions, important facts, dates, and figures. Flowing paragraphs only — no headings, no bullet points. Return only the article text.`
  const text = await callLLM(prompt)
  return { text: text.trim(), title: topic.slice(0, 80) }
}

/** Any URL → scrape main content → LLM study article → { text, title } */
export async function ingestUrl(url, deps = {}) {
  const fetcher = deps.fetch   ?? (u => fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }))
  const callLLM = deps.callLLM ?? callGenerateLLM
  const res = await fetcher(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)
  $('nav, footer, script, style, header, aside, [class*="ad"]').remove()
  const raw = ($('article, main, [role="main"], .content, body').first().text())
    .replace(/\s+/g, ' ').trim()
  if (raw.length < 200) throw new Error('Could not extract meaningful content from URL')
  const prompt = `Based on the following source text, write a factual educational study article of 400–600 words covering key concepts, definitions, and facts. Clear prose, no headings, no bullet points.\n\n${raw.slice(0, 8000)}`
  const text = await callLLM(prompt)
  return { text: text.trim(), title: $('title').text().slice(0, 80) || url.slice(0, 80) }
}
