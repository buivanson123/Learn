# 10 tình huống sự cố

Dạng câu hỏi này phân biệt người **đã trực production** và người chỉ đọc tài liệu. Đọc tình huống,
**nói thành tiếng** các bước bạn sẽ làm, rồi mới mở đáp án.

Nguyên tắc chung khi trả lời: **lệnh cụ thể** → **đọc output đó ra sao** → **bước tiếp theo dựa trên kết
quả**. Không nói "em sẽ kiểm tra log".

---

## TH1 — "API chậm hẳn từ 10 phút trước, Redis nghi là thủ phạm"

<details><summary>Cách trả lời</summary>

**Bước 1 — có lệnh nào chậm không:**
```bash
$ redis-cli CONFIG SET slowlog-log-slower-than 1000
$ redis-cli SLOWLOG GET 10
```
Nhìn phần tử thứ 3 (micro giây) và thứ 4 (lệnh). Thủ phạm điển hình: `KEYS`, `HGETALL`, `SMEMBERS`,
`DEL` khoá bự, `EVAL`.

**Bước 2 — độ trễ tổng thể:**
```bash
$ redis-cli --latency -i 5
0.095 1.989 0.399 251        ← min max avg số-mẫu (ms)
```
Nếu `max` cao hơn `avg` hàng chục lần, có lệnh đang chặn định kỳ.

**Bước 3 — lệnh nào tốn nhiều thời gian server nhất về tổng thể:**
```bash
$ redis-cli INFO commandstats
cmdstat_hgetall:calls=50000,usec=4500000,usec_per_call=90.00
```
Nhân `calls × usec_per_call`. Một lệnh rẻ gọi hàng triệu lần có khi tốn hơn một lệnh đắt gọi vài lần.

**Bước 4 — có ai đang làm chuyện lạ không:**
```bash
$ redis-cli CLIENT LIST | grep -E "cmd=monitor|cmd=keys"
$ redis-cli CLIENT LIST | awk '{print $1,$17,$18,$19}' | sort -k4 -rn | head
```
`omem` lớn = client đang nhận dữ liệu khổng lồ.

**Bước 5 — có phải máy chứ không phải Redis:**
```bash
$ redis-cli --intrinsic-latency 5
$ redis-cli INFO persistence | grep -E "bgsave_in_progress|rewrite_in_progress"
```
`BGSAVE`/AOF rewrite đang chạy gây khựng do `fork` và đĩa bận.

**Câu chốt:** "Nếu slowlog trống và `--latency` đẹp thì Redis không phải thủ phạm — em quay sang đo phía
app: có phải đang `await` trong vòng lặp không? Em từng đo 1000 `GET` tuần tự mất 205ms trong khi
`MGET` chỉ 2ms."
</details>

---

## TH2 — "App báo `OOM command not allowed`, nhưng `evicted_keys` vẫn là 0"

<details><summary>Cách trả lời</summary>

**Chẩn đoán ngay:** đây là dấu hiệu đặc trưng của **một trong hai** trường hợp:

```bash
$ redis-cli CONFIG GET maxmemory-policy
```

**a) `noeviction`** — đúng như thiết kế, Redis từ chối ghi khi đầy. Nếu instance này là **cache**, đổi
sang `allkeys-lru`. Nếu là **kho dữ liệu**, đây là lúc phải tăng RAM hoặc dọn.

**b) `volatile-*` mà không khoá nào có TTL** — đây là bẫy hay gặp hơn và khó đoán hơn:
```bash
$ redis-cli INFO keyspace
db0:keys=631658,expires=0,avg_ttl=0        ← expires=0: KHÔNG khoá nào có hạn
```
`volatile-*` chỉ được xoá khoá có TTL. Không có gì để xoá → hành xử y hệt `noeviction`.

**Xử lý ngay:** `CONFIG SET maxmemory-policy allkeys-lru` để hệ thống ghi lại được.
**Xử lý gốc:** tìm đoạn code `SET` mà quên `EX`. Dùng `--memkeys` và `SCAN` để xem nhóm khoá nào không
có TTL.

**Câu chốt:** "Em đo thật cái này rồi: đặt `maxmemory 8mb` với `volatile-lru` và không khoá nào có TTL,
`redis-benchmark` dừng ngay với `OOM command not allowed` trong khi `evicted_keys` vẫn là 0."
</details>

---

## TH3 — "Sau khi deploy, user bị đăng xuất ngẫu nhiên"

<details><summary>Cách trả lời</summary>

**Giả thuyết số một: session bị eviction đá ra.**

```bash
$ redis-cli INFO stats | grep evicted_keys
evicted_keys:142778
$ redis-cli CONFIG GET maxmemory-policy
2) "allkeys-lru"
```

