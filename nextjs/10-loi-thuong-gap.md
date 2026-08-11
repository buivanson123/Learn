# Bài 10 — 20 lỗi thường gặp

Mỗi mục theo cùng một cấu trúc: **thông báo lỗi thật** → nguyên nhân → cách sửa.

---

## Lỗi 1 — `params should be awaited`

```
Error: Route "/posts/[slug]" used `params.slug`. `params` should be awaited
before using its properties.
    at PostPage (src/app/posts/[slug]/page.tsx:2:22)
```

**Nguyên nhân:** Next.js 16 đã gỡ bỏ hoàn toàn truy cập đồng bộ vào `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()`.

```tsx
// ❌
export default async function Page({ params }: PageProps<'/posts/[slug]'>) {
  return <h1>{params.slug}</h1>
}

// ✅
export default async function Page(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  return <h1>{slug}</h1>
}
```

Dự án cũ nhiều chỗ:

```bash
npx @next/codemod@canary next-async-request-api .
```

---

## Lỗi 2 — `useState only works in Client Components`

```
Error: useState only works in Client Components.
Add the "use client" directive at the top of the file to use it.

   ╭─[src/components/Counter.tsx:1:1]
 1 │ import { useState } from 'react'
   ·          ────────
```

**Nguyên nhân:** thiếu `'use client'`, hoặc đặt nó **sau** import.

```tsx
// ✅ phải là dòng đầu tiên tuyệt đối
'use client'

import { useState } from 'react'
```

Nếu lỗi trỏ vào `node_modules/...` thì thư viện đó chưa khai báo `'use client'`. Bọc lại:

```tsx
// components/CarouselWrapper.tsx
'use client'
export { Carousel } from 'some-lib'
```

---

## Lỗi 3 — `Event handlers cannot be passed to Client Component props`

```
Error: Event handlers cannot be passed to Client Component props.
  <button onClick={function onClick} children="Bấm">
                   ^^^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
```

**Nguyên nhân:** dùng `onClick` trong Server Component. Hàm không serialize được để gửi qua mạng.

Tách riêng phần tương tác:

```tsx
// components/LikeButton.tsx
'use client'
export default function LikeButton() {
  return <button onClick={() => alert('hi')}>Thích</button>
}
```

---

## Lỗi 4 — `Functions cannot be passed directly to Client Components`

```
Error: Functions cannot be passed directly to Client Components unless you
explicitly expose it by marking it with "use server".
  <... post={{...}} onSave={function onSave}>
                           ^^^^^^^^^^^^^^^^
```

**Nguyên nhân:** truyền hàm thường làm prop qua ranh giới server → client.

```tsx
// ✅ Chỉ Server Action được phép
// app/actions.ts
'use server'
export async function savePost(formData: FormData) { /* ... */ }

// page.tsx
<ClientForm saveAction={savePost} />
```

---

## Lỗi 5 — `window is not defined`

```
ReferenceError: window is not defined
    at Widget (src/components/Widget.tsx:4:17)
```

**Nguyên nhân:** Client Component **vẫn được render một lần ở server** để sinh HTML. `'use client'` nghĩa là "gửi xuống client và chạy tiếp ở đó", không phải "chỉ chạy ở client".

```tsx
'use client'
import { useEffect, useState } from 'react'

export default function Widget() {
  const [width, setWidth] = useState(0)
  useEffect(() => setWidth(window.innerWidth), [])   // useEffect chỉ chạy ở trình duyệt
  return <p>{width}</p>
}
```

Thư viện hoàn toàn không chạy được ở server thì tắt SSR:

```tsx
'use client'
import dynamic from 'next/dynamic'
const Map = dynamic(() => import('./Map'), { ssr: false })
```

---

## Lỗi 6 — `Hydration failed`

```
Error: Hydration failed because the server rendered HTML didn't match the client.

  <p>
-   Cập nhật: 09:14:22            ← server render
+   Cập nhật: 09:14:25            ← client render
```

**Nguyên nhân:** HTML server sinh ra khác với client. Ba thủ phạm phổ biến:

```tsx
new Date().toLocaleString()     // giờ server ≠ giờ client
Math.random()                   // mỗi lần một khác
localStorage.getItem('theme')   // server không có
```

