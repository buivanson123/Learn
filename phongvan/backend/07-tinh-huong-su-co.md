# 10 tình huống sự cố — "production đang hỏng, bạn làm gì?"

Đây là dạng câu hỏi có sức phân biệt cao nhất ở vòng senior, vì nó **không thể học thuộc**. Người
phỏng vấn không tìm câu trả lời đúng — họ tìm xem bạn có **quy trình** hay chỉ đoán mò.

Đừng đọc đáp án trước. Với mỗi tình huống, hãy tự viết ra: câu hỏi đầu tiên bạn hỏi, chỉ số đầu
tiên bạn nhìn, và giả thuyết đầu tiên bạn kiểm tra.

---

## Khung xử lý dùng cho mọi tình huống

Nói khung này ra ở đầu câu trả lời sẽ ăn điểm ngay, trước cả khi bạn đoán đúng nguyên nhân:

```
1. GIẢM THIỆT HẠI trước, tìm nguyên nhân sau
   Rollback, tắt tính năng, tăng pod — làm cho user hết đau đã.
   Người mới hay lao vào debug trong khi hệ thống vẫn đang chảy máu.

2. CÁI GÌ ĐÃ THAY ĐỔI?
   Deploy? Đổi cấu hình? Feature flag? Traffic tăng? Job định kỳ?
   Hơn 80% sự cố có một thay đổi đứng sau nó.

3. KHOANH VÙNG BẰNG NHỊ PHÂN
   Tất cả user hay một nhóm? Mọi endpoint hay một? Mọi pod hay một?
   Mỗi câu trả lời cắt đôi không gian tìm kiếm.

4. NHÌN SỐ, ĐỪNG ĐOÁN
   Chỉ số, log, trace. Giả thuyết phải kiểm chứng được.

5. GHI LẠI TRONG LÚC LÀM
   Dòng thời gian viết sau sự cố luôn sai. Viết ngay, dù chỉ trong một kênh chat.
```

---

### Tình huống 1 — API chậm đột ngột, không deploy gì

> 14:30, p95 của toàn bộ API nhảy từ 120 ms lên 4 giây. Lần deploy gần nhất là 3 ngày trước.
> CPU và RAM của app đều bình thường.

<details><summary>Cách tiếp cận</summary>

**Câu hỏi đầu tiên:** *Chậm đều mọi endpoint, hay chỉ những endpoint chạm database?* Đây là câu cắt
đôi không gian tìm kiếm hiệu quả nhất. CPU app bình thường mà mọi thứ chậm → app đang **chờ** cái
gì đó.

Thứ tự kiểm tra:

```
1. Endpoint không chạm DB (health check) có chậm không?
   -> Chậm luôn: vấn đề ở tầng mạng/LB/DNS, không phải DB
   -> Chỉ endpoint chạm DB chậm: đi tiếp
2. Nhìn DB: CPU, số kết nối đang dùng, query đang chạy lâu
3. Nhìn thời gian chờ lấy kết nối từ pool — nếu > 0, pool là nút cổ chai
```

Câu truy vấn nhìn được cả hai thứ cùng lúc — ai đang chạy lâu và **ai đang chặn ai**:

```sql
SELECT a.pid, a.state, now()-a.xact_start AS thoi_gian, left(a.query,45) AS query,
       pg_blocking_pids(a.pid) AS bi_chan_boi
FROM pg_stat_activity a
WHERE a.datname='postgres' AND a.state <> 'idle'
ORDER BY a.xact_start;
```
```
 pid  |        state        |    thoi_gian    |              query               | bi_chan_boi
------+---------------------+-----------------+----------------------------------+-------------
 1373 | idle in transaction | 00:00:03.017694 | UPDATE accounts SET balance=...  | {}
 1372 | active              | 00:00:03.017685 | UPDATE accounts SET balance=...  | {1373}      ← bị 1373 chặn
```

Dòng đầu là thủ phạm điển hình: **`idle in transaction`** — một transaction đã `BEGIN`, đã khoá
dòng, rồi ngồi im (thường vì code đang chờ một lời gọi HTTP bên trong transaction). Mọi request
khác chạm dòng đó xếp hàng sau.

Các nguyên nhân thường gặp khác cho tình huống "chậm mà không deploy gì":

