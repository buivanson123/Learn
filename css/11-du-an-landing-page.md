# Bài 11 — Dự án: landing page bằng CSS thuần

Bài này dựng một trang landing hoàn chỉnh từ đầu, dùng gần như mọi thứ trong 10 bài trước. Code nằm ở
[`du-an/landing/`](./du-an/landing/).

Phần đáng giá nhất của bài này là **mục 6: năm lỗi tôi thực sự mắc phải** khi làm trang này, kèm số đo
lúc hỏng và lúc sửa xong. Đọc kỹ phần đó hơn phần code.

---

## 1. Kết quả

```
index.html   161 dòng
styles.css   491 dòng      ← không dùng thư viện nào
             18 dòng JS    ← chỉ để NHỚ lựa chọn nền, không liên quan đến hiệu ứng
```

Chạy thử:

```bash
$ cd du-an/landing
$ python3 -m http.server 8123
$ open http://localhost:8123
```

Ba ảnh chụp có sẵn trong thư mục: `anh-chup-desktop-sang.png`, `anh-chup-desktop-toi.png`,
`anh-chup-mobile-sang.png`.

Kiểm chứng trên 10 bề rộng màn hình — **không tràn ngang ở đâu**:

```
    320px  tràn=không  cao= 3932  h1=   32px  cột-card=1  hero=272px
    375px  tràn=không  cao= 3871  h1= 32.9px  cột-card=1  hero=327px
    414px  tràn=không  cao= 3692  h1=33.99px  cột-card=1  hero=366px
    600px  tràn=không  cao= 3327  h1= 39.2px  cột-card=2  hero=552px
    768px  tràn=không  cao= 3316  h1=43.90px  cột-card=2  hero=720px
    900px  tràn=không  cao= 2446  h1= 47.6px  cột-card=3  hero=399.5px 380.5px
   1024px  tràn=không  cao= 2377  h1=51.07px  cột-card=3  hero=463px 441px
   1280px  tràn=không  cao= 2289  h1=   52px  cột-card=3  hero=547px 521px
   1920px  tràn=không  cao= 2289  h1=   52px  cột-card=3  hero=547px 521px
```

Số cột card đổi 1 → 2 → 3 và cỡ chữ `h1` đi từ 32px lên 52px **mà chỉ có 3 media query trong cả file**
— và không cái nào trong ba cái đó lo việc này.

---

## 2. Kiến trúc: 6 layer

```css
@layer reset, token, base, layout, component, utility;
```

Đọc lại từ trình duyệt để chắc thứ tự đúng:

```js
[...s.cssRules].filter(r => r.constructor.name === 'CSSLayerBlockRule').map(r => r.name)
-> ["reset", "token", "base", "layout", "component", "utility"]
```

| Layer | Nhiệm vụ | Ví dụ |
|---|---|---|
| `reset` | đè mặc định trình duyệt | `box-sizing`, bỏ margin, `prefers-reduced-motion` |
| `token` | chỉ khai biến, không sinh rule | `--nhan`, `--kc-5`, `--cx-6` |
| `base` | style cho thẻ trần | `body`, `h1`, `a`, `:focus-visible` |
| `layout` | khung trang | `.shell`, `.section`, `.site-header`, `.hero` |
| `component` | phần lớn code | `.btn`, `.card`, `.plan`, `details` |
| `utility` | thắng tất cả | `.an-di` |

Nhờ thứ tự này, `.btn` (layer `component`) luôn đè được `a` (layer `base`) mà không cần viết `a.btn`
hay `!important` — dù `a` có specificity `(0,0,1)` và `.btn` là `(0,1,0)` thì cũng chẳng cần so.

---

## 3. Những chỗ đáng đọc trong CSS

### 3.1 `.shell` — một dòng thay cho ba

```css
.shell {
  width: min(100% - var(--kc-5) * 2, var(--do-rong-trang));
  margin-inline: auto;
}
```

Thay thế mẫu cũ `max-width: 1140px; margin: 0 auto; padding: 0 1.5rem`, và không có lỗi cộng padding vào
max-width. Đo:

```
viewport  320 -> { rộng: 272,  lề trái:  24 }
viewport  768 -> { rộng: 720,  lề trái:  24 }
viewport 1280 -> { rộng: 1140, lề trái:  70 }
viewport 1600 -> { rộng: 1140, lề trái: 230 }
```

### 3.2 Lưới card — 3 dòng, 0 media query

```css
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--kc-5);
}
```

`min(100%, 260px)` là phần quan trọng: nó chặn bẫy ở [bài 05](./05-grid.md) — `minmax(260px, 1fr)`
trần sẽ tràn khi container hẹp hơn 260px.

### 3.3 Card tự đổi layout theo bề rộng CỦA NÓ

```html
<li class="card-slot">        <!-- container -->
  <article class="card">      <!-- thứ được style -->
```
```css
.card-slot { container-type: inline-size; display: grid }

.card {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  height: 100%;
}

@container (width >= 340px) {
  .card {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto auto;
    column-gap: var(--kc-4);
    & .card__icon { grid-row: 1 / span 3; align-self: start }
  }
}
```

Đo bằng cách ép card hẹp lại ở cùng viewport 1280px:

```
card rộng 364px -> grid-template-columns: 40px 258px   icon grid-row: 1 / span 3
card rộng 500px -> grid-template-columns: 40px 394px   icon grid-row: 1 / span 3
card rộng 379px -> grid-template-columns: 40px 273px   icon grid-row: 1 / span 3
card rộng 300px -> grid-template-columns: 250px        icon grid-row: auto
```

Cùng cửa sổ, khác layout. Card này đặt vào sidebar hẹp hay vùng chính rộng đều đúng.

### 3.4 Thanh tiến trình đọc — 0 dòng JS

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
{ chieu_cao_cuon: 1389, be_rong_bar: { "0%": 0, "50%": 640, "100%": 1280 } }
```

### 3.5 Accordion mượt — cũng 0 dòng JS

```css
details {
  interpolate-size: allow-keywords;

  &::details-content {
    block-size: 0;
    overflow: hidden;
    transition: block-size var(--vua) var(--duong-cong),
                content-visibility var(--vua) allow-discrete;
  }
  &[open]::details-content { block-size: auto }

  & summary::after { content: "+"; transition: rotate var(--nhanh) }
  &[open] > summary::after { rotate: 45deg }     /* "+" xoay thành "×" */
}
```

```js
{ cao_khi_dong: 60, cao_o_giua_120ms: 103, cao_khi_mo_xong: 109, co_animate: true }
```

Thuộc tính `name="faq"` trên các thẻ `<details>` trong HTML biến chúng thành accordion loại trừ — mở
cái này thì cái kia tự đóng. Cũng không cần JS.

### 3.6 Chế độ tối

```css
:root {
  color-scheme: light dark;
  --nen: light-dark(oklch(0.99 0.005 250), oklch(0.19 0.02 255));
  --chu: light-dark(oklch(0.25 0.02 255),  oklch(0.95 0.01 250));
  /* ... */
}
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

```
hệ thống=light -> nền oklch(0.99 0.005 250) | bấm nút: theme=dark  nền oklch(0.19 0.02 255)
hệ thống=dark  -> nền oklch(0.19 0.02 255)  | bấm nút: theme=light nền oklch(0.99 0.005 250)
```

Mỗi màu khai **một dòng** thay vì hai bảng màu riêng.

---

## 4. Phần tiếp cận (accessibility) — 6 điểm

Không phải phần "làm thêm nếu có thời gian". Mỗi điểm dưới đây là một dòng CSS hoặc một thuộc tính HTML.

