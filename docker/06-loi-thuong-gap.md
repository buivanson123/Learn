# Bài 6 — 18 lỗi thường gặp và cách sửa

Sắp theo tần suất gặp thực tế. Mỗi lỗi có: thông báo bạn nhìn thấy → nguyên nhân → cách sửa.

---

## 1. `ECONNREFUSED 127.0.0.1:5432`

**Nguyên nhân:** Trong container API, `localhost` là chính nó, không phải container Postgres.

**Sửa:** Dùng tên service.

```yaml
services:
  api:
    environment:
      DB_HOST: postgres     # ← tên service, không phải localhost
```

Vẫn giữ `DB_HOST=localhost` trong `.env` để chạy NestJS trực tiếp trên máy — `environment` của Compose luôn thắng `env_file`.

---

## 2. `Cannot find module '@nestjs/core'`

**Nguyên nhân:** Bind mount `.:/app` đè `node_modules` của image bằng thư mục máy bạn (thường là rỗng hoặc chứa binary macOS).

**Sửa:** Thêm anonymous volume che lại.

```yaml
volumes:
  - .:/app
  - /app/node_modules     # ← dòng này
```

Nếu vẫn lỗi, volume cũ còn sót:

```bash
docker compose down -v && docker compose up --build
```

---

## 3. Sửa code mà container không thay đổi

**Nguyên nhân:** Code đã nướng vào image lúc build; container chạy image cũ.

**Chẩn đoán — so sánh file trên máy với file trong container:**

```bash
$ grep -n "Hello" src/app.service.ts
7:    return 'Hello Vanson!';          ← bạn vừa sửa

$ docker compose exec api grep -n "Hello" dist/app.service.js
7:    return 'Hello World!';           ← image vẫn giữ bản cũ
```

**Sửa (dev):** Bind mount + `npm run start:dev` (xem [bài 03](./03-compose-dev.md)).

**Sửa (khi cần build lại):**

```bash
$ docker compose restart api          # ❌ chỉ khởi động lại container cũ, image không đổi
$ docker compose up -d --build api    # ✅ build image mới rồi thay container
 => [build 3/3] RUN npm run build      9.7s
 ✔ Container blog-api-api-1  Started
```

Không có `--build` thì Compose dùng lại image cũ, kể cả khi bạn vừa sửa Dockerfile.

---

## 4. Hot reload không chạy trên macOS

**Nguyên nhân:** Sự kiện file system không truyền qua lớp ảo hoá của Docker Desktop.

**Sửa:**

```yaml
environment:
  CHOKIDAR_USEPOLLING: "true"
  CHOKIDAR_INTERVAL: "1000"
```

Kèm bật VirtioFS trong Docker Desktop → Settings → General. Hoặc chuyển sang `docker compose watch` (xem [bài 03](./03-compose-dev.md), mục 7).

---

## 5. `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Nguyên nhân:** Cổng 3000 đang bị chiếm — thường là NestJS bạn chạy trực tiếp trên máy, hoặc container cũ.

**Sửa — tìm thủ phạm trước:**

```bash
$ lsof -i :3000
COMMAND   PID    USER   FD   TYPE  NODE NAME
node    41285  vanson   23u  IPv6  TCP  *:3000 (LISTEN)     ← NestJS chạy trên máy Mac

$ kill 41285                        # tắt nó đi
# hoặc nếu là container cũ:
$ docker ps -a --filter publish=3000
CONTAINER ID   IMAGE       PORTS                    NAMES
8a3f2b1c...    blog-api    0.0.0.0:3000->3000/tcp   api-cu
$ docker rm -f api-cu
```

Hoặc đổi cổng phía host, giữ nguyên cổng trong container:

```yaml
ports:
  - "3001:3000"     # truy cập qua http://localhost:3001
```

---

## 6. Container vừa chạy đã tắt

**Nguyên nhân:** Tiến trình chính thoát. Container sống đúng bằng tuổi thọ của `CMD`.

**Chẩn đoán:**

```bash
docker compose ps -a          # xem cột EXIT CODE
docker compose logs api       # đọc lỗi thật
```

| Exit code | Nghĩa |
|---|---|
| 0 | Chạy xong bình thường (đúng với service `migrate`) |
| 1 | Ứng dụng crash — đọc log |
| 137 | Bị SIGKILL, thường là OOM. Kiểm tra `docker inspect <tên> \| grep OOMKilled` |
| 143 | Nhận SIGTERM — do `docker stop`, bình thường |
| 127 | Không tìm thấy lệnh — sai `CMD` hoặc thiếu package |

