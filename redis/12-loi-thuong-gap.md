# Bài 12 — 25 lỗi thường gặp

Mọi thông báo lỗi dưới đây đều chạy thật trên Redis 8.10.0. Đọc lướt một lần bây giờ, và quay lại tra
khi gặp.

---

## Nhóm A — Lỗi Redis trả về

### 1. `WRONGTYPE Operation against a key holding the wrong kind of value`

```
127.0.0.1:6379> LPUSH l a
(integer) 1
127.0.0.1:6379> GET l
(error) WRONGTYPE Operation against a key holding the wrong kind of value
127.0.0.1:6379> INCR l
(error) WRONGTYPE Operation against a key holding the wrong kind of value
```

**Nguyên nhân:** khoá đã tồn tại với kiểu khác. Thường do hai đoạn code dùng chung mẫu tên khoá nhưng
lưu kiểu khác nhau (`SET user:1 ...` và `HSET user:1 ...`).

**Sửa:** `TYPE <khoa>` để biết nó đang là gì, rồi thống nhất quy ước tên khoá — thêm hậu tố kiểu nếu
cần: `user:1:json` và `user:1:hash`.

### 2. `ERR value is not an integer or out of range`

```
127.0.0.1:6379> SET user:1:name "Vanson"
127.0.0.1:6379> INCR user:1:name
(error) ERR value is not an integer or out of range
```

**Nguyên nhân:** `INCR`/`DECR`/`EXPIRE` nhận giá trị không phải số nguyên 64-bit. Cũng xảy ra khi giá
trị là chuỗi số quá lớn.

Với số thực dùng `INCRBYFLOAT`; nó có lỗi riêng: `ERR value is not a valid float`.

### 3. `ERR wrong number of arguments for '<lệnh>' command`

```
127.0.0.1:6379> SET
(error) ERR wrong number of arguments for 'set' command
127.0.0.1:6379> GET a b c
(error) ERR wrong number of arguments for 'get' command
```

**Trong Node, nguyên nhân thường gặp nhất là truyền `undefined`:**

```js
await r.set(`sp:${id}`, data);   // id là undefined → khoá "sp:undefined"
await r.mget(...danhSach);       // danhSach rỗng → MGET không tham số → lỗi
```

Luôn kiểm tra mảng rỗng trước khi spread vào `mget`/`del`/`sadd`.

### 4. `ERR invalid expire time in 'set' command`

```
127.0.0.1:6379> SET k v EX 0
(error) ERR invalid expire time in 'set' command
127.0.0.1:6379> SETEX k 0 v
(error) ERR invalid expire time in 'setex' command
```

TTL phải **> 0**. Bug điển hình: `EX Math.floor(conLai / 1000)` khi `conLai < 1000` cho ra `0`. Luôn
`Math.max(1, ...)`.

### 5. `OOM command not allowed when used memory > 'maxmemory'`

```
$ redis-benchmark -n 200000 -t set -q
Error from server: OOM command not allowed when used memory > 'maxmemory'.
```

**Nguyên nhân:** đầy `maxmemory` với chính sách `noeviction`, **hoặc** `volatile-*` mà không khoá nào
có TTL.

**Chẩn đoán:** `INFO stats | grep evicted_keys` — nếu là `0` trong khi bộ nhớ đã chạm trần, bạn đang
dính trường hợp thứ hai. Xem [bài 09 mục 2](./09-bo-nho-va-eviction.md).

### 6. `MISCONF Redis is configured to save RDB snapshots, but it is currently not able to persist on disk`

**Nguyên nhân:** `BGSAVE` thất bại (99% là **đầy đĩa**) và `stop-writes-on-bgsave-error yes`. Redis từ
chối **mọi lệnh ghi**, đọc vẫn được.

**Sửa:** dọn đĩa. Tạm thời: `CONFIG SET stop-writes-on-bgsave-error no` — nhưng bạn đang cố ý chấp nhận
mất dữ liệu.

### 7. `NOAUTH Authentication required.` / `WRONGPASS invalid username-password pair`

```
$ redis-cli GET a
(error) NOAUTH Authentication required.
$ redis-cli -a saipass GET a
AUTH failed: WRONGPASS invalid username-password pair or user is disabled.
```

