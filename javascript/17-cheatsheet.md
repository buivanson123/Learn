# Bài 17 — Cheatsheet

> Một trang tra cứu. Mọi con số ở đây đo trên **Node 22.23 (V8 12.4)** và **Chrome 152**, máy
> Apple M1 Pro 10 nhân.

---

## Node 22 vs Chrome 152 — khoảng cách cần nhớ

| | Node 22.23 | Chrome 152 |
|---|---|---|
| `Temporal`, `Promise.try`, `RegExp.escape` | ❌ | ✅ |
| `Uint8Array.fromBase64`, `Error.isError`, `Float16Array` | ❌ | ✅ |
| cú pháp `using` | ❌ `SyntaxError` | ✅ |
| `scheduler.yield` | ❌ | ✅ |
| `Symbol.dispose` (symbol, không phải cú pháp) | ✅ | ✅ |
| Iterator helpers, `Set.union`, `Object.groupBy`, `Array.fromAsync` | ✅ | ✅ |
| decorator | ❌ | ❌ |

Dò **API** bằng `typeof`. Dò **cú pháp** bằng `try { new Function(src) } catch {}`.

---

## Event loop

```
code đồng bộ → VÉT SẠCH microtask → LẤY MỘT macrotask → lặp lại
```

| Hàng đợi | Ai vào |
|---|---|
| microtask | `.then`, phần sau `await`, `queueMicrotask`, `MutationObserver` |
| macrotask | `setTimeout`, `setInterval`, I/O, sự kiện DOM, `setImmediate` |

- **`process.nextTick` đổi chỗ giữa CJS và ESM.** CJS: trước mọi microtask. ESM: **sau**. Đừng
  dựa vào nó.
- Trong Node, `setTimeout(f, 0)` vs `setImmediate(f)` ở module chính là **không xác định**.
  Trong callback I/O thì `setImmediate` luôn trước. → Dùng `setImmediate`.
- `await 1` = `await Promise.resolve()` = **1 nhịp**. `await thenable` = **2 nhịp**.
- Microtask lồng nhau **bỏ đói** macrotask: 1 triệu microtask đẩy `setTimeout(0)` tới **137 ms**.

Nhả luồng:

```js
await new Promise(r => setImmediate(r));              // Node
await new Promise(r => requestAnimationFrame(r));      // trình duyệt, đợi 1 khung hình
await scheduler.yield();                               // Chrome 152, giữ ưu tiên cao
```

---

## `this` — 5 luật, xét theo thứ tự

| # | Dạng gọi | `this` |
|---|---|---|
| 1 | `new F()` | object mới |
| 2 | `f.call(x)` / `bind(x)()` | `x` (**`bind` lần 2 vô tác dụng**) |
| 3 | `obj.f()` | `obj` |
| 4 | `f()` trần | `undefined` (ESM/strict/class) hoặc `globalThis` (sloppy) |
| 5 | arrow | `this` của scope bao ngoài **lúc định nghĩa** |

- ESM **luôn** strict. Thân `class` **luôn** strict.
- Top-level CJS: `this === module.exports`, **không** phải `globalThis`.
- Class field arrow (`m = () => {}`) tốn **2.7×** bộ nhớ so với method trên prototype
  (1 triệu instance: 97.1 vs 36.1 MB).

---

## Bốn thuật toán so sánh

| | `NaN` vs `NaN` | `0` vs `-0` | Dùng ở |
|---|---|---|---|
| `==` | false | true | (đừng dùng) |
| `===` | false | true | `===`, `indexOf`, `switch` |
| SameValueZero | **true** | true | `includes`, `Map`, `Set` |
| SameValue | **true** | **false** | `Object.is` |

`[NaN].includes(NaN)` → `true`. `[NaN].indexOf(NaN)` → `-1`.
`x == null` là ngoại lệ duy nhất đáng dùng của `==`.

---

## JSON mất gì

| Vào | Ra |
|---|---|
| `undefined`, hàm, `Symbol` | **key biến mất** |
| `NaN`, `Infinity` | `null` |
| `Map`, `Set`, `RegExp` | `{}` — **mất sạch dữ liệu** |
| `Date` | chuỗi ISO (parse lại vẫn là chuỗi) |
| `-0` | `0` |
| `BigInt`, vòng lặp | **ném lỗi** |

`structuredClone` giữ được `Date`/`Map`/`Set`/`RegExp`/`NaN`/vòng lặp. **Không** clone được hàm.

---

## Bốn kiểu rò rỉ, tra theo *Retainers* trong DevTools

| Thấy | Kiểu | Đã đo | Sửa |
|---|---|---|---|
| `context` | closure chia sẻ scope | **152 MB** cho 20 hàm trả về `1` | tách scope / `bien = null` |
| `Detached HTMLxxx` | detached DOM | **40 006** node còn sống | bỏ tham chiếu |
| `Window`/`EventListener` | listener không gỡ | **+9.54 MB** / 50 component | `{ signal }` + `ac.abort()` |
| `Map` ở module scope | cache vô hạn | `Map` 103.9 vs `WeakMap` 7.3 MB | `WeakMap` / LRU |

