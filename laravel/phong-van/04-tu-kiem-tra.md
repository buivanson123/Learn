# Tự kiểm tra — bạn còn hổng chỗ nào?

Làm cái này **trước** khi ôn. Nó cho biết cần ôn gì, thay vì đọc lại từ đầu.

## Cách chấm

Với mỗi dòng, tự hỏi: **"Tôi có giải thích được điều này cho một đồng nghiệp trong 1 phút, kèm một ví
dụ cụ thể không?"**

- ✅ **Được** — giải thích trôi chảy, có ví dụ từ code mình đã viết.
- ⚠️ **Lơ mơ** — biết đại khái, không nói được ví dụ hoặc không chắc chi tiết.
- ❌ **Không** — chưa nghe hoặc không nhớ gì.

Quan trọng: **nói thành tiếng**, đừng chỉ nghĩ trong đầu. Rất nhiều thứ tưởng hiểu nhưng nói ra mới
thấy lúng túng — và phỏng vấn là nói, không phải nghĩ.

Ngưỡng để đi phỏng vấn mức middle: **không còn ❌ ở nhóm A–E**, và **ít hơn 5 ⚠️ tổng cộng**.

---

## A. Cơ chế Laravel — nhóm quyết định

Đây là nhóm phân biệt "biết dùng" và "hiểu". Còn ❌ ở đây thì chưa nên đi phỏng vấn.

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Service Container là gì, giải quyết vấn đề gì | [11 §1](../11-container-facade-provider.md) |
| ☐ | `bind` vs `singleton` vs `scoped` — và vì sao `scoped` sinh ra vì Octane | [11 §2](../11-container-facade-provider.md) |
| ☐ | Bind interface với implementation, và lợi ích cụ thể | [11 §3](../11-container-facade-provider.md) |
| ☐ | Contextual binding — tình huống nào cần | [11 §4](../11-container-facade-provider.md) |
| ☐ | Facade hoạt động ra sao (`__callStatic` → container) | [11 §5](../11-container-facade-provider.md) |
| ☐ | Chứng minh `Cache::` và `app('cache')` là cùng một instance | [11 §5](../11-container-facade-provider.md) |
| ☐ | Khi nào dùng Facade, khi nào dùng injection | [11 §5](../11-container-facade-provider.md) |
| ☐ | `register()` vs `boot()` — và **vì sao** phải tách | [11 §6](../11-container-facade-provider.md) |
| ☐ | Deferred provider — có tác dụng ở đâu, không có tác dụng ở đâu | [11 §6](../11-container-facade-provider.md) |
| ☐ | Vì sao không gọi `env()` ngoài `config/` | [00 §6](../00-chuan-bi.md) |
| ☐ | Một request đi qua những bước nào | [01 §1](../01-routing-va-controller.md) |
| ☐ | Vì sao middleware là hai chiều | [01 §1](../01-routing-va-controller.md) |

---

