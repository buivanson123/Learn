# Bài 10 — Redis trong Node.js

Từ đây trở đi là code chạy được. Mọi con số trong bài đo trên `node v22.23.2`, `ioredis@6.0.0`,
`redis@6.2.1`, Redis 8.10.0.

---

## 1. Chọn thư viện: `ioredis` hay `node-redis`

| | `ioredis` (6.0.0) | `node-redis` (6.2.1) |
|---|---|---|
| Tên lệnh | `hgetall`, `zadd` (thường) | `hGetAll`, `zAdd` (camelCase) |
| Tuỳ chọn lệnh | Tham số rời: `set(k, v, 'EX', 60)` | Object: `set(k, v, { expiration: { type:'EX', value:60 } })` |
| `multi().exec()` trả về | `[[err, val], ...]` | `[val, ...]` |
| Cluster / Sentinel | Sẵn có, chín muồi | Có |
| Lua tự đặt tên | `defineCommand` | `scripts` khi tạo client |
| Được dùng nhiều ở | BullMQ và phần lớn hệ sinh thái | Chính thức của Redis |

Cả hai đều tốt. Nếu bạn định dùng **BullMQ** thì `ioredis` là lựa chọn tự nhiên vì BullMQ dựng trên nó.
Tài liệu này dùng `ioredis`.

Kiểm chứng cả hai (đã chạy thật):

```js
// --- node-redis v6 ---
import { createClient } from 'redis';
const nr = createClient({ url: 'redis://127.0.0.1:6379' });
nr.on('error', e => console.log('lỗi:', e.message));
await nr.connect();
await nr.set('nr:key', 'xin chao', { expiration: { type: 'EX', value: 60 } });
await nr.get('nr:key');            // 'xin chao'
await nr.hSet('nr:user', { ten: 'Vanson', tuoi: '28' });
await nr.hGetAll('nr:user');       // { ten: 'Vanson', tuoi: '28' }
await nr.multi().incr('nr:dem').incr('nr:dem').exec();   // [ 1, 2 ]
await nr.close();

// --- ioredis v6 ---
import Redis from 'ioredis';
const io = new Redis({ host: '127.0.0.1', port: 6379 });
await io.set('io:key', 'xin chao', 'EX', 60);
await io.get('io:key');            // 'xin chao'
await io.hset('io:user', { ten: 'Vanson', tuoi: 28 });
await io.hgetall('io:user');       // { ten: 'Vanson', tuoi: '28' }
await io.multi().incr('io:dem').incr('io:dem').exec();   // [ [ null, 1 ], [ null, 2 ] ]
await io.quit();
```

Để ý `hgetall` trả về `tuoi: '28'` — **chuỗi**, ở cả hai thư viện. Redis không có kiểu số.

---

## 2. Kết nối đúng cách

```js
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,

  commandTimeout: 200,           // ← lệnh treo quá 200ms thì bỏ
  maxRetriesPerRequest: 1,       // ← không retry mãi
  connectTimeout: 2000,
  enableOfflineQueue: false,     // ← Redis chết thì lỗi ngay, không xếp hàng chờ

  retryStrategy: (lan) => Math.min(lan * 200, 5000),   // backoff khi mất kết nối
});

redis.on('error', (e) => logger.warn({ e }, 'Redis lỗi'));
redis.on('connect', () => logger.info('Redis đã kết nối'));
```

Ba tuỳ chọn quan trọng nhất và lý do:

- **`commandTimeout`** — không có nó, Redis treo biến thành **app treo**. Cache là thứ được phép chậm,
  không được phép giữ request vô hạn.
- **`enableOfflineQueue: false`** — mặc định `ioredis` xếp mọi lệnh vào hàng đợi khi mất kết nối, rồi
  gửi ồ ạt khi nối lại. Với cache, thà lỗi ngay để rơi xuống DB còn hơn.
- **`maxRetriesPerRequest: 1`** — hạn chế khuếch đại tải khi Redis đang khoẻ dở.

⚠️ **BullMQ yêu cầu `maxRetriesPerRequest: null`** cho connection của nó. Dùng **client riêng** cho
queue, đừng dùng chung với client cache.

