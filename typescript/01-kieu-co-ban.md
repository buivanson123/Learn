# Bài 1 — Kiểu cơ bản

Bài này đi hết bộ kiểu nền tảng. Mỗi mục có: cú pháp, chỗ nó xuất hiện trong code thật, và lỗi bạn sẽ thấy khi dùng sai.

Chạy song song hai terminal như [bài 0](./00-cai-dat-va-tsconfig.md) đã hướng dẫn.

---

## 1. Kiểu nguyên thuỷ

```ts
let name: string = 'Sơn';
let age: number = 30;          // không phân biệt int/float, tất cả là number
let active: boolean = true;
let id: bigint = 9007199254740993n;
let key: symbol = Symbol('k');
let nothing: null = null;
let missing: undefined = undefined;
```

**Nhưng đừng viết như trên.** TypeScript tự suy ra hết:

```ts
let name = 'Sơn';       // name: string
const name2 = 'Sơn';    // name2: "Sơn"  ← chú ý: const cho ra literal type
```

Khác biệt giữa hai dòng đó rất quan trọng, xem mục 5.

Viết hoa tên kiểu là sai:

```ts
let s: String = 'a';
```
Không lỗi ngay, nhưng dính bẫy sau:
```ts
function f(x: string) {}
f(s);
```
```
error TS2345: Argument of type 'String' is not assignable to parameter of type 'string'.
  'string' is a primitive, but 'String' is a wrapper object. Prefer using 'string' when possible.
```

Quy tắc: **luôn viết thường** — `string`, `number`, `boolean`.

---

## 2. Mảng và tuple

### Mảng

```ts
const nums: number[] = [1, 2, 3];
const names: Array<string> = ['a', 'b'];   // cách viết khác, y hệt
const matrix: number[][] = [[1, 2], [3, 4]];
```

Mảng rỗng không khai kiểu là cái bẫy kinh điển:

```ts
const items = [];        // items: any[]
items.push(1);
items.push('hai');       // ✅ không lỗi — TypeScript không bảo vệ gì cả
```

Với `strict`, TS có cơ chế "evolving any" nên đôi khi vẫn suy được, nhưng đừng phụ thuộc. Ghi kiểu ra:

```ts
const items: number[] = [];
items.push('hai');
```
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```

### Mảng lẫn nhiều kiểu

```ts
const mixed: (string | number)[] = [1, 'a', 2];
```

Bỏ ngoặc là ra nghĩa khác hẳn:

```ts
const wrong: string | number[] = 5;   // ✅ hợp lệ: hoặc là string, HOẶC là mảng number
```

### Tuple — mảng có độ dài và kiểu cố định theo vị trí

```ts
const point: [number, number] = [10, 20];
const entry: [string, number] = ['tuổi', 30];
```

```ts
const p: [number, number] = [10, 20, 30];
```
```
error TS2322: Type '[number, number, number]' is not assignable to type '[number, number]'.
  Source has 3 element(s) but target allows only 2.
```

```ts
const p: [number, number] = ['10', 20];
```
```
error TS2322: Type 'string' is not assignable to type 'number'.
```

Tuple đặt tên cho dễ đọc (tên chỉ để hiển thị, không ảnh hưởng gì):

```ts
type Range = [start: number, end: number];
const r: Range = [0, 100];
```

Tuple xuất hiện thật ở đâu? Ở `Object.entries`, ở `useState` kiểu React, và ở hàm trả về nhiều giá trị:

```ts
function useCounter(): [number, () => void] {
  let count = 0;
  return [count, () => { count++; }];
}
const [count, inc] = useCounter();   // count: number, inc: () => void
```

Nếu để `number[]` thay vì tuple thì `inc` sẽ có kiểu `number | (() => void)` và gọi `inc()` sẽ lỗi:
```
error TS2349: This expression is not callable.
  Not all constituents of type 'number | (() => void)' are callable.
```

### Tuple/mảng chỉ đọc

```ts
const days: readonly string[] = ['T2', 'T3'];
days.push('T4');
```
```
error TS2339: Property 'push' does not exist on type 'readonly string[]'.
```

---

## 3. `union` — hoặc cái này hoặc cái kia

Đây là kiểu bạn sẽ dùng nhiều nhất trong TypeScript.

```ts
type Id = string | number;

function findUser(id: Id) {
  console.log(id.toUpperCase());
}
```
```
error TS2339: Property 'toUpperCase' does not exist on type 'string | number'.
  Property 'toUpperCase' does not exist on type 'number'.
