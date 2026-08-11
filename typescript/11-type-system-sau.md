# Bài 11 — Hệ thống kiểu ở tầng sâu hơn

Bốn chủ đề không cần cho việc viết code hằng ngày, nhưng **hay bị hỏi khi phỏng vấn** và giải thích được
nhiều hành vi "lạ" của TypeScript.

Mọi kết quả trong bài đều chạy thật bằng `tsc 7.0.2`.

> **Lưu ý cách chạy trong bài này.** TypeScript 7 báo lỗi nếu bạn vừa có `tsconfig.json` vừa truyền tên
> file trên dòng lệnh:
> ```
> error TS5112: tsconfig.json is present but will not be loaded if files are specified on commandline.
> Use '--ignoreConfig' to skip this error.
> ```
> Nên các lệnh dưới đây đều có `--ignoreConfig`.

---

## 1. Structural typing — vì sao TypeScript "dễ tính" một cách khó hiểu

Bài 02 đã giới thiệu. Đây là phần hệ quả sâu hơn.

TypeScript so kiểu theo **hình dạng**, không theo tên. Hai type không liên quan gì vẫn thay thế nhau
được nếu đủ field. Điều đó dẫn tới ba hệ quả bạn cần biết để trả lời phỏng vấn.

### Hệ quả 1 — `implements` gần như không bắt buộc

```ts
interface Storage { save(key: string, value: string): void; }

class FileStorage {                 // KHÔNG có implements Storage
  save(key: string, value: string) {}
}

const s: Storage = new FileStorage();   // vẫn hợp lệ
```

`implements` chỉ là **lời nhắc cho chính bạn** — nó kiểm tra class có đủ hình dạng không, chứ không
tạo ra quan hệ kiểu. Bỏ nó đi thì code vẫn chạy y hệt.

### Hệ quả 2 — hai kiểu "khác nhau về ý nghĩa" vẫn lẫn nhau được

```ts
type UserId = string;
type PostId = string;

function getUser(id: UserId) {}

const pid: PostId = 'p1';
getUser(pid);          // ✅ không lỗi — cả hai đều chỉ là string
```

Đây là lỗ hổng thật: truyền nhầm id giữa hai bảng mà trình biên dịch không bắt được. Cách chặn là
**branded type** — xem mục 4.

### Hệ quả 3 — excess property check chỉ áp cho literal

```ts
interface User { id: number; name: string }

const u1: User = { id: 1, name: 'Sơn', age: 30 };   // ❌ lỗi
```
```
error TS2353: Object literal may only specify known properties, and 'age' does not exist in type 'User'.
```

```ts
const raw = { id: 1, name: 'Sơn', age: 30 };
const u2: User = raw;                               // ✅ không lỗi
```

Không phải bug. Field thừa trên **literal gán trực tiếp** gần như luôn là gõ nhầm tên, nên TS chặn.
Đi qua biến trung gian thì đó là structural typing bình thường: `raw` có đủ mọi thứ `User` cần.

**Câu trả lời phỏng vấn gọn:** "TypeScript dùng structural typing — so hình dạng chứ không so tên.
Excess property check là một ngoại lệ có chủ đích, chỉ áp cho object literal, vì đó là chỗ gõ thừa
field thường là lỗi."

---

## 2. Declaration merging — vì sao `interface` gộp được mà `type` thì không

### `interface` gộp được

```ts
interface Box { width: number; }
interface Box { height: number; }

const b: Box = { width: 1, height: 2 };   // cần CẢ HAI field
```

Không lỗi. Hai khai báo cùng tên được **gộp lại** thành một.

### `type` thì không

```ts
type Card = { a: number };
type Card = { b: number };
```
```
error TS2300: Duplicate identifier 'Card'.
error TS2300: Duplicate identifier 'Card'.
```

Đây là **khác biệt thật sự** giữa `type` và `interface`, quan trọng hơn nhiều so với những khác biệt cú
pháp mà người ta hay kể.

### Vì sao tính năng này tồn tại

Để **mở rộng kiểu của thư viện bên thứ ba** mà không sửa mã nguồn của họ:

```ts
declare global {
  interface Window {
    myApp: { version: string };
  }
}
export {};
```

Từ đó `window.myApp.version` có kiểu, không phải `as any`.

Cùng cơ chế dùng để thêm field vào `Request` của Express, thêm biến vào `process.env`, thêm method vào
`Array.prototype` khi dùng polyfill.

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

