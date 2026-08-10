#!/usr/bin/env python3
"""
parse_appdoc.py — normalize an AppSheet "Documentation" export and pull the
signals an audit actually needs.

The Documentation export (Editor -> Manage -> Author -> Documentation, saved as
text/PDF-to-text) is a paginated label/value dump that can run to 100k+ lines for
a large app. It is too big to read whole, its pages are interrupted by
"===== Trang N =====" / "===== Page N =====" markers, and long values (Type
Qualifier JSON, formulas, view configs) wrap across several lines.

A script does two things here that a human or an LLM reading the raw file does
badly:
  1. Denoise + split the monster into per-section files small enough to read.
  2. Count across the WHOLE app — total virtual columns, the per-table VC
     leaderboard, tables grouped by data source (to spot write contention),
     view-type distribution, action counts. Aggregates over 100k lines are
     exactly what an LLM miscounts and a script nails.

It deliberately does NOT try to perfectly reassemble every wrapped expression —
that is fragile and version-dependent. It extracts the clean single-line signals
(Virtual? Yes/No, Type, Data Source, View type, ...) and leaves readable,
denoised per-section text in the output dir so the agent can read specific
tables/columns for expression-level review.

Usage:
    python parse_appdoc.py <appdoc.txt> [--out OUTDIR]

Outputs (in OUTDIR, default "<appdoc>_parsed/"):
    summary.md      — counts, VC leaderboard, data-source grouping, view types
    tables.txt      — normalized Tables section
    columns.txt     — normalized Columns section (per schema, per column)
    slices.txt      — normalized Slices section
    views.txt       — normalized Views section
    format_rules.txt
    actions.txt
    app.json        — machine-readable structure (tables, per-schema VC counts, ...)
"""
import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict

# Page-break markers seen in real exports (English "Page", Vietnamese "Trang").
PAGE_RE = re.compile(r"^=====\s*(Trang|Page)\s+\d+\s*=====\s*$", re.IGNORECASE)

# Top-level section headers, in the order AppSheet emits them. A line equal to
# one of these (exactly) flips the current section.
SECTION_HEADERS = [
    "Tables", "Columns", "Slices", "Views", "Format Rules", "Actions",
]

# Record-start patterns per section: the combined "Label value" line that
# delimits one record (distinct from the bare "Label" field line that follows).
RECORD_START = {
    "Tables":       re.compile(r"^Table name (.+)$"),
    "Columns":      re.compile(r"^Column \d+: (.+)$"),
    "Slices":       re.compile(r"^Slice Name (.+)$"),
    "Views":        re.compile(r"^View name (.+)$"),
    "Format Rules": re.compile(r"^Rule name (.+)$"),
    "Actions":      re.compile(r"^Action name (.+)$"),
}
SCHEMA_RE = re.compile(r"^Schema Name (.+)$")


def denoise(lines):
    """Drop page markers and collapse runs of blank lines to a single blank."""
    out = []
    blank = False
    for ln in lines:
        s = ln.rstrip("\n")
        if PAGE_RE.match(s):
            continue
        if s.strip() == "":
            if not blank:
                out.append("")
            blank = True
            continue
        blank = False
        out.append(s)
    return out


def value_after(lines, i):
    """Return the single line following index i, or '' if none/blank."""
    if i + 1 < len(lines):
        return lines[i + 1].strip()
    return ""


def split_sections(lines):
    """Map each top-level section name -> list of its lines."""
    sections = defaultdict(list)
    current = None
    for s in lines:
        if s in SECTION_HEADERS:
            current = s
            continue
        if current:
            sections[current].append(s)
    return sections


def parse_columns(lines):
    """
    Walk the Columns section. Track the enclosing schema and each 'Column N:'
    record; capture Type, Virtual?, and the App formula hint (first line).
    Returns (per_schema, vc_total) where per_schema is
        {schema: {"columns": int, "virtual": int, "vcols": [(name, type, formula_hint)]}}
    """
    per_schema = defaultdict(lambda: {"columns": 0, "virtual": 0, "vcols": []})
    schema = "(unknown)"
    col = None
    ctype = ""
    formula = ""
    is_virtual = False

    def flush():
        nonlocal col, ctype, formula, is_virtual
        if col is None:
            return
        per_schema[schema]["columns"] += 1
        if is_virtual:
            per_schema[schema]["virtual"] += 1
            per_schema[schema]["vcols"].append((col, ctype, formula))
        col, ctype, formula, is_virtual = None, "", "", False

    for i, s in enumerate(lines):
        m = SCHEMA_RE.match(s)
        if m:
            flush()
            schema = m.group(1).strip()
            continue
        mc = RECORD_START["Columns"].match(s)
        if mc:
            flush()
            col = mc.group(1).strip()
            continue
        if col is None:
            continue
        if s == "Type":
            ctype = value_after(lines, i)
        elif s == "App formula":
            formula = value_after(lines, i)
        elif s == "Virtual?":
            is_virtual = value_after(lines, i).lower().startswith("y")
    flush()

    vc_total = sum(v["virtual"] for v in per_schema.values())
    return per_schema, vc_total


def parse_tables(lines):
    """Return list of {name, source, updates, source_path, partitioned}."""
    tables = []
    cur = None

    def field(i, s, label):
        return value_after(lines, i) if s == label else None

    for i, s in enumerate(lines):
        m = RECORD_START["Tables"].match(s)
        if m:
            if cur:
                tables.append(cur)
            cur = {"name": m.group(1).strip(), "source": "", "updates": "",
                   "source_path": "", "partitioned": ""}
            continue
        if not cur:
            continue
        if s == "Data Source":
            cur["source"] = value_after(lines, i)
        elif s == "Are updates allowed?":
            cur["updates"] = value_after(lines, i)
        elif s == "Source Path":
            cur["source_path"] = value_after(lines, i)
    if cur:
        tables.append(cur)
    return tables


