# Bài 09 — 24 lỗi thường gặp

Mỗi mục có: **thông báo lỗi nguyên văn** (chạy thật trên Laravel 13.26 + PHP 8.5 + PostgreSQL 18),
nguyên nhân, và cách sửa. Tra ở đây trước khi tìm Google — kết quả Google phần lớn viết cho Laravel
10/11 và cách sửa của họ có thể không còn đúng.

Mẹo đọc lỗi: bật `APP_DEBUG=true` khi dev để thấy đầy đủ. Trên production **luôn** `APP_DEBUG=false`,
nếu không trang lỗi sẽ lộ đường dẫn máy chủ, biến môi trường và câu SQL.

---

## Nhóm 1 — Model và Eloquent

### 1. Cột bị bỏ qua trong im lặng khi `create()`

```
Illuminate\Database\QueryException
SQLSTATE[23502]: Not null violation: 7 ERROR:  null value in column "user_id" of relation "posts"
violates not-null constraint
DETAIL: Failing row contains (2, null, null, X, x, y, draft, null, ...).
(SQL: insert into "posts" ("title", "slug", "body", "updated_at", "created_at") values (X, x, y, ...))
```

**Nguyên nhân:** `user_id` không có trong `#[Fillable]` của model, nên Eloquent **bỏ nó ra khỏi câu
INSERT**. Nhìn phần `SQL:` — cột đó biến mất hẳn.

**Nguy hiểm hơn:** nếu cột cho phép `null` thì không có lỗi nào cả, chỉ có dữ liệu bị thiếu.

**Sửa:**

```php
// ✅ gán qua quan hệ — user_id tự điền, không cần fillable
$user->posts()->create([...]);

// ✅ hoặc gán ngoài mảng
$post = new Post(['title' => ...]);
$post->user_id = $user->id;
$post->save();
```

**Phòng ngừa** — thêm vào `AppServiceProvider::boot()`:

```php
Model::preventSilentlyDiscardingAttributes(! app()->isProduction());
```

Từ đó lỗi hiện rõ ràng:

```
Illuminate\Database\Eloquent\MassAssignmentException
Add fillable property [user_id] to allow mass assignment on [App\Models\Post].
```

---

### 2. Không tìm thấy `#[Fillable]` vì đang tìm `protected $fillable`

**Triệu chứng:** chép model từ Stack Overflow về, `protected $fillable = [...]` viết đúng nhưng
`model:show` không hiện `fillable` ở đâu.

**Nguyên nhân:** Laravel 13 dùng **PHP attribute**. Cả hai cách đều chạy, nhưng nếu bạn khai **cả hai**
trong cùng model thì rất dễ nhầm cái nào đang có hiệu lực.

**Sửa:** thống nhất một kiểu trong toàn dự án. Bản 13 sinh sẵn kiểu attribute:

```php
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable {}
```

Kiểm tra bằng:

```bash
$ php artisan model:show Post
 title fillable .. character varying(255)
```

---

### 3. Cột khoá ngoại không tồn tại

```
Illuminate\Database\QueryException
SQLSTATE[42703]: Undefined column: 7 ERROR:  column posts.author_id does not exist
```

**Nguyên nhân:** Laravel đoán khoá ngoại từ **tên method quan hệ**, không phải tên class.

```php
public function author(): BelongsTo
{
    return $this->belongsTo(User::class);      // ← đi tìm cột author_id
}
```

**Sửa:** ghi rõ tên cột.

```php
return $this->belongsTo(User::class, 'user_id');
```

---

### 4. Gọi `format()` trên chuỗi

```
Error  Call to a member function format() on string
```

**Nguyên nhân:** quên cast cột ngày.

**Sửa:**

```php
protected function casts(): array
{
    return ['published_at' => 'datetime'];
}
```

Sau đó `$post->published_at` là `Carbon` và dùng được `format()`, `diffForHumans()`, `isPast()`.

---

### 5. N+1 query

```
Illuminate\Database\LazyLoadingViolationException
Attempted to lazy load [author] on model [App\Models\Post] but lazy loading is disabled.
```

**Nguyên nhân:** truy cập quan hệ trong vòng lặp mà không eager load.

**Sửa:**

```php
Post::with('author')->get();
Post::with(['author:id,name', 'category:id,name'])->get();
Post::withCount('comments')->get();
```

Đo thật với 4 bài viết: không `with()` → **5 query**; có `with()` → **2 query**.

