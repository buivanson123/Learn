# 20 bài tập Linux — gõ tay trong container thật

Đọc về Linux không làm bạn gõ được Linux. Bộ này bắt bạn **gõ**.

Quy tắc: **không copy-paste lệnh trong phần đáp án**. Gõ tay, gõ sai, đọc thông báo lỗi. Đó mới là thứ
bạn nhớ được khi ngồi trước terminal của người phỏng vấn.

---

## Dựng môi trường luyện tập

⚠️ Đừng làm trên máy Mac — nhiều lệnh khác hoặc không có (xem [README](./README.md)).

```bash
$ docker run -dit --name lab ubuntu:24.04 bash
$ docker exec -it lab bash
```

Cài công cụ (ảnh Ubuntu gốc rất tối giản):

```bash
apt-get update -qq
apt-get install -y -qq iproute2 net-tools lsof curl dnsutils procps psmisc python3 tree less vim
```

Kiểm tra bạn đang ở Linux thật:

```bash
$ uname -a
Linux e39aa586883e 6.12.76-linuxkit #1 SMP ... aarch64 GNU/Linux

$ cat /etc/os-release | head -2
PRETTY_NAME="Ubuntu 24.04.4 LTS"
NAME="Ubuntu"
```

Dựng dữ liệu mẫu:

```bash
mkdir -p /tmp/lab && cd /tmp/lab

cat > access.log <<'EOF'
10.0.0.1 - - [19/Aug/2026:10:00:01] "GET /api/posts HTTP/1.1" 200 1024 0.120
10.0.0.2 - - [19/Aug/2026:10:00:02] "POST /api/login HTTP/1.1" 401 89 0.045
10.0.0.1 - - [19/Aug/2026:10:00:03] "GET /api/posts/1 HTTP/1.1" 200 512 0.089
10.0.0.3 - - [19/Aug/2026:10:00:04] "GET /api/users HTTP/1.1" 500 120 2.340
10.0.0.2 - - [19/Aug/2026:10:00:05] "POST /api/login HTTP/1.1" 401 89 0.041
10.0.0.2 - - [19/Aug/2026:10:00:06] "POST /api/login HTTP/1.1" 401 89 0.038
10.0.0.4 - - [19/Aug/2026:10:00:07] "GET /api/posts HTTP/1.1" 200 1024 0.156
10.0.0.3 - - [19/Aug/2026:10:00:08] "GET /api/users HTTP/1.1" 500 120 3.100
10.0.0.2 - - [19/Aug/2026:10:00:09] "POST /api/login HTTP/1.1" 200 256 0.201
EOF

useradd -m son; useradd -m mai; groupadd deploy
```

Xong việc thì dọn:

```bash
$ docker rm -f lab
```

---

## Nhóm 1 — File và quyền (bài 1–5)

### Bài 1 — Đọc và đổi quyền

**Đề:** Tạo `secret.txt`, đặt quyền sao cho **chỉ chủ sở hữu** đọc/ghi được. Xác nhận bằng hai cách
(dạng chữ và dạng số).

<details><summary>Đáp án</summary>

```bash
$ touch secret.txt
$ chmod 600 secret.txt
$ stat -c "%A %a %n" secret.txt
-rw------- 600 secret.txt
```

`600` là quyền chuẩn cho `.env`, khoá SSH, file chứa mật khẩu.
</details>

### Bài 2 ⭐ — Chứng minh bit `x` của thư mục

**Đề:** Tạo thư mục `d` chứa `f.txt` (quyền 644). Bỏ bit `x` của **thư mục**. Với user `son`, thử
`cat d/f.txt`. Giải thích kết quả. Rồi thử `ls d`.

<details><summary>Đáp án</summary>

```bash
$ mkdir d && echo "noi dung" > d/f.txt && chmod 644 d/f.txt
$ chmod 644 d
$ su son -c "cat /tmp/lab/d/f.txt"
cat: /tmp/lab/d/f.txt: Permission denied

$ su son -c "ls /tmp/lab/d"
f.txt                         ← THẤY TÊN nhưng không đọc được nội dung

$ chmod 755 d
$ su son -c "cat /tmp/lab/d/f.txt"
noi dung
```

