// ===================================================================
// SÁNG (3h) - Module và đóng gói
// ESM, IIFE, biến private.
// Đây là nền TRỰC TIẾP của Module pattern và Revealing Module pattern.
// ===================================================================
//
// CÁCH CHẠY FILE NÀY:
//   cd "ngày 5" && node javascript.js
//
// Thư mục này có file package.json chứa { "type": "module" } - đó là
// công tắc bật ESM cho Node. Không có dòng đó, Node coi mọi file .js là
// CommonJS (dùng require/module.exports) và sẽ báo lỗi
// "Cannot use import statement outside a module".
// Cách thứ hai không cần package.json: đổi đuôi file thành .mjs.
// ===================================================================

// ===================================================================
// Ví dụ 1: ESM là gì và MODULE SCOPE
// - ESM (ES Modules) là hệ module CHUẨN của JavaScript, chạy được cả
//   trên trình duyệt lẫn Node.
// - Quy tắc nền tảng: MỖI FILE LÀ MỘT MODULE, và mỗi module có SCOPE
//   RIÊNG. Biến khai ở cấp cao nhất của file KHÔNG rơi ra global.
// - Khác hẳn <script> thường ngày xưa: ở đó `var` cấp cao nhất trở
//   thành thuộc tính của global object, và mọi file dùng chung một
//   scope -> hai file lỡ đặt trùng tên biến là đè nhau (bug kinh điển).
// - Muốn chia sẻ gì ra ngoài thì phải KHAI BÁO RÕ bằng export/import.
// ===================================================================

// Toàn bộ `import` phải nằm ở CẤP CAO NHẤT của file (không được đặt
// trong if/hàm) - lý do sẽ nói ở Ví dụ 9 khi bàn về tree-shaking.
import { add, sub, PI, tinhDienTichTron } from "./modules/math.js";
import Ghi, { VERSION, taoLogger } from "./modules/logger.js";
import * as MathNS from "./modules/math.js";
import { add as cong, Logger as MayGhi } from "./modules/index.js";
import { inc, get, reset } from "./modules/bo-dem.js";
import { tangHaiLan, xemTuFileKhac } from "./modules/dung-bo-dem.js";

console.log("=== Vi du 1: Module scope ===");

var bienVar = "toi la var o cap module";
let bienLet = "toi la let o cap module";

// Trong <script> thường, `var bienVar` ở cấp cao nhất sẽ tạo ra
// window.bienVar. Trong module thì KHÔNG:
console.log(globalThis.bienVar); // undefined - không hề rò ra global
console.log(globalThis.bienLet); // undefined - let/const thì chưa bao giờ rò ra
console.log(bienVar);            // "toi la var o cap module" - vẫn dùng được trong file

// Trong module, `this` ở cấp cao nhất là `undefined` (không phải
// globalThis như trong script thường hay CommonJS).
console.log(this); // undefined

// Module LUÔN chạy ở strict mode, dù không hề viết "use strict".
// (Nhớ lại ngày 3 Bài 7: gán vào property chỉ có getter - sloppy mode
// thì im lặng, strict mode thì ném TypeError. Trong module luôn là vế sau.)
try {
    undeclaredVar = 5; // gán vào biến chưa khai báo
} catch (e) {
    console.log("Loi:", e.name); // "ReferenceError" - strict mode chặn lại
}

// ===================================================================
// Ví dụ 2: NAMED EXPORT
// - Xuất nhiều thứ theo TÊN. Khi import, tên trong ngoặc nhọn phải
//   KHỚP CHÍNH XÁC với tên đã export (phân biệt hoa thường).
// - Muốn đổi tên lúc nhập thì dùng `as`.
// - Xem file modules/math.js để thấy 3 kiểu viết export tương đương.
// ===================================================================
console.log("\n=== Vi du 2: Named export ===");

