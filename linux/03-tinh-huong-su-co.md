# 10 tình huống xử lý sự cố

Dạng câu hỏi đo **cách bạn nghĩ dưới áp lực**, không đo bạn thuộc bao nhiêu lệnh.

Người phỏng vấn muốn nghe: bạn **đo trước hay đoán trước**, bạn có biết **thứ tự kiểm tra** không, và
bạn có phân biệt được **triệu chứng** với **nguyên nhân** không.

---

## Cách trả lời dạng này

```
1. Hỏi lại        "Chậm từ khi nào? Có thay đổi gì gần đây không? Ảnh hưởng ai?"
2. Đo, đừng đoán   Gõ lệnh cụ thể, đọc output
3. Thu hẹp dần     Loại trừ từng tầng: app → DB → hệ thống → mạng
4. Sửa tạm, rồi sửa gốc   Khôi phục dịch vụ trước, điều tra sau
5. Phòng ngừa      "Để lần sau không lặp lại, em sẽ..."
```

**Sai lầm phổ biến nhất:** nhảy ngay vào một nguyên nhân cụ thể. Nghe "server chậm" mà đáp luôn "chắc
do thiếu index" là bị đánh giá thấp — bạn chưa đo gì cả.

**Câu hỏi đầu tiên nên hỏi trong mọi tình huống:** *"Gần đây có deploy hay đổi gì không?"* — phần lớn
sự cố production đến từ một thay đổi vừa xảy ra.

---

## 1. ⭐⭐ "Server báo hết dung lượng đĩa"

### Hỏi lại

> "Dịch vụ nào đang lỗi? Còn ghi được file không hay chỉ cảnh báo?"

### Quy trình

**Bước 1 — phân vùng nào đầy?**

```bash
$ df -h
Filesystem      Size  Used Avail Use% Mounted on
overlay         912G   20G  846G   3% /
```

Không phải cả máy đầy — có thể chỉ `/var` hoặc `/tmp`.

**Bước 2 — kiểm tra inode. Đây là bước hay bị bỏ qua.**

```bash
$ df -i
Filesystem       Inodes   IUsed    IFree IUse% Mounted on
overlay        60710912 1102876 59608036    2% /
```

> "Em kiểm tra `df -i` vì hết **inode** cho triệu chứng **giống hệt** hết dung lượng — vẫn báo
> `No space left on device` nhưng `df -h` lại thấy còn trống. Thường do hàng triệu file nhỏ: session
> PHP, cache, log chia nhỏ."

**Bước 3 — nếu đúng là hết dung lượng, tìm thư mục nặng:**

```bash
$ du -xh / 2>/dev/null | sort -rh | head -20
$ du -sh /var/* | sort -rh | head -5
```

`-x` để không đi sang phân vùng khác.

**Bước 4 ⭐ — nếu `du` cộng lại NHỎ HƠN con số `df` báo:**

> "Đó là dấu hiệu có file đã bị `rm` nhưng vẫn bị tiến trình giữ. Dung lượng chỉ được giải phóng khi
> file descriptor cuối cùng đóng lại."

```bash
$ lsof +L1
COMMAND  PID USER FD TYPE DEVICE SIZE/OFF NLINK  NODE NAME
bash    3299 root  8r  REG   0,57 52428800     0 ... /tmp/gone.bin (deleted)
```

Cột `NLINK = 0` và chữ `(deleted)` là bằng chứng. Sửa: restart tiến trình đó.

**Bước 5 — khôi phục nhanh:**

```bash
$ : > /var/log/app.log              # ✅ cắt rỗng, giải phóng NGAY
$ rm /var/log/app.log               # ❌ đĩa không giảm nếu app đang mở
$ journalctl --vacuum-time=3d       # dọn log systemd
$ docker system df                   # nếu có Docker — thường Build Cache là thủ phạm
```

**Bước 6 — phòng ngừa:**

> "Em đặt `logrotate` với `copytruncate`, giới hạn log Docker bằng `max-size`/`max-file`, và đặt cảnh
> báo khi đĩa vượt 80% thay vì chờ đầy."

---

## 2. ⭐⭐ "Ứng dụng tự nhiên chết, không có log lỗi"

### Hỏi lại

> "Chết ngẫu nhiên hay theo giờ nhất định? Có tự khởi động lại không?"

### Quy trình

**Nghi ngờ đầu tiên: OOM killer.**

> "Ứng dụng chết không để lại log thường không phải nó tự thoát — mà là bị **kernel giết**. Ứng dụng bị
> `SIGKILL` thì không kịp ghi gì cả."

