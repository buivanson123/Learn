# Bài 06 — Livewire 4

Livewire cho phép viết giao diện động — tìm kiếm gõ tới đâu lọc tới đó, form không reload trang, modal,
phân trang mượt — mà **không viết một dòng JavaScript nào**.

Cách nó hoạt động: trạng thái component sống trên **server**. Khi người dùng gõ hoặc bấm, Livewire gửi
một request AJAX kèm "snapshot" trạng thái, server chạy lại component, trả về HTML mới, JavaScript của
Livewire so sánh và **vá** đúng phần DOM đã đổi.

Bản này là **Livewire 4.4** — khác hẳn v2/v3 về nơi đặt file. Đọc mục 2 trước khi làm gì khác.

```bash
$ composer require livewire/livewire
Using version ^4.4 for livewire/livewire
  - Installing livewire/livewire (v4.4.1)

$ php artisan about | grep -A 2 Livewire
 Livewire ..
 Livewire .. v4.4.1
```

---

## 1. Component đầu tiên

```bash
$ php artisan make:livewire Counter --sfc

 INFO Livewire component [resources/views/components/⚡counter.blade.php] created successfully.
```

Đọc kỹ đường dẫn: `resources/views/components/⚡counter.blade.php`. **Có emoji ⚡ trong tên file.**
Đây không phải lỗi hiển thị — mục 2 giải thích.

File sinh ra là **một file duy nhất** chứa cả class lẫn HTML:

```php
<?php

use Livewire\Component;

new class extends Component
{
    //
};
?>

<div>
    {{-- Smile, breathe, and go slowly. - Thich Nhat Hanh --}}
</div>
```

Viết vào:

```php
<?php

use Livewire\Component;

new class extends Component
{
    public int $count = 0;

    public function increment(): void
    {
        $this->count++;
    }
};
?>

<div>
    <h1>Đếm: {{ $count }}</h1>
    <button wire:click="increment">+1</button>
</div>
```

Gọi trong Blade:

```blade
<!DOCTYPE html>
<html>
<head>@livewireStyles</head>
<body>
    <livewire:counter />
@livewireScripts
</body>
</html>
```

HTML thật server trả về:

```html
<div wire:key="lw-920411839-0"
     wire:snapshot="{&quot;data&quot;:{&quot;count&quot;:0},&quot;memo&quot;:{&quot;id&quot;:&quot;woTbzNGKJPY9owov6g8D&quot;,
                     &quot;name&quot;:&quot;counter&quot;,...},&quot;checksum&quot;:&quot;7a3f9d39...&quot;}"
     wire:id="woTbzNGKJPY9owov6g8D" wire:name="counter">
    <h1>Đếm: 0</h1>
    <button wire:click="increment">+1</button>
</div>
```

Ba thứ đáng chú ý:

- `wire:snapshot` chứa **toàn bộ trạng thái** (`count: 0`) dưới dạng JSON. Đây là thứ được gửi lên
  server ở mỗi lần tương tác.
- `checksum` là chữ ký chống sửa. Người dùng chỉnh snapshot trong DevTools thì server từ chối.
- Component **bắt buộc có đúng một thẻ gốc**. Có hai thẻ ngang hàng là Livewire không vá DOM được.

---

## 2. ⭐ Nơi đặt file và cú pháp gọi — chỗ Livewire 4 khác hẳn

`make:livewire` có ba dạng:

```bash
$ php artisan make:livewire Counter --sfc
 INFO Livewire component [resources/views/components/⚡counter.blade.php] created successfully.

$ php artisan make:livewire PostList --mfc
 INFO Livewire component [resources/views/components/⚡post-list] created successfully.

$ php artisan make:livewire OldStyle --class
 INFO Livewire component [app/Livewire/OldStyle.php] created successfully.
```

| Dạng | Cờ | File sinh ra |
|------|-----|--------------|
| Single-file (SFC) | `--sfc` | `resources/views/components/⚡counter.blade.php` |
| Multi-file (MFC) | `--mfc` | `resources/views/components/⚡post-list/post-list.php` + `post-list.blade.php` |
| Class (kiểu v2/v3) | `--class` | `app/Livewire/OldStyle.php` + `resources/views/livewire/old-style.blade.php` |

