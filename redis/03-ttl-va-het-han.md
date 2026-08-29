# Bài 03 — TTL và cơ chế hết hạn

TTL là thứ biến Redis từ "một cái Map khổng lồ" thành cache. Bài này trả lời ba câu: đặt hạn thế nào,
**lệnh nào âm thầm xoá hạn**, và Redis thật sự xoá khoá hết hạn vào lúc nào.

---

## 1. Đặt và đọc hạn

```
127.0.0.1:6379> SET session:abc "data" EX 100
OK
127.0.0.1:6379> TTL session:abc
(integer) 100
127.0.0.1:6379> PTTL session:abc
(integer) 99891                 ← mili giây, chính xác hơn
127.0.0.1:6379> PERSIST session:abc
(integer) 1
127.0.0.1:6379> TTL session:abc
(integer) -1
```

Ba giá trị trả về của `TTL`, phải thuộc lòng:

| Giá trị | Nghĩa |
|---|---|
| `n > 0` | Còn n giây |
| `-1` | Khoá **tồn tại** nhưng **không có hạn** |
| `-2` | Khoá **không tồn tại** |

Nhầm `-1` với `-2` là bug kinh điển: code viết `if (ttl < 0) return null` sẽ coi khoá vĩnh viễn là
"không có".

Các cách đặt hạn:

```
127.0.0.1:6379> EXPIRE session:abc 50            ← giây
(integer) 1
127.0.0.1:6379> PEXPIRE session:abc 50000        ← mili giây
127.0.0.1:6379> EXPIREAT session:abc 1900000000  ← mốc thời gian Unix (giây)
(integer) 1
127.0.0.1:6379> EXPIRETIME session:abc
(integer) 1900000000            ← hỏi ngược: hết hạn vào lúc nào
```

`EXPIREAT` rất hữu ích cho "hết hạn lúc 0h ngày mai" — tính mốc một lần rồi đặt cho hàng nghìn khoá,
tất cả cùng hết hạn chính xác một thời điểm (khác với `EXPIRE 86400` mỗi khoá lệch nhau vài mili giây).

---

## 2. Bốn cờ điều kiện của `EXPIRE` (Redis 7+)

```
127.0.0.1:6379> EXPIRE session:abc 100 XX
(integer) 1                     ← XX: chỉ đặt nếu khoá ĐÃ CÓ hạn
127.0.0.1:6379> TTL session:abc
(integer) 100

127.0.0.1:6379> EXPIRE session:abc 50 GT
(integer) 0                     ← GT: chỉ đặt nếu hạn mới LỚN HƠN hạn cũ. 50 < 100 → từ chối
127.0.0.1:6379> TTL session:abc
(integer) 100

127.0.0.1:6379> EXPIRE session:abc 200 GT
(integer) 1                     ← 200 > 100 → chấp nhận
127.0.0.1:6379> TTL session:abc
(integer) 200
```

| Cờ | Chỉ đặt hạn khi |
|---|---|
| `NX` | Khoá **chưa** có hạn |
| `XX` | Khoá **đã** có hạn |
| `GT` | Hạn mới **lớn hơn** hạn hiện tại (khoá không hạn coi như vô cực → luôn từ chối) |
| `LT` | Hạn mới **nhỏ hơn** hạn hiện tại |

`GT` là công cụ để viết "gia hạn session nhưng không bao giờ rút ngắn" bằng **một** lệnh, không cần đọc
TTL trước rồi so sánh trong app (vốn có race condition).

`NX` là cách đúng để viết "đặt hạn nếu chưa có" trong rate limiter:

```lua
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
```

hoặc gọn hơn, không cần Lua:

```
127.0.0.1:6379> INCR rl:user1
(integer) 1
127.0.0.1:6379> EXPIRE rl:user1 60 NX
(integer) 1
127.0.0.1:6379> INCR rl:user1
(integer) 2
127.0.0.1:6379> EXPIRE rl:user1 60 NX
(integer) 0                     ← đã có hạn, không reset — cửa sổ không bị kéo dài vô hạn
127.0.0.1:6379> TTL rl:user1
(integer) 60
```

