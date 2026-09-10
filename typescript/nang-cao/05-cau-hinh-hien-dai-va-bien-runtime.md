# Bài A5 — Cấu hình hiện đại và biên runtime

Bộ tài liệu chính (bài 00) dựng dự án bằng `tsx`. Từ Node 22.18 trở đi cách đó **không còn cần thiết**: Node chạy thẳng file `.ts`. Nhưng đổi lại có một loạt ràng buộc mới, và một nhóm cờ `tsconfig` sinh ra chính vì chúng.

Bài này dựng lại cấu hình theo cách 2026, rồi nối sang phần quan trọng nhất: **kiểm soát biên runtime**.

Môi trường đo: Node **v22.23.2**, tsc **7.0.2**, zod **4.5.4**.

---

## 1. Node chạy thẳng `.ts` — và chỗ nó từ chối

```ts
// src/f1.ts
type User = { id: number; name: string };
const u: User = { id: 1, name: 'Son' };
console.log(`ok ${u.name}`);
enum E { A }
console.log(E.A);
```
```bash
$ node src/f1.ts
```
```
enum E { A }
^^^^^^^^^^^^

SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
    at parseTypeScript (node:internal/modules/typescript:63:40)
```

Node dùng **strip-only mode**: nó chỉ **xoá** phần kiểu, thay bằng khoảng trắng, không biên dịch gì cả. Bỏ hai dòng `enum` đi thì chạy ngon.

Cơ chế này giải thích toàn bộ danh sách bị cấm — mọi cú pháp TypeScript **sinh ra code JavaScript**:

| Cú pháp | Vì sao bị cấm |
|---|---|
| `enum E { A }` | phải sinh object `E` lúc chạy |
| `constructor(private x: string)` | phải sinh `this.x = x` |
| `namespace NS { export const x = 1 }` | phải sinh IIFE |
| `import x = require('y')` | phải sinh lời gọi require |

Được phép: `declare enum`, `declare namespace` (không sinh code), và mọi thứ thuần kiểu.

**Điều này rất quan trọng nếu bạn học tiếp NestJS** — NestJS dùng `constructor(private readonly svc: Service)` ở khắp nơi, nên NestJS **không** chạy được bằng `node file.ts` thuần; nó cần `tsc` hoặc `swc`.

---

## 2. `erasableSyntaxOnly` — bắt lỗi trước khi Node bắt

Đợi Node ném lỗi lúc chạy là muộn. Cờ này bắt ngay lúc type check:

```ts
export enum Role { Admin = 'admin' }
export class Svc { constructor(private readonly name: string) {} }
namespace NS { export const x = 1; }
declare namespace D { const y: number; }
export const ok = 1;
```
```bash
$ npx tsc --noEmit                       # không bật cờ
$                                        ← im lặng
$ npx tsc --noEmit --erasableSyntaxOnly
```
```
src/g1.ts(1,13): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
src/g1.ts(2,32): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
src/g1.ts(3,11): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
```

Ba lỗi đúng vào `enum`, `private` trong constructor, và `namespace`. Dòng 4 (`declare namespace`) không bị bắt — đúng, vì nó không sinh code.

Thay thế cho từng thứ:

```ts
// enum → union + as const  (đã dạy ở bài 01)
export const Role = { Admin: 'admin', User: 'user' } as const;
export type Role = (typeof Role)[keyof typeof Role];

// parameter property → gán tay
export class Svc {
  private readonly name: string;
  constructor(name: string) { this.name = name; }
}

// namespace → module thật (một file, export bình thường)
```

---

## 3. `verbatimModuleSyntax` — import kiểu và import giá trị

Vấn đề: `import { User } from './types.js'` — nếu `User` chỉ là type, TypeScript xoá dòng import đi. Nhưng nếu file đó có side effect thì việc xoá làm đổi hành vi chương trình. Với Node strip-only, việc "biết xoá gì" lại càng quan trọng vì Node **không phân tích kiểu**, nó chỉ xoá theo cú pháp.

