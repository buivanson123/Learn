# Bài 5 — Route Handler & Proxy

## 1. `route.ts` — viết API endpoint

Next.js không chỉ render giao diện, nó dựng được API luôn. Đặt file tên `route.ts` trong `app/`:

```ts
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', time: new Date().toISOString() })
}
```

```bash
$ curl -s localhost:3001/api/health | jq
{
  "status": "ok",
  "time": "2026-08-11T09:42:17.882Z"
}
```

Mỗi HTTP method là một hàm export:

```ts
export async function GET(request: Request) {}
export async function POST(request: Request) {}
export async function PATCH(request: Request) {}
export async function DELETE(request: Request) {}
```

Gọi method chưa khai báo, Next.js tự trả 405:

```bash
$ curl -i -X DELETE localhost:3001/api/health
HTTP/1.1 405 Method Not Allowed
Allow: GET
```

> ⚠️ Trong một thư mục **không được có cả `page.tsx` và `route.ts`** — chúng tranh nhau cùng một URL:
> ```
> Error: Conflicting route and page at /api/posts
> ```

---

## 2. Đọc request

```ts
// src/app/api/search/route.ts
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? ''
  const page = Number(request.nextUrl.searchParams.get('page') ?? 1)
  const auth = request.headers.get('authorization')
  const token = request.cookies.get('accessToken')?.value

  return Response.json({ q, page, hasAuth: Boolean(auth), hasToken: Boolean(token) })
}
```

```bash
$ curl -s "localhost:3001/api/search?q=nextjs&page=2" \
    -H "Authorization: Bearer abc" | jq
{
  "q": "nextjs",
  "page": 2,
  "hasAuth": true,
  "hasToken": false
}
```

`NextRequest` là `Request` chuẩn cộng thêm `nextUrl` và `cookies` — tiện hơn nên dùng luôn.

Đọc body JSON:

```ts
export async function POST(request: NextRequest) {
  const body = await request.json()
  return Response.json({ received: body }, { status: 201 })
}
```

```bash
$ curl -s -X POST localhost:3001/api/search \
    -H "Content-Type: application/json" \
    -d '{"title":"Học Next.js"}' | jq
{ "received": { "title": "Học Next.js" } }
```

Body không phải JSON hợp lệ thì `request.json()` throw:

```
SyntaxError: Unexpected end of JSON input
    at POST (src/app/api/search/route.ts:2:31)
```

Nên bọc lại:

```ts
let body: unknown
try {
  body = await request.json()
} catch {
  return Response.json({ error: 'Body phải là JSON hợp lệ' }, { status: 400 })
}
```

Đọc form data (khi client gửi `multipart/form-data`):

```ts
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('avatar') as File
  const buffer = Buffer.from(await file.arrayBuffer())

  return Response.json({ name: file.name, size: buffer.length })
}
```

---

## 3. Route động và `params`

```ts
// src/app/api/posts/[id]/route.ts
export async function GET(request: Request, ctx: RouteContext<'/api/posts/[id]'>) {
  const { id } = await ctx.params        // ← await, giống page

  const res = await fetch(`${process.env.API_URL}/posts/${id}`)
  if (!res.ok) {
    return Response.json({ error: 'Không tìm thấy bài viết' }, { status: 404 })
  }

  const { data } = await res.json()
  return Response.json(data)
}
```

`RouteContext` là kiểu toàn cục do `next typegen` sinh ra, không cần import.

---

## 4. Trả response

```ts
// JSON + status
return Response.json({ error: 'Không có quyền' }, { status: 403 })

// Kèm header
return Response.json(data, {
  status: 200,
  headers: { 'Cache-Control': 'public, max-age=3600' },
})

// Text thuần
return new Response('OK', { headers: { 'Content-Type': 'text/plain' } })

// Chuyển hướng
import { redirect } from 'next/navigation'
redirect('/login')

// Không có nội dung
return new Response(null, { status: 204 })
```

Xuất CSV — một ứng dụng thực tế hay dùng:

```ts
// src/app/api/posts/export/route.ts
export async function GET() {
  const res = await fetch(`${process.env.API_URL}/posts?limit=1000`)
  const { data } = await res.json()

  const csv = [
    'id,title,author,views',
    ...data.items.map((p) => `${p.id},"${p.title}",${p.author.name},${p.viewCount}`),
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="posts.csv"',
    },
  })
}
```

```bash
$ curl -s localhost:3001/api/posts/export | head -3
id,title,author,views
1,"Học NestJS trong 7 ngày",Vanson,142
2,"Docker cho người mới",Vanson,89
```

Mở link đó trong trình duyệt sẽ tải file về nhờ header `Content-Disposition`.

---

## 5. Khi nào cần Route Handler

Bạn **đã có** Blog API NestJS rồi, vậy sao còn viết API ở Next.js? Chỉ 4 trường hợp:

