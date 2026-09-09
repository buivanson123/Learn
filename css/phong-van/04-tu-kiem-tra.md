# Checklist tự chấm — 80 mục

Tick từng mục **chỉ khi bạn giải thích được ra miệng**, không phải khi "thấy quen quen".

Cuối file có thang điểm.

---

## Cascade và selector (14 mục)

- [ ] 1. Kể được 6 bước cascade **theo đúng thứ tự**
- [ ] 2. Tính được specificity của `.a #b p:hover::before`
- [ ] 3. Giải thích được vì sao 20 class không thắng nổi 1 id
- [ ] 4. Nói được `:is()` và `:where()` khác nhau ở đâu, và dùng cái nào cho reset
- [ ] 5. Biết `:is(.a, #b)` có specificity `(1,0,0)` dù `#b` không tồn tại trong HTML
- [ ] 6. Giải thích được `@layer` đứng ở đâu so với specificity
- [ ] 7. Biết CSS **ngoài** mọi layer thắng CSS trong layer
- [ ] 8. Biết `!important` **đảo ngược** thứ tự layer
- [ ] 9. Nêu được 2 trường hợp `!important` là câu trả lời đúng
- [ ] 10. Viết được `:has()` cho "form có input lỗi thì nút submit xám đi"
- [ ] 11. Biết `&` trong nesting biên dịch thành `:is()` và hệ quả về specificity
- [ ] 12. Biết `:hover` không có `&` trong nesting là **selector hậu duệ**
- [ ] 13. Kể được 6 thuộc tính kế thừa và 3 thuộc tính không
- [ ] 14. Nói được `unset` / `initial` / `revert` khác nhau thế nào

---

## Box model (12 mục)

- [ ] 15. Tính được `offsetWidth` cho `width:300; padding:30; border:10` với cả hai `box-sizing`
- [ ] 16. Biết vì sao reset phải viết `*, *::before, *::after` chứ không chỉ `*`
- [ ] 17. Mô tả được 3 dạng margin collapsing
- [ ] 18. Nêu được 4 cách chặn margin collapsing và **tác dụng phụ** của từng cách
- [ ] 19. Biết vì sao `display: flow-root` là cách tốt nhất
- [ ] 20. Biết `padding-top: 10%` tính theo **chiều rộng** cha
- [ ] 21. Giải thích được vì sao `height: 100%` hay im lặng không hoạt động
- [ ] 22. Phân biệt `min-content` / `max-content` / `fit-content`
- [ ] 23. Biết `height` tường minh **thắng** `aspect-ratio`
- [ ] 24. Dùng `aspect-ratio` để chặn CLS được
- [ ] 25. Biết `box-shadow` và `outline` **không** chiếm chỗ, `border` thì có
- [ ] 26. Biết thanh cuộn chiếm 0px trên macOS, 15–17px trên Windows, và cách xử lý

---

## Flexbox (11 mục)

- [ ] 27. Nói được `flex: 1`, `flex: auto`, `flex: none` là viết tắt của gì
- [ ] 28. Giải thích được vì sao `flex: 1` cho các ô **bằng nhau** còn `flex: auto` thì không
- [ ] 29. Tính được bề rộng khi `basis: 100px`, `grow: 1` và `grow: 3`, container 500px
- [ ] 30. Biết `flex-grow: 3` **không** nghĩa là rộng gấp 3
- [ ] 31. Biết `flex-shrink` chia theo `shrink × basis`
- [ ] 32. Biết `flex-basis` **thắng** `width`
- [ ] 33. Giải thích được bẫy `min-width: auto` và **3 cách sửa**
- [ ] 34. Biết `overflow` khác `visible` tự đặt min-size về 0
- [ ] 35. Phân biệt `justify-content` / `align-items` / `align-self` / `align-content`
- [ ] 36. Dùng được `margin-inline-start: auto` cho navbar
- [ ] 37. Biết `order` **không** đổi thứ tự Tab và vì sao đó là vấn đề

