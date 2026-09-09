# Bài 10 — Hiệu năng render: đo chứ đừng đoán

Có rất nhiều lời khuyên tối ưu CSS lan truyền trên mạng mà không kèm số đo. Bài này chỉ giữ những điều
**đo được** trên máy bạn, và chỉ ra cách tự đo.

---

## 1. Trình duyệt làm gì sau khi bạn đổi một thuộc tính

```
Style        →  Layout        →  Paint       →  Composite
tính lại        tính lại         vẽ pixel       ghép các lớp
giá trị         vị trí/kích cỡ
```

Đổi thuộc tính càng ở **bên trái** thì càng đắt, vì mọi bước sau phải chạy lại.

| Thuộc tính bạn đổi | Phải chạy lại |
|---|---|
| `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size` | Style → Layout → Paint → Composite |
| `color`, `background`, `box-shadow`, `border-radius` | Style → Paint → Composite |
| `transform`, `opacity`, `filter` | **chỉ Composite** |

---

## 2. Đo thật: thuộc tính nào gây tính lại layout

Đây là phép đo quan trọng nhất của bài. Dùng Chrome DevTools Protocol để lấy số liệu **quy được trách
nhiệm** thay vì đoán qua cảm giác mượt/giật.

```js
const cdp = await p.context().newCDPSession(p);
await cdp.send('Performance.enable');
const a = await cdp.send('Performance.getMetrics');    // chụp mốc đầu
await p.waitForTimeout(2000);
const z = await cdp.send('Performance.getMetrics');    // chụp mốc cuối
// lấy hiệu: LayoutCount, RecalcStyleCount, LayoutDuration, RecalcStyleDuration
```

Animate **200 element** liên tục trong **2 giây**, mỗi lần bằng một thuộc tính khác nhau:

```
thuộc tính   LayoutCount  RecalcStyleCount  LayoutDuration  RecalcStyleDuration
left               120          120            20.1 ms          62.3 ms
width              120          120            79.9 ms          70.9 ms
transform            0            0             0 ms             0 ms
opacity              0            0             0 ms             0 ms
```

Đọc bảng này:

- `left` và `width` buộc trình duyệt tính lại layout **120 lần** trong 2 giây (60fps × 2s = 120 frame,
  tức **mỗi frame một lần**).
- `width` đắt hơn `left` gần **4 lần** về thời gian layout (79.9ms so với 20.1ms) — vì đổi bề rộng làm
  chữ phải xếp lại dòng.
- `transform` và `opacity` cho **đúng 0** ở cả bốn cột. Chúng không chạm vào layout hay style.

Đây không phải "nghe nói transform nhanh hơn" — đây là 0 so với 120.

### Hệ quả thực dụng

```css
/* ❌ Di chuyển bằng left — 120 lần layout */
@keyframes truot { from { left: 0 } to { left: 300px } }

/* ✅ Di chuyển bằng transform — 0 lần layout */
@keyframes truot { from { translate: 0 } to { translate: 300px } }
```

```css
/* ❌ Ẩn hiện bằng height */
.menu { height: 0 } .menu.mo { height: 200px }

/* ✅ Ẩn hiện bằng opacity + transform */
.menu { opacity: 0; translate: 0 -8px } .menu.mo { opacity: 1; translate: 0 0 }
```

⚠️ Một cảnh báo về cách đo: tôi cũng thử đo bằng cách **đếm FPS**, và kết quả trong Chrome headless
(không có GPU thật) **không** tái hiện được kết luận trên — thậm chí có lần `transform` cho FPS thấp
hơn vì chi phí tạo 400 compositing layer một lúc. Số đếm layout ở trên mới là con số đúng và ổn định.
Nếu bạn tự đo, hãy đo `LayoutCount` chứ đừng đo FPS trong môi trường headless.

---

## 3. Layout thrashing — lỗi hiệu năng đắt nhất, và nó nằm ở JS

Đây là chỗ **chậm hơn 100 lần**, không phải vài phần trăm.

```js
// ❌ Đọc–ghi xen kẽ
for (const r of rows) {
  const h = r.offsetHeight;      // ĐỌC  -> buộc trình duyệt tính layout ngay
  r.style.width = (h * 10) + 'px';  // GHI -> làm layout cũ hết hiệu lực
}

// ✅ Đọc hết trước, ghi hết sau
const hs = rows.map(r => r.offsetHeight);           // đọc tất cả
rows.forEach((r, i) => r.style.width = hs[i] * 10 + 'px');  // rồi ghi tất cả
```

