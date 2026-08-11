# Nâng cao 09 — Đo lường và benchmark

Nguyên tắc duy nhất: **đo trước, tối ưu sau**. Tối ưu mà không đo là đoán, và phần lớn dự đoán về
"chỗ nào chậm" đều sai.

Bài này đi từ công cụ rẻ nhất (miễn phí, có sẵn) tới đắt nhất (cần cài đặt và vận hành).

---

## 1. Bậc thang công cụ

| Bậc | Công cụ | Chi phí | Trả lời câu hỏi |
|-----|---------|---------|-----------------|
| 0 | `DB::listen` + Pail | 0 | Trang này chạy bao nhiêu query? |
| 1 | `EXPLAIN ANALYZE` | 0 | Query này chậm vì sao? |
| 2 | Telescope | Cài 1 package, chỉ dev | Request vừa rồi làm những gì? |
| 3 | Log có cấu trúc | Cài đặt nhỏ | Chuyện gì đã xảy ra lúc 3h sáng? |
| 4 | Pulse | Cài + bảng riêng | Cái gì đang chậm **ngay bây giờ**? |
| 5 | k6 | Công cụ ngoài | Chịu được bao nhiêu người dùng? |
| 6 | OpenTelemetry | Hạ tầng riêng | Request đi qua những dịch vụ nào? |

Đừng nhảy lên bậc 6 khi chưa làm bậc 0. Phần lớn vấn đề hiệu năng của Laravel được giải quyết ở bậc
0–1.

---

## 2. Bậc 0 — đếm query

```php
// AppServiceProvider::boot()
if (! app()->isProduction()) {
    DB::listen(function ($query) {
        Log::debug($query->sql, [
            'bindings' => $query->bindings,
            'ms'       => $query->time,
        ]);
    });
}
```

Mở khung `logs` của `php artisan dev` (Pail) rồi bấm quanh ứng dụng.

Cảnh báo khi vượt ngưỡng — hữu ích hơn là đọc log bằng mắt:

```php
DB::whenQueryingForLongerThan(500, function (Connection $connection) {
    Log::warning('Request tốn quá 500ms ở database', [
        'url' => request()->fullUrl(),
    ]);
});
```

```php
// Cảnh báo khi một request chạy quá nhiều query
DB::listen(function ($query) {
    static $count = 0;
    if (++$count === 30) {
        Log::warning('Request vượt 30 query', ['url' => request()->fullUrl()]);
    }
});
```

Ngưỡng tham khảo: trang danh sách **3–8 query**; trên 15 là đáng xem lại; trên 30 gần như chắc chắn có
N+1.

### Đếm chính xác trong test

Biến chỉ số này thành test tự động — xem [bài 07 mục 6](./07-testing-chuyen-sau.md):

```php
$this->assertQueryCount(3, fn () => $this->get('/')->assertOk());
```

---

## 3. Bậc 1 — `EXPLAIN ANALYZE`

```bash
$ docker exec blog-pg psql -U blog -d blog \
  -c "EXPLAIN ANALYZE SELECT * FROM bench WHERE email = 'khong-ton-tai@test.dev';"

 Seq Scan on bench  (cost=0.00..6871.54 rows=384 width=590) (actual time=21.757..21.757 rows=0.00 loops=1)
   Filter: ((email)::text = 'khong-ton-tai@test.dev'::text)
   Rows Removed by Filter: 500000
   Buffers: shared hit=5911
```

Bốn từ khoá cần tìm:

| Xuất hiện | Nghĩa |
|-----------|-------|
| `Seq Scan` trên bảng lớn | Thiếu index |
| `Rows Removed by Filter` lớn | Đọc nhiều, dùng ít |
| `Nested Loop` với `loops=` lớn | Join sinh nhiều vòng lặp |
| `Sort` + `external merge Disk` | Sắp xếp tràn ra đĩa, thiếu `work_mem` |

Sau khi thêm index, cùng query:

```
 Bitmap Heap Scan on bench  (actual time=0.060..0.061 rows=0.00 loops=1)
   Buffers: shared read=3
```

**21.757 ms → 0.061 ms.** Chi tiết ở [bài 01](./01-toi-uu-eloquent.md).

### Tìm query chậm nhất trên production

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT calls,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       round(total_exec_time::numeric, 2) AS total_ms,
       left(query, 100) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Sắp theo `total_exec_time`, **không** theo `mean_exec_time`. Một query 2ms chạy 100.000 lần tốn nhiều
hơn query 500ms chạy 10 lần — và nó là thứ đáng sửa trước.

---

## 4. Bậc 2 — Telescope

