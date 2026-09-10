# Phỏng vấn Senior Backend — 106 câu

| File | Nội dung | Số câu |
|---|---|---|
| [01-runtime-va-dong-thoi.md](./01-runtime-va-dong-thoi.md) | Event loop, worker, stream, pool, graceful shutdown, idempotency | 16 |
| [02-database-va-truy-van.md](./02-database-va-truy-van.md) | Index, EXPLAIN, N+1, phân trang, migration, sharding | 18 |
| [03-transaction-va-dong-thoi-du-lieu.md](./03-transaction-va-dong-thoi-du-lieu.md) | Isolation, lost update, lock, deadlock, outbox, saga | 14 |
| [04-thiet-ke-api.md](./04-thiet-ke-api.md) | REST/GraphQL/gRPC, versioning, lỗi, rate limit, webhook | 16 |
| [05-cache-queue-va-scaling.md](./05-cache-queue-va-scaling.md) | Cache invalidation, stampede, queue, scaling, observability | 18 |
| [06-bao-mat.md](./06-bao-mat.md) | SQLi, XSS, CSRF, JWT, OAuth, phân quyền, SSRF, secret | 14 |
| [07-tinh-huong-su-co.md](./07-tinh-huong-su-co.md) | 10 tình huống "production đang hỏng" | 10 |

Mọi output đo trên **Node v22.23.2** và **PostgreSQL 17** (Docker), bảng thử nghiệm 500 nghìn user
và 2 triệu đơn hàng. Lệnh dựng lại môi trường nằm ở đầu
[02-database-va-truy-van.md](./02-database-va-truy-van.md).

---

## 12 câu gần như luôn được hỏi

Nếu chỉ có một buổi tối để ôn, ôn 12 câu này:

1. **Node đơn luồng thì sao phục vụ được nhiều người?** → [01, câu 1](./01-runtime-va-dong-thoi.md)
2. **Index hoạt động thế nào, khi nào nó không được dùng?** → [02, câu 1–2](./02-database-va-truy-van.md)
3. **N+1 query là gì, phát hiện thế nào?** → [02, câu 9](./02-database-va-truy-van.md)
4. **Vì sao `OFFSET` sâu lại chậm?** → [02, câu 10](./02-database-va-truy-van.md)
5. **Hai người cùng mua món hàng cuối cùng — bạn xử lý thế nào?** → [03, câu 4 và 11](./03-transaction-va-dong-thoi-du-lieu.md)
6. **Isolation level: READ COMMITTED bảo đảm gì và không bảo đảm gì?** → [03, câu 2–3](./03-transaction-va-dong-thoi-du-lieu.md)
7. **Deadlock xảy ra thế nào, phòng ra sao?** → [03, câu 6](./03-transaction-va-dong-thoi-du-lieu.md)
8. **Khi dữ liệu đổi thì cập nhật cache hay xoá cache?** → [05, câu 2](./05-cache-queue-va-scaling.md)
9. **Redis chết thì hệ thống của bạn thế nào?** → [05, câu 6](./05-cache-queue-va-scaling.md)
10. **JWT và session — chọn cái nào, vì sao?** → [06, câu 4](./06-bao-mat.md)
11. **Idempotency — thiết kế API thanh toán chịu được retry** → [01, câu 15](./01-runtime-va-dong-thoi.md)
12. **API chậm, bạn làm gì đầu tiên?** → [04, câu 16](./04-thiet-ke-api.md)

---

## Ba mức trả lời — người phỏng vấn đang xếp bạn vào mức nào

Cùng câu hỏi *"Bạn dùng Redis để làm gì?"*:

| Mức | Câu trả lời | Kết luận của người hỏi |
|---|---|---|
| Junior | "Để cache cho nhanh hơn." | Đã đọc tài liệu |
| Middle | "Cache-aside cho dữ liệu đọc nhiều, TTL 5 phút, xoá khi dữ liệu đổi." | Đã tự viết cache trong dự án |
| **Senior** | "Cache-aside. Nhưng phần em cân nhắc nhiều nhất là **khi Redis chết**: cache thì hệ thống chỉ chậm đi, nhưng nếu Redis giữ session thì toàn bộ user bị đăng xuất. Nên em tách hai mục đích ra hai instance, và có giới hạn đồng thời khi gọi DB để cache miss hàng loạt không kéo sập database." | Đã trực production |

Khác biệt không nằm ở kiến thức mà ở việc **nghĩ tới lúc nó hỏng**.

---

## Ba câu bẫy hay làm trượt

**1. "Transaction đảm bảo dữ liệu luôn đúng phải không?"**
Trả lời "đúng" là rơi bẫy. READ COMMITTED (mặc định của Postgres) **không** ngăn được lost update —
đã đo, kết quả ra 120 thay vì 130. Transaction bảo đảm tính nguyên tử, không tự động bảo đảm tính
đúng đắn khi có đồng thời.

**2. "Thêm index vào là query nhanh lên đúng không?"**
Không phải lúc nào cũng. Đã đo: index trên cột `status` bị planner **bỏ qua** khi tìm giá trị chiếm
98% số dòng — và đó là hành vi đúng. Chưa kể mỗi index làm mọi lượt ghi chậm đi.

**3. "Exactly-once delivery làm thế nào?"**
Đáp án đúng là **không làm được**. Cái làm được là at-least-once + consumer idempotent. Ai trả lời
"dùng Kafka là có exactly-once" thì chưa từng vận hành Kafka.

---

## Chuẩn bị "trải nghiệm thật" của chính bạn

Người phỏng vấn sẽ hỏi *"kể về một lần bạn xử lý sự cố"* hoặc *"quyết định kỹ thuật khó nhất bạn
từng đưa ra"*. Chuẩn bị sẵn **ba câu chuyện**, mỗi câu 2 phút, theo cấu trúc:

```
Bối cảnh    Hệ thống gì, quy mô nào, vấn đề gì
Việc bạn làm Cụ thể BẠN làm gì, không phải "team em"
Số liệu      Trước / sau. p95 từ 4s xuống 300ms. Lỗi từ 5% xuống 0.
Bài học      Bạn thay đổi gì trong cách làm việc sau đó
```

Ba câu chuyện nên phủ: **một sự cố production**, **một quyết định đánh đổi** (chọn A thay vì B và
chấp nhận cái giá), và **một lần bạn sai** — câu thứ ba ăn điểm cao nhất nếu kể trung thực.

Chưa có câu chuyện nào? Chạy lại các thí nghiệm trong bộ này trên máy mình và ghi số của bạn.
"Em tự dựng Postgres 2 triệu dòng để đo chênh lệch giữa OFFSET và keyset, ra 205 ms so với 0.04 ms"
là một câu trả lời thật và mạnh.

---

Quay lại: [../README.md](../README.md) · Sang phần frontend: [../frontend/README.md](../frontend/README.md)
