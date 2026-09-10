// ===================================================================
// SÁNG (3h) - Lập trình hàm và async
// Hàm bậc cao, composition, immutability, promise.
// Đây là nền của Strategy pattern, Observer pattern và middleware.
// ===================================================================

// ===================================================================
// Ví dụ 1: Pure function (hàm thuần khiết)
// - Định nghĩa: cùng input LUÔN cho cùng output, và KHÔNG gây side
//   effect (không sửa biến ngoài, không I/O, không đụng DOM/network,
//   không đọc Date.now()/Math.random()).
// - Vì sao quan trọng: pure function dễ test (chỉ cần so sánh
//   input -> output, không cần dựng môi trường), dễ ghép lại với nhau
//   (compose/pipe ở Ví dụ 4), và an toàn khi chạy song song.
// - Đây chính là nền của Strategy pattern: mỗi "chiến lược" là một hàm
//   thuần, thay thế được cho nhau vì chúng không lệ thuộc trạng thái
//   bên ngoài.
// ===================================================================
const add = (a, b) => a + b; // PURE: add(2, 3) luôn = 5, không đụng gì bên ngoài

console.log(add(2, 3)); // 5
console.log(add(2, 3)); // 5 - gọi bao nhiêu lần cũng vậy

let tong = 0;
function themVaoTong(x) {
    tong += x;      // SIDE EFFECT: sửa biến `tong` nằm NGOÀI hàm
    return tong;    // kết quả phụ thuộc lịch sử gọi trước đó
}

console.log(themVaoTong(5)); // 5
console.log(themVaoTong(5)); // 10 - CÙNG input nhưng KHÁC output -> IMPURE

// Một dạng impure kín đáo hơn: không sửa biến ngoài, nhưng SỬA THAM SỐ
// được truyền vào (tham số object/array là tham chiếu tới dữ liệu gốc).
function themMonImpure(gio, mon) {
    gio.push(mon); // sửa thẳng mảng của người gọi -> side effect
    return gio;
}

function themMonPure(gio, mon) {
    return [...gio, mon]; // tạo mảng MỚI, mảng gốc nguyên vẹn
}

const gio1 = ["Toan"];
themMonImpure(gio1, "Ly");
console.log(gio1); // ["Toan", "Ly"] - biến gốc BỊ ĐỔI dù ta không hề gán lại

const gio2 = ["Toan"];
const gio2Moi = themMonPure(gio2, "Ly");
console.log(gio2);    // ["Toan"] - gốc không đổi
console.log(gio2Moi); // ["Toan", "Ly"] - bản mới

// ===================================================================
// Ví dụ 2: Immutability (bất biến)
// - Nguyên tắc: KHÔNG sửa dữ liệu gốc, mà tạo ra một bản mới đã thay
//   đổi. Dữ liệu cũ vẫn còn nguyên -> dễ so sánh "trước/sau", dễ undo,
//   dễ phát hiện thay đổi bằng phép so sánh tham chiếu (===).
// - Với object: const next = { ...state, done: true }
// - Với array:  const arr2 = [...arr, x]
// - LƯU Ý: spread chỉ COPY NÔNG (shallow) - object lồng bên trong vẫn
//   dùng chung tham chiếu với bản gốc. Muốn copy sâu dùng
//   structuredClone(obj) (chuẩn sẵn có, clone sâu, nhưng KHÔNG clone
//   được function).
// ===================================================================
const state = { id: 1, done: false, tags: ["a"] };
const next = { ...state, done: true }; // tạo object MỚI, ghi đè field done

console.log(state); // { id: 1, done: false, tags: ["a"] } - gốc nguyên vẹn
console.log(next);  // { id: 1, done: true,  tags: ["a"] }
console.log(state === next); // false - hai object khác nhau trong bộ nhớ

const arr = [1, 2, 3];
const arr2 = [...arr, 4];    // thêm phần tử -> mảng mới
const arr3 = arr.filter(x => x !== 2); // xóa phần tử -> mảng mới

console.log(arr);  // [1, 2, 3] - gốc không đổi
console.log(arr2); // [1, 2, 3, 4]
console.log(arr3); // [1, 3]

// --- BẪY: spread chỉ copy NÔNG một cấp ---
console.log(state.tags === next.tags); // true - VẪN LÀ CÙNG MỘT MẢNG!

next.tags.push("b");   // mutate mảng lồng bên trong
console.log(state.tags); // ["a", "b"] - state GỐC bị ảnh hưởng theo!

