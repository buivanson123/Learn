# Nâng cao 06 — Bảo mật

Laravel làm sẵn nhiều thứ (CSRF, escape Blade, băm mật khẩu, tham số hoá SQL). Bài này nói về những
chỗ **bạn phải tự làm đúng** — và những chỗ dễ vô tình tắt lá chắn có sẵn.

Danh sách kiểm tra trước khi lên production ở [mục 12](#12-danh-sách-kiểm-tra-trước-khi-deploy).

---

## 1. Gán hàng loạt — lỗ hổng số một

```php
User::create($request->all());        // ❌
$user->update($request->all());       // ❌
```

Người dùng gửi thêm `is_admin=1` vào form đăng ký là chiếm quyền quản trị.

Lá chắn của Laravel là `#[Fillable]`. Nhưng nó **âm thầm bỏ qua** cột không khai, nên bạn không biết
mình đang dựa vào nó hay đang mất dữ liệu.

```php
#[Fillable(['name', 'email', 'password'])]      // ✅ danh sách trắng
class User extends Authenticatable {}
```

```php
#[Guarded([])]                                   // ❌ tắt hẳn lá chắn
```

### Ba lớp bảo vệ, dùng cả ba

```php
// 1. FormRequest chỉ trả về trường đã khai rule
$user->posts()->create($request->validated());

// 2. #[Fillable] chặn cột nhạy cảm
#[Fillable(['title', 'slug', 'body', 'status', 'published_at', 'category_id'])]
// user_id KHÔNG ở đây — nó đến từ phiên đăng nhập

// 3. Bật báo lỗi thay vì bỏ qua im lặng
Model::preventSilentlyDiscardingAttributes(! app()->isProduction());
```

Với lớp 3, gửi cột lạ sẽ nổ ngay lúc dev:

```
Illuminate\Database\Eloquent\MassAssignmentException
Add fillable property [user_id] to allow mass assignment on [App\Models\Post].
```

---

## 2. Phân quyền — chỗ hay quên nhất

### `@can` không bảo vệ dữ liệu

```blade
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Sửa</a>
@endcan
```

Nút bị ẩn, nhưng URL vẫn gọi được bằng `curl`. **Luôn** kiểm tra ở server:

```php
public function edit(Post $post)
{
    $this->authorize('update', $post);
    // ...
}
```

### Lọc ở database, không ở view

```php
// ❌ lấy hết rồi lọc khi hiển thị
$posts = Post::all();

// ✅ lọc ngay trong truy vấn
$posts = $request->user()->posts()->paginate(10);
```

Cách sai vẫn lộ dữ liệu qua tổng số bản ghi trong phân trang, và qua bất kỳ endpoint JSON nào.

### IDOR — sửa id trên URL

```php
// ❌ ai cũng xem được bình luận của bất kỳ bài nào
Route::get('/posts/{post}/comments/{comment}', ...);

// ✅ ép comment phải thuộc post
Route::get('/posts/{post}/comments/{comment}', ...)->scopeBindings();
```

`scopeBindings()` đổi truy vấn từ `Comment::find($id)` thành `$post->comments()->where('id', $id)`.
Không có nó, `/posts/1/comments/9999` trả về bình luận của bài khác — **200 OK**, không phải 403.

### Cái bẫy `Gate::before`

```php
Gate::before(fn (User $user, string $ability) => $user->is_admin ? true : null);   // ✅ null
Gate::before(fn (User $user, string $ability) => $user->is_admin);                 // ❌ false
```

Trả `false` cho người không phải admin sẽ **chặn hết mọi người ở mọi quyền**, kể cả quyền policy đã
cho phép. Phải trả `null` để chuỗi kiểm tra đi tiếp.

### `make:policy` sinh `return false`

```bash
$ php artisan make:policy PostPolicy --model=Post
```

Mọi method `return false;`. Không sửa → 403 khắp nơi. Sửa nhầm thành `return true;` cho xong việc →
mất phân quyền hoàn toàn. Đọc lại từng method.

---

## 3. SQL injection

Eloquent và Query Builder tham số hoá mặc định. Bạn chỉ tự tạo lỗ hổng khi nối chuỗi:

```php
// ❌
DB::select("SELECT * FROM posts WHERE title = '{$request->q}'");
Post::whereRaw("title = '{$request->q}'")->get();
Post::orderByRaw($request->sort)->get();

// ✅
DB::select('SELECT * FROM posts WHERE title = ?', [$request->q]);
Post::whereRaw('LOWER(title) = ?', [strtolower($request->q)])->get();
```

### Tên cột không tham số hoá được

`orderBy` nhận **tên cột**, không phải giá trị — không có placeholder cho nó. Phải dùng danh sách trắng:

```php
$allowed = ['title', 'published_at', 'views'];
$sort = in_array($request->query('sort'), $allowed, true)
    ? $request->query('sort')
    : 'published_at';

$direction = $request->query('dir') === 'asc' ? 'asc' : 'desc';

Post::orderBy($sort, $direction)->get();
```

Truyền thẳng `$request->query('sort')` vào `orderBy()` cho phép người dùng đọc dữ liệu qua kỹ thuật
blind injection.

---

## 4. XSS

```blade
{{ $post->title }}       {{-- ✅ tự escape --}}
{!! $post->body !!}      {{-- ⚠️ chỉ khi bạn kiểm soát nội dung --}}
```

### Nội dung có xuống dòng

```blade
{!! nl2br(e($post->body)) !!}      {{-- ✅ escape trước, xuống dòng sau --}}
{!! nl2br($post->body) !!}         {{-- ❌ chưa escape --}}
```

Thứ tự quan trọng: `e()` **trước**, `nl2br()` sau.

### Người dùng nhập HTML

Nếu thật sự cần cho phép HTML (trình soạn thảo rich text), lọc bằng thư viện chuyên dụng, đừng tự viết
regex:

```bash
$ composer require mews/purifier
```

```php
$post->body = clean($request->input('body'));
```

### Truyền dữ liệu vào JavaScript

```blade
<script>
    const post = @json($post);            {{-- ✅ --}}
    const post = {!! json_encode($post) !!};   {{-- ❌ không thoát </script> --}}
</script>
```

`@json` dùng cờ `JSON_HEX_TAG` nên chuỗi chứa `</script>` không phá được ngữ cảnh.

### Thuộc tính href

```blade
<a href="{{ $user->website }}">Trang cá nhân</a>
```

`{{ }}` escape HTML nhưng **không** chặn `javascript:alert(1)`. Kiểm tra scheme:

```php
'website' => ['nullable', 'url:http,https'],
```

---

## 5. CSRF

Đã nói ở [bài 04](../04-validation-va-form.md). Ba điểm cho production:

```php
// ❌ đừng bao giờ
$middleware->remove(ValidateCsrfToken::class);

// ✅ loại trừ đúng đường dẫn webhook
->withMiddleware(function (Middleware $middleware): void {
    $middleware->validateCsrfTokens(except: ['webhooks/stripe']);
})
```

Webhook được loại trừ CSRF thì **phải** xác minh chữ ký của bên gửi:

```php
public function handle(Request $request)
{
    $signature = $request->header('Stripe-Signature');
    $payload   = $request->getContent();

    $expected = hash_hmac('sha256', $payload, config('services.stripe.webhook_secret'));

    if (! hash_equals($expected, $signature)) {
        abort(403);
    }
    // ...
}
```

`hash_equals()` so sánh trong thời gian không đổi. Dùng `===` để so chữ ký là mở đường cho timing attack.

---

## 6. Xác thực

### Mật khẩu

```php
use Illuminate\Validation\Rules\Password;

'password' => ['required', 'confirmed', Password::min(12)
    ->letters()
    ->mixedCase()
    ->numbers()
    ->symbols()
    ->uncompromised()],
```

`uncompromised()` kiểm tra mật khẩu có trong danh sách rò rỉ công khai không, dùng k-anonymity —
chỉ 5 ký tự đầu của hash được gửi đi, mật khẩu không rời khỏi server.

```ini
BCRYPT_ROUNDS=12       # production. Mặc định 12 trong Laravel 13
```

`phpunit.xml` đặt `BCRYPT_ROUNDS=4` để test chạy nhanh — đúng, đừng sửa.

### Băm hai lần

Model `User` có cast `'password' => 'hashed'`. Gọi thêm `Hash::make()` là băm hai lần và **không ai
đăng nhập được**, mà không có lỗi nào. Xem [bài 05](../05-auth-va-phan-quyen.md).

### Chống dò mật khẩu

```php
Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:5,1');
```

Chặt hơn — giới hạn theo cả email lẫn IP:

```php
// AppServiceProvider::boot()
RateLimiter::for('login', function (Request $request) {
    return [
        Limit::perMinute(5)->by($request->input('email').$request->ip()),
        Limit::perMinute(20)->by($request->ip()),
    ];
});
```

```php
->middleware('throttle:login')
```

### Session fixation

```php
$request->session()->regenerate();       // sau khi đăng nhập
$request->session()->invalidate();       // khi đăng xuất
$request->session()->regenerateToken();
```

### Đăng xuất phải là POST

```blade
<form method="POST" action="{{ route('logout') }}">
    @csrf
    <button type="submit">Đăng xuất</button>
</form>
```

Link `GET /logout` cho phép trang khác nhúng `<img src="https://blog.test/logout">`.

---

## 7. API với Sanctum

```bash
$ php artisan install:api
 INFO API scaffolding installed. Please add the [Laravel\Sanctum\HasApiTokens] trait to your User model.
```

```php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
}
```

### Token có phạm vi và hạn

```php
$token = $user->createToken(
    name: 'ung-dung-di-dong',
    abilities: ['posts:read', 'posts:write'],
    expiresAt: now()->addDays(30),
);

return ['token' => $token->plainTextToken];      // chỉ hiện MỘT LẦN
```

```php
Route::middleware(['auth:sanctum', 'ability:posts:write'])->post('/posts', ...);
```

```php
if (! $request->user()->tokenCan('posts:write')) {
    abort(403);
}
```

Đừng tạo token với `['*']` cho mọi thứ. Ứng dụng đọc tin chỉ cần `posts:read`.

### Thu hồi

```php
$user->tokens()->delete();                              // mọi thiết bị
$user->tokens()->where('id', $id)->delete();            // một thiết bị
$request->user()->currentAccessToken()->delete();       // đăng xuất thiết bị hiện tại
```

```php
Schedule::command('sanctum:prune-expired --hours=24')->daily();
```

### Rate limit API

```php
RateLimiter::for('api', fn (Request $r) => $r->user()
    ? Limit::perMinute(120)->by($r->user()->id)
    : Limit::perMinute(30)->by($r->ip()));
```

---

## 8. Rò rỉ dữ liệu ra response

### Trả model thẳng là lộ mọi cột

```php
Route::get('/posts/{post}', fn (Post $post) => $post);
```

Trả về mọi cột, kể cả `internal_notes`, `cost_price`, `moderation_score`. Dùng Resource:

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'     => $this->id,
            'title'  => $this->title,
            'author' => $this->whenLoaded('author', fn () => ['name' => $this->author->name]),
        ];
    }
}
```

Danh sách trắng, không phải danh sách đen.

### `#[Hidden]` là lá chắn cuối