console.log(add(2, 3));            // 5
console.log(sub(10, 4));           // 6
console.log(PI);                   // 3.14159
console.log(tinhDienTichTron(2));  // 12.57

// `cong` chính là `add`, chỉ đổi tên lúc nhập bằng `as`
console.log(cong(1, 1));           // 2
console.log(cong === add);         // true - cùng một hàm, chỉ khác cái tên gọi

// Nếu import sai tên -> lỗi ngay lúc "link" module, TRƯỚC KHI code chạy:
//   import { addd } from "./modules/math.js";
//   SyntaxError: The requested module './modules/math.js'
//                does not provide an export named 'addd'
// Đây là điểm mạnh của ESM so với CommonJS: sai tên bị bắt ngay từ đầu,
// không phải đợi tới lúc gọi hàm mới nhận `undefined is not a function`.

// ===================================================================
// Ví dụ 3: DEFAULT EXPORT
// - Mỗi module có TỐI ĐA MỘT default export.
// - Khi import default, KHÔNG dùng ngoặc nhọn, và được ĐẶT TÊN TÙY Ý.
// - Một module vẫn được phép vừa có default vừa có named export.
// ===================================================================
console.log("\n=== Vi du 3: Default export ===");

// `Ghi` là tên tôi tự đặt - trong logger.js nó tên là `Logger`.
// Tên gì cũng được, vì default export không có "tên chính thức".
const log = new Ghi("app");
log.info("khoi dong").error("co loi xay ra");

console.log(VERSION);                    // "1.0.0" - named export đi kèm default
console.log(taoLogger("db") instanceof Ghi); // true

// `MayGhi` cũng chính là class đó, nhập qua barrel file với tên khác:
console.log(MayGhi === Ghi); // true

// Cú pháp gộp: `import Default, { named1, named2 } from "..."`
// Thứ tự bắt buộc: default đứng TRƯỚC, named trong ngoặc nhọn đứng sau.
//
// KHI NÀO DÙNG CÁI NÀO:
// - Named export: mặc định nên chọn. Tên cố định -> đổi tên là biết
//   ngay, IDE tự động gợi ý và đổi tên hàng loạt được, tree-shaking tốt.
// - Default export: hợp khi module chỉ xuất đúng MỘT thứ chính (một
//   class, một component React). Nhược điểm: mỗi nơi import đặt một tên
//   khác nhau -> khó tìm kiếm toàn dự án.

// ===================================================================
// Ví dụ 4: NAMESPACE IMPORT và RE-EXPORT
// - `import * as X` gom TẤT CẢ named export vào một object.
// - Object đó là read-only (đóng băng) - không gán đè được.
// - Re-export (`export { x } from "..."`) dùng để tạo "barrel file",
//   gom nhiều module về một cửa ngõ duy nhất - xem modules/index.js.
// ===================================================================
console.log("\n=== Vi du 4: Namespace import ===");

console.log(MathNS.add(1, 2));  // 3
console.log(MathNS.PI);         // 3.14159
console.log(Object.keys(MathNS)); // liệt kê mọi named export của math.js

// Namespace object không sửa được (ESM giữ liên kết một chiều):
try {
    MathNS.add = () => 0;
} catch (e) {
    console.log("Loi:", e.name); // "TypeError" - không gán đè export được
}

// Lưu ý: `import *` KHÔNG lấy default export. Muốn lấy default thì
// truy cập MathNS.default (math.js không có default nên là undefined).
console.log(MathNS.default); // undefined

// ===================================================================
// Ví dụ 5: IIFE - cách làm module THỜI CHƯA CÓ ESM
// - IIFE = Immediately Invoked Function Expression: hàm vừa khai báo
//   xong là tự gọi ngay lập tức.
// - Mục đích: tạo ra một SCOPE RIÊNG. Mọi biến bên trong bị nhốt trong
//   closure, không rò ra global -> đúng thứ mà module scope làm sẵn
//   cho ta ngày nay.
// - Cú pháp: dấu ngoặc bọc ngoài `(function(){...})` biến khai báo hàm
//   thành BIỂU THỨC hàm, rồi `()` phía sau gọi nó ngay.
// - Đây chính là MODULE PATTERN kinh điển.
// ===================================================================
console.log("\n=== Vi du 5: IIFE / Module pattern ===");

