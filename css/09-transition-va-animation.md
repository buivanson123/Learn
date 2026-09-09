# Bài 09 — Transition, animation, và những thứ trước đây phải dùng JavaScript

Bốn tính năng mới của CSS đã xoá sổ những đoạn JavaScript mà ai làm web cũng từng viết:

| Việc | Trước đây | Bây giờ |
|---|---|---|
| Mở accordion mượt | `max-height: 1000px` (số ma thuật) | `interpolate-size: allow-keywords` |
| Đóng modal có hiệu ứng | `setTimeout` rồi mới `display: none` | `transition-behavior: allow-discrete` |
| Hiệu ứng khi element vừa xuất hiện | thêm class ở `requestAnimationFrame` | `@starting-style` |
| Thanh tiến trình khi cuộn | nghe sự kiện `scroll` | `animation-timeline: scroll()` |

Cả bốn đều đã chạy trên Chrome 152. Bài này đo từng cái.

---

## 1. `transition` — cú pháp và bốn thứ cần nhớ

```css
transition: <thuộc-tính> <thời-lượng> <đường-cong> <độ-trễ>;
transition: opacity 300ms ease 0s;

/* nhiều thuộc tính */
transition: opacity 300ms ease, transform 200ms ease-out;
```

### Chỉ khai thuộc tính cụ thể, đừng dùng `all`

```css
transition: all 300ms;                      /* ❌ */
transition: opacity 300ms, transform 300ms; /* ✅ */
```

`all` khiến trình duyệt theo dõi **mọi** thuộc tính, kể cả những thứ bạn không định animate. Kết quả:
hiệu ứng lạ khi thêm class, và chi phí tính toán vô ích.

### `animation-fill-mode`: quay về đâu khi hết animation

```css
@keyframes slide { from { transform: translateX(0) } to { transform: translateX(100px) } }
div { animation: slide 100ms linear }
#b { animation-fill-mode: forwards }
#c { animation-fill-mode: both }
```

```js
{ a: "none",                        ← nhảy về vị trí gốc khi animation kết thúc
  b: "matrix(1, 0, 0, 1, 100, 0)",  ← giữ nguyên trạng thái cuối
  c: "matrix(1, 0, 0, 1, 100, 0)" }
```

Không có `forwards`, element **nhảy giật về chỗ cũ** ngay khi animation xong. Đây là lỗi hay gặp khi
làm hiệu ứng xuất hiện.

| Giá trị | Trước khi chạy | Sau khi chạy |
|---|---|---|
| `none` | style gốc | **style gốc** ← hay gây giật |
| `forwards` | style gốc | khung hình cuối |
| `backwards` | khung hình đầu | style gốc |
| `both` | khung hình đầu | khung hình cuối |

### `linear()` — đường cong nhiều điểm

```js
{ supports_linear_fn: true,
  a: "linear(0 0%, 0.25 25%, 1 100%)",
  b: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
```

`cubic-bezier` chỉ mô tả được đường cong đơn giản. `linear()` cho phép nhiều điểm — dùng để mô phỏng
nảy, đàn hồi:

```css
/* nảy nhẹ */
transition-timing-function: linear(0, 0.5 25%, 1.1 50%, 0.95 65%, 1);

/* hoặc dùng cubic-bezier có giá trị > 1 để vượt đích rồi quay lại */
transition-timing-function: cubic-bezier(.34, 1.56, .64, 1);
```

---

## 2. `interpolate-size` — animate `height: auto`

Bài toán kinh điển: accordion mở ra từ 0 tới chiều cao nội dung mà không biết trước chiều cao đó.

```css
.box { width: 200px; height: 0; overflow: hidden; transition: height 400ms linear }
#b   { interpolate-size: allow-keywords }
```

Đổi `height` sang `auto`, đo ở giữa (200ms) và cuối:

```js
{ supports_interpolate_size: true,
  o_giua_400ms: { khong_interpolate: 84,    ← nhảy thẳng tới đích ngay
                  co_interpolate: 42 },     ← đang ở giữa đường
  ket_thuc:     { khong_interpolate: 84, co_interpolate: 84 } }
```

