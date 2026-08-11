# Bài 08 — Dự án: Blog full-stack

Ghép tất cả 8 bài trước thành một ứng dụng chạy được. Mọi đoạn code ở đây dựa trên các cơ chế đã được
kiểm chứng ở các bài trước — chỗ nào có bẫy đều có liên kết ngược lại bài giải thích.

**Kết quả cuối:** blog có trang công khai (danh sách, chi tiết, bình luận), đăng ký/đăng nhập, và khu
quản trị dùng Livewire 4 để tìm kiếm/lọc/xoá không reload trang.

---

## 0. Cấu trúc thư mục đích

```
app/
├── Enums/PostStatus.php
├── Events/PostWasPublished.php
├── Http/
│   ├── Controllers/
│   │   ├── Auth/{LoginController,RegisterController}.php
│   │   ├── CommentController.php
│   │   ├── Controller.php              ← thêm trait AuthorizesRequests
│   │   └── PostController.php
│   └── Requests/{StorePostRequest,UpdatePostRequest,StoreCommentRequest}.php
├── Jobs/SendPostPublishedNotification.php
├── Listeners/NotifySubscribers.php
├── Mail/PostPublished.php
├── Models/{User,Post,Category,Comment}.php
├── Policies/{PostPolicy,CommentPolicy}.php
└── Providers/AppServiceProvider.php    ← bật shouldBeStrict()

database/
├── factories/{UserFactory,PostFactory,CategoryFactory,CommentFactory}.php
├── migrations/
└── seeders/DatabaseSeeder.php

resources/views/
├── components/
│   ├── ⚡post-manager.blade.php        ← Livewire: quản trị bài viết
│   ├── ⚡comment-form.blade.php        ← Livewire: gửi bình luận
│   ├── layouts/app.blade.php
│   ├── alert.blade.php
│   ├── badge.blade.php
│   └── post-card.blade.php
├── auth/{login,register}.blade.php
├── mail/posts/published.blade.php
└── posts/{index,show,create,edit}.blade.php

routes/{web.php,console.php}
```

---

## 1. Dựng nền

```bash
$ composer create-project laravel/laravel blog
$ cd blog
$ composer require livewire/livewire

$ docker run -d --name blog-pg \
    -e POSTGRES_USER=blog -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=blog \
    -p 55433:5432 postgres:18-alpine
$ docker exec blog-pg pg_isready -U blog
/var/run/postgresql:5432 - accepting connections
```

`.env`:

```ini
APP_NAME="Blog"
APP_LOCALE=vi

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=55433
DB_DATABASE=blog
DB_USERNAME=blog
DB_PASSWORD=secret

QUEUE_CONNECTION=database
CACHE_STORE=database
MAIL_MAILER=log
```

`phpunit.xml` — cho test chạy đúng loại database ([bài 06 mục 10](./06-livewire-4.md)):

```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="blog_test"/>
```

### Bật chế độ nghiêm ngặt ngay từ đầu

`app/Providers/AppServiceProvider.php`:

```php
namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Model::shouldBeStrict(! app()->isProduction());
    }
}
```

Một dòng này bật cùng lúc: chặn N+1, chặn bỏ cột im lặng, chặn đọc thuộc tính không tồn tại. Bật bây
giờ dễ hơn bật sau khi đã có 50 file ([bài 03 mục 9](./03-database-va-eloquent.md)).

### Lớp Controller cha

`app/Http/Controllers/Controller.php` của bản 13 là lớp trần. Thêm trait để dùng được `$this->authorize()`:

```php
namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

abstract class Controller
{
    use AuthorizesRequests;
}
```

---

## 2. Migration

Thứ tự quan trọng — `categories` phải chạy **trước** `posts` ([bài 03 mục 1](./03-database-va-eloquent.md)).

```bash
$ php artisan make:migration create_categories_table
$ php artisan make:migration create_posts_table
$ php artisan make:migration create_comments_table
```

```php
// ..._create_categories_table.php
Schema::create('categories', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('slug')->unique();
    $table->timestamps();
});
```

```php
// ..._create_posts_table.php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
    $table->string('title');
    $table->string('slug')->unique();
    $table->text('body');
    $table->string('status')->default('draft');
    $table->timestamp('published_at')->nullable();
    $table->unsignedInteger('views')->default(0);
    $table->timestamps();

    $table->index(['status', 'published_at']);
});
```

```php
// ..._create_comments_table.php
Schema::create('comments', function (Blueprint $table) {
    $table->id();
    $table->foreignId('post_id')->constrained()->cascadeOnDelete();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->text('body');
    $table->timestamps();
});
```

Chỉ mục `['status', 'published_at']` không phải để cho đẹp: mọi trang công khai đều lọc theo `status`
rồi sắp theo `published_at`.

