# Bài 5 — Tối ưu: kích thước, tốc độ build, bảo mật

Image nhỏ không phải để khoe. Nó có nghĩa là: deploy nhanh hơn, tốn ít băng thông registry hơn, và **bề mặt tấn công nhỏ hơn** — mỗi package hệ thống thừa là một CVE tiềm năng.

---

## 1. Chọn image nền

| Image nền | Kích thước | Khi nào dùng |
|---|---|---|
| `node:24` | ~1.25 GB | Gần như không bao giờ |
| `node:24-slim` | ~248 MB | Khi có native module cần glibc (`bcrypt`, `sharp`, `canvas`) |
| `node:24-alpine` | ~162 MB | **Mặc định nên chọn** |
| `gcr.io/distroless/nodejs24` | ~140 MB | Bảo mật tối đa, nhưng không có shell → khó debug |

Mặc định: `alpine`. Gặp lỗi biên dịch native thì lùi về `slim`.

Alpine dùng **musl libc** thay vì glibc. Đa số package thuần JS không quan tâm, nhưng package có binary biên dịch sẵn có thể không có bản musl và phải build lại từ nguồn (chậm), hoặc chạy sai. Với `bcrypt`, cách gọn nhất là chuyển sang `bcryptjs`:

```bash
npm remove bcrypt @types/bcrypt
npm i bcryptjs && npm i -D @types/bcryptjs
```

Đổi import trong `auth.service.ts` từ `bcrypt` sang `bcryptjs` — API giống nhau, chậm hơn chút nhưng không phải biên dịch gì cả.

---

## 2. Thứ tự layer quyết định tốc độ build

Nguyên tắc: **cái gì ít đổi thì đặt lên trên**.

```dockerfile
# ❌ SAI — sửa 1 dòng code là cài lại toàn bộ dependency
COPY . .
RUN npm ci

# ✅ ĐÚNG — cache của npm ci sống cho tới khi package-lock.json đổi
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

Kiểm chứng: build hai lần, lần hai thấy `CACHED` ở dòng `npm ci`.

```bash
docker build -t blog-api:1.0 .
# sửa src/app.service.ts
docker build -t blog-api:1.1 .    # phải thấy "CACHED" ở layer npm ci
```

### Gộp `RUN` để bớt layer

```dockerfile
# ❌ 3 layer, và cache apk nằm luôn trong image
RUN apk update
RUN apk add curl
RUN apk add dumb-init

