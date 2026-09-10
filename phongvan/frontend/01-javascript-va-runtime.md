# JavaScript và runtime trình duyệt — 16 câu

Ở mức senior, câu hỏi JavaScript không còn là "closure là gì". Nó là **"vì sao đoạn code này chạy
ra kết quả bạn không ngờ tới"** — và người phỏng vấn muốn nghe bạn giải thích bằng cơ chế, không
phải bằng cách nhớ luật.

Output dưới đây chạy thật trên Chromium (Playwright) và Node v22.23.2.

---

### 1. Event loop trong trình duyệt: thứ tự của sync, microtask, `requestAnimationFrame`, `setTimeout`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Code đồng bộ chạy hết → **vét sạch hàng microtask** → rồi tới macrotask
(`setTimeout`) hoặc callback rAF trước khi vẽ khung hình. Điểm cốt lõi: microtask được vét **sạch**
sau mỗi task, còn macrotask thì mỗi vòng lặp chỉ lấy một cái.

**Giải thích sâu:** Đo thật trong Chromium:

```js
const out = ['1 sync'];
setTimeout(() => out.push('4 setTimeout 0'), 0);
requestAnimationFrame(() => out.push('3 rAF'));
Promise.resolve().then(() => out.push('2 microtask'));
out.push('1b sync cuoi');
```
```
1 sync
1b sync cuoi
2 microtask                       ← luôn trước mọi macrotask
4 setTimeout 0
3 rAF (truoc khi ve khung hinh)
```

Chú ý: trong lần đo này `setTimeout` chạy **trước** `rAF`. Đó không phải quy tắc cố định — `rAF` phải
đợi khung hình kế tiếp (~16 ms ở 60fps, và lâu hơn nữa nếu tab không được vẽ), còn `setTimeout(0)`
chỉ đợi vài ms. Nếu trang đang vẽ đều đặn và bạn gọi rAF ngay sau khi một khung hình vừa bắt đầu,
thứ tự sẽ đảo lại. **Đừng bao giờ dựa vào thứ tự giữa hai cái này.**

Hệ quả thực dụng cần nói:

- **Vòng lặp microtask vô hạn treo trang.** `Promise.resolve().then(f)` với `f` tự gọi lại chính nó
  sẽ không bao giờ trả quyền điều khiển cho trình duyệt — trang đứng hình, không nhận được click.
  `setTimeout` đệ quy thì không bị.
- **rAF là chỗ đúng để cập nhật hình ảnh.** Nó chạy ngay trước khi trình duyệt vẽ, nên thay đổi của
  bạn xuất hiện đúng khung hình đó và không bị vẽ hai lần.
- **rAF không chạy khi tab ẩn.** Đó là tính năng tiết kiệm pin, nhưng nó cũng có nghĩa animation
  dựa vào rAF sẽ đóng băng — nếu bạn dùng rAF làm bộ đếm thời gian, nó sẽ sai.

</details>

### 2. `[] == false` ra `true`. Giải thích chuỗi chuyển đổi.

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `==` ép kiểu theo một chuỗi quy tắc: object → primitive → number. `[]` thành `""`
thành `0`, `false` thành `0`, `0 == 0` là `true`.

**Giải thích sâu:** Chạy thật:

```js
[] == false      // true
[] == ![]        // true
'0' == false     // true
null == undefined // true
null == 0        // false     ← ngoại lệ
```

Từng bước cho `[] == false`:
```
[] == false
[] == 0            false -> ToNumber(false) = 0
"" == 0            [] -> ToPrimitive([]) = "" (join của mảng rỗng)
0  == 0            "" -> ToNumber("") = 0
true
```

Ngoại lệ đáng nhớ ở dòng cuối: `null` và `undefined` chỉ bằng nhau và bằng chính chúng — **không**
ép sang số. Đó là lý do `null == 0` ra `false` trong khi `null >= 0` lại ra `true` (toán tử so sánh
lớn/nhỏ dùng quy tắc khác).

