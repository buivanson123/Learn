# 72 câu hỏi phỏng vấn JavaScript

Mỗi câu có **Trả lời ngắn** (nói ra miệng, 20–30 giây) và **Giải thích sâu** (để đỡ câu hỏi
tiếp theo).

Đừng mở đáp án trước khi tự trả lời.

---

## Phần 1 — Scope, closure, TDZ (câu 1–11)

### 1. `var`, `let`, `const` khác nhau ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `var` có function scope và được khởi tạo sẵn bằng `undefined`; `let`/`const`
có block scope và nằm trong **TDZ** cho tới dòng khai báo. `const` không cho gán lại (nhưng
object bên trong vẫn sửa được).

**Giải thích sâu:** Cả ba **đều được hoisted**. Khác biệt là ở giá trị khởi tạo:

```js
console.log(a); var a = 1;      // undefined
console.log(b); let b = 2;      // ReferenceError: Cannot access 'b' before initialization
```

`let` cũng được hoisted — chứng minh bằng shadowing:

```js
let x = 'NGOÀI';
function f() { console.log(x); let x = 'TRONG' }
f();     // ReferenceError, KHÔNG in "NGOÀI"
```

Nếu `let x` bên trong không được hoisted thì dòng `console.log` phải thấy biến ngoài.

</details>

### 2. `typeof` có luôn an toàn với biến chưa khai báo không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không, từ ES2015. Nó an toàn với biến **chưa từng khai báo**, nhưng **ném
`ReferenceError`** với biến `let`/`const` đang trong TDZ.

**Giải thích sâu:**

```js
console.log(typeof chuaTonTai);              // "undefined" — không lỗi
console.log(typeof zz); let zz = 1;          // ReferenceError: Cannot access 'zz' before initialization
```

Đây là lý do mẫu `if (typeof x !== 'undefined')` không còn là cách kiểm tra an toàn nữa. Với
biến toàn cục thì dùng `'x' in globalThis`.

Và với tính năng **cú pháp** thì `typeof` hoàn toàn vô dụng — xem câu 66.

</details>

### 3. Vì sao `for (var i…)` cho `[3,3,3]` mà `for (let i…)` cho `[0,1,2]`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `var` chỉ có **một** ô nhớ cho cả hàm, ba closure trỏ chung vào nó. `let`
tạo **một binding mới mỗi vòng lặp**, giá trị được chép sang từ vòng trước.

**Giải thích sâu:** Nói "`let` có block scope" là chưa đủ — block scope một mình vẫn có thể cho
ba closure dùng chung một ô. Đặc tả nói rõ: mỗi vòng lặp tạo binding mới, và giá trị vòng trước
được **copy** vào trước khi chạy phần `i++`.

Chứng minh bằng cách sửa biến từ trong closure:

```js
const fs = [];
for (let k = 0; k < 3; k++) fs.push(() => ++k);
console.log(fs[0](), fs[0](), fs[0](), fs[1]());
```

```
1 2 3 2
```

- `fs[0]` đếm riêng 1→2→3 ⇒ **ô nhớ riêng**.
- `fs[1]` lần đầu cho **2** (không phải 1) ⇒ nó được khởi tạo bằng bản sao `k = 1` từ vòng trước.

Nếu chung một ô, kết quả phải là `1 2 3 4`.

</details>

### 4. Ba cách sửa bug `var` trong vòng lặp mà không dùng `let`?

<details><summary>Đáp án</summary>

```js
for (var i = 0; i < 3; i++) (j => setTimeout(() => console.log(j), 0))(i);   // IIFE
for (var i = 0; i < 3; i++) setTimeout(console.log, 0, i);                    // tham số thứ 3
for (var i = 0; i < 3; i++) setTimeout(console.log.bind(null, i), 0);         // bind
```

Cách 2 ít người biết nhất và tốt nhất: `setTimeout(fn, delay, ...args)` truyền args thẳng vào
callback, nên không tạo closure nào. Trong vòng lặp lớn đó là khác biệt đo được.

</details>

### 5. Closure là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hàm cộng với **tham chiếu tới environment record** của scope nơi nó được tạo.

**Giải thích sâu:** Chữ then chốt là **environment record**, không phải "các biến nó dùng". Đó
là nguồn của hệ quả bộ nhớ ở câu 6 và 7 — và là chỗ phân biệt người đã gặp bug thật với người
chỉ đọc định nghĩa.

Ba công dụng chính: giữ trạng thái riêng (module pattern), tạo hàm chuyên biệt (partial
application/curry), và giữ context cho callback bất đồng bộ.

</details>

### 6. V8 có giữ **mọi** biến trong scope của closure không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không — V8 phân tích lúc biên dịch và chỉ đưa vào context những biến **có
closure nào dùng tới**.

**Giải thích sâu:** Đo thật, 20 closure, mỗi cái tạo ra sau khi cấp phát mảng 1 triệu số:

```js
function taoA() { const big = new Array(1e6).fill(0); const small = 1; return () => small }
function taoB() { const big = new Array(1e6).fill(0); const small = 1; return () => big.length }
```

```
20 closure KHÔNG dùng `big`: 3.16 -> 3.16 MB      ← không tăng một byte
20 closure CÓ dùng `big`  : 3.34 -> 155.94 MB
```

Nhưng sự thông minh đó có giới hạn — xem câu 7.

</details>

### 7. Vì sao giữ một hàm trả về số `1` lại có thể giữ 152 MB?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì các closure tạo trong **cùng một lần gọi** dùng chung **một** environment
record. Chỉ cần một trong số chúng dùng biến lớn, thì mọi closure còn lại cũng giữ biến đó.

**Giải thích sâu:**

```js
function bay() {
  const big = new Array(1e6).fill(0);
  return {
    nho: () => 1,                 // không đụng `big`
    to:  () => big.length,        // có đụng `big`
  };
}
const chiGiuNho = [];
for (let i = 0; i < 20; i++) chiGiuNho.push(bay().nho);   // vứt `to` đi ngay
```

```
chỉ giữ hàm `nho`: 3.34 -> 155.94 MB
gọi thử: 1
```

Y hệt trường hợp giữ cả `big`. Record phải chứa `big` vì `to` cần; `nho` sống thì record sống.

Nó xuất hiện trong mọi factory / composable / custom hook:

```js
function taoBang(rowsTho) {          // 50 MB
  const daXuLy = xuLy(rowsTho);
  return {
    render: () => daXuLy.map(...),
    layTieuDe: () => rowsTho[0].keys,     // ⚠ giữ luôn 50 MB dữ liệu thô
  };
}
const f = taoBang(res.data).layTieuDe;     // giữ nguyên 50 MB
```

Hai cách sửa: **tách scope** (rút giá trị cần ra một hàm riêng), hoặc `bien = null` sau khi
dùng xong — đo lại cho **3.23 → 3.23 MB**.

</details>

### 8. Trong heap snapshot, thấy `context` trong *Retainers* nghĩa là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Có một closure đang giữ object đó. `context` là tên V8 đặt cho environment
record.

**Giải thích sâu:** Đây là dấu hiệu quan trọng nhất khi tìm rò rỉ. Bảng nhận diện:

| Thấy trong chuỗi giữ | Kiểu rò rỉ |
|---|---|
| `context` | closure |
| `Detached HTMLxxxElement` | detached DOM |
| `Window` / `EventListener` | listener không gỡ |
| `Map`, hoặc mảng ở module scope | cache không giới hạn |
| `Timeout` | `setInterval` chưa `clearInterval` |

</details>

### 9. Module pattern bằng closure và bằng `#private` — khác gì nhau?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Closure tạo bản sao biến riêng cho **mỗi instance** (tốn bộ nhớ hơn);
`#private` là thuộc tính thật của instance, method vẫn nằm trên prototype (dùng chung).

**Giải thích sâu:** Đo với 1 triệu instance:

```
method trên prototype : 36.1 MB
arrow là class field  : 97.1 MB      ← gấp 2.7 lần
```

Closure-based factory có cùng đặc tính với cột thứ hai: mỗi instance mang một bộ hàm riêng.

Nhưng `#private` cho một thứ closure không cho: **brand check**.

```js
class C { #s = 1; static has(o) { return #s in o } }
C.has(new C())    // true
C.has({})         // false — không ném lỗi
```

Và `JSON.stringify(new C())` cho `{}` — `#` field không serialize được, phải viết `toJSON()` tay.

</details>

### 10. IIFE ngày nay còn dùng để làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Gần như không còn — `{ }` với `let` đã tạo được scope. Công dụng còn lại: chạy
`await` ở nơi không có top-level await (file `.cjs`).

**Giải thích sâu:** Trong ESM thì cả công dụng đó cũng mất, vì top-level await chạy được:

```
$ node --input-type=module -e "const r = await Promise.resolve('ok'); console.log(r)"
ok
```

Nếu thấy IIFE trong code mới, thường là dấu hiệu code được viết theo quán tính từ ES5.

</details>

### 11. Biến `var` ở top-level file có vào `globalThis` không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không, trong cả ESM và CJS. Chỉ có `<script>` cổ điển trong trình duyệt là có.

**Giải thích sâu:** Đo cả bốn trường hợp:

```
node z3.mjs   (ESM)                     -> globalThis.gx = undefined
node z3.cjs   (CJS)                     -> globalThis.gx = undefined
<script>var a = 1</script>              -> globalThis.a  = 1
<script type=module>var b = 1</script>  -> globalThis.b  = undefined
```

