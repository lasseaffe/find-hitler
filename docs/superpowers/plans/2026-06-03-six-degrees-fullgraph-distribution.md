# Six Degrees — Full-Graph Offline Distribution (Approach C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build offline tooling that downloads the SDOW SQLite (full Wikipedia link graph) and reverse-BFSes from Adolf Hitler to label every namespace-0 article with its minimum link-distance, producing the true full-population distribution report.

**Architecture:** A Python script (`c_distances.py`) does the heavy work — resolve the target page id (following redirects), reverse-BFS over `links.incoming_links` (chunked `IN` queries), aggregate a histogram + farthest list, and write `.json`/`.md` reports. A Node helper (`c-fetch-sdow.mjs`) discovers the latest SDOW dump and downloads/gunzips it. All offline, DB-free (no Postgres), no Wikipedia crawling. The 4.3 GB download is gated on explicit user go-ahead.

**Tech Stack:** Python 3.12 (stdlib `sqlite3`, `statistics`, `json`, `argparse` — no pip deps), Node 22 (`fetch` + `node:zlib` streaming gunzip), vitest 4 for the Node parse unit.

**Design source:** [docs/superpowers/specs/2026-06-03-six-degrees-fullgraph-distribution-design.md](../specs/2026-06-03-six-degrees-fullgraph-distribution-design.md)

---

## File Structure

**New:**
- `scripts/six-degrees/c_distances.py` — Python. `build_distribution`, `render_markdown` (pure); `resolve_target_id`, `reverse_bfs` (SQLite); `main()` with argparse + `--selftest`. Underscored filename so it's importable/runnable cleanly; self-tests live in `--selftest` (no pytest dependency).
- `scripts/six-degrees/c-fetch-sdow.mjs` — Node. `parseLatestDumpDate(listingJson)` (pure, exported + tested) + a gated `main()` that lists the public GCS bucket, downloads `sdow.sqlite.gz` to `.cache/six-degrees/`, and gunzips it.
- `tests/sixDegrees.fetchSdow.test.js` — vitest test for `parseLatestDumpDate`.

**Modified:** none (`.cache/` already gitignored from Phase 1; reports land in `docs/six-degrees/`).

**Reports produced at runtime (committed when generated):** `docs/six-degrees/fullgraph-<dumpdate>.{json,md}`.

**Run Python self-tests:** `python scripts/six-degrees/c_distances.py --selftest` (exit 0 = pass).
**Run the Node test:** `npx vitest run tests/sixDegrees.fetchSdow.test.js`

---

### Task 1: Python — pure aggregation (`build_distribution` + `render_markdown`)

**Files:**
- Create: `scripts/six-degrees/c_distances.py`

- [ ] **Step 1: Write the file with the pure functions + a self-test guard**

Create `scripts/six-degrees/c_distances.py` with EXACTLY:

