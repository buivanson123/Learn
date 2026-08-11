# Bài test code thường gặp

Sáu dạng bài hay ra khi phỏng vấn Laravel mức middle, kèm lời giải và **những lỗi khiến bạn bị trừ điểm**.

Cách luyện đúng: **bấm giờ, tự làm trước**, xong mới đọc lời giải. Đọc lời giải trước thì bạn chỉ học
được cách đọc, không học được cách nghĩ.

| Bài | Dạng | Thời gian | Hay gặp ở |
|-----|------|-----------|-----------|
| [1](#bài-1--crud-api-cơ-bản) | CRUD API | 45 phút | Take-home |
| [2](#bài-2--tối-ưu-một-trang-chậm) | Tối ưu query | 30 phút | Live-coding |
| [3](#bài-3--thiết-kế-schema) | Thiết kế database | 30 phút | Phỏng vấn nói |
| [4](#bài-4--tìm-lỗi-trong-đoạn-code) | Code review | 20 phút | Live-coding |
| [5](#bài-5--xử-lý-file-lớn) | Dữ liệu lớn | 30 phút | Take-home |
| [6](#bài-6--import-có-transaction-và-queue) | Tổng hợp | 90 phút | Take-home |

---

## Bài 1 — CRUD API cơ bản

> **Đề:** Viết API quản lý bài viết: liệt kê (có phân trang, lọc theo trạng thái), xem chi tiết, tạo,
> sửa, xoá. Chỉ tác giả sửa/xoá được bài của mình. Có validate và test.

### Người ta chấm gì

Không phải "chạy được không" — mà là **bạn có biết cấu trúc chuẩn của Laravel không**.

### Lời giải

**Route** — dùng `apiResource`, không khai tay 5 route:

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('posts', PostController::class);
});
Route::get('posts', [PostController::class, 'index'])->withoutMiddleware('auth:sanctum');
```

**FormRequest** — tách validate ra khỏi controller:

```php
class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;                          // route đã có middleware auth
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['slug' => $this->slug ?: Str::slug($this->title ?? '')]);
    }

    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:200'],
            'slug'        => ['required', 'string', 'max:200', Rule::unique('posts', 'slug')],
            'body'        => ['required', 'string', 'min:20'],
            'status'      => ['required', Rule::enum(PostStatus::class)],
            'category_id' => ['nullable', Rule::exists('categories', 'id')],
        ];
    }
}
```

`UpdatePostRequest` giống hệt nhưng `Rule::unique('posts')->ignore($this->route('post'))`.

**Policy**:

```php
class PostPolicy
{
    public function update(User $user, Post $post): bool { return $user->id === $post->user_id; }
    public function delete(User $user, Post $post): bool { return $user->id === $post->user_id; }
}
```

**Resource** — không trả model thẳng:

```php
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'           => $this->id,
            'title'        => $this->title,
            'slug'         => $this->slug,
            'status'       => $this->status,
            'published_at' => $this->published_at?->toIso8601String(),
            'comments'     => $this->comments_count,
            'author'       => $this->whenLoaded('author', fn () => [
                'id' => $this->author->id, 'name' => $this->author->name,
            ]),
        ];
    }
}
```

**Controller** — mỏng:

```php
class PostController extends Controller
{
    public function index(Request $request)
    {
        $posts = Post::query()
            ->with('author:id,name')
            ->withCount('comments')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('published_at')
            ->paginate(15)
            ->withQueryString();

        return PostResource::collection($posts);
    }

    public function show(Post $post)
    {
        return new PostResource($post->load('author:id,name')->loadCount('comments'));
    }

    public function store(StorePostRequest $request)
    {
        $post = $request->user()->posts()->create($request->validated());

        return (new PostResource($post))->response()->setStatusCode(201);
    }

    public function update(UpdatePostRequest $request, Post $post)
    {
        $this->authorize('update', $post);
        $post->update($request->validated());

        return new PostResource($post);
    }

