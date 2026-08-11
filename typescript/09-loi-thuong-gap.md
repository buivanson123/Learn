# Bài 9 — 22 lỗi kinh điển và cách sửa

Tra theo **mã lỗi**. Mỗi mục có: thông báo thật, đoạn code gây ra nó, nguyên nhân, và cách sửa đúng (không phải cách dập lỗi bằng `any`).

Mẹo tra nhanh: `Cmd+F` mã lỗi (`TS2322`) trong file này.

---

## Nhóm 1 — Kiểu không khớp

### TS2322 — Type 'X' is not assignable to type 'Y'

```
error TS2322: Type 'string' is not assignable to type 'number'.
```

Lỗi cơ bản nhất. Nhưng dạng hay gặp và khó hiểu hơn là khi nó xuất hiện với `never`:

```ts
type A = { x: number };
type B = A & { x: string };
const b: B = { x: 1 };
```
```
error TS2322: Type 'number' is not assignable to type 'never'.
```

**Nguyên nhân:** `number & string` = `never`, không có giá trị nào thoả cả hai. Bạn đang giao (`&`) hai kiểu xung đột.

**Sửa:** đừng dùng `&` để "ghi đè" field. Dùng `Omit` rồi thêm lại:
```ts
type B = Omit<A, 'x'> & { x: string };
```

---

### TS2345 — Argument of type 'X' is not assignable to parameter of type 'Y'

```ts
type Method = 'GET' | 'POST';
declare function send(m: Method): void;

const config = { method: 'POST' };
send(config.method);
```
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'Method'.
```

**Nguyên nhân:** property của object thường được mở rộng thành `string`, không giữ literal.

**Sửa:**
```ts
const config = { method: 'POST' } as const;
```

---

### TS2820 — Did you mean '"..."'?

```ts
type Status = 'pending' | 'paid';
const s: Status = 'paidd';
```
```
error TS2820: Type '"paidd"' is not assignable to type 'Status'. Did you mean '"paid"'?
```

**Sửa:** gõ đúng. Đây là lỗi "dễ thương" nhất của TypeScript — nó đoán hộ luôn.

---

### TS2739 / TS2741 — Property is missing

```
error TS2741: Property 'email' is missing in type '{ id: number; name: string; }' but required in type 'User'.
```

**Nguyên nhân:** thiếu field bắt buộc.

**Sửa:** thêm field, hoặc nếu field đó thật sự có thể vắng thì khai `email?: string` trong `User`.

---

## Nhóm 2 — Null và undefined

### TS18047 — 'x' is possibly 'null'

```ts
const el = document.getElementById('app');
el.innerHTML = 'hi';
```
```
error TS18047: 'el' is possibly 'null'.
```

**Sửa đúng** (kiểm tra thật, có thông báo rõ ràng):
```ts
const el = document.getElementById('app');
if (!el) throw new Error('Không tìm thấy #app');
el.innerHTML = 'hi';
```

**Sửa sai:** `document.getElementById('app')!` — dấu `!` chỉ bịt miệng compiler, chương trình vẫn chết với `TypeError: Cannot set properties of null` nhưng giờ không ai biết vì sao.

---

### TS18048 — 'x' is possibly 'undefined'

Ba nguồn thường gặp:

**a) Truy cập mảng khi bật `noUncheckedIndexedAccess`:**
```ts
const arr = [1, 2, 3];
console.log(arr[0].toFixed(2));
```
```
error TS18048: 'arr[0]' is possibly 'undefined'.
```
Sửa: `arr[0]?.toFixed(2)` hoặc dùng `for...of` (biến lặp luôn chắc chắn có).

**b) Property optional:**
```ts
type User = { phone?: string };
u.phone.length;    // ❌
u.phone?.length ?? 0;   // ✅
```

**c) Narrowing bị mất trong callback:**
```ts
function cb(obj: { s?: string }) {
  if (obj.s) setTimeout(() => console.log(obj.s.length), 10);
}
```
```
error TS18048: 'obj.s' is possibly 'undefined'.
```
Sửa: kéo ra biến `const` trước khi kiểm tra — xem [bài 03](./03-ham-va-narrowing.md).

---

### TS2532 / TS2533 — Object is possibly 'undefined' / 'null'

Cùng bản chất với TS18047/TS18048, chỉ khác chỗ TypeScript không nêu được tên biến (ví dụ kết quả của một biểu thức). Cách sửa như trên.

---

## Nhóm 3 — `unknown` và `any`

### TS18046 — 'e' is of type 'unknown'

```ts
try { await save(); }
catch (e) { console.log(e.message); }
```
```
error TS18046: 'e' is of type 'unknown'.
```

**Nguyên nhân:** JavaScript `throw` được bất cứ thứ gì (`throw 'oops'`, `throw { code: 500 }`), nên TypeScript không dám giả định đó là `Error`.

**Sửa:**
```ts
catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(msg);
}
```

Viết một lần dùng khắp nơi:
```ts
export const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
```

---

### TS7006 — Parameter implicitly has an 'any' type

```ts
const isAdult = u => u.age > 18;
```
```
error TS7006: Parameter 'u' implicitly has an 'any' type.
```

**Nguyên nhân:** không có ngữ cảnh để suy kiểu. Trong `users.filter(u => ...)` thì có, ở đây thì không.

**Sửa:** ghi kiểu — `const isAdult = (u: User) => u.age > 18;`

---

### TS7053 — Element implicitly has an 'any' type... can't be used to index

```ts
const perms = { read: true, write: false };
function can(action: string): boolean { return perms[action]; }
```
```
error TS7053: Element implicitly has an 'any' type because expression of type 'string'
can't be used to index type '{ read: boolean; write: boolean; }'.
  No index signature with a parameter of type 'string' was found on type '{ read: boolean; write: boolean; }'.
