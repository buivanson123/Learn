# Bài 01 — Cascade và selector: vì sao rule của bạn không ăn

Đây là **bài quan trọng nhất** của cả bộ. Khoảng 70% thời gian người ta "vật lộn với CSS" thực chất là
đang gặp đúng một chuyện: rule mình viết bị một rule khác đè, và mình không biết rule nào.

Trình duyệt không bao giờ phân vân. Nó chạy một thuật toán xếp hạng **cố định, 6 bước**. Học thuộc 6
bước đó là xong.

Mọi kết quả dưới đây đo thật trên Chrome 152 theo cách ở [bài 00](./00-moi-truong-va-devtools.md).

---

## 1. Sáu bước xếp hạng, theo đúng thứ tự trình duyệt xét

Khi hai rule cùng khai `color` cho một element, trình duyệt xét lần lượt. **Bước nào phân được thắng
thua thì dừng ngay**, không xét tiếp:

| # | Bước | Ví dụ ai thắng |
|---|---|---|
| 1 | **Origin + `!important`** | style của bạn > style mặc định trình duyệt |
| 2 | **Thứ tự `@layer`** | layer khai sau thắng layer khai trước |
| 3 | **Ngoài layer thắng trong layer** | rule không nằm trong `@layer` nào thắng mọi layer |
| 4 | **Inline style** | `style="..."` thắng mọi rule trong stylesheet |
| 5 | **Specificity** | `#id` > `.class` > `p` |
| 6 | **Thứ tự xuất hiện** | rule viết sau thắng |

Chú ý: **specificity chỉ là bước 5**. Người ta hay coi nó là luật duy nhất, nên khi `@layer` xuất
hiện thì thấy "CSS bị hỏng".

---

## 2. Specificity — ba con số, không phải một điểm số

Specificity là bộ ba `(id, class, thẻ)`. So sánh từ trái sang phải như so số phiên bản.

| Selector | (id, class, thẻ) |
|---|---|
| `p` | (0, 0, 1) |
| `.a` | (0, 1, 0) |
| `p.a` | (0, 1, 1) |
| `#b` | (1, 0, 0) |
| `[type="text"]`, `:hover`, `:nth-child(2)` | (0, 1, 0) — tính như class |
| `::before`, `::after` | (0, 0, 1) — tính như thẻ |
| `*`, `>`, `+`, `~`, ` ` | (0, 0, 0) — **không tính gì** |
| `:not(...)`, `:is(...)`, `:has(...)` | lấy specificity **cao nhất** bên trong |
| `:where(...)` | **luôn (0, 0, 0)** |

### Đo thật — 4 rule cùng nhắm một thẻ

```css
p     { color: rgb(1,0,0) }    /* (0,0,1) */
.a    { color: rgb(2,0,0) }    /* (0,1,0) */
#b    { color: rgb(3,0,0) }    /* (1,0,0) */
p.a   { color: rgb(4,0,0) }    /* (0,1,1) */
```
```html
<p id="b" class="a">x</p>
```

```js
getComputedStyle(document.querySelector('p')).color
-> "rgb(3, 0, 0)"      ← #b thắng
```

### Ba con số KHÔNG cộng dồn thành một số

Đây là chỗ nhiều người hiểu sai. Không có chuyện "id = 100 điểm, class = 10 điểm" nên "20 class = 200
điểm > 100 điểm".

```css
#id { color: rgb(0,0,255) }
.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1 { color: rgb(0,255,0) }
```
```html
<p id="id" class="c1">x</p>
```

```js
-> "rgb(0, 0, 255)"     ← id vẫn thắng, dù đối thủ có (0, 20, 0)
```

So sánh `(1,0,0)` với `(0,20,0)`: xét con số đầu tiên, `1 > 0`, dừng. Số class không được nhìn tới.

---

## 3. `:is()` và `:where()` — gộp selector, nhưng khác nhau ở một điểm chí mạng

`:is()` lấy specificity **cao nhất** trong ngoặc. `:where()` **luôn bằng 0**.

```css
:is(p, #zzz)     { color: rgb(255,0,0) }         /* = (1,0,0) vì có #zzz bên trong */
.cls             { color: rgb(0,128,0) }         /* = (0,1,0) */

:where(#aaa, p)  { background: rgb(255,255,0) }  /* = (0,0,0) dù có #aaa */
p                { background: rgb(0,0,255) }    /* = (0,0,1) */
```
```html
<p class="cls">x</p>
```