| Nguyên nhân | Dấu hiệu nhận biết |
|---|---|
| Dữ liệu vượt ngưỡng, planner đổi kế hoạch | một query cụ thể chậm, `EXPLAIN` giờ ra `Seq Scan` |
| Một job định kỳ chạy lúc 14:30 | trùng thời điểm; kiểm tra cron/scheduler |
| Cache bị xoá hoặc Redis restart | tỷ lệ cache hit tụt về 0 |
| Upstream bên thứ ba chậm | thời gian chờ gọi ngoài tăng, app CPU thấp |
| Đĩa gần đầy | I/O latency tăng, `df -h` |
| `VACUUM`/`ANALYZE` tự động trên bảng lớn | I/O của DB tăng vọt |

**Xử lý tạm** trong lúc điều tra: `SELECT pg_terminate_backend(1373)` để giết transaction đang treo,
và đặt `idle_in_transaction_session_timeout` để nó không tái diễn.

**Điều nên nói ở cuối:** "Sau khi xử lý, em sẽ hỏi vì sao mất 20 phút để tìm ra — nếu đã có sẵn
dashboard hiển thị query bị chặn thì chỉ mất 2 phút. Kết quả của sự cố này nên là một dashboard,
không chỉ là một bản vá."

</details>

### Tình huống 2 — Bộ nhớ pod tăng đều, cứ 6 tiếng bị OOMKilled

> Không có lỗi trong log. Restart xong thì bình thường lại, rồi 6 tiếng sau lặp lại.

<details><summary>Cách tiếp cận</summary>

**Nhận định đầu tiên:** tăng **đều theo thời gian** chứ không theo đỉnh traffic → đây là leak, không
phải thiếu tài nguyên. Tăng `memory limit` chỉ kéo dài chu kỳ từ 6 tiếng lên 12 tiếng.

Bước 1 — xác định leak nằm ở đâu:

```js
setInterval(() => {
  const m = process.memoryUsage();
  logger.info({ rss: m.rss>>20, heapUsed: m.heapUsed>>20, external: m.external>>20 }, 'mem');
}, 30000);
```

```
heapUsed tăng đều          -> leak trong JavaScript
heapUsed phẳng, rss tăng   -> leak native: Buffer, thư viện C++, hoặc kết nối không đóng
external tăng              -> Buffer / ArrayBuffer không được giải phóng
```

Bước 2 — hai heap snapshot cách nhau 1–2 tiếng, so sánh:

```js
require('v8').writeHeapSnapshot('/tmp/snap1.heapsnapshot');
```

Mở trong Chrome DevTools → Memory → chế độ **Comparison**, sắp theo Delta. Constructor nào tăng
hàng chục nghìn object là thủ phạm; cột **Retainers** cho biết ai đang giữ chúng.

Những thủ phạm hay gặp nhất, theo thứ tự:

1. **`Map`/mảng toàn cục dùng làm cache** không có giới hạn và không có TTL.
2. **Listener không gỡ**: `emitter.on()` trong mỗi request mà không `off()`. Node có cảnh báo
   `MaxListenersExceededWarning` — nếu thấy dòng này trong log thì bạn đã có manh mối.
3. **`setInterval` không `clearInterval`** khi đối tượng bị huỷ.
4. **Closure giữ object lớn**: một callback nhỏ vô tình giữ nguyên cả response body 10 MB.
5. **Kết nối không đóng** (HTTP agent, DB client tạo mới mỗi request thay vì dùng pool).

**Giảm thiệt hại ngay** trong lúc chưa tìm ra: đặt `--max-old-space-size` thấp hơn giới hạn của
container để Node tự lỗi có kiểm soát thay vì bị OOMKiller giết đột ngột, và thêm pod để giảm áp
lực. Đây là hoãn binh, phải nói rõ là hoãn binh.

</details>

### Tình huống 3 — Database CPU 100%, mọi thứ đứng

<details><summary>Cách tiếp cận</summary>

**Bước 1 — tìm query đang ăn CPU** (cần extension `pg_stat_statements`, nên bật sẵn từ trước):

```sql
SELECT calls, round(mean_exec_time::numeric,2) AS trung_binh_ms,
       round(total_exec_time::numeric) AS tong_ms, left(query,60)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
```

