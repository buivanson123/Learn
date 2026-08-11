# Bài 8 — Dự án: giao diện Blog hoàn chỉnh

Làm xong dự án này, bạn đủ trình nhận việc Next.js. Ước tính 8–12 giờ.

Điều kiện: Blog API NestJS ([../nestjs/08-du-an-blog-api.md](../nestjs/08-du-an-blog-api.md)) đang chạy ở `localhost:3000`.

## Đặc tả

**Trang công khai**

| URL | Nội dung | Kiểu render |
|---|---|---|
| `/` | Bài mới nhất + danh mục | Tĩnh, ISR 1 giờ |
| `/posts` | Danh sách + phân trang + tìm kiếm + lọc | Động (có searchParams) |
| `/posts/[slug]` | Chi tiết bài + bình luận | SSG + ISR |
| `/categories/[slug]` | Bài theo danh mục | SSG |
| `/login`, `/register` | Xác thực | Tĩnh |

**Trang cần đăng nhập**

| URL | Nội dung | Quyền |
|---|---|---|
| `/dashboard` | Bài viết của tôi | user trở lên |
| `/posts/new` | Viết bài mới | user trở lên |
| `/posts/[slug]/edit` | Sửa bài | tác giả hoặc admin |
| `/dashboard/users` | Quản lý người dùng | admin |

**Chức năng**: đăng nhập/đăng ký/đăng xuất JWT httpOnly · CRUD bài viết · bình luận (có optimistic UI) · tìm kiếm + lọc + phân trang · phân quyền 3 mức · SEO đầy đủ · skeleton loading.

---

## Giai đoạn 1 — Khởi tạo (30 phút)

```bash
cd ~/Desktop/Learn/nextjs
npx create-next-app@latest blog-web    # TypeScript, ESLint, Tailwind, src/, App Router
cd blog-web
npm i zod
```

`package.json`:

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

`.env.local`:

```bash
API_URL=http://localhost:3000/api
NEXT_PUBLIC_SITE_NAME=Blog của Vanson
```

Kiểm tra backend sống:

```bash
$ curl -s localhost:3000/api/posts?limit=1 | jq '.success'
true
```

---

## Giai đoạn 2 — Cây thư mục (15 phút)

```
src/
├── app/
│   ├── layout.tsx                  ← html, body, Header, Footer
│   ├── page.tsx                    ← trang chủ
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── globals.css
│   │
│   ├── (auth)/                     ← nhóm route, không vào URL
│   │   ├── layout.tsx              ← layout hẹp, căn giữa
│   │   ├── actions.ts              ← login, register, logout
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   │
│   ├── posts/
│   │   ├── page.tsx                ← danh sách
│   │   ├── loading.tsx
│   │   ├── actions.ts              ← createPost, updatePost, deletePost, addComment
│   │   ├── new/page.tsx
│   │   └── [slug]/
│   │       ├── page.tsx
│   │       ├── loading.tsx
│   │       ├── not-found.tsx
│   │       └── edit/page.tsx
│   │
│   ├── categories/[slug]/page.tsx
│   │
│   ├── dashboard/
│   │   ├── layout.tsx              ← sidebar
│   │   ├── page.tsx
│   │   └── users/page.tsx          ← admin
│   │
│   ├── sitemap.ts
│   └── robots.ts
│
├── components/
│   ├── Header.tsx                  ← server
│   ├── Footer.tsx
│   ├── PostCard.tsx                ← server
│   ├── Pagination.tsx              ← client
│   ├── SearchBox.tsx               ← client
│   ├── PostForm.tsx                ← client
│   ├── LoginForm.tsx               ← client
│   ├── CommentSection.tsx          ← client (optimistic)
│   ├── DeleteButton.tsx            ← client
│   ├── LogoutButton.tsx            ← server (form + action)
│   └── ui/
│       ├── Skeleton.tsx
│       └── SubmitButton.tsx        ← client (useFormStatus)
│
├── lib/
│   ├── types.ts
│   ├── api.ts                      ← apiFetch + các hàm gọi API
│   ├── auth.ts                     ← getCurrentUser, requireUser, requireRole
│   └── schemas.ts                  ← Zod
│
└── proxy.ts
```

