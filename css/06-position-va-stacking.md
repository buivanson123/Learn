# Bài 06 — Position và stacking context: vì sao `z-index: 9999` vẫn bị che

Bài này giải quyết ba câu hỏi hay gặp nhất trong việc xếp lớp:

1. `position: absolute` neo vào đâu?
2. Vì sao `z-index: 9999` không thắng?
3. Vì sao `position: sticky` im lặng không hoạt động?

Cả ba đều có câu trả lời chính xác, không có gì "tuỳ trình duyệt".

---

## 1. `absolute` neo vào TỔ TIÊN ĐÃ ĐỊNH VỊ gần nhất

"Đã định vị" = có `position` khác `static` (tức là `relative`, `absolute`, `fixed`, hoặc `sticky`).

```css
.out  { position: relative; margin: 50px; width: 300px; height: 200px }
.mid  { margin: 20px; width: 200px; height: 100px }              /* static */
.mid2 { position: relative; margin: 20px; width: 200px; height: 100px }
.dot  { position: absolute; top: 0; left: 0; width: 10px; height: 10px }
```

```js
{ cha_khong_relative: { dot: 51, out: 50, khop_voi: "out" },   ← bỏ qua .mid
  cha_co_relative:    { dot: 72, mid: 71, khop_voi: "mid" } }  ← neo vào .mid2
```

Trình duyệt đi ngược lên cây DOM cho tới khi gặp tổ tiên đã định vị. Không có ai thì neo vào
**initial containing block** (khối bằng viewport, nhưng cuộn theo trang).

**Quy tắc vàng:** mỗi khi viết `position: absolute`, hãy tự hỏi "cái `relative` của nó ở đâu?" — nếu
không trả lời được ngay thì bug sắp tới.

---

## 2. `position: fixed` bị `transform` của tổ tiên bắt lại

Đây là bug khó chịu nhất trong nhóm: modal `position: fixed` đột nhiên nằm sai chỗ sau khi bạn thêm
một hiệu ứng hover cho khối cha.

```css
.box { margin: 100px; width: 200px; height: 100px }
#t { transform: translateZ(0) }
#f { filter: blur(0px) }
#w { will-change: transform }
#c { contain: paint }
.fx { position: fixed; top: 0; left: 0; width: 20px; height: 20px }
```

```js
{ khong_gi:     { y: 0 },                        ← neo vào viewport, đúng
  transform:    { y: 303, cha_y: 302 },          ← neo vào CHA
  filter:       { y: 505, cha_y: 504 },          ← neo vào CHA
  will_change:  { y: 707, cha_y: 706 },          ← neo vào CHA
  contain_paint:{ y: 909, cha_y: 908 } }         ← neo vào CHA
```

Bốn thuộc tính này biến element thành **containing block** cho con cháu `fixed` và `absolute`:

| Thuộc tính | Hay xuất hiện ở đâu |
|---|---|
| `transform` (bất kỳ giá trị nào ≠ `none`) | hiệu ứng hover, animation, `translateZ(0)` để "tăng tốc" |
| `filter` | `blur`, `drop-shadow`, kể cả `blur(0px)` |
| `will-change: transform` / `filter` | tối ưu hiệu năng |
| `contain: paint` / `layout` / `strict` | tối ưu hiệu năng |
| `perspective`, `backdrop-filter` | hiệu ứng 3D, kính mờ |

**Cách xử lý:** đưa modal/dropdown ra ngoài cây DOM đó — dùng portal (React), `<Teleport>` (Vue), hoặc
thẻ `<dialog>` gốc. Với `<dialog>` thì nó nằm ở top layer, không tổ tiên nào bắt được:

```html
<dialog id="hop-thoai">…</dialog>
```
```js
hopThoai.showModal();
```

---

## 3. `z-index` không hoạt động trên element `static`

```css
.st { width: 100px; height: 100px }
#a { background: red;  z-index: 99 }
#b { background: blue; margin-top: -50px }
```

```js
{ computed_z_index_cua_a: "99",              ← DevTools vẫn hiện 99
  position_cua_a: "static",
  element_o_tren_tai_diem_giao: "b" }        ← nhưng b vẫn đè lên a
```

Thêm `position: relative` cho `.st`:

```js
{ element_o_tren_tai_diem_giao: "a" }        ← giờ mới ăn
```

**Ngoại lệ quan trọng:** flex item và grid item **có** dùng được `z-index` dù vẫn là `static`:

```css
.fx { display: flex }
#x { background: red; z-index: 99; margin-right: -50px }
#y { background: blue }
```