Đo trong Node: `node --expose-gc`, `global.gc()` trước mỗi lần đọc `heapUsed`.
Đo trong Chrome: CDP `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage`.
Đếm node DOM: CDP `Memory.getDOMCounters` (node DOM **không** ở heap JS).

`FinalizationRegistry` callback **không được bảo đảm chạy** — chỉ dùng để thống kê, không dùng
để giải phóng tài nguyên.

---

## Promise

| | Xong khi | Kết quả |
|---|---|---|
| `all` | tất cả xong, hoặc **một** hỏng | mảng / lỗi đầu tiên |
| `allSettled` | tất cả kết thúc | `{status, value \| reason}[]` — **không bao giờ reject** |
| `race` | **một cái bất kỳ** kết thúc | giá trị hoặc lỗi của nó |
| `any` | **một cái thành công** | giá trị đó / `AggregateError` |

- 3 CDN lấy cái nhanh nhất → **`any`**, không phải `race`.
- ⚠️ Lỗi ở nhánh **thua** của `race` biến mất hoàn toàn — không log, không `unhandledRejection`.
- Promise chạy **khi được tạo**, không phải khi được `await`.
- `ids.map(f)` trong `for await` khởi động **tất cả** ngay.

Bốn kiểu nuốt lỗi: gọi `async` không `await` · `forEach(async …)` · `.catch` giữa chuỗi không
`throw` lại · nhánh thua của `race`.

```js
// AbortController — nhớ: name khác nhau
ac.abort()                  -> AbortError
AbortSignal.timeout(ms)     -> TimeoutError      ← đừng chỉ kiểm AbortError
AbortSignal.any([s1, s2])   -> gộp nhiều tín hiệu
```

---

## Module

| | CJS | ESM |
|---|---|---|
| Export | thuộc tính (bản chụp) | **binding** (live) |
| Vòng lặp import | object **thiếu một nửa**, im lặng | `ReferenceError` (TDZ) — ồn ào, dễ tìm |
| `require()` nó | ✅ | ✅ Node 22, **trừ khi có top-level await** |

`package.json`: `type` quyết định `.js` là gì · `exports` chặn file nội bộ (đừng quên
`"./package.json"`) · `sideEffects: false` là điều kiện tree-shaking, **nhưng sẽ xoá mất
polyfill** nếu bạn có.

---

## DOM

```
capture (window → xuống) → target → bubble (lên)
```

- `stopPropagation()` **không** chặn handler khác trên **cùng** element → dùng
  `stopImmediatePropagation()`.
- Không bubble: `focus`, `blur`, `mouseenter`, `mouseleave`.
- `e.currentTarget` là `null` **sau `await`** → lưu trước.
- Delegation: `e.target.closest('.item')`, không phải `e.target`.
- Collection **sống** (bỏ sót một nửa khi lặp): `getElementsByClassName`,
  `getElementsByTagName`, `getElementsByName`, **`element.children`**.
- `removeEventListener` thất bại nếu: hàm được tạo tại chỗ, hoặc thiếu `{ capture: true }`
  (capture là phần của danh tính listener — đo: 1 lần chạy vs 0).

### Thêm 5000 node — chọn cách

```
gom chuỗi rồi gán innerHTML 1 lần    1.9ms     ← nhanh nhất, nhưng phá listener/state cũ + rủi ro XSS
append trực tiếp DOM                 3.4ms     ← giữ được node cũ
DocumentFragment                     5.5ms     ← KHÔNG nhanh hơn, lời khuyên cũ đã lỗi thời
innerHTML += trong vòng lặp       7366.4ms     ← 3877× chậm hơn, không bao giờ dùng
```

### Layout thrashing

```
đọc/ghi xen kẽ         635.30ms
đọc hết rồi ghi hết      1.20ms     ← 529× nhanh hơn
```

Đọc bất kỳ cái nào sau đây là **ép tính layout ngay**:
`offsetTop/Left/Width/Height` · `scrollTop/Left/Width/Height` · `clientXxx` ·
`getBoundingClientRect()` · `getComputedStyle()` · `focus()` · `scrollIntoView()` ·
`offsetParent`.

---

## Node runtime

| Việc | Chọn |
|---|---|
| Đọc file lớn | `createReadStream` (RSS 76 vs 226 MB), chậm hơn 2.1× |
| Nối stream | **luôn `pipeline()`**, không bao giờ `.pipe()` |
| Việc CPU nặng | `worker_threads` — độ trễ event loop 246 ms → **2 ms** |
| Nhân bản server HTTP | nhiều container, không `cluster` |
| Việc CPU nhẹ (<20 ms) | làm thẳng (khởi động 1 worker mất ~16 ms) |

