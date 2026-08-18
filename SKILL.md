---
name: appsheet-architect
description: >-
  Design, build, audit, refactor, and review Google AppSheet apps for fast sync,
  low operating cost, and enterprise scale. Use this whenever the work touches
  AppSheet architecture or performance — slow sync or sync timeouts, virtual
  columns, security filters, slices, Ref/dereference/LOOKUP/SELECT/FILTER
  expressions, keys/UNIQUEID, Google Sheets vs AppSheet Database vs Cloud SQL vs
  BigQuery, data partitions, workbook write contention, bots/automation limits,
  Apps Script offload, or a Documentation export (appdoc) to analyze. Trigger it
  for "my AppSheet app is slow", "reduce sync time", "scale this app", "review
  this expression/virtual column", "design an AppSheet data model", or "cut our
  AppSheet cost" — even when the user doesn't say the word "architecture".
---

# AppSheet Architect

Design, optimize, and refactor AppSheet systems for **maximum sync speed, low
operational cost, and enterprise scalability**. This skill encodes how AppSheet
*actually* behaves under load so you make changes that move the needle instead of
guessing.

## The one mental model everything hangs on

**AppSheet is a distributed system, not a spreadsheet front-end.** The entire
working data set each user is allowed to see is **downloaded and cached on their
device** (browser cache / mobile SQLite) so the app is interactive and works
offline. The app never talks to the data provider directly — it talks to the
AppSheet server, which brokers the provider.

Three consequences drive every decision in this skill:

1. **Sync time ∝ how much data + how much per-row computation** each user's device
   must pull and rebuild on every sync. Shrink one or both, or move the work off
   the sync path. Nothing else matters as much.
2. **There are three separate cost buckets. Know which one you're paying into:**
   - **Sync-time** — paid by *every user on every sync*. Virtual columns,
     security-filter evaluation, table fetches. **The expensive one. Attack it first.**
   - **Edit-time** — paid *once, by the editing user*, when a row is created/updated.
     Physical-column App Formulas and Initial Values live here. Moving work from
     sync-time to edit-time is the single most repeated win in this skill.
   - **Backend/quota** — bots, Apps Script, Sheets API calls. Off the client
     entirely, but bounded by hard limits (timeouts, daily caps).
3. **Concurrency is governed by the data source, not by AppSheet.** Google Sheets
   locks the *entire workbook* per write; a real SQL database uses row-level locks.
   The platform scales to any audience; your backend is the ceiling.

Realistic target: **3–5 s sync.** AppSheet apps essentially never sync reliably
below ~2 s, so chasing sub-2 s is wasted effort — aim for 3–5 s and stop.

## How to use this skill: pick the mode

| The task is… | Go to | First action |
|---|---|---|
| **Audit / optimize / refactor an existing app** — "it's slow", "reduce sync", "scale it", "cut cost" | `references/audit-refactor.md` | Get a **Documentation export** and run `scripts/parse_appdoc.py` |
| **Design a new app, table, or feature** from requirements | `references/design.md` | Model the data first — 80% of success is the data model |
| **Look up an AppSheet formula/function or write an expression** | `references/expressions.md` | Consult the complete formula catalog with bilingual explanations, syntax, and performance notes |
| **Choose or change the data source**, or **write Apps Script / bots** to offload work | `references/data-and-backend.md` | Locate the app on the scaling ladder |
| **Review a single expression, virtual column, slice, or security filter** | `references/diagnostics.md` §Anti-patterns & `references/expressions.md` | Match it against the catalog, name the smell, give the fix |
| **Produce or apply a changeset** for the AppSheet Assistant extension (user has it / wants "a JSON I can apply") | `references/extension-changeset.md` | Emit one strict-JSON `{"changes":[…]}` per that spec — don't ask the user to re-explain the format |

