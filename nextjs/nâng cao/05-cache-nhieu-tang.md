# Bài 5 (NC) — Cache nhiều tầng & chạy nhiều instance

Bài này về vận hành: chuyện gì xảy ra khi bạn không còn chạy một container duy nhất.

## 1. Bốn tầng cache

```
Trình duyệt          Router cache (theo `stale`)         ── nhanh nhất, riêng từng người
     ↓
CDN / reverse proxy  HTML tĩnh, ảnh, _next/static        ── dùng chung, gần người dùng
     ↓
Next.js server       ISR HTML · use cache · fetch cache  ── mỗi instance một bản (!)
     ↓
Backend NestJS       Redis, cache truy vấn               ── dùng chung
```

Tầng thứ ba là nơi mọi rắc rối bắt đầu khi bạn scale ngang.

---

## 2. Vấn đề: mỗi instance một cache riêng

Chạy 4 container sau load balancer:

```
                 ┌─ web-1  cache: bài "Học Next.js" v2
LB ──────────────┼─ web-2  cache: bài "Học Next.js" v1  ← cũ
                 ├─ web-3  cache: (chưa có)
                 └─ web-4  cache: bài "Học Next.js" v1  ← cũ
```

Người dùng F5 vài lần sẽ thấy nội dung nhảy qua lại giữa v1 và v2. Đây là bug rất khó tái hiện trên máy dev.

Tệ hơn: **`revalidateTag()` chỉ tác động lên instance đang xử lý request đó.** Bạn sửa bài viết, request rơi vào `web-1`, ba container còn lại tiếp tục phục vụ bản cũ cho tới khi tự hết hạn.

Tái hiện tại chỗ:

```bash
$ docker compose up --scale web=3 -d
$ for i in {1..6}; do curl -s localhost:3001/posts/hoc-nextjs | grep -o '<h1>[^<]*'; done
```

```
<h1>Học Next.js (bản mới)
<h1>Học Next.js
<h1>Học Next.js
<h1>Học Next.js (bản mới)
<h1>Học Next.js
<h1>Học Next.js (bản mới)
```

Đó chính xác là triệu chứng.

---

## 3. Cache handler dùng chung

Giải pháp: đưa cache ra kho bên ngoài.

```js
// next.config.js
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0,          // tắt cache RAM mặc định
}
```

`cacheMaxMemorySize: 0` là dòng quan trọng — không tắt thì mỗi instance vẫn giữ bản RAM riêng và bạn có cả hai vấn đề cùng lúc.

```js
// cache-handler.js
const { createClient } = require('redis')

let client
async function getClient() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL })
    client.on('error', (e) => console.error('[cache] redis lỗi:', e.message))
    await client.connect()
  }
  return client
}

const PREFIX = `next:${process.env.BUILD_ID ?? 'dev'}:`

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
  }

  async get(key) {
    try {
      const redis = await getClient()
      const raw = await redis.get(PREFIX + key)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.error('[cache] get lỗi, coi như miss:', e.message)
      return null                     // Redis chết → render lại, KHÔNG sập trang
    }
  }

  async set(key, data, ctx) {
    try {
      const redis = await getClient()
      const entry = { value: data, lastModified: Date.now(), tags: ctx.tags ?? [] }

      await redis.set(PREFIX + key, JSON.stringify(entry), { EX: 60 * 60 * 24 })

      // Lưu ngược tag → key để revalidateTag tìm được
      for (const tag of entry.tags) {
        await redis.sAdd(`${PREFIX}tag:${tag}`, key)
      }
    } catch (e) {
      console.error('[cache] set lỗi, bỏ qua:', e.message)
    }
  }

  async revalidateTag(tags) {
    try {
      const redis = await getClient()
      for (const tag of [tags].flat()) {
        const keys = await redis.sMembers(`${PREFIX}tag:${tag}`)
        if (keys.length) {
          await redis.del(keys.map((k) => PREFIX + k))
          await redis.del(`${PREFIX}tag:${tag}`)
        }
        // Ghi mốc thời gian để các instance khác biết mà đồng bộ
        await redis.set(`${PREFIX}tagstamp:${tag}`, String(Date.now()))
      }
    } catch (e) {
      console.error('[cache] revalidateTag lỗi:', e.message)
    }
  }

  resetRequestCache() {}
}
```