```js
{ color_thang: "rgb(255, 0, 0)",        ← :is() thắng .cls, vì #zzz kéo nó lên (1,0,0)
  background_thang: "rgb(0, 0, 255)" }  ← p thắng :where(), vì :where() là 0
```

Chú ý: `#zzz` **không tồn tại trong HTML**. Nó vẫn kéo specificity lên. Đây là bẫy thật:

```css
/* Bạn viết cho tiện, không ngờ nó nâng specificity của cả rule */
:is(.card, #legacy-wrapper) .title { ... }   /* trở thành (1,0,1), rất khó đè */
```

### Dùng đúng chỗ

**`:where()` cho reset và style mặc định** — để người dùng thư viện dễ đè:

```css
:where(h1, h2, h3) { margin-block: 0 }        /* (0,0,0), một class bất kỳ cũng đè được */
```

**`:is()` để rút gọn selector dài**, chỉ khi bạn muốn giữ specificity:

```css
/* thay vì */
.prose h1, .prose h2, .prose h3 { color: navy }
/* viết */
.prose :is(h1, h2, h3) { color: navy }
```

### ⚠️ Bẫy: `:is()` chứa toàn thẻ thì specificity KHÔNG tăng, gây hoà

```css
:where(h1,h2,h3) { margin-block: 0 }
.prose :is(h1,h2,h3) { color: rgb(0,100,200) }   /* (0,1,0) + (0,0,1) = (0,1,1) */
.prose h2           { color: rgb(200,0,0) }      /* (0,1,0) + (0,0,1) = (0,1,1) */
```

```js
{ mau_thuc_te: "rgb(200, 0, 0)",   ← HOÀ specificity, rule viết SAU thắng
  margin: "0px" }
```

Hai rule cùng `(0,1,1)`. Bước 5 không phân được, rơi xuống bước 6 — thứ tự. Nếu bạn đảo hai dòng cho
nhau, kết quả đảo ngược. Đây là loại bug "sửa chỗ này hỏng chỗ kia" kinh điển.

---

## 4. `@layer` — thứ hạng đứng TRÊN specificity

Đây là thay đổi lớn nhất của CSS trong 5 năm qua, và là câu trả lời thật sự cho `!important`.

### Luật 1 — layer khai sau thắng, bất kể specificity

```css
@layer base, theme;                                  /* khai thứ tự trước */

@layer theme { p { color: rgb(0,200,0) } }           /* (0,0,1) */
@layer base  { p#id.cls { color: rgb(200,0,0) } }    /* (1,1,1) — mạnh hơn nhiều */
```
```html
<p id="id" class="cls">x</p>
```

```js
-> "rgb(0, 200, 0)"     ← theme thắng, dù selector yếu hơn hẳn
```

Đọc kỹ: `p` (yếu nhất) đánh bại `p#id.cls` (mạnh nhất) chỉ vì nó nằm ở layer khai sau. Specificity
**chỉ được xét trong cùng một layer**.

Dòng `@layer base, theme;` ở đầu file là chỗ định nghĩa thứ tự. Viết nó ngay dòng đầu tiên,
trước cả `@import`, để thứ tự không phụ thuộc vào việc file nào tải xong trước.

### Luật 2 — CSS không nằm trong layer nào thắng MỌI layer

```css
@layer a, b;
@layer b { p#id.cls { color: rgb(200,0,0) } }
p { color: rgb(0,0,200) }                 /* ngoài layer, selector yếu nhất */
```

```js
-> "rgb(0, 0, 200)"     ← CSS ngoài layer thắng
```

Hệ quả thực tế: **nhét thư viện vào layer, giữ code của bạn ở ngoài** thì bạn luôn đè được nó:

```css
@import url("thu-vien.css") layer(vendor);
/* CSS của bạn viết bình thường, không cần layer, không cần !important */
```

### Luật 3 — `!important` ĐẢO NGƯỢC thứ tự layer

Đây là chỗ khiến nhiều người bối rối nhất, nhưng nó nhất quán:

```css
@layer base, theme;
@layer theme { p { color: rgb(0,200,0) !important } }
@layer base  { p { color: rgb(200,0,0) !important } }
p { color: rgb(0,0,255) !important }        /* ngoài layer + important */
```

```js
-> "rgb(200, 0, 0)"     ← base thắng!
```

