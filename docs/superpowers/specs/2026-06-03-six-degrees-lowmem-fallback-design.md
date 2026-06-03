# Six Degrees — Memory-Bounded Graph Build (lowmem fallback) — Design Spec

**Date:** 2026-06-03
**Project:** find-hitler (Six Clicks)
**Status:** Approved (brainstorming) → ready for implementation planning
**Branch:** `feat/six-degrees-fullgraph`
**Relation to prior work:** Extends the [Wikimedia dumps parser](2026-06-03-six-degrees-dumps-parser-design.md). The dumps parser's `build_graph` (in `scripts/six-degrees/d_parse_dumps.py`) holds the `title→id` map (~17M ns0 pages) and `lt_id→dst_id`/`redirect_to` maps in Python dicts. On the target machine this OOM'd during stage 1 (only ~0.7 GB free of 16.9 GB; the rest held by concurrent sessions/servers). This spec adds a memory-bounded build path that completes regardless of free RAM.

---

## 1. Goal

Make the graph build complete on a RAM-starved machine by resolving all the big maps via on-disk sqlite instead of in-memory Python dicts — automatically falling back to it when the fast path OOMs, and forceable via a flag.

---

## 2. Components

### `build_graph_lowmem(paths, work_db)`
Same signature and **same output tables** as `build_graph` (`pages(id,title,is_redirect)`, `redirects(source_id,target_id)`, `edges(src,dst)` + index on `edges(dst)`), so `reverse_bfs_edges`, `resolve_target_id`, and the report path are unchanged. Resolves via SQL JOINs over on-disk temp tables — no large Python structures:

1. **page** → `pages(id,title,is_redirect)` (ns0); `CREATE INDEX pages_title ON pages(title)`.
2. **redirect** (ns0) → temp `redir_raw(rd_from, rd_title)`; then `INSERT INTO redirects(source_id,target_id) SELECT rr.rd_from, p.id FROM redir_raw rr JOIN pages p ON p.title = rr.rd_title`; `CREATE INDEX redirects_src ON redirects(source_id)`.
3. **linktarget** (ns0) → temp `lt_raw(lt_id, lt_title)`; then `CREATE TABLE lt(lt_id INTEGER PRIMARY KEY, dst_id INTEGER)` filled by `INSERT INTO lt SELECT l.lt_id, COALESCE(r.target_id, p.id) FROM lt_raw l JOIN pages p ON p.title = l.lt_title LEFT JOIN redirects r ON r.source_id = p.id`.
4. **pagelinks** (ns0-from) → temp `pl_raw(pl_from, lt_id)`; then `INSERT INTO edges(src,dst) SELECT COALESCE(r.target_id, pl.pl_from), lt.dst_id FROM pl_raw pl JOIN lt ON lt.lt_id = pl.lt_id LEFT JOIN redirects r ON r.source_id = pl.pl_from WHERE COALESCE(r.target_id, pl.pl_from) <> lt.dst_id` (the self-loop filter repeats the `COALESCE` expression rather than referencing a SELECT alias — SQLite does not reliably allow output-column aliases in `WHERE`).
5. `CREATE INDEX ix_edges_dst ON edges(dst)`; `DROP TABLE redir_raw, lt_raw, pl_raw`; commit.

Raw rows are inserted in batches (e.g. 50k) during the streaming passes; the JOINs run once per stage. PRAGMAs for throughput on a starved box: `journal_mode=OFF` (or MEMORY), `synchronous=OFF` (this is a regenerable cache DB, so durability doesn't matter).

### Triggering (in `main`)
- **`--lowmem` flag:** when set, call `build_graph_lowmem` directly (skip the fast path). This is the correct mode on a known-starved machine.
- **Auto-fallback:** otherwise `try: build_graph(...) except MemoryError:` → print a notice, close + `os.remove` the partial `work_db`, `gc.collect()`, then `build_graph_lowmem(...)`.

---

## 3. Testing (offline, `--selftest`)

- **`_selftest_build_lowmem`:** the SAME synthetic gz dump fixtures as `_selftest_build` (A→B→Hitler, C→Redir→Hitler, D isolated, ns1 page filtered) run through `build_graph_lowmem`; assert `resolve_target_id(conn,"Adolf_Hitler")==1` and `reverse_bfs_edges(conn,1) == {1:0,2:1,3:1,4:2}`. This proves the lowmem path produces a graph **identical** to the fast path (same redirect collapse, ns0 filtering, linktarget indirection).
- Wired into `--selftest` after `_selftest_build`.
- (Auto-fallback and `--lowmem` routing are not unit-tested — they're thin control flow over the two build functions, both of which are tested directly. The real run exercises them.)

---

## 4. Risks / non-goals

- **Time/disk:** lowmem trades RAM for disk + time — `pl_raw` is ~600M rows (~15–20 GB temp; 287 GB free), and the JOINs + index builds are slow, *especially* page-cache-thrashed at <1 GB free (possibly hours). Acceptable: the data run is deferred and run with `--lowmem`.
- **Post-MemoryError fragility:** catching `MemoryError` in-process is best-effort; the robust path on a starved machine is `--lowmem` (never attempt the doomed fast build). Documented in `--help` and the deferred-run notes.
- **Non-goals:** changing the metric (still full rendered graph), the BFS, or the report; tuning sqlite beyond the throughput PRAGMAs; Postgres (DB hold stands).
