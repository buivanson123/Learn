# Nâng cao 02 — Cache nhiều tầng

Cache là bước tối ưu **sau cùng**, không phải đầu tiên. Đặt cache lên trên một query N+1 chỉ giấu vấn
đề cho tới lần cache miss đầu tiên vào giờ cao điểm — lúc đó cả 500 request cùng đâm vào database.

Đọc [bài 01](./01-toi-uu-eloquent.md) trước.

---

## 1. Chọn driver — đo thật

500 lần `Cache::get()` trên cùng một khoá:

| Driver | Thời gian | Ghi chú |
|--------|-----------|---------|
| `database` | **328 ms** | Mặc định của Laravel 13. Mỗi lần đọc là một query |
| `redis` | **94 ms** | Nhanh gấp ~3,5 lần |
| `array` | **2 ms** | Chỉ sống trong 1 request. Dùng cho test |

Tự đo lại:

```bash
$ php artisan tinker --execute="
    config(['cache.default' => 'redis']);
    Cache::put('k', 'v', 60);
    \$t = microtime(true);
    for (\$i = 0; \$i < 500; \$i++) { Cache::get('k'); }
    printf('%d ms' . PHP_EOL, (microtime(true) - \$t) * 1000);
"
94 ms
```

Kết luận thực dụng: driver `database` đủ cho dự án nhỏ và **không cần thêm hạ tầng**. Khi tải tăng,
đổi sang Redis là việc sửa `.env`, không phải sửa code.

---

## 2. Dựng Redis

```bash
$ docker run -d --name blog-redis -p 63790:6379 redis:8-alpine
$ docker exec blog-redis redis-cli ping
PONG
$ docker exec blog-redis redis-cli INFO server | grep redis_version
redis_version:8.10.0
```

Laravel cần một client PHP. Hai lựa chọn:

```bash
# predis — thư viện PHP thuần, không cần biên dịch extension
$ composer require predis/predis
Using version ^3.6 for predis/predis

# hoặc phpredis — extension C, nhanh hơn, cần cài ở tầng hệ thống
$ pecl install redis
```

`.env`:

```ini
REDIS_CLIENT=predis
REDIS_HOST=127.0.0.1
REDIS_PORT=63790
REDIS_PASSWORD=null

CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

Kiểm chứng:

```bash
$ php artisan config:clear
$ php artisan about | grep -A 3 Drivers
 Cache .. redis
 Database .. pgsql

$ php artisan tinker --execute='Cache::put("test","xin chao",60); echo Cache::get("test");'
xin chao
```

> Nếu `REDIS_CLIENT=phpredis` (mặc định của Laravel) mà bạn chưa cài extension, lỗi là:
> ```
> Please make sure the PHP Redis extension is installed and enabled.
> ```
> Sửa bằng cách đổi thành `predis` (đã cài qua composer) hoặc cài extension.

---

## 3. Ba tầng cache

Một trang thật thường có ba tầng, mỗi tầng giải quyết một loại chi phí:

```
Request
  ↓
[Tầng 1] Cache trong 1 request      → tránh gọi lại cùng một thứ trong một request
  ↓
[Tầng 2] Cache chia sẻ (Redis)      → tránh đụng database
  ↓
[Tầng 3] Cache của database         → PostgreSQL tự làm, bạn không điều khiển
  ↓
Đĩa
```

### Tầng 1 — trong một request

```php
// Livewire
#[Computed]
public function posts() { return Post::published()->paginate(10); }
// gọi $this->posts 5 lần trong view → chỉ 1 query
```

```php
// Eloquent — kết quả quan hệ được nhớ sau lần truy cập đầu
$post->comments;    // query
$post->comments;    // không query
$post->comments()->get();   // ← có ngoặc = query lại, đừng nhầm
```

```php
// Bất kỳ đâu — container nhớ trong 1 request
app()->scoped(SettingsRepository::class, fn () => new SettingsRepository());
```

### Tầng 2 — Redis

```php
$posts = Cache::remember('posts.home', now()->addMinutes(10), function () {
    return Post::published()->with('author:id,name')->latest('published_at')->limit(10)->get();
});
```

---

## 4. API cache

```php
Cache::put('key', $value, now()->addMinutes(10));
Cache::forever('key', $value);
Cache::get('key', 'mặc định');
Cache::get('key', fn () => tinhToanNang());       // closure chỉ chạy khi miss
Cache::has('key');
Cache::forget('key');
Cache::flush();                                    // ⚠️ xoá SẠCH, kể cả session nếu chung store