Ba nguyên tắc thiết kế cache handler, đều rút ra từ sự cố thật:

1. **Redis chết không được làm sập trang.** Mọi thao tác bọc `try/catch`, lỗi thì coi như cache miss và render lại. Chậm còn hơn 500.
2. **Prefix theo Build ID.** Deploy mới không được đọc cache của bản cũ — cấu trúc dữ liệu có thể đã đổi.
3. **Có TTL.** Không đặt `EX`, Redis đầy dần rồi bắt đầu evict tuỳ tiện.

> `revalidatePath` chỉ là lớp tiện ích trên cache tag — nó gọi `revalidateTag` với một tag đặc biệt của đường dẫn đó. Nên bạn không cần cài riêng.

---

## 4. Đồng bộ tag giữa các instance: `refreshTags()`

Cache handler ở trên vẫn còn một lỗ hổng: `web-1` xoá key trên Redis, nhưng `web-2` có thể vẫn giữ bản trong RAM hoặc chưa biết tag đã bị vô hiệu.

Next.js gọi `refreshTags()` **trước mỗi request** để instance đồng bộ trạng thái tag từ kho dùng chung:

```js
module.exports = class CacheHandler {
  constructor(options) {
    this.options = options
    this.tagStamps = new Map()
  }

  async refreshTags() {
    try {
      const redis = await getClient()
      const keys = await redis.keys(`${PREFIX}tagstamp:*`)
      if (!keys.length) return

      const values = await redis.mGet(keys)
      keys.forEach((k, i) => {
        const tag = k.replace(`${PREFIX}tagstamp:`, '')
        this.tagStamps.set(tag, Number(values[i]))
      })
    } catch (e) {
      console.error('[cache] refreshTags lỗi:', e.message)
    }
  }

  // ... get / set / revalidateTag như trên
}
```

Không cài `refreshTags()`, thời gian dữ liệu lệch giữa các instance kéo dài tới khi entry tự hết hạn — có thể là hàng giờ.

> `redis.keys()` quét toàn bộ keyspace, **không dùng trên Redis lớn ở production**. Thay bằng một hash duy nhất: `HGETALL next:tagstamps`.

---

## 5. Ba biến môi trường bắt buộc khi chạy nhiều instance

Đây là nhóm cấu hình mà thiếu cái nào cũng cho ra lỗi khó hiểu.

### 5.1 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

Next.js mã hoá biến closure của Server Action trước khi gửi xuống client. Mặc định **mỗi lần build sinh khoá mới** → 4 instance build riêng = 4 khoá khác nhau.

Triệu chứng:

```
Error: Failed to find Server Action "7f9a2c1e0b". This request might be from
an older or newer deployment.
```

Người dùng submit form, request rơi vào instance khác → không giải mã được.

```bash
$ openssl rand -base64 32
kJ8vQ2mN5pR7tY9wA1sD3fG6hJ0kL4nM8qW2eR5tY7u=
```

```yaml
# docker-compose.yml
services:
  web:
    environment:
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${NEXT_ACTIONS_KEY}
```

Khoá phải là base64, giải mã ra đúng 16/24/32 byte.

### 5.2 `generateBuildId`

Mỗi lần build sinh Build ID ngẫu nhiên. Build riêng cho từng instance thì cache key và tên file tĩnh khác nhau.

```js
// next.config.js
module.exports = {
  generateBuildId: async () => process.env.GIT_HASH ?? 'dev',
}
```

Cách đúng nhất vẫn là: **build một lần, deploy cùng một image** cho mọi instance.

### 5.3 `deploymentId`

Chống version skew lúc rolling deploy — người dùng đang mở trang của bản cũ, request tiếp theo rơi vào instance bản mới.

```js
module.exports = {
  deploymentId: process.env.DEPLOYMENT_VERSION,
}
```

Khi có `deploymentId`, Next.js gắn `?dpl=` vào file tĩnh và header `x-deployment-id` vào request điều hướng. Lệch phiên bản → nó ép **tải lại toàn trang** thay vì điều hướng phía client, tránh lỗi "file JS không tồn tại".

Đánh đổi: người dùng mất state trong `useState` khi bị tải lại. Chấp nhận được, so với trang vỡ.

---

## 6. Streaming qua reverse proxy

