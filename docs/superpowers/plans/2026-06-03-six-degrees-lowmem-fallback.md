# Six Degrees — Memory-Bounded Build (lowmem fallback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-disk, memory-bounded graph build (`build_graph_lowmem`) to `d_parse_dumps.py` that completes at <1 GB free RAM, plus a `--lowmem` flag and an automatic `MemoryError` fallback.

**Architecture:** A second build function with the SAME output tables as `build_graph` (pages/redirects/edges) resolves the title/redirect/linktarget maps via sqlite JOINs over on-disk temp tables instead of Python dicts. `main()` gains a `--lowmem` flag (force it) and wraps the fast build in `try/except MemoryError` (auto-fallback). A synthetic self-test proves the lowmem path produces the identical graph to the fast path.

**Tech Stack:** Python 3.12 stdlib `sqlite3` (PRAGMA journal_mode=OFF / synchronous=OFF on the regenerable cache DB); reuses `iter_table_rows`, `reverse_bfs_edges`, `resolve_target_id`.

**Design source:** [docs/superpowers/specs/2026-06-03-six-degrees-lowmem-fallback-design.md](../specs/2026-06-03-six-degrees-lowmem-fallback-design.md)

**Run Python self-tests:** `python scripts/six-degrees/d_parse_dumps.py --selftest`

---

## File Structure

**Modified (only):** `scripts/six-degrees/d_parse_dumps.py` — add `build_graph_lowmem`, extract `_make_synthetic_dumps`, add `_selftest_build_lowmem`, add `--lowmem` + fallback to `main()`.

Current relevant state of the file: it has `parse_sql_tuples`, `reverse_bfs_edges`, `iter_table_rows`, `build_graph`, `_write_gz`, `_selftest_scanner`, `_selftest_bfs_edges`, `_selftest_build` (which inline-writes synthetic dumps via `_write_gz`), and `main()` whose `--selftest` branch calls `_selftest_scanner()`, `_selftest_bfs_edges()`, `_selftest_build()`.

---

### Task 1: `build_graph_lowmem` + shared synthetic fixtures + parity self-test

**Files:** Modify `scripts/six-degrees/d_parse_dumps.py`

- [ ] **Step 1: Add `build_graph_lowmem` immediately ABOVE the `_write_gz` definition**

```python
def build_graph_lowmem(paths, work_db):
    """Same output as build_graph (pages/redirects/edges) but resolves the title,
    redirect, and linktarget maps via on-disk sqlite JOINs instead of in-memory
    dicts. Slower + disk-heavy, but completes at <1 GB free RAM."""
    if os.path.exists(work_db):
        os.remove(work_db)
    conn = sqlite3.connect(work_db)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("CREATE TABLE pages (id INTEGER PRIMARY KEY, title TEXT, is_redirect INTEGER)")
    conn.execute("CREATE TABLE redirects (source_id INTEGER, target_id INTEGER)")
    conn.execute("CREATE TABLE edges (src INTEGER, dst INTEGER)")
    conn.execute("CREATE TABLE redir_raw (rd_from INTEGER, rd_title TEXT)")
    conn.execute("CREATE TABLE lt_raw (lt_id INTEGER, lt_title TEXT)")
    conn.execute("CREATE TABLE pl_raw (pl_from INTEGER, lt_id INTEGER)")

    def stream_insert(sql, rows, batch=50000):
        buf = []
        for row in rows:
            buf.append(row)
            if len(buf) >= batch:
                conn.executemany(sql, buf)
                buf.clear()
        if buf:
            conn.executemany(sql, buf)

    # pages (ns0)
    stream_insert(
        "INSERT OR IGNORE INTO pages VALUES (?,?,?)",
        ((int(t[0]), t[2], int(t[3])) for t in iter_table_rows(paths["page"], "page") if t[1] == "0"))
    conn.execute("CREATE INDEX pages_title ON pages(title)")

    # redirects (ns0): resolve rd_title -> page id via JOIN
    stream_insert(
        "INSERT INTO redir_raw VALUES (?,?)",
        ((int(t[0]), t[2]) for t in iter_table_rows(paths["redirect"], "redirect") if t[1] == "0"))
    conn.execute("INSERT INTO redirects(source_id, target_id) "
                 "SELECT rr.rd_from, p.id FROM redir_raw rr JOIN pages p ON p.title = rr.rd_title")
    conn.execute("CREATE INDEX redirects_src ON redirects(source_id)")

    # linktarget (ns0) -> lt(lt_id, dst_id), dst redirect-collapsed
    stream_insert(
        "INSERT INTO lt_raw VALUES (?,?)",
        ((int(t[0]), t[2]) for t in iter_table_rows(paths["linktarget"], "linktarget") if t[1] == "0"))
    conn.execute("CREATE TABLE lt (lt_id INTEGER PRIMARY KEY, dst_id INTEGER)")
    conn.execute("INSERT OR IGNORE INTO lt(lt_id, dst_id) "
                 "SELECT l.lt_id, COALESCE(r.target_id, p.id) "
                 "FROM lt_raw l JOIN pages p ON p.title = l.lt_title "
                 "LEFT JOIN redirects r ON r.source_id = p.id")

    # pagelinks (ns0 from) -> edges
    stream_insert(
        "INSERT INTO pl_raw VALUES (?,?)",
        ((int(t[0]), int(t[2])) for t in iter_table_rows(paths["pagelinks"], "pagelinks") if t[1] == "0"))
    conn.execute("INSERT INTO edges(src, dst) "
                 "SELECT COALESCE(r.target_id, pl.pl_from), lt.dst_id "
                 "FROM pl_raw pl JOIN lt ON lt.lt_id = pl.lt_id "
                 "LEFT JOIN redirects r ON r.source_id = pl.pl_from "
                 "WHERE COALESCE(r.target_id, pl.pl_from) <> lt.dst_id")

    conn.execute("CREATE INDEX ix_edges_dst ON edges(dst)")
    for tmp in ("redir_raw", "lt_raw", "pl_raw", "lt"):
        conn.execute(f"DROP TABLE {tmp}")
    conn.commit()
    return conn
```