`allkeys-lru` **không phân biệt** session với cache — nó đá bất cứ khoá nào ít dùng gần đây. User không
hoạt động 20 phút thì session của họ là ứng viên đầu tiên.

**Ba cách xử lý, theo thứ tự ưu tiên:**
1. **Tách instance** — Redis cache (`allkeys-lru`, không persistence) và Redis session (`noeviction`,
   AOF `everysec`). Đây là cách đúng.
2. Nếu buộc phải chung: `volatile-lru` **và** bảo đảm mọi khoá cache có TTL còn session thì không —
   nhưng đây là đánh cược, xem TH2.
3. Tăng `maxmemory`.

**Giả thuyết hai:** deploy vừa rồi đổi từ `SET ... EX` sang `SET` không TTL cho một nhóm khoá nào đó →
RAM tăng vọt → eviction bắt đầu. Kiểm tra bằng cách so `used_memory_peak_human` với trước deploy.

**Giả thuyết ba:** Redis restart trong lúc deploy và không có persistence → mất sạch session một lần.
Kiểm tra `uptime_in_seconds` trong `INFO server`.
</details>

---

## TH4 — "Database bị quá tải, nhưng cache hit rate vẫn 95%"

<details><summary>Cách trả lời</summary>

95% nghe rất tốt, nhưng 5% miss của **một khoá cực nóng** đủ giết database.

**Giả thuyết 1 — cache stampede.** Một khoá nóng hết hạn, hàng nghìn request cùng trượt và cùng đâm vào
DB. Dấu hiệu: tải DB tăng vọt theo **chu kỳ** đúng bằng TTL.
Sửa: khoá `SET NX` cho việc nạp cache. Em đo được 100 request đồng thời → 100 lần chạm DB, có khoá thì
còn 1.

**Giả thuyết 2 — cache avalanche.** Nhiều khoá cùng hết hạn một lúc (warm cache lúc deploy với TTL cố
định). Dấu hiệu: tải tăng vọt **một lần** đúng N giây sau deploy.
Sửa: thêm nhiễu ngẫu nhiên vào TTL.

**Giả thuyết 3 — xuyên cache.** Ai đó bắn id không tồn tại. Dấu hiệu: `keyspace_misses` tăng nhanh nhưng
`DBSIZE` không tăng.
Sửa: cache cả kết quả rỗng với TTL 30 giây. Em đo được 200 request → 200 lần chạm DB, cache null thì
còn 1.

**Cách phân biệt nhanh:** vẽ đồ thị `keyspace_misses` theo thời gian. Chu kỳ đều = stampede; một đỉnh
nhọn = avalanche; tăng tuyến tính không giảm = xuyên cache.
</details>

---

## TH5 — "Redis đầy đĩa, app không ghi được gì nhưng đọc vẫn bình thường"

<details><summary>Cách trả lời</summary>

**Lỗi bạn sẽ thấy:**
```
(error) MISCONF Redis is configured to save RDB snapshots, but it is currently not able to persist on
disk. Commands that may modify the data set are disabled...
```

**Nguyên nhân:** `BGSAVE` thất bại (99% là đầy đĩa) và `stop-writes-on-bgsave-error yes` (mặc định).

**Chẩn đoán:**
```bash
$ df -h                       # phân vùng chứa `dir` của Redis
$ redis-cli CONFIG GET dir
$ redis-cli INFO persistence | grep -E "rdb_last_bgsave_status|aof_last_write_status"
rdb_last_bgsave_status:err
```

**Xử lý theo thứ tự:**
1. Dọn đĩa — thường là log, hoặc file RDB/AOF cũ, hoặc `docker system prune` nếu là máy chạy container.
2. Nếu cần cho hệ thống ghi lại **ngay** trong lúc chưa dọn xong:
   `CONFIG SET stop-writes-on-bgsave-error no` — nhưng phải nói rõ: **đang cố ý chấp nhận mất dữ liệu**,
   và phải bật lại sau.
3. Kiểm tra `du -sh` thư mục `dir` — nếu AOF phình to bất thường thì chạy `BGREWRITEAOF`.

**Phòng ngừa:** gắn alert cho `rdb_last_bgsave_status` và `aof_last_write_status` khác `"ok"`, và alert
dung lượng đĩa ở 80%.
</details>

---

## TH6 — "Redis vừa restart, mất sạch dữ liệu"

<details><summary>Cách trả lời</summary>

**Câu hỏi đầu tiên: nó chết thế nào?**

```bash
$ docker inspect redis --format '{{.State.ExitCode}}'
137                           ← 128+9 = SIGKILL: OOM killer hoặc kill -9
0                             ← thoát bình thường (SIGTERM)
```

**Nếu exit code 137:** OOM killer giết. Nguyên nhân là **không đặt `maxmemory`**, hoặc đặt cao hơn giới
hạn container. Đặt `maxmemory` ở ~70% RAM khả dụng — chừa chỗ cho `fork()` khi `BGSAVE` và cho phân mảnh.

