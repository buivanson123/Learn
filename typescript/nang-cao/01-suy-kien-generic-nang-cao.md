# Bài A1 — Suy kiểu generic ở tầng sâu

Bài 04 đã dạy cú pháp generic. Bài này trả lời câu khác: **TypeScript quyết định `T` bằng cách nào**, và tại sao có lúc nó ra kiểu bạn không ngờ tới.

Toàn bộ output trong bài chạy bằng `tsc 7.0.2`, `strict: true`.

---

## 0. Mẹo in kiểu ra màn hình

Trước khi vào bài, cần một cách **xem kiểu mà TypeScript thật sự suy ra** ngay trên terminal (không phải hover chuột trong VS Code). Cách gọn nhất: cố tình gán vào `never`, TypeScript sẽ in kiểu đó trong thông báo lỗi.

```ts
const arr = [1, 2, 3].map((n) => ({ v: n }));
const _show: never = null as any as typeof arr;   // ← dòng để in kiểu
```
```bash
$ npx tsc --noEmit
```
```
src/demo.ts(2,7): error TS2322: Type '{ v: number; }[]' is not assignable to type 'never'.
                                     ↑ đây là kiểu thật của arr
```

Cả bài này dùng thủ thuật đó. Khi bạn thấy dòng `const _x: never = ...`, hiểu là "in kiểu ra".

---

## 1. TypeScript suy kiểu từ đâu — và ưu tiên thế nào

Khi gọi `f(a, b)`, trình biên dịch gom **ứng viên (candidate)** cho mỗi tham số kiểu từ từng vị trí đối số, rồi chọn một kiểu duy nhất.

### Nhiều ứng viên xung đột → nó **không** tạo union

```ts
function pick<T>(a: T, b: T): T { return a; }
const p1 = pick('x', 1);
```
```
src/b1.ts(2,22): error TS2345: Argument of type '1' is not assignable to parameter of type '"x"'.
```

Đọc kỹ thông báo: `T` đã bị chốt thành `"x"` từ đối số **đầu tiên**, rồi `1` bị đo lại theo đó. TypeScript không tự nghĩ ra `T = "x" | 1`.

Muốn union thì phải nói rõ:

```ts
const p2 = pick<string | number>('x', 1);   // ✅ không lỗi
```

Đây là lý do các hàm kiểu `Array.prototype.includes` hay tự viết `contains(list, item)` hay báo lỗi khó hiểu: `T` bị chốt bởi tham số đứng trước.

### Vị trí trả về có ưu tiên thấp nhất

```ts
declare function make<T>(): T[];

const m1: string[] = make();     // ← T lấy từ kiểu đích: string
const m2 = make();               // ← không có gì để suy
const _m2: never = null as any as typeof m2;
```
```
src/b1.ts(14,7): error TS2322: Type 'unknown[]' is not assignable to type 'never'.
```

Không có đối số và không có kiểu đích → `T` rơi về `unknown` (trước TS 3.0 là `{}`). Nghĩa là: **kiểu đích của phép gán cũng là một nguồn suy kiểu**, nhưng chỉ được dùng khi đối số không nói gì.

### Contextual typing: callback được suy ngược từ chữ ký

```ts
const nums = [1, 2, 3];
const mapped = nums.map((n) => ({ v: n }));   // n không cần ghi kiểu
const _mapped: never = null as any as typeof mapped;
```
```
src/b1.ts(19,7): error TS2322: Type '{ v: number; }[]' is not assignable to type 'never'.
```

`n: number` đến từ chữ ký `map<U>(cb: (v: T) => U): U[]` — `T` đã là `number` nên `v` là `number`. Chiều thông tin chạy **từ ngoài vào trong**. Hệ quả thực dụng: **đừng ghi kiểu cho tham số callback**, ghi vào là bạn chặn mất luồng này và dễ ghi sai.

---

## 2. Giới hạn thật: hàm generic không "đi xuyên" được hàm khác

Đây là chỗ hay làm người ta bỏ cuộc khi viết `compose`, `pipe`, hoặc HOC.

```ts
declare function compose<A, B, C>(f: (a: A) => B, g: (b: B) => C): (a: A) => C;
declare function id<T>(x: T): T;
declare function len(s: string): number;

const c1 = compose(id, len);
```
```
src/b1.ts(25,20): error TS2345: Argument of type '<T>(x: T) => T' is not assignable to parameter of type '(a: unknown) => string'.
  Type 'unknown' is not assignable to type 'string'.
```

Chuyện gì xảy ra: `compose` cần `f: (a: A) => B`. `id` vẫn còn tham số kiểu `T` chưa quyết định. TypeScript **không giữ `T` lại để giải sau** — nó ép `id` về một chữ ký cụ thể ngay lúc đó, chọn `unknown` cho `T`, thế là hỏng.

