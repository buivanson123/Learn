# 60 câu hỏi phỏng vấn CSS

Mỗi câu có **Trả lời ngắn** (nói ra miệng) và **Giải thích sâu** (để trả lời câu hỏi tiếp theo).

Đừng mở đáp án trước khi tự trả lời.

---

## Phần 1 — Cascade và selector (câu 1–12)

### 1. Specificity được tính thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó là bộ ba số `(id, class, thẻ)`, so từ trái sang phải như so số phiên bản. `#a` là
(1,0,0), `.a` là (0,1,0), `p` là (0,0,1). Ba con số **không cộng dồn** thành một điểm số.

**Giải thích sâu:** Nhiều người nghĩ id = 100 điểm, class = 10 điểm nên 20 class thắng 1 id. Sai. Đo
thật:

```css
#id { color: rgb(0,0,255) }
.c1.c1.c1...(20 lần) { color: rgb(0,255,0) }
```
```js
-> "rgb(0, 0, 255)"     ← id thắng
```

So `(1,0,0)` với `(0,20,0)`: xét con số đầu, `1 > 0`, dừng — số class không được nhìn tới.

Cần biết thêm: `[type=x]`, `:hover`, `:nth-child()` tính như class. `::before` tính như thẻ. `*` và các
dấu tổ hợp `>` `+` `~` không tính gì.

</details>

### 2. `:is()` và `:where()` khác nhau ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cùng chức năng gộp selector, nhưng `:is()` lấy specificity **cao nhất** trong ngoặc,
còn `:where()` **luôn bằng 0**.

**Giải thích sâu:**

```css
:is(p, #zzz) { color: red }        /* = (1,0,0) vì có #zzz */
.cls         { color: green }      /* = (0,1,0) */
:where(#aaa, p) { background: yellow }   /* = (0,0,0) dù có #aaa */
p               { background: blue }     /* = (0,0,1) -> thắng */
```
```js
{ color_thang: "rgb(255, 0, 0)", background_thang: "rgb(0, 0, 255)" }
```

Điểm nguy hiểm: `#zzz` **không tồn tại trong HTML** mà vẫn kéo specificity lên.

Dùng `:where()` cho file reset (để mọi rule sau dễ đè), `:is()` khi cố ý giữ specificity.

</details>

### 3. `@layer` là gì, nó giải quyết vấn đề nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó tạo các tầng ưu tiên đứng **trên** specificity. Layer khai sau thắng layer khai
trước, bất kể selector mạnh yếu. Nó là câu trả lời thật sự cho việc lạm dụng `!important`.

**Giải thích sâu:**

```css
@layer base, theme;
@layer theme { p { color: rgb(0,200,0) } }         /* (0,0,1) */
@layer base  { p#id.cls { color: rgb(200,0,0) } }  /* (1,1,1) */
```
```js
-> "rgb(0, 200, 0)"     ← selector yếu nhất thắng selector mạnh nhất
```

Specificity chỉ được xét **trong cùng một layer**.

Hai luật kèm theo:
- CSS **ngoài** mọi layer thắng CSS trong layer → nhét thư viện vào layer, giữ code của bạn ở ngoài:
  `@import url("lib.css") layer(vendor)`
- `!important` **đảo ngược** thứ tự layer (đo được: layer khai trước thắng)

</details>

### 4. `!important` đứng ở đâu trong thứ tự cascade?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó ở bước 1, trên cả `@layer` và inline style. Thứ tự đầy đủ từ yếu tới mạnh: rule
thường trong layer → rule thường ngoài layer → inline style → `!important` trong stylesheet (thứ tự
layer đảo ngược) → inline `!important`.

**Giải thích sâu:** Đo:

```css
p  { color: rgb(255,0,0) !important }
#q { color: rgb(0,255,0) }
```
```html
<p id="q" style="color: rgb(0,0,255)">x</p>
```
```js
-> "rgb(255, 0, 0)"     ← !important thắng inline
```

Nhưng inline cũng dùng được `!important` và khi đó nó thắng.

Lý do `!important` đảo ngược thứ tự layer: nó vốn sinh ra để **user stylesheet** (ví dụ người khiếm thị
đặt cỡ chữ tối thiểu) thắng được tác giả trang. Đảo ngược ở mọi cấp là cách giữ nhất quán tinh thần đó.

</details>

### 5. `:has()` làm được gì mà trước đây phải dùng JavaScript?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Chọn element cha dựa trên con nó chứa. Trước 2023 CSS chỉ đi được từ cha xuống con.

**Giải thích sâu:**

```css
label:has(input:checked) { color: rgb(0,150,0) }
```
```js
{ l1: "rgb(0, 150, 0)",   ← checkbox đã tick
  l2: "rgb(0, 0, 0)" }    ← chưa tick
```

CSS phản ứng với trạng thái form mà **không cần một dòng JS nào**.

Các dạng dùng nhiều:
```css
.field:has(input:invalid) { border-color: red }
html:has(dialog[open]) { overflow: hidden }        /* khoá cuộn khi mở modal */
.card:not(:has(img)) { grid-template-columns: 1fr }
```

Giới hạn: không lồng `:has()` trong `:has()`, không dùng pseudo-element bên trong, và chi phí cao hơn
selector thường trên tập lớn.

Specificity của nó = cái mạnh nhất bên trong, giống `:is()`.

</details>

### 6. CSS nesting khác Sass ở điểm nào cần cẩn thận?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `&` trong CSS gốc biên dịch thành `:is()`, nên khi selector gốc có nhiều thành phần,
specificity nhảy lên bằng cái **mạnh nhất**. Sass thì chỉ nối chuỗi.

**Giải thích sâu:**

```css
#app, .card { & p { color: rgb(255,0,0) } }
.card p     { color: rgb(0,0,255) }
```
```js
-> "rgb(255, 0, 0)"     ← rule lồng thắng
```

`& p` với `&` = `#app, .card` thành `:is(#app, .card) p` → `(1,0,0)` + `(0,0,1)` = **(1,0,1)**, đè
`(0,1,1)`.

Sửa: bọc trong `:where()` → `(0,0,1)`.

Bẫy thứ hai: `:hover` không có `&` là **selector hậu duệ**:

```js
[...cssRules] -> { rule_trong_menu: ["& :hover"] }   ← có DẤU CÁCH
```

`.menu { :hover { } }` = `.menu *:hover`, không phải `.menu:hover`.

</details>

### 7. Thuộc tính nào kế thừa, thuộc tính nào không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Quy luật dễ nhớ: thuộc tính về **chữ** thì kế thừa, về **hộp** thì không.

**Giải thích sâu:** Đo bằng cách đặt hết lên cha, đọc ở con:

```js
{ color: "rgb(0, 100, 0)", fontSize: "20px", lineHeight: "40px",   // ✅
  textAlign: "right", cursor: "pointer", visibility: "hidden",      // ✅
  borderTopWidth: "0px", paddingTop: "0px" }                        // ❌
```

Chú ý `lineHeight: "40px"` — cha khai `line-height: 2` với `font-size: 20px`, con nhận **giá trị đã
tính**. Đây là lý do phải dùng số không đơn vị cho `line-height`.