> ⚠️ **Công tắc này không báo lỗi khi chỉ có 1 model.** Trong
> `Illuminate\Database\Eloquent\Builder::hydrate()`:
> ```php
> if (count($items) > 1) {
>     $model->preventsLazyLoading = Model::preventsLazyLoading();
> }
> ```
> Nghĩa là **test trên 1 bản ghi không phát hiện được N+1**. Luôn seed từ 2 bản ghi trở lên.

---

### 6. Đọc cột chưa được lấy về

```
Illuminate\Database\Eloquent\MissingAttributeException
The attribute [body] either does not exist or was not retrieved for model [App\Models\Post].
```

**Nguyên nhân:** `Post::select('id', 'title')->first()` rồi đọc `$post->body`. Lỗi này chỉ hiện khi
đã bật `preventAccessingMissingAttributes()`.

**Sửa:** thêm cột vào `select()`, hoặc bỏ `select()` đi.

Không bật công tắc đó thì `$post->body` trả `null` — và bạn lưu `null` vào chỗ khác mà không biết.

---

### 7. `update()` hàng loạt không kích hoạt event

**Triệu chứng:** cache không được xoá, observer không chạy, `updated_at` không đổi.

```php
Post::where('status', 'draft')->update(['status' => 'published']);   // ← không có event
```

**Nguyên nhân:** đây là **một câu SQL UPDATE**, không nạp model nào nên không có vòng đời model.

**Sửa:** khi cần event, lặp qua từng model:

```php
Post::where('status', 'draft')->each(fn ($post) => $post->update(['status' => 'published']));
```

Chậm hơn nhiều — cân nhắc xoá cache thủ công thay vì đổi cách viết.

---

## Nhóm 2 — Migration và Database

### 8. Migration chạy sai thứ tự

```
Illuminate\Database\QueryException
SQLSTATE[42P01]: Undefined table: 7 ERROR:  relation "categories" does not exist
(SQL: alter table "posts" add constraint "posts_category_id_foreign"
      foreign key ("category_id") references "categories" ("id") on delete set null)
```

**Nguyên nhân:** migration chạy theo mốc thời gian trong tên file. Bảng đích chưa tồn tại.

**Sửa khi chưa deploy** — đổi tên file:

```bash
$ mv database/migrations/2026_08_18_133657_create_categories_table.php \
     database/migrations/2026_08_18_133650_create_categories_table.php
$ php artisan migrate:fresh
```

**Sửa khi đã deploy** — tách khoá ngoại ra migration mới:

```php
Schema::table('posts', function (Blueprint $table) {
    $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
});
```

Đừng đổi tên migration đã chạy trên production — Laravel sẽ tưởng đó là migration mới và chạy lại.

---

### 9. Sai kiểu dữ liệu khi bind route trên PostgreSQL

```
Illuminate\Database\QueryException
SQLSTATE[22P02]: Invalid text representation: 7 ERROR:  invalid input syntax for type bigint: "bai-dau-tien"
```

**Nguyên nhân:** route khai `{post}` (bind theo `id`) nhưng URL truyền slug. PostgreSQL từ chối ép
chuỗi thành `bigint` và ném **500**, không phải 404.

MySQL thì âm thầm ép `'bai-dau-tien'` thành `0` và trả 404 — cùng một bug, hai triệu chứng khác nhau.

**Sửa:** khai ở model, để mọi route dùng chung một quy tắc.

```php
public function getRouteKeyName(): string
{
    return 'slug';
}
```

Hoặc chặn ngay ở route:

```php
Route::get('/posts/{post}', ...)->whereNumber('post');
```

---

### 10. Toán tử `ilike` không tồn tại

```
SQLSTATE[HY000]: General error: 1 near "ilike": syntax error
(Connection: sqlite, Database: :memory:, SQL: select count(*) as "aggregate" from "posts" where "title" ilike %Hoc%)
```

**Nguyên nhân:** `ilike` là toán tử **riêng của PostgreSQL**. Ứng dụng chạy Postgres nhưng test chạy
SQLite (mặc định của `phpunit.xml`).

Đây là loại lỗi tệ nhất: **test xanh không chứng minh production chạy được**, và ngược lại.

**Sửa:** cho test dùng đúng loại database.

```xml
<!-- phpunit.xml -->
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="blog_test"/>
```

Không cần tạo database bằng tay, Laravel tự tạo ở lần chạy đầu.

---

### 11. Không kết nối được database

```
SQLSTATE[08006] [7] connection to server at "127.0.0.1", port 5432 failed: Connection refused
	Is the server running on that host and accepting TCP/IP connections?
```

**Nguyên nhân thường gặp nhất:** đổi `DB_CONNECTION=pgsql` nhưng quên bỏ comment / sửa `DB_PORT`.
File `.env` mặc định ghi `# DB_PORT=3306` — số của MySQL.

