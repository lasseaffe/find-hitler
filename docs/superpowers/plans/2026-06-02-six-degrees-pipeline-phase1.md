# Six Degrees Pipeline — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline measurement core that computes the minimum necessary clicks from any Wikipedia page to a target (default Adolf Hitler) over the *real body-link graph the game lets players click*, plus a baseline random-sample batch that emits a distribution report and stores per-page results in Postgres.

**Architecture:** Five small library units under `src/lib/sixDegrees/` (a shared body-link extractor, title canonicalizer, disk-backed body-link cache, meet-in-the-middle distance engine, exact path verifier) + a pure report builder. A batch script crawls a random sample, upserts results into a `PageDistance` Prisma model, and writes a markdown/JSON report. The body-link cache lives on local disk (regenerable); only small per-page results go to Postgres.

**Tech Stack:** Node ESM, cheerio (HTML parsing, already a dep), Prisma 7 + Postgres (`db push` workflow), vitest 4 (DI-by-options test pattern, `vmThreads` pool), Wikipedia `action=parse` + `list=backlinks` APIs.

**Design source:** [docs/superpowers/specs/2026-06-02-six-degrees-pipeline-design.md](../specs/2026-06-02-six-degrees-pipeline-design.md)

---

## File Structure

**New — library (`src/lib/sixDegrees/`):**
- `extractBodyLinks.js` — `STRIP_SELECTOR`, `collectWikiLinks($, body)`, `extractBodyLinks(html)`. Pure, no network. The fidelity linchpin shared with the live game.
- `titleCanon.js` — `canonicalize(title)` (pure), `resolveRedirects(titles, { fetchJson })` (network, injectable).
- `bodyLinkCache.js` — `getBodyLinks(title, { fetchHtml, cache, canonicalize })`, `createDiskCache(filePath)`.
- `distanceEngine.js` — `precomputeReverseLayers(target, depth, deps)`, `measureDistance(start, target, opts)`.
- `pathVerifier.js` — `verifyPath(path, target, { getBodyLinks, canonicalize })`.
- `report.js` — `buildReport(rows)` (pure).

**Modified:**
- `src/lib/wikipedia.js` — use shared `STRIP_SELECTOR` + `collectWikiLinks` (behavior-preserving refactor).
- `prisma/schema.prisma` — add `PageDistance` model.

**New — scripts (`scripts/six-degrees/`):**
- `run-baseline.mjs` — orchestrator (sample → measure → upsert → report).
- `report.mjs` — query Postgres → write `docs/six-degrees/baseline-<date>.{md,json}`.

**New — tests (`tests/`, flat, matching existing convention):**
- `sixDegrees.extractBodyLinks.test.js`, `sixDegrees.titleCanon.test.js`, `sixDegrees.bodyLinkCache.test.js`, `sixDegrees.distanceEngine.test.js`, `sixDegrees.pathVerifier.test.js`, `sixDegrees.report.test.js`.

**Important constraint:** `tests/wikipedia.test.js` has a *pre-existing* failing test ("strips navbox, infobox, and reflist elements") because the live code intentionally keeps infobox/reflist. **Do not fix it.** The Task 2 refactor must keep `fetchAndSanitizeWiki`'s observable behavior identical — that test stays failing exactly as before, and the other 5 wikipedia tests stay passing.

**Run a single test file:** `npx vitest run tests/<file>.test.js`
**Run one test by name:** `npx vitest run tests/<file>.test.js -t "name"`

---

### Task 1: Shared body-link extractor (`extractBodyLinks`)

**Files:**
- Create: `src/lib/sixDegrees/extractBodyLinks.js`
- Test: `tests/sixDegrees.extractBodyLinks.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sixDegrees.extractBodyLinks.test.js
import { describe, it, expect } from 'vitest'
import { extractBodyLinks } from '../src/lib/sixDegrees/extractBodyLinks.js'
import { fetchAndSanitizeWiki } from '../src/lib/wikipedia.js'
import { vi, beforeEach, afterEach } from 'vitest'

const FIXTURE_HTML = `
<div class="mw-parser-output">
  <p>Brazil is a country in <a href="/wiki/South_America">South America</a>.</p>
  <p>It borders <a href="/wiki/Argentina">Argentina</a>.</p>
  <p>See also <a href="/wiki/Special:Search">search</a> and <a href="https://external.com">external</a>.</p>
  <div class="navbox"><a href="/wiki/Navbox_Link">should be stripped</a></div>
  <table class="infobox"><a href="/wiki/Infobox_Link">infobox link kept by game</a></table>