```bash
$ dmesg -T | grep -i "out of memory"
$ journalctl -k | grep -i oom
$ grep -i "killed process" /var/log/syslog
```

Với systemd:

```bash
$ systemctl status blogapi --no-pager
$ journalctl -u blogapi --since "1 hour ago"
$ systemctl show -p NRestarts --value blogapi     # đã restart mấy lần
```

Với Docker:

```bash
$ docker inspect <container> --format '{{.State.OOMKilled}} {{.State.ExitCode}}'
true 137
```

**Exit code 137 = 128 + 9 = SIGKILL.** Đây là chữ ký của OOM.

Trong cgroup:

```bash
$ cat /sys/fs/cgroup/memory.events
oom 9
oom_kill 2
```

**Bước tiếp — vì sao hết RAM:**

```bash
$ free -h
               total        used        free      shared  buff/cache   available
Mem:           7.8Gi       1.0Gi       5.1Gi        16Mi       1.8Gi       6.7Gi
```

> "Em nhìn cột **`available`**, không nhìn `free` — Linux cố ý dùng RAM trống làm cache đĩa, nên `free`
> thấp là bình thường."

**Nguyên nhân gốc thường gặp:**

> "Tăng RAM chỉ là biện pháp tạm. Nguyên nhân thật thường là rò rỉ bộ nhớ, hoặc code nạp cả bảng vào
> RAM thay vì xử lý theo lô. Ở dự án Laravel em từng gặp `->get()` trên bảng lớn — đổi sang
> `chunkById()` là hết."

**Các nguyên nhân khác nếu không phải OOM:**

| Dấu hiệu | Nguyên nhân |
|---------|-------------|
| Exit code 137 | OOM hoặc bị `kill -9` |
| Exit code 143 | Nhận SIGTERM (128+15) — ai đó dừng nó, hoặc deploy |
| Exit code 1 | Ứng dụng tự thoát vì lỗi |
| Chết đúng giờ | Cron hoặc `logrotate` restart dịch vụ |

---

## 3. ⭐⭐ "Port đã bị chiếm, không start được app"

### Triệu chứng

```
Error: listen EADDRINUSE: address already in use :::3000
```

### Quy trình

```bash
$ ss -tlnp | grep :3000
LISTEN 0 511  0.0.0.0:3000  0.0.0.0:*  users:(("node",pid=4211,fd=20))

$ lsof -i :3000
$ fuser 3000/tcp
```

Xem tiến trình đó là gì trước khi kill:

```bash
$ ps -p 4211 -o pid,ppid,user,lstart,cmd
```

> "Em xem `lstart` và `cmd` trước — nếu đó là instance cũ của chính app mình thì kill được; nếu là dịch
> vụ khác thì phải đổi cổng của app thay vì giết nhầm."

Kill tử tế:

```bash
$ kill 4211           # SIGTERM trước
$ sleep 3
$ ss -tlnp | grep :3000    # kiểm tra lại
$ kill -9 4211        # chỉ khi vẫn còn
```

### Nếu không thấy tiến trình nào giữ cổng

> "Có hai khả năng. Một là cổng đang ở trạng thái `TIME_WAIT` sau khi đóng — chờ vài chục giây là hết,
> hoặc dùng `SO_REUSEADDR` trong app. Hai là tiến trình chạy bằng user khác nên `ss` không hiện được
> PID — cần chạy bằng `sudo`."

```bash
$ ss -tan | grep :3000        # xem cả TIME_WAIT
```

---

## 4. ⭐ "Web app trả 502 Bad Gateway"

### Ý nghĩa

> "502 là **nginx nói chuyện được với client nhưng không nói chuyện được với ứng dụng phía sau**. Nên
> vấn đề gần như chắc chắn nằm ở tầng app, không phải nginx."

### Quy trình

**Bước 1 — app còn sống không?**

```bash
$ systemctl status blogapi --no-pager
$ ss -tlnp | grep 3000
```

**Bước 2 — nginx trỏ đúng chỗ không?**

```bash
$ nginx -t                              # kiểm tra cú pháp config
$ grep -r proxy_pass /etc/nginx/
```

Sai lầm kinh điển: `proxy_pass http://localhost:3000` trong khi app nghe trên `127.0.0.1` còn nginx
trong container khác — `localhost` khi đó trỏ vào **chính container nginx**.

**Bước 3 — log của cả hai:**

```bash
$ tail -50 /var/log/nginx/error.log
$ journalctl -u blogapi -n 50 --no-pager
```

**Bước 4 — thử gọi thẳng, bỏ qua nginx:**

