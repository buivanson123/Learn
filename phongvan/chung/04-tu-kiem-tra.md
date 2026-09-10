# Checklist tự kiểm tra

Đọc từng dòng và tự trả lời **thành tiếng**. Ấp úng quá 5 giây thì đánh dấu ❌ và quay lại bài tương
ứng.

Đây là việc nên làm **đầu tiên**, trước khi đọc bất cứ bài nào — để biết mình hổng chỗ nào và không
tốn thời gian ôn thứ đã chắc.

Tổng: **150 điểm**. Mỗi mục 1 điểm.

---

# PHẦN BACKEND (80 điểm)

## A — Runtime và đồng thời (14 điểm)

- [ ] Giải thích được "Node đơn luồng" chính xác tới đâu — cái gì đơn luồng, cái gì không
- [ ] Nói được thứ tự: sync → `nextTick` → microtask → timer/check, và vì sao `nextTick` khác microtask
- [ ] Nói được vì sao đệ quy `process.nextTick` treo event loop còn `setImmediate` thì không
- [ ] Kể được 3 cách xử lý việc nặng CPU và khi nào dùng cái nào
- [ ] Phân biệt `cluster` / `worker_threads` / `child_process` — kèm lý do một worker chết thì sao
- [ ] Giải thích được vì sao `readFileSync` file lớn là sai, kèm con số bộ nhớ
- [ ] Phân biệt `Promise.all` / `allSettled` / `race` / `any`, và biết `all` **không huỷ** promise còn lại
- [ ] Chỉ ra được hai lỗi trong `try { asyncFn() }` và `arr.forEach(async ...)`
- [ ] Nói được vì sao hash mật khẩu phải chậm, kèm mốc thời gian hợp lý
- [ ] Biết `timingSafeEqual` dùng ở đâu và vì sao
- [ ] Kể được 4 nguồn memory leak trong Node và quy trình chụp heap snapshot
- [ ] Nói được đủ các bước graceful shutdown, **kể cả khoảng đệ trước `server.close()`**
- [ ] Tính được tổng số kết nối DB từ pool × tiến trình × pod, và biết vì sao pool lớn lại chậm hơn
- [ ] Thiết kế được API idempotent với `Idempotency-Key`, kể cả `request_fingerprint`

→ [backend/01](../backend/01-runtime-va-dong-thoi.md)

## B — Database (16 điểm)

- [ ] Giải thích được index B-tree và **cái giá** của nó khi ghi
- [ ] Nói được ít nhất 3 lý do khiến index có mà không được dùng
- [ ] Giải thích được vì sao `WHERE lower(email) = ?` phá index, và 3 biến thể cùng bản chất
- [ ] Biết `LIKE 'abc%'` có thể **không** dùng được index, và biết lý do liên quan tới collation
- [ ] Nói được quy tắc thứ tự cột trong composite index
- [ ] Giải thích được index-only scan và ý nghĩa của `Heap Fetches: 0`
- [ ] Đọc được `EXPLAIN ANALYZE`: biết nhìn `Rows Removed by Filter`, `Buffers`, `loops` trước
- [ ] Biết `CREATE INDEX CONCURRENTLY` và rủi ro index `INVALID`
- [ ] Giải thích được N+1 và biết **cách phát hiện** chứ không chỉ cách sửa
- [ ] Nói được **hai** vấn đề của `OFFSET` (chậm và lặp/bỏ sót), và viết được keyset pagination có tie-breaker
- [ ] Biết vì sao `COUNT(*)` chậm và 4 phương án thay thế theo mức chính xác cần thiết
- [ ] Nói được 3 trường hợp phi chuẩn hoá là đúng, kèm rủi ro đi kèm
- [ ] Kể được 3 vấn đề của soft delete và cách xử lý từng cái
- [ ] So sánh được `bigserial` / UUIDv4 / UUIDv7, và biết vì sao UUIDv4 làm ghi chậm
- [ ] Trình bày được expand–migrate–contract để đổi tên cột không downtime
- [ ] Kể được thứ tự các bước phải làm **trước** khi nghĩ tới sharding

→ [backend/02](../backend/02-database-va-truy-van.md)

## C — Transaction (12 điểm)

