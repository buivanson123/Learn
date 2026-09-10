# Bài 09 — Module: ESM và CJS

> Hai hệ module cùng tồn tại trong Node và không tương thích hoàn toàn. Bài này đo đúng chỗ
> chúng khác nhau, để bạn không mất buổi chiều với `ERR_REQUIRE_ESM`.

---

## 1. Khác biệt cốt lõi: khi nào biết ai export gì

| | CommonJS | ESM |
|---|---|---|
| Phân tích phụ thuộc | **lúc chạy** (`require` là lời gọi hàm) | **lúc biên dịch** (trước khi chạy dòng nào) |
| `export` là | thuộc tính của một object | **binding** (liên kết tới biến) |
| Đọc giá trị mới | không — bạn giữ bản chụp | **có** — luôn thấy giá trị hiện tại |
| Nạp bất đồng bộ | không | có (nên mới có top-level await) |
| Tree-shaking | rất khó | được |

Cột "phân tích lúc biên dịch" là gốc của mọi khác biệt còn lại.

---

## 2. Live binding: ESM có, CJS không

```js
// counter.js
export let count = 0;
export function inc() { count++ }
console.log('  [counter.js] thân module chạy');
```

```js
// a.mjs
import { count, inc } from './counter.js';
console.log('1 count ban đầu:', count);
inc(); inc();
console.log('2 sau inc() 2 lần:', count);
try { count = 99 } catch (e) { console.log('3 gán vào import:', e.constructor.name + ': ' + e.message) }
```

```
  [counter.js] thân module chạy
1 count ban đầu: 0
2 sau inc() 2 lần: 2
3 gán vào import: TypeError: Assignment to constant variable.
```

Hai điều: biến `count` **tự cập nhật** (live binding), và bạn **không được gán** vào nó — mọi
import đều là read-only, như `const`.

Làm y hệt bằng CommonJS:

```js
// c1.cjs
let count = 0;
module.exports = { count, inc() { count++; module.exports.count2 = count } };
```

```js
// c2.cjs
const m = require('./c1.cjs');
console.log('1 count:', m.count);
m.inc(); m.inc();
console.log('2 sau inc():', m.count, '| biến thật sự:', m.count2);
```

```
1 count: 0
2 sau inc(): 0 | biến thật sự: 2
```

`m.count` **đứng im ở 0**. Lúc `module.exports = { count, ... }` chạy, giá trị `0` được **chép**
vào thuộc tính `count`. Sau đó `count++` chỉ đổi biến cục bộ, không đổi thuộc tính đã chép.

Đây là nguyên nhân thật của rất nhiều bug "config không cập nhật", "biến cờ luôn là giá trị
khởi tạo" trong code CJS. Cách sửa trong CJS là export **hàm getter**, không export giá trị:

```js
module.exports = { getCount: () => count, inc() { count++ } };
```

---

## 3. Vòng lặp import: hai hành vi hoàn toàn khác

### ESM — ném `ReferenceError` (TDZ)

```js
// x.js
import { y } from './y.js';
export const x = 'X';
console.log('x.js thấy y =', y);

// y.js
import { x } from './x.js';
export const y = 'Y';
console.log('y.js thấy x =', x);
```

```
$ node x.js
ReferenceError: Cannot access 'x' before initialization
    at file:///.../y.js:3:30
```

ESM dựng xong **đồ thị** trước, rồi chạy thân module theo thứ tự sâu-trước. `y.js` chạy trước
`x.js`, nên khi nó đọc `x` thì binding đã tồn tại nhưng chưa được khởi tạo → TDZ (đúng cơ chế
ở [bài 01](./01-scope-closure-tdz.md)).

**Lỗi ồn ào — dễ tìm.** Đó là điểm tốt.

### CJS — trả về object **thiếu một nửa**, im lặng

```js
// cx.cjs
exports.x = 'X';
const { y } = require('./cy.cjs');
console.log('cx thấy y =', y);
exports.xx = 'XX';

// cy.cjs
const m = require('./cx.cjs');
console.log('cy thấy cx =', JSON.stringify(m), '<- thiếu xx');
exports.y = 'Y';
```

```
$ node cx.cjs
cy thấy cx = {"x":"X"} <- thiếu xx
cx thấy y = Y
(node:78748) Warning: Accessing non-existent property 'toJSON' of module exports
inside circular dependency
```

