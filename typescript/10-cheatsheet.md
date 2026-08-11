# Bài 10 — Cheatsheet

Tra cứu nhanh. Không giải thích — phần giải thích nằm ở các bài tương ứng.

---

## Lệnh

```bash
npx tsc                      # build theo tsconfig.json
npx tsc --noEmit             # chỉ kiểm tra kiểu, không sinh file
npx tsc --noEmit --watch     # kiểm tra liên tục (mở riêng 1 terminal)
npx tsc --init               # sinh tsconfig.json
npx tsc -v                   # xem phiên bản
npx tsc --showConfig         # xem config sau khi gộp extends
npx tsc --noEmit --listFiles # liệt kê mọi file đang được kiểm tra
npx tsc --explainFiles       # vì sao file này bị kéo vào

npx tsx src/index.ts         # chạy .ts (KHÔNG kiểm tra kiểu)
npx tsx watch src/index.ts   # chạy + tự reload
node src/index.ts            # Node 23.6+ (chỉ xoá kiểu, không kiểm tra)
```

Scripts nên có trong `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node dist/main.js"
  }
}
```

---

## `tsconfig.json` dùng ngay

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Thêm cho NestJS / TypeORM:
```jsonc
"experimentalDecorators": true,
"emitDecoratorMetadata": true
```

Cờ nghiêm hơn, bật khi sẵn sàng:
```jsonc
"exactOptionalPropertyTypes": true,       // phân biệt "không có field" và "field = undefined"
"noPropertyAccessFromIndexSignature": true, // ép dùng obj['key'] cho index signature
"verbatimModuleSyntax": true,              // ép import type
"noImplicitReturns": true
```

### `strict` gồm những gì

`strictNullChecks` · `noImplicitAny` · `strictFunctionTypes` · `strictBindCallApply` · `strictPropertyInitialization` · `noImplicitThis` · `useUnknownInCatchVariables` · `alwaysStrict`

---

## Kiểu cơ bản

```ts
string  number  boolean  bigint  symbol  null  undefined
any     unknown  never   void   object

number[]            Array<number>        // mảng
[string, number]                          // tuple
readonly string[]   ReadonlyArray<string> // mảng chỉ đọc

'a' | 'b'                    // union literal
string | null                // nullable
{ a: number } & { b: string } // intersection
```

| | Gán vào được | Lấy ra dùng được |
|---|---|---|
| `any` | mọi thứ | mọi thứ (không kiểm tra) |
| `unknown` | mọi thứ | không gì, phải thu hẹp |
| `never` | không gì | — |

---

## Object

```ts
interface User {
  id: number;
  name?: string;          // optional
  readonly email: string; // chỉ đọc
  [key: string]: unknown; // index signature
}

type Point = { x: number; y: number };

interface Dog extends Animal { breed: string }   // interface mở rộng
type Dog2 = Animal & { breed: string };          // type giao nhau
```

`interface` gộp được khai báo trùng tên (dùng để mở rộng kiểu thư viện); `type` làm được union/tuple/hàm.

---

## Hàm

```ts
function add(a: number, b: number): number { return a + b; }
const add2 = (a: number, b: number): number => a + b;

function greet(name: string, greeting = 'Chào', p?: string): string {}
function sum(...nums: number[]): number {}

type Handler = (req: Request, res: Response) => void;
type AsyncFn<T> = () => Promise<T>;

// overload
function parse(s: string): object;
function parse(s: string, raw: true): string;
function parse(s: string, raw?: boolean): object | string {}
```

---

## Narrowing

```ts
typeof x === 'string'          // primitive (chú ý: typeof null === 'object')
x instanceof Date              // class
'bark' in pet                  // property
x === 'GET'                    // literal
Array.isArray(x)               // mảng
x !== null && x !== undefined  // an toàn hơn `if (x)` khi 0 / '' là hợp lệ
```

```ts
// type guard
function isUser(x: unknown): x is User { /* ... */ }

// assertion function (phải là function declaration)
function assertIsUser(x: unknown): asserts x is User { /* ... */ }

// kiểm tra đủ nhánh
default: { const _x: never = value; throw new Error(`Chưa xử lý: ${value}`); }
```

**Mất narrowing khi:** property của object dùng trong callback · biến bị gán lại sau khi callback được tạo · biến module-scope bị gán lại.
**Cách tránh:** kéo ra `const` cục bộ rồi mới kiểm tra.

---

## Generic

