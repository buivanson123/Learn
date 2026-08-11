# 10 Bài tập JavaScript - `Prototype & Class`

> **Quy tắc:** Không chạy code ngay. Hãy tự dự đoán kết quả hoặc lỗi,
> sau đó giải thích vì sao.

## Bài 1 - Prototype chain lookup

``` javascript
const a = { x: 1 };
const b = Object.create(a);
const c = Object.create(b);

console.log(c.x);

a.x = 100;
console.log(c.x);

c.x = 999;
console.log(c.x);
console.log(b.x);
console.log(a.x);
```

**Câu hỏi**
1. `c.x` ở dòng đầu in ra gì? Vì sao phải đi qua 2 cấp mới tìm thấy?
2. Sau khi sửa `a.x = 100`, `c.x` in ra gì? Vì sao thay đổi trên `a` lại ảnh hưởng tới `c`?
3. Sau khi gán `c.x = 999`, ba dòng log cuối in ra gì? `b.x` và `a.x` có bị đổi theo không?


**Trả lời của bạn:**

1. `c.x` in ra `1` — tại vì cơ chế xác định prototype luôn từ trong ra ngoài: `c` không có own
   property nên tìm lên `b`, `b` cũng không có nên tìm lên trên cùng và tìm được ở `a`.
2. `c.x` in ra `100`, vì lúc này `c` đang có prototype là `a`.
3. In ra `99`, vì lúc này `b` và `c` đang dùng chung prototype là `a`.

> **Chấm điểm: 5/10**
>
> - ✅ **Ý 1** — Đúng: `c.x` = `1`, và đúng cơ chế đi từ `c` → `b` → `a` tới khi tìm thấy.
> - ⚠️ **Ý 2** — Đúng giá trị (`100`) nhưng sai một chi tiết: prototype **trực tiếp** của `c` là `b`,
>   không phải `a`. `c` phải đi qua `b` rồi mới lên tới `a` (`b` vẫn chưa có own property `x` nên
>   không chặn lại giữa đường) — không phải `c` "có prototype là `a`" một cách trực tiếp.
> - ❌ **Ý 3** — Sai cả giá trị lẫn lý do. Ba dòng log cuối thực ra in ra ba giá trị **khác nhau**:
>   `c.x` = `999`, `b.x` = `100`, `a.x` = `100` — không phải chỉ một số `99` (có vẻ gõ thiếu số 9).
>
> **Giải thích đúng ý 3:** `c.x = 999` tạo ra một **own property mới trên chính `c`**, shadow (che)
> hẳn prototype chain của `c` — không đụng gì tới `b` hay `a`. Còn `b.x` và `a.x` không liên quan gì
> tới việc gán `c.x`: `b` vẫn không có own property `x` nên tiếp tục lấy từ `a.x` (đã bị đổi thành
> `100` ở dòng trước đó) → `b.x` = `100`; và `a.x` vẫn giữ nguyên `100`. Ba biến `a`, `b`, `c` không hề
> "dùng chung prototype là `a`" như bạn nói — quan hệ thực tế là chain một chiều `c → b → a`, mỗi cấp
> chỉ trực tiếp kế thừa từ cấp ngay trên nó.

------------------------------------------------------------------------

## Bài 2 - Object.create chia sẻ method

``` javascript
const template = {
    greet() {
        return `Xin chao, toi la ${this.ten}`;
    }
};

const p1 = Object.create(template);
p1.ten = "Sơn";

const p2 = Object.create(template);
p2.ten = "An";

console.log(p1.greet());
console.log(p2.greet());
console.log(p1.greet === p2.greet);

p1.greet = function () {
    return "Xin chao rieng";
};
console.log(p1.greet());
console.log(p2.greet());
```

**Câu hỏi**
1. Hai lần gọi `greet()` đầu tiên in ra gì?
2. `p1.greet === p2.greet` là `true` hay `false`? Vì sao?
3. Sau khi gán `p1.greet = function...`, `p1.greet()` và `p2.greet()` in ra gì? `template.greet` có bị
   thay đổi không?

**Trả lời của bạn:**

1. Ra `"Xin chao, toi la Sơn"` và `"Xin chao, toi la An"`.
2. Bằng `true`, vì đang dùng chung prototype.
3. `p1.greet()` in ra `"Xin chao rieng"`, `p2.greet()` in ra `"Xin chao rieng"`, vì cả 2 đang dùng
   chung prototype. `template.greet` có bị thay đổi.

> **Chấm điểm: 5/10**
>
> - ✅ **Ý 1** — Đúng.
> - ✅ **Ý 2** — Đúng: `true`, vì cả hai đều đọc `greet` qua cùng một prototype `template`.
> - ❌ **Ý 3** — Sai ở phần quan trọng nhất: `p2.greet()` **vẫn in ra `"Xin chao, toi la An"`**, không
>   phải `"Xin chao rieng"`. Và `template.greet` **không** bị thay đổi.
>
> **Giải thích đúng ý 3:** Đây là điểm dễ nhầm nhất của bài — gán `p1.greet = function...` **không**
> sửa method trên `template`, mà tạo ra một **own property `greet` mới trên chính `p1`**, shadow method
> gốc chỉ với riêng `p1`. Vì vậy sau dòng gán này:
> - `p1.greet` giờ đọc từ own property của `p1` → gọi ra `"Xin chao rieng"`.
> - `p2` không có own property `greet`, nên vẫn đi lên `template` như cũ → `"Xin chao, toi la An"`.
> - `template.greet` không hề bị đụng tới, vẫn nguyên vẹn.
>
> Đây chính là cơ chế **shadowing** — giống hệt phần Tối ôn tập ở file `ngày 3/javascript.js` (own
> property luôn che method/field trên prototype khi đọc, nhưng không sửa được prototype gốc thông qua
> việc gán trên instance).