Không có `NX`, mỗi request lại reset TTL về 60 → user bị chặn **vĩnh viễn** miễn là còn gửi request.
Đây là bug rate-limiter phổ biến nhất.

---

## 3. Lệnh nào giữ TTL, lệnh nào xoá TTL

Đo thật, tất cả bắt đầu từ một khoá có `EX 100`:

| Lệnh | TTL sau đó | |
|---|---|---|
| `EXPIRE`, `PEXPIRE`, `EXPIREAT` | đặt lại | |
| `PERSIST` | `-1` | cố ý bỏ hạn |
| `SET k v` (không cờ) | **`-1`** | ⚠️ **xoá hạn** |
| `SET k v KEEPTTL` | `100` | ✅ giữ |
| `GETSET k v` | **`-1`** | ⚠️ **xoá hạn** |
| `APPEND` | `100` | ✅ giữ |
| `SETRANGE` | `100` | ✅ giữ |
| `INCR` / `INCRBY` | `100` | ✅ giữ |
| `RENAME k k2` | `100` | ✅ giữ (chuyển sang tên mới) |
| `COPY k k2` | `100` | ✅ giữ (bản sao cũng có hạn) |
| `HSET`, `LPUSH`, `SADD`, `ZADD`… | `100` | ✅ giữ (sửa nội dung, không đụng hạn) |

Transcript kiểm chứng:

```
127.0.0.1:6379> SET c v EX 100
OK
127.0.0.1:6379> SETRANGE c 0 z
(integer) 1
127.0.0.1:6379> TTL c
(integer) 100                   ← còn nguyên

127.0.0.1:6379> SET f v EX 100
OK
127.0.0.1:6379> GETSET f v2
"v"
127.0.0.1:6379> TTL f
(integer) -1                    ← bốc hơi
```

**Quy tắc dễ nhớ:** chỉ hai loại lệnh xoá TTL — lệnh **thay thế toàn bộ giá trị bằng một `SET` ngầm**
(`SET`, `GETSET`), và `PERSIST`. Mọi lệnh sửa-tại-chỗ đều giữ hạn.

---

## 4. Redis xoá khoá hết hạn vào lúc nào?

Câu hỏi phỏng vấn kinh điển. Redis dùng **hai** cơ chế song song:

**a) Xoá lười (lazy)** — khi có ai đó chạm vào khoá, Redis kiểm tra hạn trước; hết hạn thì xoá và trả
`(nil)`. Rẻ nhưng nếu không ai đọc thì khoá nằm đó mãi.

**b) Xoá chủ động (active)** — 10 lần mỗi giây (`hz:10`), Redis lấy ngẫu nhiên 20 khoá *có TTL*, xoá
những khoá đã hết hạn. Nếu **hơn 25%** trong số đó đã hết hạn, nó lặp lại ngay lập tức.

Đo thật: nạp 5000 khoá `EX 2`, rồi **không đọc khoá nào**:

```bash
$ for i in $(seq 1 5000); do echo "SET het:$i v EX 2"; done | redis-cli --pipe
ngay sau khi ghi:               DBSIZE=5000
sau 3 giây (chưa đọc khoá nào): DBSIZE=0

127.0.0.1:6379> INFO stats
expired_keys:5004
expired_keys_active:5003        ← 5003/5004 do vòng quét chủ động dọn
```

Kết quả này bác một hiểu lầm phổ biến: "khoá hết hạn vẫn chiếm RAM cho tới khi bạn đọc nó". Với 5000
khoá cùng hết hạn, vòng quét chủ động dọn sạch trong dưới 1 giây, vì tỉ lệ khoá hết hạn cao nên nó lặp
liên tục.

