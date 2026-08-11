# Bài 4 — Production: migration, healthcheck, Nginx, deploy

Production khác dev ở bốn điểm, và mỗi điểm đều là một lỗi nếu làm sai:

| | Dev | Production |
|---|---|---|
| Code | bind mount từ máy | nướng sẵn trong image |
| Dependency | đủ cả dev | chỉ production |
| Schema DB | `synchronize: true` cũng tạm được | **luôn** dùng migration |
| Secret | file `.env` | biến môi trường của môi trường / secret manager |

---

## 1. `docker-compose.prod.yml`

```yaml
name: blog-api-prod

services:
  api:
    image: ghcr.io/vanson/blog-api:${TAG:-latest}
    build:
      context: .
      target: runner
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      REDIS_HOST: redis
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    restart: unless-stopped
    init: true                      # PID 1 xử lý tín hiệu đúng
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "1.0"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  migrate:
    image: ghcr.io/vanson/blog-api:${TAG:-latest}
    build:
      context: .
      target: runner
    command: ["node", "node_modules/typeorm/cli.js", "migration:run", "-d", "dist/data-source.js"]
    env_file:
      - .env.production
    environment:
      NODE_ENV: production
      DB_HOST: postgres
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"                   # chạy 1 lần rồi thoát

  postgres:
    image: postgres:18-alpine
    env_file:
      - .env.production
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    # KHÔNG mở "ports" — database không được lộ ra Internet
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${DB_USER} -d $${DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:8-alpine
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD}"]
    volumes:
      - redisdata:/data
    restart: unless-stopped

  nginx:
    image: nginx:1.31-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - api
    restart: unless-stopped

volumes:
  pgdata:
  redisdata:
```

Chạy:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Ba chi tiết dễ sai trong file trên

**`$${DB_USER}` trong healthcheck có hai dấu `$`.** Một `$` để Compose không thay biến ở phía nó, mà để nguyên cho shell **bên trong container** xử lý. Viết một `$` thì Compose thay giá trị ngay lúc parse:

```bash
# Viết SAI: test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
$ docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep pg_isready
      - 'pg_isready -U  -d '        ← biến bị nuốt mất, lệnh cụt lủn

# Viết ĐÚNG: test: ["CMD-SHELL", "pg_isready -U $${DB_USER} -d $${DB_NAME}"]
$ docker compose ... config | grep pg_isready
      - pg_isready -U $${DB_USER} -d $${DB_NAME}   ← giữ nguyên, shell trong container tự thay
```

Biến chỉ nằm trong `env_file` thì shell của bạn không hề biết nó, nên Compose thay bằng chuỗi rỗng. Cách kiểm tra nhanh: chạy `docker compose config | grep pg_isready`, nếu thấy `-U` đứng trơ trọi không có gì phía sau là bạn viết thiếu một dấu `$`.

**`condition: service_completed_successfully`.** Đây là cách đúng để chạy migration trước khi API lên: API chỉ khởi động sau khi container `migrate` **thoát với mã 0**.

```bash
# Migration thành công
$ docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
 ✔ Container prod-postgres-1  Healthy                        4.1s
 ✔ Container prod-migrate-1   Exited (0)                     6.8s
 ✔ Container prod-api-1       Started                        7.0s

# Migration lỗi — API KHÔNG được khởi động
$ docker compose ... up -d
 ✔ Container prod-postgres-1  Healthy                        4.0s
 ✘ Container prod-migrate-1   Exited (1)                     5.2s
dependency failed to start: container prod-migrate-1 exited (1)

$ docker compose ... logs migrate
migrate | QueryFailedError: relation "posts" does not exist
```

Nhờ vậy bạn không bao giờ rơi vào tình trạng code mới chạy trên schema cũ — thứ tạo ra lỗi 500 hàng loạt mà log lại chỉ nói `column "slug" does not exist`.

**Không có `ports` ở `postgres`.** Ở dev thì mở 5432 để dùng TablePlus. Ở production, mở ra là mời bot quét cổng — trên một VPS công khai, log Postgres sẽ trông như thế này chỉ sau vài giờ:

```
FATAL: password authentication failed for user "postgres"   (IP 45.x.x.x)
FATAL: password authentication failed for user "admin"      (IP 193.x.x.x)
FATAL: password authentication failed for user "postgres"   (IP 61.x.x.x)
```

Bỏ `ports` đi, `api` vẫn kết nối bình thường qua mạng nội bộ của Compose. Khi bạn cần xem dữ liệu, có hai cách an toàn:

**Cách 1 — vào thẳng server (đơn giản nhất):**

```bash
$ ssh vanson@server.example.com
$ cd /srv/blog-api
$ docker compose exec postgres psql -U blog_user -d blog
```

**Cách 2 — SSH tunnel để dùng TablePlus trên máy Mac.** Cách này cần Postgres mở cổng, nhưng **chỉ trên loopback của server**, không ra Internet:

```yaml
  postgres:
    ports:
      - "127.0.0.1:5432:5432"    # khác hẳn "5432:5432" (= 0.0.0.0, cả thế giới vào được)
```

```bash
# Trên máy Mac
$ ssh -L 5433:localhost:5432 vanson@server.example.com

# Cửa sổ khác: TablePlus trỏ vào localhost:5433
$ psql -h localhost -p 5433 -U blog_user -d blog
```

Kiểm tra bạn đã bind đúng chưa — chạy trên server:

```bash
$ docker compose ps --format 'table {{.Service}}\t{{.Ports}}'
SERVICE    PORTS
postgres   127.0.0.1:5432->5432/tcp     ✅ chỉ loopback
postgres   0.0.0.0:5432->5432/tcp       ❌ mở ra Internet
```

---

## 2. Migration ở production

Ở dev, `npm run migration:run` chạy qua `ts-node`. Image production **không có `ts-node`** (nó là devDependency) — chạy sẽ lỗi ngay:

```bash
$ docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api npm run migration:run
sh: typeorm-ts-node-commonjs: not found
npm error command failed

# Xác nhận: ts-node không có trong image prod
$ docker run --rm blog-api:1.0 ls node_modules/.bin/ | grep -E 'ts-node|typeorm'
typeorm            ← chỉ có typeorm (prod dependency)
```

Cách đúng: dùng `data-source` đã biên dịch.

```ts
// src/data-source.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // dùng .js để chạy được sau khi build; .ts cho dev
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,     // ⚠️ BẮT BUỘC false ở production
  logging: ['error'],
});
```

`synchronize: true` cho TypeORM tự sửa schema theo entity. Ở production nó **xoá cột và mất dữ liệu** khi bạn đổi tên field. Kịch bản cụ thể:

```ts
// Trước: entity có
@Column() fullName: string;

// Bạn đổi tên cho gọn:
@Column() name: string;
```

TypeORM không biết đây là "đổi tên" — nó chỉ thấy `fullName` biến mất và `name` xuất hiện:

```sql
-- Log TypeORM khi khởi động với synchronize: true
query: ALTER TABLE "users" DROP COLUMN "fullName"     ← 50.000 dòng dữ liệu bay
query: ALTER TABLE "users" ADD "name" character varying NOT NULL
```

Không có cảnh báo, không có xác nhận, không undo được. Với migration thì bạn nhìn thấy file SQL sinh ra **trước khi** nó chạy, và tự sửa thành `RENAME COLUMN`. Không bao giờ bật `synchronize` ngoài môi trường dev.

Lệnh trong container production:

```bash
node node_modules/typeorm/cli.js migration:run -d dist/data-source.js
```

Gọi trực tiếp `node_modules/typeorm/cli.js` thay vì `npx typeorm` để không phụ thuộc npx và chắc chắn dùng đúng bản đã cài.

Kiểm tra thủ công:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs migrate
```

---

## 3. Nginx reverse proxy

`./nginx/nginx.conf`:

```nginx
upstream api_upstream {
    server api:3000;          # tên service trong compose
    keepalive 32;
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name api.example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    client_max_body_size 10M;          # cho upload ảnh bài viết

    location / {
        proxy_pass http://api_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection        "";
        proxy_read_timeout 60s;
    }

    location /api/health {
        proxy_pass http://api_upstream;
        access_log off;
    }
}
```

Kèm theo, bật trust proxy trong NestJS để `req.ip` và rate limit đọc đúng IP thật:

```ts
// main.ts
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1);
```

Không có dòng này, mọi request trông như đến từ IP của container Nginx:

```ts
// Log trong một controller: console.log(req.ip)
// KHÔNG có trust proxy:
172.19.0.5      ← IP nội bộ của Nginx, mọi người dùng đều giống nhau
172.19.0.5
172.19.0.5