Kế thừa được cho **mọi** thuộc tính bằng `inherit`:
```css
button { font: inherit; color: inherit }   /* nên có trong reset */
```

</details>

### 8. `unset`, `initial`, `revert` khác nhau thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `initial` về giá trị gốc trong đặc tả. `unset` = `inherit` cho thuộc tính kế thừa,
`initial` cho thuộc tính khác. `revert` bỏ style của bạn, quay về style trình duyệt.

**Giải thích sâu:** Đo với `all`:

```css
p  { color: red; font-size: 40px; margin: 0; display: flex }
#b { all: revert }
```
```js
{ co_revert: { color: "rgb(0, 0, 0)", fontSize: "16px",
               marginTop: "16px", display: "block" } }
```

`all: revert` trả về **đúng style trình duyệt cho `<p>`**. `all: initial` sẽ cho `display: inline` —
giá trị gốc trong đặc tả, không phải giá trị của thẻ `<p>`. Gần như luôn là thứ bạn không muốn.

Còn `revert-layer`: bỏ style của layer hiện tại, quay về layer trước đó.

</details>

### 9. `:nth-child` và `:nth-of-type` khác nhau ra sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `:nth-child` đếm **mọi** anh em, `:nth-of-type` chỉ đếm anh em cùng loại thẻ.

**Giải thích sâu:**

```html
<div><h4>tiêu đề</h4><p id="p1">một</p><p id="p2">hai</p></div>
```
```css
p:nth-child(2) { color: red }
```
```js
{ p1_la_child_thu_2: "rgb(255, 0, 0)" }   ← p ĐẦU TIÊN lại là con thứ 2
```

`<h4>` chiếm mất vị trí 1.

Bản mới `:nth-child(n of .cls)` đếm trong tập đã lọc:

```css
tr:nth-child(odd of :not(.an)) { background: #eee }
```

Đo với 4 dòng, dòng 2 bị ẩn: li1 và li4 được tô — đúng cái mắt người thấy. Dùng `:nth-child(odd)`
thường sẽ tô sai.

</details>

### 10. `@scope` dùng để làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Giới hạn phạm vi style vào một cây con, và cắt được "lỗ" bên trong phạm vi đó.

**Giải thích sâu:**

```css
@scope (.card) to (.slot) { p { color: rgb(0,0,255) } }
```
```js
{ trong: "rgb(0, 0, 255)",     ← trong .card
  trong_slot: "rgb(0, 0, 0)",  ← đã lọt vào .slot, KHÔNG ăn
  ngoai: "rgb(0, 0, 0)" }
```

`to (.slot)` cắt một vùng ra khỏi phạm vi — thứ Sass không làm được. Ứng dụng: style bài viết nhưng
không áp vào phần bình luận lồng bên trong.

Cũng có ích khi bạn nhúng component của bên thứ ba và không muốn style của mình rò vào đó.

</details>

### 11. Vì sao không nên dùng `!important`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì nó không giải quyết vấn đề, chỉ đẩy vấn đề lên tầng tiếp theo. Người sau muốn đè
lại phải dùng `!important` mạnh hơn, thành cuộc chạy đua.

**Giải thích sâu:** Có hai trường hợp `!important` là câu trả lời đúng:

1. **Khối `prefers-reduced-motion`** — phải thắng cả style inline do JS animation đặt, mà `@layer`
   không với tới inline được.
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after { transition-duration: 1ms !important }
   }
   ```
2. **Utility class** ở layer cuối cùng, nơi cả team đồng ý rằng nó phải thắng.

Ngoài hai chỗ đó, thứ bạn cần là `@layer`. Trong dự án landing page ở giáo trình, `!important` chỉ xuất
hiện 5 lần và đều thuộc hai loại trên.

</details>

### 12. Trình duyệt khớp selector theo chiều nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Từ **phải sang trái**. Với `.nav ul li a`, nó tìm mọi `<a>` trước rồi mới đi ngược lên
kiểm tra tổ tiên.

**Giải thích sâu:** Đây là lý do của lời khuyên cũ "đừng viết selector dài". Nhưng lời khuyên đó đã lỗi
thời — trình duyệt hiện đại có nhiều tầng cache và chi phí này nhỏ so với layout.

Những thứ **thực sự** tốn hiệu năng, theo thứ tự:
1. Layout thrashing trong JS (đo được: chậm **108 lần**)
2. Animate `width`/`left` thay vì `transform` (120 lần layout so với 0)
3. Kích thước file CSS
4. Selector — cuối cùng

Ngoại lệ đáng đo: `:has()` trên tập vài nghìn element.

</details>

---

## Phần 2 — Box model và kích thước (câu 13–22)

### 13. `box-sizing: border-box` làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó khiến `width` tính cả padding và border, thay vì chỉ tính vùng nội dung.

**Giải thích sâu:**

```css
.box { width: 200px; padding: 20px; border: 5px solid }
```
```js
{ content_box_offsetWidth: 250,   ← 200 + 40 + 10
  border_box_offsetWidth: 200,    ← đúng 200
  border_box_vung_noi_dung: 150 }
```

Hệ quả quan trọng nhất: `width: 100%` + `padding` sẽ **tràn cha** với `content-box` (đo được: tràn
40px).

Vì thế mọi file CSS nên mở đầu bằng:
```css
*, *::before, *::after { box-sizing: border-box }
```
Phải có cả `::before`/`::after` — dấu `*` không khớp pseudo-element.

</details>

### 14. Margin collapsing là gì, chặn thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Margin dọc của các element trong normal flow dính vào nhau thay vì cộng lại. Chặn tốt
nhất bằng `display: flow-root`.

**Giải thích sâu:** Ba dạng:

1. **Cha–con:** margin của con thoát ra ngoài, đẩy cả cha.
   ```js
   { cha_y: 50, con_y: 50 }   ← cả hai cùng bị đẩy, khoảng cách giữa vẫn 0
   ```
2. **Anh em:** `30px + 20px = 30px` (lấy max)
3. **Có âm:** `-30px + 20px = -10px`

Bốn cách chặn dạng 1, đo trên cha rỗng có con `margin-top: 50px; height: 10px`:
```js
{ none: 10, pad: 61, bor: 61, ovf: 60, flo: 60 }
```

| Cách | Tác dụng phụ |
|---|---|
| `padding-top: 1px` | lệch 1px |
| `border-top: 1px` | lệch 1px + có thể thấy |
| `overflow: hidden` | **cắt tooltip, phá `sticky`** |
| `display: flow-root` | **không có** ← dùng cái này |

Cách né sạch nhất: dùng `gap` của flex/grid, chúng không có margin collapsing.

</details>

### 15. `padding: 10%` tính theo cái gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Luôn theo **chiều rộng** của cha, kể cả `padding-top` và `padding-bottom`.

**Giải thích sâu:**

```css
#p { width: 400px; height: 100px }
#c { padding-top: 10% }
```
```js
{ paddingTop: "40px" }   ← 10% của 400, không phải của 100
```

Đây là nền tảng của mẹo cũ `padding-top: 56.25%` để làm khung 16:9. Giờ đã có `aspect-ratio` nên đừng
dùng mẹo đó nữa.

`margin` cũng vậy. `height: 50%` thì khác — nó theo chiều cao cha, và **im lặng không hoạt động** nếu
cha cao `auto`.

</details>

### 16. Vì sao `height: 100%` hay không hoạt động?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì cha cao `auto`. Cha cao theo nội dung, nội dung lại muốn cao theo cha — vòng lặp,
nên trình duyệt bỏ qua.

**Giải thích sâu:**

```js
{ cha_auto_con_cao: 18,       ← chỉ bằng chiều cao dòng chữ
  cha_200_con_cao: 200,
  computed_height_khi_cha_auto: "18px" }
