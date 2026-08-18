# AppSheet Expressions & Formulas Reference Catalog (Tra cứu công thức AppSheet)

Tài liệu tra cứu toàn diện tất cả các hàm, công thức, biểu thức và biến hệ thống trong **Google AppSheet**. Mỗi công thức bao gồm cú pháp chuẩn, kiểu dữ liệu trả về, giải nghĩa chi tiết (Song ngữ Việt - Anh), ví dụ thực tế và các lưu ý về mặt hiệu năng / kiến trúc (Performance & Sync Cost).

---

## Mục lục (Table of Contents)

1. [Quy tắc cú pháp & Biến hệ thống (Syntax & System Variables)](#1-quy-tắc-cú-pháp--biến-hệ-thống)
2. [Biểu thức logic & Yes/No (Logical Expressions)](#2-biểu-thức-logic--yesno)
3. [Biểu thức điều kiện & Rẽ nhánh (Conditional Expressions)](#3-biểu-thức-điều-kiện--rẽ-nhánh)
4. [Biểu thức xử lý văn bản (Text / String Expressions)](#4-biểu-thức-xử-lý-văn-bản)
5. [Nhóm hàm trích xuất dữ liệu (Extract Expressions)](#5-nhóm-hàm-trích-xuất-dữ-liệu)
6. [Biểu thức toán học & Số học (Math & Numeric Expressions)](#6-biểu-thức-toán-học--số-học)
7. [Biểu thức ngày, giờ & thời lượng (Date, Time & Duration Expressions)](#7-biểu-thức-ngày-giờ--thời-lượng)
8. [Biểu thức danh sách & Tổng hợp (List & Aggregation Expressions)](#8-biểu-thức-danh-sách--tổng-hợp)
9. [Biểu thức tra cứu & Quan hệ (Lookup, Dereference & Relationships)](#9-biểu-thức-tra-cứu--quan-hệ)
10. [Biểu thức ngữ cảnh, Người dùng & Thiết bị (Context & User Expressions)](#10-biểu-thức-ngữ-cảnh-người-dùng--thiết-bị)
11. [Biểu thức vị trí & Tọa độ (Geo, Map & Location Expressions)](#11-biểu-thức-vị-trí--tọa-độ)
12. [Biểu thức điều hướng & Deep Links (Navigation Expressions)](#12-biểu-thức-điều-hướng--deep-links)
13. [Cẩm nang hiệu năng biểu thức (Expression Performance & Architecture Guide)](#13-cẩm-nang-hiệu-năng-biểu-thức)

---

## 1. Quy tắc cú pháp & Biến hệ thống

### Cú pháp cốt lõi (Core Syntax Rules)
- **Tên cột (Column identifier):** Luôn bọc trong dấu ngoặc vuông `[Tên_Cột]`.
- **Chuỗi ký tự (Text literal):** Luôn bọc trong dấu ngoặc kép `"Chuỗi ký tự"`.
- **Dereference (Truy xuất qua Ref):** `[Cột_Ref].[Cột_Bảng_Đích]` (Truy xuất tức thời O(1) không cần quét bảng).
- **Không dùng dấu bằng `=` ở đầu biểu thức** (Khác với Excel/Google Sheets).

### Biến hệ thống đặc biệt (Special Context Keywords)
| Biến / Từ khóa | Kiểu trả về | Giải nghĩa (Vi / En) | Ví dụ & Ứng dụng |
|---|---|---|---|
| `[_THIS]` | Tùy biến | Đại diện cho giá trị của chính cột hiện tại đang được cấu hình (`Valid_If`, `Show_If`, `Reset_If`). / Represents current column's value. | `[_THIS] > 0` (Trong Valid_If kiểm tra số dương) |
| `[_THISROW]` | Row Reference | Đại diện cho dòng hiện tại trong ngữ cảnh của bảng hiện tại khi dùng lồng trong các hàm lọc danh sách (`SELECT`, `FILTER`). / References the current row being processed. | `SELECT(ChiTiet[SoLuong], [DonHang_ID] = [_THISROW].[ID])` |
| `[_THISROW_BEFORE]` | Row Reference | Giá trị của dòng **trước khi thay đổi** (Chỉ dùng trong Bot Automation / Webhook / Event Trigger). / The row's values before update. | `[_THISROW_BEFORE].[TrangThai] <> [_THISROW_AFTER].[TrangThai]` |
| `[_THISROW_AFTER]` | Row Reference | Giá trị của dòng **sau khi thay đổi** (Chỉ dùng trong Bot Automation / Webhook). / The row's values after update. | `[_THISROW_AFTER].[TrangThai] = "Hoàn thành"` |
| `[_ROWNUMBER]` | Number | Số thứ tự dòng trên Google Sheets / Data Source (⚠️ Không được dùng làm Khóa chính Key). / Physical spreadsheet row number. | `[_ROWNUMBER] > 1` |

---

### ❌ Hàm KHÔNG tồn tại trong AppSheet (Excel/Sheets functions that do NOT exist)

> [!CAUTION]
> **AppSheet is NOT Excel or Google Sheets.** Many spreadsheet functions have **no AppSheet equivalent** and will throw "Unable to find function" / "is not a valid expression". Only use functions listed in this catalog. If a function is not documented here, assume it does NOT exist. The list below is the most common wrong-guesses — use the AppSheet replacement instead.

| ❌ Không tồn tại (do NOT use) | ✅ Cách viết đúng trong AppSheet (correct AppSheet form) |
|---|---|
| `IFERROR(x, fallback)` | AppSheet has no error-wrapping. Guard the cause: `IF(ISBLANK([x]), fallback, [x])` or `IFS(ISBLANK([x]), fallback, TRUE, [x])`. For divide-by-zero: `IF([b]=0, 0, [a]/[b])`. |
| `IFNA(...)`, `ISERROR(...)`, `ISNA(...)`, `ERROR.TYPE(...)` | No error type exists. Test the real condition with `ISBLANK()` / `ISNOTBLANK()` / `IN()`. `ERROR("msg")` exists only to *raise* an error in Valid_If. |
| `VLOOKUP`, `HLOOKUP`, `XLOOKUP` | `LOOKUP(val, "Table", "SearchCol", "ReturnCol")`, or better the O(1) dereference `[RefCol].[Attribute]`. |
| `COALESCE(a, b, c)` | Nested/`IFS`: `IFS(ISNOTBLANK([a]), [a], ISNOTBLANK([b]), [b], TRUE, [c])`. |
| `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGEIF` | `SUM(SELECT(Table[Col], condition))`, `COUNT(SELECT(...))`, `AVERAGE(SELECT(...))`. |
| `CONCAT` | `CONCATENATE(a, b, ...)` or the `&` operator (note the trailing `ENATE`). |
| `TEXTJOIN(delim, ..., list)` | `CONCATENATE()` for fixed parts, or build from a list with `SELECT()` + concatenation. |
| `REGEXMATCH`, `REGEXEXTRACT`, `REGEXREPLACE` | No regex. Use `CONTAINS` / `STARTSWITH` / `ENDSWITH` / `FIND` / `SUBSTITUTE`, or the `EXTRACT*` family (§5). |
| `DATEDIF(a, b, unit)` | Subtract dates directly: `[b] - [a]` gives days for Date, or a Duration for DateTime → `TOTALHOURS(...)`/24; months via `EDATE`/`EOMONTH`. |
| `QUERY`, `ARRAYFORMULA`, `FILTER` (Sheets), `SORTN`, `IMPORTRANGE` | Use AppSheet list functions: `SELECT`, `FILTER("Table", cond)`, `ORDERBY`, `TOP` (§8). Note AppSheet `FILTER("Table", cond)` ≠ Sheets `FILTER`. |
| `NETWORKDAYS` | `WORKDAY(start, days, [holidays])` computes a work date; count business days by building a list, not a single function. |
| `ROUNDUP`, `ROUNDDOWN`, `MROUND`, `TRUNC` | `CEILING()` (up), `FLOOR()` (down), `ROUND(n, dec)` (half-up). |
| `LEFT`/`RIGHT` with negative or `SEARCH` (case-insensitive) | `FIND` is case-sensitive and 1-based; there is no `SEARCH`. |
| `TRUE()` / `FALSE()` (with parens) | Bare constants `TRUE` / `FALSE` — no parentheses. |

**Rule of thumb:** if you're about to write an Excel/Sheets function from memory, stop and find it in this catalog first. Not listed = does not exist.

---

## 2. Biểu thức logic & Yes/No

| Công thức | Kết quả trả về | Giải nghĩa (Vi) | Giải nghĩa (En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|---|
| `AND(cond1, cond2, ...)` | `Yes/No` | Trả về `TRUE` nếu **tất cả** các điều kiện đều đúng. Trả về `FALSE` nếu có ít nhất một điều kiện sai. | Returns TRUE if all arguments evaluate to true; FALSE otherwise. | **Cú pháp:** `AND(điều_kiện_1, điều_kiện_2, ...)`<br>**Ví dụ:** `AND([Tuoi] >= 18, [TrangThai] = "Hoạt động")` |
| `OR(cond1, cond2, ...)` | `Yes/No` | Trả về `TRUE` nếu **có ít nhất một** điều kiện đúng. Trả về `FALSE` khi toàn bộ điều kiện đều sai. | Returns TRUE if any argument evaluates to true; FALSE if all are false. | **Cú pháp:** `OR(điều_kiện_1, điều_kiện_2, ...)`<br>**Ví dụ:** `OR([VaiTro] = "Admin", [VaiTro] = "Manager")` |
| `NOT(cond)` | `Yes/No` | Đảo ngược giá trị logic: `TRUE` thành `FALSE`, `FALSE` thành `TRUE`. | Returns the logical opposite of the condition. | **Cú pháp:** `NOT(điều_kiện)`<br>**Ví dụ:** `NOT(ISBLANK([Email]))` |
| `ISBLANK(val)` | `Yes/No` | Trả về `TRUE` nếu giá trị ô/cột trống (không có dữ liệu). | Returns TRUE if the value is blank/absent. | **Cú pháp:** `ISBLANK([Tên_Cột])`<br>**Ví dụ:** `ISBLANK([NgayXacNhan])` |
| `ISNOTBLANK(val)` | `Yes/No` | Trả về `TRUE` nếu giá trị ô/cột có dữ liệu (không bị trống). | Returns TRUE if the value is present/not blank. | **Cú pháp:** `ISNOTBLANK([Tên_Cột])`<br>**Ví dụ:** `ISNOTBLANK([SoDienThoai])` |
| `IN(val, list)` | `Yes/No` | Trả về `TRUE` nếu giá trị cần tìm xuất hiện trong danh sách chỉ định. | Returns TRUE if the search value exists within the specified list. | **Cú pháp:** `IN(giá_trị, danh_sách)`<br>**Ví dụ 1:** `IN([TrangThai], LIST("Chờ duyệt", "Đang xử lý"))`<br>**Ví dụ 2:** `IN(USEREMAIL(), Slices_Admin[Email])` |
| `CONTAINS(text, fragment)` | `Yes/No` | Trả về `TRUE` nếu đoạn văn bản chứa chuỗi con cần tìm (Không phân biệt hoa thường). | Returns TRUE if the target text contains the given substring. | **Cú pháp:** `CONTAINS([Tên_Cột], "chuỗi_tìm")`<br>**Ví dụ:** `CONTAINS([GhiChu], "Gấp")` |
| `STARTSWITH(text, prefix)` | `Yes/No` | Trả về `TRUE` nếu văn bản bắt đầu bằng tiền tố chỉ định. | Returns TRUE if text begins with the specified substring. | **Cú pháp:** `STARTSWITH([Tên_Cột], "tiền_tố")`<br>**Ví dụ:** `STARTSWITH([MaDonHang], "DH-2026")` |
| `ENDSWITH(text, suffix)` | `Yes/No` | Trả về `TRUE` nếu văn bản kết thúc bằng hậu tố chỉ định. | Returns TRUE if text ends with the specified substring. | **Cú pháp:** `ENDSWITH([Tên_Cột], "hậu_tố")`<br>**Ví dụ:** `ENDSWITH([Email], "@gmail.com")` |
| `EXTRACTCHOICE(text)` | `Yes/No` | Trích xuất giá trị Yes/No từ một đoạn văn bản tự nhiên (ví dụ chứa 'yes', 'true', 'no', 'false'). | Extracts a single Yes/No value found within arbitrary text. | **Cú pháp:** `EXTRACTCHOICE([PhanHoiKhachHang])`<br>**Ví dụ:** `EXTRACTCHOICE("Khách xác nhận: Yes")` → `TRUE` |

---

## 3. Biểu thức điều kiện & Rẽ nhánh

| Công thức | Kết quả trả về | Giải nghĩa (Vi) | Giải nghĩa (En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|---|
| `IF(cond, if_true, if_false)` | Tùy biến | Kiểm tra điều kiện logic: Nếu đúng trả về giá trị 1, nếu sai trả về giá trị 2. | Evaluates condition; returns `if_true` if true, `if_false` otherwise. | **Cú pháp:** `IF(điều_kiện, giá_trị_khi_đúng, giá_trị_khi_sai)`<br>**Ví dụ:** `IF([Diem] >= 5, "Đạt", "Không đạt")` |
| `IFS(c1, v1, c2, v2, ...)` | Tùy biến | Kiểm tra lần lượt các cặp điều kiện từ trái qua phải, trả về giá trị tương ứng của điều kiện đầu tiên đúng. | Evaluates multiple conditions in sequence; returns value for first true condition. | **Cú pháp:** `IFS(đk1, kq1, đk2, kq2, TRUE, kq_mặc_định)`<br>**Ví dụ:**<br>`IFS(`<br>`  [Diem] >= 8.5, "Xuất sắc",`<br>`  [Diem] >= 7.0, "Khá",`<br>`  [Diem] >= 5.0, "Trung bình",`<br>`  TRUE, "Yếu"`<br>`)` |
| `SWITCH(val, k1, v1, k2, v2, ..., def)` | Tùy biến | So sánh một giá trị với danh sách các trường hợp (Cases) và trả về kết quả tương ứng. | Compares an expression to a list of values and returns the matching result, or default. | **Cú pháp:** `SWITCH(biểu_thức, trường_hợp_1, kq_1, trường_hợp_2, kq_2, ..., kq_mặc_định)`<br>**Ví dụ:**<br>`SWITCH([LoaiXe],`<br>`  "XeMay", 10000,`<br>`  "OTo4Cho", 30000,`<br>`  "OTo7Cho", 50000,`<br>`  0`<br>`)` |

---

## 4. Biểu thức xử lý văn bản

| Công thức | Kết quả trả về | Giải nghĩa (Vi) | Giải nghĩa (En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|---|
| `CONCATENATE(t1, t2, ...)` | `Text` | Nối nhiều đoạn văn bản hoặc giá trị các cột lại thành một chuỗi duy nhất. (Có thể dùng toán tử `&`). | Joins multiple text items or columns into a single string. | **Cú pháp:** `CONCATENATE(text1, text2, ...)` hoặc `text1 & text2`<br>**Ví dụ:** `CONCATENATE([Ho], " ", [Ten])` |
| `SPLIT(text, delimiter)` | `List` | Tách một chuỗi văn bản thành danh sách (List) các phần tử dựa theo ký tự phân cách. | Splits a text string into a list using the specified delimiter. | **Cú pháp:** `SPLIT(chuỗi_gốc, ký_tự_ngăn_cách)`<br>**Ví dụ:** `SPLIT([DanhSachEmail], " , ")` |
| `LEFT(text, count)` | `Text` | Lấy ra `count` ký tự đầu tiên tính từ bên trái của chuỗi. | Returns the specified number of characters from the start (left) of a string. | **Cú pháp:** `LEFT([Tên_Cột], số_ký_tự)`<br>**Ví dụ:** `LEFT([MaSP], 3)` → `"SP0"` |
| `RIGHT(text, count)` | `Text` | Lấy ra `count` ký tự cuối cùng tính từ bên phải của chuỗi. | Returns the specified number of characters from the end (right) of a string. | **Cú pháp:** `RIGHT([Tên_Cột], số_ký_tự)`<br>**Ví dụ:** `RIGHT([MaDonHang], 4)` |
| `MID(text, start, count)` | `Text` | Trích xuất một đoạn văn bản từ vị trí bắt đầu `start` với độ dài `count`. | Returns a segment of text starting at character position `start` for `count` length. | **Cú pháp:** `MID([Tên_Cột], vị_trí_bắt_đầu, số_ký_tự)`<br>**Ví dụ:** `MID("ABC-12345-XYZ", 5, 5)` → `"12345"` |
| `SUBSTITUTE(text, old, new)` | `Text` | Thay thế chuỗi con `old` bằng chuỗi mới `new` trong văn bản gốc. | Substitutes existing text with new text within a string. | **Cú pháp:** `SUBSTITUTE(chuỗi_gốc, chuỗi_cũ, chuỗi_mới)`<br>**Ví dụ:** `SUBSTITUTE([SoDienThoai], " ", "")` |
| `TRIM(text)` | `Text` | Loại bỏ các khoảng trắng thừa ở hai đầu và khoảng trắng kép ở giữa chuỗi. | Removes leading, trailing, and repeated extra whitespace. | **Cú pháp:** `TRIM([Tên_Cột])`<br>**Ví dụ:** `TRIM("  Nguyễn   Văn A  ")` → `"Nguyễn Văn A"` |
| `UPPER(text)` | `Text` | Chuyển đổi toàn bộ văn bản sang chữ IN HOA. | Converts all characters in text to uppercase. | **Cú pháp:** `UPPER([Tên_Cột])`<br>**Ví dụ:** `UPPER("appsheet")` → `"APPSHEET"` |
| `LOWER(text)` | `Text` | Chuyển đổi toàn bộ văn bản sang chữ in thường. | Converts all characters in text to lowercase. | **Cú pháp:** `LOWER([Email])`<br>**Ví dụ:** `LOWER("USER@TEST.COM")` → `"user@test.com"` |
| `PROPER(text)` | `Text` | Viết hoa chữ cái đầu tiên của mỗi từ trong câu. | Capitalizes the first letter of each word in text. | **Cú pháp:** `PROPER([HoVaTen])`<br>**Ví dụ:** `PROPER("nguyễn văn nam")` → `"Nguyễn Văn Nam"` |
| `LEN(text)` | `Number` | Đếm tổng số ký tự có trong chuỗi văn bản. | Returns the character length of a text string. | **Cú pháp:** `LEN([Tên_Cột])`<br>**Ví dụ:** `LEN([MaSoThue]) = 10` |
| `FIND(needle, haystack)` | `Number` | Tìm vị trí xuất hiện đầu tiên của chuỗi `needle` trong chuỗi `haystack` (Trả về 0 nếu không tìm thấy, chỉ số tính từ 1). | Returns the 1-based character position of a substring within text; 0 if absent. | **Cú pháp:** `FIND("chuỗi_tìm", [Chuỗi_Gốc])`<br>**Ví dụ:** `FIND("@", [Email])` |
| `TEXT(value, [format])` | `Text` | Định dạng ngày tháng, giờ, số hoặc tiền tệ thành chuỗi văn bản theo mẫu chỉ định. | Converts values (Date, Time, Number) into formatted text. | **Cú pháp:** `TEXT(giá_trị, "mẫu_định_dạng")`<br>**Ví dụ 1:** `TEXT(TODAY(), "DD/MM/YYYY")`<br>**Ví dụ 2:** `TEXT(NOW(), "HH:MM AM/PM")` |
| `INITIALS(text)` | `Text` | Lấy các chữ cái đầu tiên của các từ trong chuỗi (Thích hợp tạo Avatar viết tắt). | Extracts initial letters from words in a name/phrase. | **Cú pháp:** `INITIALS([HoVaTen])`<br>**Ví dụ:** `INITIALS("Nguyen Van An")` → `"NVA"` |
| `ENCODEURL(text)` | `Text` | Mã hóa chuỗi văn bản an toàn cho đường link URL (chuyển dấu cách thành %20,...). | Encodes text for use in URL query parameters. | **Cú pháp:** `ENCODEURL([NoiDungTinNhan])`<br>**Ví dụ:** `CONCATENATE("https://wa.me/84901234567?text=", ENCODEURL([LoiNhan]))` |

---

## 5. Nhóm hàm trích xuất dữ liệu (Extract Expressions)

AppSheet cung cấp các hàm AI/Regex tích hợp sẵn để trích xuất nhanh thông tin từ văn bản phi cấu trúc:

| Công thức | Kiểu trả về | Giải nghĩa & Ví dụ thực tế |
|---|---|---|
| `EXTRACT(type, text)` | `List` | Hàm trích xuất tổng quát. `type` có thể là: `CHOICE`, `DATES`, `DATETIMES`, `DOMAINS`, `EMAILS`, `HASHTAGS`, `MENTIONS`, `NUMBERS`, `PHONENUMBERS`, `PRICES`, `TIMES`.<br>**Ví dụ:** `EXTRACT("EMAILS", [NoiDungEmail])` |
| `EXTRACTDATES(text)` | `List of Date` | Trích xuất tất cả các ngày tháng có trong đoạn văn bản.<br>**Ví dụ:** `EXTRACTDATES("Họp vào ngày 20/10/2026 và 25/10/2026")` → `[20/10/2026, 25/10/2026]` |
| `EXTRACTDATETIMES(text)` | `List of DateTime` | Trích xuất tất cả các mốc ngày giờ có trong văn bản.<br>**Ví dụ:** `EXTRACTDATETIMES("Hạn chót: 15/08/2026 17:00")` |
| `EXTRACTDOMAINS(text)` | `List of Text` | Trích xuất tên miền website xuất hiện trong văn bản.<br>**Ví dụ:** `EXTRACTDOMAINS("Ghé thăm website https://google.com ngay")` → `["google.com"]` |
| `EXTRACTEMAILS(text)` | `List of Email` | Trích xuất danh sách địa chỉ email có trong văn bản.<br>**Ví dụ:** `EXTRACTEMAILS("Liên hệ contact@ecotech.vn hoặc support@ecotech.vn")` |
| `EXTRACTHASHTAGS(text)` | `List of Text` | Trích xuất các thẻ bắt đầu bằng dấu `#`.<br>**Ví dụ:** `EXTRACTHASHTAGS("Bài viết về #AppSheet và #NoCode")` → `["#AppSheet", "#NoCode"]` |
| `EXTRACTMENTIONS(text)` | `List of Text` | Trích xuất các thẻ nhắc đến người dùng bắt đầu bằng dấu `@`.<br>**Ví dụ:** `EXTRACTMENTIONS("Nhờ @an.nguyen duyệt giúp")` → `["@an.nguyen"]` |
| `EXTRACTNUMBERS(text)` | `List of Decimal` | Trích xuất tất cả các con số có trong chuỗi văn bản.<br>**Ví dụ:** `EXTRACTNUMBERS("Chiều dài 15m, chiều rộng 8.5m")` → `[15, 8.5]` |
| `EXTRACTPHONENUMBERS(text)` | `List of Phone` | Trích xuất các số điện thoại từ văn bản.<br>**Ví dụ:** `EXTRACTPHONENUMBERS("Gọi 0901234567 để đặt hàng")` → `["0901234567"]` |
| `EXTRACTPRICES(text)` | `List of Price` | Trích xuất các giá trị tiền tệ kèm đơn vị (USD, VND, $,...).<br>**Ví dụ:** `EXTRACTPRICES("Tổng hóa đơn là 500000 VND")` → `[500000]` |
| `EXTRACTTIMES(text)` | `List of Time` | Trích xuất các mốc giờ giấc trong văn bản.<br>**Ví dụ:** `EXTRACTTIMES("Thời gian từ 08:30 đến 17:30")` → `[08:30:00, 17:30:00]` |

---

## 6. Biểu thức toán học & Số học

| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|
| `ABS(number)` | `Number/Decimal` | Trả về giá trị tuyệt đối (luôn dương). / Absolute value. | `ABS([SoDu_DauKy] - [SoDu_CuoiKy])` |
| `AVERAGE(list)` | `Decimal` | Tính trung bình cộng của một danh sách số. / Average of numbers. | `AVERAGE(ChiTietDonHang[DonGia])` |
| `CEILING(number)` | `Number` | Làm tròn lên số nguyên gần nhất lớn hơn hoặc bằng. / Rounds up to next integer. | `CEILING(3.14)` → `4` |
| `FLOOR(number)` | `Number` | Làm tròn xuống số nguyên gần nhất nhỏ hơn hoặc bằng. / Rounds down to integer. | `FLOOR(3.89)` → `3` |
| `ROUND(number, [dec])` | `Number/Decimal` | Làm tròn số theo quy tắc toán học đến số chữ số thập phân chỉ định. / Rounds to specified decimal places. | `ROUND(12.3456, 2)` → `12.35` |
| `DECIMAL(text_or_num)` | `Decimal` | Chuyển đổi chuỗi văn bản hoặc số nguyên thành kiểu số thập phân. / Converts value to Decimal. | `DECIMAL("123.45")` |
| `NUMBER(text_or_num)` | `Number` | Chuyển đổi chuỗi văn bản hoặc số thập phân thành số nguyên. / Converts value to integer Number. | `NUMBER("100")` |
| `PERCENT(number)` | `Percent` | Chuyển đổi một số thành định dạng phần trăm (Ví dụ 0.15 → 15%). / Converts to percent. | `PERCENT(0.1)` → `10%` |
| `PRICE(number)` | `Price` | Chuyển đổi số thành kiểu Tiền tệ (Price). / Converts to Price type. | `PRICE(150000)` |
| `POWER(base, exp)` | `Decimal` | Tính lũy thừa $base^{exp}$. / Computes base raised to the power of exponent. | `POWER(2, 3)` → `8` |
| `SQRT(number)` | `Decimal` | Tính căn bậc hai của một số không âm. / Computes square root. | `SQRT(16)` → `4` |
| `MOD(dividend, divisor)` | `Number` | Lấy phần dư của phép chia. / Returns the remainder of division. | `MOD(10, 3)` → `1` |
| `RANDBETWEEN(low, high)` | `Number` | Tạo một số nguyên ngẫu nhiên trong khoảng từ `low` đến `high`. (⚠️ Chỉ dùng trong Initial Value, không dùng trong Virtual Column). / Returns random integer. | `RANDBETWEEN(100000, 999999)` |
| `LN(number)` | `Decimal` | Logarit tự nhiên (cơ số $e$). / Natural logarithm. | `LN(10)` |
| `LOG(number)` | `Decimal` | Logarit cơ số 10 của một số. / Base-10 logarithm. | `LOG(100)` → `2` |
| `LOG2(number)` | `Decimal` | Logarit cơ số 2 của một số. / Base-2 logarithm. | `LOG2(8)` → `3` |
| `LOG10(number)` | `Decimal` | Logarit cơ số 10 của một số. / Base-10 logarithm. | `LOG10(1000)` → `3` |
| `SUM(list)` | `Number/Decimal` | Tính tổng các số trong danh sách. / Sum of list items. | `SUM(ChiTietDonHang[ThanhTien])` |

---

## 7. Biểu thức ngày, giờ & thời lượng

### Nhóm lấy thời gian hiện tại
| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ |
|---|---|---|---|
| `TODAY()` | `Date` | Lấy ngày hiện tại theo múi giờ thiết bị người dùng. / Current date. | `[NgayDatHang] = TODAY()` |
| `NOW()` | `DateTime` | Lấy ngày và giờ hiện tại theo múi giờ thiết bị. / Current date and time. | `[ThoiGianTao] = NOW()` |
| `UTCNOW()` | `DateTime` | Lấy ngày và giờ hiện tại theo chuẩn múi giờ quốc tế UTC (Hữu ích khi đồng bộ dữ liệu đa quốc gia). / Current UTC date and time. | `[CreatedAt_UTC] = UTCNOW()` |
| `TIMEOFDAY(datetime)` | `Time` | Lấy phần giờ:phút:giây từ một giá trị DateTime hoặc Time. / Extracts time component. | `TIMEOFDAY(NOW())` |

### Nhóm trích xuất thành phần ngày/giờ
| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ |
|---|---|---|---|
| `YEAR(date)` | `Number` | Lấy năm của giá trị Ngày/DateTime. / Extracts year (4 digits). | `YEAR([NgaySinh])` → `1995` |
| `MONTH(date)` | `Number` | Lấy tháng (1 đến 12). / Extracts month number (1–12). | `MONTH(TODAY())` |
| `DAY(date)` | `Number` | Lấy ngày trong tháng (1 đến 31). / Extracts day of the month (1–31). | `DAY(TODAY())` |
| `HOUR(duration/time)` | `Number` | Lấy số giờ trong một khoảng thời lượng hoặc thời điểm. / Extracts hours component. | `HOUR([ThoiGianKetThuc] - [ThoiGianBatDau])` |
| `MINUTE(duration/time)` | `Number` | Lấy số phút (0 đến 59). / Extracts minutes component. | `MINUTE([GioCheckIn])` |
| `SECOND(duration/time)` | `Number` | Lấy số giây (0 đến 59). / Extracts seconds component. | `SECOND([GioCheckIn])` |
| `WEEKDAY(date)` | `Number` | Lấy thứ trong tuần (1 = Chủ nhật, 2 = Thứ 2, ..., 7 = Thứ 7). / Day of week (1=Sun, 7=Sat). | `WEEKDAY(TODAY()) = 2` (Kiểm tra nếu là Thứ Hai) |
| `WEEKNUM(date)` | `Number` | Lấy số tuần trong năm (1 đến 53). / Week number of the year. | `WEEKNUM(TODAY())` |

### Nhóm tính toán thời lượng & Ngày làm việc
| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ |
|---|---|---|---|
| `TOTALHOURS(duration)` | `Decimal` | Chuyển đổi toàn bộ khoảng thời lượng Duration thành số giờ dạng số thập phân. / Converts Duration to decimal hours. | `TOTALHOURS([GioRa] - [GioVao])` (Ví dụ 01:30:00 → 1.5) |
| `TOTALMINUTES(duration)` | `Decimal` | Chuyển đổi toàn bộ khoảng thời lượng thành tổng số phút. / Converts Duration to total minutes. | `TOTALMINUTES([GioRa] - [GioVao])` (Ví dụ 01:30:00 → 90) |
| `TOTALSECONDS(duration)` | `Decimal` | Chuyển đổi khoảng thời lượng thành tổng số giây. / Converts Duration to total seconds. | `TOTALSECONDS([ThoiLuong])` |
| `WORKDAY(start, days, [holidays])` | `Date` | Tính ngày làm việc trong tương lai/quá khứ (tự động bỏ qua Thứ 7, Chủ nhật và danh sách ngày lễ tùy chọn). / Returns work date offset excluding weekends/holidays. | `WORKDAY(TODAY(), 5, LIST(DATE("2026-04-30"), DATE("2026-05-01")))` |
| `EOMONTH(date, offset)` | `Date` | Trả về ngày cuối cùng của tháng sau khi cộng/trừ số tháng `offset`. / Returns end-of-month date. | `EOMONTH(TODAY(), 0)` (Ngày cuối cùng của tháng hiện tại)<br>`EOMONTH(TODAY(), -1) + 1` (Ngày đầu tiên của tháng hiện tại) |
| `EDATE(date, offset)` | `Date` | Trả về cùng ngày đó nhưng cộng/trừ thêm `offset` tháng. / Returns date shifted by N months. | `EDATE(TODAY(), 12)` (Ngày này năm sau) |
| `DATE(val)` | `Date` | Ép kiểu chuỗi hoặc DateTime về kiểu Ngày. / Converts value to Date. | `DATE("2026-12-31")` |
| `DATETIME(val)` | `DateTime` | Ép kiểu dữ liệu về DateTime. / Converts value to DateTime. | `DATETIME("2026-12-31 14:00:00")` |
| `TIME(val)` | `Time` | Ép kiểu dữ liệu về Giờ. / Converts value to Time. | `TIME("14:30:00")` |

---

## 8. Biểu thức danh sách & Tổng hợp

> [!IMPORTANT]
> **Quy tắc hiệu năng:** Các hàm quét bảng danh sách như `SELECT()`, `FILTER()` là nguyên nhân số 1 gây lag và kéo dài thời gian Sync nếu đặt trong Virtual Column. Hãy xem mục [13. Cẩm nang hiệu năng biểu thức](#13-cẩm-nang-hiệu-năng-biểu-thức) để tối ưu.

| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|
| `LIST(item1, item2, ...)` | `List` | Tạo một danh sách gồm các phần tử chỉ định. / Creates a list from items. | `LIST("Hà Nội", "Đà Nẵng", "TP.HCM")` |
| `SELECT(Table[Column], [Filter], [Distinct])` | `List` | Quét toàn bộ bảng `Table`, lọc theo điều kiện `[Filter]` và trích xuất danh sách giá trị của cột `[Column]`. Nếu `[Distinct]` = `TRUE`, sẽ loại bỏ giá trị trùng lặp. / Queries a table column matching filter condition. | **Cú pháp:** `SELECT(Bảng[Cột], [Điều_Kiện], [Loại_Bỏ_Trùng_Lặp])`<br>**Ví dụ 1:** `SELECT(KhachHang[Email], [KhuVuc] = "Miền Bắc")`<br>**Ví dụ 2:** `SELECT(ChiTietDonHang[SoLuong], [DonHang_ID] = [_THISROW].[ID])` |
| `FILTER("Table", [Filter])` | `List of Ref` | Tương đương `SELECT(Table[KeyColumn], [Filter])` — Trả về danh sách Khóa chính (Ref) của các dòng thỏa mãn điều kiện. / Returns list of row keys for table matching condition. | **Cú pháp:** `FILTER("DonHang", [TrangThai] = "Chờ duyệt")` |
| `ORDERBY(List_Keys, Col1, [Desc1], ...)` | `List of Ref` | Sắp xếp lại danh sách các Khóa chính (Ref) dựa trên giá trị của một hoặc nhiều cột. / Sorts a list of row keys by column values. | **Cú pháp:** `ORDERBY(FILTER("DonHang", [KhachHang_ID] = [_THISROW].[ID]), [NgayDat], TRUE)` (Sắp xếp theo ngày giảm dần) |
| `SORT(list, [descending])` | `List` | Sắp xếp các giá trị trong danh sách thông thường theo thứ tự tăng/giảm. / Sorts a simple list of values. | `SORT(LIST(5, 2, 9, 1), FALSE)` → `[1, 2, 5, 9]` |
| `UNIQUE(list)` | `List` | Loại bỏ các phần tử trùng lặp trong danh sách, chỉ giữ lại các giá trị duy nhất. / Removes duplicates from list. | `UNIQUE(DonHang[NhanVienPhuTrach])` |
| `TOP(list, count)` | `List` | Lấy ra `count` phần tử đầu tiên trong danh sách. / Returns first N items from list. | `TOP(ORDERBY(SanPham[ID], [SoLuongBan], TRUE), 5)` (Top 5 sản phẩm bán chạy nhất) |
| `INDEX(list, position)` | Tùy biến | Lấy phần tử tại vị trí thứ `position` trong danh sách (Chỉ số bắt đầu từ 1). / Returns item at 1-based position. | `INDEX(SPLIT([HoVaTen], " "), 1)` (Lấy từ đầu tiên) |
| `ANY(list)` | Tùy biến | Lấy một phần tử bất kỳ (thường là phần tử đầu tiên) từ danh sách. Thường dùng kết hợp để chuyển `SELECT()` danh sách 1 phần tử về giá trị đơn lẻ. / Returns first/arbitrary single item from a list. | `ANY(SELECT(NhanVien[SoDienThoai], [MaNV] = [_THISROW].[NguoiPhuTrach]))` |
| `COUNT(list)` | `Number` | Đếm tổng số lượng phần tử có trong danh sách. / Returns count of items in list. | `COUNT([Related ChiTietDonHangs])` |
| `INTERSECT(list1, list2)` | `List` | Lấy giao điểm (phần tử chung) giữa 2 danh sách. / Returns common items between two lists. | `INTERSECT([QuyenNguoiDung], LIST("Admin", "SuperAdmin"))` |
| `list1 + list2` | `List` | Gộp 2 danh sách lại với nhau (Union). / Combines two lists. | `[Emails_NoiBo] + [Emails_DoiTac]` |
| `list1 - list2` | `List` | Trừ danh sách (Loại bỏ các phần tử của `list2` ra khỏi `list1`). / Subtracts items of list2 from list1. | `NhanVien[Email] - DanhSachNghiViec[Email]` |

---

## 9. Biểu thức tra cứu & Quan hệ

| Biểu thức / Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|
| `[RefColumn].[Attribute]` | Tùy biến | **Dereference (Truy xuất qua Ref):** Lấy giá trị cột của bảng cha trực tiếp qua quan hệ Ref. **Tốc độ cực nhanh O(1)** vì dùng Index trong bộ nhớ RAM, không quét bảng. / Instant O(1) dereference lookup. | **Cú pháp:** `[Tên_Cột_Ref].[Tên_Cột_Bảng_Đích]`<br>**Ví dụ:** `[KhachHang_ID].[SoDienThoai]` (Lấy SĐT của khách hàng trong bảng Đơn hàng) |
| `[Ref1].[Ref2].[Attribute]` | Tùy biến | **Multi-level Dereference:** Truy xuất liên tầng qua nhiều bảng liên kết. / Multi-level chain dereference. | `[DonHang_ID].[KhachHang_ID].[DiaChi]` |
| `LOOKUP(val, Table, SearchCol, ReturnCol)` | Tùy biến | Tìm dòng đầu tiên trong bảng `Table` có `SearchCol = val` và trả về giá trị ở cột `ReturnCol`. ⚠️ **Chậm hơn Dereference** vì quét tuần tự bảng. / Sequential table lookup. | **Cú pháp:** `LOOKUP(giá_trị_tìm, "Tên_Bảng", "Cột_Tìm", "Cột_Lấy")`<br>**Ví dụ:** `LOOKUP("SP-001", "SanPham", "MaSP", "GiaBan")` |
| `MAXROW("Table", "Col_Max", [Filter])` | `Ref` | Trả về Khóa chính (Ref) của dòng có giá trị cột `Col_Max` lớn nhất thỏa mãn điều kiện `[Filter]`. / Returns key of row with maximum value. | **Cú pháp:** `MAXROW("BaoGia", "NgayTao", [KhachHang_ID] = [_THISROW].[KhachHang_ID])`<br>**Kết hợp lấy giá trị:** `[KhachHang].[BaoGiaMoiNhat].[TongTien]` |
| `MINROW("Table", "Col_Min", [Filter])` | `Ref` | Trả về Khóa chính (Ref) của dòng có giá trị cột `Col_Min` nhỏ nhất thỏa mãn điều kiện `[Filter]`. / Returns key of row with minimum value. | `MINROW("ChuyenBay", "GiaVe", [DiemDen] = "Hà Nội")` |
| `REF_ROWS("ChildTable", "RefColumn")` | `List of Ref` | Tự động tạo danh sách các dòng con trỏ về dòng hiện tại (Hàm sinh ra cột ảo quan hệ 1-N `Related Items`). / System function generating related child rows list. | `REF_ROWS("ChiTietDonHang", "DonHang_ID")` |
| `PARENT()` | `Ref` | Đại diện cho dòng cha trong cấu trúc biểu mẫu phân cấp. / References parent form record. | `PARENT()` |

---

## 10. Biểu thức ngữ cảnh, Người dùng & Thiết bị

| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|
| `USEREMAIL()` | `Email` | Trả về địa chỉ email của người dùng đang đăng nhập vào ứng dụng. / Email of current logged-in user. | `[NguoiPhuTrach_Email] = USEREMAIL()` (Thường dùng trong Security Filter) |
| `USERNAME()` | `Name` | Trả về tên hiển thị của tài khoản người dùng đăng nhập. / Display name of logged-in user. | `USERNAME()` |
| `USERROLE()` | `Text` | Trả về vai trò của người dùng trên AppSheet: `"Admin"` hoặc `"User"`. / Returns `"Admin"` or `"User"`. | `USERROLE() = "Admin"` (Hiển thị các nút cấu hình quản trị) |
| `USERLOCALE()` | `Text` | Trả về mã ngôn ngữ / quốc gia của thiết bị người dùng (ví dụ `"vi-VN"`, `"en-US"`). / User device locale code. | `IF(USERLOCALE() = "vi-VN", "Xin chào", "Hello")` |
| `USERSETTINGS("Tên_Cài_Đặt")` | Tùy biến | Đọc giá trị người dùng đã thiết lập trong mục User Settings (Cài đặt cá nhân cục bộ). / Reads user custom settings value. | `[ChiNhanh] = USERSETTINGS("ChiNhanhLamViec")` |
| `CONTEXT("View")` | `Text` | Trả về tên của View đang được hiển thị trên màn hình hiện tại. / Name of currently displayed view. | `CONTEXT("View") = "DonHang_Form"` (Dùng trong Show_If để ẩn cột khi ở View khác) |
| `CONTEXT("ViewType")` | `Text` | Trả về loại View hiện tại (`"form"`, `"detail"`, `"table"`, `"deck"`, `"dashboard"`, `"map"`,...). / Type of active view. | `CONTEXT("ViewType") = "form"` |
| `CONTEXT("Table")` | `Text` | Trả về tên bảng dữ liệu của View hiện tại. / Active table name. | `CONTEXT("Table")` |
| `CONTEXT("Device")` | `Text` | Trả về ID nhận dạng thiết bị phần cứng của người dùng. / Hardware device unique ID. | `CONTEXT("Device")` |
| `CONTEXT("AppName")` | `Text` | Trả về tên đầy đủ của App hiện tại (`"AppName-AccountID"`). / AppSheet App ID name. | `CONTEXT("AppName")` |
| `UNIQUEID([Type])` | `Text` | **Tạo mã khóa chính duy nhất ngẫu nhiên.** Luôn đặt trong **Initial Value** của cột Key. Hỗ trợ: `UNIQUEID()` (8 ký tự), `UNIQUEID("UUID")`, `UNIQUEID("GUID")`, `UNIQUEID("HEX")`. / Generates unique key. | `UNIQUEID()` hoặc `UNIQUEID("UUID")` |
| `INPUT("Name", "Default")` | Tùy biến | Nhắc người dùng nhập dữ liệu động khi thực thi một Action. / Prompts user for dynamic input in an Action. | `INPUT("LyDoHuy", "Hết hàng trong kho")` |

---

## 11. Biểu thức vị trí & Tọa độ

| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|
| `HERE()` | `LatLong` | Lấy tọa độ GPS hiện tại của thiết bị người dùng. (⚠️ Luôn đặt trong Initial Value khi Check-in / Tạo mới, không đặt trong App Formula/Virtual Column). / Current device GPS location. | `HERE()` (Trong Initial Value cột `[ToaDoCheckIn]`) |
| `LATLONG(lat, long)` | `LatLong` | Ghép vĩ độ (Latitude) và kinh độ (Longitude) thành kiểu dữ liệu Tọa độ LatLong. / Combines lat and long. | `LATLONG(10.762622, 106.660172)` |
| `LAT(latlong)` | `Decimal` | Lấy giá trị Vĩ độ (Latitude) từ cột LatLong. / Extracts latitude. | `LAT([ToaDoGPS])` |
| `LONG(latlong)` | `Decimal` | Lấy giá trị Kinh độ (Longitude) từ cột LatLong. / Extracts longitude. | `LONG([ToaDoGPS])` |
| `DISTANCE(loc1, loc2)` | `Decimal` | Tính khoảng cách đường chim bay giữa 2 điểm tọa độ GPS theo đơn vị **Kilometers (Km)**. / Calculates distance in km between two GPS points. | `DISTANCE(HERE(), [ToaDoKhoHang]) <= 0.5` (Kiểm tra khoảng cách check-in ≤ 500m) |

---

## 12. Biểu thức điều hướng & Deep Links

Dùng trong các Action loại **"App: go to another view within this app"** hoặc chuyển app:

| Công thức | Kiểu trả về | Giải nghĩa (Vi / En) | Cú pháp & Ví dụ thực tế |
|---|---|---|---|
| `LINKTOVIEW("ViewName")` | `App Link` | Điều hướng người dùng chuyển đến một View cụ thể trong ứng dụng. / Navigates to a specific app view. | `LINKTOVIEW("BaoCaoDoanhThu")` |
| `LINKTOROW(RowKey, "ViewName")` | `App Link` | Mở trực tiếp màn hình Detail hoặc Form của một dòng dữ liệu cụ thể qua Khóa chính `RowKey`. / Opens specific row in view. | `LINKTOROW([ID], "DonHang_Detail")` |
| `LINKTOFORM("ViewName", [col1], val1, ...)` | `App Link` | Mở một Form mới và tự động điền sẵn các giá trị mặc định vào các cột chỉ định. / Opens a form pre-populated with initial values. | `LINKTOFORM("ChiTietDonHang_Form", "DonHang_ID", [ID], "NgayTao", TODAY())` |
| `LINKTOFILTEREDVIEW("ViewName", Filter)` | `App Link` | Điều hướng đến một View với bộ lọc động chỉ hiển thị các dòng thỏa mãn điều kiện. / Navigates to a view dynamically filtered. | `LINKTOFILTEREDVIEW("DonHang_Table", [KhachHang_ID] = [_THISROW].[ID])` |
| `LINKTOPARENTVIEW()` | `App Link` | Quay trở lại View cha trước đó trong luồng điều hướng Form con. / Navigates back to parent view. | `LINKTOPARENTVIEW()` |
| `LINKTOAPP("AppID")` | `App Link` | Mở một ứng dụng AppSheet khác trên cùng thiết bị. / Opens another AppSheet application. | `LINKTOAPP("InventoryApp-123456")` |

---

## 13. Cẩm nang hiệu năng biểu thức

### 1. Phân biệt 3 nhóm chi phí (Cost Buckets)
1. **Sync-time Cost (Đắt nhất — Cần triệt tiêu):** 
   - Diễn ra trên thiết bị của *tất cả người dùng trên mỗi lần nhấn Sync*.
   - **Thủ phạm:** Cột ảo (Virtual Columns), Security Filter phức tạp, `Address` geocoding.
2. **Edit-time Cost (Rất rẻ — Nên ưu tiên):**
   - Chỉ tính toán *1 lần duy nhất bởi người sửa/thêm dòng* khi bấm Save Form.
   - **Giải pháp:** Đặt công thức vào **App Formula** hoặc **Initial Value** của **Cột vật lý (Physical Column)**.
3. **Backend / Bot Cost (Chạy nền trên server):**
   - Thực thi bất đồng bộ bởi Bot Automation hoặc Apps Script.

### 2. Bảng quy đổi tối ưu công thức (Anti-pattern vs Fix)

| Công thức kém hiệu năng (Smell) | Vì sao chậm? | Cách viết tối ưu (Architect Fix) |
|---|---|---|
| `LOOKUP([ID], "KhachHang", "ID", "DiaChi")` | Quét tuần tự toàn bộ bảng $O(N)$ | Dùng Dereference: `[KhachHang_ID].[DiaChi]` (Tức thời $O(1)$) |
| `SELECT(SanPham[Gia], [ID] = [_THISROW].[SP_ID])` trong Cột Ảo | Quét bảng mỗi lần Sync, nhân với số dòng | Chuyển sang Cột vật lý có App Formula: `[SP_ID].[Gia]` |
| `MAXROW("DonHang", "NgayTao", [KH_ID] = [_THISROW].[ID])` trong Cột Ảo | Quét bảng lặp lại nhiều lần | Tạo Action gán giá trị khi có đơn hàng mới hoặc dùng Slice |
| `UNIQUEID()` trong App Formula | Mã ID bị thay đổi mỗi khi sửa dòng | Luôn đặt `UNIQUEID()` trong **Initial Value** |
| `HERE()` trong Virtual Column | Thiết bị gọi định vị GPS liên tục làm đơ app | Đặt `HERE()` trong **Initial Value** khi tạo dòng |
| `OR([KhuVuc]="Bac", [KhuVuc]="Nam")` trong Security Filter trên SQL | Không thể push-down bộ lọc xuống Database SQL | Dùng `IN([KhuVuc], LIST("Bac", "Nam"))` để SQL Server lọc từ gốc |
