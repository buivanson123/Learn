# Bài 02 — List, Hash, Set, Sorted Set

Bốn kiểu này là lý do người ta chọn Redis thay vì Memcached. Bài này trả lời hai câu: **mỗi kiểu làm
được gì**, và **bài toán nào thì chọn kiểu nào**.

---

## Bảng chọn kiểu — đọc cái này trước

| Bài toán | Kiểu | Lệnh chính | Vì sao |
|---|---|---|---|
| Cache một object (user, sản phẩm) | **Hash** | `HSET` / `HGETALL` | Sửa được một trường, không phải ghi lại cả JSON |
| Cache một JSON đã render sẵn | **String** | `SET` / `GET` | Không cần đọc từng trường |
| Hàng đợi việc (FIFO) | **List** | `LPUSH` / `BRPOP` | Có lệnh chờ (blocking), không phải polling |
| Hàng đợi cần chống mất việc | **Stream** | `XADD` / `XREADGROUP` | Có ACK, có replay — [bài 06](./06-pubsub-va-stream.md) |
| Tag, danh sách bạn bè, "đã xem" | **Set** | `SADD` / `SISMEMBER` | Chống trùng sẵn, giao/hợp/hiệu O(N) |
| Bảng xếp hạng, top N | **Sorted Set** | `ZADD` / `ZREVRANGE` | Cộng điểm và sắp xếp trong một lệnh |
| Rate limit cửa sổ trượt | **Sorted Set** | `ZADD` / `ZREMRANGEBYSCORE` | Điểm = timestamp — [bài 10](./10-thuc-chien-nodejs.md) |
| Việc hẹn giờ (delayed job) | **Sorted Set** | `ZADD` điểm = thời điểm chạy | `ZRANGEBYSCORE 0 now` lấy việc đến hạn |
| Điểm danh / cờ nhị phân theo user id | **Bitmap** | `SETBIT` / `BITCOUNT` | 1 bit / user — [mục 6](#6-bitmap-hyperloglog-geo) |
| Đếm UV gần đúng | **HyperLogLog** | `PFADD` / `PFCOUNT` | 14 KB cho hàng triệu phần tử |
| Tìm quán gần đây | **Geo** | `GEOADD` / `GEOSEARCH` | Thật ra là Sorted Set |

---

## 1. List — dãy có thứ tự, thêm/bớt hai đầu

```
127.0.0.1:6379> RPUSH queue:job a b c
(integer) 3
127.0.0.1:6379> LPUSH queue:job zero
(integer) 4
127.0.0.1:6379> LRANGE queue:job 0 -1
1) "zero"
2) "a"
3) "b"
4) "c"
127.0.0.1:6379> LPOP queue:job
"zero"
127.0.0.1:6379> RPOP queue:job
"c"
127.0.0.1:6379> LINDEX queue:job 0
"a"
127.0.0.1:6379> LLEN queue:job
(integer) 2
```

`LRANGE key 0 -1` là "lấy hết" — `-1` nghĩa là phần tử cuối.

**Khoá tự biến mất khi rỗng:**

```
127.0.0.1:6379> LPOP queue:job
"a"
127.0.0.1:6379> LPOP queue:job
"b"
127.0.0.1:6379> LPOP queue:job
(nil)
127.0.0.1:6379> EXISTS queue:job
(integer) 0                     ← list rỗng = khoá bị xoá
```

Điều này đúng với **mọi** kiểu tập hợp trong Redis. Hệ quả: `EXISTS` không phải cách kiểm tra "hàng đợi
này đã từng tồn tại chưa".

### `LTRIM` — cắt danh sách, giữ độ dài cố định

```
127.0.0.1:6379> RPUSH big a b c d e
(integer) 5
127.0.0.1:6379> LTRIM big 0 2
OK
127.0.0.1:6379> LRANGE big 0 -1
1) "a"
2) "b"
3) "c"
```

Mẫu dùng thật: giữ 100 hoạt động gần nhất của user.

```js
await r.lpush(`hoat-dong:${userId}`, JSON.stringify(su_kien));
await r.ltrim(`hoat-dong:${userId}`, 0, 99);   // luôn giữ đúng 100
```

Không có `LTRIM` thì list này lớn vô hạn — một trong những nguyên nhân "khoá bự" phổ biến nhất.

### Hàng đợi có chặn: `BLPOP`

`LPOP` trên list rỗng trả `(nil)` ngay. `BLPOP` thì **nằm chờ**:

```bash
# Terminal 1 — worker
$ redis-cli BLPOP viec 0            # 0 = chờ vô hạn
                                     (treo ở đây)
```

```
# Terminal 2
127.0.0.1:6379> INFO clients
blocked_clients:1                   ← worker đang bị chặn

127.0.0.1:6379> RPUSH viec "cong-viec-1"
(integer) 1
```

```bash
# Terminal 1 nhả ra ngay:
1) "viec"                            ← tên khoá
2) "cong-viec-1"                     ← giá trị
```

Trả về **mảng 2 phần tử** vì `BLPOP` nhận nhiều khoá cùng lúc, nên phải nói rõ lấy từ khoá nào. Có
timeout thì hết giờ trả `(nil)`:

```
127.0.0.1:6379> BLPOP viec 1
(nil)
```

⚠️ **`BLPOP` chiếm trọn một kết nối** trong lúc chờ. Trong Node, phải dùng một client riêng cho việc
chờ — nếu dùng chung client với phần cache thì mọi lệnh cache khác bị xếp hàng sau nó.

### Chuyển việc an toàn: `LMOVE` / `BLMOVE`

```
127.0.0.1:6379> RPUSH src a b c
(integer) 3
127.0.0.1:6379> LMOVE src dst LEFT RIGHT
"a"
127.0.0.1:6379> LRANGE src 0 -1
1) "b"
2) "c"
127.0.0.1:6379> LRANGE dst 0 -1
1) "a"
```

Vì sao quan trọng: với `BRPOP` thuần, nếu worker lấy việc xong rồi **chết** trước khi xử lý, việc mất
luôn. `BLMOVE queue:cho queue:dang-lam RIGHT LEFT` chuyển việc sang danh sách "đang làm" **nguyên tử** —
worker khác có thể quét `queue:dang-lam` để cứu việc bị treo. Đây là mẫu "reliable queue".

Lệnh mới hơn, lấy nhiều khoá một lần:

```
127.0.0.1:6379> LMPOP 2 khong-co src LEFT COUNT 2
1) "src"
2) 1) "b"
   2) "c"
```

`LREM` xoá theo giá trị:

```
127.0.0.1:6379> RPUSH big a b c d e
(integer) 5
127.0.0.1:6379> LREM big 1 c
(integer) 1
127.0.0.1:6379> LRANGE big 0 -1
1) "a"
2) "b"
3) "d"
4) "e"
```

### Bẫy hiệu năng của List

| Lệnh | Độ phức tạp | Ghi chú |
|---|---|---|
| `LPUSH` / `RPUSH` / `LPOP` / `RPOP` | O(1) | Luôn rẻ |
| `LINDEX` / `LSET` | **O(N)** | Truy cập giữa list phải duyệt |
| `LRANGE 0 -1` | **O(N)** | Trên list 200k phần tử là treo server |
| `LREM` | **O(N)** | |

List **không phải mảng**. Nếu bạn thấy mình gọi `LINDEX` trong vòng lặp, bạn đang dùng sai kiểu.

---

## 2. Hash — object trong Redis

```
127.0.0.1:6379> HSET user:1 name "Vanson" age 28 city "Ha Noi"
(integer) 3
127.0.0.1:6379> HGET user:1 name
"Vanson"
127.0.0.1:6379> HGETALL user:1
1) "name"
2) "Vanson"
3) "age"
4) "28"
5) "city"
6) "Ha Noi"
127.0.0.1:6379> HMGET user:1 name age khong-co
1) "Vanson"
2) "28"
3) (nil)
127.0.0.1:6379> HINCRBY user:1 age 1
(integer) 29
127.0.0.1:6379> HDEL user:1 city
(integer) 1
127.0.0.1:6379> HKEYS user:1
1) "name"
2) "age"
127.0.0.1:6379> HLEN user:1
(integer) 2
127.0.0.1:6379> HEXISTS user:1 city
(integer) 0
```

`HGETALL` trả về mảng phẳng xen kẽ `trường, giá trị, trường, giá trị`. Client Node tự gộp thành object:

```js
await r.hgetall('user:1')
// { name: 'Vanson', age: '28' }      ← để ý: '28' là CHUỖI
```

### Vì sao dùng Hash thay vì string JSON

Với string JSON, tăng tuổi lên 1 cần: `GET` → `JSON.parse` → sửa → `JSON.stringify` → `SET`. Bốn bước,
hai vòng mạng, và **có race condition** nếu hai request cùng làm.

Với Hash: `HINCRBY user:1 age 1`. Một lệnh, nguyên tử.

Và tiết kiệm bộ nhớ hơn nhiều khoá string rời. Đo thật với 1000 người dùng × 3 trường:

```
3000 khoá string   : used_memory 3117392
1000 hash 3 trường : used_memory 3020504    ← ít hơn 96888 byte
```

Một hash 3 trường tốn `MEMORY USAGE` = **55 byte**, còn 3 khoá string riêng tốn ~96 byte chỉ riêng header.

### TTL cho **từng trường** (Redis 7.4+)

Trước đây TTL chỉ đặt được cho cả khoá. Bây giờ:

```
127.0.0.1:6379> HSET h f1 v1 f2 v2
(integer) 2
127.0.0.1:6379> HEXPIRE h 60 FIELDS 1 f1
1) (integer) 1
127.0.0.1:6379> HTTL h FIELDS 2 f1 f2
1) (integer) 60
2) (integer) -1                 ← f2 không có hạn
127.0.0.1:6379> HPERSIST h FIELDS 1 f1
1) (integer) 1
127.0.0.1:6379> HTTL h FIELDS 1 f1
1) (integer) -1
```

Cú pháp lạ (`FIELDS <số lượng> <danh sách>`) nhưng đây là tính năng rất đáng dùng: một hash
`session:abc` với `csrf-token` hết hạn 5 phút còn `user-id` sống theo session.

### Bẫy của Hash

`HGETALL` trên hash 100.000 trường là **O(N)** và trả về 200.000 phần tử qua mạng trong một lần. Dùng
`HSCAN` hoặc `HMGET` chỉ những trường cần.

---

## 3. Set — tập hợp không trùng, không thứ tự

```
127.0.0.1:6379> SADD tags:post:1 redis nodejs redis backend
(integer) 3                     ← thêm 4, chỉ 3 được nhận: "redis" trùng
127.0.0.1:6379> SMEMBERS tags:post:1
1) "redis"
2) "nodejs"
3) "backend"
127.0.0.1:6379> SISMEMBER tags:post:1 redis
(integer) 1
127.0.0.1:6379> SCARD tags:post:1
(integer) 3
127.0.0.1:6379> SMISMEMBER tags:post:1 redis khong-co
1) (integer) 1
2) (integer) 0
```

`SADD` trả về **số phần tử thật sự được thêm**, không phải số phần tử truyền vào. Dùng con số này để
biết "user này đã like bài viết chưa": `SADD like:post:1 user:99` trả `1` là lần đầu, `0` là đã like.

### Phép toán tập hợp — chỗ Set ăn đứt SQL

```
127.0.0.1:6379> SADD tags:post:2 redis python
(integer) 2
127.0.0.1:6379> SINTER tags:post:1 tags:post:2
1) "redis"                      ← giao
127.0.0.1:6379> SUNION tags:post:1 tags:post:2
1) "python"
2) "backend"
3) "nodejs"
4) "redis"                      ← hợp
127.0.0.1:6379> SDIFF tags:post:1 tags:post:2
1) "backend"
2) "nodejs"                     ← hiệu (có ở 1, không có ở 2)
```

Ứng dụng: "bạn chung của A và B" = `SINTER ban:A ban:B`. Một lệnh, thay cho một câu JOIN.

`SINTERCARD` chỉ đếm mà không trả dữ liệu — rẻ hơn nhiều khi tập giao lớn:

```
127.0.0.1:6379> SINTERCARD 2 s1 s2
(integer) 2
127.0.0.1:6379> SINTERCARD 2 s1 s2 LIMIT 1
(integer) 1                     ← dừng đếm khi đủ 1, dùng để hỏi "có giao nhau không"
```

### Bẫy của Set

`SMEMBERS` là **O(N)**. Trên set 1 triệu phần tử nó vừa treo server vừa đẩy 1 triệu chuỗi về client.
Nếu chỉ cần kiểm tra thành viên, dùng `SISMEMBER` (O(1)). Nếu cần duyệt hết, dùng `SSCAN`.

`SPOP` lấy ngẫu nhiên **và xoá**; `SRANDMEMBER` lấy ngẫu nhiên **và giữ lại**:

```
127.0.0.1:6379> SRANDMEMBER tags:post:1 2
1) "redis"
2) "backend"
127.0.0.1:6379> SPOP tags:post:2
"python"
```

---

## 4. Sorted Set — kiểu mạnh nhất của Redis

Mỗi phần tử có một **điểm** (số thực). Redis giữ chúng luôn sắp xếp theo điểm.

```
127.0.0.1:6379> ZADD board 100 an 250 binh 175 cuong
(integer) 3
127.0.0.1:6379> ZRANGE board 0 -1 WITHSCORES
1) "an"
2) "100"
3) "cuong"
4) "175"
5) "binh"
6) "250"                        ← tăng dần theo điểm
127.0.0.1:6379> ZREVRANGE board 0 2 WITHSCORES
1) "binh"
2) "250"
3) "cuong"
4) "175"
5) "an"
6) "100"                        ← top 3, giảm dần
```

Cộng điểm và sắp xếp lại **trong một lệnh**:

```
127.0.0.1:6379> ZINCRBY board 50 an
"150"
127.0.0.1:6379> ZSCORE board an
"150"
127.0.0.1:6379> ZRANK board binh
(integer) 2                     ← hạng tính từ 0, theo thứ tự TĂNG
127.0.0.1:6379> ZREVRANK board binh
(integer) 0                     ← hạng 1 khi tính giảm dần
```

`ZINCRBY` là O(log N). Bảng xếp hạng 10 triệu người chơi vẫn trả lời `ZREVRANGE board 0 9` trong micro
giây. Làm việc này bằng SQL cần `ORDER BY score DESC LIMIT 10` trên bảng 10 triệu dòng, mỗi lần cập nhật
điểm lại phải cập nhật index.

Lọc theo khoảng điểm:

```
127.0.0.1:6379> ZCOUNT board 150 300
(integer) 3
127.0.0.1:6379> ZRANGEBYSCORE board 150 300 WITHSCORES
1) "an"
2) "150"
3) "cuong"
4) "175"
5) "binh"
6) "250"
```

`ZADD` có các cờ điều kiện rất hữu ích:

```
127.0.0.1:6379> ZADD zz 1 x
(integer) 1
127.0.0.1:6379> ZADD zz GT 0 x
(integer) 0
127.0.0.1:6379> ZSCORE zz x
"1"                             ← GT: chỉ cập nhật nếu điểm mới LỚN HƠN
127.0.0.1:6379> ZADD zz GT 5 x
(integer) 0
127.0.0.1:6379> ZSCORE zz x
"5"                             ← 5 > 1 nên cập nhật
```

`GT`/`LT`/`NX`/`XX` giúp viết "chỉ ghi điểm cao nhất" mà không cần đọc trước.

Gộp hai bảng xếp hạng:

```
127.0.0.1:6379> ZUNIONSTORE tong 2 z zz
(integer) 4
127.0.0.1:6379> ZRANGE tong 0 -1 WITHSCORES
1) "a"
2) "1"
3) "b"
4) "2"
5) "c"
6) "3"
7) "x"
8) "5"                          ← điểm của phần tử trùng được CỘNG lại
```

### Ba mẫu dùng Sorted Set trong thực tế

**a) Việc hẹn giờ (delayed job)** — điểm là thời điểm cần chạy:

```js
await r.zadd('viec:hen-gio', Date.now() + 60000, JSON.stringify({ id: 1 }));
// worker chạy mỗi giây:
const den_han = await r.zrangebyscore('viec:hen-gio', 0, Date.now(), 'LIMIT', 0, 100);
```

**b) Rate limit cửa sổ trượt** — điểm là timestamp, xem [bài 10](./10-thuc-chien-nodejs.md).

**c) Sắp xếp theo chuỗi (`ZRANGEBYLEX`)** — khi **mọi** phần tử có cùng điểm, Redis sắp theo thứ tự
từ điển. Dùng để làm autocomplete:

```
127.0.0.1:6379> ZADD lex 0 aa 0 ab 0 ba
(integer) 3
127.0.0.1:6379> ZRANGEBYLEX lex [a (b
1) "aa"
2) "ab"
```

`[` là bao gồm, `(` là loại trừ. Nếu điểm **không** giống nhau hết thì kết quả `ZRANGEBYLEX` vô nghĩa.

---

## 5. Encoding — vì sao 129 phần tử tốn gấp 11 lần 128 phần tử

Redis lưu tập hợp **nhỏ** ở dạng nén (`listpack` — một mảng byte liền mạch), và chuyển sang cấu trúc
đầy đủ khi vượt ngưỡng. Đo thật:

```
127.0.0.1:6379> ZADD z128 ... (128 phần tử)
127.0.0.1:6379> OBJECT ENCODING z128
"listpack"
127.0.0.1:6379> MEMORY USAGE z128
(integer) 947

127.0.0.1:6379> ZADD z128 129 m129
127.0.0.1:6379> OBJECT ENCODING z128
"skiplist"
127.0.0.1:6379> MEMORY USAGE z128
(integer) 10679                 ← thêm 1 phần tử, tốn gấp 11 lần
```

Với hash:

```
512 trường -> listpack   MEMORY USAGE 5958
513 trường -> hashtable  MEMORY USAGE 23445     ← gấp ~4 lần
```

Các ngưỡng thật trên Redis 8.10.0:

```
127.0.0.1:6379> CONFIG GET hash-max-listpack-entries
1) "hash-max-listpack-entries"
2) "512"                        ← blog cũ nói 128, sai
127.0.0.1:6379> CONFIG GET hash-max-listpack-value
1) "hash-max-listpack-value"
2) "64"
127.0.0.1:6379> CONFIG GET zset-max-listpack-entries
1) "zset-max-listpack-entries"
2) "128"
127.0.0.1:6379> CONFIG GET set-max-intset-entries
1) "set-max-intset-entries"
2) "512"
```

