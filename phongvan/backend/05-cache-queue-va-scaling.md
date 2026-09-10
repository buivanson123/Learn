# Cache, hàng đợi và mở rộng — 18 câu

Ba chủ đề này luôn đi cùng nhau ở phỏng vấn senior, vì chúng là ba câu trả lời cho cùng một câu
hỏi: *"hệ thống của bạn làm gì khi lượng việc vượt quá khả năng xử lý tức thời?"*

---

## Phần 1 — Cache (câu 1–7)

### 1. Cache-aside, write-through, write-behind — khác nhau và chọn cái nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cache-aside (app tự đọc cache, miss thì đọc DB rồi ghi vào cache) là mặc định
đúng cho hơn 90% trường hợp. Write-through ghi cả hai cùng lúc, đổi độ trễ ghi lấy cache luôn nóng.
Write-behind ghi cache trước, DB sau — nhanh nhất và **có thể mất dữ liệu**.

**Giải thích sâu:**

```js
// Cache-aside
let user = await redis.get(`user:${id}`);
if (!user) {
  user = await db.findUser(id);
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300);
}
```

Ưu điểm ít người nói ra: cache-aside **chịu được việc Redis chết**. Redis sập thì mọi lần đọc là
cache miss, hệ thống chậm đi nhưng vẫn đúng. Write-behind thì Redis chết là **mất dữ liệu chưa kịp
ghi xuống DB** — đó là lý do nó chỉ hợp cho dữ liệu chấp nhận mất được (bộ đếm lượt xem, vị trí
phát video), không bao giờ cho dữ liệu nghiệp vụ.

Nhược của cache-aside phải thừa nhận: lần đọc đầu luôn chậm (cold start), và có khoảng hở nhỏ giữa
đọc DB và ghi cache nơi dữ liệu cũ có thể bị ghi đè lên dữ liệu mới. Khoảng hở đó nhỏ nhưng có
thật, và cách giảm là đặt TTL ngắn cho dữ liệu nhạy cảm.

</details>

### 2. Khi dữ liệu thay đổi, nên cập nhật cache hay xoá cache?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Xoá.** Cập nhật tạo ra tình huống hai request ghi đè lẫn nhau và để lại giá trị
sai vĩnh viễn trong cache. Xoá thì lần đọc sau tự nạp lại từ nguồn sự thật.

**Giải thích sâu:** Vì sao "cập nhật" hỏng — chuỗi sự kiện này xảy ra thật khi có tải:

```
T0  Request A ghi DB: name = "An"
T1  Request B ghi DB: name = "Bình"
T2  Request B cập nhật cache: "Bình"
T3  Request A cập nhật cache: "An"      ← A chậm hơn, ghi đè
    -> DB nói "Bình", cache nói "An", và TTL 1 giờ nữa mới hết
```

Xoá cache thì trường hợp xấu nhất chỉ là một lần cache miss — chi phí là một query, không phải dữ
liệu sai.

**Thứ tự cũng quan trọng: ghi DB trước, xoá cache sau.** Xoá trước rồi mới ghi DB thì trong khoảng
giữa, một request đọc có thể nạp lại giá trị **cũ** vào cache.

Ngay cả thứ tự đúng vẫn còn khoảng hở lý thuyết rất hẹp (một request đọc bị treo đúng khoảnh khắc
đó). Các cách xử lý theo mức độ nghiêm ngặt:
- Chấp nhận, đặt TTL ngắn — đủ cho hầu hết hệ thống.
- **Xoá hai lần** (delayed double delete): xoá, ghi DB, đợi vài trăm ms rồi xoá lần nữa.
- Đọc thay đổi từ WAL/binlog (Debezium) và xoá cache theo đó — đáng tin nhất, và nặng nhất.

Câu chốt: "Cache là bản sao. Với bản sao, em chọn cách **vứt đi** thay vì cách **sửa cho khớp** —
vứt đi thì trường hợp xấu nhất là chậm, còn sửa sai thì trường hợp xấu nhất là sai."

</details>

### 3. Cache stampede là gì và chống thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Một key nóng hết hạn, hàng nghìn request cùng miss và cùng lao xuống database
trong cùng một khoảnh khắc. Chống bằng khoá (chỉ một request được nạp lại), hoặc bằng hết hạn sớm
theo xác suất.

**Giải thích sâu:** Nó tệ vì nó xảy ra đúng lúc bạn đang có nhiều traffic nhất — key càng nóng thì
cú đập càng mạnh.

Ba cách, dùng kết hợp được:

**1. Khoá nạp lại (mutex / single-flight):**
```js
const v = await redis.get(key);
if (v) return JSON.parse(v);
const gotLock = await redis.set(`lock:${key}`, '1', 'NX', 'PX', 5000);
if (gotLock) { const fresh = await db.query(); await redis.set(key, ..., 'EX', 300); return fresh }
// không lấy được khoá: đợi ngắn rồi đọc lại cache, hoặc trả dữ liệu cũ
```

**2. Hết hạn sớm theo xác suất.** Lưu kèm thời điểm sinh; mỗi lần đọc, tính xác suất làm mới tăng
dần khi gần hết hạn. Kết quả là cache được làm mới **rải rác trước** khi hết hạn, không có thời
điểm nào tất cả cùng miss.

**3. Trả dữ liệu cũ trong lúc làm mới (stale-while-revalidate).** Đặt hai mốc: TTL mềm 5 phút, TTL
cứng 30 phút. Quá 5 phút thì trả dữ liệu cũ ngay cho user **và** kích hoạt làm mới ở nền. User
không bao giờ phải chờ.

Biến thể thường gặp mà ít ai phòng: **hết hạn đồng loạt (cache avalanche)**. Nạp 10 nghìn key cùng
lúc khi khởi động với TTL cố định 300 giây → 300 giây sau, cả 10 nghìn cùng hết hạn. Cách chống chỉ
là một dòng: **TTL cộng thêm nhiễu ngẫu nhiên**, `EX 300 + random(0..60)`.

Và **cache penetration**: query một id **không tồn tại** thì không bao giờ có gì để cache, nên mọi
request đều xuống DB. Kẻ tấn công bắn `/users/-1` liên tục là đủ. Chống bằng cách cache cả kết quả
rỗng với TTL ngắn (30–60 giây), hoặc bằng bloom filter.

</details>

### 4. Đặt TTL bao nhiêu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** TTL trả lời câu hỏi nghiệp vụ **"dữ liệu cũ bao lâu thì gây hại?"**, không phải
câu hỏi kỹ thuật. Không có con số chuẩn, nhưng có một cách suy nghĩ chuẩn.

**Giải thích sâu:**

| Dữ liệu | TTL | Vì sao |
|---|---|---|
| Danh mục, cấu hình, tỉnh/thành | giờ tới ngày | gần như không đổi |
| Thông tin sản phẩm | 5–15 phút | đổi thì cũng chỉ lệch vài phút |
| Tồn kho | không cache, hoặc vài giây | sai là bán quá số hàng có |
| Giỏ hàng, session | theo phiên | thuộc về một user |
| Số dư, hạn mức tín dụng | **không cache** | sai là mất tiền |
| Kết quả tìm kiếm | 1–5 phút | chấp nhận trễ, tốn kém để tính |

Điểm quan trọng nhất và hay bị bỏ qua: **TTL không phải cơ chế đảm bảo tính đúng đắn, nó là lưới an
toàn.** Cơ chế chính là chủ động xoá khi dữ liệu đổi (câu 2). TTL có mặt để dọn những trường hợp
xoá bị lỡ — vì sẽ có lúc lỡ.

Ngược lại, đừng để TTL quá dài chỉ vì "để cache hiệu quả hơn". Một cache TTL 24 giờ nghĩa là một
dữ liệu sai sẽ tồn tại 24 giờ, và bạn sẽ phải xoá tay lúc nửa đêm.

Cách nói ăn điểm: hỏi ngược lại **"nếu user thấy dữ liệu cũ 5 phút thì chuyện gì xảy ra?"** — nếu
câu trả lời là "không sao" thì cache thoải mái; nếu là "khách khiếu nại" thì phải xoá chủ động; nếu
là "mất tiền" thì đừng cache.

</details>

### 5. Cache ở những tầng nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Từ ngoài vào trong: trình duyệt → CDN → reverse proxy → cache ứng dụng (Redis) →
cache trong tiến trình → cache của chính database. Cache càng gần user càng rẻ và càng nhanh, nhưng
càng khó vô hiệu hoá.

**Giải thích sâu:**

| Tầng | Độ trễ | Vô hiệu hoá |
|---|---|---|
| Trình duyệt | 0 | **gần như không thể** — phải đợi hết hạn |
| CDN | 10–50 ms | purge API, vài giây tới vài phút |
| Reverse proxy (Nginx, Varnish) | 1–5 ms | dễ, tự quản |
| Redis dùng chung | 0.5–2 ms | dễ, tức thì |
| Trong tiến trình (Map, LRU) | ~0 | **khó** — mỗi pod một bản, phải phát tin |
| Buffer cache của DB | — | tự động |

Hai chỗ nguy hiểm nhất:

**Cache trình duyệt.** Đặt `Cache-Control: max-age=31536000` cho một file JS rồi phát hiện bug —
bạn không thu hồi được. Đó là lý do tài sản tĩnh phải có **hash trong tên file**
(`app.9f2c1a.js`, cache vĩnh viễn) còn `index.html` thì `no-cache`. Đổi nội dung là đổi tên file,
không cần vô hiệu hoá gì cả.

**Cache trong tiến trình.** Nhanh nhất nhưng mỗi pod giữ một bản riêng, nên khi dữ liệu đổi, các
pod không đồng ý với nhau. Chỉ dùng cho dữ liệu gần như bất biến (cấu hình, feature flag) với TTL
ngắn, hoặc kết hợp: cache trong tiến trình 10 giây + Redis pub/sub để phát tin xoá.

Kiến trúc hai tầng này có tên là **cache nhiều lớp**, và nó rất hiệu quả cho key siêu nóng: nó chặn
luôn cả traffic tới Redis, thứ mà nếu đủ nóng cũng sẽ trở thành nút cổ chai.

</details>

### 6. Redis chết thì hệ thống của bạn thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Phải trả lời được cụ thể cho **từng cách dùng Redis** trong hệ thống. Nếu Redis
chỉ làm cache thì hệ thống chậm nhưng sống. Nếu Redis giữ session hoặc rate limit thì nó là điểm
chết duy nhất và phải thiết kế riêng.

**Giải thích sâu:** Đây là câu hỏi phân biệt rõ nhất giữa "biết dùng Redis" và "đã trực Redis trên
production". Bảng cần chuẩn bị sẵn trong đầu:

| Redis dùng làm gì | Khi Redis chết | Chuẩn bị |
|---|---|---|
| Cache | mọi request xuống DB → DB có thể sập theo | circuit breaker + giới hạn đồng thời khi gọi DB |
| Session | **toàn bộ user bị đăng xuất** | JWT ngắn hạn, hoặc Redis có replica + Sentinel |
| Rate limit | mất bảo vệ (fail-open) hoặc chặn hết (fail-closed) | fail-open + cảnh báo, fail-closed cho login |
| Distributed lock | mất bảo vệ chống trùng | ràng buộc unique ở DB làm lưới cuối |
| Hàng đợi | **mất job** nếu không bật AOF | dùng broker có bảo đảm bền, hoặc bật AOF |

Điểm nguy hiểm nhất, phải nói ra: **Redis chết kéo sập database.** Bình thường Redis chặn 95%
lượt đọc; nó chết là DB nhận gấp 20 lần tải, sập theo, và khi Redis sống lại thì DB vẫn đang quá
tải nên cache không nạp lại được. Đây là kiểu sự cố tự duy trì rất khó thoát.

Cách phòng: khi cache miss hàng loạt, **giới hạn số lượt gọi DB đồng thời** (semaphore) và trả lỗi
nhanh cho phần còn lại. Thà 30% user thấy lỗi trong 2 phút còn hơn 100% user thấy lỗi trong 30 phút.

</details>

### 7. Redis đầy RAM thì sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tuỳ `maxmemory-policy`. Mặc định `noeviction` — Redis **từ chối mọi lệnh ghi** và
trả lỗi `OOM command not allowed`. Dùng làm cache thì phải đổi sang `allkeys-lru`.

**Giải thích sâu:** Các chính sách và khi nào dùng:

| Policy | Hành vi | Dùng khi |
|---|---|---|
| `noeviction` | báo lỗi khi ghi | Redis là kho dữ liệu, không phải cache |
| `allkeys-lru` | xoá key ít dùng gần đây nhất | **cache thuần** — lựa chọn đúng nhất |
| `allkeys-lfu` | xoá key ít được dùng nhất (theo tần suất) | có key nóng ổn định lâu dài |
| `volatile-lru` | chỉ xoá key **có TTL** | Redis vừa làm cache vừa giữ dữ liệu bền |

Bẫy phổ biến: dùng `volatile-lru` nhưng quên đặt TTL cho phần lớn key → Redis không có gì để xoá →
hành vi y hệt `noeviction`, và bạn nhận lỗi OOM dù đã "cấu hình eviction".

Bẫy thứ hai: dùng chung một Redis cho cache và cho hàng đợi/session. Cache phình lên đẩy job trong
hàng đợi ra khỏi bộ nhớ. **Tách instance** (hoặc ít nhất tách theo database index và theo dõi riêng)
cho hai mục đích có yêu cầu bền vững khác nhau.

