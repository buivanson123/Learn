# Bài 4 — Generic

Generic là cách viết một kiểu **có tham số**. Bạn đã dùng nó rồi mà chưa để ý: `Array<T>`, `Promise<T>`, `Map<K, V>`.

Mục tiêu bài này: viết được generic của riêng bạn, và đọc hiểu chữ ký hàm trong `node_modules`.

---

## 1. Vấn đề generic giải quyết

Viết một hàm lấy phần tử đầu mảng:

```ts
function first(arr: unknown[]): unknown {
  return arr[0];
}

const n = first([1, 2, 3]);
n.toFixed(2);
```
```
error TS18046: 'n' is of type 'unknown'.
```

Kiểu vào và kiểu ra có liên hệ với nhau, nhưng chữ ký trên không diễn tả được điều đó. Dùng `any` thì mất luôn kiểm tra. Generic là câu trả lời:

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]);      // number | undefined
const s = first(['a', 'b']);     // string | undefined
const u = first<User>([]);       // User | undefined
```

`<T>` là một **biến kiểu**: giá trị của nó do TypeScript suy ra từ chỗ gọi. Đọc chữ ký trên thành: *"với kiểu T bất kỳ, nhận `T[]` và trả về `T | undefined`"*.

Đặt tên `T`, `K`, `V`, `E` là quy ước, nhưng tên rõ nghĩa vẫn tốt hơn khi có nhiều tham số:

```ts
function pluck<TItem, TKey extends keyof TItem>(items: TItem[], key: TKey): TItem[TKey][] {
  return items.map(i => i[key]);
}

const users = [{ id: 1, name: 'Sơn' }, { id: 2, name: 'An' }];
pluck(users, 'name');   // string[]
pluck(users, 'id');     // number[]
pluck(users, 'age');    // ❌ error TS2345: Argument of type '"age"' is not assignable to parameter of type '"id" | "name"'.
```

---

## 2. Ràng buộc bằng `extends`

Không ràng buộc thì bên trong hàm bạn gần như không dùng được gì:

```ts
function longest<T>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}
```
```
error TS2339: Property 'length' does not exist on type 'T'.
```

Đúng — `T` có thể là `number`, mà `number` không có `.length`. Ràng buộc lại:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest('abc', 'de');            // string
longest([1, 2], [3]);            // number[]
longest(1, 2);                   // ❌
```
```
error TS2345: Argument of type 'number' is not assignable to parameter of type '{ length: number; }'.
```

Chú ý điều generic giữ được mà union không giữ:

```ts
const r = longest('abc', 'de');
r.toUpperCase();     // ✅ r vẫn là string
```

Nếu viết `function longest(a: string | number[], b: string | number[]): string | number[]` thì `r.toUpperCase()` sẽ lỗi TS2339 vì kiểu trả về đã bị trộn.

### Giá trị mặc định cho tham số kiểu

```ts
interface ApiResponse<TData = unknown> {
  status: number;
  data: TData;
}

const a: ApiResponse = { status: 200, data: 'gì cũng được' };        // TData = unknown
const b: ApiResponse<User> = { status: 200, data: { id: 1, name: 'Sơn' } };
```

---

## 3. `keyof` — lấy tập hợp tên key

```ts
interface User { id: number; name: string; email: string }

type UserKey = keyof User;   // "id" | "name" | "email"

const k: UserKey = 'name';   // ✅
const k2: UserKey = 'age';   // ❌
```
```
error TS2322: Type '"age"' is not assignable to type 'UserKey'.
```

`keyof` trên object có index signature ra kết quả khác:

```ts
type Dict = { [key: string]: number };
type DictKey = keyof Dict;     // string | number
```
(`number` có mặt vì trong JavaScript `obj[1]` và `obj['1']` là một.)

`keyof` trên mảng ra một mớ — vì mảng có `length`, `push`, `map`...:

```ts
type ArrKey = keyof string[];   // number | "length" | "push" | "concat" | ...
```

