# Bài 07 — Persistence: RDB, AOF, và bạn mất bao nhiêu dữ liệu

Câu hỏi thật sự của bài này không phải "RDB khác AOF thế nào" mà là: **server chết đột ngột thì bạn mất
bao nhiêu?** Mọi thứ dưới đây đều đo bằng cách `kill -9` một container thật.

---

## 1. Ba thí nghiệm quyết định

### A) Cấu hình mặc định + `kill -9` → **mất trắng**

```bash
$ docker run -d --name rdb-test redis:8-alpine
$ docker exec rdb-test redis-cli SET quan-trong "don hang 123"
OK
$ docker exec rdb-test redis-cli DBSIZE
1

$ docker kill -s KILL rdb-test && docker start rdb-test

$ docker exec rdb-test redis-cli --no-raw GET quan-trong
(nil)
$ docker exec rdb-test redis-cli DBSIZE
0
```

Vì sao: cấu hình mặc định chỉ lưu theo điều kiện

```
127.0.0.1:6379> CONFIG GET save
1) "save"
2) "3600 1 300 100 60 10000"
```

Đọc là: lưu nếu **3600 giây có ≥1 thay đổi**, hoặc **300 giây có ≥100 thay đổi**, hoặc **60 giây có
≥10000 thay đổi**. Ghi một khoá rồi chết ngay thì chưa điều kiện nào chạm tới.

### B) Cấu hình mặc định + `docker stop` (SIGTERM) → **không mất**

```bash
$ docker exec rdb-test redis-cli SET quan-trong "don hang 456"
$ docker stop rdb-test && docker start rdb-test
$ docker exec rdb-test redis-cli --no-raw GET quan-trong
"don hang 456"
```

Log giải thích:

```
1:signal-handler (1787873605) Received SIGTERM scheduling shutdown...
1:M 27 Aug 2026 23:33:25.849 * Saving the final RDB snapshot before exiting.
1:M 27 Aug 2026 23:33:25.860 * DB saved on disk
```

**Rút ra rất quan trọng cho vận hành:** restart *có trật tự* thì an toàn, `kill -9` / OOM killer / mất
điện thì không. Trong Kubernetes, nếu pod Redis bị `SIGKILL` vì vượt `terminationGracePeriodSeconds`
trong lúc đang lưu RDB, bạn rơi vào trường hợp A.

### C) Bật AOF + `kill -9` → **không mất**

```bash
$ docker run -d --name aof-test redis:8-alpine redis-server --appendonly yes
$ docker exec aof-test redis-cli SET quan-trong "don hang 789"
$ docker exec aof-test redis-cli --no-raw CONFIG GET appendfsync
1) "appendfsync"
2) "everysec"

$ docker kill -s KILL aof-test && docker start aof-test
$ docker exec aof-test redis-cli --no-raw GET quan-trong
"don hang 789"
```

---

## 2. RDB — ảnh chụp toàn bộ dữ liệu

```
127.0.0.1:6379> CONFIG GET dir
1) "dir"
2) "/data"
127.0.0.1:6379> CONFIG GET dbfilename
1) "dbfilename"
2) "dump.rdb"

127.0.0.1:6379> BGSAVE
Background saving started
127.0.0.1:6379> LASTSAVE
(integer) 1787873588
```

```bash
$ docker exec redis-lab ls -la /data
-rw-------    1 redis    redis          109 Aug 27 23:33 dump.rdb
```

Theo dõi qua `INFO persistence`:

```
rdb_changes_since_last_save:0    ← bao nhiêu thay đổi chưa được lưu
rdb_bgsave_in_progress:0
rdb_last_save_time:1787873588
rdb_last_bgsave_status:ok        ← "err" ở đây là báo động đỏ
rdb_last_bgsave_time_sec:0       ← lần lưu vừa rồi mất bao lâu
rdb_saves:1
rdb_last_cow_size:475136         ← RAM phát sinh do copy-on-write
```

### `BGSAVE` hoạt động thế nào — và vì sao có thể ngốn gấp đôi RAM