```

Đúng như vậy: trên một union, bạn **chỉ dùng được thứ mà mọi nhánh đều có**. Muốn dùng riêng thì phải thu hẹp (bài 03):

```ts
function findUser(id: Id) {
  if (typeof id === 'string') {
    console.log(id.toUpperCase());   // ở đây id: string
  } else {
    console.log(id.toFixed(0));      // ở đây id: number
  }
}
```

Union với `null`/`undefined` — chỗ dùng nhiều nhất trong code thật:

```ts
function findById(id: number): User | null {
  return db.get(id) ?? null;
}

const u = findById(1);
console.log(u.name);
```
```
error TS18047: 'u' is possibly 'null'.
```

Bắt buộc bạn xử lý:

```ts
const u = findById(1);
if (u === null) throw new NotFoundError();
console.log(u.name);        // u: User
```

Đây chính là lý do người ta chuyển sang TypeScript.

---

## 4. `literal type` — giá trị cụ thể làm kiểu

```ts
type Status = 'pending' | 'paid' | 'failed';

let s: Status = 'paid';
s = 'PAID';
```
```
error TS2322: Type '"PAID"' is not assignable to type 'Status'.
```

Gõ sai chính tả gần giống thì được gợi ý luôn — và chú ý mã lỗi **đổi thành TS2820**:

```ts
let s: Status = 'paidd';
```
```
error TS2820: Type '"paidd"' is not assignable to type 'Status'. Did you mean '"paid"'?
```

Literal type dùng cho: trạng thái đơn hàng, role, HTTP method, tên event, key của config. Bất cứ chỗ nào trước đây bạn viết `string` mà thực tế chỉ có vài giá trị hợp lệ.

```ts
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function request(url: string, method: HttpMethod = 'GET') { /* ... */ }

request('/users', 'get');
```
```
error TS2345: Argument of type '"get"' is not assignable to parameter of type 'HttpMethod'.
```

### Cái bẫy `const` vs `let`

```ts
const method = 'POST';      // kiểu: "POST"   → dùng được
let method2 = 'POST';       // kiểu: string   → không dùng được

request('/users', method);   // ✅
request('/users', method2);  // ❌
```
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'HttpMethod'.
```

Lý do: `let` có thể gán lại nên TS mở rộng kiểu thành `string`. `const` không gán lại được nên giữ nguyên literal.

Bẫy này còn xuất hiện với object — và đây là chỗ người mới mất nhiều thời gian nhất:

```ts
const config = { method: 'POST', url: '/users' };
request(config.url, config.method);
```
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'HttpMethod'.
```

`config` là `const` nhưng **property bên trong vẫn sửa được**, nên `method` bị mở rộng thành `string`. Ba cách sửa:

```ts
// 1. as const — đóng băng toàn bộ object thành literal + readonly
const config = { method: 'POST', url: '/users' } as const;
// config.method: "POST"

// 2. khai kiểu cho biến
const config: { method: HttpMethod; url: string } = { method: 'POST', url: '/users' };

