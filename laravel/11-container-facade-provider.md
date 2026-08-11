# Bài 11 — Service Container, Facade và Service Provider

Đây là **bộ ba cơ chế** làm nên Laravel. Bạn dùng chúng mỗi ngày mà có thể chưa để ý.

Bài này quan trọng vì hai lý do:

1. Hiểu chúng thì gỡ lỗi nhanh hơn hẳn — phần lớn lỗi "Target class does not exist" hay "A facade root
   has not been set" đều nằm ở đây.
2. Đây là nhóm câu hỏi **gần như chắc chắn bị hỏi** khi phỏng vấn Laravel. Nó là thứ phân biệt "biết
   dùng framework" và "hiểu framework".

Mọi khẳng định trong bài đều được chứng minh bằng mã nguồn framework hoặc bằng lệnh chạy thật.

---

## 1. Service Container là gì

Container là **cái tủ chứa hướng dẫn tạo đối tượng**. Bạn nói "khi cần `PaymentGateway` thì dựng
`StripeGateway`", nó ghi nhớ và tự dựng khi cần.

Vấn đề nó giải quyết:

```php
// ❌ Không có container: mỗi chỗ cần OrderService phải tự dựng cả cây phụ thuộc
$gateway  = new StripeGateway(new HttpClient(config('services.stripe.key')));
$logger   = new Logger(storage_path('logs/order.log'));
$service  = new OrderService($gateway, $logger);
```

```php
// ✅ Có container: khai kiểu, container tự lo
public function store(OrderService $service) { /* ... */ }
```

Đổi `StripeGateway` sang `MomoGateway` chỉ sửa **một dòng** ở provider, không đi sửa 20 chỗ `new`.

### Ba cách lấy đối tượng ra

```php
app(OrderService::class);          // helper
resolve(OrderService::class);      // giống hệt app()
$this->app->make(OrderService::class);   // trong provider
```

Cách **tốt nhất** là không gọi gì cả — khai kiểu ở tham số và để Laravel tự inject:

```php
public function store(StorePostRequest $request, CreatePost $createPost) { }
```

Đây gọi là **autowiring**: Laravel đọc kiểu tham số bằng Reflection, dựng đệ quy cả cây phụ thuộc.

---

## 2. `bind` vs `singleton` vs `scoped` — câu hỏi phỏng vấn kinh điển

| Cách | Mỗi lần gọi | Vòng đời |
|------|-------------|----------|
| `bind()` | Dựng **mới** | Một lần dùng |
| `singleton()` | Trả **cùng một** đối tượng | Cả vòng đời ứng dụng |
| `scoped()` | Trả cùng đối tượng, nhưng **huỷ sau mỗi request** | Một request (quan trọng với Octane) |
| `instance()` | Trả đối tượng bạn đưa sẵn | Cả vòng đời |

Chứng minh bằng chạy thật:

```bash
$ php artisan tinker --execute='
    class Demo { public string $id; public function __construct() { $this->id = substr(md5(random_int(0,PHP_INT_MAX)),0,6); } }

    app()->bind("demo.bind", fn () => new Demo);
    app()->singleton("demo.singleton", fn () => new Demo);

    echo "bind      lan 1: " . app("demo.bind")->id . "\n";
    echo "bind      lan 2: " . app("demo.bind")->id . "\n";
    echo "singleton lan 1: " . app("demo.singleton")->id . "\n";
    echo "singleton lan 2: " . app("demo.singleton")->id . "\n";
'
bind      lan 1: a7ebde
bind      lan 2: c57355      ← KHÁC nhau
singleton lan 1: d122cf
singleton lan 2: d122cf      ← GIỐNG nhau
```

### Chọn cái nào

```php
// bind — đối tượng có trạng thái riêng, rẻ để dựng
$this->app->bind(ReportBuilder::class);

// singleton — đắt để dựng, không có trạng thái riêng theo request
$this->app->singleton(GeoIpDatabase::class, fn () => new GeoIpDatabase(storage_path('geoip.mmdb')));

// scoped — phụ thuộc vào request hiện tại
$this->app->scoped(CurrentTenant::class, fn ($app) => Tenant::fromRequest($app['request']));
```