**Sửa:** kiểm tra ba thứ theo thứ tự.

```bash
$ docker exec blog-pg pg_isready -U blog        # container đã nhận kết nối chưa
/var/run/postgresql:5432 - accepting connections

$ php artisan config:show database.connections.pgsql   # Laravel đang nối vào đâu
 port .. 55433

$ php artisan db                                # thử mở CLI
psql (18.6)
blog=#
```

---

### 12. `could not find driver`

```
Illuminate\Database\QueryException
could not find driver (Connection: pgsql, SQL: select * from information_schema.tables ...)
```

**Nguyên nhân:** thiếu extension PHP, không phải lỗi cấu hình.

**Sửa:**

```bash
$ php -m | grep -E 'pdo_pgsql|pdo_mysql'
pdo_mysql
pdo_pgsql
```

Không thấy dòng tương ứng thì cài lại PHP có kèm extension đó.

---

## Nhóm 3 — Route và Controller

### 13. Route sau ghi đè route trước

```php
Route::get('/posts/{post}', ...);
Route::get('/posts/{post:slug}', ...);
```

```bash
$ php artisan route:list --path=posts
 GET|HEAD  api/posts/{post:slug}        ← chỉ còn 1 route
```

**Nguyên nhân:** router lưu route theo khoá `method + URI`. Phần `:slug` không nằm trong khoá, nên hai
route sinh cùng một khoá và cái sau đè cái trước.

**Triệu chứng:** `/posts/1` trả **404** vì đi tìm bài có `slug = "1"`. Không có cảnh báo nào lúc khởi động.

**Sửa:** dùng **một** route, khai `getRouteKeyName()` ở model.

---

### 14. Route tĩnh bị route động nuốt

```
404 | No query results for model [App\Models\Post] create
```

**Nguyên nhân:** khai `/posts/{post}` **trước** `/posts/create`. URL `posts/create` khớp cả hai, router
lấy cái khai trước.

**Sửa:** route tĩnh luôn đặt **trên** route có tham số.

```php
Route::get('/posts/create', ...);      // trước
Route::get('/posts/{post}', ...);      // sau
```

---

### 15. `Route [login] not defined`

```
Symfony\Component\Routing\Exception\RouteNotFoundException
Route [login] not defined.
```

**Nguyên nhân:** middleware `auth` chặn request HTML và cố chuyển hướng tới route **tên** `login`, mà
bạn chưa đặt tên đó cho route nào.

Nhìn stack trace là thấy rõ nó phát sinh trong `Illuminate\Auth\Middleware\Authenticate.php`.

**Sửa:**

```php
Route::get('/login', [LoginController::class, 'create'])->name('login');
```

Hoặc đổi đích chuyển hướng trong `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->redirectGuestsTo('/dang-nhap');
})
```

---

### 16. `$this->middleware()` không tồn tại

```
Error  Call to undefined method App\Http\Controllers\PostController::middleware()
```

**Nguyên nhân:** `app/Http/Controllers/Controller.php` của bản 13 là lớp trần, **không kế thừa**
`Illuminate\Routing\Controller`:

```php
abstract class Controller
{
    //
}
```

**Sửa** — dùng `HasMiddleware`:

```php
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;

class PostController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            'auth',
            new Middleware('verified', only: ['store', 'update']),
        ];
    }
}
```

---

### 17. `$this->authorize()` không tồn tại

```
Error  Call to undefined method App\Http\Controllers\PostController::authorize()
```

**Nguyên nhân:** cùng gốc với lỗi 16 — lớp cha thiếu trait.

**Sửa:** thêm vào `app/Http/Controllers/Controller.php`:

```php
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

abstract class Controller
{
    use AuthorizesRequests;
}
```

Hoặc bỏ qua trait và dùng `Gate::authorize('update', $post)`.

---

### 18. `Target class does not exist`

```
Illuminate\Contracts\Container\BindingResolutionException
Target class [App\Services\KhongTonTai] does not exist.
```

**Nguyên nhân:** sai namespace, sai tên file, hoặc autoloader chưa biết class mới.

**Sửa theo thứ tự:**

1. Namespace trong file có khớp đường dẫn không? `app/Services/Foo.php` → `namespace App\Services;`
2. Tên class có khớp tên file không (phân biệt hoa thường)?
3. Nạp lại autoloader:

```bash
$ composer dump-autoload
```

---

### 19. Route mới trả 404 dù đã khai

```
Symfony\Component\HttpKernel\Exception\NotFoundHttpException
The route err-vite could not be found.
```

