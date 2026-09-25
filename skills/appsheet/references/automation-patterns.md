# AppSheet Automation & Bot Patterns

Comprehensive reference for building event-driven workflows, data change bots, scheduled jobs, document generation, and external integrations in Google AppSheet.

---

## 1. Automation Architecture Overview

AppSheet automations follow an event-driven pattern:
```
[ Event Trigger ] ──> ( Filter Condition ) ──> [ Process ] ──> [ Step / Task 1 ]
                                                            ──> [ Step / Task 2 ]
```

- **Bot**: The top-level automation container linking an Event to a Process.
- **Event**: Defines *when* the automation runs (Data Change, Schedule, or Webhook).
- **Process**: Defines the sequence of steps and conditional logic.
- **Task**: The specific action executed (Email, Notification, Webhook, Document, Data Action, Apps Script).

---

## 2. Event Types & Configurations

### 2.1 Data Change Events
Triggers when records in a specified table are modified:
- **`Adds only`**: Runs when a new row is created.
- **`Updates only`**: Runs when an existing row is edited.
- **`Deletes only`**: Runs when a row is removed.
- **`Adds and Updates`**: Runs on create or update.
- **`All changes`**: Runs on create, update, or delete.

#### Change Detection Expression Patterns
To prevent bots from firing repeatedly on unrelated edits, use change comparison expressions:
```appsheet
-- Fires ONLY when Status changes to 'Approved'
AND(
  [_THISROW_BEFORE].[Status] <> [_THISROW_AFTER].[Status],
  [_THISROW_AFTER].[Status] = "Approved"
)
```

```appsheet
-- Fires when assigned user changes
[_THISROW_BEFORE].[AssignedTo] <> [_THISROW_AFTER].[AssignedTo]
```

### 2.2 Scheduled Events
Triggers periodically based on a time schedule:
- **Schedule Cadence**: Daily, Weekly, Monthly, or Hourly.
- **Timezone**: Explicit timezone setting (e.g. `America/Los_Angeles`).
- **Execution Mode**:
  - **Single Run**: Runs once per scheduled time (useful for summary reports).
  - **For Each Row in Table**: Iterates across every row in the table matching a filter condition.

#### Scheduled Filter Expression Pattern
```appsheet
-- For Each Row where payment is overdue:
AND(
  [Status] = "Unpaid",
  [DueDate] < TODAY(),
  [LastReminderSent] < (TODAY() - 3)
)
```

---

## 3. Automation Task Types

### 3.1 Send an Email
- **To / CC / BCC**: Dynamic expressions using `USEREMAIL()`, `[CustomerEmail]`, or `SELECT()`.
- **Subject**: String or formula: `CONCATENATE("Order #", [OrderID], " Confirmation")`.
- **Email Body**: Pre-defined template or custom Google Doc / HTML template.
- **Attachment**: Attach generated PDF, CSV, or ICS calendar files.

### 3.2 Call a Webhook
- **URL**: Target REST endpoint URL.
- **HTTP Method**: `POST`, `PUT`, `PATCH`, `DELETE`.
- **HTTP Headers**: e.g. `Authorization: Bearer {token}`, `Content-Type: application/json`.
- **JSON Body Template**: Custom JSON payload embedding AppSheet fields.

### 3.3 Create a File (PDF / CSV / HTML / JSON)
- **Output Folder**: Google Drive / Cloud Storage folder path.
- **File Name Prefix**: Formula: `CONCATENATE("Invoice_", [InvoiceID], "_", TEXT(TODAY(), "YYYYMMDD"))`.
- **File Format**: `PDF`, `CSV`, `HTML`, `JSON`, `XML`.
- **Page Settings**: Portrait/Landscape, Page Size (Letter, A4), Margins.

### 3.4 Run a Data Action
- Executes actions such as updating values in another table, adding new rows to a related table, or setting a timestamp.

### 3.5 Call Google Apps Script
- Binds to an Apps Script project deployed as API executable.
- Passes typed arguments and receives return values to update the active record.

---

## 4. Document Templates & Tag Syntax

When generating PDFs, emails, or text documents, AppSheet uses template tags enclosed in `<< >>`.

### 4.1 Scalar Field Replacements
```markdown
Invoice ID: <<[InvoiceID]>>
Customer Name: <<[CustomerID].[Name]>>
Total Amount: <<TEXT([Total], "$#,##0.00")>>
Date: <<TEXT([CreatedDate], "MM/DD/YYYY")>>
```

### 4.2 Relational Child Table Loops (`<<Start>> ... <<End>>`)
Iterates over rows of a related child list:
```markdown
| Item | Unit Price | Qty | Subtotal |
| :--- | :--- | :--- | :--- |
<<Start: [Related InvoiceDetails]>>
| <<[ItemDescription]>> | <<TEXT([UnitPrice], "$#,##0.00")>> | <<[Quantity]>> | <<TEXT([Subtotal], "$#,##0.00")>> |
<<End>>
```

### 4.3 Conditional Blocks (`<<If>> ... <<EndIf>>`)
```markdown
<<If: [Discount] > 0>>
Special Promotional Discount Applied: <<TEXT([Discount], "$#,##0.00")>>
<<EndIf>>
```

### 4.4 Image and Signature Embedding
```markdown
Inspector Signature:
<<[SignatureColumn]>>

Site Photo:
<<[PhotoColumn]>>
```

---

## 5. Troubleshooting & Debugging Bots

1. **Audit History Log**:
   - Access via *Manage > Monitor > Audit History*.
   - Filter by `Bot Name` or `Event Type` to inspect step-by-step execution payloads, error codes, and variable values.
2. **Test Button**:
   - Use the **Test** button in the Bot editor to run simulated executions against selected sample rows.
3. **Bypass Rules**:
   - Verify that condition expressions return `TRUE` for tested rows.
