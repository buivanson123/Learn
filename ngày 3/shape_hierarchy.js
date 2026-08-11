// ===================================================================
// CHIỀU (4h) - Thực hành: cùng 1 phân cấp Shape -> Rect -> Square,
// dựng 2 lần bằng 2 cách khác nhau, rồi so sánh.
// ===================================================================

// ===================================================================
// BƯỚC 1: Xây phân cấp bằng `class`
// - Shape: field `name`, method area() mặc định trả 0.
// - Rect extends Shape: override area() = w * h.
// - Square extends Rect: constructor chỉ nhận 1 cạnh, gọi super với
//   cạnh đó dùng "đôi" (vừa là w vừa là h) vì hình vuông có 4 cạnh bằng
//   nhau -> tái dùng nguyên logic area() của Rect mà không cần override.
// ===================================================================
class Shape {
    constructor(name) {
        this.name = name;
    }
    area() {
        return 0;
    }
}

class Rect extends Shape {
    constructor(name, w, h) {
        super(name);
        this.w = w;
        this.h = h;
    }
    area() {
        return this.w * this.h;
    }
}

class Square extends Rect {
    constructor(canh) {
        super("Square", canh, canh); // truyền cạnh "đôi": vừa w vừa h
    }
}

// ===================================================================
// BƯỚC 2: Dựng lại ĐÚNG phân cấp trên bằng Object.create + constructor
// function thuần - không dùng `class`/`extends`/`super` chút nào.
//
// Cách nối chain thủ công:
//   Child.prototype = Object.create(Parent.prototype)
//   Child.prototype.constructor = Child  // sửa lại .constructor bị mất
//
// Vì Object.create(Parent.prototype) tạo ra một object MỚI có
// [[Prototype]] = Parent.prototype, rồi ta gán object đó làm
// Child.prototype -> Child.prototype giờ nằm trên chain ngay dưới
// Parent.prototype. Nhưng thao tác gán đè này làm Child.prototype mất
// property .constructor mặc định (vốn tự động trỏ về Child) -> phải
// gán lại tay, nếu không code khác dựa vào instance.constructor sẽ trỏ
// nhầm sang Parent.
// ===================================================================
function ShapeF(name) {
    this.name = name;
}
ShapeF.prototype.area = function () {
    return 0;
};

function RectF(name, w, h) {
    ShapeF.call(this, name); // gọi "constructor cha" thủ công (tương đương super(name))
    this.w = w;
    this.h = h;
}
RectF.prototype = Object.create(ShapeF.prototype); // nối chain: RectF.prototype -> ShapeF.prototype
RectF.prototype.constructor = RectF;                // sửa lại .constructor
RectF.prototype.area = function () {
    return this.w * this.h;
};

function SquareF(canh) {
    RectF.call(this, "Square", canh, canh); // tương đương super("Square", canh, canh)
}
SquareF.prototype = Object.create(RectF.prototype); // nối chain: SquareF.prototype -> RectF.prototype
SquareF.prototype.constructor = SquareF;
// Square không override area() ở cả 2 cách -> tự động dùng area() của Rect qua prototype chain.

// ===================================================================
// BƯỚC 3: Kiểm chứng bằng instanceof + in prototype chain, so sánh
// kết quả giữa 2 cách dựng.
// ===================================================================
const sqClass = new Square(5);
const sqFunc = new SquareF(5);

console.log("--- Cách 1: class ---");
console.log("area:", sqClass.area()); // 25
console.log("instanceof Square:", sqClass instanceof Square); // true
console.log("instanceof Rect:  ", sqClass instanceof Rect);   // true
console.log("instanceof Shape: ", sqClass instanceof Shape);  // true

let p1 = Object.getPrototypeOf(sqClass);
const chain1 = [];
while (p1) {
    chain1.push(p1.constructor.name);
    p1 = Object.getPrototypeOf(p1);
}
console.log("prototype chain:", chain1.join(" -> ")); // Square -> Rect -> Shape -> Object

console.log("--- Cách 2: Object.create + constructor function ---");
console.log("area:", sqFunc.area()); // 25
console.log("instanceof SquareF:", sqFunc instanceof SquareF); // true
console.log("instanceof RectF:  ", sqFunc instanceof RectF);   // true
console.log("instanceof ShapeF: ", sqFunc instanceof ShapeF);  // true

let p2 = Object.getPrototypeOf(sqFunc);
const chain2 = [];
while (p2) {
    chain2.push(p2.constructor.name);
    p2 = Object.getPrototypeOf(p2);
}
console.log("prototype chain:", chain2.join(" -> ")); // SquareF -> RectF -> ShapeF -> Object

// ===================================================================
// SO SÁNH
// ===================================================================
//
// Hai cách cho ra CÙNG MỘT KẾT QUẢ: cùng area() = 25, cùng đúng 3 tầng
// instanceof, cùng chain 4 cấp (Square/SquareF -> Rect/RectF ->
// Shape/ShapeF -> Object). Vì `class` KHÔNG tạo ra cơ chế kế thừa mới -
// nó chỉ là cú pháp gọn hơn cho đúng những gì Bước 2 viết tay.
//
// - class: gọn, `extends` tự nối prototype chain, `super(...)` tự lo
//   gọi constructor cha đúng thứ tự, `.constructor` tự động đúng -
//   không cần nhớ 2 dòng Object.create + gán lại .constructor.
// - Object.create + constructor function: dài hơn, dễ quên bước gán
//   lại .constructor (bug âm thầm hay gặp), nhưng LỘ RÕ cơ chế bên
//   dưới - đây chính là lý do nên học cách này ít nhất một lần: hiểu
//   `class` đang "che giấu" điều gì, để không bị bất ngờ khi gặp code
//   ES5 cũ hoặc khi cần debug sâu vào prototype chain.
