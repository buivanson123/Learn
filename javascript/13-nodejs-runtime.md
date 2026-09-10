# Bài 13 — Node.js runtime

> Node là V8 + libuv + một bộ API. Bài này về phần **không phải V8**: nơi mà "một luồng" thật
> ra có nhiều luồng, nơi bộ nhớ đi mất mà `heapUsed` không thấy, và nơi một dòng `Sync` làm
> chết cả server.

---

## 1. "Node một luồng" là nói tắt

```
$ node -e "const os=require('os'); console.log(os.cpus().length, 'nhân |', os.cpus()[0].model)"
10 nhân | Apple M1 Pro
```

Node chạy **JavaScript của bạn** trên một luồng. Nhưng libuv có một **thread pool** (mặc định 4
luồng) làm việc thật cho:

- `fs.*` bất đồng bộ (trừ trên một số hệ thống)
- `dns.lookup`
- `crypto.pbkdf2`, `crypto.randomBytes`, `zlib.*`

Còn **mạng** (TCP, HTTP) thì **không** dùng thread pool — nó dùng cơ chế bất đồng bộ của hệ
điều hành (`kqueue` trên macOS, `epoll` trên Linux).

Hệ quả thực tế: 5 request đọc file cùng lúc thì luồng thứ 5 phải **xếp hàng** chờ thread pool.
Đổi được bằng biến môi trường:

```bash
UV_THREADPOOL_SIZE=16 node server.js
```

Nhưng chỉ đổi được **trước khi** tiến trình chạy — đặt `process.env.UV_THREADPOOL_SIZE` trong
code là quá muộn.

---

## 2. Một dòng `Sync` giết cả server — đo bằng số

```js
// Đọc file 191 MB, 20 lần
for (let i = 0; i < 20; i++) fs.readFileSync('big.bin');
// so với
await Promise.all(Array.from({ length: 20 }, () => fs.promises.readFile('big.bin')));
```

```
20x readFileSync 191MB  : độ trễ event loop 795 ms
20x fs.promises.readFile: độ trễ event loop  40 ms
```

795 ms là thời gian **mọi request khác bị treo**. Không phải "chậm hơn 20 lần" — mà là toàn bộ
server không trả lời được ai trong 0.8 giây.

Danh sách các hàm `Sync` hay bị dùng nhầm trong code chạy production:

```
fs.readFileSync        fs.writeFileSync       fs.existsSync
fs.readdirSync         crypto.pbkdf2Sync      zlib.gzipSync
child_process.execSync JSON.parse trên chuỗi lớn (không có bản async!)
```

Chúng **hoàn toàn ổn** ở một chỗ: lúc khởi động, trước khi server nhận request. Đọc config
bằng `readFileSync` ở dòng đầu `index.js` là đúng. Đọc nó trong mỗi request là sai.

`JSON.parse` là ca đặc biệt — không có bản bất đồng bộ. Parse 50 MB JSON chặn luồng vài trăm
ms và không có cách nào tránh trên luồng chính. Giải pháp là `worker_threads` (mục 4) hoặc
parse theo stream (`stream-json`).

---

## 3. Stream: cái giá của việc không dùng

Đọc cùng file 191 MB hai cách:

```
readFile         :  86ms, RSS đỉnh 226 MB, đọc 200000000 byte
createReadStream : 181ms, RSS đỉnh  76 MB, đọc 200000000 byte
```

Stream **chậm hơn 2.1 lần** nhưng dùng bộ nhớ ít hơn **3 lần**. Với một request thì `readFile`
thắng. Với 10 request đồng thời, `readFile` cần 2.2 GB còn stream cần 760 MB — và 2.2 GB vượt
giới hạn heap mặc định.

⚠️ Nhớ [bài 00](./00-moi-truong-va-cach-do.md): `Buffer` nằm ở `external`, **không** ở
`heapUsed`. Nếu bạn theo dõi `heapUsed` để phát hiện vấn đề bộ nhớ, bạn sẽ **không thấy gì**
trong khi RSS lên 226 MB. Theo dõi `rss`.

