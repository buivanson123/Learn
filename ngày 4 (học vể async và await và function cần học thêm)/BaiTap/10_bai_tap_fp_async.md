# 10 Bài tập JavaScript - `Lập trình hàm & Async`

> **Quy tắc:** Không chạy code ngay. Hãy tự dự đoán kết quả hoặc lỗi,
> sau đó giải thích vì sao.

## Bài 1 - Pure vs impure: trả về mảng mới hay sửa mảng gốc

``` javascript
const gio = ["Toan"];

function themA(list, mon) {
    list.push(mon);
    return list;
}

function themB(list, mon) {
    return [...list, mon];
}

const kqA = themA(gio, "Ly");
console.log(gio);
console.log(kqA === gio);

const kqB = themB(gio, "Hoa");
console.log(gio);
console.log(kqB);
console.log(kqB === gio);
```

**Câu hỏi**
1. Sau khi gọi `themA`, `gio` in ra gì? `kqA === gio` là `true` hay `false`? Vì sao?
2. Sau khi gọi `themB`, `gio` in ra gì? `kqB` in ra gì? Vì sao `gio` lần này không đổi?
3. Hàm nào là pure, hàm nào impure? Nêu một hậu quả thực tế khi dùng nhầm `themA` ở nơi cần `themB`.

**Trả lời của bạn:**

1. `gio` in ra mảng gồm `Toan` và `Ly`, 
   `kqA === gio` bằng `true` vị lúc này `return list` vẫn tham chiếu đến biến `gio`.
2. `gio` vẫn in ra mảng gồm `Toan`, `Ly`.
   - `kqB` in ra mảng gồm `Toan`, `Ly`, `Hoa`.
   - `gio` lần này không thay đổi vì `themB` thực hiện shallow copy bằng `[...list, mon]`;
     `[...list, mon]` tạo ra một mảng mới không ảnh hưởng đến mảng gốc.
3. `themB` là pure, `themA` là impure.
   - Hậu quả: giá trị trả về từ `themB` sẽ không còn đúng nữa vì đã bị `themA` thay đổi.

> **Chấm điểm: 8/10**
>
> - ✅ **Ý 1** — Đúng hoàn toàn: `gio` = `["Toan", "Ly"]`, `kqA === gio` là `true`. Lý do cũng chuẩn:
>   `themA` không tạo mảng mới, nó `push` vào chính mảng được truyền vào rồi `return` lại **đúng tham
>   chiếu đó** — nên `kqA` và `gio` là cùng một mảng trong bộ nhớ.
> - ✅ **Ý 2** — Đúng cả ba: `gio` vẫn `["Toan", "Ly"]`, `kqB` = `["Toan", "Ly", "Hoa"]`, và lý do
>   `[...list, mon]` tạo mảng mới là chính xác. (Bổ sung cho đủ: `kqB === gio` là `false`.)
> - ⚠️ **Ý 3** — Phân loại pure/impure **đúng**, nhưng phần "hậu quả thực tế" bị nói ngược.
>
> **Làm rõ ý 3:** Câu "giá trị trả về từ `themB` sẽ không còn đúng nữa vì đã bị `themA` thay đổi" là
> mô tả ngược chiều — `themB` không phải nạn nhân, mà **người gọi `themA`** mới là nạn nhân. Hậu quả
> thật sự của `themA`: nó **âm thầm sửa dữ liệu của người gọi** mà người gọi không hề ra lệnh. Ví dụ:
>
> ```javascript
> const gioGoc = ["Toan"];
> const gioMoi = themA(gioGoc, "Ly");
> // Lập trình viên tưởng gioGoc vẫn là ["Toan"] để so sánh "trước/sau",
> // nhưng thực tế cả hai biến đều là ["Toan", "Ly"] -> không còn gì để so sánh.
> console.log(gioGoc === gioMoi); // true - "bản gốc" đã biến mất
> ```
>
> Đây là kiểu bug khó truy nhất: lỗi không nổ ra ngay tại `themA`, mà nổ ra ở một chỗ hoàn toàn khác
> trong code — nơi ai đó tin rằng `gioGoc` chưa bị đụng tới. Trong React/Redux nó còn nguy hiểm hơn:
> vì tham chiếu không đổi (`===` vẫn `true`), UI sẽ **không re-render** dù dữ liệu đã khác.

------------------------------------------------------------------------

## Bài 2 - Spread chỉ copy nông

``` javascript
const state = { id: 1, user: { ten: "Son" }, tags: ["a"] };
const next = { ...state, id: 2 };

next.user.ten = "An";
next.tags.push("b");

console.log(state.id);
console.log(next.id);
console.log(state.user.ten);
console.log(state.tags);
console.log(state.user === next.user);
```

**Câu hỏi**
1. `state.id` và `next.id` in ra gì? Vì sao sửa `id` trên `next` lại không ảnh hưởng tới `state`?
2. `state.user.ten` và `state.tags` in ra gì? Vì sao lần này `state` LẠI bị ảnh hưởng, trái ngược với
   câu 1?
3. `state.user === next.user` là gì? Viết lại dòng tạo `next` sao cho sửa `next.user.ten` không còn
   đụng tới `state`.

**Trả lời của bạn:**

1. `state.id`: in ra `1`; `next.id`: in ra `2`.
   - Sửa `id` trên `next` không ảnh hưởng tới `state` vì `next` được shallow copy từ
     `{ ...state, id: 2 }`; shallow copy tạo object mới không ảnh hưởng đến object cũ.
2. 
   `state.user.ten`: in ra `An`; `state.tags`: in ra mảng gồm `a` và `b`.
   - Lần này `state` bị ảnh hưởng vì shallow copy là copy nông, chỉ copy được tầng đầu tiên, các tầng
     sau vẫn dùng chung.
3. `state.user === next.user` = `true`. Viết lại:
   ```javascript
   const next = structuredClone(state);
   next.id = 2;
   ```

> **Chấm điểm: 9/10**
>
> - ⚠️ **Ý 1** — Giá trị đúng (`1` và `2`), lý do đúng hướng nhưng **thiếu đúng cái mấu chốt** phân
>   biệt câu 1 với câu 2: xem giải thích ngay bên dưới.
> - ✅ **Ý 2** — Đúng hoàn toàn: `"An"` và `["a", "b"]`, và lý do "copy nông chỉ copy tầng đầu tiên,
>   các tầng sau vẫn dùng chung" là chính xác.
> - ✅ **Ý 3** — Đúng: `true`. Và cách viết lại bằng `structuredClone(state)` **hoạt động đúng** —
>   nó clone sâu nên `next.user` là object mới hoàn toàn.
>
> **Bổ sung ý 1 — vì sao `id` an toàn mà `user` thì không, dù cùng một dòng spread?** Khác biệt nằm
> ở **kiểu dữ liệu của từng field**, không phải ở bản thân phép spread:
> - `id: 1` là **primitive** (number). Spread copy **giá trị** của nó sang object mới. Từ đó `state.id`
>   và `next.id` là hai ô nhớ riêng biệt → sửa cái này không đụng cái kia.
> - `user: { ten: "Son" }` và `tags: ["a"]` là **reference type**. Spread copy **địa chỉ tham chiếu**,
>   không copy nội dung. `state.user` và `next.user` cùng trỏ tới **một object duy nhất** → sửa qua
>   đường nào cũng thấy.
>
> Nói gọn: `{ ...state }` copy đúng **một tầng giá trị**. Với primitive, một tầng là đã đủ toàn bộ.
> Với object/array, một tầng chỉ mới là cái "mũi tên", còn thứ mũi tên trỏ tới thì vẫn dùng chung.
>
> **Về ý 3 — hai cách viết lại, nên biết cả hai:**
> ```javascript
> // Cách A (của bạn): deep clone toàn bộ - gọn, an toàn tuyệt đối
> const next = structuredClone(state);
> next.id = 2;
>
> // Cách B (idiom của FP/React): chỉ clone đúng nhánh mình cần sửa
> const next = { ...state, id: 2, user: { ...state.user } };
> ```
> Cách A đơn giản hơn nhưng clone lại **mọi thứ** kể cả nhánh không đổi (tốn hơn với object lớn) và
> không dùng được nếu object chứa function. Cách B tốn công viết hơn nhưng giữ nguyên tham chiếu cho
> các nhánh không đổi — đây chính là lý do React so sánh `===` để biết nhánh nào cần re-render.

