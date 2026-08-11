# Bài 3 — Tối ưu Database

90% API chậm không phải do Node chậm, mà do query chậm. Bài này đi từ **cách phát hiện** query xấu tới **cách sửa** từng loại.

---

## 1. Trước hết: bật đèn để nhìn thấy vấn đề

Không đo thì mọi tối ưu đều là mê tín. Bật ba thứ này trước khi làm bất cứ điều gì khác.

### 1.1 Log query chậm ở phía Postgres

```conf
# postgresql.conf (hoặc truyền qua command trong docker-compose)
log_min_duration_statement = 200ms
```

Mọi query trên 200ms sẽ vào log kèm tham số thật. Đây là nguồn sự thật đáng tin nhất.

### 1.2 Log query chậm ở phía ứng dụng

```ts
TypeOrmModule.forRootAsync({
  useFactory: (c: ConfigService) => ({
    // ...
    maxQueryExecutionTime: 200,        // TypeORM tự cảnh báo query > 200ms
    logging: ['warn', 'error', 'migration'],
  }),
})
```

### 1.3 `pg_stat_statements` — bảng xếp hạng query tốn kém nhất

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

```sql
SELECT
  calls,
  round(mean_exec_time::numeric, 2)  AS avg_ms,
  round(total_exec_time::numeric)    AS total_ms,
  rows / GREATEST(calls, 1)          AS avg_rows,
  left(query, 90)                    AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

> Sắp xếp theo **`total_exec_time`**, không phải `mean_exec_time`. Một query 5ms chạy 2 triệu lần tốn tài nguyên hơn nhiều so với query 3 giây chạy 10 lần — và nó chính là thủ phạm N+1.

Reset để đo lại sau khi sửa: `SELECT pg_stat_statements_reset();`

---

## 2. N+1 query — thủ phạm số một

### Nhận diện

```ts
const posts = await this.repo.find({ take: 20 });
for (const post of posts) {
  post.author = await this.userRepo.findOneBy({ id: post.authorId });  // ❌
}
```

1 query lấy posts + 20 query lấy author = **21 query**. Với 100 request đồng thời → 2100 query. Log sẽ đầy những dòng gần giống hệt nhau chỉ khác tham số — đó là dấu hiệu nhận biết.

### Sửa 1: eager load bằng `relations`

```ts
const posts = await this.repo.find({
  take: 20,
  relations: { author: true, tags: true },
});
```

### ⚠️ Cái bẫy `relations` + `take` với quan hệ một-nhiều

```ts
// Ý định: lấy 20 bài viết kèm bình luận
await this.repo.find({ take: 20, relations: { comments: true } });
```

TypeORM sinh `LEFT JOIN`, mỗi bài 50 bình luận → 1000 dòng kết quả, rồi `LIMIT 20` cắt ở mức **dòng SQL** chứ không phải mức bài viết. Bạn nhận về 20 dòng = có thể chỉ 1 bài viết.

TypeORM xử lý bằng cách chạy 2 query khi phát hiện tình huống này, nhưng hành vi không phải lúc nào cũng như bạn mong đợi. **Cách chắc chắn:** tách làm hai bước tường minh.

```ts
async findWithComments(limit = 20) {
  const posts = await this.repo.find({
    take: limit,
    order: { createdAt: 'DESC' },
  });
  if (!posts.length) return [];

  const comments = await this.commentRepo.find({
    where: { postId: In(posts.map((p) => p.id)) },
    order: { createdAt: 'DESC' },
  });

  // Gom về theo postId — O(n), không lồng vòng lặp
  const byPost = new Map<number, Comment[]>();
  for (const c of comments) {
    const arr = byPost.get(c.postId) ?? [];
    arr.push(c);
    byPost.set(c.postId, arr);
  }

  return posts.map((p) => ({ ...p, comments: byPost.get(p.id) ?? [] }));
}
```

**Đúng 2 query** bất kể bao nhiêu bài viết. Đây là pattern quan trọng nhất của bài này.

### Sửa 2: chỉ cần số lượng thì đừng load cả danh sách

```ts
// ❌ load 5000 comment về chỉ để đếm
const post = await this.repo.findOne({ where: { id }, relations: { comments: true } });
return { ...post, commentCount: post.comments.length };

// ✅ để DB đếm
const post = await this.repo
  .createQueryBuilder('post')
  .loadRelationCountAndMap('post.commentCount', 'post.comments')
  .where('post.id = :id', { id })
  .getOne();