```bash
$ curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/health
```

> "Nếu gọi thẳng được mà qua nginx thì 502, vấn đề ở cấu hình proxy. Nếu gọi thẳng cũng hỏng thì app
> đang chết hoặc treo."

### Phân biệt các mã 5xx

| Mã | Nghĩa |
|----|-------|
| **502** | Upstream không phản hồi (app chết, sai địa chỉ) |
| **504** | Upstream **quá chậm**, nginx hết kiên nhẫn (`proxy_read_timeout`) |
| **500** | Chính ứng dụng ném lỗi |
| **503** | Không có upstream nào khả dụng / đang bảo trì |

504 và 502 hay bị nhầm — 504 nghĩa là app **còn sống nhưng chậm**, hướng điều tra hoàn toàn khác.

---

## 5. ⭐⭐ "Server chậm, bạn gõ lệnh gì đầu tiên?"

### Câu trả lời tốt: phân loại trước khi đào sâu

> "Em xác định **nút thắt ở đâu** trước — CPU, RAM, đĩa, hay mạng. Ba lệnh đầu tiên:"

```bash
$ uptime
 11:39:26 up 21:11,  0 user,  load average: 0.16, 0.10, 0.03

$ nproc
10

$ free -h
$ df -h
```

**Đọc load average đúng cách:**

> "Load phải chia cho **số lõi**. Máy này 10 lõi, load 0.16 → gần như rảnh. Load 10 trên máy 10 lõi mới
> là dùng hết công suất."

| Load / số lõi | Nghĩa |
|---------------|-------|
| < 0.7 | Bình thường |
| ~ 1.0 | Dùng hết công suất |
| > 2.0 | Quá tải, phải xếp hàng |

**⭐ Điểm ghi điểm lớn nhất:**

> "Nhưng load cao **không nhất thiết là CPU bận**. Trên Linux, load tính cả tiến trình ở trạng thái `D`
> — đang chờ I/O. Nên em xem tiếp `%wa` trong `top`: nếu `%wa` cao thì đĩa mới là nút thắt, không phải
> CPU. Lúc đó tăng CPU không giải quyết được gì."

```bash
$ top             # nhìn %Cpu(s): ... wa
$ vmstat 1 5      # cột wa
$ ps -eo pid,stat,comm | awk '$2 ~ /^D/'   # tiến trình đang kẹt I/O
```

**Sau khi khoanh vùng:**

| Nút thắt | Bước tiếp |
|----------|-----------|
| CPU | `top` → tiến trình nào ăn CPU → profile ứng dụng |
| RAM | `free -h` (cột `available`) → kiểm tra rò rỉ |
| Đĩa | `iostat -x 1`, `iotop` → query nặng? log ghi quá nhiều? |
| Mạng | `ss -s`, kiểm tra API bên thứ ba |
| **Không phải hệ thống** | Vào tầng ứng dụng: đếm query, tìm N+1 |

> "Rất nhiều lần 'server chậm' hoá ra hệ thống hoàn toàn rảnh — vấn đề nằm ở N+1 query hoặc gọi API
> ngoài đồng bộ. Nên em luôn đo hệ thống trước để **loại trừ**, chứ không phải để tìm."

---

## 6. "SSH vào server không được"

### Quy trình từ ngoài vào trong

```bash
$ ping -c 3 server.com                  # máy còn sống?
$ nc -zv server.com 22                  # cổng 22 có mở?
$ ssh -v user@server.com                # xem quá trình bắt tay
```

**Các nguyên nhân theo thứ tự hay gặp:**

| Triệu chứng | Nguyên nhân |
|-------------|-------------|
| `Connection refused` | sshd không chạy, hoặc sai cổng |
| `Connection timed out` | Firewall / security group chặn |
| `Permission denied (publickey)` | Sai khoá, hoặc quyền file khoá sai |
| `Host key verification failed` | Server cài lại → xoá dòng cũ trong `known_hosts` |

**⭐ Quyền file khoá — lỗi rất hay gặp:**

```
Permissions 0644 for '/root/.ssh/id_rsa' are too open.
It is required that your private key files are NOT accessible by others.
```

```bash
$ chmod 700 ~/.ssh
$ chmod 600 ~/.ssh/id_rsa
$ chmod 600 ~/.ssh/authorized_keys
```

> "SSH **cố ý** từ chối khoá có quyền quá lỏng. Đây là lỗi hay gặp sau khi copy khoá từ máy khác."

**Nếu vẫn còn một phiên SSH đang mở:**

