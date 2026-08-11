# Nâng cao 03 — Queue ở quy mô thật và Horizon

Kiến thức nền ở [bài 07](../07-queue-mail-event-test.md). Bài này xử lý những vấn đề chỉ xuất hiện khi
hàng đợi có hàng nghìn job: job chạy hai lần, job chặn hàng đợi, worker chết âm thầm, và làm sao nhìn
thấy được chuyện gì đang xảy ra.

---

## 1. Đổi sang Redis queue

Driver `database` phải `SELECT ... FOR UPDATE SKIP LOCKED` mỗi lần lấy job, và mọi worker cùng đập vào
một bảng. Redis dùng `BLPOP` — worker nằm chờ, không polling.

```ini
QUEUE_CONNECTION=redis
```

```php
// config/queue.php
'redis' => [
    'driver'      => 'redis',
    'connection'  => env('REDIS_QUEUE_CONNECTION', 'default'),
    'queue'       => env('REDIS_QUEUE', 'default'),
    'retry_after' => 90,        // ⚠️ xem mục 3
    'block_for'   => 5,         // worker chờ 5s trước khi hỏi lại
    'after_commit' => false,
],
```

```bash
$ php artisan about | grep -A 8 Drivers | grep Queue
 Queue .. redis
```

---

## 2. Nhiều hàng đợi, có ưu tiên

Đừng để mail quảng cáo chặn mail đặt lại mật khẩu.

```php
SendPasswordReset::dispatch($user)->onQueue('high');
SendNewsletter::dispatch($user)->onQueue('low');
GenerateReport::dispatch()->onQueue('long-running');
```

Hoặc gắn cứng vào job:

```php
class SendNewsletter implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $user)
    {
        $this->onQueue('low');
    }
}
```

Worker xử lý theo thứ tự ưu tiên:

```bash
$ php artisan queue:work redis --queue=high,default,low
```

Worker này luôn vét sạch `high` trước khi đụng vào `default`. Hệ quả cần biết: nếu `high` không bao
giờ rỗng, `low` **không bao giờ được chạy**. Với hệ thống bận, chạy worker riêng cho từng hàng đợi
thay vì một worker nhiều hàng đợi.

---

## 3. `retry_after` và `timeout` — cặp số hay gây job chạy hai lần

Đây là lỗi khó tìm nhất trong toàn bộ hệ queue.

| Tham số | Ở đâu | Nghĩa |
|---------|-------|-------|
| `timeout` | `queue:work --timeout=60` hoặc `public int $timeout` | Worker **giết** job sau ngần này giây |
| `retry_after` | `config/queue.php` | Sau ngần này giây, hàng đợi coi job là "mất" và **giao cho worker khác** |

**Quy tắc bắt buộc: `retry_after` > `timeout`.**

Nếu `timeout = 120` mà `retry_after = 90`:

```
0s    worker A nhận job, bắt đầu chạy
90s   hàng đợi tưởng job mất → giao cho worker B
      ⚠️ job đang chạy ở A VÀ chạy ở B cùng lúc
120s  worker A bị giết
```

Triệu chứng: mail gửi hai lần, tiền trừ hai lần, và **không có lỗi nào trong log**.

Cấu hình đúng:

```php
'retry_after' => 90,
```
```bash
$ php artisan queue:work --timeout=60
```

---

## 4. Job phải idempotent

Job **sẽ** chạy hai lần. Không phải "có thể" — worker bị kill, deploy giữa chừng, `retry_after` sai,
mạng chập chờn. Thiết kế job sao cho chạy hai lần vẫn đúng.

### Khoá duy nhất

```php
use Illuminate\Contracts\Queue\ShouldBeUnique;

class GenerateMonthlyReport implements ShouldQueue, ShouldBeUnique
{
    use Queueable;

    public int $uniqueFor = 3600;      // khoá giữ tối đa 1 giờ

    public function __construct(public string $month) {}

    public function uniqueId(): string
    {
        return $this->month;
    }
}
```

Đẩy job cùng `$month` lần thứ hai khi lần đầu chưa xong → **bị bỏ qua trong im lặng**.

