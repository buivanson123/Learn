# Bài 03 — Luồng inline: khoảng trắng bí ẩn, `line-height`, baseline

Bài này giải thích những khoảng trống mà bạn "không hề đặt" nhưng vẫn thấy trên màn hình. Chúng đều đến
từ một chỗ: **trình duyệt xếp chữ theo dòng, và dòng có luật riêng.**

---

## 1. Khoảng trắng 4px giữa hai `inline-block`

Kinh điển nhất. Bạn viết hai thẻ sát nhau, chúng vẫn cách nhau vài pixel.

```css
body { margin: 0; font: 16px/1 Arial }
.b { display: inline-block; width: 50px; height: 20px; background: #333 }
```
```html
<div id="a"><span class="b"></span>
             <span class="b"></span></div>          <!-- có xuống dòng trong HTML -->
<div id="b"><span class="b"></span><span class="b"></span></div>
```

```js
{ co_newline_trong_html: 4.45,   ← khoảng trắng ma
  viet_lien_nhau: 0,
  dung_flex: 0,
  font_size_0: 0 }
```

**Nguyên nhân:** dấu xuống dòng và khoảng trắng trong HTML là **ký tự thật**. Trình duyệt gộp chúng
thành một dấu cách và vẽ dấu cách đó ra. Bề rộng của nó = bề rộng ký tự space của font hiện tại
(Arial 16px → 4.45px).

**Ba cách xử lý:**

| Cách | Đánh giá |
|---|---|
| Viết các thẻ dính liền trong HTML | Hoạt động, nhưng HTML xấu và formatter sẽ phá |
| `font-size: 0` ở cha, đặt lại ở con | Cũ, dễ quên đặt lại, hỏng `em` |
| **`display: flex` ở cha** | ← dùng cái này |

Flexbox loại bỏ hoàn toàn "khoảng trắng giữa các item" vì nó không xếp theo dòng chữ nữa. Cùng với
`gap`, bạn kiểm soát được chính xác khoảng cách.

---

## 2. Khoảng trống dưới đáy `<img>`

Cũng cùng gốc rễ, nhưng khó nhận ra hơn.

```css
div { background: #c00; width: 100px }
```
```html
<div id="a"><img width="100" height="50"></div>
<div id="v"><img style="vertical-align: middle"></div>
<div id="b"><img style="vertical-align: bottom"></div>
<div id="bl"><img style="display: block"></div>
```

```js
{ a:  54,     ← ảnh cao 50 nhưng div cao 54 — thừa 4px màu đỏ
  v:  50,
  b:  50,
  bl: 50 }
```

**Nguyên nhân:** `<img>` mặc định là `inline`. Element inline nằm trên **baseline** — đường mà chữ
"đứng" lên. Bên dưới baseline còn chỗ cho phần đuôi chữ (`g`, `y`, `p`). 4px thừa chính là chỗ đó.

**Cách sửa — chọn một:**

```css
img { display: block }             /* nếu ảnh đứng riêng một dòng */
img { vertical-align: bottom }     /* nếu ảnh nằm cùng dòng với chữ */
```

Trong file reset của dự án landing page:

```css
img, svg { display: block; max-width: 100% }
```

---

## 3. `line-height`: dùng số không đơn vị, luôn luôn

### Chiều cao khối chứa chữ do `line-height` quyết định, không phải `font-size`

```css
p { margin: 0; font-size: 20px; font-family: Arial }
#a { line-height: 1 }      #b { line-height: 1.5 }
#c { line-height: normal } #d { line-height: 0 }
```

```js
{ a: { cao: 20, lineHeight: "20px"   },
  b: { cao: 30, lineHeight: "30px"   },
  c: { cao: 23, lineHeight: "normal" },   ← "normal" ≈ 1.15 với Arial
  d: { cao: 0,  lineHeight: "0px"    } }  ← chữ vẫn hiện, nhưng hộp cao 0
```

`line-height: normal` **không** phải 1.0 — nó do font quyết định, Arial cho ra ≈ 1.15. Đây là lý do
hai font khác nhau cùng `font-size: 16px` lại cho chiều cao dòng khác nhau.

### ⚠️ Bẫy: đơn vị quyết định cách KẾ THỪA

```css
#p1 { font-size: 20px; line-height: 1.5 }     /* số không đơn vị */
#p2 { font-size: 20px; line-height: 30px }    /* px */
#p3 { font-size: 20px; line-height: 150% }    /* % */
.c  { font-size: 40px }                       /* con to gấp đôi */
```

