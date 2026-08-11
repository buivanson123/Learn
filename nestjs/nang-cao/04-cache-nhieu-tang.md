# Bài 4 — Cache nhiều tầng

Cache là cách rẻ nhất để tăng throughput gấp 10–100 lần. Nó cũng là nguồn bug khó chịu nhất nếu làm sai. Bài này tập trung vào **làm đúng**, đặc biệt là phần **vô hiệu hoá cache** — phần mà 90% tài liệu bỏ qua.

---

## 1. Ba tầng cache và chi phí của chúng

```
Client ──HTTP cache──► CDN ──► [ L1: RAM app ] ──► [ L2: Redis ] ──► Database
         ~0ms          ~5ms      ~0.01ms             ~1ms             ~50ms
```

| Tầng | Độ trễ | Dùng cho | Nhược điểm |
|---|---|---|---|
| **HTTP / CDN** | ~0ms | Nội dung công khai, ảnh, danh sách bài viết | Khó xoá ngay |
| **L1 — RAM app** | ~0.01ms | Dữ liệu đọc cực nhiều, ít đổi (config, feature flag) | Mỗi instance một bản → **không đồng bộ** |
| **L2 — Redis** | ~1ms | Hầu hết mọi thứ | Thêm một điểm hỏng |
| **Database** | 10–500ms | Nguồn sự thật | — |

Nguyên tắc chọn tầng: **dữ liệu càng ít thay đổi và càng nhiều người đọc chung, càng nên đẩy lên tầng cao.**

---

## 2. Cài đặt Redis cache

> ⚠️ API của `@nestjs/cache-manager` đổi đáng kể giữa các phiên bản. Nest 11 dùng `cache-manager` v6 nền Keyv. Kiểm tra `npm ls cache-manager` trước khi copy code.

### cache-manager v6 (Nest 11+)

```bash
npm i @nestjs/cache-manager cache-manager @keyv/redis keyv
```

```ts
// src/shared/cache/cache.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        stores: [createKeyv(c.getOrThrow('REDIS_URL'))],
        ttl: 60_000,              // mili-giây
      }),
    }),
  ],
})
export class AppCacheModule {}
```

### cache-manager v5 (Nest 10)

```bash
npm i @nestjs/cache-manager cache-manager cache-manager-redis-yet
```

```ts
useFactory: async (c: ConfigService) => ({
  store: await redisStore({ url: c.getOrThrow('REDIS_URL'), ttl: 60_000 }),
})
```

### Dùng cơ bản

```ts
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class PostsService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getPost(id: number) {
    const key = `post:${id}`;

    const cached = await this.cache.get<Post>(key);
    if (cached) return cached;

    const post = await this.repo.findOneBy({ id });
    if (post) await this.cache.set(key, post, 300_000);   // 5 phút
    return post;
  }
}
```

---

## 3. Cache-aside — pattern chuẩn

Bọc lại thành một helper dùng chung, để không phải viết lại `get → miss → load → set` ở khắp nơi:

```ts
// src/shared/cache/cache.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.cache.get<T>(key);
      if (hit !== undefined && hit !== null) return hit;
    } catch (err) {
      // Redis chết KHÔNG được làm chết API — chỉ log rồi đi thẳng xuống DB
      this.logger.warn(`Cache đọc lỗi (${key}): ${(err as Error).message}`);
    }

    const value = await loader();

    if (value !== undefined && value !== null) {
      this.cache.set(key, value, ttlMs).catch((err) =>
        this.logger.warn(`Cache ghi lỗi (${key}): ${err.message}`),
      );
    }
    return value;
  }
}
```

Điểm quan trọng: **cache lỗi phải xuống DB, không được ném lỗi ra ngoài.** Redis là tối ưu hoá, không phải phụ thuộc bắt buộc. Nếu Redis chết mà API cũng chết, bạn vừa tăng gấp đôi số điểm hỏng thay vì tăng tốc.

Dùng:

```ts
getPost(id: number) {
  return this.cacheService.wrap(`post:${id}`, 300_000, () =>
    this.repo.findOneBy({ id }),
  );
}
```

---

## 4. Đặt tên key — quyết định sự sống còn của việc xoá cache

