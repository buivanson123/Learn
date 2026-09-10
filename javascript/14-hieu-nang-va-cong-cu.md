# Bài 14 — Hiệu năng và công cụ

> Sáu "mẹo tối ưu JavaScript" nổi tiếng. Máy bạn vừa bác bỏ bốn cái, và làm rõ hai cái còn lại
> chỉ đúng trong điều kiện hẹp. Đây là lý do quy tắc số một của tối ưu là **đo trước**.

---

## 1. Mẹo "vòng `for` nhanh hơn `forEach`" — ĐÚNG, và lớn hơn bạn tưởng

Duyệt mảng 5 triệu phần tử, cộng dồn:

```
  for (i=0;i<len;i++)                       6.45ms
  for...of                                  51.29ms
  reduce                                    52.22ms
  forEach                                   74.48ms
  map().filter().reduce() (3 lượt)          166.83ms
  1 vòng for làm cả 3 việc                  17.45ms
```

`for` nhanh hơn `forEach` **11.5 lần**. Đó là khác biệt lớn hơn mọi bài blog nói.

Nhưng đọc kỹ hai dòng cuối: `map().filter().reduce()` mất 166.83 ms còn một vòng `for` làm cả
ba việc mất 17.45 ms — **9.6 lần**. Nguyên nhân không phải "hàm chậm" mà là:

1. **Ba lượt duyệt** thay vì một.
2. **Hai mảng trung gian** 5 triệu phần tử được cấp phát rồi vứt đi.

Vậy có nên bỏ `map`/`filter` không? **Không.** Con số cần đặt vào bối cảnh:

| Kích thước mảng | `for` | `forEach` | Chênh lệch tuyệt đối |
|---|---|---|---|
| 5 000 000 | 6.45 ms | 74.48 ms | 68 ms |
| 1 000 | ~0.001 ms | ~0.015 ms | **0.014 ms** |

Với mảng vài trăm phần tử — tức là 99% mảng trong ứng dụng thật — chênh lệch nằm dưới ngưỡng
đo được, còn `map().filter()` thì dễ đọc hơn nhiều.

**Chỉ đổi sang `for` khi bạn đã đo và thấy vòng lặp đó là điểm nghẽn.** Nếu phải đổi, ưu tiên
gộp nhiều lượt thành một (17.45 so với 166.83 ms) — đó là phần thắng lớn, không phải bản thân
`for`.

Nếu cần cả hai (đọc được và một lượt), dùng iterator helpers
([bài 05](./05-iterator-va-generator.md) mục 5):

```
  mảng: map().filter().slice(0,10)              18.58ms
  iterator helpers: .map().filter().take(10)     0.00ms
```

---

## 2. Mẹo "nối chuỗi bằng `+=` chậm, phải dùng `array.join`" — SAI, đã lỗi thời

```
  s += (10000 lần)                              0.04ms
  push+join (10000 lần)                         0.11ms
  s += (100000 lần)                             0.44ms
  push+join (100000 lần)                        1.40ms
  s += (1000000 lần)                            30.70ms
  push+join (1000000 lần)                       21.17ms
```

Ở 10 000 và 100 000 lần, **`+=` nhanh hơn 3 lần**. Lời khuyên kinh điển sai ngược.

Lý do: V8 dùng **rope string** (`ConsString`) — `a + b` không copy gì cả, nó tạo một node nhỏ
trỏ tới hai chuỗi. Việc "làm phẳng" chỉ xảy ra khi có ai đó thật sự đọc nội dung chuỗi.

Nhưng ở 1 triệu lần thì `join` thắng lại (21.17 so với 30.70 ms), vì cây rope trở nên quá sâu
và chi phí làm phẳng vượt chi phí một mảng.

**Kết luận thực dụng:** dùng `+=` cho mọi trường hợp thường gặp. Chỉ nghĩ tới `join` khi nối
trên 500 000 lần — và lúc đó hãy đo, đừng đoán.

---

## 3. Mẹo "luôn dùng `DocumentFragment`" — SAI trên trình duyệt hiện đại

Thêm 5000 `<li>`:

```
gom chuỗi rồi gán 1 lần      1.9ms
append trực tiếp DOM         3.4ms
DocumentFragment             5.5ms      ← CHẬM NHẤT trong ba cách đúng
innerHTML += (nối chuỗi)  7366.4ms      ← cách sai
```