`BGSAVE` gọi `fork()`. Tiến trình con ghi ảnh chụp ra đĩa, tiến trình cha tiếp tục phục vụ. Hệ điều hành
dùng **copy-on-write**: hai tiến trình dùng chung trang nhớ, chỉ trang nào bị **ghi** mới được sao chép.

Hệ quả: nếu trong lúc `BGSAVE` chạy, app ghi vào toàn bộ dataset, RAM có thể tăng gần **gấp đôi**.
`rdb_last_cow_size` cho biết thực tế đã tốn thêm bao nhiêu.

Trên máy này, `rdb_last_cow_size:475136` (~465 KB) — vì dataset nhỏ. Trên Redis 20 GB với tải ghi cao,
con số này có thể là vài GB. Đây là lý do máy chạy Redis nên có RAM dư và nên đặt
`vm.overcommit_memory=1` trên Linux; không có nó, `fork()` có thể **thất bại** và `BGSAVE` không chạy
được.

`SAVE` (không có `BG`) chạy **trong luồng chính** — treo toàn bộ server cho tới khi lưu xong. Đừng bao
giờ gõ.

### Ưu / nhược của RDB

| Ưu | Nhược |
|---|---|
| File nhỏ, nén tốt | **Mất dữ liệu giữa hai lần chụp** |
| Khởi động lại **nhanh** (nạp một file nhị phân) | `fork()` gây tăng RAM và có thể gây khựng |
| Hoàn hảo để backup / chuyển sang máy khác | Không hợp khi yêu cầu mất ít dữ liệu |

---

## 3. AOF — ghi lại mọi lệnh thay đổi

```bash
$ docker run -d --name aof-test redis:8-alpine redis-server --appendonly yes
$ docker exec aof-test ls -la /data/appendonlydir
-rw-------    1 redis    redis           89 Aug 27 23:33 appendonly.aof.1.base.rdb
-rw-------    1 redis    redis           72 Aug 27 23:33 appendonly.aof.1.incr.aof
-rw-------    1 redis    redis          102 Aug 27 23:33 appendonly.aof.manifest
```

⚠️ **Đây là điểm mọi blog cũ nói sai.** Từ Redis 7, AOF không còn là một file `appendonly.aof` mà là
**một thư mục** `appendonlydir/` với ba loại file:

- `*.base.rdb` — ảnh chụp nền (định dạng RDB, nhỏ gọn)
- `*.incr.aof` — các lệnh ghi kể từ ảnh nền
- `*.manifest` — danh sách các file đang có hiệu lực

Nghĩa là AOF hiện tại **đã là dạng lai**: nền RDB + lệnh gia tăng. Script backup nào copy đúng file
`appendonly.aof` sẽ copy trượt.

### `appendfsync` — ba mức đánh đổi

```
127.0.0.1:6379> CONFIG GET appendfsync
1) "appendfsync"
2) "everysec"
```

| Giá trị | Mất tối đa | Tốc độ ghi |
|---|---|---|
| `always` | ~0 (một lệnh) | Chậm nhất — mỗi lệnh ghi là một `fsync` xuống đĩa |
| `everysec` | **~1 giây** | Mặc định, cân bằng tốt |
| `no` | Tuỳ hệ điều hành (có thể 30 giây) | Nhanh nhất, rủi ro nhất |

**Nhớ con số này để trả lời phỏng vấn:** với cấu hình mặc định `everysec`, mất điện đột ngột làm mất tối
đa **1 giây** dữ liệu ghi.

⚠️ Ngay cả `always` cũng không bảo đảm tuyệt đối — đĩa có cache riêng, và ổ SSD tiêu dùng có thể nói dối
về việc đã ghi xong. Với yêu cầu bền vững thật sự, dùng database chuyên dụng.

### AOF rewrite — tại sao cần và khi nào chạy

File AOF lớn dần vô hạn nếu chỉ nối thêm. `INCR dem` một triệu lần là một triệu dòng, dù kết quả cuối
chỉ là `SET dem 1000000`.

