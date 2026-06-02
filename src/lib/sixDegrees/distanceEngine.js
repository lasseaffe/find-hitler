// src/lib/sixDegrees/distanceEngine.js
import { canonicalize as defaultCanonicalize } from './titleCanon.js'

const WIKI_API = 'https://en.wikipedia.org/w/api.php'
const UA = 'find-hitler-sixdegrees/1.0 (https://six-clicks.onrender.com; research)'

async function defaultGetLinks(title) {
  const { getBodyLinks } = await import('./bodyLinkCache.js')
  return getBodyLinks(title)
}

async function defaultGetBacklinkCandidates(title) {
  const url = `${WIKI_API}?action=query&list=backlinks&blnamespace=0&bllimit=500&format=json`
    + `&bltitle=${encodeURIComponent(title)}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  const data = await res.json()
  return (data.query?.backlinks || []).map(b => b.title)
}

// Map<canonTitle, { dist, next }>. next = neighbor one step closer to target.
export async function precomputeReverseLayers(target, depth, {
  getLinks = defaultGetLinks,
  getBacklinkCandidates = defaultGetBacklinkCandidates,
  canonicalize = defaultCanonicalize,
  targetAliases = [],
} = {}) {
  const map = new Map()
  const t = canonicalize(target)
  map.set(t, { dist: 0, next: null })
  for (const alias of targetAliases) {
    const a = canonicalize(alias)
    if (!map.has(a)) map.set(a, { dist: 0, next: null })
  }

  let frontier = [t]
  for (let d = 1; d <= depth; d++) {
    const next = []
    for (const v of frontier) {
      const candidates = await getBacklinkCandidates(v)
      for (const cRaw of candidates) {
        const c = canonicalize(cRaw)
        if (map.has(c)) continue
        const cLinks = (await getLinks(c)).map(canonicalize)
        if (cLinks.includes(v)) {
          map.set(c, { dist: d, next: v })
          next.push(c)
        }
      }
    }
    frontier = next
    if (frontier.length === 0) break
  }
  return map
}
