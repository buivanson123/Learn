# Bài 02 — Blade và giao diện

Mục tiêu: dựng được giao diện có layout, component tái dùng, form an toàn, và hiểu Blade thực chất
chỉ là PHP đã được viết gọn lại.

---

## 1. Blade là gì — chứng minh trong 30 giây

Blade **không phải** một ngôn ngữ template chạy lúc runtime. Nó là bộ biên dịch: file `.blade.php`
được dịch thành file PHP thuần, cất trong `storage/framework/views/`, rồi PHP chạy file đó.

```bash
$ ls storage/framework/views | head -3
0caaf9db0a55f2ec16ebf7cde38d0b30.php
4f8b6641af76a203f9d8856970ed4da1.php
5fb7de27f26dc3b6a9e6db3b72e2370a.php

$ head -5 storage/framework/views/0caaf9db0a55f2ec16ebf7cde38d0b30.php
<?php $__env->startSection('title', __('Server Error')); ?>
<?php $__env->startSection('code', '500'); ?>
...
<?php /**PATH .../vendor/laravel/framework/.../views/500.blade.php ENDPATH**/ ?>
```

Dòng cuối `/**PATH ... ENDPATH**/` cho biết file gốc là cái nào — rất hữu ích khi debug.

Hệ quả thực tế: **biên dịch chỉ chạy lại khi file `.blade.php` mới hơn file đã biên dịch**. Nếu bạn
sửa view mà trình duyệt không đổi, xoá cache:

```bash
$ php artisan view:clear
 INFO Compiled views cleared successfully.
```

---

## 2. Cú pháp cơ bản và cái bẫy escape

File `resources/views/demo-blade.blade.php`:

```blade
@php $name = '<b>Sơn</b>'; $items = ['a', 'b']; @endphp
1. escape:   {{ $name }}
2. raw:      {!! $name !!}
```

Kết quả thật khi truy cập route trả view này:

```
1. escape:   &lt;b&gt;Sơn&lt;/b&gt;
2. raw:      <b>Sơn</b>
```

- `{{ }}` chạy qua `htmlspecialchars()` — **luôn dùng cái này**.
- `{!! !!}` in thẳng. Chỉ dùng khi bạn chắc chắn nội dung do mình sinh ra. In dữ liệu người dùng nhập
  bằng `{!! !!}` là mở cửa cho XSS.

Vài dạng khác:

```blade
{{ $post->title ?? 'Không có tiêu đề' }}
{{-- Comment Blade, không lọt ra HTML --}}
@{{ khongPhaiBlade }}   {{-- in ra literal, dùng khi trộn với Vue/Alpine --}}
```

---

## 3. Điều kiện và vòng lặp

```blade
@if ($post->status === 'published')
    Đã đăng
@elseif ($post->status === 'draft')
    Bản nháp
@else
    Không rõ
@endif

@unless (auth()->check())  Bạn chưa đăng nhập  @endunless

@isset($post->published_at)  ...  @endisset
@empty($comments)  Chưa có bình luận  @endempty

@auth      Chào {{ auth()->user()->name }}  @endauth
@guest     <a href="{{ route('login') }}">Đăng nhập</a>  @endguest

@can('update', $post)  <a href="...">Sửa</a>  @endcan
```

### Vòng lặp và biến `$loop`

```blade
@foreach ($items as $item)
   - {{ $loop->iteration }}/{{ $loop->count }} {{ $item }} {{ $loop->last ? '(cuối)' : '' }}
@endforeach
```

```
   - 1/2 a
   - 2/2 b (cuối)
```

`$loop` có sẵn: `index` (từ 0), `iteration` (từ 1), `first`, `last`, `count`, `remaining`, `depth`,
và `parent` khi lồng nhau.

### `@forelse` — vòng lặp có nhánh rỗng

```blade
@forelse ([] as $x)
   {{ $x }}
@empty
   không có gì
@endforelse
```

```
   không có gì
```

> ⚠️ **Bẫy thật, đã đo:** `@empty` có **hai** vai trò. Đứng trong `@forelse` thì nó không nhận tham số.
> Đứng một mình thì nó là `@empty($bien)`. Viết `@empty (không có gì)` trong `@forelse` khiến Blade
> hiểu `(không có gì)` là tham số PHP và nổ lúc biên dịch:
>
> ```
> Illuminate\View\ViewException
> syntax error, unexpected identifier "có" (View: .../resources/views/demo-blade.blade.php)
> ```
>
> Thông báo lỗi trỏ vào **file .blade.php gốc**, không phải file đã biên dịch — đó là công của dòng
> `ENDPATH` ở mục 1.

