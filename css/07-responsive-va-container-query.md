# Bài 07 — Responsive: container query, `clamp()`, cú pháp range

Media query hỏi: **"cửa sổ trình duyệt rộng bao nhiêu?"**
Container query hỏi: **"chỗ tôi đang đứng rộng bao nhiêu?"**

Câu hỏi thứ hai gần như luôn là câu bạn thực sự cần. Một card đặt trong sidebar hẹp phải xếp dọc, đặt
trong vùng chính rộng thì xếp ngang — dù cửa sổ trình duyệt là 1920px trong cả hai trường hợp.

---

## 1. Container query: cùng một component, hai layout

```css
.col  { container-type: inline-size }
.card { display: flex; flex-direction: column; gap: 4px }
.card img { width: 100% }

@container (min-width: 400px) {
  .card { flex-direction: row }
  .card img { width: 120px }
}

#narrow { width: 300px }   #wide { width: 600px }
```

```js
{ hep_300:  { container_rong: 300, flexDirection: "column",
              anh_rong: 300, card_cao: 62 },
  rong_600: { container_rong: 600, flexDirection: "row",
              anh_rong: 120, card_cao: 40 },
  viewport: 900 }                                   ← cửa sổ giống nhau ở cả hai!
```

Cùng một viewport 900px, cùng một class `.card`, hai layout khác nhau — quyết định bởi ô chứa.

Đây là điều media query **không thể** làm được. Với media query bạn phải viết
`.sidebar .card { flex-direction: column }`, tức là component phải biết về chỗ nó được đặt vào — đúng
thứ khiến CSS khó bảo trì.

### Hai bước bắt buộc

```css
/* 1. Khai một element là container */
.wrapper { container-type: inline-size }

/* 2. Query nó */
@container (width >= 400px) { .card { ... } }
```

`container-type` có 3 giá trị:

| Giá trị | Query được | Ghi chú |
|---|---|---|
| `inline-size` | chỉ bề **rộng** | dùng 99% trường hợp |
| `size` | cả rộng và **cao** | element phải có chiều cao xác định |
| `normal` | chỉ style query | mặc định |

---

## 2. ⚠️ Ba cái bẫy của container query

### Bẫy 1 — KHÔNG style được chính element khai `container-type`

```css
.self { container-type: inline-size; width: 600px; background: #eee }
@container (min-width: 400px) {
  .self  { background: red }     /* ❌ không ăn */
  .inner { background: lime }    /* ✅ ăn */
}
```

```js
{ container_rong: 600,
  background_cua_chinh_no: "rgb(238, 238, 238)",   ← KHÔNG đổi
  background_cua_con: "rgb(0, 255, 0)" }           ← đổi
```

Lý do: nếu cho phép, sẽ có vòng lặp vô tận — style làm đổi kích thước, kích thước làm đổi query, query
làm đổi style...

**Đây là lỗi tôi thực sự mắc phải khi làm dự án ở [bài 11](./11-du-an-landing-page.md).** Tôi đặt
`container-type` ngay trên `.card` rồi query để đổi layout của chính `.card`. Kết quả đo:

```
   card rộng 364px -> grid-template-columns: 314px    icon grid-row: auto     ← query không ăn
```

**Cách sửa — tách hai tầng:**

```html
<li class="card-slot">      <!-- container -->
  <article class="card">    <!-- thứ được style -->
```
```css
.card-slot { container-type: inline-size; display: grid }
.card      { display: grid; ... }
@container (width >= 340px) { .card { grid-template-columns: auto 1fr } }
```

Sau khi sửa:

```
   card rộng 364px -> grid-template-columns: 40px 258px   icon grid-row: 1 / span 3   ← ăn
   card rộng 300px -> grid-template-columns: 250px        icon grid-row: auto         ← không ăn, đúng
```

### Bẫy 2 — `inline-size` không query được chiều cao

```css
.i { container-type: inline-size; width: 400px; height: 300px }
.s { container-type: size;        width: 400px; height: 300px }
@container (min-height: 200px) { .t { color: rgb(0,150,0) } }
```