# ✅ 1 layer, không giữ cache
RUN apk add --no-cache curl dumb-init
```

`--no-cache` khiến apk không ghi index xuống đĩa. Với `apt-get` (Debian/slim) thì tương đương là:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

Phải dọn trong **cùng một `RUN`**. Đây là hiểu lầm rất phổ biến, nên chứng minh bằng số:

```dockerfile
# Cách A — xoá ở RUN sau
RUN apt-get update && apt-get install -y curl
RUN rm -rf /var/lib/apt/lists/*
```

```dockerfile
# Cách B — xoá trong cùng RUN
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*
```

```bash
$ docker build -f Dockerfile.A -t thu:a . && docker build -f Dockerfile.B -t thu:b .
$ docker images thu
REPOSITORY   TAG   SIZE
thu          a     108MB          ← "đã xoá" mà vẫn nặng
thu          b     82MB

$ docker history thu:a --format 'table {{.Size}}\t{{.CreatedBy}}' | head -3
SIZE     CREATED BY
0B       RUN rm -rf /var/lib/apt/lists/*        ← xoá được 0 byte
26MB     RUN apt-get update && apt-get install  ← 26MB vẫn nằm ở layer này
```

Layer chỉ **cộng dồn**, không bao giờ trừ đi. File bạn xoá ở layer sau chỉ bị "ẩn đi", dữ liệu vẫn nằm trong image và vẫn được tải về khi ai đó `docker pull`.

---

## 3. BuildKit cache mount

Cache mount giữ thư mục cache của npm **giữa các lần build** mà không đưa nó vào image:

```dockerfile
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

Khi `package-lock.json` đổi (cache layer hỏng), `npm ci` vẫn phải chạy lại — nhưng lấy package từ cache cục bộ chứ không tải qua mạng:

```bash
$ npm i @nestjs/swagger        # đổi package-lock.json
$ docker build -t blog-api:1.2 .

# KHÔNG có cache mount
 => [deps 3/3] RUN npm ci                                      64.3s
      npm warn tarball fetching https://registry.npmjs.org/... (847 gói)

# CÓ cache mount
 => [deps 3/3] RUN --mount=type=cache,target=/root/.npm npm ci  14.7s
      # chỉ tải 1 gói mới, 846 gói còn lại lấy từ ~/.npm cache
```

Xem cache đang chiếm bao nhiêu và dọn khi cần:

```bash
$ docker system df | grep 'Build Cache'
Build Cache     142    0    4.331GB    4.331GB
$ docker builder prune
```

Cần dòng đầu file `# syntax=docker/dockerfile:1` để bật cú pháp này (Dockerfile ở bài 02 đã có).

---

## 4. Đo và tìm chỗ phình

```bash
docker images blog-api                     # tổng kích thước
docker history blog-api:1.0                # từng layer
docker history --no-trunc blog-api:1.0 | head -20
```

Kết quả điển hình sau khi tối ưu:

```
IMAGE      CREATED BY                       SIZE
<missing>  CMD ["dumb-init" "node" ...]     0B
<missing>  COPY package.json ./             2.1kB
<missing>  COPY /app/dist ./dist            1.8MB     ← code của bạn
<missing>  COPY /app/node_modules ./        112MB     ← chiếm phần lớn
<missing>  RUN apk add --no-cache dumb-init 1.2MB
<missing>  /bin/sh -c #(nop) ...            162MB     ← node:24-alpine
```

Bài học: sau khi bỏ devDependencies, thứ chiếm chỗ chỉ còn image nền và `node_modules` production. Muốn nhỏ nữa thì phải xem lại dependency thật sự cần gì.

Công cụ trực quan hơn — [dive](https://github.com/wagoodman/dive):

```bash
brew install dive
dive blog-api:1.0
```

Nó chỉ ra file nào bị copy thừa, layer nào lãng phí, và cho điểm "efficiency".

---

## 5. Bảo mật

### Không chạy bằng root

```dockerfile
USER node
```

Kiểm tra: `docker exec blog-api whoami` → phải là `node`.

Nếu app cần ghi file (upload ảnh), cấp quyền đúng thư mục đó thôi:

```dockerfile
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
```

Tốt hơn nữa — đưa upload ra volume hoặc S3, và khoá luôn file system:

```yaml
services:
  api:
    read_only: true          # toàn bộ / là chỉ đọc
    tmpfs:
      - /tmp                 # trừ /tmp (nằm trên RAM, mất khi restart)
    volumes:
      - uploads:/app/uploads # và thư mục upload
```

Với `read_only: true`, kẻ tấn công chiếm được container cũng không ghi được webshell hay tải mã độc về:

```bash
$ docker compose exec api sh -c 'echo "malware" > /app/backdoor.js'
sh: can't create /app/backdoor.js: Read-only file system

$ docker compose exec api sh -c 'echo "ok" > /tmp/thu.txt && cat /tmp/thu.txt'
ok                          ← /tmp vẫn ghi được, app hoạt động bình thường
```

Nếu bật `read_only` mà app crash, xem log để biết nó cần ghi vào đâu rồi mở đúng đường dẫn đó bằng `tmpfs`:

```bash
$ docker compose logs api
api | Error: EROFS: read-only file system, open '/app/logs/app.log'
```

### Không nhét secret vào image

```dockerfile
ENV JWT_SECRET=abc123        # ❌ ai pull image cũng đọc được
```

Kiểm tra image của bạn có rò rỉ không:

```bash
docker history --no-trunc blog-api:1.0 | grep -i -E 'secret|password|token|key'
docker inspect blog-api:1.0 | grep -A 30 '"Env"'
```

### Giới hạn quyền của container

```yaml
services:
  api:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
```

`cap_drop: ALL` bỏ toàn bộ Linux capability. NestJS nghe port 3000 (> 1024) nên không cần capability nào.

### Quét lỗ hổng

```bash
$ docker scout cves blog-api:1.0
    ✗ HIGH CVE-2024-21538 [Inefficient Regular Expression Complexity]
      https://scout.docker.com/v/CVE-2024-21538
      Affected range : <5.1.2
      Fixed version  : 5.1.2
      Package        : cross-spawn 5.1.0

  1C     3H     8M    2L      blog-api:1.0
                              digest: 4a2b1c...

$ docker scout recommendations blog-api:1.0
  Tag        Details                    Pushed      Vulnerabilities
  22-alpine  Current image             3 mo ago     1C 3H 8M 2L
  22.15-alpine  Newer base image       2 days ago   0C 0H 2M 1L    ← nâng lên là hết 1 critical
```

Cách sửa CVE trong ví dụ trên: `npm audit fix` để nâng `cross-spawn`, rồi build lại. Chạy `docker scout` trong CI và chặn merge khi có CVE mức critical:

```yaml
- name: Quét lỗ hổng
  run: docker scout cves --exit-code --only-severity critical,high blog-api:${{ github.sha }}
```

### Ghim phiên bản

```dockerfile
FROM node:24-alpine            # ổn — ghim major
FROM node:24.19.0-alpine       # chặt hơn — tái lập chính xác
FROM node:24-alpine@sha256:... # chặt nhất — bất biến tuyệt đối
FROM node:latest               # ❌ không bao giờ
```

---

## 6. Tối ưu lúc chạy

### Giới hạn tài nguyên

```yaml
deploy:
  resources:
    limits:
      memory: 512M
      cpus: "1.0"
```

Không giới hạn, một memory leak trong API sẽ ăn hết RAM server và làm chết cả Postgres cùng máy.

Node không tự biết giới hạn của container. Đặt heap size khớp với limit (khoảng 75%):

```yaml
environment:
  NODE_OPTIONS: "--max-old-space-size=384"
```

Thiếu dòng này, V8 tưởng nó có toàn bộ RAM của host:

```bash
# Container bị giới hạn 512M, nhưng Node không biết
$ docker compose exec api node -e "console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024)"
4144            ← V8 tưởng nó được dùng 4GB (RAM của host)
```

Nó cứ để heap phình tới khi vượt 512M, và kernel giết ngay lập tức — không có exception, không có log lỗi từ ứng dụng:

```bash
$ docker compose ps -a
NAME   STATUS
api    Exited (137) 4 seconds ago       ← 137 = 128 + 9 (SIGKILL)

$ docker compose logs --tail 3 api
api | [Nest] LOG [PostsController] GET /api/posts 200 - 12ms
api |                                  ← không có gì thêm, chết giữa chừng

$ docker inspect blog-api-api-1 --format '{{.State.OOMKilled}}'
true                                    ← xác nhận bị OOM killer diệt
```

Đặt `--max-old-space-size=384` thì V8 tự dọn rác quyết liệt khi gần chạm ngưỡng, và nếu thật sự hết bộ nhớ thì ném `JavaScript heap out of memory` — một thông báo bạn đọc được và debug được.

### Giới hạn log

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

Mặc định log Docker **không giới hạn**. Kiểm tra file log thật của một container:

```bash
$ docker inspect blog-api-api-1 --format '{{.LogPath}}'
/var/lib/docker/containers/3f2a.../3f2a...-json.log

$ sudo ls -lh /var/lib/docker/containers/3f2a.../3f2a...-json.log
-rw-r----- 1 root root 6.8G ... 3f2a...-json.log      ← 6.8GB từ một container
```

Server hết ổ thì Postgres không ghi được WAL và **cả hệ thống dừng**, chứ không chỉ riêng service ồn ào kia. Với `max-size: 10m` + `max-file: 3`, con số trên bị chặn cứng ở 30MB. Đây là nguyên nhân sập production rất hay gặp mà lại rất dễ phòng.

### Chạy nhiều instance

```bash
docker compose up -d --scale api=3
```

```bash
$ docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
 ✔ Container prod-api-1  Started
 ✔ Container prod-api-2  Started
 ✔ Container prod-api-3  Started

$ docker compose ps api
NAME        SERVICE   STATUS
prod-api-1  api       Up 30 seconds (healthy)
prod-api-2  api       Up 30 seconds (healthy)
prod-api-3  api       Up 30 seconds (healthy)
```

Bỏ `ports` ở service `api` (nếu giữ `"3000:3000"`, container thứ hai sẽ báo `port is already allocated`). Nginx đứng trước và tự cân bằng tải — DNS của Docker trả về cả 3 IP cho hostname `api`:

```bash
$ docker compose exec nginx getent hosts api
172.20.0.4      api
172.20.0.5      api
172.20.0.6      api
```

Nhớ để API **stateless**: session/cache phải nằm ở Redis, không nằm trong bộ nhớ tiến trình. Nếu bạn lưu refresh token trong một `Map` của service, người dùng sẽ đăng nhập ở instance 1 rồi bị 401 khi request tiếp theo rơi vào instance 2.

---

## 7. Bảng tổng kết tác động

| Việc làm | Ảnh hưởng |
|---|---|
| Đổi `node:24` → `node:24-alpine` | −1.09 GB |
| Multi-stage, bỏ devDependencies | −200 MB |
| `.dockerignore` đúng | −context lớn, tránh copy nhầm `node_modules` |
| `COPY package*.json` trước `npm ci` | build lại 3 phút → 15 giây |
| `--mount=type=cache` cho npm | thêm ~40s nữa khi lock file đổi |
| `cache-from: type=gha` ở CI | 4 phút → dưới 1 phút |
| `USER node` | không còn root trong container |
| Giới hạn log + RAM | không sập vì đầy ổ / OOM |

---

## Bài tập

1. Đo image hiện tại. Đổi base sang `node:24-slim`, build lại, so sánh. Chênh bao nhiêu?
2. Thêm `--mount=type=cache` vào `npm ci`. Sửa `package.json` (thêm 1 package) rồi build lại — nhanh hơn bao nhiêu?
3. Chạy `docker scout cves` trên image của bạn. Có CVE nào mức high/critical không? `docker scout recommendations` khuyên gì?
4. Cố tình đặt `ENV FAKE_SECRET=hello` trong Dockerfile, build, rồi tìm nó bằng `docker history --no-trunc`. Xoá dòng đó ở Dockerfile mới nhưng **giữ layer cũ** — image cũ vẫn lộ chứ?
5. Đặt limit RAM 256M cho `api` mà không đặt `NODE_OPTIONS`. Chạy load test nhẹ và xem container có bị `Exited (137)` không.
6. Cài `dive` và tìm layer lãng phí nhất trong image của bạn.

<details>
<summary>Gợi ý đáp án</summary>

1. `slim` thường lớn hơn `alpine` khoảng 60–80 MB. Nếu dự án của bạn không dùng native module, giữ `alpine`.
4. Đúng — image cũ đã build vẫn chứa secret vĩnh viễn. Nếu đã lỡ push lên registry, phải coi secret đó là đã lộ và xoay (rotate) nó, không chỉ sửa Dockerfile.
5. Mã 137 = 128 + 9 (SIGKILL), tức bị OOM killer diệt. `docker inspect <tên> | grep OOMKilled` xác nhận.
</details>

---

Tiếp theo 👉 [06-loi-thuong-gap.md](./06-loi-thuong-gap.md)
