# Bài 06 — Pub/Sub và Stream

Hai cơ chế nhắn tin của Redis, khác nhau ở đúng **một** điểm quyết định mọi thứ: Pub/Sub **không lưu**
tin nhắn, Stream **có lưu**. Chọn sai là mất dữ liệu.

---

## 1. Pub/Sub — bắn đi và quên

```
127.0.0.1:6379> PUBLISH tin-tuc "khong ai nghe"
(integer) 0                     ← 0 = KHÔNG có người nghe nào nhận được
```

Con số trả về là **số subscriber đã nhận**. Trả `0` nghĩa là tin nhắn đó vừa **bốc hơi**. Không hàng
đợi, không lưu trữ, không cách nào lấy lại.

Bây giờ có người nghe:

```bash
# Terminal 1
$ redis-cli SUBSCRIBE tin-tuc
1) "subscribe"
2) "tin-tuc"
3) (integer) 1                  ← đang nghe 1 kênh
```

```
# Terminal 2
127.0.0.1:6379> PUBLISH tin-tuc "co nguoi nghe roi"
(integer) 1
127.0.0.1:6379> PUBSUB CHANNELS
1) "tin-tuc"
127.0.0.1:6379> PUBSUB NUMSUB tin-tuc
1) "tin-tuc"
2) (integer) 1
```

```bash
# Terminal 1 nhận được:
1) "message"
2) "tin-tuc"
3) "co nguoi nghe roi"
```

Nghe theo mẫu:

```
127.0.0.1:6379> PSUBSCRIBE "user:*:thong-bao"
```

Nhận về `pmessage` với 4 phần: loại, mẫu, kênh thật, nội dung.

### Bốn giới hạn của Pub/Sub (phải nhớ để không dùng nhầm)

1. **Mất tin nhắn khi client offline.** Kể cả mất kết nối 1 giây.
2. **Không có ACK.** Người gửi không biết người nhận xử lý xong chưa.
3. **Mọi subscriber đều nhận bản sao.** Không chia việc được — 3 worker cùng `SUBSCRIBE` thì mỗi việc
   bị làm 3 lần.
4. **Subscriber chậm bị ngắt kết nối.** Redis đệm output cho client; đầy đệm thì đá client ra.
   ```
   127.0.0.1:6379> CONFIG GET client-output-buffer-limit
   ... pubsub 33554432 8388608 60      ← đầy 32MB, hoặc 8MB liên tục 60 giây → bị ngắt
   ```

### Vậy Pub/Sub dùng để làm gì

Đúng một loại việc: **thông báo mà mất cũng không sao**.

- Xoá cache tầng ứng dụng trên nhiều pod: pod A sửa dữ liệu → `PUBLISH cache:xoa "sp:1"` → các pod khác
  xoá bản trong bộ nhớ của mình. Mất tin nhắn thì cache đó tự hết hạn sau vài giây.
- Nạp lại cấu hình / feature flag.
- Chat realtime "không lưu lịch sử" (lịch sử lưu ở DB, Pub/Sub chỉ để đẩy tin tới người đang online).

Nếu tin nhắn **không được phép mất**, dùng Stream.

### `SSUBSCRIBE` — Pub/Sub cho Cluster (Redis 7+)

Pub/Sub thường **phát tán tin nhắn tới mọi node** trong Cluster, kể cả node không có subscriber nào —
tốn băng thông nội bộ. `SPUBLISH`/`SSUBSCRIBE` (sharded pub/sub) giới hạn tin nhắn trong một shard theo
hash slot của tên kênh. Trong Cluster, dùng bản `S*`.

---

## 2. Stream — nhật ký có lưu, có ACK

```
127.0.0.1:6379> XADD don-hang * ma DH001 tien 250000
"1787873671519-0"
127.0.0.1:6379> XADD don-hang * ma DH002 tien 99000
"1787873671520-0"
127.0.0.1:6379> XLEN don-hang
(integer) 2
127.0.0.1:6379> XRANGE don-hang - +
1) 1) "1787873671519-0"
   2) 1) "ma"
      2) "DH001"
      3) "tien"
      4) "250000"
2) 1) "1787873671520-0"
   2) 1) "ma"
      2) "DH002"
      3) "tien"
      4) "99000"
```

Khác Pub/Sub ở chỗ: `XADD` xong thì tin nhắn **nằm đó**, ai đến sau vẫn đọc được.

**ID có dạng `<mili-giây>-<số thứ tự>`** và luôn tăng. `*` là "để Redis tự sinh". Tự đặt ID nhỏ hơn ID
lớn nhất hiện có sẽ bị từ chối:

```
127.0.0.1:6379> XADD don-hang 1000-1 ma DHCU tien 1
(error) ERR The ID specified in XADD is equal or smaller than the target stream top item
```

Tính chất "ID luôn tăng" này chính là thứ cho phép mỗi consumer nhớ "tôi đã đọc tới đâu".

### Consumer group — chia việc và không mất việc

```
127.0.0.1:6379> XGROUP CREATE don-hang nhom-xu-ly 0
OK
```

`0` = bắt đầu từ đầu stream. Dùng `$` nếu chỉ muốn nhận tin **mới từ giờ trở đi**.

```
127.0.0.1:6379> XREADGROUP GROUP nhom-xu-ly worker-1 COUNT 2 STREAMS don-hang >
1) 1) "don-hang"
   2) 1) 1) "1787873682401-0"
         2) 1) "ma"
            2) "DH001"
      2) 1) "1787873682401-1"
         2) 1) "ma"
            2) "DH002"

127.0.0.1:6379> XREADGROUP GROUP nhom-xu-ly worker-2 COUNT 2 STREAMS don-hang >
1) 1) "don-hang"
   2) 1) 1) "1787873682401-2"
         2) 1) "ma"
            2) "DH003"
```

`worker-1` nhận 2 tin, `worker-2` nhận tin **còn lại** — **không** trùng nhau. Đây là điều Pub/Sub
không làm được.

Dấu `>` nghĩa là "tin chưa ai nhận". Thay bằng `0` thì lấy lại các tin **chính worker này** đã nhận mà
chưa ACK — dùng khi worker restart.

### PEL — danh sách "đã giao, chưa xác nhận"

```
127.0.0.1:6379> XPENDING don-hang nhom-xu-ly
1) (integer) 3                  ← 3 tin đang chờ ACK
2) "1787873682401-0"            ← ID nhỏ nhất
3) "1787873682401-2"            ← ID lớn nhất
4) 1) 1) "worker-1"
      2) "2"
   2) 1) "worker-2"
      2) "1"
```

Xác nhận xong một tin:

```
127.0.0.1:6379> XACK don-hang nhom-xu-ly 1787873682401-0
(integer) 1
127.0.0.1:6379> XPENDING don-hang nhom-xu-ly - + 10
1) 1) "1787873682401-1"
   2) "worker-1"
   3) (integer) 187             ← đã chờ 187ms
   4) (integer) 1               ← đã được giao 1 lần
2) 1) "1787873682401-2"
   2) "worker-2"
   3) (integer) 186
   4) (integer) 1
```

**Đây là điểm cốt lõi:** nếu worker chết trước khi `XACK`, tin nhắn vẫn nằm trong PEL. Không mất.

### Cứu việc của worker đã chết: `XAUTOCLAIM`

```
127.0.0.1:6379> XAUTOCLAIM don-hang nhom-xu-ly worker-3 1000 0
1) "0-0"                        ← con trỏ cho lần gọi tiếp (0-0 = hết)
2) 1) 1) "1787873682401-1"
      2) 1) "ma"
         2) "DH002"
   2) 1) "1787873682401-2"
      2) 1) "ma"
         2) "DH003"
3) (empty array)                ← các ID không còn tồn tại trong stream
```

`1000` là "chỉ cướp tin đã nằm trong PEL quá 1000ms". `worker-3` giờ sở hữu cả hai tin. Chạy lệnh này
định kỳ trong một worker giám sát là bạn có hàng đợi tự phục hồi.

Xem tổng thể nhóm:

```
127.0.0.1:6379> XINFO GROUPS don-hang
1)  1) "name"
    2) "nhom-xu-ly"
    3) "consumers"
    4) (integer) 2
    5) "pending"
    6) (integer) 3
    7) "last-delivered-id"
    8) "1787873682401-2"
    9) "entries-read"
   10) (integer) 3
   11) "lag"
   12) (integer) 0              ← lag = còn bao nhiêu tin chưa giao. Đây là chỉ số cần cảnh báo
```

`lag` tăng dần nghĩa là worker xử lý không kịp — đúng chỉ số để gắn alert.

### Cắt bớt stream — bắt buộc, nếu không sẽ nổ RAM

Stream **không tự xoá**. Phải cắt:

```
127.0.0.1:6379> XLEN don-hang
(integer) 3
127.0.0.1:6379> XTRIM don-hang MAXLEN 2
(integer) 1
127.0.0.1:6379> XLEN don-hang
(integer) 2
```

