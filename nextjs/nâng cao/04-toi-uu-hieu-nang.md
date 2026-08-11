# Bài 4 (NC) — Tối ưu hiệu năng

Nguyên tắc số một: **đo trước, sửa sau.** Bài này bắt đầu bằng cách đo.

## 1. Đo cái gì

Bốn chỉ số, theo thứ tự người dùng cảm nhận:

| Chỉ số | Nghĩa | Ngưỡng tốt | Thường hỏng vì |
|---|---|---|---|
| **TTFB** | Byte đầu tiên về | < 800ms | Server render chậm, không cache |
| **LCP** | Phần tử lớn nhất hiện xong | < 2.5s | Ảnh không tối ưu, font chặn render |
| **CLS** | Layout nhảy | < 0.1 | Ảnh thiếu width/height, font swap |
| **INP** | Phản hồi khi bấm | < 200ms | Quá nhiều JS, hydration lâu |

Next.js 16 **đã bỏ cột `Size` và `First Load JS`** khỏi output build — chúng không phản ánh đúng kiến trúc RSC. Nên đừng tìm con số ở đó nữa; đo bằng 3 công cụ dưới đây.

### Công cụ 1: Lighthouse (tổng quan)

```bash
$ npm run build && npm start
$ npx lighthouse http://localhost:3001/posts --only-categories=performance --view
```

```
Performance: 78

  First Contentful Paint    0.9 s
  Largest Contentful Paint  3.4 s   ⚠️
  Total Blocking Time       420 ms  ⚠️
  Cumulative Layout Shift   0.18    ⚠️
  Speed Index               1.8 s
```

> ⚠️ Chạy Lighthouse trên `npm run dev` cho kết quả vô nghĩa — dev không minify, không cache, có cả HMR. **Luôn đo trên `npm run build && npm start`.**

### Công cụ 2: `useReportWebVitals` (số liệu người dùng thật)

```tsx
// components/WebVitals.tsx
'use client'

import { useReportWebVitals } from 'next/web-vitals'

export default function WebVitals() {
  useReportWebVitals((metric) => {
    console.log(`[${metric.name}] ${Math.round(metric.value)}ms — ${metric.rating}`)

    // Production: gửi về backend
    if (process.env.NODE_ENV === 'production') {
      navigator.sendBeacon('/api/vitals', JSON.stringify(metric))
    }
  })
  return null
}
```

```tsx
// app/layout.tsx
<body>
  <WebVitals />
  {children}
</body>
```

Console trình duyệt:

```
[TTFB] 187ms — good
[FCP] 892ms — good
[LCP] 3421ms — poor          ← thủ phạm ở đây
[CLS] 0.18 — needs-improvement
[INP] 156ms — good
```

Lighthouse đo trên máy bạn với mạng giả lập. `useReportWebVitals` đo **người dùng thật trên thiết bị thật** — con số này mới là thật.

### Công cụ 3: Bundle analyzer (tìm gói nặng)

```bash
npm i -D @next/bundle-analyzer
```

```ts
// next.config.ts
import withBundleAnalyzer from '@next/bundle-analyzer'

const nextConfig: NextConfig = { /* ... */ }

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})(nextConfig)
```

```bash
$ ANALYZE=true npm run build
```

Trình duyệt mở treemap. Đây là những gì bạn tìm:

```
┌──────────────── client bundle ────────────────┐
│ ┌─────────────────┐ ┌──────────┐ ┌──────────┐ │
│ │ moment.js       │ │ lodash   │ │ react-dom│ │
│ │ 287 KB  ⚠️      │ │ 71 KB ⚠️ │ │ 42 KB    │ │
│ └─────────────────┘ └──────────┘ └──────────┘ │
└───────────────────────────────────────────────┘
```

Hai ô đầu là mục tiêu sửa ở mục 3.

---

## 2. Sửa LCP

LCP thường là **ảnh lớn nhất trên màn hình đầu**. Tìm nó trong Lighthouse mục "Largest Contentful Paint element".

### Ảnh đầu trang phải có `priority`

```tsx
<Image src={post.coverUrl} alt={post.title} width={1200} height={630} priority />
```

Không có, Lighthouse mắng:

```
Largest Contentful Paint image was lazily loaded
  Above-the-fold images that are lazily loaded render later in the page lifecycle
```

`priority` làm hai việc: bỏ `loading="lazy"` và thêm `<link rel="preload">` vào `<head>` — trình duyệt bắt đầu tải ảnh trước cả khi gặp thẻ `<img>`.

Chỉ dùng cho **1–2 ảnh** trên màn hình đầu. Rắc khắp nơi thì mọi ảnh cùng tranh băng thông và LCP tệ hơn cả lúc chưa dùng.