> ⚠️ **Đây là nguồn lỗi số một khi chạy Octane.** Với PHP-FPM, `singleton` bị huỷ sau mỗi request nên
> lỗi không lộ ra. Với Octane, ứng dụng sống qua nhiều request → singleton giữ dữ liệu của **người dùng
> đầu tiên** và trả cho mọi người sau. Chi tiết ở
> [nang-cao/08 mục 4](./nang-cao/08-deploy-octane-docker.md).
>
> Quy tắc: singleton **không được** phụ thuộc `$request`, `auth()->user()`, hay bất kỳ thứ gì thay đổi
> theo request. Cần thì dùng `scoped()`.

---

## 3. Bind interface với implementation

Đây là chỗ container thể hiện giá trị thật.

```php
// app/Contracts/PaymentGateway.php
namespace App\Contracts;

interface PaymentGateway
{
    public function charge(int $amount): string;
}
```

```php
// app/Services/StripeGateway.php
class StripeGateway implements PaymentGateway
{
    public function charge(int $amount): string { return "stripe:$amount"; }
}
```

Chưa bind mà đòi dựng interface thì:

```bash
$ php artisan tinker --execute='app(App\Contracts\PaymentGateway::class);'

Illuminate\Contracts\Container\BindingResolutionException
Target [App\Contracts\PaymentGateway] is not instantiable while building [Laravel\Tinker\Console\TinkerCommand].
```

Đọc thông báo này cho kỹ — nó nói đúng vấn đề: interface **không instantiate được**, Laravel không tự
đoán được bạn muốn class nào.

Bind trong `AppServiceProvider::register()`:

```php
public function register(): void
{
    $this->app->bind(PaymentGateway::class, StripeGateway::class);
}
```

```bash
$ php artisan tinker --execute='
    app()->bind(App\Contracts\PaymentGateway::class, App\Services\StripeGateway::class);
    echo app(App\Contracts\PaymentGateway::class)->charge(100);
'
stripe:100
```

Từ đó mọi controller/job chỉ khai `PaymentGateway`, không biết gì về Stripe:

```php
public function __construct(private readonly PaymentGateway $gateway) {}
```

Đổi sang MoMo = sửa một dòng ở provider. Test = bind một `FakeGateway`. Đây chính là chữ **D** trong
SOLID (Dependency Inversion) áp dụng vào Laravel.

### Bind theo môi trường

```php
public function register(): void
{
    $this->app->bind(PaymentGateway::class, function ($app) {
        return $app->environment('production')
            ? new StripeGateway(config('services.stripe.key'))
            : new FakeGateway();
    });
}
```

---

## 4. Contextual binding — cùng interface, khác implementation

Tình huống thật: `OrderService` thanh toán qua Stripe, `RefundService` hoàn tiền qua MoMo.

```php
$this->app->bind(PaymentGateway::class, StripeGateway::class);   // mặc định

$this->app->when(RefundService::class)
          ->needs(PaymentGateway::class)
          ->give(MomoGateway::class);
```

Chứng minh:

```bash
$ php artisan tinker --execute='
    app()->bind(App\Contracts\PaymentGateway::class, App\Services\StripeGateway::class);
    app()->when(App\Services\RefundService::class)
         ->needs(App\Contracts\PaymentGateway::class)
         ->give(App\Services\MomoGateway::class);

    echo "OrderService  -> " . get_class(app(App\Services\OrderService::class)->gateway) . "\n";
    echo "RefundService -> " . get_class(app(App\Services\RefundService::class)->gateway) . "\n";
'
OrderService  -> App\Services\StripeGateway
RefundService -> App\Services\MomoGateway
```

Dạng khác — bind giá trị vô hướng:

```php
$this->app->when(ReportGenerator::class)
          ->needs('$rowLimit')
          ->give(5000);
```

### Tag — lấy nhiều implementation cùng lúc

```php
$this->app->tag([StripeGateway::class, MomoGateway::class, VnPayGateway::class], 'gateways');

$this->app->bind(GatewayPicker::class, function ($app) {
    return new GatewayPicker($app->tagged('gateways'));
});
```

---

## 5. Facade — nó thật sự là gì

Câu trả lời ngắn cho phỏng vấn: **Facade là lớp vỏ tĩnh đứng trước một đối tượng trong container.**
Nó không phải static thật; nó dùng `__callStatic` để chuyển lời gọi sang đối tượng thật.

### Đọc mã nguồn

`vendor/laravel/framework/src/Illuminate/Support/Facades/Facade.php`:

```php
public static function __callStatic($method, $args)
{
    $instance = static::getFacadeRoot();

    if (! $instance) {
        throw new RuntimeException('A facade root has not been set.');
    }

    return $instance->$method(...$args);
}
```