Cách trả lời ăn điểm: giải thích được cơ chế **rồi kết luận thực dụng** — "vì vậy em luôn dùng
`===`, và dùng `== null` là ngoại lệ duy nhất em cho phép, vì nó là cách gọn nhất để bắt cả `null`
lẫn `undefined`."

Người phỏng vấn hỏi câu này không phải để bạn học thuộc bảng ép kiểu, mà để xem bạn có hiểu
**JavaScript vận hành theo đặc tả** hay chỉ dùng theo cảm giác.

</details>

### 3. Closure trong vòng lặp: `var` và `let` khác nhau thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `var` có phạm vi hàm — cả ba closure cùng trỏ tới **một** biến. `let` tạo một
binding **mới cho mỗi vòng lặp**, nên mỗi closure giữ giá trị riêng.

**Giải thích sâu:** Đo:

```js
const varFns = []; for (var i = 0; i < 3; i++) varFns.push(() => i);
const letFns = []; for (let j = 0; j < 3; j++) letFns.push(() => j);
console.log(varFns.map(f=>f()), letFns.map(f=>f()));
```
```
[ 3, 3, 3 ]   [ 0, 1, 2 ]
```

`[3,3,3]` vì cả ba hàm đọc cùng một ô nhớ, và khi chúng được gọi thì vòng lặp đã kết thúc với
`i = 3`.

Điều đáng nói thêm ở mức senior — **cơ chế của `let` trong `for`**: đặc tả tạo một môi trường
(binding) mới cho mỗi lần lặp và **sao chép giá trị** từ lần lặp trước sang. Đây không phải phép
màu của closure mà là một quy định riêng cho vòng `for`. Chứng minh: `let` bên ngoài vòng lặp thì
không có hành vi này.

Vì sao đây vẫn là câu hỏi có giá trị dù `var` gần như đã bị loại bỏ: nó xuất hiện lại dưới dạng
hiện đại trong React —

```jsx
useEffect(() => {
  const t = setInterval(() => console.log(count), 1000);  // count bị "đóng băng" ở giá trị lúc tạo
  return () => clearInterval(t);
}, []);                                                    // mảng phụ thuộc rỗng
```

Đây chính là "stale closure", cùng bản chất với `[3,3,3]`, và nó là một trong những bug React phổ
biến nhất. Xem [03-react câu 8](./03-react-va-quan-ly-state.md).

</details>

### 4. `this` được xác định thế nào? Arrow function khác gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Với hàm thường, `this` được quyết định **lúc gọi** (ai đứng trước dấu chấm). Arrow
function **không có `this` riêng** — nó lấy `this` từ phạm vi bao quanh lúc định nghĩa.

**Giải thích sâu:** Đo:

```js
const obj = { v: 1, f() { return this.v }, g: () => this?.v };
console.log(obj.f(), obj.g());
```
```
1  undefined
```

`obj.f()` ra `1` vì `this` là `obj`. `obj.g()` ra `undefined` vì arrow lấy `this` của phạm vi module
— trong CommonJS đó là `module.exports` (một object rỗng), trong ESM là `undefined`.

Thứ tự ưu tiên khi xác định `this` cho hàm thường:

```
1. new Foo()           -> object mới
2. foo.call(x) / apply / bind -> x
3. obj.foo()           -> obj
4. foo()               -> undefined (strict mode) hoặc globalThis
```

Bẫy thực tế hay gặp nhất là **mất `this` khi truyền hàm đi**:

```js
const btn = document.querySelector('button');
btn.addEventListener('click', obj.f);        // this = phần tử button, KHÔNG phải obj
btn.addEventListener('click', () => obj.f()); // đúng
```