Đo trên 400 element:

```js
{ xen_ke_doc_ghi_ms: 32.5,
  doc_het_roi_ghi_het_ms: 0.3,
  cham_hon_bao_nhieu_lan: 108.3 }
```

**108 lần.** Không có tối ưu CSS nào cho lại con số đó.

Nguyên nhân: bình thường trình duyệt gom các thay đổi lại rồi tính layout **một lần** trước khi vẽ.
Nhưng khi bạn đọc `offsetHeight` (hoặc `getBoundingClientRect`, `scrollTop`, `offsetWidth`,
`getComputedStyle`), trình duyệt **buộc phải** tính layout ngay để trả lời chính xác. Xen kẽ đọc-ghi
400 lần = ép tính layout 400 lần.

Các thuộc tính buộc tính layout khi đọc:

```
offsetTop/Left/Width/Height     scrollTop/Left/Width/Height
clientTop/Left/Width/Height     getBoundingClientRect()
getComputedStyle()              focus()
```

---

## 4. `content-visibility: auto` — bỏ qua phần chưa cuộn tới

```css
section {
  content-visibility: auto;
  contain-intrinsic-size: auto 420px;   /* chiều cao ĐOÁN TRƯỚC */
}
```

Đo trên 200 section × 20 dòng = 4000 element:

```js
// không có content-visibility
{ thoi_gian_dung_layout_ms: 21.7, chieu_cao_tinh_ra: 83999, so_element: 4000 }
// có content-visibility
{ thoi_gian_dung_layout_ms:  6.1, chieu_cao_tinh_ra: 84000, so_element: 4000 }
```

**Nhanh 3.6 lần** (21.7ms → 6.1ms), và chiều cao trang vẫn gần như chính xác (83999 vs 84000).

### ⚠️ Cái giá: chiều cao chỉ là ước lượng cho tới khi cuộn tới

Đây là lý do tôi **bỏ** `content-visibility` khỏi dự án ở [bài 11](./11-du-an-landing-page.md). Đo trên
trang thật:

```js
// Trước khi cuộn tới
{ id: "cau-hoi", cao_khi_chua_cuon_toi: 624, contentVisibility: "auto" }
// Sau khi cuộn tới
{ id: "cau-hoi", cao_sau_khi_cuon_toi: 500 }
```

Chênh **124px**. Người dùng cuộn xuống thì nội dung nhảy lên 124px — cảm giác rất tệ. Trang landing chỉ
có 3 khối, tiết kiệm được vài mili giây không đáng đổi lấy chuyện đó.

Triệu chứng phụ: khi chụp ảnh toàn trang bằng Playwright, các khối chưa cuộn tới hiện ra **trắng trơn**
— vì chúng thật sự chưa được vẽ.

### Tin tốt: nội dung vẫn tìm được

```js
{ tim_thay_bang_find: true,          ← Ctrl+F vẫn thấy
  querySelector_van_thay: true,
  textContent_van_co: true }
```

Khác hẳn `display: none` — nội dung vẫn ở trong DOM, vẫn tìm được bằng Ctrl+F, vẫn được trình đọc màn
hình đọc, vẫn được Google index. Trình duyệt chỉ hoãn việc **vẽ**.

### Dùng khi nào

| Nên dùng | Không nên dùng |
|---|---|
| Danh sách hàng nghìn dòng | Trang có vài khối |
| Trang tin tức dài | Nội dung trong màn hình đầu |
| Bảng dữ liệu lớn | Khi độ dài mỗi khối chênh nhau nhiều |

Đặt `contain-intrinsic-size` càng sát thực tế càng ít nhảy. Dạng `auto 420px` nghĩa là "dùng 420px cho
tới khi đo được lần đầu, sau đó nhớ số thật".

---

## 5. `contain` — hứa với trình duyệt để nó tối ưu

```css
.card { contain: layout }
```

`contain` không đổi hình dạng gì. Nó là một **lời hứa**: "layout bên trong element này không ảnh hưởng
ra ngoài". Nhờ vậy khi nội dung card đổi, trình duyệt chỉ tính lại card đó thay vì cả trang.

```js
{ supports_contain_layout: true,
  a_cao_truoc: 22, b_cao_truoc: 22 }    ← hình dạng giống hệt nhau
```

