# Bài 0 — Khái niệm nền tảng

Bài này không có nhiều lệnh. Nhưng nếu bỏ qua, bạn sẽ dùng Docker bằng cách copy lệnh trên mạng và không hiểu vì sao lúc chạy được lúc không.

---

## 1. Vấn đề Docker giải quyết

Dự án `blog-api` của bạn cần: Node 24, PostgreSQL 18, Redis, một số biến môi trường. Người mới vào team phải cài từng thứ, và họ sẽ gặp:

- Máy họ có Node 18 → `??=` báo lỗi cú pháp
- Họ cài PostgreSQL 14 → migration dùng cú pháp mới của 16 thì hỏng
- Trên macOS chạy ngon, deploy lên Ubuntu thì `bcrypt` lỗi vì biên dịch native khác nền tảng

Docker gói **ứng dụng + Node + thư viện hệ thống** vào một image. Ai chạy image đó cũng có môi trường y hệt nhau, bất kể máy họ cài gì.

Docker **không phải** máy ảo. Máy ảo giả lập cả phần cứng và chạy nguyên một hệ điều hành. Container chỉ là **tiến trình bị cô lập** trên nhân Linux dùng chung.

Đo thử ngay — khởi động một "máy" Linux đầy đủ mất bao lâu:

```bash
$ time docker run --rm alpine:3.24 echo "xong"
xong
real    0m0.412s          ← chưa tới nửa giây

$ docker images alpine:3.24
REPOSITORY   TAG    SIZE
alpine       3.20   7.8MB   ← 7.8 MB
```

So sánh: bật một VM Ubuntu trong VirtualBox mất 20–40 giây, chiếm 2GB RAM và ~10GB ổ. Đó là khác biệt về **bậc độ lớn**, không phải khác biệt nhỏ.

> Trên macOS không có nhân Linux, nên Docker Desktop chạy sẵn một máy ảo Linux nhỏ và mọi container nằm trong đó. Điều này giải thích vì sao bind mount trên Mac chậm hơn Linux — sẽ nói ở bài 05.

---

## 2. Image — bản thiết kế

Image là hệ thống file **chỉ đọc**, đóng băng, gồm nhiều **layer** xếp chồng.

```
┌────────────────────────────┐
│ layer 4: dist/ (code build)│  ← COPY --from=build /app/dist ./dist
├────────────────────────────┤
│ layer 3: node_modules      │  ← RUN npm ci
├────────────────────────────┤
│ layer 2: package.json      │  ← COPY package*.json ./
├────────────────────────────┤
│ layer 1: node:24-alpine    │  ← FROM
└────────────────────────────┘
```

Mỗi dòng lệnh trong Dockerfile tạo ra một layer. Đây là chi tiết quan trọng nhất của cả tài liệu, vì:

- **Layer được cache.** Layer nào không đổi thì build lần sau dùng lại, không chạy lại.
- **Layer đổi thì mọi layer bên trên nó đều phải build lại.**

Hệ quả trực tiếp: nếu bạn `COPY . .` **trước** `RUN npm ci`, thì sửa một dòng trong `app.service.ts` cũng làm cache của `npm ci` hỏng.

Nhìn thấy điều đó ngay trong output khi build lần thứ hai:

```bash
$ docker build -t blog-api:1.0 .
 => [2/5] WORKDIR /app                          CACHED     ← dùng lại
 => [3/5] COPY package.json package-lock.json ./ CACHED    ← dùng lại
 => [4/5] RUN npm ci                             CACHED    ← dùng lại, tiết kiệm 2 phút
 => [5/5] COPY . .                               0.3s      ← chỉ dòng này chạy lại
```

Chữ `CACHED` là thứ bạn cần nhìn mỗi lần build. Còn nếu đặt sai thứ tự, output sẽ thành:

```bash
 => [3/5] COPY . .                               0.4s
 => [4/5] RUN npm ci                             118.2s    ← cài lại từ đầu vì 1 dòng comment
```

