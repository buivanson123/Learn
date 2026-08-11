# Bài 3 — Hàm và thu hẹp kiểu (narrowing)

Narrowing là kỹ năng cốt lõi: TypeScript **đọc luồng điều khiển** của bạn và tự động biết kiểu ở từng nhánh. Hiểu nó thì hết cảnh phải rải `as` khắp nơi.

---

## 1. Kiểu cho hàm

```ts
function add(a: number, b: number): number {
  return a + b;
}
```

Kiểu trả về **có thể bỏ** — TS tự suy ra. Nhưng ghi ra vẫn có lợi cho hàm public: lỗi hiện ở đúng chỗ định nghĩa thay vì ở chỗ gọi.

```ts
// Không ghi kiểu trả về
function getUser(id: number) {
  if (id < 0) return null;
  return { id, name: 'Sơn' };
}
// suy ra: { id: number; name: string } | null

// Lỡ tay return sai
function getUser(id: number) {
  if (id < 0) return null;
  return { id, nmae: 'Sơn' };     // gõ nhầm
}
const u = getUser(1);
console.log(u?.name);
```
```
error TS2339: Property 'name' does not exist on type '{ id: number; nmae: string; }'.
```
Lỗi hiện ở **chỗ gọi**, cách xa nguyên nhân. Ghi kiểu trả về thì lỗi hiện ngay tại hàm:

```ts
function getUser(id: number): User | null {
  if (id < 0) return null;
  return { id, nmae: 'Sơn' };
}
```
```
error TS2353: Object literal may only specify known properties, and 'nmae' does not exist in type 'User'.
```

Quy tắc dùng được: **ghi kiểu trả về cho hàm export**, bỏ qua cho hàm nội bộ ngắn.

### Tham số tuỳ chọn, mặc định, rest

```ts
function greet(name: string, greeting = 'Xin chào', punct?: string): string {
  return `${greeting} ${name}${punct ?? '!'}`;
}

function sum(...nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
```

Tham số optional phải nằm sau tham số bắt buộc:

```ts
function f(a?: number, b: number) {}
```
```
error TS1016: A required parameter cannot follow an optional parameter.
```

Gọi thiếu/thừa đều bị bắt:

```ts
greet();
```
```
error TS2554: Expected 1-3 arguments, but got 0.
```

### Kiểu của chính cái hàm

```ts
type Handler = (req: Request, res: Response) => void;
type Comparator<T> = (a: T, b: T) => number;
type AsyncFn<T> = () => Promise<T>;

const byAge: Comparator<User> = (a, b) => a.age - b.age;
//                               ↑ a, b tự có kiểu User — không cần ghi lại
```

Đây gọi là **contextual typing**: khi vế trái đã có kiểu, TS suy ngược cho tham số ở vế phải. Đó là lý do bạn không phải ghi kiểu trong callback:

```ts
const users: User[] = [];
users.filter(u => u.age > 18);         // u: User
users.map(u => u.name.toUpperCase());  // u: User
```

Nhưng khi tách callback ra ngoài thì mất ngữ cảnh:

```ts
const isAdult = u => u.age > 18;
```
```
error TS7006: Parameter 'u' implicitly has an 'any' type.
```
```ts
const isAdult = (u: User) => u.age > 18;   // ✅
```

### Hàm `async`

```ts
async function fetchUser(id: number): Promise<User> {
  const res = await fetch(`/users/${id}`);
  return res.json() as Promise<User>;
}
```

Quên `Promise<>` là lỗi ngay:

```ts
async function fetchUser(id: number): User {}
```
```
error TS1064: The return type of an async function or method must be the global Promise<T> type.
Did you mean to write 'Promise<User>'?
```

Và một lỗi rất hay gặp — quên `await`:

```ts
const u = fetchUser(1);
console.log(u.name);
```
```
error TS2339: Property 'name' does not exist on type 'Promise<User>'.
```

---

## 2. Function overload — một hàm, nhiều chữ ký

Khi kiểu trả về **phụ thuộc vào kiểu tham số**:

```ts
function parse(input: string): object;
function parse(input: string, raw: true): string;
function parse(input: string, raw?: boolean): object | string {
  return raw ? input : JSON.parse(input);
}

const a = parse('{"x":1}');        // a: object
const b = parse('{"x":1}', true);  // b: string
```