```js
{ inline_size: "rgb(0, 0, 0)",     ← không khớp dù cao 300px
  size:        "rgb(0, 150, 0)" }  ← khớp
```

Muốn query chiều cao phải dùng `container-type: size`, và khi đó container **phải có chiều cao xác
định** — nó không còn tự cao theo nội dung nữa. Rất dễ làm sập layout. Gần như luôn nên dùng
`inline-size`.

### Bẫy 3 — ngưỡng phải khớp với kích thước THẬT của container

Ban đầu tôi đặt ngưỡng `380px` cho card. Nhưng ở màn hình desktop 1280px, lưới 3 cột cho mỗi card
đúng **364px** — nhỏ hơn 380. Query không bao giờ khớp trên desktop.

Đo trước, đặt ngưỡng sau:

```js
document.querySelector('.card').getBoundingClientRect().width
-> 364
```

Rồi mới chọn ngưỡng `340px`.

---

## 3. Đơn vị `cqw` / `cqi` / `cqh` — phần trăm của CONTAINER

```css
.c { container-type: size; width: 400px; height: 200px }
```

```js
{ viewport: 900, container: "400x200",
  '10cqw': "40px",     ← 10% bề rộng container
  '10cqi': "40px",     ← inline-size, cùng nghĩa khi viết ngang
  '10cqh': "20px",     ← 10% chiều cao container
  '10vw':  "90px",     ← 10% VIEWPORT — khác hẳn
  '50cqw_width': "200px" }
```

| Đơn vị | Gốc quy chiếu |
|---|---|
| `cqw` / `cqh` | bề rộng / chiều cao container |
| `cqi` / `cqb` | inline-size / block-size container (theo hướng viết) |
| `cqmin` / `cqmax` | nhỏ hơn / lớn hơn trong hai chiều |
| `vw` / `vh` | viewport |

Dùng `cqi` để chữ co giãn theo **component** chứ không theo cửa sổ:

```css
.card { container-type: inline-size }
.card h3 { font-size: clamp(1rem, 5cqi, 1.5rem) }
```

Card này bỏ vào đâu cũng có tỉ lệ chữ đúng — sidebar, modal, hay full width.

---

## 4. Container có tên — khi lồng nhiều tầng

```css
.trang    { container-type: inline-size; container-name: trang }
.sidebar  { container-type: inline-size; container-name: sidebar }

@container sidebar (width > 300px) { .card { ... } }
@container trang   (width > 900px) { .card { ... } }
```

Không có tên thì `@container` luôn nhắm **container gần nhất**. Đặt tên khi bạn cần vượt qua một tầng.

Viết gộp:

```css
.sidebar { container: sidebar / inline-size }
```

---

## 5. Style query — query giá trị biến CSS

```css
.btn { --variant: solid; background: #333; color: #fff }
.ghost { --variant: ghost }

@container style(--variant: ghost) {
  .label { color: rgb(200,0,0) }
}
```

```js
{ supports_style_query: true,
  solid: "rgb(255, 255, 255)",
  ghost: "rgb(200, 0, 0)" }
```

Điểm hay: **không cần `container-type`** cho style query — mọi element đều là style container theo mặc
định (`container-type: normal`).

Dùng để làm biến thể component mà không cần thêm class cho từng element con:

```css
.card { --trang-thai: binh-thuong }
.card.canh-bao { --trang-thai: canh-bao }

@container style(--trang-thai: canh-bao) {
  .card__icon  { color: orange }
  .card__title { font-weight: 700 }
  .card__meta  { color: darkorange }
}
```

Đặt một biến ở cha, mọi con tự phản ứng.

---

## 6. `clamp()` — cỡ chữ co giãn không cần breakpoint

```
clamp(nhỏ nhất, giá trị mong muốn, lớn nhất)
```

```css
h1 { font-size: clamp(1.5rem, 1rem + 3vw, 3rem) }
h2 { font-size: clamp(24px, 5vw, 48px) }
```

Đo thật ở 6 bề rộng viewport:

```
viewport  320px -> clamp(1.5rem, 1rem+3vw, 3rem) =  25.6px | clamp(24px, 5vw, 48px) = 24px
viewport  375px -> ...                           = 27.25px | ...                    = 24px
viewport  600px -> ...                           =    34px | ...                    = 30px
viewport  900px -> ...                           =    43px | ...                    = 45px
viewport 1280px -> ...                           =    48px | ...                    = 48px
viewport 1600px -> ...                           =    48px | ...                    = 48px
```

Hai công thức khác nhau ở chỗ nào:

- `clamp(24px, 5vw, 48px)` — thuần `vw`. Ở 320px cho ra 16px, bị chặn về 24px. **Người dùng phóng to
  chữ trong trình duyệt thì không có tác dụng gì** vì `vw` không đổi.
- `clamp(1.5rem, 1rem + 3vw, 3rem)` — có thành phần `rem`. Người dùng đặt cỡ chữ lớn hơn thì phần
  `1rem` lớn theo. **Đây là cách đúng.**

**Quy tắc:** phần giữa của `clamp()` cho font luôn phải chứa `rem`.

Trong dự án landing page, cả thang chữ dùng công thức này:

```css
--cx-2: clamp(0.9375rem, 0.9rem  + 0.2vw, 1rem);
--cx-4: clamp(1.25rem,   1.1rem  + 0.7vw, 1.5rem);
--cx-6: clamp(2rem,      1.4rem  + 2.8vw, 3.25rem);
```

Đo `h1` (dùng `--cx-6`) trên trang thật:

```
    320px  h1 =    32px          900px  h1 = 47.6px
    375px  h1 =  32.9px         1280px  h1 =   52px
    600px  h1 =  39.2px         1920px  h1 =   52px
```

Không có một `@media` nào cho cỡ chữ.

### Cách tự tính công thức

Muốn chữ đi từ `A` px ở viewport `V1` tới `B` px ở viewport `V2`:

```
độ dốc  = (B − A) / (V2 − V1)
gốc     = A − độ dốc × V1

font-size: clamp(Apx, gốc/16 rem + độ dốc×100 vw, Bpx)
```

Ví dụ: 32px ở 320px → 52px ở 1280px.
Độ dốc = 20/960 = 0.02083 → `2.083vw`. Gốc = 32 − 0.02083×320 = 25.33px = 1.583rem.

```css
font-size: clamp(32px, 1.583rem + 2.083vw, 52px);
```

Kiểm chứng công thức vừa tính:

```
viewport  320px -> 32px          ← đúng mốc dưới
viewport  800px -> 41.992px      ← nội suy tuyến tính
viewport 1280px -> 51.9904px     ← đúng mốc trên (sai số làm tròn 0.01px)
```

### `clamp()` dùng được cho mọi thứ, không riêng font

```css
.shell   { width: min(100% - 3rem, 1140px) }        /* thay cho max-width + padding */
.section { padding-block: clamp(2rem, 8vw, 6rem) }
.luoi    { gap: clamp(1rem, 3vw, 2rem) }
```

Dòng `.shell` đáng nhớ: nó thay thế hoàn toàn mẫu `max-width: 1140px; margin: 0 auto; padding: 0 1.5rem`
bằng một dòng, và **không bị lỗi cộng dồn padding** như mẫu cũ. Dự án dùng đúng nó:

```css
.shell { width: min(100% - var(--kc-5) * 2, var(--do-rong-trang)); margin-inline: auto }
```

---

## 7. Cú pháp range — dễ đọc hơn `min-width`

```css
@media (min-width: 600px)      { }    /* cũ */
@media (width >= 600px)        { }    /* mới, cùng nghĩa */
@media (600px <= width <= 900px) { }  /* khoảng — cũ phải viết 2 điều kiện */
@media (width < 600px)         { }    /* thay cho max-width: 599.98px */
```

Đo tại đúng biên:

```
viewport 599px: {"min-width:600":"—",   "width>=600":"—",   "600<=w<=900":"—",
                 "max-width:599.98":"KHỚP", "width<600":"KHỚP"}
viewport 600px: {"min-width:600":"KHỚP","width>=600":"KHỚP","600<=w<=900":"KHỚP",
                 "max-width:599.98":"—",   "width<600":"—"}
viewport 900px: {"600<=w<=900":"KHỚP"}
viewport 901px: {"600<=w<=900":"—"}
```