Redis tự chạy `BGREWRITEAOF` khi file lớn gấp đôi so với lần rewrite trước
(`auto-aof-rewrite-percentage 100`) và vượt `auto-aof-rewrite-min-size 64mb`. Rewrite cũng dùng `fork()`,
nên cũng có chi phí copy-on-write như `BGSAVE`.

```
127.0.0.1:6379> INFO persistence
aof_enabled:1
aof_rewrite_in_progress:0
aof_last_bgrewrite_status:ok
aof_last_write_status:ok         ← "err" nghĩa là ĐANG KHÔNG GHI ĐƯỢC xuống đĩa
```

`aof_last_write_status:err` là một trong những dấu hiệu nguy hiểm nhất: Redis vẫn nhận lệnh nhưng không
ghi được AOF (thường do đầy đĩa). Nên gắn alert cho dòng này.

---

## 4. Chọn cấu hình nào

| Redis dùng để | Cấu hình | Lý do |
|---|---|---|
| **Cache thuần** (mất được) | `save ""` — tắt hẳn | Không tốn `fork`, khởi động lại thì cache tự ấm |
| Cache nhưng muốn ấm sẵn sau restart | RDB mặc định | Restart xong có sẵn dữ liệu, không đập DB |
| **Session, giỏ hàng, rate limit** | **AOF `everysec`** | Mất 1 giây chấp nhận được, mất hết thì không |
| Hàng đợi việc (Stream) | **AOF `everysec` + RDB** | Mất việc là mất tiền |
| Cần bền vững tuyệt đối | Không dùng Redis làm nơi lưu chính | Xem mục 6 |

**Bật cả hai cùng lúc là được và thường là lựa chọn đúng.** Khi khởi động, nếu có AOF thì Redis nạp từ
AOF (đầy đủ hơn), RDB dùng để backup và chuyển máy.

Tắt hẳn persistence cho cache thuần:

```bash
$ docker run -d --name redis-cache redis:8-alpine \
    redis-server --save "" --appendonly no --maxmemory 2gb --maxmemory-policy allkeys-lru
```

---

## 5. Backup và khôi phục

**Backup RDB:**

```bash
$ docker exec redis-lab redis-cli BGSAVE
Background saving started
# chờ LASTSAVE đổi giá trị rồi mới copy
$ docker cp redis-lab:/data/dump.rdb ./backup-$(date +%F).rdb
```

Đừng copy `dump.rdb` trong lúc `rdb_bgsave_in_progress:1` — bạn sẽ được một file dở dang.

**Khôi phục:**

```bash
$ docker run -d --name redis-moi -v $(pwd):/data redis:8-alpine
# Redis tự nạp /data/dump.rdb khi khởi động, KHÔNG có lệnh "restore"
```

Điểm dễ sai: nếu container đang chạy có bật AOF, Redis sẽ nạp từ AOF và **bỏ qua** file RDB bạn vừa
chép vào. Muốn khôi phục từ RDB thì phải tắt AOF trước, khởi động, rồi bật lại bằng
`CONFIG SET appendonly yes` (lệnh này kích hoạt một lần rewrite tạo AOF mới từ dữ liệu hiện có).

**Kiểm tra file trước khi tin:**

```bash
$ docker exec redis-lab redis-check-rdb /data/dump.rdb
$ docker exec redis-lab redis-check-aof --fix /data/appendonlydir/appendonly.aof.1.incr.aof
```

**Backup nóng không cần dừng service:** dựng một replica, chờ đồng bộ xong, rồi `BGSAVE` **trên
replica**. Master không phải chịu chi phí `fork`.

---

## 6. Hai cấu hình liên quan hay gây sự cố

### `stop-writes-on-bgsave-error`

```
127.0.0.1:6379> CONFIG GET stop-writes-on-bgsave-error
1) "stop-writes-on-bgsave-error"
2) "yes"
```

