# Nâng cao 01 — Tối ưu Eloquent và truy vấn

Ba nguyên nhân làm ứng dụng Laravel chậm, theo đúng thứ tự phổ biến:

1. **N+1 query** — nhiều query nhỏ thay vì một query.
2. **Thiếu index** — mỗi query quét toàn bảng.
3. **Nạp quá nhiều dữ liệu vào RAM** — `->get()` trên bảng lớn.

Bài này xử lý cả ba, kèm cách **đo** chứ không đoán.

---

## 1. Đo trước đã

### Đếm query của một trang

`AppServiceProvider::boot()`:

```php
if (! app()->isProduction()) {
    DB::listen(function ($query) {
        Log::debug($query->sql, [
            'bindings' => $query->bindings,
            'ms'       => $query->time,
        ]);
    });
}
```

Mở khung log của `php artisan dev` (Pail) rồi bấm quanh ứng dụng.

### Đếm chính xác trong tinker

```php
DB::enableQueryLog();
// ... đoạn code cần đo ...
echo count(DB::getQueryLog());
foreach (DB::getQueryLog() as $q) { echo $q['query'] . PHP_EOL; }
```

### Xem SQL của một query builder

```php
Post::published()->with('author')->toSql();     // trả chuỗi
Post::published()->dump();                      // in rồi chạy tiếp
Post::published()->dd();                        // in rồi dừng
```

### Đo ở tầng database

```bash
$ docker exec blog-pg psql -U blog -d blog -c "EXPLAIN ANALYZE SELECT * FROM posts WHERE status = 'published';"
```

Đây là nguồn sự thật cuối cùng. Laravel chỉ sinh SQL; PostgreSQL mới là nơi quyết định nhanh chậm.

---

## 2. N+1 — các dạng khó thấy

Dạng cơ bản đã nói ở [bài 03](../03-database-va-eloquent.md). Dưới đây là những dạng vẫn lọt lưới.

### N+1 trong Blade component

```blade
{{-- components/post-card.blade.php --}}
<span>{{ $post->category->name }}</span>       {{-- ← query mỗi lần render --}}
```

Controller `with('author')` nhưng quên `category` → 1 query cho mỗi thẻ. Component che giấu điều này
vì code truy cập quan hệ nằm ở file khác.

**Cách bắt:** `Model::preventLazyLoading()` + một feature test nạp trang có từ 2 bản ghi trở lên.

### N+1 trong API Resource

```php
public function toArray(Request $request): array
{
    return [
        'author' => $this->author->name,       // ← N+1
    ];
}
```

**Sửa:** dùng `whenLoaded` — nó chỉ xuất khoá khi quan hệ đã nạp, và không tự đi query.

```php
'author' => $this->whenLoaded('author', fn () => [
    'id' => $this->author->id, 'name' => $this->author->name,
]),
```

### N+1 trong Livewire

Nguy hiểm gấp bội: component render lại **mỗi lần gõ phím**.

```php
#[Computed]
public function posts()
{
    return Post::query()
        ->with('author')            // ← bắt buộc
        ->withCount('comments')
        ->paginate(10);
}
```

### N+1 khi đếm

```php
foreach ($posts as $post) {
    echo $post->comments->count();      // ← nạp TOÀN BỘ comment chỉ để đếm
}
```

**Sửa:**

```php
Post::withCount('comments')->get();     // → $post->comments_count
```

`withCount` sinh subquery `(select count(*) ...) as comments_count` — một query duy nhất, không nạp
dòng nào của bảng `comments`.

### Nạp thừa cột

```php
Post::with('author')->get();            // nạp cả email, password hash, remember_token
Post::with('author:id,name')->get();    // chỉ 2 cột
```

Với danh sách 50 bài, khác biệt là vài trăm KB đi qua mạng mỗi lần tải trang.

> Khi dùng `with('author:id,name')`, **luôn phải có `id`** — Laravel cần nó để ghép quan hệ. Thiếu
> `id` thì quan hệ trả `null` mà không báo lỗi.

---

## 3. Các kiểu eager load nâng cao

