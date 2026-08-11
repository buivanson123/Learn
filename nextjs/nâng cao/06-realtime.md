# Bài 6 (NC) — Realtime: SSE, WebSocket, polling

## 1. Chọn cơ chế nào

| Cơ chế | Chiều | Hợp với | Chi phí |
|---|---|---|---|
| **Polling** | client hỏi | Cập nhật chậm (mỗi 30s+) | Nhiều request thừa |
| **SSE** | server → client | Thông báo, tiến độ job, live count | 1 kết nối mở |
| **WebSocket** | hai chiều | Chat, cộng tác, game | 1 kết nối mở, hạ tầng phức tạp hơn |

Quy tắc chọn:

- Chỉ cần **server đẩy xuống** → **SSE**. Đơn giản hơn WebSocket rất nhiều, chạy trên HTTP thường, tự kết nối lại.
- Cần **client gửi lên liên tục** → WebSocket.
- Cập nhật mỗi 30 giây trở lên và không quan trọng độ trễ → polling, đừng phức tạp hoá.

> ⚠️ **Next.js không phải nơi host WebSocket server.** Nó không có API để giữ kết nối WS lâu dài trên route handler, và trên serverless thì càng không. Bạn đã có NestJS — dùng `@WebSocketGateway` ở đó ([../../nestjs/11-websocket-co-ban.md](../../nestjs/11-websocket-co-ban.md)). Next.js chỉ đóng vai client.

---

## 2. SSE với Route Handler

SSE thì Next.js làm được ngon vì nó chỉ là một HTTP response không đóng.

```ts
// app/api/notifications/route.ts
import { requireUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'      // không được prerender

export async function GET(request: Request) {
  const user = await requireUser()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        )
      }

      send('connected', { userId: user.id, at: Date.now() })

      // Heartbeat: giữ kết nối sống qua proxy
      const heartbeat = setInterval(() => {
        if (closed) return
        controller.enqueue(encoder.encode(': ping\n\n'))   // dòng bắt đầu bằng ':' là comment
      }, 15_000)

      // Nguồn dữ liệu thật: đây dùng polling backend, thực tế nên là Redis pub/sub
      const poll = setInterval(async () => {
        if (closed) return
        try {
          const items = await apiFetch(`/notifications/unread`, { cache: 'no-store' })
          if (items.length) send('notification', items)
        } catch (e) {
          console.error('[sse] lỗi lấy thông báo:', e)
        }
      }, 5_000)

      // BẮT BUỘC: dọn khi client ngắt
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(heartbeat)
        clearInterval(poll)
        controller.close()
        console.log('[sse] client ngắt kết nối')
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

Bốn dòng sống còn, thiếu cái nào cũng hỏng theo cách riêng:

| Dòng | Thiếu thì sao |
|---|---|
| `request.signal` abort listener | **Rò rỉ nghiêm trọng** — interval chạy mãi sau khi client đóng tab, server chết dần |
| Heartbeat 15 giây | nginx/CDN cắt kết nối "im lặng" sau ~60 giây |
| `X-Accel-Buffering: no` | nginx gom lại, client không nhận được gì cho tới khi kết nối đóng |
| `dynamic = 'force-dynamic'` | Next.js thử prerender endpoint lúc build và treo |

Test bằng curl:

```bash
$ curl -N -s localhost:3001/api/notifications
event: connected
data: {"userId":3,"at":1754900123456}

: ping

event: notification
data: [{"id":91,"content":"An đã bình luận bài của bạn"}]

: ping
```

Định dạng SSE rất đơn giản: mỗi message là các dòng `field: value`, kết thúc bằng **một dòng trống**. Quên dòng trống thứ hai (`\n\n`) là client không bao giờ nhận được gì — lỗi này rất hay gặp.

### Phía client

```tsx
// components/NotificationBell.tsx
'use client'

import { useEffect, useState } from 'react'

