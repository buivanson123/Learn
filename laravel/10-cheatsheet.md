# Bài 10 — Cheatsheet

Tra cứu nhanh. Mọi thứ ở đây đúng cho **Laravel 13.26 / PHP 8.5 / Livewire 4.4**.

---

## 1. ⭐ Laravel 13 đã đổi gì so với code trên mạng

Bảng này giải quyết phần lớn tình huống "chép code về mà không chạy".

| Việc | Laravel 8–11 | Laravel 13 |
|------|--------------|------------|
| Cột gán hàng loạt | `protected $fillable = [...]` | `#[Fillable([...])]` trên class |
| Cột ẩn khi ra JSON | `protected $hidden = [...]` | `#[Hidden([...])]` trên class |
| Scope | `public function scopePublished($q)` | `#[Scope] protected function published(Builder $q)` |
| Global scope | Đăng ký trong `booted()` | `#[ScopedBy(PublishedScope::class)]` |
| Policy khác quy ước | `Gate::policy(...)` | `#[UsePolicy(BaiVietPolicy::class)]` |
| Middleware toàn cục | `app/Http/Kernel.php` | `bootstrap/app.php` → `withMiddleware()` |
| Middleware ở controller | `$this->middleware('auth')` trong constructor | `implements HasMiddleware` + `static middleware()` |
| Xử lý exception | `app/Exceptions/Handler.php` | `bootstrap/app.php` → `withExceptions()` |
| Lệnh + lịch chạy | `app/Console/Kernel.php` | `routes/console.php` |
| Route API | `routes/api.php` có sẵn | Chạy `php artisan install:api` |
| Lớp Controller cha | Kế thừa `Illuminate\Routing\Controller` | Lớp trần, phải tự thêm trait |
| Chạy môi trường dev | `npm run dev` + nhiều tab terminal | `php artisan dev` (4 tiến trình, 1 lệnh) |
| Cấu hình Tailwind | `tailwind.config.js` | `@import 'tailwindcss';` trong CSS |
| Component Livewire | `app/Http/Livewire/` (v2) | `resources/views/components/⚡ten.blade.php` (v4) |
| `wire:model` | Gửi request mỗi lần gõ (v2) | Không gửi cho tới khi có action; cần `.live` |

### Toàn bộ attribute cho Model trong Laravel 13

Đây là danh sách thật, lấy từ `vendor/laravel/framework/src/Illuminate/Database/Eloquent/Attributes/`:

```bash
$ ls vendor/laravel/framework/src/Illuminate/Database/Eloquent/Attributes/
Appends.php      Boot.php        CollectedBy.php   Connection.php   DateFormat.php
Fillable.php     Guarded.php     Hidden.php        Initialize.php   ObservedBy.php
RouteKey.php     Scope.php       ScopedBy.php      Table.php        Touches.php
Unguarded.php    UseEloquentBuilder.php  UseFactory.php  UsePolicy.php
UseResource.php  UseResourceCollection.php  Visible.php
WithoutIncrementing.php  WithoutTimestamps.php
```

| Attribute | Thay cho | Ví dụ |
|-----------|----------|-------|
| `#[Fillable([...])]` | `protected $fillable` | `#[Fillable(['title','body'])]` |
| `#[Guarded([...])]` | `protected $guarded` | `#[Guarded([])]` |
| `#[Hidden([...])]` | `protected $hidden` | `#[Hidden(['password'])]` |
| `#[Visible([...])]` | `protected $visible` | |
| `#[Appends([...])]` | `protected $appends` | `#[Appends(['excerpt'])]` |
| `#[Table('...')]` | `protected $table` | `#[Table('tbl_bai_viet')]` |
| `#[Connection('...')]` | `protected $connection` | |
| `#[RouteKey('...')]` | `getRouteKeyName()` | `#[RouteKey('slug')]` |
| `#[Scope]` | `scopeXxx()` | trên method, tên method = tên scope |
| `#[ScopedBy(X::class)]` | đăng ký trong `booted()` | global scope |
| `#[UsePolicy(X::class)]` | `Gate::policy()` | khi policy khác quy ước |
| `#[UseFactory(X::class)]` | `protected $factory` | khi factory khác quy ước |
| `#[ObservedBy(X::class)]` | `Post::observe()` | |
| `#[WithoutTimestamps]` | `public $timestamps = false` | |
| `#[WithoutIncrementing]` | `public $incrementing = false` | |
| `#[DateFormat('...')]` | `protected $dateFormat` | |
| `#[Touches([...])]` | `protected $touches` | |

