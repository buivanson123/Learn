# Bài 08 — Registry, CI và bước ra khỏi một máy

Bảy bài trước dạy chạy Docker **trên máy bạn**. Bài này là phần còn thiếu để đưa nó lên production và
để trả lời được câu hỏi phỏng vấn "sau Docker thì là gì".

Môi trường đo trong bài:

```bash
$ docker --version
Docker version 29.7.2, build a7dcaa6

$ docker compose version
Docker Compose version v5.3.1
```

---

## 1. Registry — nơi ảnh sống sau khi rời máy bạn

Ảnh build trên máy bạn không tự có ở server. Registry là kho trung gian.

```
Máy bạn / CI          Registry              Server
   build      →       push/pull      →      run
```

### Đặt tên ảnh cho đúng

```
[registry]/[namespace]/[tên]:[tag]

ghcr.io/vanson/blog-api:a3f8c21
docker.io/library/postgres:18-alpine        ← Docker Hub, phần đầu ẩn được
registry.gitlab.com/team/blog-api:v1.2.0
```

Không ghi registry thì Docker mặc định là Docker Hub. Đó là lý do `docker pull postgres:18-alpine` chạy
được mà không cần cấu hình gì.

### Đẩy lên và kéo về

```bash
$ docker login ghcr.io -u vanson
$ docker tag blog-api:latest ghcr.io/vanson/blog-api:a3f8c21
$ docker push ghcr.io/vanson/blog-api:a3f8c21

# trên server
$ docker pull ghcr.io/vanson/blog-api:a3f8c21
```

### ⭐ Đừng deploy bằng tag `latest`

Đây là câu hỏi phỏng vấn hay gặp, và cũng là lỗi vận hành phổ biến.

```yaml
# ❌
image: blog-api:latest

# ✅
image: ghcr.io/vanson/blog-api:${GIT_SHA}
```

Ba vấn đề với `latest`:

1. **Không biết đang chạy bản nào.** `docker ps` chỉ nói `latest` — không giúp gì khi điều tra sự cố.
2. **Không rollback được.** Muốn quay về bản trước thì bản đó tên là gì?
3. **Không tái lập được.** Hai server pull `latest` ở hai thời điểm có thể ra hai ảnh khác nhau.

Dùng **git SHA** làm tag: nó duy nhất, và tra ngược ra đúng commit nào đang chạy.

```bash
$ GIT_SHA=$(git rev-parse --short HEAD)
$ docker build -t ghcr.io/vanson/blog-api:"$GIT_SHA" .
```

Có thể gắn thêm `latest` **song song** cho tiện, nhưng deploy vẫn dùng SHA.

### Ghim ảnh nền bằng digest

Tag cũng thay đổi được — `node:24-alpine` hôm nay và tháng sau là hai ảnh khác nhau (vá bảo mật).
Muốn build tái lập 100% thì ghim digest:

```dockerfile
FROM node:24-alpine@sha256:abc123...
```

Đánh đổi: không tự nhận bản vá bảo mật. Cách thực dụng: ghim digest cho ảnh production, và có quy trình
cập nhật định kỳ (Renovate/Dependabot làm tự động được).

---

## 2. Build trong CI

Build trên máy cá nhân là chống chỉ định: mỗi người một môi trường, và không ai kiểm tra được.

### GitHub Actions

```yaml
name: Build & Push

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
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Hai dòng `cache-from`/`cache-to` là thứ đáng chú ý nhất: không có chúng, mỗi lần build trong CI là
`npm ci` lại từ đầu vì runner luôn sạch. Có chúng, layer cache được lưu giữa các lần chạy — thời gian
build giảm rất nhiều.

### Buildx và multi-platform

Máy Mac Apple Silicon build ra ảnh `arm64`. Server thường là `amd64`. Chạy ảnh sai kiến trúc:

```
exec /usr/local/bin/node: exec format error
```

Build cho cả hai:

```bash
$ docker buildx build --platform linux/amd64,linux/arm64 -t ghcr.io/vanson/blog-api:$GIT_SHA --push .
```

Hoặc build đúng nền tảng đích:

```bash
$ docker buildx build --platform linux/amd64 -t blog-api:x .
```

⚠️ Build chéo kiến trúc chậm hơn nhiều (chạy qua QEMU). Trên CI thì nên dùng runner đúng kiến trúc.

### Quét bảo mật trong CI

```yaml
      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}:${{ github.sha }}
          severity: HIGH,CRITICAL
          exit-code: '1'
