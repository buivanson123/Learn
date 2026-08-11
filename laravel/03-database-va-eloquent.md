# Bài 03 — Database, Migration và Eloquent

Bài dài nhất và quan trọng nhất. Đây là chỗ Laravel tiết kiệm nhiều code nhất cho bạn, và cũng là chỗ
làm ứng dụng chậm nhất nếu dùng sai.

**Lưu ý cho người đã viết Laravel cũ:** bản 13 khai `fillable`, `hidden`, `scope` bằng **PHP attribute**
thay cho property và tiền tố tên method. Mục 3 và mục 6 nói kỹ.

---

## 1. Migration — lịch sử thay đổi cấu trúc database

Migration là file PHP mô tả một thay đổi cấu trúc. Laravel ghi nhớ file nào đã chạy, nên mọi máy
(máy bạn, máy đồng nghiệp, production) đều đi tới cùng một cấu trúc.

```bash
$ php artisan make:migration create_posts_table

 INFO Migration [database/migrations/2026_08_18_133655_create_posts_table.php] created successfully.
```

Tên file bắt đầu bằng **mốc thời gian** — đó chính là thứ tự chạy.

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('body');
            $table->string('status')->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'published_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
```

`foreignId('user_id')->constrained()` là dạng viết gọn: tạo cột `bigint unsigned`, đoán bảng đích từ
tên cột (`user_id` → `users`), rồi tạo khoá ngoại. Kiểm chứng bằng `db:table`:

```bash
$ php artisan db:table posts

 Foreign Key .. On Update / On Delete
 posts_category_id_foreign  category_id references id on categories  no action / set null
 posts_user_id_foreign      user_id references id on users .......... no action / cascade
```

### ⚠️ Thứ tự migration — lỗi đầu tiên ai cũng gặp

Migration chạy theo thứ tự tên file. Nếu `create_posts_table` có mốc thời gian **sớm hơn**
`create_categories_table`, khoá ngoại sẽ trỏ vào một bảng chưa tồn tại:

```bash
$ php artisan migrate

 INFO Running migrations.

 2026_08_18_133655_create_posts_table .. 11.45ms FAIL

   Illuminate\Database\QueryException

  SQLSTATE[42P01]: Undefined table: 7 ERROR:  relation "categories" does not exist
  (Connection: pgsql, Host: 127.0.0.1, Port: 55433, Database: blog,
   SQL: alter table "posts" add constraint "posts_category_id_foreign"
        foreign key ("category_id") references "categories" ("id") on delete set null)
```

Hai cách sửa:

```bash
# Cách 1 — đổi tên file cho đúng thứ tự (chỉ làm được khi chưa deploy)
$ mv database/migrations/2026_08_18_133657_create_categories_table.php \
     database/migrations/2026_08_18_133650_create_categories_table.php
$ php artisan migrate:fresh
```

```php
// Cách 2 — tách khoá ngoại ra migration riêng chạy sau
Schema::table('posts', function (Blueprint $table) {
    $table->foreign('category_id')->references('id')->on('categories')->nullOnDelete();
});
```

Trên dự án đã deploy thì **luôn dùng cách 2**. Đổi tên file migration đã chạy ở production khiến
Laravel tưởng đó là migration mới và chạy lại.

### Các kiểu cột hay dùng

```php
$table->id();                              // bigint unsigned, khoá chính tự tăng
$table->uuid('id')->primary();
$table->string('title', 200);              // varchar(255) nếu không ghi độ dài
$table->text('body');
$table->longText('content');
$table->integer('views')->default(0);
$table->decimal('price', 10, 2);           // dùng cho tiền, KHÔNG dùng float
$table->boolean('is_featured')->default(false);
$table->json('meta')->nullable();
$table->timestamp('published_at')->nullable();
$table->date('birthday');
$table->timestamps();                      // created_at + updated_at
$table->softDeletes();                     // deleted_at
$table->foreignId('user_id')->constrained();
$table->foreignIdFor(User::class)->constrained();
```

Sửa đổi:

```php
$table->string('slug')->unique()->nullable()->index()->after('title')->comment('...');
```

### Sửa bảng đã có

```bash
$ php artisan make:migration add_views_to_posts_table --table=posts
```

```php
public function up(): void
{
    Schema::table('posts', function (Blueprint $table) {
        $table->unsignedInteger('views')->default(0)->after('body');
    });
}

