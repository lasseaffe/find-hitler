# Six Degrees — Wikimedia Dumps Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the current English-Wikipedia namespace-0 link graph from Wikimedia SQL dumps and reverse-BFS from Adolf Hitler to produce the full-population distance distribution, reusing the existing `c_distances.py` aggregation/report helpers.

**Architecture:** A Python script (`d_parse_dumps.py`) streams the `page`/`redirect`/`linktarget`/`pagelinks` SQL dumps through a tested tuple-scanner, resolves the 2024 `pagelinks→linktarget` indirection + redirects + ns0 filtering, streams edges into a sqlite `edges(src,dst)` table indexed on `dst`, then reverse-BFSes from Hitler. A Node helper (`d-fetch-dumps.mjs`) downloads the 4 dumps (gated). All offline, DB-free; the 11 GB download + ~600M-edge build are gated.

**Tech Stack:** Python 3.12 (stdlib `sqlite3`, `gzip`, `argparse` — no pip deps; imports `build_distribution`/`render_markdown`/`resolve_target_id` from `c_distances.py`), Node 22 (`fetch` streaming), vitest 4.

**Design source:** [docs/superpowers/specs/2026-06-03-six-degrees-dumps-parser-design.md](../specs/2026-06-03-six-degrees-dumps-parser-design.md)

---

## File Structure

**New:**
- `scripts/six-degrees/d_parse_dumps.py` — `parse_sql_tuples`, `iter_table_rows`, `build_graph`, `reverse_bfs_edges`, `main()` + `--selftest`. Imports report helpers from `c_distances.py`.
- `scripts/six-degrees/d-fetch-dumps.mjs` — `dumpFileSpecs()` (pure, tested) + gated 4-file downloader.
- `tests/sixDegrees.fetchDumps.test.js` — vitest for `dumpFileSpecs`.

**Modified:** `package.json` (add `six:dumps`). `.cache/` and `__pycache__/` already gitignored.

**Output at runtime:** `docs/six-degrees/fullgraph-dumps-<date>.{json,md}`.

**Run Python self-tests:** `python scripts/six-degrees/d_parse_dumps.py --selftest`
**Run the JS test:** `npx vitest run tests/sixDegrees.fetchDumps.test.js`

---

### Task 1: SQL tuple scanner (`parse_sql_tuples`)

**Files:** Create `scripts/six-degrees/d_parse_dumps.py`

- [ ] **Step 1: Write the file with the scanner + a `--selftest` guard**

Create `scripts/six-degrees/d_parse_dumps.py` with EXACTLY:

```python
#!/usr/bin/env python3
"""Six Degrees — build the current enwiki ns0 link graph from Wikimedia SQL dumps,
reverse-BFS from a target, and report the full-population distance distribution.
Self-tests: python scripts/six-degrees/d_parse_dumps.py --selftest
"""
import sys
import os
import gzip
import sqlite3
import argparse
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from c_distances import build_distribution, render_markdown, resolve_target_id  # noqa: E402


def parse_sql_tuples(values):
    """Yield each (...) tuple in a MySQL-dump VALUES string as a list of field
    strings. Quoted strings are unquoted + unescaped (\\' -> ', \\\\ -> \\);
    numbers and NULL are returned as their literal text ('NULL')."""
    i, n = 0, len(values)
    while i < n:
        if values[i] != '(':
            i += 1
            continue
        i += 1  # consume '('
        fields = []
        while True:
            while i < n and values[i] in ' \t':
                i += 1
            if i < n and values[i] == "'":
                i += 1
                buf = []
                while i < n:
                    c = values[i]
                    if c == '\\' and i + 1 < n:
                        buf.append(values[i + 1])
                        i += 2
                        continue
                    if c == "'":
                        i += 1
                        break
                    buf.append(c)
                    i += 1
                fields.append(''.join(buf))
            else:
                start = i
                while i < n and values[i] not in ',)':
                    i += 1
                fields.append(values[start:i].strip())
            if i < n and values[i] == ',':
                i += 1
                continue
            if i < n and values[i] == ')':
                i += 1
                break
            break
        yield fields


def _selftest_scanner():
    values = r"(1,0,'Simple',0),(2,0,'Has, comma',0),(3,0,'O\'Brien',0),(4,0,'Back\\slash',1),(5,0,'',0)"
    rows = list(parse_sql_tuples(values))
    assert rows[0] == ['1', '0', 'Simple', '0'], rows[0]
    assert rows[1] == ['2', '0', 'Has, comma', '0'], rows[1]
    assert rows[2] == ['3', '0', "O'Brien", '0'], rows[2]
    assert rows[3] == ['4', '0', 'Back\\slash', '1'], rows[3]  # one literal backslash
    assert rows[4] == ['5', '0', '', '0'], rows[4]
    assert len(rows) == 5, len(rows)
    print("  scanner (parse_sql_tuples) OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest_scanner()
        print("ALL SELFTESTS PASSED")
        sys.exit(0)
    raise SystemExit("Not yet runnable; use --selftest (full main added in a later task).")
```