---

## Grid (11 mục)

- [ ] 38. Giải thích được `fr` chia phần **còn lại** sau gap và track cố định
- [ ] 39. Biết `1fr` thật ra là `minmax(auto, 1fr)`
- [ ] 40. Giải thích được vì sao `1fr 1fr` đôi khi cho hai cột **không bằng nhau**
- [ ] 41. Biết dùng `minmax(0, 1fr)` cho cột chứa nội dung động
- [ ] 42. Phân biệt `auto-fit` và `auto-fill`
- [ ] 43. Viết được lưới responsive **không cần media query**
- [ ] 44. Biết vì sao phải có `min()` trong `minmax(min(100%, 260px), 1fr)`
- [ ] 45. Dùng được `grid-template-areas` và biết vùng phải là hình chữ nhật
- [ ] 46. Giải thích được `grid-column: 1 / -1` và số dòng âm
- [ ] 47. Biết `subgrid` giải quyết vấn đề gì và cần điều kiện gì
- [ ] 48. Nói được khi nào chọn Grid, khi nào chọn Flex

---

## Position và stacking (10 mục)

- [ ] 49. Biết `absolute` neo vào **tổ tiên đã định vị gần nhất**
- [ ] 50. Kể được 6 thuộc tính "bắt" `position: fixed` lại
- [ ] 51. Giải thích được **stacking context** cho người chưa biết
- [ ] 52. Kể được ít nhất 8 thuộc tính tạo stacking context
- [ ] 53. Biết `container-type` **không** tạo stacking context
- [ ] 54. Biết `z-index` không ăn trên `static`, **trừ** flex/grid item
- [ ] 55. Viết được script tìm tổ tiên tạo stacking context
- [ ] 56. Biết `isolation: isolate` dùng để làm gì
- [ ] 57. Kể được **3 điều kiện** của `position: sticky`
- [ ] 58. Nêu được 3 cách căn giữa tuyệt đối và cách nào tạo stacking context

---

## Responsive (10 mục)

- [ ] 59. Nói được container query khác media query ở đâu, bằng một ví dụ cụ thể
- [ ] 60. Biết container query **không style được** element khai `container-type`
- [ ] 61. Biết `inline-size` không query được chiều cao
- [ ] 62. Biết phải **đo** bề rộng container trước khi chọn ngưỡng
- [ ] 63. Phân biệt `cqi` / `cqw` / `vw`
- [ ] 64. Dùng được style query `@container style(--x: y)`
- [ ] 65. Viết được công thức `clamp()` từ hai mốc (A px @ V1 → B px @ V2)
- [ ] 66. Giải thích được vì sao `clamp(24px, 5vw, 48px)` là công thức **tệ** cho font
- [ ] 67. Biết cú pháp range và vì sao nó tốt hơn `min-width`/`max-width`
- [ ] 68. Viết được `.shell` bằng một dòng `width: min(...)`

---

## Biến, màu, animation (12 mục)

- [ ] 69. Nói được biến CSS khác biến Sass ở 3 điểm
- [ ] 70. Giải thích được "invalid at computed-value time" và hệ quả
- [ ] 71. Biết `width: var(--n)` với `--n: 20` không hoạt động và vì sao
- [ ] 72. Nêu được 2 việc `@property` giải quyết
- [ ] 73. Giải thích được vì sao `oklch` tốt hơn `hsl` cho bảng màu
- [ ] 74. Dùng được `color-mix()` để tạo màu nhạt theo theme
- [ ] 75. Biết `light-dark()` chỉ nghe `color-scheme`, không nghe `data-*`
- [ ] 76. Biết `color-scheme` đổi cả màu mặc định của `<input>` và thanh cuộn
- [ ] 77. Biết `animation-fill-mode: forwards` để tránh nhảy về chỗ cũ
- [ ] 78. Giải thích được vì sao thứ tự trong `transform` quan trọng
- [ ] 79. Biết `translate`/`rotate`/`scale` riêng lẻ không giẫm chân nhau như `transform`
- [ ] 80. Kể được 4 tính năng CSS mới thay thế JavaScript (`interpolate-size`, `allow-discrete`,
      `@starting-style`, `animation-timeline`)