const BoDemIIFE = (function () {
    // PRIVATE - nằm trong closure của IIFE, bên ngoài không có đường vào
    let priv = 0;

    function kiemTra(n) {
        return typeof n === "number";
    }

    // PUBLIC - chỉ những gì nằm trong object được return mới lộ ra
    return {
        inc() {
            priv++;
            return priv;
        },
        add(n) {
            if (!kiemTra(n)) return priv;
            priv += n;
            return priv;
        },
        get() {
            return priv;
        }
    };
})(); // <- hai dấu ngoặc này gọi hàm NGAY LẬP TỨC

console.log(BoDemIIFE.inc());     // 1
console.log(BoDemIIFE.inc());     // 2
console.log(BoDemIIFE.add(10));   // 12
console.log(BoDemIIFE.get());     // 12

// Không có cách nào chạm tới `priv` từ bên ngoài:
console.log(BoDemIIFE.priv);      // undefined - không nằm trong object trả về
console.log(typeof priv);         // "undefined" - biến này không tồn tại ở scope này

// Gán bừa cũng vô hại - chỉ tạo ra property mới trên object công khai,
// không hề đụng tới biến `priv` thật trong closure:
BoDemIIFE.priv = 999;
console.log(BoDemIIFE.get());     // 12 - vẫn nguyên, không bị 999

// ===================================================================
// Ví dụ 6: REVEALING MODULE PATTERN
// - Biến thể của Module pattern ở Ví dụ 5, khác đúng một điểm:
//   ĐỊNH NGHĨA TẤT CẢ như hàm private có tên trước, rồi cuối cùng mới
//   "hé lộ" (reveal) những cái muốn công khai bằng một object toàn
//   tham chiếu.
// - Lợi ích: nhìn dòng return là thấy NGAY toàn bộ API công khai, và
//   các hàm nội bộ gọi lẫn nhau bằng tên trực tiếp (không cần this).
// ===================================================================
console.log("\n=== Vi du 6: Revealing Module pattern ===");

const GioHang = (function () {
    // ----- Toàn bộ phần này là PRIVATE -----
    let items = [];

    function them(ten, gia) {
        items = [...items, { ten, gia }]; // immutable, nhớ lại ngày 4
        return danhSach();
    }

    function xoa(ten) {
        items = items.filter(i => i.ten !== ten);
        return danhSach();
    }

    function tongTien() {
        return items.reduce((s, i) => s + i.gia, 0);
    }

    function dem() {
        return items.length;
    }

    function danhSach() {
        // trả BẢN SAO, không trả mảng gốc -> bên ngoài không mutate được
        return items.map(i => ({ ...i }));
    }

    function apDungGiamGia(phanTram) {
        // hàm private: chỉ dùng nội bộ, KHÔNG hé lộ ra ngoài
        return tongTien() * (1 - phanTram / 100);
    }

    function tongSauGiam() {
        return apDungGiamGia(10); // gọi hàm private bằng tên trực tiếp
    }

    // ----- Hé lộ API công khai: nhìn một chỗ là biết hết -----
    return { them, xoa, dem, tongTien, tongSauGiam, danhSach };
})();

GioHang.them("Sach", 100);
GioHang.them("But", 20);
console.log(GioHang.dem());          // 2
console.log(GioHang.tongTien());     // 120
console.log(GioHang.tongSauGiam());  // 108
console.log(GioHang.apDungGiamGia);  // undefined - private, không hé lộ

