# Bài 01 — Vòng đời request, Route và Controller

Mục tiêu: hiểu request đi qua những đâu trước khi tới code của bạn, và viết được route/controller
đúng quy ước để Laravel tự làm hộ phần lớn công việc.

---

## 1. Một request đi qua đâu

Mọi request HTTP — không trừ cái nào — đều vào qua **một file duy nhất**: `public/index.php`.
Đó là lý do khi deploy bạn phải trỏ document root của web server vào thư mục `public/`.

```
Trình duyệt
   ↓
public/index.php            ← điểm vào duy nhất
   ↓
bootstrap/app.php           ← dựng Application, đọc cấu hình
   ↓
Middleware toàn cục         ← ví dụ: xử lý proxy, kiểm tra maintenance mode
   ↓
Router                      ← khớp URL + method với route đã khai
   ↓
Middleware của nhóm/route   ← web (session, CSRF) hoặc auth, throttle...
   ↓
Route model binding         ← biến {post} thành đối tượng Post
   ↓
FormRequest validate        ← nếu tham số controller khai kiểu FormRequest
   ↓
Controller / closure        ← code của bạn
   ↓
Response đi ngược lại qua đúng dãy middleware đó
```

Điểm quan trọng: middleware là **hai chiều**. Cùng một middleware chạy một lần trước controller và
một lần sau. Đó là cách `StartSession` mở session lúc vào và ghi session lúc ra.

---

## 2. Hai file route

| File | Middleware tự động | Tiền tố URL | Dùng cho |
|------|--------------------|-------------|----------|
| `routes/web.php` | nhóm `web`: session, cookie, CSRF | không | Trang có giao diện, form, đăng nhập bằng session |
| `routes/api.php` | nhóm `api`: throttle, không session | `/api` | API trả JSON, xác thực bằng token |

Bản 13 **không sinh sẵn** `routes/api.php` — xem [bài 00 mục 7](./00-chuan-bi.md) để bật.

Sự khác nhau lớn nhất: `web.php` có session nên có CSRF; `api.php` không có session nên mỗi request
phải tự mang token. Đặt nhầm route API vào `web.php` thì mọi `POST` từ client ngoài sẽ bị chặn với:

```
419 | Page Expired
```

Đây là mã lỗi CSRF, không phải lỗi hết hạn đăng nhập — chi tiết ở [bài 04](./04-validation-va-form.md).

---

## 3. Khai route

### Cơ bản

```php
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => view('welcome'))->name('home');
Route::post('/posts', [PostController::class, 'store']);
Route::put('/posts/{post}', [PostController::class, 'update']);
Route::delete('/posts/{post}', [PostController::class, 'destroy']);

// Nhiều method cùng lúc
Route::match(['get', 'post'], '/search', SearchController::class);
```

### Tham số

```php
Route::get('/posts/{post}', ...);              // bắt buộc
Route::get('/posts/{post?}', ...);             // tuỳ chọn — hàm phải có giá trị mặc định
Route::get('/posts/{post}', ...)->whereNumber('post');   // chỉ khớp số
Route::get('/users/{name}', ...)->whereAlpha('name');
Route::get('/p/{slug}', ...)->where('slug', '[a-z0-9\-]+');
```

Ràng buộc `where` không phải để trang trí. Không có nó, `/posts/abc` sẽ đi vào route `{post}` và
Laravel đi tìm bài viết có `id = 'abc'`.

### Đặt tên route — luôn luôn làm

```php
Route::get('/posts/{post}', [PostController::class, 'show'])->name('posts.show');
```

Có tên rồi thì sinh URL bằng tên, không viết chuỗi tay:

```php
route('posts.show', $post)                 // http://localhost:8000/posts/3
route('posts.show', ['post' => 3])         // như trên
```

```blade
<a href="{{ route('posts.show', $post) }}">Xem</a>
```

Lợi ích thật: đổi đường dẫn `/posts/{post}` thành `/bai-viet/{post}` chỉ sửa **một chỗ**, mọi link
trong toàn bộ view tự đổi theo. Viết `href="/posts/{{ $post->id }}"` thì phải đi sửa từng file.

Gõ sai tên route thì lỗi hiện ngay lúc render, không âm thầm ra link hỏng:

```
Symfony\Component\Routing\Exception\RouteNotFoundException
Route [posts.detail] not defined.
```

### Nhóm route

```php
Route::middleware('auth')->prefix('admin')->name('admin.')->group(function () {
    Route::get('/dashboard', fn () => 'dashboard')->name('dashboard');
});
```

Ba thứ cộng dồn: middleware `auth`, URL có tiền tố `admin/`, tên route có tiền tố `admin.`.
Kiểm chứng:

```bash
$ php artisan route:list --except-vendor
 GET|HEAD  admin/dashboard .. admin.dashboard › routes/web.php:11
```