Không có `!important` thì thứ tự ưu tiên là: `ngoài layer > theme > base`.
Có `!important` thì lật ngược: `base > theme > ngoài layer`.

Lý do thiết kế: `!important` sinh ra để **người dùng cuối** (user stylesheet, ví dụ người khiếm thị đặt
cỡ chữ tối thiểu) luôn thắng được **tác giả trang**. Đảo ngược mọi thứ hạng là cách giữ đúng tinh thần
đó ở mọi cấp.

**Kết luận thực dụng:** một khi đã dùng `@layer`, đừng dùng `!important` nữa. Bạn sẽ tự làm rối chính
mình.

### Thứ tự layer nên đặt thế nào

Đây là thứ tự dùng trong dự án ở [bài 11](./11-du-an-landing-page.md), đọc ra được từ trình duyệt:

```js
[...s.cssRules].filter(r => r.constructor.name === 'CSSLayerBlockRule').map(r => r.name)
-> ["reset", "token", "base", "layout", "component", "utility"]
```

```css
@layer reset,      /* đè mặc định trình duyệt */
       token,      /* biến, không sinh rule nào */
       base,       /* style cho thẻ trần: body, h1, a */
       layout,     /* khung trang: .shell, .section */
       component,  /* .btn, .card — phần lớn code nằm đây */
       utility;    /* .an-di, .chi-doc-man-hinh — thắng tất cả */
```

Nhờ vậy, `.btn` ở layer `component` luôn đè được `a` ở layer `base` mà **không cần** viết
`a.btn` hay `!important`.

Kiểm lại toàn bộ 491 dòng CSS của dự án, `!important` chỉ xuất hiện **5 lần**, và không lần nào để
giải quyết tranh chấp cascade:

```
$ grep -n '!important' styles.css
25:      animation-duration: 1ms !important;         ← khối prefers-reduced-motion
26:      animation-iteration-count: 1 !important;
27:      transition-duration: 1ms !important;
28:      scroll-behavior: auto !important;
485:  .an-di { display: none !important; }            ← layer utility
```

Bốn dòng đầu **bắt buộc** phải có `!important`: chúng phải thắng cả style inline do JS animation đặt
ra, mà `@layer` không với tới style inline được (bước 4 đứng trên bước 2–3 trong bảng ở mục 1). Đây là
một trong số rất ít trường hợp `!important` là câu trả lời đúng.

---

## 5. `!important` và inline style xếp ở đâu

```css
p { color: rgb(255,0,0) !important }
#q { color: rgb(0,255,0) }
```
```html
<p id="q" style="color: rgb(0,0,255)">x</p>
```

```js
-> "rgb(255, 0, 0)"     ← !important trong stylesheet thắng inline style
```

Nhưng inline **cũng** dùng được `!important`, và khi đó nó thắng:

```html
<p style="color: rgb(0,0,255) !important">x</p>
```
```js
-> "rgb(0, 0, 255)"
```

Thứ tự đầy đủ, từ yếu tới mạnh:

```
1. rule thường trong layer
2. rule thường ngoài layer
3. inline style
4. rule !important trong stylesheet (layer đảo ngược)
5. inline style !important
```

---

## 6. `:has()` — chọn cha dựa trên con

Trước 2023 việc này bắt buộc phải dùng JavaScript. Giờ là một selector.

```css
div:has(> img)            { outline: 2px solid rgb(255,0,0) }
label:has(input:checked)  { color: rgb(0,150,0) }
```
```html
<div id="d1"><img alt=""></div>
<div id="d2"><p>không có img</p></div>
<label id="l1"><input type="checkbox" checked> đã tick</label>
<label id="l2"><input type="checkbox"> chưa tick</label>
```

```js
{ d1_outline: "rgb(255, 0, 0)",   ← có img -> có viền
  d2_outline: "none",             ← không img -> không viền
  l1: "rgb(0, 150, 0)",           ← checkbox đã tick -> label xanh
  l2: "rgb(0, 0, 0)" }            ← chưa tick -> màu thường
```

`l1`/`l2` là ví dụ đắt giá: **CSS phản ứng với trạng thái form mà không cần một dòng JS nào.**

### Các dạng dùng nhiều

