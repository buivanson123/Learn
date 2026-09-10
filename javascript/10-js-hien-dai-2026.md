# Bài 10 — JavaScript hiện đại 2026

> Bài này không liệt kê "tính năng mới hay". Nó trả lời một câu hỏi thực dụng: **cái gì thật
> sự chạy được, ở đâu, trên máy bạn.** Mọi ô trong bảng đều được chạy thử, không lấy từ
> caniuse.

---

## 1. Bảng đo thật: Node 22.23 (V8 12.4) vs Chrome 152

```
$ node do/kiem-tinh-nang.mjs          # kiểm trong Node
$ node do/kiem-tinh-nang-chrome.js    # kiểm trong Chrome 152
```

| Tính năng | Node 22.23 | Chrome 152 |
|---|---|---|
| `Object.groupBy` / `Map.groupBy` | ✅ | ✅ |
| `Array.prototype.toSorted` / `.with` / `.at` | ✅ | ✅ |
| `Array.fromAsync` | ✅ | ✅ |
| `Object.hasOwn` | ✅ | ✅ |
| `structuredClone` | ✅ | ✅ |
| `Promise.withResolvers` | ✅ | ✅ |
| Iterator helpers (`.map`, `.take`, `.toArray`) | ✅ | ✅ |
| `Set.prototype.union` / `.intersection` | ✅ | ✅ |
| `Error` `cause` | ✅ | ✅ |
| RegExp cờ `v` | ✅ | ✅ |
| `AbortSignal.timeout` / `.any` | ✅ | ✅ |
| `WeakRef` / `FinalizationRegistry` | ✅ | ✅ |
| `import.meta.dirname` | ✅ | — |
| **`Temporal`** | ❌ | ✅ |
| **`Promise.try`** | ❌ | ✅ |
| **`RegExp.escape`** | ❌ | ✅ |
| **`Uint8Array.fromBase64` / `.toBase64`** | ❌ | ✅ |
| **`Error.isError`** | ❌ | ✅ |
| **`Float16Array`** | ❌ | ✅ |
| **`Atomics.pause`** | ❌ | ✅ |
| **cú pháp `using`** | ❌ `SyntaxError` | ✅ |
| `Symbol.dispose` (chỉ symbol) | ✅ | ✅ |
| **decorator (`@log`)** | ❌ `SyntaxError` | ❌ `SyntaxError` |
| `scheduler.yield` | ❌ | ✅ |
| Popover API / View Transition / URLPattern | — | ✅ |

Sáu dòng in đậm là **khoảng cách thật** giữa hai runtime bạn dùng hằng ngày. Chúng là lý do
code chạy tốt trong trình duyệt lại nổ ở SSR.

---

## 2. ⚠ Hai cái bẫy khi kiểm tra tính năng

### Bẫy 1 — `typeof` không phát hiện được tính năng **cú pháp**

```
$ node -e "console.log(typeof Symbol.dispose)"
symbol                                        ← tưởng là dùng được

$ node -e "{ using r = { [Symbol.dispose](){} }; }"
SyntaxError: Unexpected identifier 'r'        ← thực tế không parse nổi
```

`Symbol.dispose` **tồn tại** trên Node 22 vì nó chỉ là một symbol. Nhưng từ khoá `using` là
**cú pháp**, và V8 12.4 chưa parse được. Mọi đoạn code kiểu
`if (Symbol.dispose) { /* dùng using */ }` đều sai — file sẽ nổ ngay khi được **parse**, trước
khi câu `if` kịp chạy.

Tính năng cú pháp phải kiểm bằng cách compile thử:

```js
const coCuPhap = (src) => { try { new Function(src); return true } catch { return false } };

console.log('using   :', coCuPhap('{ using r = { [Symbol.dispose](){} }; }'));
console.log('decorator:', coCuPhap('class C { @x m(){} }'));
```

```
(Node 22)     using: false   decorator: false
(Chrome 152)  using: true    decorator: false
```

### Bẫy 2 — decorator "chạy được" là nhờ công cụ, không nhờ runtime

