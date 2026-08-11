# Bài 0 — Cài đặt, cách chạy file `.ts`, và `tsconfig.json`

Mục tiêu: có một project chạy được trong 5 phút, và hiểu **từng dòng** trong `tsconfig.json` thay vì copy đại.

---

## 1. Tạo project `ts-lab`

Cả bộ tài liệu này dùng chung một project. Tạo một lần, dùng suốt 5 ngày.

```bash
mkdir ts-lab && cd ts-lab
npm init -y
npm i -D typescript @types/node tsx
mkdir src
```

Ba gói vừa cài, mỗi gói làm một việc:

| Gói | Việc nó làm | Không có nó thì sao |
|---|---|---|
| `typescript` | Trình biên dịch `tsc` — kiểm tra kiểu và sinh ra `.js` | Không có lệnh `tsc` |
| `@types/node` | Khai báo kiểu cho `process`, `fs`, `path`, `Buffer`... | `error TS2591: Cannot find name 'process'.` |
| `tsx` | Chạy thẳng file `.ts` (có watch mode) | Phải build ra `.js` rồi mới `node` được |

Kiểm tra:

```bash
$ npx tsc -v
Version 7.0.2
```

> Bản 7 là `tsc` đã được viết lại bằng Go — nhanh hơn hẳn bản 5.x nhưng cú pháp ngôn ngữ giữ nguyên. Mọi thứ trong tài liệu này chạy đúng trên cả 5.x và 7.x; chỗ nào khác nhau sẽ được ghi rõ.
>
> Bản 7 **gỡ bỏ** một số option cũ. Gặp lỗi dưới đây khi mở project cũ là do vậy:
> ```
> error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
> error TS5108: Option 'moduleResolution=node10' has been removed. Please remove it from your configuration.
> error TS5102: Option 'outFile' has been removed. Please remove it from your configuration.
> ```
> Cách sửa: `target` dùng `ES2015` trở lên, `moduleResolution` dùng `nodenext` hoặc `bundler`, `outFile` thay bằng `outDir` (hoặc để bundler lo việc gộp file).

---

## 2. Bốn cách chạy một file `.ts`

Tạo file thử:

```bash
cat > src/index.ts <<'EOF'
const name: string = 'Sơn';
const age: number = 'ba mươi';   // cố tình sai kiểu
console.log(name, age);
EOF
```

### Cách 1 — `tsc` rồi `node` (cách chuẩn khi build production)

```bash
$ npx tsc
src/index.ts:2:7 - error TS2322: Type 'string' is not assignable to type 'number'.

2 const age: number = 'ba mươi';   // cố tình sai kiểu
        ~~~

Found 1 error in src/index.ts:2
```

Lưu ý: **`tsc` vẫn sinh ra file `.js`** dù có lỗi (trừ khi bật `noEmitOnError`). Nghĩa là "build có lỗi" không đồng nghĩa "không có output".

### Cách 2 — `tsx` (cách dùng khi đang học và khi dev)

```bash
$ npx tsx src/index.ts
Sơn ba mươi
```

Chú ý: **`tsx` không kiểm tra kiểu**, nó chỉ xoá kiểu rồi chạy. Lỗi TS2322 ở trên không hiện ra. Đây là điều làm người mới hoang mang nhất.

Watch mode khi làm bài tập:

```bash
$ npx tsx watch src/index.ts
```

### Cách 3 — Node chạy thẳng `.ts`

Kiểm tra phiên bản Node trước:

```bash
$ node -v
v20.14.0     ← chưa chạy được, bỏ qua cách này
```

Node **22.6 trở lên** mới có, và cần cờ; Node **23.6 trở lên** thì bật sẵn:

```bash
$ node --experimental-strip-types src/index.ts    # Node 22.6+
$ node src/index.ts                                # Node 23.6+ / 24
Sơn ba mươi
```