```bash
$ composer require laravel/telescope --dev
$ php artisan telescope:install
$ php artisan migrate
```

Mở `/telescope`. Nó ghi lại: mọi request, query kèm thời gian, job, mail, event, cache hit/miss, log,
exception, lệnh artisan.

Dùng nó khi câu hỏi là **"request vừa rồi đã làm những gì?"**.

### Chỉ cài dev

```json
"require-dev": {
    "laravel/telescope": "^5.22"
}
```

Telescope ghi **mọi thứ** vào database. Trên production nó vừa làm chậm ứng dụng vừa làm phình database.
Nếu bắt buộc phải bật trên production:

```php
// TelescopeServiceProvider::register()
Telescope::filter(function (IncomingEntry $entry) {
    if ($this->app->environment('local')) {
        return true;
    }

    return $entry->isReportableException()
        || $entry->isFailedRequest()
        || $entry->isFailedJob()
        || $entry->isSlowQuery()
        || $entry->hasMonitoredTag();
});
```

```php
Schedule::command('telescope:prune --hours=48')->daily();
```

### Bảo vệ

```php
Gate::define('viewTelescope', fn ($user) => $user->is_admin);
```

Telescope hiện **payload đầy đủ** của mọi request — kể cả mật khẩu trong form đăng nhập và token API.
Để nó mở là rò rỉ nghiêm trọng.

Ẩn tham số nhạy cảm:

```php
Telescope::hideRequestParameters(['_token', 'password', 'password_confirmation']);
Telescope::hideRequestHeaders(['cookie', 'authorization']);
```

---

## 5. Bậc 3 — log có cấu trúc

Log dạng câu văn không tìm kiếm được. Log dạng JSON thì có.

```php
// config/logging.php
'channels' => [
    'stderr' => [
        'driver'    => 'monolog',
        'level'     => env('LOG_LEVEL', 'warning'),
        'handler'   => StreamHandler::class,
        'formatter' => JsonFormatter::class,
        'with'      => ['stream' => 'php://stderr'],
    ],
],
```

```ini
LOG_CHANNEL=stderr
LOG_LEVEL=warning
```

### Gắn context vào mọi dòng log

```php
// app/Http/Middleware/AddRequestId.php
public function handle(Request $request, Closure $next): Response
{
    $requestId = $request->header('X-Request-Id') ?: (string) Str::uuid();

    Log::withContext([
        'request_id' => $requestId,
        'user_id'    => $request->user()?->id,
        'ip'         => $request->ip(),
    ]);

    return $next($request)->header('X-Request-Id', $requestId);
}
```

Từ đó mọi `Log::info()` trong request đều có `request_id`. Khi người dùng báo lỗi, họ đọc `X-Request-Id`
trong response header và bạn tìm được **toàn bộ** dòng log của đúng request đó.

### Log cái gì

```php
// ✅ có ngữ cảnh, tìm kiếm được
Log::warning('Thanh toán thất bại', [
    'order_id' => $order->id,
    'user_id'  => $user->id,
    'gateway'  => 'stripe',
    'code'     => $e->getCode(),
]);

// ❌ không tìm kiếm được, không đủ thông tin
Log::error('Lỗi thanh toán: ' . $e->getMessage());
```

### Không log dữ liệu nhạy cảm

`DB::listen` ghi cả `bindings` — nghĩa là ghi cả mật khẩu trong câu `insert into users`. Chỉ bật ở dev.

---

## 6. Bậc 4 — Pulse

```bash
$ composer require laravel/pulse
$ php artisan pulse:install
$ php artisan migrate
```

Mở `/pulse`. Khác Telescope ở chỗ Pulse **tổng hợp** thay vì ghi từng bản ghi, nên chạy được trên
production.

Bảng điều khiển có sẵn: request chậm, query chậm, job chậm, job hỏng, exception, người dùng hoạt động,
tải server, lượt cache miss.

```php
// config/pulse.php
'recorders' => [
    SlowQueries::class => ['threshold' => 500, 'sample_rate' => 1],
    SlowRequests::class => ['threshold' => 1000],
    SlowJobs::class => ['threshold' => 2000],
],
```

`sample_rate` giảm chi phí ghi trên hệ thống tải cao: `0.1` = ghi 10% số mẫu.

```php
Gate::define('viewPulse', fn ($user) => $user->is_admin);
```

```php
Schedule::command('pulse:trim')->daily();
```

Ghi chỉ số của riêng bạn:

```php
Pulse::record('so_bai_dang', $post->category_id, 1)->count();
```

**Chọn Telescope hay Pulse:** Telescope trả lời "request **cụ thể** đó làm gì" (dev). Pulse trả lời
"cái gì đang chậm **nói chung**" (production). Chúng bổ sung cho nhau.

