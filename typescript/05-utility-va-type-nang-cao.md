# Bài 5 — Utility type và kiểu nâng cao

Nguyên tắc xuyên suốt bài này: **một nguồn sự thật duy nhất**. Định nghĩa `User` một lần, mọi biến thể (DTO tạo, DTO cập nhật, kiểu trả về API) đều **suy ra** từ nó. Sửa `User` là mọi thứ tự cập nhật.

---

## 1. Vì sao cần

Cách viết tay, ba lần cùng một thứ:

```ts
interface User { id: number; name: string; email: string; password: string; createdAt: Date }
interface CreateUserDto { name: string; email: string; password: string }
interface UpdateUserDto { name?: string; email?: string }
interface UserResponse { id: number; name: string; email: string; createdAt: Date }
```

Giờ đổi `name` thành `fullName`. Bạn phải nhớ sửa đủ 4 chỗ. Quên một chỗ thì TypeScript **không báo gì cả** — bốn interface đó không liên quan gì đến nhau.

Cách suy ra:

```ts
interface User { id: number; name: string; email: string; password: string; createdAt: Date }

type CreateUserDto = Omit<User, 'id' | 'createdAt'>;
type UpdateUserDto = Partial<Omit<User, 'id' | 'createdAt' | 'password'>>;
type UserResponse = Omit<User, 'password'>;
```

Đổi `name` → `fullName` trong `User`, ba type kia tự đổi theo. Còn nếu bạn xoá hẳn một field mà đâu đó vẫn nhắc tên nó:

```ts
type CreateUserDto = Omit<User, 'id' | 'createdAtt'>;
```
`Omit` không báo lỗi khi gõ sai tên key (đây là điểm yếu có thật của nó — xem mục 3). `Pick` thì có:
```ts
type UserResponse = Pick<User, 'id' | 'nmae'>;
```
```
error TS2344: Type '"id" | "nmae"' does not satisfy the constraint 'keyof User'.
  Type '"nmae"' is not assignable to type 'keyof User'.
```

---

## 2. Bộ utility dùng hằng ngày

Bảng tra nhanh, phần sau giải thích chỗ dễ sai:

| Utility | Làm gì | Ví dụ |
|---|---|---|
| `Partial<T>` | Mọi field thành optional | `Partial<User>` |
| `Required<T>` | Mọi field thành bắt buộc | `Required<Config>` |
| `Readonly<T>` | Mọi field thành `readonly` | `Readonly<User>` |
| `Pick<T, K>` | Giữ lại các key `K` | `Pick<User, 'id' \| 'name'>` |
| `Omit<T, K>` | Bỏ đi các key `K` | `Omit<User, 'password'>` |
| `Record<K, V>` | Object có key `K`, giá trị `V` | `Record<Role, number>` |
| `Exclude<T, U>` | Bỏ nhánh khỏi union | `Exclude<Status, 'failed'>` |
| `Extract<T, U>` | Giữ nhánh khỏi union | `Extract<Shape, { kind: 'circle' }>` |
| `NonNullable<T>` | Bỏ `null` và `undefined` | `NonNullable<string \| null>` |
| `ReturnType<F>` | Kiểu trả về của hàm | `ReturnType<typeof getUser>` |
| `Parameters<F>` | Tuple các tham số | `Parameters<typeof send>` |
| `Awaited<T>` | Bóc `Promise` | `Awaited<ReturnType<typeof fetchUser>>` |
| `NoInfer<T>` | Chặn suy kiểu tại vị trí đó | đã gặp ở [bài 04](./04-generic.md) |

### `Partial` — và chỗ nó nguy hiểm

```ts
type UpdateUserDto = Partial<User>;

function update(id: number, dto: UpdateUserDto) { /* ... */ }

update(1, { name: 'Sơn mới' });   // ✅
update(1, {});                    // ✅ — object rỗng cũng hợp lệ
update(1, { id: 999 });           // ✅ — cho phép đổi cả id!
```

`Partial<User>` cho phép sửa **mọi** field, kể cả `id` và `password`. Đây là lỗ hổng mass-assignment kinh điển. Luôn `Omit` trước rồi mới `Partial`:

```ts
type UpdateUserDto = Partial<Omit<User, 'id' | 'password' | 'createdAt'>>;

update(1, { id: 999 });
```
```
error TS2353: Object literal may only specify known properties, and 'id' does not exist in type 'Partial<Omit<User, "id" | "password" | "createdAt">>'.
```

### `Record` — bảng tra bắt buộc đủ nhánh

```ts
type Role = 'user' | 'editor' | 'admin';

const rateLimit: Record<Role, number> = {
  user: 10,
  editor: 100,
};
```
```
error TS2741: Property 'admin' is missing in type '{ user: number; editor: number; }' but required in type 'Record<Role, number>'.
```