// danhSach() trả bản sao nên sửa nó không ảnh hưởng state bên trong:
const ds = GioHang.danhSach();
ds.push({ ten: "Hack", gia: 0 });
ds[0].ten = "Bi doi ten";
console.log(GioHang.dem());               // 2 - vẫn 2, không bị thêm
console.log(GioHang.danhSach()[0].ten);   // "Sach" - vẫn nguyên

GioHang.xoa("But");
console.log(GioHang.dem());          // 1

// ===================================================================
// Ví dụ 7: ĐÓNG GÓI PUBLIC/PRIVATE BẰNG ESM
// - Với ESM, ta không cần IIFE nữa: bản thân file ĐÃ LÀ một scope kín.
//   Quy tắc rất gọn: `export` = công khai, không `export` = private.
// - Xem modules/bo-dem.js: `count` và `kiemTra` không export nên hoàn
//   toàn vô hình với bên ngoài, dù ta biết chính xác tên chúng.
// - Module trong ESM mặc định là SINGLETON: thân file chỉ chạy đúng
//   MỘT LẦN, mọi nơi import đều dùng chung một bản state.
// ===================================================================
console.log("\n=== Vi du 7: Dong goi bang ESM ===");

console.log(get());        // 0
console.log(inc());        // 1
console.log(inc(5));       // 6

// dung-bo-dem.js là một FILE KHÁC cũng import bo-dem.js.
// Nó thấy đúng cái `count` mà ta vừa tăng lên 6:
console.log(xemTuFileKhac()); // 6 - dùng chung state, không phải bản riêng
console.log(tangHaiLan());    // 8 - file kia tăng, file này thấy ngay
console.log(get());           // 8

// Không có đường nào chạm tới `count` trực tiếp:
console.log(typeof count); // "undefined" - biến này không tồn tại ở file này

// Muốn đổi giá trị thì BẮT BUỘC đi qua API công khai - đó chính là
// "đóng gói": module tự kiểm soát được mọi lối vào state của nó.
reset();
console.log(get()); // 0

// Thử import một thứ KHÔNG được export xem sao. Phải dùng dynamic
// import mới bắt được lỗi, vì import tĩnh sẽ làm hỏng cả file này.
try {
    await import("./modules/thu-lay-private.js");
} catch (e) {
    console.log("Loi:", e.constructor.name);
    console.log("Chi tiet:", e.message.split("\n")[0]);
    // SyntaxError: ... does not provide an export named 'lamTron'
}

// ===================================================================
// Ví dụ 8: CIRCULAR IMPORT (phụ thuộc vòng)
// - A import B, B lại import A. ESM XỬ LÝ ĐƯỢC chuyện này (không lặp
//   vô tận), nhưng giá trị có thể CHƯA KỊP KHỞI TẠO lúc chạy.
// - Cơ chế: JS nạp module theo chiều sâu. Khi B import ngược lại A mà
//   A đang nạp dở, JS KHÔNG nạp lại A - nó đưa cho B một "bản A đang
//   xây dở". Những `const`/`let` chưa chạy tới sẽ nằm trong TDZ.
// - Quy tắc sống sót: ĐỌC MUỘN thì an toàn (đọc bên trong hàm, lúc gọi),
//   ĐỌC SỚM thì vỡ (đọc ngay ở thân module lúc nạp).
// ===================================================================
console.log("\n=== Vi du 8: Circular import ===");

console.log("--- Truong hop CHAY DUOC (doc muon, ben trong ham) ---");
const vongA = await import("./modules/vong-a.js");
console.log("  ket qua chaoA():", vongA.chaoA());

console.log("--- Truong hop VO (doc som, ngay khi nap module) ---");
try {
    await import("./modules/vong-c.js");
} catch (e) {
    console.log("  Loi:", e.constructor.name, "-", e.message);
    // ReferenceError: Cannot access 'TEN_C' before initialization
}

