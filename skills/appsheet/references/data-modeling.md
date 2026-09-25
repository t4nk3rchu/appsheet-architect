# AppSheet Data Modeling & Architecture Guide

Comprehensive reference for designing relational schemas, configuring column types, managing keys/labels, optimizing virtual columns, managing table width, and implementing security boundaries.

---

## 1. Relational Data Modeling Fundamentals

AppSheet abstracts underlying databases (Google Sheets, PostgreSQL, Cloud SQL, MySQL, BigQuery) into a relational schema.

### Core Architecture Rules:
1. **Tables**: Every physical table or view in your data source maps to an AppSheet Table.
2. **Primary Key Column**: Every table MUST have exactly one primary Key column.
3. **Label Column**: Every table SHOULD have exactly one Label column for human-friendly dropdown display.
4. **Foreign Key Relations (`Ref` vs `Enum`)**: 
   - Use `Ref` when parent-child forms and reverse child lists (`REF_ROWS`) are required.
   - Use `Enum` (Base Type: `Ref`) for standalone utility lookups to suppress unwanted reverse-reference Virtual Columns.

---

## 2. Key vs. Label Design

### Primary Key Selection Strategy
- **Users / Staff Tables (Google Workspace):** Use **`Email`** as the Primary Key. Direct 1:1 match with `USEREMAIL()` eliminates join lookups and aligns with Google Workspace account management.
- **Catalog / Parts Tables:** Natural keys (`PartNumber`, `SKU`) are valid provided the column is formatted as **Text** in Google Sheets (leading `'`).
- **Transactional / Relational Tables (`Orders`, `Tasks`, `Logs`):** ALWAYS use **`UNIQUEID()`** (or `UNIQUEID("UUID")`) in **Initial Value**.
- **Confidential Data:** NEVER use PII (`SSN`, passport numbers) as primary keys.

### Label Column Strategy
- The Label is what end-users see when choosing a referenced row in dropdowns and form selectors.
- Can be a single physical column (e.g. `[Full Name]`) or a computed Virtual Column:
  ```appsheet
  CONCATENATE([CustomerName], " (", [CustomerCode], ")")
  ```

---

## 3. References & Parent-Child Relationships

### Configuring Parent-Child Tables:
1. On child table (`OrderDetails`), add a column `[OrderID]`.
2. Set Type to **`Ref`** and Referenced Table to `Orders`.
3. Check **`IsPartOf = TRUE`** if deleting an Order should cascade-delete all its OrderDetails and allow embedded inline item entry in forms.
4. AppSheet will automatically create a Virtual Column in the parent table:
   ```appsheet
   REF_ROWS("OrderDetails", "OrderID")
   ```

### Suppressing Unwanted Virtual Columns: `Enum` (Base Type: `Ref`)
When Table B needs to reference Table A for tagging or lookups (e.g. `Tasks[AssignedTo]` $\to$ `Users[Email]`), using a standard `Ref` column auto-generates `[Related Tasks]` on the `Users` table.
- **Optimization:** Configure the column as **Type: `Enum`** with **Base Type: `Ref`** and set the Referenced Table.
- **Result:** You get full dropdown selection and direct dereferencing (`[AssignedTo].[Department]`), but AppSheet **suppresses the auto-generated `[Related Tasks]` virtual column**, eliminating sync overhead on the parent table!

---

## 4. Virtual Columns vs Physical Columns

| Feature | Physical Column (Spreadsheet/DB) | Virtual Column (App-Only) |
| :--- | :--- | :--- |
| **Storage Location** | Stored in Google Sheets / SQL Database | Stored only in AppSheet memory |
| **Compute Frequency** | Computed once on row save / edit | Recomputed on every sync and row change |
| **Formula Option** | Initial Value (editable) or App Formula (locks cell) | App Formula (always dynamic) |
| **Sync Impact** | Zero sync latency after write | $O(N)$ sync cost per row on every sync |
| **Best Used For** | Persistent data, write-time snapshots, status | Dynamic live calculations, reverse Ref lists |

---

## 5. Column Types & Dynamic Modifiers

| Modifier | Description | Example Expression |
| :--- | :--- | :--- |
| **`Initial Value`** | Pre-fills value on new row creation; user can edit | `TODAY()`, `USEREMAIL()`, `UNIQUEID()` |
| **`App Formula`** | Computed value recalculated on sync/edit; read-only | `[UnitPrice] * [Quantity]` |
| **`Valid_If`** | Validation rule and dynamic dropdown constraint | `[EndDate] >= [StartDate]` |
| **`Show_If`** | Dynamic field visibility | `[PaymentMethod] = "Credit Card"` |
| **`Required_If`** | Dynamic required field validation | `[Status] = "Rejected"` |
| **`Editable_If`** | Controls whether column is editable | `USERROLE() = "Admin"` |

---

## 6. Table Width & Column Count Best Practices

AppSheet downloads all columns of every row during sync (even if hidden in views).

| Column Count | Category | Architectural Best Practice |
| :--- | :--- | :--- |
| **< 30 Columns** | **Optimal** | Fast sync, minimal memory usage, instant form rendering. |
| **30 – 50 Columns** | **Standard** | Typical for primary business entities. Keep Virtual Columns $\le 5$. |
| **50 – 100 Columns** | **Warning** | Separate large text blobs, audit logs, or notes into child tables. |
| **> 100 Columns** | **Danger Zone** | **Split Table:** Use the 1:1 Extension Table Pattern (`Core` vs `Extended_Details` with `IsPartOf = TRUE`). |

---

## 7. Slices vs Security Filters

### Slices (Client-Side)
- **Execution**: Evaluated on the client device after downloading table data.
- **Purpose**: Creates custom filtered views (e.g. `"Pending Orders"`, `"My Tasks"`), subset columns, or modifies CRUD permissions for specific views.
- **Security**: NOT suitable for hiding confidential data from unauthorized users (data is still transmitted to the device).

### Security Filters (Server-Side)
- **Execution**: Evaluated on Google AppSheet servers prior to sending data to the client.
- **Purpose**: Multi-tenant data isolation, GDPR/compliance, and minimizing device payload.
- **Example Security Filter**:
  ```appsheet
  OR(
    USERROLE() = "Admin",
    [OwnerEmail] = USEREMAIL()
  )
  ```

---

## 8. Performance Optimization Checklist

1. **Avoid `SELECT()` in Virtual Columns**: Prefer `Ref` relationships with `[Related Items][Column]` dereferences.
2. **Use `Enum (Base Type: Ref)` for Utility Links**: Prevents auto-generating dozens of `REF_ROWS()` virtual columns on master tables.
3. **Apply 3-Tier Pragmatic Denormalization**: Snapshot point-in-time values at write time using `Initial Value` instead of runtime dereferencing virtual columns.
4. **Use Server-Side Security Filters**: Filter out historical or archived rows from syncing to mobile devices.
5. **Keep Column Counts Under 50**: Use the 1:1 Extension Table pattern for wide records.