### `for await` là cách đọc stream gọn nhất

```js
let n = 0;
for await (const chunk of fs.createReadStream('big.bin', { highWaterMark: 64 * 1024 })) {
  n += chunk.length;
}
```

Node stream đã cài `Symbol.asyncIterator` ([bài 05](./05-iterator-va-generator.md) mục 6), nên
không cần `on('data')`/`on('end')` nữa.

---

## 4. ⚠ `pipe()` **không** chuyển lỗi — luôn dùng `pipeline()`

Đây là bug nghiêm trọng nhất trong bài. Nguồn ném lỗi, và ta đã gắn handler cho đích:

```js
const nguon = new Readable({ read() { this.destroy(new Error('nguồn nổ')) } });
const dich  = new Writable({ write(c, e, cb) { cb() } });

dich.on('error', e => console.log('đích nhận error:', e.message));   // đã gắn handler
nguon.pipe(dich);
```

```
      throw er; // Unhandled 'error' event
Error: nguồn nổ
                                    ← tiến trình BỊ GIẾT
```

Handler trên `dich` **không** chạy. `pipe()` chỉ chuyển **dữ liệu**, không chuyển lỗi. Lỗi trên
`nguon` không có ai nghe → `Unhandled 'error' event` → tiến trình chết.

Và tệ hơn: nếu bạn có gắn `nguon.on('error', ...)` thì tiến trình không chết, nhưng `dich`
**không bao giờ được đóng** — file descriptor hoặc kết nối rò rỉ, mỗi request một cái.

```js
import { pipeline } from 'node:stream/promises';

try { await pipeline(nguon, dich) }
catch (e) { console.log('pipeline ném:', e.constructor.name + ': ' + e.message) }
console.log('đích đã đóng?', daDong);
```

```
pipeline ném: Error: nguồn nổ
đích đã đóng? true
```

`pipeline` làm đúng ba việc `pipe` không làm: chuyển lỗi ra ngoài, **huỷ mọi stream trong
chuỗi**, và (bản `promises`) cho bạn `await`.

**Quy tắc: không dùng `.pipe()` trong code production.** Luôn `pipeline`.

Ví dụ đầy đủ với nhiều tầng:

```js
await pipeline(
  fs.createReadStream('vao.txt'),
  createGzip(),
  fs.createWriteStream('ra.txt.gz'),
  { signal: ac.signal },              // huỷ được luôn
);
```

---

## 5. `worker_threads`: dùng cho CPU, không cho I/O

```
4 việc tuần tự trên main thread: 1075ms
4 việc trên 4 worker_threads   :  366ms
```

**Nhanh 2.9 lần** với 4 worker trên máy 10 nhân. Và quan trọng hơn là độ trễ event loop:

```
Độ trễ event loop khi chạy sync trên main thread: 246 ms
Độ trễ event loop khi đẩy sang worker_threads   :   2 ms
Độ trễ khi chia nhỏ + setImmediate giữa các lát  :  42 ms
```

Ba dòng này là ba lựa chọn kiến trúc:

| Cách | Độ trễ | Khi nào dùng |
|---|---|---|
| Chạy thẳng | 246 ms | không bao giờ, nếu có request khác đang chờ |
| Chia nhỏ + `setImmediate` | 42 ms | việc chia nhỏ được, không muốn thêm worker |
| `worker_threads` | 2 ms | việc CPU nặng, không chia nhỏ được |

```js
import { Worker } from 'node:worker_threads';

const chay = (n) => new Promise((res, rej) => {
  const w = new Worker('./worker.js', { workerData: n });
  w.on('message', res);
  w.on('error', rej);
  w.on('exit', code => { if (code !== 0) rej(new Error(`worker thoát với mã ${code}`)) });
});
```

Ba điều bắt buộc:

1. **Nghe cả `error` và `exit`.** Không nghe `error` thì lỗi trong worker thành
   `unhandledRejection`. Không nghe `exit` thì worker chết đột ngột (OOM) làm promise treo mãi.
