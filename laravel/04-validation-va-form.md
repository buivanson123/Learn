# Bài 04 — Validation và Form

Mục tiêu: không bao giờ để dữ liệu chưa kiểm tra đi vào database, và hiển thị lỗi cho người dùng một
cách tử tế.

Nguyên tắc duy nhất cần nhớ: **mọi dữ liệu từ bên ngoài đều là dữ liệu bẩn** cho tới khi đi qua
validate. `$request->input()` chưa validate thì không được đưa vào `create()`.

---

## 1. Ba cách validate

### Cách 1 — trong controller (dùng cho form đơn giản)

```php
public function store(Request $request)
{
    $data = $request->validate([
        'title' => ['required', 'string', 'max:200'],
        'body'  => ['required', 'string', 'min:10'],
    ]);

    $post = $request->user()->posts()->create($data);

    return redirect()->route('posts.show', $post)->with('status', 'Đã đăng bài.');
}
```

`validate()` trả về **chỉ những trường đã khai rule**. Đây là điểm quan trọng: gán thẳng `$data` vào
`create()` là an toàn, vì trường lạ người dùng gửi kèm không lọt vào.

Validate hỏng thì hàm **dừng ngay tại dòng đó** — dòng `create()` không bao giờ chạy.

### Cách 2 — FormRequest (dùng cho mọi thứ còn lại)

```bash
$ php artisan make:request StorePostRequest

 INFO Request [app/Http/Requests/StorePostRequest.php] created successfully.
```

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:200'],
            'slug'        => ['required', 'string', 'max:200', Rule::unique('posts', 'slug')],
            'body'        => ['required', 'string', 'min:10'],
            'status'      => ['required', Rule::in(['draft', 'published'])],
            'category_id' => ['nullable', Rule::exists('categories', 'id')],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Tiêu đề không được để trống.',
            'body.min'       => 'Nội dung phải dài ít nhất :min ký tự.',
        ];
    }
}
```

Dùng: chỉ cần đổi kiểu tham số.

```php
public function store(StorePostRequest $request)
{
    $post = $request->user()->posts()->create($request->validated());

    return redirect()->route('posts.show', $post);
}
```

Không có dòng nào gọi validate. Laravel nhìn kiểu tham số, dựng object, chạy `authorize()` rồi
`rules()` **trước khi** vào thân hàm.

### Cách 3 — Validator thủ công (khi cần kiểm soát luồng)

```php
use Illuminate\Support\Facades\Validator;

$validator = Validator::make($request->all(), ['title' => 'required']);

if ($validator->fails()) {
    return back()->withErrors($validator)->withInput();
}

$data = $validator->validated();
```

---

## 2. Chuyện gì xảy ra khi validate hỏng

Laravel nhìn header `Accept` để quyết định.

### Request JSON → 422 + danh sách lỗi

```bash
$ curl -s -i -X POST http://127.0.0.1:8000/api/posts \
    -H 'Accept: application/json' -H 'Content-Type: application/json' \
    -d '{"title":"","body":"ngan","status":"xyz","category_id":999}'
```

```
HTTP/1.1 422 Unprocessable Content
Content-Type: application/json
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

Đọc kỹ output này, có 4 điều học được:

1. Mã là **422**, không phải 400.
2. `errors` gom theo **tên field**, mỗi field là một mảng (một field có thể hỏng nhiều rule).
3. `title` và `body` dùng câu tiếng Việt tôi khai trong `messages()`; `slug`, `status`, `category_id`
   dùng câu mặc định tiếng Anh. Muốn Việt hoá toàn bộ thì xem mục 6.
4. `:min` trong `'Nội dung phải dài ít nhất :min ký tự.'` được thay bằng `10` — mọi tham số của rule
   đều dùng được kiểu này.

### Request HTML → 302 quay lại form

Laravel `redirect()->back()` kèm hai thứ trong session: `errors` và `old input`. Đó là lý do
`@error(...)` và `old(...)` hoạt động được ở [bài 02](./02-blade-va-giao-dien.md).

### `authorize()` trả `false` → 403

Đây là bẫy của người mới: `make:request` sinh ra `authorize()` trả **`false`**.

```bash
$ curl -s -w '\n[%{http_code}]\n' -X POST http://127.0.0.1:8000/api/posts \
    -H 'Accept: application/json' -d '{"title":"ok"}'
{
    "message": "This action is unauthorized."
}
[403]
```