File `f.txt` không đổi quyền lần nào. Trên **thư mục**: `r` cho phép liệt kê tên, `x` cho phép truy cập
nội dung. Muốn đọc file phải có `x` trên **mọi thư mục** trên đường dẫn.
</details>

### Bài 3 — umask

**Đề:** Xem `umask` hiện tại, tạo một file và ghi lại quyền. Đổi `umask` thành `077`, tạo file khác,
so sánh. Giải thích cách tính.

<details><summary>Đáp án</summary>

```bash
$ umask
0022
$ touch new1 && stat -c "%a %n" new1
644 new1

$ umask 077 && touch new2 && stat -c "%a %n" new2
600 new2
```

File mới mặc định `666`; `666 - 022 = 644`, `666 - 077 = 600`. Thư mục mặc định `777` nên
`777 - 022 = 755`.
</details>

### Bài 4 — setgid

**Đề:** Tạo hai thư mục cùng thuộc group `deploy`, một có setgid một không. Tạo file trong mỗi thư mục
và so sánh group của file.

<details><summary>Đáp án</summary>

```bash
$ mkdir sg sg2 && chgrp deploy sg sg2
$ chmod 2775 sg && chmod 775 sg2
$ ls -ld sg
drwxrwsr-x 2 root deploy 4096 ... sg
      ↑ s = setgid

$ touch sg/a.txt sg2/b.txt
$ ls -l sg/a.txt sg2/b.txt
-rw-r--r-- 1 root deploy 0 ... sg/a.txt      ← thừa kế group thư mục
-rw-r--r-- 1 root root   0 ... sg2/b.txt     ← group của người tạo
```

Dùng cho thư mục deploy chung nhiều người — mọi file mới đều thuộc đúng group.
</details>

### Bài 5 — Tìm file theo điều kiện

**Đề:** Tìm mọi file `.log` trong `/tmp/lab` sửa **hơn 7 ngày trước**. Rồi tìm mọi file lớn hơn 10MB
trong `/usr` (không sang phân vùng khác).

<details><summary>Đáp án</summary>

```bash
$ touch -d "10 days ago" old.log
$ find . -name "*.log" -type f -mtime +7
./old.log

$ find /usr -xdev -type f -size +10M 2>/dev/null | head -3
/usr/lib/aarch64-linux-gnu/libicudata.so.74.2
```

`-xdev` ngăn `find` đi sang mount khác — quan trọng khi quét từ `/`.
</details>

---

## Nhóm 2 — Tiến trình (bài 6–10)

### Bài 6 — Đọc `ps`

**Đề:** Liệt kê 5 tiến trình ngốn RAM nhất, hiện PID, PPID, user, RSS, STAT.

<details><summary>Đáp án</summary>

```bash
$ ps -eo pid,ppid,user,%cpu,%mem,rss,stat,comm --sort=-%mem | head -6
  PID  PPID USER     %CPU %MEM   RSS STAT COMMAND
 2845     0 root      0.0  0.0  3008 Ss   bash
    1     0 root      0.0  0.0  1220 Ss   sleep
```

Nhìn `RSS` (RAM thật), không nhìn `VSZ` (bộ nhớ ảo, thường lớn vô nghĩa).
</details>

### Bài 7 ⭐ — SIGTERM vs SIGKILL

**Đề:** Viết script bẫy `SIGTERM` và in thông báo trước khi thoát. Chạy nền, gửi `SIGTERM`, quan sát.
Rồi lặp lại với `SIGKILL`.

<details><summary>Đáp án</summary>

