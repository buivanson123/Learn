# Bài 1 (NC) — Cache Components & `use cache`

Ở [bài 03](<../03-lay-du-lieu-va-cache.md>) tôi đã khuyên chưa bật `cacheComponents`. Giờ là lúc bật.

## 1. Vấn đề mà nó giải quyết

Trang chi tiết bài viết của bạn có 2 phần:

```
┌────────────────────────────────────┐
│ Header, nav, nội dung bài viết     │  ← giống nhau với mọi người
│                                    │
│ "Xin chào Vanson" · nút Sửa        │  ← khác nhau theo từng người
└────────────────────────────────────┘
```

Với mô hình cũ, chỉ cần **một** lời gọi `cookies()` ở đâu đó là **cả trang** thành động. Kiểm chứng — thêm `<Header />` (có `getCurrentUser()`) vào layout rồi build:

```
Route (app)
├ ƒ /posts                    ← trước đây là ○
├ ƒ /posts/[slug]             ← trước đây là ●
```

Bạn mất sạch prerender chỉ vì một dòng chữ "Xin chào". Đây là hạn chế cốt lõi của mô hình cũ: **tính động lây lan lên toàn bộ route**.

Cache Components sửa đúng chỗ này. Phần tĩnh vẫn được prerender, phần động chảy vào sau qua `<Suspense>`. Cơ chế đó tên là **Partial Prerendering (PPR)** — và ở Next.js 16 nó là hành vi mặc định khi bật `cacheComponents`.

---

## 2. Bật lên

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

> ⚠️ Đây **không phải** đổi tên cờ. Bật xong build sẽ fail ở mọi chỗ có dữ liệu không cache nằm ngoài `<Suspense>`. Đó là chủ ý: Next.js ép bạn khai báo rõ từng mẩu dữ liệu thuộc loại nào.

Chạy `npm run build` ngay sau khi bật, bạn sẽ gặp hàng loạt lỗi kiểu này:

```
Error: Route "/posts": A component accessed data without a Suspense boundary
above it, and without a cache directive. This prevents the route from
producing a static shell.

  ╭─[src/app/posts/page.tsx:6:1]
6 │   const { items } = await getPosts()
  ·                     ─────────────────

Fix: cache the read with "use cache", or wrap the component in <Suspense>.
```

Mỗi lỗi là một quyết định bạn phải đưa ra. Chỉ có 3 lựa chọn cho mỗi mẩu dữ liệu.

---

## 3. Ba lựa chọn cho mỗi mẩu dữ liệu

```
Dữ liệu này thế nào?
│
├─ Giống nhau với mọi người, đổi theo thời gian
│   └─ 'use cache' + cacheLife(...)         → vào static shell
│
├─ Khác nhau theo từng người (cookies/headers/searchParams)
│   └─ <Suspense> bọc lại                   → chảy vào lúc request
│
└─ Không đổi bao giờ (import, hằng số, đọc file config)
    └─ để nguyên                            → tự vào static shell
```

Áp vào trang chi tiết bài viết:

```tsx
// app/posts/[slug]/page.tsx
import { Suspense } from 'react'
import { cacheLife, cacheTag } from 'next/cache'
import { cookies } from 'next/headers'

export default function PostPage(props: PageProps<'/posts/[slug]'>) {
  return (
    <article>
      {/* Tĩnh hoàn toàn — vào shell */}
      <nav>
        <a href="/">Trang chủ</a> · <a href="/posts">Bài viết</a>
      </nav>

      {/* Cached — cũng vào shell */}
      <PostContent params={props.params} />

      {/* Động — chảy vào sau */}
      <Suspense fallback={<div className="h-8 animate-pulse bg-gray-100" />}>
        <UserActions params={props.params} />
      </Suspense>
    </article>
  )
}

async function PostContent({ params }: { params: Promise<{ slug: string }> }) {
  'use cache'
  cacheLife('days')

  const { slug } = await params
  cacheTag(`post-${slug}`)

  const post = await getPost(slug)
  return (
    <>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </>
  )
}

async function UserActions({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser()      // đọc cookie — chỉ được ở đây
  if (!user) return <a href="/login">Đăng nhập để bình luận</a>
  return <button>Sửa bài</button>
}
```

