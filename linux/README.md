# Linux cho phỏng vấn backend

Bộ này **không** dạy Linux từ đầu. Nó nhắm đúng những gì bị hỏi khi phỏng vấn **backend developer** —
người deploy code lên server Linux, đọc log, xử lý sự cố, chứ không phải quản trị hệ thống.

Nếu bạn đã học [Docker](../docker/README.md), phần lớn kiến thức ở đây là thứ giải thích **vì sao**
container hành xử như vậy: PID 1 không nhận `SIGTERM`, exit code 137, quyền file trong volume.

---

## Nội dung

| File | Nội dung | Thời lượng |
|------|----------|------------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 60 câu hỏi + đáp án hai tầng, kèm output thật | 6h |
| [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) | 20 bài tập gõ tay trong container Linux thật | 5h |
| [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md) | 10 tình huống "server đang hỏng, bạn làm gì" | 4h |
| [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) | Checklist tự chấm | 1h |
| [05-cheatsheet.md](./05-cheatsheet.md) | Tra cứu nhanh | — |

---

## ⚠️ Đọc trước: macOS **không phải** Linux

Nếu bạn học trên máy Mac, phần lớn lệnh có tên giống nhau nhưng **hành xử khác**, vì macOS dùng BSD
còn server dùng GNU:

| Lệnh | macOS (BSD) | Linux (GNU) |
|------|-------------|-------------|
| `sed -i` | Cần tham số rỗng: `sed -i '' 's/a/b/'` | `sed -i 's/a/b/'` |
| `ps aux` | Cột khác, **không có** `--sort` | Có `--sort=-%mem` |
| `stat` | `stat -f "%Sp"` | `stat -c "%A"` |
| `free` | **Không có** | Có |
| `ss` | **Không có** | Có |
| `systemctl` / `journalctl` | **Không có** | Có |
| `readlink -f` | Không có | Có |
| `date -d "10 days ago"` | Không có (dùng `-v-10d`) | Có |

Gõ `sed -i 's/a/b/' file` trên Mac sẽ tạo ra file rác tên `file-e` thay vì sửa file. Học Linux trên Mac
mà không biết điều này là học nhầm.

**Cách học đúng — dựng container Linux để gõ thật:**

```bash
$ docker run -it --rm ubuntu:24.04 bash
```

Mọi output trong bộ tài liệu này đều chạy trong **Ubuntu 24.04.4 LTS** thật (kernel Linux 6.12,
`aarch64`), gồm cả một container có **systemd** thật để chạy `systemctl` và `journalctl`.

Bài [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) có lệnh dựng sẵn môi trường luyện tập.

---

## Ba nhóm câu hỏi Linux khi phỏng vấn backend

**Nhóm 1 — Bạn có từng lên server không?** (40%)
Quyền file, tiến trình, cổng đang mở, đọc log. Ai cũng bị hỏi.

**Nhóm 2 — Xử lý sự cố** (40%)
"Server đầy đĩa", "app bị kill", "port đã bị chiếm", "trang chậm". Nhóm này phân biệt người đã trực sự
cố thật và người chỉ đọc tài liệu.

**Nhóm 3 — Hiểu cơ chế** (20%)
Signal, PID 1, inode, load average, OOM killer. Trả lời được nhóm này thì nổi bật hẳn.

---

## Sáu câu hay gặp nhất

1. **Quyền `755` nghĩa là gì? Bit `x` trên *thư mục* khác trên *file* thế nào?**
2. **Làm sao biết tiến trình nào đang giữ cổng 8080?**
3. **`df` báo còn chỗ trống mà vẫn `No space left on device` — vì sao?**
4. **`kill` khác `kill -9` thế nào?**
5. **Cho một file log, tìm IP gọi nhiều nhất.** (bắt gõ tại chỗ)
6. **Server chậm, bạn gõ lệnh gì đầu tiên?**

Cả sáu có đáp án đầy đủ kèm output thật trong [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md).

---

## Cách trả lời

Linux là chủ đề mà **gõ được** quan trọng hơn **nói được**. Nhiều buổi phỏng vấn sẽ đưa bạn một terminal
và bảo "tìm giúp tôi...".

```
Tầng 1  Lệnh cụ thể (không phải "em sẽ kiểm tra log")
Tầng 2  Đọc output đó ra sao
Tầng 3  Bước tiếp theo dựa trên kết quả
```

Ví dụ với "server đầy đĩa":

> ❌ "Em sẽ xem chỗ nào chiếm nhiều rồi xoá."
>
> ✅ "Em chạy `df -h` xem phân vùng nào đầy, rồi `df -i` — vì nhiều khi còn dung lượng mà **hết inode**,
> triệu chứng giống hệt nhau. Nếu đúng là hết dung lượng thì `du -xh / | sort -rh | head` để tìm thư mục
> nặng. Nhưng nếu `du` cộng lại **nhỏ hơn** con số `df` báo, thì thường là có file đã bị `rm` mà vẫn bị
> tiến trình giữ — em kiểm tra bằng `lsof +L1`."

Câu thứ hai cho thấy bạn đã gặp thật.

---

## Lộ trình 5 ngày

| Ngày | Việc |
|------|------|
| 1 | [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) trước, rồi nhóm A–B của [01](./01-cau-hoi-va-dap-an.md) |
| 2 | Nhóm C–D (tiến trình, mạng) |
| 3 | Nhóm E–G (đĩa, bộ nhớ, text, systemd) + [02](./02-bai-tap-thuc-hanh.md) bài 1–10 |
| 4 | [02](./02-bai-tap-thuc-hanh.md) bài 11–20 — **gõ tay, không copy** |
| 5 | [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md), nói thành tiếng. Làm lại checklist |

---

Liên quan: [Docker](../docker/README.md) · [NestJS](../nestjs/README.md) · [Laravel](../laravel/README.md) · [Redis](../redis/README.md)
