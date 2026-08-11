# Bài 6 — Đăng nhập JWT với Blog API

Bài này ghép Next.js với Blog API NestJS bạn đã làm ở [../nestjs/06-auth-jwt.md](../nestjs/06-auth-jwt.md).

## 1. Chọn chỗ lưu token

Backend trả về `accessToken` sau khi đăng nhập. Câu hỏi: cất nó ở đâu?

| Nơi lưu | Chống XSS | Server đọc được | Kết luận |
|---|---|---|---|
| `localStorage` | ❌ Bất kỳ script nào cũng đọc được | ❌ | **Không dùng** |
| Cookie thường | ❌ | ✅ | Không dùng |
| **Cookie `httpOnly`** | ✅ JavaScript không đọc được | ✅ | **Dùng cái này** |

`localStorage` là lựa chọn mặc định của người quen React thuần, nhưng sai với Next.js vì hai lý do:

1. **Không chống được XSS.** Một thư viện npm bị nhiễm mã độc là đọc sạch token.
2. **Server Component không đọc được `localStorage`.** Mà phần lớn code của bạn chạy ở server. Bạn sẽ phải chuyển mọi thứ sang Client Component — mất sạch lợi ích của Next.js.

Kiểm chứng điểm 1:

```js
// Gõ vào console trình duyệt
localStorage.getItem('token')
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."     ← lộ

document.cookie
// ""                                             ← cookie httpOnly không hiện ra
```

---

## 2. Luồng đăng nhập

```
Trình duyệt          Next.js (server)              NestJS
    │                     │                          │
    ├─ submit form ──────>│                          │
    │                     ├─ POST /api/auth/login ──>│
    │                     │<── { data.accessToken } ─┤
    │                     │                          │
    │<── Set-Cookie: ─────┤ cookies().set(httpOnly)  │
    │    accessToken=...  │                          │
    │                     │                          │
    ├─ vào /dashboard ───>│                          │
    │  (cookie tự gửi)    ├─ GET /api/auth/me ──────>│
    │                     │   Authorization: Bearer  │
    │<── HTML đã render ──┤<── { data: user } ───────┤
```

Điểm mấu chốt: **token không bao giờ đi vào JavaScript trình duyệt.** Trình duyệt chỉ giữ cookie httpOnly và tự gửi kèm; việc gắn header `Authorization` do Next.js server làm.

---

## 3. Action đăng nhập

```ts
// src/app/(auth)/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const API = process.env.API_URL ?? 'http://localhost:3000/api'

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
})

export type AuthState = {
  errors?: Record<string, string[]>
  message?: string
}

export async function login(
  prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  })

  if (!res.ok) {
    // Đừng nói rõ "email không tồn tại" hay "sai mật khẩu" —
    // như vậy là tiết lộ email nào có trong hệ thống
    return { message: 'Email hoặc mật khẩu không đúng' }
  }

  const { data } = await res.json()          // { success, data: { accessToken, refreshToken, user } }

  const cookieStore = await cookies()
  cookieStore.set('accessToken', data.accessToken, {
    httpOnly: true,                          // JS không đọc được
    secure: process.env.NODE_ENV === 'production',  // chỉ gửi qua HTTPS khi lên production
    sameSite: 'lax',                         // chống CSRF cơ bản
    path: '/',
    maxAge: 60 * 15,                         // 15 phút, khớp với access token của NestJS
  })

  cookieStore.set('refreshToken', data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,                // 7 ngày
  })

  const next = (formData.get('next') as string) || '/dashboard'
  redirect(next)
}
```

Giải thích từng tuỳ chọn cookie, vì bỏ sót cái nào cũng thành lỗ hổng:

| Tuỳ chọn | Bỏ đi thì sao |
|---|---|
| `httpOnly: true` | XSS đọc được token |
| `secure` | Token gửi qua HTTP thường, ai bắt gói tin cũng thấy |
| `sameSite: 'lax'` | Site khác submit form sang bạn kèm cookie → CSRF |
| `path: '/'` | Cookie chỉ gửi ở đúng đường dẫn tạo ra nó, các trang khác không thấy |
| `maxAge` | Thành session cookie, mất khi đóng trình duyệt |