```

**Nguyên nhân:** `string` bất kỳ không đảm bảo là key có thật.

**Sửa (đúng):**
```ts
type Action = keyof typeof perms;
function can(action: Action): boolean { return perms[action]; }
can('drop');   // ❌ error TS2345 — bắt được lỗi ngay
```

**Sửa (sai):** `perms[action as keyof typeof perms]` — vẫn cho phép truyền `'drop'` vào và trả `undefined`.

---

## Nhóm 4 — Object và property

### TS2339 — Property does not exist on type

Ba nguyên nhân khác nhau, cùng một mã lỗi:

**a) Gõ nhầm tên** — nếu đủ giống, TypeScript đổi sang TS2551 và gợi ý:
```
error TS2551: Property 'prodcutId' does not exist on type 'OrderItem'. Did you mean 'productId'?
```

**b) Quên `await`:**
```ts
const u = fetchUser(1);
u.name;
```
```
error TS2339: Property 'name' does not exist on type 'Promise<User>'.
```

**c) Truy cập property chỉ có ở một nhánh union:**
```ts
function handle(res: { ok: true; data: User } | { ok: false; error: string }) {
  console.log(res.data);
}
```
```
error TS2339: Property 'data' does not exist on type '{ ok: true; data: User; } | { ok: false; error: string; }'.
  Property 'data' does not exist on type '{ ok: false; error: string; }'.