### `sizes` cho ảnh responsive

```tsx
// ❌ Điện thoại vẫn tải bản 1920px
<div className="relative h-64 w-full">
  <Image src={url} alt="" fill />
</div>

// ✅
<Image
  src={url}
  alt=""
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
/>
```

Kiểm chứng ở tab Network, thu hẹp cửa sổ về cỡ điện thoại:

```
Trước: /_next/image?url=...&w=1920&q=75    248 KB
Sau:   /_next/image?url=...&w=640&q=75      42 KB
```

### Font không được chặn render

```tsx
const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',              // ← hiện font hệ thống trước, đổi sau
  preload: true,
})
```

`display: 'block'` (mặc định của CSS) giấu chữ tới 3 giây chờ font. `swap` hiện ngay bằng font dự phòng.

Bù lại `swap` gây CLS khi đổi font. Giảm bằng `adjustFontFallback` (bật sẵn với font Google trong `next/font`).

---

## 3. Giảm JavaScript

Đây là đòn bẩy lớn nhất cho INP và TBT.

### Đòn bẩy #1: bớt Client Component

Nhắc lại từ [bài 02 cơ bản](<../02-server-client-component.md>): `'use client'` lan theo **import**. Một chỉ thị đặt sai chỗ kéo cả cây xuống trình duyệt.

Tìm chúng:

```bash
$ grep -rl "use client" src/ | sort
src/components/CommentSection.tsx
src/components/DeleteButton.tsx
src/components/LoginForm.tsx
src/components/Pagination.tsx
src/components/PostForm.tsx
src/components/SearchBox.tsx
```

Với mỗi file, hỏi: **thật sự cần state hay sự kiện không?** Nếu chỉ để định dạng ngày tháng hay tính toán, chuyển về Server Component.

Ví dụ thực tế hay gặp:

```tsx
// ❌ 'use client' chỉ vì format ngày
'use client'
import { format } from 'date-fns'          // 78 KB xuống trình duyệt

export default function PostMeta({ post }) {
  return <time>{format(new Date(post.createdAt), 'dd/MM/yyyy')}</time>
}
```

```tsx
// ✅ Server Component — date-fns ở lại server
import { format } from 'date-fns'

export default function PostMeta({ post }) {
  return <time>{format(new Date(post.createdAt), 'dd/MM/yyyy')}</time>
}
```

Chênh lệch đo được: 78 KB không rời server.

### Đòn bẩy #2: `dynamic()` cho component nặng ít dùng

```tsx
'use client'
import dynamic from 'next/dynamic'

const MarkdownEditor = dynamic(() => import('@/components/MarkdownEditor'), {
  loading: () => <div className="h-96 animate-pulse rounded bg-gray-100" />,
  ssr: false,
})

export default function PostForm() {
  const [editing, setEditing] = useState(false)
  return editing ? <MarkdownEditor /> : <button onClick={() => setEditing(true)}>Sửa</button>
}
```

Editor 340 KB chỉ tải khi người dùng bấm Sửa. Tab Network xác nhận:

```
Lúc tải trang:              không có gì
Bấm "Sửa":  chunk-8f2a.js   341 KB
```

Ứng viên thường gặp: rich text editor, chart, bản đồ, code highlighter, date picker.

> ⚠️ `dynamic(..., { ssr: false })` **chỉ dùng được trong Client Component**:
> ```
> Error: `ssr: false` is not allowed with `next/dynamic` in Server Components.
> ```

### Đòn bẩy #3: thay thư viện nặng

| Nặng | Nhẹ | Tiết kiệm |
|---|---|---|
| `moment` 287 KB | `date-fns` (import lẻ) hoặc `Intl.DateTimeFormat` | ~280 KB |
| `lodash` 71 KB | `lodash-es` + import lẻ, hoặc JS thuần | ~65 KB |
| `axios` 33 KB | `fetch` có sẵn | 33 KB |
| `uuid` 9 KB | `crypto.randomUUID()` | 9 KB |

Import lẻ thay vì cả gói:

```ts
import _ from 'lodash'                    // ❌ 71 KB
import debounce from 'lodash/debounce'    // ✅ 2 KB
```

Riêng định dạng ngày, thường không cần thư viện nào:

```ts
new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(post.createdAt))
// → "11 tháng 8, 2026"
```

### `optimizePackageImports`