### Một client hay nhiều client

| Việc | Client |
|---|---|
| Cache, đọc/ghi thường | Client chung (dùng lại) |
| `SUBSCRIBE` / `PSUBSCRIBE` | **Client riêng** — kết nối vào chế độ subscribe không chạy lệnh khác được |
| `BLPOP` / `BRPOP` / `XREAD BLOCK` | **Client riêng** — nó chiếm kết nối trong lúc chờ |
| BullMQ | **Client riêng** (cấu hình khác) |

---

## 3. Pipeline — đo thật, nhanh gấp 100 lần

Vấn đề không phải Redis chậm, mà là **số vòng mạng**. 1000 lệnh tuần tự = 1000 lượt đi về.

```js
await do_('1000 GET tuần tự (await từng cái)', async () => {
  for (let i = 0; i < 1000; i++) await r.get(`sp:${i}`);
});
await do_('1000 GET bằng Promise.all', () => Promise.all(...));
await do_('1000 GET bằng pipeline()', ...);
await do_('1 lệnh MGET 1000 khoá', ...);
```

```
$ node pipeline.mjs
1000 GET tuần tự (await từng cái)    205ms  (1000 giá trị)
1000 GET bằng Promise.all              9ms  (1000 giá trị)
1000 GET bằng pipeline()               7ms  (1000 giá trị)
1 lệnh MGET 1000 khoá                  2ms  (1000 giá trị)
```

**205ms → 2ms.** Ba điều rút ra:

1. **`await` trong vòng lặp là kẻ giết hiệu năng.** Đây là lỗi phổ biến nhất khi dùng Redis từ Node.
2. **`Promise.all` gần bằng pipeline** trong `ioredis`, vì nó tự gom các lệnh phát ra trong cùng một tick
   của event loop thành một gói.
3. **Lệnh gộp sẵn (`MGET`, `MSET`, `HMGET`) vẫn nhanh nhất** — một lệnh thay vì 1000 lệnh.

Từ phía server, `redis-benchmark` cho thấy cùng hiệu ứng:

```
$ redis-benchmark -n 100000 -t set,get -q
SET: 178253.12 requests per second, p50=0.135 msec
GET: 164473.69 requests per second, p50=0.143 msec

$ redis-benchmark -n 100000 -t set,get -P 100 -q
SET: 2500000.00 requests per second, p50=1.655 msec
GET: 3333333.50 requests per second, p50=1.263 msec
```

⚠️ **Pipeline không phải transaction.** Lệnh của client khác vẫn chen vào giữa được. Cần nguyên tử thì
`multi()` (xem [bài 05](./05-transaction-va-lua.md)).

---

## 4. Cache-aside có đủ phòng vệ

```js
const TTL = 300;

export async function laySanPham(id) {
  const key = `sp:${id}`;

  let raw = null;
  try {
    raw = await redis.get(key);
  } catch (e) {
    logger.warn({ e }, 'Redis lỗi khi đọc, bỏ qua cache');
  }

  if (raw !== null) return JSON.parse(raw);       // ← !== null, để "null" cũng là hit

  const row = await db.sanPham.findById(id);

  const ttl = (row ? TTL : 30)                     // chống xuyên cache
            + Math.floor(Math.random() * 60);      // chống tuyết lở
  redis.set(key, JSON.stringify(row), 'EX', ttl).catch(() => {});

  return row;
}

export async function capNhatSanPham(id, data) {
  await db.sanPham.update(id, data);               // ghi DB TRƯỚC
  await redis.unlink(`sp:${id}`).catch(() => {});  // rồi XOÁ cache (không phải SET)
}
```

Bốn quyết định trong 20 dòng trên, mỗi cái đều có lý do ở [bài 04](./04-cache-pattern.md):
ghi DB trước rồi xoá cache; cache cả kết quả rỗng với TTL ngắn; TTL có nhiễu; lỗi Redis không làm chết
request.

Chống giẫm đạp (đo thật: 100 lần chạm DB → 1):

