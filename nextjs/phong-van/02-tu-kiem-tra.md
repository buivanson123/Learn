# Tự kiểm tra Next.js

Với mỗi dòng: **"Tôi giải thích được trong 1 phút, kèm ví dụ từ dự án Blog frontend không?"**

✅ được · ⚠️ lơ mơ · ❌ không

Ngưỡng đi phỏng vấn: **không còn ❌ ở nhóm A và B**.

---

## A. Server vs Client Component — bộ lọc

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | RSC là gì, khác Client Component ở 6 điểm | [02](../02-server-client-component.md) |
| ☐ | `'use client'` là **ranh giới**, lan xuống mọi import | [02](../02-server-client-component.md) |
| ☐ | Vì sao không đặt `'use client'` ở `layout.tsx` gốc | [02](../02-server-client-component.md) |
| ☐ | Props truyền xuống Client Component phải serialize được | [02](../02-server-client-component.md) |
| ☐ | Client bọc Server bằng `children` — mẫu Provider | [02](../02-server-client-component.md) |
| ☐ | Vì sao Server Component không có `useState` | [02](../02-server-client-component.md) |
| ☐ | RSC payload là gì, khác HTML thế nào | [nc/02](<../nâng cao/02-co-che-render.md>) |
| ☐ | Hydration mismatch — 3 nguyên nhân và cách sửa | [10](../10-loi-thuong-gap.md) |
| ☐ | `next/image` chống CLS thế nào, `priority` cho gì | [07](../07-toi-uu-seo-deploy.md) |
| ☐ | Next 16: `images.qualities` mặc định chỉ `[75]` | [09](../09-cheatsheet.md) |

---

## B. Rendering và Cache — hỏi nhiều nhất

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | SSG / ISR / SSR / CSR và tương ứng ở App Router | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | **Bốn tầng cache** — vẽ được, biết xoá bằng lệnh gì | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | Thứ tự đi tìm khi "dữ liệu không cập nhật" | [01 B9](./01-cau-hoi-va-dap-an.md) |
| ☐ | `revalidatePath` vs `revalidateTag` | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | Next 16: `revalidateTag` nhận **2 tham số** | [09](../09-cheatsheet.md) |
| ☐ | Dùng `cookies()`/`headers()` làm route thành dynamic | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | Streaming + `<Suspense>` + `loading.tsx` | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | Fetch song song bằng `Promise.all` thay vì `await` liên tiếp | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | Request Memoization và `React.cache()` | [nc/02](<../nâng cao/02-co-che-render.md>) |
| ☐ | `generateStaticParams` + `dynamicParams` | [01](../01-app-router.md) |
| ☐ | `unstable_cache` cho query không phải `fetch` | [03](../03-lay-du-lieu-va-cache.md) |
| ☐ | Chạy nhiều instance cần cache handler dùng chung | [nc/05](<../nâng cao/05-cache-nhieu-tang.md>) |
| ☐ | PPR là gì (khái niệm) | [nc/01](<../nâng cao/01-cache-components.md>) |

---

## C. Routing và Server Actions

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | App Router vs Pages Router — bảng tương ứng | [01](../01-app-router.md) |
| ☐ | 8 file đặc biệt, `layout` vs `template` | [01](../01-app-router.md) |
| ☐ | Next 16: `params`/`searchParams` phải `await` | [01](../01-app-router.md) |
| ☐ | Next 16: `middleware.ts` → `proxy.ts`, runtime Node | [05](../05-route-handler-va-proxy.md) |
| ☐ | Next 16: parallel route bắt buộc `default.tsx` | [09](../09-cheatsheet.md) |
| ☐ | Server Action vs Route Handler — khi nào dùng cái nào | [04](../04-server-actions-va-form.md) |
| ☐ | **Server Action là endpoint công khai** — phải tự kiểm quyền | [04](../04-server-actions-va-form.md) |
| ☐ | `useFormStatus` phải nằm trong component con | [04](../04-server-actions-va-form.md) |
| ☐ | Route Handler làm proxy giấu token | [05](../05-route-handler-va-proxy.md) |
| ☐ | `<Link>` prefetch, khác `<a>` | [01](../01-app-router.md) |