Quy tắc đặt file cho dự án này:

- `app/` **chỉ chứa route** — `page`, `layout`, `loading`, `error`, `actions.ts`, `route.ts`.
- Component nào có `'use client'` thì đặt trong `components/`, **không** để trong `app/`. Giúp bạn nhìn phát biết ranh giới server/client ở đâu.
- Mọi lời gọi tới Blog API đều đi qua `lib/api.ts`. Không `fetch` rải rác trong page.

---

## Giai đoạn 3 — Tầng dữ liệu (1.5 giờ)

### `src/lib/types.ts`

```ts
export type Role = 'user' | 'editor' | 'admin'

export type User = {
  id: number
  email: string
  name: string
  role: Role
}

export type Category = { id: number; name: string; slug: string }
export type Tag = { id: number; name: string; slug: string }

export type Post = {
  id: number
  title: string
  slug: string
  content: string
  excerpt: string
  status: 'draft' | 'published'
  viewCount: number
  createdAt: string
  updatedAt: string
  author: User
  category: Category | null
  tags: Tag[]
}

export type Comment = {
  id: number
  content: string
  createdAt: string
  author: User
}

export type ApiResponse<T> = { success: boolean; data: T; timestamp: string }
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number }
```

### `src/lib/api.ts`

```ts
import { cookies } from 'next/headers'
import type { ApiResponse, Paginated, Post, Category, Comment } from './types'

const API = process.env.API_URL ?? 'http://localhost:3000/api'

type FetchOptions = RequestInit & { next?: NextFetchRequestConfig }

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = (await cookies()).get('accessToken')?.value

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
  }

  const json: ApiResponse<T> = await res.json()
  return json.data
}

// ── Dữ liệu công khai: cache được ───────────────────────────

export function getPosts(params: {
  page?: number
  limit?: number
  search?: string
  category?: string
} = {}) {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 10),
    ...(params.search && { search: params.search }),
    ...(params.category && { category: params.category }),
  })

  return apiFetch<Paginated<Post>>(`/posts?${qs}`, {
    next: { revalidate: 60, tags: ['posts'] },
  })
}

export function getPost(slug: string) {
  return apiFetch<Post>(`/posts/slug/${slug}`, {
    next: { revalidate: 3600, tags: ['posts', `post-${slug}`] },
  })
}

export function getCategories() {
  return apiFetch<Category[]>('/categories', {
    next: { revalidate: 86400, tags: ['categories'] },
  })
}

export function getComments(postId: number) {
  return apiFetch<Comment[]>(`/posts/${postId}/comments`, {
    next: { revalidate: 10, tags: [`comments-${postId}`] },
  })
}

// ── Dữ liệu riêng của user: KHÔNG cache ─────────────────────

export function getMyPosts() {
  return apiFetch<Paginated<Post>>('/posts/mine', { cache: 'no-store' })
}
```

