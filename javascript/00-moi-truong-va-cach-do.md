# Bài 00 — Chỗ thí nghiệm và cách đo cho đúng

> Mục tiêu: sau bài này bạn có thể tự kiểm chứng **mọi** khẳng định trong 17 bài còn lại, và
> quan trọng hơn — biết khi nào phép đo của mình đang nói dối.

---

## 1. Máy đang chạy cái gì

```
$ node -e "console.log('Node', process.version, '| V8', process.versions.v8)"
Node v22.23.2 | V8 12.4.254.21-node.56
```

Con số `12.4` quan trọng hơn `v22.23.2`. V8 là thứ quyết định **cú pháp nào parse được** và
**API nào tồn tại**. Node chỉ đóng gói nó lại.

Chrome trên máy này dùng V8 mới hơn nhiều:

```
$ node do/kiem-tinh-nang-chrome.cjs
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)
HeadlessChrome/152.0.0.0 Safari/537.36
```

Hệ quả cụ thể: `Temporal` chạy trong Chrome, không chạy trong Node. Xem bài 10.

---

## 2. Dựng chỗ thí nghiệm

```bash
cd javascript/do
npm install
```

`package.json` chỉ có đúng một phụ thuộc:

```json
{ "dependencies": { "playwright": "^1.63.0" } }
```

**Không** chạy `npx playwright install`. Ta điều khiển Chrome thật đang có sẵn trên máy:

```js
chromium.launch({ channel: 'chrome' })   // dùng Chrome 152 đã cài
```

Nếu bỏ `channel: 'chrome'`, Playwright đòi bản Chromium riêng của nó và báo:

```
browserType.launch: Executable doesn't exist at
~/Library/Caches/ms-playwright/chromium_headless_shell-1243/...
```

---

## 3. Đo thời gian: ba cái bẫy

### Bẫy 1 — đo một lần

V8 chạy code theo hai giai đoạn. Lần đầu nó thông dịch bằng **Ignition**; sau khi thấy đoạn
code chạy nhiều, nó mới biên dịch bằng **TurboFan**. Đo lần đầu là đo interpreter.

```js
function tinh(o) { return Math.sqrt(o.x * o.x + o.y * o.y); }
function tong(arr) { let s = 0; for (let i = 0; i < arr.length; i++) s += tinh(arr[i]); return s; }
const data = Array.from({ length: 2e6 }, (_, i) => ({ x: i, y: i + 1 }));

for (let i = 0; i < 10; i++) {
  const t = process.hrtime.bigint();
  tong(data);
  console.log(`lần ${i + 1}: ${(Number(process.hrtime.bigint() - t) / 1e6).toFixed(2)}ms`);
}
```

```
lần 1: 32.35ms      ← còn ở Ignition, `tinh()` chưa được nội tuyến
lần 2: 6.97ms       ← TurboFan bắt đầu vào
lần 3: 3.56ms       ← đã ổn định
lần 4: 3.58ms
lần 5: 4.26ms
lần 6: 3.63ms
```

Chênh **9.1 lần** giữa lần đầu và lần ổn định. Vì vậy `bench()` trong `do/bench.mjs` luôn
chạy 5 lần làm nóng trước:

```js
export function bench(ten, f, iter = 25) {
  for (let i = 0; i < 5; i++) f();          // làm nóng
  const ts = [];
  for (let i = 0; i < iter; i++) {
    const t = process.hrtime.bigint();
    f();
    ts.push(Number(process.hrtime.bigint() - t) / 1e6);
  }
  ts.sort((a, b) => a - b);
  console.log('  ' + ten.padEnd(46) + ts[Math.floor(iter / 2)].toFixed(2) + 'ms');
}
```

### Bẫy 2 — lấy trung bình

Lấy **trung vị**, không lấy trung bình. Một lần GC chen vào giữa là trung bình lệch hẳn, còn
trung vị thì không suy chuyển.

### Bẫy 3 — V8 xoá mất thứ bạn muốn đo

Nếu một object được tạo ra rồi vứt đi ngay, V8 phân tích thấy nó không thoát khỏi vòng lặp
(*escape analysis*) và bỏ hẳn việc cấp phát:

```js
bench('tạo 1 triệu object, vứt đi',        () => { for (let i = 0; i < 1e6; i++) ({ x: i, y: i }); });
bench('tạo 1 triệu object, giữ cái cuối',  () => { let last; for (let i = 0; i < 1e6; i++) last = { x: i, y: i }; return last; });
```