```bash
$ php artisan migrate

 INFO Running migrations.

 2026_08_18_133650_create_categories_table .. 5.02ms DONE
 2026_08_18_133655_create_posts_table ....... 12.32ms DONE
 2026_08_18_133656_create_comments_table .... 5.99ms DONE
```

---

## 3. Enum và Model

```bash
$ php artisan make:enum Enums/PostStatus --string
```

```php
namespace App\Enums;

enum PostStatus: string
{
    case Draft     = 'draft';
    case Published = 'published';

    public function label(): string
    {
        return match ($this) {
            self::Draft     => 'Bản nháp',
            self::Published => 'Đã đăng',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Draft     => 'gray',
            self::Published => 'green',
        };
    }
}
```

### Post

```php
namespace App\Models;

use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['title', 'slug', 'body', 'status', 'published_at', 'category_id'])]
class Post extends Model
{
    /** @use HasFactory<\Database\Factories\PostFactory> */
    use HasFactory;

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'status'       => PostStatus::class,
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    #[Scope]
    protected function published(Builder $query): void
    {
        $query->where('status', PostStatus::Published)->whereNotNull('published_at');
    }

    #[Scope]
    protected function search(Builder $query, string $term): void
    {
        $query->where(fn ($q) => $q->where('title', 'ilike', "%{$term}%")
                                   ->orWhere('body', 'ilike', "%{$term}%"));
    }
}
```

Hai điểm cố ý:

- `user_id` **không** nằm trong `#[Fillable]`. Tác giả lấy từ phiên đăng nhập, không từ form
  ([bài 03 mục 3](./03-database-va-eloquent.md)).
- `getRouteKeyName()` trả `'slug'` để URL là `/posts/hoc-laravel-13`. Nhờ khai ở model thay vì viết
  `{post:slug}` ở route, ta tránh được cái bẫy hai route trùng URI
  ([bài 01 mục 5](./01-routing-va-controller.md)).

### Các model còn lại

```php
#[Fillable(['name', 'slug'])]
class Category extends Model
{
    use HasFactory;

    public function getRouteKeyName(): string { return 'slug'; }

    public function posts(): HasMany { return $this->hasMany(Post::class); }
}
```

```php
#[Fillable(['body'])]
class Comment extends Model
{
    use HasFactory;

    public function post(): BelongsTo { return $this->belongsTo(Post::class); }
    public function author(): BelongsTo { return $this->belongsTo(User::class, 'user_id'); }
}
```

```php
// app/Models/User.php — thêm vào phần Laravel sinh sẵn
public function posts(): HasMany
{
    return $this->hasMany(Post::class);
}

public function comments(): HasMany
{
    return $this->hasMany(Comment::class);
}
```

Kiểm tra Laravel đã hiểu đúng:

```bash
$ php artisan model:show Post

 App\Models\Post ..
 Table .. posts
 Policy .. App\Policies\PostPolicy

 Attributes .. type / cast
 user_id .. bigint                                       ← không fillable, đúng ý đồ
 title fillable .. character varying(255)
 status fillable .. character varying(255) / App\Enums\PostStatus
 published_at nullable, fillable .. timestamp(0) / datetime

 Relations ..
 author BelongsTo .. App\Models\User
 category BelongsTo .. App\Models\Category
 comments HasMany .. App\Models\Comment
```

---

## 4. Factory và Seeder

```php
namespace Database\Factories;

use App\Enums\PostStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PostFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->sentence();

        return [
            'user_id'      => \App\Models\User::factory(),
            'category_id'  => \App\Models\Category::factory(),
            'title'        => $title,
            'slug'         => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 999999),
            'body'         => fake()->paragraphs(5, true),
            'status'       => PostStatus::Published,
            'published_at' => fake()->dateTimeBetween('-1 year'),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => [
            'status' => PostStatus::Draft,
            'published_at' => null,
        ]);
    }
}
```

```php
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::factory()->create([
            'name'  => 'Quản trị',
            'email' => 'admin@blog.test',
            'password' => 'password',          // tự băm nhờ cast 'hashed'
        ]);

        $author = User::factory()->create([
            'name' => 'Tác giả', 'email' => 'author@blog.test', 'password' => 'password',
        ]);

        $categories = collect(['Backend', 'Frontend', 'DevOps', 'Cơ sở dữ liệu'])
            ->map(fn ($name) => Category::create(['name' => $name, 'slug' => Str::slug($name)]));

        Post::factory()->count(40)
            ->recycle([$admin, $author, ...$categories])
            ->has(Comment::factory()->count(3)->recycle([$admin, $author]), 'comments')
            ->create();

        Post::factory()->draft()->count(6)
            ->recycle([$author, ...$categories])
            ->create();
    }
}
```

> **Đừng** gọi `Hash::make('password')` ở đây. Model `User` đã cast `'password' => 'hashed'`, băm hai
> lần thì không đăng nhập được ([bài 05 mục 2](./05-auth-va-phan-quyen.md)).

