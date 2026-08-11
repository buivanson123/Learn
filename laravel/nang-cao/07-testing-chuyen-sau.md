# Nâng cao 07 — Testing chuyên sâu

Kiến thức nền ở [bài 07 cơ bản](../07-queue-mail-event-test.md). Bài này về những vấn đề xuất hiện khi
bộ test lớn lên: chạy 4 phút, thỉnh thoảng đỏ không rõ lý do, và **test xanh mà production vẫn hỏng**.

---

## 1. Vấn đề lớn nhất: test chạy trên database khác production

`phpunit.xml` sinh sẵn:

```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

Ứng dụng chạy PostgreSQL. Hệ quả đo được thật:

```
SQLSTATE[HY000]: General error: 1 near "ilike": syntax error
(Connection: sqlite, Database: :memory:, SQL: select count(*) as "aggregate" from "posts" where "title" ilike %Hoc%)
```

`ilike` là toán tử riêng của PostgreSQL. Query này chạy hoàn hảo trên trình duyệt và chết trong test.

Chiều ngược lại còn tệ hơn: những thứ SQLite **cho qua** mà PostgreSQL từ chối.

| Tình huống | SQLite | PostgreSQL |
|-----------|--------|-----------|
| `WHERE id = 'abc'` trên cột bigint | Ép về `0`, trả rỗng | `SQLSTATE[22P02] invalid input syntax for type bigint` |
| `GROUP BY` thiếu cột trong `SELECT` | Cho qua | Lỗi |
| So chuỗi phân biệt hoa thường | Tuỳ collation | Phân biệt |
| Khoá ngoại | Phải bật thủ công | Luôn bật |
| Kiểu `json` | Là `text` | Có toán tử riêng |

Test xanh trên SQLite **không chứng minh gì** về production.

### Sửa

```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="blog_test"/>
```

Laravel tự tạo database ở lần chạy đầu:

```bash
$ docker exec blog-pg psql -U blog -d postgres -c '\l' | grep blog
 blog       | blog  |
 blog_test  | blog  |      ← Laravel tự tạo
```

Đánh đổi: chậm hơn SQLite in-memory. Bù lại bằng test song song (mục 5).

---

## 2. Ba mức test và tỷ lệ

| Mức | Chạy gì | Tốc độ | Tỷ lệ nên có |
|-----|---------|--------|--------------|
| Unit | Một class, không đụng database | ~1ms | 20% |
| Feature | Một HTTP request qua toàn bộ ứng dụng | ~50ms | 70% |
| Browser | Trình duyệt thật (Dusk/Playwright) | ~3s | 10% |

Với Laravel, **feature test là chủ lực**. Nó đi qua route, middleware, controller, validate, policy,
model và view — nghĩa là nó bắt được lỗi ở mọi tầng bằng một lời gọi.

Unit test chỉ đáng viết cho logic thuần: tính tiền, định dạng, thuật toán. Viết unit test cho một
controller là mock cả framework rồi test chính cái mock của mình.

---

## 3. Test đúng hành vi, không đúng cách cài đặt

```php
// ❌ test cách cài đặt — đổi tên method là đỏ, dù hành vi không đổi
public function test_goi_dung_service(): void
{
    $mock = Mockery::mock(PostService::class);
    $mock->shouldReceive('create')->once();
    // ...
}

// ✅ test hành vi — chỉ đỏ khi hành vi thật sự sai
public function test_dang_bai_thi_bai_xuat_hien_o_trang_chu(): void
{
    $user = User::factory()->create();

    $this->actingAs($user)->post('/posts', [
        'title'  => 'Bai moi cua toi',
        'body'   => 'Noi dung du dai de vuot qua rule min:20 ky tu',
        'status' => 'published',
    ])->assertRedirect();

    $this->get('/')->assertSee('Bai moi cua toi');
}
```

Test thứ hai vẫn xanh sau khi bạn tách `PostService` thành `CreatePost` Action. Đó là mục đích.

---

## 4. Factory nâng cao

### State và sequence

```php
class PostFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->sentence();

        return [
            'user_id'      => User::factory(),
            'category_id'  => Category::factory(),
            'title'        => $title,
            'slug'         => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 999999),
            'body'         => fake()->paragraphs(5, true),
            'status'       => PostStatus::Published,
            'published_at' => fake()->dateTimeBetween('-1 year'),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => PostStatus::Draft, 'published_at' => null]);
    }

    public function publishedAt(string $when): static
    {
        return $this->state(fn () => ['published_at' => $when]);
    }
}
```

```php
Post::factory()->draft()->count(5)->create();