------------------------------------------------------------------------

## Bài 3 - Constructor function: method trên prototype vs trong constructor

``` javascript
function XeA(ten) {
    this.ten = ten;
    this.hienThi = function () {
        return this.ten;
    };
}

function XeB(ten) {
    this.ten = ten;
}
XeB.prototype.hienThi = function () {
    return this.ten;
};

const a1 = new XeA("Toyota");
const a2 = new XeA("Honda");
const b1 = new XeB("Toyota");
const b2 = new XeB("Honda");

console.log(a1.hienThi === a2.hienThi);
console.log(b1.hienThi === b2.hienThi);
```

**Câu hỏi**
1. `a1.hienThi === a2.hienThi` là `true` hay `false`? Vì sao?
2. `b1.hienThi === b2.hienThi` là `true` hay `false`? Vì sao?
3. Cách viết `XeA` có vấn đề gì nếu tạo ra 10.000 instance so với `XeB`?

**Trả lời của bạn:**

1. Bằng `true` vì đang có cùng prototype.
2. Bằng `true` vì đang có cùng prototype.
3. *(chưa trả lời)*

> **Chấm điểm: 4/10**
>
> - ❌ **Ý 1** — Sai: `a1.hienThi === a2.hienThi` thực ra là **`false`**. `this.hienThi = function
>   () {...}` nằm **trong constructor**, nên mỗi lần `new XeA(...)` chạy, một **function object hoàn
>   toàn mới** được tạo ra và gán làm own property cho riêng instance đó — không hề liên quan gì tới
>   prototype cả (đây không phải trường hợp đọc từ `XeA.prototype`). Vì vậy `a1.hienThi` và
>   `a2.hienThi` là hai hàm khác nhau trong bộ nhớ.
> - ✅ **Ý 2** — Đúng: `true`, vì `hienThi` nằm trên `XeB.prototype`, chỉ tồn tại **đúng một bản duy
>   nhất**, mọi instance đều tham chiếu tới cùng một hàm đó qua prototype chain.
> - ⬜ **Ý 3** — Chưa trả lời.

