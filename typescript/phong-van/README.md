# Luyện phỏng vấn TypeScript

TypeScript hiếm khi là chủ đề chính của buổi phỏng vấn — nó thường xen vào giữa câu hỏi về React,
Node hay NestJS. Nhưng vài câu TypeScript trả lời lúng túng đủ để người phỏng vấn nghi ngờ mọi câu
còn lại.

| File | Nội dung |
|------|----------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 45 câu hỏi + đáp án hai tầng, kèm bài tập code trên giấy |
| [02-tu-kiem-tra.md](./02-tu-kiem-tra.md) | Checklist tự chấm trước khi ôn |

---

## Ba nhóm câu hỏi TypeScript hay gặp

**Nhóm 1 — kiểm tra bạn có thật sự dùng không** (70% câu hỏi)
`any` vs `unknown`, `type` vs `interface`, narrowing, generic cơ bản, utility type. Không trả lời được
nhóm này thì bị đánh giá là "chỉ gắn kiểu cho có".

**Nhóm 2 — kiểm tra bạn hiểu cơ chế** (25%)
Structural typing, kiểu bị xoá lúc chạy, declaration merging, `satisfies` vs `as`. Đây là chỗ ghi điểm.

**Nhóm 3 — type-level programming** (5%)
Conditional type, `infer`, mapped type, template literal type. Hiếm khi bắt buộc ở mức middle, nhưng
biết thì rất nổi bật.

---

## Ba câu trả lời sai kinh điển

| Câu hỏi | Trả lời sai | Vì sao sai |
|---------|-------------|-----------|
| "TypeScript giúp gì?" | "Nó bắt lỗi runtime" | **Không.** Kiểu bị xoá sạch khi biên dịch. Nó bắt lỗi lúc bạn gõ code, không bắt gì lúc chạy |
| "`type` khác `interface` chỗ nào?" | "Interface cho object, type cho union" | Đúng nhưng hời hợt. Khác biệt **thật sự** là `interface` gộp được khi trùng tên |
| "Dữ liệu từ API có kiểu chưa?" | "Có, em khai `as User`" | `as` chỉ là lời hứa với trình biên dịch. Dữ liệu thật vẫn có thể sai — phải validate ở biên |

Ba câu này bị hỏi rất nhiều. Xem đáp án đầy đủ ở [01](./01-cau-hoi-va-dap-an.md) mục A1, B3, D2.

---

## Cách trả lời

Giống Laravel — ba tầng:

```
Tầng 1  Định nghĩa ngắn + vì sao nó tồn tại
Tầng 2  Một ví dụ code CỤ THỂ
Tầng 3  Cái bẫy / đánh đổi (chỉ nói khi được hỏi thêm)
```

Với TypeScript, **tầng 2 nên là code viết ra giấy hoặc gõ trực tiếp**. Rất nhiều câu hỏi TS được hỏi
kèm "viết thử cho tôi xem". Tập gõ, đừng chỉ tập nói.

---

## Lộ trình 3 ngày

| Ngày | Việc |
|------|------|
| 1 | Làm [02-tu-kiem-tra.md](./02-tu-kiem-tra.md), rồi ôn nhóm A–C của [01](./01-cau-hoi-va-dap-an.md) |
| 2 | Ôn nhóm D–F, làm hết bài tập code trong file 01 |
| 3 | Đọc [bài 11](../11-type-system-sau.md), làm lại checklist |

---

Quay lại [bộ TypeScript](../README.md)