> Chú ý dòng phân cách trong file: đây là quyết định thiết kế quan trọng nhất của tầng dữ liệu. Hàm nào gắn `Authorization` mà lại `revalidate` thì user này sẽ thấy dữ liệu của user kia (bài [06](./06-auth-jwt.md#10-không-cache-dữ-liệu-riêng-của-user)).

### `src/lib/auth.ts`

```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { User, Role } from './types'

const API = process.env.API_URL ?? 'http://localhost:3000/api'

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get('accessToken')?.value
  if (!token) return null

  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null

  return (await res.json()).data as User
})

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const user = await requireUser()
  if (!roles.includes(user.role)) redirect('/?error=forbidden')
  return user
}

export function canEditPost(user: User | null, post: { author: { id: number } }) {
  if (!user) return false
  return user.id === post.author.id || user.role === 'admin'
}
```

### `src/lib/schemas.ts`

```ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
})

export const registerSchema = loginSchema
  .extend({
    name: z.string().min(2, 'Tên tối thiểu 2 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp',
    path: ['confirmPassword'],       // gắn lỗi vào đúng field
  })

export const postSchema = z.object({
  title: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200),
  content: z.string().min(20, 'Nội dung tối thiểu 20 ký tự'),
  categoryId: z.coerce.number().int().positive('Phải chọn danh mục'),
  status: z.enum(['draft', 'published']),
})

export const commentSchema = z.object({
  content: z.string().min(1, 'Chưa nhập nội dung').max(1000, 'Tối đa 1000 ký tự'),
})
```

**Mốc kiểm tra:** `npm run typecheck` phải sạch trước khi sang giai đoạn 4.

---

## Giai đoạn 4 — Layout & trang công khai (2 giờ)

### `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'vietnamese'], display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3001'),
  title: {
    default: 'Blog của Vanson',
    template: '%s | Blog của Vanson',
  },
  description: 'Ghi chép quá trình học lập trình',
  openGraph: { type: 'website', locale: 'vi_VN', siteName: 'Blog của Vanson' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.className}>
      <body className="flex min-h-screen flex-col bg-white text-gray-900">
        <Header />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

### `src/app/posts/page.tsx`

```tsx
import { Suspense } from 'react'
import { getPosts, getCategories } from '@/lib/api'
import PostCard from '@/components/PostCard'
import Pagination from '@/components/Pagination'
import SearchBox from '@/components/SearchBox'

export const metadata = { title: 'Tất cả bài viết' }

export default async function PostsPage(props: PageProps<'/posts'>) {
  const sp = await props.searchParams
  const page = Number(sp.page ?? 1)
  const search = typeof sp.search === 'string' ? sp.search : ''
  const category = typeof sp.category === 'string' ? sp.category : ''

  // Song song: hai request không phụ thuộc nhau
  const [result, categories] = await Promise.all([
    getPosts({ page, search, category }),
    getCategories(),
  ])

  const totalPages = Math.ceil(result.total / result.limit)

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold">Bài viết</h1>

      <SearchBox defaultValue={search} categories={categories} />

      <p className="my-4 text-sm text-gray-500">
        Tìm thấy {result.total} bài{search && ` cho "${search}"`}
      </p>

      {result.items.length === 0 ? (
        <p className="py-12 text-center text-gray-400">Không có bài viết nào.</p>
      ) : (
        <div className="space-y-4">
          {result.items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  )
}
```

### `src/components/SearchBox.tsx` (client)

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { Category } from '@/lib/types'

export default function SearchBox({
  defaultValue,
  categories,
}: {
  defaultValue: string
  categories: Category[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (value) params.set('search', value)
    else params.delete('search')
    params.delete('page')                    // tìm mới thì về trang 1
    startTransition(() => router.push(`/posts?${params}`))
  }

  function changeCategory(slug: string) {
    const params = new URLSearchParams(searchParams)
    if (slug) params.set('category', slug)
    else params.delete('category')
    params.delete('page')
    startTransition(() => router.push(`/posts?${params}`))
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Tìm bài viết..."
        className="flex-1 rounded border p-2"
      />
      <select
        defaultValue={searchParams.get('category') ?? ''}
        onChange={(e) => changeCategory(e.target.value)}
        className="rounded border p-2"
      >
        <option value="">Mọi danh mục</option>
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>{c.name}</option>
        ))}
      </select>
      <button disabled={pending} className="rounded bg-blue-600 px-4 text-white disabled:opacity-50">
        {pending ? '...' : 'Tìm'}
      </button>
    </form>
  )
}
```

Mẫu quan trọng: **giữ state tìm kiếm trong URL, không trong React state.** Nhờ vậy người dùng bookmark được, bấm Back được, và chia sẻ link được. Component chỉ đọc `searchParams` rồi đẩy URL mới.

### `src/app/posts/[slug]/page.tsx`

```tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPost, getPosts, getComments } from '@/lib/api'
import { getCurrentUser, canEditPost } from '@/lib/auth'
import CommentSection from '@/components/CommentSection'
import DeleteButton from '@/components/DeleteButton'
import Link from 'next/link'