Ba cách xử lý, xếp theo mức độ nên dùng:

**a) Chốt tay tham số kiểu ở lời gọi ngoài**
```ts
const c2 = compose<string, string, number>(id, len);   // ✅
```

**b) Đảo thứ tự để hàm generic không nằm ở vị trí đối số**
```ts
declare function pipe<A, B>(a: A, f: (a: A) => B): B;
const c3 = pipe('abc', len);      // ✅ A = string suy từ đối số 1
```

**c) Chấp nhận và viết overload cho từng độ dài** — đây chính là lý do `rxjs`, `lodash/fp`, `zod` đều có 10 overload của `pipe`. Không phải họ thích, mà vì trình biên dịch không làm khác được.

---

## 3. `const` type parameter — giữ literal mà không cần `as const`

Bài 05 đã dùng `as const`. Từ TS 5.0 có cách đẩy việc đó vào **chữ ký hàm**, để người gọi không phải nhớ.

```ts
function tuple1<T extends readonly unknown[]>(arr: T): T { return arr; }
const r1 = tuple1(['a', 'b']);

function tuple2<const T extends readonly unknown[]>(arr: T): T { return arr; }
const r2 = tuple2(['a', 'b']);
```
```
src/a1.ts(9,7):  error TS2322: Type 'string[]' is not assignable to type '"x"'.
                                    ↑ r1 — literal bị mở rộng thành string[]
src/a1.ts(10,7): error TS2322: Type 'readonly ["a", "b"]' is not assignable to type '"x"'.
                                    ↑ r2 — giữ nguyên tuple literal
```

Khác biệt: `r1: string[]`, `r2: readonly ["a", "b"]`.

**Nó nằm ở đâu trong code thật:** mọi hàm nhận "bảng cấu hình" đều nên có `const`.

```ts
// ❌ người dùng phải nhớ gõ `as const`, quên là mất kiểu
function defineRoutes<T extends Record<string, string>>(r: T): T { return r; }
const routes1 = defineRoutes({ home: '/', user: '/users/:id' } as const);

// ✅ tự động, người dùng không cần biết gì
function defineRoutes2<const T extends Record<string, string>>(r: T): T { return r; }
const routes2 = defineRoutes2({ home: '/', user: '/users/:id' });
//    routes2.user: "/users/:id"  ← literal, dùng được cho template literal type
```

Bài A9 dựng cả một router type-safe đúng trên cơ chế này.

⚠️ Hai cái bẫy đi kèm:

**a) Ràng buộc phải cho phép `readonly`.** `const` suy như thể bạn viết `as const`, mà `as const` biến mọi mảng thành `readonly` tuple. Nếu ràng buộc còn ghi `string[]` thì literal bị mở rộng ngược lại:

```ts
function c1<const T extends { envs: string[] }>(c: T): T { return c; }
const a1 = c1({ name: 'a', envs: ['dev', 'prod'] });
const _a1: never = null as any as (typeof a1)['envs'];

function c2<const T extends { envs: readonly string[] }>(c: T): T { return c; }
const a2 = c2({ name: 'a', envs: ['dev', 'prod'] });
const _a2: never = null as any as (typeof a2)['envs'];
```
```
src/v1.ts(20,7): error TS2322: Type 'string[]' is not assignable to type 'never'.
                                    ↑ a1.envs — const bị ràng buộc kéo ngược về string[]
src/v1.ts(23,7): error TS2322: Type 'readonly ["dev", "prod"]' is not assignable to type 'never'.
                                    ↑ a2.envs — đúng cái ta muốn
```

**b) `readonly` lan sang code cũ.** Hàm bên trong nếu gọi `envs.push(...)` sẽ hỏng, vì `readonly string[]` không có `push` (TS2339). Đó là cái giá của việc giữ literal.

`const` **không** làm object bất biến ở runtime — nó thuần tuý là chuyện của trình biên dịch.

---

## 4. `NoInfer` — tắt một vị trí suy kiểu

Đã nhắc ở bài 04, ở đây là chỗ nó cứu bạn thật sự: **khi một tham số là "nguồn sự thật" còn tham số kia chỉ là giá trị người dùng nhập**.

```ts
function setStatus<T extends string>(allowed: readonly T[], value: T) {}
setStatus(['idle', 'busy'], 'wat');          // dòng 5

function setStatus2<T extends string>(value: T, allowed: readonly T[]) {}
setStatus2('wat', ['idle', 'busy']);         // dòng 7
```
```bash
$ npx tsc --noEmit
$                                            ← không có dòng nào. Cả hai đều lọt.
```

Bất ngờ: **đổi thứ tự không cứu được gì**. Khác với `pick('x', 1)` ở mục 1 (hai ứng viên đá nhau nên báo lỗi), ở đây ràng buộc là `T extends string` nên trình biên dịch vui vẻ gom thành `T = "idle" | "busy" | "wat"` — `'wat'` tự biến thành một trạng thái hợp lệ.

