# Bài 05 — Grid: bố cục hai chiều

Grid khác Flexbox ở một điểm cốt lõi: bạn **định nghĩa khung trước, đặt nội dung vào sau**. Flexbox đi
từ nội dung ra khung; Grid đi từ khung vào nội dung.

Hệ quả thực tế: với Grid, các item ở hàng khác nhau vẫn **thẳng cột** với nhau. Flexbox không làm được
điều đó.

---

## 1. `fr` — đơn vị "phần còn lại"

`1fr` không phải "một phần bằng nhau". Nó là **một phần của không gian còn thừa** sau khi trừ track cố
định và gap.

```css
.g { display: grid; width: 500px; gap: 20px; grid-template-columns: 100px 1fr 2fr }
```

```js
{ container: 500, gap_tong: 40, co_dinh: 100, con_lai: 360,
  cot: [100, 120, 240],
  track: "100px 120px 240px" }
```

Kiểm tra: `500 − 40 (gap) − 100 (cố định) = 360`. Chia 1:2 → 120 và 240. ✅

Đây là ưu thế lớn nhất của Grid so với Flexbox: **gap được trừ tự động**, không phải viết
`calc(33.333% - 6.667px)` như ở [bài 04](./04-flexbox.md).

---

## 2. ⚠️ `1fr` có min là `auto` — bẫy làm các cột KHÔNG bằng nhau

Đây là bẫy quan trọng nhất của Grid, và nó ẩn hơn bẫy của Flexbox vì triệu chứng không phải "tràn" mà
là "cột lệch nhau".

```css
.g { display: grid; width: 400px; grid-template-columns: 1fr 1fr }
```
```html
<div class="g"><div>MotChuoiCucKyDaiKhongNgatDuocODauCaThatDay</div><div>ngắn</div></div>
```

```js
{ '1fr_1fr':      { track: "355.5px 44.5px", o: [355.5, 44.5], tran: false },
  'minmax(0,1fr)':{ track: "200px 200px",    o: [200, 200],    tran: false },
  '1fr + min-width:0 + overflow': { track: "200px 200px", o: [200, 200] } }
```

Hai cột `1fr 1fr` cho ra **355.5px và 44.5px**. Không hề bằng nhau.

**Lý do:** `1fr` là viết tắt của `minmax(auto, 1fr)`. Cái `auto` ở vế min nghĩa là "không được nhỏ hơn
nội dung tối thiểu". Chuỗi 42 ký tự không ngắt được → track phải rộng ít nhất bằng nó.

**Hai cách sửa:**

```css
/* Cách 1: khai min = 0 ngay trong track */
grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);

/* Cách 2: đặt min-width: 0 trên item */
.g > * { min-width: 0 }
```

**Quy tắc thực dụng:** khi cột chứa nội dung động (tên người dùng, tiêu đề bài viết, dữ liệu API), luôn
viết `minmax(0, 1fr)` thay vì `1fr`. Không bao giờ thừa.

Trong dự án ở [bài 11](./11-du-an-landing-page.md):

```css
.grid { grid-template-columns: 200px minmax(0, 1fr) 150px }
```

---

## 3. `repeat(auto-fit, ...)` vs `repeat(auto-fill, ...)`

Cả hai tạo "số cột tuỳ theo chỗ trống". Khác nhau khi **số item ít hơn số cột vừa được**.

Container 700px, `minmax(200px, 1fr)`, gap 10px, nhưng chỉ có **2 item**:

```js
{ auto_fit:  { track: "345px 345px 0px",              o: [345, 345] },
  auto_fill: { track: "226.656px 226.672px 226.672px", o: [226.66, 226.67] } }
```

- **`auto-fit`** — tạo 3 track nhưng **thu track rỗng về 0px**, nên 2 item giãn ra chiếm hết 345px mỗi cái.
- **`auto-fill`** — **giữ nguyên** 3 track, 2 item chỉ chiếm 2 track đầu, cột thứ 3 để trống.

Chọn cái nào:

| | Dùng khi |
|---|---|
| `auto-fit` | Muốn item luôn lấp đầy hàng (lưới card, gallery) |
| `auto-fill` | Muốn giữ nhịp cột cố định (lịch, bàn phím, ô nhập OTP) |

Trong thực tế `auto-fit` được dùng nhiều hơn hẳn.

### ⚠️ `minmax(200px, 1fr)` vẫn tràn khi container hẹp hơn 200px