`cy.cjs` nhận được `module.exports` của `cx.cjs` **ở trạng thái dở dang** — có `x`, chưa có
`xx`. Không lỗi, chỉ là một object thiếu thuộc tính. Nếu `cy` gọi `m.xx()` thì mới nổ
`TypeError: m.xx is not a function`, ở một chỗ hoàn toàn không liên quan.

Cảnh báo `Accessing non-existent property ... inside circular dependency` của Node là dấu hiệu
duy nhất bạn nhận được. **Thấy nó thì đi tìm vòng lặp import ngay**, đừng bỏ qua.

---

## 4. Bảng tương thích: cái gì gọi được cái gì

```
                 │ require() nó  │ import nó
─────────────────┼───────────────┼──────────────────
File .cjs        │ ✅            │ ✅ (chỉ default)
File .mjs        │ ✅ Node 22+   │ ✅
```

`require()` một file ESM **đã chạy được từ Node 22** (trước đó là `ERR_REQUIRE_ESM`) — nhưng
chỉ khi module ESM đó **không có top-level await**:

```js
// esm-co-tla.mjs
await new Promise(r => setTimeout(r, 1));
export const a = 1;
```

```
$ node -e "require('./esm-co-tla.mjs')"
Error [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level
await. Use import() instead. To see where the top-level await comes from, use
--experimental-print-required-tla.
```

Bỏ dòng `await` đi thì `require` một file `.mjs` chạy bình thường trên Node 22:

```
$ node -e "const m = require('./notla.mjs'); console.log('OK:', m.a)"
OK: 1
```

Đây là bẫy đáng nhớ: thêm **một** dòng `await` ở top level của một module có thể phá vỡ mọi
chỗ đang `require` nó.

### `import` một module CJS: chỉ có `default`

```js
import pkg from './c1.cjs';           // ✅ pkg là module.exports
import { inc } from './c1.cjs';       // ⚠ có thể chạy, có thể không
```

Node cố "đoán" các named export của CJS bằng cách phân tích cú pháp tĩnh. Nó đoán được với
`exports.a = 1`, nhưng **không** đoán được với:

```js
if (dieuKien) exports.a = 1;          // gán có điều kiện
Object.assign(exports, obj);          // gán động
module.exports = taoExports();        // gán từ hàm
```

Với những trường hợp đó, `import { a }` cho:

```
SyntaxError: Named export 'a' not found. The requested module './dyn.cjs' is a CommonJS
module, which may not support all module.exports as named exports.
```

Cách an toàn:

```js
import pkg from './cjs-module.cjs';
const { a, b } = pkg;                 // luôn chạy
```

---

## 5. `package.json`: ba trường quyết định mọi thứ

```json
{
  "name": "goi-cua-toi",
  "type": "module",
  "exports": {
    ".":          { "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./tien-ich": { "import": "./dist/tien-ich.mjs", "require": "./dist/tien-ich.cjs" },
    "./package.json": "./package.json"
  },
  "sideEffects": false
}
```

**`"type"`** quyết định đuôi `.js` được hiểu là gì:

| `type` | `.js` là | `.mjs` là | `.cjs` là |
|---|---|---|---|
| `"module"` | ESM | ESM | CJS |
| `"commonjs"` hoặc không có | CJS | ESM | CJS |

**`"exports"`** thay thế `"main"`. Nó làm hai việc quan trọng:

1. **Chặn** truy cập vào file nội bộ. Khai `exports` rồi thì `import 'goi/src/private.js'`
   báo `ERR_PACKAGE_PATH_NOT_EXPORTED` — bạn kiểm soát được API công khai của gói.
2. Cho phép ship **cả hai** bản ESM và CJS từ một gói.

Hệ quả cần biết: nếu bạn khai `exports` mà quên `"./package.json"`, một số công cụ (bundler,
`postcss`, một số plugin) sẽ vỡ vì chúng đọc `package.json` của gói bạn.

**`"sideEffects": false`** là lời hứa với bundler: "import file nào trong gói này mà không dùng
gì trong đó thì cứ xoá luôn". Nó là điều kiện để tree-shaking hoạt động.

⚠️ Nếu gói bạn **có** side effect (ví dụ import file CSS, hoặc polyfill tự đăng ký), khai
`false` sẽ làm bundler xoá mất chúng. Khai cụ thể thì an toàn:

```json
"sideEffects": ["./dist/polyfill.js", "*.css"]
```

---

## 6. Tree-shaking: vì sao nó thường không chạy

Ba điều kiện, thiếu một là không shake được:

1. Module phải là **ESM** (import/export tĩnh).
2. Không có side effect ở top level — hoặc phải khai `sideEffects` đúng.
3. Bundler phải chứng minh được việc xoá là an toàn.

Điều kiện 2 là chỗ hay vỡ nhất. Ví dụ cụ thể:

```js
// tien-ich.js
export const a = () => 1;
export const b = () => 2;

console.log('module đã nạp');          // ⚠ side effect ở top level
```

Bundler **không xoá được** `b` nữa, vì nó không chắc `b` có liên quan tới `console.log` không.
Bỏ dòng `console.log` đi thì `import { a }` chỉ mang theo `a`.

Ba mẫu code chặn tree-shaking mà bạn viết mà không biết:

```js
// 1. Gán vào prototype của builtin ở top level
Array.prototype.last = function () { ... };

// 2. Tạo instance ở top level
export const client = new ApiClient();       // luôn được giữ, dù không ai import

// 3. Re-export cả gói
export * from './moi-thu';                    // bundler phải giữ nhiều hơn cần thiết
```

Sửa mẫu 2 bằng lazy init:

```js
let _client;
export const getClient = () => (_client ??= new ApiClient());
```

**Cách kiểm chứng** gói của bạn có shake được không, không cần dựng bundler:

```bash
npx agadoo ./dist/index.mjs
```

Nó báo cụ thể dòng nào gây side effect.

---

## 7. `import()` động: nạp lười

```js
// Nạp khi cần, không nạp lúc khởi động
button.addEventListener('click', async () => {
  const { ve } = await import('./bieu-do-nang.js');    // 300 KB, chỉ tải khi bấm
  ve(duLieu);
});
```

Ba điều:

1. `import()` trả về **promise** của module namespace object, dùng được ở cả CJS và ESM.
2. Bundler tự **tách chunk** ở mỗi `import()` — đây là cách chính để chia nhỏ bundle.
3. Đường dẫn phải **tĩnh đủ** để bundler phân tích. `import(bien)` hoàn toàn động thì bundler
   không tách được chunk và có thể gộp hết mọi thứ.

```js
await import(`./locale/${lang}.js`);        // ✅ bundler tạo chunk cho mọi file trong ./locale
await import(duongDanTuAPI);                // ❌ không phân tích được
```

Module chỉ được nạp **một lần** — lần `import()` thứ hai lấy từ cache, không chạy lại thân module.

---

## 8. Bài tập

### Bài 1 — Vì sao biến cờ không đổi

```js
// config.cjs
let batLog = false;
module.exports = { batLog, bat() { batLog = true } };

// app.cjs
const cfg = require('./config.cjs');
cfg.bat();
if (cfg.batLog) console.log('có log');       // không bao giờ in
```

Sửa **hai** cách: giữ CJS, và chuyển sang ESM.

<details><summary>Gợi ý đáp án</summary>

Nguyên nhân: `module.exports = { batLog, ... }` **chép giá trị** `false` vào thuộc tính. Hàm
`bat()` đổi biến cục bộ, thuộc tính không đổi theo.

**Giữ CJS — export getter:**

```js
let batLog = false;
module.exports = {
  get batLog() { return batLog },      // ✅ đọc lại mỗi lần
  bat() { batLog = true },
};
```

Hoặc gán thẳng vào `exports` thay vì dùng biến cục bộ:

```js
exports.batLog = false;
exports.bat = () => { exports.batLog = true };
```

**Chuyển ESM** — live binding lo hộ:

```js
// config.mjs
export let batLog = false;
export function bat() { batLog = true }

// app.mjs
import { batLog, bat } from './config.mjs';
bat();
console.log(batLog);         // -> true
```

Chạy thử để thấy khác biệt:

```
CJS:  2 sau inc(): 0
ESM:  2 sau inc() 2 lần: 2
```

</details>

### Bài 2 — Phá vỡ vòng lặp import

Hai module cần nhau. Sửa mà **không** gộp thành một file.