Ví dụ dùng nhiều attribute cùng lúc:

```php
#[Table('tbl_bai_viet')]
#[RouteKey('slug')]
#[Fillable(['title', 'slug', 'body'])]
#[Hidden(['internal_notes'])]
#[UsePolicy(BaiVietPolicy::class)]
#[ObservedBy(PostObserver::class)]
class Post extends Model {}
```

### Ba thứ phải tự thêm vào lớp Controller cha

```php
namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;

abstract class Controller
{
    use AuthorizesRequests, ValidatesRequests;
}
```

Không thêm thì `$this->authorize()` và `$this->validate()` đều báo `Call to undefined method`.

---

## 2. Artisan

### Hay dùng nhất

```bash
php artisan dev                     # web + queue + log + vite trong 1 lệnh
php artisan serve --port=8000
php artisan tinker
php artisan about                   # phiên bản, driver, cache đang bật
php artisan optimize:clear          # khi "sửa mà không thấy đổi"
php artisan db                      # mở CLI của database
```

### Sinh code

```bash
php artisan make:model Post -mfsc --policy   # model + migration + factory + seeder + controller + policy
php artisan make:controller PostController --resource --model=Post
php artisan make:controller SearchController --invokable
php artisan make:request StorePostRequest
php artisan make:policy PostPolicy --model=Post
php artisan make:middleware EnsureUserIsAdmin
php artisan make:job SendEmail
php artisan make:event PostWasPublished
php artisan make:listener NotifySubscribers --event=PostWasPublished
php artisan make:mail PostPublished --markdown=mail.posts.published
php artisan make:rule VietnamesePhone
php artisan make:enum Enums/PostStatus --string      # chú ý phần Enums/
php artisan make:component Badge --view              # component Blade ẩn danh
php artisan make:test PostTest
```

### Kiểm tra

```bash
php artisan route:list --except-vendor    # bỏ route của package
php artisan route:list --path=posts -v    # -v hiện cả middleware
php artisan model:show Post               # cột, cast, fillable, quan hệ, policy
php artisan db:show                       # phiên bản DB, danh sách bảng, dung lượng
php artisan db:table posts                # cột, index, khoá ngoại
php artisan event:list
php artisan schedule:list
php artisan queue:failed
php artisan config:show database.connections.pgsql   # ⚠️ in cả mật khẩu
```

### Migration

```bash
php artisan migrate
php artisan migrate:status
php artisan migrate:rollback --step=1
php artisan migrate:fresh --seed          # ⚠️ xoá sạch dữ liệu
php artisan migrate --pretend             # chỉ in SQL
```

### Cache

```bash
php artisan optimize                # cache tất cả — CHỈ dùng khi deploy
php artisan optimize:clear          # xoá tất cả
php artisan config:cache / config:clear
php artisan route:cache / route:clear
php artisan view:cache / view:clear
```

---

## 3. Route

```php
Route::get('/posts', [PostController::class, 'index'])->name('posts.index');
Route::post('/posts', [PostController::class, 'store']);
Route::match(['get', 'post'], '/search', SearchController::class);
Route::view('/about', 'pages.about');
Route::redirect('/cu', '/moi', 301);

Route::resource('posts', PostController::class);
Route::resource('posts', PostController::class)->only(['index', 'show']);
Route::apiResource('posts', PostController::class);      // bỏ create + edit

// Ràng buộc
->whereNumber('post')  ->whereAlpha('name')  ->whereUuid('id')
->where('slug', '[a-z0-9\-]+')

// Nhóm
Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    //                                                          ↑ nhớ dấu chấm cuối
});

// Binding
Route::get('/posts/{post}', ...);                    // theo id
Route::get('/posts/{post}/comments/{comment}', ...)->scopeBindings();   // ép comment thuộc post
```

