# 10 Bài tập JavaScript - `this`

> **Quy tắc:** Không chạy code ngay. Hãy tự dự đoán kết quả hoặc lỗi,
> sau đó giải thích vì sao.

## Bài 1 - Gọi standalone vs gọi qua method

``` javascript
const obj = {
    label: "obj",
    show: function () {
        console.log(this.label);
    }
};

obj.show();

const f = obj.show;
f();
```

**Câu hỏi**
1. `obj.show()` in ra gì?
2. `f()` in ra gì (hoặc lỗi gì)?
3. Vì sao cùng một hàm `show` nhưng hai lần gọi lại cho kết quả khác nhau?

**Trả lời của bạn:**

1. `obj.show()` in ra text `obj`.
2. `f()` không in ra gì cả.
3.
   - `obj.show()` ra text `obj` vì `this` chính là `obj` — gọi đến function lúc này chính là `obj`,
     `obj` có thuộc tính `label` bằng `"obj"` nên text log sẽ ra `obj`.
   - `f()` không ra gì cả vì `f` lúc này đã là một function độc lập nên không có `this`, hoặc `this`
     là global object.

> **Chấm điểm: 7/10**
>
> - ✅ **Ý 1** — Đúng: `obj.show()` in ra `"obj"`.
> - ❌ **Ý 2** — Sai: `f()` **có** in ra thứ gì đó, chỉ là không phải `"obj"`. Vì file chạy ở sloppy
>   mode (không strict), gọi `f()` standalone thì `this` = global object, mà global object không có
>   thuộc tính `label` → `this.label` = `undefined` → **in ra `undefined`**, không phải im lặng.
>   (Nếu ở strict mode thì `this` = `undefined`, lúc đó `this.label` mới thực sự **ném lỗi**
>   `TypeError: Cannot read properties of undefined`.)
> - ⚠️ **Ý 3** — Nửa đúng: phần giải thích cho `obj.show()` chính xác. Phần cho `f()` đã nói đúng
>   hướng "this là global object" nhưng lại kết luận "không ra gì cả" ở ý 2 — hai ý này mâu thuẫn
>   nhau, cần thống nhất: global object → in ra `undefined`.

------------------------------------------------------------------------

## Bài 2 - Gọi với `new`

``` javascript
function Sach(ten) {
    this.ten = ten;
}

const s1 = new Sach("Clean Code");
const s2 = Sach("Clean Code");

console.log(s1.ten);
console.log(s2);
```

**Câu hỏi**
1. `s1.ten` in ra gì?
2. `s2` là gì?
3. Vì sao thiếu `new` lại tạo ra kết quả khác hẳn?

**Trả lời của bạn:**

1. Ra `Clean Code`.
2. Không ra gì cả.
3. Vì khi gọi với `new`, JS sẽ thực hiện: tạo object mới → gán giá trị rỗng → chạy code → gán lại
   `this` → return.

