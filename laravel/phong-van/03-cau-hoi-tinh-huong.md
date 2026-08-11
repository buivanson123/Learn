# Câu hỏi tình huống hệ thống

Dạng câu hỏi không có đáp án đúng duy nhất. Người phỏng vấn đo **cách bạn nghĩ**, không đo bạn thuộc gì.

---

## Cách trả lời dạng này

Bốn bước, nói ra thành tiếng:

```
1. Hỏi lại cho rõ      "Hệ thống đang bao nhiêu request/giây? Chậm ở đâu — trang nào?"
2. Đo trước, đoán sau   "Em sẽ xem số query trước khi kết luận"
3. Đi từ rẻ tới đắt     Sửa code → thêm index → cache → thêm máy
4. Nêu đánh đổi         "Cách này nhanh hơn nhưng dữ liệu có thể cũ 5 phút"
```

**Sai lầm phổ biến nhất:** nhảy ngay vào giải pháp đắt tiền. Nghe "traffic tăng 10 lần" mà trả lời ngay
"em dùng Redis với load balancer" là bị đánh giá thấp — vì bạn chưa biết vấn đề nằm ở đâu.

---

## 1. "Trang danh sách tải mất 8 giây. Bạn làm gì?"

### Đừng trả lời ngay. Hỏi trước:

> "Chậm từ khi nào — mới đây hay luôn chậm? Chậm với mọi người hay chỉ vài tài khoản? Dữ liệu hiện tại
> bao nhiêu bản ghi?"

Câu hỏi thứ hai quan trọng: chậm chỉ với **vài tài khoản** thường nghĩa là tài khoản đó có nhiều dữ
liệu → vấn đề là thiếu index hoặc N+1, không phải hạ tầng.

### Quy trình

**Bước 1 — đo, đừng đoán.**

```php
DB::listen(fn ($q) => Log::debug($q->sql, ['ms' => $q->time]));
```

> "Em xem hai con số: **số query** của trang đó, và **query chậm nhất**. Trang danh sách bình thường
> 3–8 query; trên 30 gần như chắc chắn có N+1."

**Bước 2 — nếu nhiều query giống nhau chỉ khác tham số → N+1.**

> "Thêm `with()`, `withCount()`. Em đo ở dự án cũ: 20 bài viết từ 21 query xuống 2 query, và con số 2
> không đổi dù có 2000 bài."

**Bước 3 — nếu ít query nhưng một câu chậm → `EXPLAIN ANALYZE`.**

```bash
$ docker exec pg psql -U blog -d blog -c "EXPLAIN ANALYZE SELECT ..."
```

> "Em tìm hai thứ: `Seq Scan` trên bảng lớn, và `Rows Removed by Filter` lớn. Ở một dự án em đo được
> query lọc theo email trên 500.000 dòng: không index là **21.757ms** với `Rows Removed by Filter:
> 500000`; thêm index thành **0.061ms** — nhanh gấp 350 lần."

**Bước 4 — kiểm tra có nạp quá nhiều dữ liệu không.**

> "`->get()` thay vì `->paginate()`. Hoặc `paginate` trên bảng triệu dòng — cái `COUNT(*)` mới là phần
> chậm, đổi sang `cursorPaginate` là còn một query."

**Bước 5 — chỉ tới đây mới nghĩ tới cache.**

> "Cache đặt lên trên một query N+1 chỉ giấu vấn đề tới lần cache miss đầu tiên vào giờ cao điểm — lúc
> đó 500 request cùng đâm vào database."

### Chốt lại

> "Và em sẽ thêm một test đếm số query để lỗi này không quay lại. Có một chi tiết: test phải seed **ít
> nhất 2 bản ghi**, vì `Model::preventLazyLoading()` không báo lỗi khi collection chỉ có 1 model —
> `Builder::hydrate()` chỉ bật cờ khi `count($items) > 1`."

