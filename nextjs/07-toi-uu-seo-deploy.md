# Bài 7 — Tối ưu, SEO & Deploy

## 1. `next/image` — ảnh tự tối ưu

```tsx
import Image from 'next/image'

<Image
  src="/anh-bia.jpg"
  alt="Ảnh bìa bài viết"
  width={800}
  height={400}
/>
```

Next.js làm gì khi bạn dùng nó thay `<img>`:

| Việc | Kết quả đo được |
|---|---|
| Chuyển sang WebP/AVIF | 340 KB JPEG → 82 KB WebP |
| Sinh nhiều kích thước, chọn theo màn hình | Điện thoại tải bản 640px thay vì 1920px |
| Lazy load | Ảnh dưới màn hình chỉ tải khi cuộn tới |
| Giữ chỗ trước bằng `width`/`height` | Không bị nhảy layout (CLS = 0) |

Xem tận mắt — mở tab Network, lọc `Img`:

```
/_next/image?url=%2Fanh-bia.jpg&w=828&q=75    82.1 KB   image/webp
```

URL đã bị viết lại qua bộ tối ưu, định dạng thành WebP dù file gốc là JPEG.

### Bắt buộc có `width` và `height`

Thiếu, Next.js báo:

```
Error: Image with src "/anh-bia.jpg" is missing required "width" property.
```

Không biết kích thước trước thì dùng `fill` + container có `position: relative`:

```tsx
<div className="relative h-64 w-full">
  <Image src={post.coverUrl} alt={post.title} fill className="object-cover" />
</div>
```

Quên `relative` ở container thì ảnh phủ ra toàn màn hình:

```
Error: Image with src "..." has "fill" but is missing "position: relative" on parent.
```

### Ảnh từ domain ngoài phải khai báo

```tsx
<Image src="https://images.unsplash.com/photo-123" alt="" width={800} height={400} />
```

```
Error: Invalid src prop (https://images.unsplash.com/photo-123) on `next/image`,
hostname "images.unsplash.com" is not configured under images in your `next.config.js`
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/my-account/**' },
    ],
  },
}
```

Sửa xong **phải khởi động lại** `npm run dev`.

> ⚠️ Đừng dùng `images.domains` — đã deprecated ở Next.js 16. `remotePatterns` an toàn hơn vì khớp được cả `pathname`, tránh việc ai đó nhét ảnh tuỳ ý qua bộ tối ưu của bạn.

### Ba thay đổi mặc định của Next.js 16 dễ làm bạn ngạc nhiên

```ts
images: {
  qualities: [75],          // MẶC ĐỊNH MỚI: chỉ chấp nhận quality 75
  minimumCacheTTL: 14400,   // MẶC ĐỊNH MỚI: cache 4 giờ (trước là 60 giây)
  maximumRedirects: 3,      // MẶC ĐỊNH MỚI: tối đa 3 redirect
}
```

Viết `<Image quality={90} />` mà không khai báo, giá trị bị **ép về 75** âm thầm. Muốn dùng phải liệt kê:

```ts
images: { qualities: [50, 75, 90] }
```

### Ảnh quan trọng nhất: `priority`

Ảnh đầu trang (LCP) không nên lazy load:

```tsx
<Image src="/hero.jpg" alt="" width={1200} height={600} priority />
```

Không đặt, Lighthouse nhắc:

```
Largest Contentful Paint image was lazily loaded
```

---

## 2. `next/font` — font không nhấp nháy

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],     // ← nhớ 'vietnamese' cho tiếng Việt
  display: 'swap',
})

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

Next.js **tải font về lúc build** và host cùng site. Nghĩa là:

- Không có request nào đi tới `fonts.googleapis.com` khi người dùng vào trang.
- Không nhấp nháy đổi font (FOUT) vì file font nằm cùng server.

Kiểm chứng ở tab Network — trước và sau:

```
Cách cũ (<link> tới Google Fonts):
  fonts.googleapis.com/css2?family=Inter    142 ms
  fonts.gstatic.com/s/inter/v13/...woff2    218 ms

Dùng next/font:
  /_next/static/media/e4af272ccee01ff0.p.woff2    12 ms   ← cùng domain
```