| Giá trị | Hứa gì |
|---|---|
| `layout` | layout bên trong không ảnh hưởng ra ngoài |
| `paint` | không vẽ tràn ra ngoài biên |
| `size` | kích thước không phụ thuộc nội dung (**phải tự khai kích thước**) |
| `style` | counter/quote bên trong không thoát ra |
| `content` | = `layout paint style` |
| `strict` | = `layout paint style size` |

⚠️ `contain: paint` và `contain: layout` **tạo stacking context và containing block** — xem bảng ở
[bài 06](./06-position-va-stacking.md). Thêm nó có thể làm hỏng `position: fixed` của con.

`contain: size` là nguy hiểm nhất: element sẽ cao 0 nếu bạn không khai chiều cao.

---

## 6. `will-change` — dùng sai còn hại hơn không dùng

```css
.the { will-change: transform }
```

`will-change` bảo trình duyệt "chuẩn bị sẵn một lớp riêng cho element này". Trình duyệt sẽ tạo
compositing layer **ngay lập tức**, kể cả khi không có animation nào chạy.

```js
{ a_will_change: "transform",
  a_co_tao_stacking_context: true }
```

Ba vấn đề:

1. **Tốn bộ nhớ GPU.** Mỗi layer là một texture. Đặt `will-change` cho 500 item danh sách là cách
   nhanh nhất làm treo máy yếu.
2. **Tạo stacking context.** Có thể phá vỡ z-index của cả nhánh (bài 06).
3. **Tạo containing block.** `position: fixed` của con sẽ neo sai chỗ.

**Cách dùng đúng — bật ngay trước, tắt ngay sau:**

```css
.the:hover { will-change: transform }    /* chỉ khi sắp animate */
```

Hoặc bằng JS:

```js
el.style.willChange = 'transform';
el.addEventListener('transitionend', () => el.style.willChange = 'auto', { once: true });
```

Trong hầu hết trường hợp: **đừng dùng**. Chrome đã tự tối ưu tốt cho `transform`/`opacity`. Chỉ thêm
`will-change` khi bạn đã đo được vấn đề và đo lại được cải thiện.

Điều tương tự với mẹo cũ `transform: translateZ(0)` — nó là cách "hack" để ép tạo layer, với đúng ba
tác dụng phụ trên. Đừng rải nó khắp nơi.

---

## 7. Selector có thực sự ảnh hưởng hiệu năng không

Câu trả lời ngắn: **gần như không**, trừ vài trường hợp.

Lời khuyên cũ "đừng dùng selector hậu duệ, hãy dùng BEM để selector chỉ có một class" đã lỗi thời. Trình
duyệt khớp selector từ **phải sang trái** và có nhiều tầng cache; chi phí này nhỏ so với layout.

Những thứ **thực sự** tốn:

- **`:has()` trên tập lớn** — nó phải kiểm tra con cháu. Với vài nghìn phần tử, hãy đo.
- **Selector khớp quá nhiều element** — `* { transition: all }` là ví dụ tệ nhất có thể.
- **Số lượng rule khổng lồ** — file CSS 2 MB tốn thời gian phân tích trước cả khi khớp.

Ưu tiên tối ưu theo thứ tự: **layout thrashing (100×) → thuộc tính animate (∞×) → kích thước file → selector**.

---

## 8. Checklist hiệu năng CSS

Theo thứ tự tác động từ lớn tới nhỏ:

1. **Gom đọc và ghi DOM riêng ra.** Đây là chỗ nhanh hơn 100 lần.
2. **Chỉ animate `transform` và `opacity`.** 0 lần layout thay vì 120.
3. **Khai `width`/`height` cho ảnh, hoặc `aspect-ratio`.** Chặn nhảy layout khi ảnh tải xong
   ([bài 02](./02-box-model.md)).
4. **Tôn trọng `prefers-reduced-motion`.** Vừa là tiếp cận, vừa là hiệu năng cho máy yếu.
5. **`content-visibility: auto` cho danh sách rất dài** — và chỉ khi rất dài.
6. **Đừng rải `will-change` hay `translateZ(0)`.**
7. **Nạp font đúng cách:**
   ```css
   @font-face {
     font-family: "Chu";
     src: url(chu.woff2) format("woff2");
     font-display: swap;        /* hiện font dự phòng ngay, đổi khi tải xong */
   }
   ```
   Không có `font-display: swap`, chữ **vô hình** tới 3 giây trên mạng chậm.
8. **CSS chặn render.** File CSS phải tải xong trang mới hiện. Giữ file chính nhỏ, tách phần không
   quan trọng:
   ```html
   <link rel="stylesheet" href="in.css" media="print">
   ```