> **Giải thích chi tiết hơn ý 2 — chuyện gì thực sự xảy ra:**
>
> 1. **`XeB.prototype.hienThi = function () {...}` chạy đúng 1 lần, ngay khi file được nạp** — tại
>    thời điểm này chưa có instance nào tồn tại cả. Dòng này tạo ra **một function object** và gán nó
>    làm property `hienThi` trên object `XeB.prototype` (object này tự động được JS tạo sẵn ngay khi
>    khai báo `function XeB`).
> 2. Khi chạy `new XeB("Toyota")`, JS thực hiện đúng 4 bước của `new` (đã học ở bài `this`): tạo object
>    rỗng mới → gán `[[Prototype]]` của object đó = `XeB.prototype` → chạy thân hàm `XeB` với `this` =
>    object mới (chỉ gán `this.ten = ten`, **không hề đụng tới `hienThi`**) → trả về object đó thành
>    `b1`. Tương tự cho `new XeB("Honda")` tạo ra `b2`. Cả `b1` và `b2` đều **không có own property
>    `hienThi`** — vì constructor không tạo ra nó.
> 3. Khi viết `b1.hienThi`, JS tra cứu theo đúng cơ chế prototype chain (Ví dụ 1 buổi sáng): tìm trên
>    chính `b1` → không thấy → đi lên `Object.getPrototypeOf(b1)`, mà bước 2 đã thiết lập đúng bằng
>    `XeB.prototype` → tìm thấy `hienThi` ở đó, trả về **chính function object đã tạo ở bước 1**.
>    `b2.hienThi` cũng đi qua y hệt các bước này, và vì `Object.getPrototypeOf(b2)` **cũng là cùng một
>    object `XeB.prototype`** (không phải bản copy riêng cho từng instance), nên nó tìm thấy và trả về
>    **cùng một function object** như của `b1`.
> 4. Vì vậy `b1.hienThi === b2.hienThi` so sánh hai kết quả tra cứu, mà cả hai đều trỏ tới **cùng một
>    vùng nhớ function duy nhất** → `true`. Có thể kiểm chứng thêm:
>    ```javascript
>    console.log(b1.hasOwnProperty("hienThi")); // false — không có trên chính b1
>    console.log(Object.getPrototypeOf(b1) === Object.getPrototypeOf(b2)); // true — chung 1 prototype
>    console.log(Object.getPrototypeOf(b1) === XeB.prototype); // true
>    ```
>
> **So với `XeA` (ý 1) để thấy rõ khác biệt:** `this.hienThi = function () {...}` nằm **trong thân
> constructor**, nghĩa là mỗi lần `new XeA(...)` chạy, dòng đó được **thực thi lại từ đầu**, tạo ra một
> **function object mới hoàn toàn** rồi gán làm **own property trên chính instance** đang được tạo —
> hoàn toàn không dính gì tới `XeA.prototype`. Đó là lý do `a1.hienThi` và `a2.hienThi` là hai object
> hàm khác nhau (`a1.hasOwnProperty("hienThi")` = `true`), còn `b1.hienThi` và `b2.hienThi` chỉ là hai
> **lần tra cứu khác nhau nhưng cùng trỏ về một chỗ**. Ghi nhớ ngắn gọn: khai báo method **trong
> constructor** = "tạo mới mỗi lần"; khai báo trên **`.prototype`** = "tạo một lần, tra cứu nhiều lần".
>
> **Vẫn thấy khó hình dung? Chứng minh bằng cách "gắn chuông báo" vào từng chỗ tạo function:**
>
> ```javascript
> function XeA(ten) {
>     this.ten = ten;
>     console.log("  -> XeA constructor dang chay, chuan bi tao 1 function moi...");
>     this.hienThi = function () {
>         return this.ten;
>     };
> }
>
> function XeB(ten) {
>     this.ten = ten;
> }
> console.log("=== Dong nay chay 1 lan duy nhat, TRUOC KHI co bat ky instance nao ===");
> XeB.prototype.hienThi = function () {
>     return this.ten;
> };
>
> console.log("=== Bat dau tao instance ===");
> const a1 = new XeA("Toyota");
> const a2 = new XeA("Honda");
> const b1 = new XeB("Toyota");
> const b2 = new XeB("Honda");
> ```
>
> Chạy đoạn này, thứ tự log thực tế in ra là:
> ```text
> === Dong nay chay 1 lan duy nhat, TRUOC KHI co bat ky instance nao ===
> === Bat dau tao instance ===
>   -> XeA constructor dang chay, chuan bi tao 1 function moi...
>   -> XeA constructor dang chay, chuan bi tao 1 function moi...
> ```
>
> Nhìn vào đúng thứ tự này là thấy ngay câu trả lời cho câu hỏi "vì sao":
>
> - Dòng `console.log("=== Dong nay chay 1 lan...")` in ra **trước cả khi `new XeA` hay `new XeB` được
>   gọi lần nào**. Điều đó nghĩa là `XeB.prototype.hienThi = function () {...}` là một **dòng lệnh độc
>   lập, nằm ngoài mọi hàm**, được JS chạy đúng 1 lần duy nhất khi engine đọc qua file từ trên xuống —
>   y hệt như chạy `const x = 5;` ở top-level. Nó không "chờ" instance nào cả, và **không có cách nào
>   để nó chạy lần thứ hai** trừ khi bạn tự tay viết lại dòng đó ở chỗ khác trong code.
> - Dòng `"XeA constructor dang chay..."` in ra **2 lần** — đúng bằng số lần `new XeA(...)` được gọi.
>   Điều đó chứng minh trực tiếp: đoạn `this.hienThi = function () {...}` nằm **bên trong thân hàm
>   `XeA`**, mà thân hàm là đoạn code chỉ chạy khi hàm **được gọi** — và với constructor thì "được gọi"
>   nghĩa là mỗi lần `new XeA(...)` xuất hiện, toàn bộ code trong `{ }` của `XeA` được thực thi lại từ
>   đầu, kể cả biểu thức `function () { return this.ten; }` — mà một biểu thức hàm (function
>   expression) thì **mỗi lần được thực thi sẽ tạo ra một function object hoàn toàn mới**, giống hệt
>   việc `const arr = [1, 2, 3]` bên trong một vòng lặp sẽ tạo ra mảng mới ở mỗi vòng, dù nội dung
>   trông giống hệt nhau.
>
> **Ví von cho dễ nhớ:** hãy tưởng tượng `XeB.prototype.hienThi` giống như **một tấm bảng thông báo
> chung** được dán lên tường đúng 1 lần. Mọi "cư dân" (`b1`, `b2`, ...) khi cần đọc thông báo đều đi
> tới **cùng một tấm bảng vật lý duy nhất** đó để đọc — không ai có bản riêng. Còn `this.hienThi = ...`
> trong constructor của `XeA` giống như **một cái máy photocopy chạy tự động mỗi khi có cư dân mới ra
> đời**: mỗi lần `new XeA(...)` chạy, máy photocopy in ra **một tờ giấy hoàn toàn mới** (dù nội dung
> chữ in giống hệt tờ trước) và nhét riêng vào túi của cư dân đó. Hai tờ giấy nhìn giống nhau (cùng
> nội dung `return this.ten`), nhưng chúng là **hai vật thể vật lý khác nhau** — đó chính xác là ý
> nghĩa của `a1.hienThi === a2.hienThi` trả về `false`: JS không so sánh "nội dung trông giống nhau
> không", mà so sánh "có phải cùng một object trong bộ nhớ hay không".

> **Giải thích đúng ý 3:** Đây là bài học cốt lõi của cả bài — nếu `XeA` tạo ra **10.000 instance**,
> JavaScript sẽ cấp phát **10.000 function object riêng biệt** cho `hienThi` (tốn bộ nhớ tuyến tính
> theo số instance), trong khi `XeB` chỉ tốn bộ nhớ cho **đúng 1 function** trên `XeB.prototype`, dùng
> chung cho toàn bộ 10.000 instance. Đây chính xác là lý do vì sao quy tắc chung là **luôn đặt method
> lên `.prototype`** (hoặc dùng `class`, vốn tự động làm điều này), không gán `this.method = ...` bên
> trong constructor trừ khi có lý do đặc biệt (ví dụ cần method riêng biệt cho từng instance để
> `bind` sẵn).

------------------------------------------------------------------------

## Bài 4 - class, extends, super

``` javascript
class Employee {
    constructor(ten, luong) {
        this.ten = ten;
        this.luong = luong;
    }
    thongTin() {
        return `${this.ten}: ${this.luong}`;
    }
}

class Manager extends Employee {
    constructor(ten, luong, phongBan) {
        super(ten, luong);
        this.phongBan = phongBan;
    }
    thongTin() {
        return `${super.thongTin()} (${this.phongBan})`;
    }
}

const m = new Manager("Sơn", 2000, "IT");
console.log(m.thongTin());
```

