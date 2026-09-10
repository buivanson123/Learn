# System design — 8 đề bài và cách tiếp cận

Vòng system design đánh trượt nhiều người giỏi code. Lý do gần như luôn giống nhau: **nhảy vào vẽ
kiến trúc ngay khi nghe đề**, thay vì làm rõ bài toán trước.

Người phỏng vấn không tìm "kiến trúc đúng" — đề bài 45 phút không có kiến trúc đúng. Họ tìm:
bạn có hỏi đúng câu hỏi không, có ước lượng được quy mô không, có nêu ra đánh đổi không, và có biết
mình vừa đánh đổi cái gì không.

---

## Khung 45 phút

```
0–7 phút    LÀM RÕ YÊU CẦU
            Ai dùng? Bao nhiêu người? Đọc nhiều hay ghi nhiều?
            Tính năng nào bắt buộc, tính năng nào để sau?
            Cái gì được phép sai/trễ, cái gì tuyệt đối không?

7–12 phút   ƯỚC LƯỢNG QUY MÔ
            QPS, dung lượng, băng thông. Làm tròn thoải mái, nói ra giả định.

12–20 phút  THIẾT KẾ TỔNG THỂ
            Vẽ các khối chính và luồng dữ liệu. Đơn giản trước.

20–35 phút  ĐI SÂU VÀO 1–2 CHỖ
            Người phỏng vấn sẽ chỉ chỗ. Nếu không, TỰ CHỌN chỗ khó nhất.

35–42 phút  ĐIỂM NGHẼN VÀ MỞ RỘNG
            Cái gì hỏng trước? Traffic gấp 10 thì sao?

42–45 phút  TÓM TẮT VÀ ĐÁNH ĐỔI
            "Em chọn A thay vì B vì X, cái giá là Y."
```

**Bảy phút đầu là phần quan trọng nhất và cũng là phần hay bị bỏ qua nhất.** Nhảy thẳng vào vẽ kiến
trúc là dấu hiệu của người chưa từng chịu trách nhiệm cho một hệ thống thật.

---

## Bộ câu hỏi làm rõ dùng cho mọi đề

Học thuộc và dùng ngay từ phút đầu:

```
Quy mô      Bao nhiêu người dùng hoạt động hằng ngày? Tăng trưởng ra sao?
Tỷ lệ       Đọc/ghi khoảng bao nhiêu? Có điểm cao trong ngày không?
Dữ liệu     Mỗi bản ghi lớn cỡ nào? Giữ bao lâu?
Nhất quán   Đọc thấy dữ liệu cũ vài giây có sao không?
Độ trễ      Người dùng chấp nhận chờ bao lâu?
Sẵn sàng    Chết 5 phút thì hậu quả gì? Có SLA không?
Phạm vi     Cần làm những tính năng nào trong buổi hôm nay?
```

Cách nói: **"Trước khi thiết kế, cho em hỏi vài điều để chọn đúng hướng."** — rồi hỏi 4–5 câu, không
hỏi hết.

---

## Ước lượng quy mô — cách làm nhanh

Số cần thuộc:

```
1 ngày ≈ 86.400 giây  ≈ 10^5
1 triệu người dùng, mỗi người 10 request/ngày = 10^7 request/ngày ≈ 116 QPS
Đỉnh thường gấp 2–3 lần trung bình

1 KB   × 1 triệu = 1 GB
1 MB   × 1 triệu = 1 TB

Độ trễ tham chiếu (bậc độ lớn, đủ để lập luận):
  Đọc bộ nhớ            ~100 ns
  SSD đọc ngẫu nhiên    ~100 µs
  Redis trong cùng DC   ~0.5 ms
  Query DB có index     ~1 ms          (đo được ở backend/02: 0.076 ms)
  Vòng mạng trong DC    ~0.5 ms
  Vòng mạng xuyên châu  ~150 ms
```

Cách trình bày: nói to giả định, làm tròn mạnh tay, và **kết luận bằng một câu có ý nghĩa**:

> "1 triệu DAU, mỗi người xem 20 trang → 2 × 10^7 lượt đọc/ngày ≈ 230 QPS trung bình, đỉnh cỡ
> 700 QPS. Con số này **một máy Postgres xử lý được** nếu query có index. Nghĩa là ở quy mô này em
> chưa cần shard, và em sẽ dành thời gian cho chỗ khác."

