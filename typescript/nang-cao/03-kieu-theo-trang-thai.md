# Bài A3 — Kiểu mang trạng thái: builder, phantom type, mixin

Cho tới giờ kiểu chỉ mô tả **hình dạng dữ liệu**. Bài này dùng kiểu để mô tả **thứ tự thao tác hợp lệ** — biến những lỗi "gọi sai lúc" từ lỗi runtime thành lỗi biên dịch.

Đây là cơ chế đứng sau `zod`, `drizzle`, `knex`, `@tanstack/query`.

---

## 1. Builder tích luỹ kiểu

Ý tưởng: mỗi lần gọi method, kiểu trả về **giàu hơn** kiểu trước đó.

```ts
type Prettify<T> = { [K in keyof T]: T[K] } & {};

class Form<T extends Record<string, unknown> = {}> {
  private data: Record<string, unknown> = {};

  field<K extends string, V>(name: K, value: V): Form<Prettify<T & { [P in K]: V }>> {
    this.data[name] = value;
    return this as any;          // ← runtime vẫn là chính nó; chỉ kiểu thay đổi
  }

  build(): T { return this.data as T; }
}

const f = new Form().field('email', 'a@b.c').field('age', 30).field('tags', ['x']);
const out = f.build();
console.log(out);
console.log(out.email.toUpperCase(), out.age.toFixed(1), out.tags.length);
out.phone;
```
```bash
$ npx tsc --noEmit
```
```
src/y3.ts(17,5): error TS2339: Property 'phone' does not exist on type '{ age: number; email: string; tags: string[]; }'.
```
```bash
$ node src/y3.ts
```
```
{ email: 'a@b.c', age: 30, tags: [ 'x' ] }
A@B.C 30.0 1
```

Ba chi tiết làm nên mẫu này:

1. **`T` mặc định là `{}`** — bắt đầu từ rỗng, không phải `any`.
2. **`{ [P in K]: V }`** thay vì `Record<K, V>` — cả hai đều được, nhưng mapped type giữ literal key tốt hơn khi `K` là union.
3. **`return this as any`** — bắt buộc. Runtime không có gì thay đổi, chỉ kiểu tĩnh đi tiếp. Đây là một trong số ít chỗ `as any` là đúng, và nó phải bị **giam trong 1 dòng** của thư viện, không lọt ra ngoài.

`Prettify` không đổi ngữ nghĩa nhưng đổi cái người dùng nhìn thấy: không có nó, tooltip hiện `Form<{} & { email: string } & { age: number }>`; có nó, hiện `Form<{ email: string; age: number }>`.

---

## 2. Bắt buộc thứ tự gọi — ẩn hẳn method chưa hợp lệ

Yêu cầu: `where()` chỉ được gọi sau `from()`.

### Cách sai (hay gặp): trả `never`

```ts
type Q<Has extends string = never> = {
  from(t: string): Q<Has | 'from'>;
  where(c: string): 'from' extends Has ? Q<Has | 'where'> : never;
  build(): 'from' extends Has ? string : never;
};
declare const q: Q;
q.where('id = 1');    // ← không có lỗi nào!
```

Không lỗi, vì gọi một hàm trả `never` là hợp lệ; chỉ khi **dùng** kết quả mới hỏng. Người dùng thấy lỗi ở dòng cách đó 5 dòng, không hiểu vì sao.

### Cách đúng: method không tồn tại

```ts
type Q<Has extends string = never> = {
  from(t: string): Q<Has | 'from'>;
} & ('from' extends Has
      ? { where(c: string): Q<Has | 'where'>; build(): string }
      : {});

declare const q: Q;
const sql = q.from('users').where('id = 1').build();   // ✅ string
q.where('id = 1');
q.build();
```
```
src/y2.ts(8,3): error TS2339: Property 'where' does not exist on type '{ from(t: string): Q<"from">; }'.
src/y2.ts(9,3): error TS2339: Property 'build' does not exist on type '{ from(t: string): Q<"from">; }'.
```

Lỗi rơi **đúng vào dòng gọi sai**, và autocomplete chỉ gợi ý `from` khi chưa có `from`. Nguyên tắc: **đưa điều kiện lên tầng object, đừng để ở tầng kiểu trả về.**

---

## 3. Phantom type — trạng thái không tồn tại lúc chạy

Builder ở trên gắn trạng thái vào một class. Khi dữ liệu chỉ là object thuần (đi qua HTTP, qua database) thì dùng **phantom type**: một tham số kiểu không tương ứng với field nào có thật.

