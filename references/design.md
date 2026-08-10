# Design — build a new app, table, or feature right the first time

Use this for greenfield work: a new app from requirements, a new table/module, or
a new feature. The cheapest optimization is the one you never have to make — build
the data model and the sync-cost discipline in from the start. Pair with
`diagnostics.md` for the anti-patterns to design *away from*.

## Order of work: data model → keys → refs → filters → views → automation

Do it in this order. Each layer depends on the one above; getting the model right
makes everything downstream simple, and 80% of a good AppSheet app is the data model.

### 1. Model the data (normalize)

- **Item-Detail (parent-child) is the foundational pattern** — most apps are built
  from it. Child table has a **Ref** column to the parent; set the ref's **"Is a
  part of" = ON** for inline child entry within the parent transaction and
  cascading delete. (Remember: IsAPartOf cascades **deletes only**, not updates,
  and a table gets **one** IsAPartOf ref.)
- **Normalize** — no repeating groups, no duplicated parent data on children
  (dereference it live instead; store physically only values that must freeze at
  entry, like price-at-order-time).
- **Prefer many smaller related tables over one giant table** — AppSheet fetches
  multiple tables **in parallel** (plan-gated threads) but processes one huge table
  sequentially. Fact/dimension splitting is both faster and easier to maintain.
- **Every table needs a clear Key and a Label.** Prefer a **physical** concatenated
  label over a virtual one.

### 2. Keys — get this right or everything downstream breaks

- Key = `UNIQUEID()` in **Initial Value** (never App Formula, never a sheet formula,
  never `_RowNumber`, never an editable field). See `diagnostics.md` E1–E6.
- Entropy: `UNIQUEID()` is fine to ~1.4M rows; use `UNIQUEID("UUID")` for
  distributed/enterprise scale. Never `LEFT(UNIQUEID(),2)` (collides at ~30 rows).
- Need chronological sortability? `CONCATENATE(RIGHT(("000000" & ([_RowNumber]-1)),7),"-",UNIQUEID())`.
- On SQL: `NVARCHAR` key + `UNIQUEID()` Initial Value, **not** IDENTITY.

### 3. References, not lookups

- Join tables with **Ref** columns and read across them by **dereference**
  `[Ref].[Attr]` — never design in `LOOKUP()` between tables that have a Ref
  (`diagnostics.md` C3).
- Where you need the relationship for dereferencing but **not** the auto
  `[Related …]` reverse list, use **Enum/EnumList with Base Type = Ref** to avoid
  generating a reverse-reference VC (D1) — *unless* you need interactive
  dashboards, which require a true Ref.

### 4. Design the sync-cost budget in from day one

This is where most apps rot. Build these habits before there's data to slow you:

- **Default to physical columns with App Formulas; reach for a virtual column only
  when the value genuinely must reflect other rows live.** Every VC is a per-sync,
  per-row cost forever. A physical App-Formula column computes once on edit.
- **No `SELECT`/`FILTER`/`LOOKUP`/`MAXROW`/`MINROW` inside a VC, format rule,
  `Show_If`, or `Valid_If`.** If you need a conditional, compute a physical Yes/No
  once and reference it.
- **Add security filters early — even on small data** — so the scaling architecture
  is baked in, not retrofitted. Keep them simple and pushable (`=`, `IN`, `AND`)
  so they'll push down when you move to a DB.
- **Single-row `Current_User` slice** for identity/role/settings, referenced via
  `INDEX(...,1)` — cheaper than scattering `LOOKUP`/`USEREMAIL` scans, and it
  centralizes permission logic.

### 5. Views

- Match view type to the data; keep **Calendar/Map/Card views ≤1,000 rendered
  rows** (use a date-scoped slice). More saturates the mobile UI thread.
- Fewer views and simpler show/format expressions = faster editor saves and less
  client work.

### 6. Automation

- Decide up front what belongs **off the sync path** (heavy/looping work, document
  generation, external calls) → bots or Apps Script. See `data-and-backend.md`.
- Set precise **trigger columns** and a **pre-filter condition** on every bot so it
  fires only when it must.

## Choosing the data source at design time

Don't default to Google Sheets because it's familiar. Match the backend to the
expected scale and concurrency from the start — migrating later is real work. Use
the scaling ladder and the move-up signals in `data-and-backend.md`. Quick guide:

- **Prototype / small / single-team, low concurrency** → Google Sheets is fine.
- **Need fast sync + moderate scale, few writers, no export requirement** →
  AppSheet Database (mind the plan-tiered row caps).
- **Many concurrent writers, >~20k rows/table, real backups, relational integrity**
  → Cloud SQL from the start. Row-level locking is the reason.

## Decomposition: one app or many?

- **Default to a single app conformed by role + security filters**, *not* a clone
  per team/tenant. Cloning is a technical-debt trap — every fix repeats across
  instances, and there's no easy way to copy components between apps.
- For a true multi-module ERP, use the **hub model**: shared read-only tables feed
  downstream module apps, with a small "launcher" app mapping users → module
  access. **Critical caveat:** bots fire only within the app that made the change —
  two apps sharing a table do **not** trigger each other's bots. Design
  cross-module automation around that.
- Keep any single app to **≤ ~30 tables**; consolidate pick-lists into one master
  list.

## Design deliverable

Produce a build spec a developer (or you, step-by-step in the editor) can execute:

```
# <App/feature> — design spec

## Purpose & scale assumptions
<what it does; expected rows/users/concurrency; chosen backend + why>

## Data model
<tables with key, label, and columns; Ref relationships and IsAPartOf; a diagram
or indented tree. Mark each computed column physical (App Formula / Initial Value)
or virtual, with the reason.>

## Slices & security filters
<row-level access model; the Current_User slice; filters written pushable>

## Views
<per role: view types, the ≤1,000-row constraints, key actions>

## Automation
<bots/scripts, triggers, what's off the sync path>

## Risks / limits to watch
<nearest limit from diagnostics §6; the move-up signal that would force a backend change>
```