`verbatimModuleSyntax` bắt buộc bạn nói rõ:

```ts
// package.json có "type": "module"
import { Svc, Cfg } from './h1.js';    // Cfg là type
```
```bash
$ npx tsc --noEmit --verbatimModuleSyntax
```
```
src/h2.ts(1,15): error TS1484: 'Cfg' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```
Sửa:
```ts
import { Svc, type Cfg } from './h1.js';   // ✅
```

Nếu dự án còn là CommonJS (không có `"type": "module"`), cờ này báo khác:
```
src/g1.ts(1,1): error TS1287: A top-level 'export' modifier cannot be used on value declarations in a CommonJS module when 'verbatimModuleSyntax' is enabled.
src/g2.ts(1,10): error TS1295: ECMAScript imports and exports cannot be written in a CommonJS file under 'verbatimModuleSyntax'. Adjust the 'type' field in the nearest 'package.json' ...
```
**TS1287 và TS1295 nghĩa là: hãy quyết định đi — CommonJS hay ESM.** Cách sửa gần như luôn là thêm `"type": "module"` vào `package.json`.

---

## 4. Import bằng đuôi `.ts` — bỏ hẳn `tsx`

Đây là mảnh ghép cuối để chạy `.ts` bằng Node thuần mà `tsc` vẫn build được.

Vấn đề: Node strip-only **không sửa đường dẫn import**. Viết `from './contract.js'` trong khi trên đĩa chỉ có `contract.ts` thì Node báo:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/.../src/rpc/contract.js'
```

Hai cờ giải quyết:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "allowImportingTsExtensions": true,       // cho phép viết './x.ts'
    "rewriteRelativeImportExtensions": true   // khi emit thì đổi thành './x.js'
  }
}
```

Viết import với đuôi thật:
```ts
import { contract } from './contract.ts';
import { createServer } from './server.ts';
```

Kết quả — **cùng một mã nguồn chạy được cả hai đường**:

```bash
$ npx tsc --noEmit
$                                             ← không lỗi

$ node src/rpc/main.ts                        ← dev: Node chạy thẳng
getUser → { id: 'u1', name: 'Sơn' }
tạo post p9 cho user u1: Bài đầu tiên
createPost → { ok: true }

$ npx tsc --rootDir src --outDir dist
$ head -2 dist/rpc/main.js
import { contract } from './contract.js';     ← đã tự đổi .ts → .js
import { createServer } from './server.js';

$ node dist/rpc/main.js                       ← prod: chạy bản build
getUser → { id: 'u1', name: 'Sơn' }
```

`rewriteRelativeImportExtensions` chỉ đổi **đường dẫn tương đối**. Import từ `node_modules` không bị đụng tới.

---

## 5. `tsconfig.json` đề xuất cho dự án Node mới (2026)

```jsonc
{
  "compilerOptions": {
    // Ngôn ngữ đích
    "target": "es2023",
    "lib": ["es2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "types": ["node"],                        // ← TS 7 KHÔNG tự nạp @types/node

    // Nghiêm ngặt
    "strict": true,
    "noUncheckedIndexedAccess": true,         // arr[0] là T | undefined
    "exactOptionalPropertyTypes": true,       // {a?: string} ≠ {a: string | undefined}
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,

    // Hợp với Node chạy thẳng .ts
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,

    // Emit
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Hai cờ đáng nói riêng vì chúng đắt nhưng đáng:

**`noUncheckedIndexedAccess`** — biến `arr[i]` thành `T | undefined`:
```ts
const arr = [1, 2, 3];
const first = arr[0];
first.toFixed(2);
```
```
error TS18048: 'first' is possibly 'undefined'.
```
Phiền, nhưng nó bắt đúng loại bug hay gặp nhất khi đọc mảng/`Record` theo key động.

**`exactOptionalPropertyTypes`** — phân biệt "không có key" với "key có giá trị `undefined`":
```ts
type Opts = { retries?: number };
const o: Opts = { retries: undefined };
```
```
error TS2375: Type '{ retries: undefined; }' is not assignable to type 'Opts' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
```
Quan trọng khi bạn dùng object đó với `Object.keys`, spread, hoặc gửi qua JSON — hai trường hợp đó hành xử khác nhau.

⚠️ **`skipLibCheck: true` là đánh đổi.** Nó bỏ qua kiểm tra bên trong mọi `.d.ts`, giúp build nhanh và tránh xung đột giữa các bản `@types`. Cái giá: nếu một thư viện có `.d.ts` sai, bạn không biết. Với app thì nên bật; với thư viện bạn publish thì nên tắt ít nhất trong CI.

---

## 6. Biên runtime: `z.input` khác `z.output`

Bài 07 đã dùng Zod để validate. Đây là chi tiết mà đa số bỏ sót — và nó gây bug thật.

```ts
import { z } from 'zod';