Node < 22.6 sẽ báo:
```
SyntaxError: Missing initializer in const declaration
```
(nó đang cố đọc `const name: string = ...` như JavaScript thuần và vấp ngay ở dấu `:`)

Cách này cũng **chỉ xoá kiểu, không kiểm tra**. Và nó không nuốt được vài cú pháp riêng của TypeScript: `enum`, `namespace`, và **parameter property** (`constructor(private x: number) {}` — thứ NestJS dùng ở mọi service). Ba thứ đó không phải chỉ là kiểu, chúng sinh ra code JS thật, nên "chỉ xoá kiểu" là không đủ:

```
SyntaxError: TypeScript enum is not supported in strip-only mode
```

Muốn chạy được thì thêm `--experimental-transform-types`. Kết luận: **cách này chưa dùng được cho project NestJS**, cứ dùng `tsx`.

### Cách 4 — `tsc --noEmit --watch` (mở song song, để riêng một terminal)

Đây là cách **kiểm tra kiểu** liên tục mà không sinh file rác:

```bash
$ npx tsc --noEmit --watch
[10:12:04] Starting compilation in watch mode...

src/index.ts:2:7 - error TS2322: Type 'string' is not assignable to type 'number'.

[10:12:05] Found 1 error. Watching for file changes.
```

Sửa `'ba mươi'` thành `30` và lưu:

```
[10:12:41] File change detected. Starting incremental compilation...
[10:12:41] Found 0 errors. Watching for file changes.
```

### Chốt lại: dùng cái nào?

| Việc | Lệnh |
|---|---|
| Đang code, muốn thấy lỗi kiểu | `npx tsc --noEmit --watch` (terminal 1) |
| Đang code, muốn chạy thử | `npx tsx watch src/index.ts` (terminal 2) |
| Build ra production | `npx tsc` rồi `node dist/index.js` |
| CI kiểm tra trước khi merge | `npx tsc --noEmit` |

Thêm vào `package.json`:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

---

## 3. `tsconfig.json` — sinh ra và đọc hiểu

```bash
$ npx tsc --init

Created a new tsconfig.json

You can learn more at https://aka.ms/tsconfig
```