- [ ] Gắn được mỗi chữ trong ACID với một sự cố cụ thể
- [ ] Nói chính xác READ COMMITTED bảo đảm gì và **không** bảo đảm gì
- [ ] Giải thích được vì sao REPEATABLE READ ném `could not serialize` và vì sao phải retry
- [ ] Mô tả được lost update và biết READ COMMITTED **không** ngăn nó
- [ ] Kể được 4 cách chống lost update, theo thứ tự nên ưu tiên
- [ ] Biết `FOR UPDATE` làm transaction khác **chờ** chứ không lỗi, và hệ quả với pool
- [ ] Biết `NOWAIT` và `SKIP LOCKED` dùng cho việc gì
- [ ] Giải thích được deadlock và cách phòng gốc rễ (khoá theo cùng thứ tự)
- [ ] Nói được write skew và vì sao `FOR UPDATE` trên dòng không cứu được
- [ ] Biết vì sao `idle in transaction` chặn `VACUUM` và gây bloat
- [ ] Giải thích được outbox pattern và vì sao nó chỉ cho at-least-once
- [ ] Phân biệt saga choreography và orchestration, và biết bù trừ ≠ rollback

→ [backend/03](../backend/03-transaction-va-dong-thoi-du-lieu.md)

## D — API, cache, queue (22 điểm)

- [ ] So sánh REST / GraphQL / gRPC kèm **cái giá thật** của GraphQL
- [ ] Phân loại được thay đổi nào phá vỡ API, thay đổi nào không
- [ ] Thiết kế được định dạng lỗi có `code` ổn định và `traceId`
- [ ] Phân biệt đúng 400 / 401 / 403 / 404 / 409 / 422 / 429
- [ ] Biết vì sao **không** trả `200` kèm `{"success": false}`
- [ ] Kể được 4 thuật toán rate limit và nhược của fixed window
- [ ] Biết vì sao `INCR` + `EXPIRE` phải nguyên tử
- [ ] Biết method nào idempotent, và vì sao `GET` không được có tác dụng phụ
- [ ] Thiết kế được webhook cả hai phía: ký HMAC trên raw body, timestamp chống replay
- [ ] Mô tả được luồng presigned URL và biết bước xác minh sau khi upload
- [ ] So sánh SSE / WebSocket / long polling và biết cái nào tự kết nối lại
- [ ] Giải thích cache-aside và vì sao nó **chịu được việc Redis chết**
- [ ] Nói được vì sao **xoá** cache chứ không cập nhật, và đúng thứ tự ghi DB trước
- [ ] Kể được 3 cách chống cache stampede + cách chống avalanche và penetration
- [ ] Trả lời được "Redis chết thì sao" cho **từng** mục đích dùng Redis
- [ ] Biết `maxmemory-policy` mặc định là `noeviction` và hậu quả
- [ ] Nói được vì sao exactly-once không tồn tại và cách làm consumer idempotent
- [ ] Thiết kế được cơ chế retry + DLQ, và biết vấn đề job "đầu độc"
- [ ] Giải thích được `FOR UPDATE SKIP LOCKED` làm queue trên Postgres
- [ ] So sánh Kafka và RabbitMQ theo mô hình, không theo tính năng
- [ ] Kể được 5 thứ vô tình làm server có trạng thái
- [ ] Biết vì sao autoscale theo CPU là sai với app IO-bound

→ [backend/04](../backend/04-thiet-ke-api.md), [backend/05](../backend/05-cache-queue-va-scaling.md)

## E — Bảo mật (16 điểm)

- [ ] Giải thích được vì sao tham số hoá chống SQLi còn lọc ký tự thì không
- [ ] Kể được 3 chỗ ORM vẫn dính SQLi
- [ ] Biết escape phải làm lúc **xuất**, và khác nhau theo ngữ cảnh
- [ ] Giải thích CSRF và biết khi nào **không** cần chống
- [ ] Nêu được đánh đổi giữa cookie `HttpOnly` và token trong localStorage
- [ ] Biết payload JWT ai cũng đọc được
- [ ] Nói được nhược điểm lớn nhất của JWT và mô hình access + refresh token
- [ ] Biết lỗ hổng `alg: none` và vì sao phải chốt cứng thuật toán khi verify
- [ ] Biết vì sao cần PKCE và vì sao phải kiểm tra `state`
- [ ] Giải thích IDOR và biết ràng buộc quyền sở hữu phải nằm trong truy vấn
- [ ] Biết secret đã commit vào git thì phải **xoay khoá**, không phải xoá commit
- [ ] Phân biệt brute force và credential stuffing, và biết vì sao rate limit theo IP không đủ
- [ ] Biết phải hash giả khi không tìm thấy user, để chống dò qua thời gian phản hồi
- [ ] Giải thích SSRF, kể được 3 biến thể bypass, và biết cách chống đáng tin nhất
- [ ] Biết mass assignment và cách schema danh sách trắng chặn nó
- [ ] Kể được 4 cách file upload bị lợi dụng và cách chống từng cái

