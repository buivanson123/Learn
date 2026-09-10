# Bài 05 — Iterator và generator

> `for...of`, spread `[...x]`, destructuring, `Promise.all` — cả bốn chạy trên **một** giao
> thức duy nhất. Hiểu nó thì bạn tự làm được object của mình chạy với cả bốn.

---

## 1. Giao thức iterable: đúng một method

Object nào có `[Symbol.iterator]()` trả về một object có `next()` thì nó là **iterable**.

```js
const range = {
  from: 1, to: 3,
  [Symbol.iterator]() {
    let c = this.from, t = this.to;
    return { next: () => c <= t ? { value: c++, done: false } : { value: undefined, done: true } };
  },
};

console.log('spread     :', [...range]);
console.log('destructure:', (([a, b]) => [a, b])(range));
```

```
spread     : [ 1, 2, 3 ]
destructure: [ 1, 2 ]
```

Chỉ thêm một method mà `for...of`, spread, destructuring, `Array.from`, `Promise.all`,
`new Set(x)`, `new Map(x)` đều dùng được.

Chú ý dòng destructure: nó **dừng ngay khi lấy đủ**, chỉ gọi `next()` hai lần. Đó không phải
chi tiết vụn — với iterator vô hạn thì đó là khác biệt giữa chạy được và treo máy.

---

## 2. `for...of` gọi `return()` khi bạn `break`

```js
const it = {
  [Symbol.iterator]() {
    let i = 0;
    return {
      next: () => ({ value: i++, done: i > 5 }),
      return() { console.log('iterator.return() được gọi khi break'); return { done: true } },
    };
  },
};
for (const v of it) { if (v === 2) break; }
```

```
iterator.return() được gọi khi break
```

`for...of` gọi `return()` khi thoát sớm: `break`, `return`, hoặc **ném lỗi**. Đó là chỗ để
dọn dẹp — đóng file, huỷ kết nối, gỡ listener. `for...in` và `forEach` **không** có cơ chế
này.

Đó cũng là lý do `forEach` không `break` được: nó không phải vòng lặp, nó là lời gọi hàm.

---

## 3. Generator: hàm tạm dừng được

```js
function* gen() {
  try {
    const x = yield 1;
    console.log('  nhận từ next():', x);
    yield 2;
  } finally {
    console.log('  finally chạy');
  }
}

const g = gen();
console.log('1', g.next());
console.log('2', g.next('A'));
console.log('3 return():', g.return('STOP'));
console.log('4 sau khi done:', g.next());
```

```
1 { value: 1, done: false }
  nhận từ next(): A
2 { value: 2, done: false }
  finally chạy
3 return(): { value: 'STOP', done: true }
4 sau khi done: { value: undefined, done: true }
```

Ba điều rút ra:

1. **`next(x)` truyền dữ liệu *vào* generator.** Giá trị `'A'` trở thành kết quả của biểu
   thức `yield 1`. Đây là kênh giao tiếp **hai chiều** — thứ mà `async/await` được xây dựng
   trên đó.
2. **`return()` chạy khối `finally`.** Generator không bị giết ngang; nó được cho cơ hội dọn
   dẹp. `throw()` cũng vậy.
3. Sau khi `done`, mọi `next()` tiếp theo trả `{ undefined, true }` — không lỗi.

---

## 4. Lười biếng: vì sao nó quan trọng

```js
function* nat() { let i = 0; while (true) yield i++; }             // vô hạn
function* take(it, n) { let i = 0; for (const v of it) { if (i++ >= n) return; yield v; } }

console.log([...take(nat(), 5)]);
```

```
[ 0, 1, 2, 3, 4 ]
```

`nat()` là vòng lặp `while(true)` nhưng chương trình không treo — vì generator chỉ chạy khi
có người gọi `next()`.

So sánh bộ nhớ với cách làm bằng mảng, cùng cộng 1 triệu số:

```
generator 1e6 phần tử: tổng = 499999500000 | 69.00ms, heap  4.1 MB
mảng      1e6 phần tử: tổng = 499999500000 | 57.07ms, heap 12.3 MB
```