public function down(): void
{
    Schema::table('posts', function (Blueprint $table) {
        $table->dropColumn('views');
    });
}
```

Luôn viết `down()` cho tử tế. Đó là thứ cứu bạn lúc 2h sáng khi deploy hỏng.

### Lệnh migration

```bash
php artisan migrate                 # chạy migration chưa chạy
php artisan migrate:status          # xem cái nào đã chạy
php artisan migrate:rollback        # lùi batch gần nhất
php artisan migrate:rollback --step=1
php artisan migrate:fresh           # xoá sạch bảng rồi chạy lại từ đầu (chỉ dùng khi dev)
php artisan migrate:fresh --seed
php artisan migrate --pretend       # chỉ in SQL, không chạy
```

```bash
$ php artisan migrate:status

  Migration name .......................................... Batch / Status
  0001_01_01_000000_create_users_table ......................... [1] Ran
  2026_08_18_133650_create_categories_table .................... [1] Ran
  2026_08_18_133655_create_posts_table ......................... [1] Ran
```

> `migrate:fresh` **xoá toàn bộ dữ liệu**. Đừng gõ nó khi biến môi trường đang trỏ vào production.
> Laravel có chặn: ở môi trường `production` nó hỏi xác nhận trước khi chạy.

---

## 2. Model — quy ước đặt tên

```bash
$ php artisan make:model Post -mfs
 INFO Model [app/Models/Post.php] created successfully.
 INFO Factory [database/factories/PostFactory.php] created successfully.
 INFO Migration [database/migrations/..._create_posts_table.php] created successfully.
 INFO Seeder [database/seeders/PostSeeder.php] created successfully.
```

Các cờ: `-m` migration, `-f` factory, `-s` seeder, `-c` controller, `-r` controller dạng resource,
`--policy`. Gộp hết: `php artisan make:model Post -mfsc --policy`.

Laravel đoán từ tên class:

| Model | Bảng | Khoá chính | Cột thời gian |
|-------|------|-----------|---------------|
| `Post` | `posts` | `id` | `created_at`, `updated_at` |
| `Category` | `categories` | `id` | như trên |
| `PostComment` | `post_comments` | `id` | như trên |

Khi không theo quy ước được (ví dụ database có sẵn):

```php
class Post extends Model
{
    protected $table = 'tbl_bai_viet';
    protected $primaryKey = 'ma_bai_viet';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
}
```

---

## 3. ⭐ `#[Fillable]` — thay đổi lớn nhất của Laravel 13

Đây là model `User` **do Laravel 13 sinh ra**, không phải tôi viết:

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Foundation\Auth\User as Authenticatable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
```

`protected $fillable = [...]` và `protected $hidden = [...]` đã thành **attribute đặt trên class**.
Đây là lý do code Laravel chép từ mạng về trông "lệch" so với project của bạn.

Áp dụng cho `Post`:

```php
use Illuminate\Database\Eloquent\Attributes\Fillable;

#[Fillable(['title', 'slug', 'body', 'status', 'published_at', 'category_id'])]
class Post extends Model
{
    // ...
}
```

Kiểm chứng Laravel thật sự đọc được attribute đó:

```bash
$ php artisan model:show Post

 App\Models\Post ..
 Database .. pgsql
 Table .. posts
 Policy .. App\Policies\PostPolicy

 Attributes .. type / cast
 id increments, unique .. bigint / int
 user_id .. bigint                                       ← KHÔNG có chữ "fillable"
 category_id nullable, fillable .. bigint
 title fillable .. character varying(255)
 slug unique, fillable .. character varying(255)
 body fillable .. text
 status fillable .. character varying(255)
 published_at nullable, fillable .. timestamp(0) / datetime
```

`php artisan model:show` là lệnh nên nhớ: nó in ra cột nào fillable, cast kiểu gì, có quan hệ nào,
policy nào đang gắn — tất cả trong một màn hình.

### Vì sao cần `fillable`

`fillable` là danh sách trắng cho **gán hàng loạt** (`create()`, `update()`, `fill()`). Không có nó,
người dùng gửi thêm `is_admin=1` vào form đăng ký là chiếm được quyền quản trị.

Cột không nằm trong `#[Fillable]` bị **bỏ qua trong im lặng**. Đây là hành vi nguy hiểm nhất — thử thật:

```php
App\Models\Post::create([
    'title' => 'X', 'slug' => 'x', 'body' => 'y',
    'user_id' => 999,          // ← không có trong #[Fillable]
]);
```