```ts
declare const S: unique symbol;
type State = 'draft' | 'sent' | 'paid';
type Invoice<St extends State> = { id: string; total: number; readonly [S]?: St };

declare function create(id: string, total: number): Invoice<'draft'>;
declare function send(i: Invoice<'draft'>): Invoice<'sent'>;
declare function pay(i: Invoice<'sent'>): Invoice<'paid'>;

const d = create('i1', 100);
const s = send(d);
const p = pay(s);     // ✅ đúng luồng draft → sent → paid

pay(d);               // dòng 13: bỏ qua bước send
send(s);              // dòng 14: gửi lại hoá đơn đã gửi
```
```
src/y1.ts(13,5): error TS2345: Argument of type 'Invoice<"draft">' is not assignable to parameter of type 'Invoice<"sent">'.
  Type '"draft"' is not assignable to type '"sent"'.
src/y1.ts(14,6): error TS2345: Argument of type 'Invoice<"sent">' is not assignable to parameter of type 'Invoice<"draft">'.
  Type '"sent"' is not assignable to type '"draft"'.
```

Vì sao viết `readonly [S]?: St`:
- **`unique symbol` làm key** → không đụng với field thật nào, và `JSON.stringify` bỏ qua symbol nên dữ liệu gửi đi không đổi.
- **`?` (optional)** → bạn tạo `Invoice<'draft'>` từ object literal bình thường mà không phải bịa giá trị cho `[S]`.
- **`readonly`** → không ai gán đè trạng thái.

So sánh với cách "để `status: 'draft' | 'sent'` làm field thật": field thật thì `if (i.status === 'draft')` narrowing được lúc chạy, nhưng **không** ngăn được việc gọi `pay()` trên hoá đơn draft. Hai cách bổ sung cho nhau — phantom type chặn ở biên dịch, discriminated union kiểm ở runtime.

⚠️ Phantom type là **niềm tin**, không phải bằng chứng: `create()` chỉ *khai* là trả `Invoice<'draft'>`. Nếu dữ liệu đến từ database, phải parse và kiểm tra thật (bài A5) rồi mới gán nhãn.

---

## 4. Mixin — ghép hành vi vào class

TypeScript không có multiple inheritance. Mẫu chính thức là hàm nhận class trả class.

```ts
type Ctor<T = {}> = new (...args: any[]) => T;

function Timestamped<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
    createdAt = new Date();
    age() { return Date.now() - this.createdAt.getTime(); }
  };
}

class User { constructor(public name: string) {} }

const TUser = Timestamped(User);
const u = new TUser('Sơn');
u.name; u.age(); u.createdAt;    // ✅ có đủ cả hai bên
u.nope;
```
```
src/m1.ts(14,3): error TS2339: Property 'nope' does not exist on type 'Timestamped.(Anonymous class) & User'.
```

Chú ý tên kiểu trong lỗi: `Timestamped.(Anonymous class) & User` — TypeScript tự ghép. Ba ràng buộc bắt buộc phải nhớ:

1. **`Ctor` phải dùng `...args: any[]`.** Nếu viết `new () => T`, class nào có constructor tham số sẽ không truyền được vào mixin.
2. **Field khai trong mixin không dùng được ở constructor của Base.** Thứ tự khởi tạo là Base trước, mixin sau.
3. **Không đặt tên cho class trả về được.** `type TUser = ...` không viết tay được; phải lấy bằng `InstanceType<typeof TUser>`.

```ts
type TUserInstance = InstanceType<typeof TUser>;
```

### `abstract new` — nhận cả class trừu tượng

```ts
type Ctor<T = {}> = new (...args: any[]) => T;
type AbstractCtor<T = {}> = abstract new (...args: any[]) => T;

abstract class Base2 { abstract run(): void }
declare function make<T>(c: Ctor<T>): T;
declare function makeA<T>(c: AbstractCtor<T>): T;

make(Base2);      // dòng 19
makeA(Base2);     // ✅
```
```
src/m1.ts(19,6): error TS2345: Argument of type 'typeof Base2' is not assignable to parameter of type 'Ctor<Base2>'.
  Cannot assign an abstract constructor type to a non-abstract constructor type.
```

Khi nào dùng cái nào: hàm **tạo instance** (factory, DI container) phải nhận `Ctor` — vì không `new` được class abstract. Hàm chỉ **đọc metadata** (decorator, registry, `instanceof`) thì nhận `AbstractCtor` để không loại trừ base class.

---

## 5. `this` type — cho phép kế thừa mà không mất chuỗi

Builder ở mục 1 dùng generic. Với class kế thừa, có công cụ gọn hơn: kiểu `this`.

```ts
class QueryBase {
  private parts: string[] = [];
  where(c: string): this { this.parts.push(c); return this; }
  toSQL() { return this.parts.join(' AND '); }
}

class UserQuery extends QueryBase {
  activeOnly(): this { return this.where('active = 1'); }
}

new UserQuery().where('id = 1').activeOnly().toSQL();   // ✅ chuỗi không đứt
```