Tốt hơn: cắt ngay khi ghi, và dùng `~` (xấp xỉ) cho rẻ:

```js
await r.xadd('don-hang', 'MAXLEN', '~', 100000, '*', 'ma', 'DH001');
```

`~` cho phép Redis cắt tới ranh giới node gần nhất thay vì đúng chính xác 100000 — nhanh hơn nhiều và
độ chênh không đáng kể. Có thể cắt theo thời gian: `MINID ~ <timestamp>`.

⚠️ `XTRIM`/`MAXLEN` xoá tin **kể cả khi chưa ai ACK**. Nếu worker tụt lại quá xa, việc của nó biến mất.
Đặt `MAXLEN` đủ lớn so với `lag` tối đa bạn chấp nhận.

### Đọc có chặn

```
127.0.0.1:6379> XREAD BLOCK 0 STREAMS don-hang $
```

`$` = "chỉ tin mới từ bây giờ", `BLOCK 0` = chờ vô hạn. Với consumer group:

```
XREADGROUP GROUP nhom worker-1 BLOCK 5000 COUNT 10 STREAMS don-hang >
```

Đây là vòng lặp chính của một worker thật: chờ tối đa 5 giây, lấy tối đa 10 tin, xử lý, `XACK`, lặp lại.

---

## 3. Pub/Sub vs Stream vs List — chọn cái nào

| | **Pub/Sub** | **List** (`BRPOP`) | **Stream** |
|---|---|---|---|
| Lưu tin nhắn | ❌ Không | ✅ Cho tới khi bị lấy | ✅ Cho tới khi bị `XTRIM` |
| Đọc lại lịch sử | ❌ | ❌ (lấy là mất) | ✅ `XRANGE` |
| Nhiều consumer chia việc | ❌ (ai cũng nhận) | ✅ | ✅ (consumer group) |
| Nhiều nhóm consumer độc lập | ✅ | ❌ | ✅ |
| ACK / cứu việc khi worker chết | ❌ | ❌ | ✅ (PEL + `XAUTOCLAIM`) |
| Biết còn tồn đọng bao nhiêu | ❌ | ✅ `LLEN` | ✅ `lag` |
| Độ phức tạp | Thấp nhất | Thấp | Cao nhất |

**Quy tắc chọn:**

- Thông báo mất cũng được, nhiều người cùng nhận → **Pub/Sub**
- Hàng đợi việc đơn giản, chấp nhận mất việc nếu worker chết đúng lúc → **List** + `BRPOP`
- Hàng đợi việc quan trọng, cần biết việc nào đang treo, cần chạy lại → **Stream**
- Cần đủ tính năng (retry có backoff, việc hẹn giờ, ưu tiên, giao diện theo dõi) → **BullMQ** (dựng
  trên Redis), xem [bài 10](./10-thuc-chien-nodejs.md)

⚠️ Redis Stream **không phải Kafka**. Nó không có phân vùng (partition), không lưu xuống đĩa theo kiểu
log, không giữ dữ liệu hàng tuần. Nếu bài toán là "đường ống dữ liệu 100k msg/s lưu 7 ngày", đó là
Kafka. Redis Stream hợp với "hàng đợi việc trong ứng dụng có ACK".

---

## 4. Worker Stream hoàn chỉnh trong Node

```js
import Redis from 'ioredis';

const STREAM = 'don-hang', NHOM = 'nhom-xu-ly';
const ten = `worker-${process.pid}`;
const r = new Redis(6379, '127.0.0.1');

// Tạo nhóm; bỏ qua nếu đã có
await r.xgroup('CREATE', STREAM, NHOM, '0', 'MKSTREAM')
       .catch(e => { if (!e.message.includes('BUSYGROUP')) throw e; });

async function xuLy(id, truong) {
  const data = Object.fromEntries(
    truong.reduce((a, v, i) => (i % 2 ? a[a.length-1].push(v) : a.push([v]), a), []));
  console.log('xử lý', id, data);
}

// 1) Trước tiên, lấy lại việc CHÍNH MÌNH đã nhận mà chưa ACK (sau khi restart)
let batDau = '0';
for (;;) {
  const kq = await r.xreadgroup('GROUP', NHOM, ten, 'COUNT', 10,
                                'STREAMS', STREAM, batDau);
  if (!kq || kq[0][1].length === 0) break;
  for (const [id, truong] of kq[0][1]) { await xuLy(id, truong); await r.xack(STREAM, NHOM, id); }
  batDau = kq[0][1].at(-1)[0];
}

// 2) Vòng lặp chính
for (;;) {
  const kq = await r.xreadgroup('GROUP', NHOM, ten, 'COUNT', 10, 'BLOCK', 5000,
                                'STREAMS', STREAM, '>');
  if (!kq) continue;                                  // hết 5 giây, không có gì
  for (const [id, truong] of kq[0][1]) {
    try {
      await xuLy(id, truong);
      await r.xack(STREAM, NHOM, id);                 // ← chỉ ACK khi xử lý XONG
    } catch (e) {
      console.error('lỗi, không ACK — sẽ được XAUTOCLAIM cứu', id, e);
    }
  }
}
```