------------------------------------------------------------------------

## Bài 3 - structuredClone và giới hạn của nó

``` javascript
const goc = { n: 1, sub: { x: 10 }, fn: () => 1 };

const c1 = { ...goc };
c1.sub.x = 99;
console.log(goc.sub.x);

try {
    const c2 = structuredClone(goc);
    console.log(c2.sub.x);
} catch (e) {
    console.log("Loi:", e.name);
}

const goc2 = { n: 1, sub: { x: 10 } };
const c3 = structuredClone(goc2);
c3.sub.x = 77;
console.log(goc2.sub.x);
```

**Câu hỏi**
1. `goc.sub.x` ở dòng log đầu tiên in ra gì? Vì sao?
2. Khối `try/catch` in ra gì — giá trị `c2.sub.x` hay một lỗi? Nếu là lỗi thì tên lỗi là gì và
   nguyên nhân nằm ở property nào của `goc`?
3. `goc2.sub.x` ở dòng cuối in ra gì? Điều này chứng minh gì về khác biệt giữa `{ ...obj }` và
   `structuredClone(obj)`?

**Trả lời của bạn:**

1. In ra `99` vì `{ ...goc }` là shallow copy, chỉ copy được tầng đầu tiên, các tầng sau vẫn bị phụ
   thuộc.
2. `try/catch` ra lỗi vì `structuredClone` không clone được function `fn`.
3. In ra `10`.
   - Chứng minh `{ ...obj }` chỉ copy được tầng đầu tiên, các tầng sau nếu bị thay đổi sẽ luôn thay
     đổi cả mảng gốc.
   - `structuredClone(obj)` là deep copy, khi thay đổi object clone sẽ không ảnh hưởng đến object gốc.

> **Chấm điểm: 8/10**
>
> - ✅ **Ý 1** — Đúng: `99`, đúng lý do shallow copy.
> - ⚠️ **Ý 2** — Xác định **đúng nguyên nhân** (function `fn` là thủ phạm) nhưng **thiếu tên lỗi** mà
>   câu hỏi hỏi thẳng: `e.name` in ra **`DataCloneError`**, nên dòng log là `Loi: DataCloneError`.
>   Cũng cần nói rõ: `c2.sub.x` **không bao giờ được in ra**, vì `structuredClone` ném lỗi ngay ở dòng
>   trên, nhảy thẳng sang `catch`.
> - ✅ **Ý 3** — Đúng: `10`, và kết luận về khác biệt shallow/deep là chính xác.
>
> **Bổ sung ý 2 — vì sao `structuredClone` lại không nuốt được function:** thuật toán đằng sau nó là
> **structured clone algorithm**, vốn sinh ra để **serialize** dữ liệu đem truyền qua ranh giới bộ nhớ
> (gửi sang Web Worker, lưu vào IndexedDB, `postMessage` giữa các tab). Function thì **không
> serialize được** — thân hàm gắn liền với closure và scope của nơi nó được tạo ra, mang sang môi
> trường khác thì mất hết ngữ cảnh, vô nghĩa. Vì vậy chuẩn quyết định ném lỗi thay vì lặng lẽ bỏ qua.
>
> Danh sách những thứ khác cũng làm `structuredClone` ném `DataCloneError`, nên nhớ luôn:
> ```javascript
> structuredClone({ fn: () => 1 });        // DataCloneError - function
> structuredClone({ sym: Symbol("a") });   // DataCloneError - Symbol
> structuredClone(document.body);          // DataCloneError - DOM node
> // Ngược lại, những thứ này thì clone tốt (mà JSON.parse(JSON.stringify()) làm hỏng):
> structuredClone({ d: new Date(), m: new Map(), s: new Set(), u: undefined }); // OK
> ```
> Đó cũng là lý do `structuredClone` được ưa hơn mẹo cũ `JSON.parse(JSON.stringify(obj))`: mẹo JSON
> **im lặng** nuốt mất `undefined`, biến `Date` thành string, làm rỗng `Map`/`Set` — sai mà không báo.

------------------------------------------------------------------------

## Bài 4 - Hàm bậc cao trả về hàm

``` javascript
function taoBoDem() {
    let count = 0;
    return function () {
        count++;
        return count;
    };
}

const d1 = taoBoDem();
const d2 = taoBoDem();

console.log(d1());
console.log(d1());
console.log(d2());
console.log(d1 === d2);
```

**Câu hỏi**
1. Bốn dòng log in ra gì?
2. Vì sao `d2()` không tiếp tục đếm từ giá trị của `d1`? Giải thích bằng khái niệm closure đã học ở
   ngày 1.
3. Hàm trả về từ `taoBoDem` có phải pure function không? Vì sao?

**Trả lời của bạn:**

1. Bốn dòng log:
   - `console.log(d1());` → in ra `1`
   - `console.log(d1());` → in ra `2`
   - `console.log(d2());` → in ra `1`
   - `console.log(d1 === d2);` → in ra `true`
2. Vì `d2` được hoisting lại.
3. *(chưa trả lời)*

> **Chấm điểm: 3/10**
>
> - ⚠️ **Ý 1** — Ba giá trị đầu **đúng** (`1`, `2`, `1`), nhưng giá trị thứ tư **sai**:
>   `d1 === d2` là **`false`**, không phải `true`.
> - ❌ **Ý 2** — Sai hoàn toàn. Chuyện này **không liên quan gì tới hoisting**. Hoisting là việc khai
>   báo được "kéo lên đầu scope" lúc biên dịch — nó không hề tạo ra hay reset biến `count` nào cả.
> - ⬜ **Ý 3** — Chưa trả lời.
>
> **Giải thích đúng ý 1 + ý 2 (cùng một gốc rễ):** Mỗi lần **gọi** `taoBoDem()`, JS tạo ra một
> **execution context hoàn toàn mới**, và dòng `let count = 0` bên trong chạy lại từ đầu → sinh ra một
> **biến `count` mới, độc lập**. Hàm được `return` ra sẽ "khóa" (closure) đúng biến `count` của lần gọi
> đó, không phải của lần gọi khác.
>
> ```javascript
> const d1 = taoBoDem(); // lần gọi 1 -> tạo count#1 = 0, d1 nhớ count#1
> const d2 = taoBoDem(); // lần gọi 2 -> tạo count#2 = 0, d2 nhớ count#2
> ```
>
> Vì vậy `d1()` đếm trên `count#1` (1, rồi 2), còn `d2()` đếm trên `count#2` (bắt đầu lại từ 1) —
> hai bộ đếm hoàn toàn tách biệt. Đây chính xác là cơ chế closure đã học ở **ngày 1**: closure không
> nhớ *giá trị* tại thời điểm tạo, mà nhớ **cái biến** (ô nhớ) của scope cha.
>
> **Vì sao `d1 === d2` là `false`:** `taoBoDem` chứa một **function expression** (`return function
> () {...}`). Giống hệt bài học `XeA` ở **ngày 3**: mỗi lần thân hàm được thực thi, biểu thức hàm đó
> tạo ra một **function object hoàn toàn mới trong bộ nhớ**. `d1` và `d2` trông giống nhau về code
> nhưng là hai object khác nhau — mà `===` với object là so sánh **cùng một ô nhớ hay không**, chứ
> không so sánh nội dung. Muốn `true` thì phải là `const d2 = d1;` (cùng một hàm), khi đó `d2()` sẽ
> in ra `3` chứ không phải `1`.
>
> **Đáp án ý 3 — hàm trả về từ `taoBoDem` có pure không?** **KHÔNG**, vì hai lý do (mỗi lý do một mình
> đã đủ để kết luận impure):
> - **Cùng input cho khác output:** gọi `d1()` không truyền tham số gì, mà lần 1 trả `1`, lần 2 trả
>   `2` — vi phạm điều kiện cốt lõi của pure function.
> - **Có side effect:** dòng `count++` sửa một biến nằm **ngoài** hàm (thuộc scope cha), đúng định
>   nghĩa side effect.
>
> Điểm cần nhớ: `taoBoDem` là **hàm bậc cao** (trả về hàm) nhưng hàm nó sinh ra lại **impure**. "Hàm
> bậc cao" và "pure function" là hai khái niệm độc lập, một hàm có thể là cái này mà không là cái kia.
> Chính vì impure nên bộ đếm này **không thả vào `pipe`/`compose` được** — kết quả sẽ phụ thuộc vào số
> lần pipeline đã chạy trước đó.