**Câu hỏi**
1. `m.thongTin()` in ra gì?
2. Nếu bỏ dòng `super(ten, luong)` trong constructor của `Manager`, điều gì xảy ra khi chạy
   `new Manager(...)`?
3. `super.thongTin()` trong `Manager.thongTin()` gọi tới method nào, của class nào?

**Trả lời của bạn:**

1. In ra `"Sơn: 200 (IT)"`.
2. Lỗi vì `Employee` không có giá trị khởi tạo trong constructor.
3. Gọi đến method `thongTin` trong class `Employee`.

> **Chấm điểm: 7/10**
>
> - ⚠️ **Ý 1** — Đúng ý nhưng gõ nhầm số: `luong = 2000`, nên kết quả đúng là `"Sơn: 2000 (IT)"` (thiếu
>   một số `0`).
> - ⚠️ **Ý 2** — Đúng là **có lỗi**, nhưng sai lý do. Lỗi không phải vì "`Employee` không có giá trị
>   khởi tạo" — `Employee` vẫn nhận đủ tham số bình thường. Lỗi thật sự là:
>   `ReferenceError: Must call super constructor in derived class before accessing 'this' or
>   returning from derived constructor`.
> - ✅ **Ý 3** — Đúng: `super.thongTin()` gọi thẳng tới `Employee.prototype.thongTin`, bỏ qua bản
>   override của `Manager`.
>
> **Giải thích đúng ý 2:** Đây là một **quy tắc cứng của JS**, không liên quan tới việc `Employee` cần
> tham số gì: bất kỳ class nào dùng `extends` đều **bắt buộc phải gọi `super(...)` trước khi đụng tới
> `this`** trong constructor của nó (kể cả chỉ để đọc, không phải chỉ để gán). Lý do sâu hơn: khi có
> `extends`, JS **không tự tạo `this` cho class con** như constructor function thường — `this` chỉ
> thực sự được khởi tạo **sau khi** `super()` chạy xong (vì `super()` chính là bước tạo object bằng
> constructor của class cha). Dùng `this.phongBan = phongBan` trước khi gọi `super(...)` nghĩa là dùng
> `this` khi nó **chưa tồn tại** → ném lỗi ngay lập tức, không phải vì thiếu tham số cho `Employee`.

------------------------------------------------------------------------

## Bài 5 - instanceof qua nhiều cấp

``` javascript
class A {}
class B extends A {}
class C extends B {}

const c = new C();

console.log(c instanceof C);
console.log(c instanceof B);
console.log(c instanceof A);
console.log(c instanceof Object);

const obj = Object.create(null);
console.log(obj instanceof Object);
```

**Câu hỏi**
1. Bốn dòng log đầu (`c instanceof ...`) in ra gì? Vì sao `c instanceof A` vẫn đúng dù `A` không phải
   class cha trực tiếp?
2. `obj instanceof Object` in ra gì? Vì sao `Object.create(null)` lại cho kết quả khác với object bình
   thường?

**Trả lời của bạn:**

1.
   - `c instanceof C` → in ra `true`
   - `c instanceof B` → in ra `true`
   - `c instanceof A` → in ra `true`
   - `c instanceof Object` → in ra `true`
2. In ra `true`. `Object.create(null)` cho kết quả khác với object bình thường vì `Object.create` tạo
   ra một object null có prototype.

> **Chấm điểm: 6/10**
>
> - ⚠️ **Ý 1** — Bốn giá trị đều đúng, nhưng câu hỏi còn hỏi thêm "**vì sao** `c instanceof A` vẫn đúng
>   dù `A` không phải class cha trực tiếp" — phần này chưa được trả lời.
> - ❌ **Ý 2** — Sai giá trị: `obj instanceof Object` thực ra là **`false`**, không phải `true`.
>
> **Giải thích đúng ý 1 (phần thiếu):** `instanceof` không kiểm tra "class cha trực tiếp" mà kiểm tra
> xem `Fn.prototype` có nằm **ở bất kỳ đâu** trên toàn bộ prototype chain của object hay không, đi
> tới tận `null`. Chain của `c` là: `c → C.prototype → B.prototype → A.prototype → Object.prototype →
> null`. Vì `extends` nối các `.prototype` lại với nhau thành một chuỗi liên tục, `A.prototype` vẫn
> xuất hiện trên chain đó dù `A` là class "ông" chứ không phải "cha" trực tiếp của `c` — nên
> `c instanceof A` vẫn `true`.
>
> **Giải thích đúng ý 2:** `Object.create(null)` tạo ra object có `[[Prototype]]` = **`null` thật sự**
> — nghĩa là **không kế thừa gì cả**, kể cả từ `Object.prototype`. Chain của `obj` chỉ có đúng 1 mắt xích:
> `obj → null`, không hề chứa `Object.prototype` ở đâu trên đó. Vì `instanceof Object` bản chất là kiểm
> tra "`Object.prototype` có nằm trên chain của `obj` không", mà chain của `obj` rỗng hoàn toàn, nên
> kết quả là `false`. Đây là điểm khác biệt cốt lõi: object literal `{}` luôn có prototype mặc định là
> `Object.prototype` (nên `{} instanceof Object` = `true`), còn `Object.create(null)` là cách DUY NHẤT
> để tạo ra một object hoàn toàn "trần", đứng ngoài toàn bộ prototype chain thông thường (xem thêm
> phần Bonus của bài này).

------------------------------------------------------------------------