```php
// Nạp có điều kiện
Post::with(['comments' => fn ($q) => $q->latest()->limit(3)])->get();

// Nạp lồng nhiều tầng
Post::with('comments.author:id,name')->get();

// Nạp theo loại (quan hệ đa hình)
Activity::with(['subject' => fn (MorphTo $m) => $m->morphWith([
    Post::class => ['author'],
    Comment::class => ['post'],
])])->get();

// Nạp sau khi đã có collection
$posts->load('category');
$posts->loadMissing('author');     // chỉ nạp cái chưa có
$posts->loadCount('comments');

// Đếm nhiều quan hệ + đặt điều kiện
Post::withCount([
    'comments',
    'comments as approved_comments_count' => fn ($q) => $q->where('approved', true),
])->get();

// Lấy 1 bản ghi mới nhất của quan hệ mà không N+1
Post::with('latestComment')->get();
```

```php
// app/Models/Post.php
public function latestComment(): HasOne
{
    return $this->hasOne(Comment::class)->latestOfMany();
}
```

### Subquery thay vì quan hệ

Khi chỉ cần **một giá trị** từ bảng liên quan, subquery rẻ hơn cả eager load:

```php
use Illuminate\Database\Eloquent\Builder;

Post::addSelect(['last_comment_at' => Comment::select('created_at')
    ->whereColumn('post_id', 'posts.id')
    ->latest()
    ->limit(1),
])->get();
```

Một query duy nhất, không nạp model `Comment` nào.

---

## 4. Index — đo thật trên 500.000 dòng

Tạo bảng thử:

```bash
$ docker exec blog-pg psql -U blog -d blog \
  -c "CREATE TABLE bench (id bigserial primary key, email varchar(255), status varchar(20), created_at timestamp);" \
  -c "INSERT INTO bench (email, status, created_at)
      SELECT md5(random()::text) || '@test.dev',
             (ARRAY['draft','published'])[1 + (random()*1)::int],
             now() - (random() * interval '365 days')
      FROM generate_series(1, 500000);"
CREATE TABLE
INSERT 0 500000
```

### Không có index

```bash
$ docker exec blog-pg psql -U blog -d blog \
  -c "EXPLAIN ANALYZE SELECT * FROM bench WHERE email = 'khong-ton-tai@test.dev';"

 Seq Scan on bench  (cost=0.00..6871.54 rows=384 width=590) (actual time=21.757..21.757 rows=0.00 loops=1)
   Filter: ((email)::text = 'khong-ton-tai@test.dev'::text)
   Rows Removed by Filter: 500000
   Buffers: shared hit=5911
```

Đọc ba dòng đó:

- **`Seq Scan`** — quét tuần tự. Đây là từ khoá cần tìm khi soi query chậm.
- **`Rows Removed by Filter: 500000`** — đọc hết 500.000 dòng để trả về 0 dòng.
- **`actual time=21.757`** — 21,757 ms.

### Có index

```bash
$ docker exec blog-pg psql -U blog -d blog -c "CREATE INDEX bench_email_index ON bench (email);"
CREATE INDEX

$ docker exec blog-pg psql -U blog -d blog \
  -c "EXPLAIN ANALYZE SELECT * FROM bench WHERE email = 'khong-ton-tai@test.dev';"

 Bitmap Heap Scan on bench  (cost=103.80..4732.11 rows=2500 width=590) (actual time=0.060..0.061 rows=0.00 loops=1)
   Recheck Cond: ((email)::text = 'khong-ton-tai@test.dev'::text)
   Buffers: shared read=3
   ->  Bitmap Index Scan on bench_email_index  (cost=0.00..103.17 rows=2500 width=0) (actual time=0.056..0.056 rows=0.00)
         Index Cond: ((email)::text = 'khong-ton-tai@test.dev'::text)
```

**21.757 ms → 0.061 ms.** Nhanh gấp ~350 lần. `Buffers: shared hit=5911` giảm còn `read=3` — đọc 3
block thay vì 5911.

### Index gì

Quy tắc: index cột xuất hiện trong `WHERE`, `ORDER BY`, `JOIN` và khoá ngoại.

```php
$table->index('status');
$table->index(['status', 'published_at']);      // index tổ hợp
$table->unique('slug');
$table->foreignId('user_id')->constrained();    // Laravel tự tạo index? KHÔNG — xem dưới
```

