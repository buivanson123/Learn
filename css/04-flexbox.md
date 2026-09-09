# Bài 04 — Flexbox: toán chia không gian

Flexbox không "sắp xếp" các item. Nó **giải một bài toán phân bổ**: mỗi item khai một kích thước cơ sở,
rồi phần thừa được chia ra hoặc phần thiếu được trừ đi theo trọng số.

Hiểu đúng phép toán đó thì flexbox trở nên dự đoán được hoàn toàn. Không hiểu thì bạn sẽ mãi ở trạng
thái "thử `flex: 1` xem sao".

---

## 1. `flex` là viết tắt của ba thứ

```css
flex: <grow> <shrink> <basis>
```

| Viết tắt | Đầy đủ | Nghĩa |
|---|---|---|
| `flex: 1` | `1 1 0%` | bỏ qua nội dung, **chia đều** |
| `flex: auto` | `1 1 auto` | lấy nội dung làm gốc rồi mới chia phần thừa |
| `flex: none` | `0 0 auto` | cứng đờ, đúng bằng nội dung |
| `flex: 0 0 200px` | — | cứng đờ 200px |
| `flex: 1 1 200px` | — | gốc 200px, co giãn được |

### Khác biệt giữa `flex: 1` và `flex: auto` — đo thật

Cùng 3 ô có nội dung dài ngắn khác nhau, container 600px:

```css
.row { display: flex; width: 600px }
#a > * { flex: 1 }         #b > * { flex: 1 1 auto }
#c > * { flex: auto }      #d > * { flex: 1 1 0 }
```
```html
<div class="row"><div>ngắn</div><div>một nội dung dài hơn nhiều lần</div><div>vừa</div></div>
```

```js
{ 'flex:1':        [200,    200,    200   ],   ← chia đều tuyệt đối
  'flex:1 1 auto': [141.05, 325.89, 133.06],   ← ô nào nội dung dài thì rộng hơn
  'flex:auto':     [141.05, 325.89, 133.06],   ← giống hệt dòng trên
  'flex:1 1 0':    [200,    200,    200   ] }  ← giống hệt flex:1
```

Khác biệt duy nhất nằm ở `basis`: `0` thì nội dung **không được tính**, `auto` thì nội dung là điểm
xuất phát.

**Chọn cái nào:**
- Muốn các cột **bằng nhau** (thanh nav, lưới nút) → `flex: 1`
- Muốn ô nào nhiều chữ thì rộng hơn (thanh công cụ) → `flex: auto`

### `flex-basis` thắng `width`

```css
#x { width: 100px; flex-basis: 300px }
#y { width: 100px }
#z { width: 100px; flex-basis: auto }
```

```js
{ basis_300_width_100: 300,   ← basis thắng
  chi_width_100: 100,
  basis_auto: 100 }           ← basis: auto nghĩa là "dùng width"
```

Khi thấy `width` bị "phớt lờ" trong flex container, hãy tìm `flex-basis` (thường ẩn trong shorthand
`flex: 1` — nó đặt basis về 0).

---

## 2. `flex-grow` chia phần CÒN THỪA, không chia tổng

Đây là hiểu lầm phổ biến nhất về flexbox.

```css
.row { display: flex; width: 500px }
.row > * { flex-basis: 100px }
#a { flex-grow: 1 }   #b { flex-grow: 3 }
```

```js
{ container: 500, tong_basis: 200, con_thua: 300,
  a_grow1: 175,          ← 100 + 300 × (1/4)
  b_grow3: 325,          ← 100 + 300 × (3/4)
  ti_le_thuc: "1.86" }   ← KHÔNG phải 3
```

Công thức:

```
bề rộng cuối = basis + (không gian thừa) × (grow của tôi / tổng grow)
```

`flex-grow: 3` nghĩa là "khi chia phần thừa, tôi lấy phần gấp 3 nó", **không** phải "tôi rộng gấp 3 nó".

Muốn tỉ lệ bề rộng cuối cùng đúng bằng 1:3 thì phải cho basis = 0:

```css
.row > * { flex-basis: 0 }     /* hoặc dùng flex: 1 và flex: 3 */
```

