# AppSheet Build Reference (lookup tables)

Purpose: compact, official-source lookup for building AppSheet apps (views, column types, actions, AppSheet databases, limits, Gemini/AI). Tables only; no tutorials. Rows marked **[community]** come from discuss.google.dev, not official Help. Items marked **[unverified]** were not confirmed on an official page. Official pages are cited per section as `support.google.com/appsheet/answer/<id>`. Limits change; re-check the cited page before relying on a number.

Verified on 2026-11-13 against support.google.com/appsheet

---

## 1. View types

Sources: .../answer/10106772 (list), 10106514 (deck/table), 10106385 (detail), 10106384 (dashboard), 10106383 (calendar), 10106601 (map), 10107847 (chart), 11911809 (onboarding + global view options), 10108214 (view events). 11 types are listed officially; no others.

| View | Best for | Key settings | Gotchas |
|---|---|---|---|
| Table | Scrollable rows, many columns | Sort by, Group by, Group aggregate, Column order, Column width, Enable QuickEdit | Inline action (Position=Inline) replaces column content; attach to a separate column to show both. Table-wide options (column headers, keep original order, right-align numerics, disable user sorting) are global, not per view |
| Deck | Row as card, with image | Sort by, Group by, Group aggregate, Main image (Square/Round/Full), Primary header, Secondary header, Summary column (top right), Nested table column (Ref list), Show action bar + Actions | No image column: use virtual column e.g. `TEXT_ICON(INITIALS([NameCol]))`. Actions show only if "Show action bar" is on. Text expressions not supported for inline actions in deck/gallery/table. Nested views can be table, deck, gallery, chart |
| Gallery | Image-led browsing | Official page gives only a one-line description ("showcases data through images"); no settings table found **[unverified settings]** | Bulk actions supported (table/deck/gallery) |
| Detail | One record + prev/next | Main image, Header columns, Quick edit columns, Sort by, Column order, Max nested rows, Slideshow mode, Desktop layout (Split/Full screen), Desktop multicolumn (max 3) | Quick edit needs editable source. Show-type columns are form-only unless "Include Show columns in detail views" is on (mobile shows only Section_Header; desktop shows Section_Header + Page_Header). Each Page_Header starts a new card block, shown only when wide enough |
| Form | Add/edit rows | Default form page style (Default / Page Count / Tabs), form style (Default / Side-by-side), Hide from numbering, Advanced forms automatically, Apply show-if constraints universally | Auto-created for tables allowing adds/updates. If "Apply show-if constraints universally" is off, Show_If applies only in forms. Form Saved view event: a navigating action replaces default nav; a non-navigating action leaves it |
| Calendar | Date/time events | 4 required: Start date, Start time, End date, End time. Description, Category (Color-type column), Default view (Month/Week/Day) | One date/time only: use it for both start and end. Only Google Calendar supported externally (Account > Sources); events must be created in Google Calendar to appear. No native recurring events (workaround: bot that adds events) |
| Map | Address / LatLong / XY | Map column, Secondary data table, Map type (Automatic/Road/Aerial), Location mode (None/Normal/High), Min cluster size (0 = off), Map pin limit, Hide POI, Use my Google Maps integration | Pin limit applied by proximity to view center. Enable own Google Maps integration if >1,000 geocoded addresses/month. High location mode drains battery. XY map uses a public background image. KML layers: 3 MB fetched, 10 MB uncompressed, 10 network links, 1,000 features, 10-20 layers (Google Maps limits). iOS directions need Google Maps app. New addresses geocode with delay |
| Chart | Aggregates/trends | Chart type (Row Series, Column Series, Histogram), line/bar/stacked bar, Group aggregate, Chart columns, Chart colors, Trend line, Show legend | Row Series: each row = series (uniform numeric data). Column Series: each column = series (few rows). Histogram: one column, Y = row count per value. No limits listed on page |
| Dashboard | Several views on one screen | Entries sized Large/Small/Tall/Wide (Large = 2x Small), Use tabs in mobile view, Interactive mode | Can hold calendar, map, chart, gallery, deck, table, detail; **card is not addable**. Size ignored on phones. Order guaranteed only if all entries same size. Interactive mode: row tap updates other views instead of navigating; best when views share a table |
| Card | Content + actions in one element | Official page: one-line description only **[unverified settings]** | Not usable inside a dashboard |
| Onboarding | Intro pages for new users | For this data (onboarding table), Image, Title, Short blurb, Second short blurb, Finish view | Format rules not supported. Title/blurb accept text-based columns only |

