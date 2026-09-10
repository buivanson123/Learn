# Bài 08 — Bộ nhớ và rò rỉ

> Bốn kiểu rò rỉ, mỗi kiểu kèm **số đo trước/sau** và cách tìm ra nó trong DevTools. Đây là
> bài bạn sẽ quay lại đọc khi có ticket "app dùng lâu thì chậm dần".

---

## 1. GC không phải phép màu: nó chỉ theo tham chiếu

V8 dùng **mark-and-sweep**: bắt đầu từ tập "gốc" (biến toàn cục, call stack hiện tại), đi
theo mọi tham chiếu, đánh dấu cái gặp được. Cái không được đánh dấu thì thu hồi.

Hệ quả duy nhất bạn cần nhớ: **object bị giữ chừng nào còn một đường đi tới nó từ gốc.**
"Không dùng nữa" không liên quan gì cả.

Rò rỉ trong JavaScript vì vậy **không phải** "quên giải phóng". Nó là **"quên bỏ tham chiếu"**.

---

## 2. Rò rỉ kiểu 1 — closure chia sẻ scope

Đã mổ ở [bài 01](./01-scope-closure-tdz.md) mục 5, nhắc lại số đo vì nó là kiểu khó thấy nhất:

```
20 closure không hàm nào dùng `big`               :   3.16 MB
20 closure có dùng `big`                          : 155.94 MB
20 closure KHÔNG dùng `big`, nhưng anh em nó có   : 155.94 MB   ← rò rỉ
```

**Dấu hiệu trong DevTools:** trong heap snapshot, chọn object lớn rồi xem panel *Retainers*.
Bạn sẽ thấy đường giữ là `context` → `function`. Chữ **`context`** trong retainer chain gần
như luôn có nghĩa "một closure đang giữ cái này".

---

## 3. Rò rỉ kiểu 2 — `Map` giữ khoá vĩnh viễn

```js
function grow(Container) {
  const c = new Container();
  for (let i = 0; i < 200000; i++) c.set({ i }, new Array(50).fill(i));
  return c;
}
```

```
bắt đầu       :   3.2 MB
Map 200k      : 103.9 MB   size = 200000
bỏ mảng keys  : 101.9 MB   size = 200000    ← vẫn còn
bỏ cả Map     :   3.3 MB
WeakMap 200k  :   7.3 MB   ← khoá không ai giữ nên bị thu hồi ngay
```

`Map` giữ **tham chiếu mạnh** tới cả khoá và giá trị. Object dùng làm khoá không bao giờ chết
được, kể cả khi mọi chỗ khác đã bỏ nó.

`WeakMap`/`WeakSet` giữ **tham chiếu yếu** tới khoá: khoá chết thì cặp key-value tự biến mất.
Giá 7.3 MB kia là chi phí sổ sách của chính `WeakMap`, không phải dữ liệu.

### Khi nào dùng cái nào

| | `Map` | `WeakMap` |
|---|---|---|
| Khoá | mọi kiểu | **chỉ object / Symbol chưa đăng ký** |
| Duyệt được (`keys()`, `size`) | ✅ | ❌ (cố ý — nội dung thay đổi theo GC) |
| Giữ khoá sống | ✅ | ❌ |
| Dùng cho | dữ liệu bạn sở hữu | **metadata gắn vào object của người khác** |

Mẫu chuẩn của `WeakMap` — gắn dữ liệu phụ vào DOM node hoặc instance mà không cản GC:

```js
const duLieuRieng = new WeakMap();

class Component {
  constructor(el) {
    duLieuRieng.set(el, { listeners: [], state: {} });   // node chết -> entry chết
  }
}
```

Đây chính xác là cách bạn sẽ theo dõi phụ thuộc trong dự án ở [bài 15](./15-du-an-mini-framework.md).

---

## 4. Rò rỉ kiểu 3 — detached DOM

Node đã `remove()` nhưng còn tham chiếu từ JS. Chúng **không nằm trong heap JS** nên
`Runtime.getHeapUsage` gần như không thấy — phải đếm bằng `Memory.getDOMCounters`:

```js
window.keep = [];
for (let i = 0; i < 20000; i++) {
  const d = document.createElement('div');
  d.append(document.createElement('span'));
  document.body.append(d);
  keep.push(d);        // ⚠ giữ lại
  d.remove();          // gỡ khỏi cây DOM
}
```

```
ban đầu                                  : {"documents":1,"nodes":6,    "jsEventListeners":0}
sau khi remove 20000 div (mảng còn giữ)  : {"documents":1,"nodes":40006,"jsEventListeners":0}
sau khi keep = null                      : {"documents":1,"nodes":6,    "jsEventListeners":0}
```

**40 006 node còn sống** dù `.remove()` đã gọi đủ 20 000 lần. Con số 40 006 = 20 000 `div` +
20 000 `span` + 6 node có sẵn của trang: giữ node cha là giữ luôn **toàn bộ cây con**.

Đó là điểm nguy hiểm nhất: bạn giữ một `<div>`, nhưng thứ bị giữ là cả bảng 500 dòng bên trong nó.

**Dấu hiệu trong DevTools:** trong heap snapshot, lọc theo `Detached`. Chrome hiển thị
`Detached HTMLDivElement`, `Detached <div>` — có nghĩa là node đó không còn trong cây nhưng
JS còn giữ.

Nguồn phổ biến nhất:

```js
const cache = {};
function moModal(id) {
  cache[id] = document.querySelector('#modal-' + id);   // ⚠ giữ mãi
  ...
}
```

Sửa: dùng `WeakRef`, hoặc đơn giản là **query lại khi cần** — `querySelector` trên vài nghìn
node mất dưới 1 ms, không đáng để cache.

---

## 5. Rò rỉ kiểu 4 — listener không gỡ

Đây là kiểu phổ biến nhất trong ứng dụng thật, vì nó rò rỉ **cả component**.

```js
class Comp {
  constructor() {
    this.data = new Array(50000).fill(0);
    this.h = () => this.data.length;             // arrow -> giữ `this`
    window.addEventListener('resize', this.h);
  }
  destroy(coGo) { if (coGo) window.removeEventListener('resize', this.h) }
}
```

```
50 component KHÔNG gỡ listener: 0.74 -> 10.29 MB (+9.54)
50 component CÓ gỡ listener   : 10.29 -> 10.29 MB (+0.00)
```

Chuỗi giữ: `window` → danh sách listener → hàm `h` → closure giữ `this` → cả instance
`Comp` với mảng 50 000 phần tử. Component đã "bị huỷ" từ lâu nhưng `window` vẫn sống suốt
phiên làm việc.

### Ba cách chắc chắn không quên gỡ

```js
// 1. AbortController — gỡ tất cả bằng một lệnh
const ac = new AbortController();
window.addEventListener('resize', h, { signal: ac.signal });
document.addEventListener('keydown', k, { signal: ac.signal });
// khi huỷ:
ac.abort();                       // gỡ CẢ HAI

// 2. { once: true } cho listener chỉ cần một lần
el.addEventListener('animationend', f, { once: true });

// 3. Event delegation — gắn lên container sống lâu, không gắn lên item
container.addEventListener('click', e => { const item = e.target.closest('.item'); ... });
```

Cách 1 là cách tốt nhất và ít người dùng. Một `AbortController` cho cả component, `ac.abort()`
trong `destroy` / `onUnmounted` / `useEffect` cleanup — không thể quên cái nào.

### Bẫy kèm theo: `bind` tạo hàm mới mỗi lần

```js
el.addEventListener('click', this.xuLy.bind(this));
el.removeEventListener('click', this.xuLy.bind(this));   // ⚠ KHÔNG gỡ được gì
```

Hai lần `bind` cho hai hàm khác nhau. `removeEventListener` so bằng `===` nên không tìm thấy.
Phải lưu tham chiếu:

```js
this.xuLyDaBind = this.xuLy.bind(this);
el.addEventListener('click', this.xuLyDaBind);
el.removeEventListener('click', this.xuLyDaBind);   // ✅
```

### Trong Node: `EventEmitter` có cảnh báo sẵn

```js
const e = new EventEmitter();
for (let i = 0; i < 11; i++) e.on('x', () => {});
```

