# Bài 9 (NC) — Testing

## 1. Giới hạn cần biết trước

**Vitest chưa test được `async` Server Component.** Đây là giới hạn của hệ sinh thái React, không phải cấu hình sai.

```tsx
// app/posts/page.tsx
export default async function PostsPage() {
  const posts = await getPosts()
  return <ul>{posts.map(...)}</ul>
}
```

```tsx
import { render } from '@testing-library/react'
import PostsPage from '@/app/posts/page'

test('hiện danh sách bài', () => {
  render(<PostsPage />)          // ❌
})
```

```
Error: Objects are not valid as a React child (found: [object Promise]).
If you meant to render a collection of children, use an array instead.
```

Hệ quả với kiến trúc Next.js: phần lớn code của bạn nằm trong Server Component. Nên chiến lược test phải khác app React thuần.

```
        ╱╲          E2E (Playwright)          ← test được TẤT CẢ, kể cả async RSC
       ╱  ╲         ~15 kịch bản quan trọng
      ╱────╲
     ╱      ╲       Integration               ← DAL, Server Action (gọi trực tiếp)
    ╱        ╲      ~40 test
   ╱──────────╲
  ╱            ╲    Unit (Vitest)             ← hàm thuần, Zod schema, Client Component
 ╱______________╲   ~100 test
```

Điểm khác biệt so với tháp test truyền thống: **tầng E2E dày hơn bình thường**, vì đó là cách duy nhất phủ được Server Component.

---

## 2. Cài Vitest

```bash
npm i -D vitest @vitejs/plugin-react jsdom \
         @testing-library/react @testing-library/dom \
         @testing-library/jest-dom @testing-library/user-event \
         vite-tsconfig-paths
```

```ts
// vitest.config.mts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['**/*.config.*', '**/.next/**', '**/node_modules/**'],
    },
  },
})
```

`vite-tsconfig-paths` là bắt buộc — thiếu nó thì alias `@/` không phân giải được:

```
Error: Failed to resolve import "@/lib/api" from "src/features/posts/PostCard.test.tsx"
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => cleanup())

// next/navigation không chạy ngoài Next.js runtime — phải mock
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/posts',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}))
```

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 3. Test hàm thuần và Zod schema

Rẻ nhất, chạy nhanh nhất, và bắt được nhiều lỗi thật.

```ts
// src/features/posts/schemas.test.ts
import { describe, expect, it } from 'vitest'
import { createPostSchema } from './schemas'

describe('createPostSchema', () => {
  it('chấp nhận dữ liệu hợp lệ', () => {
    const result = createPostSchema.safeParse({
      title: 'Học Next.js trong 7 ngày',
      content: 'Nội dung đủ dài để vượt qua ràng buộc 20 ký tự.',
      categoryId: '3',                 // FormData luôn trả string
      status: 'published',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.categoryId).toBe(3)     // coerce đã ép thành number
      expect(typeof result.data.categoryId).toBe('number')
    }
  })

  it('từ chối tiêu đề quá ngắn', () => {
    const result = createPostSchema.safeParse({
      title: 'abc',
      content: 'Nội dung đủ dài để vượt qua ràng buộc 20 ký tự.',
      categoryId: '3',
      status: 'draft',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toEqual([
        'Tiêu đề tối thiểu 5 ký tự',
      ])
    }
  })

  it('từ chối categoryId rỗng', () => {
    const result = createPostSchema.safeParse({
      title: 'Tiêu đề hợp lệ',
      content: 'Nội dung đủ dài để vượt qua ràng buộc 20 ký tự.',
      categoryId: '',                  // người dùng không chọn danh mục
      status: 'draft',
    })

    expect(result.success).toBe(false)
  })
})
```

```bash
$ npm run test:run -- schemas
 ✓ src/features/posts/schemas.test.ts (3)
   ✓ createPostSchema (3)
     ✓ chấp nhận dữ liệu hợp lệ
     ✓ từ chối tiêu đề quá ngắn
     ✓ từ chối categoryId rỗng

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  312ms
```

Test case thứ ba đáng chú ý: `z.coerce.number().parse('')` cho ra `0`, không phải lỗi — nên nếu schema của bạn chỉ có `.int()` mà thiếu `.positive()`, ô danh mục để trống sẽ lọt qua. Đây là loại bug mà test Zod bắt được còn code review thì không.

---

## 4. Test Client Component