`ShouldBeUniqueUntilProcessing` thì khoá được nhả ngay khi job **bắt đầu** chạy, thay vì khi kết thúc.

> `ShouldBeUnique` cần cache driver hỗ trợ khoá atomic (`redis`, `memcached`, `database`, `dynamodb`).
> Với `file` hoặc `array` nó không đảm bảo gì.

### Tự kiểm tra trạng thái

Cách chắc chắn hơn — kiểm tra ngay trong `handle()`:

```php
public function handle(): void
{
    if ($this->post->notified_at !== null) {
        return;                        // đã gửi rồi, thoát
    }

    Mail::to($this->post->author)->send(new PostPublished($this->post));

    $this->post->update(['notified_at' => now()]);
}
```

### `dispatch` sau khi commit transaction

```php
DB::transaction(function () use ($data) {
    $post = Post::create($data);
    SendPostPublishedNotification::dispatch($post);      // ⚠️ nguy hiểm
});
```

Worker có thể nhận job **trước khi** transaction commit, rồi `Post::find($id)` trả `null`. Sửa:

```php
SendPostPublishedNotification::dispatch($post)->afterCommit();
```

Hoặc bật mặc định cho toàn ứng dụng:

```php
// config/queue.php
'redis' => [
    'after_commit' => true,
],
```

---

## 5. Job batch

Chạy 1000 job và biết khi nào tất cả xong:

```php
use Illuminate\Bus\Batch;
use Illuminate\Support\Facades\Bus;

$batch = Bus::batch(
        Post::published()->pluck('id')->map(fn ($id) => new ReindexPost($id))->all()
    )
    ->name('Đánh chỉ mục lại toàn bộ bài viết')
    ->allowFailures()
    ->onQueue('long-running')
    ->then(fn (Batch $batch) => Log::info('Xong hết', ['id' => $batch->id]))
    ->catch(fn (Batch $batch, Throwable $e) => Log::error('Có job hỏng', ['error' => $e->getMessage()]))
    ->finally(fn (Batch $batch) => Cache::tags(['posts'])->flush())
    ->dispatch();

echo $batch->id;
```

Theo dõi tiến độ:

```php
$batch = Bus::findBatch($id);

$batch->totalJobs;          // 1000
$batch->pendingJobs;        // 340
$batch->failedJobs;         // 2
$batch->progress();         // 66 (phần trăm)
$batch->finished();
$batch->cancel();
```

Job trong batch phải dùng trait `Batchable`:

```php
class ReindexPost implements ShouldQueue
{
    use Batchable, Queueable;

    public function handle(): void
    {
        if ($this->batch()?->cancelled()) {
            return;                     // batch đã bị huỷ, thoát sớm
        }
        // ...
    }
}
```

Dọn bảng `job_batches`:

```php
Schedule::command('queue:prune-batches --hours=48')->daily();
```

### Chuỗi job chạy tuần tự

```php
Bus::chain([
    new ImportCsv($path),
    new ValidateRows($path),
    new NotifyAdmin($path),
])->catch(fn (Throwable $e) => Log::error(...))->dispatch();
```

Job sau chỉ chạy khi job trước thành công. Một job hỏng → cả chuỗi dừng.

---

## 6. Rate limit — không làm sập API bên thứ ba

### Giới hạn số job mỗi khoảng thời gian

```php
// AppServiceProvider::boot()
use Illuminate\Support\Facades\RateLimiter;

RateLimiter::for('gui-mail', fn () => Limit::perMinute(100));
```

```php
use Illuminate\Queue\Middleware\RateLimited;

class SendNewsletter implements ShouldQueue
{
    public function middleware(): array
    {
        return [new RateLimited('gui-mail')];
    }
}
```

Job vượt giới hạn được **đẩy lại vào hàng đợi**, không bị đánh hỏng.

### Không cho hai job cùng loại chạy đồng thời

```php
use Illuminate\Queue\Middleware\WithoutOverlapping;

public function middleware(): array
{
    return [
        (new WithoutOverlapping($this->user->id))
            ->releaseAfter(60)
            ->expireAfter(180),
    ];
}
```

Khoá theo `user_id`: hai job của cùng một người không chạy song song, nhưng job của người khác vẫn chạy.

