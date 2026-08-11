# Bài 9 — Cheatsheet Next.js 16

## File convention

| File | Vai trò |
|---|---|
| `app/page.tsx` | Trang tại URL đó |
| `app/layout.tsx` | Khung bọc, **không** render lại khi chuyển trang con |
| `app/template.tsx` | Như layout nhưng tạo mới mỗi lần chuyển trang |
| `app/loading.tsx` | UI chờ (tự bọc `<Suspense>` quanh page) |
| `app/error.tsx` | UI lỗi — **bắt buộc `'use client'`** |
| `app/global-error.tsx` | Bắt lỗi của layout gốc — phải tự render `<html>`, `<body>` |
| `app/not-found.tsx` | UI 404 |
| `app/route.ts` | API endpoint |
| `app/default.tsx` | Fallback cho parallel route — **bắt buộc từ Next 16** |
| `src/proxy.ts` | Chặn request (trước gọi là `middleware.ts`) |
| `app/sitemap.ts` | Sinh `/sitemap.xml` |
| `app/robots.ts` | Sinh `/robots.txt` |
| `app/opengraph-image.tsx` | Sinh ảnh chia sẻ mạng xã hội |

## Cú pháp thư mục

| Cú pháp | Nghĩa | URL |
|---|---|---|
| `posts/` | Đoạn URL thường | `/posts` |
| `[slug]/` | Tham số động | `/posts/abc` |
| `[...slug]/` | Catch-all (**không** khớp path rỗng) | `/docs/a/b` |
| `[[...slug]]/` | Catch-all tuỳ chọn (khớp cả rỗng) | `/docs` và `/docs/a/b` |
| `(nhom)/` | Nhóm route — không vào URL | `(shop)/cart` → `/cart` |
| `_private/` | Bỏ qua hoàn toàn, không thành route | — |
| `@slot/` | Parallel route | — |
| `(.)folder/` | Intercepting route | — |

---

## Async Request APIs — Next 16 bắt buộc `await`

```tsx
const { slug } = await params
const { page } = await searchParams
const cookieStore = await cookies()
const h = await headers()
const { isEnabled } = await draftMode()
```

Truy cập đồng bộ đã bị **gỡ bỏ hoàn toàn**. Chuyển dự án cũ:

```bash
npx @next/codemod@canary next-async-request-api .
```

## Kiểu toàn cục (chạy `npx next typegen`)

```tsx
export default async function Page(props: PageProps<'/posts/[slug]'>) {}
export default function Layout(props: LayoutProps<'/dashboard'>) {}
export async function GET(req: Request, ctx: RouteContext<'/api/posts/[id]'>) {}
```

---

## Server vs Client

| | Server Component | Client Component |
|---|---|---|
| Khai báo | mặc định | `'use client'` dòng đầu file |
| `async`/`await` | ✅ | ❌ |
| `useState`, `useEffect` | ❌ | ✅ |
| `onClick`, `onChange` | ❌ | ✅ |
| `cookies()`, `headers()` | ✅ | ❌ |
| `window`, `localStorage` | ❌ | ✅ (trong `useEffect`) |
| Biến env không `NEXT_PUBLIC_` | ✅ | ❌ |
| Gửi JS xuống trình duyệt | ❌ | ✅ |

**Quy tắc:** mặc định Server. `'use client'` lan theo **import**, không lan theo **children** → truyền Server Component qua `children` để giữ nó ở server.

```tsx
// ✅ Comments vẫn là Server Component
<ClientCollapsible>
  <Comments />
</ClientCollapsible>
```

Props qua ranh giới phải serialize được. Hàm thường → lỗi; hàm `'use server'` → được.

---

## Lấy dữ liệu

```tsx
// Không cache (MẶC ĐỊNH từ Next 15)
await fetch(url)

// Cache vĩnh viễn
await fetch(url, { cache: 'force-cache' })

// Cache 60 giây + gắn tag
await fetch(url, { next: { revalidate: 60, tags: ['posts'] } })

// Song song
const [a, b] = await Promise.all([getA(), getB()])

// Dedupe hàm không phải fetch
import { cache } from 'react'
export const getUser = cache(async (id: number) => db.user.find(id))

// Cache hàm không phải fetch
import { unstable_cache } from 'next/cache'
export const getTop = unstable_cache(fn, ['top-posts'], { tags: ['posts'], revalidate: 600 })
```

## Xoá cache

```ts
import { revalidatePath, revalidateTag, updateTag, refresh } from 'next/cache'

revalidatePath('/posts')          // theo đường dẫn
revalidateTag('posts', 'max')     // ⚠️ Next 16: BẮT BUỘC 2 tham số
updateTag('posts')                // xoá + làm mới ngay (chỉ trong Server Action)
refresh()                         // làm mới router client, KHÔNG động tới tag
```