Nhìn cột `tong_ms`, **không** nhìn `trung_binh_ms`. Một query 5 ms chạy 2 triệu lần gây hại hơn
nhiều so với một query 3 giây chạy 10 lần — và nó là trường hợp phổ biến hơn (thường là N+1).

**Bước 2 — giết cái đang chạy lâu** nếu cần cứu hệ thống ngay:

```sql
SELECT pg_cancel_backend(pid)     -- huỷ query, transaction vẫn sống (thử cái này trước)
FROM pg_stat_activity WHERE state='active' AND now()-query_start > interval '30 seconds';

SELECT pg_terminate_backend(pid); -- ngắt hẳn kết nối (mạnh tay hơn)
```

**Bước 3 — phân loại nguyên nhân:**

| Loại | Dấu hiệu | Xử lý |
|---|---|---|
| Một query xấu mới xuất hiện | có deploy gần đây | rollback |
| N+1 từ một endpoint mới | `calls` rất lớn cho một query | sửa eager loading |
| Thiếu index sau khi dữ liệu lớn lên | `Seq Scan` trên bảng đã to | `CREATE INDEX CONCURRENTLY` |
| Job phân tích chạy giờ cao điểm | trùng thời điểm | dời sang replica hoặc giờ thấp điểm |
| Traffic tăng thật | mọi chỉ số tăng đều | scale, cache |
| Autovacuum trên bảng lớn | `pg_stat_activity` có `autovacuum:` | thường nên để nó chạy xong |

Mục cuối là bẫy: người ta hay giết autovacuum vì thấy nó chiếm tài nguyên. Giết nó thì bảng bloat
càng nặng, lần sau còn tốn hơn, và cuối cùng dẫn tới nguy cơ transaction ID wraparound. Đúng ra
phải **điều chỉnh** (`autovacuum_vacuum_cost_limit`) chứ không phải chặn.

**Việc phải làm sau sự cố:** đặt `statement_timeout` ở mức hợp lý (ví dụ 30 giây cho API, dài hơn
cho job). Không có nó, một query xấu có thể chạy vô hạn và kéo cả hệ thống theo.

</details>

### Tình huống 4 — Sau deploy, 5% request trả 500

> 95% vẫn bình thường. Log lỗi là `Cannot read property 'id' of undefined`.

<details><summary>Cách tiếp cận</summary>

**Hành động đầu tiên: rollback.** Không debug trên production khi có bản tốt để quay về. Debug sau,
với log đã thu thập được.

Con số **5%** là manh mối quan trọng nhất. Nó nói: không phải mọi request, mà là một **tập con**.
Đi tìm điểm chung của tập con đó:

```
- Cùng một endpoint?           -> lỗi ở một route cụ thể
- Cùng một nhóm user?          -> dữ liệu của họ khác (thiếu field, giá trị null, tài khoản cũ)
- Chỉ trên vài pod?            -> rolling deploy chưa xong, hoặc một pod có cấu hình khác
- Chỉ client phiên bản cũ?     -> thay đổi API phá vỡ tương thích
- Bắt đầu đúng lúc deploy?     -> chắc chắn do deploy
- Tỷ lệ tăng dần theo % pod mới -> xác nhận đúng là code mới
```

Với `Cannot read property 'id' of undefined`, giả thuyết mạnh nhất là **dữ liệu cũ không có field
mà code mới giả định là luôn có**. Ví dụ: user đăng ký từ 2023 không có `profile`, code mới viết
`user.profile.id`. 5% chính là tỷ lệ tài khoản cũ.

Kiểm chứng nhanh:

```sql
SELECT count(*) FILTER (WHERE profile_id IS NULL) AS thieu,
       count(*) AS tong,
       round(100.0*count(*) FILTER (WHERE profile_id IS NULL)/count(*),1) AS phan_tram
FROM users;
```

Nếu `phan_tram` ra khoảng 5 thì bạn đã tìm ra, và việc còn lại là backfill dữ liệu + code phòng thủ.

**Bài học cho hậu kiểm:** dữ liệu trên production **luôn** bẩn hơn dữ liệu trong test. Cách phòng
đúng không phải là "cẩn thận hơn" mà là: canary deploy (1% traffic trước), và test với một bản sao
dữ liệu thật đã ẩn danh hoá.

