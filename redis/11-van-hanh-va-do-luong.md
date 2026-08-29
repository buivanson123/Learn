# Bài 11 — Vận hành: đo lường, bảo mật, sự cố

Bài này là bộ công cụ để trả lời câu "Redis đang chậm, bạn làm gì?" — câu hỏi phỏng vấn phân biệt người
đã trực production và người chưa.

---

## 1. `SLOWLOG` — mở đầu tiên khi Redis chậm

```
127.0.0.1:6379> CONFIG GET slowlog-log-slower-than
1) "slowlog-log-slower-than"
2) "10000"                      ← micro giây, tức 10ms
127.0.0.1:6379> CONFIG GET slowlog-max-len
2) "128"                        ← chỉ giữ 128 bản ghi gần nhất
```

Ngưỡng mặc định 10ms là **quá cao** cho Redis. Hạ xuống 1ms trên production:

```
127.0.0.1:6379> CONFIG SET slowlog-log-slower-than 1000
OK
127.0.0.1:6379> CONFIG SET slowlog-max-len 1024
OK
```

Đọc:

```
127.0.0.1:6379> SLOWLOG GET 3
1) 1) (integer) 0               ← id
   2) (integer) 1787873334      ← thời điểm (Unix)
   3) (integer) 151167          ← thời gian THỰC THI, micro giây → 151ms
   4) 1) "KEYS"
      2) "*"                    ← lệnh và tham số
   5) "127.0.0.1:32836"         ← client
   6) ""                        ← tên client (CLIENT SETNAME)
   7) (integer) 2
127.0.0.1:6379> SLOWLOG LEN
(integer) 20
127.0.0.1:6379> SLOWLOG RESET
OK
```

⚠️ **Con số ở phần tử 3 chỉ tính thời gian THỰC THI**, không tính thời gian chờ trong hàng đợi và không
tính truyền dữ liệu qua mạng. Một lệnh chậm 151ms làm *mọi* lệnh sau nó chờ 151ms, nhưng những lệnh đó
**không** xuất hiện trong slowlog. Nghĩa là: slowlog cho biết **thủ phạm**, không cho biết **nạn nhân**.

Đặt tên cho client để biết đoạn code nào gây ra:

```js
new Redis({ host, port, connectionName: 'api-san-pham' });
```

Tên đó hiện ở phần tử 6 của slowlog và ở `CLIENT LIST`.

---

## 2. Đo độ trễ

```bash
$ redis-cli --latency -i 3
0.095 1.989 0.399 251
       ↑     ↑     ↑    ↑
      min   max   avg  số mẫu     (đơn vị: mili giây)
```

Cùng lệnh đó, trong lúc một client khác chạy `KEYS *` trên 631.658 khoá:

```bash
$ redis-cli --latency -i 3
0.060 61.957 4.328 191
```

Max từ 1.99ms → **61.96ms**, avg từ 0.4ms → 4.33ms. Đây là con số nên mang đi phỏng vấn.

Các cờ khác:

```bash
$ redis-cli --latency-history -i 5      # in liên tục mỗi 5 giây, thấy xu hướng
$ redis-cli --latency-dist              # biểu đồ phân bố
$ redis-cli --intrinsic-latency 5       # đo độ trễ CỦA MÁY, không phải của Redis
```

`--intrinsic-latency` quan trọng khi nghi ngờ máy chủ: nếu chính hệ điều hành đã có latency 5ms thì
Redis không thể nhanh hơn thế, và vấn đề nằm ở máy (máy ảo bị chia CPU, transparent huge pages) chứ
không ở Redis.

`LATENCY` monitor tích hợp:

```
127.0.0.1:6379> CONFIG SET latency-monitor-threshold 100
OK
127.0.0.1:6379> LATENCY LATEST
127.0.0.1:6379> LATENCY RESET
```

Nó ghi lại **nguyên nhân** (`fork`, `expire-cycle`, `command`, `aof-write`) chứ không chỉ con số — hữu
ích khi khựng có chu kỳ.

---

## 3. `INFO commandstats` — lệnh nào tốn thời gian

