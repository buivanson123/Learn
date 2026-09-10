# Chỗ thí nghiệm

Mọi con số trong bộ tài liệu này đều chạy ra từ đây. Đừng tin số trong bài — chạy lại rồi tự tin.

## ⚠ Đuôi file quan trọng

`package.json` ở đây khai `"type": "module"`, nên:

| Đuôi | Là gì | Dùng cho |
|---|---|---|
| `.mjs` | ESM | script đo trong Node (`import`, top-level await) |
| `.cjs` | CommonJS | script điều khiển Playwright (`require`) |

Đổi `trinh-duyet.cjs` thành `.js` sẽ báo:

```
ReferenceError: require is not defined in ES module scope
```

## Cài

```bash
cd javascript/do
npm install          # chỉ có playwright, để điều khiển Chrome thật
```

Không cần `npx playwright install` — máy đã có Chrome 152, ta dùng `channel: 'chrome'`.

## Ba cách đo

| Cần đo gì | Dùng | File mẫu |
|---|---|---|
| Ngữ nghĩa JS (this, closure, event loop) | `node file.mjs` | `vd-event-loop.mjs` |
| Bộ nhớ trong Node | `node --expose-gc file.mjs` | `do-bo-nho.mjs` |
| DOM, bộ nhớ trình duyệt, tính năng mới | `node <ten>.cjs` | `trinh-duyet.cjs` |

## Đo thời gian cho đúng

Đừng đo một lần rồi kết luận. Hàm `bench` trong `bench.mjs` chạy 5 lần làm nóng (để V8 kịp
JIT) rồi lấy **trung vị** của 25 lần đo:

```bash
$ node bench.mjs
  for (i=0;i<len;i++)                       6.45ms
  forEach                                   74.48ms
```

Nếu bỏ phần làm nóng, lần đo đầu tiên có thể chậm gấp 10 lần vì code còn đang chạy ở
interpreter (Ignition) chứ chưa được biên dịch bởi TurboFan.

## Đo bộ nhớ trong Node

`process.memoryUsage().heapUsed` chỉ có nghĩa **sau khi ép GC**, nên luôn chạy với
`--expose-gc` và gọi `global.gc()` trước mỗi lần đọc:

```bash
$ node --expose-gc do-bo-nho.mjs
bắt đầu       : 3.2 MB
Map 200k      : 103.9 MB
```

Không có `--expose-gc` thì `global.gc` là `undefined` và số đo lên xuống ngẫu nhiên theo
lịch GC.

## Đo bộ nhớ trong trình duyệt

`performance.memory.usedJSHeapSize` bị Chrome làm tròn thô vì lý do riêng tư — đo 20000
node vẫn ra đúng `9.5 MB`. Phải đi qua CDP:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.collectGarbage');
const { usedSize } = await cdp.send('Runtime.getHeapUsage');
```

Riêng node DOM **không nằm trong heap JS** (chúng ở heap C++ của Blink), nên đếm bằng:

```js
await cdp.send('Memory.getDOMCounters');
// -> { documents: 1, nodes: 40006, jsEventListeners: 0 }
```

## Bẫy khi đo trong Playwright

- `page.evaluate(fn)` **serialize hàm rồi chạy trong trang** → nó không thấy biến của Node.
  Muốn truyền dữ liệu vào thì dùng tham số thứ hai: `page.evaluate(fn, data)`.
- `page.setContent(...)` cho URL là `about:blank`, nên `fetch('/api')` báo
  `TypeError: Failed to parse URL from /api`. Muốn thử fetch thì phải dựng server thật
  (xem `trinh-duyet.cjs`).
- `setContent` cũng làm **`localStorage` không dùng được**:
  ```
  SecurityError: Failed to read the 'localStorage' property from 'Window':
  Access is denied for this document.
  ```
  Lý do như trên: `about:blank` không có origin. Phải qua server thật.
- Muốn dùng `gc()` trong trang: `chromium.launch({ args: ['--js-flags=--expose-gc'] })`.