> ⚠️ `secure: true` ở môi trường dev (HTTP) khiến cookie **không được set** và bạn đăng nhập hoài không vào. Đó là lý do phải gắn `process.env.NODE_ENV === 'production'`.

Kiểm chứng cookie đã set đúng:

```bash
$ curl -i -s -X POST localhost:3001/login \
    -d 'email=admin@blog.test&password=12345678' | grep -i set-cookie
set-cookie: accessToken=eyJhbGciOi...; Path=/; HttpOnly; SameSite=lax; Max-Age=900
```

Có chữ `HttpOnly` là đúng. Trong DevTools → Application → Cookies, cột **HttpOnly** phải được tick.

---

## 4. Form đăng nhập

```tsx
// src/app/(auth)/login/page.tsx
import LoginForm from '@/components/LoginForm'

export default async function LoginPage(props: PageProps<'/login'>) {
  const { next } = await props.searchParams

  return (
    <div className="mx-auto max-w-sm py-12">
      <h1 className="mb-6 text-2xl font-bold">Đăng nhập</h1>
      <LoginForm next={typeof next === 'string' ? next : '/dashboard'} />
    </div>
  )
}
```

```tsx
// src/components/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { login, type AuthState } from '@/app/(auth)/actions'

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(login, {} as AuthState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full rounded border p-2"
        />
        {state.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      <div>
        <input
          name="password"
          type="password"
          placeholder="Mật khẩu"
          className="w-full rounded border p-2"
        />
        {state.errors?.password && (
          <p className="text-sm text-red-600">{state.errors.password[0]}</p>
        )}
      </div>

      {state.message && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  )
}
```

---

## 5. Lấy user hiện tại

```ts
// src/lib/auth.ts
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { User } from './types'

const API = process.env.API_URL ?? 'http://localhost:3000/api'

// cache() để nhiều component gọi getCurrentUser() chỉ tốn 1 request
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get('accessToken')?.value
  if (!token) return null

  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',              // thông tin user không được cache
  })

  if (!res.ok) return null          // 401 = token hết hạn hoặc giả

  const { data } = await res.json()
  return data as User
})
```

Dùng ở bất kỳ Server Component nào:

```tsx
// src/components/Header.tsx — Server Component
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import LogoutButton from './LogoutButton'

export default async function Header() {
  const user = await getCurrentUser()

  return (
    <header className="flex items-center justify-between border-b p-4">
      <Link href="/" className="font-bold">Blog</Link>

      {user ? (
        <div className="flex items-center gap-3">
          <span className="text-sm">Xin chào, {user.name}</span>
          {user.role === 'admin' && <Link href="/dashboard">Quản trị</Link>}
          <LogoutButton />
        </div>
      ) : (
        <Link href="/login">Đăng nhập</Link>
      )}
    </header>
  )
}
```

Nhờ `cache()`, gọi `getCurrentUser()` ở Header, ở page, ở sidebar cùng lúc chỉ tốn **một** request tới NestJS. Kiểm chứng ở log NestJS:

```
[Nest] LOG [AuthController] GET /api/auth/me      ← chỉ một dòng cho mỗi lần tải trang
```

Bỏ `cache()` đi thì thành ba dòng.

---

## 6. Bảo vệ trang: hai lớp

### Lớp 1 — proxy (trải nghiệm)

```ts
// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/posts/new', '/settings']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('accessToken')

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !hasToken) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (pathname === '/login' && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

Lớp này **chỉ nhìn cookie có tồn tại hay không**. Nó không xác minh gì cả. Mục đích duy nhất: chuyển hướng sớm, đỡ phải render nửa trang rồi mới đá ra.

### Lớp 2 — kiểm tra thật trong page (bảo mật)

```ts
// src/lib/auth.ts (thêm vào)
import { redirect } from 'next/navigation'

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(...roles: User['role'][]): Promise<User> {
  const user = await requireUser()
  if (!roles.includes(user.role)) {
    redirect('/?error=forbidden')
  }
  return user
}
```

```tsx
// src/app/dashboard/page.tsx
import { requireRole } from '@/lib/auth'