```php
public static function getFacadeRoot()
{
    return static::resolveFacadeInstance(static::getFacadeAccessor());
}

protected static function resolveFacadeInstance($name)
{
    if (isset(static::$resolvedInstance[$name])) {
        return static::$resolvedInstance[$name];
    }

    if (static::$app) {
        if (static::$cached) {
            return static::$resolvedInstance[$name] = static::$app[$name];
        }

        return static::$app[$name];
    }
}
```

Toàn bộ cơ chế nằm ở `static::$app[$name]` — **lấy từ container ra bằng khoá**.

Mỗi facade con chỉ khai đúng một thứ: khoá đó là gì.

```php
// Illuminate/Support/Facades/Cache.php
protected static function getFacadeAccessor()
{
    return 'cache';
}
```

```php
// DB.php    → return 'db';
// Route.php → return 'router';
```

### Chứng minh `Cache::` và `app('cache')` là cùng một đối tượng

```bash
$ php artisan tinker --execute='
    echo "Cache::getFacadeRoot() -> " . get_class(Illuminate\Support\Facades\Cache::getFacadeRoot()) . "\n";
    echo "app(\"cache\")          -> " . get_class(app("cache")) . "\n";
    var_dump(Illuminate\Support\Facades\Cache::getFacadeRoot() === app("cache"));
'
Cache::getFacadeRoot() -> Illuminate\Cache\CacheManager
app("cache")           -> Illuminate\Cache\CacheManager
bool(true)
```

`===` trả `true` — **cùng một instance trong bộ nhớ**, không phải hai đối tượng giống nhau.

Vài facade khác:

```
DB    -> Illuminate\Database\DatabaseManager
Route -> Illuminate\Routing\Router
```

### Mẹo gỡ lỗi: thông báo lỗi tiết lộ class thật

```bash
$ php artisan tinker --execute='Illuminate\Support\Facades\Cache::khongCoMethodNay();'

Error
Call to undefined method Illuminate\Cache\FileStore::khongCoMethodNay()
```

Bạn gọi trên `Cache` nhưng lỗi nói `FileStore`. Đó là bằng chứng trực tiếp: lời gọi đã được chuyển tiếp
qua `CacheManager` xuống store đang cấu hình. Khi không biết một facade thật sự gọi vào đâu, gõ đại một
method không tồn tại — thông báo lỗi sẽ chỉ đúng class.

### `A facade root has not been set`

```
RuntimeException  A facade root has not been set.
```

Nghĩa là `static::$app` chưa được gán — bạn đang dùng facade **ngoài** vòng đời ứng dụng Laravel
(script PHP thuần, hoặc trong `TestCase` chưa gọi `parent::setUp()`).

### Facade vs Dependency Injection — nên dùng cái nào

| | Facade | Constructor injection |
|---|---|---|
| Ngắn gọn | ✅ | ❌ dài hơn |
| Nhìn code biết class phụ thuộc gì | ❌ ẩn | ✅ rõ ràng |
| Test | Dùng `Cache::fake()` | Mock bình thường |
| PHPStan/IDE hiểu kiểu | Cần plugin | ✅ tự hiểu |

Quy tắc thực dụng:

- **Facade** trong controller, route, Blade, và code "keo dán" — nơi ngắn gọn quan trọng hơn.
- **Injection** trong Action, Service, class nghiệp vụ — nơi bạn muốn nhìn constructor là biết class
  này phụ thuộc gì.

Đừng tranh cãi. Laravel thiết kế facade để test được (`Cache::fake()`, `Mail::fake()`), nên lập luận
"facade khó test" là không đúng với Laravel.

### Real-time facade

Biến **bất kỳ** class nào thành facade bằng cách thêm tiền tố `Facades\` vào namespace:

```php
use Facades\App\Services\StripeGateway;

StripeGateway::charge(100);
```

Ít dùng, nhưng biết để đọc code người khác không bỡ ngỡ.

---

## 6. Service Provider — nơi mọi thứ được lắp ráp

Provider là **điểm khởi động**. Mọi thứ Laravel có (database, queue, cache, session…) đều do một
provider đăng ký vào container.

```bash
$ cat bootstrap/providers.php
<?php