// Xen kẽ trạng thái
Post::factory()->count(10)->state(new Sequence(
    ['status' => PostStatus::Draft],
    ['status' => PostStatus::Published],
))->create();
```

### `recycle` — đừng tạo 30 user cho 30 bài viết

```php
// ❌ tạo 30 user + 30 category
Post::factory()->count(30)->create();

// ✅ dùng lại
$author = User::factory()->create();
$categories = Category::factory()->count(3)->create();

Post::factory()->count(30)->recycle([$author, ...$categories])->create();
```

Trên bộ test lớn, đây là khác biệt giữa 3 giây và 30 giây.

### ⚠️ `->for()` đoán sai tên quan hệ

```php
Post::factory()->for($user)->create();
```

```
BadMethodCallException  Call to undefined method App\Models\Post::user()
```

`->for($user)` đoán tên quan hệ từ **tên class** (`User` → `user()`). Model `Post` khai quan hệ tên
`author()`. Phải nói rõ:

```php
Post::factory()->for($user, 'author')->create();
```

### `has` và `hasAttached`

```php
Post::factory()
    ->for($user, 'author')
    ->has(Comment::factory()->count(3), 'comments')
    ->hasAttached(Tag::factory()->count(2), ['created_at' => now()])
    ->create();
```

---

## 5. Test song song

```bash
$ php artisan test --parallel
```

Lần đầu sẽ nổ:

```
NunoMaduro\Collision\Adapters\Laravel\Exceptions\RequirementsException

Running Collision 8.x artisan test command in parallel requires at least ParaTest (brianium/paratest) 7.x.
```

```bash
$ composer require --dev brianium/paratest
Using version ^7.20 for brianium/paratest

$ php artisan test --parallel
ParaTest v7.20.0 upon PHPUnit 12.5.33 by Sebastian Bergmann and contributors.

Processes:     10
Runtime:       PHP 8.5.5
Configuration: .../phpunit.xml

.....                                                               5 / 5 (100%)

Time: 00:00.760, Memory: 32.00 MB

OK (5 tests, 15 assertions)
```

Laravel tự tạo **một database cho mỗi tiến trình**:

```bash
$ docker exec blog-pg psql -U blog -d postgres -c '\l' | grep blog_test
 blog_test        | blog |
 blog_test_test_2 | blog |
 blog_test_test_4 | blog |
```

Đây chính là lý do test phải **độc lập với nhau**: không dựa vào id cố định, không dựa vào thứ tự chạy.

```bash
php artisan test --parallel --processes=4
php artisan test --parallel --recreate-databases     # khi migration đổi
```

Việc cần chạy một lần cho mỗi database:

```php
// AppServiceProvider hoặc TestCase
use Illuminate\Support\Facades\ParallelTesting;