**Thứ tự khai quan trọng:**
- Route tĩnh (`/posts/create`) đặt **trước** route động (`/posts/{post}`).
- Hai route cùng URI → cái sau **ghi đè** cái trước.

**7 route của `Route::resource`:**

| Method | URI | Tên | Controller |
|--------|-----|-----|-----------|
| GET | `posts` | `posts.index` | `index` |
| GET | `posts/create` | `posts.create` | `create` |
| POST | `posts` | `posts.store` | `store` |
| GET | `posts/{post}` | `posts.show` | `show` |
| GET | `posts/{post}/edit` | `posts.edit` | `edit` |
| PUT/PATCH | `posts/{post}` | `posts.update` | `update` |
| DELETE | `posts/{post}` | `posts.destroy` | `destroy` |

---

## 4. Eloquent

### Model

```php
#[Fillable(['title', 'slug', 'body'])]
#[Hidden(['secret'])]
#[ScopedBy(PublishedScope::class)]
#[UsePolicy(CustomPolicy::class)]
class Post extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'is_featured'  => 'boolean',
            'meta'         => 'array',
            'price'        => 'decimal:2',
            'password'     => 'hashed',
            'status'       => PostStatus::class,
        ];
    }

    public function getRouteKeyName(): string { return 'slug'; }

    #[Scope]
    protected function published(Builder $q): void
    {
        $q->where('status', 'published');
    }
}
```

### Quan hệ

```php
$this->hasOne(Profile::class);
$this->hasMany(Comment::class);
$this->belongsTo(User::class, 'user_id');           // tham số 2 khi tên method khác tên cột
$this->belongsToMany(Tag::class);                   // bảng post_tag (số ít, a-b-c)
$this->hasManyThrough(Comment::class, Post::class);
$this->morphMany(Comment::class, 'commentable');
```

### Truy vấn

```php
Post::find(1)                    Post::findOrFail(1)
Post::firstWhere('slug', $s)     Post::where(...)->first()
Post::whereIn('id', [1,2])       Post::whereNull('published_at')
Post::whereBetween('created_at', [$a, $b])
Post::whereDate('published_at', today())
Post::whereRelation('category', 'slug', 'backend')
Post::whereHas('comments', fn ($q) => $q->where(...))
Post::withCount('comments')      // → $post->comments_count
Post::latest('published_at')     Post::inRandomOrder()
Post::when($cond, fn ($q) => $q->where(...))
Post::paginate(10)->withQueryString()

// Eager load
Post::with('author')                       Post::with(['author:id,name'])
Post::with('comments.author')              $post->load('comments')

// Ghi
Post::create([...])              $post->update([...])
Post::updateOrCreate([...], [...])         Post::firstOrCreate([...], [...])
$post->increment('views')        $post->delete()

// Soft delete
Post::withTrashed()  Post::onlyTrashed()  $post->restore()  $post->forceDelete()

// Debug
Post::published()->toSql()   ->dump()   ->dd()
```

### Ba công tắc nên bật ngay ngày đầu

```php
// AppServiceProvider::boot()
Model::shouldBeStrict(! app()->isProduction());
```

Tương đương:

```php
Model::preventLazyLoading(...);                    // N+1 → exception
Model::preventSilentlyDiscardingAttributes(...);   // cột ngoài fillable → exception
Model::preventAccessingMissingAttributes(...);     // đọc cột chưa select → exception
```

---

## 5. Migration

```php
$table->id();                    $table->uuid('id')->primary();
$table->string('title', 200);    $table->text('body');   $table->longText('c');
$table->integer('n');            $table->unsignedInteger('views');
$table->decimal('price', 10, 2); // tiền — KHÔNG dùng float
$table->boolean('flag');         $table->json('meta');
$table->timestamp('at')->nullable();   $table->date('d');
$table->timestamps();            $table->softDeletes();

$table->foreignId('user_id')->constrained()->cascadeOnDelete();
$table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
$table->foreignIdFor(User::class)->constrained();

$table->index(['status', 'published_at']);
$table->unique('slug');

// Bổ nghĩa
->nullable()  ->default(0)  ->unique()  ->index()  ->after('title')  ->comment('...')
```