2. **Tạo pool, đừng tạo worker mỗi việc.** Đo thật thời gian khởi động một worker, 8 lần liên
   tiếp: `20, 16, 16, 16, 16, 16, 17, 17 ms` — khoảng **16 ms**, vì phải dựng một V8 isolate
   mới. Việc dưới ~20 ms thì làm thẳng trên luồng chính còn nhanh hơn.
3. **Số worker = `os.cpus().length`**, không nhiều hơn. Nhiều hơn thì chúng tranh nhau nhân CPU.

`worker_threads` vs `cluster`:

| | `worker_threads` | `cluster` |
|---|---|---|
| Đơn vị | luồng trong cùng tiến trình | tiến trình riêng |
| Chia sẻ bộ nhớ | có (`SharedArrayBuffer`) | không |
| Dùng cho | tính toán CPU | **nhân bản server HTTP** để dùng hết nhân |
| Chết một cái | có thể kéo cả tiến trình | các cái khác vẫn sống |

Trong thực tế 2026, thay `cluster` bằng việc chạy nhiều container và để orchestrator lo — bạn
được isolation tốt hơn và không phải viết code quản lý worker.

---

## 6. `EventEmitter`: ba cái bẫy

### Bẫy 1 — cảnh báo 10 listener

```
listenerCount: 11
(node:78173) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 x listeners added to [EventEmitter]. MaxListeners is 10.
```

Đừng sửa bằng `setMaxListeners(100)`. Đi tìm lý do có 11 cái ([bài 08](./08-bo-nho-va-ro-ri.md)
mục 5).

### Bẫy 2 — sự kiện `'error'` không có listener thì **giết tiến trình**

```js
const e = new EventEmitter();
e.emit('error', new Error('x'));
```

```
Error: x
    at ...
                        ← tiến trình chết
```

`'error'` là tên **đặc biệt** trong `EventEmitter`. Mọi tên khác thì `emit` không có listener là
vô hại.

### Bẫy 3 — listener `async` nuốt lỗi

```js
e.on('viec', async (d) => { await xuLy(d) });     // ⚠ lỗi trong xuLy biến mất
```

`emit` gọi listener **đồng bộ** và bỏ qua giá trị trả về. Promise bị vứt → `unhandledRejection`.

```js
e.on('viec', (d) => { xuLy(d).catch(err => e.emit('error', err)) });   // ✅
```

Node có `events.on()` để chuyển sự kiện thành async iterator, giữ được thứ tự và bắt lỗi được:

```js
import { on } from 'node:events';
for await (const [d] of on(e, 'viec')) await xuLy(d);
```

---

## 7. Ba biến môi trường và cờ đáng biết

```bash
# Heap mặc định của Node 22 khoảng 4 GB trên máy 16 GB RAM. Đặt tay khi chạy trong container:
node --max-old-space-size=2048 app.js

# In stack trace đầy đủ cho cảnh báo (biết listener thừa được thêm ở dòng nào)
node --trace-warnings app.js

# Bắt unhandledRejection thay vì để nó giết tiến trình âm thầm
process.on('unhandledRejection', (e) => { logger.fatal(e); process.exit(1) });
```

Về `--max-old-space-size` trong container: nếu không đặt, Node đọc RAM của **máy chủ**, không
phải giới hạn của container. Container 512 MB nhưng Node tưởng nó có 4 GB → nó không GC kịp và
bị OOM killer giết với exit code **137**, không có log nào từ Node.

Kiểm tra Node thấy bao nhiêu:

```
$ node -e "console.log((require('v8').getHeapStatistics().heap_size_limit/1048576).toFixed(0), 'MB')"
4144 MB
```

---

## 8. Bài tập

### Bài 1 — Endpoint này làm server đứng

```js
app.get('/bao-cao', async (req, res) => {
  const rows = JSON.parse(fs.readFileSync('du-lieu.json', 'utf8'));   // 80 MB
  const kq = rows.filter(r => r.thang === req.query.thang)
                 .map(r => ({ ...r, tong: r.items.reduce((a, b) => a + b.gia, 0) }));
  res.json(kq);
});
```