```

```bash
# chạy tại chỗ
$ docker scout cves blog-api:latest
$ trivy image blog-api:latest
```

`exit-code: 1` làm CI đỏ khi có lỗ hổng nghiêm trọng. Đây là lý do nữa để dùng ảnh `-alpine` hoặc
`distroless`: ít gói hơn = ít CVE hơn.

---

## 3. Quản lý bí mật

### Đừng làm ba việc này

```dockerfile
# ❌ 1. ENV chứa secret — nằm trong metadata ảnh, ai pull cũng đọc được
ENV DB_PASSWORD=secret

# ❌ 2. COPY .env vào ảnh
COPY .env .

# ❌ 3. ARG chứa secret — nằm trong lịch sử layer
ARG NPM_TOKEN
```

Chứng minh secret lộ thật:

Thử thật với `Dockerfile` chỉ có 3 dòng:

```dockerfile
FROM alpine:3.24
ENV DB_PASSWORD=secret123
RUN echo hi
```

```bash
$ docker build -t leak-test .
$ docker inspect leak-test --format '{{json .Config.Env}}'
["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin","DB_PASSWORD=secret123"]

$ docker history --no-trunc leak-test | grep -i password
<missing>   Less than a second ago   ENV DB_PASSWORD=secret123   0B   buildkit.dockerfile.v0
```

Mật khẩu nằm nguyên văn trong metadata ảnh. **Bất kỳ ai pull được ảnh đều đọc được** — không cần chạy
container, không cần quyền gì thêm.

Xoá ở layer sau **không giúp gì** — layer trước vẫn còn trong ảnh.

### Cách đúng

**Lúc build** — dùng BuildKit secret mount, nó không đi vào layer nào:

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci
```

```bash
$ docker build --secret id=npmrc,src=$HOME/.npmrc -t blog-api .
```

**Lúc chạy** — truyền từ ngoài vào:

```yaml
services:
  app:
    env_file: [.env.production]        # file nằm trên server, không trong ảnh
    secrets: [db_password]

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Với Postgres, dùng `POSTGRES_PASSWORD_FILE` thay vì `POSTGRES_PASSWORD` để mật khẩu không nằm trong
biến môi trường (biến môi trường đọc được qua `docker inspect`).

### `.dockerignore` phải có `.env`

```
.git
node_modules
.env
.env.*
secrets/
*.pem
```

Thiếu dòng `.env` là `COPY . .` mang cả mật khẩu vào ảnh.

---

## 4. Từ Compose lên orchestrator

Đây là câu hỏi phỏng vấn hay gặp: **"Docker Compose có dùng được trên production không?"**

### Câu trả lời thật

**Được**, cho ứng dụng chạy trên **một máy**. Rất nhiều hệ thống nhỏ và vừa chạy Compose trên một VPS
và hoạt động tốt nhiều năm.

Compose **không đủ** khi bạn cần:

| Nhu cầu | Compose | Orchestrator |
|---------|---------|--------------|
| Chạy trên nhiều máy | ❌ | ✅ |
| Tự khởi động lại container chết | ✅ (`restart:`) | ✅ |
| Tự thay máy chết | ❌ | ✅ |
| Rolling update không downtime | ❌ (phải tự làm) | ✅ |
| Tự scale theo tải | ❌ | ✅ |
| Service discovery giữa nhiều máy | ❌ | ✅ |

### Ba lựa chọn

| Công cụ | Độ phức tạp | Hợp với |
|---------|-------------|---------|
| **Docker Compose** | Thấp | 1 máy, team nhỏ |
| **Docker Swarm** | Trung bình | Vài máy, muốn giữ cú pháp giống Compose |
| **Kubernetes** | Cao | Nhiều máy, nhiều team, cần tự scale |

**Lời khuyên khi được hỏi:** đừng nói "em sẽ dùng Kubernetes" ngay. Câu trả lời chín chắn hơn:

> "Với một dịch vụ và vài container thì em bắt đầu bằng Compose trên một VPS — nó đủ và ít thứ phải vận
> hành. Em chuyển sang orchestrator khi có nhu cầu thật: cần chạy nhiều máy để chịu tải, hoặc cần
> rolling update không downtime, hoặc có nhiều team cùng deploy. Kubernetes giải quyết được nhưng chi
> phí vận hành cao — nếu chỉ cần chạy nhiều máy thì Swarm hoặc một PaaS đơn giản hơn nhiều."

### Đối chiếu khái niệm Compose ↔ Kubernetes

Biết bảng này là đủ cho câu hỏi "bạn có biết K8s không" ở mức middle:

| Compose | Kubernetes | Là gì |
|---------|-----------|-------|
| `service` | **Deployment** | Khai muốn chạy bao nhiêu bản của ảnh nào |
| container đang chạy | **Pod** | Đơn vị nhỏ nhất được lập lịch (1+ container) |
| `ports:` | **Service** | Địa chỉ ổn định để gọi vào nhóm pod |
| `depends_on` | (không có tương đương) | K8s dùng healthcheck + retry thay vì thứ tự |
| `environment:` | **ConfigMap** | Cấu hình không nhạy cảm |
| `secrets:` | **Secret** | Cấu hình nhạy cảm |
| `volumes:` | **PersistentVolumeClaim** | Lưu trữ bền |
| `deploy.replicas` | `spec.replicas` | Số bản chạy |
| `healthcheck` | **liveness / readiness probe** | Xem mục dưới |

### ⭐ Liveness vs readiness — hay bị hỏi

| Probe | Trả lời câu hỏi | Hỏng thì sao |
|-------|-----------------|--------------|
| **liveness** | "Còn sống không?" | **Khởi động lại** container |
| **readiness** | "Sẵn sàng nhận request chưa?" | **Ngưng gửi traffic**, không restart |
| **startup** | "Khởi động xong chưa?" | Hoãn hai probe kia |

Vì sao cần tách: ứng dụng đang khởi động (chạy migration, nạp cache) thì **còn sống** nhưng **chưa sẵn
sàng**. Chỉ có liveness thì Kubernetes sẽ restart liên tục và không bao giờ khởi động xong.

Trong Compose, `healthcheck` gần với readiness hơn:

```yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s        # ← tương đương startup probe
```

`start_period` quan trọng: không có nó, container bị đánh dấu unhealthy trong lúc còn đang khởi động.

---

## 5. Deploy không downtime bằng Compose

Compose không có rolling update sẵn, nhưng làm thủ công được — và biết cách làm là điểm cộng.

### Cách đơn giản: Nginx + hai phiên bản

```bash
#!/usr/bin/env bash
set -euo pipefail