</details>

### Tình huống 5 — Hàng đợi tồn đọng 500 nghìn job, đang tăng

<details><summary>Cách tiếp cận</summary>

**Câu hỏi đầu tiên, trước mọi thứ khác:** *Worker có đang chạy không, và nó đang làm gì?*

```
A. Worker chết hết          -> khởi động lại, xem vì sao chết (OOM? crash loop?)
B. Worker chạy nhưng chậm   -> tìm chỗ nghẽn
C. Worker chạy bình thường, nguồn job tăng đột biến -> tìm ai đang bơm job
```

Trường hợp C hay bị bỏ qua và thường là nguyên nhân thật: một job đang **tự sinh ra job**
(retry vô hạn, hoặc một vòng lặp job A tạo job B tạo lại job A), hoặc một migration/backfill vừa
đổ hàng trăm nghìn job vào chung hàng đợi với job của người dùng.

Kiểm tra: nhóm job theo loại. Nếu 490 nghìn trong 500 nghìn là cùng một loại thì bạn đã có câu trả
lời.

**Chỉ số quan trọng hơn độ sâu hàng đợi: tuổi của job cũ nhất.** 500 nghìn job mà cái cũ nhất 30
giây thì hệ thống vẫn khoẻ, chỉ đang có đỉnh. 500 job mà cái cũ nhất 3 tiếng thì có gì đó đang kẹt.

Thứ tự hành động:

```
1. Tách hàng đợi theo mức ưu tiên NGAY — email đặt lại mật khẩu không được
   xếp sau 500 nghìn job đồng bộ báo cáo. Đây là việc rẻ nhất và cứu được trải nghiệm.
2. Tìm nghẽn: worker chờ DB? chờ API ngoài? hay ăn CPU?
   -> chờ API ngoài  : tăng số worker (upstream chịu được không?)
   -> chờ DB         : THÊM WORKER SẼ LÀM TỆ HƠN, phải sửa query trước
   -> ăn CPU         : thêm worker theo số lõi
3. Gom lô: 1000 job gửi 1000 email -> 1 lời gọi API gửi hàng loạt
4. Bỏ job đã lỗi thời: job "gửi thông báo khuyến mãi" từ 6 tiếng trước
   không còn giá trị. Vứt đi là quyết định đúng, không phải thất bại.
```

**Điều nên nói thêm:** phân biệt tồn đọng **tạm thời** (sau flash sale, tự tiêu) với tồn đọng **xu
hướng** (mỗi ngày dài hơn hôm trước). Cái thứ hai nghĩa là năng lực xử lý đã thấp hơn tốc độ đến —
thêm worker chỉ là hoãn, phải sửa gốc hoặc giảm nguồn.

</details>

### Tình huống 6 — Khách báo "tôi thấy dữ liệu của người khác"

<details><summary>Cách tiếp cận</summary>

Đây là sự cố **nghiêm trọng nhất** trong danh sách này. Cách bạn phản ứng trong 10 phút đầu quan
trọng hơn việc bạn tìm ra nguyên nhân nhanh hay chậm.

```
1. Coi là sự cố bảo mật mức cao nhất ngay lập tức. Đừng "để mai xem lại".
2. Chặn nguồn chảy máu: tắt tính năng bằng feature flag nếu khoanh vùng được.
3. Thu thập bằng chứng TRƯỚC khi restart bất cứ thứ gì — restart là mất sạch state trong RAM.
4. Ghi lại: user nào, lúc mấy giờ, thấy dữ liệu của ai, màn hình nào, đã chụp màn hình chưa.
```

Bốn nguyên nhân khả dĩ, xếp theo tần suất thực tế:

| Nguyên nhân | Dấu hiệu | Cách xác minh |
|---|---|---|
| **Cache key thiếu định danh user** | luôn thấy dữ liệu của cùng một người | tìm key cache không chứa `userId` |
| **Biến toàn cục giữ context request** | ngẫu nhiên, chỉ xảy ra khi tải cao | tìm biến module-level bị gán trong middleware |
| **CDN/proxy cache nhầm response cá nhân** | nhiều user thấy cùng một nội dung | kiểm tra `Cache-Control` trên response có dữ liệu riêng |
| **Thiếu điều kiện `user_id` trong query** (IDOR) | chỉ xảy ra khi user đổi id trên URL | đọc lại truy vấn của endpoint đó |

