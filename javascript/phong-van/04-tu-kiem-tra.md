# Checklist 109 mục

Tự chấm trước hôm phỏng vấn. Tiêu chí tick không phải "đã nghe qua" mà là **giải thích được cho
người khác trong 30 giây, kèm một hệ quả cụ thể hoặc một con số**.

Mục có dấu 🔢 là mục bạn nên nói ra được **con số đo được** — đó là thứ làm câu trả lời của bạn
khác với câu trả lời đọc từ blog.

---

## Scope, closure, TDZ (10 mục)

- [ ] 1. Giải thích được TDZ, và vì sao `let` **có** được hoisted
- [ ] 2. Biết `typeof` **ném lỗi** với biến trong TDZ — nên không dùng nó để kiểm tra tồn tại
- [ ] 3. Giải thích `for (var)` cho `[3,3,3]`, `for (let)` cho `[0,1,2]` — bằng "một ô nhớ" vs "một binding mỗi vòng"
- [ ] 4. Biết `let` chép giá trị vòng trước sang vòng sau (`fs[0]()×3, fs[1]()` → `1 2 3 2`)
- [ ] 5. Nêu ba cách sửa bug `var` trong vòng lặp mà không dùng `let`
- [ ] 6. Định nghĩa closure là **hàm + environment record**, không phải "hàm nhớ biến ngoài"
- [ ] 7. 🔢 Biết V8 **không** giữ biến mà không closure nào dùng (3.16 → 3.16 MB)
- [ ] 8. 🔢 Giải thích được vì sao giữ một hàm trả về `1` có thể giữ **152 MB** (closure chia sẻ scope)
- [ ] 9. Nêu hai cách sửa: tách scope, hoặc `bien = null` sau khi dùng
- [ ] 10. Biết `context` trong *Retainers* của heap snapshot nghĩa là "closure đang giữ"

## `this`, prototype, class (11 mục)

- [ ] 11. Đọc được 5 luật của `this` theo đúng **thứ tự xét**
- [ ] 12. Biết `f.bind(a).bind(b)()` cho `a` — `bind` lần hai vô tác dụng
- [ ] 13. Biết `this` ở top-level CJS là `module.exports`, ESM là `undefined`
- [ ] 14. Biết ESM **luôn** strict, và thân `class` **luôn** strict
- [ ] 15. Giải thích vì sao `setTimeout(o.method)` mất `this`, và ba nơi khác cùng bị
- [ ] 16. 🔢 Biết class field arrow tốn **2.7×** bộ nhớ so với method trên prototype (97.1 vs 36.1 MB)
- [ ] 17. Phân biệt arrow **bên trong** method (đúng) với arrow **làm** method (gần như luôn sai)
- [ ] 18. Biết `map`/`filter`/`forEach` có tham số `thisArg`, `reduce` thì **không**
- [ ] 19. Kể được 4 bước của `new`, đặc biệt bước "return object thì lấy object đó"
- [ ] 20. Giải thích `P.prototype.list = []` làm hai instance dùng chung mảng — vì `push` là **đọc**
- [ ] 21. Nêu hai chỗ `instanceof` sai: `Object.create(null)` và xuyên realm; biết `Array.isArray` thay thế

## Event loop (12 mục)

- [ ] 22. Vẽ được sơ đồ: đồng bộ → **vét sạch** microtask → **lấy một** macrotask
- [ ] 23. Phân loại đúng: `.then`/`await`/`queueMicrotask`/`MutationObserver` vs `setTimeout`/I/O/sự kiện DOM
- [ ] 24. Xếp đúng thứ tự bài tập `A E H C F G B D`
- [ ] 25. Biết phần đồng bộ của `async function` chạy **ngay**, không phải "chạy sau"
- [ ] 26. Biết `try/catch` đồng bộ **không** bắt được lỗi từ `async function` chưa `await`
- [ ] 27. 🔢 Biết microtask lồng nhau **bỏ đói** macrotask (`setTimeout(0)` → **137 ms**)
- [ ] 28. Nhận ra mẫu code gây nó: đệ quy qua promise resolve đồng bộ (cache nóng)
- [ ] 29. Biết `setTimeout(f,0)` vs `setImmediate(f)` ở module chính là **không xác định**; trong I/O callback thì `setImmediate` luôn trước
- [ ] 30. 🔢 Biết `process.nextTick` **đổi chỗ** giữa CJS và ESM — và vì sao (ESM nạp trong microtask)
- [ ] 31. Biết `await 1` = `await Promise.resolve()` = **1 nhịp**; `await thenable` = **2 nhịp**
- [ ] 32. Kể được thứ tự trong một khung hình trình duyệt (macrotask → microtask → rAF → paint → rIC)
- [ ] 33. Nêu ba cách nhả luồng: `setImmediate` (Node), `requestAnimationFrame`, `scheduler.yield()` (Chrome 152)