Nói được chi tiết cuối là điểm cộng lớn: nó chứng minh bạn đã thật sự dùng, không chỉ đọc.

---

## 2. "Traffic tăng 10 lần vào tháng sau. Chuẩn bị thế nào?"

### Hỏi lại

> "Tăng ở đâu — đọc hay ghi? Là tăng đều hay tăng đột biến theo giờ? Hiện tại đang bao nhiêu req/s và
> nút thắt nằm ở đâu?"

### Trả lời theo thứ tự chi phí

**Tầng 0 — đo baseline (miễn phí).**

> "Em chạy k6 với kịch bản tăng dần để biết hiện tại chịu được bao nhiêu và **hỏng ở đâu trước** —
> CPU app, kết nối database, hay I/O. Không đo thì mọi việc sau là đoán."

**Tầng 1 — cấu hình (vài phút, hiệu quả ngay).**

> "Ba thứ hay bị bỏ quên trên production:
> - `php artisan optimize` — cache config, route, view, event.
> - OPcache bật với `validate_timestamps=0`.
> - `APP_DEBUG=false`.
>
> Em đo ở một dự án: bật đủ ba cái này cải thiện p(95) khoảng 2–3 lần mà không đổi một dòng code."

**Tầng 2 — sửa code (rẻ nhất trên mỗi đơn vị hiệu quả).**

> "Tìm N+1 và index thiếu như câu 1. Đẩy mọi việc chậm ra queue — gửi mail, gọi API ngoài, xử lý ảnh."

**Tầng 3 — cache.**

> "Đổi cache driver sang Redis. Em đo 500 lần `Cache::get`: driver `database` **328ms**, `redis` **94ms**.
> Nhưng lý do chính để chuyển là **cache tag** — driver database không hỗ trợ, mà tag là thứ cho phép
> xoá cache theo nhóm khi dữ liệu đổi.
>
> Và dùng `Cache::flexible()` để chống stampede: nó trả cache cũ ngay lập tức rồi tính lại ở nền, nên
> lúc hết hạn không có 500 request cùng đâm vào database."

**Tầng 4 — hạ tầng (đắt nhất, làm sau cùng).**

> "Thêm instance app phía sau load balancer. Nhưng trước đó phải làm ứng dụng **stateless**: session và
> cache sang Redis, file upload sang S3. Read replica cho database nếu đọc nhiều hơn ghi.
>
> Nếu vẫn cần thì Octane — bỏ được việc nạp lại framework mỗi request, nhanh 3–5 lần. Đánh đổi là phải
> rà lại toàn bộ singleton, vì singleton phụ thuộc `$request` sẽ rò rỉ dữ liệu giữa người dùng."

### Chốt

> "Em cũng sẽ đặt cảnh báo trước cho 4 chỉ số: tỷ lệ 5xx, p(95) thời gian phản hồi, độ dài hàng đợi, và
> số job hỏng. Biết trước khi người dùng phàn nàn quan trọng hơn là tối ưu thêm 10%."

---

## 3. "Job gửi mail chạy hai lần, khách nhận mail trùng. Xử lý sao?"

### Trả lời

**Bước 1 — tìm nguyên nhân trước khi vá.**

> "Có bốn nguyên nhân em sẽ kiểm tra theo thứ tự:
>
> 1. **`retry_after` nhỏ hơn `timeout`** — đây là nguyên nhân phổ biến nhất. Nếu `timeout=120` mà
>    `retry_after=90` thì ở giây thứ 90 hàng đợi tưởng job mất và giao cho worker khác, trong khi
>    worker đầu vẫn đang chạy. Job chạy ở hai nơi cùng lúc và **không có lỗi nào trong log**.
> 2. **Worker bị kill giữa chừng** — deploy, hết bộ nhớ, server restart.
> 3. **`$tries > 1` mà job ném exception sau khi đã gửi mail** — retry gửi lại.
> 4. **Dispatch hai lần** do event bị bắn hai lần."

