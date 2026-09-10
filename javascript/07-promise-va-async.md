# Bài 07 — Promise và async/await

> `async/await` là generator + promise được đóng gói lại. Bài này mổ nó ra, rồi đi qua bốn
> combinator, `AbortController`, và bốn kiểu **nuốt lỗi im lặng** — loại bug tốn nhiều giờ
> nhất trong code bất đồng bộ.

---

## 1. Promise có ba trạng thái, chuyển đúng một lần

`pending` → `fulfilled` **hoặc** `rejected`. Đã chuyển thì vĩnh viễn.

```js
const p = new Promise((res, rej) => { res('A'); res('B'); rej(new Error('C')) });
p.then(v => console.log('kết quả:', v)).catch(e => console.log('lỗi:', e.message));
```

```
kết quả: A
```

`res('B')` và `rej(...)` bị **bỏ qua hoàn toàn**, không lỗi, không cảnh báo. Đây là lý do mẫu
dưới đây an toàn:

```js
function timeout(ms, p) {
  return new Promise((res, rej) => {
    const id = setTimeout(() => rej(new Error('hết giờ')), ms);
    p.then(res, rej).finally(() => clearTimeout(id));   // ai xong trước thì thắng
  });
}
```

---

## 2. `async function` luôn trả về promise — kể cả khi bạn `return` số

```js
async function f() { return 1 }
console.log(f());
console.log(f() instanceof Promise);
```

```
Promise { 1 }
true
```

Và `throw` trong `async function` biến thành **rejected promise**, không phải exception đồng
bộ:

```js
async function g() { throw new Error('nổ') }
try { g() } catch (e) { console.log('bắt được?', e.message) }
console.log('không bắt được — hàm đã trả về promise rồi');
```

```
không bắt được — hàm đã trả về promise rồi

Error: nổ
    at g (file:///.../pv.mjs:7:26)
Node.js v22.23.2                    ← tiến trình BỊ GIẾT
```

Hai chuyện xảy ra: `catch` không chạy (như dự đoán), **và** Node kết thúc tiến trình với mã
lỗi 1 vì promise reject không ai xử lý. Ở frontend thì chỉ có một dòng đỏ trong console — nên
loại bug này sống rất lâu trong code trình duyệt.

`try/catch` đồng bộ **không** bắt được lỗi từ `async function` nếu bạn không `await`. Đây là
nguồn của kiểu bug số 1 ở mục 6.

---

## 3. Bốn combinator: chọn cái nào

Đo thật cả bốn, với một nhánh hỏng ở 10 ms và các nhánh khác xong ở 30–50 ms:

```js
const sleep = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));
const fail  = (ms, v) => new Promise((_, j) => setTimeout(() => j(new Error(v)), ms));
```

```
all       : ❌ Error: BOOM                                            (11ms)
allSettled: ✅ ["fulfilled","rejected"]                               (31ms)
race      : ❌ Error: BOOM                                            (11ms)
any       : ✅ "a"                                                    (32ms)
any all-fail: ❌ AggregateError: All promises were rejected
              | errors: e1,e2                                          (21ms)
```

| Combinator | Xong khi | Kết quả |
|---|---|---|
| `all` | **tất cả** thành công, hoặc **một** thất bại | mảng giá trị / lỗi đầu tiên |
| `allSettled` | **tất cả** kết thúc, dù thế nào | mảng `{status, value \| reason}` — **không bao giờ reject** |
| `race` | **một cái bất kỳ** kết thúc trước | giá trị hoặc lỗi của cái đó |
| `any` | **một cái bất kỳ thành công** | giá trị đó, hoặc `AggregateError` nếu tất cả hỏng |

Chú ý `all` trả về sau **11 ms** — nó reject ngay khi nhánh đầu tiên hỏng, **không chờ** hai
nhánh còn lại. Chúng vẫn chạy tiếp trong nền, chỉ là bạn không thấy kết quả.

`AggregateError` có thuộc tính `.errors` là **mảng** mọi lỗi:

```js
try { await Promise.any([...]) } catch (e) { console.log(e.errors.map(x => x.message)) }
```

### Chọn nhanh

