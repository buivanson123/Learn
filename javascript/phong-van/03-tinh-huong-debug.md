# 12 tình huống debug

Mỗi tình huống cho **code + triệu chứng thật**. Nhiệm vụ: chỉ ra nguyên nhân, giải thích cơ chế,
và sửa.

Đây là dạng câu hỏi phân biệt rõ nhất Junior với Middle — Junior đọc code tìm lỗi cú pháp,
Middle đọc **triệu chứng** rồi suy ngược ra cơ chế.

Tự chẩn đoán trước khi mở đáp án.

---

## Tình huống 1 — Nút bấm hoạt động một nửa số lần

Một hàm render tự viết, có diff nên **dùng lại DOM node cũ** thay vì tạo lại:

```js
function capNhat(li, item) {
  const cb = li.querySelector('input');
  cb.checked = item.xong;                                  // dùng lại node cũ
  cb.addEventListener('change', () => doiXong(item.id));    // gắn handler mới
}
// `doiXong` cập nhật state rồi gọi lại render -> capNhat chạy lại trên CÙNG node
```

**Triệu chứng:** Ngay sau khi tải trang, bấm checkbox **hoạt động**. Bấm lần nữa thì **không có
gì xảy ra**. Bấm tiếp thì lại hoạt động. Console **không có lỗi nào**.

<details><summary>Đáp án</summary>

**Nguyên nhân:** listener **cộng dồn**. `capNhat` dùng lại node cũ nhưng gọi
`addEventListener` mỗi lần, và handler là **hàm mới mỗi lượt** (`() => doiXong(item.id)`) nên
trình duyệt coi nó là một listener khác và thêm vào chứ không thay thế.

Sau `n` lần render có `n` listener. Mỗi click chạy cả `n` handler, mỗi cái toggle một lần:

| Số lần render trước khi click | Listener | Số toggle | Kết quả |
|---|---|---|---|
| 0 (vừa tải trang) | 1 | 1 | ✅ đổi |
| 1 | 2 | 2 | ❌ không đổi |
| 2 | 3 | 3 | ✅ đổi |

Số chẵn toggle đưa trạng thái về đúng chỗ cũ → **trông như không có gì xảy ra**. Đó chính xác là
triệu chứng "hoạt động một nửa số lần".

Đây cũng là **rò rỉ bộ nhớ**: mỗi listener giữ một closure giữ `item`.

**Cách xác nhận chẩn đoán trước khi sửa:** trong Chrome DevTools chọn element rồi vào tab
**Event Listeners** — bạn thấy nhiều listener `change` giống hệt nhau. Hoặc trong console:

```js
getEventListeners($0).change.length      // -> tăng dần sau mỗi lần render
```

**Sửa — dispatcher ổn định + `WeakMap`:**

```js
const handlerCuaEl = new WeakMap();

function datHandler(el, ten, fn, signal) {
  let bang = handlerCuaEl.get(el);
  if (!bang) { bang = {}; handlerCuaEl.set(el, bang) }
  const laMoi = !(ten in bang);
  bang[ten] = fn;                     // render lại chỉ THAY giá trị trong map
  if (laMoi) el.addEventListener(ten, (e) => handlerCuaEl.get(el)?.[ten]?.(e), { signal });
}

function capNhat(li, item) {
  const cb = li.querySelector('input');
  cb.checked = item.xong;
  datHandler(cb, 'change', () => doiXong(item.id), signal);    // ✅ luôn đúng 1 listener
}
```

Ba lý do dùng `WeakMap` chứ không `el._handlers = {}`: không làm bẩn DOM node · node bị xoá thì
bảng handler **tự biến mất** (không rò rỉ) · dispatcher gắn đúng một lần nên số listener không
phụ thuộc số lần render.

Đây là bug tôi **thật sự mắc phải** khi viết dự án bài 15 — chi tiết ở
[bài 15 mục 5](../15-du-an-mini-framework.md).

Nó cùng gốc với bẫy `bind`:

```js
el.removeEventListener('click', this.f.bind(this));   // ❌ hàm mới, không gỡ được gì
```

**Gốc rễ chung: hàm được tạo tại chỗ thì không so bằng `===` được.** Mỗi khi thấy
`addEventListener` với một hàm viết inline, hãy hỏi: *đoạn code này có thể chạy hai lần không?*