Dạng MFC tách class và view thành hai file trong cùng thư mục:

```bash
$ ls resources/views/components/⚡post-list/
post-list.blade.php
post-list.php
```

### Emoji ⚡ để làm gì

Nó là **dấu hiệu thư mục**, giúp bạn nhìn `resources/views/components/` là phân biệt ngay đâu là
component Blade tĩnh, đâu là component Livewire. Emoji **không** nằm trong tên component.

Tắt nếu bạn không thích (ví dụ hệ thống CI hoặc editor xử lý emoji trong tên file không tốt):

```bash
$ php artisan make:livewire Counter --sfc --emoji=false
```

### Gọi component thế nào

```blade
<livewire:counter />                    ✅ đúng
@livewire('counter')                    ✅ đúng (cú pháp cũ, vẫn chạy)
<x-⚡counter />                          ❌ SAI
```

Cái sai ở trên **không báo lỗi** — Blade in nguyên văn ra HTML, và bạn nhìn trang trắng mà không hiểu
vì sao. Đây là kết quả thật khi tôi thử:

```bash
$ curl -s http://127.0.0.1:8000/counter | grep counter
    <x-⚡counter />                      ← in thẳng ra, không được biên dịch
```

Nhớ: dấu ⚡ nằm trong **tên file**, không nằm trong **tên tag**. Tên component là phần sau emoji.

Truyền tham số:

```blade
<livewire:comment-form :post="$post" />
<livewire:post-list category="backend" :per-page="10" />
```

Dấu hai chấm = truyền biến PHP. Không có = truyền chuỗi.

---

## 3. Thuộc tính và ràng buộc dữ liệu

Mọi thuộc tính `public` đều tự động đồng bộ hai chiều với giao diện.

```php
public string $search = '';
public int $perPage = 5;
public bool $showFilters = false;
public array $selected = [];
public Post $post;                  // model cũng được — Livewire tự nạp lại theo id
```

```blade
<input type="text" wire:model="search">
<input type="checkbox" wire:model="showFilters">
<select wire:model="perPage"> ... </select>
```

### `wire:model` mặc định **không** gửi request

Đây là điểm khác lớn nhất so với Livewire 2. `wire:model` chỉ giữ giá trị ở client; server chỉ biết khi
có một action chạy (ví dụ submit form). Muốn cập nhật ngay khi gõ, phải nói rõ:

```blade
<input wire:model.live="search">                        {{-- gửi mỗi lần gõ --}}
<input wire:model.live.debounce.300ms="search">         {{-- chờ 300ms mới gửi --}}
<input wire:model.blur="search">                        {{-- gửi khi rời ô --}}
<input wire:model.lazy="search">                        {{-- gửi khi change --}}
```

Triệu chứng khi quên `.live`: gõ vào ô tìm kiếm mà danh sách **không đổi gì cả**, cũng không có lỗi.

`.debounce.300ms` không phải trang trí: không có nó, mỗi phím gõ là một request tới server. Gõ
"laravel" là 7 request và 7 lần truy vấn database.

### Thuộc tính không được sửa từ client

```php
use Livewire\Attributes\Locked;

#[Locked]
public int $postId;
```

Không có `#[Locked]`, người dùng sửa `wire:snapshot` trong DevTools là đổi được `postId` sang bài viết
của người khác. Với mọi id hoặc cờ phân quyền, **luôn** dùng `#[Locked]`.

### Đồng bộ với URL

```php
use Livewire\Attributes\Url;

#[Url(as: 'q', except: '')]
public string $search = '';
```

Gõ vào ô tìm kiếm thì thanh địa chỉ thành `?q=laravel`, và tải lại trang vẫn giữ nguyên kết quả.
`except: ''` để chuỗi rỗng không sinh ra `?q=` thừa.

Xác nhận Livewire đã nhận cấu hình đó — nhìn `wire:effects` trong HTML thật:

```html
wire:effects="{"url":{"search":{"as":"q","use":"replace","alwaysShow":false,"except":""},
                     "paginators.page":{"as":"page","use":"push",...}}}"
```

---

## 4. Action

```blade
<button wire:click="increment">+1</button>
<button wire:click="delete({{ $post->id }})">Xoá</button>
<form wire:submit="save"> ... </form>
<input wire:keydown.enter="search">
<div wire:click.stop="select">...</div>
<button wire:click.prevent="save">Lưu</button>
```

