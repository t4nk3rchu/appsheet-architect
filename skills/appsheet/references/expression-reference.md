# AppSheet Expression & Formula Reference

Comprehensive guide to expressions, formula functions, type operations, and dereferencing in Google AppSheet, with real-world examples for every function.

---

## Table of Contents
1. [List & Selection Functions](#1-list--selection-functions)
2. [Logical & Conditional Functions](#2-logical--conditional-functions)
3. [Text & String Functions](#3-text--string-functions)
4. [Date & Time Functions](#4-date--time-functions)
5. [Math & Numeric Functions](#5-math--numeric-functions)
6. [Context & Utility Functions](#6-context--utility-functions)
7. [Deep Link & Navigation Functions](#7-deep-link--navigation-functions)
8. [Dereferencing Syntax](#8-dereferencing-syntax)
9. [Common Formula Recipes & Anti-Patterns](#9-common-formula-recipes--anti-patterns)

---

## 1. List & Selection Functions

### `SELECT(Table[Column], [Condition], [DistinctOnly])`
Retrieves a list of column values from a table or slice matching specific conditions.
- **Example 1 (Parent-Child Matching):** Find all open order IDs for the customer in the current row.
  ```appsheet
  SELECT(Orders[OrderID], AND([CustomerID] = [_THISROW].[CustomerID], [Status] = "Open"))
  ```
- **Example 2 (Unique Values):** Extract a deduplicated list of active delivery cities for a dropdown.
  ```appsheet
  SELECT(Deliveries[City], [IsActive] = TRUE, TRUE)
  ```
- **Example 3 (Date Range Filter):** Retrieve logged hours for the current employee over the last 7 days.
  ```appsheet
  SELECT(Timesheets[Hours], AND([EmployeeID] = [_THISROW].[EmployeeID], [Date] >= TODAY() - 7))
  ```

### `LOOKUP(Value, Table, LookupColumn, ResultColumn)`
Returns a single value from `ResultColumn` where `LookupColumn` matches `Value` (one value even if several rows match). `Table`, `LookupColumn` and `ResultColumn` must be literal text. LOOKUP wraps `ANY(SELECT(...))`.
**Pitfall:** inside `Value`, an unqualified `[Col]` is evaluated against the looked-up table and matches every row. Reference the current row with `[_THISROW].[Col]`.
- **Example 1 (Customer Contact):** Look up a customer's billing email given their customer ID.
  ```appsheet
  LOOKUP([_THISROW].[CustomerID], "Customers", "CustomerID", "BillingEmail")
  ```
- **Example 2 (Price Tiering):** Retrieve the unit wholesale cost for a selected SKU from the catalog.
  ```appsheet
  LOOKUP([_THISROW].[SKU], "ProductCatalog", "SKU", "WholesalePrice")
  ```

### `FILTER("Table", [Condition])`
Returns an unsorted list of Row Keys (Refs) from the target table where the condition evaluates to `TRUE`.
- **Example 1 (Low Inventory Alert):** Return all inventory item keys where stock has fallen below the reorder threshold.
  ```appsheet
  FILTER("Inventory", [QuantityOnHand] <= [ReorderPoint])
  ```
- **Example 2 (Urgent Tasks):** Identify all unassigned critical tickets due today.
  ```appsheet
  FILTER("Tickets", AND(ISBLANK([AssignedTechnician]), [Priority] = "Urgent", [DueDate] <= TODAY()))
  ```

### `REF_ROWS("ChildTable", "ParentRefColumn")`
Automatically constructs a list of keys for related records in a child table pointing back to this record.
- **Example 1 (Order Line Items):** On the `Orders` table to get all related item rows.
  ```appsheet
  REF_ROWS("OrderLineItems", "OrderID")
  ```
- **Example 2 (Project Milestones):** On the `Projects` table to link all milestone milestones.
  ```appsheet
  REF_ROWS("Milestones", "ProjectID")
  ```

### `LIST(val1, val2, ...)`
Constructs a list literal from individual values or column references.
- **Example 1 (Static Status Choices):** Define an inline list of selectable status options.
  ```appsheet
  LIST("Draft", "Submitted", "Under Review", "Approved", "Rejected")
  ```
- **Example 2 (Combining Notification Recipients):** Combine the owner, manager, and auditor emails into a notification list.
  ```appsheet
  LIST([OwnerEmail], [ManagerEmail], "compliance@company.com")
  ```

### `SORT(List, [Descending])`
Sorts a list in ascending (default, `FALSE`) or descending (`TRUE`) order.
- **Example 1 (Latest Log Timestamp):** Sort audit timestamps descending to find the newest event.
  ```appsheet
  SORT(SELECT(AuditLogs[Timestamp], [RecordID] = [_THISROW].[ID]), TRUE)
  ```
- **Example 2 (Alphabetical Department List):** Sort department names alphabetically for user presentation.
  ```appsheet
  SORT(SELECT(Departments[Name], TRUE), FALSE)
  ```

### `TOP(List, Count)`
Returns the first `Count` items from the beginning of a list.
- **Example 1 (Top 3 Recent Deals):** Get the 3 most recently created deal IDs.
  ```appsheet
  TOP(SORT(SELECT(Deals[DealID], TRUE), TRUE), 3)
  ```
- **Example 2 (Latest Status Entry):** Extract the single most recent status log entry.
  ```appsheet
  TOP(SORT(SELECT(StatusHistory[LogID], [TicketID] = [_THISROW].[TicketID]), TRUE), 1)
  ```

### `INDEX(List, ItemNumber)`
Returns the 1-based element at `ItemNumber` from a list. Returns blank if out of bounds.
- **Example 1 (First Value Extraction):** Retrieve the department head's email from a query.
  ```appsheet
  INDEX(SELECT(Departments[HeadEmail], [DepartmentName] = [_THISROW].[DepartmentName]), 1)
  ```
- **Example 2 (Second Escalation Contact):** Select the second backup approver from an EnumList of approvers.
  ```appsheet
  INDEX([BackupApproversList], 2)
  ```

### `COUNT(List)`
Returns the number of elements in a list.
- **Example 1 (Child Record Verification):** Verify that an invoice contains at least one line item before allowing submission.
  ```appsheet
  COUNT([Related OrderLineItems]) > 0
  ```
- **Example 2 (Active Project Load):** Count active assignments currently assigned to an engineer.
  ```appsheet
  COUNT(SELECT(Tasks[TaskID], AND([Assignee] = [_THISROW].[Email], [Status] = "In Progress")))
  ```

### `SPLIT(Text, Delimiter)`
Splits a delimited text string into an `EnumList` / `List`.
- **Example 1 (Comma-Separated Tags):** Convert a comma-separated tag string into a selectable list.
  ```appsheet
  SPLIT([TagsInput], ", ")
  ```
- **Example 2 (Semicolon-Separated Values):** Split a semicolon-delimited string (the delimiter is case-sensitive).
  ```appsheet
  SPLIT([SemicolonValues], ";")
  ```

### `INTERSECT(List1, List2)`
Returns elements common to both lists.
- **Example 1 (Skill Matching):** Check if a job candidate has any of the required job skills.
  ```appsheet
  COUNT(INTERSECT([CandidateSkills], [RequiredSkills])) > 0
  ```
- **Example 2 (Role Permission Validation):** Check if user security groups overlap with authorized roles.
  ```appsheet
  ISNOTBLANK(INTERSECT(SPLIT(USERSETTINGS("Roles"), ","), LIST("Admin", "Director", "Finance")))
  ```

### `UNIQUE(List1 + List2)` (combine lists; there is no `UNION()` function)
The `+` operator combines two lists and preserves duplicates. Wrap in `UNIQUE()` to de-duplicate.
- **Example 1 (Merged Mailing List):** Merge direct assignees and CC'd reviewers without duplicating emails.
  ```appsheet
  UNIQUE([AssigneesList] + [ReviewersList])
  ```
- **Example 2 (Multi-Warehouse Inventory):** Combine parts stored in both the North and South warehouse locations.
  ```appsheet
  UNIQUE(SELECT(NorthWarehouse[PartID], TRUE) + SELECT(SouthWarehouse[PartID], TRUE))
  ```

### `List1 - List2` (List Subtraction)
Removes all elements present in `List2` from `List1`. Keeps the order of the left list (community: duplicates in the left list are also collapsed).
- **Example 1 (Incomplete Steps):** Find remaining onboarding checklist steps by subtracting completed items.
  ```appsheet
  [AllOnboardingSteps] - [CompletedSteps]
  ```
- **Example 2 (Excluding Inactive Staff):** Filter out terminated employees from the team notification distribution list.
  ```appsheet
  [TeamEmailsList] - SELECT(Employees[Email], [Status] = "Inactive")
  ```

---

## 2. Logical & Conditional Functions

### `IF(Condition, ThenValue, ElseValue)`
Evaluates a boolean condition and returns `ThenValue` if `TRUE`, otherwise `ElseValue`.
- **Example 1 (Volume Discount Calculation):** Apply a 10% discount when subtotal is $500 or greater.
  ```appsheet
  IF([Subtotal] >= 500, [Subtotal] * 0.90, [Subtotal])
  ```
- **Example 2 (SLA Overdue Indicator):** Display "OVERDUE" if the resolution deadline has passed and status is not closed.
  ```appsheet
  IF(AND([DueDate] < TODAY(), [Status] <> "Closed"), "OVERDUE", "ON TIME")
  ```

### `IFS(cond1, val1, cond2, val2, ..., [TRUE, defaultVal])`
Evaluates conditions sequentially and returns the value corresponding to the first `TRUE` condition.
- **Example 1 (Performance Tier Rating):** Assign a performance tier based on sales volume.
  ```appsheet
  IFS(
    [SalesVolume] >= 100000, "Platinum",
    [SalesVolume] >= 50000, "Gold",
    [SalesVolume] >= 20000, "Silver",
    TRUE, "Bronze"
  )
  ```
- **Example 2 (Status Badge Color):** Return UI display colors based on work order progress.
  ```appsheet
  IFS(
    [Progress] = 100, "Green",
    [Progress] >= 50, "Blue",
    [Progress] > 0, "Yellow",
    TRUE, "Red"
  )
  ```

### `SWITCH(Expression, val1, res1, val2, res2, ..., defaultRes)`
Compares an expression against exact literal values and returns the matching result.
- **Example 1 (Routing Department Emails):** Route support requests based on selected category.
  ```appsheet
  SWITCH([Category],
    "Hardware", "it-support@corp.com",
    "Payroll", "payroll-help@corp.com",
    "Facilities", "building@corp.com",
    "helpdesk@corp.com"
  )
  ```
- **Example 2 (Unit of Measure Multiplier):** Normalize weight inputs to kilograms.
  ```appsheet
  [RawWeight] * SWITCH([Unit], "kg", 1.0, "g", 0.001, "lb", 0.453592, "oz", 0.0283495, 1.0)
  ```

### `AND(cond1, cond2, ...)`
Returns `TRUE` if and only if all provided arguments evaluate to `TRUE`.
- **Example 1 (Form Validation in Valid_If):** Ensure an appointment start time is in the future and during business hours.
  ```appsheet
  AND([AppointmentDate] >= TODAY(), TIMENOW() >= "08:00:00", TIMENOW() <= "17:00:00")
  ```
- **Example 2 (Required Fields for Submission):** Check all compliance requirements before final sign-off.
  ```appsheet
  AND(ISNOTBLANK([InspectorSignature]), ISNOTBLANK([SafetyChecklistDate]), [SafetyScore] >= 80)
  ```

### `OR(cond1, cond2, ...)`
Returns `TRUE` if at least one argument evaluates to `TRUE`.
- **Example 1 (Security Filter Access):** Allow admins, record owners, or managers to view a row.
  ```appsheet
  OR(USERROLE() = "Admin", [CreatedBy] = USEREMAIL(), [ManagerEmail] = USEREMAIL())
  ```
- **Example 2 (Show_If Action Visibility):** Show an action button only when status is either "Pending" or "Revision Needed".
  ```appsheet
  OR([Status] = "Pending", [Status] = "Revision Needed")
  ```

### `NOT(Condition)`
Inverts the boolean value of a condition.
- **Example 1 (Locking Archived Records):** Set `Editable_If` to lock records once archived.
  ```appsheet
  NOT([IsArchived])
  ```
- **Example 2 (Excluding Blacklisted Domains):** Validate customer email in `Valid_If`.
  ```appsheet
  NOT(IN(MID([Email], FIND("@", [Email]), 100), LIST("@example.com", "@test.org")))
  ```

### `ISBLANK(Value)` & `ISNOTBLANK(Value)`
Checks whether a column value, text string, or list contains data or is empty.
- **Example 1 (Conditional Field Requirement):** Make `[RejectionReason]` required only when status is rejected.
  ```appsheet
  -- In Required_If for RejectionReason column:
  [Status] = "Rejected"
  ```
- **Example 2 (Dynamic Action Display):** Display the "Download Invoice" action only when a PDF link exists.
  ```appsheet
  -- In Show_If:
  ISNOTBLANK([InvoicePDFUrl])
  ```

### `IN(Value, List)`
Returns `TRUE` if `Value` is an exact match for any item in `List`.
- **Example 1 (Admin Authorization):** Restrict access to executive dashboards to authorized emails.
  ```appsheet
  IN(USEREMAIL(), SELECT(Executives[Email], [IsActive] = TRUE))
  ```
- **Example 2 (Dropdown Restriction in Valid_If):** Restrict status transitions based on user role.
  ```appsheet
  IN([_THIS], IF(USERROLE() = "Admin", LIST("Open", "In Review", "Approved", "Void"), LIST("Open", "In Review")))
  ```

---

## 3. Text & String Functions

### `CONCATENATE(text1, text2, ...)`
Joins multiple text strings, numbers, or column values together.
- **Example 1 (Full Name with Employee ID):** Create a descriptive label column.
  ```appsheet
  CONCATENATE([LastName], ", ", [FirstName], " (ID: ", [EmployeeID], ")")
  ```
- **Example 2 (Formatted Reference Code):** Build an invoice reference string from dates and sequence numbers.
  ```appsheet
  CONCATENATE("INV-", TEXT([CreatedDate], "YYYYMM"), "-", RIGHT(CONCATENATE("0000", [SeqNum]), 4))
  ```

### `TEXT(Value, [FormatPattern])`
The two-argument form formats Date, DateTime and Time values only (tokens such as `YYYY`, `MM`, `DD`, `MMMM`, `DDDD`, `HH`). Number/currency patterns like `"$#,##0.00"` are not supported: use `TEXT([x])` (follows the column's type details) or a Decimal/Price column.
- **Example 1 (Month Code):** Format a date as a year-month code.
  ```appsheet
  TEXT([CreatedDate], "YYYYMM")
  ```
- **Example 2 (Date for Email Templates):** Format a timestamp's date for customer notification emails.
  ```appsheet
  TEXT([ScheduledStart], "DDDD, MMMM DD, YYYY")
  ```

### `LEFT(Text, Count)`, `RIGHT(Text, Count)`, `MID(Text, Start, Count)`
Extracts substring characters from the start, end, or middle of a string.
- **Example 1 (Masking Payment Cards):** Mask card numbers showing only the last 4 digits.
  ```appsheet
  CONCATENATE("•••• •••• •••• ", RIGHT([CardNumber], 4))
  ```
- **Example 2 (Parsing SKU Code Prefix and Serial):** Extract warehouse code (first 3 chars) and batch ID (middle 4 chars).
  ```appsheet
  CONCATENATE("Warehouse: ", LEFT([SKU], 3), " | Batch: ", MID([SKU], 5, 4))
  ```

### `SUBSTITUTE(Text, OldText, NewText)`
Replaces all occurrences of `OldText` with `NewText` within `Text`.
- **Example 1 (Phone Number Sanitization):** Strip hyphens, spaces, and parentheses from a phone input.
  ```appsheet
  SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE([Phone], "(", ""), ")", ""), "-", ""), " ", "")
  ```
- **Example 2 (Template Placeholder Replacement):** Replace a placeholder tag in a canned response template.
  ```appsheet
  SUBSTITUTE([EmailTemplateBody], "<<CustomerName>>", [CustomerRef].[FirstName])
  ```

### `FIND(SearchText, TargetText)`
Finds the 1-based start position of `SearchText` inside `TargetText`. Returns 0 if not found.
- **Example 1 (Extracting Domain from Email):** Locate `@` to parse the company domain.
  ```appsheet
  MID([Email], FIND("@", [Email]) + 1, 100)
  ```
- **Example 2 (Checking for Keyword Presence):** Flag tickets containing urgent keywords in the subject.
  ```appsheet
  FIND("URGENT", UPPER([Subject])) > 0
  ```

### `LOWER(Text)`, `UPPER(Text)`, `TRIM(Text)`
Transforms string casing and trims spaces. There is no `PROPER()` function in AppSheet.
- **Example 1 (Single-Word Capitalization):** Capitalize the first letter of a one-word name (no per-word proper case built in).
  ```appsheet
  CONCATENATE(UPPER(LEFT(TRIM([RawNameInput]), 1)), LOWER(MID(TRIM([RawNameInput]), 2, 100)))
  ```
- **Example 2 (Email Normalization for Matching):** Standardize email addresses to lowercase before comparisons.
  ```appsheet
  LOWER(TRIM([UserEnteredEmail])) = LOWER(USEREMAIL())
  ```

### `ENCODEURL(Text)`
Encodes special characters in a text string for safe inclusion in URL query strings.
- **Example 1 (WhatsApp Click-to-Chat Action):** Create a direct WhatsApp messaging link with pre-filled text.
  ```appsheet
  CONCATENATE(
    "https://wa.me/", [InternationalPhone],
    "?text=", ENCODEURL(CONCATENATE("Hello ", [FirstName], ", your order #", [OrderID], " is ready for pickup!"))
  )
  ```
- **Example 2 (Google Search Query Link):** Generate a search link for a part number.
  ```appsheet
  CONCATENATE("https://www.google.com/search?q=", ENCODEURL(CONCATENATE([Manufacturer], " ", [PartNumber])))
  ```

### `EXTRACTEMAILS(Text)`, `EXTRACTNUMBERS(Text)`, `EXTRACTDATES(Text)`
Extracts structured data types from unstructured text blocks into a list.
- **Example 1 (Extract Primary Email from Notes):** Extract the first email address detected in scanned meeting notes.
  ```appsheet
  INDEX(EXTRACTEMAILS([MeetingNotes]), 1)
  ```
- **Example 2 (Summing Amounts from Description):** Extract and sum all dollar values from freeform expense text.
  ```appsheet
  SUM(EXTRACTNUMBERS([ExpenseDescription]))
  ```

---

## 4. Date & Time Functions

### `TODAY()`, `NOW()`, `TIMENOW()`
Returns current date, current timestamp (date + time), or current time of day.
- **Example 1 (Defaulting Date in Initial Value):** Automatically set the created date on new records.
  ```appsheet
  TODAY()
  ```
- **Example 2 (Audit Logging Timestamp):** Capture the exact time an approval button is clicked.
  ```appsheet
  NOW()
  ```
- **Example 3 (Time-Window Action Availability):** Enable delivery dispatch only during morning hours.
  ```appsheet
  TIMENOW() < "12:00:00"
  ```

### `DATE(when)`, `TIME(when)`, `DATETIME(when)`
Each takes ONE argument and converts a Date, DateTime or Time value (or parseable text) to that type. They do not build values from separate year/month/day or hour/minute parts.
- **Example 1 (Construct Date from Year/Month Picker):** Build a first-of-the-month date from dropdown selections.
  ```appsheet
  DATE(CONCATENATE([SelectedMonth], "/1/", [SelectedYear]))
  ```
- **Example 2 (Combining Separate Date and Time Columns):** Create a unified timestamp from separate date and time fields.
  ```appsheet
  [EventDate] + ([StartTime] - "00:00:00")
  ```

### `YEAR(Date)`, `MONTH(Date)`, `DAY(Date)`, `HOUR(Duration)`, `MINUTE(Duration)`
Extracts individual numeric components from dates (`YEAR`/`MONTH`/`DAY`) and durations (`HOUR`/`MINUTE`). `HOUR`/`MINUTE` require a Duration: `HOUR(NOW())` errors; use `HOUR(TIME(NOW()) - "00:00:00")`.
- **Example 1 (Fiscal Year Grouping):** Group sales records by invoice year in a slice.
  ```appsheet
  YEAR([InvoiceDate]) = YEAR(TODAY())
  ```
- **Example 2 (Birthday Reminder Bot Trigger):** Trigger a greeting email when the birth date matches today's month and day.
  ```appsheet
  AND(MONTH([BirthDate]) = MONTH(TODAY()), DAY([BirthDate]) = DAY(TODAY()))
  ```

### `EOMONTH(Date, MonthsOffset)`
Returns the last calendar day of the month offset by `MonthsOffset` (0 = current month, 1 = next month, -1 = previous month).
- **Example 1 (End of Current Billing Cycle):** Calculate invoice due date at the end of the current month.
  ```appsheet
  EOMONTH([InvoiceDate], 0)
  ```
- **Example 2 (Quarterly Review Deadline):** Set deadline to the end of next quarter (3 months ahead).
  ```appsheet
  EOMONTH(TODAY(), 3)
  ```

### `WORKDAY(StartDate, NumDays, [Holidays])`
Calculates a target date by adding `NumDays` business days to `StartDate`, skipping Saturdays and Sundays (and any dates in the optional `Holidays` list).
- **Example 1 (Standard 5-Day Business SLA):** Compute promised delivery date skipping weekends.
  ```appsheet
  WORKDAY(TODAY(), 5)
  ```
- **Example 2 (Warranty Resolution Deadline):** Set repair turnaround deadline 10 business days from receipt.
  ```appsheet
  WORKDAY([ReceivedDate], 10)
  ```

### `TOTALHOURS(Duration)`, `TOTALMINUTES(Duration)`, `TOTALSECONDS(Duration)`
Converts elapsed `Duration` spans into numeric counts for mathematical calculations. There is no `TOTALDAYS()`; use `TOTALHOURS(x)/24`.
- **Example 1 (Payroll Calculation from Clock In/Out):** Calculate total pay from shift duration.
  ```appsheet
  TOTALHOURS([ClockOutTime] - [ClockInTime]) * [HourlyRate]
  ```
- **Example 2 (Ticket Age in Days):** Calculate how many continuous days a support ticket has been open.
  ```appsheet
  TOTALHOURS(NOW() - [CreatedTimestamp]) / 24
  ```

---

## 5. Math & Numeric Functions

### `SUM(List)`, `AVERAGE(List)`, `MIN(List)`, `MAX(List)`
Performs aggregate statistical computations across a list of numbers or decimals.
- **Example 1 (Order Total from Related Rows):** Compute total order cost by summing child line items.
  ```appsheet
  SUM([Related OrderLineItems][Subtotal]) + [ShippingCost]
  ```
- **Example 2 (Technician KPI Performance):** Calculate the average customer rating for a technician.
  ```appsheet
  AVERAGE(SELECT(CustomerFeedback[Rating], [TechnicianID] = [_THISROW].[TechnicianID]))
  ```
- **Example 3 (Finding Lowest and Highest Vendor Bids):** Find the minimum bid amount among submitted proposals.
  ```appsheet
  MIN(SELECT(VendorBids[BidAmount], [RFP_ID] = [_THISROW].[RFP_ID]))
  ```

### `ROUND(Number)`, `CEILING(Number)`, `FLOOR(Number)`
Rounds numeric values to whole integers. `ROUND` takes a single argument (`ROUND(x, 2)` errors); to round to decimals, scale first.
- **Example 1 (Sales Tax Rounding):** Round calculated sales tax to 2 decimal places.
  ```appsheet
  ROUND([Subtotal] * [TaxRate] * 100) / 100.0
  ```
- **Example 2 (Shipping Container Calculation with CEILING):** Calculate boxes required when items must fit in boxes of 12.
  ```appsheet
  CEILING([TotalItemCount] / 12)
  ```
- **Example 3 (Billable Whole Hours with FLOOR):** Bill clients only for full completed hours worked.
  ```appsheet
  FLOOR(TOTALHOURS([EndTime] - [StartTime]))
  ```

### `ABS(Number)`
Returns the absolute value (magnitude without sign) of a number.
- **Example 1 (Inventory Discrepancy Variance):** Calculate the absolute difference between physical count and system count.
  ```appsheet
  ABS([PhysicalStockCount] - [SystemStockCount])
  ```
- **Example 2 (Budget Variance Percentage):** Calculate variance magnitude regardless of over/under budget.
  ```appsheet
  ABS([ActualExpense] - [BudgetedExpense]) / [BudgetedExpense]
  ```

### `MOD(Dividend, Divisor)`
Returns the integer remainder after dividing `Dividend` by `Divisor`.
- **Example 1 (Alternating Table Row Highlighting):** Determine if a row index is even or odd for styling.
  ```appsheet
  MOD([RowNumber], 2) = 0
  ```
- **Example 2 (Batch Assignment Distribution):** Distribute inspection tickets evenly across 4 work teams.
  ```appsheet
  MOD([TicketNumber], 4) + 1
  ```

### `POWER(Base, Exponent)` & `SQRT(Number)`
Calculates base raised to exponent power, and square roots.
- **Example 1 (Compound Interest Growth):** Calculate future investment value with annual compounding.
  ```appsheet
  [Principal] * POWER(1 + [AnnualInterestRate], [Years])
  ```
- **Example 2 (Euclidean Distance Between GPS Coordinates):** Approximate planar distance between two coordinates.
  ```appsheet
  SQRT(POWER([Lat2] - [Lat1], 2) + POWER([Long2] - [Long1], 2)) * 111.32
  ```

### `RANDBETWEEN(Min, Max)`
Generates a random integer between `Min` and `Max` inclusive.
- **Example 1 (One-Time Verification Code):** Generate a 6-digit confirmation pin in Initial Value.
  ```appsheet
  RANDBETWEEN(100000, 999999)
  ```
- **Example 2 (Random Audit Sample Selector):** Select a random 10% sample of transactions for QA review.
  ```appsheet
  RANDBETWEEN(1, 10) = 1
  ```

---

## 6. Context & Utility Functions

### `USEREMAIL()`, `USERNAME()`, `USERROLE()`
Returns identity details of the currently signed-in AppSheet user. `USERNAME()` is deprecated and often returns blank; prefer `USEREMAIL()`.
- **Example 1 (Defaulting Creator Identity):** Pre-populate author email in Initial Value.
  ```appsheet
  USEREMAIL()
  ```
- **Example 2 (Multi-Tenant Row-Level Security Filter):** Ensure users only see records assigned to them or their company.
  ```appsheet
  OR(USERROLE() = "Admin", [AssignedToEmail] = USEREMAIL())
  ```
- **Example 3 (Personalized Header Greeting):** Display a welcome message in a banner card.
  ```appsheet
  CONCATENATE("Welcome, ", USERNAME(), " | Role: ", USERROLE())
  ```

### `USERSETTINGS("SettingName")`
Reads a configured value from the user settings menu (such as selected branch, warehouse, or language).
- **Example 1 (Filtering by User-Selected Branch):** Slice data based on branch choice in user settings.
  ```appsheet
  [BranchID] = USERSETTINGS("ActiveBranch")
  ```
- **Example 2 (Localized UI Text):** Conditionally display localized prompts.
  ```appsheet
  IF(USERSETTINGS("Language") = "ES", "Bienvenido", "Welcome")
  ```

### `CONTEXT("View")`, `CONTEXT("ViewType")`, `CONTEXT("Host")`, `CONTEXT("AppName")`
Inspects the active runtime UI state and execution context. Other keys: `Table`, `OwnerEmail`. `CONTEXT("Device")` is a device UUID, not a form factor, and there is no phone/desktop key. `View`/`ViewType` are blank outside a view (e.g. automations).
- **Example 1 (Form-Only Field Visibility):** Show guidance notes only when the record is viewed inside a Form view.
  ```appsheet
  CONTEXT("ViewType") = "Form"
  ```
- **Example 2 (Server vs Client Evaluation):** Detect where the expression runs (`"Server"`, `"Browser"` or `"Device"`).
  ```appsheet
  CONTEXT("Host") = "Server"
  ```
- **Example 3 (Specific View Logic):** Allow edits only when accessing through the dedicated review view.
  ```appsheet
  CONTEXT("View") = "Manager_Review_Detail"
  ```

### `UNIQUEID([Type])`
Generates a random alphanumeric identifier: 8 chars by default, or `"UUID"` (version 4) / `"PackedUUID"` (22 chars). Not strictly guaranteed unique, but a duplicate is virtually impossible.
- **Example 1 (Primary Key Generation):** Set Initial Value for row keys to prevent key collisions.
  ```appsheet
  UNIQUEID()
  ```
- **Example 2 (Standard UUID Format):** Generate a 36-character RFC 4122 UUID for external database sync.
  ```appsheet
  UNIQUEID("UUID")
  ```

---

## 7. Deep Link & Navigation Functions

### `LINKTOVIEW("ViewName", [AppName])`
Navigates the user directly to a named view (optionally in another app via the `app-name` argument). `LINKTOROW` and `LINKTOFORM` also accept an optional trailing `app-name`.
- **Example 1 (Return to Dashboard Action):** Redirect user to main summary dashboard upon completing a workflow.
  ```appsheet
  LINKTOVIEW("Operations_Dashboard")
  ```
- **Example 2 (Navigating to Unassigned Queue):** Action button jumping directly to the pending tickets table.
  ```appsheet
  LINKTOVIEW("Pending_Tickets_Table")
  ```

### `LINKTOFILTEREDVIEW("ViewName", [FilterCondition])`
Navigates to a view while dynamically applying a filter condition. It cannot link to another app.
- **Example 1 (Customer Order History):** Open Orders table showing only rows belonging to the clicked customer.
  ```appsheet
  LINKTOFILTEREDVIEW("Orders_Table", [CustomerID] = [_THISROW].[CustomerID])
  ```
- **Example 2 (Overdue Tasks for User):** Open task deck displaying only overdue items for the logged-in user.
  ```appsheet
  LINKTOFILTEREDVIEW("Tasks_Deck", AND([Assignee] = USEREMAIL(), [DueDate] < TODAY(), [Status] <> "Done"))
  ```

### `LINKTOROW([Key], "DetailViewName")`
Opens a specific record identified by its row Key in a specified view.
- **Example 1 (Drilldown from Summary Deck):** Open full details for an invoice when tapped in a summary chart.
  ```appsheet
  LINKTOROW([InvoiceID], "Invoice_Detail_View")
  ```
- **Example 2 (Notification Deep Link):** Send user directly to newly assigned work order from push notification.
  ```appsheet
  LINKTOROW([WorkOrderID], "WorkOrder_Detail_View")
  ```

### `LINKTOFORM("FormViewName", "Column1", val1, "Column2", val2, ...)`
Opens a form view and pre-populates specified fields with initial values.
- **Example 1 (Add Child Line Item with Inherited Parent ID):** Create an order line item pre-filling parent Order ID and date.
  ```appsheet
  LINKTOFORM("OrderDetails_Form", "OrderID", [_THISROW].[OrderID], "ItemDate", TODAY(), "Quantity", 1)
  ```
- **Example 2 (Clone / Duplicate Record):** Pre-fill a new quote form copying details from an existing quote.
  ```appsheet
  LINKTOFORM("Quote_Form", "CustomerID", [CustomerID], "DiscountRate", [DiscountRate], "SalesPerson", USEREMAIL())
  ```

### `LINKTOAPP("AppName")`
Launches a different AppSheet application. The argument is the app's `appName` URL parameter (e.g. `WarehouseManager-1029384`), not a Short Name. The `#view=`/`&row=` suffixes are not documented.
- **Example 1 (Switching to Field Inspection App):** Open the companion warehouse management app.
  ```appsheet
  LINKTOAPP("WarehouseManager-1029384")
  ```
- **Example 2 (Cross-App Deep Link with Specific View):** Use `LINKTOROW` with its `app-name` argument to open a specific record in another app.
  ```appsheet
  LINKTOROW([VehicleID], "Vehicle_Detail", "FleetTracking-992817")
  ```

### `LINKURL("https://...")`
Opens an external HTTP/HTTPS URL, phone link, or mailto link in the device browser or default application.
- **Example 1 (Launch Google Maps Turn-by-Turn Navigation):** Open GPS navigation for a customer's site address.
  ```appsheet
  LINKURL(CONCATENATE("https://www.google.com/maps/dir/?api=1&destination=", ENCODEURL([SiteAddress])))
  ```
- **Example 2 (Open Cloud Storage PDF Attachment):** Open a document stored on Google Drive or S3.
  ```appsheet
  LINKURL([DocumentPublicURL])
  ```

---

## 8. Dereferencing Syntax

### Single-Hop Dereference (`[RefColumn].[TargetColumn]`)
When a column is of type `Ref` pointing to a parent table, access parent columns directly without `LOOKUP()`.
- **Example 1 (Customer Info on Order Detail):** Access customer email and billing tier from `[CustomerID]` Ref column.
  ```appsheet
  [CustomerID].[Email]
  [CustomerID].[BillingTier]
  ```
- **Example 2 (Vehicle Details on Maintenance Record):** Access vehicle make and model from `[VehicleRef]`.
  ```appsheet
  CONCATENATE([VehicleRef].[Make], " ", [VehicleRef].[Model], " (", [VehicleRef].[LicensePlate], ")")
  ```

### Multi-Hop Dereference (`[Ref].[Ref].[TargetColumn]`)
Chain through multiple relational references across multiple tables.
- **Example 1 (Grandparent Account Manager):** From `OrderLineItem` -> `Order` -> `Customer` -> `AccountManager`.
  ```appsheet
  [OrderID].[CustomerID].[AccountManagerID].[Phone]
  ```
- **Example 2 (Subtask to Project Department Lead):** From `Subtask` -> `Task` -> `Project` -> `Department`.
  ```appsheet
  [TaskID].[ProjectID].[DepartmentID].[LeadEmail]
  ```

### Multi-Row / List Dereference (`[RelatedListColumn][TargetColumn]`)
Access a column across all related child records as a `List`, ready for aggregation.
- **Example 1 (Summing Child Line Item Totals):** Calculate invoice subtotal.
  ```appsheet
  SUM([Related OrderLineItems][SubtotalPrice])
  ```
- **Example 2 (Collecting Unique Skills in a Project):** Extract all distinct specialty tags from assigned team members.
  ```appsheet
  UNIQUE([Related ProjectTeamMembers][Specialty])
  ```

---

## 9. Common Formula Recipes & Anti-Patterns

### Recipe 1: Dynamic Dependent Cascading Dropdowns (Valid_If)
In table `Vehicles`, when selecting `Model` dependent on `Make`:
```appsheet
-- In Valid_If for Model column:
SELECT(CarModels[ModelName], [MakeName] = [_THISROW].[Make])
```

### Recipe 2: Multi-Role Row Security Filter
```appsheet
-- In Security Filter for Tickets table:
OR(
  USERROLE() = "Admin",
  [AssignedTechnician] = USEREMAIL(),
  IN(USEREMAIL(), [DepartmentTeamEmailsList]),
  [CreatedBy] = USEREMAIL()
)
```

### Recipe 3: Sequential Numbering per Parent (e.g., Item 1, 2, 3...)
```appsheet
-- In Initial Value for LineItemNumber:
COUNT(SELECT(OrderLineItems[ID], [OrderID] = [_THISROW].[OrderID])) + 1
```
Not safe for concurrent adds (community-reported): two users can get the same number.

### ❌ Anti-Pattern 1: Using `LOOKUP()` when a `Ref` exists
- **Bad:** `LOOKUP([_THISROW].[CustomerRef], "Customers", "CustomerID", "Email")` *(LOOKUP wraps `ANY(SELECT(...))`; more verbose)*
- **Good:** `[CustomerRef].[Email]` *(Simpler, recommended for Ref columns)*

### ❌ Anti-Pattern 2: Missing `[_THISROW]` in `SELECT()`
- **Bad:** `SELECT(Tasks[TaskID], [ProjectID] = [ProjectID])` *(Compares table column with itself; always true)*
- **Good:** `SELECT(Tasks[TaskID], [ProjectID] = [_THISROW].[ProjectID])` *(Compares child ProjectID with current row)*

### ❌ Anti-Pattern 3: Nested `SELECT()` in Virtual Columns over large tables
- **Bad:** `SUM(SELECT(Logs[Hours], [EmployeeID] = [_THISROW].[EmployeeID]))` in a 50,000-row table *(Can be expensive on large tables; unbenchmarked)*
- **Good:** Use `REF_ROWS("Logs", "EmployeeID")` with `SUM([Related Logs][Hours])` or aggregate periodically via Automations.