```

Không có cảnh báo, không có lỗi trong console.

Ba cách sửa, tốt dần:
```css
html, body { height: 100% }                    /* phải khai từ gốc xuống */
.full { height: 100dvh }                       /* đơn giản, nhưng cắt cụt nếu nội dung dài */
body { display: grid; min-height: 100dvh }     /* ✅ nội dung dài hơn vẫn đúng */
```

</details>

### 17. `min-content`, `max-content`, `fit-content` là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `min-content` = bề rộng từ dài nhất. `max-content` = cả nội dung trên một dòng.
`fit-content` = `min(max-content, chỗ có sẵn)`.

**Giải thích sâu:** Đo với một câu tiếng Việt trong cha 400px:

```js
{ mn: 41.14,     ← từ dài nhất
  mx: 276.25,    ← cả câu một dòng
  ft: 276.25 }   ← = max-content vì vẫn lọt trong 400px
```

`fit-content` dùng cho nút, badge, tag — rộng vừa nội dung nhưng không tràn.

`min-content` ít dùng trực tiếp nhưng **rất quan trọng để hiểu**: nó chính là giá trị mặc định của
`min-width` cho flex/grid item, và là gốc rễ của bẫy tràn ở câu 19.

</details>

### 18. `aspect-ratio` hoạt động thế nào khi có cả `height`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `height` tường minh **thắng** `aspect-ratio`.

**Giải thích sâu:**

```js
{ chi_width:       { w: 200, h: 112.5 },   ← 200 × 9/16
  width_va_height: { w: 200, h: 50    },   ← aspect-ratio bị bỏ qua
  khong_width:     { w: 784, h: 784   } }  ← lấp đầy cha rồi mới tính cao
```

Công dụng chính là chặn CLS:
```js
{ khong_khai_bao: { cao: 100 },     ← chỉ biết sau khi ảnh tải
  co_aspect_ratio: { cao: 150 } }   ← giữ chỗ ngay từ đầu
```

Ảnh chưa tải thì hộp cao 0 → nội dung bên dưới nhảy khi ảnh về.

Chú ý: nội dung dài hơn khung sẽ **tràn ra**, không làm hộp cao thêm. Muốn giãn thì dùng `min-height`.

</details>

### 19. Vì sao flex item không co được, làm tràn cả hàng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì `min-width` mặc định của flex/grid item là `auto` — nghĩa là "không được nhỏ hơn
nội dung tối thiểu của tôi".

**Giải thích sâu:**

```js
{ mac_dinh:        { a_rong: 296.6, a_min_width_computed: "auto", tran: true },
  min_width_0:     { a_rong: 190, tran: true },
  overflow_hidden: { a_rong: 190, tran: false } }
```

Ô rộng 296px trong container 250px, dù đã khai `flex: 1`.

Ba cách sửa, theo thứ tự nên dùng:
```css
.a { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }  /* tốt nhất */
.a { flex: 1; min-width: 0 }
.a { flex: 1; min-width: 0; overflow-wrap: break-word }
```

`overflow` khác `visible` **tự đặt min-size về 0** — nên cách 1 không cần `min-width: 0`.

Bản dọc của cùng bẫy này là bug "vùng nội dung không cuộn được": `.mid { flex: 1 }` cao 600px trong
container 200px. Thêm `overflow: auto` là xong.

</details>

### 20. Đơn vị nào cho cái gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `rem` cho cỡ chữ và khoảng cách bố cục, `em` cho padding bên trong component, `px`
cho viền và bo góc, `ch` cho bề rộng đoạn văn, `dvh` cho chiều cao màn hình.

**Giải thích sâu:** `em` nhân dồn, `rem` thì không:
```js
{ em_tang3: "54px",     ← 16 × 1.5³
  rem_tang3: "24px" }   ← 16 × 1.5
```

`em` trong thuộc tính khác tính theo font-size **của chính element**:
```js
{ fontSize: "20px",    ← 2em theo CHA (10px)
  padding: "20px" }    ← 1em theo CHÍNH NÓ (20px)
```

Đây là hành vi hữu ích: `padding: .75em` cho nút thì padding tự co theo cỡ chữ nút.

⚠️ Đừng đặt `html { font-size: 62.5% }` để "1rem = 10px" — nó ghi đè cỡ chữ người dùng cố ý đặt lớn.

`vh` vs `dvh`: trên mobile, `100vh` luôn cao hơn phần nhìn thấy khi thanh địa chỉ đang hiện → nút ở cuối
hero bị che.

</details>

### 21. Thanh cuộn chiếm bao nhiêu chỗ?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trên macOS mặc định là **0px** (thanh cuộn nổi đè lên nội dung). Trên Windows/Linux là
15–17px.

**Giải thích sâu:**
```js
{ mac_overlay_mac_dinh: { scrollbar_chiem: 0 },
  gutter_stable:        { clientWidth: 185, scrollbar_chiem: 15 } }
```

Đây là gốc của bug "trang giật ngang khi mở modal": bạn đặt `overflow: hidden` lên `body`, thanh cuộn
biến mất, 15px được trả lại, nội dung nhảy sang phải.

Sửa: `html { scrollbar-gutter: stable }` — giữ chỗ sẵn kể cả khi chưa có thanh cuộn.

</details>

### 22. `box-shadow`, `outline`, `border` — cái nào chiếm chỗ?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Chỉ `border` chiếm chỗ trong layout.

**Giải thích sâu:**
```js
{ shadow:  { w: 50, h: 50 },   ← không chiếm
  outline: { w: 50, h: 50 },   ← không chiếm
  border:  { w: 90, h: 90 } }  ← chiếm 20px mỗi bên
```

Đây là lý do `outline` là thứ đúng cho viền focus: thêm viền không làm layout nhảy. Và vì sao có
`outline-offset` — đẩy viền ra xa mà không ảnh hưởng gì.

```css
:focus-visible { outline: 2px solid; outline-offset: 3px }
```

</details>

---

## Phần 3 — Flexbox và Grid (câu 23–34)

### 23. `flex: 1` khác `flex: auto` chỗ nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `flex: 1` = `1 1 0%` — chia đều, bỏ qua nội dung. `flex: auto` = `1 1 auto` — lấy
nội dung làm điểm xuất phát rồi mới chia phần thừa.

**Giải thích sâu:** Ba ô nội dung dài ngắn khác nhau, container 600px:

```js
{ 'flex:1':    [200, 200, 200],            ← bằng nhau tuyệt đối
  'flex:auto': [141.05, 325.89, 133.06] }  ← ô nào nhiều chữ thì rộng hơn
