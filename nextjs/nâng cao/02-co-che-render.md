# Bài 2 (NC) — Cơ chế render: RSC payload, streaming, hydration

Bài này không dạy API mới. Nó giải thích **chuyện gì thực sự xảy ra** khi bạn tải một trang — để bạn debug được thay vì đoán.

## 1. Một request đi qua những gì

```
Trình duyệt gõ /posts/hoc-nextjs
        │
        ├─ 1. proxy.ts chạy (Node.js runtime)
        │
        ├─ 2. Next.js tìm route → app/posts/[slug]/page.tsx
        │
        ├─ 3. Render Server Component
        │      · await fetch → NestJS
        │      · sinh RSC Payload (không phải HTML)
        │
        ├─ 4. React chuyển RSC Payload → HTML
        │      · gửi HTML xuống theo từng đợt (streaming)
        │
        ├─ 5. Trình duyệt hiện HTML       ← người dùng THẤY nội dung ở đây
        │
        ├─ 6. Tải JS của Client Component
        │
        └─ 7. Hydration: React gắn sự kiện vào HTML có sẵn
                                          ← người dùng BẤM được ở đây
```

Khoảng cách giữa bước 5 và 7 chính là lý do bạn thấy nút bấm hiện ra rồi mà bấm chưa ăn. Rút ngắn nó là mục tiêu của cả bài này và [bài 04](<./04-toi-uu-hieu-nang.md>).

---

## 2. RSC Payload là gì

Server Component **không** sinh ra HTML trực tiếp. Nó sinh ra một định dạng trung gian gọi là **RSC Payload** — mô tả cây UI dưới dạng text.

Xem tận mắt:

```bash
$ curl -s 'localhost:3001/posts?_rsc=1' -H 'RSC: 1' | head -20
```

```
0:{"P":null,"b":"development","p":"","c":["","posts"],"i":false,"f":[[["",{...
1:I[4707,[],""]
2:I[36423,[],""]
3:["$","div",null,{"className":"space-y-4","children":[["$","h1",null,{"chi
ldren":"Bài viết"}],["$","ul",null,{"children":[["$","li","1",{"children":
[["$","a",null,{"href":"/posts/hoc-nestjs","children":"Học NestJS trong 7 ngày"}]
```

Đọc được mấy điều quan trọng từ đây:

- `["$","div",null,{...}]` là cách RSC mô tả một phần tử — tên thẻ, props, children.
- `I[4707,[],""]` là tham chiếu tới một **Client Component** cần tải riêng. Server không render nó, chỉ để lại chỗ trống kèm id module.
- Nội dung text ("Học NestJS trong 7 ngày") nằm nguyên trong payload.

Đây là lý do chuyển trang bằng `<Link>` nhẹ hơn nhiều so với `<a>`: bạn chỉ tải payload này, không tải lại HTML đầy đủ + CSS + JS.

Đo thử:

```bash
# Tải HTML đầy đủ
$ curl -s localhost:3001/posts | wc -c
   28471

# Chỉ tải RSC payload
$ curl -s 'localhost:3001/posts?_rsc=1' -H 'RSC: 1' | wc -c
    4192
```

Chênh gần 7 lần cho cùng một nội dung.

---

## 3. Streaming: HTML về theo từng đợt

Với `<Suspense>`, server không chờ đủ dữ liệu mới gửi. Nó gửi phần xong trước.

```bash
$ curl -N -s localhost:3001/posts/hoc-nextjs
```

```html
<article><h1>Học Next.js</h1><div>Nội dung bài viết...</div>
<!--$?--><template id="B:0"></template><p>Đang tải bình luận...</p><!--/$-->
</article></body></html>

        ← (im lặng ở đây khoảng 2 giây)

<div hidden id="S:0"><ul><li><b>An</b>: Bài hay quá</li></ul></div>
<script>$RC("B:0","S:0")</script>
```

Ba thứ cần hiểu:

| Ký hiệu | Vai trò |
|---|---|
| `<!--$?-->` … `<!--/$-->` | Đánh dấu ranh giới Suspense trong HTML |
| `<template id="B:0">` | Chỗ trống, đợi nội dung thật |
| `<div hidden id="S:0">` | Nội dung thật, về sau, đang ẩn |
| `$RC("B:0","S:0")` | Hàm nhỏ của React tráo nội dung vào đúng chỗ |