→ [backend/06](../backend/06-bao-mat.md)

---

# PHẦN FRONTEND (50 điểm)

## F — JavaScript và runtime (12 điểm)

- [ ] Nói được thứ tự sync / microtask / rAF / `setTimeout` và biết rAF **không** có thứ tự cố định với `setTimeout`
- [ ] Biết vòng lặp microtask vô hạn treo trang còn `setTimeout` đệ quy thì không
- [ ] Giải thích được chuỗi ép kiểu của `[] == false`
- [ ] Giải thích `var` vs `let` trong vòng lặp và nối được với stale closure trong React
- [ ] Nói được 4 quy tắc xác định `this` và vì sao arrow khác
- [ ] Biết vì sao id `bigint` từ backend phải trả về dạng chuỗi
- [ ] Biết `structuredClone` giữ được gì mà `JSON.parse(JSON.stringify())` mất
- [ ] Biết `Promise.all` không huỷ, và `JSON.stringify(error)` ra `{}`
- [ ] Chỉ ra được hai lỗi async trong đoạn code có `try { asyncFn() }` và `forEach(async ...)`
- [ ] Phân biệt debounce và throttle, và biết vì sao debounce trong React phải bọc `useMemo`/`useRef`
- [ ] Biết `localStorage` là API **đồng bộ** và hệ quả với INP
- [ ] Kể được 5 nguồn memory leak frontend và biết bộ lọc "Detached" trong heap snapshot

→ [frontend/01](../frontend/01-javascript-va-runtime.md)

## G — Trình duyệt và mạng (12 điểm)

- [ ] Nói được `<script>` đồng bộ phải đợi CSS phía trên, và phân biệt `defer` với `async`
- [ ] Phân biệt layout / paint / composite và biết animate `transform` thay vì `left`
- [ ] Giải thích layout thrashing và biết cách tách đọc-ghi thành nhóm
- [ ] Kể được 5 thuộc tính gây forced layout khi đọc
- [ ] Biết vì sao `innerHTML +=` trong vòng lặp là hành vi bậc hai và làm mất listener
- [ ] Biết `content-visibility: auto` và giới hạn của nó so với ảo hoá
- [ ] Nói được quan hệ giữa long task và INP, kèm ngưỡng 200 ms
- [ ] Biết công thức CLS và vì sao dịch chuyển 300 px vẫn có thể ra điểm thấp
- [ ] Biết khi nào có preflight, và biết **request thật không được gửi** khi preflight fail
- [ ] Biết CORS **không** bảo vệ server
- [ ] Phân biệt `no-cache` và `no-store`, và biết chiến lược cache cho SPA
- [ ] Biết vì sao các thủ thuật thời HTTP/1.1 (gộp file, sprite, domain sharding) nay có hại

→ [frontend/02](../frontend/02-trinh-duyet-render-va-mang.md)

## H — React (14 điểm)

- [ ] Kể đủ 4 nguyên nhân khiến component render lại
- [ ] Biết `memo` **vô tác dụng** khi props chứa hàm inline
- [ ] Nói được 3 trường hợp `useMemo`/`useCallback` thật sự cần
- [ ] Kể được 3 kiểu dùng sai `useEffect` và cách sửa từng cái
- [ ] Biết dùng `key` để reset component thay vì `useEffect`
- [ ] Giải thích được vì sao context không memo hoá làm consumer render lại
- [ ] Biết 3 cách giảm render do context, kể cả tách state và dispatch
- [ ] Phân biệt server state và client state, và biết bộ lọc/phân trang thuộc về **URL**
- [ ] Mô tả được cập nhật lạc quan đủ 4 bước, kể cả bước huỷ query đang bay
- [ ] Giải thích stale closure và 3 cách sửa
- [ ] Giải thích vì sao `key={index}` gây lỗi, kèm ví dụ cụ thể
- [ ] Biết nguyên nhân của cảnh báo "changing an uncontrolled input to be controlled"
- [ ] Nói được Server Component khác Client Component ở đâu và quy tắc đẩy `'use client'` xuống sâu
- [ ] Kể được 4 thứ error boundary **không** bắt được

→ [frontend/03](../frontend/03-react-va-quan-ly-state.md)

## I — Hiệu năng và kiến trúc (12 điểm)