export default async function DashboardPage() {
  const user = await requireRole('admin', 'editor')   // ← xác minh thật với NestJS

  return <h1>Bảng điều khiển của {user.name}</h1>
}
```

**Chứng minh vì sao cần cả hai lớp.** Mở DevTools, tự đặt cookie giả:

```js
document.cookie = 'accessToken=hehe; path=/'
```

Rồi vào `/dashboard`:

- Proxy thấy có cookie → **cho qua**.
- `requireRole()` gọi `/api/auth/me` với token `hehe` → NestJS trả 401 → `getCurrentUser()` trả `null` → `redirect('/login')`.

Log NestJS xác nhận:

```
[Nest] WARN [JwtStrategy] Unauthorized: jwt malformed
 GET /api/auth/me 401
```

Chỉ có proxy thì bạn đã bị lọt vào trang quản trị.

---

## 7. Gọi API cần token

Gom một chỗ để không lặp lại việc gắn header:

```ts
// src/lib/api.ts
import { cookies } from 'next/headers'

const API = process.env.API_URL ?? 'http://localhost:3000/api'

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = (await cookies()).get('accessToken')?.value

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...init.headers,
    },
  })

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED')
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`)
  }

  const json = await res.json()
  return json.data as T          // bóc lớp { success, data, timestamp } của Blog API
}
```

Dùng:

```ts
const posts = await apiFetch<Paginated<Post>>('/posts?page=1')
const post = await apiFetch<Post>('/posts', {
  method: 'POST',
  body: JSON.stringify({ title, content, categoryId }),
})
```

> ⚠️ `apiFetch` gọi `cookies()` nên **chỉ dùng được ở Server Component, Server Action, Route Handler**. Gọi từ Client Component sẽ lỗi:
> ```
> Error: `cookies` was called outside a request scope.
> ```

### Xử lý lỗi 422 của Blog API

Blog API trả 422 kèm lỗi gom theo field. Bắt lại để hiện đúng chỗ:

```ts
export async function createPost(prevState: FormState, formData: FormData) {
  const res = await fetch(`${API}/posts`, { /* ... */ })

  if (res.status === 422) {
    const body = await res.json()
    return { errors: body.errors }    // { title: ['...'], content: ['...'] }
  }
  // ...
}
```

Dạng lỗi từ NestJS:

```bash
$ curl -s -X POST localhost:3000/api/posts \
    -H "Content-Type: application/json" -d '{"title":"ab"}' | jq
{
  "success": false,
  "statusCode": 422,
  "errors": {
    "title": ["title must be longer than or equal to 5 characters"],
    "content": ["content should not be empty"]
  }
}
```

