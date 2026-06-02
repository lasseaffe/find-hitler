// src/lib/sixDegrees/titleCanon.js

// Pure normalization to Wikipedia's title form: underscores->spaces, trim,
// collapse whitespace, uppercase first character only.
export function canonicalize(title) {
  const t = String(title).replace(/_/g, ' ').trim().replace(/\s+/g, ' ')
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

const WIKI_API = 'https://en.wikipedia.org/w/api.php'

async function defaultFetchJson(titles) {
  const url = `${WIKI_API}?action=query&redirects=1&format=json`
    + `&titles=${encodeURIComponent(titles.join('|'))}`
  const res = await fetch(url, { headers: { 'User-Agent': 'find-hitler-sixdegrees/1.0 (research)' } })
  return res.json()
}

// Batch-resolve redirects. Returns Map<inputTitle, canonicalResolvedTitle>.
// Up to 50 titles per call (API limit for anonymous requests).
export async function resolveRedirects(titles, { fetchJson = defaultFetchJson } = {}) {
  const out = new Map()
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50)
    const data = await fetchJson(batch)
    const normalized = new Map((data.query?.normalized || []).map(n => [n.from, n.to]))
    const redirects = new Map((data.query?.redirects || []).map(r => [r.from, r.to]))
    for (const input of batch) {
      const afterNorm = normalized.get(input) || canonicalize(input)
      const afterRedir = redirects.get(afterNorm) || afterNorm
      out.set(input, canonicalize(afterRedir))
    }
  }
  return out
}
