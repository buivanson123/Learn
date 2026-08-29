# Học Redis (dành cho backend developer)

Redis là một **kho dữ liệu trong RAM**. Nó không thay thế PostgreSQL — nó ngồi cạnh, giữ những thứ
được đọc nhiều mà tính lại thì tốn: kết quả query, session, đếm lượt xem, hàng đợi việc, khoá phân tán,
bảng xếp hạng.

Điểm khiến Redis khác mọi cache khác: **nó có kiểu dữ liệu**. Bạn không chỉ `GET`/`SET` chuỗi — bạn có
danh sách, tập hợp, tập hợp có thứ tự, stream, bitmap. Một bảng xếp hạng 10 triệu người chơi trong Redis
là **một lệnh** `ZREVRANGE`, không phải một câu `ORDER BY ... LIMIT` quét bảng.

Tài liệu này viết cho **Redis 8.10.0**. Mọi lệnh, output, con số dưới đây đều **chạy thật** trong
container `redis:8-alpine` trước khi viết ra — kể cả các thông báo lỗi.

---

## ⚠️ Đọc trước: Redis 8 khác blog cũ ở những chỗ này

Đây là các con số bạn sẽ thấy trên hầu hết bài viết tiếng Việt về Redis, và kết quả đo thật trên
Redis 8.10.0:

| Điều blog cũ nói | Đo thật trên Redis 8.10.0 |
|---|---|
| Chuỗi ≤ 44 byte thì `embstr` | Phụ thuộc **độ dài khoá + độ dài giá trị ≤ 41** ([bài 01](./01-string-va-key.md)) |
| Hash chuyển sang `hashtable` khi > **128** trường | Ngưỡng mặc định là **512** (`hash-max-listpack-entries`) |
| Hash/list nhỏ dùng `ziplist` | Không còn `ziplist` — tên bây giờ là **`listpack`** |
| AOF là một file `appendonly.aof` | Là **một thư mục** `appendonlydir/` với 3 file (base + incr + manifest) |
| Lua script không gọi được lệnh ngẫu nhiên (`TIME`, `SPOP`) | Gọi được — replication là "theo hiệu ứng" chứ không phải chép lệnh |

Gõ `OBJECT ENCODING`, `CONFIG GET`, `INFO` để tự kiểm tra trước khi tin bất kỳ con số nào.

---

## Lộ trình 7 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-cai-dat-va-redis-cli.md](./00-cai-dat-va-redis-cli.md) | Dựng Redis, `redis-cli`, đọc `INFO` | 2h |
| 1 | [01-string-va-key.md](./01-string-va-key.md) | String, `INCR`, `SET NX`, đặt tên khoá, encoding | 3h |
| 2 | [02-list-hash-set-zset.md](./02-list-hash-set-zset.md) | 4 kiểu còn lại + **chọn kiểu nào cho bài toán nào** | 4h |
| 2 | [03-ttl-va-het-han.md](./03-ttl-va-het-han.md) | TTL, `EXPIRE` với `NX/XX/GT/LT`, cơ chế xoá khoá hết hạn | 2h |
| 3 | [04-cache-pattern.md](./04-cache-pattern.md) | **Cache-aside, invalidation, giẫm đạp, xuyên cache** | 4h |
| 4 | [05-transaction-va-lua.md](./05-transaction-va-lua.md) | `MULTI`, `WATCH`, Lua, khoá phân tán | 4h |
| 4 | [06-pubsub-va-stream.md](./06-pubsub-va-stream.md) | Pub/Sub vs Stream, consumer group, hàng đợi việc | 3h |
| 5 | [07-persistence.md](./07-persistence.md) | RDB vs AOF — **mất dữ liệu bao nhiêu khi server chết** | 3h |
| 5 | [08-nhan-ban-sentinel-cluster.md](./08-nhan-ban-sentinel-cluster.md) | Replica, Sentinel, Cluster, hash slot, `CROSSSLOT` | 4h |
| 6 | [09-bo-nho-va-eviction.md](./09-bo-nho-va-eviction.md) | `maxmemory`, 8 chính sách eviction, khoá bự | 3h |
| 6 | [10-thuc-chien-nodejs.md](./10-thuc-chien-nodejs.md) | `ioredis` / `node-redis`, pipeline, rate limit, NestJS | 4h |
| 7 | [11-van-hanh-va-do-luong.md](./11-van-hanh-va-do-luong.md) | `SLOWLOG`, `--latency`, `--bigkeys`, ACL, backup | 3h |
| — | [12-loi-thuong-gap.md](./12-loi-thuong-gap.md) | 25 lỗi kèm thông báo lỗi thật | — |
| — | [13-cheatsheet.md](./13-cheatsheet.md) | Tra cứu nhanh | — |

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 70 câu hỏi kèm đáp án hai tầng, 20 bài tập gõ tay,
10 tình huống sự cố, checklist tự chấm.

