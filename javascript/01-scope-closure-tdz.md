# Bài 01 — Scope, closure, TDZ

> Bài này giải thích một con số: vì sao giữ lại **một hàm trả về số 1** lại làm chương trình
> tốn **152 MB**. Nếu bạn chỉ đọc một mục trong bài, đọc mục 5.

---

## 1. Ba loại khai báo, ba hành vi khác nhau

```js
function tdz() {
  try { console.log(x); } catch (e) { console.log('A:', e.constructor.name + ': ' + e.message); }
  let x = 1;
}
tdz();

console.log('B typeof biến chưa khai báo:', typeof yy);

function C() { try { console.log(typeof zz); let zz = 1; } catch (e) { console.log('C:', e.constructor.name + ': ' + e.message); } }
C();

console.log('D var hoisted:', (function () { console.log('  trước:', v); var v = 1; return v; })());
```

```
A: ReferenceError: Cannot access 'x' before initialization
B typeof biến chưa khai báo: undefined
C: ReferenceError: Cannot access 'zz' before initialization
  trước: undefined
D var hoisted: 1
```

Đọc kỹ **B và C**. Cùng là `typeof`, hai kết quả trái ngược:

| Trường hợp | `typeof` cho ra |
|---|---|
| Biến **hoàn toàn không tồn tại** | `"undefined"` — không ném lỗi |
| Biến `let`/`const` **đã khai báo nhưng chưa tới dòng khai báo** | **ném `ReferenceError`** |

Người ta hay dạy "`typeof` luôn an toàn, dùng nó để kiểm tra biến tồn tại". Sai từ ES2015.
`typeof` an toàn với biến chưa từng khai báo, nhưng ném lỗi với biến đang trong **TDZ**
(Temporal Dead Zone — vùng chết tạm thời).

### TDZ là gì, cụ thể

`let`/`const` **có** được hoisted lên đầu block — nếu không, dòng `console.log(x)` trong hàm
`tdz()` đã phải nhìn thấy biến `x` ở scope ngoài. Nhưng V8 đánh dấu ô nhớ đó là "chưa khởi
tạo", và mọi lần đọc trước khi tới dòng `let x = 1` đều ném lỗi.

Chứng minh bằng cách đặt một biến `x` ở scope ngoài:

```js
let x = 'NGOÀI';
function f() {
  console.log(x);     // nếu let KHÔNG hoisted, dòng này in "NGOÀI"
  let x = 'TRONG';
}
f();
```

```
ReferenceError: Cannot access 'x' before initialization
```

Nó không in `"NGOÀI"` → biến `x` bên trong **đã tồn tại** ngay từ đầu hàm và che mất biến
ngoài. Đó là TDZ.

---

## 2. `var` trong vòng lặp — bẫy kinh điển, nhưng hiểu cho đúng lý do

```js
var fs1 = []; for (var i = 0; i < 3; i++) fs1.push(() => i);
let fs2 = []; for (let j = 0; j < 3; j++) fs2.push(() => j);
console.log('var:', fs1.map(f => f()), 'let:', fs2.map(f => f()));
```

```
var: [ 3, 3, 3 ] let: [ 0, 1, 2 ]
```

Giải thích thường gặp là "`let` có block scope". Đúng nhưng chưa đủ — nếu chỉ là block scope
thì cả 3 closure vẫn có thể trỏ chung một ô nhớ.

Sự thật: với `let`, đặc tả yêu cầu **mỗi vòng lặp tạo một binding mới**, và giá trị của vòng
trước được **sao chép** sang vòng sau trước khi chạy phần `i++`. Ba closure giữ ba ô nhớ
khác nhau.

Với `var` chỉ có **một** ô nhớ duy nhất trong toàn hàm. Ba closure cùng trỏ vào nó, và sau
khi vòng lặp kết thúc ô đó chứa `3`.

Kiểm chứng "mỗi vòng một ô nhớ" bằng cách sửa biến từ trong closure:

```js
const fs = [];
for (let k = 0; k < 3; k++) fs.push(() => ++k);
console.log(fs[0](), fs[0](), fs[0](), fs[1]());
```