Nếu `where` khai `: QueryBase` thay vì `: this`, dòng trên hỏng:
```
error TS2339: Property 'activeOnly' does not exist on type 'QueryBase'.
```

`this` type có nghĩa "kiểu của lớp con thực tế lúc gọi". Nó **không** dùng được ở vị trí tham số của method static, và không đặt được trong `type` alias độc lập.

---

## 6. Chọn công cụ nào

| Bài toán | Công cụ | Vì sao |
|---|---|---|
| Gom dần các field, kiểu kết quả tăng dần | builder generic tích luỹ (mục 1) | kiểu ra là object phẳng, dùng tiếp được |
| Bắt buộc thứ tự gọi method | intersection có điều kiện (mục 2) | method chưa hợp lệ **biến mất** khỏi autocomplete |
| Trạng thái vòng đời của dữ liệu thuần | phantom type (mục 3) | không thêm field runtime, JSON không đổi |
| Ghép hành vi dùng chung cho nhiều class | mixin (mục 4) | tránh chuỗi kế thừa sâu |
| Chuỗi method sống sót qua kế thừa | `this` type (mục 5) | ngắn hơn generic, không phải truyền tham số kiểu |

Cảnh báo chung: **mọi mẫu trong bài này đều đánh đổi bằng thông báo lỗi khó đọc.** Trước khi đưa vào code chung, hãy tự gõ sai một lần và đọc lỗi. Nếu chính bạn không hiểu lỗi trong 10 giây, đồng đội sẽ `as any`.

---

## Bài tập

1. Viết `Form` như mục 1 nhưng thêm `optional<K, V>(name, value)` khiến field mới là optional (`{ [P in K]?: V }`). Kiểm tra kiểu kết quả có `?` không.

2. Sửa `Q` ở mục 2 để `from()` chỉ được gọi **một lần** — gọi lần hai phải báo TS2339.

3. Thêm trạng thái `'cancelled'` vào `Invoice`. Cho phép huỷ từ `draft` hoặc `sent`, nhưng không huỷ được `paid`. Viết `cancel()` và thử cả ba trường hợp.

4. Viết mixin `Serializable` thêm `toJSON()`. Ghép cả `Timestamped` lẫn `Serializable` vào `User` và ghi lại tên kiểu trong thông báo lỗi khi truy cập field không có.

5. Viết một hàm `register<T>(c: ???)` để đăng ký class vào registry mà **chấp nhận cả abstract class**. Rồi viết `instantiate<T>(c: ???)` chỉ chấp nhận class cụ thể. Thử truyền nhầm và dán lỗi.

6. Đổi `where(c: string): this` thành `where(c: string): QueryBase` rồi chạy lại chuỗi ở mục 5. Dán lỗi và giải thích.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `optional<K extends string, V>(n: K, v: V): Form<Prettify<T & { [P in K]?: V }>>`. Kiểu kết quả có `email?: string | undefined`.

**2.**
```ts
type Q<Has extends string = never> =
  ('from' extends Has ? {} : { from(t: string): Q<Has | 'from'> })
  & ('from' extends Has ? { where(c: string): Q<Has | 'where'>; build(): string } : {});
```
Sau `from()` thì `from` không còn trong kiểu → `error TS2339: Property 'from' does not exist on type ...`.

**3.**
```ts
type State = 'draft' | 'sent' | 'paid' | 'cancelled';
declare function cancel(i: Invoice<'draft'> | Invoice<'sent'>): Invoice<'cancelled'>;
```
`cancel(p)` báo `error TS2345: Argument of type 'Invoice<"paid">' is not assignable to parameter of type 'Invoice<"draft"> | Invoice<"sent">'.`

**4.** Tên kiểu trong lỗi dài dần theo số mixin: `Serializable.(Anonymous class) & Timestamped.(Anonymous class) & User`. Đây chính là lý do không nên chồng quá 2–3 mixin.

**5.** `register<T>(c: AbstractCtor<T>)`, `instantiate<T>(c: Ctor<T>)`. Truyền abstract class vào `instantiate` cho
`error TS2345: ... Cannot assign an abstract constructor type to a non-abstract constructor type.`

**6.** `error TS2339: Property 'activeOnly' does not exist on type 'QueryBase'.` Vì kiểu trả về bị chốt cứng ở lớp cha, thông tin "thực ra đang là `UserQuery`" bị mất ngay sau lời gọi đầu tiên.

</details>

---

👉 Tiếp: [A4 — Declaration file và augmentation](./04-declaration-va-augmentation.md)