`wire:submit` tự động chặn `submit` mặc định của trình duyệt — không cần `.prevent`.

### Trạng thái đang tải

```blade
<button type="submit" wire:loading.attr="disabled">Gửi</button>

<span wire:loading wire:target="save">Đang lưu...</span>
<div wire:loading.class="opacity-50">...</div>
```

`wire:target` giới hạn chỉ báo tải cho đúng action đó. Không có nó, mọi tương tác trên trang đều làm
nó hiện lên.

### Xác nhận trước khi xoá

```blade
<button wire:click="delete({{ $post->id }})"
        wire:confirm="Xoá bài viết này? Không khôi phục được.">
    Xoá
</button>
```

---

## 5. Validate trong Livewire

```php
use Livewire\Attributes\Validate;

new class extends Component
{
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
```

```blade
<form wire:submit="save">
    <textarea wire:model="body"></textarea>
    @error('body') <p class="error">{{ $message }}</p> @enderror
    <button type="submit" wire:loading.attr="disabled">Gửi</button>
</form>
```

`@error` dùng y hệt form thường — Livewire đổ lỗi vào cùng một `MessageBag`.

Validate ngay khi người dùng rời ô:

```php
#[Validate('required|email', onUpdate: false)]
public string $email = '';
```

```blade
<input wire:model.blur="email">
```

Hoặc khai tập trung:

```php
protected function rules(): array
{
    return [
        'body' => ['required', 'string', 'min:5'],
    ];
}

protected function messages(): array
{
    return ['body.min' => 'Bình luận phải dài ít nhất :min ký tự.'];
}
```

> ⚠️ **Bẫy `#[Fillable]` lại xuất hiện.** Đoạn dưới trông đúng nhưng hỏng:
> ```php
> $this->post->comments()->create([
>     'body' => $this->body,
>     'user_id' => auth()->id(),
> ]);
> ```
> Vì `Comment` khai `#[Fillable(['body'])]`, cột `user_id` bị bỏ qua trong im lặng:
> ```
> SQLSTATE[23502]: Not null violation: 7 ERROR:  null value in column "user_id"
> of relation "comments" violates not-null constraint
> ```
> Cách đúng là tạo model rồi gán cột không-fillable ngoài mảng, như code ở trên. Xem lại
> [bài 03 mục 3](./03-database-va-eloquent.md).

---

## 6. Thuộc tính tính toán và phân trang

```php
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

    public int $perPage = 5;

    public function updatedSearch(): void
    {
        $this->resetPage();
    }

    #[Computed]
    public function posts()
    {
        return Post::query()
            ->with('author')
            ->when($this->search !== '', fn ($q) => $q->where('title', 'ilike', "%{$this->search}%"))
            ->latest('published_at')
            ->paginate($this->perPage);
    }
};
```

```blade
<div>
    <input type="search" wire:model.live.debounce.300ms="search" placeholder="Tìm bài viết...">

    <p>Tìm thấy {{ $this->posts->total() }} bài</p>

    <ul>
        @foreach ($this->posts as $post)
            <li wire:key="post-{{ $post->id }}">{{ $post->title }} — {{ $post->author->name }}</li>
        @endforeach
    </ul>

    {{ $this->posts->links() }}
</div>
```

Chạy thật với 29 bài viết:

```html
<p>Tìm thấy 29 bài</p>
<ul>
    <li wire:key="post-3">Bai 1 — Son</li>
    <li wire:key="post-4">Bai 2 — Son</li>
    ...
</ul>
<nav role="navigation" aria-label="Pagination Navigation">
    <button type="button" wire:click="nextPage('page')" wire:loading.attr="disabled">Next »</button>
</nav>
```

Bốn quy tắc rút ra:

1. **`#[Computed]` truy cập bằng `$this->`** trong view, không phải `$posts`. Quên `$this->` thì:
   ```
   ErrorException  Undefined variable $posts
   ```
2. Kết quả `#[Computed]` được **nhớ trong một request** — gọi `$this->posts` ba lần chỉ chạy query
   một lần. Không dùng `#[Computed]` mà gọi query trong `render()` thì nó chạy lại mỗi lần.