```css
/* form có lỗi -> đổi cả khung ngoài */
.field:has(input:invalid) { border-color: red }

/* card không có ảnh -> bố cục khác */
.card:not(:has(img)) { grid-template-columns: 1fr }

/* dropdown đang mở -> khoá cuộn body (kết hợp với :has trên html) */
html:has(dialog[open]) { overflow: hidden }

/* đoạn văn ngay sau tiêu đề -> bỏ margin trên */
h2 + p { margin-top: 0 }
/* hoặc chiều ngược lại: tiêu đề nào có đoạn văn theo sau */
h2:has(+ p) { margin-bottom: .25rem }
```

### Specificity của `:has()`

Giống `:is()` — lấy cái mạnh nhất bên trong:

```css
div:has(.x)     /* (0,1,1) */
div:has(#x)     /* (1,0,1) ← cẩn thận */
div:has(:where(#x))  /* (0,0,1) ← cách dập specificity xuống */
```

### Giới hạn

- **Không lồng `:has()` trong `:has()`**.
- **Không dùng pseudo-element bên trong**: `:has(::before)` không hợp lệ.
- Chi phí tính toán cao hơn selector thường. Với danh sách vài nghìn dòng, nên đo lại
  ([bài 10](./10-hieu-nang-render.md)).

---

## 7. Nesting — CSS lồng nhau, không cần Sass

### `&` giờ là tuỳ chọn

```css
.card { p { color: rgb(0,170,0) } }     /* viết thẻ trần, không cần & */
```
```js
-> "rgb(0, 170, 0)"     ← chạy bình thường
```

Vẫn **cần** `&` khi selector con bắt đầu bằng thứ khác thẻ, hoặc khi bạn muốn nối chuỗi:

```css
.btn {
  background: blue;

  &:hover      { background: darkblue }    /* cần & — nối liền, không có dấu cách */
  &.btn--to    { padding: 1rem }           /* cần & */
  & .icon      { margin-right: .5rem }     /* & thừa nhưng viết cũng được */
  .icon        { margin-right: .5rem }     /* tương đương dòng trên */
}
```

Khác biệt cốt tử: `&:hover` là **`.btn:hover`**, còn `:hover` (không có `&`) là
**`.btn *:hover`** — mọi con đang hover. Sai chỗ này thì hiệu ứng nhảy lung tung.

Đọc thẳng từ trình duyệt cho chắc:

```css
.menu  { :hover  { background: red } }
.menu2 { &:hover { background: lime } }
```

```js
[...document.styleSheets[0].cssRules].map(r => [...r.cssRules].map(x => x.selectorText))
-> { rule_trong_menu:  ["& :hover"],    ← có DẤU CÁCH: đây là selector hậu duệ
     rule_trong_menu2: ["&:hover"] }    ← dính liền: chính element đó
```

### ⚠️ Bẫy lớn nhất của nesting: `&` biên dịch thành `:is()`

```css
#app, .card { & p { color: rgb(255,0,0) } }
.card p     { color: rgb(0,0,255) }
```
```html
<div class="card"><p>x</p></div>
```

```js
-> "rgb(255, 0, 0)"    ← rule lồng thắng, dù viết trước
```

Vì sao? `& p` với `&` = `#app, .card` được dịch thành `:is(#app, .card) p`. Mà `:is()` lấy specificity
cao nhất → `#app` → `(1,0,0)`. Cộng thêm `p` → **(1,0,1)**.

Rule `.card p` chỉ là `(0,1,1)`. Thua đứt.

**Bài học:** đừng gộp nhiều selector khác cấp làm gốc của một khối lồng. Nếu buộc phải, bọc trong
`:where()`:

```css
:where(#app, .card) { & p { color: red } }    /* giờ chỉ còn (0,0,1) */
```

### Quy tắc đừng lồng quá 2 tầng

Lồng sâu tạo ra selector dài và specificity cao mà bạn không nhìn thấy. Trong dự án landing page, chỗ
lồng sâu nhất là 2 tầng:

```css
.plan {
  & li { padding-inline-start: var(--kc-5); position: relative }
  & li::before { content: "✓"; color: var(--nhan) }
}
```

---

## 8. `@scope` — giới hạn phạm vi, kể cả "vùng bánh vòng"

Chrome 152 hỗ trợ đầy đủ:

```css
@scope (.card) to (.slot) {
  p { color: rgb(0,0,255) }
}
```
```html
<div class="card">
  <p id="in">trong</p>
  <div class="slot"><p id="out">trong slot</p></div>
</div>
<p id="far">ngoài</p>
```