Một số thư viện (icon, UI kit) export hàng nghìn thứ. Next.js tự tách được:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@heroicons/react', 'date-fns'],
  },
}
```

Với `lucide-react`, dùng 5 icon mà không có cấu hình này có thể kéo theo cả nghìn icon vào bundle.

---

## 4. React Compiler

Ổn định từ Next.js 16. Nó tự động memo hoá component, thay cho `useMemo`/`useCallback`/`memo` viết tay.

```bash
npm i -D babel-plugin-react-compiler
```

```ts
// next.config.ts
const nextConfig: NextConfig = {
  reactCompiler: true,
}
```

Trước:

```tsx
'use client'
const filtered = useMemo(() => posts.filter((p) => p.status === 'published'), [posts])
const handleClick = useCallback((id: number) => setSelected(id), [])
```

Sau — compiler tự lo:

```tsx
'use client'
const filtered = posts.filter((p) => p.status === 'published')
const handleClick = (id: number) => setSelected(id)
```

> ⚠️ **Chưa bật mặc định, và có cái giá.** Compiler dựa trên Babel nên **build và dev chậm hơn**. Đo trước khi quyết định:
> ```bash
> $ time npm run build
> # reactCompiler: false → 6.2s
> # reactCompiler: true  → 14.8s
> ```
> Đáng bật khi bạn có nhiều Client Component phức tạp. Dự án Blog chủ yếu là Server Component thì lợi ích gần như bằng không.

---

## 5. Nguồn CLS

CLS là chỉ số dễ sửa nhất và cũng hay bị bỏ quên nhất.

| Nguyên nhân | Sửa |
|---|---|
| `<img>` không có kích thước | Dùng `<Image>` với `width`/`height`, hoặc `fill` + container có chiều cao |
| Font đổi làm chữ nhảy | `next/font` (đã có `adjustFontFallback`) |
| Banner/quảng cáo chèn vào | Đặt sẵn chỗ: `min-height` |
| Nội dung động chèn trên đầu | Render vào chỗ đã dành sẵn |
| Skeleton khác kích thước nội dung thật | Làm skeleton **đúng bằng** kích thước thật |

Điểm cuối là lỗi tinh vi: skeleton cao 60px nhưng nội dung thật cao 84px → mỗi lần dữ liệu về là layout nhảy.

```tsx
// ❌ Skeleton không khớp
<div className="h-16 animate-pulse bg-gray-200" />

// ✅ Đúng bằng kích thước dòng thật
<div className="space-y-2 rounded border p-4">
  <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
  <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
</div>
```

Tìm thủ phạm: DevTools → Performance → ghi lại lúc tải → tìm mục **Layout Shift**, nó chỉ đúng phần tử gây nhảy.

---

## 6. Giảm TTFB

TTFB cao nghĩa là **server** chậm, không phải client. Ba nguyên nhân theo thứ tự phổ biến:

### 1. Trang lẽ ra tĩnh mà thành động

```bash
$ npm run build | grep -E '^[┌├└]'
├ ƒ /posts          ← đây
```

Sửa theo [bài 20 lỗi thường gặp](<../10-loi-thuong-gap.md#lỗi-20--trang-lẽ-ra-tĩnh-mà-build-ra-ƒ>). Trang tĩnh có TTFB gần bằng 0 vì phục vụ từ CDN.

### 2. Request tuần tự

```tsx
// ❌ 300 + 250 + 180 = 730ms
const post = await getPost(slug)
const categories = await getCategories()
const related = await getRelated(slug)

// ✅ max(300, 250, 180) = 300ms
const [post, categories, related] = await Promise.all([
  getPost(slug),
  getCategories(),
  getRelated(slug),
])
```

Terminal Next.js cho bạn con số ngay:

```
 GET /posts/hoc-nextjs 200 in 741ms      ← tuần tự
 GET /posts/hoc-nextjs 200 in 318ms      ← song song
```

### 3. Backend chậm

Lúc này vấn đề không nằm ở Next.js. Xem [../../nestjs/nang-cao/03-toi-uu-database.md](../../nestjs/nang-cao/03-toi-uu-database.md).

Cách phân biệt nhanh — đo riêng backend:

```bash
$ curl -o /dev/null -s -w 'API: %{time_total}s\n' localhost:3000/api/posts
API: 0.412s

$ curl -o /dev/null -s -w 'Next: %{time_total}s\n' localhost:3001/posts
Next: 0.487s
```

412ms trên tổng 487ms là ở backend. Tối ưu Next.js chỉ giành được 75ms.

---

## 7. Preload dữ liệu

Khi có việc chạy trước một truy vấn chậm, khởi động truy vấn đó sớm:

```ts
// lib/data.ts
import { cache } from 'react'
import 'server-only'

export const getPost = cache(async (slug: string) => {
  return apiFetch<Post>(`/posts/slug/${slug}`)
})