```

Chọn `flex: 1` cho thanh nav hay lưới nút (muốn bằng nhau), `flex: auto` cho thanh công cụ (muốn theo
nội dung).

Cần biết: `flex-basis` **thắng** `width`. Khi thấy `width` bị phớt lờ trong flex container, tìm
`flex-basis` — nó thường ẩn trong shorthand `flex: 1`.

</details>

### 24. `flex-grow: 3` có nghĩa item đó rộng gấp 3 không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không. Nó chia **phần còn thừa** theo tỉ lệ 3, không chia tổng bề rộng.

**Giải thích sâu:**

```
container 500, basis 100 mỗi ô, thừa 300, grow 1 vs 3
a = 100 + 300×(1/4) = 175
b = 100 + 300×(3/4) = 325
tỉ lệ bề rộng cuối = 1.86, KHÔNG phải 3
```

Muốn tỉ lệ đúng 1:3 thì phải cho `flex-basis: 0` (hoặc dùng `flex: 1` và `flex: 3`).

Trường hợp biên: tổng `flex-grow` **nhỏ hơn 1** thì không lấp hết container.
```js
{ tong_grow_0_5: [100, 100] }   ← container 400, chỉ lấp 200
```

</details>

### 25. `flex-shrink` chia thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Theo **`shrink × basis`**, không chia đều. Ô lớn hơn co nhiều hơn.

**Giải thích sâu:**

```
basis 400 và 200, container 300, cần co 300
a co 300×(400/600) = 200 -> còn 200
b co 300×(200/600) = 100 -> còn 100
```

Hợp lý: co 200px của ô 400px (50%) tương đương co 100px của ô 200px (50%).

Đây là lý do `flex-shrink: 0` (hay `flex: none`) là thứ bạn cần cho ô không được phép co, ví dụ avatar
hay icon.

</details>

### 26. `gap` được tính vào đâu trong phép chia?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bị trừ ra **trước**, rồi mới chia phần còn lại.

**Giải thích sâu:**
```js
{ container: 300, gap_tong: 40, moi_o: [86.66, 86.67, 86.67], tong_o: 260 }
```

Nghe hiển nhiên, nhưng nó là gốc của bug lưới phần trăm:
```js
{ basis_33pc: { rong: [99.98 ×3], so_dong: 2 },   ← 3 ô + gap không vừa 1 dòng
  basis_calc: { rong: [93.33 ×3], so_dong: 1 } }
```

Phải viết `flex: 0 0 calc(33.333% - 6.667px)` — rất dễ tính sai.

**Đây chính là lúc nên chuyển sang Grid**: `grid-template-columns: repeat(3, 1fr)` tự trừ gap.

</details>

### 27. Khi nào Flexbox, khi nào Grid?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Flex cho bố cục một chiều, kích thước do nội dung quyết định. Grid cho hai chiều, khi
cần các item thẳng hàng cả ngang lẫn dọc.

**Giải thích sâu:** Cùng layout 3 cột cho kết quả y hệt `[200, 230, 150]`, nhưng grid cần **1 dòng**
CSS còn flex cần **4 dòng**.

| Flex | Grid |
|---|---|
| một hàng hoặc một cột | hàng và cột cùng lúc |
| số item không biết trước | item phải thẳng cột với nhau |
| kích thước theo **nội dung** | kích thước theo **khung** |
| navbar, chip, nhóm nút | lưới card, layout trang, bảng giá |

Quy tắc thực dụng: **phải viết `calc()` để trừ gap → chuyển sang Grid.**

</details>

### 28. `1fr` nghĩa là gì? Vì sao `1fr 1fr` đôi khi không bằng nhau?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `1fr` là một phần của **không gian còn thừa**. Nó thật ra là `minmax(auto, 1fr)` —
cái `auto` ở vế min khiến track không co nhỏ hơn nội dung.

**Giải thích sâu:**

```js
{ '1fr_1fr':       { track: "355.5px 44.5px" },   ← lệch hẳn
  'minmax(0,1fr)': { track: "200px 200px"    } }
```

Chuỗi 42 ký tự không ngắt được ép track thứ nhất phình ra.

**Quy tắc:** cột chứa nội dung động (tên người dùng, tiêu đề, dữ liệu API) thì luôn viết
`minmax(0, 1fr)`.

Triệu chứng của bẫy này khác với bẫy flexbox: không phải "tràn" mà là "hai cột lệch nhau" — khó nhận ra
hơn.

</details>

### 29. `auto-fit` và `auto-fill` khác nhau thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi số item **ít hơn** số cột vừa được: `auto-fit` thu các track rỗng về 0 (item giãn
lấp đầy), `auto-fill` giữ nguyên track rỗng.

**Giải thích sâu:** Container 700px, `minmax(200px, 1fr)`, 2 item:

```js
{ auto_fit:  { track: "345px 345px 0px",     o: [345, 345] },
  auto_fill: { track: "226.66px ×3",         o: [226.66, 226.67] } }
```

`auto-fit` cho lưới card. `auto-fill` cho lịch, bàn phím, ô nhập OTP — nơi cần giữ nhịp cột.

</details>

### 30. Vì sao `repeat(auto-fit, minmax(250px, 1fr))` vẫn tràn trên màn nhỏ?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì `minmax` đảm bảo tối thiểu 250px kể cả khi container chỉ có 150px.

**Giải thích sâu:**
```js
{ w1: { container: 150, track: "200px", tran: true } }
```

Sửa bằng `min()`:
```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
```
```js
{ w1: { container: 150, track: "150px", tran: false } }
```

`min(100%, 250px)` = "250px, nhưng không bao giờ vượt quá container".

Đây là dòng CSS đáng nhớ nhất về lưới responsive: một dòng lo trọn, **không cần media query nào**. Đo
trên dự án: số cột tự đổi 1 → 2 → 3 từ 320px tới 1920px.

</details>

### 31. `subgrid` giải quyết vấn đề gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cho các phần bên trong nhiều card thẳng hàng với nhau, dù nội dung dài ngắn khác nhau.

**Giải thích sâu:** 3 card có tiêu đề / mô tả / chân:

```js
{ grid_thuong: { y_cua_p: [22, 44, 22] },     ← LỆCH 22px
  subgrid:     { y_cua_p: [54, 54, 54] } }    ← thẳng hàng
```

Cách hoạt động: card khai `grid-template-rows: subgrid` để dùng luôn các hàng của ông nội thay vì tạo
lưới riêng. Muốn vậy card phải chiếm đúng số hàng đó:

```css
.wrap { display: grid; grid-template-rows: auto 1fr auto }
.card { grid-row: span 3; grid-template-rows: subgrid }
```

Không có subgrid thì chỉ làm được phần **chân** thẳng hàng (bằng `grid-template-rows: auto 1fr auto` +
`align-items: stretch`), phần giữa vẫn lệch.

</details>

### 32. `grid-column: 1 / -1` nghĩa là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trải từ đường đầu tiên tới đường cuối cùng — tức hết chiều ngang, **không cần biết có
bao nhiêu cột**.

**Giải thích sâu:** Grid đánh số đường kẻ, không đánh số ô. Lưới 4 cột có 5 đường. Số âm đếm ngược:
`-1` là đường cuối, `-2` là áp chót.

```js
{ a: { x: 0, y: 0, w: 200 },     ← grid-column: 1 / -1, trải hết
  c: { x: 150, y: 30, w: 50 } }  ← grid-column: -2 / -1, cột cuối