Hai lý do khác nhau cho cùng kết quả: ESM có scope module theo đặc tả; CJS thì Node bọc file bạn
trong một hàm `(function (exports, require, module, __filename, __dirname) {...})`.

Hệ quả thực tế: chuyển một file `<script>` cũ sang `type="module"` làm **mọi biến toàn cục mà
file khác đang dựa vào biến mất** — một trong những lỗi khó hiểu nhất khi hiện đại hoá code cũ.

</details>

---

## Phần 2 — `this`, prototype, class (câu 12–20)

### 12. `this` được quyết định thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tại chỗ **gọi**, không phải chỗ định nghĩa. Xét theo thứ tự: `new` → `call`/
`apply`/`bind` → `obj.f()` → gọi trần. Arrow không có luật riêng — nó lấy `this` của scope bao
ngoài lúc định nghĩa.

**Giải thích sâu:**

| # | Dạng gọi | `this` |
|---|---|---|
| 1 | `new F()` | object mới |
| 2 | `f.call(x)` / `bind(x)()` | `x` |
| 3 | `obj.f()` | `obj` |
| 4 | `f()` trần | `undefined` (strict/ESM/class) hoặc `globalThis` |
| 5 | arrow | `this` của scope bao ngoài |

Cách nói gọn để nhớ: `this` là **tham số thứ 0 ngầm định của lời gọi hàm**.

</details>

### 13. `f.bind(a).bind(b)()` cho `this` là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `a`. `bind` lần thứ hai **vô tác dụng**.

**Giải thích sâu:**

```js
const o = { name: 'o', reg() { return this?.name } };
o.reg.bind({ name: 'B1' }).bind({ name: 'B2' })()    // -> 'B1'
```

`bind` trả về một *bound function* đã khoá `this` vĩnh viễn. `bind` tiếp chỉ bọc thêm một lớp
quanh hàm đã khoá; lớp ngoài không xuyên qua được.

Hệ quả liên quan: `call`/`apply` cũng **không** đổi được `this` của bound function.

</details>

### 14. `this` ở top-level của một file — bằng gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** CJS: `module.exports`. ESM: `undefined`. `<script>` cổ điển: `window`.

**Giải thích sâu:**

```
File .js (CJS, không "use strict"):
  gọi hàm trần f()      -> globalThis
  this ở top-level      -> module.exports        ← KHÔNG phải globalThis

File .mjs (ESM — luôn strict):
  gọi hàm trần f()      -> undefined
  this ở top-level      -> undefined
```

Nhiều người viết `this.foo = ...` ở đầu file `.cjs` và tưởng đang tạo biến toàn cục; thật ra
đang thêm vào `module.exports`.

Thêm hai điều: **ESM luôn strict** không cần `"use strict"`, và **thân `class` luôn strict** kể
cả trong file sloppy.

</details>

### 15. Vì sao `setTimeout(o.method, 100)` mất `this`? Ba cách sửa và cái giá?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `o.method()` khớp luật 3, còn `setTimeout` nhận **hàm** rồi gọi nó **trần** →
luật 4. Chỗ gọi đổi thì `this` đổi.

**Giải thích sâu:** Ba nơi cùng bị: `setTimeout`, `addEventListener`, `arr.map` — tất cả nhận
hàm, không nhận lời gọi.

```js
setTimeout(() => o.method(), 100);        // 1. arrow bọc ngoài
setTimeout(o.method.bind(o), 100);        // 2. bind
class A { m = () => this.n }               // 3. class field arrow
```

Cái giá của cách 3, đo với 1 triệu instance: **97.1 vs 36.1 MB** — gấp 2.7 lần, vì method thường
nằm trên prototype (dùng chung) còn class field được tạo lại cho từng instance.

Cái bẫy của cách 2: `o.method.bind(o)` tạo **hàm mới mỗi lần gọi**, nên
`removeEventListener('click', o.method.bind(o))` **không gỡ được gì**.

Với danh sách lớn, câu trả lời đúng là cả bốn đều sai — dùng **event delegation**: một listener
trên container (đo: 10 000 listener mất 3.30 ms để gắn; delegate mất 0.000 ms).

</details>

### 16. Dự đoán bốn dòng này:

```js
const obj = { n: 'obj',
  a() { return this?.n },
  b: () => this?.n,
  c() { return [1].map(function () { return this?.n })[0] },
  d() { return [1].map(() => this?.n)[0] } };
console.log(obj.a(), obj.b(), obj.c(), obj.d());
```

<details><summary>Đáp án</summary>

```
obj undefined undefined obj
```

- `a` — method thường, luật 3 → `obj`.
- `b` — arrow **làm** method. Object literal không tạo scope, nên `this` là `this` top-level file
  (`undefined` trong ESM). Gần như luôn là bug.
- `c` — callback của `map` là function thường, `map` gọi nó **trần** → `undefined`.
- `d` — arrow **bên trong** method, thừa hưởng `this` của `d` → `obj`. Đây là công dụng chính
  của arrow.

Bonus đáng nói ra: `map` có tham số thứ hai chỉ định `this`:

```js
[1].map(function () { return this.n }, obj)[0]    // -> 'obj'
```

`forEach`/`map`/`filter`/`some`/`every`/`find` đều có; **`reduce` thì không**.

</details>

### 17. `new F()` làm chính xác những gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tạo object rỗng, gán prototype của nó bằng `F.prototype`, gọi `F` với
`this` là object đó, rồi: **nếu `F` trả về một object thì lấy object đó, ngược lại lấy `this`**.

**Giải thích sâu:** Bước 4 là chỗ hay bị hỏi:

```js
function F() { this.x = 1; return { x: 99 } }    new F().x    // -> 99
function G() { this.x = 1; return 42 }           new G().x    // -> 1
```

`return 42`, `return null`, `return undefined`, không return — cả bốn đều cho `this`. Chỉ
`return <object>` mới ghi đè.

</details>

### 18. `class` có phải chỉ là "syntactic sugar" của function không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Gần đúng nhưng không hoàn toàn. Có bốn khác biệt **không** biểu diễn được bằng
function thuần.

**Giải thích sâu:**

1. **Không hoisted dùng được** — `new A()` trước `class A {}` ném `ReferenceError` (TDZ), còn
   `function` thì chạy.
2. **Phải gọi bằng `new`** — `A()` ném `TypeError: Class constructor A cannot be invoked
   without 'new'`.
3. **Thân class luôn strict**, kể cả trong file sloppy.
4. **`#private` field** — thật sự không truy cập được từ ngoài, không phải quy ước.

Còn `extends` thì đúng là prototype chain:

```js
class B extends A { m() { return 'B->' + super.m() } }
// chuỗi: B -> A -> Object
```

</details>

### 19. Vì sao hai instance lại dùng chung một mảng?

```js
function P() {}
P.prototype.list = [];
const p1 = new P(), p2 = new P();
p1.list.push('x');
console.log(p2.list);
```

<details><summary>Đáp án</summary>

```
[ 'x' ]
```

**Trả lời ngắn:** `p1.list.push(...)` **không ghi** vào `p1` — nó **đọc** `p1.list` (rơi lên
prototype) rồi sửa chính mảng dùng chung.

**Giải thích sâu:** Đọc và ghi hành xử khác nhau. **Gán** thì tạo thuộc tính own:

```js
p1.list = ['mới'];
console.log(p1.list, p2.list, Object.hasOwn(p1, 'list'), Object.hasOwn(p2, 'list'));
// [ 'mới' ] [ 'x' ] true false
```

**Quy tắc:** chỉ đặt **hàm** lên prototype. Dữ liệu (mảng, object) phải khởi tạo trong constructor.

</details>

### 20. `instanceof` sai trong trường hợp nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Với `Object.create(null)` (không có prototype), và **xuyên realm** (iframe,
`vm` của Node, worker).

**Giải thích sâu:** `instanceof` đi dọc chuỗi prototype tìm `Constructor.prototype`.

```js
Object.create(null) instanceof Object    // false — chuỗi rỗng
iframeArray instanceof Array             // false — Array.prototype của iframe khác object
```

Cách không phụ thuộc realm:

```js
Array.isArray(x)                          // kiểm internal slot, xuyên realm được
Object.prototype.toString.call(x)         // "[object Array]"
```

Đây cũng là lý do Chrome 152 đã có `Error.isError` (Node 22 chưa): cùng bài toán, cho lỗi —
`err instanceof Error` sai khi lỗi đến từ realm khác.

</details>

---

## Phần 3 — Event loop (câu 21–28)

### 21. Giải thích event loop.

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Một luồng, hai loại hàng đợi. Chạy hết code đồng bộ → **vét sạch** hàng đợi
microtask (kể cả microtask mới sinh ra trong lúc vét) → lấy **một** macrotask → lặp lại.

**Giải thích sâu:** Khác biệt **"vét sạch" vs "lấy một"** là điều quan trọng nhất, vì nó giải
thích cả câu 24.

| Hàng đợi | Ai vào |
|---|---|
| microtask | `.then`, phần sau `await`, `queueMicrotask`, `MutationObserver` |
| macrotask | `setTimeout`, `setInterval`, I/O, sự kiện DOM, `setImmediate` |

Trong trình duyệt, một khung hình là: macrotask → vét microtask → `requestAnimationFrame` →
style/layout/paint → `requestIdleCallback`.

</details>

### 22. Sắp thứ tự output:

```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => { console.log('C'); setTimeout(() => console.log('D'), 0) });
(async () => { console.log('E'); await null; console.log('F') })();
queueMicrotask(() => console.log('G'));
console.log('H');
```

<details><summary>Đáp án</summary>

```
A E H C F G B D
```

1. **Đồng bộ:** `A`, rồi phần đồng bộ của async IIFE là `E`, rồi `H`.
2. **Vét microtask** theo thứ tự xếp hàng: `C` (và nó xếp thêm `setTimeout D`), `F`, `G`.
3. **Macrotask:** `B` (xếp lúc đồng bộ), rồi `D` (xếp lúc chạy `C`).

Hai chỗ dễ sai: `E` (nhiều người đặt sau `H` chỉ vì thấy chữ `async`), và `D` (ở cuối, không
phải ngay sau `C`).

</details>

### 23. Phần đồng bộ của `async function` chạy khi nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Ngay lập tức**, đồng bộ, cho tới `await` đầu tiên. `async` không có nghĩa
"chạy sau"; nó có nghĩa "có thể tạm dừng ở `await`".

**Giải thích sâu:** Đây là lý do dòng `E` ở câu 22 in trước `H`. Và là lý do đoạn này reject
**đồng bộ hoá** được:

```js
async function f() { validate(x); return await goiAPI() }   // validate ném lỗi -> reject
```

Nhưng `try/catch` **đồng bộ** không bắt được, vì hàm đã trả về promise:

```js
async function g() { throw new Error('nổ') }
try { g() } catch (e) { /* KHÔNG chạy */ }
```

Trên Node 22, đoạn trên còn **giết tiến trình** với `UnhandledPromiseRejection`.

</details>

### 24. Microtask có thể làm `setTimeout(f, 0)` chậm bao lâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vô hạn về lý thuyết. Đo thật với 1 triệu microtask lồng nhau: **137 ms**.

**Giải thích sâu:**

```js
let n = 0; const t0 = Date.now();
setTimeout(() => console.log('setTimeout sau', Date.now() - t0, 'ms, n =', n), 0);
function loop() { if (n++ < 1e6) queueMicrotask(loop) }
queueMicrotask(loop);
```

```
setTimeout chạy sau 137 ms, n = 1000001
```

Vì luật là **vét sạch**, và hàng đợi không bao giờ rỗng. Trong trình duyệt hậu quả là trang đơ
hoàn toàn — không render, không nhận click — và DevTools không chỉ được vào đâu (CPU không cao,
call stack không sâu).

Code thật gây ra nó:

```js
async function xuLyHangDoi() {
  const viec = hangDoi.shift();
  if (!viec) return;
  await lam(viec);            // nếu lam() resolve đồng bộ (có cache) -> chỉ 1 microtask
  return xuLyHangDoi();       // đệ quy vô hạn trong microtask
}
```

Nghiệt ở chỗ nó **chỉ đơ khi cache nóng** — test với dữ liệu thật thì chạy tốt.

Sửa: chèn macrotask mỗi N vòng — `await new Promise(r => setTimeout(r, 0))`, hoặc
`await scheduler.yield()` (Chrome 152, giữ ưu tiên cao khi quay lại).

</details>

### 25. `setTimeout(f, 0)` và `setImmediate(f)` — cái nào chạy trước?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ở module chính thì **không xác định**. Trong callback I/O thì `setImmediate`
**luôn** trước.

**Giải thích sâu:** Chạy 10 lần cùng một file ở module chính:

```
setTimeout, setImmediate, setImmediate, setImmediate, setImmediate,
setImmediate, setImmediate, setImmediate, setImmediate, setImmediate
```

Lần đầu khác chín lần sau — phụ thuộc tiến trình khởi động mất bao lâu so với ngưỡng 1 ms của
timer.

Trong callback `fs.readFile` thì `setImmediate` thắng 5/5 lần, vì vòng lặp đang ở pha `poll` và
pha `check` (nơi `setImmediate` chạy) đến ngay sau, còn `timers` phải chờ hết một vòng.

**Kết luận:** trong Node, muốn "nhả luồng một nhịp" thì dùng `setImmediate`.

</details>

### 26. `process.nextTick` chạy trước hay sau `.then`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Tuỳ file là CJS hay ESM.** CJS: trước. ESM: sau.

**Giải thích sâu:** Cùng một file, chỉ đổi đuôi:

```
$ node el.cjs               $ node el.mjs
N1 process.nextTick         P1 .then
P1 .then                    Q1 queueMicrotask
Q1 queueMicrotask           P2 sau await
P2 sau await                N1 process.nextTick
```

Lý do: Node đánh giá module ESM **bên trong một microtask** (vì ESM hỗ trợ top-level await nên
quá trình nạp là bất đồng bộ). Khi thân module chạy, hàng đợi microtask đang được vét dở nên
`nextTick` bị xếp sau đợt vét đó.

**Kết luận:** đừng bao giờ dựa vào `nextTick` vs `then` để đồng bộ hoá — code sẽ vỡ vào ngày ai
đó chuyển dự án sang ESM.

Đây là câu hỏi hay dùng để phân biệt Middle với Senior.

</details>

### 27. `await` tốn bao nhiêu nhịp microtask?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** 1 nhịp với promise native và với giá trị thường. **2 nhịp** với thenable.

**Giải thích sâu:** Đo bằng cách chèn một chuỗi `.then` đánh số:

```
await Promise.resolve     ← nhịp 0
await 1                   ← nhịp 0
tick1
await thenable            ← giữa nhịp 1 và 2
tick2
```

| Chờ gì | Nhịp |
|---|---|
| `await 1` | 1 |
| `await Promise.resolve()` | 1 |
| `await { then(r){r()} }` | **2** |

`await promise` từng tốn 3 nhịp, nhưng V8 đã tối ưu từ bản 7.2 (2018). Nếu ai nói 3 nhịp, họ
đang trích tài liệu cũ.

Thenable vẫn tốn thêm 1 nhịp vì đặc tả bắt buộc bọc nó vào promise thật. Nếu bạn dùng Bluebird,
jQuery Deferred, hoặc object tự viết có `.then`, mọi `await` lên nó chậm hơn một nhịp và thứ tự
với code khác thay đổi.

</details>

### 28. Test này thỉnh thoảng đỏ. Vì sao, sửa thế nào không dùng `setTimeout`?

```js
it('cập nhật state', () => {
  const store = taoStore();
  store.dispatch({ type: 'TANG' });      // bên trong có await
  expect(store.getState().count).toBe(1);
});
```

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `dispatch` cập nhật state trong microtask; `expect` chạy đồng bộ ngay sau nên
đọc state cũ. Nó "thỉnh thoảng xanh" vì một số đường đi trong reducer (ví dụ có cache) không có
`await` thật.

**Giải thích sâu:** Ba cách sửa, theo thứ tự ưu tiên:

```js
await store.dispatch({ type: 'TANG' });              // 1. tốt nhất: sửa API trả về promise
await Promise.resolve();                              // 2. vét 1 nhịp microtask
await new Promise(r => setImmediate(r));              // 3. qua macrotask -> vét SẠCH microtask
```

Cách 2 chỉ vét **một** nhịp — không đủ nếu bên trong có `await thenable` (2 nhịp, câu 27) hoặc
`await` lồng nhau. Cách 3 chắc chắn hơn.

Điểm cần nói ra: `await new Promise(r => setTimeout(r, 0))` "đợi bừa" vừa chậm vừa **vẫn có thể
thiếu**. Sửa API để nó trả về promise là cách duy nhất không mong manh.

</details>

---

## Phần 4 — Promise và async (câu 29–38)

### 29. Bốn combinator của Promise — chọn cái nào khi nào?

<details><summary>Đáp án</summary>

| | Xong khi | Kết quả |
|---|---|---|
| `all` | tất cả xong, hoặc **một** hỏng | mảng / lỗi đầu tiên |
| `allSettled` | tất cả kết thúc | `{status, value\|reason}[]` — **không bao giờ reject** |
| `race` | **một cái bất kỳ** kết thúc | giá trị hoặc lỗi của nó |
| `any` | **một cái thành công** | giá trị đó / `AggregateError` |

- 5 API cần đủ cả 5 → `all`
- Dashboard, thiếu vài widget vẫn hiển thị được → `allSettled` (**đúng trong 80% trường hợp**)
- 3 CDN lấy cái nhanh nhất → **`any`**, không phải `race` (`race` thua nếu CDN nhanh nhất trả 500)
- Đặt hạn giờ → `race`

Đo thật với một nhánh hỏng ở 10 ms:

```
all         : ❌ Error: BOOM                      (11ms)   ← KHÔNG chờ nhánh còn lại
allSettled  : ✅ ["fulfilled","rejected"]          (31ms)
any         : ✅ "a"                               (32ms)
any all-fail: ❌ AggregateError | errors: e1,e2    (21ms)
```

`AggregateError` có `.errors` là **mảng** mọi lỗi.

</details>

### 30. `Promise.all` reject rồi thì các nhánh còn lại có dừng không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Không.** Chúng vẫn chạy tới cùng, chỉ là bạn không thấy kết quả. `all` trả
về sau 11 ms trong khi nhánh 50 ms vẫn đang chạy.

**Giải thích sâu:** Promise không huỷ được. Muốn thật sự dừng thì phải dùng `AbortController`:

```js
const ac = new AbortController();
try {
  await Promise.all(urls.map(u => fetch(u, { signal: ac.signal })));
} catch (e) {
  ac.abort();          // giờ mới thật sự dừng các request còn lại
  throw e;
}
```