```ts
function first<T>(arr: T[]): T | undefined {}
function get<T, K extends keyof T>(obj: T, key: K): T[K] {}
function longest<T extends { length: number }>(a: T, b: T): T {}

interface Repo<T, TCreate = Omit<T, 'id'>> {}
class Cache<K, V> {}

function f<T>(items: T[], fallback: NoInfer<T>): T {}   // chặn suy kiểu từ fallback
```

Chữ ký generic tốt: **mỗi tham số kiểu xuất hiện ở ít nhất hai chỗ**. `T` chỉ ở kiểu trả về = `as` trá hình.

---

## Toán tử kiểu

```ts
keyof User                       // "id" | "name" | "email"
typeof defaultConfig             // kiểu của một giá trị
User['email']                    // string
Order['items'][number]           // kiểu phần tử mảng
(typeof ROLES)[number]           // union từ mảng `as const`
(typeof Status)[keyof typeof Status]  // union giá trị của object `as const`
```

```ts
const x = { a: 1 } as const;                    // literal + readonly, KHÔNG kiểm tra
const y = { a: 1 } satisfies { a: number };     // kiểm tra, giữ kiểu suy ra
const z = { a: 1 } as const satisfies { a: number };  // cả hai
const w = { a: 1 } as { a: number };            // ép, không kiểm tra — hạn chế dùng
```

---

## Utility type

```ts
Partial<T>        // mọi field optional
Required<T>       // mọi field bắt buộc
Readonly<T>       // mọi field readonly
Pick<T, K>        // giữ key K
Omit<T, K>        // bỏ key K
Record<K, V>      // object key K, giá trị V
Exclude<T, U>     // bỏ nhánh khỏi union
Extract<T, U>     // giữ nhánh khỏi union
NonNullable<T>    // bỏ null | undefined
ReturnType<F>     // kiểu trả về của hàm
Parameters<F>     // tuple tham số
ConstructorParameters<C>
InstanceType<C>
Awaited<T>        // bóc Promise
NoInfer<T>        // chặn suy kiểu
Uppercase<S> Lowercase<S> Capitalize<S> Uncapitalize<S>
```

Mẫu DTO chuẩn:
```ts
type CreateDto = Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateDto = Partial<Omit<CreateDto, 'email'>>;
type Response  = Omit<Entity, 'passwordHash'>;
```

⚠️ `Partial<T>` trần cho phép sửa cả `id` → luôn `Omit` trước rồi mới `Partial`.

---

## Mapped type

```ts
type MyPartial<T>  = { [K in keyof T]?: T[K] };
type Mutable<T>    = { -readonly [K in keyof T]: T[K] };
type Concrete<T>   = { [K in keyof T]-?: T[K] };
type Nullable<T>   = { [K in keyof T]: T[K] | null };

type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };

// đổi tên key
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };

// lọc key
type OmitByValue<T, V> = { [K in keyof T as T[K] extends V ? never : K]: T[K] };

// object → union giá trị
type FunctionKeys<T> = { [K in keyof T]: T[K] extends Function ? K : never }[keyof T];
```

---

## Conditional type

```ts
type IsString<T> = T extends string ? true : false;
type ElementOf<T> = T extends (infer E)[] ? E : never;
type MyAwaited<T> = T extends Promise<infer U> ? U : T;
type MyReturnType<F> = F extends (...a: any[]) => infer R ? R : never;
```

Conditional type **phân phối** trên union:
```ts
type ToArray<T> = T extends any ? T[] : never;
ToArray<string | number>   // string[] | number[]

type NoDistribute<T> = [T] extends [any] ? T[] : never;
NoDistribute<string | number>   // (string | number)[]
```

---

## Template literal type

```ts
type Path = `/${'vi' | 'en'}/${'home' | 'about'}`;
type EventName = `${'user' | 'order'}.${'created' | 'deleted'}`;
type Handler = `on${Capitalize<'click' | 'focus'>}`;   // "onClick" | "onFocus"
```

---

## Class

```ts
class UsersService {
  static readonly VERSION = '1.0';
  #realPrivate = 1;                      // riêng tư THẬT lúc runtime
  private soft = 2;                      // chỉ compiler biết, JSON.stringify vẫn lộ
  protected forChildren = 3;
  readonly createdAt = new Date();
  definite!: string;                     // "framework sẽ gán" — dùng thận trọng

  constructor(
    private readonly repo: UserRepository,   // parameter property: tự tạo field
    logger: Logger,                           // KHÔNG có modifier → không thành field
  ) {}

  get count() { return 0; }
  set count(v: number) {}

  handleSafe = () => { this.repo; };      // giữ `this` khi truyền làm callback
}

abstract class Base {
  abstract find(id: number): Promise<unknown>;
}
class Impl extends Base implements SomeInterface {
  override async find(id: number) { return null; }
}
```

