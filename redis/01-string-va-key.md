# Bài 01 — String, khoá, và cách Redis thật sự lưu chúng

String là kiểu cơ bản nhất nhưng **không hề tầm thường**: nó là chỗ dùng cho cache JSON, đếm số, khoá
phân tán, cờ bật/tắt tính năng, rate limit. Nắm chắc bài này là xong 60% việc thật với Redis.

---

## 1. `SET` và `GET` — và bốn tuỳ chọn quyết định mọi thứ

```
127.0.0.1:6379> SET user:1:name "Vanson"
OK
127.0.0.1:6379> GET user:1:name
"Vanson"
127.0.0.1:6379> GET khong-ton-tai
(nil)
```

Sức mạnh thật nằm ở các tuỳ chọn của `SET`:

| Tuỳ chọn | Nghĩa | Dùng để |
|---|---|---|
| `EX n` / `PX n` | Đặt TTL n giây / n mili giây | Cache, session |
| `NX` | **Chỉ** ghi nếu khoá chưa tồn tại | Khoá phân tán, chống trùng |
| `XX` | **Chỉ** ghi nếu khoá đã tồn tại | Gia hạn có điều kiện |
| `KEEPTTL` | Ghi đè giá trị nhưng **giữ nguyên TTL** | Cập nhật cache không reset hạn |
| `GET` | Trả về giá trị **cũ** rồi mới ghi | Đổi giá trị và biết cái cũ, một lệnh |

### `KEEPTTL` — cái bẫy im lặng nhất của Redis

`SET` bình thường **xoá sạch TTL**. Đây là nguồn gốc của bug "session tự nhiên sống mãi":

```
127.0.0.1:6379> SET tmp v EX 60
OK
127.0.0.1:6379> TTL tmp
(integer) 60

127.0.0.1:6379> SET tmp v2 KEEPTTL
OK
127.0.0.1:6379> TTL tmp
(integer) 60                    ← giữ nguyên

127.0.0.1:6379> SET tmp v3
OK
127.0.0.1:6379> TTL tmp
(integer) -1                    ← TTL BỐC HƠI, khoá sống vĩnh viễn
```

`-1` nghĩa là "khoá tồn tại, không có hạn". `-2` nghĩa là "khoá không tồn tại". Nhớ hai con số này.

Ở đâu bug này xuất hiện: mọi chỗ code làm `redis.set(key, JSON.stringify(data))` để "cập nhật cache"
mà quên `EX`. Sau vài tháng, Redis đầy khoá không bao giờ hết hạn, `evicted_keys` bắt đầu tăng, và
session của user bị đá ra ngẫu nhiên.

### `NX` — nền tảng của khoá phân tán

```
127.0.0.1:6379> SET lock:1 token NX EX 30
OK                              ← lấy được khoá
127.0.0.1:6379> SET lock:1 token2 NX EX 30
(nil)                           ← người khác đang giữ, KHÔNG ghi đè
127.0.0.1:6379> GET lock:1
"token"
```

`(nil)` ở đây không phải lỗi — nó là **câu trả lời "không"**. Toàn bộ cơ chế khoá phân tán dựng trên
một dòng này. Chi tiết ở [bài 05](./05-transaction-va-lua.md).

> `SETNX` và `SETEX` là lệnh cũ, vẫn chạy nhưng đã bị đánh dấu deprecated từ Redis 2.6.12. Dùng
> `SET ... NX EX n` — vừa ngắn hơn vừa **nguyên tử**, còn `SETNX` rồi `EXPIRE` là hai lệnh, và nếu
> tiến trình chết giữa chừng thì bạn có một khoá không bao giờ hết hạn.

---

## 2. `INCR` — vì sao phải để Redis đếm hộ

Redis chạy một luồng, nên `INCR` **không bao giờ** mất số đếm:

```
127.0.0.1:6379> SET counter 10
OK
127.0.0.1:6379> INCR counter
(integer) 11
127.0.0.1:6379> INCRBY counter 5
(integer) 16
127.0.0.1:6379> DECR counter
(integer) 15
127.0.0.1:6379> INCRBYFLOAT price 19.99
"19.99"
127.0.0.1:6379> INCRBYFLOAT price 0.01
"20"
```

