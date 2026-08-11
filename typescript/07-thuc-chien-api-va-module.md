# Bài 7 — Thực chiến: dữ liệu từ bên ngoài, module và `.d.ts`

Đây là bài quan trọng nhất về mặt thực tế. Nội dung xoay quanh một câu: **mọi thứ đi vào chương trình từ bên ngoài đều là `unknown` cho tới khi được kiểm chứng.**

---

## 1. Vấn đề: TypeScript không kiểm tra dữ liệu runtime

Đoạn code này xuất hiện trong hầu hết dự án:

```ts
interface User { id: number; name: string; email: string }

async function getUser(id: number): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
}

const u = await getUser(1);
console.log(u.name.toUpperCase());
```

`tsc --noEmit` chạy sạch. Nhưng `res.json()` trả về `Promise<any>` — TypeScript **không biết** và **không kiểm tra** API trả về gì. Backend đổi `name` thành `fullName`, hoặc trả `{ error: 'Not found' }` với status 200, kết quả:

```
TypeError: Cannot read properties of undefined (reading 'toUpperCase')
```

Ba nguồn dữ liệu có cùng vấn đề này:

| Nguồn | Kiểu thật TypeScript gán | Thực tế |
|---|---|---|
| `res.json()` | `Promise<any>` | server trả gì cũng được |
| `JSON.parse(s)` | `any` | chuỗi có thể là bất cứ gì |
| `process.env.PORT` | `string \| undefined` | có thể là `'abc'` |
| `req.body` (Express) | `any` | client gửi gì cũng được |
| `localStorage.getItem` | `string \| null` | dữ liệu cũ, sai format |

---

## 2. Bước 1 — bắt `any` phải thành `unknown`

Bật cờ trong `tsconfig.json`:

```jsonc
"useUnknownInCatchVariables": true,   // đã nằm trong strict
```

Và tự viết lớp bọc để `fetch` không trả `any`:

```ts
export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) throw new HttpError(res.status, await res.text());
  return res.json() as Promise<unknown>;
}
```

Giờ code cũ lỗi ngay:

```ts
const u = await fetchJson('/api/users/1');
console.log(u.name);
```
```
error TS18046: 'u' is of type 'unknown'.
```

Lỗi này là thứ bạn **muốn** thấy. Nó bắt bạn quyết định: kiểm chứng dữ liệu, hay chấp nhận rủi ro một cách có ý thức.

---

## 3. Bước 2 — validate ở biên bằng Zod

Tự viết type guard cho từng field (như [bài 03](./03-ham-va-narrowing.md)) đúng nhưng dài và dễ quên. Với dữ liệu thật, dùng thư viện.

```bash
npm i zod
```

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(['user', 'admin']),
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;
// { id: number; name: string; email: string; role: "user" | "admin"; createdAt: string }
```

Điểm mấu chốt: **schema là nguồn sự thật duy nhất**, type được suy ra từ nó bằng `z.infer`. Không có chuyện type và validation lệch nhau.

```ts
export async function getUser(id: number): Promise<User> {
  const raw = await fetchJson(`/api/users/${id}`);
  return UserSchema.parse(raw);       // ném lỗi nếu không khớp
}
```

Khi API trả sai, lỗi rõ ràng ngay tại biên thay vì `undefined` lan vào sâu:

```
ZodError: [
  {
    "expected": "string",
    "code": "invalid_type",
    "path": ["name"],
    "message": "Invalid input: expected string, received undefined"
  }
]
```

So sánh với trước: lỗi cũ là `Cannot read properties of undefined (reading 'toUpperCase')` ở tận component hiển thị, không biết dữ liệu hỏng từ đâu.

### `safeParse` — khi không muốn ném lỗi

```ts
const result = UserSchema.safeParse(raw);

if (!result.success) {
  logger.warn('API trả dữ liệu lạ', { issues: result.error.issues });
  return null;
}

return result.data;    // User
```

`result` chính là một discriminated union ([bài 03](./03-ham-va-narrowing.md)) — không kiểm tra `success` thì không chạm được vào `data`:

```ts
const result = UserSchema.safeParse(raw);
console.log(result.data.name);
```
```
error TS18048: 'result.data' is possibly 'undefined'.
```

### Validate `process.env` — làm một lần lúc khởi động

Đây là chỗ đáng áp dụng nhất, vì lỗi env thường chỉ lộ ra sau khi deploy.

```ts
// src/config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.url().optional(),
});