Ngưỡng **giá trị** cũng tính: chỉ cần **một** trường có giá trị dài quá 64 ký tự là cả hash chuyển sang
`hashtable`:

```
127.0.0.1:6379> HSET hv f "bbbb...(65 ký tự)"
127.0.0.1:6379> OBJECT ENCODING hv
"hashtable"
```

Set toàn số nguyên có encoding riêng, gọn nhất:

```
127.0.0.1:6379> SADD si 1 2 3
127.0.0.1:6379> OBJECT ENCODING si
"intset"
127.0.0.1:6379> SADD ss a b c
127.0.0.1:6379> OBJECT ENCODING ss
"listpack"
```

**Rút ra:** chia dữ liệu thành nhiều hash nhỏ (dưới ngưỡng) tiết kiệm hơn một hash khổng lồ. Mẫu
"hash sharding": thay vì `HSET tat-ca-user <id> <json>` với 1 triệu trường, dùng
`HSET user:shard:<id % 1000> <id> <json>` → 1000 hash × 1000 trường, tất cả đều ở `listpack`.

⚠️ Chiều ngược lại **không** đúng: khi đã chuyển sang `hashtable`, xoá bớt trường xuống dưới ngưỡng
cũng **không** quay lại `listpack`. Redis chỉ chuyển một chiều.