Global view options (Settings > Views): starting view, pull to refresh, desktop mode, image upload size, detail style (Normal/Centered/No Headings/Side-by-side), detail image style (Fill/Fit/Background). Image upload size, gallery-input, scan-override and table options cannot be overridden per view. Save the app after changing any setting.

---

## 2. Column types

Source: .../answer/10106435 (Column data types); .../answer/10106509 (column properties); .../answer/10107878 (drop-downs). The page groups types as below. Official page states no input UX for types marked "-".

| Type | Stores | Input UX | Notes |
|---|---|---|---|
| Text | Single line | - | |
| LongText | Multi-line text | - | Preview can render Markdown/HTML in detail views. AppSheet DB cell cap 5,000 chars (see section 4) |
| Name | Person/place name | - | |
| Email | Email address | Auto-completion can be configured | Tap sends email (system action) |
| Phone | Phone number | - | Tap to call or SMS. Auto-recognizes North American formats only |
| Number | Integer | - | 54-bit (-2^53..2^53) in app logic; DB stores 64-bit; app displays 32-bit |
| Decimal | Real number | - | |
| Price | Decimal currency value | - | |
| Percent | Decimal | - | 0% = 0.00, 100% = 1.00 |
| Date | Y/M/D | - | Shown in device time zone/format |
| Time | H/M/S, no date | - | Device time zone/format |
| DateTime | Date + time | - | Device time zone/format |
| Duration | Period in h/m/s | - | |
| Enum | One value from a list | Drop-down in forms | Base type not stated on the type page. "Allow other values" option exists (column properties) |
| EnumList | Multiple values | Drop-down in forms | Like Enum; separator setting applies to EnumList only |
| Ref | Link to a row in another table | - | |
| Yes/No | Boolean | - | |
| Color | One of Black, Blue, Green, Orange, Purple, Red, Yellow, White | - | Used as Calendar category |
| Progress | System Enum: Empty, Quarter, Half, Three Quarter, Full | - | Shown as Harvey balls |
| List | Zero or more values | - | Virtual columns only |
| Image | URL or file name (.jpg, .png, .gif) | Camera or camera roll; optional drawing on image | |
| Thumbnail | Small image | Captured like Image | |
| File | Any file, typically PDF | Capture in browser only | Read-only in app |
| Signature | Small inline image | Touch signature pad | |
| Drawing | Drawing pad image | In-app drawing pad | |
| Video | .mpeg or YouTube URL (incl. embed) | Capture of video not supported | Stores public URL |
| Address | Full address | - | Full value, computed from adjacent component columns, or formula (CONCATENATE). A column name containing "Address" is treated as a full address |
| LatLong | e.g. 48.5564, -122.3421 | One-click fill of current location | Map pin system action |
| XY | "x,y" on a background image, 0,0 top-left, 100,100 bottom-right | - | Background image must be public |
| URL | Web address, optional display text | - | Content/Display properties |
| App | Link to another app or a view in this app | - | |
| ChangeCounter | Count of app edits | Auto | Increments on any column change by default; can be limited to columns/values |
| ChangeTimestamp | Time of last app edit (user time zone) | Auto | Offline: stores change time, not sync time |
| ChangeLocation | GPS of the change | Auto | |
| Show | Empty sheet column used as layout header | - | Forms by default; detail views only with "Include Show columns in detail views" (UX > Options > Detail View) |
| Multi Column Key | Composite key from several fields | - | Listed under "Other" |

Also listed: "Update row timestamp" (last change via database editor or app, local time zone, read-only; not the same as ChangeTimestamp). Per .../10106435, data-change actions cannot set the key column, App formula columns, or ChangeCounter/ChangeLocation/ChangeTimestamp (from Actions: The Essentials, 10107706).