export const env = EnvSchema.parse(process.env);
export type Env = z.infer<typeof EnvSchema>;
```

Thiếu biến hoặc sai định dạng, app **không khởi động được**, và log nói rõ thiếu gì:

```bash
$ node dist/main.js
ZodError: [
  { "code": "invalid_type", "path": ["DATABASE_URL"], "message": "Invalid input: expected string, received undefined" },
  { "code": "too_small",    "path": ["JWT_SECRET"],   "message": "Too small: expected string to have >=32 characters" }
]
```

Đối chiếu với cách không validate: app chạy bình thường, đến khi có request đầu tiên mới chết vì `undefined` truyền vào chuỗi kết nối — và có khi phải 3 tiếng sau mới có ai phát hiện.

Sau đó dùng `env` thay cho `process.env` ở mọi nơi:

```ts
app.listen(env.PORT);          // number, đã có default
env.PORTT;                     // ❌ error TS2551: Property 'PORTT' does not exist on type ... Did you mean 'PORT'?
process.env.PORT;              // string | undefined — đừng dùng nữa
```

Chú ý `z.coerce.number()`: `process.env` **luôn là chuỗi**, nên không có `coerce` thì `PORT=3000` sẽ trượt validation vì nó là `'3000'` chứ không phải `3000`.

---

## 4. Module: `import` / `export` với TypeScript

### `import type` — và vì sao nó quan trọng

```ts
import type { User } from './user.types.js';   // chỉ là kiểu, bị xoá hoàn toàn
import { createUser } from './user.service.js'; // giá trị thật, còn lại sau khi build
```

Không phân biệt hai loại này thì bundler/transpiler có thể giữ lại một `import` chỉ chứa kiểu, kéo theo cả file vào bundle hoặc gây import vòng lúc runtime.

Bật cờ để TypeScript ép bạn ghi rõ:

```jsonc
"verbatimModuleSyntax": true
```
```ts
import { User } from './user.types.js';
```
```
error TS1484: 'User' is a type and must be imported using a type-only import
when 'verbatimModuleSyntax' is enabled.
```

Cách viết gộp khi vừa cần kiểu vừa cần giá trị:

```ts
import { createUser, type User } from './user.service.js';
```

Lưu ý khi bật `verbatimModuleSyntax`: nó cũng ép file phải đúng hệ module đã khai trong `package.json`. Project CommonJS mà viết `export const` sẽ báo:

```
error TS1287: A top-level 'export' modifier cannot be used on value declarations
in a CommonJS module when 'verbatimModuleSyntax' is enabled.
```
Sửa: thêm `"type": "module"` vào `package.json` (và nhớ ghi đuôi `.js` khi import — [bài 00](./00-cai-dat-va-tsconfig.md)).

### `export type` để tách kiểu công khai

```ts
// src/users/index.ts — điểm vào công khai của module
export { UsersService } from './users.service.js';
export type { User, CreateUserDto, UserResponse } from './user.types.js';
```

Người dùng module chỉ thấy đúng những gì bạn muốn cho thấy.

### Import vòng — TypeScript không cản, runtime mới chết

```ts
// a.ts
import { b } from './b.js';
export const a = () => b();

// b.ts
import { a } from './a.js';
export const b = () => a();
```

`tsc` không báo gì. Chạy thật:
```
ReferenceError: Cannot access 'a' before initialization
```

Nhưng nếu chỉ import **kiểu** thì vòng lặp vô hại, vì import bị xoá:

```ts
import type { A } from './a.js';    // ✅ an toàn kể cả khi vòng
```

Đây là lý do nữa để dùng `import type`.

---

## 5. Thư viện không có kiểu — `.d.ts`

Cài một gói JS thuần:

```ts
import slugify from 'some-old-slugify';
```
```
error TS7016: Could not find a declaration file for module 'some-old-slugify'.
'/Users/.../node_modules/some-old-slugify/index.js' implicitly has an 'any' type.
Try `npm i --save-dev @types/some-old-slugify` if it exists or add a new declaration (.d.ts) file
containing `declare module 'some-old-slugify';`
```

Ba cách xử lý, theo thứ tự ưu tiên:

**a) Có `@types` sẵn** — 90% trường hợp:

```bash
npm i -D @types/some-old-slugify
```

**b) Tự viết `.d.ts`** — khi không có `@types`. Chỉ khai đúng phần bạn dùng:

```ts
// src/types/some-old-slugify.d.ts
declare module 'some-old-slugify' {
  interface Options {
    lower?: boolean;
    strict?: boolean;
  }
  export default function slugify(input: string, options?: Options): string;
}
```

Dùng được ngay, có gợi ý và kiểm tra:

```ts
import slugify from 'some-old-slugify';