**Nguyên nhân:** route đang bị cache. `php artisan route:cache` (hoặc `optimize`) đã chạy trước đó, và
từ lúc đó Laravel đọc file cache chứ không đọc `routes/web.php`.

**Sửa:**

```bash
$ php artisan optimize:clear
 config .. DONE
 routes .. 0.19ms DONE
 views .. 6.79ms DONE
```

Quy tắc: **không bao giờ chạy `route:cache`/`config:cache` trên máy dev**. Chỉ chạy khi deploy.

---

## Nhóm 4 — Validation, Form, Blade

### 20. FormRequest luôn trả 403

```json
{ "message": "This action is unauthorized." }
```
```
403
```

**Nguyên nhân:** `php artisan make:request` sinh ra `authorize()` trả **`false`**. `authorize()` chạy
**trước** `rules()`, nên bạn không nhận được thông tin gì về validate.

**Sửa:**

```php
public function authorize(): bool
{
    return true;                                              // route đã có middleware auth
    // hoặc
    return $this->user()->can('update', $this->route('post'));
}
```

`php artisan make:policy` cũng sinh mọi method `return false;` — cùng một cái bẫy.

---

### 21. `unique` báo trùng khi sửa chính bản ghi đó

```
The slug has already been taken.
```

**Nguyên nhân:** bản ghi "trùng" chính là bản ghi đang sửa.

**Sửa:**

```php
'slug' => ['required', Rule::unique('posts')->ignore($this->route('post'))],
```

---

### 22. `@empty` trong `@forelse` bị hiểu nhầm

```
Illuminate\View\ViewException
syntax error, unexpected identifier "có" (View: .../resources/views/demo-blade.blade.php)
```

**Nguyên nhân:** `@empty` có hai vai trò. Trong `@forelse` nó **không nhận tham số**; đứng một mình nó
là `@empty($bien)`. Viết `@empty (không có gì)` khiến Blade hiểu `(không có gì)` là biểu thức PHP.

**Sửa:** để `@empty` đứng riêng một dòng.

```blade
@forelse ($posts as $post)
    ...
@empty
    Chưa có bài viết nào.
@endforelse
```

---

### 23. Component Livewire in ra nguyên văn thay vì render

```bash
$ curl -s http://127.0.0.1:8000/counter | grep counter
    <x-⚡counter />              ← không được biên dịch, in thẳng ra HTML
```

**Nguyên nhân:** Livewire 4 đặt file ở `resources/views/components/⚡counter.blade.php`, nhưng emoji chỉ
là **dấu hiệu thư mục**, không phải một phần tên tag.

**Không có exception nào** — Blade coi đó là text thường.

**Sửa:**

```blade
<livewire:counter />        ✅
@livewire('counter')        ✅
<x-⚡counter />              ❌
```

---

### 24. Vite manifest not found

```
Illuminate\Foundation\ViteManifestNotFoundException
Vite manifest not found at: /var/www/public/build/manifest.json
```

**Nguyên nhân:** `@vite(...)` cần file build mà chưa chạy build.

**Sửa:**

```bash
$ npm install
$ npm run build          # production
$ npm run dev            # dev, có hot reload
```

Thêm `npm run build` vào bước deploy, hoặc build trong CI rồi đưa `public/build/` lên server.

---

## Phụ lục — bốn lỗi hay nhầm lẫn nhất

| Mã | Ý nghĩa thật | Không phải là |
|----|-------------|---------------|
| **419 Page Expired** | Thiếu/sai CSRF token | Hết hạn đăng nhập |
| **405 Method Not Allowed** | Route có nhưng sai HTTP method (thiếu `@method('PUT')`) | Route không tồn tại |
| **403 Unauthorized** | Đã đăng nhập nhưng Policy/Gate từ chối | Chưa đăng nhập |
| **401 Unauthenticated** | Chưa đăng nhập / thiếu token | Không đủ quyền |

## Phụ lục — khi "sửa mà không thấy đổi gì"

Chạy theo thứ tự này, dừng lại khi hết lỗi:

```bash
php artisan optimize:clear      # xoá mọi cache: config, route, view, event
composer dump-autoload          # class mới chưa được autoload
php artisan queue:restart       # worker đang chạy code cũ trong bộ nhớ
npm run build                   # CSS/JS chưa build lại
```

Trong đó `queue:restart` là thứ hay bị quên nhất: `php artisan queue:work` nạp framework một lần rồi
giữ trong bộ nhớ, nên nó **luôn** chạy code của lúc nó khởi động. Khi dev, dùng `queue:listen`
(hoặc `php artisan dev`) để tránh hẳn.

---

Tiếp theo: [10-cheatsheet.md](./10-cheatsheet.md).
