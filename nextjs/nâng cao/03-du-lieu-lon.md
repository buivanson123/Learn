# Bài 3 (NC) — Dữ liệu lớn

Bài này giải quyết ba tình huống làm sập giao diện: **phân trang sâu**, **render danh sách khổng lồ**, và **xuất file lớn**.

## 1. Vì sao `OFFSET` giết chết trang cuối

Phân trang bạn viết ở dự án Blog:

```
GET /api/posts?page=1&limit=20     →  OFFSET 0
GET /api/posts?page=500&limit=20   →  OFFSET 9980
GET /api/posts?page=25000&limit=20 →  OFFSET 499980
```

Vấn đề: database phải **duyệt và bỏ đi** 499.980 dòng trước khi lấy được 20 dòng bạn cần.

Đo trên PostgreSQL với 1 triệu bản ghi:

```sql
EXPLAIN ANALYZE SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 0;
```
```
 Limit  (cost=0.42..1.85 rows=20)
   ->  Index Scan Backward using idx_posts_created_at on posts
 Execution Time: 0.089 ms
```

```sql
EXPLAIN ANALYZE SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 499980;
```
```
 Limit  (cost=35421.18..35422.60 rows=20)
   ->  Index Scan Backward using idx_posts_created_at on posts
 Execution Time: 428.317 ms          ← chậm gấp 4800 lần
```

Và nó còn tệ hơn tuyến tính: `OFFSET 999980` mất gần một giây. Trang cuối luôn là trang chậm nhất.

Có một lỗi thứ hai ít ai để ý: **kết quả có thể trùng hoặc mất**. Ai đó đăng bài mới trong lúc bạn đang ở trang 2 → mọi thứ dịch xuống một dòng → bài cuối trang 2 xuất hiện lại ở đầu trang 3.

---

## 2. Cursor pagination

Thay vì "bỏ qua N dòng", ta nói "lấy các dòng **sau** con trỏ này".

```sql
-- Trang đầu
SELECT * FROM posts ORDER BY created_at DESC, id DESC LIMIT 20;

-- Trang sau: cursor = (created_at, id) của dòng cuối trang trước
SELECT * FROM posts
WHERE (created_at, id) < ('2026-08-01 10:00:00', 4821)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

```
 Execution Time: 0.094 ms       ← trang 25.000 cũng nhanh y như trang 1
```

Hai chi tiết bắt buộc:

1. **Phải có trường phá hoà (tie-breaker).** Chỉ `created_at` thôi thì hai bài cùng giây sẽ gây mất/lặp dòng. Luôn ghép thêm `id`.
2. **Index phải khớp thứ tự sắp xếp:** `CREATE INDEX idx_posts_cursor ON posts (created_at DESC, id DESC);`

### Phía Next.js

```ts
// src/lib/api.ts
export type CursorPage<T> = {
  items: T[]
  nextCursor: string | null
}

export async function getPostsCursor(cursor?: string, limit = 20) {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (cursor) qs.set('cursor', cursor)

  return apiFetch<CursorPage<Post>>(`/posts/cursor?${qs}`, {
    next: { revalidate: 60, tags: ['posts'] },
  })
}
```

Cursor nên là chuỗi đục (opaque) để client không tự chế:

```ts
// Backend NestJS
const nextCursor = Buffer
  .from(`${last.createdAt.toISOString()}|${last.id}`)
  .toString('base64url')
// → 'MjAyNi0wOC0wMVQxMDowMDowMC4wMDBafDQ4MjE'
```

```bash
$ curl -s "localhost:3000/api/posts/cursor?limit=3" | jq '{count: (.data.items|length), next: .data.nextCursor}'
{
  "count": 3,
  "next": "MjAyNi0wOC0wMVQxMDowMDowMC4wMDBafDQ4MjE"
}
```

### Đánh đổi phải biết

| | OFFSET | Cursor |
|---|---|---|
| Nhảy thẳng tới trang 500 | ✅ | ❌ chỉ đi tiếp/lùi |
| Hiện "Trang 12 / 4832" | ✅ | ❌ không biết tổng |
| Tốc độ ở trang sâu | ❌ | ✅ |
| Không lặp/mất dòng | ❌ | ✅ |

Quy tắc thực dụng: **giao diện phân trang có số trang → OFFSET nhưng giới hạn `page` tối đa** (Google cũng chỉ cho xem ~100 trang). **Cuộn vô hạn, feed, bảng lớn → cursor.**

---

## 3. Cuộn vô hạn với Server Action

```ts
// app/posts/actions.ts
'use server'

import { getPostsCursor } from '@/lib/api'