    public function destroy(Request $request, Post $post)
    {
        $this->authorize('delete', $post);
        $post->delete();

        return response()->noContent();
    }
}
```

**Test** — viết ít nhất 4 cái:

```php
class PostApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_liet_ke_co_phan_trang(): void
    {
        Post::factory()->count(20)->for(User::factory(), 'author')->create();

        $this->getJson('/api/posts')
            ->assertOk()
            ->assertJsonCount(15, 'data')
            ->assertJsonStructure(['data' => [['id', 'title', 'slug']], 'links', 'meta']);
    }

    public function test_tao_bai_tra_ve_201(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/posts', [
            'title'  => 'Bai moi',
            'body'   => str_repeat('noi dung ', 10),
            'status' => 'draft',
        ])->assertCreated();

        $this->assertDatabaseHas('posts', ['slug' => 'bai-moi', 'user_id' => $user->id]);
    }

    public function test_du_lieu_sai_tra_422(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/posts', ['title' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'body', 'status']);
    }

    public function test_khong_sua_duoc_bai_nguoi_khac(): void
    {
        $post = Post::factory()->for(User::factory(), 'author')->create();

        $this->actingAs(User::factory()->create())
            ->putJson("/api/posts/{$post->id}", ['title' => 'Cuop bai'])
            ->assertForbidden();
    }
}
```

### Bảy lỗi bị trừ điểm

| Lỗi | Vì sao bị trừ |
|-----|---------------|
| Validate bằng `if` trong controller | Không biết FormRequest |
| Trả model thẳng thay vì Resource | Lộ mọi cột |
| `Post::all()` thay vì `paginate()` | Không nghĩ tới dữ liệu lớn |
| Quên `with('author')` | N+1 |
| Chỉ kiểm tra quyền ở view | Lỗ hổng phân quyền |
| `store` trả 200 thay vì **201** | Không nắm REST |
| Không viết test nào | Trừ nặng nhất ở take-home |

---

## Bài 2 — Tối ưu một trang chậm

> **Đề:** Trang danh sách đơn hàng tải mất 8 giây với 500 đơn. Đây là code. Hãy tìm và sửa.

```php
public function index()
{
    $orders = Order::all();

    return view('orders.index', ['orders' => $orders]);
}
```

```blade
@foreach ($orders as $order)
    <tr>
        <td>{{ $order->customer->name }}</td>
        <td>{{ $order->items->count() }} món</td>
        <td>{{ $order->items->sum('price') }}đ</td>
        <td>{{ $order->status === 'paid' ? 'Đã thanh toán' : 'Chờ' }}</td>
    </tr>
@endforeach
```

### Cách trả lời đúng — nói ra quy trình, đừng sửa ngay

Người phỏng vấn muốn nghe **cách bạn tìm**, không chỉ kết quả.

> "Trước khi sửa em sẽ đo đã. Em thêm `DB::listen` để đếm số query của trang này."

```php
DB::listen(fn ($q) => Log::debug($q->sql, ['ms' => $q->time]));
```

> "Nhìn code thì em đoán có 3 vấn đề, nhưng em sẽ xác nhận bằng số liệu."

**Vấn đề 1 — N+1, ba lần.**

`$order->customer` → 500 query. `$order->items->count()` → 500 query. `$order->items->sum()` dùng lại
quan hệ đã nạp nên không thêm query, nhưng nó **nạp toàn bộ item chỉ để cộng**.

Tổng: 1 + 500 + 500 = **1001 query**.

**Vấn đề 2 — `Order::all()` không phân trang.** 500 đơn hôm nay, 50.000 đơn sang năm.

**Vấn đề 3 — `count()` và `sum()` làm trong PHP** thay vì để database làm.

### Lời giải

```php
public function index()
{
    $orders = Order::query()
        ->with('customer:id,name')
        ->withCount('items')
        ->withSum('items', 'price')
        ->latest()
        ->paginate(20);

    return view('orders.index', ['orders' => $orders]);
}
```

```blade
@foreach ($orders as $order)
    <tr>
        <td>{{ $order->customer->name }}</td>
        <td>{{ $order->items_count }} món</td>
        <td>{{ number_format($order->items_sum_price) }}đ</td>
        <td>{{ $order->status === 'paid' ? 'Đã thanh toán' : 'Chờ' }}</td>
    </tr>