</details>

### 31. Bốn kiểu nuốt lỗi trong code bất đồng bộ?

<details><summary>Đáp án</summary>

**1. Gọi `async function` mà không `await`:**

```js
function xuLy() { luu(); return 'OK' }      // trả OK, dữ liệu không được lưu
```

Node 15+ **giết tiến trình**; trình duyệt chỉ ghi console. Nếu cố tình:
`void luu().catch(err => logger.error(err))`.

**2. `forEach` với callback `async`:**

```js
items.forEach(async (x) => { await luu(x) });
console.log('xong');       // in ngay, chưa lưu cái nào, lỗi cũng mất
```

`forEach` gọi callback, nhận promise, rồi **vứt đi**.

**3. `.catch` đặt giữa chuỗi mà không `throw` lại:**

```js
layDuLieu().catch(e => log(e)).then(d => d.items);
// sau .catch, chuỗi về trạng thái fulfilled với undefined -> .then vẫn chạy -> TypeError
```

**4. Nhánh **thua** của `race`:**

```js
Promise.race([sleep(5, 'nhanh'), fail(20, 'NỔ')]).then(v => console.log(v));
// -> "nhanh", và KHÔNG có unhandledRejection nào
```

Vì `race` đã gắn handler lên **cả hai** promise, nên nhánh thua được coi là "đã xử lý". Lỗi biến
mất hoàn toàn — không log, không cảnh báo. Đây là kiểu ít người biết nhất.

</details>

### 32. Hàm này in ra gì, và nếu `tai(2)` lỗi thì sao?

```js
async function taiTatCa(ids) {
  const kq = [];
  for (const id of ids) tai(id).then(r => kq.push(r));
  return kq;
}
console.log((await taiTatCa([1, 2, 3])).length);
```

<details><summary>Đáp án</summary>

```
0
```

**Trả lời ngắn:** `return kq` chạy ngay khi vòng lặp **khởi động** xong, trước khi promise nào
hoàn thành. `await` bên ngoài không giúp gì — `taiTatCa` không chờ cái gì cả.

**Giải thích sâu:** Nếu `tai(2)` lỗi, không có `.catch` nào trên chuỗi đó →
`unhandledRejection` → Node 15+ giết tiến trình.

```js
async function taiTatCa(ids) { return Promise.all(ids.map(tai)) }        // ✅

// Nếu một cái lỗi không được kéo đổ cả mẻ:
async function taiTatCa(ids) {
  const kq = await Promise.allSettled(ids.map(tai));
  for (const x of kq) if (x.status === 'rejected') logger.warn(x.reason);
  return kq.filter(x => x.status === 'fulfilled').map(x => x.value);
}
```

</details>

### 33. Đoạn này chạy tuần tự hay song song?

```js
const pA = layA();
const pB = layB();
const a = await pA;
const b = await pB;
```

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Song song.** Promise chạy khi được **tạo**, không phải khi được `await`.

**Giải thích sâu:** Đo thật với ba việc I/O 200 ms mỗi cái:

```
tuần tự (await từng cái)  : 608ms
song song (Promise.all)   : 202ms
```

Đoạn trong câu hỏi hành xử như bản song song. Đó là bẫy **hai chiều**:

- Nếu bạn **muốn** song song mà viết `await layA(); await layB();` → chậm 3 lần.
- Nếu bạn **muốn** tuần tự (B chỉ chạy khi A thành công) mà viết như câu hỏi → sai nghiệp vụ, và
  nếu `pB` reject trước khi bạn `await` nó thì còn dính `unhandledRejection`.

</details>

### 34. Hàm `retry` này có ba lỗi. Tìm ra.

```js
async function thuLai(fn, lan = 3) {
  for (let i = 0; i < lan; i++) {
    try { return fn() } catch (e) { await new Promise(r => setTimeout(r, 1000)) }
  }
}
```

<details><summary>Đáp án</summary>

**1. `return fn()` không `await`.** Promise được trả về ngay; nếu nó reject thì lỗi xảy ra
**ngoài** `try` → `catch` không bắt được → không có lần thử lại nào.

**2. Thất bại lần cuối trả `undefined`.** Người gọi tưởng thành công với dữ liệu rỗng.

**3. Chờ cố định 1000 ms.** Nhiều client thử lại cùng lúc sẽ đánh sập server đang quá tải
(thundering herd).

```js
async function thuLai(fn, { lan = 3, cho = 300, signal } = {}) {
  let loiCuoi;
  for (let i = 0; i < lan; i++) {
    signal?.throwIfAborted();
    try { return await fn() }                          // ✅ await
    catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) throw e;   // ✅ đừng retry lỗi client
      loiCuoi = e;
      if (i === lan - 1) break;                        // ✅ đừng chờ sau lần cuối
      await new Promise(r => setTimeout(r, cho * 2 ** i * (0.5 + Math.random())));  // ✅ backoff + jitter
    }
  }
  throw loiCuoi;                                        // ✅ ném lỗi thật
}
```

Nêu thêm hai điểm để ghi điểm: **không chờ sau lần thử cuối** (300 ms lãng phí), và **chỉ retry
lỗi retry được** — thử lại `400 Bad Request` là vô nghĩa.

</details>

### 35. `AbortController` — `AbortError` và `TimeoutError` khác gì nhau?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `ac.abort()` cho `name === 'AbortError'`; `AbortSignal.timeout(ms)` cho
`name === 'TimeoutError'`. Code chỉ kiểm `AbortError` sẽ coi hết giờ là lỗi thật.

**Giải thích sâu:** Đo thật:

```
ac.abort()               -> DOMException  name="AbortError"    "signal is aborted without reason"
AbortSignal.timeout(150) -> DOMException  name="TimeoutError"  "signal timed out"
ac.abort(new Error('x')) -> Error         "x"                  ← đúng object bạn truyền
```

Nên **phân biệt bằng `e.name`**, đừng bằng `instanceof` — dòng thứ ba không phải `DOMException`.

Gộp nhiều tín hiệu (vừa có timeout vừa có nút Huỷ):

```js
const signal = AbortSignal.any([ac.signal, AbortSignal.timeout(5000)]);
```

Cách nối vào hàm tự viết:

```js
function viec(ms, signal) {
  return new Promise((res, rej) => {
    signal?.throwIfAborted();                       // đã huỷ từ trước thì nổ ngay
    const id = setTimeout(() => res('xong'), ms);
    signal?.addEventListener('abort', () => { clearTimeout(id); rej(signal.reason) },
                             { once: true });        // ⚠ once, nếu không listener tích tụ
  });
}
```

</details>

### 36. Viết `pLimit(n)`.

<details><summary>Đáp án</summary>

```js
function pLimit(n) {
  let dangChay = 0;
  const hangDoi = [];
  const tiep = () => {
    if (dangChay >= n || !hangDoi.length) return;
    dangChay++;
    const { fn, res, rej } = hangDoi.shift();
    Promise.resolve().then(fn).then(res, rej)
      .finally(() => { dangChay--; tiep() });
  };
  return fn => new Promise((res, rej) => { hangDoi.push({ fn, res, rej }); tiep() });
}
```

Kiểm chứng — 10 việc mỗi việc 50 ms, giới hạn 3:

```
đỉnh đồng thời: 3 | tổng thời gian: 208 ms
```

4 đợt × 50 ms ≈ 200 ms. Khớp.

Ba chi tiết bắt buộc (nói ra để ghi điểm):

1. **`Promise.resolve().then(fn)`** thay vì `fn()` — nếu `fn` ném lỗi **đồng bộ**, gọi thẳng làm
   nổ `tiep()` và `dangChay` không bao giờ giảm → **treo vĩnh viễn**.
2. **`.finally`** chứ không `.then` — phải giảm bộ đếm cả khi lỗi.
3. Gọi `tiep()` **trong** `finally` — đó là thứ giữ cho hàng đợi chảy.

</details>

### 37. `for await (const r of ids.map(f))` có giới hạn số request đồng thời không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không. `ids.map(f)` khởi động **tất cả** ngay lập tức. `for await` chỉ điều
tiết việc **đọc kết quả**, không điều tiết việc **gửi đi**.

**Giải thích sâu:** Với 5000 id, bạn vừa bắn 5000 request cùng lúc — và có thể bị rate limit
hoặc làm sập server của mình.

```js
for (const id of ids) await f(id);                             // tuần tự, 1 lúc 1 cái
await Promise.all(ids.map(id => limit(() => f(id))));          // song song có giới hạn
```

Bản dùng async generator để vừa lười vừa có giới hạn:

```js
async function* theoLo(ids, n, f) {
  for (let i = 0; i < ids.length; i += n) {
    yield* await Promise.all(ids.slice(i, i + n).map(f));
  }
}
for await (const r of theoLo(ids, 5, tai)) { ... }
```

</details>

### 38. Promise resolve hai lần thì sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Lần thứ hai và mọi lần sau **bị bỏ qua hoàn toàn** — không lỗi, không cảnh báo.

**Giải thích sâu:**

```js
const p = new Promise((res, rej) => { res('A'); res('B'); rej(new Error('C')) });
p.then(v => console.log(v)).catch(e => console.log('lỗi:', e.message));
// -> A
```

Đây là lý do mẫu timeout dưới đây an toàn — "ai xong trước thì thắng", không cần cờ:

```js
function timeout(ms, p) {
  return new Promise((res, rej) => {
    const id = setTimeout(() => rej(new Error('hết giờ')), ms);
    p.then(res, rej).finally(() => clearTimeout(id));
  });
}
```

</details>

---

## Phần 5 — Kiểu dữ liệu, so sánh, JSON (câu 39–46)

### 39. Vì sao `0.1 + 0.2 !== 0.3`? Tính tiền thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mọi số (trừ `BigInt`) là IEEE 754 double 64 bit; `0.1` và `0.2` không biểu
diễn chính xác được ở hệ hai. Tính tiền thì quy về **đơn vị nhỏ nhất, dùng số nguyên**.

**Giải thích sâu:**

```
0.1 + 0.2           = 0.30000000000000004
(1.005).toFixed(2)  = "1.00"        ← không phải "1.01"!
0.57 * 100          = 56.99999999999999
```

`(1.005).toFixed(2)` cho `"1.00"` vì `1.005` thật ra là `1.00499999999999989...`. Đây là lý do
**không bao giờ dùng `Number` cho tiền**.

```js
const xu = Math.round(gia * 100);      // lưu 12345 thay vì 123.45
```

So sánh số thực thì so bằng sai số:

```js
const gan = (a, b) => Math.abs(a - b) < Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
```

</details>

### 40. `9007199254740992 === 9007199254740993` cho gì? Hệ quả thực tế?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `true`. Trên `Number.MAX_SAFE_INTEGER`, hai số nguyên khác nhau có thể cùng
biểu diễn.

**Giải thích sâu:** Hệ quả nghiêm trọng nhất là **`JSON.parse` âm thầm làm hỏng ID**:

```js
JSON.parse('{"id": 9007199254740993}').id     // -> 9007199254740992
```

Backend Java/Go trả `int64` (Twitter, Discord) là gặp ngay. Không có cảnh báo nào.

Sửa: bắt backend trả **chuỗi**, hoặc dùng reviver với `context.source` (ES2023):

```js
JSON.parse(json, (k, v, ctx) => k === 'id' ? BigInt(ctx.source) : v);
// -> 9007199254740993n
```

Kiểm runtime có `context.source` chưa:
`node -e "console.log(JSON.parse('1',(k,v,c)=>c?.source))"` → in `1` là có.

</details>

### 41. Bốn thuật toán so sánh của JavaScript?

<details><summary>Đáp án</summary>

| Thuật toán | Dùng ở | `NaN` vs `NaN` | `0` vs `-0` |
|---|---|---|---|
| Loose | `==` | false | true |
| Strict | `===`, `indexOf`, `switch` | false | true |
| SameValueZero | `includes`, `Map`, `Set` | **true** | true |
| SameValue | `Object.is` | **true** | **false** |

Đó là lý do:

```js
[NaN].includes(NaN)     // true
[NaN].indexOf(NaN)      // -1
```

Không phải bug — hai method dùng hai thuật toán khác nhau.

`-0` xuất hiện tự nhiên hơn bạn tưởng: `-1 * 0`, `Math.round(-0.2)`, `0 / -5`. Nếu nó lọt vào
key của `Map` thì `Map` coi `0` và `-0` là **một**.

</details>

### 42. Vì sao `null >= 0` là `true` nhưng `null == 0` là `false`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì `==` và `>=` chạy **hai thuật toán khác nhau**.

**Giải thích sâu:**

- `null == 0`: `==` có luật riêng cho `null` — nó chỉ `==` với `null` và `undefined`. → `false`.
- `null >= 0`: phép so sánh **quan hệ** chuyển toán hạng thành số. `Number(null) === 0`, và
  `0 >= 0` → `true`.
- `null > 0` → `false` (vì `0 > 0` sai).

Nên `null` vừa "không bằng 0" vừa "lớn hơn hoặc bằng 0". Không có cách nào làm điều đó hợp lý;
chỉ cần **không dùng `==`**.

Ngoại lệ duy nhất đáng dùng: `x == null` để bắt cả `null` và `undefined`.

</details>

### 43. `JSON.stringify` mất những gì?

<details><summary>Đáp án</summary>

| Vào | Ra |
|---|---|
| `undefined`, hàm, `Symbol` | **key biến mất** |
| `NaN`, `Infinity` | `null` |
| `Map`, `Set`, `RegExp` | `{}` — **mất sạch dữ liệu** |
| `Date` | chuỗi ISO (`JSON.parse` trả lại **chuỗi**) |
| `-0` | `0` |
| `BigInt` | **ném `TypeError`** |
| vòng lặp | **ném `TypeError`** |

Nguy hiểm nhất là `Map` → `{}`: bạn gửi đi object rỗng và **không có gì báo**.

Hai điều đáng nói thêm: `undefined` làm key biến mất nên **không phân biệt được "không gửi
field" với "gửi null"** — quan trọng khi làm PATCH API. Và `Date` chạy được là nhờ
`Date.prototype.toJSON` có sẵn; bạn định nghĩa `toJSON()` cho class của mình cũng được.

</details>

### 44. `structuredClone` khác `JSON.parse(JSON.stringify(x))` thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `structuredClone` giữ được `Date`, `Map`, `Set`, `RegExp`, `NaN`,
`undefined`, `TypedArray`, và **tham chiếu vòng**. Nó **không** clone được hàm.

**Giải thích sâu:**

```
structuredClone: Date=true Map=true Set=true RegExp=true NaN=NaN vòng lặp=true có key `u`=true
structuredClone({f(){}}) -> DOMException: f(){} could not be cloned.
```

| Cần gì | Dùng |
|---|---|
| Dữ liệu thuần có `Date`/`Map`/`Set`/vòng lặp | `structuredClone` |
| Có hàm, class, `Symbol` | tự viết / `lodash.cloneDeep` |

Nó cũng clone dữ liệu của object có prototype tuỳ chỉnh nhưng **trả về object thường** — mất class.

Điểm đáng nói: nếu state của bạn không `structuredClone` được, đó thường là dấu hiệu state đang
chứa thứ không nên nằm trong state (hàm, class instance).

</details>

### 45. `[1, 5, 10].sort()` cho gì? Còn với tên tiếng Việt?

<details><summary>Đáp án</summary>

```
[1,5,10].sort()                              -> [1, 10, 5]
['ă','a','â','b'].sort()                     -> "abâă"      ← â, ă sau cả b
['ă','a','â','b'].sort((a,b)=>a.localeCompare(b,'vi'))  -> "aăâb"   ✅
```

`sort()` không comparator chuyển mọi phần tử thành **chuỗi** rồi so mã ký tự. Với tiếng Việt, `â`
và `ă` có mã Unicode lớn hơn `b` nên chúng bị xếp sau — **danh sách tên người Việt sắp bằng
`sort()` là sai**.

Với mảng lớn dùng `Intl.Collator` để tạo bộ so sánh một lần:

```js
const cmp = new Intl.Collator('vi').compare;
ten.sort(cmp);
```

Ba điều nữa: `sort` **ổn định** từ ES2019 (V8 dùng TimSort); `sort()` **sửa mảng gốc** còn
`toSorted()` thì không; `undefined` và lỗ trống **luôn** bị đẩy xuống cuối và comparator không
được gọi cho chúng.

</details>

### 46. Comparator này sai ở đâu: `sort((a, b) => a > b)`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó trả `true`/`false`, nhưng đặc tả cần **số âm / 0 / dương**.
`Number(false) === 0`, `Number(true) === 1` — **không bao giờ âm**.

**Giải thích sâu:**

```js
[10, 9, 1, 100].sort((a, b) => a > b)     // -> [10, 9, 1, 100]  KHÔNG ĐỔI
```

TimSort không bao giờ nhận được tín hiệu "đảo chỗ" nên mảng gần như giữ nguyên. Đây là **bug im
lặng**: nó chạy, không lỗi, chỉ là không sắp xếp. Rất khó phát hiện qua review vì code trông đúng.

Sửa: `(a, b) => a - b`. Với chuỗi: `(a, b) => a.localeCompare(b)`. Với boolean:
`(a, b) => Number(a.x) - Number(b.x)`.

</details>

---

## Phần 6 — Object, descriptor, Proxy (câu 47–52)

### 47. `Object.defineProperty` mặc định khác gán thường thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `defineProperty` mặc định **`false` cả ba cờ**; gán thường thì `true` cả ba.

```
gán thường     : {"value":1,"writable":true, "enumerable":true, "configurable":true}
defineProperty : {"value":2,"writable":false,"enumerable":false,"configurable":false}
```

**Giải thích sâu:** Hệ quả: thuộc tính **đọc được** nhưng biến mất khỏi `Object.keys`,
`JSON.stringify`, `for...in`, và spread `{...o}`.

Đó là câu trả lời cho "vì sao `{...o}` mất thuộc tính". Muốn chép cả descriptor:

```js
Object.defineProperties({}, Object.getOwnPropertyDescriptors(o))
```

Đây cũng là cách duy nhất chép **getter/setter** mà không làm chúng chạy — `{...o}` gọi getter
và chép **giá trị**.

</details>

### 48. `Object.freeze` có sâu không? Nó có báo lỗi không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không sâu — chỉ **một tầng**. Và ở sloppy mode nó **im lặng**.

```js
const f = Object.freeze({ x: 1, nested: { y: 1 } });
f.x = 99; f.nested.y = 99;
console.log(f.x, f.nested.y);     // 1 99
```

Trong strict mode / ESM: `TypeError: Cannot assign to read only property 'x'`. Đó là một lý do
nữa để dùng ESM — bạn được thấy lỗi.