```
listenerCount: 11
(node:78173) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
11 x listeners added to [EventEmitter]. MaxListeners is 10.
Use emitter.setMaxListeners() to increase limit
```

Ngưỡng 10 là **cảnh báo phỏng đoán**, không phải lỗi. Đừng phản ứng bằng
`setMaxListeners(100)` — hãy xem tại sao có 11 listener trên cùng một sự kiện. Chín trên mười
lần là vì hàm đăng ký được gọi lại mỗi lần request/render mà không gỡ lần trước.

---

## 6. `WeakRef` và `FinalizationRegistry`

```js
const reg = new FinalizationRegistry(t => console.log('  [reg] đã thu hồi:', t));
let o = { ten: 'X', data: new Array(1e6).fill(0) };
reg.register(o, 'obj-X');
const wr = new WeakRef(o);

global.gc();
console.log('1 còn tham chiếu mạnh: wr.deref() =', wr.deref()?.ten, '| heap', mb());
o = null; global.gc();
await new Promise(r => setTimeout(r, 50)); global.gc();
console.log('2 sau khi bỏ + gc    : wr.deref() =', wr.deref(), '| heap', mb());
await new Promise(r => setTimeout(r, 300));
console.log('3 hết chương trình.');
```

```
1 còn tham chiếu mạnh: wr.deref() = X         | heap 10.9
2 sau khi bỏ + gc    : wr.deref() = undefined | heap 3.5
  [reg] đã thu hồi: obj-X
3 hết chương trình.
```

`wr.deref()` trả `undefined` sau khi object bị thu hồi, và bộ nhớ về 3.5 MB.

### ⚠ Thời điểm callback chạy là không xác định — đo được điều đó

Đọc kỹ thứ tự output: dòng `[reg] đã thu hồi` in ra **sau** dòng số 2, tức là **sau** thời
điểm `wr.deref()` đã trả `undefined`. Object bị thu hồi trước, callback được gọi sau, ở một
nhịp không xác định.

Và nếu bỏ dòng `await ... 300` cuối cùng đi thì callback **không in ra gì cả** — tiến trình
kết thúc trước khi nó được gọi:

```
(bản không có chờ 300ms)
1 còn tham chiếu mạnh: wr.deref() = X         | heap 10.8
2 sau khi bỏ + gc    : wr.deref() = undefined | heap 3.3
                                                  ← không có dòng [reg] nào
```

Đây đúng như đặc tả: callback của `FinalizationRegistry` **không được bảo đảm chạy** — không
chạy khi tiến trình kết thúc, có thể không chạy bao giờ.

**Vì vậy:** đừng bao giờ dùng `FinalizationRegistry` để giải phóng tài nguyên (đóng file, nhả
kết nối, gỡ khoá). Nó chỉ dùng được để **thống kê / gỡ lỗi** — ví dụ đếm xem component có
thật sự được thu hồi sau khi unmount. Muốn dọn dẹp chắc chắn thì dùng `try/finally`, hoặc
`using` + `Symbol.dispose` khi runtime hỗ trợ (Chrome 152 có, Node 22 chưa — xem
[bài 10](./10-js-hien-dai-2026.md)).

### Bẫy của `WeakRef`

Giữa hai lần `deref()` trong cùng một microtask, giá trị **không đổi** (đặc tả bảo đảm), nhưng
qua nhịp khác thì có thể mất. Nên luôn:

```js
const o = wr.deref();
if (!o) return;              // kiểm tra MỘT lần
o.a; o.b; o.c;               // rồi dùng biến cục bộ
```

Không viết `wr.deref().a; wr.deref().b;` — mỗi lần là một phép cầu may.

---

## 7. Quy trình tìm rò rỉ trong 6 bước

Áp dụng được cho cả trình duyệt và Node.

**1. Xác nhận nó có thật.** Lặp lại thao tác nghi vấn 10 lần, đo trước/sau. Bộ nhớ tăng đều
mà không bao giờ về là rò rỉ; tăng rồi về là bình thường.

```js
// Node
for (let i = 0; i < 10; i++) { await lamViec(); global.gc(); console.log(i, mb()); }
```

