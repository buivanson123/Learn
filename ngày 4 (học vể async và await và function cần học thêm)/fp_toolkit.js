// ===================================================================
// CHIỀU (4h) - Thực hành: tự tay dựng bộ công cụ lập trình hàm
// (compose, pipe, curry) rồi dùng chính nó để refactor code vòng lặp.
// ===================================================================

// ===================================================================
// BƯỚC 1: Tự viết compose và pipe
//
// - compose(...fns) chạy PHẢI sang TRÁI  -> compose(f, g)(x) === f(g(x))
// - pipe(...fns)    chạy TRÁI sang PHẢI  -> pipe(g, f)(x)    === f(g(x))
//
// Cả hai chỉ khác nhau ở HƯỚNG duyệt mảng hàm:
//   compose dùng reduceRight (duyệt từ cuối mảng về đầu)
//   pipe    dùng reduce      (duyệt từ đầu mảng về cuối)
//
// Cách đọc dòng `fns.reduceRight((acc, fn) => fn(acc), x)`:
//   - `x` là giá trị ban đầu của accumulator (dữ liệu đầu vào).
//   - Mỗi bước, lấy accumulator hiện tại nhét vào hàm kế tiếp: fn(acc).
//   - Kết quả của hàm này thành accumulator cho hàm sau -> đúng nghĩa
//     "output của hàm này là input của hàm kia".
// ===================================================================
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);

const themMot = x => x + 1;
const gapDoi = x => x * 2;
const binhPhuong = x => x * x;

console.log("=== BUOC 1: compose vs pipe ===");

// Kiểm chứng định nghĩa gốc: compose(f, g)(x) phải bằng f(g(x))
console.log(compose(gapDoi, themMot)(5)); // 12
console.log(gapDoi(themMot(5)));          // 12 - giống hệt
console.log(compose(gapDoi, themMot)(5) === gapDoi(themMot(5))); // true

// Kiểm chứng pipe(g, f) tương đương compose(f, g) - CHỈ CẦN ĐẢO THỨ TỰ
console.log(pipe(themMot, gapDoi)(5) === compose(gapDoi, themMot)(5)); // true

// Kiểm chứng với chuỗi 3 hàm cho chắc
const c3 = compose(binhPhuong, gapDoi, themMot); // (((x+1)*2)^2)
const p3 = pipe(themMot, gapDoi, binhPhuong);    // đọc xuôi: +1 -> *2 -> ^2
console.log(c3(3), p3(3), c3(3) === p3(3)); // 64 64 true
// Kiểm tra tay: 3 -> +1 = 4 -> *2 = 8 -> ^2 = 64. Khớp.

// Thứ tự KHÔNG hoán vị được - đổi chỗ là ra số khác:
console.log(pipe(gapDoi, themMot)(5));  // 11 (5*2=10, +1)
console.log(pipe(themMot, gapDoi)(5));  // 12 (5+1=6,  *2)

// Trường hợp biên: không truyền hàm nào -> trả về chính giá trị đầu vào
// (vì reduce/reduceRight trên mảng rỗng chỉ trả về giá trị khởi tạo).
console.log(pipe()(42));    // 42
console.log(compose()(42)); // 42

// ===================================================================
// BƯỚC 2: Tự viết curry(fn)
//
// Yêu cầu: gom tham số dần dần, chỉ khi ĐỦ số tham số mà `fn` khai báo
// thì mới thật sự gọi `fn`. Chưa đủ thì trả về một hàm nhận tiếp.
//
// Chìa khóa là `fn.length` = số tham số đã KHAI BÁO của hàm (arity).
//   - Không tính tham số có giá trị mặc định (a, b = 1) -> length = 1
//   - Không tính rest parameter (...args)              -> length = 0
// ===================================================================
function curry(fn) {
    return function curried(...args) {
        if (args.length >= fn.length) {
            // đã gom đủ tham số -> gọi hàm gốc luôn
            return fn.apply(this, args);
        }
        // chưa đủ -> trả về hàm mới, nhớ sẵn các tham số đã nhận (closure),
        // chờ nhận thêm rồi gọi lại chính `curried` với danh sách gộp
        return function (...next) {
            return curried.apply(this, [...args, ...next]);
        };
    };
}

console.log("=== BUOC 2: curry ===");

const cong3So = (a, b, c) => a + b + c;
console.log(cong3So.length); // 3 - curry dựa vào con số này

const cong3SoCurried = curry(cong3So);

// Mọi cách chia tham số đều phải ra cùng kết quả 6
console.log(cong3SoCurried(1, 2, 3)); // 6 - đủ ngay từ đầu
console.log(cong3SoCurried(1)(2)(3)); // 6 - từng cái một
console.log(cong3SoCurried(1, 2)(3)); // 6 - gom 2 rồi 1
console.log(cong3SoCurried(1)(2, 3)); // 6 - gom 1 rồi 2

// Partial application: giữ lại hàm trung gian để tái sử dụng
const congVoi10 = cong3SoCurried(10);     // đã khóa a = 10
const congVoi10Va20 = congVoi10(20);      // đã khóa a = 10, b = 20
console.log(congVoi10Va20(5));  // 35
console.log(congVoi10Va20(7));  // 37 - dùng lại được, không phải khai lại 10, 20
console.log(congVoi10(1, 2));   // 13