Hai dòng đầu là **chữ ký công khai**, dòng thứ ba là phần cài đặt — người ngoài không gọi được vào nó:

```ts
parse('{}', false);
```
```
error TS2345: Argument of type 'false' is not assignable to parameter of type 'true'.
```

Chữ ký cài đặt cho phép `raw?: boolean`, nhưng nó **không được tính là một overload**. Chỉ hai dòng khai báo phía trên mới gọi được.

Gọi thiếu đối số thì lỗi gộp cả hai chữ ký:

```ts
parse();
```
```
error TS2554: Expected 1-2 arguments, but got 0.
```

Còn khi nhiều overload cùng nhận đúng số đối số đó mà không cái nào khớp kiểu, thông báo đổi thành TS2769:

```ts
function fmt(x: string): string;
function fmt(x: number): string;
function fmt(x: any): string { return String(x); }

fmt(true);
```
```
error TS2769: No overload matches this call.
  The last overload gave the following error.
    Argument of type 'boolean' is not assignable to parameter of type 'number'.
```

Overload xuất hiện thật ở `document.createElement`:

```ts
const input = document.createElement('input');   // HTMLInputElement
const div = document.createElement('div');       // HTMLDivElement
const x = document.createElement('abc');         // HTMLElement (nhánh mặc định)
```

Trong phần lớn trường hợp, **union + narrowing đơn giản hơn overload**. Chỉ dùng overload khi kiểu trả về thực sự phải đổi theo tham số.

---

## 3. Narrowing — TypeScript đọc luồng code của bạn

### `typeof`

```ts
function print(value: string | number | boolean) {
  if (typeof value === 'string') {
    value.toUpperCase();      // value: string
  } else if (typeof value === 'number') {
    value.toFixed(2);         // value: number
  } else {
    value === true;           // value: boolean
  }
}
```

Bẫy kinh điển của `typeof`: `null` cũng là `'object'`.

```ts
function f(x: string[] | null) {
  if (typeof x === 'object') {
    x.length;
  }
}
```
```
error TS18047: 'x' is possibly 'null'.
```
TS biết cái bẫy này, và bắt bạn xử lý:
```ts
if (x !== null) { x.length; }    // ✅
```

### Truthiness

```ts
function f(s?: string) {
  if (s) {
    s.length;      // s: string
  }
}
```

Bẫy: chuỗi rỗng và số `0` là falsy.

```ts
function setPort(port?: number) {
  if (port) config.port = port;    // ❌ port = 0 bị bỏ qua
}

function setPort(port?: number) {
  if (port !== undefined) config.port = port;   // ✅
}
```

### `in`

```ts
type Dog = { bark(): void };
type Cat = { meow(): void };

function speak(pet: Dog | Cat) {
  if ('bark' in pet) {
    pet.bark();     // pet: Dog
  } else {
    pet.meow();     // pet: Cat
  }
}
```

### `instanceof`

```ts
function format(d: Date | string) {
  return d instanceof Date ? d.toISOString() : d;
}
```

Dùng nhiều nhất ở `catch`:

```ts
try {
  await save();
} catch (e) {
  if (e instanceof ValidationError) {
    return res.status(422).json({ errors: e.fields });
  }
  if (e instanceof Error) {
    logger.error(e.message, e.stack);
  }
  throw e;
}
```

### So sánh literal

```ts
type Method = 'GET' | 'POST' | 'DELETE';

function handle(m: Method) {
  if (m === 'GET') { /* m: "GET" */ }
  else { /* m: "POST" | "DELETE" */ }
}
```

TS chặn cả so sánh vô nghĩa:

```ts
if (m === 'PUT') {}
```
```
error TS2367: This comparison appears to be unintentional because the types '"GET" | "POST" | "DELETE"'
and '"PUT"' have no overlap.
```

### Narrowing bị mất khi nào

Đây là chỗ gây bực nhất. Ba tình huống có thật, đã kiểm chứng bằng `tsc`:

**a) Property của object dùng trong callback** — luôn mất, không có ngoại lệ:

```ts
function cb(obj: { s?: string }) {
  if (obj.s) {
    setTimeout(() => console.log(obj.s.length), 10);
  }
}
```
```
error TS18048: 'obj.s' is possibly 'undefined'.
```

Lý do chính đáng: giữa lúc kiểm tra và lúc callback chạy, ai đó có thể gán `obj.s = undefined`. TypeScript không theo dõi được điều đó nên nó từ chối luôn.

Sửa: **kéo ra biến `const` cục bộ** rồi mới kiểm tra.

```ts
function cb(obj: { s?: string }) {
  const s = obj.s;
  if (s) {
    setTimeout(() => console.log(s.length), 10);   // ✅
  }
}
```

**b) Biến bị gán lại ở đâu đó sau khi callback được tạo:**

```ts
function f(s: string | undefined) {
  if (s) {
    setTimeout(() => console.log(s.length), 10);
  }
  s = undefined;                                    // ← thủ phạm nằm ở đây
}
```
```
error TS18048: 's' is possibly 'undefined'.
```

Bỏ dòng `s = undefined` đi là hết lỗi. Từ TypeScript 5.4, nếu biến **không còn bị gán lại** sau khi callback được tạo thì narrowing được giữ nguyên — đây là lý do phần lớn callback bạn viết hằng ngày không gặp vấn đề gì.

**c) Biến ở scope module bị gán lại:**

```ts
let g: string | null = 'x';
function useIt() {
  if (g) {
    [1].forEach(() => console.log(g.length));
  }
}
g = null;
```
```
error TS18047: 'g' is possibly 'null'.
```

### Chỗ TypeScript *không* bắt được (phải tự biết)

TypeScript **không** giả định hàm có thể sửa biến của bạn. Đoạn này biên dịch sạch nhưng chết lúc chạy:

```ts
class Service {
  private user: { name: string } | null = null;
  setUser(u: { name: string } | null) { this.user = u; }

  run() {
    if (this.user !== null) {
      this.setUser(null);
      console.log(this.user.name);   // ✅ tsc không báo gì
    }                                 // 💥 runtime: Cannot read properties of null
  }
}
```

Đây là một lỗ hổng có chủ ý của TypeScript: nếu mỗi lời gọi hàm đều xoá narrowing thì code thật sẽ đầy lỗi giả. Bạn phải tự tránh — và cách tránh vẫn là quy tắc cũ: **gán ra `const` cục bộ ngay đầu, đừng đọc lại property nhiều lần**.

```ts
run() {
  const user = this.user;
  if (user !== null) {
    this.setUser(null);
    console.log(user.name);   // ✅ đọc từ bản sao, không dính null
  }
}
```

---

## 4. Type guard tự viết — `x is T`

Khi narrowing sẵn có không đủ, bạn tự viết hàm kiểm tra:

```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function f(x: unknown) {
  if (isString(x)) {
    x.toUpperCase();     // ✅ x: string
  }
}
```

Không có `x is string`, hàm chỉ trả `boolean` và narrowing không xảy ra:

```ts
function isString(x: unknown): boolean {
  return typeof x === 'string';
}
if (isString(x)) { x.toUpperCase(); }
```
```
error TS18046: 'x' is of type 'unknown'.
```

### Type guard cho object từ API

```ts
interface User { id: number; name: string; email: string }

function isUser(x: unknown): x is User {
  return (
    typeof x === 'object' && x !== null &&
    'id' in x && typeof x.id === 'number' &&
    'name' in x && typeof x.name === 'string' &&
    'email' in x && typeof x.email === 'string'
  );
}

const raw: unknown = await res.json();
if (!isUser(raw)) throw new Error('API trả về dữ liệu không đúng dạng');
console.log(raw.name);    // ✅ an toàn thật, không phải tin lời
```

⚠️ **TypeScript không kiểm tra hàm guard viết đúng hay không.** Viết `return true;` nó cũng nhận:

```ts
function isUser(x: unknown): x is User { return true; }   // ✅ biên dịch qua, sai hoàn toàn
```

Vì vậy với dữ liệu ngoài, dùng thư viện validate (Zod) thay vì tự viết — xem [bài 07](./07-thuc-chien-api-va-module.md).

