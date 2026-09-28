---
name: appsheet
description: Use when building Google AppSheet applications, writing expressions (SELECT, LOOKUP, IFS, REF_ROWS, FILTER, USEREMAIL, CONTEXT, dereferencing), configuring automations, bots, or webhooks, designing relational schemas (Refs, Keys, Labels, Virtual Columns, Slices), implementing security boundaries (Security Filters, RBAC, column permissions), designing rich UI/UX with Dynamic SVGs, HTML formatting in LongText, and QuickChart, optimizing sync performance (heavy compute formula alternatives, Enum base type Ref to suppress REF_ROWS, 3-tier denormalization, SQL pushdown, compute budgets, delta sync, Address geocoding tax), troubleshooting Google Sheets concurrency and missing rows, generating browser extension changesets for DOM automation, or integrating via the AppSheet REST API
---

# Google AppSheet

## Overview
Google AppSheet is a no-code development platform for creating web and mobile applications from spreadsheet and database backends (Google Sheets, Cloud SQL, BigQuery, Excel). Core mechanics center around relational schema definition, reactive expression formulas, server-side security boundaries, client-side dynamic UI (HTML/SVG), sync performance optimization, event-driven automation bots, and automated DOM changesets.

## When to Use
Use this skill when:
- Writing or debugging AppSheet expressions (`SELECT`, `LOOKUP`, `IFS`, `REF_ROWS`, `FILTER`, `USEREMAIL`, `CONTEXT`, dereferencing)
- Refactoring heavy compute formulas (`MAXROW`, nested `SELECT`, deep dereferencing) into performant $O(1)$ alternatives
- Designing relational tables, primary keys (`UNIQUEID()` for transactions, `Email` for Workspace `Users`), labels, and `Ref` vs `Enum (Base Type Ref)` columns
- Implementing the 3-Tier Pragmatic Denormalization architecture (Write-Time Snapshots, Event-Driven Bot Rollups, Slice Projections)
- Designing rich UI/UX using supported HTML tags in `LongText` columns (whitelisted tags vs stripped CSS), zero-latency Dynamic SVGs (KPI cards, radial progress gauges, rating stars, status badges), and QuickChart.io
- Investigating backend concurrency issues (e.g., missing rows during concurrent multi-user submissions in Google Sheets)
- Auditing large app configurations using the Documentation Export Parser (`scripts/parse_appdoc.py`)
- Emitting machine-executable structural changesets for the **AppSheet Copilot / Assistant** Chrome extension (`references/extension-changeset.md`)
- Deciding between Virtual Columns, Physical Columns, Slices, and Security Filters
- Implementing security boundaries (Security Filters vs Slices vs Show_If), Role-Based Access Control (RBAC), and anti-deadlock rules
- Optimizing sync speed, SQL pushdown for database sources, virtual column compute budgets, delta sync, and eliminating hidden costs (e.g. `Address` geocoding tax)
- Configuring Automation Bots (Data change events, scheduled reports, webhook notifications, Google Apps Script tasks, template generation)
- Integrating external services via the AppSheet REST API v2 (`/Action`, `Add`, `Edit`, `Delete`, `Find`)

When NOT to use:
- Generic Google Apps Script projects with no AppSheet app interaction
- Direct SQL migrations or database administration outside of AppSheet table schemas

## Quick Reference & Formula Cheat Sheet

| Task | Syntax | Example |
| :--- | :--- | :--- |
| **Filter Rows** | `SELECT(Table[Column], [Condition], [DistinctOnly])` | `SELECT(Orders[OrderID], [Status] = "Open")` |
| **Single Lookup** | `LOOKUP(Value, Table, LookupColumn, ResultColumn)` | `LOOKUP([CustomerID], "Customers", "CustomerID", "Email")` |
| **Dereference (Parent)** | `[RefColumn].[TargetColumn]` | `[CustomerRef].[BillingAddress]` |
| **Parent-Child Link** | `REF_ROWS("ChildTable", "ParentRefColumn")` | `REF_ROWS("OrderDetails", "OrderID")` |
| **Filter Row Keys** | `FILTER("Table", [Condition])` | `FILTER("Tasks", [Status] = "Pending")` |
| **Branching Logic** | `IFS(cond1, res1, cond2, res2, TRUE, default)` | `IFS([Score] >= 90, "A", [Score] >= 80, "B", TRUE, "C")` |
| **User Email** | `USEREMAIL()` | `[AssignedTo] = USEREMAIL()` |
| **View / Context** | `CONTEXT("View")` / `CONTEXT("ViewType")` | `CONTEXT("ViewType") = "Form"` |
| **State Transition** | `[_THISROW_BEFORE].[Col] <> [_THISROW_AFTER].[Col]` | `[_THISROW_BEFORE].[Status] <> "Done"` |
| **Primary Key ID** | `UNIQUEID()` (Initial Value) | `UNIQUEID()` |
| **Dynamic SVG** | `CONCATENATE("data:image/svg+xml;utf8,<svg ...", ... , "</svg>")` | ⚠️ Use single quotes everywhere inside the SVG, and write `' "` (with a space), never `'"`, before a comma: `"fill=' ", [Color], "'/>"`. See the UI/UX Guide. |
| **Sync Projection** | $T_{\text{sync}} \approx N/3 + (R_{\max} \times C_{\max})/5000$ seconds | Quick baseline estimate |