Key phải **có cấu trúc** để xoá theo nhóm được.

```ts
// src/shared/cache/cache-keys.ts
export const CacheKeys = {
  post:        (id: number) => `post:${id}`,
  postBySlug:  (slug: string) => `post:slug:${slug}`,
  postList:    (hash: string) => `posts:list:${hash}`,
  userPosts:   (userId: number) => `user:${userId}:posts`,
  tagCloud:    () => `tags:cloud`,
} as const;
```

Với query có nhiều tham số, băm chúng lại để key ngắn và ổn định:

```ts
import { createHash } from 'node:crypto';

function hashQuery(obj: Record<string, unknown>): string {
  // sort key để {a:1,b:2} và {b:2,a:1} ra cùng một hash
  const sorted = Object.keys(obj).sort().map((k) => `${k}=${obj[k]}`).join('&');
  return createHash('sha1').update(sorted).digest('hex').slice(0, 16);
}

const key = CacheKeys.postList(hashQuery({ page, limit, status, tag }));
```

> ⚠️ Nếu key phụ thuộc user (dữ liệu riêng tư), **bắt buộc** đưa `userId` vào key. Quên điều này là lỗi bảo mật: user A nhìn thấy dữ liệu của user B.

---

## 5. Vô hiệu hoá cache — phần khó nhất

Ba chiến lược, dùng kết hợp.

### 5.1 TTL ngắn — đơn giản nhất, luôn nên có

Mọi key đều phải có TTL, kể cả khi bạn có cơ chế xoá chủ động. TTL là lưới an toàn cho các trường hợp bạn quên xoá.

| Loại dữ liệu | TTL gợi ý |
|---|---|
| Cấu hình, feature flag | 5–15 phút |
| Chi tiết bài viết | 5 phút |
| Danh sách bài viết | 30–60 giây |
| Bảng xếp hạng, thống kê | 1–5 phút |
| Số lượt xem | 10 giây (hoặc không cache, xem mục 8) |
| Phiên đăng nhập | bằng thời hạn token |

### 5.2 Xoá chủ động khi ghi

```ts
async update(id: number, dto: UpdatePostDto) {
  const post = await this.repo.save({ id, ...dto });

  await Promise.all([
    this.cache.del(CacheKeys.post(id)),
    this.cache.del(CacheKeys.postBySlug(post.slug)),
    this.invalidateByPrefix('posts:list:'),      // mọi danh sách đều có thể đã cũ
  ]);

  return post;
}
```

### 5.3 Xoá theo prefix — đừng dùng `KEYS`

```ts
// ❌ KEYS khoá toàn bộ Redis, với 1 triệu key có thể treo vài giây
const keys = await redis.keys('posts:list:*');
```

```ts
// ✅ SCAN duyệt từng lô, không chặn
async invalidateByPrefix(prefix: string): Promise<number> {
  let cursor = '0';
  let removed = 0;

  do {
    const [next, keys] = await this.redis.scan(
      cursor, 'MATCH', `${prefix}*`, 'COUNT', 500,
    );
    cursor = next;
    if (keys.length) {
      await this.redis.unlink(...keys);   // UNLINK xoá bất đồng bộ, nhanh hơn DEL
      removed += keys.length;
    }
  } while (cursor !== '0');

  return removed;
}
```

### 5.4 Tag-based invalidation — cách sạch nhất

Thay vì đoán xem key nào cần xoá, gắn "nhãn" cho key lúc ghi:

```ts
@Injectable()
export class TaggedCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async set<T>(key: string, value: T, ttlMs: number, tags: string[]) {
    const pipe = this.redis.multi();
    pipe.set(key, JSON.stringify(value), 'PX', ttlMs);
    for (const tag of tags) {
      pipe.sadd(`tag:${tag}`, key);                    // ghi nhận key thuộc tag
      pipe.expire(`tag:${tag}`, Math.ceil(ttlMs / 1000) + 60);
    }
    await pipe.exec();
  }

  /** Xoá mọi key mang tag này */
  async invalidateTag(tag: string): Promise<void> {
    const keys = await this.redis.smembers(`tag:${tag}`);
    if (keys.length) await this.redis.unlink(...keys);
    await this.redis.unlink(`tag:${tag}`);
  }
}
```