---

## Decorator (kiểu cũ, dùng cho NestJS)

```ts
// method decorator
function LogTime(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const t = Date.now();
    const r = await original.apply(this, args);
    console.log(`${key} mất ${Date.now() - t}ms`);
    return r;
  };
}

// decorator factory (có tham số)
function Retry(times: number) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) { /* ... */ };
}
```

`emitDecoratorMetadata` sinh ra `__metadata("design:paramtypes", [UserRepository])` — đây là thứ NestJS đọc để inject. Không có decorator nào trên class thì không có metadata.

---

## Module

```ts
import type { User } from './types.js';           // chỉ kiểu, bị xoá khi build
import { create, type User } from './svc.js';     // gộp
export type { User, CreateDto };
export { UsersService } from './users.service.js';
```

ESM (`"type": "module"`): import tương đối **phải ghi đuôi `.js`** dù file nguồn là `.ts`.

Import JSON trong ESM: `import pkg from './p.json' with { type: 'json' };`

Import vòng: `tsc` không báo, runtime ném `ReferenceError`. Dùng `import type` để phá vòng.

---

## `.d.ts`

```ts
// src/types/legacy-lib.d.ts
declare module 'legacy-lib' {
  export function send(to: string, body: string): Promise<boolean>;
  export const version: string;
  export default function main(): void;
}

// tắt kiểm tra hẳn (giải pháp tạm)
declare module 'legacy-lib';
```

```ts
// src/types/global.d.ts — mở rộng global
declare global {
  var __APP_VERSION__: string;
}
export {};   // ← bắt buộc

// mở rộng kiểu của thư viện (khai báo gộp interface)
import 'express';
declare module 'express' {
  interface Request { user?: { id: number } }
}
```

---

## Validate biên bằng Zod

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number().int().positive(),
  email: z.email(),
  role: z.enum(['user', 'admin']),
  createdAt: z.iso.datetime(),
  phone: z.string().optional(),
  deletedAt: z.iso.datetime().nullable(),
});

type User = z.infer<typeof UserSchema>;   // ← type suy ra từ schema

UserSchema.parse(raw);          // ném ZodError nếu sai
const r = UserSchema.safeParse(raw);
if (!r.success) console.log(r.error.issues);
else console.log(r.data);       // User
```

`process.env` luôn là chuỗi → dùng `z.coerce.number()` cho port, `.default(...)` cho giá trị mặc định.

---

## Mẫu code hay dùng

```ts
// Result thay cho throw
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

// Trạng thái tải
type LoadState<T> =
  | { status: 'idle' } | { status: 'loading' }
  | { status: 'success'; data: T } | { status: 'error'; message: string };

// enum thay bằng union
export const Role = { User: 'user', Admin: 'admin' } as const;
export type Role = (typeof Role)[keyof typeof Role];

// chuyển unknown thành Error
const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

// lọc null có giữ kiểu
function notNull<T>(x: T | null | undefined): x is T { return x != null; }
items.filter(notNull);

// Map thay cho reduce gom theo id
const byId = new Map(users.map(u => [u.id, u]));
```

---

## Liên kết

| Chủ đề | File |
|---|---|
| Cài đặt, `tsconfig` | [00](./00-cai-dat-va-tsconfig.md) |
| Kiểu cơ bản, `any`/`unknown`/`never` | [01](./01-kieu-co-ban.md) |
| Object, `interface` vs `type` | [02](./02-object-interface-type.md) |
| Hàm, narrowing, discriminated union | [03](./03-ham-va-narrowing.md) |
| Generic, `keyof`, `typeof` | [04](./04-generic.md) |
| Utility, mapped, conditional, `satisfies` | [05](./05-utility-va-type-nang-cao.md) |
| Class, decorator, DI metadata | [06](./06-class-va-decorator.md) |
| API, Zod, `.d.ts`, module | [07](./07-thuc-chien-api-va-module.md) |
| Dự án hoàn chỉnh | [08](./08-du-an-task-cli.md) |
| Tra mã lỗi | [09](./09-loi-thuong-gap.md) |

Bước tiếp theo 👉 [NestJS](../nestjs/README.md) — nơi mọi thứ trong bộ này được dùng thật.