```
Illuminate\Database\QueryException
SQLSTATE[23502]: Not null violation: 7 ERROR:  null value in column "user_id" of relation "posts"
violates not-null constraint
DETAIL: Failing row contains (2, null, null, X, x, y, draft, null, ...).
(SQL: insert into "posts" ("title", "slug", "body", "updated_at", "created_at") values (X, x, y, ...))
```

Nhìn câu SQL: `user_id` **biến mất khỏi danh sách cột**. Nếu cột đó cho phép `null`, bạn sẽ không thấy
lỗi gì cả — chỉ thấy dữ liệu bị thiếu vài ngày sau.

### Công tắc biến lỗi im lặng thành exception

Bật trong `app/Providers/AppServiceProvider.php`:

```php
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::preventSilentlyDiscardingAttributes(! app()->isProduction());
}
```

Cùng đoạn code trên giờ báo lỗi rõ ràng:

```
Illuminate\Database\Eloquent\MassAssignmentException
Add fillable property [user_id] to allow mass assignment on [App\Models\Post].
```

Cách viết đúng — gán cột thuộc quan hệ qua chính quan hệ đó:

```php
$user->posts()->create([
    'title' => 'Bài đầu tiên', 'slug' => 'bai-dau-tien', 'body' => 'Nội dung',
    'status' => 'published', 'published_at' => now(), 'category_id' => $c->id,
]);
// user_id được điền tự động, không cần nằm trong #[Fillable]
```

### `#[Hidden]` — giấu cột khi chuyển thành JSON

```php
#[Hidden(['password', 'remember_token'])]
```

Kiểm chứng nhanh:

```bash
$ php artisan tinker --execute='echo App\Models\User::first()->toJson();'
{"id":1,"name":"Son","email":"son@test.dev","email_verified_at":"...","created_at":"...","updated_at":"..."}
```

Không có `password`. Nếu bạn tự viết model mà quên `#[Hidden]`, mọi endpoint trả model đó sẽ **lộ hash
mật khẩu**.

---

## 4. Cast — biến cột thành kiểu PHP tử tế

```php
protected function casts(): array
{
    return [
        'published_at' => 'datetime',
        'is_featured'  => 'boolean',
        'meta'         => 'array',
        'price'        => 'decimal:2',
        'password'     => 'hashed',
        'status'       => PostStatus::class,     // enum PHP
    ];
}
```

Không cast thì `$post->published_at` là **chuỗi**, và `$post->published_at->format('d/m/Y')` nổ:

```
Error  Call to a member function format() on string
```

Có cast `datetime` thì nó là đối tượng `Carbon`:

```php
$post->published_at->format('d/m/Y');       // 18/08/2026
$post->published_at->diffForHumans();       // "2 giờ trước"
$post->published_at->isPast();              // true
```

Cast `hashed` là thứ khiến `User::create(['password' => 'matkhau'])` tự băm — bạn không cần gọi
`Hash::make()`. Gọi thêm `Hash::make()` nữa là băm hai lần và **không đăng nhập được**.

### Enum cho cột trạng thái

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
}
```

```php
protected function casts(): array
{
    return ['status' => PostStatus::class];
}
```

```php
$post->status === PostStatus::Published;    // so sánh an toàn, không sợ gõ sai chuỗi
$post->status->label();                     // "Đã đăng"
```

```bash
$ php artisan make:enum Enums/PostStatus --string

 INFO Enum [app/Enums/PostStatus.php] created successfully.
```

Chú ý phần `Enums/` trong tên. Gõ `make:enum PostStatus --string` thì file rơi thẳng vào `app/PostStatus.php`
với `namespace App;` — Laravel không tự tạo thư mục `Enums/` cho bạn.

---

## 5. Quan hệ

```php
class Post extends Model
{
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
}
```

```php
class User extends Authenticatable
{
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }
}
```

Khoá ngoại được đoán từ **tên method**, không phải tên class. `belongsTo(User::class)` trong method
tên `author()` đi tìm cột `author_id`. Vì bảng của ta dùng `user_id` nên phải ghi rõ tham số thứ hai:
`belongsTo(User::class, 'user_id')`.

Quên tham số đó thì:

```
Illuminate\Database\QueryException
SQLSTATE[42703]: Undefined column: 7 ERROR:  column posts.author_id does not exist
```

Xác nhận Laravel đã hiểu đúng quan hệ:

```bash
$ php artisan model:show Post

 Relations ..
 author    BelongsTo .. App\Models\User
 category  BelongsTo .. App\Models\Category
 comments  HasMany ... App\Models\Comment
