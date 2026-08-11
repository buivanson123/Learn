# Bài 1 — Lệnh cơ bản (và chạy PostgreSQL cho blog-api)

Docker có hàng trăm lệnh. Bạn dùng khoảng 20 cái cho 95% công việc. Bài này chỉ dạy 20 cái đó, và dùng chúng để dựng database thật cho dự án NestJS.

---

## 1. Chạy container đầu tiên

```bash
docker run --rm hello-world
```

Docker làm 4 việc: không thấy image trong máy → tải từ Docker Hub → tạo container → chạy → in ra → thoát. `--rm` tự xoá container sau khi thoát (nếu không, xác container nằm lại và tích tụ dần).

### Các cờ của `docker run` cần thuộc

| Cờ | Nghĩa |
|---|---|
| `-d` | detached — chạy nền, trả lại terminal |
| `-p 3000:3000` | map cổng `host:container` |
| `--name api` | đặt tên, để gọi bằng tên thay vì ID |
| `-e KEY=value` | truyền biến môi trường |
| `--env-file .env` | truyền cả file biến môi trường |
| `-v pgdata:/var/lib/postgresql/data` | gắn volume |
| `--rm` | tự xoá container khi dừng |
| `-it` | interactive + tty — để vào shell |
| `--network blog` | nối vào mạng chỉ định |

---

## 2. Chạy PostgreSQL cho dự án

Đây là lý do thực tế nhất để dùng Docker: bạn không cần cài PostgreSQL lên máy Mac.

```bash
docker run -d \
  --name blog-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=blog \
  -p 5432:5432 \
  -v blog-pgdata:/var/lib/postgresql/data \
  postgres:18-alpine
```

Giải thích từng dòng:

- `POSTGRES_USER/PASSWORD/DB` — image Postgres đọc 3 biến này để khởi tạo user và database ở lần chạy đầu tiên
- `-p 5432:5432` — để TablePlus và NestJS chạy trên máy Mac kết nối được
- `-v blog-pgdata:/...` — dữ liệu nằm trong volume `blog-pgdata`, xoá container không mất

Kiểm tra:

```bash
docker ps                              # thấy blog-db đang chạy
docker logs blog-db | tail -5          # thấy "database system is ready to accept connections"
docker exec -it blog-db psql -U postgres -d blog -c '\dt'
```

Giờ `.env` của NestJS chạy trên máy (chưa đóng gói) sẽ là:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=blog
```

> Lưu ý: `DB_HOST=localhost` **đúng** ở đây vì NestJS đang chạy trực tiếp trên Mac, không nằm trong container. Khi đóng gói NestJS vào container ở bài 03, giá trị này phải đổi thành tên service.

Thêm Redis (dùng cho cache / blacklist JWT sau này):

```bash
docker run -d --name blog-redis -p 6379:6379 redis:8-alpine
docker exec -it blog-redis redis-cli PING     # PONG
```

---

## 3. Xem và quản lý container

```bash
docker ps                    # đang chạy
docker ps -a                 # tất cả, kể cả đã dừng
docker ps -a --filter status=exited

docker stop blog-db          # dừng (gửi SIGTERM, sau 10s thì SIGKILL)
docker start blog-db         # chạy lại, dữ liệu còn nguyên
docker restart blog-db
docker rm blog-db            # xoá (phải stop trước, hoặc dùng -f)
docker rm -f blog-db
```

`stop` rồi `start` khác hoàn toàn `rm` rồi `run`: cái đầu giữ lớp ghi của container, cái sau tạo container mới tinh. Thấy rõ qua cột `CREATED` và container ID:

```bash
$ docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}'
CONTAINER ID   NAMES     STATUS
a1b2c3d4e5f6   blog-db   Up 10 minutes

$ docker stop blog-db && docker start blog-db
$ docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}'
CONTAINER ID   NAMES     STATUS
a1b2c3d4e5f6   blog-db   Up 2 seconds        ← CÙNG ID, vẫn là container cũ

