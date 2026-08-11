// ============================================================
// Ví dụ 5: Vòng lặp với closure - bẫy thường gặp (var) và cách
// khắc phục (let)
//
// PHẦN A: DÙNG `var` — KẾT QUẢ SAI [3, 3, 3]
// ------------------------------------------------------------
// `var` KHÔNG có "block scope" (không bị giới hạn trong { } của
// vòng for) mà chỉ có "function scope". Nghĩa là dù bạn khai báo
// var i bên trong for, thực chất CHỈ CÓ MỘT biến `i` duy nhất
// tồn tại cho suốt cả hàm createFunctionsWithVar.
//
// Diễn biến từng bước:
//   - Vòng lặp chạy, mỗi lần push MỘT HÀM vào mảng funcs.
//     Nhưng cả 3 hàm này đều tham chiếu đến CÙNG một biến `i`
//     (giống như 3 người cùng nhìn vào 1 tờ giấy ghi số, chứ
//     không phải mỗi người giữ 1 tờ giấy riêng).
//   - Vòng lặp kết thúc khi i = 3 (điều kiện i < 3 sai).
//   - Lúc này biến `i` (dùng chung) đang mang giá trị 3.
//   - Khi ta GỌI 3 hàm đó (ở ngoài, sau khi vòng lặp đã xong),
//     cả 3 đều đọc "tờ giấy chung" đó -> đều thấy i = 3.
//   => Kết quả: [3, 3, 3]
//




// PHẦN B: DÙNG `let` — KẾT QUẢ ĐÚNG [0, 1, 2]
// ------------------------------------------------------------
// `let` CÓ "block scope": mỗi vòng lặp, JavaScript tự tạo ra
// MỘT BIẾN `i` HOÀN TOÀN MỚI (một tờ giấy mới), có giá trị
// riêng, rồi mới push hàm vào mảng.
//
// Diễn biến từng bước:
//   - Lần lặp 1: tạo biến i (giá trị 0) -> hàm push vào funcs
//     closure với "tờ giấy i=0" NÀY.
//   - Lần lặp 2: tạo biến i MỚI (giá trị 1) -> hàm push vào funcs
//     closure với "tờ giấy i=1" MỚI, khác hoàn toàn tờ giấy cũ.
//   - Lần lặp 3: tương tự, tờ giấy i=2 mới.
//   - Khi gọi 3 hàm đó, mỗi hàm đọc đúng tờ giấy riêng của mình.
//   => Kết quả: [0, 1, 2]
//
// KHI NÀO CẦN LƯU Ý:
// - Cực kỳ phổ biến khi gắn nhiều event listener trong vòng lặp,
//   ví dụ tạo 5 nút bấm và muốn mỗi nút nhớ đúng index của nó
//   (button.onclick = () => console.log(index)).
// - Quy tắc chung: LUÔN dùng let/const thay vì var trong vòng lặp
//   nếu bên trong có tạo hàm/callback, để tránh bug kiểu này.
// ============================================================

// ---------- PHẦN A: var ----------
function createFunctionsWithVar() {
  const funcs = [];
  for (var i = 0; i < 3; i++) {
    funcs.push(function () {
      return i; // tất cả hàm đều đọc chung 1 biến `i`
    });
  }
  return funcs;
}

const varFuncs = createFunctionsWithVar();
console.log(
  "Dùng var:",
  varFuncs.map((f) => f())
); // [3, 3, 3] - sai với mong đợi ban đầu



// ---------- PHẦN B: let ----------
function createFunctionsWithLet() {
  const funcs = [];
  for (let i = 0; i < 3; i++) {
    funcs.push(function () {
      return i; // mỗi hàm đọc biến `i` riêng của lần lặp đó
    });
  }
  return funcs;
}

const letFuncs = createFunctionsWithLet();
console.log(
  "Dùng let:",
  letFuncs.map((f) => f())
); // [0, 1, 2] - đúng như mong đợi
