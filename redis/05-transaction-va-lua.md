# Bài 05 — Transaction, Lua và khoá phân tán

Redis chạy một luồng, nên **mỗi lệnh đơn** đã là nguyên tử. Vấn đề bắt đầu khi bạn cần **nhiều lệnh**
chạy như một khối. Bài này có ba công cụ, và một bảng chọn công cụ nào cho việc gì.

---

## 1. Bài toán gốc: bán 1 món hàng cho 20 người cùng lúc

```js
// Cách ai cũng viết đầu tiên
const n = await r.get('ton-kho');
if (n > 0) { await r.decr('ton-kho'); return 'ban'; }
return 'het';
```

Đo thật: đặt `ton-kho = 1`, cho 20 client đồng thời chạy đoạn trên.

```
$ node race.mjs
GET rồi DECR      : bán được 17/20 đơn, tồn kho còn lại = -16
```

**Bán được 17 món khi chỉ có 1.** Vì `GET` và `DECR` là hai lệnh riêng — giữa chúng có 19 client khác
chen vào.

Ba cách sửa, tất cả đều đo ra đúng 1/20:

```
DECR rồi kiểm tra : bán được 1/20 đơn, tồn kho còn lại = 0
Lua script        : bán được 1/20 đơn, tồn kho còn lại = 0
```

### Cách rẻ nhất: dùng chính giá trị trả về của lệnh

```js
const con = await r.decr('ton-kho');
if (con >= 0) return 'ban';
await r.incr('ton-kho');          // trả lại
return 'het';
```

Một lệnh, không cần transaction, không cần Lua. **Luôn thử cách này trước.** Nhiều bài toán tưởng cần
transaction thật ra chỉ cần đọc kỹ giá trị trả về: `SET NX` trả `nil` khi trượt, `SADD` trả `0` khi
trùng, `ZADD GT` trả `0` khi không cập nhật.

---

## 2. `MULTI` / `EXEC` — gom lệnh, **không** phải transaction như SQL

```
127.0.0.1:6379> SET tien:an 100
OK
127.0.0.1:6379> SET tien:binh 50
OK
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> DECRBY tien:an 30
QUEUED
127.0.0.1:6379> INCRBY tien:binh 30
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 70
2) (integer) 80
```

`QUEUED` nghĩa là lệnh được **xếp vào hàng**, chưa chạy. `EXEC` chạy tất cả **liền một mạch**, không
client nào chen vào giữa được.

### Điều `MULTI` **không** làm: rollback

Đây là khác biệt lớn nhất so với transaction SQL, và là câu hỏi phỏng vấn rất hay gặp.

**Lỗi cú pháp (phát hiện lúc xếp hàng) → cả khối bị huỷ:**

```
127.0.0.1:6379> SET x 0
OK
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> SET x 1
QUEUED
127.0.0.1:6379> LENHSAI a b
(error) ERR unknown command 'LENHSAI', with args beginning with: 'a' 'b'
127.0.0.1:6379> INCR x
QUEUED
127.0.0.1:6379> EXEC
(error) EXECABORT Transaction discarded because of previous errors.
127.0.0.1:6379> GET x
"0"                             ← không lệnh nào chạy
```

**Lỗi lúc chạy (kiểu sai) → các lệnh khác VẪN chạy:**

```
127.0.0.1:6379> SET chuoi "abc"
OK
127.0.0.1:6379> SET dem 1
OK
127.0.0.1:6379> MULTI
OK
127.0.0.1:6379> INCR dem
QUEUED
127.0.0.1:6379> INCR chuoi
QUEUED
127.0.0.1:6379> INCR dem
QUEUED
127.0.0.1:6379> EXEC
1) (integer) 2
2) (error) ERR value is not an integer or out of range
3) (integer) 3
127.0.0.1:6379> GET dem
"3"                             ← lệnh 1 và 3 đã chạy, KHÔNG rollback
```

Nghĩa là: `MULTI` cho bạn **tính nguyên tử** (không ai chen vào) và **tính cô lập**, nhưng **không** cho
bạn *"tất cả hoặc không gì cả"*. Nếu cần đảm bảo đó, phải dùng Lua và tự kiểm tra điều kiện trước khi
ghi.