**2. Chụp 3 snapshot.** Trong Chrome DevTools → Memory → *Heap snapshot*:
snapshot 1 → làm thao tác → snapshot 2 → làm lại → snapshot 3.

**3. So sánh.** Chọn snapshot 3, đổi chế độ xem sang **Comparison** so với snapshot 1. Sắp
theo `# Delta`. Thứ tăng đều qua cả hai lần là nghi phạm.

**4. Xem `Retainers`.** Chọn nghi phạm, panel dưới hiện chuỗi giữ nó. Đọc **từ dưới lên** —
đó là đường đi từ gốc GC tới object.

**5. Nhận diện theo từ khoá trong chuỗi giữ:**

| Thấy trong chuỗi giữ | Kiểu rò rỉ |
|---|---|
| `context` | closure (mục 2) |
| `Detached HTMLxxxElement` | detached DOM (mục 4) |
| `Window` / `EventListener` | listener không gỡ (mục 5) |
| `Map` / `Set` / một mảng ở module scope | cache không có giới hạn (mục 3) |
| `Timeout` | `setInterval` không `clearInterval` |

**6. Trong Node, dùng heap snapshot từ dòng lệnh** nếu không tiện mở DevTools:

```js
require('v8').writeHeapSnapshot('/tmp/1.heapsnapshot');
```

Rồi kéo file vào tab Memory của Chrome DevTools — nó đọc được snapshot của Node.

---

## 8. Bài tập

### Bài 1 — Ba đoạn, đoạn nào rò rỉ

```js
// A
const cache = new Map();
function layNguoiDung(el) { cache.set(el, tinhToan(el)); }

// B
setInterval(() => capNhat(), 1000);

// C
const dsNode = [...document.querySelectorAll('.item')];
document.querySelector('#ds').innerHTML = '';
```

<details><summary>Gợi ý đáp án</summary>

**Cả ba.**

**A** — `Map` giữ `el` (DOM node) làm khoá vĩnh viễn. Node bị xoá khỏi trang vẫn không chết
được, và nó giữ luôn cây con của nó. Sửa: `new WeakMap()`.

**B** — `setInterval` chạy mãi, và callback giữ mọi thứ nó tham chiếu. Đây là rò rỉ **kép**:
vừa rò bộ nhớ, vừa tiếp tục chạy công việc trên trang/route đã rời khỏi. Sửa:

```js
const id = setInterval(() => capNhat(), 1000);
// khi huỷ:
clearInterval(id);
```

Hoặc dùng `AbortSignal` trong Node 22:

```js
const ac = new AbortController();
setInterval(() => capNhat(), 1000, { signal: ac.signal });   // Node
```

**C** — nguy hiểm nhất vì trông vô hại. `innerHTML = ''` xoá node khỏi cây DOM, nhưng mảng
`dsNode` còn giữ chúng → **detached DOM**. Chúng biến mất khỏi màn hình nên bạn không nghĩ
gì nữa.

Sửa: `dsNode.length = 0` sau khi xong, hoặc đừng lưu mảng node — lưu `id` rồi query lại.

Đo thử với 20 000 item: bài này đã đo, `nodes` đứng ở **40 006** cho tới khi bỏ mảng.

</details>

### Bài 2 — Viết cache có giới hạn

Cache không giới hạn là rò rỉ. Viết `LRU(n)` giữ tối đa `n` mục, bỏ mục ít dùng nhất. Không
dùng thư viện.

<details><summary>Gợi ý đáp án</summary>

Mẹo: `Map` của JavaScript **giữ thứ tự chèn**, và `delete` + `set` lại đưa khoá về cuối. Thế
là đủ để làm LRU trong 12 dòng:

```js
class LRU {
  #max; #m = new Map();
  constructor(max) { this.#max = max }

  get(k) {
    if (!this.#m.has(k)) return undefined;
    const v = this.#m.get(k);
    this.#m.delete(k); this.#m.set(k, v);        // đưa lên "mới nhất"
    return v;
  }

  set(k, v) {
    if (this.#m.has(k)) this.#m.delete(k);
    this.#m.set(k, v);
    if (this.#m.size > this.#max) {
      this.#m.delete(this.#m.keys().next().value);   // xoá cái cũ nhất
    }
  }

  get size() { return this.#m.size }
}
```