### Function + namespace cũng gộp được

```ts
function greet(name: string) { return `Hi ${name}`; }

namespace greet {
  export const version = '1.0';
}

console.log(greet('Sơn'), greet.version);   // "Hi Sơn 1.0"
```

Không lỗi. Đây là cách các thư viện cũ gắn thuộc tính vào một hàm (`$.ajax` của jQuery là kiểu này).

### Khi nào chọn `interface`, khi nào `type`

| Cần | Dùng |
|-----|------|
| Mô tả hình dạng object, có thể cần mở rộng sau | `interface` |
| Mở rộng kiểu của thư viện/global | `interface` (bắt buộc) |
| Union, tuple, mapped type, conditional type | `type` (bắt buộc) |
| Kiểu nội bộ, không muốn ai gộp thêm vào | `type` |

Quy tắc thực dụng: **`interface` cho hình dạng công khai, `type` cho mọi thứ còn lại.** Việc `type`
**không** gộp được đôi khi là ưu điểm — nó ngăn người khác âm thầm thêm field vào kiểu của bạn.

---

## 3. Variance — chỗ TypeScript cố ý không an toàn

Đây là câu hỏi tách người "dùng được TS" khỏi người "hiểu TS".

### Mảng là covariant — và điều đó không an toàn

```ts
class Animal { name = 'x'; }
class Dog extends Animal { bark() {} }

let animals: Animal[] = [];
let dogs: Dog[] = [new Dog()];

animals = dogs;              // ✅ TypeScript CHO PHÉP
animals.push(new Animal());  // ✅ cũng cho phép
// giờ mảng `dogs` chứa một Animal không có bark()
```

Chạy thật: **không có lỗi nào.**

Về lý thuyết đây là lỗ hổng — bạn vừa nhét `Animal` vào một mảng khai kiểu `Dog[]`. TypeScript biết và
**cố ý chấp nhận**, vì cấm nó đi sẽ làm rất nhiều code JavaScript hợp lệ bị báo lỗi. Đây là đánh đổi
giữa an toàn tuyệt đối và tính dùng được.

**Câu trả lời phỏng vấn:** "Mảng trong TypeScript là covariant và điều đó không sound. Nhóm TypeScript
chọn như vậy có chủ đích — họ ưu tiên tính thực dụng hơn an toàn tuyệt đối. Trong thực tế em tránh bằng
cách dùng `readonly T[]` khi chỉ đọc."

```ts
function tongTen(list: readonly Animal[]) {
  // list.push(...)   ← không gọi được, nên không có lỗ hổng
}
```

### Tham số hàm là contravariant

```ts
type HandlerAnimal = (a: Animal) => void;
type HandlerDog = (d: Dog) => void;

let hAnimal: HandlerAnimal = (a) => {};
let hDog: HandlerDog = (d) => d.bark();

let x: HandlerDog = hAnimal;    // ✅ OK
let y: HandlerAnimal = hDog;    // ❌ lỗi
```

```
error TS2322: Type 'HandlerDog' is not assignable to type 'HandlerAnimal'.
  Types of parameters 'd' and 'a' are incompatible.
    Property 'bark' is missing in type 'Animal' but required in type 'Dog'.
```

Đọc theo logic thì rất hợp lý:

- Chỗ nào cần "hàm xử lý được `Dog`" mà bạn đưa "hàm xử lý được **mọi** `Animal`" → **an toàn**, vì
  `Dog` cũng là `Animal`.
- Chỗ nào cần "hàm xử lý được mọi `Animal`" mà bạn đưa "hàm chỉ xử lý được `Dog`" → **không an toàn**,
  vì người ta có thể truyền `Cat` vào và hàm sẽ gọi `.bark()`.

Hành vi này do cờ `strictFunctionTypes` (nằm trong `strict`). Tắt đi thì lỗi biến mất:

```bash
$ npx tsc --ignoreConfig --noEmit variance.ts --strict --strictFunctionTypes false
                                    # (không output — hết lỗi)
```

> ⚠️ Ngoại lệ đáng nhớ: `strictFunctionTypes` **không áp dụng cho method khai bằng cú pháp method**
> (`{ save(x: Dog): void }`), chỉ áp cho property kiểu hàm (`{ save: (x: Dog) => void }`). Đây là
> nhượng bộ để tương thích với các kiểu có sẵn như `Array.prototype`.

---

## 4. Branded type — vá lỗ hổng của structural typing

