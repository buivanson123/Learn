# Bài 13 — Cheatsheet

Tra cứu nhanh. Mọi con số đã đo trên Chrome 152.

---

## Cascade — thứ tự xét, từ trên xuống

```
1. Origin + !important
2. Thứ tự @layer            (layer sau thắng; có !important thì ĐẢO NGƯỢC)
3. Ngoài layer > trong layer (có !important thì đảo)
4. Inline style
5. Specificity (id, class, thẻ)
6. Thứ tự xuất hiện
```

## Specificity

| Selector | (id, class, thẻ) |
|---|---|
| `*`, `>`, `+`, `~`, ` ` | (0,0,0) |
| `:where(...)` | (0,0,0) — **luôn** |
| `p`, `::before` | (0,0,1) |
| `.a`, `[type=x]`, `:hover`, `:nth-child(2)` | (0,1,0) |
| `#b` | (1,0,0) |
| `:is()`, `:not()`, `:has()` | = cao nhất bên trong |

**Không cộng dồn.** `(1,0,0)` thắng `(0,20,0)`.

---

## Đơn vị

| Dùng cho | Đơn vị |
|---|---|
| Cỡ chữ | `rem` |
| Padding trong component | `em` (tự co theo cỡ chữ component) |
| Khoảng cách bố cục | `rem` qua biến |
| Viền, bo góc, đổ bóng | `px` |
| Bề rộng đoạn văn | `ch` (`68ch`) |
| Chiều cao đầy màn hình | `dvh` (không phải `vh`) |
| % của container | `cqi`, `cqw` |

```
em nhân dồn: 3 tầng × 1.5em từ gốc 16px = 54px
rem không:   3 tầng × 1.5rem            = 24px
```

`svh` = thanh địa chỉ hiện · `lvh` = đã ẩn · `dvh` = thay đổi theo thời gian thực

---

## Box model

```css
*, *::before, *::after { box-sizing: border-box }   /* luôn có ở đầu file */
```

| | `offsetWidth` | `clientWidth` | `rect.width` |
|---|---|---|---|
| padding | ✅ | ✅ | ✅ |
| border | ✅ | ❌ | ✅ |
| `transform` | ❌ | ❌ | ✅ |

`width:100px; padding:20px; border:5px; scale(2)` → 150 / 140 / 300

**Margin dọc dính nhau** (chỉ trong normal flow):
- cha–con: dùng `display: flow-root` để chặn (không tác dụng phụ)
- anh em: `30px + 20px = 30px` (lấy max)
- có âm: `-30px + 20px = -10px`

**`%` của `padding`/`margin` luôn theo CHIỀU RỘNG cha**, kể cả `padding-top`.

---

## Flexbox

```css
flex: 1      = 1 1 0%      /* chia đều, bỏ qua nội dung */
flex: auto   = 1 1 auto    /* nội dung là điểm xuất phát */
flex: none   = 0 0 auto    /* cứng đờ */
```

```
grow: bề rộng cuối = basis + (thừa) × (grow/tổng grow)
      basis 100, thừa 300, grow 1 vs 3 -> 175 và 325 (tỉ lệ 1.86, KHÔNG phải 3)

shrink: chia theo shrink × basis
      basis 400 và 200, cần co 300 -> co 200 và 100
```

⚠️ `min-width` mặc định của flex item là `auto` → không co nhỏ hơn nội dung.

```css
.o-text { flex: 1; min-width: 0; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap }
```

| | trục chính | trục phụ |
|---|---|---|
| trên cha | `justify-content` | `align-items` |
| trên con | — | `align-self` |
| nhiều dòng | — | `align-content` (**cần** `flex-wrap`) |

Khoảng cách với container 300px, 3 ô 40px:

```
space-between  lề 0  | 90 | 90 | lề 0
space-around   lề 30 | 60 | 60 | lề 30
space-evenly   lề 45 | 45 | 45 | lề 45
```

---

## Grid

```css
grid-template-columns: 100px 1fr 2fr;    /* fr chia phần CÒN LẠI sau gap + cố định */
grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);   /* chống cột lệch */
grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));  /* ⭐ */
```

