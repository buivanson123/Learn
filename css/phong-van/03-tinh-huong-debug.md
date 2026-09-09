# 10 tình huống debug

Đây là dạng câu hỏi phân biệt rõ nhất giữa người đã làm thật và người mới học lý thuyết. Người phỏng vấn
mô tả một triệu chứng, bạn phải nêu **quy trình** tìm nguyên nhân — không phải đoán bừa.

**Cách luyện:** đọc triệu chứng, viết ra quy trình của bạn, rồi mới mở đáp án.

---

## Tình huống 1 — "Em sửa màu mà nó không đổi"

> Đồng nghiệp gọi bạn: đã viết `.title { color: red }` nhưng chữ vẫn xanh. Đã hard refresh, đã kiểm tra
> file được nạp.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Xác nhận rule có tồn tại và có khớp không.**
Trong tab Elements, chọn element. Nếu rule của bạn **không xuất hiện** trong panel Styles → selector
không khớp (sai tên class, sai cấu trúc DOM, hoặc file chưa nạp).

**Bước 2 — Nếu rule xuất hiện nhưng bị ~~gạch ngang~~** → nó thua cascade. Sang tab **Computed**, gõ
`color` vào ô lọc, bấm mũi tên để xem **rule nào đang thắng**.

**Bước 3 — Xác định thua ở bước nào**, theo thứ tự cascade:

1. Đối thủ có `!important`? → xem bước 4
2. Đối thủ nằm **ngoài** `@layer` còn bạn ở trong? → CSS ngoài layer thắng mọi layer
3. Đối thủ ở layer khai **sau**? → đổi thứ tự layer, đừng tăng specificity
4. Đối thủ là **inline style**? → sửa ở JS/HTML
5. Specificity cao hơn? → tăng của bạn
6. Bằng nhau? → rule viết **sau** thắng, đổi thứ tự file

**Bước 4 — Nếu cả hai đều `!important`**: nhớ rằng `!important` **đảo ngược** thứ tự layer. Layer khai
**trước** sẽ thắng.

```js
// @layer base, theme; cả hai !important
-> "rgb(200, 0, 0)"     ← base (khai trước) thắng
```

**Bước 5 — Nếu rule của bạn thắng nhưng màu vẫn sai**: kiểm tra `var()`. Biến sai kiểu làm thuộc tính
rơi về `unset` chứ không về giá trị trước:

```js
{ khong_fallback: "rgb(0, 0, 0)" }
```

**Điều KHÔNG nên làm:** thêm `!important`. Nó chỉ đẩy vấn đề lên tầng tiếp theo.

</details>

---

## Tình huống 2 — "Trang cuộn ngang được trên điện thoại"

> QA báo trang có thanh cuộn ngang ở màn 320px. Trên máy bạn (1440px) không thấy gì.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Tái hiện.** DevTools → Device Toolbar → đặt bề rộng 320px. Đừng chỉ thu nhỏ cửa sổ, vì
cửa sổ không xuống được 320px trên nhiều máy.

**Bước 2 — Tìm thủ phạm bằng script**, đừng dò bằng mắt:

```js
const vw = document.documentElement.clientWidth;
for (const e of document.querySelectorAll('*')) {
  const r = e.getBoundingClientRect();
  if (r.right > vw + 0.5 || r.left < -0.5)
    console.log(e.tagName, e.className, r.right, getComputedStyle(e).minWidth);
}
```

Đây chính là script tìm ra lỗi trong dự án ở bài 11:

```js
{ viewport: 320, tong_tran: 1,
  thu_pham: [ { the: "button.btn", left: 254.4, right: 352.6, minWidth: "auto" } ] }
```

**Bước 3 — Đọc `minWidth`.** Nếu là `"auto"` và element nằm trong flex/grid → đây là bẫy min-size.
Kiểm tra tiếp cha nó:

```js
{ nav_rong: 272, nav_scrollWidth: 329 }    ← container 272 nhưng nội dung cần 329
```

**Bước 4 — Chọn cách sửa** theo tình huống:

| Tình huống | Sửa |
|---|---|
| Ô text dài | `min-width: 0; overflow: hidden; text-overflow: ellipsis` |
| Nhiều item không vừa hàng | `flex-wrap: wrap` + thu `gap` |
| Có nhãn bỏ được | ẩn nhãn dưới breakpoint, giữ `aria-label` |
| `width: 100%` + padding | `box-sizing: border-box` |
| Lưới `minmax(260px, 1fr)` | đổi thành `minmax(min(100%, 260px), 1fr)` |