### Ứng dụng: hàm `get` an toàn

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const u = { id: 1, name: 'Sơn', active: true };

get(u, 'name');     // string
get(u, 'active');   // boolean
get(u, 'abc');      // ❌ error TS2345: Argument of type '"abc"' is not assignable to parameter of type '"id" | "name" | "active"'.
```

So với cách viết `function get(obj: any, key: string): any` — cùng số dòng, nhưng một cái bắt lỗi gõ nhầm còn một cái thì không.

---

## 4. `typeof` (ở vị trí kiểu) — lấy kiểu từ giá trị

Đừng nhầm với `typeof` lúc runtime. Ở vị trí kiểu, nó nghĩa là "kiểu của biến này":

```ts
const defaultConfig = {
  host: 'localhost',
  port: 3000,
  ssl: false,
};

type Config = typeof defaultConfig;
// { host: string; port: number; ssl: boolean }
```

Kết hợp với `as const` để giữ literal:

```ts
const ROLES = ['user', 'editor', 'admin'] as const;
type Role = (typeof ROLES)[number];    // "user" | "editor" | "admin"
```

Đọc `(typeof ROLES)[number]` là: *lấy kiểu của `ROLES`, rồi lấy kiểu của phần tử tại một index số bất kỳ*. Kết quả là union của mọi phần tử.

Giá trị này giờ dùng được cả hai đầu:

```ts
function setRole(r: Role) { /* ... */ }

for (const r of ROLES) setRole(r);      // ✅ chạy vòng lặp trên chính mảng đó
setRole('admin');                        // ✅
setRole('root');                         // ❌ error TS2345
```

Thêm `'owner'` vào `ROLES` là `Role` tự có thêm nhánh. Không có chỗ nào phải sửa hai lần.

### Mẫu thay `enum` (đã gặp ở bài 01)

```ts
export const Status = {
  Pending: 'pending',
  Paid: 'paid',
  Failed: 'failed',
} as const;

export type Status = (typeof Status)[keyof typeof Status];
// "pending" | "paid" | "failed"
```

Tách ra đọc từng bước:

```ts
type A = typeof Status;              // { readonly Pending: "pending"; readonly Paid: "paid"; ... }
type B = keyof typeof Status;        // "Pending" | "Paid" | "Failed"     ← tên key
type C = (typeof Status)[B];         // "pending" | "paid" | "failed"     ← giá trị
```

---

## 5. Indexed access — `T[K]`

```ts
interface Order {
  id: number;
  customer: { name: string; email: string };
  items: { sku: string; qty: number }[];
}

type Customer = Order['customer'];        // { name: string; email: string }
type Item = Order['items'][number];       // { sku: string; qty: number }
type Sku = Order['items'][number]['sku']; // string
type IdOrCustomer = Order['id' | 'customer'];   // number | { name: string; email: string }
```

Cách này tránh phải tách mọi thứ thành interface riêng chỉ để tái sử dụng. Gõ sai key bị bắt ngay:

```ts
type X = Order['customers'];
```
```
error TS2339: Property 'customers' does not exist on type 'Order'.
```

---

## 6. Generic trong class và interface

```ts
class Repository<T extends { id: number }> {
  private items = new Map<number, T>();

  save(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  findById(id: number): T | undefined {
    return this.items.get(id);
  }

  findAll(): T[] {
    return [...this.items.values()];
  }
}

const userRepo = new Repository<User>();
userRepo.save({ id: 1, name: 'Sơn', email: 'a@b.c' });

const u = userRepo.findById(1);   // User | undefined
console.log(u?.email);
```

Quên ràng buộc `{ id: number }` thì `this.items.set(item.id, ...)` lỗi ngay tại chỗ định nghĩa:
```
error TS2339: Property 'id' does not exist on type 'T'.
```

Đưa vào kiểu không có `id`:

```ts
const bad = new Repository<{ name: string }>();
```
```
error TS2741: Property 'id' is missing in type '{ name: string; }' but required in type '{ id: number; }'.
```

### Interface generic

```ts
interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
}