Bài 02 sẽ khai thác điều này.

Tên image có dạng `registry/tên:tag`:

```
node:24-alpine            → Docker Hub, image "node", tag "22-alpine"
postgres:18-alpine        → PostgreSQL 18 bản Alpine
ghcr.io/vanson/blog:1.0.3 → registry riêng (GitHub Container Registry)
```

### Tag nằm ở đâu? Đúng 3 chỗ

Bạn sẽ gõ tag ở ba nơi trong dự án `blog-api`, và cả ba đều phải ghim phiên bản:

**1. Dòng `FROM` trong `Dockerfile`** — chọn image nền:

```dockerfile
FROM node:24-alpine     # ✅ ghim major version
FROM node               # ❌ Docker ngầm hiểu là node:latest
```

**2. Khoá `image:` trong `docker-compose.yml`**:

```yaml
services:
  postgres:
    image: postgres:18-alpine    # ✅
  redis:
    image: redis                 # ❌ = redis:latest
```

**3. Cờ `-t` khi bạn build image của chính mình**:

```bash
docker build -t blog-api:1.0 .    # ✅ có tag rõ ràng
docker build -t blog-api .        # ❌ Docker tự đặt thành blog-api:latest
```

### Vì sao `latest` nguy hiểm

`latest` **không** có nghĩa là "bản mới nhất bạn đang có". Nó chỉ là một cái tên, trỏ tới bất kỳ bản nào người phát hành gắn nhãn đó lần gần nhất. Nó có thể đổi bất cứ lúc nào mà bạn không hay biết.

Chạy thử ngay trên máy bạn, so `latest` với bản LTS:

```bash
$ docker run --rm node:lts-alpine node -v
v24.19.0          ← bản LTS, ổn định, dùng cho production

$ docker run --rm node:latest node -v
v26.7.0           ← "latest" đang là bản Current, cách LTS tận 2 major
```

`latest` **không phải** bản khuyến nghị — nó là bản mới nhất người phát hành đẩy lên, thường là nhánh Current chưa vào LTS. Và nó đổi bất cứ lúc nào: hôm nay `v26.7.0`, vài tháng nữa `v27.x`, trong khi Dockerfile của bạn không hề thay đổi.

Hậu quả cụ thể với `blog-api`: `package.json` khai báo

```json
{ "engines": { "node": ">=22 <25" } }
```

Dùng `FROM node:latest`, CI báo lỗi trong khi **không ai sửa một dòng code nào**:

```
npm error code EBADENGINE
npm error notsup Unsupported engine {"node":">=22 <25"}
npm error notsup Actual:   {"node":"v26.7.0"}
```

Commit hôm qua build được, hôm nay hỏng. Ghim `node:24-alpine` thì tình huống này không bao giờ xảy ra.

Kiểm tra máy bạn có image nào đang dính `latest` không:

```bash
$ docker images | grep latest
node         latest    9f3c2a1b8d4e   2 days ago     1.25GB
adminer      latest    a1b2c3d4e5f6   2 weeks ago    250MB
```

---

## 3. Container — thứ đang chạy

Container = image + một **lớp ghi mỏng** ở trên cùng + một tiến trình đang chạy.

```bash
docker run -d --name api -p 3000:3000 blog-api:1.0
```

Từ một image có thể chạy 10 container độc lập. Mỗi cái có lớp ghi riêng, không thấy nhau.

Điểm sống còn: **lớp ghi đó bị xoá cùng container.** Bạn `docker rm` container Postgres là mất sạch dữ liệu. Đó là lý do có volume.

### Vòng đời

```
created  →  running  →  stopped  →  removed
             ↑    ↓
           start  stop
```

Container **stopped** vẫn còn dữ liệu, `docker start` lại là chạy tiếp. Container **removed** thì hết. Thấy tận mắt sự khác biệt:

```bash
$ docker run -d --name thu -e POSTGRES_PASSWORD=x postgres:18-alpine
$ docker exec thu touch /tmp/dau-vet.txt      # tạo một file làm dấu

$ docker stop thu && docker start thu
$ docker exec thu ls /tmp/dau-vet.txt
/tmp/dau-vet.txt                              ← còn nguyên

$ docker rm -f thu
$ docker run -d --name thu -e POSTGRES_PASSWORD=x postgres:18-alpine
$ docker exec thu ls /tmp/dau-vet.txt
ls: /tmp/dau-vet.txt: No such file or directory   ← container mới, sạch trơn
```

### Container chết khi tiến trình chính chết

Container không phải máy ảo luôn bật. Nó sống đúng bằng tuổi thọ của lệnh `CMD`:

```bash
# "echo" chạy xong là hết việc → container tắt ngay
$ docker run --name ngan-ngui alpine:3.24 echo "hello"
hello
$ docker ps
CONTAINER ID   IMAGE   STATUS          ← trống, không thấy nó đâu
$ docker ps -a
CONTAINER ID   IMAGE          STATUS
9f2a...        alpine:3.24    Exited (0) 3 seconds ago

# "sleep 300" còn chạy → container sống
$ docker run -d --name song-lau alpine:3.24 sleep 300
$ docker ps
CONTAINER ID   IMAGE          STATUS
7c1b...        alpine:3.24    Up 5 seconds
```

Với `blog-api`, hiện tượng bạn sẽ gặp trông như thế này:

```bash
$ docker compose ps -a
NAME   IMAGE       STATUS
api    blog-api    Exited (1) 2 seconds ago      ← mã 1 = app crash

$ docker compose logs api
api  | Error: Cannot find module '@nestjs/core'
api  |     at Module._resolveFilename (node:internal/modules/cjs/loader:1145:15)
```