Triệu chứng rất dễ nhầm: rule viết đúng hết mà request nào cũng 403, và **không** có thông tin gì về
validate. Nhớ đổi thành `return true;` (hoặc viết logic phân quyền thật — xem
[bài 05](./05-auth-va-phan-quyen.md)).

---

## 3. Các rule hay dùng

```php
'title'    => ['required', 'string', 'min:3', 'max:200'],
'email'    => ['required', 'email', 'unique:users,email'],
'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
'age'      => ['nullable', 'integer', 'between:18,100'],
'price'    => ['required', 'numeric', 'min:0'],
'agree'    => ['accepted'],
'url'      => ['nullable', 'url'],
'date'     => ['required', 'date', 'after:today'],
'tags'     => ['array', 'max:5'],
'tags.*'   => ['integer', 'exists:tags,id'],
'cover'    => ['nullable', 'image', 'max:2048', 'dimensions:min_width=600'],
'meta'     => ['nullable', 'json'],
```

`confirmed` đi kèm quy ước: rule trên field `password` sẽ đi tìm field `password_confirmation`.
Đặt tên input trong form là `password_confirm` thì rule luôn hỏng mà không hiểu vì sao.

### Rule dạng object — nên dùng hơn dạng chuỗi

```php
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

'status' => ['required', Rule::in(['draft', 'published'])],
'status' => ['required', Rule::enum(PostStatus::class)],

// unique bỏ qua chính bản ghi đang sửa — cực kỳ hay quên
'slug'   => ['required', Rule::unique('posts')->ignore($this->post)],

'category_id' => ['nullable', Rule::exists('categories', 'id')],

// chỉ áp rule khi có điều kiện
'published_at' => [Rule::requiredIf(fn () => $this->status === 'published')],

'password' => ['required', Password::min(8)->letters()->numbers()->uncompromised()],
```

`Password::uncompromised()` kiểm tra mật khẩu có nằm trong danh sách rò rỉ công khai không (gọi API
haveibeenpwned bằng k-anonymity, không gửi mật khẩu đi).

### Bẫy `unique` khi sửa

Form sửa bài viết mà không đổi slug sẽ hỏng:

```
The slug has already been taken.
```

Vì bản ghi trùng chính là bản ghi đang sửa. Sửa bằng `->ignore()`:

```php
public function rules(): array
{
    return [
        'slug' => ['required', Rule::unique('posts')->ignore($this->route('post'))],
    ];
}
```

---

## 4. Chuẩn hoá dữ liệu trước khi validate

`prepareForValidation()` chạy **trước** `rules()`:

```php
use Illuminate\Support\Str;

protected function prepareForValidation(): void
{
    $this->merge([
        'slug'  => $this->slug ?: Str::slug($this->title),
        'title' => trim($this->title ?? ''),
    ]);
}
```

Nhờ vậy người dùng không cần tự gõ slug, và `'title' => 'required'` không bị qua mặt bởi chuỗi toàn
dấu cách.

Ngược lại, `passedValidation()` chạy **sau** khi validate xong:

```php
protected function passedValidation(): void
{
    $this->replace(['published_at' => $this->status === 'published' ? now() : null]);
}
```

---

## 5. Rule tuỳ biến

### Rule dùng một lần — closure

```php
'slug' => [
    'required',
    function (string $attribute, mixed $value, Closure $fail) {
        if (str_starts_with($value, 'admin-')) {
            $fail('Slug không được bắt đầu bằng "admin-".');
        }
    },
],
```

### Rule dùng nhiều nơi — class

```bash
$ php artisan make:rule VietnamesePhone

 INFO Rule [app/Rules/VietnamesePhone.php] created successfully.
```

```php
namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class VietnamesePhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! preg_match('/^0[35789][0-9]{8}$/', (string) $value)) {
            $fail('Số điện thoại :attribute không đúng định dạng Việt Nam.');
        }
    }
}
```

```php
'phone' => ['required', new VietnamesePhone],
```

### Kiểm tra liên quan nhiều field

```php
public function after(): array
{
    return [
        function ($validator) {
            if ($this->status === 'published' && blank($this->published_at)) {
                $validator->errors()->add('published_at', 'Bài đã đăng phải có ngày đăng.');
            }
        },
    ];
}
```

---

## 6. Việt hoá thông báo lỗi

