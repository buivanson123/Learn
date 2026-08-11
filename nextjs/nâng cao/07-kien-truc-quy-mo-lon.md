# Bài 7 (NC) — Kiến trúc dự án lớn

Bài này là bản Next.js của [../../nestjs/cau-truc-chuan.md](../../nestjs/cau-truc-chuan.md): quy ước đặt file và cách **ép cả team tuân thủ** thay vì chỉ mong họ nhớ.

## 1. Vấn đề đặc thù của Next.js

Framework backend hỏng thì hỏng rõ ràng. Next.js hỏng **âm thầm**:

| Sai lầm | Không có lỗi nào | Nhưng |
|---|---|---|
| `'use client'` đặt hơi cao một bậc | ✅ chạy tốt | 200 KB JS thừa xuống trình duyệt |
| Import module DB vào Client Component | ✅ build được | Connection string lộ trong bundle |
| Quên kiểm tra quyền trong Server Action | ✅ giao diện đúng | Ai cũng gọi được bằng curl |
| Truyền cả entity xuống Client Component | ✅ hiện đúng | Cột `password_hash` nằm trong HTML |

Không cái nào làm build fail. Đó là lý do dự án Next.js cần **ranh giới được ép bằng công cụ**, không thể dựa vào code review.

---

## 2. Cây thư mục cho dự án lớn

```
src/
├── app/                          ← CHỈ chứa route
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── about/page.tsx
│   ├── (app)/                    ← sau đăng nhập
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   └── settings/page.tsx
│   ├── posts/
│   │   ├── page.tsx
│   │   ├── actions.ts            ← Server Action mỏng, uỷ quyền xuống DAL
│   │   └── [slug]/page.tsx
│   └── api/
│       └── webhooks/stripe/route.ts
│
├── features/                     ← chia theo NGHIỆP VỤ, không theo loại file
│   ├── posts/
│   │   ├── components/
│   │   │   ├── PostCard.tsx           (server)
│   │   │   ├── PostForm.tsx           (client)
│   │   │   └── DeleteButton.tsx       (client)
│   │   ├── schemas.ts                 Zod
│   │   └── types.ts
│   ├── auth/
│   │   ├── components/LoginForm.tsx
│   │   └── schemas.ts
│   └── comments/
│
├── data/                         ← DATA ACCESS LAYER — server-only
│   ├── auth.ts                        getCurrentUser, requireUser
│   ├── posts.ts                       đọc + ghi bài viết, KÈM kiểm tra quyền
│   ├── comments.ts
│   └── dto.ts                         chuyển entity → object an toàn
│
├── components/ui/                ← nguyên thuỷ, không dính nghiệp vụ
│   ├── Button.tsx
│   ├── Input.tsx
│   └── Skeleton.tsx
│
├── lib/                          ← tiện ích thuần
│   ├── http.ts                        apiFetch
│   ├── format.ts
│   └── env.ts                         validate biến môi trường
│
└── proxy.ts
```

### Bảng tra "file này để đâu"