Quên `subsets: ['vietnamese']` thì chữ có dấu rơi về font mặc định của hệ thống — tiếng Việt trông lệch hẳn so với phần còn lại.

---

## 3. Metadata & SEO

### Metadata tĩnh

```tsx
// app/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://blog.vanson.dev'),   // gốc cho mọi URL tương đối
  title: {
    default: 'Blog của Vanson',
    template: '%s | Blog của Vanson',     // trang con: "Học Next.js | Blog của Vanson"
  },
  description: 'Ghi chép học lập trình',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'Blog của Vanson',
  },
}
```

Thiếu `metadataBase`, terminal cảnh báo mỗi lần build:

```
⚠ metadataBase property in metadata export is not set for resolving social open graph
  or twitter images, using "http://localhost:3001"
```

Hậu quả thật: link chia sẻ lên Facebook trỏ ảnh về `localhost` — không ai thấy ảnh.

### Metadata động

```tsx
// app/posts/[slug]/page.tsx
import type { Metadata } from 'next'
import { getPost } from '@/lib/api'

export async function generateMetadata(
  props: PageProps<'/posts/[slug]'>,
): Promise<Metadata> {
  const { slug } = await props.params
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
      images: [{ url: post.coverUrl, width: 1200, height: 630 }],
    },
  }
}
```

`getPost` được gọi ở cả `generateMetadata` và `Page`, nhưng nhờ cơ chế dedupe của `fetch` (bài [03](./03-lay-du-lieu-va-cache.md#3-cache-tự-động-dedupe-trong-cùng-một-lần-render)) chỉ có **một** request thật.

Kiểm chứng:

```bash
$ curl -s localhost:3001/posts/hoc-nextjs | grep -o '<title>[^<]*</title>'
<title>Học Next.js | Blog của Vanson</title>

$ curl -s localhost:3001/posts/hoc-nextjs | grep 'og:'
<meta property="og:title" content="Học Next.js"/>
<meta property="og:type" content="article"/>
<meta property="og:image" content="https://blog.vanson.dev/covers/nextjs.jpg"/>
```

Đây cũng là lý do Server Component quan trọng với SEO: thẻ meta nằm sẵn trong HTML, crawler không cần chạy JS.

### `sitemap.ts` và `robots.ts`

```ts
// app/sitemap.ts
import type { MetadataRoute } from 'next'
import { getPosts } from '@/lib/api'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await getPosts(1, 1000)

  return [
    { url: 'https://blog.vanson.dev', lastModified: new Date(), priority: 1 },
    { url: 'https://blog.vanson.dev/posts', lastModified: new Date(), priority: 0.8 },
    ...items.map((post) => ({
      url: `https://blog.vanson.dev/posts/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      priority: 0.6,
    })),
  ]
}
```

```ts
// app/robots.ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/'] },
    sitemap: 'https://blog.vanson.dev/sitemap.xml',
  }
}
```

```bash
$ curl -s localhost:3001/sitemap.xml | head -5
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://blog.vanson.dev</loc><lastmod>2026-08-11T09:55:12.000Z</lastmod><priority>1</priority></url>
```

Không cần viết XML — Next.js sinh từ mảng bạn trả về.

---

## 4. Đọc kết quả build

```bash
$ npm run build
```

```
   ▲ Next.js 16.3.0 (Turbopack)

   Creating an optimized production build ...
 ✓ Compiled successfully in 6.2s
   Collecting page data ...
   Generating static pages (31/31)
   Finalizing page optimization ...