</details>

---

## Tình huống 2 — API trả về đúng nhưng UI trống

```js
async function taiDanhSach(ids) {
  const kq = [];
  for (const id of ids) {
    tai(id).then(r => kq.push(r));
  }
  return kq;
}

const ds = await taiDanhSach([1, 2, 3]);
console.log(ds.length);
```

**Triệu chứng:** tab Network cho thấy cả 3 request đều trả 200 với dữ liệu đầy đủ. Nhưng
`ds.length` là `0`. Thỉnh thoảng tiến trình Node còn chết hẳn.

<details><summary>Đáp án</summary>

**Nguyên nhân:** `return kq` chạy ngay khi vòng lặp **khởi động** xong — trước khi promise nào
hoàn thành. `await` bên ngoài không giúp gì: `taiDanhSach` là `async` nên trả về promise, nhưng
promise đó resolve **ngay lập tức** với mảng rỗng.

`.then(r => kq.push(r))` chạy sau đó, đẩy dữ liệu vào một mảng mà không ai còn nhìn nữa.

**Vì sao tiến trình chết:** nếu `tai(2)` reject, không có `.catch` nào trên chuỗi đó →
`unhandledRejection` → Node 15+ **giết tiến trình**. Trong trình duyệt thì chỉ có một dòng đỏ
trong console, nên bug này sống rất lâu ở frontend.

**Sửa:**

```js
async function taiDanhSach(ids) { return Promise.all(ids.map(tai)) }
```

Nếu một cái lỗi không được kéo đổ cả mẻ:

```js
async function taiDanhSach(ids) {
  const kq = await Promise.allSettled(ids.map(tai));
  for (const x of kq) if (x.status === 'rejected') logger.warn(x.reason);
  return kq.filter(x => x.status === 'fulfilled').map(x => x.value);
}
```

**Dấu hiệu chung để nhận ra loại bug này:** trong một hàm `async`, có `.then` mà không có
`await` hoặc `return` của promise đó. ESLint rule `@typescript-eslint/no-floating-promises`
bắt được.

</details>

---

## Tình huống 3 — Thanh tiến trình nhảy thẳng 0% → 100%

```js
async function nhap(items) {
  for (let i = 0; i < items.length; i++) {
    await luuVaoIndexedDB(items[i]);
    thanhTienTrinh.style.width = (i / items.length * 100) + '%';
  }
}
```

**Triệu chứng:** với 50 000 item, thanh tiến trình đứng ở 0% suốt 8 giây rồi nhảy thẳng lên
100%. Trong lúc đó trang không nhận click. Nhưng với 100 item thì chạy mượt.

<details><summary>Đáp án</summary>

**Nguyên nhân:** `luuVaoIndexedDB` resolve trong cùng một nhịp microtask (dữ liệu nhỏ, IndexedDB
gộp transaction). Cả 50 000 vòng lặp chạy hết trong **một** lần vét microtask.

Nhớ luật: event loop **vét sạch** hàng đợi microtask trước khi làm bất cứ việc gì khác. Trình
duyệt chưa bao giờ tới được bước "tính style → layout → paint", nên `style.width` bị ghi 50 000
lần mà **không lần nào lên màn hình**.

Đó cũng là lý do trang không nhận click: xử lý sự kiện DOM là **macrotask**.

Với 100 item thì mượt vì tổng thời gian quá ngắn để nhận ra.

**Sửa:**

```js
async function nhap(items) {
  for (let i = 0; i < items.length; i++) {
    await luuVaoIndexedDB(items[i]);
    if (i % 200 === 0) {
      thanhTienTrinh.style.width = (i / items.length * 100) + '%';
      await new Promise(r => requestAnimationFrame(r));    // ✅ nhả luồng, đợi đúng 1 khung
    }
  }
  thanhTienTrinh.style.width = '100%';
}
```

Hai cải tiến: **nhả luồng** (bắt buộc), và **chỉ ghi DOM mỗi 200 item** — mắt chỉ thấy được
khoảng 60 lần/giây, ghi 50 000 lần là lãng phí.

`requestAnimationFrame` đúng hơn `setTimeout(0)` vì nó đánh thức bạn **ngay trước** lần vẽ tiếp
theo. Trên Chrome 152 có lựa chọn tốt hơn nữa: `await scheduler.yield()` — nhả luồng nhưng giữ
ưu tiên cao khi quay lại.