### Lọc mảng bỏ `null` — chỗ type guard cứu bạn

```ts
const raw: (User | null)[] = [u1, null, u2];

const users = raw.filter(u => u !== null);
// TS 5.5 trở lên suy được: User[]
// TS cũ hơn: vẫn là (User | null)[]
```

Với TS cũ hoặc điều kiện phức tạp hơn, viết guard:

```ts
function notNull<T>(x: T | null | undefined): x is T {
  return x !== null && x !== undefined;
}

const users = raw.filter(notNull);   // User[]
```

### Assertion function — `asserts x is T`

```ts
function assertIsUser(x: unknown): asserts x is User {
  if (!isUser(x)) throw new Error('Không phải User');
}

const raw: unknown = await res.json();
assertIsUser(raw);
console.log(raw.name);     // ✅ từ dòng này trở đi raw: User
```

Bẫy: hàm assertion **phải khai kiểu tường minh cho biến giữ nó**:

```ts
const assertIsUser = (x: unknown): asserts x is User => { /* ... */ };
assertIsUser(raw);
```
```
error TS2775: Assertions require every name in the call target to be declared with an explicit type annotation.
```
Sửa: dùng `function` declaration, hoặc `const assertIsUser: (x: unknown) => asserts x is User = ...`.

---

## 5. Discriminated union — mẫu quan trọng nhất

Union các object có **chung một field literal** để phân biệt:

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'triangle'; base: number; height: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle':   return Math.PI * s.radius ** 2;
    case 'rect':     return s.width * s.height;
    case 'triangle': return (s.base * s.height) / 2;
    default: {
      const _exhaustive: never = s;
      throw new Error(`Hình lạ: ${JSON.stringify(s)}`);
    }
  }
}
```

Ba thứ bạn được miễn phí:

**1. Truy cập sai field bị chặn**
```ts
case 'circle': return s.width * 2;
```
```
error TS2339: Property 'width' does not exist on type '{ kind: "circle"; radius: number; }'.
```

**2. Thêm nhánh mới, compiler chỉ đúng chỗ thiếu**

Thêm `| { kind: 'square'; side: number }`:
```
error TS2322: Type '{ kind: "square"; side: number; }' is not assignable to type 'never'.
```

**3. Tạo object thiếu field cũng bị bắt**
```ts
const s: Shape = { kind: 'rect', width: 10 };
```
```
error TS2322: Type '{ kind: "rect"; width: number; }' is not assignable to type 'Shape'.
  Property 'height' is missing in type '{ kind: "rect"; width: number; }' but required in type
  '{ kind: "rect"; width: number; height: number; }'.
```

### Dùng ở đâu trong code thật

**Kết quả có thể thất bại** — thay cho việc ném exception:

```ts
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function fetchUser(id: number): Promise<Result<User, string>> {
  try {
    const res = await fetch(`/users/${id}`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, value: (await res.json()) as User };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Lỗi mạng' };
  }
}

const r = await fetchUser(1);
if (!r.ok) {
  console.error(r.error);
} else {
  console.log(r.value.name);
}
```

Người gọi **không thể quên** xử lý lỗi — quên là compiler báo.

**Trạng thái UI / job:**

```ts
type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };
```

Thứ này thay cho `{ loading: boolean; data?: T; error?: string }` — kiểu cũ cho phép trạng thái vô nghĩa như "đang loading mà cũng có error", còn kiểu trên thì không.

---

## 6. `this` trong hàm

```ts
interface Button {
  label: string;
  onClick(this: Button): void;
}

const b: Button = {
  label: 'OK',
  onClick() { console.log(this.label); },   // this: Button
};
```

Tham số `this` chỉ tồn tại lúc biên dịch, không tính vào số lượng đối số.

Bẫy quen thuộc — mất `this` khi truyền method đi:

```ts
class Counter {
  count = 0;
  inc() { this.count++; }
}