```js
// nguoi-dung.mjs
import { layDonHang } from './don-hang.mjs';
export class NguoiDung { donHang() { return layDonHang(this.id) } }

// don-hang.mjs
import { NguoiDung } from './nguoi-dung.mjs';
export function layDonHang(id) { return db.query(id).map(r => new NguoiDung(r)) }
```

<details><summary>Gợi ý đáp án</summary>

Điểm mấu chốt: vòng lặp import **chỉ nổ khi bạn dùng giá trị lúc thân module đang chạy**. Ở
đây cả hai chỉ dùng nhau **bên trong hàm**, nên thực ra nó **chạy được**:

```
$ node -e "import('./nd.mjs').then(m => console.log('gọi hàm:', new m.NguoiDung(7).donHang()[0].id))"
dh.mjs xong
nd.mjs xong
gọi hàm: 7
```

Chú ý thứ tự: `dh.mjs` chạy xong **trước** `nd.mjs` — ESM nạp sâu-trước, nên module được
import chạy trước module import nó.

Vì lúc hàm được gọi, cả hai module đã nạp xong. Vòng lặp import không tự động là lỗi.

Nó **sẽ** nổ nếu bạn dùng ở top level, ví dụ `class NguoiDung extends BaseTuDonHang`:

```
ReferenceError: Cannot access 'BaseTuDonHang' before initialization
```

Ba cách sửa thật, theo thứ tự ưu tiên:

**1. Tách phần dùng chung ra module thứ ba** (tốt nhất — phá vòng thật sự):

```js
// kieu.mjs — không import gì
export class NguoiDung { ... }
// don-hang.mjs
import { NguoiDung } from './kieu.mjs';
```

**2. Đảo chiều phụ thuộc** — truyền vào thay vì import:

```js
export function layDonHang(id, TaoNguoiDung) {
  return db.query(id).map(r => TaoNguoiDung(r));
}
```

**3. Nạp lười bằng `import()`** — chỉ khi hai cách trên không khả thi:

```js
export async function layDonHang(id) {
  const { NguoiDung } = await import('./nguoi-dung.mjs');
  return db.query(id).map(r => new NguoiDung(r));
}
```

Cách 3 biến hàm đồng bộ thành bất đồng bộ — lan ra khắp code gọi nó. Dùng cuối cùng.

</details>

### Bài 3 — Gói này ship sai

Xem `package.json` dưới và chỉ ra **bốn** vấn đề.

```json
{
  "name": "tien-ich",
  "main": "src/index.js",
  "type": "module",
  "exports": { ".": "./src/index.js" },
  "sideEffects": false,
  "files": ["src"]
}
```

Trong `src/index.js` có `import './dang-ky-polyfill.js'`.

<details><summary>Gợi ý đáp án</summary>

**1. `sideEffects: false` nhưng có polyfill.** Bundler được phép xoá dòng
`import './dang-ky-polyfill.js'` vì không ai dùng gì từ nó → polyfill không bao giờ đăng ký.
Đây là bug chỉ xuất hiện **sau khi build production**, không thấy ở dev.

```json
"sideEffects": ["./src/dang-ky-polyfill.js"]
```

**2. Chỉ có bản ESM.** `"type": "module"` + `exports` chỉ trỏ tới ESM nghĩa là người dùng CJS
không `require` được (trừ Node 22+, và vẫn vỡ nếu bạn có top-level await). Nếu muốn hỗ trợ cả
hai:

```json
"exports": { ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs" } }
```

**3. Thiếu `"./package.json"` trong `exports`.** Nhiều công cụ đọc file này; khai `exports` mà
không liệt kê nó thì chúng nhận `ERR_PACKAGE_PATH_NOT_EXPORTED`.

**4. Ship thẳng `src`, không có bản build.** Người dùng nhận code nguồn của bạn — nếu nó có
cú pháp mới hơn runtime của họ thì vỡ. Và `"main"` cùng `"exports"` trỏ hai chỗ khác nhau
định dạng: `main` là fallback cho công cụ cũ, nên nó **nên** là bản CJS.

Bản sửa:

```json
{
  "name": "tien-ich",
  "type": "module",
  "main": "./dist/index.cjs",
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.cjs" },
    "./package.json": "./package.json"
  },
  "sideEffects": ["./dist/dang-ky-polyfill.mjs"],
  "files": ["dist"]
}
```

</details>

---

**Tiếp theo:** [Bài 10 — JavaScript hiện đại 2026](./10-js-hien-dai-2026.md)
