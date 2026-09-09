# Bài 08 — Biến CSS, `@property`, màu và chế độ tối

Biến CSS không phải "biến như trong Sass". Chúng là **thuộc tính CSS thật**: có kế thừa, có cascade, đọc
được từ JavaScript, đổi được lúc chạy. Đó là điều làm chúng mạnh hơn hẳn biến của preprocessor.

---

## 1. Biến CSS KẾ THỪA — đây là toàn bộ sức mạnh của nó

```css
:root { --pad: 4px }
.card { --pad: 16px }
```

```js
{ trong_card: "16px",     ← con của .card
  sau_3_tang: "16px",     ← cháu chắt cũng vậy
  ngoai_card: "4px" }     ← ngoài .card thì lấy giá trị gốc
```

Biến Sass được thay thế lúc biên dịch — nó không tồn tại trong trình duyệt, không kế thừa được, không
đổi lúc chạy được. Biến CSS thì sống trong DOM.

Hệ quả: **đổi một biến ở một chỗ, cả nhánh cây đổi theo.** Đây là nền tảng của mọi cơ chế theme:

```css
:root  { --bg: rgb(255,255,255); --fg: rgb(20,20,20) }
.dark  { --bg: rgb(20,20,20);    --fg: rgb(240,240,240) }
.panel { background: var(--bg); color: var(--fg) }
```

```js
{ sang: { bg: "rgb(255, 255, 255)", fg: "rgb(20, 20, 20)"    },
  toi:  { bg: "rgb(20, 20, 20)",    fg: "rgb(240, 240, 240)" } }
```

Class `.panel` **không hề biết** có theme tối tồn tại. Nó chỉ đọc biến.

---

## 2. ⚠️ Bẫy lớn nhất: `var()` sai giá trị làm thuộc tính về "unset"

Đây là nguồn của bug "màu chữ tự nhiên thành đen mà không hiểu tại sao".

```css
#a   { color: rgb(0,150,0); color: var(--khong-ton-tai) }
#b   { color: rgb(0,150,0); color: var(--khong-ton-tai, rgb(0,0,255)) }
#par { color: rgb(255,0,255) }
#c   { color: rgb(0,150,0); --bad: 10px; color: var(--bad) }   /* 10px không phải màu */
#d   { width: 100px; width: var(--bad2) }
```

```js
{ khong_fallback:       "rgb(0, 0, 0)",       ← KHÔNG quay về xanh lá
  co_fallback:          "rgb(0, 0, 255)",
  sai_kieu_thua_tu_cha: "rgb(255, 0, 255)",   ← lấy màu của CHA
  width_sai_kieu:       "784px" }             ← width về auto = lấp đầy cha
```

Với CSS thường, khai một giá trị sai thì trình duyệt **bỏ qua dòng đó** và giữ giá trị trước:

```css
color: red;
color: khong-phai-mau;    /* bị bỏ qua, vẫn đỏ */
```

Nhưng `var()` được xử lý **muộn hơn**, sau khi cascade đã chọn xong. Lúc phát hiện sai thì không còn
giá trị nào để quay về, nên thuộc tính rơi về **`unset`**:

- Thuộc tính **kế thừa** (`color`) → lấy của cha
- Thuộc tính **không kế thừa** (`width`) → về `initial` (`auto`)

Thuật ngữ chính thức là "invalid at computed-value time".

**Cách phòng:**

```css
/* 1. Luôn cho fallback */
color: var(--mau-chu, #333);

/* 2. Hoặc dùng @property để ép kiểu (mục 4) */
```

---

## 3. Biến chứa số trần phải nhân với đơn vị

```css
:root { --n: 20 }
#a { width: var(--n) }                  /* ❌ "20" không phải độ dài */
#b { width: calc(var(--n) * 1px) }      /* ✅ */
#c { width: calc(var(--n) * 1%) }       /* ✅ */
```

```js
{ dung_truc_tiep: "784px",   ← rơi về auto
  nhan_1px: "20px",
  nhan_1pc: "156.797px" }
```

Lưu số trần rất tiện vì một biến dùng được cho nhiều đơn vị:

```css
:root { --ban-kinh: 8 }
.card { border-radius: calc(var(--ban-kinh) * 1px) }
.nho  { border-radius: calc(var(--ban-kinh) * 0.5px) }
```

⚠️ **Không nối chuỗi được.** `var(--n)px` không hoạt động — phải dùng `calc()`.

---

## 4. `@property` — khai kiểu cho biến

`@property` giải quyết hai vấn đề cùng lúc.

### Vấn đề 1: biến thường KHÔNG animate được

```css
@property --p2 { syntax: '<length>'; inherits: false; initial-value: 0px }

#a { --p1: 0px; width: var(--p1); transition: --p1 400ms linear }   /* không khai property */
#b { width: var(--p2); transition: --p2 400ms linear }              /* có khai */
```

Đo giữa lúc animation đang chạy (200ms sau khi đổi giá trị sang 200px):

```js
{ o_giua_animation: { co_property: 91.7,   ← đang nội suy mượt
                      khong_property: 200 },  ← nhảy phắt tới đích
  ket_thuc:         { co_property: 200, khong_property: 200 } }
```

Không có `@property`, biến CSS là một **chuỗi ký tự** với trình duyệt. Nó không biết "0px" và "200px"
là hai số để nội suy giữa chúng — nên nó nhảy thẳng.

Có `@property` với `syntax: '<length>'`, trình duyệt hiểu đây là độ dài và nội suy được.

### Vấn đề 2: chặn giá trị sai kiểu

```css
@property --len { syntax: '<length>'; inherits: false; initial-value: 5px }
#a { --len: 30px; padding-left: var(--len) }
#b { --len: đỏ;   padding-left: var(--len) }
```

```js
{ dung_kieu: "30px",
  sai_kieu_ve_initial_value: "5px",     ← KHÔNG rơi về unset
  computed_var_khi_sai: "5px" }
```

Giá trị sai bị chặn ngay tại biến, rơi về `initial-value` — không lây lan sang thuộc tính như bẫy ở
mục 2. Đây là "kiểu tĩnh cho CSS".

### Cú pháp

```css
@property --ten {
  syntax: '<color>';       /* bắt buộc */
  inherits: false;         /* bắt buộc */
  initial-value: red;      /* bắt buộc, trừ khi syntax là '*' */
}
```

Các `syntax` hay dùng: `<length>`, `<color>`, `<number>`, `<percentage>`, `<angle>`, `<time>`,
`<length-percentage>`, `<integer>`, `<image>`, `*` (bất kỳ, không animate được).

Ghép nhiều giá trị: `'<length> | auto'`, hoặc danh sách: `'<length>+'`.

### Ứng dụng đắt giá: animate gradient

Gradient bình thường không animate được. Với `@property` thì được:

```css
@property --goc { syntax: '<angle>'; inherits: false; initial-value: 0deg }

.the {
  background: linear-gradient(var(--goc), #4d90fe, #a855f7);
  transition: --goc 600ms ease;
}
.the:hover { --goc: 180deg }
```

---

## 5. Màu: `oklch` thay cho `hsl`

`hsl` có một khuyết tật lớn: **cùng độ sáng `L` nhưng các màu trông sáng tối khác nhau**. `hsl(60 100%
50%)` (vàng) chói hơn hẳn `hsl(240 100% 50%)` (xanh dương) dù cùng `L: 50%`.

`oklch` sửa đúng chuyện đó — nó xây trên mô hình cảm nhận của mắt người.

```
oklch(L C H)
  L = độ sáng, 0 → 1 (0% → 100%)
  C = độ đậm màu (chroma), 0 → ~0.4
  H = góc màu, 0 → 360
```

Kiểm tra hỗ trợ và giá trị computed trên Chrome 152:

```js
{ supports: { color_mix: true, oklch: true, relative: true, light_dark: true },
  color_mix:     "oklch(0.539974 0.285457 326.643)",
  oklch:         "oklch(0.7 0.15 200)",
  relative_rgb:  "color(srgb 0 0 0)",
  light_dark:    "rgb(1, 1, 1)",
  hsl_alpha:     "rgba(64, 149, 191, 0.5)",
  relative_oklch:"oklch(0.627966 0.257704 200)" }
```

