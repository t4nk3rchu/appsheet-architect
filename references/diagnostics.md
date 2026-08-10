# Diagnostics — the shared knowledge base

The sync/cost model, the anti-pattern catalog, and the hard limits. Every mode
cites this file. Read the section you need.

## Contents
- [1. The sync cost model](#1-the-sync-cost-model)
- [2. What actually makes sync slow (ranked)](#2-what-actually-makes-sync-slow-ranked)
- [3. The Performance Analyzer](#3-the-performance-analyzer)
- [4. Sync levers: caching, delta sync, quick sync, background sync](#4-sync-levers)
- [5. Anti-pattern catalog](#5-anti-pattern-catalog)
- [6. Hard limits and thresholds](#6-hard-limits-and-thresholds)
- [7. Benchmarks for calibration](#7-benchmarks-for-calibration)

Sources are AppSheet Help, the Google Developer forums, and community
practitioners, captured 2024–2026. Where a number is load-bearing, verify it's
current against AppSheet Help before betting a decision on it.

---

## 1. The sync cost model

All table data the user is allowed to see is cached on the device. The app talks
to the **AppSheet server**, which brokers the **cloud provider** (Sheets, SQL,
etc.). Data is compressed server→device.

**Read sync (also initial launch / sync-on-start):**
1. *Client → server → provider*: the server fetches the tables from the provider
   (many tables, possibly many providers).
2. *Server → client*: the server **computes every virtual column**, compresses,
   and returns everything; the device stores it.

**Write sync (when the device has local changes) — writes go first, then a read sync:**
3. *Client → server*: each added/updated/deleted row is sent **in order**, with
   any captured photos/signatures.
4. *Server → provider*: the server writes to the provider; **automations run** and
   typically **re-read the affected rows** before executing.

**API calls** obey the same model: read the table → enforce its security filter →
compute its VCs (including reading every table those VCs reference, enforcing
*their* filters, computing *their* VCs) → run automation → re-write. So API cost
scales with **relational schema complexity**, not just the target table.

**Parallel table fetches are plan-gated** and only help if you have more large
tables than threads — your slowest single table sets the floor:
- Self-service / Starter: **2–3 threads**
- Business / Core: **4–5 threads** (community: Core ≈ 3)
- Enterprise: **up to 10 threads**

Example: three tables, two at 1 s and one at 60 s → the 60 s table dominates and
parallelism changes nothing. Fix the big table, don't buy threads.

---

## 2. What actually makes sync slow (ranked)

1. **Number and size of tables fetched.** "Most often, a long sync time is due to
   the number and size of tables." A single large/slow table gates the whole sync.
2. **Cloud-provider latency** — usually the biggest contributor, *not* the mobile
   network. Databases beat spreadsheets here.
3. **Device↔server network latency** — matters for users far from the AppSheet
   cloud region. The device↔server *data transfer* is rarely the bottleneck
   (each user pulls only a small subset when filters/partitions are used).
4. **Virtual-column computation.** Recomputed for every row on every sync. In the
   Performance Analyzer this is "99 times out of 100" the top cost — but read §3's
   caveat: the time on a *reverse-reference* VC is usually the cost of fetching the
   underlying table, not the relationship. The real compute eaters are your own
   `SELECT`-family VCs.
5. **Spreadsheet in-cell formulas**, recomputed at read time — cross-sheet and
   external-service formulas (e.g. GoogleFinance) are especially damaging.

**The move that keeps recurring:** shift computation from **sync-time** (virtual
columns — every user, every sync) to **edit-time** (physical columns with App
Formulas — once, only the editing user) or to the **backend** (bots / Apps
Script — off the client). See the anti-pattern catalog §5.

---

## 3. The Performance Analyzer

Open: Editor → **Manage → Monitor → Performance Profile → Launch performance
analyzer** (or Admin Console → Performance analyzer). It logs each
sync/add/update/delete/API call with per-step time down to **1–2 ms**.

- It shows recommendations, average duration by operation type, and average
  VC-computation time by app version. Filter by operation, date, failures, table,
  user, rule. Results download as JSON.
- **Uncheck "Standard view"** to reveal hidden/internal contributors — this is how
  you find the `[internal] GeoCodeAddressColumn` geocoding tax (see A/H in §5).
- Richer historical filtering needs **Enterprise Plus**; the default view is a
  limited recent window.
- **Interpretation caveat:** time attributed to a `REF_ROWS()` / reverse-reference
  VC is *usually the table fetch*, not the computation (one 5,000-row parent with
  100–1,000 children/parent computed its reverse-ref list in **0.03 s**). Don't
  delete reverse-refs chasing a cost that's really a fetch. Your own multi-row
  `SELECT`/`FILTER`/`MAXROW` VCs are the genuine compute cost.

**Baseline projection model** (Kirk Masden) for sanity-checking before you
measure: `T_sync ≈ N/3 + (R_max × C_max)/5000` seconds, where N = number of
physical tables (~⅓ s network each), R_max/C_max = rows/columns of the largest
table. E.g. 15 tables, largest 30k×50 → 5 + 300 ≈ **305 s**. Grid volume
dominates → point straight at partitioning + security filters.

---

## 4. Sync levers

Configured in **Settings → Performance** (or legacy Behavior → Offline/Sync).
Most require **Core plan or above**.

- **Server caching** — the server caches read-only tables for **up to 5 minutes**.
  Mark reference/rarely-changing tables Read-Only and enable it. Put read-only
  tables in **their own workbook** so they cache independently and don't reload
  during transactional writes.
- **Delta sync** — per-table last-fetch timestamp; re-fetches a table only if it
  changed. **Google Sheets and AppSheet DB only.** **Ignored for any table with a
  security filter** (that table full-syncs anyway). Can serve **stale VC values**
  when a sheet's own formulas pull external data (the file timestamp may not
  change). *Trick:* set a table's security filter to `TRUE` to force it out of
  delta sync so its VCs refresh every sync, while the rest of the app keeps delta's
  speed.
- **Quick sync** — broadcasts other users' changes in near real-time; **on by
  default for AppSheet DB**. Do **not** use it if the app has advanced security
  filters, a source that auto-computes values (Sheet formulas), or VCs that need a
  complete sync. Supported filters are row-scoped only (`=TRUE`, `[Status]='x'`,
  `[Assigned]=USEREMAIL()`); Ref-hops and table-scoped `SELECT`/`FILTER` are not.
- **Background/deferred sync** — hides latency, doesn't reduce it. *Delayed sync +
  Automatic updates* is the recommended combo for most apps. **A mobile app does
  nothing while minimized** (suspended); a desktop browser tab keeps syncing.
  Force a sync via action on critical entries so offline queues don't strand data.

---

## 5. Anti-pattern catalog

Each entry: the **smell** (what to look for) → why it costs → the **fix**. Grouped;
highest-impact groups first. This is the reference for review mode and for the
"diagnose" step of audit/refactor.

### A. Virtual columns (the dominant sync cost)

- **A1. `SELECT`/`FILTER`/`LOOKUP`/`MAXROW`/`MINROW`/`REF_ROWS` inside a VC.**
  Every VC recomputes for every row on every sync; a scan inside it re-scans
  another table per row, so cost ≈ `rows_in_table × rows_scanned` and grows with
  data. `FILTER`/`LOOKUP`/`MAXROW`/`MINROW` are all `SELECT` under the hood.
  **Fix:** eliminate the scan — dereference a Ref, precompute into a physical
  column, or use a slice + simple aggregate. If an aggregate is unavoidable,
  maintain a physical total via action/bot instead of recomputing live.
- **A2. VC holding a "compute-once" value** (a result that never changes per row —
  a sequence number, a one-time `MAXROW`). It's recomputed every sync for nothing.
  **Fix:** make it a **physical column with an App Formula** — recomputes only when
  the row is edited, not every sync.
- **A3. Too many VCs overall**, many unreferenced by any view/expression. There's a
  significant performance cost to a high VC count; even a trivial VC over 50k rows
  is ~0.5 s and they stack. **Fix:** delete unused VCs; consolidate; compute once
  and reuse.
- **A4. The same complex expression pasted across many VCs/slices/actions/format
  rules.** **Fix (the legitimate VC use):** compute a complex Yes/No **once** in a
  single VC and reference *that* everywhere a condition is needed.
- **A5. Aggregate performance ranking** (for a conditional total): *slice + physical
  column refreshed by action* > *slice + VC `SUM(slice[col])`* >> *single VC with
  `SUM(SELECT(...,AND(...)))`*. The win is removing `SELECT` and moving the
  aggregate off per-sync recompute.

### B. Slice vs virtual column

- **B1. Believing one is universally faster.** For the *same* expression a VC
  formula and a slice row-filter each evaluate once per row per sync — equivalent
  cost. Choose on **structure**, not a myth.
- **B2. Use a SLICE** to reduce a row set for a view/action/aggregate, to reuse one
  filter condition in many places, or to build a **single-row context** (e.g. a
  `Current_User` slice `[Email]=USEREMAIL()`) so downstream logic uses cheap
  `INDEX(slice[col],1)` / `IN(x, slice[col])` instead of `LOOKUP`/`SELECT`.
- **B3. Use a VC** to hold a reusable **scalar** (a computed value or complex
  Yes/No). A slice can't return a scalar; don't create a slice just to dodge a VC.
- **B4. Calendar/Map/Card view over a big slice.** Keep heavy views to **≤1,000
  rows** — more saturates the mobile UI thread (lag, unresponsive touch, OOM).

### C. SELECT / FILTER / LOOKUP / dereference

- **C1. Inefficient filter conditions** — inequality, `OR()`, `MAXROW`/`MINROW`
  inside `SELECT`/`FILTER`. Efficient: equality, `IN()`, `AND()` of equalities
  (these can index / push down). **Fix:** restructure to equality/`IN`/`AND`.
- **C2. Micro-optimizing `SELECT` vs `FILTER`.** No meaningful difference on equal
  row counts (`FILTER` is a `SELECT` that returns keys). Don't waste effort here —
  attack the *condition* (C1) and *where it lives* (A).
- **C3. `LOOKUP()` when a Ref exists.** `LOOKUP ≈ ANY(SELECT(...))`, a per-call
  scan; N parent columns = N scans. **Fix:** dereference `[Ref].[Attr]` — reuses
  the Ref's in-memory index, O(1), and cleaner for multiple attributes.
- **C4. `LOOKUP()` in a format rule / repeated per-row over a big table** (editor
  warns "may cause performance issues"). **Fix:** single-row slice + `INDEX(slice[col],1)`.
- **C5. `ANY(SELECT(...))` vs `INDEX(...,1)`** — equivalent; prefer `INDEX(...,1)`
  as the default habit (better in edge cases, avoids the LOOKUP warning).
- **C7. Heavy expressions in format rules.** "Expressions in format rules should be
  simple — avoid `SELECT` or its derivatives." Reference a precomputed flag or a
  single-row slice value instead.

### D. References and reverse-references

- **D1. Ref whose auto `[Related …]` reverse-reference is never used.** Each is a
  `REF_ROWS()` VC recomputed every sync. **Fix:** where you don't need the reverse
  list, use **Enum / EnumList with Base Type = Ref** — you keep dereferencing and
  store the key, but no reverse-reference VC is generated. *Caveat:* Enum-base-Ref
  **breaks interactive dashboards** (those need a true Ref). And profile first —
  reverse-refs are often cheap (§3).
- **D2. Copying parent values onto child rows as static columns "just in case."**
  They go stale and cost writes. **Fix:** dereference live — *except* values that
  must be frozen at entry (price at time of order), which are stored physically
  (optionally *initialized* by a dereference).
- **D3. Expecting `Is a part of` to cascade updates.** It cascades **deletes only**;
  a table has **one** IsAPartOf ref. **Fix:** propagate parent→child edits via a bot.
- **D4. Ref pointing at a table with a volatile key.** A Ref stores the referenced
  **key value**; if that key changes, the reference silently breaks. Reference
  tables need stable keys (group E).

### E. Keys / UNIQUEID

- **E1. `_RowNumber` as key.** Row numbers shift on insert/delete/sort/concurrent
  edit → wrong row updated, broken refs. Also the *one* case where retried syncs
  can corrupt data. Give every table a stable key.
- **E2. Spreadsheet-formula key.** Not guaranteed unique/constant, **can't compute
  offline**. Use `UNIQUEID()` in **Initial Value**.
- **E3. Editable / mutable natural key (Name, Email).** Keys must be constant for
  the row's life. **Fix:** hidden `UNIQUEID()` key (Initial Value, not editable,
  Hidden) + keep the human field editable with a `Valid_If` uniqueness check + set
  it as the row **Label**.
- **E4. Key generated in App Formula.** App Formula recomputes on **every update**
  → the key drifts → refs break. Key generation belongs in **Initial Value** only
  (computes once at creation).
- **E5. Wrong type as key.** Change types, Color, List, LongText, Progress, Show,
  URL can't be keys. Use Text/UNIQUEID or a natural key.
- **E6. Forcing sequential/gap-free keys offline.** Impossible without server
  coordination → collisions. Use `UNIQUEID()`. For a *sortable* pseudo-sequence:
  `CONCATENATE(RIGHT(("000000" & ([_RowNumber]-1)),7),"-",UNIQUEID())` — never the
  padded `_RowNumber` alone (it repeats).
- **Entropy:** `LEFT(UNIQUEID(),2)` collides ~50% at **~30 rows** (never use);
  `UNIQUEID()` ~1.4M rows (fine to medium scale); `UNIQUEID("UUID")` is the
  distributed/enterprise standard.

### F. Security filters

- **F1. Using a slice instead of a security filter to reduce volume.** Slices
  download **all** rows then filter on-device (no payload cut, no security, RAM
  risk). Security filters run cloud-side and send only matching rows. **Fix:**
  security filter for row-level reduction; slices only for UI segmentation.
- **F2. Non-pushable filter on a DB source** — `OR()`, complex `NOT()`, non-simple
  column use. Only `[Col]=const`, `<`/`>`/`<=`/`>=`, `IN([Col],{consts})`, and
  `AND()` of these push into SQL. Everything else evaluates *after* fetching all
  rows. `IN([Col], SELECT(Other[c], [Email]=USEREMAIL()))` **is** pushable — the
  SELECT resolves to a constant first. (`NOT`/`OR` *do* push on BigQuery and
  AppSheet DB.)
- **F3. Filtering on a non-optimized column type (AppSheet DB).** Address/LatLong,
  Enum, EnumList, Ref, RowId, Yes/No, and `=` on Time are **not optimized**.
  Optimized: Text, LongText, Name, Number, Decimal, Date, DateTime, Duration,
  Email, Percent, Phone, Price, Url. **Fix:** filter on an optimized scalar (e.g.
  an Email/Text owner column), not a Ref/Enum.
- **F4. Security filter referencing a slice built on the SAME table → circular
  deadlock.** The compiler macro-expands the slice into the table's query, so
  building the filter needs to read the table, which needs the filter → infinite
  loop → sync timeout / muted mutation error. **Fix:** inside the filter, query the
  **raw table** directly (`COUNT(SELECT(T[role], AND([email]=USEREMAIL(), ...)))>0`),
  never the slice. Referencing a slice on a *separate* table is fine (linear dep).
  **Rule: never reference a slice inside the security filter of the table it's built on.**
- **F5. Fat permission/role/lookup tables** (carrying VCs or blobs). They're read
  during every dependent table's filter evaluation. Keep them lean and indexable.
- **F6. Expecting a security filter to cut a Google Sheet's fetch time.** The
  **entire worksheet is fetched first**, then filtered — filters help steps 2–3
  (network/storage), not the cloud read. Only real databases push down.

### G. Initial Value vs App Formula

- **G1. App Formula where the value should be set once.** App Formula recomputes on
  every update; Initial Value computes once at creation. Use Initial Value for
  capture-once data (and always for keys, E4).
- **G3. The "App Formula recalculates every sync" myth.** App Formulas on
  **physical** columns recompute on **row edit**, not every sync — that per-sync
  cost is the *virtual* column's. Don't move logic to Initial-Value+reset out of a
  false fear of App Formulas; the real per-sync cost is VCs.

### H. Slow column types

- **H1. `Address` column (hidden geocoding tax).** It spawns a hidden internal VC
  (`[internal] GeoCodeAddressColumn`) that re-geocodes every row every sync via the
  Maps API, even when unchanged — shows under "Compute virtual columns" only after
  you uncheck "Standard view." **Fixes, in order:** (a) if you don't need
  auto-complete/directions, change to **Text/LongText** + a "Go to a website"
  action `CONCATENATE("https://www.google.com/maps/search/?api=1&query=", ENCODEURL([Address]))`;
  (b) toggle geocoding off but keep the Address type to retain auto-complete;
  (c) best — geocode once via backend on create/edit and store a **physical
  LatLong**. Documented win: **40k-row app minutes → ~0.5 s.**

### Cross-cutting priority order
1. Kill `SELECT`-family expressions in VCs and format rules (A1, C7); remove unused
   VCs/reverse-refs (A3, D1).
2. Fix circular security-filter deadlocks (F4); make filters push down on a real DB
   (F1–F3, F6).
3. Remove the hidden Address geocoder on large tables (H1).
4. Move compute-once logic from VCs to physical App-Formula columns; Initial Value
   for keys/capture-once (A2, G1, E4).
5. Dereference over `LOOKUP`; single-row slice + `INDEX` over `LOOKUP` in format
   rules (C3, C4).
6. Stable `UNIQUEID`/natural key on every table (E1–E4).

---

## 6. Hard limits and thresholds

Verify load-bearing numbers against AppSheet Help — several are plan-tiered and
have moved over time.

### App / device (the real ceiling)
- **On-device compressed cache: 5 MB or 10 MB** per app (device-dependent). External
  images/docs not counted. Not precisely calculable by the creator.
- **~100,000 rows per app** — enforced by AppSheet *regardless of backend*. Deploy
  is blocked above this even on a Sheet far under its cell limit.

### Google Sheets
- Guideline **≤100k rows**, **≤1000 columns**. Hard cell limit **20 million cells**
  (docs may still say 10M). Practical pain well before that.
- Sheets API ≈ **300 read + 300 write requests / min / project**; all AppSheet apps
  share one Cloud project (you **cannot** request an increase); creator-access mode
  charges all calls to the owner.

### AppSheet Database (plan-tiered — the classic wall)
- Rows/DB: **1,000** (Free) / **2,500** (Starter & Core) / **200,000** (Enterprise).
  DBs: 5 / 5–10 / ≤200. **20 tables/DB, 100 columns/table**, ~2,000 chars/cell,
  5,000 chars/LongText. Quick sync on by default. **No clean export** (RowIDs are
  stripped → breaks relationships on export); can't cross-reference two DBs;
  bulk delete ≈ **1 s per row**.

### Cloud SQL / SQL Server / MySQL / Postgres
- Millions of rows *if* filters push down. No QPS quota; performance = instance
  spec + query profile. Keys: use `NVARCHAR(8/36)` + `UNIQUEID()` Initial Value,
  **not** IDENTITY (offline clients can't get server keys) — or seed IDENTITY high
  + `RANDBETWEEN`. Use `DATETIME2`. Files store a filename; blobs go to the owner's
  cloud drive. Needs inbound IP access for AppSheet servers.

### BigQuery
- Near-real-time, warehouse scale, Enterprise-only (Advanced Connector). `NOT`/`OR`
  filters push down here. **Still bound by the ~100k-row app read cap** — BQ buys
  freshness and query power, not a higher working-set ceiling.

### Automation / bots
- App-change event execution: **2 min**; scheduled event: **5 min**; **3 retries**
  on timeout; bot chains cap at **5** successive triggers.
- **10 MB** max record processed; **5,000** concurrent bots; **500,000**
  executions/day per owner; **ForEachRow: 10,000 rows** deployed (1,000 prototype);
  external event triggers **20 per table**; run retention **55 days**; daily limits
  reset midnight PST.
- Email recipients: **5/hr, 30/day** (Free) → **25,000/hr, 50,000/day** (Enterprise).
- Intelligent Document Processing: **20 MB**, **5 pages**/doc; PDF 2,500/day @ 20/sec.

### Views
- Keep Calendar/Map/Card views to **≤1,000 rendered rows**.

### Practitioner rules of thumb
- **≤ ~30 data tables per app**; consolidate pick-lists into one master list.
  115 tables in one app is a red flag.
- Migrate Sheets → SQL at **~20k rows/table** or **>50 concurrent syncs** or deep
  multi-table joins forcing monstrous `SELECT`s.

---

## 7. Benchmarks for calibration

Real numbers to sanity-check claims (don't promise these; cite them as precedent):

- **Address geocoder removed: 40k-row app, minutes → ~0.5 s.** Most-cited single win.
- **DB vs Sheets:** same app ~4× faster on a DB (Core plan); edit-a-row ~0.25 s (DB)
  vs ~1 s (Sheets); DB ~3× faster in looping actions.
- **Sept-2023 backend upgrade** cut all syncs 20–30%+ automatically (no action needed);
  did not change the Sheets-vs-DB gap.
- **VC cost:** 5,000 rows × 10 VCs = 50,000 evals/sync; a nested `SELECT` over a 10k
  table on a 10k host ≈ up to 100,000,000 ops/sync.
- **Sheets concurrency:** 10 users × 10 s writes under the workbook lock → last user
  waits ~90 s → timeout. SQL row-level locking avoids this.
- **Pain references:** 1 SQL table, 50k rows, no VCs ≈ 15 s; 100k×27 Sheet, 11–12
  users → 20–30 s launch, 3–4 days to fully sync a 300-task batch.
- **Realistic floor:** apps "never consistently sync below 2 s"; target **3–5 s**.