```

### Các loại quan hệ

```php
$this->hasOne(Profile::class);
$this->hasMany(Comment::class);
$this->belongsTo(User::class);
$this->belongsToMany(Tag::class);                       // cần bảng trung gian post_tag
$this->hasManyThrough(Comment::class, Post::class);     // user → posts → comments
$this->morphMany(Comment::class, 'commentable');        // đa hình
$this->morphTo();
```

Bảng trung gian cho `belongsToMany` phải đặt tên theo quy ước: **hai tên model số ít, xếp theo bảng
chữ cái, nối bằng gạch dưới** → `post_tag` (không phải `posts_tags`, không phải `tag_post`).

```php
$table->foreignId('post_id')->constrained()->cascadeOnDelete();
$table->foreignId('tag_id')->constrained()->cascadeOnDelete();
$table->primary(['post_id', 'tag_id']);
```

Gán:

```php
$post->tags()->attach($tagId);
$post->tags()->detach($tagId);
$post->tags()->sync([1, 2, 3]);          // giữ đúng 3 cái này, xoá phần còn lại
$post->tags()->syncWithoutDetaching([4]);
```

---

## 6. ⭐ `#[Scope]` — query hay dùng đặt tên lại

Laravel 13 thay tiền tố `scopeXxx` bằng attribute:

```php
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;

class Post extends Model
{
    #[Scope]
    protected function published(Builder $query): void
    {
        $query->where('status', 'published')->whereNotNull('published_at');
    }

    #[Scope]
    protected function search(Builder $query, string $term): void
    {
        $query->where(fn ($q) => $q->where('title', 'ilike', "%{$term}%")
                                   ->orWhere('body', 'ilike', "%{$term}%"));
    }
}
```

Dùng:

```php
Post::published()->latest('published_at')->paginate(10);
Post::published()->search('laravel')->get();
```

```bash
$ php artisan tinker --execute='echo App\Models\Post::published()->count();'
1
```

Cách cũ vẫn chạy (method tên `scopePublished`), nhưng attribute rõ hơn: tên method chính là tên scope,
và IDE hiểu được. Đừng trộn hai kiểu trong cùng dự án.

> `ilike` là toán tử **của PostgreSQL** (so sánh không phân biệt hoa thường). MySQL không có nó — trên
> MySQL dùng `like` là đủ vì collation mặc định đã không phân biệt hoa thường. Đây là chỗ code viết
> cho MySQL chuyển sang Postgres hay hỏng.

### Global scope — áp cho mọi query của model

```php
use Illuminate\Database\Eloquent\Attributes\ScopedBy;

#[ScopedBy(PublishedScope::class)]
class Post extends Model {}
```

Dùng thận trọng: global scope áp cả ở trang admin, khiến bạn không thấy bài nháp mà không hiểu vì sao.
Gỡ tạm bằng `Post::withoutGlobalScope(PublishedScope::class)->get()`.

---

## 7. Truy vấn

```php
Post::all();                                  // TẤT CẢ bản ghi — cẩn thận với bảng lớn
Post::find(1);                                // null nếu không có
Post::findOrFail(1);                          // ném ModelNotFoundException → 404
Post::where('status', 'published')->first();
Post::firstWhere('slug', 'bai-dau-tien');
Post::where('views', '>', 100)->get();
Post::whereIn('id', [1, 2, 3])->get();
Post::whereNull('published_at')->get();
Post::whereBetween('created_at', [$from, $to])->get();
Post::whereDate('published_at', today())->get();
Post::whereHas('comments', fn ($q) => $q->where('body', 'ilike', '%hay%'))->get();
Post::withCount('comments')->get();           // thêm thuộc tính comments_count
Post::latest()->take(5)->get();               // sắp theo created_at giảm dần
Post::latest('published_at')->get();
Post::inRandomOrder()->first();
```

### Điều kiện có/không tuỳ tình huống

Đừng viết `if` lồng nhau quanh query. Dùng `when`:

```php
$posts = Post::query()
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
```

`Post::query()` ở đầu không bắt buộc nhưng nên có: nó khiến chuỗi method thẳng hàng và IDE gợi ý tốt hơn.

### Ghi dữ liệu

```php
$post = Post::create([...]);                     // insert
$post->update(['title' => 'Mới']);               // update
$post->fill(['title' => 'Mới'])->save();
$post->delete();

Post::updateOrCreate(['slug' => 'x'], ['title' => 'X']);
Post::firstOrCreate(['slug' => 'x'], ['title' => 'X']);

Post::where('status', 'draft')->update(['status' => 'published']);   // update hàng loạt
Post::where('created_at', '<', now()->subYear())->delete();

$post->increment('views');
$post->increment('views', 5);
```