@endforeach
{{ $orders->links() }}
```

**1001 query → 3 query**, và con số đó không đổi dù có 50.000 đơn.

### Nói thêm để ghi điểm

> "Em sẽ thêm hai thứ để lỗi này không tái diễn:
>
> 1. `Model::preventLazyLoading()` ở môi trường dev — N+1 thành exception luôn.
> 2. Một test đếm số query:
>
> ```php
> public function test_trang_don_hang_luon_3_query(): void
> {
>     Order::factory()->count(30)->create();
>     $this->assertQueryCount(3, fn () => $this->get('/orders')->assertOk());
> }
> ```
>
> Và em sẽ kiểm tra index — nếu `orders` lọc theo `status` thường xuyên thì `EXPLAIN ANALYZE` sẽ cho
> thấy có `Seq Scan` hay không."

### Bẫy trong bài này

Nếu bạn viết test N+1 mà chỉ seed **1** đơn hàng, nó sẽ **xanh** dù code vẫn N+1 — vì
`Builder::hydrate()` chỉ bật cờ `preventsLazyLoading` khi `count($items) > 1`. Nói ra chi tiết này là
điểm cộng lớn.

---

## Bài 3 — Thiết kế schema

> **Đề:** Thiết kế database cho hệ thống đặt món: nhà hàng có nhiều món, khách đặt đơn gồm nhiều món,
> mỗi món trong đơn có số lượng và giá tại thời điểm đặt. Đơn có nhiều trạng thái theo thời gian.

### Lời giải

```php
Schema::create('restaurants', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('slug')->unique();
    $table->timestamps();
});

Schema::create('dishes', function (Blueprint $table) {
    $table->id();
    $table->foreignId('restaurant_id')->constrained()->cascadeOnDelete()->index();
    $table->string('name');
    $table->decimal('price', 12, 2);             // KHÔNG dùng float
    $table->boolean('is_available')->default(true);
    $table->timestamps();

    $table->index(['restaurant_id', 'is_available']);
});

Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->restrictOnDelete()->index();
    $table->foreignId('restaurant_id')->constrained()->restrictOnDelete()->index();
    $table->string('code')->unique();             // mã đơn hiện cho khách
    $table->string('status')->default('pending')->index();
    $table->decimal('total', 12, 2);              // chốt lại, không tính lại mỗi lần đọc
    $table->timestamps();

    $table->index(['user_id', 'created_at']);
});

Schema::create('order_items', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->cascadeOnDelete();
    $table->foreignId('dish_id')->constrained()->restrictOnDelete();
    $table->unsignedInteger('quantity');
    $table->decimal('unit_price', 12, 2);         // ⭐ giá TẠI THỜI ĐIỂM ĐẶT
    $table->string('dish_name');                  // ⭐ tên tại thời điểm đặt
    $table->timestamps();

    $table->index(['order_id']);
});