| Dùng cái nào | Khi nào |
|---|---|
| `updateTag` | Người dùng vừa tự tay sửa → phải thấy ngay |
| `revalidateTag` | Dữ liệu chung, chậm vài giây cũng được |
| `revalidatePath` | Biết chính xác đường dẫn cần làm mới |
| `refresh` | Chỉ cần vẽ lại UI, dữ liệu không đổi |

## Route Segment Config

```tsx
export const revalidate = 3600           // ISR (phải là hằng số, không phải 60*60)
export const dynamic = 'force-dynamic'   // luôn render mới
export const dynamic = 'force-static'    // ép tĩnh
export const dynamicParams = false       // slug ngoài generateStaticParams → 404
export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}
```

---

## Server Actions

```ts
// src/app/actions.ts
'use server'

export async function createPost(prevState: State, formData: FormData): Promise<State> {
  // ① auth  ② quyền sở hữu  ③ validate  ④ gọi API → revalidate → redirect
}
```

```tsx
'use client'
import { useActionState } from 'react'

const [state, formAction, pending] = useActionState(createPost, {})
<form action={formAction}>
```

```tsx
'use client'
import { useFormStatus } from 'react-dom'    // ⚠️ 'react-dom', không phải 'react'

const { pending } = useFormStatus()          // chỉ đọc được <form> CHA
```

```tsx
// Gắn tham số
const del = deletePost.bind(null, post.id)
<form action={del}><button>Xoá</button></form>

// Gọi ngoài form
const [pending, startTransition] = useTransition()
startTransition(() => deletePost(id))
```

**Thứ tự tham số bắt buộc:** `(prevState, formData)`. Ngược lại → `formData.get is not a function`.

## Đọc FormData

```ts
formData.get('title')                    // string | File | null
formData.getAll('tags')                  // string[]
formData.get('done') === 'on'            // checkbox (không tick → null)
Number(formData.get('price'))            // phải tự ép kiểu
```

---

## Điều hướng

```tsx
import Link from 'next/link'
<Link href="/posts" prefetch={false}>Bài viết</Link>

'use client'
import { useRouter, usePathname, useSearchParams, useParams } from 'next/navigation'
//                                                   ⚠️ 'next/navigation', KHÔNG phải 'next/router'

router.push('/posts')      // thêm vào lịch sử
router.replace('/posts')   // thay thế
router.back()
router.refresh()           // lấy lại dữ liệu server

// Server Component
import { redirect, notFound, permanentRedirect } from 'next/navigation'
redirect('/login')         // 307 — throw, code sau KHÔNG chạy
notFound()                 // 404 — throw
```

⚠️ Đừng bọc `redirect()` / `notFound()` trong `try/catch`.

---

## Route Handler

```ts
// app/api/posts/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  const token = request.cookies.get('accessToken')?.value
  return Response.json({ q }, { status: 200 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const form = await request.formData()
  return Response.json(body, { status: 201 })
}

// Route động
export async function GET(req: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params
}
```

## Proxy (`src/proxy.ts`)

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  request.nextUrl.pathname
  request.cookies.get('accessToken')?.value

  NextResponse.next()                                       // đi tiếp
  NextResponse.redirect(new URL('/login', request.url))     // 307, URL đổi
  NextResponse.rewrite(new URL('/posts', request.url))      // 200, URL giữ nguyên
  Response.json({ error: 'x' }, { status: 401 })            // trả thẳng

  // Truyền dữ liệu lên route
  const h = new Headers(request.headers)
  h.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({ request: { headers: h } })
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

- Tên hàm phải là `proxy` hoặc `export default`.
- `matcher` phải là hằng số viết thẳng.
- Không có `matcher` → chạy cho **mọi** request kể cả CSS/ảnh.
- Runtime luôn là Node.js, không đặt `runtime` được.
- **Không phải lớp bảo mật** — vẫn phải kiểm tra trong page và action.

---

## Cookies

```ts
import { cookies } from 'next/headers'

const cookieStore = await cookies()
cookieStore.get('accessToken')?.value
cookieStore.has('accessToken')
cookieStore.set('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 15,
})
cookieStore.delete('accessToken')
```

⚠️ `set` / `delete` **chỉ gọi được trong Server Action hoặc Route Handler**, không gọi khi đang render.

---

## Metadata

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://blog.vanson.dev'),
  title: { default: 'Blog', template: '%s | Blog' },
  description: '...',
  openGraph: { type: 'article', images: [{ url: '/og.jpg', width: 1200, height: 630 }] },
  robots: { index: true, follow: true },
  alternates: { canonical: '/posts' },
}

