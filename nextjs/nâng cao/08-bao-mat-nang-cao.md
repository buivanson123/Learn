# Bài 8 (NC) — Bảo mật nâng cao

Server Component đổi chỗ dữ liệu được truy cập, nên nó cũng đổi luôn các giả định bảo mật cũ. Bài này về những chỗ mới sinh ra.

## 1. Ba mô hình lấy dữ liệu — chọn một, đừng trộn

| Mô hình | Hợp với | Rủi ro |
|---|---|---|
| **Gọi HTTP API** (Zero Trust) | Dự án có sẵn backend, team tách biệt | Thấp — backend đã có lớp bảo vệ |
| **Data Access Layer** | Dự án mới | Thấp nếu làm đúng |
| **Truy vấn thẳng trong component** | Prototype, học | **Cao** — rất dễ lộ dữ liệu |

Dự án Blog của bạn thuộc nhóm 1: Next.js gọi NestJS, mọi thứ đã qua `JwtAuthGuard`. Đó là vị thế tốt.

> **Chọn một mô hình và giữ nguyên.** Trộn lẫn khiến cả người viết code lẫn người audit không biết phải kiểm tra ở đâu.

Ví dụ mô hình 3 sai ở đâu:

```tsx
// ❌ app/users/[slug]/page.tsx
export default async function Page({ params }) {
  const { slug } = await params
  const [rows] = await sql`SELECT * FROM user WHERE slug = ${slug}`
  return <Profile user={rows[0]} />       // LỘ: password_hash, email, token...
}
```

`SELECT *` rồi truyền cả object xuống Client Component. Mọi cột trong bảng `user` giờ nằm trong HTML gửi xuống trình duyệt — kể cả cột bạn quên là nó tồn tại.

Kiểm chứng:

```bash
$ curl -s localhost:3001/users/vanson | grep -o 'password_hash[^,]*'
password_hash\":\"$2b$10$K8vQ2mN5pR7tY9wA1sD3fG
```

---

## 2. DTO — hàng rào chính