Nêu **ba** vấn đề và viết lại.

<details><summary>Gợi ý đáp án</summary>

**Vấn đề 1 — `readFileSync` trong request handler.** Đo ở mục 2: đọc file lớn kiểu Sync chặn
event loop hàng trăm ms. Mọi request khác treo theo.

**Vấn đề 2 — `JSON.parse` 80 MB, mỗi request.** Không có bản async, và nó tạo ra hàng chục MB
object mới mỗi lần gọi. 10 request đồng thời là vài trăm MB rác.

**Vấn đề 3 — đọc lại file không đổi.** File `du-lieu.json` không thay đổi giữa các request,
nhưng nó bị đọc và parse lại từ đầu mỗi lần.

Bản sửa — nạp **một lần** lúc khởi động, lập chỉ mục sẵn:

```js
// Lúc khởi động — chặn ở đây hoàn toàn OK, chưa ai gửi request
const rows = JSON.parse(await fs.promises.readFile('du-lieu.json', 'utf8'));

// Tính sẵn `tong` một lần, và gom theo tháng
const theoThang = Object.groupBy(
  rows.map(r => ({ ...r, tong: r.items.reduce((a, b) => a + b.gia, 0) })),
  r => r.thang,
);

app.get('/bao-cao', (req, res) => {
  res.json(theoThang[req.query.thang] ?? []);      // O(1), không chặn gì
});
```

Nếu file **có** thay đổi khi đang chạy, thêm `fs.watch` để nạp lại, vẫn không đọc trong request:

```js
fs.watch('du-lieu.json', debounce(async () => { /* nạp lại vào biến */ }, 500));
```

Nếu dữ liệu quá lớn để giữ trong RAM, đó là dấu hiệu nó nên nằm trong database, không nằm trong
file JSON.

</details>

### Bài 2 — Viết pool worker

Viết `taoPool(duongDanWorker, soLuong)` với hàm `chay(data)` trả về promise, dùng lại worker
thay vì tạo mới mỗi lần.

<details><summary>Gợi ý đáp án</summary>

```js
import { Worker } from 'node:worker_threads';
import os from 'node:os';

export function taoPool(file, soLuong = os.cpus().length) {
  const ranh = [];
  const hangDoi = [];

  const themWorker = () => {
    const w = new Worker(file);
    w.dangLam = null;
    w.on('message', (m) => { w.dangLam?.res(m); xong(w) });
    w.on('error',   (e) => { w.dangLam?.rej(e); thayThe(w) });
    w.on('exit',    (c) => { if (c !== 0) { w.dangLam?.rej(new Error('worker thoát ' + c)); thayThe(w) } });
    ranh.push(w);
  };

  const thayThe = (w) => {                      // ✅ worker chết thì thay cái mới
    w.dangLam = null;
    const i = ranh.indexOf(w); if (i >= 0) ranh.splice(i, 1);
    w.terminate().catch(() => {});
    themWorker(); tiep();
  };

  const xong = (w) => { w.dangLam = null; ranh.push(w); tiep() };

  const tiep = () => {
    if (!ranh.length || !hangDoi.length) return;
    const w = ranh.pop(), viec = hangDoi.shift();
    w.dangLam = viec;
    w.postMessage(viec.data);
  };

  for (let i = 0; i < soLuong; i++) themWorker();

  return {
    chay: (data) => new Promise((res, rej) => { hangDoi.push({ data, res, rej }); tiep() }),
    dong: () => Promise.all(ranh.map(w => w.terminate())),
  };
}
```

Bốn chi tiết dễ bỏ sót:

1. **Thay thế worker chết.** Worker bị OOM hoặc lỗi native thì không dùng lại được. Không thay
   thì pool teo dần về 0 và mọi việc treo vĩnh viễn.
2. **Nghe cả `error` và `exit`.** Chỉ nghe `error` thì worker chết vì OOM sẽ không reject —
   promise treo mãi.