```
Node 22    : SyntaxError: Invalid or unexpected token
Chrome 152 : SyntaxError: Invalid or unexpected token
```

Nếu bạn từng thấy `@Injectable()` hay `@Component` chạy, đó là TypeScript/Babel **biên dịch nó
đi** trước khi runtime thấy. Không có runtime JavaScript nào hỗ trợ decorator vào lúc này.

---

## 3. `Temporal` — thay thế `Date`, và vì sao nó cần thiết

`Date` có một lỗi thiết kế cụ thể, đo được:

```js
// Cộng 1 tháng vào ngày 31/01
const d = new Date('2026-01-31T00:00:00');
d.setMonth(d.getMonth() + 1);
console.log(d.toISOString().slice(0, 10));

// Temporal, cùng phép tính
Temporal.PlainDate.from('2026-01-31').add({ months: 1 }).toString();
```

```
Date cũ  : 2026-03-02      ← tràn sang tháng 3!
Temporal : 2026-02-28      ← kẹp về ngày cuối tháng 2
```

`Date` cộng tháng thành `2026-02-31`, thấy không tồn tại nên **tràn** sang 2/3. Đây không phải
bug của V8 — đó là hành vi đặc tả của `Date`, và nó là nguồn của lỗi "hoá đơn tháng 2 nhảy
sang tháng 3" kinh điển.

Các phép khác trên Chrome 152:

```
Temporal.Now.plainDateTimeISO()                 "2026-09-09T20:22:11.4002"
PlainDate.from('2026-09-09').add({months:1})    "2026-10-09"
Instant.from('...Z').toZonedDateTimeISO('Asia/Ho_Chi_Minh')
                                                "2026-09-09T07:00:00+07:00[Asia/Ho_Chi_Minh]"
PlainDate.from('2026-09-09').until('2026-12-25', {largestUnit:'day'})
                                                "P107D"
Duration.from({hours:25}).round({largestUnit:'day'})
                                                "P1DT1H"
```

Bốn điểm mạnh trong output trên:

1. **Múi giờ là một phần của kiểu**, có tên IANA đầy đủ (`[Asia/Ho_Chi_Minh]`) — không phải
   offset. Quan trọng vì offset thay đổi theo DST.
2. **Tách `PlainDate` / `PlainDateTime` / `ZonedDateTime` / `Instant`.** "Sinh nhật" là
   `PlainDate` (không có múi giờ mới đúng); "thời điểm log" là `Instant`.
3. **`Duration` là kiểu riêng**, cộng/trừ/làm tròn được. `P1DT1H` = 1 ngày 1 giờ.
4. **Bất biến** — mọi phép trả về object mới. `Date` thì `setMonth` sửa tại chỗ, gây bug khi
   bạn truyền `Date` vào hàm khác.

### ⚠ Cái bẫy lớn nhất của Temporal

```
Temporal.PlainDate.from('2026-01-01') === Temporal.PlainDate.from('2026-01-01')
-> false
Temporal.PlainDate.compare('2026-01-01', '2026-01-01')
-> 0
```

Chúng là object, `===` **luôn** cho `false`. Phải dùng `compare()` (trả `-1/0/1`) hoặc
`.equals()`. Đây sẽ là lỗi phổ biến nhất khi mọi người chuyển sang Temporal.

### Dùng nó hôm nay

Node 22 chưa có. Hai lựa chọn:

```bash
npm i temporal-polyfill      # ~40 KB gzip, API đầy đủ
```

```js
import { Temporal } from 'temporal-polyfill';
```

Hoặc chưa dùng, nhưng **tránh** hai thứ tệ nhất của `Date` ngay từ giờ: đừng bao giờ dùng
`setMonth`/`setDate` để cộng thời gian, và đừng lưu thời gian dưới dạng chuỗi không có múi giờ.

---

## 4. `using` và `Symbol.dispose`: dọn dẹp có bảo đảm

Chỉ chạy trên Chrome 152 (và TypeScript 5.2+ biên dịch được cho mọi target).