Cache::remember('key', 600, fn () => Post::count());
Cache::rememberForever('key', fn () => Post::count());

Cache::pull('key');                                // lấy rồi xoá
Cache::add('key', $v, 600);                        // chỉ đặt nếu chưa có — atomic
Cache::increment('views.post.1');
Cache::decrement('stock.3', 2);

Cache::store('redis')->get('key');                 // chỉ định store
```

`Cache::add()` là **atomic** — dùng nó thay cho `if (! Cache::has(...)) Cache::put(...)`, vì giữa hai
lệnh đó có thể có request khác chen vào.

---

## 5. Cache tag — xoá theo nhóm

Vấn đề: đăng bài mới thì phải xoá `posts.home`, `posts.category.1`, `posts.category.2`,
`posts.page.1`… Bạn không thể liệt kê hết.

```php
Cache::tags(['posts', 'list'])->put('home', $data, 600);
Cache::tags(['posts', 'list'])->get('home');

Cache::tags(['posts'])->flush();       // xoá MỌI thứ gắn tag 'posts'
```

Kiểm chứng thật trên Redis:

```bash
$ php artisan tinker --execute='
    Cache::tags(["posts", "list"])->put("home", ["a","b"], 60);
    echo "doc lai: " . json_encode(Cache::tags(["posts","list"])->get("home")) . "\n";
    Cache::tags(["posts"])->flush();
    var_dump(Cache::tags(["posts","list"])->get("home"));
'
doc lai: ["a","b"]
NULL
```

> ⚠️ **Tag chỉ hoạt động với `redis`, `memcached`, `array`, `dynamodb`.** Driver `database` và `file`
> **không hỗ trợ**:
> ```
> BadMethodCallException  This cache store does not support tagging.
> ```
> Đây là lý do đáng cân nhắc để chuyển sang Redis, hơn cả tốc độ.

Xoá tag định kỳ để dọn rác:

```php
Schedule::command('cache:prune-stale-tags')->hourly();
```

---

## 6. Cache cũ — lỗi nguy hiểm nhất

Không phải "cache chậm", mà là "cache trả dữ liệu sai".

### Xoá cache trong vòng đời model

```php
// app/Models/Post.php
protected static function booted(): void
{
    static::saved(function (Post $post) {
        Cache::tags(['posts'])->flush();
    });

    static::deleted(function (Post $post) {
        Cache::tags(['posts'])->flush();
    });
}
```

> ⚠️ **Không kích hoạt với update hàng loạt.**
> ```php
> Post::where('status', 'draft')->update(['status' => 'published']);   // ← không có event
> ```
> Câu này chạy một `UPDATE` duy nhất, không nạp model nào, nên `saved()` không chạy và cache **không**
> được xoá. Cache sẽ sai cho tới khi hết hạn.
>
> Sửa: xoá cache thủ công ngay sau đó, hoặc đừng dùng update hàng loạt ở chỗ có cache.

### Đặt hạn ngắn cho dữ liệu quan trọng

Không có cơ chế xoá nào là hoàn hảo. Luôn đặt TTL như một lớp bảo hiểm:

```php
Cache::remember('posts.home', now()->addMinutes(5), ...);   // sai tối đa 5 phút
```

Đừng dùng `rememberForever` cho dữ liệu người dùng thấy.

---

## 7. Cache stampede — và cách chống

**Kịch bản:** khoá `posts.home` hết hạn lúc 9h00 sáng. 500 request đang chạy đồng thời đều thấy cache
miss, cả 500 cùng chạy query nặng. Database sập.

### Cách 1 — khoá atomic

```php
use Illuminate\Support\Facades\Cache;

