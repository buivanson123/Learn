// ===================================================================
// modules/vong-a.js - CIRCULAR IMPORT, trường hợp CHẠY ĐƯỢC
// vong-a.js import vong-b.js, và vong-b.js lại import ngược vong-a.js.
//
// Chạy được vì vong-b.js chỉ ĐỌC `TEN_A` ở BÊN TRONG một hàm - tức là
// đọc lúc hàm được GỌI, chứ không phải lúc module được nạp.
// ===================================================================
import { chaoB, TEN_B } from "./vong-b.js";

export const TEN_A = "A";

export function chaoA() {
    return `chao tu A (B ten la: ${TEN_B})`;
}

console.log("  >> [vong-a] than module chay");
console.log("  >> [vong-a] goi chaoB() ->", chaoB()); // lúc này TEN_A đã có giá trị
