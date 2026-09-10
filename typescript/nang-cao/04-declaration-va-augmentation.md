# Bài A4 — Declaration file, augmentation và khi thư viện không có kiểu

Bài 07 đã giới thiệu `.d.ts` ở mức "cài `@types/...` là xong". Bài này xử lý những tình huống thật sự khó: thư viện không có kiểu, kiểu có nhưng sai, cần thêm field vào kiểu của người khác, và cách **tìm ra kiểu đang đến từ đâu**.

---

## 1. Thư viện JavaScript không có kiểu

Đặt một file JS thuần trong dự án:

```js
// src/vendor/legacy-lib.js
module.exports = { greet: (n) => 'hi ' + n };
```
```ts
// src/use1.ts
import lib from './vendor/legacy-lib.js';
console.log(lib.greet('son'));
```
```
src/use1.ts(1,17): error TS7016: Could not find a declaration file for module './vendor/legacy-lib.js'. '/.../src/vendor/legacy-lib.js' implicitly has an 'any' type.
```

Ba cách xử lý, xếp theo chất lượng:

**a) Viết `.d.ts` cạnh file (tốt nhất)**
```ts
// src/vendor/legacy-lib.d.ts
declare const lib: { greet(name: string): string };
export default lib;
```
```bash
$ npx tsc --noEmit
$                     ← hết lỗi
```
Quy tắc: file `.d.ts` **cùng tên, cùng thư mục** thì tự được dùng, không cần khai báo gì thêm.

**b) Khai module cho package trong `node_modules`**
```ts
// types/untyped-pkg.d.ts
declare module 'untyped-pkg' {
  export function parse(input: string): { ok: boolean };
  const _default: { parse: typeof parse };
  export default _default;
}
```
Nhớ thêm thư mục vào `include` của `tsconfig.json`, nếu không TypeScript không nạp file này.

**c) Khai rỗng để tắt lỗi (chỉ khi bí)**
```ts
declare module 'untyped-pkg';   // ← mọi import từ đây thành any
```
Đúng nghĩa là tắt kiểm tra. Nếu dùng, hãy kèm comment ghi ngày và lý do.

---

## 2. Wildcard module — import ảnh, svg, css

Bundler cho phép `import logo from './logo.svg'`, nhưng TypeScript không biết `.svg` là gì.

```ts
// src/assets.d.ts
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.json' {
  const value: unknown;
  export default value;
}
```
```ts
import logo from './logo.svg';
const _l: never = null as any as typeof logo;
```
```
src/use-svg.ts(2,7): error TS2322: Type 'string' is not assignable to type 'never'.
                                        ↑ logo đã có kiểu string
```

Lưu ý file `src/logo.svg` **không cần tồn tại** để type check chạy được — wildcard khớp theo tên, không kiểm tra file thật. Nghĩa là gõ sai tên file sẽ không bị bắt ở tầng kiểu; chỉ bundler mới báo.

---

## 3. Module augmentation — thêm field vào kiểu của thư viện

Tình huống kinh điển: middleware xác thực gắn `req.user`, nhưng `@types/express` không biết.

```ts
// src/aug.d.ts
import 'express';                      // ← bắt buộc: biến file thành module

declare module 'express' {
  interface Request {
    user?: { id: number; role: 'admin' | 'user' };
  }
}
```
```ts
// src/app.ts
import express, { type Request, type Response } from 'express';

const app = express();
app.get('/me', (req: Request, res: Response) => {
  res.json({ id: req.user?.id });
  console.log(req.user?.role.toUpperCase());
  console.log(req.user?.email);
});
```
```
src/app.ts(6,25): error TS2339: Property 'email' does not exist on type '{ id: number; role: "admin" | "user"; }'.
```

`req.user` và `req.user.role` đã có kiểu; `email` báo lỗi vì bạn chưa khai. Đúng như mong đợi.

### Ba lỗi làm augmentation không chạy

**a) Quên biến file thành module.** Nếu file `.d.ts` không có `import`/`export` nào ở tầng cao nhất, `declare module 'express'` bị hiểu là **khai module mới đè lên**, chứ không phải mở rộng. Cách sửa: thêm `import 'express';` ở đầu, hoặc `export {}` ở cuối.

**b) Tên module viết sai / package chưa cài.**
```ts
import 'express-like';
declare module 'express-like' {
  interface Request { user?: { id: number } }
}
```
```
src/aug.ts(1,8): error TS2882: Cannot find module or type declarations for side-effect import of 'express-like'.
src/aug.ts(2,16): error TS2664: Invalid module name in augmentation, module 'express-like' cannot be found.
```
Nhớ **TS2664** — nó nghĩa là "bạn đang mở rộng một thứ không tồn tại", gần như luôn do gõ sai tên hoặc quên cài `@types/...`.

