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
import sqlite3
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
        _selftest_sqlite()
        print("ALL SELFTESTS PASSED")
        sys.exit(0)
    raise SystemExit("Not yet runnable; use --selftest (full main added in a later task).")