```js
class KetNoi {
  constructor(ten) { this.ten = ten; console.log('mở', ten) }
  [Symbol.dispose]() { console.log('đóng', this.ten) }
}

function lamViec() {
  using a = new KetNoi('A');
  using b = new KetNoi('B');
  throw new Error('nổ giữa đường');
}
try { lamViec() } catch (e) { console.log('bắt:', e.message) }
```

```
mở A
mở B
đóng B          ← thứ tự NGƯỢC, như ngăn xếp
đóng A
bắt: nổ giữa đường
```

Nó tương đương `try/finally` lồng nhau, nhưng không phải viết tay:

```js
// Không có `using`, muốn đúng thì phải viết thế này
const a = new KetNoi('A');
try {
  const b = new KetNoi('B');
  try { throw new Error('nổ') }
  finally { b[Symbol.dispose]() }
} finally { a[Symbol.dispose]() }
```

Bản bất đồng bộ là `await using` + `Symbol.asyncDispose`.

So với `FinalizationRegistry` ([bài 08](./08-bo-nho-va-ro-ri.md) mục 6): `using` chạy **tại
chỗ, có bảo đảm, đúng thứ tự**; `FinalizationRegistry` thì không bảo đảm chạy bao giờ. Với
tài nguyên (file, kết nối, khoá) luôn dùng `using` hoặc `try/finally`.

---

## 5. Những thứ đã có ở cả hai và bạn nên dùng ngay

### `Object.groupBy`

```js
Object.groupBy([1, 2, 3, 4], x => x % 2 ? 'lẻ' : 'chẵn')
// -> { "lẻ": [1,3], "chẵn": [2,4] }
```

Thay hẳn cho `reduce` gom nhóm. Lưu ý: object trả về có prototype là `null` (không phải
`Object.prototype`), nên `.hasOwnProperty` không dùng được — dùng `Object.hasOwn`.

`Map.groupBy` giống vậy nhưng khoá là mọi kiểu:

```js
[...Map.groupBy([1, 2], x => x % 2).keys()]    // -> [1, 0]
```

### `Promise.withResolvers`

```
Object.keys(Promise.withResolvers())   ->  ["promise", "resolve", "reject"]
```

Thay cho mẫu "deferred" viết tay:

```js
// Trước
let res, rej;
const p = new Promise((a, b) => { res = a; rej = b });

// Giờ
const { promise, resolve, reject } = Promise.withResolvers();
```

Hữu ích khi bạn cần resolve từ một chỗ khác hoàn toàn (ví dụ trong một event handler).

### Mảng bất biến: `toSorted`, `toReversed`, `toSpliced`, `with`

```
[3,1,2].toSorted()       -> [1,2,3]   (mảng gốc không đổi)
[1,2,3].with(1, 9)       -> [1,9,3]
```

`sort()` và `reverse()` **sửa mảng gốc** — nguồn bug kinh điển trong React/Vue khi bạn sort
một prop. Bốn method mới trả về mảng mới.

### `Error` `cause` — giữ nguyên lỗi gốc

```js
try { await db.query(sql) }
catch (e) { throw new Error('không lấy được người dùng', { cause: e }) }
```

```
new Error('a', { cause: 'b' }).cause    ->  'b'
```

Không có `cause`, bạn phải chọn: hoặc mất context nghiệp vụ, hoặc mất stack trace gốc. Với
`cause` thì giữ được cả hai — và `console.error` in ra cả chuỗi nguyên nhân.

### Set operations

```
new Set([1,2]).union(new Set([3]))            -> Set {1,2,3}
new Set([1,2]).intersection(new Set([2,3]))   -> Set {2}
```

Còn có `difference`, `symmetricDifference`, `isSubsetOf`, `isSupersetOf`, `isDisjointFrom`.
Thay hết cho `[...a].filter(x => b.has(x))`.

---

## 6. Chiến lược thực dụng: viết code chạy được ở cả hai nơi

Nếu code của bạn chạy cả trên Node (SSR, API) và trình duyệt:

**1. Đừng dò tính năng bằng `typeof` cho cú pháp.** Bundler/transpiler lo phần cú pháp; bạn
chỉ dò được API.

**2. Với API còn thiếu, dùng lớp bọc mỏng ở một chỗ:**

```js
// tien-ich/thoat-regex.js
export const thoatRegex = globalThis.RegExp.escape
  ?? (s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
```

Đo thật sự khác biệt để biết fallback có đúng không:

```
Chrome 152 RegExp.escape('a.b*c')  ->  "\x61\.b\*c"
fallback tự viết                    ->  "a\.b\*c"
```

Chú ý: bản chuẩn thoát cả ký tự đầu (`a` → `\x61`) để chuỗi kết quả an toàn khi ghép vào giữa
một class `[...]`. Fallback không làm việc đó — **đủ dùng cho `new RegExp(thoat(x))`**, nhưng
không an toàn nếu bạn ghép vào trong `[]`.

Đây là điểm chung của mọi polyfill: nó gần đúng, không đúng hẳn. Biết chỗ nó khác là việc của
bạn.

**3. Chốt `engines` trong `package.json`** để CI báo sớm:

```json
"engines": { "node": ">=22.0.0" }
```

**4. Với `Temporal`, dùng polyfill** thay vì tự viết logic ngày tháng. Logic múi giờ + DST là
chỗ không nên tự làm.

---

## 7. Bài tập

### Bài 1 — Đoạn code này nổ ở đâu

```js
if (typeof Symbol.dispose !== 'undefined') {
  using file = moFile('a.txt');
  console.log(file.doc());
} else {
  const file = moFile('a.txt');
  try { console.log(file.doc()) } finally { file.dong() }
}
```

Chạy trên Node 22 thì sao? Sửa thế nào?

<details><summary>Gợi ý đáp án</summary>

Nó **không chạy được dòng nào**. File nổ ngay lúc parse:

```
SyntaxError: Unexpected identifier 'file'
```

Câu `if` không bao giờ được đánh giá, vì JavaScript phải parse **toàn bộ** file trước khi chạy
dòng đầu tiên. Đây là khác biệt cốt lõi giữa tính năng **API** (dò lúc chạy được) và tính năng
**cú pháp** (không dò lúc chạy được).

Ba cách sửa:

```js
// 1. Chỉ viết cú pháp cũ. Đơn giản nhất, luôn đúng.
const file = moFile('a.txt');
try { console.log(file.doc()) } finally { file.dong() }
```

```js
// 2. Để công cụ biên dịch. TypeScript 5.2+ hạ `using` xuống try/finally cho mọi target.
using file = moFile('a.txt');
```

```js
// 3. Nếu thật sự cần hai nhánh: tách ra hai FILE, nạp động
const chay = coCuPhap('{ using x = { [Symbol.dispose](){} }; }')
  ? await import('./ban-moi.js')
  : await import('./ban-cu.js');
```

Cách 3 hoạt động vì mỗi file được parse **độc lập**, và `import()` chỉ parse file được chọn.

Trong thực tế: chọn cách 2 nếu dự án có TypeScript/Babel, cách 1 nếu không.

</details>

### Bài 2 — Viết lại bằng API 2026

Hiện đại hoá đoạn dưới. Nó dùng 5 mẫu đã có API thay thế trên cả Node 22 và Chrome 152.

```js
function xuLy(donHang) {
  const theoTrangThai = donHang.reduce((acc, d) => {
    (acc[d.trangThai] = acc[d.trangThai] || []).push(d);
    return acc;
  }, {});

  const daSort = donHang.slice().sort((a, b) => b.tien - a.tien);

  const idA = new Set(nhomA.map(x => x.id));
  const chung = [...new Set(nhomB.map(x => x.id))].filter(id => idA.has(id));

  let res, rej;
  const p = new Promise((a, b) => { res = a; rej = b });

  try { luu(daSort) }
  catch (e) { throw new Error('lưu thất bại: ' + e.message) }

  return { theoTrangThai, chung, p };
}
```