ParallelTesting::setUpTestDatabase(function ($database, $token) {
    Artisan::call('db:seed', ['--class' => 'ReferenceDataSeeder']);
});
```

---

## 6. Kiểm soát số query trong test

Test hiệu năng không cần công cụ đo tải. Đếm query là đủ.

```php
protected function assertQueryCount(int $expected, Closure $callback): void
{
    DB::enableQueryLog();
    DB::flushQueryLog();

    $callback();

    $actual = count(DB::getQueryLog());

    $this->assertSame($expected, $actual, sprintf(
        "Kỳ vọng %d query, thực tế %d:\n%s",
        $expected, $actual,
        collect(DB::getQueryLog())->pluck('query')->implode("\n"),
    ));
}
```

```php
public function test_trang_chu_luon_dung_3_query(): void
{
    Post::factory()->count(20)->for(User::factory(), 'author')->create();

    $this->assertQueryCount(3, fn () => $this->get('/')->assertOk());
}
```

Test này đỏ ngay khi ai đó thêm `$post->category->name` vào view mà quên `with()`. Nó bắt lỗi hiệu năng
**trước khi** lên production.

### Cách rẻ hơn — dựa vào strict mode

```php
// AppServiceProvider::boot()
Model::shouldBeStrict(! app()->isProduction());
```

```php
public function test_trang_chu_khong_bi_n_plus_1(): void
{
    Post::factory()->count(5)->for(User::factory(), 'author')->create();

    $this->get('/')->assertOk();       // N+1 → LazyLoadingViolationException
}
```

> ⚠️ **Phải seed từ 2 bản ghi trở lên.** `Builder::hydrate()` chỉ bật cờ khi `count($items) > 1`:
> ```php
> if (count($items) > 1) {
>     $model->preventsLazyLoading = Model::preventsLazyLoading();
> }
> ```
> Test với 1 bản ghi sẽ **xanh** dù code có N+1.

---

## 7. Test chậm — tìm và sửa

```bash
$ php artisan test --profile
```

In ra 10 test chậm nhất. Bốn nguyên nhân thường gặp:

| Nguyên nhân | Sửa |
|-------------|-----|
| `BCRYPT_ROUNDS` cao | `phpunit.xml` đặt `4` (đã sinh sẵn) |
| Factory tạo quá nhiều model liên quan | `recycle()` |
| `RefreshDatabase` chạy migration mỗi lần | Dùng `LazilyRefreshDatabase` |
| Gọi API thật, gửi mail thật | `Http::fake()`, `Mail::fake()` |

### `LazilyRefreshDatabase`

```php
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;

abstract class TestCase extends BaseTestCase
{
    use LazilyRefreshDatabase;
}
```

Chỉ khởi tạo database khi test **thật sự** chạm vào nó. Test thuần logic không trả giá.

### Chặn mọi lời gọi mạng

```php
// TestCase::setUp()
Http::preventStrayRequests();
```

Test nào gọi ra ngoài mà chưa `Http::fake()` sẽ nổ ngay, thay vì lặng lẽ chờ timeout 30 giây.

```php
Http::fake([
    'api.github.com/*' => Http::response(['login' => 'son'], 200),
    '*'                => Http::response('', 500),
]);

Http::assertSent(fn ($request) => $request->url() === 'https://api.github.com/user');
```

---

## 8. Test flaky — đỏ ngẫu nhiên

Test đỏ ngẫu nhiên còn tệ hơn không có test: người ta chạy lại cho tới khi xanh, rồi bỏ qua cả những
lỗi thật.

| Nguyên nhân | Ví dụ | Sửa |
|-------------|-------|-----|
| Phụ thuộc thời gian | `assertEquals('2026-08-19', ...)` | `$this->travelTo(...)` |
| Phụ thuộc thứ tự | Test B dùng dữ liệu test A tạo | Mỗi test tự tạo dữ liệu |
| Phụ thuộc id | `assertSame(1, $post->id)` | So bằng model, không bằng id |
| Thứ tự bản ghi không xác định | `$posts[0]` khi không có `ORDER BY` | Thêm `orderBy` hoặc so tập hợp |
| Random không cố định | `fake()->name()` trong assertion | Cố định giá trị cần assert |

### Đóng băng thời gian

```php
public function test_dang_bai_thi_ghi_dung_thoi_diem(): void
{
    $this->travelTo(Carbon::parse('2026-08-19 10:00:00'));

    $post = CreatePost::run(...);

    $this->assertEquals('2026-08-19 10:00:00', $post->published_at->toDateTimeString());
}
```

```php
$this->freezeTime(function () { /* ... */ });
$this->travel(5)->days();
$this->travelBack();
```

---

## 9. Test Livewire

```php
use Livewire\Livewire;