**Nhưng** cơ chế lấy mẫu ngẫu nhiên có mặt trái: khi bạn có 10 triệu khoá và chỉ 100 khoá hết hạn, xác
suất lấy trúng rất thấp → 100 khoá đó có thể nằm lại rất lâu. Đó là lý do `used_memory` đôi khi không
giảm ngay sau khi bạn nghĩ cache đã hết hạn.

**Trên replica:** replica **không tự xoá** khoá hết hạn. Nó chờ lệnh `DEL` mà master gửi xuống. Vì vậy
đọc từ replica **có thể** trả về khoá đã quá hạn về mặt logic — nhưng Redis chặn điều đó ở tầng đọc:
replica vẫn trả `(nil)` nếu thấy khoá quá hạn, chỉ là khoá chưa bị xoá khỏi bộ nhớ. Chi tiết ở
[bài 08](./08-nhan-ban-sentinel-cluster.md).

---

## 5. Nhận sự kiện khi khoá hết hạn

Redis có thể phát sự kiện qua Pub/Sub. Mặc định **tắt**:

```
127.0.0.1:6379> CONFIG GET notify-keyspace-events
1) "notify-keyspace-events"
2) ""
127.0.0.1:6379> CONFIG SET notify-keyspace-events "KEA"
OK
```

`K` = kênh keyspace, `E` = kênh keyevent, `A` = mọi loại sự kiện. Nghe thử:

```bash
$ redis-cli PSUBSCRIBE "__key*@0__:*"
```

Rồi ở terminal khác `SET thu:nghiem "gia tri" EX 2`. Người nghe nhận được:

```
1) "pmessage"
2) "__key*@0__:*"
3) "__keyspace@0__:thu:nghiem"
4) "set"                        ← kênh keyspace: khoá nào → sự kiện gì

1) "pmessage"
2) "__key*@0__:*"
3) "__keyevent@0__:set"
4) "thu:nghiem"                 ← kênh keyevent: sự kiện gì → khoá nào

... (2 giây sau)

1) "pmessage"
2) "__key*@0__:*"
3) "__keyevent@0__:expired"
4) "thu:nghiem"
```

⚠️ **Ba cảnh báo quan trọng trước khi dùng cái này làm scheduler:**

1. Sự kiện `expired` chỉ bắn ra **khi khoá thật sự bị xoá**, không phải khi nó hết hạn về mặt logic.
   Với cơ chế lấy mẫu ngẫu nhiên ở mục 4, độ trễ có thể là vài giây, thậm chí lâu hơn.
2. Đây là **Pub/Sub**, tức là *fire-and-forget*. Client mất kết nối 3 giây thì mọi sự kiện trong 3 giây
   đó **mất vĩnh viễn**, không có cách nào lấy lại. Xem bằng chứng ở
   [bài 06 mục 1](./06-pubsub-va-stream.md).
3. Sự kiện không mang **giá trị** của khoá, chỉ mang tên khoá. Khoá đã bị xoá rồi nên bạn không `GET`
   lại được.

Nghĩa là: **đừng dùng keyspace notification để chạy việc quan trọng** ("đơn hàng hết hạn 15 phút thì
huỷ"). Dùng Sorted Set với điểm là thời điểm đến hạn, hoặc Stream. Chỉ dùng notification cho việc "biết
thì tốt, không biết cũng không sao" như xoá cache tầng 2 trong bộ nhớ tiến trình.

---

## 6. Chọn TTL bao nhiêu

Không có con số đúng, nhưng có ba câu hỏi để tự trả lời:

**a) Dữ liệu này cũ bao lâu thì bắt đầu sai lệch có hại?** Giá sản phẩm sai 5 phút có thể chấp nhận;
số dư ví thì không cache được.

**b) Nếu cache miss thì tốn bao nhiêu?** Query 300ms mà chỉ tiết kiệm được 60 giây thì tỉ lệ trúng phải
rất cao mới bù được.

