# 22 bài gõ tay

Phỏng vấn hay yêu cầu viết trực tiếp — trên giấy, trên bảng, hoặc trong CodePen không có gợi ý
tự động.

**Cách luyện:** tự làm hết trước rồi mới mở đáp án. Bài có 🖊 thì làm **trên giấy** — không mở
trình duyệt, không tra cứu.

Mọi output trong đáp án đều đã chạy thật trên Node 22.23.

---

## Nhóm A — Hàm bậc cao

### Bài 1 🖊 — `debounce` đầy đủ

Viết `debounce(fn, ms, { leading, trailing })` có thêm `.huy()` và `.chayNgay()`.

<details><summary>Đáp án</summary>

```js
function debounce(fn, ms, { leading = false, trailing = true } = {}) {
  let id = null, lastArgs = null, lastThis = null, daGoiLeading = false;

  const goi = () => { const kq = fn.apply(lastThis, lastArgs); lastArgs = lastThis = null; return kq };

  function boc(...args) {
    lastArgs = args; lastThis = this;                  // ⚠ function, không arrow — cần `this`
    if (leading && id === null && !daGoiLeading) { daGoiLeading = true; goi() }
    clearTimeout(id);
    id = setTimeout(() => { id = null; if (trailing && lastArgs) goi(); daGoiLeading = false }, ms);
  }

  boc.huy = () => { clearTimeout(id); id = null; lastArgs = null; daGoiLeading = false };
  boc.chayNgay = () => { if (id) { clearTimeout(id); id = null; if (lastArgs) goi() } };
  return boc;
}
```

Chạy thật:

```
debounce ngay sau 3 lần gọi: n = 0
sau 60ms                   : n = 1
leading: n ngay = 1  →  sau 60ms: n = 2
huỷ    : n = 0
chayNgay: n = 1
```

Bốn chi tiết để ghi điểm:

1. **`function boc(...)` chứ không arrow** — cần `this` của chỗ gọi để `fn.apply(lastThis, ...)`
   hoạt động khi debounce một method.
2. **`lastArgs` lưu lần gọi cuối** — trailing phải chạy với tham số **mới nhất**, không phải
   tham số đầu tiên.
3. **`.huy()`** bắt buộc trong React/Vue: gọi nó trong cleanup, nếu không timer còn chạy sau khi
   component unmount và bạn `setState` trên component đã chết.
4. **`.chayNgay()`** cho ô tìm kiếm: người dùng bấm Enter thì chạy ngay, không chờ hết 300 ms.

</details>

### Bài 2 🖊 — `throttle`

Viết `throttle(fn, ms)`: chạy tối đa một lần mỗi `ms`, và **không được bỏ mất lần gọi cuối**.

<details><summary>Đáp án</summary>

```js
function throttle(fn, ms) {
  let lan = 0, id = null, args = null;
  return function (...a) {
    args = a;
    const con = ms - (Date.now() - lan);
    if (con <= 0) {                       // đã qua đủ ms -> chạy ngay
      clearTimeout(id); id = null;
      lan = Date.now();
      fn.apply(this, args);
    } else if (id === null) {             // còn trong cửa sổ -> hẹn cho phần đuôi
      id = setTimeout(() => { lan = Date.now(); id = null; fn.apply(this, args) }, con);
    }
  };
}
```

```
throttle 20 lần liên tiếp, ngay sau: t = 1
sau 80ms                           : t = 2
```

**Debounce hay throttle?**

| | Dùng khi | Ví dụ |
|---|---|---|
| `debounce` | chỉ cần kết quả **sau khi người dùng dừng** | ô tìm kiếm, tự động lưu |
| `throttle` | cần cập nhật **đều đặn trong lúc** đang diễn ra | scroll, resize, kéo thả |

Nhánh `else if (id === null)` là thứ giữ lại lần gọi cuối. Không có nó, người dùng dừng cuộn
giữa cửa sổ thì lần cập nhật cuối bị mất và UI đứng ở trạng thái sai.

</details>

### Bài 3 🖊 — `once`

Viết `once(fn)`: chỉ chạy lần đầu, các lần sau trả lại kết quả cũ.

<details><summary>Đáp án</summary>

```js
const once = (fn) => {
  let xong = false, kq;
  return (...a) => { if (!xong) { xong = true; kq = fn(...a) } return kq };
};
```

```
once: 1 1 1 | gọi thật: 1
```

Cờ `xong` riêng chứ không kiểm `kq === undefined` — nếu `fn` trả về `undefined` thì cách kia
gọi lại mỗi lần.

Đặt `xong = true` **trước** khi gọi `fn` để `fn` gọi đệ quy vào chính nó cũng không chạy hai lần.

</details>

### Bài 4 — `curry`

