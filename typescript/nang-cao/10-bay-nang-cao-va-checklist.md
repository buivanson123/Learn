# Bài A10 — 16 bẫy nâng cao và checklist tổng

Bài 09 của bộ chính liệt kê 22 lỗi kinh điển — những thứ làm `tsc` báo đỏ. Bài này khác hẳn: nó liệt kê những chỗ **TypeScript không báo gì cả** nhưng bạn đang mất an toàn, cộng với vài chỗ nó báo một thứ khó hiểu.

Mọi output chạy bằng `tsc 7.0.2`, `strict: true`.

---

## Nhóm 1 — Chỗ kiểm tra kiểu lặng lẽ tắt

### Bẫy 1. Excess property check chỉ áp cho object literal

```ts
type Cfg = { host: string; port: number };

const a: Cfg = { host: 'x', port: 1, debug: true };   // dòng 3

const tmp = { host: 'x', port: 1, debug: true };
const b: Cfg = tmp;                                    // dòng 5 — không lỗi
```
```
src/t1.ts(3,38): error TS2353: Object literal may only specify known properties, and 'debug' does not exist in type 'Cfg'.
```

Chỉ dòng 3 lỗi. Gán qua biến trung gian thì lọt — vì structural typing chỉ hỏi "có đủ thứ cần không", còn excess property check là một lớp kiểm tra **thêm** chỉ dành cho literal.

**Hậu quả thật:** bạn gửi cả `debug: true` lên API mà không biết. Cách chặn: dùng `satisfies` ngay tại chỗ tạo object, hoặc parse bằng Zod với `.strict()`.

### Bẫy 2. Kiểu trả về `void` nuốt mọi giá trị

```ts
function each(cb: () => void) { cb(); }
each(() => 42);                       // ✅ không lỗi

const f: () => void = () => 42;       // ✅ không lỗi
const r = f();
```
`r` có kiểu `void`.

Đây là quy tắc **cố ý**: nó cho phép `arr.forEach(x => map.set(x, 1))` (mà `set` trả về `Map`). Cái giá: nếu bạn định nghĩa callback trả `void` và ai đó trả về `Promise`, không ai báo gì — và promise đó không được `await`.

**Cách chặn:** khai `cb: () => undefined` nếu thật sự cấm trả giá trị, hoặc bật rule `@typescript-eslint/no-misused-promises` cho trường hợp async.

### Bẫy 3. `Readonly<T>` chỉ sâu một tầng

```ts
type Deep = { a: { b: number } };
const d: Readonly<Deep> = { a: { b: 1 } };
d.a = { b: 2 };      // dòng 21
d.a.b = 3;           // dòng 22 — không lỗi
```
```
src/t2.ts(21,3): error TS2540: Cannot assign to 'a' because it is a read-only property.
```

Dòng 22 lọt. `readonly` và `as const` **không** đệ quy cho object lồng nhau (`as const` thì có, `Readonly<T>` thì không). Muốn sâu, tự viết `DeepReadonly` (bài 05 mục 4).

### Bẫy 4. `JSON.parse` trả `any` — và `any` lây

```ts
const j = JSON.parse('{"a":1}');
j.whatever.deep.nonsense;      // không lỗi
```
`j` là `any`. Mọi thứ chạm vào nó thành `any`, kể cả khi truyền qua 5 hàm khác.

**Quy tắc bắt buộc:** bọc lại ngay từ đầu.
```ts
function parseJson(s: string): unknown { return JSON.parse(s); }
```
Rồi parse bằng Zod. Không có lý do chính đáng nào để `any` từ `JSON.parse` sống quá một dòng.

### Bẫy 5. `Array.isArray` phá kiểu `readonly`

```ts
declare const maybe: readonly string[] | string;
if (Array.isArray(maybe)) {
  const _m: never = null as any as typeof maybe;
}
```
```
src/t3.ts(22,35): error TS2322: Type 'any[]' is not assignable to type 'never'.
```

Trong nhánh `if`, `maybe` thành **`any[]`** chứ không phải `readonly string[]`. Chữ ký của `Array.isArray` trong lib là `arg is any[]`, và `readonly string[]` không gán được vào `any[]` nên narrowing bỏ cuộc và lấy luôn `any[]`.

**Cách chặn:**
```ts
if (typeof maybe !== 'string') { /* maybe: readonly string[] */ }
```
hay tự viết type guard: `const isArr = (x: unknown): x is readonly unknown[] => Array.isArray(x);`

