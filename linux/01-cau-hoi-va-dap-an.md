# 60 câu hỏi phỏng vấn Linux + đáp án

Che đáp án, **gõ thử lệnh** rồi mới đọc. ⭐ = rất hay gặp.

Mọi output chạy thật trong Ubuntu 24.04.4 LTS.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--file-và-quyền) | File và quyền | 12 |
| [B](#b--người-dùng-và-nhóm) | Người dùng, nhóm | 6 |
| [C](#c--tiến-trình-và-tín-hiệu) | Tiến trình, tín hiệu | 12 |
| [D](#d--mạng) | Mạng | 8 |
| [E](#e--đĩa-và-bộ-nhớ) | Đĩa, bộ nhớ | 9 |
| [F](#f--xử-lý-văn-bản-và-log) | Xử lý văn bản, log | 8 |
| [G](#g--systemd-cron-shell) | systemd, cron, shell | 5 |

---

## A — File và quyền

### A1 ⭐⭐ Đọc `-rw-r--r--` như thế nào?

**Ngắn:** Ký tự đầu là **loại**, rồi 3 nhóm 3 ký tự: chủ sở hữu (user), nhóm (group), người khác (other).

**Đào sâu:**

```
-  rw-  r--  r--
│   │    │    └── other: chỉ đọc
│   │    └─────── group: chỉ đọc
│   └──────────── user:  đọc + ghi
└──────────────── loại file
```

Ký tự đầu:

| Ký tự | Loại |
|-------|------|
| `-` | file thường |
| `d` | thư mục |
| `l` | symbolic link |
| `c` / `b` | thiết bị ký tự / khối |
| `s` | socket |
| `p` | named pipe |

### A2 ⭐⭐ `755` và `644` nghĩa là gì?

**Ngắn:** Mỗi chữ số là tổng của `r=4`, `w=2`, `x=1`, theo thứ tự user–group–other.

**Đào sâu:**

```
755 = rwx r-x r-x   → user đủ quyền, còn lại đọc + chạy
644 = rw- r-- r--   → user đọc/ghi, còn lại chỉ đọc
600 = rw- --- ---   → chỉ user đọc/ghi (dùng cho .env, khoá SSH)
777 = rwx rwx rwx   → ai cũng làm gì cũng được (gần như luôn SAI)
```

Chạy thật:

```bash
$ chmod 644 file.txt && stat -c "%A %a %n" file.txt
-rw-r--r-- 644 file.txt

$ chmod u+x file.txt && stat -c "%A %a %n" file.txt
-rwxr--r-- 744 file.txt
```

`stat -c "%A %a %n"` là cách nhanh nhất để xem cả dạng chữ và dạng số. (Trên macOS là `stat -f`.)

### A3 ⭐⭐⭐ Bit `x` trên **thư mục** khác trên **file** thế nào?

**Đây là câu hỏi phân biệt "học thuộc" và "hiểu".**

**Ngắn:** Trên file, `x` = chạy được. Trên **thư mục**, `x` = **đi vào được** (truy cập nội dung bên trong).

**Đào sâu — đo thật:**

```bash
$ mkdir d && echo "noi dung" > d/f.txt && chmod 644 d/f.txt
$ chmod 644 d              # bỏ bit x của THƯ MỤC
$ ls -ld d
drw-r--r-- 2 root root 4096 Aug 19 11:36 d

$ su son -c "cat /tmp/x/d/f.txt"
cat: /tmp/x/d/f.txt: Permission denied      ← dù file có quyền 644!

$ chmod 755 d
$ su son -c "cat /tmp/x/d/f.txt"
noi dung                                     ← giờ đọc được
```

File `f.txt` **không đổi quyền** lần nào. Chỉ thư mục đổi.

**Còn bit `r` trên thư mục?** Nó cho phép **liệt kê tên**, nhưng không cho vào:

```bash
$ chmod 644 d              # có r, không x
$ su son -c "ls /tmp/x/d"
f.txt                      ← thấy TÊN
$ su son -c "cat /tmp/x/d/f.txt"
Permission denied          ← nhưng không đọc được
```

Tóm lại với thư mục:

| Bit | Cho phép |
|-----|----------|
| `r` | Liệt kê **tên** file bên trong |
| `x` | **Truy cập** file bên trong (bắt buộc để `cd`, để mở file) |
| `w` | Tạo/xoá/đổi tên file bên trong (cần kèm `x`) |

⚠️ Hệ quả quan trọng: **`w` trên thư mục cho phép xoá file mà bạn không có quyền ghi.** Xoá file là sửa
*thư mục*, không phải sửa *file*. Đó là lý do `/tmp` cần sticky bit — xem [A5](#a5-sticky-bit-là-gì).

### A4 `chmod 777` có sai không?

**Ngắn:** Gần như luôn sai. Nó cho **mọi người** trên máy quyền ghi và chạy.

**Đào sâu:** Người ta gõ `777` khi gặp "Permission denied" mà không muốn tìm hiểu. Cách đúng là tìm
**user nào cần quyền gì**:

```bash
$ chown -R www-data:www-data storage/
$ chmod -R 775 storage/
```

Với ứng dụng web, thư mục ghi được nên là `775` và thuộc về user chạy web server, không phải `777`.

### A5 Sticky bit là gì?

**Ngắn:** Trên thư mục dùng chung, nó khiến **chỉ chủ file mới xoá được file của mình**.

**Đào sâu:**

```bash
$ ls -ld /tmp
drwxrwxrwt 1 root root 4096 Aug 19 11:36 /tmp
        ↑
        t = sticky bit

$ stat -c "%a %A %n" /tmp
1777 drwxrwxrwt /tmp
```

`/tmp` có quyền `rwxrwxrwx` — ai cũng ghi được. Không có sticky bit thì bất kỳ ai cũng **xoá được file
của người khác** (vì `w` trên thư mục cho phép xoá). Sticky bit chặn điều đó.

Số `1` ở đầu `1777` chính là sticky bit.

### A6 setuid và setgid là gì?

**Ngắn:** `setuid` khiến chương trình chạy với quyền của **chủ file** thay vì người gọi. `setgid` trên
**thư mục** khiến file mới thừa kế group của thư mục.

**Đào sâu — setuid:**

```bash
$ ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root 72056 May 30  2024 /usr/bin/passwd
   ↑
   s = setuid

$ stat -c "%a %A %n" /usr/bin/passwd
4755 -rwsr-xr-x /usr/bin/passwd
```

Vì sao cần: `passwd` phải ghi vào `/etc/shadow` (chỉ root ghi được), nhưng người dùng thường cũng phải
đổi được mật khẩu của mình. setuid giải quyết việc đó.

**setgid trên thư mục** — đo thật:

```bash
$ mkdir sg && chgrp mai sg && chmod 2775 sg
$ ls -ld sg
drwxrwsr-x 2 root mai 4096 Aug 19 11:37 sg
      ↑
      s = setgid

$ touch sg/a.txt && ls -l sg/a.txt
-rw-r--r-- 1 root mai 0 Aug 19 11:37 sg/a.txt      ← group = mai (thừa kế)
```

So với thư mục **không** setgid:

```bash
$ mkdir sg2 && chgrp mai sg2 && chmod 775 sg2
$ touch sg2/b.txt && ls -l sg2/b.txt
-rw-r--r-- 1 root root 0 Aug 19 11:37 sg2/b.txt    ← group = root (của người tạo)
```

Ứng dụng thật: thư mục dùng chung cho nhiều người trong cùng team deploy — setgid đảm bảo mọi file mới
đều thuộc group đó, không phụ thuộc ai tạo.

### A7 ⭐ `umask` là gì?

**Ngắn:** Là mặt nạ **trừ đi** quyền khi tạo file mới.

**Đào sâu — đo thật:**

```bash
$ umask
0022
$ touch new1 && stat -c "%A %a %n" new1
-rw-r--r-- 644 new1

$ umask 077 && touch new2 && stat -c "%A %a %n" new2
-rw------- 600 new2
```

Cách tính: file mới mặc định `666` (không có `x`), thư mục mới `777`.

```
666 - 022 = 644     (umask mặc định)
666 - 077 = 600     (umask chặt)
777 - 022 = 755     (thư mục)
```

Dùng khi: đặt `umask 077` trong script deploy để file sinh ra không ai khác đọc được.

### A8 `chown` khác `chgrp` thế nào?

**Ngắn:** `chown` đổi chủ sở hữu (và cả group nếu ghi `user:group`); `chgrp` chỉ đổi group.

```bash
$ chown www-data:www-data file      # cả hai
$ chown www-data file               # chỉ user
$ chgrp www-data file               # chỉ group
$ chown -R www-data:www-data dir/   # đệ quy
```

### A9 Hard link khác symbolic link thế nào?

**Ngắn:** Hard link là **tên thứ hai** của cùng một inode. Symlink là file riêng **chứa đường dẫn** tới
file khác.

**Đào sâu:**

| | Hard link | Symlink |
|---|---|---|
| Trỏ tới | inode | đường dẫn (chuỗi) |
| Xoá file gốc | Vẫn dùng được | **Hỏng** (dangling) |
| Qua phân vùng khác | ❌ | ✅ |
| Trỏ tới thư mục | ❌ | ✅ |
| `ls -l` hiện | như file thường | `l` và mũi tên `->` |

```bash
$ ln file.txt hard.txt        # hard link
$ ln -s file.txt soft.txt     # symlink
$ ls -li                      # -i hiện inode
```

Hai hard link có **cùng số inode**. Đây là lý do `php artisan storage:link` tạo symlink — nó trỏ sang
thư mục, mà hard link không làm được.

### A10 Inode là gì?

**Ngắn:** Là bản ghi metadata của file — quyền, chủ, kích thước, thời gian, và **vị trí dữ liệu trên
đĩa**. Nó **không** chứa tên file.

**Đào sâu:** Tên file nằm trong **thư mục**, ánh xạ tên → số inode. Đó là lý do:

- Đổi tên file rất nhanh (chỉ sửa thư mục, không đụng dữ liệu).
- Xoá file cần quyền `w` trên **thư mục**, không phải trên file.
- Hết inode thì không tạo được file mới **dù còn dung lượng** — xem [E3](#e3--df-báo-còn-chỗ-mà-vẫn-no-space-left-on-device).

### A11 File ẩn trong Linux là gì?

**Ngắn:** File có tên bắt đầu bằng dấu chấm. Không có thuộc tính "hidden" như Windows.

```bash
$ ls -a       # hiện cả file ẩn
```

`.env`, `.git`, `.ssh` đều là file ẩn theo quy ước này.

### A12 Quyền nên đặt cho `.env` và khoá SSH?

**Ngắn:** `600` — chỉ chủ đọc/ghi.

**Đào sâu:** SSH **từ chối hoạt động** nếu khoá riêng quá lỏng:

```
Permissions 0644 for '/root/.ssh/id_rsa' are too open.
It is required that your private key files are NOT accessible by others.
```

Chuẩn:

```bash
$ chmod 700 ~/.ssh
$ chmod 600 ~/.ssh/id_rsa
$ chmod 644 ~/.ssh/id_rsa.pub
$ chmod 600 ~/.ssh/authorized_keys
```

---

## B — Người dùng và nhóm

### B1 File nào lưu thông tin người dùng?

**Ngắn:** `/etc/passwd` (thông tin chung), `/etc/shadow` (mật khẩu đã băm), `/etc/group` (nhóm).

**Đào sâu:**

```bash
$ grep -E "^(root|son):" /etc/passwd
root:x:0:0:root:/root:/bin/bash
son:x:1001:1001::/home/son:/bin/sh
```

Bảy trường: `tên:mật_khẩu:UID:GID:mô_tả:thư_mục_home:shell`

Chữ `x` ở trường 2 nghĩa là **mật khẩu nằm ở `/etc/shadow`** (chỉ root đọc được). Ngày xưa mật khẩu băm
nằm thẳng ở `/etc/passwd` — mà file này ai cũng đọc được, nên bị tách ra.

### B2 ⭐ UID 0 là gì? UID dưới 1000 là gì?

**Ngắn:** UID 0 là **root**. UID < 1000 thường là **user hệ thống** (dịch vụ), >= 1000 là user thật.

**Đào sâu:**

```bash
$ awk -F: '$3 >= 1000 {print $1" UID="$3}' /etc/passwd
ubuntu UID=1000
son UID=1001
mai UID=1002
```

Quan trọng: **root không phải là "tên root", mà là UID 0**. Tạo user tên khác với UID 0 thì nó cũng là
root. Đó là một kỹ thuật cài backdoor — kiểm tra bằng:

```bash
$ awk -F: '$3 == 0 {print $1}' /etc/passwd
root
```

Ra nhiều hơn một dòng là có vấn đề.

### B3 `id` cho biết gì?

```bash
$ id son
uid=1001(son) gid=1001(son) groups=1001(son),1003(deploy)
```

`gid` là nhóm chính; `groups` là toàn bộ nhóm. File tạo bởi `son` sẽ có group là nhóm chính.

### B4 Thêm user vào nhóm thế nào? Bẫy là gì?

**Ngắn:** `usermod -aG <nhóm> <user>`. Bẫy là **quên `-a`**.

**Đào sâu:**

```bash
$ usermod -aG deploy son      # ✅ THÊM vào nhóm
$ usermod -G deploy son       # ❌ THAY THẾ toàn bộ nhóm phụ
```

Quên `-a` là user bị gỡ khỏi mọi nhóm khác — kể cả `sudo`. Đây là cách tự khoá mình ra khỏi server.

Và: **user phải đăng nhập lại** thì nhóm mới có hiệu lực (nhóm được nạp lúc tạo session).

### B5 `su` khác `sudo` thế nào?

**Ngắn:** `su` chuyển hẳn sang user khác (cần mật khẩu **của user đó**); `sudo` chạy một lệnh với quyền
root (cần mật khẩu **của chính bạn**).

**Đào sâu:** `sudo` tốt hơn vì: ghi log ai làm gì (`/var/log/auth.log`), cấp quyền theo từng lệnh, và
không phải chia sẻ mật khẩu root.

`su -` (có gạch ngang) nạp cả môi trường của user đích; `su` không — đó là lý do `su root` xong mà
`$PATH` vẫn của user cũ.

### B6 Tại sao user chạy dịch vụ nên có shell `nologin`?

**Ngắn:** Để không ai đăng nhập vào bằng tài khoản đó.

```bash
$ grep nologin /etc/passwd | head -3
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
```

Nếu web server bị chiếm quyền, kẻ tấn công có quyền của `www-data` nhưng không mở được shell đăng nhập.

---

## C — Tiến trình và tín hiệu

### C1 ⭐ `ps aux` và `ps -ef` khác gì? Đọc cột nào?

**Ngắn:** Hai cú pháp khác nhau (BSD và UNIX), cùng liệt kê mọi tiến trình.

**Đào sâu:**

```bash
$ ps aux | head -3
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.0   2272  1220 ?        Ss   08:58   0:00 sleep infinity
root      2851  0.0  0.0   7632  3644 ?        R    11:37   0:00 ps aux
```

Cột cần biết:

| Cột | Nghĩa |
|-----|-------|
| `PID` | Mã tiến trình |
| `%MEM` | % RAM |
| `RSS` | RAM **thật** đang dùng (KB) — quan trọng hơn `VSZ` |
| `VSZ` | Bộ nhớ ảo đã cấp phát (thường lớn vô nghĩa) |
| `STAT` | Trạng thái — xem [C2](#c2-cột-stat-có-những-giá-trị-nào) |

Chọn cột và sắp xếp (chỉ có ở GNU/Linux, macOS không có `--sort`):

```bash
$ ps -eo pid,ppid,user,%cpu,%mem,rss,stat,comm --sort=-%mem | head -5
  PID  PPID USER     %CPU %MEM   RSS STAT COMMAND
 2855  2845 root      0.0  0.0  3620 R    ps
 2845     0 root      0.0  0.0  3008 Ss   bash
```

### C2 Cột `STAT` có những giá trị nào?

| Ký tự | Nghĩa |
|-------|-------|
| `R` | Đang chạy hoặc sẵn sàng chạy |
| `S` | Ngủ, chờ sự kiện (đa số tiến trình) |
| `D` | Ngủ **không ngắt được** — thường là chờ I/O đĩa |
| `Z` | **Zombie** — đã chết, cha chưa thu dọn |
| `T` | Đã dừng (Ctrl+Z) |
| `s` | Là session leader |
| `+` | Ở foreground |

⚠️ Nhiều tiến trình `D` là dấu hiệu **đĩa hoặc mạng (NFS) đang nghẽn**, và chúng **không kill được** kể
cả bằng `kill -9`.

### C3 ⭐⭐ `kill` khác `kill -9` thế nào?

**Ngắn:** `kill` gửi **SIGTERM (15)** — lịch sự, chương trình bẫy được để dọn dẹp. `kill -9` gửi
**SIGKILL** — kernel giết ngay, chương trình **không bẫy được**.

**Đào sâu — đo thật.** Script có bẫy SIGTERM:

```bash
trap "echo '[app] nhan SIGTERM, dang dong tu te...'; sleep 1; echo '[app] da thoat sach'; exit 0" TERM
```

```bash
$ ./trap.sh & P=$!; kill -TERM $P
[app] dang chay, PID=2867
[app] nhan SIGTERM, dang dong tu te...
[app] da thoat sach                       ← kịp dọn dẹp
```

```bash
$ ./trap.sh & P=$!; kill -KILL $P
[app] dang chay, PID=2873
(khong in gi ca - bi giet ngay)           ← không kịp làm gì
```

**Quy tắc:** luôn thử `kill` trước. `kill -9` là biện pháp cuối, vì nó khiến ứng dụng **không kịp**:
đóng kết nối database, ghi nốt buffer, hoàn thành request đang xử lý.

Đây chính là cơ chế đằng sau `docker stop` (gửi SIGTERM, chờ 10 giây, rồi SIGKILL).

### C4 Kể vài tín hiệu hay dùng.

| Số | Tên | Ý nghĩa |
|----|-----|---------|
| 1 | `SIGHUP` | Nạp lại cấu hình (nginx, sshd) |
| 2 | `SIGINT` | Ctrl+C |
| 9 | `SIGKILL` | Giết ngay, **không bẫy được** |
| 15 | `SIGTERM` | Yêu cầu thoát tử tế (mặc định của `kill`) |
| 18/19 | `SIGCONT`/`SIGSTOP` | Tiếp tục / tạm dừng |

```bash
$ kill -l | head          # xem đầy đủ
$ kill -HUP $(pidof nginx)   # nạp lại config không downtime
```

### C5 ⭐⭐ Tiến trình zombie là gì? Có nguy hiểm không?

**Ngắn:** Là tiến trình **đã chết** nhưng tiến trình cha chưa gọi `wait()` để thu mã thoát. Nó không tốn
CPU/RAM, chỉ giữ một ô trong bảng tiến trình.

**Đào sâu — đo thật:**

```bash
$ ps -eo pid,ppid,stat,comm | awk '$3 ~ /^Z/ {print}'
  PID  PPID STAT COMMAND
 2877     1 Z    sleep
```

Nguy hiểm khi **rất nhiều** zombie — bảng PID có giới hạn, hết PID thì không tạo được tiến trình mới.

**Không kill được zombie** (nó đã chết rồi). Cách sửa là kill hoặc sửa **tiến trình cha**. Nếu cha là
PID 1 thì PID 1 sẽ tự dọn — **nếu** PID 1 biết dọn.

Đây chính là lý do container cần `dumb-init`/`tini`: `node` làm PID 1 **không thu dọn zombie**, nên
container chạy lâu sẽ tích tụ.

### C6 ⭐ Tiến trình mồ côi (orphan) là gì?

**Ngắn:** Là tiến trình con còn sống khi cha đã chết. Nó được **PID 1 nhận nuôi**.

**Đào sâu — đo thật:**

```bash
$ bash -c '(sleep 5 &) ; exit'      # cha thoát ngay, con còn sống
con PID=2896, cha PID=2894

$ ps -eo pid,ppid,comm | grep sleep
    1     0 sleep
 2877     1 sleep
 2891     1 sleep        ← PPID đã thành 1
```

Khác zombie: orphan **còn sống**, zombie **đã chết**.

### C7 ⭐⭐ PID 1 đặc biệt ở chỗ nào?

**Ngắn:** Nó là tiến trình đầu tiên, nhận nuôi mọi tiến trình mồ côi, và **kernel không gửi tín hiệu mặc
định cho nó**.

**Đào sâu:** Điểm cuối là thứ gây rắc rối nhất. Với tiến trình thường, `SIGTERM` không được xử lý thì
kernel giết nó. Với **PID 1**, kernel **không** làm vậy — nếu PID 1 không tự cài trình xử lý `SIGTERM`
thì tín hiệu bị **bỏ qua hoàn toàn**.

Hệ quả trong Docker:

```dockerfile
CMD ["node", "dist/main.js"]      # node là PID 1 → bỏ qua SIGTERM
```

`docker stop` gửi SIGTERM, không có gì xảy ra, 10 giây sau Docker gửi SIGKILL → request đang xử lý bị
cắt. Sửa:

```dockerfile
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

`dumb-init` làm PID 1, chuyển tiếp tín hiệu xuống `node`, và thu dọn zombie.

### C8 Tìm tiến trình theo tên thế nào?

```bash
$ pgrep -a node                 # liệt kê PID + lệnh
$ pgrep -u www-data             # theo user
$ pkill -f "node dist/main"     # kill theo chuỗi trong lệnh đầy đủ
$ pidof nginx
$ pstree -p                     # cây tiến trình
```

⚠️ `pkill -f` khớp **toàn bộ dòng lệnh** — cẩn thận, một chuỗi quá chung có thể kill nhầm.

### C9 `top` đọc thế nào? Có gì tốt hơn không?

**Ngắn:** `top` xem tiến trình theo thời gian thực. `htop` dễ đọc hơn nhưng phải cài.

**Đào sâu — phím trong `top`:**

| Phím | Tác dụng |
|------|----------|
| `M` | Sắp theo RAM |
| `P` | Sắp theo CPU |
| `1` | Hiện từng lõi CPU |
| `k` | Kill một PID |
| `c` | Hiện lệnh đầy đủ |

Dòng đầu của `top` chính là load average — xem [C10](#c10--load-average-là-gì-bao-nhiêu-là-cao).

### C10 ⭐⭐ Load average là gì? Bao nhiêu là cao?

**Ngắn:** Số tiến trình **đang chạy hoặc đang chờ** trung bình trong 1, 5, 15 phút. Ngưỡng "cao" phụ
thuộc **số lõi CPU**.

**Đào sâu — đo thật:**

```bash
$ uptime
 11:39:26 up 21:11,  0 user,  load average: 0.16, 0.10, 0.03

$ cat /proc/loadavg
0.16 0.10 0.03 6/330 3261

$ nproc
10
```

Cách đọc: chia load cho số lõi.

| Load / số lõi | Nghĩa |
|---------------|-------|
| < 0.7 | Bình thường |
| ~ 1.0 | Đang dùng hết công suất |
| > 2.0 | Quá tải, tiến trình phải xếp hàng |

Máy trên có **10 lõi** và load `0.16` → gần như rảnh.

⚠️ **Bẫy quan trọng:** trên Linux, load average tính cả tiến trình ở trạng thái `D` (chờ I/O). Nên
**load cao không nhất thiết là CPU bận** — có thể đĩa đang nghẽn. Kiểm tra bằng `top` xem `%wa`
(I/O wait) hoặc `iostat`.

Nói được điều này là điểm cộng lớn.

### C11 Chạy tiến trình nền và giữ nó sau khi thoát SSH?

```bash
$ command &                     # chạy nền (chết khi thoát shell)
$ nohup command &               # sống sau khi thoát
$ setsid command                # tách hẳn session
$ tmux new -s deploy            # tốt nhất: session gắn/tháo được
```

Trên server thật, dùng **systemd** cho dịch vụ chạy lâu, không dùng `nohup`.

### C12 `jobs`, `fg`, `bg` dùng khi nào?

```bash
$ Ctrl+Z        # tạm dừng tiến trình foreground
$ jobs          # liệt kê job của shell hiện tại
$ bg %1         # cho job 1 chạy tiếp ở nền
$ fg %1         # kéo về foreground
```

---

## D — Mạng

### D1 ⭐⭐ Làm sao biết tiến trình nào đang giữ cổng 8080?

**Đây là câu hỏi Linux hay gặp nhất khi phỏng vấn backend.**

**Ngắn:** `ss -tlnp`, `lsof -i :8080`, hoặc `fuser 8080/tcp`.

**Đào sâu — cả ba, đo thật:**

```bash
$ ss -tlnp
State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN 0      5            0.0.0.0:8080      0.0.0.0:*    users:(("python3",pid=3142,fd=3))

$ lsof -i :8080
COMMAND  PID USER   FD   TYPE  DEVICE SIZE/OFF NODE NAME
python3 3142 root    3u  IPv4 1569272      0t0  TCP *:http-alt (LISTEN)

$ fuser 8080/tcp
8080/tcp:             3142
```

Cả ba đều ra PID **3142**.

Nhớ nghĩa các cờ của `ss`:

| Cờ | Nghĩa |
|----|-------|
| `-t` | TCP |
| `-u` | UDP |
| `-l` | chỉ cổng đang **nghe** |
| `-n` | **không** phân giải tên (nhanh hơn nhiều) |
| `-p` | hiện tiến trình (cần root) |

⚠️ Không có `-n` thì `ss` sẽ tra DNS ngược cho từng địa chỉ — rất chậm trên server bận.

### D2 `ss` khác `netstat` thế nào?

**Ngắn:** `ss` là bản thay thế hiện đại, nhanh hơn nhiều. `netstat` thuộc gói `net-tools` đã bị coi là
lỗi thời và **thường không có sẵn** trên bản Linux mới.

```bash
$ netstat -tlnp        # cú pháp gần giống
```

Nếu gõ `netstat` mà báo `command not found` thì dùng `ss` — đừng cài `net-tools`.

### D3 Kiểm tra kết nối tới một máy khác?

```bash
$ ping -c 3 example.com              # còn sống không (ICMP)
$ curl -sS -o /dev/null -w '%{http_code}\n' https://example.com
$ curl -v https://example.com        # xem cả handshake, header
$ nc -zv example.com 5432            # cổng có mở không
$ traceroute example.com             # đi qua những chặng nào
```

⚠️ `ping` không nói lên nhiều — nhiều server chặn ICMP. Cổng có mở không thì dùng `nc -zv`.

### D4 Phân giải DNS kiểm tra thế nào?

```bash
$ dig +short example.com
$ dig example.com @8.8.8.8          # hỏi thẳng một DNS server
$ nslookup example.com
$ getent hosts example.com          # theo đúng cách hệ thống phân giải
```

`getent hosts` khác `dig` ở chỗ nó đi qua `/etc/nsswitch.conf` — nghĩa là **có tính cả `/etc/hosts`**.
Khi ứng dụng phân giải ra một IP khác với `dig`, thủ phạm thường là `/etc/hosts`.

### D5 ⭐ `curl` gọi API thế nào?

```bash
$ curl -sS https://api.example.com/posts
$ curl -X POST https://api/posts \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer TOKEN' \
    -d '{"title":"x"}'
$ curl -i ...                        # kèm header response
$ curl -o /dev/null -w '%{http_code} %{time_total}s\n' URL    # chỉ lấy mã + thời gian
$ curl -k ...                        # bỏ qua lỗi chứng chỉ (chỉ khi debug)
```

Cờ `-w` rất hữu ích khi đo: `%{time_connect}`, `%{time_starttransfer}` (≈ TTFB), `%{time_total}`.

### D6 Xem địa chỉ IP và route?

```bash
$ ip a                     # địa chỉ IP (thay cho ifconfig cũ)
$ ip r                     # bảng định tuyến
$ ip -br a                 # dạng ngắn gọn, dễ đọc
```

`ifconfig` cũng thuộc `net-tools` lỗi thời như `netstat`.

### D7 Firewall kiểm tra thế nào?

```bash
$ ufw status                   # Ubuntu
$ firewall-cmd --list-all      # RHEL/CentOS
$ iptables -L -n               # tầng thấp
```

Khi "cổng mở rồi mà vẫn không kết nối được", thứ tự kiểm tra: dịch vụ có **listen** không (`ss -tlnp`)
→ listen trên `0.0.0.0` hay chỉ `127.0.0.1` → firewall trên máy → firewall/security group của nhà cung
cấp cloud.

### D8 ⭐ Dịch vụ listen `127.0.0.1` khác `0.0.0.0` thế nào?

**Ngắn:** `127.0.0.1` chỉ nhận kết nối **từ chính máy đó**; `0.0.0.0` nhận từ mọi giao diện mạng.

**Đào sâu:** Đây là nguyên nhân rất hay gặp của "chạy được ở local mà server không vào được".

```bash
$ ss -tlnp | grep 3000
LISTEN 0 511  127.0.0.1:3000     ← chỉ local
LISTEN 0 511    0.0.0.0:3000     ← mọi nơi
```

Về bảo mật thì ngược lại: database **nên** chỉ listen `127.0.0.1` và cho ứng dụng gọi qua đó, thay vì
phơi ra internet.

---

## E — Đĩa và bộ nhớ

### E1 ⭐ Kiểm tra dung lượng đĩa?

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
overlay         912G   20G  846G   3% /
tmpfs            64M     0   64M   0% /dev
```

`-h` = human readable. Cột `Use%` là thứ cần nhìn.

### E2 Tìm thư mục nào chiếm nhiều chỗ?

```bash
$ du -sh /usr/* 2>/dev/null | sort -rh | head -5
141M	/usr/lib
37M	/usr/bin
11M	/usr/share
11M	/usr/sbin
88K	/usr/libexec
```

Cờ quan trọng:

| Cờ | Nghĩa |
|----|-------|
| `-s` | Chỉ tổng, không liệt kê con |
| `-h` | Dễ đọc |
| `-x` | **Không** đi sang phân vùng khác |

`sort -rh` sắp giảm dần theo số có đơn vị (`-h` của `sort` hiểu `141M` > `88K`).

⚠️ Chạy `du -sh /*` mà không có `-x` sẽ đi vào `/proc`, `/sys`, và các mount mạng — rất chậm.

### E3 ⭐⭐ `df` báo còn chỗ mà vẫn `No space left on device`?

**Câu hỏi kinh điển, có hai nguyên nhân.**

**Nguyên nhân 1 — hết inode:**

```bash
$ df -i
Filesystem       Inodes   IUsed    IFree IUse% Mounted on
overlay        60710912 1102876 59608036    2% /
```

Nếu `IUse%` = 100% thì hết inode: **còn dung lượng nhưng không tạo được file mới**. Thường do hàng triệu
file nhỏ — session PHP, cache, log chia nhỏ, thư mục mail.

**Nguyên nhân 2 — file đã xoá nhưng còn bị giữ.** Đây là nguyên nhân hay gặp hơn ở server ứng dụng, và
đo được:

```bash
$ dd if=/dev/zero of=/tmp/big.log bs=1M count=200
$ df -h /tmp | tail -1
overlay  912G   21G  846G   3% /

$ exec 9< /tmp/big.log        # một tiến trình đang mở file
$ rm /tmp/big.log             # xoá file
$ df -h /tmp | tail -1
overlay  912G   21G  846G   3% /      ← ĐĨA KHÔNG GIẢM

$ ls -l /proc/$$/fd/9
lr-x------ 1 root root 64 Aug 19 11:38 /proc/3182/fd/9 -> /tmp/big.log (deleted)

$ exec 9<&-                   # đóng file descriptor
$ df -h /tmp | tail -1
overlay  912G   20G  846G   3% /      ← giờ mới giảm
```

Chú ý dòng `-> /tmp/big.log (deleted)` — đó là bằng chứng.

Trong thực tế: ai đó `rm` file log 50GB trong khi ứng dụng vẫn đang ghi vào nó. Đĩa không giảm cho tới
khi **khởi động lại dịch vụ**.

Tìm nhanh:

```bash
$ lsof +L1                    # file có link count = 0 (đã xoá nhưng còn mở)
```

Cách xử lý đúng cho log: dùng `logrotate` với `copytruncate`, hoặc `> file.log` (cắt rỗng) thay vì `rm`.

```bash
$ : > /var/log/app.log        # cắt rỗng, giải phóng ngay, không cần restart
```

### E4 ⭐ `free -h` đọc thế nào? `free` ít mà có sao không?

**Ngắn:** Nhìn cột **`available`**, không nhìn `free`.

**Đào sâu — đo thật:**

```bash
$ free -h
               total        used        free      shared  buff/cache   available
Mem:           7.8Gi       1.0Gi       5.1Gi        16Mi       1.8Gi       6.7Gi
Swap:          1.0Gi          0B       1.0Gi
```

| Cột | Nghĩa |
|-----|-------|
| `used` | Đang dùng thật |
| `free` | **Hoàn toàn chưa đụng tới** |
| `buff/cache` | Kernel dùng làm cache đĩa — **giải phóng được ngay khi cần** |
| `available` | Ước lượng RAM **thật sự còn dùng được** |

Ở trên: `free` = 5.1Gi nhưng `available` = **6.7Gi**, vì 1.8Gi trong `buff/cache` lấy lại được.

**Linux cố ý dùng hết RAM trống làm cache đĩa** — RAM rảnh là RAM lãng phí. Nên "`free` gần bằng 0"
**không** phải vấn đề; `available` gần 0 mới là vấn đề.

### E5 ⭐⭐ OOM killer là gì? Làm sao biết app bị nó giết?

**Ngắn:** Khi hết RAM, kernel chọn một tiến trình để giết. Nạn nhân thường là tiến trình ngốn RAM nhất
— tức là **ứng dụng của bạn**.

**Đào sâu — đo thật trong container giới hạn 64MB:**

```bash
$ cat /sys/fs/cgroup/memory.max
67108864                      # 64MB

$ tail /dev/zero              # ngốn RAM
Killed
$ echo $?
137
```

**Exit code 137 = 128 + 9** → bị `SIGKILL`. Đây chính là exit code bạn thấy khi container Docker bị OOM.

Kiểm tra sự kiện OOM:

```bash
$ cat /sys/fs/cgroup/memory.events
low 0
high 0
max 163
oom 9
oom_kill 2                    ← đã giết 2 lần
```

Trên máy thật (không phải container), xem bằng:

```bash
$ dmesg -T | grep -i "out of memory"
$ journalctl -k | grep -i oom
$ grep -i "killed process" /var/log/syslog
```

Với Docker:

```bash
$ docker inspect <container> --format '{{.State.OOMKilled}} {{.State.ExitCode}}'
```

**Cách xử lý** (nói được là điểm cộng): tăng RAM chỉ là biện pháp tạm. Nguyên nhân thật thường là rò rỉ
bộ nhớ, hoặc nạp cả bảng dữ liệu vào RAM thay vì xử lý theo lô — đúng vấn đề `->get()` vs `chunkById()`
ở [Laravel](../laravel/nang-cao/01-toi-uu-eloquent.md).

### E6 Swap là gì? Nên bật không?

**Ngắn:** Là phần đĩa dùng làm RAM dự phòng. Bật thì tránh được OOM đột ngột, nhưng khi đụng vào swap
thì hệ thống **chậm khủng khiếp** (đĩa chậm hơn RAM hàng nghìn lần).

**Đào sâu:** Với server ứng dụng, nhiều nơi tắt swap hoặc để rất nhỏ và đặt `vm.swappiness=10` — thà bị
OOM kill nhanh và restart còn hơn ứng dụng "sống dở" phục vụ chậm hàng giờ. Kubernetes trước đây **bắt
buộc** tắt swap vì lý do này.

### E7 Kiểm tra I/O đĩa?

```bash
$ iostat -x 1 3              # cần gói sysstat
$ iotop                      # tiến trình nào đọc/ghi nhiều
$ vmstat 1 5                 # cột wa = CPU chờ I/O
```

`%iowait` cao + nhiều tiến trình `D` = đĩa là nút thắt, không phải CPU.

### E8 `/proc` là gì?

**Ngắn:** Hệ thống file ảo do kernel sinh ra, chứa thông tin tiến trình và hệ thống.

```bash
$ cat /proc/loadavg
$ cat /proc/meminfo
$ cat /proc/cpuinfo
$ ls -l /proc/<PID>/fd/       # file đang mở
$ cat /proc/<PID>/environ | tr '\0' '\n'   # biến môi trường của tiến trình
$ readlink /proc/<PID>/cwd    # thư mục làm việc
```

`/proc/<PID>/fd/` là công cụ then chốt khi điều tra "file đã xoá nhưng còn giữ" ở [E3](#e3--df-báo-còn-chỗ-mà-vẫn-no-space-left-on-device).

### E9 Xoá log an toàn thế nào?

**Ngắn:** Cắt rỗng, đừng `rm`.

```bash
$ : > /var/log/app.log        # ✅ giải phóng ngay
$ truncate -s 0 /var/log/app.log   # ✅ tương đương
$ rm /var/log/app.log         # ❌ đĩa không giảm nếu app đang mở file
```

Về lâu dài dùng `logrotate`:

```
/var/log/app/*.log {
    daily
    rotate 14
    compress
    missingok
    copytruncate
}
```

---

## F — Xử lý văn bản và log

Nhóm này hay bị bắt **gõ tại chỗ**. Tập gõ, đừng chỉ đọc.

Toàn bộ ví dụ dưới dùng file `access.log` có 10 cột:

```
10.0.0.1 - - [19/Aug/2026:10:00:01] "GET /api/posts HTTP/1.1" 200 1024 0.120
   $1    $2 $3        $4              $5     $6       $7      $8   $9   $10
```

> ⭐ **Mẹo đầu tiên khi gặp log lạ:** đếm cột trước, đừng đoán.
> ```bash
> $ head -1 access.log | awk '{for(i=1;i<=NF;i++) printf "$%d=%s\n", i, $i}'
> $1=10.0.0.1
> $4=[19/Aug/2026:10:00:01]
> $8=200
> $10=0.120
> ```
> Đoán sai số cột là lỗi hay gặp nhất khi làm bài này tại chỗ.

### F1 ⭐⭐ Đếm request theo mã trạng thái?

```bash
$ awk '{print $8}' access.log | sort | uniq -c | sort -rn
      4 200
      3 401
      2 500
```

**Mẫu `sort | uniq -c | sort -rn` là mẫu quan trọng nhất** trong phân tích log. `uniq -c` **bắt buộc**
phải có `sort` đứng trước vì nó chỉ gộp các dòng **liền kề**.

### F2 ⭐⭐ Tìm IP gọi nhiều nhất?

```bash
$ awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -3
      4 10.0.0.2
      2 10.0.0.3
      2 10.0.0.1
```

### F3 Lọc chỉ request lỗi 5xx?

```bash
$ awk '$8 ~ /^5/ {print $1, $6, $8}' access.log
10.0.0.3 /api/users 500
10.0.0.3 /api/users 500
```

### F4 Tìm request chậm hơn 1 giây?

```bash
$ awk '$10 > 1 {print $6, $10"s"}' access.log
/api/users 2.340s
/api/users 3.100s
```

### F5 Tính tổng và trung bình?

```bash
$ awk '{b+=$9; t+=$10; n++} END {printf "tong byte=%d, tb=%.3fs, n=%d\n", b, t/n, n}' access.log
tong byte=3323, tb=0.681s, n=9
```

### F6 ⭐ Phát hiện dò mật khẩu?

```bash
$ awk '$8==401 {print $1}' access.log | sort | uniq -c | sort -rn
      3 10.0.0.2
```

IP `10.0.0.2` đăng nhập sai 3 lần rồi mới thành công — đáng ngờ. Đây là câu hỏi tình huống hay gặp.

### F7 `grep` những cờ nào cần thuộc?

```bash
$ grep -c "401" access.log        # đếm dòng khớp → 3
$ grep -n "500" access.log        # kèm số dòng
$ grep -i "error" app.log         # không phân biệt hoa thường
$ grep -v "healthcheck" app.log   # loại bỏ (invert)
$ grep -r "DB_HOST" /etc          # đệ quy
$ grep -rl "DB_HOST" /tmp/lab     # chỉ in TÊN FILE khớp
$ grep -A3 -B3 "Exception" app.log  # kèm 3 dòng trước/sau
$ grep -E "40[13]" access.log     # regex mở rộng
```

`-A`/`-B`/`-C` cực kỳ hữu ích khi đọc stack trace — lỗi thật thường nằm ở dòng **trước** dòng khớp.

### F8 `sed` dùng làm gì trong thực tế?

```bash
$ sed -i 's/^DB_HOST=.*/DB_HOST=postgres/' .env    # sửa config tại chỗ
$ sed -n '2,4p' access.log                          # in dòng 2 đến 4
$ sed '/^#/d' config.conf                           # bỏ dòng comment
$ sed 's/\r$//' file                                # bỏ ký tự CR của Windows
```

⚠️ Trên macOS `sed -i` cần tham số rỗng: `sed -i '' 's/a/b/' file`. Đây là khác biệt BSD/GNU hay làm
người ta mất thời gian.

### F9 ⭐ `find` và `xargs` — vì sao cần `-print0`?

```bash
$ find . -name "*.log" -type f
./old.log
./access.log
./a/b/y.log

$ find . -name "*.log" -type f -mtime +7        # sửa hơn 7 ngày trước
./old.log

$ find / -xdev -type f -size +10M 2>/dev/null   # file lớn hơn 10MB
$ find . -name "*.txt" -exec basename {} \;
```

**Vì sao `-print0`:** tên file có dấu cách sẽ bị `xargs` tách thành nhiều tham số.

```bash
$ find . -name "*.log" -print0 | xargs -0 ls -l    # ✅ an toàn
$ find . -name "*.log" | xargs ls -l               # ❌ hỏng với "my file.log"
```

`-print0` phân cách bằng byte null (không xuất hiện được trong tên file), `-0` bảo `xargs` đọc theo đó.

Cờ `find` hay dùng:

| Cờ | Nghĩa |
|----|-------|
| `-type f` / `-type d` | File / thư mục |
| `-mtime +7` | Sửa hơn 7 ngày trước |
| `-mmin -30` | Sửa trong 30 phút qua |
| `-size +100M` | Lớn hơn 100MB |
| `-xdev` | Không sang phân vùng khác |
| `-delete` | Xoá (⚠️ chạy `-print` trước để kiểm tra) |

### F10 Xem log đang chảy?

```bash
$ tail -f /var/log/app.log
$ tail -n 200 -f app.log
$ tail -f app.log | grep -i error       # lọc theo thời gian thực
$ less +F app.log                        # như tail -f nhưng cuộn lại được
```

`less +F` tốt hơn `tail -f` ở chỗ bấm `Ctrl+C` là dừng lại và cuộn tự do, bấm `F` là chảy tiếp.

---

## G — systemd, cron, shell

### G1 ⭐⭐ systemd là gì? Quản lý dịch vụ thế nào?

**Ngắn:** Là init system (PID 1) của hầu hết bản Linux hiện nay — khởi động, giám sát và tự khởi động
lại dịch vụ.

**Đào sâu — file service thật:**

```ini
# /etc/systemd/system/blogapi.service
[Unit]
Description=Blog API (NestJS)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/blog
ExecStart=/usr/bin/node /opt/blog/dist/main.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
$ systemctl daemon-reload          # ⚠️ BẮT BUỘC sau khi sửa file .service
$ systemctl enable --now blogapi   # bật + chạy ngay
$ systemctl status blogapi --no-pager
● blogapi.service - Blog API (NestJS)
     Loaded: loaded (/etc/systemd/system/blogapi.service; enabled; preset: enabled)
     Active: active (running) since Wed 2026-08-19 11:40:38 UTC; 3s ago
   Main PID: 3102 (bash)
      Tasks: 2 (limit: 9520)
     Memory: 492.0K (peak: 836.0K)
```

Đọc `status`: `Loaded: ... enabled` = tự chạy khi boot; `Active: active (running)` = đang chạy.

**`enable` khác `start`:** `start` chạy ngay (mất khi reboot); `enable` đăng ký chạy lúc boot. `--now`
làm cả hai.

### G2 ⭐ `Restart=on-failure` hoạt động thế nào?

**Đo thật:**

```bash
$ systemctl show -p MainPID --value blogapi
3102
$ kill -9 3102
$ sleep 7
$ systemctl show -p MainPID --value blogapi
3119                                          ← systemd đã tự bật lại
$ systemctl show -p NRestarts --value blogapi
1
```

Các giá trị: `no`, `on-failure` (chỉ khi thoát với mã khác 0), `always`, `on-abnormal`.

Với dịch vụ web dùng `always` hoặc `on-failure` kèm `RestartSec` để không quay vòng quá nhanh.

### G3 ⭐ `journalctl` đọc log thế nào?

```bash
$ journalctl -u blogapi -n 5 --no-pager
Aug 19 11:40:38 host systemd[1]: Started blogapi.service - Blog API (NestJS).
Aug 19 11:40:38 host bash[3102]: [blog-api] alive
Aug 19 11:40:43 host bash[3102]: [blog-api] alive
```

Cờ cần thuộc:

```bash
$ journalctl -u blogapi -f            # theo dõi thời gian thực
$ journalctl -u blogapi --since "1 hour ago"
$ journalctl -u blogapi -p err        # chỉ mức error trở lên
$ journalctl -u blogapi --since today --no-pager
$ journalctl -k                       # log kernel (tìm OOM ở đây)
$ journalctl --disk-usage
$ journalctl --vacuum-time=7d         # dọn log cũ
```

Vì journald nhận log từ **stdout/stderr** của service, ứng dụng chỉ cần in ra console — không cần tự
ghi file. Đó cũng là lý do cấu hình log của Docker/Laravel/NestJS đều khuyên in ra stdout.

### G4 ⭐ Cron viết thế nào?

```
 ┌── phút (0-59)
 │ ┌── giờ (0-23)
 │ │ ┌── ngày trong tháng (1-31)
 │ │ │ ┌── tháng (1-12)
 │ │ │ │ ┌── thứ trong tuần (0-7, 0 và 7 = Chủ nhật)
 │ │ │ │ │
 * * * * *  lệnh
```

```bash
$ crontab -e         # sửa crontab của user hiện tại
$ crontab -l         # xem
$ crontab -l
*/1 * * * * echo "chay luc $(date)" >> /tmp/cron.log 2>&1
```

Chạy thật sau 1 phút:

```bash
$ cat /tmp/cron.log
chay luc Wed Aug 19 11:46:01 UTC 2026
```

Ví dụ hay dùng:

```
*/5 * * * *    mỗi 5 phút
0 3 * * *      3h sáng hằng ngày
0 3 * * 0      3h sáng Chủ nhật
0 */6 * * *    mỗi 6 tiếng
```

**Ba bẫy của cron** (nói được là điểm cộng):

1. **PATH rất hẹp.** Cron không nạp `.bashrc`, nên `node`/`php` có thể không tìm thấy. Dùng **đường dẫn
   tuyệt đối**: `/usr/bin/php /var/www/artisan schedule:run`.
2. **Không có output thì không biết hỏng.** Luôn thêm `>> /var/log/x.log 2>&1`.
3. **Dấu `%` bị hiểu đặc biệt** — phải escape thành `\%` (hay gặp khi dùng `date +%Y`).

### G5 Script shell cần biết gì tối thiểu?

```bash
#!/usr/bin/env bash
set -euo pipefail          # ⭐ dòng quan trọng nhất

readonly DIR="${1:-/var/www}"

if [[ ! -d "$DIR" ]]; then
  echo "Không tìm thấy $DIR" >&2
  exit 1
fi

for f in "$DIR"/*.log; do
  [[ -e "$f" ]] || continue
  echo "Xử lý $f"
done
```

**`set -euo pipefail` nghĩa là:**

| Cờ | Tác dụng |
|----|----------|
| `-e` | Dừng ngay khi có lệnh lỗi |
| `-u` | Lỗi khi dùng biến chưa khai |
| `-o pipefail` | Pipeline lỗi nếu **bất kỳ** lệnh nào trong pipe lỗi |

Không có `pipefail` thì `false | true` được coi là **thành công** — nguồn của những script "chạy xong"
mà thực ra hỏng giữa chừng.

**Luôn đặt biến trong nháy kép** (`"$DIR"`) — không có thì tên có dấu cách bị tách thành nhiều tham số.

---

## Bài tập gõ tay

Sáu bài dưới đây hay bị bắt làm tại chỗ. Xem thêm 20 bài đầy đủ ở
[02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md).

1. Tìm 5 file lớn nhất trong `/var` (không sang phân vùng khác).
2. Đếm số request 500 trong `access.log` và in ra IP gây ra chúng.
3. Tìm tiến trình đang giữ cổng 3000 và kill nó tử tế.
4. Tìm mọi file `.log` sửa hơn 7 ngày trước rồi xoá — **in ra trước khi xoá**.
5. Đổi `DB_HOST=localhost` thành `DB_HOST=postgres` trong mọi file `.env` dưới `/opt`.
6. Viết cron chạy `artisan schedule:run` mỗi phút, có ghi log.

<details>
<summary>Gợi ý đáp án</summary>

```bash
# 1
find /var -xdev -type f -printf '%s %p\n' 2>/dev/null | sort -rn | head -5

# 2
awk '$8==500 {print $1}' access.log | sort | uniq -c | sort -rn

# 3
ss -tlnp | grep :3000            # lấy PID
kill <PID>                        # SIGTERM trước, KHÔNG dùng -9 ngay

# 4
find /var/log -name "*.log" -type f -mtime +7 -print      # kiểm tra trước
find /var/log -name "*.log" -type f -mtime +7 -delete     # rồi mới xoá

# 5
find /opt -name ".env" -type f -print0 | xargs -0 sed -i 's/^DB_HOST=localhost/DB_HOST=postgres/'

# 6
* * * * * cd /var/www && /usr/bin/php artisan schedule:run >> /var/log/cron.log 2>&1
```

</details>

---

Tiếp theo: [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md)