</details>

### 49. Thứ tự key của object được quyết định thế nào?

<details><summary>Đáp án</summary>

```js
Object.keys({ b: 1, 2: 1, a: 1, 1: 1, '01': 1 })     // -> ['1','2','b','a','01']
```

**Trả lời ngắn:** Khoá **số nguyên** trước, sắp tăng dần; rồi khoá chuỗi theo **thứ tự chèn**;
rồi `Symbol` (chỉ `Reflect.ownKeys` thấy).

**Giải thích sâu:** `'01'` **không** phải khoá số nguyên (vì `String(Number('01')) !== '01'`)
nên nó nằm ở nhóm 2, sau cả `b` và `a`.

Hệ quả thực tế:

```js
Object.keys({ 300: 'C', 100: 'A', 200: 'B' })    // -> ['100','200','300']  ← đã bị sắp lại!
```

Nên object không dùng làm "danh sách có thứ tự" được nếu key là số. Dùng `Map` — nó giữ đúng thứ
tự chèn với mọi kiểu khoá.

</details>

### 50. `Proxy` — vì sao trap phải dùng `Reflect`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì `Reflect.get(t, k, receiver)` có tham số **receiver**, nó quyết định `this`
bên trong getter.

**Giải thích sâu:**

```js
const base = { _v: 1, get v() { return this._v } };
const pr = new Proxy(base, { get(t, k, r) { return Reflect.get(t, k, r) } });
Object.create(pr, { _v: { value: 99 } }).v      // -> 99
```

Viết `return t[k]` thay vì `Reflect.get(t, k, r)` sẽ cho **1** — getter chạy với `this = base`.
Trong framework reactive, sai chỗ này nghĩa là computed đọc nhầm dữ liệu.

Quy tắc: mọi trap kết thúc bằng `Reflect.<cùng tên>(...arguments)`.

</details>

### 51. Ba chỗ `Proxy` **không** làm được?

<details><summary>Đáp án</summary>

**1. Object có internal slot** — `Map`, `Set`, `Date`, `Promise`, `TypedArray`:

```js
new Proxy(new Map([['k',1]]), {}).get('k')
// TypeError: Method Map.prototype.get called on incompatible receiver #<Map>
```

Phải bind method về target thật:

```js
get(t, k, r) { const v = Reflect.get(t, k, r); return typeof v === 'function' ? v.bind(t) : v }
```

Đây chính xác là điều Vue 3 phải làm trong `reactive()` cho collection.

**2. Không nói dối được về thuộc tính đã đóng băng:**

```js
new Proxy(Object.freeze({ x: 1 }), { get() { return 'nói dối' } }).x
// TypeError: 'get' on proxy: property 'x' is a read-only and non-configurable data property...
```

Đặc tả có **invariant**.

**3. `proxy !== target`.** Nếu bạn lưu object vào `Set` rồi chỉ có proxy trong tay,
`set.has(proxy)` là `false`. Framework reactive phải giữ `WeakMap` map hai chiều target ↔ proxy.

Còn một điều nữa đáng nói: trap `get` phải **bỏ qua `Symbol`**, nếu không `await proxy` sẽ hỏi
`proxy.then` và bạn xử lý nó như một khoá thường.

</details>

### 52. `Proxy` đắt bao nhiêu?

<details><summary>Đáp án</summary>

Đo 1 triệu lần đọc thuộc tính:

```
đọc qua getter            9.50ms
đọc thuộc tính thường     9.52ms      ← getter MIỄN PHÍ, chênh lệch trong nhiễu đo
đọc qua Proxy có trap get 40.14ms     ← đắt gấp 4.2 lần
```

**Kết luận:** dùng getter thoải mái — V8 nội tuyến nó thành phép đọc thường. `Proxy` thì dùng
cho tầng state của app (vài nghìn thao tác/giây) được, nhưng đừng bọc proxy quanh mảng 100 000
phần tử rồi duyệt trong vòng lặp render.

Đây là lý do Solid và signal-based framework chọn `.value` tường minh thay vì `Proxy`: nhanh
hơn, đổi lại cú pháp kém gọn.

</details>

---

## Phần 7 — Iterator, generator (câu 53–56)

### 53. Làm object của bạn `for...of` được — cần gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đúng một method: `[Symbol.iterator]()` trả về object có `next()`.

```js
class DanhSach {
  constructor(...items) { this.items = items }
  *[Symbol.iterator]() { yield* this.items }
}
[...d], Array.from(d), Math.max(...d)      // cả ba chạy
```

**Giải thích sâu:** Một method mở ra `for...of`, spread, destructuring, `Array.from`,
`Promise.all`, `new Set(x)`, `new Map(x)`.

Dùng generator method (`*[Symbol.iterator]()`) thì tự có `next`/`return`/`throw` đầy đủ. Viết
`return this.items[Symbol.iterator]()` thì **nhanh hơn** nhưng mất khả năng chèn logic vào giữa.

</details>

### 54. `for...of` gọi gì khi bạn `break`? Vì sao quan trọng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `iterator.return()`. Đó là chỗ để dọn dẹp — đóng file, huỷ kết nối.

**Giải thích sâu:** Nó chạy khi thoát sớm bằng `break`, `return`, **hoặc ném lỗi**. `for...in`
và `forEach` không có cơ chế này — đó cũng là lý do `forEach` không `break` được (nó không phải
vòng lặp, nó là lời gọi hàm).

Ứng dụng thật:

```js
async function* docTheoDong(p) {
  const fh = await fs.promises.open(p);
  try { for await (const l of fh.readLines()) yield l }
  finally { await fh.close() }         // ✅ chạy cả khi người gọi break
}
```

</details>

### 55. Vì sao đoạn này bỏ sót phần tử?

```js
function* nguon() { yield* [1,2,3,4,5,6] }
const g = nguon();
console.log([...g.take(2)], [...g]);
```

<details><summary>Đáp án</summary>

```
[ 1, 2 ] []
```

**Trả lời ngắn:** `take(2)` không chỉ lấy 2 phần tử — khi lấy đủ, nó gọi `return()` lên iterator
nguồn để báo "xong, dọn đi". Generator bị **đóng hẳn**.

**Giải thích sâu:** Đây là hành vi **đúng theo đặc tả**, và là điều bạn muốn khi nguồn là file
hay kết nối — `take` xong thì file được đóng.

Mọi helper "kết thúc sớm" đều làm vậy: `take`, `find`, `some`, `every`. Với mảng thì vô hại, với
iterator thì không.

Muốn đọc tiếp thì tự lấy tay:

```js
const dau = []; for (let i = 0; i < 2; i++) dau.push(g.next().value);
console.log(dau, [...g]);       // [1,2] [3,4,5,6]
```

Nói thêm: **iterator chỉ dùng được một lần** — bug thật hay gặp khi truyền iterator qua nhiều
tầng hàm.

</details>

### 56. Iterator helpers khác `array.map().filter()` ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Chúng **lười** và không tạo mảng trung gian.

```js
duLieu.map(f).filter(g).slice(0, 10);                   // 3 lượt, 2 mảng 1 triệu phần tử
duLieu.values().map(f).filter(g).take(10).toArray();    // 1 lượt, dừng khi đủ 10
```

Đo trên mảng 1 triệu, chỉ lấy 10 kết quả:

```
mảng: map().filter().slice(0,10)              18.58ms
iterator helpers: .map().filter().take(10)     0.00ms
```

Có sẵn trên **cả** Node 22 và Chrome 152.

⚠️ Nhớ `[1,2,3].map` là của **Array**, `.values().map` là của **Iterator** — hai thứ khác nhau.
Generator thì tự có sẵn: `[...nat().take(5)]`.

Còn một bẫy về generator: **thân generator không chạy cho tới `next()` đầu tiên**, nên validate
ở đầu generator không ném lỗi lúc bạn tưởng:

```js
function* xuLy(arr) { if (!Array.isArray(arr)) throw new TypeError('cần mảng'); yield* arr }
xuLy('sai');           // KHÔNG lỗi
[...xuLy('sai')];      // đến đây mới TypeError
```

</details>

---

## Phần 8 — Bộ nhớ và rò rỉ (câu 57–62)

### 57. GC của V8 hoạt động thế nào? Rò rỉ trong JS là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mark-and-sweep từ tập gốc (biến toàn cục, call stack). Object bị giữ chừng nào
còn **một đường đi tới nó từ gốc**. Rò rỉ trong JS không phải "quên giải phóng" mà là **"quên bỏ
tham chiếu"**.

**Giải thích sâu:** "Không dùng nữa" hoàn toàn không liên quan. Đó là lý do bốn kiểu rò rỉ ở câu
58–61 đều là chuyện *ai đang giữ*, không phải chuyện *cấp phát*.

Ghi điểm thêm: V8 chia heap thành *young generation* (scavenge, rất nhanh) và *old generation*
(mark-compact). Object sống qua hai lần scavenge được "thăng cấp" lên old — nên object sống lâu
đắt hơn để dọn.

</details>

### 58. `Map` và `WeakMap` khác nhau ở đâu? Đo được bao nhiêu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `Map` giữ **tham chiếu mạnh** tới khoá — khoá không bao giờ chết được.
`WeakMap` giữ **yếu** — khoá chết thì entry tự biến mất.

Đo với 200 000 mục:

```
Map 200k      : 103.9 MB
WeakMap 200k  :   7.3 MB      ← khoá không ai giữ nên bị thu hồi ngay
```

