# Runtime và xử lý đồng thời — 16 câu

Nhóm câu này đo xem bạn có hiểu **cái gì đang chạy trên luồng nào**. Người phỏng vấn thường mở
đầu nhẹ ("Node đơn luồng đúng không?") rồi đào tới chỗ đau ("vậy sao nó phục vụ được 10 nghìn
kết nối?").

Mọi output dưới đây đo trên Node v22.23.2, macOS, 10 CPU.

---

### 1. Node.js "đơn luồng" — phát biểu đó đúng tới đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Chỉ **JavaScript của bạn** chạy trên một luồng. Bản thân tiến trình Node có
nhiều luồng: libuv giữ một threadpool (mặc định 4 luồng) cho file I/O, DNS, `zlib`, `crypto`;
network I/O thì không dùng threadpool mà dùng epoll/kqueue của hệ điều hành.

**Giải thích sâu:** Hệ quả thực tế là hai loại việc bị đối xử hoàn toàn khác nhau:

- **I/O-bound** (query DB, gọi API, đọc file): Node giao cho tầng dưới rồi quay lại phục vụ
  request khác. Một luồng phục vụ hàng nghìn kết nối được là nhờ đây.
- **CPU-bound** (vòng lặp lớn, `JSON.parse` file to, resize ảnh, hash mật khẩu): chạy ngay trên
  luồng JS, và trong lúc đó **không request nào khác được phục vụ**.

Đo thật — một server có 2 route, `/heavy` chiếm CPU 3 giây:

```js
if (req.url === '/heavy') { const t = Date.now(); while (Date.now() - t < 3000); res.end('heavy') }
else res.end('ok')
```

Gọi `/heavy` trước, 100ms sau gọi `/light`:

```js
{ p: '/heavy', ms: 3021 }
{ p: '/light', ms: 4 }      ← ??? chỉ 4ms
```

Con số `4` gây hiểu nhầm nếu đọc vội: nó là thời gian **kể từ lúc request được gửi đi** trong
tiến trình client cùng luồng — nhưng client này cũng bị chặn, nó chỉ gửi được request sau khi
`/heavy` xong. Bài học đúng là: **cả tiến trình đứng im 3 giây**, mọi thứ xếp hàng sau nó, kể cả
health check của load balancer. Đó là lý do một endpoint export Excel nặng có thể khiến k8s giết
pod vì tưởng nó chết.

**Cách trả lời ăn điểm:** "Đơn luồng ở tầng JS. Em quan tâm nhất tới hệ quả: mọi việc CPU-bound
phải đẩy ra khỏi luồng chính, bằng `worker_threads` nếu cần kết quả ngay, hoặc bằng queue nếu
không."

</details>

### 2. Thứ tự chạy của `setTimeout(0)`, `setImmediate`, `process.nextTick`, Promise?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đồng bộ chạy hết trước. Rồi tới `process.nextTick` (hàng riêng, ưu tiên cao
nhất), rồi microtask của Promise/`queueMicrotask`, rồi mới tới các pha của event loop
(`setTimeout` ở pha timers, `setImmediate` ở pha check).

**Giải thích sâu:** Chạy thật:

```js
console.log('1 sync');
setTimeout(() => console.log('2 timeout 0'), 0);
setImmediate(() => console.log('3 immediate'));
Promise.resolve().then(() => console.log('4 microtask'));
process.nextTick(() => console.log('5 nextTick'));
queueMicrotask(() => console.log('6 queueMicrotask'));
console.log('7 sync cuoi');
```
```
1 sync
7 sync cuoi
5 nextTick          ← hàng nextTick vét sạch trước
4 microtask         ← rồi tới microtask, theo đúng thứ tự khai báo
6 queueMicrotask
2 timeout 0
3 immediate
```

Hai điểm hay bị hỏi móc:

- **`nextTick` không phải microtask.** Nó là hàng riêng của Node, được vét sạch trước hàng
  microtask sau *mỗi* thao tác. Đệ quy `process.nextTick` vô hạn sẽ **treo event loop** trong khi
  đệ quy `setImmediate` thì không.