### Điều `MULTI` cũng không làm: đọc kết quả giữa chừng

Trong khối `MULTI`, mọi lệnh chỉ trả `QUEUED`. Bạn **không** thể viết "đọc tồn kho, nếu > 0 thì trừ" —
vì lúc xếp hàng bạn chưa có kết quả của `GET`. Đó chính là lúc cần `WATCH` hoặc Lua.

---

## 3. `WATCH` — khoá lạc quan (optimistic locking)

`WATCH key` bảo Redis: "nếu khoá này bị **ai đó** sửa trước khi tôi `EXEC`, hãy huỷ transaction của tôi".

Đo thật với hai kết nối:

```
A> SET ton-kho 1         +OK
A> WATCH ton-kho         +OK
A> GET ton-kho           1          ← A đọc thấy còn 1, quyết định bán
A> MULTI                 +OK
A> DECR ton-kho          +QUEUED
   -- lúc này kết nối B chen vào --
B> DECR ton-kho          :0         ← B mua mất
A> EXEC                  (nil)      ← EXEC bị HUỶ
A> GET ton-kho           0
```

`EXEC` trả `(nil)` — dấu hiệu "có người đụng vào khoá tôi đang canh, tôi không chạy". App phải **thử
lại từ đầu**:

```js
async function mua(id) {
  for (let lan = 0; lan < 5; lan++) {
    await r.watch('ton-kho');
    const n = Number(await r.get('ton-kho'));
    if (n <= 0) { await r.unwatch(); return 'het'; }

    const kq = await r.multi().decr('ton-kho').exec();
    if (kq !== null) return 'ban';                // thành công
    // kq === null → có người chen, vòng lặp thử lại
  }
  return 'ban-that-bai';
}
```

Ba điều phải nhớ:

1. **`WATCH` gắn với kết nối.** Trong Node dùng connection pool, phải chắc chắn `WATCH`, `MULTI`,
   `EXEC` đi cùng **một** kết nối. `ioredis` mặc định một client là một kết nối nên an toàn; nhưng nếu
   bạn dùng cluster hoặc pool thì phải cẩn thận.
2. **`EXEC` và `DISCARD` tự động huỷ mọi `WATCH`.** Không cần gọi `UNWATCH` sau đó.
3. **Tranh chấp cao thì `WATCH` rất tệ.** 100 client cùng canh một khoá thì 99 phải thử lại, và có thể
   thử lại mãi. Dưới tranh chấp cao, dùng Lua.

---

## 4. Lua — một khối, một lượt, không ai chen vào

Script Lua chạy **trọn vẹn** trong luồng chính của Redis. Không client nào xen vào giữa, và bạn **đọc
được kết quả giữa chừng** — thứ mà `MULTI` không cho.

```
127.0.0.1:6379> EVAL "return 1" 0
(integer) 1
127.0.0.1:6379> EVAL "return {KEYS[1],KEYS[2],ARGV[1]}" 2 k1 k2 a1
1) "k1"
2) "k2"
3) "a1"
```

Cú pháp: `EVAL <script> <số lượng KEYS> <các KEYS...> <các ARGV...>`.

**Vì sao phải tách `KEYS` và `ARGV`:** Redis Cluster cần biết script đụng tới khoá nào để định tuyến.
Nếu bạn nhét tên khoá vào `ARGV`, script chạy được ở standalone nhưng **hỏng khi lên Cluster**. Đây là
lỗi rất hay gặp khi migrate.

Bài toán tồn kho, viết bằng Lua:

```lua
local n = tonumber(redis.call('GET', KEYS[1]))
if n and n > 0 then
  redis.call('DECR', KEYS[1])
  return 1
else
  return 0
end
```

```
127.0.0.1:6379> EVAL "local n=tonumber(redis.call('GET',KEYS[1])) if n and n>0 then redis.call('DECR',KEYS[1]) return 1 else return 0 end" 1 ton-kho
(integer) 1
```

Đo thật với 20 client đồng thời: **bán đúng 1**, tồn kho về 0.

### Quy tắc chuyển đổi kiểu Lua ↔ Redis (chỗ hay sai)