## Bài 6 - static có được kế thừa không?

``` javascript
class Counter {
    static count = 0;
    static increment() {
        Counter.count++;
        return Counter.count;
    }
}

class SubCounter extends Counter {}

console.log(SubCounter.increment());
console.log(SubCounter.increment());
console.log(Counter.count);

const sc = new SubCounter();
console.log(typeof sc.increment);
```

**Câu hỏi**
1. Hai lần gọi `SubCounter.increment()` in ra gì?
2. `Counter.count` sau đó in ra gì? Điều này cho thấy static member có được chia sẻ/kế thừa qua
   `extends` hay không?
3. `typeof sc.increment` in ra gì? Vì sao static method không gọi được qua instance?


**Trả lời của bạn:**

1. In ra `0` và `1`.
2. In ra `1`, điều này cho thấy static member có được chia sẻ/kế thừa qua `extends`.
3. In ra `static function`, static method không gọi được qua instance vì static để xác định biến,
   function có thể truy cập từ ngoài mà không cần khởi tạo.

> **Chấm điểm: 3/10**
>
> - ❌ **Ý 1** — Sai giá trị: hai lần gọi in ra `1` và `2`, không phải `0` và `1`.
> - ❌ **Ý 2** — Sai giá trị: `Counter.count` cuối cùng là `2`, không phải `1`. Kết luận "static được
>   chia sẻ/kế thừa qua `extends`" thì **đúng hướng**, nhưng số liệu dẫn chứng sai.
> - ❌ **Ý 3** — Sai giá trị: `typeof sc.increment` là **`"undefined"`** — `typeof` chỉ trả về một
>   trong các chuỗi cố định (`"function"`, `"undefined"`, `"object"`, `"number"`...), không có kết quả
>   nào tên `"static function"` cả.
>
> **Giải thích đúng:**
> - `Counter.count = 0` lúc khởi tạo. Mỗi lần `SubCounter.increment()` chạy, nó thực thi
>   `Counter.count++` (vì `increment` được định nghĩa trên `Counter`, thân hàm luôn cộng vào
>   `Counter.count`, không phải "count của class gọi nó") → lần 1: `0 → 1`, trả về `1`; lần 2:
>   `1 → 2`, trả về `2`. Vậy hai lần log là `1` rồi `2`, và `Counter.count` cuối cùng là `2`.
> - Vì sao `SubCounter.increment` gọi được dù `SubCounter` không tự định nghĩa nó: `extends` không chỉ
>   nối `.prototype` của các **instance**, mà còn nối cả **chính các class/constructor function với
>   nhau** — cụ thể `Object.getPrototypeOf(SubCounter) === Counter`. Nhờ vậy static member cũng đi qua
>   đúng cơ chế prototype chain lookup (giống hệt Ví dụ 1 buổi sáng), chỉ là chain này nằm ở "tầng
>   class" chứ không phải "tầng instance".
> - `sc` là một **instance**, không phải class. `increment` chỉ tồn tại trên `Counter` (class), hoàn
>   toàn không có mặt trên `Counter.prototype` (nơi các instance đi tìm method) — nên
>   `typeof sc.increment` = `"undefined"`, không tìm thấy gì cả. Đây chính là ranh giới quan trọng cần
>   nhớ: static sống ở "tầng class-với-class", instance method sống ở "tầng instance-với-prototype" —
>   hai chain hoàn toàn tách biệt.

------------------------------------------------------------------------

## Bài 7 - Getter/setter và shadowing

``` javascript
class Vuong {
    constructor(canh) {
        this.canh = canh;
    }
    get dienTich() {
        return this.canh * this.canh;
    }
}

const v = new Vuong(4);
console.log(v.dienTich);

v.canh = 10;
console.log(v.dienTich);

v.dienTich = 999;
console.log(v.dienTich);
```

**Câu hỏi**
1. `v.dienTich` lần đầu in ra gì?
2. Sau khi đổi `v.canh = 10`, `v.dienTich` in ra gì? Vì sao getter luôn "tính lại" thay vì trả giá trị
   cũ?
3. Dòng `v.dienTich = 999` xảy ra chuyện gì? `v.dienTich` sau đó có bằng `999` không? Vì sao?

**Trả lời của bạn:**

1. In ra `16`.
2. In ra `100`, vì getter sinh ra để làm việc đó.
3. Lỗi function không tồn tại, `v.dienTich` không bằng `999` vì không có function setter.

> **Chấm điểm: 7/10**
>
> - ✅ **Ý 1** — Đúng: `16`.
> - ✅ **Ý 2** — Đúng kết quả: `100`. Lý do có thể nói rõ hơn: `get dienTich()` là một hàm chạy lại
>   **mỗi lần truy cập**, luôn đọc `this.canh` **hiện tại** tại thời điểm gọi — nó không lưu kết quả cũ
>   lại, nên đổi `canh` thì lần đọc `dienTich` tiếp theo tự động phản ánh giá trị mới.
> - ❌ **Ý 3** — Sai phần "lỗi": dòng `v.dienTich = 999` **không** ném lỗi nào cả trong trường hợp này,
>   nó chạy êm và bị **âm thầm bỏ qua**. Kết luận `v.dienTich` không bằng `999` thì đúng.
>
> **Giải thích đúng ý 3:** Khi một property chỉ có `get` mà không có `set`, hành vi khi gán phụ thuộc
> vào **strict mode hay không**:
> - Ở **sloppy mode** (code JS bình thường ngoài `class`, không có `"use strict"`, không phải ES
>   module) — đúng như file `.js` này khi chạy trực tiếp bằng Node kiểu CommonJS — phép gán
>   `v.dienTich = 999` bị **âm thầm bỏ qua**, không lỗi, không cảnh báo. `v.dienTich` sau đó vẫn là
>   `100` (tính lại từ `this.canh = 10`).
> - Nếu đoạn gán đó nằm trong **strict mode** (ví dụ bên trong một `class` khác, hoặc file có
>   `"use strict"`/là ES module), nó **sẽ** ném lỗi:
>   `TypeError: Cannot set property dienTich of #<Vuong> which has only a getter`.
>
> Đây là lý do nên cẩn thận với việc chỉ khai `get` mà quên `set`: nếu code gọi ở sloppy mode, một lỗi
> logic (gán nhầm vào property chỉ-đọc) sẽ **trôi qua trong im lặng** thay vì báo lỗi ngay, rất khó
> phát hiện khi debug.