</div>
`

describe('extractBodyLinks', () => {
  it('returns internal wiki links from the body', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).toContain('South_America')
    expect(links).toContain('Argentina')
  })

  it('excludes Special: and external links', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).not.toContain('Special:Search')
    expect(links.some(l => l.includes('external.com'))).toBe(false)
  })

  it('strips navbox links (a player cannot click them)', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).not.toContain('Navbox_Link')
  })

  it('keeps infobox links (the live game keeps the infobox)', () => {
    const links = extractBodyLinks(FIXTURE_HTML)
    expect(links).toContain('Infobox_Link')
  })

  it('PARITY: matches fetchAndSanitizeWiki validLinks for the same html', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ parse: { title: 'Brazil', text: { '*': FIXTURE_HTML } } }),
    }))
    const { validLinks } = await fetchAndSanitizeWiki('Brazil')
    vi.unstubAllGlobals()
    const links = extractBodyLinks(FIXTURE_HTML)
    expect([...links].sort()).toEqual([...validLinks].sort())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sixDegrees.extractBodyLinks.test.js`
Expected: FAIL — `Failed to resolve import "../src/lib/sixDegrees/extractBodyLinks.js"`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/sixDegrees/extractBodyLinks.js
import * as cheerio from 'cheerio'

// Elements removed BEFORE link collection. Must stay identical to the strip
// rules in src/lib/wikipedia.js so the measured graph == the played graph.
// NOTE: infobox and reflist are intentionally NOT stripped (the live game keeps them).
export const STRIP_SELECTOR = [
  '.navbox', '.navbox-inner', '.navbox-subgroup', '#mw-navigation',
  '.sistersitebox', '.vertical-navbox', '.mw-editsection', '.navbar',
  'sup.reference', 'sup.noprint', '.geo-nondefault', '.geo-multi-punct',
  '.noprint', '.mw-empty-elt',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sixDegrees.extractBodyLinks.test.js`
Expected: PASS (5 passed). The PARITY test passes only once Task 2 is done if it depends on the refactor — but it should pass already because both paths use the same filter logic. If PARITY fails here, STOP and reconcile before Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/extractBodyLinks.js tests/sixDegrees.extractBodyLinks.test.js
git commit -m "feat(sixdegrees): shared body-link extractor with game-parity test"
```

---

### Task 2: Refactor `wikipedia.js` to use the shared extractor

**Files:**
- Modify: `src/lib/wikipedia.js` (the `fetchAndSanitizeWiki` function)
- Test: `tests/wikipedia.test.js` (existing — must keep same pass/fail profile)

- [ ] **Step 1: Capture the current test baseline**

Run: `npx vitest run tests/wikipedia.test.js`
Expected: 5 passed, 1 failed ("strips navbox, infobox, and reflist elements"). Record this exact profile.

- [ ] **Step 2: Refactor `fetchAndSanitizeWiki` to import the shared rules**

Replace the body of `fetchAndSanitizeWiki` in `src/lib/wikipedia.js` so the strip selector and link filter come from the shared module. The full new file top section:

```js
import * as cheerio from 'cheerio'
import { STRIP_SELECTOR, collectWikiLinks } from './sixDegrees/extractBodyLinks.js'

export async function fetchAndSanitizeWiki(pageTitle) {
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

  return {
    cleanHtml: body.html(),
    validLinks: Array.from(validLinks),
    title: data.parse.title,
  }
}
```

Leave `getRandomWikiPage` (and any other exports) below it unchanged.

- [ ] **Step 3: Run the existing wikipedia tests**

Run: `npx vitest run tests/wikipedia.test.js`
Expected: SAME profile as Step 1 — 5 passed, 1 failed (the infobox-strip test). If a *different* test now fails, the refactor changed behavior — revert and re-check the strip selector.

- [ ] **Step 4: Run the parity test from Task 1**

Run: `npx vitest run tests/sixDegrees.extractBodyLinks.test.js -t "PARITY"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wikipedia.js
git commit -m "refactor(wikipedia): source strip+link rules from shared extractor (behavior preserved)"
```

---

### Task 3: Title canonicalizer (`titleCanon`)

**Files:**
- Create: `src/lib/sixDegrees/titleCanon.js`
- Test: `tests/sixDegrees.titleCanon.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sixDegrees.titleCanon.test.js
import { describe, it, expect, vi } from 'vitest'
import { canonicalize, resolveRedirects } from '../src/lib/sixDegrees/titleCanon.js'

describe('canonicalize', () => {
  it('converts underscores to spaces and trims', () => {
    expect(canonicalize('South_America ')).toBe('South America')
  })
  it('collapses internal whitespace', () => {
    expect(canonicalize('Adolf   Hitler')).toBe('Adolf Hitler')
  })
  it('uppercases only the first character (Wikipedia rule)', () => {
    expect(canonicalize('adolf Hitler')).toBe('Adolf Hitler')
  })
  it('is idempotent', () => {
    expect(canonicalize(canonicalize('adolf_hitler'))).toBe(canonicalize('adolf_hitler'))
  })
})

describe('resolveRedirects', () => {
  it('maps each input title to its canonical redirect target', async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      query: {
        normalized: [{ from: 'hitler', to: 'Hitler' }],
        redirects: [{ from: 'Hitler', to: 'Adolf Hitler' }],
        pages: { '1': { title: 'Adolf Hitler' } },
      },
    })
    const map = await resolveRedirects(['hitler'], { fetchJson })
    expect(map.get('hitler')).toBe('Adolf Hitler')
  })

  it('returns the canonicalized title unchanged when there is no redirect', async () => {
    const fetchJson = vi.fn().mockResolvedValue({ query: { pages: { '1': { title: 'Argentina' } } } })
    const map = await resolveRedirects(['Argentina'], { fetchJson })
    expect(map.get('Argentina')).toBe('Argentina')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sixDegrees.titleCanon.test.js`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sixDegrees.titleCanon.test.js`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/titleCanon.js tests/sixDegrees.titleCanon.test.js
git commit -m "feat(sixdegrees): title canonicalizer + batched redirect resolver"
```

---

### Task 4: Body-link cache (`bodyLinkCache`)

**Files:**
- Create: `src/lib/sixDegrees/bodyLinkCache.js`
- Test: `tests/sixDegrees.bodyLinkCache.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sixDegrees.bodyLinkCache.test.js
import { describe, it, expect, vi } from 'vitest'
import { getBodyLinks, createDiskCache } from '../src/lib/sixDegrees/bodyLinkCache.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HTML = `<div class="mw-parser-output">
  <p><a href="/wiki/South_America">SA</a> and <a href="/wiki/Argentina">Arg</a></p>
</div>`

function memCache() {
  const m = new Map()
  return { has: k => m.has(k), get: k => m.get(k), set: (k, v) => m.set(k, v) }
}

describe('getBodyLinks', () => {
  it('fetches, extracts, and canonicalizes links on a miss', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(HTML)
    const links = await getBodyLinks('Brazil', { fetchHtml, cache: memCache() })
    expect(links).toContain('South America') // canonicalized (underscore -> space)
    expect(links).toContain('Argentina')
    expect(fetchHtml).toHaveBeenCalledTimes(1)
  })

  it('serves from cache on a hit without re-fetching', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(HTML)
    const cache = memCache()
    await getBodyLinks('Brazil', { fetchHtml, cache })
    await getBodyLinks('Brazil', { fetchHtml, cache })
    expect(fetchHtml).toHaveBeenCalledTimes(1)
  })

  it('returns [] when the page cannot be fetched', async () => {
    const fetchHtml = vi.fn().mockResolvedValue(null)
    const links = await getBodyLinks('Nope', { fetchHtml, cache: memCache() })
    expect(links).toEqual([])
  })
})

describe('createDiskCache', () => {
  it('persists across instances (NDJSON round-trip)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sixdeg-'))
    const file = join(dir, 'cache.ndjson')
    const c1 = createDiskCache(file)
    c1.set('Brazil', ['South America', 'Argentina'])
    const c2 = createDiskCache(file)
    expect(c2.has('Brazil')).toBe(true)
    expect(c2.get('Brazil')).toEqual(['South America', 'Argentina'])
    rmSync(dir, { recursive: true, force: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sixDegrees.bodyLinkCache.test.js`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sixDegrees.bodyLinkCache.test.js`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/bodyLinkCache.js tests/sixDegrees.bodyLinkCache.test.js
git commit -m "feat(sixdegrees): disk-backed body-link cache (NDJSON)"
```

---

### Task 5: Reverse layers precompute (`precomputeReverseLayers`)

**Files:**
- Create: `src/lib/sixDegrees/distanceEngine.js` (this function only for now)
- Test: `tests/sixDegrees.distanceEngine.test.js` (reverse-layers describe block)

- [ ] **Step 1: Write the failing test**

```js
// tests/sixDegrees.distanceEngine.test.js
import { describe, it, expect, vi } from 'vitest'
import { precomputeReverseLayers, measureDistance } from '../src/lib/sixDegrees/distanceEngine.js'

describe('precomputeReverseLayers', () => {
  it('builds confirmed body-backlink layers, rejecting navbox-only proposals', async () => {
    // Proposed predecessors (linkshere superset). 'NavOnly' proposes T but does
    // NOT body-link to it -> must be rejected.
    const getBacklinkCandidates = vi.fn(async (v) => ({
      'T': ['A', 'NavOnly'],
      'A': ['C'],
    })[v] || [])
    const getLinks = vi.fn(async (n) => ({
      'A': ['T'],          // A body-links to T -> confirmed at dist 1
      'NavOnly': ['Z'],    // does not link T -> rejected
      'C': ['A'],          // C body-links to A -> confirmed at dist 2
    })[n] || [])

    const map = await precomputeReverseLayers('T', 3, { getLinks, getBacklinkCandidates })
    expect(map.get('T')).toEqual({ dist: 0, next: null })
    expect(map.get('A')).toEqual({ dist: 1, next: 'T' })
    expect(map.get('C')).toEqual({ dist: 2, next: 'A' })
    expect(map.has('NavOnly')).toBe(false)
  })

  it('seeds target aliases at dist 0', async () => {
    const getBacklinkCandidates = vi.fn(async () => [])
    const getLinks = vi.fn(async () => [])
    const map = await precomputeReverseLayers('T', 2, {
      getLinks, getBacklinkCandidates, targetAliases: ['T alias'],
    })
    expect(map.get('T alias')).toEqual({ dist: 0, next: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sixDegrees.distanceEngine.test.js`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sixDegrees.distanceEngine.test.js`
Expected: PASS (2 passed — `measureDistance` import resolves even though untested yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/distanceEngine.js tests/sixDegrees.distanceEngine.test.js
git commit -m "feat(sixdegrees): precomputeReverseLayers (propose-then-confirm body backlinks)"
```

---

### Task 6: Meet-in-the-middle `measureDistance`

**Files:**
- Modify: `src/lib/sixDegrees/distanceEngine.js` (add `measureDistance`)
- Test: `tests/sixDegrees.distanceEngine.test.js` (add a `measureDistance` describe block)

- [ ] **Step 1: Write the failing tests (append to the existing test file)**

```js
// append to tests/sixDegrees.distanceEngine.test.js
describe('measureDistance', () => {
  // helper: forward adjacency as a plain object
  const linksFrom = (graph) => async (n) => graph[n] || []

  it('returns 0 clicks when start equals target', async () => {
    const r = await measureDistance('T', 'T', { reverseLayers: new Map([['T', { dist: 0, next: null }]]) })
    expect(r).toEqual({ minClicks: 0, path: ['T'], status: 'exact' })
  })

  it('finds a 1-click direct path via forward BFS hitting the target', async () => {
    const reverseLayers = new Map([['T', { dist: 0, next: null }]])
    const getLinks = linksFrom({ Start: ['T'] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.status).toBe('exact')
    expect(r.minClicks).toBe(1)
    expect(r.path).toEqual(['Start', 'T'])
  })

  it('meets in the middle: Start->A->B->T = 3 clicks', async () => {
    const reverseLayers = new Map([
      ['T', { dist: 0, next: null }],
      ['B', { dist: 1, next: 'T' }],
    ])
    const getLinks = linksFrom({ Start: ['A'], A: ['B'], B: ['T'] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.minClicks).toBe(3)
    expect(r.path).toEqual(['Start', 'A', 'B', 'T'])
  })

  it('uses start membership in the backward map (Start at dist 2)', async () => {
    const reverseLayers = new Map([
      ['T', { dist: 0, next: null }],
      ['M', { dist: 1, next: 'T' }],
      ['Start', { dist: 2, next: 'M' }],
    ])
    const getLinks = linksFrom({ Start: ['Other'], Other: [] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.minClicks).toBe(2)
    expect(r.path).toEqual(['Start', 'M', 'T'])
  })

  it('returns capped when the target is not found within cap (infinite chain, no meeting)', async () => {
    const reverseLayers = new Map([['T', { dist: 0, next: null }]])
    // every page links forward to a fresh page; never reaches T or a backward node
    const getLinks = async (n) => [`${n}x`]
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.status).toBe('capped')
    expect(r.minClicks).toBeNull()
  })

  it('returns unreachable when the forward component is exhausted with no meeting', async () => {
    const reverseLayers = new Map([['T', { dist: 0, next: null }]])
    const getLinks = linksFrom({ Start: [] })
    const r = await measureDistance('Start', 'T', { reverseLayers, getLinks, cap: 8, backwardDepth: 3 })
    expect(r.status).toBe('unreachable')
    expect(r.minClicks).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sixDegrees.distanceEngine.test.js`
Expected: FAIL — `measureDistance is not a function` / assertions fail (function is currently a no-op import? No — it does not exist yet). Confirm the new `measureDistance` block fails.

- [ ] **Step 3: Add the implementation to `distanceEngine.js`**

Append this export to `src/lib/sixDegrees/distanceEngine.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sixDegrees.distanceEngine.test.js`
Expected: PASS (8 passed total — 2 reverse-layers + 6 measureDistance).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/distanceEngine.js
git commit -m "feat(sixdegrees): meet-in-the-middle measureDistance (exact/capped/unreachable)"
```

---

### Task 7: Path verifier (`verifyPath`)

**Files:**
- Create: `src/lib/sixDegrees/pathVerifier.js`
- Test: `tests/sixDegrees.pathVerifier.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sixDegrees.pathVerifier.test.js
import { describe, it, expect } from 'vitest'
import { verifyPath } from '../src/lib/sixDegrees/pathVerifier.js'

const graph = { Start: ['A', 'X'], A: ['B'], B: ['Adolf Hitler'] }
const getBodyLinks = async (n) => graph[n] || []

describe('verifyPath', () => {
  it('accepts a valid path that ends at the target', async () => {
    const r = await verifyPath(['Start', 'A', 'B', 'Adolf Hitler'], 'Adolf Hitler', { getBodyLinks })
    expect(r).toEqual({ valid: true, brokenAt: null })
  })

  it('reports the index of the first severed edge', async () => {
    // A does not link to X -> edge at index 1 (A -> X) is broken
    const r = await verifyPath(['Start', 'A', 'X', 'Adolf Hitler'], 'Adolf Hitler', { getBodyLinks })
    expect(r.valid).toBe(false)
    expect(r.brokenAt).toBe(1)
  })

  it('rejects a path whose final node is not the target', async () => {
    const r = await verifyPath(['Start', 'A', 'B'], 'Adolf Hitler', { getBodyLinks })
    expect(r.valid).toBe(false)
    expect(r.brokenAt).toBe(2) // last index — endpoint mismatch
  })

  it('accepts a redirect-equivalent endpoint via canonicalize match', async () => {
    const r = await verifyPath(['Start', 'A', 'B', 'adolf_hitler'], 'Adolf Hitler', {
      getBodyLinks: async (n) => (n === 'B' ? ['adolf_hitler'] : graph[n] || []),
    })
    expect(r.valid).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sixDegrees.pathVerifier.test.js`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/sixDegrees/pathVerifier.js
import { canonicalize as defaultCanonicalize } from './titleCanon.js'

// Verifies an explicit path over the body graph. Returns { valid, brokenAt }
// where brokenAt is the index of the first node whose outgoing edge is missing,
// or the last index when the endpoint is not the target.
export async function verifyPath(path, target, {
  getBodyLinks,
  canonicalize = defaultCanonicalize,
} = {}) {
  if (!Array.isArray(path) || path.length < 2) {
    return { valid: false, brokenAt: 0 }
  }
  for (let i = 0; i < path.length - 1; i++) {
    const links = (await getBodyLinks(path[i])).map(canonicalize)
    if (!links.includes(canonicalize(path[i + 1]))) {
      return { valid: false, brokenAt: i }
    }
  }
  const last = canonicalize(path[path.length - 1])
  if (last !== canonicalize(target)) {
    return { valid: false, brokenAt: path.length - 1 }
  }
  return { valid: true, brokenAt: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sixDegrees.pathVerifier.test.js`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/pathVerifier.js tests/sixDegrees.pathVerifier.test.js
git commit -m "feat(sixdegrees): exact path verifier over the body graph"
```

---

### Task 8: Report builder (`buildReport`)

**Files:**
- Create: `src/lib/sixDegrees/report.js`
- Test: `tests/sixDegrees.report.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/sixDegrees.report.test.js
import { describe, it, expect } from 'vitest'
import { buildReport } from '../src/lib/sixDegrees/report.js'

const rows = [
  { startTitle: 'Coffee', minClicks: 2, status: 'exact' },
  { startTitle: 'Penguin', minClicks: 3, status: 'exact' },
  { startTitle: 'Jazz', minClicks: 6, status: 'exact' },
  { startTitle: 'Obscure Stub', minClicks: 7, status: 'exact' },
  { startTitle: 'Island Page', minClicks: null, status: 'capped' },
]

describe('buildReport', () => {
  it('counts the histogram by click count', () => {
    const r = buildReport(rows)
    expect(r.histogram[2]).toBe(1)
    expect(r.histogram[3]).toBe(1)
    expect(r.histogram[6]).toBe(1)
    expect(r.histogram[7]).toBe(1)
  })

  it('computes percent reachable within six clicks (exact rows only)', () => {
    const r = buildReport(rows)
    // exact rows: 2,3,6,7 -> within six = 3 of 4 = 75%
    expect(r.pctWithinSix).toBe(75)
    expect(r.exactCount).toBe(4)
  })

  it('lists violations (minClicks >= 7 or capped/unreachable)', () => {
    const r = buildReport(rows)
    const titles = r.violations.map(v => v.startTitle)
    expect(titles).toContain('Obscure Stub')
    expect(titles).toContain('Island Page')
    expect(titles).not.toContain('Jazz')
  })

  it('reports median, mean, and max over exact rows', () => {
    const r = buildReport(rows)
    expect(r.max).toBe(7)
    expect(r.median).toBe(4.5) // median of [2,3,6,7]
    expect(r.mean).toBe(4.5)   // (2+3+6+7)/4
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sixDegrees.report.test.js`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/sixDegrees/report.js

// Pure aggregation over PageDistance-like rows: { startTitle, minClicks, status }.
export function buildReport(rows, { withinThreshold = 6, violationThreshold = 7 } = {}) {
  const exact = rows.filter(r => r.status === 'exact' && typeof r.minClicks === 'number')
  const clicks = exact.map(r => r.minClicks).sort((a, b) => a - b)

  const histogram = {}
  for (const c of clicks) histogram[c] = (histogram[c] || 0) + 1

  const within = clicks.filter(c => c <= withinThreshold).length
  const pctWithinSix = clicks.length ? Math.round((within / clicks.length) * 1000) / 10 : 0

  const sum = clicks.reduce((a, b) => a + b, 0)
  const mean = clicks.length ? Math.round((sum / clicks.length) * 100) / 100 : 0
  const median = clicks.length
    ? (clicks.length % 2
        ? clicks[(clicks.length - 1) / 2]
        : (clicks[clicks.length / 2 - 1] + clicks[clicks.length / 2]) / 2)
    : 0
  const max = clicks.length ? clicks[clicks.length - 1] : 0

  const violations = rows
    .filter(r => r.status !== 'exact' || r.minClicks >= violationThreshold)
    .map(r => ({ startTitle: r.startTitle, minClicks: r.minClicks, status: r.status }))
    .sort((a, b) => (b.minClicks || Infinity) - (a.minClicks || Infinity))

  return { total: rows.length, exactCount: exact.length, histogram, pctWithinSix, mean, median, max, violations }
}

// Render a markdown report from a buildReport() result.
export function renderMarkdown(report, { sampleSize, target, cap, date }) {
  const hist = Object.keys(report.histogram)
    .map(Number).sort((a, b) => a - b)
    .map(c => `| ${c} | ${report.histogram[c]} |`).join('\n')
  const viol = report.violations
    .map(v => `- ${v.startTitle} — ${v.status === 'exact' ? `${v.minClicks} clicks` : v.status}`)
    .join('\n')
  return `# Six Degrees Baseline — ${date}

**Target:** ${target}  **Sample:** ${sampleSize}  **Cap:** ${cap}

## Headline
**${report.pctWithinSix}%** of measured pages reach the target in **≤ 6 clicks** (of ${report.exactCount} exactly-measured pages).

Median: ${report.median} · Mean: ${report.mean} · Max observed: ${report.max}

## Distribution
| clicks | pages |
|---|---|
${hist}

## Six-clicks violators (≥ 7 clicks, capped, or unreachable)
${viol || '_none_'}

## Method
Distances measured over the real body-link graph (the links the live game lets players click), via meet-in-the-middle BFS with a depth cap of ${cap}. "Capped" = minimum exceeds the cap. Wikipedia is a moving snapshot; results reflect the crawl date.
`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sixDegrees.report.test.js`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sixDegrees/report.js tests/sixDegrees.report.test.js
git commit -m "feat(sixdegrees): pure report builder + markdown renderer"
```

---

### Task 9: `PageDistance` Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Append to `prisma/schema.prisma`:

```prisma
model PageDistance {
  id           String   @id @default(cuid())
  startTitle   String
  target       String   @default("Adolf Hitler")
  minClicks    Int?     // null when status != "exact"
  shortestPath String[] @default([]) // one concrete optimal path; [] when unknown
  status       String   // "exact" | "capped" | "unreachable"
  source       String   @default("baseline") // baseline | game | submission (later phases)
  measuredAt   DateTime @default(now())

  @@unique([startTitle, target])
  @@index([target, minClicks])
}
```

- [ ] **Step 2: Validate the schema**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀".

- [ ] **Step 3: Push to the database and regenerate the client**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." followed by client generation. (Requires `DATABASE_URL` in `.env.local` — already present. This project uses `db push`, not `migrate`.)

- [ ] **Step 4: Verify the client has the model**

Run: `node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); console.log(typeof p.pageDistance.findMany)"`
Expected: `function`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(sixdegrees): PageDistance model (growth-ready: source + upsert key)"
```

---

### Task 10: Baseline batch runner + report writer

**Files:**
- Create: `scripts/six-degrees/run-baseline.mjs`
- Create: `scripts/six-degrees/report.mjs`

- [ ] **Step 1: Write the report writer script**

```js
// scripts/six-degrees/report.mjs
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'
import { buildReport, renderMarkdown } from '../../src/lib/sixDegrees/report.js'

const prisma = new PrismaClient()

export async function writeReport({ target = 'Adolf Hitler', cap = 8 } = {}) {
  const rows = await prisma.pageDistance.findMany({ where: { target, source: 'baseline' } })
  const report = buildReport(rows)
  const date = new Date().toISOString().slice(0, 10)
  mkdirSync('docs/six-degrees', { recursive: true })
  const md = renderMarkdown(report, { sampleSize: rows.length, target, cap, date })
  writeFileSync(`docs/six-degrees/baseline-${date}.md`, md)
  writeFileSync(`docs/six-degrees/baseline-${date}.json`, JSON.stringify(report, null, 2))
  console.log(`Report written: docs/six-degrees/baseline-${date}.md (${rows.length} pages, ${report.pctWithinSix}% within 6)`)
  return report
}

// Allow direct invocation: node scripts/six-degrees/report.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  writeReport().then(() => prisma.$disconnect())
}
```

- [ ] **Step 2: Write the baseline runner**

```js
// scripts/six-degrees/run-baseline.mjs
// Usage: node scripts/six-degrees/run-baseline.mjs --sample 1000 --cap 8 --backward-depth 3 --concurrency 4
import { PrismaClient } from '@prisma/client'
import { getRandomWikiPage } from '../../src/lib/wikipedia.js'
import { createDiskCache, getBodyLinks } from '../../src/lib/sixDegrees/bodyLinkCache.js'
import { precomputeReverseLayers, measureDistance } from '../../src/lib/sixDegrees/distanceEngine.js'
import { canonicalize } from '../../src/lib/sixDegrees/titleCanon.js'
import { writeReport } from './report.mjs'

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : def
}

const SAMPLE = Number(arg('sample', 1000))
const TARGET = arg('target', 'Adolf Hitler')
const CAP = Number(arg('cap', 8))
const BACKWARD = Number(arg('backward-depth', 3))
const CONCURRENCY = Number(arg('concurrency', 4))
const CACHE_FILE = '.cache/six-degrees/bodylinks.ndjson'

const prisma = new PrismaClient()
const cache = createDiskCache(CACHE_FILE)
const links = (title) => getBodyLinks(title, { cache })

// Simple polite throttle: bounded concurrency over a task list.
async function mapLimit(items, limit, fn) {
  const results = []
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const cur = idx++
      results[cur] = await fn(items[cur], cur)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

async function main() {
  console.log(`Precomputing reverse layers for "${TARGET}" (depth ${BACKWARD})...`)
  const reverseLayers = await precomputeReverseLayers(TARGET, BACKWARD, { getLinks: links })
  console.log(`Reverse map size: ${reverseLayers.size}`)

  // Draw a deduped random sample (skip pages already measured).
  const titles = new Set()
  while (titles.size < SAMPLE) {
    const t = canonicalize(await getRandomWikiPage())
    if (titles.has(t)) continue
    const existing = await prisma.pageDistance.findUnique({
      where: { startTitle_target: { startTitle: t, target: TARGET } },
    })
    if (existing) continue
    titles.add(t)
  }

  let done = 0
  await mapLimit([...titles], CONCURRENCY, async (start) => {
    const { minClicks, path, status } = await measureDistance(start, TARGET, {
      cap: CAP, backwardDepth: BACKWARD, reverseLayers, getLinks: links,
    })
    await prisma.pageDistance.upsert({
      where: { startTitle_target: { startTitle: start, target: TARGET } },
      update: { minClicks, shortestPath: path, status, source: 'baseline', measuredAt: new Date() },
      create: { startTitle: start, target: TARGET, minClicks, shortestPath: path, status, source: 'baseline' },
    })
    done++
    if (done % 25 === 0) console.log(`  measured ${done}/${titles.size}`)
  })

  console.log(`Measured ${done} pages. Writing report...`)
  await writeReport({ target: TARGET, cap: CAP })
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 3: Lint the script files**

Run: `npx eslint scripts/six-degrees/run-baseline.mjs scripts/six-degrees/report.mjs`
Expected: no errors (warnings acceptable).

- [ ] **Step 4: Tiny smoke run (sample 5)**

Run: `node scripts/six-degrees/run-baseline.mjs --sample 5 --cap 8 --backward-depth 3 --concurrency 2`
Expected: logs "Precomputing reverse layers...", a reverse-map size > 0, "measured" progress, and "Report written: docs/six-degrees/baseline-<date>.md". Open the markdown to confirm it has a headline %, a distribution table, and a method note. (This makes live Wikipedia calls — run once, manually.)

> If the reverse-map size is 0 or all pages come back `capped`, the most likely cause is the `linkshere`/`backlinks` candidate confirmation rejecting everything — re-check that `getLinks` in the runner points at the cache-backed `links` helper (it does above) and that canonicalization is consistent on both sides.

- [ ] **Step 5: Commit (script + smoke report + cache ignore)**

```bash
echo ".cache/" >> .gitignore
git add scripts/six-degrees/ docs/six-degrees/ .gitignore
git commit -m "feat(sixdegrees): baseline batch runner + report writer (smoke verified)"
```

---

### Task 11: Full suite + add npm scripts

**Files:**
- Modify: `package.json` (scripts)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all sixDegrees tests pass; the overall profile is the prior baseline PLUS the new passing tests, with the **one** known pre-existing `wikipedia.test.js` infobox failure unchanged (no NEW failures introduced).

- [ ] **Step 2: Add convenience scripts to `package.json`**

In the `"scripts"` block add:

```json
    "six:baseline": "node scripts/six-degrees/run-baseline.mjs",
    "six:report": "node scripts/six-degrees/report.mjs"
```

- [ ] **Step 3: Verify the scripts resolve**

Run: `npm run six:report`
Expected: writes/refreshes `docs/six-degrees/baseline-<date>.{md,json}` from whatever is already in Postgres (may be the smoke rows).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(sixdegrees): npm scripts for baseline + report"
```

---

## Self-Review

**Spec coverage:**
- §2.1 body-graph fidelity → Tasks 1, 2 (shared extractor + parity test). ✓
- §2.2 verified-minimum vs best-user-path → Task 6 (`measureDistance` = verified min); Task 7 (`verifyPath` = the primitive Phase 3's best-user-path reuses). ✓
- §2.3 offline precompute → Tasks 5, 10. ✓
- §2.4 storage split (cache→disk, results→Postgres) → Task 4 (disk NDJSON), Task 9 (Postgres). ✓
- §2.5 meet-in-the-middle + propose-then-confirm → Tasks 5, 6. ✓
- §3.1 extractBodyLinks → Task 1. §3.2 titleCanon → Task 3. §3.3 bodyLinkCache → Task 4. §3.4 distanceEngine → Tasks 5, 6. §3.5 pathVerifier → Task 7. §3.6 target-parameterized → all engine fns take `target`. ✓
- §4 PageDistance model → Task 9. ✓
- §5 batch runner + report → Tasks 8, 10. ✓
- §6 testing (injected fetchers, zero live calls in unit tests, parity, statuses, redirect canon) → Tasks 1, 3, 6, 7. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code; no "add error handling" hand-waves; no references to undefined symbols.

**Type/signature consistency:**
- `canonicalize` used identically (single arg → string) in Tasks 3–7, 10. ✓
- `getBodyLinks(title, { fetchHtml, cache, canonicalize })` (Task 4) matches the cache-backed `links` helper in Task 10. ✓
- `reverseLayers` shape `Map<canon,{dist,next}>` produced by `precomputeReverseLayers` (Task 5) and consumed by `measureDistance` (Task 6) and the runner (Task 10). ✓
- `measureDistance` return `{ minClicks, path, status }` matches the upsert fields in Task 10 and `buildReport`'s row shape `{ startTitle, minClicks, status }` in Task 8. ✓
- Prisma upsert uses compound `startTitle_target` — matches `@@unique([startTitle, target])` in Task 9. ✓
- `writeReport`/`renderMarkdown`/`buildReport` signatures consistent across Tasks 8 and 10. ✓

No issues found.