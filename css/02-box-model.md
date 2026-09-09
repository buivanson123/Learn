# Bài 02 — Box model: `width: 200px` thật ra nghĩa là gì

Mọi element trong CSS là một hộp gồm 4 vòng: **nội dung → padding → border → margin**. Nghe đơn giản,
nhưng có 5 chỗ hành xử khác trực giác, và cả 5 đều gây bug thật.

---

## 1. `box-sizing`: `width: 200px` mặc định KHÔNG phải 200px

```css
.box { width: 200px; padding: 20px; border: 5px solid }
#bb  { box-sizing: border-box }
```

```js
{ content_box_offsetWidth: 250,     ← 200 + 20×2 + 5×2
  content_box_clientWidth: 240,     ← 200 + 20×2 (không kể border)
  border_box_offsetWidth: 200,      ← đúng 200
  border_box_clientWidth: 190,
  border_box_vung_noi_dung: 150 }   ← 200 − 20×2 − 5×2
```

Mặc định là `content-box`: `width` chỉ tính **vùng nội dung**, padding và border **cộng thêm** vào.

### Hệ quả: `width: 100%` + `padding` làm tràn cha

```css
#p  { width: 300px }
#cb { width: 100%; padding: 20px; box-sizing: content-box }
#bb { width: 100%; padding: 20px; box-sizing: border-box }
```

```js
{ cha: 300,
  content_box_offsetWidth: 340,   ← tràn ra ngoài
  tran_ra: 40,
  border_box_offsetWidth: 300 }   ← vừa khít
```

Đây là lỗi CSS phổ biến nhất trên đời. Vì thế **mọi** file CSS nên bắt đầu bằng:

```css
*, *::before, *::after { box-sizing: border-box }
```

Chú ý phải có cả `::before`/`::after` — chúng không nhận `box-sizing` từ `*`.

---

## 2. Margin dọc DÍNH LẠI với nhau (margin collapsing)

Đây là hành vi khiến người ta tưởng CSS bị lỗi. Nó chỉ xảy ra theo **chiều dọc**, và chỉ trong
**normal flow** (không phải flex/grid).

### Dạng 1 — margin của con thoát ra ngoài, đẩy cả cha

```css
body { margin: 0 }
.p { background: #eee }
.c { margin-top: 50px; height: 10px; background: #333 }
```
```html
<div class="p"><div class="c"></div></div>
```

```js
{ cha_y: 50,      ← CHA bị đẩy xuống 50px, dù cha không có margin nào
  cha_cao: 10,    ← cha chỉ cao bằng con
  con_y: 50 }     ← con nằm sát mép trên của cha
```

Bạn muốn đẩy **con** xuống 50px so với cha. Kết quả: cả hai cùng bị đẩy, khoảng cách giữa chúng vẫn là 0.

### Bốn cách chặn nó — đo thật

```css
.c   { margin-top: 50px; height: 10px }
#pad { padding-top: 1px }
#bor { border-top: 1px solid }
#ovf { overflow: hidden }
#flo { display: flow-root }
```

```js
{ none: 10,   ← margin thoát ra, cha chỉ cao 10
  pad:  61,   ← 1 + 50 + 10
  bor:  61,   ← 1 + 50 + 10
  ovf:  60,   ← 50 + 10
  flo:  60 }  ← 50 + 10
```

Bốn cách đều chặn được. Nhưng chúng có tác dụng phụ khác nhau:

| Cách | Tác dụng phụ |
|---|---|
| `padding-top: 1px` | lệch 1px, phải bù ở chỗ khác |
| `border-top: 1px` | lệch 1px + có thể thấy đường kẻ |
| `overflow: hidden` | **cắt mất** tooltip/dropdown tràn ra ngoài; phá `position: sticky` |
| `display: flow-root` | **không có tác dụng phụ nào** ← dùng cái này |

`display: flow-root` sinh ra đúng để làm việc này. Nó tạo một "block formatting context" mới, không đổi
hình dạng gì.

### Dạng 2 — hai anh em cạnh nhau: 30 + 20 = 30

```css
#a { margin-bottom: 30px }
#b { margin-top: 20px }
```