| Bạn đang viết | Đặt ở | Ghi chú |
|---|---|---|
| Trang mới | `app/<route>/page.tsx` | |
| Layout | `app/<route>/layout.tsx` | |
| Server Action | `app/<route>/actions.ts` | Mỏng — chỉ gọi xuống `data/` |
| Component có `'use client'` | `features/<nghiệp vụ>/components/` | **Không bao giờ** để trong `app/` |
| Component hiển thị (server) | `features/<nghiệp vụ>/components/` | |
| Nút, input, card chung | `components/ui/` | Không import từ `data/` |
| Truy vấn dữ liệu + kiểm tra quyền | `data/<nghiệp vụ>.ts` | Có `import 'server-only'` |
| Zod schema | `features/<nghiệp vụ>/schemas.ts` | Dùng chung cho form và action |
| Hàm format, tiện ích thuần | `lib/` | Không side effect |
| API endpoint | `app/api/<tên>/route.ts` | Chỉ khi thật cần ([bài 05 cơ bản](<../05-route-handler-va-proxy.md#5-khi-nào-cần-route-handler>)) |

**Hai quy tắc vàng:**

1. **`app/` chỉ chứa route.** Nhìn vào `app/` là thấy ngay bản đồ URL, không lẫn gì khác.
2. **Không có `'use client'` nào trong `app/`.** Kiểm tra bằng một dòng:

```bash
$ grep -rl "use client" src/app/
                     ← rỗng là đạt
```

Quy tắc 2 nghe khắt khe nhưng cực kỳ hiệu quả: nó buộc mọi ranh giới server/client phải nằm ở chỗ dễ thấy, và mọi page đều là Server Component.

---

## 3. Data Access Layer

Đây là mẫu quan trọng nhất trong bài. Ý tưởng: **mọi lối vào dữ liệu đều đi qua một tầng, và tầng đó tự kiểm tra quyền.**

```ts
// src/data/posts.ts
import 'server-only'                    // ← build fail nếu bị import vào client

import { cache } from 'react'
import { apiFetch } from '@/lib/http'
import { getCurrentUser } from './auth'
import type { Post } from '@/features/posts/types'

// ── DTO: chỉ những trường client được phép thấy ──────────────
export type PostDTO = {
  id: number
  title: string
  slug: string
  content: string
  viewCount: number
  createdAt: string
  author: { id: number; name: string }
  canEdit: boolean
}

function toPostDTO(post: Post, viewerId: number | null, isAdmin: boolean): PostDTO {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
    author: { id: post.author.id, name: post.author.name },
    // Tính quyền ở SERVER, client chỉ nhận boolean
    canEdit: isAdmin || post.author.id === viewerId,
  }
}

// ── Đọc ──────────────────────────────────────────────────────
export const getPost = cache(async (slug: string): Promise<PostDTO | null> => {
  const post = await apiFetch<Post>(`/posts/slug/${slug}`, {
    next: { revalidate: 3600, tags: ['posts', `post-${slug}`] },
  })
  if (!post) return null

  const viewer = await getCurrentUser()
  return toPostDTO(post, viewer?.id ?? null, viewer?.role === 'admin')
})

// ── Ghi: kiểm tra quyền NGAY TẠI ĐÂY ────────────────────────
export async function deletePost(id: number): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')

  const post = await apiFetch<Post>(`/posts/${id}`, { cache: 'no-store' })
  if (!post) throw new Error('NOT_FOUND')

  if (post.author.id !== user.id && user.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }

  await apiFetch(`/posts/${id}`, { method: 'DELETE' })
}
```

Server Action trở nên mỏng dính:

```ts
// src/app/posts/actions.ts
'use server'

import { revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { deletePost as deletePostDAL } from '@/data/posts'

export async function deletePostAction(id: number) {
  await deletePostDAL(id)          // xác thực + phân quyền nằm trong DAL
  revalidateTag('posts', 'max')
  redirect('/dashboard')
}
```

Lợi ích cụ thể, không phải lý thuyết:

| | Không có DAL | Có DAL |
|---|---|---|
| Audit bảo mật | Đọc hết mọi action, mọi page | Đọc một thư mục `data/` |
| Quên kiểm tra quyền | Rất dễ, mỗi action một kiểu | Khó — kiểm tra ở cùng chỗ với truy vấn |
| Rò rỉ trường dữ liệu | Truyền cả entity xuống client | DTO chặn từ gốc |
| `process.env` rải rác | Khắp nơi | Chỉ trong `data/` và `lib/env.ts` |

Dòng `canEdit` trong DTO đáng nói riêng: nó tính quyền ở server và gửi xuống **một boolean**. Cách làm sai là gửi cả `viewer` và `post.author.id` xuống rồi để client tự so — vừa lộ dữ liệu vừa dễ bị qua mặt.

---

## 4. `server-only` và `client-only`

```bash
npm i server-only client-only
```

```ts
// src/data/posts.ts
import 'server-only'
```

Vô tình import từ Client Component:

```tsx
'use client'
import { getPost } from '@/data/posts'
```

```
Error: You're importing a component that needs "server-only". That only works
in a Server Component but one of its parents is marked with "use client".

   ╭─[src/features/posts/components/PostForm.tsx:2:1]
 2 │ import { getPost } from '@/data/posts'
```

Đây là **lỗi lúc build**, không phải lỗi lúc chạy. Nghĩa là nó không bao giờ lên được production.

Chiều ngược lại cũng có:

```ts
// src/lib/browser-storage.ts
import 'client-only'          // dùng localStorage, window
```

Cặp hai package này là hàng rào rẻ nhất và hiệu quả nhất mà bạn có thể dựng. **Thêm `import 'server-only'` vào mọi file trong `data/` ngay từ ngày đầu.**

---

## 5. Validate biến môi trường lúc khởi động

Lỗi kinh điển: deploy xong 20 phút mới phát hiện thiếu một biến, vì trang gây lỗi ít người vào.

```ts
// src/lib/env.ts
import 'server-only'
import { z } from 'zod'

const serverSchema = z.object({
  API_URL: z.string().url('API_URL phải là URL hợp lệ'),
  REDIS_URL: z.string().url().optional(),
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

const parsed = serverSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Biến môi trường không hợp lệ:')
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Thiếu hoặc sai biến môi trường — xem log phía trên')
}

export const env = parsed.data
```

```ts
// src/instrumentation.ts — chạy MỘT LẦN lúc server khởi động
export async function register() {
  await import('./lib/env')
}
```

Thiếu biến, app **không khởi động được**, và bạn biết ngay:

```
❌ Biến môi trường không hợp lệ:
{ API_URL: [ 'API_URL phải là URL hợp lệ' ] }

Error: Thiếu hoặc sai biến môi trường — xem log phía trên
    at eval (src/lib/env.ts:18:9)
```

Tốt hơn nhiều so với `TypeError: Failed to parse URL from undefined/posts` xuất hiện ngẫu nhiên vài giờ sau.

Dùng `env.API_URL` thay cho `process.env.API_URL` khắp nơi — TypeScript biết nó là `string`, không phải `string | undefined`.

---

## 6. Ép ranh giới bằng `dependency-cruiser`

Quy ước không được máy kiểm tra thì sớm muộn cũng bị phá.

```bash
npm i -D dependency-cruiser
npx depcruise --init
```

```js
// .dependency-cruiser.js
module.exports = {
  forbidden: [
    {
      name: 'khong-import-data-vao-ui',
      severity: 'error',
      comment: 'components/ui phải thuần hiển thị, không được chạm vào dữ liệu',
      from: { path: '^src/components/ui' },
      to: { path: '^src/data' },
    },
    {
      name: 'khong-import-cheo-feature',
      severity: 'error',
      comment: 'features không import trực tiếp lẫn nhau — đi qua data/ hoặc props',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/$1/',
      },
    },
    {
      name: 'app-khong-goi-http-truc-tiep',
      severity: 'error',
      comment: 'page/layout phải lấy dữ liệu qua data/, không tự fetch',
      from: { path: '^src/app/.+\\.(tsx|ts)$' },
      to: { path: '^src/lib/http' },
    },
    {
      name: 'khong-phu-thuoc-vong',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'khong-mo-coi',
      severity: 'warn',
      comment: 'file không ai import — có thể là code chết',
      from: { orphan: true, pathNot: '\\.(config|d)\\.(ts|js)$|^src/app/' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
}
```

```bash
$ npx depcruise src --config
```

```
  error khong-import-data-vao-ui: src/components/ui/Button.tsx → src/data/posts.ts
  error khong-import-cheo-feature: src/features/posts/components/PostCard.tsx →
        src/features/comments/components/CommentList.tsx

✖ 2 dependency violations (2 errors, 0 warnings). 47 modules, 118 dependencies cruised.
```

Đưa vào CI:

```json
{
  "scripts": {
    "lint:deps": "depcruise src --config",
    "lint:client": "! grep -rl 'use client' src/app/ || (echo '❌ Có use client trong app/' && exit 1)",
    "check": "npm run typecheck && npm run lint && npm run lint:deps && npm run lint:client"
  }
}
```

Xem đồ thị phụ thuộc:

```bash
$ npx depcruise src --include-only "^src" --output-type dot | dot -T svg > deps.svg
```

Mở file SVG — cụm nào rối như tơ vò là chỗ cần tách.

---

## 7. Sinh code khuôn mẫu bằng `plop`

Tạo một feature mới bằng tay thì mỗi người một kiểu. Sinh tự động thì ai cũng giống nhau.

```bash
npm i -D plop
```

```js
// plopfile.js
export default function (plop) {
  plop.setGenerator('feature', {
    description: 'Tạo một feature mới đầy đủ khung',
    prompts: [
      { type: 'input', name: 'name', message: 'Tên feature (số nhiều, kebab-case):' },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/data/{{kebabCase name}}.ts',
        templateFile: 'plop-templates/data.hbs',
      },
      {
        type: 'add',
        path: 'src/features/{{kebabCase name}}/schemas.ts',
        templateFile: 'plop-templates/schemas.hbs',
      },
      {
        type: 'add',
        path: 'src/app/{{kebabCase name}}/page.tsx',
        templateFile: 'plop-templates/page.hbs',
      },
      {
        type: 'add',
        path: 'src/app/{{kebabCase name}}/actions.ts',
        templateFile: 'plop-templates/actions.hbs',
      },
    ],
  })
}
```

```hbs
{{! plop-templates/data.hbs }}
import 'server-only'

import { cache } from 'react'
import { apiFetch } from '@/lib/http'
import { getCurrentUser } from './auth'

export type {{pascalCase name}}DTO = {
  id: number
  // TODO: chỉ khai báo trường client được phép thấy
}

export const get{{pascalCase name}} = cache(async (id: number): Promise<{{pascalCase name}}DTO | null> => {
  return apiFetch(`/{{kebabCase name}}/${id}`, {
    next: { revalidate: 60, tags: ['{{kebabCase name}}'] },
  })
})

export async function delete{{pascalCase name}}(id: number): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('UNAUTHORIZED')

  // TODO: kiểm tra quyền sở hữu trước khi xoá

  await apiFetch(`/{{kebabCase name}}/${id}`, { method: 'DELETE' })
}
```

```bash
$ npx plop feature
? Tên feature (số nhiều, kebab-case): tags
✔  ++ src/data/tags.ts
✔  ++ src/features/tags/schemas.ts
✔  ++ src/app/tags/page.tsx
✔  ++ src/app/tags/actions.ts
```

Giá trị lớn nhất không phải tiết kiệm thời gian gõ — mà là **`import 'server-only'` và chỗ kiểm tra quyền luôn có sẵn**, người mới không thể quên.

---

## 8. Monorepo

Khi bạn có Next.js + NestJS + app di động dùng chung kiểu dữ liệu:

```
blog/
├── apps/
│   ├── web/                  Next.js
│   ├── api/                  NestJS
│   └── admin/                Next.js khác
├── packages/
│   ├── types/                kiểu dùng chung
│   ├── schemas/              Zod dùng chung cho FE và BE
│   └── ui/                   design system
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

Lợi ích lớn nhất: **Zod schema viết một lần, dùng cả hai đầu.**

```ts
// packages/schemas/src/post.ts
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(5).max(200),
  content: z.string().min(20),
  categoryId: z.coerce.number().int().positive(),
})