### Tổng `flex-grow` nhỏ hơn 1 thì KHÔNG lấp hết

```css
#a > * { flex-grow: .25 }      /* tổng = 0.5 */
#b > * { flex-grow: 1 }        /* tổng = 2 */
```

```js
{ tong_grow_0_5: [100, 100],   ← container 400px, chỉ lấp 200px
  tong_grow_2:   [200, 200] }  ← lấp đầy
```

Khi tổng < 1, phần thừa chỉ được chia đúng theo tỉ lệ đó (0.5 = một nửa của 400). Đây là cách cố ý để
"giãn ra một phần". Ít dùng, nhưng biết để không hoảng khi gặp.

---

## 3. `flex-shrink` chia theo TRỌNG SỐ, không chia đều

```css
.row { display: flex; width: 300px }
.row > * { flex-shrink: 1 }
#a { flex-basis: 400px }   #b { flex-basis: 200px }
```

```js
{ tong_basis: 600, container: 300, can_co_lai: 300,
  a_basis400: 200,        ← co mất 200
  b_basis200: 100,        ← co mất 100
  a_co_bao_nhieu: 200, b_co_bao_nhieu: 100 }
```

Phần phải co được chia theo **`shrink × basis`**, không phải theo `shrink` đơn thuần. Ô lớn hơn thì co
nhiều hơn — hợp lý, vì co 200px của một ô 400px (50%) tương đương co 100px của ô 200px (50%).

Đây là lý do `flex-shrink: 0` là thứ bạn cần khi có một ô **không được phép co**:

```css
.avatar { flex: none }             /* = flex: 0 0 auto */
.ten    { flex: 1; min-width: 0 }  /* ô này co thay */
```

---

## 4. Bẫy `min-width: auto` — lỗi flexbox số một

Đã gặp ở [bài 02](./02-box-model.md), nhắc lại vì nó quan trọng nhất bài này.

**Flex item không co nhỏ hơn nội dung tối thiểu của nó, kể cả khi bạn bảo nó co.**

```css
.row { display: flex; width: 250px; border: 2px solid red }
.a { flex: 1 }
.b { flex: none; width: 60px }
```
```html
<div class="row"><div class="a">CamOnBanDaDocToiDayDayLaChuoiRatDai</div><div class="b">nút</div></div>
```

```js
{ mac_dinh:        { row_scrollWidth: 357, a_rong: 296.6,
                     a_min_width_computed: "auto", tran: true  },
  min_width_0:     { row_scrollWidth: 297, a_rong: 190,
                     a_min_width_computed: "0px",  tran: true  },
  overflow_hidden: { row_scrollWidth: 250, a_rong: 190,
                     a_min_width_computed: "auto", tran: false } }
```

Ba cách sửa, theo thứ tự nên dùng:

```css
/* 1. Có overflow — tốt nhất, tự đặt min-size về 0 */
.a { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }

/* 2. min-width: 0 — khi bạn không muốn cắt nội dung */
.a { flex: 1; min-width: 0 }

/* 3. Cho phép ngắt từ */
.a { flex: 1; min-width: 0; overflow-wrap: break-word }
```

### Bản dọc

```css
.col { display: flex; flex-direction: column; height: 200px }
.mid { flex: 1 }
```

```js
{ chi_flex_1: { container_khai_bao: 200, mid_cao: 600,
                mid_min_height: "auto", con_tran_khoi_container: true },
  chi_overflow_auto: { mid_cao: 170, cuon_duoc: true } }
```

Đây là bug "vùng nội dung không cuộn được, cả trang cuộn thay" trong mọi layout kiểu app:

```css
.app     { display: flex; flex-direction: column; height: 100dvh }
.header  { flex: none }
.noi-dung{ flex: 1; overflow: auto }     /* ← dòng quyết định */
.footer  { flex: none }
```

---

## 5. `gap` bị trừ ra TRƯỚC khi chia

```css
.row { display: flex; width: 300px; gap: 20px }
.row > * { flex: 1 }
```