```js
{ w1: { container: 150, track: "200px",                so_cot: 1, tran: true  },
  w2: { container: 420, track: "205px 205px",          so_cot: 2, tran: false },
  w3: { container: 700, track: "226.6px ×3",           so_cot: 3, tran: false } }
```

Ở container 150px, track vẫn là **200px** → tràn ra 50px. `minmax` đảm bảo tối thiểu 200px, kể cả khi
không có chỗ.

**Cách sửa — `min()`:**

```css
grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
```

```js
{ w1: { container: 150, track: "150px",       tran: false },   ← tự thu về 150
  w2: { container: 700, track: "226.6px ×3",  tran: false } }
```

`min(100%, 200px)` nghĩa là "200px, nhưng không bao giờ vượt quá bề rộng container". Đây là dòng CSS
đáng nhớ nhất của bài này — một dòng lo trọn responsive cho lưới card, **không cần media query nào**.

Dự án landing page dùng đúng nó:

```css
.cards, .plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--kc-5);
}
```

Kết quả đo trên 6 bề rộng màn hình — số cột tự đổi 1 → 2 → 3 mà không có một `@media` nào:

```
    320px  số cột card = 1        900px  số cột card = 3
    375px  số cột card = 1       1280px  số cột card = 3
    600px  số cột card = 2       1920px  số cột card = 3
```

---

## 4. Hàng ngầm và `grid-auto-*`

Khai 2 cột nhưng đưa vào 5 item — Grid tự sinh hàng:

```css
.g { display: grid; width: 300px; grid-template-columns: 1fr 1fr }
#b { grid-auto-rows: 60px }
#c { grid-auto-flow: column; grid-template-rows: 40px 40px }
```

```js
{ mac_dinh:        { rows: "18px 18px 18px",  so_hang_thuc: 3, so_cot_thuc: 2 },
  auto_rows_60:    { rows: "60px 60px 60px",  so_hang_thuc: 3, so_cot_thuc: 2 },
  auto_flow_column:{ rows: "40px 40px",       so_hang_thuc: 2, so_cot_thuc: 3 } }
```

- Mặc định hàng ngầm cao `auto` (bằng nội dung).
- `grid-auto-rows` đặt chiều cao cho mọi hàng ngầm.
- `grid-auto-flow: column` đổi chiều điền: sinh **cột** ngầm thay vì hàng.

`grid-auto-flow: column` rất hợp cho thanh công cụ hoặc bảng dữ liệu ngang:

```css
.thanh-cong-cu {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: max-content;
  gap: .5rem;
}
```

---

## 5. Đặt item: số dòng, `span`, số âm

Grid đánh số **đường kẻ**, không phải ô. Lưới 4 cột có 5 đường: 1, 2, 3, 4, 5. Đếm ngược: −1 là đường
cuối cùng, −2 là áp chót.

```css
.g { display: grid; grid-template-columns: repeat(4, 50px); grid-auto-rows: 30px; width: 200px }
#a { grid-column: 1 / -1 }     /* từ đầu đến cuối */
#b { grid-column: span 2 }     /* chiếm 2 cột, ở đâu cũng được */
#c { grid-column: -2 / -1 }    /* cột cuối cùng */
```

```js
{ a: { x:   0, y:  0, w: 200 },   ← trải hết 4 cột
  b: { x:   0, y: 30, w: 100 },   ← 2 cột ở hàng 2
  c: { x: 150, y: 30, w:  50 } }  ← cột cuối, cùng hàng với b
```

`grid-column: 1 / -1` là cách viết "trải hết chiều ngang" mà **không cần biết có bao nhiêu cột**. Rất
hay dùng cho tiêu đề section trong lưới.

---

## 6. `grid-template-areas` — vẽ layout bằng ASCII

```css
.g {
  display: grid;
  width: 400px; height: 200px;
  grid-template-columns: 100px 1fr 60px;
  grid-template-rows: 40px 1fr 30px;
  grid-template-areas:
    "head head head"
    "side main ."
    "foot foot foot";
}
.h { grid-area: head }   .s { grid-area: side }
.m { grid-area: main }   .f { grid-area: foot }
```

```js
{ h: { x:0,   y:0,   w: 400, h:  40 },
  s: { x:0,   y:40,  w: 100, h: 130 },
  m: { x:100, y:40,  w: 240, h: 130 },
  f: { x:0,   y:170, w: 400, h:  30 } }
```

