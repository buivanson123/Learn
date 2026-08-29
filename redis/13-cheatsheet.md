# Bài 13 — Cheatsheet

Tra cứu nhanh. Mọi output đo trên Redis 8.10.0.

---

## Dựng và kết nối

```bash
docker run -d --name redis-lab -p 6379:6379 redis:8-alpine
docker run -d --name redis-lab -v redis-data:/data redis:8-alpine \
  redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru

docker exec -it redis-lab redis-cli            # tương tác
docker exec redis-lab redis-cli --no-raw GET k # một lệnh, giữ định dạng "…"/(nil)/(integer)
redis-cli -h host -p 6379 -a mk -n 3           # từ xa, db 3
redis-cli -c                                   # chế độ cluster (đi theo MOVED)
```

---

## String

| Lệnh | Ghi chú |
|---|---|
| `SET k v` | ⚠️ **xoá TTL** |
| `SET k v EX 60` / `PX 60000` | Đặt TTL |
| `SET k v NX` | Chỉ ghi nếu chưa có → nền tảng khoá phân tán |
| `SET k v XX` | Chỉ ghi nếu đã có |
| `SET k v KEEPTTL` | Giữ TTL cũ |
| `SET k v GET` | Trả giá trị cũ rồi ghi |
| `GET k` / `MGET k1 k2` | `MGET` trả `(nil)` đúng vị trí khoá thiếu |
| `MSET k1 v1 k2 v2` | |
| `GETDEL k` / `GETEX k PERSIST` | Lấy rồi xoá / lấy rồi bỏ hạn |
| `INCR` `DECR` `INCRBY` `INCRBYFLOAT` | Nguyên tử. Giữ TTL |
| `APPEND` `STRLEN` `GETRANGE` `SETRANGE` | Giữ TTL. `APPEND` biến `embstr` → `raw` |

---

## List

| Lệnh | O() | Ghi chú |
|---|---|---|
| `LPUSH` `RPUSH` `LPOP` `RPOP` | O(1) | |
| `LRANGE k 0 -1` | **O(N)** | Lấy hết — nguy hiểm trên list lớn |
| `LLEN` | O(1) | |
| `LINDEX` `LSET` `LREM` | **O(N)** | List không phải mảng |
| `LTRIM k 0 99` | O(N) | **Bắt buộc** để list không lớn vô hạn |
| `BLPOP k 0` | | Chờ vô hạn. Trả `["tên khoá","giá trị"]`. Chiếm trọn kết nối |
| `LMOVE src dst LEFT RIGHT` | O(1) | Chuyển việc nguyên tử → hàng đợi tin cậy |
| `LMPOP 2 k1 k2 LEFT COUNT 2` | | Lấy từ khoá đầu tiên không rỗng |

---

## Hash

| Lệnh | Ghi chú |
|---|---|
| `HSET k f v [f v ...]` | |
| `HGET` `HMGET` `HDEL` `HLEN` `HEXISTS` | |
| `HGETALL` | **O(N)** — trả mảng phẳng; client Node gộp thành object |
| `HINCRBY` `HINCRBYFLOAT` | Nguyên tử |
| `HKEYS` `HVALS` `HRANDFIELD k 2` | |
| `HSCAN k 0 COUNT 100` | Duyệt hash lớn an toàn |
| `HEXPIRE k 60 FIELDS 1 f1` | TTL cho **từng trường** (7.4+) |
| `HTTL k FIELDS 1 f1` / `HPERSIST` | |

---

## Set

| Lệnh | Ghi chú |
|---|---|
| `SADD k a b c` | Trả về **số phần tử mới** — dùng để biết "đã like chưa" |
| `SISMEMBER` / `SMISMEMBER k a b` | O(1) |
| `SCARD` | O(1) |
| `SMEMBERS` | **O(N)** — dùng `SSCAN` thay |
| `SINTER` `SUNION` `SDIFF` (+`STORE`) | |
| `SINTERCARD 2 k1 k2 LIMIT 1` | Chỉ đếm, có thể dừng sớm |
| `SPOP` / `SRANDMEMBER k 2` | Xoá / không xoá |

---

## Sorted Set

