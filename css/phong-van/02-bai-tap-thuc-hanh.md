# 18 bài tập gõ tay

Một số buổi phỏng vấn yêu cầu viết CSS trực tiếp — trên giấy, trên bảng trắng, hoặc trong CodePen không
có gợi ý tự động.

**Cách luyện:** tự làm hết trước, rồi mới mở đáp án. Với bài có 🖊 thì làm **trên giấy** — không mở
trình duyệt, không tra cứu.

---

## Nhóm A — Layout cơ bản

### Bài 1 🖊 — Căn giữa hoàn hảo

Căn giữa một `<div>` **chưa biết kích thước** trong một container 400×300. Viết **ba** cách. Chỉ ra
cách nào tạo stacking context.

<details><summary>Đáp án</summary>

```css
/* Cách 1 — ngắn nhất, không tác dụng phụ */
.cha { display: grid; place-items: center }

/* Cách 2 */
.cha { display: flex; align-items: center; justify-content: center }

/* Cách 3 — TẠO stacking context (vì transform) */
.cha { position: relative }
.con { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) }
```

Cả ba cho kết quả y hệt: `{ le_trai: 101, le_tren: 76 }`.

Cách 3 là cách duy nhất tạo stacking context, và chữ có thể bị mờ nếu vị trí rơi vào số lẻ pixel.

</details>

### Bài 2 🖊 — Navbar

Viết CSS cho navbar: logo bên trái, menu ở giữa-phải, nút "Đăng nhập" sát mép phải. Không dùng
`position`.

<details><summary>Đáp án</summary>

```css
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;              /* thà xuống dòng còn hơn tràn ngang */
}
.nav nav { margin-inline-start: auto }   /* đẩy nav và mọi thứ sau nó sang phải */
```

`margin-inline-start: auto` nuốt hết không gian thừa. Đo được: item cuối dính sát mép phải
(`phai_cua_item_cuoi: 400` với container 400px).

Không dùng `justify-content: space-between` vì nó sẽ dàn đều cả 3 nhóm.

`flex-wrap: wrap` là dòng cứu bạn ở màn 320px — đây chính là lỗi tôi mắc trong dự án ở bài 11.

</details>

### Bài 3 — Layout app 3 phần cuộn được

Header cố định, vùng nội dung cuộn, footer cố định. Chiều cao đúng bằng màn hình.

<details><summary>Đáp án</summary>

```css
.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;              /* dvh chứ không vh — mobile */
}
.app > header,
.app > footer { flex: none }
.app > main   { flex: 1; overflow: auto }   /* overflow là dòng quyết định */
```

Không có `overflow: auto`, vùng giữa sẽ **phình ra ngoài container**:

```js
{ chi_flex_1: { container_khai_bao: 200, mid_cao: 600, con_tran_khoi_container: true } }
```

Vì `min-height` mặc định của flex item là `auto`. `overflow` khác `visible` tự đặt min-size về 0 nên
không cần thêm `min-height: 0`.

</details>

### Bài 4 — Lưới card responsive, không media query

Lưới card tự đổi số cột theo bề rộng. Card tối thiểu 260px. Không được dùng `@media`.

<details><summary>Đáp án</summary>

```css
.luoi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 1.5rem;
}
```

`min(100%, 260px)` là phần quan trọng. Không có nó, lưới **tràn** khi container hẹp hơn 260px:

```js
{ w1: { container: 150, track: "200px", tran: true } }     ← minmax(200px, 1fr)
{ w1: { container: 150, track: "150px", tran: false } }    ← minmax(min(100%,200px), 1fr)
```

Đo trên dự án thật: số cột tự đổi 1 → 2 → 3 từ 320px tới 1920px.

</details>

### Bài 5 🖊 — Ô text co được có dấu ba chấm

Hàng flex: avatar (không co), tên (co được, cắt bằng `…`), nút Xoá (không co).

<details><summary>Đáp án</summary>

```css
.row { display: flex; align-items: center; gap: .5rem }

.avatar { flex: none; width: 40px; aspect-ratio: 1; object-fit: cover }

.ten {
  flex: 1;
  min-width: 0;                /* ← không có dòng này thì không co */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

button { flex: none }
```