```

Đặc biệt hữu dụng với `repeat(auto-fit, ...)`: số cột thay đổi theo bề rộng, nhưng `1 / -1` luôn đúng.

</details>

### 33. `align-items` mặc định là gì trong flex?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `stretch` — mọi item cao bằng item cao nhất.

**Giải thích sâu:**
```js
{ stretch:    [54, 54, 54],
  flex_start: [18, 54, 37] }
```

Đây là lý do các card trong một hàng tự động cao bằng nhau mà không cần làm gì. Nếu thấy card cao bằng
nhau "một cách khó hiểu", đó là `stretch`.

Cần phân biệt 4 thuộc tính:
```
             trục chính        trục phụ
trên cha     justify-content   align-items
trên con     —                 align-self
nhiều dòng   —                 align-content (CẦN flex-wrap)
```

Tin mới trên Chrome 152: `align-content: center` giờ hoạt động cả trên `display: block`.

</details>

### 34. Mẹo `margin: auto` trong flexbox?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `margin: auto` nuốt hết không gian thừa về phía nó — cách gọn nhất để đẩy một item về
một đầu.

**Giải thích sâu:**
```js
{ x_cua_item_cuoi: 330.23, phai_cua_item_cuoi: 400 }   ← dính sát mép phải
```

Dùng cho navbar "logo trái, nút phải" mà không cần `justify-content: space-between` (vốn sẽ dàn đều cả
3 nhóm):

```css
.nav nav { margin-inline-start: auto }
```

Bản dọc rất hữu dụng cho card có nút luôn ở đáy:
```css
.card { display: flex; flex-direction: column }
.card .btn { margin-top: auto }
```

⚠️ Đừng nhầm với `align-self: flex-end` — trong `flex-direction: column`, trục phụ là **ngang**, nên nó
đẩy sang phải chứ không xuống đáy (đo được: `x_trong_card: 161.2`, vẫn cách đáy 230px).

</details>

---

## Phần 4 — Position và stacking (câu 35–42)

### 35. `position: absolute` neo vào đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vào tổ tiên **đã định vị** gần nhất — tức có `position` khác `static`. Không có ai thì
neo vào initial containing block.

**Giải thích sâu:**
```js
{ cha_khong_relative: { dot: 51, out: 50 },   ← bỏ qua tầng giữa
  cha_co_relative:    { dot: 72, mid: 71 } }  ← neo vào tầng giữa
```

Quy tắc: mỗi khi viết `position: absolute`, tự hỏi "cái `relative` của nó ở đâu?". Không trả lời được
ngay thì bug sắp tới.

</details>

### 36. Vì sao `position: fixed` đôi khi không neo vào viewport?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì một tổ tiên có `transform`, `filter`, `will-change`, `contain`, `perspective`, hoặc
`backdrop-filter` — những thứ này tạo containing block mới.

**Giải thích sâu:**
```js
{ khong_gi:      { y: 0 },                 ← đúng, neo viewport
  transform:     { y: 303, cha_y: 302 },   ← neo vào CHA
  filter:        { y: 505, cha_y: 504 },
  will_change:   { y: 707, cha_y: 706 },
  contain_paint: { y: 909, cha_y: 908 } }
```

Đây là bug kinh điển: modal đột nhiên nằm sai chỗ sau khi thêm hiệu ứng hover `transform: scale(1.02)`
cho card cha.

Cách xử lý tốt nhất: dùng thẻ `<dialog>` + `showModal()` — nó nằm ở **top layer**, không tổ tiên nào
bắt được. Hoặc portal/`<Teleport>` để đưa ra khỏi cây DOM đó.

</details>

### 37. Vì sao `z-index: 9999` vẫn bị che? *(câu hỏi hay gặp nhất)*

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì một tổ tiên đã tạo **stacking context**. `z-index` của con chỉ so với anh em trong
cùng thế giới đó, không bao giờ so với element bên ngoài. Cha thua thì cả nhánh thua theo.

**Giải thích sâu:**
```js
{ opacity_computed: "0.99",
  khong_opacity_diem_giao: "c1",   ← con z-index:9999 nằm trên
  co_opacity_diem_giao: "ov2" }    ← .over z-index:1 nằm trên con z-index:9999
```

Chỉ cần `opacity: 0.99` — mắt không phân biệt được — là đảo ngược hoàn toàn thứ tự lớp.

Bảng đầy đủ (đo từng cái):
```
CÓ tạo:    opacity<1 · transform · filter · will-change · isolation
           contain:paint · mix-blend-mode · backdrop-filter · perspective
           position:fixed · content-visibility:auto · view-transition-name
KHÔNG:     container-type
```

Cách debug: đi ngược cây DOM, ở mỗi tổ tiên kiểm tra `opacity`, `transform`, `filter`, `will-change`.

</details>

### 38. `isolation: isolate` dùng để làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tạo stacking context một cách **cố ý**, không kèm tác dụng phụ nào về hình ảnh hay
hiệu năng.

**Giải thích sâu:**
```js
{ truoc_khi_isolate: "a", sau_khi_isolate: "b" }
```

Dùng để "nhốt" z-index của một component, đảm bảo nó không bao giờ đè lên phần còn lại của trang:

```css
.component { isolation: isolate }
```

Khác với `opacity: .99` hay `transform: translateZ(0)` — hai cách "vô tình" thường thấy —
`isolation` không đổi hình và không tạo layer GPU.

</details>

### 39. `z-index` có luôn cần `position` không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Có, trừ một ngoại lệ: **flex item và grid item** dùng được `z-index` dù vẫn là
`static`.

**Giải thích sâu:**
```js
// element thường
{ computed_z_index_cua_a: "99", position_cua_a: "static",
  element_o_tren: "b" }      ← z-index vô nghĩa

// flex item
{ position_cua_x: "static", z_index_cua_x: "99",
  element_o_tren: "x" }      ← ăn
```

Chú ý: `getComputedStyle` **vẫn báo 99** trong cả hai trường hợp. Computed value không cho biết thuộc
tính có tác dụng hay không — phải đo bằng `elementFromPoint`.

</details>

### 40. `position: sticky` cần những điều kiện gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ba điều kiện: (1) khai ít nhất một trong `top`/`right`/`bottom`/`left`, (2) không tổ
tiên nào có `overflow` khác `visible`, (3) cha phải cao hơn element.

**Giải thích sâu:**
```js
{ ok:    { y_sau_khi_cuon_100px:   1, con_dinh: true  },
  bad:   { y_sau_khi_cuon_100px: -99, con_dinh: false },  ← tổ tiên overflow:hidden
  nothr: { y_sau_khi_cuon_100px: -99, con_dinh: false } } ← thiếu top
