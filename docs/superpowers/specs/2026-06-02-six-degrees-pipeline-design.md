# Six Degrees Pipeline — Design Spec

**Date:** 2026-06-02
**Project:** find-hitler (Six Clicks)
**Status:** Approved (brainstorming) → ready for implementation planning
**Scope of this spec:** Phase 1 only (measurement core + baseline batch + growth-ready schema). Phases 2–N are roadmap.

---

## 1. Goal

Build a **living, scientifically honest dataset** that answers, for any Wikipedia start page, *how many clicks are minimally necessary to reach Adolf Hitler* — measured over the exact link graph the game lets players click.

The dataset serves two purposes:

1. **Game content** — rank start pages by difficulty so harder modes can draw from higher-click pages.
2. **Conceptual credibility** — empirically test the "Six Clicks" premise and report what is actually true (a measured distribution + violation rate), giving the project weight as an insight, not just a game.

### Reframed premise (important)

"Six Clicks" is a **strong empirical tendency, not a theorem.** Six Degrees of Wikipedia data shows median shortest paths ~3 and most pairs ≤6, but obscure stubs and dead-end pages genuinely exceed it. The strongest version of this project is **not** "prove it's always ≤6" — it's "stress-test the hypothesis and publish the measured distribution, the violation rate, and the specific pages that break it." That framing survives a skeptic; an asserted guarantee does not.

---

## 2. Key conceptual decisions (settled during brainstorming)

### 2.1 A "click" is measured over the **real body-link graph**

There are two link graphs in this codebase and they disagree:

- The **live game** navigates `validLinks` from `fetchAndSanitizeWiki` ([src/lib/wikipedia.js](../../../src/lib/wikipedia.js)) — body-content links only, with `navbox` / `vertical-navbox` stripped (infobox + references kept).
- `bfsDistance.js` measures over the Wikipedia `prop=links` API, which includes *all* links (navboxes, infoboxes, see-also). That graph has phantom shortcuts a player cannot click, so it **systematically understates** real click distance.

**Decision:** distances are measured over the body-link graph — the exact edges a player can click. This guarantees a "click" in the dataset means precisely what it means in the live game.

### 2.2 Two distinct numbers, tracked separately

- **Verified minimum** — the true shortest path (a graph property our BFS computes; this is what objectively makes a page "hard").
- **Best user-found path** (Phase 3) — a human-submitted path; its click count is an *upper bound* (≥ the verified minimum).

Verifying a claimed path is **cheap and exact** (confirm each consecutive page-pair has a body link). Computing the verified minimum is the expensive part (BFS). If a user's *verified* path is shorter than our computed minimum, that is a signal our body-link cache **missed an edge** — so user submissions actively correct/improve the graph. The celebrated record is a user path that equals the verified minimum (provably optimal).

### 2.3 Offline precompute, not live computation

Body links branch ~50–150 per page, so a naive forward BFS to depth 6 would touch ~50⁶ pages — combinatorially impossible against Wikipedia rate limits. Distances are precomputed offline into a committed/queryable dataset that grows over time. Never measured all ~6M articles; coverage crystallizes from a random baseline + every page played (Phase 2) + every page submitted (Phase 3).

### 2.4 Storage split

- **Body-link cache** (bulky, fully regenerable) → **local disk** (lives with the batch script, never touches prod, no Render free-tier pressure).
- **Per-page results** (small, app-facing) → **Postgres via Prisma** (the game queries these).

### 2.5 Distance engine = meet-in-the-middle BFS (approach B)

Chosen over forward-only-per-page (infeasible) and full-census (approach C, deferred — see roadmap). Precompute Hitler's *backward* body-link layers once and share them across the whole batch; each start then forward-BFSes only up to `cap − backwardDepth` and checks for intersection. Exact (not a heuristic upper bound) and the only feasible option at sample scale.

**Fidelity subtlety:** the backward step uses Wikipedia's `linkshere` API (full-graph backlinks, incl. navboxes) **only to propose** candidate predecessors, then **confirms** each candidate truly has a *body* link via the same `extractBodyLinks` the game uses. Propose-then-confirm keeps fidelity exact without crawling the whole graph backward.

---

## 3. Architecture — Phase 1 components

All new code under `src/lib/sixDegrees/` (isolated namespace) plus `scripts/six-degrees/`. The only edit to existing code is extracting `extractBodyLinks` from `wikipedia.js`; everything else is additive.

### 3.1 `extractBodyLinks($body) → string[]` — fidelity linchpin

Refactor the inline link-extraction logic currently in `fetchAndSanitizeWiki` ([src/lib/wikipedia.js](../../../src/lib/wikipedia.js)) into a shared helper (same navbox/`vertical-navbox`/`.navbar`/reference-strip rules, same `/wiki/` + no-`:` filter). Imported by **both** `fetchAndSanitizeWiki` *and* the measurement cache so the played graph and the measured graph can never drift.

- **Acceptance:** the game's `validLinks` for a page equals `extractBodyLinks` output for that page (parity test). Refactor changes no observable behavior in the live game.

### 3.2 `titleCanon.js` — normalization + redirect resolution

Canonicalizes titles (underscores ↔ spaces, casing) and batch-resolves redirects via the API, so `Hitler`, `Adolf_Hitler`, and `Adolf Hitler` collapse to one node. Without this the forward/backward frontiers won't meet correctly.

- `canonicalize(title) → string`
- `resolveRedirects(titles[]) → Map<input, canonical>` (batched API)

### 3.3 `bodyLinkCache.js` — `getBodyLinks(title) → string[]`