> **Chấm điểm: 9/10**
>
> - ✅ **Ý 1** — Đúng: `s1.ten` in ra `"Clean Code"`.
> - ⚠️ **Ý 2** — Chưa chính xác: `s2` không phải "không có gì" mà là **`undefined`**, vì `Sach` gọi
>   standalone không có `return` nào → tự động trả về `undefined`.
> - ✅ **Ý 3** — Đúng: đủ 4 bước của `new` (tạo object → gán `this` → chạy code → return `this`).
>
> **Bonus lưu ý — vì sao quên `new` lại nguy hiểm:**
>
> Khi gọi `Sach("Clean Code")` **không** có `new`, hàm chạy như một function bình thường (standalone),
> nên `this` bên trong nó **không phải** object mới — mà là **global object** (`window` trên browser,
> `global` trên Node, ở sloppy mode). Dòng `this.ten = ten` lúc này thực chất tương đương với:
>
> ``` javascript
> window.ten = "Clean Code"; // (hoặc global.ten trên Node)
> ```
>
> Tức là bạn vừa **tạo ra một biến toàn cục tên `ten`** một cách hoàn toàn vô tình — không hề có ý định
> khai báo biến global nào cả. Điều này nguy hiểm vì:
>
> - **Rò rỉ biến toàn cục (global leak):** biến `ten` giờ tồn tại ở phạm vi cao nhất, bất kỳ file hay
>   đoạn code nào khác trong cùng ứng dụng cũng có thể đọc/ghi đè nó, dẫn đến xung đột tên khó lường.
> - **Ghi đè dữ liệu có sẵn:** nếu global object đã có sẵn thuộc tính tên `ten` (hoặc trùng tên với
>   biến/hàm quan trọng khác), giá trị đó sẽ bị **ghi đè âm thầm**, không có cảnh báo hay lỗi nào.
> - **Lỗi rất khó debug:** vì code vẫn "chạy được", không văng lỗi ngay lập tức — bug chỉ lộ ra sau đó,
>   ở một chỗ hoàn toàn khác trong code, khi ai đó đọc nhầm giá trị global `ten` này. Đây là kiểu lỗi
>   tốn nhiều thời gian truy tìm nhất vì nguyên nhân (quên `new`) và triệu chứng (giá trị sai ở chỗ
>   khác) nằm cách xa nhau.
>
> **Cách phòng tránh trong thực tế:**
> - Luôn đặt `"use strict"` đầu file (hoặc dùng ES module) — khi đó `this` trong lời gọi standalone sẽ
>   là `undefined` thay vì global object, nên `this.ten = ten` sẽ **ném lỗi ngay lập tức**
>   (`TypeError: Cannot set properties of undefined`) thay vì âm thầm rò rỉ ra global.
> - Dùng `class` thay vì `function` để viết constructor — gọi `class` mà thiếu `new` sẽ luôn bị JS
>   chặn và báo lỗi `TypeError: Class constructor Sach cannot be invoked without 'new'`, không có cách
>   nào lách được (khác với `function`, nơi `new.target` ở Bài 7 chỉ là cơ chế tự nguyện, phải tự thêm
>   `if` để kiểm tra).

------------------------------------------------------------------------

## Bài 3 - call / apply

``` javascript
function tinhTong(a, b) {
    console.log(this.label, a + b);
}

const ctx1 = { label: "Cách 1:" };
const ctx2 = { label: "Cách 2:" };

tinhTong.call(ctx1, 1, 2);
tinhTong.apply(ctx2, [3, 4]);
```

**Câu hỏi**
1. Hai lần gọi in ra gì?
2. `call` và `apply` giống nhau ở điểm nào, khác nhau ở điểm nào?

**Trả lời của bạn:**

1. Lần 1 in ra `"cách 1 : 3"`, lần 2 in ra `"cách 2 : 7"`.
2.
   - Giống nhau: đều gán lại `this` cho function.
   - Khác nhau: cách truyền tham số.

> **Chấm điểm: 10/10**
>
> - ✅ **Ý 1** — Đúng: `call(ctx1, 1, 2)` → `"Cách 1: 3"`, `apply(ctx2, [3, 4])` → `"Cách 2: 7"`.
> - ✅ **Ý 2** — Đúng: giống nhau ở việc cả hai đều gán `this` và gọi hàm **ngay lập tức**; khác nhau
>   ở cách truyền tham số — `call` truyền rời (`call(obj, a, b)`), `apply` truyền mảng
>   (`apply(obj, [a, b])`).

------------------------------------------------------------------------

## Bài 4 - bind

``` javascript
function chao() {
    console.log(`Chao ${this.ten}`);
}

const nguoiA = { ten: "Bình" };
const chaoBinh = chao.bind(nguoiA);

console.log("truoc khi goi chaoBinh");
chaoBinh();
chaoBinh();
```

**Câu hỏi**
1. Dòng nào chạy trước, dòng nào chạy sau?
2. `chaoBinh()` gọi hai lần có ra cùng kết quả không?
3. Điểm khác biệt cốt lõi giữa `bind` với `call`/`apply` là gì?

**Trả lời của bạn:**

