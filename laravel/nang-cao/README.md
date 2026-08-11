# Laravel nâng cao — hiệu năng, kiến trúc và vận hành

Bộ này dành cho lúc dự án đã chạy và bắt đầu **chậm**, **rối**, hoặc **hỏng lúc 2h sáng**.

Điều kiện: đã làm xong dự án Blog ở [bài 08](../08-du-an-blog.md). Mọi ví dụ ở đây tiếp tục dùng chính
dự án đó.

Mọi con số trong bộ này là **đo thật** trên máy — Laravel 13.26, PHP 8.5.5, PostgreSQL 18.6,
Redis 8.10.0, bảng thử 500.000 dòng. Bạn chạy lại được bằng đúng các lệnh trong bài.

---

## Nội dung

| Bài | Nội dung | Khi nào cần |
|-----|----------|-------------|
| [01-toi-uu-eloquent.md](./01-toi-uu-eloquent.md) | N+1 nâng cao, index, `EXPLAIN ANALYZE`, duyệt bảng triệu dòng, `chunk` vs `cursor` | Trang tải chậm, tốn RAM |
| [02-cache-nhieu-tang.md](./02-cache-nhieu-tang.md) | Redis, cache tag, cache theo model, chống cache stampede | Database chịu tải cao |
| [03-queue-va-horizon.md](./03-queue-va-horizon.md) | Redis queue, Horizon, batch, rate limit, job idempotent | Nhiều việc nền, job hỏng |
| [04-realtime-reverb.md](./04-realtime-reverb.md) | Reverb, broadcasting, private channel, presence | Thông báo tức thời, chat |
| [05-kien-truc-du-an-lon.md](./05-kien-truc-du-an-lon.md) | Action/Service/DTO, ranh giới module, quy ước đặt tên | Dự án > 50 file, nhiều người |
| [06-bao-mat.md](./06-bao-mat.md) | Sanctum, mass assignment, SQL injection, CSP, rate limit, rò rỉ dữ liệu | Trước khi lên production |
| [07-testing-chuyen-sau.md](./07-testing-chuyen-sau.md) | Pest, factory nâng cao, test song song, kiểm soát số query | Test chậm hoặc không tin được |
| [08-deploy-octane-docker.md](./08-deploy-octane-docker.md) | Docker, FrankenPHP, Octane, zero-downtime deploy | Đưa lên server thật |
| [09-do-luong-va-benchmark.md](./09-do-luong-va-benchmark.md) | Telescope, Pulse, log có cấu trúc, benchmark bằng k6 | Cần biết chậm ở đâu |

---

## Thứ tự nên đọc

Không cần đọc tuần tự. Chọn theo triệu chứng:

```
Trang chậm
   ├─ Chậm ở database?      → 01, rồi 02
   ├─ Chậm vì việc nền?     → 03
   └─ Không biết chậm ở đâu → 09 trước (đo đã, đừng đoán)

Code rối, sửa chỗ này hỏng chỗ kia
   → 05, rồi 07

Sắp lên production
   → 06, rồi 08, rồi 09
```

---

## Nguyên tắc chung của cả bộ

### 1. Đo trước, tối ưu sau

Tối ưu mà không đo là đoán. Ba lệnh tối thiểu:

```php
DB::listen(fn ($q) => Log::debug($q->sql, ['ms' => $q->time]));   // đếm query
```
```php
Post::published()->with('author')->dump();                        // xem SQL sinh ra
```
```bash
$ docker exec blog-pg psql -U blog -d blog -c "EXPLAIN ANALYZE SELECT ..."
```

### 2. Con số đáng nhớ

Đo trên máy thật, bảng `bench` 500.000 dòng:

| Việc | Kết quả |
|------|---------|
| Query không index trên 500k dòng | **21.757 ms** (Seq Scan, quét hết 500.000 dòng) |
| Cùng query, có index | **0.061 ms** (Bitmap Index Scan) — nhanh gấp ~350 lần |
| `DB::table('bench')->get()` 500k dòng | **Fatal error: Allowed memory size of 134217728 bytes exhausted** |
| `->cursor()` cùng dữ liệu | 24.8 MB, 530 ms |
| `->chunk(1000)` | 25.0 MB, **7589 ms** ← chậm vì dùng `OFFSET` |
| `->chunkById(1000)` | 25.0 MB, **660 ms** |
| 500 lần `Cache::get` với driver `database` | 328 ms |
| 500 lần `Cache::get` với driver `redis` | 94 ms |
| 500 lần `Cache::get` với driver `array` | 2 ms |

Chi tiết cách đo ở [bài 01](./01-toi-uu-eloquent.md) và [bài 02](./02-cache-nhieu-tang.md).

### 3. Bật chế độ nghiêm ngặt là bước tối ưu rẻ nhất

```php
// AppServiceProvider::boot()
Model::shouldBeStrict(! app()->isProduction());
```

Nó biến N+1 thành exception ngay lúc dev. Một dòng này ngăn được nhiều lỗi hiệu năng hơn mọi kỹ thuật
còn lại trong bộ này cộng lại.

---

Quay lại [bộ cơ bản](../README.md)
