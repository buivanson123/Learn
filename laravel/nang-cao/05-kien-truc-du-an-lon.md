# Nâng cao 05 — Kiến trúc dự án lớn

Bài này giải quyết triệu chứng: controller dài 400 dòng, cùng một đoạn logic nằm ở 3 nơi, sửa chỗ này
hỏng chỗ kia, và người mới vào không biết đặt file ở đâu.

Nguyên tắc xuyên suốt: **cấu trúc là để trả lời câu hỏi "file này để đâu"**, không phải để trông giống
Clean Architecture.

---

## 1. Khi nào cần thay đổi cấu trúc

Đừng dựng kiến trúc trước khi có vấn đề. Dấu hiệu thật:

| Dấu hiệu | Giải pháp ở mục |
|----------|-----------------|
| Controller > 100 dòng | 3 — tách Action |
| Cùng một logic ở controller, job và command | 3 — tách Action |
| Không biết đặt file mới ở đâu | 2 — bảng tra |
| `app/Models/` có 40 file | 5 — chia module |
| Sửa module A làm hỏng module B | 6 — ép ranh giới |
| Không dám sửa vì không biết ai đang gọi | 7 — phân tích tĩnh |

Dự án Blog ở [bài 08](../08-du-an-blog.md) **chưa** cần gì trong bài này. Đọc để biết khi nào cần.

---

## 2. Cây thư mục và bảng tra "file này để đâu"

```
app/
├── Actions/                    ← một việc nghiệp vụ = một class
│   └── Posts/{CreatePost,PublishPost,DeletePost}.php
├── Console/Commands/
├── Data/                       ← DTO: dữ liệu đi giữa các tầng
│   └── PostData.php
├── Enums/
│   └── PostStatus.php
├── Events/
├── Exceptions/                 ← exception nghiệp vụ tự viết
│   └── PostAlreadyPublished.php
├── Http/
│   ├── Controllers/            ← CHỈ: nhận request, gọi Action, trả response
│   ├── Middleware/
│   ├── Requests/               ← validate + phân quyền đầu vào
│   └── Resources/              ← định dạng đầu ra JSON
├── Jobs/
├── Listeners/
├── Models/                     ← quan hệ, cast, scope. KHÔNG chứa logic nghiệp vụ
├── Notifications/
├── Policies/
├── Providers/
├── Queries/                    ← truy vấn đọc phức tạp, tái dùng
│   └── PublishedPostsQuery.php
├── Rules/
├── Services/                   ← bọc dịch vụ NGOÀI (thanh toán, S3, email marketing)
│   └── SearchIndexService.php
└── Support/                    ← tiện ích thuần, không phụ thuộc framework
```

### Bảng tra

| Bạn đang viết | Đặt vào | Ví dụ |
|---------------|---------|-------|
| Nhận HTTP, trả HTML/JSON | `Http/Controllers` | `PostController` |
| Quy tắc validate đầu vào | `Http/Requests` | `StorePostRequest` |
| Định dạng dữ liệu ra JSON | `Http/Resources` | `PostResource` |
| Một việc nghiệp vụ có thể gọi từ nhiều nơi | `Actions` | `PublishPost` |
| Truy vấn đọc dùng ở ≥ 2 nơi | `Queries` | `PublishedPostsQuery` |
| Gọi API bên thứ ba | `Services` | `StripeService` |
| Quan hệ, cast, scope | `Models` | `Post` |
| Ai được làm gì | `Policies` | `PostPolicy` |
| Chạy nền | `Jobs` | `SendPostPublishedNotification` |
| Phản ứng phụ khi có chuyện xảy ra | `Listeners` | `NotifySubscribers` |
| Kiểu dữ liệu cố định | `Enums` | `PostStatus` |
| Lỗi nghiệp vụ | `Exceptions` | `PostAlreadyPublished` |
| Hàm tiện ích thuần | `Support` | `Money` |

Dán bảng này vào `CLAUDE.md` hoặc `CONTRIBUTING.md` của dự án. Nó tiết kiệm nhiều thời gian review hơn
mọi cuộc tranh luận về kiến trúc.

---

## 3. Action — đơn vị tổ chức chính

Controller mỏng, Model mỏng, logic nằm ở Action.

### Trước

