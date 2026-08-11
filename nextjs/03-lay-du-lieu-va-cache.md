# Bài 3 — Lấy dữ liệu, cache và streaming

## 1. Lấy dữ liệu: chỉ cần `await`

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  const res = await fetch('http://localhost:3000/api/posts')
  const { data } = await res.json()

  return <ul>{data.items.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

Không `useEffect`, không `useState`, không thư viện. Component là `async`, bạn `await` thẳng.

### Xử lý lỗi cho tử tế

`fetch` **không throw khi server trả 404 hay 500** — nó chỉ throw khi mất mạng. Phải tự kiểm tra:

```ts
// src/lib/api.ts
const API = process.env.API_URL ?? 'http://localhost:3000/api'

export async function getPosts(page = 1, limit = 10) {
  const res = await fetch(`${API}/posts?page=${page}&limit=${limit}`)

  if (!res.ok) {
    throw new Error(`GET /posts trả ${res.status} ${res.statusText}`)
  }

  const json = await res.json()
  return json.data
}
```

Quên `if (!res.ok)` thì khi API trả 500, `res.json()` sẽ vấp phải HTML trang lỗi và bạn nhận thông báo khó hiểu:

```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

Kiểm tra `res.ok` cho lỗi rõ ràng hơn nhiều:

```
Error: GET /posts trả 500 Internal Server Error
    at getPosts (src/lib/api.ts:8:11)
```

---

## 2. Mặc định: `fetch` KHÔNG được cache

Đây là thay đổi lớn so với Next.js 13/14 (khi đó `fetch` cache mặc định). Từ Next.js 15 trở đi:

```tsx
await fetch(url)                              // gọi lại mỗi request
await fetch(url, { cache: 'force-cache' })    // cache, dùng lại mãi
await fetch(url, { next: { revalidate: 60 } })// cache 60 giây
```

Kiểm chứng bằng thực nghiệm. Thêm log vào Blog API hoặc đơn giản là đếm ở phía Next:

```tsx
// app/posts/page.tsx
export default async function Page() {
  console.log('[fetch] gọi lúc', new Date().toLocaleTimeString())
  const res = await fetch('http://localhost:3000/api/posts')
  // ...
}
```

F5 ba lần, mỗi lần cách nhau vài giây:

```
[fetch] gọi lúc 09:20:01
[fetch] gọi lúc 09:20:04
[fetch] gọi lúc 09:20:07      ← gọi lại mỗi lần: không cache
```

Đổi thành `{ next: { revalidate: 60 } }` rồi F5 ba lần:

```
[fetch] gọi lúc 09:21:10
                              ← lần 2: không in gì, dùng cache
                              ← lần 3: không in gì
```

> ⚠️ **Trong `next dev`, trang luôn render lại mỗi request** để bạn thấy thay đổi ngay. Cache dữ liệu (`fetch`) vẫn hoạt động, nhưng cache trang (prerender) thì không. Muốn kiểm tra hành vi thật, phải `npm run build && npm start`.

### Ba lựa chọn, chọn cái nào

| Loại dữ liệu | Cách viết | Ví dụ ở Blog |
|---|---|---|
| Đổi liên tục, phải mới | `fetch(url)` (mặc định) | Giỏ hàng, thông báo |
| Đổi thỉnh thoảng | `{ next: { revalidate: 60 } }` | Danh sách bài viết |
| Gần như không đổi | `{ cache: 'force-cache' }` | Danh mục, tag |

```ts
export async function getCategories() {
  const res = await fetch(`${API}/categories`, {
    cache: 'force-cache',          // danh mục hiếm khi đổi
    next: { tags: ['categories'] } // gắn nhãn để xoá cache chủ động
  })
  return (await res.json()).data
}
```

---

## 3. Cache tự động dedupe trong cùng một lần render

Gọi `fetch` cùng URL nhiều lần trong một request → Next.js chỉ gọi mạng **một lần**:

```tsx
// app/posts/[slug]/page.tsx
async function getPost(slug: string) {
  const res = await fetch(`${API}/posts/slug/${slug}`)
  return (await res.json()).data
}

// Dùng ở generateMetadata
export async function generateMetadata(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)          // gọi lần 1
  return { title: post.title }
}

