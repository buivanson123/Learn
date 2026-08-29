# Bài 00 — Dựng Redis và làm chủ `redis-cli`

Mục tiêu: có một Redis chạy được, biết gõ lệnh vào nó, và biết đọc `INFO` để trả lời câu "server này
đang ổn không".

---

## 1. Dựng Redis bằng Docker

```bash
$ docker run -d --name redis-lab -p 6379:6379 redis:8-alpine
$ docker exec -it redis-lab redis-cli
127.0.0.1:6379> PING
PONG
```

`-p 6379:6379` để app Node trên máy bạn kết nối được bằng `redis://127.0.0.1:6379`. Nếu chỉ học lệnh
thì bỏ cũng được, vì `docker exec` đã vào thẳng bên trong container.

Xác nhận đúng bản:

```
127.0.0.1:6379> INFO server
# Server
redis_version:8.10.0
redis_mode:standalone
os:Linux 7.0.12-linuxkit aarch64
multiplexing_api:epoll
process_id:1
```

`multiplexing_api:epoll` là cách Redis xử lý hàng nghìn kết nối bằng **một luồng** — sẽ nói kỹ ở mục 5.

### Nếu muốn dữ liệu không mất khi xoá container

```bash
$ docker run -d --name redis-lab -p 6379:6379 \
    -v redis-data:/data \
    redis:8-alpine redis-server --appendonly yes
```

`-v redis-data:/data` gắn volume vào thư mục `/data` — đúng chỗ Redis ghi file. Kiểm tra:

```
127.0.0.1:6379> CONFIG GET dir
1) "dir"
2) "/data"
```

---

## 2. `redis-cli` — bốn cách gõ lệnh

**Cách 1 — vào chế độ tương tác** (dùng khi học, khi debug):

```bash
$ docker exec -it redis-lab redis-cli
127.0.0.1:6379> SET a 1
OK
127.0.0.1:6379> GET a
"1"
127.0.0.1:6379> exit
```

**Cách 2 — gõ một lệnh rồi thoát** (dùng trong script, CI):

```bash
$ docker exec redis-lab redis-cli SET a 1
OK
$ docker exec redis-lab redis-cli GET a
1
```

⚠️ Để ý sự khác biệt: chế độ tương tác in `"1"` (có nháy kép), chế độ một lệnh in `1` (không nháy).
Vì khi đầu ra **không phải terminal**, `redis-cli` tự chuyển sang "raw mode" để tiện đưa vào `grep`,
`awk`. Muốn giữ định dạng có nháy kép và `(integer)` / `(nil)`, thêm `--no-raw`:

```bash
$ docker exec redis-lab redis-cli --no-raw GET a
"1"
$ docker exec redis-lab redis-cli --no-raw GET khong-ton-tai
(nil)
$ docker exec redis-lab redis-cli --no-raw INCR a
(integer) 2
```

Biết mẹo này rất hữu ích: mọi transcript trong tài liệu này đều dùng `--no-raw` nên bạn thấy đúng thứ
mình sẽ thấy khi gõ tay.

**Cách 3 — nạp hàng loạt bằng `--pipe`** (dùng khi cần tạo dữ liệu test):

```bash
$ docker exec -i redis-lab sh -c 'for i in $(seq 1 5000); do echo "SET het:$i v EX 2"; done | redis-cli --pipe'
All data transferred. Waiting for the last reply...
Last reply received from server.
errors: 0, replies: 5000
```

`--pipe` gom mọi lệnh vào một luồng và không chờ từng phản hồi. Nạp 5000 khoá gần như tức thì.

**Cách 4 — kết nối từ máy khác:**

```bash
$ redis-cli -h 10.0.0.5 -p 6379 -a 'mat-khau' -n 3
```

`-n 3` là chọn database số 3 (xem mục 4).

---

## 3. Kiểu phản hồi — đọc output cho đúng

`redis-cli` in ra 5 dạng, mỗi dạng tương ứng một kiểu trong giao thức RESP:

```
127.0.0.1:6379> SET a 1
OK                              ← Simple String: lệnh thành công

127.0.0.1:6379> GET a
"1"                             ← Bulk String: một giá trị (LUÔN là chuỗi)

127.0.0.1:6379> INCR a
(integer) 2                     ← Integer

127.0.0.1:6379> GET khong-ton-tai
(nil)                           ← Null: khoá không tồn tại

127.0.0.1:6379> MGET a b c
1) "2"
2) (nil)
3) (nil)                        ← Array

127.0.0.1:6379> INCR chuoi-chu
(error) ERR value is not an integer or out of range     ← Error
```