Nguyên nhân 1 và 3 cùng một họ và là phổ biến nhất. Ví dụ cụ thể:

```js
// SAI: hai user khác nhau dùng chung một key
await redis.set(`profile`, JSON.stringify(user));

// SAI: response cá nhân bị CDN cache và phục vụ cho người khác
res.set('Cache-Control', 'public, max-age=300');   // với dữ liệu riêng tư!
```

Với mọi response có dữ liệu người dùng, phải là `Cache-Control: private, no-store` và có `Vary:
Authorization`.

Nguyên nhân 2 xem [01-runtime câu 16](./01-runtime-va-dong-thoi.md) — nó rất khó tái hiện và
thường chỉ xuất hiện khi có tải, nên nếu ba nguyên nhân kia đã loại trừ thì hãy đi tìm nó.

**Phần không phải kỹ thuật, và người phỏng vấn rất chú ý:** xác định phạm vi dữ liệu bị lộ và nghĩa
vụ thông báo. GDPR yêu cầu báo cáo trong 72 giờ; Nghị định 13/2023 của Việt Nam cũng có yêu cầu
thông báo. Nói được điều này cho thấy bạn hiểu sự cố này không chỉ là bug.

</details>

### Tình huống 7 — Bên thứ ba (cổng thanh toán) chậm 30 giây

<details><summary>Cách tiếp cận</summary>

**Vấn đề thật không phải là họ chậm — mà là hệ thống của bạn chết theo.** Đó mới là cái cần sửa.

Cơ chế lan truyền:

```
Cổng thanh toán chậm 30s
  -> mỗi request thanh toán giữ 1 luồng + 1 kết nối DB trong 30 giây
  -> pool kết nối cạn
  -> các endpoint KHÔNG liên quan tới thanh toán cũng bắt đầu lỗi
  -> health check timeout -> k8s giết pod -> traffic dồn sang pod còn lại -> sập dây chuyền
```

Xử lý ngay:

```
1. Đặt timeout ngắn (3–5 giây) cho lời gọi tới họ — thà lỗi nhanh còn hơn treo
2. Bật circuit breaker: quá ngưỡng lỗi thì fail nhanh, không gọi nữa
3. Chuyển sang bất đồng bộ: nhận đơn, trả "đang xử lý", xử lý qua queue
4. Thông báo cho user rõ ràng thay vì để họ nhìn màn hình quay vòng
```

Sửa gốc — **cách ly (bulkhead)**: mỗi phụ thuộc bên ngoài có một hạn mức đồng thời riêng.

```js
const paymentLimit = pLimit(10);   // tối đa 10 lời gọi thanh toán đồng thời
```

Ý nghĩa: dù cổng thanh toán chết hoàn toàn, nó chỉ giữ được 10 luồng của bạn. Phần còn lại của hệ
thống — duyệt sản phẩm, tìm kiếm, xem đơn cũ — vẫn chạy bình thường. Đây là ý tưởng quan trọng nhất
trong tình huống này và là thứ người phỏng vấn chờ nghe.

Với riêng thanh toán, phải nói thêm phần dữ liệu: khi timeout, bạn **không biết** giao dịch đã thành
công hay chưa. Bắt buộc phải có:
- **Đối soát**: job định kỳ hỏi lại trạng thái các giao dịch treo.
- **Idempotency key**: retry không tạo giao dịch mới.
- **Webhook** từ cổng thanh toán làm nguồn sự thật cuối cùng, không dựa vào response đồng bộ.

</details>

### Tình huống 8 — Một dòng dữ liệu bị sai, không ai biết vì sao

> Số dư của một khách hàng bị âm. Code có ràng buộc chặn việc này.

<details><summary>Cách tiếp cận</summary>

**Câu hỏi đầu tiên:** *Ràng buộc đó nằm ở đâu — trong code ứng dụng hay trong database?*

Nếu chỉ ở tầng ứng dụng thì danh sách nghi phạm dài: migration chạy tay, script sửa dữ liệu, một
endpoint khác không đi qua service đó, một job nền, hoặc ai đó `psql` vào production.