Việc cần làm định kỳ: chạy `redis-cli --bigkeys` và `MEMORY USAGE <key>` để tìm key khổng lồ. Một
key kiểu Hash chứa 2 triệu field không chỉ tốn RAM mà còn làm mọi lệnh động tới nó chặn luồng đơn
của Redis — quay lại đúng vấn đề của `KEYS *`.

</details>

---

## Phần 2 — Hàng đợi và xử lý nền (câu 8–13)

### 8. Khi nào cần queue?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi công việc (1) không cần xong ngay để trả lời user, (2) có thể thất bại và cần
thử lại, hoặc (3) có tốc độ đến không đều mà bạn muốn xử lý đều.

**Giải thích sâu:** Ví dụ cụ thể cho từng lý do:

1. **Không cần xong ngay**: gửi email xác nhận, tạo thumbnail, đồng bộ sang CRM, ghi analytics.
   Người dùng không cần chờ 3 giây để nhận HTTP 200.
2. **Cần retry**: gọi API bên thứ ba. Trong request HTTP bạn chỉ retry được vài giây; trong queue
   bạn retry được 3 ngày với backoff.
3. **San bằng tải**: 10 nghìn đơn hàng đổ vào lúc 12:00 flash sale. Queue biến một đỉnh nhọn thành
   một dòng đều mà worker xử lý kịp, thay vì làm sập hệ thống.

Cái giá phải nói ra, nếu không sẽ bị coi là chỉ thấy mặt tốt:
- **Nhất quán cuối**: user bấm xong nhưng kết quả chưa có → giao diện phải thể hiện được trạng thái
  "đang xử lý", nếu không họ sẽ bấm lại.
- **Thêm một hệ thống phải vận hành**, theo dõi, và xử lý khi nó nghẽn.
- **Debug khó hơn**: lỗi không còn ở trong stack trace của request nữa.
- **Thứ tự không được bảo đảm** trừ khi bạn cấu hình riêng.

Khi **không** nên dùng queue: việc cần kết quả ngay (xác thực, kiểm tra tồn kho lúc thanh toán), và
việc chạy chưa tới 50 ms (chi phí đẩy vào queue và lấy ra còn lớn hơn chính công việc).

</details>

### 9. At-least-once, at-most-once, exactly-once — thực tế được cái nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Thực tế chọn giữa at-least-once (có thể trùng) và at-most-once (có thể mất).
"Exactly-once" đúng nghĩa không tồn tại trong hệ phân tán; cái người ta gọi là exactly-once thực
chất là **at-least-once + consumer idempotent**.

**Giải thích sâu:** Vì sao không có exactly-once — khoảng hở luôn tồn tại ở đâu đó:

```
Xử lý xong -> ack  : chết giữa hai bước -> job chạy LẠI      (at-least-once)
Ack -> xử lý       : chết giữa hai bước -> job MẤT           (at-most-once)
```

Không có cách nào làm hai thao tác ở hai hệ thống khác nhau trở thành nguyên tử. Đó là lý do gần
như mọi broker chọn at-least-once và đẩy trách nhiệm khử trùng lặp sang consumer.

Cách làm consumer idempotent, theo thứ tự nên ưu tiên:

1. **Thao tác vốn dĩ idempotent**: `SET status='paid'` chạy 10 lần vẫn thế. `balance = balance + 100`
   thì không.
2. **Bảng khử trùng lặp**: `INSERT INTO processed(message_id) ...` với `message_id` là khoá chính,
   nằm **cùng transaction** với việc nghiệp vụ. Trùng thì vi phạm khoá chính và bạn bỏ qua.
3. **Khoá điều kiện**: `UPDATE orders SET status='paid' WHERE id=? AND status='pending'`. `rowCount
   = 0` nghĩa là đã xử lý rồi.

Câu ăn điểm: "Em thiết kế với giả định **mọi message sẽ được nhận ít nhất hai lần**. Nếu điều đó
không gây hại thì hệ thống đúng; nếu nó gây hại thì em chưa làm xong."

</details>

### 10. Job thất bại thì xử lý thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Retry với backoff luỹ thừa có jitter, giới hạn số lần, rồi đẩy vào **dead letter
queue**. Quan trọng nhất là DLQ phải có người theo dõi và có cách chạy lại.

**Giải thích sâu:** Cấu hình mẫu và lý do từng con số:

```
Lần 1: sau 10 giây      -- lỗi mạng thoáng qua
Lần 2: sau 1 phút
Lần 3: sau 5 phút
Lần 4: sau 30 phút      -- đủ để upstream hồi phục sau sự cố ngắn
Lần 5: sau 2 giờ        -- đủ để người trực xử lý sự cố dài
-> DLQ
```

Có jitter ở mọi mốc, nếu không 10 nghìn job cùng thất bại sẽ cùng retry một lúc và đánh sập lại thứ
vừa hồi phục.