- Gọi 5 API, cần đủ cả 5 → `all`.
- Gọi 5 API, thiếu vài cái vẫn hiển thị được → `allSettled` (đây là cái bạn cần trong 80%
  dashboard).
- 3 CDN, lấy cái nhanh nhất → `any` (không phải `race` — `race` thua nếu CDN nhanh nhất lỗi 500).
- Đặt hạn giờ cho một việc → `race`.

---

## 4. Chạy tuần tự hay song song: chỗ `await` quyết định

```js
// Tuần tự — 3 lần chờ nối đuôi
const a = await layA();
const b = await layB();
const c = await layC();

// Song song — 1 lần chờ
const [a, b, c] = await Promise.all([layA(), layB(), layC()]);
```

Đo thật với ba việc I/O, mỗi việc ~200 ms:

```
tuần tự (await từng cái)      : 608ms
song song (Promise.all)       : 202ms
```

Nhưng bẫy ngược lại cũng có thật. Đoạn dưới **trông như** tuần tự mà thực ra đã chạy song song:

```js
const pA = layA();          // ⚠ đã khởi động rồi
const pB = layB();          // ⚠ đã khởi động rồi
const a = await pA;
const b = await pB;
```

Promise **chạy ngay khi được tạo**, không phải khi được `await`. Nếu `layB()` chỉ nên chạy khi
`layA()` thành công, viết như trên là sai nghiệp vụ — và nếu `pB` reject trước khi bạn `await`
nó, bạn còn dính `unhandledRejection`.

### `for await` không phải song song

```js
for await (const r of ids.map(id => layChiTiet(id))) { ... }
```

`ids.map(...)` khởi động **tất cả** ngay lập tức. Nếu có 5000 id, bạn vừa bắn 5000 request
cùng lúc. `for await` chỉ điều tiết việc **đọc kết quả**, không điều tiết việc **gửi đi**.

Muốn giới hạn số việc chạy đồng thời, xem bài tập 2.

---

## 5. `AbortController`: huỷ việc đang chạy

```js
const ac = new AbortController();
setTimeout(() => ac.abort(), 100);
await fetch('/cham', { signal: ac.signal });
```

```
ac.abort()               -> DOMException name="AbortError"   message="signal is aborted without reason"  sau 102ms
AbortSignal.timeout(150) -> DOMException name="TimeoutError"  message="signal timed out"                 sau 151ms
abort(lý do tuỳ chỉnh)   -> Error: "lý do riêng"
```

Ba điều cần nhớ:

1. **`abort()` không có tham số cho `AbortError`**, có tham số thì cho đúng object bạn truyền.
   Nên phân biệt bằng `e.name`, đừng phân biệt bằng `instanceof`.
2. **`AbortSignal.timeout(ms)`** cho `TimeoutError` chứ không phải `AbortError` — nếu bạn chỉ
   `if (e.name === 'AbortError')` thì hết giờ sẽ bị coi là lỗi thật.
3. `AbortSignal.any([s1, s2])` gộp nhiều tín hiệu — dùng khi vừa có timeout vừa có nút "huỷ".

Cả ba đều có trên Node 22 và Chrome 152:

```
AbortSignal.timeout -> function
AbortSignal.any     -> function
```

Cách nối `signal` vào hàm tự viết:

```js
function viecCuaBan(ms, signal) {
  return new Promise((res, rej) => {
    signal?.throwIfAborted();                     // đã huỷ từ trước thì nổ ngay
    const id = setTimeout(() => res('xong'), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(id);
      rej(signal.reason);                         // ← truyền nguyên lý do
    }, { once: true });
  });
}
```

`{ once: true }` quan trọng — không có nó, listener tích tụ trên signal dùng lại nhiều lần.

---

## 6. Bốn kiểu nuốt lỗi im lặng

### Kiểu 1 — gọi `async function` mà không `await`

```js
async function luu() { throw new Error('DB chết') }

function xuLy() {
  luu();                    // ⚠ không await, không .catch
  return 'OK';
}
```

Hàm trả về `'OK'`, người dùng thấy thành công, dữ liệu không được lưu. Node in
`UnhandledPromiseRejection` rồi (từ Node 15) **giết tiến trình**; trình duyệt chỉ ghi vào
console.

Nếu cố tình không chờ, phải nói rõ ý định:

```js
void luu().catch(err => logger.error(err));      // "bắn rồi quên" có kiểm soát
```

### Kiểu 2 — `forEach` với callback `async`

```js
items.forEach(async (item) => { await luu(item) });
console.log('xong');            // in ngay, chưa lưu cái nào
```

`forEach` **không** biết gì về promise. Nó gọi callback, nhận về một promise, rồi vứt đi. Lỗi
trong đó cũng bị vứt luôn.

```js
await Promise.all(items.map(item => luu(item)));    // ✅
for (const item of items) await luu(item);          // ✅ nếu cần tuần tự
```

### Kiểu 3 — `catch` đặt sai chỗ

```js
layDuLieu()
  .catch(e => console.error(e))    // bắt lỗi của layDuLieu
  .then(data => data.items);       // ⚠ chạy CẢ KHI có lỗi, data là undefined
```

Sau `.catch(...)` mà không `throw` lại, chuỗi quay về trạng thái **fulfilled** với giá trị
`undefined`. Dòng `.then` tiếp theo vẫn chạy và ném `TypeError: Cannot read properties of
undefined`.

Đặt `.catch` **cuối chuỗi**, hoặc `throw` lại trong đó.

### Kiểu 4 — lỗi bị `race`/`all` bỏ lại phía sau

```js
Promise.race([sleep(5, 'nhanh'), fail(20, 'CHẬM-NHƯNG-VẪN-NỔ')]).then(v => console.log(v));
```

```
race trả về: nhanh
```

Và **không** có `unhandledRejection` nào được in ra. Đây là điểm nhiều người hiểu sai: `race`
đã gắn handler lên **cả hai** promise, nên nhánh thua vẫn được coi là "đã xử lý". Lỗi của nó
biến mất hoàn toàn — không log, không cảnh báo.

Nếu nhánh thua là một request quan trọng, bạn sẽ không bao giờ biết nó hỏng. Muốn thấy thì
phải tự gắn:

```js
const cham = fail(20, 'x');
cham.catch(e => logger.warn('nhánh thua cũng lỗi:', e.message));
await Promise.race([sleep(5), cham]);
```

---

## 7. Bài tập

### Bài 1 — Sửa hàm retry

Hàm dưới có **ba** lỗi. Tìm và sửa.

```js
async function thuLai(fn, lan = 3) {
  for (let i = 0; i < lan; i++) {
    try {
      return fn();
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
```

<details><summary>Gợi ý đáp án</summary>

**Lỗi 1 — `return fn()` không `await`.** Promise được trả về ngay; nếu nó reject thì lỗi
xảy ra ở **ngoài** `try`, nên `catch` không bắt được và không có lần thử lại nào.

**Lỗi 2 — thất bại lần cuối trả về `undefined`.** Hết vòng lặp mà chưa thành công, hàm rơi
xuống cuối và trả `undefined`. Người gọi tưởng thành công với dữ liệu rỗng.

**Lỗi 3 — chờ cố định 1000 ms.** Nếu server đang quá tải, 3 client cùng thử lại đúng cùng lúc
sẽ đánh sập nó tiếp (thundering herd).

```js
async function thuLai(fn, { lan = 3, cho = 300, signal } = {}) {
  let loiCuoi;
  for (let i = 0; i < lan; i++) {
    signal?.throwIfAborted();
    try {
      return await fn();                       // ✅ await
    } catch (e) {
      loiCuoi = e;
      if (i === lan - 1) break;                // lần cuối thì khỏi chờ
      const delay = cho * 2 ** i * (0.5 + Math.random());   // ✅ tăng dần + nhiễu
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw loiCuoi;                               // ✅ ném lỗi thật ra ngoài
}
```

Thêm hai thứ đáng có: `signal` để huỷ được, và **không chờ sau lần thử cuối** (chờ rồi mới
báo lỗi là 300 ms lãng phí).

Nên thêm nữa: chỉ thử lại với lỗi **có thể thử lại được**. Thử lại một lỗi `400 Bad Request`
là vô nghĩa.

```js
if (e.status && e.status < 500 && e.status !== 429) throw e;   // lỗi phía client, đừng thử lại
```

</details>

### Bài 2 — Giới hạn số việc chạy đồng thời