**Sửa:** truyền `password` trong config client. Trong `ioredis`: `new Redis({ password: '...' })`. Nếu
dùng ACL user riêng thì cả `username` và `password`.

### 8. `NOPERM ...`

```
$ redis-cli --user app --pass mk SET khac:x 1
(error) NOPERM No permissions to access a key
$ redis-cli --user app --pass mk FLUSHALL
(error) NOPERM User app has no permissions to run the 'flushall' command
```

**Nguyên nhân:** ACL chặn. `ACL GETUSER <ten>` để xem user đó được gì.

### 9. `READONLY You can't write against a read only replica.`

**Nguyên nhân:** client đang nối tới **replica** chứ không phải master. Sau một lần failover, IP cũ giờ
là replica.

**Sửa:** dùng Sentinel để tìm master thay vì hardcode IP:

```js
new Redis({ sentinels: [...], name: 'mymaster' });
```

### 10. `MOVED 10778 172.19.0.3:6379`

```
127.0.0.1:6379> SET user:1 "an"
(error) MOVED 10778 172.19.0.3:6379
```

**Không phải lỗi** — Cluster đang chỉ đường. Client thường không ở chế độ cluster.

**Sửa:** `redis-cli -c`, hoặc trong Node dùng `new Redis.Cluster([...])` thay vì `new Redis(...)`.

### 11. `CROSSSLOT Keys in request don't hash to the same slot`

```
127.0.0.1:6379> MGET user:1 user:2
(error) CROSSSLOT Keys in request don't hash to the same slot
```

**Sửa:** hash tag `{...}` để ép cùng slot, hoặc tách thành nhiều lệnh. Xem
[bài 08 mục 3](./08-nhan-ban-sentinel-cluster.md).

### 12. `CLUSTERDOWN The cluster is down`

```
cluster_state:fail
cluster_slots_ok:10923
```

**Nguyên nhân:** có slot không node nào phục vụ (một master chết mà không có replica), và
`cluster-require-full-coverage yes`.

**Sửa:** khôi phục node, hoặc `CONFIG SET cluster-require-full-coverage no` để phần còn lại vẫn chạy.
Phòng ngừa: **mỗi master phải có replica**.

### 13. `EXECABORT Transaction discarded because of previous errors.`

```
127.0.0.1:6379> MULTI
127.0.0.1:6379> LENHSAI a b
(error) ERR unknown command 'LENHSAI'
127.0.0.1:6379> EXEC
(error) EXECABORT Transaction discarded because of previous errors.
```

**Nguyên nhân:** một lệnh trong khối sai cú pháp / sai số tham số.

⚠️ Lỗi **kiểu** thì ngược lại — `EXEC` chạy và các lệnh khác **vẫn thực thi**, không rollback. Xem
[bài 05 mục 2](./05-transaction-va-lua.md).

### 14. `NOSCRIPT No matching script. Please use EVAL.`

**Nguyên nhân:** `EVALSHA` với script chưa có trong cache — thường sau khi Redis restart hoặc
`SCRIPT FLUSH`.

**Sửa:** dùng `defineCommand` của `ioredis` (tự fallback sang `EVAL`), hoặc bắt lỗi và `EVAL` lại.

### 15. `BUSY Redis is busy running a script` / `UNKILLABLE ...`

```
(error) BUSY Redis is busy running a script. You can only call SCRIPT KILL or SHUTDOWN NOSAVE.
127.0.0.1:6379> SCRIPT KILL
(error) UNKILLABLE Sorry the script already executed write commands against the dataset. You can either
wait the script termination or kill the server in a hard way using the SHUTDOWN NOSAVE command.
```

**Nguyên nhân:** script Lua chạy quá `busy-reply-threshold` (5 giây).

**Sửa:** `SCRIPT KILL` nếu script chưa ghi gì. Nếu đã ghi thì chỉ còn chờ hoặc `SHUTDOWN NOSAVE` (mất
dữ liệu chưa lưu). **Phòng ngừa quan trọng hơn chữa:** script phải có giới hạn vòng lặp.

### 16. `ERR Can't execute 'get': only (P|S)SUBSCRIBE / (P|S)UNSUBSCRIBE / PING / QUIT / RESET are allowed in this context`