```js
{ khoang_cach: 30 }     ← không phải 50
```

Trình duyệt lấy **giá trị lớn hơn**, không cộng.

### Dạng 3 — có margin âm thì cộng cái âm lớn nhất với cái dương lớn nhất

```css
#a { margin-bottom: -30px }
#b { margin-top: 20px }
```

```js
{ khoang_cach: -10 }    ← −30 + 20
```

### Cách né sạch sẽ: đừng dùng margin dọc nữa

Flexbox và Grid **không** có margin collapsing. Trong dự án ở [bài 11](./11-du-an-landing-page.md),
tôi không dùng `margin-bottom` để tạo khoảng cách ở đâu cả — chỉ dùng `gap`:

```css
.faq { display: grid; gap: var(--kc-3) }     /* không cần margin, không có collapse */
```

---

## 3. Phần trăm tính theo cái gì — câu trả lời hay gây bất ngờ

### `padding: 10%` và `margin: 10%` luôn tính theo **CHIỀU RỘNG** của cha

Kể cả `padding-top` và `padding-bottom`.

```css
#p { width: 400px; height: 100px }
#c { padding-top: 10%; padding-left: 10% }
```

```js
{ cha_rong: 400, cha_cao: 100,
  paddingTop:  "40px",     ← 10% của 400 (CHIỀU RỘNG), không phải của 100
  paddingLeft: "40px" }
```

Đây không phải lỗi thiết kế mà là một tính năng: nó cho phép làm hộp giữ tỉ lệ. Mẹo `padding-top:
56.25%` để có khung 16:9 chính là dựa vào chuyện này. Nhưng bây giờ đã có `aspect-ratio` nên đừng
dùng mẹo đó nữa.

### `height: 100%` im lặng không hoạt động khi cha cao `auto`

```css
#p1 { height: auto }    #p2 { height: 200px }
.c  { height: 100%; background: #333 }
```

```js
{ cha_auto_con_cao: 18,      ← chỉ bằng chiều cao dòng chữ
  cha_200_con_cao: 200,
  computed_height_khi_cha_auto: "18px" }
```

Không có cảnh báo, không có lỗi. `height: 100%` chỉ bị bỏ qua. Lý do: cha cao `auto` nghĩa là "cao bằng
nội dung", mà nội dung lại muốn cao bằng cha — vòng lặp, nên trình duyệt bỏ luôn.

**Hệ quả kinh điển:** muốn `<div>` cao đầy màn hình thì `height: 100%` phải khai từ `html` xuống, hoặc
đơn giản hơn là dùng `100dvh`, hoặc dùng grid/flex.

---

## 4. Từ khoá kích thước: `min-content`, `max-content`, `fit-content`

Cùng một nội dung `"Xin chào thế giới rất dài"`, container 300px:

```css
#mn { width: min-content }    #mx { width: max-content }
#ft { width: fit-content }    #au { width: auto }
```

```js
{ mn: { w:  32.2, h: 110 },    ← hẹp bằng TỪ DÀI NHẤT, cao 6 dòng
  mx: { w: 161.88, h: 20 },    ← rộng bằng TOÀN BỘ text trên 1 dòng
  ft: { w: 161.88, h: 20 },    ← = min(max-content, không gian có sẵn)
  au: { w: 300,   h: 20 } }    ← lấp đầy cha (với display: block)
```

Khi nào dùng:

- **`fit-content`** — nút, badge, tag: rộng vừa đúng nội dung nhưng không tràn.
  Thay được cho `display: inline-block` + `width: auto`.
- **`max-content`** — ô bảng không được xuống dòng.
- **`min-content`** — hiếm dùng trực tiếp, nhưng **rất quan trọng để hiểu** vì nó là giá trị mặc định
  của `min-width` cho flex/grid item (mục 6).

Có thể lồng trong `minmax()` và `clamp()`:

```css
.card { width: clamp(200px, fit-content, 100%) }
```

---

## 5. `aspect-ratio` — giữ tỉ lệ khung