$ docker rm -f blog-db && docker run -d --name blog-db -e POSTGRES_PASSWORD=postgres postgres:18-alpine
$ docker ps -a --format 'table {{.ID}}\t{{.Names}}\t{{.Status}}'
CONTAINER ID   NAMES     STATUS
9z8y7x6w5v4u   blog-db   Up 2 seconds        ← ID KHÁC, container hoàn toàn mới
```

---

## 4. Đọc log — kỹ năng debug quan trọng nhất

```bash
docker logs blog-db              # toàn bộ log
docker logs -f blog-db           # theo dõi realtime (Ctrl+C để thoát)
docker logs --tail 50 blog-db    # 50 dòng cuối
docker logs -f --since 5m blog-db
```

Container tắt ngay sau khi chạy? `docker logs <tên>` gần như luôn cho bạn câu trả lời. Đừng đoán, đừng Google trước — đọc log trước.

---

## 5. Vào bên trong container

```bash
docker exec -it blog-db bash          # image Debian-based
docker exec -it blog-db sh            # image Alpine (không có bash)
```

Trong container Postgres:

```bash
docker exec -it blog-db psql -U postgres -d blog
```

```sql
\dt              -- liệt kê bảng
\d users         -- mô tả bảng users
\q               -- thoát
```

Chạy lệnh nhanh không cần vào shell:

```bash
docker exec blog-db env | grep POSTGRES
docker exec blog-api node -v
```

> `exec` chạy lệnh trong container **đang chạy**. Container đã dừng thì báo lỗi:
>
> ```bash
> $ docker exec -it blog-api sh
> Error response from daemon: container 3f2a... is not running
> ```
>
> Lúc đó muốn mổ xẻ image thì bỏ qua `CMD` mặc định và vào thẳng shell:
>
> ```bash
> $ docker run -it --rm --entrypoint sh blog-api:1.0
> /app $ ls dist/
> main.js  app.module.js  app.controller.js
> ```
>
> Đây là cách kiểm tra "code của tôi có thật sự nằm trong image không" khi container crash ngay lúc khởi động.

---

## 6. Image

```bash
docker images                    # danh sách image trong máy
docker pull postgres:18-alpine   # tải trước
docker rmi blog-api:1.0          # xoá image
docker history blog-api:1.0      # xem từng layer và kích thước — rất hữu ích khi tối ưu
docker image inspect blog-api:1.0
```

`docker history` là công cụ chính khi bạn muốn biết "vì sao image của tôi to thế". Nó chỉ thẳng layer nào phình:

```bash
$ docker history blog-api:1.0 --format 'table {{.Size}}\t{{.CreatedBy}}' | head -8
SIZE      CREATED BY
0B        CMD ["dumb-init" "node" "dist/main"]
2.1kB     COPY package.json ./
1.8MB     COPY /app/dist ./dist                    ← code của bạn, rất nhỏ
112MB     COPY /app/node_modules ./node_modules    ← thủ phạm chính
1.2MB     RUN apk add --no-cache dumb-init
162MB     /bin/sh -c #(nop) ADD file:... in /      ← image nền node:24-alpine
```

Đọc bảng này bạn biết ngay: muốn giảm image thì phải xử lý `node_modules` (bỏ devDependencies) và image nền — chứ tối ưu code của mình chỉ đụng tới 1.8MB, vô nghĩa.

---

## 7. Volume và network

```bash
docker volume ls
docker volume inspect blog-pgdata
docker volume rm blog-pgdata        # ⚠️ mất sạch dữ liệu database

docker network ls
docker network create blog-net
docker network inspect blog-net     # xem container nào đang trong mạng
```

Chạy thủ công 2 container nói chuyện với nhau:

```bash
docker network create blog-net
docker run -d --name blog-db --network blog-net -e POSTGRES_PASSWORD=postgres postgres:18-alpine
docker run --rm -it --network blog-net postgres:18-alpine \
  psql -h blog-db -U postgres          # ← -h blog-db: gọi bằng TÊN container
```

Chú ý `-h blog-db`, không phải `localhost`. Compose ở bài 03 sẽ tự làm hết phần mạng này cho bạn — nhưng hiểu nó bằng tay một lần thì sau này debug rất nhanh.

---

## 8. Dọn dẹp (Docker ăn ổ cứng rất nhanh)

Trước tiên xem đang tốn ở đâu:

```bash
$ docker system df
TYPE            TOTAL   ACTIVE   SIZE      RECLAIMABLE
Images          24      3        8.412GB   6.981GB (82%)   ← image cũ không dùng
Containers      11      3        1.203GB   980.1MB (81%)   ← container đã dừng
Local Volumes   7       2        2.104GB   1.802GB (85%)   ← ⚠️ có database trong này
Build Cache     142     0        4.331GB   4.331GB         ← cache build, xoá thoải mái
```

Cột `RECLAIMABLE` là phần dọn được. Ở ví dụ trên, chỉ riêng Build Cache đã 4.3GB.

```bash
docker container prune           # xoá container đã dừng
docker image prune               # xoá image không tag (dangling)
docker image prune -a            # xoá mọi image không container nào dùng
docker builder prune             # xoá cache build (thường vài GB)