Cách sửa 1 — chỉ render ở client sau khi mount:

```tsx
'use client'
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null
return <p>{new Date().toLocaleString()}</p>
```

Cách sửa 2 — bỏ qua khác biệt ở đúng thẻ đó:

```tsx
<time suppressHydrationWarning>{new Date().toLocaleString()}</time>
```

Thủ phạm thứ tư khó tìm: HTML không hợp lệ. `<p>` chứa `<div>` bị trình duyệt tự sửa cấu trúc, gây lệch:

```tsx
<p><div>x</div></p>       // ❌ trình duyệt tách <p> ra → hydration lỗi
```

---

## Lỗi 7 — `Cookies can only be modified in a Server Action or Route Handler`

```
Error: Cookies can only be modified in a Server Action or Route Handler.
Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options
```

**Nguyên nhân:** gọi `cookies().set()` trong lúc render Server Component. Lúc đó HTML có thể đã gửi đi rồi, không thêm header được nữa.

```ts
// ✅ Trong Server Action
'use server'
export async function login(formData: FormData) {
  const cookieStore = await cookies()
  cookieStore.set('accessToken', token, { httpOnly: true })
}
```

Đọc (`get`) thì ở đâu cũng được, chỉ ghi mới bị giới hạn.

---

## Lỗi 8 — `cookies was called outside a request scope`

```
Error: `cookies` was called outside a request scope.
Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context
```

**Nguyên nhân:** thường là hàm gọi `cookies()` bị import vào Client Component.

```tsx
// ❌ components/PostList.tsx
'use client'
import { apiFetch } from '@/lib/api'      // apiFetch gọi cookies() bên trong
```

Sửa: lấy dữ liệu ở Server Component rồi truyền props xuống.

```tsx
// page.tsx (server)
const posts = await apiFetch('/posts')
return <PostList posts={posts} />
```

---

## Lỗi 9 — `Failed to parse URL from undefined/posts`

```
TypeError: Failed to parse URL from undefined/api/posts
    at getPosts (src/lib/api.ts:5:21)
  [cause]: TypeError: Invalid URL
```

**Nguyên nhân:** `process.env.API_URL` là `undefined`. Ba khả năng:

1. Chưa có `.env.local`, hoặc gõ sai tên biến.
2. Sửa `.env.local` rồi mà chưa khởi động lại `npm run dev`.
3. Đang đọc biến server từ Client Component — thiếu tiền tố `NEXT_PUBLIC_`.

Luôn có giá trị dự phòng để lỗi hiện ra rõ ràng hơn:

```ts
const API = process.env.API_URL ?? 'http://localhost:3000/api'
```

---

## Lỗi 10 — `ECONNREFUSED 127.0.0.1:3000`

```
 ⨯ TypeError: fetch failed
    at async getPosts (src/lib/api.ts:6:15)
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Nguyên nhân:**

- Blog API NestJS chưa chạy → `cd blog-api && npm run start:dev`.
- Hoặc bạn đang chạy trong Docker và dùng `localhost`. Trong container, `localhost` là chính container đó. Phải dùng tên service:

```yaml
environment:
  API_URL: http://api:3000/api      # tên service trong docker-compose
```

---

## Lỗi 11 — `Unexpected token '<', "<!DOCTYPE"... is not valid JSON`

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
    at JSON.parse (<anonymous>)
```

**Nguyên nhân:** API trả HTML (trang lỗi 404/500) nhưng bạn gọi `.json()`. `fetch` **không throw** khi status là 4xx/5xx.

```ts
const res = await fetch(url)
if (!res.ok) {
  throw new Error(`${url} → ${res.status} ${res.statusText}`)
}
return res.json()
```

Giờ lỗi nói đúng vấn đề:

```
Error: http://localhost:3000/api/postss → 404 Not Found
```

---

## Lỗi 12 — `formData.get is not a function`

```
TypeError: formData.get is not a function
    at createPost (src/app/posts/actions.ts:8:28)
```

**Nguyên nhân:** sai thứ tự tham số khi dùng với `useActionState`. Tham số đầu tiên là **state trước đó**, không phải FormData.

```ts
// ❌
export async function createPost(formData: FormData, prevState: State) {}

// ✅
export async function createPost(prevState: State, formData: FormData) {}
```