```js
{ cha_1_5_con_40px:   "60px",   ← 40 × 1.5   ✅ co theo con
  cha_30px_con_40px:  "30px",   ← ❌ chữ 40px nhét vào dòng 30px
  cha_150pc_con_40px: "30px" }  ← ❌ y hệt px: % được TÍNH RA px rồi mới kế thừa
```

Con kế thừa **giá trị đã tính** chứ không phải công thức. Với số không đơn vị, cái được kế thừa là
**hệ số** nên mỗi tầng tự nhân với font-size của mình.

**Luật:** `line-height` luôn viết số không đơn vị.

```css
body { line-height: 1.6 }     /* ✅ */
body { line-height: 24px }    /* ❌ */
body { line-height: 160% }    /* ❌ — hành xử y hệt px */
```

### Con số nên dùng

| Loại chữ | `line-height` |
|---|---|
| Đoạn văn dài | 1.5 – 1.7 |
| Tiêu đề lớn | 1.1 – 1.25 |
| Nút, nhãn 1 dòng | 1 |

Trong dự án: `body { line-height: 1.6 }`, `h1,h2,h3 { line-height: 1.15 }`.

---

## 4. `inline` bỏ qua `width`, `height`, và margin dọc

```css
span { width: 200px; height: 200px; margin: 50px; background: #333 }
#ib  { display: inline-block }
```

```js
{ inline:       { w: 7.11, h: 18,  marginTop_ap_dung: "50px" },
  inline_block: { w: 200,  h: 200, marginTop_ap_dung: "50px" } }
```

Chú ý dòng `marginTop_ap_dung: "50px"` ở cả hai: `getComputedStyle` **vẫn báo 50px** cho element
inline, nhưng nó không có tác dụng gì lên layout. Đây là ví dụ điển hình cho lời cảnh báo ở
[bài 00](./00-moi-truong-va-devtools.md) — computed value ≠ hiệu lực thật.

| | `width`/`height` | `margin` ngang | `margin` dọc | `padding` |
|---|---|---|---|---|
| `inline` | ❌ bỏ qua | ✅ | ❌ bỏ qua trong layout | ✅ vẽ ra nhưng **không đẩy dòng khác** |
| `inline-block` | ✅ | ✅ | ✅ | ✅ |
| `block` | ✅ | ✅ | ✅ | ✅ |

Hệ quả hay gặp: thêm `padding` cho `<a>` để tăng vùng bấm — padding **vẽ ra** nhưng các dòng trên dưới
đè lên nó. Sửa bằng `display: inline-block`.

---

## 5. `vertical-align: middle` không phải "giữa hộp"

```css
body { font: 16px/60px Arial }
.row { background: #eee; height: 60px }
.b   { display: inline-block; width: 20px; height: 20px; background: #c00 }
#mid .b { vertical-align: middle }
#cen { display: flex; align-items: center; height: 60px }
```

```js
{ vertical_align_middle:   { tren: 20.84, duoi: 19.16 },   ← LỆCH
  flex_align_items_center: { tren: 20,    duoi: 20    } }  ← đúng giữa
```

`vertical-align: middle` căn tâm hộp con vào **baseline + một nửa chiều cao chữ x** của cha. Chữ "x"
không đối xứng quanh tâm dòng, nên kết quả lệch — ở đây lệch 1.68px.

**Muốn căn giữa thật thì dùng flex hoặc grid:**

```css
.row { display: flex; align-items: center }
/* hoặc */
.row { display: grid; place-items: center }
```

`vertical-align` chỉ còn dùng đúng cho hai việc: căn ô bảng (`td`) và sửa khoảng trống dưới `<img>`.

---

## 6. Chuỗi dài không khoảng trắng làm tràn — `overflow-wrap` vs `word-break`

```css
div { width: 120px; border: 1px solid; font: 16px Arial }
#b { overflow-wrap: break-word }
#c { word-break: break-all }
```
```html
<div id="a">supercalifragilisticexpialidocious</div>
```

```js
{ a: { cao: 20, scrollWidth: 227, clientWidth: 120, tran: true  },   ← tràn 107px
  b: { cao: 38, scrollWidth: 120, tran: false },                     ← xuống dòng
  c: { cao: 38, scrollWidth: 120, tran: false } }
```

Khác biệt giữa hai cái:

- **`overflow-wrap: break-word`** — chỉ cắt từ khi từ đó **không vừa cả dòng**. Ưu tiên giữ từ nguyên vẹn.
- **`word-break: break-all`** — cắt bất cứ đâu, kể cả khi từ vừa dòng sau. Chữ nhìn nát hơn.