## Architecture & Decision Guides

### Security Boundary: Security Filter vs Slice vs Show_If
| Mechanism | Evaluation Layer | Data Downloaded to Device? | Security Boundary? | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Security Filter** | **Server / Cloud DB** | ❌ NO | ✅ **TRUE SECURITY** | Multi-tenant isolation, confidential records, sync reduction |
| **Slice** | **Client Device** | ✅ YES (all rows downloaded) | ❌ **UI ONLY** | Tab views, stage filtering, subset workflows |
| **Show_If / Hide** | **Client Device** | ✅ YES (column in memory) | ❌ **UI ONLY** | Form layout, conditional inputs |

### Heavy Compute Formulas vs Fast Alternatives
| Heavy Formula | Bottleneck | Fast Alternative | Performance Gain |
| :--- | :--- | :--- | :--- |
| `MAXROW("History", "Time", [ID] = [_THISROW].[ID])` in Virtual Column | $O(N \times M)$ scan per row on every sync | Physical `LatestRef` column updated by Bot on Row Add | **$100\times$ faster** ($O(1)$ pointer read) |
| `SUM(SELECT(Items[Total], [OrderID] = [_THISROW].[OrderID]))` | Full table scan per row | Reverse-Ref dereference: `SUM([Related Items][Total])` | **$50\times$ faster** (uses internal pointer array) |
| Repeated `LOOKUP(USEREMAIL(), "Users", "Email", "Role")` | Linear scan on every rule evaluation | `INDEX(Current_User[Role], 1)` on 1-row Slice | Instant in-memory cache read |
| `ORDERBY(SELECT(...))` inside formula | In-memory sort on every recalculation | Use Slice with native sort order | Reduces mobile CPU throttling |
| Native `Ref` on 15 child tables | Auto-generates 15 `REF_ROWS()` VCs on Parent | Use `Enum` (Base Type: `Ref`) for utility links | Suppresses unwanted VCs; saves sync memory |

### Google Sheets Multi-User Concurrency & Missing Rows Prevention
| Root Cause of Missing Rows | Mechanism | Required Fix |
| :--- | :--- | :--- |
| **Premature Browser/App Closure** | Offline sync queue in IndexedDB dropped before sending | Turn OFF `Delayed Sync`; wait for sync spinner |
| **API `appendCells` Index Lag** | Google Sheets lacks row-level ACID write locks | For >10 concurrent active field writers, migrate to **Cloud SQL** |
| **Ghost Cells in Trailing Grid Rows** | Formulas/borders in empty rows fool AppSheet to write at row 1000+ | Delete empty rows; use `ARRAYFORMULA` in Row 1 only |
| **Post-Write Security Filter Mismatch** | Row written to Sheet but filtered out from app view by filter | Verify table Security Filter criteria |
| **Key Collisions from `=MAX()+1`** | 2 users get same ID; 2nd user overwrites 1st user | Set Primary Key `Initial Value` strictly to **`UNIQUEID()`** |

## Common Mistakes & Anti-Patterns

### 1. Relying on Slices or Show_If for Security (Data Leak)
- ❌ **Wrong:** Filtering confidential salary records using a Slice or `Show_If` formula (data is still downloaded to device HTML5 storage and inspectable).
- ✅ **Right:** Apply a server-side **Security Filter** on the table (`[EmployeeEmail] = USEREMAIL()` or `LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "HR_Admin"`).

### 2. Using `LOOKUP()` instead of Dereferencing
- ❌ **Wrong:** `LOOKUP([CustomerRef], "Customers", "CustomerID", "Email")` (causes extra table scan)
- ✅ **Right:** `[CustomerRef].[Email]` (uses pre-built relational index instantly)

### 3. Circular Security Filter Deadlock (Anti-Pattern F4)
- ❌ **Wrong:** Referencing a Slice inside the Security Filter of the same table (`IN([ID], ActiveSlice[ID])`) $\to$ causes recursive macro-expansion compiler loop and 120s sync timeout.
- ✅ **Right:** Reference the physical column condition directly in the Security Filter (`[Status] = "Active"`).

