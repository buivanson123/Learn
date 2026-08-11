# 40 câu hỏi phỏng vấn Docker + đáp án

Che đáp án, tự trả lời thành tiếng. ⭐ = rất hay gặp.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--khái-niệm-nền-tảng) | Khái niệm nền tảng | 9 |
| [B](#b--dockerfile) | Dockerfile | 11 |
| [C](#c--dữ-liệu-và-mạng) | Volume, mạng | 7 |
| [D](#d--compose-và-vận-hành) | Compose, vận hành | 8 |
| [E](#e--bảo-mật-và-production) | Bảo mật, production | 5 |

---

## A — Khái niệm nền tảng

### A1 ⭐⭐ Image khác container thế nào?

**Ngắn:** Image là **khuôn** — chỉ đọc, không chạy. Container là **một lần chạy** của khuôn đó, có thêm
một lớp ghi được ở trên.

**Đào sâu:** Ví dụ dễ nhớ: image là file cài đặt, container là chương trình đang chạy. Một image dựng
được nhiều container cùng lúc, mỗi cái có lớp ghi riêng.

Hệ quả thực tế: **dữ liệu ghi trong container biến mất khi xoá container** — đó là lý do phải có volume.

```bash
$ docker images        # xem image
$ docker ps -a         # xem container
```

### A2 ⭐ Docker khác máy ảo (VM) thế nào?

**Ngắn:** Container dùng chung **kernel** của máy chủ, chỉ tách biệt bằng namespace và cgroup. VM chạy
cả một hệ điều hành riêng.

**Đào sâu:**

| | Container | VM |
|---|---|---|
| Khởi động | Mili giây | Vài chục giây |
| Dung lượng | Vài chục–vài trăm MB | Vài GB |
| Cách ly | Ở mức tiến trình | Ở mức phần cứng ảo |
| Kernel | Dùng chung với host | Riêng |

Hệ quả quan trọng: **container Linux không chạy trực tiếp trên macOS/Windows** — Docker Desktop chạy
một VM Linux ẩn bên dưới. Đó là lý do mount volume trên Mac chậm hơn Linux.

### A3 Layer là gì?

**Ngắn:** Mỗi lệnh trong Dockerfile tạo một layer chỉ đọc. Image là chồng các layer đó.

**Đào sâu:** Layer được **chia sẻ giữa các image**. Mười ảnh cùng dùng `node:24-alpine` thì layer nền
chỉ lưu một lần trên đĩa.

```bash
$ docker history --no-trunc <image>
```

Lệnh này cho biết layer nào nặng — công cụ đầu tiên khi muốn giảm kích thước ảnh.

### A4 ⭐ Vì sao ảnh của tôi nặng 1.2GB?

**Ngắn:** Thường vì ba lý do: ảnh nền đầy đủ thay vì `-alpine`, `devDependencies` còn trong ảnh cuối,
và toolchain build không được loại bỏ.

**Đào sâu:** Cách tìm:

```bash
$ docker images                       # xem tổng
$ docker history --no-trunc <image>   # xem layer nào nặng
$ docker scout cves <image>           # tiện thể xem cả lỗ hổng
```

Ba cách giảm, theo thứ tự hiệu quả:
1. **Multi-stage build** — stage cuối chỉ copy kết quả build.
2. **Ảnh nền `-alpine`** hoặc `distroless`.
3. **`.dockerignore`** để không copy `node_modules`, `.git` vào build context.

### A5 `.dockerignore` để làm gì?

**Ngắn:** Loại file khỏi **build context** — thứ được gửi sang Docker daemon trước khi build.

**Đào sâu:** Thiếu nó thì `node_modules` trên máy bạn (có thể chứa binary biên dịch cho macOS) bị chép
vào ảnh Linux. Vừa nặng vừa hỏng.

```
.git
node_modules
.env
.env.*
dist
secrets/
*.md
```

**`.env` bắt buộc phải có** — thiếu là `COPY . .` mang mật khẩu vào ảnh.

### A6 Container dừng thì dữ liệu còn không?

**Ngắn:** Container **dừng** thì còn (lớp ghi vẫn đó). Container bị **xoá** thì mất.

**Đào sâu:** Đó là lý do database phải dùng volume. `docker compose down` xoá container — không có
volume là mất sạch dữ liệu.

### A7 `docker run` khác `docker start`?

**Ngắn:** `run` = tạo container mới + chạy. `start` = chạy lại container đã tồn tại.

**Đào sâu:** `docker run` nhiều lần tạo ra nhiều container — đó là lý do `docker ps -a` đầy container
cũ. Dùng `--rm` để tự xoá khi dừng.

### A8 `docker exec` khác `docker attach`?

**Ngắn:** `exec` chạy **tiến trình mới** trong container đang chạy; `attach` gắn vào tiến trình chính.

**Đào sâu:** Gần như luôn dùng `exec`:

```bash
$ docker exec -it blog-api sh
```

`attach` nguy hiểm: `Ctrl+C` có thể dừng luôn container.

### A9 ⭐ `exec format error` là lỗi gì?

**Ngắn:** Sai kiến trúc CPU — ảnh build cho `arm64` chạy trên `amd64` hoặc ngược lại.

**Đào sâu:** Hay gặp khi build trên Mac Apple Silicon rồi deploy lên server Intel.

```bash
$ docker buildx build --platform linux/amd64 -t blog-api .
# hoặc build cả hai
$ docker buildx build --platform linux/amd64,linux/arm64 --push -t ghcr.io/vanson/blog-api:sha .
```

---

## B — Dockerfile

### B1 ⭐⭐ Vì sao `COPY package.json` trước `COPY . .`?

**Đây là câu hỏi phân biệt "đọc tài liệu" và "tự viết Dockerfile".**

**Ngắn:** Để tận dụng **layer cache**. Docker cache theo layer; layer nào có đầu vào không đổi thì dùng
lại.

**Đào sâu:**

```dockerfile
# ❌ Sai — sửa một dòng code là npm ci chạy lại từ đầu
COPY . .
RUN npm ci

# ✅ Đúng — chỉ khi package.json đổi mới cài lại
COPY package*.json ./
RUN npm ci
COPY . .
```

Cách sai: mỗi lần sửa code, layer `COPY . .` đổi → mọi layer sau đó mất cache → `npm ci` tải lại toàn
bộ. Build từ 10 giây thành 2 phút.

Nguyên tắc chung: **thứ ít thay đổi đặt trên, thứ hay thay đổi đặt dưới.**

### B2 ⭐⭐ `CMD` khác `ENTRYPOINT` thế nào?

**Câu bẫy kinh điển.**

**Ngắn:** `ENTRYPOINT` là lệnh **cố định**; `CMD` là **tham số mặc định** và bị ghi đè khi bạn truyền
lệnh vào `docker run`.

**Đào sâu:**

```dockerfile
ENTRYPOINT ["node"]
CMD ["dist/main.js"]
```

```bash
$ docker run myapp                    # → node dist/main.js
$ docker run myapp dist/worker.js     # → node dist/worker.js   (CMD bị thay)
```

Nếu chỉ có `CMD ["node", "dist/main.js"]` thì `docker run myapp sh` thay **cả** lệnh — vào được shell.
Với `ENTRYPOINT ["node"]` thì `docker run myapp sh` thành `node sh` → lỗi.

Quy tắc: `ENTRYPOINT` cho thứ luôn chạy, `CMD` cho tham số mặc định. Dùng `--entrypoint` để ghi đè
`ENTRYPOINT` khi cần debug.

### B3 Dạng exec khác dạng shell?

**Ngắn:** `CMD ["node", "app.js"]` (exec) chạy trực tiếp; `CMD node app.js` (shell) chạy qua
`/bin/sh -c`.

**Đào sâu:** **Luôn dùng dạng exec.** Dạng shell khiến tiến trình thật là con của `sh`, nên **không
nhận được `SIGTERM`** — container bị kill cứng khi dừng, cắt ngang request đang xử lý.

### B4 ⭐ Vì sao cần `dumb-init` hoặc `tini`?

**Ngắn:** Vì tiến trình **PID 1** trong Linux không có xử lý tín hiệu mặc định.

**Đào sâu:** Chạy `node` làm PID 1 thì nó **bỏ qua `SIGTERM`**, Docker chờ 10 giây rồi `SIGKILL`.
Request đang dở bị cắt, kết nối database không đóng tử tế.

```dockerfile
RUN apk add --no-cache dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

Kiểm chứng:

```bash
$ docker stop --timeout 30 blog-api
```

Dừng ngay tức khắc = tín hiệu không tới ứng dụng. Chờ vài giây rồi mới dừng = đúng.

`dumb-init` cũng thu dọn tiến trình zombie.

### B5 ⭐ Multi-stage build là gì?

**Ngắn:** Dùng nhiều `FROM` trong một Dockerfile; stage cuối chỉ copy **kết quả** từ stage trước.

**Đào sâu:**

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Kết quả thật ở dự án blog-api: **1.2GB → 180MB**, vì ảnh cuối không có `devDependencies`, không có mã
nguồn TypeScript, không có toolchain build.

Lợi ích thứ hai ít người nói: **ít gói hơn = ít CVE hơn**.

### B6 `COPY` khác `ADD` thế nào?

**Ngắn:** `ADD` làm thêm hai việc: tự giải nén file `.tar` và tải được URL. `COPY` chỉ chép.

**Đào sâu:** **Luôn dùng `COPY`.** `ADD` với URL không có cache tốt và không kiểm tra checksum — dùng
`RUN curl` rõ ràng hơn. Chỉ dùng `ADD` khi thật sự muốn giải nén tar.

### B7 `RUN`, `CMD`, `ENTRYPOINT` chạy lúc nào?

**Ngắn:** `RUN` chạy **lúc build**; `CMD`/`ENTRYPOINT` chạy **lúc container khởi động**.

**Đào sâu:** Đây là nguồn nhầm lẫn hay gặp: `RUN npm start` trong Dockerfile sẽ treo lúc build, không
phải chạy app.

### B8 Vì sao gộp nhiều lệnh vào một `RUN`?

**Ngắn:** Mỗi `RUN` là một layer. Gộp lại để file tạm không nằm lại trong layer.

**Đào sâu:**

```dockerfile
# ❌ apk cache nằm lại trong layer 1, layer 2 xoá không giúp gì
RUN apk add --no-cache postgresql-dev
RUN apk del postgresql-dev

# ✅ cùng một layer
RUN apk add --no-cache --virtual .build-deps postgresql-dev \
 && npm ci \
 && apk del .build-deps
```

Nguyên tắc: **xoá ở layer sau không làm ảnh nhỏ đi** — layer trước vẫn còn trong ảnh.

### B9 `ARG` khác `ENV` thế nào?

**Ngắn:** `ARG` chỉ tồn tại **lúc build**; `ENV` tồn tại cả lúc build và lúc chạy.

**Đào sâu:** **Cả hai đều không được chứa secret** — chúng nằm trong metadata ảnh:

```bash
$ docker inspect leak-test --format '{{json .Config.Env}}'
["PATH=...","DB_PASSWORD=secret123"]
```

Ai pull được ảnh đều đọc được. Secret lúc build dùng BuildKit:

```dockerfile
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

### B10 `WORKDIR` khác `cd` thế nào?

**Ngắn:** `RUN cd /app` chỉ có tác dụng trong **chính lệnh `RUN` đó**. `WORKDIR` áp cho mọi lệnh sau.

### B11 Vì sao nên có `USER` trong Dockerfile?

**Ngắn:** Mặc định container chạy bằng **root**. Ứng dụng bị chiếm quyền thì kẻ tấn công có root trong
container.

**Đào sâu:**

```dockerfile
USER node        # ảnh node:* có sẵn user này
```

Kiểm tra:

```bash
$ docker exec blog-api whoami
node
```

Ra `root` là chưa đặt. Nhớ `COPY --chown=node:node` để user đó đọc được file.

---

## C — Dữ liệu và mạng

### C1 ⭐ Volume khác bind mount thế nào?

**Ngắn:** Volume do Docker quản lý (nằm trong `/var/lib/docker/volumes`); bind mount trỏ vào một thư
mục cụ thể trên máy bạn.

**Đào sâu:**

| | Volume | Bind mount |
|---|---|---|
| Cú pháp | `pgdata:/var/lib/postgresql/data` | `./src:/app/src` |
| Dùng cho | Dữ liệu production | Code lúc dev (hot reload) |
| Docker quản lý | ✅ | ❌ |
| Hiệu năng trên Mac | Tốt | **Chậm** (đi qua VM) |
| Sao lưu | `docker run --volumes-from` | Chép thư mục |

Quy tắc: **bind mount cho dev, volume cho production.**

### C2 Bẫy khi bind mount `node_modules`?

**Ngắn:** Bind mount cả thư mục dự án sẽ **đè** `node_modules` trong container bằng `node_modules` của
máy bạn.

**Đào sâu:** Nếu máy bạn là macOS/arm64 còn container là Linux/amd64 thì các gói có binary sẽ hỏng.

Sửa bằng volume ẩn danh đè lên:

```yaml
volumes:
  - ./:/app
  - /app/node_modules        # ← giữ node_modules của container
```

### C3 Container nói chuyện với nhau thế nào?

**Ngắn:** Qua **tên service** trong cùng một network của Compose.

**Đào sâu:**

```yaml
services:
  app:
    environment:
      DB_HOST: postgres      # ← tên service, không phải localhost
  postgres:
    image: postgres:18-alpine
```

Compose tự tạo network và DNS nội bộ. Dùng `localhost` từ trong container `app` là trỏ vào **chính
container đó**, không phải máy chủ.

### C4 ⭐ `localhost` trong container trỏ vào đâu?

**Ngắn:** Vào **chính container đó**, không phải máy host.

**Đào sâu:** Đây là lỗi số một khi mới dùng Docker:

```
ECONNREFUSED 127.0.0.1:5432
```

Từ container muốn gọi ra host thì dùng `host.docker.internal` (Docker Desktop). Từ container này sang
container kia thì dùng **tên service**.

### C5 `ports` khác `expose` thế nào?

**Ngắn:** `ports: "3000:3000"` mở ra **máy host**; `expose` chỉ ghi chú, container khác vẫn gọi được mà
không cần nó.

**Đào sâu:** Trong Compose, các service **luôn** gọi được nhau qua network nội bộ dù không khai `ports`.
`ports` chỉ cần khi bạn muốn truy cập từ trình duyệt/máy host.

Bảo mật: đừng mở port database ra ngoài trên production. `"5432:5432"` là mở cho cả internet nếu firewall
không chặn — dùng `"127.0.0.1:5432:5432"` nếu chỉ cần truy cập từ máy chủ.

### C6 Dữ liệu database nên để đâu?

**Ngắn:** Named volume, không phải bind mount, và **không** để trong container.

**Đào sâu:**

```yaml
services:
  postgres:
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

⚠️ `docker compose down -v` xoá volume — mất sạch dữ liệu. Nhớ `-v` là cờ nguy hiểm.

### C7 Sao lưu volume thế nào?

**Ngắn:** Với database, dùng công cụ của database (`pg_dump`), không chép file volume.

**Đào sâu:**

```bash
$ docker exec blog-pg pg_dump -U blog blog > backup.sql
```

Chép file trong khi Postgres đang chạy có thể ra bản sao hỏng. Và **bản sao lưu chưa từng thử khôi phục
thì không phải bản sao lưu** — câu này nói ra trong phỏng vấn rất được đánh giá cao.

---

## D — Compose và vận hành

### D1 Docker Compose để làm gì?

**Ngắn:** Khai nhiều container và quan hệ giữa chúng trong một file YAML, chạy bằng một lệnh.

**Đào sâu:** Không có nó thì phải gõ 5 lệnh `docker run` dài với `--network`, `--env`, `--volume` mỗi
lần khởi động.

### D2 ⭐ `depends_on` có đợi service kia sẵn sàng không?

**Ngắn:** **Không.** Mặc định nó chỉ đợi container **khởi động**, không đợi ứng dụng bên trong sẵn sàng.

**Đào sâu:** Đây là câu bẫy hay gặp. Postgres "Up" không có nghĩa là nó đã nhận kết nối — nó còn đang
khởi tạo.

Sửa bằng healthcheck + `condition`:

```yaml
services:
  app:
    depends_on:
      postgres: { condition: service_healthy }
  postgres:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blog"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Nhưng cách chắc chắn nhất vẫn là **ứng dụng tự retry kết nối** — vì database có thể restart bất cứ lúc
nào sau đó, không chỉ lúc khởi động.

### D3 `docker compose up` khác `up -d` và `up --build`?

**Ngắn:** `-d` chạy nền; `--build` build lại ảnh trước khi chạy.

**Đào sâu:** Sửa Dockerfile mà quên `--build` là chạy ảnh cũ — nguồn của "sao em sửa rồi mà không đổi".

### D4 `docker compose down` khác `stop`?

**Ngắn:** `stop` dừng container; `down` dừng **và xoá** container + network.

**Đào sâu:** `down -v` xoá cả volume. Với môi trường có dữ liệu thật, đừng gõ `-v` theo phản xạ.

### D5 ⭐ Server đầy đĩa vì Docker — bạn làm gì?

**Ngắn:** `docker system df` để xem cái gì chiếm chỗ, rồi dọn có chọn lọc.

**Đào sâu:** Đo thật trên một máy dev:

```bash
$ docker system df
TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          9         3         2.365GB   407.7MB (17%)
Containers      3         2         7.593kB   3.479kB (45%)
Local Volumes   6         2         893.9MB   623.2MB (69%)
Build Cache     161       0         11.63GB   11.36GB
```

Thủ phạm thường là **Build Cache**, không phải ảnh — ở đây 11.63GB và **toàn bộ thu hồi được**.

```bash
$ docker builder prune --filter "until=168h" -f
$ docker image prune -a --filter "until=168h" -f
```

> ⚠️ Đừng `docker system prune -a --volumes` theo phản xạ — nó xoá volume không gắn container nào. Nếu
> database đang dừng lúc đó thì **mất dữ liệu**.

Phòng ngừa: giới hạn log.

```yaml
logging:
  driver: json-file
  options: { max-size: "10m", max-file: "3" }
```

### D6 Xem log container thế nào?

**Ngắn:** `docker compose logs -f app`, hoặc `docker logs --tail 100 -f <container>`.

**Đào sâu:** Ứng dụng trong container nên log ra **stdout**, không ghi file — container bị xoá là mất
log. Đó là lý do `LOG_CHANNEL=stderr` / log ra console là cấu hình đúng cho Docker.

### D7 Debug container không khởi động được?

**Ngắn:** `docker logs` trước, rồi `docker run --entrypoint sh -it <image>` để vào xem.

**Đào sâu:** Thứ tự kiểm tra:

```bash
$ docker compose logs app                        # lỗi gì
$ docker compose ps                              # exit code bao nhiêu
$ docker run --rm --entrypoint sh -it <image>    # vào trong xem file có đúng không
$ docker inspect <container> --format '{{.State.ExitCode}}'
```

Exit code 137 = bị `SIGKILL` (thường do hết bộ nhớ hoặc timeout khi dừng). Exit code 1 = ứng dụng tự thoát.

### D8 ⭐ Compose dùng được trên production không?

**Ngắn:** Được, cho ứng dụng chạy trên **một máy**.

**Đào sâu:** Câu trả lời chín chắn:

> "Với một dịch vụ và vài container, Compose trên một VPS là đủ và ít thứ phải vận hành. Em chuyển sang
> orchestrator khi có nhu cầu thật — cần nhiều máy để chịu tải, cần rolling update không downtime, hoặc
> nhiều team cùng deploy. Nhảy thẳng lên Kubernetes cho một dịch vụ là thêm rất nhiều chi phí vận hành
> mà không giải quyết vấn đề gì."

Chi tiết ở [bài 08 mục 4](../08-registry-ci-orchestration.md).

---

## E — Bảo mật và production

### E1 ⭐ Deploy bằng tag `latest` có vấn đề gì?

**Ngắn:** Không biết đang chạy bản nào, không rollback được, không tái lập được.

**Đào sâu:** Dùng **git SHA** làm tag:

```bash
$ GIT_SHA=$(git rev-parse --short HEAD)
$ docker build -t ghcr.io/vanson/blog-api:"$GIT_SHA" .
```

Rollback thành đổi một biến môi trường. Chi tiết ở [bài 08 mục 1](../08-registry-ci-orchestration.md).

### E2 Làm sao giấu secret khi build ảnh?

**Ngắn:** BuildKit secret mount — nó không đi vào layer nào.

**Đào sâu:**

```dockerfile
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci
```

```bash
$ docker build --secret id=npmrc,src=$HOME/.npmrc -t blog-api .
```

`ENV` và `ARG` đều lộ (xem [B9](#b9-arg-khác-env-thế-nào)).

### E3 Quét lỗ hổng ảnh bằng gì?

**Ngắn:** `docker scout cves` hoặc `trivy image`.

**Đào sâu:** Đưa vào CI với `exit-code: 1` cho mức HIGH/CRITICAL để build đỏ khi có lỗ hổng. Cách giảm
CVE hiệu quả nhất là dùng ảnh nền nhỏ — `-alpine` hoặc `distroless` có ít gói nên ít CVE.

### E4 Healthcheck để làm gì? Liveness khác readiness?

**Ngắn:** Healthcheck cho Docker biết ứng dụng bên trong có ổn không. Liveness hỏng → **restart**;
readiness hỏng → **ngưng gửi traffic** nhưng không restart.

**Đào sâu:** Vì sao cần tách: ứng dụng đang chạy migration thì **còn sống** nhưng **chưa sẵn sàng**.
Chỉ có liveness thì Kubernetes restart liên tục và không bao giờ khởi động xong.

```yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s     # ← quan trọng, tránh unhealthy lúc đang khởi động
```

Endpoint healthcheck nên kiểm tra thật (database, Redis), không chỉ trả 200 suông.

### E5 Danh sách kiểm tra trước khi đưa ảnh lên production?

**Ngắn:**

- [ ] Multi-stage, ảnh cuối không có toolchain build
- [ ] `USER` không phải root
- [ ] `.dockerignore` có `.env`, `node_modules`, `.git`
- [ ] Tag bằng git SHA, không `latest`
- [ ] Không có secret trong `ENV`/`ARG`
- [ ] Có `dumb-init`/`tini` để nhận `SIGTERM`
- [ ] Có healthcheck với `start_period`
- [ ] Giới hạn log (`max-size`, `max-file`)
- [ ] Volume cho dữ liệu, và **đã thử khôi phục sao lưu ít nhất một lần**

Gạch cuối là thứ hay bị bỏ qua nhất và đáng nói nhất trong phỏng vấn.

---

## Bài tập thực hành

Làm thật, ghi lại con số của bạn:

1. Build ảnh NestJS **không** multi-stage, ghi kích thước. Rồi tách multi-stage và ghi lại. So hai số.
2. Đảo `COPY . .` lên trước `RUN npm ci`. Sửa một file code và build lại. So thời gian với thứ tự đúng.
3. Bỏ `USER node`, chạy `docker exec <container> whoami`. Thêm lại và kiểm tra lần nữa.
4. Thêm `ENV DB_PASSWORD=secret` rồi chạy `docker inspect --format '{{json .Config.Env}}'`. Bạn thấy gì?
5. Bỏ `dumb-init`, chạy `docker stop --timeout 30`. Đo thời gian dừng. Thêm lại và đo lần nữa.
6. Bỏ `condition: service_healthy` khỏi `depends_on`, chạy `docker compose up`. App có lỗi kết nối không?
7. Chạy `docker system df` trên máy bạn. Dòng nào chiếm nhiều nhất? Dọn rồi chạy lại.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Dự án blog-api: **1.2GB → 180MB**. Phần chênh là `devDependencies`, mã nguồn TypeScript và
toolchain build.

**2.** Thứ tự sai: mỗi lần sửa code là `npm ci` chạy lại — build từ ~10 giây thành ~2 phút.

**4.**
```
["PATH=/usr/local/sbin:...","DB_PASSWORD=secret123"]
```
Mật khẩu nằm nguyên văn trong metadata. Ai pull được ảnh đều đọc được, không cần chạy container.

**5.** Không có `dumb-init`: dừng gần như tức thì vì `node` làm PID 1 bỏ qua `SIGTERM` rồi bị
`SIGKILL`. Có `dumb-init`: chờ ứng dụng tự đóng.

**7.** Trên máy đo thật, **Build Cache 11.63GB** với `ACTIVE = 0` — thu hồi được toàn bộ. Thủ phạm
thường là cái này chứ không phải ảnh.

</details>

---

Tiếp theo: [02-tu-kiem-tra.md](./02-tu-kiem-tra.md)
