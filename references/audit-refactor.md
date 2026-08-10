# Audit & Refactor — make an existing app fast and cheap

Use this when the app already exists and the goal is "it's slow", "reduce sync
time", "scale it", or "cut cost". Audit = diagnose and report. Refactor = the
step-by-step plan to fix it safely. They're one workflow: **measure → diagnose →
prioritize → plan → validate.** Pair with `diagnostics.md` for the *why* and the
numbers.

## Golden rule: measure before you prescribe

Never open with a fix. Open with evidence. Two evidence sources:

1. **The Performance Analyzer** (Manage → Monitor → Performance Profile). Ask the
   user for a screenshot or the JSON download of a slow sync. **Uncheck "Standard
   view"** so hidden costs (the Address geocoder) show. This tells you *where the
   time actually goes* — table fetches vs VC computation vs a specific table.
2. **The Documentation export**, parsed. This tells you *what's in the app* and
   surfaces structural signals (VC leaderboard, write-contention grouping) at a
   scale you can't eyeball.

If the user can't provide a Performance Analyzer read, say so in the report and
mark impact estimates as *projected* (use the model in diagnostics.md §3), not
measured. Don't fabricate measured impact.

## Step 0 — Parse the export

Get the export: Editor → **Manage → Author → Documentation**, save as text.
Then:

```bash
python scripts/parse_appdoc.py <appdoc.txt> --out <outdir>
```

Read `<outdir>/summary.md` first — it gives counts, the **virtual-column
leaderboard**, tables grouped by data source and by workbook, and the view-type
mix. Then read the specific denoised section files (`columns.txt`, `slices.txt`,
etc.) for the tables the summary or the Analyzer flagged. Don't read the whole
export — target the suspects.

**What the summary tells you at a glance:**
- Total rows/tables/columns vs the limits in diagnostics.md §6 — are you near a wall?
- VC leaderboard — which tables carry the most virtual columns (the sync-cost
  suspects). Cross-check against what the Analyzer says is slow.
- Tables-by-workbook — multiple high-write tables in one Google Sheets workbook =
  **write contention** (the whole workbook locks per write). Confirm real file
  boundaries in the editor (the export's Source Path is approximate).
- View-type mix — many Calendar/Map/Card views hint at the ≤1,000-row render risk.

## The diagnostic pass (ordered by ROI)

Walk these in order. Each maps to `diagnostics.md §5`. Stop escalating once the
target sync (3–5 s) is met — don't gold-plate.

1. **Hidden fixed costs first (highest ROI).** Any `Address`-type column on a
   large table → the geocoding tax (H1). This is the single biggest documented win.
   Check the Analyzer with "Standard view" off.
2. **De-virtualize.** Find `SELECT`/`FILTER`/`LOOKUP`/`MAXROW`/`MINROW` inside VCs,
   format rules, `Show_If`/`Valid_If` (A1, C1, C7). Convert compute-once VCs to
   physical App-Formula columns (A2); delete unused VCs and unused reverse-refs
   (A3, D1). Grep `columns.txt` for these functions.
3. **Cheaper access patterns.** `LOOKUP` where a Ref exists → dereference (C3);
   per-row `LOOKUP` in format rules → single-row slice + `INDEX` (C4); current-user
   / settings lookups → a `Current_User` slice (B2).
4. **Slim the schema.** Enum-base-Ref where reverse-refs are dead weight (D1);
   the "physical logic" pattern for repeated booleans; prune orphaned
   views/actions/slices.
5. **Backend contention & sheet hygiene.** One high-write table per workbook;
   isolate read-only tables in their own cached workbook; crop empty rows/columns;
   remove in-sheet formulas (diagnostics §4, §6).
6. **Cut the payload server-side.** Security filters (simple, pushable — F1–F3);
   cascading filters for multi-tenant; partitions/buckets for very large data.
   Constrain heavy views to ≤1,000 rows.
7. **Offload heavy work** off the sync path to bots/Apps Script — see
   `data-and-backend.md`.
8. **Tune sync settings** with the traps in mind (delta/quick/background —
   diagnostics §4).
9. **Fix circular security-filter deadlocks** if the symptom is timeouts/muted
   mutation errors on load (F4) — this is a correctness bug, promote it whenever
   present.

## Prioritize: impact × confidence × effort

Rank findings so the user fixes the three biggest wins first. For each finding
weigh: **impact** (how much sync/cost it removes — is it on the hot path the
Analyzer flagged?), **confidence** (measured vs projected), **effort/risk** (a
column-type change is minutes; a data-source migration is a project). Lead the
report with the top 3.

## Audit report template

```
# AppSheet audit — <app name>

## Summary
<2–3 sentences: current sync time / symptom, the headline cause, the expected
win from the top 3 fixes.>

## Evidence
- Performance Analyzer: <what the slow step was, with the number> (or "not provided")
- Parsed export: <tables, columns, VC count, rows vs limits, contention signal>

## Findings (ranked)
### 1. <finding> — impact: High | confidence: Measured/Projected | effort: Low
- Where: <table/column/expression, cite columns.txt line or Analyzer step>
- Why it costs: <cost bucket + mechanism, cite diagnostics §>
- Fix: <concrete change, rewritten expression / setting>
- Expected win: <number or "projected", cite a benchmark if apt>
### 2. …
### 3. …
## Lower-priority / watch list
<brief bullets>
```

## Refactor plan template

When the user wants the *how*, produce a plan with **exact editor steps** and a
**safe rollout** — you cannot edit the app yourself, so the plan must be
executable by a person in the editor. Model it on this shape (a real one lives in
the project's `ECT_Restructure_Plan.md`):

```
# <App> — <refactor name>

**Goal:** <one line: the bottleneck and what this removes.>

## The change
<table/plan, e.g. the new workbook layout, the VC→physical conversions, the
column-type changes — with before/after.>

## How to run it safely (on a COPY first)
1. <script/backup step if data is being restructured>
2. <audit step: what could break — #REF! formulas, orphaned refs — and how to check>
3. <apply>

## AppSheet editor checklist (the part that actually fixes the app)
For each affected table, in the editor:
- [ ] <Data → Columns → change type / move formula to App Formula / delete VC>
- [ ] <Data → Tables → repoint source / regenerate schema>
- [ ] Save, Sync, smoke-test <the specific flow>.

## Caveats / open items
<what this does NOT fix; what needs the user's input (file IDs, plan tier); rollback.>
```

**Rollout safety is non-negotiable** because there's no undo on a live app:
- Restructure and validate on a **copy/backup** first; keep the original untouched.
- If moving data between files, preserve **stable file IDs** (AppSheet binds to the
  Drive file ID, not the name — a trash-and-recreate mints a new ID and silently
  breaks the source binding).
- After repointing a table's source, **regenerate the schema** and smoke-test each
  affected area.
- Use a **separate DEV app with a reduced dataset** and push to production via
  "Upgrade app to a new version" for editor-heavy changes.

## Validate (close the loop)
Re-run the Performance Analyzer and compare the targeted step against the Step-0
baseline — confirm the category you attacked (e.g. "Compute virtual columns")
actually dropped. Confirm no broken references before deploy. A refactor you
didn't re-measure is a hypothesis, not a fix.
