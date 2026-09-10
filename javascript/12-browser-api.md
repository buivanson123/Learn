# Bài 12 — Browser API

> `fetch`, ba Observer, bốn kiểu lưu trữ, Worker, Web Components. Bài này tập trung vào **cái
> bẫy** của từng API — chỗ nó hành xử khác trực giác.

---

## 1. `fetch`: bốn hành vi bạn phải biết

```
ac.abort()               -> DOMException  name="AbortError"    message="signal is aborted without reason"  (102ms)
AbortSignal.timeout(150) -> DOMException  name="TimeoutError"  message="signal timed out"                  (151ms)
abort(lý do tuỳ chỉnh)   -> Error         "lý do riêng"
fetch trả 404            -> KHÔNG throw: ok=false status=404 body="khong thay"
server chết              -> TypeError     "Failed to fetch"
đọc body 2 lần           -> TypeError     "Failed to execute 'text' on 'Response': body stream already read"
```

### Bẫy 1 — `fetch` **không** ném lỗi với HTTP 4xx/5xx

```js
const r = await fetch('/khong-co-that');
// r.ok === false, r.status === 404, KHÔNG có exception
```

Nó chỉ reject khi **mạng** hỏng. Nghĩa là `try/catch` quanh `fetch` không bắt được lỗi 500 —
đây là bug số 1 với người mới chuyển từ `axios` (axios thì ném).

Luôn cần một lớp bọc:

```js
async function goi(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw Object.assign(new Error(`HTTP ${r.status} ${r.statusText}`), { status: r.status, body });
  }
  return r;
}
```

### Bẫy 2 — `TypeError: Failed to fetch` không nói gì cả

Một thông báo duy nhất cho: mất mạng, DNS sai, CORS bị chặn, server từ chối kết nối, chứng chỉ
sai. Trình duyệt **cố tình** không nói rõ vì lý do bảo mật.

Cách phân biệt trong thực tế:

```js
try { await fetch(url) }
catch (e) {
  if (e.name === 'AbortError')  { /* người dùng huỷ */ }
  else if (e.name === 'TimeoutError') { /* hết giờ */ }
  else if (!navigator.onLine)   { /* mất mạng — kiểm tra được */ }
  else { /* CORS hoặc server chết — xem tab Network, không xem console */ }
}
```

Với CORS, thông tin thật nằm trong **tab Network** của DevTools, không nằm trong `e.message`.

### Bẫy 3 — body chỉ đọc được **một lần**

```
đọc body 2 lần -> TypeError: Failed to execute 'text' on 'Response': body stream already read
```

`Response.body` là một stream. Cần đọc hai lần thì `clone()` **trước khi** đọc:

```js
const r = await fetch(url);
const banSao = r.clone();          // phải clone TRƯỚC khi đọc r
const text = await r.text();
const json = await banSao.json();
```

Đây là lý do lớp bọc ở Bẫy 1 phải cẩn thận: nếu nó đọc `r.text()` để lấy message lỗi thì
người gọi không đọc được nữa.

### Bẫy 4 — `AbortError` vs `TimeoutError`

Đo thật ở trên: `AbortSignal.timeout()` cho `name === "TimeoutError"`, **không phải**
`"AbortError"`. Code chỉ kiểm `AbortError` sẽ coi hết giờ là lỗi thật và hiện thông báo đỏ cho
người dùng.

Gộp cả hai tín hiệu:

```js
const signal = AbortSignal.any([ac.signal, AbortSignal.timeout(5000)]);
await fetch(url, { signal });
```

---

## 2. Bốn kiểu lưu trữ: chọn cái nào

| | Dung lượng | Đồng bộ? | Hết hạn | Gửi kèm request |
|---|---|---|---|---|
| `localStorage` | ~5 MB | **đồng bộ — chặn luồng** | không bao giờ | không |
| `sessionStorage` | ~5 MB | đồng bộ | đóng tab | không |
| Cookie | ~4 KB | đồng bộ | có `Expires` | **có — mọi request** |
| IndexedDB | hàng trăm MB+ | bất đồng bộ | không | không |

**Điều quan trọng nhất về `localStorage`: nó đồng bộ.** Mỗi lần đọc/ghi chặn luồng chính. Với
vài KB thì không thấy gì, nhưng lưu 2 MB JSON rồi `JSON.parse` mỗi lần khởi động là vài chục
ms chặn thẳng vào thời gian tải trang.

```js
// ⚠ Chạy mỗi lần app khởi động, trên luồng chính
const state = JSON.parse(localStorage.getItem('state'));
```