Cấu trúc này khớp luôn với `state.errors?.title` trong form ở bài [04](./04-server-actions-va-form.md#5-useactionstate--hiện-lỗi-và-trạng-thái-chờ) — không cần chuyển đổi gì.

---

## 8. Đăng xuất

```ts
// src/app/(auth)/actions.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('accessToken')
  cookieStore.delete('refreshToken')
  redirect('/login')
}
```

```tsx
// src/components/LogoutButton.tsx
import { logout } from '@/app/(auth)/actions'

export default function LogoutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="text-sm text-gray-600 hover:underline">
        Đăng xuất
      </button>
    </form>
  )
}
```

Component này **không cần `'use client'`** — form HTML thật gọi Server Action, hoạt động cả khi JS chưa tải.

---

## 9. Refresh token

Access token sống 15 phút. Hết hạn thì người dùng bị đá ra giữa chừng — khó chịu. Dùng refresh token gia hạn ngầm:

```ts
// src/lib/auth.ts
'use server'

import { cookies } from 'next/headers'

export async function refreshAccessToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('refreshToken')?.value
  const userId = cookieStore.get('userId')?.value
  if (!refreshToken || !userId) return null

  const res = await fetch(`${API}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(userId), refreshToken }),
  })

  if (!res.ok) return null

  const { data } = await res.json()

  cookieStore.set('accessToken', data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15,
  })

  return data.accessToken
}
```

Ghép vào `apiFetch` để tự thử lại một lần:

```ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = (await cookies()).get('accessToken')?.value

  let res = await callApi(path, init, token)

  if (res.status === 401) {
    token = await refreshAccessToken()
    if (!token) throw new Error('UNAUTHORIZED')
    res = await callApi(path, init, token)     // thử lại đúng một lần
  }

  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return (await res.json()).data as T
}
```

> ⚠️ **Chỉ thử lại một lần.** Viết vòng lặp `while` mà refresh token cũng hỏng thì bạn có vòng lặp vô hạn nện vào backend.

> ⚠️ **`cookies().set()` chỉ gọi được trong Server Action hoặc Route Handler**, không gọi được khi đang render Server Component:
> ```
> Error: Cookies can only be modified in a Server Action or Route Handler.
> ```
> Đó là lý do `refreshAccessToken` có `'use server'` ở đầu file.

---

## 10. Không cache dữ liệu riêng của user

Đây là lỗi bảo mật nghiêm trọng nhất và cũng khó phát hiện nhất.

```ts
// ❌ NGUY HIỂM: user A thấy dữ liệu của user B
const res = await fetch(`${API}/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
  next: { revalidate: 60 },       // cache dùng chung cho MỌI người
})
```

Cache của Next.js **không phân biệt user** — nó chỉ lấy URL làm khoá. Người thứ hai vào trang sẽ nhận nguyên hồ sơ của người thứ nhất.

```ts
// ✅ Đúng
const res = await fetch(`${API}/auth/me`, {
  headers: { Authorization: `Bearer ${token}` },
  cache: 'no-store',
})
```

Quy tắc: **mọi request có header `Authorization` đều phải `cache: 'no-store'`**, trừ khi bạn chắc chắn dữ liệu đó chung cho tất cả.

Cách kiểm tra: đăng nhập user A ở Chrome, user B ở cửa sổ ẩn danh. Nếu B thấy tên của A, bạn đã cache nhầm.

---

## 11. Bảng tổng kết bảo mật

| Việc | Làm | Không làm |
|---|---|---|
| Lưu token | Cookie `httpOnly` + `secure` + `sameSite` | `localStorage` |
| Chặn route | Proxy (UX) **và** kiểm tra trong page (bảo mật) | Chỉ proxy |
| Server Action | Kiểm tra auth + quyền sở hữu trong từng hàm | Tin vào proxy |
| Dữ liệu user | `cache: 'no-store'` | `revalidate` |
| Thông báo lỗi login | "Email hoặc mật khẩu không đúng" | "Email này không tồn tại" |
| Secret | `API_SECRET` | `NEXT_PUBLIC_API_SECRET` |

---

## Bài tập

1. Viết action `login` lưu `accessToken` vào cookie httpOnly. Kiểm tra bằng `curl -i` và tìm chữ `HttpOnly` trong `set-cookie`.
2. Mở DevTools console, chạy `document.cookie` và xác nhận **không** thấy token.
3. Viết `getCurrentUser()` có `cache()`. Gọi nó ở 3 component khác nhau, kiểm tra log NestJS chỉ có 1 dòng `GET /api/auth/me`.
4. Bỏ `cache()` đi, đếm lại số dòng log.
5. Viết `requireRole('admin')` cho `/dashboard`. Đăng nhập bằng tài khoản `user` thường và xác nhận bị đá về trang chủ.
6. Đặt cookie giả bằng `document.cookie = 'accessToken=hehe'`, vào `/dashboard`. Chép lại log 401 từ NestJS và xác nhận bạn vẫn bị chặn.
7. Viết `apiFetch` gắn `Authorization` tự động và bóc lớp `data`.
8. Gọi `apiFetch` từ một Client Component để gặp lỗi `cookies was called outside a request scope`.
9. Viết `logout` xoá cả 2 cookie. Xác nhận sau đó `/dashboard` chuyển hướng về `/login`.
10. Cố tình đặt `next: { revalidate: 60 }` cho `/auth/me`. Đăng nhập 2 user ở 2 cửa sổ và quan sát hiện tượng lẫn dữ liệu. Sửa lại thành `no-store`.

Tiếp theo 👉 [07-toi-uu-seo-deploy.md](./07-toi-uu-seo-deploy.md)
