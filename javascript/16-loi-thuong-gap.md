# Bài 16 — 32 lỗi thường gặp

> Tra cứu theo **triệu chứng**, không theo chủ đề. Khi có gì đó sai, bạn biết triệu chứng chứ
> chưa biết nguyên nhân — nên bảng này xếp theo cái bạn nhìn thấy trước.

---

## Nhóm A — Thông báo lỗi cụ thể

### A1. `ReferenceError: Cannot access 'x' before initialization`

**Nguyên nhân:** đọc biến `let`/`const` trước dòng khai báo (TDZ), **hoặc** vòng lặp import trong ESM.

```js
let x = 'NGOÀI';
function f() { console.log(x); let x = 'TRONG' }   // ← biến TRONG che biến NGOÀI ngay từ đầu hàm
```

**Sửa:** chuyển khai báo lên trước chỗ dùng. Nếu là vòng lặp import, tách phần dùng chung ra
module thứ ba ([bài 09](./09-module-esm-cjs.md) bài tập 2).

⚠️ `typeof x` **không** an toàn ở đây — nó cũng ném lỗi. Chi tiết: [bài 01](./01-scope-closure-tdz.md) mục 1.

### A2. `TypeError: Cannot read properties of undefined (reading 'xyz')` — trong method

**Nguyên nhân:** method bị tách khỏi object nên `this` là `undefined`.

```js
setTimeout(o.method, 100);          // ❌
element.addEventListener('click', o.method);   // ❌
arr.map(o.method);                  // ❌
```

**Sửa:** `() => o.method()`, hoặc `o.method.bind(o)`. Cân nhắc chi phí bộ nhớ của class field
arrow: gấp **2.7 lần** ([bài 02](./02-this-va-prototype.md) mục 3).

### A3. `TypeError: Converting circular structure to JSON`

**Nguyên nhân:** object có tham chiếu vòng, hoặc bạn đang stringify một DOM node / React
fiber / Express `req`.

**Sửa:** dùng `structuredClone` nếu chỉ cần copy; dùng replacer nếu cần serialize:

```js
const daThay = new WeakSet();
JSON.stringify(o, (k, v) => {
  if (v && typeof v === 'object') { if (daThay.has(v)) return '[vòng]'; daThay.add(v) }
  return v;
});
```

### A4. `TypeError: Do not know how to serialize a BigInt`

**Sửa:** thêm `toJSON` cho `BigInt`, hoặc replacer `(k, v) => typeof v === 'bigint' ? v.toString() : v`.

### A5. `SyntaxError: Unexpected token '<'` khi `r.json()`

**Nguyên nhân:** server trả HTML (trang lỗi, trang login, trang 404) mà bạn parse như JSON.
`fetch` **không** ném lỗi với HTTP 4xx/5xx ([bài 12](./12-browser-api.md) mục 1).

**Sửa:** kiểm `r.ok` và `content-type` trước khi parse.

### A6. `TypeError: Failed to fetch`

**Nguyên nhân:** mất mạng, DNS sai, **CORS bị chặn**, server từ chối, hoặc chứng chỉ sai. Trình
duyệt cố tình không nói rõ.

**Sửa:** thông tin thật nằm trong **tab Network** của DevTools, không nằm trong `e.message`.
Chín trên mười lần là CORS.

### A7. `DOMException: The operation was aborted` / `signal timed out`

**Nguyên nhân:** `AbortController.abort()` hoặc `AbortSignal.timeout()`.

⚠️ Hai cái cho `e.name` **khác nhau**: `"AbortError"` và `"TimeoutError"`. Code chỉ kiểm
`AbortError` sẽ coi hết giờ là lỗi thật ([bài 07](./07-promise-va-async.md) mục 5).

### A8. `TypeError: body stream already read`

**Nguyên nhân:** đọc `Response.body` hai lần.

**Sửa:** `r.clone()` **trước khi** đọc lần đầu.

### A9. `Error [ERR_REQUIRE_ESM]` / `ERR_REQUIRE_ASYNC_MODULE`

**Nguyên nhân:** `require()` một module ESM **có top-level await**. Node 22 `require` được ESM,
nhưng không được nếu có TLA.

**Sửa:** dùng `await import()`, hoặc bỏ TLA khỏi module đó. Tìm nguồn TLA bằng
`--experimental-print-required-tla` ([bài 09](./09-module-esm-cjs.md) mục 4).

### A10. `SyntaxError: Named export 'a' not found. The requested module ... is a CommonJS module`

**Nguyên nhân:** module CJS gán export động (`Object.assign(exports, x)`), Node không phân tích
tĩnh được.

**Sửa:** `import pkg from '...'` rồi `const { a } = pkg`.

### A11. `MaxListenersExceededWarning: Possible EventEmitter memory leak`