```python
#!/usr/bin/env python3
"""Six Degrees full-graph offline distribution (approach C).

Reverse-BFS over the SDOW SQLite from a target page to label every namespace-0
article with its minimum link-distance, then aggregate the full-population
distribution. Self-tests: python scripts/six-degrees/c_distances.py --selftest
"""
import sys
import json
import os
import argparse
import statistics
from datetime import date


def build_distribution(dist_map, total_articles, within=6, top=100, titles=None):
    """dist_map: {page_id: distance}, distance 0 == the target itself.
    Returns the aggregated distribution. If titles is given, 'farthest' entries
    carry de-sanitized titles; otherwise they carry raw ids (filled in later)."""
    pairs = [(pid, d) for pid, d in dist_map.items() if d >= 1]
    dists = [d for _, d in pairs]
    reachable = len(dists)
    unreachable = total_articles - reachable - 1  # minus the target page itself

    histogram = {}
    for d in dists:
        histogram[d] = histogram.get(d, 0) + 1

    within_count = sum(1 for d in dists if d <= within)
    pct_within = round(within_count / reachable * 1000) / 10 if reachable else 0.0
    mean = round(sum(dists) / reachable, 2) if reachable else 0
    median = statistics.median(sorted(dists)) if reachable else 0
    mx = max(dists) if dists else 0

    far = sorted(pairs, key=lambda x: -x[1])[:top]
    if titles is not None:
        farthest = [{"title": titles.get(pid, str(pid)).replace("_", " "), "dist": d}
                    for pid, d in far]
    else:
        farthest = [{"id": pid, "dist": d} for pid, d in far]

    return {
        "totalArticles": total_articles,
        "reachable": reachable,
        "unreachable": unreachable,
        "histogram": histogram,
        "pctWithinSix": pct_within,
        "mean": mean,
        "median": median,
        "max": mx,
        "farthest": farthest,
    }


def render_markdown(report, meta):
    hist = "\n".join(f"| {d} | {report['histogram'][d]} |"
                     for d in sorted(report["histogram"]))
    far = "\n".join(f"- {f['title']} — {f['dist']}" for f in report["farthest"][:50])
    return f"""# Six Degrees — Full-Graph Distance to {meta['target']} ({meta['dumpDate']})

**{report['pctWithinSix']}%** of {report['reachable']:,} reachable articles reach **{meta['target']}** in **≤ 6 link-clicks**.

Reachable: {report['reachable']:,} · Unreachable: {report['unreachable']:,} · Median: {report['median']} · Mean: {report['mean']} · Max: {report['max']}

## Distribution (clicks → pages)
| clicks | pages |
|---|---|
{hist}

## Farthest pages (hard-mode seeds)
{far}

## Method & caveat
Full **rendered** link graph (SDOW dump {meta['dumpDate']}, namespace-0, navbox/template links included) — the classic six-degrees metric. This is a **lower bound on in-game body-clicks** (the game strips navboxes). Reverse-BFS from {meta['target']} over incoming links; every reachable article labeled in one sweep.
"""


def _selftest_pure():
    dist_map = {100: 0, 1: 2, 2: 3, 3: 6, 4: 7}
    titles = {100: "Adolf_Hitler", 1: "Coffee", 2: "Penguin", 3: "Jazz", 4: "Obscure_Stub"}
    rep = build_distribution(dist_map, total_articles=6, within=6, top=10, titles=titles)
    assert rep["reachable"] == 4, rep
    assert rep["unreachable"] == 1, rep
    assert rep["histogram"] == {2: 1, 3: 1, 6: 1, 7: 1}, rep
    assert rep["pctWithinSix"] == 75.0, rep
    assert rep["max"] == 7, rep
    assert rep["median"] == 4.5, rep
    assert rep["mean"] == 4.5, rep
    assert rep["farthest"][0] == {"title": "Obscure Stub", "dist": 7}, rep
    md = render_markdown(rep, {"target": "Adolf Hitler", "dumpDate": "20231220"})
    assert "75.0%" in md, md
    assert "## Distribution" in md, md
    print("  pure (build_distribution + render_markdown) OK")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest_pure()
        print("ALL SELFTESTS PASSED")
        sys.exit(0)
    raise SystemExit("Not yet runnable; use --selftest (full main added in a later task).")
```

- [ ] **Step 2: Run the self-test (expect PASS)**