slugify('Xin chào', { lower: true });    // ✅
slugify('Xin chào', { lowercase: true }); // ❌ error TS2353: ... 'lowercase' does not exist in type 'Options'.
slugify(123);                             // ❌ error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

Đảm bảo file `.d.ts` nằm trong `include` của `tsconfig.json` (bản khuyến nghị dùng `"include": ["src/**/*"]` nên đặt trong `src/types/` là được).

**c) Tắt kiểm tra cho riêng gói đó** — giải pháp tạm:

```ts
// src/types/shims.d.ts
declare module 'some-old-slugify';
```

Gói đó thành `any`. Ghi comment lý do và ngày, đừng để quên.

### Khai báo biến/module toàn cục

```ts
// src/types/global.d.ts
declare global {
  var __APP_VERSION__: string;

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

export {};    // ← bắt buộc, để file này được coi là module
```

Thiếu `export {}`:
```
error TS2669: Augmentations for the global scope can only be directly nested in external modules
or ambient module declarations.
```

> Dù vậy: khai `ProcessEnv` như trên chỉ **nói dối cho đẹp** — nó không kiểm tra gì lúc chạy. Cách đúng vẫn là validate bằng Zod ở mục 3.

---

## 6. Ghép lại: một API client hoàn chỉnh

```ts
// src/api/client.ts
import { z } from 'zod';

export class HttpError extends Error {
  constructor(readonly status: number, readonly body: string) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export async function apiGet<S extends z.ZodType>(
  url: string,
  schema: S,
): Promise<z.infer<S>> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new HttpError(res.status, await res.text());

  const raw: unknown = await res.json();
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(`Dữ liệu từ ${url} không đúng dạng: ${JSON.stringify(parsed.error.issues)}`);
  }
  return parsed.data;
}
```

Chú ý chữ ký: `S` được suy từ **đối số `schema`**, và kiểu trả về `z.infer<S>` bám theo nó. Đây là generic trung thực — ngược với `fetchJson<T>(url)` ở [bài 04](./04-generic.md), nơi `T` do người gọi tự bịa.

Dùng:

```ts
// src/api/users.ts
import { z } from 'zod';
import { apiGet } from './client.js';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),
});

const UserListSchema = z.object({
  items: z.array(UserSchema),
  total: z.number(),
});

export type User = z.infer<typeof UserSchema>;

export const getUser = (id: number) => apiGet(`/api/users/${id}`, UserSchema);
export const listUsers = () => apiGet('/api/users', UserListSchema);
```

```ts
const u = await getUser(1);
u.name;      // string — đã được kiểm chứng thật
u.age;       // ❌ error TS2339: Property 'age' does not exist on type '{ id: number; name: string; email: string; }'.

const list = await listUsers();
list.items[0]?.email;   // string | undefined (do noUncheckedIndexedAccess)
```

Không có `as`, không có `any`, không có type nào viết tay hai lần.

---

## 7. Xử lý lỗi có kiểu

```ts
// src/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: number | string) {
    super(`Không tìm thấy ${resource}#${id}`, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends AppError {
  constructor(readonly fields: Record<string, string[]>) {
    super('Dữ liệu không hợp lệ', 'VALIDATION_FAILED', 422);
  }
}
```

Bắt lỗi theo nhánh:

```ts
try {
  await handler();
} catch (e) {
  if (e instanceof ValidationError) {
    return res.status(e.status).json({ code: e.code, errors: e.fields });
  }
  if (e instanceof AppError) {
    return res.status(e.status).json({ code: e.code, message: e.message });
  }
  logger.error('Lỗi không lường trước', e);
  return res.status(500).json({ code: 'INTERNAL_ERROR' });
}
```

⚠️ Bẫy khi `target` thấp: kế thừa `Error` với `target: ES5` làm `instanceof` **luôn trả `false`**. Bản TypeScript 7 đã bỏ `target: ES5` nên vấn đề này biến mất, nhưng nếu bạn gặp code cũ với `ES5`, dấu hiệu là: đúng class mà `e instanceof AppError` vẫn `false`. Cách sửa lúc đó là thêm `Object.setPrototypeOf(this, new.target.prototype);` vào constructor.

### `cause` — giữ lỗi gốc thay vì nuốt nó

```ts
try {
  await db.query(sql);
} catch (e) {
  throw new AppError('Không truy vấn được đơn hàng', 'DB_ERROR', 500, { cause: e });
}
```

Cần khai thêm tham số trong constructor và truyền lên `super(message, options)`. Khi in ra, Node hiện cả chuỗi nguyên nhân:

```
AppError: Không truy vấn được đơn hàng
    at ...
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:5432
      at ...
