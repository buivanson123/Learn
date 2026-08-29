# 70 câu hỏi phỏng vấn Redis + đáp án

Che đáp án, **tự trả lời thành tiếng** rồi mới đọc. ⭐ = hay gặp, ⭐⭐ = gần như chắc chắn bị hỏi.

Mọi output chạy thật trên **Redis 8.10.0** (`redis:8-alpine`).

| Mục | Chủ đề | Số câu |
|---|---|---|
| [A](#a--cơ-bản-và-kiến-trúc) | Cơ bản và kiến trúc | 9 |
| [B](#b--kiểu-dữ-liệu) | Kiểu dữ liệu | 11 |
| [C](#c--ttl-và-bộ-nhớ) | TTL và bộ nhớ | 10 |
| [D](#d--cache) | Cache | 11 |
| [E](#e--nguyên-tử-transaction-lua-khoá) | Transaction, Lua, khoá phân tán | 8 |
| [F](#f--pubsub-stream-hàng-đợi) | Pub/Sub, Stream, hàng đợi | 7 |
| [G](#g--bền-dữ-liệu) | Bền dữ liệu | 5 |
| [H](#h--nhân-bản-sentinel-cluster) | Nhân bản, Sentinel, Cluster | 9 |

---

## A — Cơ bản và kiến trúc

### A1 ⭐⭐ Redis là gì? Dùng để làm gì?

**Ngắn:** Kho dữ liệu khoá–giá trị chạy trong RAM, có kiểu dữ liệu phong phú (string, list, hash, set,
sorted set, stream). Dùng làm cache, session store, hàng đợi việc, rate limiter, bảng xếp hạng, khoá
phân tán, pub/sub.

**Đào sâu:** Điểm khiến Redis khác các cache khác (Memcached) là **có kiểu dữ liệu**. Bảng xếp hạng
10 triệu người chơi trong Redis là một lệnh `ZREVRANGE board 0 9` với độ phức tạp O(log N), thay vì
`ORDER BY score DESC LIMIT 10` quét bảng trong SQL. Nhiều bài toán rút từ "một query nặng" xuống "một
lệnh O(1) hoặc O(log N)".

### A2 ⭐⭐ Redis nhanh vì sao?

**Ngắn:** Ba lý do — dữ liệu trong RAM, mô hình một luồng nên không có khoá và không có chuyển ngữ cảnh,
và cấu trúc dữ liệu được tối ưu riêng cho từng thao tác.

**Đào sâu:** Đo thật trên container `redis:8-alpine`:

```
$ redis-benchmark -n 100000 -t set,get -q
SET: 178253.12 requests per second, p50=0.135 msec
GET: 164473.69 requests per second, p50=0.143 msec
```

Yếu tố thứ tư ít người nhắc: **giao thức RESP rất rẻ để phân tích** và **I/O đa hợp bằng epoll**
(`multiplexing_api:epoll` trong `INFO server`) — một luồng phục vụ hàng nghìn kết nối mà không cần
thread mỗi kết nối.

Yếu tố thứ năm: **pipelining**. Cùng máy đó, gộp 100 lệnh một gói:

```
$ redis-benchmark -n 100000 -t set,get -P 100 -q
SET: 2500000.00 requests per second
GET: 3333333.50 requests per second
```

Từ 178k lên 2.5M ops/s — chứng minh nút thắt thật sự là **vòng mạng**, không phải Redis.

### A3 ⭐⭐ Redis chạy một luồng — đó là điểm mạnh hay điểm yếu?

**Ngắn:** Cả hai. Mạnh vì mọi lệnh đơn đều nguyên tử, không cần khoá. Yếu vì **một lệnh chậm chặn toàn
bộ server**.

**Đào sâu:** Đo thật, hai kết nối tới cùng Redis; B chạy một script Lua nặng, A chỉ gõ `GET`:

```
GET lúc server rảnh:              1ms
GET lúc một script Lua đang chạy: 1431ms
```

Đây là gốc rễ của gần như mọi sự cố Redis: `KEYS *`, `DEL` khoá bự, `SMEMBERS` set triệu phần tử,
`HGETALL` hash khổng lồ, script Lua vòng lặp lớn.

Bổ sung cho đầy đủ: Redis 6+ có `io-threads` để **đọc/ghi socket** song song, nhưng việc **thực thi
lệnh** vẫn một luồng. Mặc định:

```
127.0.0.1:6379> CONFIG GET io-threads
2) "1"
```

### A4 ⭐ Redis khác Memcached thế nào?

**Ngắn:** Redis có kiểu dữ liệu, có persistence, có nhân bản/cluster, có Lua, có pub/sub. Memcached chỉ
có khoá–giá trị dạng chuỗi, nhưng đa luồng nên tận dụng nhiều core tốt hơn cho tải thuần GET/SET.

**Đào sâu:** Trong thực tế Memcached gần như chỉ còn thắng ở một điểm: cache chuỗi đơn giản trên máy
nhiều core với tải cực lớn. Mọi thứ khác Redis làm được nhiều hơn. Nếu bị hỏi "chọn cái nào", trả lời:
"Redis, trừ khi bài toán chỉ là cache chuỗi thuần và em cần tận dụng 32 core — lúc đó em vẫn cân nhắc
Redis Cluster trước."

### A5 ⭐ Redis khác database quan hệ thế nào? Khi nào **không** nên dùng Redis?

**Ngắn:** Redis không có schema, không có JOIN, không có transaction ACID đầy đủ, không có truy vấn theo
điều kiện tuỳ ý, và dữ liệu bị giới hạn bởi RAM.

**Không nên dùng khi:** dữ liệu là nguồn sự thật duy nhất và không được phép mất; cần truy vấn linh hoạt
(`WHERE`, `JOIN`, `GROUP BY`); dữ liệu lớn hơn RAM nhiều lần; cần giao dịch nhiều bước có rollback.

**Đào sâu:** Câu chốt tốt: "Em coi Redis là **lớp tăng tốc**, không phải nơi lưu. Mọi thứ trong Redis
phải xây lại được từ database nếu Redis mất sạch. Ngoại lệ duy nhất em chấp nhận là session — và lúc đó
em bật AOF và **không** dùng `allkeys-lru`."

### A6 Redis có 16 database, có nên dùng không?

**Ngắn:** Gần như không. Chúng dùng chung một tiến trình, một luồng, một `maxmemory` — không cách ly
hiệu năng. Và bị **cấm** trong Cluster.

**Đào sâu:**

```
127.0.0.1:6379> SELECT 1
(error) ERR SELECT is not allowed in cluster mode
```

Nếu bạn dùng `db1` cho cache và `db2` cho queue, ngày chuyển sang Cluster phải viết lại hết. Cách đúng
là **tiền tố khoá**: `cache:sp:1`, `queue:mail`. Chúng cũng cho phép `SCAN MATCH "cache:*"` khi cần dọn.

### A7 ⭐ RESP là gì? RESP2 khác RESP3 chỗ nào?

**Ngắn:** RESP là giao thức văn bản giữa client và Redis. RESP3 (Redis 6+) thêm kiểu dữ liệu (map, set,
double, big number), push message, và bỏ hạn chế của chế độ subscribe.

**Đào sâu:** Khác biệt thấy được ngay — trong chế độ subscribe:

```
RESP2 >> "-ERR Can't execute 'get': only (P|S)SUBSCRIBE / (P|S)UNSUBSCRIBE / PING / QUIT / RESET are
          allowed in this context"
RESP3 >> "_\r\n"            ← không chặn, GET trả về null bình thường
```

`ioredis@6` mặc định dùng RESP3. Nhưng **vẫn nên tách client riêng cho subscribe**, vì mọi lệnh đi chung
một kết nối thì vẫn phải xếp hàng sau nhau.

### A8 `redis-cli` in `"1"` khi tương tác nhưng `1` khi chạy một lệnh — vì sao?

**Ngắn:** Khi đầu ra **không phải terminal**, `redis-cli` tự chuyển sang "raw mode" để tiện đưa vào
`grep`/`awk`. Thêm `--no-raw` để giữ định dạng.

**Đào sâu:**

```bash
$ docker exec redis-lab redis-cli GET a
1
$ docker exec redis-lab redis-cli --no-raw GET a
"1"
$ docker exec redis-lab redis-cli --no-raw GET khong-co
(nil)
```

Biết mẹo này quan trọng khi debug: `(nil)` và chuỗi rỗng nhìn giống hệt nhau ở raw mode.

### A9 Đặt tên khoá thế nào cho đúng? Tên dài có tốn không?

**Ngắn:** Quy ước `<miền>:<thực-thể>:<id>:<thuộc-tính>`, ví dụ `cache:san-pham:1234`. Tên dài **tốn thật**.

**Đào sâu:** Đo thật với 100.000 khoá:

```
khoá ngắn u:N                                -> used_memory:8224248    (7.84 MB)
khoá dài  ung_dung:nguoi_dung:thong_tin:N    -> used_memory:11670824   (11.13 MB)
```

Chênh 3.4 MB, tức **+42%**. Với 10 triệu khoá là 340 MB RAM chỉ để chứa tên.

Ở Redis 8 còn một hệ quả nữa: độ dài khoá **ảnh hưởng đến encoding của giá trị**. Đo thật, ngưỡng
`embstr → raw` là `len(khoá) + len(giá trị) ≥ 42`:

```
độ dài khoá = 1   -> raw khi giá trị dài 41   (tổng 42)
độ dài khoá = 20  -> raw khi giá trị dài 22   (tổng 42)
```

Không phải "44 byte" như phần lớn blog viết.

---

## B — Kiểu dữ liệu

### B1 ⭐⭐ Redis có những kiểu dữ liệu nào?

**Ngắn:** Năm kiểu cốt lõi — String, List, Hash, Set, Sorted Set. Thêm Stream, Bitmap, HyperLogLog,
Geo (thực chất là Sorted Set), và Bitfield.

**Đào sâu:** Nói kèm **dùng khi nào** thì mới ăn điểm:

| Kiểu | Dùng cho |
|---|---|
| String | Cache JSON, đếm số, khoá phân tán, feature flag |
| Hash | Cache object mà hay sửa một trường |
| List | Hàng đợi FIFO, "N hoạt động gần nhất" |
| Set | Tag, bạn bè, "đã xem", phép giao/hợp |
| Sorted Set | Bảng xếp hạng, việc hẹn giờ, rate limit cửa sổ trượt |
| Stream | Hàng đợi việc có ACK và replay |
| Bitmap | Điểm danh theo id liên tục — 1 bit/user |
| HyperLogLog | Đếm UV gần đúng, 14 KB cho hàng triệu |

### B2 ⭐⭐ Khi nào dùng Hash, khi nào dùng String JSON?

**Ngắn:** Hash khi thường chỉ đọc/sửa vài trường; String JSON khi luôn đọc cả object.

**Đào sâu:** Với String JSON, tăng tuổi lên 1 cần `GET` → `parse` → sửa → `stringify` → `SET`: bốn bước,
hai vòng mạng, và **có race condition** nếu hai request cùng làm. Với Hash: `HINCRBY user:1 age 1` — một
lệnh, nguyên tử.

Hash cũng tiết kiệm hơn nhiều khoá string rời. Đo thật, 1000 người dùng × 3 trường:

```
3000 khoá string   : used_memory 3117392
1000 hash 3 trường : used_memory 3020504     ← ít hơn 96888 byte
```

Một hash 3 trường tốn `MEMORY USAGE` = 55 byte; 3 khoá string riêng tốn ~96 byte chỉ riêng header.

### B3 ⭐ Làm bảng xếp hạng bằng gì? Vì sao?

**Ngắn:** Sorted Set. `ZINCRBY` cộng điểm và sắp xếp lại trong một lệnh O(log N); `ZREVRANGE k 0 9`
lấy top 10.

**Đào sâu:**

```
127.0.0.1:6379> ZADD board 100 an 250 binh 175 cuong
(integer) 3
127.0.0.1:6379> ZINCRBY board 50 an
"150"
127.0.0.1:6379> ZREVRANGE board 0 2 WITHSCORES
1) "binh"
2) "250"
3) "cuong"
4) "175"
5) "an"
6) "150"
127.0.0.1:6379> ZREVRANK board binh
(integer) 0                     ← hạng đếm từ 0
```

Chi phí không phụ thuộc số người chơi. Cùng bài toán bằng SQL cần `ORDER BY score DESC LIMIT 10` và
index phải cập nhật mỗi lần đổi điểm.

Chi tiết dễ quên khi trả lời: `ZRANK` đếm **từ 0**, và tính theo thứ tự **tăng dần** — muốn hạng theo
điểm cao thì dùng `ZREVRANK` rồi `+1`.

### B4 Làm rate limiter "5 request/phút" bằng Redis thế nào?

**Ngắn:** Hai cách. Cửa sổ cố định: `INCR` + `EXPIRE ... NX`. Cửa sổ trượt: Sorted Set với điểm là
timestamp.

**Đào sâu — cửa sổ cố định:**

```
127.0.0.1:6379> INCR rl:user1
(integer) 1
127.0.0.1:6379> EXPIRE rl:user1 60 NX
(integer) 1
127.0.0.1:6379> INCR rl:user1
(integer) 2
127.0.0.1:6379> EXPIRE rl:user1 60 NX
(integer) 0                     ← đã có hạn, KHÔNG reset
127.0.0.1:6379> TTL rl:user1
(integer) 60
```

**`NX` là chi tiết quyết định.** Không có nó, mỗi request lại reset TTL về 60 → user gửi đều đặn thì bộ
đếm không bao giờ reset và bị chặn **vĩnh viễn**.

Cửa sổ cố định có lỗ hổng ở ranh giới. Đo thật với giới hạn 5 request/giây:

```
cuối cửa sổ 1: đã dùng 5/5
đầu cửa sổ 2 (ngay sau đó): thêm 5 request nữa lọt → tổng 10 trong ~1 giây
```

Cửa sổ trượt bằng ZSet không có lỗ hổng đó, đổi lại tốn RAM hơn nhiều (lưu N mục thay vì một số).
Dùng cố định cho API thường, dùng trượt cho đăng nhập / OTP / thanh toán.

### B5 Đếm 100 triệu UV mà tiết kiệm RAM — dùng gì?

**Ngắn:** HyperLogLog (`PFADD`/`PFCOUNT`), sai số ~0.81%, tốn ~14 KB bất kể số phần tử.

**Đào sâu:** Đo thật với 100.000 phần tử:

```
thật sự : 100000
PFCOUNT : 99725                 ← sai 275, tức 0.275%
bộ nhớ  : 14357 byte

SET thường: 100000 phần tử, 4261838 byte
```

**14.357 byte vs 4.261.838 byte — nhỏ hơn 297 lần.** Đánh đổi: HLL **không liệt kê lại được** phần tử,
chỉ đếm. Cần biết *ai* thì phải dùng Set.

`PFMERGE` gộp nhiều HLL (30 khoá theo ngày → số của cả tháng) mà không đếm trùng.

### B6 Bitmap dùng khi nào? Có bẫy gì?

**Ngắn:** Khi cần một cờ nhị phân cho mỗi id **liên tục và dày** — ví dụ "user nào online hôm nay".
Bẫy: bitmap là chuỗi **đặc**, không thưa.

**Đào sâu:** Đo thật với dải id 1..1.000.000:

```
Bitmap 900.000 online :    131093 byte  (128 KB)
Set    900.000 online :  29877580 byte  (28.5 MB)   → Bitmap nhỏ hơn 228 lần

Bitmap 50 online      :    163862 byte  (160 KB)
Set    50 online      :       230 byte              → Set nhỏ hơn 712 lần
```

Bitmap tốn gần như nhau ở cả hai trường hợp vì phải cấp phát tới **bit có chỉ số lớn nhất**:

```
127.0.0.1:6379> SETBIT online 500000 1
127.0.0.1:6379> STRLEN online
(integer) 62501                 ← 62 KB cho MỘT bit được bật
```

Ngưỡng hoà vốn ~0.5% mật độ. Với id là UUID hoặc nhảy cóc, luôn dùng Set.

### B7 `SMEMBERS` và `HGETALL` có gì nguy hiểm?

**Ngắn:** Cả hai là O(N) và trả toàn bộ dữ liệu về client trong một lần. Trên tập triệu phần tử, chúng
vừa chặn server vừa nghẽn mạng.

**Đào sâu:** Thay bằng: `SISMEMBER` (O(1)) nếu chỉ cần kiểm tra thành viên; `HMGET` nếu chỉ cần vài
trường; `SSCAN`/`HSCAN` nếu thật sự cần duyệt hết.

Phát hiện khoá bự trước khi nó gây sự cố:

```bash
$ redis-cli --memkeys
Biggest   list found "ds-lon" has 2302175 bytes
Biggest   hash found "hash-lon" has 4950737 bytes
```

Ngưỡng đáng lo: > 5.000 phần tử với tập hợp, > 100 KB với string, hoặc `MEMORY USAGE` > 1 MB.

### B8 `--bigkeys` và `--memkeys` khác nhau thế nào?

**Ngắn:** `--bigkeys` đo theo **số phần tử**, `--memkeys` đo theo **byte**.

**Đào sâu:** Khác biệt này gây hiểu nhầm thật. Cùng một database:

```
$ redis-cli --bigkeys
Biggest string found "nho" has 1 bytes        ← "nho" chỉ có 1 byte!
$ redis-cli --memkeys
Biggest string found "nho" has 32 bytes
```

`--bigkeys` báo `"nho"` là "biggest string" chỉ vì đó là string duy nhất. Cả hai đều dùng `SCAN` bên
dưới nên **an toàn trên production**.

### B9 `OBJECT ENCODING` để làm gì?

**Ngắn:** Cho biết Redis đang lưu khoá đó ở dạng nào — nén (`listpack`, `intset`, `embstr`, `int`) hay
đầy đủ (`hashtable`, `skiplist`, `quicklist`, `raw`).

**Đào sâu:** Quan trọng vì chênh lệch bộ nhớ rất lớn. Đo thật:

```
zset 128 phần tử -> listpack  MEMORY USAGE 947
zset 129 phần tử -> skiplist  MEMORY USAGE 10679       ← thêm 1 phần tử, tốn gấp 11 lần

hash 512 trường -> listpack   MEMORY USAGE 5958
hash 513 trường -> hashtable  MEMORY USAGE 23445       ← gấp ~4 lần
```

Ngưỡng thật trên Redis 8.10.0 — **`hash-max-listpack-entries` là 512, không phải 128** như blog cũ:

```
127.0.0.1:6379> CONFIG GET hash-max-listpack-entries
2) "512"
127.0.0.1:6379> CONFIG GET zset-max-listpack-entries
2) "128"
```

Và chỉ cần **một** trường có giá trị dài quá `hash-max-listpack-value` (64) là cả hash chuyển sang
`hashtable`. Chuyển đổi là **một chiều** — xoá bớt phần tử không quay lại `listpack`.

Ứng dụng: chia một hash 1 triệu trường thành 1000 hash 1000 trường (`HSET user:shard:<id % 1000> ...`)
để giữ được `listpack`.

### B10 Làm hàng đợi việc bằng List thế nào? Nó thiếu gì?

**Ngắn:** `LPUSH` để đẩy việc, `BRPOP` để worker lấy (có chặn). Thiếu: ACK, retry, biết việc nào đang
treo, replay.

**Đào sâu:** Vấn đề cụ thể: worker `BRPOP` lấy việc xong rồi **chết** trước khi xử lý → việc mất luôn,
không ai biết.

Bản vá một phần là `BLMOVE`:

```
127.0.0.1:6379> LMOVE src dst LEFT RIGHT
"a"
```

Chuyển việc sang danh sách "đang làm" **nguyên tử**. Worker giám sát quét `queue:dang-lam` và trả việc
treo về. Nhưng để biết "treo bao lâu" thì phải tự lưu timestamp — đến đây thì nên dùng **Stream** hoặc
**BullMQ** thay vì tự dựng.

### B11 `SADD` trả về gì? Dùng con số đó làm gì?

**Ngắn:** Số phần tử **thật sự được thêm mới**, không phải số phần tử truyền vào.

**Đào sâu:**

```
127.0.0.1:6379> SADD tags:post:1 redis nodejs redis backend
(integer) 3                     ← truyền 4, chỉ 3 mới vì "redis" trùng
```

Ứng dụng: `SADD like:post:1 user:99` trả `1` là lần đầu like, `0` là đã like rồi — **một lệnh**, không
cần `SISMEMBER` rồi `SADD` (vốn có race condition). Cùng ý tưởng: `SET k v NX` trả `nil` khi trượt,
`ZADD ... GT` trả `0` khi không cập nhật. Đọc kỹ giá trị trả về giúp bỏ được rất nhiều transaction.

---

## C — TTL và bộ nhớ

### C1 ⭐⭐ `TTL` trả về `-1` và `-2` khác nhau thế nào?

**Ngắn:** `-1` = khoá **tồn tại** nhưng không có hạn. `-2` = khoá **không tồn tại**.

**Đào sâu:** Nhầm hai giá trị này là bug kinh điển: `if (ttl < 0) return null` coi khoá vĩnh viễn là
"không có". Với dữ liệu cấu hình lưu không TTL, đó là lỗi im lặng.

### C2 ⭐⭐ Lệnh nào xoá mất TTL của khoá?

**Ngắn:** Chỉ hai loại — lệnh thay thế toàn bộ giá trị bằng một `SET` ngầm (`SET`, `GETSET`), và
`PERSIST`. Mọi lệnh sửa-tại-chỗ đều giữ hạn.

**Đào sâu:** Đo thật, tất cả bắt đầu từ `EX 100`:

```
SET k v         → TTL -1   ⚠️
GETSET k v      → TTL -1   ⚠️
SET k v KEEPTTL → TTL 100  ✅
APPEND          → TTL 100  ✅
SETRANGE        → TTL 100  ✅
INCR            → TTL 100  ✅
RENAME k k2     → TTL 100  ✅
COPY k k2       → TTL 100  ✅
HSET/LPUSH/SADD/ZADD → TTL 100 ✅
```

Bug thật hay gặp: code làm `redis.set(key, JSON.stringify(data))` để "cập nhật cache" mà quên `EX`. Sau
vài tháng Redis đầy khoá vĩnh viễn.

### C3 ⭐⭐ Redis xoá khoá hết hạn vào lúc nào?

**Ngắn:** Hai cơ chế song song. **Lười** — khi có ai chạm vào khoá thì kiểm tra và xoá. **Chủ động** —
10 lần/giây lấy ngẫu nhiên 20 khoá có TTL, xoá khoá đã hết hạn; nếu > 25% trong số đó hết hạn thì lặp
lại ngay.

**Đào sâu:** Đo thật — nạp 5000 khoá `EX 2`, **không đọc khoá nào**:

```
ngay sau khi ghi:               DBSIZE=5000
sau 3 giây (chưa đọc khoá nào): DBSIZE=0

127.0.0.1:6379> INFO stats
expired_keys:5004
expired_keys_active:5003        ← 5003/5004 do vòng quét chủ động
```

Kết quả này bác hiểu lầm "khoá hết hạn vẫn chiếm RAM cho tới khi bạn đọc nó".

**Nhưng** cơ chế lấy mẫu ngẫu nhiên có mặt trái: 10 triệu khoá mà chỉ 100 khoá hết hạn thì xác suất lấy
trúng rất thấp → chúng nằm lại lâu. Đó là lý do `used_memory` đôi khi không giảm ngay.

Trên **replica**: replica không tự xoá, nó chờ `DEL` từ master. Nhưng khi có client đọc, replica vẫn
kiểm tra hạn và trả `(nil)` — kết quả đọc luôn đúng, chỉ `DBSIZE` có thể lệch.

### C4 ⭐⭐ Redis đầy RAM thì chuyện gì xảy ra?

**Ngắn:** Tuỳ `maxmemory-policy`. Mặc định `noeviction` → mọi lệnh **ghi** trả lỗi OOM, đọc vẫn được.
Với `allkeys-lru` → Redis đẩy khoá cũ ra và tiếp tục ghi. Nếu **không đặt `maxmemory`** → OOM killer của
hệ điều hành giết tiến trình, mất sạch.

**Đào sâu:** Đo thật với `maxmemory 8mb`:

```
--- noeviction ---
Error from server: OOM command not allowed when used memory > 'maxmemory'.
evicted_keys:0

--- allkeys-lru ---
(chạy hết, không lỗi)
DBSIZE=60237
evicted_keys:142778
```

Trong container, OOM killer để lại exit code **137** (`128 + 9`).

### C5 ⭐ Có mấy chính sách eviction? Chọn cái nào?

**Ngắn:** Tám. `noeviction`, `allkeys-{lru,lfu,random}`, `volatile-{lru,lfu,random,ttl}`.
Cache thuần → `allkeys-lru`. Kho dữ liệu / session → `noeviction`.

**Đào sâu:** Câu chốt tốt: "Nếu em thấy mình cần `volatile-*`, đó là dấu hiệu đang trộn cache với dữ liệu
quan trọng trong **cùng một Redis** — em tách thành hai instance thay vì tinh chỉnh chính sách."

### C6 ⭐ Cái bẫy của `volatile-lru` là gì?

**Ngắn:** `volatile-*` chỉ được xoá khoá **có TTL**. Nếu không khoá nào có TTL, nó hành xử y hệt
`noeviction` — báo lỗi OOM.

**Đào sâu:** Đo thật:

```bash
$ redis-cli FLUSHALL
$ redis-cli CONFIG SET maxmemory-policy volatile-lru
$ redis-benchmark -n 200000 -t set -q
Error from server: OOM command not allowed when used memory > 'maxmemory'.
```

**Kịch bản sự cố thật:** bạn chọn `volatile-lru` vì nghĩ nó an toàn hơn. Rồi một đoạn code mới `SET` mà
quên `EX`. Vài tuần sau Redis đầy và hệ thống ngừng ghi.

**Dấu hiệu nhận biết:** `evicted_keys:0` trong khi `used_memory` đã chạm `maxmemory`.

### C7 LRU của Redis có chính xác không? LFU khác gì?

**Ngắn:** LRU là **gần đúng** — Redis lấy mẫu ngẫu nhiên `maxmemory-samples` (mặc định 5) khoá và bỏ
khoá cũ nhất trong mẫu đó. LFU đếm **tần suất** theo thang logarit và có giảm dần theo thời gian.

**Đào sâu:** Đo thật LFU:

```bash
$ redis-cli CONFIG SET maxmemory-policy allkeys-lfu
$ redis-cli SET nong 1; redis-cli SET lanh 1
$ for i in $(seq 1 200); do redis-cli GET nong > /dev/null; done
$ redis-cli OBJECT FREQ nong; redis-cli OBJECT FREQ lanh
11
5
```

Đọc 200 lần chỉ đưa bộ đếm lên **11**, khoá chưa đọc là **5** (giá trị khởi tạo). Bộ đếm LFU là 8 bit,
tăng theo xác suất giảm dần, và giảm dần theo `lfu-decay-time` (mặc định 1 phút).

Chọn LFU khi có nhóm khoá nóng ổn định; chọn LRU khi độ nóng thay đổi theo thời gian.

### C8 ⭐ `mem_fragmentation_ratio` là gì? Bao nhiêu thì lo?

**Ngắn:** `used_memory_rss / used_memory`. Trên 1.5 là phân mảnh nặng; **dưới 1.0 là đang bị swap**,
tệ hơn nhiều.

**Đào sâu:**

```
used_memory_human:7.92M
used_memory_rss_human:36.98M
used_memory_peak_human:135.10M
mem_fragmentation_ratio:4.68
```

Tỉ lệ 4.68 trông thảm hoạ, nhưng nguyên nhân ở đây là vừa xoá một khoá 155 MB (`peak` là dấu vết) và hệ
điều hành chưa thu hồi RAM. **Luôn đọc `peak` trước khi kết luận** — dataset nhỏ luôn cho tỉ lệ cao vì
mẫu số nhỏ.

Xử lý: `activedefrag yes` để Redis tự dồn trong nền, hoặc restart có kế hoạch. Nếu tỉ lệ < 1.0 thì việc
đầu tiên là **tắt swap** trên máy đó.

### C9 Giảm RAM Redis bằng cách nào?

**Ngắn:** Theo thứ tự hiệu quả — đặt TTL cho mọi thứ, rút ngắn tên khoá, gom khoá nhỏ vào hash, chọn
đúng kiểu (HLL thay Set), nén ở tầng ứng dụng.

**Đào sâu:** Cách kiểm tra nhanh xem có khoá nào thiếu TTL không:

```
127.0.0.1:6379> INFO keyspace
db0:keys=631658,expires=0,avg_ttl=0,subexpiry=0
```

`expires=0` trên instance cache là báo động đỏ: **không khoá nào có hạn**.

Con số cho từng cách đã có ở C2, A9, B2, B5.

### C10 `DEL` và `UNLINK` khác nhau thế nào?

**Ngắn:** `DEL` giải phóng bộ nhớ **trong luồng chính** (chặn); `UNLINK` chỉ gỡ khoá khỏi keyspace rồi
giao việc giải phóng cho luồng nền.

**Đào sâu:** Đo thật trên hash 3 triệu trường (155 MB):

```
127.0.0.1:6379> DEL khoa-bu
127.0.0.1:6379> SLOWLOG GET 1
   3) (integer) 239292          ← 239ms server BỊ TREO

127.0.0.1:6379> UNLINK khoa-bu2
127.0.0.1:6379> SLOWLOG GET 1
(empty array)                   ← không lọt slowlog (ngưỡng 1ms)
```

**Quy tắc: mặc định dùng `UNLINK`.** Với code cũ không sửa được, bật `lazyfree-lazy-user-del yes` để
`DEL` hành xử y hệt `UNLINK`. `FLUSHALL`/`FLUSHDB` cũng có tuỳ chọn `ASYNC`.

---

## D — Cache

### D1 ⭐⭐ Cache-aside là gì? Viết ra code.

**Ngắn:** Bốn bước — hỏi cache; trúng thì trả luôn; trượt thì hỏi DB; nạp lại cache rồi trả.

**Đào sâu:**

```js
async function laySanPham(id) {
  const key = `sp:${id}`;
  const cache = await redis.get(key);
  if (cache !== null) return JSON.parse(cache);

  const row = await db.sanPham.findById(id);
  await redis.set(key, JSON.stringify(row), 'EX', 300);
  return row;
}
```

Ưu: đơn giản, Redis chết chỉ chậm chứ không sập. Nhược: request đầu luôn chậm, và có cửa sổ dữ liệu cũ
dài bằng TTL.

Ba mẫu khác để nhắc tên: **read-through** (thư viện tự gọi DB), **write-through** (ghi DB và cache cùng
lúc), **write-behind** (ghi cache trước, đẩy xuống DB sau — nhanh nhất nhưng **mất dữ liệu nếu Redis
chết**).

### D2 ⭐⭐ Dữ liệu đổi thì **cập nhật** cache hay **xoá** cache?

**Ngắn:** **Ghi DB trước, rồi XOÁ cache.** Không cập nhật, không xoá trước.

**Đào sâu:** Ba cách sai:

**❌ Ghi DB rồi cập nhật cache** — hai request cùng sửa, thứ tự ghi cache có thể đảo:
```
A: ghi DB = v1
B: ghi DB = v2
B: ghi cache = v2
A: ghi cache = v1        ← DB có v2, cache có v1, sai tới hết TTL
```

**❌ Xoá cache rồi ghi DB** — một request đọc chen vào giữa:
```
A: xoá cache
B: đọc cache → trượt
B: đọc DB → lấy giá trị CŨ
A: ghi DB = mới
B: ghi giá trị CŨ vào cache   ← sai tới hết TTL
```

**✅ Ghi DB rồi xoá cache** — vẫn có cửa sổ lý thuyết rất hẹp, nhưng nhỏ hơn hàng nghìn lần vì "đọc DB →
ghi cache" ngắn hơn nhiều so với "ghi DB".

Bổ sung ăn điểm: nếu `redis.del` thất bại thì cache sai tới hết TTL → với dữ liệu nhạy cảm thêm **xoá
trễ** (`setTimeout` 500ms xoá lần hai). Hoặc dùng **khoá theo phiên bản** (`INCR ver:sp:1` rồi
`sp:1:v<n>`) — không bao giờ sai, đổi lại tốn RAM cho tới khi khoá cũ hết hạn.

### D3 ⭐⭐ Cache stampede là gì? Chống thế nào?

**Ngắn:** Một khoá nóng hết hạn đúng lúc traffic cao → **mọi** request cùng trượt và cùng đâm vào DB.
Chống bằng khoá `SET NX`: chỉ một request được đi lấy dữ liệu, số còn lại chờ.

**Đào sâu:** Đo thật, 100 request đồng thời cho cùng một sản phẩm, query DB 300ms:

```
cache-aside trần  : 100 request đồng thời → gọi DB 100 lần, mất 312ms
có khoá NX        : 100 request đồng thời → gọi DB   1 lần, mất 327ms
```

Ba chi tiết dễ làm sai:
1. **Khoá phải có TTL** — tiến trình giữ khoá bị kill mà không TTL thì mọi request khác treo vĩnh viễn.
2. **Nhả khoá phải kiểm tra token bằng Lua**, không `DEL` thẳng (xem E7).
3. **Phải có đường thoát** khi chờ quá lâu.

Cách thứ hai: **làm mới sớm theo xác suất** — khi TTL còn < 10%, cho ~10% request tự nguyện làm mới
cache trong nền. Không ai phải chờ, nhưng không bảo đảm tuyệt đối chỉ một người làm mới.

### D4 ⭐⭐ Cache penetration (xuyên cache) là gì?

**Ngắn:** Request hỏi id **không tồn tại** trong DB. Cache-aside trần không bao giờ ghi gì (không có dữ
liệu để ghi) nên **mọi** request đều xuống DB.

**Đào sâu:** Đo thật, 200 request cho một id không tồn tại:

```
không chống xuyên       : 200 request → 200 lần chạm DB
cache cả kết quả rỗng   : 200 request →   1 lần chạm DB
```

Sửa: **cache cả kết quả rỗng** với TTL ngắn hơn hẳn (30 giây).

```js
const row = await db.findById(id);
await redis.set(key, JSON.stringify(row), 'EX', row ? 300 : 30);
```

Điểm mấu chốt ở phía đọc: phân biệt ba trạng thái —

| `redis.get` trả về | Nghĩa |
|---|---|
| `null` (kiểu JS) | **Cache miss** — phải xuống DB |
| chuỗi `"null"` | **Cache hit, giá trị là không tồn tại** |
| chuỗi JSON khác | Hit bình thường |

Khi id bị bắn ngẫu nhiên (tấn công thật), cache null không đủ vì mỗi id sinh một khoá mới. Lúc đó dùng
**Bloom filter** (`BF.EXISTS`) để chặn trước khi chạm cache hay DB.

### D5 ⭐ Cache avalanche (tuyết lở) là gì?

**Ngắn:** **Nhiều** khoá cùng hết hạn một lúc → toàn bộ traffic đập vào DB. Khác stampede (một khoá,
nhiều request).

**Đào sâu:** Nguyên nhân: nạp cache hàng loạt lúc deploy với cùng TTL cố định; hoặc Redis restart.

Chống: **thêm nhiễu ngẫu nhiên vào TTL**.

```js
const ttl = 3600 + Math.floor(Math.random() * 600);   // 3600–4200
```

10.000 khoá sẽ hết hạn rải trong 10 phút thay vì cùng một giây. Bổ sung: cache hai tầng (Map trong
tiến trình + Redis), và bật persistence để restart xong cache còn nguyên.

### D6 Cache breakdown (khoá nóng) là gì?

**Ngắn:** **Một** khoá nhận toàn bộ traffic (trang chủ, sản phẩm sale). Trong Cluster, một shard nóng
bất thường.

**Đào sâu:** Chống bằng: không đặt TTL cho khoá cực nóng mà chủ động làm mới bằng cron; nhân bản khoá
thành `sp:hot:0`…`sp:hot:9` và chọn ngẫu nhiên (trong Cluster chúng rơi vào slot khác nhau nên trải tải);
thêm cache tầng ứng dụng cho đúng khoá đó.

### D7 ⭐ Cache cái gì và **không** cache cái gì?

**Ngắn:** Cache thứ đọc nhiều ghi ít và tốn để tính lại. Không cache thứ phải chính xác tuyệt đối, thứ
chỉ đọc một lần, và thứ quá lớn.

**Đào sâu:**

| Cache | Không cache |
|---|---|
| Query nặng, đọc nhiều ghi ít | Số dư, tồn kho lúc thanh toán |
| Trang / khối HTML render sẵn | Dữ liệu riêng của user chỉ xem 1 lần |
| Cấu hình, feature flag, bảng tra | Thứ tính lại còn rẻ hơn đi hỏi Redis |
| Kết quả gọi API bên thứ ba | Giá trị > 1 MB |

Về giá trị lớn: một khoá 1 MB đọc 1000 lần/giây là **1 GB/s qua mạng** — Redis nghẽn vì băng thông chứ
không phải CPU. Kiểm tra bằng `total_net_output_bytes` trong `INFO stats`.

### D8 ⭐⭐ Redis chết thì app của bạn thế nào?

**Ngắn:** Phải chỉ chậm đi, không được sập. Bọc `try/catch` quanh mọi lệnh Redis, đặt `commandTimeout`,
và có circuit breaker.

**Đào sâu:**

```js
try {
  const c = await redis.get(key);
  if (c !== null) return JSON.parse(c);
} catch (e) {
  logger.warn({ e }, 'Redis lỗi, bỏ qua cache');   // KHÔNG throw
}
const row = await db.findById(id);
redis.set(key, JSON.stringify(row), 'EX', 300).catch(() => {});
return row;
```

**`commandTimeout` là chi tiết hay bị quên.** Không có nó, Redis *treo* (chứ không phải chết hẳn) sẽ giữ
request vô hạn — "Redis chậm" biến thành "app chết":

```js
new Redis({ host, port, commandTimeout: 200, maxRetriesPerRequest: 1, enableOfflineQueue: false });
```

Bổ sung ăn điểm: "Nhưng bỏ cache nghĩa là **toàn bộ** traffic đập vào DB. Nếu DB không chịu nổi thì
graceful degradation biến thành sập dây chuyền — nên em có thêm rate limit ở tầng trước."

### D9 Chọn TTL bao nhiêu?

**Ngắn:** Ba câu hỏi — dữ liệu cũ bao lâu thì có hại; cache miss tốn bao nhiêu; nếu 10.000 khoá cùng
hết hạn thì sao.

**Đào sâu:** Mốc tham khảo:

| Loại | TTL |
|---|---|
| Session | 30 phút – 7 ngày, gia hạn bằng `EXPIRE ... GT` |
| Query danh sách | 30 giây – 5 phút |
| Chi tiết bản ghi | 5 – 60 phút + xoá chủ động khi sửa |
| Cấu hình / feature flag | 1 – 5 phút |
| Rate limit | đúng bằng cửa sổ |
| Khoá phân tán | dài hơn thời gian xử lý dài nhất, 10–30 giây |
| Kết quả "không tìm thấy" | 30 – 60 giây |

Và quy tắc bao trùm: **mọi khoá cache phải có TTL**.

### D10 Tỉ lệ trúng cache bao nhiêu là tốt? Đo ở đâu?

**Ngắn:** `keyspace_hits / (keyspace_hits + keyspace_misses)` trong `INFO stats`. Dưới 80% là cache
đang không giúp được nhiều.

**Đào sâu:**

```
127.0.0.1:6379> INFO stats
keyspace_hits:20000
keyspace_misses:0
```

Tỉ lệ thấp có ba nguyên nhân thường gặp: TTL quá ngắn; đang cache thứ mỗi user một khác (nên cache ở
tầng khác); hoặc `evicted_keys` cao nên khoá bị đá ra trước khi được dùng lại.

### D11 Cache nhiều tầng là gì?

**Ngắn:** Tầng 1 trong bộ nhớ tiến trình (Map + TTL 5–10 giây), tầng 2 là Redis, tầng 3 là DB.

**Đào sâu:** Lợi: giảm cả vòng mạng tới Redis, và Redis chết thì tầng 1 vẫn đỡ được vài giây cao điểm.
Hại: **mỗi pod có bản cache riêng** → dữ liệu giữa các pod lệch nhau trong khoảng TTL của tầng 1.

Cách vá: dùng Pub/Sub để phát tín hiệu xoá cache tầng 1 khi dữ liệu đổi — đây là một trong số ít việc
mà Pub/Sub phù hợp, vì mất tin nhắn cũng chỉ dẫn tới cache cũ thêm vài giây.

---

## E — Nguyên tử: transaction, Lua, khoá

### E1 ⭐⭐ `MULTI/EXEC` có phải transaction không? Có rollback không?

**Ngắn:** Nó cho **tính nguyên tử** (không client nào chen vào giữa) và **tính cô lập**, nhưng **không
có rollback**.

**Đào sâu:** Hai loại lỗi hành xử khác nhau.

**Lỗi cú pháp** (phát hiện lúc xếp hàng) → cả khối bị huỷ:

```
127.0.0.1:6379> MULTI
127.0.0.1:6379> SET x 1
QUEUED
127.0.0.1:6379> LENHSAI a b
(error) ERR unknown command 'LENHSAI', with args beginning with: 'a' 'b'
127.0.0.1:6379> EXEC
(error) EXECABORT Transaction discarded because of previous errors.
127.0.0.1:6379> GET x
"0"                             ← không lệnh nào chạy
```

**Lỗi lúc chạy** (sai kiểu) → các lệnh khác **vẫn thực thi**:

```
127.0.0.1:6379> MULTI
127.0.0.1:6379> INCR dem
QUEUED
127.0.0.1:6379> INCR chuoi        (chuoi = "abc")
QUEUED
127.0.0.1:6379> INCR dem
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 2
2) (error) ERR value is not an integer or out of range
3) (integer) 3
127.0.0.1:6379> GET dem
"3"                             ← lệnh 1 và 3 ĐÃ chạy
```

Giới hạn thứ hai ít người nhắc: trong khối `MULTI`, mọi lệnh chỉ trả `QUEUED` → **không đọc được kết quả
giữa chừng**. Muốn "đọc rồi mới quyết định ghi" thì phải `WATCH` hoặc Lua.

### E2 ⭐⭐ Pipeline khác `MULTI` chỗ nào?

**Ngắn:** Pipeline chỉ gom nhiều lệnh gửi một lần để **tiết kiệm vòng mạng** — lệnh của client khác
**vẫn chen vào giữa được**. `MULTI` mới bảo đảm không ai chen.

**Đào sâu:** Đây là câu bẫy hay bị trả lời sai. Pipeline giải quyết **độ trễ mạng**, `MULTI` giải quyết
**tính nguyên tử**. Chúng độc lập và dùng chung được (`MULTI` gửi qua pipeline).

Con số cho pipeline (1000 khoá, đo từ Node):

```
1000 GET tuần tự (await từng cái)    205ms
1000 GET bằng pipeline()               7ms
1 lệnh MGET 1000 khoá                  2ms
```

### E3 ⭐ `WATCH` dùng để làm gì?

**Ngắn:** Khoá lạc quan. `WATCH k` bảo Redis huỷ `EXEC` nếu khoá đó bị ai sửa trước khi transaction chạy.

**Đào sâu:** Đo thật với hai kết nối:

```
A> SET ton-kho 1         +OK
A> WATCH ton-kho         +OK
A> GET ton-kho           1
A> MULTI                 +OK
A> DECR ton-kho          +QUEUED
B> DECR ton-kho          :0          ← B chen vào
A> EXEC                  (nil)       ← EXEC BỊ HUỶ
A> GET ton-kho           0
```

`EXEC` trả `(nil)` = "có người đụng khoá tôi canh". App phải **thử lại từ đầu**.

Ba điều nhớ: `WATCH` gắn với **kết nối** (cẩn thận với pool); `EXEC`/`DISCARD` tự huỷ mọi `WATCH`; và
**dưới tranh chấp cao thì `WATCH` rất tệ** — 100 client canh một khoá thì 99 phải thử lại. Lúc đó dùng Lua.

### E4 ⭐⭐ Bán 1 món hàng cho nhiều người cùng lúc — làm sao không bán quá?

**Ngắn:** Không đọc rồi ghi trong app. Dùng giá trị trả về của một lệnh đơn, hoặc `WATCH`, hoặc Lua.

**Đào sâu:** Đo thật, `ton-kho = 1`, 20 client đồng thời:

```
GET rồi DECR      : bán được 17/20 đơn, tồn kho còn lại = -16
DECR rồi kiểm tra : bán được  1/20 đơn, tồn kho còn lại = 0
Lua script        : bán được  1/20 đơn, tồn kho còn lại = 0
```

**Bán 17 món khi chỉ có 1.** Race condition không phải "thỉnh thoảng lệch một chút".

Cách rẻ nhất — **dùng chính giá trị trả về**:

```js
const con = await r.decr('ton-kho');
if (con >= 0) return 'ban';
await r.incr('ton-kho');      // trả lại
return 'het';
```

Một lệnh, không transaction, không Lua. **Luôn thử cách này trước.**

### E5 ⭐ Lua script trong Redis — vì sao dùng, có gì phải cẩn thận?

**Ngắn:** Script chạy **trọn vẹn** trong luồng chính, không ai chen vào, và **đọc được kết quả giữa
chừng** — thứ `MULTI` không cho. Phải cẩn thận vì script chậm treo cả server.

**Đào sâu:**

```
127.0.0.1:6379> EVAL "local n=tonumber(redis.call('GET',KEYS[1])) if n and n>0 then redis.call('DECR',KEYS[1]) return 1 else return 0 end" 1 ton-kho
(integer) 1
```

**Vì sao phải tách `KEYS` và `ARGV`:** Redis Cluster cần biết script đụng khoá nào để định tuyến. Nhét
tên khoá vào `ARGV` thì chạy được ở standalone nhưng **hỏng khi lên Cluster**.

Bẫy chuyển kiểu:

```
127.0.0.1:6379> EVAL "return 3.9" 0
(integer) 3                     ← CẮT, không làm tròn
```

`return {1, nil, 3}` chỉ trả về `1` (mảng dừng ở `nil` đầu tiên). Muốn trả số thực thì `tostring(3.9)`.

**Redis Functions** (Redis 7+) là bản thay thế `SCRIPT LOAD`: `FUNCTION LOAD` + `FCALL`, có tên đọc được
và **tồn tại qua restart** (được lưu vào RDB/AOF).

### E6 ⭐ Script Lua chạy quá lâu thì sao? Cứu thế nào?

**Ngắn:** Sau `busy-reply-threshold` (mặc định 5000ms), Redis trả `BUSY` cho mọi lệnh khác. Cứu bằng
`SCRIPT KILL` — **nhưng chỉ được nếu script chưa ghi gì**.

**Đào sâu:** Đo thật:

```
busy-reply-threshold = 5000 ms
A nhận: BUSY Redis is busy running a script. You can only call SCRIPT KILL or SHUTDOWN NOSAVE.
SCRIPT KILL -> OK
B nhận: ERR Script killed by user with SCRIPT KILL...
GET sau khi kill -> 1
```

Nếu script **đã ghi**:

```
127.0.0.1:6379> SCRIPT KILL
(error) UNKILLABLE Sorry the script already executed write commands against the dataset. You can either
wait the script termination or kill the server in a hard way using the SHUTDOWN NOSAVE command.
```

Lúc đó chỉ còn chờ hoặc `SHUTDOWN NOSAVE` (mất dữ liệu chưa lưu). **Phòng ngừa quan trọng hơn chữa:**
script phải ngắn, có giới hạn vòng lặp rõ ràng.

### E7 ⭐⭐ Khoá phân tán bằng Redis — làm đúng thế nào?

**Ngắn:** Lấy bằng `SET khoa <token-ngẫu-nhiên> NX EX 30`. Nhả bằng **Lua kiểm tra token**, không phải
`DEL`.

**Đào sâu:** Hai thứ bắt buộc:

1. **`EX`** — tiến trình bị `kill -9` thì khoá phải tự hết hạn, nếu không là deadlock vĩnh viễn.
2. **Token ngẫu nhiên**, không phải `"1"`.

Vì sao token quan trọng — kịch bản hỏng: A lấy khoá `EX 30`, xử lý mất 35 giây (GC pause, DB chậm). Giây
30 khoá hết hạn, B lấy được. Giây 35 A xong và gọi `DEL` — **xoá mất khoá của B**. Giờ B và C chạy song
song, đúng cái bạn định ngăn.

```
127.0.0.1:6379> SET khoa:x token-A EX 30
OK
127.0.0.1:6379> EVAL "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end" 1 khoa:x token-SAI
(integer) 0
127.0.0.1:6379> GET khoa:x
"token-A"                       ← không bị xoá nhầm
```

Phải là **Lua** chứ không phải `GET` rồi `DEL` trong app — giữa hai lệnh đó khoá vẫn có thể hết hạn.

### E8 ⭐ Khoá phân tán Redis có gì **không** an toàn?

**Ngắn:** Ba điều — khoá có thể hết hạn giữa lúc đang làm việc; nhân bản là bất đồng bộ nên failover có
thể làm mất khoá; và Redlock gây tranh cãi về tính đúng đắn.

**Đào sâu:**

**a)** Khoá hết hạn giữa chừng: giảm nhẹ bằng **watchdog** — `setInterval` gia hạn mỗi `TTL/3`, cũng
bằng Lua có kiểm tra token:
```lua
if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end
```

**b)** Master nhận khoá, chưa kịp đẩy xuống replica thì chết; Sentinel nâng replica lên; replica đó
**không có khoá** → hai tiến trình cùng giữ. Đây là lỗ hổng cấu trúc, không vá được ở tầng Redis.

**c)** Redlock (khoá trên N node độc lập): Martin Kleppmann chỉ ra nó không an toàn khi có GC pause hoặc
lệch đồng hồ; Salvatore Sanfilippo phản biện. Không cần đứng về phe nào — nói rõ giới hạn là đủ.

Câu chốt an toàn:

> "Khoá Redis phù hợp cho **tối ưu** — tránh làm trùng việc, giảm tải. Nếu việc trùng gây hỏng dữ liệu
> thật (trừ tiền hai lần), em không dựa vào khoá mà thêm **fencing token** hoặc ràng buộc unique ở
> database — tầng dưới cùng phải tự bảo vệ được."

---

## F — Pub/Sub, Stream, hàng đợi

### F1 ⭐⭐ Pub/Sub và Stream khác nhau thế nào?

**Ngắn:** Pub/Sub **không lưu** tin nhắn — không có ai nghe thì tin bốc hơi. Stream **lưu lại**, có ACK,
có consumer group, đọc lại được lịch sử.

**Đào sâu:** Bằng chứng cho Pub/Sub:

```
127.0.0.1:6379> PUBLISH tin-tuc "khong ai nghe"
(integer) 0                     ← 0 subscriber nhận được → tin MẤT vĩnh viễn
```

Bốn giới hạn của Pub/Sub: mất tin khi client offline (kể cả 1 giây); không có ACK; **mọi** subscriber
nhận bản sao nên không chia việc được; subscriber chậm bị ngắt kết nối khi đầy đệm
(`client-output-buffer-limit ... pubsub 33554432 8388608 60` — đầy 32 MB hoặc 8 MB liên tục 60 giây).

Pub/Sub chỉ nên dùng cho **thông báo mất cũng không sao**: xoá cache tầng ứng dụng trên nhiều pod, nạp
lại feature flag, đẩy tin chat tới người đang online (lịch sử vẫn lưu ở DB).

### F2 ⭐ Consumer group trong Stream hoạt động thế nào?

**Ngắn:** Nhiều worker cùng đọc một stream nhưng **chia nhau** tin nhắn (không trùng). Mỗi tin đã giao
nằm trong PEL (Pending Entries List) cho tới khi worker `XACK`.

**Đào sâu:**

```
127.0.0.1:6379> XREADGROUP GROUP nhom-xu-ly worker-1 COUNT 2 STREAMS don-hang >
   → nhận DH001, DH002
127.0.0.1:6379> XREADGROUP GROUP nhom-xu-ly worker-2 COUNT 2 STREAMS don-hang >
   → nhận DH003            ← KHÔNG trùng với worker-1

127.0.0.1:6379> XPENDING don-hang nhom-xu-ly
1) (integer) 3                  ← 3 tin đang chờ ACK
4) 1) 1) "worker-1"
      2) "2"
   2) 1) "worker-2"
      2) "1"
```

`>` = tin chưa ai nhận. `0` = lấy lại tin **chính worker này** đã nhận mà chưa ACK (dùng khi restart).

**Nếu worker chết trước khi `XACK`, tin vẫn nằm trong PEL — không mất.** Cứu bằng `XAUTOCLAIM`:

```
127.0.0.1:6379> XAUTOCLAIM don-hang nhom-xu-ly worker-3 1000 0
1) "0-0"
2) 1) 1) "1787873682401-1"  ...
```

`1000` = chỉ cướp tin đã nằm trong PEL quá 1000ms.

### F3 ⭐ Chọn List, Stream hay Pub/Sub cho hàng đợi?

**Ngắn:** List nếu đơn giản và chấp nhận mất việc; Stream nếu cần ACK và chạy lại; Pub/Sub **không phải**
hàng đợi.

**Đào sâu:**

| | Pub/Sub | List (`BRPOP`) | Stream |
|---|---|---|---|
| Lưu tin | ❌ | ✅ cho tới khi bị lấy | ✅ cho tới khi `XTRIM` |
| Đọc lại lịch sử | ❌ | ❌ | ✅ |
| Chia việc nhiều worker | ❌ | ✅ | ✅ |
| Nhiều nhóm độc lập | ✅ | ❌ | ✅ |
| ACK / cứu việc | ❌ | ❌ | ✅ |
| Biết còn tồn đọng | ❌ | ✅ `LLEN` | ✅ `lag` |

Nếu cần retry có backoff, việc hẹn giờ, ưu tiên, giao diện theo dõi → dùng **BullMQ** thay vì tự dựng.

### F4 Redis Stream có phải Kafka không?

**Ngắn:** Không. Stream không có phân vùng (partition), không lưu xuống đĩa theo kiểu log, không giữ dữ
liệu hàng tuần, và bị giới hạn bởi RAM.

**Đào sâu:** Câu trả lời tốt: "Nếu bài toán là đường ống dữ liệu 100k msg/s lưu 7 ngày cho nhiều hệ
thống tiêu thụ, đó là Kafka. Redis Stream hợp với **hàng đợi việc trong ứng dụng có ACK** — quy mô nhỏ
hơn nhiều nhưng dựng trong 10 phút và không phải vận hành thêm một cụm."

### F5 Stream có tự xoá không?

**Ngắn:** **Không.** Phải tự cắt bằng `XTRIM` hoặc `XADD ... MAXLEN`.

**Đào sâu:**

```js
await r.xadd('don-hang', 'MAXLEN', '~', 100000, '*', 'ma', 'DH001');
```

`~` cho phép Redis cắt xấp xỉ (tới ranh giới node nội bộ) — rẻ hơn nhiều so với cắt chính xác. Đo thật
với dữ liệu đều thì cả hai cùng ra đúng 1000, nhưng đừng viết code dựa vào `XLEN` bằng đúng một con số.

⚠️ `XTRIM` xoá tin **kể cả khi chưa ai ACK**. Đặt `MAXLEN` đủ lớn so với `lag` tối đa bạn chấp nhận.

Đây cũng là một trong ba nguyên nhân "Redis tự nhiên đầy" phổ biến nhất — hai cái còn lại là List không
`LTRIM` và BullMQ không `removeOnComplete`.

### F6 Keyspace notification là gì? Dùng làm scheduler được không?

**Ngắn:** Redis phát sự kiện qua Pub/Sub khi khoá thay đổi hoặc hết hạn. **Không** dùng làm scheduler
cho việc quan trọng được.

**Đào sâu:** Bật (mặc định tắt):

```
127.0.0.1:6379> CONFIG SET notify-keyspace-events "KEA"
OK
$ redis-cli PSUBSCRIBE "__key*@0__:*"
...
3) "__keyevent@0__:expired"
4) "thu:nghiem"
```

Ba lý do không dùng làm scheduler:
1. Sự kiện `expired` chỉ bắn khi khoá **thật sự bị xoá**, không phải khi hết hạn về mặt logic — độ trễ
   phụ thuộc vòng quét ngẫu nhiên.
2. Đây là **Pub/Sub** — client mất kết nối 3 giây thì mọi sự kiện trong 3 giây đó mất vĩnh viễn.
3. Sự kiện chỉ mang **tên khoá**, không mang giá trị. Khoá đã bị xoá nên không `GET` lại được.

Với "đơn hàng 15 phút không thanh toán thì huỷ", dùng **Sorted Set** với điểm là thời điểm đến hạn:
`ZRANGEBYSCORE viec 0 <now>` mỗi giây.

### F7 `BLPOP` khác `LPOP` thế nào? Có gì cần lưu ý trong Node?

**Ngắn:** `BLPOP` **nằm chờ** khi list rỗng thay vì trả `(nil)` ngay. Trong Node, nó **chiếm trọn một
kết nối** trong lúc chờ.

**Đào sâu:**

```
127.0.0.1:6379> INFO clients
blocked_clients:1               ← có worker đang chờ

127.0.0.1:6379> RPUSH viec "cong-viec-1"
(integer) 1
```
Worker nhả ra ngay:
```
1) "viec"                       ← tên khoá
2) "cong-viec-1"                ← giá trị
```

Trả mảng 2 phần tử vì `BLPOP` nhận nhiều khoá cùng lúc.

Trong Node: **dùng client riêng** cho việc chờ. Dùng chung với client cache thì mọi lệnh cache khác bị
xếp hàng sau nó.

---

## G — Bền dữ liệu

### G1 ⭐⭐ RDB và AOF khác nhau thế nào?

**Ngắn:** RDB là **ảnh chụp** toàn bộ dữ liệu theo chu kỳ — file nhỏ, khởi động nhanh, nhưng mất dữ liệu
giữa hai lần chụp. AOF ghi lại **mọi lệnh thay đổi** — mất ít hơn nhiều, file lớn hơn, khởi động chậm hơn.

**Đào sâu:**

| | RDB | AOF |
|---|---|---|
| Mất tối đa | Từ lần `BGSAVE` cuối | ~1 giây (`everysec`) |
| Kích thước | Nhỏ, nén tốt | Lớn hơn |
| Khởi động | Nhanh (nạp file nhị phân) | Chậm hơn (chạy lại lệnh) |
| Chi phí lúc chạy | `fork()` mỗi lần chụp | Ghi liên tục + rewrite định kỳ |
| Dùng để backup | ✅ Rất hợp | Kém tiện |

**Bật cả hai là được và thường là lựa chọn đúng.** Khi khởi động, có AOF thì Redis nạp từ AOF (đầy đủ
hơn); RDB dùng để backup và chuyển máy.

### G2 ⭐⭐ Redis chết đột ngột thì mất bao nhiêu dữ liệu?

**Ngắn:** Tuỳ cấu hình. Mặc định RDB + `kill -9` → **mất trắng**. AOF `everysec` → mất tối đa **1 giây**.

**Đào sâu:** Đo thật, ba thí nghiệm:

```
A) Mặc định + kill -9
   $ docker exec rdb-test redis-cli SET quan-trong "don hang 123"
   $ docker kill -s KILL rdb-test && docker start rdb-test
   $ docker exec rdb-test redis-cli GET quan-trong
   (nil)                        ← MẤT

B) Mặc định + docker stop (SIGTERM)
   $ docker exec rdb-test redis-cli GET quan-trong
   "don hang 456"               ← còn
   log: "Received SIGTERM scheduling shutdown... Saving the final RDB snapshot before exiting."

C) --appendonly yes + kill -9
   $ docker exec aof-test redis-cli GET quan-trong
   "don hang 789"               ← còn
```

Vì sao A mất: `CONFIG GET save` → `"3600 1 300 100 60 10000"`, nghĩa là lưu nếu 3600 giây có ≥1 thay
đổi, hoặc 300 giây có ≥100, hoặc 60 giây có ≥10000. Ghi một khoá rồi chết ngay thì chưa chạm điều kiện nào.

**Rút ra cho vận hành:** restart *có trật tự* thì an toàn; `kill -9` / OOM killer / mất điện thì không.
Trong Kubernetes, pod Redis bị `SIGKILL` vì vượt `terminationGracePeriodSeconds` sẽ rơi vào trường hợp A.

### G3 `appendfsync` có mấy mức?

**Ngắn:** `always` (mất ~0, chậm nhất), `everysec` (mặc định, mất tối đa 1 giây), `no` (nhanh nhất, tuỳ
hệ điều hành, có thể mất 30 giây).

**Đào sâu:** Ngay cả `always` cũng không bảo đảm tuyệt đối — đĩa có cache riêng, SSD tiêu dùng có thể
nói dối về việc đã ghi xong. Câu chốt: "Với yêu cầu bền vững thật sự, em dùng database chuyên dụng chứ
không dựa vào Redis."

### G4 `BGSAVE` hoạt động thế nào? Vì sao có thể ngốn gấp đôi RAM?

**Ngắn:** `BGSAVE` gọi `fork()`. Tiến trình con ghi ảnh chụp, cha tiếp tục phục vụ. Hệ điều hành dùng
**copy-on-write** — chỉ trang nhớ bị **ghi** mới được sao chép. Tải ghi cao thì RAM có thể tăng gần gấp đôi.

**Đào sâu:**

```
127.0.0.1:6379> INFO persistence
rdb_last_cow_size:475136        ← RAM phát sinh do copy-on-write
rdb_last_bgsave_status:ok       ← "err" là báo động đỏ
rdb_bgsave_in_progress:0
```

Trên Linux cần `vm.overcommit_memory=1`, nếu không `fork()` có thể **thất bại** và `BGSAVE` không chạy được.

`SAVE` (không `BG`) chạy **trong luồng chính** — treo toàn bộ server. Đừng bao giờ gõ.

### G5 ⭐ `MISCONF ... not able to persist on disk` — nguyên nhân và cách xử lý?

**Ngắn:** `BGSAVE` thất bại (99% là **đầy đĩa**) và `stop-writes-on-bgsave-error yes` (mặc định) → Redis
từ chối **mọi lệnh ghi**, đọc vẫn được.

**Đào sâu:** Đây là sự cố production kinh điển: đĩa đầy → Redis không lưu được → app không ghi được gì →
sập, dù Redis vẫn sống và vẫn đọc bình thường.

Xử lý ngay: dọn đĩa. Tạm thời: `CONFIG SET stop-writes-on-bgsave-error no` — nhưng lúc đó bạn đang
**cố ý chấp nhận mất dữ liệu**, phải nói rõ điều đó khi trả lời.

Gắn alert cho `rdb_last_bgsave_status` và `aof_last_write_status` trong `INFO persistence`.

Bổ sung ăn điểm: từ Redis 7, AOF không còn là một file mà là **thư mục** `appendonlydir/` gồm
`*.base.rdb` + `*.incr.aof` + `*.manifest`. Script backup nào copy đúng `appendonly.aof` sẽ copy trượt.

---

## H — Nhân bản, Sentinel, Cluster

### H1 ⭐⭐ Nhân bản Redis là đồng bộ hay bất đồng bộ? Hệ quả là gì?

**Ngắn:** **Bất đồng bộ.** Master trả `OK` cho client **trước khi** replica nhận được. Master chết ngay
lúc đó → dữ liệu mất, kể cả khi có 3 replica.

**Đào sâu:** `WAIT` cho biết đã có bao nhiêu replica xác nhận:

```
127.0.0.1:6379> SET k1 v1
OK
127.0.0.1:6379> WAIT 1 100
(integer) 1
127.0.0.1:6379> WAIT 2 100
(integer) 1                     ← yêu cầu 2, chỉ có 1; hết 100ms thì trả con số thật
```

**`WAIT` không làm việc ghi trở thành đồng bộ** — nó chỉ *báo cáo* sau khi ghi xong. App phải tự xử lý
khi số trả về nhỏ hơn yêu cầu.

Muốn chặn ghi khi không đủ replica:

```
min-replicas-to-write 1
min-replicas-max-lag 10
```

Master từ chối ghi nếu không có ít nhất 1 replica với lag ≤ 10 giây. Đổi tính sẵn sàng lấy an toàn.

### H2 ⭐ Full sync và partial resync khác gì? `repl-backlog-size` quan trọng thế nào?

**Ngắn:** Full sync gửi cả dataset (master phải `fork`). Partial resync chỉ gửi phần thiếu, dùng được khi
khoảng trống vẫn còn trong `repl_backlog`.

**Đào sâu:**

```
127.0.0.1:6379> CONFIG GET repl-backlog-size
2) "1048576"                    ← chỉ 1 MB
```

Trên hệ thống ghi nhiều, 1 MB trôi qua trong chưa tới một giây → **mọi lần mạng chớp đều thành full
sync**, tức master `fork` liên tục. Tăng lên 64–256 MB là chỉnh sửa production đầu tiên nên làm.

Log replica cho biết đang ở chế độ nào:

```
* Partial resynchronization not possible (no cached master)
* PSYNC is not possible, initialize RDB channel.
* MASTER <-> REPLICA sync: receiving streamed RDB from master with EOF to disk
```

### H3 Replica có ghi được không? `READONLY` là lỗi gì?

**Ngắn:** Không. Mặc định `replica-read-only yes`.

```
127.0.0.1:6379> SET tin "sua tu replica"
(error) READONLY You can't write against a read only replica.
```

**Đào sâu:** Đừng đổi cấu hình này — dữ liệu ghi vào replica chỉ tồn tại ở đó và bị xoá sạch ở lần full
sync tiếp theo.

Trong production, lỗi `READONLY` xuất hiện thường nhất **sau một lần failover**: IP mà app hardcode giờ
là replica. Đó là lý do phải dùng Sentinel để tìm master.

### H4 ⭐⭐ Sentinel làm gì? Failover diễn ra thế nào?

**Ngắn:** Sentinel là tiến trình riêng giám sát master; khi đủ quorum Sentinel đồng ý master chết, chúng
bầu ra một Sentinel cầm trịch, chọn replica tốt nhất và nâng nó lên master.

**Đào sâu:** Đo thật với 1 master + 2 replica + 3 Sentinel, `kill -9` master:

```
00:32:34.052 # +sdown master mymaster        ← một Sentinel thấy master không trả lời
00:32:34.110 # +odown master ... #quorum 2/2 ← đủ quorum đồng ý
00:32:34.110 # +try-failover
00:32:34.117 # +vote-for-leader 944673b5...
00:32:34.179 # +elected-leader
00:32:34.279 # +selected-slave slave 172.19.0.4:6379
00:32:35.205 # +promoted-slave                ← gửi REPLICAOF NO ONE
00:32:36.220 * +slave-reconf-done             ← trỏ replica còn lại về master mới
00:32:36.325 # +switch-master 172.19.0.2 → 172.19.0.4
```

**Tổng 2.3 giây** kể từ khi phát hiện; với `down-after-milliseconds 3000` thì từ lúc master chết là
~5.3 giây. Trong khoảng đó, mọi lệnh **ghi** thất bại — client phải retry.

Xác nhận:
```
$ redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
1) "172.19.0.4"
2) "6379"
```

Ba điều bắt buộc: **số lẻ Sentinel, tối thiểu 3**; đặt trên **3 máy khác nhau**; và client phải **hỏi
Sentinel** chứ không hardcode IP.

### H5 Split-brain trong Sentinel là gì?

**Ngắn:** Master cũ bị cô lập mạng nhưng vẫn sống → tiếp tục nhận ghi từ client cùng phía mạng. Khi mạng
thông trở lại, nó bị hạ xuống replica và **mọi ghi trong lúc đó bị xoá**.

**Đào sâu:** Giảm nhẹ bằng `min-replicas-to-write 1` + `min-replicas-max-lag 10`: master bị cô lập sẽ mất
replica → tự từ chối ghi → cửa sổ mất dữ liệu bị giới hạn ở `max-lag`.

### H6 ⭐⭐ Redis Cluster chia dữ liệu thế nào?

**Ngắn:** 16384 **hash slot**. Mỗi khoá thuộc slot `CRC16(key) mod 16384`; mỗi node phụ trách một dải slot.

**Đào sâu:**

```
127.0.0.1:6379> CLUSTER KEYSLOT user:1
(integer) 10778
127.0.0.1:6379> CLUSTER KEYSLOT user:2
(integer) 6777                  ← hai khoá gần giống nhau, HAI node khác nhau
```

Client nối sai node nhận `MOVED` (không phải lỗi, là chỉ đường):

```
127.0.0.1:6379> SET user:1 "an"
(error) MOVED 10778 172.19.0.3:6379
```

`redis-cli -c` tự đi theo; thư viện Node tự dựng bản đồ slot → node nếu bạn khởi tạo ở chế độ cluster
(`new Redis.Cluster([...])`).

### H7 ⭐⭐ `CROSSSLOT` là gì? Xử lý thế nào?

**Ngắn:** Mọi lệnh nhiều khoá đều hỏng nếu các khoá không cùng slot. Sửa bằng **hash tag** `{...}`.

**Đào sâu:**

```
127.0.0.1:6379> MGET user:1 user:2
(error) CROSSSLOT Keys in request don't hash to the same slot
127.0.0.1:6379> EVAL "return redis.call('MGET',KEYS[1],KEYS[2])" 2 user:1 user:2
(error) CROSSSLOT Keys in request don't hash to the same slot
```

Ảnh hưởng: `MGET`, `MSET`, `SINTER`, `ZUNIONSTORE`, `RENAME`, `MULTI` nhiều khoá, và **Lua script**.

Hash tag — Redis chỉ băm phần trong ngoặc:

```
127.0.0.1:6379> CLUSTER KEYSLOT "{user:1}:ten"
(integer) 10778
127.0.0.1:6379> CLUSTER KEYSLOT "{user:1}:tuoi"
(integer) 10778
127.0.0.1:6379> MSET "{user:1}:ten" an "{user:1}:tuoi" 28
OK
```

⚠️ Dùng quá tay tạo **hot slot**: đặt `{app}` cho mọi khoá thì toàn bộ dữ liệu về một node và bạn mất
hết lợi ích của Cluster.

Cluster còn mất: `SELECT` (chỉ có `db0`), Pub/Sub thường phát tán tới mọi node (dùng
`SPUBLISH`/`SSUBSCRIBE`), `KEYS`/`SCAN` chỉ trả khoá của node đang nối.

### H8 Một node trong Cluster chết thì sao?

**Ngắn:** Nếu node đó có replica, replica được nâng lên tự động. Nếu không, `cluster_state:fail` và với
`cluster-require-full-coverage yes` (mặc định) thì **cả cluster ngừng phục vụ**.

**Đào sâu:** Đo thật với cluster 3 master không replica, `kill -9` một node:

```
127.0.0.1:6379> CLUSTER INFO
cluster_state:fail
cluster_slots_assigned:16384
cluster_slots_ok:10923          ← chỉ còn 2/3 số slot

$ redis-cli -c GET k1
(error) CLUSTERDOWN The cluster is down
```

Đổi `cluster-require-full-coverage no` trên các node còn lại:

```
cluster_state:ok
$ redis-cli -c GET k1
Could not connect to Redis at 172.19.0.4:6379: Host is unreachable
```

Cluster chạy lại, nhưng khoá trên node chết vẫn không lấy được. **Kết luận: mọi master trong Cluster đều
cần replica** — tối thiểu 3 master + 3 replica = 6 node.

### H9 ⭐ Khi nào **nên** và **không nên** dùng Cluster?

**Ngắn:** Dùng khi dữ liệu lớn hơn RAM một máy, hoặc lượng ghi vượt sức một node. Không dùng khi chưa cần.

**Đào sâu:** Cluster thêm rất nhiều ràng buộc lên code: `CROSSSLOT`, hash tag, không `SELECT`, Lua phải
khai `KEYS` đúng, Pub/Sub phải đổi sang bản `S*`. Trong khi đó một node Redis xử lý ~178.000 lệnh/giây
không pipeline và hơn 2 triệu khi có pipeline — phần lớn ứng dụng không bao giờ chạm trần đó.

Bảng chọn:

| Tình huống | Kiến trúc |
|---|---|
| Cache, mất được, vừa RAM | Một node, không persistence |
| Cần đọc nhiều, chấp nhận sửa tay khi hỏng | Master + replica |
| Cần tự phục hồi | Sentinel (3 sentinel, 1 master, 2 replica) |
| Dữ liệu > RAM một máy | Cluster (≥3 master + 3 replica) |
| Muốn đỡ vận hành | Dịch vụ quản lý (ElastiCache, Memorystore, Redis Cloud) |

---

## Tự chấm

- Trả lời trôi chảy **≥ 55/70**, và nói được **con số đo thật** cho ít nhất 10 câu → sẵn sàng cho mức
  Middle.
- Dưới 40 → quay lại giáo trình, đặc biệt [bài 04 (cache)](../04-cache-pattern.md) và
  [bài 09 (bộ nhớ)](../09-bo-nho-va-eviction.md).

Tiếp theo: [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md)