```js
{ supports_scope: true,
  trong: "rgb(0, 0, 255)",     ← nằm trong .card, ăn
  trong_slot: "rgb(0, 0, 0)",  ← đã lọt vào .slot, KHÔNG ăn
  ngoai: "rgb(0, 0, 0)" }      ← ngoài .card, không ăn
```

`to (.slot)` cắt một "lỗ" ra khỏi phạm vi. Đây là thứ Sass không làm được: giới hạn style tới đúng
biên của một component mà không cần đặt tên class theo BEM.

---

## 9. Kế thừa và bốn từ khoá đặt lại giá trị

### Thuộc tính nào kế thừa

Đặt tất cả lên cha, đọc ở con:

```css
#par { color: rgb(0,100,0); font-size: 20px; line-height: 2;
       border: 3px solid red; padding: 9px;
       text-align: right; cursor: pointer; visibility: hidden }
```

```js
{ color: "rgb(0, 100, 0)",   fontSize: "20px",     lineHeight: "40px",   // ✅
  textAlign: "right",        cursor: "pointer",    visibility: "hidden",  // ✅
  borderTopWidth: "0px",     paddingTop: "0px" }                          // ❌
```

Chú ý `lineHeight: "40px"` — cha khai `line-height: 2` với `font-size: 20px`, con nhận **giá trị đã
tính** là 40px. Chuyện này gây bug thật, xem [bài 03](./03-luong-inline-va-chu.md).

### `inherit` / `initial` / `unset` / `revert`

```css
#par { color: rgb(0,100,0) }
#a { color: unset }     #b { color: initial }    #c { color: revert }
span { color: rgb(255,0,255) }
```

```js
{ unset:   "rgb(0, 100, 0)",   ← thuộc tính kế thừa -> unset = inherit
  initial: "rgb(0, 0, 0)",     ← về giá trị gốc của spec (đen)
  revert:  "rgb(0, 100, 0)" }  ← về giá trị mà user-agent stylesheet cho; span không có
                                  color mặc định nên rơi về kế thừa
```

| Từ khoá | Nghĩa |
|---|---|
| `inherit` | luôn lấy của cha |
| `initial` | về giá trị gốc trong đặc tả (thường **không** phải cái bạn muốn) |
| `unset` | kế thừa nếu là thuộc tính kế thừa, còn lại như `initial` |
| `revert` | bỏ style của **bạn**, quay về style của trình duyệt |
| `revert-layer` | bỏ style của layer hiện tại, quay về layer trước đó |

Muốn "xoá sạch style tôi đã đặt cho thẻ này", dùng `revert` chứ đừng dùng `initial`:

```css
p  { color: rgb(255,0,0); font-size: 40px; margin: 0; display: flex }
#b { all: revert }
```

```js
{ khong_revert: { color: "rgb(255, 0, 0)", fontSize: "40px",
                  marginTop: "0px",  display: "flex"  },
  co_revert:    { color: "rgb(0, 0, 0)",   fontSize: "16px",
                  marginTop: "16px", display: "block" } }
```

`all: revert` trả về **đúng style trình duyệt cho `<p>`**: 16px, `margin` trên 16px, `display: block`.
Nếu dùng `all: initial` thì `display` sẽ về `inline` — giá trị gốc trong đặc tả, không phải giá trị
trình duyệt dành cho thẻ `<p>`. Gần như luôn là thứ bạn không muốn.

---

## 10. `:nth-child` — hai bẫy nhỏ hay gặp

### `:nth-child` đếm MỌI anh em, `:nth-of-type` chỉ đếm cùng thẻ

```css
p:nth-child(2) { color: rgb(255,0,0) }
```
```html
<div><h4>tiêu đề</h4><p id="p1">p thứ nhất</p><p id="p2">p thứ hai</p></div>
```

```js
{ p1_la_child_thu_2: "rgb(255, 0, 0)",   ← p đầu tiên lại là con thứ 2
  p2_la_child_thu_3: "rgb(0, 0, 0)" }
```

`<h4>` chiếm mất vị trí số 1. Muốn "đoạn văn thứ hai" thì dùng `p:nth-of-type(2)`.

### `:nth-child(n of .cls)` — đếm trong tập đã lọc