export async function generateStaticParams() {
  const { items } = await getPosts({ limit: 100 })
  return items.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata(
  props: PageProps<'/posts/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params
  try {
    const post = await getPost(slug)
    return {
      title: post.title,
      description: post.excerpt,
      openGraph: {
        title: post.title,
        description: post.excerpt,
        type: 'article',
        publishedTime: post.createdAt,
        authors: [post.author.name],
      },
    }
  } catch {
    return { title: 'Không tìm thấy bài viết' }
  }
}

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params

  let post
  try {
    post = await getPost(slug)             // dedupe với generateMetadata: chỉ 1 request
  } catch {
    notFound()
  }

  const user = await getCurrentUser()

  return (
    <article>
      <header className="mb-6 border-b pb-4">
        <h1 className="mb-2 text-3xl font-bold">{post.title}</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{post.author.name}</span>
          <span>·</span>
          <time dateTime={post.createdAt}>
            {new Date(post.createdAt).toLocaleDateString('vi-VN')}
          </time>
          <span>·</span>
          <span>{post.viewCount} lượt xem</span>
        </div>

        {canEditPost(user, post) && (
          <div className="mt-3 flex gap-2">
            <Link href={`/posts/${slug}/edit`} className="text-sm text-blue-600 hover:underline">
              Sửa
            </Link>
            <DeleteButton postId={post.id} />
          </div>
        )}
      </header>

      <div className="prose max-w-none whitespace-pre-wrap">{post.content}</div>

      <Suspense fallback={<p className="mt-8 text-gray-400">Đang tải bình luận...</p>}>
        <CommentsLoader postId={post.id} currentUser={user} />
      </Suspense>
    </article>
  )
}

// Tách riêng để bình luận chậm không chặn nội dung bài
async function CommentsLoader({ postId, currentUser }) {
  const comments = await getComments(postId)
  return <CommentSection postId={postId} initial={comments} currentUser={currentUser} />
}
```

**Mốc kiểm tra:**

```bash
$ curl -s localhost:3001/posts/hoc-nestjs-trong-7-ngay | grep -o '<title>[^<]*</title>'
<title>Học NestJS trong 7 ngày | Blog của Vanson</title>
```

Nội dung bài phải nằm sẵn trong HTML (không cần JS).

---

## Giai đoạn 5 — Xác thực (2 giờ)

Làm theo bài [06](./06-auth-jwt.md): `(auth)/actions.ts` với `login`, `register`, `logout`; `LoginForm` dùng `useActionState`; `proxy.ts` chặn route; `requireRole` trong page.

`src/proxy.ts`:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/posts/new']
const GUEST_ONLY = ['/login', '/register']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasToken = request.cookies.has('accessToken')

  const isEditPage = /^\/posts\/[^/]+\/edit$/.test(pathname)

  if ((PROTECTED.some((p) => pathname.startsWith(p)) || isEditPage) && !hasToken) {
    const url = new URL('/login', request.url)
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (GUEST_ONLY.includes(pathname) && hasToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

**Mốc kiểm tra — cả 3 phải đúng:**

```bash
# 1. Chưa đăng nhập → bị đá
$ curl -i -s localhost:3001/dashboard | head -2
HTTP/1.1 307 Temporary Redirect
location: /login?next=%2Fdashboard

# 2. Cookie phải httpOnly
$ curl -i -s -X POST localhost:3001/login \
    -d 'email=admin@blog.test&password=12345678' | grep -i set-cookie
set-cookie: accessToken=eyJ...; Path=/; HttpOnly; SameSite=lax; Max-Age=900