**Bước 5 — Chạy lại script ở TẤT CẢ các bề rộng**, không chỉ 320px. Sửa chỗ này có thể làm hỏng chỗ
khác.

</details>

---

## Tình huống 3 — "Dropdown bị menu khác che, em để z-index 9999 rồi"

> Menu con của dropdown nằm dưới một khối khác, dù đã đặt `z-index: 9999`.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Xác nhận `z-index` có tác dụng không.** Kiểm tra `position`:

```js
getComputedStyle(el).position    // "static" -> z-index vô nghĩa
```

Ngoại lệ: flex/grid item dùng được `z-index` khi vẫn `static`.

**Bước 2 — Nếu đã `position: relative` mà vẫn thua** → chắc chắn có tổ tiên tạo **stacking context**.
Chạy:

```js
let e = document.querySelector('.dropdown');
while (e && e !== document.documentElement) {
  const s = getComputedStyle(e);
  const t = ['opacity','transform','filter','willChange','mixBlendMode','isolation','contain']
    .filter(k => s[k] && !['none','auto','normal','1'].includes(s[k]));
  if (t.length) console.log(e, t.map(k => k + ': ' + s[k]));
  e = e.parentElement;
}
```

Thủ phạm thường gặp: `opacity: .99`, `transform: translateZ(0)`, `filter: blur(0)`,
`will-change: transform`, `backdrop-filter`.

**Bước 3 — Hiểu vì sao tăng số không giúp.** `z-index` của con chỉ so với anh em **trong cùng stacking
context**. Cha thua thì cả nhánh thua theo. `9999` hay `999999` không khác gì nhau.

```js
{ khong_opacity_diem_giao: "c1",   ← con z-index:9999 ở trên
  co_opacity_diem_giao: "ov2" }    ← .over z-index:1 ở trên con z-index:9999
```

**Bước 4 — Chọn cách sửa:**

| Cách | Khi nào |
|---|---|
| Bỏ thuộc tính gây ra | `opacity: .99` thay bằng `background: rgb(255 255 255 / .99)` |
| Nâng z-index của **tổ tiên** | khi tổ tiên đó cũng được định vị |
| Đưa dropdown ra ngoài | portal / `<Teleport>` / popover API |
| Dùng `<dialog>` hoặc `popover` | nằm ở top layer, miễn nhiễm hoàn toàn |

**Bước 5 — Phòng về sau:** khai thang z-index bằng biến ở một chỗ, và dùng `isolation: isolate` cho
component để nhốt z-index nội bộ.

</details>

---

## Tình huống 4 — "Header sticky không dính"

> `position: sticky; top: 0` nhưng header vẫn cuộn đi mất. Code giống hệt ví dụ trên mạng.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Chrome đã làm sẵn cho bạn.** Trong tab Elements, cạnh thẻ có badge **`sticky`**. Bấm vào,
DevTools chỉ thẳng ra tổ tiên nào đang phá.

Nếu không có badge → element không phải sticky (kiểm tra chính tả, kiểm tra rule có bị đè không).

**Bước 2 — Kiểm tra 3 điều kiện, theo thứ tự dễ sai nhất:**

**(a) Thiếu ngưỡng** — phải khai `top`, `bottom`, `left` hoặc `right`:

```js
getComputedStyle(el).top    // "auto" -> đây là lỗi
```
```js
{ nothr: { y_sau_khi_cuon_100px: -99, con_dinh: false } }
```

**(b) Tổ tiên có `overflow` khác `visible`:**

```js
let e = document.querySelector('.sticky-hong').parentElement;
while (e) { const o = getComputedStyle(e).overflow;
  if (o !== 'visible') console.log('THỦ PHẠM:', e, o); e = e.parentElement; }
```
```js
{ bad: { y_sau_khi_cuon_100px: -99, con_dinh: false } }
```

**(c) Cha cao đúng bằng element** — không có quãng nào để dính:

```js
el.offsetHeight === el.parentElement.offsetHeight    // true -> đây là lỗi
```

**Bước 3 — Câu hỏi tiếp theo người phỏng vấn hay hỏi:** "Vì sao trên CodePen chạy mà trong dự án
không?"

Trả lời: dự án có một `overflow: hidden` ở tầng trên. Nó thường được thêm vào để **chặn margin
collapsing** — mà việc đó nên dùng `display: flow-root` (không tác dụng phụ) thay vì `overflow: hidden`.

</details>