Tên đầy đủ là `admin.dashboard`, gọi bằng `route('admin.dashboard')`. Chú ý dấu chấm cuối trong
`->name('admin.')` — thiếu nó thì tên thành `admindashboard`.

---

## 4. `Route::resource` — 7 route bằng một dòng

```php
Route::resource('posts', PostController::class);
```

```bash
$ php artisan route:list --except-vendor

 GET|HEAD   posts ................. posts.index   › PostController@index
 POST       posts ................. posts.store   › PostController@store
 GET|HEAD   posts/create .......... posts.create  › PostController@create
 GET|HEAD   posts/{post} .......... posts.show    › PostController@show
 PUT|PATCH  posts/{post} .......... posts.update  › PostController@update
 DELETE     posts/{post} .......... posts.destroy › PostController@destroy
 GET|HEAD   posts/{post}/edit ..... posts.edit    › PostController@edit
```

Bảy method này là hợp đồng: đặt đúng tên method trong controller thì không phải khai route nào nữa.

Sinh controller khớp sẵn:

```bash
$ php artisan make:controller PostController --resource --model=Post

 INFO Controller [app/Http/Controllers/PostController.php] created successfully.
```

Cờ `--model=Post` khiến các method nhận thẳng `Post $post` thay vì `$id`:

```php
class PostController extends Controller
{
    public function index() { }
    public function create() { }
    public function store(Request $request) { }
    public function show(Post $post) { }          // ← đã là đối tượng
    public function edit(Post $post) { }
    public function update(Request $request, Post $post) { }
    public function destroy(Post $post) { }
}
```

Bớt route không cần:

```php
Route::resource('posts', PostController::class)->only(['index', 'show']);
Route::resource('posts', PostController::class)->except(['destroy']);

// API: bỏ create và edit (hai route trả form HTML)
Route::apiResource('posts', PostController::class);
```

---

## 5. Route model binding — thứ tiết kiệm nhiều code nhất

### Binding ngầm theo id

```php
Route::get('/posts/{post}', fn (App\Models\Post $post) => $post);
```

Tên tham số route `{post}` **phải trùng** tên biến `$post`. Trùng rồi thì Laravel tự chạy
`Post::findOrFail($value)`.

```bash
$ curl -s -w '\n[%{http_code}]\n' http://127.0.0.1:8000/api/posts/1 -H 'Accept: application/json'
{"id":1,"user_id":1,"category_id":1,"title":"Bai dau tien","slug":"bai-dau-tien", ...}
[200]
```

Không tìm thấy thì **tự trả 404**, bạn không phải viết `if ($post === null)`:

```bash
$ curl -s -w '\n[%{http_code}]\n' http://127.0.0.1:8000/api/posts/9999 -H 'Accept: application/json'
{
    "message": "No query results for model [App\\Models\\Post] 9999"
}
[404]
```

> Thông báo đầy đủ như trên chỉ hiện khi `APP_DEBUG=false`. Để `true` thì Laravel kèm cả stack trace
> dài mấy chục KB. Trên production **bắt buộc** `APP_DEBUG=false`.

### Binding theo cột khác

```php
Route::get('/posts/{post:slug}', fn (App\Models\Post $post) => $post);
```

```bash
$ curl -s -w '\n[%{http_code}]\n' http://127.0.0.1:8000/api/posts/bai-dau-tien -H 'Accept: application/json'
{"id":1,"user_id":1,"title":"Bai dau tien","slug":"bai-dau-tien", ...}
[200]
```

Hoặc đặt mặc định cho cả model:

```php
class Post extends Model
{
    public function getRouteKeyName(): string
    {
        return 'slug';
    }
}
```

> ⚠️ **Bẫy thật, đã đo:** hai route cùng URI thì route khai **sau ghi đè** route khai trước.
>
> ```php
> Route::get('/posts/{post}', ...);        // khai trước
> Route::get('/posts/{post:slug}', ...);   // khai sau
> ```
> ```bash
> $ php artisan route:list --path=posts
>  GET|HEAD  api/posts/{post:slug}  ← chỉ còn 1 route, cái đầu biến mất
>
>  Showing [2] routes
> ```
> Hệ quả: `/api/posts/1` trả **404** vì không có bài viết nào có `slug = "1"`. Không có cảnh báo nào
> khi khởi động, chỉ khi bạn `route:list` mới thấy. Muốn nhận cả hai thì dùng **một** route rồi tự
> phân nhánh trong controller.

### Binding có ràng buộc quan hệ

```php
Route::get('/posts/{post}/comments/{comment}', function (Post $post, Comment $comment) {
    // ...
})->scopeBindings();
```

`scopeBindings()` ép `$comment` phải thuộc về `$post`. Không có nó, `/posts/1/comments/99` vẫn chạy
kể cả khi comment 99 nằm ở bài viết khác — một lỗ hổng phân quyền kinh điển.

