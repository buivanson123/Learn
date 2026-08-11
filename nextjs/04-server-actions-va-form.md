# Bài 4 — Server Actions & Form

## 1. Server Action là gì

Một hàm `async` chạy **trên server** nhưng bạn gọi được **từ client** như hàm thường. Next.js lo phần gửi request ở giữa.

```ts
// src/app/actions.ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title')
  console.log('[server] nhận được:', title)
}
```

```tsx
// src/app/posts/new/page.tsx
import { createPost } from '@/app/actions'

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Tiêu đề" />
      <button type="submit">Đăng</button>
    </form>
  )
}
```

Gõ "Bài đầu tiên" rồi bấm Đăng. Terminal:

```
[server] nhận được: Bài đầu tiên
 POST /posts/new 200 in 24ms
```

Console trình duyệt: **không có gì**. Không có `fetch`, không có `/api/...`, bạn không viết endpoint nào cả.

Ở tab Network bạn thấy một request `POST` tới chính URL của trang, body là định dạng nội bộ của React:

```
POST /posts/new
Next-Action: 7f9a2c1e0b...        ← id của action, cách server biết gọi hàm nào
```

### `'use server'` khác `'use client'` thế nào

Dễ nhầm vì tên giống nhau, nhưng ý nghĩa ngược nhau:

| Directive | Nghĩa |
|---|---|
| `'use client'` | "File này và cây import của nó **gửi xuống trình duyệt**" |
| `'use server'` | "Các hàm export ở đây **chỉ chạy trên server**, nhưng cho phép client gọi" |

`'use server'` **không** biến component thành server component — component vốn đã là server rồi. Nó chỉ đánh dấu hàm là điểm vào có thể gọi từ xa.

---

## 2. Ba cách khai báo

### Cách 1: file riêng (khuyến nghị)

```ts
// src/app/actions.ts
'use server'                     // áp dụng cho MỌI export trong file

export async function createPost(formData: FormData) { /* ... */ }
export async function deletePost(id: number) { /* ... */ }
```

Đây là cách duy nhất **Client Component import được**.

### Cách 2: inline trong Server Component

```tsx
export default function Page() {
  async function createPost(formData: FormData) {
    'use server'
    // ...
  }

  return <form action={createPost}>...</form>
}
```

Tiện cho action dùng một lần.

### Cách 3: truyền xuống Client Component qua props

```tsx
// Server Component
import ClientForm from '@/components/ClientForm'
import { createPost } from '@/app/actions'

export default function Page() {
  return <ClientForm createPostAction={createPost} />
}
```

```tsx
// components/ClientForm.tsx
'use client'

export default function ClientForm({
  createPostAction,
}: {
  createPostAction: (formData: FormData) => void
}) {
  return <form action={createPostAction}>...</form>
}
```

