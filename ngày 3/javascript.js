// ===================================================================
// SÁNG (3h) - Prototype, kế thừa nguyên mẫu và class
// Nền tảng của Factory pattern, Prototype pattern và việc mở rộng đối tượng.
// ===================================================================

// ===================================================================
// Ví dụ 1: Prototype chain là gì
// - Mỗi object có một liên kết ẩn [[Prototype]] trỏ tới một object khác
//   (hoặc null). Đọc liên kết này bằng Object.getPrototypeOf(o).
// - Khi truy cập o.prop, JS tra trên CHÍNH o trước; nếu không thấy,
//   ĐI LÊN [[Prototype]] của o, rồi lên tiếp, cho tới khi tìm thấy
//   hoặc chạm null (đỉnh chain) -> đây là "prototype chain".
// - Đây chính là cơ chế JS dùng để CHIA SẺ method giữa nhiều instance:
//   method chỉ tồn tại 1 lần trên prototype, mọi instance đều "nhìn thấy"
//   qua chain, không phải copy riêng cho từng instance.
// ===================================================================
const animal = {
    eat() {
        console.log("dang an");
    }
};

const dog = Object.create(animal); // dog.[[Prototype]] = animal
dog.bark = function () {
    console.log("gau gau");
};

dog.eat();  // "dang an" - không có trên dog, JS đi lên animal để tìm thấy
dog.bark(); // "gau gau" - có ngay trên chính dog

console.log(Object.getPrototypeOf(dog) === animal); // true
console.log(Object.getPrototypeOf(animal));          // Object.prototype
console.log(Object.getPrototypeOf(Object.prototype)); // null - đỉnh chain

// ===================================================================
// Ví dụ 2: Object.create(proto)
// - Tạo ra một object MỚI có [[Prototype]] = proto được truyền vào.
// - Khác với object literal {} (luôn có prototype mặc định là
//   Object.prototype), Object.create cho phép CHỈ ĐỊNH CHÍNH XÁC
//   prototype là gì, kể cả Object.create(null) để tạo object "trần"
//   không kế thừa gì cả.
// - Dùng để nhiều object cùng "mẫu" (template) chia sẻ chung method mà
//   không tốn bộ nhớ copy method cho từng object.
// ===================================================================
const canBay = {
    fly() {
        console.log(`${this.ten} dang bay`);
    }
};

const chim1 = Object.create(canBay);
chim1.ten = "Chim se";

const chim2 = Object.create(canBay);
chim2.ten = "Dai bang";

chim1.fly(); // "Chim se dang bay"
chim2.fly(); // "Dai bang dang bay"
console.log(chim1.fly === chim2.fly); // true - dùng chung 1 hàm duy nhất

// ===================================================================
// Ví dụ 3: Constructor function
// - Hàm thường dùng chung với `new` để tạo nhiều instance có cùng cấu
//   trúc (xem lại Bài 2, 3 ngày trước về cơ chế `new`).
// - Method KHÔNG nên gán trong constructor (this.bark = function(){...})
//   vì mỗi instance sẽ có 1 bản copy riêng, tốn bộ nhớ.
// - Cách đúng: gán method lên Fn.prototype -> mọi instance tạo bằng
//   `new Fn()` đều có [[Prototype]] trỏ tới Fn.prototype, nên dùng
//   chung đúng 1 bản method duy nhất (giống cơ chế Object.create ở trên).
// ===================================================================
function Dog(n) {
    this.n = n;
}
Dog.prototype.bark = function () {
    return this.n;
};

const d1 = new Dog("Mimi");
const d2 = new Dog("Lulu");

console.log(d1.bark()); // "Mimi"
console.log(d2.bark()); // "Lulu"
console.log(d1.bark === d2.bark); // true - chung 1 hàm trên Dog.prototype
console.log(Object.getPrototypeOf(d1) === Dog.prototype); // true

// ===================================================================
// Ví dụ 4: class - cú pháp gọn cho cùng cơ chế prototype
// - class KHÔNG phải một kiểu kế thừa mới, chỉ là cú pháp "đường tắt"
//   (syntactic sugar) cho đúng cơ chế constructor function + prototype
//   ở Ví dụ 3.
// - extends: thiết lập prototype chain giữa class con và class cha.
// - super(...): gọi constructor của class cha (bắt buộc phải gọi
//   trước khi dùng `this` trong constructor con).
// - super.method(): gọi lại method của class cha (khi override nhưng
//   vẫn muốn tái sử dụng logic cha).
// ===================================================================
class Animal {
    constructor(ten) {
        this.ten = ten;
    }
    speak() {
        return `${this.ten} keu`;
    }
}

class Cat extends Animal {
    constructor(ten) {
        super(ten); // gọi Animal.constructor(ten)
    }
    speak() {
        return `${super.speak()} - meo meo`; // tái dùng logic cha
    }
}

const cat = new Cat("Mun");
console.log(cat.speak()); // "Mun keu - meo meo"

// class thực chất vẫn tạo ra function + prototype phía dưới:
console.log(typeof Cat);                              // "function"
console.log(Object.getPrototypeOf(Cat.prototype) === Animal.prototype); // true