`DocumentFragment` **chậm hơn** `append` trực tiếp. Lời khuyên này đúng khoảng năm 2010, khi
trình duyệt tính layout lại sau mỗi lần chèn node. Chrome hiện đại gom các thay đổi và chỉ tính
layout khi cần ([bài 11](./11-dom-va-su-kien.md) mục 5), nên `DocumentFragment` giờ chỉ thêm một
lớp cấp phát.

Điều **vẫn đúng** trong lời khuyên gốc: đừng `innerHTML +=` trong vòng lặp. Chênh lệch ở đó là
**3877 lần**, không phải 60%.

---

## 4. Mẹo "giữ object cùng hidden class" — ĐÚNG, nhưng ngưỡng là 4 chứ không phải 1

Đọc `.x` một triệu lần trên mảng object có `k` hình dạng khác nhau:

```
   1 hình dạng                                  1.68ms
   2 hình dạng                                  1.84ms
   4 hình dạng                                  2.42ms
   8 hình dạng                                  6.00ms
  16 hình dạng                                  7.41ms
```

V8 có ba trạng thái inline cache:

| Số hình dạng | Trạng thái | Chi phí |
|---|---|---|
| 1 | **monomorphic** | 1.68 ms (nhanh nhất) |
| 2–4 | **polymorphic** | 1.84 → 2.42 ms (+10% đến +44%) |
| ≥ 5 | **megamorphic** | 6.00 ms (**gấp 3.6 lần**) |

Cái bẫy: từ 1 sang 2 hình dạng gần như **miễn phí** (1.68 → 1.84). Vượt qua **4** mới là vực
thẳm. Nên đừng vặn code để đạt đúng một hình dạng — chỉ cần **đừng vượt 4**.

Ba nguồn tạo thêm hình dạng mà bạn viết mà không biết:

```js
// 1. Thêm thuộc tính sau khi tạo -> hình dạng mới
const o = { a: 1 };
if (x) o.b = 2;                    // giờ có 2 hình dạng trong hệ thống

// 2. Thứ tự khai báo khác nhau -> hình dạng KHÁC nhau, dù cùng tên thuộc tính
const p1 = { x: 1, y: 2 };
const p2 = { y: 2, x: 1 };         // hình dạng khác p1!

// 3. `delete` -> chuyển object sang "dictionary mode"
delete o.tmp;
```

Cách sửa: khai báo **đủ mọi thuộc tính, đúng thứ tự, ngay lúc tạo**:

```js
const o = { a: 1, b: x ? 2 : undefined };    // ✅ một hình dạng duy nhất
```

---

## 5. Mẹo "`delete` chậm, dùng `= undefined`" — ĐÚNG, và đo được

```
  delete o.tmp rồi đọc o.x                  21.97ms
  o.tmp=undefined rồi đọc o.x               12.09ms
```

**Chậm 1.8 lần**, và cái giá không nằm ở bản thân `delete` mà ở **các lần đọc sau đó**:
`delete` đẩy object sang *dictionary mode*, nơi thuộc tính lưu trong hash table thay vì offset
cố định. Mọi phép đọc từ đó đều chậm hơn.

Nhưng cẩn thận: `= undefined` **không tương đương** `delete`.

```js
const o = { a: 1, b: 2 };
o.b = undefined;
console.log('b' in o, Object.keys(o), JSON.stringify(o));
```

```
true [ 'a', 'b' ] {"a":1}
```

Key `b` **vẫn tồn tại** — `'b' in o` là `true`, `Object.keys` vẫn liệt kê nó. Chỉ có
`JSON.stringify` bỏ qua ([bài 03](./03-kieu-du-lieu-va-so-sanh.md) mục 6).

Nên: dùng `= undefined` trong vòng lặp nóng, dùng `delete` khi bạn thật sự cần key biến mất
(ví dụ trước khi so sánh `Object.keys`). Hoặc tốt nhất — dùng `Map` cho dữ liệu cần thêm/xoá
khoá thường xuyên.

---

## 6. Mẹo "`try/catch` chặn tối ưu hoá" — ĐÚNG một nửa, và nửa còn lại quan trọng hơn

```
  vòng for trần                                 6.32ms
  try{ vòng for }catch                          26.60ms       ← chậm 4.2 lần
  vòng for gọi hàm có try/catch bên trong       6.51ms        ← không mất gì
  try/catch NGOÀI hàm chứa vòng for             6.35ms        ← không mất gì
```

Chi phí chỉ xuất hiện khi **vòng lặp nóng nằm trực tiếp bên trong `try`**. Đặt `try/catch`
bao ngoài hàm, hoặc trong một hàm được gọi từ vòng lặp, thì **không mất gì cả**.