Thêm `'owner'` vào `Role` là compiler chỉ ngay vào bảng này. Rất hợp cho: bảng phân quyền, bảng label hiển thị, bảng handler theo event.

```ts
const handlers: Record<EventName, (payload: unknown) => void> = {
  'user.created': p => { /* ... */ },
  'user.deleted': p => { /* ... */ },
};
```

### `ReturnType` + `Awaited` — bám theo hàm thay vì viết lại kiểu

```ts
async function getUser(id: number) {
  const row = await db.users.findOne(id);
  return { id: row.id, name: row.name, isAdmin: row.role === 'admin' };
}

type User = Awaited<ReturnType<typeof getUser>>;
// { id: number; name: string; isAdmin: boolean }
```

Thêm field vào giá trị trả về của `getUser`, `User` tự có thêm. Không có chuyện type và thực tế lệch nhau.

Quên `Awaited`:
```ts
type User = ReturnType<typeof getUser>;   // Promise<{...}>  ← không phải cái bạn muốn
function f(u: User) { u.name; }
```
```
error TS2339: Property 'name' does not exist on type 'Promise<{ id: number; name: string; isAdmin: boolean; }>'.
```

### `Exclude` / `Extract` — làm việc trên union

```ts
type Status = 'draft' | 'published' | 'archived' | 'deleted';

type VisibleStatus = Exclude<Status, 'deleted'>;         // "draft" | "published" | "archived"
type FinalStatus = Extract<Status, 'archived' | 'deleted'>;  // "archived" | "deleted"
```

`Extract` trên discriminated union rất tiện:

```ts
type Shape =
  | { kind: 'circle'; radius: number }
  | { kind: 'rect'; width: number; height: number };

type Circle = Extract<Shape, { kind: 'circle' }>;
// { kind: 'circle'; radius: number }

function drawCircle(c: Circle) { /* ... */ }
```

Không phải tách `Shape` thành 3 interface riêng chỉ để dùng lại một nhánh.

---

## 3. `satisfies` — kiểm tra mà không mất kiểu cụ thể

Đây là toán tử đáng học nhất trong TypeScript hiện đại. Vấn đề nó giải quyết:

```ts
type Route = { path: string; auth: boolean };

const routes: Record<string, Route> = {
  home:  { path: '/', auth: false },
  admin: { path: '/admin', auth: true },
};

routes.home.path;       // string
routes.abcxyz.path;     // ✅ không lỗi — TS nghĩ key nào cũng có
```

Ghi kiểu ở vế trái thì được kiểm tra, nhưng **mất thông tin cụ thể**: TS quên mất chỉ có đúng hai key.

Bỏ kiểu đi thì ngược lại — giữ được key nhưng không ai kiểm tra `Route` viết đúng chưa:

```ts
const routes = {
  home:  { path: '/', auth: false },
  admin: { path: '/admin', aut: true },   // gõ nhầm, không ai báo
};
```

`satisfies` cho cả hai:

```ts
const routes = {
  home:  { path: '/', auth: false },
  admin: { path: '/admin', auth: true },
} satisfies Record<string, Route>;

routes.home.path;    // string
routes.abcxyz;       // ❌ error TS2339: Property 'abcxyz' does not exist on type '{ home: ...; admin: ...; }'.

type RouteName = keyof typeof routes;   // "home" | "admin"
```

Và nó vẫn bắt lỗi gõ sai:

```ts
const routes = {
  admin: { path: '/admin', aut: true },
} satisfies Record<string, Route>;
```
```
error TS2561: Object literal may only specify known properties, but 'aut' does not exist in type 'Route'.
Did you mean to write 'auth'?
```

### Khác biệt với `as const`

```ts
const a = { method: 'POST' } as const;                    // method: "POST", readonly, KHÔNG kiểm tra
const b = { method: 'POST' } satisfies { method: string }; // method: string, kiểm tra
const c = { method: 'POST' } as const satisfies { method: string };  // method: "POST", có kiểm tra
```

Dòng `c` là mẫu dùng cho bảng config: giữ literal + được kiểm tra. So sánh với `as` — `as` **ép**, `satisfies` **kiểm tra**:

```ts
const x = { port: '3000' } as { port: number };          // ✅ ... TS im lặng, sai kiểu thật
const y = { port: '3000' } satisfies { port: number };   // ❌ bắt được
```
```
error TS2322: Type 'string' is not assignable to type 'number'.
```
Lỗi trỏ thẳng vào chữ `'3000'` ở dòng khai báo — không phải chờ đến chỗ dùng.

---

## 4. Mapped type — tự viết utility

Cú pháp: duyệt qua từng key của một kiểu và biến đổi.

```ts
type MyPartial<T> = {
  [K in keyof T]?: T[K];
};

type MyReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

type MyPick<T, K extends keyof T> = {
  [P in K]: T[P];
};
```