Nếu ràng buộc ở database (`CHECK (balance >= 0)`) mà vẫn sai thì phạm vi hẹp lại rất nhiều: ràng
buộc được thêm vào **sau khi** dữ liệu đã sai (và thêm bằng `NOT VALID`), hoặc ai đó đã tắt nó.

Cách điều tra:

```sql
-- 1. Ràng buộc có tồn tại và có hợp lệ không?
SELECT conname, convalidated FROM pg_constraint WHERE conrelid = 'accounts'::regclass;

-- 2. Dòng này sửa lần cuối lúc nào, bởi transaction nào?
SELECT xmin, xmax, * FROM accounts WHERE id = 42;

-- 3. Audit log / bảng lịch sử, nếu có
SELECT * FROM accounts_history WHERE account_id = 42 ORDER BY changed_at DESC LIMIT 20;
```

Bước 3 là bước quyết định, và nếu bạn không có audit log thì câu trả lời trung thực nhất là: **"em
không chứng minh được, và đó chính là vấn đề cần sửa"**. Nói thẳng điều này tốt hơn nhiều so với
đưa ra một giả thuyết không kiểm chứng được.

Nguyên nhân kỹ thuật hay gặp nhất cho riêng "số dư âm" là **lost update** — hai request cùng đọc,
cùng tính, cùng ghi (xem [03-transaction câu 4](./03-transaction-va-dong-thoi-du-lieu.md), đo
được kết quả 120 thay vì 130). Kiểm tra: code có đọc số dư ra rồi tính trong app rồi ghi lại không?
Nếu có, đó gần như chắc chắn là nó, và nó chỉ xảy ra khi hai thao tác trùng thời điểm — hiếm, nên
khó tái hiện.

**Việc phải làm sau sự cố, theo thứ tự giá trị:**

1. Đưa ràng buộc **xuống database**. Ràng buộc trong code chỉ đúng khi mọi đường ghi đều đi qua
   code đó — và sẽ luôn có một đường không đi qua.
2. Thêm **audit log** cho các bảng nhạy cảm về tiền.
3. Thêm **job đối soát** chạy hằng đêm và cảnh báo khi phát hiện bất thường — để lần sau bạn biết
   trong vài giờ, không phải chờ khách hàng báo.

</details>

### Tình huống 9 — Deploy xong, tỷ lệ lỗi 502 tăng trong 30 giây rồi tự hết

> Lặp lại mỗi lần deploy. Không ai coi là vấn đề vì "nó tự hết".

<details><summary>Cách tiếp cận</summary>

Nó **là** vấn đề: mỗi lần deploy có một nhúm user thật gặp lỗi. Deploy 10 lần/ngày là 10 lần như
vậy. Và nó cũng là lý do đội ngại deploy, dẫn tới deploy ít hơn và mỗi lần rủi ro hơn.

Gần như luôn là một trong ba nguyên nhân sau:

**1. Không có graceful shutdown.** Pod nhận `SIGTERM` và chết ngay, cắt đứt các request đang chạy
dở. Xem [01-runtime câu 11](./01-runtime-va-dong-thoi.md).

**2. Không có khoảng đệ trước khi đóng cổng.** Đây là nguyên nhân bị bỏ sót nhiều nhất. Kubernetes
gửi `SIGTERM` **và** cập nhật danh sách endpoint **song song**, không theo thứ tự. Trong vài trăm
ms, load balancer vẫn còn gửi request tới pod đã ngừng nhận:

```js
process.on('SIGTERM', async () => {
  isShuttingDown = true;        // /readyz trả 503 ngay
  await sleep(5000);            // ← khoảng đệ để LB kịp bỏ pod này ra
  server.close();
  ...
});
```

**3. Pod mới được nhận traffic trước khi thật sự sẵn sàng.** `readinessProbe` chỉ kiểm tra cổng đã
mở, trong khi app còn đang kết nối DB, nạp cấu hình, làm nóng cache. Readiness probe phải kiểm tra
**phụ thuộc thật**:

```yaml
readinessProbe:
  httpGet: { path: /readyz, port: 3000 }   # /readyz kiểm tra DB + Redis, không chỉ trả 200
  initialDelaySeconds: 5
  periodSeconds: 2
```

