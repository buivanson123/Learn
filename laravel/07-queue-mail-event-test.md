# Bài 07 — Queue, Mail, Event, Cache, Lịch chạy và Test

Bài này gom những phần "hạ tầng" của một ứng dụng thật: việc chạy nền, gửi mail, tách logic bằng sự
kiện, cache, chạy định kỳ, và test.

---

## 1. Queue — đẩy việc chậm ra khỏi request

Gửi mail mất 800ms. Nếu làm ngay trong request, người dùng ngồi chờ 800ms cho một việc họ không quan
tâm. Queue tách nó ra: request ghi việc vào hàng đợi rồi trả lời ngay, tiến trình khác làm sau.

### Cấu hình

`.env` mặc định của Laravel 13:

```ini
QUEUE_CONNECTION=database
```

Bảng `jobs`, `job_batches`, `failed_jobs` đã có sẵn trong migration `0001_01_01_000002_create_jobs_table.php`
— không cần tạo gì thêm.

Driver: `sync` (chạy ngay, dùng khi test), `database` (đủ cho phần lớn dự án), `redis` (nhanh nhất,
cần cho tải cao — xem [nang-cao/03](./nang-cao/03-queue-va-horizon.md)).

### Viết job

```bash
$ php artisan make:job SendPostPublishedNotification

 INFO Job [app/Jobs/SendPostPublishedNotification.php] created successfully.
```

```php
namespace App\Jobs;

use App\Models\Post;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class SendPostPublishedNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;
    public int $timeout = 30;

    public function __construct(public Post $post) {}

    public function handle(): void
    {
        Log::info('Da gui thong bao cho bai viet', [
            'id' => $this->post->id,
            'title' => $this->post->title,
        ]);
    }
}
```

`implements ShouldQueue` là thứ quyết định. Bỏ nó đi thì job chạy **đồng bộ** ngay trong request, và
bạn sẽ không hiểu vì sao queue không nhận việc nào.

### Đẩy job vào hàng đợi

```php
SendPostPublishedNotification::dispatch($post);
SendPostPublishedNotification::dispatch($post)->delay(now()->addMinutes(5));
SendPostPublishedNotification::dispatch($post)->onQueue('emails');
SendPostPublishedNotification::dispatchAfterResponse($post);   // sau khi trả response, không cần worker
```

Kiểm chứng nó thật sự vào bảng chứ không chạy ngay:

```bash
$ php artisan tinker --execute='
    App\Jobs\SendPostPublishedNotification::dispatch(App\Models\Post::first());
    echo "so job trong hang doi: " . DB::table("jobs")->count();
'
so job trong hang doi: 1
```

Nội dung được cất trong cột `payload`:

```json
{"uuid":"3d16a3cb-f4ea-4335-82fd-db6f2bff282d",
 "displayName":"App\\Jobs\\SendPostPublishedNotification",
 "job":"Illuminate\\Queue\\CallQueuedHandler@call",
 "maxTries":3,"maxExceptions":null,"failOnTimeout":false,...}
```

Chú ý: `$this->post` **không** được lưu cả model vào payload — trait `Queueable` chỉ lưu **id**, rồi
worker nạp lại từ database lúc chạy. Hệ quả thật: nếu bài viết bị xoá giữa lúc chờ, job sẽ ném
`ModelNotFoundException` và tự bị xoá khỏi hàng đợi (đó là hành vi mặc định, đúng đắn).

### Chạy worker

```bash
$ php artisan queue:work --stop-when-empty

  2026-08-18 14:04:08 App\Jobs\SendPostPublishedNotification ......... RUNNING
  2026-08-18 14:04:08 App\Jobs\SendPostPublishedNotification .... 18.70ms DONE
```

```bash
$ php artisan tinker --execute='echo DB::table("jobs")->count();'
0
```

Và log ghi lại:

```
Da gui thong bao cho bai viet {"id":1,"title":"Bai dau tien"}
```

Các cờ hay dùng:

```bash
php artisan queue:work                       # chạy mãi (dùng trên production, có supervisor)
php artisan queue:listen                     # tự nạp lại code khi sửa (dùng khi dev, chậm hơn)
php artisan queue:work --queue=high,default  # ưu tiên hàng đợi high trước
php artisan queue:work --tries=3 --timeout=60
php artisan queue:work --stop-when-empty     # dùng trong CI/script
php artisan queue:restart                    # bảo mọi worker thoát sau job hiện tại
```

