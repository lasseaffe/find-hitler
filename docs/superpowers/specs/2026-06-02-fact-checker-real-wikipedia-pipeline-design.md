# Fact Checker Mode — Real Wikipedia Pipeline + Reachability Fix

**Date:** 2026-06-02
**Project:** find-hitler (six-clicks) — `C:\Users\lasse\Desktop\find-hitler`, port 3004
**Status:** Design approved, pending spec review → implementation planning

---

## Problem

The "Fact Checker" (spot-the-tampered-facts) mode is thin and partly broken. Reported symptoms were
"unpolished, clickable words not visibly clickable, only 2/3 mistakes findable even after clicking
everything, not a real Wikipedia page, too easy / not enough text." Investigation found these are three
separable problems, one of which is a correctness bug — not a difficulty issue:

### 1. The "2/3" bug — a planted mistake is structurally unwinnable

`spans` (clickable words) and `mistakes` (truth) are two independent arrays joined by **exact normalized
string equality** at render/score time.

- In `scripts/seed-fact-checker.mjs` the clickable span is `'20 April 1879'` (full date) but the mistake
  is keyed as `'1879'` (year only).
- `src/lib/factChecker.js:16` matches by `normalizeSelection(m.span) === normalized`. Clicking the date
  produces `'20 april 1879'`, which never equals the mistake key `'1879'` → scored **wrong**.
- Result: the date mistake cannot be scored correct by clicking. The player can never reach 3/3.

Any time a mistake's `span` is not byte-for-byte present in `spans`, that mistake is unreachable. Nothing
validates this relationship.

### 2. Latent difficulty bug

`src/app/api/fact-checker/accuse/route.js` reads `article.difficulty`, but the Prisma
`FactCheckArticle` model has **no `difficulty` column**. Scoring therefore always falls back to `medium`,
regardless of the difficulty the player selected. The article-select route also ignores the `difficulty`
query param entirely.

### 3. No content pipeline

There is exactly **one** hand-written 4-paragraph article in the entire game. The admin route only does
GET (moderation list) + PATCH (approve/reject) — **nothing creates articles**. Hence "not a real Wikipedia
page," "too easy," and "not enough text": the content surface is a single static stub that repeats every
play.

### 4. Weak click affordance

Clickable spans are marked only with `border-bottom: 1px dotted #94a3b8` on serif text against white —
too subtle to read as interactive.

---

## Goals

1. Make every planted mistake **structurally reachable** — eliminate the bug class, not just this instance.
2. Generate rounds from **real, sanitized Wikipedia articles** with planted mistakes, routed through the
   existing admin approve/reject queue.
3. Make difficulty real: it scales **article length, interaction model, mistake count, and scoring**.
4. Make clickable regions obviously interactive (marked mode) without leaking answers.

## Non-goals (YAGNI for this pass)

- Auto-approval / automated moderation of generated articles (human admin gate stays).
- Multiplayer or timed Fact Checker.
- Per-region difficulty hints.
- Tampering the infobox (it is stripped from play instead — see §Generation).

---

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Content scope | Real Wikipedia pipeline (fetch real article → tamper → admin queue) |
| Article length | **Scales with difficulty** (easy = lead only … hard/hardcore = full article) |
| Interaction model | **Scales with difficulty**: easy/medium = marked clickable chips; hard/hardcore = free drag-select |
| Generation trigger | **Both**: admin on-demand button + CLI batch script. All output is `pending`. |
| LLM | Claude via Anthropic SDK (new dep + `ANTHROPIC_API_KEY`). No other funded LLM key available. |
| Tampering strategy | **Deterministic wrap-at-generation** (Approach A) — pipeline does all HTML mutation; LLM only returns plain-text phrases |
| Matching | **`fcId` region lookup** — no string comparison at score time |
| Infobox | Stripped from the playable region (avoids trivial cross-checking of tampered body facts) |

### Why Approach A (deterministic wrap) over "LLM rewrites the article"

The root fragility is two lists joined by string equality. Approach A collapses clickable-target and
truth into **one DOM node** wrapped at generation time (`<span data-fc-id data-fc-mistake>`). "Is this
clickable?" and "is this a lie?" become the same `fcId` lookup. If the LLM returns a phrase the pipeline
cannot locate in the article text, that item is **discarded before save** — reachability is structurally
guaranteed. The LLM never sees or emits HTML, so it cannot hallucinate markup or tamper links.

