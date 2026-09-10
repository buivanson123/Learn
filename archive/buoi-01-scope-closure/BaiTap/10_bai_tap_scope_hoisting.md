# 10 Bài tập JavaScript - Scope và Hoisting

> **Quy tắc:** Không chạy code ngay. Hãy tự dự đoán kết quả hoặc lỗi,
> sau đó giải thích vì sao.

## Bài 1 - Global Scope

``` javascript
const name = "Son";

function hello() {
    console.log(name);
}

hello();
```

**Câu hỏi** 1. In ra gì? 2. `hello()` tìm `name` ở đâu?
1. in ra Sơn
2. hello tìm name trong bộ nhớ

------------------------------------------------------------------------

## Bài 2 - Function Scope

``` javascript
function test() {
    let age = 25;
}

console.log(age);
```

**Câu hỏi** 1. In ra gì? 2. Vì sao?
1. in ra lỗi "age is not defined"
2. vì let là block scope, được khai báo trong functon test
nên console.log(age); không gọi được

------------------------------------------------------------------------

## Bài 3 - Block Scope

``` javascript
if (true) {
    let a = 10;
    var b = 20;
}

console.log(a);
console.log(b);
```

**Câu hỏi** 1. Dòng nào báo lỗi? 2. Dòng nào chạy được? 3. Giải thích sự
khác nhau giữa `let` và `var`.
1. console.log(a); báo lỗi "a is not defined"
2. console.log(b); chạy ra 20

3. let là block scope, được hoisting nhưng chưa được gán giá trị
var là function scope, được hoisting và có giá trị mặc định là undfined

------------------------------------------------------------------------

## Bài 4 - Shadowing

``` javascript
let color = "red";

function change() {
    let color = "blue";
    console.log(color);
}

change();

console.log(color);
```

**Câu hỏi** 1. Kết quả là gì? 2. Có phải `color` bị overwrite không?
1. console.log đầu tiên ra blue, console.log tiếp theo ra red
2. `color` không bị overwrite, vì color trong function change là block scope nên đã được khởi tạo mới
mặc dù có tên giống nhau nhưng color trong scope function và color globa không liên quan gì đến nhau

------------------------------------------------------------------------

## Bài 5 - Lexical Scope

``` javascript
const x = 1;

function outer() {
    const y = 2;

    function inner() {
        console.log(x);
        console.log(y);
    }

    inner();
}

outer();
```

**Câu hỏi** 1. `inner()` tìm `x` theo thứ tự nào? 2. `inner()` tìm `y`
theo thứ tự nào?
1. Inner Scope
    ↓
Outer Scope
    ↓
Global Scope
2. 
Inner Scope
    ↓
Outer Scope

------------------------------------------------------------------------

## Bài 6 - Hoisting với `var`

``` javascript
console.log(a);

var a = 100;

console.log(a);
```

**Câu hỏi** 1. Hai lần `console.log` in gì? 2. JavaScript đã hoisting
như thế nào?

1. lần đầu ra undfined
lần thứ 2 ra 100
2. vì a là var nên sẽ được hoisting trước
js sẽ hoisting như sau:
var a;
console.log(a);
a = 100;
console.log(b);
------------------------------------------------------------------------

## Bài 7 - Hoisting với `let`

``` javascript
console.log(a);

let a = 100;
```

**Câu hỏi** 1. Kết quả? 2. Đây là `undefined` hay `ReferenceError`? 3.
Tại sao?
1. lỗi
2. ReferenceError
3. a được hoisting nhưng chưa được gán giá trị vì đang ở trong TDZ

------------------------------------------------------------------------

## Bài 8 - Function Declaration và Function Expression

``` javascript
sayHello();

function sayHello() {
    console.log("Hello");
}

sayHi();

var sayHi = function () {
    console.log("Hi");
};
```

**Câu hỏi** 1. `sayHello()` có chạy không? 2. `sayHi()` có chạy không?
3. Nếu lỗi thì là lỗi gì?

1. sayHello chạy được
vì javascript luôn ưu tiên hoisting function trước
2. sayHi không chạy được vì lúc này nó là expresstion function, lúc này nó được hoisting giống như một biến bình thường
ở đây là var thì sẽ có giá trị là undfine => khi gọi sayHi() 
3. sẽ báo lỗi not a function


------------------------------------------------------------------------

## Bài 9 - Scope Chain

``` javascript
const a = 1;

function first() {
    const b = 2;

    function second() {
        const c = 3;

        console.log(a);
        console.log(b);
        console.log(c);
    }

    second();
}

first();
```

**Câu hỏi** 1. `second()` tìm `a` theo thứ tự nào? 2. `second()` tìm `b`
theo thứ tự nào? 3. `second()` tìm `c` theo thứ tự nào?

1. từ trong ra ngoài second -> first -> ngoài cùng -> tìm được a
2. từ trong ra ngoài second -> first -> tìm được b
2. từ trong ra ngoài second -> tìm được ngay trong function second

------------------------------------------------------------------------

## Bài 10 - Tổng hợp Scope + Hoisting

``` javascript
var x = 1;

function test() {
    console.log(x);

    var x = 2;

    console.log(x);
}

test();

console.log(x);
```

**Câu hỏi** 1. In ra mấy dòng? 2. Mỗi dòng là gì? 3. Vì sao
`console.log(x)` đầu tiên trong `test()` không in `1`?

1. in ra 3 dong
2. 2, 2, 1
3. vì hoisting đã đẩy var x = 2 lên trước console.log đầu tiên

------------------------------------------------------------------------

# Bonus

``` javascript
let x = 10;

function outer() {
    console.log(x);

    let x = 20;

    function inner() {
        console.log(x);
    }

    inner();
}

outer();
```

**Câu hỏi** 1. Có in ra `10` không? 2. Có in ra `20` không? 3. Báo lỗi ở
dòng nào? 4. Giải thích bằng Scope + Hoisting + TDZ.
1. có
2. có
3.
báo lỗi ở dòng let x = 20; vì let không khai báo lại được