# Bài 04 — Descriptor, Proxy, Reflect

> Mỗi thuộc tính của object không chỉ có giá trị — nó có **bốn** thuộc tính con. Bài này cho
> thấy chúng ở đâu, khi nào chúng khác nhau, và vì sao `Proxy` là nền của mọi framework
> reactive (kể cả cái bạn sẽ viết ở bài 15).

---

## 1. Bốn thuộc tính con của một thuộc tính

```js
const o = { a: 1 };
Object.defineProperty(o, 'b', { value: 2 });

console.log('gán thường     :', JSON.stringify(Object.getOwnPropertyDescriptor(o, 'a')));
console.log('defineProperty :', JSON.stringify(Object.getOwnPropertyDescriptor(o, 'b')));
```

```
gán thường     : {"value":1,"writable":true,"enumerable":true,"configurable":true}
defineProperty : {"value":2,"writable":false,"enumerable":false,"configurable":false}
```

**`defineProperty` mặc định là `false` cả ba.** Đây là nguồn của rất nhiều lỗi "thuộc tính có
đấy mà không thấy". Hệ quả ngay lập tức:

```js
console.log(Object.keys(o), JSON.stringify(o));
const forIn = []; for (const k in o) forIn.push(k);
console.log('for...in:', forIn);
```

```
[ 'a' ] {"a":1}
for...in: [ 'a' ]
```

`o.b` **tồn tại và đọc được** (`o.b === 2`), nhưng biến mất khỏi cả ba cách duyệt. Muốn nó
hành xử như thuộc tính thường thì phải khai đủ:

```js
Object.defineProperty(o, 'b', { value: 2, writable: true, enumerable: true, configurable: true });
```

Ý nghĩa từng cái:

| Cờ | `false` nghĩa là |
|---|---|
| `writable` | gán vào bị bỏ qua (sloppy) hoặc ném `TypeError` (strict) |
| `enumerable` | không xuất hiện trong `Object.keys`, `JSON.stringify`, `for...in`, spread `{...o}` |
| `configurable` | không xoá được, không `defineProperty` lại được |

---

## 2. `freeze` là **nông**

```js
const f = Object.freeze({ x: 1, nested: { y: 1 } });
f.x = 99;
f.nested.y = 99;
console.log(f.x, f.nested.y, '| isFrozen:', Object.isFrozen(f), Object.isFrozen(f.nested));
```

```
1 99 | isFrozen: true false
```

`f.x` không đổi, nhưng `f.nested.y` đổi thoải mái. `Object.freeze` chỉ đóng băng **một tầng**.

Và ở sloppy mode nó **im lặng**:

```js
'use strict';
const f = Object.freeze({ x: 1 });
f.x = 99;
```

```
TypeError: Cannot assign to read only property 'x' of object '#<Object>'
```

Không có `"use strict"` thì dòng `f.x = 99` chạy qua như không có gì. Trong ESM luôn strict
nên bạn sẽ thấy lỗi — đây là một lý do nữa để dùng ESM.

Đóng băng sâu:

```js
function dongBangSau(o) {
  for (const v of Object.values(o)) if (v && typeof v === 'object') dongBangSau(v);
  return Object.freeze(o);
}
```

---

## 3. Thứ tự key: không phải thứ tự bạn viết

```js
const k = { b: 1, 2: 1, a: 1, 1: 1, [Symbol('s')]: 1, '01': 1 };
console.log(Object.keys(k));
console.log(Reflect.ownKeys(k).map(String));
```

```
[ '1', '2', 'b', 'a', '01' ]
[ '1', '2', 'b', 'a', '01', 'Symbol(s)' ]
```

Luật, theo đúng thứ tự:

1. **Khoá số nguyên** (chuỗi parse được thành số nguyên không âm), sắp **tăng dần**.
2. **Khoá chuỗi khác**, theo **thứ tự chèn**.
3. **Symbol**, theo thứ tự chèn — và chỉ `Reflect.ownKeys` / `getOwnPropertySymbols` thấy.

Chú ý `'01'` **không** phải khoá số nguyên (vì `String(Number('01')) !== '01'`), nên nó nằm ở
nhóm 2, sau cả `b` và `a`.

Đây là lý do object không dùng làm "danh sách có thứ tự" được. Nếu key là ID dạng số:

```js
const nguoiDung = { 300: 'C', 100: 'A', 200: 'B' };
Object.keys(nguoiDung)     // -> ['100','200','300']  ← đã bị sắp lại!
```

Dùng `Map` nếu cần giữ thứ tự chèn — `Map` giữ đúng thứ tự với mọi kiểu khoá.

