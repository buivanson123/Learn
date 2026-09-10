# 10 Bài tập JavaScript - `Module & Đóng gói`

> **Quy tắc:** Không chạy code ngay. Hãy tự dự đoán kết quả hoặc lỗi,
> sau đó giải thích vì sao.

> **Lưu ý:** Mọi bài có nhiều file đều chạy dưới dạng **ESM** (thư mục có
> `package.json` chứa `{ "type": "module" }`), và file được chạy là `main.js`.

## Bài 1 - Module scope

``` javascript
// file: main.js
var a = 1;
let b = 2;
function f() {}

console.log(globalThis.a);
console.log(globalThis.f);
console.log(this);
console.log(typeof a);

try {
    chuaKhaiBao = 10;
} catch (e) {
    console.log(e.name);
}
```

**Câu hỏi**
1. Ba dòng `globalThis.a`, `globalThis.f`, `this` in ra gì? Nếu đoạn code này nằm trong một
   `<script>` thường (không phải module) thì ba dòng đó sẽ khác đi thế nào?
2. `typeof a` in ra gì? Có mâu thuẫn với câu 1 không — vì sao?
3. Dòng `chuaKhaiBao = 10` in ra gì? Vì sao nó lại lỗi, trong khi cùng dòng đó viết trong một file
   JS bình thường lại chạy được?

------------------------------------------------------------------------

## Bài 2 - Named export và thứ không được export

``` javascript
// file: math.js
export function add(a, b) { return a + b; }

function nhanDoi(x) { return x * 2; }

export const TEN = "math";
```

``` javascript
// file: main.js
import { add, TEN } from "./math.js";

console.log(add(1, 2));
console.log(TEN);
```

**Câu hỏi**
1. `main.js` in ra gì?
2. Nếu thêm `nhanDoi` vào dòng import (`import { add, TEN, nhanDoi } from "./math.js"`) thì chuyện gì
   xảy ra? Là lỗi loại gì, và nó xảy ra **trước hay sau** khi `console.log(add(1, 2))` chạy?
3. Nếu viết `import { Add } from "./math.js"` (viết hoa chữ `A`) thì sao? Điều này nói lên đặc điểm gì
   của named export?

------------------------------------------------------------------------

## Bài 3 - Default export và cái tên tùy ý

``` javascript
// file: logger.js
export default function ghi(msg) { return `LOG: ${msg}`; }

export function canhBao(msg) { return `WARN: ${msg}`; }
```

``` javascript
// file: main.js
import ghi from "./logger.js";
import batKyTen from "./logger.js";
import { canhBao } from "./logger.js";

console.log(ghi("a"));
console.log(batKyTen("b"));
console.log(ghi === batKyTen);
console.log(canhBao("c"));
```

**Câu hỏi**
1. Bốn dòng log in ra gì?
2. `ghi === batKyTen` cho kết quả đó vì sao? Hai dòng `import` từ cùng một file có tạo ra hai bản
   khác nhau không?
3. Trong `logger.js`, hàm default **có tên là `ghi`**. Vậy nếu ở `main.js` viết
   `import { ghi } from "./logger.js"` (có ngoặc nhọn) thì chạy được không? Vì sao?

------------------------------------------------------------------------

## Bài 4 - Live binding

``` javascript
// file: dem.js
export let n = 0;

export function tang() { n++; }
```

``` javascript
// file: main.js
import { n, tang } from "./dem.js";

console.log(n);

tang();
tang();
console.log(n);

try {
    n = 100;
} catch (e) {
    console.log(e.name, "-", e.message);
}
```

**Câu hỏi**
1. Hai dòng `console.log(n)` in ra gì?
2. Ta chưa hề gán lại `n` ở `main.js`, vậy vì sao giá trị của nó thay đổi? Nếu `import` chỉ là "copy
   giá trị một lần" thì kết quả sẽ khác đi thế nào?