Thiếu `min-width: 0` thì ô tên rộng bằng cả chuỗi:
```js
{ mac_dinh: { a_rong: 296.6, a_min_width_computed: "auto", tran: true } }
```

Thực ra `overflow: hidden` đã tự đặt min-size về 0, nên `min-width: 0` là thừa ở đây — nhưng viết cả
hai thì rõ ràng hơn cho người đọc.

</details>

---

## Nhóm B — Grid

### Bài 6 🖊 — Holy grail

Header full width, sidebar trái 200px, main co giãn, aside phải 250px, footer full width. Dùng
`grid-template-areas`.

<details><summary>Đáp án</summary>

```css
.trang {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 250px;
  grid-template-areas:
    "head head  head"
    "side main  aside"
    "foot foot  foot";
  gap: 1rem;
  min-height: 100dvh;
}
.head  { grid-area: head }
.side  { grid-area: side }
.main  { grid-area: main }
.aside { grid-area: aside }
.foot  { grid-area: foot }

@media (width < 800px) {
  .trang {
    grid-template-columns: 1fr;
    grid-template-areas: "head" "main" "side" "aside" "foot";
  }
}
```

Chú ý `minmax(0, 1fr)` cho cột main — nếu chỉ `1fr`, nội dung dài không ngắt được sẽ đẩy cột phình ra:
```js
{ '1fr_1fr': { track: "355.5px 44.5px" } }
```

Ưu điểm của `grid-template-areas`: đổi layout ở breakpoint chỉ cần vẽ lại bức tranh ASCII, không đụng
vào item nào.

</details>

### Bài 7 — Card thẳng hàng bằng subgrid

3 card, mỗi card có tiêu đề / mô tả / chân. Tiêu đề dài ngắn khác nhau. Làm cho **cả ba phần** của 3
card thẳng hàng nhau.

<details><summary>Đáp án</summary>

```css
.wrap {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto 1fr auto;    /* định nghĩa 3 hàng ở CHA */
  gap: 1rem;
}
.card {
  grid-row: span 3;                     /* card chiếm đúng 3 hàng đó */
  grid-template-rows: subgrid;          /* dùng luôn hàng của ông nội */
  display: grid;
}
```

```js
{ grid_thuong: { y_cua_p: [22, 44, 22] },     ← lệch
  subgrid:     { y_cua_p: [54, 54, 54] } }    ← thẳng hàng
```

Không có subgrid thì chỉ làm được phần **chân** thẳng hàng (bằng `grid-template-rows: auto 1fr auto`
trên card) — phần mô tả vẫn lệch.

</details>

### Bài 8 — Banner chồng lớp không dùng `absolute`

Ảnh nền, chữ đè lên giữa. Banner phải cao đúng bằng ảnh.

<details><summary>Đáp án</summary>

```css
.banner { display: grid }
.banner > * { grid-area: 1 / 1 }        /* mọi con vào cùng một ô */
.banner img { width: 100%; height: 100%; object-fit: cover }
.banner .chu { place-self: center; z-index: 1 }
```

```js
{ banner: { w: 300, h: 100 }, anh: { w: 300, h: 100 },
  chu_o_giua: { x: 114.8, y: 41 }, banner_cao_bang_anh: true }
```

Ưu điểm so với `position: absolute`: **lưới vẫn cao bằng con cao nhất**. Với `absolute`, chữ ra khỏi
luồng nên banner sẽ cao 0 nếu không có ảnh.

</details>

### Bài 9 🖊 — Bài viết có khối tràn viền

Nội dung bài viết rộng tối đa 65ch căn giữa, nhưng vài khối (ảnh lớn, bảng) tràn hết chiều rộng trang.

<details><summary>Đáp án</summary>

```css
.bai-viet {
  display: grid;
  grid-template-columns: 1fr min(65ch, 100%) 1fr;
}
.bai-viet > *          { grid-column: 2 }        /* mặc định: cột giữa */
.bai-viet > .tran-vien { grid-column: 1 / -1 }   /* ngoại lệ: trải hết */
```

Cột 1 và 3 là `1fr` nên tự chia đều phần thừa → cột giữa luôn ở chính giữa.

`min(65ch, 100%)` đảm bảo trên màn hẹp cột giữa không vượt quá bề rộng trang.