```bash
$ cat > trap.sh <<'EOF'
#!/bin/bash
trap 'echo "[app] nhan SIGTERM, dang dong tu te..."; sleep 1; echo "[app] da thoat sach"; exit 0' TERM
echo "[app] dang chay, PID=$$"
while true; do sleep 0.2; done
EOF
$ chmod +x trap.sh

$ ./trap.sh & P=$!; sleep 0.5; kill -TERM $P; wait $P
[app] dang chay, PID=2867
[app] nhan SIGTERM, dang dong tu te...
[app] da thoat sach

$ ./trap.sh & P=$!; sleep 0.5; kill -KILL $P; wait $P
[app] dang chay, PID=2873
(khong in gi ca)
```

`SIGKILL` không bẫy được — kernel giết ngay. Đây là lý do `docker stop` gửi SIGTERM trước, chờ 10 giây,
rồi mới SIGKILL.
</details>

### Bài 8 ⭐ — Tạo zombie

**Đề:** Tạo một tiến trình zombie và tìm nó bằng `ps`. Thử `kill -9` nó — có tác dụng không?

<details><summary>Đáp án</summary>

```bash
$ bash -c "sleep 30 & exec sleep 0.3" &
$ sleep 1
$ ps -eo pid,ppid,stat,comm | awk '$3 ~ /^Z/ {print}'
 2877     1 Z    sleep
```

`kill -9` **không** có tác dụng — zombie đã chết rồi, nó chỉ là một ô trong bảng tiến trình chờ cha thu
dọn. Cách sửa là kill/sửa **tiến trình cha**.
</details>

### Bài 9 — Tiến trình mồ côi

**Đề:** Tạo tiến trình con sống lâu hơn cha. Xem PPID của nó đổi thành gì.

<details><summary>Đáp án</summary>

```bash
$ bash -c '(sleep 30 &) ; exit'
$ ps -eo pid,ppid,comm | grep sleep
 2891     1 sleep       ← PPID = 1
```

PID 1 nhận nuôi mọi tiến trình mồ côi. Khác zombie: orphan **còn sống**.
</details>

### Bài 10 — Tìm và kill theo tên

**Đề:** Chạy `sleep 300` ở nền, tìm nó bằng `pgrep`, kill tử tế bằng `pkill`.

<details><summary>Đáp án</summary>

```bash
$ sleep 300 &
$ pgrep -a sleep
3421 sleep 300
$ pkill -f "sleep 300"
```

⚠️ `pkill -f` khớp toàn bộ dòng lệnh — chuỗi quá chung sẽ kill nhầm. Luôn `pgrep -a` để xem trước.
</details>

---

## Nhóm 3 — Mạng (bài 11–13)

### Bài 11 ⭐⭐ — Tìm tiến trình giữ cổng

**Đề:** Chạy một web server ở cổng 8080. Tìm PID đang giữ cổng đó bằng **ba** cách khác nhau.

<details><summary>Đáp án</summary>

```bash
$ python3 -m http.server 8080 &

$ ss -tlnp
LISTEN 0 5  0.0.0.0:8080  0.0.0.0:*  users:(("python3",pid=3142,fd=3))

$ lsof -i :8080
COMMAND  PID USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME
python3 3142 root    3u  IPv4 1569272      0t0  TCP *:http-alt (LISTEN)

$ fuser 8080/tcp
8080/tcp:             3142
```

Cả ba ra PID 3142. `ss -tlnp` là cách nhanh nhất; nhớ `-n` để không tra DNS.
</details>

### Bài 12 — Kiểm tra dịch vụ có phản hồi

**Đề:** Dùng `curl` lấy **chỉ** mã trạng thái và thời gian phản hồi của `http://localhost:8080/`.

<details><summary>Đáp án</summary>

```bash
$ curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' http://localhost:8080/
200 0.001s
```

`-o /dev/null` vứt body, `-w` chọn chỉ số cần. Hữu ích khi đo TTFB: `%{time_starttransfer}`.
</details>

### Bài 13 — 127.0.0.1 vs 0.0.0.0

**Đề:** Chạy server chỉ nghe `127.0.0.1`, rồi thử gọi từ ngoài container. Giải thích.

<details><summary>Đáp án</summary>

