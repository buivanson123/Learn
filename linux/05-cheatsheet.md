# Linux cheatsheet

Tra cứu nhanh. Mọi lệnh đã chạy thật trên Ubuntu 24.04 LTS.

---

## ⚠️ macOS vs Linux — khác biệt hay cắn

| Việc | macOS (BSD) | Linux (GNU) |
|------|-------------|-------------|
| Sửa file tại chỗ | `sed -i '' 's/a/b/' f` | `sed -i 's/a/b/' f` |
| Xem quyền dạng số | `stat -f "%Lp" f` | `stat -c "%a" f` |
| Sắp `ps` theo RAM | không có | `ps -eo ... --sort=-%mem` |
| In kích thước trong `find` | không có `-printf` | `find -printf '%s %p\n'` |
| Ngày tương đối | `date -v-10d` | `date -d "10 days ago"` |
| Bộ nhớ | `vm_stat` | `free -h` |
| Cổng đang nghe | `lsof -i -P` | `ss -tlnp` |
| Dịch vụ | `launchctl` | `systemctl` |

Học Linux thì gõ trong container: `docker run -it --rm ubuntu:24.04 bash`

---

## Quyền file

```bash
ls -l                     # xem quyền
ls -ld dir                # quyền của chính THƯ MỤC (không phải nội dung)
stat -c "%A %a %U:%G %n" f

chmod 644 f               # rw- r-- r--
chmod 755 f               # rwx r-x r-x
chmod 600 f               # rw- --- ---   (.env, khoá SSH)
chmod u+x f               # thêm quyền chạy cho chủ
chmod -R 775 dir/

chown user:group f
chown -R www-data:www-data storage/
chgrp group f

umask                     # 0022 → file mới 644, thư mục mới 755
```

### Bảng số

| Số | Chữ | Nghĩa |
|----|-----|-------|
| 7 | `rwx` | đọc + ghi + chạy |
| 6 | `rw-` | đọc + ghi |
| 5 | `r-x` | đọc + chạy |
| 4 | `r--` | chỉ đọc |
| 0 | `---` | không gì |

### ⭐ Trên THƯ MỤC, ý nghĩa khác hẳn

| Bit | Trên file | Trên thư mục |
|-----|-----------|--------------|
| `r` | Đọc nội dung | Liệt kê **tên** file bên trong |
| `w` | Sửa nội dung | Tạo/xoá/đổi tên file bên trong |
| `x` | Chạy được | **Truy cập** file bên trong (bắt buộc để `cd`) |

Không có `x` trên thư mục thì **không đọc được file bên trong dù file có quyền 644**.

### Bit đặc biệt

```bash
chmod 4755 f     # setuid  → chạy với quyền CHỦ file    (-rwsr-xr-x)
chmod 2775 dir   # setgid  → file mới thừa kế group     (drwxrwsr-x)
chmod 1777 dir   # sticky  → chỉ chủ file mới xoá được  (drwxrwxrwt)
```

---

## Người dùng

```bash
id son                          # uid, gid, groups
whoami
useradd -m -s /bin/bash son
usermod -aG deploy son          # ⚠️ QUÊN -a là xoá hết nhóm khác
groupadd deploy
passwd son
su - son                        # dấu - để nạp cả môi trường
sudo -u www-data command

grep "^son:" /etc/passwd        # tên:x:UID:GID:mô tả:home:shell
awk -F: '$3 == 0 {print $1}' /etc/passwd   # kiểm tra ai có UID 0
```

---

## Tiến trình

```bash
ps aux                                    # mọi tiến trình
ps -ef                                    # cú pháp UNIX
ps -eo pid,ppid,user,%cpu,%mem,rss,stat,comm --sort=-%mem | head
ps -p 1234 -o pid,lstart,cmd              # chạy từ khi nào

pgrep -a node                             # tìm theo tên
pkill -f "node dist/main"                 # kill theo dòng lệnh
pidof nginx
pstree -p

top                                       # M=RAM P=CPU 1=từng lõi k=kill
htop
```

### STAT

