# Bài 3 — Docker Compose cho môi trường dev

Chạy 3 container bằng `docker run` thủ công là cực hình: phải nhớ thứ tự, tạo network, gõ hàng chục cờ. Compose khai báo tất cả trong một file YAML, và `docker compose up` là xong.

Mục tiêu bài này: người mới clone repo về, chạy **một lệnh**, có ngay API + Postgres + Redis + hot reload.

---

## 1. File compose đầu tiên

Tạo `docker-compose.yml` ở gốc dự án:

```yaml
name: blog-api

services:
  api:
    build:
      context: .
      target: development        # dùng stage "development" trong Dockerfile
    command: npm run start:dev
    ports:
      - "3000:3000"
      - "9229:9229"              # cổng debugger
    env_file:
      - .env
    environment:
      NODE_ENV: development
      DB_HOST: postgres          # ← tên service, GHI ĐÈ .env
      REDIS_HOST: redis
    volumes:
      - .:/app                   # code máy bạn → container (hot reload)
      - /app/node_modules        # giữ node_modules của image, xem giải thích bên dưới
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    restart: unless-stopped

  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: blog
    ports:
      - "5432:5432"              # để TablePlus trên máy Mac kết nối
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d blog"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
    restart: unless-stopped

  redis:
    image: redis:8-alpine
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "PING"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  adminer:                        # GUI xem database, mở localhost:8080
    image: adminer:latest
    ports:
      - "8080:8080"
    depends_on:
      - postgres
    profiles: ["tools"]           # chỉ chạy khi gọi --profile tools

volumes:
  pgdata:
  redisdata:
```

Chạy:

```bash
docker compose up            # chạy, log hiện ngay terminal
docker compose up -d         # chạy nền
docker compose up --build    # build lại image trước khi chạy
docker compose up --profile tools -d   # kèm cả Adminer
```

Sửa file `.ts` trên máy → NestJS trong container tự reload. Đó là mục tiêu.

---

## 2. Giải thích những chỗ dễ sai

### `DB_HOST: postgres` đặt trong `environment`, không phải `.env`

`.env` của bạn có `DB_HOST=localhost` để chạy NestJS trực tiếp trên máy. Trong container, `localhost` là chính container API → không có Postgres ở đó.

Thứ tự ưu tiên trong Compose: **`environment` thắng `env_file`**. Kiểm chứng bằng hai lệnh:

```bash
$ cat .env | grep DB_HOST
DB_HOST=localhost                 ← trong file .env

$ docker compose config | grep -A1 'DB_HOST'
      DB_HOST: postgres           ← giá trị Compose thực sự dùng

$ docker compose exec api printenv DB_HOST
postgres                          ← giá trị thực trong container
```

Nên bạn giữ nguyên `.env` cho việc chạy ngoài Docker (`npm run start:dev` trên máy Mac), và chỉ ghi đè đúng những biến liên quan tới mạng trong `environment`. Không phải duy trì hai file `.env` khác nhau.

### Cặp volume `.:/app` + `/app/node_modules`

```yaml
volumes:
  - .:/app              # đè /app bằng thư mục máy bạn
  - /app/node_modules   # "che" lại node_modules
```

Dòng 1 làm container thấy code mới nhất. Nhưng nó đè cả `node_modules` mà image đã cài lúc build — nếu máy bạn chưa `npm install` thì container không tìm thấy module nào (`Cannot find module '@nestjs/core'`).

Dòng 2 là anonymous volume, ưu tiên cao hơn vì đường dẫn dài hơn, giữ nguyên `node_modules` từ image. Đây cũng là điều bắt buộc trên macOS: `node_modules` cài trên Mac chứa binary macOS, không chạy được trong container Linux.

**Cài package mới thì phải build lại image:**

```bash
docker compose exec api npm i class-transformer
docker compose up -d --build api
```

Bỏ bước thứ hai thì `package.json` trên máy có package mới, nhưng `node_modules` trong anonymous volume vẫn là bản cũ:

```bash
$ docker compose exec api npm i class-transformer
added 1 package

$ docker compose down && docker compose up -d      # volume cũ được gắn lại
$ docker compose logs api
api | Error: Cannot find module 'class-transformer'   ← package "đã cài" biến mất
```

Cách chắc chắn:

```bash
docker compose down -v          # bỏ anonymous volume cũ (KHÔNG mất pgdata nếu là named volume... xem lưu ý)
docker compose up -d --build
```

> Cẩn thận: `down -v` xoá **mọi** volume của project, kể cả `pgdata`. An toàn hơn là `docker compose up -d --build --force-recreate api` — container mới sẽ tạo anonymous volume mới từ image mới.

### `depends_on` với `condition: service_healthy`

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

`depends_on` dạng đơn giản (chỉ liệt kê tên) **chỉ đợi container khởi động, không đợi Postgres sẵn sàng nhận kết nối**. Postgres mất 2–5 giây để khởi tạo, và trong khoảng đó log của bạn trông như sau:

```bash
$ docker compose up
postgres | The files belonging to this database system will be owned by "postgres".
api      | [Nest] ERROR [TypeOrmModule] Unable to connect to the database. Retrying (1)...
api      | Error: connect ECONNREFUSED 172.19.0.3:5432
postgres | PostgreSQL init process complete; ready for start up.
api      | [Nest] ERROR [TypeOrmModule] Unable to connect to the database. Retrying (2)...
postgres | database system is ready to accept connections    ← giờ mới sẵn sàng
api      | [Nest] LOG [NestApplication] Nest application successfully started
```

Ba dòng `ERROR` đó là hoàn toàn tránh được. Với `condition: service_healthy`, Compose đợi healthcheck pass rồi mới chạy API:

```bash
$ docker compose up
 ✔ Container blog-api-postgres-1  Healthy      3.2s     ← đợi ở đây
 ✔ Container blog-api-api-1       Started      3.4s
api | [Nest] LOG [NestApplication] Nest application successfully started
```

### `pg_isready -U postgres -d blog`

Phải ghi đủ `-U` và `-d`. Thiếu `-U`, `pg_isready` dùng user mặc định là tên OS user đang chạy lệnh, và bạn sẽ thấy container mãi không `healthy`:

```bash
# healthcheck viết thiếu: test: ["CMD-SHELL", "pg_isready"]
$ docker compose ps
NAME       STATUS
postgres   Up 2 minutes (unhealthy)      ← Postgres chạy tốt, nhưng healthcheck sai

$ docker inspect blog-api-postgres-1 --format '{{json .State.Health}}' | jq '.Log[-1].Output'
"localhost:5432 - no response\n"

# Viết đủ tham số
$ docker compose exec postgres pg_isready -U postgres -d blog
/var/run/postgresql:5432 - accepting connections
```

---

## 3. Lệnh Compose hằng ngày

```bash
docker compose up -d               # chạy tất cả (nền)
docker compose ps                  # xem trạng thái + health
docker compose logs -f api         # log của riêng service api
docker compose logs -f             # log tất cả, có màu theo service
docker compose restart api
docker compose stop                # dừng, giữ container
docker compose down                # dừng + xoá container và network (GIỮ volume)
docker compose down -v             # ⚠️ xoá luôn volume — MẤT DATABASE

docker compose exec api sh         # vào shell container api
docker compose exec postgres psql -U postgres -d blog

docker compose build api           # build lại 1 service
docker compose up -d --build api   # build lại rồi thay thế container
docker compose up -d --force-recreate api

docker compose config              # in ra cấu hình đã merge — dùng để debug YAML
```

`docker compose config` là công cụ hay bị bỏ quên: nó cho thấy Compose **thực sự** hiểu file của bạn ra sao sau khi thay biến và merge override:

```bash
$ docker compose config
services:
  api:
    build:
      context: /Users/vanson/Desktop/Learn/blog-api
      target: development
    environment:
      DB_HOST: postgres
      DB_PASSWORD: ""              ← 🚨 biến rỗng! .env thiếu DB_PASSWORD
      JWT_SECRET: doi-secret-nay
      NODE_ENV: development
```

Dòng `DB_PASSWORD: ""` là thứ bạn sẽ không bao giờ thấy nếu chỉ nhìn file gốc. Khi biến môi trường "không vào", chạy lệnh này **trước khi** đoán mò.

---

## 4. Chạy lệnh NestJS bên trong container

```bash
# Nest CLI
docker compose exec api npx nest g resource posts

# TypeORM migration (dev, qua ts-node)
docker compose exec api npm run migration:generate -- src/migrations/AddPosts
docker compose exec api npm run migration:run
docker compose exec api npm run migration:revert

# test
docker compose exec api npm run test
docker compose exec api npm run test:e2e
```

Script tương ứng trong `package.json` (khớp với bộ tài liệu NestJS, dùng `data-source.ts` ở gốc `src/`):

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert"
  }
}
```

> File do `nest g` sinh ra bên trong container thuộc user `node`, nhưng vì `.:/app` là bind mount nên chúng hiện ngay trên máy bạn. Nếu gặp lỗi quyền ghi, xem lỗi #9 ở [bài 06](./06-loi-thuong-gap.md).

---

## 5. Debug NestJS trong container bằng VS Code

Cổng `9229` đã mở ở compose. Sửa script dev để lắng nghe từ ngoài container:

```json
"start:debug": "nest start --debug 0.0.0.0:9229 --watch"
```

`0.0.0.0` là bắt buộc — mặc định debugger chỉ nghe `127.0.0.1` bên trong container, VS Code trên máy không nối vào được.

Đổi `command` của service `api` thành `npm run start:debug`, rồi tạo `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Docker",
      "address": "localhost",
      "port": 9229,
      "restart": true,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app"
    }
  ]
}
```

`localRoot` / `remoteRoot` là phần hay sai: nó ánh xạ đường dẫn file trên máy sang đường dẫn trong container.

```
Trên máy Mac:   /Users/vanson/Desktop/Learn/blog-api/src/posts/posts.service.ts
Trong container: /app/src/posts/posts.service.ts
                 ↑ đây là lý do phải khai remoteRoot: "/app"