---

## 6. Validation

```php
'title'    => ['required', 'string', 'min:3', 'max:200'],
'email'    => ['required', 'email', 'unique:users,email'],
'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()->uncompromised()],
'age'      => ['nullable', 'integer', 'between:18,100'],
'date'     => ['required', 'date', 'after:today'],
'tags'     => ['array', 'max:5'],
'tags.*'   => ['integer', 'exists:tags,id'],
'cover'    => ['nullable', 'image', 'mimes:jpg,png,webp', 'max:2048'],   // max tính KB

// Rule object
Rule::in(['draft', 'published'])
Rule::enum(PostStatus::class)
Rule::unique('posts')->ignore($this->route('post'))      // ⚠️ bắt buộc khi sửa
Rule::exists('categories', 'id')
Rule::requiredIf(fn () => $this->status === 'published')
```

### FormRequest — vòng đời

```
authorize()  →  prepareForValidation()  →  rules()  →  after()  →  passedValidation()
     ↓ false
   403 (rules() KHÔNG chạy)
```

`make:request` sinh `authorize()` trả **`false`** — nhớ sửa.

### Mã trả về khi validate hỏng

| Request | Kết quả |
|---------|---------|
| `Accept: application/json` | **422** + `{"message": "...", "errors": {"field": ["..."]}}` |
| HTML thường | **302** back + `$errors` + `old()` trong session |

---

## 7. Blade

```blade
{{ $x }}                {{-- escape --}}
{!! $x !!}              {{-- raw, chỉ khi tự sinh nội dung --}}
{{-- comment --}}
@{{ literal }}

@if / @elseif / @else / @endif
@unless / @isset / @empty($x) / @auth / @guest / @can('update', $post)

@foreach ($items as $i)  {{ $loop->iteration }}/{{ $loop->count }} {{ $loop->last }}  @endforeach
@forelse ($items as $i) ... @empty ... @endforelse     {{-- @empty đứng riêng, KHÔNG có ngoặc --}}

@csrf   @method('PUT')
@error('title') {{ $message }} @enderror
@class(['p-4', 'text-red-600' => $hasError])
@checked($on)  @selected($x == $y)  @disabled($no)
@json($data)   @once   @vite([...])
@include('partials.x')   @includeWhen($c, 'partials.x')
```

### Component

| File | Tag |
|------|-----|
| `components/badge.blade.php` | `<x-badge />` |
| `components/layouts/app.blade.php` | `<x-layouts.app />` |
| `components/forms/input.blade.php` | `<x-forms.input />` |

```blade
@props(['color' => 'gray'])
<span {{ $attributes->merge(['class' => "badge badge-$color"]) }}>{{ $slot }}</span>
```

```blade
<x-badge color="red" class="ml-2" id="x">Nháp</x-badge>
{{-- → <span class="badge badge-red ml-2" id="x">Nháp</span> --}}
{{-- color bị @props "ăn" nên không ra HTML; id không khai nên đi qua $attributes --}}

<x-card :post="$post" />      {{-- có dấu 2 chấm = biến PHP --}}
<x-card post="$post" />       {{-- không có = chuỗi "$post" --}}
```

---

## 8. Livewire 4

### Sinh component

```bash
php artisan make:livewire Counter --sfc              # resources/views/components/⚡counter.blade.php
php artisan make:livewire PostList --mfc             # thư mục ⚡post-list/
php artisan make:livewire OldStyle --class           # app/Livewire/OldStyle.php
php artisan make:livewire Counter --sfc --emoji=false
php artisan livewire:layout
php artisan livewire:convert Counter                 # đổi qua lại sfc ↔ mfc
```

### Gọi

```blade
<livewire:counter />                ✅
@livewire('counter')                ✅
<x-⚡counter />                      ❌ in nguyên văn, KHÔNG có lỗi
<livewire:comment-form :post="$post" />
```