def parse_named(lines, section):
    """Generic: return the list of record names for a section."""
    rx = RECORD_START[section]
    return [m.group(1).strip() for m in (rx.match(s) for s in lines) if m]


def parse_views(lines):
    """Return list of (name, type)."""
    views = []
    name = None
    for i, s in enumerate(lines):
        m = RECORD_START["Views"].match(s)
        if m:
            name = m.group(1).strip()
            views.append([name, ""])
            continue
        if views and s == "View type":
            views[-1][1] = value_after(lines, i)
    return views


def workbook_of(source_path):
    """Group heuristic: first path segment ~ the workbook/data file."""
    if not source_path:
        return "(blank)"
    seg = source_path.strip().strip("/").split("/")[0]
    return seg or "(root)"


def main():
    ap = argparse.ArgumentParser(description="Normalize an AppSheet Documentation export.")
    ap.add_argument("appdoc", help="Path to the Documentation export (.txt).")
    ap.add_argument("--out", help="Output directory (default <appdoc>_parsed/).")
    args = ap.parse_args()

    if not os.path.isfile(args.appdoc):
        sys.exit(f"File not found: {args.appdoc}")
    out = args.out or (os.path.splitext(args.appdoc)[0] + "_parsed")
    os.makedirs(out, exist_ok=True)

    with open(args.appdoc, encoding="utf-8", errors="replace") as f:
        raw = f.readlines()
    lines = denoise(raw)

    sections = split_sections(lines)

    # Write normalized per-section text for the agent to read in targeted pieces.
    file_map = {
        "Tables": "tables.txt", "Columns": "columns.txt", "Slices": "slices.txt",
        "Views": "views.txt", "Format Rules": "format_rules.txt", "Actions": "actions.txt",
    }
    for sec, fname in file_map.items():
        with open(os.path.join(out, fname), "w", encoding="utf-8") as f:
            f.write("\n".join(sections.get(sec, [])))

    # Aggregates.
    per_schema, vc_total = parse_columns(sections.get("Columns", []))
    tables = parse_tables(sections.get("Tables", []))
    slices = parse_named(sections.get("Slices", []), "Slices")
    views = parse_views(sections.get("Views", []))
    actions = parse_named(sections.get("Actions", []), "Actions")
    rules = parse_named(sections.get("Format Rules", []), "Format Rules")

    total_cols = sum(v["columns"] for v in per_schema.values())
    vc_board = sorted(
        ((s, v["virtual"], v["columns"]) for s, v in per_schema.items()),
        key=lambda x: x[1], reverse=True,
    )
    by_source = Counter(t["source"] or "(blank)" for t in tables)
    by_workbook = Counter(workbook_of(t["source_path"]) for t in tables)
    view_types = Counter(t for _, t in views)

    app = {
        "tables": tables,
        "counts": {
            "tables": len(tables), "columns": total_cols, "virtual_columns": vc_total,
            "slices": len(slices), "views": len(views), "actions": len(actions),
            "format_rules": len(rules),
        },
        "vc_leaderboard": [
            {"schema": s, "virtual": v, "columns": c} for s, v, c in vc_board if v
        ],
        "tables_by_source": dict(by_source),
        "tables_by_workbook": dict(by_workbook),
        "view_types": dict(view_types),
    }
    with open(os.path.join(out, "app.json"), "w", encoding="utf-8") as f:
        json.dump(app, f, indent=2, ensure_ascii=False)

    # Human summary.
    lines_out = []
    w = lines_out.append
    w("# AppSheet app audit — parsed signals\n")
    c = app["counts"]
    w(f"- Tables: **{c['tables']}**")
    w(f"- Columns: **{c['columns']}**")
    w(f"- Virtual columns: **{c['virtual_columns']}**  "
      f"(~{(100*c['virtual_columns']//c['columns']) if c['columns'] else 0}% of all columns)")
    w(f"- Slices: **{c['slices']}**  |  Views: **{c['views']}**  "
      f"|  Actions: **{c['actions']}**  |  Format rules: **{c['format_rules']}**\n")

    w("## Virtual-column leaderboard (biggest sync-time suspects first)\n")
    w("| Table/schema | Virtual cols | Total cols |")
    w("|---|---|---|")
    for s, v, col in vc_board[:20]:
        if v:
            w(f"| {s} | {v} | {col} |")
    w("")

    w("## Tables by data source\n")
    for src, n in by_source.most_common():
        w(f"- {src}: {n}")
    w("")
    w("## Tables grouped by workbook / source path "
      "(same workbook = shared write lock = contention risk)\n")
    for wb, n in by_workbook.most_common():
        w(f"- {wb}: {n} table(s)")
    w("")
    w("## View-type distribution\n")
    for vt, n in view_types.most_common():
        w(f"- {vt or '(unset)'}: {n}")
    w("")
    w("---\n")
    w("Normalized per-section text is in this folder: tables.txt, columns.txt, "
      "slices.txt, views.txt, format_rules.txt, actions.txt. Read the relevant "
      "one for expression-level review; app.json has the machine-readable structure.")

    with open(os.path.join(out, "summary.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines_out))

    print(f"Parsed OK -> {out}")
    print(f"  tables={c['tables']} columns={c['columns']} "
          f"virtual={c['virtual_columns']} slices={c['slices']} "
          f"views={c['views']} actions={c['actions']}")


if __name__ == "__main__":
    main()