---

## 3. Actions

Sources: .../answer/10107706 (Actions essentials), 10108131 (system actions), 10108214 (view events), 10107372 (bulk actions), 13779963 (inputs), 11621688 (INPUT function).

### 3a. Action families and types

| Family / type | What it does | Key settings | Gotchas |
|---|---|---|---|
| Navigation: go to another view / app | Moves user; client only | Target (expression/view) | Navigation and external actions run only on device/browser |
| Navigation: edit row, copy row and edit, add row via form, export/import CSV | Opens form / import flow | | |
| Data-change: set the values of some columns in this row | Updates current row | Inputs (this type only), `[_INPUT].[name]` | Cannot set key column, App formula columns, ChangeCounter/Location/Timestamp |
| Data-change: add a new row to another table | Inserts row elsewhere | Column values | Runs on device or cloud service |
| Data-change: delete row | Deletes | | |
| Data-change: execute an action on a set of rows | Runs a referenced action on rows selected by expression | Referenced Rows (list of keys, e.g. via FILTER/SELECT/Related), Referenced Action | [community] cannot be invoked through the AppSheet API; only data-change and grouped actions can. [community] the referenced action choices can be limited |
| External: go to website, open file, start email, call, text | Interacts with device | | Run client-side only. "Start an email" opens the email app; it does not send |
| Grouped: execute a sequence of actions | Runs actions in order | Ordered list | Desktop and new mobile framework: only one navigation or external action runs and it ends the group. Validation rules apply at each step |

### 3b. Common action settings

| Setting | Detail |
|---|---|
| Position | Primary, Prominent, Inline, Hide |
| Display name / icon | Name fixed or text expression; every action needs an icon (type default otherwise) |
| Only if this condition is true | Controls which rows show the action |
| Needs confirmation? | With confirmation message |
| Primary action cap | 6 (new mobile framework, preview), 4 (legacy mobile) |
| Where shown | Quick action buttons (detail), bulk actions (table/deck/gallery), inline beside a column |
| Triggers | Button tap; implicit via view events; bot (automation) |
| Reordering | Changes order in app only, not editor |

### 3c. System actions (auto-generated from column structure)

| Action | What it does | Gotchas |
|---|---|---|
| Email-column action (envelope icon) | Opens an email to the address | Only presentation props and show-condition editable; rebuilt (customizations lost) if table columns change |
| LatLong map action (pin icon) | Opens map at location | Same |
| Add / Edit / Delete / View Related (Ref) / View Map (Address) | Generated per table/column; selectable as view-event actions | The page does not enumerate all names; "Compose email" is not an official name, use External "Start an email" **[unverified naming]** |

"Do not display" hides the icon but the action still exists and is usable.

### 3d. View events

| Event | Views | Default | Effect |
|---|---|---|---|
| Row Selected | Table, deck, gallery | Opens detail view | Any assigned action replaces default, even if non-navigating |
| Form Saved | Form (add and edit) | Standard navigation (auto-reopen, finish view) | Navigating action replaces default; non-navigating leaves it |

Rules: only actions on the same source table as the view are eligible; multiple actions must be combined in a grouped action; "Auto assign" restores built-in behavior; not all view types support event actions.

### 3e. Bulk actions

| Item | Detail |
|---|---|
| Views | Table, deck, gallery (view must have actions or allow delete) |
| Creator-driven | "Data: execute an action on a set of rows" selects rows by expression |
| User-driven | Select button or long-press, tap rows, tap action (top right) |
| Gotchas | Only actions valid for every selected row appear. With delayed sync, changes queue; otherwise sync starts immediately. No numeric row limits stated on the page |

### 3f. INPUT / inputs

| Item | Detail |
|---|---|
| Current method | Define inputs in the action's Advanced > Inputs (name + initial value); reference `[_INPUT].[name]` in a data-change action (13779963) |
| Legacy `INPUT("name", default)` | Page 11621688 says it is "no longer supported"; use `[_INPUT]`. The two cannot be mixed in the same action/task |
| Sources of value | App: dialog prompts user. Automation: "Run a data action" step, "Set row values". Referenced Action: binding expression |
| Rules | Reference input directly; nested expressions such as `[Amount]+[_INPUT].[Amount]` suppress the prompt. `[_THIS]`/`[_INPUT]` not supported in an input's initial value. Inputs only for the set-column-values action type |
| Not documented | Supported input data types; max number/size of inputs |

