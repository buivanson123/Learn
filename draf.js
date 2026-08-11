let origin = {name: "Son", class: "A1", mon: {toan: 9, ly: 8, hoa: 7}};
let clone = structuredClone(origin);
clone.name = "Huy";
clone.mon.toan = 10; // clone.mon vẫn trỏ đến cùng 1 object với origin.mon
console.log(clone);
console.log(origin);


const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);

// Ứng dụng thật: tạo hàm chuyên biệt rồi thả thẳng vào pipe
const nhan = a => b => a * b;
const themTien = a => b => b + a;

const tinhGia = pipe(
    nhan(1.1),     // cộng 10% thuế
    themTien(5)    // cộng 5 phí ship
);
console.log(tinhGia(100)); // 115.00000000000001 (số thực dấu phẩy động)