```bash
$ python3 -m http.server 8081 --bind 127.0.0.1 &
$ ss -tlnp | grep 8081
LISTEN 0 5  127.0.0.1:8081  0.0.0.0:*
```

Từ trong container `curl localhost:8081` chạy được; từ ngoài (kể cả `docker exec` sang network khác)
thì không. Đây là nguyên nhân rất hay gặp của "local chạy được mà server không vào được".
</details>

---

## Nhóm 4 — Đĩa và bộ nhớ (bài 14–16)

### Bài 14 ⭐⭐ — File đã xoá mà đĩa không giảm

**Đề:** Tạo file 200MB, mở nó bằng file descriptor, `rm` nó, rồi kiểm tra `df`. Giải thích. Tìm file đó
bằng `lsof`.

<details><summary>Đáp án</summary>

```bash
$ dd if=/dev/zero of=/tmp/big.log bs=1M count=200
$ df -h /tmp | tail -1
overlay  912G   21G  846G   3% /

$ exec 9< /tmp/big.log
$ rm /tmp/big.log
$ df -h /tmp | tail -1
overlay  912G   21G  846G   3% /      ← KHÔNG giảm

$ ls -l /proc/$$/fd/9
lr-x------ 1 root root 64 ... /proc/3182/fd/9 -> /tmp/big.log (deleted)

$ lsof +L1
COMMAND  PID USER FD TYPE DEVICE SIZE/OFF NLINK  NODE NAME
bash    3299 root  8r  REG   0,57 52428800     0 ... /tmp/gone.bin (deleted)

$ exec 9<&-
$ df -h /tmp | tail -1
overlay  912G   20G  846G   3% /      ← giờ mới giảm
```

Trong thực tế: ai đó `rm` file log lớn trong khi app vẫn đang ghi. Đĩa không giảm cho tới khi restart
dịch vụ. Cách đúng là `: > file.log` (cắt rỗng) thay vì `rm`.
</details>

### Bài 15 — Inode

**Đề:** So sánh `df -h` và `df -i`. Giải thích khi nào `df -h` còn chỗ mà vẫn không tạo được file.

<details><summary>Đáp án</summary>

```bash
$ df -h | head -2
Filesystem      Size  Used Avail Use% Mounted on
overlay         912G   20G  846G   3% /

$ df -i | head -2
Filesystem       Inodes   IUsed    IFree IUse% Mounted on
overlay        60710912 1102876 59608036    2% /
```

Mỗi file cần một inode. `IUse%` = 100% → hết inode → `No space left on device` **dù còn dung lượng**.
Thường do hàng triệu file nhỏ: session PHP, cache, log chia nhỏ.
</details>

### Bài 16 ⭐ — OOM killer

**Đề:** Dựng container giới hạn 64MB RAM, cho một tiến trình ngốn RAM đến khi bị giết. Ghi lại exit code
và bằng chứng OOM.

<details><summary>Đáp án</summary>

```bash
$ docker run -d --name oom --memory=64m --memory-swap=64m ubuntu:24.04 sleep infinity
$ docker exec oom cat /sys/fs/cgroup/memory.max
67108864

$ docker exec oom bash -c 'tail /dev/zero; echo "exit code: $?"'
Killed
exit code: 137

$ docker exec oom cat /sys/fs/cgroup/memory.events
oom 9
oom_kill 2
```

**137 = 128 + 9** → bị `SIGKILL`. Đây chính là exit code khi container Docker bị OOM. Trên máy thật xem
bằng `dmesg -T | grep -i "out of memory"`.
</details>

---

## Nhóm 5 — Log và văn bản (bài 17–20)

### Bài 17 ⭐⭐ — Phân tích log cơ bản

**Đề:** Với `access.log`, trả lời: (a) mỗi mã trạng thái bao nhiêu request, (b) IP nào gọi nhiều nhất.

<details><summary>Đáp án</summary>

**Bước 0 — đếm cột trước, đừng đoán:**

```bash
$ head -1 access.log | awk '{for(i=1;i<=NF;i++) printf "$%d=%s\n", i, $i}'
$1=10.0.0.1
$8=200
$10=0.120
```