Nếu bạn tự đếm trong app — đọc, cộng 1, ghi lại — thì mất số đếm. Đo thật bằng 1000 request đồng thời:

```js
// SAI: đọc – cộng – ghi trong app
await Promise.all(Array.from({length:1000}, async () => {
  const n = Number(await r.get('dem:sai'));
  await r.set('dem:sai', n + 1);
}));

// ĐÚNG: để Redis cộng
await Promise.all(Array.from({length:1000}, () => r.incr('dem:dung')));
```

```
$ node incr.mjs
GET rồi SET trong app : mong đợi 1000, thực tế 1
INCR                  : mong đợi 1000, thực tế 1000
```

**Thực tế 1**, không phải 999. Vì cả 1000 request đọc gần như cùng lúc, tất cả đều thấy `0`, tất cả đều
ghi `1`. Race condition không phải "thỉnh thoảng lệch một chút" — nó có thể sai toàn tập.

⚠️ `INCR` chỉ hiểu chuỗi biểu diễn số nguyên 64-bit:

```
127.0.0.1:6379> SET user:1:name "Vanson"
OK
127.0.0.1:6379> INCR user:1:name
(error) ERR value is not an integer or out of range
```

Và `INCRBYFLOAT` trả về **chuỗi** `"20"`, không phải `20.00` — Redis cắt số 0 thừa.

---

## 3. Các lệnh string còn lại

```
127.0.0.1:6379> APPEND user:1:name " Bui"
(integer) 10
127.0.0.1:6379> GET user:1:name
"Vanson Bui"
127.0.0.1:6379> STRLEN user:1:name
(integer) 10
127.0.0.1:6379> GETRANGE user:1:name 0 2
"Van"
127.0.0.1:6379> SETRANGE user:1:name 0 "V"
(integer) 10

127.0.0.1:6379> MSET a 1 b 2 c 3
OK
127.0.0.1:6379> MGET a b c khong-co
1) "1"
2) "2"
3) "3"
4) (nil)                        ← khoá thiếu vẫn giữ đúng vị trí trong mảng

127.0.0.1:6379> GETDEL a
"1"                             ← lấy rồi xoá, một lệnh nguyên tử
127.0.0.1:6379> EXISTS a
(integer) 0

127.0.0.1:6379> SET g v EX 100
OK
127.0.0.1:6379> GETEX g
"v"
127.0.0.1:6379> TTL g
(integer) 100
127.0.0.1:6379> GETEX g PERSIST
"v"
127.0.0.1:6379> TTL g
(integer) -1                    ← GETEX PERSIST: đọc và bỏ hạn, một lệnh
```

`MGET` là lệnh đáng nhớ nhất ở đây: nó biến N lần gọi mạng thành 1. Đo thật với 1000 khoá
([bài 10](./10-thuc-chien-nodejs.md) có code đầy đủ):

```
1000 GET tuần tự (await từng cái)    205ms
1 lệnh MGET 1000 khoá                  2ms
```

---

## 4. Lệnh làm việc với khoá (không phụ thuộc kiểu)

```
127.0.0.1:6379> EXISTS user:1:name
(integer) 1
127.0.0.1:6379> TYPE user:1:name
string
127.0.0.1:6379> DEL user:1:name
(integer) 1
127.0.0.1:6379> DEL khong-ton-tai
(integer) 0                     ← DEL không báo lỗi, chỉ trả về 0

127.0.0.1:6379> SET k v EX 5
OK
127.0.0.1:6379> RENAME k k2
OK
127.0.0.1:6379> TTL k2
(integer) 5                     ← RENAME giữ TTL
127.0.0.1:6379> COPY k2 k3
(integer) 1
127.0.0.1:6379> TTL k3
(integer) 5                     ← COPY cũng giữ TTL
```

### `WRONGTYPE` — lỗi bạn sẽ gặp trong tuần đầu

Mỗi khoá chỉ có **một** kiểu. Gọi lệnh của kiểu khác vào nó là lỗi ngay:

