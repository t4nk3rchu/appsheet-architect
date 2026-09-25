# Google AppSheet Architect & Skill

A comprehensive knowledge base, reference guide, and AI agent skill for designing, auditing, building, and optimizing enterprise-grade **Google AppSheet** applications for **maximum sync speed, robust security, rich UI/UX, and scalability**.

## Install as a Claude Code plugin (skill + AppSheet Copilot tools)

Requires Node.js 18+ on PATH and the AppSheet Copilot Firefox add-on (1.4.0+).

    /plugin marketplace add t4nk3rchu/appsheet-architect
    /plugin install appsheet-architect@appsheet-architect

In Firefox, open the AppSheet Copilot sidebar on your app and set
**Provider → Coding agent (MCP)**. Then ask Claude Code for a change.
To upload just the skill to claude.ai, zip the `skills/appsheet/` folder.

## Install in Antigravity

Requires Node.js 18+ and the AppSheet Copilot Firefox add-on (1.4.0+).

Clone this repo into `~/.gemini/config/plugins/appsheet-architect` (global) or `<your workspace>/.agents/plugins/appsheet-architect`:

    git clone https://github.com/t4nk3rchu/appsheet-architect ~/.gemini/config/plugins/appsheet-architect

With the CLI you can then run:

    agy plugins install appsheet-architect

Restart Antigravity; in Firefox set the sidebar's **Provider → Coding agent (MCP)**. Ask the agent to call `appsheet_get_app`.

If the appsheet-copilot tools don't appear, your Antigravity version may not expand `${extensionPath}`: edit `mcp_config.json` and replace it with the plugin folder's absolute path (e.g. `C:/Users/<you>/.gemini/config/plugins/appsheet-architect/mcp/server.mjs`).

Claude Code and Antigravity sessions share one connection: whichever helper starts first relays for the others.

---

## 📂 Repository Structure

| Path | Description |
| :--- | :--- |
| [`SKILL.md`](./skills/appsheet/SKILL.md) | **Main Agent Entry Point** — Architecture decision matrices, quick formula reference, security boundary definitions, concurrency & missing row prevention, and anti-pattern guides. |
| [`references/expression-reference.md`](./skills/appsheet/references/expression-reference.md) | **Comprehensive Expression & Function Catalog** — Complete syntax, parameter types, behavior notes, and 2+ practical examples for every single AppSheet function (List, Logic, Text, Math, Date/Time, Navigation, and Dereferencing). |
| [`references/advanced-ui-ux-svg-html.md`](./skills/appsheet/references/advanced-ui-ux-svg-html.md) | **Advanced UI/UX, Dynamic SVG & HTML Formatting** — Zero-latency Dynamic SVGs (KPI cards, donut progress bars, rating stars, status badges, timeline steppers), whitelisted HTML tags in `LongText` columns, and performant QuickChart.io visual charts. |
| [`references/database-design-and-sheets.md`](./skills/appsheet/references/database-design-and-sheets.md) | **Database Design & Google Sheets Architecture** — Relational schema modeling, 3-tier denormalization architecture, table width limits, root cause analysis & debugging protocol for multi-user write concurrency / missing rows, and Google Apps Script synergy. |
| [`references/performance-optimization.md`](./skills/appsheet/references/performance-optimization.md) | **Performance, Sync & Scalability** — Sync lifecycle breakdown, heavy compute formula catalog & $O(1)$ fast alternatives, suppressing unwanted `REF_ROWS()` virtual columns via `Enum (Base Type Ref)`, SQL pushdown rules, geocoding tax elimination, and mobile rendering budgets. |
| [`references/data-modeling.md`](./skills/appsheet/references/data-modeling.md) | **Relational Data Modeling** — Primary Key strategies (`UNIQUEID()`), Label configurations, Relational `Ref` vs `Enum` Base Type `Ref`, Virtual Columns vs Physical Columns, Slices, and Server-side Security Filters. |
| [`references/security-and-access.md`](./skills/appsheet/references/security-and-access.md) | **Security, Authentication & Access Control** — Identity providers, true server-side Security Filters vs UI-only Slices/Show_If, Role-Based Access Control (RBAC), column permissions (`Editable_If`, `Show_If`), circular deadlock prevention, and cross-app bot boundaries. |
| [`references/automation-patterns.md`](./skills/appsheet/references/automation-patterns.md) | **Automation, Bots & Webhooks** — Event triggers, Bot tasks (Email notifications, Webhooks, Google Apps Script tasks, PDF/CSV template generation), and template formatting tags. |
| [`references/api-reference.md`](./skills/appsheet/references/api-reference.md) | **REST API v2 Reference** — REST API endpoints, Application Access Keys, payload structures, and CRUD actions (`Add`, `Edit`, `Delete`, `Find`). |
| [`references/extension-changeset.md`](./skills/appsheet/references/extension-changeset.md) | **DOM Automation Changeset Spec** — Strict-JSON changeset specification (`{"changes": [...]}`) for programmatic editor manipulation via the [AppSheet Assistant / Copilot Chrome Extension](https://github.com/t4nk3rchu/appsheet-assistant). |
| [`scripts/parse_appdoc.py`](./scripts/parse_appdoc.py) | **Documentation Export Parser Tool** — Python utility to parse, denoise, and normalize 100k+ line AppSheet Documentation exports (`summary.md`, `app.json`, per-section normalized dumps, VC leaderboards, and workbook write-contention metrics). |

---

## 🚀 Key Capabilities & Architectural Highlights

- **3-Tier Pragmatic Denormalization**: Replace costly multi-hop dereferencing and runtime aggregation scans with write-time snapshotting and event-driven bot rollups.
- **True Security vs Client-Side Filtering**: Enforce server-side multi-tenant isolation via **Security Filters** instead of client-side Slices or `Show_If` rules.
- **Concurrency & Missing Rows Resolution**: Diagnostic and mitigation playbook for Google Sheets multi-user `appendCells` index lag, trailing empty row ghost cells, and key collisions.
- **Dynamic In-Memory SVGs**: Build zero-network-overhead UI elements (status badges, gauges, progress indicators) directly in AppSheet formula definitions.
- **Automated Editor Changesets**: Output machine-executable JSON patches designed to be applied automatically into the AppSheet Web Editor using browser extensions.

---

## 🛠️ Usage

### As an AI Agent Skill

Point your AI assistant (e.g. Antigravity, Claude Code, Cursor, Copilot) to this directory or register `SKILL.md` in your agent skills library. The agent will reference the domain guides when tasked with:
- Writing or refactoring complex AppSheet formulas.
- Designing high-scale relational schemas.
- Investigating slow sync times and mobile CPU bottlenecks.
- Generating browser extension changesets for automated app construction.

### Documentation Export Parser (`parse_appdoc.py`)

For large enterprise apps (100k+ line documentation exports), use the parser to generate audit summaries and metrics:

```bash
python scripts/parse_appdoc.py <path_to_appdoc_export.txt> --out parsed_output/
```

**Generated outputs:**
- `summary.md`: Aggregate counts, Virtual Column leaderboards, workbook write-contention clusters, and view distribution.
- `app.json`: Normalized JSON structure of the entire application.
- `tables.txt`, `columns.txt`, `slices.txt`, `views.txt`, `actions.txt`, `format_rules.txt`: Denoised, section-specific text files.

---

## 📄 License

Original analysis and technical reference architecture. Reuses no proprietary material.
