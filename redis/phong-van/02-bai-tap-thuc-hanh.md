# 20 bài tập gõ tay

**Gõ, đừng đọc.** Mỗi bài đều chạy được trong 5–20 phút. Ghi lại **con số của chính bạn** — đó là thứ
mang đi phỏng vấn được.

## Dựng môi trường

```bash
$ docker run -d --name redis-lab -p 6379:6379 redis:8-alpine
$ docker exec -it redis-lab redis-cli
127.0.0.1:6379> PING
PONG
```

Cho phần code Node:

```bash
$ mkdir redis-lab && cd redis-lab && npm init -y && npm install ioredis
$ node -e "console.log(require('ioredis/package.json').version)"
6.0.0
```

Mẹo: chạy `redis-cli` từ ngoài với `--no-raw` để thấy đúng định dạng `(nil)` / `(integer)`:

```bash
$ docker exec redis-lab redis-cli --no-raw GET khong-co
(nil)
```

Nạp dữ liệu hàng loạt:

```bash
$ docker exec -i redis-lab sh -c 'for i in $(seq 1 100000); do echo "SET k:$i v"; done | redis-cli --pipe'
```

---

## Nhóm 1 — Kiểu dữ liệu

### Bài 1. Bảng xếp hạng

Tạo bảng xếp hạng 5 người chơi. Cộng điểm vài lần. Lấy top 3 kèm điểm. Tìm hạng của một người.
Chỉ dùng lệnh `Z*`.

<details><summary>Đáp án</summary>

```
ZADD game 0 an 0 binh 0 cuong 0 dung 0 em
ZINCRBY game 120 an
ZINCRBY game 300 binh
ZINCRBY game 175 cuong
ZREVRANGE game 0 2 WITHSCORES
ZREVRANK game an
```

Nhớ: `ZREVRANK` đếm **từ 0**, phải `+1` khi hiển thị cho người dùng.
</details>

### Bài 2. Chọn kiểu cho 6 bài toán

Với mỗi bài toán, chọn kiểu và viết lệnh: (a) đếm lượt xem bài viết; (b) danh sách tag của bài viết;
(c) 100 hoạt động gần nhất của user; (d) thông tin user hay sửa từng trường; (e) bạn chung của A và B;
(f) đơn hàng cần huỷ sau 15 phút.

<details><summary>Đáp án</summary>

```
(a) String   INCR bai-viet:1:luot-xem
(b) Set      SADD tag:bai-viet:1 redis nodejs
(c) List     LPUSH hoat-dong:99 "..." ; LTRIM hoat-dong:99 0 99
(d) Hash     HSET user:99 ten "An" tuoi 28 ; HINCRBY user:99 tuoi 1
(e) Set      SINTER ban:A ban:B
(f) ZSet     ZADD huy-don <now+900000> "DH001"  → worker: ZRANGEBYSCORE huy-don 0 <now>
```

(f) **không** dùng keyspace notification — xem [câu F6](./01-cau-hoi-va-dap-an.md).
</details>

### Bài 3. `SADD` trả về gì

Chứng minh `SADD` trả về số phần tử **mới**, và dùng nó để viết "user đã like bài viết chưa" bằng
**một** lệnh.

<details><summary>Đáp án</summary>

```
127.0.0.1:6379> SADD tags redis nodejs redis backend
(integer) 3                     ← truyền 4, chỉ 3 mới

127.0.0.1:6379> SADD like:post:1 user:99
(integer) 1                     ← lần đầu like
127.0.0.1:6379> SADD like:post:1 user:99
(integer) 0                     ← đã like rồi
```

Không cần `SISMEMBER` rồi `SADD` (hai lệnh, có race condition).
</details>

### Bài 4. Ngưỡng encoding

Tìm ngưỡng `listpack → hashtable` của hash và `listpack → skiplist` của zset trên Redis của bạn, đo
`MEMORY USAGE` ngay trước và ngay sau ngưỡng.