---

## 7. `depends_on` không đợi database sẵn sàng

**Triệu chứng:** API crash lần đầu với `ECONNREFUSED postgres:5432`, khởi động lại vài lần mới chạy.

**Nguyên nhân:** `depends_on` mặc định chỉ đợi container **start**, không đợi Postgres nhận kết nối.

**Sửa:** Healthcheck + condition.

```yaml
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d blog"]
      interval: 5s
      retries: 10

  api:
    depends_on:
      postgres:
        condition: service_healthy
```

---

## 8. Đổi `POSTGRES_PASSWORD` mà không có tác dụng

**Triệu chứng:** Bạn đổi mật khẩu trong `docker-compose.yml`, `up -d` lại, và API báo:

```
api | error: password authentication failed for user "postgres"
```

Còn log Postgres thì nói thẳng lý do:

```bash
$ docker compose logs postgres | head -3
postgres | PostgreSQL Database directory appears to contain a database;
postgres | Skipping initialization                    ← bỏ qua mọi biến POSTGRES_*
postgres | database system is ready to accept connections
```

**Nguyên nhân:** Ba biến `POSTGRES_USER/PASSWORD/DB` **chỉ có tác dụng khi volume rỗng**, tức lần khởi tạo đầu tiên. Volume đã có dữ liệu thì Postgres in dòng `Skipping initialization` và giữ nguyên mật khẩu cũ.

**Sửa (dev, chấp nhận mất dữ liệu):**

```bash
docker compose down -v && docker compose up -d
```

**Sửa (production, giữ dữ liệu):**

```bash
docker compose exec postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'moi';"
```

---

## 9. `EACCES: permission denied, open '/app/...'`

**Nguyên nhân:** `USER node` (uid 1000) nhưng file thuộc `root`, hoặc app ghi vào thư mục không có quyền.

**Sửa:**

```dockerfile
COPY --chown=node:node --from=build /app/dist ./dist
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
```

Ở dev với bind mount trên macOS thì thường không gặp (Docker Desktop tự xử lý uid). Trên Linux thì hay gặp — khi đó truyền uid host vào:

```yaml
user: "${UID:-1000}:${GID:-1000}"
```

---

## 10. `getaddrinfo ENOTFOUND postgres`

**Nguyên nhân:** Hai container không cùng mạng, hoặc bạn gõ sai tên service.

**Sửa:**

```bash
docker network ls
docker compose ps                     # tên service chính xác
docker compose exec api ping -c 2 postgres
docker compose exec api getent hosts postgres
```

Nếu chạy bằng `docker run` thủ công, phải thêm `--network <tên mạng>`.

---

## 11. Image quá lớn (1GB+)

**Nguyên nhân:** Base image đầy đủ, còn devDependencies, thiếu `.dockerignore`.

**Sửa:** Xem [bài 05](./05-toi-uu.md). Ba việc theo thứ tự tác động: `alpine` → multi-stage → `.dockerignore`.

```bash
docker history blog-api:1.0    # tìm layer phình
```

---

## 12. Build rất chậm mỗi lần sửa code

**Nguyên nhân:** `COPY . .` đặt trước `RUN npm ci` → cache hỏng liên tục.

**Sửa:**

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

Kiểm chứng: build lần hai phải thấy `CACHED` ở dòng `npm ci`.

---

## 13. Biến môi trường không vào được container

**Chẩn đoán trước khi đoán:**

```bash
docker compose config              # xem Compose hiểu file của bạn thế nào
docker compose exec api env | sort # xem biến thực tế trong container
docker compose exec api printenv DB_HOST
```

**Các nguyên nhân theo thứ tự hay gặp:**

- `.env` bị `.dockerignore` loại nhưng bạn lại `COPY` nó vào image (không cần — hãy truyền qua `env_file` của Compose)
- `environment` ghi đè mất giá trị bạn muốn (đây là hành vi đúng, chỉ là bạn quên)
- Giá trị có ký tự `$` — phải escape thành `$$` trong file compose
- Sửa `.env` nhưng chưa recreate container: `docker compose up -d --force-recreate api`

---

## 14. Migration chạy được ở dev, lỗi ở production