- `readFileSync` × 20 file 191 MB → độ trễ event loop **795 ms**. Bản async: 40 ms.
- `Buffer` nằm ở `external`, **không** ở `heapUsed` → theo dõi **`rss`**.
- `emit('error')` không có listener → **giết tiến trình**. Mọi tên khác thì vô hại.
- Listener `async` trong `EventEmitter` nuốt lỗi → `.catch(e => em.emit('error', e))`.
- Trong container: `node --max-old-space-size=<80% RAM>`. Không đặt → exit code **137**, không log.

---

## Hiệu năng: cái gì thật sự đáng làm

| Việc | Lợi ích |
|---|---|
| Bỏ hẳn việc không cần làm (debounce, cache, phân trang) | 10–1000× |
| Sửa O(n²) (như `innerHTML +=`) | 100–4000× |
| Bỏ layout thrashing | 529× |
| Đẩy CPU sang Worker | 0 → 26 khung/500 ms |
| Gộp nhiều lượt duyệt thành một | 166.83 → 17.45 ms |
| `forEach` → `for` | 1.1–11× (**chỉ** với mảng rất lớn) |
| Vặn hidden class | 1.1–3.6× |

Bốn dòng đầu là nơi có kết quả. Hai dòng cuối là nơi người ta hay mất thời gian.

### Lời khuyên cũ đã sai

```
"+= chậm, dùng join"        -> += NHANH HƠN 3× tới 100k lần
"luôn DocumentFragment"     -> nó CHẬM HƠN append trực tiếp
"object phải 1 hidden class"-> 1→4 gần như miễn phí; chỉ VƯỢT 4 mới đắt (3.6×)
"await promise tốn 3 nhịp"  -> chỉ còn 1 nhịp từ V8 7.2
"[...arr] chậm hơn slice()" -> BẰNG NHAU (0.08 vs 0.08 ms)
```

Vẫn đúng: **`try/catch` bao quanh vòng lặp nóng chậm 4.2×** (6.32 → 26.60 ms). Nhưng đặt
`try/catch` **ngoài hàm** thì không mất gì — 6.35 ms.

---

## Đo cho đúng

```js
// Làm nóng 5 lần rồi lấy TRUNG VỊ của 25 lần (không lấy trung bình — GC gây nhiễu)
for (let i = 0; i < 5; i++) f();
// JIT: lần đầu 32.35ms -> ổn định 3.56ms (9.1×)
```

Ba cái bẫy: đo một lần · lấy trung bình · để V8 xoá mất code cần đo (escape analysis: 0.62 vs
3.19 ms).

Luôn `return` giá trị ra ngoài hàm đo.

---

## Ba dòng lệnh dùng nhiều nhất

```bash
node --expose-gc file.mjs                  # đo bộ nhớ
node --cpu-prof app.js                     # sinh .cpuprofile, kéo vào DevTools
node --trace-warnings app.js               # biết listener thừa thêm ở dòng nào
```

```js
require('v8').writeHeapSnapshot('/tmp/1.heapsnapshot');   // rồi kéo vào tab Memory của Chrome
```

---

## Mẫu code hay dùng

```js
// Gỡ MỌI listener/observer/timer của một component bằng 1 lệnh
const ac = new AbortController();
el.addEventListener('click', f, { signal: ac.signal });
setInterval(g, 1000, { signal: ac.signal });      // ⚠ chỉ Node, trình duyệt chưa có
ac.abort();

// Lớp bọc fetch đúng
const r = await fetch(url, { signal: AbortSignal.any([sig, AbortSignal.timeout(10_000)]) });
if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });

// Giới hạn số việc đồng thời (đầy đủ ở bài 07 bài tập 2)
const limit = pLimit(3);
await Promise.all(ids.map(id => limit(() => tai(id))));

// Nhả luồng mỗi N vòng để UI kịp vẽ
if (++i % 200 === 0) await new Promise(r => requestAnimationFrame(r));

// Escape trước khi nhét vào innerHTML
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Chuỗi có emoji: đếm theo ký tự người đọc thấy
[...new Intl.Segmenter().segment('👨‍👩‍👧')].length      // 1
[...'👨‍👩‍👧'].length                                   // 5  (code point)
'👨‍👩‍👧'.split('').length                              // 8  (SAI)
```

---

## Bốn câu hỏi trước khi tối ưu

1. Tôi đã **đo** chưa, hay đang đoán?
2. Việc này có thể **không làm** được không (cache, lười, phân trang)?
3. Đây là O(n²) không?
4. Nó có chặn **luồng chính** không?

Trả lời được bốn câu này là xong 90% việc tối ưu. Phần còn lại là vi mô, và bài 14 cho thấy
bốn trong sáu "mẹo vi mô" nổi tiếng đã sai.

---

Hết. Quay lại [README](./README.md) · Luyện phỏng vấn: [`phong-van/`](./phong-van/)