Với dữ liệu lớn hơn ~100 KB, dùng IndexedDB. API thô của nó rất khó dùng, nên trong thực tế
dùng một lớp bọc mỏng:

```js
// Đọc/ghi một khoá, đủ cho 90% trường hợp
const db = indexedDB.open('app', 1);
// hoặc: npm i idb-keyval  ->  import { get, set } from 'idb-keyval'
```

Ba điều nữa về `localStorage`:

1. Chỉ lưu **chuỗi**. `localStorage.setItem('a', {x:1})` lưu `"[object Object]"`.
2. Đầy thì ném `QuotaExceededError` — phải `try/catch`, đặc biệt trên Safari private mode nơi
   giới hạn là 0.
3. Sự kiện `storage` chỉ bắn ở **tab khác**, không bắn ở tab đã ghi. Dùng nó để đồng bộ nhiều
   tab (ví dụ: đăng xuất một tab thì các tab khác cũng đăng xuất).

---

## 3. Ba Observer: dùng thay cho việc nghe `scroll`/`resize`

```
IntersectionObserver  — element có nằm trong khung nhìn không (lazy load, infinite scroll)
ResizeObserver        — element đổi kích thước (không phải cửa sổ!)
MutationObserver      — DOM đổi cấu trúc
```

Chúng thay thế mẫu `addEventListener('scroll', ...)` + `getBoundingClientRect()`, và điều quan
trọng là **chúng không gây layout thrashing** ([bài 11](./11-dom-va-su-kien.md) mục 5) — số đo
được cung cấp sẵn trong callback.

```js
// Lazy load ảnh — không nghe scroll, không đo gì
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.src = e.target.dataset.src;
    io.unobserve(e.target);                  // ✅ ngừng theo dõi khi xong
  }
}, { rootMargin: '200px' });                 // tải trước khi vào khung 200px

document.querySelectorAll('img[data-src]').forEach(img => io.observe(img));
```

Ba chi tiết:

- **`rootMargin`** mở rộng vùng kích hoạt — đây là thứ làm lazy load "không thấy được".
- **`unobserve`** khi xong, nếu không thì callback chạy lại mỗi lần cuộn qua.
- `threshold: [0, 0.5, 1]` nếu cần biết mức độ hiện, không chỉ có/không.

`ResizeObserver` theo dõi **element**, không phải cửa sổ:

```js
new ResizeObserver(entries => {
  for (const e of entries) console.log(e.contentRect.width);
}).observe(el);
```

Nó bắn cả khi element đổi kích thước vì lý do khác cửa sổ (nội dung dài ra, sidebar mở). Đó là
thứ `window.onresize` không bao giờ biết.

⚠️ Nếu bạn **sửa kích thước** của chính element đang theo dõi trong callback, Chrome báo:

```
ResizeObserver loop completed with undelivered notifications.
```

Đó không phải cảnh báo vô hại — nó nghĩa là bạn đang tạo vòng lặp. Phải có điều kiện dừng.

Cả ba Observer đều cần `disconnect()` khi component bị huỷ — nếu không, chúng giữ element và
giữ closure ([bài 08](./08-bo-nho-va-ro-ri.md) mục 5).

---

## 4. Web Worker: đo thật lợi ích

```
mốc         : 30 khung / 500ms khi rảnh
chạy sync trên main thread: 372ms — vẽ được  0 khung
chạy trong Worker         : 409ms — vẽ được 26 khung
```

Worker **chậm hơn 10%** về tổng thời gian nhưng giữ được **26/30 khung**. Với người dùng, đây
là khác biệt giữa "app hỏng" và "app đang tải".

```js
// Tạo worker từ chuỗi, không cần file riêng
const blob = new Blob([`onmessage = (e) => { postMessage(tinhToanNang(e.data)) }`],
                      { type: 'text/javascript' });
const w = new Worker(URL.createObjectURL(blob));
w.postMessage(duLieu);
w.onmessage = (e) => console.log(e.data);
```

Bốn giới hạn của Worker:

1. **Không có DOM.** Không `document`, không `window`. Có `fetch`, `IndexedDB`,
   `OffscreenCanvas`.
2. **Truyền dữ liệu là sao chép** (structured clone). Gửi mảng 100 MB qua là copy 100 MB.
   Trừ khi dùng *transferable*:
   ```js
   w.postMessage(buf, [buf]);      // chuyển quyền sở hữu, 0 byte copy — buf ở bên này thành rỗng
   ```
3. **Không dùng được cho việc nhỏ.** Chi phí tạo worker + truyền message khoảng vài ms. Việc
   dưới ~50 ms thì làm luôn trên luồng chính còn nhanh hơn.