```

---

## Bài tập

1. Viết `EnvSchema` bằng Zod cho một app cần: `PORT` (số, mặc định 3000), `DATABASE_URL` (url), `JWT_SECRET` (tối thiểu 32 ký tự), `LOG_LEVEL` (`'debug' | 'info' | 'error'`, mặc định `'info'`). Chạy thử khi thiếu `DATABASE_URL` và dán lại output.
2. Đổi hàm sau sang dạng an toàn (không `any`, có validate), rồi chứng minh bằng cách cho API trả sai dữ liệu:
   ```ts
   async function getProduct(id: number): Promise<Product> {
     const res = await fetch(`/api/products/${id}`);
     return res.json();
   }
   ```
3. Viết `.d.ts` cho một module giả định `'legacy-mailer'` có: `export function send(to: string, subject: string, body: string): Promise<boolean>` và `export const version: string`. Import thử và gọi sai kiểu để xem lỗi.
4. Bật `verbatimModuleSyntax`, sửa hết lỗi TS1484 trong project `ts-lab` của bạn.
5. Viết `class RateLimitError extends AppError` có thêm `retryAfterSec: number`. Viết hàm xử lý lỗi trả về đúng status 429 và header `Retry-After`.
6. Tạo hai file import vòng nhau (`a.ts` ↔ `b.ts`), chạy bằng `tsx` để thấy `ReferenceError`. Sau đó đổi một chiều thành `import type` và xác nhận lỗi biến mất.

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['debug', 'info', 'error']).default('info'),
});

export const env = EnvSchema.parse(process.env);
```
Thiếu `DATABASE_URL`:
```
ZodError: [
  { "code": "invalid_type", "path": ["DATABASE_URL"],
    "message": "Invalid input: expected string, received undefined" }
]
```

```ts
// 2
const ProductSchema = z.object({
  id: z.number(),
  sku: z.string(),
  name: z.string(),
  price: z.number().nonnegative(),
});
export type Product = z.infer<typeof ProductSchema>;

export const getProduct = (id: number) => apiGet(`/api/products/${id}`, ProductSchema);
// API trả { id: 1, price: "10000" } →
// Error: Dữ liệu từ /api/products/1 không đúng dạng:
//   [{"expected":"number","code":"invalid_type","path":["price"], ...}]
```

```ts
// 3 — src/types/legacy-mailer.d.ts
declare module 'legacy-mailer' {
  export function send(to: string, subject: string, body: string): Promise<boolean>;
  export const version: string;
}

// dùng thử
import { send, version } from 'legacy-mailer';
await send('a@b.c', 'Chào', 'nội dung');   // ✅
await send('a@b.c', 'Chào');                // ❌ error TS2554: Expected 3 arguments, but got 2.
version = '2';                              // ❌ error TS2588: Cannot assign to 'version' because it is a constant.
```

```ts
// 5
export class RateLimitError extends AppError {
  constructor(readonly retryAfterSec: number) {
    super('Quá nhiều request', 'RATE_LIMITED', 429);
  }
}

if (e instanceof RateLimitError) {
  res.setHeader('Retry-After', String(e.retryAfterSec));
  return res.status(e.status).json({ code: e.code, message: e.message });
}
```

```
// 6
$ npx tsx src/a.ts
ReferenceError: Cannot access 'a' before initialization

Đổi b.ts thành `import type { A } from './a.js';` → import bị xoá khi biên dịch,
không còn phụ thuộc lúc runtime, chạy bình thường.
```

</details>

---

Tiếp theo 👉 [08-du-an-task-cli.md](./08-du-an-task-cli.md)