```
  tạo 1 triệu object, vứt đi              0.62ms      ← không hề cấp phát object nào
  tạo 1 triệu object, giữ cái cuối        3.19ms      ← đây mới là chi phí thật
```

Chênh **5.1 lần**, và con số 0.62 ms hoàn toàn vô nghĩa. Luôn để kết quả thoát ra ngoài bằng
`return`.

Ngược lại, đừng suy diễn quá tay: với phép cộng số nguyên thì V8 **không** bỏ, hai cách đo
ra y hệt nhau:

```
  cộng dồn nhưng vứt kết quả              6.16ms
  cộng dồn và trả về                      6.16ms
```

Nguyên tắc: nghi ngờ mọi con số nhỏ bất thường, và đối chứng bằng một biến thể có `return`.

## 4. Đo bộ nhớ trong Node

`heapUsed` chỉ có nghĩa **sau khi ép dọn rác**. Không có `--expose-gc` thì `global.gc` là
`undefined`:

```
$ node -e "global.gc()"
TypeError: global.gc is not a function

$ node --expose-gc -e "global.gc(); console.log('ok')"
ok
```

Mẫu chuẩn dùng suốt bộ này:

```js
const mb = () => (process.memoryUsage().heapUsed / 1048576).toFixed(1);
global.gc(); console.log('trước:', mb(), 'MB');
// ... làm gì đó ...
global.gc(); console.log('sau  :', mb(), 'MB');
```

Chạy thử ngay để thấy nó nhạy đến mức nào (file `do/do-bo-nho.mjs`):

```
$ node --expose-gc do/do-bo-nho.mjs
bắt đầu       : 3.2 MB
Map 200k      : 103.9 MB  size= 200000
bỏ mảng keys  : 101.9 MB  size= 200000
bỏ cả Map     : 3.3 MB
WeakMap 200k  : 7.3 MB
```

Đọc kỹ hai dòng cuối: cùng 200000 mục, `Map` giữ **103.9 MB**, `WeakMap` chỉ **7.3 MB**. Vì
sao — bài 08.

**`heapUsed` không phải toàn bộ bộ nhớ.** Ba con số khác nhau:

```
$ node --expose-gc -e "
const u = process.memoryUsage();
for (const [k,v] of Object.entries(u)) console.log(k.padEnd(14), (v/1048576).toFixed(1), 'MB');"
rss            39.1 MB    ← tổng bộ nhớ hệ điều hành cấp cho tiến trình
heapTotal      5.9 MB     ← V8 đã xin bao nhiêu cho heap JS
heapUsed       3.2 MB     ← trong đó đang dùng thật bao nhiêu
external       1.3 MB     ← Buffer, ArrayBuffer — nằm NGOÀI heap JS
arrayBuffers   0.0 MB
```

Đọc file 191 MB bằng `readFile` làm `rss` vọt lên **226 MB** trong khi `heapUsed` gần như
không nhúc nhích, vì `Buffer` nằm ở `external`. Nếu chỉ nhìn `heapUsed` bạn sẽ kết luận sai
là "không tốn bộ nhớ". Xem bài 13.

---

## 5. Đo bộ nhớ trong trình duyệt

`performance.memory` **không dùng được để đo**. Chrome làm tròn nó rất thô vì lý do riêng tư.
Đo thật: tạo 20000 node DOM rồi giữ lại — con số không nhúc nhích:

```
heap: 9.5 MB -> 9.5 MB (20000 node đã remove nhưng mảng còn giữ) -> 9.5 MB
```

Phải đi qua CDP (Chrome DevTools Protocol):

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');