// 3. as const cho riêng một property
const config = { method: 'POST' as const, url: '/users' };
```

Cách 1 là cách hay dùng nhất. Nhớ là nó khiến object thành `readonly`:

```ts
const config = { method: 'POST' } as const;
config.method = 'GET';
```
```
error TS2540: Cannot assign to 'method' because it is a read-only property.
```

---

## 5. `enum` — và vì sao thường nên tránh

```ts
enum Role {
  User,      // 0
  Admin,     // 1
}
console.log(Role.Admin);   // 1
```

Khác mọi thứ khác trong TypeScript, **`enum` sinh ra code JS thật**:

```bash
$ npx tsc src/role.ts --outFile out.js && cat out.js
```
```js
var Role;
(function (Role) {
    Role[Role["User"] = 0] = "User";
    Role[Role["Admin"] = 1] = "Admin";
})(Role || (Role = {}));
console.log(Role.Admin);
```

Ba hệ quả thật:

1. Node "strip-only" không chạy được (đã thấy ở bài 0): `SyntaxError: TypeScript enum is not supported in strip-only mode`.
2. Enum số so sánh được với số bất kỳ, không an toàn như bạn tưởng:
   ```ts
   const r: Role = 99;   // ❌ TS 5 đã chặn: error TS2322
   ```
   nhưng khi lấy từ JSON thì `role as Role` sẽ nuốt trọn giá trị rác.
3. Giá trị lưu vào DB là `0`, `1` — đọc log không hiểu gì.

**Thay bằng union + `as const`:**

```ts
export const Role = {
  User: 'user',
  Admin: 'admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];   // "user" | "admin"

function check(r: Role) { /* ... */ }

check(Role.Admin);   // ✅
check('admin');      // ✅ — dùng chuỗi thẳng cũng được
check('root');       // ❌ error TS2345: Argument of type '"root"' is not assignable to parameter of type 'Role'.
```

Cách này: không sinh code lạ, lưu DB ra chuỗi đọc được, và vẫn chặn giá trị sai. (Cú pháp `(typeof Role)[keyof typeof Role]` giải thích ở [bài 04](./04-generic.md) — giờ cứ coi là mẫu để copy.)

Khi nào vẫn dùng `enum`? Khi dự án đã dùng sẵn (NestJS + TypeORM có `enum` column), giữ nhất quán quan trọng hơn.

---

## 6. `any` / `unknown` / `never` — ba kiểu đặc biệt

### `any` — tắt hết kiểm tra

```ts
let x: any = 'hello';
x.foo.bar.baz();       // ✅ không lỗi
x();                   // ✅ không lỗi
x - 5;                 // ✅ không lỗi
```

`any` không chỉ tắt kiểm tra tại chỗ, nó **lan ra**:

```ts
const data: any = JSON.parse(raw);
const users = data.items;         // users: any
const first = users[0];           // first: any
first.name.toUpperCase();         // 💥 runtime nếu name undefined
```

Tìm `any` lẩn trong code bằng:

```bash
$ npx tsc --noEmit --noImplicitAny
```

### `unknown` — "chưa biết gì", phải chứng minh trước khi dùng

```ts
const data: unknown = JSON.parse(raw);
data.items;
```
```
error TS18046: 'data' is of type 'unknown'.
```

Bắt buộc thu hẹp:

```ts
if (typeof data === 'object' && data !== null && 'items' in data) {
  console.log(data.items);   // ✅
}
```

Chỗ bạn gặp `unknown` nhiều nhất là `catch`:

```ts
try {
  await save();
} catch (e) {
  console.log(e.message);
}
```
```
error TS18046: 'e' is of type 'unknown'.
```

Lý do TS làm vậy: `throw` ném được **bất cứ thứ gì**, không chỉ `Error`:

```js
throw 'oops';           // hợp lệ trong JS
throw { code: 500 };    // cũng hợp lệ
```

Cách xử lý đúng:

```ts
catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(msg);
}
```

Viết một lần rồi dùng lại:

```ts
export function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}
```

### `never` — giá trị không bao giờ tồn tại

Xuất hiện ở hàm không bao giờ trả về:

```ts
function fail(msg: string): never {
  throw new Error(msg);
}
```

Và ở chỗ hữu ích nhất: **kiểm tra xử lý đủ mọi nhánh**.

```ts
type Status = 'pending' | 'paid' | 'failed';

function label(s: Status): string {
  switch (s) {
    case 'pending': return 'Chờ thanh toán';
    case 'paid':    return 'Đã thanh toán';
    case 'failed':  return 'Thất bại';
    default:
      const _exhaustive: never = s;   // s ở đây là never vì đã hết nhánh
      throw new Error(`Trạng thái lạ: ${s}`);
  }
}
```

Bây giờ thêm `'refunded'` vào `Status` mà quên sửa `label`:

```ts
type Status = 'pending' | 'paid' | 'failed' | 'refunded';
```
```
error TS2322: Type '"refunded"' is not assignable to type 'never'.
```

Compiler chỉ thẳng vào chỗ bạn quên. Đây là kỹ thuật đáng dùng ở mọi `switch` trên union.

### So sánh nhanh

| | Gán vào được gì | Lấy ra dùng được gì |
|---|---|---|
| `any` | mọi thứ | mọi thứ (không kiểm tra) |
| `unknown` | mọi thứ | không gì cả, phải thu hẹp trước |
| `never` | không gì cả | — |

---

## 7. `void` vs `undefined`

```ts
function log(msg: string): void {
  console.log(msg);
}
```

`void` = "đừng quan tâm giá trị trả về". Khác `undefined` ở chỗ nó cho phép hàm trả về gì cũng được khi dùng làm callback:

```ts
const arr = [1, 2, 3];
const set = new Set<number>();

arr.forEach(n => set.add(n));   // ✅ set.add trả về Set, nhưng forEach nhận (n) => void
```

Còn nếu khai `(n: number) => undefined` thì dòng trên lỗi:
```
error TS2345: Type 'Set<number>' is not assignable to type 'undefined'.
```

---

## 8. Type assertion `as` — và vì sao dùng ít thôi

`as` nói với compiler: "im đi, tôi biết tôi đang làm gì". Nó **không kiểm tra gì lúc runtime**.

```ts
const raw: unknown = '{"id":1}';
const user = raw as { id: number };
console.log(user.id);        // 💥 runtime: undefined — vì raw là chuỗi, không phải object
```

Không có lỗi lúc biên dịch. `as` là chỗ bạn tự chịu trách nhiệm.

Nơi dùng `as` chính đáng:

```ts
// 1. DOM — bạn biết thẻ đó là input, TS không biết
const input = document.getElementById('email') as HTMLInputElement;
input.value = 'a@b.c';

