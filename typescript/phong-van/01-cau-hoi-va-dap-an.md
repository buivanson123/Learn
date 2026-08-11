# 45 câu hỏi phỏng vấn TypeScript + đáp án

Che đáp án, tự trả lời thành tiếng trước. ⭐ = câu rất hay gặp.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--nền-tảng) | Nền tảng | 8 |
| [B](#b--type-vs-interface-và-object) | `type` vs `interface`, object | 7 |
| [C](#c--narrowing-và-type-guard) | Narrowing, type guard | 7 |
| [D](#d--generic) | Generic | 7 |
| [E](#e--utility-type-và-type-nâng-cao) | Utility type, type nâng cao | 8 |
| [F](#f--thực-chiến) | Thực chiến: API, config, dự án | 8 |

---

## A — Nền tảng

### A1 ⭐ TypeScript giúp được gì? Nó có bắt lỗi lúc chạy không?

**Ngắn:** Không. Trình biên dịch **xoá sạch kiểu** rồi trả về JavaScript thuần. Nó bắt lỗi lúc bạn gõ
code, không bắt gì lúc chạy.

**Đào sâu:** Chứng minh được ngay:

```bash
$ npx tsc src/demo.ts --outFile out.js && cat out.js
```
```js
function greet(u) {                 // interface User biến mất sạch
    return "Xin chào " + u.name;
}
```

Hệ quả trực tiếp và quan trọng: dữ liệu từ `fetch()`, `JSON.parse()`, `req.body` **không được kiểm
tra**. Khai `const u: User = await res.json()` thì TS tin bạn, còn API trả gì thì trời biết. Đó là lý
do phải validate ở biên bằng Zod — xem [D2](#d2--dữ-liệu-từ-api-có-kiểu-chưa).

Đây là câu hỏi hay được dùng để lọc: ai trả lời "nó bắt lỗi runtime" là chưa hiểu bản chất.

### A2 ⭐ `any` khác `unknown` chỗ nào? Khi nào dùng cái nào?

**Ngắn:** `any` tắt hoàn toàn kiểm tra kiểu; `unknown` cũng nhận mọi giá trị nhưng **bắt bạn kiểm tra
trước khi dùng**.

**Đào sâu:**

```ts
let a: any = JSON.parse(s);
a.foo.bar.baz();          // ✅ không lỗi lúc gõ, 💥 lúc chạy

let u: unknown = JSON.parse(s);
u.foo;                    // ❌ error TS18046: 'u' is of type 'unknown'
if (typeof u === 'object' && u !== null && 'foo' in u) { /* dùng được */ }
```

Quy tắc: **mọi chỗ định viết `any` thì viết `unknown` trước**, rồi thu hẹp. `any` chỉ dùng khi đang di
trú code JS cũ và cần tạm bỏ qua.

`any` còn nguy hiểm ở chỗ nó **lây lan**: gán `any` vào biến khác thì biến đó cũng mất kiểm tra.

### A3 `never` là gì? Khi nào gặp nó?

**Ngắn:** Là kiểu **không có giá trị nào** thuộc về. Gặp ở hàm không bao giờ trả về, và ở nhánh mà TS
đã loại trừ hết khả năng.

**Đào sâu:** Ứng dụng thực tế nhất là **kiểm tra vét cạn**:

```ts
type Status = 'draft' | 'published' | 'archived';

function label(s: Status): string {
  switch (s) {
    case 'draft':     return 'Bản nháp';
    case 'published': return 'Đã đăng';
    default:
      const _exhaustive: never = s;    // ❌ lỗi vì còn 'archived' chưa xử lý
      throw new Error(`Chưa xử lý: ${s}`);
  }
}
```

Thêm giá trị mới vào `Status` thì dòng `never` báo lỗi ngay — bạn không thể quên cập nhật `switch`.
Đây là ví dụ nên kể khi được hỏi "TypeScript giúp gì cho bạn trong thực tế".

### A4 `void` khác `undefined` chỗ nào?

**Ngắn:** `void` nghĩa là "đừng quan tâm giá trị trả về"; `undefined` là một giá trị cụ thể.

**Đào sâu:** Hàm khai trả `void` vẫn gán được vào chỗ đòi hàm trả giá trị khác — đó là chủ ý, để
`array.forEach(x => arr.push(x))` không báo lỗi dù `push` trả `number`.

### A5 Kiểu được suy ra khi nào? Khi nào phải ghi tay?

**Ngắn:** TS tự suy từ giá trị. Chỉ ghi tay ở nơi nó không đoán được: **tham số hàm**, **dữ liệu từ bên
ngoài**, và **giá trị trả về của API công khai**.

**Đào sâu:**

```ts
const n = 5;                     // n: 5 — đủ, đừng viết `const n: number = 5`
const arr = [1, 2, 3];           // number[]
const m = new Map<string, number>();   // ← chỗ này phải ghi

function double(x) { }           // ❌ TS7006: Parameter 'x' implicitly has an 'any' type
```

Ghi kiểu thừa làm code khó đọc và khó refactor hơn — đổi kiểu thật thì phải sửa hai chỗ.

### A6 `as const` làm gì?

**Ngắn:** Khoá giá trị thành literal và `readonly`, thay vì bị nới rộng thành kiểu chung.

**Đào sâu:**

```ts
const a = ['draft', 'published'];              // string[]
const b = ['draft', 'published'] as const;     // readonly ["draft", "published"]

type Status = typeof b[number];                // 'draft' | 'published'
```

Đây là cách tạo union từ mảng — dùng thay `enum`, vì `enum` sinh code runtime còn cách này thì không.

### A7 Vì sao nên dùng union + `as const` thay `enum`?

**Ngắn:** `enum` sinh ra object thật lúc chạy; union literal biến mất hoàn toàn khi biên dịch.

**Đào sâu:** `const enum` thì không sinh code nhưng gây rắc rối khi build riêng từng file
(`isolatedModules`). Union literal đơn giản hơn, so sánh trực tiếp với chuỗi được, và làm việc tốt với
JSON.

Ngoại lệ: nếu dự án dùng NestJS + TypeORM và cần enum ánh xạ xuống cột database thì `enum` tiện hơn.

### A8 ⭐ Vì sao dự án cũ không build được trên TypeScript 7?

**Ngắn:** Bản 7 (viết lại bằng Go) **gỡ bỏ** vài tuỳ chọn cũ.

**Đào sâu:** Ba cái hay gặp nhất, đo thật:

| Tuỳ chọn | Lỗi |
|----------|-----|
| `target: ES5` | `TS5108` — đã bị gỡ |
| `moduleResolution: node` / `node10` / `classic` | `TS5108` — đã bị gỡ |
| `outFile` | `TS5102` — đã bị gỡ |

Và bản 7 **không tự nạp `@types/node`** — cài rồi vẫn báo `TS2591: Cannot find name 'process'`, phải
thêm `"types": ["node"]` vào `tsconfig.json`. Đây là bẫy hay gặp nhất khi dựng project mới.

---

## B — `type` vs `interface` và object

### B1 ⭐⭐ `type` khác `interface` chỗ nào?

**Ngắn:** Khác biệt **quan trọng nhất** là `interface` **gộp được** khi khai trùng tên, `type` thì
không.

**Đào sâu:**

```ts
interface Box { width: number; }
interface Box { height: number; }
const b: Box = { width: 1, height: 2 };   // ✅ cần cả hai
```

```ts
type Card = { a: number };
type Card = { b: number };
```
```
error TS2300: Duplicate identifier 'Card'.
```

Đó là lý do mở rộng `Window`, `ProcessEnv`, hay `Request` của Express **bắt buộc** dùng `interface`.

Ngược lại, `type` làm được những thứ `interface` không: union, tuple, mapped type, conditional type.

Quy tắc: **`interface` cho hình dạng công khai, `type` cho mọi thứ còn lại.**

> Trả lời "interface cho object, type cho union" là đúng nhưng hời hợt — người phỏng vấn thường hỏi
> tiếp "còn gì nữa không". Declaration merging mới là câu trả lời họ chờ.

### B2 ⭐ TypeScript so sánh kiểu theo tên hay theo hình dạng?

**Ngắn:** Theo **hình dạng** — structural typing.

**Đào sâu:**

```ts
interface Storage { save(k: string, v: string): void; }

class FileStorage {                     // KHÔNG có implements
  save(k: string, v: string) {}
}

const s: Storage = new FileStorage();   // ✅ hợp lệ
```

`implements` chỉ là lời nhắc cho chính bạn, không tạo quan hệ kiểu.

Hệ quả xấu: `type UserId = string` và `type PostId = string` **lẫn nhau được**. Chặn bằng branded
type — xem [E8](#e8-làm-sao-chặn-truyền-nhầm-hai-id-cùng-là-string).

### B3 ⭐ Vì sao gán object có field thừa lúc lỗi lúc không?

**Ngắn:** Excess property check chỉ áp cho **object literal gán trực tiếp**.

**Đào sâu:**

```ts
const u1: User = { id: 1, name: 'Sơn', age: 30 };
// error TS2353: Object literal may only specify known properties, and 'age' does not exist in type 'User'.

const raw = { id: 1, name: 'Sơn', age: 30 };
const u2: User = raw;        // ✅ không lỗi
```

Không phải bug. Field thừa trên literal gần như luôn là gõ nhầm tên nên TS chặn; qua biến trung gian
thì đó là structural typing bình thường.

### B4 `?` khác `| undefined` chỗ nào?

**Ngắn:** `?` cho phép **vắng mặt** khoá; `| undefined` bắt buộc phải có khoá, giá trị mới được `undefined`.

**Đào sâu:**

```ts
interface A { x?: number }
interface B { x: number | undefined }

const a: A = {};              // ✅
const b: B = {};              // ❌ Property 'x' is missing
const b2: B = { x: undefined }; // ✅
```

Với `exactOptionalPropertyTypes` bật thì `{ x: undefined }` **không** gán được vào `A` — hai thứ tách
bạch hẳn.

### B5 `readonly` có thật sự bất biến không?

**Ngắn:** Không. Nó chỉ chặn lúc biên dịch, và chỉ ở **tầng ngoài cùng**.

**Đào sâu:**

```ts
interface Config { readonly db: { host: string } }
const c: Config = { db: { host: 'a' } };

c.db = { host: 'b' };      // ❌ lỗi
c.db.host = 'b';           // ✅ KHÔNG lỗi — chỉ nông một tầng
```

Muốn sâu thì cần `DeepReadonly` tự viết hoặc `Object.freeze` (thật sự bất biến lúc chạy).

### B6 Index signature là gì? Bẫy của nó?

**Ngắn:** `{ [k: string]: T }` cho phép khoá bất kỳ. Bẫy là TS tin mọi khoá đều tồn tại.

**Đào sâu:**

```ts
const map: Record<string, number> = { a: 1 };
const v = map.khongCo;      // kiểu number, nhưng thực tế là undefined
v.toFixed(2);               // 💥 runtime
```

Sửa bằng cờ `noUncheckedIndexedAccess`: khi đó `v` có kiểu `number | undefined` và TS bắt bạn kiểm tra.
Nên bật cờ này ở dự án mới.

### B7 `Record<K, V>` khác `{ [k: K]: V }` chỗ nào?

**Ngắn:** `Record` với union khoá tạo ra **các khoá bắt buộc**; index signature thì không.

**Đào sâu:**

```ts
type A = Record<'vi' | 'en', string>;
const a: A = { vi: 'x' };        // ❌ thiếu 'en'

type B = { [k: string]: string };
const b: B = {};                 // ✅
```

`Record` với union là cách bắt bạn xử lý đủ mọi trường hợp — hữu ích cho bảng dịch, bảng nhãn trạng thái.

---

## C — Narrowing và type guard

### C1 ⭐ Narrowing là gì? Kể vài cách.

**Ngắn:** Là việc TS thu hẹp kiểu của một biến dựa vào điều kiện bạn viết.

**Đào sâu:**

```ts
typeof v === 'string'          // typeof guard
v instanceof Date              // instanceof
'name' in obj                  // in operator
Array.isArray(v)
v !== null && v !== undefined  // truthiness
obj.kind === 'circle'          // discriminated union
```

### C2 ⭐ Discriminated union là gì? Vì sao nên dùng?

**Ngắn:** Là union các object có chung một field literal để phân biệt.

**Đào sâu:**

```ts
type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: string };

function handle(r: Result<User>) {
  if (r.ok) {
    r.data;        // ✅ TS biết có data
  } else {
    r.error;       // ✅ TS biết có error
  }
}
```

Ưu điểm so với `{ data?: T; error?: string }`: không thể rơi vào trạng thái vô nghĩa (vừa có data vừa
có error, hoặc không có gì).

Đây là mẫu em dùng thay `throw` cho lỗi nghiệp vụ — hàm trả `Result` thì người gọi **bắt buộc** xử lý
nhánh lỗi, còn `throw` thì họ quên `try/catch` là xong.

### C3 `x is T` khác `asserts x is T`?

**Ngắn:** Cái đầu trả `boolean` và thu hẹp trong nhánh `if`; cái sau ném lỗi và thu hẹp cho **mọi dòng
phía sau**.

**Đào sâu:**

```ts
function isString(x: unknown): x is string { return typeof x === 'string'; }
function assertString(x: unknown): asserts x is string {
  if (typeof x !== 'string') throw new Error('x');
}

if (isString(v)) { v.toUpperCase(); }   // chỉ trong if

assertString(v);
v.toUpperCase();                        // từ đây trở đi
```

⚠️ Bẫy: gán assertion function vào biến thì hỏng —
```
error TS2775: Assertions require every name in the call target to be declared with an explicit type annotation.
```

### C4 Type predicate có nguy hiểm không?

**Ngắn:** Có. TS **tin** bạn, không kiểm tra thân hàm có đúng không.

**Đào sâu:**

```ts
function isUser(x: unknown): x is User {
  return true;              // nói dối — TS vẫn tin
}
```

Nên với dữ liệu ngoài, dùng Zod thay vì tự viết type predicate. Zod vừa kiểm tra thật lúc chạy vừa suy
ra kiểu.

### C5 Optional chaining và nullish coalescing khác gì `&&`/`||`?

**Ngắn:** `?.` và `??` chỉ phản ứng với `null`/`undefined`, không phản ứng với `0`, `''`, `false`.

**Đào sâu:**

```ts
const port = config.port || 3000;    // ❌ port = 0 sẽ thành 3000
const port = config.port ?? 3000;    // ✅ chỉ null/undefined mới lấy mặc định
```

Lỗi kinh điển với số 0 và chuỗi rỗng.

### C6 Vì sao narrowing "mất" sau khi gọi hàm khác?

**Ngắn:** Vì TS không biết hàm đó có sửa biến không — với biến `let` hoặc property của object.

**Đào sâu:**

```ts
if (obj.name !== undefined) {
  doSomething();
  obj.name.toUpperCase();     // ❌ có thể mất narrowing
}
```

Sửa: gán ra biến `const` cục bộ trước.

```ts
const name = obj.name;
if (name !== undefined) { doSomething(); name.toUpperCase(); }   // ✅
```

### C7 `satisfies` khác `as` chỗ nào?

**Ngắn:** `as` **ép** kiểu (TS im lặng tin bạn); `satisfies` **kiểm tra** giá trị có thoả kiểu không mà
vẫn giữ kiểu suy ra chi tiết.

**Đào sâu:**

```ts
const routes = {
  home: '/',
  post: '/posts/:id',
} satisfies Record<string, string>;

routes.home;      // kiểu '/' — giữ literal
```

Nếu dùng `: Record<string, string>` thì `routes.home` chỉ còn kiểu `string`. Nếu dùng `as` thì không
kiểm tra gì cả.

Quy tắc: **`satisfies` thay cho `as` ở mọi chỗ có thể.**

---

## D — Generic

### D1 ⭐ Generic để làm gì? Cho ví dụ.

**Ngắn:** Để viết code dùng lại được cho nhiều kiểu mà **không mất thông tin kiểu**.

**Đào sâu:**

```ts
function first<T>(arr: T[]): T | undefined { return arr[0]; }

first([1, 2, 3]);        // number | undefined
first(['a', 'b']);       // string | undefined
```

So với `any[]`: `any` trả về `any`, mất hết kiểu ở phía sau.

### D2 ⭐⭐ Dữ liệu từ API có kiểu chưa?

**Ngắn:** **Chưa.** `as User` chỉ là lời hứa với trình biên dịch, không kiểm tra gì lúc chạy.

**Đào sâu:** Đây là câu hỏi quan trọng nhất nhóm này.

```ts
const u = await res.json() as User;   // TS tin bạn
u.name.toUpperCase();                 // 💥 nếu API đổi field
```

Cách đúng — validate ở **biên**, rồi để `z.infer` làm nguồn sự thật cho kiểu:

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.email(),                   // Zod 4: z.email(), KHÔNG phải z.string().email()
});

type User = z.infer<typeof UserSchema>;   // kiểu sinh ra TỪ schema

const u = UserSchema.parse(await res.json());   // ném lỗi nếu sai
```

Nhờ vậy chỉ có **một** nguồn sự thật. Sửa schema thì kiểu tự đổi theo.

### D3 Ràng buộc generic bằng `extends` để làm gì?

**Ngắn:** Để dùng được thuộc tính của `T` bên trong hàm.

**Đào sâu:**

```ts
function len<T>(x: T) { return x.length; }             // ❌ T có thể không có length
function len<T extends { length: number }>(x: T) { return x.length; }   // ✅
```

### D4 `keyof` và indexed access dùng khi nào?

**Ngắn:** Để lấy khoá và kiểu giá trị tương ứng — viết hàm truy cập an toàn.

**Đào sâu:**

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const u = { id: 1, name: 'Sơn' };
get(u, 'name');       // string
get(u, 'khongCo');    // ❌ lỗi lúc gõ
```

### D5 `typeof` ở tầng kiểu khác `typeof` lúc chạy thế nào?

**Ngắn:** Cùng từ khoá, hai ngữ cảnh khác nhau. Trong ngữ cảnh kiểu, nó lấy **kiểu của một giá trị**.

**Đào sâu:**

```ts
const config = { host: 'localhost', port: 5432 };
type Config = typeof config;         // { host: string; port: number }
```

Hay dùng với `as const` để sinh union: `type Status = typeof STATUSES[number]`.

### D6 Generic mặc định và suy luận từ đối số?

**Ngắn:** `<T = string>` đặt mặc định; TS thường tự suy `T` từ đối số nên bạn hiếm khi phải ghi.

**Đào sâu:** Ghi tường minh khi TS suy sai hoặc suy quá rộng:

```ts
const s = new Set([1, 2]);              // Set<number>
const s2 = new Set<number | string>([1]); // cần ghi vì muốn rộng hơn
```

### D7 Generic trong React/hook thường gặp ở đâu?

**Ngắn:** `useState<T>`, `useRef<T>`, và component nhận `props` generic.

**Đào sâu:**

```ts
const [user, setUser] = useState<User | null>(null);   // phải ghi, nếu không TS suy ra null
```

Đây là chỗ hay bị hỏi khi phỏng vấn React + TS.

---

## E — Utility type và type nâng cao

### E1 ⭐ Kể vài utility type bạn hay dùng.

**Ngắn:** `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Readonly`, `ReturnType`, `Awaited`.

**Đào sâu:** Ví dụ thực tế nên kể:

```ts
type CreateUserDto = Omit<User, 'id' | 'createdAt'>;
type UpdateUserDto = Partial<CreateUserDto>;
```

⭐ Thứ tự quan trọng: **`Omit` trước rồi mới `Partial`**. Làm ngược lại thì `id` vẫn còn (chỉ thành
optional) và người dùng gửi `id` lên sửa được.

### E2 `Pick` khác `Omit` chỗ nào? Cái nào an toàn hơn?

**Ngắn:** `Pick` là danh sách trắng, `Omit` là danh sách đen. `Pick` an toàn hơn.

**Đào sâu:** Thêm cột `passwordHash` vào `User`: dùng `Pick` thì DTO không đổi; dùng `Omit` thì cột mới
**tự động lọt vào** DTO. Với dữ liệu trả ra ngoài, luôn ưu tiên `Pick`.

### E3 Mapped type là gì?

**Ngắn:** Là cách sinh kiểu mới bằng cách duyệt qua khoá của kiểu cũ.

**Đào sâu:**

```ts
type Nullable<T> = { [K in keyof T]: T[K] | null };
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
```

Cái thứ hai dùng **key remapping** + template literal type — sinh ra `getId()`, `getName()`.

### E4 Conditional type và `infer`?

**Ngắn:** `T extends U ? X : Y` — chọn kiểu theo điều kiện. `infer` bắt lấy một phần kiểu.

**Đào sâu:**

```ts
type ElementOf<T> = T extends (infer U)[] ? U : never;
type A = ElementOf<string[]>;      // string

type Unwrap<T> = T extends Promise<infer U> ? U : T;
```

Đây là cách `ReturnType` và `Awaited` được cài đặt.

### E5 ⭐ Declaration merging là gì, dùng khi nào?

**Ngắn:** Hai `interface` cùng tên được gộp lại. Dùng để **mở rộng kiểu của thư viện bên thứ ba**.

**Đào sâu:**

```ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}
export {};
```

Từ đó `process.env.NODE_ENV` có ba giá trị gợi ý thay vì `string | undefined`.

`type` **không** làm được việc này — đó là lý do thật sự để phân biệt hai từ khoá.

### E6 Mảng trong TypeScript có an toàn kiểu không?

**Ngắn:** Không hoàn toàn — mảng là **covariant**, và điều đó không sound.

**Đào sâu:**

```ts
class Animal { name = 'x'; }
class Dog extends Animal { bark() {} }

let animals: Animal[] = [];
let dogs: Dog[] = [new Dog()];

animals = dogs;              // ✅ TS cho phép
animals.push(new Animal());  // ✅ giờ dogs chứa Animal không có bark()
```

Chạy thật: **không lỗi nào**. TypeScript cố ý chấp nhận để đổi lấy tính thực dụng — cấm nó đi sẽ làm
rất nhiều code JS hợp lệ bị báo lỗi.

Tránh bằng `readonly T[]` khi chỉ đọc:
```
error TS2339: Property 'push' does not exist on type 'readonly Animal[]'.
```

### E7 `strictFunctionTypes` làm gì?

**Ngắn:** Bắt tham số hàm phải **contravariant**.

**Đào sâu:**

```ts
type HandlerAnimal = (a: Animal) => void;
type HandlerDog = (d: Dog) => void;

let x: HandlerDog = hAnimal;    // ✅ nhận cha thì nhận con được
let y: HandlerAnimal = hDog;    // ❌ error TS2322
```

Logic: chỗ cần "hàm xử lý mọi Animal" mà đưa "hàm chỉ xử lý Dog" là không an toàn — người ta có thể
truyền `Cat` vào.

### E8 Làm sao chặn truyền nhầm hai id cùng là `string`?

**Ngắn:** Branded type — giao `string` với một field nhãn chỉ tồn tại ở tầng kiểu.

**Đào sâu:**

```ts
type UserId = string & { readonly __brand: 'UserId' };
type PostId = string & { readonly __brand: 'PostId' };

function userId(raw: string): UserId {
  if (raw === '') throw new Error('id rỗng');
  return raw as UserId;              // ép kiểu ở ĐÚNG MỘT chỗ
}

getUser('p1' as PostId);
// error TS2345: Argument of type 'PostId' is not assignable to parameter of type 'UserId'.
```

`__brand` biến mất hoàn toàn khi biên dịch. Dùng cho id các bảng khác nhau, đơn vị đo, giá trị đã kiểm
chứng (`EmailDaXacMinh`).

---

## F — Thực chiến

### F1 ⭐ `tsconfig.json` bạn hay bật cờ gì?

**Ngắn:** `strict` là bắt buộc. Ngoài ra em bật `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noUnusedLocals`.

**Đào sâu:** `strict` gộp 8 cờ, quan trọng nhất là `strictNullChecks` — nó là thứ ngăn `Cannot read
properties of undefined`.

`noUncheckedIndexedAccess` là cờ đáng bật nhất nhưng không nằm trong `strict`: nó khiến `arr[0]` có kiểu
`T | undefined`, phản ánh đúng thực tế.

### F2 Xử lý lỗi trong `catch` thế nào cho đúng kiểu?

**Ngắn:** Từ TS 4.4, `catch (e)` có kiểu `unknown`, phải thu hẹp trước khi dùng.

**Đào sâu:**

```ts
try { ... } catch (e) {
  if (e instanceof Error) console.error(e.message);
  else console.error(String(e));
}
```

Vì JavaScript `throw` được bất cứ thứ gì, không chỉ `Error`.

### F3 `.d.ts` để làm gì?

**Ngắn:** Khai báo kiểu cho code JavaScript không có kiểu.

**Đào sâu:** Ba tình huống: thư viện không kèm type (cài `@types/x`), file tài nguyên (`*.svg`), và
biến global tự thêm.

```ts
// types/images.d.ts
declare module '*.svg' {
  const content: string;
  export default content;
}
```

### F4 Khác nhau giữa `import type` và `import`?

**Ngắn:** `import type` chỉ nhập kiểu và **bị xoá hoàn toàn** khi biên dịch.

**Đào sâu:** Quan trọng khi dùng `isolatedModules` hoặc bundler — tránh nhập nhầm cả module runtime chỉ
để lấy một kiểu, và tránh circular import.

```ts
import type { User } from './user';        // chỉ kiểu
import { createUser } from './user';        // có runtime
```

### F5 ⭐ Bạn xử lý config/env thế nào cho type-safe?

**Ngắn:** Validate một lần lúc khởi động bằng Zod, rồi export object đã có kiểu.

**Đào sâu:**

```ts
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),      // Zod 4: coerce cho biến env luôn là string
  DATABASE_URL: z.url(),
});

export const env = EnvSchema.parse(process.env);
```

Ứng dụng **chết ngay lúc khởi động** nếu thiếu biến, thay vì chết lúc 2h sáng khi có request đầu tiên
chạm vào biến đó. Đây là ví dụ tốt để kể trong phỏng vấn.

### F6 Generic trong hàm gọi API — viết thế nào?

**Ngắn:** Nhận schema, trả kiểu suy từ schema.

**Đào sâu:**

```ts
async function apiGet<S extends z.ZodType>(url: string, schema: S): Promise<z.infer<S>> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return schema.parse(await res.json());
}

const user = await apiGet('/api/users/1', UserSchema);   // user: User
```

Một hàm dùng cho mọi endpoint, kiểu luôn đúng, và dữ liệu được kiểm tra thật.

### F7 Khi nào bạn chấp nhận dùng `any`?

**Ngắn:** Gần như không. Khi bắt buộc thì khoanh vùng nhỏ nhất có thể và ghi comment lý do.

**Đào sâu:** Trả lời "em không bao giờ dùng `any`" nghe không thật. Trả lời tốt hơn:

> "Em ưu tiên `unknown` rồi thu hẹp. `any` em chỉ dùng khi di trú code JS cũ và có deadline, và luôn
> kèm `// TODO` để quay lại. Em cũng bật `noImplicitAny` để không vô tình có `any`."

### F8 Bạn từng gặp lỗi TypeScript nào khó nhất?

Đây là câu kể chuyện. Vài ví dụ tốt:

- **`Cannot find name 'process'` dù đã cài `@types/node`** — TypeScript 7 không tự nạp nữa, phải thêm
  `"types": ["node"]`.
- **Dự án cũ không build trên TS 7** — `moduleResolution: node` bị gỡ (TS5108).
- **`as User` trên response API rồi production nổ** vì backend đổi tên field — sau đó chuyển sang Zod
  validate ở biên.

Câu thứ ba là câu kể tốt nhất vì nó dẫn tới một **thay đổi cách làm**, không chỉ một lần sửa lỗi.

---

## Bài tập viết code trên giấy

Phỏng vấn TypeScript hay kèm "viết thử cho tôi xem". Tập gõ sáu bài này không nhìn tài liệu:

1. Viết `Result<T, E>` dạng discriminated union và một hàm dùng nó.
2. Viết `type DeepPartial<T>` (đệ quy).
3. Viết `ElementOf<T>` dùng `infer`.
4. Viết hàm `pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>`.
5. Viết branded type `Email` với hàm tạo có validate.
6. Viết `CreateDto` và `UpdateDto` từ một entity, đúng thứ tự `Omit` rồi `Partial`.

<details>
<summary>Gợi ý đáp án bài 2 và 4</summary>

```ts
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}
```

</details>

---

Tiếp theo: [02-tu-kiem-tra.md](./02-tu-kiem-tra.md)