export type CreatePostInput = z.infer<typeof createPostSchema>
```

NestJS dùng nó để validate, Next.js dùng nó cho form. Đổi ràng buộc ở một chỗ, cả hai đầu cập nhật, và TypeScript bắt lỗi ngay nếu lệch.

Với Next.js trong monorepo, khai báo package cần transpile:

```ts
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@blog/ui', '@blog/schemas'],
}
```

Thiếu dòng này:

```
Error: Failed to parse source for import analysis because the content
contains invalid JS syntax.
```

---

## 9. Quy ước đặt tên

Thống nhất để đọc code không phải đoán:

| Loại | Quy ước | Ví dụ |
|---|---|---|
| File component | `PascalCase.tsx` | `PostCard.tsx` |
| File khác | `kebab-case.ts` | `post-helpers.ts` |
| Thư mục | `kebab-case` | `features/blog-posts/` |
| Server Action | động từ + `Action` | `deletePostAction` |
| Hàm DAL | động từ thường | `deletePost`, `getPost` |
| Kiểu DTO | `<Tên>DTO` | `PostDTO` |
| Zod schema | `<tên>Schema` | `createPostSchema` |
| Cache tag | `<nghiệp vụ>` hoặc `<nghiệp vụ>-<id>` | `posts`, `post-hoc-nextjs` |
| Biến env server | `SCREAMING_SNAKE` | `API_URL` |
| Biến env client | `NEXT_PUBLIC_` + `SCREAMING_SNAKE` | `NEXT_PUBLIC_WS_URL` |

Hậu tố `Action` đáng chú ý: nó khiến chỗ gọi tự tố cáo bản chất. Thấy `deletePostAction` là biết ngay đây là endpoint POST công khai và phải có kiểm tra quyền.

---

## 10. Dọn dự án đang lộn xộn

Đừng viết lại từ đầu. Làm theo thứ tự này, mỗi bước là một PR riêng:

**Bước 1 — dựng hàng rào (nửa ngày).** Thêm `server-only` vào mọi file chạm dữ liệu. Thêm script `lint:client`. Chạy `depcruise` chỉ với luật cấm phụ thuộc vòng. Chưa sửa gì cả, chỉ để biết mình đang ở đâu.

**Bước 2 — dựng DAL cho một nghiệp vụ (1 ngày).** Chọn phần nhạy cảm nhất (thường là auth hoặc thanh toán). Gom mọi truy vấn vào `data/<tên>.ts`, thêm DTO, chuyển kiểm tra quyền vào đó.

**Bước 3 — kéo `'use client'` ra khỏi `app/` (1–2 ngày).** Với mỗi file, chuyển sang `features/*/components/`. Vừa làm vừa hỏi: cái này có thật cần là client không?

**Bước 4 — bật dần từng luật depcruise.** Thêm một luật, sửa hết vi phạm, commit. Rồi luật tiếp theo. Bật hết một lượt sẽ ra hàng trăm lỗi và bạn bỏ cuộc.

**Bước 5 — đưa `npm run check` vào CI.** Từ giờ không có hồi quy nữa.

Đo tiến độ bằng con số, không bằng cảm giác:

```bash
$ echo "use client trong app/: $(grep -rl 'use client' src/app/ | wc -l)"
$ echo "file data/ chưa có server-only: $(grep -rL "server-only" src/data/*.ts | wc -l)"
$ echo "vi phạm depcruise: $(npx depcruise src --config --output-type err-long 2>&1 | grep -c 'error')"
```

```
use client trong app/: 14
file data/ chưa có server-only: 3
vi phạm depcruise: 27
```

Ghi lại mỗi tuần. Ba con số về 0 là dự án đã sạch.

---

## Bài tập

1. Tái cấu trúc dự án Blog theo cây ở mục 2. Xác nhận `grep -rl "use client" src/app/` ra rỗng.
2. Dựng `src/data/posts.ts` với `import 'server-only'`, DTO, và kiểm tra quyền trong `deletePost`.
3. Rút gọn `app/posts/actions.ts` xuống còn gọi DAL + revalidate + redirect.
4. Import `@/data/posts` vào một Client Component để gặp lỗi `server-only`. Chép lại nguyên văn.
5. Viết `lib/env.ts` validate bằng Zod, gọi từ `instrumentation.ts`. Xoá `API_URL` khỏi `.env.local` và chép lại lỗi khởi động.
6. Cài `dependency-cruiser` với 5 luật ở mục 6. Chạy và chép lại các vi phạm hiện có.
7. Thêm script `check` gộp typecheck + lint + deps + lint:client. Chạy và sửa cho sạch.
8. Sinh đồ thị phụ thuộc bằng `depcruise --output-type dot | dot -T svg`. Chỉ ra cụm rối nhất.
9. Viết generator `plop` cho feature mới. Sinh thử `tags` và kiểm tra file `data/` có sẵn `server-only`.
10. Thêm `canEdit` vào DTO thay vì gửi `viewer` và `authorId` xuống client. Kiểm chứng bằng cách xem RSC payload — không được thấy `authorId`.
11. Đo 3 con số ở mục 10 cho dự án hiện tại của bạn, ghi lại.

Tiếp theo 👉 [08-bao-mat-nang-cao.md](<./08-bao-mat-nang-cao.md>)
