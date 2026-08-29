# Luyện phỏng vấn Redis

| File | Nội dung | Thời lượng |
|---|---|---|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 70 câu hỏi + đáp án hai tầng, kèm output thật | 7h |
| [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) | 20 bài gõ tay trong `redis-cli` và Node | 6h |
| [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md) | 10 tình huống "production đang hỏng, bạn làm gì" | 4h |
| [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) | Checklist tự chấm | 1h |

---

## Redis được hỏi thế nào

Redis hiếm khi là vị trí riêng — nó là **câu hỏi bắt buộc** trong phỏng vấn backend từ mức Middle trở
lên. Ba mức:

| Mức | Câu hỏi điển hình | Cho thấy gì |
|---|---|---|
| **Biết dùng** | "Redis là gì? Có những kiểu dữ liệu nào?" | Đã đọc tài liệu |
| **Dùng thật** | "Cache invalidation làm sao? Vì sao xoá chứ không cập nhật?" | Đã tự viết cache trong dự án |
| **Vận hành** | "Redis đầy RAM thì sao? `KEYS *` hại thế nào?" | Đã trực production |

Mức 1 ai cũng trả lời được. Mức 2 và 3 là chỗ ghi điểm.

---

## Mười câu hay gặp nhất

1. **Redis nhanh vì sao?** — và câu hỏi móc theo: "chạy một luồng thì có phải điểm yếu không?"
2. **Có những kiểu dữ liệu nào, mỗi kiểu dùng khi nào?**
3. **Cache-aside là gì? Khi dữ liệu đổi thì cập nhật cache hay xoá cache?**
4. **Cache stampede / penetration / avalanche là gì, chống thế nào?**
5. **Redis đầy bộ nhớ thì chuyện gì xảy ra?**
6. **`MULTI/EXEC` có phải transaction không? Có rollback không?**
7. **Làm khoá phân tán bằng Redis thế nào? Có gì không an toàn?**
8. **Vì sao không được `KEYS *` trên production?**
9. **RDB và AOF khác gì? Mất bao nhiêu dữ liệu khi server chết?**
10. **Redis chết thì app của bạn thế nào?**

Cả mười có đáp án đầy đủ kèm output thật trong [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md).

---

## Cách trả lời

Redis là chủ đề mà **con số** thuyết phục hơn lý thuyết. So sánh hai câu trả lời cho cùng một câu hỏi:

> ❌ "`KEYS *` chậm nên không nên dùng trên production, thay bằng `SCAN`."
>
> ✅ "Redis chạy một luồng nên `KEYS *` giữ luôn luồng đó. Em đo trên database 631 nghìn khoá: một lệnh
> `KEYS *` để lại bản ghi slowlog **151 nghìn micro giây**, tức 151ms. Trong lúc đó em chạy
> `redis-cli --latency` từ một terminal khác: độ trễ tối đa nhảy từ 1.99ms lên **61.96ms**, trung bình
> từ 0.4ms lên 4.33ms. Nghĩa là mọi request khác đều chậm theo. `SCAN` chia thành nhiều lệnh nhỏ, mỗi
> lệnh dưới 1ms nên không lệnh nào lọt vào slowlog — tổng thời gian lâu hơn nhưng không chặn ai."

Câu thứ hai cho thấy bạn **đã tự đo**, không phải đọc blog.

Cấu trúc ba tầng khi trả lời:

```
Tầng 1  Câu trả lời trực tiếp, một hai câu
Tầng 2  Cơ chế bên dưới — vì sao lại thế
Tầng 3  Con số hoặc trải nghiệm thật của bạn
```

**Chuẩn bị sẵn con số của chính bạn.** Chạy lại các thí nghiệm trong
[02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) trên máy mình và ghi lại kết quả — nói "em đo được
X" mạnh hơn nhiều so với "tài liệu nói X".

---

## Ba câu bẫy hay làm người ta trượt

**1. "`MULTI/EXEC` có rollback không?"**
Rất nhiều người trả lời "có" vì quen transaction SQL. Đáp án đúng: **không**. Lỗi cú pháp thì cả khối bị
huỷ, nhưng lỗi lúc chạy (ví dụ `INCR` lên một chuỗi) thì các lệnh khác **vẫn thực thi**.

**2. "Pipeline và `MULTI` khác nhau chỗ nào?"**
Pipeline chỉ gom lệnh để tiết kiệm vòng mạng — client khác **vẫn chen vào giữa được**. `MULTI` mới bảo
đảm không ai chen.

**3. "Redis có bền dữ liệu không?"**
Trả lời "có, nhờ RDB và AOF" là chưa đủ. Đáp án tốt nói rõ **mất bao nhiêu**: mặc định RDB + `kill -9`
là **mất trắng**; AOF `everysec` là **mất tối đa 1 giây**.

---

## Lộ trình 4 ngày

| Ngày | Việc |
|---|---|
| 1 | [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) trước để biết mình hổng đâu, rồi nhóm A–C của [01](./01-cau-hoi-va-dap-an.md) |
| 2 | Nhóm D–F của [01](./01-cau-hoi-va-dap-an.md) + [02](./02-bai-tap-thuc-hanh.md) bài 1–10 |
| 3 | Nhóm G–I + [02](./02-bai-tap-thuc-hanh.md) bài 11–20 — **gõ tay, không copy** |
| 4 | [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md), nói thành tiếng. Làm lại checklist |

---

Quay lại giáo trình: [../README.md](../README.md)
