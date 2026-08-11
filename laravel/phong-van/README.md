# Luyện phỏng vấn Laravel — mức Middle (2–4 năm)

Bộ tài liệu chính dạy **xây**. Bộ này dạy **nói**.

Biết làm mà diễn đạt lúng túng vẫn trượt. Ngược lại, trả lời trơn tru mà không có ví dụ thật thì bị lộ
ngay ở câu hỏi đào sâu thứ hai.

---

## Bốn file

| File | Dùng khi | Thời lượng |
|------|----------|------------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | Ôn kiến thức — 80 câu hay gặp, mỗi câu có bản trả lời 30 giây và bản đào sâu | 6h |
| [02-bai-test-code.md](./02-bai-test-code.md) | Luyện take-home và live-coding | 8h |
| [03-cau-hoi-tinh-huong.md](./03-cau-hoi-tinh-huong.md) | Câu hỏi đo tư duy: "traffic tăng 10 lần bạn làm gì" | 4h |
| [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) | Đánh dấu chỗ còn hổng **trước** khi ôn | 1h |

---

## Bắt đầu từ đâu

**Làm [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) trước.** Nó là checklist "tôi có giải thích được điều
này cho người khác không". Đánh dấu xong bạn biết mình cần ôn cái gì, thay vì đọc lại từ đầu.

Sau đó ôn theo lộ trình dưới.

---

## Lộ trình 2 tuần

Giả định bạn đã học xong bộ cơ bản và đã làm dự án Blog.

### Tuần 1 — kiến thức

| Ngày | Việc | File |
|------|------|------|
| 1 | Tự kiểm tra, khoanh vùng chỗ hổng | [04](./04-tu-kiem-tra.md) |
| 2 | Container, Facade, Provider — nhóm câu hỏi chắc chắn bị hỏi | [../11](../11-container-facade-provider.md) + [01](./01-cau-hoi-va-dap-an.md) mục A |
| 3 | Eloquent, N+1, index | [../03](../03-database-va-eloquent.md), [../nang-cao/01](../nang-cao/01-toi-uu-eloquent.md) + [01](./01-cau-hoi-va-dap-an.md) mục C |
| 4 | Request lifecycle, middleware, validate, auth | [01](./01-cau-hoi-va-dap-an.md) mục B, D |
| 5 | Queue, cache, event | [01](./01-cau-hoi-va-dap-an.md) mục E |
| 6 | Collection, Observer, Artisan | [../12](../12-collection-va-model-nang-cao.md) + [01](./01-cau-hoi-va-dap-an.md) mục F |
| 7 | Bảo mật + test | [01](./01-cau-hoi-va-dap-an.md) mục G, H |

### Tuần 2 — thực hành

| Ngày | Việc | File |
|------|------|------|
| 8–9 | Làm bài test code, **bấm giờ** | [02](./02-bai-test-code.md) |
| 10 | Câu hỏi tình huống — nói thành tiếng | [03](./03-cau-hoi-tinh-huong.md) |
| 11 | Chuẩn bị kể về dự án của mình (mục dưới) | — |
| 12 | Làm lại [04](./04-tu-kiem-tra.md), so với lần đầu | [04](./04-tu-kiem-tra.md) |
| 13 | Ôn lại đúng những mục còn đỏ | — |
| 14 | Nghỉ. Đừng nhồi hôm trước ngày phỏng vấn | — |

---

## Cách trả lời — công thức ba tầng

Đây là thứ tạo khác biệt lớn nhất, hơn cả lượng kiến thức.

```
Tầng 1 (20–30 giây)  Định nghĩa ngắn + vì sao nó tồn tại
Tầng 2 (30 giây)     Một ví dụ CỤ THỂ từ dự án của bạn
Tầng 3 (khi được hỏi thêm)  Chi tiết kỹ thuật, đánh đổi, cái bẫy
```

Ví dụ với câu "Eager loading là gì?":

> **Tầng 1:** Là nạp trước quan hệ để tránh N+1 — thay vì mỗi bản ghi một query, Laravel gom lại thành
> một query `whereIn`.
>
> **Tầng 2:** Ở dự án blog của em, trang danh sách hiển thị tên tác giả. Không có `with('author')` thì
> 20 bài viết là 21 query. Thêm vào còn 2 query, và con số đó không đổi dù có 200 bài.
>
> **Tầng 3 (nếu được hỏi thêm):** Em bật `Model::preventLazyLoading()` ở môi trường dev để N+1 thành
> exception luôn. Có một chi tiết là nó không báo lỗi khi collection chỉ có 1 bản ghi — trong
> `Builder::hydrate()` Laravel chỉ bật cờ khi `count($items) > 1` — nên test N+1 phải seed ít nhất 2 dòng.