const heapMB = async () => {
  await cdp.send('HeapProfiler.collectGarbage');       // ép GC
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize / 1048576;
};
```

Cùng thí nghiệm đó, đo lại bằng CDP:

```
50 component KHÔNG gỡ listener: 0.74 -> 10.29 MB (+9.54)
50 component CÓ gỡ listener   : 10.29 -> 10.29 MB (+0.00)
```

Bây giờ mới thấy rò rỉ.

### Node DOM không nằm trong heap JS

Đây là chỗ hầu hết người ta đo sai. Node DOM sống trong heap C++ của Blink, `getHeapUsage`
gần như không thấy chúng. Đếm bằng công cụ khác:

```js
await cdp.send('Memory.getDOMCounters');
```

```
ban đầu                                 : {"documents":1,"nodes":6,"jsEventListeners":0}
sau khi remove 20000 div (mảng còn giữ) : {"documents":1,"nodes":40006,"jsEventListeners":0}
sau khi keep=null                       : {"documents":1,"nodes":6,"jsEventListeners":0}
```

40006 node còn sống dù `.remove()` đã gọi hết. Đó chính là **detached DOM** — bài 08 mục 3.

---

## 6. Đo độ trễ event loop

Câu hỏi "code này có chặn event loop không" trả lời được bằng số. Đặt hẹn giờ 10 ms và xem
nó bị trễ bao nhiêu:

```js
export function theoDoiDoTre() {
  let max = 0, last = Date.now();
  const iv = setInterval(() => {
    const d = Date.now() - last - 10;
    if (d > max) max = d;
    last = Date.now();
  }, 10);
  return async () => {
    await new Promise(r => setTimeout(r, 60));   // ⚠ phải chờ nhịp đầu tiên sau khi hết nghẽn
    clearInterval(iv);
    return max;
  };
}
```

Dòng `await ... 60` không phải cho đẹp. Bỏ nó đi thì phép đo trả về **0 ms** dù code chặn
246 ms — vì lúc bị chặn `setInterval` không chạy được lần nào, và ta đã `clearInterval` trước
khi nó kịp chạy lần đầu tiên sau đó:

```
(bản thiếu chờ)  Độ trễ event loop khi chạy sync trên main thread: 0 ms     ← SAI
(bản đúng)       Độ trễ event loop khi chạy sync trên main thread: 246 ms
```

Kết quả đầy đủ:

```
$ node do/do-do-tre.mjs
Độ trễ event loop khi chạy sync trên main thread: 246 ms
Độ trễ event loop khi đẩy sang worker_threads   : 2 ms
Độ trễ khi chia nhỏ + setImmediate giữa các lát  : 42 ms
```

⚠️ Phép đo này **dao động** giữa các lần chạy — chạy 5 lần cho cột đầu tiên: 196, 245, 246,
246, 256 ms. Đó là bình thường: nó phụ thuộc thời điểm `setInterval` rơi vào so với lúc bắt đầu
nghẽn. Điều **ổn định** là tỉ lệ giữa ba cột (khoảng 100× và 5×), và đó mới là kết luận cần rút ra.

Nguyên tắc chung cho mọi phép đo trong bộ này: **tin vào tỉ lệ, đừng tin vào chữ số cuối.**

---

## 7. Bẫy khi đo trong Playwright

**`page.evaluate(fn)` chạy hàm trong trang, không trong Node.** Hàm bị chuyển thành chuỗi rồi
gửi qua. Nó **không** thấy biến bên ngoài:

```js
const N = 1000;
await page.evaluate(() => console.log(N));
// ReferenceError: N is not defined
```

Truyền qua tham số thứ hai:

```js
await page.evaluate(n => console.log(n), N);   // ✅
```

**`setContent` cho URL là `about:blank`**, nên đường dẫn tương đối chết:

```
fetch('/api') -> TypeError: Failed to execute 'fetch' on 'Window':
                 Failed to parse URL from /api