```
127.0.0.1:6379> CONFIG RESETSTAT
OK
   (chờ vài phút cho app chạy)
127.0.0.1:6379> INFO commandstats
cmdstat_get:calls=20000,usec=2195,usec_per_call=0.11,rejected_calls=0,failed_calls=0
cmdstat_set:calls=20000,usec=4163,usec_per_call=0.21,rejected_calls=0,failed_calls=0
cmdstat_incr:calls=20000,usec=2440,usec_per_call=0.12,rejected_calls=0,failed_calls=0
```

Nhân `calls × usec_per_call` để biết lệnh nào **chiếm nhiều thời gian server nhất về tổng thể** — có khi
một lệnh rẻ nhưng gọi hàng triệu lần còn tốn hơn một lệnh đắt gọi vài lần.

Kèm phân vị:

```
127.0.0.1:6379> INFO latencystats
latency_percentiles_usec_get:p50=0.001,p99=1.003,p99.9=5.023
```

p99.9 của `GET` là 5ms trong khi p50 là ~0 — chênh lệch đó là dấu hiệu có lệnh nào khác đang chặn.

---

## 4. Danh sách kiểm tra khi "Redis chậm"

Theo đúng thứ tự:

```bash
# 1. Có lệnh nào chậm không?
$ redis-cli SLOWLOG GET 10

# 2. Độ trễ tổng thể bao nhiêu?
$ redis-cli --latency -i 5

# 3. Bộ nhớ có đang đầy / có đang evict không?
$ redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human|mem_fragmentation_ratio"
$ redis-cli INFO stats  | grep -E "evicted_keys|expired_keys"

# 4. Có khoá bự không?
$ redis-cli --memkeys

# 5. Có client nào bất thường không? (đệm output lớn = đang đọc dữ liệu khổng lồ)
$ redis-cli CLIENT LIST | awk '{print $1, $17, $18, $19}' | sort -k4 -rn | head

# 6. Có ai đang chạy MONITOR / KEYS / lệnh nặng không?
$ redis-cli CLIENT LIST | grep -E "cmd=monitor|cmd=keys"

# 7. Máy có vấn đề không?
$ redis-cli --intrinsic-latency 5
$ redis-cli INFO persistence | grep -E "rdb_bgsave_in_progress|aof_rewrite_in_progress"
```

Bước 7 hay bị bỏ qua: `BGSAVE` hoặc AOF rewrite đang chạy sẽ gây khựng do `fork` và do đĩa bận.

Đọc `CLIENT LIST`:

```
id=2219 addr=127.0.0.1:40266 name= age=0 idle=0 flags=N db=0 sub=0 psub=0 multi=-1 watch=0
qbuf=26 qbuf-free=20448 argv-mem=10 rbs=16384 obl=0 oll=0 omem=0 tot-mem=38170
events=r cmd=client|list user=default resp=2 lib-name= lib-ver= tot-net-in=26 tot-net-out=0
```

| Trường | Đáng lo khi |
|---|---|
| `omem` | Lớn — client đang nhận dữ liệu khổng lồ (`SMEMBERS` một set triệu phần tử?) |
| `qbuf` | Lớn — client đang gửi lệnh khổng lồ |
| `age` với `idle` cao | Kết nối chết chưa được dọn |
| `cmd=monitor` | Có người quên tắt `MONITOR` |
| `multi=<số>` | Client đang giữ transaction dở |

Giết client có vấn đề:

```
127.0.0.1:6379> CLIENT KILL ID 2219
127.0.0.1:6379> CLIENT NO-EVICT on          ← bảo vệ client quản trị khi bộ nhớ đầy
```

---

## 5. Chỉ số cần gắn cảnh báo

| Chỉ số | Nguồn | Ngưỡng |
|---|---|---|
| `used_memory` / `maxmemory` | `INFO memory` | > 80% |
| `evicted_keys` (tốc độ tăng) | `INFO stats` | > 0 trên instance lưu session |
| Tỉ lệ trúng cache | `keyspace_hits/(hits+misses)` | < 80% |
| `blocked_clients` | `INFO clients` | Tăng và không giảm |
| `connected_clients` / `maxclients` | `INFO clients` | > 80% |
| `rdb_last_bgsave_status` | `INFO persistence` | ≠ `ok` |
| `aof_last_write_status` | `INFO persistence` | ≠ `ok` |
| `master_link_status` | `INFO replication` (replica) | ≠ `up` |
| `mem_fragmentation_ratio` | `INFO memory` | > 1.5 hoặc < 1.0 |
| Số bản ghi slowlog mới | `SLOWLOG LEN` | Tăng nhanh |
| `lag` của consumer group | `XINFO GROUPS` | Tăng liên tục |

