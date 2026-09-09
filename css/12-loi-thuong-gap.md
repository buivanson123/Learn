# Bài 12 — 30 lỗi CSS thường gặp

Mỗi mục có ba phần: **triệu chứng** (bạn thấy gì), **nguyên nhân**, **cách sửa**. Sắp theo nhóm.

Dùng bài này như tra cứu: gặp lỗi thì tìm triệu chứng khớp nhất.

---

## Nhóm A — Rule không ăn

### A1. Rule của tôi không có tác dụng, DevTools gạch ngang nó

**Triệu chứng:** trong tab Elements, dòng CSS của bạn bị ~~gạch ngang~~.

**Nguyên nhân:** rule khác thắng ở một trong 6 bước cascade.

**Cách sửa:** tab **Computed** → tìm thuộc tính → bấm mũi tên → xem rule nào đang thắng. Xử lý theo thứ
tự:

1. Nó nằm ngoài `@layer` còn bạn ở trong? → đưa bạn ra ngoài hoặc đổi thứ tự layer
2. Nó là inline style? → sửa ở JS/HTML
3. Specificity cao hơn? → tăng specificity của bạn, **đừng** dùng `!important`
4. Bằng nhau? → rule viết sau thắng, đổi thứ tự

Chi tiết: [bài 01](./01-cascade-va-selector.md).

### A2. Thêm `!important` rồi vẫn không ăn

**Nguyên nhân:** đối thủ cũng có `!important`, và đang ở layer khai **trước** bạn — vì `!important`
**đảo ngược** thứ tự layer.

```js
// @layer base, theme; cả hai đều !important
-> "rgb(200, 0, 0)"    ← base thắng, dù khai trước
```

**Cách sửa:** bỏ `!important` ở cả hai, dùng `@layer` để phân định.

### A3. `z-index: 9999` vẫn bị che

**Nguyên nhân:** một tổ tiên đã tạo **stacking context**. Con bạn bị nhốt trong đó.

**Cách tìm:**

```js
let e = document.querySelector('.bi-che');
while (e && e !== document.documentElement) {
  const s = getComputedStyle(e);
  const t = ['opacity','transform','filter','willChange','mixBlendMode','isolation','contain']
    .filter(k => s[k] && !['none','auto','normal','1'].includes(s[k]));
  if (t.length) console.log(e, t.map(k => k + ': ' + s[k]));
  e = e.parentElement;
}
```

**Cách sửa:** bỏ thuộc tính gây ra (thường là `opacity: .99` hoặc `transform: translateZ(0)`), hoặc đưa
element ra ngoài nhánh đó.

### A4. `z-index` không có tác dụng gì cả

**Nguyên nhân:** element là `position: static`.

```js
{ computed_z_index_cua_a: "99", position_cua_a: "static",
  element_o_tren_tai_diem_giao: "b" }    ← b vẫn đè lên a
```

**Cách sửa:** thêm `position: relative`. (Ngoại lệ: flex/grid item dùng được `z-index` khi vẫn `static`.)

### A5. `:hover` trong nesting áp cho cả element con

```css
.menu { :hover { background: #eee } }     /* ❌ = .menu *:hover */
.menu { &:hover { background: #eee } }    /* ✅ = .menu:hover */
```

Đọc từ trình duyệt để chắc:

```js
-> { rule_trong_menu: ["& :hover"] }   ← có DẤU CÁCH = selector hậu duệ
```

### A6. `:is()` làm rule của tôi mạnh lên bất ngờ

```css
:is(.card, #legacy) .title { ... }    /* thành (1,0,1) vì có #legacy */
```

**Cách sửa:** bọc trong `:where()` để dập specificity: `:is(.card, :where(#legacy))`.

---

## Nhóm B — Kích thước và tràn

### B1. `width: 100%` + `padding` làm tràn cha

```js
{ cha: 300, content_box_offsetWidth: 340, tran_ra: 40 }
```

**Cách sửa:** `*, *::before, *::after { box-sizing: border-box }` ở đầu file.

### B2. Layout tràn ngang, không rõ chỗ nào

**Cách tìm:**

```js
const vw = document.documentElement.clientWidth;
for (const e of document.querySelectorAll('*')) {
  const r = e.getBoundingClientRect();
  if (r.right > vw + 0.5) console.log(e.tagName, e.className, r.right, getComputedStyle(e).minWidth);
}
```