Chú ý: trình duyệt **giữ nguyên** `oklch` trong computed value, không đổi về `rgb`. Đó là vì màn hình
hiện đại hiển thị được dải màu rộng hơn sRGB.

### Vì sao điều này quan trọng cho theme

Với `oklch`, làm bảng màu chỉ là đổi chữ `L`:

```css
--nhan-100: oklch(0.95 0.05 258);
--nhan-500: oklch(0.55 0.19 258);   /* cùng H, cùng "gia đình màu" */
--nhan-900: oklch(0.25 0.12 258);
```

Ba màu này **trông cùng độ tương phản** với nhau, khác hẳn khi làm bằng `hsl`.

### `color-mix()` — trộn màu ngay trong CSS

```css
--nhan-nhe: color-mix(in oklch, var(--nhan) 12%, transparent);
```

Dùng thay cho việc khai thêm 5 biến màu:

```css
.btn--solid:hover { background: color-mix(in oklch, var(--nhan) 88%, black) }
.site-header      { background: color-mix(in oklch, var(--nen) 88%, transparent) }
```

Trộn với `transparent` là cách tạo màu nhạt mà **vẫn theo theme** — đổi `--nhan` thì màu nhạt đổi theo.

### Relative color syntax — lấy màu từ màu khác

```css
color: rgb(from rgb(255,0,0) 0 g b)     /* -> color(srgb 0 0 0), vì g và b của đỏ đều 0 */
color: oklch(from rgb(255,0,0) l c 200) /* -> oklch(0.628 0.258 200): giữ L và C, đổi H */
```

Dòng thứ hai rất hữu dụng: "cho tôi màu này nhưng đổi tông sang xanh, giữ nguyên độ sáng và độ đậm".

```css
--nhan-bo-tro: oklch(from var(--nhan) l c calc(h + 180));   /* màu đối lập */
```

---

## 6. `light-dark()` và `color-scheme` — chế độ tối không cần nhân đôi biến

Cách cũ phải viết hai bảng màu:

```css
:root { --bg: white; --fg: black }
@media (prefers-color-scheme: dark) {
  :root { --bg: black; --fg: white }
}
```

Cách mới, một dòng cho mỗi màu:

```css
:root {
  color-scheme: light dark;                              /* ← BẮT BUỘC */
  --nen: light-dark(oklch(0.99 0.005 250), oklch(0.19 0.02 255));
  --chu: light-dark(oklch(0.25 0.02 255),  oklch(0.95 0.01 250));
}
```

### ⚠️ Bẫy: `light-dark()` chỉ nghe `color-scheme`, không nghe class hay `data-*`

**Đây là lỗi tôi thực sự mắc khi làm dự án ở [bài 11](./11-du-an-landing-page.md).** Nút "Đổi nền"
của tôi đặt `data-theme="dark"` lên `<html>`, nhưng màu không đổi:

```
   hệ thống=light -> nền oklch(0.99 0.005 250)  | sau khi bấm nút: theme=dark
                                                  nền oklch(0.99 0.005 250)   ← KHÔNG ĐỔI
```

`data-theme` là một attribute; `light-dark()` không biết nó tồn tại. Phải dịch nó sang `color-scheme`:

```css
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

Sau khi thêm hai dòng đó:

```
   hệ thống=light -> nền oklch(0.99 0.005 250) | sau khi bấm: theme=dark  nền oklch(0.19 0.02 255) ✅
   hệ thống=dark  -> nền oklch(0.19 0.02 255)  | sau khi bấm: theme=light nền oklch(0.99 0.005 250) ✅
```

### `color-scheme` còn đổi cả giao diện mặc định của trình duyệt

```css
#l { color-scheme: light }
#d { color-scheme: dark }
```

```js
{ light_input: { bg: "rgb(255, 255, 255)", color: "rgb(0, 0, 0)"       },
  dark_input:  { bg: "rgb(59, 59, 59)",    color: "rgb(255, 255, 255)" } }