## Promise và async (12 mục)

- [ ] 34. Chọn đúng combinator cho 4 tình huống (đủ cả / thiếu vẫn được / nhanh nhất / hạn giờ)
- [ ] 35. Biết `any` đúng hơn `race` cho "3 CDN lấy cái nhanh nhất"
- [ ] 36. Biết `allSettled` **không bao giờ reject**, và `AggregateError.errors` là mảng
- [ ] 37. 🔢 Biết `Promise.all` reject sau **11 ms** nhưng các nhánh khác **vẫn chạy tới cùng**
- [ ] 38. Biết promise **không huỷ được** — muốn dừng thật thì cần `AbortController`
- [ ] 39. Kể được **bốn** kiểu nuốt lỗi: không `await` · `forEach(async)` · `.catch` giữa chuỗi · nhánh thua của `race`
- [ ] 40. Biết lỗi nhánh thua của `race` **không** tạo `unhandledRejection` — biến mất hoàn toàn
- [ ] 41. Giải thích `return kq` trong hàm async trả về mảng rỗng
- [ ] 42. Biết promise chạy **khi được tạo**, không phải khi `await` — cả hai chiều của bẫy
- [ ] 43. 🔢 Nêu được tuần tự vs song song bằng số (608 vs 202 ms)
- [ ] 44. Viết được `retry` đúng: `await`, ném lỗi thật, backoff + jitter, không chờ sau lần cuối, không retry lỗi 4xx
- [ ] 45. Biết `AbortSignal.timeout` cho `TimeoutError`, không phải `AbortError`; phân biệt bằng `e.name`
- [ ] 46. Viết được `pLimit(n)`, và nêu được vì sao cần `Promise.resolve().then(fn)` thay vì `fn()`

## Kiểu dữ liệu, so sánh, JSON (11 mục)

- [ ] 47. 🔢 Giải thích `0.1+0.2`, và biết `(1.005).toFixed(2)` cho `"1.00"`
- [ ] 48. Biết cách tính tiền đúng: quy về đơn vị nhỏ nhất, số nguyên
- [ ] 49. 🔢 Biết `JSON.parse` làm hỏng ID `int64` (`...993` → `...992`), và cách sửa bằng reviver + `ctx.source`
- [ ] 50. Kể đủ **bốn** thuật toán so sánh, và vì sao `includes(NaN)` khác `indexOf(NaN)`
- [ ] 51. Giải thích `null >= 0` là `true` nhưng `null == 0` là `false`
- [ ] 52. Biết `x == null` là ngoại lệ duy nhất đáng dùng của `==`
- [ ] 53. Kể được bảng JSON mất gì — đặc biệt `Map`/`Set` → `{}` **im lặng**
- [ ] 54. Biết `undefined` làm key biến mất → không phân biệt "không gửi" với "gửi null" (quan trọng cho PATCH API)
- [ ] 55. Biết `structuredClone` giữ được gì, và **không** clone được hàm
- [ ] 56. Biết `[1,5,10].sort()` so theo **chuỗi**; và `sort()` mặc định xếp `â`/`ă` **sau cả `b`**
- [ ] 57. Nhận ra `sort((a,b) => a > b)` **không sắp xếp gì** — bug im lặng nhất

## Object, descriptor, Proxy (8 mục)