Có tham số riêng thì `bind` vào **trước** hai tham số đó:

```ts
export async function updatePost(id: number, prevState: State, formData: FormData) {}
const action = updatePost.bind(null, post.id)
```

---

## Lỗi 13 — Đăng bài xong nhưng danh sách không đổi

**Không có thông báo lỗi.** Dữ liệu đã vào database (kiểm tra bằng `curl` thấy có), nhưng trang `/posts` vẫn hiện danh sách cũ.

**Nguyên nhân:** trang đang dùng bản cache.

```ts
'use server'
export async function createPost(prevState, formData) {
  await apiFetch('/posts', { method: 'POST', body })

  revalidateTag('posts', 'max')      // ← thiếu dòng này là bị
  revalidatePath('/posts')
  redirect('/posts')
}
```

Nhớ gắn tag lúc fetch thì `revalidateTag` mới có tác dụng:

```ts
await fetch(url, { next: { revalidate: 60, tags: ['posts'] } })
```

Muốn thấy thay đổi **ngay lập tức** (người dùng vừa tự sửa) thì dùng `updateTag('posts')` thay vì `revalidateTag`.

---

## Lỗi 14 — `Expected 2 arguments, but got 1` ở `revalidateTag`

```
Expected 2 arguments, but got 1.
  An argument for 'profile' was not provided.
```

**Nguyên nhân:** Next.js 16 đổi chữ ký `revalidateTag`, bắt buộc có hồ sơ `cacheLife`.

```ts
revalidateTag('posts')          // ❌
revalidateTag('posts', 'max')   // ✅
updateTag('posts')              // ✅ nếu cần thấy ngay
```

---

## Lỗi 15 — `NextRouter was not mounted`

```
Error: NextRouter was not mounted.
https://nextjs.org/docs/messages/next-router-not-mounted
```

**Nguyên nhân:** import từ `next/router` (của Pages Router) thay vì `next/navigation`.

```tsx
import { useRouter } from 'next/router'       // ❌ Pages Router
import { useRouter } from 'next/navigation'   // ✅ App Router
```

API cũng khác: App Router **không có** `router.query`, `router.pathname`, `router.events`. Thay bằng `useParams()`, `useSearchParams()`, `usePathname()`.

---

## Lỗi 16 — Proxy không chạy

**Không có thông báo lỗi.** Bạn thêm logic vào `proxy.ts` nhưng nó không bao giờ được gọi.

Kiểm tra theo thứ tự:

1. **Vị trí file.** Phải ngang hàng `app/`, không phải bên trong:
   ```
   src/proxy.ts     ✅  (khi dùng src/)
   src/app/proxy.ts ❌
   ```
2. **Tên hàm.** Phải là `proxy` hoặc `export default`:
   ```ts
   export function middleware() {}   // ❌ trong file proxy.ts
   export function proxy() {}        // ✅
   ```
3. **`matcher` phải là hằng số viết thẳng:**
   ```ts
   const paths = ['/dashboard/:path*']
   export const config = { matcher: paths }        // ❌ bị bỏ qua âm thầm
   export const config = { matcher: ['/dashboard/:path*'] }   // ✅
   ```
4. **Đã khởi động lại `npm run dev` chưa** sau khi tạo file mới.

---

## Lỗi 17 — Proxy chạy cả với file ảnh và CSS

**Triệu chứng:** trang mất hết style, ảnh không hiện, hoặc terminal đầy log của `/favicon.ico`, `/_next/static/...`.

**Nguyên nhân:** không có `matcher`. Proxy mặc định chạy cho **mọi** request.

