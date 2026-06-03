# Six Degrees — Wikimedia Dumps Parser (current full graph) — Design Spec

**Date:** 2026-06-03
**Project:** find-hitler (Six Clicks)
**Status:** Approved (brainstorming) → ready for implementation planning
**Branch:** `feat/six-degrees-fullgraph`
**Relation to prior work:** Sources the graph for the [full-graph offline distribution](2026-06-03-six-degrees-fullgraph-distribution-design.md). That spec assumed the prebuilt SDOW SQLite, but `sdow-prod` is now a **requester-pays** GCS bucket (no anonymous download). Free prebuilt mirrors exist (SNAP enwiki-2013, WikiLinkGraphs 2018) but are stale; the user chose **current data**, which means building the graph from Wikimedia's own dumps. The reverse-BFS/report core (`build_distribution`, `render_markdown`, and the `resolve_target_id` pattern in `scripts/six-degrees/c_distances.py`) is reused; only the **graph-acquisition + parse + store** stage is new.

---

## 1. Goal

From Wikimedia's current English Wikipedia SQL dumps, build the directed namespace-0 link graph, reverse-BFS from Adolf Hitler, and produce the true full-population distribution of minimum link-distance — the current-snapshot version of the "is six clicks real?" result.

**Metric:** the full **rendered** link graph (`pagelinks` includes template/navbox-expanded links). Same classic six-degrees metric as the SDOW plan; a **lower bound on in-game body-clicks**. The report states this caveat.

---

## 2. Data source — Wikimedia dumps (free, anonymous)

From `https://dumps.wikimedia.org/enwiki/latest/` (verified present, anonymously downloadable):
- `enwiki-latest-page.sql.gz` — ~2.4 GB — table `page`: `page_id, page_namespace, page_title, page_is_redirect, …`
- `enwiki-latest-redirect.sql.gz` — small — table `redirect`: `rd_from, rd_namespace, rd_title, …`. (If absent from `latest/`, fetch from the most recent dated dump dir; redirect resolution degrades gracefully if unavailable — see §4.)
- `enwiki-latest-linktarget.sql.gz` — ~1.4 GB — table `linktarget`: `lt_id, lt_namespace, lt_title`.
- `enwiki-latest-pagelinks.sql.gz` — ~6.96 GB — table `pagelinks`: `pl_from, pl_from_namespace, pl_target_id`.

**2024 schema change (correctness-critical):** `pagelinks` no longer stores target titles. `pl_target_id` references `linktarget.lt_id`; the actual target is `linktarget(lt_namespace, lt_title)`. Every edge MUST be resolved through `linktarget`. Missing this corrupts the entire graph.

~11 GB total download. Local disk has 287 GB free; the working `edges` sqlite + index is ~30–40 GB.

---

## 3. Pipeline — resumable staged build

All intermediate artifacts under `.cache/six-degrees/dumps/` (gitignored). Each stage skips if its output already exists, so a failure mid-parse doesn't restart the 11 GB download or earlier stages.

1. **Fetch** the 4 dumps (gated — the ~11 GB download runs only on explicit go-ahead). Skip-if-present.
2. **Parse `page`** → write `pages(id, title, is_redirect)` (namespace 0 only) into the work sqlite `graph.sqlite`. Build an in-memory `title→id` dict (ns0; ~6.5M entries, ~1–1.5 GB).
3. **Parse `redirect`** → build `redirectTo = {redirect_page_id → canonical_target_id}` by resolving `rd_title`→id via `title→id` (ns0; chase at most one hop — MediaWiki double-redirects are rare and bounded; resolve one level).
4. **Parse `linktarget`** → build `ltToDst = {lt_id → canonical dst_id}` (int→int): for each ns0 `lt_id`, map `lt_title`→id via `title→id`, then apply `redirectTo`. **Then drop the `title→id` string dict** (no longer needed for the heavy pass; the BFS target is resolved later from the `pages` table).
5. **Parse `pagelinks`** (the 6.96 GB pass) → for each row, require `pl_from_namespace == 0`; look up `dst = ltToDst[pl_target_id]`; if both `pl_from` (canonical, non-redirect) and `dst` are valid ns0 ids and `src != dst`, batch-`INSERT INTO edges(src, dst)`. Resolve `pl_from` through `redirectTo` too (a link *from* a redirect page is rare; keep canonical).
6. **Index** `CREATE INDEX ix_edges_dst ON edges(dst)`.
7. **Reverse-BFS** from the target id (resolved from `pages` by title, following a redirect) via `reverse_bfs_edges`.
8. **Aggregate + report** with the reused `build_distribution` + `render_markdown` → `docs/six-degrees/fullgraph-dumps-<date>.{json,md}`.