------------------------------------------------------------------------

## Bài 5 - compose và pipe: thứ tự chạy

``` javascript
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);

const f = x => x + 1;
const g = x => x * 3;

console.log(compose(f, g)(2));
console.log(pipe(f, g)(2));
console.log(compose(f, g)(2) === pipe(g, f)(2));

const toUpper = s => s.toUpperCase();
const themCham = s => s + "!";

console.log(pipe(toUpper, themCham)("hi"));
console.log(compose(toUpper, themCham)("hi"));
```

**Câu hỏi**
1. `compose(f, g)(2)` và `pipe(f, g)(2)` in ra gì? Vì sao cùng hai hàm, cùng đầu vào `2` mà ra hai
   kết quả khác nhau?
2. `compose(f, g)(2) === pipe(g, f)(2)` là `true` hay `false`? Phát biểu thành quy tắc chung.
3. Hai dòng cuối in ra gì? Vì sao ở cặp `toUpper`/`themCham` này đổi thứ tự lại KHÔNG làm đổi kết
   quả, trong khi ở cặp `f`/`g` thì có?

**Trả lời của bạn:**

1. `compose(f, g)(2)`: in ra `7`; `pipe(f, g)(2)`: in ra `9`.
   - Vì thứ tự gọi khác nhau: `compose(f, g)(2)` là `2 * 3 + 1`, còn `pipe(f, g)(2)` là `2 + 1 * 3`.
2. Bằng `true`.
3. Đều in ra `HI!`.
   - Không thay đổi kết quả vì `toUpperCase` là chuyển chữ thường thành chữ hoa, nên gọi trước hay sau
     thì `toUpperCase` vẫn luôn trả về là chữ hoa.