Đây là ngoại lệ duy nhất của quy tắc "không truyền hàm qua ranh giới server/client" ở bài [02](./02-server-client-component.md#6-props-truyền-từ-server-sang-client-phải-serialize-được).

> ⚠️ Định nghĩa Server Action **bên trong** Client Component thì không được:
> ```tsx
> 'use client'
> export default function Form() {
>   async function save() { 'use server' }    // ❌
> }
> ```
> ```
> Error: It is not allowed to define inline "use server" annotated Server Actions
> in Client Components.
> ```

---

## 3. Đọc dữ liệu form

Server Action nhận `FormData` — API chuẩn của trình duyệt:

```ts
'use server'

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string          // theo thuộc tính name=""
  const content = formData.get('content') as string
  const tags = formData.getAll('tags') as string[]       // nhiều input cùng name
  const published = formData.get('published') === 'on'   // checkbox

  console.log({ title, content, tags, published })
}
```

```tsx
<form action={createPost}>
  <input name="title" />
  <textarea name="content" />
  <input type="checkbox" name="tags" value="nextjs" />
  <input type="checkbox" name="tags" value="react" />
  <input type="checkbox" name="published" />
  <button type="submit">Đăng</button>
</form>
```

Điền và submit:

```
{
  title: 'Học Next.js',
  content: 'Nội dung...',
  tags: [ 'nextjs', 'react' ],
  published: true
}
```

Ba điều dễ vấp:

1. **`formData.get()` luôn trả `string` hoặc `File`**, không bao giờ là number. Phải tự ép: `Number(formData.get('price'))`.
2. **Checkbox không tick thì không xuất hiện trong FormData** — `formData.get('published')` trả `null`, không phải `false`.
3. **Input thiếu `name` thì không gửi đi.** Đây là lỗi im lặng khó chịu nhất: form trông đúng, nhưng server nhận `null`.

---

## 4. Validate với Zod

Đừng tin dữ liệu từ client. Server Action có thể bị gọi trực tiếp bằng POST, bỏ qua hoàn toàn giao diện của bạn.

```bash
npm i zod
```

```ts
// src/lib/schemas.ts
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(5, 'Tiêu đề tối thiểu 5 ký tự').max(200, 'Tối đa 200 ký tự'),
  content: z.string().min(20, 'Nội dung tối thiểu 20 ký tự'),
  categoryId: z.coerce.number().int().positive('Phải chọn danh mục'),
})
```

`z.coerce.number()` tự chuyển `"3"` thành `3` — đúng thứ bạn cần vì FormData luôn trả string.

```ts
// src/app/actions.ts
'use server'

import { createPostSchema } from '@/lib/schemas'

export async function createPost(formData: FormData) {
  const parsed = createPostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    categoryId: formData.get('categoryId'),
  })

  if (!parsed.success) {
    console.log(parsed.error.flatten().fieldErrors)
    return
  }

  console.log('hợp lệ:', parsed.data)
}
```

Submit với tiêu đề "abc":

```
{
  title: [ 'Tiêu đề tối thiểu 5 ký tự' ],
  content: [ 'Nội dung tối thiểu 20 ký tự' ],
  categoryId: [ 'Phải chọn danh mục' ]
}
```

Nhưng người dùng chẳng thấy gì — lỗi đang nằm ở terminal. Cần `useActionState` để đưa lỗi lên màn hình.

---

## 5. `useActionState` — hiện lỗi và trạng thái chờ

Hook này trả về 3 thứ: **state** (giá trị action trả về), **action** (hàm để gắn vào form), **pending** (boolean đang gửi).

```ts
// src/app/actions.ts
'use server'

import { createPostSchema } from '@/lib/schemas'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export type FormState = {
  errors?: Record<string, string[]>
  message?: string
}

export async function createPost(
  prevState: FormState,        // ← tham số 1: state trước đó (useActionState tự truyền)
  formData: FormData,          // ← tham số 2: dữ liệu form
): Promise<FormState> {
  const parsed = createPostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    categoryId: formData.get('categoryId'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const res = await fetch(`${process.env.API_URL}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  })

  if (!res.ok) {
    return { message: `Không tạo được bài viết (API trả ${res.status})` }
  }

  revalidatePath('/posts')
  redirect('/posts')
}
```

```tsx
// src/components/PostForm.tsx
'use client'

import { useActionState } from 'react'
import { createPost, type FormState } from '@/app/actions'

const initialState: FormState = {}