```
1 2 3 2
```

Đọc từng con số:

- `fs[0]` gọi ba lần cho `1 2 3` — nó có ô nhớ **riêng**, đếm lên độc lập.
- `fs[1]` gọi lần đầu cho `2`, **không phải 1**. Ô nhớ của nó được khởi tạo bằng bản sao giá
  trị `k` ở cuối vòng lặp thứ nhất, tức là `1`; `++k` cho `2`.

Nếu ba closure dùng chung một ô (như trường hợp `var`), kết quả phải là `1 2 3 4`. Nếu mỗi ô
độc lập nhưng đều bắt đầu từ 0, kết quả phải là `1 2 3 1`. Kết quả thật `1 2 3 2` chứng minh
đúng cả hai điều: **ô riêng**, và **giá trị được chép sang từ vòng trước**.

## 3. Closure là gì, nói cho đúng

Closure = hàm + **tham chiếu tới environment record** (bảng biến) của scope nơi nó được tạo.

Chữ then chốt là **environment record**, không phải "các biến nó dùng". Cả bài này xoay
quanh khác biệt đó.

---

## 4. V8 có thông minh: biến không ai dùng thì không giữ

```js
function taoA() { const big = new Array(1e6).fill(0); const small = 1; return () => small; }

global.gc(); const b0 = mb();
let arr = []; for (let i = 0; i < 20; i++) arr.push(taoA());
global.gc();
console.log('20 closure KHÔNG dùng `big`:', b0, '->', mb(), 'MB');
```

```
20 closure KHÔNG dùng `big`: 3.16 -> 3.16 MB
```

**Không tăng một byte nào.** V8 phân tích lúc biên dịch: closure chỉ nhắc tới `small`, nên
`big` không được đưa vào context object và bị dọn ngay khi `taoA()` trả về.

Nếu closure có dùng thì khác hẳn:

```js
function taoB() { const big = new Array(1e6).fill(0); const small = 1; return () => big.length; }
```

```
20 closure CÓ dùng `big`  : 3.34 -> 155.94 MB
```

20 mảng × 1 triệu số × 8 byte ≈ 152 MB. Hợp lý, và **đúng như mong đợi** — bạn giữ dữ liệu
thì dữ liệu tốn chỗ.

---

## 5. ⚠️ Cái bẫy: hai closure dùng chung một environment record

Đây là mục quan trọng nhất bài.

```js
function bay() {
  const big = new Array(1e6).fill(0);
  return {
    nho: () => 1,                 // không đụng tới `big`
    to:  () => big.length,        // có đụng tới `big`
  };
}

// Chỉ giữ lại hàm `nho`. Hàm `to` bị vứt đi ngay.
let chiGiuNho = [];
for (let i = 0; i < 20; i++) chiGiuNho.push(bay().nho);
global.gc();
console.log('chỉ giữ hàm `nho`:', b2, '->', mb(), 'MB');
console.log('gọi thử:', chiGiuNho[0]());
```

```
chỉ giữ hàm `nho` nhưng chung scope với `to`: 3.34 -> 155.94 MB
gọi thử: 1
```

**152 MB**, y hệt trường hợp giữ cả `big`. Nhưng thứ bạn giữ là 20 hàm, mỗi hàm chỉ làm đúng
một việc: trả về số `1`.

### Vì sao

`nho` và `to` được tạo trong **cùng một** lần gọi `bay()`, nên chúng chia sẻ **một**
environment record. Record đó phải chứa `big` vì `to` cần. Chừng nào `nho` còn sống, record
còn sống, `big` còn sống — bất kể `to` đã bị vứt từ lâu.

So sánh trực tiếp:

| Tình huống | Bộ nhớ |
|---|---|
| 20 closure không hàm nào dùng `big` | 3.16 MB |
| 20 closure có dùng `big` | 155.94 MB |
| 20 closure **không dùng** `big`, nhưng **anh em** của nó có dùng | **155.94 MB** |

### Nó xuất hiện ở đâu trong code thật

Mẫu này rất phổ biến trong factory / composable / custom hook:

```js
function taoBangDuLieu(rowsThoTuAPI) {      // rowsThoTuAPI có thể là 50 MB
  const rowsDaXuLy = xuLy(rowsThoTuAPI);

  return {
    render: () => rowsDaXuLy.map(...),      // cần rowsDaXuLy
    demSoDong: () => rowsDaXuLy.length,     // cần rowsDaXuLy
    layTieuDe: () => rowsThoTuAPI[0].keys,  // ⚠ giữ luôn cả 50 MB dữ liệu thô
  };
}

// Ở nơi khác trong app, chỉ dùng đúng một hàm:
const tieuDe = taoBangDuLieu(res.data).layTieuDe;   // giữ nguyên 50 MB
```

### Cách sửa

**Cách 1 — tách scope.** Đưa phần nặng vào một hàm riêng, chỉ trả ra đúng thứ cần:

```js
function taoLayTieuDe(rowsTho) {
  const tieuDe = rowsTho[0].keys;     // rút ra ngay
  return () => tieuDe;                 // closure chỉ giữ `tieuDe`
}
```

**Cách 2 — chủ động xoá tham chiếu** khi biết không cần nữa:

```js
function bay() {
  let big = new Array(1e6).fill(0);
  const kq = tinhToan(big);
  big = null;                          // cắt tham chiếu trong environment record
  return { nho: () => 1, to: () => kq };
}
```

Kiểm chứng cách 2:

```
20 closure với `big = null` sau khi dùng xong: 3.23 -> 3.23 MB
```

Không tăng một byte. Chỉ nhờ một dòng `big = null`.

---

## 6. Ba scope, và cái thứ tư ít người biết

```js
const g = 'global';
function ngoai() {
  const a = 'hàm ngoài';
  { const b = 'block'; 
    return () => [g, a, b].join(' / ');
  }
}
console.log(ngoai()());
```

```
global / hàm ngoài / block
```

Chuỗi tra cứu: block → hàm → module → global. **Cái thứ tư** là scope của module: biến khai
báo ở top level của một file **không** vào `globalThis`, kể cả với `var`.

```js
// z3.mjs và z3.cjs — nội dung y hệt nhau
var gx = 1;
console.log('globalThis.gx =', globalThis.gx);
```

```
$ node z3.mjs
globalThis.gx = undefined

$ node z3.cjs
globalThis.gx = undefined
```

Hai lý do khác nhau cho cùng một kết quả: ESM có scope module theo đặc tả, còn CJS thì Node
bọc file bạn trong một hàm `(function (exports, require, module, __filename, __dirname) {...})`
nên `var` chỉ là biến cục bộ của hàm đó.

Chỗ duy nhất `var` còn chui được vào `globalThis` là `<script>` cổ điển trong trình duyệt:

```html
<script>var a = 1</script>
<script type="module">var b = 1</script>
```

```
<script> var a            -> globalThis.a = 1
<script type=module> var b -> globalThis.b = undefined
```

Hệ quả thực tế: chuyển một file `<script>` cũ sang `type="module"` sẽ làm mọi biến toàn cục
mà file khác đang dựa vào biến mất — một trong những lỗi khó hiểu nhất khi hiện đại hoá code cũ.

## 7. IIFE ngày nay còn dùng để làm gì

Trước 2015, IIFE là cách duy nhất tạo scope riêng. Bây giờ block `{ }` với `let` làm được
việc đó. IIFE còn đúng **một** công dụng không thay thế được: chạy `await` ở nơi không cho
phép top-level await.

```js
// file .cjs — không có top-level await
(async () => {
  const data = await fetch('...');
})();
```

Kể cả vậy, trong ESM bạn có top-level await luôn:

```
$ node --input-type=module -e "const r = await Promise.resolve('chạy được'); console.log(r)"
chạy được
```

---

## 8. Bài tập

### Bài 1 — Dự đoán rồi chạy

```js
console.log(a);
console.log(b);
var a = 1;
let b = 2;
```

Dòng nào in ra gì, dòng nào ném lỗi, và lỗi tên là gì?