| Lệnh | Ghi chú |
|---|---|
| `ZADD k 100 a` | `NX`/`XX`/`GT`/`LT` để ghi có điều kiện |
| `ZINCRBY k 50 a` | O(log N) — cộng điểm và sắp xếp lại |
| `ZRANGE k 0 -1 [WITHSCORES]` | Tăng dần |
| `ZREVRANGE k 0 9 WITHSCORES` | **Top 10** |
| `ZSCORE` `ZRANK` `ZREVRANK` `ZCARD` `ZCOUNT` | Hạng đếm từ **0** |
| `ZRANGEBYSCORE k 150 300` | Việc hẹn giờ: điểm = thời điểm chạy |
| `ZREMRANGEBYSCORE k 0 <now-window>` | Rate limit cửa sổ trượt |
| `ZRANGEBYLEX k [a (b` | Chỉ đúng khi **mọi** điểm bằng nhau |
| `ZUNIONSTORE` `ZDIFF` `ZRANGESTORE` | Điểm của phần tử trùng được **cộng** |

---

## Khoá

```
EXISTS k        TYPE k         DEL k (O(N), chặn)     UNLINK k (nền — dùng cái này)
RENAME k k2     COPY k k2      RANDOMKEY              DBSIZE
SCAN 0 MATCH "cache:*" COUNT 500      ← thay cho KEYS
```

`DEL` vs `UNLINK` trên hash 3 triệu trường (155 MB): **239ms** vs không lọt slowlog.

---

## TTL

```
EXPIRE k 60 [NX|XX|GT|LT]     PEXPIRE k 60000      EXPIREAT k 1900000000
TTL k    PTTL k    EXPIRETIME k    PERSIST k
```

| `TTL` trả về | Nghĩa |
|---|---|
| `n > 0` | còn n giây |
| `-1` | có khoá, **không hạn** |
| `-2` | **không có khoá** |

**Xoá TTL:** `SET` (không cờ), `GETSET`, `PERSIST`.
**Giữ TTL:** `SET…KEEPTTL`, `APPEND`, `SETRANGE`, `INCR`, `RENAME`, `COPY`, mọi lệnh `HSET`/`LPUSH`/`SADD`/`ZADD`.

---

## Transaction & Lua

```
MULTI / EXEC / DISCARD / WATCH k / UNWATCH
EVAL "<script>" <numkeys> <keys...> <argv...>
SCRIPT LOAD "<script>"  →  EVALSHA <sha> <numkeys> ...
FUNCTION LOAD ... / FCALL <ten> <numkeys> ...
SCRIPT KILL              ← khi nhận BUSY
```

- `EXEC` trả `(nil)` = `WATCH` bị đụng, phải thử lại.
- `MULTI` **không rollback** khi lỗi kiểu lúc chạy.
- Lua: `return 3.9` → `(integer) 3`. `return {1,nil,3}` → chỉ `1`.
- Tên khoá phải nằm ở `KEYS`, không phải `ARGV` (nếu không sẽ hỏng trên Cluster).

**Khoá phân tán:**
```
SET lock:x <token> NX EX 30
EVAL "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end" 1 lock:x <token>
```

---

## Pub/Sub & Stream

```
PUBLISH kenh "msg"        → số subscriber nhận được; 0 = tin MẤT
SUBSCRIBE / PSUBSCRIBE / SSUBSCRIBE (cluster)
PUBSUB CHANNELS / NUMSUB kenh

XADD s * f v              XADD s MAXLEN ~ 100000 * f v
XLEN / XRANGE s - + / XTRIM s MAXLEN 1000
XGROUP CREATE s nhom 0 MKSTREAM
XREADGROUP GROUP nhom w1 COUNT 10 BLOCK 5000 STREAMS s >     ← '>' tin mới, '0' tin chưa ACK của mình
XACK s nhom <id>
XPENDING s nhom [- + 10]
XAUTOCLAIM s nhom w3 60000 0
XINFO STREAM s / XINFO GROUPS s      ← trường `lag` là chỉ số cần cảnh báo
```

---

## Bitmap / HLL / Geo

```
SETBIT k 100 1 / GETBIT / BITCOUNT / BITOP AND dest k1 k2
PFADD k a b c / PFCOUNT k / PFMERGE dest k1 k2
GEOADD k <kinh độ> <vĩ độ> "tên"      ← LONGITUDE TRƯỚC
GEODIST k a b km / GEOSEARCH k FROMLONLAT 105.85 21.03 BYRADIUS 2 km ASC WITHDIST
```

Đo thật, 100.000 phần tử: HyperLogLog **14.357 byte** (sai số 0.275%) vs Set **4.261.838 byte**.
Bitmap 900k/1tr online: 131.093 byte vs Set 29.877.580 byte. Bitmap 50/1tr: 163.862 byte vs Set 230 byte.

---

## Quan sát