Build:

```
Route (app)
└ ◐ /posts/[slug]                         1d      1w

◐  (Partial Prerender)  static shell + dynamic holes streamed at request time
```

Người dùng nhận nội dung bài viết **tức thì từ CDN**, phần "Sửa bài" chảy vào sau vài chục mili giây.

---

## 4. `cacheLife` — bảng hồ sơ có sẵn

Đây là bảng bạn sẽ tra nhiều nhất:

| Hồ sơ | Dùng cho | `stale` (client) | `revalidate` (server) | `expire` |
|---|---|---|---|---|
| `default` | Mặc định khi không khai báo | 5 phút | 15 phút | không bao giờ |
| `seconds` | Dữ liệu thời gian thực | 30 giây | 1 giây | 1 phút |
| `minutes` | Cập nhật liên tục (feed, tin tức) | 5 phút | 1 phút | 1 giờ |
| `hours` | Vài lần mỗi ngày (tồn kho) | 5 phút | 1 giờ | 1 ngày |
| `days` | Mỗi ngày (bài blog) | 5 phút | 1 ngày | 1 tuần |
| `weeks` | Mỗi tuần | 5 phút | 1 tuần | 30 ngày |
| `max` | Gần như không đổi (trang pháp lý) | 5 phút | 30 ngày | 1 năm |

Ba con số nghĩa là gì:

- **`stale`** — trình duyệt dùng bản trong bộ nhớ bao lâu mà không hỏi server. Ảnh hưởng tốc độ chuyển trang.
- **`revalidate`** — sau khoảng này, request kế tiếp vẫn nhận bản cũ **ngay lập tức**, đồng thời server dựng lại ở nền.
- **`expire`** — quá lâu không ai truy cập, request kế tiếp phải **chờ** dựng mới.

```tsx
async function BlogPosts() {
  'use cache'
  cacheLife('days')
  cacheTag('posts')

  const res = await fetch(`${API}/posts`)
  return <PostList posts={(await res.json()).data.items} />
}
```

> **Luôn khai báo `cacheLife` trong mọi `use cache`.** Bỏ qua thì hồ sơ `default` được áp dụng ngầm, và khi lồng nhau bạn sẽ không đoán nổi thời hạn thật là bao nhiêu (mục 7).

### Hồ sơ riêng

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    baiviet: {
      stale: 600,        // 10 phút
      revalidate: 3600,  // 1 giờ
      expire: 86400,     // 1 ngày
    },
  },
}
```

```tsx
cacheLife('baiviet')     // TypeScript tự gợi ý, có cả JSDoc hiện giá trị
```

Thuộc tính nào không khai sẽ kế thừa từ `default`.

### Ngưỡng cần nhớ

| Điều kiện | Hậu quả |
|---|---|
| `revalidate: 0` hoặc `expire` < 5 phút | **Bị loại khỏi prerender**, thành lỗ động |
| `stale` < 30 giây | Bị loại khỏi prerender (prefetch sẽ hết hạn trước khi người dùng kịp bấm) |
| `stale` 30 giây – 5 phút | Vào prerender nhưng không vào App Shell |

Trong các hồ sơ có sẵn, chỉ `seconds` vướng ngưỡng này (`expire` 1 phút). Nên đừng ngạc nhiên khi `cacheLife('seconds')` không được prerender — đó là đúng thiết kế.

---

## 5. Ràng buộc: không đọc runtime API trong `use cache`

```tsx
async function Header() {
  'use cache'
  const cookieStore = await cookies()    // ❌
  return <div>{cookieStore.get('theme')?.value}</div>
}
```

```
Error: Route "/": A `use cache` function accessed `cookies()`.
https://nextjs.org/docs/messages/next-request-in-use-cache
```

Ràng buộc này **lan theo call stack** — một hàm phụ trợ mà `use cache` gọi vào, nếu nó đọc cookie, cũng hỏng y hệt.

> ⚠️ Cạm bẫy vận hành: trên route render động, lỗi này **chỉ xuất hiện lúc chạy**, nên nó qua được `next build` rồi mới nổ dưới `next start`. Test kỹ với `npm run build && npm start`, đừng chỉ tin `next dev`.

### Cách đúng: đọc ngoài, truyền vào

```tsx
export default function Page() {
  return (
    <Suspense fallback={<Skeleton />}>
      <ProfileContent />
    </Suspense>
  )
}

