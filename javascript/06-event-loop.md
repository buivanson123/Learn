# Bài 06 — Event loop

> Đây là bài quan trọng nhất trong bộ. Gần như mọi bug "chạy sai thứ tự", "state cũ", "UI đơ",
> "test lúc xanh lúc đỏ" đều quy về nội dung bài này.

---

## 1. Một vòng lặp, hai loại hàng đợi

JavaScript chạy trên **một** luồng. Mọi thứ xếp hàng:

```
┌──────────────────────────────────────────────────┐
│  Chạy hết code đồng bộ hiện tại (call stack)     │
└────────────────────┬─────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────┐
│  Vét SẠCH hàng đợi microtask                     │  ← .then, await, queueMicrotask
│  (kể cả microtask mới sinh ra trong lúc vét)     │     MutationObserver
└────────────────────┬─────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────┐
│  Lấy MỘT macrotask rồi quay lại bước 1           │  ← setTimeout, setInterval
│                                                   │     I/O, sự kiện DOM
└──────────────────────────────────────────────────┘
```

Từ khoá là **"vét sạch"** so với **"lấy một"**. Nó giải thích mục 4 và mục 5.

---

## 2. Đo thứ tự thật

```js
const log = [];
log.push('1 đồng bộ — đầu file');
setTimeout(() => log.push('T1 setTimeout 0'), 0);
setImmediate(() => log.push('I1 setImmediate'));
Promise.resolve().then(() => log.push('P1 .then'));
queueMicrotask(() => log.push('Q1 queueMicrotask'));
process.nextTick(() => log.push('N1 process.nextTick'));
(async () => { log.push('2 phần đồng bộ của async fn'); await null; log.push('P2 sau await'); })();
log.push('3 đồng bộ — cuối file');
setTimeout(() => console.log(log.join('\n')), 10);
```

Chạy file này **hai lần**, chỉ đổi đuôi file — nội dung y hệt nhau:

```
$ node el.cjs                          $ node el.mjs
1 đồng bộ — đầu file                   1 đồng bộ — đầu file
2 phần đồng bộ của async fn            2 phần đồng bộ của async fn
3 đồng bộ — cuối file                  3 đồng bộ — cuối file
N1 process.nextTick        ←────┐      P1 .then
P1 .then                        │      Q1 queueMicrotask
Q1 queueMicrotask               │      P2 sau await
P2 sau await                    └────→ N1 process.nextTick
T1 setTimeout 0                        I1 setImmediate
I1 setImmediate                        T1 setTimeout 0
```

**`process.nextTick` đổi chỗ giữa CJS và ESM.** Cùng một file, khác đuôi, khác thứ tự.

Lý do: Node đánh giá module ESM **bên trong một microtask** (vì ESM hỗ trợ top-level await nên
toàn bộ quá trình nạp là bất đồng bộ). Khi thân module chạy, hàng đợi microtask đang được vét
dở, nên `nextTick` bị xếp sau đợt vét đó. Với CJS, thân module chạy đồng bộ nên `nextTick`
giữ đúng ưu tiên cao nhất của nó.

Nếu code của bạn phụ thuộc vào thứ tự này, nó sẽ vỡ vào ngày ai đó chuyển dự án sang ESM.
**Đừng bao giờ dựa vào `nextTick` vs `then` để đồng bộ hoá.**

### Ba điều rút ra

1. **Phần đồng bộ của `async function` chạy ngay.** Dòng `2` in **trước** dòng `3`. `async`
   không có nghĩa là "chạy sau"; nó chỉ có nghĩa là "có thể tạm dừng ở `await`".
2. **Toàn bộ microtask chạy trước mọi macrotask.** `P1/Q1/P2` luôn trước `T1/I1`, ở cả hai cột.
3. `setTimeout` và `setImmediate` đổi chỗ nhau — xem mục tiếp.

---

## 3. `setTimeout(f, 0)` vs `setImmediate(f)`: kết quả **không xác định**

