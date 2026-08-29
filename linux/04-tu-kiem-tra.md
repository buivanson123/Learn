# Tự kiểm tra Linux

Với mỗi dòng: **"Tôi gõ được lệnh này không nhìn tài liệu, và đọc được output không?"**

✅ được · ⚠️ lơ mơ · ❌ không

Ngưỡng đi phỏng vấn backend: **không còn ❌ ở nhóm A–D**.

⚠️ Với Linux, "biết có lệnh đó" **không tính là ✅**. Phải gõ được và đọc được output.

---

## A. File và quyền

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Đọc `-rw-r--r--` thành 3 nhóm quyền | [01 A1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Đổi `755`/`644`/`600` sang dạng chữ và ngược lại | [01 A2](./01-cau-hoi-va-dap-an.md) |
| ☐ | **Bit `x` trên thư mục khác trên file thế nào** | [01 A3](./01-cau-hoi-va-dap-an.md) |
| ☐ | Bit `r` trên thư mục cho phép gì (và không cho phép gì) | [01 A3](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao `w` trên thư mục cho phép xoá file mình không sở hữu | [01 A3](./01-cau-hoi-va-dap-an.md) |
| ☐ | Sticky bit và vì sao `/tmp` cần nó | [01 A5](./01-cau-hoi-va-dap-an.md) |
| ☐ | setuid (`passwd`) và setgid trên thư mục | [01 A6](./01-cau-hoi-va-dap-an.md) |
| ☐ | `umask` — cách tính `666 - 022 = 644` | [01 A7](./01-cau-hoi-va-dap-an.md) |
| ☐ | Hard link vs symlink | [01 A9](./01-cau-hoi-va-dap-an.md) |
| ☐ | Inode là gì, **không** chứa tên file | [01 A10](./01-cau-hoi-va-dap-an.md) |
| ☐ | Quyền đúng cho `.env` và khoá SSH | [01 A12](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao `chmod 777` gần như luôn sai | [01 A4](./01-cau-hoi-va-dap-an.md) |

---

## B. Tiến trình và tín hiệu

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | `ps aux` — đọc cột `RSS` vs `VSZ` | [01 C1](./01-cau-hoi-va-dap-an.md) |
| ☐ | `ps -eo ... --sort=-%mem` (chỉ có ở GNU) | [01 C1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Cột `STAT`: `R`, `S`, `D`, `Z`, `T` | [01 C2](./01-cau-hoi-va-dap-an.md) |
| ☐ | Nhiều tiến trình `D` nghĩa là gì | [01 C2](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`kill` vs `kill -9`** — cái nào bẫy được | [01 C3](./01-cau-hoi-va-dap-an.md) |
| ☐ | 5 tín hiệu hay dùng và số của chúng | [01 C4](./01-cau-hoi-va-dap-an.md) |
| ☐ | **Zombie là gì, kill được không** | [01 C5](./01-cau-hoi-va-dap-an.md) |
| ☐ | Orphan là gì, khác zombie chỗ nào | [01 C6](./01-cau-hoi-va-dap-an.md) |
| ☐ | **PID 1 đặc biệt ở chỗ nào** — liên quan Docker | [01 C7](./01-cau-hoi-va-dap-an.md) |
| ☐ | `pgrep` / `pkill -f` và bẫy của nó | [01 C8](./01-cau-hoi-va-dap-an.md) |
| ☐ | **Load average — chia cho số lõi** | [01 C10](./01-cau-hoi-va-dap-an.md) |
| ☐ | Load cao ≠ CPU bận (tính cả `D`, chờ I/O) | [01 C10](./01-cau-hoi-va-dap-an.md) |

---

## C. Mạng

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Tìm tiến trình giữ cổng bằng 3 cách** | [01 D1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Nghĩa các cờ `-t -l -n -p` của `ss` | [01 D1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao luôn thêm `-n` | [01 D1](./01-cau-hoi-va-dap-an.md) |
| ☐ | `ss` thay `netstat`; `ip a` thay `ifconfig` | [01 D2](./01-cau-hoi-va-dap-an.md) |
| ☐ | `curl -w` để lấy mã trạng thái + thời gian | [01 D5](./01-cau-hoi-va-dap-an.md) |
| ☐ | `nc -zv` kiểm tra cổng (đáng tin hơn `ping`) | [01 D3](./01-cau-hoi-va-dap-an.md) |
| ☐ | `getent hosts` khác `dig` (tính cả `/etc/hosts`) | [01 D4](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`127.0.0.1` vs `0.0.0.0` khi listen** | [01 D8](./01-cau-hoi-va-dap-an.md) |

---

## D. Đĩa và bộ nhớ

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | `df -h` và `du -xh ... \| sort -rh` | [01 E1–E2](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`df -i` — hết inode cho triệu chứng y hệt hết đĩa** | [01 E3](./01-cau-hoi-va-dap-an.md) |
| ☐ | **File đã `rm` mà đĩa không giảm — vì sao, tìm bằng `lsof +L1`** | [01 E3](./01-cau-hoi-va-dap-an.md) |
| ☐ | `: > file.log` thay vì `rm` | [01 E9](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`free -h`: nhìn `available`, không nhìn `free`** | [01 E4](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao `buff/cache` lớn là bình thường | [01 E4](./01-cau-hoi-va-dap-an.md) |
| ☐ | **OOM killer — exit code 137, tìm bằng `dmesg`** | [01 E5](./01-cau-hoi-va-dap-an.md) |
| ☐ | Swap: nên bật không, `vm.swappiness` | [01 E6](./01-cau-hoi-va-dap-an.md) |
| ☐ | `/proc/<PID>/fd/`, `/proc/<PID>/environ` | [01 E8](./01-cau-hoi-va-dap-an.md) |

---

## E. Xử lý log — hay bị bắt gõ tại chỗ

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Đếm cột trước bằng `awk` trước khi viết lệnh** | [01 F](./01-cau-hoi-va-dap-an.md) |
| ☐ | **Mẫu `sort \| uniq -c \| sort -rn`** | [01 F1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao `uniq -c` bắt buộc có `sort` trước | [01 F1](./01-cau-hoi-va-dap-an.md) |
| ☐ | `awk '$8 ~ /^5/'` lọc theo điều kiện cột | [01 F3](./01-cau-hoi-va-dap-an.md) |
| ☐ | `awk '{s+=$9} END {print s}'` tính tổng | [01 F5](./01-cau-hoi-va-dap-an.md) |
| ☐ | `grep -A -B -C` để đọc stack trace | [01 F7](./01-cau-hoi-va-dap-an.md) |
| ☐ | `grep -v` loại bỏ, `grep -rl` chỉ in tên file | [01 F7](./01-cau-hoi-va-dap-an.md) |
| ☐ | `sed -i` sửa file tại chỗ (khác nhau BSD/GNU) | [01 F8](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`find -print0 \| xargs -0` và vì sao cần** | [01 F9](./01-cau-hoi-va-dap-an.md) |
| ☐ | `find -mtime +7`, `-size +100M`, `-xdev` | [01 F9](./01-cau-hoi-va-dap-an.md) |
| ☐ | `less +F` tốt hơn `tail -f` chỗ nào | [01 F10](./01-cau-hoi-va-dap-an.md) |

---

## F. systemd, cron, shell

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Viết được file `.service` tối thiểu | [01 G1](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`daemon-reload` sau khi sửa file service** | [01 G1](./01-cau-hoi-va-dap-an.md) |
| ☐ | **`enable` khác `start`** | [01 G1](./01-cau-hoi-va-dap-an.md) |
| ☐ | `Restart=on-failure` + `RestartSec` | [01 G2](./01-cau-hoi-va-dap-an.md) |
| ☐ | `journalctl -u X -f`, `--since`, `-p err`, `-k` | [01 G3](./01-cau-hoi-va-dap-an.md) |
| ☐ | 5 trường của cron | [01 G4](./01-cau-hoi-va-dap-an.md) |
| ☐ | **3 bẫy của cron: PATH, `2>&1`, dấu `%`** | [01 G4](./01-cau-hoi-va-dap-an.md) |
| ☐ | `set -euo pipefail` — từng cờ làm gì | [01 G5](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao luôn đặt biến trong nháy kép | [01 G5](./01-cau-hoi-va-dap-an.md) |

---

## G. Xử lý sự cố — nói được thành lời không?

| | Tình huống |
|---|---|
| ☐ | Hết đĩa — 5 bước, gồm cả `df -i` và `lsof +L1` |
| ☐ | App chết im lặng — nghi OOM trước, exit code 137 |
| ☐ | Port bị chiếm — kiểm tra tiến trình **trước khi** kill |
| ☐ | 502 vs 504 khác nhau thế nào |
| ☐ | Server chậm — phân loại nút thắt trước khi đào sâu |
| ☐ | SSH hỏng — 4 thông báo lỗi và nguyên nhân tương ứng |
| ☐ | Cron không chạy — 3 nguyên nhân |
| ☐ | Deploy xong chạy code cũ — kiểm tra `ps -eo lstart` |
| ☐ | Log phình 50GB — cắt rỗng chứ không `rm` |
| ☐ | 3 câu hỏi ngược nên hỏi khi nhận sự cố |

---

## H. Gõ được không?

Mở container Linux, bấm giờ 5 phút, làm không nhìn tài liệu:

| | Bài |
|---|---|
| ☐ | Tìm 5 file lớn nhất trong `/var`, không sang phân vùng khác |
| ☐ | Đếm request theo mã trạng thái trong một access log |
| ☐ | Tìm IP gọi nhiều nhất + IP đăng nhập sai nhiều nhất |
| ☐ | Tìm tiến trình giữ cổng 3000 và kill tử tế |
| ☐ | Xoá mọi `.log` cũ hơn 7 ngày — **in ra trước khi xoá** |
| ☐ | Đổi `DB_HOST` trong mọi `.env` (kể cả đường dẫn có dấu cách) |
| ☐ | Viết file `.service` + `enable --now` + xem log |

Đủ bộ ở [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md).

---

## Chấm

| Kết quả | Nghĩa |
|---------|-------|
| A hoặc B còn ❌ | **Chưa nên đi phỏng vấn.** Quyền và tiến trình là nhóm ai cũng bị hỏi |
| C hoặc D còn ❌ | Ưu tiên — đây là nhóm "bạn đã từng lên server chưa" |
| E còn ❌ | **Nguy hiểm.** Phân tích log hay bị bắt gõ tại chỗ |
| F còn ⚠️ | Chấp nhận được nếu bạn dùng Docker thay vì systemd |
| G còn ❌ | Ôn [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md), **nói thành tiếng** |
| H còn ❌ | Đi gõ. Đọc không thay được gõ |

---

| Lần | Ngày | ❌ | ⚠️ | Nhóm yếu nhất |
|-----|------|----|----|----|
| 1 | | | | |
| 2 | | | | |

---

Quay lại [README](./README.md) · [Cheatsheet](./05-cheatsheet.md)