Nguyên tắc thực dụng: **dùng arrow cho callback, dùng hàm thường cho phương thức của object**. Và
đừng dùng arrow cho phương thức trong class nếu bạn cần kế thừa hoặc cần tiết kiệm bộ nhớ — arrow
trong class field tạo một hàm riêng cho **mỗi instance**, còn phương thức thường nằm trên prototype
và dùng chung.

</details>

### 5. `0.1 + 0.2 !== 0.3` — xử lý tiền tệ thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Số trong JavaScript là IEEE-754 64-bit, không biểu diễn chính xác được `0.1`. Với
tiền, dùng **số nguyên đơn vị nhỏ nhất** (đồng, xu) hoặc thư viện decimal — không bao giờ dùng số
thực.

**Giải thích sâu:** Đo:

```js
0.1 + 0.2                                          // 0.30000000000000004
0.1 + 0.2 === 0.3                                  // false
Number.MAX_SAFE_INTEGER + 2 === Number.MAX_SAFE_INTEGER + 3   // false
```

Dòng thứ ba đáng chú ý hơn: vượt quá `2^53 - 1` thì các số nguyên liền kề trở nên **không phân biệt
được**. Hậu quả rất thật: id từ backend kiểu `bigint` (như snowflake id, hoặc id của Twitter/X) khi
đi qua `JSON.parse` sẽ **bị làm tròn và sai**. Đó là lý do API trả id lớn nên trả **dạng chuỗi**.

Cách xử lý tiền:

```js
// SAI
const total = 19.99 * 3;                    // 59.97000000000001

// ĐÚNG: lưu bằng đồng/xu, số nguyên
const total = 1999 * 3;                     // 5997 xu
const hienThi = (total/100).toFixed(2);     // "59.97" — chỉ chia lúc HIỂN THỊ
```

Với phép tính phức tạp (chia, lãi suất, thuế), dùng `decimal.js` hoặc `BigInt`. Và luôn thống nhất
quy tắc làm tròn với bên nghiệp vụ — làm tròn ở đâu, theo chiều nào, vì chênh lệch một xu nhân với
một triệu giao dịch là con số kế toán không chấp nhận được.

Điểm cộng: `Intl.NumberFormat` để hiển thị theo địa phương thay vì tự nối chuỗi:

```js
new Intl.NumberFormat('vi-VN', { style:'currency', currency:'VND' }).format(59970)
// "59.970 ₫"
```

</details>

### 6. Sao chép nông và sâu — `{...obj}` làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Spread chỉ sao chép **một tầng**. Object lồng bên trong vẫn dùng chung tham chiếu.
Sao chép sâu dùng `structuredClone()` — có sẵn trong trình duyệt và Node từ v17.

**Giải thích sâu:** Đo:

```js
const src = { a: { b: 1 } };
const shallow = { ...src };
const deep = structuredClone(src);
src.a.b = 99;
console.log(shallow.a.b, deep.a.b);
```
```
99  1
```

`shallow.a.b` đổi theo vì `shallow.a` **là chính** `src.a`.

Vì sao chuyện này quan trọng trong React/Vue: bạn tưởng đã tạo state mới nhưng thực ra vẫn đang sửa
state cũ, nên so sánh tham chiếu (`===`) thấy "không đổi" và component không re-render — hoặc tệ hơn,
bạn sửa dữ liệu cũ khiến tính năng undo/history hỏng.

So sánh các cách:

| Cách | Sâu? | Giữ được gì |
|---|---|---|
| `{...obj}`, `Object.assign` | không | mọi thứ ở tầng 1 |
| `JSON.parse(JSON.stringify(x))` | có | **mất** `Date`, `Map`, `Set`, `undefined`, `Infinity`, hàm; **chết** với vòng lặp tham chiếu |
| `structuredClone(x)` | có | giữ `Date`, `Map`, `Set`, `RegExp`, vòng lặp tham chiếu; **không** sao chép được hàm và DOM node |
| thư viện (`lodash.cloneDeep`) | có | linh hoạt nhất, tốn thêm dung lượng bundle |