Chạy 10 lần cùng một file, ở phạm vi module chính:

```
$ for i in $(seq 1 10); do node t4.js; done
setTimeout
setImmediate
setImmediate
setImmediate
setImmediate
setImmediate
setImmediate
setImmediate
setImmediate
setImmediate
```

Lần đầu ra `setTimeout`, chín lần sau ra `setImmediate`. Đây **không phải bug** — kết quả phụ
thuộc vào việc tiến trình khởi động mất bao lâu so với ngưỡng 1 ms của timer. Nếu vòng lặp
vào pha `timers` khi đồng hồ đã nhích qua 1 ms, timer chạy trước; ngược lại nó phải chờ hết
một vòng.

Nhưng bên trong một callback I/O thì kết quả **luôn xác định**:

```js
fs.readFile(__filename, () => {
  setTimeout(() => console.log('setTimeout'), 0);
  setImmediate(() => console.log('setImmediate'));
});
```

```
setImmediate     ← 5/5 lần
```

Vì lúc đó vòng lặp đang ở pha `poll`, và pha `check` (nơi `setImmediate` chạy) đến **ngay
sau**, còn `timers` phải chờ hết một vòng nữa.

**Kết luận thực dụng:** trong Node, muốn "chạy sau khi nhả luồng một nhịp" thì dùng
`setImmediate`, không dùng `setTimeout(f, 0)`.

---

## 4. Microtask có thể **bỏ đói** macrotask

Đây là hệ quả trực tiếp của "vét sạch".

```js
let n = 0;
const t0 = Date.now();
setTimeout(() => console.log('setTimeout chạy sau', Date.now() - t0, 'ms, n =', n), 0);

function loop() { if (n++ < 1e6) queueMicrotask(loop); }
queueMicrotask(loop);
```

```
setTimeout chạy sau 137 ms, n = 1000001
```

`setTimeout(…, 0)` phải chờ **137 ms**. Vì mỗi microtask lại đẻ ra một microtask mới, hàng đợi
không bao giờ rỗng, và event loop **không được phép** sang bước tiếp theo.

Trong trình duyệt, hậu quả là trang **đơ hoàn toàn**: không render, không nhận click, không
scroll. Và không có gì trong DevTools chỉ thẳng vào nguyên nhân — CPU không cao bất thường,
call stack không sâu, không có hàm nào "chậm".

### Nó xảy ra trong code thật khi nào

Đệ quy qua promise mà không có điểm nhả:

```js
async function xuLyHangDoi() {
  const viec = hangDoi.shift();
  if (!viec) return;
  await lam(viec);            // nếu lam() resolve đồng bộ, đây chỉ là 1 microtask
  return xuLyHangDoi();       // ⚠ đệ quy vô hạn trong microtask
}
```

Nếu `lam()` trả về promise đã resolve sẵn (ví dụ có cache), vòng này chạy hết 100 000 việc mà
không nhả luồng lần nào. Nghiệt ở chỗ: khi test với dữ liệu thật (có gọi mạng) thì nó chạy
tốt, chỉ **đơ khi cache nóng**.

**Cách sửa** — chèn một macrotask định kỳ:

```js
async function xuLyHangDoi() {
  let i = 0;
  while (hangDoi.length) {
    await lam(hangDoi.shift());
    if (++i % 100 === 0) await new Promise(r => setTimeout(r, 0));   // nhả luồng
  }
}
```

Trong trình duyệt, Chrome 152 có sẵn công cụ đúng cho việc này:

```js
if (++i % 100 === 0) await scheduler.yield();
```

```
typeof scheduler.yield  ->  "function"   (Chrome 152)
typeof scheduler        ->  "undefined"  (Node 22)
```

`scheduler.yield()` nhả luồng nhưng giữ **ưu tiên cao** khi quay lại, nên nó không bị đẩy
xuống cuối hàng như `setTimeout(0)`.

---

## 5. `await` tốn bao nhiêu nhịp