use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
];
```

Bản 13 chỉ liệt kê provider **của bạn**; provider của framework và package được nạp tự động.

### `register()` vs `boot()` — câu hỏi phỏng vấn kinh điển

| | `register()` | `boot()` |
|---|---|---|
| Dùng để | **Chỉ** bind vào container | Mọi thứ còn lại |
| Được phép | `bind`, `singleton`, `scoped`, `mergeConfigFrom` | route, view composer, event listener, validator, Blade directive, policy |
| **Không** được phép | Dùng dịch vụ khác (nó có thể chưa được đăng ký) | — |

Quy tắc vàng: **`register()` chỉ khai báo, không sử dụng.**

### Chứng minh thứ tự chạy

Tạo hai provider ghi log:

```php
class DemoOrderProvider extends ServiceProvider
{
    public function register(): void { file_put_contents('/tmp/order.log', "A register\n", FILE_APPEND); }
    public function boot(): void     { file_put_contents('/tmp/order.log', "A boot\n", FILE_APPEND); }
}
// DemoOrderProviderB tương tự, ghi "B register" / "B boot"
```

```bash
$ php artisan inspire > /dev/null
$ cat /tmp/order.log
A register
B register
A boot
B boot
```

**Toàn bộ `register()` của mọi provider chạy xong, rồi mới tới `boot()` đầu tiên.**

Đó là lý do `register()` không được dùng dịch vụ khác: lúc `A::register()` chạy, `B` còn chưa đăng ký gì.
Nhưng khi `A::boot()` chạy thì mọi thứ đã sẵn sàng — nên `boot()` được inject thoải mái:

```php
public function boot(GeoIpDatabase $geoip): void
{
    // Laravel tự inject vì lúc này container đã đầy đủ
}
```

### Viết provider của bạn

```bash
$ php artisan make:provider PaymentServiceProvider

 INFO Provider [app/Providers/PaymentServiceProvider.php] created successfully.
```

```php
namespace App\Providers;

use App\Contracts\PaymentGateway;
use App\Services\{StripeGateway, MomoGateway, RefundService};
use Illuminate\Support\ServiceProvider;

class PaymentServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PaymentGateway::class, StripeGateway::class);

        $this->app->when(RefundService::class)
                  ->needs(PaymentGateway::class)
                  ->give(MomoGateway::class);
    }

    public function boot(): void
    {
        // Đăng ký ở đây, không phải register()
    }
}
```

`make:provider` tự thêm vào `bootstrap/providers.php`.

### Những việc thuộc về `boot()`

```php
public function boot(): void
{
    // Chế độ nghiêm ngặt cho Eloquent
    Model::shouldBeStrict(! app()->isProduction());

    // Rule validate tự viết
    Validator::extend('vn_phone', fn ($attr, $value) => preg_match('/^0[35789][0-9]{8}$/', $value));

    // Blade directive
    Blade::directive('money', fn ($expr) => "<?php echo number_format($expr, 0, ',', '.') . ' đ'; ?>");

    // View composer
    View::composer('components.layouts.app', fn ($view) =>
        $view->with('navCategories', Category::orderBy('name')->get()));

    // Gate
    Gate::before(fn (User $user) => $user->is_admin ? true : null);

    // Rate limiter
    RateLimiter::for('login', fn (Request $r) => Limit::perMinute(5)->by($r->ip()));

    // Theo dõi query chậm
    DB::whenQueryingForLongerThan(500, fn () => Log::warning('Query chậm', ['url' => request()->fullUrl()]));
}
```

Thử đặt `Blade::directive(...)` vào `register()` — có thể chạy, có thể nổ tuỳ thứ tự nạp provider.
Đó chính là loại bug khó tìm mà quy tắc trên sinh ra để tránh.

### Deferred provider — chỉ nạp khi cần

Provider bình thường chạy `register()` ở **mọi** request. Với dịch vụ nặng và ít dùng:

```php
use Illuminate\Contracts\Support\DeferrableProvider;

class GeoIpServiceProvider extends ServiceProvider implements DeferrableProvider
{
    public function register(): void
    {
        $this->app->singleton(GeoIpDatabase::class, fn () => new GeoIpDatabase(storage_path('geoip.mmdb')));
    }

    public function provides(): array
    {
        return [GeoIpDatabase::class];
    }
}
```

Laravel chỉ nạp provider này khi ai đó thật sự yêu cầu `GeoIpDatabase`. Danh sách được cache trong
`bootstrap/cache/services.php`:

```bash
$ php -r '$m = require "bootstrap/cache/services.php";
          var_dump(isset($m["deferred"]["App\\Services\\GeoIpDatabase"]));'