```

Muốn thử `fetch` thì phải dựng server thật — `do/trinh-duyet.cjs` đã làm sẵn việc đó.

**Muốn `gc()` trong trang:**

```js
chromium.launch({ channel: 'chrome', args: ['--js-flags=--expose-gc'] })
```

---

## 8. Bài tập

### Bài 1 — Không phải code nào cũng "nóng lên"

Chạy lại thí nghiệm ở mục 3 nhưng thay `tong(data)` bằng `arr.reduce((a,b)=>a+b,0)` trên mảng
5 triệu số. In 10 lần chạy. Lần thứ mấy thì ổn định? Giải thích kết quả.

<details><summary>Gợi ý đáp án</summary>

```js
const arr = Array.from({ length: 5e6 }, (_, i) => i);
for (let i = 0; i < 10; i++) {
  const t = process.hrtime.bigint();
  arr.reduce((a, b) => a + b, 0);
  console.log(i + 1, (Number(process.hrtime.bigint() - t) / 1e6).toFixed(2) + 'ms');
}
```

```
1 51.55ms   2 48.88ms   3 48.33ms   4 50.92ms   5 48.12ms
6 48.01ms   7 47.25ms   8 47.85ms   9 49.40ms   10 67.24ms
```

**Ổn định ngay từ lần 1** — không có giai đoạn làm nóng rõ rệt như ví dụ `tong()`.

Lý do: `reduce` là hàm dựng sẵn đã được biên dịch từ trước; thứ duy nhất cần JIT là callback
một dòng `(a,b)=>a+b`, quá nhỏ để tạo khác biệt. Ví dụ `tong()` thì khác — TurboFan phải
**nội tuyến** `tinh()` vào trong vòng lặp, đó mới là bước tạo ra bước nhảy 32 → 3.5 ms.

Chú ý lần thứ 10: **67.24 ms**, cao vọt. Đó là GC chen ngang. Nếu bạn lấy trung bình, một
điểm nhiễu này kéo kết quả lên; lấy trung vị thì nó không ảnh hưởng gì. Đây là lý do
`bench()` dùng trung vị.

</details>

### Bài 2 — Chứng minh `performance.memory` vô dụng

Dùng `do/trinh-duyet.cjs`, viết thí nghiệm tạo 50000 object lớn rồi so `performance.memory
.usedJSHeapSize` với `Runtime.getHeapUsage` của CDP. Hai con số có khớp không?

<details><summary>Gợi ý đáp án</summary>

```js
const { chay } = require('./trinh-duyet');
chay(async ({ page, heapMB }) => {
  const before = await heapMB();
  const pm0 = await page.evaluate(() => performance.memory.usedJSHeapSize / 1048576);
  await page.evaluate(() => { window.keep = Array.from({ length: 50000 }, () => new Array(100).fill(0)); });
  console.log('CDP :', before.toFixed(2), '->', (await heapMB()).toFixed(2), 'MB');
  console.log('perf.memory:', pm0.toFixed(2), '->',
    (await page.evaluate(() => performance.memory.usedJSHeapSize / 1048576)).toFixed(2), 'MB');
});
```

CDP thấy mức tăng hàng chục MB; `performance.memory` nhảy theo bậc thang thô hoặc đứng yên.
Kết luận: dùng nó để **theo dõi xu hướng dài hạn trong production** thì được, dùng để **đo
một thí nghiệm** thì không.

</details>

### Bài 3 — Phép đo nói dối

Bạn muốn so `Array.from` với vòng `for` + `push`. Đoạn đo dưới đây cho kết quả sai lệch
nghiêm trọng ở **hai** chỗ. Chỉ ra cả hai.

```js
const t0 = Date.now();
const a = Array.from({ length: 1e6 }, (_, i) => i);
console.log('Array.from:', Date.now() - t0, 'ms');

const t1 = Date.now();
const b = []; for (let i = 0; i < 1e6; i++) b.push(i);
console.log('for+push  :', Date.now() - t1, 'ms');
```

<details><summary>Gợi ý đáp án</summary>

**Lỗi 1 — đo một lần, không làm nóng.** Phép đo đầu tiên gánh cả chi phí JIT; phép đo thứ hai
chạy trên một V8 đã ấm. Bản thân thứ tự viết code đã quyết định ai "thắng".

**Lỗi 2 — `Date.now()` chỉ có độ phân giải mili giây.** Với thao tác vài ms, sai số làm tròn
lên tới hàng chục phần trăm. Dùng `process.hrtime.bigint()` (nano giây).

Còn một cái bẫy ngầm nữa: hai lần đo chạy trong cùng một tiến trình nên lần sau thừa hưởng
heap đã bị lần trước làm bẩn — GC có thể rơi đúng vào lần đo thứ hai.

Bản sửa:

```js
import { bench } from './bench.mjs';
bench('Array.from', () => Array.from({ length: 1e6 }, (_, i) => i));
bench('for+push  ', () => { const b = []; for (let i = 0; i < 1e6; i++) b.push(i); return b; });
```

```
  Array.from                                    46.46ms
  for+push                                      14.40ms
```

`Array.from` chậm hơn **3.2 lần** — nhưng đó là kết quả đúng của một phép đo đúng, khác hẳn
với con số bạn nhận được từ đoạn code hỏng ở trên.

</details>

---

**Tiếp theo:** [Bài 01 — Scope, closure, TDZ](./01-scope-closure-tdz.md)
