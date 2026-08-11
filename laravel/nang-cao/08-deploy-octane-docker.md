# Nâng cao 08 — Docker, Octane và deploy

Đưa dự án Blog lên server thật: đóng gói bằng Docker, tăng tốc bằng Octane, và deploy không gián đoạn.

Nếu bạn đã học bộ [docker/](../../docker/README.md), phần Dockerfile ở đây dùng cùng nguyên tắc
multi-stage, chỉ khác là dành cho PHP.

---

## 1. Bốn cách chạy PHP — chọn cái nào

| Cách | Mô hình | Tốc độ tương đối | Độ phức tạp |
|------|---------|------------------|-------------|
| PHP-FPM + Nginx | Nạp lại framework mỗi request | 1× | Trung bình (2 tiến trình) |
| FrankenPHP (worker mode) | Giữ ứng dụng trong bộ nhớ | 3–5× | Thấp (1 binary) |
| Octane + FrankenPHP | Như trên, Laravel quản lý | 3–5× | Thấp |
| Octane + Swoole | Giữ trong bộ nhớ + coroutine | 4–6× | Cao (cần extension) |

Nguồn tăng tốc chính: **không nạp lại framework**. PHP-FPM dựng lại toàn bộ container, provider, route
ở **mỗi** request. Worker mode dựng một lần rồi tái sử dụng.

Khuyến nghị: bắt đầu bằng **PHP-FPM + Nginx**. Chuyển sang Octane khi đã đo và biết bootstrap là nút
thắt — không phải trước đó.

---

## 2. Dockerfile multi-stage

```dockerfile
# syntax=docker/dockerfile:1

########################  Stage 1: dependency PHP  ########################
FROM composer:2.9 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./

# Cài trước, chưa có mã nguồn → tận dụng cache Docker
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist \
        --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev

########################  Stage 2: build frontend  ########################
FROM node:24-alpine AS assets

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.js ./
COPY resources ./resources
RUN npm run build

########################  Stage 3: ảnh chạy  ########################
FROM php:8.5-fpm-alpine AS runner

RUN apk add --no-cache postgresql-dev icu-dev libzip-dev \
 && docker-php-ext-install pdo_pgsql opcache intl zip bcmath \
 && apk del postgresql-dev icu-dev libzip-dev

COPY --from=composer:2.9 /usr/bin/composer /usr/bin/composer
COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/opcache.ini
COPY docker/php/php.ini     /usr/local/etc/php/conf.d/app.ini

WORKDIR /var/www

COPY --chown=www-data:www-data . .
COPY --from=vendor --chown=www-data:www-data /app/vendor ./vendor
COPY --from=assets --chown=www-data:www-data /app/public/build ./public/build

RUN chmod -R 775 storage bootstrap/cache

USER www-data

EXPOSE 9000
CMD ["php-fpm"]
```

Ba điều cố ý trong file trên:

1. **`composer install` trước khi `COPY . .`** — sửa một file PHP không làm mất cache của bước cài
   dependency. Đảo thứ tự là mỗi lần build phải tải lại toàn bộ vendor.
2. **`--no-scripts`** ở stage vendor — script `package:discover` cần mã nguồn và `.env`, chưa có ở
   bước đó.
3. **`USER www-data`** — không chạy bằng root. Container bị chiếm quyền thì kẻ tấn công không có root.

### Cấu hình OPcache