Generator chậm hơn **21%** nhưng tốn bộ nhớ ít hơn **3 lần**. Đánh đổi rõ ràng:

| Dùng generator khi | Dùng mảng khi |
|---|---|
| Dữ liệu lớn hoặc không biết trước độ dài | Dữ liệu nhỏ, đã nằm sẵn trong bộ nhớ |
| Đọc từ file / mạng theo từng khúc | Cần `length`, cần truy cập ngẫu nhiên `arr[i]` |
| Có thể dừng giữa chừng | Cần duyệt nhiều lần |

Điểm cuối quan trọng: **iterator chỉ dùng được một lần**.

```js
const g = nat();
console.log([...take(g, 3)], [...take(g, 3)]);
```

```
[ 0, 1, 2 ] []
```

Lần thứ hai ra **mảng rỗng**, không phải `[3,4,5,6]`. Vì `take` gọi `return()` lên `g` khi lấy
đủ — generator bị đóng hẳn. Bài tập 3 mổ xẻ kỹ trường hợp này.

---

## 5. Iterator helpers — đã có trên cả Node 22 và Chrome 152

Từ 2024, iterator có sẵn `map`/`filter`/`take`/`drop`/`flatMap`/`reduce`/`toArray`, chạy
**lười**:

```js
[...[1, 2, 3].values().map(x => x * 2)]       // [2,4,6]
[...[1, 2, 3, 4].values().take(2)]            // [1,2]
```

Khác biệt với `array.map(...)`: bản trên **không tạo mảng trung gian**.

```js
// Tạo 3 mảng trung gian, mỗi mảng 1 triệu phần tử
duLieu.map(f).filter(g).slice(0, 10);

// Không tạo mảng nào; dừng ngay khi đủ 10
duLieu.values().map(f).filter(g).take(10).toArray();
```

Đo trên mảng 1 triệu phần tử, chỉ lấy 10 kết quả đầu:

```
  mảng: map().filter().slice(0,10)              18.58ms
  iterator helpers: .map().filter().take(10)     0.00ms
```

18.58 ms xuống dưới ngưỡng đo được. Bản mảng duyệt 1 triệu phần tử **hai lần** và cấp phát hai
mảng 1 triệu phần tử, rồi vứt đi 999 990 kết quả. Bản iterator chỉ xử lý đúng số phần tử cần
để có 10 kết quả rồi dừng.

⚠️ Nhớ bài 00: `[1,2,3].map` là của **Array**, còn `.values().map` là của **Iterator**. Chúng
khác nhau. Muốn dùng helpers trên generator của mình thì generator đã tự có sẵn:

```js
[...nat().take(5)]      // -> [0,1,2,3,4]
```

---

## 6. Async iterator: `for await`

```js
async function* docTheoDong(duongDan) {
  const fh = await fs.promises.open(duongDan);
  try {
    for await (const line of fh.readLines()) yield line.toUpperCase();
  } finally {
    await fh.close();            // chạy cả khi người dùng break
  }
}

for await (const dong of docTheoDong('data.txt')) {
  console.log(dong);
  if (dong.startsWith('STOP')) break;      // finally vẫn chạy, file vẫn được đóng
}
```

Giao thức: `[Symbol.asyncIterator]()` trả về object có `next()` trả về **Promise**.

Node stream đã cài sẵn giao thức này, nên đọc file 191 MB theo khúc chỉ là:

```js
for await (const chunk of fs.createReadStream('big.bin')) n += chunk.length;
```

```
readFile        :  86ms, RSS đỉnh 226 MB
createReadStream: 181ms, RSS đỉnh  76 MB
```

Chi tiết ở bài 13.

---

## 7. Bài tập

### Bài 1 — Làm object của bạn `for...of` được

Cho class `DanhSach` giữ dữ liệu trong `this.items`. Làm nó chạy được với `for...of`, spread,
và `Array.from` — bằng **một** dòng.

```js
class DanhSach {
  constructor(...items) { this.items = items }
}
```

<details><summary>Gợi ý đáp án</summary>

