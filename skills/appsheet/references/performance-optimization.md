# AppSheet Performance, Sync & Scalability Guide

Comprehensive guide to optimizing Google AppSheet application performance, reducing sync latency, enabling SQL pushdown, designing efficient virtual columns, understanding empirical platform limits, and scaling to hundreds of thousands of records.

---

## Table of Contents
1. [The 4 Sync Lifecycle Phases](#1-the-4-sync-lifecycle-phases)
2. [Security Filter SQL Pushdown](#2-security-filter-sql-pushdown)
3. [Virtual Column Compute Optimization](#3-virtual-column-compute-optimization)
4. [Sync Settings & Caching Strategy](#4-sync-settings--caching-strategy)
5. [Backend Data Source Architecture](#5-backend-data-source-architecture)
6. [Media & Document Asset Optimization](#6-media--document-asset-optimization)
7. [Performance Diagnostics & Audit Analysis](#7-performance-diagnostics--audit-analysis)
8. [Heavy Compute Expressions & High-Performance Alternatives Catalog](#8-heavy-compute-expressions--high-performance-alternatives-catalog)
9. [List Virtual Columns & System-Generated `REF_ROWS()` Optimization (`Enum` Base Type `Ref`)](#9-list-virtual-columns--system-generated-ref_rows-optimization-enum-base-type-ref)
10. [Empirical Hard Limits, Plan-Tiered Thresholds & Sync Duration Projection](#10-empirical-hard-limits-plan-tiered-thresholds--sync-duration-projection)
11. [The Hidden Address Geocoding Tax (`[internal] GeoCodeAddressColumn`)](#11-the-hidden-address-geocoding-tax-internal-geocodeaddresscolumn)
12. [View Rendering Thresholds (Map, Calendar, Card Limits)](#12-view-rendering-thresholds-map-calendar-card-limits)

---

## 1. The 4 Sync Lifecycle Phases

Understanding where latency occurs is critical for optimizing AppSheet applications:

1. **Phase 1: Data Source Read (Cloud DB / Sheets to AppSheet Server):**
   - AppSheet server queries the backend. For spreadsheets, the entire worksheet is read. For SQL databases with pushdown, only filtered rows are retrieved.
2. **Phase 2: Server-Side Computation:**
   - Evaluates App Formulas, Virtual Columns, and complex cross-table calculations across all synced rows.
3. **Phase 3: Network Transfer (AppSheet Server to Client Device):**
   - Serializes and compresses table payloads over HTTPS. Latency depends on payload size (row count x column count).
4. **Phase 4: Client Unpack & Storage (Mobile Device / Browser):**
   - Parses JSON payload, updates HTML5 local database, and updates active UI view components.

---

## 2. Security Filter SQL Pushdown

> [!IMPORTANT]
> **SQL Pushdown is the single most powerful scalability lever in AppSheet.**
> When SQL pushdown succeeds, AppSheet sends a `WHERE` clause directly to the database (Cloud SQL, Postgres, MySQL, BigQuery, SQL Server). The database uses indexes and returns only matching rows.
> When pushdown fails, AppSheet must download the **entire database table** to its servers and filter row-by-row in memory!

### Pushdown Supported Operators & Expressions

AppSheet converts the following expressions into native SQL `WHERE` clauses:

| AppSheet Expression | Translated SQL Equivalent | Pushdown Status |
| :--- | :--- | :--- |
| `[Status] = "Open"` | `WHERE status = 'Open'` | ✅ **Pushed Down** |
| `[Amount] > 100` | `WHERE amount > 100` | ✅ **Pushed Down** |
| `[CreatedAt] >= TODAY() - 30` | `WHERE created_at >= '2026-07-29'` | ✅ **Pushed Down** |
| `IN([Department], {"Sales", "Support"})` | `WHERE department IN ('Sales', 'Support')` | ✅ **Pushed Down** |
| `AND([Status] = "Open", [AssignedTo] = USEREMAIL())` | `WHERE status = 'Open' AND assigned_to = 'user@co.com'` | ✅ **Pushed Down** |
| `IN([DeptID], SELECT(UserDepts[DeptID], [Email] = USEREMAIL()))` | Subquery pre-evaluated on server -> `WHERE dept_id IN (...)` | ✅ **Pushed Down** |

### Expressions that Break SQL Pushdown

Avoid these patterns in Security Filters on large SQL tables:

- ❌ **`OR()` Conditions:** `OR([Status] = "Open", [Owner] = USEREMAIL())` (Breaks pushdown on MySQL/Postgres/SQL Server; supported only on BigQuery & AppSheet DB).
- ❌ **`NOT()` Conditions:** `NOT([Status] = "Archived")` (Often prevents index usage).
- ❌ **Scalar Functions on Columns:** `LEN([PostalCode]) = 5`, `LEFT([Name], 1) = "A"` (AppSheet cannot translate custom functions to SQL).
- ❌ **Column-to-Column Comparisons:** `[StartDate] < [EndDate]` (Forces table scan).

---

## 3. Virtual Column Compute Optimization

### The Quadratic $O(N \times M)$ Computation Trap
Every Virtual Column is evaluated for **every row** in the table during **every sync**:

$$\text{Total Operations} = \text{Rows in Table} \times \text{Virtual Columns} \times \text{Complexity of Formula}$$

* Example: An app with 5,000 orders and 4 virtual columns containing `SELECT()` or `LOOKUP()` against a 10,000-row items table executes:
  $$5,000 \times 4 \times 10,000 = 200,000,000 \text{ operations per sync!}$$
* This leads to 30–60+ second sync freezes and mobile memory crashes.

### Virtual Column Budget Rules
1. **Target $\le 5$ Virtual Columns per Table**: Exceeding 10 virtual columns creates noticeable sync lag on mobile devices.
2. **Never Use `SELECT()` or `LOOKUP()` Inside Virtual Columns**:
   - ❌ `SELECT(Customers[Address], [CustomerID] = [_THISROW].[CustomerID])`
   - ✅ Use direct relational dereferencing: `[CustomerRef].[Address]` (instant $O(1)$ memory lookup).
3. **Move Aggregations to Event Actions / Bots**:
   - Instead of a virtual column `SUM([Related Items][Price])`, use a physical column on the parent table updated by an AppSheet Bot on child row save.

---

## 4. Sync Settings & Caching Strategy

Configure under **Settings > Performance**:

| Setting | Recommendation | Architectural Impact |
| :--- | :--- | :--- |
| **Delta Sync** | **ON** | Only fetches tables modified since last sync. (Requires Google Sheets or AppSheet DB; tables with Security Filters full-sync). |
| **Server Caching** | **ON** for lookup tables | Caches static/read-only tables on AppSheet servers for up to 5 minutes. |
| **Background Sync** | **ON** (Automatic Updates) | Polls for remote changes in background every 30 minutes. |
| **Delayed Sync** | **OFF** for critical audits | Delays sending changes until sync button tapped; turn OFF to prevent offline write queue loss. |

---

## 5. Backend Data Source Architecture

### Google Sheets vs Cloud SQL vs BigQuery

| Characteristic | Google Sheets | AppSheet Database (ASDB) | Cloud SQL (Postgres / MySQL) | BigQuery |
| :--- | :--- | :--- | :--- | :--- |
| **Row Ceiling** | 100k rows (20M cells) | 1,000 (Free) / 2,500 (Core) / 200,000 (Ent) | Millions of rows | Billions of rows |
| **Concurrency** | Workbook-level lock | Row-level locking | Row-level locking (ACID) | High-throughput append |
| **Filtering Location** | After full table read | Native indexed pushdown | Server SQL `WHERE` pushdown | Native indexed pushdown |
| **Sync Speed** | Moderate to Slow | Fast | Very Fast | Fast for reporting |
| **Best Used For** | Rapid prototyping (<10 users) | Built-in apps (<2,500 rows) | Production multi-user apps | Enterprise analytics |

---

## 6. Media & Document Asset Optimization

1. **Image Capture Resolution:** Set Image column setting **Image upload size** to `Low` or `Medium` (reduces image from 12MB to 300KB).
2. **Cloud Object Storage:** Store images in Google Cloud Storage or AWS S3 instead of Google Drive for enterprise throughput.
3. **Lazy-Load PDF Generation:** Generate PDFs asynchronously using Bot webhook tasks rather than blocking client syncs.

---

## 7. Performance Diagnostics & Audit Analysis

Use **Manage > Monitor > Performance Profile > Launch Performance Analyzer**:
- **Uncheck "Standard view":** Exposes hidden internal steps (e.g. `[internal] GeoCodeAddressColumn`).
- **Measure Step Duration:** Pinpoint whether time is spent in *Data Source Read* (backend), *Compute Virtual Columns* (expressions), or *Network Transfer*.

---

## 8. Heavy Compute Expressions & High-Performance Alternatives Catalog

### Catalog of Heavy Expressions vs $O(1)$ Alternatives

| Heavy Formula Pattern | Latency Bottleneck | Fast Alternative Architecture | Speedup |
| :--- | :--- | :--- | :--- |
| `MAXROW("Log", "Timestamp", [AssetID] = [_THISROW].[AssetID])` | Scans entire Log table for every parent row on every sync ($O(N \times M)$) | Physical `LatestLogRef` column on Parent updated by Bot on Log Add | **$100\times$ faster** ($O(1)$ pointer read) |
| `LOOKUP([CustomerID], "Customers", "ID", "Email")` when `Ref` exists | Linear scan of Customers table per row | Direct dereference: `[CustomerRef].[Email]` | **$50\times$ faster** (direct index) |
| `SUM(SELECT(Items[Price], [OrderID] = [_THISROW].[OrderID]))` | Full table scan for each order | Reverse-Ref dereference: `SUM([Related Items][Price])` | **$50\times$ faster** |
| Repeated `LOOKUP(USEREMAIL(), "Users", "Email", "Role")` in Format Rules | Evaluated for every visible row on screen | 1-row Slice (`Current_User`): `INDEX(Current_User[Role], 1)` | Instant memory read |
| `ORDERBY(SELECT(...), ...)` in Virtual Column | In-memory sorting of full table per row | Use Slice with pre-configured View Sort Order | Eliminates CPU throttle |
| Deep 5-hop Dereference: `[A].[B].[C].[D].[Target]` | Cascading relational pointer dereference | Write-time snapshot in physical column on creation | $O(1)$ static read |

### Detailed Heavy Expression Analysis & Refactoring Guide:

#### 1. `MAXROW()` and `MINROW()` Full-Table Scanning
- **The Problem:** Placing `MAXROW("Inspections", "Date", [AssetID] = [_THISROW].[AssetID])` in a Virtual Column forces AppSheet to filter and sort the entire `Inspections` table for every single `Asset` on every sync ($O(N \times M)$ complexity).
- **The Fix:** Create a physical `Ref` column `[LatestInspection]` on `Assets`. When a new inspection row is added, trigger an AppSheet Bot action that sets `[Assets].[LatestInspection]` to the new inspection's ID.

#### 2. Repeated `LOOKUP()` Scans
- **The Problem:** Using `LOOKUP([CustomerID], "Customers", "ID", "Email")` when a relational `Ref` column exists forces a full linear scan of `Customers`.
- **The Fix:** Use dereferencing: `[CustomerRef].[Email]`, which accesses the indexed memory pointer directly.

#### 3. Deep Dereferencing Chains
- **The Problem:** 4- or 5-hop dereferencing chains (`[InvoiceRef].[OrderRef].[ContractRef].[CustomerRef].[BillingAddress]`) force multi-level pointer resolution on every row recalculation.
- **The Fix:** Snapshot point-in-time values at creation time using `Initial Value` in a physical column on the child table.

---

## 9. List Virtual Columns & System-Generated `REF_ROWS()` Optimization (`Enum` Base Type `Ref`)

### The Hidden Overhead of Automatic `REF_ROWS()` Virtual Columns
When a column of type **`Ref`** is created on a child table (e.g. `Tasks[AssignedTo]` $\to$ `Users[UserID]`), AppSheet **automatically generates a system Virtual Column on the parent table**:
```appsheet
// System Virtual Column [Related Tasks] on Users table:
REF_ROWS("Tasks", "AssignedTo")
```
If your application has 15 different tables referencing the `Users` master table, `Users` receives **15 automatic Virtual Columns**, each computing dynamic list arrays for every single row on every sync!

```
+----------------------------------------------------------------------------------------------------+
|                         REF vs ENUM (BASE TYPE REF) ARCHITECTURAL MATRIX                           |
+----------------------------------------------------------------------------------------------------+
| Feature / Behavior             | Native Ref Column                | Enum (Base Type Ref)           |
+--------------------------------+----------------------------------+--------------------------------+
| Dropdown Selection & Validation| ✅ Native picker & Valid_If      | ✅ Native picker & Valid_If    |
| Direct Dereference ([Ref].[Col])| ✅ YES ([AssignedTo].[Phone])    | ✅ YES ([AssignedTo].[Phone])  |
| Auto-generates [Related ...] VC| ⚠️ YES (Generates on Parent)     | 🚀 NO (Suppressed entirely!)   |
| Embedded Parent-Child Form     | ✅ Supported (IsPartOf = TRUE)   | ❌ Not supported for nesting   |
| Interactive Dashboards         | ✅ Supported                     | ❌ Breaks dashboard linking    |
| Best Used For                  | True Parent-Child transactions   | Lookup, Tagging & Utility Refs |
+----------------------------------------------------------------------------------------------------+
```

### Pro-Developer Pattern: `Enum` with Base Type `Ref`
Configure utility reference columns (`CreatedBy`, `StatusRef`, `CategoryRef`) as:
1. **Type:** `Enum` (or `EnumList` for multiple items).
2. **Base Type:** `Ref`.
3. **Referenced Table:** Target master table.

*Caveat:* Use native `Ref` when you need **Interactive Dashboard Cross-Filtering** or embedded parent-child forms (`IsPartOf = TRUE`).

---

## 10. Empirical Hard Limits, Plan-Tiered Thresholds & Sync Duration Projection

### Platform Thresholds & Hard Limits

| Resource / Layer | Hard Limit / Threshold | Architectural Consequence |
| :--- | :--- | :--- |
| **Client Device Compressed Cache** | **5 MB or 10 MB** (device-dependent) | Total local database ceiling; images/files stored separately. |
| **Total Rows Per App** | **~100,000 rows** | Hard platform ceiling across **all backends** (even BigQuery). |
| **Parallel Fetch Threads** | Starter: **2–3**, Core: **3–5**, Enterprise: **up to 10** | Slowest single table gates sync duration regardless of thread count. |
| **AppSheet Database (ASDB) Caps** | Free: **1,000**, Core: **2,500**, Ent: **200,000** rows | 2,500 rows is the classic wall; bulk delete takes ~1s/row; RowIDs stripped on export. |
| **Google Sheets API Rate Limit** | **300 read + 300 write requests / min / project** | All apps under the owner account share quota; cannot be increased. |
| **Automation / Bot Execution Time** | App-change: **2 min**, Scheduled: **5 min** | 3 retries on timeout; bot trigger depth capped at 5 successive levels. |
| **Bot `ForEachRow` Capacity** | **10,000 rows** (Deployed), **1,000 rows** (Prototype) | Chunk larger batch migrations into scheduled intervals. |

### Kirk Masden Sync Duration Projection Model
For sanity-checking expected sync times before measuring:

$$T_{\text{sync}} \approx \frac{N}{3} + \frac{R_{\max} \times C_{\max}}{5000} \text{ seconds}$$

Where:
- $N$ = Number of physical tables (each incurs ~$\frac{1}{3}$ second network round-trip).
- $R_{\max}$ = Row count of the largest table.
- $C_{\max}$ = Column count of the largest table.

*Example:* An app with 15 tables whose largest table is $30,000 \text{ rows} \times 50 \text{ columns}$:
$$T_{\text{sync}} \approx \frac{15}{3} + \frac{30,000 \times 50}{5000} = 5 + 300 = \mathbf{305 \text{ seconds (5+ minutes!)}}$$
*Diagnosis:* Grid volume dominates; immediately apply **Security Filters** or migrate to **Cloud SQL**.

---

## 11. The Hidden Address Geocoding Tax (`[internal] GeoCodeAddressColumn`)

When a column is typed as **`Address`** on a table with thousands of rows:
- AppSheet spawns an internal hidden virtual column: `[internal] GeoCodeAddressColumn`.
- On **every sync**, AppSheet re-geocodes every row via the Google Maps API, even if the address has not changed!
- **Symptom:** App shows massive latency under "Compute virtual columns" only when unchecking "Standard view" in the Performance Profile.

### Solutions (Documented Win: 40k-row sync reduced from minutes to ~0.5s):
1. **Change to `Text` / `LongText`:** If auto-complete is not needed, change type to `Text` and add a "Go to website" Action:
   ```appsheet
   CONCATENATE("https://www.google.com/maps/search/?api=1&query=", ENCODEURL([Address]))
   ```
2. **Turn Off Geocoding in Column Settings:** Keep `Address` type for auto-complete but disable automatic geocoding.
3. **Backend Geocode to Physical `LatLong`:** Compute coordinates once on row creation/edit via Apps Script/Bot and store in a physical `LatLong` column.

---

## 12. View Rendering Thresholds (Map, Calendar, Card Limits)

* **$\le 1,000$ Rendered Rows Limit:** Keep heavy graphic views (Map, Calendar, Card, Deck with high-res photos) to **$\le 1,000$ rows**.
* **Failure Mode:** Rendering $>1,000$ map pins or calendar events saturates the mobile device UI thread, causing severe frame drops, unresponsive touch interactions, and Out-Of-Memory (OOM) crashes.
* **Architectural Fix:** Always point Map and Calendar views at a **date-scoped Slice** (e.g. `[EventDate] >= TODAY() - 7 AND [EventDate] <= TODAY() + 30`).
