# Bài 2 — Dockerfile cho NestJS

Đây là file quan trọng nhất của tài liệu. Cuối bài bạn có một Dockerfile production dùng được thật, và hiểu **vì sao từng dòng nằm ở đó**.

---

## 1. Dockerfile là gì

Là công thức để build image. Mỗi instruction tạo một layer.

```dockerfile
FROM node:24-alpine     # bắt đầu từ image nền
WORKDIR /app            # đặt thư mục làm việc
COPY package*.json ./   # chép file từ máy vào image
RUN npm ci              # chạy lệnh LÚC BUILD
CMD ["node", "dist/main"]  # lệnh chạy LÚC CONTAINER KHỞI ĐỘNG
```

Phân biệt sống còn: `RUN` chạy khi **build image**, kết quả nằm luôn trong image. `CMD` chạy khi **container start**, không nằm trong image.

Thử bằng một Dockerfile 4 dòng:

```dockerfile
FROM alpine:3.24
RUN echo "chay luc BUILD" > /luc-build.txt
CMD ["cat", "/luc-build.txt"]
```

```bash
$ docker build -t thu-nghiem .
 => [2/2] RUN echo "chay luc BUILD" > /luc-build.txt    0.3s   ← chạy NGAY BÂY GIỜ
Successfully tagged thu-nghiem:latest
# "cat" chưa hề chạy

$ docker run --rm thu-nghiem
chay luc BUILD                                          ← giờ CMD mới chạy

$ docker run --rm thu-nghiem ls /                       ← ghi đè CMD từ dòng lệnh
bin  dev  etc  luc-build.txt  home ...
```

Hệ quả thực tế: viết `RUN npm run start:dev` trong Dockerfile là sai — build sẽ treo vĩnh viễn vì server không bao giờ thoát. Lệnh khởi động app luôn thuộc về `CMD`.

### Các instruction bạn thực sự dùng

| Instruction | Việc nó làm |
|---|---|
| `FROM` | Chọn image nền. Có thể có nhiều `FROM` (multi-stage) |
| `WORKDIR` | `cd` + tự tạo thư mục nếu chưa có |
| `COPY src dest` | Chép từ build context vào image |
| `RUN` | Chạy lệnh lúc build, tạo layer mới |
| `ENV` | Biến môi trường, tồn tại cả lúc build lẫn lúc chạy |
| `ARG` | Biến **chỉ** lúc build |
| `EXPOSE` | Tài liệu hoá cổng (không tự mở port — vẫn cần `-p`) |
| `USER` | Đổi user chạy tiến trình |
| `HEALTHCHECK` | Cách Docker biết app còn sống |
| `CMD` | Lệnh mặc định, ghi đè được từ dòng lệnh |
| `ENTRYPOINT` | Lệnh cố định, `CMD` trở thành tham số của nó |

`EXPOSE` là instruction hay bị hiểu nhầm nhất — nó **không** mở cổng, chỉ ghi chú lại:

```bash
# Dockerfile có EXPOSE 3000, nhưng chạy không kèm -p
$ docker run -d --name api blog-api:1.0
$ curl http://localhost:3000/api/health
curl: (7) Failed to connect to localhost port 3000: Connection refused

# Phải có -p mới truy cập được từ máy Mac
$ docker rm -f api && docker run -d --name api -p 3000:3000 blog-api:1.0
$ curl http://localhost:3000/api/health
{"status":"ok","uptime":2.14}
```

Giá trị của `EXPOSE` là cho người đọc Dockerfile biết app nghe cổng nào, và cho `docker run -P` (chữ P hoa) tự map ngẫu nhiên.

---

## 2. Bản ngây thơ — và 5 vấn đề của nó

Đây là thứ hầu hết người mới viết:

```dockerfile
FROM node:24
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

Nó **chạy được**. Nhưng:

| Vấn đề | Hậu quả |
|---|---|
| `node:24` (không phải alpine/slim) | Image ~1.25GB |
| `COPY . .` trước `npm install` | Sửa 1 dòng code → cài lại toàn bộ dependency, build 3 phút |
| Giữ nguyên devDependencies | Thêm ~200MB rác: Jest, ESLint, ts-node, @types/* |
| Giữ nguyên source `.ts` | Code nguồn bị mang lên production |
| Chạy bằng `root` | Ai thoát được khỏi container là có root |

Ta sửa từng cái.

---

## 3. `.dockerignore` — làm trước cả Dockerfile

Docker gửi **toàn bộ thư mục hiện tại** (build context) cho engine trước khi build. Bạn thấy nó ở dòng đầu tiên của mỗi lần build:

```bash
# Chưa có .dockerignore
$ docker build -t blog-api:1.0 .
 => [internal] load build context
 => => transferring context: 431.28MB    12.4s     ← gửi cả node_modules và .git

# Sau khi thêm .dockerignore
$ docker build -t blog-api:1.0 .
 => [internal] load build context
 => => transferring context: 284.71kB    0.1s      ← nhanh hơn 100 lần
```

Tệ hơn cả sự chậm chạp: `node_modules` của máy Mac bị `COPY . .` chép đè vào image, mang binary biên dịch cho macOS/arm64 vào image Linux. Kết quả là container chạy được trên máy bạn nhưng chết ở server với:

```
Error: /app/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node:
invalid ELF header
```

Tạo `.dockerignore` cạnh `Dockerfile`:

```gitignore
node_modules
dist
coverage
.git
.gitignore
.env
.env.*
!.env.example
*.log
npm-debug.log*
.DS_Store
.vscode
.idea
test
**/*.spec.ts
Dockerfile*
docker-compose*.yml
README.md
```

> Việc loại `.env` ở đây là quy tắc bảo mật, không phải tuỳ chọn. Secret lọt vào image là lọt vĩnh viễn — nó nằm trong layer, ai `docker history` hoặc pull image cũng đọc được, kể cả khi bạn `RUN rm .env` ở dòng sau.

---

## 4. Multi-stage build — chìa khoá của mọi tối ưu

Ý tưởng: dùng một stage "nặng" để build (có đủ TypeScript, devDependencies), rồi chỉ **copy thành phẩm** sang một stage cuối sạch sẽ. Mọi thứ ở stage trung gian bị vứt bỏ.

```
[deps]     cài full dependency  ──┐
[build]    tsc → dist/            ─┼──▶ [runner] chỉ dist/ + prod node_modules
[prod-deps] cài prod dependency ──┘        ~275MB
```

### Dockerfile hoàn chỉnh cho blog-api

Tạo file `Dockerfile` ở thư mục gốc dự án NestJS:

```dockerfile
# syntax=docker/dockerfile:1

###############################################
# Stage 1: base — nền chung cho mọi stage
###############################################
FROM node:24-alpine AS base
WORKDIR /app
# dumb-init: nhận SIGTERM và chuyển cho Node, để app tắt êm (graceful shutdown)
RUN apk add --no-cache dumb-init

###############################################
# Stage 2: deps — cài TOÀN BỘ dependency (có dev) để build
###############################################
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

###############################################
# Stage 3: prod-deps — chỉ dependency production
###############################################
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

###############################################
# Stage 4: build — biên dịch TypeScript
###############################################
FROM deps AS build
COPY . .
RUN npm run build          # sinh ra dist/

###############################################
# Stage 5: development — dùng cho docker compose lúc dev
###############################################
FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

###############################################
# Stage 6: runner — image production cuối cùng
###############################################
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build     --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./

USER node                  # image node có sẵn user "node" (uid 1000)
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["dumb-init", "node", "dist/main"]
```

### Giải thích các quyết định

**`node:24-alpine`** — Alpine ~162MB thay vì ~1.25GB của bản đầy đủ:

```bash
$ docker images node
REPOSITORY   TAG          SIZE
node         24           1.25GB
node         24-slim      248MB
node         24-alpine    162MB
```

Đánh đổi: Alpine dùng musl libc thay glibc, nên vài package native (`bcrypt`, `sharp`, `canvas`) có thể lỗi lúc build:

```bash
$ docker build -t blog-api:1.0 .
 > [deps 3/3] RUN npm ci:
npm error gyp ERR! find Python
npm error gyp ERR! stack Error: Could not find any Python installation to use
npm error command failed: node-pre-gyp install --fallback-to-build
```

Gặp lỗi này thì đổi `FROM node:24-alpine` thành `FROM node:24-slim` (Debian, ~220MB) — vẫn nhỏ hơn nhiều so với bản đầy đủ. Với riêng `bcrypt`, cách gọn hơn là bỏ hẳn native module:

```bash
npm remove bcrypt @types/bcrypt
npm i bcryptjs && npm i -D @types/bcryptjs
```

```ts
// auth.service.ts — chỉ đổi dòng import, API giống hệt
import * as bcrypt from 'bcryptjs';   // trước là 'bcrypt'
```

**`npm ci` chứ không `npm install`** — `ci` xoá sạch `node_modules` rồi cài đúng theo `package-lock.json`, không bao giờ tự sửa lock file:

```bash
# npm install: có thể âm thầm nâng version và ghi lại package-lock.json
$ docker build ... # image hôm nay có @nestjs/core 11.0.3
$ docker build ... # image tuần sau có @nestjs/core 11.2.1 — không ai yêu cầu

# npm ci: lock file sai một dấu chấm là dừng ngay, không đoán mò
$ npm ci
npm error `npm ci` can only install packages when your package.json and
npm error package-lock.json are in sync.
```

Build phải tái lập được y hệt mỗi lần — đó là toàn bộ lý do dùng Docker.

**Chép `package*.json` trước, `COPY . .` sau** — đây là điểm mấu chốt của cache. `package.json` ít khi đổi, nên layer `npm ci` được tái sử dụng:

```bash
$ vim src/app.service.ts          # sửa 1 dòng code
$ docker build -t blog-api:1.1 .
 => CACHED [deps 2/3] COPY package.json package-lock.json ./
 => CACHED [deps 3/3] RUN npm ci                              ← không chạy lại
 => [build 2/3] COPY . .                                0.4s
 => [build 3/3] RUN npm run build                       9.8s
 => exporting to image                                  1.2s
Build finished in 11.6s          ← thay vì 3 phút
```

**Tách `prod-deps` riêng thay vì `npm prune --omit=dev`** — hai stage `deps` và `prod-deps` không phụ thuộc nhau nên BuildKit chạy song song (bạn thấy hai dòng `RUN npm ci` cùng chạy trong output), và cache của chúng độc lập.

Khác biệt về kết quả:

```bash
$ docker run --rm blog-api:1.0 sh -c 'ls node_modules | wc -l'
312                # chỉ prod dependency

$ docker run --rm blog-api:dev sh -c 'ls node_modules | wc -l'
847                # có cả jest, eslint, ts-node, @types/*
```

**`USER node`** — không chạy bằng root. Image `node:*` đã có sẵn user `node` uid 1000:

```bash
$ docker run --rm blog-api:1.0 whoami
node

$ docker run --rm blog-api:1.0 id
uid=1000(node) gid=1000(node)

# Bỏ dòng USER node đi thì thành:
$ docker run --rm blog-api:no-user whoami
root               ← ai thoát được khỏi container là có root trên host
```

Kèm `--chown=node:node` khi copy để user này đọc được file. Thiếu nó, file thuộc `root` và app báo `EACCES: permission denied`.

**`dumb-init`** — Node chạy ở PID 1 không xử lý SIGTERM theo mặc định. Đo thử:

```bash
# Không có dumb-init
$ time docker stop api
api
real    0m10.284s        ← Docker gửi SIGTERM, Node phớt lờ, 10s sau mới SIGKILL

# Có dumb-init + enableShutdownHooks()
$ time docker stop api
api
real    0m0.427s         ← app đóng kết nối DB, trả nốt request rồi thoát
```

Mười giây đó không chỉ là chờ đợi — mọi request đang xử lý dở đều bị cắt ngang khi SIGKILL đến. Nhớ bật thêm ở `main.ts`:

```ts
app.enableShutdownHooks();
```

**`HEALTHCHECK`** — cần một endpoint. Thêm vào NestJS:

```ts
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Public()                       // JwtAuthGuard toàn cục sẽ chặn nếu thiếu decorator này
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
```

Đường dẫn là `/api/health` vì `main.ts` có `app.setGlobalPrefix('api')`.

Sau khi build lại, Docker tự gọi endpoint này mỗi 30 giây và báo trạng thái ở cột `STATUS`:

```bash
$ docker ps --format 'table {{.Names}}\t{{.Status}}'
NAMES   STATUS
api     Up 8 seconds (health: starting)     ← trong start-period, chưa tính
api     Up 35 seconds (healthy)             ← endpoint trả 200
api     Up 2 minutes (unhealthy)            ← 3 lần liên tiếp thất bại
```

Xem chi tiết vì sao `unhealthy`:

```bash
$ docker inspect api --format '{{json .State.Health}}' | jq '.Log[-1]'
{
  "ExitCode": 1,
  "Output": "wget: server returned error: HTTP/1.1 401 Unauthorized"
}
```

Đây chính là lỗi bạn sẽ gặp nếu quên `@Public()` — `JwtAuthGuard` toàn cục chặn luôn cả healthcheck.

**`CMD` dạng mảng (exec form)** — `CMD ["node", "dist/main"]` chạy Node trực tiếp. `CMD node dist/main` (shell form) chạy qua `/bin/sh -c`, khiến shell làm PID 1 và nuốt tín hiệu. Nhìn vào bảng tiến trình là thấy:

```bash
# CMD node dist/main   (shell form — SAI)
$ docker exec api ps -o pid,args
PID   COMMAND
    1 /bin/sh -c node dist/main     ← sh giữ PID 1, nhận SIGTERM rồi... không làm gì
   7 node dist/main                 ← Node không bao giờ biết mình bị yêu cầu tắt

# CMD ["dumb-init", "node", "dist/main"]   (exec form — ĐÚNG)
$ docker exec api ps -o pid,args
PID   COMMAND
    1 dumb-init node dist/main      ← dumb-init nhận và chuyển tiếp tín hiệu
    7 node dist/main
```

**Không dùng `npm run start:prod` ở production** — cùng vấn đề, thêm một tầng nữa:

```bash
$ docker exec api ps -o pid,args
PID   COMMAND
    1 npm run start:prod            ← npm
   18 sh -c node dist/main          ← sh
   19 node dist/main                ← Node, cách PID 1 tận hai tầng
```

Gọi thẳng `node dist/main`.

---

## 5. Build và chạy

```bash
# build image production
docker build -t blog-api:1.0 .

# build một stage cụ thể
docker build --target development -t blog-api:dev .

# xem kích thước
docker images blog-api
```

Chạy thử (Postgres đã chạy từ bài 01):

```bash
docker run --rm -p 3000:3000 \
  --network blog-net \
  -e DB_HOST=blog-db \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=blog \
  -e JWT_SECRET=doi-secret-nay-di \
  blog-api:1.0

curl http://localhost:3000/api/health
```

Nếu quên `--network blog-net`, container nằm mạng khác và không thấy `blog-db` → `getaddrinfo ENOTFOUND blog-db`.

---

## 6. Kết quả đo được

| Cách viết | Kích thước | Build lại sau khi sửa code |
|---|---|---|
| `node:24` + `COPY . .` trước | ~1.8 GB | ~3 phút |
| `node:24-alpine`, một stage | ~700 MB | ~3 phút |
| Multi-stage, có `.dockerignore` | **~275 MB** | **~15 giây** |

Ba lần thay đổi cho ra image nhỏ hơn 6 lần và build nhanh hơn 12 lần.

---

## 7. `ARG` vs `ENV` — và cái bẫy secret

```dockerfile
ARG NODE_VERSION=24          # chỉ tồn tại lúc build
FROM node:${NODE_VERSION}-alpine

ENV NODE_ENV=production      # tồn tại cả lúc build lẫn lúc chạy
```

Truyền ARG khi build:

```bash
docker build --build-arg NODE_VERSION=20 -t blog-api:node20 .
```

**Không bao giờ truyền secret qua `ARG` hay `ENV`.** Cả hai đều lưu vào metadata của image. Thử tự tấn công image của mình:

```dockerfile
# Dockerfile "tiện tay" — ĐỪNG LÀM
ARG DB_PASSWORD
ENV JWT_SECRET=sieu-bi-mat-123
RUN echo "$DB_PASSWORD" > /tmp/pass && npm ci && rm /tmp/pass
```

```bash
$ docker build --build-arg DB_PASSWORD=matkhau-that -t leak:1.0 .

# Ai pull được image cũng đọc được, kể cả khi bạn đã "rm" file đi
$ docker history --no-trunc leak:1.0 | grep -i -E 'secret|password'
|1 DB_PASSWORD=matkhau-that /bin/sh -c echo "$DB_PASSWORD" > /tmp/pass && npm ci && rm /tmp/pass

$ docker inspect leak:1.0 --format '{{json .Config.Env}}'
["PATH=/usr/local/...","JWT_SECRET=sieu-bi-mat-123"]
```

Lệnh `rm` ở dòng sau **không xoá được gì** — layer trước đã đóng băng nội dung đó vĩnh viễn. Nếu image đã push lên registry, phải coi secret là đã lộ và xoay (rotate) nó, không phải chỉ sửa Dockerfile.

Secret lúc build (ví dụ token npm private) thì dùng:

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t blog-api:1.0 .
```

Secret lúc **chạy** thì truyền qua `-e` / `env_file` / secret manager — không nướng vào image.

---

## Bài tập

1. Viết `.dockerignore` cho `blog-api`, rồi so sánh dung lượng build context trước/sau (dòng `transferring context` khi build).
2. Build image bằng Dockerfile ngây thơ ở mục 2 và bằng Dockerfile multi-stage. So sánh `docker images`.
3. Dùng `docker history blog-api:1.0` tìm layer chiếm nhiều dung lượng nhất. Nó là gì?
4. Sửa một dòng trong `app.service.ts` rồi build lại. Đếm số layer hiện `CACHED`.
5. Thêm `HealthController` vào NestJS, build lại, chạy container và kiểm tra `docker ps` có hiện `(healthy)` sau ~30 giây không.
6. Chứng minh container không chạy bằng root: `docker exec <tên> whoami`.

<details>
<summary>Gợi ý đáp án</summary>

3. Gần như chắc chắn là layer `node_modules` (copy từ `prod-deps`). Đó là lý do việc loại devDependencies quan trọng.
4. Mọi layer đến hết `npm ci` phải là `CACHED`; chỉ `COPY . .` và `npm run build` chạy lại.
5. `docker ps` cột STATUS: `Up 40 seconds (healthy)`. Nếu thấy `(unhealthy)`, kiểm tra endpoint có bị `JwtAuthGuard` chặn không — thiếu `@Public()` sẽ trả 401 và wget báo lỗi.
6. Phải in ra `node`, không phải `root`.
</details>

---

Tiếp theo 👉 [03-compose-dev.md](./03-compose-dev.md)