Nếu thủ phạm có `minWidth: "auto"` và nằm trong flex/grid → xem B3.

### B3. Flex item không chịu co, đẩy tràn cả hàng

```js
{ mac_dinh: { a_rong: 296.6, a_min_width_computed: "auto", tran: true },
  overflow_hidden: { a_rong: 190, tran: false } }
```

**Nguyên nhân:** `min-width` mặc định của flex/grid item là `auto` — không co nhỏ hơn nội dung.

**Cách sửa:**

```css
.o-text { flex: 1; min-width: 0; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap }
```

### B4. Grid `1fr 1fr` mà hai cột không bằng nhau

```js
{ '1fr_1fr': { track: "355.5px 44.5px" } }     ← lệch hẳn
```

**Cách sửa:** `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`.

### B5. Vùng nội dung không cuộn được, cả trang cuộn thay

```js
{ chi_flex_1: { container_khai_bao: 200, mid_cao: 600, con_tran_khoi_container: true } }
```

**Cách sửa:** thêm `overflow: auto` cho vùng đó. Không cần `min-height: 0` — `overflow` tự làm việc đó.

### B6. `height: 100%` không có tác dụng

```js
{ cha_auto_con_cao: 18, computed_height_khi_cha_auto: "18px" }
```

**Nguyên nhân:** cha cao `auto`.

**Cách sửa:** `min-height: 100dvh` trên `body` + `display: grid`, hoặc khai `height: 100%` từ `html`
xuống.

### B7. `repeat(auto-fit, minmax(250px, 1fr))` tràn trên màn nhỏ

```js
{ w1: { container: 150, track: "200px", tran: true } }
```

**Cách sửa:** `minmax(min(100%, 250px), 1fr)`.

### B8. `margin-top` của con đẩy cả cha xuống

```js
{ cha_y: 50, con_y: 50 }     ← cả hai cùng bị đẩy
```

**Cách sửa:** `display: flow-root` cho cha (không có tác dụng phụ), hoặc chuyển sang `gap`.

### B9. `padding-top: 10%` cho ra số lạ

```js
{ cha_rong: 400, cha_cao: 100, paddingTop: "40px" }    ← 10% của CHIỀU RỘNG
```

Phần trăm của `padding`/`margin` **luôn** tính theo chiều rộng cha, kể cả chiều dọc.

### B10. Trang giật ngang khi mở modal

**Nguyên nhân:** đặt `overflow: hidden` lên `body` làm thanh cuộn biến mất, trả lại 15–17px (trên
Windows/Linux).

**Cách sửa:** `html { scrollbar-gutter: stable }`.

```js
{ gutter_stable: { offsetWidth: 200, clientWidth: 185, scrollbar_chiem: 15 } }
```

---

## Nhóm C — Chữ và khoảng trắng

### C1. Có khoảng trắng 4px giữa các `inline-block`

```js
{ co_newline_trong_html: 4.45, dung_flex: 0 }
```

**Nguyên nhân:** dấu xuống dòng trong HTML là ký tự thật.

**Cách sửa:** `display: flex` cho cha.

### C2. Có vạch màu 4px dưới `<img>`

```js
{ a: 54, bl: 50 }     ← ảnh cao 50 nhưng div cao 54
```

**Cách sửa:** `img { display: block }` hoặc `vertical-align: bottom`.

### C3. Chữ to nhét vào dòng nhỏ, các dòng chồng lên nhau

```js
{ cha_30px_con_40px: "30px" }     ← chữ 40px trong dòng 30px
```

**Nguyên nhân:** `line-height` có đơn vị (`30px` hoặc `150%`) được tính ra px **rồi mới kế thừa**.

**Cách sửa:** luôn dùng số không đơn vị: `line-height: 1.5`.

### C4. URL/email dài làm vỡ layout

```js
{ a: { scrollWidth: 227, clientWidth: 120, tran: true } }
```

**Cách sửa:** `overflow-wrap: break-word` (giữ từ nguyên vẹn khi có thể) thay vì `word-break: break-all`.

### C5. `text-overflow: ellipsis` không hiện dấu ba chấm

**Nguyên nhân:** thiếu một trong hai dòng còn lại.

**Cách sửa:** phải đủ cả ba:

```css
white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
```

### C6. `line-clamp: 2` không hoạt động

```js
CSS.supports('line-clamp: 2')  -> false
```

Chrome 152 **chưa** hỗ trợ bản chuẩn hoá. Vẫn phải:

```css
display: -webkit-box; -webkit-line-clamp: 2;
-webkit-box-orient: vertical; overflow: hidden;
```

### C7. `vertical-align: middle` không căn giữa

```js
{ vertical_align_middle: { tren: 20.84, duoi: 19.16 } }    ← lệch 1.68px
```

**Cách sửa:** dùng `display: flex; align-items: center` hoặc `display: grid; place-items: center`.

### C8. `width`/`height` không có tác dụng trên `<span>`

```js
{ inline: { w: 7.11, h: 18 } }     ← khai 200×200 nhưng vô hiệu
```

**Cách sửa:** `display: inline-block` hoặc `block`.

### C9. Chữ vô hình vài giây khi tải trang

**Nguyên nhân:** `@font-face` thiếu `font-display`. Mặc định Chrome ẩn chữ tới 3 giây chờ font.

**Cách sửa:** `font-display: swap`.

---

## Nhóm D — Biến CSS và màu

### D1. Màu chữ tự nhiên thành đen

```js
{ khong_fallback: "rgb(0, 0, 0)" }
```

**Nguyên nhân:** `var()` trỏ vào biến không tồn tại hoặc sai kiểu → thuộc tính rơi về `unset`, **không**
quay về giá trị khai trước đó.

**Cách sửa:** luôn cho fallback `var(--x, #333)`, hoặc khai `@property` với `initial-value`.

### D2. `width: var(--n)` không hoạt động với `--n: 20`

```js
{ dung_truc_tiep: "784px", nhan_1px: "20px" }
```

**Cách sửa:** `calc(var(--n) * 1px)`. Không nối chuỗi được (`var(--n)px` sai).

### D3. Biến CSS không animate được

```js
{ o_giua_animation: { khong_property: 200 } }    ← nhảy thẳng tới đích
```

**Cách sửa:** khai `@property` với `syntax` phù hợp:

```css
@property --w { syntax: '<length>'; inherits: false; initial-value: 0px }
```

### D4. Nút đổi nền không đổi được màu

```
sau khi bấm nút: theme=dark   nền oklch(0.99 0.005 250)   ← không đổi
```

**Nguyên nhân:** `light-dark()` chỉ đọc `color-scheme`, không đọc `class` hay `data-*`.

**Cách sửa:**

```css
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

### D5. Ô `<input>` trắng toát trên nền tối

**Nguyên nhân:** thiếu `color-scheme`.

**Cách sửa:** `:root { color-scheme: light dark }`. Trình duyệt tự đổi màu form control, thanh cuộn,
checkbox:

```js
{ dark_input: { bg: "rgb(59, 59, 59)", color: "rgb(255, 255, 255)" } }
```

---

## Nhóm E — Position và sticky

### E1. `position: sticky` không dính

Ba nguyên nhân, kiểm tra theo thứ tự:

**(a) Thiếu ngưỡng.** Phải khai `top`, `bottom`, `left` hoặc `right`.

```js
{ nothr: { y_sau_khi_cuon_100px: -99, con_dinh: false } }
```

**(b) Tổ tiên có `overflow` khác `visible`.**

```js
{ bad: { y_sau_khi_cuon_100px: -99, con_dinh: false } }
```

```js
let e = document.querySelector('.sticky-hong').parentElement;
while (e) { const o = getComputedStyle(e).overflow;
  if (o !== 'visible') console.log('THỦ PHẠM:', e, o); e = e.parentElement; }
```

**(c) Cha cao đúng bằng element** → không có quãng nào để dính.

### E2. `position: fixed` neo sai chỗ

```js
{ transform: { y: 303, cha_y: 302 } }     ← neo vào cha, không phải viewport
```

**Nguyên nhân:** tổ tiên có `transform`, `filter`, `will-change`, `contain`, `perspective`, hoặc
`backdrop-filter`.

**Cách sửa:** dùng `<dialog>` + `showModal()` (nằm ở top layer), hoặc portal/`<Teleport>`.

### E3. `absolute` nhảy về góc trang

**Nguyên nhân:** không có tổ tiên nào `position: relative`.

**Cách sửa:** thêm `position: relative` cho khối chứa.

### E4. Anchor link `#muc` bị header sticky che

**Cách sửa:**

```css
html { scroll-padding-top: 80px }      /* cho toàn trang */
/* hoặc */
:target { scroll-margin-top: 80px }    /* cho từng đích */
```

