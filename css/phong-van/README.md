# Luyện phỏng vấn CSS

Bộ này nhắm mức **Middle frontend**. Nó không phải danh sách câu hỏi để học thuộc — mà là bộ công cụ
để bạn tự phát hiện chỗ mình đang hiểu mơ hồ.

| File | Nội dung |
|---|---|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 60 câu hỏi, mỗi câu có **đáp án hai tầng** |
| [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) | 18 bài gõ tay, có bài phải làm trên giấy |
| [03-tinh-huong-debug.md](./03-tinh-huong-debug.md) | 10 tình huống "trang bị lỗi, tìm nguyên nhân" |
| [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) | Checklist 80 mục để tự chấm |

---

## "Đáp án hai tầng" nghĩa là gì

Mỗi câu có:

- **Trả lời ngắn** — 2–4 câu, đúng thứ bạn nói ra miệng trong phòng phỏng vấn. Không lan man.
- **Giải thích sâu** — cơ chế bên dưới, số đo thật, và trường hợp biên. Phần này để **bạn hiểu**, và để
  trả lời khi người phỏng vấn hỏi tiếp "vì sao?".

Người phỏng vấn giỏi luôn hỏi tiếp một tầng. Nếu bạn chỉ thuộc tầng 1, câu hỏi thứ hai sẽ lộ ra ngay.

---

## Cách luyện hiệu quả

**Đừng đọc đáp án trước.** Với mỗi câu:

1. Nói to câu trả lời của bạn (thật sự nói ra miệng — viết ra giấy cũng được, nhưng nói tốt hơn).
2. Mở đáp án, so.
3. Chỗ nào bạn nói mơ hồ hoặc thiếu → ghi lại số bài, quay về đọc bài đó.

**Với câu có số đo:** hãy tự đo lại. Bài
[00-moi-truong-va-devtools.md](../00-moi-truong-va-devtools.md) dựng chỗ đo trong 2 phút. Con số bạn
tự đo sẽ nhớ được lâu hơn con số đọc trên giấy.

---

## Điều người phỏng vấn thật sự tìm

Ở mức Middle, họ ít quan tâm bạn có thuộc cú pháp không (tra được trong 5 giây). Họ tìm ba thứ:

### 1. Bạn có mô hình đúng về cách trình duyệt hoạt động không

Câu hỏi kiểu "vì sao `z-index: 9999` vẫn bị che" không kiểm tra kiến thức về `z-index` — nó kiểm tra
bạn có biết khái niệm **stacking context** hay không. Người không biết sẽ trả lời "tăng số lên nữa".

### 2. Bạn debug thế nào

"Trang bị cuộn ngang, bạn làm gì đầu tiên?" — câu trả lời tốt là một **quy trình**, không phải một
phỏng đoán. Ví dụ: "Tôi mở DevTools, chạy vòng lặp so `getBoundingClientRect().right` với
`clientWidth` của `html` để tìm element tràn, rồi kiểm tra `min-width` computed của nó."

### 3. Bạn có biết cái giá của mỗi lựa chọn không

Mọi kỹ thuật đều có đánh đổi. Người trả lời "dùng `content-visibility: auto` cho nhanh" mà không biết
nó làm trang giật khi ước lượng sai, thì chưa dùng nó thật bao giờ.

Đây là lý do phần "cái giá đi kèm" xuất hiện trong hầu hết các bài của giáo trình.

---

## Bốn câu bạn nên chuẩn bị kỹ nhất

Theo kinh nghiệm, bốn chủ đề này xuất hiện trong gần như mọi buổi phỏng vấn frontend:

1. **Cascade và specificity** — "vì sao rule này không ăn" ([bài 01](../01-cascade-va-selector.md))
2. **Flexbox vs Grid** — "khi nào dùng cái nào" ([bài 04](../04-flexbox.md), [bài 05](../05-grid.md))
3. **Stacking context** — "vì sao z-index không ăn" ([bài 06](../06-position-va-stacking.md))
4. **Responsive** — "container query khác media query chỗ nào"
   ([bài 07](../07-responsive-va-container-query.md))

Nếu chỉ có 2 tiếng để ôn, ôn đúng bốn cái này.

---

## Câu hỏi bạn nên hỏi ngược lại

Phỏng vấn là hai chiều. Vài câu cho thấy bạn có kinh nghiệm thật:

- "Team đang dùng CSS thuần, CSS Modules, hay Tailwind? Vì sao chọn cái đó?"
- "Có design system chưa? Token màu và khoảng cách được quản lý thế nào?"
- "Các anh chị xử lý dark mode ra sao — hai bảng màu hay `light-dark()`?"
- "Có kiểm tra tiếp cận (a11y) trong quy trình review không?"
- "Có đo Core Web Vitals không? CLS đang bao nhiêu?"

---

Bắt đầu: [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md)