```php
// PostController::store() — 60 dòng
public function store(StorePostRequest $request)
{
    $post = $request->user()->posts()->create($request->validated());

    if ($post->status === PostStatus::Published) {
        $post->update(['published_at' => now()]);
        PostWasPublished::dispatch($post);
        Cache::tags(['posts'])->flush();
        SearchIndex::add($post);
    }

    Activity::log('post.created', $post, $request->user());

    return redirect()->route('posts.show', $post);
}
```

Vấn đề thật: khi cần đăng bài từ một artisan command hoặc từ API, bạn phải chép lại toàn bộ khối đó.

### Sau

```php
namespace App\Actions\Posts;

use App\Data\PostData;
use App\Enums\PostStatus;
use App\Events\PostWasPublished;
use App\Models\Post;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CreatePost
{
    public function __construct(
        private readonly PublishPost $publishPost,
    ) {}

    public function handle(User $author, PostData $data): Post
    {
        return DB::transaction(function () use ($author, $data) {
            $post = $author->posts()->create($data->toArray());

            if ($data->status === PostStatus::Published) {
                $this->publishPost->handle($post);
            }

            return $post;
        });
    }
}
```

```php
namespace App\Actions\Posts;

class PublishPost
{
    public function handle(Post $post): Post
    {
        if ($post->published_at !== null) {
            throw new PostAlreadyPublished($post);
        }

        $post->update([
            'status'       => PostStatus::Published,
            'published_at' => now(),
        ]);

        PostWasPublished::dispatch($post);

        return $post;
    }
}
```

```php
public function store(StorePostRequest $request, CreatePost $createPost)
{
    $post = $createPost->handle($request->user(), PostData::from($request->validated()));

    return redirect()->route('posts.show', $post)->with('status', 'Đã đăng bài viết.');
}
```

Controller còn 3 dòng. `CreatePost` được inject tự động qua service container.

### Bốn quy tắc cho Action

1. **Một method public**, đặt tên `handle()` hoặc `__invoke()`.
2. **Nhận kiểu rõ ràng, trả kiểu rõ ràng.** Không nhận `Request`, không nhận mảng tự do.
3. **Không biết gì về HTTP.** Không `redirect()`, không `abort()`, không `response()`.
4. **Bọc transaction ở Action ngoài cùng**, không lồng transaction ở từng Action con.

Quy tắc 3 là quan trọng nhất — nó là thứ khiến Action gọi được từ controller, job, command và test.

### Đừng làm quá

Action cho **mỗi** thao tác CRUD là thừa. `UpdatePost` chỉ gọi `$post->update($data)` thì để thẳng
trong controller. Tách khi có **≥ 2 bước** hoặc **≥ 2 nơi gọi**.

---

## 4. DTO — dữ liệu có hình dạng

```php
namespace App\Data;

use App\Enums\PostStatus;

final readonly class PostData
{
    public function __construct(
        public string $title,
        public string $slug,
        public string $body,
        public PostStatus $status,
        public ?int $categoryId = null,
    ) {}

    public static function from(array $validated): self
    {
        return new self(
            title:      $validated['title'],
            slug:       $validated['slug'],
            body:       $validated['body'],
            status:     PostStatus::from($validated['status']),
            categoryId: $validated['category_id'] ?? null,
        );
    }

    public function toArray(): array
    {
        return [
            'title'       => $this->title,
            'slug'        => $this->slug,
            'body'        => $this->body,
            'status'      => $this->status,
            'category_id' => $this->categoryId,
        ];
    }
}
```

So với truyền mảng:

```php
$createPost->handle($user, $request->validated());   // mảng có gì? IDE không biết, bạn cũng không
$createPost->handle($user, PostData::from(...));      // IDE biết, PHPStan biết
```

`readonly` khiến dữ liệu không bị sửa lén ở giữa đường. Gõ sai tên trường thì lỗi ở **thời điểm dựng
object**, không phải khi query chạy.

DTO đáng dùng khi dữ liệu đi qua ≥ 3 tầng. Với controller gọi thẳng model thì thừa.

---

## 5. Query object — truy vấn đọc phức tạp

