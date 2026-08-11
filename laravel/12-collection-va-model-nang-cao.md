# Bài 12 — Collection, Accessor, Observer, Artisan và Đa ngôn ngữ

Năm mảng Laravel dùng hằng ngày nhưng hay bị bỏ qua khi tự học. Cả năm đều là chủ đề phỏng vấn hay hỏi
vì chúng cho thấy bạn có dùng framework đủ sâu hay chỉ dừng ở CRUD.

---

## 1. Collection — thứ bạn dùng nhiều nhất mà không để ý

Mọi `->get()` của Eloquent trả về `Illuminate\Database\Eloquent\Collection`, không phải mảng PHP. Đó là
lý do bạn xâu chuỗi được `->map()->filter()->sortBy()`.

```php
$don = collect([
    ['id' => 1, 'kh' => 'An',   'mon' => 'pho', 'tien' => 50000, 'tt' => 'xong'],
    ['id' => 2, 'kh' => 'Binh', 'mon' => 'bun', 'tien' => 40000, 'tt' => 'xong'],
    ['id' => 3, 'kh' => 'An',   'mon' => 'com', 'tien' => 60000, 'tt' => 'huy'],
    ['id' => 4, 'kh' => 'An',   'mon' => 'pho', 'tien' => 50000, 'tt' => 'xong'],
]);
```

Chạy thật:

```bash
$ php artisan tinker --execute='...'

sum       : 140000
avg       : 46666.666666667
pluck     : pho, bun, com
groupBy   : {"An":3,"Binh":1}
reduce    : 200000
countBy   : {"pho":2,"bun":1,"com":1}
partition : [3,1]
```

Code sinh ra chúng:

```php
$don->where('tt', 'xong')->sum('tien');                 // 140000
$don->where('tt', 'xong')->avg('tien');                 // 46666.67
$don->pluck('mon')->unique()->implode(', ');            // "pho, bun, com"
$don->groupBy('kh')->map->count();                      // {"An":3,"Binh":1}
$don->reduce(fn ($carry, $i) => $carry + $i['tien'], 0);// 200000
$don->countBy('mon');                                   // {"pho":2,"bun":1,"com":1}
$don->partition(fn ($i) => $i['tt'] === 'xong');         // [3 xong, 1 huỷ]
```

Chú ý `->map->count()` — đây là **higher order message**, viết tắt của `->map(fn ($g) => $g->count())`.
Dùng được với `map`, `filter`, `each`, `sum`, `every`…

### Nhóm method theo mục đích

```php
// Biến đổi
->map(fn ($x) => ...)          ->flatMap()      ->mapWithKeys()
->pluck('name', 'id')          ->flatten()      ->collapse()
->transform()                  // sửa tại chỗ, khác map ở chỗ không tạo collection mới

// Lọc
->filter(fn ($x) => ...)       ->reject()       ->where('k', 'v')
->whereIn()  ->whereNotNull()  ->unique('k')    ->duplicates()
->only(['a','b'])              ->except()       ->take(5)   ->skip(3)

// Tổng hợp
->sum('tien')  ->avg()  ->min()  ->max()  ->count()  ->median()
->reduce(fn ($c, $i) => ..., 0)
->countBy('mon')               ->groupBy('kh')  ->keyBy('id')
->partition(fn ($x) => ...)    // tách làm 2 nhóm: khớp / không khớp

// Sắp xếp
->sortBy('tien')  ->sortByDesc()  ->sortKeys()  ->shuffle()
->sort(fn ($a, $b) => ...)

// Kiểm tra
->contains('mon', 'pho')  ->every(fn ($x) => ...)  ->some()
->isEmpty()  ->isNotEmpty()

// Kết thúc chuỗi
->first()  ->firstWhere('tt', 'xong')  ->last()  ->all()  ->toArray()
->implode(', ')  ->join(', ', ' và ')

// Gỡ lỗi giữa chuỗi
->dump()   ->dd()   ->tap(fn ($c) => Log::debug($c->count()))
```

