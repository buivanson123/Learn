// ===================================================================
// modules/index.js - "barrel file" (file gom hàng)
//
// Chỉ làm đúng một việc: RE-EXPORT lại thứ của module khác, để nơi dùng
// import từ một chỗ duy nhất thay vì nhớ đường dẫn từng file.
// Bản thân file này không định nghĩa gì mới.
// ===================================================================

// Re-export có chọn lọc
export { add, sub, PI } from "./math.js";

// Re-export TẤT CẢ named export của math.js (không bao gồm default)
// export * from "./math.js";

// Re-export default của file khác, đặt cho nó một cái tên
export { default as Logger, VERSION } from "./logger.js";

// LƯU Ý VỀ TREE-SHAKING: barrel file rất tiện nhưng là con dao hai lưỡi.
// Nếu viết `export * from "./mot-thu-vien-khong-lo.js"`, chỉ cần một chỗ
// import qua barrel là bundler phải phân tích toàn bộ thư viện đó. Với
// bundler hiện đại + module không có side effect thì vẫn cắt được, nhưng
// nếu module có side effect ở cấp cao nhất thì bundler buộc phải giữ lại
// tất cả. Đây là lý do nhiều dự án lớn đã bỏ barrel file.