<details><summary>Gợi ý đáp án</summary>

`console.log(a)` in `undefined` — `var` được hoisted **và** khởi tạo sẵn bằng `undefined`.

`console.log(b)` **không bao giờ chạy tới**, vì chương trình đã dừng ở dòng trước? Không —
dòng trước chạy bình thường. Dòng `console.log(b)` mới ném:

```
undefined
ReferenceError: Cannot access 'b' before initialization
```

Điểm cần nhớ: hai dòng nhìn giống hệt nhau, hành vi khác nhau hoàn toàn, chỉ vì `var` với
`let`.

</details>

### Bài 2 — Sửa rò rỉ

Đoạn dưới giữ 40 MB dù chỉ cần đúng một con số. Sửa lại.

```js
function taoBoDem(duLieuLon) {         // duLieuLon: mảng 5 triệu phần tử
  let dem = 0;
  return {
    tang:  () => ++dem,
    tongDuLieu: () => duLieuLon.reduce((a, b) => a + b, 0),
  };
}
const bo = taoBoDem(mangKhungLo).tang;   // chỉ dùng `tang`
```

<details><summary>Gợi ý đáp án</summary>

`tang` và `tongDuLieu` chung environment record chứa `duLieuLon`. Giữ `tang` là giữ luôn
mảng.

Cách sửa gọn nhất — tách hẳn hai hàm ra hai scope:

```js
function taoBoDem() {                    // không nhận dữ liệu lớn nữa
  let dem = 0;
  return () => ++dem;
}
function taoTinhTong(duLieuLon) {
  return () => duLieuLon.reduce((a, b) => a + b, 0);
}
```

Đo lại:

Đo thật, mỗi phương án chạy trong một tiến trình riêng cho sạch (10 bộ đếm, mỗi bộ kèm một
mảng 5 triệu phần tử):

```
$ node --expose-gc bai2.js truoc
truoc  3.2 -> 384.6 MB  | gọi thử: 1

$ node --expose-gc bai2.js sau
sau    3.2 -> 3.2 MB    | gọi thử: 1
```

384.6 MB xuống 3.2 MB. Lưu ý khi tự đo: phải bọc vòng lặp trong một hàm rồi mới đo. Nếu để
vòng lặp ngay ở top level, V8 vẫn giữ mảng của **lần lặp cuối** và bạn đọc ra 41.3 MB thay vì
3.2 MB — tưởng là chưa sửa được.

Nếu bắt buộc phải giữ nguyên hình dạng API (trả về object có 2 method), dùng cách `null`:

```js
function taoBoDem(duLieuLon) {
  let dem = 0;
  const tong = duLieuLon.reduce((a, b) => a + b, 0);   // tính trước
  duLieuLon = null;                                     // rồi cắt
  return { tang: () => ++dem, tongDuLieu: () => tong };
}
```

Đánh đổi: tính ngay lúc tạo thay vì tính lười. Phải cân nhắc, không phải lúc nào cũng đáng.

</details>

### Bài 3 — Vòng lặp và `setTimeout`

Đoạn này in gì, và làm sao để nó in `0 1 2` mà **không** đổi `var` thành `let`?

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);
```

<details><summary>Gợi ý đáp án</summary>

In `3 3 3`.

Ba cách không dùng `let`:

```js
// 1. IIFE tạo scope mới mỗi vòng
for (var i = 0; i < 3; i++) (j => setTimeout(() => console.log(j), 0))(i);

// 2. Dùng tham số thứ 3 của setTimeout — nó truyền thẳng vào callback
for (var i = 0; i < 3; i++) setTimeout(console.log, 0, i);

// 3. bind đóng băng tham số
for (var i = 0; i < 3; i++) setTimeout(console.log.bind(null, i), 0);
```

Cả ba đều in `0 1 2`. Cách 2 ít người biết nhất nhưng gọn nhất, và nó cũng tránh tạo thêm
closure — trong vòng lặp lớn thì đó là khác biệt đo được.

</details>

---

**Tiếp theo:** [Bài 02 — `this` và prototype](./02-this-va-prototype.md)