Vấn đề ở mục 1: `UserId` và `PostId` đều là `string` nên lẫn nhau được.

```ts
type UserId = string & { readonly __brand: 'UserId' };
type PostId = string & { readonly __brand: 'PostId' };

function getUser(id: UserId) {}

const pid = 'p1' as PostId;
getUser(pid);
```

```
error TS2345: Argument of type 'PostId' is not assignable to parameter of type 'UserId'.
  Type 'PostId' is not assignable to type '{ readonly __brand: "UserId"; }'.
    Types of property '__brand' are incompatible.
      Type '"PostId"' is not assignable to type '"UserId"'.
```

Bây giờ trình biên dịch bắt được. Field `__brand` **không tồn tại lúc chạy** — nó chỉ là nhãn cho hệ
thống kiểu, và biến mất hoàn toàn khi biên dịch.

Cách tạo giá trị sạch sẽ hơn `as`:

```ts
function userId(raw: string): UserId {
  if (raw === '') throw new Error('id rỗng');
  return raw as UserId;                  // ép kiểu ở ĐÚNG MỘT chỗ
}

const uid = userId('u1');
getUser(uid);          // ✅
getUser('u1');         // ❌ chuỗi thường không phải UserId
```

Dùng cho: id của các bảng khác nhau, đơn vị đo (`Met` vs `Feet`), giá trị đã kiểm chứng
(`EmailDaXacMinh`, `HtmlDaLoc`).

Đánh đổi: phải đi qua hàm tạo, và người dùng có thể phá bằng `as`. Nó chặn **lỗi vô ý**, không chặn
người cố tình.

---

## 5. Type predicate vs assertion function

Hai cách thu hẹp kiểu, khác nhau ở chỗ một cái **trả về** và một cái **ném lỗi**.

```ts
// Type predicate — trả về boolean
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

// Assertion function — không trả về gì, ném lỗi nếu sai
function assertString(x: unknown): asserts x is string {
  if (typeof x !== 'string') throw new Error('không phải string');
}

function demo(v: unknown) {
  if (isString(v)) {
    v.toUpperCase();       // ✅ thu hẹp trong nhánh if
  }

  assertString(v);
  v.toUpperCase();         // ✅ thu hẹp cho MỌI dòng phía sau
}
```

Cả hai đều chạy không lỗi.

### ⚠️ Bẫy của assertion function

Gán nó vào biến là hỏng:

```ts
const check = assertString;

function demo(v: unknown) {
  check(v);
  v.toUpperCase();
}
```

```
error TS2775: Assertions require every name in the call target to be declared with an explicit type annotation.
error TS18046: 'v' is of type 'unknown'.
```

TypeScript cần biết **chắc chắn** hàm được gọi là assertion function ngay tại chỗ gọi, nên tên gọi phải
có kiểu tường minh. Sửa:

```ts
const check: (x: unknown) => asserts x is string = assertString;
```

Trong thực tế: gọi thẳng, đừng gán qua biến.

---

## 6. Module resolution trong TypeScript 7

Bài 00 đã nói `moduleResolution: node10` bị gỡ. Đây là bức tranh đầy đủ, đo thật:

```bash
$ for mr in node node10 node16 nodenext bundler classic; do
    npx tsc --ignoreConfig --noEmit x.ts --moduleResolution $mr --module nodenext
  done
```

| Giá trị | Kết quả trên tsc 7.0.2 |
|---------|------------------------|
| `node` | ❌ `error TS5108: Option 'moduleResolution=node10' has been removed.` |
| `node10` | ❌ `error TS5108` (như trên) |
| `classic` | ❌ `error TS5108: Option 'moduleResolution=Classic' has been removed.` |
| `node16` | ✅ |
| `nodenext` | ✅ |
| `bundler` | ⚠️ `error TS5095: Option 'bundler' can only be used when 'module' is set to 'preserve', 'commonjs', or 'es2015' or later.` |

Chú ý: `node` được **quy về** `node10` trong thông báo lỗi — hai cái là một.

### Chọn cái nào

| Bạn đang làm | Dùng |
|--------------|------|
| Ứng dụng/thư viện chạy bằng Node | `nodenext` (kèm `module: nodenext`) |
| Code đi qua bundler (Vite, webpack, Next.js) | `bundler` (kèm `module: preserve` hoặc `esnext`) |
| Dự án cũ đang dùng `node10` | Phải đổi — bản 7 không chạy nữa |

