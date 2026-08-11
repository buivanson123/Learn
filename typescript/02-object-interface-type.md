# Bài 2 — Object, `interface` và `type`

Phần lớn code backend là mô tả hình dạng dữ liệu: user, order, response, config. Bài này dạy đủ để mô tả bất cứ thứ gì.

---

## 1. Kiểu object

```ts
type User = {
  id: number;
  name: string;
  email: string;
};

const u: User = { id: 1, name: 'Sơn', email: 'a@b.c' };
```

Thiếu field:
```ts
const u: User = { id: 1, name: 'Sơn' };
```
```
error TS2741: Property 'email' is missing in type '{ id: number; name: string; }' but required in type 'User'.
```

Thừa field — chỉ báo lỗi khi gán **object literal trực tiếp** (excess property check):

```ts
const u: User = { id: 1, name: 'Sơn', email: 'a@b.c', age: 30 };
```
```
error TS2353: Object literal may only specify known properties, and 'age' does not exist in type 'User'.
```

Nhưng đi qua biến trung gian thì lọt:

```ts
const raw = { id: 1, name: 'Sơn', email: 'a@b.c', age: 30 };
const u: User = raw;   // ✅ không lỗi
```

Không phải bug. TypeScript dùng **structural typing**: `raw` có đủ mọi thứ `User` cần, nên nó *là* một `User`. Kiểm tra field thừa chỉ áp cho literal vì đó gần như luôn là lỗi gõ nhầm tên.

Chứng minh structural typing rõ hơn — hai type không liên quan gì vẫn thay thế nhau được:

```ts
type Point = { x: number; y: number };
type Vector = { x: number; y: number };

const p: Point = { x: 1, y: 2 };
const v: Vector = p;   // ✅ hợp lệ, vì cùng hình dạng
```

---

## 2. `?` — property tuỳ chọn

```ts
type User = {
  id: number;
  name: string;
  phone?: string;      // string | undefined
};

const u: User = { id: 1, name: 'Sơn' };   // ✅
console.log(u.phone.length);
```
```
error TS18048: 'u.phone' is possibly 'undefined'.
```

Xử lý:

```ts
console.log(u.phone?.length ?? 0);
```

### `?` khác với `| undefined` ở một điểm

```ts
type A = { phone?: string };
type B = { phone: string | undefined };

const a: A = {};                  // ✅ được phép bỏ hẳn
const b: B = {};                  // ❌
```
```
error TS2741: Property 'phone' is missing in type '{}' but required in type 'B'.
```
```ts
const b: B = { phone: undefined };   // ✅ phải ghi ra rõ ràng
```

Dùng `| undefined` khi muốn ép người viết **nghĩ đến** field đó (ví dụ DTO cập nhật: bắt buộc quyết định gửi gì).

### `exactOptionalPropertyTypes` — chi tiết ít ai biết

Mặc định, `phone?: string` cho phép gán `undefined` một cách tường minh:

```ts
const u: User = { id: 1, name: 'Sơn', phone: undefined };   // ✅ mặc định cho qua
```

Với backend, "không có field phone" và "có field phone bằng undefined" là hai chuyện khác nhau (một cái không đụng DB, một cái ghi `NULL`). Bật cờ trong `tsconfig.json`:

```jsonc
"exactOptionalPropertyTypes": true
```
```
error TS2375: Type '{ id: number; name: string; phone: undefined; }' is not assignable to type 'User'
with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
```

---

## 3. `readonly`

```ts
type Config = {
  readonly apiUrl: string;
  readonly retries: number;
};

const c: Config = { apiUrl: 'http://a', retries: 3 };
c.apiUrl = 'http://b';
```
```
error TS2540: Cannot assign to 'apiUrl' because it is a read-only property.
```

`readonly` **chỉ tồn tại lúc biên dịch**. Ép qua kiểu khác là ghi được ngay:

```ts
const anyC = c as { apiUrl: string };
anyC.apiUrl = 'http://b';       // ✅ chạy được, giá trị đổi thật
console.log(c.apiUrl);           // http://b
```

Muốn chặn thật lúc runtime thì dùng `Object.freeze()`.

`readonly` chỉ áp một tầng:

```ts
type S = { readonly user: { name: string } };
const s: S = { user: { name: 'Sơn' } };
s.user = { name: 'B' };      // ❌ error TS2540
s.user.name = 'B';           // ✅ vẫn đổi được
```

Muốn sâu thì dùng mapped type đệ quy (xem [bài 05](./05-utility-va-type-nang-cao.md)).

---

## 4. `interface` vs `type` — khác nhau ở đâu

Hai cách viết cho ra kết quả gần như y hệt:

```ts
interface User { id: number; name: string }
type User2 = { id: number; name: string };
```

Ba khác biệt có thật:

### a) `interface` gộp được khai báo trùng tên, `type` thì không

```ts
interface Window { title: string }
interface Window { version: number }
// → Window có cả hai field
```

```ts
type T = { a: number };
type T = { b: number };
```
```
error TS2300: Duplicate identifier 'T'.
```