```bash
$ php artisan migrate:fresh --seed
```

---

## 5. Policy

```bash
$ php artisan make:policy PostPolicy --model=Post
$ php artisan make:policy CommentPolicy --model=Comment
```

Nhớ: `make:policy` sinh mọi method `return false;` — không sửa thì mọi thứ 403
([bài 05 mục 6](./05-auth-va-phan-quyen.md)).

```php
namespace App\Policies;

use App\Enums\PostStatus;
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
        return $post->status === PostStatus::Published || $user?->id === $post->user_id;
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
        return $user->id === $post->user_id;
    }
}
```

```php
class CommentPolicy
{
    public function delete(User $user, Comment $comment): bool
    {
        return $user->id === $comment->user_id || $user->id === $comment->post->user_id;
    }
}
```

Tác giả bài viết xoá được bình luận trong bài của mình — đó là lý do dòng trên có hai vế.

---

## 6. Route

```php
// routes/web.php
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\PostController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PostController::class, 'index'])->name('home');
Route::get('/posts', [PostController::class, 'index'])->name('posts.index');

Route::middleware('guest')->group(function () {
    Route::get('/register', [RegisterController::class, 'create'])->name('register');
    Route::post('/register', [RegisterController::class, 'store']);
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->middleware('throttle:5,1');
});

Route::post('/logout', [LoginController::class, 'destroy'])->middleware('auth')->name('logout');

Route::middleware('auth')->group(function () {
    Route::get('/posts/create', [PostController::class, 'create'])->name('posts.create');
    Route::post('/posts', [PostController::class, 'store'])->name('posts.store');
    Route::get('/posts/{post}/edit', [PostController::class, 'edit'])->name('posts.edit');
    Route::put('/posts/{post}', [PostController::class, 'update'])->name('posts.update');
    Route::delete('/posts/{post}', [PostController::class, 'destroy'])->name('posts.destroy');

    Route::delete('/comments/{comment}', [CommentController::class, 'destroy'])->name('comments.destroy');

    Route::view('/admin/posts', 'admin.posts')->name('admin.posts');
});

// ĐẶT CUỐI CÙNG — nếu không, /posts/create sẽ khớp vào đây và đi tìm bài có slug "create"
Route::get('/posts/{post}', [PostController::class, 'show'])->name('posts.show');
```

> ⚠️ Thứ tự route quan trọng. `/posts/create` và `/posts/{post}` cùng khớp URL `posts/create`. Router
> lấy route khai **trước**. Đặt `{post}` lên trên thì bấm "Viết bài" sẽ ra:
> ```
> 404 | No query results for model [App\Models\Post] create
> ```

```bash
$ php artisan route:list --except-vendor | head -12

 GET|HEAD   / ................................ home › PostController@index
 GET|HEAD   admin/posts ..................... admin.posts
 POST       comments/{comment} .............. comments.destroy › CommentController@destroy
 GET|HEAD   login ........................... login › Auth\LoginController@create
 POST       login ........................... Auth\LoginController@store
 POST       logout .......................... logout › Auth\LoginController@destroy
 GET|HEAD   posts ........................... posts.index › PostController@index
 POST       posts ........................... posts.store › PostController@store
 GET|HEAD   posts/create .................... posts.create › PostController@create
 GET|HEAD   posts/{post} .................... posts.show › PostController@show
```

---

## 7. Controller

```php
namespace App\Http\Controllers;

use App\Enums\PostStatus;
use App\Events\PostWasPublished;
use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Models\Category;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PostController extends Controller
{
    public function index(Request $request): View
    {
        $posts = Post::query()
            ->with(['author:id,name', 'category:id,name,slug'])
            ->withCount('comments')
            ->published()
            ->when($request->filled('category'), fn ($q) =>
                $q->whereRelation('category', 'slug', $request->string('category'))
            )
            ->when($request->filled('q'), fn ($q) =>
                $q->search($request->string('q'))
            )
            ->latest('published_at')
            ->paginate(10)
            ->withQueryString();

        return view('posts.index', [
            'posts'      => $posts,
            'categories' => Category::orderBy('name')->get(),
        ]);
    }

    public function show(Post $post): View
    {
        $this->authorize('view', $post);

        $post->load(['author:id,name', 'category:id,name,slug', 'comments.author:id,name']);
        $post->increment('views');

        return view('posts.show', compact('post'));
    }

    public function create(): View
    {
        $this->authorize('create', Post::class);

        return view('posts.create', ['categories' => Category::orderBy('name')->get()]);
    }

    public function store(StorePostRequest $request)
    {
        $post = $request->user()->posts()->create($request->validated());

        if ($post->status === PostStatus::Published) {
            PostWasPublished::dispatch($post);
        }

        return redirect()->route('posts.show', $post)->with('status', 'Đã đăng bài viết.');
    }

    public function edit(Post $post): View
    {
        $this->authorize('update', $post);

        return view('posts.edit', [
            'post'       => $post,
            'categories' => Category::orderBy('name')->get(),
        ]);
    }

    public function update(UpdatePostRequest $request, Post $post)
    {
        $wasDraft = $post->status === PostStatus::Draft;

        $post->update($request->validated());

        if ($wasDraft && $post->status === PostStatus::Published) {
            PostWasPublished::dispatch($post);
        }

        return redirect()->route('posts.show', $post)->with('status', 'Đã lưu thay đổi.');
    }

    public function destroy(Post $post)
    {
        $this->authorize('delete', $post);

        $post->delete();

        return redirect()->route('posts.index')->with('status', 'Đã xoá bài viết.');
    }
}
```

