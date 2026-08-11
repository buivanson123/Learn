# Bài 05 — Xác thực và Phân quyền

Hai việc khác nhau, hay bị gộp làm một:

- **Xác thực (authentication)** — bạn là ai? Sai → **401**.
- **Phân quyền (authorization)** — bạn được làm gì? Sai → **403**.

Laravel tách hẳn hai việc này thành hai hệ thống. Bài này làm auth bằng **session** (phù hợp cho Blog
dùng Blade + Livewire). Auth bằng token cho API dùng Sanctum, xem
[nang-cao/06-bao-mat.md](./nang-cao/06-bao-mat.md).

---

## 1. Nền tảng đã có sẵn

Laravel 13 sinh sẵn mọi thứ cần cho auth:

- Bảng `users`, `password_reset_tokens`, `sessions` — trong migration `0001_01_01_000000_create_users_table.php`.
- Model `User extends Authenticatable` với `#[Hidden(['password', 'remember_token'])]` và cast
  `'password' => 'hashed'`.
- `config/auth.php` với guard `web` dùng driver `session`.

Cái **không** có sẵn: controller và view đăng nhập/đăng ký. Bạn tự viết (mục 2), hoặc dùng starter kit:

```bash
$ laravel new blog          # installer sẽ hỏi chọn starter kit (Livewire / React / Vue)
```

Tài liệu này viết tay để bạn hiểu từng bước — starter kit chỉ là các bước này được sinh sẵn.

---

## 2. Đăng ký, đăng nhập, đăng xuất

### Route

```php
// routes/web.php
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;

Route::middleware('guest')->group(function () {
    Route::get('/register', [RegisterController::class, 'create'])->name('register');
    Route::post('/register', [RegisterController::class, 'store']);
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
});

Route::post('/logout', [LoginController::class, 'destroy'])
    ->middleware('auth')->name('logout');
```

Middleware `guest` đá người **đã** đăng nhập ra khỏi trang login. Không có nó, người dùng đã đăng nhập
vẫn vào được `/login` và đăng nhập chồng lên.

### Đăng ký

```php
namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;

class RegisterController extends Controller
{
    public function create()
    {
        return view('auth.register');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:100'],
            'email'    => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);

        $user = User::create($data);       // password tự băm nhờ cast 'hashed'

        event(new Registered($user));      // kích hoạt gửi mail xác minh nếu bật
        auth()->login($user);
        $request->session()->regenerate();

        return redirect()->route('home')->with('status', 'Chào mừng bạn đến với Blog!');
    }
}
```

> **Đừng** gọi `Hash::make($data['password'])` ở đây. Model `User` đã cast `'password' => 'hashed'`,
> nên Laravel tự băm. Băm hai lần thì mật khẩu lưu vào database là hash-của-hash, và người dùng
> **không bao giờ đăng nhập được** — mà không có lỗi nào, chỉ là "Thông tin đăng nhập không đúng".

### Đăng nhập

```php
class LoginController extends Controller
{
    public function create()
    {
        return view('auth.login');
    }

    public function store(Request $request)
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (! auth()->attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => 'Email hoặc mật khẩu không đúng.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('home'));
    }

    public function destroy(Request $request)
    {
        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}
```

Bốn dòng quan trọng, đừng bỏ dòng nào:

| Dòng | Vì sao |
|------|--------|
| `session()->regenerate()` sau khi đăng nhập | Chống **session fixation** — kẻ tấn công đặt sẵn session id rồi chờ nạn nhân đăng nhập vào chính session đó |
| `redirect()->intended(...)` | Đưa người dùng về đúng trang họ định vào trước khi bị đá ra login |
| `session()->invalidate()` khi logout | Xoá sạch dữ liệu session cũ |
| `session()->regenerateToken()` khi logout | Cấp CSRF token mới |

Báo lỗi bằng `ValidationException::withMessages` thay vì `back()->withErrors()` để lỗi hiện đúng chỗ
ô email, và trả 422 khi request là JSON.