---

## Tình huống 5 — "Modal nằm sai chỗ sau khi em thêm hiệu ứng hover"

> Modal `position: fixed; inset: 0` vẫn chạy đúng hôm qua. Hôm nay thêm hiệu ứng nâng card lên khi hover
> thì modal nằm lệch hẳn.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Nhận ra ngay:** `position: fixed` bị một tổ tiên "bắt" lại. Hiệu ứng vừa thêm chắc chắn là
`transform`.

**Bước 2 — Xác nhận bằng số:**

```js
const m = document.querySelector('.modal').getBoundingClientRect();
const c = document.querySelector('.card').getBoundingClientRect();
console.log({ modal_y: m.y, card_y: c.y });   // trùng nhau -> modal neo vào card
```

```js
{ transform: { y: 303, cha_y: 302 } }     ← modal neo vào cha, không phải viewport
```

**Bước 3 — Biết danh sách thủ phạm.** Sáu thuộc tính tạo containing block cho `fixed`:

```js
{ transform:     { y: 303, cha_y: 302 },
  filter:        { y: 505, cha_y: 504 },
  will_change:   { y: 707, cha_y: 706 },
  contain_paint: { y: 909, cha_y: 908 } }
```

Cộng thêm `perspective` và `backdrop-filter`.

**Bước 4 — Chọn cách sửa:**

| Cách | Đánh giá |
|---|---|
| Đổi hiệu ứng hover sang `translate` riêng lẻ | ❌ vẫn là transform, vẫn bắt |
| Đổi sang `box-shadow` thay vì nâng lên | ✅ nếu chấp nhận được về thiết kế |
| Đưa modal ra khỏi card bằng portal/`<Teleport>` | ✅ |
| Dùng `<dialog>` + `showModal()` | ✅✅ **tốt nhất** — top layer, không tổ tiên nào bắt được |

**Bước 5 — Bài học nêu ra:** đây là lý do modal/dropdown/tooltip nên **luôn** render ở gốc DOM hoặc top
layer, chứ không nằm trong cây component. Bug này sẽ quay lại bất cứ khi nào ai đó thêm một hiệu ứng.

</details>

---

## Tình huống 6 — "Nút đổi nền tối không hoạt động"

> Bấm nút, `data-theme="dark"` xuất hiện trên `<html>` đúng như mong đợi. Nhưng màu không đổi.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Xác nhận attribute có được đặt không:**

```js
document.documentElement.dataset.theme   // "dark" -> JS chạy đúng
```

Vậy vấn đề ở CSS.

**Bước 2 — Kiểm tra CSS đang dùng cơ chế nào.** Nếu thấy `light-dark()`:

```css
--nen: light-dark(oklch(0.99 0.005 250), oklch(0.19 0.02 255));
```

→ **Đây là nguyên nhân.** `light-dark()` chỉ đọc `color-scheme`, **không đọc** class hay `data-*`.

```
sau khi bấm nút: theme=dark   nền oklch(0.99 0.005 250)   ← không đổi
```

**Bước 3 — Sửa bằng hai dòng cầu nối:**