```php
#[Hidden(['password', 'remember_token', 'two_factor_secret'])]
class User extends Authenticatable {}
```

Kiểm chứng:

```bash
$ php artisan tinker --execute='echo App\Models\User::first()->toJson();'
{"id":1,"name":"Son","email":"son@test.dev","email_verified_at":"...","created_at":"...","updated_at":"..."}
```

Không có `password`. Viết model mới mà quên `#[Hidden]` là mọi endpoint trả model đó lộ hash mật khẩu.

### `broadcastWith()` cho event

Không khai thì Laravel serialize toàn bộ model xuống trình duyệt. Xem
[bài 04 mục 4](./04-realtime-reverb.md).

### `APP_DEBUG` trên production

```ini
APP_DEBUG=false
```

Để `true` là trang lỗi hiển thị đường dẫn máy chủ, **toàn bộ biến môi trường** (kể cả `DB_PASSWORD`,
`APP_KEY`), câu SQL và stack trace.

Kiểm chứng khác biệt:

```bash
# APP_DEBUG=false
$ curl -s http://127.0.0.1:8000/api/posts/9999 -H 'Accept: application/json'
{
    "message": "No query results for model [App\\Models\\Post] 9999"
}

# APP_DEBUG=true → cùng request trả về 41 KB JSON kèm stack trace và đường dẫn tuyệt đối
```