```js
const log = [];
async function f() { await Promise.resolve(); log.push('await Promise.resolve') }
async function g() { await { then(r) { r() } }; log.push('await thenable') }
async function h() { await 1; log.push('await 1') }
f(); g(); h();
Promise.resolve().then(() => log.push('tick1')).then(() => log.push('tick2'))
                 .then(() => log.push('tick3')).then(() => log.push('tick4'))
                 .then(() => console.log(log.join('\n')));
```

```
await Promise.resolve
await 1
tick1
await thenable
tick2
tick3
tick4
```

| Chờ cái gì | Số nhịp microtask |
|---|---|
| `await 1` (giá trị thường) | 1 |
| `await Promise.resolve()` (promise native) | 1 |
| `await thenable` (object tự viết có `.then`) | 2 |

`await` một promise thật và `await` một giá trị thường tốn **như nhau** — V8 đã tối ưu từ
2018. Đừng tin bài viết cũ nói `await promise` tốn 3 nhịp; con số đó đúng cho V8 trước
phiên bản 7.2.

Nhưng **thenable vẫn tốn thêm một nhịp**, vì đặc tả bắt buộc bọc nó vào một promise thật rồi
mới chờ. Nếu bạn dùng thư viện promise cũ (Bluebird, jQuery Deferred) hoặc một object tự viết
có `.then`, mọi `await` lên nó chậm hơn một nhịp — và thứ tự với code khác thay đổi theo.

Chi tiết `.then` được gọi thế nào ở [bài 07](./07-promise-va-async.md).

---

## 6. Trong trình duyệt: microtask, render, `requestAnimationFrame`

Thứ tự trong một khung hình:

```
macrotask (ví dụ: xử lý click)
  → vét sạch microtask
  → requestAnimationFrame callbacks
  → tính style → layout → paint          ← khung hình lên màn hình ở đây
  → requestIdleCallback (nếu còn thời gian trong khung)
```

Hệ quả đo được: một vòng lặp chặn 372 ms khiến trình duyệt **không vẽ được khung nào**.

```
mốc         : 30 khung / 500ms khi rảnh
chạy sync trên main thread: 372ms — vẽ được  0 khung
chạy trong Worker         : 409ms — vẽ được 26 khung
```

Chú ý Worker **chậm hơn** (409 so với 372 ms) vì có chi phí khởi tạo và truyền message —
nhưng người dùng thấy trang vẫn mượt. Đây là đánh đổi đúng trong hầu hết trường hợp: tổng
thời gian tăng 10%, độ mượt từ 0 lên 26 khung.

Chi tiết Worker ở [bài 12](./12-browser-api.md).

---

## 7. Bài tập

### Bài 1 — Xếp thứ tự

Không chạy code, viết ra thứ tự các chữ được in:

```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => { console.log('C'); setTimeout(() => console.log('D'), 0) });
(async () => { console.log('E'); await null; console.log('F') })();
queueMicrotask(() => console.log('G'));
console.log('H');
```

<details><summary>Gợi ý đáp án</summary>

```
A E H C F G B D
```

Lần theo:

1. **Đồng bộ:** `A`, rồi phần đồng bộ của async IIFE là `E`, rồi `H`.
2. **Vét microtask** theo đúng thứ tự chúng được xếp hàng: `.then` cho `C` (và nó *xếp thêm*
   một `setTimeout D`), rồi phần sau `await` cho `F`, rồi `queueMicrotask` cho `G`.
3. **Macrotask** theo thứ tự xếp: `B` (xếp lúc chạy đồng bộ), rồi `D` (xếp lúc chạy microtask `C`).

Chỗ dễ sai nhất là `E` — nhiều người đặt nó sau `H` chỉ vì thấy chữ `async`.

Chỗ dễ sai thứ hai là `D`: nó ở cuối chứ không phải ngay sau `C`, vì `C` chạy trong microtask
còn `D` là macrotask được xếp **sau** `B`.

</details>

### Bài 2 — Vì sao thanh tiến trình đứng im