| Ký tự | Nghĩa |
|-------|-------|
| `R` | Đang chạy / sẵn sàng |
| `S` | Ngủ, chờ sự kiện |
| `D` | Ngủ **không ngắt được** (chờ I/O) — kill -9 cũng không được |
| `Z` | **Zombie** — đã chết, cha chưa dọn |
| `T` | Đã dừng |

### Tín hiệu

```bash
kill PID              # SIGTERM (15) — lịch sự, bẫy được
kill -9 PID           # SIGKILL — không bẫy được, biện pháp cuối
kill -HUP PID         # nạp lại config (nginx, sshd)
kill -l               # danh sách
```

| Số | Tên | Dùng khi |
|----|-----|----------|
| 1 | `SIGHUP` | Nạp lại cấu hình |
| 2 | `SIGINT` | Ctrl+C |
| 9 | `SIGKILL` | Giết cứng |
| 15 | `SIGTERM` | Thoát tử tế (mặc định) |

**Exit code:** `128 + số tín hiệu` → **137** = SIGKILL (OOM), **143** = SIGTERM.

### Chạy nền

```bash
command &            # nền (chết khi thoát shell)
nohup command &      # sống sau khi thoát
jobs / fg %1 / bg %1
tmux new -s deploy   # tốt nhất cho việc chạy lâu
```

---

## Mạng

```bash
ss -tlnp                  # ⭐ cổng đang NGHE + tiến trình
ss -tanp                  # mọi kết nối
ss -s                     # thống kê tổng
lsof -i :8080             # ai giữ cổng 8080
fuser 8080/tcp

ip a                      # địa chỉ IP (thay ifconfig)
ip -br a                  # dạng ngắn
ip r                      # bảng route

curl -sS URL
curl -i URL                                   # kèm header
curl -o /dev/null -w '%{http_code} %{time_total}s\n' URL
curl -X POST URL -H 'Content-Type: application/json' -d '{"a":1}'

nc -zv host 5432          # cổng có mở không (đáng tin hơn ping)
dig +short example.com
getent hosts example.com  # theo đúng cách hệ thống phân giải (tính /etc/hosts)
```

Cờ `ss`: `-t` TCP · `-u` UDP · `-l` đang nghe · `-n` **không tra DNS** · `-p` hiện tiến trình

⭐ **`127.0.0.1` vs `0.0.0.0`:** listen `127.0.0.1` chỉ nhận kết nối từ chính máy đó — nguyên nhân hay
gặp của "local chạy được mà server không vào được".

---

## Đĩa

```bash
df -h                                   # dung lượng
df -i                                   # ⭐ INODE — hết inode = "No space left" dù còn chỗ
du -sh /var/* | sort -rh | head -5
du -xh / 2>/dev/null | sort -rh | head -20    # -x: không sang phân vùng khác

lsof +L1                                # ⭐ file đã xoá mà còn bị giữ
ls -l /proc/PID/fd/                     # file descriptor của tiến trình

: > /var/log/app.log                    # ✅ cắt rỗng, giải phóng NGAY
truncate -s 0 /var/log/app.log          # ✅ tương đương
rm /var/log/app.log                     # ❌ đĩa không giảm nếu app đang mở
```

**`df` báo còn chỗ mà vẫn `No space left`** → hai nguyên nhân: hết **inode** (`df -i`), hoặc file đã
`rm` nhưng còn bị giữ (`lsof +L1`).

---

## Bộ nhớ

```bash
free -h
free -m
cat /proc/meminfo
vmstat 1 5                       # cột wa = CPU chờ I/O
```

⭐ **Nhìn cột `available`, không nhìn `free`.** Linux cố ý dùng RAM trống làm cache đĩa —
`buff/cache` lớn là bình thường và giải phóng được ngay.

### OOM killer

```bash
dmesg -T | grep -i "out of memory"
journalctl -k | grep -i oom
cat /sys/fs/cgroup/memory.events            # trong container
docker inspect X --format '{{.State.OOMKilled}} {{.State.ExitCode}}'
```

**Exit code 137** là chữ ký của OOM (128 + 9).

