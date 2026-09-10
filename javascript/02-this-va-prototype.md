# Bài 02 — `this` và prototype

> `this` không phải là "object hiện tại". Nó là **tham số thứ 0 ngầm định của lời gọi hàm**,
> và giá trị của nó được quyết định tại chỗ **gọi**, không phải chỗ **định nghĩa**. Nắm được
> câu đó là xong 80% bài này.

---

## 1. Năm luật, xét theo đúng thứ tự

Khi V8 gặp một lời gọi hàm, nó xét theo thứ tự sau và dừng ở luật đầu tiên khớp:

| # | Dạng gọi | `this` là |
|---|---|---|
| 1 | `new F()` | object mới vừa tạo |
| 2 | `f.call(x)` / `f.apply(x)` / `f.bind(x)()` | `x` |
| 3 | `obj.f()` | `obj` |
| 4 | `f()` trần | `undefined` (strict / ESM / class) hoặc `globalThis` (sloppy) |
| 5 | hàm mũi tên | **không có luật** — lấy `this` của scope bao ngoài, lúc định nghĩa |

Luật 5 khác hẳn bốn luật kia: hàm mũi tên **không có** `this` của riêng nó. `call`/`bind`
không tác động được lên nó.

Đo cả năm:

```js
const o = { name: 'o', reg() { return this?.name } };
console.log('1 method   :', o.reg());
const d = o.reg;
console.log('2 tách ra  :', d());
console.log('3 call     :', o.reg.call({ name: 'X' }));
console.log('5 bind lồng:', o.reg.bind({ name: 'B1' }).bind({ name: 'B2' })());
```

```
1 method   : o
2 tách ra  : undefined
3 call     : X
5 bind lồng: B1
```

**Dòng 5 đáng nhớ:** `bind` lần thứ hai **không có tác dụng**. `bind` tạo ra một hàm đã bị
khoá `this` vĩnh viễn; `bind` tiếp chỉ tạo lớp bọc mới quanh hàm đã khoá. `B1` thắng, không
phải `B2`.

---

## 2. `this` khi gọi trần: bốn kết quả khác nhau tuỳ chỗ đặt code

Đây là chỗ hay bị dạy lẫn lộn. Chạy thật:

```
File .js (CommonJS, không "use strict"):
  gọi hàm trần f()              -> globalThis
  this ở top-level              -> module.exports (không phải globalThis!)

File .mjs (ESM — luôn strict):
  gọi hàm trần f()              -> undefined
  this ở top-level              -> undefined

Bên trong class (luôn strict, kể cả file sloppy):
  new C().s.call(undefined)     -> undefined
```

Ba điều cần nhớ:

1. **ESM luôn ở strict mode**, không cần viết `"use strict"`.
2. **Thân `class` luôn strict**, kể cả khi file xung quanh là sloppy.
3. Ở top-level của CommonJS, `this` là `module.exports` — **không** phải `globalThis`. Nhiều
   người viết `this.foo = ...` ở đầu file `.cjs` và tưởng đang tạo biến toàn cục.

---

## 3. Vì sao method "rơi mất `this`"

```js
class A { constructor() { this.n = 'A' } m() { return this.n } }
const a = new A();
const m = a.m;      // tách method ra khỏi object
m();
```

```
TypeError: Cannot read properties of undefined (reading 'n')
```

Không có gì bí ẩn: `a.m()` khớp luật 3, còn `m()` khớp luật 4. Chỗ gọi thay đổi, `this` thay
đổi theo.

Nó xuất hiện ở đâu trong code thật — ba chỗ:

```js
setTimeout(o.method, 100);              // truyền hàm đi nơi khác
arr.map(o.method);                       // truyền vào higher-order function
element.addEventListener('click', o.method);
```

Cả ba đều nhận **hàm**, không nhận **lời gọi**, nên `this` mất.

### Ba cách sửa, và cái giá của chúng

```js
setTimeout(() => o.method(), 100);      // 1. bọc trong arrow — giữ nguyên lời gọi o.method()
setTimeout(o.method.bind(o), 100);      // 2. bind
class A { m = () => this.n }            // 3. class field là arrow
```

Cách 3 phổ biến nhất trong React/Vue nhưng **có giá bằng bộ nhớ**. Method thường nằm trên
prototype, dùng chung cho mọi instance. Class field arrow được tạo lại **cho từng instance**:

```js
class M { m() { return 1 } }        // method trên prototype
class F { m = () => 1 }             // arrow là field của instance
```

```
1 triệu instance, method trên prototype: 3.2 -> 36.1 MB
1 triệu instance, arrow là class field : 3.2 -> 97.1 MB
```

**Gấp 2.7 lần.** Kiểm chứng nó nằm ở đâu:

```
m nằm ở đâu: hasOwn(instance) = false | hasOwn(prototype) = true
b nằm ở đâu: hasOwn(instance) = true  | hasOwn(prototype) = false
```

Với vài trăm object thì không sao. Với danh sách 100 000 dòng, mỗi dòng là một instance có 5
class-field arrow, đây là chỗ MB đi mất.

---

## 4. Hàm mũi tên: hai trường hợp trái ngược

```js
const p = { n: 'p', m() { return (() => this.n)() } };   // arrow BÊN TRONG method
console.log(p.m());
```

```
p
```

```js
const q = { n: 'q', m: () => this };                      // arrow LÀ method
```

Ở đây `this` lấy từ scope bao ngoài của **object literal** — mà object literal **không tạo
scope**. Nên `this` là `this` ở top-level file: `module.exports` trong CJS, `undefined` trong
ESM.

Quy tắc thực dụng:

- Arrow **bên trong** method → giữ đúng `this` của method. Đây là công dụng chính của arrow.
- Arrow **làm** method → gần như luôn là bug.

---

## 5. `new` làm chính xác 4 việc

```js
function F() { this.x = 1; return { x: 99 }; }
console.log('constructor trả về object   :', new F().x);

function G() { this.x = 1; return 42; }
console.log('constructor trả về primitive:', new G().x);
```

```
constructor trả về object   : 99
constructor trả về primitive: 1
```

`new F()` làm:

1. Tạo object rỗng `obj`.
2. Gán `Object.getPrototypeOf(obj) = F.prototype`.
3. Gọi `F` với `this = obj`.
4. **Nếu** `F` trả về một **object** thì lấy object đó; ngược lại (kể cả `return 42`,
   `return null`, không return) thì lấy `obj`.

Bước 4 là lý do `new G().x` cho `1` chứ không phải lỗi.

---

## 6. Chuỗi prototype

```js
class A { constructor() { this.n = 'A' } m() { return this.n } }
class B extends A { m() { return 'B->' + super.m() } }

console.log('super:', new B().m());
let p = new B(), chain = [];
while (p = Object.getPrototypeOf(p)) chain.push(p.constructor?.name ?? 'null');
console.log('chuỗi:', chain.join(' -> '));
console.log('Object.create(null):', Object.getPrototypeOf(Object.create(null)));
console.log('[] instanceof Object:', [] instanceof Object,
            '| Object.create(null) instanceof Object:', Object.create(null) instanceof Object);
```

```
super: B->A
chuỗi: B -> A -> Object
Object.create(null): null
[] instanceof Object: true | Object.create(null) instanceof Object: false
```

`Object.create(null)` tạo object **không có prototype**. Không `toString`, không `hasOwnProperty`,
`instanceof Object` là `false`. Dùng nó khi bạn cần một map thuần từ khoá do người dùng nhập
— vì `obj['constructor']` hay `obj['__proto__']` khi đó không đụng vào gì cả.

### Bẫy prototype: dữ liệu dùng chung

```js
function P() {}
P.prototype.list = [];
const p1 = new P(), p2 = new P();
p1.list.push('x');
console.log('p2.list:', p2.list);
```

```
p2.list: [ 'x' ]
```

`p1.list.push(...)` **không** ghi vào `p1` — nó **đọc** `p1.list` (rơi lên prototype) rồi
`push` vào chính mảng dùng chung. Cả hai instance thấy như nhau.

Nhưng **gán** thì khác:

```js
p1.list = ['mới'];
console.log(p1.list, p2.list, '| hasOwn:', Object.hasOwn(p1, 'list'), Object.hasOwn(p2, 'list'));
```

```
[ 'mới' ] [ 'x' ] | hasOwn: true false
```

Gán tạo thuộc tính **own** trên `p1`, che mất cái ở prototype. `p2` vẫn thấy mảng cũ.

**Quy tắc:** chỉ đặt hàm lên prototype. Dữ liệu (mảng, object) phải khởi tạo trong constructor.

---

## 7. Private field `#` — không phải quy ước, là cơ chế thật

```js
class C {
  #s = 1;
  static has(o) { return #s in o }      // "brand check"
  get() { return this.#s }
}
console.log('brand check:', C.has(new C()), C.has({}));
console.log('JSON.stringify:', JSON.stringify(new C()));
```

```
brand check: true false
JSON.stringify: {}
```

Ba điều `#` làm được mà quy ước `_ten` không làm được:

1. **Không truy cập được từ ngoài** — kể cả `Object.keys`, `Reflect.ownKeys`, `JSON.stringify`.
2. **`#s in o`** cho phép kiểm tra "object này có đúng là instance thật của class không" mà
   không ném lỗi — dùng để chống bị giả mạo bằng object có cùng hình dạng.
3. Truy cập `#s` trên object không phải instance ném `TypeError` ngay, không trả `undefined`.