- [ ] 58. Biết `defineProperty` mặc định `false` cả ba cờ → thuộc tính "vô hình"
- [ ] 59. Giải thích `{...o}` mất thuộc tính, và cách chép cả descriptor
- [ ] 60. Biết `Object.freeze` là **nông**, và **im lặng** ở sloppy mode
- [ ] 61. Kể được luật thứ tự key (số nguyên tăng dần → chuỗi theo thứ tự chèn → Symbol)
- [ ] 62. Biết `Object.keys({300:..,100:..})` bị **sắp lại** → dùng `Map` nếu cần thứ tự
- [ ] 63. Giải thích vì sao trap `Proxy` phải dùng `Reflect` với **receiver**
- [ ] 64. Kể ba chỗ `Proxy` không làm được: internal slot (`Map`) · invariant của freeze · `proxy !== target`
- [ ] 65. 🔢 Biết getter **miễn phí** (9.50 vs 9.52 ms) nhưng `Proxy` đắt **4.2×** (40.14 ms)

## Iterator, generator (6 mục)

- [ ] 66. Biết chỉ cần `[Symbol.iterator]()` để `for...of`/spread/destructuring/`Array.from` đều chạy
- [ ] 67. Biết `for...of` gọi `iterator.return()` khi `break` — chỗ để dọn dẹp
- [ ] 68. Giải thích vì sao `forEach` không `break` được (nó không phải vòng lặp)
- [ ] 69. Biết `take(2)` **đóng** iterator nguồn → `[...g]` sau đó cho mảng rỗng
- [ ] 70. Biết **iterator chỉ dùng được một lần**
- [ ] 71. 🔢 Biết iterator helpers **lười**, không tạo mảng trung gian (18.58 → 0.00 ms)

## Bộ nhớ và rò rỉ (10 mục)

- [ ] 72. Biết rò rỉ trong JS là **"quên bỏ tham chiếu"**, không phải "quên giải phóng"
- [ ] 73. 🔢 Biết `Map` vs `WeakMap` (103.9 vs **7.3 MB**), và khi nào dùng cái nào
- [ ] 74. 🔢 Biết detached DOM **không nằm trong heap JS** → đếm bằng `Memory.getDOMCounters` (40 006 node)
- [ ] 75. Biết giữ node cha là giữ **toàn bộ cây con**
- [ ] 76. 🔢 Biết listener không gỡ rò rỉ **cả component** (+9.54 MB / 50 component)
- [ ] 77. Kể **ba** lý do `removeEventListener` thất bại — kể cả thiếu `{ capture: true }`
- [ ] 78. Biết `{ signal }` + `ac.abort()` là cách gỡ chắc chắn nhất
- [ ] 79. Biết callback `FinalizationRegistry` **không được bảo đảm chạy** → chỉ dùng để thống kê
- [ ] 80. Biết `performance.memory` **vô dụng** để đo → dùng CDP `Runtime.getHeapUsage`
- [ ] 81. Kể được quy trình 6 bước tìm rò rỉ, và bảng nhận diện theo *Retainers*

## Module (6 mục)

- [ ] 82. Biết khác biệt gốc: CJS phân tích **lúc chạy**, ESM **lúc biên dịch**
- [ ] 83. 🔢 Demo được live binding (ESM `count = 2` vs CJS `count = 0`), và cách sửa CJS bằng getter
- [ ] 84. Biết vòng lặp import: ESM ném `ReferenceError` (**tốt**), CJS trả object thiếu (im lặng)
- [ ] 85. Biết vòng lặp import **không tự động là lỗi** — chỉ nổ khi dùng ở top level
- [ ] 86. Biết Node 22 `require` được ESM **trừ khi** có top-level await
- [ ] 87. Biết `"sideEffects": false` **xoá mất polyfill** — bug chỉ xuất hiện sau build production

## DOM và trình duyệt (11 mục)