GIT_SHA=$(git rev-parse --short HEAD)
export GIT_SHA

docker compose pull app

# 1. Chạy migration TRƯỚC khi đổi code
docker compose run --rm app npm run migration:run

# 2. Dựng container mới song song container cũ
docker compose up -d --no-deps --scale app=2 --no-recreate app

# 3. Chờ container mới healthy
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/api/health > /dev/null; then break; fi
  sleep 2
done

# 4. Gỡ container cũ
docker compose up -d --no-deps --scale app=1 app

# 5. Dọn ảnh cũ
docker image prune -f
```

### Ba thứ phải có để deploy an toàn

**1. Healthcheck thật, không phải `exit 0`.**

```yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:3000/api/health"]
```

Endpoint đó nên kiểm tra cả database và Redis, không chỉ trả 200 suông.

**2. Graceful shutdown.**

Container nhận `SIGTERM` khi bị dừng. Ứng dụng phải đóng kết nối và làm nốt request đang xử lý:

```dockerfile
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

`dumb-init` (hoặc `tini`) giải quyết vấn đề **PID 1**: tiến trình PID 1 trong Linux không nhận tín hiệu
mặc định, nên `node` chạy trực tiếp làm PID 1 sẽ **bỏ qua `SIGTERM`** và bị `SIGKILL` sau 10 giây —
cắt ngang request đang dở.

Kiểm chứng:

```bash
$ docker stop --timeout 30 blog-api
```

Container dừng ngay lập tức thay vì chờ = tín hiệu không tới được ứng dụng.

**3. Migration tương thích ngược.**

Giữa lúc chạy migration và lúc đổi code, code cũ đang chạy trên schema mới. Xoá cột trong cửa sổ đó là
lỗi hàng loạt. Tách làm nhiều lần deploy (expand/contract).

---

## 6. Dọn dẹp trên server

Server chạy vài tháng sẽ đầy đĩa. Đây là lỗi vận hành hay gặp.

```bash
$ docker system df
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          9         3         2.365GB   407.7MB (17%)
Containers      3         2         7.593kB   3.479kB (45%)
Local Volumes   6         2         893.9MB   623.2MB (69%)
Build Cache     161       0         11.63GB   11.36GB
```

Chú ý dòng cuối: **Build Cache 11.63GB** trên một máy dev bình thường, và **toàn bộ đều thu hồi được**
(`ACTIVE = 0`). Đây thường là thủ phạm số một khi đĩa đầy, chứ không phải ảnh.

```bash
$ docker image prune -a --filter "until=168h"   # ảnh không dùng, cũ hơn 7 ngày
$ docker builder prune --filter "until=168h"    # build cache
$ docker container prune
$ docker system prune -a --volumes              # ⚠️ XOÁ CẢ VOLUME — cẩn thận
```