Phân biệt loại lỗi — đây là chỗ hay bị làm ẩu:

| Loại | Ví dụ | Xử lý |
|---|---|---|
| Tạm thời | timeout, 503, mất kết nối | retry |
| Vĩnh viễn | dữ liệu sai định dạng, bản ghi đã bị xoá | **vào thẳng DLQ**, đừng retry |
| Bug trong code | `TypeError` | vào DLQ, sửa code rồi chạy lại |
| Đầu độc (poison) | payload làm crash worker | phải phát hiện, nếu không nó giết worker mãi |

Job "đầu độc" là bẫy kinh điển: một message làm worker crash → broker không nhận được ack → giao
lại cho worker khác → worker đó cũng crash. Cả cụm worker chết dần vì một message. Vì vậy broker
phải đếm số lần giao (`delivery count`) và tự chuyển vào DLQ khi vượt ngưỡng.

Về DLQ, ba điều bắt buộc:
- **Cảnh báo khi DLQ có bản ghi.** Một DLQ không ai nhìn chỉ là thùng rác — lúc phát hiện thì đã
  mất 10 nghìn đơn hàng.
- **Lưu đủ ngữ cảnh**: payload gốc, lỗi cuối, số lần thử, thời điểm.
- **Có nút chạy lại** sau khi sửa nguyên nhân.

</details>

### 11. Làm hàng đợi bằng chính PostgreSQL — được không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Được, và với đa số hệ thống thì đó là lựa chọn **đúng** — nhờ `FOR UPDATE SKIP
LOCKED`. Lợi ích lớn nhất: job và dữ liệu nghiệp vụ nằm trong **cùng một transaction**.

**Giải thích sâu:** Đo thật với hai worker cùng lấy việc từ bảng `jobs` (6 job đang chờ):

```sql
-- WORKER A
BEGIN; SELECT id,payload FROM jobs WHERE status='pending'
       ORDER BY id LIMIT 2 FOR UPDATE SKIP LOCKED;
 id | payload
----+---------
  1 | job1
  2 | job2

-- WORKER B (chạy đồng thời)
BEGIN; SELECT id,payload FROM jobs WHERE status='pending'
       ORDER BY id LIMIT 2 FOR UPDATE SKIP LOCKED;
 id | payload
----+---------
  3 | job3          ← nhận job KHÁC, không chờ, không trùng
  4 | job4
```

Bỏ `SKIP LOCKED` đi thì hành vi đổi hẳn:

```
WORKER B:  BEGIN; SELECT ... FOR UPDATE;
  ... 2 giây: B vẫn đang CHỜ, không làm gì cả
  (A commit xong)
 id
----
  1
  2               ← và nhận đúng job A vừa cầm
