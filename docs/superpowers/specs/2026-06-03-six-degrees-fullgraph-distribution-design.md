# Six Degrees — Full-Graph Offline Distribution (Approach C) — Design Spec

**Date:** 2026-06-03
**Project:** find-hitler (Six Clicks)
**Status:** Approved (brainstorming) → ready for implementation planning
**Branch:** `feat/six-degrees-fullgraph`
**Relation to prior work:** Builds on the [Six Degrees Phase 1 spec](2026-06-02-six-degrees-pipeline-design.md). Phase 1's live-API meet-in-the-middle engine is correct on small graphs but **infeasible** over random pages for a high-in-degree target (Adolf Hitler): `precomputeReverseLayers` would require ~250k page-parses at depth 2, and `backlinks` is capped at 500 with no continuation, so reverse layers are incomplete and most pages get falsely "capped." This spec is the feasible path to the actual distribution — the deferred "approach C / Phase N" from Phase 1's roadmap.

---

## 1. Goal

Compute the **true full-population distribution** of minimum link-distance from every English Wikipedia article (namespace 0) to **Adolf Hitler**, and report it as the scientific answer to "is *six clicks* real?" — empirically, with the violation rate and the farthest pages.

### Metric and honesty caveat

This uses the **full rendered link graph** (the SDOW dataset, derived from Wikipedia's `page`/`pagelinks`/`redirect` dumps — includes navbox/template links). This is the **classic "six degrees of Wikipedia" metric**, and the right tool for the science question. It is a **lower bound on in-game body-clicks** (the game strips navboxes; see Phase 1 §2.1). The report must state this explicitly. Body-graph difficulty for game modes remains a separate, feasible, per-page-as-played concern (Phase 2+), not this spec.

---

## 2. Why offline, not the live crawl

- No Wikipedia crawling at all → no rate/feasibility wall, no segmentation needed, no politeness concerns.
- One prebuilt adjacency + one reverse BFS labels **every** reachable article in a single sweep → the complete population result, not a sample.
- DB-free: writes only local files. Respects the standing "hold" on the live Postgres `PageDistance` integration (that hold is unaffected by this work).

---

## 3. Data source — SDOW SQLite

- **Location:** public GCS bucket `gs://sdow-prod/dumps/<YYYYMMDD>/sdow.sqlite.gz`, HTTPS-accessible at `https://storage.googleapis.com/sdow-prod/dumps/<YYYYMMDD>/sdow.sqlite.gz`. Latest dump date is discovered at runtime by listing the bucket; fall back to a known-good date (2023-12-20, 4.3 GB) if listing fails.
- **Size:** ~4.3 GB compressed, ~12–15 GB uncompressed. Local disk has 287 GB free.
- **Schema:**
  - `pages(id INTEGER, title TEXT, is_redirect INTEGER)` — `title` is sanitized (underscores for spaces). `is_redirect` 1/0.
  - `links(id INTEGER, outgoing_links_count, incoming_links_count, outgoing_links TEXT, incoming_links TEXT)` — `outgoing_links`/`incoming_links` are **`|`-separated page-ID lists** (plain text, no decompression).
  - `redirects(source_id INTEGER, target_id INTEGER)`.
- **Scope:** namespace 0 only; redirect-resolved during SDOW's build (links point to canonical pages; `redirects` maps redirect→target).

**Fallback:** if the SDOW bucket is unavailable, the same result can be built from Wikipedia's raw `page`/`pagelinks`/`linktarget`/`redirect` SQL dumps — but that is a much larger parse+build job and is out of scope unless SDOW fails. (Documented as a contingency, not built.)

---

## 4. Algorithm — reverse BFS from the target

Distance-to-Hitler for page `P` = length of the shortest **forward** path `P → … → Adolf Hitler` (each hop = "P links to the next page"). Computing this for *every* `P` in one pass = a single **reverse BFS from Hitler over the reverse adjacency**, where a node's reverse-neighbors are the pages that link *to* it — exactly `links.incoming_links`.

```
resolve target id:
  row = pages WHERE title='Adolf_Hitler'
  if row.is_redirect: follow redirects(source_id=row.id).target_id
  target_id = canonical id

dist = { target_id: 0 }        # int -> int
frontier = [target_id]
d = 0
while frontier:
  d += 1
  next = []
  for chunk in batches(frontier, 10000):
     SELECT id, incoming_links FROM links WHERE id IN (chunk)
     for each row:
        for nid in row.incoming_links.split('|'):   # pages linking TO this node
           nid = int(nid)
           if nid not in dist:
              dist[nid] = d
              next.append(nid)
  frontier = next
```

- **Chunked `IN` queries** keep this to minutes (frontiers reach millions at d=2–3; ~6.5M nodes total, each visited once).
- **Memory:** `dist` is one int→int map over ~6.5M ids — a few hundred MB in Python; comfortable in 15.7 GB.
- **Direction check (critical):** we expand via `incoming_links` (reverse edges). A unit test / sanity assertion verifies on a tiny synthetic graph that reverse-BFS distances equal forward shortest-path-to-target distances. Getting this backwards would invert the whole result.
- **Unreachable pages:** any article never assigned a `dist` cannot reach Hitler by any link path → counted as `unreachable`.

---

## 5. Outputs

`scripts/six-degrees/` (the script aggregates during/after the BFS — it does **not** emit 6.5M rows):

- `docs/six-degrees/fullgraph-<dumpdate>.json` — `{ dumpDate, targetTitle, targetId, totalArticles, reachable, unreachable, histogram: {1: n, 2: n, …}, pctWithinSix, median, mean, max, farthest: [{title, dist}, … top 100] }`.
- `docs/six-degrees/fullgraph-<dumpdate>.md` — human-readable: headline ("**X% of all N articles reach Adolf Hitler in ≤6 link-clicks**"), the histogram table, median/mean/max, unreachable count, the farthest-pages list (hard-mode seeds), and the **full-graph-vs-body-graph caveat**.

Titles for the `farthest`/report come from the `pages` table (id→title), de-sanitized (underscores→spaces) for readability.

---

## 6. Components / files

- `scripts/six-degrees/c-fetch-sdow.mjs` (Node) — discover latest dump date (list the public bucket via the GCS JSON/XML listing endpoint), download `sdow.sqlite.gz` to `.cache/six-degrees/`, gunzip. Resumable (skip if already present); prints the resolved dump date + sizes. **The actual download is gated on explicit user go-ahead at execution time** (4.3 GB).
- `scripts/six-degrees/c-distances.py` (Python 3) — open the SQLite read-only, resolve target id (+redirect), run the chunked reverse BFS, aggregate the histogram + farthest list, write the `.json` + `.md` reports. A small synthetic-graph self-test (run with `--selftest`) asserts the reverse-BFS direction is correct without needing the real DB.
- `.gitignore` — ensure `.cache/` covers the downloaded DB (already ignored from Phase 1).

**Language:** the BFS/aggregation is Python (sqlite3 + stdlib, efficient for this data scale); the fetch helper is Node to match the project. Both are standalone offline tools, not app code — no app imports, no DB, no Prisma.

---

## 7. Testing

- **Python `--selftest`:** build a tiny in-memory SQLite with a known synthetic graph (e.g. A→B→Hitler, C→Hitler, D isolated), run the reverse BFS, assert distances {Hitler:0, B:1, C:1, A:2}, D unreachable. This pins the reverse-direction correctness and the chunked-IN logic without the 15 GB DB.
- **Aggregation unit:** assert histogram/pctWithinSix/median/max on a hand-built `dist` map (mirrors Phase 1's `buildReport` checks).
- No live network in tests; the real download + full BFS is a manual, gated run.

---

## 8. Non-goals / out of scope

- Body-graph fidelity (this is the full-graph metric by design — see §1 caveat).
- Loading results into Postgres / `PageDistance` (DB hold still stands; a later step can bulk-load if wanted).
- Building from raw Wikipedia dumps (only the SDOW contingency in §3, not implemented unless SDOW fails).
- Per-pair shortest *paths* (we need distance-from-every-page-to-one-target, not arbitrary pairs).
- Game-mode tiering / UI (Phase 4).
