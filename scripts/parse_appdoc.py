#!/usr/bin/env python3
"""
parse_appdoc.py — normalize an AppSheet "Documentation" export and extract
audit signals, VC leaderboards, and write-contention indicators.

The Documentation export (Editor -> Manage -> Author -> Documentation, saved as
text/PDF-to-text) is a paginated label/value dump that can run to 100k+ lines for
a large app. It is too big to read whole, its pages are interrupted by
"===== Trang N =====" / "===== Page N =====" markers, and long values wrap.

This script:
  1. Denoises + splits the export into per-section text files.
  2. Aggregates metrics across the WHOLE app:
     - Total virtual columns and per-table VC leaderboard
     - Tables grouped by data source and workbook (to spot write contention)
     - View-type distribution
     - Slices, Actions, and Format Rules counts

Usage:
    python parse_appdoc.py <appdoc.txt> [--out OUTDIR]

Outputs (in OUTDIR, default "<appdoc>_parsed/"):
    summary.md      — counts, VC leaderboard, data-source grouping, view types
    tables.txt      — normalized Tables section
    columns.txt     — normalized Columns section (per schema, per column)
    slices.txt      — normalized Slices section
    views.txt       — normalized Views section
    format_rules.txt— normalized Format Rules section
    actions.txt     — normalized Actions section
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

# Top-level section headers, in the order AppSheet emits them.
SECTION_HEADERS = [
    "Tables", "Columns", "Slices", "Views", "Format Rules", "Actions",
]

# Record-start patterns per section
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


def parse_tables(lines):
    """Return list of dicts: name, data_source, source_path, update_mode, row_count (if present)."""
    tables = []
    cur = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        m = RECORD_START["Tables"].match(ln)
        if m:
            if cur:
                tables.append(cur)
            cur = {"name": m.group(1).strip(), "data_source": "", "source_path": "", "update_mode": "", "filter": ""}
            i += 1
            continue
        if not cur:
            i += 1
            continue
        if ln == "Data Source":
            cur["data_source"] = value_after(lines, i)
            i += 2
            continue
        if ln == "Source Path":
            cur["source_path"] = value_after(lines, i)
            i += 2
            continue
        if ln == "Are updates allowed?":
            cur["update_mode"] = value_after(lines, i)
            i += 2
            continue
        if ln == "Row filter condition":
            cur["filter"] = value_after(lines, i)
            i += 2
            continue
        i += 1
    if cur:
        tables.append(cur)
    return tables


def parse_columns(lines):
    """
    Return:
      per_schema: { schema_name: [ {name, type, is_virtual, formula, ...} ] }
      total_vc: int
      vc_by_schema: Counter({ schema_name: count })
    """
    per_schema = defaultdict(list)
    current_schema = "UNKNOWN"
    cur_col = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        sm = SCHEMA_RE.match(ln)
        if sm:
            if cur_col:
                per_schema[current_schema].append(cur_col)
                cur_col = None
            current_schema = sm.group(1).strip()
            i += 1
            continue
        cm = RECORD_START["Columns"].match(ln)
        if cm:
            if cur_col:
                per_schema[current_schema].append(cur_col)
            cur_col = {
                "name": cm.group(1).strip(),
                "type": "",
                "is_virtual": False,
                "formula": "",
                "initial_value": "",
                "show_if": "",
            }
            i += 1
            continue
        if not cur_col:
            i += 1
            continue
        if ln == "Type":
            cur_col["type"] = value_after(lines, i)
            i += 2
            continue
        if ln == "Virtual?":
            v = value_after(lines, i).lower()
            cur_col["is_virtual"] = v.startswith("y") or v == "true"
            i += 2
            continue
        if ln == "App formula":
            cur_col["formula"] = value_after(lines, i)
            i += 2
            continue
        if ln == "Initial value":
            cur_col["initial_value"] = value_after(lines, i)
            i += 2
            continue
        if ln == "Show?":
            cur_col["show_if"] = value_after(lines, i)
            i += 2
            continue
        i += 1
    if cur_col:
        per_schema[current_schema].append(cur_col)

    vc_by_schema = Counter()
    total_vc = 0
    for sch, cols in per_schema.items():
        vc_count = sum(1 for c in cols if c["is_virtual"])
        if vc_count:
            vc_by_schema[sch] = vc_count
            total_vc += vc_count
    return per_schema, total_vc, vc_by_schema


def parse_views(lines):
    """Return list of dicts: name, view_type, for_data."""
    views = []
    cur = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        vm = RECORD_START["Views"].match(ln)
        if vm:
            if cur:
                views.append(cur)
            cur = {"name": vm.group(1).strip(), "view_type": "", "for_data": ""}
            i += 1
            continue
        if not cur:
            i += 1
            continue
        if ln == "View type":
            cur["view_type"] = value_after(lines, i)
            i += 2
            continue
        if ln == "For this data":
            cur["for_data"] = value_after(lines, i)
            i += 2
            continue
        i += 1
    if cur:
        views.append(cur)
    return views


def parse_simple_names(lines, section_key):
    """Return list of record names for sections where names suffice for summary counts."""
    names = []
    rx = RECORD_START[section_key]
    for ln in lines:
        m = rx.match(ln)
        if m:
            names.append(m.group(1).strip())
    return names


def summarize(tables, per_schema, total_vc, vc_by_schema, views, slices, actions, format_rules):
    """Generate Markdown summary containing vital audit signals."""
    total_tables = len(tables)
    total_cols = sum(len(cols) for cols in per_schema.values())
    view_types = Counter(v["view_type"] for v in views if v.get("view_type"))

    # Group tables by data source & workbook
    by_source = defaultdict(list)
    by_path = defaultdict(list)
    for t in tables:
        src = t["data_source"] or "(unspecified)"
        by_source[src].append(t["name"])
        pth = t["source_path"] or "(none)"
        by_path[(src, pth)].append(t["name"])

    lines = []
    lines.append("# AppSheet Documentation Export Summary\n")
    lines.append("## Overall Counts\n")
    lines.append(f"- **Tables:** {total_tables}")
    lines.append(f"- **Schemas / Column sets:** {len(per_schema)}")
    lines.append(f"- **Total Columns:** {total_cols} (Physical: {total_cols - total_vc}, **Virtual: {total_vc}**)")
    lines.append(f"- **Slices:** {len(slices)}")
    lines.append(f"- **Views:** {len(views)}")
    lines.append(f"- **Actions:** {len(actions)}")
    lines.append(f"- **Format Rules:** {len(format_rules)}\n")

    lines.append("## Virtual Column Leaderboard (Top Sync-Cost Suspects)\n")
    if vc_by_schema:
        lines.append("| Schema / Table | Virtual Columns | Total Columns | % Virtual |")
        lines.append("|---|---|---|---|")
        for sch, count in vc_by_schema.most_common(20):
            tot = len(per_schema[sch])
            pct = (count / tot * 100) if tot else 0
            lines.append(f"| `{sch}` | **{count}** | {tot} | {pct:.0f}% |")
    else:
        lines.append("No virtual columns detected.\n")

    lines.append("\n## Data Sources & Workbook Write-Contention\n")
    lines.append("| Data Source | Workbook / Path | Tables in Workbook | Risk |")
    lines.append("|---|---|---|---|")
    for (src, pth), tbls in sorted(by_path.items(), key=lambda x: -len(x[1])):
        risk = "⚠️ Contention" if len(tbls) >= 4 and "google" in src.lower() else "Normal"
        tbl_str = ", ".join(f"`{t}`" for t in tbls[:6])
        if len(tbls) > 6:
            tbl_str += f" (+{len(tbls)-6} more)"
        lines.append(f"| {src} | `{pth}` | {tbl_str} | {risk} |")

    lines.append("\n## View Types Distribution\n")
    lines.append("| View Type | Count | Render Risk (>1k rows) |")
    lines.append("|---|---|---|")
    for vt, count in view_types.most_common():
        risk_note = "⚠️ High render cost" if vt in ("map", "calendar", "card") else "Standard"
        lines.append(f"| `{vt}` | {count} | {risk_note} |")

    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser(description="Parse an AppSheet Documentation export into readable audit signals.")
    p.add_argument("appdoc", help="Path to exported documentation text file.")
    p.add_argument("--out", default=None, help="Output directory (default: <appdoc>_parsed).")
    args = p.parse_args()

    if not os.path.exists(args.appdoc):
        print(f"Error: file not found: {args.appdoc}", file=sys.stderr)
        sys.exit(1)

    outdir = args.out or (os.path.splitext(args.appdoc)[0] + "_parsed")
    os.makedirs(outdir, exist_ok=True)

    with open(args.appdoc, "r", encoding="utf-8", errors="replace") as f:
        raw_lines = f.readlines()

    clean_lines = denoise(raw_lines)
    sections = split_sections(clean_lines)

    # Dump per-section denoised text files
    for sec_name, sec_lines in sections.items():
        fname = sec_name.lower().replace(" ", "_") + ".txt"
        with open(os.path.join(outdir, fname), "w", encoding="utf-8") as f:
            f.write("\n".join(sec_lines))

    tables = parse_tables(sections.get("Tables", []))
    per_schema, total_vc, vc_by_schema = parse_columns(sections.get("Columns", []))
    views = parse_views(sections.get("Views", []))
    slices = parse_simple_names(sections.get("Slices", []), "Slices")
    actions = parse_simple_names(sections.get("Actions", []), "Actions")
    format_rules = parse_simple_names(sections.get("Format Rules", []), "Format Rules")

    # Write summary.md
    summary_md = summarize(tables, per_schema, total_vc, vc_by_schema, views, slices, actions, format_rules)
    with open(os.path.join(outdir, "summary.md"), "w", encoding="utf-8") as f:
        f.write(summary_md)

    # Write app.json
    app_data = {
        "tables": tables,
        "views": views,
        "slice_names": slices,
        "action_names": actions,
        "format_rule_names": format_rules,
        "vc_leaderboard": dict(vc_by_schema.most_common()),
        "total_virtual_columns": total_vc,
    }
    with open(os.path.join(outdir, "app.json"), "w", encoding="utf-8") as f:
        json.dump(app_data, f, indent=2)

    print(f"Parsed successfully -> {outdir}/")
    print(f"  - Summary: {outdir}/summary.md")
    print(f"  - JSON:    {outdir}/app.json")


if __name__ == "__main__":
    main()
