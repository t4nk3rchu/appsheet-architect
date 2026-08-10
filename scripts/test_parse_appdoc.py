#!/usr/bin/env python3
"""Minimal self-check for parse_appdoc.py — asserts the counting/sectioning
logic on a tiny synthetic export that mimics the real format (page markers,
wrapped labels, a virtual column). Run: python test_parse_appdoc.py"""
import os
import tempfile

import parse_appdoc as p

SAMPLE = """
===== Trang 1 =====
Data
Tables
Table name Orders
Table name
Orders
Data Source
google
Source Path
OrdersBook/Sheet1
Are updates allowed?
UPDATES_ONLY

===== Trang 2 =====
Table name Log
Table name
Log
Data Source
native
Source Path
appsheet/log
Columns
Schema Name Orders_Schema
Column 1: id
Column name
id
Type
Text
Virtual?
No
Column 2: total
Column name
total
Type
Decimal
App formula
SUM(SELECT(Items[qty], TRUE))
Virtual?
Yes
Slices
Slice Name ActiveOrders
Views
View name OrderList
View type
table
Format Rules
Actions
Action name Delete
""".lstrip()


def test_counts_and_vc_detection():
    tables = p.parse_tables(p.split_sections(p.denoise(SAMPLE.splitlines()))["Tables"])
    assert [t["name"] for t in tables] == ["Orders", "Log"], tables
    assert tables[0]["source"] == "google"

    secs = p.split_sections(p.denoise(SAMPLE.splitlines()))
    per_schema, vc_total = p.parse_columns(secs["Columns"])
    # One virtual column (total), one physical (id), under Orders_Schema.
    assert vc_total == 1, vc_total
    assert per_schema["Orders_Schema"]["columns"] == 2
    assert per_schema["Orders_Schema"]["virtual"] == 1
    name, ctype, formula = per_schema["Orders_Schema"]["vcols"][0]
    assert name == "total" and ctype == "Decimal", (name, ctype)
    assert "SELECT" in formula  # the SELECT-in-VC smell is captured for review

    assert p.parse_named(secs["Slices"], "Slices") == ["ActiveOrders"]
    assert [v[0] for v in p.parse_views(secs["Views"])] == ["OrderList"]


def test_end_to_end_writes_outputs():
    with tempfile.TemporaryDirectory() as d:
        src = os.path.join(d, "appdoc.txt")
        with open(src, "w", encoding="utf-8") as f:
            f.write(SAMPLE)
        out = os.path.join(d, "parsed")
        import sys
        argv = sys.argv
        sys.argv = ["parse_appdoc.py", src, "--out", out]
        try:
            p.main()
        finally:
            sys.argv = argv
        for fn in ("summary.md", "app.json", "columns.txt", "tables.txt"):
            assert os.path.getsize(os.path.join(out, fn)) >= 0


if __name__ == "__main__":
    test_counts_and_vc_detection()
    test_end_to_end_writes_outputs()
    print("ok")