Ba chi tiết đáng chú ý:

- `$request->user()->posts()->create(...)` — `user_id` được điền qua quan hệ, không qua mảng, đúng như
  thiết kế `#[Fillable]` ở mục 3.
- `with(['author:id,name'])` — chỉ lấy 2 cột. Trang danh sách 10 bài không cần nạp cả email của tác giả.
- `withCount('comments')` — đếm bằng subquery, không nạp bình luận. Trang danh sách chỉ hiện con số.

Đo query của trang danh sách: **3 query** (posts + users + categories), không phụ thuộc số bài.

---

## 8. FormRequest

```php
namespace App\Http\Requests;

use App\Enums\PostStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', \App\Models\Post::class);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'slug' => $this->slug ?: Str::slug($this->title ?? ''),
        ]);
    }

    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:200'],
            'slug'        => ['required', 'string', 'max:200', Rule::unique('posts', 'slug')],
            'body'        => ['required', 'string', 'min:20'],
            'status'      => ['required', Rule::enum(PostStatus::class)],
            'category_id' => ['nullable', Rule::exists('categories', 'id')],
        ];
    }

    protected function passedValidation(): void
    {
        $this->merge([
            'published_at' => $this->status === PostStatus::Published->value ? now() : null,
        ]);
    }

    public function attributes(): array
    {
        return [
            'title' => 'tiêu đề', 'slug' => 'đường dẫn', 'body' => 'nội dung',
            'status' => 'trạng thái', 'category_id' => 'chuyên mục',
        ];
    }
}
```

`UpdatePostRequest` giống hệt, chỉ khác hai chỗ:

```php
public function authorize(): bool
{
    return $this->user()->can('update', $this->route('post'));
}

// và trong rules():
'slug' => ['required', 'string', 'max:200',
           Rule::unique('posts', 'slug')->ignore($this->route('post'))],
```

Thiếu `->ignore()` thì sửa bài mà không đổi slug sẽ báo "đường dẫn đã tồn tại"
([bài 04 mục 3](./04-validation-va-form.md)).

---

## 9. Giao diện

### Layout

```blade
{{-- resources/views/components/layouts/app.blade.php --}}
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @livewireStyles
</head>
<body class="min-h-screen bg-gray-50 text-gray-900">
    <nav class="border-b bg-white">
        <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
            <a href="{{ route('home') }}" class="text-lg font-semibold">Blog</a>

            <div class="flex items-center gap-4 text-sm">
                @auth
                    <a href="{{ route('posts.create') }}">Viết bài</a>
                    <a href="{{ route('admin.posts') }}">Quản lý</a>
                    <span class="text-gray-500">{{ auth()->user()->name }}</span>
                    <form method="POST" action="{{ route('logout') }}">
                        @csrf
                        <button type="submit" class="text-red-600">Đăng xuất</button>
                    </form>
                @endauth

                @guest
                    <a href="{{ route('login') }}">Đăng nhập</a>
                    <a href="{{ route('register') }}" class="rounded bg-blue-600 px-3 py-1.5 text-white">
                        Đăng ký
                    </a>
                @endguest
            </div>
        </div>
    </nav>

    <main class="mx-auto max-w-4xl px-6 py-8">
        @if (session('status'))
            <x-alert type="success" class="mb-6">{{ session('status') }}</x-alert>
        @endif

        {{ $slot }}
    </main>

    @livewireScripts
</body>
</html>
```

Nút đăng xuất là **form POST**, không phải link ([bài 05 mục 2](./05-auth-va-phan-quyen.md)).

### Trang danh sách

```blade
{{-- resources/views/posts/index.blade.php --}}
<x-layouts.app title="Bài viết mới nhất">
    <form method="GET" action="{{ route('posts.index') }}" class="mb-6 flex gap-2">
        <input type="search" name="q" value="{{ request('q') }}" placeholder="Tìm bài viết..."
               class="flex-1 rounded border px-3 py-2">
        <select name="category" class="rounded border px-3 py-2">
            <option value="">Mọi chuyên mục</option>
            @foreach ($categories as $category)
                <option value="{{ $category->slug }}" @selected(request('category') === $category->slug)>
                    {{ $category->name }}
                </option>
            @endforeach
        </select>
        <button type="submit" class="rounded bg-blue-600 px-4 py-2 text-white">Tìm</button>
    </form>

    <div class="space-y-4">
        @forelse ($posts as $post)
            <x-post-card :post="$post" />
        @empty
            <p class="text-gray-500">Không tìm thấy bài viết nào.</p>
        @endforelse
    </div>

    <div class="mt-8">
        {{ $posts->links() }}
    </div>
</x-layouts.app>
```