> ⚠️ **`queue:work` giữ code trong bộ nhớ.** Sửa file job xong mà worker vẫn chạy code cũ là chuyện
> bình thường, không phải bug. Khi dev dùng `queue:listen` (hoặc `php artisan dev` — nó chạy sẵn
> `queue:listen`). Khi deploy **bắt buộc** chạy `php artisan queue:restart`, nếu không worker cũ vẫn
> chạy code của bản cũ.

### Job hỏng

```php
class FailingJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function handle(): void
    {
        throw new RuntimeException('API bên thứ ba không phản hồi');
    }
}
```

```bash
$ php artisan queue:work --stop-when-empty

  2026-08-18 14:04:22 App\Jobs\FailingJob ............................ RUNNING
  2026-08-18 14:04:22 App\Jobs\FailingJob ........................ 6.72ms FAIL
  2026-08-18 14:04:22 App\Jobs\FailingJob ............................ RUNNING
  2026-08-18 14:04:22 App\Jobs\FailingJob ........................ 3.36ms FAIL
```

Chạy đúng 2 lần theo `$tries = 2`, rồi rơi vào bảng `failed_jobs`:

```bash
$ php artisan queue:failed

 2026-08-18 14:04:22  bfc73448-d642-432d-84ff-5f93d7111165  database@default  App\Jobs\FailingJob
```

```bash
php artisan queue:retry bfc73448-d642-432d-84ff-5f93d7111165
php artisan queue:retry all
php artisan queue:forget bfc73448-...
php artisan queue:flush
php artisan queue:prune-failed --hours=168
```

Xử lý khi job hỏng hẳn:

```php
public function failed(Throwable $e): void
{
    Log::error('Không gửi được thông báo', ['post' => $this->post->id, 'error' => $e->getMessage()]);
}

public function backoff(): array
{
    return [10, 60, 300];      // thử lại sau 10s, 60s, 300s
}
```

`backoff` tăng dần rất quan trọng khi job gọi API ngoài: thử lại ngay lập tức 3 lần chỉ làm dịch vụ
đang quá tải càng quá tải.

---

## 2. Mail

```bash
$ php artisan make:mail PostPublished --markdown=mail.posts.published

 INFO Mailable [app/Mail/PostPublished.php] created successfully.
 INFO Markdown view [resources/views/mail/posts/published.blade.php] created successfully.
```

```php
namespace App\Mail;

use App\Models\Post;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PostPublished extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(public Post $post) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Bài viết mới: {$this->post->title}");
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.posts.published');
    }
}
```

`implements ShouldQueue` trên Mailable = mail tự đi qua hàng đợi, không chặn request.

```blade
{{-- resources/views/mail/posts/published.blade.php --}}
<x-mail::message>
# {{ $post->title }}

{{ Str::limit(strip_tags($post->body), 200) }}

<x-mail::button :url="route('posts.show', $post)">
Đọc bài viết
</x-mail::button>

Cảm ơn bạn,<br>
{{ config('app.name') }}
</x-mail::message>
```

Gửi:

```php
use Illuminate\Support\Facades\Mail;

Mail::to($user)->send(new PostPublished($post));
Mail::to($user)->cc($editor)->bcc($admin)->send(new PostPublished($post));
```

### Xem mail lúc dev mà không cần SMTP

`.env` mặc định là `MAIL_MAILER=log` — mail được ghi thẳng vào `storage/logs/laravel.log`:

```bash
$ php artisan tinker --execute='
    Mail::raw("Xin chao tu Blog", fn ($m) => $m->to("son@test.dev")->subject("Thu thu"));
'
```

```
Subject: Thu thu
MIME-Version: 1.0
Date: Tue, 18 Aug 2026 14:04:33 +0000
Message-ID: <cc69098094b5d9be247f9da817624fd0@example.com>
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: quoted-printable
```

Đủ để kiểm tra nội dung. Muốn xem giao diện HTML đẹp thì trả thẳng Mailable từ một route:

```php
Route::get('/preview-mail', fn () => new App\Mail\PostPublished(App\Models\Post::first()));
```

Mở trình duyệt vào `/preview-mail` là thấy đúng mail sẽ gửi. Nhớ xoá route này trước khi deploy.

---

## 3. Event và Listener — tách logic phụ ra khỏi việc chính

```bash
$ php artisan make:event PostWasPublished
$ php artisan make:listener NotifySubscribers --event=PostWasPublished
```

```php
namespace App\Events;

use App\Models\Post;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PostWasPublished
{
    use Dispatchable, SerializesModels;

    public function __construct(public Post $post) {}
}
```