```css
/* 1. Chỉ hiện viền focus khi dùng bàn phím, không hiện khi bấm chuột */
:focus-visible { outline: 2px solid var(--nhan); outline-offset: 3px }

/* 2. Link "bỏ qua tới nội dung" — ẩn nhưng vẫn Tab tới được */
.skip-link {
  position: absolute; inset-inline-start: var(--kc-4); inset-block-start: var(--kc-4);
  transform: translateY(-200%);                 /* ẩn khỏi màn hình */
  transition: transform var(--nhanh);
  &:focus-visible { transform: translateY(0) }  /* hiện khi Tab tới */
}

/* 3. Tôn trọng người tắt hiệu ứng.
      Phải liệt kê cả ::details-content — xem Lỗi 5 ở mục 6. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after, *::details-content, *::backdrop {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}

/* 4. Header sticky không che tiêu đề khi bấm link #anchor */
html { scroll-padding-top: calc(var(--kc-9) + var(--kc-2)) }

/* 5. Ảnh giữ chỗ -> nội dung không nhảy khi ảnh tải xong */
.hero__media img { aspect-ratio: 16 / 10; object-fit: cover }

/* 6. Dòng chữ không quá dài */
p { max-width: 68ch }
```

Trong HTML:

```html
<nav aria-label="Điều hướng chính">                  <!-- phân biệt khi có nhiều nav -->
<ul class="cards" role="list">                       <!-- giữ ngữ nghĩa list khi bỏ bullet -->
<section aria-labelledby="tt"><h2 id="tt">…</h2>     <!-- đặt tên cho vùng -->
<span class="card__icon" aria-hidden="true">⌘</span> <!-- icon trang trí, không đọc -->
<button aria-pressed="false" aria-label="Đổi giữa nền sáng và nền tối">
```

Chú ý `role="list"` trên `<ul>`: khi bạn đặt `list-style: none`, Safari **bỏ ngữ nghĩa danh sách** của
nó. Thêm `role="list"` để giữ lại.

Và `.nhan-nut` — nhãn chữ của nút đổi nền — bị ẩn dưới 560px, nhưng nút vẫn có `aria-label` nên trình
đọc màn hình không mất thông tin.

---

## 5. Cách tự kiểm tra một trang trước khi giao việc

Script này chạy được trên bất kỳ trang nào. Nó là thứ tìm ra 4 lỗi ở mục 6.

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });

  // 1. Lỗi console
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const loi = [];
  p.on('console', m => { if (m.type() === 'error') loi.push(m.text()) });
  p.on('pageerror', e => loi.push('pageerror: ' + e.message));
  await p.goto('http://localhost:8123/', { waitUntil: 'load' });
  console.log('lỗi console:', loi.length ? loi : 'không có');

  // 2. Tràn ngang ở mọi viewport
  for (const w of [320, 375, 414, 600, 768, 900, 1024, 1280, 1600, 1920]) {
    const q = await b.newPage({ viewport: { width: w, height: 800 } });
    await q.goto('http://localhost:8123/', { waitUntil: 'load' });
    const r = await q.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    console.log(w + 'px', r.scrollWidth > r.clientWidth ? 'TRÀN ⚠️' : 'ok');
    await q.close();
  }
  await b.close();
})();
```

Khi phát hiện tràn, tìm thủ phạm:

```js
const vw = document.documentElement.clientWidth;
for (const e of document.querySelectorAll('*')) {
  const r = e.getBoundingClientRect();
  if (r.right > vw + 0.5) console.log(e.tagName, e.className, r.right, getComputedStyle(e).minWidth);
}
```

---

## 6. Bốn lỗi tôi mắc phải, và cách tìm ra chúng

Đây là phần thật nhất của bài. Trang này **không** chạy đúng ngay lần đầu.

### Lỗi 1 — tràn ngang ở 320px

Kết quả lần chạy đầu:

```
    320px  tràn=CÓ ⚠️  cao= 4058  h1=32px  cột-card=1
    375px  tràn=không
```

Chỉ hỏng ở đúng 320px — tức là màn hình nhỏ nhất còn phải hỗ trợ. Chạy script tìm thủ phạm:

```js
{ viewport: 320, tong_tran: 1,
  thu_pham: [ { the: "button.btn", left: 254.4, right: 352.6,
                rong: 98.2, minWidth: "auto" } ] }