---

## 4. AppSheet databases

Source: .../answer/12653576 (Restrictions, limits, and known issues). Community notes **[community]**: discuss.google.dev threads report conflicting older row figures and that the row cap is per database, not per table; treat the official page as authoritative.

| Limit | Value |
|---|---|
| Rows per database: Free | 1,000 (5 databases) |
| Rows per database: Starter | 2,500 (5 databases) |
| Rows per database: Core and Publisher Pro | 2,500 (10 databases) |
| Rows per database: Enterprise Plus | 200,000 (can be raised via AppSheet Sales); unlimited databases (200 per user) |
| Tables per database (all plans) | 20 |
| Columns per table (all plans) | 100 |
| Characters per cell | 2,000 |
| Characters per LongText column | 5,000 |
| At the cap | Existing data kept, read/edit allowed, adding new data blocked |

Column types: AppSheet DB supports the standard types in section 2 **[column-type subset per DB not confirmed on an official page]**.

When to choose (from official facts only):

| Choose | When |
|---|---|
| AppSheet database | Starter/Core/Enterprise all include it. Rows are capped per plan (above); pick it when data fits 2,500 rows (Core) or 200,000 (Enterprise Plus). Gemini app creation builds on an AppSheet database |
| Google Sheets / Excel etc. | Per-spreadsheet limit 100K rows and 1,000 columns (answer 10104789); standard connectors on all plans |
| Cloud SQL / BigQuery etc. | MariaDB, MySQL, PostgreSQL, SQL Server, Oracle, BigQuery, DynamoDB, OData, Apigee, on-prem DB, Salesforce, AppSheet API connectors are Enterprise Plus (answer 10105400) |

---

## 5. Design-impacting limits

### 5a. Data and app size (answer 10104789, plus tables-per-app page)

| Item | Limit / guidance |
|---|---|
| Compressed data per app | 5 MB or 10 MB depending on device |
| Rows per spreadsheet | 100K max |
| Columns per spreadsheet | 1,000 max |
| Images/documents | Not counted toward data size; not cached on device by default (offline image cache stored separately) |
| Performance | Official page says degradation often begins before limits (iteration, sync, responsiveness); fewer cells helps |
| Tables per application | No enforced limit; page says complex apps often 20-30 tables and 20-30 views; performance degrades with table/column count. App definition has a size limit; no figure found **[unverified number]** |
| Geocoding | Enable own Google Maps integration beyond 1,000 geocoded addresses/month |

### 5b. Automation limits (answer 11828262; daily limits refresh 12:00 AM PST)

| Item | Limit |
|---|---|
| Table record size processed by a bot (images excluded) | 10 MB |
| Concurrent bots | 5,000 |
| Process wait state | 30 days max |
| "Wait for a condition" steps (per owner) | 100,000/day; 2,000 per 20 min |
| "Wait for a period of time" steps (per owner) | 30,000/day; 150 per 3 min |
| Runs from app-change events | 500,000/day and 50,000 per 5 min per app owner account |
| Runs from scheduled events | 500,000/day and 50,000 per 5 min per app owner account |
| External event triggers (AppSheet DB, Chat, Forms) | 100,000/day; 500/min; 20 events per table |
| Notifications from automations | 60,000/day per owner; 1,500/min |
| For Each Row in Table: deployed app | 10,000 rows |
| For Each Row in Table: prototype app | 1,000 rows |
| Chat space IDs per Chat message automation | 3,000 |
| Schedule event execution time | 5 minutes |
| App event execution time | 2 minutes |
| PDF files | 2,500/day per owner; 20/second |
| Bot run data retention | 55 days |
| Email recipients/hour | Free 5; Starter/Core/Publisher Pro 200-400; Enterprise Plus 25,000 |
| Email recipients/day | Free 30; Starter/Core/Publisher Pro 1,000-20,000; Enterprise Plus 50,000 |
| Document extraction (IDP) | 20 MB, 5 pages, PDF/GIF/TIFF/JPEG/PNG |

