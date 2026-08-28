# AppSheet Advanced UI/UX, Dynamic SVG & HTML Guide

This guide details advanced techniques for elevating AppSheet UI/UX using **HTML Formatting in `LongText` columns**, zero-latency **Dynamic SVG Generation**, and **QuickChart.io** visual integration, incorporating verified patterns and constraints from the AppSheet developer community (`discuss.google.dev`).

---

## 1. HTML Formatting in AppSheet (`LongText` Columns)

### How HTML Rendering Works in AppSheet
In AppSheet, rich-text HTML rendering is **not** handled by standard `Show` columns. Instead, it is configured on **`LongText`** type columns:

1. **Column Setup:** Set column type to **`LongText`**.
2. **Text Format Option:** In the column definition settings, set **Text format** to **`HTML`** (or `Markdown`).
3. **Supported Views:** Rich-formatted HTML is rendered natively in **Detail views** (and read-only Form preview). In Table, Deck, or Card views, AppSheet renders the content as plain text or strips tags to avoid breaking layout grids.

---

### AppSheet HTML Sanitizer: Whitelisted Tags vs Stripped Elements

AppSheet enforces a strict HTML sanitizer for security and cross-platform layout stability.

| Category | Supported & Rendered Tags | Community Behavior & Notes |
| :--- | :--- | :--- |
| **Text Styling** | `<b>`, `<strong>`, `<i>`, `<em>`, `<u>`, `<mark>`, `<small>`, `<del>`, `<ins>`, `<sub>`, `<sup>` | Standard inline typography formatting. |
| **Headings & Hierarchy** | `<h1>`, `<h2>`, `<h3>`, `<h4>`, `<h5>`, `<h6>` | Renders clean section titles in Detail views. |
| **Structure & Flow** | `<p>`, `<br>`, `<hr>`, `<blockquote>` | Paragraphs, line breaks, dividers, and indented callout quotes. |
| **Lists** | `<ul>`, `<ol>`, `<li>` | Bulleted and numbered lists. |
| **Links & Media** | `<a href="...">`, `<img src="..." width="..." height="...">` | Clickable hyperlinks and dynamic inline images. |
| **Tables** | `<table>`, `<tbody>`, `<tr>`, `<td>`, `<th>` | Tabular data grids (rendered with default theme table styling). |

#### ❌ What is STRIPPED or NOT Supported by AppSheet's HTML Sanitizer:
- ❌ **`<div>` and `<span>` Tags:** Stripped or rendered as unstyled plain text blocks.
- ❌ **`<font>` Tag:** Stripped by the modern HTML sanitizer.
- ❌ **Inline CSS `style="..."` Attributes:** **ALL inline CSS styles are stripped!** Expressions like `<p style="color:red; background:#eee;">` or `<td style="border: 1px solid black;">` will have their `style` attribute removed.
- ❌ **Custom CSS / Classes:** `<style>`, `<link>`, and `class="..."` are removed.
- ❌ **JavaScript:** `<script>`, `onclick`, and event handlers are completely blocked.
- ❌ **`Show` Columns:** Do not have the `HTML` text format selector; `Show` columns only support plain text and basic Markdown formatting.