- Tên lặp lại → ô trải dài qua nhiều cột/hàng.
- Dấu `.` → ô để trống.
- Vùng phải là **hình chữ nhật**, không được hình chữ L.

Ưu điểm lớn nhất: đổi layout ở breakpoint chỉ cần viết lại bức tranh ASCII, không đụng vào item nào:

```css
@media (width < 700px) {
  .g {
    grid-template-columns: 1fr;
    grid-template-areas: "head" "main" "side" "foot";   /* side xuống dưới main */
  }
}
```

---

## 7. `subgrid` — cho các card thẳng hàng với nhau

Đây là thứ Grid thiếu suốt nhiều năm. Bài toán: 3 card trong một hàng, mỗi card có tiêu đề / mô tả /
chân. Tiêu đề dài ngắn khác nhau → phần mô tả và chân **lệch nhau**.

```css
.wrap { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; width: 600px }
.card { display: grid; grid-template-rows: auto 1fr auto }

/* bản subgrid */
.sub { grid-template-rows: auto 1fr auto }
.sub .card { grid-row: span 3; grid-template-rows: subgrid }
```

```js
{ supports_subgrid: true,
  grid_thuong: { y_cua_p:      [22, 44, 22],     ← LỆCH nhau 22px
                 y_cua_footer: [80, 80, 80] },
  subgrid:     { y_cua_p:      [54, 54, 54],     ← thẳng hàng
                 y_cua_footer: [100, 100, 100] } }
```

Với grid thường, đoạn mô tả của card 2 bắt đầu ở y=44 còn hai card kia ở y=22 (vì tiêu đề card 2 dài
hai dòng). Với subgrid, cả ba đều ở y=54.

Cách hoạt động: `grid-template-rows: subgrid` bảo card "đừng tạo lưới riêng, dùng luôn các hàng của
ông nội". Muốn vậy card phải chiếm đúng số hàng đó (`grid-row: span 3`).

---

## 8. `grid-auto-flow: dense` — lấp lỗ, nhưng đảo thứ tự đọc

3 cột, hai item chiếm 2 cột, một item chiếm 1 cột:

```css
.g { display: grid; grid-template-columns: repeat(3, 50px); grid-auto-rows: 30px }
#d { grid-auto-flow: row dense }
.wide { grid-column: span 2 }
```

```js
{ khong_dense: ["1 @ cot1 hang1", "2 @ cot1 hang2", "3 @ cot3 hang2"],
  dense:       ["1 @ cot1 hang1", "2 @ cot1 hang2", "3 @ cot3 hang1"] }
```

Không có `dense`: item 3 xếp sau item 2 → rơi xuống hàng 2, cột 3 hàng 1 bỏ trống.
Có `dense`: item 3 quay lại lấp chỗ trống ở hàng 1.

**Cái giá:** thứ tự nhìn thấy giờ khác thứ tự DOM. Trình đọc màn hình vẫn đọc 1, 2, 3 trong khi mắt
thấy 1, 3, 2. Cùng vấn đề với `order` của Flexbox ở [bài 04](./04-flexbox.md).

Chỉ dùng `dense` cho gallery ảnh — nơi thứ tự không mang ý nghĩa.

---

## 9. Căn chỉnh trong Grid

Grid có **6** thuộc tính căn chỉnh, chia thành hai bộ ba:

```
             trục ngang (inline)   trục dọc (block)     viết gộp
căn item     justify-items         align-items          place-items
trong ô

căn cả lưới  justify-content       align-content        place-content
trong container

căn 1 item   justify-self          align-self           place-self
```

```css
.g { display: grid; grid-template-columns: 100px 100px; grid-auto-rows: 60px;
     justify-items: center; align-items: center }
#s { justify-self: end; align-self: start }
```

```js
[ { text: "a", x_trong_o: 46.4, y_trong_o: 21, w: 7.1, h: 18 },   ← giữa ô
  { text: "b", x_trong_o: 192,  y_trong_o:  0, w: 8,   h: 18 } ]  ← góc trên phải
```

Ghi nhớ nhanh:
- **`items`** = căn nội dung **bên trong từng ô**
- **`content`** = căn **toàn bộ lưới** trong container (chỉ có tác dụng khi lưới nhỏ hơn container)
- **`self`** = ghi đè cho một item

`place-items: center` là cách ngắn nhất để căn giữa hoàn hảo, ngắn hơn cả flexbox:

```css
.giua { display: grid; place-items: center }
```