<details><summary>Đáp án</summary>

```bash
$ docker exec -i redis-lab sh -c '
for i in $(seq 1 512); do redis-cli HSET h512 f$i v$i > /dev/null; done
echo "512 -> $(redis-cli OBJECT ENCODING h512)  mem=$(redis-cli MEMORY USAGE h512)"
redis-cli HSET h512 f513 v513 > /dev/null
echo "513 -> $(redis-cli OBJECT ENCODING h512)  mem=$(redis-cli MEMORY USAGE h512)"'
```

Kết quả trên máy viết tài liệu này:
```
512 -> listpack   mem=5958
513 -> hashtable  mem=23445        ← gấp ~4 lần
128 -> listpack   mem=947    (zset)
129 -> skiplist   mem=10679        ← gấp ~11 lần
```

Thử tiếp: xoá bớt trường xuống dưới ngưỡng — encoding **không** quay lại `listpack`.
</details>

### Bài 5. Bitmap vs Set

Với dải id 1..1.000.000, đo `MEMORY USAGE` của Bitmap và Set trong hai trường hợp: 900.000 user online,
và 50 user online.

<details><summary>Đáp án</summary>

Đo trên máy viết tài liệu này:
```
Bitmap 900.000 online :    131093 byte      Set: 29877580 byte   → Bitmap thắng 228 lần
Bitmap      50 online :    163862 byte      Set:      230 byte   → Set thắng 712 lần
```

Bitmap tốn gần như nhau ở cả hai vì phải cấp phát tới **bit có chỉ số lớn nhất**. Ngưỡng hoà vốn ~0.5%
mật độ.
</details>

### Bài 6. HyperLogLog

Nạp 100.000 phần tử vào một HLL và một Set. So `PFCOUNT` với `SCARD`, và so `MEMORY USAGE`.

<details><summary>Đáp án</summary>

```
thật sự : 100000
PFCOUNT : 99725       (sai 0.275%)
HLL     : 14357 byte
Set     : 4261838 byte      ← lớn hơn 297 lần
```

Thử tiếp `PFMERGE` gộp 3 HLL và xác nhận nó **không** đếm trùng.
</details>

---

## Nhóm 2 — TTL và bộ nhớ

### Bài 7. `SET` xoá TTL

Chứng minh `SET` xoá TTL, `SET ... KEEPTTL` thì không, và lập bảng cho `APPEND`, `INCR`, `GETSET`,
`RENAME`, `COPY`.

<details><summary>Đáp án</summary>

```
SET tmp v EX 60 ; TTL tmp        → 60
SET tmp v2 KEEPTTL ; TTL tmp     → 60
SET tmp v3 ; TTL tmp             → -1   ⚠️

SET c v EX 100 ; SETRANGE c 0 z ; TTL c   → 100 ✅
SET f v EX 100 ; GETSET f v2 ; TTL f      → -1  ⚠️
SET a v EX 100 ; RENAME a b ; TTL b       → 100 ✅
SET k v EX 100 ; COPY k k2 ; TTL k2       → 100 ✅
```

Quy tắc: chỉ `SET`, `GETSET`, `PERSIST` xoá TTL.
</details>

### Bài 8. Rate limiter và cái bẫy `NX`

Viết rate limiter "5 request/phút" bằng `INCR` + `EXPIRE NX`. Rồi bỏ `NX` và chứng minh user bị chặn
vĩnh viễn.

<details><summary>Đáp án</summary>

Có `NX`:
```
INCR rl:x → 1 ; EXPIRE rl:x 60 NX → 1 ; TTL → 60
INCR rl:x → 2 ; EXPIRE rl:x 60 NX → 0 ; TTL → 60   ← không reset
```

Không có `NX`: mỗi request lại `EXPIRE rl:x 60` → TTL luôn về 60. User gửi 1 request mỗi 59 giây thì bộ
đếm không bao giờ reset; khi chạm 6 là bị chặn mãi mãi.
</details>