**Nguyên nhân:** hơn 10 listener trên cùng một sự kiện — thường vì hàm đăng ký được gọi lại mỗi
request/render mà không gỡ lần trước.

**Sửa:** tìm chỗ đăng ký trùng. **Đừng** `setMaxListeners(100)`. Dùng `--trace-warnings` để biết
dòng nào thêm listener.

### A12. `throw er; // Unhandled 'error' event` — tiến trình chết

**Nguyên nhân:** `emit('error')` mà không có listener; hoặc `.pipe()` với stream nguồn lỗi.

**Sửa:** luôn `pipeline()` thay `.pipe()` ([bài 13](./13-nodejs-runtime.md) mục 4).

### A13. Tiến trình thoát với exit code `137`, không có log

**Nguyên nhân:** OOM killer của hệ điều hành. Node tưởng nó có RAM của **máy chủ** chứ không
phải giới hạn container.

**Sửa:** `node --max-old-space-size=<80% RAM container> app.js`.

### A14. `SyntaxError: Unexpected identifier 'r'` ở dòng `using`

**Nguyên nhân:** Node 22 chưa có cú pháp `using`, dù `Symbol.dispose` **có tồn tại**.

**Sửa:** dùng `try/finally`, hoặc để TypeScript biên dịch. Đừng dò bằng
`typeof Symbol.dispose` — nó cho kết quả sai ([bài 10](./10-js-hien-dai-2026.md) mục 2).

---

## Nhóm B — Chạy nhưng ra kết quả sai

### B15. Mảng sort ra `[1, 10, 5]`

**Nguyên nhân:** `sort()` không comparator so theo **chuỗi**.

**Sửa:** `sort((a, b) => a - b)`. Với tên tiếng Việt: `sort((a, b) => a.localeCompare(b, 'vi'))` —
`sort()` mặc định xếp `â`, `ă` **sau cả `b`** ([bài 03](./03-kieu-du-lieu-va-so-sanh.md) mục 5).

### B16. Comparator trả `true`/`false` — mảng không được sắp

```js
[10, 9, 1, 100].sort((a, b) => a > b)      // -> [10, 9, 1, 100]  KHÔNG ĐỔI
```

**Nguyên nhân:** đặc tả cần **số âm / 0 / dương**. `Number(false)` là `0`, không bao giờ âm.

**Sửa:** `(a, b) => a - b`. Bug im lặng nhất trong nhóm này.

### B17. ID từ backend sai 1 đơn vị

**Nguyên nhân:** ID `int64` vượt `Number.MAX_SAFE_INTEGER`.

```js
JSON.parse('{"id": 9007199254740993}').id    // -> 9007199254740992
```

**Sửa:** bắt backend trả chuỗi, hoặc reviver + `BigInt(ctx.source)`
([bài 03](./03-kieu-du-lieu-va-so-sanh.md) bài tập 2).

### B18. `Map`/`Set` biến thành `{}` sau khi gửi qua API

**Nguyên nhân:** `JSON.stringify(new Map(...))` cho `{}`, **không cảnh báo gì**.

**Sửa:** `[...map]` trước khi stringify; `structuredClone` nếu chỉ cần copy trong bộ nhớ.

### B19. `Date` cộng 1 tháng nhảy 2 tháng

```js
new Date('2026-01-31').setMonth(1)    // -> 2026-03-02, không phải 28/02
```

**Sửa:** `Temporal.PlainDate.from('2026-01-31').add({ months: 1 })` → `2026-02-28`. Dùng
`temporal-polyfill` trên Node 22 ([bài 10](./10-js-hien-dai-2026.md) mục 3).

### B20. Lọc "hôm nay" mất dữ liệu buổi sáng

**Nguyên nhân:** `toISOString()` trả **UTC**. Ở Việt Nam (UTC+7), 6 giờ sáng ngày 10 cho
`2026-09-09`.

**Sửa:** so theo giờ địa phương ([bài 10](./10-js-hien-dai-2026.md) bài tập 3).

### B21. Vòng lặp DOM xử lý đúng **một nửa**

```js
const items = document.getElementsByClassName('item');
for (let i = 0; i < items.length; i++) items[i].classList.remove('item');
// trước: 10 -> sau: 5
```

**Nguyên nhân:** `HTMLCollection` **sống** — phần tử rời khỏi danh sách làm chỉ số dịch.

**Sửa:** `querySelectorAll` (tĩnh), hoặc `[...collection]`, hoặc duyệt ngược. Bốn thứ trả về
collection sống: `getElementsByClassName`, `getElementsByTagName`, `getElementsByName`, và
**`element.children`** ([bài 11](./11-dom-va-su-kien.md) mục 7).

### B22. `e.currentTarget` là `null` sau `await`

**Sửa:** lưu `const el = e.currentTarget` **trước** `await`.

### B23. Counter đếm ra `NaN`