```php
namespace App\Listeners;

use App\Events\PostWasPublished;
use App\Mail\PostPublished;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Mail;

class NotifySubscribers implements ShouldQueue
{
    public function handle(PostWasPublished $event): void
    {
        foreach ($event->post->category->subscribers as $user) {
            Mail::to($user)->send(new PostPublished($event->post));
        }
    }
}
```

Bắn:

```php
PostWasPublished::dispatch($post);
// hoặc
event(new PostWasPublished($post));
```

### Không cần đăng ký

Laravel 13 tự tìm listener dựa vào **kiểu tham số của method `handle()`**. Kiểm chứng:

```bash
$ php artisan event:list

 App\Events\PostWasPublished ..
 ⇂ App\Listeners\NotifySubscribers@handle
 Illuminate\Auth\Events\Registered ..
 ⇂ Illuminate\Auth\Listeners\SendEmailVerificationNotification
```

Dòng có dấu `⇂` là listener đang lắng nghe event ở dòng ngay trên nó.

Nếu dòng đó không hiện, nguyên nhân gần như luôn là `handle()` thiếu type-hint hoặc listener nằm ngoài
`app/Listeners`.

### Vì sao dùng event thay vì gọi thẳng

`PostController::store()` chỉ nên lo việc lưu bài viết. Gửi mail, đánh chỉ mục tìm kiếm, xoá cache,
ghi nhật ký — mỗi việc một listener. Thêm việc mới không cần đụng vào controller.

Đừng lạm dụng: khi luồng nghiệp vụ **bắt buộc** phải theo thứ tự và phải thành công cùng nhau, viết
thẳng trong service và bọc `DB::transaction()` rõ ràng hơn nhiều so với chuỗi event.

---

## 4. Cache

```php
use Illuminate\Support\Facades\Cache;

Cache::put('key', $value, now()->addMinutes(10));
Cache::get('key', 'mặc định');
Cache::forget('key');
Cache::flush();

$count = Cache::remember('posts.count', 60, fn () => Post::count());
$count = Cache::rememberForever('posts.count', fn () => Post::count());
```

`remember` là hàm bạn dùng 90% thời gian: có trong cache thì lấy ra, không có thì chạy closure, lưu
lại, rồi trả về.

Đo thật (closure cố tình chậm 200ms):

```bash
$ php artisan tinker --execute='
    $t0 = microtime(true);
    $v = Cache::remember("posts.count", 60, function () { usleep(200000); return App\Models\Post::count(); });
    echo "lan 1: {$v} bai, " . round((microtime(true)-$t0)*1000) . "ms\n";
    $t1 = microtime(true);
    $v = Cache::remember("posts.count", 60, function () { usleep(200000); return App\Models\Post::count(); });
    echo "lan 2: {$v} bai, " . round((microtime(true)-$t1)*1000) . "ms\n";
'
lan 1: 29 bai, 263ms
lan 2: 29 bai, 3ms
```

### Cache cũ là lỗi nguy hiểm nhất của cache

Đăng bài mới mà trang chủ vẫn hiện danh sách cũ trong 60 giây. Xoá cache khi dữ liệu đổi:

```php
// app/Models/Post.php
protected static function booted(): void
{
    static::saved(fn () => Cache::forget('posts.count'));
    static::deleted(fn () => Cache::forget('posts.count'));
}
```

Nhớ: `Post::where(...)->update(...)` **không** kích hoạt `saved()` (xem
[bài 03 mục 7](./03-database-va-eloquent.md)). Cache sẽ cũ mà bạn không biết.

### Cache driver

`.env` mặc định `CACHE_STORE=database`. Đủ cho dự án nhỏ. Với dự án thật dùng `redis` —
xem [nang-cao/02](./nang-cao/02-cache-nhieu-tang.md).

---

## 5. Lịch chạy định kỳ

Laravel 13 khai lịch trong `routes/console.php`:

```php
Schedule::command('cache:prune-stale-tags')->hourly();

Schedule::call(fn () => \App\Models\Post::where('status', 'draft')
    ->where('created_at', '<', now()->subMonths(6))->delete())
    ->daily()->name('xoa-ban-nhap-cu');
```

```bash
$ php artisan schedule:list

 0 * * * *  php artisan cache:prune-stale-tags  Next Due: 55 minutes from now
 0 0 * * *  xoa-ban-nhap-cu ..................  Next Due: 9 hours from now
```

Đặt `->name(...)` cho `Schedule::call()` — không có tên thì `schedule:list` hiện một chuỗi closure vô
nghĩa và bạn không dùng được `schedule:test`.

Các mốc thời gian:

```php
->everyMinute()  ->everyFiveMinutes()  ->hourly()  ->hourlyAt(15)
->daily()        ->dailyAt('03:00')    ->weeklyOn(1, '08:00')  ->monthly()
->cron('0 */6 * * *')
->timezone('Asia/Ho_Chi_Minh')
->withoutOverlapping()      // không cho hai lần chạy chồng nhau
->onOneServer()             // chỉ 1 server chạy khi deploy nhiều máy
->runInBackground()
```

`->withoutOverlapping()` là thứ cứu bạn khi một job định kỳ chạy lâu hơn chu kỳ của chính nó.

### Trên server thật

Chỉ cần **một** dòng cron duy nhất cho toàn bộ ứng dụng:

```cron
* * * * * cd /var/www/blog && php artisan schedule:run >> /dev/null 2>&1
```

Laravel tự quyết định phút đó có task nào cần chạy hay không.

Thử một task ngay mà không chờ tới giờ:

```bash
$ php artisan schedule:test
```

---

## 6. Test

### Cấu hình

`phpunit.xml` sinh sẵn dùng SQLite in-memory:

```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

Như đã chỉ ra ở [bài 06 mục 10](./06-livewire-4.md), nếu ứng dụng chạy PostgreSQL thì nên cho test
chạy PostgreSQL luôn:

```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="blog_test"/>
```

Laravel tự tạo database `blog_test` ở lần chạy đầu.

### Feature test

```bash
$ php artisan make:test PostControllerTest
```

```php
namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_khach_xem_duoc_danh_sach_bai_da_dang(): void
    {
        Post::factory()->for(User::factory(), 'author')->create(['title' => 'Bai da dang']);

        $this->get('/posts')
            ->assertOk()
            ->assertSee('Bai da dang');
    }

    public function test_khach_khong_vao_duoc_trang_viet_bai(): void
    {
        $this->get('/posts/create')->assertRedirect('/login');
    }

    public function test_nguoi_dung_dang_nhap_dang_duoc_bai(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->post('/posts', [
                'title' => 'Bai moi', 'slug' => 'bai-moi',
                'body' => 'Noi dung du dai de qua validate', 'status' => 'draft',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('posts', ['slug' => 'bai-moi', 'user_id' => $user->id]);
    }

    public function test_khong_sua_duoc_bai_cua_nguoi_khac(): void
    {
        $post = Post::factory()->for(User::factory(), 'author')->create();

        $this->actingAs(User::factory()->create())
            ->put("/posts/{$post->id}", ['title' => 'Cuop bai'])
            ->assertForbidden();
    }
}
```

`RefreshDatabase` chạy migration rồi bọc mỗi test trong một transaction và rollback sau đó — test này
không thấy dữ liệu của test kia.

### Assertion hay dùng

```php
$response->assertOk();               // 200
$response->assertCreated();          // 201
$response->assertRedirect('/posts');
$response->assertForbidden();        // 403
$response->assertUnauthorized();     // 401
$response->assertNotFound();         // 404
$response->assertSessionHasErrors(['title']);
$response->assertJson(['ok' => true]);
$response->assertJsonCount(10, 'data');

$this->assertDatabaseHas('posts', ['slug' => 'bai-moi']);
$this->assertDatabaseMissing('posts', ['id' => $post->id]);
$this->assertDatabaseCount('posts', 3);
$this->assertModelExists($post);
$this->assertSoftDeleted($post);
```

### Test queue, mail, event mà không thật sự chạy chúng

```php
use Illuminate\Support\Facades\{Bus, Mail, Event, Queue, Notification};

public function test_dang_bai_thi_day_job_gui_thong_bao(): void
{
    Queue::fake();
    Mail::fake();
    Event::fake([PostWasPublished::class]);

    // ... gọi hành động ...

    Queue::assertPushed(SendPostPublishedNotification::class);
    Mail::assertSent(PostPublished::class, fn ($mail) => $mail->hasTo('son@test.dev'));
    Event::assertDispatched(PostWasPublished::class);
    Queue::assertNothingPushed();
}
```

`fake()` chặn việc thật xảy ra và ghi lại lời gọi để bạn kiểm tra. Không có nó, test sẽ **thật sự** đẩy
job vào bảng và **thật sự** cố gửi mail.

### Chạy test

```bash
$ php artisan test

   PASS  Tests\Unit\ExampleTest
  ✓ that true is true

   PASS  Tests\Feature\ExampleTest
  ✓ the application returns a successful response                          0.09s

  Tests:    2 passed (2 assertions)
  Duration: 0.16s
```

```bash
php artisan test --filter=PostControllerTest
php artisan test --parallel
php artisan test --coverage
php artisan test --stop-on-failure
```

### ⚠️ Vì sao output test của bạn có thể là JSON

Laravel 13 cài sẵn `laravel/pao` trong `require-dev` — "agent-optimized output for PHP testing tools".
Nó phát hiện lệnh đang chạy dưới một AI agent và đổi output sang JSON một dòng:

```bash
$ php artisan test
{"tool":"phpunit","result":"passed","tests":2,"passed":2,"assertions":2,"duration_ms":102}
```

Cách nó phát hiện — đọc mã nguồn `vendor/laravel/agent-detector/src/AgentDetector.php`:

```php
public const AGENT_ENV_VARS = [
    'CURSOR_AGENT' => KnownAgent::Cursor,
    'GEMINI_CLI' => KnownAgent::Gemini,
    'CODEX_SANDBOX' => KnownAgent::Codex,
    'CLAUDECODE' => KnownAgent::Claude,
    'COPILOT_CLI' => KnownAgent::Copilot,
    ...
];
```

Chạy trong terminal bình thường thì không có biến nào trong danh sách đó, và bạn thấy output quen
thuộc. `laravel/pint` cũng hành xử y hệt. Không phải lỗi, không cần sửa gì.

---

## Bài tập

1. Viết job `SendPostPublishedNotification`. Dispatch nó rồi **chưa** chạy worker — kiểm tra
   `DB::table('jobs')->count()`. Sau đó chạy `queue:work --stop-when-empty` và kiểm tra lại.

2. Bỏ `implements ShouldQueue` khỏi job rồi dispatch. Đếm số dòng trong bảng `jobs` và giải thích.

3. Viết một job luôn ném exception với `$tries = 2`. Chạy worker, ghi lại output (chú ý số lần RUNNING),
   rồi chạy `php artisan queue:failed`.

4. Sửa nội dung `handle()` của một job **trong khi** `queue:work` đang chạy. Dispatch job mới và quan
   sát: nó chạy code cũ hay mới? Lặp lại với `queue:listen`.

5. Gửi mail bằng `Mail::raw()` với `MAIL_MAILER=log`. Tìm nội dung trong `storage/logs/laravel.log`.
   Rồi tạo route `/preview-mail` trả thẳng Mailable và mở trên trình duyệt.

6. Tạo event + listener. Chạy `php artisan event:list` để xác nhận Laravel đã tự tìm ra. Rồi **xoá
   type-hint** ở tham số `handle()` và chạy lại lệnh đó.

7. Dùng `Cache::remember` với closure `usleep(200000)`. Đo thời gian lần 1 và lần 2. Rồi thêm
   `static::saved()` xoá cache vào model và kiểm tra nó hoạt động.

8. Khai hai task trong `routes/console.php`, một cái **không** đặt `->name()`. Chạy `schedule:list` và
   so sánh hai dòng.

9. Viết feature test cho luồng "người dùng khác không sửa được bài của tôi". Chạy trên SQLite mặc định
   trước, rồi đổi `phpunit.xml` sang `pgsql` và chạy lại.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Bảng `jobs` có **0** dòng. Không có `ShouldQueue` thì `dispatch()` chạy `handle()` ngay lập tức
trong cùng request — đúng bằng việc gọi hàm thường, chỉ vòng vèo hơn.

**3.**
```
  App\Jobs\FailingJob ............................ RUNNING
  App\Jobs\FailingJob ........................ 6.72ms FAIL
  App\Jobs\FailingJob ............................ RUNNING
  App\Jobs\FailingJob ........................ 3.36ms FAIL
```
Đúng 2 lần theo `$tries`. Sau đó:
```
$ php artisan queue:failed
 2026-08-18 14:04:22  bfc73448-...  database@default  App\Jobs\FailingJob
```

**4.** `queue:work` chạy **code cũ** — nó nạp framework một lần rồi giữ trong bộ nhớ. `queue:listen`
khởi động lại tiến trình con cho mỗi job nên chạy code mới. Đây là lý do bước deploy phải có
`php artisan queue:restart`.

**6.** Không có type-hint thì Laravel không biết listener lắng nghe event nào, và dòng tương ứng biến
mất khỏi `event:list`. Sự kiện được bắn ra nhưng không ai xử lý — **không có lỗi nào**.

</details>

---

Tiếp theo: [08-du-an-blog.md](./08-du-an-blog.md) — ghép tất cả lại thành một ứng dụng hoàn chỉnh.