### `where` của Collection ≠ `where` của Eloquent

```php
Post::where('status', 'published')->get();     // lọc ở DATABASE — chỉ lấy về bản ghi cần
Post::all()->where('status', 'published');     // lấy HẾT về RAM rồi mới lọc
```

Cách hai chạy đúng nhưng nạp toàn bộ bảng vào bộ nhớ. Đây là lỗi hiệu năng rất hay gặp vì hai dòng
trông gần giống nhau.

**Quy tắc: lọc và sắp xếp ở database; chỉ dùng Collection cho dữ liệu đã lấy về.**

### `LazyCollection` — khi dữ liệu quá lớn

Đo thật với 2.000.000 phần tử, `memory_limit = 128M`:

```php
// Collection thường
collect(range(1, 2_000_000))->map(fn ($n) => $n * 2)->filter(fn ($n) => $n % 3 === 0)->count();
```
```
PHP Fatal error:  Allowed memory size of 134217728 bytes exhausted
(tried to allocate 33554440 bytes) in .../Illuminate/Collections/Arr.php on line 863
```

```php
// LazyCollection — dùng generator, giữ 1 phần tử tại một thời điểm
LazyCollection::make(function () {
        for ($n = 1; $n <= 2_000_000; $n++) { yield $n; }
    })
    ->map(fn ($n) => $n * 2)
    ->filter(fn ($n) => $n % 3 === 0)
    ->count();
```
```
LazyCollection  : 666666 phan tu, dinh bo nho 23.3 MB
```

Cùng phép tính: một cái **chết**, một cái chạy trong 23 MB (phần lớn là baseline của Laravel).

Với Eloquent, `cursor()` trả về `LazyCollection`:

```php
Post::cursor()->filter(fn ($p) => $p->views > 100)->each(fn ($p) => ...);
```

Xem thêm [nang-cao/01 mục 5](./nang-cao/01-toi-uu-eloquent.md) để so `cursor` với `chunkById`.

### Collection tuỳ biến cho model

```php
use Illuminate\Database\Eloquent\Attributes\CollectedBy;

#[CollectedBy(PostCollection::class)]
class Post extends Model {}
```

```php
class PostCollection extends Collection
{
    public function tongLuotXem(): int
    {
        return $this->sum('views');
    }
}
```

```php
Post::published()->get()->tongLuotXem();
```

---

## 2. Accessor và Mutator

`casts()` biến đổi theo kiểu có sẵn. Accessor/Mutator dùng khi bạn cần **logic riêng**.

```php
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Str;

class Post extends Model
{
    // Chỉ đọc — cột "excerpt" KHÔNG tồn tại trong database
    protected function excerpt(): Attribute
    {
        return Attribute::get(fn () => Str::limit(strip_tags($this->body), 50));
    }

    // Đọc và ghi
    protected function title(): Attribute
    {
        return Attribute::make(
            get: fn (string $value) => ucfirst($value),
            set: fn (string $value) => trim($value),
        );
    }
}
```

Chạy thật:

```bash
$ php artisan tinker --execute='
    $p = $u->posts()->create(["title" => "   hoc laravel 13 that ky   ", ...]);
    $p->refresh();
    echo "title đã lưu (mutator trim)     : [" . $p->getRawOriginal("title") . "]\n";
    echo "title đọc ra (accessor ucfirst) : [" . $p->title . "]\n";
    echo "excerpt (accessor tính toán)    : " . $p->excerpt . "\n";
    echo "có trong toArray không? " . (array_key_exists("excerpt", $p->toArray()) ? "CÓ" : "KHÔNG") . "\n";
'
title đã lưu (mutator trim)     : [hoc laravel 13 that ky]
title đọc ra (accessor ucfirst) : [Hoc laravel 13 that ky]
excerpt (accessor tính toán)    : noi dung rat dai noi dung rat dai noi dung rat dai..
có trong toArray không? KHÔNG
```

Ba điều rút ra:

1. **Mutator chạy lúc ghi** — dấu cách thừa bị `trim()` trước khi vào database.
2. **Accessor chạy lúc đọc** — `getRawOriginal()` cho giá trị gốc trong database, `$p->title` cho giá
   trị đã qua accessor.
3. **Accessor không tự vào JSON.** Đây là điểm hay bị bất ngờ.

### Đưa accessor vào JSON

```php
use Illuminate\Database\Eloquent\Attributes\Appends;

#[Appends(['excerpt'])]
class Post extends Model {}
```

Hoặc từng lần:

```bash
$ php artisan tinker --execute='echo json_encode(array_keys(App\Models\Post::first()->append("excerpt")->toArray()));'
["id","user_id","category_id","title","slug","body","status","published_at","created_at","updated_at","excerpt"]
```

### Cache accessor nặng

```php
protected function excerpt(): Attribute
{
    return Attribute::get(fn () => Str::limit(strip_tags($this->body), 50))->shouldCache();
}
```

Không có `shouldCache()`, gọi `$post->excerpt` 10 lần trong view là chạy `strip_tags` 10 lần.

### ⚠️ Accessor không dùng được trong `WHERE` — và SQLite giấu lỗi này

Accessor sống trong PHP, không có cột tương ứng trong database:

```php
Post::where('excerpt', 'like', '%laravel%')->get();     // ❌ cột không tồn tại
```

Trên **PostgreSQL** bạn nhận lỗi rõ ràng:

```
ERROR:  column "excerpt" does not exist
LINE 1: SELECT * FROM posts WHERE "excerpt" = 1;
                                  ^
```

Trên **SQLite** thì **không có lỗi nào** — và đây mới là phần nguy hiểm:

```bash
$ php chk.php
KHONG loi, dem = 0
```

Nguyên nhân là một đặc tính riêng của SQLite: **định danh trong nháy kép mà không khớp cột nào thì
được coi là chuỗi**. Eloquent luôn sinh SQL có nháy kép quanh tên cột:

```sql
select * from "posts" where "excerpt" like ?
```

Chứng minh sự khác nhau:

```bash
$ php artisan tinker --execute='
    // KHÔNG nháy kép
    DB::select("select * from posts where excerpt like ?", ["%x%"]);
'
LOI: no such column: excerpt

$ php artisan tinker --execute='
    // CÓ nháy kép — giống hệt SQL Eloquent sinh ra
    $r = DB::select("select * from posts where \"excerpt\" like ?", ["%x%"]);
    echo count($r);
'
khong loi, dem = 4

$ php artisan tinker --execute='
    $r = DB::select("select * from posts where \"excerpt\" = ?", ["excerpt"]);
    echo count($r);
'
khop chuoi "excerpt": 4 dong        ← so sánh chuỗi "excerpt" = "excerpt" → đúng với MỌI dòng
```

Dòng cuối là bằng chứng: SQLite biến `"excerpt"` thành chuỗi `'excerpt'`, nên điều kiện thành
`'excerpt' = 'excerpt'` — **đúng với mọi bản ghi**. Một bộ lọc gõ sai tên cột sẽ âm thầm trả về
**toàn bộ bảng** thay vì báo lỗi.

Đây là lý do nữa để cho test chạy đúng loại database với production
([nang-cao/07 mục 1](./nang-cao/07-testing-chuyen-sau.md)): trên SQLite lỗi này im lặng, trên
PostgreSQL nó nổ ngay.

Cần lọc thì phải lọc trên cột thật (`body`), hoặc thêm cột sinh sẵn trong database.

---

## 3. Observer — phản ứng theo vòng đời model

```bash
$ php artisan make:observer PostObserver --model=Post

 INFO Observer [app/Observers/PostObserver.php] created successfully.
```

Đăng ký bằng attribute (Laravel 13):

```php
use Illuminate\Database\Eloquent\Attributes\ObservedBy;

#[ObservedBy(PostObserver::class)]
class Post extends Model {}
```

### Thứ tự hook — đo thật