---

## Tải hệ thống

```bash
uptime                    # load average 1/5/15 phút
cat /proc/loadavg
nproc                     # ⭐ số lõi — để biết load bao nhiêu là cao
top                       # xem %wa (I/O wait)
iostat -x 1 3
iotop
```

**Load chia cho số lõi:** < 0.7 bình thường · ~1.0 dùng hết công suất · > 2.0 quá tải.

⭐ Load cao **không nhất thiết** là CPU bận — Linux tính cả tiến trình `D` (chờ I/O).

---

## Tìm file

```bash
find . -name "*.log" -type f
find . -name "*.log" -mtime +7            # sửa hơn 7 ngày trước
find . -mmin -30                          # sửa trong 30 phút qua
find / -xdev -type f -size +100M 2>/dev/null
find . -name "*.log" -print0 | xargs -0 rm      # ⭐ -print0 cho tên có dấu cách
find . -name "*.txt" -exec basename {} \;
find /var -xdev -type f -printf '%s %p\n' | sort -rn | head -5    # GNU only
```

**Luôn `-print` kiểm tra trước khi `-delete`.**

---

## Văn bản và log

```bash
grep -c "401" access.log            # đếm dòng khớp
grep -n "500" access.log            # kèm số dòng
grep -i "error" app.log             # không phân biệt hoa thường
grep -v "healthcheck" app.log       # loại bỏ
grep -r "DB_HOST" /etc              # đệ quy
grep -rl "DB_HOST" /etc             # chỉ in TÊN FILE
grep -A3 -B3 "Exception" app.log    # ⭐ 3 dòng trước/sau (đọc stack trace)
grep -E "40[13]" access.log

sed -i 's/^DB_HOST=.*/DB_HOST=postgres/' .env
sed -n '2,4p' file                  # in dòng 2-4
sed '/^#/d' config.conf             # bỏ comment

tail -f app.log
tail -n 200 -f app.log
less +F app.log                     # như tail -f nhưng cuộn lại được (F để chảy tiếp)
```

### ⭐ Mẫu phân tích log quan trọng nhất

```bash
# Bước 0 — ĐẾM CỘT TRƯỚC, đừng đoán
head -1 access.log | awk '{for(i=1;i<=NF;i++) printf "$%d=%s\n", i, $i}'

# Đếm theo giá trị cột
awk '{print $8}' access.log | sort | uniq -c | sort -rn

# Top IP
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head

# Lọc theo điều kiện
awk '$8 ~ /^5/ {print $1, $6, $8}' access.log
awk '$10 > 1 {print $6, $10"s"}' access.log

# Tính tổng / trung bình
awk '{b+=$9; t+=$10; n++} END {printf "tong=%d tb=%.3fs n=%d\n", b, t/n, n}' access.log

# Dò mật khẩu?
awk '$8==401 {print $1}' access.log | sort | uniq -c | sort -rn
```

`uniq -c` chỉ gộp dòng **liền kề** → **bắt buộc** `sort` trước.

---

## systemd

```bash
systemctl status blogapi --no-pager
systemctl start / stop / restart blogapi
systemctl reload blogapi                  # nạp lại config, không dừng
systemctl enable --now blogapi            # ⭐ enable = chạy lúc boot; start = chạy ngay
systemctl is-enabled blogapi
systemctl daemon-reload                   # ⭐ BẮT BUỘC sau khi sửa file .service
systemctl list-units --type=service --state=running
systemctl show -p MainPID --value blogapi
systemctl show -p NRestarts --value blogapi
```

### File service tối thiểu

```ini
# /etc/systemd/system/blogapi.service
[Unit]
Description=Blog API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/blog
ExecStart=/usr/bin/node /opt/blog/dist/main.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### journalctl

```bash
journalctl -u blogapi -f                  # theo dõi thời gian thực
journalctl -u blogapi -n 50 --no-pager
journalctl -u blogapi --since "1 hour ago"
journalctl -u blogapi -p err              # chỉ error trở lên
journalctl -k                             # log kernel (tìm OOM)
journalctl --disk-usage
journalctl --vacuum-time=7d
```

---

## Cron

```
 ┌── phút (0-59)
 │ ┌── giờ (0-23)
 │ │ ┌── ngày (1-31)
 │ │ │ ┌── tháng (1-12)
 │ │ │ │ ┌── thứ (0-7, 0 và 7 = CN)
 * * * * *  lệnh
