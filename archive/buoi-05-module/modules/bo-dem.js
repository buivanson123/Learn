// ===================================================================
// modules/bo-dem.js - MODULE SCOPE + biến private + tính "chạy 1 lần"
//
// Đây chính là Module pattern viết bằng ESM: state nằm ở cấp module,
// chỉ những hàm được `export` mới là API công khai. Bên ngoài KHÔNG có
// cách nào chạm tới `count` trực tiếp.
// ===================================================================

// Dòng này chứng minh: thân module chỉ chạy ĐÚNG MỘT LẦN cho toàn bộ
// chương trình, dù có bao nhiêu file import nó đi nữa. Từ lần import
// thứ hai trở đi, JS lấy lại kết quả đã cache, không chạy lại thân file.
console.log("  >> [bo-dem.js] than module dang chay (se chi thay dong nay 1 lan)");

// PRIVATE: khai báo ở cấp module nhưng KHÔNG export
let count = 0;

// PRIVATE helper: cũng không export -> chi tiết nội bộ, đổi lúc nào cũng
// được mà không sợ làm hỏng code của người dùng module này.
function kiemTra(buoc) {
    if (typeof buoc !== "number" || Number.isNaN(buoc)) {
        throw new TypeError("buoc phai la mot so");
    }
    return buoc;
}

// PUBLIC API: chỉ đúng 3 hàm dưới đây lọt ra ngoài
export function inc(buoc = 1) {
    count += kiemTra(buoc);
    return count;
}

export function get() {
    return count;
}

export function reset() {
    count = 0;
    return count;
}