### Circuit breaker

Khi API ngoài đang chết, đừng thử lại 1000 lần:

```php
use Illuminate\Queue\Middleware\ThrottlesExceptions;

public function middleware(): array
{
    return [(new ThrottlesExceptions(10, 5 * 60))->backoff(5)];
}

public function retryUntil(): DateTime
{
    return now()->addMinutes(30);
}
```

10 lần hỏng trong 5 phút → tạm ngừng đẩy job loại này. `retryUntil()` đặt hạn tuyệt đối, quan trọng
hơn `$tries` khi job có backoff dài.

---

## 7. Backoff tăng dần

```php
public function backoff(): array
{
    return [10, 60, 300, 900];
}

public int $tries = 5;
```

Thử lại sau 10s, 60s, 5 phút, 15 phút. Lần thứ 5 dùng lại 900s.

Thử lại ngay lập tức 5 lần chỉ làm dịch vụ đang quá tải càng quá tải. Với mọi job gọi ra ngoài, backoff
tăng dần là bắt buộc.

---

## 8. Horizon — nhìn thấy hàng đợi

```bash
$ composer require laravel/horizon
$ php artisan horizon:install
$ php artisan horizon
```

Mở `/horizon`. Horizon **chỉ chạy với Redis**.

```php
// config/horizon.php
'environments' => [
    'production' => [
        'supervisor-high' => [
            'connection' => 'redis',
            'queue'      => ['high'],
            'balance'    => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => 10,
            'tries'      => 3,
            'timeout'    => 60,
        ],
        'supervisor-default' => [
            'connection' => 'redis',
            'queue'      => ['default', 'low'],
            'balance'    => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => 5,
            'tries'      => 3,
            'timeout'    => 300,
        ],
    ],
],
```

`balance: 'auto'` tự tăng giảm số tiến trình theo độ dài hàng đợi.

### Bảo vệ trang Horizon

`/horizon` hiện toàn bộ payload job — có thể chứa email, token, dữ liệu cá nhân. Mặc định nó chỉ mở ở
môi trường `local`.

```php
// app/Providers/HorizonServiceProvider.php
protected function gate(): void
{
    Gate::define('viewHorizon', fn ($user) => $user->is_admin);
}
```

Quên bước này và deploy lên production là rò rỉ dữ liệu.

### Cảnh báo khi hàng đợi tắc

```php
// config/horizon.php
'waits' => [
    'redis:high'    => 30,     // báo động nếu job chờ > 30 giây
    'redis:default' => 120,
],
```

```php
// AppServiceProvider::boot()
use Laravel\Horizon\Events\LongWaitDetected;

Event::listen(function (LongWaitDetected $event) {
    Log::critical('Hàng đợi tắc', [
        'connection' => $event->connection,
        'queue'      => $event->queue,
        'seconds'    => $event->seconds,
    ]);
});
```

### Deploy với Horizon

```bash
$ php artisan horizon:terminate      # thay cho queue:restart
```

---

## 9. Chạy worker trên server thật

`php artisan queue:work` sẽ chết — hết bộ nhớ, lỗi không bắt được, server khởi động lại. Phải có
supervisor.

### Supervisor

```ini
; /etc/supervisor/conf.d/blog-worker.conf
[program:blog-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/blog/artisan queue:work redis --queue=high,default --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/var/www/blog/storage/logs/worker.log
stopwaitsecs=3600
```

```bash
$ sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start blog-worker:*
```

Hai tham số đáng chú ý:

- `--max-time=3600` — worker tự thoát sau 1 giờ, supervisor khởi động lại. Đây là cách xử lý rò rỉ bộ
  nhớ mà không cần tìm ra nguyên nhân.
- `stopwaitsecs=3600` — cho worker thời gian làm nốt job hiện tại khi deploy. Đặt thấp hơn job dài
  nhất là job bị cắt giữa chừng.

### Với Horizon

```ini
command=php /var/www/blog/artisan horizon
numprocs=1
stopwaitsecs=3600
```

Horizon tự quản lý các worker con, nên `numprocs=1`.

---

## 10. Giám sát