Câu cuối là câu ăn điểm: nó cho thấy bạn ước lượng **để ra quyết định**, không phải để khoe số.

---

## Đề 1 — Rút gọn link (bit.ly)

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Bao nhiêu link tạo mỗi ngày? Tỷ lệ đọc/ghi? Link có hết hạn không? Có cần thống kê lượt
click không? Có cho phép tự chọn mã không?

**Quy mô giả định:** 1 triệu link mới/ngày, đọc gấp 100 lần ghi.
```
Ghi: 10^6/ngày ≈ 12 QPS
Đọc: 10^8/ngày ≈ 1160 QPS, đỉnh ~3000 QPS
Dung lượng: 1 triệu × 500 byte × 365 × 5 năm ≈ 900 GB
```

**Điểm mấu chốt của đề này: sinh mã ngắn.**

| Cách | Ưu | Nhược |
|---|---|---|
| Hash URL rồi lấy 7 ký tự đầu | không cần trạng thái | **có thể trùng**, phải xử lý |
| Số tăng dần → base62 | không bao giờ trùng | **đoán được link tiếp theo**, lộ số lượng |
| Sinh ngẫu nhiên rồi kiểm tra trùng | không đoán được | phải kiểm tra, có thể phải thử lại |
| **Cấp phát dải trước** | không trùng, không đoán được, không cần kiểm tra | cần một dịch vụ cấp dải |

Cách thứ tư là câu trả lời tốt nhất và đáng trình bày kỹ: mỗi máy chủ xin trước một dải
(ví dụ 1.000.000–1.001.000), tự cấp trong dải đó mà không cần phối hợp. Nếu muốn khó đoán, xáo trộn
số bằng một phép hoán vị khả nghịch (Feistel) trước khi mã hoá base62.

62^7 ≈ 3.5 × 10^12 — đủ cho 1 triệu link/ngày trong hàng nghìn năm.

**Kiến trúc:**
```
Client -> CDN -> LB -> API
                        ├─ Ghi: cấp mã -> lưu DB
                        └─ Đọc: Redis (cache) -> DB nếu miss -> 301/302
Thống kê click: bắn event vào queue, KHÔNG ghi đồng bộ
```

**Chỗ đi sâu nếu được hỏi:**
- **301 hay 302?** 301 (vĩnh viễn) được trình duyệt cache → nhanh hơn, giảm tải, nhưng **mất khả
  năng đếm click** và không đổi được đích. 302 giữ được cả hai. Đây là đánh đổi hay được đào.
- **Cache:** đọc gấp 100 lần ghi và phân bố rất lệch (một số link viral chiếm phần lớn traffic) →
  cache hit rate rất cao. Dùng LRU.
- **Thống kê:** không được ghi DB mỗi lần click. Bắn vào Kafka/queue, tổng hợp theo lô.

**Cạm bẫy nên chủ động nêu:** link độc hại (phishing) — cần quét URL, và cần cơ chế báo cáo/vô hiệu
hoá. Người phỏng vấn rất thích khi ứng viên tự nghĩ tới mặt lạm dụng.

</details>

## Đề 2 — Bảng tin mạng xã hội (news feed)

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Feed theo thời gian hay theo thuật toán? Bao nhiêu bạn bè/người theo dõi trung bình?
Có người nổi tiếng với hàng triệu người theo dõi không? Feed cần mới tới mức nào?

**Câu hỏi cuối là câu quan trọng nhất** — nó quyết định toàn bộ kiến trúc.

**Hai mô hình:**

```
FAN-OUT ON WRITE (đẩy)          FAN-OUT ON READ (kéo)
Đăng bài -> ghi vào feed của     Đăng bài -> chỉ lưu 1 lần
mọi người theo dõi               Đọc feed -> query bài của tất cả người mình theo dõi

Đọc: rất nhanh (đọc sẵn)         Đọc: chậm (phải gom và sắp xếp)
Ghi: rất đắt với người nổi tiếng Ghi: rẻ
Tốn dung lượng lưu trữ           Tiết kiệm
```

**Câu trả lời đúng là kết hợp**, và trình bày được lý do mới là điểm:

```
Người dùng bình thường (< 10.000 người theo dõi):  fan-out on write
Người nổi tiếng (> 10.000):                        fan-out on read
Khi đọc feed: trộn hai nguồn — feed đã dựng sẵn + bài mới của những người nổi tiếng mình theo dõi
```

Lý do: một người có 50 triệu người theo dõi mà fan-out on write thì mỗi bài đăng là 50 triệu lượt
ghi — không khả thi, và phần lớn số đó không bao giờ được đọc.

**Chỗ đi sâu:**
- **Feed lưu ở đâu:** Redis list/sorted set, giữ ~500 bài gần nhất. Cuộn sâu hơn thì rơi về DB.
- **Phân trang:** bắt buộc là cursor, không phải offset — feed thay đổi liên tục nên offset sẽ gây
  lặp và bỏ sót ([backend/02 câu 10](../backend/02-database-va-truy-van.md)).
- **Xoá bài/chặn người:** lọc lúc đọc, không đi sửa hàng triệu feed đã dựng.
- **Xếp hạng:** nếu là feed theo thuật toán thì tách hẳn thành tầng riêng — lấy ứng viên, chấm điểm,
  sắp xếp. Nói được rằng đây là một hệ thống riêng biệt là điểm cộng.

**Cạm bẫy:** đừng bắt đầu bằng "em dùng Kafka và Cassandra". Bắt đầu bằng mô hình dữ liệu và mô hình
đọc/ghi; công nghệ đến sau và phải có lý do.

</details>

## Đề 3 — Chat thời gian thực

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** 1-1 hay nhóm? Nhóm tối đa bao nhiêu người? Cần lịch sử tin nhắn không, giữ bao lâu? Cần
trạng thái đã đọc, đang gõ, online không? Có cần mã hoá đầu-cuối không?

**Kiến trúc cơ bản:**
```
Client <--WebSocket--> Gateway (nhiều pod)
                          │
                          ├─ Redis pub/sub  (để pod A gửi được tin tới người đang ở pod B)
                          ├─ Message store  (Cassandra/Postgres theo conversation_id)
                          └─ Queue -> push notification cho người offline
```

**Điểm mấu chốt: kết nối gắn với một pod cụ thể.** Người A ở pod 1, người B ở pod 3 — pod 1 phải có
cách đẩy tin sang pod 3. Hai cách: Redis pub/sub (đơn giản, phát cho mọi pod), hoặc một bảng tra
"user → pod" (chính xác hơn, phức tạp hơn).

**Chỗ đi sâu:**
- **Thứ tự tin nhắn:** đồng hồ máy chủ không đáng tin. Dùng số thứ tự tăng dần **theo từng cuộc
  trò chuyện**, hoặc snowflake id. Thứ tự trong một cuộc trò chuyện là bắt buộc; thứ tự toàn cục thì
  không cần.
- **Bảo đảm gửi tới:** client gửi `client_message_id` (do client sinh) → server khử trùng lặp →
  ack. Mất mạng thì client gửi lại chính id đó. Đây là idempotency ở tầng chat.
- **Người offline:** lưu tin, gửi push notification, và đồng bộ khi họ mở lại app (`GET /sync?since=`).
- **Nhóm lớn:** 10.000 người trong một nhóm thì fan-out mỗi tin là 10.000 lượt gửi → chuyển sang mô
  hình kéo cho nhóm lớn, giống đề 2.
- **Deploy:** mọi kết nối đứt khi deploy → client phải tự kết nối lại **có jitter**, nếu không 50
  nghìn client cùng kết nối lại một lúc sẽ đánh sập chính bạn.

**Điểm cộng lớn:** nêu chi phí của các tính năng "phụ". Trạng thái "đang gõ" nếu gửi mỗi ký tự thì
lưu lượng còn lớn hơn cả tin nhắn thật — phải throttle. "Đã xem" trong nhóm 100 người là 100 sự kiện
cho mỗi tin nhắn.

</details>

## Đề 4 — Rate limiter phân tán

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Giới hạn theo user, IP hay API key? Giới hạn cứng hay cho phép bùng nổ ngắn? Bao nhiêu
QPS phải xử lý? Vượt giới hạn thì từ chối hay xếp hàng?