Vậy đừng bỏ `try/catch` — chỉ cần đặt nó đúng chỗ:

```js
// ❌ chậm 4.2 lần
function xuLy(arr) {
  try {
    for (let i = 0; i < arr.length; i++) tinh(arr[i]);
  } catch (e) { log(e) }
}

// ✅ cùng ngữ nghĩa, không mất gì
function xuLy(arr) {
  for (let i = 0; i < arr.length; i++) tinh(arr[i]);
}
try { xuLy(arr) } catch (e) { log(e) }
```

---

## 7. Mẹo "`Array.from` gọn hơn nên dùng nó" — cẩn thận

```
  Array.from({length:1e6}, (_,i) => i)          46.46ms
  for + push                                    14.40ms
```

**Chậm 3.2 lần.** `Array.from` với object giả-mảng phải đi qua giao thức iterator/length và gọi
callback cho từng phần tử. Với 1000 phần tử thì không sao; với 1 triệu thì đáng để ý.

Ba cách tạo mảng, xếp theo tốc độ:

```js
const a = new Array(n);                                  // nhanh nhất nhưng SPARSE (nhiều lỗ)
const b = []; for (let i = 0; i < n; i++) b.push(i);     // nhanh, packed
const c = Array.from({ length: n }, (_, i) => i);        // chậm nhất, gọn nhất
```

⚠️ `new Array(n)` tạo mảng **sparse** — V8 dùng biểu diễn `HOLEY` chậm hơn, và `map`/`forEach`
**bỏ qua** các lỗ:

```js
new Array(3).map((_, i) => i)     // -> [ <3 empty items> ]  KHÔNG phải [0,1,2]
new Array(3).fill(0).map((_, i) => i)   // -> [0,1,2]  ✅ fill trước
```

---

## 8. Quy trình tối ưu: bốn bước, theo đúng thứ tự

**Bước 1 — Đo, đừng đoán.** Trong 8 mẹo trên, bốn cái sai hoặc lỗi thời. Trực giác về hiệu
năng JavaScript gần như luôn sai vì V8 thay đổi mỗi vài tháng.

**Bước 2 — Tìm điểm nghẽn thật, không tối ưu chỗ ngẫu nhiên.**

Trong Node:

```bash
node --cpu-prof app.js          # sinh file .cpuprofile, kéo vào tab Performance của DevTools
node --prof app.js && node --prof-process isolate-*.log > out.txt
```

Trong trình duyệt: tab **Performance**, ghi lại thao tác chậm, xem *Bottom-Up* để biết hàm nào
chiếm nhiều thời gian tự thân.

Trong code, đo một đoạn cụ thể:

```js
performance.mark('a');
lamViec();
performance.mark('b');
console.log(performance.measure('viec', 'a', 'b').duration);
```

**Bước 3 — Sửa theo thứ tự lợi ích giảm dần.** Kinh nghiệm thực tế, xếp theo mức lợi ích:

| Việc | Mức lợi ích |
|---|---|
| Bỏ hẳn công việc không cần làm (cache, tính lười, phân trang) | 10–1000× |
| Sửa thuật toán O(n²) → O(n) (như `innerHTML +=`) | 100–4000× |
| Bỏ layout thrashing | 500× |
| Đẩy việc CPU sang Worker | độ mượt từ 0 lên 26 khung |
| Gộp nhiều lượt duyệt thành một | 10× |
| Đổi `forEach` sang `for` | 1.1–11× (chỉ với mảng rất lớn) |
| Vặn hidden class | 1.1–3.6× |

Bốn dòng đầu là nơi có kết quả. Hai dòng cuối là nơi người ta hay dành thời gian.

**Bước 4 — Đo lại.** Nếu không đo lại, bạn không biết mình vừa làm nó nhanh hơn hay chậm hơn.

---

## 9. Công cụ: bộ tối thiểu năm 2026

### Test — Vitest

```bash
npm i -D vitest
```

```js
// tien-ich.test.js
import { expect, test, vi } from 'vitest';
import { thuLai } from './tien-ich.js';

test('thuLai thử đúng 3 lần rồi ném', async () => {
  const fn = vi.fn().mockRejectedValue(new Error('hỏng'));
  vi.useFakeTimers();                                   // ✅ không chờ thật
  const p = expect(thuLai(fn, { lan: 3 })).rejects.toThrow('hỏng');
  await vi.runAllTimersAsync();
  await p;
  expect(fn).toHaveBeenCalledTimes(3);
});
```

