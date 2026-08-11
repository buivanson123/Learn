# Luyện phỏng vấn Next.js

| File | Nội dung |
|------|----------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 50 câu hỏi + đáp án hai tầng |
| [02-tu-kiem-tra.md](./02-tu-kiem-tra.md) | Checklist tự chấm |

---

## Đặc thù của phỏng vấn Next.js

Khác với NestJS hay Laravel, phỏng vấn Next.js có một rủi ro riêng: **người phỏng vấn có thể đang dùng
Pages Router hoặc Next 13/14**, trong khi bạn học App Router của Next 16.

Cách xử lý: trả lời theo App Router, nhưng **nói rõ bạn đang nói về bản nào** và biết đối chiếu.

> "Ở App Router thì em dùng `fetch` với `next: { revalidate }`. Nếu team đang ở Pages Router thì tương
> đương là `getStaticProps` với `revalidate` — cùng ý tưởng ISR, khác cách khai."

Câu trả lời như vậy cho thấy bạn hiểu **khái niệm**, không chỉ thuộc cú pháp.

---

## Ba nhóm câu hỏi

**Nhóm 1 — Server vs Client Component** (35%)
Đây là bộ lọc. Không giải thích được RSC là gì và ranh giới `'use client'` nằm ở đâu thì bị đánh giá là
"viết React trong thư mục app".

**Nhóm 2 — Rendering và Cache** (35%)
SSR/SSG/ISR, bốn tầng cache của Next, `revalidatePath`/`revalidateTag`. Câu hỏi khó nhất nhóm này là
"dữ liệu cũ mà không cập nhật, bạn tìm ở đâu".

**Nhóm 3 — Thực chiến** (30%)
Server Actions, auth, SEO, Core Web Vitals, deploy.

---

## ⚠️ Next 16 khác code trên mạng rất nhiều

Đây vừa là bẫy vừa là cơ hội ghi điểm. Sáu thứ đổi mà tài liệu/blog cũ chưa cập nhật:

| Thứ | Trước | Next 16 |
|-----|-------|---------|
| `params`, `searchParams` | đồng bộ | **phải `await`** |
| `cookies()`, `headers()`, `draftMode()` | đồng bộ | **phải `await`** |
| `middleware.ts` | tên đó | đổi thành **`proxy.ts`** (runtime Node.js) |
| `revalidateTag` | 1 tham số | **2 tham số** |
| `next lint` | có | **đã gỡ** |
| Parallel route | tuỳ chọn | **bắt buộc có `default.tsx`** |

Nói được vài điểm này trong phỏng vấn chứng minh bạn dùng bản mới thật, không copy từ blog cũ.
Bảng đầy đủ ở [09-cheatsheet.md](../09-cheatsheet.md).

---

## Lộ trình 4 ngày

| Ngày | Việc |
|------|------|
| 1 | [02-tu-kiem-tra.md](./02-tu-kiem-tra.md), rồi nhóm A (RSC) |
| 2 | Nhóm B (rendering, cache) — vẽ được sơ đồ 4 tầng cache |
| 3 | Nhóm C–D (Server Actions, auth, SEO) |
| 4 | Nhóm E (hiệu năng), làm lại checklist |

---

Quay lại [bộ Next.js](../README.md)