**Đo được mức độ:** 1 triệu microtask lồng nhau đẩy `setTimeout(f, 0)` tới **137 ms**.

</details>

---

## Tình huống 4 — Trang chậm dần sau vài phút dùng

```js
setInterval(async () => {
  const data = await fetch('/api/tin-tuc').then(r => r.json());
  const ds = document.querySelector('#tin');
  ds.innerHTML = '';
  for (const t of data) {
    ds.innerHTML += `<article>${t.tieuDe}</article>`;
  }
}, 5000);
```

**Triệu chứng:** mới mở thì mượt. Sau 10 phút, mỗi lần cập nhật làm trang khựng 2 giây. Task
Manager cho thấy tab dùng 1.2 GB.

<details><summary>Đáp án</summary>

**Ba vấn đề chồng lên nhau.**

**1. `innerHTML +=` trong vòng lặp — O(n²).** Mỗi lần nó serialize toàn bộ cây con thành chuỗi,
nối, **xoá sạch node con**, rồi parse lại từ đầu. Đo với 5000 phần tử: **7366 ms** so với
**1.9 ms** của cách gom chuỗi — chậm **3877 lần**.

**2. `setInterval` không bao giờ `clearInterval`.** Nếu component/route bị huỷ, nó vẫn chạy —
vẫn gọi API, vẫn tìm `#tin` (giờ là `null` → ném lỗi mỗi 5 giây), và closure giữ mọi thứ.

**3. Không huỷ request cũ.** Nếu API chậm hơn 5 giây, các request chồng lên nhau và kết quả về
không đúng thứ tự — bạn có thể hiển thị dữ liệu **cũ hơn** dữ liệu đang có (race condition).

**Sửa:**

```js
const ac = new AbortController();
let dangChay = null;

const id = setInterval(async () => {
  dangChay?.abort();                                   // ✅ huỷ request cũ
  dangChay = new AbortController();
  const sig = AbortSignal.any([ac.signal, dangChay.signal, AbortSignal.timeout(4000)]);
  try {
    const r = await fetch('/api/tin-tuc', { signal: sig });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);     // ✅ fetch không throw với 4xx/5xx
    const data = await r.json();
    const ds = document.querySelector('#tin');
    if (!ds) return;
    ds.replaceChildren(...data.map(t => {               // ✅ 1 thao tác, không parse HTML
      const a = document.createElement('article');
      a.textContent = t.tieuDe;
      return a;
    }));
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') return;   // ✅ bình thường
    logger.error(e);
  }
}, 5000);

// khi huỷ:
ac.abort();
clearInterval(id);
```

**Cách xác nhận chẩn đoán trước khi sửa:** chụp 3 heap snapshot cách nhau vài phút, so ở chế độ
**Comparison**. Nếu thấy `Detached HTMLArticleElement` tăng đều thì là vấn đề 1+2. Kiểm nhanh số
node DOM bằng `performance.memory` thì **vô dụng** — dùng CDP `Memory.getDOMCounters`.

</details>

---

## Tình huống 5 — Test xanh ở máy, đỏ trên CI

```js
it('lưu người dùng', async () => {
  const store = taoStore();
  store.dispatch(luuNguoiDung({ ten: 'A' }));
  expect(store.getState().nguoiDung.ten).toBe('A');
});
```

**Triệu chứng:** chạy `npm test` ở máy thì xanh 10/10 lần. Trên CI đỏ khoảng 3/10 lần, với
`expected undefined to be 'A'`.

<details><summary>Đáp án</summary>

**Nguyên nhân:** `dispatch` cập nhật state trong một microtask (bên trong có `await`). Dòng
`expect` chạy **đồng bộ ngay sau**, đọc state cũ.

**Vì sao "thỉnh thoảng":** một số đường đi trong reducer không có `await` thật — ví dụ khi có
cache, hoặc khi validate thất bại sớm. Máy bạn nhanh hơn/chậm hơn CI làm tỉ lệ trúng đường nào
thay đổi.

Đây **không phải** lỗi của CI. CI chỉ làm lộ ra một bug vốn đã có.

**Sửa — ba cách, theo thứ tự ưu tiên:**