```
127.0.0.1:6379> EVAL "return 3.9" 0
(integer) 3                     ← số thực bị CẮT thành số nguyên, không làm tròn

127.0.0.1:6379> EVAL "return redis.status_reply('DONE')" 0
DONE

127.0.0.1:6379> EVAL "return redis.error_reply('het hang')" 0
(error) het hang

127.0.0.1:6379> EVAL "return cjson.encode({1,2,3})" 0
"[1,2,3]"
```

| Lua | Redis trả về |
|---|---|
| `number` | Integer (**cắt phần thập phân**) |
| `string` | Bulk string |
| `table` | Array — **dừng ở phần tử `nil` đầu tiên** |
| `false` / `nil` | `(nil)` |
| `true` | `(integer) 1` |

Bẫy phổ biến: muốn trả số thực thì phải `return tostring(3.9)`, còn `return {1, nil, 3}` chỉ trả về `1`.

### `SCRIPT LOAD` + `EVALSHA` — đừng gửi cả script mỗi lần

```
127.0.0.1:6379> SCRIPT LOAD "return redis.call('GET',KEYS[1])"
"620cd258c2c9c88c9d10db67812ccf663d96bdc6"
127.0.0.1:6379> EVALSHA 620cd258c2c9c88c9d10db67812ccf663d96bdc6 1 foo
"bar"
127.0.0.1:6379> EVALSHA khongtontai 1 foo
(error) NOSCRIPT No matching script. Please use EVAL.
```

`EVALSHA` chỉ gửi 40 ký tự thay vì cả script. **Nhưng** cache script bị xoá khi Redis restart hoặc khi
ai đó gọi `SCRIPT FLUSH` → bạn nhận `NOSCRIPT`. Client tốt tự xử lý: `ioredis` có `defineCommand` làm
việc này tự động.

```js
redis.defineCommand('muaHang', {
  numberOfKeys: 1,
  lua: `local n=tonumber(redis.call('GET',KEYS[1]))
        if n and n>0 then redis.call('DECR',KEYS[1]) return 1 else return 0 end`,
});
const kq = await redis.muaHang('ton-kho');   // tự EVALSHA, tự fallback sang EVAL nếu NOSCRIPT
```

### ⚠️ Script chạy lâu **treo cả server** — và cách cứu

Redis chỉ có một luồng. Script Lua vòng lặp lớn giữ nguyên luồng đó. Đo thật:

```
GET lúc server rảnh:              1ms
GET lúc một script Lua đang chạy: 1431ms
```

Sau `busy-reply-threshold` (mặc định 5000ms), Redis bắt đầu **từ chối** mọi lệnh khác:

```js
busy-reply-threshold = 5000 ms
A nhận: BUSY Redis is busy running a script. You can only call SCRIPT KILL or SHUTDOWN NOSAVE.
SCRIPT KILL -> OK
B nhận: ERR Script killed by user with SCRIPT KILL... script: 42b3a52c5677da85767c6c3afeef5d082ca82370
GET sau khi kill -> 1
```

Đây là kịch bản sự cố thật: app đang chết, mọi lệnh trả `BUSY`. Cách xử lý:

```
127.0.0.1:6379> SCRIPT KILL
OK
```

⚠️ **`SCRIPT KILL` chỉ giết được script CHƯA ghi gì.** Nếu script đã gọi một lệnh ghi, Redis từ chối
giết (vì sẽ để lại dữ liệu nửa vời) và cách duy nhất là `SHUTDOWN NOSAVE` — tức mất toàn bộ dữ liệu chưa
lưu. Nên: **script phải ngắn và có giới hạn vòng lặp rõ ràng**.

### Redis Functions — bản thay thế của `SCRIPT LOAD` (Redis 7+)

```
FUNCTION LOAD "#!lua name=thu-vien
redis.register_function('mua_hang', function(keys, args)
  local n = tonumber(redis.call('GET', keys[1]))
  if n and n > 0 then redis.call('DECR', keys[1]) return 1 end
  return 0
end)"

FCALL mua_hang 1 ton-kho
```

Khác `EVALSHA`: function **tồn tại qua restart** (được lưu vào RDB/AOF) và có tên đọc được thay vì SHA.
Trong phỏng vấn, biết là có nó và biết khác biệt này là đủ.