```

Ô `<input>` tự đổi màu nền và màu chữ mà bạn không viết CSS nào cho nó. `color-scheme` cũng đổi màu
thanh cuộn, checkbox, dropdown mặc định.

Đây là lý do **luôn khai `color-scheme`** dù bạn có làm dark mode hay không — nếu không, ô input sẽ
trắng toát trên nền tối của bạn.

### Cơ chế đổi nền hoàn chỉnh

```css
:root {
  color-scheme: light dark;                    /* mặc định theo hệ điều hành */
  --nen: light-dark(#fff, #131a24);
}
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

```js
// Toàn bộ JS cần thiết
const goc = document.documentElement;
const heDieuHanhToi = matchMedia('(prefers-color-scheme: dark)').matches;
const daLuu = localStorage.getItem('theme');
goc.dataset.theme = (daLuu ? daLuu === 'dark' : heDieuHanhToi) ? 'dark' : 'light';
```

⚠️ Lỗi thứ hai tôi mắc: JS ban đầu của tôi mặc định coi trạng thái đầu là "sáng". Với người dùng đang
để hệ điều hành ở chế độ tối, bấm nút lần đầu **không có gì xảy ra** (nó đặt `dark` trong khi đang
`dark`). Phải khởi tạo từ `matchMedia` như trên.

---

## 7. `currentColor` — biến miễn phí có sẵn từ CSS1

```css
#p { color: rgb(0,120,200) }
#p .icon { border: 2px solid currentColor }
#p .box  { background: currentColor }
```

```js
{ border_theo_mau_chu: "rgb(0, 120, 200)",
  background_theo_mau_chu: "rgb(0, 120, 200)" }
```

Icon SVG dùng `fill="currentColor"` sẽ tự đổi màu theo chữ xung quanh — không cần biến, không cần class
biến thể:

```html
<svg fill="currentColor">…</svg>
```
```css
.btn         { color: white }
.btn--nguy-hiem { color: red }     /* icon bên trong tự đỏ theo */
```

---

## 8. Tổ chức biến: kiến trúc 2 tầng

Đừng dùng tên biến theo màu sắc (`--xanh-duong`), dùng tên theo **vai trò** (`--nhan`). Khi đổi màu
thương hiệu sang tím, bạn không phải sửa tên biến ở 200 chỗ.

Cấu trúc dùng trong dự án:

```css
@layer token {
  :root {
    /* Tầng 1: nguyên liệu — màu, số */
    --nen:      light-dark(oklch(0.99 0.005 250), oklch(0.19 0.02 255));
    --nen-nhe:  light-dark(oklch(0.97 0.008 250), oklch(0.23 0.02 255));
    --vien:     light-dark(oklch(0.90 0.01 250),  oklch(0.32 0.02 255));
    --chu:      light-dark(oklch(0.25 0.02 255),  oklch(0.95 0.01 250));
    --chu-mo:   light-dark(oklch(0.52 0.02 255),  oklch(0.72 0.02 250));
    --nhan:     light-dark(oklch(0.55 0.19 258),  oklch(0.72 0.16 258));
    --nhan-chu: light-dark(oklch(0.99 0 0),       oklch(0.16 0.02 255));
    --nhan-nhe: color-mix(in oklch, var(--nhan) 12%, transparent);

    /* Thang khoảng cách: mỗi bước ~1.5 lần */
    --kc-1: 0.25rem;  --kc-2: 0.5rem;   --kc-3: 0.75rem;
    --kc-4: 1rem;     --kc-5: 1.5rem;   --kc-6: 2rem;
    --kc-7: 3rem;     --kc-8: 4.5rem;   --kc-9: 6rem;

    /* Thang chữ, mỗi cỡ đều co giãn */
    --cx-1: clamp(0.8125rem, 0.78rem + 0.15vw, 0.875rem);
    --cx-6: clamp(2rem,      1.4rem + 2.8vw,   3.25rem);
  }
}
```

Ba nguyên tắc:

1. **Tên theo vai trò, không theo hình thức.** `--nen-nhe` chứ không phải `--xam-100`.
2. **Thang có bậc, không tuỳ tiện.** Chỉ dùng `--kc-*`, không bao giờ gõ `padding: 13px`.
3. **Đặt hết trong một layer riêng.** Layer `token` không sinh rule nào nên không bao giờ xung đột
   cascade.

Biến theo component thì khai ngay trên component, không đưa lên `:root`:

```css
.btn {
  --btn-nen: var(--nhan);
  background: var(--btn-nen);
}
.btn--nguy-hiem { --btn-nen: crimson }   /* chỉ đổi 1 biến */
```

---

## 9. Đọc và ghi biến từ JavaScript

```js
// Đọc — nhớ .trim(), giá trị trả về có khoảng trắng đầu
getComputedStyle(document.documentElement).getPropertyValue('--nhan').trim()

// Ghi
document.documentElement.style.setProperty('--nhan', 'oklch(0.6 0.2 20)');

// Xoá, quay về giá trị trong stylesheet
document.documentElement.style.removeProperty('--nhan');
```

Ứng dụng: theo dõi chuột mà chỉ dùng 1 dòng JS, mọi hiệu ứng nằm trong CSS.

```js
document.addEventListener('pointermove', e => {
  document.documentElement.style.setProperty('--chuot-x', e.clientX + 'px');
});
```
```css
.den-roi { background: radial-gradient(circle at var(--chuot-x) 50%, #fff3, transparent) }
```

---

## Bài tập

1. Khai `--pad: 4px` ở `:root` và `--pad: 20px` ở `.card`. Đọc giá trị ở một element sâu 3 tầng trong
   `.card` và một element ngoài nó.

2. Viết `color: green; color: var(--khong-co)`. Màu thực tế là gì? Vì sao không phải xanh lá? Sửa bằng
   2 cách.

3. `--n: 10`. Vì sao `width: var(--n)` không hoạt động? Viết lại cho đúng.

4. Viết `@property` cho một biến `--do-mo` kiểu `<number>`, rồi animate nó. Đo giá trị ở giữa animation
   để chứng minh nó nội suy.

5. Chuyển bảng màu này sang `oklch` sao cho 3 màu có cùng độ sáng cảm nhận:
   `#e74c3c`, `#3498db`, `#2ecc71`.

6. Làm nút đổi nền dùng `light-dark()`. Đặt `data-theme` lên `<html>` — vì sao chưa đổi màu? Sửa.

7. Tạo biến `--nhan-hover` bằng `color-mix()` từ `--nhan`, không khai màu mới. Đổi `--nhan` và kiểm tra
   hover đổi theo.

8. Viết icon SVG đổi màu theo chữ của nút mà không cần class riêng cho từng biến thể nút.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Màu thực tế là màu **kế thừa từ cha** (thường là đen). `var()` được giải quyết sau cascade nên
khi phát hiện sai thì không còn giá trị nào để quay về — thuộc tính rơi về `unset`. Sửa: cho fallback
`var(--khong-co, green)`, hoặc khai `@property --khong-co { syntax: '<color>'; initial-value: green }`.

**3.** `"10"` không phải giá trị `<length>` hợp lệ, `width` rơi về `auto`. Sửa:
`width: calc(var(--n) * 1px)`.

**4.**
```css
@property --do-mo { syntax: '<number>'; inherits: false; initial-value: 0 }
.hop { opacity: var(--do-mo); transition: --do-mo 400ms linear }
.hop.hien { --do-mo: 1 }
```
Ở giữa animation, `getComputedStyle(el).opacity` cho giá trị trung gian (~0.5). Bỏ `@property` đi thì
nó nhảy thẳng 0 → 1.

**6.** Vì `light-dark()` chỉ đọc `color-scheme`, không đọc attribute. Thêm:
```css
:root[data-theme="light"] { color-scheme: light }
:root[data-theme="dark"]  { color-scheme: dark }
```

**7.** `--nhan-hover: color-mix(in oklch, var(--nhan) 85%, black)`. Vì `color-mix` được tính lúc chạy
nên đổi `--nhan` là hover đổi theo ngay.

**8.** Đặt `fill="currentColor"` trên `<svg>`. Icon sẽ luôn bằng `color` của nút, nên chỉ cần đổi
`color` cho từng biến thể.

</details>

---

Tiếp theo: [09-transition-va-animation.md](./09-transition-va-animation.md)
