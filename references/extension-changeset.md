# AppSheet Assistant — Changeset JSON spec & usage

This extension applies **structural** changes to an AppSheet app by driving the
editor UI (DOM automation), something the AppSheet API cannot do. You describe
the changes as a **strict-JSON changeset**; the extension validates it against
the live schema, then replays it into the editor. **Nothing is saved until the
user clicks Save in the AppSheet editor.**

This document lets another agent produce a changeset that the extension accepts.

---

## Output contract

Return **one** JSON object, no markdown fences, no prose:

```json
{ "changes": [ { "op": "...", "...": "..." } ] }
```

- `changes` is an ordered array; ops apply top-to-bottom (create dependencies first).
- Use table/column/view/action names **exactly** as they exist in the app schema — never invent, shorten, pluralize, or re-case them. If a needed name is missing, return `{"changes": []}`.
- Expression fields are raw AppSheet expressions with `[Column]` refs; **do not** prefix with `=`.
- Text literals inside expressions/displayName must be double-quoted (AppSheet parses `/ - * + ( ) , < > =` as operators).
- Switch fields (`showIf`/`editableIf`/`requireIf`/`resetIf`) are `"true"`, `"false"`, or a boolean expression string.
- NEVER create virtual columns implicitly — use `add_virtual_column` only when the user explicitly wants a new computed column; otherwise set an App formula on an existing column via `set_column`.

---

## Ops & fields

### `set_column` — edit an existing column
Required: `table`, `column` (must exist). Optional:
`type`, `baseType`, `referencedTable`, `enumerationList`, `properties`, `appFormula`, `initialValue`, `suggestedValues`, `validIf`, `displayName`, `showIf`, `editableIf`, `requireIf`, `resetIf`.
- **Ref**: `type:"Ref"` + `referencedTable:"OtherTable"`.
- **Enum/EnumList of Refs**: `type:"Enum"` (or `"EnumList"`) + `baseType:"Ref"` + `referencedTable`. Filter selectable rows with `validIf`, e.g. `SELECT(SKUS[sku_id], [status]="active")`.
- **Enum/EnumList with a fixed value list** (the common case): `type:"Enum"` (or `"EnumList"`) + `enumerationList` — an **array of strings** written into the column's Type Details "Values" list, e.g. `"enumerationList": ["Pending", "Approved", "Rejected"]`.

> **`enumerationList` vs `suggestedValues` — prefer `enumerationList`.**
> For a column that should hold one of a known, fixed set of options, use `enumerationList`. It sets the actual Enum **Values** list, so the app renders a real dropdown/buttons control bound to those options.
> `suggestedValues` is a *different* mechanism — an AppSheet **expression** returning a dynamic list, shown only as soft autocomplete hints on a Text-like column; it does **not** make the column an Enum and does **not** constrain input.
> Only use `suggestedValues` when the user explicitly asks for dynamic/expression-driven suggestions, or the option set genuinely must be computed at runtime. If unsure which the user wants, **ask before writing the changeset** — do not silently pick `suggestedValues`.

### `add_virtual_column` — new computed column
Required: `table`, `name` (no spaces, unique in table), `type`. Should set `appFormula` (its whole purpose). Optional: `validIf`, `showIf`, `displayName`, `baseType`, `referencedTable`, `enumerationList`, `properties`.
- The app auto-detects Type from the formula, so the engine sets the formula first then the explicit Type — you just supply both.
- `enumerationList` (array of strings) works here too for Enum/EnumList VCs with a fixed value list — same preference over `suggestedValues` as in `set_column` above.

### `set_table` — table-level settings
Required: `table`. Optional: `dataFilter` (row-level security filter), `updateModeExpression` ("are updates allowed" — `TRUE` = editable, `FALSE` = read-only).