```

Thiếu cặp này, breakpoint hiện **vòng tròn xám rỗng** thay vì đỏ đặc, và di chuột vào sẽ thấy `Unverified breakpoint`. Kiểm tra debugger đã mở đúng chưa trước khi attach:

```bash
$ docker compose logs api | grep -i debugger
api | Debugger listening on ws://0.0.0.0:9229/8f2a...
api | For help, see: https://nodejs.org/en/docs/inspector

$ curl -s http://localhost:9229/json/version
{"Browser":"node.js/v24.19.0","Protocol-Version":"1.1"}
```

Nếu `curl` không trả gì, bạn đang thiếu `0.0.0.0` trong script hoặc chưa map cổng 9229.

---

## 6. `compose.override.yml` — tách dev và prod

Compose tự động đọc `docker-compose.override.yml` (nếu có) và merge đè lên `docker-compose.yml`. Cách tổ chức sạch:

**`docker-compose.yml`** — phần dùng chung (image, service, volume, network).

**`docker-compose.override.yml`** — phần chỉ dành cho dev, để lập trình viên chỉnh thoải mái:

```yaml
services:
  api:
    build:
      target: development
    command: npm run start:debug
    volumes:
      - .:/app
      - /app/node_modules
    ports:
      - "9229:9229"
```

**`docker-compose.prod.yml`** — production, gọi tường minh:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Khi chỉ định `-f` tường minh, Compose **không** tự nạp file override nữa — đúng ý ta muốn ở production.

---

## 7. Hot reload trên macOS chậm?

Triệu chứng: bạn Cmd+S nhưng log im lặng.

```bash
# Hoạt động đúng — mỗi lần lưu file phải thấy 2 dòng này
$ docker compose logs -f api
api | [12:04:31] File change detected. Starting incremental compilation...
api | [Nest] LOG [NestApplication] Nest application successfully started

# Không hoạt động — lưu file 5 lần, log vẫn không có gì
```

Kiểm tra xem file có thật sự vào container không (nếu lệnh này ra nội dung mới thì bind mount ổn, vấn đề nằm ở watcher):

```bash
$ echo "// test $(date)" >> src/app.service.ts
$ docker compose exec api tail -1 src/app.service.ts
// test Mon Aug 11 12:07:44 2026        ← file vào rồi, chỉ là watcher không nhận sự kiện
```

Bind mount trên Mac đi qua lớp ảo hoá file system, nên sự kiện `inotify` đôi khi không được chuyển tiếp. Ba cách xử lý, theo thứ tự nên thử:

**1. Bật VirtioFS** — Docker Desktop → Settings → General → chọn VirtioFS. Nhanh hơn gRPC FUSE rõ rệt.

**2. Bật polling cho watcher** (chắc ăn nhất, tốn thêm chút CPU):

```yaml
environment:
  CHOKIDAR_USEPOLLING: "true"
  CHOKIDAR_INTERVAL: "1000"
```

**3. Dùng `develop.watch`** — cơ chế mới của Compose, đồng bộ file thay vì mount cả thư mục:

```yaml
services:
  api:
    develop:
      watch:
        - action: sync
          path: ./src
          target: /app/src
        - action: rebuild
          path: package.json      # đổi dependency → tự build lại image
```

Chạy bằng `docker compose watch`. Cách này giải quyết luôn cả vấn đề `node_modules` lẫn tốc độ, nhưng cần Compose v2.22+.

---

## 8. Quy trình chuẩn cho người mới vào dự án

Ghi vào `README.md` của dự án:

```bash
git clone <repo> && cd blog-api
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run migration:run
curl http://localhost:3000/api/health
```

Năm dòng. Không cài Node, không cài PostgreSQL. Đây chính là giá trị thực tế của Docker.

---

## Bài tập

1. Dựng `docker-compose.yml` như trên cho `blog-api`, chạy `docker compose up -d`, xác nhận `docker compose ps` hiện `postgres` là `(healthy)`.
2. Sửa một dòng trong `app.controller.ts` — log có hiện `File change detected` không? Nếu không, áp dụng mục 7.
3. Xoá `condition: service_healthy` rồi `docker compose down && docker compose up`. Quan sát log API có `ECONNREFUSED` không. Sau đó khôi phục lại.
4. Chạy migration bên trong container và kiểm tra bảng bằng `docker compose exec postgres psql`.
5. Bật Adminer bằng profile, đăng nhập bằng server `postgres` (không phải `localhost`), user/pass `postgres`.
6. Attach debugger VS Code, đặt breakpoint trong một controller và gọi API để nó dừng.

<details>
<summary>Gợi ý đáp án</summary>

3. Rất có thể lần đầu API crash với `ECONNREFUSED postgres:5432` rồi `restart: unless-stopped` mới cứu nó ở lần thử sau. Đó chính xác là điều `condition: service_healthy` loại bỏ.
5. Adminer nằm trong cùng mạng Compose nên phải dùng hostname `postgres`. Gõ `localhost` sẽ báo không kết nối được — đúng nguyên tắc 3 ở bài 00.
</details>

---

Tiếp theo 👉 [04-compose-prod.md](./04-compose-prod.md)