**Thuật toán** (chi tiết ở [backend/04 câu 5](../backend/04-thiet-ke-api.md)): sliding window
counter là mặc định tốt; token bucket khi muốn cho phép burst.

**Điểm mấu chốt của đề này là tính nguyên tử và độ trễ.**

```lua
-- Lua script trong Redis: đọc-tính-ghi trong một thao tác nguyên tử
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return c
```

Không dùng script thì có khoảng hở giữa `INCR` và `EXPIRE`: tiến trình chết ở giữa là key sống mãi
và user bị chặn vĩnh viễn.

**Chỗ đi sâu:**
- **Mỗi request thêm một vòng tới Redis** → tăng độ trễ cho **mọi** request. Cách giảm: đếm cục bộ
  trong mỗi pod với hạn mức được chia sẵn, đồng bộ về Redis theo lô. Đổi lại độ chính xác giảm.
- **Redis chết thì sao?** Fail-open (cho qua) mất bảo vệ; fail-closed (chặn hết) là Redis chết kéo
  sập cả API. Thường chọn fail-open + cảnh báo, nhưng **fail-closed cho endpoint đăng nhập**.
- **Phân tán nhiều vùng địa lý:** giới hạn toàn cục cần đồng bộ xuyên vùng → độ trễ cao. Thực dụng
  là giới hạn theo từng vùng với hạn mức chia sẵn, chấp nhận sai số.
- **Đặt ở tầng nào:** đặt càng gần biên càng tốt (CDN/API gateway) để request xấu bị chặn trước khi
  tốn tài nguyên của bạn.

**Cạm bẫy đáng nêu:** giới hạn theo IP không chặn được credential stuffing vì kẻ tấn công dùng hàng
nghìn IP; và nó chặn nhầm cả một công ty đứng sau NAT. Xem
[backend/06 câu 8](../backend/06-bao-mat.md).

</details>

## Đề 5 — Hệ thống thông báo (notification)

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Những kênh nào (push, email, SMS, in-app)? Bao nhiêu thông báo mỗi ngày? Có cần đúng
thứ tự không? Người dùng tuỳ chỉnh được không? Thông báo giao dịch (OTP) hay tiếp thị?

**Câu hỏi cuối rất quan trọng:** OTP phải tới trong vài giây và không được mất; email tiếp thị thì
trễ một giờ cũng không sao. Hai loại này cần **hàng đợi riêng và mức ưu tiên riêng**.

**Kiến trúc:**
```
Sự kiện -> Queue -> Notification service
                       ├─ Kiểm tra tuỳ chọn của người dùng (đã tắt loại này chưa?)
                       ├─ Kiểm tra tần suất (đừng gửi 50 cái/giờ cho một người)
                       ├─ Chọn kênh và template
                       └─ Đẩy vào hàng đợi theo từng kênh
                              ├─ push  -> FCM / APNs
                              ├─ email -> SES / SendGrid
                              └─ sms   -> nhà mạng
```

**Chỗ đi sâu:**
- **Idempotency:** mỗi thông báo có id; nhà cung cấp có thể timeout rồi thành công. Không khử trùng
  lặp là người dùng nhận OTP hai lần.
- **Nhà cung cấp chết:** cần dự phòng (hai nhà cung cấp SMS) và circuit breaker. Đây là chỗ nên nhắc
  tới [backend/07 tình huống 7](../backend/07-tinh-huong-su-co.md).
- **Gom nhóm (digest):** 100 lượt thích trong 5 phút → **một** thông báo "100 người đã thích bài của
  bạn". Đây là yêu cầu sản phẩm quan trọng, không phải tối ưu kỹ thuật.
- **Múi giờ:** đừng gửi thông báo tiếp thị lúc 3 giờ sáng giờ địa phương của người nhận.
- **Theo dõi:** tỷ lệ gửi thành công, tỷ lệ mở, tỷ lệ hủy đăng ký — theo từng kênh và từng loại.

**Điểm cộng:** nói về **tuỳ chọn của người dùng như một tính năng bắt buộc**, không phải phụ. Và
tuân thủ pháp lý: email tiếp thị phải có link huỷ đăng ký hoạt động được.

</details>

## Đề 6 — Bảng xếp hạng thời gian thực

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Bao nhiêu người chơi? Cập nhật liên tục hay theo đợt? Cần hạng của **từng** người hay
chỉ top 100? Bảng theo ngày/tuần/mọi thời điểm?

