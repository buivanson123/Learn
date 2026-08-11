# Bài 1 — App Router: routing bằng thư mục

Đây là file nền tảng. Mọi thứ trong Next.js đều xoay quanh việc **đặt đúng tên file vào đúng thư mục**.

## 1. Quy tắc gốc: thư mục = URL, file = vai trò

```
src/app/
├── page.tsx                    →  /
├── about/
│   └── page.tsx                →  /about
├── posts/
│   ├── page.tsx                →  /posts
│   └── [slug]/
│       └── page.tsx            →  /posts/bat-ky-chuoi-nao
└── dashboard/
    ├── page.tsx                →  /dashboard
    └── settings/
        └── page.tsx            →  /dashboard/settings
```

**Thư mục tạo ra đoạn URL. Nhưng chỉ có `page.tsx` mới biến nó thành trang truy cập được.**

Chứng minh: tạo `app/admin/` chỉ chứa `helper.ts`, không có `page.tsx`. Vào `http://localhost:3001/admin`:

```
404 | This page could not be found.
```

Đây là điểm khác biệt quan trọng — bạn để file phụ trợ trong `app/` thoải mái, chúng không tự thành route.

---

## 2. Bảng tên file đặc biệt

Trong mỗi thư mục route, các tên sau có ý nghĩa riêng:

| File | Vai trò | Chạy khi nào |
|---|---|---|
| `page.tsx` | Nội dung trang | Khi URL khớp đúng thư mục |
| `layout.tsx` | Khung bọc, **giữ nguyên khi chuyển trang con** | Luôn, bọc quanh page |
| `loading.tsx` | UI chờ | Trong lúc page đang tải dữ liệu |
| `error.tsx` | UI lỗi | Khi page hoặc con của nó throw |
| `not-found.tsx` | UI 404 | Khi gọi `notFound()` hoặc URL không khớp |
| `template.tsx` | Như layout nhưng **tạo mới mỗi lần chuyển trang** | Hiếm dùng |
| `route.ts` | API endpoint (không phải UI) | Bài [05](./05-route-handler-va-proxy.md) |
| `default.tsx` | Fallback cho parallel route | Bài này, mục 9 |

> ⚠️ Trong một thư mục **không thể có cả `page.tsx` và `route.ts`**. Chúng cùng tranh nhau một URL. Lỗi lúc build:
> ```
> Error: Conflicting route and page at /api/posts:
> route file "app/api/posts/route.ts" - page file "app/api/posts/page.tsx"
> ```

---

## 3. `layout.tsx` — khung bọc không bị render lại

Layout gốc `app/layout.tsx` là **bắt buộc** và phải chứa thẻ `<html>` và `<body>`:

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Blog của Vanson',
  description: 'Học Next.js qua dự án thật',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>
        <header className="border-b p-4">
          <a href="/" className="font-bold">Blog</a>
        </header>
        <main className="p-4">{children}</main>
        <footer className="border-t p-4 text-sm">© 2026 Vanson</footer>
      </body>
    </html>
  )
}
```

Xoá thẻ `<html>` đi, Next.js báo:

```
Error: The default export of the root layout must contain <html> and <body> tags.
```

### Layout lồng nhau

Layout con **bọc bên trong** layout cha, không thay thế:

```
app/
├── layout.tsx                  ← A: header + footer chung
└── dashboard/
    ├── layout.tsx              ← B: sidebar
    └── settings/
        └── page.tsx            ← C
```

Vào `/dashboard/settings`, cây render là: `A( B( C ) )`.

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-6">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-2">
          <a href="/dashboard">Tổng quan</a>
          <a href="/dashboard/settings">Cài đặt</a>
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  )
}
```

### Điểm quan trọng nhất về layout

**Layout không bị render lại khi bạn chuyển giữa các trang con của nó.**

Kiểm chứng bằng thực nghiệm — thêm vào `app/dashboard/layout.tsx`:

```tsx
export default function DashboardLayout({ children }) {
  console.log('[layout] render lúc', new Date().toISOString())
  return <div className="flex gap-6">{/* ... */}</div>
}
```

Rồi bấm qua lại giữa `/dashboard` và `/dashboard/settings` bằng `<Link>`. Terminal:

```
[layout] render lúc 2026-08-11T09:14:22.100Z     ← lần vào đầu tiên
                                                  ← bấm sang /dashboard/settings: KHÔNG in gì
                                                  ← bấm về /dashboard: KHÔNG in gì
```

Vì vậy state trong layout (sidebar đang mở/đóng, ô tìm kiếm đang gõ dở) **được giữ nguyên** khi chuyển trang. Đây là lý do bạn đặt navigation vào layout chứ không phải page.

---

## 4. Route động `[slug]`

