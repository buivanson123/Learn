// ===================================================================
// modules/math.js - ví dụ về NAMED EXPORT
// Module này cố tình KHÔNG có side effect (không console.log, không sửa
// gì bên ngoài) - đây là điều kiện để bundler tree-shake được nó.
// ===================================================================

// Cách 1: gắn `export` ngay trước khai báo
export const PI = 3.14159;

export function add(a, b) {
    return a + b;
}

export function sub(a, b) {
    return a - b;
}

// Cách 2: khai báo bình thường rồi export gom lại ở cuối file
// (hai cách hoàn toàn tương đương, chọn theo sở thích)
function mul(a, b) {
    return a * b;
}

function div(a, b) {
    return a / b;
}

export { mul, div };

// Export kèm đổi tên bằng `as`
function binhPhuongNoiBo(x) {
    return x * x;
}
export { binhPhuongNoiBo as square };

// KHÔNG export -> hoàn toàn private với bên ngoài.
// Không file nào import được `lamTron`, kể cả khi biết chính xác tên nó.
function lamTron(x) {
    return Math.round(x * 100) / 100;
}

export function tinhDienTichTron(r) {
    return lamTron(PI * r * r); // nội bộ vẫn dùng được `lamTron` bình thường
}