1. Thứ tự chạy: `console.log("truoc khi goi chaoBinh")` → `chaoBinh()` → `chaoBinh()`.
2. Có.
3.
   - `bind` tạo function mới với giá trị `this` cố định được truyền vào, và chưa chạy function.
   - `call`/`apply` gán lại `this` cho function và chạy luôn function đó.

> **Chấm điểm: 10/10**
>
> - ✅ **Ý 1** — Đúng: `bind` không gọi hàm ngay, chỉ trả về hàm mới, nên `console.log("truoc khi goi
>   chaoBinh")` luôn chạy trước cả hai lần gọi `chaoBinh()`.
> - ✅ **Ý 2** — Đúng: cả hai lần gọi đều ra `"Chao Bình"` vì `this` đã bị khóa cứng = `nguoiA`.
> - ✅ **Ý 3** — Đúng: `bind` tạo hàm mới cố định `this`, chưa chạy ngay; `call`/`apply` gán `this` và
>   chạy luôn. Lưu ý thêm: `this` của hàm đã `bind` là **không thể đổi được nữa**, dù sau đó có gọi
>   `chaoBinh.call(otherObj)` cũng vô ích.

------------------------------------------------------------------------

## Bài 5 - Arrow function và lexical `this`

``` javascript
const timer = {
    label: "Timer",
    start: function () {
        setTimeout(function () {
            console.log(this.label);
        }, 0);

        setTimeout(() => {
            console.log(this.label);
        }, 0);
    }
};

timer.start();
```

**Câu hỏi**
1. Hai `setTimeout` in ra gì?
2. Vì sao kết quả khác nhau dù cùng nằm trong `start`?
3. Arrow function lấy `this` từ đâu?

**Trả lời của bạn:**

1. `setTimeout` đầu in ra `Timer`, `setTimeout` thứ 2 in ra object rỗng.
2.
   - `setTimeout` đầu: sử dụng cách khai báo function bình thường, nên `this` được lấy từ object gọi
     đến function `start`, cụ thể ở đây là `timer`.
   - `setTimeout` thứ 2: sử dụng arrow function nên `this` mượn từ scope cha, ở đây là global object
     hoặc rỗng.

> **Chấm điểm: 3/10**
>
> - ❌ **Ý 1** — Kết quả bị **ngược**: `setTimeout` đầu (regular function) thực ra in ra `undefined`,
>   `setTimeout` thứ hai (arrow function) mới in ra `"Timer"`.
> - ❌ **Ý 2** — Sai lý do: bạn áp dụng quy tắc "this = object gọi đến hàm" cho cả hai, nhưng quy tắc
>   đó chỉ đúng khi hàm được gọi **trực tiếp qua dấu chấm** (`obj.fn()`). Ở đây cả hai callback đều
>   được **truyền làm tham số** cho `setTimeout`, và `setTimeout` tự gọi chúng như hàm standalone
>   (`callback()`), không phải `timer.callback()`.
> - ⚠️ **Ý 3** — Đúng khái niệm ("arrow lấy this từ scope cha") nhưng áp dụng sai giá trị (kết luận
>   "global object hoặc rỗng" thay vì `timer`).
>
> **Giải thích đúng:**
> - `setTimeout` đầu (`function () {...}`): regular function → khi `setTimeout` gọi nó standalone,
>   `this` bên trong = global object (sloppy mode). Global object không có `label` → in ra `undefined`.
> - `setTimeout` thứ 2 (`() => {...}`): arrow function → **không quan tâm ai gọi nó**, mà lấy `this`
>   theo lexical scope, tức `this` của hàm `start` bao quanh nó. Vì `start` được gọi bằng
>   `timer.start()`, nên `this` trong `start` = `timer` → arrow function kế thừa đúng `this` đó →
>   `this.label` = `"Timer"`.
>
> **Ghi nhớ:** với arrow function, hãy nhìn **nơi nó được viết ra** (lexical), không nhìn **ai gọi
> nó**. Với regular function thì ngược lại — luôn nhìn **ai gọi nó** lúc runtime.

