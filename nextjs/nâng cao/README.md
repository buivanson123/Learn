# Next.js nâng cao — chịu tải, dữ liệu lớn, vận hành

Bộ 10 bài cho giai đoạn sau khi bạn đã làm xong dự án Blog ở [bài 08](<../08-du-an-blog-frontend.md>).

**Điều kiện tiên quyết:** hiểu Server/Client Component, Server Action, cache và revalidate ở mức bài 02–04. Nếu còn phân vân "cái này chạy ở server hay client", quay lại [bài 02](<../02-server-client-component.md>) trước — mọi thứ ở đây đều dựng trên nền đó.

Trọng tâm bộ này: **xử lý dữ liệu lớn, nhiều request, và vận hành thật** — không phải học thêm cú pháp.

---

## Lộ trình

| Bài | Nội dung | Khi nào cần |
|---|---|---|
| [01](<./01-cache-components.md>) | **Cache Components & `use cache`** — mô hình cache mới của Next 16, PPR | Muốn trang vừa tĩnh vừa động |
| [02](<./02-co-che-render.md>) | **Cơ chế render** — RSC payload, streaming, hydration, prefetch, router cache | Muốn hiểu vì sao trang chậm |
| [03](<./03-du-lieu-lon.md>) | **Dữ liệu lớn** — cursor pagination, virtual list, infinite scroll, export triệu dòng | Bảng > 10.000 dòng |
| [04](<./04-toi-uu-hieu-nang.md>) | **Tối ưu hiệu năng** — bundle, code splitting, React Compiler, Core Web Vitals | Trang nặng, LCP kém |
| [05](<./05-cache-nhieu-tang.md>) | **Cache nhiều tầng** — CDN, cache handler Redis, ISR nhiều instance | Chạy nhiều container |
| [06](<./06-realtime.md>) | **Realtime** — SSE, WebSocket qua NestJS, polling, `after()` | Thông báo, chat, live count |
| [07](<./07-kien-truc-quy-mo-lon.md>) | **Kiến trúc dự án lớn** — DAL, `server-only`, ép ranh giới, monorepo | Team nhiều người |
| [08](<./08-bao-mat-nang-cao.md>) | **Bảo mật nâng cao** — DAL, taint, CSRF, CSP, rate limit | Trước khi lên production |
| [09](<./09-testing.md>) | **Testing** — Vitest, RTL, Playwright, test Server Action | Dự án cần bảo trì lâu |
| [10](<./10-observability-benchmark.md>) | **Đo lường & vận hành** — OpenTelemetry, log, `onRequestError`, benchmark k6 | Đã lên production |

Không cần đọc theo thứ tự. Ba bài đáng đọc trước nhất nếu bạn chỉ có ít thời gian: **02** (hiểu cơ chế), **07** (kiến trúc), **08** (bảo mật).

---

## Ba câu hỏi bộ này trả lời

### 1. "Trang tôi chậm, chậm ở đâu?"

Đọc [02](<./02-co-che-render.md>) để hiểu một request đi qua những tầng nào, rồi [10](<./10-observability-benchmark.md>) để đo thật bằng OpenTelemetry và k6. Đừng tối ưu khi chưa đo — bạn sẽ tối ưu nhầm chỗ.

### 2. "Danh sách 500.000 dòng thì làm sao?"

[03](<./03-du-lieu-lon.md>). Câu trả lời ngắn: đừng bao giờ `LIMIT/OFFSET` ở trang 5.000, đừng render 500.000 thẻ `<li>`, và đừng gom hết vào RAM để xuất CSV. Cả ba đều có mẫu code cụ thể trong bài.

### 3. "Chạy 4 container thì cache có đồng bộ không?"

**Không, mặc định là không.** Mỗi instance giữ cache riêng, `revalidateTag` trên instance A không ảnh hưởng B. [05](<./05-cache-nhieu-tang.md>) chỉ cách dựng cache handler dùng chung Redis và cài `refreshTags()` để đồng bộ.

---

## Bảng tra: gặp vấn đề nào, đọc bài nào

| Triệu chứng | Bài |
|---|---|
| Trang tĩnh nhưng có một phần cần cá nhân hoá | 01 |
| Chuyển trang có cảm giác chậm dù dữ liệu đã cache | 02 |
| Bảng dữ liệu khiến trình duyệt đứng hình | 03 |
| Bundle JS quá to, LCP > 2.5s | 04 |
| Deploy nhiều instance, dữ liệu lúc mới lúc cũ | 05 |
| Cần cập nhật realtime mà không muốn polling | 06 |
| Dự án lộn xộn, không biết đặt file ở đâu | 07 |
| Sắp lên production, lo lộ dữ liệu | 08 |
| Sửa một chỗ hỏng ba chỗ khác | 09 |
| Không biết trang nào chậm trên production | 10 |

---

## Lưu ý về phiên bản

Toàn bộ nội dung viết cho **Next.js 16.3**. Ba thứ trong bộ này còn đang thay đổi nhanh, kiểm tra lại tài liệu chính chủ trước khi đưa lên production:

| Tính năng | Trạng thái 08/2026 |
|---|---|
| `cacheComponents` / `use cache` | Ổn định từ 16.0, nhưng mô hình khác hẳn Next 15 |
| `use cache: private` / `use cache: remote` | Mới, ít tài liệu thực chiến |
| `experimental.taint` | Vẫn là `experimental` |
| Build Adapters API | Alpha |

Về mục lục chính 👉 [../README.md](<../README.md>)