Dùng `overflow-wrap` cho nội dung do người dùng nhập (email, URL, tên file):

```css
.noi-dung-nguoi-dung {
  overflow-wrap: break-word;
  hyphens: auto;               /* thêm dấu gạch nối khi có lang="vi"/"en" */
}
```

---

## 7. `text-wrap: balance` và `pretty`

Trình duyệt xếp dòng theo kiểu "tham lam": nhồi tối đa vào dòng đầu, phần thừa rơi xuống dòng sau. Kết
quả là tiêu đề hay có dòng cuối cụt lủn.

```css
h2 { width: 340px; font: 24px/1.3 Arial }
#b { text-wrap: balance }
```

```js
{ a: { so_dong: 2, rong_tung_dong: [311,   194.5] },   ← lệch 116px
  b: { so_dong: 2, rong_tung_dong: [258.9, 246.6] },   ← lệch 12px
  p: { so_dong: 2, rong_tung_dong: [311,   194.5] } }  ← pretty KHÔNG đổi ở ca này
```

Với đoạn 3 dòng thì khác biệt còn rõ hơn:

```js
{ a: { so_dong: 3, rong_tung_dong: [271.6, 280.2,  82.7] },   ← dòng cuối cụt
  b: { so_dong: 3, rong_tung_dong: [198.6, 218.0, 217.9] } }  ← đều nhau
```

Lưu ý quan trọng: **`text-wrap: pretty` không đổi gì trong hai phép đo trên.** Nó giải bài toán khác —
tránh "goá phụ" (dòng cuối chỉ có 1 từ) và cải thiện chỗ ngắt gạch nối — chứ không cân đều mọi dòng.
Đừng dùng lẫn lộn.

**Dùng ở đâu:**

```css
h1, h2, h3 { text-wrap: balance }   /* tiêu đề ngắn — chi phí tính toán thấp */
p          { text-wrap: pretty }    /* đoạn văn dài */
```

⚠️ `balance` chỉ áp dụng cho khối **ít dòng** (Chrome giới hạn ~6 dòng) vì thuật toán tốn kém. Dùng
cho cả `<p>` dài thì trình duyệt lặng lẽ bỏ qua.

---

## 8. `white-space` — 5 giá trị, khác nhau ở 3 việc

Mỗi giá trị trả lời 3 câu hỏi: gộp khoảng trắng liên tiếp? giữ dấu xuống dòng? tự xuống dòng khi hết chỗ?

```css
div { width: 60px; border: 1px solid; font: 14px/17px monospace }
```
```html
<div>aa   bb
cc dd ee ff</div>
```

```js
{ a:  { so_dong: 3, tran_ngang: false },   ← normal
  n:  { so_dong: 1, tran_ngang: true  },   ← nowrap
  p:  { so_dong: 2, tran_ngang: true  },   ← pre
  pw: { so_dong: 3, tran_ngang: false },   ← pre-wrap
  pl: { so_dong: 3, tran_ngang: false } }  ← pre-line
```

| Giá trị | Gộp khoảng trắng | Giữ `\n` | Tự xuống dòng |
|---|---|---|---|
| `normal` | ✅ gộp | ❌ | ✅ |
| `nowrap` | ✅ gộp | ❌ | ❌ |
| `pre` | ❌ giữ | ✅ | ❌ |
| `pre-wrap` | ❌ giữ | ✅ | ✅ |
| `pre-line` | ✅ gộp | ✅ | ✅ |

Cái bạn cần nhớ:

- **`pre-wrap`** cho khối code và tin nhắn chat — giữ nguyên định dạng nhưng không tràn ngang.
- **`pre-line`** cho văn bản người dùng nhập từ `<textarea>` — giữ xuống dòng, bỏ khoảng trắng thừa.
- **`nowrap`** cho nhãn, nút, ô bảng không được gãy.

---

## 9. Cắt chữ bằng dấu ba chấm

### Một dòng

```css
#one {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

Phải đủ **cả ba** dòng. Thiếu `overflow: hidden` thì `text-overflow` không có tác dụng.

### Nhiều dòng — vẫn phải dùng tiền tố `-webkit-`

```js
{ supports_line_clamp_chuan: false,   ← CSS.supports('line-clamp: 2')
  one_dong: 22,
  webkit_line_clamp: 42,              ← 2 dòng × 20px + border
  line_clamp_chuan: 82 }              ← 4 dòng — KHÔNG có tác dụng