```js
const NHA_KHOA = `if redis.call('GET',KEYS[1])==ARGV[1]
                  then return redis.call('DEL',KEYS[1]) else return 0 end`;

export async function layCoKhoa(id) {
  const key = `sp:${id}`;
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  const khoa = `khoa:${key}`, token = randomUUID();
  if (await redis.set(khoa, token, 'NX', 'EX', 10) === 'OK') {
    try {
      const row = await db.sanPham.findById(id);
      await redis.set(key, JSON.stringify(row), 'EX', 300);
      return row;
    } finally {
      await redis.eval(NHA_KHOA, 1, khoa, token);
    }
  }
  for (let i = 0; i < 50; i++) {                   // chờ người kia nạp xong
    await new Promise(r => setTimeout(r, 20));
    const v = await redis.get(key);
    if (v !== null) return JSON.parse(v);
  }
  return db.sanPham.findById(id);                  // đường thoát
}
```

```
cache-aside trần  : 100 request đồng thời → gọi DB 100 lần, mất 312ms
có khoá NX        : 100 request đồng thời → gọi DB 1 lần,   mất 327ms
```

---

## 5. Rate limiter — hai kiểu, đo thật cả hai

### Cửa sổ cố định

```lua
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { n, redis.call('PTTL', KEYS[1]) }
```

```
— Cửa sổ cố định, giới hạn 5 request / 1000ms —
  request 1: đếm=1 ttl=1000ms → CHO QUA
  request 2: đếm=2 ttl=999ms  → CHO QUA
  request 3: đếm=3 ttl=998ms  → CHO QUA
  request 4: đếm=4 ttl=998ms  → CHO QUA
  request 5: đếm=5 ttl=997ms  → CHO QUA
  request 6: đếm=6 ttl=997ms  → CHẶN 429
  request 7: đếm=7 ttl=997ms  → CHẶN 429
```

Rẻ nhất (1 khoá string), nhưng có lỗ hổng ở ranh giới cửa sổ — đo thật:

```
— Lỗ hổng của cửa sổ cố định: 10 request lọt trong 1 giây quanh mốc reset —
  cuối cửa sổ 1: đã dùng 5/5
  đầu cửa sổ 2 (ngay sau đó): thêm 5 request nữa lọt → tổng 10 trong ~1 giây
```

Giới hạn danh nghĩa là 5/giây, thực tế cho lọt **10 request trong ~1 giây**.

### Cửa sổ trượt bằng Sorted Set

```lua
local now      = tonumber(ARGV[1])
local cua_so   = tonumber(ARGV[2])
local gioi_han = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - cua_so)   -- bỏ mục quá cũ
local dem = redis.call('ZCARD', KEYS[1])
if dem < gioi_han then
  redis.call('ZADD', KEYS[1], now, ARGV[4])
  redis.call('PEXPIRE', KEYS[1], cua_so)
  return 1
end
return 0
```

```
— Cửa sổ trượt, giới hạn 5 request / 1000ms —
  request 1: CHO QUA   (ZCARD=1)
  request 2: CHO QUA   (ZCARD=2)
  request 3: CHO QUA   (ZCARD=3)
  request 4: CHO QUA   (ZCARD=4)
  request 5: CHO QUA   (ZCARD=5)
  request 6: CHẶN 429   (ZCARD=5)
  request 7: CHẶN 429   (ZCARD=5)
  sau khi chờ 1050ms: CHO QUA
```

Chính xác hơn, nhưng mỗi khoá lưu N mục thay vì một số → tốn RAM hơn nhiều. Với 1 triệu user × 100
request/phút, đó là 100 triệu phần tử sorted set.

**Chọn:** cửa sổ cố định cho API thường; cửa sổ trượt cho endpoint nhạy cảm (đăng nhập, gửi OTP, thanh
toán) nơi việc lọt gấp đôi là vấn đề.

⚠️ `ARGV[4]` (mã định danh của mục) phải **duy nhất**. Dùng `${Date.now()}-${randomUUID()}`; nếu chỉ
dùng timestamp thì hai request cùng mili giây ghi đè nhau và bộ đếm thiếu.

---

## 6. Session