**c) Dùng `type` thay vì `interface`.** Augmentation chạy được nhờ declaration merging, mà chỉ `interface` gộp được (bài 11 mục 2). Viết `type Request = ...` sẽ ra `TS2300: Duplicate identifier`.

---

## 4. Global augmentation

Khi thứ cần thêm không thuộc module nào — biến global, `window`, `globalThis`.

```ts
// src/global.d.ts
declare global {
  interface Window { __APP__: { version: string } }
  var appName: string;
}
export {};
```
```ts
globalThis.appName = 'demo';
console.log(appName.toUpperCase());   // ✅
console.log(appName.toFixed(2));      // dòng 3
```
```
src/use2.ts(3,21): error TS2551: Property 'toFixed' does not exist on type 'string'. Did you mean 'fixed'?
```

Hai điều bắt buộc:
- **`declare global` chỉ dùng được bên trong một module** — nên file phải có `export {}`.
- **Biến global phải khai bằng `var`**, không phải `let`/`const`. Chỉ `var` mới tạo thuộc tính trên `globalThis`.

---

## 5. `process.env` — cái bẫy mà gần như mọi hướng dẫn đều bỏ qua

Cách "chuẩn" được chia sẻ khắp nơi:

```ts
// src/env.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      NODE_ENV: 'development' | 'production' | 'test';
      PORT?: string;
    }
  }
}
export {};
```

Nghe rất hợp lý. Thử xem nó thật sự cho gì:

```ts
const url = process.env.DATABASE_URL;
const _u: never = null as any as typeof url;
if (process.env.NODE_ENV === 'developement') {}   // gõ sai chính tả
process.env.UNKNOWN_VAR;                          // biến chưa khai
```
```
src/use.ts(2,7): error TS2322: Type 'string | undefined' is not assignable to type 'never'.
  Type 'undefined' is not assignable to type 'never'.
```

**Chỉ có đúng một lỗi, và nó là dòng in kiểu.** Ba điều đáng chú ý:

1. `DATABASE_URL` khai `string` nhưng ra **`string | undefined`**.
2. So sánh `NODE_ENV === 'developement'` (sai chính tả) **không bị bắt**.
3. `process.env.UNKNOWN_VAR` **không bị bắt**.

Lý do nằm ngay trong `@types/node` (bản 26.5.0):
```bash
$ grep -n 'interface ProcessEnv' node_modules/@types/node/process.d.ts
```
```
470:            interface ProcessEnv extends Dict<string> {}
```
`Dict<string>` là `{ [key: string]: string | undefined }`. Index signature này **gộp vào** interface của bạn và nuốt hết: mọi key đều hợp lệ, mọi giá trị đều có thể `undefined`.

### Cách làm đúng: đừng vá `ProcessEnv`, hãy parse nó

```ts
// src/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
});

export const env = EnvSchema.parse(process.env);
```

Bây giờ `env.PORT` là `number` (không phải `string | undefined`), `env.NODE_ENV` là union thật, gõ sai key báo lỗi ngay, và **thiếu biến môi trường thì chương trình chết lúc khởi động** chứ không phải lúc 2h sáng. Chi tiết ở bài A5.

Đây là ví dụ điển hình của nguyên tắc: **augmentation nói dối được, parse thì không.**

---

## 6. Tìm xem kiểu đang đến từ đâu

Khi kiểu sai mà không hiểu vì sao, hai cờ này trả lời được gần hết.

### `--explainFiles` — vì sao file này bị nạp

```bash
$ npx tsc --noEmit --explainFiles | grep -A2 'express/index.d.ts'
```
```
   Type library referenced via 'express-serve-static-core' from file 'node_modules/@types/express/index.d.ts'
   Imported via "express-serve-static-core" from file 'node_modules/@types/express/index.d.ts' with packageId '@types/express-serve-static-core/index.d.ts@5.1.3'
   File is CommonJS module because 'node_modules/@types/express-serve-static-core/package.json' does not have field "type"
```

Dùng khi: dự án nạp hàng nghìn file `.d.ts` không rõ lý do (làm chậm editor), hoặc có hai bản `@types` xung đột.

### `--traceResolution` — vì sao module này giải ra file kia

```bash
$ npx tsc --noEmit --traceResolution | grep -i express | head -6
```
```
======== Resolving module 'express' from '/.../src/only.ts'. ========
Loading module 'express' from 'node_modules' folder, target file types: TypeScript, JavaScript, Declaration, JSON.
Found 'package.json' at '/.../node_modules/express/package.json'.
File name '/.../node_modules/express/index.js' has a '.js' extension - stripping it.
File '/.../node_modules/express/index.ts' does not exist.
File '/.../node_modules/express/index.tsx' does not exist.
```