### Bài 9. Cơ chế xoá khoá hết hạn

Nạp 5000 khoá `EX 2`, **không đọc khoá nào**, và theo dõi `DBSIZE` + `expired_keys_active`.

<details><summary>Đáp án</summary>

```bash
$ docker exec -i redis-lab sh -c '
redis-cli FLUSHALL > /dev/null
for i in $(seq 1 5000); do echo "SET het:$i v EX 2"; done | redis-cli --pipe > /dev/null 2>&1
echo "ngay sau khi ghi:  DBSIZE=$(redis-cli DBSIZE)"
sleep 3
echo "sau 3 giay:        DBSIZE=$(redis-cli DBSIZE)"
redis-cli INFO stats | grep expired'
```
```
ngay sau khi ghi:  DBSIZE=5000
sau 3 giay:        DBSIZE=0
expired_keys:5004
expired_keys_active:5003     ← vòng quét chủ động dọn gần như toàn bộ
```

Lặp lại sau khi nạp 1 triệu khoá **không** hết hạn — vòng quét lấy mẫu ngẫu nhiên sẽ khó trúng hơn.
</details>

### Bài 10. Ba chính sách eviction

Đặt `maxmemory 8mb` rồi nhồi đầy với ba chính sách: `noeviction`, `allkeys-lru`, `volatile-lru` (không
khoá nào có TTL). Ghi lại thông báo lỗi, `DBSIZE`, `evicted_keys` cho từng lần.

<details><summary>Đáp án</summary>

```
--- noeviction ---
Error from server: OOM command not allowed when used memory > 'maxmemory'.
evicted_keys:0

--- allkeys-lru ---
(chạy hết, không lỗi)   DBSIZE=60237   evicted_keys:142778

--- volatile-lru (không khoá nào có TTL) ---
Error from server: OOM command not allowed when used memory > 'maxmemory'.
```

Trường hợp thứ ba là **cái bẫy quan trọng nhất** trong bài này. Dấu hiệu nhận biết trên production:
`evicted_keys:0` trong khi `used_memory` đã chạm `maxmemory`.
</details>

### Bài 11. `DEL` vs `UNLINK`

Tạo một hash 3 triệu trường. Hạ `slowlog-log-slower-than` xuống 1000. `DEL` nó và đọc slowlog. Tạo lại
và `UNLINK`, đọc slowlog.

<details><summary>Đáp án</summary>

```
127.0.0.1:6379> HLEN khoa-bu
(integer) 3000000
127.0.0.1:6379> MEMORY USAGE khoa-bu SAMPLES 0
(integer) 162109522             ← 155 MB

127.0.0.1:6379> DEL khoa-bu
127.0.0.1:6379> SLOWLOG GET 1
   3) (integer) 239292          ← 239ms server bị treo

127.0.0.1:6379> UNLINK khoa-bu2
127.0.0.1:6379> SLOWLOG GET 1
(empty array)
```

Thử tiếp: bật `lazyfree-lazy-user-del yes` rồi `DEL` lại — bây giờ nó cũng không lọt slowlog.
</details>

---

## Nhóm 3 — Nguyên tử

### Bài 12. Race condition bán hàng ⭐

Đặt `ton-kho = 1`, cho 20 client đồng thời mua bằng `GET` rồi `DECR`. Bạn bán được mấy đơn? Rồi sửa
bằng ba cách và xác nhận cả ba ra đúng 1.

<details><summary>Đáp án</summary>

```js
import net from 'node:net';
const conn = () => new Promise(res => { const s = net.createConnection(6379,'127.0.0.1',()=>res(s)); });
const send = (s,c) => new Promise(res => { s.once('data',d=>res(d.toString().trim())); s.write(c+'\r\n'); });

async function chay(nhan, muaFn) {
  const c0 = await conn(); await send(c0, 'SET ton-kho 1'); c0.end();
  const clients = await Promise.all(Array.from({length:20}, conn));
  const kq = await Promise.all(clients.map(muaFn));
  const c1 = await conn(); const con = await send(c1,'GET ton-kho'); c1.end();
  clients.forEach(c=>c.end());
  console.log(`${nhan}: bán ${kq.filter(x=>x==='ban').length}/20, tồn kho = ${con.split('\r\n')[1]}`);
}
```