```
INFO server | memory | clients | stats | replication | persistence | keyspace
INFO commandstats        ← usec_per_call: lệnh nào tốn thời gian server
INFO latencystats        ← p50 / p99 / p99.9 từng lệnh
CONFIG RESETSTAT

SLOWLOG GET 10 / LEN / RESET
CONFIG SET slowlog-log-slower-than 1000     ← mặc định 10000 (10ms) là quá cao

CLIENT LIST / CLIENT KILL ID <id> / CLIENT NO-EVICT on
MEMORY USAGE k [SAMPLES 0] / MEMORY DOCTOR / MEMORY STATS
OBJECT ENCODING k / OBJECT FREQ k (LFU) / OBJECT IDLETIME k (LRU)

redis-cli --stat -i 1        --latency -i 3      --latency-history
redis-cli --bigkeys (số phần tử)   --memkeys (byte)   --scan   --intrinsic-latency 5
redis-cli --pipe             (nạp hàng loạt)
```

**Dòng cần đọc trong `INFO`:**

```
used_memory_human / used_memory_peak_human / mem_fragmentation_ratio (>1.5 xấu, <1.0 = swap)
maxmemory_policy / evicted_keys / expired_keys
keyspace_hits + keyspace_misses      → tỉ lệ trúng, < 80% là cache kém
blocked_clients / connected_clients / maxclients
rdb_last_bgsave_status / aof_last_write_status   → khác "ok" là báo động
master_link_status (trên replica)    → khác "up" là báo động
```

---

## Encoding & ngưỡng (Redis 8.10.0 — tự kiểm tra bằng `CONFIG GET`)

| Kiểu | Nén | Chuyển sang | Ngưỡng |
|---|---|---|---|
| String | `int` / `embstr` | `raw` | `len(khoá)+len(giá trị) ≥ 42` |
| Hash | `listpack` | `hashtable` | `hash-max-listpack-entries` **512**, `-value` **64** |
| List | `listpack` | `quicklist` | `list-max-listpack-size` **-2** (8KB) |
| Set (số) | `intset` | `listpack`/`hashtable` | `set-max-intset-entries` **512** |
| Set (chữ) | `listpack` | `hashtable` | `set-max-listpack-entries` **128**, `-value` **64** |
| ZSet | `listpack` | `skiplist` | `zset-max-listpack-entries` **128** |

Đo thật: hash 512→513 trường: **5.958 → 23.445 byte**. ZSet 128→129: **947 → 10.679 byte**.
Chuyển đổi là **một chiều** — xoá bớt phần tử không quay lại `listpack`.

---

## Persistence

```
BGSAVE / LASTSAVE / SAVE (❌ chặn server)
BGREWRITEAOF
CONFIG GET save          → "3600 1 300 100 60 10000"
CONFIG GET appendfsync   → always | everysec (mặc định, mất tối đa 1 giây) | no
redis-check-rdb /data/dump.rdb
redis-check-aof --fix /data/appendonlydir/appendonly.aof.1.incr.aof
```

Redis 7+: AOF là **thư mục** `appendonlydir/` gồm `*.base.rdb` + `*.incr.aof` + `*.manifest`.

| Tình huống | Kết quả đo thật |
|---|---|
| Mặc định + `kill -9` | **Mất trắng** |
| Mặc định + `docker stop` (SIGTERM) | Không mất (Redis lưu RDB trước khi thoát) |
| `--appendonly yes` + `kill -9` | Không mất |

---

## Eviction

```
CONFIG SET maxmemory 4gb
CONFIG SET maxmemory-policy allkeys-lru
```

`noeviction` (mặc định) · `allkeys-lru` ⭐ · `allkeys-lfu` · `allkeys-random` ·
`volatile-lru` · `volatile-lfu` · `volatile-random` · `volatile-ttl`

⚠️ `volatile-*` khi **không khoá nào có TTL** → hành xử y hệt `noeviction` → `OOM command not allowed`.

---

## Nhân bản & Cluster

```
REPLICAOF <host> <port> / REPLICAOF NO ONE
WAIT <số replica> <timeout ms>          ← báo cáo, KHÔNG làm ghi thành đồng bộ
INFO replication

redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
SENTINEL master mymaster / SENTINEL failover mymaster

redis-cli --cluster create ip1:6379 ip2:6379 ip3:6379 --cluster-replicas 1
CLUSTER INFO / CLUSTER NODES / CLUSTER KEYSLOT k / CLUSTER COUNTKEYSINSLOT n
```

Cluster: 16384 slot, `CRC16(key) mod 16384`. Hash tag `{user:1}:ten` ép cùng slot.
Mất: `SELECT`, lệnh nhiều khoá khác slot (`CROSSSLOT`), Pub/Sub thường (dùng `SPUBLISH`).