```js
{ container: 300, gap_tong: 40,
  moi_o: [86.66, 86.67, 86.67],
  tong_o: 260 }                    ← 300 − 40
```

Nghe hiển nhiên nhưng nó là nguồn của bug kinh điển khi làm lưới bằng phần trăm:

```css
/* ❌ 3 cột 33.333% + gap 10px = tràn, phải xuống 2 dòng */
.row { display: flex; flex-wrap: wrap; width: 300px; gap: 10px }
.row > * { flex: 0 0 33.333% }
```

```js
{ basis_33pc:  { rong: [99.98, 99.98, 99.98], so_dong: 2 },   ← 3 ô không vừa 1 dòng
  basis_calc:  { rong: [93.33, 93.33, 93.33], so_dong: 1 } }  ← đúng
```

```css
/* ✅ trừ phần gap ra */
.row > * { flex: 0 0 calc(33.333% - 6.667px) }   /* gap 10 × 2 / 3 ô */
```

Phép tính `6.667px` này rất dễ sai. **Đây chính là lúc nên dùng Grid thay vì Flex** —
`grid-template-columns: repeat(3, 1fr)` tự trừ gap, không cần tính gì
([bài 05](./05-grid.md)).

---

## 6. Căn chỉnh: 4 thuộc tính, đừng nhầm

```
                trục chính (main axis)         trục phụ (cross axis)
đặt trên cha    justify-content                align-items
đặt trên con    (không có)                     align-self
nhiều dòng      —                              align-content
```

Với `flex-direction: row` (mặc định): trục chính là **ngang**, trục phụ là **dọc**.
Với `column`: đảo lại. Đây là lý do `justify-content: center` lúc căn ngang lúc căn dọc.

### `justify-content` — đo khoảng cách thật

Container 300px, 3 ô 40px (tổng 120px, thừa 180px):

```js
{ space_between: { le_trai:  0, giua_1_2: 90, giua_2_3: 90, le_phai:  0 },
  space_around:  { le_trai: 30, giua_1_2: 60, giua_2_3: 60, le_phai: 30 },
  space_evenly:  { le_trai: 45, giua_1_2: 45, giua_2_3: 45, le_phai: 45 } }
```

- `space-between` — dồn ra hai mép, không có lề ngoài
- `space-around` — mỗi ô có lề bằng nhau ở hai bên, nên lề ngoài **bằng một nửa** khoảng giữa
- `space-evenly` — mọi khoảng đều nhau, kể cả lề ngoài

`space-around` gần như luôn là thứ bạn **không** muốn (lề ngoài nửa vời trông lệch).

### `align-items` mặc định là `stretch`

```js
{ stretch:    [54, 54, 54],   ← mọi ô cao bằng ô cao nhất
  flex_start: [18, 54, 37],   ← mỗi ô cao theo nội dung
  center:     [18, 54, 37],
  baseline:   [18, 54, 37] }
```

`stretch` là lý do các card trong một hàng tự động cao bằng nhau mà không cần làm gì. Nếu bạn thấy
card cao bằng nhau "một cách khó hiểu" thì đó là nó.

`align-items: baseline` căn theo dòng chữ đầu tiên — hữu ích cho hàng có chữ nhiều cỡ khác nhau:

```css
.plan__price { display: flex; align-items: baseline; gap: .25rem }
```

### ⚠️ `align-content` cần `flex-wrap`

```js
{ flex_khong_wrap_y: 2,     ← align-content bị bỏ qua
  flex_co_wrap_y:   87,     ← căn giữa đúng
  display_block_y:  87 }    ← Chrome 152: align-content chạy cả trên display:block!
```

Dòng cuối là tính năng mới đáng chú ý: `align-content: center` giờ hoạt động trên **block layout**
thường, không cần flex hay grid:

```css
.hop { height: 200px; align-content: center }   /* căn dọc, không cần display gì */
```

---

## 7. `margin: auto` trong flex — mẹo layout đáng nhớ nhất

`margin: auto` nuốt hết không gian thừa về phía nó.

```css
.row { display: flex; width: 400px }
#push { margin-left: auto }
```
```html
<div class="row"><div>Logo</div><div>A</div><div id="push">Đăng nhập</div></div>
```