------------------------------------------------------------------------

## Bài 8 - Object.create + quên gán lại `.constructor`

``` javascript
function Shape(ten) {
    this.ten = ten;
}

function Circle(ten, r) {
    Shape.call(this, ten);
    this.r = r;
}
Circle.prototype = Object.create(Shape.prototype);
// (cố tình thiếu dòng: Circle.prototype.constructor = Circle;)

const c = new Circle("Circle", 5);

console.log(c instanceof Circle);
console.log(c instanceof Shape);
console.log(c.constructor === Circle);
console.log(c.constructor === Shape);
console.log(c.constructor.name);
```

**Câu hỏi**
1. `c instanceof Circle` và `c instanceof Shape` in ra gì?
2. `c.constructor === Circle` và `c.constructor === Shape` in ra gì? Vì sao thiếu một dòng code lại
   gây ra kết quả này?
3. `c.constructor.name` in ra gì? Nêu 1 tình huống thực tế mà lỗi thiếu dòng này gây hậu quả (gợi ý:
   code nào đó dùng `obj.constructor` để tạo instance mới).

**Trả lời của bạn:**

1. `c instanceof Circle` in ra `true`, `c instanceof Shape` in ra `false`.
2. `c.constructor === Circle` và `c.constructor === Shape` đều in ra `false` vì chưa được gán
   `constructor`.
3. *(chưa trả lời)*

> **Chấm điểm: 3/10**
>
> - ❌ **Ý 1** — Sai một nửa: `c instanceof Shape` thực ra vẫn là **`true`**, không phải `false`. Đây
>   là điểm quan trọng nhất của cả bài — dễ nhầm nhất.
> - ⚠️ **Ý 2** — Sai một nửa: `c.constructor === Circle` đúng là `false`, nhưng
>   `c.constructor === Shape` lại là **`true`** (không phải `false`).
> - ⬜ **Ý 3** — Chưa trả lời. Đáp án: `c.constructor.name` in ra `"Shape"` (vì `c.constructor ===
>   Shape` như ở ý 2) — xem tình huống thực tế bị ảnh hưởng ở cuối phần giải thích bên dưới.
>
> **Giải thích đúng (mấu chốt của cả bài):** `instanceof` và `.constructor` là **hai cơ chế độc lập
> nhau**, dựa trên hai nguồn khác nhau:
> - `instanceof` chỉ quan tâm **prototype chain thật sự** của object, không quan tâm property
>   `.constructor` chứa gì. Dòng `Circle.prototype = Object.create(Shape.prototype)` đã nối đúng chain
>   rồi: `c → Circle.prototype → Shape.prototype → Object.prototype`. Vì vậy dù thiếu dòng gán
>   `.constructor`, `c instanceof Shape` **vẫn đúng** — chain vẫn nguyên vẹn.
> - `.constructor` chỉ là **một property bình thường** nằm trên `.prototype`, được JS tự động gán mặc
>   định (`Fn.prototype.constructor = Fn`) — và property này **bị mất** khi ta ghi đè cả
>   `Circle.prototype` bằng `Object.create(Shape.prototype)` (object mới này không tự có
>   `.constructor` trỏ về `Circle`). Vì `c` không có own `.constructor`, JS đi tìm lên chain và gặp
>   `Shape.prototype.constructor = Shape` trước tiên → `c.constructor === Shape` là `true`,
>   `c.constructor === Circle` là `false`.
>
> Nói ngắn gọn: **quên gán lại `.constructor` không phá vỡ `instanceof`**, nó chỉ khiến
> `instance.constructor` trỏ nhầm sang class cha. Tình huống thực tế bị ảnh hưởng: code kiểu
> `new obj.constructor(...)` (factory pattern dùng `.constructor` để tạo instance "cùng loại") sẽ vô
> tình tạo ra một `Shape` thay vì một `Circle` mới — bug rất khó phát hiện vì `instanceof` vẫn báo
> đúng bình thường.

------------------------------------------------------------------------

## Bài 9 - Shadowing với reference type trên prototype (bẫy hay gặp)

``` javascript
function Gio() {}
Gio.prototype.mon = []; // mảng nằm trên prototype, KHÔNG phải trong constructor

const g1 = new Gio();
const g2 = new Gio();

g1.mon.push("Toan");

console.log(g1.mon);
console.log(g2.mon);
console.log(g1.mon === g2.mon);
```

**Câu hỏi**
1. `g1.mon` sau khi `push` in ra gì?
2. `g2.mon` in ra gì? Vì sao thao tác trên `g1` lại ảnh hưởng tới `g2` — khác gì với Bài 1 của bộ bài
   tập `this` (nơi gán lại giá trị trên instance không ảnh hưởng tới object khác)?