### Cách nhanh — `messages()` và `attributes()`

```php
public function messages(): array
{
    return [
        'required' => 'Trường :attribute là bắt buộc.',      // áp cho MỌI field
        'title.required' => 'Tiêu đề không được để trống.',   // riêng cho 1 field
        'body.min' => 'Nội dung phải dài ít nhất :min ký tự.',
    ];
}

public function attributes(): array
{
    return [
        'title'       => 'tiêu đề',
        'body'        => 'nội dung',
        'category_id' => 'chuyên mục',
    ];
}
```

`attributes()` đổi tên field trong **mọi** câu thông báo. Không có nó, người dùng thấy
`The category id field is required.` — họ không biết "category id" là gì.

### Cách bài bản — file ngôn ngữ

```bash
$ php artisan lang:publish
 INFO Language files published successfully.
```

Nó sinh `lang/en/validation.php`. Chép sang `lang/vi/validation.php` rồi dịch:

```php
return [
    'required' => 'Trường :attribute không được để trống.',
    'max'      => [
        'string'  => 'Trường :attribute không được vượt quá :max ký tự.',
        'numeric' => 'Trường :attribute không được lớn hơn :max.',
    ],
    'unique'   => 'Giá trị :attribute đã tồn tại.',
    'exists'   => 'Giá trị :attribute được chọn không hợp lệ.',

    'attributes' => [
        'title'       => 'tiêu đề',
        'body'        => 'nội dung',
        'category_id' => 'chuyên mục',
    ],
];
```

Đổi ngôn ngữ mặc định trong `.env`:

```ini
APP_LOCALE=vi
APP_FALLBACK_LOCALE=en
```

Chú ý `max` là mảng — rule này có thông báo khác nhau tuỳ kiểu dữ liệu. Chép thiếu nhánh sẽ ra
thông báo rỗng.

---

## 7. Form hoàn chỉnh trong Blade

```blade
<x-layouts.app title="Viết bài mới">
    <form method="POST" action="{{ route('posts.store') }}" class="space-y-4">
        @csrf

        @if ($errors->any())
            <x-alert type="error" title="Có {{ $errors->count() }} lỗi cần sửa">
                <ul class="list-disc pl-5">
                    @foreach ($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </x-alert>
        @endif

        <div>
            <label for="title" class="block text-sm font-medium">Tiêu đề</label>
            <input type="text" id="title" name="title"
                   value="{{ old('title') }}"
                   @class([
                       'mt-1 w-full rounded border px-3 py-2',
                       'border-red-500' => $errors->has('title'),
                       'border-gray-300' => ! $errors->has('title'),
                   ])>
            @error('title')
                <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
            @enderror
        </div>

        <div>
            <label for="category_id" class="block text-sm font-medium">Chuyên mục</label>
            <select id="category_id" name="category_id" class="mt-1 w-full rounded border px-3 py-2">
                <option value="">— Không chọn —</option>
                @foreach ($categories as $category)
                    <option value="{{ $category->id }}" @selected(old('category_id') == $category->id)>
                        {{ $category->name }}
                    </option>
                @endforeach
            </select>
            @error('category_id') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <div>
            <label for="body" class="block text-sm font-medium">Nội dung</label>
            <textarea id="body" name="body" rows="10"
                      class="mt-1 w-full rounded border px-3 py-2">{{ old('body') }}</textarea>
            @error('body') <p class="mt-1 text-sm text-red-600">{{ $message }}</p> @enderror
        </div>

        <label class="flex items-center gap-2">
            <input type="checkbox" name="is_featured" value="1" @checked(old('is_featured'))>
            <span>Bài nổi bật</span>
        </label>

        <button type="submit" class="rounded bg-blue-600 px-4 py-2 text-white">Đăng bài</button>
    </form>
</x-layouts.app>
```

Ba chi tiết dễ sai:

- `<textarea>{{ old('body') }}</textarea>` — giá trị nằm **giữa hai thẻ**, không phải thuộc tính `value`.
- `@selected(old('category_id') == $category->id)` dùng `==` chứ không `===`, vì `old()` trả **chuỗi**
  còn `$category->id` là **số**.
- Checkbox không tick thì trình duyệt **không gửi** field đó. Rule `'is_featured' => 'boolean'` sẽ hỏng
  khi bỏ tick — dùng `'nullable|boolean'` hoặc `$request->boolean('is_featured')`.