Fetches a page via the `action=parse` API, runs `extractBodyLinks`, canonicalizes results, caches to a **local NDJSON file** (append-only; loaded into a `Map` on start; no native deps; fine to tens of thousands of pages — SQLite is the noted upgrade path if it grows).

- Polite crawl: descriptive `User-Agent`, bounded concurrency (~4), `maxlag=5`, retry-with-backoff on 429/503.
- Cache key = canonical title. Stores `{ title, links, fetchedAt }`.

### 3.4 `distanceEngine.js`

- `precomputeReverseLayers(target, depth) → Layer[]` — builds the target's confirmed body-backlink layers L1…L_depth once per batch (propose via `linkshere`, confirm via `getBodyLinks`).
- `measureDistance(start, target, { cap = 8, backwardDepth = 3, reverseLayers }) → { minClicks, path, status }`
  - Meet-in-the-middle: forward-BFS from `start` up to `cap − backwardDepth`; intersect frontier with shared `reverseLayers`. If `start` itself is in a backward layer, distance is immediate.
  - `status`: `"exact"` (found ≤ cap), `"capped"` (not found within cap; min unknown, ≥ cap+1), `"unreachable"` (frontier exhausted).
  - Returns one concrete shortest `path` (for display + hard-mode seeding).
- Every function is **target-parameterized** (default `"Adolf Hitler"`), so Jesus/Stalin/etc. work with zero new code.

### 3.5 `pathVerifier.js` — `verifyPath(path, target) → { valid, brokenAt }`

Confirms each consecutive pair `b ∈ getBodyLinks(a)` and that the final node canonicalizes to `target`. Exact and cheap. Phase 1 uses it to validate seed paths; Phase 3's submission flow reuses it unchanged. Returns `brokenAt` (index of the first severed edge) when invalid.

---

## 4. Data model (Prisma — results only)

Follows existing conventions (`cuid()` IDs, `String[]` paths like `Match.path`, `@default(now())`).

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

  @@unique([startTitle, target]) // re-measuring upserts
  @@index([target, minClicks])   // "hardest pages for target" query
}
```

**Growth hooks:** `source` distinguishes feeders; `@@unique([startTitle, target])` makes re-measurement an upsert; `@@index([target, minClicks])` makes "hardest pages" cheap. Phases 2–3 write rows with different `source`; submissions get their own table referencing this — no schema rework.

---

## 5. Batch runner & report

### 5.1 `scripts/six-degrees/run-baseline.mjs`

Flags: `--sample N`, `--target "Adolf Hitler"`, `--cap 8`, `--backward-depth 3`, `--concurrency 4`, `--resume`.

Flow:
1. `precomputeReverseLayers(target, backwardDepth)` once.
2. Draw `N` random main-namespace pages via existing `getRandomWikiPage`, deduped.
3. `measureDistance` each → **upsert** `PageDistance`.
4. Checkpoint progress to disk after each page → **resumable** long crawl.
5. Emit report.

Resumability and politeness are first-class (crawl may run a while).

### 5.2 Report — `docs/six-degrees/baseline-<date>.md` + `.json`

The "science" artifact:
- minClicks histogram (1…8+);
- **headline: "six clicks holds for X% of the sample"** (% reachable ≤6);
- median / mean / max observed;
- **violation list** — pages with minClicks ≥7 or `capped` (these are the hard-mode seeds);
- method note: body graph, cap, sample size, date, and the "Wikipedia is a moving snapshot" caveat.

---

## 6. Testing

vitest (existing setup). **All unit tests inject a mock fetcher — zero live Wikipedia calls**, exactly like the current `bfsDistance` tests.

- meet-in-the-middle equals naive BFS on hand-built small graphs;
- `cap` / `unreachable` statuses;
- redirect canonicalization collapses aliases (forward/backward frontiers meet);
- `verifyPath` accepts valid paths, reports correct `brokenAt` on a severed edge, accepts redirect-equivalent endpoints;
- `extractBodyLinks` parity — the refactor doesn't change which links the live game sees.

---

## 7. Roadmap (NOT in Phase 1)

- **Phase 2 — Organic coverage.** Queue + background worker lazy-measures every start page anyone plays (`source="game"`). The "crystallize over time" feeder. Reuses the Phase 1 engine unchanged.
- **Phase 3 — User submissions + records.** Endpoint to submit a start page + claimed path; `verifyPath` confirms exactly. Stores `source="submission"`, tracks best user path alongside the verified minimum. Self-correcting loop: a verified user path shorter than our minimum flags a missing cache edge and auto-queues a re-measure. "Provably optimal path" = celebrated record.
- **Phase 4 — Insights surface + hard-mode tiering.** In-app page rendering the distribution, violation rate, and hardest pages ("Is Six Clicks actually true? We tested it"). Hard modes draw start pages from `PageDistance` by tier (e.g. 1–2 trivial, 3–4 normal, 5–6 hard, 7+/capped "Brutal").
- **Phase N — Full body-graph census (approach C).** Crawl the entire body graph, build reverse adjacency, one reverse BFS from Hitler labels *every* article. Definitive "every page" map; multi-day crawl + real storage + Wikipedia load. Deferred until/unless this becomes a standalone research artifact. **Explicitly logged as future work.**

---

## 8. Out of scope / non-goals (Phase 1)

- No in-app UI (insights page, hard-mode wiring) — Phase 4.
- No game-start tracking or background worker — Phase 2.
- No user submission endpoint or records — Phase 3.
- No full-Wikipedia census — Phase N.
- No changes to live game behavior beyond the behavior-preserving `extractBodyLinks` refactor.