// 2. Thu hẹp sau khi đã tự kiểm tra bằng cách TS không hiểu được
const keys = Object.keys(config) as (keyof Config)[];
```

TS chặn assertion quá vô lý:

```ts
const n = 'abc' as number;
```
```
error TS2352: Conversion of type 'string' to type 'number' may be a mistake because neither type
sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
```

Còn `as unknown as X` thì luôn qua được — và đó là dấu hiệu code đang có vấn đề, chỉ dùng trong test.

### Toán tử `!` (non-null assertion)

```ts
const el = document.getElementById('app')!;   // "tôi chắc chắn nó không null"
el.innerHTML = 'hi';
```

Cùng bản chất với `as`: không kiểm tra runtime. Sai thì `TypeError: Cannot read properties of null`. Trong code production, ưu tiên kiểm tra thật:

```ts
const el = document.getElementById('app');
if (!el) throw new Error('Không tìm thấy #app');
el.innerHTML = 'hi';
```

---

## 9. `type` alias — đặt tên cho kiểu

```ts
type UserId = string;
type Point = { x: number; y: number };
type Callback = (err: Error | null, data?: string) => void;
type Status = 'on' | 'off';
```

Đặt tên đúng chỗ làm code dễ đọc hẳn:

```ts
// Trước
function move(a: number, b: number, c: number, d: number) {}

// Sau
type Point = { x: number; y: number };
function move(from: Point, to: Point) {}
```

Chi tiết `type` vs `interface` ở [bài 02](./02-object-interface-type.md).

---

## Bài tập

1. Khai kiểu `Currency` chỉ nhận `'VND' | 'USD' | 'EUR'`. Viết `format(amount: number, c: Currency): string`. Gọi thử với `'vnd'` và ghi lại mã lỗi.
2. Viết `parseId(input: unknown): number` — nhận `unknown`, trả về number nếu input là số hoặc chuỗi số, ném lỗi nếu không. **Không dùng `any`, không dùng `as`.**
3. Sửa đoạn sau cho hết lỗi mà không đổi kiểu tham số của `send`:
   ```ts
   type Method = 'GET' | 'POST';
   function send(m: Method) {}
   const opts = { method: 'POST' };
   send(opts.method);
   ```
4. Đổi `enum OrderStatus { New, Shipped, Done }` sang dạng union + `as const`, sao cho giá trị lưu DB là chuỗi `'new' | 'shipped' | 'done'`.
5. Viết `switch` trên `OrderStatus` có kiểm tra `never`. Thêm giá trị `'cancelled'` vào type và xác nhận compiler báo đúng chỗ thiếu.
6. Đoạn nào dưới đây lỗi, đoạn nào không, vì sao?
   ```ts
   const a: (string | number)[] = ['a', 1];
   const b: string | number[] = ['a', 1];
   const c: [string, number] = ['a', 1];
   const d: [string, number] = [1, 'a'];
   ```

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
type Currency = 'VND' | 'USD' | 'EUR';
function format(amount: number, c: Currency): string {
  return `${amount.toLocaleString('vi-VN')} ${c}`;
}
format(1000, 'vnd');
// error TS2345: Argument of type '"vnd"' is not assignable to parameter of type 'Currency'.
```

```ts
// 2
function parseId(input: unknown): number {
  if (typeof input === 'number' && Number.isInteger(input)) return input;
  if (typeof input === 'string') {
    const n = Number(input);
    if (!Number.isNaN(n)) return n;
  }
  throw new Error(`Không phải id hợp lệ: ${String(input)}`);
}
```

```ts
// 3
const opts = { method: 'POST' } as const;
send(opts.method);
```

```ts
// 4 + 5
export const OrderStatus = {
  New: 'new',
  Shipped: 'shipped',
  Done: 'done',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

function label(s: OrderStatus): string {
  switch (s) {
    case 'new':     return 'Mới';
    case 'shipped': return 'Đang giao';
    case 'done':    return 'Hoàn tất';
    default: {
      const _x: never = s;
      throw new Error(`Trạng thái lạ: ${s}`);
    }
  }
}
// Thêm Cancelled: 'cancelled' vào object →
// error TS2322: Type '"cancelled"' is not assignable to type 'never'.
```

```
// 6
a ✅ mảng chứa string hoặc number
b ❌ error TS2322 — nghĩa là "string HOẶC number[]", mảng ['a', 1] không khớp cái nào
c ✅ tuple đúng thứ tự
d ❌ error TS2322 — sai thứ tự: vị trí 0 phải là string
```

</details>

---

Tiếp theo 👉 [02-object-interface-type.md](./02-object-interface-type.md)