```js
{ position_cua_x: "static",
  z_index_cua_x: "99",
  element_o_tren_tai_diem_giao: "x" }   ← ăn!
```

Bỏ `z-index` đi thì item sau đè lên item trước:

```js
{ element_o_tren_tai_diem_giao: "y" }
```

---

## 4. Stacking context — lý do thật sự của "z-index: 9999 vẫn thua"

Một **stacking context** là một "thế giới xếp lớp" độc lập. `z-index` của con **chỉ so với anh em
trong cùng thế giới**, không bao giờ so với element bên ngoài.

Nói cách khác: nếu cha bạn thua, thì con bạn dù có `z-index: 999999` cũng thua theo. Cả nhánh cây bị
đẩy xuống cùng nhau.

### Đo thật

```css
.p     { position: relative; width: 200px; height: 100px }
#po    { opacity: .99 }                                    /* ← chỉ thêm dòng này */
.child { position: absolute; width: 100px; height: 60px; background: red; z-index: 9999 }
.over  { position: absolute; width: 300px; height: 40px; background: blue; z-index: 1 }
```

```js
{ opacity_computed: "0.99",
  khong_opacity_diem_giao: "c1",     ← con z-index:9999 nằm trên .over
  co_opacity_diem_giao: "ov2" }      ← .over z-index:1 nằm trên con z-index:9999
```

`opacity: 0.99` — mắt thường không phân biệt được — làm đảo ngược hoàn toàn thứ tự lớp.

### Bảng đầy đủ: thuộc tính nào TẠO stacking context

Đo từng cái một, cùng một cấu trúc HTML:

```js
{ "không có gì":            { tao_stacking_context: false },
  "opacity: .99":           { tao_stacking_context: true  },
  "transform: scale(1)":    { tao_stacking_context: true  },
  "filter: blur(0)":        { tao_stacking_context: true  },
  "will-change: transform": { tao_stacking_context: true  },
  "isolation: isolate":     { tao_stacking_context: true  },
  "contain: paint":         { tao_stacking_context: true  },
  "mix-blend-mode":         { tao_stacking_context: true  },
  "backdrop-filter":        { tao_stacking_context: true  },
  "perspective: 1px":       { tao_stacking_context: true  },
  "position: fixed":        { tao_stacking_context: true  },
  "content-visibility:auto":{ tao_stacking_context: true  },
  "view-transition-name":   { tao_stacking_context: true  },
  "container-type":         { tao_stacking_context: false } }   ← đáng chú ý
```

Ngoài bảng trên còn hai trường hợp:
- `position: relative/absolute/sticky` **có** `z-index` khác `auto`
- Element gốc `<html>` (luôn là một stacking context)

`container-type: inline-size` **không** tạo stacking context — đây là tin tốt, vì nếu có thì container
query sẽ phá vỡ z-index của mọi component dùng nó.

### Cách debug

Khi `z-index` không ăn, đừng tăng số. Hãy đi ngược lên cây DOM từ element của bạn, và ở mỗi tổ tiên
kiểm tra 4 thứ: `opacity`, `transform`, `filter`, `will-change`.

Trong DevTools: chọn element → tab **Computed** → gõ `opacity` vào ô lọc → bấm mũi tên lên xem từng
tổ tiên.

Hoặc chạy đoạn này trong console:

```js
let e = document.querySelector('.bi-che');
while (e && e !== document.documentElement) {
  const s = getComputedStyle(e);
  const thu_pham = ['opacity','transform','filter','willChange','mixBlendMode','isolation','contain']
    .filter(k => s[k] && !['none','auto','normal','1'].includes(s[k]));
  if (thu_pham.length) console.log(e, thu_pham.map(k => k + ': ' + s[k]));
  e = e.parentElement;
}
```

### `isolation: isolate` — tạo stacking context mà không đổi hình

```css
#a { background: red;  position: relative; z-index: 1 }
#b { background: blue; position: relative; margin-top: -50px }
```

```js
{ truoc_khi_isolate: "a",                  ← a nằm trên b
  sau_khi_isolate:   "b",                  ← thêm isolation:isolate cho cha của a
  z_index_cua_a_van_la: "1" }
```

Đây là công cụ **cố ý** dùng để nhốt z-index của một component lại, đảm bảo nó không bao giờ đè lên
phần còn lại của trang:

```css
.component {
  isolation: isolate;    /* mọi z-index bên trong chỉ có ý nghĩa nội bộ */
}
```

Khác với `opacity: 0.99` hay `transform: translateZ(0)` — hai cách "vô tình" thường thấy — `isolation`
không có tác dụng phụ nào về hình ảnh hay hiệu năng.