`@empty` đứng riêng một dòng, **không** có ngoặc ([bài 02 mục 3](./02-blade-va-giao-dien.md)).

```blade
{{-- resources/views/components/post-card.blade.php --}}
@props(['post'])

<article class="rounded-lg border bg-white p-5">
    <div class="mb-2 flex items-center gap-2 text-xs text-gray-500">
        @if ($post->category)
            <a href="{{ route('posts.index', ['category' => $post->category->slug]) }}"
               class="rounded bg-gray-100 px-2 py-0.5">{{ $post->category->name }}</a>
        @endif
        <span>{{ $post->published_at->diffForHumans() }}</span>
        <span>{{ $post->comments_count }} bình luận</span>
    </div>

    <h2 class="text-lg font-semibold">
        <a href="{{ route('posts.show', $post) }}">{{ $post->title }}</a>
    </h2>

    <p class="mt-2 text-sm text-gray-600">{{ Str::limit(strip_tags($post->body), 180) }}</p>

    <p class="mt-3 text-xs text-gray-500">{{ $post->author->name }}</p>
</article>
```

`$post->published_at->diffForHumans()` chỉ chạy được vì đã cast `'published_at' => 'datetime'`. Không
cast thì nó là chuỗi và nổ `Call to a member function diffForHumans() on string`
([bài 03 mục 4](./03-database-va-eloquent.md)).

`$post->comments_count` đến từ `withCount('comments')` ở controller.

### Trang chi tiết

```blade
{{-- resources/views/posts/show.blade.php --}}
<x-layouts.app :title="$post->title">
    <article class="rounded-lg border bg-white p-8">
        <div class="mb-4 flex items-center gap-3 text-sm text-gray-500">
            <x-badge :color="$post->status->color()">{{ $post->status->label() }}</x-badge>
            @if ($post->category)
                <span>{{ $post->category->name }}</span>
            @endif
            <span>{{ $post->published_at?->format('d/m/Y') }}</span>
            <span>{{ $post->views }} lượt xem</span>
        </div>

        <h1 class="text-3xl font-bold">{{ $post->title }}</h1>
        <p class="mt-2 text-sm text-gray-500">{{ $post->author->name }}</p>

        <div class="prose mt-6 max-w-none">
            {!! nl2br(e($post->body)) !!}
        </div>

        @can('update', $post)
            <div class="mt-8 flex gap-2 border-t pt-4">
                <a href="{{ route('posts.edit', $post) }}" class="rounded border px-3 py-1.5 text-sm">
                    Sửa
                </a>
                <form method="POST" action="{{ route('posts.destroy', $post) }}"
                      onsubmit="return confirm('Xoá bài viết này?')">
                    @csrf
                    @method('DELETE')
                    <button type="submit" class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600">
                        Xoá
                    </button>
                </form>
            </div>
        @endcan
    </article>

    <section class="mt-8">
        <h2 class="mb-4 text-xl font-semibold">Bình luận ({{ $post->comments->count() }})</h2>

        @auth
            <livewire:comment-form :post="$post" />
        @else
            <p class="rounded border bg-white p-4 text-sm text-gray-600">
                <a href="{{ route('login') }}" class="text-blue-600">Đăng nhập</a> để bình luận.
            </p>
        @endauth

        <div class="mt-6 space-y-4">
            @foreach ($post->comments as $comment)
                <div class="rounded border bg-white p-4">
                    <div class="flex items-start justify-between">
                        <div>
                            <p class="text-sm font-medium">{{ $comment->author->name }}</p>
                            <p class="text-xs text-gray-500">{{ $comment->created_at->diffForHumans() }}</p>
                        </div>
                        @can('delete', $comment)
                            <form method="POST" action="{{ route('comments.destroy', $comment) }}">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="text-xs text-red-600">Xoá</button>
                            </form>
                        @endcan
                    </div>
                    <p class="mt-2 text-sm">{{ $comment->body }}</p>
                </div>
            @endforeach
        </div>
    </section>
</x-layouts.app>
```

`{!! nl2br(e($post->body)) !!}` — `e()` escape trước, `nl2br` thêm `<br>` sau. Viết
`{!! nl2br($post->body) !!}` là mở cửa XSS ([bài 02 mục 2](./02-blade-va-giao-dien.md)).

---

## 10. Livewire: form bình luận

```bash
$ php artisan make:livewire CommentForm --sfc

 INFO Livewire component [resources/views/components/⚡comment-form.blade.php] created successfully.
```