---

## Nhóm 2 — Chỗ kiểu suy ra không như bạn nghĩ

### Bẫy 6. `.filter(Boolean)` không loại `undefined`

```ts
const xs: (string | undefined)[] = ['a', undefined];
const ys = xs.filter(Boolean);
```
```
src/t1.ts(14,7): error TS2322: Type '(string | undefined)[]' is not assignable to type 'never'.
```

`ys` vẫn là `(string | undefined)[]`. `Boolean` không phải type predicate.

**Sửa:**
```ts
const ys = xs.filter((x): x is string => x !== undefined);
```

### Bẫy 7. `Object.keys` trả `string[]`

```ts
const cfg = { host: 'x', port: 1 };
Object.keys(cfg).forEach((k) => { console.log(cfg[k]); });
```
```
src/t1.ts(9,47): error TS7053: Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{ host: string; port: number; }'.
  No index signature with a parameter of type 'string' was found on type '{ host: string; port: number; }'.
```

Đây là quyết định **đúng** của TypeScript: object có thể có thêm key lúc chạy (kế thừa prototype, dữ liệu từ ngoài), nên `Object.keys` không thể hứa chỉ trả về `keyof T`.

**Sửa khi bạn chắc chắn object là của mình:**
```ts
(Object.keys(cfg) as (keyof typeof cfg)[]).forEach((k) => console.log(cfg[k]));
// hoặc
for (const [k, v] of Object.entries(cfg)) { /* k: string, v: string | number */ }
```

### Bẫy 8. Conditional type phân phối trên `boolean`

```ts
type IsTrue<T> = T extends true ? 'yes' : 'no';
type R1 = IsTrue<boolean>;
```
```
src/t3.ts(3,7): error TS2322: Type '"no" | "yes"' is not assignable to type 'never'.
```

`boolean` **là** `true | false`, nên conditional type phân phối lên cả hai nhánh và trả về `'yes' | 'no'` — vô nghĩa.

**Sửa bằng cách tắt phân phối:**
```ts
type NoDist<T> = [T] extends [true] ? 'yes' : 'no';
type R2 = NoDist<boolean>;   // → 'no'
```
```
src/t3.ts(5,7): error TS2322: Type '"no"' is not assignable to type 'never'.
```

Ghi nhớ: cùng một mẫu `[T] extends [never]` đã dùng ở bài A9 để phát hiện `never`.

### Bẫy 9. Overload chọn cái **đầu tiên** khớp, không phải cái khớp nhất

```ts
declare function fmt2(x: number | string): number;
declare function fmt2(x: number): string;

const o2 = fmt2(1);
```
```
src/t3.ts(14,7): error TS2322: Type 'number' is not assignable to type 'never'.
```

`fmt2(1)` trả về **`number`** — nó khớp overload đầu tiên và dừng lại, dù overload thứ hai cụ thể hơn.

**Quy tắc: luôn xếp overload từ hẹp đến rộng.** Đảo lại là bug im lặng.

### Bẫy 10. Generic không xuất hiện ở tham số nào

```ts
declare function parse1<T>(s: string): T;
const u = parse1('{}');
```
```
src/t3.ts(40,7): error TS2322: Type 'unknown' is not assignable to type 'never'.
```

`u` là `unknown` (trước đây nhiều thư viện thiết kế kiểu này với ngầm định người dùng sẽ ghi `parse1<User>(...)` — nghĩa là **`T` chỉ là một lời `as` trá hình**). Không ai kiểm tra chuỗi đó có đúng hình dạng `User` không.

**Dấu hiệu nhận biết một API không an toàn:** tham số kiểu chỉ xuất hiện ở **vị trí trả về**. Gặp thì thay bằng schema:
```ts
declare function parse2<S extends z.ZodType>(s: string, schema: S): z.output<S>;
```

---

## Nhóm 3 — Chỗ thông báo lỗi gây hiểu nhầm

### Bẫy 11. `private` và `#private` đều "nominal", nhưng lỗi khác nhau

```ts
class A1 { private x = 1; }
class B1 { private x = 1; }
declare let a1: A1; declare let b1: B1;
a1 = b1;                              // dòng 5

class A2 { #x = 1; }
class B2 { #x = 1; }
declare let a2: A2; declare let b2: B2;
a2 = b2;                              // dòng 9
```
```
src/t2.ts(5,1): error TS2322: Type 'B1' is not assignable to type 'A1'.
  Types have separate declarations of a private property 'x'.
src/t2.ts(9,1): error TS2322: Type 'B2' is not assignable to type 'A2'.
  Property '#x' in type 'B2' refers to a different member that cannot be accessed from within type 'A2'.
```