**Bước 2 — sửa cấu hình.**

```php
'retry_after' => 90,        // config/queue.php
```
```bash
php artisan queue:work --timeout=60
```

**Bước 3 — nhưng đó chưa đủ.**

> "Dù cấu hình đúng, job **vẫn sẽ** chạy hai lần — deploy giữa chừng, mạng chập chờn. Nên em thiết kế
> job **idempotent** thay vì cố ngăn nó chạy lại."

Hai cách:

```php
// Cách 1 — khoá duy nhất
class SendOrderConfirmation implements ShouldQueue, ShouldBeUnique
{
    public int $uniqueFor = 3600;
    public function uniqueId(): string { return "order-{$this->order->id}"; }
}
```

```php
// Cách 2 — tự kiểm tra trạng thái, chắc chắn hơn
public function handle(): void
{
    if ($this->order->confirmation_sent_at !== null) {
        return;
    }

    Mail::to($this->order->email)->send(new OrderConfirmation($this->order));

    $this->order->update(['confirmation_sent_at' => now()]);
}
```

> "Em ưu tiên cách 2 vì nó không phụ thuộc vào cache driver, và nó vẫn đúng kể cả khi job chạy lại sau
> một tuần."

**Bước 4 — phòng ngừa.**

> "Thêm `failed()` để ghi log khi job hỏng hẳn, và `backoff()` tăng dần `[10, 60, 300]` cho job gọi API
> ngoài — thử lại ngay 3 lần chỉ làm dịch vụ đang quá tải càng quá tải."

---

## 4. ⭐ "Hai người cùng mua món hàng cuối cùng. Làm sao không bán thừa?"

Đây là câu hỏi **race condition** kinh điển. Trả lời được là điểm cộng rất lớn ở mức middle.

### Vì sao code thông thường sai

```php
$qty = DB::table('stock')->where('id', 1)->value('qty');

if ($qty > 0) {
    DB::table('stock')->where('id', 1)->update(['qty' => $qty - 1]);
    // bán hàng
}
```

Giữa lúc **đọc** và lúc **ghi** có một khoảng thời gian. Nhiều tiến trình cùng đọc `qty = 1`, cùng thấy
`> 0`, cùng bán.

### Đo thật — 5 tiến trình cùng mua 1 món cuối

```bash
$ for i in 1 2 3 4 5; do php race.php unsafe & done; wait
ban duoc
ban duoc
ban duoc
ban duoc
ban duoc          ← bán 5 món trong khi chỉ có 1

$ psql -tAc "SELECT qty FROM stock WHERE id=1;"
0
```

**Bán thừa 4 món.** Tồn kho về 0 chứ không phải -4, vì mỗi tiến trình đều đọc `qty=1` rồi ghi `0`.

### Cách 1 — khoá bi quan (`lockForUpdate`)

```php
DB::transaction(function () {
    $row = DB::table('stock')->where('id', 1)->lockForUpdate()->first();

    if ($row->qty > 0) {
        DB::table('stock')->where('id', 1)->update(['qty' => $row->qty - 1]);
        // bán hàng
    }
});
```

```bash
$ for i in 1 2 3 4 5; do php race.php safe & done; wait
ban duoc
het hang
het hang
het hang
het hang          ← đúng: 1 bán, 4 hết
```

> "`lockForUpdate` khoá dòng đó cho tới hết transaction. Tiến trình khác đọc cùng dòng phải **chờ**.
> Bắt buộc phải nằm trong `DB::transaction()` — ngoài transaction thì khoá nhả ngay và vô nghĩa."

**Đánh đổi:** các request bị xếp hàng. Với món hot, đây là nút thắt.

### Cách 2 — atomic bằng một câu SQL có điều kiện (tốt hơn)

```php
$affected = DB::table('stock')
    ->where('id', 1)
    ->where('qty', '>', 0)          // ⭐ điều kiện nằm TRONG câu UPDATE
    ->decrement('qty');

if ($affected > 0) {
    // bán hàng
} else {
    // hết hàng
}
```