```
127.0.0.1:6379> LPUSH mylist "x"
(integer) 1
127.0.0.1:6379> GET mylist
(error) WRONGTYPE Operation against a key holding the wrong kind of value
```

Trong Node, `ioredis` ném exception `ReplyError: WRONGTYPE ...`. Nguyên nhân thường gặp: hai đoạn code
khác nhau dùng chung một mẫu tên khoá nhưng lưu kiểu khác nhau (một chỗ `SET user:1`, chỗ kia
`HSET user:1 ten ...`).

### `DEL` vs `UNLINK` — khác biệt 239 mili giây

`DEL` giải phóng bộ nhớ **ngay trong luồng chính**. Với khoá bự thì đó là treo server. Đo thật trên một
hash 3 triệu trường (155 MB):

```
127.0.0.1:6379> DEL khoa-bu
(integer) 1
127.0.0.1:6379> SLOWLOG GET 1
1) 1) (integer) 62
   2) (integer) 1787873735
   3) (integer) 239292          ← 239.292 micro giây = 239ms server BỊ TREO
   4) 1) "DEL"
      2) "khoa-bu"
```

Cùng khoá đó, dùng `UNLINK`:

```
127.0.0.1:6379> UNLINK khoa-bu2
(integer) 1
127.0.0.1:6379> SLOWLOG GET 1
(empty array)                   ← không có gì lọt vào slowlog (ngưỡng 1ms)
```

`UNLINK` chỉ gỡ khoá khỏi keyspace ngay lập tức, rồi giao việc giải phóng bộ nhớ cho một luồng nền.
**Quy tắc: mặc định dùng `UNLINK`.** Với khoá nhỏ hai lệnh như nhau; với khoá bự thì `UNLINK` cứu bạn.

Tương tự, `FLUSHALL`/`FLUSHDB` có tuỳ chọn `ASYNC`.

### `KEYS` — lệnh cấm

```
127.0.0.1:6379> KEYS *
```

Trên 631.658 khoá, lệnh này giữ server **151ms**:

```
127.0.0.1:6379> SLOWLOG GET 3
1) 1) (integer) 0
   2) (integer) 1787873334
   3) (integer) 151167          ← 151ms
   4) 1) "KEYS"
      2) "*"
```

Và nó làm hỏng độ trễ của mọi client khác (đo bằng `redis-cli --latency`, xem
[bài 00 mục 6](./00-cai-dat-va-redis-cli.md)): max 1.99ms → **61.96ms**.

Thay bằng `SCAN`:

```
127.0.0.1:6379> SCAN 0 MATCH "s:1*" COUNT 100
1) "64"                         ← con trỏ cho lần gọi tiếp theo
2) 1) "s:186"
   2) "s:144"
   3) "s:164"
```

`SCAN` trả về một **con trỏ**. Lặp cho tới khi con trỏ về `"0"`:

```js
let cursor = '0', tim = [];
do {
  const [c, keys] = await r.scan(cursor, 'MATCH', 'sp:*', 'COUNT', 100);
  cursor = c;
  tim.push(...keys);
} while (cursor !== '0');
```

Ba điều phải biết về `SCAN`:

1. **`COUNT` là gợi ý, không phải giới hạn.** Gõ `SCAN 0 COUNT 10` vẫn có thể trả về nhiều hơn hoặc ít
   hơn 10 khoá — nó là số "ô bảng băm" quét mỗi lần.
2. **`SCAN` có thể trả về trùng.** Bảo đảm duy nhất là: khoá tồn tại suốt quá trình quét sẽ được trả về
   **ít nhất một lần**. Code của bạn phải chịu được khoá lặp.
3. **Có bản riêng cho từng kiểu:** `HSCAN`, `SSCAN`, `ZSCAN` để duyệt bên trong hash/set/zset lớn mà
   không phải `HGETALL`/`SMEMBERS`.

---

## 5. Đặt tên khoá — quy ước và cái giá của việc đặt dài

Redis không có schema, nên **tên khoá chính là schema**. Quy ước chuẩn của cộng đồng:

```
<miền>:<thực-thể>:<id>:<thuộc-tính>

cache:san-pham:1234           một sản phẩm đã render sẵn
session:abc123def             session
rate:login:user:99            đếm request đăng nhập
lock:don-hang:5678            khoá phân tán
queue:gui-mail                hàng đợi
```

Dấu `:` không có ý nghĩa với Redis — nhưng công cụ GUI (RedisInsight) hiển thị nó thành cây thư mục,
và nó cho phép `SCAN MATCH "cache:*"` khi cần dọn.

**Cái giá của tên dài — đo thật với 100.000 khoá:**

```
khoá ngắn  u:N                                -> used_memory:8224248    (7.84 MB)
khoá dài   ung_dung:nguoi_dung:thong_tin:N    -> used_memory:11670824   (11.13 MB)
```

Chênh 3.4 MB cho 100k khoá, tức **+42%**. Với 10 triệu khoá thì đó là 340 MB RAM chỉ để chứa tên. Đặt
tên ngắn nhưng vẫn đọc được: `u:1:p` khó bảo trì, `ung_dung:nguoi_dung:...` thì phí — `user:1:profile`
là mức cân bằng hợp lý.

---

## 6. `OBJECT ENCODING` — Redis lưu string thật sự thế nào

Đây là phần bị các blog cũ nói sai nhiều nhất. Redis có **ba** cách lưu string:

| Encoding | Khi nào | Đặc điểm |
|---|---|---|
| `int` | Giá trị là số nguyên 64-bit | Lưu thẳng số, 0 byte cấp phát thêm |
| `embstr` | Chuỗi ngắn | Header và dữ liệu nằm trong **một** khối bộ nhớ liền |
| `raw` | Chuỗi dài, hoặc từng bị sửa | Header và dữ liệu nằm ở hai khối |

```
127.0.0.1:6379> SET n 100
OK
127.0.0.1:6379> OBJECT ENCODING n
"int"
127.0.0.1:6379> SET s "chuoi ngan"
OK
127.0.0.1:6379> OBJECT ENCODING s
"embstr"
```

### Ngưỡng embstr → raw **không phải 44 byte**

Mọi tài liệu tiếng Việt đều nói "chuỗi ≤ 44 byte thì embstr". Đo thật trên Redis 8.10.0 thì ngưỡng phụ
thuộc **cả độ dài khoá**:

```
độ dài khoá = 1   -> chuyển sang raw khi giá trị dài 41  (tổng 42)
độ dài khoá = 5   -> chuyển sang raw khi giá trị dài 37  (tổng 42)
độ dài khoá = 10  -> chuyển sang raw khi giá trị dài 32  (tổng 42)
độ dài khoá = 20  -> chuyển sang raw khi giá trị dài 22  (tổng 42)
```

Quy luật: **`len(khoá) + len(giá trị) ≤ 41` thì `embstr`, từ 42 trở lên là `raw`.** Redis 8 nhúng cả
tên khoá vào cùng khối cấp phát với giá trị, nên hai thứ ăn chung một ngân sách.

Tự kiểm tra:

```
127.0.0.1:6379> SET k38 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
OK
127.0.0.1:6379> STRLEN k38
(integer) 38
127.0.0.1:6379> OBJECT ENCODING k38
"embstr"                        ← 3 + 38 = 41

127.0.0.1:6379> SET k39 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
OK
127.0.0.1:6379> OBJECT ENCODING k39
"raw"                           ← 3 + 39 = 42, vượt ngưỡng

127.0.0.1:6379> SET khoa8bit "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
OK
127.0.0.1:6379> OBJECT ENCODING khoa8bit
"embstr"                        ← 8 + 33 = 41, khoá dài hơn thì giá trị phải ngắn lại
```

⚠️ Đừng học thuộc con số. **Học cái lệnh** `OBJECT ENCODING` — nó luôn nói sự thật về bản Redis bạn
đang chạy, còn con số thì đổi theo phiên bản.

### `APPEND` biến `embstr` thành `raw` vĩnh viễn