export async function generateMetadata(props: PageProps<'/posts/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params
  const post = await getPost(slug)          // dedupe với page: chỉ 1 request
  return { title: post.title }
}
```

## Image & Font

```tsx
import Image from 'next/image'

<Image src="/a.jpg" alt="" width={800} height={400} priority />
<div className="relative h-64">
  <Image src={url} alt="" fill className="object-cover" />
</div>
```

```ts
// next.config.ts
images: {
  remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  qualities: [50, 75, 90],      // Next 16 mặc định CHỈ [75]
  minimumCacheTTL: 14400,       // Next 16 mặc định 4 giờ (trước 60s)
}
```

```tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap' })
<html className={inter.className}>
```

---

## Biến môi trường

```bash
API_URL=...                 # chỉ server đọc được
NEXT_PUBLIC_SITE_NAME=...   # mọi nơi — CÓ trong bundle trình duyệt
```

`NEXT_PUBLIC_*` bị nướng cứng lúc build, đổi biến sau khi deploy không ăn. Cần đọc lúc chạy:

```tsx
import { connection } from 'next/server'
await connection()
const cfg = process.env.RUNTIME_CONFIG
```

Kiểm tra rò rỉ secret:

```bash
npm run build && grep -r "SECRET" .next/static/     # phải rỗng
```

---

## CLI

```bash
npm run dev              # Turbopack mặc định từ Next 16
npm run build            # Turbopack mặc định
npm start
npx next typegen         # sinh PageProps / LayoutProps / RouteContext
npx next info            # thông tin môi trường để báo bug
npx eslint .             # ⚠️ `next lint` ĐÃ BỊ GỠ ở Next 16
npx tsc --noEmit

# Codemod
npx @next/codemod@canary upgrade latest
npx @next/codemod@canary next-async-request-api .
npx @next/codemod@canary middleware-to-proxy .
npx @next/codemod@canary next-lint-to-eslint-cli .
```

## Đọc bảng build

```
○  (Static)   HTML dựng sẵn lúc build
●  (SSG)      dựng sẵn theo generateStaticParams
ƒ  (Dynamic)  render mỗi request
```

Trang lẽ ra tĩnh mà thành `ƒ` → có ai đó đọc `cookies()`, `headers()`, `searchParams`, hoặc `fetch` không cache.

---

## Thay đổi lớn của Next.js 16

| Thứ | Next 15 | Next 16 |
|---|---|---|
| `params`, `cookies()` | Đồng bộ được (deprecated) | **Bắt buộc `await`** |
| Bundler | Webpack (Turbopack cần cờ) | **Turbopack mặc định** |
| `middleware.ts` | Tên chính thức | **Đổi thành `proxy.ts`** |
| `revalidateTag(tag)` | 1 tham số | **Bắt buộc 2 tham số** |
| `next lint` | Có | **Đã gỡ** — dùng ESLint/Biome |
| Parallel route `default.js` | Tuỳ chọn | **Bắt buộc** |
| `images.qualities` | Mọi giá trị | **Chỉ `[75]`** |
| `images.minimumCacheTTL` | 60s | **4 giờ** |
| `images.domains` | Dùng được | **Deprecated** → `remotePatterns` |
| `serverRuntimeConfig` | Có | **Đã gỡ** |
| PPR | `experimental.ppr` | `cacheComponents: true` |
| `unstable_cacheLife/Tag` | Có tiền tố | **`cacheLife`, `cacheTag`** |
| Node.js | 18.17+ | **20.9+** |
| Build output | Có `Size`, `First Load JS` | **Đã bỏ** |
| AMP | Có | **Đã gỡ** |

---

## Nhầm lẫn hay gặp

| Sai | Đúng |
|---|---|
| `import { useRouter } from 'next/router'` | `from 'next/navigation'` |
| `import { useFormStatus } from 'react'` | `from 'react-dom'` |
| `params.slug` | `const { slug } = await params` |
| `revalidateTag('posts')` | `revalidateTag('posts', 'max')` |
| `middleware.ts` + `export function middleware` | `proxy.ts` + `export function proxy` |
| `'use client'` ở `app/layout.tsx` | Đẩy xuống component cần tương tác |
| `localStorage` giữ JWT | Cookie `httpOnly` |
| `fetch('/api/posts')` từ Server Component | `await fetch` thẳng vào backend |
| `revalidate` cho request có `Authorization` | `cache: 'no-store'` |
| `export const revalidate = 60 * 60` | `export const revalidate = 3600` |
| `try { redirect('/x') } catch {}` | `redirect()` ngoài `try` |

Gặp lỗi cụ thể 👉 [10-loi-thuong-gap.md](./10-loi-thuong-gap.md)