```php
<?php

use App\Models\Comment;
use App\Models\Post;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Validate;
use Livewire\Component;

new class extends Component
{
    #[Locked]
    public Post $post;

    #[Validate('required|string|min:5|max:500')]
    public string $body = '';

    public function save(): void
    {
        $this->validate();

        $comment = new Comment(['body' => $this->body]);
        $comment->user_id = auth()->id();

        $this->post->comments()->save($comment);

        $this->reset('body');
        $this->dispatch('comment-added');
    }
};
?>

<div class="rounded border bg-white p-4">
    <form wire:submit="save">
        <textarea wire:model="body" rows="3" placeholder="Viết bình luận..."
                  class="w-full rounded border px-3 py-2"></textarea>

        @error('body')
            <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
        @enderror

        <button type="submit" wire:loading.attr="disabled"
                class="mt-2 rounded bg-blue-600 px-4 py-2 text-sm text-white">
            <span wire:loading.remove wire:target="save">Gửi bình luận</span>
            <span wire:loading wire:target="save">Đang gửi...</span>
        </button>
    </form>
</div>
```

Ba điểm:

- `#[Locked]` trên `$post` — không có nó, người dùng sửa `wire:snapshot` để bình luận vào bài khác
  ([bài 06 mục 3](./06-livewire-4.md)).
- Tạo `Comment` rồi gán `user_id` **ngoài mảng**, vì `#[Fillable(['body'])]` sẽ nuốt `user_id` trong
  im lặng ([bài 06 mục 5](./06-livewire-4.md)).
- `wire:model` **không** có `.live` — bình luận chỉ cần gửi lúc submit, không cần request mỗi phím gõ.

---

## 11. Livewire: quản trị bài viết

```bash
$ php artisan make:livewire PostManager --sfc
```

```php
<?php

use App\Enums\PostStatus;
use App\Models\Post;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Url;
use Livewire\Component;
use Livewire\WithPagination;

new class extends Component
{
    use WithPagination;

    #[Url(as: 'q', except: '')]
    public string $search = '';

    #[Url(except: '')]
    public string $status = '';

    public function updatedSearch(): void { $this->resetPage(); }
    public function updatedStatus(): void { $this->resetPage(); }

    #[Computed]
    public function posts()
    {
        return auth()->user()->posts()
            ->with('category:id,name')
            ->withCount('comments')
            ->when($this->search !== '', fn ($q) => $q->search($this->search))
            ->when($this->status !== '', fn ($q) => $q->where('status', $this->status))
            ->latest()
            ->paginate(10);
    }

    public function delete(int $id): void
    {
        $post = auth()->user()->posts()->findOrFail($id);

        $this->authorize('delete', $post);
        $post->delete();

        unset($this->posts);
        $this->dispatch('post-deleted');
    }
};
?>

<div>
    <div class="mb-4 flex gap-2">
        <input type="search" wire:model.live.debounce.300ms="search"
               placeholder="Tìm trong bài của tôi..." class="flex-1 rounded border px-3 py-2">

        <select wire:model.live="status" class="rounded border px-3 py-2">
            <option value="">Mọi trạng thái</option>
            @foreach (PostStatus::cases() as $case)
                <option value="{{ $case->value }}">{{ $case->label() }}</option>
            @endforeach
        </select>
    </div>

    <p class="mb-2 text-sm text-gray-500">
        {{ $this->posts->total() }} bài viết
        <span wire:loading wire:target="search,status" class="ml-2">đang lọc...</span>
    </p>

    <table class="w-full rounded border bg-white text-sm">
        <thead class="border-b bg-gray-50 text-left">
            <tr>
                <th class="px-4 py-2">Tiêu đề</th>
                <th class="px-4 py-2">Chuyên mục</th>
                <th class="px-4 py-2">Trạng thái</th>
                <th class="px-4 py-2">Bình luận</th>
                <th class="px-4 py-2"></th>
            </tr>
        </thead>
        <tbody>
            @forelse ($this->posts as $post)
                <tr wire:key="post-{{ $post->id }}" class="border-b">
                    <td class="px-4 py-2">
                        <a href="{{ route('posts.show', $post) }}">{{ $post->title }}</a>
                    </td>
                    <td class="px-4 py-2">{{ $post->category?->name ?? '—' }}</td>
                    <td class="px-4 py-2">
                        <x-badge :color="$post->status->color()">{{ $post->status->label() }}</x-badge>
                    </td>
                    <td class="px-4 py-2">{{ $post->comments_count }}</td>
                    <td class="px-4 py-2 text-right">
                        <a href="{{ route('posts.edit', $post) }}" class="text-blue-600">Sửa</a>
                        <button wire:click="delete({{ $post->id }})"
                                wire:confirm="Xoá bài viết này? Không khôi phục được."
                                class="ml-2 text-red-600">Xoá</button>
                    </td>
                </tr>
            @empty
                <tr><td colspan="5" class="px-4 py-6 text-center text-gray-500">Chưa có bài viết nào.</td></tr>
            @endforelse
        </tbody>
    </table>

    <div class="mt-4">{{ $this->posts->links() }}</div>
</div>
```