# 3. Cookie giả vẫn bị chặn ở lớp 2
#    DevTools: document.cookie = 'accessToken=hehe; path=/'
#    Vào /dashboard → vẫn bị chuyển về /login (NestJS trả 401)
```

---

## Giai đoạn 6 — CRUD bài viết (2.5 giờ)

### `src/app/posts/actions.ts`

```ts
'use server'

import { revalidatePath, revalidateTag, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { requireUser, getCurrentUser, canEditPost } from '@/lib/auth'
import { postSchema, commentSchema } from '@/lib/schemas'
import type { Post } from '@/lib/types'

export type FormState = {
  errors?: Record<string, string[]>
  message?: string
}

export async function createPost(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser()                                  // ① kiểm tra đăng nhập

  const parsed = postSchema.safeParse({                // ② validate
    title: formData.get('title'),
    content: formData.get('content'),
    categoryId: formData.get('categoryId'),
    status: formData.get('status') ?? 'draft',
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  let post: Post
  try {
    post = await apiFetch<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    })
  } catch (e) {
    return { message: e instanceof Error ? e.message : 'Không tạo được bài viết' }
  }

  revalidateTag('posts', 'max')                        // ③ xoá cache
  revalidatePath('/dashboard')
  redirect(`/posts/${post.slug}`)                      // ④ chuyển hướng — LUÔN cuối cùng
}

export async function updatePost(
  id: number,
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser()

  const existing = await apiFetch<Post>(`/posts/${id}`, { cache: 'no-store' })
  if (!canEditPost(user, existing)) {                  // ← kiểm tra quyền SỞ HỮU
    return { message: 'Bạn không có quyền sửa bài này' }
  }

  const parsed = postSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    categoryId: formData.get('categoryId'),
    status: formData.get('status') ?? 'draft',
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const post = await apiFetch<Post>(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(parsed.data),
  })

  updateTag('posts')                    // tác giả vừa sửa → phải thấy ngay
  redirect(`/posts/${post.slug}`)
}

export async function deletePost(id: number) {
  const user = await requireUser()

  const existing = await apiFetch<Post>(`/posts/${id}`, { cache: 'no-store' })
  if (!canEditPost(user, existing)) {
    throw new Error('Không có quyền xoá bài này')
  }

  await apiFetch(`/posts/${id}`, { method: 'DELETE' })

  revalidateTag('posts', 'max')
  redirect('/dashboard')
}