```

Hai vấn đề trong một: worker B **đứng im** thay vì làm việc khác, rồi lấy đúng job đã bị xử lý.
`SKIP LOCKED` sinh ra chính xác để giải quyết chuyện này.

Lợi ích quyết định của queue trên Postgres — **nguyên tử với nghiệp vụ**:

```js
await db.transaction(async tx => {
  await tx.insert(orders, order);
  await tx.insert(jobs, { type:'send_invoice', payload:{ orderId: order.id } });
});
// rollback thì cả đơn hàng lẫn job cùng biến mất. Với Redis/RabbitMQ, không làm được điều này.
```

Khi nào phải chuyển sang broker chuyên dụng:
- Thông lượng rất lớn (trên vài nghìn job/giây liên tục) — polling bắt đầu tốn kém, dù
  `LISTEN/NOTIFY` giúp giảm nhiều.
- Cần fan-out cho nhiều consumer group độc lập → Kafka.
- Cần định tuyến phức tạp theo topic/pattern → RabbitMQ.
- Cần giữ lại và phát lại lịch sử sự kiện → Kafka.

Câu trả lời được đánh giá cao: **"Em bắt đầu bằng bảng job trong Postgres. Nó xử lý được tới quy mô
xa hơn nhiều so với người ta tưởng, và nó tiết kiệm cho team cả một hệ thống phải vận hành. Em
chuyển sang Kafka khi có lý do cụ thể chứ không phải vì nó nghe chuyên nghiệp hơn."**

</details>

### 12. Kafka khác RabbitMQ ở chỗ nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Kafka là **log bền, có thứ tự, đọc lại được** — consumer tự giữ vị trí đọc.
RabbitMQ là **broker hàng đợi** — message được giao rồi biến mất. Kafka hợp với luồng sự kiện,
RabbitMQ hợp với phân phối công việc.

**Giải thích sâu:**

| | Kafka | RabbitMQ |
|---|---|---|
| Mô hình | log ghi thêm, giữ lại theo thời gian | hàng đợi, xoá sau khi ack |
| Đọc lại lịch sử | **có** — tua lại offset | không |
| Thứ tự | bảo đảm trong một partition | bảo đảm trong một queue |
| Định tuyến | consumer tự chọn topic/partition | exchange linh hoạt (topic, header, fanout) |
| Nhiều consumer group độc lập | tự nhiên | phải nhân bản queue |
| Ưu tiên job, TTL từng message | không | có |
| Thông lượng | rất cao | cao |

Điểm quyết định thường là: **"có cần đọc lại không?"** Nếu bạn muốn thêm một service mới hôm nay và
cho nó xử lý toàn bộ sự kiện của 30 ngày qua, đó là Kafka. Nếu message chỉ là "hãy làm việc này
giùm tôi" thì RabbitMQ (hoặc bảng job trong Postgres) đơn giản hơn nhiều.

Điều quan trọng phải hiểu về Kafka: **partition là đơn vị song song, và cũng là đơn vị thứ tự.**
Hệ quả trực tiếp:
- Số consumer trong một group **không vượt được** số partition — thừa consumer sẽ ngồi không.
- Muốn các sự kiện của cùng một user giữ đúng thứ tự thì phải dùng `user_id` làm key để chúng rơi
  vào cùng partition.
- Tăng số partition sau này sẽ **làm đổi ánh xạ key → partition**, phá vỡ thứ tự trong giai đoạn
  chuyển tiếp. Đây là lý do chọn số partition là quyết định cần cân nhắc từ đầu.

</details>

### 13. Worker xử lý chậm hơn tốc độ job đổ vào — làm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trước tiên đo xem worker chậm ở đâu, vì thêm worker mà nút cổ chai là database
thì chỉ làm mọi thứ tệ hơn. Sau đó theo thứ tự: tối ưu job, tăng số worker, gom lô, giảm nguồn.

**Giải thích sâu:** Chỉ số phải theo dõi: **độ sâu hàng đợi** và **tuổi của job cũ nhất**. Con số
thứ hai quan trọng hơn — hàng đợi 100 nghìn job mà job cũ nhất 30 giây thì ổn; hàng đợi 500 job mà
job cũ nhất 2 giờ thì có gì đó đang kẹt.

Thứ tự xử lý:

```
1. Job đang làm gì? Thường 80% thời gian nằm ở một chỗ:
   - gọi API bên ngoài chậm       -> tăng đồng thời, hoặc gom lô, hoặc đặt timeout chặt hơn
   - query DB chậm                -> thêm worker sẽ LÀM TỆ HƠN, phải sửa query trước
   - CPU (resize ảnh, PDF)        -> thêm worker theo số lõi