```

Nhìn vào bên trong `.nav`:

```js
{ nav_rong: 272, nav_scrollWidth: 329,
  con: [ { the: "a.logo",     rong: 51.3,  minWidth_computed: "auto" },
         { the: "nav",        rong: 131,   minWidth_computed: "auto" },
         { the: "button.btn", rong: 98.2,  minWidth_computed: "auto" } ] }
```

`.nav` có 272px nhưng nội dung cần 329px. Ba flex item đều có `min-width: auto` nên **không cái nào
chịu co** — đúng cái bẫy ở [bài 04](./04-flexbox.md), gặp ngay trong code của chính mình.

**Cách sửa** — cho phép xuống dòng, thu gap, và bỏ nhãn chữ của nút trên màn hẹp:

```css
.nav {
  flex-wrap: wrap;              /* thà xuống dòng còn hơn tràn ngang */
  gap: var(--kc-3) var(--kc-5);
}
.nav-list { gap: var(--kc-3) }  /* từ --kc-5 xuống --kc-3 */

.nhan-nut { display: none }
@media (width >= 560px) { .nhan-nut { display: inline } }
```

Tính lại: 51.3 (logo) + 131 (nav) + ~40 (nút chỉ còn icon) + 24 (gap) = 246 < 272. ✅

### Lỗi 2 — nút đổi nền không đổi được nền

```
hệ thống=light -> nền oklch(0.99 0.005 250) | sau khi bấm nút: theme=dark
                                              nền oklch(0.99 0.005 250)   ← KHÔNG ĐỔI
hệ thống=dark  -> nền oklch(0.19 0.02 255)  | sau khi bấm nút: theme=dark  ← cũng sai trạng thái
```

Hai lỗi trong một:

**(a)** `light-dark()` chỉ đọc `color-scheme`, không đọc `data-theme`. Thiếu hai dòng cầu nối:

```css
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

**(b)** JS ban đầu mặc định coi trạng thái đầu là "sáng":

```js
const toi = document.documentElement.dataset.theme === 'dark';   // ❌ chưa set thì luôn false
```

Với người dùng đang để hệ điều hành ở chế độ tối, bấm nút lần đầu đặt `dark` — trong khi đang là
`dark`. Không có gì xảy ra. Phải khởi tạo từ `matchMedia`:

```js
const heDieuHanhToi = matchMedia('(prefers-color-scheme: dark)').matches;
const daLuu = localStorage.getItem('theme');
dat(daLuu ? daLuu === 'dark' : heDieuHanhToi);
```

Sau khi sửa, cả hai chiều đều đúng:

```
hệ thống=light -> bấm nút: theme=dark  nền oklch(0.19 0.02 255)  aria-pressed=true
hệ thống=dark  -> bấm nút: theme=light nền oklch(0.99 0.005 250) aria-pressed=false
```

### Lỗi 3 — container query không bao giờ khớp

```
card rộng 364px -> grid-template-columns: 314px   icon grid-row: auto     ← query không ăn
card rộng 500px -> grid-template-columns: 450px   icon grid-row: 1/span 3 ← ăn
```

Card 364px ở desktop **không** khớp query, trong khi tôi đặt ngưỡng 380px. Hai vấn đề chồng lên nhau:

**(a) Ngưỡng sai.** Tôi chọn 380px theo cảm tính. Đo thật thì card ở lưới 3 cột tại viewport 1280px chỉ
rộng **364px**. Sửa xuống 340px.

**(b) Lỗi nặng hơn — container query không style được chính element khai `container-type`.** Tôi viết:

```css
.card {
  container-type: inline-size;    /* ❌ card vừa là container vừa là mục tiêu */
  display: grid;
}
@container (width >= 340px) { .card { grid-template-columns: auto 1fr } }
```

Rule bên trong `@container` chỉ áp cho `.card` **nằm bên trong** một container — tức là card lồng
trong card. Không bao giờ có.

Đây là đúng cái bẫy đã đo ở [bài 07](./07-responsive-va-container-query.md) mục 2, và tôi vẫn mắc.

**Cách sửa — tách hai tầng:**