```

`line-clamp` chuẩn hoá **chưa chạy** trên Chrome 152. Vẫn phải viết bộ ba cũ:

```css
.hai-dong {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

Nghe như hack nhưng đây là cách duy nhất hoạt động, và nó chạy trên mọi trình duyệt hiện đại kể cả
Firefox và Safari.

---

## 10. Vài thuộc tính chữ đáng dùng mà ít người biết

```css
body {
  /* Chống nhảy chữ khi font web tải xong: dùng font hệ thống trước */
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;      /* chữ mảnh hơn trên macOS */
}

p {
  max-width: 68ch;              /* 68 ký tự — dài hơn thì mắt khó bắt dòng */
  text-wrap: pretty;
}

h1 {
  letter-spacing: -0.015em;     /* chữ càng to càng cần thu khoảng cách lại */
  text-wrap: balance;
}

.so-lieu {
  font-variant-numeric: tabular-nums;   /* số cùng bề rộng -> bảng không nhảy */
}
```

`ch` = bề rộng chữ số `0` của font hiện tại. `max-width: 68ch` là cách chính xác nhất để giới hạn độ
dài dòng — nó tự đúng với mọi cỡ chữ và mọi font.

`tabular-nums` là thứ bắt buộc cho bảng số liệu hoặc đồng hồ đếm ngược: không có nó, chữ số `1` hẹp
hơn `8` nên con số nhảy qua nhảy lại mỗi lần cập nhật.

---

## Bài tập

1. Tạo 3 `<span>` `inline-block` trên 3 dòng HTML riêng. Đo khoảng cách giữa chúng. Sửa bằng flex và
   đo lại.

2. Đặt `<img>` trong `<div>` có `background: red`. Vì sao thấy vạch đỏ dưới ảnh? Nêu 2 cách sửa và đo
   chiều cao `div` mỗi lần.

3. Cha có `font-size: 16px; line-height: 24px`, con có `font-size: 32px`. `line-height` của con là bao
   nhiêu? Đổi cha sang `line-height: 1.5` thì thành bao nhiêu?

4. Element `<span>` có `width: 300px; height: 300px`. Đo `getBoundingClientRect()`. Kết quả nói lên
   điều gì về `getComputedStyle`?

5. Căn giữa một hình vuông 20px trong dòng cao 60px bằng `vertical-align: middle`, đo khoảng cách trên
   và dưới. Làm lại bằng flex. Lệch bao nhiêu?

6. Cho `<div style="width:100px">` chứa một URL dài 60 ký tự. Nó tràn ra bao nhiêu px? Thử
   `overflow-wrap: break-word` và `word-break: break-all`, so sánh kết quả nhìn thấy.

7. Viết CSS cắt tiêu đề card ở đúng 2 dòng kèm dấu `…`. Kiểm tra `CSS.supports('line-clamp: 2')` trước
   khi viết.

8. Trong `<textarea>` người dùng gõ 3 dòng có nhiều khoảng trắng thừa. Hiển thị lại sao cho giữ xuống
   dòng nhưng bỏ khoảng trắng thừa. Dùng giá trị `white-space` nào?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Khoảng cách ≈ 4.45px với Arial 16px (bằng bề rộng ký tự space). Đổi cha sang `display: flex` →
0px.

**2.** Ảnh là `inline` nên đứng trên baseline, chừa chỗ cho đuôi chữ bên dưới. `div` cao 54 thay vì 50.
Sửa: `img { display: block }` hoặc `img { vertical-align: bottom }` — cả hai cho 50.

**3.** `24px` (kế thừa giá trị đã tính, chữ 32px nhét vào dòng 24px → chồng dòng). Với `line-height:
1.5` thì con nhận **48px** = 32 × 1.5.

**4.** `{ w: 7.11, h: 18 }` — bằng kích thước chữ, không phải 300×300. Nhưng
`getComputedStyle(el).width` vẫn trả `"300px"`. Bài học: computed value không cho biết thuộc tính có
tác dụng hay không; phải đo hình học thật.

**5.** `vertical-align: middle` cho `{ tren: 20.84, duoi: 19.16 }` — lệch 1.68px. Flex cho
`{ tren: 20, duoi: 20 }`.

**7.** `CSS.supports('line-clamp: 2')` → **false**. Nên phải dùng
`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`.

**8.** `white-space: pre-line` — giữ `\n`, gộp khoảng trắng thừa, vẫn tự xuống dòng khi hết chỗ.

</details>

---

Tiếp theo: [04-flexbox.md](./04-flexbox.md)
