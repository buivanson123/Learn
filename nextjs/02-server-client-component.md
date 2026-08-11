# Bài 2 — Server Component vs Client Component

Đây là khái niệm khó nhất của Next.js và cũng là thứ phân biệt người dùng được với người chỉ copy code. Dành đủ thời gian cho bài này.

## 1. Vấn đề mà nó giải quyết

Cách viết frontend truyền thống: server gửi một file HTML gần như rỗng + một đống JavaScript. Trình duyệt tải JS, chạy JS, JS gọi API, rồi mới vẽ được nội dung.

```
Người dùng bấm vào /posts
  → tải HTML rỗng          (nhìn thấy: trắng)
  → tải bundle.js 300KB    (nhìn thấy: trắng)
  → JS chạy, gọi /api/posts (nhìn thấy: spinner)
  → có dữ liệu, vẽ ra       (nhìn thấy: nội dung)  ← mất 2-3 giây
```

Server Component đảo ngược: **render trên server trước, gửi HTML đã có nội dung xuống**.

```
Người dùng bấm vào /posts
  → server gọi API, render xong, gửi HTML có sẵn nội dung  ← nhìn thấy ngay
  → tải JS chỉ cho phần cần tương tác
```

Cái giá phải trả: có những thứ **không thể** chạy trên server (state, sự kiện click, `window`). Đó là lúc cần Client Component.

---

## 2. Mặc định là Server Component

Mọi file trong `app/` **mặc định là Server Component**. Không cần khai báo gì.

```tsx
// app/posts/page.tsx — Server Component
export default async function PostsPage() {
  const res = await fetch('http://localhost:3000/api/posts')
  const { data } = await res.json()

  console.log('Tôi chạy ở đâu?')

  return <ul>{data.items.map((p) => <li key={p.id}>{p.title}</li>)}</ul>
}
```

Chạy và quan sát `console.log`:

```
$ npm run dev
...
Tôi chạy ở đâu?        ← in ra TERMINAL, không phải console trình duyệt
 GET /posts 200 in 187ms
```

Mở console trình duyệt (F12) — **không có gì**. Đó là bằng chứng: component này chạy ở server.

### Kiểm chứng lần hai: xem HTML nguồn

```bash
$ curl -s localhost:3001/posts | grep -o '<li>[^<]*</li>' | head -3
<li>Học NestJS trong 7 ngày</li>
<li>Docker cho người mới</li>
<li>TypeScript cơ bản</li>
```

Nội dung nằm sẵn trong HTML. Google, Facebook crawler, hay người dùng tắt JavaScript đều đọc được.

So sánh với một app React thuần:

```bash
$ curl -s localhost:5173 | grep -o '<div id="root">.*</div>'
<div id="root"></div>          ← rỗng, nội dung chỉ có sau khi JS chạy
```

---

## 3. Server Component làm được gì

```tsx
// app/posts/page.tsx
import { db } from '@/lib/db'
import fs from 'node:fs/promises'

export default async function Page() {
  // 1. await thẳng, không cần useEffect
  const res = await fetch('http://localhost:3000/api/posts')

  // 2. đọc biến môi trường bí mật — KHÔNG lộ ra trình duyệt
  const secret = process.env.API_SECRET

  // 3. gọi thẳng database
  const users = await db.query('SELECT * FROM users')

  // 4. đọc file trên máy chủ
  const config = await fs.readFile('./config.json', 'utf-8')

  return <div>...</div>
}
```

Tất cả những dòng này, nếu viết trong Client Component, sẽ hỏng hoặc làm lộ dữ liệu.

### Cấm gì

| Không dùng được | Lý do |
|---|---|
| `useState`, `useReducer` | Server render một lần rồi xong, không có state theo thời gian |
| `useEffect` | Không có vòng đời component ở server |
| `onClick`, `onChange`, `onSubmit` | Hàm không serialize được để gửi xuống trình duyệt |
| `window`, `document`, `localStorage` | Server không có DOM |
| Context của React (`useContext`) | Cần runtime React ở client |

Thử `onClick` trong Server Component:

```tsx
export default function Page() {
  return <button onClick={() => alert('hi')}>Bấm</button>
}
```

```
Error: Event handlers cannot be passed to Client Component props.
  <button onClick={function onClick} children="Bấm">
                   ^^^^^^^^^^^^^^^^^
If you need interactivity, consider converting part of this to a Client Component.
```

---

## 4. `'use client'` — mở ranh giới

Thêm `'use client'` ở **dòng đầu tiên** của file (trước cả import):

```tsx
// components/LikeButton.tsx
'use client'

import { useState } from 'react'

export default function LikeButton({ initial }: { initial: number }) {
  const [likes, setLikes] = useState(initial)

  return (
    <button onClick={() => setLikes(likes + 1)}>
      ❤️ {likes}
    </button>
  )
}
```

Đặt sai vị trí (sau import) sẽ bị bỏ qua âm thầm rồi lỗi ở chỗ khác:

```tsx
import { useState } from 'react'
'use client'                    // ❌ vô tác dụng
```

```
Error: useState only works in Client Components.
Add the "use client" directive at the top of the file to use it.
```

### `'use client'` lan ra toàn bộ cây import

Đây là điều quan trọng nhất và cũng hay bị hiểu sai nhất.

```tsx
// components/Dashboard.tsx
'use client'
import Chart from './Chart'          // Chart cũng thành Client Component
import { formatDate } from '@/lib/utils'   // utils cũng bị gửi xuống trình duyệt
```

`Chart.tsx` **không cần** viết `'use client'` — nó tự động thành Client Component vì được import từ một file đã là client.

Hệ quả tai hại nếu đặt sai chỗ:

```tsx
// ❌ app/layout.tsx
'use client'                        // kéo TOÀN BỘ ứng dụng xuống trình duyệt
```

Bạn mất sạch lợi ích của server rendering. Kiểm chứng bằng cách so bundle size:

```bash
$ npm run build
# Với 'use client' ở layout gốc:
Route (app)                          
┌ ○ /                          
├ ○ /posts                     
# Bundle client tăng vọt, mọi file lib đều bị kéo vào
```

**Quy tắc: đẩy `'use client'` xuống càng sâu càng tốt.** Chỉ đúng component cần state/sự kiện mới đánh dấu.

---

## 5. Ghép hai loại lại với nhau

Server Component **được phép** render Client Component:

```tsx
// app/posts/[slug]/page.tsx — Server Component
import LikeButton from '@/components/LikeButton'

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const res = await fetch(`http://localhost:3000/api/posts/slug/${slug}`)
  const { data: post } = await res.json()

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
      <LikeButton initial={post.likeCount} />   {/* ← client, nhận props từ server */}
    </article>
  )
}
```

Chiều ngược lại **không được**: Client Component không import trực tiếp Server Component.

```tsx
'use client'
import ServerThing from './ServerThing'   // ❌ ServerThing bị biến thành client luôn
```

### Cách lách: truyền qua `children`

Đây là mẫu quan trọng nhất trong bài này.

```tsx
// components/Collapsible.tsx — Client, lo phần đóng/mở
'use client'
import { useState } from 'react'

export default function Collapsible({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setOpen(!open)}>
        {open ? 'Thu gọn' : 'Xem bình luận'}
      </button>
      {open && children}
    </div>
  )
}
```

```tsx
// app/posts/[slug]/page.tsx — Server
import Collapsible from '@/components/Collapsible'
import Comments from '@/components/Comments'      // vẫn là Server Component!

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params

  return (
    <article>
      <Collapsible>
        <Comments slug={slug} />     {/* render ở server, chỉ truyền kết quả xuống */}
      </Collapsible>
    </article>
  )
}
```

`Comments` vẫn chạy ở server (có thể `await fetch`), nhưng được đóng/mở bởi state ở client. Được như vậy vì Server Component render **trước**, kết quả đã thành dữ liệu tĩnh khi tới tay `Collapsible`.

Sơ đồ tư duy: `'use client'` lan theo **import**, không lan theo **children**.

---

## 6. Props truyền từ Server sang Client phải serialize được

Ranh giới server → client là một lần gửi dữ liệu qua mạng. Nên props phải chuyển được thành chuỗi.

```tsx
// ✅ Được
<LikeButton
  initial={42}
  title="Học Next.js"
  tags={['nextjs', 'react']}
  post={{ id: 1, title: 'abc' }}
  createdAt={new Date()}            // Date được hỗ trợ
/>

// ❌ Không được
<LikeButton
  onSave={() => save()}             // hàm thường
  db={dbConnection}                 // instance class
  icon={Symbol('icon')}
/>
```

Lỗi khi truyền hàm:

```
Error: Functions cannot be passed directly to Client Components unless you
explicitly expose it by marking it with "use server". Or maybe you meant to
call this function rather than return it.
  <... initial={42} onSave={function onSave}>
                           ^^^^^^^^^^^^^^^^
```

Ngoại lệ duy nhất: hàm được đánh dấu `'use server'` (Server Action) **truyền được** — xem bài [04](./04-server-actions-va-form.md).

---

## 7. Quyết định: dùng loại nào

Bảng tra nhanh:

| Bạn cần | Loại |
|---|---|
| Lấy dữ liệu từ API/DB | **Server** |
| Dùng secret, API key | **Server** |
| Nội dung cần Google index | **Server** |
| Xử lý dữ liệu nặng (parse markdown, format lớn) | **Server** |
| `useState`, `useReducer` | Client |
| `onClick`, `onChange`, `onSubmit` | Client |
| `useEffect`, timer, WebSocket | Client |
| `localStorage`, `window`, `navigator` | Client |
| Thư viện chỉ chạy ở trình duyệt (chart, map, editor) | Client |

**Mặc định luôn là Server. Chỉ đổi sang Client khi gặp một dòng trong nửa dưới của bảng.**

### Mẫu thực tế: tách nhỏ để tối ưu

Trang chi tiết bài viết, chỉ nút Like cần tương tác:

```
❌ Cách sai — cả trang thành client
app/posts/[slug]/page.tsx  ('use client')
  → phải useEffect + fetch để lấy dữ liệu
  → nội dung không có trong HTML, Google không thấy
  → gửi cả thư viện markdown xuống trình duyệt