**c) Nếu 10.000 khoá cùng hết hạn một lúc thì sao?** Đây là **cache avalanche**. Nếu bạn nạp cache hàng
loạt lúc deploy với `EX 3600`, thì đúng 1 giờ sau tất cả cùng chết và toàn bộ traffic đập vào database.

Cách chống: **thêm nhiễu ngẫu nhiên vào TTL**.

```js
const TTL_CO_BAN = 3600;
const ttl = TTL_CO_BAN + Math.floor(Math.random() * 300);   // 3600–3900
await r.set(key, data, 'EX', ttl);
```

Với 10.000 khoá, chúng sẽ hết hạn rải đều trong 5 phút thay vì cùng một giây.

Mốc tham khảo cho các loại dữ liệu thường gặp:

| Loại | TTL gợi ý |
|---|---|
| Session người dùng | 30 phút – 7 ngày (gia hạn mỗi request bằng `EXPIRE ... GT`) |
| Kết quả query danh sách | 30 giây – 5 phút |
| Chi tiết một bản ghi | 5 – 60 phút, xoá chủ động khi bản ghi được sửa |
| Cấu hình / feature flag | 1 – 5 phút |
| Rate limit | đúng bằng cửa sổ |
| Khoá phân tán | dài hơn thời gian xử lý dài nhất, thường 10–30 giây |
| Kết quả "không tìm thấy" (chống xuyên cache) | 30 – 60 giây, ngắn hơn hẳn |

**Và quy tắc bao trùm: mọi khoá cache phải có TTL.** Khoá không TTL là rò rỉ bộ nhớ có kế hoạch. Kiểm
tra định kỳ:

```bash
$ redis-cli INFO keyspace
db0:keys=631658,expires=0,avg_ttl=0,subexpiry=0
```

`expires=0` trên một database dùng làm cache là dấu hiệu đỏ: **không khoá nào có hạn**.

---

## 7. Bài tập

1. Viết rate limiter "5 request / phút" bằng `INCR` + `EXPIRE NX`, rồi cố tình bỏ `NX` và chứng minh
   user bị chặn vĩnh viễn.
2. Tạo 20 khoá cache với TTL 60 giây có nhiễu ngẫu nhiên ±10%, in ra `TTL` của tất cả để thấy chúng lệch
   nhau.
3. Chứng minh `SET` xoá TTL còn `SET ... KEEPTTL` thì không, bằng một chuỗi lệnh trong `redis-cli`.
4. Bật `notify-keyspace-events "Ex"` (chỉ sự kiện expired), đặt một khoá `EX 1`, và đo xem sự kiện tới
   sau bao lâu kể từ lúc hết hạn.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Không có `NX`:
```
INCR rl:x   → 1 ; EXPIRE rl:x 60 → TTL 60
(59 giây sau) INCR rl:x → 2 ; EXPIRE rl:x 60 → TTL lại về 60
```
Chỉ cần user gửi 1 request mỗi 59 giây là bộ đếm không bao giờ reset, và khi nó chạm 6 thì user bị chặn
mãi mãi.

**2.**
```bash
for i in $(seq 1 20); do
  redis-cli SET c:$i v EX $((54 + RANDOM % 13)) > /dev/null
done
for i in $(seq 1 20); do redis-cli TTL c:$i; done
```

**3.** Xem mục 3.

**4.** Trên máy viết tài liệu này, với database gần như trống, sự kiện tới trong vòng ~100ms vì vòng
quét chủ động chạy 10 lần/giây. Lặp lại thí nghiệm sau khi nạp 1 triệu khoá không hết hạn — độ trễ tăng
rõ rệt, vì việc lấy mẫu ngẫu nhiên khó trúng đúng khoá đó hơn.
</details>

---

Tiếp theo: [04-cache-pattern.md](./04-cache-pattern.md)