```js
{ khong_scroll_margin_y: 0, co_scroll_margin_70px_y: 70 }
```

---

## Nhóm F — Animation và hiệu ứng

### F1. Element nhảy về chỗ cũ khi animation kết thúc

```js
{ none: "none", forwards: "matrix(1, 0, 0, 1, 80, 0)" }
```

**Cách sửa:** `animation-fill-mode: forwards` (hoặc `both`).

### F2. `transition` trên `height: auto` không chạy

```js
{ o_giua_400ms: { khong_interpolate: 84 } }     ← nhảy thẳng
```

**Cách sửa:** `interpolate-size: allow-keywords` trên `:root`. Đừng dùng mẹo `max-height: 1000px`.

### F3. Modal biến mất đột ngột thay vì mờ dần

```js
{ giua_khi_dong: { a_display: "none", a_opacity: "0" } }
```

**Cách sửa:** `transition: opacity 300ms, display 300ms allow-discrete`.

### F4. Element mới thêm vào DOM không có hiệu ứng xuất hiện

**Nguyên nhân:** không có "giá trị trước" để transition từ đó.

**Cách sửa:** `@starting-style`.

```css
.pop { opacity: 1; transition: opacity 400ms }
@starting-style { .pop { opacity: 0 } }
```

### F5. `:hover` nâng lên, `:active` thu nhỏ — nhưng mất hiệu ứng nâng

```js
{ transform_hover:        { transform: "matrix(1, 0, 0, 1, 0, -4)" },
  transform_hover_active: { transform: "matrix(0.97, 0, 0, 0.97, 0, 0)" } }  ← mất -4px
```

**Nguyên nhân:** `transform` là một thuộc tính, rule sau ghi đè hoàn toàn.

**Cách sửa:** dùng thuộc tính riêng lẻ:

```css
.the:hover  { translate: 0 -4px }
.the:active { scale: .97 }
```

### F6. `transition: all` gây hiệu ứng lạ khi thêm class

**Cách sửa:** liệt kê thuộc tính cụ thể.

### F7. Animation giật trên máy yếu

```
left       LayoutCount: 120
transform  LayoutCount: 0
```

**Cách sửa:** chỉ animate `transform` và `opacity`.

### F8. Bật "giảm chuyển động" nhưng accordion vẫn trượt

```js
// prefers-reduced-motion: reduce
{ accordion: { sau_100ms: 101, mo_xong: 109 } }    ← vẫn animate
```

**Nguyên nhân:** `*, *::before, *::after` **không phủ** `::details-content` và các pseudo-element mới.
Dấu `*` chỉ khớp element, không khớp pseudo-element.

**Cách sửa:** liệt kê thêm:

```css
*, *::before, *::after, *::details-content, *::backdrop { ... }
```

---

## Nhóm G — Container query và responsive

### G1. `@container` không có tác dụng gì

**Nguyên nhân phổ biến nhất:** bạn đang nhắm **chính element** khai `container-type`.

```js
{ background_cua_chinh_no: "rgb(238, 238, 238)",   ← không đổi
  background_cua_con: "rgb(0, 255, 0)" }           ← đổi
```

**Cách sửa:** tách hai tầng — wrapper giữ `container-type`, con nhận style.

### G2. `@container (min-height: ...)` không khớp

```js
{ inline_size: "rgb(0, 0, 0)", size: "rgb(0, 150, 0)" }
```

**Cách sửa:** `container-type: size` (nhưng container phải có chiều cao xác định).

### G3. Ngưỡng container query không bao giờ khớp

**Cách sửa:** đo bề rộng thật trước khi chọn ngưỡng.

```js
document.querySelector('.card').getBoundingClientRect().width  -> 364
```

### G4. Chữ `clamp()` không phóng to được khi người dùng tăng cỡ chữ

**Nguyên nhân:** công thức thuần `vw`, ví dụ `clamp(24px, 5vw, 48px)`.

**Cách sửa:** phần giữa phải có `rem`: `clamp(1.5rem, 1rem + 3vw, 3rem)`.

### G5. Cả hai media query cùng khớp ở đúng breakpoint

**Nguyên nhân:** `min-width: 768px` và `max-width: 768px` cùng đúng ở 768px.

**Cách sửa:** dùng cú pháp range — `(width >= 768px)` và `(width < 768px)`.

---

## Nhóm H — Linh tinh

### H1. `::before`/`::after` không hiện trên `<img>`, `<input>`