### Quy ước z-index nên dùng

Đừng rải số ngẫu nhiên. Khai một thang ở một chỗ:

```css
:root {
  --z-nen:      0;
  --z-noi-dung: 1;
  --z-sticky:   10;
  --z-dropdown: 100;
  --z-modal:    1000;
  --z-toast:    10000;
}
.site-header { z-index: var(--z-sticky) }
```

Trong dự án ở [bài 11](./11-du-an-landing-page.md), giá trị `z-index` cao nhất toàn trang là **100**
(cho `.skip-link`), và header chỉ dùng **10**. Không cần tới 9999 nếu hiểu stacking context.

---

## 5. `position: sticky` — ba điều kiện, thiếu một là im lặng hỏng

```css
.scroller { height: 120px; overflow: auto }
.hid { overflow: hidden }
.sk  { position: sticky; top: 0 }
```

```js
{ ok:     { y_truoc: 1, y_sau_khi_cuon_100px:   1, con_dinh: true  },
  bad:    { y_truoc: 1, y_sau_khi_cuon_100px: -99, con_dinh: false },  ← tổ tiên overflow:hidden
  nothr:  { y_truoc: 1, y_sau_khi_cuon_100px: -99, con_dinh: false } } ← không khai top
```

### Điều kiện 1 — phải khai ít nhất một trong `top`/`right`/`bottom`/`left`

```css
position: sticky;          /* ❌ không có ngưỡng, không dính */
position: sticky; top: 0;  /* ✅ */
```

Đây là lỗi phổ biến nhất và tuyệt đối im lặng — không cảnh báo, không lỗi.

### Điều kiện 2 — không tổ tiên nào được có `overflow` khác `visible`

`overflow: hidden`, `auto`, `scroll` trên **bất kỳ** tổ tiên nào đều phá `sticky`. Kết quả đo ở trên:
element trong `.hid` trôi lên `-99` thay vì dính ở `1`.

Đây là lý do bạn hay thấy "sticky hoạt động trên CodePen nhưng không hoạt động trong dự án" — dự án có
một `overflow: hidden` đâu đó ở tầng trên, thường là để chặn margin collapsing (xem
[bài 02](./02-box-model.md) — đó là lý do nên dùng `display: flow-root` thay thế).

Cách tìm thủ phạm:

```js
let e = document.querySelector('.sticky-hong').parentElement;
while (e) {
  const o = getComputedStyle(e).overflow;
  if (o !== 'visible') console.log('THỦ PHẠM:', e, o);
  e = e.parentElement;
}
```

### Điều kiện 3 — cha phải cao hơn element sticky

`sticky` chỉ dính **trong phạm vi cha của nó**. Cha cao đúng bằng element thì không có chỗ nào để dính.
Đây là lý do sticky trong ô bảng hay không hoạt động.

### Chrome giúp bạn: badge `sticky`

Trong tab Elements, Chrome gắn nhãn `sticky` cạnh element. Bấm vào nó, DevTools chỉ thẳng ra tổ tiên
nào đang phá.

---

## 6. Căn giữa tuyệt đối — ba cách, cùng một kết quả

```css
.p { position: relative; width: 300px; height: 200px }
.c { position: absolute; width: 100px; height: 50px }

#m .c { inset: 0; margin: auto }
#t .c { top: 50%; left: 50%; transform: translate(-50%, -50%) }
#g    { display: grid; place-items: center }
```

```js
{ m: { le_trai: 101, le_tren: 76 },
  t: { le_trai: 101, le_tren: 76 },
  g: { le_trai: 101, le_tren: 76 } }     ← ba cách cho kết quả y hệt
```

Chọn cái nào:

| Cách | Ưu | Nhược |
|---|---|---|
| `inset: 0; margin: auto` | không dùng transform | **phải biết** width/height |
| `top/left: 50% + translate(-50%,-50%)` | không cần biết kích thước | tạo stacking context; chữ có thể mờ ở số lẻ |
| `display: grid; place-items: center` | ngắn nhất, không tác dụng phụ | phải bỏ `position: absolute` |

Cách 3 nên là mặc định. Chỉ dùng `absolute` khi thật sự cần element ra khỏi luồng.

---

## 7. `inset` và thuộc tính logic

```css
#a .c { inset: 10px auto auto 10px }              /* top right bottom left */
#b .c { inset-block-start: 10px; inset-inline-start: 10px }
#c    { direction: rtl }
#c .c { inset-inline-start: 10px }
```

```js
{ a: { le_trai:  11, le_tren: 11 },
  b: { le_trai:  11, le_tren: 11 },    ← giống hệt trong LTR
  c: { le_trai: 171, le_tren:  1 } }   ← RTL: "start" nhảy sang PHẢI
```