Bốn chi tiết dễ sai:

1. **`MKSTREAM`** — không có nó, `XGROUP CREATE` báo lỗi nếu stream chưa tồn tại.
2. **`BUSYGROUP`** — lỗi khi nhóm đã có. Phải bắt và bỏ qua, không phải để nó làm chết tiến trình.
3. **ACK sau khi xử lý xong**, không phải trước. ACK trước = mất việc khi lỗi.
4. **Vòng lấy lại việc cũ (`'0'`)** khi khởi động — nếu bỏ qua, việc worker này nhận trước lúc crash sẽ
   nằm mãi trong PEL cho tới khi có `XAUTOCLAIM`.

Cần thêm một tiến trình giám sát chạy `XAUTOCLAIM` định kỳ để cứu việc của worker đã chết hẳn:

```js
setInterval(async () => {
  const [, tin] = await r.xautoclaim(STREAM, NHOM, ten, 60000, '0', 'COUNT', 100);
  for (const [id, truong] of tin) { await xuLy(id, truong); await r.xack(STREAM, NHOM, id); }
}, 30000);
```

---

## 5. Bài tập

1. Chứng minh Pub/Sub mất tin nhắn: `PUBLISH` khi chưa có ai nghe, xem giá trị trả về, rồi
   `SUBSCRIBE` và chứng minh tin cũ không đến.
2. Dựng stream `don-hang` với consumer group 2 worker. Cho worker-1 nhận 2 tin rồi "chết" (Ctrl-C
   trước khi ACK). Dùng `XPENDING` và `XAUTOCLAIM` để worker-3 cứu việc đó.
3. Đo `lag` của nhóm khi bạn `XADD` 1000 tin mà không worker nào chạy.
4. Thêm 5000 tin bằng `XADD ... MAXLEN ~ 1000` và bằng `XADD ... MAXLEN 1000`, so `XLEN` của hai bên.
   Kết quả có khác nhau không? Vì sao?
5. Viết worker hoàn chỉnh như mục 4 và kill -9 nó giữa lúc xử lý. Việc có được cứu không?

<details>
<summary>Gợi ý đáp án</summary>

**1.**
```
127.0.0.1:6379> PUBLISH kenh "tin-1"
(integer) 0
```
Sau đó `SUBSCRIBE kenh` từ terminal khác — không có gì hiện ra. Tin `tin-1` đã mất vĩnh viễn.

**2.**
```
XPENDING don-hang nhom-xu-ly - + 10          ← thấy 2 tin của worker-1
XAUTOCLAIM don-hang nhom-xu-ly worker-3 1000 0
```

**3.** `XINFO GROUPS don-hang` → trường `lag` sẽ là 1000.

**4.** Đo thật trên máy này, cả hai đều ra đúng **1000**:
```
XADD MAXLEN ~ 1000 sau 5000 tin -> XLEN = 1000
XADD MAXLEN 1000 (chính xác)    -> XLEN = 1000
```
Không mâu thuẫn: `~` nghĩa là "được phép giữ **nhiều hơn** 1000 nếu việc cắt chính xác đòi phải phá một
node radix tree đang dùng dở". Với dữ liệu đều và mỗi node chứa vừa đủ, hai bên trùng nhau. Chênh lệch
chỉ lộ ra khi các entry có kích thước không đều. Bài học: `~` cho phép **xấp xỉ**, không bảo đảm **lệch**
— nên vẫn phải dùng nó (rẻ hơn) và đừng viết code dựa vào `XLEN` bằng đúng một con số.

**5.** Được cứu — miễn là bạn có `XAUTOCLAIM` chạy định kỳ, hoặc worker khởi động lại với cùng tên
consumer và đọc từ `'0'`.
</details>

---

Tiếp theo: [07-persistence.md](./07-persistence.md)