Phân biệt hai loại probe — hay bị nhầm và hậu quả nghiêm trọng:
- **liveness**: "còn sống không?" — thất bại thì **giết pod**. Đừng kiểm tra database ở đây, vì DB
  chậm sẽ khiến k8s giết sạch pod và biến sự cố nhỏ thành sự cố toàn diện.
- **readiness**: "nhận traffic được chưa?" — thất bại thì chỉ bỏ pod ra khỏi LB. **Đây** mới là chỗ
  kiểm tra phụ thuộc.

**Cách kiểm chứng đã sửa được:** chạy một script bắn request liên tục trong lúc deploy và đếm số lỗi.
Trước khi sửa: vài chục lỗi. Sau khi sửa: 0. Đây là kiểu bằng chứng nên đưa ra khi kể lại ở phỏng vấn.

</details>

### Tình huống 10 — Chỉ một khách hàng báo chậm, mọi chỉ số đều xanh

<details><summary>Cách tiếp cận</summary>

Đây là tình huống kiểm tra xem bạn có hiểu **giới hạn của số liệu tổng hợp** hay không.

Vì sao dashboard xanh mà vẫn có người đau:

```
- p95 tính trên TOÀN BỘ user. Một khách hàng lớn = 0.1% traffic
  -> họ có thể ở p99.9 và biểu đồ p95 hoàn toàn không nhúc nhích
- Trung bình che giấu phân bố. p50 = 100 ms, p99 = 8 giây, "trung bình 180 ms" trông rất ổn
- Chỉ số đo phía server. Vấn đề có thể ở mạng, DNS, hoặc trình duyệt của họ
```

Cách khoanh vùng:

```
1. Lấy traceId từ vài request cụ thể của họ — nếu chưa có cách để khách hàng cung cấp
   traceId (hiện trong thông báo lỗi, trong footer), đó là việc cần làm.
2. So sánh p95 CỦA RIÊNG khách hàng đó với p95 toàn hệ thống.
   Nếu chưa tách được chỉ số theo tenant, đó cũng là việc cần làm.
3. Có gì khác biệt ở họ?
   - Dữ liệu lớn hơn nhiều (100 nghìn bản ghi trong khi trung bình là 100)
   - Ở khu vực địa lý xa datacenter
   - Dùng tính năng mà người khác không dùng
   - Gọi API theo cách khác (không phân trang, lấy hết)
```

Nguyên nhân phổ biến nhất cho tình huống này: **query có độ phức tạp tỷ lệ với dữ liệu của tenant**.
Chạy tốt với 100 bản ghi, chạy 8 giây với 100 nghìn. Không index nào cứu được một query kiểu
"tính tổng toàn bộ lịch sử mỗi lần mở dashboard".

Kiểm chứng nhanh:

```sql
SELECT tenant_id, count(*) FROM orders GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
```

Nếu khách hàng đang phàn nàn nằm ở đầu bảng thì giả thuyết được xác nhận.

**Điều đáng nói nhất ở cuối:** "Sự cố này cho thấy hệ thống đo lường của em thiếu chiều **tenant**.
Em sẽ thêm nhãn `tenant_id` vào chỉ số cho các khách hàng lớn, và đặt cảnh báo theo từng khách hàng
lớn chứ không chỉ theo tổng thể. Với mô hình B2B, một khách hàng lớn không hài lòng quan trọng hơn
0.1% traffic mà họ chiếm."

</details>

---

## Cách luyện phần này

Đừng đọc rồi gật đầu. Với mỗi tình huống:

1. **Nói thành tiếng**, bấm giờ 5 phút. Người phỏng vấn nghe cách bạn suy nghĩ, không đọc bài viết
   của bạn.
2. **Bắt đầu bằng câu hỏi**, không bằng câu trả lời. "Cho em hỏi, nó chậm với tất cả user hay chỉ
   một nhóm?" là mở đầu tốt hơn "em nghĩ là do database".
3. **Nói ra cả thứ bạn sẽ loại trừ** và vì sao — đó là bằng chứng của tư duy có hệ thống.
4. **Kết thúc bằng phòng ngừa.** Sự cố nào cũng nên kết thúc bằng một thay đổi trong hệ thống hoặc
   quy trình, không chỉ một bản vá.

---

Quay lại: [README của backend](./README.md) · Tiếp: [chung/01-system-design.md](../chung/01-system-design.md)