Nhắc lại từ [bài 07](<./07-kien-truc-quy-mo-lon.md#3-data-access-layer>), nhưng ở đây nhìn từ góc bảo mật:

```ts
// src/data/user-dto.ts
import 'server-only'
import { getCurrentUser } from './auth'

function canSeeEmail(viewer: User | null, target: User) {
  if (!viewer) return false
  return viewer.id === target.id || viewer.role === 'admin'
}

export async function getProfileDTO(slug: string) {
  const user = await apiFetch<User>(`/users/slug/${slug}`)
  const viewer = await getCurrentUser()

  // Chỉ trả đúng những gì màn hình này cần
  return {
    id: user.id,
    name: user.name,
    email: canSeeEmail(viewer, user) ? user.email : null,
    postCount: user.postCount,
  }
}
```

Hai nguyên tắc:

1. **Danh sách trắng, không phải danh sách đen.** Liệt kê trường được phép, đừng xoá trường cấm — thêm cột mới vào DB là bạn lộ ngay.
2. **Quyền tính ở server, gửi xuống boolean.** Đừng gửi `viewer.role` và `post.authorId` xuống rồi để client so sánh.

---

## 3. Taint API — lưới an toàn

Bật lớp bảo vệ thứ hai, phòng khi DTO bị quên:

```js
// next.config.js
module.exports = {
  experimental: {
    taint: true,
  },
}
```

```ts
// src/data/auth.ts
import 'server-only'
import { experimental_taintObjectReference, experimental_taintUniqueValue } from 'react'

export const getCurrentUser = cache(async () => {
  const user = await apiFetch<User>('/auth/me', { cache: 'no-store' })

  experimental_taintObjectReference(
    'Không được truyền nguyên object User xuống Client Component. Dùng DTO.',
    user,
  )

  experimental_taintUniqueValue(
    'Không được để lộ token.',
    user,
    user.accessToken,
  )

  return user
})
```

Vô tình truyền xuống:

```tsx
<ProfileCard user={user} />       // ProfileCard là Client Component
```

```
Error: Không được truyền nguyên object User xuống Client Component. Dùng DTO.
    at ProfileCard
```

Ba điều cần biết:

- Vẫn là `experimental` ở Next.js 16.3 — tên API có thể đổi.
- **Là lưới an toàn, không thay thế DTO.** Nó bắt object *đúng tham chiếu đó*; bạn `{...user}` ra object mới là qua mặt được.
- Hàm và class **đã bị chặn sẵn** mặc định, không cần taint.

---

## 4. Server Action: bốn lớp kiểm tra

Nhắc lại mấu chốt: **Server Action là endpoint POST công khai**. Next.js có sinh ID mã hoá và loại bỏ action không dùng khỏi bundle, nhưng đó là giảm rủi ro, không phải lớp xác thực.

```ts
'use server'

export async function deletePostAction(postId: number) {
  // ① Xác thực — đã đăng nhập chưa?
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')

  // ② Phân quyền — có quyền với ĐÚNG bản ghi này không?
  const post = await apiFetch<Post>(`/posts/${postId}`, { cache: 'no-store' })
  if (!post) throw new Error('NOT_FOUND')
  if (post.author.id !== user.id && user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  // ③ Validate đầu vào
  const id = z.coerce.number().int().positive().parse(postId)

  // ④ Thực hiện, rồi trả về TỐI THIỂU
  await apiFetch(`/posts/${id}`, { method: 'DELETE' })
  revalidateTag('posts', 'max')
  return { success: true }          // KHÔNG trả về bản ghi vừa xoá
}
```

### Bước ② là bước hay bị bỏ nhất

Đây là lỗ hổng **IDOR** (Insecure Direct Object Reference). Kiểm tra đăng nhập rồi vẫn chưa đủ:

```bash
# Đăng nhập bằng tài khoản user thường, lấy cookie
$ TOKEN=$(curl -s -c /tmp/c.txt -X POST localhost:3001/login \
    -d 'email=user@blog.test&password=12345678')

# Thử xoá bài của người khác qua giao diện: nút không hiện
# Nhưng gọi thẳng action thì sao?
```

Trong DevTools Console, ngay trên trang của bạn:

```js
// Tìm action id trong payload rồi POST thẳng
fetch(location.href, {
  method: 'POST',
  headers: { 'Next-Action': '7f9a2c1e0b...' },
  body: JSON.stringify([999]),          // id bài của người khác
})
```

Không có bước ② → bài của người khác biến mất.

### Kiểm tra ở page KHÔNG bảo vệ action

```tsx
export default async function AdminPage() {
  const user = await getCurrentUser()
  if (user?.role !== 'admin') redirect('/login')     // chỉ điều khiển UI nào được vẽ

  return (
    <form action={async () => {
      'use server'
      const user = await getCurrentUser()             // ← BẮT BUỘC kiểm tra lại
      if (user?.role !== 'admin') throw new Error('FORBIDDEN')
      await deleteAllRecords()
    }}>
      <button>Xoá tất cả</button>
    </form>
  )
}
```

Dòng `redirect` ở trên quyết định **giao diện nào được render**. Action là **điểm vào riêng biệt** — nó không đi qua đoạn kiểm tra đó.

Điều tương tự với `proxy.ts`: Server Action là POST tới chính URL của trang, nên một thay đổi `matcher` hoặc việc chuyển action sang route khác có thể âm thầm gỡ mất lớp proxy.

---

## 5. Kiểm soát giá trị trả về

Giá trị Server Action trả về được serialize và **gửi xuống client**.

```ts
// ❌ Trả cả bản ghi
export async function updateUser(data: FormData) {
  return db.user.update({ where: { id }, data: { name } })
  // → client nhận cả password_hash, refreshToken, internalNotes...
}

// ✅
export async function updateUser(data: FormData) {
  await db.user.update({ where: { id }, data: { name } })
  return { success: true }
}
```

Kiểm tra: mở tab Network, submit form, xem response của request POST. Thấy trường nào lạ là bạn đang rò rỉ.

---

## 6. CSRF và `allowedOrigins`

Server Action chỉ nhận `POST`, và Next.js tự so `Origin` với `Host`. Cùng với cookie `SameSite=lax` bạn đã đặt, phần lớn CSRF đã bị chặn.

Nhưng khi có reverse proxy, `Host` mà Next.js thấy có thể khác domain thật:

```
Error: `x-forwarded-host` header with value `blog.vanson.dev` does not match
`origin` header with value `localhost:3001` from a forwarded Server Actions request.
```

```js
// next.config.js
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['blog.vanson.dev', '*.vanson.dev'],
    },
  },
}
```

Đồng thời cấu hình nginx chuyển đúng header:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

> ⚠️ Đừng "sửa" lỗi này bằng cách cho `allowedOrigins: ['*']`. Bạn vừa tắt lớp chống CSRF.

---

## 7. Content Security Policy

CSP là hàng rào cuối chống XSS. Với Next.js cần nonce vì có script inline.

```ts
// src/proxy.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://images.unsplash.com`,
    `font-src 'self'`,
    `connect-src 'self' ${process.env.NEXT_PUBLIC_WS_URL ?? ''}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
```

```tsx
// app/layout.tsx
import { headers } from 'next/headers'

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="vi">
      <body>
        {children}
        <script nonce={nonce} />
      </body>
    </html>
  )
}
```

Kiểm chứng:

```bash
$ curl -sI localhost:3001/posts | grep -i content-security
content-security-policy: default-src 'self'; script-src 'self' 'nonce-YzRhOGI...
```

Vi phạm hiện ở console trình duyệt:

```
Refused to load the script 'https://evil.com/x.js' because it violates the
following Content Security Policy directive: "script-src 'self' 'nonce-...'".
```

> ⚠️ **CSP có nonce làm trang không cache được** (mỗi request một nonce). Nếu site chủ yếu là nội dung tĩnh, cân nhắc CSP không nonce với `script-src 'self'`, hoặc chỉ áp nonce cho các route đã động sẵn.

Còn `matcher` với `missing` là để bỏ qua request prefetch — nếu không, mỗi lần hover một link là sinh một nonce mới vô ích.

### Các header khác

```js
// next.config.js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ],
    },
  ]
}
```

`X-Frame-Options` không cần — `frame-ancestors 'none'` trong CSP đã thay thế.

---

## 8. Rate limiting

Server Action và Route Handler đều gọi được trực tiếp. Việc tốn kém phải có giới hạn.

```ts
// src/lib/rate-limit.ts
import 'server-only'
import { createClient } from 'redis'

let client: ReturnType<typeof createClient>
async function redis() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL })
    await client.connect()
  }
  return client
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const r = await redis()
    const k = `rl:${key}`

    const count = await r.incr(k)
    if (count === 1) await r.expire(k, windowSec)

    return { ok: count <= limit, remaining: Math.max(0, limit - count) }
  } catch {
    return { ok: true, remaining: limit }   // Redis chết → cho qua, đừng chặn hết người dùng
  }
}
```

```ts
// app/(auth)/actions.ts
'use server'

import { headers } from 'next/headers'
import { rateLimit } from '@/lib/rate-limit'

export async function login(prevState: AuthState, formData: FormData): Promise<AuthState> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const email = String(formData.get('email') ?? '')

  // Giới hạn theo CẢ ip lẫn email — chống dò mật khẩu từ nhiều IP
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 10, 300),
    rateLimit(`login:email:${email}`, 5, 300),
  ])

  if (!byIp.ok || !byEmail.ok) {
    return { message: 'Bạn thử quá nhiều lần. Vui lòng đợi 5 phút.' }
  }

  // ... phần đăng nhập
}
```

Cần giới hạn cho: đăng nhập, đăng ký, quên mật khẩu, gửi email, upload file, xuất dữ liệu, gọi API tính phí.

> ⚠️ `x-forwarded-for` **do client gửi lên, có thể giả**. Chỉ tin nó khi reverse proxy của bạn ghi đè header đó (`proxy_set_header X-Forwarded-For $remote_addr;`). Không có proxy tin cậy thì đừng dùng IP làm khoá duy nhất.

---

## 9. Không cache dữ liệu riêng của người dùng

Lỗi nghiêm trọng nhất, đã nêu ở [bài 06 cơ bản](<../06-auth-jwt.md#10-không-cache-dữ-liệu-riêng-của-user>), nhắc lại vì nó xuất hiện dưới nhiều hình thức:

| Chỗ dễ dính | Cách đúng |
|---|---|
| `fetch` có `Authorization` | `cache: 'no-store'` |
| `use cache` cho dữ liệu theo user | Truyền `userId` làm tham số → vào cache key |
| CDN cache trang có dữ liệu cá nhân | Để CDN đọc `Cache-Control` từ Next.js |
| `unstable_cache` với khoá không có userId | Thêm userId vào mảng khoá |

Test hồi quy, chạy trước mỗi lần release:

```bash
# 1. Đăng nhập user A, lưu cookie
$ curl -s -c /tmp/a.txt -X POST localhost:3001/login \
    -d 'email=a@blog.test&password=12345678' > /dev/null

# 2. Gọi trang cá nhân với cookie A
$ curl -s -b /tmp/a.txt localhost:3001/dashboard | grep -o 'Xin chào[^<]*'
Xin chào, User A

# 3. Gọi CÙNG URL không có cookie — phải KHÔNG thấy tên A
$ curl -s localhost:3001/dashboard | grep -o 'Xin chào[^<]*'
                    ← rỗng = an toàn
```

Bước 3 trả về "Xin chào, User A" nghĩa là bạn đang phục vụ trang đã cache của người khác.

---

## 10. Danh sách audit

Đây là danh sách tài liệu Next.js khuyên dùng khi audit, có bổ sung:

**Thư mục `data/` (DAL)**
```
[ ] Mọi file có import 'server-only'
[ ] Kiểm tra quyền nằm cùng chỗ với truy vấn
[ ] Trả DTO, không trả entity thô
[ ] process.env chỉ xuất hiện ở đây và lib/env.ts
```

**File có `'use client'`**
```
[ ] Props có nhận dữ liệu riêng tư không?
[ ] Kiểu props có quá rộng không (nhận cả `User` thay vì `{ name: string }`)?
[ ] Không import từ data/ (server-only sẽ chặn)
```

**File có `'use server'`**
```
[ ] Mỗi action có kiểm tra ĐĂNG NHẬP
[ ] Mỗi action có kiểm tra QUYỀN SỞ HỮU bản ghi
[ ] Đầu vào được validate bằng Zod
[ ] Giá trị trả về chỉ chứa thứ client cần
[ ] Việc tốn kém có rate limit
```

**Thư mục `[param]`**
```
[ ] params được validate (là số? thuộc tập cho phép?)
[ ] Không dùng thẳng params để dựng câu truy vấn
```

**`proxy.ts` và `route.ts`**
```
[ ] matcher không vô tình bỏ sót route cần bảo vệ
[ ] Route Handler có kiểm tra auth (proxy KHÔNG đủ)
[ ] Webhook có xác minh chữ ký
```

**Cấu hình**
```
[ ] Không có NEXT_PUBLIC_ nào chứa secret
[ ] Cookie: httpOnly + secure + sameSite
[ ] CSP đã đặt, có nonce
[ ] allowedOrigins đúng domain, không phải '*'
[ ] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY cố định khi chạy nhiều instance
```

Ba câu lệnh kiểm tra tự động:

```bash
# 1. Secret có lọt xuống bundle không
$ npm run build && grep -rE "SECRET|PASSWORD|PRIVATE_KEY|_TOKEN" .next/static/ | head
                                          ← phải rỗng

# 2. File data/ nào quên server-only
$ grep -rL "server-only" src/data/*.ts
                                          ← phải rỗng

# 3. Action nào quên kiểm tra đăng nhập
$ grep -rL "getCurrentUser\|requireUser" src/app/**/actions.ts
                                          ← xem từng file còn lại, có lý do chính đáng không
```

---

## 11. Webhook: xác minh chữ ký

Route Handler nhận webhook là endpoint mở với cả thế giới.

```ts
// app/api/webhooks/payment/route.ts
import crypto from 'node:crypto'

export async function POST(request: Request) {
  const signature = request.headers.get('x-signature')
  if (!signature) {
    return Response.json({ error: 'Thiếu chữ ký' }, { status: 401 })
  }

  // Đọc raw body TRƯỚC khi parse — chữ ký tính trên chuỗi gốc
  const raw = await request.text()

  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(raw)
    .digest('hex')

  // So sánh thời gian hằng định — chống timing attack
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected),
  )

  if (!valid) {
    console.warn('[webhook] chữ ký sai từ', request.headers.get('x-forwarded-for'))
    return Response.json({ error: 'Chữ ký không hợp lệ' }, { status: 401 })
  }

  const event = JSON.parse(raw)
  // ... xử lý

  return Response.json({ received: true })
}
```

Ba chi tiết:

- **`request.text()` trước, `JSON.parse` sau.** Parse rồi stringify lại sẽ đổi thứ tự khoá hoặc khoảng trắng → chữ ký không khớp.
- **`timingSafeEqual`**, không phải `===`. So sánh chuỗi thường thoát sớm ở byte đầu khác nhau, để lộ thông tin qua thời gian.
- **`timingSafeEqual` ném lỗi nếu hai buffer khác độ dài** — bọc `try/catch` hoặc kiểm tra độ dài trước.

---

## Bài tập

1. Viết một page truyền cả entity `User` xuống Client Component. Chạy `curl | grep password` và xác nhận rò rỉ. Sửa bằng DTO.
2. Bật `experimental.taint`, taint object `User`. Cố truyền xuống Client Component và chép lại lỗi.
3. Viết `deletePostAction` **thiếu** bước kiểm tra quyền sở hữu. Đăng nhập user thường, gọi thẳng action bằng `fetch` trong DevTools với id bài của người khác. Xác nhận xoá được. Rồi sửa.
4. Trả cả bản ghi từ một Server Action, xem response trong tab Network và chỉ ra trường nào không nên có.
5. Đặt `allowedOrigins` sai để gặp lỗi `x-forwarded-host does not match origin`. Chép lại.
6. Cài CSP có nonce. Chép lại header bằng `curl -sI`. Chèn `<script src="https://evil.com/x.js">` và chép lại lỗi ở console.
7. Viết `rateLimit` với Redis. Gọi đăng nhập sai 6 lần liên tiếp và xác nhận bị chặn ở lần thứ 6.
8. Tắt Redis rồi đăng nhập — xác nhận vẫn vào được (fail-open), không phải lỗi 500.
9. Chạy đủ 3 bước test cache ở mục 9. Cố tình đặt `revalidate` cho `/auth/me` để tái hiện rò rỉ.
10. Chạy 3 câu lệnh audit ở mục 10 trên dự án của bạn. Ghi lại kết quả.
11. Viết webhook có xác minh HMAC. Gửi request với chữ ký sai và chép lại 401. Thử `JSON.parse` rồi `stringify` lại trước khi tính chữ ký để thấy nó hỏng.

Tiếp theo 👉 [09-testing.md](<./09-testing.md>)