```
127.0.0.1:6379> SET user:1:name "Vanson"
OK
127.0.0.1:6379> OBJECT ENCODING user:1:name
"embstr"
127.0.0.1:6379> APPEND user:1:name " Bui"
(integer) 10
127.0.0.1:6379> OBJECT ENCODING user:1:name
"raw"                           ← không quay lại embstr nữa
```

Vì `embstr` là bất biến (immutable) — muốn sửa thì phải cấp phát lại, nên Redis chuyển hẳn sang `raw`.

### `MEMORY USAGE` — chi phí thật của một khoá

```
127.0.0.1:6379> SET nho "x"
127.0.0.1:6379> MEMORY USAGE nho
(integer) 32                    ← 1 byte dữ liệu, 32 byte thật sự tốn
```

Chi phí cố định ~30–50 byte mỗi khoá (header đối tượng + entry trong bảng băm). Với 10 triệu khoá nhỏ,
riêng overhead đã là ~400 MB. Đây là lý do lưu 1000 trường trong **một hash** tiết kiệm hơn nhiều so với
1000 khoá string riêng — xem [bài 02](./02-list-hash-set-zset.md).

---

## 7. Bài tập

1. Tạo một khoá `bai-viet:1:luot-xem`, tăng nó 5 lần bằng `INCR`, rồi đặt TTL 1 giờ **mà không mất giá
   trị đếm**. Sau đó cập nhật giá trị thành 100 nhưng giữ nguyên TTL.
2. Viết một đoạn `SCAN` xoá hết khoá theo mẫu `cache:*` mà không dùng `KEYS`, và dùng `UNLINK` thay `DEL`.
3. Với cùng dữ liệu (1000 người dùng, mỗi người có `ten`, `email`, `tuoi`), so sánh `MEMORY USAGE` giữa
   (a) 3000 khoá string và (b) 1000 hash 3 trường. Chênh bao nhiêu?
4. Tìm ngưỡng `embstr → raw` trên Redis của bạn với khoá dài đúng 8 ký tự.

<details>
<summary>Gợi ý đáp án</summary>

**1.**
```
127.0.0.1:6379> INCR bai-viet:1:luot-xem      (×5)
(integer) 5
127.0.0.1:6379> EXPIRE bai-viet:1:luot-xem 3600
(integer) 1
127.0.0.1:6379> SET bai-viet:1:luot-xem 100 KEEPTTL
OK
127.0.0.1:6379> TTL bai-viet:1:luot-xem
(integer) 3598
```
Không được dùng `SET ... EX 3600` ở bước cuối vì nó reset đồng hồ.

**2.**
```js
let cursor = '0';
do {
  const [c, keys] = await r.scan(cursor, 'MATCH', 'cache:*', 'COUNT', 500);
  cursor = c;
  if (keys.length) await r.unlink(...keys);
} while (cursor !== '0');
```
Gọi `unlink` theo lô 500 chứ không từng khoá một — mỗi lần gọi là một vòng mạng.

**3.** Đo thật trên máy viết tài liệu này:
```
3000 khoá string : used_memory 3117392   (DBSIZE=3000)
1000 hash 3 trường: used_memory 3020504   (DBSIZE=1000)
chênh 96888 byte ≈ 95 KB, tức ~97 byte tiết kiệm được cho mỗi người dùng
```
Mỗi hash 3 trường chỉ tốn `MEMORY USAGE` = 55 byte, trong khi 3 khoá string riêng tốn ~3×32 = 96 byte chỉ
riêng phần header. Với 1 triệu người dùng thì chính lệch này là ~95 MB. Cách đo:
```bash
$ redis-cli FLUSHALL && for i in $(seq 1 1000); do
    echo "SET u:$i:ten a"; echo "SET u:$i:email b"; echo "SET u:$i:tuoi 20";
  done | redis-cli --pipe && redis-cli INFO memory | grep ^used_memory:
```
rồi lặp lại với `HSET u:$i ten a email b tuoi 20`.

**4.** Khoá 8 ký tự → giá trị chuyển sang `raw` khi dài 34 (8 + 34 = 42).
</details>

---

Tiếp theo: [02-list-hash-set-zset.md](./02-list-hash-set-zset.md)
