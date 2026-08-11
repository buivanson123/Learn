# 80 câu hỏi phỏng vấn Laravel + đáp án

Cách dùng: đọc câu hỏi → **che đáp án, tự trả lời thành tiếng** → mới mở đáp án ra so.

Mỗi câu có:
- **Trả lời ngắn** — đủ cho 30 giây, dùng khi phỏng vấn.
- **Đào sâu** — dùng khi họ hỏi tiếp "vì sao", hoặc để bạn thật sự hiểu.

Ký hiệu ⭐ = câu gần như chắc chắn bị hỏi ở mức middle.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--service-container-facade-service-provider) | Container, Facade, Provider | 12 |
| [B](#b--request-lifecycle-routing-middleware) | Lifecycle, Routing, Middleware | 10 |
| [C](#c--eloquent-và-database) | Eloquent, Database | 18 |
| [D](#d--validation-và-auth) | Validation, Auth, Phân quyền | 10 |
| [E](#e--queue-cache-event) | Queue, Cache, Event | 12 |
| [F](#f--collection-blade-artisan) | Collection, Blade, Artisan | 8 |
| [G](#g--bảo-mật) | Bảo mật | 6 |
| [H](#h--testing-và-kiến-trúc) | Testing, Kiến trúc | 4 |

---

## A — Service Container, Facade, Service Provider

Nhóm này là **bộ lọc**. Trả lời được là qua được vòng "biết dùng hay hiểu framework".
Bài gốc: [11-container-facade-provider.md](../11-container-facade-provider.md).

### A1 ⭐ Service Container là gì?

**Ngắn:** Là nơi Laravel lưu hướng dẫn tạo đối tượng và tự giải quyết cây phụ thuộc. Nhờ nó em khai
kiểu ở tham số là Laravel tự dựng và truyền vào, không phải `new` thủ công.

**Đào sâu:** Nó giải quyết hai việc. Một là **autowiring** — Laravel đọc kiểu tham số bằng Reflection
rồi dựng đệ quy cả cây phụ thuộc. Hai là **bind interface với implementation**, nhờ đó đổi nhà cung
cấp thanh toán chỉ sửa một dòng ở provider thay vì đi sửa mọi chỗ `new`.

### A2 ⭐ `bind()` khác `singleton()` chỗ nào? Còn `scoped()`?

**Ngắn:** `bind` dựng mới mỗi lần gọi; `singleton` trả cùng một đối tượng suốt vòng đời ứng dụng;
`scoped` giống singleton nhưng bị huỷ sau mỗi request.

**Đào sâu:** `scoped` sinh ra vì Octane. Với PHP-FPM, mọi thứ chết sau mỗi request nên singleton không
gây vấn đề. Với Octane, ứng dụng sống qua nhiều request — một singleton phụ thuộc `$request->user()`
sẽ giữ user của **người đầu tiên** và trả cho mọi người sau. Đó là rò rỉ dữ liệu giữa người dùng.
Quy tắc của em: singleton không bao giờ được phụ thuộc request; cần thì dùng `scoped`.

Chứng minh nhanh: bind một class có id ngẫu nhiên, gọi hai lần — `bind` ra hai id khác nhau, `singleton`
ra cùng một id.

### A3 ⭐ Facade hoạt động thế nào? Nó có phải static không?

**Ngắn:** Không phải static thật. Facade dùng `__callStatic` để lấy đối tượng từ container theo khoá
do `getFacadeAccessor()` trả về, rồi gọi method trên đối tượng đó.

**Đào sâu:** Mã nguồn rất ngắn:

```php
public static function __callStatic($method, $args)
{
    $instance = static::getFacadeRoot();
    if (! $instance) { throw new RuntimeException('A facade root has not been set.'); }
    return $instance->$method(...$args);
}
```

`getFacadeRoot()` gọi `resolveFacadeInstance(static::getFacadeAccessor())`, và bên trong chỉ là
`static::$app[$name]` — lấy từ container. Facade `Cache` trả khoá `'cache'`, nên `Cache::get()` thực
chất là `app('cache')->get()`.

Em kiểm chứng được: `Cache::getFacadeRoot() === app('cache')` trả `true` — cùng một instance trong bộ
nhớ, không phải bản sao.

### A4 Làm sao biết một facade thật sự gọi vào class nào?

**Ngắn:** Gọi một method không tồn tại — thông báo lỗi sẽ chỉ đúng class thật.

**Đào sâu:**

```bash
$ php artisan tinker --execute='Cache::khongCoMethodNay();'
Error  Call to undefined method Illuminate\Cache\FileStore::khongCoMethodNay()
```

Gọi trên `Cache` nhưng lỗi nói `FileStore`. Đổi `CACHE_STORE=array` thì lỗi thành `ArrayStore`. Đó là
bằng chứng trực tiếp rằng facade chỉ là lớp chuyển tiếp qua `CacheManager` xuống store đang cấu hình.

### A5 Facade và Dependency Injection — dùng cái nào?

**Ngắn:** Facade cho code "keo dán" (controller, route, Blade); injection cho class nghiệp vụ (Action,
Service) để nhìn constructor là biết phụ thuộc gì.

**Đào sâu:** Lập luận "facade khó test" không đúng với Laravel vì có `Cache::fake()`, `Mail::fake()`,
`Queue::fake()`. Nhược điểm thật của facade là **ẩn phụ thuộc** — đọc class không biết nó cần gì, và
PHPStan phải có plugin mới hiểu kiểu trả về.

### A6 ⭐ `register()` khác `boot()` chỗ nào? Vì sao phải tách?

**Ngắn:** `register()` chỉ được bind vào container; `boot()` làm mọi việc còn lại. Lý do là Laravel
chạy hết `register()` của **mọi** provider rồi mới chạy `boot()` đầu tiên.

**Đào sâu:** Em kiểm chứng bằng hai provider ghi log:

```
A register
B register
A boot
B boot
```

Nên lúc `A::register()` chạy, `B` chưa đăng ký gì. Nếu `A::register()` gọi dịch vụ do `B` cung cấp thì
nổ `BindingResolutionException`, và lỗi này chỉ xuất hiện khi thứ tự provider thay đổi — rất khó tái
hiện. Ngược lại `boot()` được inject thoải mái vì container đã đầy đủ.

Những việc thuộc `boot()`: đăng ký route, Blade directive, view composer, Gate, rate limiter,
`Model::shouldBeStrict()`.

### A7 Contextual binding là gì, khi nào cần?

**Ngắn:** Là cho cùng một interface trả về implementation khác nhau tuỳ class nào đang yêu cầu.

**Đào sâu:**

```php
$this->app->bind(PaymentGateway::class, StripeGateway::class);      // mặc định

$this->app->when(RefundService::class)
          ->needs(PaymentGateway::class)
          ->give(MomoGateway::class);
```

Kết quả thật: `OrderService` nhận `StripeGateway`, `RefundService` nhận `MomoGateway`. Dùng khi thanh
toán và hoàn tiền đi qua hai cổng khác nhau, hoặc khi một service cần cấu hình khác.

### A8 Deferred provider là gì?

**Ngắn:** Provider chỉ được nạp khi ai đó thật sự cần dịch vụ nó cung cấp, thay vì nạp ở mọi request.

**Đào sâu:** Implement `DeferrableProvider` và khai `provides()`. Laravel cache danh sách trong
`bootstrap/cache/services.php`.

Đo thật qua HTTP: route không dùng `GeoIpDatabase` → `register()` chạy **0 lần**; route có dùng → **1 lần**.

⚠️ Nhưng qua `php artisan` thì nó **luôn chạy**, vì Artisan phải nạp mọi provider để biết danh sách
lệnh. Nên đừng dùng artisan để kiểm chứng deferred provider.

Chỉ dùng được khi provider **chỉ** có `register()`.

### A9 `Target [App\Contracts\X] is not instantiable` nghĩa là gì?

**Ngắn:** Bạn yêu cầu một interface (hoặc abstract class) mà chưa bind implementation cho nó.

**Đào sâu:** Container không đoán được bạn muốn class nào. Sửa bằng `$this->app->bind(X::class,
XImpl::class)` trong `register()`. Khác với `Target class [X] does not exist` — cái đó là sai
namespace/tên file hoặc autoloader chưa cập nhật, sửa bằng `composer dump-autoload`.

### A10 `A facade root has not been set` là lỗi gì?

**Ngắn:** Dùng facade ngoài vòng đời ứng dụng Laravel — `static::$app` chưa được gán.

**Đào sâu:** Hay gặp khi chạy script PHP thuần có require autoload nhưng không bootstrap app, hoặc
trong `TestCase` mà quên gọi `parent::setUp()`.

### A11 Tag trong container dùng để làm gì?

**Ngắn:** Gom nhiều binding vào một nhãn để lấy ra cả nhóm.

**Đào sâu:**

```php
$this->app->tag([StripeGateway::class, MomoGateway::class], 'gateways');
$this->app->bind(GatewayPicker::class, fn ($app) => new GatewayPicker($app->tagged('gateways')));
```

Dùng khi có nhiều implementation cùng loại và cần duyệt qua tất cả — ví dụ danh sách phương thức thanh
toán để hiển thị cho người dùng chọn.

### A12 Vì sao không được gọi `env()` ngoài thư mục `config/`?

**Ngắn:** Vì sau `php artisan config:cache`, Laravel không đọc file `.env` nữa và `env()` trả `null`.

**Đào sâu:** `config:cache` biên dịch toàn bộ `config/` thành một file PHP ở `bootstrap/cache/config.php`.
Từ đó mọi `env()` nằm ngoài `config/` trả `null` — ứng dụng hỏng theo kiểu rất khó tìm vì trên máy dev
(không cache) nó chạy bình thường. Cách đúng: khai vào `config/services.php` rồi đọc bằng `config()`.

---

## B — Request lifecycle, Routing, Middleware

### B1 ⭐ Một request đi qua những đâu?

**Ngắn:** `public/index.php` → `bootstrap/app.php` dựng Application → nạp provider (register rồi boot)
→ middleware toàn cục → router khớp route → middleware nhóm/route → route model binding → FormRequest
validate → controller → response đi ngược lại qua đúng dãy middleware đó.

**Đào sâu:** Điểm quan trọng là **mọi** request vào qua một file duy nhất — đó là lý do document root
phải trỏ vào `public/`. Và middleware là **hai chiều**: cùng một middleware chạy một lần trước
controller và một lần sau, đó là cách `StartSession` mở session lúc vào và ghi lúc ra.

### B2 ⭐ `routes/web.php` khác `routes/api.php` chỗ nào?

**Ngắn:** `web` có nhóm middleware `web` (session, cookie, CSRF); `api` có tiền tố `/api`, có throttle,
không có session.

**Đào sâu:** Laravel 13 **không sinh sẵn** `routes/api.php` — phải chạy `php artisan install:api`, nó
cũng cài Sanctum và thêm dòng `api:` vào `bootstrap/app.php`.

Hệ quả thực tế của việc không có session ở API: không có CSRF, nên mỗi request phải tự mang token. Đặt
nhầm route API vào `web.php` thì client ngoài gửi POST sẽ bị chặn với **419 Page Expired**.

### B3 Route model binding là gì? Binding theo cột khác thế nào?

**Ngắn:** Laravel tự chuyển `{post}` trên URL thành đối tượng `Post` bằng `findOrFail`, tự trả 404 nếu
không thấy. Tên tham số route phải trùng tên biến.

**Đào sâu:** Binding theo cột khác có hai cách: `{post:slug}` ở route, hoặc `getRouteKeyName()` ở model.
Em ưu tiên khai ở model vì nó áp dụng cho mọi route và tránh được một cái bẫy.

### B4 ⭐ Có bẫy nào khi khai hai route cùng URI không?

**Ngắn:** Có — route khai sau **ghi đè** route khai trước, không có cảnh báo nào.

**Đào sâu:** Router lưu route theo khoá `method + URI`. `/posts/{post}` và `/posts/{post:slug}` sinh
cùng một khoá vì phần `:slug` chỉ là chỉ dẫn binding. `php artisan route:list` chỉ hiện một dòng, và
`/posts/1` trả 404 vì đi tìm bài có `slug = "1"`.

Bẫy tương tự: `/posts/create` phải khai **trước** `/posts/{post}`, nếu không bấm "Viết bài" sẽ ra
`404 No query results for model [App\Models\Post] create`.

### B5 `scopeBindings()` để làm gì?

**Ngắn:** Ép model con phải thuộc về model cha trong route lồng nhau.

**Đào sâu:** Không có nó, `/posts/1/comments/9999` vẫn trả **200** kể cả khi comment 9999 thuộc bài
khác — đó là lỗ hổng IDOR. Có nó, Laravel truy vấn `$post->comments()->where('id', ...)` thay vì
`Comment::find(...)`, và trả 404.

### B6 Middleware là gì? Đăng ký ở đâu trong Laravel 13?

**Ngắn:** Là lớp lọc chạy trước/sau controller. Laravel 13 khai trong `bootstrap/app.php` ở
`->withMiddleware()`, không còn `app/Http/Kernel.php`.

**Đào sâu:**

```php
$middleware->alias(['admin' => EnsureUserIsAdmin::class]);
$middleware->append(X::class);              // chạy cuối, mọi request
$middleware->prepend(Y::class);             // chạy đầu
$middleware->web(append: [Z::class]);       // chỉ nhóm web
$middleware->remove(ValidateCsrfToken::class);
```

### B7 ⭐ Vì sao `$this->middleware('auth')` trong constructor không chạy nữa?

**Ngắn:** Vì `app/Http/Controllers/Controller.php` của Laravel 13 là lớp trần, không kế thừa
`Illuminate\Routing\Controller` nữa.

**Đào sâu:** Lỗi là `Call to undefined method App\Http\Controllers\PostController::middleware()`.
Cách đúng là implement `HasMiddleware`:

```php
class PostController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return ['auth', new Middleware('verified', only: ['store', 'update'])];
    }
}
```

Cùng nguyên nhân với lỗi `Call to undefined method ...::authorize()` — phải tự thêm trait
`AuthorizesRequests` vào lớp cha.

### B8 401, 403, 419, 405 khác nhau thế nào?

**Ngắn:** 401 chưa đăng nhập; 403 đã đăng nhập nhưng không đủ quyền; 419 thiếu/sai CSRF token; 405 route
tồn tại nhưng sai HTTP method.

**Đào sâu:** 419 hay bị hiểu nhầm là hết phiên đăng nhập — thực ra là CSRF, thường do quên `@csrf` hoặc
gửi AJAX không kèm token. 405 thường do form HTML thiếu `@method('PUT')`, vì HTML chỉ gửi được GET và POST.

### B9 `Route::resource` tạo ra bao nhiêu route?

**Ngắn:** 7 — index, create, store, show, edit, update, destroy.

**Đào sâu:** `apiResource` bỏ `create` và `edit` vì hai route đó chỉ để trả form HTML, còn 5. Lọc thêm
bằng `->only([...])` hoặc `->except([...])`.

### B10 Vì sao nên đặt tên route?

**Ngắn:** Để sinh URL bằng `route('posts.show', $post)`, đổi đường dẫn chỉ sửa một chỗ.

**Đào sâu:** Và gõ sai tên thì nổ ngay lúc render (`RouteNotFoundException: Route [x] not defined`),
còn viết `href="/posts/{{ $post->id }}"` thì link hỏng âm thầm.

---

## C — Eloquent và Database

### C1 ⭐⭐ N+1 query là gì? Cách phát hiện và sửa?

**Ngắn:** Là khi lấy N bản ghi rồi truy cập quan hệ trong vòng lặp, sinh thêm N query. Sửa bằng eager
loading `with()`.

**Đào sâu:** Em đo thật với 4 bài viết: không `with()` là 5 query (1 lấy posts + 4 lấy users), có
`with('author')` là **2 query** — và con số 2 không đổi dù có 4000 bài.

Phát hiện bằng ba cách:
1. `DB::listen` ghi log query rồi đếm.
2. `Model::preventLazyLoading()` biến N+1 thành `LazyLoadingViolationException`.
3. Viết test đếm số query — `assertQueryCount(3, fn () => $this->get('/'))`.

Các dạng khó thấy: N+1 trong Blade component, trong API Resource (`$this->author->name`), và trong
Livewire — chỗ này nguy hiểm nhất vì component render lại mỗi lần gõ phím.

### C2 ⭐ `Model::preventLazyLoading()` có bẫy gì không?

**Ngắn:** Có — nó **không** báo lỗi khi collection chỉ có một model.

**Đào sâu:** Trong `Illuminate\Database\Eloquent\Builder::hydrate()`:

```php
if (count($items) > 1) {
    $model->preventsLazyLoading = Model::preventsLazyLoading();
}
```

Laravel cố ý bỏ qua vì một model thì về định nghĩa không thể là N+1. Hệ quả thực tế: **test N+1 phải
seed từ 2 bản ghi trở lên**, nếu không test xanh giả.

### C3 `with()`, `load()`, `withCount()` khác nhau?

**Ngắn:** `with()` nạp trước lúc query; `load()` nạp sau khi đã có collection; `withCount()` chỉ đếm
bằng subquery, không nạp bản ghi.

**Đào sâu:** `withCount('comments')` sinh `(select count(*) ...) as comments_count` — dùng khi chỉ cần
con số. Viết `$post->comments->count()` trong vòng lặp là nạp toàn bộ comment chỉ để đếm.

Còn `with('author:id,name')` chỉ lấy 2 cột, nhưng **bắt buộc phải có `id`** — thiếu nó thì quan hệ trả
`null` mà không báo lỗi.

### C4 ⭐ Laravel 13 khai `fillable` thế nào?

**Ngắn:** Bằng PHP attribute `#[Fillable([...])]` đặt trên class, thay cho `protected $fillable`.

**Đào sâu:** Tương tự có `#[Hidden]`, `#[Scope]`, `#[ScopedBy]`, `#[UsePolicy]`, `#[UseFactory]`,
`#[RouteKey]`, `#[Table]`, `#[ObservedBy]`, `#[Appends]` — khoảng 24 attribute. Đây là lý do code
Laravel chép từ mạng về trông "lệch" so với project bản 13. Cách cũ vẫn chạy, nhưng đừng trộn hai kiểu.

Kiểm tra bằng `php artisan model:show Post` — nó in ra cột nào fillable, cast gì, quan hệ nào, policy nào.

### C5 ⭐ Vì sao cần `fillable`? Không khai thì sao?

**Ngắn:** Nó là danh sách trắng cho gán hàng loạt. Không có nó, người dùng gửi thêm `is_admin=1` vào
form đăng ký là chiếm quyền quản trị.

**Đào sâu:** Điểm nguy hiểm là cột không khai bị **bỏ qua trong im lặng**. Em thử `Post::create([...
'user_id' => 999])` khi `user_id` không có trong `#[Fillable]`:

```
SQLSTATE[23502]: Not null violation: null value in column "user_id"
(SQL: insert into "posts" ("title", "slug", "body", ...) values (...))
```

Nhìn câu SQL — `user_id` biến mất khỏi danh sách cột. Nếu cột đó cho phép `null` thì **không có lỗi
nào**, chỉ có dữ liệu bị thiếu.

Em bật `Model::preventSilentlyDiscardingAttributes()` để nó thành `MassAssignmentException` luôn.

### C6 `Model::shouldBeStrict()` làm gì?

**Ngắn:** Bật cùng lúc ba công tắc: chặn lazy loading, chặn bỏ cột im lặng, chặn đọc thuộc tính không tồn tại.

**Đào sâu:** Em đặt `Model::shouldBeStrict(! app()->isProduction())` trong `AppServiceProvider::boot()`
ngay từ ngày đầu dự án. Bật sau khi đã có 50 file thì ngập trong lỗi và người ta sẽ tắt đi.

### C7 ⭐ Cast là gì? Không cast thì sao?

**Ngắn:** Cast biến giá trị cột thành kiểu PHP tử tế — `datetime` thành Carbon, `array` thành mảng,
`hashed` tự băm mật khẩu.

**Đào sâu:** Không cast `published_at` thì `$post->published_at->format('d/m/Y')` nổ
`Call to a member function format() on string`.

Cast `hashed` đáng chú ý: model `User` của Laravel 13 có sẵn nó, nên `User::create(['password' => 'x'])`
tự băm. Gọi thêm `Hash::make()` là băm hai lần và **không đăng nhập được** — mà không có lỗi nào, chỉ
báo "sai mật khẩu".

### C8 Accessor khác Mutator, khác Cast thế nào?

**Ngắn:** Cast dùng kiểu có sẵn; Accessor chạy lúc **đọc**; Mutator chạy lúc **ghi**.

**Đào sâu:**

```php
protected function title(): Attribute
{
    return Attribute::make(
        get: fn (string $value) => ucfirst($value),
        set: fn (string $value) => trim($value),
    );
}
```

Hai điều hay bị bất ngờ: accessor **không tự vào JSON** (phải thêm `#[Appends(['excerpt'])]`), và
accessor **không dùng được trong `WHERE`** vì nó sống trong PHP, không có cột tương ứng.

### C9 ⭐ Quan hệ được đoán khoá ngoại từ đâu?

**Ngắn:** Từ **tên method**, không phải tên class.

**Đào sâu:** `belongsTo(User::class)` trong method tên `author()` đi tìm cột `author_id`, không phải
`user_id`. Lỗi là `column posts.author_id does not exist`. Phải ghi rõ tham số thứ hai:
`belongsTo(User::class, 'user_id')`.

Bảng trung gian của `belongsToMany` cũng có quy ước: hai model số ít, xếp theo bảng chữ cái —
`post_tag`, không phải `posts_tags` hay `tag_post`.

### C10 ⭐ Index là gì? Đo được hiệu quả không?

**Ngắn:** Là cấu trúc giúp database tìm bản ghi mà không quét toàn bảng.

**Đào sâu:** Em đo trên bảng 500.000 dòng bằng `EXPLAIN ANALYZE`:

```
Không index: Seq Scan ... actual time=21.757..21.757, Rows Removed by Filter: 500000
Có index:    Bitmap Index Scan ... actual time=0.056..0.056, Buffers: shared read=3
```

**21.757 ms → 0.061 ms**, nhanh gấp ~350 lần. Từ khoá cần tìm khi soi query chậm là `Seq Scan` và
`Rows Removed by Filter` lớn.

### C11 Thứ tự cột trong index tổ hợp có quan trọng không?

**Ngắn:** Rất quan trọng. Index `['status', 'published_at']` dùng được cho `WHERE status = ?` nhưng
**không** dùng được cho `WHERE published_at > ?` đứng một mình.

**Đào sâu:** Nguyên tắc: cột lọc **bằng** đứng trước, cột lọc **khoảng** hoặc dùng để sắp xếp đứng sau.

Index cũng bị vô hiệu khi có hàm bọc quanh cột (`WHERE LOWER(email) = ?`), khi ký tự đại diện ở đầu
(`LIKE '%abc'`), hoặc khi ép kiểu cột.

### C12 ⭐ `foreignId()->constrained()` có tạo index không?

**Ngắn:** Không, trên PostgreSQL nó chỉ tạo **ràng buộc khoá ngoại**, không tạo index.

**Đào sâu:** Em kiểm tra bằng `php artisan db:table posts` — phần `Index` chỉ có primary key và unique
slug, không có `user_id`. `EXPLAIN ANALYZE` cho `WHERE user_id = 1` cho ra `Seq Scan`. Phải thêm tay
`->constrained()->index()`.

### C13 ⭐ Duyệt bảng triệu dòng thế nào?

**Ngắn:** Dùng `chunkById()` hoặc `cursor()`, không dùng `->get()`.

**Đào sâu:** Em đo trên 500.000 dòng với `memory_limit=128M`:

| Cách | Bộ nhớ | Thời gian |
|------|--------|-----------|
| `->get()` | **Fatal error: memory exhausted** | — |
| `->chunk(1000)` | 25.0 MB | **7589 ms** |
| `->chunkById(1000)` | 25.0 MB | **660 ms** |
| `->cursor()` | 24.8 MB | 530 ms |

`chunk` chậm gấp 11 lần vì nó phân trang bằng `LIMIT ... OFFSET` — tới lô cuối, PostgreSQL phải đọc và
bỏ đi 499.000 dòng. `chunkById` dùng `WHERE id > ?` nên nhảy thẳng bằng index khoá chính.

### C14 `chunk` còn bẫy nào nữa không?

**Ngắn:** Có — nếu vòng lặp sửa chính điều kiện lọc thì một nửa bản ghi bị bỏ sót.

**Đào sâu:**

```php
Post::where('status', 'draft')->chunk(100, function ($posts) {
    foreach ($posts as $post) { $post->update(['status' => 'published']); }
});
```

Sau lô 1, những bản ghi đó không còn khớp `status = 'draft'`, nên `OFFSET 100` trỏ vào chỗ khác.
Không có lỗi nào. `chunkById` không bị vì nó theo `id`, không theo vị trí.

### C15 `paginate`, `simplePaginate`, `cursorPaginate` khác nhau?

**Ngắn:** `paginate` chạy 2 query (có `COUNT(*)`, biết tổng số trang); `simplePaginate` 1 query, chỉ có
trước/sau; `cursorPaginate` 1 query, dùng `WHERE id > ?` nên nhanh nhất và ổn định khi dữ liệu đổi.

**Đào sâu:** Trên bảng triệu dòng, `COUNT(*)` là phần chậm nhất. Trang admin cần nhảy tới trang 37 thì
buộc dùng `paginate`; cuộn vô hạn hoặc API thì `cursorPaginate` đúng hơn.

Nhớ `->withQueryString()` để giữ tham số lọc khi sang trang.

### C16 `Post::where(...)->update(...)` có kích hoạt event không?

**Ngắn:** Không. Nó chạy một câu SQL `UPDATE`, không nạp model nào nên không có vòng đời model.

**Đào sâu:** Hệ quả: observer không chạy, cache không được xoá, `updated_at` không đổi nếu không tự
thêm. Em đo thật — observer ghi log ở 7 hook, chạy `Post::where(...)->update(...)` thì **0 hook** chạy.

Cần event thì phải lặp qua từng model (`->each(fn ($p) => $p->update(...))`), chậm hơn nhiều.

### C17 Migration có bẫy gì về thứ tự không?

**Ngắn:** Có — migration chạy theo mốc thời gian trong tên file, nên bảng có khoá ngoại phải chạy sau
bảng đích.

**Đào sâu:** Lỗi thật:

```
SQLSTATE[42P01]: relation "categories" does not exist
(SQL: alter table "posts" add constraint "posts_category_id_foreign" ...)
```

Chưa deploy thì đổi tên file. Đã deploy thì **phải** tách khoá ngoại ra migration mới — đổi tên
migration đã chạy khiến Laravel tưởng là migration mới và chạy lại.

### C18 Deploy có migration phá tương thích ngược thì làm sao?

**Ngắn:** Dùng expand/contract — tách thành nhiều lần deploy.

**Đào sâu:** Giữa lúc chạy migration và lúc đổi code, **code cũ đang chạy trên schema mới**. Xoá cột
trong cửa sổ đó là 500 hàng loạt.

```
Deploy 1 (expand):   thêm cột mới, ghi vào cả hai, đọc từ cột cũ
Deploy 2:            đọc từ cột mới
Deploy 3 (contract): xoá cột cũ
```

Áp dụng cho: đổi tên cột, xoá cột, đổi kiểu, thêm `NOT NULL` không default.

---

## D — Validation và Auth

### D1 ⭐ Ba cách validate? Nên dùng cách nào?

**Ngắn:** `$request->validate()` trong controller, FormRequest, và `Validator::make()` thủ công.
FormRequest cho hầu hết trường hợp.

**Đào sâu:** FormRequest tách quy tắc ra khỏi controller và chạy **trước khi** vào thân hàm. Điểm quan
trọng: `validated()` chỉ trả về những trường **đã khai rule**, nên gán thẳng vào `create()` là an toàn —
trường lạ người dùng gửi kèm không lọt vào.

### D2 ⭐ Validate hỏng thì trả về gì?

**Ngắn:** Request JSON → **422** kèm `{"message": "...", "errors": {"field": ["..."]}}`. Request HTML →
**302** quay lại, kèm `$errors` và old input trong session.

**Đào sâu:** Laravel quyết định dựa vào header `Accept`. Laravel 13 có sẵn `shouldRenderJsonWhen` trong
`bootstrap/app.php` cho mọi URL bắt đầu bằng `api/`.

`$errors` **luôn tồn tại** trong mọi view của nhóm `web`, không cần truyền từ controller — đó là công
của middleware `ShareErrorsFromSession`.

### D3 ⭐ `make:request` có bẫy gì?

**Ngắn:** `authorize()` sinh ra trả **`false`**, nên mọi request đều 403 và không thấy lỗi validate nào.

**Đào sâu:** `authorize()` chạy **trước** `rules()`, nên khi nó `false` bạn không nhận được thông tin gì
về dữ liệu. Triệu chứng rất dễ nhầm: rule viết đúng hết mà cứ 403.

`make:policy` cũng sinh mọi method `return false;` — cùng một cái bẫy.

### D4 Bẫy `unique` khi sửa bản ghi?

**Ngắn:** Bản ghi "trùng" chính là bản ghi đang sửa. Phải dùng `Rule::unique('posts')->ignore($this->route('post'))`.

**Đào sâu:** Không có `ignore()` thì bấm lưu mà không đổi slug cũng báo "The slug has already been taken".

### D5 CSRF là gì? 419 xảy ra khi nào?

**Ngắn:** Là token chống trang khác gửi form thay mặt người dùng đang đăng nhập. Thiếu nó → 419.

**Đào sâu:** Ba nguyên nhân theo thứ tự hay gặp: quên `@csrf`; gửi AJAX không kèm token (sửa bằng meta
`csrf-token` + header `X-CSRF-TOKEN`); form mở quá `SESSION_LIFETIME`.

Webhook cần loại trừ thì loại **đúng đường dẫn đó** bằng `validateCsrfTokens(except: [...])`, và **phải**
xác minh chữ ký của bên gửi bằng `hash_equals()` — dùng `===` là mở đường cho timing attack.

### D6 ⭐ Auth bằng session khác bằng token thế nào?

**Ngắn:** Session lưu trạng thái ở server, gắn với cookie — hợp cho web truyền thống. Token (Sanctum)
không trạng thái, client tự mang theo — hợp cho API và mobile.

**Đào sâu:** Sanctum có hai chế độ: token cho mobile/API, và SPA authentication dùng cookie cho SPA cùng
domain. Passport là OAuth2 đầy đủ, chỉ cần khi bên thứ ba tích hợp vào hệ thống của bạn.

Token nên có phạm vi và hạn:

```php
$user->createToken('mobile', ['posts:read'], now()->addDays(30));
```

Đừng tạo token `['*']` cho mọi thứ.

### D7 ⭐ Gate khác Policy chỗ nào?

**Ngắn:** Gate cho quyền không gắn với model cụ thể (`access-admin`); Policy cho quyền trên một model
(`update` bài viết này).

**Đào sâu:** Laravel 13 tự tìm policy theo quy ước `App\Models\Post` → `App\Policies\PostPolicy`. Kiểm
tra bằng `php artisan model:show Post` — có dòng `Policy` là nó đã nhận ra. Khác quy ước thì khai
`#[UsePolicy(X::class)]`.

### D8 ⭐ `Gate::before` có bẫy gì?

**Ngắn:** Phải trả `null` khi không áp dụng, **không** trả `false`.

**Đào sâu:**

```php
Gate::before(fn (User $u, string $a) => $u->is_admin ? true : null);   // ✅
Gate::before(fn (User $u, string $a) => $u->is_admin);                 // ❌
```

Trả `false` là **quyết định cuối cùng** — nó chặn hết mọi người ở mọi quyền, kể cả quyền policy đã cho
phép. Trả `null` mới để chuỗi kiểm tra đi tiếp.

### D9 `@can` trong Blade có bảo vệ dữ liệu không?

**Ngắn:** Không. Nó chỉ ẩn nút, URL vẫn gọi được bằng `curl`. Phải kiểm tra ở server.

**Đào sâu:** Và `@can` cũng không lọc dữ liệu — lấy `Post::all()` rồi lọc bằng `@can` trong vòng lặp thì
dữ liệu vẫn đi qua mạng và vẫn lộ trong số đếm phân trang. Phải lọc ở database:
`$request->user()->posts()`.

### D10 Sau khi đăng nhập cần làm gì ngoài `auth()->attempt()`?

**Ngắn:** `$request->session()->regenerate()`.

**Đào sâu:** Chống **session fixation** — kẻ tấn công gửi nạn nhân một link kèm session id do chúng
chọn, nạn nhân đăng nhập vào chính session đó, kẻ tấn công dùng lại id đã biết.

Khi logout thì `session()->invalidate()` và `session()->regenerateToken()`. Và nút đăng xuất phải là
**form POST**, không phải link — link GET cho phép trang khác nhúng `<img src=".../logout">`.

---

## E — Queue, Cache, Event

### E1 ⭐ Queue để làm gì? Khi nào dùng?

**Ngắn:** Đẩy việc chậm ra khỏi request. Gửi mail mất 800ms — làm trong request thì người dùng chờ 800ms
cho việc họ không quan tâm.

**Đào sâu:** Dùng cho: gửi mail/thông báo, gọi API bên thứ ba, xử lý ảnh, xuất báo cáo, đánh chỉ mục
tìm kiếm. Không dùng cho việc mà người dùng cần thấy kết quả ngay.

### E2 ⭐ Job không chạy, nguyên nhân?

**Ngắn:** Thường là thiếu `implements ShouldQueue` — khi đó `dispatch()` chạy `handle()` ngay trong
request, đúng bằng gọi hàm thường.

**Đào sâu:** Kiểm tra: dispatch rồi đếm `DB::table('jobs')->count()`. Bằng 0 nghĩa là job không vào hàng
đợi. Các nguyên nhân khác: worker không chạy, sai `--queue`, hoặc `QUEUE_CONNECTION=sync`.

### E3 ⭐⭐ Vì sao job chạy hai lần?

**Ngắn:** Thường do `retry_after` nhỏ hơn `timeout`.

**Đào sâu:** `timeout` là thời gian worker giết job; `retry_after` là thời gian hàng đợi coi job là
"mất" và giao cho worker khác. Nếu `timeout=120` mà `retry_after=90`:

```
0s    worker A nhận job
90s   hàng đợi tưởng mất → giao cho worker B
      ⚠️ job chạy ở A VÀ B cùng lúc
120s  worker A bị giết
```

Triệu chứng: mail gửi hai lần, tiền trừ hai lần, **không có lỗi nào trong log**. Quy tắc:
`retry_after` > `timeout`.

Nhưng dù cấu hình đúng, job **vẫn sẽ** chạy hai lần (worker bị kill, deploy giữa chừng). Nên phải thiết
kế job idempotent: dùng `ShouldBeUnique`, hoặc tự kiểm tra trạng thái đầu `handle()`.

### E4 ⭐ Sửa job mà worker vẫn chạy code cũ?

**Ngắn:** `queue:work` nạp framework một lần rồi giữ trong bộ nhớ — nó luôn chạy code của lúc khởi động.

**Đào sâu:** Khi dev dùng `queue:listen` (khởi động lại tiến trình con mỗi job) hoặc `php artisan dev`
— nó chạy sẵn `queue:listen`. Khi deploy **bắt buộc** `php artisan queue:restart`. Đây là lệnh hay quên
nhất trong quy trình deploy.

### E5 `dispatch` trong transaction có vấn đề gì?

**Ngắn:** Worker có thể nhận job trước khi transaction commit, rồi `Post::find($id)` trả `null`.

**Đào sâu:** Lỗi là `ModelNotFoundException`. Sửa bằng `->afterCommit()`, hoặc bật
`'after_commit' => true` trong `config/queue.php`.

Liên quan: job chỉ serialize **id** của model chứ không serialize cả model — đó là công của trait
`Queueable`, và cũng là lý do bài viết bị xoá giữa lúc chờ sẽ làm job ném `ModelNotFoundException`.

### E6 Batch và chain khác nhau?

**Ngắn:** Batch chạy song song và biết khi nào tất cả xong; chain chạy tuần tự, job sau chỉ chạy khi
job trước thành công.

**Đào sâu:** Batch có `then`, `catch`, `finally`, và theo dõi được `progress()`, `failedJobs`. Job phải
dùng trait `Batchable`. Dùng batch cho "đánh chỉ mục lại 10.000 bài", dùng chain cho "import → validate
→ thông báo".

### E7 Làm sao không làm sập API bên thứ ba?

**Ngắn:** Dùng middleware `RateLimited`, `WithoutOverlapping`, `ThrottlesExceptions`, và backoff tăng dần.

**Đào sâu:** `ThrottlesExceptions(10, 5*60)` là circuit breaker — 10 lần hỏng trong 5 phút thì tạm
ngừng. Backoff `[10, 60, 300, 900]` quan trọng vì thử lại ngay 5 lần chỉ làm dịch vụ đang quá tải càng
quá tải.

### E8 ⭐ Cache — chọn driver nào?

**Ngắn:** `database` đủ cho dự án nhỏ và không cần thêm hạ tầng; `redis` khi tải cao; `array` cho test.

**Đào sâu:** Em đo 500 lần `Cache::get`: database **328ms**, redis **94ms**, array **2ms**.

Nhưng lý do quan trọng hơn tốc độ để chọn Redis là **cache tag** — driver `database` và `file` không hỗ
trợ, ném `BadMethodCallException: This cache store does not support tagging`.

### E9 ⭐ Cache stampede là gì? Chống thế nào?

**Ngắn:** Khoá cache hết hạn đúng giờ cao điểm, 500 request cùng thấy miss và cùng chạy query nặng.

**Đào sâu:** Laravel có sẵn `Cache::flexible('key', [300, 600], fn () => ...)`:
- 0–300s: trả cache.
- 300–600s: trả **cache cũ ngay lập tức**, tính lại ở nền sau khi đã gửi response.
- Sau 600s: hết hạn thật.

Người dùng không bao giờ chờ, database chỉ bị một request tính lại. Cách khác là `Cache::lock()->block()`.

### E10 Cache cũ — xử lý thế nào?

**Ngắn:** Xoá cache trong `static::saved()`/`deleted()` của model, cộng với TTL ngắn làm bảo hiểm.

**Đào sâu:** Nhưng `Post::where(...)->update(...)` **không** kích hoạt `saved()`, nên cache vẫn sai.

Kỹ thuật tránh hẳn việc xoá cache: nhét `updated_at->timestamp` vào **khoá cache** —
`"post-card.{$post->id}.{$post->updated_at->timestamp}"`. Bài viết sửa → khoá đổi → tự động là cache mới.

### E11 Cache response có gì nguy hiểm?

**Ngắn:** Cache response của người đã đăng nhập bằng khoá chung thì người này thấy trang của người kia.

**Đào sâu:** Middleware cache response phải có điều kiện `! $request->user()`, hoặc khoá cache phải chứa
`user_id`. Đây là lỗ hổng nghiêm trọng và khó phát hiện vì nó chỉ xảy ra khi có nhiều người dùng đồng thời.

Liên quan: nếu cache và session dùng chung database Redis thì `php artisan cache:clear` sẽ **đăng xuất
toàn bộ người dùng**. Tách ra hai `database` khác nhau.

### E12 Event/Listener dùng khi nào? Laravel tìm listener thế nào?

**Ngắn:** Dùng để tách việc phụ (gửi mail, đánh chỉ mục, xoá cache) khỏi việc chính. Laravel 13 tự tìm
listener dựa vào **kiểu tham số của `handle()`**.

**Đào sâu:** Kiểm tra bằng `php artisan event:list` — dòng có dấu `⇂` là listener đang lắng nghe. Thiếu
type-hint thì listener không được tìm thấy, sự kiện bắn ra mà **không ai xử lý và không có lỗi nào**.

Đừng lạm dụng: khi luồng nghiệp vụ bắt buộc theo thứ tự và phải thành công cùng nhau, viết thẳng trong
service và bọc `DB::transaction()` rõ ràng hơn chuỗi event.

---

## F — Collection, Blade, Artisan

### F1 ⭐ `Post::all()->where(...)` khác `Post::where(...)->get()` thế nào?

**Ngắn:** Cách đầu lấy **toàn bộ bảng** về RAM rồi mới lọc; cách sau lọc ở database.

**Đào sâu:** Đây là lỗi hiệu năng hay gặp vì hai dòng trông gần giống nhau. Quy tắc: lọc và sắp xếp ở
database; Collection chỉ dùng cho dữ liệu **đã** lấy về.

### F2 `LazyCollection` khi nào cần?

**Ngắn:** Khi dữ liệu quá lớn để giữ hết trong RAM. Nó dùng generator, giữ một phần tử tại một thời điểm.

**Đào sâu:** Em đo với 2 triệu phần tử, `memory_limit=128M`: `collect()` chết với
`Allowed memory size exhausted`; `LazyCollection` chạy trong **23.3 MB**.

Với Eloquent, `Post::cursor()` trả về `LazyCollection`.

### F3 `->map->count()` là gì?

**Ngắn:** Higher order message — viết tắt của `->map(fn ($g) => $g->count())`.

**Đào sâu:** Dùng được với `map`, `filter`, `each`, `sum`, `every`, `sortBy`. Hay dùng nhất là
`->groupBy('kh')->map->count()`.

### F4 Blade escape thế nào? Khi nào dùng `{!! !!}`?

**Ngắn:** `{{ }}` chạy qua `htmlspecialchars`, `{!! !!}` in thẳng. Chỉ dùng `{!! !!}` khi bạn kiểm soát
nội dung.

**Đào sâu:** Với nội dung có xuống dòng phải là `{!! nl2br(e($post->body)) !!}` — `e()` **trước**,
`nl2br` sau. Viết `nl2br($post->body)` là mở cửa XSS.

Truyền dữ liệu vào JavaScript dùng `@json($post)`, không dùng `json_encode` trần — `@json` có
`JSON_HEX_TAG` nên chuỗi chứa `</script>` không phá được ngữ cảnh.

### F5 Blade thực chất là gì?

**Ngắn:** Là bộ biên dịch — file `.blade.php` được dịch thành PHP thuần cất ở `storage/framework/views/`,
rồi PHP chạy file đó.

**Đào sâu:** Biên dịch chỉ chạy lại khi file `.blade.php` mới hơn file đã dịch. Sửa view không thấy đổi
thì `php artisan view:clear`. Dòng cuối file đã dịch có `/**PATH ... ENDPATH**/` chỉ file gốc — nhờ đó
lỗi Blade trỏ vào đúng file bạn viết.

### F6 `@props` trong component ẩn danh làm gì?

**Ngắn:** Khai thuộc tính nào thì thuộc tính đó thành **biến** và bị lấy ra khỏi `$attributes`.

**Đào sâu:** Nhờ vậy `<x-badge color="green" class="mt-2" id="x">` cho ra
`<span class="badge badge-green mt-2" id="x">` — `color` không ra HTML, `class` được `merge` cộng thêm,
`id` không khai nhưng vẫn đi qua `{{ $attributes }}`.

Nhớ dấu hai chấm: `:post="$post"` truyền biến PHP, `post="$post"` truyền chuỗi.

### F7 Custom Artisan command khai signature thế nào trong Laravel 13?

**Ngắn:** Bằng attribute `#[Signature(...)]` và `#[Description(...)]`, thay cho `protected $signature`.

**Đào sâu:**

```php
#[Signature('posts:publish {--dry-run : Chỉ xem, không ghi} {--limit=100}')]
#[Description('Đăng các bài viết đã tới giờ hẹn')]
class PublishScheduledPosts extends Command
```

Cách cũ vẫn chạy. Nhớ `return self::SUCCESS/FAILURE` — không return thì mặc định 0 và CI tưởng thành
công dù command hỏng. Và mọi command sửa dữ liệu nên có `--dry-run`.

### F8 Observer — thứ tự hook khi tạo/sửa/xoá?

**Ngắn:**

```
create: saving → creating → created → saved
update: saving → updating → updated → saved
delete: deleting → deleted
```

**Đào sâu:** `saving`/`saved` bao ngoài **cả** create lẫn update. `creating` chạy trước khi ghi nên sửa
được `$post` (hay dùng để tự sinh slug).

Observer **không** chạy với `Post::where(...)->update(...)`. Và đừng gửi mail trong observer — mọi
`Post::create()` kể cả trong seeder và test đều sẽ gửi mail.

---

## G — Bảo mật

### G1 ⭐ Laravel chống SQL injection thế nào? Khi nào vẫn dính?

**Ngắn:** Eloquent và Query Builder tham số hoá mặc định. Dính khi bạn nối chuỗi vào `whereRaw`,
`DB::select`, hoặc `orderByRaw`.

**Đào sâu:** Trường hợp đặc biệt là `orderBy` — nó nhận **tên cột**, không có placeholder cho tên cột.
Phải dùng danh sách trắng:

```php
$allowed = ['title', 'published_at', 'views'];
$sort = in_array($request->query('sort'), $allowed, true) ? $request->query('sort') : 'published_at';
```

Truyền thẳng input vào `orderBy()` cho phép đọc dữ liệu qua blind injection.

### G2 XSS — Laravel chống sẵn tới đâu?

**Ngắn:** `{{ }}` escape sẵn. Bạn tự tạo lỗ hổng khi dùng `{!! !!}` với dữ liệu người dùng.

**Đào sâu:** Một chỗ ít ai để ý: `{{ }}` escape HTML nhưng **không** chặn `javascript:` trong `href`.
Phải validate `'url:http,https'`.

### G3 ⭐ Mass assignment nguy hiểm thế nào?

**Ngắn:** `User::create($request->all())` cho phép người dùng gửi kèm `is_admin=1` và chiếm quyền quản trị.

**Đào sâu:** Ba lớp bảo vệ: FormRequest chỉ trả trường đã khai rule; `#[Fillable]` là danh sách trắng;
`preventSilentlyDiscardingAttributes()` biến việc bỏ cột im lặng thành exception.

`#[Guarded([])]` là tắt hẳn lá chắn — đừng dùng.

### G4 IDOR là gì? Laravel có sẵn cách chống không?

**Ngắn:** Là sửa id trên URL để xem dữ liệu người khác. Chống bằng `scopeBindings()` cho route lồng
nhau, và lọc ở database thay vì ở view.

**Đào sâu:** `/posts/1/comments/9999` không có `scopeBindings()` sẽ trả **200** với bình luận của bài
khác. Đây là lỗi phân quyền phổ biến nhất và không có lỗi nào báo cho bạn biết.

### G5 ⭐ `APP_DEBUG=true` trên production nguy hiểm ra sao?

**Ngắn:** Trang lỗi hiển thị đường dẫn máy chủ, **toàn bộ biến môi trường** (kể cả `DB_PASSWORD`,
`APP_KEY`), câu SQL và stack trace.

**Đào sâu:** Em đo: cùng một request lỗi, `APP_DEBUG=false` trả ~100 byte JSON; `APP_DEBUG=true` trả hơn
40 KB kèm danh sách middleware và các câu SQL đã chạy với tham số.

Tương tự phải có Gate cho `/horizon`, `/telescope`, `/pulse` — chúng hiện payload đầy đủ của mọi request
kể cả mật khẩu trong form đăng nhập.

### G6 Trả model thẳng từ route có vấn đề gì?

**Ngắn:** Lộ mọi cột, kể cả cột nội bộ. Dùng API Resource làm danh sách trắng.

**Đào sâu:** `#[Hidden(['password', 'remember_token'])]` là lá chắn cuối — viết model mới mà quên nó là
mọi endpoint trả model đó lộ hash mật khẩu.

Tương tự với broadcasting: event không khai `broadcastWith()` sẽ serialize toàn bộ model xuống trình duyệt.

---

## H — Testing và Kiến trúc

### H1 ⭐ Test của bạn chạy trên database nào?

**Ngắn:** Cùng loại với production. `phpunit.xml` mặc định dùng SQLite in-memory, nhưng nếu app chạy
PostgreSQL thì phải đổi.

**Đào sâu:** Em gặp thật: scope dùng `ilike` (toán tử riêng của PostgreSQL) chạy ngon trên trình duyệt
nhưng chết trong test với `near "ilike": syntax error`.

Chiều ngược lại tệ hơn — SQLite **cho qua** những thứ PostgreSQL từ chối. Ví dụ cực đoan: SQLite coi
định danh trong nháy kép không khớp cột nào là **chuỗi**, nên `where "excerpt" = 'excerpt'` khớp **mọi
dòng** thay vì báo lỗi cột không tồn tại. Test xanh trên SQLite không chứng minh gì.

### H2 Test bao nhiêu là đủ? Test cái gì?

**Ngắn:** Không đuổi theo 100% coverage. Ưu tiên theo rủi ro: tiền bạc, phân quyền, validate, luồng
nghiệp vụ chính, và mọi bug đã sửa.

**Đào sâu:** Với Laravel, **feature test là chủ lực** (~70%) vì một lời gọi đi qua route, middleware,
controller, validate, policy, model và view. Unit test chỉ đáng viết cho logic thuần.

Quy tắc thực dụng: mỗi khi sửa bug, viết test tái hiện bug đó trước.

### H3 Repository pattern — có nên dùng trong Laravel không?

**Ngắn:** Thường là không. Eloquent đã là một lớp trừu tượng trên database rồi; thêm repository là thêm
một lớp mà hiếm khi đổi được thứ gì.

**Đào sâu:** Lý lẽ ủng hộ repository là "để đổi ORM". Thực tế gần như không ai đổi ORM, và nếu đổi thì
repository trả về model Eloquent vẫn phải viết lại hết.

Em dùng cách khác cho cùng mục tiêu: **Action** cho việc ghi (một việc nghiệp vụ = một class) và
**Query object** cho việc đọc phức tạp. Query object gom `with()`, `withCount()` vào một chỗ nên trang
chủ, RSS và API dùng chung, không nơi nào bị quên eager load.

Repository đáng dùng khi thật sự có **nhiều nguồn dữ liệu** cho cùng một khái niệm — ví dụ sản phẩm lấy
từ database và từ API đối tác.

### H4 Khi nào tách logic ra khỏi controller?

**Ngắn:** Khi có **≥ 2 bước** hoặc **≥ 2 nơi gọi**.

**Đào sâu:** Controller chỉ nên: nhận request, gọi Action, trả response. Action không được biết gì về
HTTP — không `redirect()`, không `abort()`, không nhận `Request`. Đó là thứ khiến nó gọi được từ
controller, job, artisan command và test.

Model cũng nên gầy: chỉ quan hệ, cast, scope, accessor. Model có method gửi mail nghĩa là test model
phải mock cả hệ thống mail.

---

## Ba câu bạn nên chuẩn bị trước

Không có đáp án đúng, nhưng phải trả lời trôi chảy. Xem khung ở
[README](./README.md#ba-câu-chuyện-phải-chuẩn-bị-sẵn).

1. Kể về một dự án bạn làm.
2. Lỗi khó nhất bạn từng gặp.
3. Vì sao bạn đổi việc.

---

Tiếp theo: [02-bai-test-code.md](./02-bai-test-code.md)