```php
class PostObserver
{
    public function creating(Post $post): void
    {
        $post->slug ??= Str::slug($post->title);      // tự sinh slug
    }

    public function created(Post $post): void  { /* ... */ }
    public function updating(Post $post): void { /* ... */ }
    public function updated(Post $post): void  { /* ... */ }
    public function saving(Post $post): void   { /* ... */ }
    public function saved(Post $post): void    { /* ... */ }
    public function deleted(Post $post): void  { /* ... */ }
}
```

```bash
$ php artisan tinker --execute='
    $p = $u->posts()->create(["title"=>"Bai test observer","body"=>"noi dung","status"=>"draft"]);
    echo "slug tự sinh: " . $p->slug . "\n";
    $p->update(["title" => "Da sua"]);
    $p->delete();
'
slug tự sinh: bai-test-observer
```

Thứ tự thật ghi được:

```
── create ──      ── update ──      ── delete ──
saving            saving            deleted
creating          updating
created           updated
saved             saved
```

Ghi nhớ: **`saving`/`saved` bao ngoài cả create lẫn update.** Muốn xử lý cả hai trường hợp thì dùng
`saving`; muốn phân biệt thì dùng `creating`/`updating`.

Hook `creating` chạy **trước** khi ghi database nên sửa được `$post`. Hook `created` chạy **sau**, sửa
ở đó phải `save()` lại (và sinh ra vòng lặp vô hạn nếu không cẩn thận).

Danh sách đầy đủ: `retrieved`, `creating`, `created`, `updating`, `updated`, `saving`, `saved`,
`deleting`, `deleted`, `restoring`, `restored`, `forceDeleting`, `forceDeleted`, `replicating`.

### Bốn cái bẫy của Observer

**1. Update hàng loạt không kích hoạt observer.**

```php
Post::where('status', 'draft')->update(['status' => 'published']);
```

Một câu SQL, không nạp model → **không hook nào chạy**. Cache không được xoá, slug không được sinh.

**2. Tác dụng phụ ẩn.**

```php
public function created(Post $post): void
{
    Mail::to($post->author)->send(new PostPublished($post));    // ❌
}
```

Từ đó **mọi** `Post::create()` — kể cả trong seeder và test — đều gửi mail. Không ai đọc controller mà
đoán ra. Việc gửi mail thuộc về Action hoặc Listener của một event tường minh
([nang-cao/05 mục 9](./nang-cao/05-kien-truc-du-an-lon.md)).

**3. Observer chạy trong queue job.** Job chạy lại → observer chạy lại.

**4. Tắt tạm khi cần.**

```php
Post::withoutEvents(fn () => Post::create([...]));
$post->saveQuietly();
$post->deleteQuietly();
```

Hữu ích khi seed dữ liệu hoặc migrate.

### Observer nên làm gì

| Hợp | Không hợp |
|-----|-----------|
| Sinh slug/uuid trong `creating` | Gửi mail |
| Xoá cache trong `saved`/`deleted` | Gọi API bên thứ ba |
| Ghi nhật ký thay đổi | Logic nghiệp vụ chính |
| Dọn file kèm theo trong `deleting` | Bất cứ thứ gì có thể thất bại |

---

## 4. Artisan command tự viết

```bash
$ php artisan make:command PublishScheduledPosts

 INFO Console command [app/Console/Commands/PublishScheduledPosts.php] created successfully.
```

> ⭐ **Laravel 13 lại dùng attribute.** File sinh ra dùng `#[Signature]` và `#[Description]` thay cho
> `protected $signature` / `protected $description` của các bản trước:
>
> ```php
> use Illuminate\Console\Attributes\Description;
> use Illuminate\Console\Attributes\Signature;
>
> #[Signature('app:publish-scheduled-posts')]
> #[Description('Command description')]
> class PublishScheduledPosts extends Command
> {
>     public function handle() { }
> }
> ```
>
> Code trên mạng viết `protected $signature` vẫn chạy, nhưng bản 13 sinh ra kiểu attribute.

### Command hoàn chỉnh

