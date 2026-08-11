# Học Next.js nhanh nhất (App Router — Next.js 16)

Next.js là framework React để dựng web app: nó lo giúp bạn **routing theo thư mục**, **render trên server**, **cache**, **bundle**, và **deploy**. Bạn viết component, Next.js quyết định phần nào chạy ở server, phần nào gửi xuống trình duyệt.

Điểm khiến Next.js khác hẳn cách viết frontend cũ: **mặc định mọi component chạy trên server**. Không có `useEffect` + `fetch` + `useState` để lấy dữ liệu nữa — bạn `await` thẳng trong component. Chỉ khi cần tương tác (click, gõ phím, state) bạn mới đánh dấu `'use client'` để đẩy component đó xuống trình duyệt.

Tài liệu này viết cho **Next.js 16.3** (bản mới nhất tại 08/2026) với **App Router**. Đây là điều quan trọng: rất nhiều bài viết trên mạng vẫn dạy Pages Router (`pages/`) hoặc Next.js 13/14 — cú pháp đã khác hẳn (xem [10-loi-thuong-gap.md](./10-loi-thuong-gap.md#lỗi-19--copy-code-từ-bài-viết-cũ)).

---

## Dự án xuyên suốt

Toàn bộ ví dụ trong tài liệu này gọi vào **Blog API** bạn đã dựng ở [../nestjs/08-du-an-blog-api.md](../nestjs/08-du-an-blog-api.md).

| Thứ | Giá trị |
|---|---|
| Backend NestJS | `http://localhost:3000/api` |
| Frontend Next.js | `http://localhost:3001` |
| Dạng response | `{ success, data, timestamp }` |
| Token đăng nhập | `data.accessToken` |

Chưa có Blog API cũng học được — bài [00-chuan-bi.md](./00-chuan-bi.md#5-không-có-blog-api-thì-sao) chỉ cách dùng API công khai thay thế.

---

## Lộ trình 7 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-chuan-bi.md](./00-chuan-bi.md) | Cài đặt, cấu trúc thư mục, React vừa đủ | 3h |
| 1 | [01-app-router.md](./01-app-router.md) | Routing bằng thư mục, layout, loading, error. **File nền tảng** | 3h |
| 2 | [02-server-client-component.md](./02-server-client-component.md) | Server Component vs Client Component — **khái niệm khó nhất** | 4h |
| 3 | [03-lay-du-lieu-va-cache.md](./03-lay-du-lieu-va-cache.md) | `fetch`, cache, revalidate, streaming, ISR | 4h |
| 4 | [04-server-actions-va-form.md](./04-server-actions-va-form.md) | Server Actions, `useActionState`, validate form | 4h |
| 5 | [05-route-handler-va-proxy.md](./05-route-handler-va-proxy.md) | `route.ts`, `proxy.ts` (trước gọi là middleware), cookies | 3h |
| 6 | [06-auth-jwt.md](./06-auth-jwt.md) | Đăng nhập vào Blog API, JWT trong httpOnly cookie, chặn route | 4h |
| 7 | [07-toi-uu-seo-deploy.md](./07-toi-uu-seo-deploy.md) | Image, Font, metadata/SEO, env, build, Docker | 3h |
| 7+ | [08-du-an-blog-frontend.md](./08-du-an-blog-frontend.md) | **Dự án: giao diện Blog hoàn chỉnh** | 8h |
| — | [09-cheatsheet.md](./09-cheatsheet.md) | Tra cứu nhanh file convention, API, CLI | — |
| — | [10-loi-thuong-gap.md](./10-loi-thuong-gap.md) | 20 lỗi kinh điển kèm thông báo lỗi thật | — |

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 50 câu hỏi kèm đáp án hai tầng, 5 bài tập vẽ/code, và
checklist tự kiểm tra.

Hai nhóm bị hỏi sâu nhất: **Server vs Client Component** và **bốn tầng cache**. Ngoài ra, những điểm
Next 16 khác các bản trước (`await params`, `proxy.ts`, `revalidateTag` 2 tham số) là chỗ dễ ghi điểm
nhất vì rất ít người cập nhật.

---

## Sau khi xong phần cơ bản

👉 **[nâng cao/](<./nâng cao/README.md>)** — bộ 10 bài về **chịu tải, dữ liệu lớn và vận hành**:
Cache Components & `use cache`, cơ chế render (RSC payload, streaming, hydration),
cursor pagination & virtual list, tối ưu Core Web Vitals, cache handler Redis cho nhiều instance,
SSE & WebSocket, Data Access Layer, bảo mật nâng cao, testing, OpenTelemetry & benchmark k6.

Điều kiện: đã làm xong dự án Blog ở bài 08.

---

## Bốn nguyên tắc cốt lõi

Hiểu 4 điều này là hiểu 80% Next.js App Router.

### 1. Thư mục chính là URL

Không có file khai báo route. Bạn tạo thư mục, Next.js sinh URL:

```
app/posts/page.tsx           →  /posts
app/posts/[slug]/page.tsx    →  /posts/hoc-nextjs
```

Chỉ file tên đúng chuẩn mới thành route. `app/posts/index.tsx` **không** thành route — phải là `page.tsx`.

### 2. Mọi component mặc định chạy trên server

```tsx
// app/posts/page.tsx — không có 'use client'
export default async function Page() {
  const res = await fetch('http://localhost:3000/api/posts')  // chạy trên server
  const { data } = await res.json()
  return <ul>{data.items.map(p => <li key={p.id}>{p.title}</li>)}</ul>
}
```

Component này **không hề được gửi xuống trình duyệt**. Trình duyệt chỉ nhận HTML đã render xong. Vì vậy bạn có thể dùng biến môi trường bí mật, gọi thẳng database — không lộ ra ngoài.

### 3. `'use client'` là ranh giới, không phải nhãn dán

Khi một file có `'use client'` ở dòng đầu, **file đó và mọi file nó import** đều bị đẩy xuống trình duyệt.

Nghĩa là đặt `'use client'` sai chỗ (ví dụ ở layout gốc) sẽ kéo cả ứng dụng xuống client và bạn mất sạch lợi ích của server rendering. Quy tắc: đẩy `'use client'` **xuống càng sâu càng tốt**, chỉ ở đúng component cần tương tác.

### 4. Dữ liệu theo request phải `await`

Từ Next.js 16, các API sau **bắt buộc** là `async`:

```tsx
const { slug } = await params          // không còn params.slug
const { page } = await searchParams
const cookieStore = await cookies()
const h = await headers()
```

Viết `params.slug` trực tiếp sẽ báo lỗi. Đây là thay đổi phá vỡ lớn nhất so với Next.js 14 và là lý do code copy trên mạng hay hỏng.

---

## Cách học hiệu quả

1. **Chạy `npm run dev` liên tục.** Sửa file là thấy kết quả ngay, không cần reload.
2. **Gõ tay, không copy-paste.** Đặc biệt là phần `'use client'` — chỉ ngấm khi bạn tự tay đặt sai vài lần rồi đọc lỗi.
3. **Mở tab Network của trình duyệt.** Đây là cách duy nhất để thấy Server Component thật sự không gửi JS xuống.
4. **Làm dự án ở bài 08 song song.** Học tới đâu, áp vào giao diện Blog tới đó.
5. **Đọc lỗi, đừng đoán.** Next.js 16 báo lỗi rất chi tiết và có kèm link tài liệu. Bài [10](./10-loi-thuong-gap.md) chép nguyên văn 20 thông báo lỗi hay gặp.

---

## Yêu cầu môi trường

| Thứ | Phiên bản tối thiểu | Kiểm tra |
|---|---|---|
| Node.js | **20.9** (Node 18 không còn được hỗ trợ) | `node -v` |
| TypeScript | 5.1 | `npx tsc -v` |
| Trình duyệt (để dev) | Chrome/Edge/Firefox 111+, Safari 16.4+ | |

```bash
$ node -v
v22.14.0        ← đạt yêu cầu (>= 20.9)
```

Nếu ra `v18.x`, `next dev` sẽ dừng ngay:

```
You are using Node.js 18.20.4. For Next.js, Node.js version ">=20.9.0" is required.
```

Bắt đầu tại 👉 [00-chuan-bi.md](./00-chuan-bi.md)