2. Tăng số worker — nhưng kiểm tra pool kết nối DB trước (xem 01-runtime câu 12)
3. Gom lô: 1000 job gửi 1000 email -> 1 lời gọi API gửi 1000 email
4. Tách hàng đợi theo độ ưu tiên: email quên mật khẩu không được xếp sau 50 nghìn job báo cáo
5. Giảm nguồn: gộp trùng lặp (10 lần cập nhật cùng một bản ghi -> 1 job), hoặc bỏ job đã lỗi thời
```

Bước 4 đáng nhấn mạnh vì nó ảnh hưởng trực tiếp tới người dùng: một hàng đợi chung nghĩa là job
quan trọng nhất phải xếp sau job ít quan trọng nhất. **Hàng đợi riêng cho việc nhạy cảm với độ
trễ** là thay đổi rẻ và hiệu quả nhất trong danh sách này.

Và câu hỏi cần đặt ra ở mức senior: **"tồn đọng này là tạm thời hay là xu hướng?"** Tạm thời (sau
flash sale) thì để nó tự tiêu. Xu hướng (mỗi ngày một dài hơn) thì thêm worker chỉ là hoãn binh —
phải sửa gốc.

</details>

---

## Phần 3 — Mở rộng và vận hành (câu 14–18)

### 14. Stateless nghĩa là gì và vì sao nó quan trọng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Server không giữ dữ liệu riêng của từng user giữa các request. Quan trọng vì chỉ
khi stateless thì bạn mới scale ngang được: request nào đi vào pod nào cũng ra kết quả như nhau, và
pod chết không mất gì.

**Giải thích sâu:** Những thứ vô tình làm server có trạng thái:

| Thứ | Vấn đề | Thay bằng |
|---|---|---|
| Session trong RAM | user bị đăng xuất khi pod restart hoặc rơi vào pod khác | Redis hoặc JWT |
| File upload lưu trên đĩa local | pod khác không thấy file | S3 |
| Cache trong biến toàn cục | mỗi pod một kết quả khác nhau | Redis, hoặc TTL rất ngắn |
| Cron chạy trong app | 5 pod = job chạy 5 lần | CronJob riêng, hoặc khoá phân tán |
| Kết nối WebSocket | tin nhắn chỉ tới được pod đang giữ kết nối | Redis pub/sub |
| Rate limit đếm trong RAM | giới hạn thật = giới hạn × số pod | Redis |

Mục "cron chạy trong app" là bẫy hay gặp nhất và hậu quả rất cụ thể: job gửi email nhắc nhở chạy 5
lần nghĩa là khách hàng nhận 5 email giống nhau.

Sticky session (LB luôn gửi user về đúng pod cũ) là cách "chữa cháy" cho session in-memory, nhưng
nó mang lại vấn đề mới: tải phân bố lệch, và deploy vẫn đăng xuất mọi người. Nó là giải pháp tạm,
không phải kiến trúc.

Ngoại lệ hợp lệ đáng nhắc để cho thấy bạn không giáo điều: WebSocket **buộc** phải có trạng thái
(kết nối gắn với một pod). Cách xử lý không phải là ép nó stateless mà là chấp nhận và thiết kế
quanh nó: Redis pub/sub để mọi pod gửi được tin, và client tự kết nối lại có backoff.

</details>

### 15. Scale dọc hay scale ngang?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Scale dọc (máy to hơn) trước, vì nó đơn giản và đi xa hơn nhiều so với người ta
tưởng. Scale ngang khi cần chịu lỗi, hoặc khi đã chạm trần của máy lớn nhất, hoặc khi tải dao động
mạnh và bạn muốn trả tiền theo nhu cầu.

**Giải thích sâu:** Vì sao nên nói "dọc trước" ở phỏng vấn — nó cho thấy bạn cân nhắc chi phí thật
của độ phức tạp:

| | Dọc | Ngang |
|---|---|---|
| Độ phức tạp | gần như bằng 0 | LB, service discovery, state ở ngoài, deploy nhiều bản |
| Chịu lỗi | **một máy chết là hết** | mất một node vẫn chạy |
| Trần | có trần vật lý | gần như không |
| Chi phí | tăng phi tuyến ở máy rất lớn | tuyến tính |
| Dừng máy khi nâng cấp | thường phải | không |

Với **tầng ứng dụng** stateless thì scale ngang dễ nên cứ làm. Với **database** thì scale dọc đi rất
xa: một Postgres trên máy 64 lõi / 512 GB RAM phục vụ được lượng tải lớn hơn nhiều so với hình dung
thông thường, và nó giữ nguyên transaction, JOIN, ràng buộc — những thứ bạn sẽ mất khi shard.

Trình tự thực dụng: tối ưu query → scale dọc DB → read replica → cache → tách service → shard.
Chi tiết ở [02-database câu 18](./02-database-va-truy-van.md).

</details>

### 16. Autoscaling theo chỉ số nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Theo chỉ số phản ánh **công việc đang chờ**, không phải theo CPU. Với API là số
request đồng thời hoặc độ trễ p95; với worker là độ sâu hàng đợi.

**Giải thích sâu:** Vì sao CPU là chỉ số kém cho ứng dụng Node/IO-bound: app chờ database thì CPU
thấp trong khi mọi request đều chậm. Autoscaler nhìn CPU 30% và kết luận "vẫn ổn" trong lúc user
đang timeout.

| Loại workload | Chỉ số nên dùng |
|---|---|
| API IO-bound (Node, Python) | request đồng thời, hoặc p95 latency |
| API CPU-bound (xử lý ảnh, ML) | CPU là hợp lý |
| Worker | độ sâu hàng đợi / số worker |
| Có traffic theo lịch cố định | **scale theo lịch**, đơn giản và đáng tin nhất |

Ba cái bẫy của autoscaling:

1. **Khởi động chậm.** Pod mất 60 giây để sẵn sàng (cài đặt, JIT nóng lên, cache rỗng) thì
   autoscaler luôn phản ứng chậm hơn cú tăng traffic một phút — đúng một phút mà user chịu lỗi.
   Cách chữa: scale theo chỉ số **dẫn dắt** (số request đang vào) chứ không phải chỉ số **theo sau**
   (độ trễ), và giữ một ít dự phòng.
2. **Dao động (flapping).** Scale lên rồi xuống liên tục. Cần thời gian ổn định (cooldown) và ngưỡng
   lên/xuống khác nhau.
3. **Đẩy vấn đề xuống dưới.** Tăng gấp 3 số pod là tăng gấp 3 số kết nối tới database. Autoscaling
   tầng app mà không nghĩ tới database là cách phổ biến để biến sự cố nhỏ thành sự cố lớn.

</details>

### 17. Hệ thống của bạn cần theo dõi những gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bốn tín hiệu vàng: độ trễ, lưu lượng, tỷ lệ lỗi, mức bão hoà. Cộng với chỉ số
nghiệp vụ — thứ thường phát hiện sự cố **trước** cả chỉ số kỹ thuật.

**Giải thích sâu:**

```
Latency     p50 / p95 / p99, tách riêng request thành công và request lỗi
            (trộn vào nhau thì một loạt lỗi trả về nhanh sẽ LÀM ĐẸP biểu đồ)