Cú pháp mới xoá được một loại bug cũ: với `min-width: 600px` và `max-width: 600px`, **cả hai cùng khớp**
ở đúng 600px. Người ta phải viết `max-width: 599.98px` để né. Với `width < 600px` thì không có chuyện đó.

### Chỉ dùng một chiều

Chọn **mobile-first** (`width >= ...`) hoặc **desktop-first** (`width < ...`) rồi giữ nguyên cả dự án.
Trộn hai chiều là công thức cho bug ở biên.

Mobile-first tốt hơn vì CSS mặc định (không có query) là bản đơn giản nhất:

```css
.luoi { display: grid; gap: 1rem }                      /* mobile: 1 cột */
@media (width >= 700px) { .luoi { grid-template-columns: 1fr 1fr } }
```

---

## 8. Media query hỏi được nhiều thứ hơn bề rộng

```js
// light
{ body_bg: "rgb(255, 255, 255)", transition: "0.3s",
  match_dark: false, match_reduce: false }
// dark
{ body_bg: "rgb(20, 20, 20)",    transition: "0s",
  match_dark: true,  match_reduce: true }
```

```css
@media (prefers-color-scheme: dark)      { }   /* người dùng thích nền tối */
@media (prefers-reduced-motion: reduce)  { }   /* người dùng tắt hiệu ứng */
@media (prefers-contrast: more)          { }   /* cần tương phản cao */
@media (hover: hover)                    { }   /* thiết bị có chuột thật */
@media (pointer: coarse)                 { }   /* điều khiển bằng ngón tay */
@media print                             { }   /* khi in */
@media (orientation: landscape)          { }
```

### `prefers-reduced-motion` — không phải tuỳ chọn

Với người bị rối loạn tiền đình, animation trượt/phóng có thể gây chóng mặt và buồn nôn thật sự.
Trình duyệt đã hỏi hộ bạn; chỉ cần nghe.

Đoạn này nên có trong **mọi** file reset:

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

Hai chi tiết dễ bỏ sót:

**1. Dùng `1ms` chứ không phải `0s`** để các callback `transitionend`/`animationend` vẫn chạy — nếu đặt
`0s`, những sự kiện đó không bao giờ bắn và JS của bạn sẽ treo.

**2. Dấu `*` KHÔNG phủ pseudo-element**, phải liệt kê từng cái. Đo thật trên dự án ở
[bài 11](./11-du-an-landing-page.md), khi khối reset chỉ có `*, *::before, *::after`:

```js
// prefers-reduced-motion: reduce, accordion đáng lẽ phải mở tức thì
{ accordion: { dong: 60, sau_100ms: 101, mo_xong: 109 } }   ← VẪN đang trượt
```

Vì hiệu ứng của accordion nằm trên `::details-content`. Thêm nó vào danh sách:

```js
{ accordion: { dong: 60, sau_100ms: 109, mo_xong: 109 } }   ← đúng
```

### `hover: hover` — chặn hiệu ứng hover dính trên mobile

Trên màn cảm ứng, `:hover` bị "kẹt" sau khi chạm. Bọc nó lại:

```css
@media (hover: hover) {
  .btn:hover { background: darkblue }
}
```

### `pointer: coarse` — vùng bấm phải to hơn

```css
@media (pointer: coarse) {
  .btn { min-height: 44px; min-width: 44px }   /* kích thước ngón tay */
}
```

---

## 9. Chiến lược: dùng cái gì khi nào

| Tình huống | Công cụ |
|---|---|
| Component đổi layout theo chỗ nó đứng | **container query** |
| Cỡ chữ, khoảng cách co giãn mượt | **`clamp()`** |
| Số cột lưới tự đổi | **`repeat(auto-fit, minmax(min(100%, X), 1fr))`** |
| Bố cục **toàn trang** đổi (điều hướng, sidebar hiện/ẩn) | **media query** |
| Tôn trọng lựa chọn người dùng | **media query** `prefers-*` |