Dòng có ⭐ là **lưới responsive không cần media query**. `min(100%, 260px)` chặn tràn ở màn hẹp.

```
auto-fit   thu track rỗng về 0px  -> item giãn lấp đầy
auto-fill  giữ nguyên track rỗng  -> giữ nhịp cột
```

```css
grid-column: 1 / -1;      /* trải hết, không cần biết mấy cột */
grid-column: span 2;
grid-row: -2 / -1;        /* số âm đếm ngược từ cuối */
```

```css
grid-template-areas:
  "head head head"
  "side main ."      /* dấu . = ô trống */
  "foot foot foot";
```

**Subgrid** — cho card thẳng hàng nhau:

```css
.wrap { display: grid; grid-template-rows: auto 1fr auto }
.card { grid-row: span 3; grid-template-rows: subgrid }
```

Căn chỉnh: `place-items` = `align-items` + `justify-items`
(`items` = trong ô · `content` = cả lưới · `self` = một item)

---

## Position

| | Chiếm chỗ | Neo vào |
|---|---|---|
| `relative` | ✅ (chỗ cũ) | chính nó |
| `absolute` | ❌ | tổ tiên đã định vị gần nhất |
| `fixed` | ❌ | viewport (**trừ khi** bị bắt) |
| `sticky` | ✅ | tổ tiên cuộn gần nhất |

**Bắt `fixed`/`absolute` lại** (tạo containing block): `transform`, `filter`, `will-change`,
`contain`, `perspective`, `backdrop-filter`.

**`sticky` cần đủ 3 điều kiện:**
1. khai `top`/`bottom`/`left`/`right`
2. **không** tổ tiên nào có `overflow` khác `visible`
3. cha cao hơn element

### Tạo stacking context

```
CÓ:     opacity < 1 · transform · filter · will-change · isolation: isolate
        contain: paint · mix-blend-mode · backdrop-filter · perspective
        position: fixed · content-visibility: auto · view-transition-name
        position: relative/absolute/sticky + z-index ≠ auto

KHÔNG:  container-type
```

`z-index` chỉ ăn trên element **đã định vị** — trừ flex/grid item (ăn cả khi `static`).

`isolation: isolate` — tạo stacking context mà không đổi hình gì.

---

## Căn giữa

```css
.giua { display: grid; place-items: center }              /* ngắn nhất */
.giua { display: flex; align-items: center; justify-content: center }
.con  { position: absolute; inset: 0; margin: auto }      /* cần biết kích thước */
.con  { position: absolute; top: 50%; left: 50%;
        transform: translate(-50%,-50%) }                 /* tạo stacking context */
```

---

## Responsive

```css
/* Cú pháp range — dùng cái này */
@media (width >= 600px) { }
@media (width < 600px) { }
@media (600px <= width <= 900px) { }

/* Container query */
.slot { container-type: inline-size }      /* wrapper */
@container (width >= 340px) { .card { } }  /* con của wrapper */
```

⚠️ `@container` **không** style được element khai `container-type` → phải tách 2 tầng.

```css
/* Chữ co giãn — phần giữa PHẢI có rem */
font-size: clamp(1.5rem, 1rem + 3vw, 3rem);   ✅
font-size: clamp(24px, 5vw, 48px);            ❌ không phóng to được

/* Container không cần max-width + padding */
width: min(100% - 3rem, 1140px);
margin-inline: auto;
```

**Tự tính công thức** cho A px @ V1 → B px @ V2:

```
độ dốc = (B−A)/(V2−V1)        gốc = A − độ dốc × V1
clamp(Apx, (gốc/16)rem + (độ dốc×100)vw, Bpx)
```

Media feature khác: `prefers-color-scheme` · `prefers-reduced-motion` · `prefers-contrast` ·
`hover: hover` · `pointer: coarse` · `print`

---

## Biến CSS

```css
:root { --nhan: oklch(0.55 0.19 258) }
.card { --nhan: crimson }               /* kế thừa xuống cả nhánh */

color: var(--x, #333);                  /* LUÔN cho fallback */
width: calc(var(--n) * 1px);            /* số trần phải nhân đơn vị */
```