**Câu hỏi "cần hạng của từng người không" là câu quyết định.** Top 100 thì dễ; "bạn đang xếp thứ
1.234.567" thì khó hơn nhiều.

**Cách làm cơ bản — Redis Sorted Set:**
```
ZADD  leaderboard 1500 user:42
ZREVRANGE leaderboard 0 99 WITHSCORES     -- top 100, O(log N + 100)
ZREVRANK  leaderboard user:42             -- hạng của một người, O(log N)
```

Redis giải quyết đề này gọn tới mức phần thú vị nằm ở chỗ **khi nào nó không đủ**.

**Chỗ đi sâu:**
- **10 triệu người chơi:** một sorted set khoảng vài trăm MB — vẫn chấp nhận được, nhưng nó là một
  key duy nhất trên một node, không shard được. Cách xử lý: chia theo dải điểm, hoặc chấp nhận hạng
  **xấp xỉ** cho người ngoài top.
- **Bảng theo ngày/tuần:** mỗi kỳ một key, đặt TTL. Bảng mọi thời điểm thì giữ vĩnh viễn.
- **Redis mất dữ liệu:** phải dựng lại được từ nguồn sự thật (DB hoặc event log). Bảng xếp hạng là
  **dữ liệu dẫn xuất**, không phải nguồn sự thật.
- **Chống gian lận:** điểm phải do server tính, không tin client. Cần phát hiện bất thường và có
  đường thu hồi điểm.
- **Hạng xấp xỉ cho quy mô rất lớn:** chia điểm thành các "xô", đếm số người trong mỗi xô, hạng =
  tổng số người ở các xô điểm cao hơn + vị trí trong xô. Sai số nhỏ, chi phí nhỏ hơn nhiều.

</details>

## Đề 7 — Upload và xử lý video

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Video dài bao nhiêu, dung lượng bao nhiêu? Cần bao nhiêu độ phân giải? Xem trực tiếp hay
tải về? Xử lý xong trong bao lâu là chấp nhận được?

**Luồng:**
```
1. Client xin presigned URL  -> upload THẲNG lên S3, không qua server ứng dụng
2. Báo hoàn tất -> server xác minh object tồn tại và đúng kích thước
3. Đẩy job vào queue
4. Worker: chia nhỏ video -> transcode song song nhiều độ phân giải -> ghép
5. Đóng gói HLS/DASH -> đẩy lên CDN
6. Cập nhật trạng thái, báo cho người dùng
```

Bước 1 là điểm bắt buộc phải nêu: cho file 2 GB đi qua Node là sai ngay từ đầu
([backend/04 câu 8](../backend/04-thiet-ke-api.md)).

**Chỗ đi sâu:**
- **Transcode song song:** chia video thành đoạn 10 giây, transcode song song trên nhiều worker, rồi
  ghép. Video 1 giờ từ 2 tiếng xử lý xuống còn vài phút.
- **Ưu tiên:** làm 480p trước và cho xem ngay, các độ phân giải cao hơn xong sau. Người dùng không
  phải chờ toàn bộ.
- **Chi phí:** transcode rất tốn CPU → dùng spot instance, và **phải xử lý được việc bị thu hồi
  giữa chừng**. Đây là lý do chia đoạn nhỏ có giá trị kép.
- **Trạng thái:** người dùng cần thấy tiến trình. WebSocket hoặc polling.
- **Job thất bại:** file hỏng, codec lạ → DLQ và thông báo rõ ràng cho người dùng, đừng để im lặng.

**Cạm bẫy:** đừng quên **kiểm duyệt nội dung** và **quét mã độc**. Với nền tảng có nội dung người
dùng, đây là yêu cầu bắt buộc chứ không phải tuỳ chọn.

</details>

## Đề 8 — Đặt chỗ (vé xem phim / khách sạn)

<details><summary>Cách tiếp cận</summary>

**Làm rõ:** Bao nhiêu chỗ mỗi sự kiện? Có bán vé đồng loạt (flash sale) không? Giữ chỗ bao lâu trong
lúc thanh toán? Được bán vượt (overbooking) không?

**Đây là đề mà tính đúng đắn quan trọng hơn quy mô.** Bán trùng một ghế là sự cố nghiêm trọng.

