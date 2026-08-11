// ===================================================================
// Ví dụ 1: this trong hàm thường (regular function)
// - Khi gọi hàm bình thường (không phải method, không dùng new),
//   giá trị this phụ thuộc vào CÁCH hàm được gọi, không phải nơi định nghĩa.
// - Không strict mode: this tự động = global object (window/global/globalThis).
// - Strict mode ("use strict"): this = undefined thay vì global object.
// ===================================================================
function vd1() {
  console.log(this); // window (browser) hoặc global (Node)
}
vd1();

// ===================================================================
// Ví dụ 2: this trong object method
// - Quy tắc quan trọng nhất: this = object đứng ngay trước dấu chấm khi gọi hàm.
// - nguoi.chao() -> this bên trong chao chính là nguoi -> this.ten = "Sơn".
// - Nếu tách hàm ra gọi riêng: const f = nguoi.chao; f();
//   thì this MẤT kết nối với nguoi, quay về global/undefined
//   -> lỗi rất hay gặp khi truyền method làm callback.
// ===================================================================
const nguoi = {
  ten: "Sơn",
  chao: function () {
    console.log(this.ten); // "Sơn" vì this = nguoi
  },
};
nguoi.chao();

// ===================================================================
// Ví dụ 3: this trong constructor function
// - Khi gọi hàm với từ khóa new, JS thực hiện 4 bước ngầm:
//   1. Tạo object rỗng mới {}
//   2. Gán this = object rỗng đó
//   3. Chạy code trong hàm (gán thuộc tính lên this)
//   4. Tự động return this (trừ khi hàm return object khác)
// - this.hang = hang thực chất là gán hang vào object mới tạo,
//   object đó sau đó được gán cho xe1.
// ===================================================================
function Xe(hang) {
  this.hang = hang;
}
const xe1 = new Xe("Toyota");
console.log(xe1.hang); // "Toyota" vì this = xe1

// ===================================================================
// Ví dụ 4: this trong arrow function
// - Arrow function KHÔNG có this riêng, nó "mượn" this từ scope cha
//   nơi nó được viết ra (lexical this), không phụ thuộc cách gọi.
// - chaoArrow định nghĩa ở top-level object literal -> scope cha là global
//   -> this bên trong nó là global object, KHÔNG phải nguoi2.
// - arrowBenTrong định nghĩa BÊN TRONG chaoBinhThuong (hàm thường).
//   Khi gọi nguoi2.chaoBinhThuong(), this của chaoBinhThuong = nguoi2,
//   arrow function con kế thừa đúng this đó -> this.ten = "An".
// - Vì vậy arrow function rất hay dùng trong callback (setTimeout,
//   event handler, array methods) để giữ nguyên this của scope ngoài.
// ===================================================================
const nguoi2 = {
  ten: "An",
  chaoArrow: () => {
    console.log(this); // KHÔNG phải nguoi2, mà là this của scope ngoài (global)
  },
  chaoBinhThuong: function () {
    const arrowBenTrong = () => {
      console.log(this.ten); // "An" vì arrow function lấy this từ chaoBinhThuong
    };
    arrowBenTrong();
  },
};
nguoi2.chaoArrow();
console.log(nguoi2); // "An"
nguoi2.chaoBinhThuong();

// ===================================================================
// Ví dụ 5: this với call/apply/bind
// - Ba phương thức này cho phép CHỦ ĐỘNG chỉ định this là gì,
//   thay vì để JS tự suy ra theo cách gọi.
// - call(obj, arg1, arg2, ...): gọi hàm ngay, this = obj,
//   tham số truyền rời từng cái.
// - apply(obj, [arg1, arg2, ...]): giống call nhưng tham số truyền dạng mảng.
// - bind(obj): KHÔNG gọi ngay, trả về hàm mới đã "khóa cứng" this = obj
//   mãi mãi (gọi hàm mới kiểu gì cũng không đổi được this).
// - Dùng khi cần mượn method của object khác, hoặc đảm bảo this đúng
//   khi truyền hàm làm callback.
// ===================================================================
function gioiThieu() {
  console.log(`Tôi là ${this.ten}`);
}
const nguoiA = { ten: "Bình" };
gioiThieu.call(nguoiA); // "Tôi là Bình" - gọi ngay với this = nguoiA
gioiThieu.apply(nguoiA); // giống call, khác cách truyền tham số
const gioiThieuBinh = gioiThieu.bind(nguoiA);
gioiThieuBinh(); // "Tôi là Bình" - tạo hàm mới với this cố định = nguoiA

const counter = {
  count: 0,
  tick: function () {
    this.count++;
    console.log(this.count);
  },
};

setTimeout(counter.tick, 0);
setTimeout(counter.tick.bind(counter), 0);
setTimeout(() => counter.tick(), 0);

function helloWorld() {
  var alo = 123;
  return {
    fn: function () {
      console.log(this);
    },
  };
}

let a1 = helloWorld();
console.log(a1.fn()); // this = a1, vì fn là method của a1



function Sach(ten) {
    this.ten = ten;
}

const s1 = new Sach("Clean Code");
const s2 = Sach("Clean Code");

console.log(s1.ten);
console.log(s2);



function Sach(ten) {
    this.ten = ten;
}

// const s1 = new Sach("Clean Code");
const s2 = Sach("Clean Code");

// console.log(s1.ten);
console.log(window.ten); // "Clean Code" vì this = window trong hàm bình thường