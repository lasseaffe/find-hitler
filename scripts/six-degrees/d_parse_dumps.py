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


def _selftest_bfs_edges():
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE edges (src INTEGER, dst INTEGER)")
    # forward edges: A(4)->B(2), B(2)->T(1), C(3)->T(1); D(5) isolated
    conn.executemany("INSERT INTO edges VALUES (?,?)", [(4, 2), (2, 1), (3, 1)])
    conn.execute("CREATE INDEX ix ON edges(dst)")
    dist = reverse_bfs_edges(conn, 1)
    assert dist == {1: 0, 2: 1, 3: 1, 4: 2}, dist  # D(5) unreachable, absent
    print("  bfs_edges (reverse_bfs_edges) OK")


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
        _selftest_bfs_edges()
        _selftest_build()
        print("ALL SELFTESTS PASSED")
        sys.exit(0)
    raise SystemExit("Not yet runnable; use --selftest (full main added in a later task).")