Cách `JSON` vẫn rất phổ biến và là nguồn bug âm thầm: một `Date` biến thành chuỗi, và code phía sau
gọi `.getTime()` sẽ lỗi ở một nhánh hiếm gặp.

Ghi chú thực dụng: **thường thì bạn không cần sao chép sâu.** Cập nhật bất biến chỉ cần sao chép
đúng nhánh bị thay đổi — đó cũng là cách rẻ hơn nhiều về hiệu năng.

</details>

### 7. `Promise.all` và `Promise.allSettled` — chọn khi nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `all` khi thiếu bất kỳ kết quả nào cũng làm màn hình vô nghĩa. `allSettled` khi
hiển thị được từng phần — ví dụ dashboard 5 widget, một widget lỗi thì 4 cái kia vẫn nên hiện.

**Giải thích sâu:** Đo với `x` resolve sau 10ms và `y` reject sau 5ms:

```
Promise.all      -> reject ngay với lỗi 'y'
Promise.allSettled -> [{"status":"fulfilled","value":"x"},{"status":"rejected","reason":{}}]
```

Ba điều cần nói thêm ở mức senior:

1. **`Promise.all` không huỷ các promise còn lại.** `x` vẫn chạy tới cùng và vẫn tốn băng thông.
   Muốn huỷ thật thì phải truyền `AbortSignal` vào từng `fetch`.
2. **`reason` bị `JSON.stringify` nuốt mất** — nhìn `"reason":{}` trong output. Log lỗi bằng
   `JSON.stringify` là cách phổ biến nhất để mất sạch thông tin sự cố. Dùng `err.message` và
   `err.stack` tường minh.
3. **Không giới hạn số lượng.** `Promise.all(ids.map(fetchOne))` với 500 id là 500 request đồng thời;
   trình duyệt xếp hàng ở mức ~6 kết nối cho HTTP/1.1 và server của bạn có thể không chịu nổi.

Với UI, `Promise.race` cũng có một ứng dụng hay: đặt timeout cho `fetch`.

```js
const withTimeout = (p, ms) => Promise.race([
  p, new Promise((_,rej) => setTimeout(() => rej(new Error('Quá thời gian chờ')), ms))
]);
```

Nhưng cách đúng hơn hiện nay là `AbortSignal.timeout(ms)` — nó **thật sự huỷ** request thay vì chỉ
bỏ qua kết quả.

</details>

### 8. `async`/`await` — hai lỗi hay gặp nhất

<details><summary>Đáp án</summary>

**Trả lời ngắn:** (1) Quên `await` nên `try/catch` không bắt được lỗi. (2) Dùng `forEach` với
callback `async` — nó không đợi gì cả.

**Giải thích sâu:** Chạy thật:

```js
async function loi(){ throw new Error('vo tinh nuot') }
try { loi() } catch (e) { console.log('bat duoc?', e.message) }

async function sai(){
  [1,2,3].forEach(async n => { await delay(10); console.log('forEach xong', n) });
  console.log('ham sai() da tra ve, chua item nao xong');
}
```
```
ham sai() da tra ve, chua item nao xong    ← in TRƯỚC
UNHANDLED: vo tinh nuot                     ← 'bat duoc?' không hề được in
forEach xong 1
forEach xong 2
forEach xong 3
```

Dòng `'bat duoc?'` **không xuất hiện**: `loi()` trả về Promise bị reject, còn `try/catch` chỉ bắt
throw đồng bộ.

Sửa:
```js
try { await loi() } catch (e) { ... }
for (const n of [1,2,3]) await xuLy(n);            // tuần tự
await Promise.all([1,2,3].map(n => xuLy(n)));      // song song
```

Lỗi thứ ba đáng nói vì nó là lỗi hiệu năng chứ không phải lỗi đúng đắn — **`await` tuần tự khi
không cần**:

```js
const user = await fetchUser();      // 200ms
const posts = await fetchPosts();    // 200ms  -> tổng 400ms, dù chúng không phụ thuộc nhau
// đúng:
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()]);   // 200ms
```