Route (app)                              Revalidate  Expire
┌ ○ /                                            1h     1y
├ ○ /_not-found                                        
├ ƒ /api/health                                        
├ ○ /login                                             
├ ○ /posts                                       1h     1y
├ ● /posts/[slug]                                1h     1y
│   ├ /posts/hoc-nestjs-trong-7-ngay
│   ├ /posts/docker-cho-nguoi-moi
│   └ [+25 more paths]
└ ƒ /dashboard                                         

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML using generateStaticParams
ƒ  (Dynamic)  server-rendered on demand
```

**Cột ký hiệu là thứ quan trọng nhất cần đọc.** Trang lẽ ra tĩnh mà bị đánh `ƒ` nghĩa là có gì đó ép nó thành động:

| Nguyên nhân | Cách tìm |
|---|---|
| Đọc `cookies()` hoặc `headers()` | Tìm trong page và mọi component nó dùng |
| Đọc `searchParams` | Có trong `page.tsx` không? |
| `fetch` không cache | Thiếu `revalidate` hoặc `force-cache` |
| `export const dynamic = 'force-dynamic'` | Ai đó đã rắc vào |

`/dashboard` là `ƒ` thì đúng — nó gọi `requireRole()` vốn đọc cookie. Nhưng `/posts` mà thành `ƒ` là bạn đang bỏ phí hiệu năng.

> Next.js 16 đã **bỏ cột `Size` và `First Load JS`** khỏi output build vì con số đó không phản ánh đúng kiến trúc RSC. Muốn đo thật thì dùng Chrome Lighthouse hoặc tab Network.

### Kiểm tra kiểu và lint

`next lint` **đã bị gỡ ở Next.js 16**. Gọi nó sẽ ra:

```
$ npx next lint
error: unknown command 'lint'
```

Và `next build` cũng không còn tự chạy lint. Gọi ESLint trực tiếp:

```json
{
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

```bash
$ npm run typecheck
src/app/posts/[slug]/page.tsx:5:20 - error TS2339:
  Property 'id' does not exist on type '{ slug: string; }'.
```

Chạy `typecheck` trước mỗi lần commit — nó bắt được lỗi mà `next build` bỏ qua.

---

## 5. Biến môi trường ở production

```bash
# .env.local          — máy bạn, đã gitignore
# .env.production     — giá trị lúc build production
# .env                — giá trị chung, có thể commit (không chứa secret)
```

Có một bẫy đặc thù: biến `NEXT_PUBLIC_*` bị **nướng cứng vào bundle lúc build**, không đọc lại lúc chạy.

```
Build với NEXT_PUBLIC_API_URL=https://api.staging.com
  → deploy lên production
  → đổi biến môi trường thành https://api.production.com
  → app VẪN gọi staging  ← vì giá trị đã nằm trong file JS
```

Muốn giá trị đọc lúc chạy thì phải là biến server, và gọi `connection()` để chặn Next.js prerender nó:

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()                     // đảm bảo chạy lúc có request thật
  const config = process.env.RUNTIME_CONFIG
  return <p>{config}</p>
}
```

> `serverRuntimeConfig` và `publicRuntimeConfig` **đã bị gỡ ở Next.js 16**. Code cũ dùng `getConfig()` từ `next/config` sẽ hỏng — chuyển sang biến môi trường.

---

## 6. Deploy bằng Docker

Cần `output: 'standalone'` để Next.js gói sẵn `node_modules` tối thiểu:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
}
```

```dockerfile
# Dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3001
ENV PORT=3001 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

Ba điểm đáng chú ý, giải thích luôn vì sao:

1. **`CMD ["node", "server.js"]`**, không phải `npm start`. Chế độ standalone sinh ra `server.js` chứa sẵn server tối thiểu.
2. **`.next/static` phải copy riêng.** Standalone không gộp nó vào. Quên bước này thì trang chạy nhưng mất sạch CSS và JS:
   ```
   GET /_next/static/chunks/main-app.js 404
   ```
3. **`HOSTNAME=0.0.0.0`.** Mặc định server chỉ nghe `localhost` bên trong container, bạn map cổng ra ngoài sẽ không kết nối được.

```bash
$ docker build -t blog-web .
$ docker images blog-web
REPOSITORY   TAG      SIZE
blog-web     latest   187MB       ← không standalone thì cỡ 1.1GB
```

Ghép với Blog API — nối vào `docker-compose.yml` bạn đã có ở [../docker/04-compose-prod.md](../docker/04-compose-prod.md):

```yaml
services:
  web:
    build: ./blog-web
    ports:
      - '3001:3001'
    environment:
      API_URL: http://api:3000/api      # ← tên service, KHÔNG phải localhost
    depends_on:
      - api