Kết quả trên máy viết tài liệu này:
```
GET rồi DECR      : bán được 17/20 đơn, tồn kho còn lại = -16
DECR rồi kiểm tra : bán được  1/20 đơn, tồn kho còn lại = 0
Lua script        : bán được  1/20 đơn, tồn kho còn lại = 0
```

Con số của bạn sẽ khác 17 nhưng chắc chắn > 1.
</details>

### Bài 13. `MULTI` không rollback

Tạo một khối `MULTI` có lỗi **cú pháp** ở giữa, rồi một khối có lỗi **kiểu** ở giữa. So kết quả.

<details><summary>Đáp án</summary>

Lỗi cú pháp → `EXECABORT`, không lệnh nào chạy.
Lỗi kiểu → `EXEC` chạy, lệnh 1 và 3 vẫn thực thi:
```
127.0.0.1:6379> EXEC
1) (integer) 2
2) (error) ERR value is not an integer or out of range
3) (integer) 3
127.0.0.1:6379> GET dem
"3"
```
</details>

### Bài 14. `WATCH` bị huỷ

Dùng hai kết nối (script Node với `net`, hoặc hai cửa sổ `redis-cli` tương tác) để chứng minh `EXEC`
trả `(nil)` khi khoá bị `WATCH` bị người khác sửa.

<details><summary>Đáp án</summary>

```
A> WATCH ton-kho         +OK
A> MULTI                 +OK
A> DECR ton-kho          +QUEUED
B> DECR ton-kho          :0
A> EXEC                  (nil)      ← huỷ
```

Viết thêm vòng lặp thử lại 5 lần và đo tỉ lệ thành công khi có 20 client cùng tranh.
</details>

### Bài 15. Khoá phân tán có watchdog

Viết `voiKhoa(ten, hanMs, viec)` dùng `SET NX PX` + nhả khoá bằng Lua kiểm tra token. Thêm watchdog gia
hạn mỗi `hanMs/3`. Mô phỏng công việc lâu hơn TTL và chứng minh watchdog giữ được khoá.

<details><summary>Đáp án</summary>

```js
const NHA_KHOA = `if redis.call('GET',KEYS[1])==ARGV[1]
                  then return redis.call('DEL',KEYS[1]) else return 0 end`;
const GIA_HAN  = `if redis.call('GET',KEYS[1])==ARGV[1]
                  then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end`;

async function voiKhoa(ten, hanMs, viec) {
  const token = randomUUID();
  if (await redis.set(ten, token, 'PX', hanMs, 'NX') !== 'OK') throw new Error('bận');
  const timer = setInterval(
    () => redis.eval(GIA_HAN, 1, ten, token, hanMs).catch(()=>{}),
    Math.floor(hanMs / 3));
  try { return await viec(); }
  finally { clearInterval(timer); await redis.eval(NHA_KHOA, 1, ten, token); }
}
```

Test: `voiKhoa('k', 2000, () => sleep(6000))`. Không watchdog thì sau 2 giây client khác lấy được khoá;
có watchdog thì không.
</details>

### Bài 16. `BUSY` và `SCRIPT KILL`

Chạy `EVAL` với vòng lặp 3 tỉ bước. Từ kết nối khác gõ một lệnh — thấy lỗi gì? Cứu bằng lệnh nào? Rồi
làm lại với script **có ghi dữ liệu** trước vòng lặp.

<details><summary>Đáp án</summary>

Script không ghi:
```
(error) BUSY Redis is busy running a script. You can only call SCRIPT KILL or SHUTDOWN NOSAVE.
127.0.0.1:6379> SCRIPT KILL
OK
```

