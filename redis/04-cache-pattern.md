# Bài 04 — Cache đúng cách

Đây là bài quan trọng nhất trong bộ này. Ghi cache thì ai cũng làm được; **xoá cache đúng lúc** mới là
chỗ sinh bug, và bốn sự cố kinh điển dưới đây là thứ người phỏng vấn hỏi để phân biệt "đã dùng thật"
với "đã đọc tài liệu".

---

## 1. Cache-aside — mẫu bạn sẽ dùng 90% thời gian

```js
async function laySanPham(id) {
  const key = `sp:${id}`;

  const cache = await redis.get(key);              // 1. hỏi cache
  if (cache) return JSON.parse(cache);             // 2. trúng → trả luôn

  const row = await db.sanPham.findById(id);       // 3. trượt → hỏi DB
  await redis.set(key, JSON.stringify(row), 'EX', 300);  // 4. nạp lại cache
  return row;
}
```

Bốn bước, tên gọi khác là *lazy loading*. Đặc điểm: **cache chỉ chứa thứ đã từng được hỏi**. Deploy
xong cache trống, và nó tự ấm dần.

Ưu điểm: đơn giản, chịu được việc Redis chết (chỉ chậm đi, không sập). Nhược điểm: request đầu tiên
luôn chậm, và có **cửa sổ dữ liệu cũ** dài bằng TTL.

Ba mẫu khác, để biết mà trả lời phỏng vấn:

| Mẫu | Cách hoạt động | Khi nào dùng |
|---|---|---|
| **Cache-aside** | App tự đọc/ghi cache | Mặc định. Đọc nhiều, ghi ít |
| **Read-through** | Thư viện cache tự gọi DB khi trượt | Khi dùng framework cache có sẵn |
| **Write-through** | Ghi DB **và** cache trong cùng thao tác | Cần cache luôn tươi, chấp nhận ghi chậm hơn |
| **Write-behind** | Ghi cache trước, đẩy xuống DB sau | Ghi cực nhiều (đếm view). **Mất dữ liệu nếu Redis chết** |

---

## 2. Xoá cache — thứ tự quyết định đúng sai

Khi dữ liệu thay đổi, có bốn cách viết. Ba trong số đó sai.

### ❌ Cách 1: Ghi DB rồi **cập nhật** cache

```js
await db.update(id, data);
await redis.set(`sp:${id}`, JSON.stringify(data), 'EX', 300);
```

Sai vì: hai request cùng sửa, thứ tự ghi DB và ghi cache có thể đảo nhau.

```
Request A: ghi DB = v1
Request B: ghi DB = v2
Request B: ghi cache = v2
Request A: ghi cache = v1        ← DB có v2, cache có v1, sai vĩnh viễn tới hết TTL
```

Ngoài ra, nếu `data` khác với thứ mà hàm đọc trả về (thiếu quan hệ, thiếu trường tính toán), bạn vừa
nhét dữ liệu sai vào cache.

### ❌ Cách 2: **Xoá** cache rồi ghi DB

```js
await redis.del(`sp:${id}`);
await db.update(id, data);
```

Sai vì: giữa hai dòng đó có một request đọc chen vào.

```
Request A: xoá cache
Request B: đọc cache → trượt
Request B: đọc DB → lấy giá trị CŨ
Request A: ghi DB = giá trị mới
Request B: ghi giá trị CŨ vào cache     ← cache sai tới hết TTL
```

### ✅ Cách 3: Ghi DB rồi **xoá** cache (*cache-aside invalidation*)

```js
await db.update(id, data);
await redis.del(`sp:${id}`);          // hoặc unlink
```

Đây là cách chuẩn. Vẫn có một cửa sổ lý thuyết rất hẹp để sai (một request đọc DB trước khi A ghi, rồi
ghi cache sau khi A xoá) nhưng cửa sổ đó nhỏ hơn hàng nghìn lần cách 2, vì thời gian "đọc DB → ghi
cache" ngắn hơn nhiều so với "ghi DB".

**Chi tiết dễ quên:** nếu `redis.del` thất bại (Redis mất mạng vài giây), cache sai cho tới hết TTL.
Với dữ liệu nhạy cảm, dùng thêm **xoá trễ**:

```js
await db.update(id, data);
await redis.del(`sp:${id}`);
setTimeout(() => redis.del(`sp:${id}`).catch(() => {}), 500);   // xoá lần hai
```

### ✅ Cách 4: Đổi khoá thay vì xoá (*versioned key*)

```js
const v = await redis.incr(`ver:sp:${id}`);       // tăng phiên bản
const key = `sp:${id}:v${v}`;                     // khoá mới hoàn toàn
```

Không bao giờ có cache sai vì khoá cũ không còn ai đọc tới. Đổi lại tốn RAM cho tới khi khoá cũ hết hạn.
Rất hợp cho cache nặng, đổi hiếm (ví dụ trang danh mục).

---

## 3. Cache stampede (giẫm đạp) — đo thật 100 lần gọi DB thành 1

Khoá cache hết hạn đúng lúc traffic cao: **mọi** request cùng trượt, cùng đâm vào database.

Đo thật, 100 request đồng thời cho cùng một sản phẩm, query DB giả lập mất 300ms:

```
$ node stampede.mjs
cache-aside trần  : 100 request đồng thời → gọi DB 100 lần, mất 312ms
có khoá NX        : 100 request đồng thời → gọi DB 1 lần, mất 327ms
```

100 lần chạm DB thay vì 1. Trên production với query nặng, đó là database sập.

Code của phiên bản có khoá:

```js
async function layCoKhoa(id) {
  const key = `sp:${id}`;
  const hit = await redis.get(key);
  if (hit) return hit;

  const khoa = `khoa:${key}`;
  const token = Math.random().toString(36).slice(2);
  const lay = await redis.set(khoa, token, 'NX', 'EX', 10);   // ← chỉ 1 người lấy được

  if (lay === 'OK') {
    const data = await truyVanDB(id);
    await redis.set(key, data, 'EX', 60);
    // nhả khoá an toàn: chỉ xoá nếu vẫn là khoá của mình
    await redis.eval(
      "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end",
      1, khoa, token);
    return data;
  }

  // không lấy được khoá → chờ người kia nạp xong
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 20));
    const v = await redis.get(key);
    if (v) return v;
  }
  return truyVanDB(id);       // hết kiên nhẫn, tự đi lấy
}
```

Ba chi tiết dễ làm sai:

1. **Khoá phải có TTL** (`EX 10`). Nếu tiến trình giữ khoá bị kill, không có TTL thì mọi request khác
   treo vĩnh viễn.
2. **Nhả khoá phải kiểm tra token** bằng Lua. `DEL` thẳng có thể xoá nhầm khoá mà người khác vừa lấy —
   xem [bài 05 mục 5](./05-transaction-va-lua.md).
3. **Phải có đường thoát** khi chờ quá lâu, nếu không một Redis chậm biến thành toàn bộ request treo.

### Cách thứ hai: làm mới sớm (probabilistic early expiration)

Thay vì chờ hết hạn, cho request tự nguyện làm mới cache khi TTL còn ít:

```js
const [data, ttl] = await redis.multi().get(key).ttl(key).exec()
  .then(r => [r[0][1], r[1][1]]);

if (data) {
  // TTL còn < 10% thì có ~10% cơ hội tự làm mới trong nền
  if (ttl < TTL_GOC * 0.1 && Math.random() < 0.1) {
    lamMoiTrongNen(id);        // không await
  }
  return JSON.parse(data);
}
```

Ưu điểm so với khoá: không request nào phải chờ. Nhược điểm: phức tạp hơn, và không bảo đảm tuyệt đối
chỉ một người làm mới.

---

## 4. Cache penetration (xuyên cache) — đo thật 200 lần chạm DB thành 1

Ai đó gọi `/api/san-pham/999999` liên tục. Id này **không tồn tại** trong DB. Cache-aside trần không
bao giờ ghi gì vào cache (vì không có dữ liệu để ghi), nên **mọi** request đều xuống DB:

```
$ node xuyen-cache.mjs
không chống xuyên       : 200 request id không tồn tại → 200 lần chạm DB
cache cả kết quả rỗng   : 200 request id không tồn tại → 1 lần chạm DB
```