// CÓ trust proxy:
14.161.22.108   ← IP thật của từng người dùng
203.113.45.9
```

Hậu quả cụ thể: `ThrottlerGuard` đếm theo IP, thấy 1000 request/phút từ "cùng một IP" nên chặn — và nó chặn **toàn bộ** người dùng cùng lúc, kể cả người mới vào lần đầu.

---

## 4. Secret ở production

`.env.production` **không được commit**. Trên server, đặt quyền chặt:

```bash
chmod 600 .env.production
```

```env
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=blog_user
DB_PASSWORD=<chuỗi ngẫu nhiên dài>
DB_NAME=blog
JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN=15m
REDIS_PASSWORD=<chuỗi ngẫu nhiên dài>
```

Sinh secret:

```bash
openssl rand -base64 48
```

Với đội đông người hoặc nhiều môi trường, chuyển sang Docker secrets (đọc từ file, không nằm trong biến môi trường):

```yaml
services:
  api:
    secrets:
      - jwt_secret
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

Rồi trong code đọc file khi có `*_FILE`. Ưu điểm: secret không hiện trong `docker inspect` hay danh sách biến môi trường của tiến trình.

---

## 5. Build ở CI, deploy bằng image có tag

Đừng build trên server production — nó ngốn CPU/RAM của chính máy đang phục vụ người dùng và không tái lập được. Build ở CI, đẩy lên registry, server chỉ `pull`.

`.github/workflows/deploy.yml`:

```yaml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/build-push-action@v6
        with:
          context: .
          target: runner
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

`cache-from/to: type=gha` dùng cache của GitHub Actions — build lần sau chỉ chạy lại layer đã đổi, thường giảm từ 4 phút xuống dưới 1 phút.

Trên server:

```bash
export TAG=<git sha>
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker image prune -f
```

Tag bằng git SHA chứ không phải `latest` — để rollback là đổi một biến:

```bash
# Bản đang chạy hỏng, cần quay về bản trước
$ git log --oneline -3
a3f9c21 (HEAD) thêm tính năng comment      ← bản lỗi đang chạy
7b2e4d8 sửa validation DTO                 ← bản tốt gần nhất
1c8a0f5 khởi tạo auth module

$ TAG=7b2e4d8 docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait
 ✔ Container prod-api-1  Healthy    12.1s

$ curl -s https://api.example.com/api/health
{"status":"ok","uptime":11.8}
```

Rollback mất chưa tới 30 giây vì image `7b2e4d8` đã nằm sẵn trên server. Nếu bạn tag bằng `latest`, image cũ đã bị ghi đè và cách duy nhất là build lại từ code — mất 5–10 phút trong lúc production đang lỗi.

---

## 6. Zero-downtime cơ bản

Với Compose (không dùng Swarm/K8s), cách đơn giản mà hiệu quả:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --wait api
```

- `--no-deps` — không restart Postgres/Redis theo
- `--wait` — chờ healthcheck của `api` pass rồi mới trả về

`--wait` biến script deploy thành thứ tự dừng được khi bản mới hỏng:

```bash
# Bản mới OK
$ docker compose ... up -d --no-deps --wait api
 ✔ Container prod-api-1  Healthy    18.4s
$ echo $?
0

# Bản mới crash lúc khởi động
$ docker compose ... up -d --no-deps --wait api
 ✘ Container prod-api-1  Error      63.2s
container prod-api-1 is unhealthy
$ echo $?
1                    ← script deploy dừng ở đây, chưa kịp làm gì tệ hơn
```

Trong script deploy, tận dụng exit code đó:

```bash
set -e                                    # gặp lỗi là dừng toàn bộ script
docker compose ... up -d --no-deps --wait api
echo "Deploy thành công"
```

Kết hợp đủ ba thứ này thì request đang chạy không bị cắt:

1. `HEALTHCHECK` trong Dockerfile
2. `app.enableShutdownHooks()` trong `main.ts`
3. `init: true` (hoặc `dumb-init`) để Node nhận được SIGTERM

Thiếu (2) hoặc (3), `docker stop` sẽ SIGKILL sau 10 giây và mọi request dở dang đứt giữa chừng.

---

## 7. Backup database

Backup thủ công trước mỗi lần deploy có migration:

```bash
docker compose exec -T postgres pg_dump -U blog_user blog | gzip > backup-$(date +%F-%H%M).sql.gz
```

Restore:

```bash
gunzip -c backup-2026-08-10-1430.sql.gz | docker compose exec -T postgres psql -U blog_user -d blog
```

`-T` tắt cấp phát TTY. Thiếu nó, lệnh backup **trông như thành công** nhưng file ra rỗng:

```bash
# Thiếu -T
$ docker compose exec postgres pg_dump -U blog_user blog | gzip > backup.sql.gz
the input device is not a TTY
$ ls -lh backup.sql.gz
-rw-r--r--  1 vanson  staff    20B  backup.sql.gz     ← 20 byte, không có gì cả

# Có -T
$ docker compose exec -T postgres pg_dump -U blog_user blog | gzip > backup.sql.gz
$ ls -lh backup.sql.gz
-rw-r--r--  1 vanson  staff   4.2M  backup.sql.gz     ← đúng
```

Luôn kiểm tra kích thước file ngay sau khi backup. Một file 20 byte là backup rỗng, và bạn chỉ phát hiện ra vào đúng lúc cần restore.

Tự động hằng ngày bằng cron trên host:

```cron
0 2 * * * cd /srv/blog-api && docker compose exec -T postgres pg_dump -U blog_user blog | gzip > /backup/blog-$(date +\%F).sql.gz
```

Backup chưa từng restore thử thì chưa phải backup. Test restore vào một database tạm mỗi tháng một lần.

---

## 8. Checklist trước khi lên production

- [ ] `.dockerignore` có `.env`, `node_modules`, `.git`
- [ ] Dockerfile có `USER node` — không chạy root
- [ ] `NODE_ENV=production` và chỉ cài prod dependency
- [ ] `synchronize: false`, schema quản lý bằng migration
- [ ] Postgres **không** mở `ports` ra ngoài
- [ ] `JWT_SECRET` sinh ngẫu nhiên, khác hẳn môi trường dev
- [ ] Có `HEALTHCHECK` và `restart: unless-stopped`
- [ ] Giới hạn log (`max-size`, `max-file`) — tránh log ăn hết ổ
- [ ] Giới hạn RAM/CPU
- [ ] Image tag bằng git SHA, không dùng `latest`
- [ ] Có backup tự động và đã thử restore
- [ ] `app.enableShutdownHooks()` + `init: true`
- [ ] Đã quét lỗ hổng: `docker scout cves blog-api:1.0`

---

## Bài tập

1. Viết `docker-compose.prod.yml`, chạy trên máy Mac, xác nhận `migrate` chạy xong và thoát mã 0 trước khi `api` khởi động (xem `docker compose ps -a`).
2. Cố tình làm migration lỗi (đổi tên bảng không tồn tại). API có bị chặn không lên không?
3. Thêm Nginx, gọi `http://localhost/api/health` qua Nginx thay vì gọi thẳng port 3000.
4. Dựng healthcheck rồi `docker compose stop api`, đo xem mất bao lâu để dừng. Bỏ `init: true` rồi đo lại — chênh nhau bao nhiêu?
5. Backup database ra file `.sql.gz`, `docker compose down -v`, dựng lại và restore. Dữ liệu có về đủ không?

<details>
<summary>Gợi ý đáp án</summary>

2. Không lên. `service_completed_successfully` chỉ pass khi exit code = 0. Đây là hàng rào an toàn quan trọng nhất của quy trình deploy.
4. Có `init: true` → dừng gần như tức thì (dưới 1s). Không có → đúng 10 giây, vì Docker gửi SIGTERM, Node bỏ qua, hết `stop_grace_period` mới SIGKILL.
</details>

---

Tiếp theo 👉 [05-toi-uu.md](./05-toi-uu.md)
