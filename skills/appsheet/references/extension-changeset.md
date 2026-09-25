# AppSheet Assistant & Copilot — Changeset JSON Specification

This document defines the strict-JSON changeset contract used by browser automation extensions (such as **AppSheet Copilot / Assistant**) to apply structural modifications directly into the AppSheet Editor DOM.

AppSheet has no public REST API to alter app structure (creating columns, views, actions, or slices). When an AI agent needs to modify app schema or layout, it can output a strict-JSON changeset following this specification.

---

## 1. Output Contract

Return **one** valid JSON object with a top-level `changes` array (no markdown code fences when piping to extension, or standard JSON block in chat):

```json
{
  "changes": [
    {
      "op": "set_column",
      "table": "Orders",
      "column": "TotalAmount",
      "type": "Price",
      "appFormula": "SUM([Related OrderDetails][Subtotal])"
    }
  ]
}
```

### Core Rules:
1. **Ordered Execution:** `changes` is an ordered list evaluated from top to bottom. Create parent items, dependencies, or columns before referencing them in downstream views or actions.
2. **Exact Naming:** Use table, column, view, and action names **exactly** as they exist in the app schema (case-sensitive).
3. **Expression Syntax:** Expressions are standard AppSheet formulas using `[Column]` bracket syntax. **Do not prefix formulas with `=`**.
4. **Boolean Switch Fields:** Properties like `showIf`, `editableIf`, `requireIf`, and `resetIf` take `"true"`, `"false"`, or a formula string (e.g., `"[Status] = 'Active'"`).
5. **Virtual Column Rule:** Never create virtual columns implicitly; use `add_virtual_column` when explicitly creating a computed field, or `set_column` to configure an existing physical column.

---

## 2. Operations & Field Reference

### `set_column` — Modify an Existing Column
Modifies properties of a pre-existing physical or virtual column.

* **Required:** `table`, `column`
* **Optional:** `type`, `baseType`, `referencedTable`, `properties`, `appFormula`, `initialValue`, `suggestedValues`, `validIf`, `displayName`, `showIf`, `editableIf`, `requireIf`, `resetIf`.

```json
{
  "op": "set_column",
  "table": "Tasks",
  "column": "AssignedTo",
  "type": "Enum",
  "baseType": "Ref",
  "referencedTable": "Users",
  "validIf": "SELECT(Users[Email], [Active] = TRUE)",
  "editableIf": "USERROLE() = 'Admin'"
}
```

---

### `add_virtual_column` — Create a Computed Column
Adds a new virtual column to the specified table.

* **Required:** `table`, `name` (no spaces, unique in table), `type`
* **Recommended:** `appFormula` (the calculation expression)
* **Optional:** `validIf`, `showIf`, `displayName`, `baseType`, `referencedTable`, `properties`.

```json
{
  "op": "add_virtual_column",
  "table": "Customers",
  "name": "LifetimeOrderValue",
  "type": "Price",
  "appFormula": "SUM([Related Orders][TotalAmount])"
}
```

---

### `set_table` — Table-Level Settings & Security Filters
Configures table data permissions and row-level security filters.

* **Required:** `table`
* **Optional:** `dataFilter` (Security Filter formula), `updateModeExpression` (`"ALL_CHANGES"`, `"READ_ONLY"`, `"UPDATES_ONLY"`).

```json
{
  "op": "set_table",
  "table": "Invoices",
  "dataFilter": "OR(USERROLE() = 'Admin', [AssignedTo] = USEREMAIL())",
  "updateModeExpression": "ALL_CHANGES"
}
```

---

### `add_view` / `set_view` — View Configuration
Creates or updates a user interface view.

* **`add_view` Required:** `name`, `viewType`, `table` *(except for dashboards, which omit `table`)*.
* **`set_view` Required:** `view` (existing view name).
* **Common Optional:** `position` (`"left most"`, `"left"`, `"center"`, `"right"`, `"right most"`, `"menu"`, `"ref"`), `displayName`, `icon`, `showIf`, `sortBy`, `groupBy`.
* **Supported `viewType` Values:** `table`, `deck`, `gallery`, `detail`, `map`, `calendar`, `chart`, `dashboard`, `form`, `onboarding`, `card`.