### 4. Hidden Address Geocoding Tax (Anti-Pattern H1)
- ❌ **Wrong:** Leaving columns as `Address` on 10k+ row tables (triggers hidden `[internal] GeoCodeAddressColumn` that re-geocodes every row on every sync).
- ✅ **Right:** Convert to `Text` with a Maps URL Action or pre-compute `LatLong` once on write.

### 5. Breaking SQL Pushdown in Security Filters
- ❌ **Wrong:** `OR([Status] = "Active", LEN([Title]) > 10)` in SQL security filters (forces AppSheet to fetch millions of rows and filter in memory).
- ✅ **Right:** Use pushdown-compatible expressions: `AND([Status] = "Active", [AssignedTo] = USEREMAIL())`.

## Reference Guides & Tools

For complete specifications, syntax details, tools, and real-world examples, consult the dedicated files in this skill:

- [Expression & Function Reference](references/expression-reference.md) — Comprehensive syntax and 2+ real-world examples for every single function (List, Logic, Text, Math, Date/Time, Navigation), type operations, and dereferencing syntax (`[Ref].[Col]`).
- [Advanced UI/UX, Dynamic SVG & HTML](references/advanced-ui-ux-svg-html.md) — Supported HTML formatting in `LongText` columns (whitelisted tags vs stripped inline CSS), zero-latency Dynamic SVG templates (KPI cards, donut progress gauges, rating stars, status badges, steppers), Do's & Don'ts, and performant QuickChart.io integration.
- [Database Design, Schema Architecture & Google Sheets Synergy](references/database-design-and-sheets.md) — Relational schema modeling, 3-tier denormalization architecture, table width limits, root cause analysis & debugging protocol for missing rows in Google Sheets multi-user concurrency, and Google Apps Script automation.
- [Performance, Sync & Scalability Guide](references/performance-optimization.md) — Sync lifecycle breakdown, heavy compute expression catalog & fast alternatives, `Enum (Base Type Ref)` optimization to suppress `REF_ROWS()` virtual columns, SQL pushdown rules, empirical plan thresholds, Address geocoding tax, and view rendering limits.
- [AppSheet Copilot & Assistant Extension Changeset Spec](references/extension-changeset.md) — Strict-JSON changeset specification (`{"changes": [...]}`) for programmatic DOM automation via the AppSheet Assistant / Copilot Chrome extension.
- [Documentation Export Parser Tool](scripts/parse_appdoc.py) — Python script to parse, denoise, and analyze 100k+ line AppSheet Documentation exports (`summary.md`, `app.json`, VC leaderboards, workbook write-contention indicators).
- [Data Modeling & Architecture](references/data-modeling.md) — Relational schema design, Key vs Label rules, Ref columns vs Enum Base Type Ref, Virtual Columns, Slices, and Security Filters.
- [Security, Authentication & Access Control](references/security-and-access.md) — Authentication providers, Server-side Security Filters, Role-Based Access Control (RBAC), column permissions (`Editable_If`, `Show_If`), circular deadlock prevention, and cross-app bot execution boundaries.
- [Automation, Bots & Webhooks](references/automation-patterns.md) — Event triggers, bot tasks (Email, Webhook, Apps Script, PDF/CSV generation), and template formatting tags.
- [REST API v2 Reference](references/api-reference.md) — REST API v2 endpoints, Application Access Keys, and JSON payloads for CRUD actions.

## Working with the AppSheet Copilot add-on (appsheet_* tools)

When the `appsheet_get_app`, `appsheet_stage_changeset`, `appsheet_build` and
`appsheet_get_build_result` tools are available, the user has the AppSheet Copilot
Firefox add-on open on their app. Then:

1. Call `appsheet_get_app` first. Use only the table, column, view, slice, action,
   format-rule and bot names it returns — never invent names. Keep its `appId`.
2. Write the changeset exactly per `references/extension-changeset.md`.
3. Call `appsheet_stage_changeset` with `appId` and the `changes` array. If it
   reports issues, fix them and stage again.
4. Tell the user what you staged. Call `appsheet_build` only if they asked you to
   build; otherwise ask them to review it in the sidebar and click Build now.
5. After a build, read the per-change results (or `appsheet_get_build_result`),
   fix failures by staging again, and always remind the user that nothing is
   saved until they click **Save** in the AppSheet editor.

If a tool says the sidebar isn't connected, ask the user to open the AppSheet
Copilot sidebar in Firefox and set Provider → Coding agent (MCP).