4. Số worker nên bằng `navigator.hardwareConcurrency`, không nhiều hơn.

**Khi nào dùng:** parse JSON/CSV lớn, xử lý ảnh, mã hoá, tính toán trên dataset. **Khi nào
không:** mọi thứ liên quan DOM, và mọi việc dưới 50 ms.

---

## 5. Web Components: vòng đời đã đo

```js
class X extends HTMLElement {
  static observedAttributes = ['v'];
  constructor() { super(); log('constructor'); this.attachShadow({ mode: 'open' }) }
  connectedCallback() { log('connectedCallback, shadowRoot=' + !!this.shadowRoot) }
  attributeChangedCallback(n, o, v) { log(`attributeChangedCallback ${n}: ${o} -> ${v}`) }
  disconnectedCallback() { log('disconnectedCallback') }
}
customElements.define('x-t', X);

const el = document.createElement('x-t');
el.setAttribute('v', '1');
document.body.append(el);
el.setAttribute('v', '2');
el.remove();
```

```
constructor
attributeChangedCallback v: null -> 1        ← TRƯỚC connectedCallback
connectedCallback (shadowRoot=true)
attributeChangedCallback v: 1 -> 2
disconnectedCallback
```

Điều đáng chú ý: **`attributeChangedCallback` chạy trước `connectedCallback`**. Nên nếu callback
đó cần DOM con hoặc cần đã ở trong document, nó sẽ vỡ. Mẫu an toàn:

```js
attributeChangedCallback(n, o, v) {
  this._props = { ...this._props, [n]: v };
  if (this.isConnected) this.render();      // ✅ chỉ render khi đã vào cây
}
connectedCallback() { this.render() }
```

Ba luật của `constructor` theo đặc tả — vi phạm là ném lỗi:

1. Phải gọi `super()` đầu tiên.
2. **Không** được đọc/ghi attribute.
3. **Không** được thêm node con.

`attachShadow` trong constructor thì được (như trên).

Còn hai thứ đáng biết, đều có trên Chrome 152:

```
declarative shadow DOM  ('shadowRootMode' in HTMLTemplateElement.prototype)  -> true
ElementInternals                                                             -> function
```

Declarative shadow DOM cho phép SSR web component — shadow root khai bằng HTML thuần, không cần
JS chạy:

```html
<x-t><template shadowrootmode="open"><p>đã có sẵn từ server</p></template></x-t>
```

---

## 6. Bài tập

### Bài 1 — Lớp bọc `fetch` này có ba lỗi

```js
async function goi(url) {
  try {
    const r = await fetch(url);
    return await r.json();
  } catch (e) {
    console.error('lỗi mạng:', e);
    return null;
  }
}
```

<details><summary>Gợi ý đáp án</summary>

**Lỗi 1 — không kiểm `r.ok`.** Response 404 hoặc 500 không ném lỗi. Nếu server trả trang HTML
lỗi thì `r.json()` mới nổ, với message `Unexpected token '<'` — hoàn toàn không liên quan tới
nguyên nhân thật.

**Lỗi 2 — thông báo "lỗi mạng" sai.** `catch` ở đây bắt cả lỗi parse JSON, lỗi abort, và lỗi
mạng. Log ra "lỗi mạng" cho một lỗi JSON làm người debug đi sai hướng ngay từ đầu.

**Lỗi 3 — trả `null` khi lỗi.** Người gọi không phân biệt được "API trả về null" với "gọi API
thất bại". Lỗi bị nuốt và xuất hiện lại ở chỗ khác dưới dạng
`Cannot read properties of null`.

```js
async function goi(url, { signal, timeoutMs = 10000 } = {}) {
  const sig = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  const r = await fetch(url, { signal: sig });       // ✅ để lỗi mạng nổi lên

  if (!r.ok) {                                       // ✅ kiểm status
    const body = await r.text().catch(() => '');
    throw Object.assign(new Error(`HTTP ${r.status} ${r.statusText}`),
                        { status: r.status, body, url });
  }

  const ct = r.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {            // ✅ kiểm trước khi parse
    throw new Error(`mong JSON, nhận "${ct}"`, { cause: await r.text() });
  }
  return r.json();
}
```

Nguyên tắc: **lớp bọc mạng không nên bắt lỗi**, nó nên *phân loại* lỗi rồi ném tiếp. Chỗ quyết
định "hiện gì cho người dùng" là tầng UI, không phải tầng gọi API.

</details>

### Bài 2 — Infinite scroll không dùng sự kiện `scroll`

