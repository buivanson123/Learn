# Bài 7 — Cheatsheet

Tra cứu nhanh. In ra dán cạnh màn hình cũng được.

---

## 1. Container

```bash
docker run -d --name api -p 3000:3000 blog-api:1.0
docker run --rm -it node:24-alpine sh        # dùng thử rồi vứt
docker ps                                     # đang chạy
docker ps -a                                  # tất cả
docker ps -s                                  # kèm dung lượng
docker stop api / start api / restart api
docker rm api / docker rm -f api
docker logs -f --tail 100 api
docker exec -it api sh
docker stats                                  # CPU/RAM realtime
docker inspect api
docker top api                                # tiến trình bên trong
docker cp api:/app/dist ./dist-copy
```

## 2. Image

```bash
docker build -t blog-api:1.0 .
docker build --target development -t blog-api:dev .
docker build --no-cache -t blog-api:1.0 .
docker build --build-arg NODE_VERSION=20 -t blog-api:node20 .
docker images
docker history blog-api:1.0                   # tìm layer phình
docker tag blog-api:1.0 ghcr.io/vanson/blog-api:1.0
docker push ghcr.io/vanson/blog-api:1.0
docker pull postgres:18-alpine
docker rmi blog-api:1.0
docker scout cves blog-api:1.0
```

## 3. Compose

```bash
docker compose up -d                 # chạy nền
docker compose up --build            # build lại rồi chạy
docker compose up -d --no-deps api   # chỉ 1 service, không đụng dependency
docker compose ps / ps -a
docker compose logs -f api
docker compose exec api sh
docker compose run --rm api npm run migration:run   # container dùng 1 lần
docker compose restart api
docker compose stop / start
docker compose down                  # xoá container + network, GIỮ volume
docker compose down -v               # ⚠️ xoá cả volume
docker compose build api
docker compose pull
docker compose config                # in cấu hình đã merge — debug YAML
docker compose top
docker compose -f a.yml -f b.yml up -d
docker compose --profile tools up -d
docker compose up -d --scale api=3
docker compose watch                 # đồng bộ file kiểu mới
```

## 4. Volume / Network / Dọn dẹp

```bash
docker volume ls / inspect <tên> / rm <tên>
docker network ls / inspect <tên> / create <tên>

docker system df                     # đang tốn bao nhiêu
docker system prune                  # dọn an toàn
docker system prune -a --volumes     # ⚠️ dọn sạch, mất database
docker builder prune                 # xoá cache build
```

---

## 5. Dockerfile — instruction

| Instruction | Ví dụ |
|---|---|
| `FROM` | `FROM node:24-alpine AS build` |
| `WORKDIR` | `WORKDIR /app` |
| `COPY` | `COPY --chown=node:node package*.json ./` |
| `COPY --from` | `COPY --from=build /app/dist ./dist` |
| `RUN` | `RUN npm ci` (chạy lúc **build**) |
| `ENV` | `ENV NODE_ENV=production` |
| `ARG` | `ARG NODE_VERSION=24` (chỉ lúc build) |
| `EXPOSE` | `EXPOSE 3000` (chỉ là tài liệu) |
| `USER` | `USER node` |
| `VOLUME` | `VOLUME /app/uploads` |
| `HEALTHCHECK` | `HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/api/health \|\| exit 1` |
| `CMD` | `CMD ["node", "dist/main"]` (chạy lúc **start**) |
| `ENTRYPOINT` | `ENTRYPOINT ["dumb-init", "--"]` |

**Nhớ:** `RUN` = lúc build. `CMD` = lúc chạy. Luôn dùng dạng mảng cho `CMD`/`ENTRYPOINT` để tín hiệu đến đúng tiến trình.

---

## 6. Dockerfile NestJS — bản rút gọn để copy

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM deps AS build
COPY . .
RUN npm run build

FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000 9229
CMD ["npm", "run", "start:dev"]