const c = new Counter();
setTimeout(c.inc, 100);     // 💥 runtime: Cannot read properties of undefined (reading 'count')
```

TypeScript **không bắt được** lỗi này mặc định. Bật `strictBindCallApply` (nằm trong `strict`) chỉ giúp cho `bind`/`call`/`apply`. Cách chắc chắn: dùng arrow property.

```ts
class Counter {
  count = 0;
  inc = () => { this.count++; };    // ✅ this luôn đúng
}
setTimeout(c.inc, 100);
```

---

## Bài tập

1. Viết `type Result<T>` như mục 5 và hàm `divide(a: number, b: number): Result<number, string>` (chia 0 trả lỗi). Gọi và xử lý cả hai nhánh.
2. Viết type guard `isNonEmptyArray<T>(a: T[]): a is [T, ...T[]]`. Dùng nó để `a[0]` không còn `possibly undefined` khi bật `noUncheckedIndexedAccess`.
3. Sửa đoạn sau cho hết TS18048, **không** dùng `!` và không dùng `as`:
   ```ts
   class Uploader {
     private onDone?: (url: string) => void;
     start(url: string) {
       if (this.onDone) {
         setTimeout(() => this.onDone(url), 100);
       }
     }
   }
   ```
4. Mô hình hoá một job upload bằng discriminated union với 4 trạng thái: `queued`, `uploading` (có `progress: number`), `done` (có `url: string`), `failed` (có `reason: string`). Viết hàm `describe(job): string` có kiểm tra `never`.
5. Viết overload cho `first`: gọi `first(arr)` trả về `T | undefined`, gọi `first(arr, n)` trả về `T[]`.
6. Hai hàm dưới đây gần giống hệt nhau, nhưng chỉ một cái báo lỗi. Chạy `tsc` để xem cái nào, rồi giải thích vì sao.
   ```ts
   function a(items: string[] | undefined) {
     if (!items) return;
     setTimeout(() => console.log(items.length), 10);
   }

   function b(items: string[] | undefined) {
     if (!items) return;
     setTimeout(() => console.log(items.length), 10);
     items = undefined;
   }
   ```

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { ok: false, error: 'Không chia được cho 0' };
  return { ok: true, value: a / b };
}

const r = divide(10, 0);
console.log(r.ok ? r.value : `Lỗi: ${r.error}`);
```

```ts
// 2
function isNonEmptyArray<T>(a: T[]): a is [T, ...T[]] {
  return a.length > 0;
}
const nums = [1, 2, 3];
if (isNonEmptyArray(nums)) console.log(nums[0].toFixed(2));   // nums[0]: number
```

```ts
// 3 — kéo property ra biến const cục bộ
start(url: string) {
  const onDone = this.onDone;
  if (onDone) {
    setTimeout(() => onDone(url), 100);
  }
}
```

```ts
// 4
type Job =
  | { state: 'queued' }
  | { state: 'uploading'; progress: number }
  | { state: 'done'; url: string }
  | { state: 'failed'; reason: string };

function describe(j: Job): string {
  switch (j.state) {
    case 'queued':    return 'Đang chờ';
    case 'uploading': return `Đang tải ${j.progress}%`;
    case 'done':      return `Xong: ${j.url}`;
    case 'failed':    return `Lỗi: ${j.reason}`;
    default: {
      const _x: never = j;
      throw new Error(`Trạng thái lạ: ${JSON.stringify(j)}`);
    }
  }
}
```

```ts
// 5
function first<T>(arr: T[]): T | undefined;
function first<T>(arr: T[], n: number): T[];
function first<T>(arr: T[], n?: number): T | T[] | undefined {
  return n === undefined ? arr[0] : arr.slice(0, n);
}
```

```
// 6 — chỉ hàm b báo lỗi:
src/x.ts(9,38): error TS18048: 'items' is possibly 'undefined'.

Hàm a: `items` không bị gán lại ở đâu sau khi callback được tạo, nên từ TypeScript 5.4
narrowing được giữ nguyên trong closure.
Hàm b: dòng `items = undefined;` khiến TS không dám chắc lúc callback chạy `items` còn giá trị gì,
nên nó bỏ narrowing.

Cách sửa hàm b: đừng gán lại tham số. Nếu buộc phải, kéo ra const:
  const list = items;
  if (!list) return;
  setTimeout(() => console.log(list.length), 10);
  items = undefined;
```

</details>

---

Tiếp theo 👉 [04-generic.md](./04-generic.md)