---

## 9. Tự đo trong DevTools

### Tab Performance

1. Bấm ghi, thao tác, dừng.
2. Nhìn dải **Frames** — ô đỏ là frame bị bỏ.
3. Trong bảng Main, tìm khối màu tím **Layout** và **Recalculate Style**.
4. Nếu thấy tam giác đỏ ⚠️ với chữ **"Forced reflow"** — đó là layout thrashing ở mục 3. Bấm vào nó,
   DevTools chỉ thẳng ra dòng JS gây ra.

### Tab Rendering (Ctrl+Shift+P → "Show Rendering")

| Tuỳ chọn | Cho thấy |
|---|---|
| **Paint flashing** | vùng nào đang được vẽ lại — nhấp nháy xanh lá liên tục là dấu hiệu xấu |
| **Layout Shift Regions** | vùng nào nhảy (chính là CLS) |
| **Layer borders** | có bao nhiêu compositing layer — nhiều quá là do `will-change` |
| **Emulate CSS media prefers-reduced-motion** | thử nhanh mà không đổi cài đặt hệ thống |
| **Emulate CSS media prefers-color-scheme** | thử chế độ tối |

### Đo bằng script

```js
// Đếm số lần layout trong một khoảng
const t = performance.now();
// ... thao tác của bạn ...
void document.body.offsetHeight;      // buộc layout chạy xong
console.log('mất', (performance.now() - t).toFixed(2), 'ms');
```

Với số liệu chính xác hơn, dùng CDP như mục 2.

---

## Bài tập

1. Viết vòng lặp đọc `offsetHeight` xen kẽ ghi `style.width` trên 400 element. Đo thời gian. Sửa thành
   đọc hết rồi ghi hết, đo lại. Chênh bao nhiêu lần?

2. Animate 200 element bằng `left`, rồi bằng `transform`. Dùng CDP đo `LayoutCount` cho từng cái.

3. Trang có 200 khối dài. Thêm `content-visibility: auto` và đo thời gian dựng layout. Rồi cuộn xuống
   và đo chiều cao một khối trước/sau — chênh bao nhiêu?

4. Vì sao `content-visibility: auto` không phù hợp cho một landing page 3 khối?

5. Thêm `will-change: transform` cho 300 item danh sách. Bật "Layer borders" trong tab Rendering. Bạn
   thấy gì?

6. Element `position: fixed` trong một khối có `contain: paint`. Nó neo vào đâu? Vì sao?

7. Bật "Paint flashing" rồi hover qua các nút trên trang của bạn. Có chỗ nào nhấp nháy nhiều hơn cần
   thiết không?

8. Kiểm tra tất cả `@font-face` trong dự án của bạn có `font-display: swap` chưa. Không có thì chuyện gì
   xảy ra trên mạng chậm?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Đo được **32.5ms** so với **0.3ms** — chậm hơn **108 lần**.

**2.** `left` → `LayoutCount: 120` (mỗi frame một lần). `transform` → `LayoutCount: 0`.

**3.** Thời gian dựng layout **21.7ms → 6.1ms** (nhanh 3.6 lần). Chiều cao một khối: **624px** trước khi
cuộn tới (theo `contain-intrinsic-size`), **500px** sau khi cuộn tới — chênh 124px, và trang giật đúng
lượng đó.

**4.** Vì lợi ích (vài mili giây) nhỏ hơn hẳn cái giá (trang nhảy 124px khi cuộn). Kỹ thuật này chỉ có
lãi khi số element ngoài màn hình rất lớn.

**5.** 300 compositing layer riêng biệt, mỗi cái là một texture trong bộ nhớ GPU. Trên máy yếu hoặc
điện thoại, đây là cách nhanh nhất làm trang giật hoặc tab bị đóng vì hết bộ nhớ.

**6.** Nó neo vào **khối có `contain: paint`**, không phải viewport — vì `contain: paint` tạo containing
block cho con cháu `fixed`/`absolute` (đo ở bài 06: `y: 909` trùng với `cha_y: 908`).

**8.** Mặc định là `font-display: auto`, Chrome xử lý như `block`: chữ **vô hình** trong tối đa 3 giây
chờ font tải. Người dùng nhìn thấy trang trống. `swap` hiện font dự phòng ngay rồi đổi khi font về.

</details>

---

Tiếp theo: [11-du-an-landing-page.md](./11-du-an-landing-page.md)