```css
#a { width: 200px; aspect-ratio: 16/9 }
#b { width: 200px; aspect-ratio: 16/9; height: 50px }
#c { aspect-ratio: 1 }                             /* không khai width */
#d { width: 200px; aspect-ratio: 16/9 }            /* có nội dung dài */
```

```js
{ chi_width:        { w: 200, h: 112.5 },   ← 200 × 9/16
  width_va_height:  { w: 200, h: 50    },   ← height THẮNG aspect-ratio
  khong_width:      { w: 784, h: 784   },   ← width auto = lấp đầy cha, rồi cao bằng rộng
  co_noi_dung_tran: { w: 200, h: 112.5 } }  ← nội dung tràn ra, tỉ lệ vẫn giữ
```

Ba điều rút ra:

1. Khai `height` tường minh thì `aspect-ratio` bị bỏ qua.
2. Không khai `width` thì nó lấp đầy cha rồi mới tính chiều cao — thường không phải ý bạn.
3. Nội dung dài hơn không làm hộp cao thêm (nó tràn ra). Muốn hộp giãn theo nội dung thì dùng
   `min-height` thay vì tin vào `aspect-ratio`.

### Công dụng quan trọng nhất: chặn nhảy layout (CLS)

```css
img { width: 300px }
#b  { aspect-ratio: 2/1; height: auto }
```

```js
{ khong_khai_bao: { cao: 100 },     ← chỉ biết sau khi ảnh tải xong
  co_aspect_ratio: { cao: 150 } }   ← giữ chỗ ngay từ đầu
```

Ảnh chưa tải xong thì `#a` cao 0 → toàn bộ nội dung phía dưới bị đẩy khi ảnh về. `#b` giữ sẵn 150px nên
không có gì nhảy. Trong dự án landing page:

```css
.hero__media img {
  width: 100%;
  aspect-ratio: 16 / 10;    /* giữ chỗ trước khi ảnh tải xong */
  object-fit: cover;
}
```

(Cách khác, tốt không kém: luôn đặt `width` và `height` trên thẻ `<img>` trong HTML.)

---

## 6. Bẫy `min-width: auto` — nguồn gốc của "sao layout của em bị tràn"

Đây là **cái bẫy tốn nhiều thời gian nhất** với người mới. Nó ẩn, không báo lỗi, và xuất hiện ở cả
flex lẫn grid.

Luật: **flex item và grid item có `min-width` mặc định là `auto`**, nghĩa là "không được hẹp hơn nội
dung tối thiểu của tôi". Với chuỗi không có khoảng trắng, nội dung tối thiểu = cả chuỗi.

```css
.row { display: flex; width: 250px; border: 2px solid red }
.a { flex: 1 }
.b { flex: none; width: 60px }
```
```html
<div class="row"><div class="a">CamOnBanDaDocToiDayDayLaChuoiRatDai</div><div class="b">nút</div></div>
```

```js
{ mac_dinh:       { row_khai_bao: 250, row_scrollWidth: 357,
                    a_rong: 296.6, a_min_width_computed: "auto", tran: true },
  min_width_0:    { row_scrollWidth: 297, a_rong: 190,
                    a_min_width_computed: "0px",  tran: true },
  overflow_hidden:{ row_scrollWidth: 250, a_rong: 190,
                    a_min_width_computed: "auto", tran: false } }
```

Đọc kỹ ba dòng này:

- **Mặc định**: ô `.a` rộng **296px** trong container 250px. `flex: 1` hoàn toàn không giúp gì.
- **`min-width: 0`**: ô co lại đúng 190px, nhưng chữ vẫn tràn ra khỏi ô.
- **`overflow: hidden`**: hết tràn hẳn. Vì `overflow` khác `visible` **tự đặt min-size về 0**.

Công thức đầy đủ cho ô văn bản co được:

```css
.a {
  flex: 1;
  min-width: 0;              /* cho phép co nhỏ hơn nội dung */
  overflow: hidden;          /* cắt phần thừa */
  text-overflow: ellipsis;   /* thêm dấu ... */
  white-space: nowrap;       /* không xuống dòng */
}
```

Bản dọc của cùng cái bẫy:

```css
.col { display: flex; flex-direction: column; height: 200px }
.mid { flex: 1 }              /* không có overflow */
```

```js
{ chi_flex_1: { container_khai_bao: 200, mid_cao: 600,
                mid_min_height: "auto", con_tran_khoi_container: true },
  chi_overflow_auto: { mid_cao: 170, cuon_duoc: true,
                       con_tran_khoi_container: false } }
```

Vùng giữa cao **600px** trong container 200px. Thêm `overflow: auto` là xong — không cần
`min-height: 0` vì `overflow` đã tự làm việc đó.

**Ghi nhớ:** thấy layout tràn mà không hiểu tại sao → kiểm tra `min-width`/`min-height` computed.
Nếu là `auto`, bạn đã tìm ra thủ phạm.

Tôi mắc đúng lỗi này khi làm dự án ở [bài 11](./11-du-an-landing-page.md), ở màn hình 320px.

---

## 7. Đơn vị: khi nào `px`, `rem`, `em`, `ch`, `%`, `dvh`

### `em` nhân dồn qua từng tầng, `rem` thì không

```css
html { font-size: 16px }
.em  { font-size: 1.5em }
.rem { font-size: 1.5rem }
```
```html
<div class="em"><div class="em"><div class="em" id="e3">x</div></div></div>
<div class="rem"><div class="rem"><div class="rem" id="r3">x</div></div></div>
```

```js
{ em_tang3:  "54px",     ← 16 × 1.5 × 1.5 × 1.5
  rem_tang3: "24px" }    ← 16 × 1.5, luôn luôn
```

### `em` trong thuộc tính khác tính theo font-size **của chính element đó**

```css
#p { font-size: 10px }
#c { font-size: 2em; padding: 1em; width: 10em }
```

```js
{ fontSize: "20px",     ← 2em tính theo CHA (10px)
  padding:  "20px",     ← 1em tính theo CHÍNH NÓ (20px)
  width:    "200px" }   ← 10em tính theo CHÍNH NÓ
```

Đây là hành vi hữu ích: đặt `padding: 0.75em` cho nút thì padding tự co giãn theo cỡ chữ của nút.

```css
.btn      { font-size: 1rem;   padding: 0.75em 1.5em }
.btn--nho { font-size: 0.875rem }   /* padding tự nhỏ theo, không cần khai lại */
```

### Bảng chọn đơn vị

| Dùng cho | Đơn vị | Vì sao |
|---|---|---|
| Cỡ chữ | `rem` | tôn trọng cỡ chữ người dùng đặt trong trình duyệt |
| Padding/gap **bên trong component** | `em` | tự co theo cỡ chữ của component |
| Khoảng cách bố cục | `rem` (qua biến) | nhất quán toàn trang |
| Viền, bo góc, đổ bóng | `px` | không nên co giãn |
| Bề rộng đoạn văn | `ch` | `65ch` ≈ 65 ký tự, đúng thứ mắt cần |
| Chiều cao đầy màn hình | `dvh` | `vh` sai trên mobile khi thanh địa chỉ ẩn/hiện |

⚠️ **Đừng đặt `html { font-size: 62.5% }`** để "1rem = 10px cho dễ tính". Nó ghi đè cỡ chữ mà người
dùng cố ý đặt lớn trong cài đặt trình duyệt.

### `vh` / `dvh` / `svh` / `lvh`

```js
{ viewport: 600, vh: 600, dvh: 600, svh: 600, lvh: 600,
  pc_khi_html_body_auto: 0 }
```

Trên máy tính để bàn cả bốn bằng nhau. Khác biệt chỉ lộ ra trên mobile:

| Đơn vị | Nghĩa |
|---|---|
| `svh` | **s**mall — khi thanh địa chỉ **đang hiện** (viewport nhỏ nhất) |
| `lvh` | **l**arge — khi thanh địa chỉ **đã ẩn** (viewport lớn nhất) |
| `dvh` | **d**ynamic — thay đổi theo thời gian thực |
| `vh` | = `lvh` |

