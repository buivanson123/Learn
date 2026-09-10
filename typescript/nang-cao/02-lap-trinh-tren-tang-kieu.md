# Bài A2 — Lập trình trên tầng kiểu

Bài 05 đã dạy conditional type và `infer` như cú pháp. Bài này coi tầng kiểu là **một ngôn ngữ lập trình thật**: có đệ quy, có tích luỹ, có giới hạn bộ nhớ, và có cách gỡ lỗi riêng.

Mọi con số trong bài đo bằng `tsc 7.0.2`.

---

## 1. Tuple là danh sách, `length` là số

Tầng kiểu không có `for`. Cách duyệt duy nhất là **đệ quy trên tuple**.

```ts
type Length<T extends readonly unknown[]> = T['length'];
type L = Length<[1, 2, 3]>;
const _l: never = null as any as L;
```
```
src/b3.ts(3,7): error TS2322: Type '3' is not assignable to type 'never'.
```

`T['length']` cho ra **literal number** `3`, không phải `number`. Đó là toàn bộ nền tảng của số học trên tầng kiểu.

Ba phép cơ bản:

```ts
type Head<T extends readonly unknown[]> =
  T extends readonly [infer H, ...unknown[]] ? H : never;

type Tail<T extends readonly unknown[]> =
  T extends readonly [unknown, ...infer R] ? R : [];

type Rev<T extends readonly unknown[], Acc extends unknown[] = []> =
  T extends readonly [infer H, ...infer R] ? Rev<R, [H, ...Acc]> : Acc;

type R1 = Rev<[1, 2, 3]>;
const _r1: never = null as any as R1;
```
```
src/b3.ts(10,7): error TS2322: Type '[3, 2, 1]' is not assignable to type 'never'.
```

Chú ý mẫu **accumulator** trong `Rev`: tham số thứ hai `Acc` là biến tích luỹ, y hệt `reduce`. Mẫu này lặp lại trong mọi type nâng cao — và nó còn quyết định giới hạn đệ quy ở mục sau.

---

## 2. Giới hạn đệ quy — con số thật

Đây là chỗ tài liệu trên mạng hay nói mơ hồ. Đo cụ thể:

### Đệ quy đuôi (tail recursion) — giới hạn 999

```ts
type BuildTuple<N extends number, Acc extends unknown[] = []> =
  Acc['length'] extends N ? Acc : BuildTuple<N, [...Acc, unknown]>;

type A = BuildTuple<998>;
type B = BuildTuple<999>;
type C = BuildTuple<1000>;
type D = BuildTuple<1001>;
const _a: never = null as any as A['length'];
const _b: never = null as any as B['length'];
const _c: never = null as any as C['length'];
const _d: never = null as any as D['length'];
```
```
src/c1.ts(5,10): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/c1.ts(6,10): error TS2589: Type instantiation is excessively deep and possibly infinite.
src/c1.ts(7,7): error TS2322: Type '998' is not assignable to type 'never'.
src/c1.ts(8,7): error TS2322: Type '999' is not assignable to type 'never'.
src/c1.ts(9,7): error TS2322: Type 'any' is not assignable to type 'never'.
src/c1.ts(10,7): error TS2322: Type 'any' is not assignable to type 'never'.
```

Đọc bảng này rất đáng giá:
- `998`, `999` → tính ra đúng.
- `1000` trở lên → **TS2589**, và kết quả trở thành `any`.

Chi tiết quan trọng nhất: **khi vỡ, kiểu trở thành `any`, không phải `never`**. Nghĩa là type của bạn im lặng ngừng bảo vệ. Nếu file có `@ts-ignore` hoặc bạn không đọc kỹ log, bạn mất kiểm tra kiểu ở đúng chỗ mình cẩn thận nhất.

### Đệ quy thường — giới hạn chỉ 47

`Rev` ở trên là đệ quy đuôi vì lời gọi đệ quy là **toàn bộ** nhánh true. Còn nếu kết quả đệ quy bị bọc trong một cấu trúc khác thì không phải:

```ts
type Nest<N extends number, Acc extends unknown[] = []> =
  Acc['length'] extends N ? [] : [unknown, ...Nest<N, [...Acc, unknown]>];
//                                          ↑ bọc trong tuple → không còn tail
```

| `N` | Kết quả |
|---|---|
| 47 | ✅ tính ra `47` |
| 48 | ⚠️ TS2589 nhưng vẫn ra `48` |
| 49 | ❌ TS2589, kiểu thành `any` |

**999 so với 47 — hơn 21 lần.** Nếu type của bạn báo TS2589, việc đầu tiên phải làm không phải là giảm dữ liệu, mà là **viết lại thành đệ quy đuôi**: cho lời gọi đệ quy đứng một mình ở nhánh kết quả, đẩy phần "ghép" vào accumulator.

```ts
// ❌ không tail — chết ở 48
type Repeat<N extends number, T, Acc extends unknown[] = []> =
  Acc['length'] extends N ? [] : [T, ...Repeat<N, T, [...Acc, unknown]>];

// ✅ tail — chạy tới 999
type Repeat2<N extends number, T, Acc extends unknown[] = []> =
  Acc['length'] extends N ? Acc : Repeat2<N, T, [...Acc, T]>;
```

---

## 3. Xử lý chuỗi trên tầng kiểu

Template literal type + `infer` biến chuỗi thành dữ liệu. Đây là thứ đứng sau `tRPC`, `Hono`, `Prisma`, `Drizzle`.

### Tách tham số đường dẫn

```ts
type Params<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}` ? P | Params<`/${Rest}`>
  : S extends `${string}:${infer P}` ? P
  : never;

type P1 = Params<'/users/:userId/posts/:postId'>;
const _p1: never = null as any as P1;
```
```
src/b4.ts(6,7): error TS2322: Type '"postId" | "userId"' is not assignable to type 'never'.
```

Cách nó chạy: nhánh 1 khớp `:userId/` → lấy `userId`, phần còn lại `posts/:postId` được nối lại thành `/posts/:postId` rồi gọi đệ quy. Nhánh 2 là trường hợp param cuối (không còn `/`).

### `Split`

```ts
type Split<S extends string, D extends string> =
  S extends `${infer A}${D}${infer B}` ? [A, ...Split<B, D>] : [S];

type S1 = Split<'a,b,c', ','>;
const _s1: never = null as any as S1;
```
```
src/b4.ts(11,7): error TS2322: Type '["a", "b", "c"]' is not assignable to type 'never'.
```

### Đổi `snake_case` sang `camelCase` cho cả object

```ts
type Camel<S extends string> =
  S extends `${infer H}_${infer T}` ? `${H}${Capitalize<Camel<T>>}` : S;

type CamelKeys<T> = { [K in keyof T as K extends string ? Camel<K> : K]: T[K] };