- [ ] 88. Kể ba pha lan truyền, và bốn sự kiện **không bubble**
- [ ] 89. Biết `stopPropagation` **không** chặn handler khác trên cùng element
- [ ] 90. Phân biệt `target` / `currentTarget`, và biết `currentTarget` là `null` **sau `await`**
- [ ] 91. Biết vì sao delegation phải dùng `closest()`, không dùng `e.target`
- [ ] 92. 🔢 Biết `innerHTML +=` chậm **3877×**, và nó **phá listener/state của node cũ**
- [ ] 93. 🔢 Biết `DocumentFragment` **không còn nhanh hơn** `append` (5.5 vs 3.4 ms)
- [ ] 94. 🔢 Giải thích layout thrashing bằng số (**529×**), và kể được danh sách thuộc tính ép tính layout
- [ ] 95. Biết bốn collection **sống** (kể cả `element.children`) và triệu chứng "bỏ sót một nửa"
- [ ] 96. Biết `fetch` **không throw** với 4xx/5xx, và `Failed to fetch` thường là CORS
- [ ] 97. Biết `Response.body` đọc được **một lần** → `clone()` trước khi đọc
- [ ] 98. 🔢 Biết lợi ích Worker là **độ mượt**, không phải tổng thời gian (0 → 26 khung; 372 → 409 ms)

## Node runtime (6 mục)

- [ ] 99. Biết libuv có thread pool cho `fs`/`dns`/`crypto`, nhưng **mạng thì không**
- [ ] 100. 🔢 Biết một dòng `Sync` chặn event loop **795 ms**, và `JSON.parse` không có bản async
- [ ] 101. 🔢 Biết `Buffer` ở `external`, không ở `heapUsed` → theo dõi **`rss`** (226 vs 76 MB)
- [ ] 102. Giải thích vì sao **không bao giờ dùng `.pipe()`** — không chuyển lỗi, không huỷ stream
- [ ] 103. 🔢 Biết `worker_threads` giảm độ trễ event loop 246 → **2 ms**; khởi động một worker ~16 ms
- [ ] 104. Biết exit code **137** = OOM killer, và `--max-old-space-size` trong container

## Hiệu năng: biết mẹo nào đã sai (5 mục)

- [ ] 105. 🔢 `+=` **nhanh hơn** `array.join` tới 100 000 lần (0.44 vs 1.40 ms) — lời khuyên cũ sai ngược
- [ ] 106. 🔢 Hidden class: 1→4 gần như miễn phí (1.68 → 2.42 ms); chỉ **vượt 4** mới đắt (6.00 ms)
- [ ] 107. 🔢 `try/catch` chỉ đắt khi vòng lặp nóng **nằm trực tiếp trong `try`** (6.32 vs 26.60 ms)
- [ ] 108. 🔢 `[...arr]` và `arr.slice()` **bằng nhau** (0.08 vs 0.08 ms)
- [ ] 109. Kể được thứ tự lợi ích khi tối ưu: bỏ việc → sửa O(n²) → bỏ thrashing → Worker → … → vặn hidden class

---

## Cách đọc kết quả

| Số mục tick được | Nghĩa là |
|---|---|
| < 50 | Quay lại giáo trình. Ưu tiên bài 01, 06, 07 — chúng chiếm phần lớn câu hỏi |
| 50–70 | Junior khá. Thiếu chủ yếu ở phần bộ nhớ (72–81) và Node (99–104) |
| 70–85 | **Middle** — mục tiêu của bộ này |
| > 85 | Sẵn sàng cho phỏng vấn Middle+; ôn thêm 🔢 để trả lời có số |

**Quan trọng hơn tổng điểm:** đếm riêng số mục 🔢 bạn tick được (có 30 mục). Đó là thứ phân biệt
"đã đọc về JavaScript" với "đã đo JavaScript" — và là thứ người phỏng vấn nhớ sau buổi nói chuyện.

Nếu chỉ còn một buổi tối, làm theo thứ tự này:

1. Đọc [3 câu chắc chắn bị hỏi](./README.md) — event loop, closure, `this`.
2. Làm [12 tình huống debug](./03-tinh-huong-debug.md) — đây là dạng câu phân biệt rõ nhất.
3. Học thuộc 10 con số bạn thấy ấn tượng nhất trong bảng 🔢. Mười con số đủ để mọi câu trả lời
   của bạn có chỗ tựa.