nginx mặc định **gom toàn bộ response rồi mới gửi**. Điều đó vô hiệu hoá streaming, `<Suspense>`, và PPR — bạn mất sạch lợi thế TTFB.

Bật từ phía Next.js:

```js
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [{ key: 'X-Accel-Buffering', value: 'no' }],
      },
    ]
  },
}
```

Hoặc cấu hình thẳng nginx:

```nginx
location / {
    proxy_pass http://nextjs_upstream;
    proxy_buffering off;              # ← quan trọng nhất
    proxy_cache off;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    chunked_transfer_encoding on;
}
```

Kiểm chứng (nhắc lại từ [bài 02](<./02-co-che-render.md#kiểm-chứng-streaming-có-thật-sự-chạy-trên-hạ-tầng-của-bạn>)):

```bash
$ curl -N -s -o /dev/null -w '%{time_starttransfer}s / %{time_total}s\n' \
    https://blog-cua-ban.com/posts/hoc-nextjs
0.19s / 2.24s        ← streaming OK
2.21s / 2.24s        ← đang bị buffer
```

Không chỉ nginx — cần kiểm tra cả chuỗi:

- **Load balancer**: AWS ALB tích hợp Lambda buffer response mặc định.
- **CDN**: một số cấu hình gom response trước khi cache.
- **Service mesh / sidecar**: Envoy, Istio có thể buffer.

---

## 7. CDN phía trước Next.js

Next.js tự đặt `Cache-Control` phù hợp, việc của bạn là để CDN tôn trọng nó:

| Loại nội dung | Header Next.js gửi |
|---|---|
| `_next/static/*` (có hash tên file) | `public, max-age=31536000, immutable` |
| Trang tĩnh hoàn toàn | `public, s-maxage=..., stale-while-revalidate` |
| Trang có dữ liệu động | `private, no-cache, no-store, max-age=0, must-revalidate` |

Kiểm tra:

```bash
$ curl -sI https://blog-cua-ban.com/_next/static/chunks/main-8f2a.js | grep -i cache
cache-control: public, max-age=31536000, immutable

$ curl -sI https://blog-cua-ban.com/dashboard | grep -i cache
cache-control: private, no-cache, no-store, max-age=0, must-revalidate
```

> ⚠️ **Lỗi nguy hiểm nhất khi cấu hình CDN: ép cache mọi thứ.** Một quy tắc "cache tất cả HTML 5 phút" sẽ khiến CDN lưu trang `/dashboard` của người dùng A rồi phục vụ cho người dùng B. Luôn để CDN đọc header từ Next.js thay vì áp quy tắc cứng.

Cách kiểm tra rò rỉ: đăng nhập user A, mở trang cá nhân, rồi từ máy khác (chưa đăng nhập) gọi cùng URL:

```bash
$ curl -s https://blog-cua-ban.com/dashboard | grep -o 'Xin chào[^<]*'
                          ← phải RỖNG. Có tên user A là bạn đang rò rỉ.
```

---

## 8. Tối ưu ảnh khi self-host

`next/image` chạy được ngay với `next start`, nhưng có mấy điểm cần biết:

```ts
// next.config.ts
images: {
  minimumCacheTTL: 14400,     // Next 16 mặc định 4 giờ
  qualities: [75],            // Next 16 mặc định CHỈ [75]
  remotePatterns: [{ protocol: 'https', hostname: 'cdn.blog.vanson.dev' }],
}
```

Ảnh đã tối ưu lưu ở `.next/cache/images`. Trong Docker, thư mục này **mất sau mỗi lần restart** trừ khi bạn mount volume:

```yaml
services:
  web:
    volumes:
      - next-image-cache:/app/.next/cache/images

volumes:
  next-image-cache:
```

Không mount, mỗi lần deploy là tối ưu lại toàn bộ ảnh — CPU tăng vọt trong vài phút đầu.

Trên hệ Linux dùng glibc, `sharp` có thể ngốn bộ nhớ bất thường. Nếu container bị OOM lúc xử lý ảnh:

```yaml
environment:
  # Giới hạn arena của glibc malloc
  MALLOC_ARENA_MAX: 2
```

---

## 9. Cấu hình đầy đủ cho Blog nhiều instance

```yaml
# docker-compose.prod.yml
services:
  web:
    image: blog-web:${GIT_HASH}
    deploy:
      replicas: 3
    environment:
      NODE_ENV: production
      API_URL: http://api:3000/api
      REDIS_URL: redis://redis:6379
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: ${NEXT_ACTIONS_KEY}
      DEPLOYMENT_VERSION: ${GIT_HASH}
      GIT_HASH: ${GIT_HASH}
      MALLOC_ARENA_MAX: 2
    volumes:
      - next-image-cache:/app/.next/cache/images
    depends_on: [redis, api]

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data

  nginx:
    image: nginx:alpine
    ports: ['80:80']
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on: [web]

volumes:
  next-image-cache:
  redis-data:
```

```js
// next.config.js
module.exports = {
  output: 'standalone',
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0,
  generateBuildId: async () => process.env.GIT_HASH ?? 'dev',
  deploymentId: process.env.DEPLOYMENT_VERSION,
  async headers() {
    return [{ source: '/:path*{/}?', headers: [{ key: 'X-Accel-Buffering', value: 'no' }] }]
  },
}
```

`maxmemory-policy allkeys-lru` cho Redis: đầy thì tự bỏ key ít dùng nhất, thay vì báo lỗi ghi.

---

## 10. Checklist nhiều instance

```
[ ] cacheHandler dùng Redis, cacheMaxMemorySize: 0
[ ] Cache handler có try/catch — Redis chết không làm sập trang
[ ] Cache key có prefix theo Build ID
[ ] Đã cài refreshTags() để đồng bộ tag giữa instance
[ ] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY cố định, giống nhau mọi instance
[ ] generateBuildId cố định (hoặc build 1 lần, deploy cùng image)
[ ] deploymentId đặt theo phiên bản deploy
[ ] proxy_buffering off ở nginx
[ ] Đã kiểm chứng streaming bằng time_starttransfer
[ ] CDN đọc Cache-Control từ Next.js, không áp quy tắc cứng
[ ] Đã test: gọi /dashboard khi chưa đăng nhập, không thấy dữ liệu người khác
[ ] Volume cho .next/cache/images
[ ] Redis có maxmemory + policy
```

Bài test cuối cùng, chạy sau mỗi lần đổi hạ tầng:

```bash
# 1. Sửa một bài viết qua giao diện
# 2. Gọi 10 lần, tất cả phải trả về bản mới
$ for i in {1..10}; do
    curl -s localhost/posts/hoc-nextjs | grep -o '<h1>[^<]*'
  done | sort -u | wc -l
1        ← đúng 1 dòng khác nhau = mọi instance đồng bộ
```

Ra `2` là cache chưa đồng bộ, quay lại mục 3 và 4.

---

## Bài tập

1. Chạy `docker compose up --scale web=3`, sửa một bài viết, rồi gọi 10 lần bằng vòng lặp curl. Chép lại kết quả không đồng nhất.
2. Viết `cache-handler.js` dùng Redis với đủ `get`/`set`/`revalidateTag`. Đặt `cacheMaxMemorySize: 0`.
3. Chạy lại bài test ở mục 10 và xác nhận `sort -u | wc -l` ra `1`.
4. Tắt Redis (`docker stop redis`) trong lúc app đang chạy. Xác nhận trang vẫn mở được (chậm hơn), không trả 500.
5. Cài `refreshTags()`. Đo thời gian từ lúc `revalidateTag` tới lúc cả 3 instance trả bản mới, trước và sau.
6. Bỏ `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, build 2 lần riêng, submit form nhiều lần để gặp lỗi `Failed to find Server Action`.
7. Dựng nginx trước Next.js **không** có `proxy_buffering off`. Đo `time_starttransfer` và xác nhận streaming đã chết. Bật lên rồi đo lại.
8. Chép lại header `cache-control` của 3 loại URL: file `_next/static`, trang tĩnh, trang `/dashboard`.
9. Cấu hình CDN (hoặc nginx proxy_cache) ép cache mọi HTML 5 phút. Đăng nhập rồi gọi `/dashboard` từ máy khác — quan sát rò rỉ. Sửa lại.
10. Restart container khi chưa mount volume `.next/cache/images`, quan sát CPU lúc tải lại trang nhiều ảnh. Mount volume rồi làm lại.

Tiếp theo 👉 [06-realtime.md](<./06-realtime.md>)