Container "vừa chạy đã tắt" gần như luôn có nghĩa là **ứng dụng của bạn crash**, không phải Docker hỏng. Exit code nói cho bạn biết loại lỗi (bảng đầy đủ ở [bài 06](./06-loi-thuong-gap.md), lỗi #6).

---

## 4. Volume — nơi giữ dữ liệu

Có 2 loại bạn thực sự dùng:

### Named volume — cho database

```yaml
volumes:
  - pgdata:/var/lib/postgresql/data
#   ↑ tên volume        ↑ đường dẫn bên trong container
```

Docker tự quản lý chỗ lưu. Container xoá đi tạo lại, dữ liệu vẫn còn. **Luôn dùng cho PostgreSQL.**

Chứng minh bằng 6 lệnh:

```bash
# 1. Chạy Postgres có volume, tạo một bảng
$ docker run -d --name db -e POSTGRES_PASSWORD=x -e POSTGRES_DB=blog \
    -v pgdata:/var/lib/postgresql/data postgres:18-alpine
$ docker exec db psql -U postgres -d blog -c 'CREATE TABLE users(id int);'
CREATE TABLE

# 2. Xoá sạch container
$ docker rm -f db

# 3. Chạy container MỚI, gắn lại đúng volume cũ
$ docker run -d --name db -e POSTGRES_PASSWORD=x -e POSTGRES_DB=blog \
    -v pgdata:/var/lib/postgresql/data postgres:18-alpine
$ docker exec db psql -U postgres -d blog -c '\dt'
        List of relations
 Schema | Name  | Type  |  Owner
--------+-------+-------+----------
 public | users | table | postgres     ← bảng vẫn còn
```

Bỏ cờ `-v` ở bước 1 và 3 rồi làm lại, bước cuối sẽ ra `Did not find any relations.` — dữ liệu đã bay theo container.

### Bind mount — cho code lúc dev

```yaml
volumes:
  - .:/app
#   ↑ thư mục trên máy Mac   ↑ đường dẫn trong container
```

Gắn thẳng thư mục trên máy bạn vào container:

```bash
$ docker run -d --name api -v $(pwd):/app -w /app node:24-alpine sleep 300

# Tạo file trên máy Mac
$ echo "console.log('hi')" > test.js

# Container thấy ngay lập tức, không cần build lại
$ docker exec api cat /app/test.js
console.log('hi')
```

Đó chính là cơ chế làm hot reload hoạt động: bạn Cmd+S ở VS Code → file đổi trong container → `nest start --watch` phát hiện và reload. **Chỉ dùng khi dev, tuyệt đối không dùng ở production** (production phải chạy code đã đóng gói sẵn trong image).

### Cái bẫy kinh điển

```yaml
volumes:
  - .:/app                 # đè cả thư mục /app trong container
  - /app/node_modules      # ...trừ node_modules — giữ nguyên bản trong image
```

Dòng 1 đè `/app` của container bằng thư mục máy bạn — **kể cả** `node_modules` mà bạn vừa `npm ci` lúc build image. Chỉ có dòng 1, không có dòng 2, bạn sẽ gặp:

```bash
$ docker compose logs api
api  | Error: Cannot find module '@nestjs/core'
api  | Require stack:
api  | - /app/dist/main.js
api exited with code 1
```

Xem tận mắt nguyên nhân:

```bash
# Trong image, node_modules có 800+ package
$ docker run --rm blog-api:dev ls node_modules | wc -l
847

# Nhưng khi bind mount đè lên, container nhìn thấy thư mục của máy Mac
$ docker run --rm -v $(pwd):/app -w /app blog-api:dev ls node_modules | wc -l
ls: node_modules: No such file or directory
0

# Thêm anonymous volume che lại → node_modules của image quay về
$ docker run --rm -v $(pwd):/app -v /app/node_modules -w /app blog-api:dev ls node_modules | wc -l
847
```

Dòng 2 là **anonymous volume**. Docker ưu tiên mount có đường dẫn dài hơn (`/app/node_modules` cụ thể hơn `/app`), nên nó "che" lại đúng thư mục đó và giữ `node_modules` do image tạo ra. Hai dòng này luôn đi cùng nhau, không bao giờ tách rời.

---

## 5. Network — container nói chuyện với nhau

Docker Compose tự tạo một mạng riêng cho các service trong file, và **tên service chính là hostname**.

```yaml
services:
  api:        # ← từ postgres gọi được bằng "api"
  postgres:   # ← từ api gọi được bằng "postgres"
```

Kiểm chứng từ bên trong container `api`:

```bash
$ docker compose exec api getent hosts postgres
172.19.0.3      postgres           ← Docker đã đăng ký DNS cho tên service

$ docker compose exec api getent hosts localhost
127.0.0.1       localhost          ← đây là chính container api, KHÔNG phải Postgres

$ docker compose exec api wget -qO- http://redis:6379 ; echo
# kết nối được (Redis trả về lỗi giao thức, nhưng DNS đã phân giải đúng)
```

Nên trong `.env` dùng cho container:

```env
DB_HOST=postgres        # tên service, KHÔNG phải localhost
DB_PORT=5432            # cổng NỘI BỘ, không phải cổng đã map ra ngoài
REDIS_HOST=redis
```

### Phân biệt port trong và port ngoài

```yaml
ports:
  - "5433:5432"
#    ↑     ↑
#    │     └── cổng bên trong container (api dùng cái này)
#    └──────── cổng trên máy Mac (TablePlus/psql trên máy dùng cái này)
```

Từ container `api` → `postgres:5432`. Từ TablePlus trên máy Mac → `localhost:5433`.

Thử cả hai phía để thấy rõ:

```bash
# Từ máy Mac: phải dùng cổng ĐÃ MAP là 5433
$ psql -h localhost -p 5433 -U postgres -d blog -c 'SELECT 1;'
 ?column?
----------
        1

$ psql -h localhost -p 5432 -U postgres -d blog -c 'SELECT 1;'
psql: error: connection to server at "localhost", port 5432 failed: Connection refused

# Từ container api: phải dùng cổng NỘI BỘ là 5432
$ docker compose exec api nc -zv postgres 5432
postgres (172.19.0.3:5432) open

$ docker compose exec api nc -zv postgres 5433
nc: postgres (172.19.0.3:5433): Connection refused
```

`ports` chỉ cần khi bạn muốn truy cập **từ máy host**. Hai container nói chuyện với nhau không cần mở port nào cả — bỏ hẳn dòng `ports` của `postgres` thì `api` vẫn kết nối bình thường, chỉ có TablePlus là mất đường vào. Ở production bạn **nên** bỏ, để database không lộ ra Internet.

---

## 6. Bức tranh tổng thể cho blog-api

```
                     Máy Mac của bạn
  ┌──────────────────────────────────────────────────┐
  │  localhost:3000 ──┐            localhost:5433 ─┐ │
  └───────────────────┼──────────────────────────┬─┼─┘
                      │  mạng blog-api_default   │ │
  ┌───────────────────▼──────────────────────────▼─▼──┐
  │  ┌────────────┐    postgres:5432   ┌────────────┐ │
  │  │ api        │───────────────────▶│ postgres   │ │
  │  │ node:24    │                    │ pg:18      │ │
  │  │ :3000      │───┐                └─────┬──────┘ │
  │  └────────────┘   │ redis:6379           │        │
  │                   ▼                   [pgdata]    │
  │            ┌────────────┐             volume      │
  │            │ redis      │                         │
  │            └────────────┘                         │
  └───────────────────────────────────────────────────┘
```

Ba container, một mạng, một volume. Đây chính là thứ bạn sẽ dựng ở bài 03.

---

## 7. Từ vựng phải nhớ

| Thuật ngữ | Là gì | Lệnh liên quan |
|---|---|---|
| Image | Bản thiết kế chỉ đọc | `docker build`, `docker images` |
| Container | Thể hiện đang chạy của image | `docker run`, `docker ps` |
| Layer | Một tầng của image, được cache | (ẩn, thấy qua `docker history`) |
| Volume | Nơi lưu dữ liệu sống lâu hơn container | `docker volume ls` |
| Network | Mạng ảo để container gọi nhau | `docker network ls` |
| Registry | Kho chứa image (Docker Hub, GHCR) | `docker pull`, `docker push` |
| Dockerfile | Công thức để build image | `docker build -f` |
| Compose | Khai báo nhiều container bằng YAML | `docker compose up` |

---

## Bài tập

1. Giải thích bằng lời của bạn: vì sao xoá container Postgres thì mất dữ liệu, nhưng xoá container có gắn named volume thì không?
2. Bạn có `ports: ["8080:3000"]`. Từ trình duyệt trên Mac phải mở cổng nào? Từ container `nginx` cùng mạng gọi service `api` bằng URL nào?
3. Dockerfile đặt `COPY . .` ngay trước `RUN npm ci`. Sửa 1 dòng comment trong `main.ts` rồi build lại — layer nào bị build lại? Vì sao chậm?
4. Trong `docker-compose.yml`, service tên `db` chạy Postgres. `.env` phải ghi `DB_HOST=` gì?

<details>
<summary>Gợi ý đáp án</summary>

1. Dữ liệu container nằm ở lớp ghi tạm, xoá container là xoá lớp đó. Named volume nằm ngoài container, do Docker quản lý riêng, nên container mất thì volume vẫn còn và gắn lại được.
2. Trình duyệt: `http://localhost:8080`. Từ nginx: `http://api:3000` — dùng cổng nội bộ, không phải 8080.
3. `COPY . .` bị đổi → layer đó và **mọi layer sau nó** (bao gồm `npm ci`) phải chạy lại. Cài lại toàn bộ dependency chỉ vì một comment.
4. `DB_HOST=db`.
</details>

---

Tiếp theo 👉 [01-lenh-co-ban.md](./01-lenh-co-ban.md)
