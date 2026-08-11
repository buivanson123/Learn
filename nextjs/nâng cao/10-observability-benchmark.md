# Bài 10 (NC) — Đo lường & vận hành

Bài cuối. Không đo được thì không biết cái gì chậm, và mọi việc tối ưu chỉ là đoán.

## 1. `instrumentation.ts` — chạy lúc server khởi động

Đặt ở **gốc dự án** (hoặc trong `src/` nếu bạn dùng `src/`), ngang hàng với `app/`:

```
src/
├── app/
├── instrumentation.ts     ← đúng chỗ
└── proxy.ts
```

```ts
// src/instrumentation.ts
export async function register() {
  console.log('[boot] khởi động, runtime =', process.env.NEXT_RUNTIME)

  await import('./lib/env')          // validate biến môi trường — xem bài 07

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node')
  }
}
```

```
$ npm start
[boot] khởi động, runtime = nodejs
  ▲ Next.js 16.3.0
  - Local: http://localhost:3001
 ✓ Ready in 412ms
```

`register()` chạy **một lần** trước mọi request. Chỗ đúng để: khởi tạo tracer, kết nối tới hệ thống log, kiểm tra cấu hình.

---

## 2. OpenTelemetry

```bash
npm i @vercel/otel @opentelemetry/sdk-logs @opentelemetry/api-logs @opentelemetry/instrumentation
```

```ts
// src/instrumentation.ts
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'blog-web' })
}
```

Chạy collector tại chỗ để xem thử:

```bash
$ git clone https://github.com/vercel/opentelemetry-collector-dev-setup
$ cd opentelemetry-collector-dev-setup && docker compose up -d
# Jaeger UI: http://localhost:16686
```

Tải một trang rồi mở Jaeger, bạn thấy cây span:

```
GET /posts/[slug]                                    312ms
├── resolve page components                            4ms
├── generateMetadata /posts/[slug]                    98ms
│   └── fetch GET http://localhost:3000/api/posts...  94ms
├── render route (app) /posts/[slug]                 201ms
│   ├── fetch GET http://localhost:3000/api/posts...   2ms   ← dedupe, cache hit
│   └── fetch GET http://localhost:3000/api/comm...  187ms   ← thủ phạm
└── start response                                     1ms
```