export default function PostForm({ categories }: { categories: Category[] }) {
  const [state, formAction, pending] = useActionState(createPost, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <input name="title" placeholder="Tiêu đề" className="w-full rounded border p-2" />
        {state.errors?.title && (
          <p className="text-sm text-red-600">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <textarea name="content" rows={8} className="w-full rounded border p-2" />
        {state.errors?.content && (
          <p className="text-sm text-red-600">{state.errors.content[0]}</p>
        )}
      </div>

      <div>
        <select name="categoryId" className="rounded border p-2">
          <option value="">-- Chọn danh mục --</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {state.errors?.categoryId && (
          <p className="text-sm text-red-600">{state.errors.categoryId[0]}</p>
        )}
      </div>

      {state.message && (
        <p className="rounded bg-red-50 p-2 text-red-700">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Đang đăng...' : 'Đăng bài'}
      </button>
    </form>
  )
}
```

Trải nghiệm khi submit form thiếu dữ liệu:

```
[bấm Đăng bài]
  → nút đổi thành "Đang đăng..." và mờ đi
  → ~80ms sau, nút trở lại bình thường
  → dưới mỗi ô hiện chữ đỏ:
       Tiêu đề tối thiểu 5 ký tự
       Nội dung tối thiểu 20 ký tự
       Phải chọn danh mục
```

Trang **không reload**, dữ liệu đã gõ vẫn còn nguyên.

> ⚠️ **Thứ tự tham số của action bắt buộc là `(prevState, formData)`.** Viết ngược lại thì `formData.get` sẽ lỗi:
> ```
> TypeError: formData.get is not a function
> ```
> vì tham số đầu tiên thực ra là state chứ không phải FormData.

### Nút submit riêng: `useFormStatus`

Khi nút nằm trong component con, không tiện truyền `pending` xuống:

```tsx
'use client'
import { useFormStatus } from 'react-dom'      // ← 'react-dom', KHÔNG phải 'react'

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Đang gửi...' : children}
    </button>
  )
}
```

`useFormStatus` chỉ đọc được trạng thái của `<form>` **cha** nó. Đặt cùng cấp với `<form>` sẽ luôn ra `pending: false`:

```tsx
// ❌ luôn false
<>
  <SubmitButton />
  <form action={createPost}>...</form>
</>

// ✅
<form action={createPost}>
  <SubmitButton />
</form>
```

---

## 6. Sau khi lưu: revalidate và redirect

```ts
'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updatePost(id: number, formData: FormData) {
  await fetch(`${process.env.API_URL}/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(/* ... */),
  })

  updateTag('posts')          // người dùng vừa sửa → phải thấy ngay
  redirect(`/posts/${id}`)
}
```

Ba lưu ý:

1. **`redirect()` phải gọi sau cùng.** Nó throw để dừng luồng, code phía dưới không chạy.
   ```ts
   redirect('/posts')
   revalidatePath('/posts')     // ❌ không bao giờ chạy
   ```
2. **Đừng bọc `redirect()` trong `try/catch`** — bạn sẽ bắt nhầm tín hiệu điều hướng và người dùng đứng yên tại chỗ.
   ```ts
   try {
     await save()
     redirect('/posts')        // ❌ bị catch nuốt mất
   } catch (e) {
     return { message: 'Lỗi' }
   }
   ```
   Sửa: đưa `redirect()` ra ngoài khối `try`.
3. **Không revalidate thì người dùng thấy dữ liệu cũ.** Đây là triệu chứng "tôi đăng bài rồi mà danh sách không có" — bài đã vào database, chỉ là trang `/posts` đang dùng bản cache.

---

## 7. Gọi action ngoài form

Với nút xoá, nút like — không cần `<form>`:

```tsx
'use client'

import { useTransition } from 'react'
import { deletePost } from '@/app/actions'

export default function DeleteButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition()

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm('Xoá bài này?')) return
        startTransition(() => deletePost(id))
      }}
    >
      {pending ? 'Đang xoá...' : 'Xoá'}
    </button>
  )
}
```

`startTransition` giữ giao diện phản hồi được trong lúc chờ và cho bạn cờ `pending`. Gọi `deletePost(id)` trần cũng chạy, nhưng bạn mất trạng thái chờ.

Truyền tham số kèm form thì dùng `bind`:

```tsx
import { deletePost } from '@/app/actions'

export default function PostRow({ post }) {
  const deleteWithId = deletePost.bind(null, post.id)

  return (
    <form action={deleteWithId}>
      <button type="submit">Xoá</button>
    </form>
  )
}
```

Cách này chạy được **cả khi JavaScript chưa tải xong** — vì nó là form HTML thật.

---

## 8. Cập nhật lạc quan với `useOptimistic`

Hiện kết quả ngay lập tức, chờ server xác nhận sau:

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { addComment } from '@/app/actions'

export default function CommentList({
  postId,
  initial,
}: {
  postId: number
  initial: Comment[]
}) {
  const [, startTransition] = useTransition()
  const [comments, addOptimistic] = useOptimistic(
    initial,
    (state: Comment[], newText: string) => [
      ...state,
      { id: Date.now(), content: newText, author: { name: 'Bạn' }, pending: true },
    ],
  )

  return (
    <>
      <ul>
        {comments.map((c) => (
          <li key={c.id} className={c.pending ? 'opacity-50' : ''}>
            <b>{c.author.name}</b>: {c.content}
          </li>
        ))}
      </ul>

      <form
        action={(formData) => {
          const text = formData.get('content') as string
          startTransition(() => {
            addOptimistic(text)               // hiện ngay, mờ 50%
            addComment(postId, formData)      // gửi lên server
          })
        }}
      >
        <input name="content" />
        <button type="submit">Gửi</button>
      </form>
    </>
  )
}
```

Người dùng thấy:

```
t=0ms     bình luận hiện ngay, chữ mờ
t=300ms   server trả lời, chữ đậm lại (dữ liệu thật thay vào)
```

Nếu server trả lỗi, React **tự động gỡ** bình luận lạc quan đó ra — bạn không cần dọn thủ công.

---

## 9. Bảo mật: điều quan trọng nhất của bài này

**Mọi Server Action đều là một endpoint POST công khai.** Ai cũng gọi được bằng `curl`, bỏ qua toàn bộ giao diện của bạn.

```ts
// ❌ NGUY HIỂM
'use server'
export async function deletePost(id: number) {
  await db.post.delete({ where: { id } })     // ai cũng xoá được bài của người khác
}
```

```ts
// ✅ Luôn kiểm tra ngay trong action
'use server'

import { getCurrentUser } from '@/lib/auth'

export async function deletePost(id: number) {
  const user = await getCurrentUser()
  if (!user) {
    return { message: 'Bạn chưa đăng nhập' }
  }

  const post = await db.post.findUnique({ where: { id } })
  if (!post) {
    return { message: 'Bài viết không tồn tại' }
  }

  if (post.authorId !== user.id && user.role !== 'admin') {
    return { message: 'Không có quyền xoá bài này' }
  }

  await db.post.delete({ where: { id } })
  revalidatePath('/posts')
}
```

Ba điều tuyệt đối không được quên:

1. **Kiểm tra đăng nhập trong từng action** — đừng dựa vào `proxy.ts`. Server Action là POST tới chính URL của trang, nên một thay đổi matcher hoặc việc chuyển action sang route khác có thể âm thầm bỏ qua lớp bảo vệ đó.
2. **Kiểm tra quyền sở hữu**, không chỉ đăng nhập. Đăng nhập rồi không có nghĩa được xoá bài người khác.
3. **Validate lại mọi input.** `<input maxlength="200">` chỉ là gợi ý cho trình duyệt, không phải rào chắn.

Đừng dùng `'use server'` cho file chứa hàm nội bộ — mọi export trong file đó đều thành endpoint công khai:

```ts
// ❌ src/lib/db-helpers.ts
'use server'
export async function rawQuery(sql: string) {   // giờ ai cũng chạy SQL tuỳ ý được
  return db.$queryRawUnsafe(sql)
}
```

---

## 10. Ghép lại: form tạo bài viết hoàn chỉnh

```tsx
// src/app/posts/new/page.tsx — Server Component
import PostForm from '@/components/PostForm'
import { getCategories } from '@/lib/api'

export default async function NewPostPage() {
  const categories = await getCategories()      // lấy dữ liệu ở server

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Viết bài mới</h1>
      <PostForm categories={categories} />       {/* form là client */}
    </div>
  )
}
```

Đây là mẫu chuẩn cho mọi trang có form: **Server Component lấy dữ liệu → truyền props → Client Component lo tương tác.**

---

## Bài tập

1. Viết action `createPost` in `formData.get('title')` ra terminal. Xác nhận không có gì ở console trình duyệt.
2. Mở tab Network lúc submit, tìm header `Next-Action` và chép lại.
3. Thêm Zod schema cho `title`, `content`, `categoryId`. Submit dữ liệu sai và chép lại `fieldErrors` ở terminal.
4. Dùng `useActionState` đưa lỗi lên màn hình. Xác nhận trang không reload và dữ liệu đã gõ vẫn còn.
5. Viết action với thứ tự tham số ngược `(formData, prevState)` để gặp `TypeError: formData.get is not a function`.
6. Đặt `SubmitButton` (dùng `useFormStatus`) ngoài `<form>`, xác nhận `pending` luôn `false`, rồi chuyển vào trong.
7. Bọc `redirect()` trong `try/catch` và quan sát hiện tượng trang đứng yên. Sửa lại.
8. Viết `DeleteButton` với `useTransition`, có xác nhận trước khi xoá.
9. Viết `deletePost` kiểm tra đủ 3 lớp: đăng nhập → bài tồn tại → đúng quyền sở hữu.
10. Nâng cao: thêm `useOptimistic` cho form bình luận.

Tiếp theo 👉 [05-route-handler-va-proxy.md](./05-route-handler-va-proxy.md)