Kiểm chứng:

```js
const c = new LRU(3);
c.set('a', 1); c.set('b', 2); c.set('c', 3);
c.get('a');                    // 'a' thành mới nhất
c.set('d', 4);                 // đẩy 'b' ra (cũ nhất)
console.log([...c.keys()], c.get('b'), c.get('a'), c.size);
```

```
[ 'c', 'a', 'd' ] undefined 1 3
```

Đọc từng phần: thứ tự khoá là `c, a, d` — `'b'` đã bị đẩy ra vì nó cũ nhất, còn `'a'` nhảy lên
sau `'c'` vì nó vừa được `get`. `c.get('b')` là `undefined`, `c.get('a')` vẫn là `1`, `size`
là `3`. Đúng.

(Cần thêm `keys() { return this.#m.keys() }` vào class để chạy được dòng kiểm chứng trên.)

Chi tiết quan trọng: `this.#m.keys().next().value` lấy khoá đầu tiên mà **không** tạo mảng —
`[...map.keys()][0]` cũng đúng nhưng cấp phát một mảng `n` phần tử mỗi lần `set`, tức là biến
`set` từ O(1) thành O(n).

Nếu cần TTL nữa thì lưu `{ v, het: Date.now() + ttl }` và kiểm tra trong `get`. Đừng dùng
`setTimeout` cho từng mục — 10 000 mục là 10 000 timer.

</details>

### Bài 3 — Tìm chỗ rò rỉ trong component này

```js
class BieuDo {
  constructor(el, duLieu) {
    this.el = el;
    this.duLieu = duLieu;                        // 50 MB
    this.veLai = this.veLai.bind(this);
    window.addEventListener('resize', this.veLai);
    this.timer = setInterval(() => this.lamMoi(), 5000);
    this.observer = new IntersectionObserver(() => this.veLai());
    this.observer.observe(el);
  }
  veLai() { /* ... */ }
  lamMoi() { /* ... */ }
  destroy() {
    window.removeEventListener('resize', this.veLai);
  }
}
```

`destroy()` thiếu những gì?

<details><summary>Gợi ý đáp án</summary>

`destroy()` gỡ đúng **một** trong **ba** thứ. Còn thiếu:

```js
destroy() {
  window.removeEventListener('resize', this.veLai);
  clearInterval(this.timer);          // ⚠ thiếu — timer chạy mãi và giữ `this`
  this.observer.disconnect();         // ⚠ thiếu — observer giữ `el` và giữ `this`
  this.el = null;                     // tuỳ chọn, cắt sớm cho chắc
  this.duLieu = null;
}
```

`removeEventListener` ở đây **đúng**, vì `this.veLai` đã được bind một lần và lưu lại trong
constructor. Nếu constructor viết `window.addEventListener('resize', this.veLai.bind(this))`
thì `destroy` sẽ không gỡ được gì (bẫy ở mục 5).

Bản viết lại bằng `AbortController`, không thể quên:

```js
class BieuDo {
  #ac = new AbortController();
  constructor(el, duLieu) {
    this.el = el; this.duLieu = duLieu;
    const { signal } = this.#ac;
    window.addEventListener('resize', () => this.veLai(), { signal });
    setInterval(() => this.lamMoi(), 5000, { signal });        // Node 22; trình duyệt chưa có
    this.observer = new IntersectionObserver(() => this.veLai());
    this.observer.observe(el);
    signal.addEventListener('abort', () => this.observer.disconnect(), { once: true });
  }
  destroy() { this.#ac.abort() }        // một lệnh, dọn hết
}
```

⚠️ Lưu ý một khác biệt runtime: `setInterval(..., { signal })` là **API của Node**, trình
duyệt chưa hỗ trợ. Trong trình duyệt vẫn phải `clearInterval` tay, hoặc tự nối vào
`signal.addEventListener('abort', ...)` như dòng dưới cùng.

</details>

---

**Tiếp theo:** [Bài 09 — Module: ESM và CJS](./09-module-esm-cjs.md)