// Không cache — đọc runtime API
async function ProfileContent() {
  const session = (await cookies()).get('session')?.value
  return <CachedProfile sessionId={session} />
}

// Có cache — nhận giá trị đã bóc ra làm tham số
async function CachedProfile({ sessionId }: { sessionId: string }) {
  'use cache'
  cacheLife('minutes')
  const data = await fetchUserData(sessionId)   // sessionId thành một phần cache key
  return <div>{data.name}</div>
}
```

`sessionId` trở thành một phần của **cache key**, nên mỗi phiên có entry riêng — không lẫn dữ liệu.

### Lỗi build treo 50 giây

Có một biểu hiện lỗi rất khó hiểu, đáng nhận diện trước:

```
Error: Filling a cache during prerender timed out, likely because
request-specific arguments such as params, searchParams, cookies() or
uncached data were used inside "use cache".
```

Build đứng im rồi báo lỗi này nghĩa là bạn truyền một **Promise chưa resolve** của dữ liệu runtime vào trong `use cache`:

```tsx
// ❌ Build treo
async function Dynamic() {
  const cookieStore = cookies()          // không await
  return <Cached promise={cookieStore} />
}

async function Cached({ promise }) {
  'use cache'
  const data = await promise             // chờ dữ liệu runtime lúc build → treo
}
```

Sửa: `await` ở component ngoài, truyền **giá trị** chứ không phải Promise.

---

## 6. Cache key được tính thế nào

Hiểu chỗ này để không bị "cache không ăn" hoặc "cache lẫn dữ liệu".

Khoá gồm 4 thành phần:

1. **Build ID** — mỗi lần deploy mới là cache sạch hoàn toàn.
2. **Function ID** — hash vị trí + chữ ký hàm trong mã nguồn.
3. **Tham số serialize được** — props (với component) hoặc arguments (với hàm).
4. **HMR hash** — chỉ ở môi trường dev.

Điểm dễ bỏ sót: **biến closure cũng tự động thành tham số**.

```tsx
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'
    // cache key gồm CẢ userId (từ closure) LẪN filter (tham số)
    return fetch(`/api/users/${userId}/data?filter=${filter}`)
  }
  return getData('active')
}
```

Đây vừa là tính năng vừa là bẫy: vô tình đóng gói một biến lớn hoặc đổi liên tục vào closure sẽ khiến cache không bao giờ trúng.

### Kiểu dữ liệu được phép

| | Tham số | Giá trị trả về |
|---|---|---|
| Số, chuỗi, boolean, null, undefined | ✅ | ✅ |
| Object thường, mảng | ✅ | ✅ |
| Date, Map, Set, TypedArray | ✅ | ✅ |
| JSX | chỉ pass-through | ✅ |
| **Instance của class** | ❌ | ❌ |
| **Hàm** | chỉ pass-through | ❌ |
| **URL instance** | ❌ | ❌ |

```tsx
async function UserProfile({ user }: { user: UserClass }) {
  'use cache'
  return <div>{user.name}</div>
}
```

```
Error: Cannot serialize class instance passed to a "use cache" function.
```

Đây là lý do thực dụng để DAL của bạn trả về **object thường** chứ không phải entity của ORM.

### Pass-through: `children` không ảnh hưởng cache

```tsx
async function CachedWrapper({ children }: { children: ReactNode }) {
  'use cache'
  cacheLife('hours')
  // KHÔNG đọc, KHÔNG sửa children — chỉ chuyển tiếp
  return (
    <div className="wrapper">
      <header>Header đã cache</header>
      {children}
    </div>
  )
}