> ⚠️ `foreignId()->constrained()` tạo **ràng buộc khoá ngoại**, không tự tạo index trên PostgreSQL.
> Kiểm tra bằng `php artisan db:table posts` — nếu cột `user_id` không xuất hiện ở phần `Index` thì
> mọi `WHERE user_id = ?` đang quét toàn bảng. Thêm tay:
> ```php
> $table->foreignId('user_id')->constrained()->index();
> ```

### Thứ tự cột trong index tổ hợp

Index `['status', 'published_at']` dùng được cho:

```sql
WHERE status = 'published'                                  ✅
WHERE status = 'published' ORDER BY published_at DESC        ✅
WHERE status = 'published' AND published_at > '2026-01-01'   ✅
WHERE published_at > '2026-01-01'                            ❌ không dùng được
```

Nguyên tắc: cột lọc **bằng** đứng trước, cột lọc **khoảng** hoặc dùng để sắp xếp đứng sau.

### Index bị vô hiệu hoá

```sql
WHERE LOWER(email) = 'a@b.c'          -- ❌ hàm bọc quanh cột → index vô dụng
WHERE email LIKE '%abc'               -- ❌ ký tự đại diện ở đầu
WHERE created_at::date = '2026-08-18' -- ❌ ép kiểu cột
```

Sửa:

```sql
WHERE email = 'a@b.c'                                    -- Postgres: dùng citext hoặc index biểu thức
WHERE created_at >= '2026-08-18' AND created_at < '2026-08-19'
```

Index biểu thức cho trường hợp bắt buộc dùng hàm:

```php
DB::statement('CREATE INDEX bench_email_lower_index ON bench (LOWER(email))');
```

### Kiểm tra index đang có

```bash
$ php artisan db:table posts

 Index ..
 posts_pkey id .......................................... btree, primary
 posts_slug_unique slug ................................. btree, unique
 posts_status_published_at_index status, published_at ... btree, compound

 Foreign Key .. On Update / On Delete
 posts_category_id_foreign  category_id references id on categories  no action / set null
 posts_user_id_foreign      user_id references id on users .......... no action / cascade
```

### Index không miễn phí

Mỗi index làm `INSERT`/`UPDATE`/`DELETE` chậm hơn và tốn thêm dung lượng. Đừng index mọi cột. Index
cái mà query thật sự dùng, kiểm chứng bằng `EXPLAIN ANALYZE`.

---

## 5. Duyệt bảng lớn — `get()` sẽ giết ứng dụng

### Đo thật, bảng 500.000 dòng, `memory_limit = 128M`

```php
// run-bench.php
$rows = DB::table('bench')->get();
```

```
PHP Fatal error:  Allowed memory size of 134217728 bytes exhausted (tried to allocate 4096 bytes)
in .../vendor/laravel/framework/src/Illuminate/Database/Connection.php on line 442
```

Bốn cách duyệt không tràn RAM, đo trên cùng dữ liệu:

| Cách | Đỉnh bộ nhớ | Thời gian |
|------|-------------|-----------|
| `->get()` | **Fatal error** | — |
| `->chunk(1000, ...)` | 25.0 MB | **7589 ms** |
| `->chunkById(1000, ...)` | 25.0 MB | **660 ms** |
| `->cursor()` | 24.8 MB | **530 ms** |
| `->lazyById(1000)` | 25.6 MB | 825 ms |

### Vì sao `chunk` chậm gấp 11 lần `chunkById`

`chunk()` phân trang bằng `LIMIT ... OFFSET ...`:

```sql
SELECT * FROM bench ORDER BY id LIMIT 1000 OFFSET 499000
```

PostgreSQL phải **đọc và bỏ đi 499.000 dòng** trước khi trả về 1000 dòng cuối. Càng về sau càng chậm.

`chunkById()` phân trang bằng khoá:

```sql
SELECT * FROM bench WHERE id > 499000 ORDER BY id LIMIT 1000
```

Nhảy thẳng tới vị trí nhờ index khoá chính. Chi phí như nhau ở mọi trang.

**Quy tắc: dùng `chunkById`, đừng dùng `chunk`.**

### `chunk` còn một bẫy nữa

```php
Post::where('status', 'draft')->chunk(100, function ($posts) {
    foreach ($posts as $post) {
        $post->update(['status' => 'published']);      // ← đổi chính điều kiện lọc
    }
});
```