### Directive

```blade
wire:model="x"                       {{-- không gửi request cho tới khi có action --}}
wire:model.live="x"
wire:model.live.debounce.300ms="x"
wire:model.blur="x"

wire:click="save"       wire:click="delete({{ $id }})"
wire:submit="save"      {{-- tự preventDefault --}}
wire:keydown.enter="search"
wire:confirm="Xoá?"

wire:loading             wire:loading.attr="disabled"   wire:loading.remove
wire:target="save"
wire:key="post-{{ $post->id }}"      {{-- BẮT BUỘC trong vòng lặp --}}
wire:navigate                        {{-- chuyển trang kiểu SPA --}}

@island ... @endisland               {{-- chỉ render lại vùng này --}}
```

### Attribute

```php
#[Validate('required|min:5')]  public string $body = '';
#[Url(as: 'q', except: '')]    public string $search = '';
#[Locked]                      public int $postId;        // chống sửa từ client
#[Computed]                    public function posts() {} // gọi bằng $this->posts
#[On('comment-added')]         public function refresh() {}
#[Reactive]                    public Post $post;
#[Renderless]                  public function track() {}
#[Layout('components.layouts.app')]
#[Title('Danh sách bài viết')]
#[Lazy]
```

### Hook và helper

```php
use WithPagination;         use WithFileUploads;

public function updatedSearch(): void { $this->resetPage(); }
public function updated(string $name, $value): void {}
public function mount(Post $post): void {}

$this->reset('body');
$this->dispatch('comment-added', postId: 1);
unset($this->posts);          // xoá cache của #[Computed]
```

### Test

```php
Livewire::test('comment-form', ['post' => $post])
    ->set('body', 'abc')
    ->call('save')
    ->assertHasNoErrors()
    ->assertDispatched('comment-added')
    ->assertSet('body', '')
    ->assertSee('...')
    ->assertDontSee('...');
```

---

## 9. Auth và phân quyền

```php
auth()->check()   auth()->user()   auth()->id()   $request->user()
auth()->attempt(['email' => ..., 'password' => ...], $remember)
auth()->login($user)   auth()->logout()

// Sau khi đăng nhập
$request->session()->regenerate();
return redirect()->intended(route('home'));

// Sau khi đăng xuất
$request->session()->invalidate();
$request->session()->regenerateToken();
```

```php
Gate::define('access-admin', fn (User $u) => $u->is_admin);
Gate::allows(...)   Gate::authorize(...)
Gate::before(fn (User $u, string $a) => $u->is_admin ? true : null);   // null, KHÔNG phải false

$this->authorize('update', $post);       // cần trait AuthorizesRequests
$user->can('update', $post);
```

```php
Route::middleware(['auth', 'verified', 'can:update,post', 'throttle:5,1'])
```

### Mã trạng thái

| Mã | Nghĩa |
|----|-------|
| 401 | Chưa đăng nhập / thiếu token |
| 403 | Đã đăng nhập, Policy/Gate từ chối |
| 419 | Thiếu/sai CSRF token |
| 422 | Validate hỏng (request JSON) |
| 405 | Sai HTTP method (thiếu `@method`) |
| 429 | Vượt `throttle` |

---

## 10. Queue, Mail, Event, Cache, Schedule

```php
// Queue
SendEmail::dispatch($post)->delay(now()->addMinutes(5))->onQueue('emails');
SendEmail::dispatchAfterResponse($post);
// class SendEmail implements ShouldQueue  ← thiếu dòng này thì chạy đồng bộ

// Mail
Mail::to($user)->cc($e)->send(new PostPublished($post));
// class PostPublished extends Mailable implements ShouldQueue

// Event
PostWasPublished::dispatch($post);
// listener tự tìm qua type-hint của handle() — thiếu type-hint là không ai nghe

// Cache
Cache::remember('key', 60, fn () => Post::count());
Cache::forget('key');

// Schedule — routes/console.php
Schedule::command('cache:prune-stale-tags')->hourly();
Schedule::call(fn () => ...)->daily()->name('ten-task');   // nhớ ->name()
->withoutOverlapping()  ->onOneServer()  ->timezone('Asia/Ho_Chi_Minh')
```