Viết `curry(fn)` sao cho `cong(1)(2)(3)`, `cong(1,2)(3)`, `cong(1)(2,3)`, `cong(1,2,3)` đều cho `6`.

<details><summary>Đáp án</summary>

```js
const curry = (fn) => function c(...a) {
  return a.length >= fn.length ? fn.apply(this, a) : (...b) => c.apply(this, [...a, ...b]);
};
```

```
curry: 6 6 6 6
```

Mấu chốt là **`fn.length`** — số tham số khai báo của hàm. Hai giới hạn phải nói ra:

```js
fn.length  // KHÔNG đếm tham số có giá trị mặc định, và KHÔNG đếm rest
(function (a, b = 1) {}).length     // -> 1
(function (...a) {}).length          // -> 0
```

Nên `curry` không dùng được với hàm có default hoặc rest. Muốn dùng thì phải truyền arity vào tay:
`curry(fn, 3)`.

</details>

### Bài 5 — `memoize`

Viết `memoize(fn)` có cách xử lý hợp lý cho tham số là object.

<details><summary>Đáp án</summary>

```js
function memoize(fn, keyFn = (...a) => a.length === 1 && typeof a[0] !== 'object' ? a[0] : JSON.stringify(a)) {
  const cache = new Map();
  return function (...a) {
    const k = keyFn(...a);
    if (cache.has(k)) return cache.get(k);
    const v = fn.apply(this, a);
    cache.set(k, v);
    return v;
  };
}
```

```
memoize: gọi thật 1 lần (sau 3 lần gọi cùng tham số)
```

Ba vấn đề phải nêu ra — đây là chỗ phân biệt câu trả lời hời hợt với câu trả lời tốt:

1. **`JSON.stringify` làm key là không đáng tin.** `{a:1,b:2}` và `{b:2,a:1}` cho hai key khác
   nhau dù là cùng dữ liệu. Và nó ném lỗi với vòng lặp / `BigInt`.
2. **Cache không giới hạn là rò rỉ bộ nhớ.** Với `Map`, mọi key và value sống mãi. Cần LRU hoặc
   TTL.
3. **Tham số một object thì nên dùng `WeakMap`** — key chết thì entry tự biến mất:

```js
function memoizeObj(fn) {
  const cache = new WeakMap();
  return (o) => {
    if (cache.has(o)) return cache.get(o);
    const v = fn(o); cache.set(o, v); return v;
  };
}
```

Và luôn hỏi ngược: **hàm có thuần không?** Memoize một hàm có side effect hoặc đọc thời gian là
tạo bug.

</details>

---

## Nhóm B — Bất đồng bộ

### Bài 6 🖊 — `pLimit(n)`

Viết hàm giới hạn số việc chạy đồng thời.

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
  return (fn) => new Promise((res, rej) => { hangDoi.push({ fn, res, rej }); tiep() });
}
```

Kiểm chứng — 10 việc × 50 ms, giới hạn 3:

```
đỉnh đồng thời: 3 | tổng thời gian: 208 ms
```

4 đợt × 50 ms ≈ 200 ms. Khớp.

Ba chi tiết bắt buộc:

1. **`Promise.resolve().then(fn)`** thay vì `fn()` — nếu `fn` ném lỗi **đồng bộ**, gọi thẳng làm
   nổ `tiep()`, `dangChay` không bao giờ giảm, và hàng đợi **treo vĩnh viễn**.
2. **`.finally`** chứ không `.then` — phải giảm bộ đếm cả khi lỗi.
3. Gọi `tiep()` **trong** `finally` — đó là thứ giữ hàng đợi chảy.

</details>

### Bài 7 — `thuLai` (retry) có backoff

Viết retry có exponential backoff + jitter + huỷ được + không thử lại lỗi client.

<details><summary>Đáp án</summary>

```js
async function thuLai(fn, { lan = 3, cho = 300, signal } = {}) {
  let loiCuoi;
  for (let i = 0; i < lan; i++) {
    signal?.throwIfAborted();
    try { return await fn() }                                       // ✅ await
    catch (e) {
      if (e.status && e.status < 500 && e.status !== 429) throw e;   // ✅ lỗi client -> đừng thử lại
      loiCuoi = e;
      if (i === lan - 1) break;                                      // ✅ không chờ sau lần cuối
      await new Promise(r => setTimeout(r, cho * 2 ** i * (0.5 + Math.random())));
    }
  }
  throw loiCuoi;                                                     // ✅ ném lỗi thật ra ngoài
}
```

```
retry: hỏng | số lần gọi: 3
```

Bốn lỗi hay gặp ở bài này: `return fn()` không `await` (lỗi rơi ngoài `try`, không retry lần nào)
· hết vòng trả `undefined` thay vì ném · chờ cố định (thundering herd) · chờ sau lần thử cuối.

Jitter `(0.5 + Math.random())` quan trọng hơn người ta tưởng: không có nó, 1000 client cùng
retry đúng một thời điểm và đánh sập server vừa hồi phục.

</details>

### Bài 8 — `withTimeout(p, ms)`

Đặt hạn giờ cho một promise, và **thật sự huỷ** việc đang chạy.

<details><summary>Đáp án</summary>

Bản ngây thơ — chỉ *bỏ qua* kết quả, việc vẫn chạy:

```js
const withTimeout = (p, ms) => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error('hết giờ')), ms)),
]);
```

Ba vấn đề: timer không được dọn (giữ tiến trình Node sống thêm) · việc gốc vẫn chạy tới cùng ·
nếu `p` reject **sau** khi hết giờ thì lỗi đó biến mất im lặng (kiểu nuốt lỗi số 4).

Bản đúng — dùng `AbortSignal`:

```js
async function withTimeout(taoP, ms, signal) {
  const sig = signal ? AbortSignal.any([signal, AbortSignal.timeout(ms)]) : AbortSignal.timeout(ms);
  return taoP(sig);                       // ⚠ nhận HÀM, để truyền signal vào
}