```js
{ x_cua_item_cuoi: 330.23,
  phai_cua_item_cuoi: 400,   ← dính sát mép phải
  container_rong: 400 }
```

Đây là cách làm navbar "logo trái, menu giữa, nút phải" mà không cần `justify-content: space-between`
(vốn sẽ dàn đều cả 3 nhóm). Trong dự án landing page:

```css
.nav {
  display: flex;
  align-items: center;
  & nav { margin-inline-start: auto }    /* đẩy nav và mọi thứ sau nó sang phải */
}
```

Các dạng khác:

```css
.item { margin-inline: auto }   /* căn giữa một item duy nhất theo trục chính */
.item { margin-top: auto }      /* đẩy xuống đáy trong flex-direction: column */
```

Cái cuối cực hữu dụng cho card có nút luôn nằm đáy:

```css
.card { display: flex; flex-direction: column }
.card .btn { margin-top: auto }
```

---

## 8. `order` đổi thứ tự nhìn thấy, KHÔNG đổi thứ tự đọc

```css
#first { order: 1 }
```
```html
<div class="row"><button id="first">A</button><button id="second">B</button></div>
```

```js
{ x_cua_A: 32.91,   ← A nằm bên phải
  x_cua_B: 8,       ← B nằm bên trái
  thu_tu_dom: ["first", "second"] }   ← DOM không đổi
```

Trình đọc màn hình đọc theo DOM: "A" rồi "B". Người dùng bàn phím bấm Tab cũng đi theo DOM. Nhưng mắt
thấy B trước A.

**Hệ quả:** dùng `order` để đảo vị trí các khối nội dung lớn là lỗi tiếp cận. Chỉ dùng nó cho những
đổi chỗ nhỏ, không ảnh hưởng logic đọc. Nếu cần đảo thứ tự thật, sửa HTML.

Cùng vấn đề với `row-reverse`, `column-reverse`, và `grid-auto-flow: dense`.

---

## 9. Khi nào Flex, khi nào Grid

Cùng một layout 3 cột "holy grail":

```css
.grid { display: grid; grid-template-columns: 200px minmax(0,1fr) 150px; gap: 10px; width: 600px }

.flex { display: flex; gap: 10px; width: 600px }
.flex > :nth-child(1) { flex: 0 0 200px }
.flex > :nth-child(2) { flex: 1; min-width: 0 }
.flex > :nth-child(3) { flex: 0 0 150px }
```

```js
{ grid: [200, 230, 150],
  flex: [200, 230, 150] }    ← kết quả y hệt
```

Kết quả giống nhau, nhưng grid cần **1 dòng** còn flex cần **4 dòng**.

| Chọn Flex khi | Chọn Grid khi |
|---|---|
| Bố cục **một chiều** (một hàng hoặc một cột) | Bố cục **hai chiều** (hàng và cột cùng lúc) |
| Số item không biết trước | Cần các item **thẳng hàng** cả ngang lẫn dọc |
| Kích thước do **nội dung** quyết định | Kích thước do **khung** quyết định |
| Thanh nav, nhóm nút, chip | Lưới card, layout trang, bảng giá |

Quy tắc thực dụng: **cần tính `calc()` để trừ gap → chuyển sang Grid.**

---

## 10. Công thức flex hay dùng

```css
/* Thanh nav: logo trái, menu phải */
.nav { display: flex; align-items: center; gap: 1rem }
.nav .menu { margin-inline-start: auto }

/* Ô text co được, có dấu ... */
.ten { flex: 1; min-width: 0; overflow: hidden;
       text-overflow: ellipsis; white-space: nowrap }

/* Ảnh đại diện không bao giờ méo */
.avatar { flex: none; width: 40px; aspect-ratio: 1; object-fit: cover }

/* Card có nút dính đáy */
.card { display: flex; flex-direction: column; gap: .5rem }
.card .btn { margin-top: auto }

/* Layout app: header + nội dung cuộn + footer */
.app { display: flex; flex-direction: column; height: 100dvh }
.app > header, .app > footer { flex: none }
.app > main { flex: 1; overflow: auto }

/* Nhóm chip tự xuống dòng */
.chips { display: flex; flex-wrap: wrap; gap: .5rem }

/* Căn giữa hoàn hảo */
.giua { display: flex; align-items: center; justify-content: center }
/* hoặc ngắn hơn */
.giua { display: grid; place-items: center }
```