```bash
$ systemctl status ssh
$ journalctl -u ssh -n 50
$ ss -tlnp | grep :22
```

> "Bài học vận hành: khi sửa cấu hình SSH, **luôn giữ một phiên đang mở** và test bằng phiên thứ hai
> trước khi đóng phiên cũ. Sửa sai mà đóng hết là mất server."

---

## 7. ⭐ "Cron không chạy"

### Ba nguyên nhân, theo thứ tự

**1. PATH của cron rất hẹp.**

> "Cron không nạp `.bashrc` hay `.profile`, nên `PATH` chỉ có vài thư mục cơ bản. `node`, `php`,
> `composer` thường không tìm thấy."

```bash
# ❌
* * * * * php /var/www/artisan schedule:run

# ✅
* * * * * /usr/bin/php /var/www/artisan schedule:run
```

Tìm đường dẫn tuyệt đối: `which php`.

**2. Không có output nên không biết hỏng.**

```bash
* * * * * cd /var/www && /usr/bin/php artisan schedule:run >> /var/log/cron.log 2>&1
```

`2>&1` bắt buộc — không có thì lỗi biến mất.

**3. Dấu `%` bị hiểu đặc biệt.**

```bash
# ❌ cron cắt tại dấu %
* * * * * echo "$(date +%Y-%m-%d)" >> /tmp/x.log
# ✅
* * * * * echo "$(date +\%Y-\%m-\%d)" >> /tmp/x.log
```

### Kiểm tra

```bash
$ crontab -l                          # crontab có đúng không
$ systemctl status cron               # dịch vụ cron có chạy không
$ journalctl -u cron --since "1 hour ago"
$ grep CRON /var/log/syslog | tail
```

Chạy thật để xác nhận:

```bash
$ crontab -l
*/1 * * * * echo "chay luc $(date)" >> /tmp/cron.log 2>&1
$ sleep 65 && cat /tmp/cron.log
chay luc Wed Aug 19 11:46:01 UTC 2026
```

---

## 8. "Dịch vụ không tự khởi động lại sau khi server reboot"

### Nguyên nhân

> "Gần như chắc chắn là `systemctl start` mà quên `systemctl enable`. `start` chỉ chạy ngay lúc đó;
> `enable` mới đăng ký chạy lúc boot."

```bash
$ systemctl is-enabled blogapi
disabled

$ systemctl enable blogapi        # hoặc enable --now để làm cả hai
$ systemctl is-enabled blogapi
enabled
```

Xác nhận trong `status`:

```bash
$ systemctl status blogapi --no-pager | head -3
● blogapi.service - Blog API (NestJS)
     Loaded: loaded (/etc/systemd/system/blogapi.service; enabled; preset: enabled)
                                                          ↑ phải là enabled
```

### Nguyên nhân khác

| Vấn đề | Kiểm tra |
|--------|---------|
| Thiếu `[Install] WantedBy=` | Không `enable` được |
| Service chạy trước khi network sẵn sàng | Thêm `After=network-online.target` |
| Chạy trước khi mount đĩa dữ liệu | Thêm `RequiresMountsFor=` |
| Sửa file `.service` mà chưa nạp lại | `systemctl daemon-reload` |

> "`daemon-reload` là lệnh hay quên nhất — sửa file service xong mà không chạy nó thì systemd vẫn dùng
> bản cũ, và bạn sẽ tưởng thay đổi không có tác dụng."

---

## 9. ⭐ "Deploy xong app chạy code cũ"

### Quy trình

**Bước 1 — code trên đĩa có mới không?**

```bash
$ cd /var/www && git log -1 --oneline
$ ls -l --time-style=full-iso dist/main.js
```

**Bước 2 — tiến trình đang chạy từ khi nào?**

```bash
$ ps -eo pid,lstart,cmd | grep node
$ systemctl show -p ActiveEnterTimestamp --value blogapi
```

> "Nếu tiến trình khởi động **trước** thời điểm file được cập nhật thì nó đang giữ code cũ trong bộ
> nhớ. Đây là nguyên nhân số một."

**Bước 3 — restart đúng cách:**

```bash
$ systemctl restart blogapi
$ php artisan queue:restart          # Laravel: worker giữ code cũ trong RAM
$ php artisan octane:reload
$ pm2 reload all
```

**Bước 4 — nếu vẫn cũ, nghi cache:**

```bash
$ php artisan optimize:clear         # Laravel
$ npm run build                       # tài sản frontend
```