Đây là thứ dễ nhìn thấy trong tab Network: các request xếp thành bậc thang thay vì bắt đầu cùng lúc.

</details>

### 9. Event delegation là gì và khi nào dùng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Gắn **một** listener ở phần tử cha thay vì mỗi phần tử con một cái, dựa vào cơ chế
nổi bọt (bubbling) của sự kiện. Dùng khi có nhiều phần tử giống nhau, hoặc khi danh sách thay đổi
động.

**Giải thích sâu:**

```js
// Thay vì 1000 listener:
document.querySelectorAll('.row').forEach(r => r.addEventListener('click', xuLy));

// Một listener duy nhất:
document.getElementById('table').addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (row) xuLy(row.dataset.id);
});
```

Ba lợi ích, và cái thứ hai quan trọng nhất:

1. Ít bộ nhớ và ít công gắn listener hơn.
2. **Tự động hoạt động với phần tử được thêm sau** — không cần gắn lại listener khi render thêm
   dòng. Đây là lý do chính khiến kỹ thuật này vẫn hữu ích.
3. Không cần dọn listener khi xoá phần tử con.

Điều phải biết để không dùng sai:
- **Có sự kiện không nổi bọt**: `focus`, `blur`, `load`, `error`. Với chúng phải dùng `focusin`/
  `focusout`, hoặc bắt ở pha capture (`{capture:true}`).
- **`e.target` là phần tử sâu nhất được bấm**, có thể là `<span>` bên trong nút. Luôn dùng
  `e.target.closest(...)` chứ đừng so sánh trực tiếp.
- Trong React thì gần như không cần kỹ thuật này — React đã tự uỷ quyền sự kiện ở gốc ứng dụng. Nói
  được điều này cho thấy bạn hiểu cả hai thế giới.

</details>

### 10. Debounce và throttle khác nhau ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Debounce đợi cho tới khi **ngừng** kích hoạt mới chạy một lần. Throttle chạy đều
đặn **tối đa một lần trong mỗi khoảng thời gian**. Debounce cho ô tìm kiếm; throttle cho scroll và
resize.

**Giải thích sâu:**

```
Sự kiện:   x x x x x x       x x x            x
debounce(300):            ●              ●          ●     (chạy sau khi ngừng 300ms)
throttle(300):  ●    ●    ●     ●    ●        ●           (chạy đều mỗi 300ms)
```

Chọn theo câu hỏi: **"bạn cần kết quả cuối cùng, hay cần cập nhật liên tục?"**

| Tình huống | Chọn |
|---|---|
| Gõ vào ô tìm kiếm → gọi API | debounce (chỉ cần từ khoá cuối) |
| Tự lưu khi soạn thảo | debounce |
| Cập nhật vị trí khi cuộn | throttle |
| Thay đổi kích thước cửa sổ → tính lại layout | throttle + một debounce ở cuối |
| Nút submit | **không phải hai cái này** — dùng cờ đang-gửi, xem bên dưới |

Chi tiết mà người phỏng vấn hay đào tiếp:
- **Debounce có `leading` và `trailing`.** Mặc định là trailing. Với nút bấm, bạn thường muốn
  `leading: true, trailing: false` — chạy ngay lần đầu, bỏ qua các lần dồn dập sau.
- **Trong React, debounce phải giữ ổn định qua các lần render.** Tạo `debounce()` ngay trong thân
  component sẽ tạo hàm mới mỗi lần render và mất hết trạng thái chờ. Phải bọc trong `useMemo` hoặc
  `useRef`, và **huỷ nó khi component unmount**.
- Với scroll, thứ tốt hơn throttle là **`IntersectionObserver`** — trình duyệt tính giúp, không chạy
  trên luồng chính, và không cần đọc `getBoundingClientRect` (thứ gây reflow).