```
Sửa: kiểm tra `if (res.ok)` trước.

**d) Quên modifier ở parameter property** (rất hay gặp khi viết NestJS):
```ts
class Svc { constructor(repo: Repo) {} find() { return this.repo; } }
```
```
error TS2339: Property 'repo' does not exist on type 'Svc'.
```
Sửa: `constructor(private repo: Repo) {}`

---

### TS2353 / TS2561 — Object literal may only specify known properties

```ts
const u: User = { id: 1, name: 'Sơn', age: 30 };
```
```
error TS2353: Object literal may only specify known properties, and 'age' does not exist in type 'User'.
```

Gõ gần giống thì đổi sang TS2561 và có gợi ý:
```
error TS2561: Object literal may only specify known properties, but 'aut' does not exist in type 'Route'.
Did you mean to write 'auth'?
```

**Nguyên nhân:** excess property check — chỉ áp cho object literal gán trực tiếp. Đi qua biến trung gian thì không báo (structural typing, [bài 02](./02-object-interface-type.md)).

**Sửa:** bỏ field thừa, hoặc thêm nó vào type nếu đúng là cần.

---

### TS2540 — Cannot assign to 'x' because it is a read-only property

```ts
const cfg = { method: 'POST' } as const;
cfg.method = 'GET';
```
```
error TS2540: Cannot assign to 'method' because it is a read-only property.
```

**Nguyên nhân:** `as const` làm mọi field thành `readonly`. Cũng gặp khi class chỉ có getter mà không có setter.

**Sửa:** nếu thật sự cần sửa thì đừng dùng `as const`; nếu chỉ cần literal type thì dùng `satisfies` ([bài 05](./05-utility-va-type-nang-cao.md)).

---

### TS2564 — Property has no initializer and is not definitely assigned

```ts
class User { name: string; }
```
```
error TS2564: Property 'name' has no initializer and is not definitely assigned in the constructor.
```

**Sửa,** chọn theo ý nghĩa thật:
```ts
name: string = '';                    // có mặc định
name?: string;                        // thật sự có thể vắng
name!: string;                        // framework/ORM gán hộ — chỉ dùng khi đúng vậy
constructor(public name: string) {}   // bắt buộc truyền vào
```

---

## Nhóm 5 — Hàm

### TS2554 — Expected N arguments, but got M

```
error TS2554: Expected 1-3 arguments, but got 0.
```

Với overload, thông báo gộp cả khoảng (`1-2`). Nếu nhiều overload cùng nhận đúng số đối số đó mà không cái nào khớp kiểu thì đổi sang **TS2769: No overload matches this call**.

---

### TS2366 / TS7030 — Function lacks ending return statement

```ts
function f(x: number): string {
  if (x > 1) return 'a';
}
```
```
error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

Không khai kiểu trả về mà bật `noImplicitReturns` thì ra **TS7030: Not all code paths return a value.**

**Sửa:** thêm nhánh `return` cuối, hoặc `throw`, hoặc đổi kiểu trả về thành `string | undefined`.

---

### TS1016 — A required parameter cannot follow an optional parameter

```ts
function f(a?: number, b: number) {}
```

**Sửa:** đảo thứ tự, hoặc cho `b` giá trị mặc định.

---

### TS1064 — The return type of an async function must be Promise\<T\>

```ts
async function getUser(id: number): User {}
```
```
error TS1064: The return type of an async function or method must be the global Promise<T> type.
Did you mean to write 'Promise<User>'?
```

---

### TS2775 — Assertions require every name in the call target to have an explicit type annotation

```ts
const assertIsUser = (x: unknown): asserts x is User => { /* ... */ };
assertIsUser(raw);
```

**Sửa:** dùng `function` declaration thay vì arrow gán vào `const`:
```ts
function assertIsUser(x: unknown): asserts x is User { /* ... */ }
```

---

## Nhóm 6 — Class và kế thừa

### TS2420 — Class incorrectly implements interface

```
error TS2420: Class 'BrokenStorage' incorrectly implements interface 'Storage'.
  Property 'load' is missing in type 'BrokenStorage' but required in type 'Storage'.
```

**Sửa:** cài đặt đủ method. Nhớ: `implements` chỉ **kiểm tra**, không tự thêm kiểu cho tham số — vẫn phải tự ghi, không thì dính TS7006.

---

### TS2515 / TS2511 — Abstract class

```
error TS2515: Non-abstract class 'BadRepo' does not implement inherited abstract member findById from class 'BaseRepository<User>'.
error TS2511: Cannot create an instance of an abstract class.
```

---

### TS4114 / TS4113 — override

Chỉ xuất hiện khi bật `noImplicitOverride`.