------------------------------------------------------------------------

## Bài 6 - Mất `this` khi tách callback

``` javascript
const counter = {
    count: 0,
    tick: function () {
        this.count++;
        console.log(this.count);
    }
};

setTimeout(counter.tick, 0);
setTimeout(counter.tick.bind(counter), 0);
setTimeout(() => counter.tick(), 0);
```

**Câu hỏi**
1. Dòng đầu tiên in ra gì (hoặc lỗi gì)?
2. Vì sao dòng thứ 2 và thứ 3 lại chạy đúng?
3. Hai cách sửa lỗi ở dòng 2, 3 khác nhau ở điểm nào?

**Trả lời của bạn:**

1. In ra `NA`.
2. `setTimeout(counter.tick, 0)` là gán một function làm tham số, không phải lại object nào gọi đến
   `counter`, nên `this.count` sẽ trả về `undefined` mà `undefined++` sẽ ra `NA`.
3. Dòng 2 và 3 chạy đúng:
   - Vì `setTimeout(counter.tick.bind(counter), 0)` có gán lại `this` cho function `tick` qua `bind`.
   - `setTimeout(() => counter.tick(), 0)` đúng vì gọi qua `counter.tick()`, lúc này `this` sẽ bằng
     object gọi đến function `tick` và bằng `counter`.

> **Chấm điểm: 9/10**
>
> - ⚠️ **Ý 1** — Đúng ý nhưng gõ nhầm: "NA" đúng ra là **`NaN`**: `this.count++` với
>   `this.count = undefined` → `undefined++` = `NaN`, rồi gán ngược lại `this.count = NaN`.
> - ✅ **Ý 2** — Đúng: `setTimeout(counter.tick, 0)` truyền hàm đi standalone, không còn gắn với
>   `counter` nữa nên mất `this`.
> - ✅ **Ý 3** — Đúng: `bind(counter)` khóa cứng `this`, còn arrow `() => counter.tick()` gọi `tick`
>   qua dấu chấm (`counter.tick()`) nên `this` tự nhiên đúng là `counter`. Khác nhau ở chỗ `bind` tạo
>   ra một **hàm mới cố định `this`** dùng lại được nhiều nơi, còn arrow wrapper chỉ gọi hộ đúng cú
>   pháp method mỗi lần cần.

------------------------------------------------------------------------

## Bài 7 - `new.target`

``` javascript
function Counter() {
    if (!new.target) {
        throw new Error("Counter can duoc goi bang new");
    }
    this.count = 0;
}

const c = new Counter();
console.log(c.count);

Counter();
```

**Câu hỏi**
1. `console.log(c.count)` in ra gì?
2. Dòng `Counter()` (gọi không có `new`) xảy ra chuyện gì?
3. `new.target` dùng để làm gì?

**Trả lời của bạn:**

1. Ra `0`.
2. Trả về lỗi `"Counter can duoc goi bang new"`.
3. `new.target` để kiểm tra function có được gọi bằng `new` không.

> **Chấm điểm: 10/10**
>
> - ✅ **Ý 1** — Đúng: `c.count` = `0`.
> - ✅ **Ý 2** — Đúng: ném lỗi `"Counter can duoc goi bang new"`.
> - ✅ **Ý 3** — Đúng: `new.target` bằng chính hàm đó khi gọi bằng `new`, và `undefined` khi gọi
>   standalone — dùng để ép buộc caller phải dùng `new`, tránh lặp lại lỗi như ở Bài 2.

------------------------------------------------------------------------

## Bài 8 - `this` trong object lồng nhau

``` javascript
const congTy = {
    ten: "ABC",
    phongBan: {
        ten: "IT",
        show: function () {
            console.log(this.ten);
        }
    }
};

congTy.phongBan.show();
```

**Câu hỏi**
1. In ra gì, `"ABC"` hay `"IT"`?
2. Quy tắc "object đứng ngay trước dấu chấm" áp dụng thế nào ở đây khi có nhiều cấp lồng nhau?