`NoInfer` nói thẳng "vị trí này không được góp ứng viên":

```ts
function setStatus3<T extends string>(value: NoInfer<T>, allowed: readonly T[]) {}
setStatus3('wat', ['idle', 'busy']);         // dòng 9
```
```
src/v1.ts(9,12): error TS2345: Argument of type '"wat"' is not assignable to parameter of type '"busy" | "idle"'.
```

### Nó còn sửa được *vị trí* báo lỗi

Trường hợp hay gặp hơn: hàm dịch ngôn ngữ.

```ts
function translate<T extends string>(key: T, dict: Record<T, string>) {}
translate('hom', { home: 'Trang chủ', about: 'Giới thiệu' });   // gõ thiếu chữ 'e'
```
```
src/v1.ts(28,20): error TS2561: Object literal may only specify known properties, but 'home' does not exist in type 'Record<"hom", string>'. Did you mean to write 'hom'?
```

Có lỗi, nhưng lỗi **chỉ sai chỗ**: nó gạch dưới `home` trong từ điển và bảo bạn đổi thành `hom` — tức là trình biên dịch tin lỗi chính tả và nghi ngờ dữ liệu. Thêm `NoInfer`:

```ts
function translate2<T extends string>(key: NoInfer<T>, dict: Record<T, string>) {}
translate2('hom', { home: 'Trang chủ', about: 'Giới thiệu' });
```
```
src/v1.ts(30,12): error TS2345: Argument of type '"hom"' is not assignable to parameter of type '"about" | "home"'.
```

Bây giờ nó gạch đúng `'hom'` và liệt kê các key hợp lệ.

Quy tắc nhớ: **`NoInfer` đặt ở vị trí "người dùng nhập", để nguồn sự thật là vị trí kia.**

---

## 5. Method bivariance — lỗ hổng cố ý còn sót lại

Bài 11 đã nói `strictFunctionTypes` bắt tham số hàm contravariant. Nhưng có một ngoại lệ mà **rất nhiều người không biết**: nó chỉ áp cho hàm viết dạng **property**, không áp cho hàm viết dạng **method**.

```ts
interface Ev { kind: string }
interface Click extends Ev { kind: 'click'; x: number }

// viết kiểu method
interface HandlerM { handle(e: Ev): void }
interface NarrowM  { handle(e: Click): void }
declare let hm: HandlerM;
declare let nm: NarrowM;
hm = nm;                       // ← dòng 9

// viết kiểu property
interface HandlerP { handle: (e: Ev) => void }
interface NarrowP  { handle: (e: Click) => void }
declare let hp: HandlerP;
declare let np: NarrowP;
hp = np;                       // ← dòng 16
```
```
src/b2.ts(16,1): error TS2322: Type 'NarrowP' is not assignable to type 'HandlerP'.
  Types of property 'handle' are incompatible.
    Type '(e: Click) => void' is not assignable to type '(e: Ev) => void'.
      Types of parameters 'e' and 'e' are incompatible.
        Property 'x' is missing in type 'Ev' but required in type 'Click'.
```

Chỉ **dòng 16** lỗi. Dòng 9 lọt qua — mặc dù nguy hiểm y hệt: `hm.handle({ kind: 'x' })` sẽ chạy vào `NarrowM.handle` và đọc `e.x` không tồn tại.

**Vì sao TypeScript cố ý để vậy:** vì `Array<T>` khai `push(...items: T[])` dạng method. Nếu method contravariant thì `Dog[]` không gán được vào `Animal[]` và gần như mọi codebase JS sẽ đỏ lòm. Đội TS chọn giữ tương thích.

**Áp dụng:** khi bạn tự định nghĩa interface cho handler/callback và muốn được kiểm tra chặt, **viết dạng property**:

```ts
interface Store {
  subscribe: (cb: (s: State) => void) => void;   // ✅ được kiểm tra contravariant
  // subscribe(cb: (s: State) => void): void;    // ❌ bivariant, lọt lỗi
}
```

---

## 6. Suy kiểu bên trong generic chưa được giải

Trong thân hàm generic, `T` là một ẩn số — narrowing hoạt động nhưng kết quả có dạng lạ:

```ts
function f<T extends string | number>(x: T) {
  if (typeof x === 'string') {
    const _a: never = null as any as typeof x;
  }
}
```
```
src/d2.ts(10,38): error TS2322: Type 'T & string' is not assignable to type 'never'.
```

Kiểu là `T & string`, **không phải** `string`. Hệ quả rất thực tế:

```ts
function upper<T extends string | number>(x: T): T {
  if (typeof x === 'string') return x.toUpperCase();   // ❌
  return x;
}
```
```
error TS2322: Type 'string' is not assignable to type 'T'.
  'string' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint 'string | number'.
```

Thông báo này nói đúng bản chất: nếu ai gọi `upper<'abc'>('abc')` thì hàm phải trả về đúng `'abc'`, mà `toUpperCase()` trả `string`. **Không có cách nào làm đúng** — nên đổi thiết kế chữ ký:

```ts
function upper2<T extends string | number>(x: T): T extends string ? string : T {
  return (typeof x === 'string' ? x.toUpperCase() : x) as any;   // ← `as any` ở đây là chấp nhận được
}
```

Quy tắc: **conditional return type gần như luôn cần một `as` trong thân hàm.** Trình biên dịch không tự chứng minh được nhánh nào khớp nhánh nào. Đây là một trong số ít chỗ dùng `as` mà không phải là code tệ — nhưng chỉ khi chữ ký ở ngoài đã đúng và có test.

---

## 7. Bảng tra nhanh

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `T` bị chốt sai theo đối số đầu | ứng viên đầu tiên thắng | truyền tường minh, hoặc `NoInfer` ở vị trí kia |
| Kiểu ra `unknown[]` | không có nguồn suy kiểu nào | thêm kiểu đích hoặc ghi tay |
| Truyền hàm generic vào hàm khác → lỗi `unknown` | generic không đi xuyên đối số | chốt tham số kiểu, hoặc đảo thứ tự đối số |
| Mất literal `'/users/:id'` → `string` | không có `as const` | thêm `const` vào tham số kiểu |
| Handler nhận kiểu hẹp hơn mà không báo lỗi | method bivariance | khai dạng property `f: (x: T) => void` |
| `Type 'string' is not assignable to type 'T'` | narrowing trong generic cho `T & string` | đổi sang conditional return + `as` |

---

## Bài tập

1. Viết `function first<T>(a: T, b: T): T` rồi gọi `first('a', 2)`. Dán mã lỗi. Sửa bằng 2 cách khác nhau và ghi lại kiểu kết quả của mỗi cách.

2. Viết `declare function build<T>(): Set<T>`. Gọi ba lần: không kiểu đích, có kiểu đích `Set<string>`, và truyền tường minh. In kiểu của cả ba bằng mẹo `never`.

3. Viết `defineConfig` nhận `{ name: string; envs: string[] }`. Không có `const` thì `envs` là gì? Thêm `const` vào tham số kiểu thì `envs` là gì? Ghi lại cả hai và giải thích chỗ `readonly` xuất hiện.

4. Viết `function translate<T extends string>(key: T, dict: Record<T, string>)`. Gọi với `key` sai chính tả — lỗi hiện ra ở **đối số nào**? Thêm `NoInfer` và so lại vị trí báo lỗi.

5. Tạo cặp interface handler dạng method và dạng property. Gán chéo cả hai chiều (4 phép gán). Ghi lại đúng những phép nào lỗi.

6. Viết `function double<T extends number | string>(x: T): T` cố trả về `x * 2` khi là number. Dán lỗi. Sửa bằng conditional return type.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `error TS2345: Argument of type '2' is not assignable to parameter of type '"a"'.`
Cách 1: `first<string | number>('a', 2)` → kiểu `string | number`.
Cách 2: đổi chữ ký `first<A, B>(a: A, b: B): A | B` → kiểu `"a" | 2`.

**2.** Lần lượt `Set<unknown>`, `Set<string>`, `Set<...>` theo tham số bạn truyền.

**3.** Không `const`: `envs: string[]`. Có `const` **nhưng ràng buộc vẫn là `string[]`**: vẫn `string[]` — ràng buộc thắng. Phải đổi ràng buộc thành `readonly string[]` mới ra `readonly ["dev", "prod"]`.

**4.** Không có `NoInfer` vẫn có lỗi nhưng **sai chỗ**: TS2561 gạch dưới `home` trong từ điển. Thêm `NoInfer<T>` cho tham số `key` thì lỗi chuyển về đúng đối số đầu:
`error TS2345: Argument of type '"hom"' is not assignable to parameter of type '"about" | "home"'.`

**5.** Chỉ chiều `NarrowP → HandlerP` lỗi (TS2322). Ba chiều còn lại đều lọt: hai chiều method vì bivariance, chiều `HandlerP → NarrowP` vì tham số rộng hơn thì luôn hợp lệ.

**6.**
```
error TS2322: Type 'number' is not assignable to type 'T'.
  'number' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype of constraint 'string | number'.
```
Sửa: `function double<T extends number | string>(x: T): T extends number ? number : string { ... as any }`.

</details>

---

👉 Tiếp: [A2 — Lập trình trên tầng kiểu](./02-lap-trinh-tren-tang-kieu.md)