docker system prune              # gộp các lệnh trên
docker system prune -a --volumes # ⚠️ xoá luôn volume — MẤT DATABASE
```

Thói quen an toàn: chạy `docker system prune` (không có `--volumes`) mỗi tuần. Chỉ thêm `--volumes` khi bạn chắc chắn không còn dữ liệu cần giữ.

---

## 9. Copy file giữa máy và container

```bash
docker cp blog-db:/var/lib/postgresql/data/pg_hba.conf ./
docker cp ./seed.sql blog-db:/tmp/seed.sql
docker exec -it blog-db psql -U postgres -d blog -f /tmp/seed.sql
```

Backup / restore database — nên làm trước mỗi lần chạy migration nguy hiểm:

```bash
docker exec blog-db pg_dump -U postgres blog > backup.sql
cat backup.sql | docker exec -i blog-db psql -U postgres -d blog
```

Chú ý `-i` (không có `t`) khi đẩy dữ liệu vào qua pipe. Gõ nhầm thành `-it` sẽ ra lỗi này:

```bash
$ cat backup.sql | docker exec -it blog-db psql -U postgres -d blog
the input device is not a TTY
```

Còn nếu quên hẳn `-i`, lệnh chạy "thành công" nhưng **không có dữ liệu nào được nạp** — stdin bị bỏ qua và bạn tưởng đã restore xong. Kiểm tra lại luôn bằng:

```bash
$ docker exec blog-db psql -U postgres -d blog -c '\dt'
```

---

## 10. Bảng lệnh tối thiểu phải thuộc lòng

```bash
docker ps                        # cái gì đang chạy
docker logs -f <tên>             # nó đang nói gì
docker exec -it <tên> sh         # vào trong xem
docker stop/start/rm <tên>       # điều khiển
docker images                    # có image gì
docker system df                 # tốn bao nhiêu ổ
```

Sáu lệnh này giải quyết phần lớn tình huống hằng ngày.

---

## Bài tập

1. Chạy PostgreSQL 18 tên `test-db`, database `shop`, port máy là `5433`, có named volume. Tạo một bảng bằng `psql`, xoá container, chạy lại container mới với cùng volume — bảng còn không?
2. Chạy Redis, dùng `docker exec` set key `hello` = `world`, rồi đọc lại.
3. Container `test-db` đang chiếm bao nhiêu dung lượng? Toàn bộ Docker chiếm bao nhiêu?
4. Tạo mạng `shop-net`, đưa 2 container vào, chứng minh chúng gọi nhau được bằng tên.
5. Dọn toàn bộ container đã dừng và image dangling, **không** đụng vào volume.

<details>
<summary>Gợi ý đáp án</summary>

```bash
# 1
docker run -d --name test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shop \
  -p 5433:5432 -v shop-data:/var/lib/postgresql/data postgres:18-alpine
docker exec -it test-db psql -U postgres -d shop -c 'CREATE TABLE t(id int);'
docker rm -f test-db
docker run -d --name test-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shop \
  -p 5433:5432 -v shop-data:/var/lib/postgresql/data postgres:18-alpine
docker exec -it test-db psql -U postgres -d shop -c '\dt'   # bảng t vẫn còn

# 2
docker exec blog-redis redis-cli SET hello world
docker exec blog-redis redis-cli GET hello

# 3
docker ps -s          # cột SIZE
docker system df

# 4
docker network create shop-net
docker run -d --name a --network shop-net redis:8-alpine
docker run --rm -it --network shop-net redis:8-alpine redis-cli -h a PING

# 5
docker container prune && docker image prune
```
</details>

---

Tiếp theo 👉 [02-dockerfile-nestjs.md](./02-dockerfile-nestjs.md)