---

## Bài tập

1. Container 800px, 3 item `flex-basis: 100px` với `flex-grow` lần lượt 1, 2, 5. Tính bề rộng từng
   item bằng tay rồi đo để kiểm tra.

2. Container 400px, 2 item `flex-basis` 300px và 500px, cả hai `flex-shrink: 1`. Mỗi item rộng bao
   nhiêu?

3. Item nào rộng hơn: `flex: 1` với nội dung 5 từ, hay `flex: 1` với nội dung 50 từ? Còn với
   `flex: auto`?

4. Sửa layout này để `.ten` co được và hiện `…` khi tràn:
   ```html
   <div class="row"><img class="avatar"><span class="ten">Nguyễn Văn Rất Dài Tên</span><button>Xoá</button></div>
   ```

5. Làm lưới 4 cột đều nhau, gap 16px, bằng flex. Rồi làm lại bằng grid. So sánh số dòng CSS.

6. Container `flex-direction: column; height: 400px`. Item giữa có nội dung cao 1000px. Vì sao nó
   không cuộn? Sửa thế nào?

7. Vì sao đoạn này không đẩy nút xuống đáy card?
   ```css
   .card { display: flex; flex-direction: column; height: 300px }
   .card .btn { align-self: flex-end }
   ```

8. Dùng `order` đảo vị trí hai nút "Huỷ" và "Lưu". Bấm Tab xem thứ tự có đổi không. Đây có phải cách
   làm đúng không?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Tổng basis 300, thừa 500, tổng grow 8.
Item 1 = 100 + 500×(1/8) = **162.5**; item 2 = 100 + 500×(2/8) = **225**;
item 3 = 100 + 500×(5/8) = **412.5**.

**2.** Tổng basis 800, container 400, cần co 400. Trọng số = shrink × basis → 300 và 500, tổng 800.
Item 1 co 400×(300/800) = 150 → còn **150px**. Item 2 co 400×(500/800) = 250 → còn **250px**.

**3.** Với `flex: 1` (basis 0) — **bằng nhau**, nội dung không được tính. Với `flex: auto` (basis auto)
— ô 50 từ rộng hơn hẳn.

**4.**
```css
.row { display: flex; align-items: center; gap: .5rem }
.avatar { flex: none }
.ten { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
button { flex: none }
```

**5.** Flex: `.row{display:flex;flex-wrap:wrap;gap:16px}` + `.row>*{flex:0 0 calc(25% - 12px)}` — phải
tự tính `12px`. Grid: `.row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}` — xong.

**6.** Vì `min-height` mặc định của flex item là `auto`, item giữa không co xuống dưới chiều cao nội
dung. Sửa: thêm `overflow: auto` (đủ rồi) hoặc `min-height: 0; overflow: auto`.

**7.** `align-self` tác động lên **trục phụ**. Với `flex-direction: column`, trục phụ là **ngang**, nên
`flex-end` đẩy nút sang phải chứ không xuống đáy. Đo thật trong card 200×300:

```js
{ align_self_flex_end: { x_trong_card: 161.2, y_trong_card:  51, cach_day: 230 },
  margin_top_auto:     { x_trong_card:   1,   y_trong_card: 280, cach_day:   1 } }
```

Nút bị đẩy sang **phải** (x = 161) mà vẫn cách đáy 230px. Đúng phải là `margin-top: auto`.

**8.** Thứ tự Tab **không đổi** — vẫn theo DOM. Không phải cách làm đúng: người dùng bàn phím sẽ focus
vào "Huỷ" khi mắt đang ở "Lưu". Sửa thứ tự trong HTML thay vì dùng `order`.

</details>

---

Tiếp theo: [05-grid.md](./05-grid.md)