FROM base AS runner
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build     --chown=node:node /app/dist         ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["dumb-init", "node", "dist/main"]
```

---

## 7. `.dockerignore` — bản chuẩn

```gitignore
node_modules
dist
coverage
.git
.env
.env.*
!.env.example
*.log
.DS_Store
.vscode
test
**/*.spec.ts
Dockerfile*
docker-compose*.yml
README.md
```

---

## 8. Compose — cú pháp hay dùng

```yaml
services:
  api:
    build:
      context: .
      target: development          # chọn stage
      args:
        NODE_VERSION: 24
    image: ghcr.io/vanson/blog-api:1.0
    command: npm run start:dev     # ghi đè CMD
    ports:
      - "3000:3000"                # host:container
    environment:                   # thắng env_file
      DB_HOST: postgres
    env_file: [.env]
    volumes:
      - .:/app                     # bind mount
      - /app/node_modules          # anonymous volume che lại
      - pgdata:/var/lib/postgresql/data   # named volume
    depends_on:
      postgres:
        condition: service_healthy              # đợi healthy
      migrate:
        condition: service_completed_successfully  # đợi thoát mã 0
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped        # no | always | on-failure | unless-stopped
    init: true                     # PID 1 xử lý tín hiệu
    profiles: ["tools"]            # chỉ chạy khi --profile tools
    deploy:
      resources:
        limits: { memory: 512M, cpus: "1.0" }
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
    develop:
      watch:
        - { action: sync,    path: ./src,          target: /app/src }
        - { action: rebuild, path: package.json }

volumes:
  pgdata:
```

---

## 9. Biến môi trường — thứ tự ưu tiên

Từ cao xuống thấp:

```
1. docker compose run -e KEY=val
2. shell của bạn (export KEY=val)
3. environment: trong compose
4. env_file: trong compose
5. ENV trong Dockerfile
```

Ký tự `$` trong giá trị phải viết `$$` để Compose không thay biến.

---

## 10. Cổng mặc định

| Service | Cổng | Ghi chú |
|---|---|---|
| NestJS | 3000 | |
| Node debugger | 9229 | cần `--debug 0.0.0.0:9229` |
| PostgreSQL | 5432 | |
| Redis | 6379 | |
| Nginx | 80 / 443 | |
| Adminer | 8080 | |

---

## 11. Cấu hình biến cho blog-api

```env
# Chạy NestJS trực tiếp trên máy
DB_HOST=localhost
REDIS_HOST=localhost

# Chạy NestJS trong container (ghi đè ở "environment:" của Compose)
DB_HOST=postgres
REDIS_HOST=redis
```

---

## 12. Chu trình làm việc hằng ngày

```bash
# Sáng
docker compose up -d
docker compose logs -f api

# Cài package mới
docker compose exec api npm i <pkg>
docker compose up -d --build api

# Tạo module mới
docker compose exec api npx nest g resource posts

# Migration
docker compose exec api npm run migration:generate -- src/migrations/AddPosts
docker compose exec api npm run migration:run

# Vào database
docker compose exec postgres psql -U postgres -d blog

# Test
docker compose exec api npm run test

# Tối
docker compose down            # KHÔNG có -v
```

---

## 13. Deploy

```bash
# CI build & push (GitHub Actions)
docker buildx build --platform linux/amd64 --target runner \
  -t ghcr.io/vanson/blog-api:$GIT_SHA --push .

# Trên server
export TAG=$GIT_SHA
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --wait
docker image prune -f

# Rollback
TAG=<sha cũ> docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 14. Lệnh cấp cứu

```bash
docker compose ps -a                       # cái gì chết, exit code bao nhiêu
docker compose logs --tail 200 api         # nó nói gì
docker compose exec api sh                 # vào trong xem
docker compose config                      # Compose hiểu file thế nào
docker inspect <tên> | grep -i oomkilled   # có bị OOM không
docker stats --no-stream                   # ai ăn RAM
lsof -i :3000                              # ai giữ cổng
docker compose down && docker compose up --build   # nút reset
```

---

## 15. Danh sách "không bao giờ làm"

- ❌ `FROM node:latest` — dùng tag ghim phiên bản
- ❌ `ENV JWT_SECRET=...` trong Dockerfile — nằm vĩnh viễn trong layer
- ❌ `COPY . .` trước `npm ci` — phá cache build
- ❌ Chạy container bằng `root` ở production
- ❌ `synchronize: true` với TypeORM ở production
- ❌ Mở `ports` của PostgreSQL ra Internet
- ❌ Bind mount code ở production
- ❌ `docker compose down -v` trên máy production
- ❌ Build image ngay trên server production
- ❌ Bỏ giới hạn log và RAM

---

Quay lại 👉 [README.md](./README.md) · Bộ tài liệu NestJS 👉 [../nestjs/README.md](../nestjs/README.md)