---

## D. Auth, SEO, Bảo mật

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Vì sao JWT vào cookie `httpOnly`, không localStorage | [06](../06-auth-jwt.md) |
| ☐ | Bảo vệ route hai tầng — vì sao `proxy.ts` chưa đủ | [06](../06-auth-jwt.md) |
| ☐ | Data Access Layer + `server-only` | [nc/07](<../nâng cao/07-kien-truc-quy-mo-lon.md>) |
| ☐ | `NEXT_PUBLIC_*` nhúng vào bundle lúc build | [00](../00-chuan-bi.md) |
| ☐ | `generateMetadata` động | [07](../07-toi-uu-seo-deploy.md) |
| ☐ | `error.tsx` phải là Client Component, có `reset()` | [10](../10-loi-thuong-gap.md) |
| ☐ | `dangerouslySetInnerHTML` và cách lọc | [nc/08](<../nâng cao/08-bao-mat-nang-cao.md>) |

---

## E. Hiệu năng, vận hành

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | LCP / INP / CLS — Next giúp gì cho từng cái | [nc/04](<../nâng cao/04-toi-uu-hieu-nang.md>) |
| ☐ | Bundle lớn — 4 bước xử lý | [nc/04](<../nâng cao/04-toi-uu-hieu-nang.md>) |
| ☐ | Phân biệt chậm ở server (TTFB) hay ở client | [nc/10](<../nâng cao/10-observability-benchmark.md>) |
| ☐ | Lab data vs RUM | [nc/10](<../nâng cao/10-observability-benchmark.md>) |
| ☐ | Deploy ngoài Vercel: `standalone` + 3 thứ phải tự lo | [07](../07-toi-uu-seo-deploy.md) |
| ☐ | Next 16 đã gỡ `next lint` | [09](../09-cheatsheet.md) |

---

## F. Làm được không?

Trong 5 phút, không nhìn tài liệu:

| | Bài |
|---|---|
| ☐ | Vẽ sơ đồ 4 tầng cache + lệnh xoá từng tầng |
| ☐ | Server Component fetch song song + `<Suspense>` |
| ☐ | Server Action đủ 4 bước: session → Zod → DB → `revalidateTag` |
| ☐ | `generateMetadata` động |
| ☐ | Kể 3 chỗ code Next 14 hỏng khi lên Next 16 |

---

## G. Kể được không?

| | Nội dung |
|---|---|
| ☐ | Kể dự án Blog frontend trong 2 phút, kèm con số (LCP, bundle size, số request) |
| ☐ | Một lỗi khó: hydration mismatch hoặc cache không cập nhật |
| ☐ | Vì sao chọn App Router (nếu team hỏi) |
| ☐ | Thích/không thích gì ở Next.js |

---

## Chấm

| Kết quả | Nghĩa |
|---------|-------|
| A còn ❌ | **Chưa nên đi phỏng vấn.** RSC là nền tảng của App Router |
| B còn ❌ | Ôn ngay [bài 03](../03-lay-du-lieu-va-cache.md) — cache là nhóm bị hỏi sâu nhất |
| C còn ⚠️ ở mục Next 16 | Ưu tiên — đây là chỗ dễ ghi điểm nhất vì ít người cập nhật |
| D, E còn ⚠️ | Chấp nhận được nếu nói được vấn đề nó giải quyết |
| F còn ❌ | Nguy hiểm — phỏng vấn frontend hay yêu cầu code trực tiếp |

---

| Lần | Ngày | ❌ | ⚠️ |
|-----|------|----|----|
| 1 | | | |
| 2 | | | |

---

Quay lại [README phỏng vấn](./README.md) · [Bộ Next.js](../README.md)