---

## 5. Khoá phân tán — làm đúng và làm sai

Bài toán: nhiều tiến trình (nhiều pod), chỉ một được chạy một đoạn việc.

### Lấy khoá

```
127.0.0.1:6379> SET khoa:don-hang token-A NX EX 30
OK
127.0.0.1:6379> SET khoa:don-hang token-B NX EX 30
(nil)                           ← người khác đang giữ
```

Hai thứ **bắt buộc**:

1. **`EX`** — nếu tiến trình giữ khoá bị `kill -9`, khoá phải tự hết hạn. Không có nó là deadlock vĩnh viễn.
2. **Giá trị là token ngẫu nhiên**, không phải `"1"`. Lý do ở ngay dưới.

### ❌ Nhả khoá bằng `DEL` — sai, và sai âm thầm

```
127.0.0.1:6379> SET khoa:don-hang token-A NX EX 30
OK
127.0.0.1:6379> DEL khoa:don-hang
(integer) 1
127.0.0.1:6379> SET khoa:don-hang token-B NX EX 30
OK
127.0.0.1:6379> GET khoa:don-hang
"token-B"
```

Kịch bản hỏng: tiến trình A lấy khoá `EX 30`, nhưng xử lý mất 35 giây (GC pause, DB chậm). Ở giây thứ
30 khoá hết hạn, B lấy được. Giây 35 A xong việc và gọi `DEL` — **xoá mất khoá của B**. Giờ C cũng lấy
được khoá, và B với C chạy song song. Đúng cái bạn định ngăn.

### ✅ Nhả khoá bằng Lua, kiểm tra token

```
127.0.0.1:6379> SET khoa:x token-A EX 30
OK
127.0.0.1:6379> EVAL "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end" 1 khoa:x token-SAI
(integer) 0
127.0.0.1:6379> GET khoa:x
"token-A"                       ← không bị xoá nhầm

127.0.0.1:6379> EVAL "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end" 1 khoa:x token-A
(integer) 1
127.0.0.1:6379> EXISTS khoa:x
(integer) 0
```

Phải là **Lua** chứ không phải `GET` rồi `DEL` trong app — vì giữa hai lệnh đó khoá vẫn có thể hết hạn.

Bản hoàn chỉnh trong Node:

```js
import { randomUUID } from 'node:crypto';

const NHA_KHOA = `if redis.call('GET',KEYS[1])==ARGV[1]
                  then return redis.call('DEL',KEYS[1]) else return 0 end`;

async function voiKhoa(ten, thoiHanMs, viec) {
  const token = randomUUID();
  const lay = await redis.set(ten, token, 'PX', thoiHanMs, 'NX');
  if (lay !== 'OK') throw new Error('Không lấy được khoá');
  try {
    return await viec();
  } finally {
    await redis.eval(NHA_KHOA, 1, ten, token);
  }
}
```

### Ba giới hạn phải nói ra khi phỏng vấn

**a) Khoá có thể hết hạn giữa lúc đang làm việc.** Không có cách nào tránh hoàn toàn. Giảm nhẹ bằng
*watchdog*: một `setInterval` gia hạn khoá mỗi `thoiHan/3` khi công việc còn chạy — cũng bằng Lua có
kiểm tra token:

```lua
if redis.call('GET', KEYS[1]) == ARGV[1]
then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end
```

**b) Nhân bản là bất đồng bộ.** Master nhận khoá, chưa kịp đẩy xuống replica thì chết; Sentinel nâng
replica lên master; replica đó **không có khoá** → hai tiến trình cùng giữ. Đây là lỗ hổng cấu trúc của
mọi khoá Redis một node.

**c) Redlock (khoá trên N node độc lập) tồn tại nhưng gây tranh cãi.** Martin Kleppmann chỉ ra nó không
an toàn khi có GC pause hoặc lệch đồng hồ; Salvatore Sanfilippo (tác giả Redis) phản biện lại. Câu trả
lời an toàn khi phỏng vấn:

> "Khoá Redis phù hợp cho **tối ưu** — tránh làm trùng việc, giảm tải. Nếu việc trùng gây hỏng dữ liệu
> thật (trừ tiền hai lần), em không dựa vào khoá mà thêm **fencing token** hoặc ràng buộc unique ở
> database — tức là tầng dưới cùng phải tự bảo vệ được."

---

## 6. Chọn công cụ nào

| Tình huống | Dùng |
|---|---|
| Một lệnh là đủ (`INCR`, `SET NX`, `SADD`, `ZADD GT`) | **Lệnh đơn** — luôn thử trước |
| Nhiều lệnh độc lập, không cần đọc kết quả giữa chừng | `MULTI`/`EXEC` (hoặc pipeline) |
| Cần đọc rồi mới quyết định ghi, tranh chấp **thấp** | `WATCH` + `MULTI` |
| Cần đọc rồi mới quyết định ghi, tranh chấp **cao** | **Lua** |
| Logic phức tạp, nhiều bước, cần nguyên tử | **Lua** |
| Chỉ muốn giảm số vòng mạng, không cần nguyên tử | **Pipeline** ([bài 10](./10-thuc-chien-nodejs.md)) |

⚠️ Phân biệt **pipeline** và `MULTI`: pipeline chỉ gom nhiều lệnh gửi một lần để tiết kiệm mạng — các
lệnh khác **vẫn** chen vào giữa được. `MULTI` mới bảo đảm không ai chen. Đây là câu hỏi phỏng vấn rất
hay bị trả lời sai.

---

## 7. Bài tập

1. Tái hiện thí nghiệm bán hàng: đặt `ton-kho = 1`, cho 20 client đồng thời mua bằng `GET` rồi `DECR`.
   Bạn bán được mấy đơn?
2. Viết lại bằng ba cách (giá trị trả về, `WATCH`, Lua) và xác nhận cả ba đều ra đúng 1.
3. Chứng minh `MULTI` không rollback: tạo một khối có một lệnh lỗi kiểu ở giữa và cho thấy các lệnh
   khác vẫn chạy.
4. Viết hàm `voiKhoa` như mục 5 kèm watchdog gia hạn. Mô phỏng công việc chạy lâu hơn TTL và cho thấy
   watchdog giữ được khoá.
5. Chạy một script Lua vòng lặp 3 tỉ bước, rồi từ terminal khác gõ lệnh bất kỳ. Bạn thấy lỗi gì? Cứu
   bằng lệnh nào?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Trên máy viết tài liệu này: **17/20**, tồn kho về **-16**. Con số của bạn sẽ khác, nhưng chắc
chắn > 1.

**2.** Với `WATCH`, nhớ vòng lặp thử lại — chạy một lần rồi bỏ cuộc thì 19/20 client trả "thất bại"
thay vì "hết hàng".

**3.** Xem mục 2.

**4.**
```js
async function voiKhoaCoWatchdog(ten, hanMs, viec) {
  const token = randomUUID();
  if (await redis.set(ten, token, 'PX', hanMs, 'NX') !== 'OK') throw new Error('bận');
  const timer = setInterval(() => {
    redis.eval(`if redis.call('GET',KEYS[1])==ARGV[1]
                then return redis.call('PEXPIRE',KEYS[1],ARGV[2]) else return 0 end`,
               1, ten, token, hanMs).catch(()=>{});
  }, Math.floor(hanMs / 3));
  try { return await viec(); }
  finally { clearInterval(timer); await redis.eval(NHA_KHOA, 1, ten, token); }
}
```
Test: `voiKhoaCoWatchdog('k', 2000, () => sleep(6000))` — không có watchdog thì sau 2 giây client khác
lấy được khoá; có watchdog thì không.

**5.**
```
(error) BUSY Redis is busy running a script. You can only call SCRIPT KILL or SHUTDOWN NOSAVE.
```
Cứu bằng `SCRIPT KILL`. Nếu script đã ghi dữ liệu, `SCRIPT KILL` sẽ báo
`UNKILLABLE Sorry the script already executed write commands against the dataset...` và bạn chỉ còn
`SHUTDOWN NOSAVE`.
</details>

---

Tiếp theo: [06-pubsub-va-stream.md](./06-pubsub-va-stream.md)