```blade
{{-- resources/views/admin/posts.blade.php --}}
<x-layouts.app title="Quản lý bài viết">
    <h1 class="mb-6 text-2xl font-bold">Bài viết của tôi</h1>
    <livewire:post-manager />
</x-layouts.app>
```

Bốn cơ chế đang chạy cùng lúc ở đây:

| Cơ chế | Vì sao cần |
|--------|-----------|
| `auth()->user()->posts()` | Lọc ở **database**, không phải ở view. `@can` chỉ ẩn nút, không giấu dữ liệu |
| `unset($this->posts)` sau khi xoá | Xoá cache của `#[Computed]` để danh sách tính lại |
| `wire:key="post-{{ $post->id }}"` | Không có thì DOM ghép nhầm hàng sau khi xoá |
| `.debounce.300ms` | Không có thì mỗi phím gõ là một query |

---

## 12. Event, Job, Mail

```php
// app/Events/PostWasPublished.php
class PostWasPublished
{
    use Dispatchable, SerializesModels;

    public function __construct(public Post $post) {}
}
```

```php
// app/Listeners/NotifySubscribers.php
class NotifySubscribers implements ShouldQueue
{
    public function handle(PostWasPublished $event): void
    {
        Cache::forget('posts.published.count');

        SendPostPublishedNotification::dispatch($event->post);
    }
}
```

```bash
$ php artisan event:list | head -3

 App\Events\PostWasPublished ..
 ⇂ App\Listeners\NotifySubscribers@handle
```

Dòng `⇂` xác nhận Laravel đã tự tìm ra listener. Không thấy nó thì `handle()` thiếu type-hint
([bài 07 mục 3](./07-queue-mail-event-test.md)).

---

## 13. Chạy và kiểm tra

```bash
$ php artisan migrate:fresh --seed
$ npm install && npm run build
$ php artisan dev
```

`php artisan dev` chạy cùng lúc 4 tiến trình — web server, `queue:listen`, Pail (log), Vite.

Danh sách kiểm tra thủ công:

| Việc | Kỳ vọng |
|------|---------|
| Mở `/` khi chưa đăng nhập | Thấy 10 bài đã đăng, có phân trang |
| Lọc theo chuyên mục rồi sang trang 2 | Vẫn giữ `?category=...` (nhờ `withQueryString()`) |
| Mở `/posts/create` khi chưa đăng nhập | Chuyển tới `/login` |
| Đăng ký tài khoản mới | Vào thẳng trạng thái đã đăng nhập |
| Đăng bài với nội dung 10 ký tự | Lỗi "nội dung phải dài ít nhất 20 ký tự", giữ lại dữ liệu đã gõ |
| Mở bài viết của người khác, thử URL `/posts/{slug}/edit` | 403 |
| Gõ vào ô tìm ở `/admin/posts` | Bảng lọc theo, URL thành `?q=...`, trang không reload |
| Xoá bài trong `/admin/posts` | Hiện hộp xác nhận, xoá xong bảng tự cập nhật |
| Đăng bài với `status = published` | Log ghi job đã chạy (xem khung Pail) |

Kiểm tra số query của trang danh sách — thêm tạm vào `AppServiceProvider::boot()`:

```php
DB::listen(fn ($q) => Log::debug($q->sql, ['ms' => $q->time]));
```

Trang `/` phải ra **3 query**: `posts` (kèm subquery đếm comment), `users`, `categories`. Nếu thấy 12
query thì đâu đó thiếu `with()`.

---

## 14. Test

```php
namespace Tests\Feature;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BlogTest extends TestCase
{
    use RefreshDatabase;

    public function test_trang_chu_chi_hien_bai_da_dang(): void
    {
        $author = User::factory()->create();
        Post::factory()->for($author, 'author')->create(['title' => 'Bai da dang']);
        Post::factory()->draft()->for($author, 'author')->create(['title' => 'Ban nhap']);

        $this->get('/')
            ->assertOk()
            ->assertSee('Bai da dang')
            ->assertDontSee('Ban nhap');
    }

    public function test_khach_bi_da_ra_trang_dang_nhap(): void
    {
        $this->get('/posts/create')->assertRedirect('/login');
    }

    public function test_dang_bai_thanh_cong(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/posts', [
            'title'  => 'Bai moi cua toi',
            'body'   => 'Noi dung du dai de vuot qua rule min:20 ky tu',
            'status' => PostStatus::Draft->value,
        ])->assertRedirect();

        $this->assertDatabaseHas('posts', [
            'slug'    => 'bai-moi-cua-toi',
            'user_id' => $user->id,
        ]);
    }

    public function test_khong_sua_duoc_bai_cua_nguoi_khac(): void
    {
        $post = Post::factory()->for(User::factory(), 'author')->create();

        $this->actingAs(User::factory()->create())
            ->get("/posts/{$post->slug}/edit")
            ->assertForbidden();
    }

    public function test_trang_chu_khong_bi_n_plus_1(): void
    {
        Post::factory()->count(5)->for(User::factory(), 'author')->create();

        // shouldBeStrict() đã bật preventLazyLoading — thiếu with() là test này ném exception
        $this->get('/')->assertOk();
    }
}
```

