// ===================================================================
// modules/vong-d.js - nửa còn lại của vòng lặp VỠ
//
// Dòng console.log cuối file đọc `TEN_C` NGAY TẠI THỜI ĐIỂM NẠP MODULE.
// Lúc đó vong-c.js mới chạy tới dòng `import`, chưa chạy tới dòng
// `export const TEN_C = "C"` -> TEN_C đang trong "vùng chết" (TDZ)
// -> ném ReferenceError.
// ===================================================================
import { TEN_C } from "./vong-c.js";

export const TEN_D = "D";

console.log("  >> [vong-d] than module chay, thu doc TEN_C ngay:", TEN_C); // NỔ Ở ĐÂY