Scheduled-bot retry behavior (waits up to 5 min, retries up to 3 more times) and Wait-step timing imprecision appear in search snippets of official docs; Apps Script call timeouts of ~60 s are **[community]** only.

### 5c. Plan-gated features (answer 10105400; table columns Starter / Core / Enterprise Plus)

| Feature | Starter | Core | Ent+ |
|---|:-:|:-:|:-:|
| AppSheet databases, automated emails, sharing, Gemini for App Creation | Y | Y | Y |
| Branded apps, barcode/NFC, scheduled events, Smart Assistant, manage users by roles | - | Y | Y |
| Security filters, private tables, encrypt device data, image/file URL signing, secure image/PDF access | - | Y | Y |
| Delta sync, Quick sync, Server caching | - | Y | Y |
| Policies (account level) | - | Y | Y |
| Gemini in AppSheet Solutions (AI tasks) | - | - | Y |
| OCR and predictive models | - | - | Y |
| Cloud object store for image/file capture | - | - | Y |
| Stable version control, version restoration | - | - | Y |
| Data source and worksheet partitioning | - | - | Y |
| Auth: Active Directory, AWS Cognito, Google Group, Okta, OpenID Connect | - | - | Y |
| Data: AppSheet API, Apigee, DynamoDB, BigQuery, MariaDB, MySQL, OData, on-prem, Oracle, PostgreSQL, Salesforce, SQL Server, Drive folder for Doc AI | - | - | Y |
| Teams/org policies, Audit History alerts, Looker Studio, priority support | - | - | Y |
| Standard connectors (Sheets, Excel, Drive, Forms, Calendar, Airtable, Smartsheet), automation monitor, performance analyzer | Y | Y | Y |

AppSheet REST API: page 10105769 states "supported for Enterprise plans only". Enable in Settings > Integrations ("IN: from cloud services to your app"); every call needs an Application Access Key (must be unexpired); toggle is app-wide; policy "Disable external integration through app API" (`[EnableAPI]=false`) can block it. No request quotas on that page. [community] some users report calling the API from within an app on Core; unverified.

---

## 6. Gemini / AI

Sources: .../answer/14699210 (create apps with Gemini), 16045284 (AI in automations), 15999115 (limits), 16622530 (credits/quotas), 11828262 (IDP limits).

| Item | Detail |
|---|---|
| Gemini app creation | My Apps > + Create > App > Start with Gemini. Describe app, review proposed structure, create; opens in editor on an AppSheet database with sample data |
| App creation plans | All paid accounts: Workspace Core / Enterprise Plus; individual Publisher Pro, Starter, Core, Enterprise Plus (answer 14699210). Plan table 10105400 lists it for Starter, Core, Enterprise Plus |
| App creation gotchas | Sample data may be inaccurate: remove before use. Suggested tables/columns can miss things (e.g. Image column). Id column cannot be edited/deleted. Single/multi-select columns need options entered. Admin disable is per team |
| AI task types (automation step) | Categorize (pick columns to evaluate + column of allowed values), Extract (image/PDF/text to columns), Extract rows (image/PDF to rows of an existing table), Summarize (long text to short summary) |
| AI plan requirement | Enterprise Plus only (Gemini in AppSheet Solutions) |
| Inputs | Images, PDFs, text |
| Limits | Image 5 MB; File 12 MB; ~30 queries/min; max 50 records fetched by Extract rows and Categorize; per-app per-minute quota |
| Credits | Consumed by number/complexity of AI tasks run by users of apps owned by org creators; exact credit amounts not on page 16622530 (see "Manage credits for Gemini usage") |
| Governance | Admin policy "Disable Gemini in AppSheet Solutions (AI Tasks)" |
| Model limitations (official) | Weak at analog gauges, low-res/rotated/poor images, counting objects, identifying non-celebrity people; images inside PDFs may process badly |
| Testing | AI Task step testing is available (announcement says GA); [community] outputs can ignore instructions, so test before going live |
| Not documented | Model names; credit amounts per task |
