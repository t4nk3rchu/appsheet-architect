# Data sources & backend offload

Two related decisions: **which backend** the data lives in (the scaling ladder),
and **what work to push off the client sync path** (Apps Script / bots). Both
serve the same goals — faster sync, lower cost, more concurrency. Pair with
`diagnostics.md` §6 for the exact limits.

## Part 1 — the data-source scaling ladder

The unbreakable constraint: **AppSheet downloads the whole working set to each
device.** So an app only scales if it's **partitionable** — each user needs a small
subset. If everyone needs all the data, no backend and no technique saves you;
AppSheet is the wrong tool. The **~100k-row app read cap holds on every backend**,
including BigQuery — moving up the ladder buys speed, concurrency, and query
pushdown, not a higher working-set ceiling.

Escalation order (AppSheet's own): **security filters → data partitioning → move
to a database.**

### Rung 1 — Google Sheets
- **Capacity:** 20M cells (docs may say 10M); AppSheet caps the app at ~100k rows
  anyway. Practical pain approaches 100k rows/table.
- **Sync:** the **entire sheet is read before any filter applies** — so security
  filters don't cut the cloud-read step on Sheets (they help network/storage only).
- **Concurrency:** **workbook-level lock** — every write locks the whole file.
  10 users × 10 s → the last waits ~90 s → timeout. This is the Sheets killer.
- **Cost:** free. Familiar, editable outside the app, easy backup/copy.
- **Move up when:** ~100k rows/table, sync 120 s+, formula-recalc lag, or
  concurrent-write collisions. First add filters + partitions; then go to a DB.

### Rung 2 — AppSheet Database (native)
- **Capacity (plan-tiered):** 1,000 (Free) / 2,500 (Starter & Core) / 200,000
  (Enterprise) rows per DB; 20 tables/DB; 100 cols/table. The **2,500-row Core cap
  is the classic wall.**
- **Sync:** fastest in the ecosystem by reputation; **quick sync on by default**;
  filters push down with extra ASDB optimizations; ACID-ish transactions.
- **Cons:** **no clean export** (RowIDs stripped → relationships break on
  export/migration); can't cross-reference two DBs; bulk delete ≈ **1 s/row**.
  Sheets→ASDB migration can break Ref relationships (RowID ≠ `UNIQUEID()`).
- **Move up when:** you hit the per-DB row cap, need >20 tables / >100 columns,
  need real backups/export, or need cross-database references.

### Rung 3 — Cloud SQL / SQL Server / MySQL / Postgres
- **Capacity:** millions of rows **if** security filters map to efficient indexed
  queries. No QPS quota; performance = instance spec + query profile.
- **Sync:** filters convert to `SELECT … WHERE` **at the database** — filtering
  happens in the cloud-read step (the big win); **row-level locking** = true
  concurrency. Fastest with Enterprise (more parallel threads) + filters.
- **Setup gotchas:** keys = `NVARCHAR(8/36)` + `UNIQUEID()` Initial Value, **not**
  IDENTITY (offline clients can't get server-assigned keys); or seed IDENTITY high
  + client `RANDBETWEEN`. Use `DATETIME2`. Files store a filename in a varchar
  column; blobs go to the owner's cloud drive. Needs inbound IP access for AppSheet.
- **Move up when:** you need warehouse-scale aggregation or cross-system OLAP.

### Rung 4 — BigQuery
- Near-real-time, warehouse scale, **Enterprise-only** (Advanced Connector).
  `NOT`/`OR` filters push down here (unlike generic SQL). Still bound by the ~100k
  app read cap — BQ is for freshness + query power + warehouse integration.
- Lighter alternative: **Connected Sheets** (BQ → Sheet → AppSheet) — simpler, but
  data is only as fresh as the Sheet's refresh schedule.

### Scaling techniques — pick by source
| Technique | What it does | Filtering happens | Best when |
|---|---|---|---|
| **Security filter** | Per-user row-level true/false | **DB:** pushed to SQL (helps all steps). **Sheet:** after full fetch (helps steps 2–3 only) | Partitionable app on a **database**; keep filters `=`/`IN`/`AND` |
| **Slice** | Subset used like a table | Downloads all, filters on-device | **UI only — not scaling.** No payload cut, no security |
| **Data partition** | One table split across identical sheets/worksheets; a `USEREMAIL()`/`USERSETTINGS()` expr routes each user to one | Physically smaller read per user | Staying on **spreadsheets** past limits; schemas must stay identical (manual upkeep) |
| **Horizontal scaling (buckets)** | User Settings + filters load progressive buckets (minimal → drill down) | Cuts initial sync dramatically | Very large data where users drill from a selection |

Rules of thumb: **Sheet → filters help little → use partitions (+ archival). DB →
filters are the primary lever → partitions usually unnecessary. Filters +
partitions = near-infinite scale for a partitionable app.**

### Archive vs filter (keeping a table thin)
- Community leans to **security filters to stay single-table** (avoids the pain of
  re-unioning split data). A `YYYYMM` column + `USERSETTINGS("YYYYMM")` filter lets
  users load only the current month but dial back.
- If old data is genuinely never needed live, a **separate archive app + scheduled
  action/script** (copy row → stamp `DateArchived` → delete from live) keeps the
  active DB small.

## Part 2 — backend offload (get work off the sync path)

Move work off the client whenever it is (a) heavy/looping, (b) not needed for the
interactive UI, or (c) at risk of Sheets-API quota/timeouts. The cost hierarchy:

- **VC (in-app):** zero setup, but O(N) cost paid by **every user on every sync** —
  most expensive at scale.
- **Physical App Formula / Initial Value:** cost paid **once, by the editing user**.
- **Bot (server):** off the client entirely, but bounded by timeouts/retries and
  **fires only after the device reconnects and syncs** (not offline, not on direct
  source edits except AppSheet DB).
- **Apps Script async:** fastest client response, but **no guarantee it finishes
  before sync** — unsafe when the app needs the result immediately.

### Bots / automation
- Run **server-side**. Set precise **trigger columns** (fire only when the relevant
  column changes) and a **pre-filter condition** to drop irrelevant rows before
  spinning up a task. Reuse tasks across bots.
- **Limits:** app-change event **2 min**, scheduled **5 min**, **3 retries**,
  **5-trigger** chain cap. Don't schedule bots exactly on the hour (congestion →
  timeouts) — offset by a few minutes.
- **Parent-child race:** saving parent+children writes them as *separate sequential
  transactions*, so a bot firing on parent-add may see no children yet. Fix with a
  hidden `AutomationStatus` flag set on the **Form Saved** event, and trigger the
  bot only on `AND([Status]="Run", [_THISROW_BEFORE].[Status]<>"Run")`.
- Use **"Wait for execution to complete"** for mission-critical consistency;
  disable it for faster background response.

### Apps Script ("Call a script" task)
- For what AppSheet can't do: Calendar/Docs/Slides generation, Drive photo
  handling, audit logs, external/ML calls, bulk sheet maintenance.
- **Standalone scripts only** (not container-bound). Always runs the **head
  deployment** and **as the app owner**, regardless of who triggered it.
- **Sync vs async:** async backgrounds the script (faster client) — but use
  synchronous when the app needs the script's output before the sync completes.
- Core plan and up; standard Google Workspace Apps Script quotas apply.

### Scheduled maintenance scripts (protect Sheets)
- **Archiving pipeline:** scheduled script moves rows older than a threshold to an
  archive workbook the app doesn't load — keeps the active DB thin.
- **Blank-row cleanup:** parent deletes (IsAPartOf) leave gaps; a weekly script that
  crops empty rows preserves API quota and used-range scan speed. **Scope it
  tightly** — naive full-workbook scripts time out on large multi-sheet files.
- **Refresh-column pattern:** physical columns don't auto-update when related tables
  change; a hidden numeric column + an increment action (`[col]+1`) forces AppSheet
  to recompute that row's formulas without reverting to a VC. Trigger by button, bot,
  or "execute an action on a set of rows" for many rows.
- **Staging → prod:** "Upgrade app to a new version" copies **config only**, not
  schema/data. Safe flow: replicate new columns/tables into the prod DB → align
  reference data → temporarily repoint staging to prod DB → run App Upgrade in prod
  selecting staging as source → restore staging's dev-DB bindings.