Đánh đổi: `JSON.stringify` bỏ qua chúng hết. Muốn serialize thì phải viết `toJSON()` tay.

---

## 8. Bài tập

### Bài 1 — Dự đoán bốn dòng

```js
const obj = {
  n: 'obj',
  a() { return this?.n },
  b: () => this?.n,
  c() { return [1].map(function () { return this?.n })[0] },
  d() { return [1].map(() => this?.n)[0] },
};
console.log(obj.a(), obj.b(), obj.c(), obj.d());
```

<details><summary>Gợi ý đáp án</summary>

```
obj undefined undefined obj
```

- `a` — method thường, luật 3 → `obj`.
- `b` — arrow làm method, lấy `this` top-level. Trong ESM đó là `undefined`.
- `c` — callback của `map` là **function thường**, `map` gọi nó **trần** (luật 4) → `undefined`.
- `d` — arrow trong method, thừa hưởng `this` của `d` → `obj`.

Bonus: `map` có tham số thứ hai để chỉ định `this`:

```js
[1].map(function () { return this.n }, obj)[0]   // -> 'obj'
```

`forEach`, `map`, `filter`, `some`, `every`, `find` đều có tham số này. `reduce` thì **không**.

</details>

### Bài 2 — Vì sao counter đếm sai

```js
class Counter {
  count = 0;
  tang() { this.count++ }
}
const c = new Counter();
document.querySelector('button').addEventListener('click', c.tang);
```

Bấm nút thì báo `TypeError`. Nêu **ba** cách sửa và chỉ ra cách nào tốn bộ nhớ nhất khi có
10 000 nút.

<details><summary>Gợi ý đáp án</summary>

Lỗi: `addEventListener` gọi handler với `this = element`, nên `this.count` là `undefined` và
`undefined++` … thật ra không ném lỗi, nó cho `NaN`. Lỗi `TypeError` xảy ra ở bản `#count`
private. Với bản trên thì triệu chứng là **đếm ra `NaN`** — âm thầm hơn và khó tìm hơn.

```js
btn.addEventListener('click', () => c.tang());       // 1. arrow bọc ngoài
btn.addEventListener('click', c.tang.bind(c));       // 2. bind
class Counter { count = 0; tang = () => { this.count++ } }   // 3. class field arrow
```

Với 10 000 nút, mỗi nút một instance `Counter`:

- Cách 3 tốn nhất — mỗi instance mang một hàm riêng. Đo ở mục 3: gấp **2.7 lần**.
- Cách 2 cũng tạo hàm mới mỗi lần `bind`, nhưng chỉ khi gắn listener, và bạn còn giữ được
  tham chiếu để `removeEventListener` sau này — nếu bạn nhớ lưu nó lại.
- Cách 1 tạo một arrow mỗi lần gắn, tương đương cách 2 về bộ nhớ.

Cách rẻ nhất thật sự là **event delegation**: gắn **một** listener lên container, xem
`e.target` để biết nút nào. Bài 11 đo: 10 000 listener mất 3.30 ms để gắn, một listener
delegate mất 0.000 ms.

Bẫy đi kèm cách 2: `c.tang.bind(c)` tạo hàm **mới mỗi lần gọi**, nên
`removeEventListener('click', c.tang.bind(c))` **không gỡ được gì** — hai hàm khác nhau.

</details>

### Bài 3 — `instanceof` nói dối

Cho hai đoạn, cùng in `false`. Giải thích từng cái.

```js
// A
const arr = [];
console.log(arr instanceof Array);     // true — ok

// B
console.log(Object.create(null) instanceof Object);

// C  (trong trình duyệt, `iframeArray` là mảng tạo từ một iframe khác)
console.log(iframeArray instanceof Array);
```

<details><summary>Gợi ý đáp án</summary>

`instanceof` đi **dọc chuỗi prototype** tìm xem `Constructor.prototype` có nằm trên đó không.

**B** — `Object.create(null)` không có prototype nào cả, chuỗi rỗng, nên không thể tìm thấy
`Object.prototype`.

**C** — mỗi iframe có **realm** riêng, với `Array` riêng và `Array.prototype` riêng. Mảng từ
iframe kia có prototype là `Array.prototype` **của iframe kia**, khác object với
`Array.prototype` ở trang chính.

Cách kiểm tra không phụ thuộc realm:

```js
Array.isArray(iframeArray)                              // -> true
Object.prototype.toString.call(x)                       // -> "[object Array]"
```

`Array.isArray` kiểm tra "internal slot" của object, không đi qua prototype, nên xuyên realm
được. Đây cũng là lý do Chrome 152 có `Error.isError` (Node 22 chưa) — cùng bài toán, cho lỗi.

</details>

---

**Tiếp theo:** [Bài 03 — Kiểu dữ liệu và so sánh](./03-kieu-du-lieu-va-so-sanh.md)