File sinh ra đã khá tốt sẵn (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` đều bật), nhưng nó nhắm vào project frontend: có `"jsx"`, có `"types": []`, và **không** có `outDir`/`rootDir`. Thay bằng bản dưới đây cho project Node, rồi đọc phần giải thích từng nhóm.

### Bản dùng được ngay

```jsonc
{
  "compilerOptions": {
    /* Output */
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,

    /* Kiểm tra kiểu */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Tương thích & tốc độ */
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 4. Từng option — nó nằm ở đâu và bỏ đi thì thấy gì

### `target` — cú pháp JS được sinh ra

Nằm ở output trong `dist/`. Tự so sánh bằng cùng một file nguồn:

```ts
// src/t.ts
const users = ['a', 'b'];
const first = users?.at(0) ?? 'x';
class A { #s = 1; get v() { return this.#s; } }
console.log(first, new A().v);
```

```bash
$ npx tsc src/t.ts --target ES2015 --lib ES2022 --outDir /tmp/o15 && cat /tmp/o15/t.js
```
```js
"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    ...
};
var _A_s;
const users = ['a', 'b'];
const first = (_a = users === null || users === void 0 ? void 0 : users.at(0)) !== null && _a !== void 0 ? _a : 'x';
class A {
    constructor() { _A_s.set(this, 1); }
    get v() { return __classPrivateFieldGet(this, _A_s, "f"); }
}
_A_s = new WeakMap();
```

```bash
$ npx tsc src/t.ts --target ESNext --outDir /tmp/o23 && cat /tmp/o23/t.js
```
```js
"use strict";
const users = ['a', 'b'];
const first = users?.at(0) ?? 'x';
class A {
    #s = 1;
    get v() { return this.#s; }
}
```

Thấy rõ cái giá của `target` thấp: `?.` bị đổi thành chuỗi `=== null || === void 0`, `#private` bị đổi thành `WeakMap` + hàm helper. Stack trace lúc debug sẽ trỏ vào đám code đó chứ không phải code bạn viết.

Chạy trên Node thì để `ES2022`/`ES2023` — Node hiểu hết, code sinh ra gần như y hệt code nguồn.

### `lib` — thư viện chuẩn nào được biết tới

`target` quyết định **cú pháp** sinh ra, `lib` quyết định **API nào TypeScript biết là tồn tại**. Hai thứ khác nhau:

```bash
$ npx tsc src/t.ts --target ES2015 --lib ES2015 --noEmit
src/t.ts(2,22): error TS2550: Property 'at' does not exist on type 'string[]'.
  Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.
src/t.ts(4,1): error TS2584: Cannot find name 'console'.
  Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'.
```

Chú ý dòng thứ hai: `console` **không** thuộc chuẩn JavaScript, nó do môi trường cung cấp. Trên Node thì `@types/node` mang nó vào, trên trình duyệt thì `"lib": ["DOM"]`. Viết code frontend mà thiếu `"DOM"`:

```
error TS2584: Cannot find name 'document'.
```

### `types` — nạp gói khai báo nào

Đây là chỗ mất nhiều thời gian nhất khi mới dựng project, vì lỗi trông y như "chưa cài gói" trong khi gói đã cài rồi:

```bash
$ npm ls @types/node
task-cli@1.0.0
└── @types/node@26.2.0        ← đã cài đầy đủ

$ npx tsc --noEmit
src/main.ts(7,29): error TS2591: Cannot find name 'process'. Do you need to install type definitions
for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
```

Chú ý nửa sau của thông báo: **`and then add 'node' to the types field`**. Thêm dòng này vào `tsconfig.json` là hết sạch lỗi:

```jsonc
"types": ["node"]
```

Nói chung: `types` liệt kê các gói `@types/*` được nạp toàn cục. Cần thêm gì thì thêm vào mảng:

```jsonc
"types": ["node", "jest"]
```

### `module` + `moduleResolution` — cách import được dịch và tìm

`NodeNext` là lựa chọn đúng cho Node hiện đại: nó đọc `"type"` trong `package.json` để quyết định file là ESM hay CommonJS.

Nếu `package.json` có `"type": "module"` thì **import phải ghi đuôi file**:

```ts
import { add } from './math';       // ❌
```
```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './math.js'?
```
```ts
import { add } from './math.js';    // ✅ đúng — ghi .js dù file nguồn là math.ts
```

Nghe ngược đời, nhưng đúng: bạn ghi đường dẫn của **file sau khi build**, và sau khi build `math.ts` thành `math.js`.

### `outDir` + `rootDir`

```bash
$ npx tsc && find dist -type f
dist/index.js
dist/index.js.map
dist/math.js
```

Không có `rootDir`, TS lấy thư mục cha chung của mọi file được include. Lỡ include thêm 1 file ngoài `src/` là cấu trúc `dist/` đột nhiên thành `dist/src/...` và `npm start` chết vì `Cannot find module '/app/dist/index.js'`.

### `strict` — cờ quan trọng nhất

`strict: true` bật một lượt 8 cờ con. Hai cờ đáng nhớ tên:

**`strictNullChecks`** — `null`/`undefined` không tự động nằm trong mọi kiểu:

```ts
function len(s: string) { return s.length; }
len(null);
```
```
error TS2345: Argument of type 'null' is not assignable to parameter of type 'string'.
```

```ts
const el = document.getElementById('app');
el.innerHTML = 'hi';
```
```
error TS18047: 'el' is possibly 'null'.
```

**`noImplicitAny`** — không được để tham số không kiểu:

```ts
function double(x) { return x * 2; }
```
```
error TS7006: Parameter 'x' implicitly has an 'any' type.
```

### `noUncheckedIndexedAccess` — cờ hay nhất mà mặc định lại tắt

Truy cập mảng/object theo index **có thể ra `undefined`**, và cờ này bắt bạn thừa nhận điều đó:

```ts
const arr = [1, 2, 3];
const x = arr[10];
console.log(x.toFixed(2));
```

Tắt cờ (mặc định): không lỗi → chạy thật thì `TypeError: Cannot read properties of undefined (reading 'toFixed')`.

Bật cờ:
```
error TS18048: 'x' is possibly 'undefined'.
```

Sửa:
```ts
const x = arr[10];
if (x !== undefined) console.log(x.toFixed(2));
```

Cái giá phải trả: vòng `for (let i = 0; i < arr.length; i++)` cũng bị bắt kiểm tra. Đổi sang `for (const x of arr)` là hết vì `x` khi đó chắc chắn có.

### `esModuleInterop`

Nằm ở mọi dòng `import x from 'commonjs-package'`:

```ts
import express from 'express';
```

Tắt cờ:
```
error TS1259: Module '"express"' can only be default-imported using the 'esModuleInterop' flag
```

Luôn bật. Không có lý do gì để tắt trong project mới.

### `skipLibCheck`

Bỏ qua việc kiểm tra kiểu bên trong các file `.d.ts` của `node_modules`. Tắt nó ra thì bạn phải sửa lỗi của thư viện người khác:

```
node_modules/@types/some-lib/index.d.ts:44:5 - error TS2717: Subsequent property declarations must have the same type.
```

Bật để build nhanh hơn và không bị chặn bởi lỗi không phải của mình.

### `noUnusedLocals` / `noUnusedParameters`

```ts
import { readFile } from 'fs';   // không dùng tới
function f(a: number, b: number) { return a; }
```
```
error TS6133: 'readFile' is declared but its value is never read.
error TS6133: 'b' is declared but its value is never read.
```

Muốn giữ tham số nhưng không dùng thì đặt tên bắt đầu bằng `_`: `function f(a: number, _b: number)` → hết lỗi.

### `resolveJsonModule`

```ts
import pkg from '../package.json';
console.log(pkg.version);
```

Tắt cờ (mặc định ở TypeScript 5.x):
```
error TS2732: Cannot find module '../package.json'. Consider using '--resolveJsonModule' to import module with '.json' extension.
```

Bật rồi, TypeScript đọc **nội dung thật** của file JSON để suy kiểu — gõ sai key là biết ngay:

```ts
import pkg from '../package.json';
console.log(pkg.nmae);
```
```
error TS2339: Property 'nmae' does not exist on type '{ name: string; version: string; devDependencies: {...}; }'.
```

Một lưu ý cho project ESM (`"type": "module"` trong `package.json`): import JSON phải kèm import attribute.

```ts
import pkg from '../package.json';
```
```
error TS1543: Importing a JSON file into an ECMAScript module requires a 'type: "json"' import attribute
when 'module' is set to 'NodeNext'.
```
```ts
import pkg from '../package.json' with { type: 'json' };   // ✅
```

### `experimentalDecorators` + `emitDecoratorMetadata`

Hai cờ này **không có trong bản khuyến nghị ở trên** vì bạn chưa cần. Nhưng project NestJS bắt buộc có, và đây là lý do:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly repo: UserRepository) {}
}
```

- `experimentalDecorators`: bật cú pháp decorator kiểu cũ, có hỗ trợ **parameter decorator** (`@Inject()`, `@Body()`, `@Param()`). Decorator chuẩn ES mới của TS 5 **không** hỗ trợ parameter decorator. Thiếu cờ:
  ```
  error TS1239: Unable to resolve signature of parameter decorator when called as an expression.
  ```
- `emitDecoratorMetadata`: sinh thêm metadata `design:paramtypes` vào JS, để lúc runtime NestJS đọc được kiểu `UserRepository` mà inject đúng thứ. Thiếu cờ thì app khởi động rồi chết:
  ```
  Nest can't resolve dependencies of the UsersService (?). Please make sure that the argument dependency at index [0] is available.
  ```

Chi tiết ở [bài 06](./06-class-va-decorator.md).

---

## 5. `include` / `exclude` / `files`

```jsonc
"include": ["src/**/*"],
"exclude": ["node_modules", "dist"]
```

Điểm hay bị hiểu sai: **`exclude` không loại được file đã bị `import`**. Nếu `src/index.ts` import `src/legacy/old.ts` thì `old.ts` vẫn được kiểm tra dù bạn có `"exclude": ["src/legacy"]`. `exclude` chỉ lọc bớt danh sách file *khởi đầu* mà `include` gom vào.

Chứng minh:

```bash
$ npx tsc --noEmit --listFiles | grep legacy
src/legacy/old.ts        ← vẫn có mặt
```

Muốn thật sự bỏ qua thì đừng import nó, hoặc đặt `// @ts-nocheck` ở đầu file đó.

---

## 6. Ba lỗi hay gặp ngay ngày đầu

**`error TS5023: Unknown compiler option 'xxx'`** — gõ sai tên option, hoặc option đó chỉ có ở bản TS mới hơn bản đang cài. Kiểm tra `npx tsc -v`.

**`error TS2591: Cannot find name 'process'.`** — đã cài `@types/node` rồi vẫn gặp? Thiếu `"types": ["node"]` trong `tsconfig.json`. Xem mục `types` ở trên.

**`error TS2307: Cannot find module 'lodash' or its corresponding type declarations.`** — chưa cài gói, hoặc cài rồi mà gói không kèm kiểu. Cài thêm: `npm i -D @types/lodash`.

**`error TS7016: Could not find a declaration file for module 'some-lib'. '.../index.js' implicitly has an 'any' type.`** — thư viện có JS nhưng không có `.d.ts` và cũng không ai viết `@types` cho nó. Cách xử lý ở [bài 07, phần `.d.ts`](./07-thuc-chien-api-va-module.md).

---

## Bài tập

1. Tạo project `ts-lab` theo mục 1, viết `src/index.ts` in ra `Node ${process.version}`. Chạy bằng cả 4 cách ở mục 2.
2. Gỡ `@types/node` (`npm rm @types/node`) rồi chạy `npx tsc --noEmit`. Ghi lại **mã lỗi** nhận được. Cài lại.
3. Bật `noUncheckedIndexedAccess`, viết hàm `firstChar(s: string[]): string` lấy ký tự đầu của phần tử đầu tiên. Làm cho nó không còn lỗi mà **không dùng** `!` và không dùng `as`.
4. Đặt `"type": "module"` vào `package.json`, tạo `src/math.ts` export hàm `add`, import từ `src/index.ts`. Sửa cho hết lỗi TS2835.
5. Viết một file có 3 lỗi kiểu khác nhau, chạy `npx tsc --noEmit` và đối chiếu 3 mã lỗi với [bài 09](./09-loi-thuong-gap.md).

<details>
<summary>Gợi ý đáp án</summary>

```bash
# 2
error TS2591: Cannot find name 'process'. Do you need to install type definitions for node?
Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
```

```ts
// 3 — dùng kiểm tra tường minh, không dùng `!`
function firstChar(s: string[]): string {
  const first = s[0];           // kiểu: string | undefined
  if (first === undefined) return '';
  return first[0] ?? '';        // s[0][0] cũng có thể undefined khi chuỗi rỗng
}
```

```ts
// 4
// src/math.ts
export function add(a: number, b: number) { return a + b; }

// src/index.ts
import { add } from './math.js';   // ghi .js, không phải .ts
console.log(add(1, 2));
```

</details>

---

Tiếp theo 👉 [01-kieu-co-ban.md](./01-kieu-co-ban.md)
