# 50 câu hỏi phỏng vấn Next.js + đáp án

Che đáp án, tự trả lời thành tiếng. ⭐ = rất hay gặp.

Mọi câu viết theo **Next.js 16 + App Router + React 19**. Chỗ nào khác Pages Router thì có ghi chú.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--server-component-vs-client-component) | Server vs Client Component | 12 |
| [B](#b--rendering-và-cache) | Rendering, Cache | 13 |
| [C](#c--routing-và-server-actions) | Routing, Server Actions | 10 |
| [D](#d--auth-seo-bảo-mật) | Auth, SEO, Bảo mật | 8 |
| [E](#e--hiệu-năng-và-vận-hành) | Hiệu năng, vận hành | 7 |

---

## A — Server Component vs Client Component

### A1 ⭐⭐ React Server Component là gì? Khác Client Component thế nào?

**Ngắn:** Server Component chạy **chỉ trên server**, không gửi JavaScript của nó xuống trình duyệt.
Client Component chạy cả hai phía và có JS gửi xuống.

**Đào sâu:** Trong App Router, **mọi component mặc định là Server Component**. Phải khai `'use client'`
mới thành client.

| | Server Component | Client Component |
|---|---|---|
| Gọi database trực tiếp | ✅ | ❌ |
| Dùng `async`/`await` ở thân component | ✅ | ❌ |
| `useState`, `useEffect` | ❌ | ✅ |
| `onClick`, `onChange` | ❌ | ✅ |
| Gửi JS xuống client | **Không** | Có |
| Truy cập biến môi trường bí mật | ✅ | ❌ (chỉ `NEXT_PUBLIC_*`) |

Lợi ích thật: bundle nhỏ hơn, và data fetching nằm ngay cạnh chỗ dùng — không cần API layer trung gian
cho dữ liệu nội bộ.

### A2 ⭐ `'use client'` đặt ở đâu? Nó ảnh hưởng tới file nào?

**Ngắn:** Đặt ở **đầu file**. Nó đánh dấu **ranh giới** — file đó và **mọi thứ nó import** đều thành
client.

**Đào sâu:** Đây là chỗ hay hiểu sai. `'use client'` không chỉ áp cho một component mà cho cả cây phía
dưới nó.

Hệ quả: đặt `'use client'` ở `app/layout.tsx` là **biến gần như toàn bộ ứng dụng thành client** — mất
hết lợi ích của RSC.

Quy tắc của dự án Blog: **`app/` chỉ chứa route, mọi `'use client'` nằm trong `components/`** — đẩy
ranh giới xuống càng sâu càng tốt.

### A3 ⭐ Server Component có truyền được props cho Client Component không?

**Ngắn:** Được, nhưng props phải **serialize được**.

**Đào sâu:**

```tsx
// ✅ được
<ClientComp posts={posts} count={5} onSubmitAction={serverAction} />

// ❌ không được: function thường, class instance, Date với method tuỳ biến, Symbol
<ClientComp onClick={() => {}} />
```

Lỗi:
```
Error: Functions cannot be passed directly to Client Components unless you explicitly expose it
by marking it with "use server".
```

Ngoại lệ quan trọng: **Server Action truyền xuống được** vì nó được đánh dấu `'use server'` — Next thay
nó bằng một tham chiếu, không phải hàm thật.

### A4 Client Component có bọc Server Component được không?

**Ngắn:** Được, nhưng phải qua `children` (hoặc props), không phải import trực tiếp.

**Đào sâu:**

```tsx
// ❌ import trực tiếp → ServerComp bị kéo thành client
'use client';
import ServerComp from './ServerComp';

// ✅ nhận qua children — ServerComp vẫn render ở server
'use client';
export function Wrapper({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

```tsx
// app/page.tsx (server)
<Wrapper><ServerComp /></Wrapper>
```

Đây là mẫu quan trọng nhất khi cần Provider (theme, react-query) mà vẫn giữ RSC bên trong.

### A5 ⭐ Vì sao Server Component không dùng được `useState`?

**Ngắn:** Vì nó chạy **một lần trên server** rồi biến mất — không có vòng đời, không có re-render, không
có gì để giữ state.

**Đào sâu:** Kết quả gửi xuống client là **RSC payload** (mô tả UI đã render), không phải code. Không
có code thì không có hook.

### A6 RSC payload là gì?

**Ngắn:** Là định dạng dữ liệu mô tả cây UI đã render ở server, được stream xuống client.

**Đào sâu:** Nó **không phải HTML**. Nó chứa cả chỗ trống đánh dấu "đây là Client Component X với props
Y" để React ở client ghép vào. Nhờ vậy điều hướng bằng `<Link>` không cần tải lại cả trang — chỉ tải
payload của phần đổi.

### A7 ⭐ Hydration là gì? Hydration mismatch xảy ra khi nào?

**Ngắn:** Là quá trình React ở client gắn event listener vào HTML mà server đã render.

**Đào sâu:** Mismatch xảy ra khi HTML server render **khác** với những gì client render lần đầu:

```tsx
// ❌ giá trị khác nhau giữa server và client
<p>{new Date().toLocaleString()}</p>
<p>{Math.random()}</p>
{typeof window !== 'undefined' && <X />}
```

```
Error: Text content does not match server-rendered HTML.
```

Sửa: render sau khi mount (`useEffect` + state), hoặc `suppressHydrationWarning` cho trường hợp biết
chắc (như timestamp).

### A8 Làm sao biết một component đang là server hay client?

**Ngắn:** Thử `console.log` — Server Component in ra **terminal**, Client Component in ra **console
trình duyệt**.

**Đào sâu:** Cách chắc chắn hơn: Server Component dùng được `async` ở thân hàm. Nếu bạn viết
`export default async function X()` mà không lỗi thì nó là server.

### A9 Thư viện chỉ chạy được ở client thì làm sao?

**Ngắn:** Bọc trong file có `'use client'`, hoặc `dynamic(() => import(...), { ssr: false })`.

**Đào sâu:** Dùng `ssr: false` khi thư viện đụng `window`/`document` lúc import. Đánh đổi: component đó
không có HTML lúc đầu → ảnh hưởng LCP nếu nó nằm trên màn hình đầu.

### A10 `next/image` giúp gì?

**Ngắn:** Tự resize, đổi định dạng (WebP/AVIF), lazy load, và **giữ chỗ để không nhảy layout**.

**Đào sâu:** Phải khai `width`/`height` (hoặc `fill`) — đó là thứ chống **CLS**. Với ảnh trên màn hình
đầu thì thêm `priority` để nó không lazy load, cải thiện **LCP**.

⚠️ Next 16: `images.qualities` mặc định chỉ chấp nhận `[75]` — truyền `quality={90}` mà không khai
trong config sẽ lỗi.

### A11 `next/font` giúp gì?

**Ngắn:** Tải font tự host, không gọi Google Fonts lúc chạy, và tự sinh fallback để giảm CLS.

### A12 Khi nào bạn **cần** Client Component?

**Ngắn:** Khi cần state, effect, event handler, browser API, hoặc thư viện chỉ chạy client.

**Đào sâu:** Câu trả lời tốt nên kèm nguyên tắc:

> "Em mặc định để Server Component, chỉ chuyển sang client khi thật sự cần tương tác. Và em đẩy ranh
> giới `'use client'` xuống càng sâu càng tốt — ví dụ nút Like là client, còn cả trang bài viết vẫn là
> server."

---

## B — Rendering và Cache

### B1 ⭐⭐ SSR, SSG, ISR, CSR khác nhau thế nào?

**Ngắn:**

| Kiểu | Render lúc nào | Dùng cho |
|------|---------------|----------|
| **SSG** | Lúc build | Trang tĩnh: landing, tài liệu |
| **ISR** | Lúc build + tự làm mới theo chu kỳ | Blog, danh mục sản phẩm |
| **SSR** | Mỗi request | Trang phụ thuộc user hoặc dữ liệu luôn mới |
| **CSR** | Trên trình duyệt | Dashboard sau đăng nhập, phần tương tác cao |

**Đào sâu:** Trong App Router bạn **không chọn bằng tên hàm** như Pages Router (`getStaticProps` /
`getServerSideProps`). Next tự suy từ cách bạn fetch:

```tsx
await fetch(url)                                    // mặc định: không cache → giống SSR
await fetch(url, { cache: 'force-cache' })          // giống SSG
await fetch(url, { next: { revalidate: 60 } })      // giống ISR
```

Hoặc ép cả route:

```tsx
export const dynamic = 'force-dynamic';   // luôn SSR
export const revalidate = 3600;           // ISR 1 giờ
```

⚠️ Dùng `cookies()`, `headers()`, hay `searchParams` là route **tự động thành dynamic** — không cache
được nữa. Đây là nguyên nhân số một của "sao trang em không được cache".

### B2 ⭐⭐ Next.js có mấy tầng cache?

**Ngắn:** Bốn.

| Tầng | Ở đâu | Cache gì | Xoá bằng |
|------|-------|----------|----------|
| **Request Memoization** | Server, trong **một** request | `fetch` trùng URL trong cùng request | Tự hết khi request xong |
| **Data Cache** | Server, qua nhiều request | Kết quả `fetch` | `revalidateTag`, `revalidatePath` |
| **Full Route Cache** | Server | HTML + RSC payload của route tĩnh | `revalidatePath`, deploy mới |
| **Router Cache** | **Trình duyệt** | RSC payload đã điều hướng qua | `router.refresh()`, hết hạn |

**Đào sâu:** Đây là câu hỏi khó nhất về Next.js, và cũng là nguồn của lỗi "dữ liệu cũ" hay gặp nhất.

Câu trả lời ghi điểm là nêu được **thứ tự đi tìm khi dữ liệu không cập nhật**:

> "Em kiểm tra từ ngoài vào trong. Đầu tiên là **Router Cache** ở trình duyệt — thử hard refresh, nếu
> hết cũ thì gọi `router.refresh()` sau khi mutate. Nếu vẫn cũ thì tới **Data Cache** — cần
> `revalidateTag`. Còn nếu chỉ cũ ở production mà local ổn thì thường là **Full Route Cache** — route
> đang bị prerender tĩnh."

### B3 `revalidatePath` khác `revalidateTag` chỗ nào?

**Ngắn:** `revalidatePath` xoá theo đường dẫn; `revalidateTag` xoá theo nhãn gắn vào `fetch`.

**Đào sâu:**

```tsx
await fetch(url, { next: { tags: ['posts'] } });

// trong Server Action
revalidateTag('posts');       // xoá mọi fetch gắn tag đó, ở mọi route
revalidatePath('/posts');     // xoá đúng route đó
```

`revalidateTag` linh hoạt hơn — một bài viết xuất hiện ở trang chủ, trang danh mục và trang chi tiết
thì một lệnh xoá hết.

⚠️ **Next 16: `revalidateTag` nhận 2 tham số**, khác các bản trước. Xem
[09-cheatsheet.md](../09-cheatsheet.md).

### B4 ⭐ Streaming và Suspense trong App Router?

**Ngắn:** Next gửi HTML theo từng phần — phần nào xong trước hiện trước, phần chậm hiện fallback.

**Đào sâu:**

```tsx
export default function Page() {
  return (
    <>
      <Header />                                {/* hiện ngay */}
      <Suspense fallback={<Skeleton />}>
        <SlowComments />                        {/* stream sau */}
      </Suspense>
    </>
  );
}
```

Hoặc dùng `loading.tsx` — Next tự bọc `Suspense` quanh cả route.

Lợi ích đo được: **TTFB** và **FCP** tốt hơn hẳn, vì người dùng thấy khung trang ngay thay vì chờ query
chậm nhất.

### B5 `loading.tsx` hoạt động thế nào?

**Ngắn:** Next tự bọc `page.tsx` trong `<Suspense fallback={<Loading />}>`.

**Đào sâu:** Nó áp cho cả route segment và các route con. Muốn kiểm soát chi tiết hơn thì dùng
`<Suspense>` thủ công quanh đúng phần chậm.

### B6 Song song hay tuần tự khi fetch nhiều nguồn?

**Ngắn:** `await` liên tiếp là **tuần tự** — chậm. Dùng `Promise.all`.

**Đào sâu:**

```tsx
// ❌ 300ms + 400ms = 700ms
const posts = await getPosts();
const cats = await getCategories();

// ✅ max(300, 400) = 400ms
const [posts, cats] = await Promise.all([getPosts(), getCategories()]);
```

Đây là lỗi hiệu năng hay gặp nhất trong Server Component.

### B7 Request Memoization là gì? Vì sao hữu ích?

**Ngắn:** Trong **một** request, hai lời gọi `fetch` cùng URL chỉ chạy một lần.

**Đào sâu:** Nhờ nó bạn gọi `getUser()` ở cả layout và page mà không sợ query hai lần — không cần
truyền props xuống hay dùng context. Chỉ áp cho `fetch`; với hàm khác thì bọc `React.cache()`.

### B8 ⭐ `generateStaticParams` để làm gì?

**Ngắn:** Khai trước danh sách tham số động để Next prerender lúc build.

**Đào sâu:**

```tsx
export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.map(p => ({ slug: p.slug }));
}
```

Kết hợp `dynamicParams`:
- `true` (mặc định): slug không có trong danh sách vẫn render lúc chạy.
- `false`: trả 404.

### B9 Dữ liệu vừa sửa mà trang không cập nhật — bạn tìm ở đâu?

**Ngắn:** Đi qua bốn tầng cache theo thứ tự từ trình duyệt vào server.

**Đào sâu:** Xem [B2](#b2--nextjs-có-mấy-tầng-cache). Ba lệnh cần nhớ:

```tsx
revalidateTag('posts');    // Data Cache
revalidatePath('/posts');  // Data + Full Route Cache
router.refresh();          // Router Cache ở client
```

Sau một Server Action sửa dữ liệu, thường cần **cả** `revalidateTag` (server) **và** để Next tự làm mới
router cache — Server Action trả về sẽ kích hoạt việc đó.

### B10 `unstable_cache` / `use cache` là gì?

**Ngắn:** Cách cache kết quả của hàm **không phải `fetch`** (ví dụ query database trực tiếp).

**Đào sâu:** Next 16 có directive `'use cache'` (thuộc Cache Components) — mới, cần bật cấu hình. Với
dự án hiện tại thì `unstable_cache` đủ dùng:

```tsx
const getPosts = unstable_cache(
  async () => db.post.findMany(),
  ['posts'],
  { revalidate: 60, tags: ['posts'] },
);
```

### B11 PPR (Partial Prerendering) là gì?

**Ngắn:** Trang có **phần tĩnh** phục vụ ngay từ CDN và **phần động** stream sau, trong cùng một route.

**Đào sâu:** Trước PPR bạn phải chọn cả route là tĩnh hoặc động. PPR cho phép khung trang tĩnh + phần
cá nhân hoá (giỏ hàng, tên người dùng) stream vào. Vẫn đang ổn định dần — biết khái niệm là đủ ở mức
middle.

### B12 Cache trong Next khi chạy nhiều instance?

**Ngắn:** Data Cache mặc định nằm trên **filesystem của từng instance** — mỗi máy một bản.

**Đào sâu:** Cần cache handler dùng chung (Redis) để `revalidateTag` ở instance A có tác dụng ở B.
Không làm thì người dùng thấy dữ liệu cũ hay mới tuỳ vào họ rơi vào máy nào — lỗi rất khó tái hiện.
Chi tiết ở [nâng cao/05](<../nâng cao/05-cache-nhieu-tang.md>).

### B13 `export const dynamic` có mấy giá trị?

**Ngắn:** `'auto'` (mặc định), `'force-dynamic'`, `'force-static'`, `'error'`.

**Đào sâu:** `'error'` hữu ích khi bạn **muốn** route phải tĩnh — nó báo lỗi lúc build nếu có gì đó
khiến route thành dynamic, thay vì âm thầm mất cache.

---

## C — Routing và Server Actions

### C1 ⭐ App Router khác Pages Router chỗ nào?

**Ngắn:** App Router dùng thư mục `app/`, mặc định Server Component, layout lồng nhau, và có
streaming/Suspense. Pages Router dùng `pages/`, mọi thứ là client, data fetching qua `getServerSideProps`
/`getStaticProps`.

**Đào sâu:** Nêu được sự tương ứng là điểm cộng:

| Pages Router | App Router |
|---|---|
| `getServerSideProps` | `fetch` không cache / `dynamic = 'force-dynamic'` |
| `getStaticProps` | `fetch` với `force-cache` |
| `getStaticProps` + `revalidate` | `next: { revalidate: N }` |
| `_app.tsx`, `_document.tsx` | `layout.tsx` |
| `pages/api/` | `app/api/route.ts` |

### C2 Các file đặc biệt trong App Router?

**Ngắn:** `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`,
`template.tsx`, `default.tsx`.

**Đào sâu:** Hai cái hay bị nhầm:
- `layout.tsx` **giữ nguyên state** khi điều hướng giữa các route con; `template.tsx` **dựng lại** mỗi
  lần.
- `default.tsx` **bắt buộc từ Next 16** cho parallel route — thiếu là lỗi lúc build.

### C3 ⭐ Next 16 đổi gì ở `params` và `searchParams`?

**Ngắn:** Chúng thành **Promise**, phải `await`.

**Đào sâu:**

```tsx
// Next 16
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
```

Tương tự `cookies()`, `headers()`, `draftMode()` đều phải `await`. Đây là thứ khiến code copy từ blog
Next 14 chạy sai ngay.

### C4 `middleware.ts` ở Next 16?

**Ngắn:** Đổi tên thành **`proxy.ts`**, và chạy trên runtime Node.js.

**Đào sâu:** Trước đây middleware chạy Edge runtime nên nhiều thư viện Node không dùng được. Đổi sang
Node runtime là thay đổi lớn — giờ dùng được `jsonwebtoken`, driver database, v.v.

### C5 ⭐ Server Action là gì? Khác Route Handler thế nào?

**Ngắn:** Server Action là hàm chạy trên server, gọi thẳng từ component (kể cả client) mà không cần tự
tạo endpoint. Route Handler là endpoint HTTP thật.

**Đào sâu:**

```tsx
'use server';

export async function createPost(formData: FormData) {
  const title = formData.get('title');
  await db.post.create({ data: { title } });
  revalidateTag('posts');
}
```

```tsx
<form action={createPost}>
```

| | Server Action | Route Handler |
|---|---|---|
| Dùng cho | Form, mutation từ UI của chính bạn | API cho client ngoài, webhook |
| Có URL công khai | Không (endpoint sinh tự động) | Có |
| Progressive enhancement | ✅ form chạy được khi JS chưa tải | ❌ |

### C6 ⚠️ Server Action có an toàn không?

**Ngắn:** **Không tự động.** Nó là một endpoint HTTP công khai — ai cũng gọi được.

**Đào sâu:** Đây là câu hỏi bẫy rất hay gặp.

```tsx
'use server';

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });     // ❌ KHÔNG kiểm tra quyền
}
```

Người dùng bất kỳ có thể gọi action này với id bất kỳ. **Phải tự kiểm tra trong mỗi action:**

```tsx
export async function deletePost(id: string) {
  const session = await getSession();
  if (!session) throw new Error('Chưa đăng nhập');

  const post = await db.post.findUnique({ where: { id } });
  if (post?.authorId !== session.userId) throw new Error('Không có quyền');

  await db.post.delete({ where: { id } });
  revalidateTag('posts');
}
```

Và **validate đầu vào** bằng Zod — đừng tin `formData`.

### C7 `useFormStatus` và `useActionState` dùng khi nào?

**Ngắn:** `useFormStatus` lấy trạng thái đang gửi của form cha; `useActionState` giữ kết quả trả về của
action (thường là lỗi validate).

**Đào sâu:**

```tsx
'use client';
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Đang lưu...' : 'Lưu'}</button>;
}
```

`useFormStatus` **phải nằm trong component con** của form, không dùng được ở chính component chứa
`<form>`.

### C8 Route Handler viết thế nào?

**Ngắn:** `app/api/posts/route.ts` export hàm theo tên HTTP method.

**Đào sâu:**

```tsx
export async function GET(req: NextRequest) {
  return Response.json({ data: [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return Response.json({ ok: true }, { status: 201 });
}
```

Trong dự án Blog, Route Handler dùng làm **proxy** tới NestJS API để giấu token khỏi trình duyệt.

### C9 Parallel route và intercepting route?

**Ngắn:** Parallel route (`@folder`) render nhiều slot cùng lúc; intercepting route (`(.)folder`) chặn
điều hướng để hiện modal mà vẫn giữ URL.

**Đào sâu:** Kết hợp hai cái là cách làm modal có URL riêng — bấm vào ảnh mở modal, refresh trang thì
ra trang đầy đủ. ⚠️ Next 16 bắt buộc có `default.tsx` cho mỗi slot.

### C10 `<Link>` khác `<a>` chỗ nào?

**Ngắn:** `<Link>` điều hướng phía client (chỉ tải RSC payload của phần đổi) và **prefetch** khi vào
viewport.

**Đào sâu:** Dùng `<a>` là tải lại cả trang, mất hết lợi ích. Muốn tắt prefetch (link ít dùng, tốn
băng thông) thì `prefetch={false}`.

---

## D — Auth, SEO, Bảo mật

### D1 ⭐ Lưu JWT ở đâu trong Next.js?

**Ngắn:** **Cookie `httpOnly`**, không phải localStorage.

**Đào sâu:** localStorage đọc được bằng JavaScript → XSS lấy được token. Cookie `httpOnly` thì JS không
đọc được.

```tsx
const cookieStore = await cookies();       // ⚠️ Next 16: phải await
cookieStore.set('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
```

`sameSite: 'lax'` là lá chắn CSRF cơ bản.

### D2 Bảo vệ route trong App Router?

**Ngắn:** Hai tầng — `proxy.ts` chặn sớm, và kiểm tra lại trong từng Server Component/Action.

**Đào sâu:** Chỉ dựa vào `proxy.ts` là **không đủ**: Server Action không đi qua nó theo cách bạn nghĩ,
và một sai sót ở matcher là lộ. Nguyên tắc: **kiểm tra quyền ở nơi truy cập dữ liệu**, không phải chỉ ở
tầng điều hướng.

Đó là ý tưởng của **Data Access Layer** — mọi truy vấn đi qua một lớp có kiểm tra session, xem
[nâng cao/07](<../nâng cao/07-kien-truc-quy-mo-lon.md>).

### D3 Biến môi trường nào lộ ra client?

**Ngắn:** Mọi biến bắt đầu bằng `NEXT_PUBLIC_`.

**Đào sâu:** Chúng được **nhúng thẳng vào bundle** lúc build — đổi giá trị phải build lại, và ai xem
source cũng thấy. Không bao giờ đặt secret vào `NEXT_PUBLIC_*`.

Biến không có tiền tố chỉ đọc được ở Server Component, Server Action, Route Handler.

### D4 ⭐ Làm SEO trong App Router?

**Ngắn:** `metadata` tĩnh hoặc `generateMetadata` động, cộng `sitemap.ts` và `robots.ts`.

**Đào sâu:**

```tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, images: [post.cover] },
    alternates: { canonical: `/posts/${slug}` },
  };
}
```

Lợi thế của RSC cho SEO: nội dung có sẵn trong HTML, không cần JS chạy xong mới thấy — khác hẳn SPA
thuần.

### D5 Structured data (JSON-LD) thêm thế nào?

**Ngắn:** Chèn `<script type="application/ld+json">` trong Server Component.

**Đào sâu:** Dùng `dangerouslySetInnerHTML` với `JSON.stringify` — nhớ escape. Nó giúp Google hiển thị
rich result cho bài viết.

### D6 `not-found.tsx` và `error.tsx` khác nhau?

**Ngắn:** `not-found.tsx` cho 404 (gọi bằng `notFound()`); `error.tsx` bắt lỗi runtime và **phải là
Client Component**.

**Đào sâu:** `error.tsx` nhận `reset()` để thử render lại. Nó **không** bắt lỗi trong `layout.tsx` cùng
cấp — muốn bắt thì cần `global-error.tsx`.

### D7 XSS trong Next.js?

**Ngắn:** React escape mặc định. Rủi ro nằm ở `dangerouslySetInnerHTML`.

**Đào sâu:** Nội dung HTML do người dùng nhập phải lọc bằng thư viện (DOMPurify) trước. Và cẩn thận
`href={userInput}` — `javascript:` không bị React chặn.

### D8 CSRF với Server Actions?

**Ngắn:** Next có bảo vệ sẵn (kiểm tra Origin), nhưng `sameSite` cookie vẫn là lớp cần thiết.

---

## E — Hiệu năng và vận hành

### E1 ⭐ Core Web Vitals là gì? Next giúp gì?

**Ngắn:** **LCP** (nội dung lớn nhất hiện lúc nào), **INP** (phản hồi tương tác), **CLS** (nhảy layout).

**Đào sâu:** Next giúp trực tiếp:

| Chỉ số | Next giúp bằng |
|--------|----------------|
| LCP | RSC (ít JS hơn), streaming, `next/image` với `priority` |
| INP | Ít JS xuống client hơn → main thread rảnh hơn |
| CLS | `next/image` bắt khai kích thước, `next/font` sinh fallback |

Ngưỡng "tốt": LCP < 2.5s, INP < 200ms, CLS < 0.1.

### E2 Bundle quá lớn — bạn làm gì?

**Ngắn:** Đo trước bằng `@next/bundle-analyzer`, rồi giảm.

**Đào sâu:** Thứ tự xử lý:
1. Tìm `'use client'` đặt quá cao — đẩy xuống sâu hơn.
2. `dynamic()` cho component nặng, ít dùng (biểu đồ, editor).
3. Thay thư viện nặng (moment → date-fns hoặc `Intl` sẵn có).
4. Kiểm tra import cả thư viện thay vì một hàm.

### E3 ⭐ Trang chậm — quy trình tìm nguyên nhân?

**Ngắn:** Phân biệt chậm ở **server** hay ở **client** trước.

**Đào sâu:**

> "Em xem TTFB trước. TTFB cao thì vấn đề ở server — thường là fetch tuần tự thay vì `Promise.all`,
> hoặc query chậm, hoặc route đáng lẽ tĩnh mà thành dynamic vì lỡ dùng `cookies()`.
>
> TTFB ổn mà LCP vẫn cao thì là client — bundle lớn, ảnh không tối ưu, hoặc font chặn render.
>
> Sau đó em thêm `<Suspense>` quanh phần chậm để nó không chặn cả trang."

### E4 Đo hiệu năng bằng gì?

**Ngắn:** Lighthouse cho lab, `useReportWebVitals` cho dữ liệu người dùng thật (RUM).

**Đào sâu:** Lab data (Lighthouse) chạy trên máy bạn, mạng bạn — không phản ánh người dùng thật. RUM
mới cho biết p75 thực tế.

### E5 Deploy Next.js ngoài Vercel?

**Ngắn:** `output: 'standalone'` rồi đóng gói Docker.

**Đào sâu:** Ba thứ phải tự lo khi không dùng Vercel:
- **Cache handler dùng chung** nếu chạy nhiều instance (xem [B12](#b12-cache-trong-next-khi-chạy-nhiều-instance)).
- **Tối ưu ảnh** — `next/image` cần sharp, hoặc trỏ sang CDN ảnh.
- **ISR** cần filesystem bền hoặc cache handler ngoài.

### E6 `next lint` đâu rồi?

**Ngắn:** Next 16 **đã gỡ**. Dùng ESLint trực tiếp.

**Đào sâu:** Chi tiết đó nhỏ nhưng cho thấy bạn đã thật sự chạy bản 16.

### E7 Bạn thích và không thích gì ở Next.js?

**Mẫu:**

> "Em thích RSC — data fetching nằm ngay cạnh chỗ dùng, và bundle nhỏ hơn hẳn vì component chỉ hiển thị
> không gửi JS xuống. Streaming cũng làm trải nghiệm tốt hơn nhiều so với chờ query chậm nhất.
>
> Điểm khó nhất là **cache**. Bốn tầng cache với quy tắc khác nhau, và mặc định thay đổi giữa các bản
> lớn. Lỗi 'dữ liệu không cập nhật' rất hay gặp và mất thời gian tìm. Em xử lý bằng cách nhớ thứ tự
> kiểm tra từ Router Cache ở trình duyệt vào tới Data Cache ở server."

---

## Bài tập vẽ và code

Trong 5 phút, không nhìn tài liệu:

1. Vẽ sơ đồ **4 tầng cache** của Next, ghi rõ mỗi tầng xoá bằng lệnh gì.
2. Viết một Server Component fetch song song 2 nguồn bằng `Promise.all`, có `<Suspense>` cho phần chậm.
3. Viết Server Action tạo bài viết: kiểm tra session → validate Zod → ghi DB → `revalidateTag`.
4. Viết `generateMetadata` động cho trang chi tiết bài viết.
5. Chỉ ra 3 chỗ trong code Next 14 sẽ hỏng khi nâng lên Next 16.

<details>
<summary>Gợi ý đáp án bài 5</summary>

1. `const { slug } = params` → phải `await params`.
2. `const cookieStore = cookies()` → phải `await cookies()`.
3. File `middleware.ts` → đổi tên thành `proxy.ts`.

Ngoài ra: `revalidateTag` đổi số tham số, parallel route thiếu `default.tsx`, và `next lint` không còn.

</details>

---

Tiếp theo: [02-tu-kiem-tra.md](./02-tu-kiem-tra.md)