Traffic     request/giây theo endpoint
Errors      tỷ lệ 5xx, tỷ lệ 4xx (4xx tăng đột biến = client đang gãy hoặc bị tấn công)
Saturation  CPU, RAM, kết nối DB đã dùng/tối đa, độ sâu hàng đợi, độ trễ event loop
```

Ghi chú trong ngoặc ở dòng Latency là một chi tiết rất đáng nói ở phỏng vấn — nó là lỗi đo lường
thật khiến nhiều đội không thấy sự cố của mình.

**Chỉ số nghiệp vụ** thường nhạy hơn tất cả: số đơn hàng mỗi phút, tỷ lệ thanh toán thành công, số
lượt đăng ký. Nếu số đơn hàng tụt về 0 mà mọi biểu đồ kỹ thuật vẫn xanh, bạn có một lỗi logic —
loại lỗi mà không alert hạ tầng nào bắt được.

Ba trụ cột và vai trò khác nhau của chúng:
- **Metrics** — biết *có* vấn đề (rẻ, tổng hợp, giữ lâu).
- **Logs** — biết *chuyện gì* xảy ra (đắt, chi tiết). Phải là log có cấu trúc và có `traceId`.
- **Traces** — biết *ở đâu* trong chuỗi service (một request đi qua 6 service, chặng nào chậm).

Nguyên tắc về alert quan trọng không kém: **chỉ cảnh báo những gì cần con người hành động ngay.**
Alert về CPU 80% lúc 3 giờ sáng mà không ai làm gì được sẽ dạy cả đội bỏ qua alert — và rồi họ bỏ
qua luôn cái alert thật. Cảnh báo theo **triệu chứng người dùng cảm nhận được** (tỷ lệ lỗi, độ trễ),
không theo nguyên nhân.

</details>

### 18. Feature flag và deploy an toàn

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tách **deploy** (đưa code lên) khỏi **release** (bật tính năng cho người dùng).
Có flag thì rollback là đổi một giá trị cấu hình trong vài giây, không phải deploy ngược lại trong
15 phút.

**Giải thích sâu:** Các chiến lược và khi nào dùng:

| Cách | Cơ chế | Hợp với |
|---|---|---|
| Rolling | thay dần từng pod | mặc định, không tốn thêm tài nguyên |
| Blue-green | chạy song song 2 môi trường, đổi LB | cần rollback tức thì |
| Canary | 1% traffic sang bản mới, tăng dần | thay đổi rủi ro cao |
| Feature flag | code đã lên, bật theo user/tỷ lệ | thay đổi nghiệp vụ, thử nghiệm A/B |

Ràng buộc bắt buộc với rolling và canary: **hai phiên bản chạy đồng thời**, nên mọi thay đổi phải
tương thích ngược — cả API lẫn schema database (xem [02-database câu 15](./02-database-va-truy-van.md)).

Nợ kỹ thuật của feature flag, phải nói ra: mỗi flag là một nhánh `if` và **2^n tổ hợp trạng thái**
mà về lý thuyết đều có thể xảy ra. Một hệ thống 30 flag không ai dọn thì không ai còn hiểu nổi
đường đi của code. Quy tắc thực dụng: flag tạm thời phải có **ngày hết hạn** và có người chịu trách
nhiệm xoá; chỉ flag mang tính vận hành lâu dài (kill switch cho tính năng nặng) mới được ở lại.

Một thứ đáng có mà ít đội chuẩn bị: **kill switch** cho các tính năng tốn tài nguyên. Khi hệ thống
quá tải, tắt tính năng "gợi ý sản phẩm" để cứu luồng thanh toán là quyết định đúng — nhưng chỉ làm
được trong 10 giây nếu đã chuẩn bị sẵn công tắc.

</details>

---

Tiếp: [06-bao-mat.md](./06-bao-mat.md)