Kết nối đã vào chế độ subscribe (RESP2) thì không chạy được lệnh khác. Đo thật:

```
RESP2 >> "-ERR Can't execute 'get': only (P|S)SUBSCRIBE / ... are allowed in this context"
RESP3 >> "_\r\n"          ← RESP3 KHÔNG chặn, GET trả về null bình thường
```

**Chi tiết đáng nhớ:** `ioredis@6` mặc định dùng **RESP3**, nên lỗi này **không** xuất hiện — code chạy
được nhưng bạn vẫn nên tách client riêng cho subscribe, vì mọi lệnh vẫn đi chung một kết nối và bị xếp
hàng sau nhau.

### 17. `ERR DB index is out of range` / `ERR SELECT is not allowed in cluster mode`

```
127.0.0.1:6379> SELECT 99
(error) ERR DB index is out of range          ← chỉ có 16 db (0–15)
127.0.0.1:6379> SELECT 1                      (trong cluster)
(error) ERR SELECT is not allowed in cluster mode
```

**Sửa:** dùng tiền tố khoá thay vì nhiều database. Xem [bài 00 mục 4](./00-cai-dat-va-redis-cli.md).

### 18. `ERR DEBUG command not allowed`

```
(error) ERR DEBUG command not allowed. If the enable-debug-command option is set to "local", you can run
it from a local connection, otherwise you need to set this option in the configuration file, and then
restart the server.
```

Từ Redis 7, `DEBUG` bị hạn chế mặc định. Chạy `DEBUG SLEEP`/`DEBUG OBJECT` phải vào từ trong máy chủ
(`docker exec ... redis-cli`), không qua mạng.

### 19. Client bị ngắt khi vượt `maxclients`

```
$ node many-clients.mjs
client 2 -> Connection is closed.
client 3 -> Connection is closed.
```

Redis đóng kết nối mới khi vượt `maxclients`. Từ phía client, `ioredis` chỉ báo `Connection is closed`
— **không** nói lý do. Kiểm tra ở phía server:

```
127.0.0.1:6379> INFO clients
connected_clients:2
maxclients:10000
```

**Nguyên nhân thật sự thường là rò rỉ kết nối**: tạo `new Redis()` mỗi request thay vì dùng lại một
client. Kiểm tra bằng `CLIENT LIST | wc -l`.

---

## Nhóm B — Lỗi phía Node

### 20. Lưu object mà quên `JSON.stringify`

```
GET u:1 -> "[object Object]"
```

**Không có lỗi nào được ném ra.** `ioredis` gọi `String(value)` và bạn được `"[object Object]"`. Chỉ
phát hiện khi `JSON.parse` ném lỗi (Node 22): `SyntaxError: "[object Object]" is not valid JSON`.

**Sửa:** luôn qua một lớp bọc `cache.dat()` / `cache.lay()` như [bài 10 mục 9](./10-thuc-chien-nodejs.md).

### 21. Quên rằng Redis trả về **chuỗi**

```
typeof -> string; g + 10 = 10010; Number(g) + 10 = 110
```

`"100" + 10 = "10010"`. Không lỗi, không cảnh báo — chỉ là con số sai. Đây là bug tốn tiền nhất trong
danh sách này.

**Sửa:** `Number(await r.get(k))`, và với TypeScript thì bọc hàm có kiểu trả về `number | null`.

### 22. `HGETALL` trả `{}` chứ không phải `null`

```
giá trị = {}; if (h) -> true; Object.keys(h).length -> 0
```

```js
const s = await r.hgetall(`session:${sid}`);
if (!s) return null;                            // ❌ không bao giờ đúng
if (Object.keys(s).length === 0) return null;   // ✅
```

### 23. Không phân biệt "cache miss" và "cache lưu null"

```js
const c = await r.get(key);
if (!c) { /* xuống DB */ }        // ❌ chuỗi "null" là truthy nên qua được, nhưng...
const data = JSON.parse(c);
if (!data) { /* lại xuống DB */ } // ❌ ở đây thì hỏng: null hợp lệ bị coi là miss
```

Đúng:

```js
const c = await r.get(key);
if (c !== null) return JSON.parse(c);   // c === null mới là miss thật
```