Đọc `[K in keyof T]` giống `for (const K of keyof T)`.

### Thêm/bớt modifier bằng `+` và `-`

```ts
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];     // bỏ readonly
};

type Concrete<T> = {
  [K in keyof T]-?: T[K];             // bỏ dấu ?
};

const frozen = { a: 1, b: 2 } as const;
type Thawed = Mutable<typeof frozen>;   // { a: 1; b: 2 } — sửa được
```

### `readonly` sâu (thứ `Readonly<T>` không làm được)

```ts
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

type Config = { db: { host: string; port: number }; debug: boolean };

const c: DeepReadonly<Config> = { db: { host: 'x', port: 1 }, debug: false };
c.db.host = 'y';
```
```
error TS2540: Cannot assign to 'host' because it is a read-only property.
```

Với `Readonly<Config>` thường thì dòng đó **không** lỗi — chỉ tầng ngoài cùng được bảo vệ.

### Đổi tên key bằng `as`

```ts
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User { id: number; name: string }

type UserGetters = Getters<User>;
// { getId: () => number; getName: () => string }
```

Và lọc bỏ key bằng cách map sang `never`:

```ts
type OmitByValue<T, V> = {
  [K in keyof T as T[K] extends V ? never : K]: T[K];
};

interface Row { id: number; name: string; save(): void; delete(): void }

type Data = OmitByValue<Row, Function>;
// { id: number; name: string }
```

Ứng dụng thật: lấy phần "dữ liệu thuần" của một entity để trả về JSON, bỏ hết method.

---

## 5. Conditional type và `infer`

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<'abc'>;    // true
type B = IsString<42>;       // false
```

`infer` là "khai báo một biến kiểu ngay tại chỗ khớp mẫu":

```ts
type MyReturnType<F> = F extends (...args: any[]) => infer R ? R : never;
type MyAwaited<T> = T extends Promise<infer U> ? U : T;
type ElementOf<T> = T extends (infer E)[] ? E : never;

type X = ElementOf<User[]>;              // User
type Y = MyAwaited<Promise<string>>;     // string
```

### Phân phối trên union — điều gây bất ngờ nhất

Conditional type **tự động chạy trên từng nhánh** của union:

```ts
type ToArray<T> = T extends any ? T[] : never;

type R = ToArray<string | number>;
// KHÔNG phải (string | number)[]
// mà là string[] | number[]
```

Đây chính là cách `Exclude` hoạt động:

```ts
type MyExclude<T, U> = T extends U ? never : T;

type Z = MyExclude<'a' | 'b' | 'c', 'b'>;
// chạy 3 lần: 'a'→'a', 'b'→never, 'c'→'c'
// kết quả: 'a' | 'c'
```

Muốn **tắt** phân phối thì bọc trong tuple:

```ts
type IsUnionOfString<T> = [T] extends [string] ? true : false;

type P = IsUnionOfString<'a' | 'b'>;   // true (kiểm tra cả union một lần)
```

### `infer` có ràng buộc

```ts
type FirstParam<F> = F extends (first: infer P, ...rest: any[]) => any ? P : never;

function send(url: string, body: object) {}
type U = FirstParam<typeof send>;   // string
```

### Cẩn thận: đệ quy quá sâu

```ts
type Repeat<T, N extends number, Acc extends T[] = []> =
  Acc['length'] extends N ? Acc : Repeat<T, N, [...Acc, T]>;

type Big = Repeat<string, 5000>;
```
```
error TS2589: Type instantiation is excessively deep and possibly infinite.
```

Gặp lỗi này nghĩa là bạn đang đẩy hệ thống kiểu quá xa. Trong code sản phẩm, gần như luôn có cách đơn giản hơn.

---

## 6. Template literal type

```ts
type Lang = 'vi' | 'en';
type Page = 'home' | 'about';

type Path = `/${Lang}/${Page}`;
// "/vi/home" | "/vi/about" | "/en/home" | "/en/about"

const p: Path = '/vi/home';    // ✅
const q: Path = '/fr/home';    // ❌
```
```
error TS2322: Type '"/fr/home"' is not assignable to type '"/en/about" | "/en/home" | "/vi/about" | "/vi/home"'.
```

Bốn hàm chuyển chữ có sẵn: `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`.

Dùng thật ở đâu? Tên event và cache key:

```ts
type Entity = 'user' | 'order';
type Action = 'created' | 'updated' | 'deleted';
type EventName = `${Entity}.${Action}`;
// "user.created" | "user.updated" | ... (6 giá trị)

function emit(event: EventName, payload: unknown) { /* ... */ }