```html
<li class="card-slot"><article class="card">…</article></li>
```
```css
.card-slot { container-type: inline-size; display: grid }
.card      { display: grid; height: 100% }
```

`height: 100%` trên `.card` cần thêm vì giờ card không còn là grid item trực tiếp của `.cards` nữa —
nếu không, các card sẽ cao khác nhau.

### Lỗi 4 — trang giật 124px khi cuộn

Ảnh chụp mobile toàn trang có một vùng **trắng trơn** ở chỗ khối Hỏi đáp. Đo ra:

```js
// trước khi cuộn tới
{ id: "cau-hoi", cao_khi_chua_cuon_toi: 624, contentVisibility: "auto" }
// sau khi cuộn tới
{ id: "cau-hoi", cao_sau_khi_cuon_toi: 500 }
```

Tôi đặt `content-visibility: auto` với `contain-intrinsic-size: auto 480px`. Chiều cao thật là 500px,
nhưng trước khi render trình duyệt dùng ước lượng → trang giật 124px khi cuộn tới.

**Quyết định: bỏ hẳn kỹ thuật này khỏi trang.** Trang chỉ có 3 khối; tiết kiệm vài mili giây không đáng
đổi lấy cú giật. Tôi giữ lại lý do ngay trong file để người sau không thêm lại:

```css
.section {
  padding-block: var(--kc-8);

  /* Đã thử `content-visibility: auto` ở đây rồi BỎ. Lý do đo được:
     chiều cao khối Hỏi đáp là 624px khi chưa cuộn tới (theo ước lượng
     contain-intrinsic-size) nhưng 500px khi đã render thật -> trang giật
     124px lúc cuộn xuống. Trang này chỉ có 3 khối nên không đáng.
     Kỹ thuật đó dành cho trang dài hàng nghìn mục — xem bài 10. */
}
```

### Lỗi 5 — khối `prefers-reduced-motion` không phủ hết

Lỗi này tìm ra lúc làm bài tập 7 ở cuối bài. Bật `prefers-reduced-motion: reduce` rồi đo accordion:

```js
// prefers-reduced-motion: no-preference
{ accordion: { dong: 60, sau_100ms: 98,  mo_xong: 109 } }
// prefers-reduced-motion: reduce
{ accordion: { dong: 60, sau_100ms: 101, mo_xong: 109 } }   ← VẪN đang animate
```

Ở chế độ `reduce`, accordion đáng lẽ phải nhảy thẳng tới 109. Nó vẫn ở 101 — tức vẫn trượt.

Nguyên nhân: khối reset kinh điển chỉ liệt kê ba selector:

```css
*, *::before, *::after { transition-duration: 1ms !important }
```

Nhưng hiệu ứng của accordion nằm trên **`::details-content`** — một pseudo-element mới, không nằm trong
ba cái đó. Dấu `*` không phủ pseudo-element; phải liệt kê từng cái bằng tay.

**Cách sửa:**

```css
*, *::before, *::after, *::details-content, *::backdrop {
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 1ms !important;
  scroll-behavior: auto !important;
}
```

Sau khi sửa:

```js
// prefers-reduced-motion: reduce
{ accordion: { dong: 60, sau_100ms: 109, mo_xong: 109 } }   ← mở tức thì, đúng
```

Điều đáng chú ý: **thanh tiến trình cuộn thì không cần sửa gì.** Đo cả hai chế độ đều cho
`{ "0%": 0, "50%": 640, "100%": 1280 }`. Vì `animation-timeline: scroll()` ánh xạ tiến trình theo
**vị trí cuộn** chứ không theo thời gian, nên `animation-duration: 1ms` không ảnh hưởng — thanh vẫn
hiển thị đúng vị trí, chỉ là không còn "chuyển động" nào để giảm.

### Bài học chung từ 5 lỗi