---

## 4. `Proxy`: chặn 13 thao tác

```js
const hits = [];
const p = new Proxy({ a: 1, b: 2 }, {
  get(t, k, r)   { hits.push('get:' + String(k)); return Reflect.get(t, k, r) },
  has(t, k)      { hits.push('has:' + String(k)); return Reflect.has(t, k) },
  ownKeys(t)     { hits.push('ownKeys');          return Reflect.ownKeys(t) },
});

p.a;  'b' in p;  Object.keys(p);  JSON.stringify(p);
console.log(hits.join(' | '));
```

```
get:a | has:b | ownKeys | get:toJSON | ownKeys | get:a | get:b
```

Đọc dấu vết này rất bổ ích:

- `Object.keys(p)` chỉ gọi `ownKeys` — **không** gọi `get` cho từng key.
- `JSON.stringify(p)` gọi `get:toJSON` **trước tiên** (tìm xem có `toJSON` không), rồi
  `ownKeys`, rồi `get` từng key.

Nếu bạn viết trap `get` mà quên xử lý `toJSON`, `JSON.stringify` trên proxy sẽ hành xử lạ.

### Vì sao luôn dùng `Reflect` bên trong trap

`Reflect.get(t, k, r)` có tham số thứ ba là **receiver** — nó quyết định `this` bên trong
getter:

```js
const base = { _v: 1, get v() { return this._v } };
const pr = new Proxy(base, { get(t, k, r) { return Reflect.get(t, k, r) } });
const con = Object.create(pr, { _v: { value: 99 } });
console.log(con.v);
```

```
99
```

Nếu trap viết `return t[k]` thay vì `Reflect.get(t, k, r)`, kết quả sẽ là `1` — getter chạy
với `this = base` thay vì `this = con`. Trong một framework reactive, sai chỗ này nghĩa là
computed property đọc nhầm dữ liệu.

`Reflect` có đúng một hàm cho mỗi trap, với cùng chữ ký. Quy tắc: **trap nào cũng kết thúc
bằng `Reflect.<cùng tên>(...arguments)`**, rồi mới thêm logic của bạn vào trước đó.

---

## 5. Ba chỗ `Proxy` **không** làm được

### Không bọc được object có internal slot

```js
const m = new Map([['k', 1]]);
new Proxy(m, {}).get('k');
```

```
TypeError: Method Map.prototype.get called on incompatible receiver #<Map>
```

`Map`, `Set`, `Date`, `Promise`, `TypedArray` lưu dữ liệu trong "internal slot" mà proxy
không chuyển tiếp được. Muốn proxy chúng thì trap `get` phải tự bind:

```js
new Proxy(m, {
  get(t, k, r) {
    const v = Reflect.get(t, k, r);
    return typeof v === 'function' ? v.bind(t) : v;      // ← bind về target thật
  },
});
```

Đây chính xác là điều Vue 3 phải làm trong `reactive()` cho các collection.

### Không nói dối được về thuộc tính đã đóng băng

```js
const frozen = Object.freeze({ x: 1 });
new Proxy(frozen, { get() { return 'nói dối' } }).x;
```

```
TypeError: 'get' on proxy: property 'x' is a read-only and non-configurable data property
on the proxy target but the proxy did not return its actual value
```

Đặc tả có **invariant**: nếu target có thuộc tính non-writable + non-configurable, trap phải
trả đúng giá trị đó. Nếu không, ném lỗi.

### Không so sánh bằng `===` với target

```js
const t = {}; const p = new Proxy(t, {});
p === t          // false
```

Nếu bạn lưu object vào `Set` rồi sau đó chỉ có proxy trong tay, `set.has(proxy)` là `false`.
Framework reactive phải giữ một `WeakMap` map hai chiều target ↔ proxy để tránh chuyện này —
bạn sẽ viết đúng đoạn đó ở bài 15.

---

## 6. Getter/setter: rẻ hay đắt

```js
class A { constructor(v) { this._v = v } get v() { return this._v } }
class B { constructor(v) { this.v = v } }
```

```
  đọc qua getter (1 triệu lần)                  9.50ms
  đọc thuộc tính thường (1 triệu lần)           9.52ms
  đọc qua Proxy có trap get                     40.14ms
```

Getter **hoàn toàn miễn phí** — 9.50 so với 9.52 ms, chênh lệch nằm trong nhiễu đo. V8 nội
tuyến nó thành phép đọc thuộc tính thường. `Proxy` thì **đắt gấp 4.2 lần**.