---

## 4. Layout — hai kiểu, dùng kiểu component

### Kiểu cũ: `@extends` / `@section` / `@yield`

```blade
{{-- resources/views/layouts/app.blade.php --}}
<html><body>
    <main>@yield('content')</main>
</body></html>
```
```blade
{{-- resources/views/posts/index.blade.php --}}
@extends('layouts.app')
@section('content')
    <h1>Bài viết</h1>
@endsection
```

Vẫn chạy, nhưng đừng dùng cho code mới.

### Kiểu nên dùng: layout là component

```blade
{{-- resources/views/components/layouts/app.blade.php --}}
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $title ?? config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="bg-gray-50 text-gray-900">
    <nav class="border-b bg-white px-6 py-4">
        <a href="{{ route('home') }}" class="font-semibold">Blog</a>
    </nav>

    <main class="mx-auto max-w-3xl px-6 py-8">
        {{ $slot }}
    </main>
</body>
</html>
```

```blade
{{-- resources/views/posts/index.blade.php --}}
<x-layouts.app title="Danh sách bài viết">
    <h1 class="text-2xl font-bold">Bài viết</h1>
    ...
</x-layouts.app>
```

Ưu điểm so với `@extends`: truyền dữ liệu vào layout bằng **thuộc tính** (`title="..."`), lồng nhiều
layout được, và dùng chung được cú pháp với mọi component khác.

> Lệnh `php artisan livewire:layout` sinh sẵn một layout kiểu này. Lưu ý nó đặt file ở
> `resources/views/layouts/app.blade.php` (không có `components/`) — muốn gọi bằng `<x-layouts.app>`
> thì chuyển vào `resources/views/components/layouts/`.

---

## 5. Component

### Component ẩn danh (chỉ có view) — dùng cho phần lớn trường hợp

```bash
$ php artisan make:component Badge --view

 INFO View [resources/views/components/badge.blade.php] created successfully.
```

```blade
{{-- resources/views/components/badge.blade.php --}}
@props(['color' => 'gray'])

<span {{ $attributes->merge(['class' => "badge badge-$color"]) }}>
    {{ $slot }}
</span>
```

Dùng:

```blade
<x-badge color="green" class="mt-2" id="x">Đã đăng</x-badge>
```

Kết quả thật:

```html
<span class="badge badge-green mt-2" id="x">
    Đã đăng
</span>
```

Ba điều quan trọng trong output trên:

1. `color` khai trong `@props` nên **không** rơi vào `$attributes` — nó không xuất hiện trong HTML.
2. `class="mt-2"` được `merge` **cộng thêm** vào class mặc định, không đè lên.
3. `id="x"` không khai ở đâu cả nhưng vẫn được truyền thẳng ra thẻ — đó là công của `{{ $attributes }}`.

Nếu muốn đè thay vì cộng, dùng `$attributes->class([...])` hoặc bỏ `merge`.

### Component có class (khi cần logic PHP)

```bash
$ php artisan make:component Alert

 INFO Component [app/View/Components/Alert.php] created successfully.
 INFO View [resources/views/components/alert.blade.php] created successfully.
```

Nó tạo **hai** file. Class:

```php
namespace App\View\Components;

use Illuminate\View\Component;
use Illuminate\Contracts\View\View;

class Alert extends Component
{
    public function __construct(
        public string $type = 'info',
        public ?string $title = null,
    ) {}

    public function classes(): string
    {
        return match ($this->type) {
            'error'   => 'bg-red-50 text-red-800 border-red-200',
            'success' => 'bg-green-50 text-green-800 border-green-200',
            default   => 'bg-blue-50 text-blue-800 border-blue-200',
        };
    }

    public function render(): View
    {
        return view('components.alert');
    }
}
```

View — mọi thuộc tính `public` của class dùng được thẳng:

```blade
<div {{ $attributes->merge(['class' => "rounded border p-4 {$classes()}"]) }}>
    @if ($title)
        <p class="font-semibold">{{ $title }}</p>
    @endif
    {{ $slot }}
</div>
```

```blade
<x-alert type="error" title="Lỗi">Không lưu được bài viết.</x-alert>
```

### Slot có tên