export default function Page() {
  return (
    <CachedWrapper>
      <DynamicComponent />     {/* không bị cache, đi xuyên qua */}
    </CachedWrapper>
  )
}
```

Miễn bạn không **đọc** `children` trong thân hàm, nó không tham gia cache key. Đây là mẫu quan trọng để trộn tĩnh và động.

---

## 7. Lồng `use cache` — quy tắc phải nhớ

**Có `cacheLife` tường minh ở ngoài** → ngoài dùng thời hạn của chính nó, bất kể trong là bao nhiêu.

**Không có `cacheLife` ở ngoài** → hồ sơ `default` (15 phút), và cache trong **ngắn hơn sẽ kéo ngắn** cache ngoài; cache trong dài hơn thì không kéo dài được.

Trường hợp nguy hiểm nhất: cache trong ngắn hạn lồng trong cache ngoài không khai báo. Next.js chặn thẳng lúc build:

```tsx
// components/widget.tsx
export async function ShortLivedWidget() {
  'use cache'
  cacheLife('seconds')
  return <div>{await fetchRealtimeData()}</div>
}
```

```tsx
// app/page.tsx
export default async function Page() {
  'use cache'
  // không có cacheLife
  return <><h1>Dashboard</h1><ShortLivedWidget /></>
}
```

```
Error: A short-lived "use cache" was nested inside a "use cache" without an
explicit cacheLife. This would silently shorten the outer cache lifetime.
Add an explicit cacheLife() to the outer cache.
```

Vì sao Next.js bắt lỗi thay vì im lặng: cache lồng nhau có thể nằm trong một module bạn không viết, thậm chí trong package của bên thứ ba. Thời hạn cache ngoài bị rút ngắn âm thầm là loại bug gần như không thể debug.

Cách sửa — chọn một trong hai và nói rõ ý định:

```tsx
// Muốn ngoài vẫn tĩnh
cacheLife('default')