Đây là nguyên nhân hàng đầu khiến dự án cũ không biên dịch được sau khi nâng lên TypeScript 7.

---

## 7. Bảng câu trả lời gọn cho phỏng vấn

| Câu hỏi | Trả lời 30 giây |
|---------|-----------------|
| TypeScript so kiểu theo gì? | Theo **hình dạng** (structural), không theo tên. Nên class không cần `implements` vẫn dùng được ở chỗ đòi interface đó. |
| `type` khác `interface` chỗ nào **quan trọng nhất**? | `interface` **gộp được** khi khai trùng tên (declaration merging), `type` thì báo `Duplicate identifier`. Đó là lý do mở rộng `Window` hay `ProcessEnv` phải dùng `interface`. |
| Mảng trong TS có an toàn kiểu không? | Không hoàn toàn — mảng là covariant nên `Dog[]` gán được vào `Animal[]` rồi push `Animal` vào. TS cố ý chấp nhận để đổi lấy tính thực dụng. Tránh bằng `readonly T[]`. |
| `strictFunctionTypes` làm gì? | Bắt tham số hàm phải contravariant. Nhờ nó, hàm nhận `Dog` không gán được vào chỗ đòi hàm nhận `Animal`. |
| Làm sao chặn truyền nhầm `UserId` và `PostId`? | Branded type — giao `string` với một field nhãn chỉ tồn tại ở tầng kiểu. |
| `x is T` khác `asserts x is T`? | Cái đầu trả boolean, thu hẹp trong nhánh `if`. Cái sau ném lỗi, thu hẹp cho mọi dòng phía sau. Assertion function không gán qua biến được nếu biến không có kiểu tường minh. |
| Vì sao dự án cũ không build được trên TS 7? | `moduleResolution: node`/`node10`/`classic` đã bị gỡ (TS5108), cùng với `target: ES5` và `outFile`. |

---

## Bài tập

1. Viết `interface Box` hai lần với field khác nhau, tạo một object thoả mãn. Rồi làm điều tương tự
   với `type` và ghi lại lỗi.

2. Dùng `declare global` để thêm `DATABASE_URL` và `NODE_ENV` vào `ProcessEnv`. Kiểm tra
   `process.env.NODE_ENV` có được gợi ý ba giá trị không.

3. Tạo `class Animal`/`class Dog`, gán `Dog[]` vào `Animal[]` rồi `push` một `Animal`. Có lỗi không?
   Đổi tham số hàm thành `readonly Animal[]` và thử `push` — lần này thế nào?

4. Viết `HandlerAnimal` và `HandlerDog`, thử gán hai chiều. Ghi lại chiều nào lỗi và nguyên văn thông
   báo. Rồi chạy lại với `--strictFunctionTypes false`.

5. Tạo branded type `UserId`/`PostId` với hàm tạo `userId()`. Thử truyền `PostId` và truyền chuỗi
   thường vào `getUser()`. Ghi lại cả hai lỗi.

6. Viết `assertString` rồi gán vào `const check = assertString`. Ghi lại hai lỗi. Sửa bằng cách khai
   kiểu tường minh cho `check`.

7. Chạy `tsc` với từng giá trị `moduleResolution` ở mục 6 và dán bảng kết quả của bạn.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `interface` gộp thành `{ width: number; height: number }` — object phải có **cả hai**. `type`:
```
error TS2300: Duplicate identifier 'Card'.
```

**3.** `push` vào `animals` **không lỗi** — đó chính là lỗ hổng covariance. Với `readonly Animal[]`,
`push` không tồn tại nên không gọi được:
```
error TS2339: Property 'push' does not exist on type 'readonly Animal[]'.
```

**4.** Chiều `HandlerDog` → `HandlerAnimal` lỗi:
```
error TS2322: Type 'HandlerDog' is not assignable to type 'HandlerAnimal'.
  Types of parameters 'd' and 'a' are incompatible.
    Property 'bark' is missing in type 'Animal' but required in type 'Dog'.
```
Chiều ngược lại không lỗi. Tắt `strictFunctionTypes` thì cả hai đều không lỗi — và code kém an toàn hơn.

**6.**
```
error TS2775: Assertions require every name in the call target to be declared with an explicit type annotation.
error TS18046: 'v' is of type 'unknown'.
```

</details>

---

Tiếp theo: [phong-van/](./phong-van/README.md) — luyện trả lời phỏng vấn TypeScript.