```bash
php artisan queue:work --stop-when-empty     # dev/CI
php artisan queue:listen                     # dev, tự nạp code mới
php artisan queue:work                       # production (cần supervisor)
php artisan queue:restart                    # ⚠️ BẮT BUỘC trong bước deploy
php artisan queue:failed / retry / forget / flush
```

Cron trên server — **một dòng duy nhất**:

```cron
* * * * * cd /var/www/blog && php artisan schedule:run >> /dev/null 2>&1
```

---

## 11. Test

```php
use RefreshDatabase;

$this->get('/posts')->assertOk()->assertSee('...');
$this->actingAs($user)->post('/posts', [...])->assertRedirect();
$this->assertDatabaseHas('posts', ['slug' => 'x']);
$this->assertDatabaseMissing(...)   $this->assertDatabaseCount('posts', 3);
$this->assertSoftDeleted($post);

$response->assertForbidden()   assertUnauthorized()   assertNotFound()
$response->assertSessionHasErrors(['title'])
$response->assertJson([...])   assertJsonCount(10, 'data')

Queue::fake();  Queue::assertPushed(SendEmail::class);
Mail::fake();   Mail::assertSent(PostPublished::class);
Event::fake();  Event::assertDispatched(PostWasPublished::class);

Post::factory()->for($user, 'author')->has(Comment::factory()->count(3))->create();
//                        ↑ bắt buộc khi tên quan hệ khác tên model
```

```bash
php artisan test --filter=BlogTest --stop-on-failure
php artisan test --parallel
```

Cho test dùng đúng loại database trong `phpunit.xml`:

```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="blog_test"/>
```

---

## 12. Deploy checklist

```bash
git pull
composer install --no-dev --optimize-autoloader
npm ci && npm run build
php artisan migrate --force
php artisan optimize            # config + route + view + event cache
php artisan queue:restart       # ← hay quên nhất
php artisan storage:link        # lần đầu
```

`.env` production:

```ini
APP_ENV=production
APP_DEBUG=false          # ⚠️ để true là lộ đường dẫn, biến môi trường, câu SQL
```

Quy tắc: **`optimize` chỉ chạy khi deploy**. Chạy trên máy dev sẽ khiến route/config mới không có hiệu
lực, và bạn mất nửa buổi đi tìm nguyên nhân.

---

## 13. Helper hay dùng

```php
// Chuỗi
Str::slug('Học Laravel 13')     // hoc-laravel-13
Str::limit($text, 200)          Str::title()   Str::headline()
str($text)->slug()->limit(50)   // chuỗi fluent

// Collection
collect($arr)->map()->filter()->groupBy('category_id')->sortByDesc('views')->take(5)
->pluck('title', 'id')   ->sum('views')   ->first()   ->contains(...)

// Thời gian
now()   today()   now()->addDays(3)   now()->subMonths(6)
$date->format('d/m/Y')   $date->diffForHumans()   $date->isPast()

// Khác
blank($x)   filled($x)   value($x)   optional($x)->name
config('app.name')      // ✅ trong code ứng dụng
env('APP_NAME')         // ❌ trả null sau config:cache
route('posts.show', $post)      asset('storage/'.$path)
abort(403, 'Không có quyền')    abort_if($cond, 404)
```

---

## 14. Tra cứu nhanh: "Sửa mà không thấy đổi"

| Triệu chứng | Lệnh |
|-------------|------|
| Route mới trả 404 | `php artisan route:clear` |
| Sửa `.env` không có tác dụng | `php artisan config:clear` |
| Sửa Blade không đổi | `php artisan view:clear` |
| Class mới `does not exist` | `composer dump-autoload` |
| Job chạy code cũ | `php artisan queue:restart` |
| CSS/JS không đổi | `npm run build` |
| Không rõ nguyên nhân | `php artisan optimize:clear` |

---

Quay lại [README](./README.md) · Học tiếp [nang-cao/](./nang-cao/README.md)