```php
namespace App\Console\Commands;

use App\Models\Post;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('posts:publish {--dry-run : Chỉ xem, không ghi} {--limit=100 : Số bài tối đa}')]
#[Description('Đăng các bài viết đã tới giờ hẹn')]
class PublishScheduledPosts extends Command
{
    public function handle(): int
    {
        $posts = Post::where('status', 'draft')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now())
            ->limit((int) $this->option('limit'))
            ->get();

        if ($posts->isEmpty()) {
            $this->info('Không có bài nào tới giờ đăng.');
            return self::SUCCESS;
        }

        $this->table(['ID', 'Tiêu đề', 'Hẹn lúc'],
            $posts->map(fn ($p) => [$p->id, $p->title, $p->published_at])->all());

        if ($this->option('dry-run')) {
            $this->warn("Chế độ thử — không ghi gì. Sẽ đăng {$posts->count()} bài.");
            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar($posts->count());
        foreach ($posts as $post) {
            $post->update(['status' => 'published']);
            $bar->advance();
        }
        $bar->finish();
        $this->newLine();
        $this->info("Đã đăng {$posts->count()} bài.");

        return self::SUCCESS;
    }
}
```

### Cú pháp signature

```
{ten}                    tham số bắt buộc
{ten?}                   tham số tuỳ chọn
{ten=mac-dinh}           có giá trị mặc định
{ten*}                   nhận nhiều giá trị
{--co}                   cờ bật/tắt
{--gia-tri=}             tuỳ chọn có giá trị
{--l|limit=100}          có tên viết tắt
{--limit=100 : Mô tả}    dấu hai chấm là phần mô tả trong help
```

Laravel tự sinh trang help:

```bash
$ php artisan help posts:publish

Description:
  Đăng các bài viết đã tới giờ hẹn

Usage:
  posts:publish [options]

Options:
      --dry-run         Chỉ xem, không ghi
      --limit[=LIMIT]   Số bài tối đa [default: "100"]
```

### Chạy thật

```bash
$ php artisan posts:publish --dry-run
+----+-----------+---------------------+
| ID | Tiêu đề   | Hẹn lúc             |
+----+-----------+---------------------+
| 3  | Bai hen 1 | 2026-08-19 03:19:17 |
| 4  | Bai hen 2 | 2026-08-19 03:19:17 |
| 5  | Bai hen 3 | 2026-08-19 03:19:17 |
+----+-----------+---------------------+
Chế độ thử — không ghi gì. Sẽ đăng 3 bài.
```

```bash
$ php artisan posts:publish
 3/3 [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓] 100%
Đã đăng 3 bài.
```

Cờ `--dry-run` nên có ở **mọi** command sửa dữ liệu. Nó là thứ cứu bạn khi chạy nhầm trên production.

### Tương tác và định dạng output

```php
$this->info('xanh');   $this->warn('vàng');   $this->error('đỏ');   $this->line('thường');
$this->newLine(2);

$ten     = $this->ask('Tên bài viết?');
$matKhau = $this->secret('Mật khẩu?');
$chac    = $this->confirm('Chắc chưa?', default: false);
$chon    = $this->choice('Trạng thái?', ['draft', 'published'], 0);

$this->table(['Cột A', 'Cột B'], $rows);
$this->withProgressBar($posts, fn ($p) => $p->update([...]));

// Laravel Prompts — giao diện đẹp hơn
use function Laravel\Prompts\{text, select, confirm, spin};
$ten = text('Tên bài viết?', required: true);
```

### Mã thoát — quan trọng khi chạy trong CI

```php
return self::SUCCESS;   // 0
return self::FAILURE;   // 1
return self::INVALID;   // 2
```

Không `return` gì thì mặc định là 0 — CI sẽ tưởng thành công dù command hỏng.

### Gắn vào lịch chạy

```php
// routes/console.php
Schedule::command('posts:publish')->everyFiveMinutes()->withoutOverlapping();
```

```bash
$ php artisan schedule:list
 */5 * * * *  php artisan posts:publish  Next Due: 3 minutes from now
```

### Gọi command từ code