```js
// 1. TỐT NHẤT: sửa API để dispatch trả về promise
await store.dispatch(luuNguoiDung({ ten: 'A' }));

// 2. Nếu không sửa được API: vét 1 nhịp microtask
await Promise.resolve();

// 3. Chắc chắn hơn: qua một macrotask -> vét SẠCH mọi microtask lồng nhau
await new Promise(r => setImmediate(r));           // Node
await new Promise(r => requestAnimationFrame(r));  // trình duyệt
```

**Cách sai mà nhiều người dùng:**

```js
await new Promise(r => setTimeout(r, 100));    // ❌ đợi bừa
```

Nó vừa làm test chậm, vừa **vẫn có thể thiếu** — chỉ là tỉ lệ đỏ giảm xuống chứ không về 0.
Test flaky "đỡ hơn" là test flaky bị che giấu.

Cách 2 chỉ vét **một** nhịp. Không đủ nếu bên trong có `await thenable` (tốn 2 nhịp) hoặc `await`
lồng nhau. Đó là lý do cách 3 chắc chắn hơn — nhưng cách 1 mới là câu trả lời đúng: **đừng đoán
số nhịp**.

</details>

---

## Tình huống 6 — Vòng lặp xoá class chỉ xoá được một nửa

```js
const items = document.getElementsByClassName('item');
console.log('trước:', items.length);
for (let i = 0; i < items.length; i++) {
  items[i].classList.remove('item');
}
console.log('sau:', items.length);
```

**Triệu chứng:** với 10 phần tử, output là `trước: 10` / `sau: 5`.

<details><summary>Đáp án</summary>

**Nguyên nhân:** `getElementsByClassName` trả về **HTMLCollection sống** — danh sách tự cập nhật
khi DOM đổi.

Lần lặp `i = 0` xoá class khỏi phần tử đầu → nó **rời khỏi collection** → mọi phần tử dịch xuống
một chỗ, `length` thành 9. Nhưng `i` tăng thành 1, nên phần tử vừa dịch vào vị trí 0 **bị bỏ qua**.

Kết quả: xử lý phần tử ở vị trí 0, 2, 4, 6, 8 của danh sách gốc — đúng một nửa.

**Bốn thứ trả về collection sống:**

```
getElementsByClassName    getElementsByTagName
getElementsByName         element.children      ← hay bị quên nhất
```

Đo thật với `element.children`:

```js
for (const c of el.children) c.remove();
// trước: 10 | còn lại sau for...of: 5
```

**Sửa — ba cách:**

```js
[...document.getElementsByClassName('item')].forEach(e => e.classList.remove('item'));
document.querySelectorAll('.item').forEach(e => e.classList.remove('item'));   // NodeList tĩnh
for (let i = items.length - 1; i >= 0; i--) items[i].classList.remove('item'); // duyệt ngược
```

Với `element.children`: `[...el.children].forEach(c => c.remove())` hoặc gọn nhất là
`el.replaceChildren()`.

**Quy tắc thực dụng:** luôn dùng `querySelectorAll` trừ khi bạn thật sự cần danh sách sống.

**Dấu hiệu nhận ra:** một vòng lặp DOM xử lý đúng một nửa, hoặc chạy vô hạn. Câu hỏi đầu tiên
luôn là **"danh sách này sống hay tĩnh?"**.

</details>

---

## Tình huống 7 — Server treo 0.8 giây mỗi vài phút

```js
app.get('/bao-cao', (req, res) => {
  const rows = JSON.parse(fs.readFileSync('du-lieu.json', 'utf8'));   // 80 MB
  const kq = rows.filter(r => r.thang === req.query.thang);
  res.json(kq);
});
```

**Triệu chứng:** p50 của **mọi** endpoint (kể cả `/health` chỉ trả `ok`) thỉnh thoảng vọt lên
800 ms. CPU không cao. Không có query DB nào chậm.

<details><summary>Đáp án</summary>

**Nguyên nhân:** `readFileSync` + `JSON.parse` **chặn event loop**. Trong lúc đó Node không xử
lý được request nào khác — kể cả `/health`.

Đó là lý do triệu chứng lan ra **mọi** endpoint, không chỉ `/bao-cao`. Và là lý do CPU không cao:
luồng đang chờ I/O đồng bộ, không phải tính toán.

Đo thật với file 191 MB, 20 lần:

```
20x readFileSync         : độ trễ event loop 795 ms
20x fs.promises.readFile : độ trễ event loop  40 ms
```

`JSON.parse` là ca đặc biệt: **không có bản bất đồng bộ**. Parse 80 MB chặn vài trăm ms và không
có cách nào tránh trên luồng chính.

**Sửa — nạp một lần lúc khởi động:**

```js
// Lúc khởi động — chặn ở đây hoàn toàn OK, chưa ai gửi request
const rows = JSON.parse(await fs.promises.readFile('du-lieu.json', 'utf8'));
const theoThang = Object.groupBy(rows, r => r.thang);      // ✅ lập chỉ mục sẵn

app.get('/bao-cao', (req, res) => {
  res.json(theoThang[req.query.thang] ?? []);              // O(1), không chặn
});
```

Ba mức cải tiến, theo thứ tự lợi ích: **bỏ hẳn việc lặp lại** (nạp 1 lần) → **bỏ chặn** (async)
→ **bỏ tìm tuyến tính** (`groupBy` sẵn).

**Cách chẩn đoán:** đo độ trễ event loop trong production.

```js
let last = Date.now();
setInterval(() => {
  const tre = Date.now() - last - 500;
  if (tre > 100) logger.warn('event loop trễ', tre, 'ms');
  last = Date.now();
}, 500);
```

Nếu file có thay đổi khi đang chạy, dùng `fs.watch` + debounce để nạp lại — vẫn không đọc trong
request. Nếu dữ liệu quá lớn để giữ trong RAM, đó là dấu hiệu nó nên nằm trong database.

</details>

---

## Tình huống 8 — Endpoint tải file làm crash server

```js
app.get('/tai-xuong', (req, res) => {
  const s = fs.createReadStream('bao-cao.csv');
  s.pipe(res);
  s.on('error', e => res.status(500).json({ loi: e.message }));
});
```

**Triệu chứng:** Đôi khi client nhận file rỗng với status 200. Đôi khi server crash với
`Error: EPIPE`. Số file descriptor mở tăng đều theo thời gian.

<details><summary>Đáp án</summary>

**Ba vấn đề, đúng ba triệu chứng.**

**1. File rỗng với status 200.** Nếu `createReadStream` lỗi, `pipe` có thể đã bắt đầu và `res`
đã gửi header 200. Lúc handler `error` chạy, `res.status(500)` **không có tác dụng** — header đã
đi rồi. Nếu `res.json` được gọi sau đó, Express còn ném `ERR_HTTP_HEADERS_SENT`.

**2. Crash với `EPIPE`.** Client đóng tab giữa lúc tải → `res` bị destroy → nhưng `s` **vẫn đọc
tiếp** và ghi vào socket đã đóng. `pipe()` không huỷ nguồn. Lỗi `EPIPE` không ai nghe →
`Unhandled 'error' event` → tiến trình chết.

**3. File descriptor rò rỉ.** Cùng nguyên nhân: `s` không bao giờ được đóng.

Đo thật chứng minh `pipe()` không chuyển lỗi — đã gắn handler cho đích, vẫn chết:

```
      throw er; // Unhandled 'error' event
Error: nguồn nổ
                          ← tiến trình BỊ GIẾT
```

**Sửa:**

```js
app.get('/tai-xuong', async (req, res) => {
  try { await fs.promises.access('bao-cao.csv', fs.constants.R_OK) }
  catch { return res.status(404).json({ loi: 'không có file' }) }   // ✅ kiểm TRƯỚC khi gửi byte nào

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bao-cao.csv"');

  try {
    await pipeline(fs.createReadStream('bao-cao.csv'), res);        // ✅ pipeline
  } catch (e) {
    if (e.code === 'ERR_STREAM_PREMATURE_CLOSE') return;            // client đóng tab — bình thường
    logger.error(e);
    if (!res.headersSent) res.status(500).end();                    // ✅ kiểm headersSent
  }
});
```

`pipeline` làm ba việc `pipe` không làm: chuyển lỗi ra ngoài, **huỷ mọi stream trong chuỗi** (hết
rò rỉ fd), và cho bạn `await`.

**Quy tắc: không dùng `.pipe()` trong code production.**