```
error TS4114: This member must have an 'override' modifier because it overrides a member in the base class 'Base'.
error TS4113: This member cannot have an 'override' modifier because it is not declared in the base class 'Base'.
```

TS4113 là cờ đỏ đáng giá: nó nghĩa là **method ở lớp cha đã bị đổi tên hoặc xoá**, và bản ghi đè của bạn giờ là code chết không ai gọi.

---

### TS2341 — Property is private and only accessible within class

Nhắc lại: `private` **không tồn tại lúc chạy**. `JSON.stringify(obj)` vẫn phơi ra hết. Muốn thật sự riêng tư thì dùng `#field`.

---

## Nhóm 7 — Module và cấu hình

### TS2307 — Cannot find module

```
error TS2307: Cannot find module 'lodash' or its corresponding type declarations.
```

Ba nguyên nhân: chưa `npm i`, thiếu `@types/*`, hoặc sai đường dẫn tương đối.

---

### TS7016 — Could not find a declaration file for module

```
error TS7016: Could not find a declaration file for module 'some-lib'.
'.../node_modules/some-lib/index.js' implicitly has an 'any' type.
```

**Sửa:** `npm i -D @types/some-lib`, hoặc tự viết `.d.ts` — xem [bài 07](./07-thuc-chien-api-va-module.md).

---

### TS2591 — Cannot find name 'process'

```
error TS2591: Cannot find name 'process'. Do you need to install type definitions for node?
Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
```

Đã cài `@types/node` rồi vẫn gặp? Đọc kỹ nửa sau thông báo: thêm `"types": ["node"]` vào `tsconfig.json`.

---

### TS2835 — Relative import paths need explicit file extensions

```
error TS2835: Relative import paths need explicit file extensions in ECMAScript imports
when '--moduleResolution' is 'node16' or 'nodenext'. Did you mean './math.js'?
```

**Sửa:** ghi `./math.js` (đuôi của file **sau khi build**, dù file nguồn là `.ts`).

---

### TS1484 / TS1287 — verbatimModuleSyntax

```
error TS1484: 'User' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled.
```
Sửa: `import type { User } from './types.js';`

```
error TS1287: A top-level 'export' modifier cannot be used on value declarations in a CommonJS module
when 'verbatimModuleSyntax' is enabled.
```
Sửa: thêm `"type": "module"` vào `package.json`.

---

### TS5108 / TS5102 — Option has been removed

```
error TS5108: Option 'target=ES5' has been removed. Please remove it from your configuration.
error TS5102: Option 'outFile' has been removed. Please remove it from your configuration.
```

TypeScript 7 gỡ bỏ nhiều option cũ. `target` dùng `ES2015+`, `moduleResolution` dùng `nodenext`/`bundler`, `outFile` thay bằng `outDir`.

---

### TS1239 — Parameter decorator

```
error TS1239: Unable to resolve signature of parameter decorator when called as an expression.
```

**Nguyên nhân:** thiếu `experimentalDecorators`. Decorator chuẩn ES của TypeScript 5+ không hỗ trợ parameter decorator, mà NestJS thì dùng `@Body()`, `@Inject()` khắp nơi.

**Sửa:** bật `experimentalDecorators` + `emitDecoratorMetadata` trong `tsconfig.json`.

---

## Nhóm 8 — Lỗi không phải của TypeScript

Đây là những lỗi **runtime** mà `tsc` không hề báo. Biết trước để không mất buổi chiều đi tìm.

### `Cannot read properties of undefined` dù kiểu nói là có

```ts
const u: User = await res.json();
u.name.toUpperCase();
```
```
TypeError: Cannot read properties of undefined (reading 'toUpperCase')
```

**Nguyên nhân:** kiểu bị xoá khi biên dịch, `res.json()` trả `any`, TypeScript tin lời bạn.

**Sửa:** validate ở biên bằng Zod — [bài 07](./07-thuc-chien-api-va-module.md).

---

### `Nest can't resolve dependencies of the XService (?)`