Schema::create('order_status_logs', function (Blueprint $table) {
    $table->id();
    $table->foreignId('order_id')->constrained()->cascadeOnDelete();
    $table->string('from_status')->nullable();
    $table->string('to_status');
    $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamp('created_at');

    $table->index(['order_id', 'created_at']);
});
```

### Năm điểm để giải thích — đây mới là phần được chấm

**1. `unit_price` và `dish_name` được sao chép vào `order_items`.**

> "Đây là phi chuẩn hoá có chủ đích. Nhà hàng đổi giá món hôm nay thì đơn hàng tháng trước **không
> được** đổi theo. Nếu chỉ giữ `dish_id` và join sang `dishes` để lấy giá thì hoá đơn cũ sẽ sai. Tương
> tự với tên món khi món bị đổi tên hoặc xoá."

Đây là câu hỏi họ thật sự muốn nghe. Trả lời được là qua bài.

**2. `decimal` chứ không `float`.**

> "`float` là số dấu phẩy động nhị phân, `0.1 + 0.2` không bằng `0.3`. Tiền phải dùng `decimal`. Một
> cách khác là lưu số nguyên đơn vị nhỏ nhất — với VNĐ thì không cần vì không có xu."

**3. `restrictOnDelete` cho `dish_id`, `cascadeOnDelete` cho `order_id`.**

> "Xoá đơn thì xoá luôn dòng chi tiết của nó — `cascade`. Nhưng **không** cho xoá món ăn đang nằm trong
> đơn nào đó — `restrict`, vì như vậy sẽ mất dữ liệu lịch sử. Nhà hàng muốn ẩn món thì dùng
> `is_available = false` hoặc soft delete."

**4. `total` lưu sẵn thay vì tính lại.**

> "Trang danh sách đơn phải hiện tổng tiền. Tính lại bằng `SUM` mỗi lần đọc là join thêm bảng. Em chốt
> `total` lúc tạo đơn — nó cũng là con số đã thoả thuận với khách, không nên đổi. Đánh đổi là phải đảm
> bảo nó luôn khớp, nên em tính nó **trong cùng transaction** với việc tạo `order_items`."

**5. Bảng log trạng thái riêng.**

> "Nếu chỉ có cột `status` thì mất lịch sử. Bảng `order_status_logs` cho biết đơn chuyển trạng thái lúc
> nào và do ai — cần cho khiếu nại và cho báo cáo thời gian xử lý."

### Câu hỏi đào sâu hay gặp

> **"Làm sao đảm bảo `total` khớp với tổng các dòng?"**

```php
DB::transaction(function () use ($data) {
    $order = Order::create([...'total' => 0]);

    $total = collect($data['items'])->sum(fn ($i) => $i['quantity'] * $i['unit_price']);

    $order->items()->createMany($data['items']);
    $order->update(['total' => $total]);

    return $order;
});
```

> **"Hai người cùng đặt món cuối cùng thì sao?"** → Xem [bài 03 câu 4](./03-cau-hoi-tinh-huong.md).

---

## Bài 4 — Tìm lỗi trong đoạn code

> **Đề:** Đoạn code này có bao nhiêu vấn đề? Chỉ ra và sửa.

```php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->all());

        foreach ($request->items as $item) {
            $order->items()->create($item);
        }

        Mail::to($request->email)->send(new OrderConfirmation($order));

        $orders = Order::all();
        $total = 0;
        foreach ($orders as $o) {
            $total += $o->items->sum('price');
        }

        Cache::forever('orders.total', $total);

        return response()->json($order);
    }
}
```

### Lời giải — 8 vấn đề

**1. `Order::create($request->all())` — mass assignment.**
Người dùng gửi kèm `status=paid` hoặc `total=0` là xong. Phải validate bằng FormRequest và dùng
`$request->validated()`.

**2. Không có transaction.**
Tạo `order` xong mà tạo `items` lỗi giữa chừng → đơn hàng rỗng nằm lại trong database. Phải bọc
`DB::transaction()`.

**3. Gửi mail đồng bộ.**
Mất 800ms trong request. Phải cho `OrderConfirmation implements ShouldQueue`, và dispatch
`->afterCommit()` nếu trong transaction.

**4. `Order::all()` + vòng lặp — N+1 và tràn RAM.**
Với 100.000 đơn thì cả `all()` lẫn `$o->items` đều chết. Phải để database tính:

```php
$total = DB::table('order_items')->sum(DB::raw('quantity * unit_price'));
```

**5. `Cache::forever` cho dữ liệu luôn thay đổi.**
Tổng doanh thu đổi mỗi lần có đơn mới. Cache vĩnh viễn nghĩa là số này sai mãi mãi. Dùng
`Cache::remember(..., 300, ...)` hoặc xoá cache khi có đơn mới.

**6. Tính lại tổng doanh thu trong request tạo đơn.**
Việc này không liên quan gì tới việc tạo đơn. Đẩy vào job hoặc listener của event `OrderCreated`.

**7. Trả model thẳng.**
Lộ mọi cột. Dùng `OrderResource`.

**8. Trả 200 thay vì 201.**
Tạo tài nguyên mới phải là `201 Created`.

### Bản sửa

```php
class OrderController extends Controller
{
    public function store(StoreOrderRequest $request, CreateOrder $createOrder)
    {
        $order = $createOrder->handle($request->user(), OrderData::from($request->validated()));

        return (new OrderResource($order))->response()->setStatusCode(201);
    }
}
```

```php
class CreateOrder
{
    public function handle(User $user, OrderData $data): Order
    {
        $order = DB::transaction(function () use ($user, $data) {
            $order = $user->orders()->create([
                'restaurant_id' => $data->restaurantId,
                'code'          => Str::upper(Str::random(8)),
                'status'        => OrderStatus::Pending,
                'total'         => $data->total(),
            ]);

            $order->items()->createMany($data->itemsPayload());

            return $order;
        });

        OrderCreated::dispatch($order);      // listener lo mail + thống kê

        return $order;
    }
}
```

### Cách nói khi làm bài này

Đừng liệt kê một tràng. Nhóm lại theo mức nghiêm trọng:

> "Em thấy 8 vấn đề, chia làm ba nhóm. **Nghiêm trọng nhất là bảo mật** — `$request->all()` cho phép
> mass assignment. **Nhóm hai là tính đúng đắn** — không có transaction nên có thể tạo ra đơn rỗng.
> **Nhóm ba là hiệu năng** — `Order::all()` với vòng lặp sẽ chết khi dữ liệu lớn, và gửi mail đồng bộ
> làm request chậm 800ms."

---

## Bài 5 — Xử lý file lớn

> **Đề:** Import file CSV 2 triệu dòng vào bảng `products`. File có thể chứa dòng lỗi. Không được để
> hết bộ nhớ, và phải báo được tiến độ.

### Lời giải

```php
#[Signature('products:import {file} {--chunk=1000} {--dry-run}')]
#[Description('Import sản phẩm từ file CSV')]
class ImportProducts extends Command
{
    public function handle(): int
    {
        $path = $this->argument('file');

        if (! file_exists($path)) {
            $this->error("Không tìm thấy file: {$path}");
            return self::FAILURE;
        }

        $chunkSize = (int) $this->option('chunk');
        $imported = 0;
        $skipped  = 0;
        $errors   = [];

        // LazyCollection::make + generator: giữ 1 dòng trong RAM tại một thời điểm
        LazyCollection::make(function () use ($path) {
            $handle = fopen($path, 'r');
            $header = fgetcsv($handle);

            while (($row = fgetcsv($handle)) !== false) {
                yield array_combine($header, $row);
            }

            fclose($handle);
        })
        ->chunk($chunkSize)
        ->each(function (LazyCollection $chunk) use (&$imported, &$skipped, &$errors) {
            $valid = [];

            foreach ($chunk as $i => $row) {
                $v = Validator::make($row, [
                    'sku'   => ['required', 'string', 'max:50'],
                    'name'  => ['required', 'string', 'max:255'],
                    'price' => ['required', 'numeric', 'min:0'],
                ]);

                if ($v->fails()) {
                    $skipped++;
                    if (count($errors) < 20) {
                        $errors[] = "Dòng {$i}: " . $v->errors()->first();
                    }
                    continue;
                }

                $valid[] = $v->validated() + ['created_at' => now(), 'updated_at' => now()];
            }

            if ($valid !== [] && ! $this->option('dry-run')) {
                Product::upsert($valid, ['sku'], ['name', 'price', 'updated_at']);
            }

            $imported += count($valid);
            $this->output->write("\rĐã xử lý: {$imported} dòng, bỏ qua: {$skipped}");
        });

        $this->newLine();

        if ($errors !== []) {
            $this->warn('Một số dòng bị bỏ qua:');
            foreach ($errors as $e) { $this->line("  {$e}"); }
        }

        $this->info($this->option('dry-run')
            ? "Chế độ thử — sẽ import {$imported} dòng, bỏ qua {$skipped}."
            : "Xong. Import {$imported} dòng, bỏ qua {$skipped}.");

        return self::SUCCESS;
    }
}
```

### Năm điểm để giải thích

**1. `LazyCollection` + generator, không `file()` hay `array_map`.**

> "`file($path)` nạp cả file vào mảng — 2 triệu dòng là chết ngay. Generator `yield` từng dòng nên bộ
> nhớ không phụ thuộc kích thước file. Em đo thật ở dự án khác: `collect(range(1, 2_000_000))` chết với
> `Allowed memory size exhausted` ở 128M, còn `LazyCollection` cùng phép tính chạy trong 23 MB."

**2. `->chunk(1000)` rồi `upsert` theo lô.**

> "Insert từng dòng là 2 triệu query. Gom 1000 dòng thành một `upsert` là 2000 query. Chọn 1000 vì lô
> quá lớn thì câu SQL vượt giới hạn kích thước packet của database."

**3. `upsert` thay vì `updateOrCreate`.**

> "`updateOrCreate` chạy 2 query mỗi dòng (select rồi insert/update). `upsert` là một câu SQL cho cả lô."

**4. Dòng lỗi được bỏ qua, không làm chết cả tiến trình.**

> "Import 2 triệu dòng mà chết ở dòng 1.999.999 vì một ô trống là không chấp nhận được. Em validate
> từng dòng, gom lỗi lại, và chỉ giữ 20 lỗi đầu để không phình bộ nhớ."

**5. Có `--dry-run`.**

> "Chạy thử trên file thật để xem có bao nhiêu dòng lỗi trước khi ghi. Mọi command sửa dữ liệu em đều
> làm cờ này."

### Câu hỏi đào sâu

> **"Nếu import mất 2 tiếng thì sao?"**

> "Em sẽ chuyển sang job và dùng `Bus::batch()` — chia file thành các job nhỏ, mỗi job xử lý một khoảng
> dòng. Như vậy theo dõi được `progress()`, job hỏng thì retry riêng nó chứ không phải chạy lại từ đầu,
> và huỷ giữa chừng được. Nhớ đặt `--timeout` đủ lớn và `retry_after` lớn hơn `timeout`."

> **"Import xong mà chạy lại lần nữa thì sao?"**

> "`upsert` theo `sku` nên chạy lại là idempotent — không tạo bản ghi trùng."

---

## Bài 6 — Import có transaction và queue

> **Đề (take-home, 90 phút):** API nhận file CSV đơn hàng, xử lý nền, báo tiến độ cho client, gửi mail
> khi xong. Có test.

Bài này ghép mọi thứ. Dưới đây là **khung** — bạn tự viết chi tiết.

### Luồng

```
POST /api/imports        → lưu file, tạo bản ghi Import (status=pending), dispatch batch → 202
GET  /api/imports/{id}   → trả progress, status
                         → batch xong → gửi mail + cập nhật status