**`references/diagnostics.md` and `references/expressions.md` form the shared knowledge base** — the sync/cost model
in full, the ranked anti-pattern catalog (~40 smells with fixes), every hard limit, and the complete AppSheet function catalog.
All modes cite them. Read the mode file for your task **plus** diagnostics.md and expressions.md when working with expressions.

## Reviewing an expression right now (the fast path)

If the user just pasted an expression, a virtual column, or a security filter and
wants it reviewed, you don't need a whole mode. Do this:

1. **Name the smell** using `references/diagnostics.md` §Anti-patterns.
2. **Say which cost bucket it hits** (sync-time is the one that hurts).
3. **Give the concrete fix**, rewritten.

The highest-value things to catch on sight:

- **`SELECT` / `FILTER` / `LOOKUP` / `MAXROW` / `MINROW` inside a virtual column,
  a format rule, or `Show_If`/`Valid_If`.** These all scan a table under the hood
  and are recomputed for every row on every sync. This is the #1 cause of slow
  apps. Fix: move to a physical column with an App Formula (computes on edit, not
  sync), or dereference a Ref, or use a single-row slice + `INDEX(...,1)`.
- **A `LOOKUP()` where a Ref relationship already exists.** Replace with
  dereference `[RefColumn].[Attribute]` — it reuses an in-memory index (O(1)) vs
  a full scan.
- **A key that is `_RowNumber`, a sheet formula, an editable field, or generated
  in App Formula.** Keys must be stable. Use `UNIQUEID()` in **Initial Value**.
- **A security filter using `OR()` / `NOT()` / complex logic, or on a Google
  Sheet.** Only simple `=` / `IN` / `AND` filters push down to a SQL database;
  nothing pushes down on a Sheet (the whole sheet is read first).
- **An `Address`-type column on a large table.** It spawns a hidden geocoding
  virtual column that re-geocodes every row every sync. This one fix took a
  40k-row app from minutes to ~0.5 s.

## Deliverables — match the mode

Produce the artifact the mode calls for, not a wall of prose:

- **Audit** → a findings report: each finding ranked by impact, with *evidence*
  (from the Performance Analyzer or the parsed export), the cost bucket it hits,
  and the fix. Lead with the top 3 wins.
- **Refactor** → a step-by-step plan with **exact editor steps** and a safe rollout
  (validate on a copy, repoint, smoke-test). See the template in
  `references/audit-refactor.md`.
- **Design** → a build spec: data model (tables, keys, refs), slices, security
  filters, views, automation — with the reasoning, ready for a developer or for
  you to implement step-by-step in the editor.
- **Backend code** → Apps Script / bot logic that respects the automation limits,
  with the sync/async and trigger-column decisions made explicitly.

## Hard constraints — do not get these wrong

- **There is no *official* API that edits an app's structure.** Tables, columns,
  views, actions, and bots are built in the GUI editor; the AppSheet API only
  does row CRUD. By default your output is an artifact: a plan, a spec, editor
  steps, or code. **Exception:** the *AppSheet Assistant* browser extension can
  replay a structural changeset into the editor DOM — see "Applying changes with
  the AppSheet Assistant extension" below. Even then the user must click Save,
  and it edits structure only (never rows).
- **Always measure before prescribing.** The Performance Analyzer
  (Manage → Monitor → Performance Profile) attributes time per step. Uncheck
  "Standard view" to expose hidden costs like the Address geocoder. Never claim a
  fix's impact you haven't grounded in a measurement or a source in diagnostics.md.
- **Numbers change; verify freshness for anything load-bearing.** Plan-tiered
  limits and backend behavior shift over time. The figures in diagnostics.md are
  captured with sources; if a decision hinges on a current limit, confirm it
  against AppSheet Help rather than asserting from memory.
- **Every AppSheet expression uses `[Column]` bracket syntax and AppSheet's
  function list** — it is not SQL, JavaScript, or spreadsheet formula language,
  even though it borrows names. When unsure of a function's exact behavior, say so.