// Cách 1 (đúng, thủ công): spread luôn cả tầng lồng bên trong
const state4 = { id: 1, tags: ["a"] };
const next4 = { ...state4, tags: [...state4.tags, "b"] };
console.log(state4.tags); // ["a"] - lần này gốc an toàn
console.log(next4.tags);  // ["a", "b"]

// Cách 2 (đúng, tự động): structuredClone - clone SÂU toàn bộ
const goc = { id: 1, cauHinh: { theme: "dark", list: [1, 2] } };
const banSao = structuredClone(goc);
banSao.cauHinh.theme = "light";
banSao.cauHinh.list.push(3);

console.log(goc.cauHinh);    // { theme: "dark", list: [1, 2] } - hoàn toàn không đổi
console.log(banSao.cauHinh); // { theme: "light", list: [1, 2, 3] }

// structuredClone KHÔNG clone được function -> ném lỗi DataCloneError
try {
    structuredClone({ fn: () => 1 });
} catch (e) {
    console.log("Loi:", e.name); // "DataCloneError"
}

// ===================================================================
// Ví dụ 3: Hàm bậc cao (higher-order function)
// - Định nghĩa: hàm NHẬN hàm làm tham số, hoặc TRẢ VỀ một hàm.
// - Đây là thứ làm cho map/filter/reduce, setTimeout, addEventListener
//   hoạt động được - và là cơ chế nền của Observer pattern (đăng ký
//   callback) lẫn middleware (bọc hàm này bằng hàm khác).
// ===================================================================

// Dạng 1: NHẬN hàm làm tham số
function apDung(fn, x) {
    return fn(x);
}
console.log(apDung(x => x * 2, 5)); // 10

// Dạng 2: TRẢ VỀ một hàm (kết hợp closure đã học ngày 1)
function nhanVoi(he) {
    return function (x) {
        return x * he; // nhớ `he` nhờ closure
    };
}
const nhanDoi = nhanVoi(2);
const nhanBa = nhanVoi(3);
console.log(nhanDoi(5)); // 10
console.log(nhanBa(5));  // 15

// Dạng 3: bọc một hàm bằng hàm khác - đây CHÍNH LÀ middleware thu nhỏ
function themLog(fn) {
    return function (...args) {
        console.log("  [log] goi voi:", args);
        const kq = fn(...args);
        console.log("  [log] tra ve:", kq);
        return kq;
    };
}
const addCoLog = themLog(add);
addCoLog(2, 3);
// [log] goi voi: [2, 3]
// [log] tra ve: 5

// ===================================================================
// Ví dụ 4: compose và pipe
// - compose(f, g)(x) === f(g(x))  -> chạy PHẢI sang TRÁI
// - pipe(g, f)(x)    === f(g(x))  -> chạy TRÁI sang PHẢI
// - Hai cái cho ra kết quả GIỐNG NHAU, chỉ khác thứ tự viết. pipe đọc
//   tự nhiên hơn (theo dòng dữ liệu chảy), compose gần với ký hiệu
//   toán học f∘g hơn.
// - Chỉ ghép được ngon lành khi các hàm là PURE và nhận đúng 1 tham số
//   (unary) - đây là lý do Ví dụ 1 và Ví dụ 5 phải học trước.
// ===================================================================
const compose = (...fns) => x => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns) => x => fns.reduce((acc, fn) => fn(acc), x);

const themMot = x => x + 1;
const gapDoi = x => x * 2;

console.log(compose(gapDoi, themMot)(5)); // 12 - themMot(5)=6 TRƯỚC, rồi gapDoi(6)=12
console.log(pipe(themMot, gapDoi)(5));    // 12 - đọc trái sang phải: +1 rồi *2

// Đổi thứ tự -> kết quả khác hẳn, chứng minh thứ tự thực sự quan trọng
console.log(compose(themMot, gapDoi)(5)); // 11 - gapDoi(5)=10 trước, rồi +1
console.log(pipe(gapDoi, themMot)(5));    // 11

// ===================================================================
// Ví dụ 5: Currying và partial application
// - Currying: biến hàm nhiều tham số thành CHUỖI hàm một tham số.
//   VD: (a, b) => a + b   trở thành   a => b => a + b
// - Partial application: cố định trước vài tham số để tạo ra một hàm
//   chuyên biệt hơn. VD const add5 = add(5)
// - Vì sao cần: compose/pipe chỉ ghép được hàm 1 tham số. Currying là
//   cách biến hàm 2-3 tham số thành thứ ghép được vào pipeline.
// ===================================================================
const addCurried = a => b => a + b;
console.log(addCurried(2)(3)); // 5 - gọi 2 lần, mỗi lần 1 tham số