---

## Điểm cộng — mức Senior

Không tính vào 80 mục, nhưng đây là những thứ phân biệt Middle với Senior:

- [ ] Nói được con số: `transform` gây **0** lần layout, `left` gây **120** lần trong 2 giây
- [ ] Nói được layout thrashing chậm hơn **~108 lần** và cách sửa
- [ ] Biết `content-visibility: auto` nhanh 3.6 lần nhưng **cái giá** là trang giật
- [ ] Biết vì sao **không** nên rải `will-change`
- [ ] Biết `*` trong `prefers-reduced-motion` **không phủ** `::details-content`
- [ ] Biết dùng `1ms` chứ không `0s` trong khối reduced-motion, và lý do
- [ ] Biết `line-clamp` chuẩn hoá **chưa** chạy trên Chrome 152
- [ ] Tự dựng được harness đo bằng Playwright thay vì tin blog
- [ ] Viết được script tìm element tràn ngang
- [ ] Kiểm tra được `:focus-visible` bằng cách click chuột **và** bấm Tab thật

---

## Thang điểm

| Số mục tick được | Đánh giá |
|---|---|
| **< 40** | Đọc lại từ [bài 01](../01-cascade-va-selector.md). Đừng nhảy cóc — bài 01, 02, 04 là nền của mọi bài sau. |
| **40–55** | Nền tảng ổn, nhưng còn lỗ hổng ở phần nâng cao. Tập trung vào nhóm bạn tick ít nhất. |
| **56–70** | Đủ cho vị trí Middle. Ôn thêm 4 chủ đề hay hỏi nhất (xem [README](./README.md)). |
| **71–80** | Vững. Chuyển sang luyện [tình huống debug](./03-tinh-huong-debug.md) — đó mới là thứ phân biệt trong phỏng vấn thật. |
| **80 + điểm cộng** | Bạn hiểu CSS ở mức hiếm. Hãy chuẩn bị ví dụ cụ thể từ dự án thật để kể. |

---

## Nếu chỉ có 2 tiếng để ôn

Theo thứ tự:

1. **[Bài 01 — Cascade](../01-cascade-va-selector.md)** (40 phút) — câu hỏi "vì sao rule không ăn"
   xuất hiện trong gần như mọi buổi phỏng vấn
2. **[Bài 06 — Stacking context](../06-position-va-stacking.md)** (25 phút) — câu "vì sao z-index 9999
   vẫn thua" là câu kinh điển
3. **[Bài 04 mục 1–4](../04-flexbox.md)** (25 phút) — toán chia không gian của flexbox
4. **[Bài 07 mục 1–2](../07-responsive-va-container-query.md)** (20 phút) — container query
5. **[Tình huống debug 1, 2, 3](./03-tinh-huong-debug.md)** (10 phút) — luyện cách **nói** quy trình

Bỏ qua: chi tiết `@property`, view transitions, các con số hiệu năng. Chúng là điểm cộng, không phải
điểm sàn.

---

## Nếu chỉ có 20 phút

Đọc kỹ **[mục 6 của bài 11](../11-du-an-landing-page.md)** — năm lỗi thật với số đo thật.

Kể được một trong năm lỗi đó (triệu chứng → cách tìm ra → cách sửa → vì sao) sẽ gây ấn tượng hơn hẳn
việc đọc thuộc định nghĩa. Nó cho thấy bạn đã **làm** chứ không chỉ **đọc**.

---

Quay lại: [README bộ phỏng vấn](./README.md) · [Giáo trình](../README.md)