Với nút submit, cách đúng không phải debounce mà là **vô hiệu hoá nút + cờ trạng thái**, vì debounce
vẫn cho phép bấm lần hai sau khoảng thời gian chờ.

</details>

### 11. Có những cách lưu dữ liệu nào ở phía client?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `localStorage` (đồng bộ, ~5 MB, chỉ chuỗi), `sessionStorage` (mất khi đóng tab),
cookie (gửi kèm mọi request, có `HttpOnly`), IndexedDB (bất đồng bộ, dung lượng lớn, có cấu trúc),
Cache API (cho request/response, dùng với service worker).

**Giải thích sâu:**

| | Dung lượng | Đồng bộ? | Gửi lên server | JS đọc được |
|---|---|---|---|---|
| `localStorage` | ~5 MB | **có (chặn luồng)** | không | có |
| `sessionStorage` | ~5 MB | có | không | có |
| Cookie | ~4 KB | có | **mọi request** | có, trừ khi `HttpOnly` |
| IndexedDB | hàng trăm MB+ | không | không | có |
| Cache API | lớn | không | không | có |

Hai điểm senior cần nói:

**1. `localStorage` là API đồng bộ.** Đọc/ghi chặn luồng chính. Với vài KB thì không sao, nhưng
`JSON.parse` một object 2 MB trong `localStorage` ở lúc khởi động là một long task trực tiếp làm
xấu chỉ số INP. Dữ liệu lớn thuộc về IndexedDB.

**2. Không lưu token trong `localStorage` nếu tránh được.** Bất kỳ script nào chạy trên trang —
kể cả script quảng cáo hay một gói npm bị chiếm quyền — đều đọc được. Cookie `HttpOnly` +
`SameSite=Lax` an toàn hơn trước XSS, đổi lại cần chống CSRF. Xem
[backend/06 câu 3–4](../backend/06-bao-mat.md).

Chi tiết hay được hỏi thêm: **`localStorage` dùng chung giữa các tab cùng origin**, và có sự kiện
`storage` để các tab biết nhau đã thay đổi gì — đây là cách đơn giản để đồng bộ trạng thái đăng
xuất giữa nhiều tab: một tab đăng xuất, các tab kia nhận sự kiện và tự chuyển về màn hình đăng nhập.

</details>

### 12. Memory leak ở frontend đến từ đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Listener không gỡ, timer không dừng, tham chiếu tới DOM node đã bị xoá, và biến
toàn cục tích luỹ. Trong SPA thì nó tích tụ qua nhiều lần chuyển trang vì trang không bao giờ được
tải lại.

**Giải thích sâu:** Vì sao SPA dễ leak hơn trang truyền thống: trang truyền thống dọn sạch mọi thứ
mỗi lần điều hướng. SPA sống hàng giờ, và mỗi lần vào-ra một màn hình mà quên dọn là một chút bộ nhớ
bị giữ lại.

Danh sách cụ thể:

```js
// 1. Listener trên window/document không gỡ
useEffect(() => {
  const f = () => {...};
  window.addEventListener('resize', f);
  return () => window.removeEventListener('resize', f);   // BẮT BUỘC
}, []);

// 2. Timer
useEffect(() => { const t = setInterval(f, 1000); return () => clearInterval(t) }, []);

// 3. Observer
useEffect(() => { const o = new IntersectionObserver(f); return () => o.disconnect() }, []);

// 4. Đăng ký nhận tin (websocket, store bên ngoài, event bus)
useEffect(() => socket.on('msg', f) && (() => socket.off('msg', f)), []);

// 5. Tham chiếu DOM giữ trong biến ngoài
const cache = [];  cache.push(document.getElementById('x'));   // node bị xoá vẫn không được GC
```

**Cách phát hiện** — quy trình cụ thể để nói ở phỏng vấn:

```
1. DevTools > Performance > tick "Memory", ghi lại trong lúc vào-ra một màn hình 10 lần
   -> đường JS Heap đi lên theo bậc thang và KHÔNG tụt lại sau GC = có leak
2. DevTools > Memory > Heap snapshot: chụp -> thao tác 10 lần -> ép GC -> chụp lại
   -> so sánh (Comparison), sắp theo Delta
3. Bộ lọc "Detached" tìm DOM node đã tách khỏi cây nhưng vẫn bị JS giữ — thủ phạm số một
```

Mục "Detached" ở bước 3 là mẹo đáng nói: nó chỉ thẳng ra các node DOM lẽ ra đã phải biến mất.

</details>

### 13. `WeakMap` và `WeakRef` dùng làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `WeakMap` giữ khoá là object mà **không ngăn bộ thu gom rác dọn nó**. Dùng để gắn
dữ liệu phụ vào một object mà không kéo dài vòng đời của nó.

**Giải thích sâu:** Trường hợp dùng điển hình — gắn metadata vào DOM node:

```js
const meta = new WeakMap();
meta.set(nodeDOM, { daKhoiTao: true, viTri: 3 });
// khi nodeDOM bị xoá khỏi cây và không còn ai tham chiếu, cả node lẫn metadata đều được dọn
```

Với `Map` thường, chính cái `Map` giữ tham chiếu tới node → node không bao giờ được giải phóng → đó
chính là leak "detached DOM node" ở câu 12.

Giới hạn phải biết:
- Khoá **bắt buộc là object** (hoặc symbol), không dùng được chuỗi/số.
- **Không duyệt được** (`keys()`, `size` đều không có) — vì nội dung có thể biến mất bất cứ lúc nào.

`WeakRef` và `FinalizationRegistry` là công cụ chuyên biệt hơn và lời khuyên chuẩn là **tránh dùng**:
thời điểm GC chạy không xác định, nên hành vi không thể đoán trước và không thể test đáng tin. Nếu
bạn đang cần chúng, thường là thiết kế có vấn đề.

Nói được câu "em biết chúng tồn tại nhưng gần như không dùng, và đây là lý do" là một câu trả lời
tốt hơn nhiều so với việc kể một trường hợp dùng gượng ép.

</details>

### 14. Module ESM và CommonJS khác nhau ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** ESM là tĩnh — `import` được phân tích **trước khi chạy**, nên bundler tree-shake
được. CommonJS là động — `require()` chạy lúc thực thi và có thể nằm trong `if`, nên không tree-shake
được.

**Giải thích sâu:** Hệ quả này đo được rất rõ (chi tiết ở [04-hieu-nang câu 5](./04-hieu-nang-va-do-luong.md)):

```
import { debounce } from 'lodash'      (CommonJS)  ->  72.1 KB minify / 26.2 KB gzip
import { debounce } from 'lodash-es'   (ESM)       ->   2.8 KB minify /  1.4 KB gzip
```

**Cùng một hàm, chênh 26 lần** — chỉ vì định dạng module.

Các khác biệt khác:

| | ESM | CommonJS |
|---|---|---|
| Thời điểm phân giải | tĩnh, trước khi chạy | động, lúc chạy |
| Vòng lặp phụ thuộc | xử lý được (live binding) | có thể ra object rỗng |
| `import` động | `import()` trả Promise | `require()` đồng bộ |
| `__dirname` | không có (dùng `import.meta.url`) | có |
| Top-level `await` | có | không |

Điểm rắc rối thực tế đáng nói: **ESM không import trực tiếp named export từ CommonJS được** một
cách đáng tin — Node phải "đoán" các named export bằng phân tích tĩnh, và với nhiều gói nó đoán
không ra, buộc bạn phải `import pkg from 'x'; const { a } = pkg`. Đây là nguồn gốc của phần lớn lỗi
`SyntaxError: Named export not found` khi chuyển dự án sang ESM.

</details>