### 24. `await` trong vòng lặp

```
1000 GET tuần tự (await từng cái)    205ms
1 lệnh MGET 1000 khoá                  2ms
```

Chậm gấp **100 lần**. Dùng `MGET`, `pipeline()`, hoặc `Promise.all`.

### 25. Dùng `KEYS` trong code production

```js
const keys = await r.keys('cache:*');    // ❌ chặn server
```

Trên 631.658 khoá, lệnh này giữ server **151ms** và đẩy độ trễ tối đa của mọi client khác từ 1.99ms lên
**61.96ms**.

```js
// ✅
let cursor = '0';
do {
  const [c, keys] = await r.scan(cursor, 'MATCH', 'cache:*', 'COUNT', 500);
  cursor = c;
  if (keys.length) await r.unlink(...keys);
} while (cursor !== '0');
```

---

## Nhóm C — Lỗi thiết kế (không có thông báo lỗi, chỉ có hậu quả)

### Quên TTL

```
127.0.0.1:6379> TTL ro-ri
(integer) -1                    ← sống mãi mãi
```

**Phát hiện hàng loạt:**

```
127.0.0.1:6379> INFO keyspace
db0:keys=631658,expires=0,avg_ttl=0,subexpiry=0
```

`expires=0` trên instance cache là báo động đỏ.

### `SET` xoá mất TTL

```
127.0.0.1:6379> SET tmp v EX 60
127.0.0.1:6379> SET tmp v2
127.0.0.1:6379> TTL tmp
(integer) -1
```

Dùng `KEEPTTL`. Xem [bài 01](./01-string-va-key.md).

### Rate limiter reset TTL mỗi request

`INCR` + `EXPIRE` (không `NX`) → user gửi đều đặn thì bộ đếm không bao giờ reset và bị chặn **vĩnh
viễn**. Dùng `EXPIRE ... NX`. Xem [bài 03 mục 2](./03-ttl-va-het-han.md).

### Nhả khoá phân tán bằng `DEL`

Xoá nhầm khoá của người khác khi khoá của mình đã hết hạn. Phải dùng Lua kiểm tra token. Xem
[bài 05 mục 5](./05-transaction-va-lua.md).

### `DEL` khoá bự

```
DEL khoa-bu  → slowlog ghi 239292 micro giây (239ms server bị treo)
UNLINK khoa-bu2 → không lọt slowlog
```

Dùng `UNLINK`, hoặc bật `lazyfree-lazy-user-del yes` để `DEL` tự hành xử như `UNLINK`.

### Ghi DB rồi **cập nhật** cache (thay vì xoá)

Hai request cùng sửa → thứ tự ghi cache có thể đảo → cache sai tới hết TTL. Luôn **ghi DB rồi xoá
cache**. Xem [bài 04 mục 2](./04-cache-pattern.md).

### Không cache kết quả rỗng

```
không chống xuyên       : 200 request id không tồn tại → 200 lần chạm DB
cache cả kết quả rỗng   : 200 request id không tồn tại → 1 lần chạm DB
```

### Toàn bộ cache cùng một TTL cố định

10.000 khoá cùng hết hạn một giây → toàn bộ traffic đập vào DB. Thêm nhiễu ngẫu nhiên vào TTL.

### Dùng chung một Redis cho cache và session

`maxmemory-policy allkeys-lru` đá session ra ngẫu nhiên → user bị đăng xuất không rõ lý do.
`INFO stats | grep evicted_keys` khác 0 trên instance session là bằng chứng. Tách thành hai instance.

### Redis chết làm app chết

Không `try/catch` quanh lệnh Redis, không `commandTimeout` → Redis treo biến thành request treo. Xem
[bài 04 mục 8](./04-cache-pattern.md) và [bài 10 mục 2](./10-thuc-chien-nodejs.md).

### Không giới hạn độ dài List / Stream

List không `LTRIM` và Stream không `MAXLEN` lớn vô hạn. BullMQ không `removeOnComplete` giữ lại mọi job
đã xong. Đây là ba nguyên nhân "Redis tự nhiên đầy" phổ biến nhất.

---

Tiếp theo: [13-cheatsheet.md](./13-cheatsheet.md)