`42` chính là một nửa của `84` — nó đang nội suy thật.

### Cách dùng

```css
:root { interpolate-size: allow-keywords }   /* bật cho cả trang, nó kế thừa */

.accordion__body {
  height: 0;
  overflow: hidden;
  transition: height 300ms ease;
}
.accordion[open] .accordion__body { height: auto }
```

Cách này thay thế hoàn toàn mẹo `max-height: 1000px` — vốn có hai vấn đề: nếu nội dung cao hơn 1000px
thì bị cắt, và nếu thấp hơn nhiều thì animation có một quãng "chờ" trống.

### Với thẻ `<details>` gốc

Chrome 152 cho phép animate `::details-content`:

```css
details {
  interpolate-size: allow-keywords;

  &::details-content {
    block-size: 0;
    overflow: hidden;
    transition: block-size 320ms ease, content-visibility 320ms allow-discrete;
  }
  &[open]::details-content { block-size: auto }
}
```

Đo trên dự án ở [bài 11](./11-du-an-landing-page.md):

```js
{ cao_khi_dong: 60, cao_o_giua_120ms: 103, cao_khi_mo_xong: 109, co_animate: true }
```

Accordion mượt, **không một dòng JavaScript**.

---

## 3. `transition-behavior: allow-discrete` — animate `display: none`

`display` là thuộc tính "rời rạc" — nó không có giá trị trung gian giữa `none` và `block`. Nên trước
đây, đóng modal có hiệu ứng phải viết:

```js
// Cách cũ, phải dùng JS
modal.classList.remove('open');
setTimeout(() => modal.style.display = 'none', 300);   // đợi transition xong
```

Bây giờ:

```css
.m { display: none; opacity: 0; transition: opacity 300ms, display 300ms allow-discrete }
.m.open { display: block; opacity: 1 }
```

Đo lúc **đóng** (150ms sau khi bỏ class `.open`):

```js
{ supports: true,
  giua_khi_dong: { a_display: "none",  a_opacity: "0",        ← không allow-discrete
                   b_display: "block", b_opacity: "0.197713" } ← có allow-discrete
}
```

Không có `allow-discrete`, `display` về `none` **ngay lập tức** → element biến mất, không kịp mờ dần.
Có nó, `display` giữ `block` suốt thời gian transition rồi mới chuyển — opacity kịp chạy tới 0.197 và
tiếp tục.

Viết gọn hơn cho cả nhóm:

```css
.modal {
  transition: opacity 300ms, transform 300ms, overlay 300ms allow-discrete,
              display 300ms allow-discrete;
}
```

`overlay` là thuộc tính điều khiển việc element có ở "top layer" hay không — cần cho `<dialog>` và
popover.

---

## 4. `@starting-style` — hiệu ứng khi element VỪA xuất hiện

Transition chỉ chạy khi giá trị **thay đổi**. Element mới thêm vào DOM không có "giá trị trước", nên
không có gì để chuyển tiếp — nó hiện ra đột ngột.

Cách cũ: thêm element với class ẩn, rồi đợi một frame, rồi mới bỏ class:

```js
el.classList.add('an');
document.body.append(el);
requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('an')));
```

Cách mới:

```css
.pop {
  opacity: 1; transform: scale(1);
  transition: opacity 400ms linear, transform 400ms linear;
}
@starting-style {
  .pop { opacity: 0; transform: scale(.2) }
}
```

Đo 150ms sau khi thêm element vào DOM:

```js
{ giua_animation: { co_starting_style_opacity:   "0.416748",
                    co_starting_style_transform: "matrix(0.533398, 0, 0, 0.533398, 0, 0)",
                    khong_co_opacity: "1" },      ← element kia hiện luôn, không animate
  ket_thuc_opacity: "1" }
```

`@starting-style` khai "giá trị xuất phát khi element lần đầu được vẽ". Dùng cho:

- Toast/notification vừa xuất hiện
- Item mới thêm vào danh sách
- Modal mở lần đầu
- Element vừa đổi từ `display: none` sang hiện