```bash
$ for i in 1 2 3 4 5; do php race.php atomic & done; wait
ban duoc
het hang
het hang
het hang
het hang          ← cũng đúng, mà không cần khoá
```

> "Cách này không có khoảng cách giữa đọc và ghi — database tự đảm bảo tính nguyên tử của một câu
> `UPDATE`. `$affected` là số dòng thật sự bị sửa: bằng 0 nghĩa là điều kiện `qty > 0` không thoả, tức
> là hết hàng.
>
> Em ưu tiên cách này vì không xếp hàng, nhanh hơn nhiều. Chỉ dùng `lockForUpdate` khi phải đọc nhiều
> bảng rồi mới quyết định — lúc đó không gói được vào một câu UPDATE."

### Cách 3 — khoá lạc quan (optimistic locking)

```php
$table->unsignedInteger('version')->default(0);
```

```php
$affected = DB::table('stock')
    ->where('id', 1)
    ->where('version', $row->version)          // chỉ ghi nếu chưa ai đổi
    ->update(['qty' => $row->qty - 1, 'version' => $row->version + 1]);

if ($affected === 0) {
    throw new ConcurrentModification;          // ai đó đã sửa, thử lại
}
```

> "Hợp khi xung đột **hiếm** — ví dụ hai admin cùng sửa một bài viết. Không hợp cho flash sale vì tỷ lệ
> xung đột cao, sẽ retry liên tục."

### Bảng chọn

| Tình huống | Cách |
|-----------|------|
| Trừ kho, trừ số dư | **Atomic** (`where(...)->decrement()`) |
| Cần đọc nhiều bảng rồi mới quyết định | `lockForUpdate` trong transaction |
| Hai người cùng sửa một bản ghi, xung đột hiếm | Optimistic (`version`) |
| Chỉ được chạy một lần trên nhiều server | `Cache::lock()` |

### Câu đào sâu hay gặp

> **"Deadlock thì sao?"**

> "Deadlock xảy ra khi hai transaction khoá hai dòng theo thứ tự ngược nhau. Hai cách giảm: luôn khoá
> theo **cùng một thứ tự** (ví dụ sắp theo id tăng dần), và giữ transaction **ngắn nhất có thể** —
> không gọi API ngoài trong transaction. Laravel có sẵn retry:
>
> ```php
> DB::transaction(fn () => ..., attempts: 3);
> ```
> "

---

## 5. "Database sắp đầy, bảng logs có 500 triệu dòng. Xử lý?"

### Hỏi lại

> "Dữ liệu này còn cần không, cần bao lâu? Có yêu cầu pháp lý phải giữ không? Truy vấn vào nó theo
> tiêu chí gì?"

### Trả lời

**Ngắn hạn — xoá theo lô, không xoá một phát.**

```php
// ❌ khoá bảng rất lâu, có thể làm sập ứng dụng
Log::where('created_at', '<', now()->subMonths(6))->delete();

// ✅ xoá từng lô nhỏ
do {
    $deleted = Log::where('created_at', '<', now()->subMonths(6))->limit(5000)->delete();
    usleep(100000);
} while ($deleted > 0);
```

> "Xoá 400 triệu dòng bằng một câu `DELETE` sẽ giữ khoá và làm phình transaction log. Chia lô 5000 và
> nghỉ giữa các lô để database còn phục vụ request thật."

**Trung hạn — phân vùng theo thời gian.**

> "Với PostgreSQL, `PARTITION BY RANGE (created_at)` theo tháng. Xoá dữ liệu cũ trở thành `DROP
> PARTITION` — tức thời, không khoá gì. Truy vấn theo khoảng thời gian cũng chỉ quét đúng partition cần."

**Dài hạn — đừng để log ứng dụng trong database chính.**

> "Log nên đi ra stdout rồi vào hệ thống log riêng. Bảng `logs` trong database chính là thứ vừa làm
> phình database vừa làm chậm backup. Em sẽ tách nó ra và giữ database chính cho dữ liệu nghiệp vụ."

**Đừng quên đo trước.**

```bash
$ php artisan db:show
 Total Size .. 440.00 KB
 public / logs .. ...