### View đăng nhập

```blade
<x-layouts.app title="Đăng nhập">
    <form method="POST" action="{{ route('login') }}" class="max-w-sm space-y-4">
        @csrf

        <div>
            <label for="email">Email</label>
            <input type="email" id="email" name="email" value="{{ old('email') }}" required autofocus
                   class="mt-1 w-full rounded border px-3 py-2">
            @error('email') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="password">Mật khẩu</label>
            <input type="password" id="password" name="password" required
                   class="mt-1 w-full rounded border px-3 py-2">
        </div>

        <label class="flex items-center gap-2">
            <input type="checkbox" name="remember" value="1" @checked(old('remember'))>
            <span>Ghi nhớ đăng nhập</span>
        </label>

        <button type="submit" class="w-full rounded bg-blue-600 px-4 py-2 text-white">Đăng nhập</button>
    </form>
</x-layouts.app>
```

Nút đăng xuất phải là **form POST**, không phải link:

```blade
<form method="POST" action="{{ route('logout') }}">
    @csrf
    <button type="submit">Đăng xuất</button>
</form>
```

Link `GET /logout` cho phép trang khác nhúng `<img src="https://blog.test/logout">` để đăng xuất người
dùng của bạn.

### Chống dò mật khẩu

```php
Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:5,1');
```

5 lần thử mỗi phút mỗi IP. Vượt quá:

```
429 | Too Many Requests
```

---

## 3. Đọc người dùng hiện tại

```php
auth()->check();              // true/false
auth()->guest();
auth()->user();               // model User hoặc null
auth()->id();
$request->user();             // giống auth()->user(), gọn hơn trong controller
```

```blade
@auth
    Chào {{ auth()->user()->name }}
@endauth

@guest
    <a href="{{ route('login') }}">Đăng nhập</a>
@endguest
```

Trong controller **luôn dùng `$request->user()`** thay vì `auth()->user()` — dễ test hơn và không phụ
thuộc trạng thái toàn cục.

---

## 4. Bảo vệ route

```php
Route::middleware('auth')->group(function () {
    Route::get('/posts/create', [PostController::class, 'create']);
    Route::post('/posts', [PostController::class, 'store']);
});
```

Chưa đăng nhập:

- Request HTML → chuyển hướng tới route tên `login`. **Nếu bạn không đặt route nào tên `login`** thì
  nổ:
  ```
  Symfony\Component\Routing\Exception\RouteNotFoundException
  Route [login] not defined.
  ```
- Request JSON → `401 {"message":"Unauthenticated."}`

Các middleware auth khác:

```php
'auth'              // phải đăng nhập
'guest'             // phải CHƯA đăng nhập
'verified'          // phải đã xác minh email
'password.confirm'  // buộc nhập lại mật khẩu cho hành động nhạy cảm
'throttle:60,1'
```

---

## 5. Phân quyền: Gate

Gate hợp cho quyền **không gắn với model cụ thể**.

```php
// AppServiceProvider::boot()
use Illuminate\Support\Facades\Gate;

Gate::define('access-admin', fn (User $user) => $user->is_admin);
```

```php
Gate::allows('access-admin');       // bool
Gate::denies('access-admin');
Gate::authorize('access-admin');    // ném exception → 403
```

```blade
@can('access-admin')
    <a href="{{ route('admin.dashboard') }}">Quản trị</a>
@endcan
```

```php
Route::middleware('can:access-admin')->group(function () { ... });
```

---

## 6. Phân quyền: Policy — dùng cho quyền trên model

```bash
$ php artisan make:policy PostPolicy --model=Post

 INFO Policy [app/Policies/PostPolicy.php] created successfully.
```

> ⚠️ Cũng như `FormRequest`, mọi method sinh ra đều `return false;`. Không sửa thì **mọi hành động
> đều 403**.

```php
namespace App\Policies;

use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    public function viewAny(?User $user): bool
    {
        return true;
    }

    public function view(?User $user, Post $post): bool
    {
        return $post->status === 'published' || $user?->id === $post->user_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id || $user->is_admin;
    }
}
```