> `Post::where(...)->update(...)` chạy **một câu SQL** và **không** kích hoạt sự kiện model
> (`updating`, `saved`) cũng như không đụng `updated_at` nếu bạn không tự thêm. Đó là ưu điểm về tốc
> độ và là nhược điểm nếu bạn đang dựa vào observer.

### Xoá mềm

```php
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;
}
```

Migration cần `$table->softDeletes();`.

```php
$post->delete();                     // chỉ set deleted_at
Post::withTrashed()->get();          // cả đã xoá
Post::onlyTrashed()->get();
$post->restore();
$post->forceDelete();                // xoá thật
```

---

## 8. Factory và Seeder — dữ liệu để thử

```php
namespace Database\Factories;

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
            'slug'         => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 100000),
            'body'         => fake()->paragraphs(5, true),
            'status'       => 'published',
            'published_at' => fake()->dateTimeBetween('-1 year'),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft', 'published_at' => null]);
    }
}
```

```php
Post::factory()->count(30)->create();
Post::factory()->draft()->count(5)->create();
Post::factory()->for($user, 'author')->has(Comment::factory()->count(3))->create();
```

Seeder:

```php
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::factory()->create([
            'name' => 'Quản trị', 'email' => 'admin@blog.test',
        ]);

        $categories = Category::factory()->count(4)->create();

        Post::factory()->count(30)
            ->recycle([$admin, ...$categories])
            ->has(Comment::factory()->count(2))
            ->create();
    }
}
```

`recycle()` bảo factory dùng lại đúng những model đã có thay vì tạo mới 30 user và 30 category.

```bash
$ php artisan db:seed
$ php artisan migrate:fresh --seed
```

---

## 9. ⭐ N+1 — lỗi hiệu năng số một

### Đo thật

```php
DB::enableQueryLog();
foreach (Post::all() as $p) { $x = $p->author->name; }
echo count(DB::getQueryLog());
```

Với 4 bài viết:

```
KHONG eager load: 5 query
  select * from "posts"
  select * from "users" where "users"."id" = ? limit 1
  select * from "users" where "users"."id" = ? limit 1
  select * from "users" where "users"."id" = ? limit 1
  select * from "users" where "users"."id" = ? limit 1
```

1 query lấy bài + 4 query lấy tác giả = **N+1**. Với 100 bài là 101 query.

Thêm `with()`:

```php
foreach (Post::with('author')->get() as $p) { $x = $p->author->name; }
```

```
CO eager load: 2 query
  select * from "posts"
  select * from "users" where "users"."id" in (1)
```

Luôn **2 query**, dù có 4 hay 4000 bài viết.

```php
Post::with(['author', 'category', 'comments.author'])->get();      // lồng nhau
Post::with(['author:id,name'])->get();                             // chỉ lấy cột cần
Post::withCount('comments')->get();                                // đếm, không nạp
$post->load('comments');                                           // nạp sau
```

### Bắt N+1 tự động

```php
// AppServiceProvider::boot()
Model::preventLazyLoading(! app()->isProduction());
```

```
Illuminate\Database\LazyLoadingViolationException
Attempted to lazy load [author] on model [App\Models\Post] but lazy loading is disabled.
```

> ⚠️ **Chi tiết dễ hiểu nhầm, đã đọc mã nguồn để chắc chắn:** công tắc này **không** báo lỗi khi
> collection chỉ có **một** model. Trong `Illuminate\Database\Eloquent\Builder::hydrate()`:
>
> ```php
> if (count($items) > 1) {
>     $model->preventsLazyLoading = Model::preventsLazyLoading();
> }
> ```
>
> Đo thật:
> ```
> $ php artisan tinker --execute='...'
> so post = 4
> Son                                             ← lấy 1 model: KHÔNG báo lỗi
> nhieu model -> Illuminate\Database\LazyLoadingViolationException
> ```
>
> Thiết kế như vậy là có lý — một model thì không thể thành N+1. Nhưng nó nghĩa là **test trên dữ liệu
> chỉ có 1 bản ghi sẽ không phát hiện được N+1**. Seed ít nhất 2 bản ghi khi viết test.

Bật cả bộ ba trong `AppServiceProvider::boot()`:

```php
public function boot(): void
{
    Model::preventLazyLoading(! app()->isProduction());
    Model::preventSilentlyDiscardingAttributes(! app()->isProduction());
    Model::preventAccessingMissingAttributes(! app()->isProduction());
}
```

Hoặc gọn hơn:

```php
Model::shouldBeStrict(! app()->isProduction());
```

Ba công tắc này biến ba loại lỗi âm thầm thành exception ngay lúc dev. Bật từ ngày đầu tiên của dự án
— bật sau khi đã có 200 file thì bạn sẽ ngập trong lỗi và tắt nó đi.

---

## 10. Query Builder khi Eloquent không hợp

Với báo cáo hoặc thống kê, Eloquent hydrate model là phí:

```php
use Illuminate\Support\Facades\DB;

$stats = DB::table('posts')
    ->select('category_id', DB::raw('count(*) as total'))
    ->where('status', 'published')
    ->groupBy('category_id')
    ->orderByDesc('total')
    ->get();
```

Trả về `stdClass`, không phải model — không có quan hệ, không có cast, nhưng nhanh hơn nhiều.

### Transaction

```php
DB::transaction(function () use ($data) {
    $post = Post::create($data);
    $post->tags()->sync($data['tags']);
    Activity::log('post.created', $post);
});
```

Ném exception ở bất kỳ đâu trong closure → rollback toàn bộ. Đừng bắt exception bên trong rồi nuốt nó,
vì như vậy transaction vẫn commit.

---

## 11. Xem query đang chạy

Cách nhanh nhất khi đang dev — thêm vào `AppServiceProvider::boot()`:

```php
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

if (! app()->isProduction()) {
    DB::listen(function ($query) {
        Log::debug($query->sql, ['bindings' => $query->bindings, 'ms' => $query->time]);
    });
}
```

Rồi mở khung log của `php artisan dev` (Pail) và bấm quanh ứng dụng — mọi query hiện ra ngay.

Cách nhanh hơn nữa cho một đoạn cụ thể:

```php
Post::published()->with('author')->dd();      // in SQL rồi dừng
Post::published()->dump();                    // in SQL rồi chạy tiếp
Post::published()->toSql();                   // trả chuỗi SQL
```

---

## Bài tập

1. Tạo migration cho `categories`, `posts`, `comments` theo đúng quan hệ trong bài. Cố tình đặt
   `create_posts_table` có mốc thời gian **sớm hơn** `create_categories_table`, chạy `migrate` và ghi
   lại nguyên văn lỗi. Sửa bằng cả hai cách trong mục 1.

2. Chạy `php artisan model:show Post`. Chỉ ra cột nào **không** fillable và giải thích vì sao nên như vậy.

3. Bật `Model::shouldBeStrict()` trong `AppServiceProvider`. Chạy `Post::create([... 'user_id' => 1])`
   và ghi lại exception. Sau đó viết lại cho đúng bằng `$user->posts()->create([...])`.

4. Viết `#[Scope] published()` và `#[Scope] search(string $term)`. Dùng chúng nối nhau và in ra SQL
   bằng `->toSql()`.

5. Seed 30 bài viết. Viết vòng lặp in tên tác giả **không** dùng `with()`, đếm query bằng
   `DB::enableQueryLog()`. Rồi thêm `with('author')` và đếm lại. Ghi cả hai con số.

6. Bật `Model::preventLazyLoading()`. Viết một đoạn chỉ lấy **1** bài viết rồi gọi `$post->author`.
   Giải thích vì sao không có exception.

7. Cast `status` thành enum `PostStatus`. Thử `$post->status->label()` và `$post->status === PostStatus::Published`.

<details>
<summary>Gợi ý đáp án</summary>

**2.** `user_id` không fillable. Vì tác giả bài viết **không được** do người dùng gửi lên — nó phải lấy
từ phiên đăng nhập (`$request->user()->posts()->create(...)`). Cho `user_id` vào `#[Fillable]` là mở
đường cho người dùng đăng bài dưới tên người khác.

**5.** Với 30 bài: không eager load → **31 query**; có `with('author')` → **2 query**. Con số 2 không
đổi dù tăng lên 3000 bài.

**6.** `Builder::hydrate()` chỉ gán cờ `preventsLazyLoading` cho model khi `count($items) > 1`. Một
model thì không phải N+1 nên Laravel cố ý bỏ qua. Kéo theo: test N+1 phải seed từ 2 bản ghi trở lên.

</details>

---

Tiếp theo: [04-validation-va-form.md](./04-validation-va-form.md).