```
app/posts/[slug]/page.tsx    →  /posts/hoc-nextjs, /posts/bat-ky-gi
```

```tsx
// app/posts/[slug]/page.tsx
export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params      // ← BẮT BUỘC await từ Next.js 16
  return <h1>Bài viết: {slug}</h1>
}
```

Vào `/posts/hoc-nextjs` → hiện `Bài viết: hoc-nextjs`.

### ⚠️ Lỗi kinh điển số 1: quên `await params`

```tsx
export default async function PostPage({ params }: PageProps<'/posts/[slug]'>) {
  return <h1>{params.slug}</h1>       // ❌
}
```

Trình duyệt và terminal cùng báo:

```
Error: Route "/posts/[slug]" used `params.slug`. `params` should be awaited
before using its properties.
    at PostPage (src/app/posts/[slug]/page.tsx:2:22)
```

Ở Next.js 14 code này chạy được. Từ **Next.js 16 thì không** — truy cập đồng bộ đã bị gỡ bỏ hoàn toàn. Đây là lý do 90% code copy từ blog cũ bị hỏng.

Sửa: thêm `await`.

```tsx
const { slug } = await props.params
```

Đang có dự án cũ cần chuyển hàng loạt thì dùng codemod:

```bash
$ npx @next/codemod@canary next-async-request-api .
✔ Transformed 23 files
```

### Các dạng route động

| Cú pháp | Khớp | `params` nhận được |
|---|---|---|
| `[slug]` | `/posts/abc` | `{ slug: 'abc' }` |
| `[...slug]` | `/docs/a/b/c` | `{ slug: ['a','b','c'] }` |
| `[[...slug]]` | `/docs` **và** `/docs/a/b` | `{}` hoặc `{ slug: ['a','b'] }` |

`[...slug]` (catch-all) **không** khớp `/docs` — chỉ `[[...slug]]` (optional catch-all) mới khớp cả trường hợp rỗng. Đây là khác biệt hay bị nhầm.

---

## 5. `searchParams` — query string

```tsx
// app/posts/page.tsx  ứng với /posts?page=2&search=nestjs
export default async function PostsPage(props: PageProps<'/posts'>) {
  const { page = '1', search = '' } = await props.searchParams

  return (
    <div>
      <p>Trang {page}, tìm: {search}</p>
    </div>
  )
}
```

Ba điều cần nhớ:

1. **Chỉ `page.tsx` có `searchParams`.** Layout thì không — vì layout không render lại khi query đổi, nên Next.js không đưa cho nó dữ liệu có thể lỗi thời. Cần query trong layout thì dùng `useSearchParams()` trong Client Component.
2. **Giá trị luôn là `string` hoặc `string[]`**, không bao giờ là number:
   ```tsx
   const { page } = await props.searchParams
   const pageNum = Number(page ?? 1)         // phải tự ép kiểu
   ```
   Với `?tag=a&tag=b` thì `tag` là `['a','b']`.
3. **Đọc `searchParams` khiến trang thành dynamic** — không prerender được lúc build. Xem bài [03](./03-lay-du-lieu-va-cache.md).

---

## 6. Điều hướng: `<Link>` chứ không phải `<a>`

```tsx
import Link from 'next/link'

<Link href="/posts">Danh sách bài</Link>
<Link href={`/posts/${post.slug}`}>{post.title}</Link>
<Link href="/posts?page=2">Trang 2</Link>
```

Khác biệt thật sự, quan sát ở tab Network của trình duyệt:

| | `<a href="/posts">` | `<Link href="/posts">` |
|---|---|---|
| Tải lại toàn trang | Có — màn hình trắng một nhịp | Không |
| Request | HTML đầy đủ, tải lại CSS/JS | chỉ RSC payload (~2 KB) |
| State trong layout | **Mất sạch** | Giữ nguyên |
| Prefetch khi hover | Không | Có |

Prefetch quan sát được: hover chuột lên một `<Link>`, tab Network xuất hiện request `?_rsc=1a2b3` ngay cả khi bạn chưa bấm. Lúc bấm thật, trang hiện tức thì vì dữ liệu đã tải sẵn.

> Dùng `<a>` chỉ khi trỏ ra ngoài site (`https://nestjs.com`) hoặc file trong `public/` (`/cv.pdf`).

### Điều hướng bằng code

```tsx
'use client'
import { useRouter } from 'next/navigation'    // ← 'next/navigation', KHÔNG phải 'next/router'

export default function SearchBox() {
  const router = useRouter()

  return (
    <button onClick={() => router.push('/posts?page=2')}>Trang 2</button>
  )
}
```

Import nhầm `next/router` (của Pages Router) sẽ gặp:

```
Error: NextRouter was not mounted.
https://nextjs.org/docs/messages/next-router-not-mounted
```