Với form sửa, `old()` nhận giá trị mặc định là dữ liệu hiện có:

```blade
<input type="text" name="title" value="{{ old('title', $post->title) }}">
```

---

## 8. CSRF — hiểu để không tắt bừa

Mọi request `POST`/`PUT`/`PATCH`/`DELETE` qua `routes/web.php` đều bị kiểm tra token. Thiếu token:

```
419 | Page Expired
```

Ba nguyên nhân thật sự, theo thứ tự hay gặp:

1. Quên `@csrf` trong form.
2. Gửi AJAX mà không kèm token. Sửa bằng cách nhúng meta rồi đọc trong JS:
   ```blade
   <meta name="csrf-token" content="{{ csrf_token() }}">
   ```
   ```js
   headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
   ```
3. Người dùng mở form rồi để đó quá `SESSION_LIFETIME` (mặc định 120 phút).

Nếu có endpoint webhook thật sự cần bỏ CSRF (ví dụ nhận callback từ cổng thanh toán), loại trừ **đúng
đường dẫn đó** trong `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware): void {
    $middleware->validateCsrfTokens(except: [
        'webhooks/stripe',
    ]);
})
```

Đừng tắt CSRF toàn cục. Đó là lỗ hổng cho phép trang web khác gửi form thay mặt người dùng đang đăng
nhập.

---

## 9. Upload file

```php
'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],   // max tính bằng KB
```

```php
if ($request->hasFile('cover')) {
    $path = $request->file('cover')->store('covers', 'public');
    // "covers/AbC123.jpg"
    $post->update(['cover_path' => $path]);
}
```

Form phải có `enctype`:

```blade
<form method="POST" action="..." enctype="multipart/form-data">
```

Quên `enctype` thì `$request->file('cover')` luôn `null` mà không có lỗi nào.

Hiển thị:

```blade
<img src="{{ asset('storage/'.$post->cover_path) }}" alt="">
```

Cần tạo symlink một lần:

```bash
$ php artisan storage:link
 INFO The [public/storage] link has been connected to [storage/app/public].
```

Quên bước này thì ảnh 404 dù file có thật trong `storage/app/public/`.

---

## Bài tập

1. Tạo `StorePostRequest` bằng `make:request`. **Không** sửa `authorize()`, gửi thử một request và ghi
   lại mã trạng thái + thông báo. Giải thích vì sao không thấy lỗi validate nào.

2. Gửi request thiếu hết mọi field, ghi lại toàn bộ JSON 422. Chỉ ra field nào dùng thông báo tiếng
   Việt của bạn, field nào dùng mặc định.

3. Thêm `messages()` và `attributes()` để mọi thông báo đều tiếng Việt và tên field đọc được. Gửi lại
   và so sánh.

4. Viết form sửa bài viết với `Rule::unique('posts')`. Bấm lưu mà **không** đổi slug — ghi lại lỗi.
   Sửa bằng `->ignore()` rồi thử lại.

5. Viết rule `VietnamesePhone` bằng `make:rule`, áp vào một field, thử với `0123456789` và `0912345678`.

6. Tạo form có checkbox `is_featured` với rule `'is_featured' => 'boolean'`. Gửi form **không tick** ô
   đó. Ghi lại lỗi và sửa.

7. Xoá `@csrf` khỏi form, gửi lại, ghi lại mã lỗi. Rồi bỏ `enctype="multipart/form-data"` khỏi form có
   upload và quan sát `$request->file('cover')`.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `403 This action is unauthorized.` — `authorize()` chạy **trước** `rules()`, nên khi nó trả
`false` thì validate không bao giờ chạy và bạn không nhận được thông tin gì về dữ liệu.

**4.** `The slug has already been taken.` — bản ghi "trùng" chính là bản ghi đang sửa.
`Rule::unique('posts')->ignore($this->route('post'))` loại bản ghi đó ra khỏi phép kiểm tra.

**6.** Checkbox không tick thì trình duyệt không gửi field. Rule `boolean` (không có `nullable`) hiểu
là field bắt buộc và báo:
```
The is featured field must be true or false.
```
Sửa: `'is_featured' => ['nullable', 'boolean']`, rồi trong controller dùng
`$request->boolean('is_featured')` để nhận `false` thay vì `null`.

</details>

---

Tiếp theo: [05-auth-va-phan-quyen.md](./05-auth-va-phan-quyen.md).