type Notification = { id: number; content: string }

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [status, setStatus] = useState<'connecting' | 'open' | 'error'>('connecting')

  useEffect(() => {
    const es = new EventSource('/api/notifications')

    es.addEventListener('connected', () => setStatus('open'))

    es.addEventListener('notification', (e) => {
      const data = JSON.parse(e.data) as Notification[]
      setItems((prev) => [...data, ...prev].slice(0, 20))
    })

    es.onerror = () => {
      setStatus('error')
      // EventSource TỰ kết nối lại — không tự gọi es.close() ở đây
    }

    return () => es.close()      // đóng khi component unmount
  }, [])

  return (
    <div className="relative">
      <button className="relative">
        🔔
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1 text-xs text-white">
            {items.length}
          </span>
        )}
      </button>
      {status === 'error' && <span className="text-xs text-gray-400">mất kết nối...</span>}
    </div>
  )
}
```

Ưu điểm lớn của `EventSource`: **tự kết nối lại khi rớt mạng**, không cần bạn viết logic backoff. Đừng gọi `es.close()` trong `onerror` — làm vậy là bạn tắt mất tính năng đó.

### Giới hạn phải biết

| Giới hạn | Chi tiết |
|---|---|
| HTTP/1.1: 6 kết nối/domain | Mở 2 SSE là còn 4 cho mọi thứ khác. HTTP/2 thì không sao (100+) |
| Không gửi header tuỳ ý | `EventSource` không cho set `Authorization` → dùng cookie (bạn đã có httpOnly rồi) |
| Chỉ một chiều | Client muốn gửi lên thì dùng Server Action hoặc `fetch` riêng |
| Serverless có timeout | Nhiều nền tảng cắt sau 30–300 giây |

---

## 3. WebSocket: Next.js làm client, NestJS làm server

```bash
npm i socket.io-client
```

```tsx
// components/CommentLive.tsx
'use client'

import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { Comment } from '@/lib/types'

export default function CommentLive({
  postId,
  initial,
}: {
  postId: number
  initial: Comment[]
}) {
  const [comments, setComments] = useState(initial)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const socket: Socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      withCredentials: true,          // gửi kèm cookie httpOnly để NestJS xác thực
      transports: ['websocket'],
    })

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join', { room: `post-${postId}` })
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('comment:new', (comment: Comment) => {
      setComments((prev) =>
        prev.some((c) => c.id === comment.id) ? prev : [...prev, comment],
      )
    })

    return () => {
      socket.emit('leave', { room: `post-${postId}` })
      socket.disconnect()
    }
  }, [postId])

  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
        <span className={connected ? 'text-green-600' : 'text-gray-400'}>●</span>
        {connected ? 'Đang kết nối trực tiếp' : 'Ngoại tuyến'}
      </div>
      <ul>
        {comments.map((c) => (
          <li key={c.id}><b>{c.author.name}</b>: {c.content}</li>
        ))}
      </ul>
    </section>
  )
}
```

Ba điểm dễ sai:

1. **`NEXT_PUBLIC_WS_URL`** — client cần biết URL nên phải có tiền tố `NEXT_PUBLIC_`. Đây là URL công khai, không phải secret, nên không sao.
2. **`withCredentials: true`** — để cookie httpOnly đi kèm, NestJS mới xác thực được. Nhớ cấu hình CORS bên NestJS cho phép origin của Next.js.
3. **Chống trùng khi kiểm tra `some()`** — dữ liệu ban đầu render từ server có thể đã chứa comment vừa được broadcast. Không lọc là hiện hai lần.

### Ghép với dữ liệu server

Vấn đề: bạn có comment mới qua WebSocket, nhưng nếu người dùng F5 thì Next.js lấy lại từ cache.

```tsx
'use client'
import { useRouter } from 'next/navigation'

const router = useRouter()