### Không cần đăng ký policy

Laravel 13 tự tìm: model `App\Models\Post` → policy `App\Policies\PostPolicy`. Kiểm chứng:

```bash
$ php artisan model:show Post

 App\Models\Post ..
 Database .. pgsql
 Table .. posts
 Policy .. App\Policies\PostPolicy          ← đã nhận ra, không khai ở đâu cả
```

Đặt sai tên hoặc sai thư mục thì dòng `Policy` trống, và mọi `authorize()` báo:

```
Illuminate\Auth\Access\AuthorizationException  This action is unauthorized.
```

Khi phải đặt khác quy ước, khai bằng attribute trên model:

```php
use Illuminate\Database\Eloquent\Attributes\UsePolicy;

#[UsePolicy(BaiVietPolicy::class)]
class Post extends Model {}
```

### Gọi policy

Ba cách, chọn theo ngữ cảnh:

```php
// 1. Trong controller — ném 403 nếu không được phép
public function update(UpdatePostRequest $request, Post $post)
{
    $this->authorize('update', $post);        // cần trait AuthorizesRequests
    // ...
}

// 2. Trong FormRequest — gọn nhất, chạy trước cả validate
public function authorize(): bool
{
    return $this->user()->can('update', $this->route('post'));
}

// 3. Ở route
Route::put('/posts/{post}', ...)->middleware('can:update,post');
```

> `$this->authorize()` cần trait `Illuminate\Foundation\Auth\Access\AuthorizesRequests`. Lớp
> `App\Http\Controllers\Controller` của bản 13 là lớp trần **không** có trait đó. Thêm vào lớp cha:
> ```php
> abstract class Controller
> {
>     use \Illuminate\Foundation\Auth\Access\AuthorizesRequests;
> }
> ```
> Không thêm thì:
> ```
> Error  Call to undefined method App\Http\Controllers\PostController::authorize()
> ```
> Hoặc bỏ qua hẳn và dùng `Gate::authorize('update', $post)` — không cần trait nào.

### Đo thật

Với `PostPolicy::update()` trả `false`:

```bash
$ curl -s -w '\n[%{http_code}]\n' http://127.0.0.1:8000/api/gate-demo/1 -H 'Accept: application/json'
{
    "message": "This action is unauthorized."
}
[403]
```

Đổi thành `return $user->id === $post->user_id;` và đăng nhập bằng chính tác giả:

```bash
$ curl -s -w '\n[%{http_code}]\n' http://127.0.0.1:8000/api/gate-demo/1 -H 'Accept: application/json'
{"ok":true}
[200]
```

### Trong Blade

```blade
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Sửa</a>
@endcan

@cannot('update', $post)
    <span class="text-gray-400">Bạn không sửa được bài này</span>
@endcannot

@can('create', App\Models\Post::class)     {{-- method không nhận model → truyền tên class --}}
    <a href="{{ route('posts.create') }}">Viết bài</a>
@endcan
```

### Lọc danh sách theo quyền

`@can` chỉ ẩn nút, **không** lọc dữ liệu. Muốn người dùng chỉ thấy bài của mình:

```php
$posts = $request->user()->posts()->latest()->paginate(10);
```

Đừng lấy `Post::all()` rồi lọc bằng `@can` trong vòng lặp — dữ liệu vẫn đi qua mạng và vẫn lộ trong
số đếm phân trang.

### Thông báo 403 dễ hiểu hơn

```php
use Illuminate\Auth\Access\Response;

public function update(User $user, Post $post): Response
{
    return $user->id === $post->user_id
        ? Response::allow()
        : Response::deny('Bạn chỉ sửa được bài viết của chính mình.');
}
```

### Quyền tuyệt đối cho admin

```php
// AppServiceProvider::boot()
Gate::before(fn (User $user, string $ability) => $user->is_admin ? true : null);
```

