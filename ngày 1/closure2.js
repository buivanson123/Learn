// ============================================================
// Ví dụ 2: Hàm nhân số (multiplier factory) dùng closure
//
// MÔ TẢ (giải thích từng bước):
//
// Bước 1: Gọi createMultiplier(2)
//   -> Hàm createMultiplier chạy, tham số `factor` được gán = 2.
//   -> Nó trả về một hàm con: function (number) { return number * factor }
//   -> Hàm con này "đóng gói" (closure) biến `factor = 2` bên trong nó,
//      giống như một cái ba lô mang theo giá trị factor đi khắp nơi.
//   -> Hàm con được gán vào biến `double`.
//
// Bước 2: Gọi createMultiplier(3)
//   -> Một lần chạy MỚI, HOÀN TOÀN ĐỘC LẬP với lần chạy ở bước 1.
//   -> Lần này `factor` được gán = 3, và hàm con mới "đóng gói" factor = 3.
//   -> Hàm con được gán vào biến `triple`.
//
// Điểm mấu chốt: `double` và `triple` là 2 hàm khác nhau, mỗi hàm
// mang theo một bản sao `factor` RIÊNG của chính nó (2 và 3), dù
// cả 2 đều được tạo ra từ cùng một hàm createMultiplier.
// Bình thường, biến `factor` sẽ biến mất sau khi createMultiplier
// chạy xong — nhưng nhờ closure, hàm con vẫn giữ được nó.
//
// KHI NÀO ÁP DỤNG:
// - Cần tạo nhiều hàm có "cấu hình sẵn" từ một hàm gốc, ví dụ:
//   taxCalculator(0.1) cho thuế 10%, taxCalculator(0.2) cho thuế 20%.
// - Tránh viết lặp lại nhiều hàm gần giống nhau (double, triple,
//   quadruple...) — chỉ cần 1 hàm gốc rồi tạo ra các biến thể.
// ============================================================

function createMultiplier(factor) {
  // `factor` là biến cục bộ của createMultiplier.
  // Hàm con bên dưới sẽ "nhớ" biến này mãi mãi (đó là closure).
  return function (number) {
    return number * factor;
  };
}

const double = createMultiplier(2); // double "nhớ" factor = 2
const triple = createMultiplier(3); // triple "nhớ" factor = 3

console.log(double(5)); // 5 * 2 = 10
console.log(triple(5)); // 5 * 3 = 15

// Thử thêm: tạo một hàm mới ngay tại đây để thấy rõ mỗi hàm độc lập nhau
const quadruple = createMultiplier(4);
console.log(quadruple(5)); // 5 * 4 = 20
console.log(double(10));   // vẫn là *2, không bị ảnh hưởng bởi quadruple -> 20