```css
li:nth-child(2 of .active) { color: rgb(0,150,0) }
li:nth-of-type(2)          { background: #ffc }
```
```html
<ul><li class="active" id="a">1 active</li>
    <li id="b">2 thường</li>
    <li class="active" id="c">3 active</li></ul>
```

```js
{ supports: true,
  a: "rgb(0, 0, 0)",
  c_la_active_thu_2: "rgb(0, 150, 0)",   ← li thứ 3 nhưng là .active thứ 2
  nth_of_type_2_la: "b" }
```

Cực hữu dụng khi làm bảng có dòng bị ẩn. Đo thật với 4 dòng, dòng 2 bị `display: none`:

```css
li { background: #fff }
li:nth-child(odd of :not(.an)) { background: rgb(200,220,255) }
.an { display: none }
```

```js
{ li1: "rgb(200, 220, 255)",   ← sọc
  li2: "rgb(255, 255, 255)",   ← bị ẩn, không tính
  li3: "rgb(255, 255, 255)",
  li4: "rgb(200, 220, 255)" }  ← sọc, vì nó là phần tử KHÔNG ẩn thứ 3
```

Dùng `:nth-child(odd)` thường thì li3 sẽ bị tô — sai, vì mắt người chỉ thấy 3 dòng và dòng thứ 2 nhìn
thấy được lại là li3.

---

## Bài tập

1. Cho `p.a` `(0,1,1)` và `#b` `(1,0,0)`. Viết một selector thứ ba có specificity nằm **giữa** hai
   cái đó. Chứng minh bằng cách đo.

2. Đoán kết quả trước khi chạy:
   ```css
   @layer a, b;
   @layer b { .x { color: red } }
   @layer a { .x { color: blue !important } }
   ```

3. Bạn phải đè `padding` của một component trong thư viện, selector của nó là
   `.lib .card .body` `(0,3,0)`. Nêu **ba** cách làm, không cách nào dùng `!important`.

4. Viết `:has()` cho: "form nào có ít nhất một input đang lỗi thì nút submit chuyển sang xám".

5. Đoạn nesting này sai ở đâu?
   ```css
   .menu {
     :hover { background: #eee }
   }
   ```

6. Vì sao `:where()` phù hợp cho file reset còn `:is()` thì không?

7. Cho:
   ```css
   #app, .card { & .title { color: red } }
   .card .title { color: blue }
   ```
   Màu nào thắng? Sửa để `.card .title` thắng mà không đổi thứ tự hai dòng.

8. Dùng `@scope` viết style cho `.article p` nhưng **không** áp vào các `p` nằm trong `.comments` lồng
   bên trong.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Bất kỳ selector nào có 0 id và ≥ 2 class, ví dụ `.a.b` `(0,2,0)`. So sánh:
`(0,1,1) < (0,2,0) < (1,0,0)`.

**2.** `blue` thắng. Cả hai đều `(0,1,0)` nên specificity hoà; `!important` ở layer `a` — mà với
`!important` thì thứ tự layer **đảo ngược**, layer khai trước thắng. Ngoài ra chỉ một rule có
`!important` nên nó thắng ngay ở bước 1.

**3.** (a) Bọc thư viện vào `@layer vendor` rồi viết CSS của bạn ngoài layer.
(b) Viết selector specificity cao hơn: `.lib .card .body.body` `(0,4,0)`.
(c) Dùng `@scope` hoặc inline style. Cách (a) là cách nên chọn.

**4.**
```css
form:has(input:invalid) button[type="submit"] { background: #ccc; pointer-events: none }
```

**5.** Thiếu `&`. `:hover` không có `&` được hiểu là `.menu *:hover` — mọi thẻ con khi hover. Đúng
phải là `&:hover`.

**6.** File reset cần specificity **thấp nhất có thể** để mọi rule sau đó đè được mà không phải nghĩ.
`:where()` luôn (0,0,0). `:is()` giữ nguyên specificity cao nhất bên trong nên reset của bạn sẽ
"cứng đầu" một cách bất ngờ.

**7.** `red` thắng: `&` = `:is(#app, .card)` → `(1,0,0)`, cộng `.title` → `(1,1,0)`, đè `(0,2,0)`.
Sửa bằng `:where(#app, .card) { & .title { color: red } }` → `(0,1,0)`, thua `(0,2,0)`.

**8.**
```css
@scope (.article) to (.comments) {
  p { line-height: 1.7 }
}
```

</details>

---

Tiếp theo: [02-box-model.md](./02-box-model.md)