```js
{ div:      { after_render_that: true  },
  img:      { after_render_that: false },
  input:    { after_render_that: false },
  select:   { after_render_that: false },
  textarea: { after_render_that: false },
  button:   { after_render_that: true  } }
```

**Nguyên nhân:** chúng là "replaced element", không có nội dung để chèn vào.

⚠️ **Chú ý cách kiểm tra.** `getComputedStyle(img, '::after').content` vẫn trả về `"✓"` — nó chỉ nói
giá trị **đã khai**, không nói nó có **render** hay không. Phải đo bằng kích thước:

```js
img_khong_after.getBoundingClientRect().width === img_co_after.getBoundingClientRect().width
```

**Cách sửa:** bọc trong một `<span>` và đặt pseudo-element lên đó.

### H2. Viền focus hiện cả khi bấm chuột

```js
// CLICK CHUỘT thẳng vào B:  { focus: true,  focus_visible: false }
// Click A rồi BẤM TAB sang B: { focus: true, focus_visible: true, b_vien: "3px xanh" }
```

**Cách sửa:** dùng `:focus-visible` thay vì `:focus`.

⚠️ **Đừng bao giờ viết `outline: none` mà không thay bằng gì khác** — người dùng bàn phím sẽ không biết
mình đang ở đâu.

### H3. Ảnh bị méo

```js
{ cover:   { lap_day_o: "100%" },   ← cắt bớt, giữ tỉ lệ
  contain: { lap_day_o:  "50%" },   ← lộ nền, giữ tỉ lệ
  fill:    { lap_day_o: "100%" } }  ← KÉO MÉO
```

**Cách sửa:** `object-fit: cover` cho ảnh đại diện/thumbnail, `contain` cho logo.

Lưu ý: `object-fit` **không đổi layout** — hộp vẫn đúng kích thước bạn khai trong cả 5 giá trị. Nó chỉ
đổi cách vẽ ảnh bên trong hộp.

### H4. Nội dung nhảy khi ảnh tải xong (CLS)

```js
{ khong_khai_bao: { cao: 100 }, co_aspect_ratio: { cao: 150 } }
```

**Cách sửa:** đặt `width` và `height` trong HTML, hoặc `aspect-ratio` trong CSS.

### H5. Sọc vằn của bảng sai khi có dòng bị ẩn

```js
{ li1: "sọc", li2: "(ẩn)", li3: "không sọc", li4: "sọc" }
```

**Cách sửa:** `tr:nth-child(odd of :not(.an))`.

### H6. `list-style: none` làm mất ngữ nghĩa danh sách trong Safari

**Cách sửa:** thêm `role="list"` vào `<ul>`.

### H7. Element vẫn nhận sự kiện chuột dù trong suốt

```js
{ truoc: "over", sau_pointer_events_none: "under" }
```

**Cách sửa:** `pointer-events: none` cho lớp phủ trang trí.

### H8. Không đọc được `cssRules` trong DevTools

```
SecurityError: Failed to read the 'cssRules' property from 'CSSStyleSheet'
```

**Nguyên nhân:** mở trang bằng `file://`.

**Cách sửa:** `python3 -m http.server 8123`.

---

## Bảng tra nhanh theo triệu chứng

| Bạn thấy | Xem mục |
|---|---|
| Rule bị gạch ngang trong DevTools | A1 |
| `z-index` không ăn | A3, A4 |
| Trang cuộn ngang được | B2, B3, B4, B7 |
| Hai cột lẽ ra bằng nhau mà lệch | B4 |
| Vùng nội dung không cuộn | B5 |
| Khoảng trắng nhỏ không rõ từ đâu | C1, C2 |
| Các dòng chữ chồng lên nhau | C3 |
| Dấu `…` không hiện | C5, C6 |
| Màu tự nhiên thành đen | D1 |
| Nút đổi nền không hoạt động | D4 |
| `sticky` không dính | E1 |
| Modal nằm sai chỗ | E2 |
| Element nhảy giật sau animation | F1 |
| Accordion không mượt | F2 |
| Modal biến mất đột ngột | F3 |
| Hiệu ứng hover mất khi bấm | F5 |
| `@container` không có tác dụng | G1, G3 |
| Viền focus hiện khi bấm chuột | H2 |
| Ảnh bị méo | H3 |
| Nội dung nhảy khi tải ảnh | H4 |

---

Tiếp theo: [13-cheatsheet.md](./13-cheatsheet.md)