---

## 6. Controller

### Controller thường

```bash
$ php artisan make:controller PostController
```

```php
namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PostController extends Controller
{
    public function index(Request $request): View
    {
        $posts = Post::query()
            ->with('author')                       // tránh N+1, xem bài 03
            ->published()
            ->latest('published_at')
            ->paginate(10);

        return view('posts.index', ['posts' => $posts]);
    }

    public function show(Post $post): View
    {
        return view('posts.show', compact('post'));
    }
}
```

### Controller một việc (invokable)

Khi controller chỉ làm đúng một việc, bỏ luôn tên method:

```bash
$ php artisan make:controller SearchController --invokable
```

```php
class SearchController extends Controller
{
    public function __invoke(Request $request)
    {
        return view('search', ['q' => $request->query('q')]);
    }
}
```

```php
Route::get('/search', SearchController::class);     // không cần mảng [Class, 'method']
```

### Middleware ở tầng controller

Laravel 13 không còn gọi `$this->middleware()` trong constructor. Cách đúng là implement
`HasMiddleware`:

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
            new Middleware('throttle:10,1', except: ['index', 'show']),
        ];
    }
}
```

Chép code cũ dạng `$this->middleware('auth')` từ Laravel 8/9 vào sẽ nổ:

```
Error  Call to undefined method App\Http\Controllers\PostController::middleware()
```

Lý do nằm ở `app/Http/Controllers/Controller.php` — bản 13 sinh ra một lớp trần, **không kế thừa**
`Illuminate\Routing\Controller` nữa:

```php
namespace App\Http\Controllers;

abstract class Controller
{
    //
}
```

Nên method `middleware()` đơn giản là không tồn tại. Đừng "sửa" bằng cách cho nó extends lại lớp cũ —
dùng `HasMiddleware` như trên.

---

## 7. Đọc dữ liệu từ request

```php
public function store(Request $request)
{
    $request->input('title');            // từ body hoặc query, ưu tiên body
    $request->query('page', 1);          // chỉ từ query string, có mặc định
    $request->boolean('published');      // "1"/"true"/"on"/"yes" → true
    $request->integer('page');
    $request->date('published_at');      // trả về Carbon
    $request->enum('status', Status::class);

    $request->only(['title', 'body']);
    $request->except(['_token']);

    $request->has('title');              // có gửi lên không (kể cả rỗng)
    $request->filled('title');           // có gửi VÀ khác rỗng
    $request->missing('title');

    $request->file('cover');             // UploadedFile
    $request->user();                    // người đang đăng nhập, hoặc null
    $request->ip();
    $request->header('X-Request-Id');
}
```

Phân biệt `has` với `filled` rất hay dùng khi xử lý form: ô input để trống vẫn được gửi lên với giá
trị `""`, nên `has('title')` là `true` còn `filled('title')` là `false`.

> Đừng đọc `$request->input()` rồi lưu thẳng vào database. Luôn đi qua validate — xem
> [bài 04](./04-validation-va-form.md).

---

## 8. Trả về response

```php
return view('posts.index', ['posts' => $posts]);        // HTML
return response()->json(['data' => $posts]);            // JSON
return response()->json(['ok' => true], 201);           // JSON + status
return redirect()->route('posts.index');                // 302
return redirect()->route('posts.show', $post)
                 ->with('status', 'Đã lưu bài viết');   // kèm flash message
return back()->withInput();                             // quay lại, giữ dữ liệu form
return response()->noContent();                         // 204
return response()->download($path);
return abort(403, 'Bạn không có quyền');
```

Trả thẳng model hoặc collection thì Laravel tự chuyển thành JSON:

```php
Route::get('/posts/{post}', fn (Post $post) => $post);
```

Nhưng cách này lộ hết mọi cột, kể cả cột bạn không muốn công khai. Dùng **API Resource** để kiểm soát:

```bash
$ php artisan make:resource PostResource
```

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slug,
            'published_at' => $this->published_at?->toIso8601String(),
            'author'       => $this->whenLoaded('author', fn () => [
                'id'   => $this->author->id,
                'name' => $this->author->name,
            ]),
        ];
    }
}
```

```php
return PostResource::collection($posts);       // nhiều
return new PostResource($post);                // một
```

`whenLoaded` chỉ thêm khoá `author` khi quan hệ đã được eager load — nhờ vậy Resource không tự gây
thêm query N+1.

---

## 9. Middleware tự viết