Cả hai đều phá structural typing — đó là cách duy nhất có "nominal typing" thật trong TypeScript ngoài branded type.

Khác biệt thực dụng: `private` biến mất khi biên dịch (chỉ là quy ước), `#x` là **private thật của JavaScript** — không đọc được kể cả bằng `obj['x']` hay `Object.keys`. Với dữ liệu nhạy cảm, dùng `#`.

### Bẫy 12. `satisfies` **không** nới lỏng việc thiếu key

Có một hiểu nhầm phổ biến rằng `satisfies` "kiểm tra nhẹ hơn". Không phải:

```ts
type Routes = Record<'home' | 'about', string>;
const r1 = { home: '/' } satisfies Routes;
const r2: Routes = { home: '/' };
```
```
src/t2.ts(44,26): error TS2741: Property 'about' is missing in type '{ home: string; }' but required in type 'Routes'.
src/t2.ts(45,7): error TS2741: Property 'about' is missing in type '{ home: string; }' but required in type 'Routes'.
```

**Cùng một mã lỗi, cùng mức nghiêm ngặt.** Khác biệt duy nhất của `satisfies` là **kiểu của biến**: `r1` giữ `{ home: '/' }` (literal), `r2` bị mở rộng thành `Routes`. Chọn `satisfies` khi bạn cần dùng tiếp các literal đó; chọn annotation khi bạn muốn biến chỉ đóng vai một `Routes`.

### Bẫy 13. Getter và setter được phép khác kiểu

```ts
class Box3 {
  #v = 0;
  get value(): number { return this.#v; }
  set value(v: number | string) { this.#v = Number(v); }
}

const bx = new Box3();
bx.value = '5';               // ✅
const n: number = bx.value;   // ✅
```

Không lỗi nào. Từ TS 4.3, getter và setter có thể khai kiểu khác nhau — rất tiện cho API "nhận rộng, trả hẹp".

Bẫy nằm ở chỗ ngược lại: nếu bạn **không biết** tính năng này, khi đọc `bx.value = '5'` bạn sẽ tưởng `value` là `string`. Khi viết class kiểu này, ghi comment nói rõ.

### Bẫy 14. `keyof any` là `string | number | symbol`

```ts
type K = keyof any;
```
```
src/t3.ts(26,7): error TS2322: Type 'string | number | symbol' is not assignable to type 'never'.
```

Hay gặp khi viết `Record<K, V>` generic: `K extends keyof any` cho phép cả `symbol`, và rồi `String(k)` ở chỗ khác báo lỗi. Nếu chỉ muốn key chuỗi, ràng buộc `K extends string`.

---

## Nhóm 4 — Bẫy đã gặp ở các bài trước, gom lại để tra

### Bẫy 15. TS2589 làm kiểu thành `any`

Đệ quy quá sâu không trả về `never` mà trả về `any` (bài A2 mục 2). Kết quả: bạn mất kiểm tra kiểu ở đúng chỗ mình viết type cầu kỳ nhất. **Đừng bao giờ để TS2589 tồn tại trong repo.**

### Bẫy 16. Quên `const` type parameter làm sập cả chuỗi suy kiểu

Bỏ `const` khỏi `defineContract` ở bài A9:
```
src/main.ts(8,48):  error TS2339: Property 'userId' does not exist on type 'Record<never, never>'.
```
Nhận diện: thấy `Record<never, never>` trong thông báo lỗi thì gần như chắc chắn một literal đã bị mở rộng thành `string` ở đâu đó phía trên.

---

## Checklist tổng cho bộ nâng cao

### Khi thiết kế API có generic
- [ ] Tham số kiểu có xuất hiện ở **vị trí tham số** không? (nếu chỉ ở return → bẫy 10)
- [ ] Người gọi có phải nhớ gõ `as const` không? (nếu có → thêm `const` type parameter)
- [ ] Có tham số kiểu nào bị ràng buộc bởi tham số kiểu khác trong **cùng một lời gọi** không? (→ curry, bài A2 mục 5)
- [ ] Callback khai dạng property hay method? (method → bivariant, bài A1 mục 5)
- [ ] Đã tự gõ sai một lần và đọc thông báo lỗi chưa?