```ts
// Lúc ghi cache
await this.taggedCache.set(listKey, result, 60_000, ['posts', `author:${authorId}`]);

// Khi tác giả 5 sửa bất kỳ bài nào -> xoá đúng những cache liên quan
await this.taggedCache.invalidateTag(`author:5`);
```

Ưu điểm: xoá chính xác, không cần `SCAN`, không xoá thừa.

---

## 6. Cache stampede — sự cố kinh điển

Kịch bản: key `posts:hot` hết hạn đúng lúc có 5.000 request/giây. Cả 5.000 request cùng miss, cùng chạy query nặng 2 giây → DB nhận 5.000 query giống hệt nhau → sập.

```
       TTL hết hạn
            ↓
5000 req ───┼──► tất cả cùng MISS ──► 5000 query giống nhau ──► 💥 DB
```

### Giải pháp 1: Single-flight lock

Chỉ cho **một** request đi xuống DB, số còn lại chờ kết quả.

```ts
@Injectable()
export class SingleFlightCache {
  private readonly logger = new Logger(SingleFlightCache.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async wrap<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached);

    const lockKey = `lock:${key}`;
    // NX = chỉ set nếu chưa tồn tại; PX = tự hết hạn -> không kẹt vĩnh viễn
    const gotLock = await this.redis.set(lockKey, '1', 'PX', 10_000, 'NX');

    if (gotLock) {
      try {
        const value = await loader();
        await this.redis.set(key, JSON.stringify(value), 'PX', ttlMs);
        return value;
      } finally {
        await this.redis.del(lockKey);
      }
    }

    // Không giành được lock -> chờ người kia nạp xong
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const v = await this.redis.get(key);
      if (v) return JSON.parse(v);
    }

    // Chờ quá lâu -> tự đi lấy, chấp nhận thêm 1 query còn hơn treo request
    this.logger.warn(`Chờ lock quá lâu cho ${key}, tự nạp dữ liệu`);
    return loader();
  }
}
```

Hai chi tiết bắt buộc: lock phải **có TTL** (process chết giữa chừng không được khoá vĩnh viễn), và phải **có đường thoát** khi chờ quá lâu.

### Giải pháp 2: Làm mới sớm (probabilistic early expiration)

Thay vì chờ hết hạn, làm mới **ngẫu nhiên** khi gần hết hạn — các instance sẽ tự phân tán thời điểm.

```ts
async wrapWithEarlyRefresh<T>(key: string, ttlMs: number, loader: () => Promise<T>) {
  const raw = await this.redis.get(key);

  if (raw) {
    const { value, expiresAt } = JSON.parse(raw);
    const remaining = expiresAt - Date.now();

    // Còn dưới 20% thời gian -> có xác suất làm mới nền
    if (remaining < ttlMs * 0.2 && Math.random() < 0.1) {
      loader()
        .then((fresh) => this.redis.set(
          key,
          JSON.stringify({ value: fresh, expiresAt: Date.now() + ttlMs }),
          'PX', ttlMs * 2,
        ))
        .catch(() => undefined);
    }
    return value as T;      // luôn trả cache ngay, không ai phải chờ
  }

  const value = await loader();
  await this.redis.set(key, JSON.stringify({ value, expiresAt: Date.now() + ttlMs }), 'PX', ttlMs * 2);
  return value;
}
```

### Giải pháp 3: rải TTL

Đơn giản nhất, hiệu quả bất ngờ — tránh việc hàng loạt key hết hạn cùng lúc:

```ts
const jitter = Math.floor(Math.random() * 30_000);   // ±30s
await this.cache.set(key, value, baseTtl + jitter);
```

---

## 7. L1 cache trong RAM — cho dữ liệu siêu nóng

Redis mất ~1ms mỗi lần gọi. Với dữ liệu đọc hàng chục nghìn lần mỗi giây (feature flag, tỷ giá, cấu hình), thêm một tầng trong RAM.

```bash
npm i lru-cache
```