Kết hợp cả ba tính năng cho một modal hoàn chỉnh, **0 dòng JS cho hiệu ứng**:

```css
dialog {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms, transform 300ms,
              display 300ms allow-discrete, overlay 300ms allow-discrete;
}
dialog:not([open]) { opacity: 0; transform: translateY(-20px) }
@starting-style {
  dialog[open] { opacity: 0; transform: translateY(-20px) }
}
```

---

## 5. `animation-timeline: scroll()` — animation chạy theo vị trí cuộn

```css
.progress {
  height: 3px;
  background: red;
  transform-origin: left;
  scale: 0 1;
  animation: chay-ngang linear;
  animation-timeline: scroll(root block);
}
@keyframes chay-ngang { to { scale: 1 1 } }
```

Đo bề rộng thanh ở 5 mốc cuộn:

```js
{ cuon_toi_da: 458, bar_rong_goc: 400,
  do_rong_thanh_bar: { cuon_0pc: 0, cuon_25pc: 100.4, cuon_50pc: 200,
                       cuon_75pc: 300.4, cuon_100pc: 400 } }
```

Tuyến tính hoàn hảo: 0 → 100 → 200 → 300 → 400.

Trên trang thật của dự án:

```js
{ chieu_cao_cuon: 1389, be_rong_bar: { "0%": 0, "50%": 640, "100%": 1280 } }
```

Không có `addEventListener('scroll')`, không có `requestAnimationFrame`, và animation chạy trên
**compositor thread** nên không giật kể cả khi JS đang bận.

### Hai loại timeline

```css
/* scroll() — theo tiến trình cuộn của một scroller */
animation-timeline: scroll(root block);     /* cuộn của cả trang */
animation-timeline: scroll(nearest block);  /* scroller gần nhất */
animation-timeline: scroll(self block);     /* chính element này cuộn */

/* view() — theo việc element đi vào/ra khỏi màn hình */
animation-timeline: view();
animation-range: entry 0% cover 40%;
```

`view()` là thứ dùng cho hiệu ứng "hiện dần khi cuộn tới":

```css
.hien-dan {
  animation: fade-in linear both;
  animation-timeline: view();
  animation-range: entry 10% cover 30%;
}
@keyframes fade-in {
  from { opacity: 0; translate: 0 30px }
  to   { opacity: 1; translate: 0 0 }
}
```

Toàn bộ thư viện AOS/ScrollReveal gói gọn trong 8 dòng CSS.

⚠️ Nhớ bọc trong `prefers-reduced-motion` — hiệu ứng theo cuộn là loại gây khó chịu nhất cho người
nhạy cảm với chuyển động.

---

## 6. `transform` — thứ tự quan trọng

```css
#a .b { transform: translateX(100px) rotate(45deg) }
#b .b { transform: rotate(45deg) translateX(100px) }
#c .b { translate: 100px 0; rotate: 45deg }          /* thuộc tính riêng lẻ */
```

```js
{ a: { x: 95.9, y: -4.1, matrix: "matrix(0.707107, 0.707107, -0.707107, 0.707107, 100, 0)" },
  b: { x: 66.6, y: 66.6, matrix: "matrix(0.707107, 0.707107, -0.707107, 0.707107, 70.7, 70.7)" },
  c: { x: 95.9, y: -4.1, matrix: "none" } }
```

`a` và `b` dùng **cùng hai phép biến đổi**, chỉ khác thứ tự, và cho ra vị trí hoàn toàn khác nhau
(95.9 vs 66.6).

Lý do: mỗi phép biến đổi tác động lên **hệ toạ độ đã bị biến đổi bởi phép trước**. Xoay trước rồi tịnh
tiến nghĩa là tịnh tiến theo hướng đã xoay 45°.

Đọc từ **phải sang trái** nếu nghĩ theo kiểu "áp lên element", hoặc trái sang phải nếu nghĩ theo kiểu
"biến đổi hệ toạ độ".

### Thuộc tính riêng lẻ — thứ tự cố định, animate độc lập

```css
.hop { translate: 100px 0; rotate: 45deg; scale: 1.2 }
```