type Row = { user_id: number; created_at: string };
type Prettify<T> = { [K in keyof T]: T[K] } & {};
const _rc: never = null as any as Prettify<CamelKeys<Row>>;
```
```
src/x1.ts(5,7): error TS2322: Type '{ createdAt: string; userId: number; }' is not assignable to type 'never'.
```

Nếu bỏ `Prettify` đi, thông báo chỉ in `Type 'CamelKeys<Row>'` — chưa tính ra. `Prettify<T> = { [K in keyof T]: T[K] } & {}` ép trình biên dịch trải phẳng kiểu, cực kỳ hữu ích khi debug và khi muốn tooltip trong editor hiện kiểu thật thay vì tên alias.

Dùng khi bạn nhận dữ liệu từ database đặt tên snake_case nhưng code frontend dùng camelCase — kiểu tự đổi theo, không phải khai hai lần.

---

## 4. Trần union: 100 000 nhánh

Template literal nhân chéo rất nhanh. Có một mức trần cứng.

```ts
type D = '0'|'1'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9';
type Two  = `${D}${D}`;        //     100 nhánh
type Four = `${Two}${Two}`;    //  10 000 nhánh
type Five = `${Four}${D}`;     // 100 000 nhánh
const e: Five = '12345';
```
```
src/u1.ts(4,13): error TS2590: Expression produces a union type that is too complex to represent.
```

`Four` (10 000) chạy tốt, `Five` (100 000) vỡ. **Đừng bao giờ mô hình hoá "chuỗi 5 chữ số" hay "mã bưu điện" bằng template literal type.** Với những miền giá trị lớn, dùng branded type (bài 11 mục 4) và kiểm tra ở runtime.

Cùng bảng đo, `Four` tiêu tốn:
```bash
$ npx tsc --noEmit --extendedDiagnostics
```
```
Types:           10578
Instantiations:      0
Check time:     0.010s
```
10 578 type chỉ để mô tả 4 chữ số. Bài A6 nói kỹ về việc con số này ảnh hưởng thế nào tới tốc độ editor.

---

## 5. Bẫy lớn nhất: ràng buộc phụ thuộc generic khác

Đây là bài học đắt giá nhất trong cả file. Ta viết một hàm `get(obj, 'a.b.c')` an toàn kiểu.

```ts
type Paths<T, Prefix extends string = ''> = T extends object
  ? { [K in keyof T & string]: T[K] extends object
        ? `${Prefix}${K}` | Paths<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}` }[keyof T & string]
  : never;

type ValueAt<T, P extends string> =
  P extends `${infer H}.${infer R}` ? (H extends keyof T ? ValueAt<T[H], R> : never)
  : P extends keyof T ? T[P] : never;

type Cfg = { db: { host: string; port: number; pool: { max: number } }; debug: boolean };
declare const cfg: Cfg;
```

Hai type nền chạy đúng:
```
Paths<Cfg>            → "db" | "db.host" | "db.pool" | "db.pool.max" | "db.port" | "debug"
ValueAt<Cfg,'db.pool.max'> → number
```

Bây giờ ghép vào hàm. **Ba cách viết, kết quả khác hẳn nhau.**

### Cách A — cách ai cũng viết đầu tiên (sai)

```ts
declare function getA<T, P extends Paths<T>>(o: T, p: P): ValueAt<T, P>;
const a = getA(cfg, 'db.port');
const _a: never = null as any as typeof a;
```
```
src/w2.ts(15,7): error TS2322: Type 'string | number | boolean | { host: string; port: number; pool: { max: number; }; } | { max: number; }' is not assignable to type 'never'.
```

`a` ra **union của mọi giá trị trong config** thay vì `number`. Lý do: ràng buộc của `P` phụ thuộc `T`, mà `T` đang được suy cùng lúc. Gặp vòng lặp này, trình biên dịch bỏ cuộc và lấy luôn **cả ràng buộc** làm `P`. Không có lỗi đỏ nào — chỉ có kiểu vô dụng. Đây là kiểu hỏng nguy hiểm nhất: im lặng.

### Cách B — ràng buộc bằng giao (đúng kiểu, dở thông báo)

```ts
declare function getB<T, P extends string>(o: T, p: P & Paths<T>): ValueAt<T, P>;
const b = getB(cfg, 'db.port');    // ✅ number
getB(cfg, 'db.prot');
```
```
src/w2.ts(20,7): error TS2322: Type 'number' is not assignable to type 'never'.
                                    ↑ b đúng rồi
src/w2.ts(21,11): error TS2345: Argument of type '"db.prot"' is not assignable to parameter of type 'never'.
                                                                                              ↑ vô dụng
```

Kiểu trả về đúng, nhưng gõ sai đường dẫn thì trình biên dịch chỉ nói `type 'never'` — người dùng không biết đường dẫn hợp lệ là gì.

### Cách C — tách thành hai lời gọi (đúng cả hai)