```

> "`db:show` cho biết bảng nào chiếm nhiều nhất. Nhiều khi thủ phạm không phải bảng bạn nghĩ — có thể
> là bảng `sessions`, `jobs`, `failed_jobs` hoặc `telescope_entries` không ai dọn."

---

## 6. "API bên thứ ba hay timeout, làm ứng dụng chậm theo. Xử lý?"

### Trả lời

**Nguyên tắc: không bao giờ gọi API ngoài trong request đồng bộ nếu người dùng không cần kết quả ngay.**

**1. Đẩy vào queue.**

```php
SyncToPartner::dispatch($order)->afterCommit();
```

**2. Đặt timeout — mặc định là không có timeout.**

```php
Http::timeout(5)->connectTimeout(2)->get($url);
```

> "Không đặt timeout thì một API treo sẽ giữ tiến trình PHP-FPM cho tới khi hết `max_execution_time`.
> Vài chục request như vậy là cạn pool và **toàn bộ site chết**, dù lỗi nằm ở bên thứ ba."

**3. Retry có backoff.**

```php
Http::retry(3, 100, throw: false)->timeout(5)->get($url);
```

**4. Circuit breaker cho job.**

```php
public function middleware(): array
{
    return [(new ThrottlesExceptions(10, 5 * 60))->backoff(5)];
}