**Nếu exit code 0 mà vẫn mất dữ liệu:** kiểm tra volume. Không mount `/data` thì mọi file nằm trong lớp
ghi của container và bay theo `docker rm`.

**Vì sao mất dù có RDB — đo thật:**
```
CONFIG GET save → "3600 1 300 100 60 10000"
```
Lưu nếu 3600 giây có ≥1 thay đổi, hoặc 300 giây có ≥100, hoặc 60 giây có ≥10000. Ghi vài khoá rồi bị
`kill -9` thì chưa chạm điều kiện nào → **mất trắng**.

Em đo cả ba trường hợp:
```
Mặc định + kill -9        → GET trả (nil), DBSIZE 0        ← mất trắng
Mặc định + docker stop    → dữ liệu còn (log: "Saving the final RDB snapshot before exiting")
--appendonly yes + kill -9 → dữ liệu còn
```

**Xử lý:** bật AOF `everysec` (mất tối đa 1 giây), mount volume, đặt `maxmemory`. Và trong Kubernetes,
tăng `terminationGracePeriodSeconds` để pod không bị `SIGKILL` giữa lúc đang lưu.
</details>

---

## TH7 — "Sau failover, app báo `READONLY You can't write against a read only replica`"

<details><summary>Cách trả lời</summary>

**Nguyên nhân:** app đang nối tới một node giờ đã là **replica**. Sentinel đã đổi master nhưng app không
biết — thường vì IP master được hardcode trong config.

**Chẩn đoán:**
```bash
$ redis-cli -h <ip-app-đang-nối> INFO replication | head -3
role:slave
master_host:172.19.0.4

$ redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
1) "172.19.0.4"
2) "6379"                     ← master THẬT
```

**Xử lý ngay:** trỏ app sang IP master mới, restart app.

**Xử lý gốc:** client phải **hỏi Sentinel** thay vì hardcode:
```js
new Redis({
  sentinels: [{host:'s1',port:26379},{host:'s2',port:26379},{host:'s3',port:26379}],
  name: 'mymaster',
});
```

**Bổ sung ăn điểm:** "Failover mất khoảng 5 giây trên hệ em đo — `down-after-milliseconds 3000` cộng
~2.3 giây để bầu và chuyển. Trong khoảng đó mọi lệnh **ghi** thất bại, nên client cũng cần retry, không
chỉ cần biết địa chỉ mới."

**Kiểm tra thêm:** nếu app dùng replica để **đọc** nhằm giảm tải master, phải chắc chắn code không vô
tình gửi lệnh ghi xuống đó — `INCR` để đếm view cũng là lệnh ghi.
</details>

---

## TH8 — "Chuyển từ một node sang Cluster, code hỏng hàng loạt"

<details><summary>Cách trả lời</summary>

**Bốn lỗi sẽ gặp, theo thứ tự phổ biến:**

**1. `CROSSSLOT`**
```
(error) CROSSSLOT Keys in request don't hash to the same slot
```
Mọi lệnh nhiều khoá: `MGET`, `MSET`, `SINTER`, `ZUNIONSTORE`, `RENAME`, `MULTI` nhiều khoá, và **Lua
script**. Sửa bằng hash tag `{...}` để ép cùng slot, hoặc tách thành nhiều lệnh.

**2. `MOVED`**
```
(error) MOVED 10778 172.19.0.3:6379
```
Client chưa ở chế độ cluster. Sửa: `new Redis.Cluster([...])` thay vì `new Redis(...)`.

**3. `ERR SELECT is not allowed in cluster mode`**
Nếu code dùng `db1` cho cache và `db2` cho queue thì phải viết lại thành tiền tố khoá.

**4. Lua script hỏng vì tên khoá nằm ở `ARGV`.** Chạy được ở standalone (Redis không kiểm tra) nhưng
Cluster từ chối vì không định tuyến được. Sửa: mọi tên khoá phải ở `KEYS`.

**Ngoài ra:** Pub/Sub thường phát tán tới mọi node — đổi sang `SPUBLISH`/`SSUBSCRIBE`. Và `KEYS`/`SCAN`
chỉ trả khoá của node đang nối.

**Câu chốt ăn điểm:** "Trước khi chuyển, em sẽ hỏi lại **có thật sự cần Cluster không**. Em đo một node
Redis 8 xử lý 178 nghìn lệnh/giây không pipeline và hơn 2 triệu khi có pipeline. Nếu vấn đề chỉ là RAM
thì tăng RAM rẻ hơn nhiều so với gánh mọi ràng buộc trên."
</details>

---

## TH9 — "Mọi lệnh trả về `BUSY Redis is busy running a script`"

<details><summary>Cách trả lời</summary>