```ts
declare function getC<T>(o: T): <P extends Paths<T>>(p: P) => ValueAt<T, P>;
const c = getC(cfg)('db.port');    // ✅ number
getC(cfg)('db.prot');
```
```
src/w2.ts(26,7): error TS2322: Type 'number' is not assignable to type 'never'.
src/w2.ts(27,11): error TS2345: Argument of type '"db.prot"' is not assignable to parameter of type '"db" | "db.host" | "db.pool" | "db.pool.max" | "db.port" | "debug"'.
                                                              ↑ liệt kê đủ đường dẫn hợp lệ
```

Lời gọi thứ nhất giải xong `T`, lời gọi thứ hai mới suy `P` — không còn vòng lặp.

**Quy tắc rút ra: khi tham số kiểu `B` có ràng buộc phụ thuộc tham số kiểu `A`, đừng để chúng được suy trong cùng một lời gọi.** Curry ra hai bước. Đây chính là lý do API của `tRPC` trông như `t.router({...}).query(...)` chứ không phải một hàm khổng lồ.

---

## 6. Kiểm thử kiểu — vì type cũng có bug

Type phức tạp cần test như code. Hai công cụ đủ dùng, không cần cài gì.

### `Equals` — so sánh kiểu chính xác

```ts
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

type E1 = Equals<{ a: string }, { a: string }>;
type E2 = Equals<any, string>;
type E3 = Equals<{ a: string } & { b: number }, { a: string; b: number }>;
```
```
src/m2.ts(5,7): error TS2322: Type 'true' is not assignable to type 'never'.    ← E1 = true
src/m2.ts(6,7): error TS2322: Type 'false' is not assignable to type 'never'.   ← E2 = false
src/m2.ts(7,7): error TS2322: Type 'false' is not assignable to type 'never'.   ← E3 = false
```

Hai kết quả cần nhớ: `Equals` phân biệt được `any` với `string` (thứ mà `extends` thường không làm được), và **`A & B` không "bằng" object phẳng tương đương** — chúng gán qua lại được nhưng không đồng nhất. Đó là lý do nhiều thư viện có utility `Prettify<T> = { [K in keyof T]: T[K] } & {}` để làm phẳng intersection trước khi so sánh hoặc hiển thị.

### `Expect` — biến kỳ vọng thành lỗi biên dịch

```ts
type Expect<T extends true> = T;

type _t1 = Expect<Equals<Uppercase<'ab'>, 'AB'>>;   // pass
type _t2 = Expect<Equals<string, number>>;          // fail
```
```
src/m2.ts(11,19): error TS2344: Type 'false' does not satisfy the constraint 'true'.
```

Đặt các dòng này trong `src/types.test-d.ts`, chạy `tsc --noEmit` trong CI là bạn có test cho tầng kiểu — không cần chạy runtime, không cần thư viện.

### `@ts-expect-error` — khẳng định "dòng này phải lỗi"

```ts
// @ts-expect-error
const x: number = 'a';     // đúng: dòng này lỗi thật → directive được dùng

// @ts-expect-error
const y: number = 1;       // sai: dòng này không lỗi
```
```
src/m2.ts(15,1): error TS2578: Unused '@ts-expect-error' directive.
```

Điểm mạnh so với `@ts-ignore`: khi bạn (hoặc ai đó) sửa code làm lỗi biến mất, `@ts-expect-error` **báo động**, còn `@ts-ignore` im lặng che mãi mãi. **Trong codebase thật, thay toàn bộ `@ts-ignore` bằng `@ts-expect-error`.**

---

## 7. Khi nào KHÔNG nên viết type phức tạp

Ba câu hỏi trước khi viết một conditional type dài 10 dòng:

1. **Nó có chạy trên dữ liệu do người khác nhập không?** Nếu chỉ dùng nội bộ 1 chỗ, viết type tay ngắn hơn và dễ đọc hơn.
2. **Lỗi nó sinh ra có đọc được không?** Type phức tạp sinh thông báo lỗi 40 dòng lồng nhau. Đồng đội sẽ `as any` để cho qua — bạn còn tệ hơn lúc chưa viết.
3. **Nó có tăng thời gian check quá 2× không?** Đo bằng `--extendedDiagnostics` (bài A6). Nếu có, đổi thiết kế.