```js
const TTL_SESSION = 30 * 60;   // 30 phút

export async function taoSession(userId) {
  const sid = randomUUID();
  await redis.hset(`session:${sid}`, { userId: String(userId), taoLuc: String(Date.now()) });
  await redis.expire(`session:${sid}`, TTL_SESSION);
  await redis.sadd(`session:cua-user:${userId}`, sid);   // để đăng xuất mọi thiết bị
  return sid;
}

export async function laySession(sid) {
  const s = await redis.hgetall(`session:${sid}`);
  if (Object.keys(s).length === 0) return null;          // ← HGETALL trả {} khi không có
  await redis.expire(`session:${sid}`, TTL_SESSION, 'GT'); // gia hạn, không bao giờ rút ngắn
  return s;
}

export async function dangXuatMoiThietBi(userId) {
  const sids = await redis.smembers(`session:cua-user:${userId}`);
  if (sids.length) await redis.unlink(...sids.map(s => `session:${s}`));
  await redis.unlink(`session:cua-user:${userId}`);
}
```

Ba chi tiết:

1. **`hgetall` trả `{}` chứ không phải `null`** khi khoá không tồn tại. `if (!s)` luôn sai —
   phải là `Object.keys(s).length === 0`.
2. **`expire ... 'GT'`** để gia hạn mà không bao giờ rút ngắn (xem [bài 03](./03-ttl-va-het-han.md)).
   Đo thật: TTL đang 1800, `expire(k, 100, 'GT')` → trả `0`, TTL giữ nguyên 1800;
   `expire(k, 3600, 'GT')` → trả `1`, TTL thành 3600. Lưu ý `GT` đòi **lớn hơn hẳn**, nên đặt lại đúng
   con số hiện tại sẽ trả `0` — không sao, vì TTL luôn giảm dần theo thời gian nên lần đọc sau đó vẫn
   gia hạn được.
3. Session là dữ liệu **không được mất khi restart** → instance này phải bật AOF, và
   `maxmemory-policy` **không** được là `allkeys-lru` (sẽ đá session ngẫu nhiên). Nếu bạn dùng chung
   một Redis cho cả cache và session, hãy tách ra.

---

## 7. Hàng đợi việc

Tự dựng bằng List thì đơn giản nhưng thiếu retry, backoff, việc hẹn giờ, giao diện theo dõi. Thực tế
dùng **BullMQ** (dựng trên Redis + `ioredis`):

```js
import { Queue, Worker } from 'bullmq';

const ketNoi = { host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null };  // ← BullMQ đòi null

const hangDoi = new Queue('gui-mail', { connection: ketNoi });

await hangDoi.add('chao-mung', { userId: 1 }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: 1000,        // ← giữ 1000 job xong gần nhất, phần còn lại xoá
  removeOnFail: 5000,
});

new Worker('gui-mail', async (job) => {
  await guiMail(job.data.userId);
}, { connection: ketNoi, concurrency: 5 });
```

`removeOnComplete` là thứ hay bị quên: không có nó, mọi job đã xong nằm lại trong Redis vĩnh viễn và
đó là nguyên nhân "Redis tự nhiên đầy" rất phổ biến.

Chi tiết hơn về queue trong NestJS: [nestjs/nang-cao/05-queue-va-job-nen.md](../nestjs/nang-cao/05-queue-va-job-nen.md).

---

## 8. Dùng trong NestJS

Cách gọn nhất là một module với custom provider:

```ts
// redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [{
    provide: REDIS,
    useFactory: () => new Redis({
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      commandTimeout: 200,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    }),
  }],
  exports: [REDIS],
})
export class RedisModule {}
```

```ts
// san-pham/san-pham.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

@Injectable()
export class SanPhamService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async layMot(id: number) {
    const key = `sp:${id}`;
    const raw = await this.redis.get(key).catch(() => null);
    if (raw !== null) return JSON.parse(raw);

    const row = await this.repo.findOneBy({ id });
    await this.redis.set(key, JSON.stringify(row), 'EX', row ? 300 : 30).catch(() => {});
    return row;
  }
}
```

⚠️ Đóng kết nối khi app tắt, nếu không process không thoát:

```ts
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  async onModuleDestroy() { await this.redis.quit(); }
}
```

Trong Docker Compose, `REDIS_HOST` là **tên service** chứ không phải `localhost`:

```yaml
services:
  api:
    environment:
      REDIS_HOST: redis          # ← không phải 127.0.0.1
  redis:
    image: redis:8-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes: [redis-data:/data]
```

Xem thêm [docker/03-compose-dev.md](../docker/03-compose-dev.md).

---

## 9. Sáu cái bẫy trong Node — đo thật

```
--- Bẫy 1: lưu object mà quên JSON.stringify ---
  GET u:1 -> "[object Object]"
  GET u:2 -> "{\"ten\":\"Vanson\"}"

--- Bẫy 2: Redis trả về CHUỖI, không phải số ---
  typeof -> string; g + 10 = 10010; Number(g) + 10 = 110

--- Bẫy 3: HGETALL trên khoá không tồn tại trả {} chứ không phải null ---
  giá trị = {}; if (h) -> true; Object.keys(h).length -> 0

--- Bẫy 4: cache lưu null/undefined ---
  GET -> "null"; JSON.parse -> null; phân biệt được với miss? true

--- Bẫy 5: SET không TTL = rò rỉ bộ nhớ ---
  TTL 'ro-ri' -> -1 (-1 = sống mãi)

--- Bẫy 6: KEYS vs SCAN trong ioredis ---
  keys("sp:*") -> 10 khoá (1 lệnh chặn server)
  scan lặp     -> 10 khoá
```

Bẫy 2 là cái đau nhất: `await r.set('gia', 100)` rồi `(await r.get('gia')) + 10` cho ra **`"10010"`** —
không lỗi, không cảnh báo, chỉ là giá sản phẩm bỗng thành mười nghìn không trăm mười.

Cách phòng: một lớp bọc mỏng, ép kiểu ngay tại chỗ.

```js
export const cache = {
  async lay(key)          { const v = await redis.get(key); return v === null ? null : JSON.parse(v); },
  async dat(key, val, ttl){ await redis.set(key, JSON.stringify(val), 'EX', ttl); },
  async so(key)           { const v = await redis.get(key); return v === null ? null : Number(v); },
};
```

Bẫy 6, viết đúng:

```js
export async function quet(mau) {
  let cursor = '0', ra = [];
  do {
    const [c, keys] = await redis.scan(cursor, 'MATCH', mau, 'COUNT', 500);
    cursor = c;
    ra.push(...keys);
  } while (cursor !== '0');
  return [...new Set(ra)];     // ← SCAN có thể trả trùng
}
```

---

## 10. Bài tập

1. Đo lại bảng ở mục 3 trên máy bạn. Tỉ lệ giữa "tuần tự" và `MGET` là bao nhiêu?
2. Viết lớp bọc `cache` như mục 9 và dùng nó thay `redis.get/set` trong một endpoint có sẵn.
3. Cài đặt cả hai rate limiter ở mục 5 và tái hiện lỗ hổng ranh giới của cửa sổ cố định.
4. Viết session store như mục 6, kèm `dangXuatMoiThietBi`. Kiểm tra `TTL` được gia hạn mỗi lần đọc
   nhưng không bao giờ bị rút ngắn.
5. Cấu hình `commandTimeout: 200` rồi `docker pause redis-lab` giữa lúc chạy. App của bạn báo lỗi gì,
   và sau bao lâu?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Trên máy viết tài liệu này: 205ms → 2ms, tức **~100 lần**. Nếu tỉ lệ của bạn thấp hơn nhiều, có
thể Redis đang chạy cùng máy (độ trễ mạng gần bằng 0) — thử với Redis ở máy khác để thấy khác biệt thật.

**3.** Mẹo tái hiện: dùng hết hạn mức ở cuối cửa sổ (chờ tới khi `PTTL` còn ~50ms), rồi bắn tiếp ngay
sau khi TTL hết.

**5.** `ReplyError` / `Command timed out` sau đúng ~200ms. Không có `commandTimeout`, request treo cho
tới khi `docker unpause`. Đây là khác biệt giữa "cache chậm" và "app chết".
</details>

---

Tiếp theo: [11-van-hanh-va-do-luong.md](./11-van-hanh-va-do-luong.md)