> [!TIP]
> **When to use HTML vs Dynamic SVG:**
> - Use **`LongText` (HTML format)** for structured documents, audit logs, bullet lists, blockquotes, inline hyperlinks (`<a>`), and simple tables.
> - Use **Dynamic SVG (Image type)** whenever you need custom brand colors, background fills, rounded corners, borders, badges, progress bars, or metric cards (because SVGs support full vector styling that is never stripped).

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
  "<tr><td colspan='3'><b>Grand Total Due</b></td><td><b>", TEXT([TotalDue], "$#,##0.00"), "</b></td></tr>",
  "</table>"
)
```

#### Example 3: Rich Media & Direct Hyperlinks
```appsheet
CONCATENATE(
  "<p><b>Equipment Manual:</b> <a href='", [ManualURL], "'>Open PDF Document</a></p>",
  "<p><img src='", [DiagramURL], "' width='320' /></p>",
  "<ul>",
  "<li>Check safety valve before starting.</li>",
  "<li>Verify pressure gauge is calibrated.</li>",
  "</ul>"
)
```

---

## 2. Dynamic SVGs (Zero-Latency Client-Side Visuals)

### Why Use Dynamic SVGs in AppSheet?
- **Zero Network Overhead:** SVGs are delivered via client-side `data:image/svg+xml;utf8,...` Data URIs. No HTTP image requests are sent to any external server.
- **Full Styling Support:** Unlike HTML in AppSheet (which strips CSS `style`), SVGs preserve all vector styling (`fill`, `stroke`, `rx`, `viewBox`, `text-anchor`, `font-size`, `font-family`, `transform`).
- **Zero Latency:** Renders instantly in mobile WebViews and desktop browsers.
- **Dynamic & Reactive:** Vector attributes change dynamically based on row values.

### Implementation Pattern
1. Create a **Virtual Column** of type **`Image`**.
2. Set the App Formula using `CONCATENATE()` returning a string starting with:
   `"data:image/svg+xml;utf8,<svg ...> ... </svg>"`
3. For best layout, display in **Card Views** or **Detail Views** with image alignment set to *Contain*.

---

### What You CAN'T Do in AppSheet SVGs (Traps & Solutions)

| ❌ Failure Mode / Trap | Why It Fails in AppSheet | ✅ What To Do Instead |
| :--- | :--- | :--- |
| **Unencoded `#` in Hex Colors** (`fill='#28a745'`) | `#` is parsed as a URL fragment identifier in mobile WebViews, cutting off the rest of the SVG string and rendering a blank image. | **Always encode `#` as `%23`** (`fill='%2328a745'`) or use named colors / `rgb(40,167,69)`. |
| **Double Quote Syntax Collisions** | Using raw double quotes inside formula strings breaks AppSheet's expression parser. | Use single quotes (`'`) for SVG attributes or double-quotes (`""`) if inside string literals. |
| **`<script>` Tags Inside SVG** | AppSheet and mobile WebViews strip or block JavaScript execution for security. | Use pure declarative SVG vector properties and AppSheet formula conditions (`IFS()`, `IF()`). |
| **External Fonts** (`@import url(...)`) | WebViews block cross-origin font downloads in SVG Data URIs, causing fallback or blank text. | Use standard system fonts: `font-family='Arial, sans-serif'`. |
| **Complex External Images** | Cross-origin image embedding in data URIs is blocked by browser CORS security policies. | Use native SVG vector shapes or embedded Base64 `<image href='data:image/png;base64,...' />`. |

---

### ❌ Bad vs ✅ Good SVG Code Comparison

#### ❌ Bad SVG Formula (Will Render Blank / Broken on Mobile)
```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg width="100" height="100">",
  "<circle cx='50' cy='50' r='40' fill='#ff5722' />",
  "<text x='50' y='55' fill='#ffffff'>", [Score], "</text>",
  "</svg>"
)
```
*Problems: Double quotes inside formula break parsing; unencoded `#` in `#ff5722` and `#ffffff` breaks rendering on mobile devices.*

#### ✅ Good SVG Formula (Robust, Universal Rendering)
```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>",
  "<circle cx='50' cy='50' r='40' fill='%23ff5722' />",
  "<text x='50' y='56' font-size='22' font-family='Arial, sans-serif' font-weight='bold' text-anchor='middle' fill='%23ffffff'>",
  [Score],
  "</text>",
  "</svg>"
)
```

---

## 3. Production-Ready Dynamic SVG Formula Templates