Ba thuộc tính này luôn áp theo thứ tự **translate → rotate → scale**, bất kể bạn viết thế nào. Kết quả
đo cho thấy `#c` khớp với `#a` (translate trước).

Lợi ích lớn: animate riêng từng cái mà không giẫm chân nhau.

```css
.the {
  transition: translate 200ms, scale 300ms;
}
.the:hover { translate: 0 -4px }
.the:active { scale: .97 }        /* không xoá mất translate như transform sẽ làm */
```

Với `transform`, viết `transform: scale(.97)` ở `:active` sẽ **xoá mất** `translateY(-4px)` của
`:hover`.

Chú ý `matrix: "none"` ở `#c` — `getComputedStyle(el).transform` **không** phản ánh các thuộc tính
riêng lẻ. Phải đọc `.translate`, `.rotate`, `.scale` riêng.

### `transform-origin` — tâm biến đổi

```css
.b { transform: rotate(90deg) }              /* tâm mặc định: giữa element */
#b .b { transform-origin: top left }
```

Element 80×40 tại vị trí (20, 20):

```js
{ a: { x:  40, y:  0, w: 40, h: 80, origin: "40px 20px" },   ← quay quanh tâm
  b: { x: -20, y: 20, w: 40, h: 80, origin: "0px 0px"   } }  ← quay quanh góc trên trái
```

Chú ý `w` và `h` đảo nhau (80×40 → 40×80) vì `getBoundingClientRect` trả về hộp bao **sau khi xoay**.

---

## 7. Thuộc tính nào animate rẻ, thuộc tính nào đắt

Đo bằng CDP: animate 200 element trong 2 giây, đếm số lần trình duyệt phải tính lại layout và style.

```
thuộc tính   LayoutCount  RecalcStyleCount  LayoutDuration  RecalcStyleDuration
left               120          120            20.1 ms          62.3 ms
width              120          120            79.9 ms          70.9 ms
transform            0            0             0 ms             0 ms
opacity              0            0             0 ms             0 ms
```

`transform` và `opacity` gây **đúng 0 lần** tính lại layout và style. Chúng chạy hoàn toàn trên
compositor.

**Quy tắc:** muốn di chuyển thì dùng `transform: translate()`, đừng dùng `top`/`left`. Muốn ẩn hiện thì
dùng `opacity`, đừng dùng `width`/`height`.

Chi tiết ở [bài 10](./10-hieu-nang-render.md).

---

## 8. View Transition — chuyển cảnh giữa hai trạng thái

```js
{ co_startViewTransition: true,
  supports_view_transition_name: true,
  supports_view_transition_class: true }
```

```js
document.startViewTransition(() => {
  // đổi DOM ở đây — trình duyệt tự chụp trước/sau và chuyển cảnh
  danhSach.innerHTML = duLieuMoi;
});
```

Muốn một element cụ thể "bay" từ vị trí cũ sang vị trí mới, đặt tên cho nó:

```css
.anh-san-pham { view-transition-name: anh-chinh }
```

Tên phải **duy nhất trên trang** tại mỗi thời điểm. Hai element cùng tên sẽ làm hỏng chuyển cảnh.

⚠️ Nhớ rằng `view-transition-name` **tạo stacking context** (xem bảng ở
[bài 06](./06-position-va-stacking.md)).

Tuỳ biến hiệu ứng:

```css
::view-transition-old(anh-chinh) { animation: 300ms ease both fade-out }
::view-transition-new(anh-chinh) { animation: 300ms ease both fade-in }

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*) { animation: none }
}
```

---

## 9. Bảng tra nhanh: giá trị nên dùng

| Loại hiệu ứng | Thời lượng | Đường cong |
|---|---|---|
| Hover, đổi màu | 100–200ms | `ease-out` |
| Mở dropdown, tooltip | 150–250ms | `ease-out` |
| Modal, drawer | 250–400ms | `cubic-bezier(.2,.8,.2,1)` |
| Chuyển trang | 300–500ms | `ease-in-out` |

Nguyên tắc: **vào nhanh, ra chậm hơn một chút**. Element xuất hiện nên `ease-out` (nhanh lúc đầu, chậm
lúc dừng) — nó cho cảm giác phản hồi tức thì.

