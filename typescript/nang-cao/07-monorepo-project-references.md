# Bài A7 — Monorepo và project references

Khi dự án tách thành nhiều package (`core`, `api`, `web`, `shared`), có hai cách nối chúng lại:

- **Cách dễ**: `paths` trong `tsconfig` trỏ thẳng vào `src` của package kia.
- **Cách đúng**: project references — mỗi package build ra `.d.ts` riêng, package khác dùng `.d.ts` đó.

Bài này dựng cách đúng từ đầu, chạy thật, và chỉ ra vì sao cách dễ hỏng khi dự án lớn.

---

## 1. Dựng cấu trúc

```
mono/
├─ tsconfig.base.json          ← cấu hình dùng chung
├─ tsconfig.json               ← "solution file", chỉ liệt kê project
└─ packages/
   ├─ core/
   │  ├─ package.json
   │  ├─ tsconfig.json
   │  └─ src/index.ts
   └─ api/
      ├─ package.json
      ├─ tsconfig.json
      └─ src/server.ts
```

**`tsconfig.base.json`** — mọi package kế thừa từ đây:
```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "declaration": true,        // ← bắt buộc: package khác cần .d.ts
    "composite": true,          // ← bắt buộc để được tham chiếu
    "declarationMap": true,     // ← để "go to definition" nhảy về .ts gốc
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

**`packages/core/tsconfig.json`**:
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}
```

**`packages/api/tsconfig.json`** — điểm khác duy nhất là `references`:
```jsonc
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

**`tsconfig.json` ở gốc** — không chứa file nào, chỉ điều phối:
```jsonc
{ "files": [], "references": [{ "path": "packages/core" }, { "path": "packages/api" }] }
```

**`packages/core/package.json`** — trỏ vào `dist`, không phải `src`:
```jsonc
{
  "name": "@app/core", "version": "1.0.0", "type": "module",
  "main": "./dist/index.js", "types": "./dist/index.d.ts"
}
```

---

## 2. Build lần đầu

```ts
// packages/core/src/index.ts
export type Money = { amount: number; currency: 'VND' | 'USD' };
export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error('khác đơn vị');
  return { amount: a.amount + b.amount, currency: a.currency };
}
```
```ts
// packages/api/src/server.ts
import { add, type Money } from '@app/core';
const a: Money = { amount: 1, currency: 'VND' };
console.log(add(a, { amount: 2, currency: 'USD' }));
```

```bash
$ npx tsc --build --verbose
```
```
08:16:10 PM - Projects in this build:
    * packages/core/tsconfig.json
    * packages/api/tsconfig.json
    * tsconfig.json

08:16:10 PM - Project 'packages/core/tsconfig.json' is out of date because output file 'packages/core/tsconfig.tsbuildinfo' does not exist

08:16:10 PM - Building project 'packages/core/tsconfig.json'...

08:16:10 PM - Project 'packages/api/tsconfig.json' is out of date because output file 'packages/api/tsconfig.tsbuildinfo' does not exist