const add5 = addCurried(5); // partial application: "khóa" a = 5
console.log(add5(10)); // 15
console.log(add5(1));  // 6

// Ứng dụng thật: tạo hàm chuyên biệt rồi thả thẳng vào pipe
const nhan = a => b => a * b;
const themTien = a => b => b + a;

const tinhGia = pipe(
    nhan(1.1),     // cộng 10% thuế
    themTien(5)    // cộng 5 phí ship
);
console.log(tinhGia(100)); // 115.00000000000001 (số thực dấu phẩy động)

// ===================================================================
// Ví dụ 6: map / filter / reduce
// - map: biến đổi TỪNG phần tử -> mảng MỚI CÙNG ĐỘ DÀI.
// - filter: giữ lại phần tử thỏa điều kiện -> mảng MỚI, độ dài <= gốc.
// - reduce: gộp cả mảng về MỘT giá trị qua accumulator.
// - Cả ba đều KHÔNG mutate mảng gốc -> hợp với immutability (Ví dụ 2).
// - Ghi nhớ chữ ký reduce: arr.reduce((acc, item) => acc_moi, giaTriBanDau)
// ===================================================================
console.log([1, 2].map(x => x * 2));          // [2, 4]
console.log([1, 2, 3].filter(x => x > 1));    // [2, 3]
console.log([1, 2, 3].reduce((s, x) => s + x, 0)); // 6

const soGoc = [1, 2, 3, 4];
const soChan = soGoc.filter(x => x % 2 === 0);
console.log(soGoc);  // [1, 2, 3, 4] - gốc KHÔNG đổi
console.log(soChan); // [2, 4]

// reduce mạnh hơn map/filter: nó làm được cả hai (và hơn thế)
console.log([1, 2, 3].reduce((acc, x) => [...acc, x * 2], [])); // [2, 4, 6] - map viết bằng reduce
console.log(["a", "b", "a"].reduce((acc, x) => {
    acc[x] = (acc[x] || 0) + 1;
    return acc;
}, {})); // { a: 2, b: 1 } - đếm tần suất, thứ map/filter không làm được

// LƯU Ý: reduce KHÔNG có giá trị ban đầu thì phần tử đầu tiên được dùng
// làm accumulator, và callback bắt đầu chạy từ phần tử thứ HAI.
console.log([1, 2, 3].reduce((s, x) => s + x));    // 6 - vẫn đúng ở đây
console.log([].reduce((s, x) => s + x, 0));        // 0 - có giá trị ban đầu -> an toàn
// console.log([].reduce((s, x) => s + x));        // TypeError: Reduce of empty array with no initial value

// ===================================================================
// Ví dụ 7: Promise
// - Promise = object đại diện cho một kết quả BẤT ĐỒNG BỘ trong tương
//   lai. Nó có đúng 3 trạng thái:
//     pending   -> đang chờ, chưa biết kết quả
//     fulfilled -> thành công, có value  (đi vào .then)
//     rejected  -> thất bại, có reason   (đi vào .catch)
// - Một khi đã chuyển sang fulfilled/rejected thì KHÓA VĨNH VIỄN,
//   không đổi trạng thái lại được nữa.
// - .then trả về một Promise MỚI -> nối chuỗi được (chaining).
// ===================================================================
const p = new Promise((resolve, reject) => {
    setTimeout(() => resolve("xong"), 100); // sau 100ms mới có kết quả
});

console.log(p); // Promise { <pending> } - tại thời điểm này CHƯA có kết quả

p.then(kq => {
    console.log("then 1:", kq);  // "xong"
    return kq.toUpperCase();     // giá trị trả về đi tiếp xuống then kế
})
    .then(kq => console.log("then 2:", kq)) // "XONG"
    .catch(err => console.log("catch:", err));

// Promise bị reject -> bỏ qua mọi .then ở giữa, nhảy thẳng tới .catch
Promise.reject(new Error("that bai"))
    .then(() => console.log("khong bao gio chay"))
    .catch(err => console.log("bat duoc:", err.message)); // "that bai"