---

## 7. Bậc 5 — benchmark bằng k6

Đo lường trên máy dev không nói gì về hành vi dưới tải. k6 tạo tải thật.

```bash
$ brew install k6
$ k6 version
```

```js
// bench/home.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const ttfb = new Trend('ttfb');
const errors = new Rate('errors');

export const options = {
    stages: [
        { duration: '30s', target: 20 },    // tăng dần lên 20 người
        { duration: '1m',  target: 20 },    // giữ 1 phút
        { duration: '30s', target: 100 },   // tăng vọt
        { duration: '1m',  target: 100 },
        { duration: '30s', target: 0 },     // giảm về 0
    ],
    thresholds: {
        http_req_duration: ['p(95)<500', 'p(99)<1500'],
        errors: ['rate<0.01'],
    },
};

export default function () {
    const res = http.get('http://127.0.0.1:8000/');

    check(res, {
        'trả về 200': (r) => r.status === 200,
        'có nội dung': (r) => r.body.includes('Bài viết'),
    }) || errors.add(1);

    ttfb.add(res.timings.waiting);

    sleep(1);
}
```

```bash
$ k6 run bench/home.js
```

### Đọc kết quả

Ba chỉ số quan trọng, theo thứ tự:

| Chỉ số | Nghĩa | Ngưỡng tham khảo |
|--------|-------|------------------|
| `http_req_failed` | Tỷ lệ lỗi | < 1% |
| `http_req_duration p(95)` | 95% request nhanh hơn con số này | < 500ms |
| `http_reqs` | Thông lượng (req/s) | Tuỳ hệ thống |

**Đừng nhìn giá trị trung bình.** Trung bình 200ms nghe ổn, nhưng nếu p(99) là 8 giây thì 1% người
dùng đang có trải nghiệm tệ — và đó thường là những người có nhiều dữ liệu nhất.

### Quy trình benchmark đúng

1. Chạy trên môi trường **giống production** (cùng ảnh Docker, `APP_DEBUG=false`, `optimize` đã chạy).
2. Có **dữ liệu thật** — 40 bài viết không nói lên gì, seed 100.000.
3. Đo **một baseline** trước khi sửa.
4. Sửa **một thứ**.
5. Đo lại và so.

Đo trên máy dev với `APP_DEBUG=true` và 20 bản ghi cho ra con số vô nghĩa.

### Bench nhanh không cần k6

```bash
$ ab -n 500 -c 20 http://127.0.0.1:8000/
$ hey -n 500 -c 20 http://127.0.0.1:8000/
```

Đủ cho so sánh trước/sau một thay đổi.

---

## 8. Bậc 6 — OpenTelemetry

Chỉ cần khi ứng dụng gọi nhiều dịch vụ và câu hỏi là **"thời gian đi đâu mất?"**.

```bash
$ composer require open-telemetry/opentelemetry-auto-laravel
```

```ini
OTEL_PHP_AUTOLOAD_ENABLED=true
OTEL_SERVICE_NAME=blog-api
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

Nó tự tạo span cho HTTP request, query, job, lời gọi HTTP ra ngoài. Xem bằng Jaeger hoặc Grafana Tempo.

Span thủ công cho đoạn nghiệp vụ:

```php
$tracer = Globals::tracerProvider()->getTracer('blog');
$span = $tracer->spanBuilder('publish-post')->startSpan();

try {
    $publishPost->handle($post);
} finally {
    $span->end();
}
```

Với một ứng dụng Laravel đơn khối, Pulse + log có cấu trúc thường đã đủ. Đừng dựng hạ tầng tracing cho
một dự án một server.

---

## 9. Bảng chẩn đoán theo triệu chứng

| Triệu chứng | Đo bằng | Nguyên nhân thường gặp |
|-------------|---------|------------------------|
| Một trang chậm | `DB::listen` đếm query | N+1 → [01](./01-toi-uu-eloquent.md) |
| Mọi trang chậm dần theo thời gian | Pulse, `pg_stat_statements` | Bảng lớn lên, thiếu index |
| Chậm chỉ khi nhiều người dùng | k6 + `db:monitor` | Cạn connection pool |
| Chậm ngẫu nhiên, không tái hiện được | Log có `request_id` | Job nền chiếm CPU/DB |
| Tốn RAM, worker bị kill | `memory_get_peak_usage` | `->get()` trên bảng lớn |
| Thỉnh thoảng 500 không rõ lý do | Telescope/Sentry | Timeout gọi API ngoài |
| Nhanh ở dev, chậm ở production | So `php artisan about` | Chưa chạy `optimize`, OPcache tắt |

### Kiểm tra connection pool

```bash
$ php artisan db:monitor --databases=pgsql --max=80