export async function addComment(
  postId: number,
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser()

  const parsed = commentSchema.safeParse({ content: formData.get('content') })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  await apiFetch(`/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  })

  updateTag(`comments-${postId}`)
  return {}
}
```

**Bốn bước của mọi Server Action — thuộc lòng thứ tự này:**

```
① requireUser()          — đăng nhập chưa?
② canEditPost()          — có quyền với đúng bản ghi này không?
③ schema.safeParse()     — dữ liệu hợp lệ không?
④ gọi API → revalidate → redirect
```

Bỏ ② là lỗ hổng phổ biến nhất: người dùng đăng nhập rồi sửa bài của người khác bằng cách gọi thẳng action qua POST.

### Form dùng lại cho cả tạo và sửa

```tsx
// src/components/PostForm.tsx
'use client'

import { useActionState } from 'react'
import { createPost, updatePost, type FormState } from '@/app/posts/actions'
import SubmitButton from './ui/SubmitButton'
import type { Post, Category } from '@/lib/types'

export default function PostForm({
  categories,
  post,
}: {
  categories: Category[]
  post?: Post              // có post = chế độ sửa
}) {
  const action = post
    ? updatePost.bind(null, post.id)     // gắn sẵn id
    : createPost

  const [state, formAction] = useActionState<FormState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <input
          name="title"
          defaultValue={post?.title}
          placeholder="Tiêu đề"
          className="w-full rounded border p-2 text-lg"
        />
        {state.errors?.title && <p className="text-sm text-red-600">{state.errors.title[0]}</p>}
      </div>

      <div>
        <textarea
          name="content"
          defaultValue={post?.content}
          rows={16}
          placeholder="Nội dung..."
          className="w-full rounded border p-2"
        />
        {state.errors?.content && <p className="text-sm text-red-600">{state.errors.content[0]}</p>}
      </div>

      <div className="flex gap-4">
        <select name="categoryId" defaultValue={post?.category?.id ?? ''} className="rounded border p-2">
          <option value="">-- Danh mục --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select name="status" defaultValue={post?.status ?? 'draft'} className="rounded border p-2">
          <option value="draft">Bản nháp</option>
          <option value="published">Xuất bản</option>
        </select>
      </div>

      {state.message && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700">{state.message}</p>
      )}

      <SubmitButton>{post ? 'Cập nhật' : 'Đăng bài'}</SubmitButton>
    </form>
  )
}
```

`updatePost.bind(null, post.id)` là mẹo quan trọng: nó biến hàm 3 tham số `(id, prevState, formData)` thành hàm 2 tham số mà `useActionState` cần.

---

## Giai đoạn 7 — Bình luận với optimistic UI (1.5 giờ)

```tsx
// src/components/CommentSection.tsx
'use client'

import { useOptimistic, useRef, useTransition } from 'react'
import { addComment } from '@/app/posts/actions'
import type { Comment, User } from '@/lib/types'

type OptimisticComment = Comment & { pending?: boolean }

export default function CommentSection({
  postId,
  initial,
  currentUser,
}: {
  postId: number
  initial: Comment[]
  currentUser: User | null
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [, startTransition] = useTransition()

  const [comments, addOptimistic] = useOptimistic<OptimisticComment[], string>(
    initial,
    (state, content) => [
      ...state,
      {
        id: -Date.now(),                    // id âm để không đụng id thật
        content,
        createdAt: new Date().toISOString(),
        author: currentUser!,
        pending: true,
      },
    ],
  )

  return (
    <section className="mt-10 border-t pt-6">
      <h2 className="mb-4 text-xl font-bold">Bình luận ({comments.length})</h2>

      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className={`rounded border p-3 ${c.pending ? 'opacity-50' : ''}`}>
            <div className="text-sm font-medium">{c.author.name}</div>
            <p>{c.content}</p>
            {c.pending && <span className="text-xs text-gray-400">Đang gửi...</span>}
          </li>
        ))}
      </ul>

      {currentUser ? (
        <form
          ref={formRef}
          action={(formData) => {
            const content = formData.get('content') as string
            if (!content.trim()) return
            formRef.current?.reset()                 // xoá ô nhập ngay
            startTransition(() => {
              addOptimistic(content)                 // hiện ngay, mờ 50%
              addComment(postId, {}, formData)       // gửi lên server
            })
          }}
          className="mt-4 flex gap-2"
        >
          <input name="content" placeholder="Viết bình luận..." className="flex-1 rounded border p-2" />
          <button type="submit" className="rounded bg-blue-600 px-4 text-white">Gửi</button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          <a href="/login" className="text-blue-600 hover:underline">Đăng nhập</a> để bình luận.
        </p>
      )}
    </section>
  )
}
```

Trải nghiệm cần đạt được:

```
t=0ms     bình luận hiện ngay, chữ mờ, ô nhập đã trống
t=250ms   server trả lời, chữ đậm lại
```

Nếu API lỗi, React tự gỡ bình luận mờ đó ra — bạn không phải dọn.

---

## Giai đoạn 8 — Dashboard & phân quyền (1 giờ)

```tsx
// src/app/dashboard/layout.tsx
import Link from 'next/link'
import { requireUser } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex gap-8">
      <aside className="w-48 shrink-0">
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard">Bài viết của tôi</Link>
          <Link href="/posts/new">Viết bài mới</Link>
          {user.role === 'admin' && <Link href="/dashboard/users">Người dùng</Link>}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  )
}
```

```tsx
// src/app/dashboard/users/page.tsx
import { requireRole } from '@/lib/auth'
import { apiFetch } from '@/lib/api'
import type { User } from '@/lib/types'

export default async function UsersPage() {
  await requireRole('admin')                 // ← chỉ admin

  const users = await apiFetch<User[]>('/users', { cache: 'no-store' })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          <th className="py-2">Tên</th><th>Email</th><th>Vai trò</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b">
            <td className="py-2">{u.name}</td><td>{u.email}</td><td>{u.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

---

## Giai đoạn 9 — Đánh bóng (1 giờ)

Skeleton cho danh sách:

```tsx
// src/app/posts/loading.tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-9 w-48 animate-pulse rounded bg-gray-200" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded border p-4">
          <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  )
}
```

Thêm `sitemap.ts`, `robots.ts`, `not-found.tsx`, `error.tsx` theo bài [07](./07-toi-uu-seo-deploy.md) và [01](./01-app-router.md).

---

## Checklist nghiệm thu

**Chạy được**
```
[ ] npm run build sạch, không warning
[ ] npm run typecheck không lỗi
[ ] Bảng route: /posts/[slug] là ●, /dashboard là ƒ
```

**Chức năng**
```
[ ] Đăng ký → đăng nhập → đăng xuất
[ ] Danh sách có phân trang, tìm kiếm, lọc danh mục — tất cả phản ánh trong URL
[ ] Bấm Back sau khi tìm kiếm quay về đúng kết quả trước
[ ] Tạo / sửa / xoá bài viết
[ ] Bình luận hiện ngay (optimistic) rồi đậm lại
[ ] Danh sách cập nhật ngay sau khi đăng bài (revalidate hoạt động)
```

**Bảo mật**
```
[ ] document.cookie trong console KHÔNG thấy token
[ ] Cookie có HttpOnly + SameSite
[ ] Đặt cookie giả vẫn bị chặn khỏi /dashboard
[ ] User thường không sửa được bài người khác (thử đổi id trên URL /posts/X/edit)
[ ] User thường vào /dashboard/users bị đá ra
[ ] grep -r "SECRET" .next/static/ rỗng
[ ] Đăng nhập 2 user ở 2 cửa sổ, không lẫn dữ liệu
```

**Chất lượng**
```
[ ] Nội dung bài nằm trong HTML (curl | grep thấy được)
[ ] Mỗi trang có <title> riêng
[ ] Thẻ og: đầy đủ ở trang chi tiết
[ ] Skeleton hiện khi chuyển trang
[ ] Không có lỗi/cảnh báo nào trong console trình duyệt
[ ] 'use client' chỉ xuất hiện trong components/, không có trong app/**/page.tsx
```

Câu lệnh kiểm tra cuối cùng:

```bash
$ grep -rl "use client" src/app/
                                    ← rỗng là đạt: mọi page đều là Server Component