public function retryUntil(): DateTime
{
    return now()->addMinutes(30);
}
```

> "10 lần hỏng trong 5 phút thì tạm ngừng đẩy job loại này. Nếu không, khi đối tác chết bạn sẽ có 10.000
> job cùng retry và tự làm sập hàng đợi của mình."

**5. Có phương án khi API chết.**

> "Cache kết quả lần gần nhất và dùng lại, hoặc có giá trị mặc định. Ví dụ API tỷ giá chết thì dùng tỷ
> giá cache 24h trước còn hơn là trang lỗi."

**6. Đo và cảnh báo.**

> "Ghi thời gian phản hồi của từng lời gọi ra ngoài. Khi p(95) tăng bất thường thì cảnh báo — biết
> trước khi nó thành sự cố."

---

## 7. "Hệ thống cần chạy trên 3 server. Có gì phải đổi?"

### Trả lời — bốn thứ phải chuyển sang dùng chung

| Thứ | Vấn đề khi nhiều server | Sửa |
|-----|------------------------|-----|
| Session | Driver `file` → người dùng bị đăng xuất khi request rơi vào server khác | `SESSION_DRIVER=redis` |
| Cache | Driver `file` → mỗi server một bản, xoá không đồng bộ | `CACHE_STORE=redis` |
| File upload | Lưu local → server khác không thấy | S3 hoặc NFS |
| Scheduler | Cả 3 server cùng chạy → task chạy 3 lần | `->onOneServer()` |

```php
Schedule::command('reports:daily')->daily()->onOneServer();
```

> "`onOneServer()` cần cache driver có khoá atomic — Redis hoặc database, không dùng được với `file`."

**Thứ năm — worker queue.**

> "Worker chạy được ở nhiều server, đó là ưu điểm. Nhưng deploy phải `queue:restart` trên **tất cả**,
> nếu không có server chạy code cũ."

**Thứ sáu — WebSocket nếu có.**

> "Reverb giữ kết nối trong bộ nhớ tiến trình. Chạy 2 instance thì người nối vào A không nhận được sự
> kiện phát từ B. Phải bật `REVERB_SCALING_ENABLED=true` để Redis làm pub/sub giữa các instance."

### Nói thêm để ghi điểm

> "Và em sẽ kiểm tra xem có chỗ nào ghi vào `storage/` rồi đọc lại ở request sau không — ví dụ file
> tạm khi xuất Excel. Đó là loại lỗi chỉ xuất hiện khi lên nhiều server và rất khó tái hiện ở local."

---

## 8. "Deploy xong thì lỗi 500 hàng loạt. Bạn làm gì?"

### Trả lời theo thứ tự — rollback trước, điều tra sau

**Bước 1 — rollback ngay, đừng debug trên production.**

```bash
$ GIT_SHA=<sha-cũ> docker compose up -d
```

> "Đây là lý do em tag image bằng git SHA chứ không dùng `latest` — rollback là đổi một biến môi trường."

**Bước 2 — xem log.**

```bash
$ docker compose logs -f app | grep -i error
```

**Bước 3 — kiểm tra danh sách nguyên nhân hay gặp:**

| Nguyên nhân | Dấu hiệu |
|-------------|----------|
| Quên `npm run build` | `ViteManifestNotFoundException` |
| Quên `migrate --force` | `column does not exist` |
| Migration xoá cột mà code cũ vẫn dùng | 500 chỉ ở vài endpoint |
| Quên `queue:restart` | Web ổn nhưng job lỗi |
| Biến `.env` mới chưa thêm trên production | `null given` ở constructor nào đó |
| `config:cache` chạy trước khi `.env` cập nhật | Cấu hình cũ |

**Bước 4 — phòng ngừa.**

> "Em sẽ thêm ba thứ:
> 1. Healthcheck sau deploy — `curl -fsS /up` và fail script nếu không 200.
> 2. Migration theo expand/contract, không xoá cột cùng lúc với đổi code.
> 3. Staging chạy đúng ảnh Docker sẽ lên production, không phải môi trường khác."

### Câu đào sâu

> **"Migration đã chạy rồi, rollback code thì database vẫn ở schema mới?"**

> "Đúng, và đó là lý do migration phải **tương thích ngược**. Thêm cột thì an toàn — code cũ không biết
> nó tồn tại. Xoá cột hoặc đổi kiểu thì không, phải tách làm nhiều lần deploy. Em không dựa vào
> `migrate:rollback` trên production vì `down()` hiếm khi được test kỹ."

---

## 9. "Người dùng báo dữ liệu sai nhưng không tái hiện được. Điều tra sao?"

### Trả lời

> "Vấn đề ở đây là **thiếu thông tin**, không phải thiếu kỹ năng debug. Em sẽ làm hai việc."

**Ngay lập tức — hỏi đúng câu:**

> "Xin họ thời điểm chính xác, tài khoản nào, thao tác gì. Nếu ứng dụng có trả header `X-Request-Id`
> thì xin luôn — tìm được đúng request đó trong log."

**Về lâu dài — làm cho lần sau điều tra được:**

```php
// Middleware gắn request_id vào MỌI dòng log của request đó
$requestId = $request->header('X-Request-Id') ?: (string) Str::uuid();

Log::withContext([
    'request_id' => $requestId,
    'user_id'    => $request->user()?->id,
]);

return $next($request)->header('X-Request-Id', $requestId);
```

> "Cộng với log dạng JSON thay vì câu văn, để `grep` và lọc được. Khi có `request_id`, một dòng lệnh là
> ra toàn bộ hành trình của request đó."

**Nếu là dữ liệu bị sai giá trị:**

> "Em nghi ba thứ theo thứ tự: **cache cũ** (dữ liệu đổi nhưng cache chưa xoá — đặc biệt khi có
> `Model::where()->update()` vì nó không kích hoạt observer), **race condition** (hai request cùng ghi),
> và **cột bị bỏ qua im lặng** do không có trong `#[Fillable]`.
>
> Cái thứ ba em phòng bằng `Model::preventSilentlyDiscardingAttributes()` — nó biến lỗi im lặng thành
> exception."

---

