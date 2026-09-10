// ===================================================================
// modules/vong-c.js - CIRCULAR IMPORT, trường hợp VỠ
// Khác vong-a.js đúng một điểm: bên kia đọc giá trị NGAY khi nạp module,
// chứ không đợi tới lúc gọi hàm.
// ===================================================================
import { TEN_D } from "./vong-d.js";

export const TEN_C = "C";

console.log("  >> [vong-c] than module chay, TEN_D =", TEN_D);