`100vh` trên mobile luôn cao hơn phần nhìn thấy → nút "Đăng ký" ở cuối hero bị thanh địa chỉ che.
Dùng `100dvh` hoặc `100svh`.

Chú ý dòng cuối: `height: 100%` cho ra **0** khi `html`/`body` cao `auto` — đúng mục 3.

---

## 8. Cái gì chiếm chỗ, cái gì không

```css
div { width: 50px; height: 50px }
#a { box-shadow: 0 0 0 20px red }
#b { outline: 20px solid blue }
#c { border: 20px solid green }
```

```js
{ shadow:  { w: 50, h: 50 },     ← KHÔNG chiếm chỗ
  outline: { w: 50, h: 50 },     ← KHÔNG chiếm chỗ
  border:  { w: 90, h: 90 },     ← CHIẾM chỗ
  tong_chieu_cao_body: 190 }     ← 50 + 50 + 90
```

Vì `outline` không chiếm chỗ nên nó là thứ đúng để làm viền focus: thêm viền không làm layout nhảy.
Đó cũng là lý do `outline-offset` tồn tại — đẩy viền ra xa mà không ảnh hưởng gì.

```css
:focus-visible {
  outline: 2px solid var(--nhan);
  outline-offset: 3px;
}
```

---

## 9. Thanh cuộn ăn mất bao nhiêu pixel

Trên macOS mặc định là **0** vì thanh cuộn nổi đè lên nội dung:

```js
{ mac_overlay_mac_dinh: { offsetWidth: 200, clientWidth: 200, scrollbar_chiem: 0 },
  ep_15px:              { offsetWidth: 200, clientWidth: 200, scrollbar_chiem: 0 },
  gutter_stable:        { offsetWidth: 200, clientWidth: 185, scrollbar_chiem: 15 } }
```

Trên Windows và Linux, thanh cuộn cổ điển **ăn 15–17px** của chiều rộng. Đây là nguồn gốc của bug
"trang bị giật ngang khi mở modal": bạn đặt `overflow: hidden` lên `body`, thanh cuộn biến mất, 15px
được trả lại, toàn bộ nội dung nhảy sang phải.

Cách sửa — giữ chỗ sẵn cho thanh cuộn:

```css
html { scrollbar-gutter: stable }
```

Dòng cuối trong kết quả đo chứng minh nó hoạt động: `clientWidth` giảm còn 185, tức 15px đã được giữ
chỗ **trước cả khi** thanh cuộn xuất hiện.

---

## 10. Thuộc tính logic — viết một lần, chạy cả RTL

```css
.p  { position: relative }
#a .c { inset: 10px auto auto 10px }
#b .c { inset-block-start: 10px; inset-inline-start: 10px }
#c    { direction: rtl }
#c .c { inset-inline-start: 10px }
```

```js
{ a: { le_trai: 11, le_tren: 11 },     ← inset: top right bottom left
  b: { le_trai: 11, le_tren: 11 },     ← giống hệt trong ngữ cảnh LTR
  c: { le_trai: 171, le_tren: 1 } }    ← RTL: "start" nhảy sang PHẢI
```

| Vật lý | Logic |
|---|---|
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `margin-top` / `margin-bottom` | `margin-block-start` / `margin-block-end` |
| `margin: 0 auto` | `margin-inline: auto` |
| `width` / `height` | `inline-size` / `block-size` |
| `text-align: left` | `text-align: start` |
| `border-left` | `border-inline-start` |

Ngay cả khi không làm trang tiếng Ả Rập, hai dạng viết tắt này vẫn tiện hơn hẳn:

```css
margin-inline: auto;              /* thay margin: 0 auto */
padding-block: var(--kc-8);       /* thay padding-top + padding-bottom */
```

---

## Bài tập

1. Cho `width: 300px; padding: 30px; border: 10px solid`. Tính `offsetWidth` và `clientWidth` với cả
   hai giá trị `box-sizing`. Rồi đo để đối chiếu.

2. Tạo `<div class="p"><div class="c"></div></div>` với `.c { margin-top: 40px }`. Đo chiều cao `.p`.
   Thêm lần lượt 4 cách chặn ở mục 2, ghi lại chiều cao mỗi lần.