// ===================================================================
// Ví dụ 8: async / await
// - async/await chỉ là CÚ PHÁP GỌN cho Promise, không phải cơ chế mới.
// - `async function` LUÔN trả về một Promise, dù bên trong return giá
//   trị thường.
// - `await p` tạm dừng hàm async đó cho tới khi p xong, rồi lấy ra giá
//   trị bên trong - viết code async mà đọc như code đồng bộ.
// - Bắt lỗi bằng try/catch (thay cho .catch của Promise chain).
// ===================================================================
async function layDuLieu() {
    return { id: 1 }; // trả về giá trị thường...
}
console.log(layDuLieu()); // ...nhưng nhận được Promise { { id: 1 } }
layDuLieu().then(d => console.log("qua then:", d)); // { id: 1 }

function doi(ms, giaTri) {
    return new Promise(resolve => setTimeout(() => resolve(giaTri), ms));
}

async function chay() {
    try {
        const a = await doi(50, "A"); // dừng ở đây 50ms, rồi a = "A"
        console.log("nhan duoc:", a);
        const b = await doi(50, "B"); // CHỜ a xong mới bắt đầu -> tổng 100ms
        console.log("nhan duoc:", b);
        return a + b;
    } catch (e) {
        console.log("loi:", e.message); // await một Promise bị reject sẽ ném lỗi vào đây
    }
}
chay().then(kq => console.log("ket qua cuoi:", kq)); // "AB"

// Chạy SONG SONG khi các tác vụ độc lập nhau: Promise.all
// -> tổng thời gian bằng tác vụ CHẬM NHẤT, không phải tổng các tác vụ.
async function chaySongSong() {
    const [a, b] = await Promise.all([doi(50, "A"), doi(50, "B")]); // tổng ~50ms
    console.log("song song:", a, b); // "A" "B"
}
chaySongSong();

// ===================================================================
// TỐI (1h) - Ôn tập
// ===================================================================
//
// 1) Vì sao "pure + immutable" lại là điều kiện để compose/pipe dùng được:
//    Ghép hàm nghĩa là output của hàm này thành input của hàm kia. Nếu
//    một hàm trong chuỗi lén sửa dữ liệu gốc (mutate) hoặc lệ thuộc
//    biến ngoài, thì kết quả của cả pipeline phụ thuộc vào THỨ TỰ CHẠY
//    và LỊCH SỬ trước đó -> không còn dự đoán được, không test được
//    từng mảnh riêng lẻ.
//
// 2) Sync vs async - thứ tự thực thi thật sự (event loop):
//    Toàn bộ code đồng bộ chạy HẾT trước. Sau đó mới tới microtask
//    (.then của Promise, phần sau `await`), rồi mới tới macrotask
//    (setTimeout, setInterval). setTimeout(fn, 0) KHÔNG có nghĩa là
//    "chạy ngay", mà là "chạy sớm nhất có thể SAU KHI đã dọn xong code
//    đồng bộ và toàn bộ hàng đợi microtask".

console.log("--- Thu tu thuc thi ---");
console.log("1 - dong bo");
setTimeout(() => console.log("4 - setTimeout (macrotask)"), 0);
Promise.resolve().then(() => console.log("3 - promise (microtask)"));
console.log("2 - dong bo");
// Thứ tự in ra thực tế: 1 -> 2 -> 3 -> 4
// (Chạy cả file sẽ thấy 3 và 4 in ra muộn, xen lẫn output async của các
//  ví dụ phía trên - nhưng THỨ TỰ TƯƠNG ĐỐI giữa 1, 2, 3, 4 luôn đúng
//  như vậy. Muốn thấy rõ, copy riêng khối này ra file khác chạy thử.)

// Điều tương tự xảy ra với await: mọi thứ SAU dòng await đều bị đẩy
// thành microtask, dù giá trị await là một giá trị thường không async.
async function thuAwait() {
    console.log("A - truoc await");
    await null;                       // dù await null, phần dưới vẫn bị hoãn
    console.log("C - sau await");
}
thuAwait();
console.log("B - dong bo ngay sau khi goi ham async");
// Thứ tự in ra: A -> B -> C
//
// 3) Ba lỗi kinh điển cần nhớ:
//    - Tưởng spread copy sâu: { ...state } chỉ copy 1 tầng, object lồng
//      bên trong vẫn dùng chung (xem Ví dụ 2).
//    - Quên `await` -> nhận về Promise { <pending> } thay vì giá trị,
//      và try/catch không bắt được lỗi vì hàm đã chạy tiếp mất rồi.
//    - Dùng `forEach` khi thật ra cần `map`: forEach LUÔN trả về
//      undefined, không dùng để tạo mảng mới được.

console.log([1, 2, 3].map(x => x * 2));     // [2, 4, 6]
console.log([1, 2, 3].forEach(x => x * 2)); // undefined