bool(true)
```

Đo thật bằng hai request HTTP — `register()` ghi một dòng vào file log mỗi lần chạy:

```bash
$ curl -s http://127.0.0.1:8000/            # route KHÔNG dùng GeoIp
trang chu
register chạy: 0 lần                        ← provider không được nạp

$ curl -s http://127.0.0.1:8000/dung-geoip  # route CÓ dùng GeoIp
App\Services\GeoIpDatabase
register chạy: 1 lần                        ← nạp đúng lúc cần
```

> ⚠️ **Chi tiết dễ kết luận sai, tôi đã đo nhầm một lần rồi mới phát hiện:** hiệu quả này **chỉ có ở
> request HTTP**. Chạy `php artisan` bất kỳ lệnh nào thì `register()` của deferred provider **vẫn chạy**:
>
> ```bash
> $ for i in 1 2 3; do php artisan inspire > /dev/null; done
> $ wc -l < /tmp/geoip.log
> 3
> ```
>
> Lý do: Artisan phải nạp mọi provider để biết có những lệnh nào tồn tại (`php artisan list`). Vậy nên
> đừng dùng `php artisan` để kiểm chứng deferred provider — kết quả sẽ khiến bạn tưởng nó không hoạt động.
>
> Cũng lưu ý: ngay sau `php artisan optimize:clear`, request đầu tiên phải **dựng lại manifest** nên
> mọi provider đều được khởi tạo một lần để gọi `provides()`.

Chỉ dùng được khi provider **chỉ** có `register()` — có `boot()` thì không hoãn được.

### Package discovery

```bash
$ php artisan package:discover

 INFO Discovering packages.

 laravel/pail .. DONE
 laravel/sanctum .. DONE
 livewire/livewire .. DONE
```

Laravel đọc `extra.laravel.providers` trong `composer.json` của từng package và cache vào
`bootstrap/cache/packages.php`. Chặn một package tự đăng ký:

```json
"extra": {
    "laravel": {
        "dont-discover": ["laravel/telescope"]
    }
}
```

---

## 7. Ba cơ chế ghép lại — một vòng đời hoàn chỉnh

```
public/index.php
   ↓
bootstrap/app.php dựng Application (chính là Container)
   ↓
Nạp bootstrap/providers.php + provider của framework/package
   ↓
Chạy register() của TẤT CẢ provider     ← chỉ bind vào container
   ↓
Chạy boot() của TẤT CẢ provider         ← đăng ký route, view composer, gate...
   ↓
Router khớp request
   ↓
Container tự dựng Controller + tham số (autowiring)
   ↓