**Điều quan trọng nhất trong bảng trên:** `GET` trả về **chuỗi**, kể cả khi bạn `SET a 1`. Redis không
có kiểu số. `INCR` hiểu chuỗi `"1"` là số khi cần, nhưng giá trị lưu vẫn là chuỗi. Trong Node, đây là
nguồn bug hạng nhất — xem [bài 12 lỗi #2](./12-loi-thuong-gap.md).

---

## 4. Database — Redis có 16 "ngăn", và bạn gần như không nên dùng

```
127.0.0.1:6379> CONFIG GET databases
1) "databases"
2) "16"
```

Mặc định bạn đang ở `db0`. Ghi vào `db3` rồi đọc ở `db0` sẽ không thấy:

```bash
$ docker exec redis-lab redis-cli -n 3 SET chi-o-db3 v
OK
$ docker exec redis-lab redis-cli --no-raw GET chi-o-db3
(nil)                           ← đang ở db0
$ docker exec redis-lab redis-cli -n 3 --no-raw GET chi-o-db3
"v"                             ← ở db3 thì có
```

Nhìn tổng thể bằng `INFO keyspace`:

```
127.0.0.1:6379> INFO keyspace
# Keyspace
db0:keys=2,expires=0,avg_ttl=0,subexpiry=0
db3:keys=1,expires=0,avg_ttl=0,subexpiry=0
```

**Vì sao "gần như không nên dùng":** các database này dùng chung một tiến trình, một luồng, một
`maxmemory`. Chúng **không** cách ly hiệu năng. Và trong Redis Cluster thì bị cấm hẳn:

```
127.0.0.1:6379> SELECT 1
(error) ERR SELECT is not allowed in cluster mode
```

Nên nếu bạn dùng `db1` cho cache, `db2` cho queue, thì ngày chuyển sang Cluster phải viết lại hết.
Cách đúng là **dùng tiền tố khoá**: `cache:sp:1`, `queue:mail`. Xem [bài 01 mục 5](./01-string-va-key.md).

---

## 5. `INFO` — bảy con số cần biết đọc

`INFO` in ra hơn 200 dòng. Đây là những dòng thật sự được dùng khi trực sự cố.

### `INFO memory` — đang ăn bao nhiêu RAM

```
127.0.0.1:6379> INFO memory
used_memory:8302336
used_memory_human:7.92M
used_memory_rss_human:36.98M
used_memory_peak_human:135.10M
used_memory_dataset:6807128
maxmemory_policy:noeviction
mem_fragmentation_ratio:4.68
```

| Dòng | Nghĩa | Khi nào đáng lo |
|------|-------|-----------------|
| `used_memory_human` | Redis nghĩ nó đang dùng bao nhiêu | So với `maxmemory` |
| `used_memory_rss_human` | Hệ điều hành thấy tiến trình chiếm bao nhiêu | Khi RSS >> used_memory |
| `used_memory_peak_human` | Đỉnh từ lúc khởi động | Cao hơn hiện tại nhiều = từng có khoá bự |
| `mem_fragmentation_ratio` | RSS / used_memory | **> 1.5 là phân mảnh nặng** |

Ở ví dụ trên tỉ lệ là **4.68** — nhìn có vẻ thảm hoạ, nhưng đây là do vừa xoá một khoá 155 MB
(`used_memory_peak_human:135.10M` là dấu vết): hệ điều hành chưa thu hồi lại RAM đã cấp. Đó chính là
lý do cần đọc cả `peak` chứ không chỉ tỉ lệ.

### `INFO stats` — cache có hiệu quả không

```
127.0.0.1:6379> INFO stats
total_commands_processed:60005
instantaneous_ops_per_sec:21091
expired_keys:0
evicted_keys:0
keyspace_hits:20000
keyspace_misses:0
```

**Tỉ lệ trúng cache** = `keyspace_hits / (keyspace_hits + keyspace_misses)`. Dưới 80% thì cache của bạn
đang không giúp được gì nhiều — hoặc TTL quá ngắn, hoặc đang cache nhầm thứ.

`evicted_keys` khác 0 nghĩa là Redis **đang phải xoá khoá để lấy chỗ**. Nếu bạn dùng Redis làm cache
thì đó là bình thường; nếu bạn dùng làm nơi lưu session thì đó là **user bị đăng xuất ngẫu nhiên**.

### `INFO clients` — có ai đang bị chặn không

```
127.0.0.1:6379> INFO clients
connected_clients:1
maxclients:10000
blocked_clients:0
```

`blocked_clients` là số client đang nằm chờ trong `BLPOP`/`XREAD BLOCK`. Con số này lớn và không giảm
là dấu hiệu worker của bạn chết hết mà không ai xử lý hàng đợi.

### `INFO commandstats` — lệnh nào đang tốn thời gian

Bật bằng cách gõ `CONFIG RESETSTAT` để làm mới rồi chờ một lúc:

```
127.0.0.1:6379> INFO commandstats
cmdstat_get:calls=20000,usec=2195,usec_per_call=0.11,rejected_calls=0,failed_calls=0
cmdstat_set:calls=20000,usec=4163,usec_per_call=0.21,rejected_calls=0,failed_calls=0
cmdstat_incr:calls=20000,usec=2440,usec_per_call=0.12,rejected_calls=0,failed_calls=0
```

`usec_per_call` là trung bình **thời gian server bận** cho lệnh đó. Lệnh nào có `usec_per_call` cỡ
nghìn (tức 1ms+) là lệnh đang làm nghẹt server. Đây là công cụ đầu tiên nên mở khi "Redis chậm".

`failed_calls` và `rejected_calls` cũng quan trọng: `rejected_calls` cao nghĩa là client gọi sai
tham số hoặc bị ACL chặn.

---

## 6. Bốn cờ `redis-cli` dùng khi trực sự cố

### `--stat` — theo dõi realtime

```bash
$ docker exec -t redis-lab redis-cli --stat -i 1
------- data ------ --------------------- load -------------------- - child -
keys       mem      clients blocked requests            connections
3          2.81M    1       0       261523 (+0)         450
3          2.79M    1       0       261524 (+1)         450
3          2.79M    1       0       261525 (+1)         450
```

Cột `blocked` và `mem` là hai cột nên nhìn đầu tiên.

### `--latency` — đo độ trễ thật

Lệnh này gửi `PING` liên tục và in `min max avg số-mẫu`:

```bash
$ docker exec redis-lab redis-cli --latency -i 3
0.095 1.989 0.399 251
```

Bây giờ cho một client khác chạy `KEYS *` liên tục trên database 631.658 khoá, rồi đo lại:

```bash
$ docker exec redis-lab redis-cli --latency -i 3
0.060 61.957 4.328 191
```

Độ trễ **tối đa** nhảy từ 1.99ms lên **61.96ms**, trung bình từ 0.4ms lên 4.3ms. Đây là bằng chứng đo
được cho câu "đừng bao giờ chạy `KEYS` trên production".

### `MONITOR` — xem mọi lệnh đang chạy

```bash
$ docker exec redis-lab redis-cli MONITOR
OK
1787874126.043700 [0 127.0.0.1:37104] "SET" "a" "1"
1787874126.049007 [0 127.0.0.1:37120] "GET" "a"
1787874126.052050 [0 127.0.0.1:37126] "HSET" "u" "ten" "Vanson"
```

Định dạng: `timestamp [db địa-chỉ-client] "LỆNH" "tham" "số"`.

⚠️ `MONITOR` in **mọi** lệnh của **mọi** client. Trên server 100k ops/s nó tự nó làm chậm Redis và làm
ngập terminal. Chỉ bật vài giây rồi tắt, và không bao giờ để chạy nền.

### `--bigkeys` / `--memkeys` — tìm khoá bự

```bash
$ docker exec redis-lab redis-cli --bigkeys
Biggest   list found "ds-lon" has 200000 items
Biggest   hash found "hash-lon" has 100000 fields
Biggest string found "nho" has 1 bytes
```

⚠️ Bẫy: `--bigkeys` đo theo **số phần tử**, không phải byte. Ở ví dụ trên nó báo `"nho"` (1 byte) là
"biggest string" chỉ vì đó là string duy nhất. Muốn đo theo byte, dùng `--memkeys`:

```bash
$ docker exec redis-lab redis-cli --memkeys
Biggest   list found "ds-lon" has 2302175 bytes
Biggest   hash found "hash-lon" has 4950737 bytes
Biggest string found "nho" has 32 bytes
```

Cả hai cờ đều dùng `SCAN` bên dưới nên **an toàn để chạy trên production** — khác hẳn `KEYS`.

---

## 7. Bài tập

1. Dựng một Redis có volume và bật AOF. Ghi một khoá, `docker rm -f` container, dựng lại từ cùng
   volume, kiểm tra khoá còn không.
2. Nạp 100.000 khoá bằng `--pipe`, rồi đo `--latency` trong lúc chạy `KEYS *` từ một terminal khác.
   Ghi lại con số max của bạn.
3. Chạy `CONFIG RESETSTAT`, dùng app bất kỳ vài phút, rồi `INFO commandstats` — lệnh nào có
   `usec_per_call` cao nhất?
4. Tính tỉ lệ trúng cache của Redis bạn đang có bằng `INFO stats`.

<details>
<summary>Gợi ý đáp án</summary>

**1.**
```bash
$ docker volume create redis-data
$ docker run -d --name r1 -v redis-data:/data redis:8-alpine redis-server --appendonly yes
$ docker exec r1 redis-cli SET song-sot "co"
$ docker rm -f r1
$ docker run -d --name r2 -v redis-data:/data redis:8-alpine redis-server --appendonly yes
$ docker exec r2 redis-cli --no-raw GET song-sot
"co"
```
Nếu bỏ `--appendonly yes` ở **cả hai** lần chạy, khoá vẫn có thể sống sót nhờ RDB — nhưng chỉ khi bạn
dừng bằng `docker rm -f` (gửi SIGTERM, Redis kịp lưu). Với `docker kill -s KILL` thì mất. Xem
[bài 07](./07-persistence.md).

**2.** Kỳ vọng: max tăng ít nhất 10 lần. Trên máy viết tài liệu này là 1.989ms → 61.957ms.

**3.** Nếu app bạn dùng `HGETALL` trên hash lớn, đó thường là lệnh đứng đầu.

**4.** `hits / (hits + misses)`. Ví dụ `keyspace_hits:20000`, `keyspace_misses:0` → 100%, nhưng đó là vì
`redis-benchmark` chỉ đọc khoá nó vừa ghi. Số thật của app production thường 85–98%.
</details>

---

Tiếp theo: [01-string-va-key.md](./01-string-va-key.md)