## 10. "Bạn được giao maintain một dự án Laravel cũ, không có test, code rối. Bắt đầu từ đâu?"

### Trả lời

**Đừng viết lại.** Đây là bẫy — ứng viên non kinh nghiệm hay trả lời "em sẽ refactor toàn bộ".

**Tuần 1 — hiểu và đo, không sửa gì.**

> "Em dựng được môi trường chạy, đọc `routes/web.php` và `route:list` để biết hệ thống làm gì. Chạy
> `php artisan about`, `db:show` để biết quy mô. Bật Telescope ở local để xem một request thật đi qua đâu."

**Tuần 2 — dựng lưới an toàn trước khi động vào code.**

> "Viết **feature test** cho những luồng quan trọng nhất — đăng nhập, thanh toán, tạo đơn. Không cần
> đẹp, cần đúng. Có test rồi thì sửa gì cũng biết mình có làm hỏng không.
>
> Em ưu tiên feature test vì nó đi qua toàn bộ tầng mà không cần hiểu chi tiết bên trong."

**Tuần 3 — thêm công cụ, đặt ngưỡng ở mức hiện tại.**

```bash
$ ./vendor/bin/phpstan analyse --generate-baseline --memory-limit=1G
```

> "Baseline ghi nhận lỗi hiện có, CI chỉ chặn lỗi **mới**. Như vậy không phải sửa 2000 lỗi trước khi
> bắt đầu, mà nợ kỹ thuật cũng không tăng thêm. Tương tự với Pint."

**Từ đó — cải thiện theo cơ hội, không theo đợt.**

> "Mỗi khi sửa bug hoặc thêm tính năng ở một file, em dọn file đó. Không có sprint 'refactor' riêng —
> nó luôn bị cắt khi có việc gấp, và nó tạo ra PR khổng lồ không ai review nổi."

**Ưu tiên gì trước:**

| Ưu tiên | Việc |
|---------|------|
| 1 | Bảo mật — `APP_DEBUG`, mass assignment, `@can` không có `authorize()` |
| 2 | Sao lưu database và **thử khôi phục một lần** |
| 3 | Test cho luồng quan trọng |
| 4 | Bật `Model::shouldBeStrict()` ở dev, sửa dần lỗi nó phát hiện |
| 5 | Còn lại |

> "Gạch số 2 là thứ hay bị bỏ qua nhất. Bản sao lưu chưa từng được khôi phục thử thì không phải bản sao lưu."

---

## Ba câu hỏi mở hay gặp cuối buổi

### "Bạn thích gì và không thích gì ở Laravel?"

Đừng khen suông. Nêu cả hai chiều cho thấy bạn dùng thật:

> "Em thích Eloquent vì nó tiết kiệm rất nhiều code, và thích hệ sinh thái — queue, cache, broadcasting
> có sẵn và ghép với nhau tốt.
>
> Điểm em thấy khó là chính Eloquent tiện quá nên dễ viết ra N+1 mà không biết. Em xử lý bằng
> `Model::shouldBeStrict()` bật từ đầu dự án. Một điểm nữa là facade tiện nhưng làm phụ thuộc bị ẩn —
> nên trong class nghiệp vụ em dùng constructor injection."

### "Bạn cập nhật kiến thức bằng cách nào?"

Cụ thể, đừng nói "em đọc tài liệu":

> "Em đọc release note mỗi bản Laravel mới và tự dựng project để thử. Ví dụ bản 13 đổi `protected
> $fillable` sang attribute `#[Fillable]`, bỏ `app/Http/Kernel.php`, và `make:command` giờ dùng
> `#[Signature]` — những thứ này code trên mạng chưa cập nhật nên phải tự kiểm chứng."

### "Bạn có câu hỏi gì cho chúng tôi không?"

**Luôn có.** Xem danh sách ở [README](./README.md#bạn-cũng-nên-hỏi-lại).

---

Tiếp theo: [04-tu-kiem-tra.md](./04-tu-kiem-tra.md)