// Và dùng lại ở page
export default async function Page(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)          // gọi lần 2
  return <h1>{post.title}</h1>
}
```

Log ở Blog API chỉ hiện **một** dòng:

```
[Nest] LOG [PostsController] GET /api/posts/slug/hoc-nextjs
```

Nhờ vậy bạn không cần "nâng dữ liệu lên component cha rồi truyền props xuống" — cứ gọi ở đúng nơi cần.

### Không dùng `fetch` thì sao — `cache()` của React

Gọi database hoặc SDK thì không có cơ chế dedupe sẵn. Bọc bằng `cache` của React:

```ts
import { cache } from 'react'
import { db } from '@/lib/db'

export const getUser = cache(async (id: number) => {
  console.log('[db] truy vấn user', id)
  return db.user.findUnique({ where: { id } })
})
```

Gọi `getUser(1)` ba lần trong một request:

```
[db] truy vấn user 1        ← chỉ một dòng
```

---

## 4. Song song vs tuần tự

Đây là chỗ dễ làm trang chậm gấp đôi mà không nhận ra.

```tsx
// ❌ Tuần tự: 300ms + 250ms = 550ms
const post = await getPost(slug)
const categories = await getCategories()
```

```tsx
// ✅ Song song: max(300ms, 250ms) = 300ms
const [post, categories] = await Promise.all([
  getPost(slug),
  getCategories(),
])
```

Đo bằng chính terminal của Next.js:

```
 GET /posts/hoc-nextjs 200 in 561ms     ← tuần tự
 GET /posts/hoc-nextjs 200 in 312ms     ← song song
```

Chỉ dùng tuần tự khi request sau **cần kết quả** của request trước:

```tsx
const post = await getPost(slug)
const author = await getUser(post.authorId)   // buộc phải chờ post
```

---

## 5. Streaming với `<Suspense>`

Vấn đề: một API chậm làm cả trang chờ.

```tsx
export default async function Page() {
  const post = await getPost(slug)         // 100ms
  const comments = await getComments(slug) // 2000ms  ← cả trang chờ 2.1s
  return <>...</>
}
```

Giải pháp: tách phần chậm ra component riêng, bọc `<Suspense>`.

```tsx
// app/posts/[slug]/page.tsx
import { Suspense } from 'react'
import { getPost, getComments } from '@/lib/api'

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>

      <Suspense fallback={<p className="text-gray-400">Đang tải bình luận...</p>}>
        <Comments slug={slug} />
      </Suspense>
    </article>
  )
}

// Component chậm — tự lo việc lấy dữ liệu của mình
async function Comments({ slug }: { slug: string }) {
  const comments = await getComments(slug)
  return (
    <ul className="mt-6 space-y-2">
      {comments.map((c) => (
        <li key={c.id}><b>{c.author.name}</b>: {c.content}</li>
      ))}
    </ul>
  )
}
```

Kết quả người dùng thấy:

```
t=0.1s   Tiêu đề + nội dung bài đã hiện
         "Đang tải bình luận..."
t=2.1s   Bình luận thay vào chỗ đó
```

Xem trực tiếp bằng `curl` — HTML về theo từng đợt:

```bash
$ curl -N localhost:3001/posts/hoc-nextjs
<article><h1>Học Next.js</h1><div>...</div>
<p class="text-gray-400">Đang tải bình luận...</p>
      ← (dừng ở đây 2 giây)
<div hidden id="S:0"><ul class="mt-6 space-y-2"><li>...</li></ul></div>
<script>$RC("B:0","S:0")</script>       ← script tráo nội dung thật vào chỗ fallback
```

Đó chính là streaming: server gửi HTML dần dần thay vì chờ đủ mới gửi.

### Quy tắc dùng Suspense

- Component bọc trong `<Suspense>` **phải tự `await`** dữ liệu của nó. Nếu bạn `await` ở component cha rồi truyền props xuống, cha vẫn bị chặn — Suspense vô nghĩa.
- `loading.tsx` (bài [01](./01-app-router.md#7-loadingtsx--ui-chờ-tự-động)) chính là `<Suspense>` bọc quanh cả page. Dùng `<Suspense>` thủ công khi chỉ muốn bọc một phần.

---

## 6. Sinh trang tĩnh với `generateStaticParams`

Với route động, bạn có thể bảo Next.js dựng sẵn HTML lúc build:

```tsx
// app/posts/[slug]/page.tsx
export async function generateStaticParams() {
  const res = await fetch(`${API}/posts?limit=100`)
  const { data } = await res.json()

  return data.items.map((post) => ({ slug: post.slug }))
}

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)
  return <article><h1>{post.title}</h1></article>
}
```

`npm run build` in ra:

```
   Generating static pages (31/31)