```ts
import { LRUCache } from 'lru-cache';

@Injectable()
export class ConfigCache {
  private readonly l1 = new LRUCache<string, unknown>({
    max: 5_000,          // tối đa 5000 entry
    ttl: 10_000,         // 10 giây — CỐ TÌNH ngắn
  });

  constructor(private readonly redis: Redis) {}

  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const l1Hit = this.l1.get(key) as T | undefined;
    if (l1Hit !== undefined) return l1Hit;

    const l2Hit = await this.redis.get(key);
    if (l2Hit) {
      const parsed = JSON.parse(l2Hit) as T;
      this.l1.set(key, parsed);
      return parsed;
    }

    const value = await loader();
    this.l1.set(key, value);
    await this.redis.set(key, JSON.stringify(value), 'PX', 60_000);
    return value;
  }
}
```

> ⚠️ **L1 không đồng bộ giữa các instance.** Chạy 5 container = 5 bản cache khác nhau. Vì vậy TTL của L1 phải rất ngắn (5–30 giây) và **chỉ dùng cho dữ liệu chấp nhận cũ vài giây**. Không bao giờ cache dữ liệu người dùng ở L1.
>
> Cần xoá L1 ngay lập tức trên mọi instance? Dùng Redis Pub/Sub phát tín hiệu xoá:
> ```ts
> await this.redis.publish('cache:invalidate', key);   // bên ghi
> // bên nhận: subscriber.on('message', (_ch, key) => this.l1.delete(key));
> ```

---

## 8. Cache và số liệu thay đổi liên tục

Lượt xem, lượt thích không nên ghi thẳng DB mỗi lần (10.000 UPDATE/giây trên một dòng = khoá chết).

**Gom trong Redis, xả xuống DB định kỳ:**

```ts
@Injectable()
export class ViewCounterService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  /** Gọi mỗi lần có người xem — chỉ 1 lệnh Redis, ~0.1ms */
  async increment(postId: number) {
    await this.redis.hincrby('post:views:pending', String(postId), 1);
  }

  /** Chạy mỗi 30 giây, xả toàn bộ xuống DB một lần */
  @Cron('*/30 * * * * *')
  async flush() {
    // Đổi tên key để không mất lượt xem phát sinh trong lúc đang xả
    const tmp = `post:views:flush:${Date.now()}`;
    const exists = await this.redis.renamenx('post:views:pending', tmp);
    if (!exists) return;

    const counts = await this.redis.hgetall(tmp);
    const entries = Object.entries(counts);
    if (!entries.length) return;

    // Một câu lệnh cập nhật cho toàn bộ
    await this.dataSource.query(
      `UPDATE posts AS p SET view_count = p.view_count + v.delta
       FROM (VALUES ${entries.map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::int)`).join(',')})
            AS v(id, delta)
       WHERE p.id = v.id`,
      entries.flatMap(([id, delta]) => [Number(id), Number(delta)]),
    );

    await this.redis.del(tmp);
  }
}
```

Đọc số lượt xem = `view_count` trong DB + phần đang chờ trong Redis.

Kỹ thuật `RENAMENX` rất quan trọng: nó đảm bảo không mất lượt xem phát sinh trong lúc đang xả.

---

## 9. HTTP cache — tầng rẻ nhất

Request tốt nhất là request không bao giờ tới server.

```ts
// src/shared/interceptors/http-cache.interceptor.ts
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const res = ctx.switchToHttp().getResponse<Response>();
    const req = ctx.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      tap((body) => {
        if (req.method !== 'GET') return;

        // ETag: client gửi lại If-None-Match, server trả 304 nếu chưa đổi
        const etag = createHash('sha1').update(JSON.stringify(body)).digest('hex');
        res.setHeader('ETag', `W/"${etag}"`);
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      }),
    );
  }
}
```

Ý nghĩa `Cache-Control` ở trên:

- `max-age=60` — CDN/browser dùng bản cache trong 60 giây, không hỏi server.
- `stale-while-revalidate=300` — sau 60 giây, vẫn **trả bản cũ ngay lập tức** cho người dùng đồng thời làm mới ngầm. Người dùng không bao giờ phải chờ.

Với dữ liệu riêng tư, bắt buộc:

```ts
res.setHeader('Cache-Control', 'private, no-store');
```

> Quên `private` cho dữ liệu cá nhân = CDN cache nhầm và phục vụ dữ liệu của user A cho user B. Đây là lỗi bảo mật nghiêm trọng đã xảy ra ở nhiều công ty lớn.

---

## 10. Theo dõi hiệu quả cache

Cache không đo được thì không biết có tác dụng không.

```ts
@Injectable()
export class CacheMetrics {
  private hits = 0;
  private misses = 0;