Trả `null` để các policy khác tiếp tục chạy bình thường. Trả `false` sẽ **chặn hết mọi người** — kể cả
những quyền policy đã cho phép.

---

## 7. Xác minh email

```php
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    // ...
}
```

```php
Route::get('/email/verify/{id}/{hash}', function (EmailVerificationRequest $request) {
    $request->fulfill();
    return redirect()->route('home');
})->middleware(['auth', 'signed'])->name('verification.verify');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/posts/create', ...);
});
```

Middleware `signed` kiểm tra chữ ký trong URL — nhờ đó không ai tự bịa được link xác minh. Sửa URL
một ký tự thì:

```
403 | Invalid signature.
```

---

## 8. Bảng tóm tắt

| Tình huống | Mã | Cách xử lý |
|-----------|-----|-----------|
| Chưa đăng nhập, request HTML | 302 → `/login` | middleware `auth` |
| Chưa đăng nhập, request JSON | 401 | middleware `auth` |
| Đã đăng nhập nhưng không đủ quyền | 403 | Policy / Gate |
| Sai CSRF token | 419 | `@csrf` |
| Thử đăng nhập quá nhiều | 429 | `throttle:5,1` |
| Link xác minh bị sửa | 403 | middleware `signed` |
| Dữ liệu form sai | 422 (JSON) / 302 (HTML) | FormRequest |

---

## Bài tập

1. Viết đầy đủ đăng ký + đăng nhập + đăng xuất. Kiểm tra rằng sau khi đăng ký, người dùng đã ở trạng
   thái đăng nhập luôn.

2. Cố tình gọi `Hash::make()` trong `RegisterController::store()` **cùng với** cast `'password' => 'hashed'`.
   Đăng ký rồi thử đăng nhập. Mô tả triệu chứng và giải thích.

3. Bỏ `$request->session()->regenerate()` sau khi đăng nhập. Đọc lại mục 2 và giải thích rủi ro cụ thể.

4. Tạo `PostPolicy` bằng `make:policy --model=Post`, **không sửa gì**, rồi thử vào trang sửa bài của
   chính mình. Ghi lại mã trạng thái. Sau đó sửa `update()` cho đúng và thử lại.

5. Chạy `php artisan model:show Post` và chỉ ra dòng chứng minh Laravel đã tự tìm ra policy. Đổi tên
   file policy thành `PostPolicies.php` rồi chạy lại lệnh — dòng đó đổi thế nào?

6. Thêm `Gate::before()` cho admin. Thử với một user thường và một user admin trên cùng một bài viết
   của người khác.

7. Gắn `throttle:5,1` vào route login. Gửi 6 request đăng nhập sai liên tiếp bằng `curl` và ghi lại mã
   trạng thái của lần thứ 6.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Mật khẩu bị băm hai lần. Database lưu `bcrypt(bcrypt('matkhau'))`. Khi đăng nhập,
`auth()->attempt()` so `bcrypt('matkhau')` với giá trị đó → không khớp. Triệu chứng: đăng ký thành
công, nhưng đăng nhập luôn báo "Email hoặc mật khẩu không đúng" và **không có exception nào**. Đây là
lý do phải biết model có cast `hashed` hay không trước khi viết controller.

**3.** Không đổi session id sau khi đăng nhập → **session fixation**. Kẻ tấn công gửi cho nạn nhân một
link kèm session id do chúng chọn; nạn nhân đăng nhập vào chính session đó; kẻ tấn công dùng lại
session id đã biết và vào được tài khoản.

**4.** `403 This action is unauthorized.` — `make:policy` sinh mọi method `return false;`.

**5.** Trước: `Policy .. App\Policies\PostPolicy`. Sau khi đổi tên file (và tên class), dòng `Policy`
biến mất khỏi output, và mọi `authorize()` trả 403.

**7.** Lần thứ 6: `429 Too Many Requests`, kèm header `Retry-After`.

</details>

---

Tiếp theo: [06-livewire-4.md](./06-livewire-4.md) — làm giao diện động không cần JavaScript.