### `add_view` / `set_view`
`add_view` **requires** `name`, `viewType`, **and** `table` (the "For this data" source — a table **or a slice**) — **except dashboards** (which have no "For this data", so omit `table`). `set_view` **requires** `view` = the **exact, already-existing** view name (verify it against the live app; a wrong/nonexistent name fails with "Không mở được view / can't open view" and the change is dropped — auto-generated views are usually named after the **view**, which may differ from the table name). Optional: `position`, `groupAggregate`, `showIf`, `displayName`, `icon`, `sortBy`, `groupBy`, plus the view-type-specific fields below and the `properties` escape-hatch.
- `viewType`: `table | deck | gallery | detail | map | calendar | chart | dashboard | form | onboarding | card`
- `position`: `left most | left | center | right | right most | menu | ref`

> **`position:"ref"` hijacks Ref column navigation — choose one of three patterns.**
>
> AppSheet assigns **every `position:"ref"` view on a table** as the default drill-through target for Ref columns pointing to that table — replacing the system-generated detail view. Adding a secondary view (chart, filtered report, role-specific layout) at `position:"ref"` silently breaks all Ref navigation for that table.
>
> Pick the right pattern based on user intent:
>
> **Pattern A — Replace the system view** (user explicitly wants a different default detail):
> Use `position:"ref"`. The new view becomes the Ref drill-through for that table everywhere in the app.
>
> **Pattern B — Secondary nav view** (appears in the left nav / menu, visible to the user, but shouldn't hijack Ref):
> Use `position:"menu"` and guard with `showIf`:
> - Hide from nav but embeddable in dashboards: `"showIf": "false"`
> - Show only when inside a detail drill: `"showIf": "CONTEXT(\"ViewType\") = \"detail\""`
> - Show only from a specific parent view: `"showIf": "CONTEXT(\"View\") = \"Trang chủ\""`
> - Show only for a role: `"showIf": "USERROLE() = \"Admin\""`
>
> **Pattern C — Dashboard/chart child view that should not appear in nav at all** (cleanest):
> Create a **no-filter slice** on the table, name it descriptively (e.g. `CHART_CHI_PHI_VT`), and bind the view to the slice instead of the base table. Because the data source is a slice name (not the base table name), AppSheet will not treat it as a Ref navigation target. No `showIf` gymnastics needed; the view is invisible to nav by default.
> ```json
> { "op": "add_slice", "table": "CHI_TIẾT_PHIẾU_KHO", "name": "CHART_CHI_PHI_VT" },
> { "op": "add_view", "name": "BC_Chi phí vật tư", "table": "CHART_CHI_PHI_VT",
>   "viewType": "chart", "position": "ref", "chartType": "Col Series", "chartColumns": ["thành_tiền"] }
> ```
> **Decision tree:** user wants a dashboard child view or chart on a table that already has a system view → **Pattern C** (slice). User wants a conditional/role-gated nav item → **Pattern B** (menu + showIf). User wants to replace the default Ref drill-through → **Pattern A** (ref).

- `sortBy`/`groupBy`: array of `{ "column": "col", "order": "Ascending" | "Descending" }` (default Ascending). On `set_view` these **append**.

> **`groupBy` / `groupAggregate` are for `table` and `deck` views only — NOT charts.** They group rows and show an aggregate in the group header (`groupAggregate`: `SUM | AVERAGE | COUNT | MIN | MAX | …`, under the view's "View Options"). A **chart** has no "Group by" field — putting `groupBy`/`groupAggregate` on a chart is silently skipped ("Field chưa vào (kiểm tay)"). A chart aggregates via its **chart type** (see below), not `groupBy`.

**Dashboard** (`viewType:"dashboard"`) — a container of other views. Omit `table`. Set its embedded views with:
- `viewEntries`: array of `{ "view": "ExistingViewName", "size": "Large" | "Wide" | "Tall" | "Small" }` (or bare `"ViewName"` strings). Create any child views earlier in the same `changes` array. On `set_view`, entries **append**.

**Chart** (`viewType:"chart"`) — **required**: `chartType` + `chartColumns`. Optional: `sortBy`, `properties`. **A chart has NO `groupBy`/`groupAggregate`** (see the box above) — do not emit them on a chart.

- `chartType`: use the **exact** AppSheet label (not "pie"/"bar"). `chartColumns` is filtered by chart type — pick the right column type or the entry is dropped. How each type aggregates:

| `chartType` (exact) | What `chartColumns` must be | How it aggregates | Notes |
|---|---|---|---|
| `Histogram` | 1 **categorical** col (Enum/Text/Ref/Date/Yes-No) | **Counts** occurrences per category | Vertical bars |
| `Horizontal Histogram` | 1 **categorical** col | Counts per category | Horizontal bars |
| `PieChart` | 1 **categorical** col | Counts per category (proportion) | |
| `DonutChart` | 1 **categorical** col | Counts per category | |
| `Aggregate PieChart` | 1 **categorical** col to group by | **Aggregates a numeric** column per category (the only pie/donut that sums a value, not counts) | Set the aggregated column + function in the editor / `properties` |
| `Aggregate DonutChart` | 1 **categorical** col to group by | Aggregates a numeric column per category | |
| `Col Series` / `Col Series [Stack]` / `Col Series [Line]` | 1+ **Number** cols (Number/Decimal/Price/Percent) | **Per-row, NOT aggregated** — one bar/point per row, X-axis = the row's label column | Vertical bars |
| `Row Series` / `Row Series [Stack]` / `Row Series [Line]` | 1+ **Number** cols | Per-row, not aggregated | Horizontal bars |
| `Scatter Plot` | 2 **Number** cols (x, y) | Per-row point | |

- **Aggregating across rows** (the common "TOTAL of X by category Y" report): only the **Aggregate Pie/Donut** chart types sum a value per category. `Col Series`/`Row Series` plot **one bar per row** and do **not** sum — for summed bars by category, point the chart at a **slice or summary table that is already one row per category** (pre-aggregate the data), or use a **grouped `table`/`deck` view with `groupAggregate: "SUM"`** instead of a chart. Do **not** try to fake it with `groupBy` on a `Col Series` — that field does not exist.
- Other chart props (`Chart colors`, `Trend line`, `Show legend`, aggregate function/column) → `properties` (exact editor labels).

**Table** (`viewType:"table"`), which columns show:
- `columnOrder`: `"automatic" | "manual"`.
- `viewColumns`: array of existing column names to show (implies `manual`; only the listed columns are shown, the rest hidden). *Reordering is not yet supported — the array order does not change display order.*

**Any view property** (any view type) not covered above → use `properties` (see below): map `Map column`; calendar `Start date`/`End date`/`Description`; deck `Primary header`/`Secondary header`/`Summary column`/`Main image`; gallery `Image size`; etc.

### `add_slice` / `set_slice`
`add_slice` requires `table`, `name`. `set_slice` requires `slice` (existing name). Optional: `rowFilter` (true/false expression selecting rows to keep, e.g. `[list_price] < 1000000`).

### `add_action` / `set_action`
`add_action` requires `table`, `name`, `actionType`. `set_action` requires `action` (existing name). Optional: `position`, `displayName`, `icon`, `condition` (Only-if-this-condition-is-true), `needsConfirmation` (`"true"`/`"false"`), `confirmationMessage`, `properties`, and per-type fields:
- `actionType`: `COPY_EDIT_ROW | EDIT_RECORD | EXPORT_VIEW | NAVIGATE_DIFFERENT_APP | NAVIGATE_APP | IMPORT_FILE | ADD_RECORD | ADD_RECORD_TO | DELETE_RECORD | REF_ACTION | SET_COLUMN_VALUE | NAVIGATE_URL | OPEN_FILE | CALL | SMS | EMAIL | COMPOSITE`
- `position`: `Primary | Prominent | Inline | Hide` (AppSheet labels "Display prominently"/"Do not display"/… are also accepted).
- **SET_COLUMN_VALUE / ADD_RECORD_TO** → `assignments: [{ "column": "c", "value": "expr" }]`. ADD_RECORD_TO also needs `targetTable` (assignments then target that table's columns; `[_THISROW]` = source row).
- **REF_ACTION** → `referencedTable` + `referencedAction` (existing action on it) + optional `referencedRows` (row-set expression).
- **COMPOSITE** (grouped) → `actions: ["ChildActionName", ...]` — the child actions must exist (create them earlier in the same `changes` array).
- **NAVIGATE_APP** → `target: "LINKTOVIEW(\"ViewName\")"` (or `LINKTOROW(...)`); **NAVIGATE_URL** → `target` = URL expression.
- **CALL/SMS/EMAIL/OPEN_FILE** → use `properties` (labels `To`, `Message`, `Subject`, `Body`, `File`).

### `add_format_rule` / `set_format_rule`
`add_format_rule` requires `table`, `name`. `set_format_rule` requires `rule` (existing name). Optional: `condition`, `columns` (array of column names and/or `"__action__ActionName"`), `icon`, `highlightColor`, `textColor`, `bold`/`italic`/`underline`/`uppercase`/`strikethrough` (`"true"`/`"false"`), `imageSize`.

---

## `properties` — type-specific fields (columns, actions & views)

`properties` is an object keyed by the field's **exact label** in the editor. Use it for anything without a dedicated field above — on `set_column`/`add_virtual_column`, `add_action`/`set_action`, **and `add_view`/`set_view`**. The engine auto-detects the control kind (dropdown, checkbox/switch → `"true"`/`"false"`, number, segmented buttons, expression, MUI dropdown, and image-grid dropdowns like Chart type / Map type / card Layout). Set `viewType` first so the right controls exist. Common labels:

- **Number/Decimal/Price/Percent**: `Maximum value`, `Minimum value`, `Increase/decrease step`, `Numeric digits`, `Decimal digits`, `Show thousands separator`(true/false), `Display mode`(Auto|Standard|Range|Label). Price also `Currency symbol`.
- **Text/LongText/Name**: `Maximum length`, `Minimum length`. LongText/Name also `Formatting`(Plain Text|Markdown|HTML).
- **Enum/EnumList**: `Allow other values`(true/false), `Input mode`(Auto|Buttons|Stack|Dropdown). (Use `baseType`/`referencedTable` fields for base type & ref table, not `properties`.)
- **Ref**: `Is a part of?`(true/false), `Input mode`(Auto|Buttons|Dropdown).
- **Date/DateTime/Time**: `Use long date format`, `Ignore seconds`, `Minimum date`, `Maximum date` (true/false or value).
- **Image/File/Drawing/Signature/Thumbnail**: `Image/File folder path` (expr); Image also `Allow drawing on images`.
- **Actions**: EDIT_RECORD `Desktop behavior`; EXPORT_VIEW/IMPORT_FILE `CSV file locale`; NAVIGATE_URL `Launch External`(true/false).
- **Views** (labels vary by `viewType`): chart `Chart colors`, `Trend line`(true/false), `Show legend`(true/false); map `Map column`(location col), `Map type`; calendar `Start date`, `End date`, `Description`, `Category`, `Default View`; deck `Primary header`, `Secondary header`, `Summary column`, `Main image`, `Image shape`; gallery `Image size`; table `Enable QuickEdit (beta)`(true/false), `Column width`; card `Layout`.

Only emit labels valid for that column/action/view type; a wrong label is warned and skipped. Column-picker labels (map/calendar/deck) take an **existing column name**; the column must be the right type (e.g. map `Map column` needs an Address/LatLong column, calendar `Start date` a Date/DateTime column).

---

## Examples

Ref-to-active-SKUs on an existing column:
```json
{ "changes": [ { "op": "set_column", "table": "PRICE_LISTS", "column": "sku_id",
  "type": "Enum", "baseType": "Ref", "referencedTable": "SKUS",
  "validIf": "SELECT(SKUS[sku_id], [lifecycle_status] = \"active\")" } ] }
```

Grouped action (children first, then COMPOSITE):
```json
{ "changes": [
  { "op": "add_action", "table": "PLANS", "name": "_Mark_Active", "actionType": "SET_COLUMN_VALUE",
    "position": "Hide", "icon": "minus", "assignments": [{ "column": "status", "value": "\"active\"" }] },
  { "op": "add_action", "table": "PLANS", "name": "_Mark_EOL", "actionType": "SET_COLUMN_VALUE",
    "position": "Hide", "icon": "minus", "assignments": [{ "column": "status", "value": "\"eol\"" }] },
  { "op": "add_action", "table": "PLANS", "name": "Lifecycle_Batch", "actionType": "COMPOSITE",
    "position": "Prominent", "icon": "layer-group", "actions": ["_Mark_Active", "_Mark_EOL"] }
] }
```

Chart + dashboard (child view first, then the dashboard that embeds it). Revenue **summed by region** → `Aggregate PieChart` grouped on the categorical `region` (a plain `PieChart` would *count* rows per region, not sum revenue; a `Col Series` would draw one bar per order, not per region):
```json
{ "changes": [
  { "op": "add_view", "name": "Revenue_Pie", "table": "ORDERS", "viewType": "chart", "icon": "chart-pie",
    "chartType": "Aggregate PieChart", "chartColumns": ["region"], "properties": { "Show legend": "true" } },
  { "op": "add_view", "name": "Ops_Dashboard", "viewType": "dashboard", "position": "menu", "icon": "th-large",
    "viewEntries": [ { "view": "Revenue_Pie", "size": "Large" }, { "view": "Orders_Table", "size": "Tall" } ] }
] }
```

Table view showing only chosen columns:
```json
{ "changes": [ { "op": "set_view", "view": "Suppliers", "columnOrder": "manual",
  "viewColumns": ["id", "name", "status"], "properties": { "Enable QuickEdit (beta)": "true" } } ] }
```

---

## Using the extension (for the human operator)

1. Open the AppSheet **editor** tab (`appsheet.com/template/...`), then open the assistant sidebar (toolbar icon / Alt+A on Firefox).
2. Go to the **Dựng App / Build App** tab.
3. Either type a request and click **Tạo/Generate** (the AI fills the JSON box), **or** paste a changeset directly into the always-visible **Changeset JSON** box.
4. The box is editable; the **Changes · N** plan and any warnings revalidate live as you type.
5. Click **Kiểm tra schema / Check** to sanity-check table/column names against the live app.
6. Click **Dựng ngay (N) / Apply** — the engine drives the editor to make the N changes.
7. **Click Save in the AppSheet editor** to persist. The extension never auto-saves.

Settings (⚙): AI provider + API key (BYOK: Gemini or DeepSeek); **Build App conventions** (always-on house rules injected into every generation); **Skills** (upload `.skill`/`.md` files or a `.zip` package — the AI reads each skill's description and applies matching ones).

Notes & limits:
- Structural changes only replay into the editor DOM; **the user must Save**. Row data is out of scope.
- `sortBy`/`groupBy`/`viewEntries` **append** on `set_view` (they don't replace existing rows).
- **Not yet supported:** table column **reordering** (`viewColumns` shows/hides only, order unchanged); slice columns/update-mode default to "all". CALL/SMS/EMAIL/OPEN_FILE fields work via `properties`.
- **Chart columns are filtered by chart type** — a wrong-type column isn't selectable and is dropped. Match the type: **categorical** for Histogram / Pie / Donut / Aggregate-Pie/Donut (which group a category); **Number** for Col/Row Series and Scatter. See the chart table above for how each type counts vs. aggregates vs. plots per-row.
- Names are validated against the live schema; unknown names are hard errors (the change is dropped). Property-label/enum-value/chart-column mismatches are non-blocking warnings.