**Trả lời của bạn:**

1. In ra `IT`.
2. `this` luôn là object trước dấu chấm gọi đến function, ở đây là `phongBan`.

> **Chấm điểm: 10/10**
>
> - ✅ **Ý 1** — Đúng: in ra `"IT"`.
> - ✅ **Ý 2** — Đúng: JS không quan tâm "object gốc/cha" là gì, chỉ quan tâm object nào đứng **ngay
>   trước dấu chấm cuối cùng** tại điểm gọi (`congTy.phongBan.show()` → `phongBan` đứng ngay trước
>   `.show()`), nên `this` = `phongBan`.

------------------------------------------------------------------------

## Bài 9 - `this` trong callback của array method

``` javascript
const nhom = {
    ten: "Nhom A",
    thanhVien: ["Sơn", "An"],
    inDanhSach: function () {
        this.thanhVien.forEach(function (tv) {
            console.log(this.ten, tv);
        });

        this.thanhVien.forEach((tv) => {
            console.log(this.ten, tv);
        });
    }
};

nhom.inDanhSach();
```

**Câu hỏi**
1. `forEach` đầu tiên in ra gì cho `this.ten`?
2. `forEach` thứ hai in ra gì?
3. Vì sao callback thường trong `forEach` không giữ được `this` của `inDanhSach`?

**Trả lời của bạn:**

1. In ra `undefined: Sơn, An`.
2. In ra `Nhóm A: Sơn, An`.
3. Vì callback sẽ hiểu vị trí gọi đến nó là object cha, cụ thể là `inDanhSach`; `inDanhSach` không có
   tên nên báo lỗi `undefined`.

> **Chấm điểm: 6/10**
>
> - ⚠️ **Ý 1** — Đúng ý nhưng thiếu format: in ra **2 dòng riêng biệt**, không gộp chung — `undefined
>   Sơn` rồi `undefined An`.
> - ⚠️ **Ý 2** — Đúng ý nhưng thiếu format: cũng 2 dòng riêng — `Nhom A Sơn` rồi `Nhom A An`.
> - ❌ **Ý 3** — Sai lý do: không liên quan gì đến "`inDanhSach` không có tên".
>
> **Lý do thật sự của ý 3:** `forEach` gọi callback của nó y hệt một hàm standalone
> (`callback(element)`), **không** gọi qua cú pháp `nhom.callback()`. Áp dụng đúng quy tắc Bài 1:
> regular function được gọi standalone → `this` = global object → không có `ten` → `undefined`. Arrow
> function ở `forEach` thứ hai không bị ảnh hưởng bởi cách `forEach` gọi nó, vì nó lấy `this` theo
> lexical scope (là `this` của `inDanhSach`, tức `nhom`) — giống hệt cơ chế đã thấy ở Bài 5 và Bài 6.

------------------------------------------------------------------------

## Bài 10 - Constructor return object khác

``` javascript
function Nguoi(ten) {
    this.ten = ten;
    return { ten: "Khach", vip: true };
}

const p = new Nguoi("Sơn");
console.log(p.ten);
console.log(p.vip);
```

**Câu hỏi**
1. `p.ten` và `p.vip` in ra gì?
2. Nếu constructor `return` một **object**, `this` (object mới tạo bởi `new`) còn được dùng nữa không?
3. Nếu constructor `return "Khach"` (một string) thay vì object, kết quả có khác không? Vì sao?

**Trả lời của bạn:**

1. `p.ten` in ra `Khach`, `p.vip` in ra `true`.
2. Không.
3. Có, lúc này `console.log(p.ten)` sẽ ra `Son`, `console.log(p.vip)` ra `undefined`.

> **Chấm điểm: 10/10**
>
> - ✅ **Ý 1** — Đúng: `p.ten` = `"Khach"`, `p.vip` = `true`.
> - ✅ **Ý 2** — Đúng: `this` (object mới tạo bởi `new`) bị "vứt bỏ", object `return` thay thế hoàn
>   toàn.
> - ✅ **Ý 3** — Đúng: nếu `return` một **primitive** (string, number, boolean...) thì JS **bỏ qua**
>   giá trị đó và tự động trả về `this` như bình thường → `p.ten` = `"Sơn"`, `p.vip` = `undefined`.