✅ Cách đúng — chỉ nút Like là client
app/posts/[slug]/page.tsx           Server: await fetch, render nội dung
  └── components/LikeButton.tsx     Client: useState + onClick
```

Chênh lệch đo được. Sau `npm run build`, xem tab Network khi tải trang:

```
Cách sai:  JS gửi xuống ~ 180 KB, nội dung xuất hiện sau ~1.4s
Cách đúng: JS gửi xuống ~ 92 KB,  nội dung có ngay trong HTML (0s)
```

---

## 8. Hai bẫy hay gặp

### Bẫy 1: thư viện của bên thứ ba chưa hỗ trợ

Nhiều package npm dùng `useState` bên trong nhưng chưa thêm `'use client'`:

```tsx
// app/page.tsx (Server Component)
import { Carousel } from 'some-slider-lib'

export default function Page() {
  return <Carousel />
}
```

```
Error: useState only works in Client Components.
   ╭─[node_modules/some-slider-lib/dist/index.js:12:1]
```

Cách sửa — bọc lại bằng file của bạn:

```tsx
// components/CarouselWrapper.tsx
'use client'
export { Carousel } from 'some-slider-lib'
```

```tsx
// app/page.tsx
import { Carousel } from '@/components/CarouselWrapper'   // giờ chạy được
```

### Bẫy 2: `window is not defined`

```tsx
'use client'
export default function Widget() {
  const width = window.innerWidth      // ❌
  return <p>{width}</p>
}
```

```
ReferenceError: window is not defined
    at Widget (src/components/Widget.tsx:3:17)
```

Ngạc nhiên? Client Component **vẫn được render trước một lần ở server** (đó là cách Next.js sinh HTML ban đầu). "Client" nghĩa là "được gửi xuống client và chạy tiếp ở đó", không phải "chỉ chạy ở client".

Sửa bằng `useEffect` — nó chỉ chạy ở trình duyệt:

```tsx
'use client'
import { useEffect, useState } from 'react'

export default function Widget() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setWidth(window.innerWidth)
  }, [])

  return <p>{width}</p>
}
```

Với thư viện hoàn toàn không chạy được ở server, tắt SSR cho nó:

```tsx
'use client'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <p>Đang tải bản đồ...</p>,
})
```

> ⚠️ `dynamic(..., { ssr: false })` **chỉ dùng được trong Client Component**. Gọi nó từ Server Component sẽ lỗi:
> ```
> Error: `ssr: false` is not allowed with `next/dynamic` in Server Components.
> Please move it into a Client Component.
> ```

---

## 9. Ranh giới hiển thị bằng mắt

Cách nhanh nhất để biết một component đang chạy ở đâu — thêm dòng này vào bất kỳ component nào:

```tsx
console.log(typeof window === 'undefined' ? '[SERVER]' : '[CLIENT]')
```

Kết quả với Server Component:

```
terminal:   [SERVER]
trình duyệt: (không có gì)
```

Với Client Component:

```
terminal:   [SERVER]      ← lần render đầu để sinh HTML
trình duyệt: [CLIENT]      ← rồi hydrate và chạy tiếp
```

Hai dòng đó chính là bằng chứng cho bẫy `window is not defined` ở mục 8.

---

## Bài tập

1. Tạo `app/test/page.tsx` với `console.log('xin chào')`. Xác nhận nó in ở terminal chứ không phải console trình duyệt.
2. Chạy `curl -s localhost:3001/posts | grep '<li'` và xác nhận tiêu đề bài viết nằm sẵn trong HTML.
3. Viết `LikeButton` (client) nhận `initial` từ trang chi tiết bài viết (server).
4. Cố tình đặt `onClick` trong Server Component, chép lại nguyên văn lỗi.
5. Cố tình truyền một hàm làm prop cho Client Component, chép lại lỗi.
6. Viết `Collapsible` (client) bọc `Comments` (server) qua `children`. Thêm `console.log` vào `Comments` và xác nhận nó in ở **terminal**.
7. Viết một Client Component đọc `window.innerWidth` trực tiếp để gặp `ReferenceError`, rồi sửa bằng `useEffect`.
8. Thêm dòng `console.log(typeof window === 'undefined' ? '[SERVER]' : '[CLIENT]')` vào cả Server và Client Component, ghi lại nơi mỗi dòng xuất hiện.

Tiếp theo 👉 [03-lay-du-lieu-va-cache.md](./03-lay-du-lieu-va-cache.md)