3. **`wire:key` trong vòng lặp là bắt buộc.** Không có nó, thuật toán vá DOM ghép nhầm phần tử khi
   danh sách đổi thứ tự — hiện tượng: ô input trong hàng này nhảy sang hàng khác.
4. `updatedSearch()` gọi `resetPage()` — không có thì gõ tìm kiếm lúc đang ở trang 3 sẽ ra danh sách
   rỗng vì kết quả mới chỉ có 1 trang.

Hook `updatedXxx()` chạy mỗi khi thuộc tính `xxx` đổi. Dạng tổng quát: `updated(string $name, $value)`.

Nhớ `with('author')` — Livewire render lại toàn bộ component ở mỗi lần gõ, nên N+1 ở đây đắt gấp
nhiều lần so với trang tĩnh.

---

## 7. Giao tiếp giữa các component

### Bắn và bắt sự kiện

```php
$this->dispatch('comment-added', postId: $this->post->id);
$this->dispatch('comment-added')->to(CommentList::class);   // gửi đúng một component
$this->dispatch('close-modal')->self();
```

```php
use Livewire\Attributes\On;

#[On('comment-added')]
public function refreshList(int $postId): void
{
    unset($this->comments);      // xoá cache của #[Computed] để nó tính lại
}
```

Bắt từ JavaScript khi cần:

```blade
<script>
    Livewire.on('comment-added', (event) => { console.log(event); });
</script>
```

### Cha truyền xuống con

```blade
<livewire:post-stats :post="$post" :key="$post->id" />
```

```php
use Livewire\Attributes\Reactive;

#[Reactive]
public Post $post;      // cha đổi thì con render lại theo
```

Không có `#[Reactive]`, component con giữ giá trị lúc khởi tạo và không đổi khi cha đổi.

---

## 8. Tối ưu: lazy, island, renderless

### Nạp muộn

```blade
<livewire:heavy-chart lazy />
```

Trang tải xong ngay, component nặng được nạp bằng request thứ hai. Đặt khung chờ:

```php
public function placeholder(): string
{
    return '<div class="h-64 animate-pulse rounded bg-gray-200"></div>';
}
```

### Island — chỉ render lại một mảnh

Livewire 4 thêm khái niệm "island": một vùng trong component được render lại độc lập với phần còn lại.

```blade
<div>
    <h1>{{ $post->title }}</h1>      {{-- phần này không đổi, không render lại --}}

    @island
        <p>Lượt xem: {{ $this->viewCount }}</p>
        <button wire:click="refreshViews">Làm mới</button>
    @endisland
</div>
```

HTML thật server trả về — Livewire đánh dấu vùng island bằng comment `FRAGMENT`:

```html
<div wire:snapshot="{...&quot;islands&quot;:[{&quot;name&quot;:&quot;571707c0-1&quot;,&quot;token&quot;:&quot;571707c0-1&quot;}]...}"
     wire:id="Ru9eAAjgaRwqox9lx3yx" wire:name="island-demo">
    <h1>Tiêu đề không đổi</h1>

    <!--[if FRAGMENT:type=island|name=571707c0-1|token=571707c0-1|mode=morph]><![endif]-->
    <p>Lượt xem: 0</p>
    <button wire:click="refreshViews">Làm mới</button>
    <!--[if ENDFRAGMENT:type=island|name=571707c0-1|token=571707c0-1|mode=morph]><![endif]-->
</div>
```

Khoá `islands` xuất hiện trong `memo` của snapshot với tên và token của từng vùng. Component không
dùng `@island` thì khoá đó là mảng rỗng:

```
"memo":{...,"assets":[],"errors":[],"locale":"en","islands":[]}
```

Hữu ích khi component có một phần rất nặng (bảng 500 dòng) và một phần đổi liên tục (bộ đếm) — chỉ
phần trong `@island` được gửi lại qua mạng.

### Action không cần render lại

```php
use Livewire\Attributes\Renderless;

#[Renderless]
public function trackView(): void
{
    $this->post->increment('views');
}
```

Bỏ hẳn bước render + trả HTML. Dùng cho việc ghi nhận sự kiện.

---

## 9. Layout cho component làm nguyên trang

Component có thể làm route riêng:

```php
Route::get('/posts', PostIndex::class)->name('posts.index');
```

```php
use Livewire\Attributes\Layout;
use Livewire\Attributes\Title;

#[Layout('components.layouts.app')]
#[Title('Danh sách bài viết')]
new class extends Component
{
    // ...
};
```

Sinh sẵn một layout:

```bash
$ php artisan livewire:layout

 LAYOUT CREATED 🤙

CLASS: resources/views/layouts/app.blade.php
```

```blade
{{-- resources/views/layouts/app.blade.php --}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{ $title ?? config('app.name') }}</title>
        @vite(['resources/css/app.css', 'resources/js/app.js'])
        @livewireStyles
    </head>
    <body>
        {{ $slot }}
        @livewireScripts
    </body>
</html>
```

> Lệnh đặt file ở `resources/views/layouts/`, nên `#[Layout('layouts.app')]`. Muốn gọi được bằng
> `<x-layouts.app>` trong Blade thường thì chuyển sang `resources/views/components/layouts/` và đổi
> attribute thành `#[Layout('components.layouts.app')]`.

---

## 10. Test component

Đây là cách nhanh nhất để biết component có chạy đúng không — nhanh hơn bấm thử trên trình duyệt nhiều.

```php
namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

class CommentFormTest extends TestCase
{
    use RefreshDatabase;

    public function test_bo_trong_thi_bao_loi(): void
    {
        $post = Post::factory()->for(User::factory(), 'author')->create();

        Livewire::test('comment-form', ['post' => $post])
            ->set('body', '')
            ->call('save')
            ->assertHasErrors(['body' => 'required']);

        $this->assertSame(0, $post->comments()->count());
    }

    public function test_luu_duoc_binh_luan(): void
    {
        $post = Post::factory()->for(User::factory(), 'author')->create();

        Livewire::test('comment-form', ['post' => $post])
            ->set('body', 'Bai viet nay rat hay')
            ->call('save')
            ->assertHasNoErrors()
            ->assertDispatched('comment-added')
            ->assertSet('body', '');

        $this->assertSame(1, $post->comments()->count());
    }
}
```

```bash
$ php artisan test --filter=CommentFormTest

   PASS  Tests\Feature\CommentFormTest
  ✓ bo trong thi bao loi                                                    0.42s
  ✓ luu duoc binh luan                                                      0.04s

  Tests:    2 passed (8 assertions)
  Duration: 0.54s
```

Tên component trong `Livewire::test('comment-form')` là **tên không có emoji**, viết kebab-case.

Các assertion hay dùng:

```php
->assertSee('...')        ->assertDontSee('...')
->assertSet('body', '')   ->assertCount('posts', 5)
->assertHasErrors(['body' => 'required'])
->assertHasNoErrors()
->assertDispatched('comment-added')
->assertRedirect(route('posts.index'))
->assertStatus(200)
```

### ⚠️ Hai bẫy khi test — cả hai đều gặp thật

**Bẫy 1: `->for()` đoán sai tên quan hệ.**

Model `Post` khai quan hệ tên `author()` (trỏ vào `user_id`), nhưng `->for($user)` đoán tên quan hệ từ
tên class là `user()`:

```
BadMethodCallException  Call to undefined method App\Models\Post::user()
```

Sửa: nói rõ tên quan hệ — `->for($user, 'author')`.

**Bẫy 2: test chạy trên database khác database thật.**

`phpunit.xml` mặc định của Laravel 13:

```xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

Trong khi ứng dụng chạy PostgreSQL. Kết quả: scope dùng `ilike` (toán tử **chỉ Postgres có**) chạy
ngon trên trình duyệt nhưng chết trong test:

```
SQLSTATE[HY000]: General error: 1 near "ilike": syntax error
(Connection: sqlite, Database: :memory:,
 SQL: select count(*) as "aggregate" from "posts" where "title" ilike %Hoc%)
```

Đây là loại lỗi tệ nhất: test xanh không chứng minh production chạy được, và ngược lại. Sửa bằng cách
cho test dùng đúng loại database:

```xml
<env name="DB_CONNECTION" value="pgsql"/>
<env name="DB_DATABASE" value="blog_test"/>
```

Không cần tạo database bằng tay — Laravel tự tạo nếu chưa có:

```bash
$ docker exec blog-pg psql -U blog -d postgres -c '\l'
   Name    | Owner |