⚠️ `var()` sai kiểu → thuộc tính về **`unset`**, không quay về giá trị trước:
kế thừa thì lấy của cha, không kế thừa thì về `initial`.

```css
@property --w {
  syntax: '<length>';    /* animate được + chặn kiểu sai */
  inherits: false;
  initial-value: 0px;
}
```

Không có `@property`: animate nhảy thẳng tới đích (đo được 200 thay vì 91.7 ở giữa đường).

---

## Màu

```css
oklch(L C H)              /* L: 0-1, C: 0-0.4, H: 0-360 — đều theo cảm nhận mắt */
color-mix(in oklch, var(--nhan) 12%, transparent)
oklch(from var(--nhan) l c calc(h + 180))    /* màu đối lập */
light-dark(màu-sáng, màu-tối)                /* cần color-scheme */
currentColor                                  /* = giá trị color hiện tại */
```

```css
:root { color-scheme: light dark }
:root[data-theme="light"] { color-scheme: light }   /* cầu nối cho nút đổi nền */
:root[data-theme="dark"]  { color-scheme: dark }
```

---

## Animation

```css
transition: opacity 300ms ease, transform 200ms;   /* đừng dùng `all` */
animation-fill-mode: forwards;                     /* không nhảy về chỗ cũ */
```

| Loại | Thời lượng | Đường cong |
|---|---|---|
| Hover, đổi màu | 100–200ms | `ease-out` |
| Dropdown, tooltip | 150–250ms | `ease-out` |
| Modal, drawer | 250–400ms | `cubic-bezier(.2,.8,.2,1)` |

**Bốn tính năng thay JavaScript:**

```css
/* 1. Animate height: auto */
:root { interpolate-size: allow-keywords }
.body { height: 0; overflow: hidden; transition: height 300ms }
.open .body { height: auto }

/* 2. Animate display: none */
transition: opacity 300ms, display 300ms allow-discrete;

/* 3. Hiệu ứng khi element vừa xuất hiện */
@starting-style { .pop { opacity: 0; scale: .9 } }

/* 4. Animation theo vị trí cuộn */
animation: chay linear;
animation-timeline: scroll(root block);     /* thanh tiến trình */
animation-timeline: view();                 /* hiện dần khi cuộn tới */
animation-range: entry 10% cover 30%;
```

**Thuộc tính riêng lẻ** — dùng thay `transform` để không giẫm chân nhau:

```css
.the:hover  { translate: 0 -4px }
.the:active { scale: .97 }
```

Thứ tự áp luôn là `translate → rotate → scale`, bất kể viết thế nào.

⚠️ Với `transform`, thứ tự viết đổi kết quả:
`translateX(200px) rotate(90deg)` → (200, 0) · `rotate(90deg) translateX(200px)` → (0, 200)

---

## Hiệu năng

```
Animate 200 element trong 2 giây:

thuộc tính   LayoutCount   LayoutDuration
left               120        20.1 ms
width              120        79.9 ms
transform            0           0 ms      ← chỉ animate cái này
opacity              0           0 ms      ← và cái này
```

```
Layout thrashing (400 element):
  đọc-ghi xen kẽ       32.5 ms
  đọc hết rồi ghi hết   0.3 ms     ← nhanh hơn 108 lần
```

Đọc là buộc layout: `offsetTop/Left/Width/Height` · `scrollTop/Left/Width/Height` ·
`clientTop/Left/Width/Height` · `getBoundingClientRect()` · `getComputedStyle()` · `focus()`

```css
content-visibility: auto;              /* 21.7ms -> 6.1ms trên 4000 element */
contain-intrinsic-size: auto 420px;    /* nhưng trang GIẬT nếu ước lượng sai */
```

⚠️ Đừng rải `will-change` hay `translateZ(0)` — mỗi cái tạo một layer GPU + stacking context +
containing block.

---

## Tiếp cận (accessibility)

