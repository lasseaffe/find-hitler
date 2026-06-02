// src/lib/sixDegrees/bodyLinkCache.js
import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { extractBodyLinks } from './extractBodyLinks.js'
import { canonicalize as defaultCanonicalize } from './titleCanon.js'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const UA = 'find-hitler-sixdegrees/1.0 (https://six-clicks.onrender.com; research)'

async function defaultFetchHtml(title) {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const data = await res.json()
  if (data.error || !data.parse?.text?.['*']) return null
  return data.parse.text['*']
}

// Disk cache: append-only NDJSON, loaded into a Map on construction.
export function createDiskCache(filePath) {
  const map = new Map()
  if (existsSync(filePath)) {
    for (const line of readFileSync(filePath, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        const { title, links } = JSON.parse(line)
        map.set(title, links)
      } catch { /* skip corrupt line */ }
    }
  } else {
    mkdirSync(dirname(filePath), { recursive: true })
  }
  return {
    has: title => map.has(title),
    get: title => map.get(title),
    set: (title, links) => {
      map.set(title, links)
      appendFileSync(filePath, JSON.stringify({ title, links }) + '\n')
    },
  }
}

// Returns canonicalized body-link titles for a page, using the cache.
export async function getBodyLinks(title, {
  fetchHtml = defaultFetchHtml,
  cache,
  canonicalize = defaultCanonicalize,
} = {}) {
  const key = canonicalize(title)
  if (cache && cache.has(key)) return cache.get(key)
  const html = await fetchHtml(title)
  const links = html ? extractBodyLinks(html).map(canonicalize) : []
  if (cache) cache.set(key, links)
  return links
}