#### View-Specific Options:
1. **Dashboard View (`viewType: "dashboard"`):**
   ```json
   {
     "op": "add_view",
     "name": "Executive_Dashboard",
     "viewType": "dashboard",
     "position": "center",
     "viewEntries": [
       { "view": "KPI_Metrics_Detail", "size": "Wide" },
       { "view": "Open_Orders_Table", "size": "Large" }
     ]
   }
   ```
2. **Chart View (`viewType: "chart"`):**
   - `chartType`: `Histogram | Horizontal Histogram | PieChart | DonutChart | Aggregate PieChart | Aggregate DonutChart | Col Series | Col Series [Stack] | Col Series [Line] | Row Series | Row Series [Stack] | Row Series [Line] | Scatter Plot`.
   - `chartColumns`: Array of numeric columns (or categorical for Histograms).
   ```json
   {
     "op": "add_view",
     "name": "Monthly_Sales_Chart",
     "viewType": "chart",
     "table": "SalesSummary",
     "chartType": "Col Series",
     "chartColumns": ["Revenue", "ProfitMargin"],
     "position": "right"
   }
   ```
3. **Table View (`viewType: "table"`):**
   - `columnOrder`: `"automatic" | "manual"`
   - `viewColumns`: Array of column names to display.
   ```json
   {
     "op": "set_view",
     "view": "Orders_Table",
     "columnOrder": "manual",
     "viewColumns": ["OrderID", "CustomerRef", "OrderDate", "TotalAmount", "Status"]
   }
   ```

---

### `add_slice` / `set_slice` — Slice Configuration
Creates or modifies in-memory filtered slices.

* **`add_slice` Required:** `table`, `name`
* **`set_slice` Required:** `slice`
* **Optional:** `rowFilter` (Boolean row-filtering condition), `sliceColumns` (array of visible columns), `updateMode`.

```json
{
  "op": "add_slice",
  "table": "Orders",
  "name": "Pending_Orders_Slice",
  "rowFilter": "[Status] = 'Pending'",
  "sliceColumns": ["OrderID", "CustomerRef", "OrderDate", "TotalAmount", "Priority"]
}
```

---

### `add_action` / `set_action` — Action Buttons
Creates or configures row-level and table-level actions.

* **`add_action` Required:** `table`, `name`, `actionType`
* **`set_action` Required:** `action`
* **Supported `actionType` Values:**
  - `SET_COLUMN_VALUE`: Modifies column values (`assignments: [{ "column": "c", "value": "expr" }]`).
  - `ADD_RECORD_TO`: Adds a row to another table (`targetTable`, `assignments`).
  - `REF_ACTION`: Executes an action on referenced rows (`referencedTable`, `referencedAction`, `referencedRows`).
  - `COMPOSITE`: Executes a sequence of actions (`actions: ["Action1", "Action2"]`).
  - `NAVIGATE_APP`: Deep-links within the app (`target: "LINKTOVIEW('ViewName')"`).
  - `NAVIGATE_URL`: Opens external web link (`target: "https://..."`).
  - `COPY_EDIT_ROW`, `EDIT_RECORD`, `DELETE_RECORD`, `EXPORT_VIEW`, `IMPORT_FILE`.

```json
{
  "op": "add_action",
  "table": "Orders",
  "name": "Mark_As_Shipped",
  "actionType": "SET_COLUMN_VALUE",
  "position": "Prominent",
  "displayName": "Ship Order",
  "condition": "[Status] = 'Processing'",
  "needsConfirmation": "true",
  "confirmationMessage": "Are you sure you want to mark this order as Shipped?",
  "assignments": [
    { "column": "Status", "value": "'Shipped'" },
    { "column": "ShippedAt", "value": "NOW()" }
  ]
}
```

---

### `add_format_rule` / `set_format_rule` — Conditional Visual Styling
Applies dynamic visual styling (icons, text color, bolding, highlights).

* **`add_format_rule` Required:** `table`, `name`
* **`set_format_rule` Required:** `rule`
* **Optional:** `condition`, `columns` (array of columns and/or `"__action__ActionName"`), `icon`, `highlightColor`, `textColor`, `bold`, `italic`, `strikethrough`.

```json
{
  "op": "add_format_rule",
  "table": "Tasks",
  "name": "Overdue_Task_Warning",
  "condition": "AND([Status] <> 'Completed', [DueDate] < TODAY())",
  "columns": ["DueDate", "Status"],
  "textColor": "#dc3545",
  "bold": "true",
  "icon": "alert-circle"
}
```