```php
namespace App\Queries;

use App\Models\Post;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class PublishedPostsQuery
{
    private ?string $search = null;
    private ?string $categorySlug = null;

    public function search(?string $term): self
    {
        $this->search = $term;
        return $this;
    }

    public function inCategory(?string $slug): self
    {
        $this->categorySlug = $slug;
        return $this;
    }

    public function paginate(int $perPage = 10): LengthAwarePaginator
    {
        return Post::query()
            ->with(['author:id,name', 'category:id,name,slug'])
            ->withCount('comments')
            ->published()
            ->when($this->search, fn ($q, $t) => $q->search($t))
            ->when($this->categorySlug, fn ($q, $s) => $q->whereRelation('category', 'slug', $s))
            ->latest('published_at')
            ->paginate($perPage)
            ->withQueryString();
    }
}
```

```php
public function index(Request $request, PublishedPostsQuery $query)
{
    return view('posts.index', [
        'posts' => $query->search($request->string('q'))
                         ->inCategory($request->string('category'))
                         ->paginate(),
    ]);
}
```

Lợi ích cụ thể: `with()` và `withCount()` khai **một chỗ**. Trang chủ, RSS, sitemap và API dùng chung
— không có chỗ nào bị quên `with()` rồi sinh N+1.

---

## 6. Chia module khi `app/Models/` quá đông

Trên ~30 model, cấu trúc theo **loại kỹ thuật** hết tác dụng. Chuyển sang theo **miền nghiệp vụ**:

```
app/
├── Blog/
│   ├── Actions/{CreatePost,PublishPost}.php
│   ├── Models/{Post,Category,Comment}.php
│   ├── Policies/PostPolicy.php
│   ├── Http/Controllers/PostController.php
│   └── Queries/PublishedPostsQuery.php
├── Billing/
│   ├── Actions/ChargeCustomer.php
│   ├── Models/{Invoice,Subscription}.php
│   └── Services/StripeService.php
└── Shared/
    ├── Models/User.php
    └── Support/Money.php
```

Không cần cấu hình gì — PSR-4 của Laravel map `App\` → `app/`, nên `app/Blog/Models/Post.php` tự động
là `App\Blog\Models\Post`.

Ba thứ phải sửa tay:

```php
// 1. Factory không tự tìm được model nữa
namespace Database\Factories\Blog;

class PostFactory extends Factory
{
    protected $model = \App\Blog\Models\Post::class;
}
```

```php
// 2. Model phải chỉ ra factory
use Illuminate\Database\Eloquent\Attributes\UseFactory;

#[UseFactory(\Database\Factories\Blog\PostFactory::class)]
class Post extends Model {}
```

```php
// 3. Policy không tự tìm được nữa
use Illuminate\Database\Eloquent\Attributes\UsePolicy;

#[UsePolicy(\App\Blog\Policies\PostPolicy::class)]
class Post extends Model {}
```

Kiểm chứng Laravel đã hiểu:

```bash
$ php artisan model:show "App\Blog\Models\Post"
 Policy .. App\Blog\Policies\PostPolicy
```

Dòng `Policy` trống nghĩa là attribute chưa đúng.

### Đừng chia quá sớm

Chia module khi có ≥ 2 nhóm nghiệp vụ **thật sự tách biệt** và ≥ 3 người cùng làm. Dự án một người với
15 model thì cấu trúc mặc định tốt hơn.

---

## 7. Ép ranh giới bằng công cụ

Quy ước không ai đọc thì không phải quy ước. Đưa nó vào CI.

### Larastan — PHPStan hiểu Laravel

```bash
$ composer require --dev larastan/larastan
Using version ^3.10 for larastan/larastan
```

```neon
# phpstan.neon
includes:
    - vendor/larastan/larastan/extension.neon

parameters:
    paths:
        - app
    level: 5
```

```bash
$ ./vendor/bin/phpstan analyse --no-progress --memory-limit=1G

 [OK] No errors