await withTimeout(sig => fetch(url, { signal: sig }), 5000);
```

Điểm mấu chốt: nhận **hàm tạo promise**, không nhận promise. Promise đã tạo rồi thì không huỷ
được — nó không có API cho việc đó.

Nếu buộc phải nhận promise sẵn, ít nhất hãy dọn timer:

```js
function withTimeout(p, ms) {
  let id;
  const hetGio = new Promise((_, rej) => { id = setTimeout(() => rej(new Error('hết giờ')), ms) });
  return Promise.race([p, hetGio]).finally(() => clearTimeout(id));
}
```

</details>

### Bài 9 — Chạy tuần tự một mảng hàm async

Viết `chayTuanTu(fns)` trả về mảng kết quả, chạy **lần lượt**.

<details><summary>Đáp án</summary>

```js
async function chayTuanTu(fns) {
  const kq = [];
  for (const fn of fns) kq.push(await fn());     // ✅ rõ ràng nhất
  return kq;
}
```

Bản dùng `reduce` hay được hỏi:

```js
const chayTuanTu = (fns) =>
  fns.reduce((p, fn) => p.then(async (acc) => [...acc, await fn()]), Promise.resolve([]));
```

Nói ra được điểm này thì tốt: bản `reduce` **khó đọc hơn và không nhanh hơn** — `for...of` +
`await` là câu trả lời đúng trong code thật. Bản `reduce` chỉ để chứng minh bạn hiểu chuỗi promise.

Và cái bẫy kèm theo:

```js
const kq = fns.map(async (fn) => await fn());    // ❌ chạy SONG SONG hết, không tuần tự
```

`map` gọi hết callback ngay lập tức. Promise chạy khi được **tạo**.

</details>

### Bài 10 — Async iterator có giới hạn đồng thời

Viết `theoLo(items, n, f)` — async generator, xử lý `n` item một lúc, `yield` từng kết quả.

<details><summary>Đáp án</summary>

```js
async function* theoLo(items, n, f) {
  for (let i = 0; i < items.length; i += n) {
    yield* await Promise.all(items.slice(i, i + n).map(f));
  }
}