Run: `python scripts/six-degrees/c_distances.py --selftest`
Expected: prints `  pure (build_distribution + render_markdown) OK` then `ALL SELFTESTS PASSED`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add scripts/six-degrees/c_distances.py
git commit -m "feat(sixdegrees-C): pure distribution aggregation + markdown renderer (selftest)"
```

---

### Task 2: Python — `resolve_target_id` + `reverse_bfs` over SQLite

**Files:**
- Modify: `scripts/six-degrees/c_distances.py`

- [ ] **Step 1: Add the two functions + a synthetic-SQLite self-test, and wire it into `--selftest`**

In `scripts/six-degrees/c_distances.py`, add `import sqlite3` to the imports, and insert these functions ABOVE the `_selftest_pure` definition:

```python
def resolve_target_id(conn, title):
    """Look up a page id by sanitized title; follow a redirect if needed."""
    row = conn.execute(
        "SELECT id, is_redirect FROM pages WHERE title = ?", (title,)).fetchone()
    if row is None:
        raise SystemExit(f"Target page not found: {title}")
    pid, is_redirect = row
    if is_redirect:
        r = conn.execute(
            "SELECT target_id FROM redirects WHERE source_id = ?", (pid,)).fetchone()
        if r is None:
            raise SystemExit(f"Redirect target not found for: {title}")
        pid = r[0]
    return pid


def reverse_bfs(conn, target_id, chunk=10000):
    """Reverse-BFS from target over links.incoming_links. A node's incoming_links
    are the pages that link TO it, so expanding them outward from the target yields
    each page's minimum forward distance TO the target. Returns {page_id: distance}."""
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
                f"SELECT incoming_links FROM links WHERE id IN ({qmarks})", batch)
            for (incoming,) in cur:
                if not incoming:
                    continue
                for sid in incoming.split("|"):
                    if not sid:
                        continue
                    nid = int(sid)
                    if nid not in dist:
                        dist[nid] = d
                        nxt.append(nid)
        frontier = nxt
    return dist


def _build_synthetic_db():
    """In-memory SDOW-shaped DB. Forward graph: A->B->Hitler, C->Hitler, D isolated.
    incoming_links[N] = ids of pages that link TO N."""
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE pages (id INTEGER, title TEXT, is_redirect INTEGER)")
    conn.execute("CREATE TABLE redirects (source_id INTEGER, target_id INTEGER)")
    conn.execute("CREATE TABLE links (id INTEGER PRIMARY KEY, incoming_links TEXT)")
    conn.executemany("INSERT INTO pages VALUES (?,?,?)", [
        (1, "Adolf_Hitler", 0), (2, "B", 0), (3, "C", 0),
        (4, "A", 0), (5, "D", 0), (6, "HitlerRedir", 1),
    ])
    conn.execute("INSERT INTO redirects VALUES (6, 1)")
    conn.executemany("INSERT INTO links VALUES (?,?)", [
        (1, "2|3"),  # B and C link to Hitler
        (2, "4"),    # A links to B
        (3, ""),     # nothing links to C
        (4, ""),     # nothing links to A
        (5, ""),     # nothing links to D
    ])
    conn.commit()
    return conn


def _selftest_sqlite():
    conn = _build_synthetic_db()
    assert resolve_target_id(conn, "Adolf_Hitler") == 1
    assert resolve_target_id(conn, "HitlerRedir") == 1  # follows redirect
    dist = reverse_bfs(conn, 1)
    assert dist == {1: 0, 2: 1, 3: 1, 4: 2}, dist  # D(5) unreachable, absent
    print("  sqlite (resolve_target_id + reverse_bfs) OK")
```

Then update the `__main__` guard's selftest branch to call both:

```python
if "--selftest" in sys.argv:
    _selftest_pure()
    _selftest_sqlite()
    print("ALL SELFTESTS PASSED")
    sys.exit(0)