Sửa: **cache cả kết quả rỗng**, với TTL ngắn hơn hẳn.

```js
async function coChongXuyen(id) {
  const c = await redis.get(`sp:${id}`);
  if (c !== null) return JSON.parse(c);    // ← "null" cũng là cache hit
  const row = await db.findById(id);
  await redis.set(`sp:${id}`, JSON.stringify(row), 'EX', row ? 300 : 30);
  return row;
}
```

Điểm mấu chốt nằm ở `if (c !== null)`, **không** phải `if (c)`. Chuỗi `"null"` là truthy, nhưng nếu bạn
viết `if (c)` thì… vẫn đúng ở đây. Cái sai thật sự là viết `if (!c) return null` sau khi parse — lúc đó
`JSON.parse("null") === null` và bạn lại coi nó là cache miss. Phân biệt rõ ba trạng thái:

| `redis.get` trả về | Nghĩa |
|---|---|
| `null` (kiểu JS) | **Cache miss** — chưa từng hỏi, phải xuống DB |
| chuỗi `"null"` | **Cache hit, giá trị là không tồn tại** — trả về null luôn |
| chuỗi JSON khác | Cache hit bình thường |

TTL ngắn (30 giây) để nếu bản ghi được tạo thật thì cache sai không kéo dài.

**Khi id bị bắn ngẫu nhiên (tấn công thật sự):** cache null không đủ, vì mỗi id sinh một khoá mới và
Redis đầy. Lúc đó dùng **Bloom filter** — module `RedisBloom` có sẵn trong Redis Stack:

```
BF.RESERVE sp-ton-tai 0.001 1000000
BF.ADD sp-ton-tai 1234
BF.EXISTS sp-ton-tai 999999      → 0, chắc chắn không tồn tại, chặn ngay
```

Bloom filter trả lời "chắc chắn không có" hoặc "có thể có" — đủ để chặn 99.9% request rác trước khi
chúng chạm cache hay DB.

---

## 5. Cache avalanche (tuyết lở) — nhiều khoá cùng chết một lúc

Khác stampede ở chỗ: stampede là **một** khoá bị nhiều request, avalanche là **nhiều** khoá cùng hết hạn.

Nguyên nhân điển hình:
- Warm cache lúc deploy với cùng một TTL cố định → đúng N giây sau, tất cả cùng chết.
- Redis restart → cache trống hoàn toàn.

Cách chống:

**a) Nhiễu ngẫu nhiên vào TTL** (đã nói ở [bài 03 mục 6](./03-ttl-va-het-han.md)):

```js
const ttl = 3600 + Math.floor(Math.random() * 600);   // 3600–4200
```

**b) Cache hai tầng.** Tầng 1 trong bộ nhớ tiến trình (Map + TTL ngắn 5–10 giây), tầng 2 là Redis. Redis
chết thì tầng 1 vẫn đỡ được vài giây cao điểm.

**c) Không để Redis chết là mất hết** — bật persistence (xem [bài 07](./07-persistence.md)) để restart
xong cache còn nguyên, hoặc dùng replica.

---

## 6. Cache breakdown (khoá nóng) — một khoá gánh hết traffic

Trang chủ, sản phẩm đang sale, bài viết viral: **một** khoá nhận 50.000 req/s. Ngay cả khi Redis chịu
được, một shard trong cluster sẽ nóng bất thường.

Cách chống:
- **Không đặt TTL** cho khoá cực nóng, thay vào đó chủ động làm mới bằng cron.
- **Nhân bản khoá**: `sp:hot:0` … `sp:hot:9`, client chọn ngẫu nhiên một bản. Trong Cluster, các khoá này
  rơi vào slot khác nhau nên tải được trải ra.
- Cache tầng ứng dụng cho đúng khoá đó.

---

## 7. Cache cái gì, và cache ở dạng nào

| Cache | Không cache |
|---|---|
| Kết quả query nặng, đọc nhiều ghi ít | Dữ liệu phải chính xác tuyệt đối (số dư, tồn kho lúc thanh toán) |
| Trang/khối HTML render sẵn | Dữ liệu riêng của từng user mà chỉ user đó xem 1 lần |
| Cấu hình, feature flag, bảng tra | Thứ mà tính lại còn rẻ hơn đi hỏi Redis |
| Kết quả gọi API bên thứ ba | Dữ liệu quá lớn (> 1MB một khoá) |