```js
btn.addEventListener('click', c.tang);    // this = element, this.count = undefined, ++ -> NaN
```

**Sửa:** như A2. Triệu chứng `NaN` khó tìm hơn `TypeError` vì không có lỗi nào.

### B24. `{...o}` mất thuộc tính

**Nguyên nhân:** spread chỉ chép **own + enumerable**. `Object.defineProperty` mặc định
`enumerable: false`.

**Sửa:** `Object.defineProperties({}, Object.getOwnPropertyDescriptors(o))`
([bài 04](./04-object-descriptor-proxy.md) bài tập 1).

### B25. `Object.freeze` không chặn được sửa object lồng trong

**Nguyên nhân:** `freeze` **nông**. Và ở sloppy mode nó **im lặng**.

**Sửa:** freeze đệ quy. Dùng ESM để ít nhất được thấy `TypeError`.

### B26. `Object.keys` sắp lại thứ tự

```js
Object.keys({ 300: 'C', 100: 'A', 200: 'B' })    // -> ['100','200','300']
```

**Nguyên nhân:** khoá số nguyên **luôn** được sắp tăng dần, trước mọi khoá chuỗi.

**Sửa:** dùng `Map` nếu cần giữ thứ tự chèn ([bài 04](./04-object-descriptor-proxy.md) mục 3).

### B27. `new Array(3).map(...)` trả về mảng rỗng

```js
new Array(3).map((_, i) => i)          // -> [ <3 empty items> ]
new Array(3).fill(0).map((_, i) => i)  // -> [0, 1, 2]  ✅
```

**Nguyên nhân:** mảng **sparse**; `map`/`forEach`/`filter` bỏ qua lỗ.

### B28. Hai instance dùng chung một mảng

```js
P.prototype.list = [];
p1.list.push('x');
p2.list                 // -> ['x']
```

**Nguyên nhân:** `push` **đọc** `list` (rơi lên prototype) rồi sửa mảng dùng chung.

**Sửa:** chỉ đặt **hàm** lên prototype; dữ liệu khởi tạo trong constructor
([bài 02](./02-this-va-prototype.md) mục 6).

### B29. Biến cờ trong module CJS không bao giờ đổi

```js
let batLog = false;
module.exports = { batLog, bat() { batLog = true } };   // batLog bị CHÉP giá trị
```

**Sửa:** export getter, hoặc chuyển sang ESM (live binding)
([bài 09](./09-module-esm-cjs.md) bài tập 1).

---

## Nhóm C — Bất đồng bộ chạy sai thứ tự / nuốt lỗi

### C30. `items.forEach(async (x) => await luu(x))` — không lưu gì, không lỗi

**Nguyên nhân:** `forEach` không biết gì về promise. Nó vứt promise đi, kèm cả lỗi.

**Sửa:** `await Promise.all(items.map(x => luu(x)))`, hoặc `for...of` + `await` nếu cần tuần tự.

### C31. Hàm `async` trả về mảng rỗng

```js
async function taiTatCa(ids) {
  const kq = [];
  for (const id of ids) tai(id).then(r => kq.push(r));
  return kq;                     // -> [] , luôn luôn
}
```

**Nguyên nhân:** `return` chạy ngay khi vòng lặp **khởi động** xong, chưa cái nào hoàn thành.

**Sửa:** `return Promise.all(ids.map(tai))`.

### C32. Test lúc xanh lúc đỏ / thanh tiến trình đứng im / trang đơ

Ba triệu chứng, cùng một gốc: **microtask không nhả luồng**.

| Triệu chứng | Nguyên nhân | Sửa |
|---|---|---|
| Test thỉnh thoảng đỏ | `expect` chạy trước khi microtask cập nhật state | `await` chính promise đó, đừng `setTimeout(0)` |
| Thanh tiến trình 0% → 100% | 50 000 vòng lặp trong **một** lần vét microtask, chưa lần nào vẽ | `await new Promise(r => requestAnimationFrame(r))` mỗi N vòng |
| Trang đơ, CPU không cao | microtask đẻ microtask vô hạn | chèn macrotask, hoặc `await scheduler.yield()` (Chrome 152) |

Đo thật: `setTimeout(f, 0)` bị đẩy tới **137 ms** khi có 1 triệu microtask lồng nhau
([bài 06](./06-event-loop.md) mục 4).

Và lỗi ở nhánh thua của `Promise.race` **biến mất hoàn toàn** — không log, không
`unhandledRejection` ([bài 07](./07-promise-va-async.md) mục 6 kiểu 4).

---

## Nhóm D — Chậm hoặc rò rỉ bộ nhớ

### Bảng tra theo con số đo được