export async function loadMorePosts(cursor: string) {
  return getPostsCursor(cursor, 20)
}
```

```tsx
// components/InfinitePostList.tsx
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { loadMorePosts } from '@/app/posts/actions'
import type { Post } from '@/lib/types'

export default function InfinitePostList({
  initialItems,
  initialCursor,
}: {
  initialItems: Post[]
  initialCursor: string | null
}) {
  const [items, setItems] = useState(initialItems)
  const [cursor, setCursor] = useState(initialCursor)
  const [pending, startTransition] = useTransition()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cursor) return                       // hết dữ liệu, gỡ observer

    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || pending) return

        startTransition(async () => {
          const page = await loadMorePosts(cursor)
          setItems((prev) => [...prev, ...page.items])
          setCursor(page.nextCursor)
        })
      },
      { rootMargin: '400px' },                // tải trước khi người dùng chạm đáy
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [cursor, pending])

  return (
    <>
      <ul className="space-y-3">
        {items.map((post) => (
          <li key={post.id} className="rounded border p-3">{post.title}</li>
        ))}
      </ul>

      {cursor ? (
        <div ref={sentinelRef} className="py-8 text-center text-gray-400">
          {pending ? 'Đang tải...' : ''}
        </div>
      ) : (
        <p className="py-8 text-center text-gray-400">Đã hết bài viết.</p>
      )}
    </>
  )
}
```

Bốn chi tiết quyết định chất lượng:

1. **`rootMargin: '400px'`** — nạp trước khi người dùng chạm đáy. Bỏ đi thì lần nào cuộn tới đáy cũng thấy khựng.
2. **`if (!cursor) return`** — gỡ observer khi hết dữ liệu, nếu không nó bắn request vô tận vào cuối danh sách.
3. **Kiểm tra `pending`** — IntersectionObserver bắn nhiều lần khi cuộn nhanh, không chặn thì bạn gọi trùng.
4. **`observer.disconnect()` trong cleanup** — thiếu là rò rỉ bộ nhớ mỗi lần cursor đổi.

> ⚠️ **Server Action được client gửi đi tuần tự, từng cái một.** Đây là hành vi của React, không phải bug. Cần tải nhiều thứ song song thì gộp vào **một** action, hoặc dùng Route Handler.

### SEO: cuộn vô hạn giấu mất nội dung

Crawler không cuộn. Luôn để thêm một link phân trang thật:

```tsx
<noscript>
  <a href={`/posts?page=${page + 1}`}>Trang sau</a>
</noscript>
```

Hoặc tốt hơn: giữ URL phân trang thật (`/posts?page=2`) và dùng cuộn vô hạn như lớp nâng cao phía trên.

---

## 4. Danh sách khổng lồ: virtualization

10.000 dòng render ra 10.000 node DOM. Trình duyệt đứng hình.

Đo bằng React DevTools Profiler với bảng 10.000 dòng:

```
Render:  2840 ms
Commit:  1210 ms
DOM nodes: 60.043
Bộ nhớ: +180 MB
```

Giải pháp: chỉ render những dòng đang nhìn thấy.

```bash
npm i @tanstack/react-virtual
```

```tsx
// components/VirtualPostTable.tsx
'use client'

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Post } from '@/lib/types'