```bash
# (a)
$ awk '{print $8}' access.log | sort | uniq -c | sort -rn
      4 200
      3 401
      2 500

# (b)
$ awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -3
      4 10.0.0.2
      2 10.0.0.3
      2 10.0.0.1
```

`sort | uniq -c | sort -rn` là mẫu quan trọng nhất. `uniq -c` chỉ gộp dòng **liền kề** nên bắt buộc
phải `sort` trước.
</details>

### Bài 18 ⭐ — Tìm dấu hiệu tấn công

**Đề:** Tìm IP nào đăng nhập sai (401) nhiều nhất. Đó có phải dò mật khẩu không?

<details><summary>Đáp án</summary>

```bash
$ awk '$8==401 {print $1}' access.log | sort | uniq -c | sort -rn
      3 10.0.0.2

$ grep "10.0.0.2" access.log | awk '{print $4, $8}'
[19/Aug/2026:10:00:02] 401
[19/Aug/2026:10:00:05] 401
[19/Aug/2026:10:00:06] 401
[19/Aug/2026:10:00:09] 200
```

Sai 3 lần trong 4 giây rồi thành công — đáng ngờ. Việc cần làm: bật rate limit cho endpoint login, và
kiểm tra tài khoản đó có bị lộ không.
</details>

### Bài 19 — Request chậm và thống kê

**Đề:** Tìm mọi request chậm hơn 1 giây. Rồi tính tổng byte và thời gian phản hồi trung bình.

<details><summary>Đáp án</summary>

```bash
$ awk '$10 > 1 {print $6, $10"s"}' access.log
/api/users 2.340s
/api/users 3.100s

$ awk '{b+=$9; t+=$10; n++} END {printf "tong byte=%d, tb=%.3fs, n=%d\n", b, t/n, n}' access.log
tong byte=3323, tb=0.681s, n=9
```

Cả hai request chậm đều là `/api/users` và đều trả 500 — endpoint đó đang hỏng, không phải mạng chậm.
</details>

### Bài 20 — find + xargs + sed

**Đề:** Tạo vài file `.env` chứa `DB_HOST=localhost`, kể cả một file trong thư mục **có dấu cách trong
tên**. Đổi hết thành `DB_HOST=postgres` bằng một lệnh.

<details><summary>Đáp án</summary>

```bash
$ mkdir -p "/tmp/lab/my app" && echo "DB_HOST=localhost" > "/tmp/lab/my app/.env"
$ echo "DB_HOST=localhost" > /tmp/lab/.env

$ find /tmp/lab -name ".env" -type f -print0 | xargs -0 sed -i 's/^DB_HOST=localhost/DB_HOST=postgres/'
$ find /tmp/lab -name ".env" -type f -exec cat {} \;
DB_HOST=postgres
DB_HOST=postgres
```

**Không có `-print0`/`-0`** thì thư mục `my app` bị tách thành hai tham số và lệnh hỏng:

```
sed: can't read /tmp/lab/my: No such file or directory
sed: can't read app/.env: No such file or directory
```

Đây là lý do luôn dùng `-print0 | xargs -0`.

⚠️ Trên macOS phải là `sed -i '' 's/.../.../'`.
</details>

---

## Tự chấm

| Làm được | Nghĩa |
|----------|-------|
| 18–20 bài không nhìn đáp án | Sẵn sàng cho phần thực hành khi phỏng vấn |
| 13–17 | Ổn. Xem lại bài sai rồi làm lại sau 2 ngày |
| < 13 | Làm lại từ đầu, **gõ tay**, đừng đọc đáp án trước |

Bốn bài quan trọng nhất nếu không có thời gian: **2** (bit x thư mục), **7** (SIGTERM/SIGKILL),
**11** (tìm tiến trình giữ cổng), **17** (phân tích log).

---

Tiếp theo: [03-tinh-huong-su-co.md](./03-tinh-huong-su-co.md)