```bash
$ php artisan test --filter=BlogTest

   PASS  Tests\Feature\BlogTest
  ✓ trang chu chi hien bai da dang
  ✓ khach bi da ra trang dang nhap
  ✓ dang bai thanh cong
  ✓ khong sua duoc bai cua nguoi khac
  ✓ trang chu khong bi n plus 1

  Tests:    5 passed
```

Test cuối là mẹo đáng dùng: vì `Model::shouldBeStrict()` đã bật `preventLazyLoading`, chỉ cần một
feature test nạp trang là mọi N+1 trên trang đó biến thành exception. Nhớ seed **từ 2 bản ghi trở
lên** — với 1 bản ghi Laravel cố ý không báo lỗi ([bài 03 mục 9](./03-database-va-eloquent.md)).

Nhớ `->for($user, 'author')` — không ghi tên quan hệ thì factory đi tìm `Post::user()` và nổ
`BadMethodCallException` ([bài 06 mục 10](./06-livewire-4.md)).

---

## 15. Mở rộng tiếp

Làm xong phần trên, thử thêm:

1. **Tag** — quan hệ `belongsToMany`, bảng trung gian `post_tag`, ô nhập tag bằng Livewire.
2. **Ảnh bìa** — upload bằng `WithFileUploads` của Livewire, `storage:link`, resize bằng job nền.
3. **Soft delete + thùng rác** — `SoftDeletes`, trang khôi phục bài đã xoá.
4. **Bình luận lồng nhau** — `parent_id`, đệ quy trong Blade component.
5. **RSS** — route trả `Content-Type: application/rss+xml`.
6. **Xác minh email** — `MustVerifyEmail` + middleware `verified` trên route đăng bài.

Muốn làm cho blog chịu tải thật (cache nhiều tầng, Redis, Horizon, Octane, đo lường):
👉 [nang-cao/](./nang-cao/README.md)

---

## Bài tập

1. Dựng toàn bộ dự án theo bài này. Chạy `php artisan route:list --except-vendor` và dán kết quả.

2. Cố tình đặt `Route::get('/posts/{post}', ...)` **trước** `/posts/create`. Bấm nút "Viết bài" và ghi
   lại lỗi. Giải thích rồi sửa.

3. Bỏ `with(['author:id,name', 'category:id,name,slug'])` khỏi `PostController::index()`. Chạy
   `test_trang_chu_khong_bi_n_plus_1` và ghi lại exception.

4. Bỏ `#[Locked]` khỏi `$post` trong `CommentForm`. Mở DevTools, sửa `wire:snapshot` để trỏ sang bài
   viết khác, rồi gửi bình luận. Bình luận rơi vào bài nào?

5. Bỏ `unset($this->posts)` trong `PostManager::delete()`. Xoá một bài và quan sát bảng.

6. Đo số query của trang `/` bằng `DB::listen`. Ghi lại con số với 10 bài và với 40 bài — hai con số
   phải bằng nhau.

7. Viết thêm test: người dùng A không xoá được bình luận của người dùng B, nhưng **tác giả bài viết**
   thì xoá được.

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```
404 | No query results for model [App\Models\Post] create
```
Router khớp route theo thứ tự khai. `/posts/create` khớp `{post}` trước, Laravel đi tìm bài có
`slug = 'create'`. Sửa: đặt route tĩnh trước route có tham số.

**3.**
```
Illuminate\Database\LazyLoadingViolationException
Attempted to lazy load [author] on model [App\Models\Post] but lazy loading is disabled.
```

**4.** Bình luận rơi vào **bài viết bị sửa trong snapshot** — người dùng bình luận được vào bất kỳ bài
nào, kể cả bài nháp riêng tư của người khác. Đó chính là lý do `#[Locked]` tồn tại.

**5.** Bảng vẫn hiện bài vừa xoá cho tới khi bấm sang trang khác — `#[Computed]` trả kết quả đã nhớ
trong request trước. `unset($this->posts)` buộc nó tính lại.

**6.** Cả hai đều là **3 query**. Đó là điểm khác biệt giữa eager loading và N+1: số query không phụ
thuộc số bản ghi.

</details>

---

Tiếp theo: [09-loi-thuong-gap.md](./09-loi-thuong-gap.md) — tra cứu khi gặp lỗi.