socket.on('comment:new', (comment) => {
  setComments((prev) => [...prev, comment])   // cập nhật UI ngay
  router.refresh()                             // đồng bộ lại dữ liệu server
})
```

> ⚠️ Đừng gọi `router.refresh()` mỗi message. Bài viết đông người bình luận sẽ khiến bạn bắn hàng chục request/giây. Gom lại:
> ```tsx
> const timer = useRef<NodeJS.Timeout>()
> socket.on('comment:new', (c) => {
>   setComments((prev) => [...prev, c])
>   clearTimeout(timer.current)
>   timer.current = setTimeout(() => router.refresh(), 3000)
> })
> ```

---

## 4. Polling — đừng coi thường

Với nhiều bài toán, polling là câu trả lời đúng: đơn giản, không giữ kết nối, không cần hạ tầng đặc biệt.

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { getUnreadCount } from '@/app/actions'

export default function UnreadBadge({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const tick = () => {
      // Tab bị ẩn thì không hỏi — tiết kiệm pin và băng thông
      if (document.hidden) return
      startTransition(async () => setCount(await getUnreadCount()))
    }

    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)   // quay lại tab thì cập nhật ngay

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return count > 0 ? <span className="badge">{count}</span> : null
}
```

Hai dòng làm nên khác biệt: **kiểm tra `document.hidden`** và **cập nhật ngay khi quay lại tab**. Không có chúng, 1.000 tab đang mở nền vẫn nện 1.000 request mỗi 30 giây vào backend của bạn.

Ước lượng tải trước khi chọn polling:

```
1.000 người dùng × mỗi 30 giây = 33 req/s
10.000 người dùng × mỗi 30 giây = 333 req/s     ← lúc này nên chuyển sang SSE
```

---

## 5. `after()` — làm việc sau khi trả response

Ghi log, gửi analytics, cập nhật lượt xem — những việc người dùng không cần chờ.

```ts
import { after } from 'next/server'

export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params
  const post = await getPost(slug)

  after(async () => {
    // Chạy SAU khi response đã gửi xong
    await apiFetch(`/posts/${post.id}/view`, { method: 'POST' })
    console.log('[analytics] đã ghi lượt xem', post.id)
  })

  return <article><h1>{post.title}</h1></article>
}
```

Terminal:

```
 GET /posts/hoc-nextjs 200 in 118ms       ← người dùng đã nhận trang
[analytics] đã ghi lượt xem 42            ← việc nền chạy sau
```

Không có `after()`, lời gọi ghi lượt xem cộng thẳng vào thời gian chờ của người dùng.

Dùng được ở: Server Component, Server Action, Route Handler, `proxy.ts`.

> ⚠️ Self-host thì phải cho container **thời gian tắt êm** (10–30 giây). Gửi `SIGTERM` rồi kill ngay lập tức sẽ mất các callback `after()` đang chờ:
> ```yaml
> services:
>   web:
>     stop_grace_period: 30s
> ```

---

## 6. Bảng quyết định

```
Cần cập nhật realtime?
│
├─ Người dùng cũng gửi dữ liệu lên liên tục?
│   └─ CÓ → WebSocket (server ở NestJS, Next.js làm client)
│
└─ Chỉ server đẩy xuống?
    ├─ Độ trễ phải dưới ~2 giây?
    │   └─ CÓ → SSE
    └─ 30 giây một lần là đủ?
        └─ Polling + document.hidden
```

Và một câu hỏi trước tất cả: **có thật sự cần realtime không?** Rất nhiều tính năng "realtime" chỉ cần `router.refresh()` sau một Server Action là đủ. Giữ kết nối mở tốn tài nguyên thật, ở cả server lẫn thiết bị người dùng.

---

## 7. Áp vào Blog: tiến độ xuất file