`ERR_STREAM_PREMATURE_CLOSE` sẽ xuất hiện rất nhiều trong log — gần như luôn là "người dùng đóng
tab", không phải bug. Lọc nó ra khỏi alert, nếu không bạn sẽ bị nhiễu và bỏ qua lỗi thật.

</details>

---

## Tình huống 9 — Hoá đơn tháng 2 nhảy sang tháng 3

```js
function hanThanhToan(ngayLap) {
  const d = new Date(ngayLap);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
```

**Triệu chứng:** hoá đơn lập ngày 31/01/2026 có hạn thanh toán `2026-03-03`. Hoá đơn lập ngày
15/01 thì đúng (`2026-02-15`). Ngoài ra khách hàng ở Việt Nam báo hạn hiển thị lệch một ngày.

<details><summary>Đáp án</summary>

**Hai bug riêng biệt.**

**Bug 1 — `setMonth` tràn tháng.** `2026-01-31` cộng 1 tháng thành `2026-02-31`, không tồn tại,
nên `Date` **tràn** sang `2026-03-02`.

```
new Date('2026-01-31')           -> 2026-03-03      ← sai
new Date('2026-01-31T00:00:00')  -> 2026-03-02      ← cũng sai, và KHÁC con số trên
Temporal.PlainDate.add(1 tháng)  -> 2026-02-28      ← kẹp về ngày cuối tháng
```

Hai dòng đầu đáng chú ý: **cùng một ngày, hai định dạng chuỗi, hai kết quả khác nhau.**
`'2026-01-31'` được parse là **UTC** nửa đêm, còn `'2026-01-31T00:00:00'` là **giờ địa phương** —
nên bug này còn phụ thuộc cả định dạng chuỗi bạn nhận từ backend.

Đây là hành vi **đặc tả** của `Date`, không phải bug của V8. Nó chỉ lộ ra với ngày 29, 30, 31 —
nên qua được mọi test viết bằng ngày 15.

**Bug 2 — `toISOString()` trả về UTC.**

```js
new Date('2026-09-10T06:00:00+07:00').toISOString().slice(0, 10)    // -> "2026-09-09"
```

Khách ở Việt Nam (UTC+7) thấy lệch một ngày với mọi thời điểm trước 7 giờ sáng.

**Sửa bằng `Temporal`** (Chrome 152 có sẵn; Node 22 dùng `temporal-polyfill`):

```js
function hanThanhToan(ngayLap) {
  return Temporal.PlainDate.from(ngayLap).add({ months: 1 }).toString();
}
```

`PlainDate` là kiểu đúng ở đây: hạn thanh toán là một **ngày trên lịch**, không phải một thời
điểm — nó không nên có múi giờ.

Nếu chưa dùng được `Temporal`:

```js
function hanThanhToan(ngayLap) {
  const [y, m, d] = ngayLap.split('-').map(Number);      // m là 1..12
  const cuoiThangSau = new Date(y, m + 1, 0).getDate();  // ngày 0 của tháng (m+2) = ngày cuối tháng (m+1)
  const thangSau = m + 1;
  const nam = thangSau > 12 ? y + 1 : y;
  const thang = thangSau > 12 ? 1 : thangSau;
  return `${nam}-${String(thang).padStart(2, '0')}-${String(Math.min(d, cuoiThangSau)).padStart(2, '0')}`;
}
```

Chạy thật với sáu ca biên:

```
2026-01-31 -> 2026-02-28      (kẹp về 28)
2026-01-15 -> 2026-02-15
2026-03-31 -> 2026-04-30      (kẹp về 30)
2026-05-31 -> 2026-06-30
2026-12-31 -> 2027-01-31      (sang năm)
2026-02-28 -> 2026-03-28
```

Số dòng cần thiết để làm đúng một phép "cộng một tháng" là lý do tốt nhất để dùng `Temporal`.

⚠️ `Temporal.PlainDate` là object — `===` **luôn** cho `false`. Dùng `.equals()` hoặc
`Temporal.PlainDate.compare()`.

**Bài học chung: mọi bug ngày tháng đều là bug múi giờ hoặc bug tràn.** Câu hỏi phải trả lời
trước khi viết dòng đầu tiên: *"hôm nay theo múi giờ của ai"* và *"cái này là thời điểm hay là
ngày trên lịch"*.

</details>

---

## Tình huống 10 — Bộ nhớ Node tăng đều, không bao giờ giảm