Trong dự án:

```css
:root { --nhanh: 160ms; --vua: 320ms; --duong-cong: cubic-bezier(0.2, 0.8, 0.2, 1) }
```

Hiệu ứng dài quá 500ms làm giao diện có cảm giác chậm chạp, dù nó "đẹp".

---

## Bài tập

1. Viết `transition: all 300ms` cho một nút rồi thêm class đổi `display`. Chuyện gì xảy ra? Sửa bằng
   cách khai thuộc tính cụ thể.

2. Animate một element từ trái sang phải rồi để animation kết thúc. Vì sao nó nhảy về chỗ cũ? Sửa.

3. Làm accordion mở/đóng mượt bằng `interpolate-size`. So sánh với cách `max-height: 1000px` khi nội
   dung cao 1500px.

4. Làm toast xuất hiện có hiệu ứng trượt xuống, dùng `@starting-style`. Chứng minh nó chạy bằng cách
   đo `opacity` ở giữa animation.

5. Làm modal đóng có hiệu ứng mờ dần, không dùng `setTimeout`. Đo `display` ở giữa lúc đóng.

6. Hai đoạn này cho kết quả khác nhau thế nào? Đoán rồi đo.
   ```css
   transform: translateX(200px) rotate(90deg);
   transform: rotate(90deg) translateX(200px);
   ```

7. Làm thanh tiến trình đọc bài viết bằng `animation-timeline: scroll()`. Đo bề rộng ở 0%, 50%, 100%.

8. Viết hiệu ứng card `:hover` nâng lên 4px và `:active` thu nhỏ 3%. Dùng `transform` — có vấn đề gì?
   Viết lại bằng `translate`/`scale`.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `display` là thuộc tính rời rạc; với `all` nó chuyển ngay lập tức nên element biến mất đột ngột
trong khi các thuộc tính khác vẫn đang chạy. Sửa: `transition: opacity 300ms, transform 300ms`, hoặc
thêm `display 300ms allow-discrete`.

**2.** Vì `animation-fill-mode` mặc định là `none` — hết animation thì style quay về giá trị gốc. Sửa:
`animation-fill-mode: forwards` (hoặc `both`).

**3.** Với `max-height: 1000px`, nội dung 1500px bị **cắt mất 500px**. Với `interpolate-size` thì đúng
chiều cao thật. Ngoài ra `max-height` dư nhiều gây quãng "chờ" trống trong animation.

**5.**
```css
.modal { display: none; opacity: 0;
         transition: opacity 300ms, display 300ms allow-discrete }
.modal.open { display: block; opacity: 1 }
```
Đo giữa lúc đóng: `display` vẫn là `"block"` còn `opacity` khoảng `0.2`. Không có `allow-discrete` thì
`display` là `"none"` và `opacity` là `"0"` ngay lập tức.

**6.** `translateX` trước: đi ngang 200px rồi mới xoay tại chỗ → x ≈ 200.
`rotate` trước: hệ toạ độ đã xoay 90°, nên `translateX` đẩy element đi **xuống dưới** → y ≈ 200.

**8.** Với `transform`, rule `:active { transform: scale(.97) }` **ghi đè hoàn toàn**
`:hover { transform: translateY(-4px) }` — card tụt về vị trí cũ khi bấm. Đo thật:

```js
{ transform_hover:        { transform: "matrix(1, 0, 0, 1, 0, -4)" },
  transform_hover_active: { transform: "matrix(0.97, 0, 0, 0.97, 0, 0)" },  ← mất -4px

  rieng_le_hover:         { translate: "0px -4px", scale: "none" },
  rieng_le_hover_active:  { translate: "0px -4px", scale: "0.97" } }        ← giữ cả hai
```

Viết lại:
```css
.the:hover  { translate: 0 -4px }
.the:active { scale: .97 }
```
Hai thuộc tính riêng biệt nên cộng dồn, không giẫm chân nhau.

</details>

---

Tiếp theo: [10-hieu-nang-render.md](./10-hieu-nang-render.md)