3. Dòng `n = 100` in ra gì? Điều đó cho thấy liên kết giữa module gốc và nơi import là **một chiều**
   hay **hai chiều**?

------------------------------------------------------------------------

## Bài 5 - Module chạy mấy lần?

``` javascript
// file: state.js
console.log("state.js dang chay");

export const data = { count: 0 };

export function tang() { data.count++; }
```

``` javascript
// file: a.js
import { data, tang } from "./state.js";

console.log("a.js thay count =", data.count);
tang();
```

``` javascript
// file: b.js
import { data } from "./state.js";

console.log("b.js thay count =", data.count);
```

``` javascript
// file: main.js
import "./a.js";
import "./b.js";
import { data } from "./state.js";

console.log("main thay count =", data.count);
```

**Câu hỏi**
1. Liệt kê đúng thứ tự và nội dung tất cả các dòng được in ra.
2. Dòng `"state.js dang chay"` in ra **mấy lần**, dù có 3 file cùng import nó? Vì sao?
3. `b.js` in ra `count` bằng bao nhiêu? Vì sao nó không phải `0`, trong khi `b.js` chưa hề gọi
   `tang()` lần nào?

------------------------------------------------------------------------

## Bài 6 - IIFE và biến private

``` javascript
const Bank = (function () {
    let soDu = 100;

    function kiemTra(x) { return x > 0; }

    return {
        napTien(x) {
            if (!kiemTra(x)) return soDu;
            soDu += x;
            return soDu;
        },
        xem() { return soDu; }
    };
})();

console.log(Bank.xem());
console.log(Bank.napTien(50));
console.log(Bank.napTien(-10));
console.log(Bank.soDu);

Bank.soDu = 999999;
console.log(Bank.xem());
console.log(typeof kiemTra);
```

**Câu hỏi**
1. Sáu dòng log in ra gì?
2. `Bank.soDu` in ra như vậy vì sao? Sau dòng `Bank.soDu = 999999`, số dư thật sự có bị đổi không —
   giải thích chuyện gì đã thực sự xảy ra ở dòng gán đó.
3. `typeof kiemTra` in ra gì? Viết lại toàn bộ `Bank` này thành một **module ESM** (file `bank.js`)
   sao cho giữ nguyên đúng mức đóng gói đó — phần nào thành `export`, phần nào không?

------------------------------------------------------------------------

## Bài 7 - Revealing Module pattern: bẫy xuất giá trị thay vì hàm

``` javascript
const Dem = (function () {
    let count = 0;

    function tang() { count++; return count; }
    function lay() { return count; }

    return { count, tang, lay };
})();

console.log(Dem.count);

Dem.tang();
Dem.tang();

console.log(Dem.count);
console.log(Dem.lay());

Dem.count = 100;
console.log(Dem.lay());
```

**Câu hỏi**
1. Bốn dòng log in ra gì?
2. Sau hai lần `Dem.tang()`, vì sao `Dem.count` và `Dem.lay()` lại cho **hai số khác nhau**, dù cả hai
   cùng nói về một biến `count`?
3. Sau `Dem.count = 100`, `Dem.lay()` in ra gì? Sửa đoạn `return` thế nào để `Dem.count` luôn phản ánh
   đúng giá trị thật (gợi ý: getter đã học ở ngày 3)?

------------------------------------------------------------------------

## Bài 8 - `import` nằm ở dòng nào thì chạy lúc nào?

``` javascript
// file: x.js
console.log("2 - x.js");
export const X = "X";
```

``` javascript
// file: y.js
console.log("3 - y.js");
export const Y = "Y";
```

``` javascript
// file: main.js
console.log("1 - dau main.js");

import { X } from "./x.js";

console.log("4 - giua main.js");

import { Y } from "./y.js";

console.log("5 - cuoi main.js");
```