Trong controller, Cache::get() → __callStatic → app('cache') → CacheManager
```

Facade và injection **cùng lấy từ một container**. Chúng không phải hai hệ thống khác nhau.

---

## 8. Bảng lỗi thuộc nhóm này

| Thông báo | Nguyên nhân | Sửa |
|-----------|-------------|-----|
| `Target [App\Contracts\X] is not instantiable` | Interface chưa được bind | `$this->app->bind(X::class, XImpl::class)` trong `register()` |
| `Target class [App\Services\X] does not exist` | Sai namespace/tên file, hoặc autoloader cũ | Kiểm tra PSR-4 rồi `composer dump-autoload` |
| `A facade root has not been set` | Dùng facade ngoài vòng đời Laravel | Chạy trong app; trong test gọi `parent::setUp()` |
| `Call to undefined method Illuminate\Cache\FileStore::x()` | Method không có trên class **thật** sau facade | Đọc tên class trong lỗi để biết đang gọi vào đâu |
| Singleton trả dữ liệu người dùng khác (Octane) | `singleton` phụ thuộc `$request` | Đổi sang `scoped()` |
| Sửa `register()` mà không thấy tác dụng | `bootstrap/cache/services.php` đang cache | `php artisan optimize:clear` |

---

## 9. Trả lời phỏng vấn thế nào

Ba câu hay gặp nhất và cách trả lời gọn:

**"Service Container là gì?"**
> Là nơi Laravel lưu hướng dẫn tạo đối tượng và tự giải quyết cây phụ thuộc. Nhờ nó tôi khai kiểu ở
> tham số là Laravel tự dựng, và bind được interface với implementation nên đổi nhà cung cấp chỉ sửa
> một dòng.

**"`bind` khác `singleton` chỗ nào?"**
> `bind` dựng mới mỗi lần gọi, `singleton` trả cùng một đối tượng suốt vòng đời ứng dụng. Còn `scoped`
> giống singleton nhưng bị huỷ sau mỗi request — cần cái này khi chạy Octane, vì singleton phụ thuộc
> request sẽ rò rỉ dữ liệu giữa các người dùng.

**"Facade hoạt động ra sao?"**
> Nó không phải static thật. Facade dùng `__callStatic` để lấy đối tượng từ container theo khoá do
> `getFacadeAccessor()` trả về, rồi gọi method trên đối tượng đó. Ví dụ `Cache` trả khoá `'cache'`, nên
> `Cache::get()` thực chất là `app('cache')->get()` — tôi kiểm chứng được bằng
> `Cache::getFacadeRoot() === app('cache')` trả `true`.

**"`register()` khác `boot()` chỗ nào?"**
> `register()` chỉ được bind vào container, `boot()` làm mọi việc còn lại. Lý do là Laravel chạy hết
> `register()` của **mọi** provider rồi mới chạy `boot()` đầu tiên — nên trong `register()` bạn không
> chắc dịch vụ của provider khác đã tồn tại chưa.

---

## Bài tập

1. Bind `"demo"` bằng `bind()` rồi bằng `singleton()`. Gọi hai lần mỗi loại và in ra một giá trị ngẫu
   nhiên gắn với đối tượng. Ghi lại kết quả.

2. Tạo interface `PaymentGateway` + hai implementation. Gọi `app(PaymentGateway::class)` khi **chưa**
   bind và ghi lại nguyên văn exception. Rồi bind và thử lại.

3. Dùng contextual binding cho `RefundService` nhận `MomoGateway` trong khi mặc định là `Stripe`.
   In `get_class()` của cả hai để xác nhận.

4. Chạy `Cache::getFacadeRoot() === app('cache')` trong tinker. Kết quả là gì? Giải thích.

5. Gọi một method không tồn tại trên `Cache`. Thông báo lỗi nhắc tới class nào? Đổi `CACHE_STORE` sang
   `array` rồi thử lại — tên class có đổi không?

6. Tạo hai provider ghi log ở cả `register()` và `boot()`. Chạy một lệnh artisan và dán thứ tự trong
   file log. Giải thích vì sao `register()` không được dùng dịch vụ khác.

7. Đặt `Blade::directive('money', ...)` vào `register()` thay vì `boot()`. Nó chạy hay hỏng? Chuyển
   sang `boot()` và so sánh.

8. Viết `GeoIpServiceProvider` implement `DeferrableProvider`, ghi log trong `register()`. Kiểm chứng
   bằng **hai request HTTP**: một route không dùng `GeoIpDatabase` và một route có dùng. Đếm số dòng log
   mỗi lần. Sau đó thử lại bằng `php artisan inspire` — kết quả có khác không? Giải thích.

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```
Illuminate\Contracts\Container\BindingResolutionException
Target [App\Contracts\PaymentGateway] is not instantiable while building [...].
```
Interface không thể `new`, và container không đoán được bạn muốn implementation nào.

**4.** `true`. Facade lấy đúng đối tượng đang nằm trong container theo khoá `'cache'`, không tạo bản sao.

**5.** `Call to undefined method Illuminate\Cache\FileStore::khongCoMethodNay()`. Đổi sang
`CACHE_STORE=array` thì tên class trong lỗi thành `Illuminate\Cache\ArrayStore` — chứng minh facade chỉ
là lớp chuyển tiếp tới store đang cấu hình.

**6.**
```
A register
B register
A boot
B boot
```
Lúc `A::register()` chạy, `B` chưa đăng ký gì vào container. Nếu `A::register()` gọi dịch vụ do `B`
cung cấp thì nổ `BindingResolutionException` — và lỗi này chỉ xuất hiện khi thứ tự provider thay đổi,
nên rất khó tái hiện.

**8.** Qua HTTP: route không dùng → **0** lần; route có dùng → **1** lần. Đúng như thiết kế.

Qua `php artisan`: **luôn chạy**, kể cả lệnh không liên quan. Artisan cần nạp toàn bộ provider để biết
danh sách lệnh, nên deferred không có tác dụng trong console. Đây là bẫy khi kiểm chứng — dùng HTTP để
đo, đừng dùng artisan.

</details>

---

Tiếp theo: [12-collection-va-model-nang-cao.md](./12-collection-va-model-nang-cao.md)