| Cần | Vì sao không dùng cách khác |
|---|---|
| Nhận webhook từ bên ngoài (Stripe, GitHub) | Bên thứ ba cần một URL cố định để POST vào |
| Giấu API key khi client phải gọi trực tiếp | Client Component không đọc được biến server |
| Đổi định dạng dữ liệu (CSV, PDF, ảnh OG) | Server Action không trả được file |
| Client Component cần polling / gọi lặp | Server Action gọi tuần tự từng cái một |

**Không cần** Route Handler khi:

- Lấy dữ liệu để render → dùng Server Component, `await fetch` thẳng.
- Xử lý form, mutation → dùng Server Action.

Đây là lỗi phổ biến của người quen kiến trúc cũ: viết `app/api/posts/route.ts` rồi từ trang gọi `fetch('/api/posts')`. Thành ra request đi vòng: trình duyệt → Next.js → Next.js → NestJS. Cứ `await fetch` thẳng vào NestJS trong Server Component.

### Ví dụ đúng: proxy giấu API key

```ts
// src/app/api/upload/route.ts
export async function POST(request: NextRequest) {
  const formData = await request.formData()

  const res = await fetch('https://api.cloudinary.com/v1_1/demo/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDINARY_SECRET}` },  // secret ở server
    body: formData,
  })

  return Response.json(await res.json())
}
```

Client Component gọi `/api/upload`, key không bao giờ rời server.

---

## 6. `proxy.ts` — chặn request trước khi vào route

> ⚠️ **Next.js 16 đổi tên `middleware` thành `proxy`.** File `middleware.ts` vẫn chạy nhưng đã deprecated. Mọi bài viết trước 10/2025 đều gọi nó là middleware.

Tạo `src/proxy.ts` — **ngang hàng với `app/`**, không phải bên trong:

```
src/
├── app/
└── proxy.ts     ← đúng chỗ
```

```ts
// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  console.log('[proxy]', request.method, request.nextUrl.pathname)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

Vào `/posts`, terminal in:

```
[proxy] GET /posts
 GET /posts 200 in 94ms
```

Tên hàm phải là `proxy` (hoặc `export default`). Đặt tên `middleware` trong file `proxy.ts` sẽ không được gọi và bạn ngồi debug rất lâu mà không hiểu sao.

Chuyển dự án cũ sang:

```bash
$ npx @next/codemod@canary middleware-to-proxy .
✔ Renamed middleware.ts → proxy.ts
✔ Renamed function middleware → proxy
```

### `matcher` — chọn đường dẫn nào chạy qua proxy

**Không có `matcher` thì proxy chạy cho MỌI request**, kể cả file CSS, ảnh, JS. Hậu quả rất dễ nhận ra: logic auth chặn luôn cả file tĩnh và trang mất sạch style.

```ts
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
```

Đọc mẫu regex này: `(?!...)` là negative lookahead — "khớp mọi đường dẫn **trừ** những cái bắt đầu bằng...".

Các dạng khác:

```ts
matcher: '/dashboard/:path*'                          // /dashboard và mọi con của nó
matcher: ['/dashboard/:path*', '/settings/:path*']    // nhiều nhóm
```

> ⚠️ `matcher` phải là **hằng số viết thẳng**, Next.js đọc nó lúc build. Dùng biến sẽ bị bỏ qua âm thầm:
> ```ts
> const paths = ['/dashboard/:path*']
> export const config = { matcher: paths }    // ❌ không có tác dụng
> ```

### Proxy làm được gì

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Chuyển hướng
  if (pathname === '/blog') {
    return NextResponse.redirect(new URL('/posts', request.url))
  }

  // 2. Rewrite — đổi nội dung mà URL giữ nguyên
  if (pathname.startsWith('/old-posts')) {
    return NextResponse.rewrite(new URL('/posts', request.url))
  }

  // 3. Trả thẳng response, không vào route
  if (pathname.startsWith('/admin') && !request.cookies.has('accessToken')) {
    return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // 4. Thêm header rồi đi tiếp
  const response = NextResponse.next()
  response.headers.set('x-powered-by-vanson', 'true')
  return response
}
```

Kiểm chứng redirect và rewrite — khác nhau ở thanh địa chỉ:

```bash
$ curl -i -s localhost:3001/blog | head -2
HTTP/1.1 307 Temporary Redirect
location: /posts                    ← trình duyệt đổi URL thành /posts

$ curl -i -s localhost:3001/old-posts | head -2
HTTP/1.1 200 OK                     ← URL vẫn là /old-posts, nội dung là của /posts
```

Kiểm chứng header:

```bash
$ curl -sI localhost:3001/posts | grep -i vanson
x-powered-by-vanson: true
```

### Đọc và ghi cookie

```ts
export function proxy(request: NextRequest) {
  // đọc từ request
  const token = request.cookies.get('accessToken')?.value
  const hasToken = request.cookies.has('accessToken')

  // ghi vào response
  const response = NextResponse.next()
  response.cookies.set('lastVisit', new Date().toISOString(), {
    httpOnly: true,
    path: '/',
  })
  return response
}
```

### Truyền dữ liệu từ proxy xuống trang

Proxy chạy tách biệt, không chia sẻ biến với route. Muốn truyền gì thì gắn vào **header của request**:

```ts
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)

  return NextResponse.next({
    request: { headers: requestHeaders },     // ← đúng: gửi ngược lên route
  })
}
```

```tsx
// app/posts/page.tsx
import { headers } from 'next/headers'