---

## 9. Upload file

```php
'cover' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:max_width=4000'],
```

- `image` + `mimes` kiểm tra **nội dung thật** của file, không chỉ phần mở rộng.
- `max:2048` tính bằng KB.

```php
$path = $request->file('cover')->store('covers', 'public');
```

`store()` sinh tên ngẫu nhiên — đừng dùng `storeAs()` với tên do người dùng đặt:

```php
// ❌ path traversal + ghi đè file người khác
$file->storeAs('covers', $request->input('filename'));
```

Đừng lưu file người dùng vào thư mục có thể thực thi PHP. `storage/app/public` + `php artisan storage:link`
là đúng; `public/uploads` là sai nếu server cấu hình lỏng.

---

## 10. Header bảo mật và CSP

```php
namespace App\Http\Middleware;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->add([
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options'        => 'DENY',
            'Referrer-Policy'        => 'strict-origin-when-cross-origin',
            'Permissions-Policy'     => 'geolocation=(), microphone=(), camera=()',
            'Strict-Transport-Security' => 'max-age=31536000; includeSubDomains',
        ]);

        return $response;
    }
}
```

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->web(append: [SecurityHeaders::class]);
})
```

Kiểm chứng:

```bash
$ curl -sI https://blog.test | grep -iE 'x-frame|x-content|strict-transport'
```

### CSP với Livewire

Livewire chèn script inline, nên CSP nghiêm ngặt sẽ chặn nó. Livewire 4 có sẵn feature `SupportCSP` —
dùng bản build tương thích CSP:

```php
// config/livewire.php
'inject_assets' => true,
```

Bắt đầu bằng `Content-Security-Policy-Report-Only` để xem cái gì bị chặn trước khi bật thật.

---

## 11. Dữ liệu nhạy cảm

### Mã hoá cột

```php
protected function casts(): array
{
    return [
        'social_security_number' => 'encrypted',
        'preferences'            => 'encrypted:array',
    ];
}
```

Dùng `APP_KEY`. **Mất `APP_KEY` là mất dữ liệu vĩnh viễn** — sao lưu nó tách khỏi database.

Lưu ý: cột đã mã hoá **không tìm kiếm được** bằng `WHERE`. Cần tìm thì lưu thêm cột hash.

### Không log dữ liệu nhạy cảm

```php
// config/logging.php — không tồn tại sẵn, tự thêm nếu cần
Log::info('Đăng nhập', ['email' => $email]);       // ⚠️ cân nhắc
Log::info('Đăng nhập', ['user_id' => $user->id]);  // ✅
```

Cẩn thận với `DB::listen` ghi cả bindings — nó ghi cả mật khẩu trong câu `insert`. Chỉ bật khi dev.

### `config:show` in mật khẩu

```bash
$ php artisan config:show database.connections.pgsql
 password .. secret