```js
const cache = new Map();

app.get('/nguoi-dung/:id', async (req, res) => {
  const key = req.params.id;
  if (!cache.has(key)) cache.set(key, await db.layNguoiDung(key));
  res.json(cache.get(key));
});
```

**Triệu chứng:** RSS tăng đều 50 MB mỗi giờ. Sau 20 giờ container bị giết với exit code `137`,
không có log nào từ Node.

<details><summary>Đáp án</summary>

**Nguyên nhân:** cache **không có giới hạn**. Mỗi ID mới thêm một entry sống vĩnh viễn. Với
người dùng đăng nhập liên tục, số ID là vô hạn theo thời gian.

Đây không phải "rò rỉ" theo nghĩa bug — code làm đúng những gì nó viết. Nhưng hậu quả giống hệt.

**Vì sao exit code 137 và không có log:** Node bị **OOM killer của hệ điều hành** giết bằng
`SIGKILL`, không phải Node tự báo hết bộ nhớ. Node không kịp ghi gì.

Nguyên nhân sâu hơn: Node đọc RAM của **máy chủ**, không phải giới hạn container. Kiểm:

```
$ node -e "console.log((require('v8').getHeapStatistics().heap_size_limit/1048576).toFixed(0),'MB')"
4144 MB
```

Container 512 MB nhưng Node tưởng nó có 4 GB → không GC tích cực → bị giết.

**Sửa — hai việc:**

```js
// 1. Cache có giới hạn (LRU từ bài tập 13) + TTL
const cache = new LRU(10_000);

app.get('/nguoi-dung/:id', async (req, res) => {
  const key = req.params.id;
  let v = cache.get(key);
  if (!v) { v = await db.layNguoiDung(key); cache.set(key, v) }
  res.json(v);
});
```

```bash
# 2. Nói cho Node biết giới hạn thật của container
node --max-old-space-size=400 app.js       # ~80% của 512 MB
```

Với `--max-old-space-size` đúng, khi hết bộ nhớ Node ném
`FATAL ERROR: JavaScript heap out of memory` **kèm stack trace** — bạn debug được. Không đặt thì
chỉ có exit code 137 câm lặng.

⚠️ Một bug nữa ẩn trong code gốc: nếu `db.layNguoiDung` ném lỗi, `cache.has(key)` vẫn `false` nên
mọi request sau đều gọi lại DB — **cache stampede**. Và nếu nó trả `null` (không có người dùng),
`cache.set` lưu `null` nhưng `if (!v)` coi như miss → cũng gọi lại DB mỗi lần. Dùng `cache.has()`
để phân biệt "chưa cache" với "cache giá trị rỗng".

**Cách chẩn đoán:** `require('v8').writeHeapSnapshot('/tmp/1.heapsnapshot')` ở hai thời điểm cách
nhau 1 giờ, kéo cả hai vào tab Memory của Chrome DevTools, so ở chế độ Comparison. Thấy `Map`
tăng đều là đủ kết luận.

</details>

---

## Tình huống 11 — Ô tìm kiếm hiển thị kết quả của từ khoá cũ

```js
input.addEventListener('input', async (e) => {
  const kq = await fetch(`/tim?q=${e.target.value}`).then(r => r.json());
  hienThi(kq);
});
```

**Triệu chứng:** gõ "javascript" nhanh, thỉnh thoảng kết quả hiển thị là của "javascr". Càng gõ
nhanh càng hay bị.

<details><summary>Đáp án</summary>

**Nguyên nhân:** **race condition**. Mỗi ký tự bắn một request. Chúng về **không đúng thứ tự** —
request cho "javascr" có thể về sau request cho "javascript", và `hienThi` ghi đè kết quả mới
bằng kết quả cũ.

Đây không phải bug của `await`. `await` chờ đúng promise của nó; vấn đề là có **nhiều** handler
đang chạy song song, mỗi cái với một promise riêng.

**Sửa — ba lớp, cần cả ba:**