Các method hay dùng: `router.push(url)`, `router.replace(url)` (không thêm vào lịch sử), `router.back()`, `router.refresh()` (lấy lại dữ liệu server cho trang hiện tại).

### Đánh dấu link đang active

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link href={href} className={isActive ? 'font-bold underline' : ''}>
      {children}
    </Link>
  )
}
```

---

## 7. `loading.tsx` — UI chờ tự động

Tạo file này, Next.js tự bọc `page.tsx` cùng cấp trong `<Suspense>`:

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  )
}
```

Muốn thấy nó hoạt động, thêm độ trễ giả vào page:

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  await new Promise((r) => setTimeout(r, 2000))    // giả lập API chậm
  const res = await fetch('http://localhost:3000/api/posts', { cache: 'no-store' })
  const { data } = await res.json()
  return <PostList posts={data.items} />
}
```

Bấm vào `/posts`: skeleton xám hiện **ngay lập tức**, 2 giây sau nội dung thật thay vào. Header và footer trong layout không hề nhấp nháy — chúng không nằm trong vùng loading.

Điểm quan trọng: `loading.tsx` chỉ bọc **page cùng cấp và các route con**, không bọc layout cùng cấp. Nên header vẫn hiện trong lúc chờ.

---

## 8. `error.tsx` — bắt lỗi runtime

**Bắt buộc phải là Client Component** vì nó cần `onClick` cho nút thử lại:

```tsx
// app/posts/error.tsx
'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[posts] lỗi:', error)
  }, [error])

  return (
    <div className="rounded border border-red-300 bg-red-50 p-4">
      <h2 className="font-bold">Không tải được danh sách bài viết</h2>
      <p className="text-sm text-gray-600">Mã lỗi: {error.digest}</p>
      <button onClick={reset} className="mt-2 rounded bg-red-600 px-3 py-1 text-white">
        Thử lại
      </button>
    </div>
  )
}
```

Thử: tắt Blog API rồi vào `/posts`. Terminal Next.js in lỗi gốc:

```
 ⨯ TypeError: fetch failed
    at async PostsPage (src/app/posts/page.tsx:3:15)
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:3000
```

Trình duyệt hiện khung đỏ của bạn. Bật lại API rồi bấm "Thử lại" → nội dung hiện ra, không cần F5.

Hai điều dễ vấp:

- **Trong production, `error.message` bị giấu.** Bạn chỉ nhận được `error.digest` (một mã hash) và thông báo chung `An error occurred in the Server Components render`. Cố ý như vậy để không lộ chi tiết hệ thống ra ngoài. Muốn tra chi tiết thì tìm `digest` đó trong log server.
- **`error.tsx` không bắt được lỗi của `layout.tsx` cùng cấp** — vì nó nằm *bên trong* layout đó. Muốn bắt lỗi layout gốc, cần `app/global-error.tsx` (file này phải tự render cả `<html>` và `<body>`).

---

## 9. Nhóm route và các cú pháp thư mục đặc biệt

### `(nhom)` — gom nhóm mà không tạo URL

Thư mục đặt trong ngoặc tròn **không xuất hiện trong URL**:

```
app/
├── (marketing)/
│   ├── layout.tsx          ← layout riêng: header lớn, không sidebar
│   ├── page.tsx            →  /              (KHÔNG phải /marketing)
│   └── about/page.tsx      →  /about
└── (app)/
    ├── layout.tsx          ← layout riêng: có sidebar
    └── dashboard/page.tsx  →  /dashboard