// Muốn ngoài cũng ngắn hạn — bọc Suspense
<Suspense fallback={<p>Đang tải...</p>}><Content /></Suspense>
```

---

## 8. `use cache: private` và `use cache: remote`

Hai biến thể cho tình huống đặc thù.

### `use cache: remote`

Mặc định `use cache` lưu **trong RAM của từng instance**. Trên serverless, mỗi request có thể rơi vào instance khác nhau → cache gần như không trúng.

```tsx
async function ExpensiveReport() {
  'use cache: remote'          // lưu ở kho dùng chung (Redis/KV)
  cacheLife('hours')
  return <Report data={await heavyQuery()} />
}
```

Đánh đổi: thêm một vòng mạng để kiểm tra cache. **Chỉ đáng khi tỉ lệ trúng cache cao.** Truy vấn ít lặp lại thì bạn trả tiền mạng mà không được gì.

Bảng so sánh nơi lưu:

| Nơi | Ai giữ | Sống qua request? | Sống qua deploy? |
|---|---|---|---|
| HTML prerender | Đĩa / CDN | ✅ | ❌ |
| `use cache` mặc định | RAM từng instance | Self-host ✅ · Serverless ❌ | ❌ |
| `use cache: remote` | Cache handler dùng chung | ✅ | ❌ |
| `use cache: private` | Trình duyệt người dùng | ✅ | ❌ |

**Không có gì sống qua deploy** — vì Build ID nằm trong cache key. Cần bền hơn thì dùng `unstable_cache` hoặc cache của `fetch`.

### `use cache: private`

Cho phép hàm đọc thẳng `cookies()`/`headers()` và cache kết quả **ở trình duyệt của chính người đó**. Dùng khi bạn không thể refactor để truyền giá trị vào làm tham số.

Đây là API mới, ít tài liệu thực chiến. Ưu tiên mẫu "bóc giá trị ra rồi truyền vào" ở mục 5 trước.

---

## 9. Áp vào Blog: chuyển đổi từng bước

Đừng bật `cacheComponents` rồi sửa cả dự án trong một lần. Làm theo thứ tự này:

**Bước 1 — bật cờ, chạy build, chép hết lỗi ra giấy.**

```bash
$ npm run build 2>&1 | grep -A2 "Error: Route"
```

**Bước 2 — phân loại từng lỗi vào một trong ba nhóm** (mục 3). Đây là phần cần suy nghĩ, không phải phần gõ code.

**Bước 3 — sửa từ lá lên gốc.** Component sâu nhất trước, layout gốc sau cùng.

**Bước 4 — kiểm tra bằng bảng build.** Mục tiêu là hầu hết route mang ký hiệu `◐`:

```
Route (app)
┌ ◐ /                                     1d      1w
├ ◐ /posts                                1h      1d
├ ◐ /posts/[slug]                         1d      1w
└ ƒ /dashboard
```

`/dashboard` là `ƒ` thì đúng — toàn bộ nội dung của nó đều cá nhân hoá, không có gì để prerender.

**Bước 5 — bật log cache để xác nhận trúng/trượt:**

```bash
$ NEXT_PRIVATE_DEBUG_CACHE=1 npm start
```

```
[cache] MISS  post-hoc-nextjs   (dựng mới, 187ms)
[cache] HIT   post-hoc-nextjs   (0.4ms)
[cache] STALE post-hoc-nextjs   (trả bản cũ, dựng lại ở nền)
```

Ba dòng này là bằng chứng cache hoạt động. Thấy toàn `MISS` nghĩa là cache key đang đổi mỗi request — quay lại mục 6.

---

## 10. Khi nào **không** nên bật

Thẳng thắn: `cacheComponents` không phải lúc nào cũng đáng.

| Tình huống | Nên bật? |
|---|---|
| Blog, trang tin, thương mại điện tử — nhiều nội dung chung | ✅ Rất đáng |
| Dashboard nội bộ, mọi trang đều sau đăng nhập | ❌ Gần như không có gì để prerender |
| Dự án đang gấp deadline | ❌ Chi phí chuyển đổi thật, không nhỏ |
| Hạ tầng không hỗ trợ streaming | ❌ Mất hết lợi thế TTFB của PPR (xem [bài 05](<./05-cache-nhieu-tang.md>)) |

Điểm cuối quan trọng mà nhiều người bỏ qua: PPR **cần streaming end-to-end**. Nếu nginx hay load balancer của bạn buffer response, shell tĩnh và phần động sẽ về cùng lúc sau khi render xong hết — bạn được đúng con số 0 lợi ích.

---

## Bài tập

1. Bật `cacheComponents`, chạy `npm run build`, chép lại **toàn bộ** lỗi. Đếm xem có bao nhiêu.
2. Phân loại từng lỗi vào 3 nhóm ở mục 3 trước khi gõ một dòng code nào.
3. Chuyển `/posts/[slug]` sang PPR: nội dung bài `use cache` + `cacheLife('days')`, phần nút Sửa bọc `<Suspense>`. Xác nhận bảng build hiện `◐`.
4. Cố tình gọi `cookies()` trong `use cache`, chép lại lỗi `next-request-in-use-cache`.
5. Lồng `cacheLife('seconds')` vào một `use cache` không khai báo `cacheLife` để gặp lỗi build. Sửa bằng cả 2 cách ở mục 7.
6. Truyền một instance class vào hàm `use cache`, chép lại lỗi serialize.
7. Chạy `NEXT_PRIVATE_DEBUG_CACHE=1 npm start`, tải một trang 3 lần và chép lại chuỗi `MISS` → `HIT` → `HIT`.
8. Đặt `cacheLife('seconds')` cho một component rồi build — xác nhận nó **không** vào prerender, và giải thích tại sao (gợi ý: bảng ngưỡng mục 4).

Tiếp theo 👉 [02-co-che-render.md](<./02-co-che-render.md>)