3. So sánh `push` (method biến đổi mảng tại chỗ) với việc gán `g1.mon = [...]` (gán lại tham chiếu
   mới) — hai thao tác này có cùng ảnh hưởng tới `g2.mon` không?

**Trả lời của bạn:**

1. In ra 1 mảng có 1 phần tử là `"Toan"`.
2. *(chưa trả lời)*
3. *(chưa trả lời)*

> **Chấm điểm: 3/10**
>
> - ✅ **Ý 1** — Đúng: `g1.mon` = `["Toan"]`.
> - ⬜ **Ý 2** — Chưa trả lời.
> - ⬜ **Ý 3** — Chưa trả lời.
>
> **Giải thích đúng ý 2:** `g2.mon` cũng in ra `["Toan"]` — **cùng bị ảnh hưởng**, dù ta chỉ `push` vào
> `g1.mon`. Lý do: `Gio.prototype.mon = []` chỉ tạo ra **đúng một mảng duy nhất**, nằm trên
> `Gio.prototype`. Cả `g1` và `g2` đều **không có own property `mon`** — khi viết `g1.mon`, JS đi lên
> chain và trả về **CHÍNH mảng đó trên prototype** (không phải bản copy). `push()` là method **biến
> đổi mảng tại chỗ** (mutate) chứ không tạo mảng mới, nên nó sửa trực tiếp cái mảng dùng chung đó — và
> vì `g2.mon` cũng trỏ tới đúng mảng ấy, `g2.mon` thấy ngay sự thay đổi. `g1.mon === g2.mon` là `true`.
>
> Khác với Bài 1 của bộ bài tập `this` (`nguoi.chao = ...` gán một **giá trị mới** cho property, tạo
> own property mới, không đụng gì tới object khác): ở đây `push` **không gán lại `g1.mon`**, nó chỉ
> "vào bên trong" mảng có sẵn và sửa nó — nên hoàn toàn không tạo own property nào trên `g1`, vẫn đọc
> chung mảng trên prototype như cũ.
>
> **Giải thích đúng ý 3:** Nếu thay `push` bằng `g1.mon = ["Toan"]` (gán lại toàn bộ property), hành vi
> sẽ khác hẳn: dòng đó tạo ra một **own property `mon` mới trên `g1`**, trỏ tới **một mảng hoàn toàn
> mới** — không còn liên quan gì tới mảng gốc trên `Gio.prototype` nữa (giống hệt cơ chế shadowing đã
> thấy ở Bài 1, Bài 2 của bộ bài này). Lúc đó `g2.mon` **sẽ không đổi**, vẫn là mảng rỗng gốc trên
> prototype. Bài học chung: **mutate (sửa tại chỗ)** một reference type nằm trên prototype ảnh hưởng
> tới mọi instance dùng chung nó; còn **gán lại (reassign)** chỉ ảnh hưởng tới riêng instance đó (vì
> nó tạo own property mới, che prototype đi).

------------------------------------------------------------------------

## Bài 10 - class vs constructor function: cùng kết quả

``` javascript
class Person {
    constructor(ten) {
        this.ten = ten;
    }
    hello() {
        return `Hi, ${this.ten}`;
    }
}

function PersonF(ten) {
    this.ten = ten;
}
PersonF.prototype.hello = function () {
    return `Hi, ${this.ten}`;
};

const p1 = new Person("Sơn");
const p2 = new PersonF("Sơn");

console.log(Object.getPrototypeOf(p1) === Person.prototype);
console.log(Object.getPrototypeOf(p2) === PersonF.prototype);
console.log(typeof Person);
console.log(typeof PersonF);
console.log(p1.hello());
console.log(p2.hello());
```

**Câu hỏi**
1. Hai dòng `Object.getPrototypeOf(...)` in ra gì?
2. `typeof Person` và `typeof PersonF` in ra gì? Điều này chứng minh điều gì về bản chất của `class`?
3. Kể 2 điểm khác biệt (không phải về kết quả runtime, mà về mặt cú pháp/an toàn) giữa viết bằng
   `class` và viết bằng constructor function thuần.

**Trả lời của bạn:** *(chưa trả lời)*

> **Chấm điểm: 0/10** (chưa trả lời)
>
> **Đáp án:**
> 1. Cả hai đều in ra `true`: `p1` được tạo bằng `new Person(...)` nên
>    `Object.getPrototypeOf(p1) === Person.prototype`; tương tự `p2` với `PersonF.prototype`. Cả
>    `p1.hello()` và `p2.hello()` đều in ra `"Hi, Sơn"`.
> 2. Cả `typeof Person` và `typeof PersonF` đều in ra `"function"`. Điều này chứng minh trực tiếp điều
>    đã học ở Ví dụ 4 buổi sáng: **`class` không phải một kiểu dữ liệu/cơ chế mới trong JS engine** —
>    nó biên dịch xuống đúng một `function` với `.prototype`, y hệt constructor function viết tay.
> 3. Hai điểm khác biệt thật sự (không phải runtime, mà cú pháp/an toàn):
>    - **Bắt buộc `new`:** gọi `Person()` (thiếu `new`) sẽ ném lỗi ngay
>      (`TypeError: Class constructor Person cannot be invoked without 'new'`), còn gọi
>      `PersonF()` thiếu `new` vẫn "chạy được" (standalone), gây lỗi kiểu Bài 2 của bộ bài `this` (rò
>      rỉ `this` ra global object) — `class` tự bảo vệ khỏi lỗi này, `function` thì không.
>    - **Strict mode mặc định:** toàn bộ code bên trong thân `class` (constructor lẫn method) luôn tự
>      động chạy ở strict mode dù file không khai `"use strict"`, còn constructor function thường thì
>      không — đây chính là lý do Bonus của bộ bài tập `this` trước có TypeError khi tách method ra
>      gọi standalone.