**Đừng nói hết tầng 3 ngay.** Trả lời dài dòng làm người phỏng vấn không kịp hỏi câu tiếp, và họ không
đánh giá được bạn hiểu tới đâu. Nói tầng 1+2, dừng lại, để họ đào.

---

## Ba câu chuyện phải chuẩn bị sẵn

Gần như phỏng vấn nào cũng hỏi. Viết ra giấy, tập nói thành tiếng.

### 1. "Kể về một dự án bạn làm"

Khung 4 phần, khoảng 2 phút:

- **Bối cảnh:** làm gì, cho ai, quy mô bao nhiêu (số người dùng, số bản ghi).
- **Vai trò của bạn:** cụ thể bạn viết phần nào.
- **Một khó khăn kỹ thuật:** chọn cái bạn hiểu sâu nhất.
- **Kết quả đo được:** con số.

Ví dụ dùng chính dự án Blog trong bộ tài liệu này:

> Em làm một blog full-stack bằng Laravel 13 và Livewire 4, dữ liệu ở PostgreSQL. Phần khó nhất là
> trang quản trị: tìm kiếm gõ tới đâu lọc tới đó, không reload trang. Ban đầu mỗi phím gõ là một
> request và một query, em thêm `debounce 300ms` nên gõ một từ chỉ còn một request. Trang danh sách
> lúc đầu bị N+1 — 20 bài là 21 query — em thêm `with('author')` và `withCount('comments')` nên còn
> đúng 3 query bất kể số bài. Em viết test đếm số query để nó không tái diễn.

Con số (`21 → 3 query`) là thứ khiến câu trả lời đáng tin. Không có con số thì nghe như đọc thuộc lòng.

### 2. "Một lỗi khó nhất bạn từng gặp"

Khung: triệu chứng → cách bạn tìm → nguyên nhân → cách sửa → cách phòng.

Chọn lỗi có **nguyên nhân bất ngờ**, không phải lỗi cú pháp. Vài lỗi tốt từ bộ tài liệu này:

- Job chạy hai lần vì `retry_after` < `timeout` ([nang-cao/03 mục 3](../nang-cao/03-queue-va-horizon.md)).
- Cột bị bỏ qua trong im lặng vì không có trong `#[Fillable]` ([bài 09 lỗi 1](../09-loi-thuong-gap.md)).
- Test xanh trên SQLite nhưng production hỏng vì `ilike` ([nang-cao/07 mục 1](../nang-cao/07-testing-chuyen-sau.md)).
- Deploy xong nhưng worker vẫn chạy code cũ vì quên `queue:restart`.

### 3. "Vì sao bạn muốn đổi việc"

Ngắn, không chê công ty cũ. Hướng về phía trước: muốn làm hệ thống lớn hơn, muốn học sâu về X.

---

## Bạn cũng nên hỏi lại

Cuối buổi họ luôn hỏi "em có câu hỏi gì không". Trả lời "không" là mất điểm.

Câu đáng hỏi (và cho thấy bạn có kinh nghiệm thật):

- Team đang dùng Laravel bản mấy? Có kế hoạch nâng cấp không?
- Quy trình deploy thế nào — có CI không, deploy mấy lần một tuần?
- Có test tự động không? Coverage khoảng bao nhiêu?
- Code review làm thế nào?
- Dữ liệu lớn nhất hiện tại khoảng bao nhiêu bản ghi? Có gặp vấn đề hiệu năng gì chưa?
- Nếu em vào, tháng đầu em sẽ làm gì?

---

## Bốn nguyên tắc lúc phỏng vấn

1. **Không biết thì nói không biết**, rồi nói cách bạn sẽ tìm ra. Bịa là mất điểm nặng nhất — người
   phỏng vấn hỏi sâu thêm một câu là lộ.
2. **Luôn kèm ví dụ cụ thể.** "Em dùng queue" yếu hơn nhiều so với "Em đẩy việc gửi mail vào queue vì
   nó tốn 800ms, request giảm từ 1.2s xuống 200ms".
3. **Nói ra cách suy nghĩ** khi làm bài code, đừng ngồi im. Người ta đánh giá quá trình, không chỉ
   kết quả.
4. **Hỏi lại cho rõ đề** trước khi code. Đề mơ hồ là cố ý — họ muốn xem bạn có hỏi không.

---

## Đừng học tủ

Bộ này liệt kê câu hỏi hay gặp, không phải đề thi. Người phỏng vấn giỏi sẽ hỏi **"vì sao"** sau mỗi câu
trả lời. Học thuộc đáp án mà không hiểu cơ chế thì gãy ở câu thứ hai.

Cách dùng đúng: đọc câu hỏi → **tự trả lời trước** → mới xem đáp án → nếu khác, quay lại đọc bài gốc
được dẫn link.

---

Quay lại [bộ cơ bản](../README.md) · [bộ nâng cao](../nang-cao/README.md)