```

```bash
crontab -e / -l / -r
systemctl status cron
grep CRON /var/log/syslog | tail
```

```
*/5 * * * *    mỗi 5 phút
0 3 * * *      3h sáng hằng ngày
0 3 * * 0      3h sáng Chủ nhật
0 */6 * * *    mỗi 6 tiếng
```

### ⭐ Ba bẫy

1. **PATH hẹp** → dùng đường dẫn tuyệt đối: `/usr/bin/php`
2. **Không có output** → luôn thêm `>> /var/log/x.log 2>&1`
3. **Dấu `%` đặc biệt** → escape thành `\%` (hay gặp với `date +%Y`)

---

## Shell script

```bash
#!/usr/bin/env bash
set -euo pipefail          # ⭐ dòng quan trọng nhất

readonly DIR="${1:-/var/www}"
[[ -d "$DIR" ]] || { echo "Không thấy $DIR" >&2; exit 1; }

for f in "$DIR"/*.log; do
  [[ -e "$f" ]] || continue
  echo "Xử lý $f"
done
```

| Cờ | Tác dụng |
|----|----------|
| `-e` | Dừng ngay khi lệnh lỗi |
| `-u` | Lỗi khi dùng biến chưa khai |
| `-o pipefail` | Pipeline lỗi nếu **bất kỳ** lệnh nào lỗi |

**Luôn đặt biến trong nháy kép** `"$VAR"` — không có thì tên có dấu cách bị tách.

---

## Nén và sao lưu

```bash
tar -czf backup.tar.gz /var/www          # nén
tar -xzf backup.tar.gz -C /restore       # giải nén
tar -tzf backup.tar.gz                   # xem nội dung, không giải

rsync -avz --progress src/ user@host:/dst/
rsync -avz --delete src/ dst/            # ⚠️ --delete xoá file thừa ở đích

pg_dump -U blog blog > backup.sql        # ✅ sao lưu DB đúng cách
```

⚠️ Chép file dữ liệu database khi nó đang chạy có thể ra bản sao hỏng — dùng công cụ của database.

---

## SSH

```bash
ssh -v user@host                    # -v để xem quá trình bắt tay
ssh -p 2222 user@host
ssh-keygen -t ed25519 -C "email"
ssh-copy-id user@host
scp file user@host:/path/

chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa             # ⭐ SSH TỪ CHỐI nếu quá lỏng
chmod 644 ~/.ssh/id_rsa.pub
chmod 600 ~/.ssh/authorized_keys
```

| Lỗi | Nguyên nhân |
|-----|-------------|
| `Connection refused` | sshd không chạy / sai cổng |
| `Connection timed out` | Firewall chặn |
| `Permission denied (publickey)` | Sai khoá hoặc quyền file sai |
| `Permissions 0644 ... too open` | `chmod 600` khoá riêng |

---

## Bảng tra sự cố

| Triệu chứng | Lệnh đầu tiên |
|-------------|---------------|
| Hết đĩa | `df -h` → `df -i` → `du -xh /` → `lsof +L1` |
| App chết im lặng | `dmesg -T \| grep -i oom` (exit 137?) |
| Port bị chiếm | `ss -tlnp \| grep :PORT` |
| 502 | `curl 127.0.0.1:PORT` (bỏ qua nginx) |
| Server chậm | `uptime` + `nproc` → `top` xem `%wa` |
| SSH hỏng | `nc -zv host 22` |
| Cron không chạy | `grep CRON /var/log/syslog` |
| Không start sau reboot | `systemctl is-enabled X` |
| Chạy code cũ | `ps -eo pid,lstart,cmd` |

---

Quay lại [README](./README.md) · [Tự kiểm tra](./04-tu-kiem-tra.md)