$ php artisan db:show
 Open Connections .. 9
```

Số kết nối chạm trần `max_connections` của PostgreSQL (mặc định 100) thì request mới sẽ bị từ chối,
dù CPU còn rảnh. Mỗi worker queue cũng chiếm một kết nối.

---

## 10. Bốn chỉ số nên theo dõi liên tục

Đừng dựng dashboard 40 biểu đồ. Bốn con số này bắt được phần lớn sự cố:

| Chỉ số | Ngưỡng cảnh báo | Vì sao |
|--------|-----------------|--------|
| Tỷ lệ lỗi 5xx | > 1% trong 5 phút | Ứng dụng đang hỏng |
| p(95) thời gian phản hồi | > 1s | Người dùng đang chờ |
| Độ dài hàng đợi | Tăng liên tục 10 phút | Worker không kịp |
| Số job hỏng | > 0 và tăng | Có bug hoặc dịch vụ ngoài chết |

Ba cái đầu lấy được từ Pulse. Cái cuối từ `php artisan queue:failed` hoặc Horizon.

---

## 11. Nơi thời gian thường đi mất

Xếp theo tần suất gặp thật, không theo lý thuyết:

1. **N+1 query** — 60% các trường hợp "trang chậm".
2. **Thiếu index** — hiện ra khi bảng vượt vài chục nghìn dòng.
3. **Gọi API ngoài trong request** — nên đẩy vào queue.
4. **Nạp quá nhiều dữ liệu** — `->get()` thay vì `->paginate()`.
5. **Chưa chạy `optimize` trên production** — mất vài chục ms mỗi request cho việc parse config/route.
6. **OPcache tắt hoặc `validate_timestamps=1`** — PHP `stat()` từng file mỗi request.
7. **Cache dùng driver `database`** — 328ms vs 94ms cho 500 lần đọc (xem [bài 02](./02-cache-nhieu-tang.md)).

Bốn cái đầu là code. Ba cái sau là cấu hình — và chúng sửa trong 5 phút.

---

## Bài tập

1. Bật `DB::listen` và đếm query cho trang chủ. Xoá một `with()` và đếm lại. Ghi cả hai con số.

2. Thêm cảnh báo "vượt 30 query" như ở mục 2. Cố tình tạo N+1 và xác nhận cảnh báo xuất hiện trong Pail.

3. Chạy `EXPLAIN ANALYZE` cho query lọc theo `user_id` trên bảng `posts`. Ghi lại loại scan. Thêm
   index và chạy lại.

4. Cài Telescope. Tải trang chủ rồi mở tab Queries — chỉ ra query nào chậm nhất. Sau đó cấu hình
   `Telescope::hideRequestParameters` và xác nhận mật khẩu không còn hiện ở tab Requests.

5. Đổi `LOG_CHANNEL` sang JSON formatter. Thêm middleware gắn `request_id`. Gây một lỗi 500 và tìm mọi
   dòng log của request đó bằng `grep`.

6. Cài Pulse. Đặt `SlowQueries.threshold = 50`, tải vài trang, xem bảng điều khiển.

7. Viết script k6 cho trang chủ với 3 stage. Chạy với `APP_DEBUG=true` rồi với `APP_DEBUG=false` +
   `optimize`. So sánh p(95).

8. Seed 100.000 bài viết, chạy lại k6 và so với kết quả ở bài 7.

9. Chạy `php artisan db:show` trong lúc k6 đang chạy 100 người dùng. Ghi lại `Open Connections`.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Trang chủ đúng: **3 query** (posts kèm subquery đếm comment, users, categories). Xoá
`with('author')` với 10 bài: **13 query**. Với 200 bài: **203 query** — số query tỷ lệ thuận với số
bản ghi, đó chính là định nghĩa của N+1.

**3.** `foreignId()->constrained()` **không** tạo index trên PostgreSQL, nên:
```
Seq Scan on posts  (cost=0.00..21.86 rows=229 width=617) (actual time=0.019..0.160 rows=229.00 loops=1)
   Filter: (user_id = 1)
```
Kiểm tra bằng `php artisan db:table posts` — phần `Index` không có `user_id`.

**7.** `APP_DEBUG=true` chậm hơn đáng kể: Laravel dựng collector cho stack trace và ghi nhận mọi query
để hiển thị trang lỗi. Cộng với `optimize` (config/route/view cache), khác biệt p(95) thường 2–3 lần.

</details>

---

Quay lại [nang-cao/README.md](./README.md) · [Bộ cơ bản](../README.md)