Ghép [bài 03](<./03-du-lieu-lon.md#5-xuất-file-lớn-đừng-gom-vào-ram>) với SSE — báo tiến độ job xuất CSV chạy nền:

```ts
// app/api/export/[jobId]/progress/route.ts
export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: RouteContext<'/api/export/[jobId]/progress'>) {
  await requireUser()
  const { jobId } = await ctx.params
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false

      const timer = setInterval(async () => {
        if (closed) return

        const job = await apiFetch<{ percent: number; status: string; url?: string }>(
          `/jobs/${jobId}`,
          { cache: 'no-store' },
        )

        controller.enqueue(
          encoder.encode(`event: progress\ndata: ${JSON.stringify(job)}\n\n`),
        )

        if (job.status === 'done' || job.status === 'failed') {
          closed = true
          clearInterval(timer)
          controller.close()
        }
      }, 1000)

      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(timer)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

```tsx
'use client'

export default function ExportProgress({ jobId }: { jobId: string }) {
  const [percent, setPercent] = useState(0)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const es = new EventSource(`/api/export/${jobId}/progress`)

    es.addEventListener('progress', (e) => {
      const job = JSON.parse(e.data)
      setPercent(job.percent)
      if (job.status === 'done') {
        setUrl(job.url)
        es.close()
      }
    })

    return () => es.close()
  }, [jobId])

  if (url) return <a href={url} className="text-blue-600 underline">Tải file CSV</a>

  return (
    <div className="h-2 w-full rounded bg-gray-200">
      <div className="h-2 rounded bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}
```

Phần queue chạy ở NestJS + BullMQ — xem [../../nestjs/nang-cao/05-queue-va-job-nen.md](../../nestjs/nang-cao/05-queue-va-job-nen.md).

---

## 8. Checklist realtime

```
[ ] SSE: có request.signal abort listener (chống rò rỉ)
[ ] SSE: có heartbeat mỗi 15 giây
[ ] SSE: header X-Accel-Buffering: no
[ ] SSE: export const dynamic = 'force-dynamic'
[ ] SSE: message kết thúc bằng \n\n
[ ] SSE: endpoint có kiểm tra đăng nhập
[ ] WebSocket: server ở NestJS, không cố host trong Next.js
[ ] WebSocket: withCredentials + CORS đã cấu hình
[ ] WebSocket: chống trùng khi gộp với dữ liệu server
[ ] router.refresh() có debounce, không gọi mỗi message
[ ] Polling: kiểm tra document.hidden
[ ] Polling: đã ước lượng req/s ở lượng người dùng mục tiêu
[ ] after(): container có stop_grace_period đủ dài
```

Kiểm tra rò rỉ SSE — thứ đáng lo nhất:

```bash
# Mở 5 kết nối rồi ngắt hết
$ for i in {1..5}; do timeout 3 curl -sN localhost:3001/api/notifications > /dev/null & done
$ sleep 6

# Terminal Next.js phải in đủ 5 dòng:
[sse] client ngắt kết nối
[sse] client ngắt kết nối
[sse] client ngắt kết nối
[sse] client ngắt kết nối
[sse] client ngắt kết nối
```

Ít hơn 5 dòng, hoặc thấy log polling vẫn chạy tiếp, nghĩa là bạn đang rò rỉ interval.

---

## Bài tập

1. Viết `/api/notifications` bằng SSE. Test bằng `curl -N` và chép lại output có cả `: ping`.
2. Cố tình bỏ dòng trống thứ hai (`\n\n`) và quan sát client không nhận được gì.
3. Bỏ `request.signal` abort listener. Mở/đóng tab 5 lần rồi xem terminal — quan sát interval vẫn chạy.
4. Chạy bài test rò rỉ ở mục 8 và xác nhận đủ 5 dòng log.
5. Viết `NotificationBell` dùng `EventSource`. Tắt server rồi bật lại, quan sát nó tự kết nối lại (tab Network).
6. Ghép Next.js với `@WebSocketGateway` của NestJS cho bình luận realtime. Mở 2 cửa sổ trình duyệt để kiểm tra.
7. Tạo tình huống comment hiện hai lần (dữ liệu server + broadcast), rồi sửa bằng kiểm tra `some()`.
8. Viết `UnreadBadge` polling. Bỏ `document.hidden` đi, mở 5 tab nền và đếm request ở tab Network.
9. Dùng `after()` để ghi lượt xem. So sánh `in ...ms` ở terminal trước và sau khi dùng.
10. Đặt `stop_grace_period: 1s` rồi restart container trong lúc có `after()` đang chờ — quan sát callback bị mất.

Tiếp theo 👉 [07-kien-truc-quy-mo-lon.md](<./07-kien-truc-quy-mo-lon.md>)