// --- Ứng dụng: curry biến hàm 2 tham số thành thứ ghép được vào pipe ---
// pipe chỉ chuyền được MỘT giá trị giữa các hàm, nên hàm 2 tham số như
// (mang, he) => ... không thả thẳng vào pipe được. Curry giải quyết:
const nhanTatCa = curry((he, mang) => mang.map(x => x * he));
const locLonHon = curry((nguong, mang) => mang.filter(x => x > nguong));

const xuLy = pipe(
    nhanTatCa(3),   // đã khóa he = 3, giờ là hàm 1 tham số: mang => mang
    locLonHon(5)    // đã khóa nguong = 5
);
console.log(xuLy([1, 2, 3])); // [6, 9] - (1,2,3)*3 = (3,6,9), giữ lại > 5

// Lưu ý thứ tự tham số khi curry: tham số "cấu hình" phải đứng TRƯỚC,
// dữ liệu đứng SAU (data-last). Nếu viết (mang, he) thì khóa trước sẽ
// là mảng - vô dụng cho việc tạo hàm chuyên biệt.

// ===================================================================
// BƯỚC 3: Refactor vòng for sang chuỗi filter -> map -> reduce
//
// Bài toán: tính tổng bình phương của các số CHẴN trong mảng.
// ===================================================================
console.log("=== BUOC 3: for vs filter/map/reduce ===");

const soLieu = [1, 2, 3, 4, 5, 6];

// --- Cách 1: vòng for mệnh lệnh (imperative) ---
// Ta phải tự tay quản lý: biến đếm i, điều kiện dừng, biến tích lũy
// `ketQua` bị mutate liên tục. Người đọc phải chạy code trong đầu mới
// biết đoạn này rốt cuộc đang làm gì.
function tongBinhPhuongChanFor(arr) {
    let ketQua = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] % 2 === 0) {
            ketQua = ketQua + arr[i] * arr[i];
        }
    }
    return ketQua;
}

// --- Cách 2: khai báo (declarative) bằng filter -> map -> reduce ---
// Đọc thẳng thành tiếng Việt: "lọc số chẵn, bình phương từng cái, cộng
// tất cả lại từ 0". Không có biến đếm, không có mutate.
function tongBinhPhuongChanFP(arr) {
    return arr
        .filter(x => x % 2 === 0) // [2, 4, 6]
        .map(x => x * x)          // [4, 16, 36]
        .reduce((s, x) => s + x, 0); // 56
}

console.log(tongBinhPhuongChanFor(soLieu)); // 56
console.log(tongBinhPhuongChanFP(soLieu));  // 56
console.log(tongBinhPhuongChanFor(soLieu) === tongBinhPhuongChanFP(soLieu)); // true

// Kiểm chứng KỲ VỌNG quan trọng nhất: mảng gốc KHÔNG bị mutate
console.log(soLieu); // [1, 2, 3, 4, 5, 6] - nguyên vẹn sau cả 2 lần gọi

// Kiểm tra thêm trường hợp biên - đây là chỗ bản FP thắng rõ:
console.log(tongBinhPhuongChanFP([]));        // 0 - nhờ có giá trị ban đầu 0 trong reduce
console.log(tongBinhPhuongChanFP([1, 3, 5])); // 0 - filter ra mảng rỗng, reduce vẫn an toàn

// --- Cách 3: viết lại bằng pipe của Bước 1, tách hẳn từng bước ra ---
// Mỗi mảnh giờ là một hàm PURE, đặt tên rõ ràng, test riêng được.
const locChan = arr => arr.filter(x => x % 2 === 0);
const binhPhuongTatCa = arr => arr.map(x => x * x);
const tinhTong = arr => arr.reduce((s, x) => s + x, 0);

const tongBinhPhuongChanPipe = pipe(locChan, binhPhuongTatCa, tinhTong);
console.log(tongBinhPhuongChanPipe(soLieu)); // 56

// ===================================================================
// SO SÁNH
// ===================================================================
//
// Ba cách cho ra CÙNG một kết quả 56. Khác biệt nằm ở chỗ khác:
//
// - Vòng for: nhanh nhất về lý thuyết (duyệt mảng đúng 1 lần), nhưng
//   trộn lẫn 3 việc khác nhau (lọc, biến đổi, cộng dồn) vào cùng một
//   khối lệnh, và dựa vào mutate biến `ketQua`. Muốn đổi yêu cầu (ví dụ
//   đổi sang số lẻ, hoặc lấy lập phương) phải sửa vào giữa vòng lặp.
//
// - Chuỗi filter/map/reduce: duyệt mảng 3 lần (tạo 2 mảng trung gian),
//   đổi lại mỗi bước làm đúng MỘT việc và tên method nói rõ việc đó.
//   Với dữ liệu cỡ thường, sự khác biệt hiệu năng này không đáng kể so
//   với lợi ích về khả năng đọc.
//
// - pipe(locChan, binhPhuongTatCa, tinhTong): đi xa nhất - từng bước
//   thành một hàm pure độc lập, tái sử dụng được ở chỗ khác, test riêng
//   được, và muốn thêm/bớt/đảo bước chỉ cần sửa danh sách trong pipe mà
//   không đụng vào logic bên trong bước nào cả.
//
// Đây chính là cây cầu sang design pattern: mỗi bước trong pipe là một
// "chiến lược" thay thế được (Strategy), còn hàm bọc hàm ở Ví dụ 3 buổi
// sáng chính là hình dạng thu nhỏ của middleware.
