# AppSheet Advanced UI/UX, Dynamic SVG & HTML Guide

This guide details advanced techniques for elevating AppSheet UI/UX using **HTML Formatting in `LongText` columns**, inline **Dynamic SVG Generation**, and **QuickChart.io** visual integration, incorporating verified patterns and constraints from the AppSheet developer community (`discuss.google.dev`).

---

## 1. HTML Formatting in AppSheet (`LongText` Columns)

### How HTML Rendering Works in AppSheet
In AppSheet, rich-text HTML rendering is **not** handled by standard `Show` columns. Instead, it is configured on **`LongText`** type columns:

1. **Column Setup:** Set column type to **`LongText`**.
2. **Text Format Option:** In the column definition settings, set **Text format** to **`HTML`** (or `Markdown`).
3. **Supported Views:** Rich-formatted HTML is rendered in **Detail views** (the only documented place; official announcement: https://discuss.google.dev/t/rich-text-formatting-in-preview-program/74589). In Table, Deck, or Card views the column shows the raw text, so the **tags stay visible as literal text** (they are not stripped). Do not rely on Form preview rendering (unverified).
4. **Line breaks:** a 2025 community bug report showed HTML-format LongText dropping newline characters; use `<br>` / `<p>` explicitly, or `SUBSTITUTE([Notes], CHAR(10), "<br>")` for free-text fields (https://discuss.google.dev/t/bug-appsheet-longtext-html-formatting-issue-no-line-breaks/187352).

---

### AppSheet HTML Sanitizer: Whitelisted Tags vs Stripped Elements

AppSheet enforces a strict HTML sanitizer for security and cross-platform layout stability.

| Category | Supported & Rendered Tags | Community Behavior & Notes |
| :--- | :--- | :--- |
| **Text Styling** | `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<mark>`, `<small>`, `<del>`, `<ins>`, `<sub>`, `<sup>` | Standard inline typography formatting. |
| **Headings & Hierarchy** | `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>` | Renders clean section titles in Detail views. |
| **Structure & Flow** | `<p>`, `<br>`, `<hr>`, `<blockquote>` | Paragraphs, line breaks, dividers, and indented callout quotes. |
| **Lists** | `<ul>`, `<ol>`, `<li>` | Bulleted and numbered lists. |
| **Links & Media** | `<a href="...">`, `<img src="...">` | Clickable hyperlinks and dynamic inline images. **All other attributes are removed**: only `a` `href`/`name`/`target` and `img` `src` survive (no `width`, `height`, `style`, `class`). |
| **Tables** | `<table>`, `<tbody>`, `<tr>`, `<td>`, `<th>` | Tabular data grids (rendered with default theme table styling). |

#### ❌ What is STRIPPED or NOT Supported by AppSheet's HTML Sanitizer:
- ❌ **`<div>`, `<span>`, `<font>` Tags:** Not in the supported list; the announcement says unsupported tags render as plain text (not individually documented; assume unsupported).
- ❌ **ALL attributes except `a` `href`/`name`/`target` and `img` `src`:** Includes inline CSS `style="..."`, `class`, **`width`/`height` on `<img>`, and `colspan`/`rowspan` on `<td>`**. Expressions like `<p style="color:red">` or `<td colspan='3'>` lose the attribute.
- ❌ **Custom CSS:** `<style>`/`<link>` tags are not supported (`class` is removed like every other attribute).
- ❌ **JavaScript:** `<script>` and `onclick` are not in the whitelist (assume blocked; not explicitly documented).
- ❌ **`Show` Columns:** Have no `HTML` text-format selector (Show categories are Text, URL, Image, Video; Markdown support there is unverified).

> [!TIP]
> **When to use HTML vs Dynamic SVG:**
> - Use **`LongText` (HTML format)** for structured documents, audit logs, bullet lists, blockquotes, inline hyperlinks (`<a>`), and simple tables.
> - Use **Dynamic SVG (Show column with category Image, or Image type)** whenever you need custom brand colors, background fills, rounded corners, borders, badges, progress bars, or metric cards. Presentation attributes (`fill=`, `stroke=`) and `style=` on SVG elements survive; a `<style>` block inside the SVG may not in HTML LongText (see the warning in section 2).
> - **Image-type column caveat:** an `Image` type column draws a gray frame around the SVG. The community prefers a **`Show` column with category `Image`** (https://discuss.google.dev/t/svg-experts-why-wont-this-svg-code-work-in-an-image-column/61540).

---

### Verified HTML Formula Examples (`LongText`, Format: `HTML`)

#### Example 1: Formatted Inspection & Audit Card
```appsheet
CONCATENATE(
  "<h3>Inspection Report #", [ReportID], "</h3>",
  "<p><b>Site:</b> ", [SiteName], "<br>",
  "<b>Auditor:</b> <i>", [AuditorName], "</i><br>",
  "<b>Result:</b> <mark>", UPPER([AuditStatus]), "</mark></p>",
  "<blockquote>", [AuditorNotes], "</blockquote>",
  "<hr>",
  "<p><small>Recorded on ", TEXT([Timestamp], "YYYY-MM-DD HH:MM"), " | AppSheet Auto-Log</small></p>"
)
```

#### Example 2: Structured Line-Item Table
```appsheet
CONCATENATE(
  "<h4>Invoice Line Items</h4>",
  "<table>",
  "<tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr>",
  "<tr><td>Consulting Hours</td><td>", [Hours], "</td><td>", TEXT([Rate], "$#,##0.00"), "</td><td>", TEXT([Hours] * [Rate], "$#,##0.00"), "</td></tr>",
  "<tr><td>Site Travel</td><td>1</td><td>", TEXT([TravelFee], "$#,##0.00"), "</td><td>", TEXT([TravelFee], "$#,##0.00"), "</td></tr>",
  "<tr><td><b>Grand Total Due</b></td><td></td><td></td><td><b>", TEXT([TotalDue], "$#,##0.00"), "</b></td></tr>",
  "</table>"
)
```

#### Example 3: Rich Media & Direct Hyperlinks
```appsheet
CONCATENATE(
  "<p><b>Equipment Manual:</b> <a href=' ", [ManualURL], "'>Open PDF Document</a></p>",
  "<p><img src=' ", [DiagramURL], "' /></p>",
  "<ul>",
  "<li>Check safety valve before starting.</li>",
  "<li>Verify pressure gauge is calibrated.</li>",
  "</ul>"
)
```

---

### Embedding Dynamic SVGs Directly Inside `LongText` (HTML Format) Columns

While AppSheet's HTML sanitizer strips all inline CSS (`style="..."`) and every attribute except `img` `src` / `a` `href`/`name`/`target`, you can **embed styled Dynamic SVGs inside a `LongText` (format: `HTML`) column** using `<img src="data:image/svg+xml;utf8,...">`. It works because `src` is a permitted attribute (community-reported; not in official docs). The `src` value takes double quotes, because the SVG inside it uses only single quotes.

> [!WARNING]
> **Size the SVG itself.** `<img>` gets no `width`/`height`/`style` in HTML LongText, so use a plain `<img src=...>` and control size through the SVG's own `width`/`height`/`viewBox`. Keep SVG styling as inline presentation attributes (`fill=`, `stroke=`) or `style=` on SVG elements. A `<style>` block inside the SVG has been reported (community, ~Sep 2026) to make the whole SVG vanish in HTML LongText: https://discuss.google.dev/t/dynamic-svgs-in-html-longtext-columns-no-longer-working/400281.

#### Why This Pattern Is Useful:
1. **Works Around Attribute Stripping:** Renders colored badges, progress meters, and status pills inline with headings, lists, and tables.
2. **Unified Document Layout:** Combines structured text, tabular data, and visual vector indicators in a single column in Detail views without needing multiple virtual `Image` columns.
3. **No External Image Service:** The graphic is inlined as a Data URI instead of fetched from an image API.

#### Implementation Rules:
- Column Type: **`LongText`**
- Text Format: **`HTML`**
- Hex Colors: `#` must be URL-encoded in data URIs. Wrap the SVG in **`ENCODEURL()`** (or manually encode `#` as **`%23`**).
- Quotes: Follow the [Critical Quoting Rules](#-critical-quoting-rules-tested-by-author) below — single quotes everywhere inside the SVG, `src=` wrapped in a real double quote supplied by the `'"'` literal.

#### Example 4: Mixed HTML Document with Inline Dynamic SVG Status Badge
```appsheet
CONCATENATE(
  "<h3>Work Order #", [OrderNumber], "</h3>",
  "<p><b>Assigned To:</b> ", [TechnicianName], "<br>",
  "<b>Priority:</b> ", [Priority], "</p>",
  "<p><b>Live Status:</b><br>",
  "<img src=", '"', "data:image/svg+xml;utf8,",
  ENCODEURL(CONCATENATE(
    "<svg xmlns='http://www.w3.org/2000/svg' width='140' height='32' viewBox='0 0 140 32'>",
    "<rect width='140' height='32' rx='16' fill=' ",
    IFS(
      [Status] = "Completed", "#28a745",
      [Status] = "In Progress", "#ffc107",
      TRUE, "#dc3545"
    ),
    "'/>",
    "<text x='70' y='21' font-family='Arial, sans-serif' font-size='13' font-weight='bold' text-anchor='middle' fill=' ",
    IFS([Status] = "In Progress", "#212529", TRUE, "#ffffff"),
    "'>",
    UPPER([Status]),
    "</text></svg>"
  )),
  '" /></p>',
  "<blockquote>", [CustomerNotes], "</blockquote>"
)
```

#### Example 5: HTML Table with Inline Mini Progress Bars
```appsheet
CONCATENATE(
  "<h4>Milestone Tracker</h4>",
  "<table>",
  "<tr><th>Milestone</th><th>Progress</th><th>Weight</th></tr>",
  "<tr><td>Phase 1: Discovery</td><td>",
    "<img src=", '"', "data:image/svg+xml;utf8,",
    ENCODEURL(CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='16' viewBox='0 0 100 16'><rect width='100' height='16' rx='8' fill='#e9ecef'/><rect width=' ",
      MIN(LIST(100, INT([Phase1Pct]))),
      "' height='16' rx='8' fill='#007bff'/><text x='50' y='12' font-family='Arial' font-size='10' fill='#333333' text-anchor='middle' font-weight='bold'>",
      [Phase1Pct], "%</text></svg>"
    )),
    '" />',
  "</td><td>30%</td></tr>",
  "<tr><td>Phase 2: Deployment</td><td>",
    "<img src=", '"', "data:image/svg+xml;utf8,",
    ENCODEURL(CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' width='100' height='16' viewBox='0 0 100 16'><rect width='100' height='16' rx='8' fill='#e9ecef'/><rect width=' ",
      MIN(LIST(100, INT([Phase2Pct]))),
      "' height='16' rx='8' fill='#28a745'/><text x='50' y='12' font-family='Arial' font-size='10' fill='#333333' text-anchor='middle' font-weight='bold'>",
      [Phase2Pct], "%</text></svg>"
    )),
    '" />',
  "</td><td>70%</td></tr>",
  "</table>"
)
```

---

## 2. Dynamic SVGs (Client-Side Visuals)

### Why Use Dynamic SVGs in AppSheet?
- **No External Image Request:** SVGs are delivered via `data:image/svg+xml;utf8,...` Data URIs built from the row, so no image-hosting service is needed (performance not measured; the community warns very complex SVGs can be slow on older devices).
- **Rich Styling Support:** Unlike HTML in AppSheet (which strips CSS `style`), SVG presentation attributes (`fill`, `stroke`, `rx`, `viewBox`, `text-anchor`, `font-size`, `font-family`, `transform`) and `style=` on SVG elements are preserved. **Exception:** a `<style>` block inside the SVG is at risk in HTML LongText (see warning below).
- **Dynamic & Reactive:** Vector attributes change dynamically based on row values.

### Where to Put the Formula
- **Preferred:** a virtual column of type **`Show`** with category **`Image`**. An `Image`-type column draws a gray frame around the SVG; the community prefers Show + Image (https://discuss.google.dev/t/svg-experts-why-wont-this-svg-code-work-in-an-image-column/61540).
- **Inside HTML LongText:** wrap in `<img src="...">` (Templates 4/6/examples 4-5). Plain `<img>` only, no size attributes.
- **Size limit:** a Google Sheets cell holds at most 50,000 characters, so a long SVG string stored in a Sheets column can be truncated. Compute it in a virtual column instead of storing it (https://discuss.google.dev/t/dynamic-svg-graphics/76674).
- Very complex SVGs may be slow on older devices (same thread).

---

### The Recommended `ENCODEURL()` Pattern for Dynamic SVGs

Instead of manually encoding hex `#` colors to `%23` or escaping spaces and unicode characters, **always wrap your SVG XML in `ENCODEURL()`**:

```appsheet
CONCATENATE(
  "<img src=",
  '"',
  "data:image/svg+xml;utf8,",
  ENCODEURL(
    CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' width='500' height='400' viewBox='0 0 500 400'>",
      "<rect width='500' height='400' fill=' ", [Color], "'/>",
      "</svg>"
    )
  ),
  '" />'
)
```

### ⚠️ Critical Quoting Rules (Tested by Author)

> Tested by the author; not officially documented. A community thread suggests **doubling the quotes** (`""`) as an alternative: https://discuss.google.dev/t/dynamic-svg-graphics/76674. If a rule below fails in your app, try that.

AppSheet has **no backslash escape** (`\"` is not valid) and its parser mis-reads a string literal that ends in `'"`. Two rules, both mandatory:

1. **Everything inside the SVG uses single quotes (`'`).** Every attribute (`fill='...'`, `viewBox='...'`, `href='#ok'`, `transform='...'`), in every branch of every `IF`/`IFS`. Never `"` and never `\"` inside SVG markup. The only double quotes in the output are the two around the `src=` value, and those come from single-quoted AppSheet literals: `'"'` to open and `'" />'` to close.
2. **A string literal must never end with `'"` right before the comma — put a space between them: `' "`.** This happens every time an attribute value is opened and then filled by an expression:

```appsheet
❌  "<line x1='60' y1='65' stroke='", IF(...), "'/>"
✅  "<line x1='60' y1='65' stroke=' ", IF(...), "'/>"
```

The leading space ends up inside the attribute value (`stroke=' #1a237e'`). SVG trims it, so the output still renders correctly. Closing fragments that *start* with `'` (`"'/>"`, `"'>"`) are fine as they are.

> [!TIP]
> **WARNING: avoid `<style>` blocks in SVGs placed in HTML `LongText`.** The author once tested a `<style>` block with CSS classes inside the data-URI SVG as working, but community reports from ~Sep 2026 say SVGs containing `<style>` now **vanish entirely** in HTML LongText while still working in `Image` / `Show` Image columns (https://discuss.google.dev/t/dynamic-svgs-in-html-longtext-columns-no-longer-working/400281). Prefer **inline presentation attributes** (`fill='...'`, `stroke='...'`) or `style='...'` on the SVG elements. `<style>`/classes are only safe in Image columns. `<defs>` + `<use>` and SMIL `<animate>` are not covered by those reports and are unverified in HTML LongText (see [Template 7](#template-7-animated-vertical-stepper-image-column-only--at-risk-in-html-longtext)).

#### Why `ENCODEURL()` is Superior:
1. **Natural CSS Hex Colors:** Write `#ffffff`, `#10b981`, `#ef4444` directly without tedious manual `%23` conversion.
2. **Full Unicode / Multi-Language Support:** Renders Vietnamese accents, Japanese, Chinese, Spanish, or emoji directly in `<text>` nodes without encoding corruption.
3. **Seamless External Debugging:** The raw SVG string can be copied directly into tools like **SVGViewer**, VS Code, or browser DevTools for immediate live visual previewing.
4. **Scaling:** `<img>` `style`/`width`/`height` are stripped in `LongText` (format: `HTML`), so scaling comes from the SVG itself: always set `viewBox` (plus the SVG's own `width`/`height`) on the root `<svg>`.

---

### SVG Optimization & Clean Architecture Rules
1. **Use Coordinate Groups (`<g transform='translate(0, Y)'>`):**
   - When building multi-step steppers, timelines, or repeating cards, use `<g transform='translate(0, 110)'>` to shift vertical steps down rather than recalculating individual $Y$ coordinates for every line, circle, and text element.
2. **Minify Vector Geometry:**
   - Use simple primitives (`<line>`, `<circle>`, `<rect>`, simple `<path>`) instead of bloated SVG paths generated by vector editors.
3. **Format AppSheet Expressions for Readability:**
   - Structure conditional logic (`IFS()`, `IN()`, `ISBLANK()`) with clean line breaks and indentation so developers can easily trace state machine transitions.

---

### What You CAN'T Do in AppSheet SVGs (Traps & Failure Modes)

| ❌ Failure Mode / Trap | Why It Fails in AppSheet | ✅ What To Do Instead |
| :--- | :--- | :--- |
| **Unencoded `#` in Hex Colors** (`fill='#28a745'`) | In a data URI `#` starts a URL fragment, so it must be encoded (standard URL behavior); otherwise the rest of the SVG string is cut off. | Wrap the entire SVG XML in **`ENCODEURL()`**, or manually encode `#` as `%23` (`fill='%2328a745'`). |
| **Double Quote Syntax Collisions** (tested by author) | Per the author's tests, `\"` or doubled `""` inside formula strings broke the parser. A community thread suggests doubling quotes works (https://discuss.google.dev/t/dynamic-svg-graphics/76674); unreconciled. | Author's approach: single quotes (`'`) for **all** SVG attributes; emit the `src=` double quotes with the `'"'` / `'" />'` literals. Alternative to try: doubled quotes. |
| **`'"` Right Before a Comma** (`stroke='",`) (tested by author) | Per the author's tests the parser mis-reads the literal ending. | Insert a space: `stroke=' ",`. SVG trims the leading space in the value. |
| **Missing `xmlns` Namespace** | SVG used as an image generally needs `xmlns='http://www.w3.org/2000/svg'` (standard SVG-as-image behavior, not AppSheet-specific); without it a broken icon is typical. | Always include `xmlns='http://www.w3.org/2000/svg'` in the root `<svg>` element. |
| **`<script>` Tags or Event Handlers** | SVG rendered via `<img>` / data URI does not run scripts or load external resources (standard browser rule, not AppSheet-specific). | Use pure declarative SVG vector properties and AppSheet formula conditions (`IFS()`, `IF()`). |
| **External Fonts** (`@import url(...)`) | SVG-as-image cannot load external resources such as web fonts (browser rule), so text falls back. | Use standard system fonts: `font-family='system-ui, -apple-system, sans-serif'`. |
| **External Images** (`<image href='http...'>`) | SVG-as-image cannot load external resources (browser sandbox rule, not CORS). | Use native SVG vector shapes or embedded Base64 `<image href='data:image/png;base64,...' />`. |
| **Fixed Dimensions without `viewBox`** | Without `viewBox` the SVG cannot scale, and in HTML `LongText` you cannot rescale it via `<img>` attributes (stripped). | Always define `viewBox='0 0 W H'` plus the SVG's own `width`/`height` on the root `<svg>`. |
| **`<style>` block in HTML `LongText`** | Community-reported (~Sep 2026): the whole SVG disappears. | Use `fill=`/`stroke=`/`style=` on elements; keep `<style>` for Image columns only. |
| **Long SVG stored in a Sheets column** | Google Sheets cells hold at most 50,000 characters. | Compute the SVG in a virtual column. |

---

### ❌ Bad vs ✅ Good SVG Code Comparison

#### ❌ Bad SVG Formula (Will Break in the Expression Parser and as a Data URI)
```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg width="100" height="100">",
  "<circle cx='50' cy='50' r='40' fill='#ff5722' />",
  "<text x='50' y='55' fill='#ffffff'>", [Score], "</text>",
  "</svg>"
)
```
*Why it fails:*
1. Unescaped double quotes (`"100"`) cause syntax parsing errors in AppSheet.
2. Missing `xmlns='http://www.w3.org/2000/svg'` namespace typically causes a broken image.
3. Unencoded `#` in `#ff5722` truncates the Data URI at the first `#` (URL fragment).

#### ✅ Good SVG Formula (Robust, Universally Compatible with `ENCODEURL()`)
```appsheet
CONCATENATE(
  "<img src=",
  '"',
  "data:image/svg+xml;utf8,",
  ENCODEURL(
    CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>",
      "<circle cx='50' cy='50' r='40' fill='#ff5722' />",
      "<text x='50' y='56' font-size='22' font-family='system-ui, sans-serif' font-weight='bold' text-anchor='middle' fill='#ffffff'>",
      [Score],
      "</text>",
      "</svg>"
    )
  ),
  '" />'
)
```
*Why it succeeds:*
1. `ENCODEURL()` handles all `#` hex colors, spaces, and unicode characters automatically.
2. Proper `xmlns` namespace and `viewBox` let the vector scale to its container.
3. Separate `'"'` tokens and space padding ensure clean formula compilation in AppSheet.
4. Plain `<img src=...>` is used because `style`/`width`/`height` on `<img>` are stripped in `LongText` HTML; scaling comes from the SVG's `viewBox`.

---

## 3. Production-Ready Dynamic SVG Formula Templates

### Template 1: Dynamic KPI Metric Card
Generates a polished card with dynamic background color, metric number, trend indicator, and title.

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,",
  ENCODEURL(
    CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 120'>",
      "<rect width='320' height='120' rx='12' fill=' ", 
      IFS([ChangePercentage] >= 0, "#e8f5e9", TRUE, "#ffebee"), 
      "' stroke=' ",
      IFS([ChangePercentage] >= 0, "#81c784", TRUE, "#e57373"),
      "' stroke-width='2' />",
      "<text x='20' y='32' font-family='Arial, sans-serif' font-size='14' font-weight='600' fill='#555555'>",
      [MetricTitle],
      "</text>",
      "<text x='20' y='75' font-family='Arial, sans-serif' font-size='32' font-weight='bold' fill='#212121'>",
      TEXT([CurrentValue], "$#,##0"),
      "</text>",
      "<text x='20' y='102' font-family='Arial, sans-serif' font-size='13' font-weight='bold' fill=' ",
      IFS([ChangePercentage] >= 0, "#2e7d32", TRUE, "#c62828"),
      "'>",
      IFS([ChangePercentage] >= 0, "▲ +", TRUE, "▼ "), CONCATENATE(ROUND(ABS([ChangePercentage]) * 1000) / 10.0, "%"), " vs last month",
      "</text>",
      "</svg>"
    )
  )
)
```

---

### Template 2: Radial / Donut Progress Gauge (0% to 100%)
Generates a circular donut gauge that dynamically fills based on completion percentage.

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>",
  "<!-- Background track (perimeter = 2 * PI * 45 ≈ 283) -->",
  "<circle cx='60' cy='60' r='45' fill='none' stroke='%23e0e0e0' stroke-width='10' />",
  "<!-- Dynamic progress circle -->",
  "<circle cx='60' cy='60' r='45' fill='none' stroke=' ",
  IFS([Progress] >= 1.0, "%232e7d32", [Progress] >= 0.5, "%231976d2", TRUE, "%23f57c00"),
  "' stroke-width='10' stroke-linecap='round' ",
  "stroke-dasharray='283' ",
  "stroke-dashoffset=' ", TEXT(283 * (1 - MIN(LIST([Progress], 1.0))), "0"), "' ",
  "transform='rotate(-90 60 60)' />",
  "<text x='60' y='66' font-family='Arial, sans-serif' font-size='20' font-weight='bold' text-anchor='middle' fill='%23212121'>",
  CONCATENATE(ROUND([Progress] * 100), "%"),
  "</text>",
  "</svg>"
)
```

---

### Template 3: Status Badge Pill with Dynamic Theme
Generates a modern rounded pill badge with status indicator dot.

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 36'>",
  "<rect width='160' height='36' rx='18' fill=' ",
  IFS([Status] = "Completed", "%23e8f5e9", [Status] = "In Progress", "%23e3f2fd", [Status] = "Delayed", "%23ffebee", TRUE, "%23f5f5f5"),
  "' />",
  "<circle cx='20' cy='18' r='5' fill=' ",
  IFS([Status] = "Completed", "%232e7d32", [Status] = "In Progress", "%231976d2", [Status] = "Delayed", "%23c62828", TRUE, "%23757575"),
  "' />",
  "<text x='34' y='23' font-family='Arial, sans-serif' font-size='13' font-weight='bold' fill=' ",
  IFS([Status] = "Completed", "%231b5e20", [Status] = "In Progress", "%230d47a1", [Status] = "Delayed", "%23b71c1c", TRUE, "%23424242"),
  "'>",
  UPPER([Status]),
  "</text>",
  "</svg>"
)
```

---

### Template 4: Dynamic 5-Star Rating Component
Generates a 5-star rating bar where stars are filled dynamically based on a numeric `Rating` (1 to 5).

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 30'>",
  "<!-- Star 1 -->",
  "<polygon points='15,2 19,10 28,11 21,17 23,26 15,21 7,26 9,17 2,11 11,10' fill=' ", IFS([Rating] >= 1, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 2 -->",
  "<polygon points='45,2 49,10 58,11 51,17 53,26 45,21 37,26 39,17 32,11 41,10' fill=' ", IFS([Rating] >= 2, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 3 -->",
  "<polygon points='75,2 79,10 88,11 81,17 83,26 75,21 67,26 69,17 62,11 71,10' fill=' ", IFS([Rating] >= 3, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 4 -->",
  "<polygon points='105,2 109,10 118,11 111,17 113,26 105,21 97,26 99,17 92,11 101,10' fill=' ", IFS([Rating] >= 4, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 5 -->",
  "<polygon points='135,2 139,10 148,11 141,17 143,26 135,21 127,26 129,17 122,11 131,10' fill=' ", IFS([Rating] >= 5, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "</svg>"
)
```

---

### Template 5: Horizontal Pipeline Stepper
Generates a 4-step horizontal pipeline tracker highlighting completed, active, and pending stages.

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,",
  ENCODEURL(
    CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 50'>",
      "<!-- Connecting lines -->",
      "<line x1='40' y1='25' x2='140' y2='25' stroke=' ", IFS([StepNumber] >= 2, "#1976d2", TRUE, "#e0e0e0"), "' stroke-width='4' />",
      "<line x1='140' y1='25' x2='240' y2='25' stroke=' ", IFS([StepNumber] >= 3, "#1976d2", TRUE, "#e0e0e0"), "' stroke-width='4' />",
      "<line x1='240' y1='25' x2='340' y2='25' stroke=' ", IFS([StepNumber] >= 4, "#1976d2", TRUE, "#e0e0e0"), "' stroke-width='4' />",
      "<!-- Step 1 Circle -->",
      "<circle cx='40' cy='25' r='14' fill=' ", IFS([StepNumber] >= 1, "#1976d2", TRUE, "#e0e0e0"), "' />",
      "<text x='40' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>1</text>",
      "<!-- Step 2 Circle -->",
      "<circle cx='140' cy='25' r='14' fill=' ", IFS([StepNumber] >= 2, "#1976d2", TRUE, "#e0e0e0"), "' />",
      "<text x='140' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>2</text>",
      "<!-- Step 3 Circle -->",
      "<circle cx='240' cy='25' r='14' fill=' ", IFS([StepNumber] >= 3, "#1976d2", TRUE, "#e0e0e0"), "' />",
      "<text x='240' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>3</text>",
      "<!-- Step 4 Circle -->",
      "<circle cx='340' cy='25' r='14' fill=' ", IFS([StepNumber] >= 4, "#1976d2", TRUE, "#e0e0e0"), "' />",
      "<text x='340' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>4</text>",
      "</svg>"
    )
  )
)
```

---

### Template 6: Production-Grade Multi-State Vertical Stepper (in `LongText` HTML)

Generates a full-height vertical timeline with **state-aware step circles** (Pending numbered `01`, Active highlighted, Completed with vector checkmark `✓`, Rejected `X`, and Skipped `N/A`), connecting state lines, and multi-language/unicode text.

* **Column Setup:** Type **`LongText`**, Text format **`HTML`**.
* **Sizing:** plain `<img src="..." />` (no `style`/`width`/`height`, which are stripped); the SVG's own `width`/`height`/`viewBox` controls scaling.
* **Maintainability:** Uses `<g transform='translate(0, Y)'>` for clean modular stage positioning and `ENCODEURL()` for clean hex color & unicode handling.

```appsheet
CONCATENATE(
  "<img src=",
  '"',
  "data:image/svg+xml;utf8,",
  ENCODEURL(
    CONCATENATE(
      "<svg xmlns='http://www.w3.org/2000/svg' width='500' height='480' viewBox='0 0 500 480'>",
      "<rect width='500' height='480' rx='20' fill='#ffffff' stroke='#edf2f7' stroke-width='2'/>",

      "<!-- STAGE 1: SUBMISSION -->",
      "<g transform='translate(0, 0)'>",
        "<line x1='60' y1='65' x2='60' y2='125' stroke-width='3' stroke-linecap='round' stroke=' ",
        IFS(ISBLANK([Status]), "#e2e8f0", [Status] = "Rejected", "#ef4444", TRUE, "#1a237e"),
        "' />",
        IFS(
          ISBLANK([Status]),
          "<circle cx='60' cy='50' r='18' fill='#f8fafc' stroke='#cbd5e1' stroke-width='2.5'/>
           <text x='60' y='50' font-family='system-ui, sans-serif' font-size='13' fill='#94a3b8' font-weight='800' text-anchor='middle' dominant-baseline='central'>01</text>",
          TRUE,
          "<circle cx='60' cy='50' r='18' fill='#10b981' stroke='#10b981' stroke-width='2.5'/>
           <path d='M 54 50 L 58 54 L 66 45' stroke='#ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>"
        ),
        "<text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill=' ",
        IF(ISBLANK([Status]), "#94a3b8", "#1e293b"),
        "'>Request Submitted</text>",
        "<text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>Initial submission recorded in system</text>",
      "</g>",

      "<!-- STAGE 2: REVIEW & APPROVAL -->",
      "<g transform='translate(0, 110)'>",
        "<line x1='60' y1='65' x2='60' y2='125' stroke-width='3' stroke-linecap='round' stroke=' ",
        IFS(IN([Status], LIST("Approved", "In Progress", "Completed")), "#1a237e", TRUE, "#e2e8f0"),
        "' />",
        IFS(
          OR(ISBLANK([Status]), [Status] = "Submitted"),
          "<circle cx='60' cy='50' r='18' fill='#eff6ff' stroke='#1a237e' stroke-width='2.5'/>
           <text x='60' y='50' font-family='system-ui, sans-serif' font-size='13' fill='#1a237e' font-weight='800' text-anchor='middle' dominant-baseline='central'>02</text>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#1e293b'>Manager Review</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>Pending manager review and sign-off</text>",
          [Status] = "Rejected",
          "<circle cx='60' cy='50' r='18' fill='#fef2f2' stroke='#ef4444' stroke-width='2.5'/>
           <text x='60' y='50' font-family='system-ui, sans-serif' font-size='13' fill='#ef4444' font-weight='800' text-anchor='middle' dominant-baseline='central'>X</text>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#ef4444'>Request Rejected</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>Reviewer rejected the submission</text>",
          TRUE,
          "<circle cx='60' cy='50' r='18' fill='#10b981' stroke='#10b981' stroke-width='2.5'/>
           <path d='M 54 50 L 58 54 L 66 45' stroke='#ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#1e293b'>Review Approved</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>Approved by manager</text>"
        ),
      "</g>",

      "<!-- STAGE 3: EXECUTION -->",
      "<g transform='translate(0, 220)'>",
        "<line x1='60' y1='65' x2='60' y2='125' stroke-width='3' stroke-linecap='round' stroke=' ",
        IFS([Status] = "Completed", "#1a237e", TRUE, "#e2e8f0"),
        "' />",
        IFS(
          [Status] = "In Progress",
          "<circle cx='60' cy='50' r='18' fill='#eff6ff' stroke='#1a237e' stroke-width='2.5'/>
           <text x='60' y='50' font-family='system-ui, sans-serif' font-size='13' fill='#1a237e' font-weight='800' text-anchor='middle' dominant-baseline='central'>03</text>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#1e293b'>Execution in Progress</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>Tasks currently being fulfilled</text>",
          [Status] = "Completed",
          "<circle cx='60' cy='50' r='18' fill='#10b981' stroke='#10b981' stroke-width='2.5'/>
           <path d='M 54 50 L 58 54 L 66 45' stroke='#ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#1e293b'>Execution Complete</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>All work successfully performed</text>",
          TRUE,
          "<circle cx='60' cy='50' r='18' fill='#f8fafc' stroke='#cbd5e1' stroke-width='2.5'/>
           <text x='60' y='50' font-family='system-ui, sans-serif' font-size='13' fill='#94a3b8' font-weight='800' text-anchor='middle' dominant-baseline='central'>03</text>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#94a3b8'>Execution</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#cbd5e1'>Awaiting prior stage completion</text>"
        ),
      "</g>",

      "<!-- STAGE 4: FINAL CLOSURE -->",
      "<g transform='translate(0, 330)'>",
        IFS(
          [Status] = "Completed",
          "<circle cx='60' cy='50' r='18' fill='#10b981' stroke='#10b981' stroke-width='2.5'/>
           <path d='M 54 50 L 58 54 L 66 45' stroke='#ffffff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#1e293b'>Order Closed</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#64748b'>Workflow finalized and archived</text>",
          TRUE,
          "<circle cx='60' cy='50' r='18' fill='#f8fafc' stroke='#cbd5e1' stroke-width='2.5'/>
           <text x='60' y='50' font-family='system-ui, sans-serif' font-size='13' fill='#94a3b8' font-weight='800' text-anchor='middle' dominant-baseline='central'>04</text>
           <text x='100' y='46' font-family='system-ui, sans-serif' font-size='18' font-weight='700' fill='#94a3b8'>Order Closed</text>
           <text x='100' y='66' font-family='system-ui, sans-serif' font-size='13' fill='#cbd5e1'>Pending completion of all previous stages</text>"
        ),
      "</g>",

      "</svg>"
    )
  ),
  '" />'
)
```

---

### Template 7: Animated Vertical Stepper (Image column only / at-risk in HTML LongText)

A 6-stage training workflow stepper. **WARNING, at risk:** it uses an internal `<style>` block with CSS classes. The author once saw it render in `LongText` (format `HTML`), but community reports from ~Sep 2026 say SVGs containing `<style>` vanish in HTML LongText while still working in `Image` / `Show` Image columns (https://discuss.google.dev/t/dynamic-svgs-in-html-longtext-columns-no-longer-working/400281). **Use it in an Image / Show-Image column**, or replace the classes with inline `fill=`/`font-size=` attributes before using it in HTML LongText. SMIL `<animate>` and `<defs>`/`<use>` support is unverified. Still useful as the reference for the [Critical Quoting Rules](#-critical-quoting-rules-tested-by-author) (tested by author).

What it demonstrates:
- **Quoting:** every SVG attribute uses `'`. Attribute values filled by an expression open with `' "` (e.g. `stroke=' ",`). The `src=` double quotes come from `'"'` and `'" />'`.
- **Internal `<style>` + classes** (`.t`, `.s`, `.n`, `.g`, `.d` …) shrink every `<text>` node down to `class='t d'`. That cuts formula length a lot compared with repeating `font-family`/`font-size`/`fill` on each node.
- **`<defs>` + `<use href='#id'/>`** reuse the pending (`#p`), active (`#a`) and done (`#ok`) circles, so each state is written once.
- **SMIL `<animate>`** draws the ring and then the checkmark (`stroke-dashoffset` from 60 to 0, then 14 to 0, `fill='freeze'`) in every completed step (animation support in AppSheet is unverified).
- **Branch-local tails:** some `IFS` branches emit only the opening `<text ...>`, and the shared label (e.g. `IF([loại_hình_đào_tạo] = "Chứng Chỉ", ...)`) plus `</text>` follow after the `IFS`. This removes duplicated labels.
- **Skipped state:** a dashed connector (`stroke-dasharray='4,4'`) and a dashed `N/A` circle when `[ký_thỏa_thuận]` is not `TRUE`.

```appsheet
CONCATENATE(
  "<img src=",
  '"',
  "data:image/svg+xml;utf8,",
  ENCODEURL(CONCATENATE(
    "<svg xmlns='http://www.w3.org/2000/svg' width='500' height='660' viewBox='0 0 500 660'>",
    "<style>text{font-family:system-ui,sans-serif}.t{font-size:18px;font-weight:700}.s{font-size:13px}.n{font-size:13px;font-weight:800;text-anchor:middle;dominant-baseline:central}.g{fill:#94a3b8}.d{fill:#1e293b}.m{fill:#64748b}.l{fill:#cbd5e1}.b{fill:#1a237e}.r{fill:#ef4444}line{stroke-width:3;stroke-linecap:round}</style>",
    "<defs>",
    "<circle id='p' cx='60' cy='50' r='18' fill='#f8fafc' stroke='#cbd5e1' stroke-width='2.5'/>",
    "<circle id='a' cx='60' cy='50' r='18' fill='#eff6ff' stroke='#1a237e' stroke-width='2.5'/>",
    "<g id='ok'><circle cx='60' cy='50' r='18' fill='#10b981'/><g transform='translate(42,32) scale(1.5)' fill='none' stroke='#fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'>",
    "<path stroke-dasharray='60' d='M3 12c0 -4.97 4.03 -9 9 -9c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9c-4.97 0 -9 -4.03 -9 -9Z'><animate fill='freeze' attributeName='stroke-dashoffset' dur='0.6s' values='60;0'/></path>",
    "<path stroke-dasharray='14' stroke-dashoffset='14' d='M8 12l3 3l5 -5'><animate fill='freeze' attributeName='stroke-dashoffset' begin='0.6s' dur='0.2s' to='0'/></path>",
    "</g></g></defs>",
    "<rect width='500' height='660' rx='28' fill='#fff' stroke='#edf2f7' stroke-width='2'/>",

    "<g><line x1='60' y1='65' x2='60' y2='125' stroke=' ",
    IFS(
      ISBLANK([trạng_thái_thực_hiện]), "#e2e8f0",
      [trạng_thái_thực_hiện] = "Không Tham Gia", "#ef4444",
      [trạng_thái_thực_hiện] = "Đã Gửi Thông Báo", "#e2e8f0",
      TRUE, "#1a237e"
    ),
    "'/>",
    IF(ISBLANK([trạng_thái_thực_hiện]),
      "<use href='#p'/><text class='n g' x='60' y='50'>01</text><text class='t g' x='100' y='46'>",
      "<use href='#ok'/><text class='t d' x='100' y='46'>"
    ),
    "Đã Gửi Thông Báo</text><text class='s m' x='100' y='66'>Hệ thống đã gửi thông báo đến nhân sự</text></g>",

    "<g transform='translate(0,110)'><line x1='60' y1='65' x2='60' y2='125' stroke=' ",
    IF(OR(ISBLANK([trạng_thái_thực_hiện]), IN([trạng_thái_thực_hiện], LIST("Đã Gửi Thông Báo", "Không Tham Gia", "Xác Nhận Tham Gia"))), "#e2e8f0", "#1a237e"),
    "'/>",
    IFS(
      ISBLANK([trạng_thái_thực_hiện]),
        "<use href='#p'/><text class='n g' x='60' y='50'>02</text><text class='t g' x='100' y='46'>Xác Nhận Tham Gia</text><text class='s l' x='100' y='66'>Nhân sự xác nhận phản hồi tham gia",
      [trạng_thái_thực_hiện] = "Không Tham Gia",
        "<circle cx='60' cy='50' r='18' fill='#fef2f2' stroke='#ef4444' stroke-width='2.5'/><text class='n r' x='60' y='50'>X</text><text class='t r' x='100' y='46'>Không Tham Gia</text><text class='s m' x='100' y='66'>Nhân sự từ chối phản hồi tham gia",
      [trạng_thái_thực_hiện] = "Đã Gửi Thông Báo",
        "<use href='#a'/><text class='n b' x='60' y='50'>02</text><text class='t d' x='100' y='46'>Xác Nhận Tham Gia</text><text class='s m' x='100' y='66'>Nhân sự xác nhận phản hồi tham gia",
      TRUE,
        "<use href='#ok'/><text class='t d' x='100' y='46'>Xác Nhận Tham Gia</text><text class='s m' x='100' y='66'>Nhân sự xác nhận phản hồi tham gia"
    ),
    "</text></g>",

    "<g transform='translate(0,220)'><line x1='60' y1='65' x2='60' y2='125' ",
    IF(NOT([ký_thỏa_thuận] = TRUE), " stroke-dasharray='4,4' ", ""),
    " stroke=' ",
    IF(OR(ISBLANK([trạng_thái_thực_hiện]), IN([trạng_thái_thực_hiện], LIST("Đã Gửi Thông Báo", "Không Tham Gia", "Xác Nhận Tham Gia"))), "#e2e8f0", "#1a237e"),
    "'/>",
    IFS(
      NOT([ký_thỏa_thuận] = TRUE),
        "<circle cx='60' cy='50' r='18' fill='#f1f5f9' stroke='#cbd5e1' stroke-width='2' stroke-dasharray='3,3'/><text class='n g' x='60' y='50' style='font-size:11px;font-weight:700'>N/A</text><text class='t g' x='100' y='46'>",
      OR(ISBLANK([trạng_thái_thực_hiện]), IN([trạng_thái_thực_hiện], LIST("Đã Gửi Thông Báo", "Không Tham Gia"))),
        "<use href='#p'/><text class='n g' x='60' y='50'>03</text><text class='t g' x='100' y='46'>",
      [trạng_thái_thực_hiện] = "Xác Nhận Tham Gia",
        "<use href='#a'/><text class='n b' x='60' y='50'>03</text><text class='t d' x='100' y='46'>",
      TRUE,
        "<use href='#ok'/><text class='t d' x='100' y='46'>"
    ),
    IF([loại_hình_đào_tạo] = "Chứng Chỉ", "Ký Thỏa Thuận Trước Thi", "Ký Thỏa Thuận Trước Khóa Học"),
    "</text><text class='s ",
    IFS(
      NOT([ký_thỏa_thuận] = TRUE), "m' x='100' y='66'>Bỏ qua — Không yêu cầu cam kết",
      ISBLANK([trạng_thái_thực_hiện]), "l' x='100' y='66'>Nhân sự ký cam kết đào tạo",
      TRUE, "m' x='100' y='66'>Nhân sự ký cam kết đào tạo"
    ),
    "</text></g>",

    "<g transform='translate(0,330)'><line x1='60' y1='65' x2='60' y2='125' stroke=' ",
    IF(IN([trạng_thái_thực_hiện], LIST("Tham Gia Thi", "Tham Gia Khóa Học", "Hoàn Thành Thi Chứng Chỉ", "Hoàn Thành Khóa Học", "Hoàn Thành")), "#1a237e", "#e2e8f0"),
    "'/>",
    IFS(
      OR(ISBLANK([trạng_thái_thực_hiện]), IN([trạng_thái_thực_hiện], LIST("Đã Gửi Thông Báo", "Không Tham Gia")), AND([trạng_thái_thực_hiện] = "Xác Nhận Tham Gia", [ký_thỏa_thuận] = TRUE)),
        "<use href='#p'/><text class='n g' x='60' y='50'>04</text><text class='t g' x='100' y='46'>",
      IN([trạng_thái_thực_hiện], LIST("Xác Nhận Tham Gia", "Ký Thỏa Thuận Trước Thi", "Ký Thỏa Thuận Trước Khóa Học")),
        "<use href='#a'/><text class='n b' x='60' y='50'>04</text><text class='t d' x='100' y='46'>",
      TRUE,
        "<use href='#ok'/><text class='t d' x='100' y='46'>"
    ),
    IF([loại_hình_đào_tạo] = "Chứng Chỉ", "Tham Gia Thi", "Tham Gia Khóa Học"),
    "</text><text class='s m' x='100' y='66'>",
    IFS(
      ISBLANK([trạng_thái_thực_hiện]), "Chờ hoàn thành bước trước",
      IN([trạng_thái_thực_hiện], LIST("Tham Gia Thi", "Tham Gia Khóa Học", "Hoàn Thành Thi Chứng Chỉ", "Hoàn Thành Khóa Học", "Hoàn Thành")), "Kế hoạch đã duyệt — Đang diễn ra quá trình học/thi",
      [trạng_thái_thanh_toán] = TRUE, "Kế hoạch đã duyệt — Nhân sự sẵn sàng tham gia",
      TRUE, "Chờ HR phê duyệt kế hoạch đào tạo"
    ),
    "</text></g>",

    "<g transform='translate(0,440)'><line x1='60' y1='65' x2='60' y2='125' stroke=' ",
    IF(IN([trạng_thái_thực_hiện], LIST("Hoàn Thành Thi Chứng Chỉ", "Hoàn Thành Khóa Học", "Hoàn Thành")), "#1a237e", "#e2e8f0"),
    "'/>",
    IFS(
      OR(ISBLANK([trạng_thái_thực_hiện]), IN([trạng_thái_thực_hiện], LIST("Đã Gửi Thông Báo", "Không Tham Gia", "Xác Nhận Tham Gia", "Ký Thỏa Thuận Trước Thi", "Ký Thỏa Thuận Trước Khóa Học"))),
        "<use href='#p'/><text class='n g' x='60' y='50'>05</text><text class='t g' x='100' y='46'>",
      IN([trạng_thái_thực_hiện], LIST("Tham Gia Thi", "Tham Gia Khóa Học")),
        "<use href='#a'/><text class='n b' x='60' y='50'>05</text><text class='t d' x='100' y='46'>",
      TRUE,
        "<use href='#ok'/><text class='t d' x='100' y='46'>"
    ),
    IF([loại_hình_đào_tạo] = "Chứng Chỉ", "Hoàn Thành Thi Chứng Chỉ", "Hoàn Thành Khóa Học"),
    "</text><text class='s ",
    IFS(
      OR(ISBLANK([trạng_thái_thực_hiện]), IN([trạng_thái_thực_hiện], LIST("Đã Gửi Thông Báo", "Không Tham Gia", "Xác Nhận Tham Gia", "Ký Thỏa Thuận Trước Thi", "Ký Thỏa Thuận Trước Khóa Học"))),
        "l' x='100' y='66'>Chờ hoàn thành bước trước",
      IN([trạng_thái_thực_hiện], LIST("Tham Gia Thi", "Tham Gia Khóa Học")),
        "m' x='100' y='66'>Hoàn thành quá trình học/thi để sang bước kế tiếp",
      TRUE,
        "m' x='100' y='66'>Hoàn tất chương trình học, kết quả đã nộp"
    ),
    "</text></g>",

    "<g transform='translate(0,550)'>",
    IFS(
      [trạng_thái_thực_hiện] = "Hoàn Thành",
        "<use href='#ok'/><text class='t d' x='100' y='46'>Hoàn Thành</text><text class='s m' x='100' y='66'>Đã đánh giá/upload kết quả thành công",
      IN([trạng_thái_thực_hiện], LIST("Hoàn Thành Thi Chứng Chỉ", "Hoàn Thành Khóa Học")),
        "<use href='#a'/><text class='n b' x='60' y='50'>06</text><text class='t d' x='100' y='46'>Hoàn Thành</text><text class='s m' x='100' y='66'>"
        & IF([trạng_thái_thực_hiện] = "Hoàn Thành Thi Chứng Chỉ", "Chứng chỉ/Điểm số đang chờ phê duyệt", "Nhân sự làm đánh giá để khép lại quy trình"),
      TRUE,
        "<use href='#p'/><text class='n g' x='60' y='50'>06</text><text class='t g' x='100' y='46'>Hoàn Thành</text><text class='s g' x='100' y='66'>Chưa hoàn thành quy trình"
    ),
    "</text></g>",
    "</svg>"
  )),
  '" />'
)
```

---

## 4. QuickChart.io Visual Integration

QuickChart renders web-standard Chart.js configurations into static image URLs. Community usage: https://discuss.google.dev/t/using-quickchart-in-appsheet/324637 (Image column with a chart URL; wrapping the config in `ENCODEURL()` is a common safe pattern, not confirmed in that thread).

### Standard Formula Pattern (Bar / Line / Radar / Donut Chart)
```appsheet
CONCATENATE(
  "https://quickchart.io/chart?w=500&h=300&c=",
  ENCODEURL(
    CONCATENATE(
      "{type:'bar',data:{labels:['Jan','Feb','Mar','Apr','May','Jun'],datasets:[{label:'Sales',backgroundColor:'rgba(54,162,235,0.7)',data:[",
      [JanSales], ",", [FebSales], ",", [MarSales], ",", [AprSales], ",", [MaySales], ",", [JunSales],
      "]}]}}"
    )
  )
)
```

### QuickChart Performance Best Practices & Safeguards
1. **Never Put QuickChart in Large Multi-Row Tables:**
   - Each chart is an external HTTP request, and the QuickChart **free tier is limited** (community-reported: 1,000 charts/month, 60/min; https://discuss.google.dev/t/using-quickchart-in-appsheet/324637). A virtual column on a large table can exhaust that quickly; client slowdowns are plausible but unmeasured.
2. **Restrict QuickChart to Dashboard / Parent Detail Views:**
   - Place QuickChart formulas only in single-record detail views or 1-row summary/dashboard tables.
3. **Prefer Local SVGs for Simple Visuals:**
   - For gauges, metric cards, progress bars, and star ratings, always use **Dynamic SVGs** instead of QuickChart to eliminate external network dependencies.
