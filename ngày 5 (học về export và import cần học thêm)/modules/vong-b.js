// ===================================================================
// modules/vong-b.js - nửa còn lại của vòng lặp CHẠY ĐƯỢC
//
// Điểm mấu chốt: `TEN_A` chỉ được đọc BÊN TRONG thân hàm chaoB().
// Khi module này được nạp, vong-a.js mới chạy được nửa chừng nên TEN_A
// chưa có giá trị - nhưng ta không đụng tới nó lúc đó, nên không sao.
// Tới khi chaoB() thực sự được gọi thì TEN_A đã sẵn sàng.
// ===================================================================
import { TEN_A } from "./vong-a.js";

export const TEN_B = "B";

export function chaoB() {
    return `chao tu B (A ten la: ${TEN_A})`; // đọc MUỘN, lúc gọi hàm
}

console.log("  >> [vong-b] than module chay (chay TRUOC vong-a)");