```

### Sửa 3: DataLoader — khi không kiểm soát được thứ tự gọi

Với GraphQL hoặc resolver lồng nhau, bạn không biết trước ai gọi gì. DataLoader gom mọi lời gọi trong **cùng một tick** thành một query.

```bash
npm i dataloader
```

```ts
// src/users/user.loader.ts
import DataLoader from 'dataloader';
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })   // mỗi request một loader -> cache không lẫn
export class UserLoader {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  readonly byId = new DataLoader<number, User | null>(async (ids) => {
    const users = await this.repo.findBy({ id: In([...ids]) });
    const map = new Map(users.map((u) => [u.id, u]));
    // BẮT BUỘC trả về đúng thứ tự và đúng số lượng như ids đầu vào
    return ids.map((id) => map.get(id) ?? null);
  });
}
```

```ts
// 20 lời gọi này gộp thành 1 query duy nhất
const authors = await Promise.all(posts.map((p) => this.userLoader.byId.load(p.authorId)));
```

---

## 3. Index — thứ mang lại hiệu quả lớn nhất trên mỗi phút bỏ ra

### 3.1 Đọc `EXPLAIN` — chỉ cần biết 4 điều

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC LIMIT 20;
```

| Thấy gì | Nghĩa là |
|---|---|
| `Seq Scan` trên bảng lớn | ❌ Quét toàn bảng — **thiếu index** |
| `Index Scan` / `Index Only Scan` | ✅ Dùng index. `Index Only Scan` là tốt nhất |
| `Bitmap Heap Scan` | ⚠️ Có index nhưng phải đọc nhiều dòng — chấp nhận được |
| `rows=1000` (ước tính) vs `actual rows=500000` | ❌ Thống kê lệch → chạy `ANALYZE ten_bang;` |
| `Sort` + `external merge Disk` | ❌ Sắp xếp tràn ra đĩa — thiếu index cho `ORDER BY` |

Ví dụ trước và sau:

```
-- Trước
Seq Scan on posts  (cost=0..48000 rows=333000)  (actual time=0.2..520 ms rows=333210)
  Filter: (status = 'published')
  Rows Removed by Filter: 666790
Planning Time: 0.1 ms
Execution Time: 610 ms

-- Sau khi thêm index
Index Scan using idx_posts_status_created on posts  (actual time=0.03..0.4 ms rows=20)
Execution Time: 0.5 ms
```

### 3.2 Quy tắc thứ tự cột trong composite index

Đây là chỗ nhiều người làm sai. Thứ tự đúng: **Equality → Sort → Range**.

```sql
-- Query:
SELECT * FROM posts
WHERE status = 'published' AND author_id = 5    -- equality
ORDER BY created_at DESC                        -- sort
LIMIT 20;

-- Index đúng:
CREATE INDEX idx_posts_status_author_created
  ON posts (status, author_id, created_at DESC);
```

Một index `(a, b, c)` phục vụ được query lọc theo `(a)`, `(a,b)`, `(a,b,c)` — nhưng **không** phục vụ query chỉ lọc theo `(b)` hay `(c)`. Nguyên tắc "tiền tố trái".

### 3.3 Các loại index nên biết

```sql
-- Partial index: chỉ đánh index phần dữ liệu hay truy vấn
-- Bảng 1 triệu dòng nhưng chỉ 5% là 'published' -> index nhỏ hơn 20 lần
CREATE INDEX idx_posts_published ON posts (created_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

-- Covering index: query đọc được toàn bộ dữ liệu từ index, không cần chạm bảng
CREATE INDEX idx_posts_list ON posts (status, created_at DESC)
  INCLUDE (id, title, view_count);

-- Tìm kiếm text: trigram cho ILIKE '%abc%'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_posts_title_trgm ON posts USING gin (title gin_trgm_ops);

-- Full-text search tiếng Việt
ALTER TABLE posts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) STORED;
CREATE INDEX idx_posts_fts ON posts USING gin (search_vector);

-- JSONB
CREATE INDEX idx_posts_meta ON posts USING gin (meta jsonb_path_ops);
```

> `ILIKE '%abc%'` **không dùng được B-tree index** — đó là lý do ô tìm kiếm luôn chậm. Bắt buộc phải có `pg_trgm` hoặc full-text search.

### 3.4 Khai báo index trong entity

```ts
@Entity('posts')
@Index('idx_posts_status_created', ['status', 'createdAt'])
@Index('idx_posts_author', ['authorId'])
export class Post {
  @Index()                       // index đơn cột
  @Column({ unique: true })
  slug: string;
}
```

Index phức tạp (partial, GIN, covering) không khai báo được qua decorator — viết trong migration:

```ts
export class AddPostIndexes implements MigrationInterface {
  async up(q: QueryRunner) {
    // CONCURRENTLY: không khoá bảng, BẮT BUỘC trên production
    await q.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_published
      ON posts (created_at DESC) WHERE status = 'published'
    `);
  }
  async down(q: QueryRunner) {
    await q.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_posts_published`);
  }
}
```

> ⚠️ `CREATE INDEX` thường **khoá ghi** trên bảng suốt quá trình tạo — bảng 10 triệu dòng có thể khoá vài phút, đủ làm sập ứng dụng. Luôn dùng `CONCURRENTLY` ở production. Đổi lại, nó không chạy được trong transaction, nên migration đó phải để `transaction: false`.

### 3.5 Index không miễn phí

Mỗi index làm **INSERT/UPDATE/DELETE chậm đi** và tốn dung lượng. Tìm index thừa:

```sql
-- Index chưa từng được dùng
SELECT schemaname, relname, indexrelname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND indexrelid NOT IN (
  SELECT conindid FROM pg_constraint WHERE contype IN ('p','u')
)
ORDER BY pg_relation_size(indexrelid) DESC;
```

Quy tắc thực dụng: **bắt đầu với 0 index thừa, chỉ thêm khi `EXPLAIN` chứng minh cần.**

---

## 4. Connection Pool — nguyên nhân của "too many connections"

### Cấu hình

```ts
TypeOrmModule.forRootAsync({
  useFactory: (c: ConfigService) => ({
    type: 'postgres',
    // ...
    poolSize: 20,
    extra: {
      max: 20,                        // số connection tối đa
      min: 2,
      idleTimeoutMillis: 30_000,      // đóng connection rảnh sau 30s
      connectionTimeoutMillis: 5_000, // chờ xin connection tối đa 5s rồi báo lỗi
      statement_timeout: 30_000,      // Postgres tự huỷ query chạy quá 30s
      query_timeout: 30_000,
    },
  }),
})
```

`statement_timeout` là **lưới an toàn quan trọng nhất**: nó đảm bảo một query lỗi không giữ connection mãi mãi.

### Chọn kích thước pool

Công thức thực dụng:

```
max_connections của Postgres  ≥  (pool_size × số_instance_app) + dự phòng cho migration/admin
```

Ví dụ: Postgres `max_connections = 100`, chạy 4 container API → pool tối đa **20** mỗi container (80 + 20 dự phòng).

Nghịch lý cần biết: **pool lớn không làm nhanh hơn.** Postgres xử lý song song hiệu quả nhất ở khoảng `số_core × 2 + số_đĩa`. Pool 100 chỉ khiến 100 query cùng tranh nhau 8 core → mọi query đều chậm. Pool 20 với hàng đợi thường nhanh hơn pool 100.

### Khi cần nhiều instance: PgBouncer

Khi scale lên 20+ container, dùng PgBouncer làm lớp gộp connection:

```yaml
pgbouncer:
  image: edoburu/pgbouncer
  environment:
    DB_HOST: db
    POOL_MODE: transaction      # gộp ở mức transaction — hiệu quả nhất
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25
```

App kết nối tới PgBouncer thay vì Postgres trực tiếp.

> ⚠️ Với `POOL_MODE: transaction`, **không dùng được** prepared statement và session-level feature. Với TypeORM cần thêm `extra: { prepare: false }` hoặc dùng `POOL_MODE: session`.

### Phát hiện rò rỉ connection

```sql
SELECT state, count(*), max(now() - state_change) AS longest
FROM pg_stat_activity
WHERE datname = 'blog'
GROUP BY state;
```

`idle in transaction` tăng dần = có transaction mở mà không commit/rollback. Nguyên nhân thường gặp: `queryRunner.connect()` mà thiếu `release()` trong `finally`.

```ts
const runner = this.dataSource.createQueryRunner();
await runner.connect();
await runner.startTransaction();
try {
  // ...
  await runner.commitTransaction();
} catch (e) {
  await runner.rollbackTransaction();
  throw e;
} finally {
  await runner.release();      // ⚠️ thiếu dòng này = rò rỉ connection
}
```

---

## 5. Đếm nhanh trên bảng lớn

`SELECT count(*)` trên 10 triệu dòng mất vài giây vì Postgres phải quét toàn bộ.

### Cách 1: ước lượng (cho UI hiển thị "khoảng N kết quả")

```ts
async estimateCount(): Promise<number> {
  const [row] = await this.dataSource.query(
    `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = 'posts'`,
  );
  return Number(row.estimate);
}
```

Trả về tức thì, sai số vài %. Đủ tốt cho "Khoảng 1.2 triệu bài viết".

### Cách 2: giới hạn ngưỡng đếm

```sql
-- Dừng đếm ở 10000, UI hiển thị "10.000+"
SELECT count(*) FROM (SELECT 1 FROM posts WHERE status='published' LIMIT 10000) t;
```

### Cách 3: bảng đếm riêng

Với con số cần chính xác tuyệt đối (số dư ví, tồn kho), duy trì cột đếm và cập nhật bằng trigger hoặc `increment()` — đừng đếm lại mỗi lần đọc.

### Cách 4: bỏ luôn tổng số

Cursor pagination ([bài 02](./02-xu-ly-du-lieu-lon.md)) không cần tổng số. Đây thường là lựa chọn tốt nhất.

---

## 6. Transaction, khoá và tranh chấp

### Giữ transaction ngắn nhất có thể

```ts
// ❌ Giữ khoá suốt 3 giây vì gọi API bên ngoài bên trong transaction
await this.dataSource.transaction(async (m) => {
  const order = await m.save(Order, dto);
  await this.paymentApi.charge(order);      // ❌ mạng chậm = khoá lâu
  await m.save(Payment, { orderId: order.id });
});

// ✅ Gọi API ngoài transaction
const charge = await this.paymentApi.charge(dto);
await this.dataSource.transaction(async (m) => {
  const order = await m.save(Order, dto);
  await m.save(Payment, { orderId: order.id, chargeId: charge.id });
});
```

Transaction dài = khoá lâu = các request khác xếp hàng = timeout hàng loạt.

### Chống race condition khi trừ tồn kho

Kịch bản: 100 người cùng mua sản phẩm còn 1 cái.

```ts
// ❌ Đọc rồi ghi — hai request đọc cùng lúc đều thấy stock = 1
const product = await this.repo.findOneBy({ id });
if (product.stock < qty) throw new ConflictException('Hết hàng');
product.stock -= qty;
await this.repo.save(product);
```

**Cách 1 — Pessimistic lock:** khoá dòng, request khác chờ.

```ts
await this.dataSource.transaction(async (m) => {
  const product = await m.findOne(Product, {
    where: { id },
    lock: { mode: 'pessimistic_write' },     // SELECT ... FOR UPDATE
  });
  if (product.stock < qty) throw new ConflictException('Hết hàng');
  product.stock -= qty;
  await m.save(product);
});
```

**Cách 2 — Cập nhật nguyên tử (nhanh hơn, không cần khoá tường minh):**

```ts
const result = await this.repo
  .createQueryBuilder()
  .update(Product)
  .set({ stock: () => 'stock - :qty' })
  .where('id = :id AND stock >= :qty', { id, qty })
  .setParameters({ qty })
  .execute();

if (result.affected === 0) {
  throw new ConflictException('Không đủ hàng trong kho');
}
```

Một câu lệnh, DB tự đảm bảo nguyên tử. **Đây là cách nên dùng** cho các phép cộng/trừ đơn giản.

**Cách 3 — Optimistic lock:** phù hợp khi xung đột hiếm.

```ts
@Entity()
export class Product {
  @VersionColumn()      // TypeORM tự tăng và kiểm tra
  version: number;
}
// Ghi đè bởi người khác -> ném OptimisticLockVersionMismatchError -> bạn retry
```

### Thứ tự khoá nhất quán để tránh deadlock

Deadlock xảy ra khi transaction A khoá dòng 1 rồi chờ dòng 2, còn B khoá dòng 2 rồi chờ dòng 1.

```ts
// ✅ Luôn khoá theo thứ tự id tăng dần ở MỌI nơi trong codebase
const sortedIds = [...ids].sort((a, b) => a - b);
for (const id of sortedIds) { /* khoá */ }
```

---

## 7. Read replica — tách tải đọc

Khi tỷ lệ đọc/ghi khoảng 90/10, đưa việc đọc sang replica.

```ts
TypeOrmModule.forRootAsync({
  useFactory: (c: ConfigService) => ({
    type: 'postgres',
    replication: {
      master: {
        host: c.get('DB_MASTER_HOST'),
        port: 5432, username: '...', password: '...', database: 'blog',
      },
      slaves: [
        { host: c.get('DB_REPLICA1_HOST'), port: 5432, username: '...', password: '...', database: 'blog' },
        { host: c.get('DB_REPLICA2_HOST'), port: 5432, username: '...', password: '...', database: 'blog' },
      ],
    },
  }),
})
```

TypeORM tự động: `SELECT` → replica (xoay vòng), `INSERT/UPDATE/DELETE` và mọi thứ trong transaction → master.

### Cái bẫy: replication lag

```ts
await this.repo.save(post);                    // ghi vào master
const fresh = await this.repo.findOneBy({ id: post.id });   // đọc từ replica
// ❌ có thể trả về null hoặc dữ liệu cũ — replica chậm 10-500ms
```

Sau khi ghi mà cần đọc lại ngay, ép đọc từ master:

```ts
const fresh = await this.dataSource
  .createQueryBuilder(Post, 'post')
  .setQueryRunner(this.dataSource.createQueryRunner('master'))
  .where('post.id = :id', { id: post.id })
  .getOne();
```

Hoặc đơn giản hơn: dùng luôn giá trị `save()` trả về, đừng đọc lại.

---

## 8. Bảng lớn: partition

Khi một bảng vượt ~50 triệu dòng và dữ liệu có tính thời gian (log, event, đơn hàng), chia bảng theo tháng:

```sql
CREATE TABLE events (
  id bigserial,
  created_at timestamptz NOT NULL,
  payload jsonb,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_08 PARTITION OF events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE events_2026_09 PARTITION OF events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

Lợi ích:

- Query có điều kiện thời gian chỉ quét đúng partition liên quan (**partition pruning**).
- Xoá dữ liệu cũ bằng `DROP TABLE events_2026_08` — **tức thì**, thay vì `DELETE` chạy hàng giờ và làm phình bảng.

Dùng `pg_partman` để tự tạo partition mới hằng tháng.

---

## 9. Checklist tối ưu — theo thứ tự hiệu quả

Làm từ trên xuống, dừng lại khi đủ nhanh:

1. ☐ Bật `log_min_duration_statement` và `pg_stat_statements`, tìm ra **top 5 query tốn nhất**
2. ☐ Chạy `EXPLAIN ANALYZE` cho từng query đó
3. ☐ Sửa N+1 (thường giảm 80% số query)
4. ☐ Thêm index đúng cho `WHERE` + `ORDER BY`
5. ☐ Bỏ cột không dùng khỏi `SELECT`
6. ☐ Đổi `OFFSET` sâu sang cursor
7. ☐ Thêm cache cho query đọc nhiều ([bài 04](./04-cache-nhieu-tang.md))
8. ☐ Chỉnh pool size + `statement_timeout`
9. ☐ Read replica
10. ☐ Partition

> Bước 3 và 4 giải quyết phần lớn vấn đề. Đừng nhảy thẳng xuống bước 9 khi chưa làm bước 3.

---

## 10. Bài tập bài 3

Dùng bảng `posts` 1 triệu dòng.

1. Bật `pg_stat_statements`. Chạy ứng dụng, gọi các API vài phút, rồi tìm top 10 query theo `total_exec_time`.
2. **Tạo N+1 có chủ đích:** viết endpoint lấy 50 bài kèm tác giả bằng vòng lặp. Đếm số query trong log (phải là 51).
3. Sửa thành đúng **2 query** bằng kỹ thuật `In()` + `Map` ở mục 2. Đo lại thời gian phản hồi.
4. Chạy `EXPLAIN (ANALYZE, BUFFERS)` cho query lọc `status` + sắp xếp `created_at`. Ghi lại `Seq Scan` và thời gian.
5. Thêm index composite đúng thứ tự, chạy lại `EXPLAIN`, chứng minh đã chuyển sang `Index Scan` và ghi lại mức cải thiện (kỳ vọng > 100 lần).
6. Tạo thêm **partial index** cho `status = 'published'`, so sánh dung lượng hai index bằng `pg_size_pretty(pg_relation_size(...))`.
7. Cài `pg_trgm`, làm ô tìm kiếm `ILIKE '%keyword%'` chạy dưới 50ms trên 1 triệu dòng.
8. **Mô phỏng race condition:** viết endpoint trừ tồn kho theo cách sai, dùng `autocannon -c 100 -a 100` bắn đồng thời vào sản phẩm có `stock = 10`. Xác nhận stock bị âm. Sửa bằng cập nhật nguyên tử và chứng minh không còn âm.
9. Đặt pool `max: 5`, `connectionTimeoutMillis: 1000`, bắn 50 request đồng thời và quan sát lỗi timeout. Tăng pool và đo lại.
10. Viết một endpoint cố tình quên `runner.release()`, gọi 20 lần, quan sát `pg_stat_activity` để thấy connection rò rỉ.

➡️ Tiếp: [04-cache-nhieu-tang.md](./04-cache-nhieu-tang.md)