**Memory plan:** the expensive pagelinks pass holds only compact int→int maps (`ltToDst`, `redirectTo`) + the sqlite write batch — well under 15.7 GB. The `title→id` string dict exists only through stage 4 and is dropped before stage 5. The BFS `dist` dict (~0.5 GB) is built in stage 7, after the maps are no longer needed.

---

## 4. Components / files

- `scripts/six-degrees/d_parse_dumps.py` (Python, underscored = importable):
  - `parse_sql_tuples(line)` — the streaming **tuple scanner**: given an `INSERT … VALUES (…),(…);` line, yield each tuple as a list of field strings, correctly handling `\'`, `\\`, `\"` escapes, commas/parens inside quoted strings, `NULL`, and unicode. The highest-risk unit.
  - `iter_table_rows(path, columns)` — stream-decompress a `.sql.gz`, find `INSERT INTO` lines for the table, yield tuples (as the needed column subset).
  - `build_graph(paths, work_db)` — stages 2–6: build `pages`, `redirectTo`, `ltToDst`, then stream pagelinks → `edges` + index. Returns the sqlite connection.
  - `reverse_bfs_edges(conn, target_id, chunk=10000)` — BFS expanding `SELECT src FROM edges WHERE dst IN (chunk)`; returns `{id: dist}`. (Direction: in-neighbors via `dst=` → distance-to-target.)
  - `main()` — argparse (`--dumps-dir`, `--target` default "Adolf Hitler", `--out-dir`, `--dump-date`, `--top`, `--selftest`); resolves target from `pages`, runs build_graph (or reuses an existing `graph.sqlite`), BFS, report. Imports `build_distribution`, `render_markdown` from `c_distances.py` (same dir; add the dir to `sys.path`).
- `scripts/six-degrees/d-fetch-dumps.mjs` (Node) — download the 4 dump files to `.cache/six-degrees/dumps/`, skip-if-present, print sizes; gated direct-invocation only (like `c-fetch-sdow.mjs`).
- `.gitignore` already covers `.cache/`.

**Redirect-file fallback:** if `enwiki-latest-redirect.sql.gz` is unavailable, the build proceeds with an empty `redirectTo` (links to redirect titles then resolve to the redirect page's own id, which has no out-edges → those targets look like leaves). This slightly *over*-estimates some distances; the report notes whether redirect resolution was applied.

---

## 5. Testing (offline, `--selftest`, no real dumps, no network)

- **Tuple scanner** against escape-heavy fixtures: `(1,0,'Simple',0),(2,0,'Has, comma',0),(3,0,'O\'Brien',0),(4,0,'Back\\slash',1),(5,0,'',0)` → assert exact field lists, including the embedded comma, escaped apostrophe, escaped backslash, and empty string.
- **End-to-end synthetic build**: tiny in-memory/temp `.sql.gz`-shaped strings for page/linktarget/pagelinks/redirect encoding a known graph (A→B→Hitler, C→Redir→Hitler, D isolated, plus a non-ns0 page that must be filtered out) → `build_graph` → `reverse_bfs_edges` from Hitler → assert distances, that the redirect collapses, that the non-ns0 page is excluded, and that D is unreachable.
- **`reverse_bfs_edges` direction**: a hand-built `edges` table → assert distance-to-target (mirrors the `c_distances.py` `--selftest`).
- **Aggregation** is already covered by `c_distances.py`'s `_selftest_pure` (reused function).

---

## 6. Risks / non-goals

- **Time:** the pagelinks parse + ~600M-row insert + index build is slow (~30–90+ min); the 11 GB download is long. Both gated + resumable.
- **Parse correctness** is the main risk → mitigated by the fixture tests; a subtle scanner bug would silently corrupt edges.
- **Non-goals:** body-graph fidelity (this is the full rendered graph by design — §1 caveat); loading results into Postgres (DB hold stands); per-pair shortest paths; UI/tiering (Phase 4). The free mirrors (SNAP/WikiLinkGraphs) are not used (current data was chosen over them).