```

- [ ] **Step 2: Run the self-test (expect PASS)**

Run: `python scripts/six-degrees/c_distances.py --selftest`
Expected: prints both `  pure ... OK` and `  sqlite ... OK`, then `ALL SELFTESTS PASSED`, exit 0. The critical assertion is `dist == {1:0, 2:1, 3:1, 4:2}` — this pins the reverse-BFS direction (distance-to-target), and that D is unreachable.

- [ ] **Step 3: Commit**

```bash
git add scripts/six-degrees/c_distances.py
git commit -m "feat(sixdegrees-C): reverse-BFS + target resolution over SDOW sqlite (direction selftest)"
```

---

### Task 3: Python — `main()` wiring (argparse, real-DB run path)

**Files:**
- Modify: `scripts/six-degrees/c_distances.py`

- [ ] **Step 1: Replace the `__main__` guard with a full `main()`**

In `scripts/six-degrees/c_distances.py`, REMOVE the existing `if __name__ == "__main__":` block (the one that calls the selftests and raises SystemExit) and replace it with this `main()` function plus a new guard at the end of the file:

```python
def main(argv=None):
    ap = argparse.ArgumentParser(description="Six Degrees full-graph distance report")
    ap.add_argument("--db", help="path to the uncompressed sdow.sqlite")
    ap.add_argument("--target", default="Adolf Hitler")
    ap.add_argument("--out-dir", default="docs/six-degrees")
    ap.add_argument("--dump-date", default=date.today().isoformat())
    ap.add_argument("--top", type=int, default=100)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args(argv)

    if args.selftest:
        _selftest_pure()
        _selftest_sqlite()
        print("ALL SELFTESTS PASSED")
        return 0

    if not args.db:
        raise SystemExit("--db <path to sdow.sqlite> is required (or use --selftest)")

    title = args.target.replace(" ", "_")
    conn = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    target_id = resolve_target_id(conn, title)
    total = conn.execute(
        "SELECT COUNT(*) FROM pages WHERE is_redirect = 0").fetchone()[0]

    print(f"Target '{args.target}' -> id {target_id}; {total:,} articles. Running reverse BFS...")
    dist = reverse_bfs(conn, target_id)
    print(f"Labeled {len(dist):,} reachable nodes. Aggregating...")

    report = build_distribution(dist, total_articles=total, within=6, top=args.top, titles=None)

    # Fill titles for the small farthest list only (avoid loading all titles).
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
    base = os.path.join(args.out_dir, f"fullgraph-{args.dump_date}")
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump({**meta, **report}, f, indent=2)
    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write(render_markdown(report, meta))
    print(f"Report: {base}.md  ({report['pctWithinSix']}% of {report['reachable']:,} "
          f"reachable within 6; max {report['max']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Run the self-test via the new argparse path (expect PASS)**

Run: `python scripts/six-degrees/c_distances.py --selftest`
Expected: both selftests print OK, `ALL SELFTESTS PASSED`, exit 0.

- [ ] **Step 3: Syntax-check the no-args error path**

Run: `python scripts/six-degrees/c_distances.py`
Expected: exits non-zero with `--db <path to sdow.sqlite> is required (or use --selftest)`. (We cannot do a real `--db` run until the SDOW download — that is a separate, gated manual step.)

- [ ] **Step 4: Commit**

```bash
git add scripts/six-degrees/c_distances.py
git commit -m "feat(sixdegrees-C): main() — resolve, BFS, aggregate, write json+md reports"
```

---

### Task 4: Node — SDOW fetch helper (`c-fetch-sdow.mjs`)

**Files:**
- Create: `scripts/six-degrees/c-fetch-sdow.mjs`
- Create: `tests/sixDegrees.fetchSdow.test.js`

- [ ] **Step 1: Write the failing test for the pure date parser**

Create `tests/sixDegrees.fetchSdow.test.js` with EXACTLY:

```js
// tests/sixDegrees.fetchSdow.test.js
import { describe, it, expect } from 'vitest'
import { parseLatestDumpDate } from '../scripts/six-degrees/c-fetch-sdow.mjs'

describe('parseLatestDumpDate', () => {
  it('returns the max YYYYMMDD across bucket prefixes', () => {
    const listing = { prefixes: ['dumps/20231220/', 'dumps/20240615/', 'dumps/20231201/'] }
    expect(parseLatestDumpDate(listing)).toBe('20240615')
  })

  it('ignores prefixes that are not dump dates', () => {
    const listing = { prefixes: ['dumps/latest/', 'dumps/20230101/'] }
    expect(parseLatestDumpDate(listing)).toBe('20230101')
  })

  it('returns null when there are no dated prefixes', () => {
    expect(parseLatestDumpDate({ prefixes: [] })).toBeNull()
    expect(parseLatestDumpDate({})).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/sixDegrees.fetchSdow.test.js`
Expected: FAIL — cannot resolve import / `parseLatestDumpDate is not a function`.

- [ ] **Step 3: Write `c-fetch-sdow.mjs`**

Create `scripts/six-degrees/c-fetch-sdow.mjs` with EXACTLY:

```js
// scripts/six-degrees/c-fetch-sdow.mjs
// Discover + download the latest SDOW SQLite dump from the public GCS bucket,
// then gunzip it. The download (~4.3 GB) only runs when this script is invoked
// directly — it is GATED on explicit go-ahead.
//   node scripts/six-degrees/c-fetch-sdow.mjs --list      (just print latest date)
//   node scripts/six-degrees/c-fetch-sdow.mjs             (download + gunzip)
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'

const BUCKET = 'sdow-prod'
const LIST_URL = `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=dumps/&delimiter=/`
const CACHE_DIR = '.cache/six-degrees'

// Pure: pick the max YYYYMMDD from a GCS JSON listing's `prefixes` array.
export function parseLatestDumpDate(listingJson) {
  const prefixes = (listingJson && listingJson.prefixes) || []
  const dates = prefixes
    .map((p) => (p.match(/dumps\/(\d{8})\//) || [])[1])
    .filter(Boolean)
    .sort()
  return dates.length ? dates[dates.length - 1] : null
}

async function fetchLatestDate() {
  const res = await fetch(LIST_URL)
  if (!res.ok) throw new Error(`GCS listing failed: ${res.status}`)
  const date = parseLatestDumpDate(await res.json())
  if (!date) throw new Error('No dated dump prefixes found; SDOW bucket layout may have changed.')
  return date
}

async function main() {
  const listOnly = process.argv.includes('--list')
  const date = await fetchLatestDate()
  console.log(`Latest SDOW dump: ${date}`)
  if (listOnly) return

  mkdirSync(CACHE_DIR, { recursive: true })
  const gzUrl = `https://storage.googleapis.com/${BUCKET}/dumps/${date}/sdow.sqlite.gz`
  const gzPath = `${CACHE_DIR}/sdow-${date}.sqlite.gz`
  const dbPath = `${CACHE_DIR}/sdow-${date}.sqlite`

  if (existsSync(dbPath)) {
    console.log(`Already present: ${dbPath} (${(statSync(dbPath).size / 1e9).toFixed(1)} GB)`)
    console.log(`Run: python scripts/six-degrees/c_distances.py --db ${dbPath} --dump-date ${date}`)
    return
  }

  if (!existsSync(gzPath)) {
    console.log(`Downloading ${gzUrl} -> ${gzPath} (~4.3 GB, this takes a while)...`)
    const res = await fetch(gzUrl)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    await pipeline(Readable.fromWeb(res.body), createWriteStream(gzPath))
    console.log(`Downloaded ${(statSync(gzPath).size / 1e9).toFixed(1)} GB.`)
  }

  console.log(`Gunzipping -> ${dbPath} ...`)
  await pipeline(createReadStream(gzPath), createGunzip(), createWriteStream(dbPath))
  console.log(`Done: ${dbPath} (${(statSync(dbPath).size / 1e9).toFixed(1)} GB)`)
  console.log(`Next: python scripts/six-degrees/c_distances.py --db ${dbPath} --dump-date ${date}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/sixDegrees.fetchSdow.test.js`
Expected: PASS (3 passed).

- [ ] **Step 5: Syntax-check the script (do NOT run the download)**

Run: `node --check scripts/six-degrees/c-fetch-sdow.mjs`
Expected: no output, exit 0. (Do NOT run the script itself — `--list` hits the network and the default mode starts the 4.3 GB download. Those are gated manual steps.)

- [ ] **Step 6: Commit**

```bash
git add scripts/six-degrees/c-fetch-sdow.mjs tests/sixDegrees.fetchSdow.test.js
git commit -m "feat(sixdegrees-C): SDOW fetch helper (latest-dump discovery + gated download/gunzip)"
```

---

### Task 5: Full suite green + npm script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Run the Python self-tests and the full JS suite**

Run: `python scripts/six-degrees/c_distances.py --selftest`
Expected: `ALL SELFTESTS PASSED`.

Run: `npx vitest run`
Expected: the prior baseline plus the new `tests/sixDegrees.fetchSdow.test.js` (3 passed); the only failure remains the pre-existing `tests/wikipedia.test.js` infobox test. No NEW failures.

- [ ] **Step 2: Add an npm convenience script for the report step**

In `package.json` `"scripts"`, add (after the existing `six:report` line):

```json
    "six:fullgraph": "python scripts/six-degrees/c_distances.py"
```

- [ ] **Step 3: Verify the script resolves the selftest**

Run: `npm run six:fullgraph -- --selftest`
Expected: `ALL SELFTESTS PASSED`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(sixdegrees-C): npm script six:fullgraph"
```

---

## Deferred manual run (gated — NOT part of automated execution)

After the tasks above, the actual data run is three manual commands (the download is the ~4.3 GB commitment, run only on explicit go-ahead):

1. `node scripts/six-degrees/c-fetch-sdow.mjs --list` — confirm the latest dump date.
2. `node scripts/six-degrees/c-fetch-sdow.mjs` — download + gunzip (~4.3 GB → ~15 GB).
3. `python scripts/six-degrees/c_distances.py --db .cache/six-degrees/sdow-<date>.sqlite --dump-date <date>` — produces `docs/six-degrees/fullgraph-<date>.{json,md}`. Commit those reports.

---

## Self-Review

**Spec coverage:**
- §3 data source (SDOW, schema, `|`-separated ids) → Task 2 (`reverse_bfs` splits on `|`), Task 4 (download). ✓
- §4 algorithm (resolve target+redirect, reverse-BFS via incoming_links, chunked IN, unreachable) → Tasks 2, 3. ✓
- §5 outputs (json + md, histogram, pctWithinSix, median/mean/max, unreachable, farthest, caveat) → Tasks 1, 3. ✓
- §6 components (`c-fetch-sdow.mjs`, `c_distances.py`, `.cache/` ignore) → Tasks 1–4 (`.cache/` already ignored). ✓
- §7 testing (`--selftest` synthetic-graph direction test; aggregation unit; no live network in tests) → Tasks 1 (pure), 2 (sqlite direction), 4 (parse). ✓
- §1 caveat (full-graph = lower bound on body-clicks) → rendered in `render_markdown` Method section. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete; the download is explicitly gated, not stubbed.

**Type/name consistency:**
- `build_distribution(dist_map, total_articles, within, top, titles)` defined Task 1, called identically Task 3. ✓
- `farthest` items are `{"id",..}` when `titles=None` (Task 1) and post-filled to `{"title",..}` in Task 3 `main()` — consistent and intentional. ✓
- `resolve_target_id` / `reverse_bfs` signatures defined Task 2, called identically Task 3. ✓
- `render_markdown(report, meta)` with `meta` keys `target`/`dumpDate` — Task 1 selftest and Task 3 `main()` both pass those keys. ✓
- `parseLatestDumpDate(listingJson)` reads `.prefixes` — Task 4 test and `fetchLatestDate` agree. ✓
- SDOW columns used: `pages(id,title,is_redirect)`, `redirects(source_id,target_id)`, `links(id,incoming_links)` — match spec §3 and the synthetic DB. ✓

No issues found.