```tsx
// src/features/posts/components/SearchBox.test.tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchBox from './SearchBox'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams('page=3'),
}))

const categories = [
  { id: 1, name: 'NestJS', slug: 'nestjs' },
  { id: 2, name: 'Next.js', slug: 'nextjs' },
]

describe('SearchBox', () => {
  it('đẩy từ khoá vào URL và reset về trang 1', async () => {
    const user = userEvent.setup()
    render(<SearchBox defaultValue="" categories={categories} />)

    await user.type(screen.getByPlaceholderText('Tìm bài viết...'), 'docker')
    await user.click(screen.getByRole('button', { name: 'Tìm' }))

    expect(mockPush).toHaveBeenCalledWith('/posts?search=docker')
    //                                    ↑ page=3 đã bị xoá
  })

  it('xoá tham số search khi ô nhập trống', async () => {
    const user = userEvent.setup()
    render(<SearchBox defaultValue="docker" categories={categories} />)

    await user.clear(screen.getByPlaceholderText('Tìm bài viết...'))
    await user.click(screen.getByRole('button', { name: 'Tìm' }))

    expect(mockPush).toHaveBeenCalledWith('/posts?')
  })
})
```

Ba nguyên tắc viết test giao diện:

1. **Tìm phần tử theo cách người dùng thấy** — `getByRole`, `getByLabelText`, `getByPlaceholderText`. Tránh `data-testid` trừ khi không còn cách nào.
2. **Dùng `userEvent`, không phải `fireEvent`.** `userEvent` mô phỏng đủ chuỗi sự kiện thật (focus → keydown → input → keyup).
3. **Test hành vi, không test chi tiết cài đặt.** Kiểm tra "URL được đẩy đúng", không phải "hàm `setState` được gọi".

---

## 5. Test DAL và Server Action

Server Action là hàm async thường — gọi trực tiếp được, miễn mock đúng thứ nó phụ thuộc.

```ts
// src/data/posts.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))          // ← bắt buộc, nếu không Vitest lỗi

const mockCookies = vi.fn()
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

const mockApiFetch = vi.fn()
vi.mock('@/lib/http', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

import { deletePost } from './posts'

const adminUser = { id: 1, name: 'Admin', role: 'admin' as const, email: 'a@b.c' }
const normalUser = { id: 2, name: 'User', role: 'user' as const, email: 'u@b.c' }
const postByUser3 = { id: 10, title: 'Bài', author: { id: 3, name: 'Khác' } }

describe('deletePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookies.mockResolvedValue({ get: () => ({ value: 'token-gia' }) })
  })

  it('từ chối khi chưa đăng nhập', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined })

    await expect(deletePost(10)).rejects.toThrow('UNAUTHORIZED')
    expect(mockApiFetch).not.toHaveBeenCalledWith('/posts/10', { method: 'DELETE' })
  })

  it('từ chối khi không phải tác giả', async () => {
    mockApiFetch
      .mockResolvedValueOnce(normalUser)      // /auth/me
      .mockResolvedValueOnce(postByUser3)     // /posts/10

    await expect(deletePost(10)).rejects.toThrow('FORBIDDEN')
    expect(mockApiFetch).not.toHaveBeenCalledWith('/posts/10', { method: 'DELETE' })
  })

  it('cho phép admin xoá bài người khác', async () => {
    mockApiFetch
      .mockResolvedValueOnce(adminUser)
      .mockResolvedValueOnce(postByUser3)
      .mockResolvedValueOnce(undefined)

    await expect(deletePost(10)).resolves.toBeUndefined()
    expect(mockApiFetch).toHaveBeenCalledWith('/posts/10', { method: 'DELETE' })
  })

  it('cho phép tác giả xoá bài của chính mình', async () => {
    mockApiFetch
      .mockResolvedValueOnce(normalUser)
      .mockResolvedValueOnce({ ...postByUser3, author: { id: 2, name: 'User' } })
      .mockResolvedValueOnce(undefined)

    await expect(deletePost(10)).resolves.toBeUndefined()
  })
})
```