-----------+-------+
 blog      | blog  |
 blog_test | blog  |      ← Laravel tự tạo ở lần chạy test đầu tiên
```

Đánh đổi: test chậm hơn SQLite in-memory một chút. Đổi lại bạn test đúng thứ sẽ chạy trên production.

---

## 11. Khi nào **không** dùng Livewire

Livewire trả về HTML từ server ở mỗi tương tác. Nó không hợp cho:

- Kéo thả, canvas, biểu đồ tương tác → dùng Alpine.js hoặc thư viện JS.
- Ứng dụng cần chạy khi mất mạng.
- Tương tác cần phản hồi dưới 50ms (mỗi lần tương tác là một vòng mạng).

Alpine.js đi kèm sẵn trong Livewire, dùng cho tương tác thuần client:

```blade
<div x-data="{ open: false }">
    <button @click="open = !open">Menu</button>
    <div x-show="open">...</div>
</div>
```

Quy tắc chọn: **đổi dữ liệu trên server → Livewire; chỉ đổi giao diện → Alpine.**

---

## Bài tập

1. Tạo `<livewire:counter />` bằng `--sfc`. Gọi nó bằng `<x-⚡counter />` trước, xem HTML trả về, rồi
   đổi sang `<livewire:counter />`. Giải thích vì sao cách đầu không báo lỗi.

2. Tạo component tìm kiếm dùng `wire:model="search"` (**không** có `.live`). Gõ vào ô tìm kiếm và mô tả
   hiện tượng. Thêm `.live` rồi `.live.debounce.300ms`, mở tab Network để đếm số request khi gõ
   "laravel".

3. Thêm `#[Url(as: 'q', except: '')]`. Tìm một từ, sao chép URL, mở tab mới và dán vào — kết quả có
   giữ nguyên không?

4. Bỏ `wire:key` khỏi vòng lặp danh sách có ô input trong mỗi hàng. Sắp xếp lại danh sách và quan sát
   giá trị các ô input.

5. Bỏ `updatedSearch() { $this->resetPage(); }`. Sang trang 3 rồi gõ tìm kiếm. Mô tả hiện tượng.

6. Viết `CommentForm` lưu bình luận bằng `$this->post->comments()->create(['body' => ..., 'user_id' => ...])`.
   Chạy test và ghi lại lỗi SQL. Sửa theo cách ở mục 5.

7. Viết test cho component tìm kiếm bằng `Livewire::test()`. Chạy trên `phpunit.xml` mặc định (SQLite)
   và ghi lại lỗi `ilike`. Đổi sang `pgsql` rồi chạy lại.

8. Thêm `#[Locked]` vào một thuộc tính id. Mở DevTools, sửa `wire:snapshot` rồi bấm nút — quan sát
   phản ứng của server.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `<x-⚡counter />` không khớp bất kỳ component Blade nào nên Blade in nguyên văn ra HTML. Không có
exception vì về mặt cú pháp đó chỉ là text. Emoji nằm trong **tên file** để phân loại, không nằm trong
**tên component**.

**2.** Không `.live`: gõ không có gì xảy ra, danh sách đứng yên (giá trị chỉ nằm ở client). Có `.live`:
7 request cho 7 ký tự "laravel". Có `.debounce.300ms`: 1 request nếu gõ liên tục.

**5.** Trang trắng / "không tìm thấy bài nào" dù kết quả có tồn tại — vì `page=3` vẫn còn trong trạng
thái, mà kết quả lọc mới chỉ có 1 trang.

**6.**
```
SQLSTATE[23502]: Not null violation: 7 ERROR:  null value in column "user_id" of relation "comments"
violates not-null constraint
```
`user_id` không nằm trong `#[Fillable(['body'])]` của `Comment` nên bị bỏ qua trong im lặng.

**7.**
```
SQLSTATE[HY000]: General error: 1 near "ilike": syntax error (Connection: sqlite, Database: :memory:)
```

**8.** Server ném lỗi checksum và từ chối request — snapshot đã bị sửa nên chữ ký không khớp.

</details>

---

Tiếp theo: [07-queue-mail-event-test.md](./07-queue-mail-event-test.md).