interface Repo<T, TCreate = Omit<T, 'id'>> {
  find(id: number): Promise<T | null>;
  list(page: number): Promise<Paginated<T>>;
  create(data: TCreate): Promise<T>;
}
```

Dùng:

```ts
class UserRepo implements Repo<User> {
  async find(id: number) { /* ... */ return null; }
  async list(page: number) { /* ... */ return { items: [], total: 0, page }; }
  async create(data: Omit<User, 'id'>) { /* ... */ return {} as User; }
}
```

Cài đặt sai chữ ký thì báo tại class:

```ts
class UserRepo implements Repo<User> {
  async find(id: string) { return null; }
}
```
```
error TS2416: Property 'find' in type 'UserRepo' is not assignable to the same property in base type 'Repo<User, Omit<User, "id">>'.
  Type '(id: string) => Promise<null>' is not assignable to type '(id: number) => Promise<User | null>'.
    Types of parameters 'id' and 'id' are incompatible.
      Type 'number' is not assignable to type 'string'.
```

---

## 7. Suy kiểu generic — khi nào phải ghi tay

TypeScript suy `T` từ **đối số truyền vào**. Không có đối số nào chứa `T` thì nó chịu:

```ts
function createEmpty<T>(): T[] {
  return [];
}

const a = createEmpty();          // a: unknown[]   ← không suy được
const b = createEmpty<User>();    // b: User[]      ← phải ghi tay
```

Đây cũng là dấu hiệu nhận biết một chữ ký generic tệ. Quy tắc thực dụng: **mỗi tham số kiểu nên xuất hiện ở ít nhất hai chỗ** (một chỗ để suy ra, một chỗ để dùng). Nếu `T` chỉ xuất hiện ở kiểu trả về, nó thực chất là `as` trá hình:

```ts
// ❌ chữ ký nói dối: người gọi tự chọn T, hàm không kiểm tra gì
async function fetchJson<T>(url: string): Promise<T> {
  return (await fetch(url)).json();
}
const users = await fetchJson<User[]>('/users');   // TS tin, runtime có thể là gì cũng được
```

Cách viết trung thực nằm ở [bài 07](./07-thuc-chien-api-va-module.md).

### `NoInfer` — chặn suy kiểu từ một vị trí

```ts
function createRange<T>(items: T[], fallback: T): T {
  return items[0] ?? fallback;
}

createRange(['a', 'b'], 'c');    // T = string, ổn
createRange(['a', 'b'], 42);     // T = string | number — có lẽ không phải ý bạn
```

Chặn không cho `fallback` tham gia suy kiểu:

```ts
function createRange<T>(items: T[], fallback: NoInfer<T>): T {
  return items[0] ?? fallback;
}