Nó in **từng đường dẫn đã thử**, theo đúng thứ tự. Dùng khi gặp `TS2307: Cannot find module` mà mắt thường thấy file rõ ràng nằm ở đó — thường là do `exports` map trong `package.json` của thư viện, hoặc `moduleResolution` sai (bài 11 mục 6).

Cả hai cờ in rất nhiều, luôn `| grep` hoặc `> trace.txt`.

---

## 7. Viết `.d.ts` cho code của chính mình: `isolatedDeclarations`

Khi bạn publish một package, `tsc` phải sinh `.d.ts`. Việc đó chậm vì nó phải suy kiểu toàn dự án. Cờ `isolatedDeclarations` (TS 5.5+) bắt bạn **ghi kiểu trả về tường minh cho mọi export**, đổi lại `.d.ts` sinh được từng file độc lập — công cụ như esbuild/swc làm được, nhanh hơn nhiều lần.

```ts
export const cfg = { url: 'x', port: 3000 };
export function make(u: string) { return { u }; }
export const N = 1;
```
```bash
$ npx tsc --emitDeclarationOnly --declaration --isolatedDeclarations --rootDir src --outDir types
```
```
src/h3.ts(2,44): error TS9016: Objects that contain shorthand properties can't be inferred with --isolatedDeclarations.
```

`cfg` và `N` qua được (suy được trong phạm vi một biểu thức), còn `make` thì không vì `{ u }` là shorthand. Sửa:

```ts
export function make(u: string): { u: string } { return { u }; }
```

Bật cờ này nếu bạn publish package. Không bật nếu chỉ viết app — nó chỉ thêm việc.

---

## Bài tập

1. Tạo một file JS thuần export 2 hàm, import vào TS. Dán lỗi TS7016. Viết `.d.ts` cạnh nó, kiểm tra hết lỗi, rồi gọi hàm với sai kiểu tham số để chắc chắn kiểu có tác dụng thật.

2. Viết augmentation thêm `req.requestId: string` vào express. Cố tình **bỏ** dòng `import 'express'` ở đầu file rồi chạy — chuyện gì xảy ra với các kiểu express khác?

3. Viết `declare module '*.md' { const content: string; export default content }`. Import một file `.md` **không tồn tại**. Có lỗi không? Giải thích.

4. Thêm `declare global { var cache: Map<string, unknown> }`. Đổi `var` thành `let` và ghi lại lỗi.

5. Vá `ProcessEnv` như mục 5 rồi tự kiểm ba điều: giá trị có `| undefined` không, gõ sai tên biến có bị bắt không, so sánh sai giá trị có bị bắt không. Sau đó viết lại bằng Zod và kiểm lại đúng ba điều đó.

6. Chạy `tsc --noEmit --explainFiles > files.txt` trên dự án của bạn. Đếm số file `.d.ts` được nạp (`grep -c '\.d\.ts$'`). Tìm package nào kéo vào nhiều file nhất.

7. Bật `isolatedDeclarations` cho một module trong dự án. Sửa hết TS9016 và đếm bao nhiêu chỗ phải thêm kiểu trả về.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Không có `import`/`export` ở tầng cao nhất, file `.d.ts` là **script toàn cục**, nên `declare module 'express'` trở thành khai báo module mới **đè lên toàn bộ** `@types/express`. Hậu quả: `express()` mất kiểu, mọi thứ thành `any` hoặc báo `TS2307`/`TS2339` tuỳ nội dung bạn viết. Đây là lỗi gây mất cả buổi để tìm.

**3.** Không lỗi ở tầng kiểu. Wildcard chỉ khớp **mẫu tên**, không kiểm tra file có thật. Bundler sẽ báo lúc build.

**4.** Với `var` thì `globalThis.cache` dùng được. Đổi sang `let`:
```
error TS2339: Property 'cache' does not exist on type 'typeof globalThis'.
```
Chỉ `var` mới tạo thuộc tính trên `globalThis`; `let`/`const` nằm trong scope riêng của module toàn cục.

**5.** Bản vá `ProcessEnv`: `string | undefined`, gõ sai **không** bị bắt, so sánh sai **không** bị bắt — vì `ProcessEnv extends Dict<string>`. Bản Zod: kiểu chính xác, sai key báo TS2339, so sánh sai báo TS2367 (`This comparison appears to be unintentional`).

</details>

---

👉 Tiếp: [A5 — Cấu hình hiện đại và biên runtime](./05-cau-hinh-hien-dai-va-bien-runtime.md)