08:16:11 PM - Building project 'packages/api/tsconfig.json'...
```

`tsc --build` (viết tắt `tsc -b`) **tự sắp thứ tự** theo đồ thị phụ thuộc. Bạn không phải tự nhớ build `core` trước.

Kết quả trong `packages/core/dist/`:
```bash
$ ls packages/core/dist
index.d.ts   index.d.ts.map   index.js   index.js.map
$ cat packages/core/dist/index.d.ts
```
```ts
export type Money = {
    amount: number;
    currency: 'VND' | 'USD';
};
export declare function add(a: Money, b: Money): Money;
//# sourceMappingURL=index.d.ts.map
```

Chỉ có kiểu, không có thân hàm. Đây chính là thứ `api` đọc — nó **không** đọc `src/index.ts` của core nữa.

---

## 3. Build lần hai: incremental

```bash
$ npx tsc --build --verbose
```
```
08:16:19 PM - Project 'packages/core/tsconfig.json' is up to date because newest input 'packages/core/src/index.ts' is older than output 'packages/core/tsconfig.tsbuildinfo'
08:16:19 PM - Project 'packages/api/tsconfig.json' is up to date because newest input 'packages/api/src/server.ts' is older than output 'packages/api/tsconfig.tsbuildinfo'
```

Không build lại gì cả. File `tsconfig.tsbuildinfo` (7 KB trong ví dụ này) lưu dấu vết lần build trước.

**Trong CI, hãy cache thư mục chứa `*.tsbuildinfo` và `dist`** — đó là toàn bộ cơ chế build tăng dần.

---

## 4. Sửa `core` → `api` tự phát hiện

Đổi `currency: 'VND' | 'USD'` thành `'VND' | 'EUR'` trong core:

```bash
$ npx tsc --build --verbose
```
```
08:16:19 PM - Project 'packages/core/tsconfig.json' is out of date because output 'packages/core/tsconfig.tsbuildinfo' is older than input 'packages/core/src/index.ts'
08:16:19 PM - Building project 'packages/core/tsconfig.json'...
08:16:19 PM - Project 'packages/api/tsconfig.json' is out of date because output 'packages/api/tsconfig.tsbuildinfo' is older than input 'packages/core/dist/index.d.ts'
08:16:19 PM - Building project 'packages/api/tsconfig.json'...
packages/api/src/server.ts(3,33): error TS2322: Type '"USD"' is not assignable to type '"EUR" | "VND"'.
```

Đọc kỹ dòng thứ ba: `api` out of date **vì `core/dist/index.d.ts` mới hơn** — không phải vì file nguồn của api thay đổi. Đó là điểm mạnh nhất của project references: **thay đổi API công khai của một package sẽ làm mọi package phụ thuộc build lại và báo lỗi ngay.**

Chi tiết tinh tế: nếu bạn chỉ sửa **thân hàm** trong core mà không đổi chữ ký, `.d.ts` không đổi → `api` **không** build lại. Đây là lý do `declaration: true` không chỉ để publish, mà còn để chia nhỏ việc build.

---

## 5. Ba lỗi hay gặp

### TS6306 — quên `composite`

```
packages/api/tsconfig.json(4,18): error TS6306: Referenced project '/.../packages/core' must have setting "composite": true.
```

`composite: true` bật ba thứ cùng lúc: bắt buộc `declaration`, bắt buộc `rootDir` xác định, và sinh `.tsbuildinfo`. Không có nó thì không tham chiếu được.

### TS2307 — quên `references`

Bỏ `references` khỏi `packages/api/tsconfig.json` rồi xoá `dist`:

```bash
$ npx tsc --build packages/api
```
```
packages/api/src/server.ts(1,33): error TS2307: Cannot find module '@app/core' or its corresponding type declarations.
```

`api` không biết phải build `core` trước, mà `core/dist/index.d.ts` chưa tồn tại. Thêm `references` lại:

```bash
$ npx tsc --build packages/api --verbose
```
```
08:33:51 PM - Building project 'packages/core/tsconfig.json'...
08:33:51 PM - Building project 'packages/api/tsconfig.json'...
```

Chỉ yêu cầu build `api`, nó tự build `core` trước.

⚠️ Bẫy độc ác: nếu `core/dist` **đã tồn tại** từ lần build trước, việc thiếu `references` sẽ **không** gây lỗi ngay — cho tới khi CI chạy trên máy sạch. Đây là dạng bug "chạy trên máy tôi được".

### `paths` trỏ vào `src` — cách dễ và vì sao nó hỏng

```jsonc
// ❌ cách hay được chép trên mạng
{ "compilerOptions": { "paths": { "@app/core": ["../core/src/index.ts"] } } }
```

Chạy được ngay, nhưng:
- Không có ranh giới: `api` thấy **toàn bộ** nội bộ của `core`, kể cả thứ không export ra `index.ts`.
- Không có build tăng dần: mỗi lần check là type-check lại cả `core`.
- `tsc` không sinh output đúng: `outDir` của `api` sẽ chứa cả `core/` vì rootDir bị kéo lên.
- Khi publish, `paths` không tồn tại ở runtime → phải thêm bundler hoặc `tsc-alias`.

Dùng `paths` chỉ khi: dự án nhỏ, một app duy nhất, không publish. Còn lại dùng references.

---

## 6. `declarationMap` — thứ giữ trải nghiệm editor

Không có `declarationMap`, "Go to definition" từ `api` sẽ nhảy vào `core/dist/index.d.ts` — file sinh tự động, không sửa được. Bật lên, editor nhảy thẳng về `core/src/index.ts`.

Chi phí: thêm file `.d.ts.map` trong `dist`. Với package publish lên npm, thêm `"sourceMap": true` và đóng gói cả `src` thì người dùng thư viện cũng debug được vào mã gốc của bạn.

---

## 7. Lệnh cần nhớ

```bash
$ npx tsc --build                    # build mọi project theo đúng thứ tự
$ npx tsc --build --verbose          # in lý do build / không build từng project
$ npx tsc --build --force            # bỏ qua cache, build lại tất cả
$ npx tsc --build --clean            # xoá mọi output và .tsbuildinfo
$ npx tsc --build --watch            # theo dõi, build lại phần thay đổi
$ npx tsc --build packages/api       # build một project và mọi thứ nó phụ thuộc
```

Khi build "bị kẹt" ở trạng thái lạ (đổi tsconfig mà không thấy tác dụng), `--clean` rồi build lại là cách sửa đúng — đừng xoá tay `dist`, vì `.tsbuildinfo` sẽ còn nhớ trạng thái cũ.

---

## 8. Kết hợp với package manager

Project references lo phần **kiểu**. Việc `import '@app/core'` giải ra đúng thư mục là việc của package manager:

- **npm/yarn/pnpm workspaces**: khai `workspaces` trong `package.json` gốc, chúng tự tạo symlink trong `node_modules`.
- Hai lớp này **độc lập**: `references` sai thì build sai thứ tự; `workspaces` sai thì `TS2307`. Khi gặp `TS2307`, kiểm tra `node_modules/@app/core` có tồn tại không **trước** khi nghi ngờ tsconfig.

---

## Bài tập

1. Dựng monorepo 2 package như bài. Chạy `tsc -b --verbose` hai lần liên tiếp và dán output của cả hai.

2. Sửa **thân hàm** trong `core` (không đổi chữ ký), chạy `tsc -b --verbose`. `api` có build lại không? Rồi sửa **chữ ký** và làm lại. Giải thích khác biệt.

3. Bỏ `composite: true` khỏi `core`. Dán lỗi.

4. Bỏ `references` khỏi `api` nhưng **giữ** `core/dist`. Build có lỗi không? Xoá `dist` rồi build lại. Rút ra bài học gì cho CI?

5. Thêm package thứ ba `web` phụ thuộc cả `core` và `api`. Vẽ đồ thị và kiểm tra thứ tự build trong `--verbose`.

6. Bật rồi tắt `declarationMap`, thử "Go to definition" trong editor ở cả hai trường hợp.

7. Đo thời gian: `tsc -b --force` so với `tsc -b` sau khi sửa một file trong `core`.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Sửa thân hàm: `core` build lại nhưng `api` báo **up to date**, vì `.d.ts` không đổi nội dung. Sửa chữ ký: `api` build lại vì `core/dist/index.d.ts` mới hơn. Đây là lý do monorepo lớn vẫn build nhanh.

**4.** Không lỗi khi `dist` còn — và đó chính là cái bẫy. Xoá `dist` (hoặc chạy CI trên máy sạch) mới lộ `TS2307`. Bài học: CI phải chạy `tsc -b --clean && tsc -b` ít nhất một job, hoặc build từ cache trống.

**5.** Thứ tự phải là `core` → `api` → `web`. Nếu `--verbose` in khác, đồ thị `references` của bạn đang thiếu cạnh.

</details>

---

👉 Tiếp: [A8 — Decorator chuẩn và metadata](./08-decorator-chuan.md)