------------------------------------------------------------------------

# Bonus

``` javascript
class Nguoi2 {
    constructor(ten) {
        this.ten = ten;
    }

    chao() {
        console.log(`Xin chao, toi la ${this.ten}`);
    }
}

const n = new Nguoi2("Sơn");
const chaoRoi = n.chao;

n.chao();
chaoRoi();
```

**Câu hỏi**
1. `n.chao()` in ra gì?
2. `chaoRoi()` in ra gì hoặc lỗi gì?
3. Method trong `class` có tự động bind `this` không? So sánh với Bài 1 và Bài 6.

**Trả lời của bạn:**

1. `Xin chao, toi la Sơn`.
2. *(chưa trả lời)*
3. *(chưa trả lời)*

> **Chấm điểm: 3/10** (mới trả lời 1/3 ý)
>
> - ✅ **Ý 1** — Đúng: `n.chao()` gọi qua dấu chấm → `this` = `n` → in `"Xin chao, toi la Sơn"`.
> - ⬜ **Ý 2** — Chưa trả lời. Đáp án: `chaoRoi()` được gọi standalone (giống Bài 1, Bài 6), nhưng
>   `class` có điểm đặc biệt — **toàn bộ code bên trong `class` luôn tự động chạy ở strict mode**, kể
>   cả khi file không có `"use strict"`. Vì vậy `this` = `undefined` (không phải global object như
>   function thường) → `this.ten` **ném lỗi** `TypeError: Cannot read properties of undefined
>   (reading 'ten')`.
> - ⬜ **Ý 3** — Chưa trả lời. Đáp án: **Không.** Method trong `class` (cũng như method khai báo bằng
>   `function` trong object literal) không tự động bind `this` vào instance — vẫn theo quy tắc "this
>   phụ thuộc cách gọi" như Bài 1: gọi qua `n.chao()` thì đúng, tách ra gọi riêng thì mất `this`. Cách
>   sửa giống Bài 6: `n.chao.bind(n)`, hoặc khai báo method dưới dạng arrow class field
>   (`chao = () => { console.log(this.ten) }`) để tự lấy lexical `this` từ constructor.

------------------------------------------------------------------------

# Tổng kết điểm

| Bài | Điểm | Ghi chú ngắn |
|---|---|---|
| 1 | 7/10 | Sai ý 2: `f()` in ra `undefined`, không phải im lặng |
| 2 | 9/10 | Đúng ý, `s2` nên gọi rõ là `undefined` |
| 3 | 10/10 | Đúng hoàn toàn |
| 4 | 10/10 | Đúng hoàn toàn |
| 5 | 3/10 | **Kết quả bị ngược** — nhầm quy tắc "ai gọi" áp cho cả arrow function |
| 6 | 9/10 | Đúng ý, chỉ là lỗi gõ "NA" thay vì "NaN" |
| 7 | 10/10 | Đúng hoàn toàn |
| 8 | 10/10 | Đúng hoàn toàn |
| 9 | 6/10 | Kết quả đúng, giải thích ý 3 sai lý do |
| 10 | 10/10 | Đúng hoàn toàn |
| Bonus | 3/10 | Chỉ trả lời ý 1, còn thiếu ý 2 và 3 |

**Tổng: 84/100 (~8.4/10)** cho 10 bài chính.

**Cần ôn lại:** trọng tâm là **Bài 5** — quy tắc "this = object gọi hàm" chỉ áp dụng cho **regular
function**; **arrow function luôn lấy `this` theo nơi nó được viết ra** (lexical scope), bất kể ai gọi
nó. Đây cũng chính là lý do Bài 9 giải thích sai ở ý 3 — cùng một lỗ hổng kiến thức. Ôn lại ví dụ Bài 5
và Bài 6 kỹ thêm sẽ nắm chắc được phần này. 