Route (app)                              Revalidate  Expire
┌ ○ /                                            
├ ○ /posts                                       
└ ● /posts/[slug]                                
    ├ /posts/hoc-nestjs-trong-7-ngay             
    ├ /posts/docker-cho-nguoi-moi                
    └ [+25 more paths]

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML using generateStaticParams
ƒ  (Dynamic)  server-rendered on demand
```

Ba ký hiệu này là thứ bạn cần đọc mỗi lần build:

| Ký hiệu | Nghĩa | Tốc độ |
|---|---|---|
| `○ Static` | HTML dựng sẵn lúc build | Nhanh nhất |
| `● SSG` | Dựng sẵn theo `generateStaticParams` | Nhanh nhất |
| `ƒ Dynamic` | Render lại mỗi request | Chậm nhất |

Thấy một trang lẽ ra tĩnh mà bị đánh `ƒ` → có thứ gì đó trong trang đọc `cookies()`, `headers()`, `searchParams`, hoặc `fetch` không cache.

### ISR — cập nhật trang tĩnh mà không cần build lại

```tsx
export const revalidate = 3600     // dựng lại tối đa 1 lần/giờ
```

Cách hoạt động: người dùng đầu tiên sau 1 giờ vẫn nhận HTML **cũ** ngay lập tức, đồng thời Next.js dựng lại ở nền. Người tiếp theo nhận bản mới. Không ai phải chờ.

```
Route (app)                              Revalidate  Expire
● /posts/[slug]                                  1h      1y
```

---

## 7. Xoá cache chủ động: `revalidatePath` và `revalidateTag`

Khi người dùng đăng bài mới, bạn không muốn chờ hết 1 giờ. Xoá cache ngay:

```ts
// src/app/actions.ts
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'

export async function createPost(formData: FormData) {
  await fetch(`${API}/posts`, { method: 'POST', body: formData })

  revalidatePath('/posts')           // xoá cache của đúng đường dẫn này
  revalidateTag('posts', 'max')      // xoá mọi fetch gắn tag 'posts'
}
```

> ⚠️ **Next.js 16 đổi chữ ký `revalidateTag`** — bắt buộc có tham số thứ hai là hồ sơ `cacheLife`:
> ```ts
> revalidateTag('posts')          // ❌ Next.js 16: lỗi TypeScript
> revalidateTag('posts', 'max')   // ✅
> ```
> Lỗi khi thiếu:
> ```
> Expected 2 arguments, but got 1.
>   An argument for 'profile' was not provided.
> ```

Muốn dùng tag thì phải gắn tag lúc fetch:

```ts
export async function getPosts() {
  const res = await fetch(`${API}/posts`, {
    next: { revalidate: 3600, tags: ['posts'] },
  })
  return (await res.json()).data
}
```

### `revalidateTag` vs `updateTag` — chọn cái nào

Next.js 16 thêm `updateTag`, khác nhau ở trải nghiệm người dùng:

```ts
import { revalidateTag, updateTag } from 'next/cache'

// revalidateTag: đánh dấu cũ, người dùng vẫn thấy dữ liệu cũ trong lúc nền cập nhật
revalidateTag('posts', 'max')

// updateTag: xoá và làm mới ngay trong cùng request — người dùng thấy thay đổi của mình lập tức
updateTag('posts')
```

Quy tắc thực tế:

- Người dùng **vừa tự tay sửa** thứ gì đó (sửa bài của mình, đổi hồ sơ) → `updateTag`. Không có gì khó chịu bằng bấm Lưu xong vẫn thấy dữ liệu cũ.
- Dữ liệu chung, chậm vài giây cũng không sao (danh sách bài công khai sau khi admin đăng) → `revalidateTag`.

Còn `refresh()` chỉ làm mới router phía client, **không** động tới dữ liệu đã gắn tag:

```ts
import { refresh } from 'next/cache'
refresh()      // vẽ lại UI với dữ liệu server hiện có
```

---

## 8. `unstable_cache` cho hàm không phải `fetch`

Gọi database trực tiếp thì `fetch` cache không giúp được. Dùng:

```ts
import { unstable_cache } from 'next/cache'
import { db } from '@/lib/db'