Viết infinite scroll: khi người dùng cuộn gần cuối danh sách thì tải trang tiếp. Không dùng
`addEventListener('scroll')`.

<details><summary>Gợi ý đáp án</summary>

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
      const soMuc = await taiThem();
      if (soMuc === 0) { conNua = false; io.disconnect(); sentinel.remove() }
    } finally {
      dangTai = false;              // ✅ finally, để lỗi không làm treo vĩnh viễn
    }
  }, { rootMargin: '400px' });      // ✅ tải trước khi người dùng thấy đáy

  io.observe(sentinel);
  return () => { io.disconnect(); sentinel.remove() };   // ✅ hàm dọn dẹp
}
```

Bốn chi tiết bắt buộc:

1. **Cờ `dangTai`** — không có nó, `IntersectionObserver` bắn nhiều lần trong lúc request đang
   bay và bạn tải trùng trang 2 ba lần.
2. **`finally`** — nếu `taiThem()` ném lỗi mà `dangTai` không được reset, scroll chết vĩnh viễn.
3. **`rootMargin: '400px'`** — tải trước, người dùng không bao giờ thấy khoảng trống.
4. **Trả về hàm dọn dẹp** — gọi nó khi rời trang, nếu không thì observer giữ `sentinel` và
   `container` mãi mãi.

Vì sao không dùng `scroll`: sự kiện `scroll` bắn hàng chục lần mỗi giây, và cách kiểm tra bên
trong nó (`el.getBoundingClientRect()` hoặc `scrollTop + clientHeight >= scrollHeight`) đều
**ép tính layout** — đúng cái bẫy ở bài 11 mục 5, nhân với tần số cuộn.

</details>

### Bài 3 — Web component này rò rỉ và render sai

```js
class DongHo extends HTMLElement {
  static observedAttributes = ['mui-gio'];
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.timer = setInterval(() => this.render(), 1000);
  }
  attributeChangedCallback(n, o, v) { this.muiGio = v; this.render() }
  render() { this.shadowRoot.innerHTML = `<b>${gio(this.muiGio)}</b>` }
}
```

Nêu **ba** vấn đề.

<details><summary>Gợi ý đáp án</summary>

**Vấn đề 1 — `setInterval` trong constructor, không bao giờ dừng.** Element bị `remove()` vẫn
chạy `render()` mỗi giây, mãi mãi, và closure giữ cả element. Timer phải đặt trong
`connectedCallback` và xoá trong `disconnectedCallback`.

**Vấn đề 2 — `attributeChangedCallback` chạy trước `connectedCallback`** (đo ở mục 5). Ở đây
nó vô tình chạy được vì `shadowRoot` đã tạo trong constructor — nhưng đây là may mắn, không
phải thiết kế. Nếu ai sửa `attachShadow` sang `connectedCallback` thì nó nổ
`Cannot set properties of null`.

**Vấn đề 3 — `innerHTML` mỗi giây.** Nó phá và dựng lại node mỗi lần (bài 11 mục 4), làm mất
selection của người dùng và mọi listener bên trong. Chỉ cần cập nhật `textContent`.

```js
class DongHo extends HTMLElement {
  static observedAttributes = ['mui-gio'];
  #timer; #b;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#b = document.createElement('b');
    this.shadowRoot.append(this.#b);              // dựng cấu trúc MỘT lần
  }

  attributeChangedCallback(n, o, v) {
    this.muiGio = v;
    if (this.isConnected) this.render();          // ✅ chỉ render khi đã vào cây
  }

  connectedCallback() {
    this.render();
    this.#timer = setInterval(() => this.render(), 1000);   // ✅ bắt đầu ở đây
  }

  disconnectedCallback() {
    clearInterval(this.#timer);                   // ✅ dừng ở đây
  }

  render() { this.#b.textContent = gio(this.muiGio) }   // ✅ chỉ đổi text
}
```

Mẫu chung cho mọi custom element: **constructor dựng cấu trúc, `connectedCallback` khởi động
việc gì chạy liên tục, `disconnectedCallback` dừng đúng những thứ đó.**

Chú ý `connectedCallback` có thể chạy **nhiều lần** — mỗi lần element được di chuyển trong DOM
(`append` sang chỗ khác) là một lần `disconnected` + `connected`. Nên `connectedCallback` phải
chịu được việc gọi lại; đó là lý do đặt `clearInterval` cẩn thận:

```js
connectedCallback() {
  clearInterval(this.#timer);        // phòng trường hợp bị gọi lại
  this.#timer = setInterval(...);
}
```

</details>

---

**Tiếp theo:** [Bài 13 — Node.js runtime](./13-nodejs-runtime.md)