- [ ] **Step 2: Run the self-test (expect PASS)**

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected: `  scanner (parse_sql_tuples) OK` then `ALL SELFTESTS PASSED`, exit 0. (Note: importing `c_distances` must succeed — it lives in the same directory and has no import-time side effects.)

- [ ] **Step 3: Commit**

```bash
git add scripts/six-degrees/d_parse_dumps.py
git commit -m "feat(sixdegrees-dumps): MySQL-dump tuple scanner (escape-heavy selftest)"
```

---

### Task 2: `reverse_bfs_edges` over an edges table

**Files:** Modify `scripts/six-degrees/d_parse_dumps.py`

- [ ] **Step 1: Add `reverse_bfs_edges` + a synthetic-edges self-test**

In `scripts/six-degrees/d_parse_dumps.py`, insert these ABOVE `def _selftest_scanner():`:

```python
def reverse_bfs_edges(conn, target_id, chunk=10000):
    """Reverse-BFS from target over an edges(src,dst) table (edge src->dst means
    'src links to dst'). Expanding in-neighbors (src where dst in frontier) outward
    from the target yields each page's minimum forward distance TO the target."""
    dist = {target_id: 0}
    frontier = [target_id]
    d = 0
    while frontier:
        d += 1
        nxt = []
        for i in range(0, len(frontier), chunk):
            batch = frontier[i:i + chunk]
            qmarks = ",".join(["?"] * len(batch))
            cur = conn.execute(
                f"SELECT src FROM edges WHERE dst IN ({qmarks})", batch)
            for (src,) in cur:
                if src not in dist:
                    dist[src] = d
                    nxt.append(src)
        frontier = nxt
    return dist


def _selftest_bfs_edges():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE edges (src INTEGER, dst INTEGER)")
    # forward edges: A(4)->B(2), B(2)->T(1), C(3)->T(1); D(5) isolated
    conn.executemany("INSERT INTO edges VALUES (?,?)", [(4, 2), (2, 1), (3, 1)])
    conn.execute("CREATE INDEX ix ON edges(dst)")
    dist = reverse_bfs_edges(conn, 1)
    assert dist == {1: 0, 2: 1, 3: 1, 4: 2}, dist  # D(5) unreachable, absent
    print("  bfs_edges (reverse_bfs_edges) OK")
```

Then update the `--selftest` branch in the `__main__` guard to call it after the scanner test:

```python
    if "--selftest" in sys.argv:
        _selftest_scanner()
        _selftest_bfs_edges()
        print("ALL SELFTESTS PASSED")
        sys.exit(0)
```

- [ ] **Step 2: Run the self-test (expect PASS)**

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected: `  scanner ... OK`, `  bfs_edges ... OK`, `ALL SELFTESTS PASSED`, exit 0. The `dist == {1:0,2:1,3:1,4:2}` assertion pins the reverse direction (distance-to-target) and that the isolated node is absent.

- [ ] **Step 3: Commit**

```bash
git add scripts/six-degrees/d_parse_dumps.py
git commit -m "feat(sixdegrees-dumps): reverse_bfs_edges over edges(src,dst) (direction selftest)"
```

---

### Task 3: `iter_table_rows` + `build_graph` (synthetic end-to-end)

**Files:** Modify `scripts/six-degrees/d_parse_dumps.py`

- [ ] **Step 1: Add `iter_table_rows`, `build_graph`, and a synthetic-dumps self-test**

In `scripts/six-degrees/d_parse_dumps.py`, insert these ABOVE `def _selftest_scanner():`:

```python
def iter_table_rows(path, table):
    """Stream a (possibly gzipped) MySQL dump file, yield each VALUES tuple (as a
    list of field strings) from `INSERT INTO `table` VALUES (...);` statements."""
    opener = gzip.open if path.endswith(".gz") else open
    prefix = f"INSERT INTO `{table}` VALUES "
    with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if not line.startswith(prefix):
                continue
            yield from parse_sql_tuples(line[len(prefix):])


def build_graph(paths, work_db):
    """Build pages + redirects + edges into a sqlite db from the four dump paths.
    paths: dict with keys 'page','redirect','linktarget','pagelinks'.
    Returns the open sqlite connection."""
    if os.path.exists(work_db):
        os.remove(work_db)
    conn = sqlite3.connect(work_db)
    conn.execute("CREATE TABLE pages (id INTEGER PRIMARY KEY, title TEXT, is_redirect INTEGER)")
    conn.execute("CREATE TABLE redirects (source_id INTEGER, target_id INTEGER)")
    conn.execute("CREATE TABLE edges (src INTEGER, dst INTEGER)")

    # Stage 1: pages (ns0) + title->id
    title_to_id = {}
    pbatch = []
    for t in iter_table_rows(paths["page"], "page"):
        if t[1] != "0":
            continue
        pid = int(t[0])
        title = t[2]
        pbatch.append((pid, title, int(t[3])))
        title_to_id[title] = pid
        if len(pbatch) >= 10000:
            conn.executemany("INSERT OR IGNORE INTO pages VALUES (?,?,?)", pbatch)
            pbatch.clear()
    if pbatch:
        conn.executemany("INSERT OR IGNORE INTO pages VALUES (?,?,?)", pbatch)

    # Stage 2: redirects (ns0) -> {redirect_page_id: canonical_target_id}
    redirect_to = {}
    for t in iter_table_rows(paths["redirect"], "redirect"):
        if t[1] != "0":
            continue
        tgt = title_to_id.get(t[2])
        if tgt is not None:
            redirect_to[int(t[0])] = tgt
    if redirect_to:
        conn.executemany("INSERT INTO redirects VALUES (?,?)", list(redirect_to.items()))

    # Stage 3: linktarget (ns0) -> {lt_id: canonical dst_id}
    lt_to_dst = {}
    for t in iter_table_rows(paths["linktarget"], "linktarget"):
        if t[1] != "0":
            continue
        pid = title_to_id.get(t[2])
        if pid is None:
            continue
        lt_to_dst[int(t[0])] = redirect_to.get(pid, pid)

    title_to_id.clear()  # free the big string dict before the heavy pass

    # Stage 4: pagelinks (ns0 from) -> edges
    ebatch = []
    for t in iter_table_rows(paths["pagelinks"], "pagelinks"):
        if t[1] != "0":
            continue
        dst = lt_to_dst.get(int(t[2]))
        if dst is None:
            continue
        src = redirect_to.get(int(t[0]), int(t[0]))
        if src == dst:
            continue
        ebatch.append((src, dst))
        if len(ebatch) >= 50000:
            conn.executemany("INSERT INTO edges VALUES (?,?)", ebatch)
            ebatch.clear()
    if ebatch:
        conn.executemany("INSERT INTO edges VALUES (?,?)", ebatch)

    conn.execute("CREATE INDEX ix_edges_dst ON edges(dst)")
    conn.commit()
    return conn


def _write_gz(path, lines):
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


def _selftest_build():
    import tempfile
    d = tempfile.mkdtemp(prefix="sixdeg-dumps-")
    paths = {k: os.path.join(d, f"{k}.sql.gz") for k in ("page", "redirect", "linktarget", "pagelinks")}
    # ns0: Hitler(1), B(2), C(3), A(4), D(5), Redir(6,is_redirect); plus ns1 Talk(7) to be filtered
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
        # A->B(10), B->Hitler(11), C->Redir(12 collapses to Hitler), ns1-from filtered, D->Talk(ns1) dropped
        "INSERT INTO `pagelinks` VALUES (4,0,10),(2,0,11),(3,0,12),(7,1,11),(5,0,13);",
    ])
    conn = build_graph(paths, os.path.join(d, "graph.sqlite"))
    assert resolve_target_id(conn, "Adolf_Hitler") == 1
    dist = reverse_bfs_edges(conn, 1)
    assert dist == {1: 0, 2: 1, 3: 1, 4: 2}, dist  # C reaches via redirect collapse; D unreachable; ns1 filtered
    print("  build (iter_table_rows + build_graph) OK")
```

Then update the `--selftest` branch to call it:

```python
    if "--selftest" in sys.argv:
        _selftest_scanner()
        _selftest_bfs_edges()
        _selftest_build()
        print("ALL SELFTESTS PASSED")
        sys.exit(0)
```

- [ ] **Step 2: Run the self-test (expect PASS)**

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected: scanner OK, bfs_edges OK, `  build (iter_table_rows + build_graph) OK`, `ALL SELFTESTS PASSED`, exit 0. This proves the full pipeline on synthetic gz dumps: redirect collapse (C→Redir→Hitler ⇒ dist 1), ns1 filtering (page 7 and linktarget 13 excluded), and the linktarget indirection.

- [ ] **Step 3: Commit**

```bash
git add scripts/six-degrees/d_parse_dumps.py
git commit -m "feat(sixdegrees-dumps): iter_table_rows + build_graph (synthetic end-to-end selftest)"
```

---

### Task 4: `main()` wiring (build/reuse graph, BFS, report)

**Files:** Modify `scripts/six-degrees/d_parse_dumps.py`

- [ ] **Step 1: Replace the `__main__` guard with a full `main()`**

In `scripts/six-degrees/d_parse_dumps.py`, DELETE the existing `if __name__ == "__main__":` block and REPLACE it with:

```python
def main(argv=None):
    ap = argparse.ArgumentParser(description="Six Degrees full-graph distance from Wikimedia dumps")
    ap.add_argument("--dumps-dir", default=".cache/six-degrees/dumps")
    ap.add_argument("--work-db", default=".cache/six-degrees/dumps/graph.sqlite")
    ap.add_argument("--target", default="Adolf Hitler")
    ap.add_argument("--out-dir", default="docs/six-degrees")
    ap.add_argument("--dump-date", default=date.today().isoformat())
    ap.add_argument("--top", type=int, default=100)
    ap.add_argument("--rebuild", action="store_true", help="rebuild graph.sqlite even if present")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args(argv)

    if args.selftest:
        _selftest_scanner()
        _selftest_bfs_edges()
        _selftest_build()
        print("ALL SELFTESTS PASSED")
        return 0

    paths = {
        "page": os.path.join(args.dumps_dir, "enwiki-latest-page.sql.gz"),
        "redirect": os.path.join(args.dumps_dir, "enwiki-latest-redirect.sql.gz"),
        "linktarget": os.path.join(args.dumps_dir, "enwiki-latest-linktarget.sql.gz"),
        "pagelinks": os.path.join(args.dumps_dir, "enwiki-latest-pagelinks.sql.gz"),
    }

    if os.path.exists(args.work_db) and not args.rebuild:
        print(f"Reusing existing graph: {args.work_db}")
        conn = sqlite3.connect(args.work_db)
    else:
        missing = [p for p in paths.values() if not os.path.exists(p)]
        if missing:
            raise SystemExit("Missing dump files (run d-fetch-dumps.mjs first):\n  " + "\n  ".join(missing))
        print("Building graph from dumps (this is the slow part)...")
        conn = build_graph(paths, args.work_db)

    title = args.target.replace(" ", "_")
    target_id = resolve_target_id(conn, title)
    total = conn.execute("SELECT COUNT(*) FROM pages WHERE is_redirect = 0").fetchone()[0]
    edge_count = conn.execute("SELECT COUNT(*) FROM edges").fetchone()[0]
    print(f"Target '{args.target}' -> id {target_id}; {total:,} articles, {edge_count:,} edges. Reverse BFS...")

    dist = reverse_bfs_edges(conn, target_id)
    print(f"Labeled {len(dist):,} reachable nodes. Aggregating...")

    report = build_distribution(dist, total_articles=total, within=6, top=args.top, titles=None)
    far_ids = [f["id"] for f in report["farthest"]]
    if far_ids:
        qmarks = ",".join(["?"] * len(far_ids))
        idmap = {r[0]: r[1] for r in conn.execute(
            f"SELECT id, title FROM pages WHERE id IN ({qmarks})", far_ids)}
        report["farthest"] = [
            {"title": idmap.get(f["id"], str(f["id"])).replace("_", " "), "dist": f["dist"]}
            for f in report["farthest"]
        ]

    meta = {"target": args.target, "dumpDate": args.dump_date, "targetId": target_id}
    os.makedirs(args.out_dir, exist_ok=True)
    base = os.path.join(args.out_dir, f"fullgraph-dumps-{args.dump_date}")
    import json
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump({**meta, **report}, f, indent=2)
    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write(render_markdown(report, meta))
    print(f"Report: {base}.md  ({report['pctWithinSix']}% of {report['reachable']:,} within 6; max {report['max']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the self-test (expect PASS)**

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected: all three selftests print OK, `ALL SELFTESTS PASSED`, exit 0.

- [ ] **Step 3: Verify the missing-dumps error path**

Run: `python scripts/six-degrees/d_parse_dumps.py --dumps-dir /nonexistent --work-db /nonexistent/x.sqlite`
Expected: exits non-zero with `Missing dump files (run d-fetch-dumps.mjs first):` listing the 4 paths. (The real build is gated — do NOT run it; no dumps are downloaded yet.)

- [ ] **Step 4: Commit**

```bash
git add scripts/six-degrees/d_parse_dumps.py
git commit -m "feat(sixdegrees-dumps): main() — build/reuse graph, reverse BFS, write report"
```

---

### Task 5: Node fetch helper + npm script + full suite

**Files:** Create `scripts/six-degrees/d-fetch-dumps.mjs`, `tests/sixDegrees.fetchDumps.test.js`; Modify `package.json`

- [ ] **Step 1: Write the failing test for `dumpFileSpecs`**

Create `tests/sixDegrees.fetchDumps.test.js` with EXACTLY:

```js
// tests/sixDegrees.fetchDumps.test.js
import { describe, it, expect } from 'vitest'
import { dumpFileSpecs } from '../scripts/six-degrees/d-fetch-dumps.mjs'