---

## Node.js (`ioredis@6`)

```js
const r = new Redis({ host, port, password,
  commandTimeout: 200, maxRetriesPerRequest: 1, enableOfflineQueue: false });

await r.set(k, JSON.stringify(v), 'EX', 300);
const raw = await r.get(k);  if (raw !== null) return JSON.parse(raw);

const p = r.pipeline(); for (...) p.get(k); await p.exec();
await r.mget(...keys);
await r.multi().incr('a').incr('b').exec();          // [[null,1],[null,2]]
r.defineCommand('muaHang', { numberOfKeys: 1, lua: '...' });

let cursor='0'; do { const [c,ks] = await r.scan(cursor,'MATCH','cache:*','COUNT',500);
  cursor=c; if(ks.length) await r.unlink(...ks); } while (cursor!=='0');
```

**Số đo (1000 khoá):** tuần tự **205ms** · `Promise.all` **9ms** · `pipeline()` **7ms** · `MGET` **2ms**.

**Bảy điều nhớ:**
1. Redis luôn trả **chuỗi** — `"100" + 10 === "10010"`.
2. `hgetall` khoá không tồn tại trả `{}`, không phải `null`.
3. Phân biệt `null` (miss) và `"null"` (hit, giá trị rỗng).
4. Client riêng cho `subscribe` / `BLPOP` / BullMQ.
5. BullMQ đòi `maxRetriesPerRequest: null`.
6. Luôn `try/catch` + `commandTimeout` — Redis chết không được làm app chết.
7. Kiểm tra mảng rỗng trước khi `mget(...arr)` / `unlink(...arr)`.

---

## Cấu hình production tối thiểu

```conf
bind 10.0.0.5 127.0.0.1
protected-mode yes
requirepass <MẬT_KHẨU_DÀI>
rename-command FLUSHALL ""
rename-command KEYS ""

maxmemory 4gb
maxmemory-policy allkeys-lru        # noeviction nếu là kho dữ liệu / session

appendonly yes
appendfsync everysec
stop-writes-on-bgsave-error yes

lazyfree-lazy-expire yes
lazyfree-lazy-eviction yes
lazyfree-lazy-server-del yes
lazyfree-lazy-user-del yes           # DEL hành xử như UNLINK

slowlog-log-slower-than 1000
slowlog-max-len 1024
latency-monitor-threshold 100

repl-backlog-size 64mb               # mặc định 1mb là quá nhỏ
min-replicas-to-write 1
min-replicas-max-lag 10
```

Hệ điều hành: `vm.overcommit_memory=1`, tắt transparent huge pages, tắt swap.

---

## Bảng chọn kiểu (bản rút gọn)

| Bài toán | Kiểu |
|---|---|
| Cache object, hay sửa một trường | Hash |
| Cache JSON render sẵn | String |
| Hàng đợi đơn giản | List + `BRPOP` |
| Hàng đợi cần ACK / chạy lại | Stream + consumer group |
| Tag, bạn bè, "đã xem" | Set |
| Bảng xếp hạng, việc hẹn giờ, rate limit trượt | Sorted Set |
| Điểm danh theo id liên tục | Bitmap |
| Đếm UV gần đúng | HyperLogLog |
| Tìm theo vị trí | Geo (thực chất là ZSet) |

---

## Số liệu đo thật để mang đi phỏng vấn

| Việc | Con số |
|---|---|
| `SET`/`GET` không pipeline | 178k / 164k ops/s, p50 = 0.135ms |
| `SET`/`GET` pipeline 100 | 2.5M / 3.33M ops/s |
| `KEYS *` trên 631.658 khoá | Chặn server **151ms** |
| Độ trễ khi có ai chạy `KEYS *` | max 1.99ms → **61.96ms**, avg 0.4 → 4.33ms |
| `DEL` hash 3 triệu trường (155 MB) | **239ms**; `UNLINK` không lọt slowlog |
| Script Lua nặng đang chạy | `GET` từ 1ms → **1431ms** |
| Cache stampede, 100 request | 100 lần chạm DB → **1** khi có khoá `NX` |
| Xuyên cache, 200 request | 200 lần chạm DB → **1** khi cache cả kết quả rỗng |
| Race không nguyên tử, 20 client mua 1 món | Bán **17/20**, tồn kho **-16** |
| 1000 `GET` từ Node | 205ms → **2ms** với `MGET` |

---

Quay lại: [README.md](./README.md) · Luyện phỏng vấn: [phong-van/](./phong-van/README.md)