export const getPopularPosts = unstable_cache(
  async () => {
    console.log('[db] truy vấn bài phổ biến')
    return db.post.findMany({ orderBy: { viewCount: 'desc' }, take: 5 })
  },
  ['popular-posts'],                        // khoá cache
  { tags: ['posts'], revalidate: 600 },     // 10 phút
)
```

Gọi 5 lần trong 10 phút, log chỉ in một dòng.

> Tên còn tiền tố `unstable_` nhưng đã dùng rộng rãi nhiều năm. API thay thế của nó là `use cache` (mục 10).

---

## 9. Route Segment Config — chỉnh cả trang

Export từ `page.tsx` hoặc `layout.tsx`:

```tsx
export const revalidate = 3600        // ISR: dựng lại mỗi giờ
export const dynamic = 'force-dynamic' // luôn render mới, bỏ mọi cache
export const dynamic = 'force-static'  // ép tĩnh, cookies()/headers() trả rỗng
```

`dynamic = 'force-dynamic'` là búa tạ — dùng khi bạn chắc chắn trang phải mới hoàn toàn (dashboard cá nhân chẳng hạn). Đừng rắc nó khắp nơi để "cho chắc", vì bạn sẽ mất sạch lợi ích tĩnh.

> ⚠️ Giá trị `revalidate` phải là hằng số phân tích được lúc build:
> ```ts
> export const revalidate = 3600      // ✅
> export const revalidate = 60 * 60   // ❌ Next.js không đọc được
> ```
> Lỗi:
> ```
> Error: Invalid revalidate value "60 * 60" on "/posts", must be a non-negative number or false
> ```

---

## 10. `use cache` — mô hình mới (tuỳ chọn)

Next.js 16 giới thiệu mô hình cache mới, bật bằng cờ:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,
}
```

Khi bật, bạn cache bằng directive thay vì tham số của `fetch`:

```tsx
import { cacheLife, cacheTag } from 'next/cache'

async function BlogPosts() {
  'use cache'
  cacheLife('hours')
  cacheTag('posts')

  const res = await fetch(`${API}/posts`)
  const { data } = await res.json()
  return <ul>{data.items.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

Đổi lại, Next.js **bắt buộc** mọi dữ liệu không cache phải nằm trong `<Suspense>`, nếu không build sẽ báo lỗi. Đó là điểm mạnh (ép bạn nghĩ về cache) và cũng là điểm khiến nó không hợp cho lần học đầu.

**Khuyến nghị cho bạn: chưa bật `cacheComponents`.** Học xong toàn bộ tài liệu này, làm xong dự án bài 08, rồi hãy quay lại. Mọi ví dụ trong tài liệu này chạy với `cacheComponents` **tắt** (mặc định).

---

## 11. Sơ đồ quyết định

```
Dữ liệu này có cần mới tuyệt đối không?
├─ Có (giỏ hàng, thông báo, dashboard cá nhân)
│   └─ fetch(url)                              — mặc định, không cache
│
└─ Không
    ├─ Có đổi theo thời gian không?
    │   ├─ Có (danh sách bài viết)
    │   │   └─ fetch(url, { next: { revalidate: 60, tags: ['posts'] } })
    │   │       + revalidateTag('posts', 'max') khi có bài mới
    │   │
    │   └─ Không (danh mục, tag, trang giới thiệu)
    │       └─ fetch(url, { cache: 'force-cache' })
    │
    └─ Route động và biết trước danh sách?
        └─ + generateStaticParams()  → dựng sẵn HTML lúc build
```

---

## Bài tập

1. Viết `src/lib/api.ts` với `getPosts`, `getPost(slug)`, `getCategories`, `getComments(slug)`. Mỗi hàm đều kiểm tra `res.ok`.
2. Thêm `console.log` vào `getPosts`. F5 ba lần với `fetch(url)` thường và với `{ next: { revalidate: 60 } }`, ghi lại số dòng log mỗi trường hợp.
3. Cố tình bỏ `if (!res.ok)` rồi gọi một endpoint không tồn tại. Chép lại lỗi `SyntaxError` nhận được.
4. Đổi hai lệnh `await` tuần tự thành `Promise.all`. Ghi lại con số `in ...ms` ở terminal trước và sau.
5. Tách `Comments` ra và bọc `<Suspense>`. Thêm `setTimeout` 2 giây, chạy `curl -N` và quan sát HTML về theo hai đợt.
6. Thêm `generateStaticParams` cho `/posts/[slug]`. Chạy `npm run build` và chép lại bảng route có ký hiệu `●`.
7. Cố tình viết `export const revalidate = 60 * 60` để gặp lỗi build, chép lại.
8. Gọi `revalidateTag('posts')` chỉ với một tham số, chép lại lỗi TypeScript.

Tiếp theo 👉 [04-server-actions-va-form.md](./04-server-actions-va-form.md)