```js
async function nhap(items) {
  for (let i = 0; i < items.length; i++) {
    await luuVaoIndexedDB(items[i]);
    thanhTienTrinh.style.width = (i / items.length * 100) + '%';
  }
}
```

Với 50 000 item, thanh tiến trình nhảy thẳng từ 0% lên 100% khi xong. Vì sao, và sửa thế nào?

<details><summary>Gợi ý đáp án</summary>

Nếu `luuVaoIndexedDB` resolve trong cùng một nhịp microtask (dữ liệu nhỏ, IndexedDB gộp
transaction), cả 50 000 vòng lặp chạy hết trong **một** lần vét microtask. Trình duyệt chưa
bao giờ tới bước "tính style → layout → paint", nên `style.width` bị ghi 50 000 lần mà không
lần nào lên màn hình.

Sửa: nhả luồng cho trình duyệt vẽ.

```js
async function nhap(items) {
  for (let i = 0; i < items.length; i++) {
    await luuVaoIndexedDB(items[i]);
    if (i % 200 === 0) {
      thanhTienTrinh.style.width = (i / items.length * 100) + '%';
      await new Promise(r => requestAnimationFrame(r));   // đợi đúng 1 khung hình
      // trên Chrome 152:  await scheduler.yield();
    }
  }
  thanhTienTrinh.style.width = '100%';
}
```

Hai cải tiến trong bản sửa:

- **Nhả luồng** — bắt buộc, nếu không thì không có khung hình nào.
- **Chỉ ghi DOM mỗi 200 item** — ghi 50 000 lần là lãng phí vì mắt chỉ thấy được khoảng 60
  lần mỗi giây.

`requestAnimationFrame` đúng hơn `setTimeout(0)` ở đây, vì nó bảo đảm bạn được đánh thức
**ngay trước** lần vẽ tiếp theo, không sớm hơn cũng không muộn hơn.

</details>

### Bài 3 — Test lúc xanh lúc đỏ

Test này thỉnh thoảng đỏ. Vì sao, và sửa thế nào **không dùng** `setTimeout`?

```js
it('cập nhật state', () => {
  const store = taoStore();
  store.dispatch({ type: 'TANG' });        // bên trong có await
  expect(store.getState().count).toBe(1);
});
```

<details><summary>Gợi ý đáp án</summary>

`dispatch` có `await` bên trong, nên phần cập nhật `count` nằm trong một microtask. Dòng
`expect` chạy **đồng bộ ngay sau** `dispatch`, tức là trước khi microtask kịp chạy.

Nó "thỉnh thoảng" xanh vì với một số đường đi trong reducer (ví dụ có cache) không có `await`
nào thật sự, nên cập nhật xảy ra đồng bộ.

Cách sửa **sai** mà nhiều người dùng:

```js
await new Promise(r => setTimeout(r, 0));    // đợi bừa, chậm và vẫn có thể thiếu
```

Ba cách sửa đúng, theo thứ tự ưu tiên:

```js
// 1. Tốt nhất: dispatch trả về promise, thì await nó
await store.dispatch({ type: 'TANG' });

// 2. Nếu không sửa được API: đợi vét hết microtask hiện có
await Promise.resolve();          // đủ nếu chỉ 1 nhịp
await null;                        // tương đương

// 3. Chắc chắn hơn: đợi qua một macrotask, vét sạch mọi microtask lồng nhau
await new Promise(r => setImmediate(r));    // Node
await new Promise(r => requestAnimationFrame(r));  // trình duyệt
```

Cách 2 chỉ vét **một** nhịp. Nếu bên trong có `await thenable` (mục 5 — tốn 2 nhịp) hoặc
`await` lồng nhau, bạn cần cách 3.

Bài học chung: đừng đoán số nhịp. Sửa API để nó trả về promise là cách duy nhất không mong
manh.

</details>

---

**Tiếp theo:** [Bài 07 — Promise và async/await](./07-promise-va-async.md)