```blade
{{-- components/card.blade.php --}}
<div class="rounded border">
    <div class="border-b px-4 py-2 font-semibold">{{ $header }}</div>
    <div class="p-4">{{ $slot }}</div>
    <div class="border-t px-4 py-2">{{ $footer ?? '' }}</div>
</div>
```

```blade
<x-card>
    <x-slot:header>Bài viết mới nhất</x-slot:header>

    Nội dung chính ở đây.

    <x-slot:footer>
        <a href="{{ route('posts.index') }}">Xem tất cả</a>
    </x-slot:footer>
</x-card>
```

### Quy tắc đặt tên → tên tag

| File | Tag |
|------|-----|
| `components/badge.blade.php` | `<x-badge />` |
| `components/post-card.blade.php` | `<x-post-card />` |
| `components/layouts/app.blade.php` | `<x-layouts.app />` |
| `components/forms/input.blade.php` | `<x-forms.input />` |

Thư mục thành dấu chấm. Đặt sai chỗ thì lỗi rất rõ ràng:

```
InvalidArgumentException  Unable to locate a class or view for component [post-card].
```

---

## 6. Form: CSRF và method giả

HTML chỉ gửi được `GET` và `POST`. Route `PUT`/`PATCH`/`DELETE` cần method giả:

```blade
<form method="POST" action="{{ route('posts.update', $post) }}">
    @csrf
    @method('PUT')

    <input type="text" name="title" value="{{ old('title', $post->title) }}">
    <button type="submit">Lưu</button>
</form>
```

- `@csrf` sinh `<input type="hidden" name="_token" value="...">`. Thiếu nó → **419 Page Expired**.
- `@method('PUT')` sinh `<input type="hidden" name="_method" value="PUT">`. Thiếu nó → **405 Method
  Not Allowed** (xem [bài 01 mục 10](./01-routing-va-controller.md)).
- `old('title', $post->title)` giữ lại dữ liệu người dùng vừa gõ khi validate hỏng; nếu không có dữ
  liệu cũ thì lấy giá trị thứ hai.

### Hiện lỗi validate

```blade
@error('title')
    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
@enderror

{{-- Hoặc gộp tất cả --}}
@if ($errors->any())
    <x-alert type="error" title="Có {{ $errors->count() }} lỗi">
        <ul class="list-disc pl-5">
            @foreach ($errors->all() as $error)
                <li>{{ $error }}</li>
            @endforeach
        </ul>
    </x-alert>
@endif
```

Biến `$errors` **luôn tồn tại** trong mọi view của nhóm `web` — không cần truyền từ controller.

### Flash message sau redirect

```php
return redirect()->route('posts.index')->with('status', 'Đã lưu bài viết.');
```

```blade
@if (session('status'))
    <x-alert type="success">{{ session('status') }}</x-alert>
@endif
```

---

## 7. Vite 8 + Tailwind 4

### Cấu hình

`resources/css/app.css` — Tailwind 4 **không còn `tailwind.config.js`**:

```css
@import 'tailwindcss';
```

`vite.config.js` sinh sẵn:

```js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        tailwindcss(),
    ],
});
```

`refresh: true` khiến trình duyệt tự tải lại khi bạn sửa file Blade.

### Nhúng vào Blade

```blade
@vite(['resources/css/app.css', 'resources/js/app.js'])
```

Directive này thông minh: lúc `npm run dev` nó trỏ vào server Vite (có hot reload), lúc production nó
đọc `public/build/manifest.json` để lấy đúng file đã băm tên.

### Lỗi kinh điển khi deploy

Quên build thì trang trắng và console báo:

```
Illuminate\Foundation\ViteManifestNotFoundException
Vite manifest not found at: /var/www/public/build/manifest.json
```

Sửa:

```bash
$ npm run build
```

Nhớ chạy `npm run build` trong bước deploy, và **commit `public/build/` hoặc build trong CI** — đừng
để production tự chạy `npm`.

---

## 8. Truyền dữ liệu vào view

```php
return view('posts.index', ['posts' => $posts]);
return view('posts.index', compact('posts', 'categories'));
return view('posts.show')->with('post', $post);
```

### Dữ liệu dùng chung cho mọi view

Khi có thứ mọi trang đều cần (ví dụ danh sách chuyên mục ở sidebar), đừng truyền lại ở từng
controller. Khai một lần trong `app/Providers/AppServiceProvider.php`:

```php
use Illuminate\Support\Facades\View;
use App\Models\Category;

public function boot(): void
{
    View::composer('components.layouts.app', function ($view) {
        $view->with('navCategories', Category::orderBy('name')->get());
    });
}
```