**Câu hỏi**
1. Năm dòng được in ra theo thứ tự nào? (Cẩn thận: các con số trong chuỗi được đặt để đánh lừa.)
2. Vì sao `"1 - dau main.js"` không phải dòng đầu tiên hiện ra, dù nó là dòng code đầu tiên của file?
3. Từ kết quả trên, việc đặt `import` ở giữa file có ý nghĩa gì không? Liên hệ với lý do tại sao ESM
   **cấm** viết `import` bên trong `if` hoặc bên trong hàm.

------------------------------------------------------------------------

## Bài 9 - Circular import

``` javascript
// file: a.js
import { tenB, chaoB } from "./b.js";

export const tenA = "A";
export function chaoA() { return `A chao, B la ${tenB}`; }

console.log("a.js:", chaoB());
```

``` javascript
// file: b.js
import { tenA } from "./a.js";

export const tenB = "B";
export function chaoB() { return `B chao, A la ${tenA}`; }

console.log("b.js: tenA luc nay =", tenA);
```

``` javascript
// file: main.js
import "./a.js";
```

**Câu hỏi**
1. Chạy `main.js` thì chuyện gì xảy ra? Nếu là lỗi thì tên lỗi là gì và nổ ở file nào, dòng nào?
2. Trong `b.js` có **hai chỗ** cùng đọc `tenA`: một chỗ trong thân hàm `chaoB()`, một chỗ ở dòng
   `console.log` cuối file. Vì sao chỉ một trong hai chỗ gây lỗi?
3. Nếu **xóa hẳn** dòng `console.log` cuối `b.js` thì chương trình in ra gì? Giải thích thứ tự chạy
   giữa hai module.

------------------------------------------------------------------------

## Bài 10 - Tree-shaking

``` javascript
// file: utils.js
console.log("utils.js da duoc nap");

export function dungRoi(x) { return x + 1; }
export function khongAiDung(x) { return x - 1; }
```

``` javascript
// file: pure.js
export function a() { return 1; }
export function b() { return 2; }
```

``` javascript
// file: main.js
import { dungRoi } from "./utils.js";
import { a } from "./pure.js";

console.log(dungRoi(1), a());
```

**Câu hỏi**
1. Chạy thẳng bằng `node main.js`, dòng `"utils.js da duoc nap"` có in ra không? Hàm `khongAiDung`
   có bị xóa khỏi bộ nhớ không? (Nói cách khác: bản thân Node **có** tree-shaking không?)
2. Khi đem build bằng bundler có bật tree-shaking: hàm `b` trong `pure.js` có bị cắt không? Còn
   `khongAiDung` trong `utils.js` thì sao — **điều gì trong `utils.js`** khiến bundler ngần ngại?
3. Nếu đổi `main.js` thành đoạn dưới đây, tree-shaking còn cắt được `khongAiDung` không? Vì sao?
   ``` javascript
   import * as U from "./utils.js";
   const ten = "dungRoi";
   console.log(U[ten](1));
   ```

------------------------------------------------------------------------

# Bonus - `export default` có phải live binding không?

``` javascript
// file: m.js
let x = 1;

export default x;
export { x };
export function set(v) { x = v; }
```

``` javascript
// file: main.js
import mac, { x, set } from "./m.js";

console.log(mac, x);

set(99);

console.log(mac, x);
```

**Câu hỏi**
1. Hai dòng `console.log(mac, x)` in ra gì?
2. Cùng xuất ra từ một biến `x` duy nhất, vì sao sau `set(99)` thì `mac` và `x` lại cho hai giá trị
   khác nhau?
3. Dựa vào đó, phát biểu quy tắc: khi nào `export default` tạo ra **liên kết sống**, khi nào nó chỉ
   là **ảnh chụp giá trị**? (Gợi ý: so sánh `export default x` với `export default function f(){}`.)
4. Viết lại `m.js` sao cho nơi import default **vẫn thấy được** giá trị mới sau khi gọi `set(99)`.

------------------------------------------------------------------------