export default async function Page() {
  const h = await headers()
  console.log(h.get('x-pathname'))     // "/posts"
}
```

> ⚠️ Phân biệt hai cách viết rất giống nhau:
> ```ts
> NextResponse.next({ request: { headers } })   // gửi lên route (server đọc được)
> NextResponse.next({ headers })                // gửi xuống trình duyệt (client thấy)
> ```

### Giới hạn của proxy

| Điều | Chi tiết |
|---|---|
| Runtime | Node.js (Next.js 16 không cho chọn `edge` trong `proxy.ts`) |
| Chạy trước mọi thứ | Trước cả khi Next.js quyết định route nào |
| Không truy cập được | Database qua ORM nặng, `fs`, module dùng chung với app |
| Không nên | Query DB, gọi API chậm — nó chạy cho **mọi** request đã khớp matcher |

Đặt `runtime` trong proxy sẽ lỗi:

```
Error: The `runtime` config option is not available in Proxy.
```

---

## 7. Chặn route bằng proxy — mẫu thực dụng

```ts
// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/posts/new', '/settings']
const GUEST_ONLY = ['/login', '/register']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('accessToken')?.value

  // Chưa đăng nhập mà vào trang cần đăng nhập
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)   // để quay lại sau khi đăng nhập
    return NextResponse.redirect(loginUrl)
  }

  // Đã đăng nhập rồi mà vào trang login
  if (GUEST_ONLY.includes(pathname) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

Chưa đăng nhập, vào `/dashboard`:

```bash
$ curl -i -s localhost:3001/dashboard | head -2
HTTP/1.1 307 Temporary Redirect
location: /login?next=%2Fdashboard
```

### ⚠️ Proxy KHÔNG phải lớp bảo mật

Proxy chỉ kiểm tra **cookie có tồn tại hay không**. Nó không xác minh token còn hạn, đúng chữ ký, hay user có quyền gì. Người ta tự đặt cookie giả trong DevTools là qua được:

```js
document.cookie = 'accessToken=hehe'      // proxy cho qua ngay
```

Vậy proxy để làm gì? Để **trải nghiệm tốt** — chuyển hướng sớm, không phải render nửa trang rồi mới đá ra. Còn bảo mật thật nằm ở:

1. Kiểm tra token trong Server Component / Server Action (bài [06](./06-auth-jwt.md)).
2. Backend NestJS xác thực JWT bằng `JwtAuthGuard`.

Có một cái bẫy cụ thể trong tài liệu Next.js: **Server Action là POST tới chính URL của trang.** Nên nếu matcher loại trừ một đường dẫn, mọi Server Action trên đường dẫn đó cũng mất luôn lớp proxy. Đó là lý do phải kiểm tra quyền **bên trong từng action**.

---

## 8. Thứ tự thực thi

Khi một request tới, Next.js xử lý theo đúng thứ tự này:

```
1. headers    trong next.config.ts
2. redirects  trong next.config.ts
3. proxy.ts                              ← bạn ở đây
4. rewrites (beforeFiles)
5. File tĩnh: public/, _next/static/
6. Route: app/**/page.tsx, route.ts
7. rewrites (afterFiles)
8. Route động: /posts/[slug]
9. rewrites (fallback)
```

Hiểu bảng này giải thích được một câu hỏi hay gặp: "vì sao proxy của tôi chạy cả với file ảnh?" — vì proxy ở bước 3, còn file tĩnh mãi bước 5. Phải loại trừ bằng `matcher`.

---

## Bài tập

1. Tạo `/api/health` trả `{ status, time }`. Gọi bằng `curl` và chép lại output.
2. Gọi `/api/health` bằng `DELETE` để nhận 405, chép lại header `Allow`.
3. Tạo `/api/search` đọc `?q=` và `?page=`. Test bằng `curl` với cả hai tham số.
4. Tạo `/api/posts/export` xuất CSV. Mở trong trình duyệt và xác nhận file tải về.
5. Tạo `src/proxy.ts` log mọi request. Vào 3 trang khác nhau và chép lại log.
6. Cố tình bỏ `matcher` đi, vào một trang có ảnh và quan sát proxy chạy cho cả `/favicon.ico`.
7. Thêm redirect `/blog` → `/posts` và rewrite `/old-posts` → `/posts`. Dùng `curl -i` để thấy khác biệt 307 vs 200.
8. Thêm header `x-pathname` từ proxy, đọc lại bằng `headers()` trong Server Component.
9. Viết proxy chặn `/dashboard` khi không có cookie `accessToken`, kèm `?next=`. Test bằng `curl -i`.
10. Mở DevTools, tự đặt `document.cookie = 'accessToken=hehe'` rồi vào `/dashboard` — xác nhận proxy cho qua. Đây là lý do bài 06 tồn tại.

Tiếp theo 👉 [06-auth-jwt.md](./06-auth-jwt.md)
