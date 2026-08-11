# Học Laravel 13 (dành cho người đã viết code backend)

Laravel là framework PHP full-stack. Nó gom sẵn routing, ORM, template engine, queue, cache, auth,
test runner vào một bộ, và ép bạn đặt mỗi thứ vào đúng chỗ của nó.

Tài liệu này viết cho **Laravel 13.26 + PHP 8.5 + PostgreSQL 18 + Livewire 4.4** — mọi lệnh và mọi
output trong đây đều được chạy thật trên máy trước khi viết ra, kể cả các thông báo lỗi.

> **Lưu ý quan trọng nếu bạn từng viết Laravel 8/9/10/11:** bản 13 đã đổi nhiều thứ ở mức "code trên
> mạng chép về sẽ chạy sai". Model dùng **PHP attribute** `#[Fillable]` thay cho `protected $fillable`,
> không còn `app/Http/Kernel.php`, không còn `routes/api.php` mặc định, `php artisan dev` chạy 4 tiến
> trình cùng lúc, và Livewire 4 đặt component vào `resources/views/components/` với **emoji ⚡ trong
> tên file**. Bảng đối chiếu đầy đủ nằm ở [10-cheatsheet.md](./10-cheatsheet.md).

---

## Lộ trình 7 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-chuan-bi.md](./00-chuan-bi.md) | Cài đặt, tạo project, đọc hiểu cây thư mục Laravel 13, nối PostgreSQL | 3h |
| 1 | [01-routing-va-controller.md](./01-routing-va-controller.md) | Vòng đời request, route, controller, route model binding, middleware | 3h |
| 2 | [02-blade-va-giao-dien.md](./02-blade-va-giao-dien.md) | Blade, layout, component, Vite 8 + Tailwind 4 | 4h |
| 3 | [03-database-va-eloquent.md](./03-database-va-eloquent.md) | Migration, Model kiểu attribute, quan hệ, query, factory, seeder | 5h |
| 4 | [04-validation-va-form.md](./04-validation-va-form.md) | FormRequest, rule, hiển thị lỗi, old input, CSRF | 3h |
| 4 | [05-auth-va-phan-quyen.md](./05-auth-va-phan-quyen.md) | Đăng ký/đăng nhập, session, Gate, Policy | 3h |
| 5 | [06-livewire-4.md](./06-livewire-4.md) | Livewire 4: SFC, `wire:model`, action, validate, phân trang, island | 5h |
| 6 | [07-queue-mail-event-test.md](./07-queue-mail-event-test.md) | Queue, Job, Event/Listener, Mail, Cache, Scheduler, Test | 5h |
| 7 | [08-du-an-blog.md](./08-du-an-blog.md) | **Dự án: Blog full-stack Blade + Livewire 4 + PostgreSQL** | 8h |
| — | [09-loi-thuong-gap.md](./09-loi-thuong-gap.md) | 24 lỗi kinh điển kèm thông báo lỗi nguyên văn | — |
| — | [10-cheatsheet.md](./10-cheatsheet.md) | Tra cứu nhanh + bảng "Laravel 13 đã đổi gì" | — |

### Hai bài bổ sung — cần cho phỏng vấn

Không nằm trong lộ trình 7 ngày, nhưng **bắt buộc** nếu bạn định đi phỏng vấn.

| File | Nội dung | Thời lượng |
|------|----------|------------|
| [11-container-facade-provider.md](./11-container-facade-provider.md) | Service Container, Facade (`__callStatic`), Service Provider (`register` vs `boot`), contextual binding | 4h |
| [12-collection-va-model-nang-cao.md](./12-collection-va-model-nang-cao.md) | Collection & LazyCollection, Accessor/Mutator, Observer, Artisan command, đa ngôn ngữ | 4h |

Bài 11 là nhóm kiến thức **gần như chắc chắn bị hỏi** khi phỏng vấn Laravel — nó phân biệt "biết dùng
framework" và "hiểu framework".

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 80 câu hỏi kèm đáp án hai tầng, 6 bài test code có lời
giải, 10 câu hỏi tình huống hệ thống, và checklist tự kiểm tra.

Bắt đầu bằng [04-tu-kiem-tra.md](./phong-van/04-tu-kiem-tra.md) để biết mình còn hổng chỗ nào trước khi ôn.

---

## Sau khi xong phần cơ bản

👉 **[nang-cao/](./nang-cao/README.md)** — bộ 9 bài về **hiệu năng, kiến trúc và vận hành**:
tối ưu Eloquent & N+1, cache nhiều tầng, queue & Horizon, realtime bằng Reverb,
kiến trúc dự án lớn, bảo mật, testing chuyên sâu, deploy bằng Octane/FrankenPHP, đo lường.

Điều kiện: đã làm xong dự án Blog ở bài 08.

---

## Môi trường tài liệu này dựa vào

Đây là số liệu đo trên máy, không phải chép từ tài liệu. Bạn tự kiểm tra lại bằng đúng các lệnh sau:

```bash
$ php -v
PHP 8.5.5 (cli) (built: Apr  7 2026 16:24:10) (NTS)

$ composer -V
Composer version 2.9.7 2026-04-14 13:31:52

$ php artisan --version
Laravel Framework 13.26.0

$ php artisan about | head -6
 Environment ..
 Application Name .. Laravel
 Laravel Version .. 13.26.0
 PHP Version .. 8.5.5
 Composer Version .. 2.9.7
```

Nếu `php -v` của bạn thấp hơn 8.3 thì Laravel 13 **không cài được** — `composer.json` của skeleton ghi
`"php": "^8.3"`, Composer sẽ từ chối ngay ở bước tạo project.

---

## Bốn nguyên tắc cốt lõi của Laravel

Hiểu 4 điều này là hiểu phần lớn framework. Mỗi điều đều có ví dụ chạy được ở các bài sau.

### 1. Service Container tự dựng đối tượng cho bạn

Bạn khai kiểu ở tham số, Laravel tự tạo và truyền vào. Không có chỗ nào bạn gọi `new`.

```php
// routes/api.php
Route::post('/posts', function (App\Http\Requests\StorePostRequest $request) {
    return response()->json(['ok' => true, 'data' => $request->validated()], 201);
});
```

`StorePostRequest` không được `new` ở đâu cả. Laravel nhìn kiểu của tham số, dựng object, **chạy luôn
validate trước khi vào thân hàm**. Gửi dữ liệu sai thì thân hàm không bao giờ chạy:

```bash
$ curl -s -X POST http://127.0.0.1:8000/api/posts \
    -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -d '{"title":"","body":"ngan","status":"xyz","category_id":999}'
```
```json
{
  "message": "Tiêu đề không được để trống. (and 4 more errors)",
  "errors": {
    "title": ["Tiêu đề không được để trống."],
    "slug": ["The slug field is required."],
    "body": ["Nội dung phải dài ít nhất 10 ký tự."],
    "status": ["The selected status is invalid."],
    "category_id": ["The selected category id is invalid."]
  }
}
```
Mã trạng thái là `422 Unprocessable Content`. Chi tiết ở [bài 04](./04-validation-va-form.md).

### 2. Quy ước quan trọng hơn cấu hình

Laravel đoán rất nhiều thứ từ **tên**. Model `Post` → bảng `posts`. Quan hệ `belongsTo(Category::class)`
→ cột khoá ngoại `category_id`. Route `{post}` với tham số kiểu `Post` → tự `Post::findOrFail()`.

Đặt tên đúng quy ước thì không phải cấu hình gì. Đặt sai thì phải khai tay từng cái — và đó là nguồn
gốc của phần lớn lỗi trong [bài 09](./09-loi-thuong-gap.md).

### 3. Mọi request đi qua một đường ống middleware

Request → middleware toàn cục → middleware nhóm → middleware route → controller → về lại qua đúng dãy
middleware đó theo chiều ngược. Bạn kiểm soát toàn bộ đường ống này ở **một file duy nhất**:
`bootstrap/app.php`. Laravel 13 không còn `app/Http/Kernel.php` nữa.

### 4. Eloquent tiện đến mức dễ gây chậm

`$post->author->name` trông vô hại, nhưng đặt trong vòng lặp là thành N+1 query. Laravel có công tắc
biến lỗi im lặng đó thành exception:

```php
Model::preventLazyLoading();
```
```
Illuminate\Database\LazyLoadingViolationException
Attempted to lazy load [author] on model [App\Models\Post] but lazy loading is disabled.
```

Bật nó ngay từ ngày đầu. Chi tiết và cái bẫy của nó ở [bài 03](./03-database-va-eloquent.md) mục 9.

---

## Cách học hiệu quả nhất

1. **Gõ tay, đừng copy-paste.** Cú pháp attribute và Blade chỉ ngấm khi tay quen.
2. **Mở `php artisan dev` suốt buổi học.** Một lệnh chạy cùng lúc web server, queue worker, log viewer
   và Vite — thấy lỗi ngay lúc gõ sai.
3. **Đọc 1 bài → gõ lại code trong bài → làm bài tập cuối bài.** Đừng đọc hết rồi mới code.
4. **Làm dự án ở [bài 08](./08-du-an-blog.md) song song.** Học tới đâu, áp vào Blog tới đó.
5. **Khi gặp lỗi, tra [bài 09](./09-loi-thuong-gap.md) trước khi tìm Google.** Code Laravel trên mạng
   đa số viết cho bản 10/11, chép về sẽ sai theo kiểu rất khó nhận ra.

---

## Dự án xuyên suốt

Một trang blog hoàn chỉnh chạy trong Laravel, không cần frontend riêng:

- **Public:** danh sách bài viết có phân trang, lọc theo chuyên mục, trang chi tiết, bình luận.
- **Auth:** đăng ký, đăng nhập, đăng xuất bằng session.
- **Admin:** CRUD bài viết bằng Livewire 4 — tìm kiếm gõ tới đâu lọc tới đó, không reload trang,
  không viết một dòng JavaScript nào.
- **Nền:** PostgreSQL 18, gửi mail thông báo qua queue, cache trang danh sách.

Mỗi bài học sẽ xây một mảnh của dự án này.