**Ba trạng thái của một chỗ:**
```
trống  ->  đang giữ (15 phút, có hạn)  ->  đã bán
             │
             └─ hết hạn -> quay lại trống
```

**Chỗ mấu chốt: giữ chỗ phải nguyên tử.**

```sql
UPDATE seats SET status='held', held_by=:user, hold_expires_at=now()+interval '15 min'
WHERE seat_id = ANY(:ids) AND (status='free' OR (status='held' AND hold_expires_at < now()));
-- rowCount < số ghế yêu cầu -> có ghế đã bị người khác lấy, HUỶ TOÀN BỘ và báo lại
```

Câu này an toàn vì `UPDATE` khoá dòng và kiểm tra điều kiện trên giá trị mới nhất — cùng nguyên tắc
với trừ tồn kho ở [backend/03 câu 11](../backend/03-transaction-va-dong-thoi-du-lieu.md).

**Chỗ đi sâu:**
- **Dọn chỗ hết hạn:** đừng dựa vào một job chạy mỗi phút để giải phóng. Điều kiện `hold_expires_at
  < now()` ngay trong câu `UPDATE` khiến chỗ hết hạn tự động dùng được lại — job dọn chỉ để cập nhật
  trạng thái cho gọn.
- **Flash sale:** 100 nghìn người tranh 5 nghìn ghế. Đặt một **phòng chờ**: cho vào theo lô, người
  còn lại thấy vị trí trong hàng. Việc này vừa bảo vệ hệ thống vừa công bằng hơn.
- **Thanh toán:** không gọi cổng thanh toán trong transaction
  ([backend/03 câu 8](../backend/03-transaction-va-dong-thoi-du-lieu.md)). Giữ chỗ → thanh toán ngoài
  transaction → xác nhận. Thanh toán thất bại thì nhả chỗ.
- **Chỗ liền nhau:** khách muốn 4 ghế cạnh nhau — bài toán tìm kiếm, và phải khoá cả nhóm hoặc không
  khoá gì.
- **Overbooking** (khách sạn, hàng không): là quyết định **kinh doanh**, và nếu có thì phải có quy
  trình xử lý khi khách tới mà hết phòng.

</details>

---

## Sáu lỗi làm trượt vòng system design

1. **Nhảy vào vẽ ngay.** Không hỏi gì đã vẽ khối — dấu hiệu rõ nhất của người chưa làm thật.
2. **Kể tên công nghệ thay vì mô tả cơ chế.** "Em dùng Kafka" không nói lên điều gì; "em cần một log
   bền, có thứ tự, đọc lại được, vì..." mới là câu trả lời.
3. **Thiết kế cho 1 tỷ người dùng khi đề chỉ có 10 nghìn.** Over-engineering cũng là lỗi, và người
   phỏng vấn kinh nghiệm coi đó là lỗi nặng.
4. **Không nêu đánh đổi.** Mọi lựa chọn đều có giá. Không nói ra cái giá nghĩa là bạn chưa biết nó.
5. **Im lặng khi suy nghĩ.** Người phỏng vấn không đọc được suy nghĩ. Nói to: "Em đang cân nhắc giữa
   hai cách..."
6. **Không nhận ra mình sai khi được gợi ý.** Người phỏng vấn gợi ý là đang giúp. Bảo thủ giữ phương
   án sai tệ hơn nhiều so với việc đổi ý và nói rõ vì sao đổi.

---

## Cách luyện

Với mỗi đề: **bấm giờ 45 phút, nói thành tiếng, vẽ ra giấy.** Đọc thầm không luyện được kỹ năng cần
thiết, vì thứ được chấm là cách bạn **trình bày** suy nghĩ chứ không phải bản thân suy nghĩ.

Sau mỗi lần, tự chấm bốn câu:
```
1. Mình có hỏi làm rõ trước khi thiết kế không?
2. Mình có ước lượng quy mô và dùng nó để RA QUYẾT ĐỊNH không?
3. Mình có nói ra ít nhất 3 đánh đổi không?
4. Mình có nhận ra điểm nghẽn trước khi bị hỏi không?
```

---

Tiếp: [02-cau-hoi-hanh-vi.md](./02-cau-hoi-hanh-vi.md)