## The parser

`scripts/parse_appdoc.py` turns an AppSheet **Documentation export** (Editor →
Manage → Author → *Documentation*, saved as text) into normalized, readable
per-section files plus aggregate signals an audit needs. Run:

```bash
python scripts/parse_appdoc.py <appdoc.txt> --out <outdir>
```

It emits `summary.md` (counts, the **virtual-column leaderboard**, tables grouped
by data source and by workbook to spot write contention, view-type mix),
`app.json` (machine-readable), and denoised `tables.txt` / `columns.txt` /
`slices.txt` / `views.txt` / `format_rules.txt` / `actions.txt` for expression-level
reading. It counts across the whole app (which humans and LLMs do badly over
100k+ lines) and leaves the reasoning to you. Caveat: workbook grouping from
`Source Path` is approximate — the export doesn't always carry the file ID, so
confirm real workbook boundaries in the editor before acting on contention findings.

## Applying changes with the AppSheet Assistant extension

Normally your design/refactor output is a spec the user executes by hand in the
editor. When the user has the **AppSheet Assistant** browser extension (a
Firefox/Chrome sidebar that drives the AppSheet editor UI), you can instead hand
them a **changeset JSON** it will replay into the editor — turning a plan into
near-one-click changes. Use this when the user says they have the extension or
asks for "a changeset / JSON I can apply", or when a refactor is many small
mechanical edits (retype columns, add slices/actions/format rules, set security
filters).

What it can apply (structure only — never row data, and the user always clicks
**Save** in the editor afterward):

- `set_column` (type, App formula, Valid If, Show/Editable/Require/Reset, Enum/EnumList base-type Ref, and any type-specific property), `add_virtual_column`
- `set_table` (security filter, "are updates allowed")
- `add_view` / `set_view` — all 11 view types. `add_view` needs `name`+`viewType`+`table` (table **or slice**; dashboards omit `table`); `set_view` needs an **exact existing** `view` name. Sort by (any view); **Group by / Group aggregate on `table`/`deck` only — never on charts**. Plus:
  - **dashboards** (omit `table`; embed views via `viewEntries` `[{view,size}]`)
  - **charts** (`chartType` exact label + `chartColumns`; columns filtered by type — categorical for Histogram/Pie/Donut, Number for Col/Row Series/Scatter; only Aggregate Pie/Donut sum a value across rows — Col/Row Series plot one bar per row, so pre-aggregate via a slice/summary table for "SUM by category")
  - **table column show/hide** (`columnOrder` auto/manual + `viewColumns`; reorder not yet supported)
  - **any other view property** via the `properties` escape-hatch keyed by exact editor label (map `Map column`, calendar `Start date`, deck headers, chart `Show legend`, …)
- `add_slice` / `set_slice` (Row filter condition)
- `add_action` / `set_action` (all action types incl. COMPOSITE/grouped, assignments, REF_ACTION)
- `add_format_rule` / `set_format_rule`

How to produce it: emit **one strict-JSON object** `{"changes":[…]}` following the
op/field spec. **The authoritative format and per-op field list are embedded in
this skill at `references/extension-changeset.md` — read it and follow it exactly.**
Key rules: names must match the live schema verbatim; expressions use `[Column]`
syntax with no leading `=`; text literals inside expressions are double-quoted;
dependencies (COMPOSITE child actions, a dashboard's child views) come earlier in
the array. The extension validates every name against the live app and applies
top-to-bottom; unknown names are rejected, label/type mismatches are warnings.

**Do not ask the user to re-explain the changeset format** — it is fully specified
in `references/extension-changeset.md`. Read that file whenever you produce or
apply a changeset.

Fit this into the modes: **Design** and **Refactor** deliverables can additionally
offer a ready-to-apply changeset alongside the human-readable plan. Keep grounding
the *reasoning* in diagnostics.md — the extension changes *how* the edits land, not
*which* edits are worth making.
