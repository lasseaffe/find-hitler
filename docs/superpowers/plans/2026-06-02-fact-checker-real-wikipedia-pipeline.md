# Fact Checker — Real Wikipedia Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Fact Checker ("spot the tampered facts") mode on a real-Wikipedia content pipeline, fixing the unwinnable-mistake scoring bug and making difficulty real.

**Architecture:** Real Wikipedia articles are fetched via the existing `fetchAndSanitizeWiki`, trimmed by difficulty, and sent (as plain text) to Claude, which returns phrases to falsify. The pipeline deterministically wraps each located phrase in `<span data-fc-id data-fc-mistake>` (discarding any phrase it can't locate, so every saved mistake is reachable), stores the article as `pending`, and an admin approves it. Scoring matches by `data-fc-id` (clicks) or guarded text-overlap (free-select). All risky logic is extracted into pure functions in `src/lib/`; React/route layers are thin wrappers.

**Tech Stack:** Next.js (App Router, custom `server.js`), Prisma 7 + pg adapter (Postgres/Supabase), cheerio, `@anthropic-ai/sdk` (new), vitest (node env, `vmThreads` pool).

---

## Project facts the engineer must know

- **Project root:** `C:\Users\lasse\Desktop\find-hitler`. Dev server on **port 3004** (`npm run dev` → `node server.js`). This is its own repo on branch `master` — NOT holyflex/whatscooking/venturepath.
- **Tests:** `npx vitest run tests/<file>.js`. Node environment, no DOM. Therefore React components and Next route handlers are **not** unit-tested here; their logic is extracted into pure `src/lib` functions that ARE tested, and the thin wrappers are verified by running the app.
- **DB access:** `import { prisma } from '@/lib/db'` (lazy Proxy singleton; safe to import without `DATABASE_URL`).
- **Prisma schema:** `prisma/schema.prisma`; datasource URL wired from `.env.local` via `prisma.config.ts`. Apply schema changes with `npx prisma db push` then `npx prisma generate`.
- **Known pre-existing red test (OUT OF SCOPE):** `tests/wikipedia.test.js > "strips navbox, infobox, and reflist"` currently FAILS on `master` — `src/lib/wikipedia.js` intentionally keeps the infobox for the racing game. Do NOT modify `wikipedia.js`; our pipeline strips the infobox on its own trimmed copy. Leave this red test as-is.
- **Reachability bug being fixed:** today `spans` (clickable) and `mistakes` (truth) are joined by exact string equality (`src/lib/factChecker.js:16`); the seed's clickable `'20 April 1879'` never equals the mistake key `'1879'`, so that mistake is unwinnable. We replace this with `data-fc-id` lookup.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `prisma/schema.prisma` | `FactCheckArticle` model | Modify (+4 fields) |
| `src/lib/factChecker.js` | Scoring + matching (pure) | Modify (rewrite `scoreAccusation`, add `matchesSpan`) |
| `src/lib/factCheckerGen.js` | Trim / wrap+validate / strip-truth / orchestration (pure + cheerio) | Create |
| `src/lib/llm.js` | Claude tamper prompt + call + JSON parse | Create |
| `src/lib/wikipedia.js` | Wikipedia fetch (reused) | Read-only |
| `src/app/api/fact-checker/article/route.js` | Serve article: difficulty filter + strip truth | Modify |
| `src/app/api/fact-checker/accuse/route.js` | Score an accusation (fcId or selection) | Modify |
| `src/components/FactCheckerArticle.jsx` | Render + click/select → accusation payload | Modify |
| `src/app/play/fact-checker/page.jsx` | Game loop wiring | Modify |
| `src/app/api/admin/fact-checker/route.js` | + POST generate handler | Modify |
| `src/app/admin/fact-checker/page.jsx` | + generate panel, show decoys | Modify |
| `scripts/generate-fact-checker.mjs` | Batch generator | Create |
| `scripts/seed-fact-checker.mjs` | Old hand-seed (anti-pattern) | Delete |
| `tests/factChecker.test.js` | Scoring/matching tests | Modify (rewrite) |
| `tests/factCheckerGen.test.js` | Pipeline tests | Create |
| `DEPLOY.md` | Document `ANTHROPIC_API_KEY` | Modify |

---

## Task 1: Dependency + schema migration

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `prisma/schema.prisma:84-95`

- [ ] **Step 1: Install the Anthropic SDK**

Run: `npm install @anthropic-ai/sdk`
Expected: adds `@anthropic-ai/sdk` to `dependencies`, exits 0.

- [ ] **Step 2: Add the four new columns to `FactCheckArticle`**

In `prisma/schema.prisma`, replace the existing model (lines ~84-95) with:

```prisma
model FactCheckArticle {
  id          String    @id @default(cuid())
  title       String
  subject     String
  category    String
  difficulty  String    @default("medium")
  tampered    String    @db.Text
  mistakes    Json
  decoys      Json      @default("[]")
  sourceTitle String?
  sourceUrl   String?
  status      String    @default("pending")
  createdAt   DateTime  @default(now())
  approvedAt  DateTime?
}
```

- [ ] **Step 3: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Push to the database and regenerate the client**

Run: `npx prisma db push && npx prisma generate`
Expected: `Your database is now in sync with your Prisma schema.` then `Generated Prisma Client`. (All new columns are defaulted/nullable, so existing rows are safe.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma
git commit -m "feat(fact-checker): add difficulty/decoys/source columns + Anthropic SDK"
```

---

## Task 2: Scoring & matching rewrite (`fcId` + guarded overlap)

This is the core bug fix. `scoreAccusation` takes a payload (`{ fcId }` or `{ selection }`) instead of a raw string.

**Files:**
- Modify: `src/lib/factChecker.js`
- Test: `tests/factChecker.test.js` (rewrite)

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `tests/factChecker.test.js` with:

```javascript
import { describe, it, expect } from 'vitest'
import {
  normalizeSelection,
  matchesSpan,
  scoreAccusation,
  SCORE_CONFIG,
} from '../src/lib/factChecker.js'

describe('normalizeSelection', () => {
  it('trims, lowercases, strips leading article', () => {
    expect(normalizeSelection('  The Corporal ')).toBe('corporal')
    expect(normalizeSelection('an officer')).toBe('officer')
  })
  it('does not strip "the" mid-string', () => {
    expect(normalizeSelection('in the army')).toBe('in the army')
  })
})

describe('matchesSpan (free-select overlap, server-side guard)', () => {
  it('matches exact', () => {
    expect(matchesSpan('1879', '1879')).toBe(true)
  })
  it('matches when selection is part of the false text', () => {
    expect(matchesSpan('Munich', 'Munich')).toBe(true)
    expect(matchesSpan('1879', '20 April 1879')).toBe(true) // span fully contains selection
  })
  it('matches when selection contains the false text plus a little context', () => {
    expect(matchesSpan('20 April 1879', '1879')).toBe(true) // 13 chars <= 4*4
  })
  it('rejects over-selection (drag a whole sentence to win)', () => {
    expect(matchesSpan('he was born on 20 April 1879 in a small town', '1879')).toBe(false)
  })
  it('rejects unrelated selection', () => {
    expect(matchesSpan('Bavarian Army', '1879')).toBe(false)
  })
  it('rejects empty', () => {
    expect(matchesSpan('', '1879')).toBe(false)
  })
})

describe('scoreAccusation by fcId', () => {
  const mistakes = [
    { fcId: 'a1', span: '1879', correct: '1889', explanation: 'Born 1889.' },
    { fcId: 'b2', span: 'Munich', correct: 'Berlin', explanation: 'Died in Berlin.' },
  ]

  it('correct mistake id → positive delta + reveal + foundId', () => {
    const r = scoreAccusation({ fcId: 'a1' }, mistakes, 'easy')
    expect(r.correct).toBe(true)
    expect(r.delta).toBe(SCORE_CONFIG.easy.correct)
    expect(r.answer).toBe('1889')
    expect(r.explanation).toBe('Born 1889.')
    expect(r.foundId).toBe('a1')
  })

  it('REGRESSION: id match works even though correct value "1889" is unrelated to span "1879"', () => {
    // The original bug: clickable text and truth key compared by string. Id lookup ignores text entirely.
    const r = scoreAccusation({ fcId: 'a1' }, mistakes, 'medium')
    expect(r.correct).toBe(true)
  })

  it('decoy / stray id → wrong penalty', () => {
    const r = scoreAccusation({ fcId: 'decoy-xyz' }, mistakes, 'medium')
    expect(r.correct).toBe(false)
    expect(r.delta).toBe(SCORE_CONFIG.medium.wrong)
  })
})

describe('scoreAccusation by selection (hard/hardcore)', () => {
  const mistakes = [{ fcId: 'a1', span: '1879', correct: '1889', explanation: 'Born 1889.' }]

  it('overlapping selection → correct, returns foundId', () => {
    const r = scoreAccusation({ selection: '20 April 1879' }, mistakes, 'hard')
    expect(r.correct).toBe(true)
    expect(r.delta).toBe(SCORE_CONFIG.hard.correct)
    expect(r.foundId).toBe('a1')
  })
  it('non-overlapping selection → wrong', () => {
    const r = scoreAccusation({ selection: 'Bavarian Army' }, mistakes, 'hard')
    expect(r.correct).toBe(false)
    expect(r.delta).toBe(SCORE_CONFIG.hard.wrong)
  })
})

describe('SCORE_CONFIG', () => {
  it('falls back to medium for unknown difficulty', () => {
    const r = scoreAccusation({ fcId: 'a1' }, [{ fcId: 'a1', span: 'x', correct: 'y', explanation: 'z' }], 'legendary')
    expect(r.delta).toBe(SCORE_CONFIG.medium.correct)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/factChecker.test.js`
Expected: FAIL — `matchesSpan` is not exported, and `scoreAccusation` doesn't accept an object payload.

- [ ] **Step 3: Rewrite `src/lib/factChecker.js`**

Replace the entire file with:

```javascript
export const SCORE_CONFIG = {
  easy:     { correct: 100,  wrong: -30  },
  medium:   { correct: 100,  wrong: -50  },
  hard:     { correct: 150,  wrong: -75  },
  hardcore: { correct: 200,  wrong: -150 },
}

const STRIP_ARTICLES = /^(the|a|an)\s+/i

export function normalizeSelection(text) {
  return String(text ?? '').trim().replace(STRIP_ARTICLES, '').toLowerCase()
}

// Free-select matching with a server-side over-select guard.
// A selection matches a mistake's rendered false text (`span`) when they are equal,
// the selection is contained in the span, or the selection contains the span plus at
// most a little context (length <= span length * 4). The guard stops "select the whole
// paragraph" from trivially winning hard mode.
export function matchesSpan(selection, span) {
  const a = normalizeSelection(selection)
  const b = normalizeSelection(span)
  if (!a || !b) return false
  if (a === b) return true
  if (b.includes(a)) return true
  if (a.includes(b) && a.length <= b.length * 4) return true
  return false
}

// payload = { fcId } (easy/medium clicks) OR { selection } (hard/hardcore free-select).
// `mistakes` is the article's mistakes array: [{ fcId, span, correct, explanation }].
export function scoreAccusation(payload, mistakes, difficulty) {
  const config = SCORE_CONFIG[difficulty] ?? SCORE_CONFIG.medium
  const list = Array.isArray(mistakes) ? mistakes : []

  let match = null
  if (payload && payload.fcId) {
    match = list.find(m => m.fcId === payload.fcId) ?? null
  } else if (payload && payload.selection) {
    match = list.find(m => matchesSpan(payload.selection, m.span)) ?? null
  }

  if (match) {
    return { correct: true, delta: config.correct, explanation: match.explanation, answer: match.correct, foundId: match.fcId }
  }
  return { correct: false, delta: config.wrong, explanation: null, answer: null, foundId: null }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/factChecker.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/factChecker.js tests/factChecker.test.js
git commit -m "fix(fact-checker): score by fcId + guarded overlap, killing the unwinnable-mistake bug"
```

---

## Task 3: `trimByDifficulty` + plain-text extraction

**Files:**
- Create: `src/lib/factCheckerGen.js`
- Test: `tests/factCheckerGen.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/factCheckerGen.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { trimByDifficulty, htmlToPlainText } from '../src/lib/factCheckerGen.js'

const ARTICLE = `
<p>Lead paragraph one.</p>
<p>Lead paragraph two.</p>
<table class="infobox"><tr><td>Born 1889</td></tr></table>
<h2><span class="mw-headline">Early life</span></h2>
<p>Section one body.</p>
<h2><span class="mw-headline">Career</span></h2>
<p>Section two body.</p>
<h2><span class="mw-headline">Death</span></h2>
<p>Section three body.</p>
`

describe('trimByDifficulty', () => {
  it('always strips the infobox', () => {
    for (const d of ['easy', 'medium', 'hard', 'hardcore']) {
      expect(trimByDifficulty(ARTICLE, d)).not.toContain('infobox')
      expect(trimByDifficulty(ARTICLE, d)).not.toContain('Born 1889')
    }
  })
  it('easy = lead only (no section headings/bodies)', () => {
    const out = trimByDifficulty(ARTICLE, 'easy')
    expect(out).toContain('Lead paragraph one.')
    expect(out).not.toContain('Section one body.')
    expect(out).not.toContain('Career')
  })
  it('medium = lead + first sections (includes section one, not the last)', () => {
    const out = trimByDifficulty(ARTICLE, 'medium')
    expect(out).toContain('Lead paragraph one.')
    expect(out).toContain('Section one body.')
  })
  it('hard/hardcore = full article (all sections present)', () => {
    const out = trimByDifficulty(ARTICLE, 'hard')
    expect(out).toContain('Section one body.')
    expect(out).toContain('Section three body.')
  })
})

describe('htmlToPlainText', () => {
  it('returns visible text with collapsed whitespace, no tags', () => {
    const txt = htmlToPlainText('<p>Hello   <b>world</b></p>\n<p>Again</p>')
    expect(txt).not.toContain('<')
    expect(txt).toContain('Hello world')
    expect(txt).toContain('Again')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: FAIL — `Failed to resolve import "../src/lib/factCheckerGen.js"`.

- [ ] **Step 3: Create `src/lib/factCheckerGen.js` with these two functions**

```javascript
import * as cheerio from 'cheerio'

// How many sections (beyond the lead) each difficulty includes.
const SECTION_BUDGET = { easy: 0, medium: 3, hard: Infinity, hardcore: Infinity }

// Strip the infobox + keep N sections after the lead, per difficulty.
// "Lead" = top-level nodes before the first <h2>. Sections are delimited by <h2>.
// Single pass: once we've seen more than `budget` <h2> headings, drop everything onward.
// (budget 0 → the first <h2> makes h2seen=1 > 0, so the first heading and all that follows
// are removed, leaving only the lead.)
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/factCheckerGen.js tests/factCheckerGen.test.js
git commit -m "feat(fact-checker): trimByDifficulty + htmlToPlainText pipeline helpers"
```

---

## Task 4: `wrapAndValidate` — deterministic wrap + reachability guarantee

**Files:**
- Modify: `src/lib/factCheckerGen.js`
- Test: `tests/factCheckerGen.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/factCheckerGen.test.js`:

```javascript
import { wrapAndValidate } from '../src/lib/factCheckerGen.js'

describe('wrapAndValidate', () => {
  const HTML = '<p>Born in 1889 in Braunau. Served as a corporal.</p>'

  it('wraps located mistakes with data-fc-id + data-fc-mistake=true and substitutes the lie', () => {
    const { tampered, mistakes } = wrapAndValidate(HTML, {
      mistakes: [{ find: '1889', replacement: '1879', explanation: 'Born 1889.' }],
      decoys: [],
    })
    expect(tampered).toContain('data-fc-mistake="true"')
    expect(tampered).toContain('1879')        // lie rendered
    expect(tampered).not.toContain('1889')    // truth replaced in the body
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0].span).toBe('1879')     // rendered false text (for hard matching)
    expect(mistakes[0].correct).toBe('1889')  // truth (for reveal)
    expect(mistakes[0].fcId).toBeTruthy()
  })

  it('wraps decoys with data-fc-mistake=false and leaves their text unchanged', () => {
    const { tampered, decoys } = wrapAndValidate(HTML, {
      mistakes: [],
      decoys: [{ find: 'Braunau' }],
    })
    expect(tampered).toContain('data-fc-mistake="false"')
    expect(tampered).toContain('Braunau')
    expect(decoys).toHaveLength(1)
    expect(decoys[0].span).toBe('Braunau')
  })

  it('DISCARDS items whose `find` is not present in the text (reachability guarantee)', () => {
    const { mistakes } = wrapAndValidate(HTML, {
      mistakes: [
        { find: '1889', replacement: '1879', explanation: 'ok' },
        { find: 'NOT_IN_TEXT', replacement: 'x', explanation: 'hallucinated' },
      ],
      decoys: [],
    })
    expect(mistakes).toHaveLength(1)
    expect(mistakes[0].correct).toBe('1889')
  })

  it('assigns a unique fcId per wrapped region', () => {
    const { mistakes, decoys } = wrapAndValidate(HTML, {
      mistakes: [{ find: '1889', replacement: '1879', explanation: 'ok' }],
      decoys: [{ find: 'corporal' }],
    })
    const ids = [...mistakes, ...decoys].map(x => x.fcId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: FAIL — `wrapAndValidate` is not exported.

- [ ] **Step 3: Implement `wrapAndValidate`**

Add to `src/lib/factCheckerGen.js` (and add `import { randomUUID } from 'node:crypto'` at the top):

```javascript
import { randomUUID } from 'node:crypto'

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
```

Note: `escapeHtml(visible)` ensures the substituted false value can't inject markup.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/factCheckerGen.js tests/factCheckerGen.test.js
git commit -m "feat(fact-checker): wrapAndValidate — deterministic region wrap + reachability guarantee"
```

---

## Task 5: `stripTruthForClient` — anti-cheat per difficulty

**Files:**
- Modify: `src/lib/factCheckerGen.js`
- Test: `tests/factCheckerGen.test.js`

- [ ] **Step 1: Add failing tests**

Append to `tests/factCheckerGen.test.js`:

```javascript
import { stripTruthForClient } from '../src/lib/factCheckerGen.js'

const STORED = '<p>Born in <span data-fc-id="a1" data-fc-mistake="true">1879</span> in ' +
               '<span data-fc-id="d1" data-fc-mistake="false">Braunau</span>.</p>'

describe('stripTruthForClient', () => {
  it('easy/medium: keeps data-fc-id, removes data-fc-mistake (no answer leak)', () => {
    const out = stripTruthForClient(STORED, 'medium')
    expect(out).toContain('data-fc-id="a1"')
    expect(out).toContain('data-fc-id="d1"')
    expect(out).not.toContain('data-fc-mistake')
    expect(out).toContain('1879')
    expect(out).toContain('Braunau')
  })
  it('hard/hardcore: removes ALL fc wrappers, keeps the visible text (no candidate-set tell)', () => {
    const out = stripTruthForClient(STORED, 'hard')
    expect(out).not.toContain('data-fc-id')
    expect(out).not.toContain('data-fc-mistake')
    expect(out).toContain('1879')
    expect(out).toContain('Braunau')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: FAIL — `stripTruthForClient` not exported.

- [ ] **Step 3: Implement `stripTruthForClient`**

Add to `src/lib/factCheckerGen.js`:

```javascript
// Prepare the article HTML for the browser. The browser must never learn which regions
// are lies. easy/medium: keep data-fc-id (mistakes & decoys indistinguishable), drop the
// truth attribute. hard/hardcore: unwrap entirely so there is no candidate-set tell.
export function stripTruthForClient(html, difficulty) {
  const hard = difficulty === 'hard' || difficulty === 'hardcore'
  const $ = cheerio.load(html, null, false)
  $('[data-fc-id]').each((_, el) => {
    const $el = $(el)
    if (hard) $el.replaceWith($el.text())
    else $el.removeAttr('data-fc-mistake')
  })
  return $.html()
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/factCheckerGen.js tests/factCheckerGen.test.js
git commit -m "feat(fact-checker): stripTruthForClient — per-difficulty anti-cheat HTML prep"
```

---

## Task 6: LLM tamper prompt + call + JSON parse

**Files:**
- Create: `src/lib/llm.js`
- Test: `tests/factCheckerGen.test.js` (pure prompt + parse only; the network call is verified manually in Task 12)

- [ ] **Step 1: Add failing tests for the pure parts**

Append to `tests/factCheckerGen.test.js`:

```javascript
import { buildTamperPrompt, parseTamperJson } from '../src/lib/llm.js'

describe('buildTamperPrompt', () => {
  it('states the required mistake + decoy counts and the unambiguous-falsehood rule', () => {
    const p = buildTamperPrompt('Some article text.', 5, 8)
    expect(p).toContain('5')
    expect(p).toContain('8')
    expect(p.toLowerCase()).toContain('exact')
    expect(p.toLowerCase()).toContain('unambiguous')
    expect(p).toContain('Some article text.')
  })
})

describe('parseTamperJson', () => {
  it('parses a fenced JSON block', () => {
    const out = parseTamperJson('```json\n{"mistakes":[{"find":"1889","replacement":"1879","explanation":"e"}],"decoys":[{"find":"Braunau"}]}\n```')
    expect(out.mistakes[0].find).toBe('1889')
    expect(out.decoys[0].find).toBe('Braunau')
  })
  it('parses raw JSON', () => {
    const out = parseTamperJson('{"mistakes":[],"decoys":[]}')
    expect(out.mistakes).toEqual([])
  })
  it('throws on non-JSON', () => {
    expect(() => parseTamperJson('I cannot help with that.')).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: FAIL — `../src/lib/llm.js` cannot be resolved.

- [ ] **Step 3: Create `src/lib/llm.js`**

```javascript
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

export const TAMPER_SYSTEM =
  'You corrupt factual reference text for a "spot the lie" game. You receive the plain text ' +
  'of a real encyclopedia article and return STRICT JSON only. You never add commentary.'

export function buildTamperPrompt(plain, mistakeCount, decoyCount) {
  return [
    `From the article text below, choose ${mistakeCount} factual claims to falsify and ${decoyCount} ` +
    `true claims that merely LOOK suspicious (decoys).`,
    '',
    'Rules:',
    `- For each mistake: "find" MUST be an EXACT substring copied verbatim from the text (a date, name,`,
    `  place, number, or short phrase). "replacement" MUST be an UNAMBIGUOUSLY false but plausible value`,
    `  of the same kind (a different real date/place/number). Never opinion; never anything possibly true.`,
    '- For each decoy: "find" MUST be an EXACT substring copied verbatim. Decoys are NOT changed.',
    '- Prefer short, distinctive "find" phrases that occur once.',
    '',
    'Return ONLY JSON of this exact shape:',
    '{"mistakes":[{"find":"...","replacement":"...","explanation":"why the real value is correct"}],',
    ' "decoys":[{"find":"..."}]}',
    '',
    'ARTICLE TEXT:',
    plain,
  ].join('\n')
}

export function parseTamperJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response')
  const obj = JSON.parse(raw.slice(start, end + 1))
  return { mistakes: obj.mistakes ?? [], decoys: obj.decoys ?? [] }
}

// Thin network wrapper. Not unit-tested (verified live in Task 12). Reads ANTHROPIC_API_KEY from env.
export async function callTamperLLM(plain, mistakeCount, decoyCount) {
  const client = new Anthropic()
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: TAMPER_SYSTEM,
    messages: [{ role: 'user', content: buildTamperPrompt(plain, mistakeCount, decoyCount) }],
  })
  const text = msg.content.map(b => (b.type === 'text' ? b.text : '')).join('')
  return parseTamperJson(text)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm.js tests/factCheckerGen.test.js
git commit -m "feat(fact-checker): Claude tamper prompt + JSON parser (network call thin-wrapped)"
```

---

## Task 7: `generateTamperedArticle` orchestration (with retry)

**Files:**
- Modify: `src/lib/factCheckerGen.js`
- Test: `tests/factCheckerGen.test.js`

- [ ] **Step 1: Add failing tests (deps injected — no network)**

Append to `tests/factCheckerGen.test.js`:

```javascript
import { generateTamperedArticle, MISTAKE_COUNTS } from '../src/lib/factCheckerGen.js'

const FAKE_WIKI = async () => ({
  cleanHtml: '<p>Born in 1889 in Braunau. Served as a corporal in the army.</p>',
  title: 'Adolf Hitler',
  validLinks: [],
})

describe('MISTAKE_COUNTS', () => {
  it('defines the per-difficulty mistake budget', () => {
    expect(MISTAKE_COUNTS).toMatchObject({ easy: 3, medium: 4, hard: 5, hardcore: 6 })
  })
})

describe('generateTamperedArticle', () => {
  // The fixture is short, so only one mistake is locatable. We assert the SHAPE of the
  // output and that at least one mistake survived — count tuning lives in MISTAKE_COUNTS
  // (tested above), and generation keeps the best non-empty attempt rather than failing
  // when a short article can't host the full budget.
  it('produces a pending article with wrapped mistakes + source attribution', async () => {
    const fakeLLM = async () => ({
      mistakes: [{ find: '1889', replacement: '1879', explanation: 'Born 1889.' }],
      decoys: [{ find: 'Braunau' }],
    })
    const out = await generateTamperedArticle('Adolf Hitler', 'easy', 'history', {
      fetchWiki: FAKE_WIKI, callLLM: fakeLLM,
    })
    expect(out.status).toBe('pending')
    expect(out.difficulty).toBe('easy')
    expect(out.category).toBe('history')
    expect(out.subject).toBe('Adolf Hitler')
    expect(out.mistakes.length).toBeGreaterThanOrEqual(1)
    expect(out.mistakes[0]).toMatchObject({ span: '1879', correct: '1889' })
    expect(out.tampered).toContain('data-fc-mistake="true"')
    expect(out.sourceUrl).toContain('Adolf_Hitler')
  })

  it('throws when ZERO locatable mistakes survive after retries', async () => {
    const badLLM = async () => ({
      mistakes: [{ find: 'NOT_IN_TEXT', replacement: 'x', explanation: 'hallucinated' }],
      decoys: [],
    })
    await expect(
      generateTamperedArticle('Adolf Hitler', 'easy', 'history', { fetchWiki: FAKE_WIKI, callLLM: badLLM })
    ).rejects.toThrow(/locatable mistakes/i)
  })

  it('uses getRandomWikiPage when no subject is given', async () => {
    const pickRandom = async () => 'Adolf Hitler'
    const fakeLLM = async () => ({ mistakes: [{ find: '1889', replacement: '1879', explanation: 'e' }], decoys: [] })
    const out = await generateTamperedArticle(null, 'easy', 'history', {
      fetchWiki: FAKE_WIKI, callLLM: fakeLLM, pickRandom,
    })
    expect(out.subject).toBe('Adolf Hitler')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: FAIL — `generateTamperedArticle` / `MISTAKE_COUNTS` not exported.

- [ ] **Step 3: Implement orchestration**

Add to `src/lib/factCheckerGen.js` (top imports: add `fetchAndSanitizeWiki`, `getRandomWikiPage`, `callTamperLLM`):

```javascript
import { fetchAndSanitizeWiki, getRandomWikiPage } from './wikipedia.js'
import { callTamperLLM } from './llm.js'

export const MISTAKE_COUNTS = { easy: 3, medium: 4, hard: 5, hardcore: 6 }

function wikiUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

// deps is injectable for tests: { fetchWiki, pickRandom, callLLM }.
export async function generateTamperedArticle(subject, difficulty, category, deps = {}) {
  const fetchWiki = deps.fetchWiki ?? fetchAndSanitizeWiki
  const pickRandom = deps.pickRandom ?? getRandomWikiPage
  const callLLM = deps.callLLM ?? callTamperLLM

  const subj = subject ?? (await pickRandom())
  const { cleanHtml, title } = await fetchWiki(subj)
  const trimmed = trimByDifficulty(cleanHtml, difficulty)
  const required = MISTAKE_COUNTS[difficulty] ?? MISTAKE_COUNTS.medium
  const decoyCount = Math.round(required * 1.5)
  const plain = htmlToPlainText(trimmed)

  let best = { tampered: trimmed, mistakes: [], decoys: [] }
  for (let attempt = 0; attempt < 3; attempt++) {
    const llm = await callLLM(plain, required, decoyCount)
    const result = wrapAndValidate(trimmed, llm)
    if (result.mistakes.length > best.mistakes.length) best = result
    if (best.mistakes.length >= required) break
  }
  if (best.mistakes.length < 1) {
    throw new Error(`Could not plant locatable mistakes for "${subj}" after 3 attempts`)
  }

  return {
    title,
    subject: title,
    category: category ?? 'history',
    difficulty,
    tampered: best.tampered,
    mistakes: best.mistakes,
    decoys: best.decoys,
    sourceTitle: title,
    sourceUrl: wikiUrl(title),
    status: 'pending',
  }
}
```

Note: the loop breaks as soon as `required` mistakes survive; if it never reaches `required` it keeps the best non-empty attempt (admin still reviews) and only throws when ZERO mistakes are locatable. This keeps generation resilient to a stingy LLM while preserving reachability. The "throws on all-hallucinated" test passes because zero survive.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/factCheckerGen.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/factCheckerGen.js tests/factCheckerGen.test.js
git commit -m "feat(fact-checker): generateTamperedArticle orchestration with retry + attribution"
```

---

## Task 8: Article GET route — difficulty filter + truth stripping

**Files:**
- Modify: `src/app/api/fact-checker/article/route.js`

- [ ] **Step 1: Update the route**

Replace the contents of `src/app/api/fact-checker/article/route.js` with:

```javascript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import { stripTruthForClient } from '@/lib/factCheckerGen'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const reveal = searchParams.get('reveal') === 'true'

  // Reveal (post-game): returns the truth. Auth-gated.
  if (id && reveal) {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    try {
      const article = await prisma.factCheckArticle.findUnique({ where: { id } })
      if (!article) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ mistakes: article.mistakes })
    } catch (err) {
      console.error('[fact-checker/article reveal]', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  const difficulty = searchParams.get('difficulty') ?? 'medium'
  const category = searchParams.get('category') ?? null
  const where = { status: 'approved', difficulty }
  if (category) where.category = category

  try {
    const count = await prisma.factCheckArticle.count({ where })
    if (count === 0) {
      return NextResponse.json({ error: 'No approved articles' }, { status: 404 })
    }
    const skip = Math.floor(Math.random() * count)
    const article = await prisma.factCheckArticle.findFirst({ where, skip })
    if (!article) return NextResponse.json({ error: 'No approved articles' }, { status: 404 })

    // The browser never receives `mistakes`/`decoys` or the data-fc-mistake truth flag.
    const clientHtml = stripTruthForClient(article.tampered, article.difficulty)

    return NextResponse.json({
      id: article.id,
      title: article.title,
      subject: article.subject,
      category: article.category,
      difficulty: article.difficulty,
      clientHtml,
      sourceUrl: article.sourceUrl,
      mistakeCount: article.mistakes.length,
    })
  } catch (err) {
    console.error('[fact-checker/article]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify the existing suite still passes (no regressions in pure libs)**

Run: `npx vitest run tests/factChecker.test.js tests/factCheckerGen.test.js`
Expected: PASS (route itself isn't unit-tested; it delegates to the tested `stripTruthForClient`).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/fact-checker/article/route.js
git commit -m "feat(fact-checker): article route filters by difficulty + strips truth before sending"
```

---

## Task 9: Accuse route — accept `fcId` or `selection`, real difficulty, set-based allFound

**Files:**
- Modify: `src/app/api/fact-checker/accuse/route.js`

- [ ] **Step 1: Update the route**

Replace the contents of `src/app/api/fact-checker/accuse/route.js` with:

```javascript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { scoreAccusation } from '@/lib/factChecker'

export async function POST(request) {
  const { articleId, fcId, selection, foundSoFar = [] } = await request.json()

  if (!articleId || (!fcId && (typeof selection !== 'string' || !selection.trim()))) {
    return NextResponse.json({ error: 'articleId and fcId or selection required' }, { status: 400 })
  }

  try {
    const article = await prisma.factCheckArticle.findUnique({ where: { id: articleId } })
    if (!article || article.status !== 'approved') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const difficulty = article.difficulty ?? 'medium'
    const result = scoreAccusation({ fcId, selection }, article.mistakes, difficulty)

    // foundSoFar is the list of previously-found mistake fcIds (server-authoritative ids).
    const foundIds = new Set(Array.isArray(foundSoFar) ? foundSoFar : [])
    if (result.correct && result.foundId) foundIds.add(result.foundId)
    const allFound = foundIds.size >= article.mistakes.length

    return NextResponse.json({
      correct: result.correct,
      delta: result.delta,
      explanation: result.explanation,
      answer: result.answer,
      foundId: result.foundId,
      allFound,
    })
  } catch (err) {
    console.error('[fact-checker/accuse]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/fact-checker/accuse/route.js
git commit -m "feat(fact-checker): accuse route resolves fcId or guarded selection, real difficulty"
```

---

## Task 10: Article component + play page wiring

No DOM unit tests (no harness in repo). Verified by running the app in Step 4.

**Files:**
- Modify: `src/components/FactCheckerArticle.jsx`
- Modify: `src/app/play/fact-checker/page.jsx`

- [ ] **Step 1: Rewrite `src/components/FactCheckerArticle.jsx`**

Replace the entire file with:

```jsx
'use client'
import { useRef } from 'react'

// `html` is already prepared by the server per difficulty:
//   easy/medium → contains <span data-fc-id> (no truth flag) → clickable chips
//   hard/hardcore → no wrappers at all → free drag-select
export default function FactCheckerArticle({ html, difficulty, onAccuse, accused = [] }) {
  const articleRef = useRef(null)
  const isHard = difficulty === 'hard' || difficulty === 'hardcore'
  const accusedIds = new Set(accused.filter(a => a.fcId).map(a => a.fcId))

  function handleClick(e) {
    if (isHard) return
    const el = e.target.closest('[data-fc-id]')
    if (!el || !articleRef.current?.contains(el)) return
    onAccuse({ fcId: el.dataset.fcId, label: el.textContent })
  }

  function handleMouseUp() {
    if (!isHard) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    // Coarse client guard: ignore tiny or huge selections (server is authoritative).
    if (text.length < 2 || text.length > 80) { sel.removeAllRanges(); return }
    const range = sel.getRangeAt(0)
    if (!articleRef.current || !articleRef.current.contains(range.commonAncestorContainer)) {
      sel.removeAllRanges(); return
    }
    onAccuse({ selection: text, label: text })
    sel.removeAllRanges()
  }

  // Mark already-accused chips (easy/medium) so they visibly lock in.
  function decorate(rawHtml) {
    if (isHard || accusedIds.size === 0) return rawHtml
    let out = rawHtml
    for (const id of accusedIds) {
      out = out.replace(`data-fc-id="${id}"`, `data-fc-id="${id}" data-accused="true"`)
    }
    return out
  }

  return (
    <>
      <style>{`
        .fc-mark [data-fc-id] {
          background: #fffbe6;
          border-bottom: 2px solid #cbb24a;
          border-radius: 3px;
          padding: 0 3px;
          cursor: pointer;
          transition: background 120ms ease;
        }
        .fc-mark [data-fc-id]:hover { background: #fde68a; }
        .fc-mark [data-fc-id]:focus-visible { outline: 2px solid #2563eb; outline-offset: 1px; }
        .fc-mark [data-fc-id][data-accused="true"] {
          background: #fde047; border-bottom: 2px solid #a16207; font-weight: 600;
        }
      `}</style>
      <div
        ref={articleRef}
        className={isHard ? 'wiki-article px-4 py-4 text-[14px] leading-relaxed select-text'
                          : 'fc-mark wiki-article px-4 py-4 text-[14px] leading-relaxed'}
        style={{ fontFamily: 'Georgia, "Linux Libertine", serif', background: '#fff', color: '#1a1a1a' }}
        dangerouslySetInnerHTML={{ __html: decorate(html) }}
        onClick={handleClick}
        onMouseUp={handleMouseUp}
      />
    </>
  )
}
```

- [ ] **Step 2: Update `src/app/play/fact-checker/page.jsx`**

Make these edits:

(a) Replace the `fetch(...)` block in the init `useEffect` (currently `fetch(\`/api/fact-checker/article?difficulty=${difficulty}\`)`) — it already passes difficulty; no change needed there.

(b) Replace `handleAccuse` (the whole function) with:

```jsx
  async function handleAccuse(payload) {
    if (done || !article) return
    const label = payload.label
    // Dedupe: by fcId for clicks, by normalized label for selections.
    const dup = accusations.some(a =>
      (payload.fcId && a.fcId === payload.fcId) ||
      (!payload.fcId && a.label?.toLowerCase() === label?.toLowerCase())
    )
    if (dup) return

    const res = await fetch('/api/fact-checker/accuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articleId: article.id,
        fcId: payload.fcId,
        selection: payload.selection,
        foundSoFar: accusations.filter(a => a.correct && a.foundId).map(a => a.foundId),
      }),
    })
    const data = await res.json()

    const newAcc = { label, fcId: data.foundId ?? payload.fcId, correct: data.correct, delta: data.delta }
    setAccusations(prev => [...prev, newAcc])
    setScore(prev => prev + data.delta)
    if (data.correct) {
      const newFound = found + 1
      setFound(newFound)
      if (data.allFound) {
        setDone(true)
        await finishGame(score + data.delta, newFound)
      }
    }
  }
```

(c) In the JSX, replace the `<FactCheckerArticle ... />` usage with (drop the `spans` prop, use `clientHtml`):

```jsx
        <FactCheckerArticle
          html={article.clientHtml}
          difficulty={difficulty}
          onAccuse={handleAccuse}
          accused={accusations}
        />
```

(d) Add a source attribution footer below the article (inside the main return, after the article block):

```jsx
      {article.sourceUrl && (
        <p className="text-center text-[11px] text-[#94a3b8] py-4 font-mono">
          Adapted from Wikipedia (CC BY-SA) ·{' '}
          <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a>
        </p>
      )}
```

- [ ] **Step 3: Confirm the FactCheckerHUD still gets `accusations` with a `.label`**

Open `src/components/FactCheckerHUD.jsx`. The accusation chips currently read `a.text`. Change the chip rendering to read `a.label` (the new field). If the HUD maps `accusations.map(a => ... a.text ...)`, replace `a.text` with `a.label`. (If it already uses a generic field, adjust to `a.label`.)

- [ ] **Step 4: Manual verification — run the app**

```bash
npm run dev
```
Then, with at least one approved `medium` and one approved `hard` article in the DB (seed them in Task 12 first if needed, or temporarily approve a generated one), open `http://localhost:3004/play/fact-checker?difficulty=medium`:
- Clickable regions render as obvious yellow chips with pointer cursor + hover.
- Clicking a planted mistake increments Found and turns the chip locked-yellow; clicking a decoy applies the wrong penalty.
- Finding all mistakes routes to the results/reveal screen.
- `?difficulty=hard`: no chips; drag-selecting a lie scores correct; selecting a true phrase scores wrong; dragging a whole sentence does NOT win.
- No console errors; `view-source`/devtools shows NO `data-fc-mistake` (medium) and NO `data-fc-id` (hard).

- [ ] **Step 5: Commit**

```bash
git add src/components/FactCheckerArticle.jsx src/components/FactCheckerHUD.jsx src/app/play/fact-checker/page.jsx
git commit -m "feat(fact-checker): render pre-stripped HTML, fcId/selection accusations, source footer"
```

---

## Task 11: Admin generate button + queue preview of decoys

**Files:**
- Modify: `src/app/api/admin/fact-checker/route.js` (add POST)
- Modify: `src/app/admin/fact-checker/page.jsx` (add generate panel + show decoys)

- [ ] **Step 1: Add a POST handler to the admin route**

In `src/app/api/admin/fact-checker/route.js`, add this import near the top:

```javascript
import { generateTamperedArticle } from '@/lib/factCheckerGen'
```

Then add this function (the file already has `requireAdmin()`, GET, and PATCH — append POST):

```javascript
export async function POST(request) {
  const denied = await requireAdmin()
  if (denied) return denied

  const { subject, difficulty = 'medium', category = 'history' } = await request.json()

  try {
    const draft = await generateTamperedArticle(subject || null, difficulty, category)
    const created = await prisma.factCheckArticle.create({ data: draft })
    return NextResponse.json({ ok: true, article: created })
  } catch (err) {
    console.error('[admin/fact-checker POST]', err)
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Add the generate panel + decoy preview to the admin page**

In `src/app/admin/fact-checker/page.jsx`:

(a) Add state near the other `useState` calls:

```jsx
  const [genSubject, setGenSubject] = useState('')
  const [genDifficulty, setGenDifficulty] = useState('medium')
  const [genCategory, setGenCategory] = useState('history')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
```

(b) Add the generate handler:

```jsx
  async function generate() {
    setGenerating(true); setGenError(null)
    try {
      const res = await fetch('/api/admin/fact-checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: genSubject.trim() || null, difficulty: genDifficulty, category: genCategory }),
      })
      const d = await res.json()
      if (!res.ok) { setGenError(d.error || 'Generation failed'); return }
      setGenSubject('')
      if (tab === 'pending') setArticles(prev => [d.article, ...prev])
      else setTab('pending')
    } catch {
      setGenError('Generation failed')
    } finally {
      setGenerating(false)
    }
  }
```

(c) Insert the panel JSX directly after the `<h1>` heading:

```jsx
      <div className="border border-[#334155] rounded p-4 bg-[#1e293b] mb-8">
        <p className="text-sm uppercase tracking-wider text-[#94a3b8] mb-3">Generate from Wikipedia</p>
        <div className="flex flex-wrap gap-3 items-end">
          <input
            value={genSubject} onChange={e => setGenSubject(e.target.value)}
            placeholder="Subject (blank = random)"
            className="bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
          />
          <select value={genDifficulty} onChange={e => setGenDifficulty(e.target.value)}
            className="bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-sm">
            {['easy','medium','hard','hardcore'].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input
            value={genCategory} onChange={e => setGenCategory(e.target.value)}
            placeholder="category"
            className="bg-[#0f172a] border border-[#334155] rounded px-3 py-2 text-sm w-32"
          />
          <button onClick={generate} disabled={generating}
            className="px-4 py-2 bg-[#2563eb] hover:bg-blue-500 disabled:opacity-50 text-white rounded text-sm">
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
        {genError && <p className="text-red-400 text-sm mt-2">{genError}</p>}
      </div>
```

(d) In the per-card render, after the "Planted mistakes" block, add a decoys block so the admin sees the full marked set:

```jsx
            {(a.decoys?.length ?? 0) > 0 && (
              <div className="mt-3">
                <p className="text-[#94a3b8] text-xs mb-2 uppercase tracking-wider">Decoys (look suspicious, are true)</p>
                <div className="flex flex-wrap gap-2">
                  {a.decoys.map((d, i) => (
                    <span key={i} className="px-2 py-1 bg-[#0f172a] rounded text-xs text-[#cbd5e1]">{d.span}</span>
                  ))}
                </div>
              </div>
            )}
```

- [ ] **Step 3: Manual verification**

With `npm run dev` running and signed in as the `ADMIN_EMAIL` user, open `http://localhost:3004/admin/fact-checker`:
- Enter a subject (e.g. `Marie Curie`), pick `medium`, click Generate. Requires `ANTHROPIC_API_KEY` + `DATABASE_URL` in `.env.local`.
- A new pending card appears with the tampered article, planted mistakes (`find → correct`), and decoy chips.
- Approve it; switch to the Approved tab to confirm it moved.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/fact-checker/route.js src/app/admin/fact-checker/page.jsx
git commit -m "feat(fact-checker): admin generate button + decoy preview in moderation queue"
```

---

## Task 12: Batch script + docs + retire legacy seed/row

**Files:**
- Create: `scripts/generate-fact-checker.mjs`
- Delete: `scripts/seed-fact-checker.mjs`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Create the batch generator**

Create `scripts/generate-fact-checker.mjs`:

```javascript
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { readFileSync } from 'node:fs'
import { generateTamperedArticle } from '../src/lib/factCheckerGen.js'

if (!process.env.DATABASE_URL) {
  console.error('Run with --env-file=.env.local (DATABASE_URL required).')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required for tampering.')
  process.exit(1)
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const count = parseInt(arg('count', '5'), 10)
const difficulty = arg('difficulty', 'medium')
const category = arg('category', 'history')
const subjectsFile = arg('subjects', null)

const subjects = subjectsFile
  ? readFileSync(subjectsFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean)
  : Array.from({ length: count }, () => null) // null → random per article

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

let created = 0, failed = 0
for (const subject of subjects.slice(0, subjectsFile ? subjects.length : count)) {
  try {
    const draft = await generateTamperedArticle(subject, difficulty, category)
    await db.factCheckArticle.create({ data: draft })
    created += 1
    console.log(`✓ ${draft.subject} (${draft.mistakes.length} mistakes, ${draft.decoys.length} decoys) → pending`)
  } catch (err) {
    failed += 1
    console.warn(`✗ ${subject ?? '(random)'}: ${err.message}`)
  }
}
console.log(`\nDone: ${created} created (pending), ${failed} failed.`)
await db.$disconnect()
```

- [ ] **Step 2: Delete the legacy seed script**

Run: `git rm scripts/seed-fact-checker.mjs`
Expected: file removed (its hand-keyed `spans`/`mistakes` shape is the anti-pattern this work eliminates).

- [ ] **Step 3: Document the env var in `DEPLOY.md`**

Append to `DEPLOY.md`:

```markdown
## Fact Checker generation

The Fact Checker mode tampers real Wikipedia articles with Claude. Set:

- `ANTHROPIC_API_KEY` — required by the admin "Generate" button and the batch script.

Batch-generate pending articles (reviewed in /admin/fact-checker before they go live):

    node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty medium --category history
    node --env-file=.env.local scripts/generate-fact-checker.mjs --subjects subjects.txt --difficulty hard
```

- [ ] **Step 4: Generate the initial library + retire the legacy row (manual, requires keys)**

```bash
# Build an initial library across difficulties:
node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty easy
node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty medium
node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty hard
node --env-file=.env.local scripts/generate-fact-checker.mjs --count 5 --difficulty hardcore
```
Then in `/admin/fact-checker`: review + approve good ones, reject the rest. The single legacy hand-seeded row (subject "Adolf Hitler", no `difficulty`/`decoys`) will appear under whichever status it had — set it to `rejected` (or delete via DB) so it never serves.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-fact-checker.mjs DEPLOY.md
git rm --cached scripts/seed-fact-checker.mjs 2>/dev/null || true
git commit -m "feat(fact-checker): batch generator + docs; remove legacy hand-seed"
```

---

## Task 13: Full suite + log

**Files:**
- Modify: `logs/2026-06-02.md` (or today's date file)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All pass EXCEPT the known pre-existing `tests/wikipedia.test.js > "strips navbox, infobox, and reflist"` (documented out-of-scope red — `wikipedia.js` keeps the infobox for the racing game). Confirm our new tests (`tests/factChecker.test.js`, `tests/factCheckerGen.test.js`) are green and no NEW failures appeared.

- [ ] **Step 2: Lint**

Run: `npx next lint` (or `npm run lint` if defined)
Expected: no new errors in the files touched.

- [ ] **Step 3: Append a session log entry**

Add a dated entry to `logs/2026-06-02.md` summarizing: bug fixed (unwinnable mistake via fcId matching), real-Wikipedia pipeline (trim/wrap/validate/strip), difficulty wiring, admin button + batch script, anti-cheat truth-stripping, tests added. List files changed.

- [ ] **Step 4: Commit**

```bash
git add logs/
git commit -m "chore(logs): fact-checker real-wikipedia pipeline session log"
```

---

## Notes / deliberate decisions

- **Reachability guarantee:** a mistake is recorded only if `wrapAndValidate` actually wrapped its `find` in the DOM. The interactive region IS the recorded mistake (`data-fc-id`), so click matching is pure id lookup — the original "1879 vs 20 April 1879" string-desync cannot recur. Tested by the regression case in Task 2.
- **First-occurrence wrapping:** if `find` appears more than once we wrap the first occurrence (the prompt asks for distinctive, single-occurrence phrases; admin review is the backstop). This is a pragmatic relaxation of the spec's "discard if ambiguous" — it preserves reachability and avoids dropping valid mistakes, since the recorded mistake is self-consistent regardless of which occurrence is wrapped.
- **No DOM test harness:** the repo's vitest env is `node` with no React testing setup. All risky logic is in pure `src/lib` functions (TDD); `FactCheckerArticle.jsx`, the play page, the admin page, and the route handlers are thin wrappers verified by running the app (Tasks 10–11). Adding jsdom + testing-library is intentionally out of scope (YAGNI).
- **`wikipedia.js` untouched:** it intentionally keeps the infobox for the racing game; our pipeline strips the infobox on its own trimmed copy via `trimByDifficulty`.
- **Difficulty filter caveat:** `GET /api/fact-checker/article` now requires an approved article AT the requested difficulty. The initial batch run (Task 12) must seed every difficulty the play menu offers, or that difficulty returns 404 → the play page redirects home.
- **Model:** `claude-sonnet-4-6` for cost-effective batch tampering; swap the `MODEL` constant in `src/lib/llm.js` if you want Opus-grade extraction.
```