```

> ⚠️ **Bắt buộc có `--memory-limit`.** Với `memory_limit=128M` mặc định của PHP, PHPStan chết giữa chừng:
> ```
> {"tool":"phpstan","result":"failed","errors":1,
>  "general_errors":["Child process error (exit code 255): PHP Fatal error:
>   Allowed memory size of 134217728 bytes exhausted ..."]}
> ```
> Đưa `--memory-limit=1G` vào script composer để không ai phải nhớ.

### Tăng level dần

```bash
$ sed -i '' 's/level: 5/level: 8/' phpstan.neon
$ ./vendor/bin/phpstan analyse --no-progress --memory-limit=1G

  25  Method App\Models\Post::author() return type with generic class
      Illuminate\Database\Eloquent\Relations\BelongsTo does not specify its
      types: TRelatedModel, TDeclaringModel
      🪪  missingType.generics

 [ERROR] Found 18 errors
```

Level 8 đòi khai generic cho quan hệ:

```php
/** @return BelongsTo<User, $this> */
public function author(): BelongsTo
{
    return $this->belongsTo(User::class, 'user_id');
}

/** @return HasMany<Comment, $this> */
public function comments(): HasMany
{
    return $this->hasMany(Comment::class);
}
```

Đổi lại, IDE và PHPStan biết `$post->author` là `User`, không phải `mixed`.

Chiến lược thực dụng cho dự án đang chạy: bắt đầu ở level 5, sinh baseline, rồi siết dần.

```bash
$ ./vendor/bin/phpstan analyse --generate-baseline --memory-limit=1G
```

Baseline ghi nhận lỗi hiện có; từ đó CI chỉ chặn lỗi **mới**.

### Deptrac — chặn module gọi lẫn nhau

```bash
$ composer require --dev deptrac/deptrac
```

```yaml
# deptrac.yaml
deptrac:
  paths: ['./app']
  layers:
    - name: Blog
      collectors: [{ type: className, value: ^App\\Blog\\.* }]
    - name: Billing
      collectors: [{ type: className, value: ^App\\Billing\\.* }]
    - name: Shared
      collectors: [{ type: className, value: ^App\\Shared\\.* }]
  ruleset:
    Blog:    [Shared]
    Billing: [Shared]
    Shared:  ~
```

```bash
$ ./vendor/bin/deptrac analyse
```

`Blog` gọi thẳng vào `Billing` → CI đỏ. Muốn giao tiếp thì qua event, không qua lời gọi trực tiếp.

### Pint — định dạng thống nhất

```bash
$ ./vendor/bin/pint --test        # CI: chỉ kiểm tra, không sửa
$ ./vendor/bin/pint               # sửa
```

### Gộp vào composer

```json
"scripts": {
    "lint": ["./vendor/bin/pint --test"],
    "analyse": ["./vendor/bin/phpstan analyse --no-progress --memory-limit=1G"],
    "check": ["@lint", "@analyse", "@php artisan test"]
}
```

```bash
$ composer check
```

Một lệnh cho cả CI lẫn máy dev. Không ai phải nhớ tham số.

---

## 8. Quy ước đặt tên

| Loại | Quy ước | Ví dụ đúng | Ví dụ sai |
|------|---------|-----------|-----------|
| Model | Danh từ số ít, PascalCase | `Post`, `Category` | `Posts`, `post` |
| Bảng | Số nhiều, snake_case | `posts`, `post_tag` | `Post`, `posts_tags` |
| Cột khoá ngoại | `<model_số_ít>_id` | `user_id` | `userId`, `id_user` |
| Bảng trung gian | Hai model số ít, theo a-b-c | `post_tag` | `tag_post`, `posts_tags` |
| Controller | `<Model>Controller` | `PostController` | `PostsController` |
| Action | Động từ + danh từ | `PublishPost` | `PostPublisher` |
| Event | Quá khứ | `PostWasPublished` | `PublishPost` |
| Listener | Động từ | `NotifySubscribers` | `SubscriberNotifier` |
| Job | Động từ | `SendWelcomeEmail` | `WelcomeEmailJob` |
| Route | `<tài-nguyên>.<hành-động>` | `posts.show` | `showPost` |
| Khoá cache | `<loại>.<định-danh>` | `posts.home`, `post.42` | `homePosts` |
| Migration | `<động_từ>_<bảng>_table` | `create_posts_table` | `posts` |

Sai quy ước bảng/cột thì Laravel **không tự đoán được** và bạn phải khai tay mọi thứ — đó là chi phí
thật, không phải chuyện thẩm mỹ.

---

## 9. Model gầy

Model chỉ nên chứa: quan hệ, cast, scope, accessor/mutator. **Không** chứa logic nghiệp vụ.

```php
// ❌ Model biết quá nhiều
class Post extends Model
{
    public function publish(): void
    {
        $this->update(['status' => 'published', 'published_at' => now()]);
        Mail::to($this->author)->send(new PostPublished($this));
        SearchIndex::add($this);
        Cache::tags(['posts'])->flush();
    }
}
```

Vấn đề: `Post` giờ phụ thuộc vào Mail, SearchIndex, Cache. Test model phải mock cả ba. Và không ai
đoán được `$post->publish()` gửi mail.

```php
// ✅ Model chỉ mô tả dữ liệu
class Post extends Model
{
    #[Scope]
    protected function published(Builder $q): void
    {
        $q->where('status', PostStatus::Published);
    }

    protected function excerpt(): Attribute
    {
        return Attribute::get(fn () => Str::limit(strip_tags($this->body), 200));
    }
}
```

Logic đăng bài nằm ở `App\Actions\Posts\PublishPost`.

### Observer chỉ cho việc thật sự thuộc về vòng đời

```php
class PostObserver
{
    public function saved(Post $post): void
    {
        Cache::tags(['posts'])->flush();      // ✅ hợp lý
    }

    public function created(Post $post): void
    {
        Mail::to(...)->send(...);             // ❌ tác dụng phụ ẩn
    }
}
```

Gửi mail trong observer nghĩa là **mọi** `Post::create()` — kể cả trong seeder và test — đều gửi mail.
Việc đó thuộc về Action hoặc Listener của một event tường minh.

---

## 10. Danh sách kiểm tra khi review kiến trúc

- [ ] Controller có method nào > 20 dòng không?
- [ ] Có logic nào lặp lại ở ≥ 2 nơi không?
- [ ] Model có method nào gửi mail / gọi API / xoá cache không?
- [ ] Truy vấn có `with()` được khai ở ≥ 2 nơi không?
- [ ] Có Action nào biết về HTTP (`redirect`, `abort`, `Request`) không?
- [ ] `composer check` có chạy trong CI không?
- [ ] Người mới có tìm được chỗ đặt file trong 30 giây không?

Câu cuối là phép thử tốt nhất. Nếu không, vấn đề nằm ở tài liệu chứ không phải ở cấu trúc.

---

## Bài tập

1. Tách `PostController::store()` của dự án Blog thành `CreatePost` + `PublishPost`. Đảm bảo Action
   không import bất kỳ class nào thuộc `Illuminate\Http`.

2. Viết `PostData` dạng `readonly`. Thử gán lại một thuộc tính sau khi dựng và ghi lại lỗi PHP.

3. Cài Larastan, chạy ở level 5 **không** có `--memory-limit`. Ghi lại lỗi. Thêm cờ và chạy lại.

4. Tăng lên level 8. Đếm số lỗi. Sửa hết bằng cách khai generic cho quan hệ, rồi chạy lại.

5. Viết `PublishedPostsQuery`. Dùng nó ở cả trang chủ và một route RSS. Xác nhận cả hai đều 3 query.

6. Chuyển `Post`, `Category`, `Comment` sang `app/Blog/`. Sửa factory và policy theo mục 6. Chạy
   `php artisan model:show "App\Blog\Models\Post"` và xác nhận dòng `Policy` không trống.

7. Cài Deptrac với hai layer `Blog` và `Billing`. Cố tình gọi một class `Billing` từ `Blog` và chạy
   `deptrac analyse`.

8. Thêm script `composer check`. Cố tình sai định dạng một file rồi chạy — xác nhận nó dừng ở bước lint.

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```
Error: Cannot modify readonly property App\Data\PostData::$title
```

**3.**
```
{"tool":"phpstan","result":"failed","errors":1,"general_errors":["Child process error (exit code 255):
 PHP Fatal error:  Allowed memory size of 134217728 bytes exhausted ..."]}
```
Với `--memory-limit=1G`: `[OK] No errors`.

**4.** Trên dự án Blog mẫu: **18 lỗi**, toàn bộ là `missingType.generics`. Sửa bằng:
```php
/** @return BelongsTo<User, $this> */
/** @return HasMany<Comment, $this> */
```

**6.** Không sửa `#[UsePolicy]` thì `model:show` không hiện dòng `Policy`, và mọi `authorize()` trả 403.

</details>

---

Tiếp theo: [06-bao-mat.md](./06-bao-mat.md)