```ts
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Lỗi 18 — User A thấy dữ liệu của user B

**Không có thông báo lỗi.** Đây là lỗi bảo mật nghiêm trọng nhất và khó phát hiện nhất.

**Nguyên nhân:** cache request có `Authorization`. Cache của Next.js lấy URL làm khoá, **không phân biệt user**.

```ts
// ❌
await fetch(`${API}/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
  next: { revalidate: 60 },
})

// ✅
await fetch(`${API}/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
  cache: 'no-store',
})
```

**Cách kiểm tra:** đăng nhập user A ở Chrome thường, user B ở cửa sổ ẩn danh. Nếu B thấy tên của A, bạn đã cache nhầm.

Quy tắc: mọi request có `Authorization` đều `cache: 'no-store'`.

---

## Lỗi 19 — Copy code từ bài viết cũ

**Triệu chứng:** code trên blog/StackOverflow/YouTube chạy không được, lỗi tùm lum.

Đối chiếu nhanh xem bài viết đó thuộc thời nào:

| Thấy trong code | Thuộc về | Thay bằng |
|---|---|---|
| `getServerSideProps`, `getStaticProps` | Pages Router | Server Component + `await fetch` |
| `pages/api/hello.js` | Pages Router | `app/api/hello/route.ts` |
| `_app.js`, `_document.js` | Pages Router | `app/layout.tsx` |
| `import { useRouter } from 'next/router'` | Pages Router | `next/navigation` |
| `params.slug` không có `await` | Next ≤ 15 | `await params` |
| `middleware.ts` | Next ≤ 15 | `proxy.ts` |
| `revalidateTag('x')` 1 tham số | Next ≤ 15 | thêm tham số 2 |
| `fetch` cache mặc định | Next ≤ 14 | phải khai báo `force-cache` |
| `next lint` | Next ≤ 15 | `eslint .` |
| `experimental.ppr` | Next 15 | `cacheComponents: true` |
| `serverRuntimeConfig` | Next ≤ 15 | biến môi trường |
| `images.domains` | Next ≤ 15 | `images.remotePatterns` |

Cách nhanh nhất để biết một bài viết có còn dùng được: xem nó có `app/` hay `pages/`, và `params` có `await` không.

Tài liệu chính chủ luôn ghi phiên bản ở đầu trang — kiểm tra trước khi tin.

---

## Lỗi 20 — Trang lẽ ra tĩnh mà build ra `ƒ`

**Triệu chứng:** `npm run build` báo `/posts` là `ƒ (Dynamic)` dù bạn muốn nó tĩnh.

```
├ ƒ /posts        ← lẽ ra phải là ○ hoặc ●
```

**Nguyên nhân** — tìm theo thứ tự này trong page **và mọi component nó dùng**:

| Thứ | Cách tìm |
|---|---|
| `cookies()` / `headers()` | `grep -rn "cookies()\|headers()" src/app/posts/` |
| `searchParams` | Có trong `page.tsx` không? |
| `fetch` không cache | Thiếu `revalidate` hoặc `force-cache` |
| `export const dynamic = 'force-dynamic'` | `grep -rn "force-dynamic" src/` |
| `connection()` | `grep -rn "connection()" src/` |

Thủ phạm hay bị bỏ sót: một component **con** gọi `getCurrentUser()` (vốn đọc cookie) làm cả trang thành động. Ví dụ `<Header />` trong layout.

Cách xử lý: bọc phần cần dữ liệu theo request trong `<Suspense>` để phần còn lại vẫn tĩnh.

---

## Bảng tra nhanh theo triệu chứng

| Triệu chứng | Xem lỗi số |
|---|---|
| Lỗi khi truy cập `params`/`cookies` | 1, 7, 8 |
| Lỗi liên quan `'use client'` | 2, 3, 4, 5 |
| Nội dung nhấp nháy / khác nhau | 6 |
| `fetch` hỏng, URL sai | 9, 10, 11 |
| Form không chạy | 12 |
| Dữ liệu không cập nhật | 13, 14 |
| Điều hướng hỏng | 15 |
| Proxy không hoạt động | 16, 17 |
| Lẫn dữ liệu giữa các user | 18 |
| Code copy về không chạy | 19 |
| Build ra `ƒ` không mong muốn | 20 |

---

## Ba câu lệnh chẩn đoán

```bash
# 1. Lỗi kiểu mà build không báo
npx tsc --noEmit

# 2. Trang nào tĩnh, trang nào động
npm run build

# 3. Secret có lọt xuống trình duyệt không (phải rỗng)
grep -r "SECRET\|PASSWORD\|PRIVATE_KEY" .next/static/
```

Và một câu để tự kiểm tra kiến trúc:

```bash
# Mọi page phải là Server Component — kết quả phải rỗng
grep -rl "use client" src/app/**/page.tsx
```

Về mục lục 👉 [README.md](./README.md)