Đây là thứ mà log thường không cho bạn: **thấy ngay 187ms trong tổng 312ms nằm ở đâu**. Và span thứ hai chỉ 2ms là bằng chứng cơ chế dedupe của `fetch` đang hoạt động ([bài 03](<../03-lay-du-lieu-va-cache.md#3-cache-tự-động-dedupe-trong-cùng-một-lần-render>)).

### Span Next.js tự sinh

| Span | Nghĩa |
|---|---|
| `[http.method] [next.route]` | Span gốc mỗi request |
| `render route (app) [next.route]` | Thời gian render |
| `fetch [method] [url]` | Mỗi lời gọi `fetch` của bạn |
| `executing api route (app) [next.route]` | Route Handler |
| `generateMetadata [next.page]` | Sinh metadata |
| `resolve segment modules` | Nạp code của layout/page |
| `start response` | Mốc byte đầu tiên được gửi |

Mặc định Next.js chỉ xuất một phần. Bật đủ:

```bash
NEXT_OTEL_VERBOSE=1 npm start
```

Muốn dùng thư viện instrument fetch riêng thì tắt span fetch của Next.js:

```bash
NEXT_OTEL_FETCH_DISABLED=1
```

### Span tuỳ chỉnh

```ts
import { trace } from '@opentelemetry/api'

export async function getPostWithStats(slug: string) {
  return trace
    .getTracer('blog-web')
    .startActiveSpan('getPostWithStats', async (span) => {
      try {
        span.setAttribute('post.slug', slug)
        const post = await apiFetch<Post>(`/posts/slug/${slug}`)
        span.setAttribute('post.id', post.id)
        return post
      } catch (e) {
        span.recordException(e as Error)
        throw e
      } finally {
        span.end()                    // BẮT BUỘC, nếu không span treo mãi
      }
    })
}
```

`span.end()` trong `finally` là bắt buộc. Quên thì span không bao giờ đóng và trace của bạn đầy rác.

---

## 3. `onRequestError` — bắt mọi lỗi server

```ts
// src/instrumentation.ts
import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  const payload = {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    digest: (err as { digest?: string }).digest,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,        // 'App Router' | 'Pages Router'
    routePath: context.routePath,          // '/posts/[slug]'
    routeType: context.routeType,          // 'render' | 'route' | 'action' | 'middleware'
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
  }

  console.error('[error]', JSON.stringify(payload))

  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    await fetch(process.env.ERROR_WEBHOOK!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }
}
```

Đây là chỗ giải quyết vấn đề `digest` ở [bài 01 cơ bản](<../01-app-router.md#8-errortsx--bắt-lỗi-runtime>): production giấu `error.message`, người dùng chỉ thấy một mã hash. `onRequestError` cho bạn cả hai — ghép được `digest` với thông báo lỗi thật.

```
[error] {"message":"GET /posts/slug/abc → 500","digest":"1847263910",
"path":"/posts/abc","routePath":"/posts/[slug]","routeType":"render"}
```

Người dùng báo "tôi thấy mã 1847263910" → bạn `grep` log ra ngay.

`routeType` cũng đáng giá: nó cho biết lỗi đến từ render, từ Route Handler, hay từ **Server Action** — ba chỗ có cách debug rất khác nhau.

---

## 4. Log có cấu trúc

`console.log` chuỗi thường không tìm kiếm được. Dùng JSON:

```ts
// src/lib/logger.ts
import 'server-only'

type Level = 'debug' | 'info' | 'warn' | 'error'

function log(level: Level, message: string, meta: Record<string, unknown> = {}) {
  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    service: 'blog-web',
    env: process.env.NODE_ENV,
    ...meta,
  }

  if (process.env.NODE_ENV === 'development') {
    console[level === 'debug' ? 'log' : level](`[${level}] ${message}`, meta)
  } else {
    console[level === 'debug' ? 'log' : level](JSON.stringify(entry))
  }
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
}
```

```ts
logger.info('tạo bài viết', { postId: post.id, userId: user.id, durationMs: 142 })
```

```json
{"level":"info","message":"tạo bài viết","time":"2026-08-11T09:42:17.882Z","service":"blog-web","env":"production","postId":42,"userId":3,"durationMs":142}
```

Giờ truy vấn được:

```bash
$ docker compose logs web | jq -c 'select(.level=="error")' | head -5
$ docker compose logs web | jq 'select(.durationMs > 1000) | {message, path, durationMs}'
```

> ⚠️ **Không bao giờ log token, mật khẩu, hay cả object user.** Log `userId: 3`, đừng log `user: {...}`. Rất nhiều vụ rò rỉ đến từ log chứ không phải từ database.

---

## 5. Thu thập Web Vitals từ người dùng thật

Số Lighthouse trên máy bạn không phải số của người dùng.

```tsx
// components/WebVitals.tsx
'use client'
import { useReportWebVitals } from 'next/web-vitals'

export default function WebVitals() {
  useReportWebVitals((metric) => {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
      connection: (navigator as any).connection?.effectiveType,
    })

    // sendBeacon vẫn gửi được cả khi người dùng đang đóng tab
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/vitals', body)
    } else {
      fetch('/api/vitals', { method: 'POST', body, keepalive: true })
    }
  })
  return null
}
```

```ts
// app/api/vitals/route.ts
import { logger } from '@/lib/logger'
import { rateLimit } from '@/lib/rate-limit'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const { ok } = await rateLimit(`vitals:${ip}`, 60, 60)
  if (!ok) return new Response(null, { status: 429 })

  const metric = await request.json()
  logger.info('web-vital', metric)

  return new Response(null, { status: 204 })
}
```

Endpoint này **công khai và ai cũng gọi được** — nhớ rate limit, nếu không nó thành chỗ để người ta bơm rác vào log của bạn.

Tổng hợp:

```bash
$ docker compose logs web --since 24h \
  | jq -c 'select(.message=="web-vital" and .name=="LCP")' \
  | jq -s 'sort_by(.value) | {
      p50: .[length/2|floor].value,
      p75: .[length*3/4|floor].value,
      p95: .[length*95/100|floor].value
    }'
```

```json
{ "p50": 1240, "p75": 2180, "p95": 4720 }
```

**Nhìn p75 và p95, đừng nhìn trung bình.** Trung bình giấu mất nhóm người dùng đang khổ sở nhất. Google cũng dùng p75 để đánh giá Core Web Vitals.

---

## 6. Benchmark bằng k6

```bash
brew install k6      # hoặc: docker run --rm -i grafana/k6 run - < script.js
```

```js
// bench/posts.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const ttfb = new Trend('ttfb')

export const options = {
  stages: [
    { duration: '30s', target: 50 },    // tăng dần
    { duration: '1m', target: 50 },     // giữ tải
    { duration: '30s', target: 200 },   // tăng vọt
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },     // giảm dần
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    ttfb: ['p(95)<400'],
  },
}

export default function () {
  const res = http.get('http://localhost:3001/posts')

  ttfb.add(res.timings.waiting)

  check(res, {
    'trả 200': (r) => r.status === 200,
    'có nội dung trong HTML': (r) => r.body.includes('<h1'),
  })

  sleep(1)
}
```

```bash
$ k6 run bench/posts.js
```

```
     ✓ trả 200
     ✓ có nội dung trong HTML

     checks.........................: 100.00%  ✓ 24180     ✗ 0
     http_req_duration..............: avg=118ms min=8ms med=42ms max=2.1s p(95)=612ms
       { expected_response:true }...: avg=118ms
     http_req_failed................: 0.00%    ✓ 0         ✗ 12090
     ttfb...........................: avg=104ms med=38ms p(95)=584ms
     iterations.....................: 12090   98.2/s
     vus_max........................: 200

     ✓ http_req_duration.........: p(95)=612ms < 800ms
     ✗ ttfb......................: p(95)=584ms < 400ms      ← không đạt
```

`✗` khiến k6 thoát với mã khác 0 — dùng được ngay trong CI.

### So sánh trước/sau tối ưu

Đây mới là cách dùng k6 có giá trị nhất. Ví dụ thật với trang `/posts`:

| Cấu hình | p95 duration | req/s | Ghi chú |
|---|---|---|---|
| `fetch` không cache | 1840ms | 34 | Mỗi request đều gọi NestJS |
| `revalidate: 60` | 612ms | 98 | Cache server |
| `generateStaticParams` + ISR | 89ms | 412 | Phục vụ HTML tĩnh |
| + CDN phía trước | 12ms | 3800 | Không chạm tới Next.js |

Bảng này biến "cache có vẻ nhanh hơn" thành con số cụ thể. Và nó cho thấy điều quan trọng: **bước có tác động lớn nhất thường là bước biến trang thành tĩnh**, không phải tối ưu code.

### Benchmark có đăng nhập

```js
// bench/dashboard.js
import http from 'k6/http'
import { check } from 'k6'

export function setup() {
  const res = http.post(
    'http://localhost:3001/login',
    { email: 'admin@blog.test', password: '12345678' },
  )
  return { cookies: res.cookies }
}

export default function (data) {
  const res = http.get('http://localhost:3001/dashboard', {
    cookies: { accessToken: data.cookies.accessToken[0].value },
  })
  check(res, { 'trả 200': (r) => r.status === 200 })
}
```

Kỳ vọng: `/dashboard` chậm hơn `/posts` nhiều lần, vì nó là `ƒ` (render mỗi request). Con số cụ thể cho bạn biết cần bao nhiêu instance.

---

## 7. Health check

```ts
// app/api/health/route.ts
export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, 'ok' | 'fail'> = {}
  const start = Date.now()

  // Backend
  try {
    const res = await fetch(`${process.env.API_URL}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    checks.api = res.ok ? 'ok' : 'fail'
  } catch {
    checks.api = 'fail'
  }

  // Redis (nếu có)
  if (process.env.REDIS_URL) {
    try {
      const r = await redis()
      await r.ping()
      checks.redis = 'ok'
    } catch {
      checks.redis = 'fail'
    }
  }

  const healthy = Object.values(checks).every((v) => v === 'ok')

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      version: process.env.DEPLOYMENT_VERSION ?? 'dev',
      uptimeSec: Math.round(process.uptime()),
      durationMs: Date.now() - start,
    },
    { status: healthy ? 200 : 503 },
  )
}
```

```bash
$ curl -s localhost:3001/api/health | jq
{
  "status": "ok",
  "checks": { "api": "ok", "redis": "ok" },
  "version": "a3f8c21",
  "uptimeSec": 8421,
  "durationMs": 14
}
```

```yaml
services:
  web:
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:3001/api/health']
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
```

> ⚠️ **`AbortSignal.timeout(3000)` là bắt buộc.** Không có timeout, backend treo sẽ khiến health check cũng treo, load balancer coi container là chết, nó bị restart — và bạn có một vòng lặp sập dây chuyền.

---

## 8. Bảng điều khiển cần những gì

Bốn nhóm, theo thứ tự ưu tiên khi có sự cố:

**Sức khoẻ**
```
· Tỉ lệ lỗi 5xx (cảnh báo khi > 1%)
· p95 thời gian phản hồi
· Số request/giây
· Health check của từng instance
```

**Trải nghiệm người dùng**
```
· LCP p75 (< 2.5s)
· INP p75 (< 200ms)
· CLS p75 (< 0.1)
· Phân bố theo loại kết nối mạng
```

**Cache**
```
· Tỉ lệ trúng cache
· Số lần revalidate/phút
· Tuổi trung bình của entry
```

**Nghiệp vụ**
```
· Lượt xem bài viết
· Đăng nhập thành công / thất bại (đột biến thất bại = có người dò mật khẩu)
· Bài viết được tạo
```

Nhóm cuối là thứ hay bị bỏ quên. Số kỹ thuật đẹp mà lượng bài viết mới giảm 80% thì bạn vẫn đang có sự cố — chỉ là chưa biết.

---

## 9. Quy trình khi có sự cố

Theo thứ tự này, đừng nhảy cóc:

```
1. Health check còn xanh không?
   $ curl -s https://blog.vanson.dev/api/health | jq