- **`setTimeout(0)` và `setImmediate` ở top-level không có thứ tự bảo đảm.** Chạy đoạn trên nhiều
  lần có thể ra thứ tự khác, vì nó phụ thuộc vào việc vòng lặp mất bao lâu để khởi động. Nhưng
  **bên trong một I/O callback** thì `setImmediate` luôn chạy trước, vì lúc đó vòng lặp đang ở pha
  poll và pha check nằm ngay sau.

</details>

### 3. Việc nặng CPU thì xử lý thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ba lựa chọn theo thứ tự nên cân nhắc: (1) đừng làm nó đồng bộ trong request —
đẩy vào queue và trả `202 Accepted`; (2) `worker_threads` nếu cần kết quả trong cùng request;
(3) tách hẳn ra service riêng nếu nó là nghiệp vụ lớn.

**Giải thích sâu:** Đo lợi ích thật của `worker_threads` — cộng dồn 300 triệu số, 4 lần:

```
so CPU: 10
4 lan tuan tu tren main thread: 1509 ms
4 lan tren 4 worker_threads:     423 ms     ← nhanh 3.6x, và main thread rảnh
```

Con số 3.6x (không phải 4x) là chi phí khởi tạo worker — mỗi `new Worker` dựng một V8 isolate
riêng, tốn cỡ vài chục ms và vài MB RAM. Vì vậy **đừng tạo worker cho từng request**; dùng pool
(`piscina` hoặc tự viết) và tái sử dụng.

Điều quan trọng hơn con số: trong 1509ms kia, server **không trả lời được ai cả**. Với worker,
main thread vẫn nhận request bình thường.

Khi nào **không** dùng worker_threads: việc chỉ vài ms (chi phí truyền message ăn hết lợi), hoặc
việc kéo dài hàng phút (nên là job nền có thể retry, không nên gắn với vòng đời một HTTP request).

</details>

### 4. `worker_threads` khác `cluster` khác `child_process` ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `cluster` nhân bản **cả tiến trình** để tận dụng nhiều CPU cho nhiều request
song song. `worker_threads` là nhiều luồng **trong một tiến trình**, chia sẻ được bộ nhớ qua
`SharedArrayBuffer`. `child_process` để chạy chương trình khác (kể cả không phải Node).

**Giải thích sâu:**

| | cluster | worker_threads | child_process |
|---|---|---|---|
| Đơn vị | tiến trình | luồng | tiến trình |
| Bộ nhớ | tách biệt hoàn toàn | chia sẻ được `SharedArrayBuffer` | tách biệt |
| Chi phí tạo | cao (~30–50 MB/worker) | trung bình | cao |
| Dùng cho | scale HTTP theo số CPU | tính toán nặng trong 1 request | gọi ffmpeg, python… |
| Một worker chết | các worker khác sống | **cả tiến trình có thể chết** | tiến trình cha sống |

Bẫy hay gặp: **`cluster` không chia sẻ state.** Nếu bạn để cache trong biến toàn cục hoặc để
session in-memory, mỗi worker giữ một bản khác nhau và user sẽ thấy hành vi nhảy nhót tuỳ request
rơi vào worker nào. Đó là lý do session phải nằm ở Redis chứ không phải RAM.

Bẫy thứ hai: chạy `cluster` **bên trong container** thì thường thừa. Với k8s, cách chuẩn là 1
tiến trình Node / 1 pod và scale bằng số pod — vì scheduler đã lo phân phối, và mỗi pod chết độc
lập thì rollout an toàn hơn.

</details>

### 5. Backpressure là gì? Vì sao đọc file lớn bằng `readFileSync` là sai?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Backpressure là cơ chế để bên nhận nói với bên gửi "chậm lại, tôi chưa xử lý
kịp". Đọc cả file vào RAM thì không có bên nào nói được câu đó — bộ nhớ tăng tuyến tính theo kích
thước dữ liệu.

**Giải thích sâu:** Đo trên file NDJSON 97 MB, 800 nghìn dòng:

```
                            RSS trước   RSS sau    thời gian
readFileSync + split + map    39 MB     578 MB      708 ms
readline stream               39 MB      70 MB      578 ms
```

**Gấp 8 lần bộ nhớ mà không nhanh hơn.** 97 MB text thành 578 MB RSS vì mỗi dòng JSON hoá thành
object JS với header, pointer, string UTF-16 — phình 5–6 lần là bình thường.

Điểm chí mạng: con số 578 MB đó là cho **một** request. Mười người bấm "export" cùng lúc là 5.8 GB
và container bị OOMKilled. Streaming giữ mức RAM **không đổi** dù file 97 MB hay 970 MB.

Cách nói ở phỏng vấn: "Em quan tâm bộ nhớ có tỷ lệ thuận với dữ liệu không. Nếu có thì hệ thống
chỉ chạy được cho tới ngày dữ liệu lớn lên — và ngày đó luôn tới."

Trong Express, cùng nguyên tắc áp cho response: `res.json(hugeArray)` dựng cả chuỗi trong RAM;
nên dùng `pipeline(dbCursorStream, jsonStringifyStream, res)` để RAM phẳng và client nhận được
byte đầu tiên sớm.

</details>

### 6. `Promise.all` / `allSettled` / `race` / `any` — chọn cái nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `all` fail-fast (một cái lỗi là hỏng cả), `allSettled` luôn đợi hết và báo cáo
từng cái, `race` lấy kết quả **đầu tiên** kể cả đó là lỗi, `any` lấy cái **thành công** đầu tiên.

**Giải thích sâu:** Đo với 2 promise: `x` resolve sau 10ms, `y` reject sau 5ms:

```
F all reject: y
F allSettled: [{"status":"fulfilled","value":"x"},{"status":"rejected","reason":{}}]
```

Ba điều senior cần nói thêm:

1. **`Promise.all` không huỷ các promise còn lại.** Khi `y` reject, `x` vẫn chạy tiếp tới cùng.
   Nếu `x` là một `INSERT`, dữ liệu vẫn được ghi dù bạn tưởng "cả cụm đã fail". Muốn huỷ thật thì
   phải truyền `AbortSignal`.
2. **`reason` bị mất khi `JSON.stringify`** — thấy ngay trong output trên: `Error` serialize ra
   `{}`. Log lỗi bằng `JSON.stringify` là cách phổ biến nhất để mất sạch thông tin sự cố.
3. **`Promise.all` không giới hạn số lượng.** `Promise.all(10000 ids.map(fetchUser))` mở 10 nghìn
   kết nối cùng lúc, làm sập chính DB của bạn. Cần giới hạn đồng thời (`p-limit`, hoặc chia lô).

</details>

### 7. Đoạn code này sai ở đâu?

```js
async function loi(){ throw new Error('vo tinh nuot') }
try { loi() } catch (e) { console.log('bat duoc?', e.message) }

[1,2,3].forEach(async n => { await luuDB(n) });
console.log('xong het');
```

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hai lỗi. Thiếu `await` trước `loi()` nên `catch` không bắt được gì — lỗi thành
unhandled rejection. Và `forEach` không đợi callback `async`, nên `'xong het'` in ra khi chưa item
nào lưu xong.

**Giải thích sâu:** Chạy thật:

```
--- vong lap sai ---
ham sai() da tra ve, chua item nao xong     ← in trước
UNHANDLED: vo tinh nuot                      ← catch không bắt được
forEach xong 1
forEach xong 2
forEach xong 3
```

Dòng `'bat duoc?'` **không hề được in**. `loi()` trả về một Promise bị reject; `try/catch` chỉ bắt
throw đồng bộ.

Sửa:

```js
try { await loi() } catch (e) { ... }

for (const n of [1,2,3]) await luuDB(n);          // tuần tự, có backpressure
await Promise.all([1,2,3].map(n => luuDB(n)));    // song song, nếu DB chịu được
```