```css
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

Sau khi sửa:
```
hệ thống=light -> bấm nút: theme=dark  nền oklch(0.19 0.02 255) ✅
hệ thống=dark  -> bấm nút: theme=light nền oklch(0.99 0.005 250) ✅
```

**Bước 4 — Kiểm tra lỗi thứ hai đi kèm.** Rất nhiều người viết:

```js
const toi = document.documentElement.dataset.theme === 'dark';   // ❌
```

Lần đầu vào trang, `data-theme` chưa được đặt → luôn `false` → coi như đang sáng. Với người dùng đang
để hệ điều hành ở chế độ tối, bấm nút lần đầu **không có gì xảy ra**.

Sửa: khởi tạo từ `matchMedia('(prefers-color-scheme: dark)').matches`.

**Bước 5 — Kiểm tra `color-scheme` có được khai không.** Không có nó, `<input>` sẽ trắng toát trên nền
tối:

```js
{ dark_input: { bg: "rgb(59, 59, 59)", color: "rgb(255, 255, 255)" } }
```

</details>

---

## Tình huống 7 — "Trang giật khi cuộn xuống"

> Người dùng báo trang "nhảy" khi cuộn. Không tái hiện được ổn định.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Bật công cụ.** DevTools → Ctrl+Shift+P → "Show Rendering" → tick **Layout Shift Regions**.
Vùng nào nhảy sẽ nháy màu xanh.

**Bước 2 — Liệt kê nguyên nhân theo thứ tự phổ biến:**

**(a) Ảnh không khai kích thước.** Ảnh chưa tải thì hộp cao 0, tải xong đẩy mọi thứ xuống.

```js
{ khong_khai_bao: { cao: 100 }, co_aspect_ratio: { cao: 150 } }
```

Sửa: `width` + `height` trong HTML, hoặc `aspect-ratio` trong CSS.

**(b) Font web tải xong đổi cỡ chữ.** Sửa: `font-display: swap` + chọn font dự phòng có metric gần
giống.

**(c) `content-visibility: auto` ước lượng sai.** Đây là nguyên nhân trong dự án ở bài 11:

```js
{ cao_khi_chua_cuon_toi: 624, cao_sau_khi_cuon_toi: 500 }   ← giật 124px
```

Sửa: chỉnh `contain-intrinsic-size` sát hơn, hoặc **bỏ hẳn** nếu trang không đủ dài để có lãi.

**(d) Nội dung chèn động** (banner quảng cáo, thông báo) không có chỗ giữ sẵn. Sửa: `min-height` cho ô
chứa.

**(e) Thanh cuộn xuất hiện/biến mất.** Sửa: `html { scrollbar-gutter: stable }`.

**Bước 3 — Đo lại bằng số**, không tin mắt:

```js
new PerformanceObserver(list => {
  for (const e of list.getEntries()) if (!e.hadRecentInput) console.log('CLS:', e.value, e.sources);
}).observe({ type: 'layout-shift', buffered: true });
```

`e.sources` chỉ thẳng ra element nào gây dịch chuyển.

</details>

---

## Tình huống 8 — "Animation giật trên điện thoại"

> Hiệu ứng trượt menu mượt trên máy tính, giật trên điện thoại tầm trung.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Xem đang animate thuộc tính gì.** Đây là câu hỏi đầu tiên, không phải câu cuối.

```css
@keyframes truot { from { left: -300px } to { left: 0 } }     /* ❌ */
```

**Bước 2 — Biết con số.** Animate 200 element trong 2 giây:

```
thuộc tính   LayoutCount  LayoutDuration
left               120        20.1 ms
width              120        79.9 ms
transform            0           0 ms
opacity              0           0 ms
```

`120` = mỗi frame một lần tính lại layout. `transform` là **0**.

**Bước 3 — Sửa:**

```css
@keyframes truot { from { translate: -300px } to { translate: 0 } }   /* ✅ */
```

**Bước 4 — Nếu vẫn giật, kiểm tra JS.** Layout thrashing đắt hơn hẳn:

```js
{ xen_ke_doc_ghi_ms: 32.5, doc_het_roi_ghi_het_ms: 0.3 }   ← chậm 108 lần
```

Trong tab Performance, tìm cảnh báo **"Forced reflow"** với tam giác đỏ — bấm vào, nó chỉ thẳng dòng JS.

**Bước 5 — Đừng vội thêm `will-change`.** Nó tạo layer GPU ngay lập tức, và 300 item danh sách với
`will-change` là cách nhanh nhất làm treo máy yếu. Chỉ thêm khi đã đo được vấn đề **và** đo lại được
cải thiện.

**Bước 6 — Kiểm tra `prefers-reduced-motion`** đã được tôn trọng chưa. Người dùng máy yếu thường bật
tuỳ chọn này.

</details>

---

## Tình huống 9 — "Container query em viết không có tác dụng"

> Đã khai `container-type: inline-size`, đã viết `@container`, DevTools không báo lỗi cú pháp. Nhưng
> layout không đổi.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Kiểm tra bẫy phổ biến nhất trước:** bạn có đang nhắm **chính element** khai
`container-type` không?

```css
.card {
  container-type: inline-size;              /* ❌ */
  display: grid;
}
@container (width >= 340px) { .card { grid-template-columns: auto 1fr } }
```

Container query **không style được** element khai `container-type` (tránh vòng lặp vô tận).

```js
{ background_cua_chinh_no: "rgb(238, 238, 238)",   ← không đổi
  background_cua_con: "rgb(0, 255, 0)" }           ← đổi
