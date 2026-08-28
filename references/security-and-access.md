# AppSheet Security, Authentication & Access Control Guide

Comprehensive guide to implementing secure, enterprise-grade Google AppSheet applications, including authentication providers, server-side security filters, Role-Based Access Control (RBAC), column-level permissions, anti-deadlock rules, and governance policies.

---

## Table of Contents
1. [Authentication & Identity Providers](#1-authentication--identity-providers)
2. [The Security Boundary: Server-Side vs UI Visibility](#2-the-security-boundary-server-side-vs-ui-visibility)
3. [Role-Based Access Control (RBAC) Patterns](#3-role-based-access-control-rbac-patterns)
4. [Column-Level Permissions & Dynamic Form Security](#4-column-level-permissions--dynamic-form-security)
5. [Multi-Tenant Data Isolation Patterns](#5-multi-tenant-data-isolation-patterns)
6. [API Security, Webhooks & Secret Management](#6-api-security-webhooks--secret-management)
7. [Enterprise Governance & Audit Trails](#7-enterprise-governance--audit-trails)
8. [Circular Security Filter Deadlock Prevention (Anti-Pattern F4)](#8-circular-security-filter-deadlock-prevention-anti-pattern-f4)
9. [Cross-App Bot Execution Boundaries in Multi-App Hub Architectures](#9-cross-app-bot-execution-boundaries-in-multi-app-hub-architectures)

---

## 1. Authentication & Identity Providers

AppSheet relies on federated identity providers rather than maintaining internal username/password registries.

### Supported Identity Providers
- **Google Workspace / Gmail** (Default for Google Drive / Google Sheets apps)
- **Microsoft Entra ID (Office 365 / Azure AD)**
- **Okta** (Enterprise SAML / OIDC integration)
- **AWS Cognito**
- **Apple ID**
- **OpenID Connect (OIDC)** (Custom enterprise single sign-on)

### Sign-In Configuration Options
1. **Require User Authentication:**
   - Location: `Security > Require Sign-In` -> Enable `Require user authentication`.
   - Populates `USEREMAIL()` and enables user allowlists, domain authentication, and security filters.
2. **User Allow-List vs Domain Authentication:**
   - **Allow-list:** Specific email addresses authorized in `Manage > Users > People to invite`.
   - **Domain Authentication:** Authorize an entire domain (e.g. `@acme-corp.com`).
   - **Domain Groups as Custom Roles:** Sync Active Directory, Google Groups, or Okta groups directly into AppSheet user roles.
3. **App Execution Modes:**
   - **`as app creator` (Default & Recommended):** AppSheet accesses cloud data using the app creator's cloud storage credentials. Users do NOT need direct read/write access to the backend Google Sheet or SQL database.
   - **`as app user`:** AppSheet executes queries with the signed-in user's individual cloud storage credentials. Requires granting backend access to all end users.

---

## 2. The Security Boundary: Server-Side vs UI Visibility

> [!CAUTION]
> **Slices and `Show_If` are NOT security boundaries!**
> Slices and `Show_If` rules execute strictly on the client mobile/web browser. All rows and columns are transmitted over the network and stored in the client device's HTML5 local storage. A malicious or curious user can inspect network payloads or local storage in Developer Tools to see hidden data.

### True Security vs UI Filter Comparison

| Feature | Execution Location | Data Transmitted to Device? | True Security Boundary? | Primary Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Security Filter** | **AppSheet Server / SQL Database** | ❌ **NO** (Filtered before transmission) | ✅ **YES** | Multi-tenant isolation, confidential HR/salary data, GDPR |
| **Table Update Mode** | **AppSheet Server** | N/A (Server enforces mutations) | ✅ **YES** | Restricting Adds, Edits, Deletes by role |
| **Slice** | Client Browser / Mobile | ✅ **YES** (All records downloaded) | ❌ **NO** | Workflow views, stage filtering, tab navigation |
| **Show_If / Hide** | Client Browser / Mobile | ✅ **YES** (Column data in memory) | ❌ **NO** | Dynamic form layouts, conditional UI steps |

---

## 3. Role-Based Access Control (RBAC) Patterns

### The Standard User Role Table Pattern
Create a dedicated `Users` table in your database with the following schema:
- `Email` (Text / Email, Primary Key)
- `FullName` (Text)
- `Role` (Enum: `"Admin"`, `"Manager"`, `"Technician"`, `"Viewer"`)
- `Department` (Enum: `"Sales"`, `"Operations"`, `"Executive"`)
- `IsActive` (Yes/No)

### Resolving User Roles in Formulas

#### Pattern 1: Direct Lookup
```appsheet
LOOKUP(USEREMAIL(), "Users", "Email", "Role")
```

#### Pattern 2: Global Current User Record (Slice Pattern)
Create a Slice named `Current_User` on the `Users` table with RowFilter:
```appsheet
[Email] = USEREMAIL()
```
Because `Current_User[Role]` references a table/slice column, AppSheet evaluates it as a **List** of values (`{"Admin"}`). To extract the scalar value for comparisons and formulas, use `INDEX()` or `ANY()`:
- `INDEX(Current_User[Role], 1)` — Returns the 1st item of the list (official `INDEX()` function).
- `ANY(Current_User[Role])` — Returns an arbitrary item from the 1-row slice list (equivalent to `INDEX(..., 1)`).
- Example: `INDEX(Current_User[Role], 1) = "Admin"` or `ANY(Current_User[Department])`.

### Dynamic Table Access Permissions (`Are updates allowed`)
Set the table-level `Are updates allowed` formula in `Data > Tables > Table Settings`:

```appsheet
IFS(
  LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Admin", "ALL_CHANGES",
  LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Manager", "ADDS_AND_UPDATES",
  LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Technician", "UPDATES_ONLY",
  TRUE, "READ_ONLY"
)
```

### Action Visibility by Role
In `Behavior > Actions > [Action Name] > Behavior > Only if this condition is true`:

```appsheet
AND(
  IN(LOOKUP(USEREMAIL(), "Users", "Email", "Role"), {"Admin", "Manager"}),
  [Status] = "Pending_Approval"
)
```

---

## 4. Column-Level Permissions & Dynamic Form Security

### 1. `Editable_If` Constraints
Controls whether a specific column can be edited in forms or quick-edit views.

- **Lock field after record is approved:**
  ```appsheet
  AND(
    ISBLANK([ApprovalDate]),
    OR(
      [CreatedBy] = USEREMAIL(),
      LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Admin"
    )
  )
  ```
- **Manager-only approval field:**
  ```appsheet
  IN(LOOKUP(USEREMAIL(), "Users", "Email", "Role"), {"Admin", "Manager"})
  ```

### 2. `Show_If` Constraints (UI Visibility)
Controls whether a column or section header is visible in form and detail views.

- **Show salary information only to HR and the individual employee:**
  ```appsheet
  OR(
    [EmployeeEmail] = USEREMAIL(),
    LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "HR_Admin"
  )
  ```
- **Show rejection reason only when status is Rejected:**
  ```appsheet
  [ApprovalStatus] = "Rejected"
  ```

### 3. `Valid_If` for Integrity & Access Boundaries
Ensures that entered values conform to security constraints.

- **Assignee must be an active technician in the same department:**
  ```appsheet
  SELECT(
    Users[Email],
    AND(
      [Department] = [_THISROW].[Department],
      [Role] = "Technician",
      [IsActive] = TRUE
    )
  )
  ```

---

## 5. Multi-Tenant Data Isolation Patterns

Security filters ensure that users only receive their authorized partition of data.

### Pattern 1: User-Centric Filter (Own Records Only)
```appsheet
[AssignedTo] = USEREMAIL()
```

### Pattern 2: Department / Branch Filter
```appsheet
[DepartmentID] = LOOKUP(USEREMAIL(), "Users", "Email", "DepartmentID")
```

### Pattern 3: Hierarchical / Management Chain Filter
Allows employees to see their own records, managers to see their team's records, and admins to see all records:

```appsheet
OR(
  [EmployeeEmail] = USEREMAIL(),
  [ManagerEmail] = USEREMAIL(),
  LOOKUP(USEREMAIL(), "Users", "Email", "Role") = "Admin"
)
```

### Pattern 4: Organization Tenant ID via UserSettings
For multi-tenant SaaS applications:

```appsheet
[TenantID] = USERSETTINGS("TenantID")
```

---

## 6. API Security, Webhooks & Secret Management

### Application Access Key Protection
- AppSheet REST API v2 requires an `ApplicationAccessKey`.
- **Never hardcode access keys** in client-side applications, public repositories, or client-accessible JavaScript.
- Transmit access keys only in HTTP request headers:
  ```http
  ApplicationAccessKey: V2-abc123YourSecureSecretKey
  ```
- If an access key is compromised, regenerate it immediately in `Manage > Integrations > Inbound API`.

### Inbound Webhook Security
- **IP Allowlisting:** Restrict API and database access to Google AppSheet egress IP ranges.
- **Payload Verification:** Verify HMAC signature headers on external webhook endpoints to ensure requests originated from AppSheet.

### Sensitive Data & PII Handling
- Use the **`SecureImage`** column type for sensitive images (generates short-lived, signed URLs that expire automatically).
- Do not store unencrypted passwords, credit card numbers, or government IDs in plain text fields.

---

## 7. Enterprise Governance & Audit Trails

### Enterprise Governance Policies
AppSheet Enterprise administrators can enforce centralized governance policies across all apps in the organization:
- **Enforce User Authentication:** Block creation of public or unauthenticated apps.
- **Restrict External Sharing:** Disallow app sharing with external email domains.
- **Mandate Team Authentication Providers:** Force Google Workspace or Microsoft Entra ID.
- **Allowed Connectors:** Restrict which database connectors (e.g. BigQuery, SQL Server) creators can connect to.

### Audit History & Compliance Logging
Every data add, update, delete, API call, and workflow trigger is permanently logged in the **Audit History** (`Manage > Monitor > Audit History`).
- Records include: Timestamp, User Email, Client IP, Operation Type, Target Table, Record Key, and Diff (Before vs After state).
- **BigQuery Audit Export:** For compliance and SIEM security monitoring, stream AppSheet Audit Logs directly into Google BigQuery.

---

## 8. Circular Security Filter Deadlock Prevention (Anti-Pattern F4)

> [!CAUTION]
> **Never reference a Slice in the Security Filter of the table that the slice is built upon.**

### The Failure Mechanism:
When AppSheet evaluates a Security Filter on Table `A`, it macro-expands any referenced Slice expressions. If the Security Filter on Table `A` contains a formula like:
```appsheet
// ❌ DEADLOCK TRAP on Table 'Orders':
IN([OrderID], ActiveOrdersSlice[OrderID])
```
1. AppSheet tries to load Table `Orders` $\to$ evaluates its Security Filter.
2. The Security Filter queries `ActiveOrdersSlice`.
3. `ActiveOrdersSlice` requires Table `Orders` to be loaded first.
4. **Result:** Infinite recursive expansion or compiler loop $\to$ Sync Timeout (120s+ freeze) and silent mutation errors on initial load.

### Proper Architecture:
Always reference the underlying physical column condition or a lookup to an independent `Users` / `Roles` table directly in the security filter:
```appsheet
// ✅ CORRECT: Direct row-level condition without slice dependency
[Status] = "Active"
```

---

## 9. Cross-App Bot Execution Boundaries in Multi-App Hub Architectures

In enterprise multi-module deployments, developers frequently deploy a **Hub Model** where multiple AppSheet apps connect to the same shared Google Sheet or Cloud SQL database.

### The Critical Automation Rule:
> [!WARNING]
> **Bots fire ONLY within the specific AppSheet application that processed the row change.**
> If App A and App B share the same backend table `Orders`:
> - When a user adds an order inside **App A**, only **App A's** Bots will trigger.
> - **App B's** Bots will **NOT** trigger, even though the row was written to the shared database.

### Multi-App Automation Solutions:
1. **AppSheet API Webhook Tasks:** When App A adds an order, have App A execute an AppSheet REST API Webhook task calling App B's inbound endpoint to trigger downstream workflow automation.
2. **Database Triggers / Cloud Functions:** For database-level multi-app synchronization, use Cloud SQL triggers or Google Apps Script `onEdit` triggers independent of individual app sessions.