`1 / -1` đọc là "từ đường đầu tới đường cuối" — không cần biết có mấy cột.

</details>

---

## Nhóm C — Component

### Bài 10 — Nút có biến thể

Viết `.btn` với 3 biến thể (`solid`, `ghost`, `nguy-hiem`) và 2 cỡ (`nho`, `to`). Dùng biến CSS, không
lặp lại code.

<details><summary>Đáp án</summary>

```css
.btn {
  --btn-nen: var(--nhan);
  --btn-chu: var(--nhan-chu);
  --btn-vien: transparent;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5em;

  font-size: 1rem;
  padding: .75em 1.5em;         /* em -> tự co theo font-size của nút */
  border: 1px solid var(--btn-vien);
  border-radius: .5rem;
  background: var(--btn-nen);
  color: var(--btn-chu);
  cursor: pointer;
  transition: background 160ms, border-color 160ms;

  &:hover  { background: color-mix(in oklch, var(--btn-nen) 88%, black) }
  &:active { scale: .98 }
}

.btn--ghost {
  --btn-nen: transparent;
  --btn-chu: var(--chu);
  --btn-vien: var(--vien);
}
.btn--nguy-hiem { --btn-nen: crimson }

.btn--nho { font-size: .875rem }    /* padding tự nhỏ theo, không khai lại */
.btn--to  { font-size: 1.125rem }
```

Hai ý quan trọng:

1. **`padding` dùng `em`** — nó tính theo font-size của **chính nút**, nên đổi cỡ chữ là padding tự co
   theo. Đo được: `font-size: 2em; padding: 1em` cho `padding: "20px"` khi cha là 10px.
2. **Biến thể chỉ đổi biến**, không viết lại thuộc tính. Thêm biến thể mới = thêm 1 dòng.

Dùng `scale: .98` chứ không `transform: scale(.98)` — để không ghi đè `translate` nếu có.

</details>

### Bài 11 — Accordion mượt

`<details>` mở/đóng có hiệu ứng trượt. Không dùng JavaScript, không dùng `max-height`.

<details><summary>Đáp án</summary>

```css
details {
  interpolate-size: allow-keywords;
  border: 1px solid var(--vien);
  border-radius: .5rem;

  &::details-content {
    block-size: 0;
    overflow: hidden;
    transition: block-size 320ms ease,
                content-visibility 320ms allow-discrete;
  }
  &[open]::details-content { block-size: auto }

  & summary {
    padding: 1rem;
    cursor: pointer;
    list-style: none;
    &::-webkit-details-marker { display: none }
    &::after { content: "+"; float: inline-end; transition: rotate 160ms }
  }
  &[open] > summary::after { rotate: 45deg }    /* "+" thành "×" */
}
```

```js
{ cao_khi_dong: 60, cao_o_giua_120ms: 103, cao_khi_mo_xong: 109, co_animate: true }
```

Thêm `name="faq"` vào các thẻ `<details>` trong HTML để thành accordion loại trừ (mở cái này đóng cái
kia) — cũng không cần JS.

⚠️ Nhớ thêm `*::details-content` vào khối `prefers-reduced-motion`, nếu không hiệu ứng vẫn chạy khi
người dùng đã tắt.

</details>

### Bài 12 — Modal có hiệu ứng vào/ra

`<dialog>` mở và đóng đều có hiệu ứng mờ + trượt. **Không dùng `setTimeout`.**

<details><summary>Đáp án</summary>

```css
dialog {
  opacity: 1;
  translate: 0 0;
  transition: opacity 300ms, translate 300ms,
              display 300ms allow-discrete,
              overlay 300ms allow-discrete;
}

/* trạng thái đóng */
dialog:not([open]) { opacity: 0; translate: 0 -20px }

/* trạng thái lúc VỪA mở */
@starting-style {
  dialog[open] { opacity: 0; translate: 0 -20px }
}

dialog::backdrop {
  background: rgb(0 0 0 / .5);
  transition: background 300ms, display 300ms allow-discrete,
              overlay 300ms allow-discrete;
}
@starting-style { dialog[open]::backdrop { background: rgb(0 0 0 / 0) } }
```

```js
hopThoai.showModal();   // toàn bộ JS cần thiết
```

