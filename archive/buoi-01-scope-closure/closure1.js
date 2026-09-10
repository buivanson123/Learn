// ============================================================
// Ví dụ 1: Counter (bộ đếm) dùng closure
//
// MÔ TẢ:
// createCounter() khai báo biến `count` cục bộ, rồi trả về một
// hàm con có quyền truy cập vào `count`. Hàm con này chính là
// closure: mỗi lần được gọi, nó vẫn "nhớ" giá trị `count` từ
// lần gọi trước đó vì biến này không hề bị reset giữa các lần gọi.
//
// KHI NÀO ÁP DỤNG:
// - Cần tạo ID tăng dần (auto-increment ID) mà không dùng biến toàn cục.
// - Đếm số lần một sự kiện xảy ra (click, request, v.v.) mà không
//   làm ô nhiễm global scope.
// ============================================================

function createCounter() {
  let count = 0;

  return function () {
    count += 1;
    return count;
  };
}

const counter = createCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3
// Biến `count` được "đóng kín" bên trong hàm trả về, không thể truy cập trực tiếp từ ngoài.