| | `Map` | `WeakMap` |
|---|---|---|
| Khoá | mọi kiểu | **chỉ object / Symbol** |
| Duyệt được, có `size` | ✅ | ❌ (cố ý — nội dung đổi theo GC) |
| Dùng cho | dữ liệu bạn sở hữu | **metadata gắn vào object của người khác** |

Mẫu chuẩn: gắn dữ liệu phụ vào DOM node hoặc instance mà không cản GC.

</details>

### 59. Detached DOM là gì? Đo nó thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Node đã `remove()` khỏi cây DOM nhưng JS còn giữ tham chiếu. Chúng **không nằm
trong heap JS** (chúng ở heap C++ của Blink) nên `getHeapUsage` gần như không thấy.

**Giải thích sâu:** Phải đếm bằng CDP `Memory.getDOMCounters`:

```
ban đầu                                 : {"nodes":6}
sau khi remove 20000 div (mảng còn giữ) : {"nodes":40006}     ← còn sống
sau khi keep = null                     : {"nodes":6}
```

Con số **40 006** = 20 000 `div` + 20 000 `span` + 6 node của trang: **giữ node cha là giữ luôn
toàn bộ cây con**. Đó là điểm nguy hiểm nhất — bạn giữ một `<div>` nhưng thứ bị giữ là cả bảng
500 dòng bên trong.

Trong DevTools: heap snapshot → lọc theo `Detached`.

Nguồn phổ biến nhất là cache DOM node (`cache[id] = document.querySelector(...)`) và
`const ds = [...querySelectorAll(...)]` rồi `innerHTML = ''`.

</details>

### 60. Listener không gỡ rò rỉ bao nhiêu? Cách chắc chắn không quên?

<details><summary>Đáp án</summary>

Đo với 50 component, mỗi cái giữ mảng 50 000 phần tử:

```
50 component KHÔNG gỡ listener: 0.74 -> 10.29 MB (+9.54)
50 component CÓ gỡ listener   : 10.29 -> 10.29 MB (+0.00)
```

Chuỗi giữ: `window` → danh sách listener → hàm handler → closure giữ `this` → **cả instance**.
Component "đã bị huỷ" nhưng `window` sống suốt phiên.

**Cách chắc chắn nhất — một `AbortController` cho cả component:**

```js
const ac = new AbortController();
window.addEventListener('resize', h, { signal: ac.signal });
document.addEventListener('keydown', k, { signal: ac.signal });
ac.abort();                      // gỡ CẢ HAI, không thể quên cái nào
```

Ba lý do `removeEventListener` thất bại (nên nêu ra):

```js
el.removeEventListener('click', this.f.bind(this));   // ❌ hàm mới, khác hàm đã gắn
el.removeEventListener('click', () => this.f());      // ❌ hàm mới
el.removeEventListener('click', f);                    // ❌ nếu gắn với { capture: true }
```

Cái thứ ba ít người biết: **`capture` là phần của danh tính listener**. Đo thật: gỡ không có
`capture` → handler vẫn chạy 1 lần; gỡ có `capture` → 0 lần.

</details>

### 61. `WeakRef` và `FinalizationRegistry` dùng để làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `WeakRef` giữ tham chiếu yếu tới **một** object. `FinalizationRegistry` gọi
callback khi object bị thu hồi — nhưng **không được bảo đảm chạy**, nên chỉ dùng để thống kê.

**Giải thích sâu:** Đo thật:

```
1 còn tham chiếu mạnh: wr.deref() = X         | heap 10.9
2 sau khi bỏ + gc    : wr.deref() = undefined | heap 3.5
  [reg] đã thu hồi: obj-X            ← in ra SAU dòng 2, ở nhịp không xác định
3 hết chương trình.
```

Và nếu bỏ dòng chờ 300 ms cuối cùng thì callback **không in ra gì** — tiến trình kết thúc trước
khi nó được gọi.

**Vì vậy: đừng dùng `FinalizationRegistry` để giải phóng tài nguyên** (đóng file, nhả kết nối,
nhả khoá). Dùng `try/finally`, hoặc `using` + `Symbol.dispose` khi runtime hỗ trợ.

Bẫy của `WeakRef`: giữa hai lần `deref()` trong cùng microtask giá trị không đổi (đặc tả bảo
đảm), nhưng qua nhịp khác thì có thể mất. Luôn `const o = wr.deref(); if (!o) return;` **một
lần**, rồi dùng biến cục bộ.

</details>

### 62. Quy trình tìm rò rỉ bộ nhớ?

<details><summary>Đáp án</summary>

**1. Xác nhận nó có thật.** Lặp thao tác 10 lần, đo trước/sau. Tăng đều mà không bao giờ về là
rò rỉ; tăng rồi về là bình thường.

**2. Chụp 3 snapshot:** snapshot 1 → thao tác → snapshot 2 → thao tác lại → snapshot 3.

**3. So sánh** snapshot 3 với 1 ở chế độ **Comparison**, sắp theo `# Delta`. Thứ tăng đều qua
cả hai lần là nghi phạm.

**4. Xem `Retainers`** — đọc **từ dưới lên**, đó là đường từ gốc GC tới object.

**5. Nhận diện theo từ khoá:** `context` = closure · `Detached HTMLxxx` = detached DOM ·
`Window`/`EventListener` = listener · `Map` ở module scope = cache · `Timeout` = `setInterval`.

**6. Trong Node** nếu không tiện mở DevTools:

```js
require('v8').writeHeapSnapshot('/tmp/1.heapsnapshot');
```

Rồi kéo file vào tab Memory của Chrome DevTools — nó đọc được snapshot của Node.

Đo bộ nhớ cho đúng: Node cần `--expose-gc` + `global.gc()` trước mỗi lần đọc. Chrome thì
`performance.memory` **vô dụng** (làm tròn quá thô — 20 000 node vẫn ra đúng 9.5 MB), phải dùng
CDP `Runtime.getHeapUsage`.

</details>

---

## Phần 9 — Module (câu 63–66)

### 63. ESM và CJS khác nhau ở đâu, sâu nhất?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** CJS phân tích phụ thuộc **lúc chạy** (`require` là lời gọi hàm); ESM **lúc biên
dịch**. Mọi khác biệt khác đều từ đó.

| | CJS | ESM |
|---|---|---|
| `export` là | thuộc tính (bản chụp) | **binding** (live) |
| Vòng lặp import | object **thiếu một nửa**, im lặng | `ReferenceError` — ồn ào |
| Tree-shaking | rất khó | được |
| Top-level await | không | có |

**Live binding** là khác biệt dễ demo nhất:

```
ESM: export let count = 0; ... inc(); inc();  ->  count = 2
CJS: module.exports = { count, inc };  ...    ->  m.count = 0     ← đứng im
```

Trong CJS, `module.exports = { count }` **chép giá trị** `0`. Đó là nguyên nhân thật của bug
"config không cập nhật", "biến cờ luôn là giá trị khởi tạo". Sửa: export getter.

</details>

### 64. Vòng lặp import — CJS và ESM xử lý khác nhau thế nào?

<details><summary>Đáp án</summary>

**ESM ném lỗi rõ ràng:**

```
ReferenceError: Cannot access 'x' before initialization
    at file:///.../y.js:3:30
```

ESM dựng xong đồ thị trước rồi chạy thân module sâu-trước; module chạy trước đọc binding chưa
khởi tạo → TDZ. **Ồn ào, dễ tìm — đó là điểm tốt.**

**CJS trả về object thiếu một nửa, im lặng:**

```
cy thấy cx = {"x":"X"} <- thiếu xx
(node:78748) Warning: Accessing non-existent property 'toJSON' of module exports
inside circular dependency
```

Không lỗi. Nếu `cy` gọi `m.xx()` thì mới nổ `TypeError: m.xx is not a function`, ở chỗ hoàn toàn
không liên quan.

Cảnh báo `... inside circular dependency` là dấu hiệu **duy nhất** bạn nhận được — thấy nó thì
đi tìm vòng lặp ngay.

Điều đáng nói thêm: vòng lặp import **không tự động là lỗi**. Nếu hai module chỉ dùng nhau **bên
trong hàm** thì nó chạy bình thường, vì lúc hàm được gọi cả hai đã nạp xong. Nó chỉ nổ khi bạn
dùng giá trị **ở top level** (ví dụ `class A extends BTuModuleKia`).

</details>

### 65. Tree-shaking cần điều kiện gì? Vì sao nó thường không chạy?

<details><summary>Đáp án</summary>

**Ba điều kiện:** module là ESM · không có side effect ở top level (hoặc khai `sideEffects` đúng)
· bundler chứng minh được việc xoá là an toàn.

**Điều kiện 2 hay vỡ nhất.** Ba mẫu bạn viết mà không biết:

```js
Array.prototype.last = function () {...};      // 1. sửa prototype builtin ở top level
export const client = new ApiClient();         // 2. tạo instance ở top level
export * from './moi-thu';                     // 3. re-export cả gói
```

Sửa mẫu 2: `let _c; export const getClient = () => (_c ??= new ApiClient())`.

⚠️ Bẫy ngược: khai `"sideEffects": false` khi gói **có** side effect (import CSS, polyfill tự
đăng ký) làm bundler **xoá mất chúng**. Đây là bug chỉ xuất hiện sau khi build production, không
thấy ở dev. Khai cụ thể thì an toàn: `"sideEffects": ["./dist/polyfill.js", "*.css"]`.