```js
class DanhSach {
  constructor(...items) { this.items = items }
  *[Symbol.iterator]() { yield* this.items }
}

const d = new DanhSach('a', 'b', 'c');
console.log([...d], Array.from(d), Math.max(...new DanhSach(3, 1, 2)));
```

```
[ 'a', 'b', 'c' ] [ 'a', 'b', 'c' ] 3
```

`*[Symbol.iterator]()` là generator method — nó tự sinh ra `next()`/`return()`/`throw()` đầy
đủ. `yield*` uỷ quyền cho iterator của mảng.

Viết tay bằng `return this.items[Symbol.iterator]()` cũng được và **nhanh hơn**, nhưng bạn
mất khả năng chèn logic (lọc, biến đổi) vào giữa.

</details>

### Bài 2 — Đọc file lớn không nạp hết vào RAM

Viết `*docKhuc(chuoi, n)` cắt một chuỗi thành các khúc `n` ký tự, **lười**. Chứng minh nó
lười bằng cách in ra mỗi lần sinh một khúc.

<details><summary>Gợi ý đáp án</summary>

```js
function* docKhuc(chuoi, n) {
  for (let i = 0; i < chuoi.length; i += n) {
    console.log('  -> sinh khúc bắt đầu ở', i);
    yield chuoi.slice(i, i + n);
  }
}

const it = docKhuc('abcdefghij', 3);
console.log('tạo generator xong, chưa sinh gì cả');
console.log('lấy 1:', it.next().value);
console.log('lấy 2:', it.next().value);
```

```
tạo generator xong, chưa sinh gì cả
  -> sinh khúc bắt đầu ở 0
lấy 1: abc
  -> sinh khúc bắt đầu ở 3
lấy 2: def
```

Dòng đầu tiên là bằng chứng: gọi `docKhuc(...)` **không chạy một dòng nào** trong thân hàm.
Thân hàm chỉ chạy khi `next()` được gọi lần đầu.

Đó là lý do đặt `console.log`/validate ngay đầu generator là bẫy — nó không chạy lúc bạn
tưởng:

```js
function* xuLy(arr) {
  if (!Array.isArray(arr)) throw new TypeError('cần mảng');   // ⚠ không ném ngay
  yield* arr;
}
xuLy('không phải mảng');        // không lỗi gì!
[...xuLy('không phải mảng')];   // đến đây mới TypeError
```

Cách sửa: bọc bằng hàm thường trả về generator.

```js
function xuLy(arr) {
  if (!Array.isArray(arr)) throw new TypeError('cần mảng');   // ném ngay
  return (function* () { yield* arr })();
}
```

</details>

### Bài 3 — Vì sao vòng lặp này bỏ sót phần tử

```js
function* nguon() { yield* [1, 2, 3, 4, 5, 6]; }
const g = nguon();

const dau = [...g.take(2)];
const sau = [...g];
console.log(dau, sau);
```

Bạn mong `[1,2]` và `[3,4,5,6]`. Kết quả thật là gì?

<details><summary>Gợi ý đáp án</summary>

```
[ 1, 2 ] []
```

`take(2)` không chỉ lấy 2 phần tử — khi lấy đủ, nó gọi `return()` lên iterator nguồn để báo
"tôi xong rồi, dọn đi". Generator `nguon()` bị đóng hẳn, nên `[...g]` không lấy được gì.

Đây là hành vi **đúng theo đặc tả**, và là điều bạn muốn khi nguồn là file hay kết nối mạng —
`take` xong thì file được đóng.

Nếu bạn thật sự cần đọc tiếp, phải tự lấy tay:

```js
const g = nguon();
const dau = [];
for (let i = 0; i < 2; i++) dau.push(g.next().value);
console.log(dau, [...g]);
```

```
[ 1, 2 ] [ 3, 4, 5, 6 ]
```

Bài học: mọi helper "kết thúc sớm" (`take`, `find`, `some`, `every`) đều đóng iterator nguồn.
Với mảng thì vô hại, với iterator thì không.

</details>

---

**Tiếp theo:** [Bài 06 — Event loop](./06-event-loop.md)