3. **`w.dangLam`** giữ liên kết giữa worker và việc nó đang làm. Không có nó thì khi worker
   chết bạn không biết reject promise nào.
4. **`dong()`** để test không bị treo — Vitest/Jest chờ mãi nếu còn worker sống.

Đo thử với 4 việc nặng, so với tạo worker mới mỗi lần:

```
tạo worker mới mỗi việc : 237 ms
dùng pool (đã ấm)       : 215 ms
```

22 ms là chi phí dựng 4 V8 isolate — nhỏ hơn nhiều so với con số "30–40 ms mỗi worker" mà
người ta hay nói, vì 4 worker khởi động **song song**. Nhưng nó là 22 ms **cho mỗi mẻ**: chạy
1000 mẻ là 22 giây tiết kiệm được, và quan trọng hơn là bạn không tạo áp lực GC từ việc dựng
rồi phá isolate liên tục.

Điểm cần thấy: **chênh lệch nhỏ hơn bạn tưởng.** Đừng dựng pool vì "worker đắt" — dựng nó vì
bạn cần kiểm soát số việc chạy đồng thời và cần thay thế worker chết.

</details>

### Bài 3 — Vì sao file này rỗng

```js
app.get('/tai-xuong', (req, res) => {
  const s = fs.createReadStream('bao-cao.csv');
  s.pipe(res);
  s.on('error', e => res.status(500).json({ loi: e.message }));
});
```

Đôi khi client nhận file rỗng, đôi khi server crash. Cả hai đều xảy ra. Giải thích và sửa.

<details><summary>Gợi ý đáp án</summary>

**Vì sao file rỗng:** nếu `createReadStream` lỗi (file không tồn tại), `pipe` đã bắt đầu và
`res` có thể đã gửi header 200. Lúc handler `error` chạy, `res.status(500)` không có tác dụng
nữa — header đã đi rồi. Client nhận 200 với body rỗng. Nếu `res.json` được gọi sau khi header
đã gửi, Express còn ném thêm `ERR_HTTP_HEADERS_SENT`.

**Vì sao crash:** nếu client **ngắt kết nối** giữa lúc tải (đóng tab), `res` bị destroy nhưng
`s` vẫn đọc tiếp. `pipe` không huỷ nguồn → ghi vào socket đã đóng → `EPIPE` không ai nghe →
tiến trình chết. Và file descriptor của `s` rò rỉ, mỗi lần một cái.

Bản sửa:

```js
app.get('/tai-xuong', async (req, res) => {
  // 1. Kiểm tra TRƯỚC khi gửi bất cứ gì
  try { await fs.promises.access('bao-cao.csv', fs.constants.R_OK) }
  catch { return res.status(404).json({ loi: 'không có file' }) }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bao-cao.csv"');

  try {
    // 2. pipeline: huỷ nguồn khi client ngắt, chuyển lỗi ra ngoài
    await pipeline(fs.createReadStream('bao-cao.csv'), res);
  } catch (e) {
    if (e.code === 'ERR_STREAM_PREMATURE_CLOSE') return;   // client đóng tab — bình thường
    logger.error(e);
    if (!res.headersSent) res.status(500).end();           // 3. chỉ đổi status khi chưa gửi
  }
});
```

Ba nguyên tắc rút ra, dùng được cho mọi endpoint stream:

1. **Kiểm tra điều kiện lỗi trước khi gửi byte đầu tiên.** Sau đó thì đã quá muộn để đổi status.
2. **`pipeline` thay `pipe`** — nó huỷ nguồn khi đích chết, nên không rò file descriptor.
3. **`res.headersSent`** trước mỗi lần định đổi status hoặc gửi body lỗi.

`ERR_STREAM_PREMATURE_CLOSE` là lỗi bạn sẽ thấy rất nhiều trong log production. Nó gần như luôn
là "người dùng đóng tab", không phải bug — nên lọc nó ra khỏi alert, nếu không bạn sẽ bị nhiễu.

</details>

---

**Tiếp theo:** [Bài 14 — Hiệu năng và công cụ](./14-hieu-nang-va-cong-cu.md)