---

## Bốn điều làm nên Redis (và bốn giới hạn đi kèm)

### 1. Dữ liệu nằm trong RAM → nhanh, nhưng có hạn

Đo thật trên máy này (container `redis:8-alpine`, `redis-benchmark`):

```
$ redis-benchmark -n 100000 -t set,get -q
SET: 178253.12 requests per second, p50=0.135 msec
GET: 164473.69 requests per second, p50=0.143 msec
```

p50 = 0.135 mili giây. Một query PostgreSQL có index nhanh nhất cũng ở mức mili giây.

Giới hạn đi kèm: RAM đắt và hữu hạn. 3 triệu trường trong **một** hash đã tốn 155 MB:

```
127.0.0.1:6379> HLEN khoa-bu
(integer) 3000000
127.0.0.1:6379> MEMORY USAGE khoa-bu SAMPLES 0
(integer) 162109522        ← 155 MB cho MỘT khoá
```

### 2. Redis chạy **một luồng** → không có race condition trong một lệnh

Mọi lệnh được xếp hàng và chạy lần lượt. `INCR` không bao giờ mất số đếm, dù 1000 client cùng gọi.

Giới hạn đi kèm: **một lệnh chậm làm treo toàn bộ server**. Đo thật — hai kết nối tới cùng một Redis,
kết nối B chạy một script Lua nặng, kết nối A chỉ gõ `GET`:

```
GET lúc server rảnh:              1ms
GET lúc một script Lua đang chạy: 1431ms
```

Đây là lý do gốc của gần như mọi sự cố Redis trong production: `KEYS *`, `DEL` một khoá bự,
`SMEMBERS` một set triệu phần tử, script Lua vòng lặp lớn.

### 3. Có kiểu dữ liệu → nhiều bài toán rút xuống còn một lệnh

Bảng xếp hạng, cộng điểm rồi lấy top 3:

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
```

`ZINCRBY` **vừa cộng điểm vừa sắp xếp lại** — độ phức tạp O(log N), không phụ thuộc số người chơi.

### 4. Bền dữ liệu là **tuỳ chọn**, và mặc định là "có thể mất"

Đo thật: bật container `redis:8-alpine` mặc định, ghi một khoá, rồi `kill -9`:

```
$ docker exec rdb-test redis-cli SET quan-trong "don hang 123"
$ docker exec rdb-test redis-cli DBSIZE
1

$ docker kill -s KILL rdb-test && docker start rdb-test

$ docker exec rdb-test redis-cli GET quan-trong
(nil)                      ← mất trắng
$ docker exec rdb-test redis-cli DBSIZE
0
```

Chi tiết và cách chọn cấu hình ở [bài 07](./07-persistence.md). Nguyên tắc: **đừng dùng Redis làm nơi
lưu duy nhất của dữ liệu bạn không thể mất.**

---

## Dựng môi trường học trong 1 phút

```bash
$ docker run -d --name redis-lab -p 6379:6379 redis:8-alpine
$ docker exec -it redis-lab redis-cli
127.0.0.1:6379> PING
PONG
```

Bản thật đang chạy:

```
127.0.0.1:6379> INFO server
redis_version:8.10.0
redis_mode:standalone
os:Linux 7.0.12-linuxkit aarch64
multiplexing_api:epoll
process_id:1
```

Từ đây trở đi, mọi khối bắt đầu bằng `127.0.0.1:6379>` là bạn gõ trong `redis-cli`, còn `$` là gõ trong
terminal của máy bạn.

---

## Cách học hiệu quả nhất

1. **Mở một cửa sổ `redis-cli` suốt buổi học.** Redis là công cụ mà gõ 5 giây là biết ngay đúng sai.
2. **Gõ `OBJECT ENCODING` và `MEMORY USAGE` thường xuyên.** Hai lệnh này cho bạn thấy Redis *thật sự*
   lưu dữ liệu ra sao, thay vì đoán.
3. **Đọc [bài 04](./04-cache-pattern.md) kỹ nhất.** Phần lớn công việc thật với Redis là cache, và phần
   lớn bug là ở chỗ *xoá cache*, không phải ở chỗ *ghi cache*.
4. **Làm [bài 10](./10-thuc-chien-nodejs.md) song song.** Học lệnh xong thì viết ngay code Node gọi nó.
5. **Đừng bỏ qua [bài 12](./12-loi-thuong-gap.md).** 25 lỗi trong đó là những gì bạn sẽ gặp trong tuần
   đầu tiên dùng Redis thật.

---

Liên quan: [Docker](../docker/README.md) · [NestJS](../nestjs/README.md) · [Linux](../linux/README.md) · [Laravel](../laravel/README.md)