Hai điều quan trọng khi test code bất đồng bộ:

- **`vi.useFakeTimers()` + `runAllTimersAsync()`** — không có nó, test retry với backoff phải
  chờ thật vài giây.
- Nhớ bài 06 bài tập 3: đừng dùng `setTimeout(0)` để "đợi state cập nhật". Hãy `await` chính
  promise đó.

### Lint — ESLint flat config

```js
// eslint.config.js
import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    rules: {
      'no-floating-promises': 'off',            // cần typescript-eslint mới có bản thật
      'require-atomic-updates': 'error',        // bắt race condition quanh await
      'no-await-in-loop': 'warn',               // nhắc bạn xem lại tuần tự vs song song
      'no-constant-binary-expression': 'error',
    },
  },
];
```

Ba rule đáng bật nhất cho code bất đồng bộ: `require-atomic-updates`, `no-await-in-loop`, và
(với TypeScript) `@typescript-eslint/no-floating-promises` — rule cuối bắt đúng kiểu bug số 1 ở
[bài 07](./07-promise-va-async.md) mục 6.

### Build — chọn theo việc

| Việc | Dùng |
|---|---|
| Ứng dụng web | **Vite** |
| Thư viện (ship cả ESM + CJS) | **tsdown** hoặc `tsup` |
| Chỉ cần chuyển TS → JS thật nhanh | `esbuild`, `swc` |
| Bundle cho Node | thường **không cần bundle** — ship nguyên file |

### Kiểm tra kích thước bundle

```bash
npx vite build -- --mode production   # Vite in ra kích thước từng chunk
npx source-map-explorer dist/assets/*.js
npx agadoo ./dist/index.mjs           # kiểm tree-shaking có chạy không
```

`agadoo` là công cụ hay bị bỏ qua — nó chỉ rõ **dòng nào** trong gói bạn gây side effect và
chặn tree-shaking ([bài 09](./09-module-esm-cjs.md) mục 6).

---

## 10. Bài tập

### Bài 1 — Tối ưu hàm này, theo đúng thứ tự

```js
function timKiem(sanPham, tuKhoa) {
  return sanPham
    .map(p => ({ ...p, ten_thuong: p.ten.toLowerCase() }))
    .filter(p => p.ten_thuong.includes(tuKhoa.toLowerCase()))
    .sort((a, b) => a.gia - b.gia)
    .slice(0, 20);
}
```

Hàm được gọi mỗi lần người dùng gõ một ký tự, với `sanPham` là 50 000 mục. Nêu **bốn** vấn đề
theo thứ tự lợi ích giảm dần.

<details><summary>Gợi ý đáp án</summary>

**1. Gọi mỗi ký tự (lợi ích lớn nhất — bỏ hẳn công việc).** Gõ "áo thun" là 7 lần chạy toàn bộ
hàm trên 50 000 mục. Debounce trước đã:

```js
const timKiemDebounce = debounce(timKiem, 150);
```

Bảy lần chạy xuống một lần: **7×** không cần sửa một dòng logic nào.

**2. `map` tạo 50 000 object mới, mỗi lần gõ.** `{ ...p, ten_thuong }` sao chép toàn bộ sản
phẩm chỉ để thêm một trường. Tính sẵn **một lần** khi dữ liệu về:

```js
// Lúc nạp dữ liệu, chạy đúng 1 lần
const daChuanBi = sanPham.map(p => ({ ...p, ten_thuong: p.ten.toLowerCase() }));
```

**3. `toLowerCase()` của `tuKhoa` gọi 50 000 lần** — nó nằm trong callback `filter`. Đưa ra
ngoài:

```js
const tk = tuKhoa.toLowerCase();
```

**4. `sort` toàn bộ kết quả rồi chỉ lấy 20.** Nếu 10 000 mục khớp, bạn sort 10 000 để dùng 20.
Với `.slice(0,20)` sau `sort` thì không tránh được bằng thư viện chuẩn, nhưng gộp một lượt thì
được:

```js
function timKiem(daChuanBi, tuKhoa) {
  const tk = tuKhoa.toLowerCase();
  if (!tk) return [];
  const kq = [];
  for (let i = 0; i < daChuanBi.length; i++) {          // MỘT lượt
    if (daChuanBi[i].ten_thuong.includes(tk)) kq.push(daChuanBi[i]);
  }
  return kq.sort((a, b) => a.gia - b.gia).slice(0, 20);
}
```