<details><summary>Gợi ý đáp án</summary>

```js
function xuLy(donHang) {
  // 1. reduce gom nhóm  ->  Object.groupBy
  const theoTrangThai = Object.groupBy(donHang, d => d.trangThai);

  // 2. slice().sort()  ->  toSorted()
  const daSort = donHang.toSorted((a, b) => b.tien - a.tien);

  // 3. Set + filter  ->  intersection
  const chung = [...new Set(nhomA.map(x => x.id)).intersection(new Set(nhomB.map(x => x.id)))];

  // 4. deferred viết tay  ->  Promise.withResolvers
  const { promise, resolve, reject } = Promise.withResolvers();

  // 5. nối chuỗi message  ->  Error cause (giữ được stack gốc)
  try { luu(daSort) }
  catch (e) { throw new Error('lưu thất bại', { cause: e }) }

  return { theoTrangThai, chung, p: promise };
}
```

Bốn chi tiết đáng chú ý:

- `Object.groupBy` trả object có prototype `null`. Nếu code sau đó gọi
  `theoTrangThai.hasOwnProperty('moi')` sẽ nổ `TypeError: ... is not a function`. Dùng
  `Object.hasOwn(theoTrangThai, 'moi')`, hoặc `'moi' in theoTrangThai`.
- `toSorted()` bỏ được cả `slice()` — bớt một mảng trung gian.
- `intersection` cần **cả hai** là `Set`; nó không nhận mảng.
- Với `cause`, `console.error(err)` in ra cả hai tầng lỗi kèm stack trace gốc. Với cách nối
  chuỗi cũ, stack của `e` mất hẳn.

</details>

### Bài 3 — Tại sao bộ so sánh này luôn sai

Đoạn dưới lọc các đơn hàng trong hôm nay. Nó chạy sai trong hai trường hợp. Nêu cả hai.

```js
const homNay = new Date().toISOString().slice(0, 10);
const cuaHomNay = donHang.filter(d => d.taoLuc.slice(0, 10) === homNay);
```

<details><summary>Gợi ý đáp án</summary>

**Trường hợp 1 — múi giờ.** `toISOString()` luôn trả về **UTC**. Người dùng ở Việt Nam
(UTC+7) lúc 6 giờ sáng ngày 10/09 thì `toISOString()` cho `2026-09-09` — họ mất hết đơn hàng
của 7 tiếng đầu ngày.

```js
new Date('2026-09-10T06:00:00+07:00').toISOString().slice(0, 10)
// -> "2026-09-09"
```

**Trường hợp 2 — `d.taoLuc` phải là chuỗi.** Nếu backend trả `Date` object, hoặc nếu ai đó
`JSON.parse` với reviver chuyển thành `Date`, thì `.slice` không tồn tại →
`TypeError: d.taoLuc.slice is not a function`.

Sửa bằng cách so sánh theo **giờ địa phương**, và không dựa vào kiểu của dữ liệu:

```js
const ngayDiaPhuong = (x) => {
  const d = x instanceof Date ? x : new Date(x);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const homNay = ngayDiaPhuong(new Date());
const cuaHomNay = donHang.filter(d => ngayDiaPhuong(d.taoLuc) === homNay);
```

Với `Temporal` thì gọn và rõ ý hơn nhiều:

```js
const homNay = Temporal.Now.plainDateISO('Asia/Ho_Chi_Minh');
const cuaHomNay = donHang.filter(d =>
  Temporal.Instant.from(d.taoLuc).toZonedDateTimeISO('Asia/Ho_Chi_Minh')
    .toPlainDate().equals(homNay));
```

Chú ý `.equals(homNay)` — không phải `===` (mục 3).

Điểm chung: mọi bug ngày tháng đều là bug **múi giờ**. Câu hỏi phải trả lời trước khi viết
dòng đầu tiên là "hôm nay theo múi giờ của ai".

</details>

---

**Tiếp theo:** [Bài 11 — DOM và sự kiện](./11-dom-va-su-kien.md)