| Triệu chứng | Nguyên nhân | Chênh lệch đã đo | Bài |
|---|---|---|---|
| Thêm nhiều node cực chậm | `innerHTML +=` trong vòng lặp | **3877×** (7366 ms → 1.9 ms) | [11](./11-dom-va-su-kien.md) |
| Vòng lặp DOM chậm bất thường | đọc/ghi layout xen kẽ | **529×** (635 ms → 1.2 ms) | [11](./11-dom-va-su-kien.md) |
| Server treo 0.8 giây | `readFileSync` trong handler | 795 ms → 40 ms | [13](./13-nodejs-runtime.md) |
| RSS 226 MB cho 1 file | `readFile` thay vì stream | 3× bộ nhớ | [13](./13-nodejs-runtime.md) |
| UI đơ khi tính toán | chạy CPU trên luồng chính | 0 khung → 26 khung | [12](./12-browser-api.md) |
| Đọc thuộc tính chậm dần | trên 4 hidden class (megamorphic) | 3.6× | [14](./14-hieu-nang-va-cong-cu.md) |
| Vòng lặp nóng chậm 4× | vòng `for` nằm trực tiếp trong `try` | 4.2× | [14](./14-hieu-nang-va-cong-cu.md) |

### Bốn kiểu rò rỉ và dấu hiệu trong DevTools

| Thấy trong chuỗi giữ (*Retainers*) | Kiểu rò rỉ | Cách sửa |
|---|---|---|
| `context` | **closure chia sẻ scope** — giữ hàm nhỏ nhưng anh em nó dùng biến lớn (đo: **152 MB** cho 20 hàm trả về số `1`) | tách scope, hoặc `bien = null` sau khi dùng |
| `Detached HTMLxxxElement` | **detached DOM** — mảng/cache còn giữ node đã `remove()` (đo: **40 006 node** còn sống) | bỏ tham chiếu; đừng cache DOM node |
| `Window` / `EventListener` | **listener không gỡ** (đo: **+9.54 MB** cho 50 component) | một `AbortController` cho cả component, `ac.abort()` khi huỷ |
| `Map` hoặc mảng ở module scope | **cache không giới hạn** (đo: `Map` 103.9 MB vs `WeakMap` 7.3 MB) | `WeakMap`, hoặc LRU có giới hạn |

Quy trình 6 bước để tìm: [bài 08](./08-bo-nho-va-ro-ri.md) mục 7.

### Ba bẫy khiến `removeEventListener` không hoạt động

```js
el.removeEventListener('click', this.f.bind(this));   // ❌ hàm mới, khác hàm đã gắn
el.removeEventListener('click', () => this.f());      // ❌ hàm mới
el.removeEventListener('click', f);                    // ❌ nếu gắn với { capture: true }
```

Cái thứ ba ít người biết: `capture` là một phần của **danh tính** listener. Gắn với
`{ capture: true }` thì phải gỡ với `{ capture: true }`.

**Sửa gọn nhất cho cả ba:** dùng `{ signal }` khi gắn, rồi `ac.abort()`. Không cần `remove` gì cả.

---

## Nhóm E — Ba lời khuyên cũ nay đã sai

Đừng "tối ưu" theo những điều này nữa — máy bạn đã bác bỏ chúng:

| Lời khuyên cũ | Thực tế đo được |
|---|---|
| "Nối chuỗi phải dùng `array.join`, `+=` chậm" | `+=` **nhanh hơn 3×** tới 100 000 lần (0.44 vs 1.40 ms). Chỉ đúng từ ~500 000 lần trở lên |
| "Luôn dùng `DocumentFragment`" | `DocumentFragment` **chậm hơn** `append` trực tiếp (5.5 vs 3.4 ms) |
| "Object phải cùng một hidden class" | 1→4 hình dạng gần như miễn phí (1.68 → 2.42 ms). Chỉ **vượt 4** mới đắt (6.00 ms) |
| "`await promise` tốn 3 nhịp microtask" | Từ V8 7.2 chỉ còn **1 nhịp**, bằng `await 1`. Nhưng `await thenable` vẫn tốn **2** |
| "`typeof x` luôn an toàn để dò tính năng" | Sai với TDZ (A1), và sai với tính năng **cú pháp** như `using` (A14) |
| "`[...arr]` chậm hơn `arr.slice()`" | **Bằng nhau** (0.08 vs 0.08 ms) — V8 nhận ra spread trên mảng thật |

Và một lời khuyên vẫn đúng nhưng thường bị áp dụng sai chỗ:

> "`for` nhanh hơn `forEach`" — đúng, **11.5×** với mảng 5 triệu phần tử. Nhưng với mảng 1000
> phần tử chênh lệch là **0.014 ms**. Phần thắng thật nằm ở việc **gộp nhiều lượt duyệt thành
> một** (166.83 → 17.45 ms), không phải ở bản thân `for`.

---

**Tiếp theo:** [Bài 17 — Cheatsheet](./17-cheatsheet.md)