Vì sao đây là câu hỏi senior: unhandled rejection **giết tiến trình** từ Node 15 trở đi
(`--unhandled-rejections=throw` là mặc định). Một chỗ quên `await` trong nhánh lỗi hiếm gặp = pod
restart lúc 3 giờ sáng, và log thường không chỉ được dòng nào gây ra.

</details>

### 8. Vì sao hash mật khẩu phải chậm? Chậm bao nhiêu là đủ?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì kẻ tấn công lấy được database sẽ thử hàng tỷ mật khẩu offline. Hash nhanh
giúp chúng thử nhanh. Mốc thực dụng: **50–250 ms cho một lần hash** trên phần cứng production.

**Giải thích sâu:** Đo trên máy này:

```
md5   : 0.333 ms
sha256: 0.032 ms          ← 30 nghìn lần/giây trên 1 lõi
pbkdf2 10000 vong:   1.7 ms
pbkdf2 100000 vong: 15.9 ms
pbkdf2 600000 vong: 95.1 ms    ← mức OWASP khuyến nghị hiện nay
scrypt N=16384:     41.2 ms
```

SHA-256 mất 0.032 ms. Một GPU làm việc đó nhanh hơn CPU hàng nghìn lần → toàn bộ danh sách mật
khẩu phổ biến bị dò trong vài phút. Với pbkdf2 600k vòng, cùng công sức đó chậm đi ~3000 lần.

Ba ý kèm theo mà người hỏi chờ nghe:

- **Salt là bắt buộc và phải ngẫu nhiên cho từng user**, nếu không hai người cùng mật khẩu sẽ có
  cùng hash và rainbow table lại dùng được.
- **Chọn thuật toán tốn bộ nhớ**: `bcrypt`, `scrypt`, `argon2` được thiết kế để GPU/ASIC không có
  lợi thế. `argon2id` là lựa chọn mặc định hiện nay; `bcrypt` vẫn ổn nhưng cắt mật khẩu ở 72 byte.
- **Chậm là con dao hai lưỡi**: 100 ms/lần hash nghĩa là endpoint login chỉ chịu được ~10
  request/giây trên 1 lõi. Cần rate limit ở tầng trước, nếu không chính cơ chế bảo mật thành lỗ
  hổng DoS.

</details>

### 9. So sánh chuỗi bí mật bằng `===` có vấn đề gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `===` dừng ngay ở byte đầu tiên khác nhau, nên thời gian so sánh rò rỉ **số ký
tự đầu đã đúng**. Kẻ tấn công đo thời gian phản hồi và dò ra bí mật từng ký tự. Dùng
`crypto.timingSafeEqual`.

**Giải thích sâu:**

```js
const a = Buffer.from('a'.repeat(32)), b = Buffer.from('a'.repeat(31)+'b');
crypto.timingSafeEqual(a, b)   // -> false, nhưng luôn duyệt hết 32 byte
```

Áp dụng ở đâu: so sánh API key, so sánh chữ ký webhook (Stripe, GitHub), so sánh token reset mật
khẩu, so sánh HMAC. **Không** áp dụng cho so sánh hash bcrypt — ở đó `bcrypt.compare` đã lo, và
bản thân hash không phải bí mật cần giấu.

Lưu ý thật thà nên nói ra: qua Internet, nhiễu mạng thường lớn hơn chênh lệch vài nano giây, nên
tấn công này khó ngoài phòng lab. Nhưng nó **miễn phí để phòng** — một dòng code — nên không có
lý do gì không làm. Nói được cả hai vế cho thấy bạn hiểu chứ không học vẹt.

</details>

### 10. Memory leak trong Node đến từ đâu, phát hiện thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bốn nguồn thường gặp: biến/Map toàn cục cứ lớn dần, listener đăng ký mà không
gỡ, closure giữ tham chiếu tới object lớn, và timer/interval không `clearInterval`. Phát hiện
bằng cách theo dõi `heapUsed` theo thời gian, rồi chụp heap snapshot ở hai thời điểm và so.

**Giải thích sâu:** Quy trình cụ thể khi RSS của pod cứ tăng đều:

```bash
# 1. Xác nhận là heap JS chứ không phải native
node --expose-gc -e "…"           # hoặc log process.memoryUsage() mỗi 30s
# heapUsed tăng đều + RSS tăng đều  -> leak trong JS
# heapUsed phẳng + RSS tăng         -> leak native (thư viện C++, Buffer chưa giải phóng)

# 2. Chụp snapshot
kill -USR2 <pid>                   # với node --inspect
# hoặc trong code:
require('v8').writeHeapSnapshot('/tmp/1.heapsnapshot')
```

Mở 2 snapshot trong Chrome DevTools → tab Memory → **Comparison**. Sắp theo "Delta". Constructor
nào tăng hàng chục nghìn object giữa 2 lần chụp chính là thủ phạm; cột "Retainers" chỉ ra ai đang
giữ nó.

Ví dụ leak kinh điển đáng kể ra:

```js
const cache = new Map();                       // không bao giờ xoá
app.get('/u/:id', async (req, res) => {
  if (!cache.has(req.params.id)) cache.set(req.params.id, await db.user(req.params.id));
  res.json(cache.get(req.params.id));
});
```

Đây không phải cache, đây là leak có chủ đích. Cache phải có **giới hạn** (LRU) và **TTL**. Nếu
key là dữ liệu do user điều khiển (id, query string), kẻ tấn công có thể bơm key vô hạn để làm
đầy RAM.

`WeakMap`/`WeakRef` giải quyết được trường hợp key là object và bạn muốn GC dọn tự do — nhưng
không dùng được khi key là string.

</details>

### 11. Graceful shutdown làm những gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nhận `SIGTERM` → ngừng nhận request mới → báo health check là "not ready" → chờ
các request đang chạy xong (có deadline) → đóng kết nối DB/queue → thoát. Không làm việc này thì
mỗi lần deploy là một nhúm user thấy lỗi 502.

**Giải thích sâu:** Trình tự đúng, và lý do từng bước:

```js
process.on('SIGTERM', async () => {
  isShuttingDown = true;               // 1. /readyz trả 503 ngay
  await sleep(5000);                   // 2. chờ LB/k8s ngừng gửi request mới
  server.close();                      // 3. ngừng nhận kết nối, request cũ chạy tiếp
  await Promise.race([                 // 4. deadline cứng
    waitForInflight(), sleep(15000)
  ]);
  await Promise.all([db.end(), redis.quit(), queue.close()]);
  process.exit(0);
});
```

Bước 2 là bước hầu như ai cũng bỏ và là nguyên nhân thật của lỗi 502 khi deploy: k8s **gửi
SIGTERM và cập nhật endpoint song song**, không theo thứ tự. Nếu bạn `server.close()` ngay lập
tức, sẽ có vài trăm ms mà LB vẫn còn đẩy request tới pod đã đóng cổng. Cái `sleep(5000)` đó không
phải hack — nó là khoảng đệ cho hệ thống phân tán hội tụ.

Bước 4 cần deadline vì `terminationGracePeriodSeconds` của k8s mặc định 30 giây; quá hạn là
`SIGKILL` và bạn mất luôn quyền dọn dẹp. Deadline của app phải **nhỏ hơn** của k8s.

Với worker xử lý queue thì khác: phải xử lý nốt job đang cầm rồi mới thoát, và job phải **idempotent**
để nếu bị giết giữa chừng, lần retry không gây tác dụng phụ kép.

</details>

### 12. Connection pool — đặt bao nhiêu là hợp lý?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ít hơn nhiều so với trực giác. Công thức hay dùng: `pool = (số lõi DB × 2) + số
đĩa`. Với một Postgres 4 lõi thì cỡ **10 kết nối** cho toàn bộ cụm app, không phải 100.

**Giải thích sâu:** Ba con số phải nhân với nhau và người ta hay quên:

```
pool size mỗi tiến trình × số tiến trình mỗi pod × số pod  =  tổng kết nối tới DB
      20                 ×          4            ×   10    =  800