---

## 10. Công thức Grid hay dùng

```css
/* Lưới card responsive, KHÔNG cần media query */
.luoi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: 1.5rem;
}

/* Layout trang 3 cột, cột giữa co được an toàn */
.trang {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 300px;
  gap: 1rem;
}

/* Bố cục "content + full-bleed": nội dung ở giữa, vài khối tràn hết chiều rộng */
.bai-viet {
  display: grid;
  grid-template-columns: 1fr min(65ch, 100%) 1fr;
}
.bai-viet > * { grid-column: 2 }
.bai-viet > .tran-vien { grid-column: 1 / -1 }

/* Chồng hai element lên nhau mà không cần position: absolute */
.chong {
  display: grid;
}
.chong > * { grid-area: 1 / 1 }

/* Card cao bằng nhau, nút dính đáy */
.card { display: grid; grid-template-rows: auto 1fr auto }

/* Sidebar co lại khi hết chỗ, tự xuống dòng */
.sidebar-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
}
```

Mẫu `.chong` đáng chú ý: đặt mọi con vào cùng ô `1 / 1` khiến chúng chồng lên nhau, nhưng **lưới vẫn
cao bằng con cao nhất** — thứ mà `position: absolute` không làm được.

---

## Bài tập

1. `grid-template-columns: 200px 1fr 2fr`, container 800px, gap 20px. Tính bề rộng từng cột rồi đo để
   kiểm tra.

2. Tạo lưới `1fr 1fr` chứa một chuỗi 50 ký tự không khoảng trắng. Đo bề rộng hai cột. Sửa cho chúng
   bằng nhau, nêu 2 cách.

3. Container 900px, `repeat(auto-fit, minmax(250px, 1fr))`, gap 20px, chỉ có 2 item. Mỗi item rộng bao
   nhiêu? Đổi sang `auto-fill` thì sao?

4. Thu container ở câu 3 xuống 200px. Có tràn không? Sửa bằng `min()`.

5. Vẽ layout này bằng `grid-template-areas`: header full width, sidebar trái 200px, main, aside phải
   250px, footer full width.

6. Ba card có tiêu đề 1, 2, 3 dòng. Làm cho phần chân card của cả ba thẳng hàng. Nêu 2 cách (một dùng
   subgrid, một không).

7. Dùng `grid-column: 1 / -1` cho một item trong lưới `repeat(auto-fit, ...)`. Chuyện gì xảy ra? Vì sao?

8. Làm banner có ảnh nền và chữ đè lên, không dùng `position: absolute`.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `800 − 40 (2 gap) − 200 = 560`. Chia 1:2 → **186.67** và **373.33**.

**2.** Với `1fr 1fr` hai cột lệch hẳn (cột chứa chuỗi phình ra). Hai cách sửa:
`grid-template-columns: minmax(0,1fr) minmax(0,1fr)` hoặc `.g > * { min-width: 0 }`.

**3.** `auto-fit`: 3 track vừa được, track rỗng thu về 0 → 2 item mỗi cái **~440px**.
`auto-fill`: giữ 3 track → mỗi item **~286.67px**, cột 3 để trống.

**4.** Có tràn — track vẫn giữ 250px trong container 200px. Sửa:
`minmax(min(100%, 250px), 1fr)`.

**5.**
```css
grid-template-columns: 200px 1fr 250px;
grid-template-areas: "head head head" "side main aside" "foot foot foot";
```

**6.** (a) Subgrid: cha khai `grid-template-rows: auto 1fr auto`, card khai
`grid-row: span 3; grid-template-rows: subgrid`.
(b) Không subgrid: card dùng `display: grid; grid-template-rows: auto 1fr auto` — chân sẽ dính đáy
card, và các card cao bằng nhau nhờ `align-items: stretch` mặc định. Nhưng phần **mô tả** vẫn lệch;
chỉ subgrid mới làm thẳng được cả 3 hàng.

**7.** Item đó trải hết mọi cột hiện có. Với `auto-fit`, số cột thay đổi theo bề rộng, nên item này tự
động trải đúng số cột đang có — không cần biết trước là mấy.

**8.**
```css
.banner { display: grid }
.banner > * { grid-area: 1 / 1 }
.banner img { width: 100%; height: 100%; object-fit: cover }
.banner .chu { place-self: center; z-index: 1 }
```

</details>

---

Tiếp theo: [06-position-va-stacking.md](./06-position-va-stacking.md)