`inset: 0` là cách viết ngắn của `top:0; right:0; bottom:0; left:0` — dùng cực nhiều cho overlay:

```css
.lop-phu { position: fixed; inset: 0; background: rgb(0 0 0 / .5) }
```

---

## 8. Bảng so sánh 5 giá trị `position`

| Giá trị | Còn chiếm chỗ? | Neo vào | `top/left` tính từ |
|---|---|---|---|
| `static` | ✅ | — | không dùng được |
| `relative` | ✅ (chỗ cũ) | chính nó | vị trí gốc của nó |
| `absolute` | ❌ | tổ tiên đã định vị gần nhất | mép của tổ tiên đó |
| `fixed` | ❌ | viewport (trừ khi bị `transform` bắt) | mép viewport |
| `sticky` | ✅ | tổ tiên cuộn gần nhất | ngưỡng bạn khai |

Điểm hay quên: **`relative` vẫn chiếm chỗ cũ**. Dịch nó đi 100px thì chỗ trống 100px vẫn nằm nguyên
đó. Muốn không chiếm chỗ thì dùng `absolute` hoặc `transform: translate()`.

---

## Bài tập

1. Cho HTML 3 tầng: `.a > .b > .c`, `.c` có `position: absolute; top: 0`. `.a` có
   `position: relative`. Thêm `position: relative` cho `.b` — vị trí `.c` đổi thế nào? Đo để kiểm chứng.

2. Modal `position: fixed; inset: 0` của bạn đột nhiên nằm sai chỗ sau khi thêm
   `transform: scale(1.02)` cho card cha khi hover. Giải thích và nêu 2 cách sửa.

3. Chứng minh `z-index: 500` trên element `static` không có tác dụng, dùng cả `getComputedStyle` và
   `elementFromPoint`.

4. Cho cấu trúc: `.header { opacity: .95 }` chứa `.dropdown { z-index: 9999 }`, và một `.modal
   { z-index: 100 }` là anh em của `.header`. Cái nào hiện trên? Sửa thế nào?

5. Viết script console đi ngược cây DOM tìm tổ tiên nào tạo stacking context.

6. Header `position: sticky; top: 0` của bạn không dính. Liệt kê 3 nguyên nhân có thể và cách kiểm tra
   từng cái.

7. Căn giữa một `<div>` chưa biết kích thước trong một `<div>` 400×300. Nêu 3 cách, chỉ ra cách nào
   tạo stacking context.

8. Trong dự án của bạn, tìm `z-index` lớn nhất. Nó có thực sự cần lớn thế không? Viết lại bằng thang
   biến ở mục 4.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Trước khi thêm: `.c` neo vào `.a`. Sau khi thêm: `.c` neo vào `.b`. Nếu `.b` có `margin` hay
`padding` thì `.c` sẽ nhảy đúng bằng lượng đó.

**2.** `transform` biến `.card` thành containing block cho mọi con `fixed`. Modal giờ neo vào card thay
vì viewport. Sửa: (a) đưa modal ra ngoài card bằng portal/`<Teleport>`; (b) dùng thẻ `<dialog>` +
`showModal()` — nó nằm ở top layer, không tổ tiên nào bắt được.

**3.** `getComputedStyle(el).zIndex` trả `"500"`, `getComputedStyle(el).position` trả `"static"`, và
`elementFromPoint` tại chỗ chồng lấn trả về element **phía sau**.

**4.** `.modal` hiện trên. `opacity: .95` biến `.header` thành stacking context, nhốt `.dropdown` bên
trong; hai stacking context được so với nhau bằng z-index của `.header` (auto = 0) so với `.modal`
(100). Sửa: bỏ `opacity` khỏi `.header` (dùng `background: rgb(255 255 255 / .95)` thay thế), hoặc đưa
dropdown ra ngoài header.

**6.** (a) Thiếu `top`/`bottom` — kiểm tra `getComputedStyle(el).top !== 'auto'`.
(b) Tổ tiên có `overflow` khác `visible` — chạy vòng lặp ở mục 5.
(c) Cha cao đúng bằng element nên không có quãng để dính — so `el.offsetHeight` với
`el.parentElement.offsetHeight`.

**7.** (a) `display: grid; place-items: center` — không tạo stacking context.
(b) `display: flex; align-items: center; justify-content: center` — không tạo.
(c) `position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%)` — **có** tạo, vì
`transform`.

</details>

---

Tiếp theo: [07-responsive-va-container-query.md](./07-responsive-va-container-query.md)