**Chọn dạng lưu:**

| Tình huống | Dạng |
|---|---|
| Luôn đọc cả object | String JSON |
| Thường chỉ đọc/sửa vài trường | Hash |
| Object rất lớn, chỉ cần vài trường | Hash + `HMGET` |
| Cần cả object và cần sửa một trường nguyên tử | Hash |

⚠️ **Đừng cache object quá lớn.** Một khoá 1MB đọc 1000 lần/giây là 1GB/s qua mạng — Redis nghẽn không
phải vì CPU mà vì băng thông. Kiểm tra bằng `INFO stats`:

```
total_net_output_bytes:429872
```

---

## 8. Khi Redis chết thì app phải làm gì

Câu hỏi phỏng vấn hay bị trả lời hụt. Nguyên tắc: **cache chết không được làm app chết.**

```js
async function layCoDuPhong(id) {
  try {
    const c = await redis.get(`sp:${id}`);
    if (c) return JSON.parse(c);
  } catch (e) {
    logger.warn({ e }, 'Redis lỗi, bỏ qua cache');    // KHÔNG throw
  }

  const row = await db.findById(id);

  redis.set(`sp:${id}`, JSON.stringify(row), 'EX', 300)
       .catch(() => {});                              // ghi cache lỗi cũng bỏ qua
  return row;
}
```

Hai điều bổ sung:

1. **Đặt timeout ngắn cho lệnh Redis.** Nếu Redis treo, `await redis.get` không timeout sẽ giữ request
   vô hạn — Redis chết biến thành app chết. Trong `ioredis`:
   ```js
   new Redis({ host, port, commandTimeout: 200, maxRetriesPerRequest: 1 });
   ```
2. **Có circuit breaker.** Khi Redis lỗi liên tục, ngừng gọi nó trong 30 giây thay vì mỗi request lại
   chờ timeout 200ms.

Nhưng nhớ: bỏ cache nghĩa là **toàn bộ** traffic đập vào DB. Nếu DB không chịu nổi thì "graceful
degradation" biến thành sập dây chuyền. Với hệ thống lớn, cần thêm rate limit ở tầng trước.

---

## 9. Bài tập

1. Cài đặt `layTran` và `layCoKhoa` như mục 3, chạy 100 request đồng thời và đếm số lần chạm DB. Bạn có
   ra 100 → 1 không?
2. Chứng minh cách "xoá cache rồi ghi DB" sai, bằng cách chèn `await sleep(100)` giữa hai bước và cho
   một request đọc chen vào.
3. Viết hàm cache có chống xuyên (cache null 30 giây) và kiểm tra bằng 200 request cho một id không tồn
   tại.
4. Cấu hình `ioredis` với `commandTimeout: 200`, rồi dừng container Redis giữa chừng — app của bạn trả
   lỗi 500 hay vẫn trả dữ liệu từ DB?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Nếu bạn ra 100 → 2 hoặc 3, kiểm tra xem đã dùng `SET ... NX` chưa (không phải `SETNX` rồi
`EXPIRE` riêng) và vòng chờ có đủ dài không.

**2.**
```js
// Request A
await redis.del('sp:1');
await sleep(100);                    // mô phỏng ghi DB chậm
await db.update(1, { gia: 200 });

// Request B, chạy trong lúc A đang sleep
await layTran(1);                    // đọc DB thấy giá 100, ghi 100 vào cache

// Sau khi A xong:
await redis.get('sp:1');             // "100" — sai, DB đang là 200
```

**3.** Điểm dễ sai là kiểm tra `c !== null` chứ không phải `!c`, và TTL cho null phải khác TTL cho dữ
liệu thật.

**4.** Nếu bạn `throw` khi Redis lỗi thì được 500. Bọc `try/catch` như mục 8 thì app vẫn trả dữ liệu,
chỉ chậm hơn. Thử `docker stop redis-lab` giữa lúc chạy load test để thấy khác biệt.
</details>

---

Tiếp theo: [05-transaction-va-lua.md](./05-transaction-va-lua.md)