**Đây là nhóm test có giá trị cao nhất trong toàn bộ dự án.** Bốn test này bảo vệ đúng lỗ hổng IDOR ở [bài 08](<./08-bao-mat-nang-cao.md#bước--là-bước-hay-bị-bỏ-nhất>). Chúng chạy trong vài mili giây và sẽ đỏ ngay nếu ai đó lỡ xoá dòng kiểm tra quyền.

Dòng `expect(mockApiFetch).not.toHaveBeenCalledWith(...)` quan trọng không kém: nó xác nhận **lệnh xoá không hề được gửi đi**, chứ không chỉ là hàm ném lỗi.

> ⚠️ `vi.mock('server-only', () => ({}))` là dòng ai cũng vấp lần đầu:
> ```
> Error: This module cannot be imported from a Client Component module.
> It should only be used from a Server Component.
> ```
> Đưa nó vào `vitest.setup.ts` để khỏi lặp lại ở mọi file test.

---

## 6. Playwright cho E2E

```bash
npm init playwright@latest
```

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',           // ghi lại toàn bộ khi test đỏ
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm start',   // ← build production, KHÔNG phải dev
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

Dùng `npm run build && npm start` chứ không phải `npm run dev`: dev không có cache, không có prerender, và chậm hơn nhiều — test trên dev là test một ứng dụng khác với cái bạn deploy.

```ts
// e2e/posts.spec.ts
import { expect, test } from '@playwright/test'

test.describe('Trang bài viết', () => {
  test('hiện danh sách và mở được chi tiết', async ({ page }) => {
    await page.goto('/posts')

    await expect(page.getByRole('heading', { name: 'Bài viết' })).toBeVisible()

    const firstLink = page.getByRole('link').filter({ hasText: /.+/ }).first()
    const title = await firstLink.textContent()
    await firstLink.click()

    await expect(page).toHaveURL(/\/posts\/.+/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!)
  })

  test('tìm kiếm phản ánh vào URL và giữ được khi F5', async ({ page }) => {
    await page.goto('/posts')

    await page.getByPlaceholder('Tìm bài viết...').fill('nextjs')
    await page.getByRole('button', { name: 'Tìm' }).click()

    await expect(page).toHaveURL(/search=nextjs/)

    await page.reload()
    await expect(page.getByPlaceholder('Tìm bài viết...')).toHaveValue('nextjs')
  })

  test('nội dung có trong HTML — không cần JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto('/posts')
    await expect(page.getByRole('heading', { name: 'Bài viết' })).toBeVisible()

    await context.close()
  })
})
```

Test thứ ba đáng giá đặc biệt với Next.js: **tắt JavaScript rồi kiểm tra nội dung vẫn hiện.** Nếu đỏ, nghĩa là ai đó đã biến Server Component thành Client Component và bạn vừa mất SEO mà không hay.

### Tái dùng phiên đăng nhập

Đăng nhập lại ở mỗi test là lãng phí. Lưu state một lần:

```ts
// e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('đăng nhập', async ({ page }) => {
  await page.goto('/login')
  await page.getByPlaceholder('Email').fill('admin@blog.test')
  await page.getByPlaceholder('Mật khẩu').fill('12345678')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  await expect(page).toHaveURL('/dashboard')
  await page.context().storageState({ path: authFile })
})
```

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
    dependencies: ['setup'],
  },
],
```

Nhớ thêm `e2e/.auth/` vào `.gitignore` — file đó chứa cookie phiên thật.

### Test luồng CRUD trọn vẹn

```ts
// e2e/crud.spec.ts
import { expect, test } from '@playwright/test'

test('tạo, sửa, xoá bài viết', async ({ page }) => {
  const title = `Bài test ${Date.now()}`      // tránh trùng giữa các lần chạy

  // Tạo
  await page.goto('/posts/new')
  await page.getByPlaceholder('Tiêu đề').fill(title)
  await page.getByRole('textbox', { name: /nội dung/i })
    .fill('Nội dung đủ dài để vượt qua ràng buộc validate 20 ký tự.')
  await page.getByRole('combobox').first().selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Đăng bài' }).click()

  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  // Danh sách phải cập nhật ngay — kiểm tra revalidate có chạy
  await page.goto('/posts')
  await expect(page.getByText(title)).toBeVisible()

  // Sửa
  await page.getByText(title).click()
  await page.getByRole('link', { name: 'Sửa' }).click()
  await page.getByPlaceholder('Tiêu đề').fill(`${title} (đã sửa)`)
  await page.getByRole('button', { name: 'Cập nhật' }).click()

  await expect(page.getByRole('heading', { name: `${title} (đã sửa)` })).toBeVisible()

  // Xoá
  page.on('dialog', (d) => d.accept())        // xử lý confirm()
  await page.getByRole('button', { name: 'Xoá' }).click()

  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByText(`${title} (đã sửa)`)).not.toBeVisible()
})
```

Bước "danh sách phải cập nhật ngay" test đúng thứ hay hỏng nhất: quên `revalidateTag` sau khi tạo bài ([lỗi 13](<../10-loi-thuong-gap.md#lỗi-13--đăng-bài-xong-nhưng-danh-sách-không-đổi>)).

### Test phân quyền

```ts
// e2e/authz.spec.ts
import { expect, test } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })   // chưa đăng nhập

test('khách bị chặn khỏi dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
})