**Nguyên nhân:** một script Lua chạy quá `busy-reply-threshold` (mặc định 5000ms). Redis một luồng nên
không phục vụ được gì khác.

**Xử lý:**
```
127.0.0.1:6379> SCRIPT KILL
OK
```

**Nhưng nếu script đã ghi dữ liệu:**
```
(error) UNKILLABLE Sorry the script already executed write commands against the dataset. You can either
wait the script termination or kill the server in a hard way using the SHUTDOWN NOSAVE command.
```
Lúc đó chỉ còn hai lựa chọn: **chờ**, hoặc `SHUTDOWN NOSAVE` (mất mọi dữ liệu chưa lưu xuống đĩa). Nếu
có AOF `everysec` thì mất tối đa 1 giây — đây chính là lúc persistence chứng minh giá trị.

**Tìm thủ phạm sau khi cứu xong:**
```bash
$ redis-cli SLOWLOG GET 5      # bản ghi EVAL sẽ nằm đó với thời gian rất lớn
```
Thông báo lỗi ném về client gọi script cũng chứa SHA:
`ERR Script killed by user with SCRIPT KILL... script: 42b3a52c5677...`

**Phòng ngừa:** script Lua phải ngắn và có giới hạn vòng lặp. Đừng viết vòng lặp chạy trên dữ liệu có
kích thước không kiểm soát được (`for i, k in ipairs(redis.call('KEYS', '*'))` là công thức tự sát).

**Số đo mang đi phỏng vấn:** "Em đo được `GET` từ 1ms lên 1431ms chỉ vì một script Lua đang chạy — đó là
minh hoạ rõ nhất cho việc Redis một luồng."
</details>

---

## TH10 — "Redis phình từ 2 GB lên 12 GB trong một tuần, không ai đổi gì"

<details><summary>Cách trả lời</summary>

**Bước 1 — có khoá nào có TTL không:**
```bash
$ redis-cli INFO keyspace
db0:keys=8452113,expires=120,avg_ttl=0
```
8.4 triệu khoá mà chỉ 120 khoá có hạn → gần như chắc chắn có đoạn code `SET` quên `EX`.

**Bước 2 — khoá bự hay nhiều khoá nhỏ:**
```bash
$ redis-cli --memkeys
```
Nếu có một hai khoá chiếm phần lớn → khoá bự. Nếu phân bố đều → rò rỉ số lượng khoá.

**Bước 3 — nhóm khoá nào phình:**
```bash
$ redis-cli --scan --pattern 'cache:*' | wc -l
$ redis-cli --scan --pattern 'bull:*'  | wc -l
$ redis-cli --scan --pattern 'session:*' | wc -l
```
`--scan` an toàn trên production (dùng `SCAN` bên dưới), khác `KEYS`.

**Ba thủ phạm phổ biến nhất, theo thứ tự:**
1. **BullMQ không `removeOnComplete`** — mọi job đã xong nằm lại vĩnh viễn. Sửa:
   `{ removeOnComplete: 1000, removeOnFail: 5000 }`.
2. **List không `LTRIM`** — "hoạt động gần nhất" lớn vô hạn. Sửa: `LTRIM key 0 99` sau mỗi `LPUSH`.
3. **Stream không `MAXLEN`** — Stream **không tự xoá**. Sửa: `XADD ... MAXLEN ~ 100000 *`.

**Bước 4 — dọn an toàn:**
```js
let cursor = '0';
do {
  const [c, keys] = await r.scan(cursor, 'MATCH', 'cache:cu:*', 'COUNT', 500);
  cursor = c;
  if (keys.length) await r.unlink(...keys);      // UNLINK, không DEL
} while (cursor !== '0');
```

Dùng `UNLINK` — em đo `DEL` một hash 3 triệu trường treo server **239ms**, `UNLINK` thì không lọt slowlog.

**Phòng ngừa:** dùng ACL chặn `KEYS`/`FLUSHALL` trên production, và gắn alert cho `used_memory` ở 80%
`maxmemory` cùng `expires` trong `INFO keyspace`.
</details>

---

## Ba câu hỏi ngược nên hỏi lại người phỏng vấn

Khi họ đưa tình huống, hỏi lại trước khi trả lời — điều này cho thấy bạn quen quy trình xử lý sự cố thật:

1. **"Redis này đang dùng làm gì — cache thuần, session, hay hàng đợi?"** Câu trả lời đổi hoàn toàn
   hướng xử lý (được phép mất dữ liệu hay không).
2. **"Có gì thay đổi gần đây không — deploy, tăng traffic, đổi cấu hình?"** 80% sự cố có nguyên nhân từ
   một thay đổi.
3. **"Hệ thống đang một node, có replica, hay Cluster?"** Quyết định việc có thể failover hay không.

---

Tiếp theo: [04-tu-kiem-tra.md](./04-tu-kiem-tra.md)