Ba tính năng phối hợp:
- `allow-discrete` giữ `display: block` suốt lúc đóng → kịp mờ dần
- `overlay` giữ element ở top layer trong lúc animate
- `@starting-style` cho hiệu ứng lúc mở

Đo lúc đóng: `{ b_display: "block", b_opacity: "0.197713" }` — không có `allow-discrete` thì
`{ a_display: "none", a_opacity: "0" }`.

Bonus: `<dialog>` nằm ở **top layer** nên không bị `transform` của tổ tiên bắt lại.

</details>

### Bài 13 🖊 — Thanh tiến trình đọc

Thanh ngang dưới header, chạy từ 0 tới 100% theo tiến trình cuộn trang. Không dùng JavaScript.

<details><summary>Đáp án</summary>

```css
.progress {
  height: 3px;
  background: var(--nhan);
  transform-origin: left;
  scale: 0 1;
  animation: chay-ngang linear;
  animation-timeline: scroll(root block);
}
@keyframes chay-ngang { to { scale: 1 1 } }
```

```js
{ be_rong_bar: { "0%": 0, "25%": 100.4, "50%": 200, "75%": 300.4, "100%": 400 } }
```

Ba điểm dễ quên:
1. `transform-origin: left` — không có thì thanh giãn từ giữa ra hai bên
2. `scale: 0 1` là trạng thái ban đầu, `@keyframes` chỉ cần `to`
3. `animation-timeline: scroll(root block)` — `root` là trang, `block` là trục dọc

Chạy trên compositor thread nên không giật kể cả khi JS đang bận.

</details>

---

## Nhóm D — Nâng cao

### Bài 14 — Card đổi layout theo bề rộng ô chứa

Card xếp dọc khi ô chứa hẹp, xếp ngang khi rộng. **Không phụ thuộc bề rộng cửa sổ.**

<details><summary>Đáp án</summary>

```html
<li class="card-slot">          <!-- container -->
  <article class="card">        <!-- thứ được style -->
    <img><h3>…</h3><p>…</p>
  </article>
</li>
```
```css
.card-slot { container-type: inline-size; display: grid }

.card {
  display: grid;
  gap: .75rem;
  height: 100%;
}

@container (width >= 340px) {
  .card {
    grid-template-columns: auto 1fr;
    & img { grid-row: 1 / span 3 }
  }
}
```

⚠️ **Bẫy:** đặt `container-type` ngay trên `.card` rồi query `.card` sẽ **không bao giờ ăn** — container
query không style được chính element khai `container-type`. Phải tách hai tầng.

```js
{ background_cua_chinh_no: "rgb(238, 238, 238)",   ← không đổi
  background_cua_con: "rgb(0, 255, 0)" }           ← đổi
```

Chọn ngưỡng 340px dựa trên **số đo thật** (card ở lưới 3 cột tại 1280px rộng 364px), không đoán.

`height: 100%` trên `.card` cần thêm vì giờ nó không còn là grid item trực tiếp của lưới.

</details>

### Bài 15 — Chế độ tối có nút đổi

Trang tự theo hệ điều hành, nhưng có nút cho người dùng đổi thủ công, và ghi nhớ lựa chọn.

<details><summary>Đáp án</summary>

```css
:root {
  color-scheme: light dark;
  --nen: light-dark(oklch(0.99 0.005 250), oklch(0.19 0.02 255));
  --chu: light-dark(oklch(0.25 0.02 255),  oklch(0.95 0.01 250));
}

/* CẦU NỐI — thiếu hai dòng này thì nút không có tác dụng gì */
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }

body { background: var(--nen); color: var(--chu) }
```

```js
const nut = document.getElementById('doi-theme');
const goc = document.documentElement;

const heDieuHanhToi = matchMedia('(prefers-color-scheme: dark)').matches;
const dat = toi => {
  goc.dataset.theme = toi ? 'dark' : 'light';
  nut.setAttribute('aria-pressed', String(toi));
};

const daLuu = localStorage.getItem('theme');
dat(daLuu ? daLuu === 'dark' : heDieuHanhToi);    // ← khởi tạo từ hệ điều hành

nut.addEventListener('click', () => {
  const dangToi = goc.dataset.theme === 'dark';
  dat(!dangToi);
  localStorage.setItem('theme', dangToi ? 'light' : 'dark');
});
```