### 15. `AbortController` dùng để làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Huỷ một thao tác đang chạy — `fetch`, event listener, hoặc code bất đồng bộ của
chính bạn. Ở frontend, nó giải quyết vấn đề **race condition khi request cũ về sau request mới**.

**Giải thích sâu:** Bug kinh điển nó sửa:

```
Người dùng gõ "a"   -> request A (chậm, 800ms)
Người dùng gõ "ab"  -> request B (nhanh, 100ms)
B về trước -> hiển thị kết quả "ab"  ✓
A về sau   -> GHI ĐÈ bằng kết quả "a"  ✗   -> người dùng thấy kết quả sai với ô nhập
```

Bug này rất khó tái hiện vì nó phụ thuộc vào thời gian mạng, và nó rất hay xuất hiện trên mạng chậm
— tức là với chính những người dùng đã có trải nghiệm tệ nhất.

```js
useEffect(() => {
  const ac = new AbortController();
  fetch(`/search?q=${q}`, { signal: ac.signal })
    .then(r => r.json()).then(setKetQua)
    .catch(e => { if (e.name !== 'AbortError') báoLỗi(e) });   // bỏ qua lỗi do chính mình huỷ
  return () => ac.abort();       // gõ tiếp -> huỷ request cũ
}, [q]);
```

Hai công dụng khác ít người biết:

```js
// 1. Gỡ nhiều listener cùng lúc chỉ bằng một lệnh
const ac = new AbortController();
el.addEventListener('click', f, { signal: ac.signal });
window.addEventListener('resize', g, { signal: ac.signal });
ac.abort();      // gỡ CẢ HAI

// 2. Timeout có sẵn
fetch(url, { signal: AbortSignal.timeout(5000) });
```

Công dụng thứ nhất rất hữu ích trong hàm dọn dẹp của `useEffect` — thay vì gọi `removeEventListener`
cho từng cái với đúng tham chiếu hàm (nơi rất dễ sai và gây leak), bạn chỉ cần `ac.abort()`.

</details>

### 16. `Map` và `Object` — chọn cái nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `Map` khi khoá là động hoặc không phải chuỗi, khi cần biết số lượng, hoặc khi
thêm/xoá nhiều. `Object` khi cấu trúc cố định và bạn cần JSON.

**Giải thích sâu:**

| | `Map` | `Object` |
|---|---|---|
| Kiểu khoá | bất kỳ (kể cả object, hàm) | chuỗi và symbol |
| Thứ tự | đúng thứ tự chèn | khoá dạng số nguyên bị **sắp xếp lên trước** |
| Kích thước | `.size` | `Object.keys(o).length` |
| Prototype | không có | kế thừa `Object.prototype` |
| JSON | phải chuyển đổi tay | trực tiếp |

Hai điểm bất ngờ thực tế:

```js
const o = {}; o.b = 1; o['2'] = 2; o.a = 3;
Object.keys(o)          // ['2','b','a']   ← khoá số nhảy lên đầu
```

Và vấn đề an toàn — **prototype pollution**:

```js
const o = {};
o['__proto__']          // không phải undefined!
'toString' in o         // true, dù bạn chưa đặt gì
```

Dùng object thường làm từ điển với khoá do người dùng nhập là một lỗ hổng: khoá `__proto__` hoặc
`constructor` có thể làm hỏng logic hoặc, trong trường hợp tệ, sửa được prototype toàn cục. `Map`
không có vấn đề này; nếu buộc dùng object thì tạo bằng `Object.create(null)`.

Về hiệu năng: `Map` được tối ưu cho việc thêm/xoá thường xuyên, `Object` được tối ưu cho cấu trúc
cố định (V8 dùng "hidden class"). Nhưng khác biệt thường không đáng kể — chọn theo **ngữ nghĩa** là
lý do đúng, chọn theo hiệu năng thường là tối ưu sớm.

</details>

---

Tiếp: [02-trinh-duyet-render-va-mang.md](./02-trinh-duyet-render-va-mang.md)
