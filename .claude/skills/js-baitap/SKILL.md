---
name: js-baitap
description: Tạo và chấm bài tập JavaScript dạng markdown cho dự án học JS này (ngày N/BaiTap/*.md). Dùng khi người dùng yêu cầu "tạo bài tập", "tạo N bài", "chấm điểm", "chấm bài", hoặc đã tự trả lời vào file bài tập và muốn được chấm + giải thích.
---

# Bài tập JavaScript — tạo & chấm điểm

Dự án này là nhật ký học JavaScript, chia theo thư mục `ngày 1/`, `ngày 2/`, `ngày 3/`, ... Mỗi ngày có
thư mục con `BaiTap/` chứa các file `.md` bài tập theo một format cố định đã thống nhật qua nhiều lần
làm việc. File tham chiếu chuẩn (đã hoàn thiện đầy đủ cả tạo bài + chấm điểm):
`ngày 2/BaiTap/10_bai_tap_this.md`. Luôn ưu tiên bám theo format của file này khi không chắc.

## 1. Khi tạo bài tập mới

- Vị trí: `ngày <X>/BaiTap/<so_luong>_bai_tap_<chu_de>.md` (ví dụ `10_bai_tap_closure.md`).
- Đầu file luôn có khối quy tắc:

  ```markdown
  # <N> Bài tập JavaScript - `<chủ đề>`

  > **Quy tắc:** Không chạy code ngay. Hãy tự dự đoán kết quả hoặc lỗi,
  > sau đó giải thích vì sao.
  ```

- Mỗi bài theo cấu trúc:

  ```markdown
  ## Bài <n> - <tên ngắn gọn của tình huống>

  ``` javascript
  // code minh họa — ngắn, chạy được, tập trung đúng 1 khái niệm cốt lõi
  ```

  **Câu hỏi**
  1. <câu hỏi con 1>
  2. <câu hỏi con 2>
  3. <câu hỏi con 3 nếu cần>

  ------------------------------------------------------------------------
  ```

  (Câu hỏi luôn là list đánh số, **mỗi ý một dòng riêng** — không viết dồn trên một dòng.)

- Độ khó tăng dần qua các bài; bài cuối có thể là `# Bonus` nâng cao, không đánh số vào tổng bài chính.
- Không tự điền đáp án khi mới tạo đề — để trống cho người dùng tự làm trước.

## 2. Khi chấm điểm

Người dùng tự chạy các bài trong đầu, gõ câu trả lời thô (không format) ngay dưới mỗi khối **Câu hỏi**,
rồi yêu cầu chấm. Với mỗi bài, thực hiện đúng theo trình tự:

1. **Định dạng lại câu trả lời gốc** dưới nhãn `**Trả lời của bạn:**` — giữ nguyên nội dung/ý người
   dùng viết, chỉ tách thành list rõ ràng theo từng ý câu hỏi (1., 2., 3.), và tách bằng sub-bullet nếu
   một ý gộp nhiều nhận định. Không tự ý sửa nội dung câu trả lời ở bước này, kể cả khi nó sai — chỉ
   trình bày lại cho dễ đọc.
2. **Chấm điểm** trong blockquote ngay sau, theo khuôn:

   ```markdown
   > **Chấm điểm: X/10**
   >
   > - <icon> **Ý 1** — <đúng/sai/nhận xét ngắn>: <giải thích>
   > - <icon> **Ý 2** — ...
   ```

   Icon dùng thống nhất:
   - `✅` đúng hoàn toàn
   - `⚠️` đúng ý/đúng khái niệm nhưng thiếu chính xác, thiếu format, hoặc chỉ đúng một phần
   - `❌` sai (kết quả sai hoặc lý do sai)
   - `⬜` chưa trả lời

3. Nếu có ý `❌` hoặc `⚠️` đáng kể, thêm đoạn **"Giải thích đúng:"** hoặc **"Lý do thật sự:"** ngay sau
   danh sách ý, giải thích rõ ràng, đầy đủ — không chỉ nói "sai" mà phải chỉ ra chính xác kết quả/lý do
   đúng là gì, có thể kèm ví dụ code ngắn minh họa nếu giúp dễ hiểu hơn (như cách đã làm ở Bài 5 và
   phần "Bonus lưu ý" của Bài 2 trong file tham chiếu).
4. Nếu người dùng hỏi thêm để giải thích sâu hơn một điểm cụ thể sau khi đã chấm, mở rộng ngay trong
   khối giải thích tương ứng của bài đó (không tạo bài mới), có thể thêm ví dụ tương đương
   (`this.ten = ten` ~ `window.ten = ...`), liệt kê hệ quả thực tế, và cách phòng tránh — xem đoạn
   "Bonus lưu ý — vì sao quên `new` lại nguy hiểm" trong file tham chiếu làm mẫu độ chi tiết mong muốn.

## 3. Sau khi chấm hết các bài

Thêm/cập nhật cuối file:

```markdown
------------------------------------------------------------------------

# Tổng kết điểm

| Bài | Điểm | Ghi chú ngắn |
|---|---|---|
| 1 | x/10 | ... |
...

**Tổng: xx/100 (~x.x/10)** cho <N> bài chính.

**Cần ôn lại:** nêu đúng 1-2 lỗ hổng khái niệm quan trọng nhất (không liệt kê hết lỗi vụn vặt), chỉ ra
bài nào minh họa rõ nhất, và liên kết tới các bài khác có cùng gốc rễ khái niệm nếu có (ví dụ: lỗi
lexical `this` ở Bài 5 và Bài 9 là cùng một lỗ hổng).
```

## Nguyên tắc chung

- Viết bằng tiếng Việt, giọng văn ngắn gọn, kỹ thuật, dùng backtick cho tên biến/hàm/keyword.
- Dùng `Read`/`Bash cat -n` để lấy đúng nội dung hiện tại trước khi `Edit` — file này người dùng chỉnh
  tay liên tục nên luôn xác nhận state mới nhất trước khi sửa.
- Sửa bằng `Edit` theo từng khối (mỗi bài một edit) thay vì viết đè cả file, trừ khi tạo file hoàn toàn
  mới.
- Không xóa hoặc viết lại câu trả lời gốc của người dùng — chỉ định dạng lại cách trình bày và bổ sung
  phần chấm/giải thích bên cạnh.