```

Cả ba trường hợp hỏng đều **im lặng** — không lỗi, không cảnh báo.

Điều kiện 2 giải thích vì sao "sticky chạy trên CodePen nhưng không chạy trong dự án": dự án có một
`overflow: hidden` ở tầng trên, thường được thêm vào để chặn margin collapsing. Đây là lý do nên dùng
`display: flow-root` thay thế.

Chrome giúp: badge `sticky` trong tab Elements, bấm vào sẽ chỉ ra tổ tiên nào phá.

</details>

### 41. Có mấy cách căn giữa tuyệt đối? Cách nào tốt nhất?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ba cách, cho kết quả y hệt. `display: grid; place-items: center` là tốt nhất vì ngắn
nhất và không tạo stacking context.

**Giải thích sâu:**
```js
{ m: { le_trai: 101, le_tren: 76 },   /* inset: 0; margin: auto */
  t: { le_trai: 101, le_tren: 76 },   /* top/left 50% + translate(-50%,-50%) */
  g: { le_trai: 101, le_tren: 76 } }  /* grid place-items: center */
```

| Cách | Nhược điểm |
|---|---|
| `inset: 0; margin: auto` | phải biết trước width/height |
| `translate(-50%,-50%)` | **tạo stacking context**; chữ mờ ở số lẻ |
| `place-items: center` | phải bỏ `position: absolute` |

</details>

### 42. `relative` có chiếm chỗ không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Có — nó vẫn giữ nguyên chỗ cũ, chỉ vẽ ở vị trí mới.

**Giải thích sâu:** Dịch một element `relative` đi 100px thì chỗ trống 100px vẫn nằm nguyên đó, các
element khác không dồn vào.

| | Chiếm chỗ | Neo vào |
|---|---|---|
| `relative` | ✅ chỗ cũ | chính nó |
| `absolute` | ❌ | tổ tiên đã định vị |
| `fixed` | ❌ | viewport (trừ khi bị bắt) |
| `sticky` | ✅ | tổ tiên cuộn |

Muốn dịch mà không chiếm chỗ: dùng `absolute` hoặc `translate` (và `translate` rẻ hơn nhiều về hiệu
năng — 0 lần layout).

</details>

---

## Phần 5 — Responsive và biến (câu 43–52)

### 43. Container query khác media query thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Media query hỏi "cửa sổ rộng bao nhiêu", container query hỏi "chỗ tôi đang đứng rộng
bao nhiêu". Câu thứ hai mới là câu component thực sự cần.

**Giải thích sâu:**
```js
{ hep_300:  { container_rong: 300, flexDirection: "column" },
  rong_600: { container_rong: 600, flexDirection: "row"    },
  viewport: 900 }                       ← cửa sổ GIỐNG NHAU ở cả hai
```

Cùng viewport, cùng class, hai layout khác nhau.

Media query không làm được: bạn phải viết `.sidebar .card { flex-direction: column }` — tức component
phải biết về chỗ nó được đặt vào, đúng thứ khiến CSS khó bảo trì.

</details>

### 44. Ba cái bẫy của container query là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** (1) Không style được chính element khai `container-type`; (2) `inline-size` không
query được chiều cao; (3) ngưỡng phải khớp kích thước thật của container.

**Giải thích sâu:**

**Bẫy 1** — quan trọng nhất:
```js
{ background_cua_chinh_no: "rgb(238, 238, 238)",   ← KHÔNG đổi
  background_cua_con: "rgb(0, 255, 0)" }           ← đổi
```
Nếu cho phép sẽ có vòng lặp vô tận. Sửa bằng cách tách hai tầng: wrapper giữ `container-type`, con nhận
style.

**Bẫy 2:**
```js
{ inline_size: "rgb(0, 0, 0)", size: "rgb(0, 150, 0)" }
```
`container-type: size` query được chiều cao nhưng container phải có chiều cao xác định — dễ làm sập
layout.

**Bẫy 3:** đo trước rồi mới chọn ngưỡng.
```js
document.querySelector('.card').getBoundingClientRect().width -> 364
```

</details>

### 45. Viết công thức `clamp()` cho font thế nào cho đúng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Phần giữa **phải chứa `rem`**. Công thức thuần `vw` không phóng to được khi người
dùng tăng cỡ chữ trong trình duyệt.

**Giải thích sâu:**
```css
font-size: clamp(1.5rem, 1rem + 3vw, 3rem);   ✅
font-size: clamp(24px, 5vw, 48px);            ❌
```

`vw` chỉ phụ thuộc bề rộng cửa sổ. Người dùng đặt cỡ chữ mặc định 24px hay bấm Ctrl+ thì `vw` **không
đổi** — chữ vẫn nguyên.

Cách tự tính cho A px @ V1 → B px @ V2:
```
độ dốc = (B−A)/(V2−V1)          gốc = A − độ dốc × V1
clamp(Apx, (gốc/16)rem + (độ dốc×100)vw, Bpx)
```

Ví dụ 32px@320 → 52px@1280 cho `clamp(32px, 1.583rem + 2.083vw, 52px)`. Kiểm chứng:
```
320px -> 32px    800px -> 41.99px    1280px -> 51.99px
```

</details>

### 46. Vì sao nên dùng cú pháp `(width >= 600px)` thay `min-width`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì nó xoá được lỗi biên. Với `min-width: 600px` và `max-width: 600px`, **cả hai cùng
khớp** ở đúng 600px.

**Giải thích sâu:**
```
viewport 599px: min-width:600 = —     width>=600 = —     width<600 = KHỚP
viewport 600px: min-width:600 = KHỚP  width>=600 = KHỚP  width<600 = —
```

Người ta phải viết `max-width: 599.98px` để né. Với `(width < 600px)` thì không có chuyện đó.

Cú pháp mới cũng viết được khoảng trong một dòng: `(600px <= width <= 900px)`.

Quan trọng hơn: **chọn một chiều rồi giữ nguyên** cả dự án. Mobile-first (`width >= ...`) tốt hơn vì
CSS mặc định là bản đơn giản nhất.

</details>

### 47. Biến CSS khác biến Sass thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Biến CSS là thuộc tính thật: có kế thừa, có cascade, đổi được lúc chạy, đọc được từ
JS. Biến Sass bị thay thế lúc biên dịch, không tồn tại trong trình duyệt.

**Giải thích sâu:**
```js
{ trong_card: "16px", sau_3_tang: "16px", ngoai_card: "4px" }
```

Kế thừa là toàn bộ sức mạnh của nó — đổi một biến ở một chỗ, cả nhánh cây đổi theo. Đây là nền tảng của
mọi cơ chế theme:

```css
:root  { --bg: white; --fg: black }
.dark  { --bg: black; --fg: white }
.panel { background: var(--bg); color: var(--fg) }
```

Class `.panel` **không biết** có theme tối tồn tại. Nó chỉ đọc biến. Sass không làm được điều này.

</details>

### 48. Chuyện gì xảy ra khi `var()` trỏ vào biến sai kiểu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Thuộc tính rơi về **`unset`**, **không** quay về giá trị khai trước đó. Kế thừa thì
lấy của cha, không kế thừa thì về `initial`.

**Giải thích sâu:**
```js
{ khong_fallback:       "rgb(0, 0, 0)",       ← KHÔNG về xanh lá
  sai_kieu_thua_tu_cha: "rgb(255, 0, 255)",   ← lấy màu CHA
  width_sai_kieu:       "784px" }             ← width về auto