```

`max_connections` mặc định của Postgres là 100. Ở con số 800, bạn nhận `FATAL: sorry, too many
clients already` — và nó xảy ra đúng lúc traffic cao nhất, tức lúc tệ nhất.

Vì sao pool lớn lại **chậm hơn**: mỗi kết nối Postgres là một tiến trình riêng. 800 tiến trình
tranh nhau 4 lõi thì context switch ăn hết CPU, và mỗi query chậm đi. Pool nhỏ biến hàng đợi từ
"trong DB" (nơi nó gây hại cho mọi người) thành "trong app" (nơi bạn kiểm soát và đo được).

Khi số pod thay đổi liên tục (autoscaling, hoặc serverless), câu trả lời đúng là đặt **PgBouncer**
ở giữa với transaction pooling — app mở bao nhiêu kết nối cũng được, PgBouncer chỉ giữ vài chục
kết nối thật tới DB.

Chỉ số cần theo dõi: **thời gian chờ lấy kết nối từ pool**. Nếu nó > 0 đều đặn thì pool đang là
nút cổ chai; nếu nó bằng 0 mà DB vẫn chậm thì vấn đề nằm ở query chứ không ở pool.

</details>

### 13. `SIGTERM`, `SIGKILL`, `SIGINT` khác nhau thế nào với ứng dụng của bạn?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `SIGINT` (Ctrl+C) và `SIGTERM` (docker stop, k8s) đều **bắt được** — bạn có cơ
hội dọn dẹp. `SIGKILL` (kill -9, hết grace period, OOMKiller) **không bắt được** — tiến trình
biến mất ngay giữa chừng.

**Giải thích sâu:** Hệ quả cần chuẩn bị: vì `SIGKILL` luôn có thể xảy ra, hệ thống phải đúng
**kể cả khi bị giết giữa hai lệnh bất kỳ**. Đó là lý do:

- Job trong queue cần visibility timeout + retry, không phải "đánh dấu đã lấy rồi quên".
- Ghi DB nhiều bước phải nằm trong transaction, hoặc dùng outbox pattern.
- File tạm phải dọn lúc khởi động, không chỉ lúc thoát.

Trong Docker, `docker stop` gửi `SIGTERM` rồi đợi 10 giây rồi `SIGKILL`. Bẫy phổ biến: viết
`CMD npm start` thì PID 1 là `sh`, và `sh` **không chuyển tiếp tín hiệu** cho tiến trình con →
app không bao giờ nhận `SIGTERM`, luôn bị `SIGKILL` sau 10 giây. Sửa bằng `CMD ["node","server.js"]`
(exec form) để Node là PID 1.

</details>

### 14. Khi nào một cuộc gọi mạng cần timeout, retry, circuit breaker?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Timeout: **luôn luôn**, không có ngoại lệ. Retry: chỉ cho lỗi tạm thời và chỉ
khi thao tác idempotent. Circuit breaker: khi phụ thuộc đó có thể chết mà bạn vẫn phải sống.

**Giải thích sâu:**

**Timeout.** Mặc định của nhiều HTTP client là *không có timeout*. Một upstream treo là toàn bộ
pool kết nối của bạn bị giữ, rồi tới lượt bạn treo — sự cố lan ngược lên. Cần **hai** loại:
connect timeout (vài trăm ms) và read/overall timeout (theo SLA của bạn).

**Retry.** Ba luật:
1. Chỉ retry lỗi tạm: timeout, 502/503/504, lỗi kết nối. **Không** retry 400/401/422 — nó sẽ sai
   y hệt lần nữa.
2. Backoff **có jitter**. Không jitter thì 1000 client cùng retry ở giây thứ 2, thứ 4, thứ 8 —
   bạn tự tạo DDoS lên upstream vừa hồi phục (thundering herd).
3. Giới hạn tổng thời gian, không chỉ số lần. 5 lần retry × 30 giây timeout = user chờ 2.5 phút.

**Circuit breaker.** Khi tỷ lệ lỗi vượt ngưỡng, ngừng gọi trong X giây và fail nhanh. Lợi ích
kép: bạn không lãng phí luồng chờ thứ đã chết, và upstream có không gian để hồi phục thay vì bị
đấm liên tục. Sau X giây cho qua vài request thăm dò (half-open).

Câu chốt ăn điểm: "Retry không có breaker là cách biến một sự cố nhỏ ở upstream thành sự cố lớn ở
toàn hệ thống."

</details>

### 15. Idempotency là gì và cài thế nào cho một API thanh toán?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Gọi lại cùng một yêu cầu nhiều lần cho kết quả giống hệt gọi một lần. Cài bằng
`Idempotency-Key` do client sinh, lưu vào bảng có ràng buộc unique, trả lại kết quả cũ khi thấy
key trùng.

**Giải thích sâu:** Vì sao bắt buộc: client bấm "Thanh toán", mạng rớt ở giây thứ 29. Client
**không biết** giao dịch đã thành công hay chưa. Nếu nó retry mà server không idempotent, user bị
trừ tiền hai lần.

Cài đặt, phần quan trọng nằm ở chi tiết:

```sql
CREATE TABLE idempotency_keys (
  key         text PRIMARY KEY,
  request_fingerprint text NOT NULL,   -- hash của body
  status      text NOT NULL,           -- 'in_progress' | 'done'
  response    jsonb,
  created_at  timestamptz DEFAULT now()
);
```

```
1. INSERT key với status='in_progress'.
   - Nếu vi phạm PRIMARY KEY -> đã có request này rồi:
       + status='done'         -> trả lại `response` đã lưu, HTTP 200
       + status='in_progress'  -> trả 409, bảo client thử lại sau