Script có ghi (`redis.call('SET',KEYS[1],'da-ghi')` trước vòng lặp):
```
(error) UNKILLABLE Sorry the script already executed write commands against the dataset. You can either
wait the script termination or kill the server in a hard way using the SHUTDOWN NOSAVE command.
```

⚠️ Nếu bạn kẹt ở trường hợp hai trên container lab, cách nhanh nhất là `docker restart redis-lab`.
</details>

---

## Nhóm 4 — Cache

### Bài 17. Cache stampede ⭐

Viết `layTran` và `layCoKhoa`, chạy 100 request đồng thời cho cùng một id với query DB giả lập 300ms.
Đếm số lần chạm DB.

<details><summary>Đáp án</summary>

```js
let soLanGoiDB = 0;
async function truyVanDB(id) {
  soLanGoiDB++;
  await new Promise(r => setTimeout(r, 300));
  return JSON.stringify({ id });
}
// ... layTran và layCoKhoa như bài 04 mục 3
await Promise.all(Array.from({ length: 100 }, () => fn(1)));
```

```
cache-aside trần  : 100 request đồng thời → gọi DB 100 lần, mất 312ms
có khoá NX        : 100 request đồng thời → gọi DB   1 lần, mất 327ms
```

Nếu bạn ra 2–3 thay vì 1: kiểm tra đã dùng `SET ... NX` (không phải `SETNX` rồi `EXPIRE`) và vòng chờ có
đủ dài không.
</details>

### Bài 18. Xuyên cache

Viết hai phiên bản (có và không cache kết quả rỗng), gọi 200 lần với một id không tồn tại.

<details><summary>Đáp án</summary>

```
không chống xuyên       : 200 request → 200 lần chạm DB
cache cả kết quả rỗng   : 200 request →   1 lần chạm DB
```

Điểm dễ sai: kiểm tra `if (c !== null)` chứ không phải `if (c)`, và TTL cho null phải ngắn hơn hẳn
(30 giây so với 300).
</details>

### Bài 19. Chứng minh "xoá cache rồi ghi DB" là sai

Chèn `await sleep(100)` giữa `redis.del` và `db.update`, cho một request đọc chen vào, và cho thấy cache
kết thúc với giá trị **cũ**.

<details><summary>Đáp án</summary>

```js
// Request A
await redis.del('sp:1');
await sleep(100);                    // mô phỏng ghi DB chậm
await db.update(1, { gia: 200 });

// Request B, chạy trong lúc A đang sleep
await layTran(1);                    // đọc DB thấy 100, ghi 100 vào cache

// Sau khi A xong:
await redis.get('sp:1');             // "100" — sai, DB đang là 200
```

Làm lại với thứ tự đúng (ghi DB trước rồi xoá cache) và xác nhận cache trống, lần đọc sau lấy đúng 200.
</details>

### Bài 20. Pipeline và `commandTimeout`

(a) Đo 1000 `GET` bằng bốn cách: tuần tự, `Promise.all`, `pipeline()`, `MGET`.
(b) Cấu hình `commandTimeout: 200`, rồi `docker pause redis-lab` giữa chừng — app báo lỗi gì, sau bao lâu?

<details><summary>Đáp án</summary>

(a) Trên máy viết tài liệu này:
```
1000 GET tuần tự (await từng cái)    205ms
1000 GET bằng Promise.all              9ms
1000 GET bằng pipeline()               7ms
1 lệnh MGET 1000 khoá                  2ms
```
`Promise.all` gần bằng pipeline vì `ioredis` tự gom các lệnh phát ra trong cùng một tick.

(b) `Command timed out` sau đúng ~200ms. Bỏ `commandTimeout` thì request treo cho tới khi
`docker unpause` — đây là khác biệt giữa "cache chậm" và "app chết".
</details>

---

## Dọn dẹp

```bash
$ docker rm -f redis-lab
```

---

Tiếp theo: [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md)