Chú ý thứ tự: ba cải tiến đầu (debounce, tính sẵn, hoist biến) mang lại gần hết lợi ích và
**không** làm code khó đọc hơn. Việc đổi `map/filter` sang vòng `for` là bước cuối cùng, chỉ
làm sau khi đã đo và thấy vẫn chậm.

Nếu vẫn chậm sau tất cả: vấn đề không còn là JavaScript nữa, mà là **tìm kiếm 50 000 mục ở
client**. Lúc đó câu trả lời đúng là chỉ mục ngược (`Map` từ token → danh sách id) hoặc để
server làm.

</details>

### Bài 2 — Đoán rồi đo

Đoán xem cái nào nhanh hơn, rồi chạy `bench` để kiểm tra. Bạn đoán đúng mấy trên năm?

```js
// A
arr.includes(x)                    vs    new Set(arr).has(x)
// B
Object.keys(o).length === 0        vs    JSON.stringify(o) === '{}'
// C
[...arr]                           vs    arr.slice()
// D
str.split('').reverse().join('')   vs    [...str].reverse().join('')
// E
a === b                            vs    Object.is(a, b)
```

<details><summary>Gợi ý đáp án</summary>

Chạy trên mảng/chuỗi 100 000 phần tử:

```
  A arr.includes(x) (1 lần)                     0.02ms
  A new Set(arr).has(x) (1 lần)                 4.03ms      ← Set CHẬM HƠN 200 lần
  A arr.includes trong vòng 1000 lần           21.34ms
  A Set dựng 1 lần + has 1000 lần               4.04ms      ← giờ Set thắng 5 lần

  B Object.keys(o).length === 0                 0.00ms
  B JSON.stringify(o) === '{}'                  0.00ms      ← cả hai dưới ngưỡng đo

  C [...arr]                                    0.08ms
  C arr.slice()                                 0.08ms      ← BẰNG NHAU

  D str.split('').reverse().join('')            0.76ms
  D [...str].reverse().join('')                 1.24ms      ← spread chậm hơn 1.6 lần

  E a === b / Object.is(a, b)                   cả hai dưới ngưỡng đo
```

Bài học từ từng cặp:

**A — câu trả lời phụ thuộc số lần tra.** Dựng `Set` tốn 4 ms. Tra **một** lần thì `includes`
thắng 200 lần; tra **1000** lần thì `Set` thắng 5 lần. Đây là ví dụ tốt nhất cho chuyện "cái
nào nhanh hơn" là câu hỏi vô nghĩa nếu không nói rõ **bao nhiêu lần**.

**B và C — bằng nhau.** Nếu bạn đoán `slice()` nhanh hơn `[...arr]` (lời khuyên hay gặp trên
mạng), bạn đoán sai: V8 nhận ra spread trên một mảng thật và dùng đúng đường copy nhanh như
`slice`. Chọn theo cái nào bạn thấy dễ đọc hơn.

Chú ý cặp B: hai cách đều `0.00ms` **với object rỗng**. Nhưng `JSON.stringify` phải duyệt toàn
bộ object, nên với object 10 000 khoá nó chậm hẳn, còn `Object.keys(o).length` thì… cũng phải
tạo mảng 10 000 khoá. Cách rẻ nhất thật sự là không tạo gì cả:

```js
const rong = (o) => { for (const _ in o) return false; return true };
```

**D — `split('')` nhanh hơn spread**, nhưng `split('')` **sai** với emoji và ký tự ngoài BMP:

```js
'👨‍👩‍👧'.split('').length      // -> 8   (cắt vụn surrogate pair)
[...'👨‍👩‍👧'].length            // -> 5   (theo code point)
[...new Intl.Segmenter().segment('👨‍👩‍👧')].length   // -> 1   (theo ký tự người đọc thấy)
```

Đây là bài học quan trọng nhất của cả bài 14: **`split('')` nhanh hơn và sai**. Chọn cái đúng
trước, tối ưu sau — và với chuỗi có thể chứa emoji thì đáp án đúng là `Intl.Segmenter`, chậm
nhất trong cả ba.

**E** — chênh lệch nằm dưới ngưỡng đo. Chọn theo ngữ nghĩa: `Object.is` khi bạn cần phân biệt
`NaN`/`-0` ([bài 03](./03-kieu-du-lieu-va-so-sanh.md) mục 2), `===` cho mọi trường hợp khác.

</details>

---

**Tiếp theo:** [Bài 15 — Dự án: mini-framework reactive](./15-du-an-mini-framework.md)