---

## 6. Bitmap, HyperLogLog, Geo

### Bitmap — 1 bit cho mỗi user

```
127.0.0.1:6379> SETBIT online:2026-08-28 100 1
(integer) 0
127.0.0.1:6379> SETBIT online:2026-08-28 500000 1
(integer) 0
127.0.0.1:6379> GETBIT online:2026-08-28 100
(integer) 1
127.0.0.1:6379> GETBIT online:2026-08-28 101
(integer) 0
127.0.0.1:6379> BITCOUNT online:2026-08-28
(integer) 2
```

Phép toán trên nhiều ngày:

```
127.0.0.1:6379> SETBIT online:2026-08-27 100 1
127.0.0.1:6379> SETBIT online:2026-08-27 999 1
127.0.0.1:6379> BITOP AND ca-hai online:2026-08-28 online:2026-08-27
(integer) 62501
127.0.0.1:6379> BITCOUNT ca-hai
(integer) 1                     ← 1 user online cả hai ngày
127.0.0.1:6379> BITOP OR mot-trong-hai online:2026-08-28 online:2026-08-27
(integer) 62501
127.0.0.1:6379> BITCOUNT mot-trong-hai
(integer) 3
```

⚠️ **Bẫy:** bitmap là string đặc, không thưa. Đặt bit thứ 500.000 tạo ra chuỗi 62.501 byte **dù chỉ có
2 bit bật**:

```
127.0.0.1:6379> STRLEN online:2026-08-28
(integer) 62501
127.0.0.1:6379> MEMORY USAGE online:2026-08-28
(integer) 131108
```

Bitmap chỉ đáng dùng khi id **liên tục và dày**. Với id thưa (UUID, id nhảy cóc) thì Set rẻ hơn.

### HyperLogLog — đếm gần đúng, tốn 14 KB

```
127.0.0.1:6379> PFADD uv user1 user2 ... (100.000 phần tử)
127.0.0.1:6379> PFCOUNT uv
(integer) 99725
127.0.0.1:6379> MEMORY USAGE uv
(integer) 14357
```

So với Set chứa đúng 100.000 phần tử đó:

```
127.0.0.1:6379> SCARD sset
(integer) 100000
127.0.0.1:6379> MEMORY USAGE sset
(integer) 4261838
```

**14.357 byte vs 4.261.838 byte — nhỏ hơn 297 lần**, đổi lại sai số 275 phần tử (0.275%). Sai số chuẩn
của HyperLogLog là ~0.81%.

Dùng khi: đếm UV, đếm số IP khác nhau, đếm số từ khoá tìm kiếm khác nhau. **Không** dùng khi cần biết
*ai* trong tập — HLL không liệt kê lại được phần tử.

`PFMERGE` gộp nhiều HLL (ví dụ 30 file theo ngày thành số của cả tháng) mà không đếm trùng.

### Geo — thật ra là Sorted Set

```
127.0.0.1:6379> GEOADD quan-an 105.8542 21.0285 "Pho Bat Dan" 105.8480 21.0245 "Bun Cha Huong Lien" 106.6822 10.7626 "Com Tam Sai Gon"
(integer) 3
127.0.0.1:6379> GEODIST quan-an "Pho Bat Dan" "Bun Cha Huong Lien" km
"0.7826"
127.0.0.1:6379> GEODIST quan-an "Pho Bat Dan" "Com Tam Sai Gon" km
"1145.2568"
127.0.0.1:6379> GEOSEARCH quan-an FROMLONLAT 105.85 21.03 BYRADIUS 2 km ASC WITHDIST
1) 1) "Pho Bat Dan"
   2) "0.4671"
2) 1) "Bun Cha Huong Lien"
   2) "0.6461"
```

