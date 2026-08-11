# Luyện phỏng vấn NestJS

| File | Nội dung |
|------|----------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 55 câu hỏi + đáp án hai tầng |
| [02-tu-kiem-tra.md](./02-tu-kiem-tra.md) | Checklist tự chấm |

---

## Ba nhóm câu hỏi NestJS

**Nhóm 1 — DI và Module** (35%)
Đây là **bộ lọc**. NestJS được xây quanh dependency injection; không giải thích được provider, scope,
module là bị đánh giá "chỉ copy code từ docs".

**Nhóm 2 — Vòng đời request** (30%)
Middleware, Guard, Interceptor, Pipe, Filter — **thứ tự chạy** là câu hỏi kinh điển nhất của NestJS.

**Nhóm 3 — Thực chiến** (35%)
TypeORM, validation, auth JWT, testing, xử lý lỗi, hiệu năng.

---

## Câu hỏi bị hỏi nhiều nhất

> **"Thứ tự chạy của Middleware, Guard, Interceptor, Pipe, Filter là gì?"**

Nếu chỉ nhớ được một thứ trong bộ này thì nhớ câu đó. Đáp án đầy đủ ở
[01 mục B1](./01-cau-hoi-va-dap-an.md#b1--thứ-tự-chạy-của-5-thành-phần-trong-vòng-đời-request).

---

## Cách trả lời

```
Tầng 1  Định nghĩa ngắn + vấn đề nó giải quyết
Tầng 2  Ví dụ từ dự án Blog API của bạn
Tầng 3  Cái bẫy / đánh đổi
```

NestJS là framework "có ý kiến" — người phỏng vấn hay hỏi **"vì sao NestJS làm thế"**. Trả lời được
phần "vì sao" quan trọng hơn thuộc cú pháp.

---

## Lộ trình 4 ngày

| Ngày | Việc |
|------|------|
| 1 | [02-tu-kiem-tra.md](./02-tu-kiem-tra.md), rồi ôn nhóm A (DI, module) |
| 2 | Nhóm B (vòng đời request) — vẽ được sơ đồ ra giấy |
| 3 | Nhóm C–D (database, auth, testing) |
| 4 | Nhóm E (hiệu năng, kiến trúc), làm lại checklist |

Có sẵn sơ đồ luồng dữ liệu ở [12-so-do-luong-du-lieu.md](../12-so-do-luong-du-lieu.md) — tập vẽ lại
bằng tay, vì phỏng vấn hay yêu cầu "vẽ thử kiến trúc cho tôi xem".

---

Quay lại [bộ NestJS](../README.md)