export const preloadPost = (slug: string) => {
  void getPost(slug)          // không await — chỉ khởi động
}
```

```tsx
export default async function PostPage(props: PageProps<'/posts/[slug]'>) {
  const { slug } = await props.params

  preloadPost(slug)                        // bắt đầu chạy nền

  const user = await getCurrentUser()       // 120ms — chạy song song với trên

  const post = await getPost(slug)          // đã xong hoặc gần xong
  return <article>{post.title}</article>
}
```

Tiết kiệm đúng bằng thời gian của việc chạy chen giữa. Chỉ đáng dùng khi bạn thấy hai `await` tuần tự mà không phụ thuộc nhau nhưng không gộp `Promise.all` được.

---

## 8. Quy trình tối ưu

Theo thứ tự này, đừng nhảy cóc:

```
1. Build production, chạy Lighthouse    → biết chỉ số nào tệ
2. Xem bảng route của next build        → còn trang ƒ nào không đáng?
3. LCP tệ?   → ảnh (priority, sizes) và font
4. CLS tệ?   → DevTools Performance → Layout Shift
5. INP/TBT tệ? → ANALYZE=true, tìm gói nặng, đếm 'use client'
6. TTFB tệ?  → đo riêng backend trước khi đổ lỗi Next.js
7. Đo lại, so với số cũ
```

**Ghi lại số trước và sau mỗi lần sửa.** Không có thói quen này, bạn sẽ "tối ưu" bằng cảm giác và có lúc làm tệ đi mà không biết.

Mẫu bảng theo dõi:

| Lần sửa | LCP | CLS | TBT | Ghi chú |
|---|---|---|---|---|
| Ban đầu | 3.4s | 0.18 | 420ms | |
| + `priority` cho ảnh bìa | 2.1s | 0.18 | 420ms | LCP giảm 1.3s |
| + `sizes` responsive | 1.6s | 0.18 | 420ms | |
| + skeleton đúng kích thước | 1.6s | 0.04 | 420ms | CLS đạt |
| PostMeta → Server Component | 1.6s | 0.04 | 280ms | bớt 78 KB |
| `dynamic()` cho editor | 1.5s | 0.04 | 140ms | bớt 341 KB |

---

## 9. Ngân sách hiệu năng trong CI

Chặn hồi quy tự động:

```yaml
# .github/workflows/perf.yml
name: Performance
on: [pull_request]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci && npm run build
      - run: npm start & npx wait-on http://localhost:3001
      - uses: treosh/lighthouse-ci-action@v12
        with:
          urls: |
            http://localhost:3001/
            http://localhost:3001/posts
          budgetPath: ./lighthouse-budget.json
```

```json
// lighthouse-budget.json
[
  {
    "path": "/*",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 2500 },
      { "metric": "cumulative-layout-shift", "budget": 0.1 },
      { "metric": "total-blocking-time", "budget": 300 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 200 },
      { "resourceType": "total", "budget": 600 }
    ]
  }
]
```

PR nào vượt ngân sách sẽ fail:

```
✗ script size is 284 KB, over budget by 84 KB
```

---

## Bài tập

1. Chạy Lighthouse trên `npm run dev` rồi trên `npm run build && npm start`. Ghi cả hai và giải thích chênh lệch.
2. Thêm `WebVitals`, tải trang và chép lại đủ 5 chỉ số kèm `rating`.
3. Chạy `ANALYZE=true npm run build`. Chép lại 3 gói lớn nhất trong bundle client.
4. Đếm số file có `'use client'` bằng `grep -rl`. Với mỗi file, viết một câu giải thích vì sao nó cần là client.
5. Tìm một Client Component chỉ dùng để format hoặc tính toán, chuyển về Server Component. Đo bundle trước/sau.
6. Bỏ `priority` khỏi ảnh bìa, chạy Lighthouse, chép lại cảnh báo. Thêm lại và ghi LCP hai lần.
7. Thêm `sizes` cho ảnh `fill`. Thu nhỏ cửa sổ về cỡ điện thoại và chép lại URL `/_next/image?...&w=` trước/sau.
8. Làm skeleton lệch kích thước nội dung thật để tạo CLS. Dùng DevTools Performance tìm ra nó, rồi sửa.
9. Đổi 3 `await` tuần tự thành `Promise.all`, ghi lại `in ...ms` ở terminal.
10. Bật `reactCompiler: true`, đo `time npm run build` trước và sau. Quyết định có giữ không và giải thích.
11. Lập bảng theo dõi như mục 8 với ít nhất 4 lần sửa thật.

Tiếp theo 👉 [05-cache-nhieu-tang.md](<./05-cache-nhieu-tang.md>)