test('cookie giả vẫn bị chặn', async ({ page, context }) => {
  await context.addCookies([
    { name: 'accessToken', value: 'token-hoan-toan-gia', url: 'http://localhost:3001' },
  ])

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)      // lớp 2 bắt được
})
```

Test thứ hai chính là kịch bản ở [bài 06 cơ bản](<../06-auth-jwt.md#6-bảo-vệ-trang-hai-lớp>), giờ thành test tự động chạy mỗi lần CI.

---

## 7. Nên test gì

Đừng đuổi theo con số coverage. Test theo mức độ **thiệt hại khi hỏng**:

| Ưu tiên | Test gì | Bằng gì |
|---|---|---|
| 🔴 Cao nhất | Phân quyền trong DAL/Action | Vitest |
| 🔴 | Luồng đăng nhập / đăng xuất | Playwright |
| 🔴 | Không rò rỉ dữ liệu giữa các user | Playwright |
| 🟡 | CRUD chính | Playwright |
| 🟡 | Zod schema | Vitest |
| 🟡 | Cache có revalidate sau mutation | Playwright |
| 🟢 | Client Component có logic | Vitest |
| 🟢 | Hàm format, tiện ích | Vitest |
| ⚪ Bỏ qua | Component chỉ hiển thị tĩnh | — |
| ⚪ | Layout, style | — |

Ba dòng đỏ là những thứ hỏng thì mất dữ liệu hoặc mất uy tín. Test chúng trước, phần còn lại tính sau.

---

## 8. CI

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint:deps
      - run: npm run test:run

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: blog_test
        options: >-
          --health-cmd pg_isready --health-interval 10s --health-retries 5
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Khởi động Blog API
        run: |
          cd ../blog-api && npm ci && npm run migration:run && npm run seed
          npm run start:prod &
          npx wait-on http://localhost:3000/api/health
      - run: npm run test:e2e
        env:
          API_URL: http://localhost:3000/api
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

Bước `upload-artifact` khi thất bại rất đáng giá: bạn tải về xem được trace, ảnh chụp màn hình và video của đúng lần chạy đỏ đó.

---

## 9. Sai lầm thường gặp

| Sai lầm | Hậu quả |
|---|---|
| Chạy E2E trên `npm run dev` | Test một app khác với cái deploy; chậm và hay flaky |
| Mock quá sâu (mock cả `fetch` toàn cục) | Test xanh nhưng thực tế hỏng |
| Dùng `page.waitForTimeout(2000)` | Test flaky. Dùng `expect(...).toBeVisible()` — nó tự chờ |
| Test dùng chung dữ liệu, không reset | Chạy song song thì đè nhau |
| Tên bài viết cố định trong test | Lần chạy thứ hai đỏ vì trùng |
| Đuổi theo coverage 100% | Tốn thời gian vào component hiển thị, bỏ quên phân quyền |
| Không test đường đi lỗi | Chỉ biết "happy path" hoạt động |

Về `waitForTimeout`, minh hoạ cụ thể:

```ts
// ❌ Flaky — máy CI chậm hơn máy bạn
await page.click('button')
await page.waitForTimeout(2000)
expect(await page.textContent('h1')).toBe('Xong')

// ✅ Tự chờ tới khi đạt, tối đa theo timeout cấu hình
await page.click('button')
await expect(page.getByRole('heading', { name: 'Xong' })).toBeVisible()
```

---

## Bài tập

1. Cài Vitest với `vite-tsconfig-paths`. Cố tình bỏ plugin đó để gặp lỗi `Failed to resolve import "@/..."`.
2. Viết `vitest.setup.ts` có mock `next/navigation` và `server-only`.
3. Test `createPostSchema` với 5 trường hợp, trong đó có `categoryId: ''`. Kiểm tra schema của bạn có bắt được không.
4. Cố render một `async` Server Component bằng Vitest để gặp lỗi `Objects are not valid as a React child`.
5. Viết 4 test cho `deletePost` như mục 5. Xoá dòng kiểm tra quyền sở hữu và xác nhận có test đỏ.
6. Test `SearchBox` bằng `userEvent`, kiểm tra `page` bị xoá khỏi URL khi tìm mới.
7. Cài Playwright với `webServer` dùng `build && start`. Viết test mở danh sách → chi tiết.
8. Viết test tắt JavaScript (`javaScriptEnabled: false`) và xác nhận nội dung vẫn hiện.
9. Viết `auth.setup.ts` lưu `storageState`. Thêm `e2e/.auth/` vào `.gitignore`.
10. Viết test CRUD trọn vẹn có bước kiểm tra danh sách cập nhật ngay. Xoá `revalidateTag` khỏi action và xác nhận test đỏ.
11. Viết test cookie giả bị chặn khỏi `/dashboard`.
12. Thay một `waitForTimeout` bằng `expect(...).toBeVisible()` và chạy 10 lần liên tiếp để so độ ổn định.

Tiếp theo 👉 [10-observability-benchmark.md](<./10-observability-benchmark.md>)