```

> ⚠️ Trong Docker, `localhost` là chính container đó. Dùng `http://localhost:3000/api` sẽ ra:
> ```
> TypeError: fetch failed
>   [cause]: Error: connect ECONNREFUSED 127.0.0.1:3000
> ```
> Phải dùng tên service (`api`) — Docker network tự phân giải.

---

## 7. Deploy lên Vercel

```bash
npm i -g vercel
vercel
```

```
? Set up and deploy "~/Desktop/Learn/nextjs/blog-web"? yes
? Which scope? Vanson
? Link to existing project? no
? What's your project's name? blog-web
? In which directory is your code located? ./

🔗  Linked to vanson/blog-web
🔍  Inspect: https://vercel.com/vanson/blog-web/8Fk2...
✅  Production: https://blog-web-vanson.vercel.app [42s]
```

Biến môi trường phải khai riêng ở dashboard hoặc bằng CLI:

```bash
$ vercel env add API_URL production
? What's the value of API_URL? https://api.blog.vanson.dev/api
✅ Added Environment Variable API_URL to Project blog-web
```

`.env.local` **không** được upload — cố tình như vậy để bạn khỏi lỡ tay đẩy secret lên.

> Lưu ý thực tế: Blog API NestJS của bạn chạy ở `localhost:3000`, Vercel không gọi tới được. Deploy thật thì backend cũng phải có domain công khai (Railway, Render, VPS).

---

## 8. Checklist trước khi lên production

```
[ ] npm run build chạy sạch, không warning
[ ] npm run typecheck không lỗi
[ ] Đọc bảng route: trang nào nên tĩnh mà đang là ƒ?
[ ] metadataBase đã đặt đúng domain thật
[ ] Mọi <Image> có alt, ảnh đầu trang có priority
[ ] next/font có subsets: ['vietnamese']
[ ] Không có NEXT_PUBLIC_ nào chứa secret
    → grep -r "SECRET\|PASSWORD\|PRIVATE" .next/static/ phải rỗng
[ ] Cookie có httpOnly + secure + sameSite
[ ] Mọi fetch có Authorization đều cache: 'no-store'
[ ] Server Action nào cũng tự kiểm tra auth
[ ] Có app/not-found.tsx và app/error.tsx
[ ] sitemap.xml và robots.txt trả về đúng
```

Câu lệnh kiểm tra secret rò rỉ:

```bash
$ npm run build && grep -r "my-secret-value" .next/static/
                                        ← không output = an toàn
```

Có output nghĩa là secret đã nằm trong file gửi xuống trình duyệt.

---

## Bài tập

1. Đổi mọi `<img>` sang `<Image>`. Mở tab Network, chép lại URL `/_next/image?...` và kích thước file trước/sau.
2. Dùng ảnh từ `images.unsplash.com` khi chưa khai báo `remotePatterns` để gặp lỗi, chép lại, rồi sửa.
3. Thêm `next/font` với `subsets: ['latin', 'vietnamese']`. So sánh request font ở tab Network trước và sau.
4. Đặt `metadata.title.template` ở layout gốc. Kiểm tra bằng `curl | grep '<title>'` ở 2 trang khác nhau.
5. Viết `generateMetadata` cho `/posts/[slug]`. Chép lại các thẻ `og:` bằng `curl | grep 'og:'`.
6. Bỏ `metadataBase` để thấy cảnh báo lúc build, chép lại nguyên văn.
7. Viết `sitemap.ts` và `robots.ts`. Gọi `/sitemap.xml` và `/robots.txt` bằng curl.
8. Chạy `npm run build`, chép lại bảng route. Với mỗi trang `ƒ`, giải thích vì sao nó động.
9. Viết Dockerfile standalone. Cố tình bỏ dòng copy `.next/static` để thấy lỗi 404 file tĩnh, rồi thêm lại.
10. Chạy `grep -r "SECRET" .next/static/` sau khi build và xác nhận rỗng.

Tiếp theo 👉 [08-du-an-blog-frontend.md](./08-du-an-blog-frontend.md)