// Vì sao thứ tự log của vong-b lại chạy TRƯỚC vong-a: ta yêu cầu nạp
// vong-a, nó gặp `import ./vong-b.js` ngay dòng đầu -> JS phải nạp xong
// vong-b trước rồi mới quay lại chạy tiếp thân vong-a.
//
// KẾT LUẬN THỰC TẾ: circular import chạy được không có nghĩa là nên
// dùng. Nó khiến thứ tự khởi tạo phụ thuộc vào việc file nào được
// import trước - đổi một dòng import ở chỗ khác là có thể vỡ. Cách gỡ:
//   1. Tách phần dùng chung ra một module thứ ba (C), cho A và B cùng
//      import C -> vòng bị phá.
//   2. Chuyển sang đọc muộn (đưa vào trong hàm) nếu buộc phải giữ vòng.

// ===================================================================
// Ví dụ 9: TREE-SHAKING
// - Bundler (Vite, Rollup, webpack, esbuild) LOẠI BỎ những export mà
//   không ai import, giúp file build nhỏ đi.
// - Làm được điều đó nhờ ESM là STATIC: import/export cố định, đọc
//   được ngay lúc build mà KHÔNG CẦN chạy code.
// - Đó cũng là lý do `import` bắt buộc nằm ở cấp cao nhất, không được
//   đặt trong if hay trong hàm.
// ===================================================================
console.log("\n=== Vi du 9: Tree-shaking ===");

// Giả sử cả dự án chỉ có mỗi dòng import này:
//     import { add, sub } from "./modules/math.js";
// Thì `mul`, `div`, `square`, `tinhDienTichTron` không ai chạm tới ->
// khi build, bundler nhìn thấy điều đó và CẮT BỎ hẳn chúng khỏi file
// kết quả. Người dùng tải về đúng phần code thực sự được dùng.
console.log(add(1, 1)); // add được dùng -> chắc chắn được giữ lại

// NHƯNG: chính file này lại là ví dụ sống về việc LÀM HỎNG tree-shaking.
// Ở Ví dụ 4 ta đã viết `import * as MathNS from "./modules/math.js"`.
// Dòng đó kéo về TOÀN BỘ namespace, nên bundler không dám cắt gì cả -
// nó không thể chắc ta có định gọi `MathNS["mul"]` ở đâu đó hay không.
// Kiểm chứng ngay bằng chính danh sách đã in ở Ví dụ 4: cả 7 export đều
// còn nguyên, kể cả những cái ta chưa từng gọi.
//
// Đây là bài học thực tế quan trọng: tree-shaking KHÔNG tự động xảy ra,
// nó phụ thuộc vào việc BẠN VIẾT IMPORT NHƯ THẾ NÀO.

// Vì sao ESM tree-shake được mà CommonJS thì không:
//
//   // CommonJS - ĐỘNG, chỉ biết lúc chạy:
//   const ten = dieuKien ? "math" : "string";
//   const m = require("./" + ten);   // bundler chịu, không đoán nổi
//   if (x) { module.exports.add = ... }  // export cũng có thể đổi lúc chạy
//
//   // ESM - TĨNH, đọc được ngay lúc build:
//   import { add } from "./math.js";  // đường dẫn và tên đều cố định
//
// Với ESM, bundler chỉ cần ĐỌC file (không chạy) là dựng được đầy đủ đồ
// thị phụ thuộc, từ đó biết chính xác nhánh nào không ai chạm tới.
//
// BA THỨ LÀM HỎNG TREE-SHAKING - cần tránh:
// 1. SIDE EFFECT ở cấp cao nhất của module. Nếu math.js có dòng
//    `console.log("nap roi")` hay `window.x = 1` ngoài mọi hàm, bundler
//    KHÔNG dám cắt - nó không biết dòng đó có quan trọng không.
//    (Đó là lý do modules/math.js được viết sạch, còn bo-dem.js cố tình
//     có console.log để minh họa chuyện khác.)
//    Cách khai báo với bundler: thêm "sideEffects": false vào package.json.
// 2. IMPORT CẢ NAMESPACE: `import * as M from "./math.js"` rồi truy cập
//    `M[tenHam]` bằng biến -> bundler không biết tên nào sẽ được dùng,
//    đành giữ lại tất cả.
// 3. BARREL FILE lồng nhau quá sâu (xem ghi chú cuối modules/index.js).