Sau khi xử lý xong lô 1, các bản ghi đó không còn khớp `status = 'draft'` nữa, nên `OFFSET 100` bây
giờ trỏ vào chỗ khác — **một nửa số bản ghi bị bỏ sót**. Không có lỗi nào.

`chunkById()` không bị vấn đề này vì nó theo `id`, không theo vị trí.

### Chọn cách nào

```php
// Xử lý theo lô, có thể ghi lại dữ liệu — an toàn nhất
Post::where('status', 'draft')->chunkById(500, function ($posts) {
    foreach ($posts as $post) { /* ... */ }
});

// Chỉ đọc, muốn nhanh nhất — cursor giữ 1 model trong RAM tại một thời điểm
foreach (Post::where('status', 'published')->cursor() as $post) { /* ... */ }

// Giao diện lazy collection, dùng được method của Collection
Post::lazyById(1000)->each(fn ($post) => /* ... */);

// Xuất CSV lớn — stream, không dựng file trong RAM
return response()->streamDownload(function () {
    $out = fopen('php://output', 'w');
    fputcsv($out, ['id', 'title', 'published_at']);

    foreach (Post::cursor() as $post) {
        fputcsv($out, [$post->id, $post->title, $post->published_at]);
    }

    fclose($out);
}, 'posts.csv');
```

> `cursor()` giữ **kết nối database mở** suốt vòng lặp. Không gọi query khác bên trong vòng lặp
> `cursor()` trên cùng kết nối, và đừng dùng nó cho vòng lặp chạy hàng giờ.

---

## 6. Phân trang cho bảng lớn

`paginate()` chạy **hai** query: một `COUNT(*)` và một `SELECT`. Trên bảng triệu dòng, `COUNT(*)` là
phần chậm nhất.

```php
$posts = Post::published()->paginate(10);       // 2 query, có tổng số trang
$posts = Post::published()->simplePaginate(10); // 1 query, chỉ có "trước/sau"
$posts = Post::published()->cursorPaginate(10); // 1 query, dùng WHERE id > ... — nhanh nhất
```

| Kiểu | Query | Nhảy tới trang N | Ổn định khi dữ liệu đổi |
|------|-------|------------------|------------------------|
| `paginate` | 2 | ✅ | ❌ (chèn bản ghi mới làm lệch trang) |
| `simplePaginate` | 1 | ❌ | ❌ |
| `cursorPaginate` | 1 | ❌ | ✅ |

Với danh sách "cuộn vô hạn" hoặc API, `cursorPaginate` là lựa chọn đúng. Với trang admin cần nhảy tới
trang 37, phải dùng `paginate`.

---

## 7. Ghi dữ liệu hàng loạt

### Insert nhiều dòng

```php
// ❌ 1000 query
foreach ($rows as $row) { Post::create($row); }

// ✅ 1 query — nhưng KHÔNG có timestamps, KHÔNG có event, KHÔNG có cast
Post::insert($rows);

// ✅ dung hoà: chia lô, tự thêm timestamps
collect($rows)->chunk(500)->each(function ($chunk) {
    Post::insert($chunk->map(fn ($r) => $r + [
        'created_at' => now(), 'updated_at' => now(),
    ])->all());
});
```

### Upsert

```php
Post::upsert(
    $rows,
    ['slug'],                           // cột xác định trùng
    ['title', 'body', 'updated_at'],    // cột cập nhật khi trùng
);
```

Một query, thay cho vòng lặp `updateOrCreate`.

### Bọc transaction

```php
DB::transaction(function () use ($rows) {
    Post::insert($rows);
    Activity::insert($logs);
}, attempts: 3);      // tự thử lại 3 lần khi deadlock
```

---

## 8. Query Builder khi Eloquent là phí

Với báo cáo/thống kê, hydrate model không mang lại gì:

```php
$stats = DB::table('posts')
    ->join('categories', 'posts.category_id', '=', 'categories.id')
    ->select('categories.name', DB::raw('count(*) as total'), DB::raw('avg(views) as avg_views'))
    ->where('posts.status', 'published')
    ->groupBy('categories.name')
    ->orderByDesc('total')
    ->get();
```