- [ ] **Step 2: Extract the synthetic-dump fixtures into `_make_synthetic_dumps` and reuse it in `_selftest_build`**

Find the existing `_selftest_build` (which writes the 4 dumps inline). Insert a new `_make_synthetic_dumps` ABOVE `_selftest_build`, and REPLACE `_selftest_build`'s dump-writing with a call to it. The resulting two functions:

```python
def _make_synthetic_dumps(d):
    """Write the 4 tiny gz dump fixtures into dir d; return the paths dict.
    Graph: A(4)->B(2)->Hitler(1), C(3)->Redir(6 -> Hitler), D(5) isolated; ns1 Talk(7) filtered."""
    paths = {k: os.path.join(d, f"{k}.sql.gz") for k in ("page", "redirect", "linktarget", "pagelinks")}
    _write_gz(paths["page"], [
        "INSERT INTO `page` VALUES (1,0,'Adolf_Hitler',0),(2,0,'B',0),(3,0,'C',0),(4,0,'A',0),(5,0,'D',0),(6,0,'Redir',1),(7,1,'Talk',0);",
    ])
    _write_gz(paths["redirect"], [
        "INSERT INTO `redirect` VALUES (6,0,'Adolf_Hitler','',NULL);",
    ])
    _write_gz(paths["linktarget"], [
        "INSERT INTO `linktarget` VALUES (10,0,'B'),(11,0,'Adolf_Hitler'),(12,0,'Redir'),(13,1,'Talk');",
    ])
    _write_gz(paths["pagelinks"], [
        "INSERT INTO `pagelinks` VALUES (4,0,10),(2,0,11),(3,0,12),(7,1,11),(5,0,13);",
    ])
    return paths


def _selftest_build():
    import tempfile
    d = tempfile.mkdtemp(prefix="sixdeg-dumps-")
    paths = _make_synthetic_dumps(d)
    conn = build_graph(paths, os.path.join(d, "graph.sqlite"))
    assert resolve_target_id(conn, "Adolf_Hitler") == 1
    dist = reverse_bfs_edges(conn, 1)
    assert dist == {1: 0, 2: 1, 3: 1, 4: 2}, dist
    print("  build (iter_table_rows + build_graph) OK")
```

(The `_write_gz` helper already exists and is unchanged.)

- [ ] **Step 3: Add `_selftest_build_lowmem` immediately after `_selftest_build`**

```python
def _selftest_build_lowmem():
    import tempfile
    d = tempfile.mkdtemp(prefix="sixdeg-lowmem-")
    paths = _make_synthetic_dumps(d)
    conn = build_graph_lowmem(paths, os.path.join(d, "graph.sqlite"))
    assert resolve_target_id(conn, "Adolf_Hitler") == 1
    dist = reverse_bfs_edges(conn, 1)
    assert dist == {1: 0, 2: 1, 3: 1, 4: 2}, dist  # identical graph to the fast path
    print("  build_lowmem (build_graph_lowmem) OK")
```

- [ ] **Step 4: Wire `_selftest_build_lowmem()` into `main()`'s `--selftest` branch**

In `main()`, the selftest branch currently is:
```python
    if args.selftest:
        _selftest_scanner()
        _selftest_bfs_edges()
        _selftest_build()
        print("ALL SELFTESTS PASSED")
        return 0
```
Change it to add the lowmem call after `_selftest_build()`:
```python
    if args.selftest:
        _selftest_scanner()
        _selftest_bfs_edges()
        _selftest_build()
        _selftest_build_lowmem()
        print("ALL SELFTESTS PASSED")
        return 0
```

- [ ] **Step 5: Run the self-tests (expect PASS)**

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected output includes `  build (iter_table_rows + build_graph) OK` then `  build_lowmem (build_graph_lowmem) OK`, ending `ALL SELFTESTS PASSED`, exit 0. The key proof: `build_graph_lowmem` yields the SAME `{1:0,2:1,3:1,4:2}` distances as `build_graph` on the identical fixtures (same redirect collapse, ns0 filtering, linktarget indirection).