Mặc định `yes`: nếu `BGSAVE` **thất bại** (thường do hết đĩa), Redis **từ chối mọi lệnh ghi**:

```
(error) MISCONF Redis is configured to save RDB snapshots, but it is currently not able to persist on disk.
```

Đây là sự cố production kinh điển: đĩa đầy → Redis không lưu được → app không ghi được gì → sập, dù
Redis vẫn đọc bình thường. Cách xử lý ngay: dọn đĩa. Cách xử lý tạm:
`CONFIG SET stop-writes-on-bgsave-error no` — nhưng lúc đó bạn đang **cố ý chấp nhận mất dữ liệu**, phải
biết mình đang làm gì.

### `lazyfree-*` — nên bật hết trên production

```
127.0.0.1:6379> CONFIG GET lazyfree-lazy-expire
2) "no"
127.0.0.1:6379> CONFIG GET lazyfree-lazy-eviction
2) "no"
127.0.0.1:6379> CONFIG GET lazyfree-lazy-server-del
2) "no"
127.0.0.1:6379> CONFIG GET lazyfree-lazy-user-del
2) "no"
```

Mặc định **tắt hết**. Bật lên thì việc giải phóng bộ nhớ của khoá lớn được đẩy sang luồng nền — chính là
biến `DEL` thành `UNLINK` một cách tự động. Nhớ con số từ [bài 01](./01-string-va-key.md): `DEL` một
hash 3 triệu trường treo server **239ms**.

```bash
$ redis-server --lazyfree-lazy-expire yes \
               --lazyfree-lazy-eviction yes \
               --lazyfree-lazy-server-del yes \
               --lazyfree-lazy-user-del yes
```

`lazyfree-lazy-user-del yes` khiến `DEL` hành xử **y hệt** `UNLINK`, kể cả trong code cũ bạn không sửa được.

---

## 7. Bài tập

1. Lặp lại cả ba thí nghiệm ở mục 1 trên máy bạn. Ghi lại kết quả `GET` sau mỗi lần.
2. Bật AOF, ghi 10 khoá, rồi `cat` file `appendonly.aof.1.incr.aof` — bạn thấy gì? Định dạng nó là gì?
3. Làm đầy đĩa của container (`fallocate` hoặc ghi file lớn) rồi `BGSAVE`. Bạn nhận lỗi gì khi `SET`?
4. So sánh thời gian khởi động: nạp 1 triệu khoá, `BGSAVE`, restart và đo; rồi làm lại với AOF.

<details>
<summary>Gợi ý đáp án</summary>

**2.** File `.incr.aof` là **văn bản** theo giao thức RESP. Đo thật sau `SET khoa1 "gia-tri-1"` và
`INCR dem`:
```
*2
$6
SELECT
$1
0
*3
$3
SET
$5
khoa1
$9
gia-tri-1
*2
$4
INCR
$3
dem
```
Và `appendonly.aof.manifest`:
```
file appendonly.aof.1.base.rdb seq 1 type b
file appendonly.aof.1.incr.aof seq 1 type i startoffset 0
```
Đọc được bằng mắt — cũng có nghĩa là **mật khẩu hay dữ liệu nhạy cảm nào bạn `SET` đều nằm nguyên văn
ở đó**. Phân quyền file `/data` cho đúng.

**3.**
```
(error) MISCONF Redis is configured to save RDB snapshots, but it is currently not able to persist
on disk. Commands that may modify the data set are disabled...
```
Đọc thì vẫn được, chỉ ghi bị chặn.

**4.** RDB thường nhanh hơn AOF rõ rệt vì nó nạp một file nhị phân đã tối ưu, còn AOF phải **chạy lại**
từng lệnh. Từ Redis 7 khoảng cách thu hẹp vì AOF có phần nền dạng RDB. Đo bằng
`docker logs <ten> | grep -i "Ready to accept"` và so mốc thời gian.
</details>

---

Tiếp theo: [08-nhan-ban-sentinel-cluster.md](./08-nhan-ban-sentinel-cluster.md)
