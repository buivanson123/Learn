// ===================================================================
// modules/thu-lay-private.js - file CỐ TÌNH SAI, dùng để minh họa
//
// `lamTron` có tồn tại thật trong math.js, ta biết chính xác tên nó,
// nhưng nó KHÔNG được export. File này thử import nó xem chuyện gì xảy
// ra -> lỗi ngay lúc "link" module, trước cả khi có dòng code nào chạy.
// ===================================================================
import { lamTron } from "./math.js";

export const ketQua = lamTron(1.239);
