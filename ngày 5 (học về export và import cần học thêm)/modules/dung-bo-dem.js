// ===================================================================
// modules/dung-bo-dem.js - một file KHÁC cũng import bo-dem.js
//
// Mục đích: chứng minh hai điều cùng lúc khi file chính import cả hai
//   1. Thân bo-dem.js vẫn chỉ chạy 1 lần (log của nó chỉ hiện 1 lần).
//   2. Hai file dùng CHUNG một biến `count` duy nhất - module trong ESM
//      mặc định là singleton, không phải mỗi nơi import một bản riêng.
// ===================================================================
import { inc, get } from "./bo-dem.js";

export function tangHaiLan() {
    inc();
    inc();
    return get();
}

export function xemTuFileKhac() {
    return get();
}