**Nguyên nhân:** Script dev dùng `typeorm-ts-node-commonjs`, nhưng `ts-node` là devDependency và không có trong image production.

**Sửa:** Dùng data-source đã biên dịch.

```bash
node node_modules/typeorm/cli.js migration:run -d dist/data-source.js
```

Và đảm bảo `data-source.ts` khai báo glob có cả `.js`:

```ts
entities: [__dirname + '/**/*.entity{.ts,.js}'],
migrations: [__dirname + '/migrations/*{.ts,.js}'],
```

---

## 15. `no matching manifest for linux/arm64` (Apple Silicon)

**Thông báo đầy đủ:**

```bash
$ docker compose up -d
no matching manifest for linux/arm64/v8 in the manifest list entries
```

**Kiểm tra image hỗ trợ kiến trúc nào:**

```bash
$ docker manifest inspect postgres:18-alpine | grep architecture
      "architecture": "amd64",
      "architecture": "arm64",     ← có cả hai, chạy tốt trên Mac M-series

$ docker manifest inspect some/old-image:1.0 | grep architecture
      "architecture": "amd64",     ← chỉ có amd64
```

**Nguyên nhân:** Image chỉ có bản amd64.

**Sửa tạm (chạy qua emulation, chậm hơn):**

```yaml
services:
  legacy:
    image: some/old-image:1.0
    platform: linux/amd64
```

**Build image đa kiến trúc cho CI/production:**

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/vanson/blog-api:1.0 --push .
```

Lưu ý ngược lại: build trên Mac M-series mặc định ra arm64, đẩy lên server amd64 sẽ báo `exec format error`. Luôn build qua CI (`ubuntu-latest` → amd64) hoặc dùng `buildx` với `--platform` tường minh.

---

## 16. `bcrypt` lỗi trên Alpine

**Thông báo:** `Error loading shared library ... invalid ELF header` hoặc `node-pre-gyp` build lỗi.

**Nguyên nhân:** Alpine dùng musl libc; binary biên dịch sẵn của `bcrypt` build cho glibc.

**Sửa (theo thứ tự nên thử):**

1. Chuyển sang `bcryptjs` — thuần JS, không cần biên dịch
2. Hoặc đổi base sang `node:24-slim`
3. Hoặc cài toolchain trong stage build: `RUN apk add --no-cache python3 make g++`

Cách 1 đơn giản nhất và không phải trả giá gì đáng kể ở quy mô blog API.

---

## 17. Docker ăn hết ổ cứng

```bash
docker system df               # xem chi tiết
docker system df -v            # xem từng image/volume
```

**Sửa:**

```bash
docker container prune
docker image prune -a
docker builder prune           # cache build thường vài GB
docker system prune            # gộp (KHÔNG đụng volume)
```

Trên macOS, ổ ảo của Docker Desktop **không tự co lại** sau khi prune. Vào Settings → Resources → Advanced để chỉnh disk limit, hoặc Troubleshoot → Reset disk image (mất tất cả).

Phòng ngừa: đặt giới hạn log trong mọi service (xem [bài 05](./05-toi-uu.md), mục 6).

---

## 18. `docker compose down -v` xoá mất database

**Nguyên nhân:** `-v` xoá cả named volume.

**Không sửa được** nếu chưa backup. Đây là lý do tồn tại mục backup ở [bài 04](./04-compose-prod.md).

**Phòng ngừa:** Tạo alias để không bao giờ gõ nhầm ở máy production:

```bash
# ~/.zshrc
alias dcd='docker compose down'          # không có -v
alias dcdv='echo "⚠️  Xoá volume! Gõ đầy đủ lệnh nếu chắc chắn."'
```

---

## Quy trình debug 5 bước

Gặp bất kỳ lỗi Docker nào, làm theo thứ tự này trước khi Google:

```bash
docker compose ps -a           # 1. Container nào chết? Exit code bao nhiêu?
docker compose logs -f api     # 2. Nó nói gì?
docker compose exec api sh     # 3. Vào trong xem thật
docker compose exec api env    # 4. Biến môi trường có đúng không?
docker compose config          # 5. Compose hiểu file của tôi thế nào?
```

Năm lệnh này giải quyết được phần lớn tình huống, và quan trọng hơn — chúng cho bạn **dữ liệu** thay vì phỏng đoán.

---

Tiếp theo 👉 [07-cheatsheet.md](./07-cheatsheet.md)