### Template 1: Dynamic KPI Metric Card
Generates a polished card with dynamic background color, metric number, trend indicator, and title.

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 120'>",
  "<rect width='320' height='120' rx='12' fill='", 
  IFS([ChangePercentage] >= 0, "%23e8f5e9", TRUE, "%23ffebee"), 
  "' stroke='",
  IFS([ChangePercentage] >= 0, "%2381c784", TRUE, "%23e57373"),
  "' stroke-width='2' />",
  "<text x='20' y='32' font-family='Arial, sans-serif' font-size='14' font-weight='600' fill='%23555555'>",
  [MetricTitle],
  "</text>",
  "<text x='20' y='75' font-family='Arial, sans-serif' font-size='32' font-weight='bold' fill='%23212121'>",
  TEXT([CurrentValue], "$#,##0"),
  "</text>",
  "<text x='20' y='102' font-family='Arial, sans-serif' font-size='13' font-weight='bold' fill='",
  IFS([ChangePercentage] >= 0, "%232e7d32", TRUE, "%23c62828"),
  "'>",
  IFS([ChangePercentage] >= 0, "▲ +", TRUE, "▼ "), TEXT([ChangePercentage] * 100, "0.0%"), " vs last month",
  "</text>",
  "</svg>"
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
  "<circle cx='60' cy='60' r='45' fill='none' stroke='",
  IFS([Progress] >= 1.0, "%232e7d32", [Progress] >= 0.5, "%231976d2", TRUE, "%23f57c00"),
  "' stroke-width='10' stroke-linecap='round' ",
  "stroke-dasharray='283' ",
  "stroke-dashoffset='", TEXT(283 * (1 - MIN(LIST([Progress], 1.0))), "0"), "' ",
  "transform='rotate(-90 60 60)' />",
  "<text x='60' y='66' font-family='Arial, sans-serif' font-size='20' font-weight='bold' text-anchor='middle' fill='%23212121'>",
  TEXT([Progress] * 100, "0%"),
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
  "<rect width='160' height='36' rx='18' fill='",
  IFS([Status] = "Completed", "%23e8f5e9", [Status] = "In Progress", "%23e3f2fd", [Status] = "Delayed", "%23ffebee", TRUE, "%23f5f5f5"),
  "' />",
  "<circle cx='20' cy='18' r='5' fill='",
  IFS([Status] = "Completed", "%232e7d32", [Status] = "In Progress", "%231976d2", [Status] = "Delayed", "%23c62828", TRUE, "%23757575"),
  "' />",
  "<text x='34' y='23' font-family='Arial, sans-serif' font-size='13' font-weight='bold' fill='",
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
  "<polygon points='15,2 19,10 28,11 21,17 23,26 15,21 7,26 9,17 2,11 11,10' fill='", IFS([Rating] >= 1, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 2 -->",
  "<polygon points='45,2 49,10 58,11 51,17 53,26 45,21 37,26 39,17 32,11 41,10' fill='", IFS([Rating] >= 2, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 3 -->",
  "<polygon points='75,2 79,10 88,11 81,17 83,26 75,21 67,26 69,17 62,11 71,10' fill='", IFS([Rating] >= 3, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 4 -->",
  "<polygon points='105,2 109,10 118,11 111,17 113,26 105,21 97,26 99,17 92,11 101,10' fill='", IFS([Rating] >= 4, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "<!-- Star 5 -->",
  "<polygon points='135,2 139,10 148,11 141,17 143,26 135,21 127,26 129,17 122,11 131,10' fill='", IFS([Rating] >= 5, "%23ffc107", TRUE, "%23e0e0e0"), "' />",
  "</svg>"
)
```

---

### Template 5: Multi-Step Workflow Stepper
Generates a 4-step horizontal pipeline tracker highlighting completed, active, and pending stages.

```appsheet
CONCATENATE(
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 50'>",
  "<!-- Connecting lines -->",
  "<line x1='40' y1='25' x2='140' y2='25' stroke='", IFS([StepNumber] >= 2, "%231976d2", TRUE, "%23e0e0e0"), "' stroke-width='4' />",
  "<line x1='140' y1='25' x2='240' y2='25' stroke='", IFS([StepNumber] >= 3, "%231976d2", TRUE, "%23e0e0e0"), "' stroke-width='4' />",
  "<line x1='240' y1='25' x2='340' y2='25' stroke='", IFS([StepNumber] >= 4, "%231976d2", TRUE, "%23e0e0e0"), "' stroke-width='4' />",
  "<!-- Step 1 Circle -->",
  "<circle cx='40' cy='25' r='14' fill='", IFS([StepNumber] >= 1, "%231976d2", TRUE, "%23e0e0e0"), "' />",
  "<text x='40' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>1</text>",
  "<!-- Step 2 Circle -->",
  "<circle cx='140' cy='25' r='14' fill='", IFS([StepNumber] >= 2, "%231976d2", TRUE, "%23e0e0e0"), "' />",
  "<text x='140' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>2</text>",
  "<!-- Step 3 Circle -->",
  "<circle cx='240' cy='25' r='14' fill='", IFS([StepNumber] >= 3, "%231976d2", TRUE, "%23e0e0e0"), "' />",
  "<text x='240' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>3</text>",
  "<!-- Step 4 Circle -->",
  "<circle cx='340' cy='25' r='14' fill='", IFS([StepNumber] >= 4, "%231976d2", TRUE, "%23e0e0e0"), "' />",
  "<text x='340' y='30' font-family='Arial, sans-serif' font-size='12' font-weight='bold' text-anchor='middle' fill='white'>4</text>",
  "</svg>"
)
```

---

## 4. QuickChart.io Visual Integration

QuickChart renders web-standard Chart.js configurations into static image URLs.

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
   - If placed in a Virtual Column on a 2,000-row table, AppSheet attempts to download 2,000 HTTP images simultaneously during sync/scroll, causing client freezes and API rate limits.
2. **Restrict QuickChart to Dashboard / Parent Detail Views:**
   - Place QuickChart formulas only in single-record detail views or 1-row summary/dashboard tables.
3. **Prefer Local SVGs for Simple Visuals:**
   - For gauges, metric cards, progress bars, and star ratings, always use **Dynamic SVGs** instead of QuickChart to eliminate external network dependencies.