const Schema = z.object({
  id: z.coerce.number().int().positive(),
  email: z.email(),
  tags: z.array(z.string()).default([]),
  createdAt: z.iso.datetime().transform((s) => new Date(s)),
});

type In = z.input<typeof Schema>;
type Out = z.output<typeof Schema>;
const _in: never = null as any as In;
const _out: never = null as any as Out;
```
```
src/z1.ts(11,7): error TS2322: Type '{ id: unknown; email: string; tags?: string[] | undefined; createdAt: string; }' is not assignable to type 'never'.
src/z1.ts(12,7): error TS2322: Type '{ id: number; email: string; tags: string[]; createdAt: Date; }' is not assignable to type 'never'.
```

Đặt cạnh nhau:

| Field | `z.input` (trước parse) | `z.output` (sau parse) |
|---|---|---|
| `id` | `unknown` | `number` |
| `tags` | `string[] \| undefined` | `string[]` |
| `createdAt` | `string` | `Date` |

`z.infer` là bí danh của `z.output`. Quy tắc dùng:

- Kiểu của **dữ liệu bạn nhận vào** (body request, biến môi trường, response API) → `z.input`.
- Kiểu của **dữ liệu bạn dùng trong code** → `z.output` / `z.infer`.
- Hàm nhận schema bất kỳ phải khai bằng `z.output<S>`, nếu không nó sẽ trả kiểu trước khi transform.

```ts
function parseOr<S extends z.ZodType>(s: S, raw: unknown, fb: z.output<S>): z.output<S> {
  const r = s.safeParse(raw);
  return r.success ? r.data : fb;
}
const v = parseOr(z.object({ n: z.number() }), { n: 1 }, { n: 0 });
//    v: { n: number }   ✅
```

---

## 7. Branded type từ Zod

Bài 11 dạy tự viết branded type. Zod 4 làm sẵn:

```ts
const UserId = z.string().uuid().brand<'UserId'>();
type UserId = z.infer<typeof UserId>;

declare function findUser(id: UserId): void;

findUser('550e8400-e29b-41d4-a716-446655440000');                  // dòng 18
findUser(UserId.parse('550e8400-e29b-41d4-a716-446655440000'));    // ✅
```
```
src/z1.ts(18,10): error TS2345: Argument of type 'string' is not assignable to parameter of type 'string & $brand<"UserId">'.
  Type 'string' is not assignable to type '$brand<"UserId">'.
```

Chuỗi trông đúng định dạng vẫn bị từ chối — **cách duy nhất tạo ra `UserId` là đi qua `parse`**. Đó chính là điều bạn muốn: kiểu trở thành bằng chứng rằng dữ liệu đã được kiểm tra, không phải lời hứa suông.

---

## 8. Discriminated union ở biên

```ts
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number() }),
  z.object({ type: z.literal('key'), code: z.string() }),
]);
type Event = z.infer<typeof Event>;

