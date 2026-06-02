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

// Meet-in-the-middle BFS. reverseLayers = Map<canon, { dist, next }> from
// precomputeReverseLayers. Forward-BFS only to depth (cap - backwardDepth);
// any true shortest path L <= cap has its node at forward depth (L - backwardDepth)
// inside that range, so the minimum is found exactly.
export async function measureDistance(start, target, {
  cap = 8,
  backwardDepth = 3,
  reverseLayers,
  getLinks = defaultGetLinks,
  canonicalize = defaultCanonicalize,
} = {}) {
  if (!reverseLayers) throw new Error('measureDistance requires reverseLayers')
  const s = canonicalize(start)
  const t = canonicalize(target)
  if (s === t) return { minClicks: 0, path: [start], status: 'exact' }

  const backMap = reverseLayers
  const parent = new Map()        // canon -> forward parent canon
  const seen = new Set([s])
  let best = Infinity
  let meetNode = null

  if (backMap.has(s)) { best = backMap.get(s).dist; meetNode = s }

  const fMax = Math.max(0, cap - backwardDepth)
  let frontier = [s]
  let exhausted = false

  for (let f = 1; f <= fMax; f++) {
    if (f >= best) break // deeper nodes can only yield >= best (min backDist is 1)
    const nextFrontier = []
    for (const u of frontier) {
      const links = (await getLinks(u)).map(canonicalize)
      for (const v of links) {
        if (seen.has(v)) continue
        seen.add(v)
        parent.set(v, u)
        nextFrontier.push(v)
        if (backMap.has(v)) {
          const cand = f + backMap.get(v).dist
          if (cand < best) { best = cand; meetNode = v }
        }
      }
    }
    frontier = nextFrontier
    if (frontier.length === 0) { exhausted = true; break }
  }

  if (best <= cap && meetNode !== null) {
    const fwd = []
    let cur = meetNode
    while (cur != null) {
      fwd.push(cur)
      if (cur === s) break
      cur = parent.get(cur)
    }
    fwd.reverse()
    const back = []
    let bn = backMap.get(meetNode).next
    while (bn != null) { back.push(bn); bn = backMap.get(bn)?.next }
    return { minClicks: best, path: [...fwd, ...back], status: 'exact' }
  }

  if (exhausted) return { minClicks: null, path: [], status: 'unreachable' }
  return { minClicks: null, path: [], status: 'capped' }
}