Kiểm chứng không cần dựng bundler: `npx agadoo ./dist/index.mjs` — nó chỉ rõ dòng nào gây side effect.

</details>

### 66. Vì sao `if (typeof Symbol.dispose !== 'undefined') { using x = ... }` không chạy được?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** File nổ ngay lúc **parse**, trước khi câu `if` được đánh giá. `Symbol.dispose`
là **API** (dò được), `using` là **cú pháp** (không dò được lúc chạy).

**Giải thích sâu:**

```
$ node -e "console.log(typeof Symbol.dispose)"
symbol                                        ← tưởng là dùng được

$ node -e "{ using r = { [Symbol.dispose](){} }; }"
SyntaxError: Unexpected identifier 'r'
```

Dò cú pháp phải compile thử:

```js
const coCuPhap = src => { try { new Function(src); return true } catch { return false } };
```

```
(Node 22)     using: false   decorator: false
(Chrome 152)  using: true    decorator: false
```

Ba cách xử lý: viết cú pháp cũ (`try/finally`) · để TypeScript/Babel biên dịch · tách hai
**file** rồi `await import()` bản phù hợp (mỗi file được parse độc lập).

Nói thêm để ghi điểm: **decorator không chạy ở đâu cả** — kể cả Chrome 152. Nếu bạn từng thấy
`@Injectable()` chạy, đó là TypeScript biên dịch nó đi.

</details>

---

## Phần 10 — DOM và browser (câu 67–70)

### 67. Sự kiện lan truyền qua mấy pha? `stopPropagation` chặn được gì?

<details><summary>Đáp án</summary>

**Ba pha:** capture (`window` → xuống) → target → bubble (lên).

| Method | Chặn gì |
|---|---|
| `stopPropagation()` | các element **khác** trên đường đi |
| `stopImmediatePropagation()` | element khác **và** handler còn lại trên **cùng** element |
| `preventDefault()` | hành vi mặc định — **không** liên quan tới lan truyền |

Đo thật: `stopPropagation()` trong handler 1 vẫn để handler 2 trên **cùng** element chạy.

Bốn sự kiện **không bubble**: `focus`, `blur`, `mouseenter`, `mouseleave`. Dùng
`focusin`/`focusout`, `mouseover`/`mouseout` nếu cần bản có bubble.

Và `return false` chỉ có tác dụng trong handler kiểu `onclick=`, **không** với `addEventListener`.

</details>

### 68. Event delegation — `target` vs `currentTarget`, và vì sao dùng `closest`?

<details><summary>Đáp án</summary>

- **`e.target`** — element bị click thật sự (sâu nhất)
- **`e.currentTarget`** — element handler đang gắn trên (bằng `this` nếu handler là `function`)

```
e.target = LI#2 | e.currentTarget = UL | this = UL | closest('li') = 2
```

**Vì sao `closest`:** nếu `<li>` chứa `<span>Xoá</span>`, click vào chữ cho `e.target` là `SPAN`.
`e.target.closest('li')` đi ngược lên tìm `<li>` gần nhất.

⚠️ **`e.currentTarget` là `null` sau `await`** — lưu `const el = e.currentTarget` trước.

Lợi ích của delegation ngoài hiệu năng (10 000 listener: 3.30 ms vs 0.000 ms): nó **tự động hoạt
động với item mới thêm vào**, và nó không bị `innerHTML = ...` phá mất.

</details>

### 69. Thêm 5000 node — bốn cách, cách nào nhanh nhất?

<details><summary>Đáp án</summary>

```
gom chuỗi rồi gán innerHTML 1 lần    1.9ms
append trực tiếp DOM                 3.4ms
DocumentFragment                     5.5ms      ← KHÔNG nhanh hơn
innerHTML += trong vòng lặp       7366.4ms      ← 3877× chậm hơn
```

**`innerHTML +=` chậm 3877 lần** vì mỗi vòng nó: serialize toàn bộ cây con → nối chuỗi → **xoá
sạch node con** → parse lại từ đầu. Đó là O(n²). Và bước "xoá sạch" **phá mọi listener, trạng
thái `<input>`, vị trí con trỏ, `<video>` đang phát**.

**`DocumentFragment` chậm hơn `append` trực tiếp** — lời khuyên "luôn dùng fragment" đúng khoảng
2010, khi trình duyệt tính layout lại sau mỗi lần chèn. Chrome hiện đại gom thay đổi lại.

Chọn: cần dựng HTML từ dữ liệu và không cần giữ state cũ → gom chuỗi + `innerHTML` (nhớ escape,
XSS). Cần giữ listener/state của node cũ → `append`. Không bao giờ `innerHTML +=`.

</details>

### 70. Layout thrashing là gì? Đo được bao nhiêu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đọc và ghi thuộc tính layout **xen kẽ** trong vòng lặp, ép trình duyệt tính
lại layout mỗi vòng.

```
xen kẽ đọc-ghi        635.30ms
đọc hết rồi ghi hết     1.20ms      ← 529× nhanh hơn
```

**Cơ chế:** trình duyệt xếp thay đổi style vào hàng đợi. Nhưng khi bạn **đọc** thuộc tính layout,
nó buộc phải tính **ngay** để trả số đúng — *forced synchronous layout*.

Danh sách thuộc tính ép tính: `offsetTop/Left/Width/Height` · `scrollTop/Left/Width/Height` ·
`clientXxx` · `getBoundingClientRect()` · `getComputedStyle()` · `focus()` · `scrollIntoView()` ·
`offsetParent`.

Sửa: tách hai pha (đọc hết → ghi hết), hoặc đọc trong `requestAnimationFrame` và ghi ở lần kế
tiếp. Tốt nhất là dùng `ResizeObserver`/`IntersectionObserver` — chúng cung cấp số đo **đã tính
sẵn**, không ép tính lại.

Câu hỏi tốt hơn nữa: **có cần JavaScript không?** Rất nhiều phép "đo rồi đặt style" thay được
bằng CSS (`place-items: center`, `clamp()`, container query) — 0 ms và tự đúng khi kích thước đổi.

</details>

---

## Phần 11 — Node runtime (câu 71–72)

### 71. "Node một luồng" — chính xác thì sao? Một dòng `Sync` tệ đến mức nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Node chạy **JavaScript của bạn** trên một luồng, nhưng libuv có thread pool
(mặc định 4) cho `fs`, `dns.lookup`, `crypto.pbkdf2`, `zlib`. Mạng thì **không** dùng thread
pool — nó dùng `kqueue`/`epoll` của hệ điều hành.

**Giải thích sâu:** Đo thật với file 191 MB, 20 lần:

```
20x readFileSync         : độ trễ event loop 795 ms
20x fs.promises.readFile : độ trễ event loop  40 ms
```

795 ms là thời gian **mọi request khác bị treo** — server không trả lời được ai.

Các hàm `Sync` hay bị dùng nhầm: `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`,
`pbkdf2Sync`, `gzipSync`, `execSync`. Chúng **hoàn toàn ổn** lúc khởi động, trước khi nhận
request; sai khi ở trong handler.

`JSON.parse` là ca đặc biệt: **không có bản async**. Parse 50 MB chặn vài trăm ms và không tránh
được trên luồng chính → `worker_threads` (độ trễ 246 ms → **2 ms**) hoặc parse theo stream.

`UV_THREADPOOL_SIZE=16` đổi được kích thước pool, nhưng chỉ **trước khi** tiến trình chạy.

</details>

### 72. Vì sao không bao giờ dùng `.pipe()`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `.pipe()` chỉ chuyển **dữ liệu**, không chuyển **lỗi**, và không huỷ stream còn
lại.

**Giải thích sâu:** Đã gắn handler cho đích, nguồn vẫn giết tiến trình:

```js
dich.on('error', e => console.log('đích nhận error:', e.message));   // đã gắn
nguon.pipe(dich);
```

```
      throw er; // Unhandled 'error' event
Error: nguồn nổ
                          ← tiến trình BỊ GIẾT
```

Và tệ hơn: nếu bạn **có** gắn `nguon.on('error')` thì tiến trình sống, nhưng `dich` **không bao
giờ được đóng** — file descriptor hoặc kết nối rò rỉ, mỗi request một cái.

```js
try { await pipeline(nguon, dich) } catch (e) { console.log(e.message) }
// pipeline ném: Error: nguồn nổ
// đích đã đóng? true
```

`pipeline` làm ba việc `pipe` không làm: chuyển lỗi ra ngoài, **huỷ mọi stream trong chuỗi**, và
(bản `promises`) cho bạn `await`. Nó còn nhận `{ signal }` để huỷ được.

Ứng dụng ngay: endpoint tải file dùng `.pipe(res)` sẽ **crash khi client đóng tab** (ghi vào
socket đã đóng → `EPIPE` không ai nghe). Lỗi
`ERR_STREAM_PREMATURE_CLOSE` bạn thấy nhiều trong log production gần như luôn là "người dùng
đóng tab", không phải bug — nên lọc nó ra khỏi alert.

</details>

---

## Xong 72 câu

Tự chấm bằng [checklist 109 mục](./04-tu-kiem-tra.md). Nếu có câu bạn không nói được **một con số
đo được** hoặc **một hệ quả cụ thể**, quay lại bài giáo trình tương ứng — bảng tra ở
[README](./README.md).

Tiếp: [22 bài gõ tay](./02-bai-tap-thuc-hanh.md) · [12 tình huống debug](./03-tinh-huong-debug.md)