emit('user.created', {});    // ✅
emit('user.create', {});     // ❌ error TS2345: Argument of type '"user.create"' is not assignable to parameter of type 'EventName'.
```

Trước đây tham số này là `string` và gõ sai tên event chỉ phát hiện được lúc chạy — nếu may.

---

## 7. Ghép lại: DTO cho một module thật

```ts
// src/users/user.entity.ts
export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

// Field do hệ thống sinh ra, client không bao giờ được gửi lên
type SystemField = 'id' | 'createdAt' | 'updatedAt';
// Field không bao giờ được trả về client
type SecretField = 'passwordHash';

export type CreateUserDto = Omit<User, SystemField | SecretField> & { password: string };
export type UpdateUserDto = Partial<Omit<CreateUserDto, 'email'>>;
export type UserResponse = Omit<User, SecretField>;
export type UserListItem = Pick<User, 'id' | 'name' | 'role'>;
```

Kiểm chứng ngay tại chỗ định nghĩa, không cần chạy:

```ts
const _check1: CreateUserDto = { email: 'a@b.c', name: 'Sơn', role: 'user', password: '123456' };

const _check2: UserResponse = { id: 1, email: 'a@b.c', name: 'Sơn', role: 'user',
                                createdAt: new Date(), updatedAt: new Date(), passwordHash: 'x' };
```
```
error TS2353: Object literal may only specify known properties, and 'passwordHash' does not exist in type 'UserResponse'.
```

Dòng lỗi đó chính là tấm chắn: **không cách nào vô tình trả `passwordHash` về client** mà compiler im lặng.

---

## Bài tập

1. Từ `interface Product { id: number; sku: string; name: string; price: number; cost: number; createdAt: Date }`, viết:
   - `CreateProductDto` (không có `id`, `createdAt`)
   - `UpdateProductDto` (mọi field optional, không sửa được `sku`)
   - `PublicProduct` (không lộ `cost`)
2. Viết `type NullableFields<T>` biến mọi field thành `T[K] | null`, giữ nguyên optional.
3. Viết `type FunctionKeys<T>` trả về union tên các key có giá trị là hàm. Kiểm tra với `{ id: number; save(): void; load(): Promise<void> }` → kết quả phải là `"save" | "load"`.
4. Có `type Method = 'get' | 'post'` và `type Resource = 'users' | 'orders'`. Viết `type ApiHandlerName` ra dạng `"getUsers" | "getOrders" | "postUsers" | "postOrders"`.
5. Vì sao `type R = ToArray<string | number>` với `type ToArray<T> = T extends any ? T[] : never` lại ra `string[] | number[]`? Sửa nó để ra `(string | number)[]`.
6. Đoạn nào an toàn hơn và vì sao?
   ```ts
   const config1 = { port: 3000, host: 'localhost' } as { port: number; host: string };
   const config2 = { port: 3000, host: 'localhost' } satisfies { port: number; host: string };
   ```
   Thử đổi `port` thành `'3000'` ở cả hai và ghi lại kết quả.

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
type CreateProductDto = Omit<Product, 'id' | 'createdAt'>;
type UpdateProductDto = Partial<Omit<Product, 'id' | 'sku' | 'createdAt'>>;
type PublicProduct = Omit<Product, 'cost'>;
```

```ts
// 2
type NullableFields<T> = {
  [K in keyof T]: T[K] | null;
};
```

```ts
// 3
type FunctionKeys<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never;
}[keyof T];

type R = FunctionKeys<{ id: number; save(): void; load(): Promise<void> }>;   // "save" | "load"
```
Mẹo: map sang chính tên key rồi `[keyof T]` để "đổ" object thành union giá trị.

```ts
// 4
type ApiHandlerName = `${Method}${Capitalize<Resource>}`;
// "getUsers" | "getOrders" | "postUsers" | "postOrders"
```

```ts
// 5
// Conditional type phân phối trên từng nhánh union: T='string' cho string[], T='number' cho number[].
// Tắt phân phối bằng cách bọc tuple:
type ToArray<T> = [T] extends [any] ? T[] : never;
type R = ToArray<string | number>;   // (string | number)[]
```

```
// 6
config2 an toàn hơn.
Đổi port thành '3000':
  - config1: `as` là ép kiểu, không phải kiểm tra. Nó chỉ chặn khi hai kiểu không chồng lấn
    chút nào; ở đây object vẫn "gần giống" nên TS chấp nhận, và `config1.port` mang kiểu
    number trong khi runtime là chuỗi '3000'.
  - config2: error TS2322: Type 'string' is not assignable to type 'number'.
    → báo ngay tại dòng khai báo, trỏ đúng vào chữ '3000'.
Ngoài ra config2 vẫn giữ kiểu suy ra đầy đủ, còn config1 bị ép về đúng kiểu bạn viết.
```

</details>

---

Tiếp theo 👉 [06-class-va-decorator.md](./06-class-va-decorator.md)