for await (const r of theoLo(ids, 5, tai)) console.log(r);
```

Vì sao cần: đoạn dưới **không** giới hạn gì cả —

```js
for await (const r of ids.map(tai)) { ... }     // ❌ khởi động TẤT CẢ ngay
```

`ids.map(tai)` gọi hết `tai` ngay lập tức. `for await` chỉ điều tiết việc **đọc kết quả**, không
điều tiết việc **gửi đi**. Với 5000 id là 5000 request cùng lúc.

Hạn chế của bản `theoLo`: nó chờ **cả lô** xong mới sang lô sau, nên một item chậm làm nghẽn cả
lô. Bản "cửa sổ trượt" tốt hơn — dùng `pLimit` từ bài 6:

```js
const limit = pLimit(5);
const kq = await Promise.all(ids.map(id => limit(() => tai(id))));
```

</details>

---

## Nhóm C — Object và dữ liệu

### Bài 11 — `deepClone` tự viết

Viết deep clone xử lý được `Date`, `RegExp`, `Map`, `Set`, `TypedArray`, tham chiếu vòng, và
**giữ prototype**.

<details><summary>Đáp án</summary>

```js
function deepClone(x, seen = new WeakMap()) {
  if (x === null || typeof x !== 'object') return x;      // primitive + hàm giữ nguyên
  if (seen.has(x)) return seen.get(x);                     // ✅ vòng lặp

  if (x instanceof Date) return new Date(x);
  if (x instanceof RegExp) return new RegExp(x.source, x.flags);
  if (x instanceof Map) { const m = new Map(); seen.set(x, m);
    for (const [k, v] of x) m.set(deepClone(k, seen), deepClone(v, seen)); return m }
  if (x instanceof Set) { const s = new Set(); seen.set(x, s);
    for (const v of x) s.add(deepClone(v, seen)); return s }
  if (ArrayBuffer.isView(x)) return new x.constructor(x);

  const out = Array.isArray(x) ? [] : Object.create(Object.getPrototypeOf(x));   // ✅ giữ class
  seen.set(x, out);
  for (const k of Reflect.ownKeys(x)) {                    // ✅ cả Symbol, cả non-enumerable
    const d = Object.getOwnPropertyDescriptor(x, k);
    if ('value' in d) d.value = deepClone(d.value, seen);  // ✅ không làm getter chạy
    Object.defineProperty(out, k, d);
  }
  return out;
}
```

Chạy thật:

```
Date true | Map true | vòng true | giữ class true "hi A" | hàm giữ nguyên true | Map sâu true
```

Bốn điểm để ghi điểm, xếp theo mức ít người nghĩ tới:

1. **`seen.set(x, out)` phải đặt TRƯỚC khi clone con** — nếu không, tham chiếu vòng gây đệ quy vô
   hạn.
2. **`Reflect.ownKeys` + descriptor** thay vì `for...in` hoặc `Object.entries` — giữ được `Symbol`
   key và thuộc tính non-enumerable, và **không làm getter chạy**.
3. **`Object.create(Object.getPrototypeOf(x))`** giữ được class. `structuredClone` **không** làm
   được điều này — nó trả về object thường.
4. **Hàm giữ nguyên tham chiếu**, không clone. Đó là điều đúng: hàm không có state riêng.

Nhưng câu trả lời thực tế nhất: **dùng `structuredClone`** trừ khi bạn cần giữ class hoặc có hàm
trong dữ liệu. Tự viết deep clone trong production là dấu hiệu bạn đang giải sai bài toán.

</details>

### Bài 12 🖊 — `EventEmitter`

Viết `on`, `once`, `off`, `emit`, `listenerCount`.

<details><summary>Đáp án</summary>

```js
class EE {
  #m = new Map();