```

Với CSS thường, giá trị sai bị bỏ qua và giữ giá trị trước. Nhưng `var()` được xử lý **muộn hơn**, sau
khi cascade chọn xong — lúc phát hiện sai thì không còn gì để quay về. Thuật ngữ chính thức:
"invalid at computed-value time".

Phòng: luôn cho fallback `var(--x, #333)`, hoặc khai `@property` với `initial-value`.

</details>

### 49. `@property` dùng để làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hai việc: cho phép **animate** biến CSS, và **chặn giá trị sai kiểu** ngay tại biến.

**Giải thích sâu:** Không có `@property`, biến CSS chỉ là chuỗi ký tự với trình duyệt — nó không biết
"0px" và "200px" là hai số để nội suy:

```js
{ o_giua_animation: { co_property: 91.7,      ← đang nội suy
                      khong_property: 200 } } ← nhảy thẳng
```

Chặn kiểu sai:
```js
{ dung_kieu: "30px", sai_kieu_ve_initial_value: "5px" }
```
Giá trị sai bị chặn tại biến, rơi về `initial-value` — không lây sang thuộc tính như câu 48.

Ứng dụng đắt giá: animate gradient (vốn không animate được):
```css
@property --goc { syntax: '<angle>'; inherits: false; initial-value: 0deg }
.the { background: linear-gradient(var(--goc), blue, purple); transition: --goc 600ms }
```

</details>

### 50. Vì sao dùng `oklch` thay `hsl`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì `hsl` có cùng `L` nhưng các màu trông sáng tối khác nhau. `oklch` xây trên mô hình
cảm nhận của mắt người nên `L` giống nhau thì trông cũng sáng như nhau.

**Giải thích sâu:** `hsl(60 100% 50%)` (vàng) chói hơn hẳn `hsl(240 100% 50%)` (xanh dương) dù cùng
`L: 50%`.

Với `oklch`, làm bảng màu chỉ là đổi chữ `L`:
```css
--nhan-100: oklch(0.95 0.05 258);
--nhan-500: oklch(0.55 0.19 258);
--nhan-900: oklch(0.25 0.12 258);
```

Ba màu này trông cùng độ tương phản với nhau — điều `hsl` không cho được.

Trình duyệt **giữ nguyên** `oklch` trong computed value (không đổi về `rgb`) vì màn hình hiện đại hiển
thị được dải màu rộng hơn sRGB.

Đi kèm: `color-mix(in oklch, var(--nhan) 12%, transparent)` để tạo màu nhạt vẫn theo theme, và
`oklch(from var(--nhan) l c calc(h + 180))` để lấy màu đối lập.

</details>

### 51. Làm dark mode thế nào cho gọn?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `color-scheme: light dark` + `light-dark()`. Mỗi màu khai một dòng thay vì hai bảng
màu riêng.

**Giải thích sâu:**
```css
:root {
  color-scheme: light dark;
  --nen: light-dark(oklch(0.99 0.005 250), oklch(0.19 0.02 255));
}
```

⚠️ **Bẫy quan trọng:** `light-dark()` chỉ đọc `color-scheme`, **không đọc** class hay `data-*`. Nút đổi
nền đặt `data-theme="dark"` sẽ không có tác dụng gì:

```
sau khi bấm nút: theme=dark   nền oklch(0.99 0.005 250)   ← KHÔNG ĐỔI
```

Phải thêm cầu nối:
```css
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

Lợi ích phụ của `color-scheme`: trình duyệt tự đổi màu form control, thanh cuộn, checkbox.
```js
{ dark_input: { bg: "rgb(59, 59, 59)", color: "rgb(255, 255, 255)" } }
```
Nên khai `color-scheme` kể cả khi không làm dark mode — nếu không, `<input>` sẽ trắng toát trên nền tối.

</details>

### 52. `prefers-reduced-motion` là gì, xử lý thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Media query cho biết người dùng đã tắt hiệu ứng trong cài đặt hệ thống. Với người bị
rối loạn tiền đình, animation trượt/phóng có thể gây chóng mặt và buồn nôn thật sự.

**Giải thích sâu:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after, *::details-content, *::backdrop {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

Hai chi tiết dễ sai:

1. **Dùng `1ms` chứ không `0s`.** Với `0s`, sự kiện `transitionend`/`animationend` **không bao giờ
   bắn** — JS chờ chúng sẽ treo vĩnh viễn.
2. **Dấu `*` không phủ pseudo-element.** Đo thật: accordion vẫn animate (101px ở mốc 100ms thay vì
   109px) vì hiệu ứng nằm trên `::details-content`. Phải liệt kê từng cái.

</details>

---

## Phần 6 — Animation và hiệu năng (câu 53–60)

### 53. Thuộc tính nào animate rẻ, thuộc tính nào đắt? Vì sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `transform` và `opacity` rẻ vì chúng chỉ chạy ở bước **composite**, không chạm layout
hay style. `width`, `left`, `margin` buộc tính lại layout mỗi frame.

**Giải thích sâu:** Đo bằng CDP, animate 200 element trong 2 giây:

```
thuộc tính   LayoutCount  RecalcStyleCount  LayoutDuration
left               120          120            20.1 ms
width              120          120            79.9 ms
transform            0            0             0 ms
opacity              0            0             0 ms
```

120 = số frame trong 2 giây ở 60fps, tức **mỗi frame một lần layout**.

`width` đắt hơn `left` gần 4 lần vì đổi bề rộng buộc chữ xếp lại dòng.

Đường ống: Style → Layout → Paint → Composite. Đổi thứ càng bên trái càng đắt vì mọi bước sau phải chạy
lại.

</details>

### 54. Layout thrashing là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đọc thuộc tính hình học xen kẽ với ghi style trong một vòng lặp, buộc trình duyệt tính
lại layout mỗi lần đọc. Đây là lỗi hiệu năng đắt nhất, và nó nằm ở JS chứ không phải CSS.

**Giải thích sâu:** Đo trên 400 element:
```js
{ xen_ke_doc_ghi_ms: 32.5, doc_het_roi_ghi_het_ms: 0.3,
  cham_hon_bao_nhieu_lan: 108.3 }
```

**108 lần.** Không có tối ưu CSS nào cho lại con số đó.

Bình thường trình duyệt gom thay đổi rồi tính layout một lần. Nhưng khi bạn đọc `offsetHeight`, nó
**buộc phải** tính ngay để trả lời chính xác.

Danh sách thuộc tính buộc layout khi đọc: `offsetTop/Left/Width/Height`,
`scrollTop/Left/Width/Height`, `clientTop/Left/Width/Height`, `getBoundingClientRect()`,
`getComputedStyle()`, `focus()`.

Sửa: đọc hết vào mảng trước, rồi ghi hết sau.

Trong DevTools tab Performance, nó hiện ra là cảnh báo **"Forced reflow"** với tam giác đỏ.

</details>

### 55. `content-visibility: auto` làm gì? Cái giá là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bỏ qua việc render phần chưa cuộn tới. Cái giá: chiều cao chỉ là **ước lượng** cho tới
khi cuộn tới, nên trang có thể giật.

**Giải thích sâu:** Đo trên 4000 element:
```js
{ khong_content_visibility: 21.7 ms, co_content_visibility: 6.1 ms }   ← nhanh 3.6 lần
```

Nhưng trên trang thật:
```js
{ cao_khi_chua_cuon_toi: 624, cao_sau_khi_cuon_toi: 500 }   ← giật 124px
```

Vì thế tôi **bỏ** nó khỏi dự án landing page 3 khối — tiết kiệm vài mili giây không đáng.

Tin tốt: nội dung vẫn ở trong DOM, Ctrl+F vẫn tìm được, trình đọc màn hình vẫn đọc, Google vẫn index.
Khác hẳn `display: none`.

Dùng khi: danh sách hàng nghìn dòng, trang tin dài. Không dùng khi: trang có vài khối.

</details>

### 56. `will-change` nên dùng thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trong hầu hết trường hợp: **đừng dùng**. Nếu dùng thì bật ngay trước khi animate, tắt
ngay sau.

**Giải thích sâu:** Ba tác dụng phụ, xảy ra **ngay lập tức** kể cả khi không có animation nào chạy:

1. **Tốn bộ nhớ GPU** — mỗi layer là một texture. 300 item danh sách với `will-change` là cách nhanh
   nhất làm treo máy yếu.
2. **Tạo stacking context** — phá vỡ z-index của cả nhánh.
3. **Tạo containing block** — `position: fixed` của con neo sai chỗ.

```js
{ a_will_change: "transform", a_co_tao_stacking_context: true }
```

Chrome đã tự tối ưu tốt cho `transform`/`opacity`. Chỉ thêm `will-change` khi bạn **đã đo được** vấn đề
và **đo lại được** cải thiện.

Điều tương tự với mẹo cũ `transform: translateZ(0)`.

</details>

### 57. Làm sao animate `height: auto`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `interpolate-size: allow-keywords` trên `:root`. Đừng dùng mẹo `max-height: 1000px`.

**Giải thích sâu:**
```js
{ o_giua_400ms: { khong_interpolate: 84,   ← nhảy thẳng tới đích
                  co_interpolate: 42 } }   ← đúng nửa đường
```

Mẹo `max-height: 1000px` có hai vấn đề: nội dung cao hơn 1000px **bị cắt**, và nội dung thấp hơn nhiều
tạo quãng "chờ" trống trong animation.

Với `<details>` gốc, Chrome 152 cho animate `::details-content`:
```css
details {
  interpolate-size: allow-keywords;
  &::details-content { block-size: 0; overflow: hidden;
                       transition: block-size 320ms, content-visibility 320ms allow-discrete }
  &[open]::details-content { block-size: auto }
}
```
```js
{ cao_khi_dong: 60, cao_o_giua_120ms: 103, cao_khi_mo_xong: 109 }
```

Accordion mượt, 0 dòng JavaScript.

</details>

### 58. Làm sao cho modal đóng có hiệu ứng mà không dùng `setTimeout`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `transition-behavior: allow-discrete` cho `display`, kết hợp `@starting-style` cho
lúc mở.

**Giải thích sâu:** `display` là thuộc tính "rời rạc", không có giá trị trung gian. Trước đây phải:
```js
modal.classList.remove('open');
setTimeout(() => modal.style.display = 'none', 300);
```

Bây giờ:
```css
.m { display: none; opacity: 0; transition: opacity 300ms, display 300ms allow-discrete }
.m.open { display: block; opacity: 1 }
```

Đo lúc đóng:
```js
{ a_display: "none",  a_opacity: "0",        ← không allow-discrete: biến mất ngay
  b_display: "block", b_opacity: "0.197713" } ← có: kịp mờ dần
```

`@starting-style` lo chiều ngược lại — element mới xuất hiện không có "giá trị trước" để transition từ
đó:
```js
{ co_starting_style_opacity: "0.416748",   ← đang animate
  khong_co_opacity: "1" }                  ← hiện luôn
```

</details>

### 59. Làm thanh tiến trình đọc bài mà không dùng JS?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `animation-timeline: scroll()`. Animation chạy theo **vị trí cuộn** thay vì theo thời
gian.

**Giải thích sâu:**
```css
.progress {
  transform-origin: left; scale: 0 1;
  animation: chay linear;
  animation-timeline: scroll(root block);
}
@keyframes chay { to { scale: 1 1 } }
```
```js
{ be_rong_bar: { "0%": 0, "25%": 100.4, "50%": 200, "75%": 300.4, "100%": 400 } }
```

Tuyến tính hoàn hảo, **0 dòng JS**, và chạy trên compositor thread nên không giật kể cả khi JS đang bận.

Loại thứ hai là `view()` — theo việc element đi vào/ra màn hình:
```css
.hien-dan { animation: fade-in linear both; animation-timeline: view();
            animation-range: entry 10% cover 30% }
```
Toàn bộ thư viện AOS/ScrollReveal gói trong 8 dòng CSS.

Điểm thú vị: với `prefers-reduced-motion: reduce`, thanh tiến trình **vẫn hiện đúng vị trí** (đo được
0/640/1280 ở cả hai chế độ) vì nó ánh xạ theo vị trí cuộn chứ không theo thời gian.

</details>

### 60. Vì sao thứ tự trong `transform` quan trọng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mỗi phép biến đổi tác động lên hệ toạ độ **đã bị biến đổi bởi phép trước**.

**Giải thích sâu:**
```js
// translateX(200px) rotate(90deg)
{ a: { x: 200, y: 0 } }
// rotate(90deg) translateX(200px)
{ b: { x: 0, y: 200 } }
```

Xoay trước rồi tịnh tiến nghĩa là tịnh tiến theo hướng đã xoay 90° — tức đi **xuống dưới**.

Thuộc tính riêng lẻ `translate`/`rotate`/`scale` có thứ tự **cố định** (translate → rotate → scale) và
animate độc lập được. Đây là lý do nên dùng chúng:

```js
// với transform, :active ghi đè hoàn toàn :hover
{ transform_hover:        { transform: "matrix(1, 0, 0, 1, 0, -4)" },
  transform_hover_active: { transform: "matrix(0.97, 0, 0, 0.97, 0, 0)" } }  ← mất -4px

// với thuộc tính riêng lẻ, cả hai cùng giữ
{ rieng_le_hover_active: { translate: "0px -4px", scale: "0.97" } }
```

⚠️ `getComputedStyle(el).transform` trả `"none"` khi bạn dùng thuộc tính riêng lẻ — phải đọc
`.translate`, `.rotate`, `.scale` riêng.

</details>

---

Tiếp theo: [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md)