---

## Design

### 1. Data model — Prisma `FactCheckArticle`

```prisma
model FactCheckArticle {
  id           String    @id @default(cuid())
  title        String
  subject      String
  category     String
  difficulty   String    @default("medium")   // NEW — code already reads this; column never existed
  tampered     String    @db.Text             // sanitized Wikipedia HTML w/ <span data-fc-id> wrappers
  mistakes     Json                            // [{ fcId, span, correct, explanation }]
  decoys       Json      @default("[]")        // NEW — [{ fcId, span }] true-but-suspicious markers
  sourceTitle  String?                         // NEW — Wikipedia page title (CC BY-SA attribution)
  sourceUrl    String?                         // NEW — permalink to the revision used
  status       String    @default("pending")
  createdAt    DateTime  @default(now())
  approvedAt   DateTime?
}
```

`mistakes` and `decoys` are keyed by `fcId` (the wrapper's `data-fc-id`), never by raw text — so a region's
rendered text ("20 April 1879") and the underlying lie ("1879") cannot desync. Each `mistakes[]` entry's
`span` stores the **exact false text as rendered** (the value the pipeline wrote into the article); this is
the key used for hard/hardcore free-select matching (§3). `sourceTitle`/`sourceUrl` satisfy Wikipedia
CC BY-SA attribution (rendered as a small footer in the article view).

### 2. Generation pipeline — `src/lib/factCheckerGen.js`

A single module called by both the admin button and the batch script.

```
generateTamperedArticle(subjectOrNull, difficulty, category?)
  1. subject = subjectOrNull ?? getRandomWikiPage()            // reuse src/lib/wikipedia.js
  2. { cleanHtml, title } = fetchAndSanitizeWiki(subject)      // reuse — real sanitized HTML
  3. trimmed = trimByDifficulty(cleanHtml, difficulty)
        easy      → lead section only
        medium    → lead + first 2-3 sections (~600-900 words)
        hard/core → full article
     strip the infobox (.infobox) from the playable region
  4. plain = visible-text extraction of `trimmed` via cheerio text-node walk (retain node map)
  5. LLM (Claude, Anthropic SDK) given `plain` returns strict JSON:
        { mistakes: [{ find, replacement, explanation }],  // find = EXACT true substring of plain
          decoys:   [{ find }] }                            // find = EXACT true substring (left unchanged)
        find        = the real phrase to locate (e.g. "1889") — also the correct answer revealed later
        replacement = the plausible lie to substitute (e.g. "1879") — what the player sees & selects
     required mistake counts: easy 3 / medium 4 / hard 5 / hardcore 6
     decoys ≈ 1.5× mistakes (used by easy/medium only; hard/hardcore render no visible markers)
     prompt rule: `replacement` must be UNAMBIGUOUSLY false (a different real date / place / rank),
                  never opinion, never anything that could accidentally be true.
  6. VALIDATE + WRAP (pipeline does all HTML mutation):
        for each item (mistakes then decoys):
          locate exact `find` occurrence in a text node
          - not found, OR ambiguous (>1 occurrence with no safe disambiguation) → DISCARD item
          - mistake → wrap `find` in <span data-fc-id="<cuid>" data-fc-mistake="true"> and replace its
                      visible text with `replacement`
          - decoy   → wrap `find` in <span data-fc-id="<cuid>" data-fc-mistake="false"> (text unchanged)
        build records:  mistakes[] = { fcId, span: replacement, correct: find, explanation }
                        decoys[]   = { fcId, span: find }
        if surviving mistakes < required → throw (caller retries up to 2×, else surfaces error)
  7. return { title, subject, category, difficulty,
              tampered: <serialized html>, mistakes, decoys,
              sourceTitle: title, sourceUrl, status: 'pending' }
```

Robustness invariants:
- A span that cannot be exactly located is dropped → **no unreachable mistakes can be saved**.
- The LLM operates only on plain visible text and returns phrases; the pipeline performs every HTML edit.
  No hallucinated markup; links/structure untouched.
- Infobox excluded so body-only tampering can't be trivially cross-checked against the infobox.
- Every generated article is `pending` and passes the **human admin approve/reject gate** before any
  player sees it — the factual backstop against a bad planted "mistake."

### 3. Rendering, matching & anti-cheat — `FactCheckerArticle.jsx` + article GET

**Anti-cheat invariant: the browser is never told which regions are lies.** The stored `tampered` HTML
carries `data-fc-mistake="true|false"`, but `GET /api/fact-checker/article` strips that truth per difficulty
before sending. The `mistakes`/`decoys` JSON is never sent to the client until the reveal endpoint (already
auth-gated). The component no longer does regex injection.

```
Article GET prepares client HTML by difficulty:
  easy/medium  → keep <span data-fc-id> on BOTH mistakes & decoys, STRIP data-fc-mistake.
                 (mistakes and decoys are indistinguishable in the DOM — no view-source leak)
  hard/core    → STRIP ALL fc wrappers → clean prose, no candidate-set tell at all.

Easy / Medium (marked):
  [data-fc-id] styled as an obviously interactive chip:
     faint tinted background + dotted underline + cursor:pointer,
     hover fills the tint, focus shows a ring (keyboard accessible).
  Every data-fc-id region is interactive; mistakes and decoys look IDENTICAL.
  click → e.target.closest('[data-fc-id]') → onAccuse({ fcId })

Hard / Hardcore (free-select):
  No wrappers in the DOM. Player drag-selects any prose they suspect.
  mouseup → window.getSelection(), constrained to the article container
     → guard: ignore if selection collapsed, <2 chars, or longer than the longest
       mistake span × 4 (over-select guard — can't drag a whole paragraph to win)
     → onAccuse({ selection: text })

POST /api/fact-checker/accuse { articleId, fcId?|selection?, foundSoFar: [identity…] }
```

Server-side resolution (`scoreAccusation`, §4) handles both inputs:
- `fcId` present → direct id lookup against `mistakes[]` (easy/medium — bug-proof, no string compare).
- `selection` present → normalized **overlap** match against `mistakes[].span`: a hit when the normalized
  selection equals, contains, or is contained by a mistake span. Because `span` is the exact false text the
  pipeline rendered (not an independently authored key), the original "1879 vs 20 April 1879" desync cannot
  recur. No overlap → wrong.

Affordance fix: the prior `1px dotted #94a3b8` underline alone was the "not visibly clickable" complaint —
replaced by a tinted chip + pointer cursor + hover fill + focus ring (easy/medium only; hard/hardcore is
intentionally unmarked).

### 4. Scoring & difficulty wiring — `src/lib/factChecker.js`, API routes

```
scoreAccusation({ fcId, selection }, article, difficulty):
  match = fcId
    ? article.mistakes.find(m => m.fcId === fcId)               // easy/medium: id lookup
    : article.mistakes.find(m => overlaps(normalize(selection), // hard/hardcore: text overlap
                                          normalize(m.span)))
  if match → { correct:true,  delta:+config.correct, explanation: match.explanation,
               answer: match.correct, foundId: match.fcId }
  else     → { correct:false, delta: config.wrong }             // decoy, miss, or stray text

overlaps(a, b): a === b || a.includes(b) || b.includes(a)
```

`SCORE_CONFIG` keeps its current values:

| Difficulty | Length | Interaction | Mistakes | correct / wrong |
|---|---|---|---|---|
| easy | lead only | marked chips | 3 | +100 / −30 |
| medium | lead + 2–3 sections | marked chips | 4 | +100 / −50 |
| hard | full article | free-select | 5 | +150 / −75 |
| hardcore | full article | free-select | 6 | +200 / −150 |

Route fixes that fall out of the real `difficulty` column:
- `GET /api/fact-checker/article` → `where: { status:'approved', difficulty }` (+ optional `category`).
  Currently the `difficulty` param is ignored at select time.
- `POST /api/fact-checker/accuse` → accepts `fcId` (easy/medium) **or** `selection` text (hard/hardcore);
  reads the real `article.difficulty` (today reads `undefined` → medium).
- `allFound = result.correct && new Set([...foundIds, result.foundId]).size >= article.mistakes.length`,
  where `foundIds` are the `fcId`s of prior correct accusations — robust against fast double-clicks, the
  current stale-state computation, and (in hard mode) two different selections that resolve to the same
  mistake.
- HUD `total = article.mistakes.length` (unchanged behavior, now reliably reachable).

### 5. Admin generate button + batch script

**Admin** (`/admin/fact-checker`, gated by existing `requireAdmin()`):
- Generate panel above the pending queue: subject (optional text), category (select), difficulty (select),
  or **Random** toggle.
- New `POST` handler on `src/app/api/admin/fact-checker/route.js` → `generateTamperedArticle(...)` →
  save `pending` → card appears in the queue.
- Pending-card preview renders the tampered HTML with mistakes/decoys flagged **for the admin**, so each
  planted lie + explanation can be sanity-checked before approval.

**Batch script** (`scripts/generate-fact-checker.mjs`, replaces `scripts/seed-fact-checker.mjs`):
```
node --env-file=.env.local scripts/generate-fact-checker.mjs \
     --count 20 --difficulty medium --category history [--subjects file.txt]
```
- No `--subjects` → `getRandomWikiPage()` per article.
- `--subjects file.txt` (one subject/line) → drives category expansion lists
  (Disasters / PopCulture / Religion / Mythology / Obscure).
- All output `pending`. Logs created / discarded-for-unlocatable-spans / retried counts.

`scripts/seed-fact-checker.mjs` is deleted — its hand-keyed `spans`/`mistakes` shape is the anti-pattern
being removed. `ANTHROPIC_API_KEY` documented in `DEPLOY.md` / `.env.example`.

### 6. Testing

vitest, matching the existing suite (LLM is mocked — no live API in tests):

- `factChecker.test.js` (rewrite for `fcId` matching):
  - mistake region → correct; decoy → wrong; stray id → wrong.
  - `allFound` trips only when every mistake `fcId` is collected.
  - **Regression for the original bug:** a mistake whose truth value ("1879") is a substring of its
    rendered region text ("20 April 1879") still resolves correct via `fcId`.
  - hard-mode overlap: a selection that equals / contains / is contained by a mistake's `span` scores
    correct; an unrelated selection scores wrong.
- `factCheckerGen.test.js`:
  - spans present in text get wrapped; hallucinated spans (absent) are discarded.
  - survivors < required → throws (retry path).
  - infobox excluded; HTML structure/links never mutated.
- **Anti-cheat (article GET):** easy/medium client HTML contains no `data-fc-mistake` attribute;
  hard/hardcore client HTML contains no `data-fc-id` wrappers at all; `mistakes`/`decoys` JSON is absent
  from the non-reveal response.
- Over-select guard unit test for hard-mode selection resolution.

### 7. Rollout

1. Prisma migration: add `difficulty`, `decoys`, `sourceTitle`, `sourceUrl` (all defaulted/nullable → safe
   on existing rows).
2. Retire the single legacy hand-seeded row (delete, or set `rejected` so it never serves).
3. Run the batch script for an initial library (~5 per difficulty across a couple of categories),
   review/approve in admin.
4. Article route serves only `approved` rows → players never see ungated content.

---

## Files touched

| File | Change |
|---|---|
| `prisma/schema.prisma` | + `difficulty`, `decoys`, `sourceTitle`, `sourceUrl` on `FactCheckArticle` |
| `src/lib/factCheckerGen.js` | NEW — fetch + trim + LLM tamper + validate/wrap pipeline |
| `src/lib/factChecker.js` | `scoreAccusation` → `fcId` lookup |
| `src/lib/wikipedia.js` | reused as-is (`fetchAndSanitizeWiki`, `getRandomWikiPage`) |
| `src/components/FactCheckerArticle.jsx` | render pre-wrapped HTML; click/select → `fcId`; affordance fix |
| `src/app/api/fact-checker/article/route.js` | filter by `difficulty`; strip truth per difficulty (drop `data-fc-mistake` for easy/medium, drop all wrappers for hard/hardcore); expose `mistakeCount` |
| `src/app/api/fact-checker/accuse/route.js` | accept `fcId` **or** `selection`; real `difficulty`; identity-`Set` `allFound` |
| `src/app/api/admin/fact-checker/route.js` | + `POST` generate handler |
| `src/app/admin/fact-checker/page.jsx` | + generate panel; admin preview of flagged regions |
| `scripts/generate-fact-checker.mjs` | NEW batch generator (replaces `seed-fact-checker.mjs`) |
| `DEPLOY.md` / `.env.example` | document `ANTHROPIC_API_KEY` |
| tests | `factChecker.test.js` rewrite, `factCheckerGen.test.js` new, over-select guard test |

## New dependency

- Anthropic SDK (`@anthropic-ai/sdk`) + `ANTHROPIC_API_KEY` env var.