Kết luận thực dụng: dùng getter thoải mái. Dùng `Proxy` cho tầng "theo dõi thay đổi" ở mức
state của app (vài nghìn thao tác/giây) thì không sao; đừng bọc proxy quanh mảng 100 000 phần
tử rồi duyệt nó trong vòng lặp render.

---

## 7. Bài tập

### Bài 1 — Vì sao spread làm mất thuộc tính

```js
const o = {};
Object.defineProperty(o, 'id', { value: 1 });
o.ten = 'A';

const ban_sao = { ...o };
console.log(o.id, ban_sao.id);
```

In ra gì, và sửa thế nào để `ban_sao.id` cũng là `1`?

<details><summary>Gợi ý đáp án</summary>

```
1 undefined
```

Spread chỉ chép thuộc tính **own + enumerable**. `id` có `enumerable: false`.

Ba cách sửa:

```js
// 1. Khai báo đúng ngay từ đầu
Object.defineProperty(o, 'id', { value: 1, enumerable: true, writable: true, configurable: true });

// 2. Chép cả descriptor
const ban_sao = Object.defineProperties({}, Object.getOwnPropertyDescriptors(o));

// 3. Giữ luôn cả prototype
const ban_sao = Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o));
```

Cách 2 và 3 cũng là cách duy nhất để chép **getter/setter** mà không làm chúng chạy:
`{ ...o }` gọi getter và chép **giá trị**, không chép getter.

</details>

### Bài 2 — Viết một `Proxy` cảnh báo khi đọc key không tồn tại

Trong dev, đọc `config.tenSai` trả `undefined` rồi lỗi ở tận đâu. Viết `nghiemNgat(obj)` để
ném lỗi ngay tại chỗ đọc.

<details><summary>Gợi ý đáp án</summary>

```js
function nghiemNgat(obj, ten = 'object') {
  return new Proxy(obj, {
    get(t, k, r) {
      if (typeof k === 'string' && !(k in t)) {
        throw new TypeError(`${ten} không có thuộc tính "${k}"`);
      }
      return Reflect.get(t, k, r);
    },
  });
}

const cfg = nghiemNgat({ cong: 3000, host: 'localhost' }, 'config');
console.log(cfg.cong);
console.log(cfg.conG);
```

```
3000
TypeError: config không có thuộc tính "conG"
```

Hai chi tiết bắt buộc:

1. **`typeof k === 'string'`** — nếu không, runtime hỏi `obj[Symbol.toPrimitive]`,
   `obj.then`, `obj[Symbol.iterator]`… và bạn ném lỗi ở những chỗ hoàn toàn hợp lệ. Riêng
   `.then` rất nguy hiểm: `await cfg` sẽ nổ.
2. **`k in t`, không phải `t[k] !== undefined`** — thuộc tính có thật với giá trị `undefined`
   là hợp lệ.

Chạy thử bẫy `then`:

```js
await nghiemNgat({ a: 1 });
// bản thiếu kiểm tra typeof -> TypeError: không có then
```

</details>

### Bài 3 — Đếm số lần đọc mỗi thuộc tính

Viết `theoDoi(obj)` trả về `[proxy, thongKe]` sao cho sau khi dùng, `thongKe()` cho biết mỗi
key được đọc bao nhiêu lần. Dùng nó để tìm thuộc tính bị đọc thừa trong vòng lặp render.

<details><summary>Gợi ý đáp án</summary>

```js
function theoDoi(obj) {
  const dem = new Map();
  const proxy = new Proxy(obj, {
    get(t, k, r) {
      if (typeof k === 'string') dem.set(k, (dem.get(k) ?? 0) + 1);
      return Reflect.get(t, k, r);
    },
  });
  return [proxy, () => Object.fromEntries([...dem].sort((a, b) => b[1] - a[1]))];
}

const [u, thongKe] = theoDoi({ ten: 'A', tuoi: 20, email: 'a@b.c' });
for (let i = 0; i < 3; i++) `${u.ten} (${u.tuoi})`;
u.email;
console.log(thongKe());
```

```
{ ten: 3, tuoi: 3, email: 1 }
```

Mở rộng hữu ích: thêm `new Error().stack` để biết **đọc từ đâu**:

```js
get(t, k, r) {
  const noiGoi = new Error().stack.split('\n')[2]?.trim();
  ...
}
```

Nhớ chỉ bật trong dev — mục 6 đã đo `Proxy` đắt gấp 4.2 lần.

</details>

---

**Tiếp theo:** [Bài 05 — Iterator và generator](./05-iterator-va-generator.md)