```

### Điểm được chấm

**1. Trả `202 Accepted`, không phải 200.**

```php
public function store(StoreImportRequest $request)
{
    $path = $request->file('file')->store('imports');

    $import = Import::create([
        'user_id' => $request->user()->id,
        'path'    => $path,
        'status'  => ImportStatus::Pending,
    ]);

    ProcessImport::dispatch($import)->afterCommit();

    return response()->json(['id' => $import->id, 'status' => $import->status], 202);
}
```

**2. `Bus::batch` để theo dõi tiến độ.**

```php
$batch = Bus::batch($chunks->map(fn ($rows) => new ImportChunk($import->id, $rows)))
    ->name("Import #{$import->id}")
    ->allowFailures()
    ->then(fn (Batch $b)  => $import->update(['status' => ImportStatus::Done]))
    ->catch(fn (Batch $b) => $import->update(['status' => ImportStatus::Failed]))
    ->finally(fn (Batch $b) => Mail::to($import->user)->send(new ImportFinished($import)))
    ->dispatch();

$import->update(['batch_id' => $batch->id]);
```

**3. Endpoint tiến độ.**

```php
public function show(Import $import)
{
    $this->authorize('view', $import);

    $batch = $import->batch_id ? Bus::findBatch($import->batch_id) : null;

    return [
        'status'   => $import->status,
        'progress' => $batch?->progress() ?? 0,
        'total'    => $batch?->totalJobs ?? 0,
        'failed'   => $batch?->failedJobs ?? 0,
    ];
}
```

**4. Job idempotent.**

```php
class ImportChunk implements ShouldQueue
{
    use Batchable, Queueable;