2. Lỗi nằm ở đâu — Next.js hay backend?
   $ curl -o /dev/null -s -w 'API: %{time_total}s\n' https://api.../health
   $ curl -o /dev/null -s -w 'Web: %{time_total}s\n' https://blog.../posts

3. Log 15 phút gần nhất có gì?
   $ docker compose logs web --since 15m | jq -c 'select(.level=="error")' | head -20

4. Có phải mới deploy không?
   $ curl -s https://blog.vanson.dev/api/health | jq -r .version

5. Trace: request chậm ở span nào?
   → Jaeger, lọc theo duration > 1s

6. Vẫn chưa rõ → bật verbose tạm thời
   NEXT_OTEL_VERBOSE=1 NEXT_PRIVATE_DEBUG_CACHE=1
```

Bước 2 quan trọng nhất và hay bị bỏ qua nhất: **phân biệt lỗi của bạn với lỗi của backend** trước khi đào sâu vào code Next.js.

---

## 10. Checklist vận hành

```
[ ] instrumentation.ts có register() và onRequestError
[ ] OpenTelemetry gửi được trace tới collector
[ ] Log dạng JSON có cấu trúc, không log token/mật khẩu
[ ] WebVitals thu thập từ người dùng thật, endpoint có rate limit
[ ] Dashboard theo dõi p75/p95, không phải trung bình
[ ] Health check có timeout cho mọi phụ thuộc
[ ] Health check trả 503 khi degraded (không phải 200)
[ ] docker-compose có healthcheck + start_period
[ ] stop_grace_period đủ dài cho after() — xem bài 06
[ ] Có baseline benchmark k6 để so sánh sau mỗi thay đổi lớn
[ ] Ngưỡng cảnh báo: 5xx > 1%, p95 > 1s, LCP p75 > 2.5s
[ ] Version hiện trong health check để biết đang chạy bản nào
```

---

## 11. Hết bộ nâng cao — bước tiếp theo

Bạn đã đi qua:

| Bài | Bạn có gì sau đó |
|---|---|
| [01](<./01-cache-components.md>) | Trang vừa tĩnh vừa cá nhân hoá được |
| [02](<./02-co-che-render.md>) | Hiểu cơ chế, debug được thay vì đoán |
| [03](<./03-du-lieu-lon.md>) | Xử lý được triệu bản ghi |
| [04](<./04-toi-uu-hieu-nang.md>) | Quy trình tối ưu dựa trên số liệu |
| [05](<./05-cache-nhieu-tang.md>) | Chạy được nhiều instance |
| [06](<./06-realtime.md>) | Realtime đúng cơ chế cho đúng bài toán |
| [07](<./07-kien-truc-quy-mo-lon.md>) | Kiến trúc mà công cụ ép tuân thủ |
| [08](<./08-bao-mat-nang-cao.md>) | Danh sách audit thực chiến |
| [09](<./09-testing.md>) | Test bảo vệ đúng chỗ quan trọng |
| [10](<./10-observability-benchmark.md>) | Nhìn thấy chuyện gì đang xảy ra |

**Dự án tổng hợp** để chốt lại toàn bộ:

Nâng cấp Blog thành hệ thống chạy production thật:

```
[ ] Bật cacheComponents, mọi route công khai là ◐ hoặc ●
[ ] Cursor pagination + virtual list cho trang quản trị
[ ] 3 instance sau nginx, cache handler Redis dùng chung
[ ] SSE cho thông báo, WebSocket cho bình luận
[ ] DAL đầy đủ, mọi file có server-only, depcruise xanh
[ ] CSP + rate limit + audit checklist bài 08 xanh
[ ] Test: 4 test phân quyền + 5 kịch bản E2E
[ ] OpenTelemetry + log JSON + health check
[ ] Baseline k6: p95 < 500ms ở 200 người dùng đồng thời
```

Làm xong danh sách này, bạn không còn là người "biết Next.js" nữa — bạn vận hành được nó.

Về mục lục nâng cao 👉 [README.md](<./README.md>) · Mục lục chính 👉 [../README.md](<../README.md>)

---

## Bài tập

1. Viết `instrumentation.ts` có `register()` in runtime. Xác nhận nó chạy **một lần** lúc khởi động.
2. Cài `@vercel/otel`, dựng collector bằng Docker, mở Jaeger và chép lại cây span của một request.
3. Bật `NEXT_OTEL_VERBOSE=1` và so sánh số span trước/sau.
4. Viết span tuỳ chỉnh cho một hàm DAL. Cố tình quên `span.end()` và quan sát span treo trong Jaeger.
5. Viết `onRequestError`. Gây một lỗi ở trang chi tiết, chép lại payload có `digest` và `routeType`.
6. Chuyển toàn bộ `console.log` sang `logger`. Truy vấn log bằng `jq` để tìm mọi request > 1000ms.
7. Thu thập Web Vitals thật. Sau 1 ngày, tính p50/p75/p95 của LCP bằng lệnh `jq` ở mục 5.
8. Viết bench k6 cho `/posts`. Chạy 4 lần với 4 cấu hình cache ở mục 6 và lập bảng so sánh của riêng bạn.
9. Viết health check có timeout. Tắt Blog API và xác nhận nó trả 503, không phải treo.
10. Bỏ `AbortSignal.timeout` đi, tắt backend, và quan sát health check treo — hiểu vì sao điều đó gây sập dây chuyền.
11. Chạy đủ 6 bước quy trình sự cố ở mục 9 trên một lỗi bạn tự tạo ra.
12. Hoàn thành checklist dự án tổng hợp ở mục 11.