export default function VirtualPostTable({ posts }: { posts: Post[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,        // chiều cao ước lượng mỗi dòng (px)
    overscan: 8,                   // render thêm 8 dòng ngoài vùng nhìn
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto border">
      {/* div này giữ đúng tổng chiều cao để thanh cuộn chính xác */}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((row) => {
          const post = posts[row.index]
          return (
            <div
              key={post.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
              className="flex items-center gap-4 border-b px-3"
            >
              <span className="w-16 text-gray-400">#{post.id}</span>
              <span className="flex-1 truncate">{post.title}</span>
              <span className="w-24 text-right">{post.viewCount}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

Sau khi virtualize:

```
Render:   18 ms          ← từ 2840ms
Commit:    6 ms
DOM nodes: 142           ← từ 60.043
Bộ nhớ: +4 MB
```

Ba điểm dễ sai:

- **Container phải có chiều cao cố định** (`h-[600px]`) và `overflow-auto`. Để `height: auto` thì virtualizer không tính được vùng nhìn và render hết.
- **`estimateSize` sai nhiều** khiến thanh cuộn nhảy. Dòng cao thay đổi thì dùng `measureElement` của thư viện.
- **Không dùng `position: absolute` mà dùng padding** cũng được, nhưng absolute chính xác hơn với dòng cao đều.

### Khi nào cần virtualize

| Số dòng | Cách làm |
|---|---|
| < 200 | Render thẳng, đừng phức tạp hoá |
| 200 – 2.000 | Phân trang là đủ |
| > 2.000 trên một màn hình | Virtualize |
| > 50.000 | Virtualize **và** cursor pagination — đừng tải hết về client |

Điểm cuối quan trọng: virtualize giải quyết **render**, không giải quyết **truyền tải**. Gửi 500.000 bản ghi xuống trình duyệt vẫn là 200 MB JSON dù bạn chỉ vẽ 20 dòng.

---

## 5. Xuất file lớn: đừng gom vào RAM

Cách viết ở [bài 05 cơ bản](<../05-route-handler-va-proxy.md>) hỏng khi dữ liệu lớn:

```ts
// ❌ 500.000 bản ghi = tràn bộ nhớ
export async function GET() {
  const { data } = await (await fetch(`${API}/posts?limit=1000000`)).json()
  const csv = [header, ...data.items.map(toRow)].join('\n')
  return new Response(csv)
}
```

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

Dùng `ReadableStream` — gửi từng mẻ, không giữ gì trong RAM:

```ts
// app/api/posts/export/route.ts
import { requireRole } from '@/lib/auth'
import { getPostsCursor } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET() {
  await requireRole('admin')          // ⚠️ endpoint xuất dữ liệu LUÔN phải kiểm tra quyền

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('id,title,author,views,created_at\n'))

      let cursor: string | null = null
      let count = 0

      try {
        do {
          const page = await getPostsCursor(cursor ?? undefined, 500)

          const chunk = page.items
            .map((p) =>
              [
                p.id,
                `"${p.title.replace(/"/g, '""')}"`,   // escape dấu " trong CSV
                p.author.name,
                p.viewCount,
                p.createdAt,
              ].join(','),
            )
            .join('\n')

          controller.enqueue(encoder.encode(chunk + '\n'))

          cursor = page.nextCursor
          count += page.items.length
        } while (cursor)

        console.log(`[export] xong ${count} dòng`)
      } catch (e) {
        controller.error(e)
        return
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="posts-${Date.now()}.csv"`,
      'X-Accel-Buffering': 'no',        // bảo nginx đừng gom lại
    },
  })
}
```

Đo bằng `/usr/bin/time`:

```bash
$ /usr/bin/time -l curl -s localhost:3001/api/posts/export -o posts.csv
        8.42 real
   112459392  maximum resident set size      ← ~112 MB, ổn định

$ wc -l posts.csv
  500001 posts.csv
```

So với cách gom RAM: crash ở khoảng 180.000 dòng với heap mặc định của Node.

Ba chi tiết:

- **`export const dynamic = 'force-dynamic'`** — không có thì Next.js có thể thử prerender endpoint này lúc build.
- **`X-Accel-Buffering: no`** — nginx mặc định buffer, người dùng sẽ đợi hết 8 giây rồi mới thấy file bắt đầu tải.
- **Escape CSV** — tiêu đề bài viết chứa dấu phẩy hoặc ngoặc kép sẽ phá vỡ cấu trúc file. Đây là lỗi kinh điển.

### File thật sự lớn: đừng làm đồng bộ

Quá 30 giây thì reverse proxy hoặc nền tảng sẽ cắt kết nối. Chuyển sang mô hình job:

```
1. Người dùng bấm "Xuất"  →  Server Action tạo job, trả jobId ngay
2. NestJS + BullMQ xử lý ở nền, ghi file lên S3
3. Xong → gửi email hoặc cập nhật trạng thái
4. Người dùng tải từ link S3 có hạn
```

Phần queue nằm ở backend — xem [../../nestjs/nang-cao/05-queue-va-job-nen.md](../../nestjs/nang-cao/05-queue-va-job-nen.md).

---

## 6. Streaming dữ liệu lớn xuống giao diện

Bảng 50.000 dòng, người dùng muốn thấy dòng đầu ngay thay vì chờ đủ.

```tsx
// app/reports/page.tsx
import { Suspense } from 'react'

export default function ReportPage() {
  return (
    <div>
      <h1>Báo cáo</h1>

      {/* Tóm tắt về nhanh */}
      <Suspense fallback={<div className="h-20 animate-pulse bg-gray-100" />}>
        <Summary />
      </Suspense>

      {/* Bảng chi tiết về sau */}
      <Suspense fallback={<TableSkeleton rows={10} />}>
        <DetailTable />
      </Suspense>
    </div>
  )
}

async function Summary() {
  const stats = await apiFetch('/reports/summary')    // ~80ms
  return <StatCards stats={stats} />
}

async function DetailTable() {
  const rows = await apiFetch('/reports/detail?limit=5000')   // ~3.2s
  return <VirtualPostTable posts={rows} />
}
```

Người dùng thấy: `t=0.1s` tóm tắt hiện → `t=3.3s` bảng thay vào skeleton.

Không tách thì cả trang trắng 3.3 giây.

> Nhắc lại từ [bài 02](<./02-co-che-render.md#3-streaming-html-về-theo-từng-đợt>): component trong `<Suspense>` **phải tự `await`** dữ liệu của nó. `await` ở cha rồi truyền props xuống thì cha vẫn bị chặn, Suspense vô nghĩa.

---

## 7. Tránh N+1 ở tầng giao diện

Mẫu hỏng kinh điển:

```tsx
// ❌ 1 + 20 request
export default async function PostsPage() {
  const { items } = await getPosts()          // 1 request

  return (
    <ul>
      {items.map((post) => (
        <PostRow key={post.id} postId={post.id} />
      ))}
    </ul>
  )
}

async function PostRow({ postId }: { postId: number }) {
  const author = await getAuthor(postId)      // 20 request nữa!
  return <li>{author.name}</li>
}
```

Log NestJS:

```
GET /api/posts              12ms
GET /api/users/3            8ms
GET /api/users/7            9ms
... (18 dòng nữa)
Tổng: 21 request, 214ms
```

Ba cách sửa, theo thứ tự ưu tiên:

**1. Bảo backend trả kèm (tốt nhất).**

```ts
await apiFetch('/posts?include=author,category')
```
```
GET /api/posts?include=author,category    18ms
Tổng: 1 request
```

**2. Dedupe bằng `cache()` của React** — khi nhiều dòng dùng chung tác giả:

```ts
import { cache } from 'react'

export const getAuthor = cache(async (id: number) => {
  console.log('[api] lấy author', id)
  return apiFetch<User>(`/users/${id}`)
})
```

20 dòng của 3 tác giả → chỉ 3 request.

**3. Gom thành một truy vấn theo lô:**

```ts
const ids = [...new Set(items.map((p) => p.authorId))]
const authors = await apiFetch<User[]>(`/users?ids=${ids.join(',')}`)
const byId = new Map(authors.map((u) => [u.id, u]))
```

Cách phát hiện N+1: bật log ở NestJS rồi tải một trang. Số dòng log **tỉ lệ thuận với số dòng hiển thị** là bạn dính.

---

## 8. Checklist dữ liệu lớn

```
[ ] Danh sách dài dùng cursor pagination, không OFFSET sâu
[ ] Index khớp đúng thứ tự ORDER BY của cursor
[ ] Cursor có tie-breaker (thêm id)
[ ] Cuộn vô hạn: có rootMargin, có disconnect, có chặn gọi trùng
[ ] Cuộn vô hạn vẫn giữ URL phân trang thật cho SEO
[ ] Bảng > 2.000 dòng đã virtualize
[ ] Không gửi quá ~1 MB JSON xuống client mỗi trang
[ ] Xuất file dùng ReadableStream, không gom RAM
[ ] Endpoint xuất file có kiểm tra quyền
[ ] CSV đã escape dấu " và ,
[ ] X-Accel-Buffering: no cho response stream
[ ] Log backend không tăng theo số dòng hiển thị (không N+1)
```

Câu lệnh kiểm tra dung lượng payload:

```bash
$ curl -s 'localhost:3001/posts?_rsc=1' -H 'RSC: 1' | wc -c
   4192          ← dưới 1 MB là ổn
```

---

## Bài tập

1. Seed 100.000 bài viết vào Blog API. Chạy `EXPLAIN ANALYZE` với `OFFSET 0` và `OFFSET 99980`, chép lại 2 con số `Execution Time`.
2. Thêm endpoint `/posts/cursor` vào NestJS trả `{ items, nextCursor }` với cursor base64. Tạo index khớp `ORDER BY`.
3. Đo lại `EXPLAIN ANALYZE` cho truy vấn cursor ở "trang cuối". So với OFFSET.
4. Viết `InfinitePostList`. Cố tình bỏ `if (!cursor) return` và quan sát request bắn liên tục ở tab Network.
5. Render 10.000 dòng thẳng, đo bằng React DevTools Profiler. Virtualize rồi đo lại. Ghi cả 4 con số (render, commit, DOM nodes, bộ nhớ).
6. Viết endpoint xuất CSV bằng `ReadableStream`. Đo bộ nhớ bằng `/usr/bin/time -l`.
7. Cố tình xuất bằng cách gom RAM với 500.000 dòng để gặp `heap out of memory`.
8. Tạo bài viết có tiêu đề `Học "Next.js", nhanh` rồi xuất CSV — kiểm tra file mở trong Excel có đúng cột không.
9. Tạo tình huống N+1, chép lại log NestJS. Sửa bằng `cache()` và đếm lại số dòng log.

Tiếp theo 👉 [04-toi-uu-hieu-nang.md](<./04-toi-uu-hieu-nang.md>)