// ===================================================================
// Ví dụ 5: instanceof
// - `obj instanceof Fn` kiểm tra xem Fn.prototype có xuất hiện ở BẤT
//   KỲ đâu trên prototype chain của obj hay không (đi lên tới null).
// - Không kiểm tra "kiểu dữ liệu" theo nghĩa thông thường, mà kiểm tra
//   MỐI QUAN HỆ PROTOTYPE.
// ===================================================================
console.log(cat instanceof Cat);    // true - Cat.prototype nằm trên chain
console.log(cat instanceof Animal); // true - Animal.prototype cũng nằm trên chain (qua extends)
console.log(cat instanceof Object); // true - mọi prototype chain đều kết thúc gần Object.prototype
console.log(d1 instanceof Cat);     // false - Cat.prototype không nằm trên chain của d1

// ===================================================================
// Ví dụ 6: Thành viên static
// - Khai báo với từ khóa `static`: thuộc về CHÍNH class/hàm, không
//   thuộc về từng instance -> gọi qua tên class, KHÔNG gọi qua instance.
// - Thường dùng cho hàm tiện ích liên quan tới class nhưng không cần
//   một instance cụ thể nào (factory method, helper, constant...).
// ===================================================================
class NguoiDung {
    constructor(ten) {
        this.ten = ten;
    }
    static tao(ten) {
        return new NguoiDung(ten);
    }
}

const nd = NguoiDung.tao("Sơn"); // gọi qua tên class NguoiDung, không qua instance
console.log(nd.ten); // "Sơn"
console.log(typeof nd.tao); // "undefined" - static KHÔNG có trên instance

// ===================================================================
// Ví dụ 7: Getter / Setter
// - get x() {} và set x(v) {}: khai báo một "thuộc tính truy cập"
//   (accessor property) - đọc/ghi TRÔNG như field bình thường
//   (obj.full, không phải obj.full()) nhưng thực chất chạy một hàm.
// - Hữu ích để tính toán giá trị "ảo" từ field thật, hoặc validate
//   dữ liệu ngay khi gán.
// ===================================================================
class HoTen {
    constructor(ho, ten) {
        this.ho = ho;
        this.ten = ten;
    }
    get full() {
        return `${this.ho} ${this.ten}`;
    }
    set full(value) {
        const parts = value.split(" ");
        this.ten = parts.pop();
        this.ho = parts.join(" ");
    }
}

const hoTen = new HoTen("Nguyen", "Son");
console.log(hoTen.full); // "Nguyen Son" - gọi getter, KHÔNG phải hoTen.full()

hoTen.full = "Tran Van An"; // gọi setter
console.log(hoTen.ho);  // "Tran Van"
console.log(hoTen.ten); // "An"

// ===================================================================
// TỐI (1h) - Ôn tập
// ===================================================================
//
// 1) Thứ tự tra cứu trên prototype chain:
//    obj.prop
//      -> tìm own property trên chính obj trước
//      -> không có thì đi lên Object.getPrototypeOf(obj)
//      -> không có thì đi lên tiếp Object.getPrototypeOf(...) của cấp đó
//      -> lặp lại tới khi tìm thấy, hoặc gặp null thì trả về undefined
//    => luôn dừng ở lần đầu tiên tìm thấy GẦN OBJ NHẤT trên chain,
//       không đi tiếp lên các cấp cao hơn nữa dù chúng cũng có thuộc tính
//       trùng tên.
//
// 2) Thuộc tính trên instance vs trên prototype (shadowing):
//    Nếu instance có OWN property trùng tên với property trên
//    prototype, property trên instance sẽ "che" (shadow) property trên
//    prototype khi ĐỌC - nhưng property gốc trên prototype VẪN CÒN
//    NGUYÊN, không hề bị ghi đè hay mất đi.

const proto = { loai: "dong vat" };
const inst1 = Object.create(proto);
const inst2 = Object.create(proto);

console.log(inst1.loai); // "dong vat" - lấy từ proto (chưa có own property)

inst1.loai = "cho"; // tạo OWN property "loai" trên inst1, không đụng tới proto

console.log(inst1.loai); // "cho" - đọc own property, prototype bị che
console.log(inst2.loai); // "dong vat" - inst2 không có own property, vẫn đọc từ proto
console.log(proto.loai); // "dong vat" - proto hoàn toàn không đổi

// Lỗi hay gặp: tưởng sửa proto.loai khi thực ra chỉ đang tạo thêm 1 own
// property mới trên riêng inst1 - hai biến này độc lập với nhau sau khi
// shadow xảy ra.


function XeA(ten) {
    this.ten = ten;
    console.log("  -> XeA constructor dang chay, chuan bi tao 1 function moi...");
    this.hienThi = function () {
        return this.ten;
    };
}

function XeB(ten) {
    this.ten = ten;
}
console.log("=== Dong nay chay 1 lan duy nhat, TRUOC KHI co bat ky instance nao ===");
XeB.prototype.hienThi = function () {
    return this.ten;
};

console.log("=== Bat dau tao instance ===");
const a1 = new XeA("Toyota");
const a2 = new XeA("Honda");
const b1 = new XeB("Toyota");
const b2 = new XeB("Honda");