- [ ] **Step 6: Commit**

```bash
git add scripts/six-degrees/d_parse_dumps.py
git commit -m "feat(sixdegrees-dumps): build_graph_lowmem (on-disk sqlite joins) + parity selftest"
```

---

### Task 2: `--lowmem` flag + automatic `MemoryError` fallback

**Files:** Modify `scripts/six-degrees/d_parse_dumps.py` (`main()` only)

- [ ] **Step 1: Add the `--lowmem` argument**

In `main()`'s argparse block, add this line after the `--rebuild` argument:
```python
    ap.add_argument("--lowmem", action="store_true",
                    help="force the on-disk low-memory build (use on a RAM-starved machine)")
```

- [ ] **Step 2: Route the build through lowmem / fallback**

In `main()`, find the build branch:
```python
        print("Building graph from dumps (this is the slow part)...")
        conn = build_graph(paths, args.work_db)
```
Replace those two lines with:
```python
        if args.lowmem:
            print("Building graph (low-memory on-disk path)...")
            conn = build_graph_lowmem(paths, args.work_db)
        else:
            print("Building graph from dumps (this is the slow part)...")
            try:
                conn = build_graph(paths, args.work_db)
            except MemoryError:
                import gc
                gc.collect()  # finalize the orphaned fast-build connection so the db file can be reused
                print("MemoryError in fast build — falling back to low-memory on-disk path...")
                conn = build_graph_lowmem(paths, args.work_db)
```

- [ ] **Step 3: Run the self-tests (still green)**

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected: all four (scanner / bfs_edges / build / build_lowmem) OK, `ALL SELFTESTS PASSED`, exit 0.

- [ ] **Step 4: Verify `--lowmem` routes to the build branch (missing-dumps error)**

Run: `python scripts/six-degrees/d_parse_dumps.py --lowmem --dumps-dir ./nope --work-db ./nope/x.sqlite`
Expected: exits non-zero with `Missing dump files (run d-fetch-dumps.mjs first):` listing the 4 paths — confirming `--lowmem` reaches the build branch (it does not short-circuit). (Do NOT run a real `--lowmem` build here — that's the deferred, hours-long data run.)

- [ ] **Step 5: Full JS suite unchanged**

Run: `npx vitest run`
Expected: same as before — all pass except the one pre-existing `tests/wikipedia.test.js` infobox failure. (This task only touched Python; the JS suite is a regression guard.)

- [ ] **Step 6: Commit**

```bash
git add scripts/six-degrees/d_parse_dumps.py
git commit -m "feat(sixdegrees-dumps): --lowmem flag + automatic MemoryError fallback"
```

---

## Deferred data run (gated — run later, on this RAM-starved machine use `--lowmem`)

Dumps are already cached in `.cache/six-degrees/dumps/`. When ready:
```
python scripts/six-degrees/d_parse_dumps.py --lowmem --dump-date 2026-06-03
```
Slow (hours at <1 GB free; ~15–20 GB temp disk) but completes. Produces `docs/six-degrees/fullgraph-dumps-2026-06-03.{json,md}`; commit those + the headline result.

---

## Self-Review

**Spec coverage:**
- §2 `build_graph_lowmem` (same output tables; pages+title index; redir_raw→redirects JOIN; lt_raw→lt JOIN with redirect collapse; pl_raw→edges JOIN with self-loop filter; drop temps; PRAGMAs) → Task 1 Step 1. ✓
- §2 triggering (`--lowmem` flag + `try/except MemoryError` fallback with gc + db reuse) → Task 2 Steps 1–2. ✓
- §3 `_selftest_build_lowmem` reusing the same synthetic fixtures, asserting identical `{1:0,2:1,3:1,4:2}` → Task 1 Steps 2–4. ✓

**Placeholder scan:** No TBD/TODO; complete code in every step; the real lowmem data run is explicitly deferred, not stubbed.

**Type/name consistency:**
- `build_graph_lowmem(paths, work_db)` matches `build_graph`'s signature + output tables (pages/redirects/edges + `ix_edges_dst`), so `reverse_bfs_edges`/`resolve_target_id`/report are unchanged. ✓
- `_make_synthetic_dumps(d)` returns the `paths` dict used by both `_selftest_build` and `_selftest_build_lowmem`; both call `build_*` then assert via `reverse_bfs_edges(conn,1)`. ✓
- The self-loop `WHERE` repeats `COALESCE(r.target_id, pl.pl_from)` (no SELECT-alias-in-WHERE, per the spec fix). ✓
- Field indices in the lowmem streaming generators (page t[0,2,3]; redirect t[0,2]; linktarget t[0,2]; pagelinks t[0,2]) match `build_graph` and the real dump schema verified by the range-peek. ✓
- `--lowmem` added alongside existing `--rebuild`/`--selftest`; routing sits inside the existing build `else` branch (after the missing-dumps check), so missing-dumps still errors first. ✓

No issues found.