Điểm quan trọng: **`$RC` là JavaScript thuần vài dòng, không phải React**. Nghĩa là streaming vẫn hoạt động trước khi bundle React tải xong. Đó là lý do nó nhanh.

### Kiểm chứng streaming có thật sự chạy trên hạ tầng của bạn

Đây là bài kiểm tra bắt buộc trước khi lên production:

```bash
$ curl -N -s -w '\n[%{time_starttransfer}s tới byte đầu, %{time_total}s tổng]\n' \
    https://blog-cua-ban.com/posts/hoc-nextjs > /dev/null
```

```
[0.183s tới byte đầu, 2.241s tổng]      ← streaming HOẠT ĐỘNG
```

Nếu hai con số gần bằng nhau:

```
[2.198s tới byte đầu, 2.241s tổng]      ← BỊ BUFFER, streaming vô hiệu
```

Nghĩa là nginx hoặc load balancer đang gom hết mới gửi. Sửa ở [bài 05](<./05-cache-nhieu-tang.md#6-streaming-qua-reverse-proxy>).

---

## 4. Hydration: chỗ chậm mà bạn không nhìn thấy

HTML hiện ra rồi, nhưng nút bấm chưa ăn. Giai đoạn ở giữa gọi là hydration: React tải JS, dựng lại cây component trong bộ nhớ, đối chiếu với DOM có sẵn, rồi gắn event listener.

Đo bằng Performance API:

```tsx
// components/DebugHydration.tsx
'use client'
import { useEffect } from 'react'

export default function DebugHydration() {
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    console.log({
      'HTML về xong': `${Math.round(nav.responseEnd)}ms`,
      'DOM sẵn sàng': `${Math.round(nav.domContentLoadedEventEnd)}ms`,
      'Hydration xong': `${Math.round(performance.now())}ms`,
    })
  }, [])
  return null
}
```

Kết quả điển hình khi bạn đặt `'use client'` sai chỗ:

```
{ 'HTML về xong': '210ms', 'DOM sẵn sàng': '890ms', 'Hydration xong': '1640ms' }
                                                     ← 1.4 giây không bấm được
```

Sau khi đẩy `'use client'` xuống sâu:

```
{ 'HTML về xong': '198ms', 'DOM sẵn sàng': '340ms', 'Hydration xong': '420ms' }
```

**Quy tắc rút ra: mỗi Client Component bạn thêm vào đều kéo dài thời gian hydration.** Server Component thì không — chúng đã thành text trong payload.

### Vì sao lỗi hydration mismatch nguy hiểm hơn vẻ ngoài

```
Error: Hydration failed because the server rendered HTML didn't match the client.
```

Nhiều người tắt nó bằng `suppressHydrationWarning` rồi đi tiếp. Nhưng khi mismatch xảy ra, React **vứt bỏ toàn bộ subtree đó và render lại từ đầu ở client**. Bạn vừa biến một phần trang từ server-rendered thành client-rendered mà không hay biết — mất luôn lợi ích SEO và tốc độ của phần đó.

`suppressHydrationWarning` chỉ nên dùng cho đúng một thẻ chứa giá trị thời gian, không dùng để dập lỗi trên diện rộng.

---

## 5. Prefetch và Router Cache

Next.js 16 viết lại toàn bộ tầng này. Hai cải tiến chính:

- **Layout deduplication** — prefetch nhiều URL chung layout thì layout chỉ tải một lần.
- **Incremental prefetching** — chỉ tải phần chưa có trong cache, không tải lại cả trang.

Hệ quả bạn quan sát được: **số request tăng lên nhưng tổng dung lượng giảm mạnh**. Đây là đánh đổi có chủ ý, đừng hoảng khi thấy tab Network nhiều dòng hơn trước.

Quan sát prefetch:

```
1. Cuộn tới chỗ có <Link href="/posts/abc">
   → Network xuất hiện: /posts/abc?_rsc=8f2a1     2.1 KB

2. Hover chuột lên link
   → không có request mới (đã prefetch từ bước 1)

3. Bấm
   → không có request mới, trang hiện TỨC THÌ
```

### Tắt prefetch khi nào

```tsx
<Link href="/posts" prefetch={false}>Bài viết</Link>
```

Đáng cân nhắc khi trang có **hàng trăm link** cùng lúc (bảng dữ liệu lớn, danh sách vô hạn) — mỗi link là một request tới server.

### `stale` điều khiển router cache ở client

Đây là chỗ nối với [bài 01](<./01-cache-components.md>): thuộc tính `stale` trong `cacheLife` chính là thời gian trình duyệt dùng lại payload đã tải mà không hỏi lại server.

```
stale: 300  → bấm qua lại giữa 2 trang trong 5 phút: không request nào
stale: 30   → sau 30 giây, mỗi lần chuyển trang lại hỏi server
```

Next.js ép **tối thiểu 30 giây** bất kể bạn cấu hình gì, để dữ liệu prefetch không hết hạn trước khi người dùng kịp bấm.

Còn khi bạn gọi `revalidateTag`, `updateTag`, `revalidatePath` hay `refresh` từ Server Action, **toàn bộ router cache ở client bị xoá ngay**, bỏ qua `stale`. Đó là lý do sau khi đăng bài xong bạn thấy dữ liệu mới ngay.

---

## 6. Server Component render mấy lần

Câu hỏi hay gây nhầm. Đáp án theo từng tình huống:

| Tình huống | Server Component | Client Component |
|---|---|---|
| Tải trang lần đầu | 1 lần (server) | 1 lần server (sinh HTML) + hydrate ở client |
| Chuyển trang bằng `<Link>` | 1 lần (server), trả payload | render ở client |
| `router.refresh()` | 1 lần (server) | giữ nguyên state, render lại |
| `useState` đổi trong Client Component | **0 lần** | render lại |
| Server Action + `revalidatePath` | 1 lần (server) | render lại, giữ state |

Dòng thứ 4 là điều quan trọng nhất: **state ở client thay đổi không làm Server Component chạy lại**. Nghĩa là dữ liệu từ server bị "đóng băng" cho tới lần điều hướng hoặc revalidate kế tiếp.

Đây là lý do mẫu này không hoạt động như bạn tưởng:

```tsx
'use client'
// ❌ Đổi filter mong dữ liệu server tự cập nhật — không xảy ra
const [filter, setFilter] = useState('all')
```

Muốn dữ liệu server đổi theo, đẩy trạng thái lên URL:

```tsx
'use client'
const router = useRouter()
// ✅ URL đổi → Next.js gọi lại server → dữ liệu mới
router.push(`/posts?filter=${value}`)
```

Đó chính là lý do `SearchBox` trong [dự án bài 08](<../08-du-an-blog-frontend.md>) đẩy state vào URL thay vì giữ trong `useState`.

---

## 7. Bot và crawler được xử lý khác

Một hành vi ít ai biết nhưng gây bug thật.

Trình duyệt nhận static shell ngay rồi phần động chảy vào. **Bot thì không** — Next.js nhận diện qua user agent và render **toàn bộ trang động tại request time**, chờ xong hết mới gửi HTML hoàn chỉnh (vì crawler cần một tài liệu đầy đủ).

Hệ quả cần cảnh giác: công việc vốn hoàn thành lúc prerender giờ chạy lại lúc có request. Nếu shell của bạn phụ thuộc dữ liệu **chỉ tồn tại lúc build** — biến môi trường build-time, file sinh ra trong bước build — thì trang mở được với người dùng nhưng **lỗi với Googlebot**.

Cách kiểm tra:

```bash
$ curl -s -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
    localhost:3001/posts/hoc-nextjs | grep -c "Học Next.js"
1        ← bot đọc được nội dung
```

Ra `0` là bạn có vấn đề mà người dùng thường không bao giờ gặp.

---

## 8. Đọc `next build` như người có kinh nghiệm

```
Route (app)                              Revalidate  Expire
┌ ○ /                                            1h      1y
├ ● /posts/[slug]                                1d      1w
│   ├ /posts/hoc-nestjs-trong-7-ngay
│   └ [+25 more paths]
├ ◐ /dashboard
└ ƒ /api/health
```

| Ký hiệu | Nghĩa | Chi phí mỗi request |
|---|---|---|
| `○` Static | HTML dựng sẵn lúc build | ~0, phục vụ từ CDN |
| `●` SSG | Dựng sẵn theo `generateStaticParams` | ~0 |
| `◐` PPR | Shell tĩnh + lỗ động chảy vào | Thấp |
| `ƒ` Dynamic | Render lại mỗi request | Cao nhất |

Quy trình tôi khuyên dùng mỗi lần build: **quét cột ký hiệu trước tiên.** Một route đổi từ `○` sang `ƒ` giữa hai lần build nghĩa là ai đó vừa thêm `cookies()` vào một component sâu trong cây — và đó thường là một PR vô tình.

Ghim con số lại để so sánh:

```bash
$ npm run build 2>&1 | grep -E '^[┌├└│]' > build-routes.txt
$ diff build-routes.txt build-routes-truoc.txt
< ├ ƒ /posts
---
> ├ ○ /posts
```

Đưa đoạn này vào CI là cách rẻ nhất để không bao giờ vô tình mất prerender.

> Next.js 16 đã **bỏ cột `Size` và `First Load JS`** vì chúng không phản ánh đúng kiến trúc RSC (hai bundler Turbopack và Webpack còn tính khác nhau). Muốn đo dung lượng thật thì dùng Lighthouse hoặc tab Network — xem [bài 04](<./04-toi-uu-hieu-nang.md>).

---

## 9. Sơ đồ tổng: dữ liệu nằm ở đâu

```
                    ┌─────────────────────────────────────┐
   Build time  ───► │ HTML prerender + RSC payload        │ ─► CDN
                    └─────────────────────────────────────┘
                                    │
                    ┌─────────────────────────────────────┐
   Request     ───► │ use cache (RAM instance)            │
                    │ use cache: remote (Redis dùng chung)│
                    │ fetch cache / unstable_cache        │
                    └─────────────────────────────────────┘
                                    │
                    ┌─────────────────────────────────────┐
   Client      ───► │ Router cache (theo `stale`)         │
                    │ use cache: private                  │
                    └─────────────────────────────────────┘
```

Ba tầng, ba vòng đời khác nhau. Khi gặp bug "dữ liệu cũ", câu hỏi đầu tiên phải là: **cũ ở tầng nào?**

Cách khoanh vùng nhanh:

```bash
# Tầng client? — mở cửa sổ ẩn danh, nếu dữ liệu đúng thì lỗi ở router cache
# Tầng server? — bật log
NEXT_PRIVATE_DEBUG_CACHE=1 npm start

# Tầng CDN? — xem header
curl -sI https://blog-cua-ban.com/posts | grep -iE 'cache-control|x-vercel-cache|age'
```

---

## Bài tập

1. Chạy `curl -s 'localhost:3001/posts?_rsc=1' -H 'RSC: 1'` và chép lại 10 dòng đầu của RSC payload. Chỉ ra chỗ nào là `I[...]` (Client Component).
2. So sánh `wc -c` giữa HTML đầy đủ và RSC payload cho cùng một trang. Ghi lại tỉ lệ.
3. Chạy `curl -N` trên trang có `<Suspense>`, chép lại đoạn `<template id="B:0">` và `$RC(...)`.
4. Đo streaming bằng `curl -w '%{time_starttransfer} / %{time_total}'`. Ghi lại 2 con số và kết luận có bị buffer không.
5. Thêm `DebugHydration`, ghi lại 3 mốc thời gian. Sau đó chuyển một Client Component lớn thành Server Component và đo lại.
6. Chứng minh state client không làm Server Component chạy lại: thêm `console.log` vào Server Component, bấm một nút `useState` nhiều lần, xác nhận terminal không in thêm dòng nào.
7. Giả lập Googlebot bằng `curl -A "...Googlebot..."` và xác nhận nội dung có trong HTML.
8. Lưu bảng route của `next build` ra file. Thêm `cookies()` vào một component con rồi build lại và `diff` — xem route nào đổi từ `○` sang `ƒ`.

Tiếp theo 👉 [03-du-lieu-lon.md](<./03-du-lieu-lon.md>)