describe('dumpFileSpecs', () => {
  it('lists the four enwiki dump files with URLs and local names', () => {
    const specs = dumpFileSpecs()
    expect(specs.map(s => s.table).sort()).toEqual(['linktarget', 'page', 'pagelinks', 'redirect'])
    for (const s of specs) {
      expect(s.url).toBe(`https://dumps.wikimedia.org/enwiki/latest/${s.file}`)
      expect(s.file).toMatch(/^enwiki-latest-.*\.sql\.gz$/)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/sixDegrees.fetchDumps.test.js`
Expected: FAIL — cannot resolve import / `dumpFileSpecs is not a function`.

- [ ] **Step 3: Write `d-fetch-dumps.mjs`**

Create `scripts/six-degrees/d-fetch-dumps.mjs` with EXACTLY:

```js
// scripts/six-degrees/d-fetch-dumps.mjs
// Download the 4 enwiki SQL dumps needed to build the link graph (~11 GB total).
// Gated: the download only runs on direct invocation. Skip-if-present.
//   node scripts/six-degrees/d-fetch-dumps.mjs --list   (print the files, no download)
//   node scripts/six-degrees/d-fetch-dumps.mjs          (download all four)
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const BASE = 'https://dumps.wikimedia.org/enwiki/latest'
const CACHE_DIR = '.cache/six-degrees/dumps'

// Pure: the four dump files we need (table -> file + url).
export function dumpFileSpecs() {
  return ['page', 'redirect', 'linktarget', 'pagelinks'].map((table) => {
    const file = `enwiki-latest-${table}.sql.gz`
    return { table, file, url: `${BASE}/${file}` }
  })
}

async function main() {
  const listOnly = process.argv.includes('--list')
  const specs = dumpFileSpecs()
  if (listOnly) {
    for (const s of specs) console.log(`${s.table}\t${s.url}`)
    return
  }
  mkdirSync(CACHE_DIR, { recursive: true })
  for (const s of specs) {
    const dest = `${CACHE_DIR}/${s.file}`
    if (existsSync(dest)) {
      console.log(`Already present: ${dest} (${(statSync(dest).size / 1e9).toFixed(2)} GB)`)
      continue
    }
    console.log(`Downloading ${s.url} -> ${dest} ...`)
    const res = await fetch(s.url)
    if (!res.ok) throw new Error(`Download failed (${s.table}): ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
    console.log(`  done (${(statSync(dest).size / 1e9).toFixed(2)} GB)`)
  }
  console.log('All dumps present. Next:')
  console.log('  python scripts/six-degrees/d_parse_dumps.py')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/sixDegrees.fetchDumps.test.js`
Expected: PASS (1 passed).

- [ ] **Step 5: Syntax-check the script (do NOT run the download)**

Run: `node --check scripts/six-degrees/d-fetch-dumps.mjs`
Expected: exit 0, no output. (Do NOT run the script or `--list` here beyond syntax — the default mode starts an 11 GB download; `--list` is harmless but unnecessary in this task.)

- [ ] **Step 6: Add the npm script + run the full suites**

In `package.json` `"scripts"`, add after `"six:fullgraph"`:

```json
    "six:dumps": "python scripts/six-degrees/d_parse_dumps.py"
```

Run: `python scripts/six-degrees/d_parse_dumps.py --selftest`
Expected: `ALL SELFTESTS PASSED`.

Run: `npx vitest run`
Expected: prior baseline + the new `tests/sixDegrees.fetchDumps.test.js` (1 passed); the only failure remains the pre-existing `tests/wikipedia.test.js` infobox test. No NEW failures.

- [ ] **Step 7: Commit**

```bash
git add scripts/six-degrees/d-fetch-dumps.mjs tests/sixDegrees.fetchDumps.test.js package.json
git commit -m "feat(sixdegrees-dumps): gated 4-dump fetch helper + six:dumps npm script"
```

---

## Deferred manual run (gated — NOT part of automated execution)

1. `node scripts/six-degrees/d-fetch-dumps.mjs --list` — confirm the 4 URLs resolve.
2. `node scripts/six-degrees/d-fetch-dumps.mjs` — download ~11 GB (long; resumable via skip-if-present).
3. **Sanity-check the real schema** before the full build: confirm `pagelinks` rows are `(pl_from, pl_from_namespace, pl_target_id)` and `linktarget` is `(lt_id, lt_namespace, lt_title)` by inspecting the first `INSERT` line of each (`zcat ... | grep -m1 'INSERT INTO'`). If columns differ, adjust the field indices in `build_graph` before the 600M-row pass.
4. `python scripts/six-degrees/d_parse_dumps.py` — build graph + BFS + report (~30–90+ min). Produces `docs/six-degrees/fullgraph-dumps-<date>.{json,md}`; commit those.

---

## Self-Review

**Spec coverage:**
- §2 data source / 4 dumps + 2024 linktarget indirection → Task 3 (`build_graph` routes edges through `lt_to_dst`), Task 5 (fetch). ✓
- §3 pipeline stages (page→pages+title_to_id; redirect→redirect_to; linktarget→lt_to_dst then drop title_to_id; pagelinks→edges; index; BFS; report) → Task 3 `build_graph` + Task 4 `main`. ✓
- §3 memory plan (`title_to_id.clear()` before pagelinks pass) → Task 3. ✓
- §4 components (`parse_sql_tuples`, `iter_table_rows`, `build_graph`, `reverse_bfs_edges`, `main`, `d-fetch-dumps.mjs`; reuse of `build_distribution`/`render_markdown`/`resolve_target_id`) → Tasks 1–5. ✓
- §4 redirects persisted so `resolve_target_id` reuse works → Task 3 (`redirects` table written). ✓
- §5 testing (scanner escapes, synthetic end-to-end with redirect collapse + ns0 filter + linktarget indirection, direction test) → Tasks 1, 2, 3. ✓
- §1 caveat (full rendered graph, lower bound) → rendered by reused `render_markdown`. ✓

**Placeholder scan:** No TBD/TODO; every code step complete; the download + real build are explicitly gated, not stubbed.

**Type/name consistency:**
- `parse_sql_tuples(values)` (Task 1) used by `iter_table_rows` (Task 3). ✓
- `iter_table_rows(path, table)` (Task 3) called with `(paths[k], "<table>")` in `build_graph`. ✓
- `build_graph(paths, work_db)` returns a conn with tables `pages`/`redirects`/`edges`; `reverse_bfs_edges(conn, target_id)` queries `edges`; `resolve_target_id(conn, title)` (imported) queries `pages`/`redirects` — all consistent. ✓
- `build_distribution(..., titles=None)` → farthest id-dicts → `main` fills titles via `f["id"]` (same pattern as `c_distances.main`). ✓
- `dumpFileSpecs()` returns `{table,file,url}`; test + `main` agree. ✓
- Field indices: page `t[0]=id,t[1]=ns,t[2]=title,t[3]=is_redirect`; redirect `t[0]=from,t[1]=ns,t[2]=title`; linktarget `t[0]=lt_id,t[1]=ns,t[2]=title`; pagelinks `t[0]=from,t[1]=from_ns,t[2]=target_id` — consistent across `build_graph` and the synthetic fixtures.

No issues found.
