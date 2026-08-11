# Luyện phỏng vấn Docker

| File | Nội dung |
|------|----------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 40 câu hỏi + đáp án hai tầng |
| [02-tu-kiem-tra.md](./02-tu-kiem-tra.md) | Checklist tự chấm |

---

## Đặc thù của phỏng vấn Docker

Docker hiếm khi là vị trí riêng — nó là **câu hỏi phụ** trong phỏng vấn backend hoặc DevOps. Nhưng nó
được hỏi ở **hầu hết** buổi phỏng vấn backend, vì nó cho biết bạn đã từng đưa code lên production chưa.

Ba mức câu hỏi:

| Mức | Câu hỏi điển hình | Cho thấy gì |
|-----|-------------------|-------------|
| **Biết dùng** | "Image khác container thế nào?" | Đã đọc tài liệu |
| **Dùng thật** | "Vì sao `COPY package.json` trước `COPY . .`?" | Đã tự viết Dockerfile |
| **Vận hành** | "Server đầy đĩa vì Docker, bạn làm gì?" | Đã từng deploy và gặp sự cố |

Mức 2 và 3 là chỗ ghi điểm. Ai cũng trả lời được mức 1.

---

## Bốn câu hỏi hay gặp nhất

1. **Image khác container thế nào?** — câu mở đầu gần như chắc chắn.
2. **Vì sao thứ tự lệnh trong Dockerfile quan trọng?** — kiểm tra bạn hiểu layer cache.
3. **Multi-stage build để làm gì?** — kiểm tra bạn có tối ưu ảnh không.
4. **`CMD` khác `ENTRYPOINT`?** — câu bẫy kinh điển, nhiều người trả lời sai.

Đáp án đầy đủ trong [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md).

---

## Cách trả lời

Docker là chủ đề mà **con số và lệnh cụ thể** thuyết phục hơn lý thuyết:

> ❌ "Multi-stage build giúp ảnh nhỏ hơn."
>
> ✅ "Ảnh NestJS của em ban đầu 1.2GB vì có cả `devDependencies` và toolchain build. Tách multi-stage,
> stage cuối chỉ copy `dist/` và `node_modules` production, còn 180MB. Em kiểm tra bằng
> `docker images` và `docker history` để xem layer nào nặng."

Chuẩn bị sẵn **con số của chính bạn** từ dự án blog-api.

---

## Lộ trình 2 ngày

| Ngày | Việc |
|------|------|
| 1 | [02-tu-kiem-tra.md](./02-tu-kiem-tra.md), rồi nhóm A–C của [01](./01-cau-hoi-va-dap-an.md) |
| 2 | Nhóm D–E, đọc [bài 08](../08-registry-ci-orchestration.md), làm lại checklist |

---

Quay lại [bộ Docker](../README.md)