  hit() { this.hits++; }
  miss() { this.misses++; }

  @Cron(CronExpression.EVERY_MINUTE)
  report() {
    const total = this.hits + this.misses;
    if (!total) return;
    const rate = ((this.hits / total) * 100).toFixed(1);
    this.logger.log(`Cache hit rate: ${rate}% (${this.hits}/${total})`);
    this.hits = 0;
    this.misses = 0;
  }
}
```

Cách đọc con số:

| Hit rate | Kết luận |
|---|---|
| > 90% | Tốt |
| 70–90% | Chấp nhận được, cân nhắc tăng TTL |
| < 50% | **Cache đang phản tác dụng** — thêm độ trễ mà không giúp gì. Xem lại key có quá riêng biệt không |

Kiểm tra sức khoẻ Redis:

```bash
redis-cli info stats | grep keyspace
redis-cli info memory | grep used_memory_human
redis-cli --bigkeys                    # tìm key quá lớn
```

> Luôn đặt `maxmemory` + `maxmemory-policy allkeys-lru` cho Redis dùng làm cache. Không có nó, Redis đầy RAM rồi từ chối ghi, và ứng dụng bắt đầu ném lỗi.

---

## 11. Khi nào KHÔNG nên cache

- Dữ liệu thay đổi mỗi lần đọc (số dư ví, tồn kho thời gian thực).
- Query đã dưới 5ms — cache Redis mất ~1ms, lợi ích không đáng để chịu rủi ro dữ liệu cũ.
- Dữ liệu chỉ một người dùng đọc, và họ đọc một lần (hit rate ~0%).
- Dữ liệu mà việc hiển thị sai gây hậu quả nghiêm trọng (quyền hạn, trạng thái thanh toán).

**Trước khi cache, hãy thử tối ưu query.** Cache che giấu query xấu chứ không sửa nó — và ngày cache hỏng, bạn sẽ nhận đủ.

---

## 12. Bài tập bài 4

1. Dựng Redis, cài `CacheService.wrap()` có xử lý lỗi. **Tắt Redis** giữa lúc chạy và chứng minh API vẫn hoạt động (chậm hơn).
2. Cache endpoint chi tiết bài viết, TTL 5 phút. Dùng `autocannon -c 50 -d 20` đo throughput **trước và sau**. Ghi lại con số.
3. Cài xoá cache khi `PATCH /posts/:id`. Viết test: sửa bài → gọi lại GET → phải thấy dữ liệu mới ngay.
4. Cài `invalidateByPrefix` bằng `SCAN`. Tạo 100.000 key rác rồi so sánh thời gian giữa `KEYS` và `SCAN` (và quan sát Redis bị treo với `KEYS`).
5. **Tái hiện cache stampede:** cho query mất 2 giây, TTL 10 giây, bắn `autocannon -c 200 -d 30`. Đếm số query xuống DB trong log. Sau đó cài single-flight lock và đếm lại — phải giảm còn ~3 query.
6. Cài tag-based invalidation. Cache 20 danh sách khác nhau cùng tag `author:5`, sửa 1 bài của tác giả đó, xác nhận đúng 20 key bị xoá.
7. Thêm L1 LRU cache cho bảng cấu hình. Chạy 3 instance, sửa config, quan sát hiện tượng **không đồng bộ**. Sau đó khắc phục bằng Redis Pub/Sub.
8. Cài đếm lượt xem gom qua Redis, xả mỗi 30 giây. Bắn 10.000 lượt xem và xác nhận DB chỉ nhận **1 câu lệnh UPDATE**.
9. Thêm ETag + `Cache-Control`. Dùng `curl -H 'If-None-Match: ...'` xác nhận nhận về **304** và body rỗng.
10. Thêm đo hit rate, chạy tải hỗn hợp và tinh chỉnh TTL để đạt trên 85%.

➡️ Tiếp: [05-queue-va-job-nen.md](./05-queue-va-job-nen.md)