```php
Artisan::call('posts:publish', ['--limit' => 50]);
$this->call('posts:publish');            // từ command khác
$this->callSilently('cache:clear');
```

### Command dạng closure

Với việc đơn giản, không cần cả một class:

```php
// routes/console.php
Artisan::command('posts:count', function () {
    $this->info('Tổng số bài: ' . \App\Models\Post::count());
})->purpose('Đếm số bài viết');
```

---

## 5. Đa ngôn ngữ

```ini
APP_LOCALE=vi
APP_FALLBACK_LOCALE=en
```

```php
// lang/vi/blog.php
return [
    'title'    => 'Bài viết',
    'greeting' => 'Chào :name',
    'comments' => '{0} Chưa có bình luận|{1} 1 bình luận|[2,*] :count bình luận',
];
```

Chạy thật:

```bash
$ php artisan tinker --execute='
    app()->setLocale("vi");
    echo __("blog.title") . "\n";
    echo __("blog.greeting", ["name" => "Son"]) . "\n";
    echo trans_choice("blog.comments", 0) . "\n";
    echo trans_choice("blog.comments", 1) . "\n";
    echo trans_choice("blog.comments", 5) . "\n";
    app()->setLocale("en");
    echo "không có bản dịch en -> " . __("blog.title") . "\n";
'
Bài viết
Chào Son
Chưa có bình luận
1 bình luận
5 bình luận
không có bản dịch en -> blog.title
```

Bốn điều rút ra:

1. `:name` là chỗ thay tham số.
2. `trans_choice` chọn nhánh theo số lượng: `{0}`, `{1}`, `[2,*]`.
3. `:count` trong nhánh tự nhận số bạn truyền vào.
4. **Không tìm thấy bản dịch thì Laravel trả về chính cái khoá** (`blog.title`) — không nổ lỗi. Đây là
   lý do bạn thấy chữ `blog.title` hiện lên giao diện: thiếu file dịch, không phải lỗi code.

### Trong Blade

```blade
<h1>{{ __('blog.title') }}</h1>
<p>{{ trans_choice('blog.comments', $post->comments_count) }}</p>
@lang('blog.greeting', ['name' => $user->name])
```

### Việt hoá thông báo validate

```bash
$ php artisan lang:publish
 INFO Language files published successfully.
```

Sinh `lang/en/validation.php`. Chép sang `lang/vi/validation.php` và dịch — chi tiết ở
[bài 04 mục 6](./04-validation-va-form.md).

### Đổi ngôn ngữ theo người dùng

```php
// app/Http/Middleware/SetLocale.php
public function handle(Request $request, Closure $next): Response
{
    $locale = $request->user()?->locale
        ?? $request->getPreferredLanguage(['vi', 'en'])
        ?? config('app.locale');

    App::setLocale($locale);

    return $next($request);
}
```

> ⚠️ **Dùng `App::setLocale()`, đừng dùng `config(['app.locale' => ...])`.** Sửa config lúc chạy sẽ rò
> rỉ sang request sau khi chạy Octane
> ([nang-cao/08 mục 4](./nang-cao/08-deploy-octane-docker.md)).

### Dịch nội dung trong database

File `lang/` chỉ dịch **giao diện**. Nội dung do người dùng nhập cần cột riêng:

```php
$table->json('title');      // {"vi": "Bài viết", "en": "Post"}
```

```php
protected function casts(): array
{
    return ['title' => 'array'];
}

protected function localizedTitle(): Attribute
{
    return Attribute::get(fn () => $this->title[app()->getLocale()] ?? $this->title['en'] ?? '');
}
```

---

## Bài tập

1. Tạo collection 4 đơn hàng như mục 1. Tính tổng tiền đơn "xong", nhóm theo khách, đếm theo món, và
   tách thành hai nhóm xong/huỷ. Dán kết quả.

2. So sánh `Post::where('status','published')->get()` với `Post::all()->where('status','published')`.
   Dùng `DB::listen` xem SQL của cả hai. Cái nào lấy về ít dữ liệu hơn?