```bash
$ php artisan make:middleware EnsureUserIsAdmin

 INFO Middleware [app/Http/Middleware/EnsureUserIsAdmin.php] created successfully.
```

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user()?->is_admin) {
            abort(403, 'Chỉ quản trị viên mới vào được.');
        }

        return $next($request);       // ← đi tiếp vào controller
    }
}
```

Đăng ký bí danh trong `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->alias([
        'admin' => \App\Http\Middleware\EnsureUserIsAdmin::class,
    ]);
})
```

```php
Route::middleware(['auth', 'admin'])->group(function () { /* ... */ });
```

Các cách gắn khác trong cùng `withMiddleware`:

```php
$middleware->append(TrimStrings::class);           // chạy cuối, cho MỌI request
$middleware->prepend(SetLocale::class);            // chạy đầu
$middleware->web(append: [MyWebMiddleware::class]);   // chỉ nhóm web
$middleware->api(prepend: [ForceJsonResponse::class]);
$middleware->remove(ValidateCsrfToken::class);     // gỡ middleware mặc định
```

---

## 10. Bốn lỗi HTTP hay gặp và ý nghĩa thật

Chạy thật để nhớ mặt chúng (`APP_DEBUG=false`):

```bash
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/khong-ton-tai
404
```

```bash
$ curl -s -X DELETE http://127.0.0.1:8000/api/posts/1 -H 'Accept: application/json'
{
    "message": "The DELETE method is not supported for route api/posts/1. Supported methods: GET, HEAD."
}
```
→ **405**: route tồn tại nhưng bạn gọi sai HTTP method. Thường do form HTML chỉ gửi được `GET`/`POST`
— xem cách xử lý bằng `@method('DELETE')` ở [bài 02](./02-blade-va-giao-dien.md).

```bash
$ curl -s http://127.0.0.1:8000/api/user -H 'Accept: application/json'
{"message":"Unauthenticated."}
```
→ **401**: chưa đăng nhập / thiếu token.

```
419 | Page Expired
```
→ **419**: thiếu CSRF token. Không phải hết phiên đăng nhập.

---

## 11. Đọc `route:list` cho hiệu quả

```bash
php artisan route:list                    # tất cả, kể cả route của package
php artisan route:list --except-vendor    # chỉ route của bạn — dùng cái này
php artisan route:list --path=posts       # lọc theo URL
php artisan route:list --name=admin       # lọc theo tên
php artisan route:list --method=POST
php artisan route:list -v                 # hiện cả middleware của từng route
```

`--except-vendor` là cờ đáng nhớ nhất: sau khi cài Livewire, `route:list` trần có thêm 11 route rác
của package làm bạn không thấy route của mình.

---

## Bài tập

1. Khai `Route::resource('posts', PostController::class)` rồi chạy `php artisan route:list --except-vendor`.
   Đếm xem có bao nhiêu route, và chỉ ra route nào **không** cần khi làm API thuần.

2. Tạo nhóm route `admin` có `prefix`, `name` và middleware `auth`. Xác nhận bằng `route:list` rằng tên
   đầy đủ là `admin.dashboard`. Sau đó bỏ dấu chấm trong `->name('admin.')` và xem tên đổi thành gì.

3. Khai liên tiếp hai route `/posts/{post}` và `/posts/{post:slug}`. Chạy `route:list --path=posts`,
   giải thích vì sao chỉ còn một route và `/posts/1` trả 404.

4. Viết middleware `EnsureUserIsAdmin`, gắn vào một route, rồi `curl` vào khi chưa đăng nhập. Ghi lại
   mã trạng thái và thông báo.

5. Tạo route `/posts/{post}/comments/{comment}`. Thử truy cập với một `comment` **không** thuộc `post`
   đó. Thêm `->scopeBindings()` và thử lại. So sánh hai kết quả.

<details>
<summary>Gợi ý đáp án</summary>

**1.** 7 route. API thuần không cần `posts.create` và `posts.edit` — hai route đó chỉ để trả **form
HTML**. Dùng `Route::apiResource()` để bỏ luôn cả hai.

**2.** Bỏ dấu chấm thì tên thành `admindashboard`, và `route('admin.dashboard')` nổ:
```
Symfony\Component\Routing\Exception\RouteNotFoundException
Route [admin.dashboard] not defined.
```

**3.** Router lưu route theo khoá `method + URI`. Hai route trên cùng sinh ra khoá `GET api/posts/{post}`
(phần `:slug` chỉ là chỉ dẫn binding, không nằm trong khoá), nên cái sau ghi đè cái trước. `route:list`
hiện đúng một dòng `GET|HEAD api/posts/{post:slug}`.

**5.** Không có `scopeBindings()`: trả **200** và hiện comment của bài viết khác — lỗi rò rỉ dữ liệu.
Có `scopeBindings()`: trả **404**, vì Laravel truy vấn `$post->comments()->where('id', ...)` thay vì
`Comment::find(...)`.

</details>

---

Tiếp theo: [02-blade-va-giao-dien.md](./02-blade-va-giao-dien.md) — dựng giao diện.