    public int $tries = 3;
    public int $timeout = 120;

    public function backoff(): array { return [10, 60, 180]; }

    public function handle(): void
    {
        if ($this->batch()?->cancelled()) {
            return;
        }

        Order::upsert($this->rows, ['code'], ['total', 'status', 'updated_at']);
    }
}
```

`upsert` theo `code` nên job chạy lại không tạo bản ghi trùng.

**5. Test.**

```php
public function test_upload_tra_202_va_day_batch(): void
{
    Bus::fake();
    Storage::fake();

    $this->actingAs(User::factory()->create())
        ->postJson('/api/imports', ['file' => UploadedFile::fake()->createWithContent('orders.csv', $csv)])
        ->assertStatus(202)
        ->assertJsonStructure(['id', 'status']);

    Bus::assertBatched(fn (PendingBatch $batch) => $batch->jobs->count() > 0);
}
```

### Ba thứ hay quên trong take-home

| Quên | Hậu quả |
|------|---------|
| `README` hướng dẫn chạy | Người chấm không chạy được → trượt |
| `.env.example` đủ biến | Như trên |
| Nói rõ đánh đổi đã chọn | Mất cơ hội thể hiện tư duy |

Viết một mục "Quyết định thiết kế" trong README, 5–7 dòng, nêu bạn chọn gì và vì sao. Đây là phần rẻ
nhất để ghi điểm mà nhiều người bỏ qua.

---

## Danh sách kiểm tra trước khi nộp take-home

- [ ] `README.md` có: cách cài, cách chạy, cách chạy test
- [ ] `.env.example` đủ biến, không commit `.env`
- [ ] `composer install && php artisan migrate --seed && php artisan test` chạy được từ đầu
- [ ] Có ít nhất 4 test và **chúng đều xanh**
- [ ] Không có `dd()`, `dump()`, `var_dump()` sót lại
- [ ] `./vendor/bin/pint --test` sạch
- [ ] Không có N+1 (kiểm tra bằng `Model::preventLazyLoading()` + một feature test)
- [ ] Endpoint tạo trả **201**, endpoint nền trả **202**, xoá trả **204**
- [ ] Có mục "Quyết định thiết kế" nêu đánh đổi
- [ ] Git history sạch, commit message có nghĩa

---

Tiếp theo: [03-cau-hoi-tinh-huong.md](./03-cau-hoi-tinh-huong.md)