function handle(e: Event) {
  if (e.type === 'click') return e.x;    // ✅ narrowing hoạt động
  return e.code;
}
```

`z.discriminatedUnion` khác `z.union` ở hai điểm quan trọng: nó nhanh hơn (chỉ thử đúng một nhánh theo discriminant), và **thông báo lỗi chỉ về một nhánh** thay vì liệt kê lỗi của tất cả các nhánh. Với union nhiều nhánh, khác biệt về khả năng đọc lỗi là rất lớn.

Lỗi thật khi validate hỏng:
```bash
$ node src/rpc/main.ts
```
```
lỗi validate: [ { "origin": "string", "code": "too_small", "minimum": 1, "inclusive": true, "path": [ "title" ], "message": "Too small: expected string to have >=1 characters" } ]
```
`path` là mảng — dùng nó để map lỗi về đúng field trên form, đừng parse chuỗi `message`.

---

## 9. Ba lớp phòng thủ

Tổng kết cách xếp các công cụ trong bài này:

```
① Biên ngoài  ── Zod parse ──►  dữ liệu đã kiểm chứng + branded type
② Trong code  ── kiểu tĩnh ──►  strict + noUncheckedIndexedAccess
③ Lúc build   ── cờ cú pháp ─►  erasableSyntaxOnly + verbatimModuleSyntax
```

Lớp ① là lớp duy nhất tồn tại lúc chạy. Lớp ② và ③ biến mất khi biên dịch. **Mọi bug production do "kiểu sai" đều là lỗi của lớp ①** — thiếu một chỗ parse.

---

## Bài tập

1. Viết file có `enum`, chạy `node file.ts`. Dán lỗi. Bật `erasableSyntaxOnly` và dán lỗi thứ hai. Thay `enum` bằng `as const` rồi kiểm tra cả hai đều sạch.

2. Bật `verbatimModuleSyntax` trên một module của bạn. Đếm bao nhiêu import phải thêm `type`. Có import nào bạn tưởng là giá trị mà hoá ra là type không?

3. Dựng dự án 3 file dùng `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`. Chạy bằng `node src/main.ts`, rồi build và chạy `node dist/main.js`. Dán `head -3` của file build.

4. Bật `noUncheckedIndexedAccess` trên module cũ. Đếm số lỗi TS18048/TS2532. Sửa 3 chỗ bằng 3 cách khác nhau: optional chaining, kiểm tra `if`, và `at()`.

5. Viết schema có `.default()`, `.transform()`, và `z.coerce`. In `z.input` và `z.output`. Chỉ ra chỗ nào bạn từng dùng nhầm `z.infer` cho dữ liệu đầu vào.

6. Tạo branded `Email` bằng `z.email().brand<'Email'>()`. Viết `sendMail(to: Email)`. Thử truyền chuỗi thường và truyền kết quả `parse`.

7. Viết `z.union` và `z.discriminatedUnion` cho cùng 3 nhánh. Parse một object sai và so sánh độ dài hai thông báo lỗi.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Node: `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode`. tsc: `error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.`

**2.** Hay gặp nhất: `import { Request } from 'express'` — `Request` là interface (type), còn `express` mặc định là giá trị. Phải tách thành `import express, { type Request } from 'express'`.

**4.** `arr[0]?.toFixed(2)` · `const x = arr[0]; if (x !== undefined) ...` · `arr.at(0)` (cũng trả `T | undefined` nên vẫn phải kiểm tra — điểm khác là `at(-1)` chạy được).

**5.** Chỗ hay nhầm nhất: khai kiểu body của request là `z.infer<typeof Schema>` rồi truyền vào `parse`. Kiểu đó là **sau** transform nên nó nói dối — đúng phải là `z.input<typeof Schema>` (hoặc `unknown`, rồi để `parse` quyết định).

**7.** `z.union` liệt kê lỗi của **tất cả** nhánh (`invalid_union` chứa mảng lỗi con); `z.discriminatedUnion` chỉ báo lỗi của nhánh khớp discriminant, hoặc `invalid_union_discriminator` nếu discriminant sai.

</details>

---

👉 Tiếp: [A6 — Hiệu năng của trình kiểm kiểu](./06-hieu-nang-type-checker.md)