```

Dùng khi bạn cần **hai layout khác hẳn nhau** cho hai mảng của site — trang public và trang sau đăng nhập chẳng hạn.

> ⚠️ Hai nhóm không được cùng sinh ra một URL. `(marketing)/page.tsx` và `(app)/page.tsx` cùng trỏ `/`, build sẽ fail:
> ```
> Error: You cannot have two parallel pages that resolve to the same path.
> Please check /(marketing)/page and /(app)/page.
> ```

### `_thumuc` — thư mục private

Tiền tố gạch dưới khiến Next.js **bỏ qua hoàn toàn** khi tìm route:

```
app/
├── _components/PostCard.tsx    ← không bao giờ thành route
└── posts/page.tsx
```

Hữu ích khi bạn muốn để component ngay cạnh route dùng nó.

### `@slot` — parallel route

Render nhiều "khe" song song trong cùng một layout:

```
app/dashboard/
├── layout.tsx
├── page.tsx
├── @stats/page.tsx
├── @stats/default.tsx      ← BẮT BUỘC từ Next.js 16
└── @feed/page.tsx
└── @feed/default.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function Layout({
  children,
  stats,
  feed,
}: {
  children: React.ReactNode
  stats: React.ReactNode
  feed: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">{children}</div>
      {stats}
      {feed}
    </div>
  )
}
```

> ⚠️ **Next.js 16 bắt buộc mọi slot phải có `default.tsx`.** Thiếu là build fail:
> ```
> Error: No default component was found for a parallel route rendered on this page.
> Missing slots: @stats
> ```
> File tối thiểu:
> ```tsx
> // app/dashboard/@stats/default.tsx
> export default function Default() {
>   return null
> }
> ```

Parallel route là tính năng nâng cao — bạn có thể bỏ qua ở lần học đầu.

---

## 10. `notFound()` và `redirect()`

```tsx
import { notFound, redirect } from 'next/navigation'

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params

  const res = await fetch(`http://localhost:3000/api/posts/slug/${slug}`)

  if (res.status === 404) {
    notFound()                      // render not-found.tsx gần nhất, trả HTTP 404
  }

  const { data: post } = await res.json()

  if (post.status === 'draft') {
    redirect('/posts')              // trả HTTP 307, dừng render
  }

  return <article><h1>{post.title}</h1></article>
}
```

Cả hai hàm này hoạt động bằng cách **throw** một exception đặc biệt. Hệ quả:

```tsx
notFound()
console.log('dòng này KHÔNG bao giờ chạy')
```

Và đừng bọc chúng trong `try/catch` — bạn sẽ nuốt mất tín hiệu điều hướng:

```tsx
// ❌ SAI
try {
  const post = await getPost(slug)
  if (!post) notFound()
} catch (e) {
  return <p>Có lỗi</p>          // notFound() bị bắt ở đây, trang không bao giờ ra 404
}
```

Trang 404 tuỳ chỉnh:

```tsx
// app/posts/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div>
      <h2>Không tìm thấy bài viết</h2>
      <Link href="/posts">Về danh sách</Link>
    </div>
  )
}
```

---

## 11. Ghép lại: trang danh sách bài viết thật

```tsx
// src/lib/api.ts
import type { ApiResponse, Paginated, Post } from './types'

const API = process.env.API_URL ?? 'http://localhost:3000/api'

export async function getPosts(page = 1, limit = 10) {
  const res = await fetch(`${API}/posts?page=${page}&limit=${limit}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API trả ${res.status}`)
  const json: ApiResponse<Paginated<Post>> = await res.json()
  return json.data
}
```

```tsx
// src/app/posts/page.tsx
import Link from 'next/link'
import { getPosts } from '@/lib/api'

export default async function PostsPage(props: PageProps<'/posts'>) {
  const { page } = await props.searchParams
  const pageNum = Number(page ?? 1)
  const { items, total, limit } = await getPosts(pageNum)
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Bài viết ({total})</h1>

      <ul className="space-y-3">
        {items.map((post) => (
          <li key={post.id} className="rounded border p-3">
            <Link href={`/posts/${post.slug}`} className="font-medium hover:underline">
              {post.title}
            </Link>
            <p className="text-sm text-gray-500">
              {post.author.name} · {post.viewCount} lượt xem
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2">
        {pageNum > 1 && <Link href={`/posts?page=${pageNum - 1}`}>← Trước</Link>}
        <span>Trang {pageNum}/{totalPages}</span>
        {pageNum < totalPages && <Link href={`/posts?page=${pageNum + 1}`}>Sau →</Link>}
      </div>
    </div>
  )
}
```

Chạy với Blog API đang bật:

```
$ curl -s "localhost:3000/api/posts?page=1&limit=10" | jq '.data.total'
27
```

Trình duyệt tại `/posts` hiện `Bài viết (27)` và 10 dòng đầu.

---

## Bài tập

1. Dựng cây route: `/`, `/posts`, `/posts/[slug]`, `/about`, `/dashboard`, `/dashboard/settings`.
2. Cho `/dashboard` một layout riêng có sidebar. Thêm `console.log` vào layout đó rồi bấm qua lại giữa 2 trang con — xác nhận layout **không** in lại.
3. Viết `NavLink` gạch chân link đang active bằng `usePathname()`.
4. Thêm `loading.tsx` cho `/posts` và chèn `await new Promise(r => setTimeout(r, 2000))` để nhìn thấy skeleton.
5. Thêm `error.tsx` cho `/posts`. Tắt Blog API, chép lại nguyên văn lỗi trong terminal, rồi bật lại và bấm "Thử lại".
6. Cố tình viết `params.slug` không có `await`, chép lại thông báo lỗi.
7. Tạo `/docs/[[...slug]]` in ra mảng `slug`. Thử `/docs`, `/docs/a`, `/docs/a/b/c` và ghi lại `params` mỗi trường hợp.

Tiếp theo 👉 [02-server-client-component.md](./02-server-client-component.md)