> "Với Laravel em kiểm tra `bootstrap/cache/` — nếu ai đó chạy `config:cache` thì `.env` mới không có
> tác dụng. Với worker queue thì `queue:restart` là lệnh hay quên nhất, vì `queue:work` nạp framework
> một lần rồi giữ trong bộ nhớ."

**Bước 5 — kiểm tra bạn đang xem đúng máy:**

> "Nghe hiển nhiên nhưng em từng mất 30 phút vì load balancer còn trỏ vào instance cũ. Em xác nhận bằng
> cách thêm header hoặc endpoint trả git SHA đang chạy."

---

## 10. "File log tăng 50GB trong một đêm"

### Quy trình

```bash
$ du -sh /var/log/* | sort -rh | head -5
$ ls -lhS /var/log/*.log | head
```

**Xem cái gì đang được ghi:**

```bash
$ tail -100 /var/log/app.log
$ awk '{print $0}' /var/log/app.log | sort | uniq -c | sort -rn | head -5
```

> "Em gom nhóm dòng lặp lại. Log phình đột ngột gần như luôn là **một dòng lặp hàng triệu lần** — vòng
> lặp retry vô hạn, hoặc `LOG_LEVEL=debug` bị bật nhầm trên production."

**Khắc phục ngay (không mất dữ liệu đang ghi):**

```bash
$ : > /var/log/app.log          # ✅ cắt rỗng, giải phóng ngay
$ rm /var/log/app.log           # ❌ đĩa không giảm, và app mất chỗ ghi
```

**Phòng ngừa:**

```
/var/log/app/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    copytruncate
}
```

```bash
$ logrotate -d /etc/logrotate.d/app     # -d = thử, không thực thi
```

Với Docker:

```yaml
logging:
  driver: json-file
  options: { max-size: "10m", max-file: "3" }
```

> "Và em kiểm tra `LOG_LEVEL` trên production — `debug` sinh hàng GB mỗi ngày và còn làm chậm ứng dụng.
> Mức đúng là `warning` hoặc `error`, chỉ hạ xuống `debug` khi đang điều tra."

---

## Bảng tra nhanh theo triệu chứng

| Triệu chứng | Lệnh đầu tiên | Nghi ngờ chính |
|-------------|---------------|----------------|
| Hết đĩa | `df -h` rồi `df -i` | Hết inode, hoặc file đã xoá còn bị giữ |
| App chết im lặng | `dmesg -T \| grep -i oom` | OOM killer (exit 137) |
| Port bị chiếm | `ss -tlnp \| grep :PORT` | Instance cũ chưa chết |
| 502 | `curl 127.0.0.1:PORT` | App chết, hoặc sai `proxy_pass` |
| 504 | log app | App còn sống nhưng chậm |
| Server chậm | `uptime` + `nproc` + `top` | Load/lõi; xem `%wa` để loại trừ I/O |
| SSH hỏng | `nc -zv host 22` | Firewall, hoặc quyền khoá |
| Cron không chạy | `grep CRON /var/log/syslog` | PATH, hoặc thiếu `2>&1` |
| Không tự start sau reboot | `systemctl is-enabled X` | Quên `enable` |
| Chạy code cũ | `ps -eo pid,lstart,cmd` | Chưa restart, hoặc cache |
| Log phình | `du -sh /var/log/*` | Một dòng lặp, hoặc `LOG_LEVEL=debug` |

---

## Ba câu hỏi ngược nên hỏi

Khi nhận tình huống, hỏi lại ba câu này luôn hợp lý và cho thấy bạn có kinh nghiệm:

1. **"Gần đây có deploy hay đổi cấu hình gì không?"** — phần lớn sự cố đến từ một thay đổi vừa xảy ra.
2. **"Ảnh hưởng toàn bộ người dùng hay chỉ một nhóm?"** — một nhóm thường nghĩa là dữ liệu của họ khác
   (nhiều bản ghi hơn → thiếu index), hoặc chỉ một instance hỏng.
3. **"Có monitoring/log tập trung không?"** — nếu có thì bắt đầu từ đó thay vì SSH vào từng máy.

---

## Nguyên tắc cuối

> **Khôi phục dịch vụ trước, tìm nguyên nhân sau.**

Rollback, restart, tăng tài nguyên tạm — làm cho hệ thống chạy lại đã. Nhưng **đừng dừng ở đó**: sau khi
ổn định, phải tìm nguyên nhân gốc, nếu không nó sẽ quay lại vào lúc bất tiện hơn.

Nói được câu này trong phỏng vấn cho thấy bạn đã trực sự cố thật.

---

Tiếp theo: [04-tu-kiem-tra.md](./04-tu-kiem-tra.md)