Viết `pLimit(n)` trả về hàm bọc, sao cho không bao giờ có quá `n` việc chạy cùng lúc.

```js
const limit = pLimit(2);
const kq = await Promise.all(ids.map(id => limit(() => tai(id))));
```

<details><summary>Gợi ý đáp án</summary>

```js
function pLimit(n) {
  let dangChay = 0;
  const hangDoi = [];

  const tiepTheo = () => {
    if (dangChay >= n || hangDoi.length === 0) return;
    dangChay++;
    const { fn, res, rej } = hangDoi.shift();
    Promise.resolve()
      .then(fn)                      // ✅ bọc để fn ném đồng bộ cũng thành reject
      .then(res, rej)
      .finally(() => { dangChay--; tiepTheo() });
  };

  return fn => new Promise((res, rej) => { hangDoi.push({ fn, res, rej }); tiepTheo() });
}
```

Kiểm chứng bằng cách đếm số việc chạy đồng thời:

```js
let dangChay = 0, dinh = 0;
const viec = () => new Promise(r => {
  dinh = Math.max(dinh, ++dangChay);
  setTimeout(() => { dangChay--; r() }, 50);
});

const limit = pLimit(3);
const t0 = Date.now();
await Promise.all(Array.from({ length: 10 }, () => limit(viec)));
console.log('đỉnh đồng thời:', dinh, '| tổng thời gian:', Date.now() - t0, 'ms');
```

```
đỉnh đồng thời: 3 | tổng thời gian: 208 ms
```

10 việc × 50 ms, chạy 3 một lúc → 4 đợt × 50 ms ≈ 200 ms. Khớp.

Ba chi tiết dễ bỏ sót:

1. **`Promise.resolve().then(fn)`** thay vì `fn()` — nếu `fn` ném lỗi **đồng bộ**, gọi thẳng
   sẽ làm nổ `tiepTheo()` và bộ đếm `dangChay` không bao giờ giảm → treo vĩnh viễn.
2. **`.finally`** chứ không phải `.then` — phải giảm bộ đếm cả khi lỗi.
3. Gọi `tiepTheo()` **trong** `finally`, không phải trong vòng lặp — đó là thứ giữ cho hàng
   đợi luôn chảy.

</details>

### Bài 3 — Vì sao lỗi này không bao giờ được log

```js
async function taiTatCa(ids) {
  const ket_qua = [];
  for (const id of ids) {
    tai(id).then(r => ket_qua.push(r));
  }
  return ket_qua;
}

const r = await taiTatCa([1, 2, 3]);
console.log(r.length);
```

In ra gì? Nếu `tai(2)` lỗi thì chuyện gì xảy ra?

<details><summary>Gợi ý đáp án</summary>

In ra **`0`**.

`return ket_qua` chạy ngay khi vòng lặp kết thúc — tức là ngay sau khi ba promise được
**khởi động**, trước khi bất kỳ cái nào xong. `await` ở dòng dưới không giúp gì, vì
`taiTatCa` không chờ cái gì cả (nó là `async` nên trả về promise, nhưng promise đó resolve
ngay lập tức với mảng rỗng).

Nếu `tai(2)` lỗi: không có `.catch` nào trên chuỗi đó → `unhandledRejection`. Trong Node từ
bản 15, mặc định là **giết tiến trình**:

```
[UnhandledPromiseRejection: This error originated either by throwing inside of an async
function without a catch block, or by rejecting a promise which was not handled with .catch()]
```

Trong trình duyệt thì chỉ ghi console — nên bug này sống rất lâu ở frontend.

Bản sửa:

```js
async function taiTatCa(ids) {
  return Promise.all(ids.map(id => tai(id)));
}
```

Nếu muốn một cái lỗi không kéo đổ cả mẻ:

```js
async function taiTatCa(ids) {
  const kq = await Promise.allSettled(ids.map(id => tai(id)));
  for (const x of kq) if (x.status === 'rejected') logger.warn(x.reason);
  return kq.filter(x => x.status === 'fulfilled').map(x => x.value);
}
```

</details>

---

**Tiếp theo:** [Bài 08 — Bộ nhớ và rò rỉ](./08-bo-nho-va-ro-ri.md)
