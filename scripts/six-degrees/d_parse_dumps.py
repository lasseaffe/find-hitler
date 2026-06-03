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