- [ ] Biết `import { x } from 'lodash'` **không** tree-shake được và lý do
- [ ] Kể được 4 nguyên nhân tree shaking thất bại, kể cả barrel file
- [ ] Nói được 6 ứng viên tách chunk theo thứ tự giá trị
- [ ] Biết preload chunk khi chuột di vào link
- [ ] Nói được 3 chỉ số Core Web Vitals và ngưỡng, và biết INP đã thay FID
- [ ] Phân rã được LCP thành 4 phần và biết sai lầm lazy load ảnh LCP
- [ ] Phân biệt preload / prefetch / preconnect / dns-prefetch
- [ ] Biết vì sao preload sai làm chậm thứ khác
- [ ] Biết chi phí truyền dữ liệu của Web Worker và ngưỡng nên dùng
- [ ] So sánh SSR / SSG / ISR / CSR và biết vấn đề hydration
- [ ] Kể được 4 nguyên nhân hydration mismatch, kể cả HTML không hợp lệ
- [ ] Biết dùng `sendBeacon` cho RUM và biết phân tích theo p75 chia nhóm

→ [frontend/04](../frontend/04-hieu-nang-va-do-luong.md), [frontend/05](../frontend/05-kien-truc-testing-va-tinh-huong.md)

---

# PHẦN CHUNG (20 điểm)

## J — System design (10 điểm)

- [ ] Nhớ được khung 45 phút và biết 7 phút đầu dành cho làm rõ yêu cầu
- [ ] Thuộc bộ 7 câu hỏi làm rõ và dùng được ngay
- [ ] Ước lượng được QPS từ số người dùng mà không cần máy tính
- [ ] Biết bậc độ lớn: đọc RAM, SSD, Redis, query DB, vòng mạng trong DC và xuyên châu
- [ ] Nói được 4 cách sinh mã ngắn và vì sao cấp phát dải là tốt nhất
- [ ] Giải thích được fan-out on write vs on read và vì sao phải kết hợp
- [ ] Biết vì sao kết nối WebSocket gắn với một pod và cách giải quyết
- [ ] Thiết kế được giữ chỗ có hạn bằng một câu `UPDATE` nguyên tử
- [ ] Kể được 6 lỗi làm trượt vòng system design
- [ ] Nêu được ít nhất 3 đánh đổi trong mỗi đề mình trình bày

→ [chung/01](./01-system-design.md)

## K — Hành vi và giao tiếp (10 điểm)

- [ ] Có sẵn 6 câu chuyện, mỗi câu 2 phút, mỗi câu có ít nhất 3 con số
- [ ] Kể được một sự cố production, kết thúc bằng **thay đổi phòng ngừa**
- [ ] Kể được một quyết định kỹ thuật, nêu được phương án đã **loại bỏ** và vì sao
- [ ] Kể được một lần mình sai, với bài học ở mức hệ thống chứ không phải "cẩn thận hơn"
- [ ] Kể được một bất đồng, và **ghi nhận điểm đúng của người kia**
- [ ] Trả lời được "điểm yếu" bằng điểm yếu thật + hậu quả + cơ chế kiểm soát
- [ ] Trả lời được "vì sao rời công ty cũ" theo hướng **tới**, không phải hướng **ra khỏi**
- [ ] Nói được "em" thay vì "team em" khi kể việc mình làm
- [ ] Có sẵn 8–10 câu hỏi ngược lại, phân theo người phỏng vấn
- [ ] Nhận ra được 6 dấu hiệu cảnh báo về công ty

→ [chung/02](./02-cau-hoi-hanh-vi.md), [chung/03](./03-cau-hoi-nguoc-lai.md)

---

## Cách chấm

| Điểm | Nghĩa là |
|---|---|
| **< 60** | Còn nhiều lỗ hổng nền tảng. Đọc tuần tự từ đầu, đừng nhảy cóc. |
| **60–95** | Nền tảng ổn, thiếu chiều sâu. Tập trung vào các mục ❌ và **chạy lại thí nghiệm** của những mục đó. |
| **95–125** | Sẵn sàng cho phần lớn buổi phỏng vấn. Luyện nói thành tiếng và luyện system design. |
| **> 125** | Chuyển sang luyện trình bày: bấm giờ, ghi âm, và chuẩn bị con số của chính mình. |

**Quan trọng hơn điểm số:** với mỗi mục ❌, đừng chỉ đọc đáp án. **Chạy lại thí nghiệm** trong bài
tương ứng và ghi số của bạn. Ở phỏng vấn senior, "em đo được X trên máy em" là câu trả lời mà không
ai học thuộc được.

---

Quay lại: [../README.md](../README.md)