2. Chạy nghiệp vụ VÀ cập nhật status='done' + response TRONG CÙNG MỘT TRANSACTION.
3. Job dọn key cũ hơn 24–72 giờ.
```

Ba chi tiết phân biệt người đã làm thật:

- **`request_fingerprint`**: nếu cùng key nhưng body khác, phải trả lỗi. Không kiểm thì một bug ở
  client (dùng lại key) sẽ làm giao dịch 5 triệu trả về kết quả của giao dịch 50 nghìn.
- **Bước 2 phải cùng transaction.** Nếu ghi nghiệp vụ xong mới cập nhật key mà tiến trình chết ở
  giữa, key kẹt ở `in_progress` vĩnh viễn.
- **Key do client sinh**, không phải server. Server sinh thì client không có gì để gửi lại khi
  chính response bị mất.

</details>

### 16. Vì sao trong Node không nên dùng biến toàn cục để lưu context của request?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì một tiến trình xử lý nhiều request xen kẽ nhau. Biến toàn cục bị request sau
ghi đè trong lúc request trước còn đang `await` — dữ liệu của user A rò sang user B.

**Giải thích sâu:** Bug này chạy ổn trên máy dev (1 request/lần) và hỏng trên production:

```js
let currentUser;                                  // SAI
app.use((req,res,next) => { currentUser = req.user; next() });
app.get('/me', async (req,res) => {
  const data = await db.query(...);               // ← chỗ nhường luồng
  res.json({ user: currentUser, data });          // có thể là user của request KHÁC
});
```

Giữa `await` và dòng sau nó, event loop chạy middleware của request khác và ghi đè `currentUser`.
Đây là loại lỗi bảo mật tệ nhất: hiếm, không tái hiện được, và làm lộ dữ liệu người dùng.

Giải pháp đúng của Node là `AsyncLocalStorage` — nó gắn context vào **chuỗi async**, mỗi request
có kho riêng và tự đi theo mọi `await`:

```js
const als = new AsyncLocalStorage();
app.use((req,res,next) => als.run({ user: req.user, reqId: randomUUID() }, next));
// ở bất kỳ đâu sâu trong call stack:
logger.info({ reqId: als.getStore().reqId }, 'da luu don hang');
```

Ứng dụng hay nhất của nó là **request id trong log**: không phải truyền `reqId` qua 8 tầng hàm mà
vẫn ghép được toàn bộ log của một request lại với nhau khi debug.

</details>

---

Tiếp: [02-database-va-truy-van.md](./02-database-va-truy-van.md)