Thứ tự ưu tiên khi làm responsive:

1. Thử `min()`, `max()`, `clamp()`, `auto-fit` trước — chúng cho kết quả mượt, không có "điểm gãy".
2. Không đủ thì dùng container query.
3. Chỉ dùng media query cho những thay đổi thật sự ở tầm **trang**.

Dự án landing page có **đúng 3 media query** trong 491 dòng CSS:

```css
@media (prefers-reduced-motion: reduce) { ... }   /* tôn trọng người dùng */
@media (width >= 560px) { .nhan-nut { display: inline } }  /* hiện nhãn nút */
@media (width >= 900px) { .hero { grid-template-columns: 1.05fr 1fr } }  /* hero 2 cột */
```

Mọi thứ còn lại — số cột card, cỡ chữ, khoảng cách, layout card — do `clamp()`, `auto-fit` và container
query lo.

---

## Bài tập

1. Tạo một `.card` đặt trong hai ô rộng 250px và 500px trên cùng một trang. Dùng container query cho
   nó xếp dọc ở ô hẹp, xếp ngang ở ô rộng. Kiểm tra viewport không ảnh hưởng.

2. Đặt `container-type: inline-size` trên `.card` rồi viết `@container` nhắm chính `.card`. Vì sao
   không ăn? Sửa lại.

3. Đo bề rộng thật của một card trong lưới 3 cột ở viewport 1280px. Chọn ngưỡng container query dựa
   trên số đo đó.

4. Viết công thức `clamp()` cho `h2` đi từ 24px ở viewport 375px tới 40px ở viewport 1200px. Kiểm tra
   bằng cách đo `getComputedStyle` ở 5 viewport.

5. Vì sao `clamp(24px, 5vw, 48px)` là công thức tệ cho font? Chứng minh bằng cách phóng to chữ trong
   trình duyệt.

6. Viết `.shell` bằng một dòng `width: min(...)` thay cho `max-width` + `margin` + `padding`. So sánh
   hành vi ở viewport 320px.

7. Với `@media (min-width: 768px)` và `@media (max-width: 768px)`, chuyện gì xảy ra ở đúng 768px? Viết
   lại bằng cú pháp range.

8. Thêm khối `prefers-reduced-motion` vào dự án của bạn. Vì sao dùng `1ms` chứ không phải `0s`?

<details>
<summary>Gợi ý đáp án</summary>

**2.** Container query không style được chính element khai `container-type` (tránh vòng lặp vô tận).
Sửa bằng cách bọc thêm một tầng: wrapper giữ `container-type`, card bên trong nhận style.

**4.** Độ dốc = (40−24)/(1200−375) = 0.0194 → `1.939vw`. Gốc = 24 − 0.0194×375 = 16.73px = 1.045rem.
→ `clamp(24px, 1.045rem + 1.939vw, 40px)`.

**5.** Vì `5vw` chỉ phụ thuộc bề rộng cửa sổ. Người dùng đặt cỡ chữ mặc định 24px trong trình duyệt
(hoặc bấm Ctrl +) thì `vw` **không đổi** → chữ vẫn 24px. Công thức có `rem` thì phần `rem` lớn theo.

**6.** `width: min(100% - 3rem, 1140px)`. Ở 320px cho ra 272px với lề 24px hai bên — đúng như
`max-width` + `padding`, nhưng chỉ một dòng và không bị lỗi cộng padding vào `max-width`.

**7.** Cả hai cùng khớp ở đúng 768px → hai bộ style chồng lên nhau, cái viết sau thắng. Viết lại:
`@media (width >= 768px)` và `@media (width < 768px)`.

**8.** `0s` khiến sự kiện `transitionend` và `animationend` **không bao giờ bắn**. Code JS chờ những sự
kiện đó (ví dụ để gỡ element khỏi DOM sau khi đóng modal) sẽ treo vĩnh viễn. `1ms` nhanh tới mức mắt
không thấy nhưng sự kiện vẫn chạy.

</details>

---

Tiếp theo: [08-bien-css-va-theming.md](./08-bien-css-va-theming.md)