```

Sửa: tách hai tầng — wrapper giữ `container-type`, con nhận style.

**Bước 2 — Nếu đã tách đúng, kiểm tra ngưỡng.** Đo bề rộng **thật** của container:

```js
document.querySelector('.card-slot').getBoundingClientRect().width
-> 364
```

Ngưỡng 380px sẽ không bao giờ khớp. Đây là lỗi thứ hai tôi mắc trong dự án ở bài 11.

**Bước 3 — Nếu đang query chiều cao**, kiểm tra `container-type`:

```js
{ inline_size: "rgb(0, 0, 0)", size: "rgb(0, 150, 0)" }
```

`inline-size` chỉ query được bề rộng. Muốn chiều cao phải dùng `size` — nhưng khi đó container không tự
cao theo nội dung nữa, rất dễ làm sập layout.

**Bước 4 — Kiểm tra tên container** nếu có lồng nhiều tầng. Không có tên thì `@container` luôn nhắm
container **gần nhất**.

**Bước 5 — Xác nhận hỗ trợ:**

```js
CSS.supports('container-type', 'inline-size')   // true trên Chrome 152
```

</details>

---

## Tình huống 10 — "Người dùng báo trang khó dùng bằng bàn phím"

> Một người dùng khiếm thị báo không biết mình đang ở đâu khi bấm Tab.

<details><summary>Quy trình đúng</summary>

**Bước 1 — Tự thử.** Bấm Tab từ đầu trang, đi hết một lượt. Ghi lại chỗ nào:
- Không thấy viền focus
- Focus nhảy lung tung không theo thứ tự đọc
- Focus rơi vào element bị ẩn
- Không thoát ra khỏi modal được

**Bước 2 — Tìm `outline: none`.**

```
grep -rn "outline: *none\|outline: *0" styles.css
```

Đây là nguyên nhân số một. Nếu bỏ `outline` thì **phải** thay bằng thứ khác:

```css
:focus-visible { outline: 2px solid var(--nhan); outline-offset: 3px }
```

**Bước 3 — Kiểm tra dùng `:focus` hay `:focus-visible`.**

```js
// CLICK CHUỘT vào nút:  { focus: true,  focus_visible: false }
// Click A rồi TAB sang B: { focus: true, focus_visible: true }
```

`:focus` hiện viền cả khi bấm chuột (nhiều designer không thích, dẫn tới `outline: none`).
`:focus-visible` chỉ hiện khi dùng bàn phím — giải quyết được cả hai phía.

**Bước 4 — Kiểm tra `order` và `grid-auto-flow: dense`.** Chúng đổi thứ tự **nhìn thấy** nhưng không
đổi thứ tự Tab:

```js
{ x_cua_A: 32.91, x_cua_B: 8,           ← mắt thấy B trước A
  thu_tu_dom: ["first", "second"] }     ← Tab đi A trước B
```

Sửa: đổi thứ tự trong HTML thay vì dùng `order`.

**Bước 5 — Kiểm tra các mục còn lại:**

| Mục | Cách kiểm tra |
|---|---|
| Có link "bỏ qua tới nội dung" chưa | Tab lần đầu tiên vào trang |
| Vùng bấm đủ lớn chưa (44×44px) | `@media (pointer: coarse)` |
| Modal có bẫy focus không | Tab trong modal, có thoát ra ngoài không |
| `list-style: none` có kèm `role="list"` | Safari mất ngữ nghĩa list |
| Icon trang trí có `aria-hidden="true"` | trình đọc đọc thừa |
| Nút chỉ có icon có `aria-label` | trình đọc đọc gì |

**Bước 6 — Kiểm tra tương phản màu.** DevTools → chọn element → panel màu hiện tỉ lệ tương phản. Tối
thiểu **4.5:1** cho chữ thường, **3:1** cho chữ lớn.

</details>

---

## Tổng kết: bốn câu hỏi luôn hỏi đầu tiên

Bất kể triệu chứng gì:

1. **Tái hiện được không?** Ở viewport nào, trình duyệt nào, chế độ nền nào?
2. **Nó là vấn đề của CSS hay của DOM?** Element có tồn tại không, có đúng class không?
3. **Số đo nói gì?** Đừng dựa vào mắt — `getBoundingClientRect`, `getComputedStyle`, `elementFromPoint`.
4. **Nếu sửa cách này, cái gì có thể hỏng theo?** Chạy lại toàn bộ kiểm tra, không chỉ chỗ vừa sửa.

Trong dự án ở [bài 11](../11-du-an-landing-page.md), **bốn trong năm lỗi** chỉ lộ ra khi có số đo — nhìn
bằng mắt trên desktop thì trang "trông ổn".

---

Tiếp theo: [04-tu-kiem-tra.md](./04-tu-kiem-tra.md)
