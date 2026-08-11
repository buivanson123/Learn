# Học Docker nhanh nhất (áp dụng thẳng vào dự án NestJS)

Docker đóng gói ứng dụng của bạn **cùng với môi trường chạy nó** (Node version, thư viện hệ thống, biến môi trường) thành một khối duy nhất. Khối đó chạy giống hệt nhau trên máy bạn, máy đồng nghiệp và server production.

Bạn đã có bộ [NestJS](../nestjs/README.md) với TypeORM + PostgreSQL + JWT. Tài liệu này dạy Docker **bằng chính dự án đó**: mọi ví dụ đều là Dockerfile / compose thật, chạy được, không phải ví dụ `hello-world` bỏ đi sau 5 phút.

---

## Lộ trình 3 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-khai-niem.md](./00-khai-niem.md) | Image / Container / Volume / Network. **File nền tảng** | 2h |
| 1 | [01-lenh-co-ban.md](./01-lenh-co-ban.md) | 20 lệnh dùng 95% thời gian + chạy PostgreSQL bằng Docker | 2h |
| 2 | [02-dockerfile-nestjs.md](./02-dockerfile-nestjs.md) | Viết Dockerfile cho NestJS, từ bản ngây thơ → multi-stage | 3h |
| 2 | [03-compose-dev.md](./03-compose-dev.md) | Môi trường dev: API + Postgres + Redis, hot reload, debug | 3h |
| 3 | [04-compose-prod.md](./04-compose-prod.md) | Production: healthcheck, migration, Nginx, deploy | 3h |
| 3 | [05-toi-uu.md](./05-toi-uu.md) | Giảm image từ 1.8GB → 275MB, build cache, bảo mật | 2h |
| — | [06-loi-thuong-gap.md](./06-loi-thuong-gap.md) | 18 lỗi kinh điển và cách sửa | — |
| — | [07-cheatsheet.md](./07-cheatsheet.md) | Tra cứu nhanh lệnh, instruction, cú pháp compose | — |

Kết quả sau 3 ngày: `docker compose up` là chạy được toàn bộ dự án Blog API, và một image production dưới 300MB.

---


## Bài bổ sung + chuẩn bị phỏng vấn

| File | Nội dung |
|------|----------|
| [08-registry-ci-orchestration.md](./08-registry-ci-orchestration.md) | Registry, tag bằng git SHA, build trong CI, secret lúc build, Compose ↔ Kubernetes, deploy không downtime, dọn đĩa |
| [phong-van/](./phong-van/README.md) | 40 câu hỏi kèm đáp án hai tầng + checklist tự kiểm tra |

Bốn câu Docker hay bị hỏi nhất: **image khác container**, **vì sao `COPY package.json` trước `COPY . .`**,
**multi-stage để làm gì**, và **`CMD` khác `ENTRYPOINT`**.

---

## Ba nguyên tắc cốt lõi của Docker

Hiểu 3 điều này là hiểu 80% những gì bạn sẽ gặp.

### 1. Image là bản thiết kế, container là thứ đang chạy

Image là file **chỉ đọc**, bất biến. Container là một tiến trình sinh ra từ image, có phần ghi riêng.

```
Dockerfile  --build-->  Image  --run-->  Container (chạy được nhiều cái từ 1 image)
```

```bash
$ docker build -t blog-api:1.0 .        # Dockerfile → Image
$ docker run -d --name api1 blog-api:1.0   # Image → Container
$ docker run -d --name api2 blog-api:1.0   # ...và một container nữa, cùng image
```

Sửa code xong mà container không đổi? Vì bạn chưa build lại image:

```bash
$ vim src/app.service.ts             # sửa code
$ docker compose restart api         # ❌ vẫn chạy image cũ, code cũ
$ docker compose up -d --build api   # ✅ build lại image rồi thay container
```

Container **không tự cập nhật** theo code.

### 2. Container mất hết dữ liệu khi bị xoá

Mọi thứ container ghi ra đều nằm trong lớp ghi tạm và biến mất cùng container:

```bash
$ docker run -d --name db -e POSTGRES_PASSWORD=x postgres:18-alpine   # không có volume
$ docker exec db psql -U postgres -c 'CREATE TABLE users(id int);'
$ docker rm -f db                                    # dữ liệu bay theo container
```

Muốn giữ lại (dữ liệu PostgreSQL, file upload) phải thêm **volume**:

```bash
$ docker run -d --name db -e POSTGRES_PASSWORD=x \
    -v pgdata:/var/lib/postgresql/data postgres:18-alpine
```

> `docker compose down -v` — chữ `-v` xoá luôn volume, tức mất sạch database. Nhớ kỹ ký tự này.

### 3. Mỗi container là một máy riêng, `localhost` không phải máy bạn

Bên trong container API, `localhost` trỏ về chính container đó — **không** phải máy Mac của bạn, cũng **không** phải container Postgres.

Trong `.env` của `blog-api`:

```env
DB_HOST=localhost   # ❌ khi NestJS chạy trong container
DB_HOST=postgres    # ✅ tên service trong docker-compose.yml
```

Sai thì log hiện chính xác thế này:

```
api  | [Nest] ERROR [TypeOrmModule] Unable to connect to the database.
api  | Error: connect ECONNREFUSED 127.0.0.1:5432
```

Địa chỉ `127.0.0.1` trong thông báo lỗi là dấu hiệu nhận biết: container đang tự gọi chính nó. Đây là lỗi số 1 của người mới — nếu chỉ nhớ được một điều từ tài liệu này, hãy nhớ điều này.

---

## Cách học hiệu quả nhất

1. **Gõ lệnh song song với đọc.** Docker học bằng tay, không học bằng mắt.
2. **Mỗi bài đều làm bài tập cuối file.** Có đáp án gợi ý ngay dưới.
3. **Bám vào một dự án duy nhất** — dùng `blog-api` từ bộ NestJS. Đừng tạo project mới cho mỗi bài.
4. **Khi lỗi, đọc log trước khi Google:** `docker compose logs -f api`. 90% lỗi Docker tự nói ra nguyên nhân.

---

## Yêu cầu môi trường

- **Docker Desktop** cho macOS (bao gồm cả `docker` và `docker compose`)
- Dự án NestJS `blog-api` (từ bộ tài liệu NestJS)
- 8GB RAM trở lên, ~10GB ổ trống

Kiểm tra đã cài đúng:

```bash
$ docker version --format 'Client: {{.Client.Version}} | Server: {{.Server.Version}}'
Client: 29.7.2 | Server: 29.7.2

$ docker compose version
Docker Compose version v5.3.1     # phải là v2 trở lên, gõ "docker compose" (có dấu cách)

$ docker run --rm hello-world
Hello from Docker!
```

> Nếu `docker compose version` báo `command not found` nhưng `docker-compose version` (có gạch nối) lại chạy, bạn đang dùng Compose v1 — bản này đã ngừng hỗ trợ từ 2023 và **không** chạy được cú pháp trong tài liệu này (`condition: service_healthy`, `develop.watch`, `profiles`). Cài lại Docker Desktop bản mới.

---

## Phiên bản tài liệu này bám theo

| Thành phần | Bản dùng trong tài liệu | Ghi chú |
|---|---|---|
| Docker Engine / Compose | 29.x / v5.x | Toàn bộ file compose đã validate bằng `docker compose config`, không cảnh báo deprecated |
| Node | `node:24-alpine` (v24.19.0) | LTS hiện hành |
| PostgreSQL | `postgres:18-alpine` (18.4) | |
| Redis | `redis:8-alpine` (8.10.0) | |
| Nginx | `nginx:1.31-alpine` | |

Tài liệu **không** dùng cú pháp đã lỗi thời: không `docker-compose` (v1), không khoá `version: "3.8"` trong file compose (đã bị bỏ khỏi spec), không `MAINTAINER`, không `links:`.

Vài tháng nữa các bản trên sẽ có bản mới hơn. Kiểm tra bằng:

```bash
docker run --rm node:lts-alpine node -v
docker run --rm postgres:alpine postgres --version
```

Bắt đầu tại 👉 [00-khai-niem.md](./00-khai-niem.md)