function postsHome(): Collection
{
    return Cache::remember('posts.home', 600, function () {
        // chỉ 1 tiến trình vào được đây tại một thời điểm
        return Cache::lock('posts.home.lock', 10)->block(5, function () {
            return Post::published()->with('author:id,name')->limit(10)->get();
        });
    });
}
```

`block(5, ...)` chờ tối đa 5 giây để lấy khoá. Không lấy được thì ném `LockTimeoutException`.

### Cách 2 — `Cache::flexible()` (khuyến nghị)

Laravel có sẵn cơ chế "stale-while-revalidate":

```php
$posts = Cache::flexible('posts.home', [300, 600], function () {
    return Post::published()->with('author:id,name')->limit(10)->get();
});
```

Đọc hai con số:

- **0–300 giây:** trả cache, không làm gì thêm.
- **300–600 giây:** trả **cache cũ ngay lập tức**, đồng thời tính lại ở nền (sau khi response đã gửi).
- **Sau 600 giây:** cache hết hạn thật, request phải chờ tính lại.

Người dùng không bao giờ chờ, và database chỉ bị một request tính lại thay vì 500.

### Cách 3 — khoá atomic cho việc chỉ được chạy một lần

```php
$lock = Cache::lock('gui-bao-cao-thang', 300);

if ($lock->get()) {
    try {
        GuiBaoCaoThang::dispatch();
    } finally {
        $lock->release();
    }
}
```

Dùng khi có nhiều server cùng chạy scheduler. (Cách gọn hơn: `->onOneServer()` trong schedule.)

---

## 8. Cache ở tầng nào

### Cache một giá trị nhỏ

```php
$count = Cache::remember('posts.published.count', 600, fn () => Post::published()->count());
```

### Cache một model

```php
public static function findCached(string $slug): ?self
{
    return Cache::remember("post.{$slug}", 3600, fn () => static::where('slug', $slug)->first());
}
```

> Cache model là con dao hai lưỡi: Eloquent phải serialize/unserialize model, và bạn dễ nhận về model
> "cũ" đã bị sửa ở nơi khác. Với dữ liệu ít đổi (chuyên mục, cấu hình) thì tốt; với dữ liệu đổi liên
> tục thì cache **kết quả cuối** (mảng, HTML) thay vì cache model.

### Cache mảnh giao diện

```blade
@php($html = Cache::remember("post-card.{$post->id}.{$post->updated_at->timestamp}", 3600,
        fn () => view('components.post-card', ['post' => $post])->render()))
{!! $html !!}
```

Mẹo hay: nhét `updated_at->timestamp` vào **khoá cache**. Bài viết được sửa → `updated_at` đổi → khoá
đổi → tự động là cache mới. Không cần xoá cache bao giờ. Kỹ thuật này gọi là *key-based cache expiration*.

### Cache cả response

```php
// app/Http/Middleware/CacheResponse.php
public function handle(Request $request, Closure $next): Response
{
    if (! $request->isMethod('GET') || $request->user()) {
        return $next($request);
    }

    $key = 'response:' . sha1($request->fullUrl());

    if ($cached = Cache::get($key)) {
        return response($cached)->header('X-Cache', 'HIT');
    }

    $response = $next($request);

    if ($response->isSuccessful()) {
        Cache::put($key, $response->getContent(), 300);
    }

    return $response->header('X-Cache', 'MISS');
}
```

Chú ý điều kiện `! $request->user()` — **không bao giờ** cache response của người đã đăng nhập bằng
khoá chung, nếu không người này sẽ thấy trang của người kia. Đây là một trong những lỗ hổng nghiêm
trọng và khó phát hiện nhất.

Kiểm chứng:

```bash
$ curl -sI http://127.0.0.1:8000/ | grep X-Cache
X-Cache: MISS
$ curl -sI http://127.0.0.1:8000/ | grep X-Cache
X-Cache: HIT
```

---

## 9. Session và queue trên Redis

```ini
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
CACHE_STORE=redis
```

Tách chúng ra database Redis khác nhau để `Cache::flush()` không xoá mất session của mọi người:

```php
// config/database.php
'redis' => [
    'default' => [ /* ... */ 'database' => env('REDIS_DB', 0) ],
    'cache'   => [ /* ... */ 'database' => env('REDIS_CACHE_DB', 1) ],
],
```

```php
// config/cache.php
'redis' => [
    'driver'     => 'redis',
    'connection' => env('REDIS_CACHE_CONNECTION', 'cache'),   // ← dùng connection 'cache'
],
```

Không tách thì một lần `php artisan cache:clear` sẽ **đăng xuất toàn bộ người dùng**.

---

## 10. Danh sách kiểm tra

Trước khi thêm cache vào bất kỳ chỗ nào, trả lời 4 câu:

1. **Đã tối ưu query chưa?** Cache một query N+1 chỉ dời vấn đề đi.
2. **Dữ liệu này sai trong bao lâu thì chấp nhận được?** Đó chính là TTL.
3. **Ai xoá cache khi dữ liệu đổi?** Nếu không có ai, dùng key-based expiration.
4. **Cache này có chứa dữ liệu riêng của một người dùng không?** Nếu có, khoá phải chứa `user_id`.

---

## Bài tập

1. Đo `Cache::get` 500 lần với ba driver `database`, `redis`, `array`. Lập bảng kết quả trên máy bạn.

2. Dùng `Cache::tags(['posts'])->put(...)` với `CACHE_STORE=database`. Ghi lại nguyên văn exception.
   Đổi sang `redis` và thử lại.

3. Cache trang danh sách 10 phút. Đăng một bài mới và mô tả hiện tượng. Thêm `static::saved()` xoá tag
   và thử lại.

4. Sau khi làm xong bài 3, chạy `Post::where('status','draft')->update(['status'=>'published'])`.
   Cache có được xoá không? Giải thích.

5. Dùng `Cache::flexible('key', [10, 30], ...)` với closure `sleep(2)`. Chờ 15 giây rồi tải trang —
   đo thời gian phản hồi. Chờ tiếp tới 35 giây rồi tải lại — đo lần nữa. Giải thích chênh lệch.

6. Viết middleware `CacheResponse`. Kiểm tra header `X-Cache` bằng `curl -I`. Rồi đăng nhập và tải
   lại — xác nhận response **không** bị cache.

7. Đặt `CACHE_STORE=redis` và `SESSION_DRIVER=redis` dùng chung database. Đăng nhập, chạy
   `php artisan cache:clear`, tải lại trang. Chuyện gì xảy ra? Sửa theo mục 9.

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```
BadMethodCallException  This cache store does not support tagging.
```
Driver `database` và `file` không hỗ trợ tag.

**4.** **Không** được xoá. `Post::where(...)->update(...)` chạy một câu SQL `UPDATE`, không nạp model
nên `static::saved()` không bao giờ chạy. Cache sẽ sai cho tới khi hết TTL.

**5.** Lần đầu (giây thứ 15, trong vùng 10–30): trả **ngay lập tức** bằng cache cũ, việc tính lại đẩy
ra sau response. Lần sau (giây thứ 35, đã quá 30): phải chờ đủ 2 giây vì cache hết hạn thật.

**7.** Bạn bị đăng xuất — `cache:clear` gọi `FLUSHDB` trên database Redis đang chứa cả session. Sửa
bằng cách cho cache và session dùng hai `database` Redis khác nhau.

</details>

---

Tiếp theo: [03-queue-va-horizon.md](./03-queue-va-horizon.md)