Livewire::test('post-manager')
    ->assertSee('Bài viết của tôi')
    ->set('search', 'Laravel')
    ->assertSee('Hoc Laravel 13')
    ->assertDontSee('Nau an ngon')
    ->call('delete', $post->id)
    ->assertDispatched('post-deleted');
```

```php
Livewire::actingAs($user)->test('post-manager', ['post' => $post])
    ->assertSet('search', '')
    ->assertCount('posts', 10)
    ->assertHasErrors(['body' => 'required'])
    ->assertRedirect(route('posts.index'))
    ->assertForbidden();
```

Tên component là tên **không có emoji**, kebab-case: `'post-manager'`, không phải `'⚡post-manager'`.

### Test phân quyền của component

```php
public function test_khong_xoa_duoc_bai_cua_nguoi_khac(): void
{
    $post = Post::factory()->for(User::factory(), 'author')->create();

    Livewire::actingAs(User::factory()->create())
        ->test('post-manager')
        ->call('delete', $post->id)
        ->assertStatus(404);        // vì component lọc auth()->user()->posts()
}
```

---

## 10. Pest — cú pháp gọn hơn

```bash
$ composer require --dev pestphp/pest --with-all-dependencies
$ ./vendor/bin/pest --init
```

```php
// tests/Feature/BlogTest.php
use App\Models\Post;
use App\Models\User;

use function Pest\Laravel\{actingAs, get, post, assertDatabaseHas};

it('chi hien bai da dang o trang chu', function () {
    $author = User::factory()->create();
    Post::factory()->for($author, 'author')->create(['title' => 'Bai da dang']);
    Post::factory()->draft()->for($author, 'author')->create(['title' => 'Ban nhap']);

    get('/')->assertOk()->assertSee('Bai da dang')->assertDontSee('Ban nhap');
});

it('khong cho khach viet bai', function () {
    get('/posts/create')->assertRedirect('/login');
});

it('cho phep nguoi dung dang bai', function () {
    $user = User::factory()->create();

    actingAs($user)->post('/posts', [
        'title'  => 'Bai moi',
        'body'   => 'Noi dung du dai de vuot qua rule',
        'status' => 'draft',
    ])->assertRedirect();

    assertDatabaseHas('posts', ['slug' => 'bai-moi', 'user_id' => $user->id]);
});
```

### Dataset — một test, nhiều bộ dữ liệu

```php
it('tu choi du lieu khong hop le', function (array $payload, string $field) {
    actingAs(User::factory()->create())
        ->post('/posts', $payload)
        ->assertSessionHasErrors($field);
})->with([
    'thieu tieu de' => [['body' => str_repeat('a', 30), 'status' => 'draft'], 'title'],
    'noi dung ngan' => [['title' => 'X', 'body' => 'ngan', 'status' => 'draft'], 'body'],
    'sai trang thai'=> [['title' => 'X', 'body' => str_repeat('a', 30), 'status' => 'xyz'], 'status'],
]);
```

Ba trường hợp, một khối code. Tên dataset hiện trong output nên biết ngay cái nào đỏ.

Pest chạy trên PHPUnit nên **dùng chung** với test PHPUnit sẵn có — không cần viết lại.

---

## 11. Test trong CI

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:18-alpine
        env:
          POSTGRES_USER: blog
          POSTGRES_PASSWORD: secret
          POSTGRES_DB: blog_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
      redis:
        image: redis:8-alpine
        ports: ['6379:6379']

    steps:
      - uses: actions/checkout@v4

      - uses: shivammathur/setup-php@v2
        with:
          php-version: '8.5'
          extensions: pdo_pgsql, mbstring, intl
          coverage: none

      - run: composer install --prefer-dist --no-interaction
      - run: cp .env.example .env && php artisan key:generate

      - run: ./vendor/bin/pint --test
      - run: ./vendor/bin/phpstan analyse --no-progress --memory-limit=1G
      - run: composer audit
      - run: php artisan test --parallel
        env:
          DB_CONNECTION: pgsql
          DB_HOST: 127.0.0.1
          DB_PORT: 5432
          DB_DATABASE: blog_test
          DB_USERNAME: blog
          DB_PASSWORD: secret
```

