# Bài 0 — Chuẩn bị & React vừa đủ

## 1. Tạo dự án

```bash
cd ~/Desktop/Learn/nextjs
npx create-next-app@latest blog-web
```

CLI hỏi 6 câu. Đây là đáp án dùng cho toàn bộ tài liệu này:

```
✔ Would you like to use TypeScript? … Yes
✔ Which linter would you like to use? › ESLint
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like your code inside a `src/` directory? … Yes
✔ Would you like to use App Router? (recommended) … Yes
✔ Would you like to use Turbopack? (recommended) … Yes
✔ Would you like to customize the import alias (`@/*` by default)? … No
```

Vì sao chọn như vậy:

- **`src/` = Yes** — tách code khỏi file cấu hình ở gốc. Đường dẫn thành `src/app/...`. Mọi ví dụ trong tài liệu này viết `app/page.tsx` nghĩa là `src/app/page.tsx`.
- **App Router = Yes** — bắt buộc. Pages Router (`pages/`) là kiến trúc cũ, không có Server Component.
- **Tailwind = Yes** — để bạn không phải bận tâm CSS. Nếu không thích, chọn No, mọi thứ khác vẫn chạy.

Chạy thử:

```bash
cd blog-web
npm run dev -- -p 3001
```

Dùng cổng **3001** vì Blog API NestJS đang giữ cổng 3000. Output:

```
  ▲ Next.js 16.3.0 (Turbopack)
  - Local:        http://localhost:3001
  - Network:      http://192.168.1.12:3001

 ✓ Starting...
 ✓ Ready in 892ms
```

Chưa đổi cổng mà cổng 3000 đang bận thì Next.js tự nhảy cổng và báo:

```
 ⚠ Port 3000 is in use by process 41287, using available port 3001 instead.
```

Cho cố định luôn vào `package.json` để khỏi gõ `-p` mỗi lần:

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001"
  }
}
```

> ⚠️ Từ Next.js 16, **Turbopack là mặc định** cho cả `next dev` và `next build`. Bạn không cần cờ `--turbopack` nữa. Thấy code cũ ghi `"dev": "next dev --turbopack"` thì bỏ cờ đi cũng chẳng sao — nó chỉ thừa.

---

## 2. Cây thư mục sau khi tạo

```
blog-web/
├── src/
│   └── app/
│       ├── layout.tsx      ← khung HTML bọc mọi trang (BẮT BUỘC có)
│       ├── page.tsx        ← trang tại URL "/"
│       ├── globals.css
│       └── favicon.ico
├── public/                 ← file tĩnh, truy cập qua /ten-file.png
├── next.config.ts
├── tsconfig.json
├── package.json
└── .gitignore
```

Chỉ có **2 file** quyết định trang chủ của bạn: `layout.tsx` và `page.tsx`. Mở `src/app/page.tsx`, xoá sạch, thay bằng:

```tsx
export default function Page() {
  return <h1>Blog của Vanson</h1>
}
```

Lưu file → trình duyệt tự cập nhật, không cần F5. Terminal in:

```
 ✓ Compiled / in 143ms
```

### Thư mục sẽ tạo thêm trong tài liệu này

```
src/
├── app/                 ← chỉ chứa route (page/layout/loading/error/route)
├── components/          ← component tái sử dụng
│   └── ui/              ← nút, input, card... không dính logic nghiệp vụ
├── lib/                 ← hàm gọi API, tiện ích
│   ├── api.ts           ← nơi duy nhất gọi vào Blog API
│   └── types.ts         ← kiểu dữ liệu Post, User, Comment...
└── proxy.ts             ← chặn request trước khi vào route (bài 05)
```

> Quy tắc đặt file: **thư mục `app/` chỉ chứa route.** Component phụ trợ để ở `components/`. Nếu để component thường trong `app/`, nó không thành route (Next.js chỉ nhận file đúng tên chuẩn) nhưng thư mục sẽ rối rất nhanh.

---

## 3. React vừa đủ để dùng Next.js

Bạn đã biết JavaScript nên phần này ngắn. Chỉ 5 thứ.

### 3.1 JSX — hàm trả về giao diện

```tsx
function PostCard() {
  return <article className="p-4">Xin chào</article>
}
```

Ba điểm khác HTML dễ làm bạn vấp:

| HTML | JSX | Vì sao |
|---|---|---|
| `class="p-4"` | `className="p-4"` | `class` là từ khoá JS |
| `for="email"` | `htmlFor="email"` | `for` là từ khoá JS |
| `<br>` | `<br />` | JSX là XML, thẻ nào cũng phải đóng |

Nhúng biến bằng `{}`:

```tsx
const title = 'Học Next.js'
const views = 42

return (
  <div>
    <h1>{title}</h1>
    <p>{views} lượt xem</p>
    <p>{views > 10 ? 'Bài hot' : 'Bài mới'}</p>
  </div>
)
```

Trả về nhiều phần tử thì bọc trong `<>...</>` (Fragment) vì hàm chỉ `return` được 1 giá trị:

```tsx
return (
  <>
    <h1>Tiêu đề</h1>
    <p>Nội dung</p>
  </>
)
```

Quên bọc sẽ gặp lỗi biên dịch:

```
Error: Unexpected token. Did you mean `{'>'}` or `&gt;`?
```

### 3.2 Lặp danh sách — luôn cần `key`

```tsx
const posts = [
  { id: 1, title: 'Bài A' },
  { id: 2, title: 'Bài B' },
]

return (
  <ul>
    {posts.map((post) => (
      <li key={post.id}>{post.title}</li>
    ))}
  </ul>
)
```

Quên `key`, console trình duyệt in cảnh báo:

```
Warning: Each child in a list should have a unique "key" prop.
    at li
    at ul
    at Page
```

`key` phải là **id ổn định**, đừng dùng index của mảng — khi bạn xoá phần tử giữa danh sách, React sẽ ghép nhầm state vào sai hàng.

### 3.3 Props — truyền dữ liệu xuống component

```tsx
// components/PostCard.tsx
type Props = {
  title: string
  views: number
}

export default function PostCard({ title, views }: Props) {
  return (
    <article>
      <h2>{title}</h2>
      <p>{views} lượt xem</p>
    </article>
  )
}
```

Dùng:

```tsx
import PostCard from '@/components/PostCard'

<PostCard title="Học Next.js" views={42} />
```

`@/` là alias trỏ tới `src/`, được khai báo sẵn trong `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

Nhờ vậy bạn viết `@/components/PostCard` thay vì `../../../components/PostCard`.

### 3.4 `useState` — chỉ dùng ở Client Component

```tsx
'use client'                       // ← bắt buộc, thiếu là lỗi
import { useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0)

  return <button onClick={() => setCount(count + 1)}>Đã bấm {count} lần</button>
}
```

Quên `'use client'`, terminal báo:

```
Error: useState only works in Client Components.
Add the "use client" directive at the top of the file to use it.

   ╭─[src/components/Counter.tsx:1:1]
 1 │ import { useState } from 'react'
   ·          ────────
```

Bài [02](./02-server-client-component.md) giải thích cặn kẽ vì sao.

### 3.5 `useEffect` — bạn sẽ dùng ít hơn tưởng

Trong React thuần, `useEffect` là cách lấy dữ liệu. Trong Next.js **không phải** — bạn `await` thẳng trong Server Component:

```tsx
// ❌ Cách cũ, đừng dùng để lấy dữ liệu trong Next.js
'use client'
useEffect(() => {
  fetch('/api/posts').then(r => r.json()).then(setPosts)
}, [])

// ✅ Cách của Next.js
export default async function Page() {
  const res = await fetch('http://localhost:3000/api/posts')
  const { data } = await res.json()
  return <PostList posts={data.items} />
}
```

`useEffect` chỉ còn dùng cho việc đồng bộ với thứ bên ngoài React: đăng ký `addEventListener`, kết nối WebSocket, thao tác DOM trực tiếp.

---

## 4. TypeScript vừa đủ

Chỉ cần 3 thứ.

### 4.1 Khai báo kiểu dữ liệu từ API

Tạo `src/lib/types.ts` — khớp với entity trong Blog API:

```ts
export type User = {
  id: number
  email: string
  name: string
  role: 'user' | 'editor' | 'admin'   // union: chỉ nhận đúng 3 giá trị này
}

export type Post = {
  id: number
  title: string
  slug: string
  content: string
  viewCount: number
  createdAt: string                    // API trả ISO string, không phải Date
  author: User
  category: Category | null            // null khi bài chưa gán danh mục
  tags: Tag[]
}

export type Category = { id: number; name: string; slug: string }
export type Tag = { id: number; name: string; slug: string }
```

Sai kiểu, VS Code gạch đỏ ngay:

```ts
post.viewCount.toUpperCase()
//              ~~~~~~~~~~~
// Property 'toUpperCase' does not exist on type 'number'.
```

### 4.2 Bọc dạng response của Blog API

Blog API luôn trả `{ success, data, timestamp }`. Khai báo một lần dùng mãi:

```ts
export type ApiResponse<T> = {
  success: boolean
  data: T
  timestamp: string
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  limit: number
}
```

Dùng:

```ts
const res = await fetch('http://localhost:3000/api/posts')
const json: ApiResponse<Paginated<Post>> = await res.json()

json.data.items        // Post[]  ← TypeScript biết chính xác
json.data.total        // number
```

### 4.3 Kiểu cho `params` / `searchParams`

Next.js sinh sẵn kiểu cho từng route. Chạy một lần:

```bash
npx next typegen
```

```
   Generating types...
 ✓ Generated types for 4 routes in .next/types
```

Sau đó dùng `PageProps` với đường dẫn route làm tham số:

```tsx
// app/posts/[slug]/page.tsx
export default async function Page(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params        // TypeScript biết có field `slug`
  const { page } = await props.searchParams
  return <h1>{slug}</h1>
}
```

Gõ sai tên param, TypeScript bắt luôn:

```ts
const { id } = await props.params
//      ~~
// Property 'id' does not exist on type '{ slug: string }'.
```

`PageProps`, `LayoutProps`, `RouteContext` là kiểu toàn cục, không cần import. `next dev` cũng tự sinh lại chúng mỗi khi bạn thêm route.

---

## 5. Không có Blog API thì sao

Vẫn học được. Thay `http://localhost:3000/api/posts` bằng API công khai do Vercel host:

```bash
$ curl -s https://api.vercel.app/blog | head -c 300
[{"id":1,"title":"Understanding React Hooks","content":"React Hooks are...","author":"Sarah Johnson","date":"2024-01-15"},...
```

Khác biệt: API này trả **mảng thẳng**, không bọc `{ success, data }`. Nên khi đọc ví dụ trong tài liệu, bạn bỏ bước `.data`:

```ts
// Với Blog API
const { data } = await res.json()
const posts = data.items

// Với api.vercel.app/blog
const posts = await res.json()
```

Khuyến nghị: dựng Blog API lên. Cả bộ tài liệu này thiết kế để hai dự án ghép vào nhau, và bài [06](./06-auth-jwt.md) (đăng nhập JWT) cần backend thật.

---

## 6. Cấu hình `next.config.ts`

File này bắt đầu rỗng. Bạn sẽ thêm dần. Bản dùng cho tài liệu này:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
```

> ⚠️ **Sửa `next.config.ts` phải khởi động lại `npm run dev`.** File này chỉ đọc lúc server khởi động — không hot-reload. Đây là nguyên nhân số 1 của tình trạng "tôi sửa config rồi mà không ăn".

---

## 7. Biến môi trường

Tạo `.env.local` ở gốc dự án (ngang hàng `package.json`):

```bash
# .env.local
API_URL=http://localhost:3000/api
NEXT_PUBLIC_SITE_NAME=Blog của Vanson
```

Hai loại biến, khác nhau ở chỗ **ai đọc được**:

| Tên biến | Đọc được ở | Có trong bundle trình duyệt? |
|---|---|---|
| `API_URL` | chỉ Server Component, Server Action, Route Handler | ❌ Không |
| `NEXT_PUBLIC_SITE_NAME` | mọi nơi, kể cả Client Component | ✅ Có — **ai cũng xem được** |

```tsx
// app/page.tsx (Server Component) — chạy tốt
export default async function Page() {
  const res = await fetch(`${process.env.API_URL}/posts`)
  // ...
}
```

```tsx
// components/Header.tsx (Client Component)
'use client'
export default function Header() {
  console.log(process.env.API_URL)          // undefined  ← không có tiền tố NEXT_PUBLIC_
  return <h1>{process.env.NEXT_PUBLIC_SITE_NAME}</h1>   // "Blog của Vanson" ✅
}
```

Dùng `process.env.API_URL` trong Client Component sẽ ra `undefined`, và biểu hiện thường thấy là:

```
TypeError: Failed to parse URL from undefined/posts
```

> ⚠️ **Không bao giờ đặt `NEXT_PUBLIC_` cho secret.** `NEXT_PUBLIC_DB_PASSWORD` sẽ nằm nguyên văn trong file JS gửi xuống trình duyệt. Kiểm chứng: build xong chạy `grep -r "giá_trị_secret" .next/static/` — nếu thấy, secret đã lộ.

`.env.local` đã được `create-next-app` thêm sẵn vào `.gitignore`. Kiểm tra:

```bash
$ git check-ignore -v .env.local
.gitignore:34:.env*    .env.local        ← đã bị ignore, an toàn
```

---

## Bài tập

1. Tạo dự án `blog-web`, chạy được ở cổng 3001, đổi trang chủ thành tên bạn.
2. Tạo `src/lib/types.ts` với đủ `User`, `Post`, `Category`, `Tag`, `Comment` khớp Blog API.
3. Tạo `components/PostCard.tsx` nhận props `title`, `views`, `author` và hiển thị. Render 3 cái ở trang chủ bằng dữ liệu cứng.
4. Cố tình quên `key` trong `.map()`, mở console trình duyệt và chép lại nguyên văn cảnh báo.
5. Thêm `API_URL` và `NEXT_PUBLIC_SITE_NAME` vào `.env.local`. In cả hai ra trong `app/page.tsx`, rồi tạo một Client Component in lại cả hai — quan sát cái nào thành `undefined`.

Tiếp theo 👉 [01-app-router.md](./01-app-router.md)