```

Đừng dán output lệnh này vào issue hay chat công khai.

### Trang công cụ trên production

`/horizon`, `/telescope`, `/pulse` hiển thị payload job, request, query — có thể chứa token và dữ liệu
cá nhân. Mặc định chúng chỉ mở ở `local`, nhưng phải kiểm tra lại:

```php
Gate::define('viewHorizon',   fn ($user) => $user->is_admin);
Gate::define('viewTelescope', fn ($user) => $user->is_admin);
Gate::define('viewPulse',     fn ($user) => $user->is_admin);
```

---

## 12. Danh sách kiểm tra trước khi deploy

### Cấu hình

- [ ] `APP_DEBUG=false`
- [ ] `APP_ENV=production`
- [ ] `APP_KEY` đã sinh và **được sao lưu** riêng
- [ ] `.env` không nằm trong git (`git check-ignore .env` phải trả về `.env`)
- [ ] `SESSION_SECURE_COOKIE=true` (chỉ gửi cookie qua HTTPS)
- [ ] `php artisan config:cache` chạy trong bước deploy

### Model

- [ ] Mọi model có `#[Fillable]`, không có `#[Guarded([])]`
- [ ] Cột nhạy cảm nằm trong `#[Hidden]`
- [ ] `Model::shouldBeStrict()` bật ở non-production