Bốn bước, theo thứ tự từ nhanh tới chậm — hỏng sớm thì dừng sớm:

1. `pint --test` (~2s) — định dạng
2. `phpstan` (~20s) — kiểu và lỗi tĩnh
3. `composer audit` (~3s) — lỗ hổng thư viện
4. `test --parallel` — hành vi

Nhớ `--memory-limit=1G` cho PHPStan; không có nó nó chết giữa chừng với `Allowed memory size exhausted`
(xem [bài 05](./05-kien-truc-du-an-lon.md)).

---

## 12. Đo bao nhiêu là đủ

Đừng đuổi theo 100% coverage. Ưu tiên theo rủi ro:

| Phải có test | Không cần test |
|--------------|----------------|
| Luồng tiền bạc | Getter/setter |
| Phân quyền (ai xem/sửa/xoá được gì) | Cấu hình |
| Validate | Code framework |
| Luồng nghiệp vụ chính | View tĩnh |
| Mọi bug đã sửa (test hồi quy) | Migration |

Quy tắc thực dụng: **mỗi khi sửa một bug, viết test tái hiện bug đó trước**. Sau một năm bạn có bộ
test bao phủ đúng những chỗ hay hỏng.

---

## Bài tập

1. Đặt `phpunit.xml` về SQLite mặc định. Viết scope dùng `ilike` và một test gọi nó. Ghi lại lỗi.
   Đổi sang `pgsql` và chạy lại.

2. Viết test dùng `Post::factory()->for($user)` (không có tên quan hệ). Ghi lại exception và sửa.

3. Chạy `php artisan test --parallel` khi chưa cài paratest. Ghi lại lỗi. Cài rồi chạy lại và liệt kê
   các database Laravel đã tạo.

4. Viết helper `assertQueryCount()`. Dùng nó cho trang chủ với 20 bài viết. Xoá `with('author')` khỏi
   controller và chạy lại — ghi lại thông báo lỗi (nó phải in ra danh sách query).

5. Viết test N+1 chỉ seed **1** bài viết với `Model::shouldBeStrict()` bật. Nó xanh hay đỏ? Giải thích.
   Seed 2 bài và chạy lại.

6. Viết test phụ thuộc `now()` rồi chạy lúc gần nửa đêm (hoặc dùng `travelTo` để giả lập). Sửa bằng
   `$this->travelTo()`.

7. Bật `Http::preventStrayRequests()` trong `TestCase::setUp()`. Viết test gọi một API ngoài và ghi
   lại lỗi.

8. Chuyển 3 test PHPUnit sang cú pháp Pest. Chạy `php artisan test` và xác nhận cả hai kiểu cùng chạy.

9. Viết một dataset Pest với 3 trường hợp validate hỏng. Chạy và xem tên từng trường hợp trong output.

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```
BadMethodCallException  Call to undefined method App\Models\Post::user()
```
`->for($user)` đoán tên quan hệ là `user()` từ tên class `User`. Sửa: `->for($user, 'author')`.

**3.**
```
NunoMaduro\Collision\Adapters\Laravel\Exceptions\RequirementsException
Running Collision 8.x artisan test command in parallel requires at least ParaTest (brianium/paratest) 7.x.
```
Sau khi cài, Laravel tạo `blog_test`, `blog_test_test_2`, `blog_test_test_4`… mỗi tiến trình một database.

**5.** **Xanh** — sai. `Builder::hydrate()` chỉ gán cờ `preventsLazyLoading` khi `count($items) > 1`,
vì một model thì về định nghĩa không thể là N+1. Với 2 bài trở lên, test đỏ đúng như mong đợi. Đây là
lý do mọi test hiệu năng phải seed nhiều hơn một bản ghi.

</details>

---

Tiếp theo: [08-deploy-octane-docker.md](./08-deploy-octane-docker.md)