Hai lỗi kinh điển, tôi mắc cả hai khi làm dự án ở bài 11:

1. **Thiếu cầu nối `data-theme` → `color-scheme`.** `light-dark()` chỉ đọc `color-scheme`.
2. **JS mặc định coi trạng thái đầu là "sáng".** Người dùng đang ở chế độ tối bấm nút lần đầu sẽ thấy
   **không có gì xảy ra**.

</details>

### Bài 16 — Animate gradient

Nền gradient xoay 180° khi hover. Gradient bình thường không animate được.

<details><summary>Đáp án</summary>

```css
@property --goc {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.the {
  background: linear-gradient(var(--goc), #4d90fe, #a855f7);
  transition: --goc 600ms ease;
}
.the:hover { --goc: 180deg }
```

Không có `@property`, biến CSS chỉ là **chuỗi ký tự** với trình duyệt — nó không biết `0deg` và `180deg`
là hai số để nội suy, nên nhảy thẳng:

```js
{ o_giua_animation: { co_property: 91.7, khong_property: 200 } }
```

`syntax` phải khớp kiểu giá trị: `<angle>`, `<length>`, `<color>`, `<number>`, `<percentage>`,
`<time>`.

</details>

### Bài 17 🖊 — Sọc vằn đúng khi có dòng bị ẩn

Bảng có bộ lọc, dòng không khớp bị `display: none`. Sọc vằn phải đúng theo cái **mắt người thấy**.

<details><summary>Đáp án</summary>

```css
tr:nth-child(odd of :not(.an)) { background: #f5f5f5 }
```

Đo với 4 dòng, dòng 2 bị ẩn:
```js
{ li1: "rgb(200, 220, 255)",   ← sọc
  li2: "(ẩn)",
  li3: "rgb(255, 255, 255)",   ← không sọc
  li4: "rgb(200, 220, 255)" }  ← sọc (là dòng hiện thứ 3)
```

`:nth-child(odd)` thường sẽ tô li1 và li3 — sai, vì mắt người thấy 3 dòng và li3 là dòng thứ **hai**.

`CSS.supports('selector(:nth-child(2 of .x))')` → `true` trên Chrome 152.

</details>

### Bài 18 — Reset CSS tối thiểu

Viết file reset ~25 dòng cho một dự án mới. Giải thích từng dòng.

<details><summary>Đáp án</summary>

```css
@layer reset {
  /* border-box cho mọi thứ. Phải có cả pseudo-element — `*` không khớp chúng. */
  *, *::before, *::after { box-sizing: border-box }

  /* Bỏ margin mặc định, sẽ tự đặt lại ở layer base */
  body, h1, h2, h3, p, ul, figure { margin: 0 }

  /* list-style: none làm Safari mất ngữ nghĩa list -> HTML phải có role="list" */
  ul[role="list"] { padding: 0; list-style: none }

  /* display:block xoá khoảng trắng 4px dưới ảnh (do baseline) */
  img, svg { display: block; max-width: 100% }
  img { height: auto }

  /* Form control không kế thừa font — phải khai tay */
  input, button, select, textarea { font: inherit; color: inherit }

  /* Cỡ chữ người dùng đặt trong trình duyệt phải được tôn trọng */
  :root { color-scheme: light dark }

  /* Người bị rối loạn tiền đình có thể chóng mặt thật vì animation.
     `1ms` chứ không `0s` — để transitionend/animationend vẫn bắn.
     Phải liệt kê từng pseudo-element, `*` không phủ chúng. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after, *::details-content, *::backdrop {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

Những thứ **không** nên có trong reset:

- `* { margin: 0; padding: 0 }` — xoá cả padding của `<ul>`, `<ol>`, gây phiền hơn là giúp
- `html { font-size: 62.5% }` — ghi đè cỡ chữ người dùng cố ý đặt lớn
- `* { transition: all }` — chi phí vô ích cho mọi element
- `a { text-decoration: none }` — xoá tín hiệu "đây là link" cho người dùng

</details>

---

Tiếp theo: [03-tinh-huong-debug.md](./03-tinh-huong-debug.md)