Công cụ: `redis_exporter` cho Prometheus lấy hết các chỉ số này.

---

## 6. Bảo mật

### Redis **không** an toàn khi mở ra Internet

```
127.0.0.1:6379> CONFIG GET requirepass
1) "requirepass"
2) ""                           ← KHÔNG có mật khẩu
127.0.0.1:6379> CONFIG GET protected-mode
2) "no"                         ← trong container mặc định thường là no
```

Redis không mật khẩu, mở cổng 6379 ra Internet, bị quét và chiếm trong vài phút — kẻ tấn công dùng
`CONFIG SET dir` + `CONFIG SET dbfilename` để ghi khoá SSH vào `~/.ssh/authorized_keys`. Đây là lỗ hổng
được khai thác hàng loạt, không phải giả thuyết.

Bốn việc bắt buộc:

1. **Bind vào mạng nội bộ.** Trong Docker Compose, **đừng** `ports: - "6379:6379"` nếu chỉ app trong
   cùng network dùng — bỏ hẳn khối `ports` là Redis không lộ ra máy chủ.
2. **Đặt mật khẩu mạnh** (`requirepass`) — Redis xử lý ~180k lệnh/giây nên brute force rất nhanh.
3. **Đổi tên hoặc chặn lệnh nguy hiểm.**
4. **Bật TLS** nếu đi qua mạng không tin cậy.

### ACL — phân quyền theo user (Redis 6+)

```
127.0.0.1:6379> ACL WHOAMI
"default"
127.0.0.1:6379> ACL LIST
1) "user default on nopass sanitize-payload ~* &* +@all"
```

`nopass ~* &* +@all` = không mật khẩu, truy cập mọi khoá, mọi kênh, mọi lệnh. Tạo user hạn chế:

```
127.0.0.1:6379> ACL SETUSER app on >matkhau123 ~cache:* +get +set +del
OK
127.0.0.1:6379> ACL LIST
1) "user app on sanitize-payload #fc8d5c17ee6b... ~cache:* resetchannels -@all +get +set +del"
```

Đọc cú pháp: `on` = bật, `>mật-khẩu`, `~cache:*` = chỉ khoá khớp mẫu này, `+get +set +del` = chỉ ba
lệnh này (`-@all` bị thêm ngầm).

Thử bằng user đó:

```bash
$ redis-cli --user app --pass matkhau123 SET cache:x 1
OK
$ redis-cli --user app --pass matkhau123 SET khac:x 1
(error) NOPERM No permissions to access a key
$ redis-cli --user app --pass matkhau123 FLUSHALL
(error) NOPERM User app has no permissions to run the 'flushall' command
$ redis-cli --user app --pass matkhau123 KEYS "*"
(error) NOPERM User app has no permissions to run the 'keys' command
```

Ba lệnh cuối bị chặn đúng như mong muốn. Đây là cách tốt nhất để **ngăn `KEYS`, `FLUSHALL`, `CONFIG`
xuất hiện trong production** — hiệu quả hơn nhắc nhở trong code review.

Mẫu ACL nên dùng:

```
ACL SETUSER app on >MAT_KHAU_DAI ~cache:* ~session:* +@read +@write +@string +@hash +@list +@set +@sortedset -@dangerous
ACL SETUSER doc-only on >MK ~* +@read
```

Lưu vào file để sống qua restart:

```
127.0.0.1:6379> ACL SAVE            (cần cấu hình aclfile)
```

### Chặn lệnh nguy hiểm bằng rename

```
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command KEYS ""
rename-command CONFIG "CONFIG_b7f2c1a9"
rename-command DEBUG ""
```

Chuỗi rỗng = vô hiệu hoá hẳn. Cách này cũ hơn ACL nhưng vẫn dùng được và đơn giản hơn.

Lưu ý: `DEBUG` mặc định đã bị hạn chế trong Redis 8 — chỉ chạy được từ kết nối local:

```
(error) ERR DEBUG command not allowed. If the enable-debug-command option is set to "local", you can
run it from a local connection, otherwise you need to set this option in the configuration file...
```

---

## 7. Cấu hình production tối thiểu

```conf
# --- Mạng & bảo mật ---
bind 10.0.0.5 127.0.0.1
protected-mode yes
requirepass DAT_MAT_KHAU_DAI_O_DAY
rename-command FLUSHALL ""
rename-command KEYS ""

# --- Bộ nhớ ---
maxmemory 4gb                     # ~70% RAM máy
maxmemory-policy allkeys-lru      # cache thuần; đổi thành noeviction nếu là kho dữ liệu
maxmemory-samples 5

# --- Bền dữ liệu (cache thuần thì để save "" và appendonly no) ---
appendonly yes
appendfsync everysec
stop-writes-on-bgsave-error yes

# --- Tránh khựng vì khoá bự ---
lazyfree-lazy-expire yes
lazyfree-lazy-eviction yes
lazyfree-lazy-server-del yes
lazyfree-lazy-user-del yes

# --- Quan sát ---
slowlog-log-slower-than 1000
slowlog-max-len 1024
latency-monitor-threshold 100

# --- Nhân bản ---
repl-backlog-size 64mb            # mặc định 1mb là quá nhỏ
min-replicas-to-write 1
min-replicas-max-lag 10

# --- Kết nối ---
timeout 300
tcp-keepalive 300
```

Ở tầng hệ điều hành (Linux):

```bash
$ sysctl -w vm.overcommit_memory=1        # để fork() không thất bại khi BGSAVE
$ echo never > /sys/kernel/mm/transparent_hugepage/enabled   # THP gây khựng lớn
$ sysctl -w net.core.somaxconn=511
```

Redis in cảnh báo trong log nếu thiếu hai cái đầu — đọc log lúc khởi động là cách rẻ nhất để phát hiện.

---

## 8. Bài tập

1. Hạ `slowlog-log-slower-than` xuống 1000, chạy `KEYS *` trên database 500k khoá, và đọc bản ghi
   slowlog. Con số micro giây của bạn là bao nhiêu?
2. Đo `--latency` khi rảnh và khi có người chạy `KEYS *`. Ghi lại cả hai bộ số.
3. Tạo user ACL chỉ có quyền `+get +set` trên `~cache:*`, rồi thử `FLUSHALL`, `KEYS`, và `SET khac:x`.
   Ghi lại đúng ba thông báo lỗi.
4. Viết file `redis.conf` production cho một dịch vụ **lưu session** (không phải cache) — khác gì so với
   mục 7?
5. Chạy `redis-cli --intrinsic-latency 5` trên máy bạn. Con số đó có nhỏ hơn `--latency` không? Nếu
   không, vấn đề nằm ở đâu?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Trên máy viết tài liệu này, 631.658 khoá → `151167` micro giây = 151ms.

**3.**
```
(error) NOPERM No permissions to access a key
(error) NOPERM User app has no permissions to run the 'flushall' command
(error) NOPERM User app has no permissions to run the 'keys' command
```
Để ý thông báo cho khoá và cho lệnh khác nhau — cái đầu không nói tên khoá (cố ý, để không rò rỉ thông
tin).

**4.** Ba thay đổi bắt buộc: `maxmemory-policy noeviction` (**không** được đá session ra), `appendonly
yes` + `appendfsync everysec` (mất session = user bị đăng xuất), và tách hẳn instance khỏi cache. Nếu
buộc phải chung một instance thì dùng `volatile-lru` và bảo đảm **mọi** khoá cache có TTL — nhưng đó là
đánh cược, xem bẫy ở [bài 09 mục 2C](./09-bo-nho-va-eviction.md).

**5.** `--intrinsic-latency` phải nhỏ hơn nhiều. Nếu nó xấp xỉ `--latency`, Redis không phải thủ phạm —
vấn đề ở máy: CPU bị chia sẻ (máy ảo "burstable"), transparent huge pages, hoặc swap.
</details>

---

Tiếp theo: [12-loi-thuong-gap.md](./12-loi-thuong-gap.md)
