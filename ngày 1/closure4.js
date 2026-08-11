// ============================================================
// Ví dụ 4: Debounce function dùng closure
// (thường dùng trong xử lý sự kiện UI, ví dụ ô tìm kiếm)
//
// VẤN ĐỀ CẦN GIẢI QUYẾT:
// Khi người dùng gõ vào ô tìm kiếm, sự kiện "onChange" bắn ra
// liên tục theo từng ký tự. Nếu cứ gõ 1 ký tự là gọi API 1 lần
// thì rất tốn tài nguyên. Ta chỉ muốn gọi API SAU KHI người dùng
// đã NGỪNG GÕ một khoảng thời gian (ví dụ 300ms). Kỹ thuật này
// gọi là "debounce".
//
// MÔ TẢ TỪNG BƯỚC:
//
// 1. debounce(fn, delay) được gọi 1 LẦN DUY NHẤT để tạo ra
//    hàm debouncedSearch. Lúc này:
//      - `fn`    = handleSearch (hàm thật sự muốn chạy)
//      - `delay` = 300 (mili giây)
//      - `timerId` = biến cục bộ, dùng để lưu "vé hẹn giờ" (timeout ID)
//
// 2. debounce() trả về một hàm mới (gọi là hàm bọc / wrapper).
//    Hàm bọc này CLOSURE lại được `fn`, `delay`, và `timerId` —
//    tức là mỗi lần debouncedSearch(...) được gọi, nó vẫn nhớ và
//    dùng chung MỘT biến `timerId` duy nhất giữa các lần gọi.
//
// 3. Mỗi lần debouncedSearch("...") được gọi (mỗi lần người dùng gõ):
//      a. clearTimeout(timerId) -> HỦY hẹn giờ cũ (nếu có), coi như
//         "huỷ lịch chạy API của lần gõ trước".
//      b. setTimeout(...) -> ĐẶT hẹn giờ MỚI: sau `delay` ms sẽ
//         chạy fn(args). ID của hẹn giờ mới được lưu lại vào `timerId`.
//
// -> Nếu người dùng gõ liên tục (khoảng cách giữa các lần gõ < 300ms),
//    thì mỗi lần gõ sẽ HỦY hẹn giờ của lần gõ ngay trước đó.
//    Chỉ có lần gõ CUỐI CÙNG mới không bị huỷ kịp -> chỉ nó được
//    thực thi, sau đúng 300ms kể từ khi gõ xong.
//
// KHI NÀO ÁP DỤNG:
// - Ô input tìm kiếm (search-as-you-type): chỉ gọi API khi người
//   dùng ngừng gõ.
// - Sự kiện resize/scroll trên trang: tránh xử lý quá nhiều lần
//   trong lúc người dùng đang kéo/cuộn liên tục, gây giật/lag UI.
// - Validate form real-time: chỉ kiểm tra sau khi người dùng dừng nhập.
// ============================================================

function debounce(fn, delay) {
  let timerId; // "vé hẹn giờ" dùng chung cho mọi lần gọi hàm bọc bên dưới

  // Đây là hàm bọc (wrapper) sẽ được trả về và gán cho debouncedSearch
  return function (...args) {
    clearTimeout(timerId); // huỷ lần hẹn giờ trước đó (nếu có)
    timerId = setTimeout(() => {
      fn.apply(this, args); // sau `delay` ms, thực sự gọi hàm gốc `fn`
    }, delay);
  };
}

function handleSearch(query) {
  console.log("Đang tìm kiếm:", query);
}

// Chỉ gọi debounce() 1 LẦN để tạo ra debouncedSearch
const debouncedSearch = debounce(handleSearch, 300);

// Giả lập người dùng gõ liên tục 3 ký tự trong thời gian ngắn:
debouncedSearch("a");   // -> đặt hẹn giờ, nhưng bị huỷ ngay bởi dòng dưới
debouncedSearch("ap");  // -> huỷ hẹn giờ trên, đặt hẹn giờ mới, cũng bị huỷ
debouncedSearch("app"); // -> huỷ hẹn giờ trên, đặt hẹn giờ mới

// Vì không còn lệnh gọi nào tiếp theo để huỷ, sau 300ms
// hẹn giờ của "app" sẽ chạy -> chỉ in ra: "Đang tìm kiếm: app"