createRange(['a', 'b'], 42);
```
```
error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
```

`NoInfer` có sẵn từ TypeScript 5.4, không cần import.

---

## 8. Đọc chữ ký generic của thư viện

Kỹ năng thực dụng nhất từ bài này: `Ctrl+Click` (hoặc `F12`) vào bất kỳ hàm nào để xem chữ ký thật.

```ts
// lib.es5.d.ts
interface Array<T> {
  map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[];
  filter<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S): S[];
  reduce<U>(callbackfn: (prev: U, cur: T, i: number, arr: T[]) => U, initialValue: U): U;
}
```

Đọc `map<U>`: *mảng `T[]`, callback biến `T` thành `U`, kết quả là `U[]`*. Đó là lý do:

```ts
const users: User[] = [];
const names = users.map(u => u.name);        // U = string → string[]
const ids = users.map(u => u.id);            // U = number → number[]
```

Đọc `filter<S extends T>(... ): value is S`: đây chính là chỗ type guard được dùng thật, và là lý do dòng này hoạt động:

```ts
const raw: (User | null)[] = [];
const users = raw.filter(u => u !== null);   // User[] — từ TypeScript 5.5
```

Đọc `reduce<U>(..., initialValue: U): U`: `U` suy từ **giá trị khởi tạo**. Đó là lý do quên `initialValue` hay gây lỗi:

```ts
const total = [1, 2, 3].reduce((s, n) => s + n);          // ✅ có overload riêng, U = number
const byId = users.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
```
```
error TS7053: Element implicitly has an 'any' type because expression of type 'number'
can't be used to index type '{}'.
```
Sửa bằng cách ghi kiểu cho `initialValue`:
```ts
const byId = users.reduce<Record<number, User>>((acc, u) => { acc[u.id] = u; return acc; }, {});
```
Hoặc dùng thứ có sẵn, ngắn hơn hẳn:
```ts
const byId = Object.groupBy(users, u => u.id);       // cần lib ES2024 trở lên
const map = new Map(users.map(u => [u.id, u]));      // Map<number, User>
```

---

## Bài tập

1. Viết `last<T>(arr: T[]): T | undefined`. Gọi với `[1,2,3]` và `['a']`, kiểm tra kiểu suy ra bằng cách hover trong editor.
2. Viết `groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]>`. Dùng nó nhóm một mảng `User[]` theo `role`.
3. Có `const ENDPOINTS = { users: '/api/users', orders: '/api/orders' } as const;`. Viết `type Endpoint` (giá trị đường dẫn) và hàm `call(name: keyof typeof ENDPOINTS)` chỉ nhận đúng hai tên đó.
4. Viết `pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K>` — tự cài đặt, không dùng utility có sẵn ở phần thân hàm.
5. Đoạn sau có gì sai về mặt thiết kế chữ ký, và hậu quả thực tế là gì?
   ```ts
   function parse<T>(json: string): T {
     return JSON.parse(json);
   }
   const u = parse<User>('{"foo":1}');
   console.log(u.name.length);
   ```
6. Viết `class Cache<K, V>` có `get(key: K): V | undefined`, `set(key: K, value: V, ttlMs: number): void`, tự xoá khi hết hạn. Dùng thử với `Cache<string, User>`.

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
function last<T>(arr: T[]): T | undefined {
  return arr[arr.length - 1];
}
```

```ts
// 2
function groupBy<T, K extends string>(items: T[], keyFn: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = keyFn(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
const byRole = groupBy(users, u => u.role);   // Record<"user" | "admin", User[]>
```

```ts
// 3
type EndpointName = keyof typeof ENDPOINTS;        // "users" | "orders"
type Endpoint = (typeof ENDPOINTS)[EndpointName];  // "/api/users" | "/api/orders"
function call(name: EndpointName) { return fetch(ENDPOINTS[name]); }
```

```ts
// 4
function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}
pick({ id: 1, name: 'Sơn', email: 'a@b.c' }, ['id', 'name']);   // { id: number; name: string }
```

```
// 5
`T` chỉ xuất hiện ở kiểu trả về, không xuất hiện ở tham số nào → TypeScript không suy được,
người gọi tự chọn và hàm không kiểm chứng gì cả. Chữ ký này tương đương `JSON.parse(json) as T`.
Hậu quả: đoạn trên biên dịch sạch, chạy thật thì
  TypeError: Cannot read properties of undefined (reading 'length')
Chữ ký trung thực phải là `function parse(json: string): unknown`, rồi validate ở chỗ gọi.
```

```ts
// 6
class Cache<K, V> {
  private store = new Map<K, { value: V; expiresAt: number }>();

  set(key: K, value: V, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key: K): V | undefined {
    const hit = this.store.get(key);
    if (hit === undefined) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }
}

const c = new Cache<string, User>();
c.set('u:1', { id: 1, name: 'Sơn', email: 'a@b.c' }, 5000);
c.get('u:1')?.name;      // string | undefined
c.set('u:2', 'chuỗi');   // ❌ error TS2345: Argument of type 'string' is not assignable to parameter of type 'User'.
```

</details>

---

Tiếp theo 👉 [05-utility-va-type-nang-cao.md](./05-utility-va-type-nang-cao.md)