> ⚠️ `docker system prune -a --volumes` xoá **volume không gắn với container nào**. Nếu database của
> bạn đang dừng lúc đó, volume dữ liệu bị coi là không dùng và **bị xoá**. Đừng chạy lệnh này theo phản
> xạ trên server có dữ liệu.

Dọn tự động an toàn hơn:

```yaml
# cron hằng tuần
0 3 * * 0 docker image prune -a --filter "until=168h" -f && docker builder prune --filter "until=168h" -f
```

Giới hạn log để không phình đĩa:

```yaml
services:
  app:
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

Không đặt thì một container nói nhiều có thể ghi vài chục GB log.

---

## 7. Bảng câu trả lời phỏng vấn

| Câu hỏi | Trả lời 30 giây |
|---------|-----------------|
| Registry là gì? | Kho chứa ảnh để build một nơi, chạy nơi khác. Docker Hub, GHCR, GitLab Registry. |
| Vì sao không dùng tag `latest` khi deploy? | Không biết đang chạy bản nào, không rollback được, không tái lập được. Dùng git SHA. |
| Build ảnh ở đâu? | Trong CI, không phải máy cá nhân. Có cache layer giữa các lần chạy để không `npm ci` lại từ đầu. |
| Làm sao giấu secret khi build? | BuildKit `--mount=type=secret` — nó không đi vào layer nào. Không dùng `ENV`/`ARG`. |
| `exec format error` là lỗi gì? | Sai kiến trúc CPU — build `arm64` trên Mac rồi chạy trên server `amd64`. Dùng `buildx --platform`. |
| Compose dùng production được không? | Được cho một máy. Cần nhiều máy hoặc rolling update thì mới cần orchestrator. |
| Liveness khác readiness? | Liveness hỏng → restart container. Readiness hỏng → ngưng gửi traffic nhưng không restart. |
| Vì sao cần `dumb-init`? | PID 1 trong Linux không nhận `SIGTERM` mặc định, nên app bị kill cứng khi dừng thay vì tắt tử tế. |
| Server đầy đĩa vì Docker? | `docker system df` để xem, rồi `image prune` + `builder prune`. Tránh `system prune -a --volumes`. |

---

## Bài tập

1. Build ảnh `blog-api` với tag là git SHA, push lên GHCR, rồi pull về và chạy. Xác nhận
   `docker ps --format '{{.Image}}'` hiện đúng SHA.

2. Thêm `ENV DB_PASSWORD=secret` vào Dockerfile, build, rồi chạy
   `docker inspect <image> | grep -A 20 '"Env"'`. Bạn thấy gì? Xoá dòng đó và dùng `env_file` thay thế.

3. Viết workflow GitHub Actions build + push có `cache-from`/`cache-to`. Chạy hai lần liên tiếp và so
   thời gian.

4. Trên máy Apple Silicon, build ảnh rồi thử chạy với `--platform linux/amd64`. Ghi lại lỗi. Sửa bằng
   `buildx --platform`.

5. Chạy `docker scout cves` (hoặc `trivy image`) trên ảnh của bạn. Đếm số CVE. Đổi ảnh nền từ
   `node:24` sang `node:24-alpine` và đếm lại.

6. Bỏ `dumb-init` khỏi Dockerfile, chạy container rồi `docker stop --timeout 30`. Đo thời gian dừng.
   Thêm lại và đo lần nữa.

7. Viết script deploy không downtime theo mục 5. Trong lúc nó chạy, dùng vòng lặp `curl` mỗi 0.2 giây
   và đếm số request lỗi.

8. Chạy `docker system df` trên máy bạn. Dọn bằng `image prune` + `builder prune` rồi chạy lại, so hai
   con số.

<details>
<summary>Gợi ý đáp án</summary>

**2.** `docker inspect` in ra nguyên văn `DB_PASSWORD=secret` trong mảng `Env`. Bất kỳ ai pull được ảnh
đều đọc được. `docker history --no-trunc` cũng lộ. Xoá ở layer sau không giúp gì — layer cũ vẫn nằm
trong ảnh.

**4.**
```
exec /usr/local/bin/node: exec format error
```
Ảnh `arm64` không chạy được trên runtime `amd64`.

**6.** Không có `dumb-init`: container dừng gần như tức thì (bị `SIGKILL` sau khi `SIGTERM` bị bỏ qua),
request đang xử lý bị cắt. Có `dumb-init`: nó chờ ứng dụng tự đóng, tới 30 giây nếu cần.

</details>

---

Quay lại [README](./README.md) · [phong-van/](./phong-van/README.md)
