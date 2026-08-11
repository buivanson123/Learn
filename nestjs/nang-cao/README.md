# NestJS Nâng cao — Xử lý dữ liệu lớn & chịu tải cao

> Yêu cầu: đã hoàn thành phần cơ bản (thư mục cha) và làm xong dự án Blog API.

Phần cơ bản dạy bạn **làm cho nó chạy**. Phần này dạy bạn **làm cho nó không sập** khi dữ liệu lên hàng triệu dòng và request lên hàng nghìn mỗi giây.

---

## Vấn đề mà phần này giải quyết

Code chạy tốt với 100 bản ghi thường hỏng theo 4 cách khi lên 10 triệu bản ghi:

| Triệu chứng | Nguyên nhân gốc | Học ở bài |
|---|---|---|
| API chậm dần rồi timeout | Thiếu index, N+1 query, `OFFSET` lớn | [03](./03-toi-uu-database.md) |
| Process bị OOM (hết RAM) rồi restart | Load toàn bộ kết quả vào mảng trước khi trả về | [02](./02-xu-ly-du-lieu-lon.md) |
| DB báo "too many connections" | Pool sai kích thước, connection rò rỉ | [03](./03-toi-uu-database.md) |
| Vài request nặng làm chết cả server | Không có timeout, không tách việc nặng ra khỏi request | [05](./05-queue-va-job-nen.md), [06](./06-chiu-tai-cao.md) |

Nguyên tắc xuyên suốt cả bộ tài liệu:

> **1. Không bao giờ giữ toàn bộ tập dữ liệu trong RAM.** Dùng stream hoặc batch.
> **2. Không làm việc nặng bên trong vòng đời request.** Đẩy vào queue.
> **3. Đo trước khi tối ưu.** `EXPLAIN ANALYZE` và load test, không đoán.
> **4. Mọi tài nguyên đều phải có giới hạn.** Pool, concurrency, timeout, rate limit.

---

## Lộ trình

| # | File | Nội dung | Trọng tâm |
|---|---|---|---|
| 01 | [Kiến trúc quy mô lớn](./01-kien-truc-quy-mo-lon.md) | Phân tầng, ranh giới module, path alias, monorepo | Tổ chức |
| — | [**Cấu trúc chuẩn**](../cau-truc-chuan.md) *(sổ tay tra cứu)* | Cây thư mục, đặt file ở đâu, quy ước đặt tên, ép tuân thủ | Tổ chức |
| 02 | [Xử lý dữ liệu lớn](./02-xu-ly-du-lieu-lon.md) | **Stream, cursor pagination, bulk insert, export triệu dòng, import file lớn** | ⭐ Dữ liệu lớn |
| 03 | [Tối ưu database](./03-toi-uu-database.md) | **N+1, index, EXPLAIN, connection pool, read replica, lock** | ⭐ Dữ liệu lớn |
| 04 | [Cache nhiều tầng](./04-cache-nhieu-tang.md) | **Redis, cache-aside, invalidation, chống cache stampede** | ⭐ Tải cao |
| 05 | [Queue & job nền](./05-queue-va-job-nen.md) | **BullMQ, retry, concurrency, chia batch, idempotency** | ⭐ Cả hai |
| 06 | [Chịu tải cao](./06-chiu-tai-cao.md) | **Rate limit, timeout, circuit breaker, cluster, graceful shutdown** | ⭐ Tải cao |
| 07 | [CQRS, Event & Outbox](./07-cqrs-event-outbox.md) | Tách đọc/ghi, domain event, transactional outbox | Kiến trúc |
| 08 | [Realtime: WebSocket & SSE](./08-realtime-websocket-sse.md) | Gateway, scale bằng Redis adapter, báo tiến độ job | Tải cao |
| 09 | [Microservices](./09-microservices.md) | Transport, message vs event, timeout giữa service | Kiến trúc |
| 10 | [Observability & Benchmark](./10-observability-benchmark.md) | **Log có cấu trúc, correlation id, metrics, tracing, load test k6** | ⭐ Đo lường |

Phần triển khai (Dockerfile, compose, tối ưu image) nằm ở [../../docker](../../docker/README.md) — tài liệu này không lặp lại.

---

## Thứ tự đọc gợi ý

Bạn **không cần** đọc tuần tự. Ba lộ trình theo nhu cầu:

**Nếu API đang chậm:** 03 → 02 → 04 → 10
**Nếu server hay sập khi đông người dùng:** 06 → 05 → 04 → 10
**Nếu code đang rối, khó mở rộng:** 01 → 07 → 09

Nhưng bài **10 (đo lường)** nên đọc sớm dù theo lộ trình nào — tối ưu mà không đo là đoán mò.

---

## Môi trường thực hành

Các bài đều dùng chung một bộ hạ tầng. Dựng trước bằng Docker:

```yaml
# docker-compose.dev.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: blog
    ports: ['5432:5432']
    command: >
      postgres -c max_connections=200
               -c shared_buffers=256MB
               -c log_min_duration_statement=200ms
    volumes: ['pgdata:/var/lib/postgresql/data']

  redis:
    image: redis:7-alpine
    ports: ['6379:6379']
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

volumes:
  pgdata:
```

```bash
docker compose -f docker-compose.dev.yml up -d
```

> `log_min_duration_statement=200ms` bật sẵn log query chậm — bạn sẽ cần nó ngay từ bài 03.

### Sinh dữ liệu lớn để thực hành

Nhiều bài yêu cầu bảng có **1 triệu dòng**. Tạo nhanh bằng SQL thay vì seed qua Node:

```sql
-- Chạy trong psql: docker compose exec db psql -U postgres -d blog
INSERT INTO posts (title, slug, content, status, view_count, author_id, created_at, updated_at)
SELECT
  'Bài viết số ' || i,
  'bai-viet-so-' || i,
  repeat('nội dung ', 50),
  (ARRAY['draft','published','archived'])[1 + (i % 3)],
  (random() * 10000)::int,
  1,
  now() - (i || ' minutes')::interval,
  now()
FROM generate_series(1, 1000000) AS i;
```

Mất khoảng 20–40 giây. Sau đó `ANALYZE posts;` để Postgres cập nhật thống kê.

➡️ Bắt đầu: [01-kien-truc-quy-mo-lon.md](./01-kien-truc-quy-mo-lon.md)