`docker/php/opcache.ini`:

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0      ; production: KHÔNG kiểm tra file đổi
opcache.jit=tracing
opcache.jit_buffer_size=128M
```

`validate_timestamps=0` là nguồn tăng tốc lớn nhất — PHP không `stat()` từng file mỗi request. Đổi lại:
**sửa file trên server không có tác dụng** cho tới khi khởi động lại container. Đó là hành vi đúng cho
production, nhưng nhớ điều này khi hotfix.

`docker/php/php.ini`:

```ini
memory_limit=256M
upload_max_filesize=10M
post_max_size=12M
expose_php=Off
```

### `.dockerignore` — bắt buộc

```
.git
node_modules
vendor
storage/logs/*
storage/framework/cache/*
storage/framework/sessions/*
storage/framework/views/*
.env
*.md
tests
```

Thiếu `.dockerignore`, `vendor/` và `node_modules/` trên máy bạn bị chép vào build context — build
chậm gấp nhiều lần và ảnh chứa file của hệ điều hành khác.

**`.env` phải nằm trong `.dockerignore`.** Đưa `.env` vào ảnh là đóng gói cả mật khẩu database vào
một thứ có thể bị đẩy lên registry.

---

## 3. docker compose cho production

```yaml
services:
  app:
    image: blog-api:${GIT_SHA:-latest}
    restart: unless-stopped
    environment:
      APP_ENV: production
      APP_DEBUG: "false"
      DB_HOST: postgres
      REDIS_HOST: redis
      QUEUE_CONNECTION: redis
      CACHE_STORE: redis
      SESSION_DRIVER: redis
    env_file: [.env.production]
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    volumes:
      - storage:/var/www/storage

  nginx:
    image: nginx:1.31-alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./public:/var/www/public:ro
    depends_on: [app]

  worker:
    image: blog-api:${GIT_SHA:-latest}
    restart: unless-stopped
    command: php artisan queue:work redis --queue=high,default --tries=3 --max-time=3600
    env_file: [.env.production]
    depends_on:
      redis: { condition: service_healthy }
    deploy:
      replicas: 3

  scheduler:
    image: blog-api:${GIT_SHA:-latest}
    restart: unless-stopped
    command: php artisan schedule:work
    env_file: [.env.production]

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: blog
      POSTGRES_USER: blog
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets: [db_password]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U blog"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:8-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
  redisdata:
  storage:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Bốn điểm đáng chú ý:

- **`image: blog-api:${GIT_SHA}`** — deploy theo tag git SHA, không dùng `latest`. `latest` khiến bạn
  không biết đang chạy bản nào và không rollback được.
- **`scheduler` chạy `schedule:work`** — không cần cron trên host. Nhưng nó chỉ được chạy **một
  replica**, nếu không mọi task chạy nhiều lần.
- **`depends_on: condition: service_healthy`** — app chờ Postgres thật sự nhận kết nối, không chỉ chờ
  container "Up".
- **`maxmemory-policy allkeys-lru`** cho Redis dùng làm cache. Nếu Redis đó **cũng** chứa queue thì
  đừng dùng LRU — job sẽ bị xoá. Tách hai instance.

### Nginx

```nginx
server {
    listen 80;
    server_name blog.test;
    root /var/www/public;
    index index.php;

    client_max_body_size 12M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known) { deny all; }

    location /app {
        proxy_pass http://reverb:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

`root` trỏ vào `public/`, **không** vào thư mục gốc dự án. Trỏ sai là `.env` tải được qua trình duyệt.

---

## 4. Octane

```bash
$ composer require laravel/octane
$ php artisan octane:install --server=frankenphp
```

```bash
$ php artisan octane:start --server=frankenphp --host=0.0.0.0 --port=8000 --workers=4
```

Trong Docker, thay `CMD ["php-fpm"]` bằng:

```dockerfile
CMD ["php", "artisan", "octane:start", "--server=frankenphp", "--host=0.0.0.0", "--port=8000"]
```

### ⭐ Rò rỉ trạng thái — vấn đề duy nhất thật sự của Octane

Với PHP-FPM, mọi biến biến mất sau mỗi request. Với Octane, **ứng dụng sống qua nhiều request**. Code
vốn chạy đúng có thể bắt đầu rò rỉ dữ liệu giữa những người dùng khác nhau.

```php
// ❌ singleton giữ user của request ĐẦU TIÊN, dùng lại cho mọi request sau
$this->app->singleton(Reporter::class, fn ($app) => new Reporter($app['request']->user()));

// ✅ dựng lại mỗi request
$this->app->bind(Reporter::class, fn ($app) => new Reporter($app['request']->user()));

// ✅ hoặc scoped — Octane tự huỷ sau mỗi request
$this->app->scoped(Reporter::class, fn ($app) => new Reporter($app['request']->user()));
```

Các nguồn rò rỉ khác:

```php
// ❌ biến static tích luỹ qua các request
class Cart { public static array $items = []; }

// ❌ config sửa lúc chạy — ảnh hưởng cả request sau
config(['app.locale' => $user->locale]);

// ✅ dùng API có phạm vi request
App::setLocale($user->locale);
```

Cách kiểm tra: chạy Octane với `--workers=1` rồi tải trang bằng hai tài khoản khác nhau xen kẽ. Thấy
dữ liệu của người này ở trang người kia là có rò rỉ.

```php
// Dọn trạng thái sau mỗi request nếu bắt buộc phải dùng static
Octane::tick('reset', fn () => Cart::$items = [])->seconds(0);
```

### Deploy với Octane

```bash
$ php artisan octane:reload      # nạp code mới, không rớt kết nối
```

**Bắt buộc** trong bước deploy. Không có nó, Octane chạy code cũ mãi mãi — cùng bản chất với
`queue:restart`.

---

## 5. Quy trình deploy

```bash
#!/usr/bin/env bash
set -euo pipefail

GIT_SHA=$(git rev-parse --short HEAD)

# 1. Build và đẩy ảnh có tag rõ ràng
docker build -t registry.example.com/blog-api:"$GIT_SHA" .
docker push registry.example.com/blog-api:"$GIT_SHA"

# 2. Trên server
export GIT_SHA
docker compose pull

# 3. Migration TRƯỚC khi đổi code — xem mục 6
docker compose run --rm app php artisan migrate --force

# 4. Đổi container
docker compose up -d --no-deps app nginx worker scheduler

# 5. Nạp lại cache và tiến trình nền
docker compose exec -T app php artisan config:cache
docker compose exec -T app php artisan route:cache
docker compose exec -T app php artisan view:cache
docker compose exec -T app php artisan event:cache
docker compose exec -T app php artisan queue:restart
docker compose exec -T app php artisan octane:reload    # nếu dùng Octane

# 6. Kiểm tra
curl -fsS https://blog.test/up || { echo "Healthcheck HỎNG"; exit 1; }
```

### Bốn lệnh hay quên nhất

| Lệnh | Quên thì sao |
|------|--------------|
| `queue:restart` | Worker chạy code cũ vô thời hạn |
| `octane:reload` | Web server chạy code cũ vô thời hạn |
| `npm run build` | `ViteManifestNotFoundException`, trang trắng |
| `storage:link` (lần đầu) | Mọi ảnh upload trả 404 |

`php artisan optimize` gộp `config:cache` + `route:cache` + `view:cache` + `event:cache`. Nhớ:
**chỉ chạy khi deploy**, không chạy trên máy dev.

---

## 6. Migration an toàn khi deploy

Trong khoảng giữa "chạy migration" và "đổi code", **code cũ đang chạy trên schema mới**. Migration
phá vỡ tương thích ngược sẽ gây lỗi 500 trong cửa sổ đó.

```php
// ❌ code cũ vẫn SELECT cột này
Schema::table('posts', function (Blueprint $table) {
    $table->dropColumn('old_column');
});
```

Cách đúng — **expand/contract**, tách làm hai lần deploy:

```
Deploy 1 (expand):  thêm cột mới, ghi vào CẢ HAI cột, đọc từ cột cũ
Deploy 2:           đọc từ cột mới
Deploy 3 (contract): xoá cột cũ
```

Áp dụng cho: đổi tên cột, xoá cột, đổi kiểu cột, thêm `NOT NULL` không có `default`.

### Migration khoá bảng

```php
// ⚠️ trên PostgreSQL, thêm cột NOT NULL có default sẽ viết lại toàn bảng (bản < 11)
$table->string('status')->default('draft');

// ✅ an toàn: thêm nullable trước, backfill theo lô, rồi mới NOT NULL
```

Backfill bằng `chunkById`, không phải `update()` một phát trên triệu dòng — xem
[bài 01](./01-toi-uu-eloquent.md).

### Bảo vệ khỏi tai nạn

```bash
$ php artisan migrate --force        # bắt buộc trên production (bỏ qua câu hỏi xác nhận)
$ php artisan migrate --pretend      # in SQL, không chạy — chạy cái này TRƯỚC
```

`migrate:fresh` trên production là xoá sạch dữ liệu. Laravel có hỏi xác nhận, nhưng đừng dựa vào đó.

---

## 7. Healthcheck

`bootstrap/app.php` đã có sẵn:

```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    health: '/up',
)
```

```bash
$ curl -sf http://127.0.0.1:8000/up && echo OK
OK
```

Healthcheck sâu hơn — kiểm tra cả database và Redis:

```php
Route::get('/health', function () {
    $checks = [];

    try { DB::select('select 1'); $checks['database'] = 'ok'; }
    catch (Throwable $e) { $checks['database'] = 'fail'; }

    try { Cache::store('redis')->put('health', 1, 5); $checks['redis'] = 'ok'; }
    catch (Throwable $e) { $checks['redis'] = 'fail'; }

    $ok = ! in_array('fail', $checks, true);

    return response()->json($checks, $ok ? 200 : 503);
});
```

```yaml
healthcheck:
  test: ["CMD", "curl", "-fsS", "http://localhost:8000/up"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 40s
```

`start_period` quan trọng: không có nó, container bị đánh dấu unhealthy trong lúc còn đang khởi động.

---

## 8. Chế độ bảo trì

```bash
$ php artisan down --refresh=15 --retry=60 --secret="chuoi-bi-mat-dai"
$ php artisan up
```

`--secret` cho phép bạn vẫn vào được để kiểm tra:

```
https://blog.test/chuoi-bi-mat-dai
```

Với `php artisan optimize` + deploy nhanh, phần lớn trường hợp không cần `down` chút nào.

---

## 9. Log trong container

Đừng ghi log ra file trong container — container bị xoá là mất log.

```ini
LOG_CHANNEL=stderr
LOG_LEVEL=warning
```

```bash
$ docker compose logs -f app
```

`LOG_LEVEL=debug` trên production sinh hàng GB log mỗi ngày và làm chậm ứng dụng. Dùng `warning` hoặc
`error`, chỉ hạ xuống `debug` khi đang điều tra sự cố.

Chi tiết về log có cấu trúc ở [bài 09](./09-do-luong-va-benchmark.md).

---

## 10. Danh sách kiểm tra deploy

### Ảnh Docker

- [ ] Multi-stage, ảnh cuối không chứa Composer/Node
- [ ] `USER www-data`, không chạy root
- [ ] `.dockerignore` có `.env`, `vendor`, `node_modules`, `.git`
- [ ] Tag bằng git SHA, không dùng `latest`
- [ ] OPcache bật, `validate_timestamps=0`

### Cấu hình

- [ ] `APP_DEBUG=false`, `APP_ENV=production`
- [ ] `APP_KEY` được sao lưu riêng
- [ ] `LOG_CHANNEL=stderr`, `LOG_LEVEL=warning`
- [ ] Bí mật qua Docker secrets hoặc secret manager, không nằm trong ảnh

### Quy trình

- [ ] `migrate --pretend` chạy trước để xem SQL
- [ ] `migrate --force` chạy trước khi đổi code
- [ ] Migration tương thích ngược (expand/contract)
- [ ] `optimize` sau khi đổi code
- [ ] `queue:restart` (và `octane:reload` nếu có)
- [ ] Healthcheck xác nhận sau deploy
- [ ] Biết cách rollback: `GIT_SHA=<sha-cũ> docker compose up -d`

### Vận hành

- [ ] `scheduler` chỉ **một** replica
- [ ] Worker có `--max-time` và supervisor/restart policy
- [ ] Volume cho `storage/` và dữ liệu Postgres
- [ ] Sao lưu database tự động và **đã thử khôi phục ít nhất một lần**

Gạch cuối là quan trọng nhất. Bản sao lưu chưa từng được khôi phục thử không phải bản sao lưu.

---

## Bài tập

1. Viết Dockerfile multi-stage cho dự án Blog. Build hai lần liên tiếp, lần hai chỉ sửa một file trong
   `app/`. So sánh thời gian và chỉ ra bước nào dùng cache.

2. Đảo thứ tự: đặt `COPY . .` **trước** `composer install`. Build lại sau khi sửa một file PHP và so
   thời gian với bài 1.

3. Xoá `.dockerignore` rồi build. So sánh kích thước build context (`docker build` in ra ở dòng đầu).

4. Chạy `docker compose up`, rồi `docker compose exec app whoami`. Nếu ra `root`, sửa Dockerfile.

5. Đặt `opcache.validate_timestamps=0`, sửa một file PHP **bên trong** container đang chạy, tải lại
   trang. Có đổi không? Giải thích.

6. Cài Octane với `--workers=1`. Đăng ký một singleton phụ thuộc `$request->user()`. Đăng nhập bằng
   hai tài khoản ở hai trình duyệt và tải trang xen kẽ. Mô tả hiện tượng, rồi sửa bằng `scoped()`.

7. Viết migration `dropColumn('views')`. Chạy nó trong khi code cũ vẫn đang chạy (dùng hai container).
   Ghi lại lỗi. Viết lại theo expand/contract.

8. Viết route `/health` kiểm tra cả Postgres và Redis. Tắt Redis (`docker compose stop redis`) và kiểm
   tra mã trạng thái.

9. Viết script deploy đầy đủ. Cố tình bỏ `queue:restart`, deploy một thay đổi trong job, và ghi lại
   hiện tượng.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Với `COPY . .` trước `composer install`, mọi thay đổi mã nguồn đều làm mất cache của bước cài
dependency → build phải tải lại toàn bộ vendor. Thứ tự đúng giữ được cache và build nhanh hơn nhiều
lần.

**5.** **Không đổi.** `validate_timestamps=0` bảo OPcache đừng kiểm tra file có mới hơn bản đã biên
dịch không. Phải khởi động lại container (hoặc `opcache_reset()`). Đây là đánh đổi có chủ ý: nhanh hơn
nhưng không hotfix bằng cách sửa file được.

**6.** Người dùng thứ hai thấy tên/dữ liệu của người dùng thứ nhất. Singleton được dựng một lần với
`$request` của request đầu tiên và tồn tại suốt vòng đời worker. `scoped()` khiến Octane huỷ nó sau
mỗi request.

**9.** Job vẫn chạy logic cũ vô thời hạn. `queue:work` nạp framework một lần rồi giữ trong bộ nhớ, nên
nó không bao giờ thấy code mới cho tới khi tiến trình khởi động lại.

</details>

---

Tiếp theo: [09-do-luong-va-benchmark.md](./09-do-luong-va-benchmark.md)