```js
let dangChay = null;

const timKiem = debounce(async (q) => {
  dangChay?.abort();                              // 2. huỷ request cũ
  dangChay = new AbortController();
  const sig = AbortSignal.any([dangChay.signal, AbortSignal.timeout(5000)]);
  try {
    const r = await fetch(`/tim?q=${encodeURIComponent(q)}`, { signal: sig });   // 3. encode!
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    hienThi(await r.json());
  } catch (e) {
    if (e.name === 'AbortError' || e.name === 'TimeoutError') return;
    hienThiLoi(e);
  }
}, 250);                                          // 1. debounce

input.addEventListener('input', e => timKiem(e.target.value));
```

**1. Debounce** — bỏ hẳn phần lớn request. Đây là cải tiến lớn nhất: gõ "javascript" từ 10
request xuống 1.

**2. `AbortController`** — huỷ request cũ khi có request mới. Cần cả cái này vì debounce không
loại bỏ hết race (người dùng dừng 250 ms rồi gõ tiếp).

**3. `encodeURIComponent`** — bug ẩn trong code gốc: gõ `a&b=1` hoặc dấu `#` làm hỏng query.

Nếu không huỷ được request (API không nhận signal), dùng "token phiên":

```js
let phien = 0;
async function timKiem(q) {
  const cua = ++phien;
  const kq = await goi(q);
  if (cua !== phien) return;              // ✅ có phiên mới hơn -> bỏ kết quả này
  hienThi(kq);
}
```

Nhưng cách này vẫn tốn băng thông cho request đã vô nghĩa — `AbortController` tốt hơn.

</details>

---

## Tình huống 12 — Chạy tốt ở dev, hỏng sau khi build production

```js
// index.js của thư viện
import './dang-ky-polyfill.js';        // tự đăng ký, không export gì
export { tienIch } from './tien-ich.js';
```

```json
{ "name": "goi-cua-toi", "type": "module", "sideEffects": false }
```

**Triệu chứng:** `npm run dev` chạy hoàn hảo. Sau `npm run build`, ứng dụng ném
`TypeError: x.mocHam is not a function` — chính là hàm mà polyfill đăng ký.

<details><summary>Đáp án</summary>

**Nguyên nhân:** `"sideEffects": false` là lời hứa với bundler: *"import file nào trong gói này
mà không dùng gì trong đó thì cứ xoá luôn"*.

Dòng `import './dang-ky-polyfill.js'` không dùng gì từ file đó → bundler **xoá hẳn** → polyfill
không bao giờ chạy.

**Vì sao chỉ hỏng ở production:** dev server (Vite, webpack dev) **không tree-shake** — nó phục
vụ module gần như nguyên trạng để build nhanh. Tree-shaking chỉ chạy ở bản build.

Đây là loại bug tệ nhất: nó không xuất hiện trong vòng lặp phát triển, chỉ lộ ra sau khi deploy.

**Sửa — khai cụ thể thay vì `false`:**

```json
{
  "name": "goi-cua-toi",
  "type": "module",
  "sideEffects": ["./dist/dang-ky-polyfill.js", "*.css"]
}
```

Ba mẫu code khác cũng bị xoá mất bởi tree-shaking mà bạn không ngờ:

```js
Array.prototype.last = function () {...};      // sửa prototype builtin ở top level
export const client = new ApiClient();         // tạo instance ở top level (bị giữ, không bị xoá — nhưng chặn shake phần khác)
import './styles.css';                          // CSS bị xoá nếu sideEffects: false
```

**Cách kiểm chứng không cần dựng bundler:**

```bash
npx agadoo ./dist/index.mjs
```

Nó chỉ rõ **dòng nào** gây side effect. Chạy nó trong CI cho mọi gói bạn publish.

**Quy tắc:** `"sideEffects": false` chỉ đúng khi gói của bạn là **thuần hàm** — mọi file chỉ
export, không làm gì lúc được import. Nếu không chắc, khai danh sách cụ thể.

</details>

---

## Tự chấm

| Số tình huống chẩn đoán đúng | Mức |
|---|---|
| 1–4 | cần đọc lại phần giáo trình tương ứng |
| 5–8 | Junior khá / Middle đầu |
| 9–11 | **Middle vững** — mục tiêu của bộ này |
| 12 | Senior |

Điều được chấm không phải "tìm ra lỗi", mà là: **giải thích được cơ chế**, **nêu được cách xác
nhận chẩn đoán trước khi sửa**, và **nêu được cách phòng** (lint rule, kiểu dữ liệu, hoặc test).

Tiếp: [Checklist 109 mục](./04-tu-kiem-tra.md)