  on(t, f) {
    if (!this.#m.has(t)) this.#m.set(t, new Set());
    this.#m.get(t).add(f);
    return () => this.off(t, f);                      // ✅ trả hàm gỡ
  }

  once(t, f) {
    const g = (...a) => { this.off(t, g); f(...a) };
    g.goc = f;                                         // ✅ để off(t, f) gỡ được
    return this.on(t, g);
  }

  off(t, f) {
    const s = this.#m.get(t); if (!s) return;
    for (const g of s) if (g === f || g.goc === f) s.delete(g);
    if (!s.size) this.#m.delete(t);                    // ✅ dọn Map, tránh rò rỉ
  }

  emit(t, ...a) {
    const s = this.#m.get(t);
    if (!s) { if (t === 'error') throw a[0]; return false }    // ✅ 'error' đặc biệt
    for (const f of [...s]) f(...a);                   // ✅ chép ra trước khi lặp
    return true;
  }

  listenerCount(t) { return this.#m.get(t)?.size ?? 0 }
}
```

```
EE: on:1 | once:1 | on:2 | count: 1
sau khi gọi hàm gỡ: 0
off trong lúc emit: f1,f2          ← không bỏ sót nhờ chép [...s]
emit('error') không listener: throw "nổ"
```

Năm chi tiết phân biệt câu trả lời tốt:

1. **`Set` chứ không mảng** — `off` là O(1), và không đăng ký trùng.
2. **`for (const f of [...s])`** — chép ra trước khi lặp. Nếu một handler `off` handler khác
   trong lúc `emit`, lặp trực tiếp trên `Set` sẽ **bỏ sót**. Đo thật: chép ra cho `f1,f2`.
3. **`g.goc = f`** — `off(t, f)` phải gỡ được cả listener đã bọc bởi `once`.
4. **`emit('error')` không listener thì `throw`** — đúng hành vi Node. Mọi tên khác thì vô hại.
5. **`on` trả về hàm gỡ** — người dùng không cần giữ tham chiếu hàm để gỡ sau này.

Điểm cộng nếu nêu: listener `async` **nuốt lỗi**, vì `emit` gọi đồng bộ và bỏ giá trị trả về.

</details>

### Bài 13 — LRU cache

Viết `LRU(n)` trong dưới 15 dòng, `get`/`set` đều O(1).

<details><summary>Đáp án</summary>

Mẹo: `Map` của JavaScript **giữ thứ tự chèn**, và `delete` + `set` lại đưa khoá về cuối.

```js
class LRU {
  #max; #m = new Map();
  constructor(max) { this.#max = max }

  get(k) {
    if (!this.#m.has(k)) return undefined;
    const v = this.#m.get(k);
    this.#m.delete(k); this.#m.set(k, v);              // đưa lên "mới nhất"
    return v;
  }

  set(k, v) {
    if (this.#m.has(k)) this.#m.delete(k);
    this.#m.set(k, v);
    if (this.#m.size > this.#max) this.#m.delete(this.#m.keys().next().value);
  }

  keys() { return this.#m.keys() }
  get size() { return this.#m.size }
}
```

```js
const c = new LRU(3);
c.set('a',1); c.set('b',2); c.set('c',3);
c.get('a');            // 'a' thành mới nhất
c.set('d',4);          // đẩy 'b' ra
console.log([...c.keys()], c.get('b'), c.get('a'), c.size);
```

```
[ 'c', 'a', 'd' ] undefined 1 3
```

Chi tiết quan trọng: **`this.#m.keys().next().value`** lấy khoá đầu tiên mà **không tạo mảng**.
`[...map.keys()][0]` cũng đúng nhưng cấp phát mảng `n` phần tử mỗi lần `set` — biến `set` từ
O(1) thành O(n).

Nếu cần TTL: lưu `{ v, het: Date.now() + ttl }` và kiểm trong `get`. **Đừng** dùng `setTimeout`
cho từng mục — 10 000 mục là 10 000 timer.

</details>

### Bài 14 — `groupBy` tự viết, và bẫy của `Object.groupBy`

<details><summary>Đáp án</summary>

```js
const groupBy = (arr, f) => arr.reduce((a, x) => { const k = f(x); (a[k] ??= []).push(x); return a }, {});
```

```
tự viết        : {"le":[1,3],"chan":[2,4]}
Object.groupBy : {"le":[1,3],"chan":[2,4]}
```

Nội dung giống nhau, nhưng **prototype khác nhau**:

```
Object.getPrototypeOf(tự viết)        -> Object.prototype
Object.getPrototypeOf(Object.groupBy) -> null
```

Hệ quả: `kq.hasOwnProperty('le')` **ném `TypeError`** với `Object.groupBy`. Dùng
`Object.hasOwn(kq, 'le')` hoặc `'le' in kq`.

Prototype `null` thật ra là lựa chọn **đúng** của đặc tả: nếu key đến từ dữ liệu người dùng và có
ai đó nhóm theo `'constructor'` hay `'__proto__'`, bản tự viết bằng `{}` sẽ hành xử rất lạ.

Bản tự viết an toàn: `arr.reduce(..., Object.create(null))`.

`Map.groupBy` thì khoá là mọi kiểu — dùng nó khi nhóm theo object.

</details>

### Bài 15 🖊 — `flatten` sâu tuỳ ý

<details><summary>Đáp án</summary>

```js
const flat = (a, d = Infinity) =>
  d < 1 ? a.slice() : a.reduce((r, x) => r.concat(Array.isArray(x) ? flat(x, d - 1) : x), []);
```

```
flat([1,[2,[3,[4,[5]]]]])       -> [1,2,3,4,5]
flat([1,[2,[3,[4]]]], 2)        -> [1,2,3,[4]]
```

Bản không đệ quy (tránh tràn stack với mảng lồng 10 000 tầng):

```js
function flat(a) {
  const out = [], stack = [...a];
  while (stack.length) {
    const x = stack.pop();
    if (Array.isArray(x)) stack.push(...x);
    else out.push(x);
  }
  return out.reverse();
}
```

Trong code thật thì dùng `arr.flat(Infinity)` có sẵn. Bài này để kiểm tra bạn có nghĩ tới **độ
sâu** và **tràn stack** không.

</details>

---

## Nhóm D — DOM và trình duyệt

### Bài 16 — Event delegation cho danh sách động

Danh sách 10 000 dòng, mỗi dòng có nút Xoá và nút Sửa. Viết phần xử lý sự kiện.

<details><summary>Đáp án</summary>

```js
document.querySelector('#ds').addEventListener('click', (e) => {
  const btn = e.target.closest('button');          // ✅ closest, không dùng e.target
  if (!btn) return;
  const li = btn.closest('li');
  const id = Number(li.dataset.id);
  if (btn.matches('.xoa')) xoa(id);
  else if (btn.matches('.sua')) sua(id);
});
```

Ba lý do bắt buộc dùng `closest`:

1. Nếu nút chứa `<span>Xoá</span>` hoặc `<svg>`, `e.target` là phần tử con, không phải `<button>`.
2. Nó cho phép nút được render lại tuỳ ý mà logic không đổi.
3. Nó **tự động hoạt động với dòng mới thêm vào** — không cần gắn listener cho row vừa thêm.

Đo lợi ích: gắn 10 000 listener mất **3.30 ms**; một listener delegate mất **0.000 ms**. Nhưng
lợi ích lớn hơn là **bộ nhớ và việc gỡ**: 10 000 listener giữ 10 000 closure, và mỗi lần render
lại phải gỡ đủ 10 000 cái — quên là rò rỉ.

Nếu cần gỡ toàn bộ khi rời trang:

```js
const ac = new AbortController();
ds.addEventListener('click', handler, { signal: ac.signal });
// khi huỷ:
ac.abort();
```

</details>

### Bài 17 — Render 5000 dòng cho nhanh và an toàn

Dữ liệu có `ten` do người dùng nhập. Viết hàm render.

<details><summary>Đáp án</summary>

```js
function render(items) {
  const ds = document.querySelector('#ds');
  ds.replaceChildren(...items.map(i => {
    const li = document.createElement('li');
    li.dataset.id = i.id;
    li.textContent = i.ten;                    // ✅ không parse HTML -> không XSS
    const b = document.createElement('button');
    b.className = 'xoa'; b.textContent = 'Xoá';
    li.append(b);
    return li;
  }));
}
```

Đo bốn cách thêm 5000 node:

```
gom chuỗi rồi gán innerHTML 1 lần    1.9ms
append trực tiếp DOM                 3.4ms
DocumentFragment                     5.5ms      ← KHÔNG nhanh hơn
innerHTML += trong vòng lặp       7366.4ms      ← 3877× chậm hơn
```

Hai điều đáng nói ra:

1. **`DocumentFragment` không còn nhanh hơn** — lời khuyên đó đúng khoảng 2010. Chrome hiện đại
   gom thay đổi và chỉ tính layout khi cần.
2. **`innerHTML +=` chậm 3877 lần**, và tệ hơn cả tốc độ: mỗi vòng nó **xoá sạch node con rồi
   dựng lại**, phá mọi listener, trạng thái `<input>`, vị trí con trỏ, `<video>` đang phát.

Nếu thật sự cần 1.9 ms (đã đo và thấy nghẽn) thì phải escape:

```js
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
ds.innerHTML = items.map(i => `<li data-id="${esc(i.id)}">${esc(i.ten)}</li>`).join('');
```

Chênh lệch 1.5 ms không đáng để nhận rủi ro XSS.

</details>

### Bài 18 — Sửa layout thrashing

```js
function canDeu(els) {
  for (const el of els) {
    const rong = el.getBoundingClientRect().width;
    el.style.paddingLeft = (100 - rong) / 2 + 'px';
  }
}
```

<details><summary>Đáp án</summary>

```js
function canDeu(els) {
  const rongs = els.map(el => el.getBoundingClientRect().width);              // ĐỌC hết
  els.forEach((el, i) => el.style.paddingLeft = (100 - rongs[i]) / 2 + 'px'); // GHI hết
}
```

```
trước: 635.30ms
sau  :   1.20ms          ← 529× nhanh hơn
```

**Cơ chế:** trình duyệt xếp thay đổi style vào hàng đợi. Nhưng khi bạn **đọc** thuộc tính layout,
nó buộc phải tính ngay để trả số đúng (*forced synchronous layout*). Vòng lặp xen kẽ ép nó tính
lại 1000 lần.

Danh sách thuộc tính ép tính: `offsetTop/Left/Width/Height` · `scrollTop/Left/Width/Height` ·
`clientXxx` · `getBoundingClientRect()` · `getComputedStyle()` · `focus()` · `scrollIntoView()`.

Câu trả lời tốt nhất là hỏi ngược: **có cần JavaScript không?** Căn giữa này CSS làm được bằng
`display: grid; place-items: center` — 0 ms, và tự đúng khi kích thước đổi. Mỗi lần bạn thấy
mình đọc `getBoundingClientRect` để tính một giá trị CSS, hãy kiểm tra CSS đã có công cụ chưa.

</details>

### Bài 19 — Infinite scroll không dùng sự kiện `scroll`

<details><summary>Đáp án</summary>

```js
function infiniteScroll(container, taiThem) {
  const sentinel = document.createElement('div');
  sentinel.style.height = '1px';
  container.after(sentinel);

  let dangTai = false, conNua = true;

  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting || dangTai || !conNua) return;
    dangTai = true;
    try {
      if (await taiThem() === 0) { conNua = false; io.disconnect(); sentinel.remove() }
    } finally { dangTai = false }                    // ✅ lỗi không làm treo vĩnh viễn
  }, { rootMargin: '400px' });                       // ✅ tải trước khi thấy đáy

  io.observe(sentinel);
  return () => { io.disconnect(); sentinel.remove() };   // ✅ hàm dọn dẹp
}
```

Bốn chi tiết bắt buộc:

1. **Cờ `dangTai`** — không có nó, observer bắn nhiều lần trong lúc request đang bay và bạn tải
   trùng trang.
2. **`finally`** — nếu `taiThem()` ném lỗi mà cờ không reset, scroll chết vĩnh viễn.
3. **`rootMargin`** — tải trước, người dùng không thấy khoảng trống.
4. **Trả hàm dọn dẹp** — nếu không, observer giữ `sentinel` và `container` mãi mãi.

Vì sao không dùng `scroll`: sự kiện đó bắn hàng chục lần mỗi giây, và cách kiểm tra bên trong nó
(`getBoundingClientRect()` hoặc `scrollTop + clientHeight >= scrollHeight`) đều **ép tính
layout** — đúng cái bẫy ở bài 18, nhân với tần số cuộn.

</details>

---

## Nhóm E — Thấp tầng

### Bài 20 🖊 — `signal` / `effect` tối giản

Viết hệ reactive: đọc signal trong effect thì đăng ký phụ thuộc; ghi thì effect chạy lại.

<details><summary>Đáp án</summary>

```js
const nganXep = [];                       // ⚠ NGĂN XẾP, không phải một biến

function signal(v0) {
  let v = v0;
  const theoDoi = new Set();
  return {
    get value() {
      const hienTai = nganXep.at(-1);
      if (hienTai) theoDoi.add(hienTai);
      return v;
    },
    set value(x) {
      if (Object.is(x, v)) return;        // ⚠ Object.is, không phải ===
      v = x;
      for (const e of [...theoDoi]) e();  // chép ra: effect có thể tự huỷ
    },
  };
}

function effect(fn) {
  const chay = () => {
    nganXep.push(chay);
    try { fn() } finally { nganXep.pop() }   // ⚠ finally: fn ném lỗi thì stack vẫn sạch
  };
  chay();
}
```

Ba câu hỏi tiếp theo bạn sẽ bị hỏi:

**"Vì sao ngăn xếp, không phải một biến?"** — vì effect lồng nhau được. Với một biến, effect
trong ghi đè nó, và sau khi nó xong thì mọi signal đọc tiếp bị gán cho effect trong.

**"Vì sao `Object.is`?"** — `NaN → NaN` với `===` bị coi là thay đổi (vì `NaN === NaN` là
`false`) và render lại vô ích mỗi lần.

**"Còn thiếu gì?"** — ba thứ:

1. **Dọn phụ thuộc cũ trước mỗi lần chạy.** Phụ thuộc đổi theo nhánh: `co ? x.value : y.value`.
   Nếu `co` đổi từ `true` sang `false`, `x` vẫn nằm trong danh sách và mọi lần đổi `x` gây render
   vô ích mãi mãi.
2. **Gom cập nhật vào một microtask** — nếu không, ba lần ghi là ba lần render:
   ```js
   const choChay = new Set(); let daHen = false;
   function henLich(fn) {
     choChay.add(fn);
     if (daHen) return;
     daHen = true;
     queueMicrotask(() => { daHen = false; const dot = [...choChay]; choChay.clear(); for (const f of dot) f() });
   }
   ```
3. **Phát hiện vòng lặp vô hạn** — `effect(() => a.value = a.value + 1)` treo tab.

Bản đầy đủ có cả ba: [`du-an/mini-framework/src/reactive.js`](../du-an/mini-framework/src/reactive.js).

</details>

### Bài 21 — `reactive(obj)` bằng `Proxy`

<details><summary>Đáp án</summary>

```js
const mapProxy = new WeakMap(), mapTarget = new WeakMap(), sigCuaKhoa = new WeakMap();

function reactive(obj) {
  if (mapTarget.has(obj)) return obj;                 // đã là proxy
  if (mapProxy.has(obj)) return mapProxy.get(obj);    // ⚠ cùng target -> CÙNG proxy
  if (obj === null || typeof obj !== 'object') return obj;

  const lay = (t, k) => {
    let m = sigCuaKhoa.get(t); if (!m) { m = new Map(); sigCuaKhoa.set(t, m) }
    if (!m.has(k)) m.set(k, signal(t[k]));
    return m.get(k);
  };

  const proxy = new Proxy(obj, {
    get(t, k, r) {
      if (typeof k === 'symbol') return Reflect.get(t, k, r);   // ⚠ bỏ qua Symbol
      lay(t, k).value;                                          // đăng ký phụ thuộc
      const v = Reflect.get(t, k, r);                           // ⚠ Reflect + receiver
      return (v && typeof v === 'object') ? reactive(v) : v;    // lồng nhau
    },
    set(t, k, v, r) {
      const cu = t[k];
      const kq = Reflect.set(t, k, v, r);
      if (!Object.is(cu, v)) lay(t, k).value = v;
      return kq;
    },
  });

  mapProxy.set(obj, proxy); mapTarget.set(proxy, obj);
  return proxy;
}
```

Chạy thật:

```
1 gán .a         : a=1 | a=2
2 gán lồng nhau  : b=10 | b=20
3 cùng target -> cùng proxy: true
4 reactive(proxy) trả lại chính nó: true
5 await trên proxy: không nổ
6 JSON.stringify: {"a":1,"b":2}
```

Năm chi tiết bắt buộc, mỗi cái là một bug nếu thiếu:

1. **`mapProxy`** — không có nó, `reactive(o) === reactive(o)` là `false`, và `Set`/`includes` hỏng.
2. **`WeakMap` chứ không `Map`** — nếu không, mọi object từng đi qua `reactive()` sống mãi
   (đo: `Map` 103.9 MB vs `WeakMap` 7.3 MB).
3. **Bỏ qua `Symbol`** — nếu không, `await state` hỏi `state.then` và bạn tạo signal cho nó;
   `JSON.stringify` hỏi `toJSON`; `for...of` hỏi `Symbol.iterator`.
4. **`Reflect.get(t, k, r)` với receiver** — getter trong object phải chạy với `this` đúng.
5. **`Object.is`**.

Hai giới hạn còn lại, nên nêu ra:

- **`Map`/`Set` không chạy** — `reactive(new Map()).get('k')` ném
  `TypeError: Method Map.prototype.get called on incompatible receiver #<Map>`. Phải bind method
  về target thật. Đây chính xác là điều Vue 3 phải làm.
- **Thêm khoá mới không kích hoạt effect đọc `Object.keys`** — cần trap `ownKeys` và một signal
  riêng cho "danh sách khoá". Đây là lý do Vue 2 phải có `Vue.set()`.

Chi phí: `Proxy` đắt **gấp 4.2 lần** so với đọc thường (40.14 vs 9.52 ms cho 1 triệu lần đọc).
Đó là lý do Solid chọn `.value` tường minh.

</details>

### Bài 22 🖊 — Tìm rò rỉ trong component này

```js
class BieuDo {
  constructor(el, duLieu) {
    this.el = el;
    this.duLieu = duLieu;                       // 50 MB
    this.veLai = this.veLai.bind(this);
    window.addEventListener('resize', this.veLai);
    this.timer = setInterval(() => this.lamMoi(), 5000);
    this.observer = new IntersectionObserver(() => this.veLai());
    this.observer.observe(el);
  }
  destroy() { window.removeEventListener('resize', this.veLai) }
}
```

<details><summary>Đáp án</summary>

`destroy()` gỡ đúng **một** trong **ba** thứ.

```js
destroy() {
  window.removeEventListener('resize', this.veLai);
  clearInterval(this.timer);          // ⚠ thiếu — timer chạy mãi và giữ `this`
  this.observer.disconnect();         // ⚠ thiếu — observer giữ `el` và giữ `this`
  this.el = null; this.duLieu = null; // tuỳ chọn, cắt sớm cho chắc
}
```

`removeEventListener` ở đây **đúng**, vì `this.veLai` đã bind **một lần** trong constructor và
được lưu lại. Nếu constructor viết `addEventListener('resize', this.veLai.bind(this))` thì
`destroy` **không gỡ được gì** — mỗi `bind` tạo một hàm mới.

Bản viết lại bằng `AbortController`, không thể quên:

```js
class BieuDo {
  #ac = new AbortController();
  constructor(el, duLieu) {
    this.el = el; this.duLieu = duLieu;
    const { signal } = this.#ac;
    window.addEventListener('resize', () => this.veLai(), { signal });
    this.observer = new IntersectionObserver(() => this.veLai());
    this.observer.observe(el);
    this.timer = setInterval(() => this.lamMoi(), 5000);
    signal.addEventListener('abort', () => {
      this.observer.disconnect();
      clearInterval(this.timer);
    }, { once: true });
  }
  destroy() { this.#ac.abort() }        // một lệnh, dọn hết
}
```

⚠️ Lưu ý runtime: `setInterval(..., { signal })` là API của **Node**, trình duyệt chưa hỗ trợ —
nên phải nối vào `signal.addEventListener('abort', ...)` như trên.

Đo chi phí của việc quên gỡ: 50 component không gỡ listener làm heap tăng **+9.54 MB**; gỡ đúng
thì **+0.00 MB**.

</details>

---

Tiếp: [12 tình huống debug](./03-tinh-huong-debug.md) · [Checklist 109 mục](./04-tu-kiem-tra.md)