### Khi viết type phức tạp
- [ ] Đệ quy có phải dạng đuôi không? (47 so với 999 bước)
- [ ] Có `TS2589`/`TS2590` nào không?
- [ ] Conditional type có phân phối ngoài ý muốn không? (bọc `[T]` nếu cần)
- [ ] Đã viết `Expect<Equals<...>>` cho các trường hợp chính chưa?
- [ ] Thông báo lỗi sinh ra có đọc được trong 10 giây không?

### Khi cấu hình dự án
- [ ] `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- [ ] `types: ["node"]` khai rõ (TS 7 không tự nạp)
- [ ] `skipLibCheck: true` cho app
- [ ] `erasableSyntaxOnly` nếu muốn chạy `node file.ts` (trừ khi dùng decorator)
- [ ] `verbatimModuleSyntax` + `"type": "module"`
- [ ] Monorepo: `composite` + `references`, không dùng `paths` trỏ vào `src`
- [ ] CI có một job chạy `tsc -b --clean && tsc -b` từ trạng thái sạch

### Khi dự án chậm
- [ ] Đã đo bằng `--extendedDiagnostics` trước khi sửa chưa?
- [ ] `skipLibCheck` (đo được 36× ở bài A6)
- [ ] `Instantiations` cao → generic đệ quy gọi với nhiều tham số kiểu khác nhau
- [ ] Intersection dài → đổi sang `interface extends`
- [ ] Export lớn → ghi kiểu trả về tường minh

### Khi làm việc với dữ liệu ngoài
- [ ] Mọi `JSON.parse` / `res.json()` / `req.body` / `process.env` đều đi qua schema
- [ ] Dùng `z.input` cho dữ liệu vào, `z.output` cho dữ liệu trong code
- [ ] Response của chính mình cũng parse (handler cũng có bug)
- [ ] ID nhạy cảm dùng branded type, chỉ tạo được qua `parse`
- [ ] Lỗi nghiệp vụ trả `Result`, không `throw`

### Quy tắc về `as` và `any`
- [ ] Mỗi `as` phải trả lời được: "trình biên dịch không chứng minh được điều gì, và vì sao tôi chắc chắn?"
- [ ] `as` chỉ được nằm **bên trong** thư viện/helper, không lọt ra API người dùng chạm tới
- [ ] Thay toàn bộ `@ts-ignore` bằng `@ts-expect-error`
- [ ] `any` từ `JSON.parse` không sống quá một dòng

---

## Bài tập tổng hợp

1. Tạo file gom cả 16 bẫy. Với mỗi bẫy, viết 2 phiên bản (sai/đúng) và dán output thật của máy bạn. Đây là tài liệu tra cứu riêng của bạn.

2. Quét dự án thật: `grep -rn 'as any\|@ts-ignore\|: any' src | wc -l`. Chọn 5 chỗ, phân loại thành "chính đáng" / "lười" / "không biết cách khác". Sửa nhóm thứ ba.

3. Tìm trong dự án một hàm có generic chỉ xuất hiện ở vị trí trả về (bẫy 10). Viết lại bằng schema.

4. Chạy toàn bộ checklist cấu hình lên dự án của bạn. Ghi lại bao nhiêu mục chưa đạt và số lỗi mới xuất hiện sau khi bật từng cờ.

5. Bật `noUncheckedIndexedAccess` rồi đếm lỗi. Với mỗi lỗi, quyết định: đây là bug thật hay chỉ là ồn ào? Tỉ lệ bao nhiêu?

6. Viết một `type` phá vỡ giới hạn (TS2589 hoặc TS2590), rồi sửa nó bằng đúng kỹ thuật của bài A2. Ghi lại `Instantiations` trước và sau.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Phân loại thường gặp: `as any` khi bọc thư viện không có kiểu (chính đáng — nhưng nên viết `.d.ts`), `as any` để cho qua lỗi narrowing (lười — dùng type guard), `as any` trên `JSON.parse`/`req.body` (không biết cách khác — dùng Zod).

**5.** Trong dự án đọc nhiều `Record`/mảng theo key động, tỉ lệ "bug thật" thường 10–30%. Nếu tỉ lệ gần 0, dự án của bạn đã cẩn thận và cờ này chỉ gây ồn — vẫn nên bật ở module xử lý dữ liệu ngoài, có thể bỏ ở module UI.

</details>

---

Hết bộ nâng cao. Quay lại [README của phần nâng cao](./README.md) hoặc [bộ tài liệu chính](../README.md).