## B. Eloquent và Database

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | N+1 là gì, **đo** bằng cách nào, sửa thế nào | [03 §9](../03-database-va-eloquent.md) |
| ☐ | `preventLazyLoading()` không báo lỗi khi collection có 1 model — và vì sao | [03 §9](../03-database-va-eloquent.md) |
| ☐ | `with` vs `load` vs `withCount` | [nc/01 §3](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | Laravel 13 khai `fillable` bằng gì | [03 §3](../03-database-va-eloquent.md) |
| ☐ | Cột không có trong `fillable` thì chuyện gì xảy ra | [03 §3](../03-database-va-eloquent.md) |
| ☐ | `Model::shouldBeStrict()` bật những gì | [03 §9](../03-database-va-eloquent.md) |
| ☐ | Cast là gì, không cast `datetime` thì lỗi gì | [03 §4](../03-database-va-eloquent.md) |
| ☐ | Cast `hashed` — và bẫy băm hai lần | [05 §2](../05-auth-va-phan-quyen.md) |
| ☐ | Accessor vs Mutator vs Cast, accessor có vào JSON không | [12 §2](../12-collection-va-model-nang-cao.md) |
| ☐ | Khoá ngoại được đoán từ đâu (tên method hay tên class) | [03 §5](../03-database-va-eloquent.md) |
| ☐ | Quy ước tên bảng trung gian `belongsToMany` | [03 §5](../03-database-va-eloquent.md) |
| ☐ | Index — đọc `EXPLAIN ANALYZE`, `Seq Scan` nghĩa là gì | [nc/01 §4](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | Thứ tự cột trong index tổ hợp | [nc/01 §4](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | `foreignId()->constrained()` có tạo index không | [nc/01 §4](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | Duyệt bảng triệu dòng: `chunk` vs `chunkById` vs `cursor` | [nc/01 §5](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | Vì sao `chunk` chậm hơn `chunkById` nhiều lần | [nc/01 §5](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | `chunk` bỏ sót bản ghi khi nào | [nc/01 §5](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | `paginate` vs `simplePaginate` vs `cursorPaginate` | [nc/01 §6](../nang-cao/01-toi-uu-eloquent.md) |
| ☐ | `Model::where()->update()` có kích hoạt observer/event không | [03 §7](../03-database-va-eloquent.md) |
| ☐ | Migration sai thứ tự — sửa thế nào khi đã deploy | [03 §1](../03-database-va-eloquent.md) |
| ☐ | Expand/contract khi migration phá tương thích ngược | [nc/08 §6](../nang-cao/08-deploy-octane-docker.md) |
| ☐ | Race condition khi trừ kho — 3 cách xử lý | [phỏng vấn 03 §4](./03-cau-hoi-tinh-huong.md) |
| ☐ | `lockForUpdate` phải nằm trong transaction — vì sao | [phỏng vấn 03 §4](./03-cau-hoi-tinh-huong.md) |

---

## C. Routing, Validation, Auth

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | `web.php` vs `api.php` khác gì | [01 §2](../01-routing-va-controller.md) |
| ☐ | Laravel 13 không sinh sẵn `api.php` — bật bằng lệnh gì | [00 §7](../00-chuan-bi.md) |
| ☐ | Route model binding, binding theo cột khác | [01 §5](../01-routing-va-controller.md) |
| ☐ | Hai route cùng URI thì chuyện gì xảy ra | [01 §5](../01-routing-va-controller.md) |
| ☐ | Vì sao `/posts/create` phải khai trước `/posts/{post}` | [09 lỗi 14](../09-loi-thuong-gap.md) |
| ☐ | `scopeBindings()` chống lỗ hổng gì | [01 §5](../01-routing-va-controller.md) |
| ☐ | Vì sao `$this->middleware()` trong constructor không chạy nữa | [01 §6](../01-routing-va-controller.md) |
| ☐ | 401 vs 403 vs 419 vs 405 | [01 §10](../01-routing-va-controller.md) |
| ☐ | FormRequest chạy trước hay sau controller, `validated()` trả về gì | [04 §1](../04-validation-va-form.md) |
| ☐ | `make:request` sinh `authorize()` trả gì — triệu chứng khi quên sửa | [04 §2](../04-validation-va-form.md) |
| ☐ | Bẫy `unique` khi sửa bản ghi | [04 §3](../04-validation-va-form.md) |
| ☐ | Validate hỏng trả gì với JSON, với HTML | [04 §2](../04-validation-va-form.md) |
| ☐ | CSRF là gì, 3 nguyên nhân gây 419 | [04 §8](../04-validation-va-form.md) |
| ☐ | Session auth vs token auth (Sanctum) | [05 §1](../05-auth-va-phan-quyen.md) |
| ☐ | Vì sao phải `session()->regenerate()` sau đăng nhập | [05 §2](../05-auth-va-phan-quyen.md) |
| ☐ | Vì sao logout phải là POST | [05 §2](../05-auth-va-phan-quyen.md) |
| ☐ | Gate vs Policy | [05 §5–6](../05-auth-va-phan-quyen.md) |
| ☐ | `Gate::before` phải trả `null` chứ không phải `false` — vì sao | [05 §6](../05-auth-va-phan-quyen.md) |
| ☐ | `@can` có bảo vệ dữ liệu không | [05 §6](../05-auth-va-phan-quyen.md) |

---

## D. Queue, Cache, Event

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Job không chạy — kiểm tra gì đầu tiên | [07 §1](../07-queue-mail-event-test.md) |
| ☐ | Vì sao job chạy hai lần (`retry_after` vs `timeout`) | [nc/03 §3](../nang-cao/03-queue-va-horizon.md) |
| ☐ | Job idempotent — hai cách làm | [nc/03 §4](../nang-cao/03-queue-va-horizon.md) |
| ☐ | Vì sao sửa job mà worker vẫn chạy code cũ | [07 §1](../07-queue-mail-event-test.md) |
| ☐ | `dispatch` trong transaction gây lỗi gì | [nc/03 §4](../nang-cao/03-queue-va-horizon.md) |
| ☐ | Batch vs chain | [nc/03 §5](../nang-cao/03-queue-va-horizon.md) |
| ☐ | Circuit breaker cho job gọi API ngoài | [nc/03 §6](../nang-cao/03-queue-va-horizon.md) |
| ☐ | Vì sao backoff phải tăng dần | [nc/03 §7](../nang-cao/03-queue-va-horizon.md) |
| ☐ | Cache driver nào hỗ trợ tag, cái nào không | [nc/02 §5](../nang-cao/02-cache-nhieu-tang.md) |
| ☐ | Cache stampede là gì, `Cache::flexible()` giải quyết thế nào | [nc/02 §7](../nang-cao/02-cache-nhieu-tang.md) |
| ☐ | Vì sao cache cũ nguy hiểm hơn cache chậm | [nc/02 §6](../nang-cao/02-cache-nhieu-tang.md) |
| ☐ | Cache response của user đã đăng nhập — nguy hiểm gì | [nc/02 §8](../nang-cao/02-cache-nhieu-tang.md) |
| ☐ | Laravel 13 tìm listener bằng cách nào | [07 §3](../07-queue-mail-event-test.md) |
| ☐ | Khi nào **không** nên dùng event | [07 §3](../07-queue-mail-event-test.md) |
| ☐ | Observer: thứ tự hook create/update/delete | [12 §3](../12-collection-va-model-nang-cao.md) |
| ☐ | Vì sao không gửi mail trong observer | [12 §3](../12-collection-va-model-nang-cao.md) |

---

## E. Bảo mật

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Mass assignment — tấn công thế nào, chống 3 lớp | [nc/06 §1](../nang-cao/06-bao-mat.md) |
| ☐ | Khi nào Laravel vẫn dính SQL injection | [nc/06 §3](../nang-cao/06-bao-mat.md) |
| ☐ | `orderBy` với input người dùng — vì sao nguy hiểm | [nc/06 §3](../nang-cao/06-bao-mat.md) |
| ☐ | `{!! nl2br(e($x)) !!}` — vì sao thứ tự quan trọng | [nc/06 §4](../nang-cao/06-bao-mat.md) |
| ☐ | IDOR là gì, Laravel chống bằng gì | [nc/06 §2](../nang-cao/06-bao-mat.md) |
| ☐ | `APP_DEBUG=true` trên production lộ những gì | [nc/06 §8](../nang-cao/06-bao-mat.md) |
| ☐ | Trả model thẳng từ route — vấn đề gì | [nc/06 §8](../nang-cao/06-bao-mat.md) |
| ☐ | Token Sanctum nên có gì (scope, hạn) | [nc/06 §7](../nang-cao/06-bao-mat.md) |
| ☐ | Webhook bỏ CSRF thì phải làm gì thay thế | [nc/06 §5](../nang-cao/06-bao-mat.md) |

---

## F. Collection, Blade, Artisan

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | `Post::all()->where()` vs `Post::where()->get()` | [12 §1](../12-collection-va-model-nang-cao.md) |
| ☐ | `LazyCollection` khi nào cần | [12 §1](../12-collection-va-model-nang-cao.md) |
| ☐ | `groupBy`, `reduce`, `partition`, `countBy` dùng khi nào | [12 §1](../12-collection-va-model-nang-cao.md) |
| ☐ | `->map->count()` nghĩa là gì | [12 §1](../12-collection-va-model-nang-cao.md) |
| ☐ | Blade thực chất là gì (biên dịch ra PHP) | [02 §1](../02-blade-va-giao-dien.md) |
| ☐ | `{{ }}` vs `{!! !!}` | [02 §2](../02-blade-va-giao-dien.md) |
| ☐ | `@props` làm gì với `$attributes` | [02 §5](../02-blade-va-giao-dien.md) |
| ☐ | `:post="$post"` vs `post="$post"` | [02 §9](../02-blade-va-giao-dien.md) |
| ☐ | Laravel 13 khai signature của command bằng gì | [12 §4](../12-collection-va-model-nang-cao.md) |
| ☐ | Vì sao command nên có `--dry-run` và `return self::SUCCESS` | [12 §4](../12-collection-va-model-nang-cao.md) |

---

## G. Testing, Kiến trúc, Vận hành

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Test chạy trên database nào — vì sao phải giống production | [nc/07 §1](../nang-cao/07-testing-chuyen-sau.md) |
| ☐ | Ví dụ SQLite cho qua mà PostgreSQL từ chối | [12 §2](../12-collection-va-model-nang-cao.md) |
| ☐ | Feature test vs unit test — Laravel nên nghiêng về đâu | [nc/07 §2](../nang-cao/07-testing-chuyen-sau.md) |
| ☐ | `->for($user)` đoán sai tên quan hệ khi nào | [nc/07 §4](../nang-cao/07-testing-chuyen-sau.md) |
| ☐ | `Queue::fake()`, `Mail::fake()` để làm gì | [07 §6](../07-queue-mail-event-test.md) |
| ☐ | Test flaky — 3 nguyên nhân | [nc/07 §8](../nang-cao/07-testing-chuyen-sau.md) |
| ☐ | Khi nào tách logic ra khỏi controller | [nc/05 §3](../nang-cao/05-kien-truc-du-an-lon.md) |
| ☐ | Repository pattern — nên hay không, vì sao | [phỏng vấn 01 H3](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao Action không được biết về HTTP | [nc/05 §3](../nang-cao/05-kien-truc-du-an-lon.md) |
| ☐ | Model gầy nghĩa là gì | [nc/05 §9](../nang-cao/05-kien-truc-du-an-lon.md) |
| ☐ | Deploy: 4 lệnh hay quên nhất | [nc/08 §5](../nang-cao/08-deploy-octane-docker.md) |
| ☐ | Octane rò rỉ trạng thái — nguyên nhân và cách tránh | [nc/08 §4](../nang-cao/08-deploy-octane-docker.md) |
| ☐ | Chạy nhiều server cần đổi những gì | [phỏng vấn 03 §7](./03-cau-hoi-tinh-huong.md) |
| ☐ | 4 chỉ số nên theo dõi liên tục | [nc/09 §10](../nang-cao/09-do-luong-va-benchmark.md) |

---

## H. Bạn có kể được không?

Không tra tài liệu được — phải là trải nghiệm của bạn.

| | Nội dung |
|---|---|
| ☐ | Kể một dự án trong 2 phút: bối cảnh → vai trò → khó khăn kỹ thuật → **con số** |
| ☐ | Kể một lỗi khó: triệu chứng → cách tìm → nguyên nhân → cách sửa → cách phòng |
| ☐ | Một quyết định kỹ thuật bạn đã cân nhắc đánh đổi, và vì sao chọn như vậy |
| ☐ | Một thứ bạn từng làm sai và học được gì |
| ☐ | Vì sao đổi việc (không chê công ty cũ) |
| ☐ | 3 câu hỏi bạn sẽ hỏi lại nhà tuyển dụng |

**Gạch nào có chữ "con số" thì phải có con số thật.** "Em tối ưu trang danh sách" yếu hơn nhiều so với
"Em giảm từ 21 query xuống 3 query, trang từ 8 giây xuống 400ms".

---

## Chấm điểm

Đếm số ❌ và ⚠️ theo nhóm:

| Kết quả | Nghĩa là |
|---------|----------|
| A còn ❌ | **Chưa nên đi phỏng vấn.** Nhóm A là bộ lọc, ôn [bài 11](../11-container-facade-provider.md) trước |
| B hoặc E còn ❌ | Ôn tiếp 2–3 ngày. Đây là hai nhóm bị hỏi sâu nhất |
| C, D còn ⚠️ | Chấp nhận được nếu bạn nói được ví dụ |
| F, G còn ⚠️ | Không sao — nói "em chưa dùng nhiều nhưng em hiểu nó giải quyết vấn đề X" |
| H còn ❌ | **Nguy hiểm hơn bạn nghĩ.** Kỹ thuật giỏi mà không kể được thì người phỏng vấn không có gì để đánh giá |

---

## Làm lại sau khi ôn

Đánh dấu ngày và số ❌/⚠️ mỗi lần làm, để thấy tiến độ:

| Lần | Ngày | ❌ | ⚠️ | Nhóm yếu nhất |
|-----|------|----|----|----|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Nếu sau hai lần mà một mục vẫn ⚠️, đừng đọc lại — hãy **viết code thử nó**. Thứ bạn tự gõ và tự thấy
lỗi sẽ nhớ lâu hơn mọi lần đọc.

---

Quay lại [README](./README.md) · [Ngân hàng câu hỏi](./01-cau-hoi-va-dap-an.md)