Tính năng gộp này dùng để **mở rộng kiểu của thư viện khác**. Ví dụ thật: gắn `user` vào `Request` của Express sau khi auth:

```ts
// src/types/express.d.ts
import 'express';

declare module 'express' {
  interface Request {
    user?: { id: number; role: string };
  }
}
```

Xong thì trong mọi controller:

```ts
app.get('/me', (req, res) => {
  res.json(req.user);      // ✅ TS biết field này
});
```

Không có phần khai báo trên:
```
error TS2339: Property 'user' does not exist on type 'Request<...>'.
```

`type` không làm được việc này.

### b) `type` làm được union, `interface` thì không

```ts
type Result = Success | Failure;         // ✅
type Id = string | number;               // ✅
type Fn = (a: number) => string;         // ✅
```

```ts
interface Id = string | number;   // ❌ cú pháp không tồn tại
```

### c) Cách mở rộng khác cú pháp

```ts
interface Animal { name: string }
interface Dog extends Animal { breed: string }

type Animal2 = { name: string };
type Dog2 = Animal2 & { breed: string };     // intersection
```

Khác biệt tinh tế: `extends` **kiểm tra ngay** xem có xung đột không, `&` thì không:

```ts
interface A { x: number }
interface B extends A { x: string }
```
```
error TS2430: Interface 'B' incorrectly extends interface 'A'.
  Types of property 'x' are incompatible.
    Type 'string' is not assignable to type 'number'.
```

```ts
type A2 = { x: number };
type B2 = A2 & { x: string };     // ✅ không lỗi ngay
const b: B2 = { x: 1 };            // ❌ lỗi ở đây, khó hiểu hơn
```
```
error TS2322: Type 'number' is not assignable to type 'never'.
```

`x` thành `number & string` = `never`, không giá trị nào gán được. Lỗi hiện ở chỗ dùng chứ không ở chỗ khai báo.

### Chọn cái nào?

- **`interface`** cho hình dạng object, đặc biệt là những thứ có thể cần mở rộng (entity, DTO, props, khai báo mở rộng thư viện).
- **`type`** cho union, tuple, hàm, và mọi kiểu tính toán (`Pick`, `Omit`, conditional...).

Đừng tranh cãi lâu — miễn là cả team thống nhất.

---

## 5. Kiểu lồng nhau và mảng object

```ts
interface Address {
  street: string;
  city: string;
  zip?: string;
}

interface Order {
  id: number;
  total: number;
  items: OrderItem[];
  shipping: Address;
  billing?: Address;
  createdAt: Date;
}

interface OrderItem {
  productId: number;
  qty: number;
  price: number;
}
```

Dùng:

```ts
const order: Order = {
  id: 1,
  total: 200_000,
  items: [{ productId: 10, qty: 2, price: 100_000 }],
  shipping: { street: 'Lê Lợi', city: 'HCM' },
  createdAt: new Date(),
};

const total = order.items.reduce((s, i) => s + i.qty * i.price, 0);
//                              ↑ i tự có kiểu OrderItem, không cần ghi
```

Gõ sai tên field bị bắt ngay kèm gợi ý:

```ts
order.items[0]?.prodcutId;
```
```
error TS2551: Property 'prodcutId' does not exist on type 'OrderItem'. Did you mean 'productId'?
```

### Đặt type ở đâu?

Đừng nhét hết vào một file `types.ts` khổng lồ. Đặt cạnh nơi dùng:

```
src/
├── orders/
│   ├── order.types.ts      ← Order, OrderItem
│   └── order.service.ts
├── users/
│   ├── user.types.ts
│   └── user.service.ts
└── shared/
    └── types.ts            ← chỉ những thứ THẬT SỰ dùng chung: ApiResponse, Paginated...
```

---

## 6. Index signature — object có key động

Khi bạn không biết trước tên các key:

```ts
type Translations = {
  [key: string]: string;
};

const vi: Translations = {
  hello: 'Xin chào',
  bye: 'Tạm biệt',
};

console.log(vi.hello);          // string
console.log(vi.batKyGiCung);    // string ← TS không biết key này không tồn tại
```

Đây là điểm nguy hiểm: `vi.batKyGiCung` kiểu `string` nhưng runtime là `undefined`. Bật `noUncheckedIndexedAccess` để sửa:

```jsonc
"noUncheckedIndexedAccess": true
```
```ts
console.log(vi.batKyGiCung.length);
```
```
error TS18048: 'vi.batKyGiCung' is possibly 'undefined'.
```

### Lỗi kinh điển với index signature

```ts
interface Config {
  host: string;
  port: number;
}

const config: Config = { host: 'localhost', port: 3000 };

function get(key: string) {
  return config[key];
}
```
```
error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used
to index type 'Config'. No index signature with a parameter of type 'string' was found on type 'Config'.
```

Cách sửa đúng (không dùng `any`):

```ts
function get<K extends keyof Config>(key: K): Config[K] {
  return config[key];
}

get('host');   // string
get('port');   // number
get('abc');    // ❌ error TS2345: Argument of type '"abc"' is not assignable to parameter of type 'keyof Config'.
```