```bash
php artisan queue:monitor redis:high,redis:default --max=100
```

Bắn sự kiện `QueueBusy` khi hàng đợi vượt 100 job:

```php
Event::listen(function (QueueBusy $event) {
    Log::critical('Hàng đợi quá tải', ['queue' => $event->queue, 'size' => $event->size]);
});
```

```php
Schedule::command('queue:monitor redis:high --max=100')->everyFiveMinutes();
Schedule::command('queue:prune-failed --hours=168')->daily();
Schedule::command('queue:prune-batches --hours=48')->daily();
```

Ba chỉ số cần theo dõi:

| Chỉ số | Ngưỡng đáng lo | Nghĩa |
|--------|----------------|-------|
| Độ dài hàng đợi | Tăng liên tục | Worker không kịp — thêm tiến trình |
| Thời gian chờ | > vài chục giây | Job dài đang chặn — tách hàng đợi |
| Số job hỏng | > 0 và tăng | Có bug hoặc dịch vụ ngoài đang chết |

---

## 11. Bảng lỗi queue thường gặp

| Triệu chứng | Nguyên nhân | Sửa |
|-------------|-------------|-----|
| Job không vào hàng đợi | Thiếu `implements ShouldQueue` | Thêm vào |
| Job chạy code cũ | `queue:work` giữ code trong RAM | `queue:restart` khi deploy, `queue:listen` khi dev |
| Job chạy hai lần | `retry_after` < `timeout` | Đặt `retry_after` > `timeout` |
| `ModelNotFoundException` | `dispatch` trước khi commit | `->afterCommit()` |
| Job hỏng im lặng | Chưa có `failed()` | Thêm `public function failed(Throwable $e)` |
| Hàng đợi tắc | Một job dài chặn hết | Tách sang hàng đợi riêng |
| Worker chết không rõ lý do | Hết bộ nhớ | `--max-time=3600` + supervisor |

---

## Bài tập

1. Đổi `QUEUE_CONNECTION` sang `redis`, xác nhận bằng `php artisan about`. Đẩy 100 job và xem chúng
   trong Redis: `docker exec blog-redis redis-cli LLEN queues:default`.

2. Đặt `retry_after = 10` và `--timeout=30`. Viết job `sleep(20)` rồi chạy worker. Đếm số lần job
   thật sự chạy. Sửa lại cho đúng và đo lại.

3. Viết job `implements ShouldBeUnique` với `uniqueId()`. Đẩy nó 5 lần liên tiếp rồi đếm số job trong
   hàng đợi.

4. Bọc `Post::create()` + `dispatch()` trong `DB::transaction`. Thêm `sleep(1)` sau `dispatch` và
   trước khi commit. Chạy worker song song và ghi lại lỗi. Sửa bằng `->afterCommit()`.

5. Tạo `Bus::batch()` với 50 job, trong đó 3 job ném exception. Dùng `allowFailures()` và in
   `$batch->progress()`, `$batch->failedJobs`.

6. Cài Horizon, mở `/horizon`. Đẩy 500 job và quan sát biểu đồ throughput. Rồi cấu hình `waits` và
   bắt sự kiện `LongWaitDetected`.

7. Viết job gọi một URL luôn trả 500. Thêm `ThrottlesExceptions(3, 60)` và `backoff([5, 15, 60])`.
   Ghi lại khoảng cách thời gian giữa các lần thử trong log.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Với `retry_after=10` và job chạy 20 giây: hàng đợi giao lại job cho worker khác ở giây thứ 10,
nên job chạy **ít nhất 2 lần** song song. Không có lỗi nào trong log — đó mới là phần nguy hiểm. Sửa:
`retry_after` phải lớn hơn `timeout`.

**3.** Chỉ **1** job trong hàng đợi. Bốn lần đẩy sau bị bỏ qua trong im lặng (không exception, không log).

**4.**
```
Illuminate\Database\Eloquent\ModelNotFoundException
No query results for model [App\Models\Post].
```
Worker nhận job và tìm model trước khi transaction commit.

</details>

---

Tiếp theo: [04-realtime-reverb.md](./04-realtime-reverb.md)