Trả `stdClass`. Không cast, không quan hệ, nhưng nhanh hơn nhiều và không tốn RAM dựng model.

### Đừng nối chuỗi vào SQL

```php
// ❌ SQL injection
DB::select("SELECT * FROM posts WHERE title = '{$request->q}'");

// ✅ tham số hoá
DB::select('SELECT * FROM posts WHERE title = ?', [$request->q]);

// ✅ DB::raw với binding
->whereRaw('LOWER(title) = ?', [strtolower($q)])
```

---

## 9. Danh sách kiểm tra khi trang chậm

Làm theo thứ tự, dừng khi hết chậm:

1. **Đếm query.** `DB::listen` + Pail. Trên 15 query cho một trang là có vấn đề.
2. **Tìm query lặp lại y hệt chỉ khác tham số.** Đó là N+1 → thêm `with()`.
3. **Tìm query đơn lẻ chậm nhất.** `EXPLAIN ANALYZE` nó. Thấy `Seq Scan` + `Rows Removed by Filter`
   lớn → thiếu index.
4. **Kiểm tra có `->get()` trên bảng lớn không.** Đổi sang `chunkById`/`cursor`.
5. **Kiểm tra `paginate` trên bảng lớn.** Đổi sang `cursorPaginate` nếu được.
6. **Còn chậm?** Lúc này mới đến lượt cache — [bài 02](./02-cache-nhieu-tang.md).

Thứ tự này quan trọng. Cache đặt lên trên một query N+1 chỉ giấu vấn đề đi cho tới lần cache miss đầu
tiên vào giờ cao điểm.

---

## Bài tập

1. Tạo bảng `bench` 500.000 dòng theo lệnh ở mục 4. Chạy `EXPLAIN ANALYZE` cho query lọc theo `email`
   trước và sau khi tạo index. Ghi lại `actual time` và `Rows Removed by Filter` của cả hai.

2. Viết script đo bộ nhớ và thời gian cho `get()`, `chunk(1000)`, `chunkById(1000)`, `cursor()` trên
   bảng đó. Lập bảng kết quả của bạn và so với bảng ở mục 5.

3. Giải thích bằng SQL vì sao `chunk` chậm hơn `chunkById` 11 lần. Dùng `DB::listen` để in ra câu SQL
   thật của lô cuối cùng.

4. Viết `Post::where('status','draft')->chunk(100, fn($posts) => ...)` trong đó vòng lặp đổi `status`
   thành `published`. Đếm số bản ghi thật sự được xử lý và so với tổng số. Sửa bằng `chunkById`.

5. Trang `/` của dự án Blog: đếm số query với 10 bài và với 200 bài. Hai số phải bằng nhau. Nếu không,
   tìm chỗ thiếu `with()`.

6. Chạy `php artisan db:table posts`. Cột `user_id` có index không? Nếu không, thêm và đo lại query
   `WHERE user_id = 1` bằng `EXPLAIN ANALYZE`.

7. Đổi `paginate(10)` thành `cursorPaginate(10)` ở trang danh sách. Đếm số query của cả hai.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Không index: `Seq Scan ... actual time=21.757..21.757`, `Rows Removed by Filter: 500000`.
Có index: `Bitmap Index Scan ... actual time=0.056..0.056`, `Buffers: shared read=3`.

**3.** Lô cuối của `chunk`:
```sql
select * from "bench" order by "id" asc limit 1000 offset 499000
```
PostgreSQL phải đọc rồi bỏ 499.000 dòng. Của `chunkById`:
```sql
select * from "bench" where "id" > 499000 order by "id" asc limit 1000
```
Nhảy thẳng bằng index khoá chính.

**4.** Chỉ khoảng **một nửa** số bản ghi được xử lý. Sau lô đầu, chúng không còn khớp `status = 'draft'`
nên `OFFSET 100` trỏ vào vùng dữ liệu khác, bỏ sót phần ở giữa. Đây là lỗi âm thầm — không exception,
không cảnh báo.

**7.** `paginate` → 2 query (một `count(*)`, một `select`). `cursorPaginate` → 1 query.

</details>

---

Tiếp theo: [02-cache-nhieu-tang.md](./02-cache-nhieu-tang.md)
