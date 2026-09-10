# Bộ luyện phỏng vấn Senior Frontend & Backend

Bộ này không dạy lại kiến thức cơ bản. Nó tập trung vào **những câu thực sự được hỏi ở vòng
senior** và cách trả lời sao cho người phỏng vấn tin là bạn đã làm thật.

| Thư mục | Nội dung | Số câu |
|---|---|---|
| [frontend/](./frontend/) | JavaScript runtime, trình duyệt, React, hiệu năng, kiến trúc | 78 |
| [backend/](./backend/) | Runtime & đồng thời, database, transaction, API, cache/queue, bảo mật, sự cố | 106 |
| [chung/](./chung/) | System design, câu hỏi hành vi, câu hỏi ngược lại, checklist tự chấm | 40 |

Mọi con số và output trong bộ này đều **đo thật** trên máy: Node v22.23.2 và PostgreSQL 17 chạy
trong Docker. Lệnh tái hiện nằm ngay cạnh output — bạn chạy lại được và nên chạy lại, vì nói
"em đo được X" mạnh hơn "tài liệu nói X".

---

## Phỏng vấn senior khác phỏng vấn middle ở đâu

Đây là điều nhiều người bị trượt mà không hiểu vì sao: họ trả lời **đúng** mọi câu nhưng vẫn rớt.
Lý do là ở mức senior, câu hỏi chỉ là cái cớ. Người phỏng vấn đang đo bốn thứ khác:

| Họ hỏi | Middle trả lời | Senior trả lời |
|---|---|---|
| "Index là gì?" | Định nghĩa đúng | Định nghĩa + **khi nào index không được dùng** + chi phí ghi |
| "Dùng Redis để làm gì?" | Liệt kê use case | Chọn một use case, nói **đánh đổi** và **khi Redis chết thì sao** |
| "React re-render khi nào?" | Khi state đổi | Cơ chế + **cách đo** + khi nào tối ưu là lãng phí |
| "Bạn từng gặp sự cố gì?" | Kể một bug | Kể **cách khoanh vùng**, số liệu, và bài học đã đưa vào quy trình |

Bốn thứ được đo:

1. **Đánh đổi.** Senior không có "công nghệ tốt nhất", chỉ có "tốt nhất cho ràng buộc này".
   Câu trả lời không nêu cái giá phải trả là câu trả lời của người chưa từng chịu hậu quả.
2. **Cách khoanh vùng.** Trước một sự cố lạ, bạn nhìn gì đầu tiên? Đây là câu hỏi khó bịa nhất.
3. **Ảnh hưởng lên người khác.** Quyết định của bạn khiến team phải sống với gì trong 2 năm tới.
4. **Biết mình không biết gì.** Nói "chỗ này em chưa làm, nhưng em sẽ kiểm chứng bằng cách…"
   ăn điểm cao hơn đoán bừa. Đoán bừa mà bị bắt là mất hết uy tín của cả buổi.

---

## Công thức trả lời ba tầng

Dùng cho gần như mọi câu kỹ thuật:

```
Tầng 1   Trả lời thẳng, 1–2 câu. Không lòng vòng, không "cái này thì tuỳ".
Tầng 2   Cơ chế bên dưới — vì sao nó lại như vậy.
Tầng 3   Số liệu hoặc trải nghiệm thật của bạn + đánh đổi.
```

Ví dụ cùng một câu hỏi "vì sao không nên `SELECT *`":

> ❌ "Vì nó lấy thừa cột, tốn băng thông, nên chỉ chọn cột cần thiết."
>
> ✅ "Vì nó phá **index-only scan**. Em đo trên bảng 500 nghìn dòng: query `SELECT count(*) FROM
> users WHERE status='banned'` chạy `Index Only Scan`, `Heap Fetches: 0`, hết **0.551 ms**. Đổi
> thành `SELECT *` là Postgres buộc phải quay lại heap lấy các cột còn lại. Ngoài ra `SELECT *`
> làm code vỡ ngầm khi ai đó thêm cột `password_hash` vào bảng — API tự nhiên trả thêm field mà
> không ai sửa dòng nào."

Tầng 3 là chỗ phân biệt. Nó khó bịa, nên nó là chỗ đáng chuẩn bị nhất.

---

## Ba lỗi làm hỏng buổi phỏng vấn senior

**1. Trả lời bằng tên công nghệ thay vì bằng cơ chế.**
"Em dùng Kafka cho cái đó" không trả lời câu hỏi nào. Người phỏng vấn muốn nghe *vì sao cần một
log bền, có thứ tự, đọc lại được*, và vì sao hàng đợi thường không đủ.

**2. Giấu chỗ mình không biết.**
Người phỏng vấn senior gần như luôn đào sâu thêm một tầng nữa so với chỗ bạn dừng. Nếu bạn nói
chắc nịch về thứ mình chỉ đọc lướt, tầng đào tiếp theo sẽ lộ ra ngay và họ sẽ nghi ngờ cả những
câu bạn trả lời đúng trước đó.

**3. Không hỏi lại trước khi thiết kế.**
Trong câu system design, nhảy vào vẽ kiến trúc ngay khi nghe đề là dấu hiệu của người chưa từng
chịu trách nhiệm cho một hệ thống thật. Hỏi quy mô, hỏi tỷ lệ đọc/ghi, hỏi cái gì được phép sai.

---

## Lộ trình 7 ngày

| Ngày | Việc |
|---|---|
| 1 | [chung/04-tu-kiem-tra.md](./chung/04-tu-kiem-tra.md) trước — để biết mình hổng đâu |
| 2 | [backend/01](./backend/01-runtime-va-dong-thoi.md) + [backend/02](./backend/02-database-va-truy-van.md), chạy lại mọi lệnh đo |
| 3 | [backend/03](./backend/03-transaction-va-dong-thoi-du-lieu.md) + [backend/04](./backend/04-thiet-ke-api.md) |
| 4 | [backend/05](./backend/05-cache-queue-va-scaling.md) + [backend/06](./backend/06-bao-mat.md) |
| 5 | [frontend/01](./frontend/01-javascript-va-runtime.md) → [frontend/03](./frontend/03-react-va-quan-ly-state.md) |
| 6 | [frontend/04](./frontend/04-hieu-nang-va-do-luong.md) + [frontend/05](./frontend/05-kien-truc-testing-va-tinh-huong.md) |
| 7 | [chung/01-system-design.md](./chung/01-system-design.md) — **nói thành tiếng**, bấm giờ 45 phút mỗi đề. Rồi [backend/07](./backend/07-tinh-huong-su-co.md) và [chung/02](./chung/02-cau-hoi-hanh-vi.md) |

Trước buổi phỏng vấn 1 tiếng: đọc lại [chung/03-cau-hoi-nguoc-lai.md](./chung/03-cau-hoi-nguoc-lai.md).