3. Chạy `collect(range(1, 2_000_000))->map(...)->filter(...)->count()` với `memory_limit=128M`. Ghi
   lại lỗi. Viết lại bằng `LazyCollection` và ghi đỉnh bộ nhớ.

4. Viết accessor `excerpt` và mutator `title` (trim). Lưu tiêu đề có dấu cách thừa, rồi in
   `getRawOriginal('title')` và `$post->title`. Giải thích khác biệt.

5. Kiểm tra `excerpt` có trong `toArray()` không. Thêm `#[Appends(['excerpt'])]` và kiểm tra lại.

6. Thử `Post::where('excerpt', 'like', '%laravel%')->get()`. Ghi lại lỗi và giải thích.

7. Viết `PostObserver` ghi log ở 7 hook. Tạo, sửa, xoá một bài viết rồi dán thứ tự hook. Sau đó chạy
   `Post::where(...)->update(...)` và xem hook nào chạy.

8. Viết command `posts:publish` có `--dry-run` và `--limit`. Chạy `php artisan help posts:publish` và
   dán output. Chạy với `--dry-run` rồi chạy thật.

9. Bỏ `return self::SUCCESS` khỏi command và cho nó `return self::FAILURE` khi có lỗi. Kiểm tra mã
   thoát bằng `php artisan posts:publish; echo $?`.

10. Tạo `lang/vi/blog.php` với `trans_choice` 3 nhánh. Gọi với 0, 1, 5. Rồi đổi locale sang `en`
    (chưa có bản dịch) và xem kết quả.

<details>
<summary>Gợi ý đáp án</summary>

**2.** `Post::where(...)->get()` sinh `select * from posts where status = 'published'` — database chỉ
trả về bản ghi khớp. `Post::all()->where(...)` sinh `select * from posts` — **lấy hết** rồi lọc trong
PHP. Với bảng 1 triệu dòng, cách hai nạp cả triệu bản ghi vào RAM.

**3.**
```
PHP Fatal error:  Allowed memory size of 134217728 bytes exhausted (tried to allocate 33554440 bytes)
in .../Illuminate/Collections/Arr.php on line 863
```
`LazyCollection` cùng phép tính: **666666 phần tử, đỉnh bộ nhớ 23.3 MB**.

**4.** Mutator chạy lúc **ghi**, nên database lưu `hoc laravel 13 that ky` (đã trim). Accessor chạy lúc
**đọc**, nên `$post->title` trả `Hoc laravel 13 that ky` (đã ucfirst). `getRawOriginal()` bỏ qua accessor.

**5.** Mặc định **KHÔNG** có trong `toArray()`. Accessor chỉ chạy khi bạn truy cập thuộc tính, không tự
xuất hiện trong JSON. Thêm `#[Appends(['excerpt'])]` thì có.

**6.** Tuỳ database — và đó chính là bài học:

- **PostgreSQL**: `ERROR: column "excerpt" does not exist` — hỏng ngay, dễ phát hiện.
- **SQLite**: **không lỗi**, trả về 0 dòng. Vì SQLite coi định danh trong nháy kép không khớp cột nào
  là **chuỗi**, mà Eloquent luôn sinh `where "excerpt" like ?`. Thử `where "excerpt" = 'excerpt'` sẽ
  khớp **toàn bộ** bảng.

Accessor sống trong PHP, không có cột trong database nên `WHERE` không dùng được ở cả hai.

**7.** Thứ tự thật:
```
create: saving → creating → created → saved
update: saving → updating → updated → saved
delete: deleted
```
`Post::where(...)->update(...)` **không kích hoạt hook nào** — nó là một câu SQL, không nạp model.

**10.** `{0}` → "Chưa có bình luận"; `{1}` → "1 bình luận"; `[2,*]` với 5 → "5 bình luận". Đổi sang
`en` chưa có bản dịch → in ra chính khoá `blog.title`, không có lỗi.

</details>

---

Tiếp theo: [phong-van/](./phong-van/README.md) — luyện trả lời phỏng vấn.