```

---

## Mở rộng (nếu còn hứng)

1. **Upload ảnh bìa** — Route Handler nhận `multipart/form-data`, đẩy lên Cloudinary, giấu API key ở server.
2. **Markdown editor** — thư viện chỉ chạy ở trình duyệt, dùng `dynamic(..., { ssr: false })`.
3. **Dark mode** — cookie `theme` đọc trong `layout.tsx`, không nhấp nháy lúc tải (khác hẳn cách dùng `localStorage`).
4. **Infinite scroll** — `IntersectionObserver` + Server Action trả thêm trang.
5. **Ảnh OG động** — `app/posts/[slug]/opengraph-image.tsx` sinh ảnh chia sẻ riêng cho từng bài. Nhớ Next.js 16: `params` và `id` đều là Promise.
6. **Bật `cacheComponents: true`** và chuyển sang `use cache` (bài [03](./03-lay-du-lieu-va-cache.md#10-use-cache--mô-hình-mới-tuỳ-chọn)). Chuẩn bị sửa nhiều — Next.js sẽ bắt bạn bọc `<Suspense>` cho mọi dữ liệu không cache.

Tra cứu nhanh 👉 [09-cheatsheet.md](./09-cheatsheet.md) · Gặp lỗi 👉 [10-loi-thuong-gap.md](./10-loi-thuong-gap.md)