| Lỗi | Nếu chỉ nhìn bằng mắt trên desktop thì… |
|---|---|
| Tràn ngang 320px | không thấy |
| Nút đổi nền hỏng | thấy — nhưng chỉ khi bạn ở chế độ tối |
| Container query không ăn | **không thấy** — layout vẫn "trông ổn", chỉ là không phải cái bạn viết |
| Giật 124px | thấy thoáng qua, dễ bỏ sót |
| Reduced-motion không phủ hết | **không thấy** — trừ khi bạn bật chế độ đó lên và đo |

Bốn trong năm lỗi chỉ lộ ra khi có **số đo**. Đây là lý do bài 00 dựng harness đo trước khi học gì khác.

---

## 7. Bài tập — mở rộng dự án

1. Thêm một khối "Nhận xét khách hàng" dùng `subgrid` để phần tên và chức danh của cả 3 card thẳng
   hàng, bất kể nhận xét dài ngắn khác nhau ([bài 05](./05-grid.md) mục 7).

2. Thêm hiệu ứng "hiện dần khi cuộn tới" cho các card bằng `animation-timeline: view()`. Nhớ bọc trong
   `prefers-reduced-motion`.

3. Thêm một `<dialog>` đăng ký nhận tin, có hiệu ứng mở/đóng bằng `@starting-style` +
   `allow-discrete`. Không dùng `setTimeout`.

4. Chạy script kiểm tra ở mục 5 sau khi làm xong 3 câu trên. Có phát sinh tràn ngang không?

5. Đặt `.card` vào một sidebar rộng 280px. Nó có tự đổi layout đúng không? Vì sao — nhờ media query hay
   container query?

6. Thêm ngôn ngữ thứ hai với `direction: rtl` cho `<html>`. Chỗ nào trong CSS bị hỏng? Sửa bằng thuộc
   tính logic ([bài 02](./02-box-model.md) mục 10).

7. Dùng tab Rendering trong DevTools bật "Emulate prefers-reduced-motion". Thanh tiến trình và accordion
   còn chạy không? Có nên không?

8. Đo `LayoutCount` khi hover qua các card (chúng có `transform: translateY(-3px)`). Kết quả có khớp
   bảng ở [bài 10](./10-hieu-nang-render.md) không?

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```css
@media (prefers-reduced-motion: no-preference) {
  .card {
    animation: hien-dan linear both;
    animation-timeline: view();
    animation-range: entry 10% cover 30%;
  }
  @keyframes hien-dan {
    from { opacity: 0; translate: 0 24px }
    to   { opacity: 1; translate: 0 0 }
  }
}
```
Dùng `no-preference` thay vì `reduce` để hiệu ứng chỉ **thêm vào** khi được phép, thay vì thêm rồi tắt.

**5.** Đổi đúng, nhờ **container query**. Card 280px trừ padding còn ~232px < 340px → xếp dọc. Media
query không giúp được vì cửa sổ vẫn rộng 1280px.

**6.** Những chỗ dùng `left`/`right` vật lý sẽ sai. Trong file này gần như không có — đã dùng
`margin-inline-start`, `inset-inline-start`, `padding-inline-start`, `float: inline-end`. Chỗ cần kiểm
tra: `transform-origin: left` của `.progress` (nên đổi tuỳ hướng), và `text-align` nếu có.

**7.** Đây chính là bài tập tìm ra **Lỗi 5** ở mục 6.

Thanh tiến trình: **vẫn hiện đúng vị trí** ở cả hai chế độ (`0% → 0`, `50% → 640`, `100% → 1280`), vì
`animation-timeline: scroll()` ánh xạ theo vị trí cuộn chứ không theo thời gian.

Accordion: **ban đầu vẫn animate** dù đã bật `reduce` (đo được 101px ở mốc 100ms thay vì 109px). Vì
hiệu ứng nằm trên `::details-content`, không nằm trong `*, *::before, *::after`. Phải thêm
`*::details-content` vào khối reset.

**8.** `transform` cho `LayoutCount: 0`. Nếu bạn đổi `translateY(-3px)` thành `margin-top: -3px` rồi đo
lại, số sẽ nhảy lên bằng số frame.

</details>

---

Tiếp theo: [12-loi-thuong-gap.md](./12-loi-thuong-gap.md)