### Route và quyền

- [ ] Mọi route ghi dữ liệu có `authorize()` ở **server**, không chỉ `@can` ở view
- [ ] Route lồng nhau có `scopeBindings()`
- [ ] Login có `throttle`
- [ ] API có rate limit theo user và theo IP
- [ ] `Gate::before` trả `null`, không trả `false`

### Đầu ra

- [ ] Endpoint JSON dùng Resource, không trả model thẳng
- [ ] Event broadcast có `broadcastWith()`
- [ ] `{!! !!}` chỉ dùng với nội dung đã `e()` hoặc đã lọc

### Hạ tầng

- [ ] HTTPS bắt buộc, có HSTS
- [ ] Header bảo mật đã bật
- [ ] `/horizon`, `/telescope`, `/pulse` có Gate
- [ ] `composer audit` sạch

```bash
$ composer audit
No security vulnerability advisories found.
```

Đưa `composer audit` vào CI — nó chạy trong vài giây và bắt được lỗ hổng đã công bố của thư viện.

---

## Bài tập

1. Viết một form đăng ký dùng `User::create($request->all())`. Gửi kèm `is_admin=1` bằng `curl` và
   kiểm tra database. Rồi thêm `#[Fillable]` và thử lại.

2. Bật `Model::preventSilentlyDiscardingAttributes()`. Lặp lại bài 1 và ghi lại exception.

3. Tạo route `/posts/{post}/comments/{comment}` **không** có `scopeBindings()`. Truy cập một comment
   không thuộc post đó. Ghi lại mã trạng thái. Thêm `scopeBindings()` và thử lại.

4. Viết `Gate::before` trả `false` thay vì `null`. Đăng nhập bằng user thường và thử một quyền mà
   policy cho phép. Giải thích kết quả.

5. Cho phép `orderBy($request->query('sort'))` không lọc. Thử `?sort=(select ...)` và mô tả rủi ro.
   Sửa bằng danh sách trắng.

6. Trả model `User` thẳng từ một route. Xem JSON và chỉ ra cột nào không nên lộ. Xoá `#[Hidden]` khỏi
   model rồi xem lại.

7. Đặt `APP_DEBUG=true`, gọi một URL gây lỗi 500 và đếm kích thước response. Đặt lại `false` và so sánh.

8. Tạo token Sanctum với `abilities: ['posts:read']`. Gọi endpoint `POST /api/posts` bằng token đó và
   ghi lại mã trạng thái.

9. Chạy `composer audit` trên dự án. Nếu sạch, thử `composer require guzzlehttp/guzzle:6.0` và chạy lại.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Không có `#[Fillable]` và có `#[Guarded([])]` thì `is_admin` được ghi vào database. Với
`#[Fillable(['name','email','password'])]`, cột đó bị bỏ qua trong im lặng.

**3.** Không có `scopeBindings()`: **200 OK** kèm nội dung bình luận của bài khác — lỗ hổng IDOR.
Có `scopeBindings()`: **404**.

**4.** User thường bị chặn **mọi** quyền, kể cả `view` mà policy trả `true`. `Gate::before` trả `false`
là quyết định cuối cùng; trả `null` mới cho phép chuỗi kiểm tra đi tiếp tới policy.

**7.** `APP_DEBUG=false` → response ~100 byte JSON. `APP_DEBUG=true` → hơn 40 KB, chứa đường dẫn tuyệt
đối của mã nguồn, danh sách middleware, và các câu SQL đã chạy kèm tham số.

**8.** `403 Forbidden` — middleware `ability:posts:write` từ chối token chỉ có `posts:read`.

</details>

---

Tiếp theo: [07-testing-chuyen-sau.md](./07-testing-chuyen-sau.md)