------------------------------------------------------------------------

# Bonus

``` javascript
const rawObj = Object.create(null);
rawObj.ten = "test";

console.log(rawObj.ten);
console.log(rawObj.toString);
console.log(rawObj instanceof Object);

try {
    console.log(rawObj.hasOwnProperty("ten"));
} catch (e) {
    console.log("Loi:", e.message);
}
```

**Câu hỏi**
1. `rawObj.toString` in ra gì? Vì sao khác với một object bình thường như `{}`?
2. `rawObj instanceof Object` in ra gì?
3. Dòng `rawObj.hasOwnProperty("ten")` chạy được hay ném lỗi? Giải thích bằng khái niệm prototype
   chain đã học ở đầu ngày.

**Trả lời của bạn:** *(chưa trả lời)*

> **Chấm điểm: 0/10** (chưa trả lời)
>
> **Đáp án:**
> 1. `rawObj.toString` in ra `undefined`. Object bình thường như `{}` có `[[Prototype]]` =
>    `Object.prototype`, nơi định nghĩa sẵn `toString`, `hasOwnProperty`, `valueOf`... — mọi object
>    literal đều "thừa hưởng" bộ method này miễn phí. Còn `rawObj = Object.create(null)` có
>    `[[Prototype]]` = `null` thật sự (giống `obj` ở Bài 5), nên chain của nó chỉ có `rawObj → null` —
>    không hề đi qua `Object.prototype`, nên không có bất kỳ method nào trong số đó.
> 2. `rawObj instanceof Object` in ra `false`, cùng lý do với Bài 5: `Object.prototype` không nằm trên
>    chain của `rawObj`.
> 3. **Ném lỗi**: `TypeError: rawObj.hasOwnProperty is not a function`. Vì `hasOwnProperty` không phải
>    "phép thuật" gắn liền với mọi object — nó chỉ là một **method bình thường sống trên
>    `Object.prototype`**, được tìm thấy qua đúng cơ chế tra cứu prototype chain học ở Ví dụ 1 sáng nay.
>    `rawObj` không có nó trên chính nó, và chain của nó dừng ngay ở `null` mà không đi qua
>    `Object.prototype`, nên JS không tìm thấy `hasOwnProperty` ở đâu cả → gọi nó y hệt gọi một hàm
>    không tồn tại.
>
> **Lưu ý thực tế:** `Object.create(null)` hay dùng để tạo object làm "dictionary/map thuần" (ví dụ
> đếm tần suất từ), tránh nguy cơ đụng độ với các key trùng tên method có sẵn như `toString`,
> `constructor`... Nhưng đổi lại phải cẩn thận: mọi helper quen thuộc trên `Object.prototype` đều biến
> mất, muốn kiểm tra own property phải dùng `Object.hasOwn(rawObj, "ten")` (API mới) hoặc
> `Object.prototype.hasOwnProperty.call(rawObj, "ten")` thay vì gọi trực tiếp trên `rawObj`.

------------------------------------------------------------------------

# Tổng kết điểm

| Bài | Điểm | Ghi chú ngắn |
|---|---|---|
| 1 | 5/10 | Ý 3 sai giá trị + nhầm quan hệ prototype giữa `a`, `b`, `c` |
| 2 | 5/10 | Hiểu nhầm gán `p1.greet` sửa luôn prototype dùng chung |
| 3 | 4/10 | Sai đúng trọng tâm bài: nghĩ method trong constructor cũng dùng chung như trên prototype |
| 4 | 7/10 | Đúng kết quả, chỉ sai lý do "thiếu `super()`" và gõ nhầm số |
| 5 | 6/10 | Đúng `instanceof` qua nhiều cấp, sai `Object.create(null) instanceof Object` |
| 6 | 3/10 | Toàn bộ giá trị số sai (đếm nhầm `count`), `typeof` trả nhầm |
| 7 | 7/10 | Đúng giá trị, sai bản chất "lỗi" khi gán vào property chỉ có getter |
| 8 | 3/10 | **Nhầm lẫn cốt lõi:** tưởng thiếu `.constructor` làm hỏng luôn `instanceof` |
| 9 | 3/10 | Đúng ý 1, bỏ trống ý 2 và 3 (mutate vs reassign trên reference type) |
| 10 | 0/10 | Chưa trả lời |
| Bonus | 0/10 | Chưa trả lời |

**Tổng: 43/100 (~4.3/10)** cho 10 bài chính.

**Cần ôn lại:** điểm yếu rõ nhất là phân biệt **"cùng tham chiếu tới 1 thứ" vs "tạo mới/che khuất"**:
- Đọc/gọi qua prototype chain = dùng chung 1 bản duy nhất (Bài 2, 3, 6, 9 phần mutate).
- Gán trực tiếp lên instance (`obj.x = ...`) = luôn tạo own property MỚI, chỉ ảnh hưởng riêng instance
  đó, không đụng gì tới prototype (Bài 1, Bài 2 phần gán lại, Bài 9 phần reassign).
- `instanceof` và `.constructor` là hai cơ chế tách biệt — đừng suy luận cái này từ cái kia (Bài 8).

Nên làm lại Bài 3, 6, 8 trước — đây là ba bài mà câu trả lời đi ngược hẳn với bản chất cơ chế, không
chỉ là nhầm lẫn số liệu nhỏ như Bài 4 hay Bài 7.