Bằng chứng nó là Sorted Set:

```
127.0.0.1:6379> TYPE quan-an
zset
127.0.0.1:6379> ZRANGE quan-an 0 -1 WITHSCORES
1) "Com Tam Sai Gon"
2) "3967770149423002"           ← điểm là geohash 52-bit
```

Nghĩa là mọi lệnh `Z*` đều dùng được: `ZREM quan-an "Pho Bat Dan"` để xoá một địa điểm.

⚠️ Thứ tự tham số là **kinh độ trước, vĩ độ sau** (`longitude latitude`) — ngược với thói quen đọc
"toạ độ 21.02, 105.85". Đảo nhầm thì Hà Nội rơi xuống Ấn Độ Dương mà Redis không báo lỗi.

---

## 7. Bài tập

1. Làm bảng xếp hạng: 5 người chơi, cộng điểm vài lần, lấy top 3 kèm điểm, và tìm hạng của một người
   bất kỳ. Chỉ dùng lệnh `Z*`.
2. Dựng "hàng đợi tin cậy": worker lấy việc bằng `BLMOVE` sang `queue:dang-lam`, xử lý xong thì `LREM`.
   Mô phỏng worker chết giữa chừng và cho thấy việc vẫn còn trong `queue:dang-lam`.
3. Với 1 triệu user id liên tục, so sánh `MEMORY USAGE` của Bitmap và Set để lưu "ai đã online hôm nay"
   trong hai trường hợp: 900.000 user online, và 50 user online.
4. Tìm ngưỡng `listpack → hashtable` của hash trên Redis bạn đang chạy, rồi đổi
   `hash-max-listpack-entries` xuống 10 và đo lại `MEMORY USAGE`.

<details>
<summary>Gợi ý đáp án</summary>

**1.**
```
ZADD game 0 an 0 binh 0 cuong 0 dung 0 em
ZINCRBY game 120 an
ZINCRBY game 300 binh
ZREVRANGE game 0 2 WITHSCORES
ZREVRANK game an              ← hạng tính từ 0, nhớ +1 khi hiển thị
```

**2.**
```bash
# worker
redis-cli BLMOVE queue:cho queue:dang-lam RIGHT LEFT 0
# (giả vờ chết ở đây — Ctrl-C)
redis-cli LRANGE queue:dang-lam 0 -1     ← việc vẫn còn
```
Worker "giám sát" quét `queue:dang-lam`; nếu một việc nằm đó quá lâu thì `LMOVE` ngược về `queue:cho`.
Muốn biết "quá lâu" thì phải lưu thêm timestamp — đây chính là lúc nên chuyển sang Stream
([bài 06](./06-pubsub-va-stream.md)) thay vì tự dựng.

**3.** Đo thật:
```
Bitmap 900.000/1.000.000 online :    131093 byte  (128 KB)
Set    900.000/1.000.000 online :  29877580 byte  (28.5 MB)   → Bitmap nhỏ hơn 228 lần

Bitmap 50/1.000.000 online      :    163862 byte  (160 KB)
Set    50/1.000.000 online      :       230 byte               → Set nhỏ hơn 712 lần
```
Bitmap tốn gần như nhau ở cả hai trường hợp vì nó phải cấp phát tới **bit có chỉ số lớn nhất**, bất kể
có bao nhiêu bit được bật. Ngưỡng hoà vốn rơi vào khoảng mật độ ~0.5%.

**4.**
```
127.0.0.1:6379> CONFIG SET hash-max-listpack-entries 10
OK
127.0.0.1:6379> DEL h && HSET h f1 v1 ... f11 v11
127.0.0.1:6379> OBJECT ENCODING h
"hashtable"
```
Lưu ý: đổi config **không** chuyển ngược các hash đã tồn tại — chúng giữ nguyên encoding cho tới khi bị
ghi lại.
</details>

---

Tiếp theo: [03-ttl-va-het-han.md](./03-ttl-va-het-han.md)