3. Đặt `padding: 5%` cho một element trong cha rộng 500px cao 100px. `padding-top` bằng bao nhiêu?

4. Vì sao `height: 100%` không hoạt động trong đoạn này? Nêu 3 cách sửa.
   ```html
   <body><div class="full">nội dung</div></body>
   ```
   ```css
   .full { height: 100%; background: red }
   ```

5. Đo `min-content`, `max-content`, `fit-content` của một `<div>` chứa câu
   `"Trình duyệt tính bố cục theo ràng buộc"`. Ba số này bằng bao nhiêu?

6. Cho `flex` row 300px chứa một ô `flex: 1` với chuỗi 40 ký tự không khoảng trắng. Ô đó rộng bao
   nhiêu? Sửa cho nó co lại đúng và hiện dấu `…`.

7. Trong dự án của bạn, tìm mọi chỗ dùng `margin-bottom` để tạo khoảng cách giữa các item trong một
   danh sách. Đổi sang `gap`. Có chỗ nào hỏng không?

8. Element có `aspect-ratio: 3/2` và `height: 100px`, không khai `width`. Nó rộng bao nhiêu? Còn nếu
   khai cả `width: 400px`?

<details>
<summary>Gợi ý đáp án</summary>

**1.** `content-box`: offsetWidth = 300+60+20 = **380**, clientWidth = **360**.
`border-box`: offsetWidth = **300**, clientWidth = **280**, vùng nội dung = 220.

**2.** Đo thật với `.c` là div **rỗng** (cao 0):

```js
{ none: 0, pad: 1, bor: 1, ovf: 40, flo: 40 }
```

Kết quả `pad: 1` và `bor: 1` có thể làm bạn bất ngờ — tưởng phải là 41. Lý do: một element rỗng thì
margin trên và margin dưới **của chính nó** dính vào nhau trước (self-collapsing), thành một margin
40px duy nhất. Cha lại không có `padding-bottom` hay `border-bottom`, nên margin đó tiếp tục chui qua
mép dưới của cha mà thoát ra ngoài. Cha chỉ còn đúng 1px padding.

`overflow: hidden` và `flow-root` tạo BFC nên chặn hẳn, margin 40px nằm lại bên trong.

Nếu cho `.c` một chiều cao (ví dụ `height: 10px`) thì kết quả thành
`{ none: 10, pad: 51, bor: 51, ovf: 50, flo: 50 }` — đúng như trực giác.

**3.** `25px` — 5% của **500** (chiều rộng cha), không phải của 100.

**4.** Vì `body` và `html` đều cao `auto`. Đo thật:

```js
{ chi_100pc: 18,       ← chỉ bằng chiều cao một dòng chữ
  dung_100dvh: 600,    ← đúng bằng viewport
  viewport: 600 }
```

Ba cách sửa: (a) `html, body { height: 100% }`; (b) `.full { height: 100dvh }`;
(c) `body { display: grid; min-height: 100dvh }` rồi để `.full` tự giãn.
Cách (c) tốt nhất vì nội dung dài hơn màn hình vẫn đúng — hai cách kia sẽ cắt cụt.

**5.** Đo thật (Arial 16px, cha rộng 400px):

```js
{ mn: 41.14,    ← bề rộng từ dài nhất
  mx: 276.25,   ← cả câu trên một dòng
  ft: 276.25 }  ← = max-content vì nó vẫn lọt trong 400px
```

Quan hệ luôn là `min-content ≤ fit-content ≤ max-content`. Thu cha xuống 200px thì `fit-content`
sẽ tụt về 200 còn `max-content` vẫn 276.25 (và tràn ra).

**6.** Ô rộng hơn 300px (bằng cả chuỗi) vì `min-width: auto`. Sửa:
`min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`.

**8.** Chỉ `height: 100px` + `aspect-ratio: 3/2` → rộng **150px**. Khai thêm `width: 400px` thì
`aspect-ratio` bị bỏ qua hoàn toàn: hộp là 400×100.

</details>

---

Tiếp theo: [03-luong-inline-va-chu.md](./03-luong-inline-va-chu.md)