```css
:focus-visible { outline: 2px solid; outline-offset: 3px }   /* không dùng :focus */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after, *::details-content, *::backdrop {
    animation-duration: 1ms !important;      /* 1ms chứ không 0s — để sự kiện vẫn bắn */
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}

html { scroll-padding-top: 80px }    /* header sticky không che anchor */
p { max-width: 68ch }                /* dòng không quá dài */
```

```html
<ul role="list">                    <!-- giữ ngữ nghĩa khi list-style: none -->
<span aria-hidden="true">⌘</span>   <!-- icon trang trí -->
<nav aria-label="Điều hướng chính">
<button aria-label="Đổi nền" aria-pressed="false">
```

---

## Trạng thái Chrome 152

```
✅ :has()  &-nesting  @layer  @scope  @container  style query  subgrid
✅ oklch  color-mix  light-dark  relative color  @property
✅ text-wrap: balance/pretty  interpolate-size  allow-discrete  @starting-style
✅ animation-timeline: scroll()/view()  view transitions  linear()
✅ align-content trên display: block  field-sizing  scrollbar-gutter

❌ line-clamp (chuẩn hoá)   -> vẫn phải -webkit-line-clamp
❌ display: masonry
❌ shape: circle()
```

Kiểm tra trên máy bạn:

```js
CSS.supports('selector(:has(a))')
CSS.supports('container-type', 'inline-size')
CSS.supports('(display: grid) and (gap: 1px)')
```

⚠️ `CSS.supports('(@layer)')` trả `false` nhưng `@layer` **vẫn chạy** — at-rule không kiểm tra được
bằng `CSS.supports`.

---

## Snippet hay dùng

```css
/* Lưới responsive, 0 media query */
.luoi { display: grid; gap: 1.5rem;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)) }

/* Container căn giữa */
.shell { width: min(100% - 3rem, 1140px); margin-inline: auto }

/* Layout app: header + nội dung cuộn + footer */
.app { display: flex; flex-direction: column; height: 100dvh }
.app > header, .app > footer { flex: none }
.app > main { flex: 1; overflow: auto }

/* Navbar: logo trái, nút phải */
.nav { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap }
.nav .menu { margin-inline-start: auto }

/* Ô text co được, có dấu ... */
.ten { flex: 1; min-width: 0; overflow: hidden;
       text-overflow: ellipsis; white-space: nowrap }

/* Card cao bằng nhau, nút dính đáy */
.card { display: grid; grid-template-rows: auto 1fr auto; height: 100% }

/* Chồng ảnh và chữ, KHÔNG dùng absolute */
.banner { display: grid }
.banner > * { grid-area: 1 / 1 }
.banner .chu { place-self: center }

/* Bài viết có khối tràn viền */
.bai-viet { display: grid; grid-template-columns: 1fr min(65ch, 100%) 1fr }
.bai-viet > * { grid-column: 2 }
.bai-viet > .tran-vien { grid-column: 1 / -1 }

/* Ẩn khỏi màn hình nhưng trình đọc vẫn đọc */
.chi-doc-man-hinh {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}
```

---

## Script kiểm tra trước khi giao việc

```js
// Tìm element tràn ngang
const vw = document.documentElement.clientWidth;
for (const e of document.querySelectorAll('*')) {
  const r = e.getBoundingClientRect();
  if (r.right > vw + .5) console.log(e.tagName, e.className, r.right, getComputedStyle(e).minWidth);
}

// Tìm tổ tiên tạo stacking context
let e = document.querySelector('.bi-che');
while (e && e !== document.documentElement) {
  const s = getComputedStyle(e);
  const t = ['opacity','transform','filter','willChange','mixBlendMode','isolation','contain']
    .filter(k => s[k] && !['none','auto','normal','1'].includes(s[k]));
  if (t.length) console.log(e, t.map(k => k + ': ' + s[k]));
  e = e.parentElement;
}

// Tìm tổ tiên phá position: sticky
let n = document.querySelector('.sticky-hong').parentElement;
while (n) { const o = getComputedStyle(n).overflow;
  if (o !== 'visible') console.log('THỦ PHẠM:', n, o); n = n.parentElement; }
```

---

Quay lại [README](./README.md) · Luyện phỏng vấn: [phong-van/](./phong-van/README.md)