**Nguyên nhân, theo thứ tự khả năng:**
1. Thiếu `emitDecoratorMetadata` trong `tsconfig.json`.
2. Class thiếu `@Injectable()` → không có decorator thì metadata không được ghi.
3. Provider chưa khai trong `providers` của module.
4. Đang inject một **interface** — interface bị xoá hoàn toàn, không có gì để ghi vào metadata. Sửa bằng token: `@Inject(TOKEN)`.

---

### `ReferenceError: Cannot access 'x' before initialization`

**Nguyên nhân:** import vòng giữa hai module. `tsc` không báo gì.

**Sửa:** đổi một chiều thành `import type` (bị xoá lúc build nên vòng lặp biến mất), hoặc tách phần dùng chung ra module thứ ba.

---

### `SyntaxError: TypeScript enum is not supported in strip-only mode`

**Nguyên nhân:** chạy `node --experimental-strip-types` với code có `enum`, `namespace`, hoặc parameter property (`constructor(private x: T) {}`).

**Sửa:** dùng `tsx`, hoặc thêm `--experimental-transform-types`, hoặc bỏ `enum` chuyển sang union + `as const` ([bài 01](./01-kieu-co-ban.md)).

---

### Method mất `this` khi truyền làm callback

```ts
setTimeout(counter.inc, 100);
```
```
TypeError: Cannot read properties of undefined (reading 'count')
```

TypeScript **không** bắt được mặc định.

**Sửa:** dùng arrow property `inc = () => {...}`, hoặc khai `inc(this: Counter)` để compiler bắt được (TS2684).

---

## Bảng tra nhanh

| Mã | Ý nghĩa ngắn gọn | Hay gặp khi |
|---|---|---|
| TS2322 | Gán sai kiểu | literal, intersection xung đột |
| TS2345 | Đối số sai kiểu | quên `as const` |
| TS2339 | Không có property đó | gõ nhầm, quên `await`, union, quên `private` |
| TS2551 | Không có property — có gợi ý | gõ nhầm tên |
| TS2353 | Object literal thừa field | excess property check |
| TS2561 | Thừa field — có gợi ý | gõ nhầm tên field |
| TS2540 | Ghi vào `readonly` | `as const`, getter không setter |
| TS2564 | Field class chưa khởi tạo | `strictPropertyInitialization` |
| TS2741 | Thiếu field bắt buộc | quên field, `Record` thiếu nhánh |
| TS2820 | Sai literal — có gợi ý | gõ nhầm giá trị union |
| TS7006 | Tham số ngầm `any` | callback tách rời |
| TS7053 | Index bằng `string` tuỳ ý | thiếu `keyof` |
| TS18046 | `unknown` chưa thu hẹp | `catch (e)` |
| TS18047 | Có thể `null` | DOM, hàm trả `T \| null` |
| TS18048 | Có thể `undefined` | `noUncheckedIndexedAccess`, `?:` |
| TS2591 | Không tìm thấy `process` | thiếu `"types": ["node"]` |
| TS2835 | Thiếu đuôi `.js` khi import | ESM + `nodenext` |
| TS5108 | Option đã bị gỡ bỏ | mở project cũ bằng TypeScript 7 |

---

## Bài tập

1. Tạo một file cố tình chứa 5 lỗi khác nhau trong bảng trên. Chạy `npx tsc --noEmit`, đối chiếu mã lỗi, rồi sửa từng cái theo cách **đúng** (không dùng `any`, không dùng `!`).
2. Trong project `ts-lab`, bật lần lượt `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`. Mỗi lần ghi lại số lỗi mới và sửa hết.
3. Tự tái hiện lỗi `ReferenceError: Cannot access 'x' before initialization` bằng hai file import vòng, rồi sửa bằng `import type`.
4. Viết một hàm nhận dữ liệu từ `JSON.parse` và trả về `User`, sao cho **mọi** dữ liệu sai đều bị chặn tại biên với thông báo chỉ rõ field nào hỏng.

---

Tiếp theo 👉 [10-cheatsheet.md](./10-cheatsheet.md)