> **Chấm điểm: 7/10**
>
> - ✅ **Ý 1** — Đúng cả hai giá trị (`7` và `9`) và đúng luôn thứ tự thực thi. `compose(f, g)` chạy
>   phải→trái: `g(2) = 6` rồi `f(6) = 7`. `pipe(f, g)` chạy trái→phải: `f(2) = 3` rồi `g(3) = 9`.
> - ⚠️ **Ý 2** — Đúng giá trị `true`, nhưng câu hỏi còn yêu cầu **"phát biểu thành quy tắc chung"** —
>   phần này chưa trả lời (xem bên dưới).
> - ⚠️ **Ý 3** — Đúng kết quả (`HI!` cả hai), nhưng lý do **chưa chạm tới mấu chốt**.
>
> **Đáp án ý 2 — quy tắc chung:** `compose` và `pipe` là **cùng một phép ghép hàm, chỉ khác chiều đọc
> danh sách**. Quy tắc phát biểu gọn:
> ```
> compose(f1, f2, ..., fn) === pipe(fn, ..., f2, f1)
> ```
> Nói cách khác: **đảo ngược danh sách hàm thì đổi được `compose` thành `pipe` và ngược lại**. Nhìn
> vào code cũng thấy ngay lý do: `compose` dùng `reduceRight` (duyệt mảng từ cuối về đầu), `pipe` dùng
> `reduce` (duyệt từ đầu về cuối) — hai cách duyệt của **cùng một logic** `(acc, fn) => fn(acc)`.
>
> **Làm rõ ý 3 — vì sao cặp này giao hoán được mà cặp `f`/`g` thì không:** Lý do bạn nêu ("`toUpperCase`
> luôn trả về chữ hoa") chưa giải thích được nửa còn lại của vấn đề: nếu `themCham` chạy **sau**, nó
> nối `"!"` vào **sau khi** đã viết hoa — vậy tại sao `"!"` không bị "sót lại" ở dạng thường?
>
> Mấu chốt thật sự: **hai phép biến đổi này tác động lên hai phần TÁCH RỜI của chuỗi, không đụng nhau.**
> - `toUpperCase` chỉ biến đổi **chữ cái**; ký tự `!` không phải chữ cái nên nó **hoàn toàn miễn nhiễm**
>   — `"hi!".toUpperCase()` vẫn ra `"HI!"`, dấu `!` không hề bị ảnh hưởng.
> - `themCham` chỉ **nối thêm vào cuối**, không đụng gì tới các ký tự đã có.
>
> Vì "vùng làm việc" của hai hàm không giao nhau, làm cái nào trước cũng ra như nhau — đây gọi là hai
> phép toán **giao hoán** (commutative). Còn `f = x => x + 1` và `g = x => x * 3` thì **cùng tác động
> lên đúng một con số**, nên thứ tự quyết định kết quả (`(2+1)*3 = 9` ≠ `2*3+1 = 7`).
>
> **Thử ngay để thấy sự giao hoán này mong manh thế nào** — chỉ cần đổi `"!"` thành một chữ cái là hỏng:
> ```javascript
> const themDuoi = s => s + "abc";
> console.log(pipe(toUpper, themDuoi)("hi"));    // "HIabc" - viết hoa TRƯỚC, "abc" thêm sau nên còn thường
> console.log(compose(toUpper, themDuoi)("hi")); // "HIABC" - thêm "abc" TRƯỚC rồi mới viết hoa tất
> ```
> Bài học rút ra: **đừng bao giờ dựa vào việc "thứ tự chắc không quan trọng đâu"** khi ghép hàm. Ở đây
> nó tình cờ đúng, nhưng chỉ cần dữ liệu hoặc hàm đổi một chút là sai ngay — và loại bug này rất khó
> thấy vì code vẫn chạy, chỉ ra kết quả sai.

------------------------------------------------------------------------

## Bài 6 - curry và `fn.length`

``` javascript
function curry(fn) {
    return function curried(...args) {
        if (args.length >= fn.length) return fn.apply(this, args);
        return (...next) => curried.apply(this, [...args, ...next]);
    };
}

const nhan3 = (a, b, c) => a * b * c;
const nhan3C = curry(nhan3);

console.log(nhan3C(2)(3)(4));
console.log(nhan3C(2, 3)(4));

const congMacDinh = (a, b = 10) => a + b;
console.log(congMacDinh.length);
console.log(curry(congMacDinh)(5));

const congRest = (...nums) => nums.reduce((s, x) => s + x, 0);
console.log(congRest.length);
console.log(curry(congRest)(1, 2, 3));
```

**Câu hỏi**
1. Hai dòng `nhan3C(...)` in ra gì? Vì sao chia tham số theo hai kiểu khác nhau vẫn cho cùng kết quả?
2. `congMacDinh.length` in ra gì? Dựa vào đó, `curry(congMacDinh)(5)` in ra gì — một con số hay một
   hàm? Vì sao?
3. `congRest.length` in ra gì? `curry(congRest)(1, 2, 3)` in ra gì? Nêu kết luận về việc `curry`
   dựa trên `fn.length` sẽ hỏng với những kiểu khai báo tham số nào.

**Trả lời của bạn:**

1. *(không biết, nhờ giải thích)*
2. *(không biết, nhờ giải thích)*
3. *(không biết, nhờ giải thích)*

> **Chấm điểm: 0/10** (chưa trả lời)
>
> Trước hết phải nắm **`fn.length` là gì**, vì cả bài xoay quanh đúng con số này: `fn.length` là
> **số tham số đã KHAI BÁO** của hàm (gọi là *arity*) — JS đếm nó **lúc định nghĩa hàm**, hoàn toàn
> không liên quan tới việc lúc gọi bạn truyền vào bao nhiêu đối số. Và nó có **hai quy tắc đếm rất dễ
> quên**:
> - **Dừng đếm ngay tại tham số đầu tiên có giá trị mặc định** (và không đếm cả tham số đó).
> - **Không bao giờ đếm rest parameter** (`...args`).
>
> ```javascript
> ((a, b, c) => 0).length;        // 3
> ((a, b = 1) => 0).length;       // 1  - dừng ở b, không đếm b
> ((a = 1, b, c) => 0).length;    // 0  - dừng ngay ở a!
> ((...args) => 0).length;        // 0  - rest không bao giờ được đếm
> ((a, ...rest) => 0).length;     // 1
> ```
>
> **Đáp án ý 1:** Cả hai dòng đều in ra **`24`** (`2 * 3 * 4`).
>
> Vì sao chia tham số kiểu nào cũng ra `24`: `curry` **không quan tâm bạn chia thành mấy lần gọi**, nó
> chỉ gom dần các đối số vào mảng `args` và kiểm tra đúng một điều kiện — `args.length >= fn.length`
> (tức là "đã đủ 3 chưa?"). Chưa đủ thì trả về hàm mới, **nhớ sẵn phần đã gom nhờ closure**, chờ nhận
> tiếp. Đủ rồi thì gọi `fn` một phát với toàn bộ đối số. Lần theo `nhan3C(2)(3)(4)`:
>
> | Lần gọi | `args` gom được | `args.length` | So với `fn.length = 3` | Hành động |
> |---|---|---|---|---|
> | `nhan3C(2)` | `[2]` | 1 | 1 < 3 → chưa đủ | trả về hàm chờ |
> | `(3)` | `[2, 3]` | 2 | 2 < 3 → chưa đủ | trả về hàm chờ |
> | `(4)` | `[2, 3, 4]` | 3 | 3 >= 3 → **đủ** | gọi `nhan3(2, 3, 4)` = `24` |
>
> Còn `nhan3C(2, 3)(4)`: lần đầu gom được `[2, 3]` (2 < 3, chưa đủ), lần sau thành `[2, 3, 4]` (đủ) →
> cũng gọi `nhan3(2, 3, 4)` = `24`. **Cùng một danh sách đối số cuối cùng thì cùng một kết quả** —
> cách bạn "cắt" nó thành mấy lần gọi hoàn toàn không ảnh hưởng.
>
> **Đáp án ý 2:** `congMacDinh.length` in ra **`1`**, và `curry(congMacDinh)(5)` in ra **`15`** —
> một **con số**, không phải một hàm.
>
> Đây chính là cái bẫy của bài. `congMacDinh = (a, b = 10) => a + b` **trông như** hàm 2 tham số, nhưng
> vì `b` có giá trị mặc định nên `fn.length` chỉ là **`1`**. Khi gọi `curry(congMacDinh)(5)`:
> `args = [5]`, `args.length = 1`, so với `fn.length = 1` → `1 >= 1` là **`true`** → `curry` tưởng đã
> đủ tham số và **gọi luôn** `congMacDinh(5)`, tức `b` rơi về mặc định `10` → `5 + 10 = 15`.
>
> Hậu quả thực tế: bạn **không thể** truyền `b` theo kiểu curry được nữa. `curry(congMacDinh)(5)(3)`
> sẽ **ném lỗi** `TypeError: ... is not a function`, vì `(5)` đã trả về số `15` rồi, mà `15(3)` thì
> không gọi được. Muốn truyền cả hai phải gọi một lần: `curry(congMacDinh)(5, 3)` → `8`.
>
> **Đáp án ý 3:** `congRest.length` in ra **`0`**, và `curry(congRest)(1, 2, 3)` in ra **`6`**.
>
> Với `(...nums) => ...`, rest parameter không được đếm nên `fn.length = 0`. Điều đó khiến `curry` trở
> nên **vô dụng hoàn toàn**: ngay lần gọi đầu tiên, `args.length >= 0` **luôn luôn đúng** (kể cả khi
> `args` rỗng!) → nó gọi thẳng `fn` ngay lập tức, không bao giờ trả về hàm chờ. Tức `curry(congRest)`
> chỉ là một bản sao của `congRest`. Tệ hơn nữa:
> ```javascript
> curry(congRest)();  // 0 - gọi không đối số vẫn chạy luôn, không hề "chờ" gì cả
> ```
>
> **Kết luận — `curry` dựa trên `fn.length` sẽ hỏng với 3 kiểu khai báo tham số:**
> 1. **Tham số có giá trị mặc định** (`(a, b = 10)`) → đếm thiếu, curry gọi hàm quá sớm.
> 2. **Rest parameter** (`(...args)`) → `length = 0`, curry mất tác dụng hoàn toàn.
> 3. **Hàm có số tham số thay đổi** (variadic) → về bản chất không có "đủ tham số" để mà chờ.
>
> **Cách né:** hoặc viết hàm với tham số cố định, không mặc định, khi muốn curry; hoặc dùng bản `curry`
> cho phép **chỉ định arity thủ công** thay vì đoán từ `fn.length`:
> ```javascript
> const curryN = (n, fn) => {
>     const curried = (...args) =>
>         args.length >= n ? fn(...args) : (...next) => curried(...args, ...next);
>     return curried;
> };
> const congC2 = curryN(2, congMacDinh); // tự khai báo "hàm này cần 2 tham số"
> console.log(congC2(5)(3)); // 8 - giờ curry đúng như mong đợi
> ```

------------------------------------------------------------------------

## Bài 7 - map / filter / reduce và các bẫy kinh điển

``` javascript
console.log(["1", "2", "3"].map(Number));
console.log(["1", "2", "3"].map(parseInt));

const arr = [1, 2, 3, 4];
console.log(arr.reduce((s, x) => s + x));
console.log(arr.filter(x => x > 10).reduce((s, x) => s + x, 0));

try {
    console.log(arr.filter(x => x > 10).reduce((s, x) => s + x));
} catch (e) {
    console.log("Loi:", e.message);
}

console.log(arr);
```

**Câu hỏi**
1. `["1","2","3"].map(Number)` và `["1","2","3"].map(parseInt)` in ra gì? Vì sao hai cái khác nhau —
   `map` truyền bao nhiêu tham số vào callback?
2. `arr.reduce((s, x) => s + x)` (không có giá trị ban đầu) in ra gì? Phần tử nào đóng vai trò
   accumulator ở lần chạy đầu tiên?
3. Hai dòng `filter(x => x > 10).reduce(...)` — dòng có `0` và dòng không có `0` — cho ra kết quả gì
   khác nhau? Vì sao? Và `arr` ở dòng cuối in ra gì?

**Trả lời của bạn:**

1. *(không biết, nhờ giải thích)*
2. In ra `10`, phần tử đầu tiên đóng vai trò accumulator.
3. *(không biết, nhờ giải thích)*

> **Chấm điểm: 3/10**
>
> - ⬜ **Ý 1** — Chưa trả lời.
> - ✅ **Ý 2** — Đúng cả hai vế: `10`, và phần tử đầu tiên (`1`) đóng vai trò accumulator ban đầu.
> - ⬜ **Ý 3** — Chưa trả lời.
>
> **Đáp án ý 1 — đây là bẫy kinh điển nhất của `map`:**
> ```javascript
> ["1", "2", "3"].map(Number);    // [1, 2, 3]
> ["1", "2", "3"].map(parseInt);  // [1, NaN, NaN]   <-- !!
> ```
> Nguyên nhân: **`map` truyền vào callback KHÔNG PHẢI 1 mà là 3 tham số** —
> `callback(phanTu, chiSo, mangGoc)`. Bình thường ta chỉ viết `x => ...` nên hai tham số sau bị bỏ
> qua, không ai để ý. Nhưng khi truyền thẳng tên hàm có sẵn vào, hàm đó **nhận đủ cả 3**:
> - `Number` chỉ nhận **1 tham số**, tham số thứ 2 và 3 bị nó lờ đi → `Number("1")`, `Number("2")`,
>   `Number("3")` → `[1, 2, 3]`. An toàn.
> - `parseInt` nhận **2 tham số**: `parseInt(chuoi, radix)` — trong đó `radix` là **hệ cơ số**. Nó vô
>   tình nhận luôn **chỉ số của mảng** làm `radix`:
>
> | Lần lặp | Thực tế gọi | Ý nghĩa | Kết quả |
> |---|---|---|---|
> | 0 | `parseInt("1", 0)` | `radix = 0` được coi như "tự đoán" → hệ 10 | `1` |
> | 1 | `parseInt("2", 1)` | hệ cơ số 1 **không tồn tại** (chỉ hợp lệ 2–36) | `NaN` |
> | 2 | `parseInt("3", 2)` | hệ nhị phân chỉ có chữ số `0` và `1`, không có `3` | `NaN` |
>
> **Bài học phòng tránh:** đừng truyền thẳng tên hàm vào `map` nếu hàm đó nhận nhiều hơn 1 tham số.
> Bọc lại bằng arrow function để **khóa cứng số tham số**:
> ```javascript
> ["1", "2", "3"].map(x => parseInt(x, 10)); // [1, 2, 3] - đúng
> ```
>
> **Đáp án ý 3 — hai dòng `filter(...).reduce(...)` cho kết quả khác hẳn nhau:**
>
> Điều kiện `x > 10` không có phần tử nào của `[1, 2, 3, 4]` thỏa mãn, nên `filter` trả về **mảng
> rỗng `[]`** trong cả hai dòng. Từ đó:
> - Dòng **có** giá trị ban đầu: `[].reduce((s, x) => s + x, 0)` → in ra **`0`**. Callback **không
>   chạy lần nào cả**, `reduce` trả thẳng về giá trị khởi tạo `0`.
> - Dòng **không** có giá trị ban đầu: `[].reduce((s, x) => s + x)` → **ném lỗi**
>   `TypeError: Reduce of empty array with no initial value`, nên dòng in ra là
>   `Loi: Reduce of empty array with no initial value`.
>
> Lý do sâu hơn, nối thẳng với ý 2 bạn đã trả lời đúng: khi **không** có giá trị ban đầu, `reduce`
> phải **mượn phần tử đầu tiên** làm accumulator (đó chính là điều xảy ra ở ý 2: `1` làm accumulator,
> callback bắt đầu chạy từ phần tử thứ **hai**, nên `1+2+3+4 = 10`). Nhưng với mảng rỗng thì **không
> có phần tử nào để mượn**, và `reduce` cũng không được phép tự bịa ra `0` (vì nó đâu biết bạn đang
> cộng số hay nối chuỗi hay gộp mảng) → chỉ còn cách ném lỗi.
>
> **Quy tắc thực chiến:** **luôn truyền giá trị ban đầu cho `reduce`.** Nó vừa chống crash khi mảng
> rỗng, vừa nói rõ kiểu dữ liệu của kết quả cho người đọc — và mảng rỗng là chuyện xảy ra thường xuyên
> sau một bước `filter`, đúng như bài này minh họa.
>
> **Còn `arr` ở dòng cuối:** in ra **`[1, 2, 3, 4]`** — **nguyên vẹn**. Cả `map`, `filter` lẫn `reduce`
> đều là các method **không mutate**: chúng chỉ đọc mảng gốc và tạo ra giá trị mới. Đây chính là lý do
> chúng ghép được thành chuỗi mà không sợ bước sau phá hỏng dữ liệu của bước trước.

------------------------------------------------------------------------

## Bài 8 - `map` có thật sự "không mutate" không?

``` javascript
const users = [
    { ten: "Son", tuoi: 20 },
    { ten: "An", tuoi: 30 }
];

const kq1 = users.forEach(u => u.tuoi + 1);
const kq2 = users.map(u => u.tuoi + 1);
const kq3 = users.map(u => {
    u.tuoi = u.tuoi + 1;
    return u;
});

console.log(kq1);
console.log(kq2);
console.log(users[0].tuoi);
console.log(kq3[0] === users[0]);
```

**Câu hỏi**
1. `kq1` in ra gì? Vì sao? Khi nào nên dùng `forEach` thay vì `map`?
2. `kq2` in ra gì? Chú ý `kq2` được tính TRƯỚC `kq3` — điều đó ảnh hưởng thế nào tới giá trị của nó?
3. `users[0].tuoi` và `kq3[0] === users[0]` in ra gì? `map` tạo ra mảng mới, vậy vì sao object bên
   trong vẫn bị sửa? Sửa `kq3` thế nào để thật sự immutable?

**Trả lời của bạn:**

1. In ra mảng object user với tuổi tương ứng là `21` và `31`, vì `forEach` đã thay đổi object gốc.
   - Dùng `forEach` nếu muốn thay đổi cả object gốc.
   - Dùng `map` nếu không muốn thay đổi object gốc.
2. In ra mảng object user với tuổi tương ứng là `21` và `31`.
3. *(không biết, nhờ giải thích)*

> **Chấm điểm: 2/10**
>
> - ❌ **Ý 1** — Sai cả giá trị lẫn lý do lẫn kết luận. `kq1` in ra **`undefined`**, không phải mảng
>   gì cả. Và `forEach` ở đây **không hề thay đổi object nào**.
> - ⚠️ **Ý 2** — Hai con số `21` và `31` **đúng**, nhưng mô tả sai kiểu dữ liệu: `kq2` là
>   **`[21, 31]`** — một mảng **số**, không phải mảng object.
> - ⬜ **Ý 3** — Chưa trả lời.
>
> **Giải thích đúng ý 1 — `forEach` LUÔN trả về `undefined`:**
> ```javascript
> const kq1 = users.forEach(u => u.tuoi + 1); // kq1 = undefined
> ```
> Đây là quy định cứng của `forEach`, **không phụ thuộc callback làm gì**. `forEach` sinh ra để *chạy
> một việc gì đó cho mỗi phần tử*, chứ **không** để thu thập kết quả — nó ném đi mọi giá trị mà
> callback trả về. Ở đây callback tính `u.tuoi + 1` rồi... vứt. Nó **không gán ngược vào đâu cả**, nên
> `users` hoàn toàn không bị đụng tới ở dòng này.
>
> Chỗ hiểu nhầm quan trọng cần sửa: **`forEach` không phải là "phiên bản có mutate" của `map`.** Hai
> method này khác nhau ở chỗ **có trả về mảng mới hay không**, chứ không phải ở chỗ có mutate hay
> không. Cả hai đều **không tự mutate** gì cả — mutate hay không là **do bạn viết gì trong callback**:
> ```javascript
> users.forEach(u => u.tuoi + 1);      // KHÔNG mutate - chỉ tính rồi vứt đi
> users.forEach(u => u.tuoi = u.tuoi + 1); // CÓ mutate - vì có phép gán
> users.map(u => u.tuoi + 1);          // KHÔNG mutate, trả về [21, 31]
> users.map(u => { u.tuoi++; return u; }); // CÓ mutate - dù đang dùng map! (chính là kq3)
> ```
> **Khi nào dùng `forEach` thay vì `map`:** khi bạn **không cần mảng kết quả** — ví dụ `console.log`
> từng phần tử, gửi từng request, gắn event listener. Nếu bạn cần một mảng mới thì dùng `map`; dùng
> `forEach` rồi tự `push` vào mảng ngoài là viết dài dòng hơn mà không được lợi gì.
>
> **Giải thích thêm ý 2 — vì sao `kq2` là `[21, 31]` chứ không phải mảng object:** callback là
> `u => u.tuoi + 1`. Nó nhận vào object `u` nhưng **trả về một con số** (`u.tuoi + 1`). `map` gom đúng
> những giá trị được `return` lại thành mảng mới → `[21, 31]`, các object `{ten, tuoi}` không hề có mặt
> trong `kq2`.
>
> Và đây là điều câu hỏi muốn bạn để ý: `kq2` được tính **trước** `kq3`, lúc đó `tuoi` vẫn là `20` và
> `30` → `[21, 31]`. Nếu đảo hai dòng lại, cho `kq3` chạy trước (nó `+1` vào chính object gốc), thì
> `kq2` sẽ thành **`[22, 32]`**. Cùng một dòng code, kết quả phụ thuộc vào **thứ tự chạy** — đó chính
> là cái giá phải trả khi có mutate xen vào, đúng như phần ôn tập buổi tối đã nói.
>
> **Đáp án ý 3:**
> ```javascript
> console.log(users[0].tuoi);        // 21
> console.log(kq3[0] === users[0]);  // true
> ```
> **Vì sao `map` tạo mảng mới mà object bên trong vẫn bị sửa?** Vì `map` chỉ tạo **một cái vỏ mảng
> mới**, còn thứ nằm trong vỏ đó vẫn là **đúng những object cũ** (callback `return u` trả về chính
> object nhận vào, không phải bản sao). Đây lại đúng câu chuyện **shallow** của Bài 2 và Bài 3, chỉ
> đổi bối cảnh từ object sang mảng:
> ```
> users  →  [ ref#1 , ref#2 ]
>              ↓        ↓
>           {ten,tuoi} {ten,tuoi}   <-- CÙNG hai object này
>              ↑        ↑
> kq3    →  [ ref#1 , ref#2 ]
> ```
> Hai mảng khác nhau (`kq3 !== users`), nhưng **cùng trỏ tới đúng hai object**. Dòng
> `u.tuoi = u.tuoi + 1` sửa thẳng vào object dùng chung → nhìn từ `users` hay từ `kq3` đều thấy `21`.
> Nói ngắn: **`map` bảo vệ mảng, không bảo vệ nội dung bên trong mảng.**
>
> **Sửa `kq3` để thật sự immutable** — đừng sửa `u`, hãy trả về một object **mới**:
> ```javascript
> const kq3 = users.map(u => ({ ...u, tuoi: u.tuoi + 1 }));
>
> console.log(users[0].tuoi);       // 20 - GỐC NGUYÊN VẸN
> console.log(kq3[0].tuoi);         // 21
> console.log(kq3[0] === users[0]); // false - đã là hai object khác nhau
> ```
> Lưu ý cú pháp: phải bọc `({ ... })` trong ngoặc tròn, nếu viết `u => { ...u }` thì JS hiểu `{}` là
> **thân hàm** chứ không phải object literal, và hàm sẽ trả về `undefined`.

------------------------------------------------------------------------

## Bài 9 - Promise chain: giá trị chảy qua `.then` và `.catch`

``` javascript
const p = Promise.resolve(1);

p.then(v => {
    console.log("A:", v);
    return v + 1;
})
.then(v => {
    console.log("B:", v);
    throw new Error("hong");
})
.then(v => {
    console.log("C:", v);
})
.catch(e => {
    console.log("D:", e.message);
    return "cuu duoc";
})
.then(v => {
    console.log("E:", v);
});
```

**Câu hỏi**
1. Liệt kê đúng thứ tự các dòng được in ra, kèm giá trị.
2. Dòng `C:` có được in không? Vì sao?
3. `E:` in ra giá trị gì? Điều đó cho thấy gì về trạng thái của Promise sau khi `.catch` đã xử lý
   xong lỗi (chain "chết hẳn" hay "sống lại")?

**Trả lời của bạn:**

1. `A: 1`, `B: 2`, `D: hong`
2. Dòng `C` không được in ra, vì dòng `B` đã throw ra lỗi, nên luồng xử lý tiếp sẽ chuyển luôn vào
   `catch`.
3. `E:` không in ra gì cả. Promise sau khi `.catch` đã xử lý xong thì chain chết hẳn.

> **Chấm điểm: 5/10**
>
> - ⚠️ **Ý 1** — Ba dòng đầu **đúng hoàn toàn** (`A: 1`, `B: 2`, `D: hong`), nhưng **thiếu dòng thứ
>   tư**: chain còn in ra **`E: cuu duoc`**.
> - ✅ **Ý 2** — Đúng hoàn toàn, cả kết quả lẫn lý do.
> - ❌ **Ý 3** — Sai: `E:` **CÓ** được in ra, với giá trị **`"cuu duoc"`**. Và kết luận "chain chết
>   hẳn" là ngược lại với thực tế — chain **sống lại bình thường**.
>
> **Giải thích đúng ý 3 — điểm cốt lõi của cả bài:**
>
> Mấu chốt cần nhớ: **`.catch()` cũng chỉ là một mắt xích trong chain, và nó cũng trả về một Promise
> mới** — y hệt `.then()`. Nó không phải "điểm kết thúc". Cụ thể:
> - Nếu callback trong `.catch` **chạy xong mà không ném lỗi tiếp**, thì Promise nó trả về ở trạng
>   thái **fulfilled** (thành công), mang theo giá trị được `return`.
> - Ở đây `.catch` `return "cuu duoc"` → Promise tiếp theo là **fulfilled với giá trị `"cuu duoc"`**
>   → `.then` cuối cùng chạy bình thường và in ra `E: cuu duoc`.
>
> Hình dung cả chain như một dòng chảy có **hai làn**: làn "thành công" (`.then`) và làn "lỗi"
> (`.catch`). `throw` ở `B` đẩy dòng chảy **sang làn lỗi**, nên nó phóng qua `C` (một mắt `.then`,
> nằm ở làn thành công) mà không dừng. Nhưng khi `.catch` xử lý xong, dòng chảy **quay lại làn thành
> công** — và `E` ở làn đó nên vẫn chạy.
>
> ```
> then(A) ──> then(B) ──✗ throw ──> [then(C) BỊ BỎ QUA] ──> catch(D) ──> then(E)
>    ✓          ✓                        ✗ nhảy qua           ✓ cứu       ✓ chạy tiếp
> ```
>
> Đây chính là điều làm `.catch` **hữu dụng** trong thực tế — nó cho phép **phục hồi** rồi đi tiếp,
> chứ không chỉ để "báo lỗi rồi bỏ cuộc":
> ```javascript
> layDuLieuTuServer()
>     .catch(() => duLieuMacDinh)   // lỗi mạng? dùng dữ liệu mặc định
>     .then(d => hienThi(d));       // vẫn chạy tiếp bình thường, UI không vỡ
> ```
>
> **Muốn chain thật sự "chết hẳn"** thì `.catch` phải **ném lỗi tiếp** thay vì `return`:
> ```javascript
> .catch(e => {
>     console.log("D:", e.message);
>     throw e;              // ném lại -> vẫn ở làn lỗi
> })
> .then(v => console.log("E:", v));  // KHÔNG chạy - lúc này E mới bị bỏ qua
> ```
> Ghi nhớ ngắn gọn: trong `.catch`, **`return` = đã cứu được, đi tiếp** — còn **`throw` = chưa cứu
> được, đẩy lỗi xuống dưới**. Và một `.then` chỉ bị bỏ qua khi Promise ngay trước nó đang ở trạng thái
> **rejected**.

------------------------------------------------------------------------

## Bài 10 - async/await: tuần tự, song song và quên `await`

``` javascript
function doi(ms, gt) {
    return new Promise(resolve => setTimeout(() => resolve(gt), ms));
}

async function tuanTu() {
    const a = await doi(100, "A");
    const b = await doi(100, "B");
    return a + b;
}

async function songSong() {
    const [a, b] = await Promise.all([doi(100, "A"), doi(100, "B")]);
    return a + b;
}

async function quenAwait() {
    const a = doi(100, "A");
    return a + "B";
}

tuanTu().then(r => console.log("tuanTu:", r));
songSong().then(r => console.log("songSong:", r));
quenAwait().then(r => console.log("quenAwait:", r));
```

**Câu hỏi**
1. `tuanTu()` và `songSong()` cùng trả về giá trị gì? Mỗi hàm mất khoảng bao nhiêu mili giây? Vì sao
   khác nhau dù cùng chờ hai tác vụ 100ms?
2. `quenAwait()` in ra gì? Giải thích chính xác vì sao lại ra chuỗi đó (gợi ý: `a` đang là kiểu gì,
   và phép `+` làm gì với nó).
3. Ba dòng log được in theo thứ tự nào? Vì sao thứ tự in KHÁC với thứ tự ba hàm được gọi trong code?

**Trả lời của bạn:**

1. `tuanTu()`: trả về `tuanTu: AB`, mất 200 ms. `songSong()`: trả về `songSong: AB`, mất 100 ms.
   - Khác nhau vì `tuanTu()` chạy từng function một: `await doi(100, "A")` mất 100 ms, đợi xong mới
     chạy tiếp `await doi(100, "B")` mất 100 ms nữa nên tổng là 200 ms.
   - `songSong()` thì chạy `doi(100, "A")` và `doi(100, "B")` cùng một lúc, nên mà mỗi function mất
     100 ms nên tổng thời gian hết 200 ms.
2. In ra `quenAwait: undfinedB`, vì lúc `a + "B"` được chạy trước khi `doi(100, "A")` chạy xong, nên
   `a` chưa có giá trị.
3. `quenAwait` → `songSong` → `tuanTu`

> **Chấm điểm: 6/10**
>
> - ⚠️ **Ý 1** — Hai giá trị `"AB"` và hai con số 200 ms / 100 ms đều **đúng**, phần giải thích
>   `tuanTu` cũng đúng. Nhưng câu cuối **tự mâu thuẫn**: bạn viết `songSong` "chạy cùng một lúc" rồi
>   lại kết luận "tổng thời gian hết **200 ms**" — trong khi ở dòng trên chính bạn đã ghi đúng là
>   **100 ms**.
> - ❌ **Ý 2** — Sai: in ra **`quenAwait: [object Promise]B`**, không phải `undefinedB`. Chẩn đoán
>   "`a` chưa có giá trị" cũng không đúng — `a` **có giá trị ngay lập tức**, chỉ là giá trị đó không
>   phải thứ bạn tưởng.
> - ✅ **Ý 3** — Đúng thứ tự: `quenAwait` → `songSong` → `tuanTu`.
>
> **Làm rõ ý 1:** khi chạy song song, tổng thời gian bằng **tác vụ CHẬM NHẤT**, không phải tổng các
> tác vụ. Hai lời gọi `doi(100, ...)` được khởi động gần như cùng lúc, hai bộ đếm 100 ms chạy **chồng
> lên nhau**, nên sau 100 ms là **cả hai** cùng xong → `Promise.all` resolve → tổng **~100 ms**. Công
> thức để nhớ:
> ```
> tuần tự  (await lần lượt) : tổng thời gian = 100 + 100 = 200ms   (cộng dồn)
> song song (Promise.all)   : tổng thời gian = max(100, 100) = 100ms (lấy max)
> ```
>
> **Giải thích đúng ý 2 — vì sao ra `[object Promise]B`:**
>
> Điểm quan trọng nhất: **thiếu `await` không làm `a` bị `undefined`.** Hãy nhìn kỹ dòng đó:
> ```javascript
> const a = doi(100, "A");  // KHÔNG có await
> ```
> `doi(...)` là một hàm bình thường, nó **`return new Promise(...)` ngay lập tức** — không hề chờ 100 ms.
> Vậy `a` **có giá trị ngay tức khắc**, và giá trị đó là **một object Promise đang ở trạng thái
> `pending`**. Nó không rỗng, không `undefined` — chỉ là nó là "cái hộp đựng kết quả tương lai" chứ
> không phải bản thân chuỗi `"A"`.
>
> Tiếp theo, `a + "B"` là phép cộng giữa **một object** và **một string**. Khi gặp tình huống này, JS
> phải ép object về string, và cách ép mặc định là gọi `Object.prototype.toString()` → cho ra chuỗi
> `"[object Promise]"`. Nối với `"B"` thành **`"[object Promise]B"`**.
>
> ```javascript
> const a = doi(100, "A");
> console.log(a);          // Promise { <pending> } - CÓ giá trị, là một object
> console.log(typeof a);   // "object"  (không phải "undefined")
> console.log(a + "B");    // "[object Promise]B"
> ```
>
> **Sửa lại đúng** chỉ cần thêm `await` — nó "mở hộp" lấy giá trị bên trong ra:
> ```javascript
> async function daAwait() {
>     const a = await doi(100, "A"); // dừng 100ms, rồi a = "A" (string)
>     return a + "B";                // "AB"
> }
> ```
>
> **Vì sao lỗi này nguy hiểm:** nó **không ném exception**, `try/catch` **không bắt được**, code vẫn
> chạy "thành công" — chỉ là dữ liệu sai. Dấu hiệu nhận biết ngoài đời: thấy `[object Promise]` hoặc
> `Promise { <pending> }` hiện lên trong log/UI thì gần như chắc chắn là **quên `await`** ở đâu đó.
>
> **Bổ sung ý 3 (bạn trả lời đúng, ghi lại lý do cho rõ):** thứ tự in **không theo thứ tự gọi hàm**,
> mà theo **thứ tự hoàn thành**. `quenAwait` chẳng chờ gì cả nên xong gần như tức thì; `songSong` xong
> sau ~100 ms; `tuanTu` xong sau ~200 ms. Cả ba đều được **khởi động** gần như cùng lúc (không cái nào
> chặn cái nào, vì `.then` không dừng luồng chính) — chúng chỉ **về đích** vào những thời điểm khác
> nhau.

------------------------------------------------------------------------

# Bonus - Event loop: sync, microtask, macrotask

``` javascript
console.log("1");

setTimeout(() => console.log("2"), 0);

Promise.resolve()
    .then(() => {
        console.log("3");
        return Promise.resolve();
    })
    .then(() => console.log("4"));

(async () => {
    console.log("5");
    await null;
    console.log("6");
})();

console.log("7");
```

**Câu hỏi**
1. Liệt kê đúng thứ tự 7 số được in ra.
2. Vì sao `5` in ra ngay lập tức nhưng `6` lại bị hoãn, dù `await null` chẳng chờ gì bất đồng bộ cả?
3. Vì sao `2` (`setTimeout` với delay `0`) là số in ra CUỐI CÙNG, dù nó được đăng ký rất sớm?
4. `4` in ra trước hay sau `6`? Giải thích vai trò của dòng `return Promise.resolve()` trong việc
   này.

**Trả lời của bạn:**

1. `1, 3, 4, 5, 6, 7, 2`
2. *(nhờ giải thích)*
3. *(nhờ giải thích)*
4. *(nhờ giải thích)*

> **Chấm điểm: 1/10**
>
> - ❌ **Ý 1** — Sai thứ tự. Thứ tự đúng là **`1, 5, 7, 3, 6, 4, 2`**. Bạn đúng được đúng một điều:
>   `2` in ra cuối cùng.
> - ⬜ **Ý 2, 3, 4** — Chưa trả lời.
>
> **Sai lầm gốc của ý 1:** bạn xếp `3` và `4` (Promise) lên **trước** `5` và `7` (code đồng bộ). Quy
> tắc bất di bất dịch là ngược lại: **toàn bộ code đồng bộ luôn chạy HẾT trước, không có ngoại lệ.**
> `Promise.resolve().then(cb)` không chạy `cb` ngay — nó chỉ **xếp `cb` vào hàng đợi**, rồi đi tiếp
> xuống dòng dưới ngay lập tức.
>
> **Lần theo từng bước để thấy rõ:**
>
> | Bước | Dòng code | Chuyện xảy ra | In ra |
> |---|---|---|---|
> | 1 | `console.log("1")` | chạy ngay | **`1`** |
> | 2 | `setTimeout(..., 0)` | xếp vào hàng **macrotask** | — |
> | 3 | `.then(() => {log 3 ...})` | xếp callback vào hàng **microtask** | — |
> | 4 | IIFE async: `console.log("5")` | thân hàm async chạy **đồng bộ** cho tới `await` | **`5`** |
> | 5 | `await null` | tạm dừng, xếp phần còn lại (`log 6`) vào **microtask** | — |
> | 6 | `console.log("7")` | chạy ngay | **`7`** |
> | | *(hết code đồng bộ → dọn hàng microtask)* | | |
> | 7 | microtask #1 | `log 3`, rồi `return Promise.resolve()` | **`3`** |
> | 8 | microtask #2 | phần sau `await` → `log 6` | **`6`** |
> | 9 | microtask (sau vài tick) | `log 4` | **`4`** |
> | | *(hết microtask → mới tới macrotask)* | | |
> | 10 | macrotask | `log 2` | **`2`** |
>
> **Đáp án ý 2 — vì sao `5` in ngay mà `6` bị hoãn:**
>
> Vì `async function` **không** chạy bất đồng bộ ngay từ đầu. Khi được gọi, thân hàm chạy **đồng bộ
> như mọi hàm thường** cho tới khi gặp `await` đầu tiên — đó là lý do `5` in ra ngay tại chỗ, xen giữa
> `1` và `7`.
>
> Đúng tại `await`, hàm bị **cắt làm đôi**: phần trước `await` đã chạy xong, còn **toàn bộ phần sau
> `await` bị đóng gói thành một callback và xếp vào hàng microtask**. `await null` là trường hợp cực
> đoan cho thấy điều này: `null` chẳng bất đồng bộ chút nào, chẳng có gì để chờ — nhưng JS **vẫn** bọc
> nó thành `Promise.resolve(null)` rồi hoãn phần dưới lại. Nói cách khác: **`await` luôn nhường lượt
> ít nhất một tick, kể cả khi giá trị đã sẵn sàng.**
>
> Ghi nhớ: `await X` ≈ `Promise.resolve(X).then(() => phần_còn_lại)`.
>
> **Đáp án ý 3 — vì sao `setTimeout(..., 0)` lại về đích cuối cùng:**
>
> Vì `setTimeout` và Promise nằm ở **hai hàng đợi khác cấp nhau**, và event loop có luật ưu tiên rất
> cứng:
> ```
> Mỗi vòng lặp: chạy hết code đồng bộ
>            -> DỌN SẠCH toàn bộ hàng microtask (.then, await, queueMicrotask)
>            -> rồi mới lấy MỘT macrotask (setTimeout, setInterval, I/O)
> ```
> `setTimeout(fn, 0)` **không** có nghĩa là "chạy ngay". Số `0` chỉ là **thời gian chờ tối thiểu**
> trước khi callback được **đưa vào hàng macrotask** — nó vẫn phải xếp hàng sau **toàn bộ** microtask
> đang chờ. Ở đây có tận 3 microtask (`3`, `6`, `4`) phải dọn xong, nên `2` về chót.
>
> Hệ quả thực tế đáng sợ: nếu microtask cứ **tự sinh ra microtask mới** liên tục, hàng microtask không
> bao giờ cạn → `setTimeout` **vĩnh viễn không được chạy**, trình duyệt treo cứng:
> ```javascript
> function vongLapVoTan() { Promise.resolve().then(vongLapVoTan); }
> vongLapVoTan();
> setTimeout(() => console.log("KHONG BAO GIO CHAY"), 0);
> ```
>
> **Đáp án ý 4 — `4` in ra SAU `6`.** Có **hai lý do độc lập**, và lý do chính không phải dòng
> `return Promise.resolve()` như tên câu hỏi dễ khiến ta tưởng.
>
> **Lý do chính — thời điểm callback được XẾP HÀNG, không phải thời điểm nó được viết:**
>
> Một callback `.then` chỉ được xếp vào hàng microtask **khi Promise ngay trước nó đã xong**, chứ
> không phải ngay lúc engine đọc qua dòng code. Vì vậy:
> - `log 6` (phần sau `await null`) được xếp hàng **ngay trong giai đoạn đồng bộ** — lúc IIFE chạy tới
>   `await`.
> - `log 4` thì **chưa tồn tại trong hàng đợi lúc đó**. Nó chỉ được xếp vào **sau khi** callback đầu
>   tiên (`log 3`) chạy xong — tức là đã sang tới lượt dọn microtask rồi.
>
> `log 6` vào hàng trước, nên ra trước. Đơn giản vậy thôi. Kiểm chứng: **bỏ hẳn `return
> Promise.resolve()` đi thì thứ tự vẫn là `3 → 6 → 4`** — chứng tỏ dòng đó không phải nguyên nhân.
>
> **Lý do phụ — `return Promise.resolve()` đẩy `4` lùi thêm 2 tick nữa:**
>
> Khi callback `.then` trả về **giá trị thường**, Promise kế tiếp resolve ngay trong tick đó. Nhưng
> khi nó trả về **một Promise khác** (hay bất cứ thứ gì có `.then` — gọi là *thenable*), JS phải "mở
> khóa" Promise đó, và theo chuẩn việc này tốn thêm **2 tick microtask**: một tick để gọi `.then` của
> Promise bên trong, một tick để nhận kết quả rồi mới resolve Promise bên ngoài.
>
> Hiệu ứng này có thật, chỉ là ở snippet trên nó bị che khuất (vì `4` đã thua `6` sẵn rồi). Muốn thấy
> rõ thì đặt cạnh một chain khác để làm thước đo:
> ```javascript
> // CÓ return Promise.resolve()
> Promise.resolve().then(() => { console.log("3"); return Promise.resolve(); })
>                  .then(() => console.log("4"));
> Promise.resolve().then(() => console.log("a"))
>                  .then(() => console.log("b"))
>                  .then(() => console.log("c"));
> // In ra: 3, a, b, c, 4   <-- "4" bị đẩy lùi tận 2 nấc, ra sau cả "c"
>
> // KHÔNG return Promise (chỉ bỏ đúng dòng return)
> // In ra: 3, a, 4, b, c   <-- "4" về đúng nấc thứ 2 như bình thường
> ```
>
> **Rút ra:** khi phân tích thứ tự microtask, câu hỏi đúng cần đặt ra là **"callback này được xếp vào
> hàng ở thời điểm nào?"**, chứ không phải "nó nằm ở dòng thứ mấy trong code".
>
> **Lời khuyên thực tế:** không ai nên **dựa vào** thứ tự vi mô cỡ này để viết code chạy đúng — nó quá
> mong manh. Thứ đáng nhớ và dùng được hàng ngày chỉ là **ba tầng ưu tiên**:
> **đồng bộ → microtask (Promise/await) → macrotask (setTimeout)**. Còn chuyện `4` hay `6` trước là để
> hiểu *vì sao* engine hành xử như vậy, không phải để đem ra thiết kế logic.

------------------------------------------------------------------------

# Tổng kết điểm

| Bài | Điểm | Ghi chú ngắn |
|---|---|---|
| 1 | 8/10 | Đúng hết giá trị; phần "hậu quả thực tế" của impure nói ngược chiều |
| 2 | 9/10 | Rất tốt; thiếu mấu chốt primitive vs reference để giải thích vì sao `id` an toàn |
| 3 | 8/10 | Đúng nguyên nhân lỗi nhưng thiếu tên lỗi `DataCloneError` |
| 4 | 3/10 | Sai `d1 === d2`; đổ cho hoisting thay vì closure; bỏ trống ý 3 |
| 5 | 7/10 | Đúng hết giá trị; thiếu quy tắc chung, lý do giao hoán chưa chạm mấu chốt |
| 6 | 0/10 | Chưa trả lời — `fn.length` và các bẫy của nó |
| 7 | 3/10 | Đúng ý 2; bỏ trống bẫy `map(parseInt)` và `reduce` mảng rỗng |
| 8 | 2/10 | **Nhầm lẫn cốt lõi:** tưởng `forEach` = "map có mutate", `kq1` không phải `undefined` |
| 9 | 5/10 | Đúng cơ chế `throw` nhảy sang `catch`; sai ở chỗ chain sống lại sau `.catch` |
| 10 | 6/10 | Đúng tuần tự/song song và thứ tự in; sai `undefined` vs `[object Promise]` |
| Bonus | 1/10 | Xếp Promise chạy trước code đồng bộ |

**Tổng: 51/100 (~5.1/10)** cho 10 bài chính.

**Cần ôn lại** — hai lỗ hổng gốc rễ, không phải lỗi vụn vặt:

**1. "Mắt xích này TRẢ VỀ cái gì?" — bạn hay suy ra giá trị trả về từ *việc hàm làm*, thay vì từ
*quy định của hàm*.** Đây là gốc chung của ba bài mất điểm nhiều nhất:
- Bài 8: `forEach` **luôn** trả `undefined`, bất kể callback làm gì — bạn đoán nó trả về mảng users.
- Bài 8: `map(u => u.tuoi + 1)` trả về mảng **số** `[21, 31]`, vì callback `return` một số — bạn đoán
  nó trả về mảng object.
- Bài 9: `.catch` **cũng trả về Promise** như `.then`, nên chain **sống tiếp** — bạn đoán chain chết.
- Bài 10: hàm không `await` trả về **object Promise**, không phải `undefined`.

Cách sửa thói quen: mỗi khi gặp một mắt xích, hỏi thẳng **"cái này trả về KIỂU gì?"** trước khi hỏi
"nó làm gì". Ba câu cần thuộc: `forEach` → luôn `undefined`; `map/filter` → luôn mảng mới; `then/catch`
→ luôn Promise mới.

**2. "Gọi hàm một lần nữa = tạo ra một bộ đồ mới hoàn toàn" (Bài 4).** Bạn trả lời `d1 === d2` là
`true` và đổ cho hoisting. Thật ra đây **đúng là bài học của Bài 3 ngày 3** (`a1.hienThi !== a2.hienThi`),
chỉ đổi bối cảnh: mỗi lần **gọi** một hàm, mọi function expression bên trong nó sinh ra **object hàm
mới**, và mọi `let/const` bên trong sinh ra **biến mới**. Hai lỗi này cùng một gốc — nên xem lại Bài 3
ngày 3 song song với Bài 4 ngày này.

**Nên làm lại trước tiên: Bài 6 và Bài 7** (chưa trả lời, mà đây là hai bài công cụ dùng hàng ngày),
rồi **Bài 8** (hiểu sai `forEach`/`map` sẽ theo bạn đi rất xa). Bài 2, 3, 5 đã nắm khá chắc, không cần
làm lại.