`keyof` và generic giải thích kỹ ở [bài 04](./04-generic.md).

### `Record<K, V>` — cách viết gọn hơn

```ts
type Translations = Record<string, string>;
type RoleLimits = Record<'user' | 'admin', number>;

const limits: RoleLimits = { user: 10, admin: 1000 };
```

Thiếu key bị bắt ngay — rất hợp để làm bảng tra bắt buộc đủ nhánh:

```ts
const limits: RoleLimits = { user: 10 };
```
```
error TS2741: Property 'admin' is missing in type '{ user: number; }' but required in type 'Record<"user" | "admin", number>'.
```

---

## 7. Object lồng union — bảng phân biệt theo field

Đây là mẫu quan trọng nhất của TypeScript trong code thật:

```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: number };
```

Dùng:

```ts
function handle(res: ApiResponse<User>) {
  if (res.success) {
    console.log(res.data.name);     // TS biết chắc có `data`
  } else {
    console.log(res.error, res.code);  // TS biết chắc có `error` + `code`
  }
}
```

Truy cập sai nhánh bị chặn:

```ts
function handle(res: ApiResponse<User>) {
  console.log(res.data);
}
```
```
error TS2339: Property 'data' does not exist on type 'ApiResponse<User>'.
  Property 'data' does not exist on type '{ success: false; error: string; code: number; }'.
```

Mẫu này gọi là **discriminated union**, học kỹ ở [bài 03](./03-ham-va-narrowing.md).

---

## 8. `keyof`, `typeof` — lấy kiểu từ thứ đã có

Đừng viết type hai lần. Suy ra từ giá trị:

```ts
const defaultConfig = {
  host: 'localhost',
  port: 3000,
  debug: false,
};

type Config = typeof defaultConfig;
// { host: string; port: number; debug: boolean }

type ConfigKey = keyof Config;
// "host" | "port" | "debug"

type Port = Config['port'];
// number
```

Bây giờ thêm field vào `defaultConfig`, `Config` tự cập nhật. Không có chuyện type và giá trị lệch nhau.

```ts
function set(key: ConfigKey, value: unknown) {}
set('hosts', 1);
```
```
error TS2345: Argument of type '"hosts"' is not assignable to parameter of type 'keyof Config'.
```

---

## Bài tập

1. Mô tả kiểu cho JSON sau. `avatar` có thể không có, `id` không được sửa sau khi tạo:
   ```json
   {
     "id": 7,
     "profile": { "name": "Sơn", "avatar": "https://..." },
     "roles": ["admin", "editor"],
     "meta": { "lastLogin": "2026-08-11T10:00:00Z", "loginCount": 42 }
   }
   ```
2. Viết `interface Paginated<T>` mô tả `{ items, total, page, pageSize, hasNext }`. Dùng nó cho `Paginated<User>`.
3. Đoạn này lỗi gì và vì sao chỉ lỗi ở dòng 2 mà không lỗi ở dòng 4?
   ```ts
   type P = { x: number };
   const p1: P = { x: 1, y: 2 };
   const raw = { x: 1, y: 2 };
   const p2: P = raw;
   ```
4. Có `const ROUTES = { home: '/', users: '/users', orders: '/orders' } as const;`. Viết type `RouteName` (tên) và `RoutePath` (đường dẫn) suy ra từ chính object đó, không gõ tay lại.
5. Sửa lỗi TS7053 sau mà không dùng `any` và không dùng `as`:
   ```ts
   const perms = { read: true, write: false, delete: false };
   function can(action: string): boolean { return perms[action]; }
   ```
6. Dùng khai báo gộp `interface` để thêm field `requestId: string` vào `Request` của Express, rồi dùng nó trong một route handler.

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
interface Account {
  readonly id: number;
  profile: { name: string; avatar?: string };
  roles: string[];
  meta: { lastLogin: string; loginCount: number };
}
```

```ts
// 2
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
}
const res: Paginated<User> = { items: [], total: 0, page: 1, pageSize: 20, hasNext: false };
```

```
// 3
Dòng 2: error TS2353 — excess property check chỉ áp cho object literal gán trực tiếp.
Dòng 4: không lỗi — structural typing, `raw` có đủ field mà P cần nên nó là một P hợp lệ.
```

```ts
// 4
type RouteName = keyof typeof ROUTES;              // "home" | "users" | "orders"
type RoutePath = (typeof ROUTES)[RouteName];       // "/" | "/users" | "/orders"
```

```ts
// 5
const perms = { read: true, write: false, delete: false };
type Action = keyof typeof perms;
function can(action: Action): boolean { return perms[action]; }
can('read');    // ✅
can('drop');    // ❌ error TS2345
```

```ts
// 6 — src/types/express.d.ts
import 'express';
declare module 'express' {
  interface Request { requestId: string }
}

// src/index.ts
app.use((req, _res, next) => { req.requestId = crypto.randomUUID(); next(); });
app.get('/ping', (req, res) => res.json({ id: req.requestId }));
```

</details>

---

Tiếp theo 👉 [03-ham-va-narrowing.md](./03-ham-va-narrowing.md)