// ===================================================================
// TỐI (1h) - Ôn tập
// ===================================================================
console.log("\n=== TOI: On tap ===");
//
// 1) BA CÁCH TẠO SCOPE RIÊNG trong JS, theo dòng lịch sử:
//
//    +----------------+---------------------------+------------------------+
//    | Cách           | Che giấu bằng             | Vấn đề                 |
//    +----------------+---------------------------+------------------------+
//    | <script> thường| (không có)                | mọi thứ chung global   |
//    | IIFE           | closure                   | phải tự quản thứ tự    |
//    |                |                           | thẻ script, tự nối phụ |
//    |                |                           | thuộc bằng tay         |
//    | ESM            | module scope (sẵn có)     | -                      |
//    +----------------+---------------------------+------------------------+
//
//    Điểm chung của IIFE và ESM: PHẢI KHAI BÁO RÕ cái gì công khai.
//    - IIFE: công khai = thứ nằm trong object `return`.
//    - ESM:  công khai = thứ có từ khóa `export`.
//    Mọi thứ còn lại tự động private. Đây chính là Module pattern, và
//    ESM là phiên bản được đưa thẳng vào ngôn ngữ.
//
// 2) IMPORT ĐƯỢC HOISTING - và nó "sống", không phải bản copy:

console.log(get()); // 0 - vẫn là bộ đếm đã reset ở Ví dụ 7
inc(3);
console.log(get()); // 3

//    - Mọi `import` bị kéo lên chạy TRƯỚC toàn bộ code trong file, dù
//      viết ở dòng nào. Đó là lý do khi chạy file này, các dòng log
//      trong thân bo-dem.js hiện ra TRƯỚC cả dòng "=== Vi du 1 ===".
//    - Biến import là LIVE BINDING (liên kết sống), không phải bản sao:
//      nó luôn trỏ tới ô nhớ thật bên module gốc. Module gốc đổi giá
//      trị thì nơi import thấy ngay - khác hẳn CommonJS (`require` trả
//      về một bản snapshot của object exports tại thời điểm gọi).
//    - Nhưng live binding là MỘT CHIỀU: đọc được, gán đè thì không
//      (đã thấy ở Ví dụ 4 với MathNS.add).
//
// 3) BA LỖI KINH ĐIỂN CẦN NHỚ:
//    - Quên { } khi import named export: `import add from "./math.js"`
//      sẽ lấy DEFAULT (math.js không có) -> `add` là undefined, và lỗi
//      chỉ nổ khi gọi `add(...)`, không nổ lúc import.
//    - Quên đuôi `.js` trong đường dẫn: ESM trên Node và trình duyệt
//      BẮT BUỘC ghi đầy đủ `./math.js`. Chỉ có bundler mới tự đoán đuôi
//      giúp - nên code chạy được với Vite lại vỡ khi chạy thẳng bằng Node.
//    - Tưởng mỗi lần import là một bản mới: module là SINGLETON, thân
//      file chỉ chạy một lần (Ví dụ 7). Muốn nhiều bản độc lập thì
//      export một FACTORY (hàm tạo) chứ đừng export state trực tiếp:

const taoBoDemRieng = () => {
    let n = 0;                       // mỗi lần gọi tạo một `n` mới
    return { inc: () => ++n, get: () => n };
};
const bd1 = taoBoDemRieng();
const bd2 = taoBoDemRieng();
bd1.inc();
bd1.inc();
console.log(bd1.get(), bd2.get()); // 2 0 - hoàn toàn độc lập với nhau