Closure chỉ chạy khi view đó thật sự được render, nên không tốn query ở các trang không dùng.

---

## 9. Phân trang trong view

Controller:

```php
$posts = Post::with('author')->latest()->paginate(10);
```

View:

```blade
@foreach ($posts as $post)
    <x-post-card :post="$post" />
@endforeach

{{ $posts->links() }}
```

Chú ý dấu hai chấm trong `:post="$post"` — có dấu hai chấm là **truyền biến PHP**, không có là truyền
**chuỗi**. Viết `post="$post"` thì component nhận đúng chuỗi `"$post"`.

Giữ query string khi sang trang (rất hay quên khi có bộ lọc):

```blade
{{ $posts->withQueryString()->links() }}
```

Không có nó, bấm "trang 2" sẽ mất tham số `?category=backend`.

Tuỳ biến giao diện phân trang:

```bash
$ php artisan vendor:publish --tag=laravel-pagination
```

---

## 10. Bốn directive hay dùng còn lại

```blade
@include('partials.sidebar')                    {{-- chèn view khác, kế thừa biến --}}
@includeWhen($showAds, 'partials.ads')
@each('partials.post', $posts, 'post')

@class(['p-4', 'bg-red-100' => $hasError, 'font-bold' => $isActive])
@checked($post->is_featured)
@selected($cat->id === $post->category_id)
@disabled($post->trashed())

@json($post)                                    {{-- an toàn hơn json_encode trong <script> --}}

@once
    <script>console.log('chỉ in một lần dù component lặp nhiều lần')</script>
@endonce
```

`@include` vẫn dùng được, nhưng component (`<x-...>`) tốt hơn ở chỗ nó **không** tự động thấy biến của
view cha — nghĩa là bạn buộc phải khai rõ đầu vào, và view dễ đọc hơn nhiều khi dự án lớn lên.

---

## Bài tập

1. Tạo layout `components/layouts/app.blade.php` nhận `title` qua thuộc tính. Dùng nó cho hai trang
   khác nhau, mỗi trang một tiêu đề.

2. Tạo component ẩn danh `<x-badge>` với `@props(['color' => 'gray'])`. Gọi nó với
   `<x-badge color="red" class="ml-2" data-id="7">Nháp</x-badge>`, xem HTML sinh ra và trả lời: vì sao
   `color` không xuất hiện trong HTML còn `data-id` thì có?

3. Viết `@forelse` với `@empty (chưa có bài viết)` (có ngoặc). Ghi lại nguyên văn lỗi biên dịch, rồi
   sửa cho đúng.

4. Tạo form sửa bài viết dùng `@method('PUT')`. Xoá dòng `@method('PUT')` và gửi lại form — ghi lại
   mã trạng thái và thông báo. Rồi xoá `@csrf` và làm lại.

5. Tạo `<x-card>` có slot `header` và `footer`. Gọi nó mà **không** truyền `footer` — đảm bảo không nổ
   lỗi (gợi ý: `{{ $footer ?? '' }}`).

6. Chạy `php artisan view:clear`, sửa một file Blade, tải lại trang, rồi `ls storage/framework/views`
   để thấy file biên dịch mới xuất hiện.

<details>
<summary>Gợi ý đáp án</summary>

**2.** `@props` khai thuộc tính nào thì thuộc tính đó trở thành **biến** trong component và bị lấy ra
khỏi `$attributes`. Những thuộc tính không khai vẫn nằm trong `$attributes` và được `{{ $attributes }}`
in thẳng ra thẻ HTML. Đây là cơ chế cho phép bạn truyền `id`, `data-*`, `wire:model`… vào component mà
không phải khai trước từng cái.

**3.**
```
Illuminate\View\ViewException
syntax error, unexpected identifier "có" (View: .../resources/views/demo-blade.blade.php)
```
Blade hiểu `@empty (...)` là directive `@empty($var)` chứ không phải nhánh của `@forelse`. Sửa bằng
cách để `@empty` đứng một mình trên dòng riêng.

**4.** Thiếu `@method('PUT')` → form gửi `POST` tới URL chỉ nhận `PUT|PATCH`:
```
405 | The POST method is not supported for route posts/1. Supported methods: PUT, PATCH.
```
Thiếu `@csrf` → `419 | Page Expired`.

</details>

---

Tiếp theo: [03-database-va-eloquent.md](./03-database-va-eloquent.md) — phần dài nhất và quan trọng nhất.