Nếu type của bạn cần hơn 2 tầng đệ quy để mô tả một thứ, thường là **thiết kế dữ liệu sai**, không phải type yếu.

---

## Bài tập

1. Viết `Last<T>` lấy phần tử cuối của tuple, và `Init<T>` lấy tất cả trừ phần tử cuối. In kết quả với `[1,2,3]`.

2. Viết `Add<A, B>` cộng hai số bằng tuple (`BuildTuple<A>` nối `BuildTuple<B>` rồi lấy `length`). Thử `Add<300, 400>`, `Add<600, 600>` và `Add<1000, 1>` — cái nào vỡ, mã lỗi gì? Giải thích tại sao tổng 1200 lại chạy được còn 1001 thì không.

3. Viết `Join<T extends string[], D extends string>` (ngược của `Split`). Kiểm tra `Join<['a','b','c'], '-'>` ra `"a-b-c"`.

4. Viết `Nest` không tail rồi chuyển sang tail. Tìm đúng con số N mà bản không tail bắt đầu vỡ trên máy bạn.

5. Viết `ParseQuery<'a=1&b=2'>` ra `{ a: '1'; b: '2' }`.

6. Viết `getC` như mục 5 cho type `Cfg` của riêng bạn. Rồi cố tình viết theo cách A và ghi lại kiểu trả về sai.

7. Viết bộ test `Expect<Equals<...>>` cho `Camel`, `Split`, `Params`, đặt trong `types.test-d.ts`, và chạy `tsc --noEmit`. Cố tình sửa `Camel` cho sai để xem CI đỏ.

<details>
<summary>Gợi ý đáp án</summary>

**1.**
```ts
type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;
type Init<T extends readonly unknown[]> = T extends readonly [...infer I, unknown] ? I : [];
```
`Last<[1,2,3]>` → `3`, `Init<[1,2,3]>` → `[1, 2]`.

**2.**
```ts
type Add<A extends number, B extends number> = [...BuildTuple<A>, ...BuildTuple<B>]['length'];
```
`Add<300,400>` → `700`. `Add<600,600>` → `1200`, **vẫn chạy tốt**. `Add<1000,1>` → `TS2589`.

Điểm mấu chốt: giới hạn 999 áp cho **số bước đệ quy**, không phải độ dài tuple kết quả. `Add<600,600>` chỉ đệ quy 600 bước hai lần rồi nối bằng spread (không đệ quy) nên qua. `Add<1000,1>` chết ngay ở `BuildTuple<1000>`.

**3.**
```ts
type Join<T extends readonly string[], D extends string> =
  T extends readonly [infer H extends string, ...infer R extends string[]]
    ? R['length'] extends 0 ? H : `${H}${D}${Join<R, D>}`
    : '';
```

**4.** Bản không tail vỡ ở **48** (vẫn ra kết quả) và mất hẳn kiểu ở **49**. Bản tail chạy tới **999**.

**5.**
```ts
type ParseQuery<S extends string> =
  S extends `${infer Pair}&${infer Rest}`
    ? ParsePair<Pair> & ParseQuery<Rest>
    : ParsePair<S>;
type ParsePair<S extends string> = S extends `${infer K}=${infer V}` ? { [P in K]: V } : {};
```
Kết quả là intersection — bọc `Prettify` nếu muốn nhìn phẳng.

**6.** Cách A cho ra union mọi giá trị lá; cách C cho ra đúng kiểu và thông báo lỗi liệt kê đường dẫn hợp lệ.

**7.** Sửa `Camel` bỏ `Capitalize` thì `Expect<Equals<Camel<'user_id'>, 'userId'>>` báo
`error TS2344: Type 'false' does not satisfy the constraint 'true'.`

</details>

---

👉 Tiếp: [A3 — Kiểu theo trạng thái: builder, mixin, phantom type](./03-kieu-theo-trang-thai.md)
