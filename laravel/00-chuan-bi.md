# Bài 00 — Chuẩn bị: cài đặt, tạo project, đọc cây thư mục

Mục tiêu: có một project Laravel 13 chạy được, nối vào PostgreSQL, và **hiểu từng thư mục sinh ra để
làm gì** — chứ không phải nhìn 20 thư mục lạ rồi đoán.

---

## 1. Kiểm tra máy trước khi cài

Laravel 13 yêu cầu **PHP >= 8.3**. Con số này không phải khuyến nghị, nó nằm cứng trong `composer.json`
của skeleton:

```json
"require": {
    "php": "^8.3",
    "laravel/framework": "^13.17",
    "laravel/tinker": "^3.0"
}
```

Kiểm tra:

```bash
$ php -v
PHP 8.5.5 (cli) (built: Apr  7 2026 16:24:10) (NTS)
Copyright (c) The PHP Group
Built by Homebrew

$ composer -V
Composer version 2.9.7 2026-04-14 13:31:52
PHP version 8.5.5 (/opt/homebrew/Cellar/php/8.5.5/bin/php)
```

Nếu PHP thấp hơn 8.3, Composer chặn ngay lúc tạo project với thông báo dạng:

```
Your requirements could not be resolved to an installable set of packages.
  Problem 1
    - laravel/framework[v13.0.0, ..., v13.26.0] require php ^8.3 -> your php version (8.2.x) does not satisfy that requirement.
```

Cài PHP mới trên macOS:

```bash
$ brew install php composer
$ brew list --versions php composer
php 8.5.5
composer 2.9.7
```

### Extension PHP cần có

Laravel cần vài extension. Kiểm tra bằng `php -m` rồi lọc ra đúng cái mình quan tâm:

```bash
$ php -m | grep -E 'pdo_pgsql|pdo_mysql|pdo_sqlite|mbstring|intl'
intl
mbstring
pdo_mysql
pdo_pgsql
pdo_sqlite
```

Bản PHP của Homebrew đã bật sẵn hết. Nếu thiếu `pdo_pgsql`, bạn sẽ **không thấy lỗi lúc cài** mà chỉ
thấy lúc chạy migration đầu tiên:

```
Illuminate\Database\QueryException
could not find driver (Connection: pgsql, SQL: select * from information_schema.tables ...)
```

---

## 2. Tạo project

Có hai cách. Dùng cách nào cũng ra kết quả giống nhau.

```bash
# Cách 1 — không cần cài gì thêm (dùng trong tài liệu này)
$ composer create-project laravel/laravel blog

# Cách 2 — cần cài installer trước, đổi lại được hỏi chọn starter kit
$ composer global require laravel/installer
$ laravel new blog
```

Đoạn cuối output của cách 1 — chú ý Laravel làm sẵn 3 việc cho bạn:

```
> @php artisan key:generate --ansi

 INFO Application key set successfully.                    ← 1. sinh APP_KEY vào .env

> @php -r "file_exists('database/database.sqlite') || touch('database/database.sqlite');"
                                                          ← 2. tạo file SQLite rỗng
> @php artisan migrate --graceful --ansi

 INFO Preparing database.

 Creating migration table .. 2.29ms DONE

 INFO Running migrations.                                 ← 3. chạy luôn migration

 0001_01_01_000000_create_users_table .. 2.45ms DONE
 0001_01_01_000001_create_cache_table .. 1.51ms DONE
 0001_01_01_000002_create_jobs_table .. 7.95ms DONE
```

Nghĩa là project **đã chạy được ngay** với SQLite, chưa cần cài database gì cả. Mục 5 sẽ đổi sang
PostgreSQL.

Kiểm tra:

```bash
$ cd blog
$ php artisan --version
Laravel Framework 13.26.0
```

---

## 3. Cây thư mục Laravel 13 — và cái đã biến mất

Đây là **toàn bộ** file sinh ra (đã bỏ `vendor/`):

```
blog/
├── app/
│   ├── Http/Controllers/Controller.php   ← lớp cha rỗng cho mọi controller
│   ├── Models/User.php                   ← model duy nhất có sẵn
│   └── Providers/AppServiceProvider.php  ← nơi khai báo dịch vụ toàn cục
├── bootstrap/
│   ├── app.php                           ← ⭐ trung tâm cấu hình ứng dụng
│   ├── providers.php                     ← danh sách service provider
│   └── cache/                            ← file cache do artisan sinh, không sửa tay
├── config/                               ← 11 file cấu hình
├── database/
│   ├── factories/UserFactory.php
│   ├── migrations/                       ← 3 migration có sẵn
│   ├── seeders/DatabaseSeeder.php
│   └── database.sqlite
├── public/index.php                      ← điểm vào duy nhất của mọi request HTTP
├── resources/
│   ├── css/app.css
│   ├── js/app.js
│   └── views/welcome.blade.php
├── routes/
│   ├── web.php                           ← route có session + cookie + CSRF
│   └── console.php                       ← lệnh artisan tự viết + lịch chạy
├── storage/                              ← log, cache, file upload, view đã biên dịch
├── tests/
├── .env                                  ← cấu hình theo máy, KHÔNG commit
├── artisan                               ← file thực thi CLI
├── composer.json
├── phpunit.xml
└── vite.config.js
```

### Ba thứ quen thuộc đã **không còn** trong Laravel 13

Nếu bạn tìm chúng mà không thấy thì không phải do cài lỗi:

| File cũ | Bản 13 thay bằng | Ghi chú |
|---------|------------------|---------|
| `app/Http/Kernel.php` | `bootstrap/app.php`, trong `->withMiddleware(...)` | Toàn bộ middleware khai ở đây |
| `app/Console/Kernel.php` | `routes/console.php` | Cả lệnh tự viết lẫn `Schedule::` |
| `app/Exceptions/Handler.php` | `bootstrap/app.php`, trong `->withExceptions(...)` | |
| `routes/api.php` | *không sinh sẵn* | Chạy `php artisan install:api` khi cần — xem mục 7 |
| `app/Http/Middleware/*` | *không sinh sẵn* | Middleware mặc định nằm trong framework |
| `config/cors.php` | *không sinh sẵn* | `php artisan config:publish cors` nếu cần sửa |

### `bootstrap/app.php` — file bạn sẽ mở nhiều nhất

```php
<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',                    // ← route kiểm tra sống/chết, có sẵn
    )
    ->withMiddleware(function (Middleware $middleware): void {
        //                                ← thêm/bớt/đổi thứ tự middleware ở đây
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
```

Dòng `health: '/up'` tạo sẵn một endpoint. Tự kiểm chứng:

```bash
$ php artisan route:list | grep up
 GET|HEAD  up  vendor/laravel/framework/src/Illuminate/Foundation/Configuration/...
```

Endpoint này dùng cho healthcheck của Docker/Kubernetes — bạn sẽ cần nó ở bài
[nang-cao/08-deploy.md](./nang-cao/08-deploy-octane-docker.md).

Dòng `shouldRenderJsonWhen` là **mới trong bản 13** và có sẵn: mọi lỗi ở URL bắt đầu bằng `api/` sẽ
trả JSON thay vì trang HTML. Ở bản 11 bạn phải tự viết đoạn này.

---

## 4. `php artisan dev` — chạy cả môi trường bằng một lệnh

Bản 13 thêm lệnh `dev`. Nó khởi động **4 tiến trình cùng lúc** trong một giao diện TUI:

```bash
$ php artisan dev:list

 server  php artisan serve                        Illuminate\Foundation\Providers\ArtisanServicePro…
 queue   php artisan queue:listen --tries=1 --timeout=0   Illuminate\Foundation\Providers\Artisan…
 logs    php artisan pail --timeout=0             Illuminate\Foundation\Providers\ArtisanServicePro…
 vite    npm run dev                              Illuminate\Foundation\Providers\ArtisanServicePro…

 Showing [4] dev commands
```

Chạy:

```bash
$ composer dev          # tương đương: php artisan dev
```

Ý nghĩa từng tiến trình:

| Tên | Lệnh | Để làm gì |
|-----|------|-----------|
| `server` | `artisan serve` | Web server ở `http://127.0.0.1:8000` |
| `queue` | `artisan queue:listen` | Chạy job trong hàng đợi — bài 07 |
| `logs` | `artisan pail` | Xem log chảy theo thời gian thực, đẹp hơn `tail -f storage/logs/laravel.log` |
| `vite` | `npm run dev` | Build CSS/JS và hot-reload trình duyệt |

Vài cờ hay dùng:

```bash
$ php artisan dev --tabs        # mỗi tiến trình một tab thay vì chia màn hình
$ php artisan dev --inline      # in thẳng ra stdout, không vẽ TUI (dùng khi chạy trong CI)
$ php artisan dev --timestamps  # gắn mốc thời gian vào từng dòng log
```

Nếu chỉ cần web server, vẫn dùng được như cũ:

```bash
$ php artisan serve --port=8000
```

---

## 5. Nối PostgreSQL

Mặc định project chạy SQLite. Đổi sang PostgreSQL 18 chạy trong Docker.

### 5.1 Dựng database

```bash
$ docker run -d --name blog-pg \
    -e POSTGRES_USER=blog \
    -e POSTGRES_PASSWORD=secret \
    -e POSTGRES_DB=blog \
    -p 55433:5432 \
    postgres:18-alpine
```

Chờ vài giây rồi kiểm tra nó đã sẵn sàng — **đừng bỏ qua bước này**, container "Up" không có nghĩa là
Postgres đã nhận kết nối:

```bash
$ docker exec blog-pg pg_isready -U blog
/var/run/postgresql:5432 - accepting connections

$ docker exec blog-pg psql -U blog -d blog -c 'select version();'
                                            version
-----------------------------------------------------------------------------------------------
 PostgreSQL 18.6 on aarch64-unknown-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit
(1 row)
```

> Dùng cổng `55433` thay vì `5432` để không đụng Postgres nào đang chạy sẵn trên máy. Nếu bạn đã có
> container Postgres khác (ví dụ từ dự án NestJS), cứ để nó yên và dựng cái mới ở cổng khác — rẻ hơn
> nhiều so với việc gỡ rối xem mình đang nối vào database nào.

### 5.2 Sửa `.env`

Mặc định file `.env` có phần database bị comment gần hết:

```ini
DB_CONNECTION=sqlite
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=laravel
# DB_USERNAME=root
# DB_PASSWORD=
```

Sửa thành:

```ini
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=55433
DB_DATABASE=blog
DB_USERNAME=blog
DB_PASSWORD=secret
```

Cổng mặc định trong comment là `3306` (của MySQL). Để nguyên số đó mà đổi `DB_CONNECTION=pgsql` là ăn
lỗi ngay:

```
SQLSTATE[08006] [7] connection to server at "127.0.0.1", port 3306 failed:
server closed the connection unexpectedly
```

### 5.3 Chạy lại migration

```bash
$ php artisan migrate:fresh

 INFO Preparing database.

 Creating migration table .. 7.64ms DONE

 INFO Running migrations.

 0001_01_01_000000_create_users_table .. 15.59ms DONE
 0001_01_01_000001_create_cache_table .. 8.14ms DONE
 0001_01_01_000002_create_jobs_table .. 15.22ms DONE
```

Xác nhận Laravel thật sự đang nói chuyện với Postgres chứ không phải SQLite:

```bash
$ php artisan about | grep -A 8 Drivers
 Drivers ..
 Broadcasting .. log
 Cache .. database
 Database .. pgsql          ← đúng rồi
 Logs .. stack / single
 Mail .. log
 Queue .. database
 Session .. database
```

Và mở thẳng CLI của database khi cần soi dữ liệu:

```bash
$ php artisan db
psql (18.6)
blog=#
```

---

## 6. `.env` và `config/` — quan hệ giữa hai thứ này

Đây là chỗ hay hiểu sai nhất khi mới bắt đầu.

- `.env` chứa giá trị **thay đổi theo máy** (mật khẩu DB, khoá API). Không commit vào git.
- `config/*.php` chứa **cấu trúc cấu hình**. Commit vào git.
- Code ứng dụng **chỉ được đọc `config()`**, không bao giờ đọc `env()` trực tiếp.

Xem cách chúng nối với nhau:

```php
// config/database.php
'pgsql' => [
    'driver'   => 'pgsql',
    'host'     => env('DB_HOST', '127.0.0.1'),   // ← đọc .env, có giá trị mặc định
    'port'     => env('DB_PORT', '5432'),
    'database' => env('DB_DATABASE', 'laravel'),
    ...
],
```

```bash
$ php artisan config:show database.connections.pgsql

 database.connections.pgsql ..
 driver .. pgsql
 url .. null
 host .. 127.0.0.1
 port .. 55433
 database .. blog
 username .. blog
 password .. secret
 charset .. utf8
 prefix ..
 prefix_indexes .. true
 search_path .. public
 sslmode .. prefer
```

Lệnh này in cả mật khẩu ra màn hình, nên đừng dán output của nó vào issue hay chat công khai.

### Vì sao không được gọi `env()` trong code

Vì lệnh tối ưu production sẽ làm `env()` trả về `null`:

```bash
$ php artisan config:cache
 INFO Configuration cached successfully.
```

Sau lệnh này Laravel **không đọc file `.env` nữa**, nó đọc file cache đã biên dịch. Mọi lời gọi
`env()` nằm ngoài `config/` sẽ trả `null`, và ứng dụng hỏng theo kiểu rất khó tìm:

```php
// ❌ trong controller — hỏng ngay sau khi config:cache
$key = env('STRIPE_KEY');       // null

// ✅ khai vào config/services.php rồi đọc qua config()
$key = config('services.stripe.key');
```

Gỡ cache khi đang phát triển:

```bash
$ php artisan config:clear
 INFO Configuration cache cleared successfully.
```

Muốn xoá sạch mọi loại cache một lần:

```bash
$ php artisan optimize:clear
```

---

## 7. Bật routes/api.php khi cần

Laravel 13 **không sinh sẵn** `routes/api.php`. Dự án Blog trong tài liệu này chủ yếu dùng Blade và
Livewire nên bạn chưa cần ngay, nhưng cứ biết cách bật:

```bash
$ php artisan install:api
```

Nó hỏi có chạy migration của Sanctum không (cứ chọn `yes`), rồi in:

```
 INFO Published API routes file.

 INFO API scaffolding installed. Please add the [Laravel\Sanctum\HasApiTokens] trait to your User model.
```

Ba thứ thay đổi:

1. Sinh `routes/api.php`:

```php
Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
```

2. Thêm dòng `api:` vào `bootstrap/app.php`:

```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',        // ← dòng mới
    commands: __DIR__.'/../routes/console.php',
    health: '/up',
)
```

3. Cài `laravel/sanctum` + migration bảng `personal_access_tokens`.

Nhớ làm nốt việc nó dặn — thêm trait vào `app/Models/User.php`:

```php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
}
```

Quên bước này thì `$user->createToken(...)` báo:

```
BadMethodCallException  Call to undefined method App\Models\User::createToken()
```

Kiểm tra route đã sống:

```bash
$ curl -s http://127.0.0.1:8000/api/user -H 'Accept: application/json'
{"message":"Unauthenticated."}
```

Trả `401` với JSON là đúng — nhờ `shouldRenderJsonWhen` ở `bootstrap/app.php`.

---

## 8. Frontend: Vite 8 + Tailwind 4

`package.json` mặc định:

```json
{
    "type": "module",
    "scripts": {
        "build": "vite build",
        "dev": "vite"
    },
    "devDependencies": {
        "@tailwindcss/vite": "^4.0.0",
        "concurrently": "^10.0.3",
        "laravel-vite-plugin": "^3.1",
        "tailwindcss": "^4.0.0",
        "vite": "^8.0.0"
    }
}
```

Tailwind 4 **không còn file `tailwind.config.js`**. Cấu hình nằm ngay trong CSS:

```css
/* resources/css/app.css */
@import 'tailwindcss';
```

Cài và chạy:

```bash
$ npm install
$ npm run dev
```

Chi tiết cách nhúng vào Blade ở [bài 02](./02-blade-va-giao-dien.md).

---

## 9. Cấu hình editor

Laravel sinh sẵn `.editorconfig`. Thêm hai thứ nữa để đỡ khổ:

```bash
# Định dạng code theo chuẩn Laravel (Pint có sẵn trong require-dev)
$ ./vendor/bin/pint

  ................✓.............................

  ──────────────────────────────────────────────────────────────── Laravel
    FIXED   .................................... 46 files, 1 style issue fixed
  ✓ app/Xyz.php  class_definition, blank_line_after_opening_tag, no_singleline…
```

Khi mọi file đã đúng định dạng thì nó im lặng hơn:

```bash
$ ./vendor/bin/pint

  .............................................

  ──────────────────────────────────────────────────────────────── Laravel
    PASS   .......................................................... 45 files
```

Chạy `pint --test` trong CI để chặn code sai định dạng mà không sửa file:

```bash
$ ./vendor/bin/pint --test
```

---

## 10. Bảng lệnh artisan cần thuộc từ hôm nay

```bash
php artisan list                 # xem toàn bộ lệnh (có ~120 lệnh)
php artisan about                # phiên bản, driver đang dùng, cache đang bật
php artisan route:list           # mọi route đang có
php artisan route:list --path=posts   # lọc theo đường dẫn
php artisan tinker               # REPL, gõ thẳng code Laravel
php artisan db                   # mở CLI của database đang cấu hình
php artisan optimize:clear       # xoá mọi cache khi thấy "sao sửa mà không đổi"
```

`tinker` là công cụ bạn sẽ dùng nhiều nhất ở bài 03. Nó chạy được cả kiểu một dòng:

```bash
$ php artisan tinker --execute='echo App\Models\User::count();'
0
```

---

## Bài tập

1. Tạo project `blog`, nối vào PostgreSQL chạy bằng Docker ở cổng `55433`, chạy `migrate:fresh` thành
   công. Dán output của `php artisan about | grep -A 8 Drivers` để chứng minh nó đang dùng `pgsql`.

2. Cố tình đặt `DB_PORT=5432` (sai cổng) rồi chạy `php artisan migrate`. Ghi lại nguyên văn thông báo
   lỗi. Sau đó sửa lại cho đúng.

3. Mở `bootstrap/app.php`, đổi `health: '/up'` thành `health: '/api/health'`. Chạy `php artisan route:list`
   và `curl` vào đường dẫn mới để xác nhận.

4. Chạy `php artisan config:cache`, rồi sửa `APP_NAME` trong `.env` thành tên khác, rồi chạy
   `php artisan about | head -3`. Giải thích vì sao tên **không đổi**. Sửa bằng lệnh nào?

5. Chạy `php artisan dev`, mở `http://127.0.0.1:8000`, rồi cố tình gõ sai cú pháp trong `routes/web.php`.
   Quan sát khung `logs` (Pail) hiện gì.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Postgres ở cổng 5432 không có ai lắng nghe (container map ra 55433), nên:
```
SQLSTATE[08006] [7] connection to server at "127.0.0.1", port 5432 failed:
Connection refused
	Is the server running on that host and accepting TCP/IP connections?
```

**3.** Sau khi sửa:
```bash
$ php artisan route:list | grep health
 GET|HEAD  api/health  ...
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/api/health
200
```

**4.** `config:cache` biên dịch toàn bộ `config/` thành một file PHP ở `bootstrap/cache/config.php`.
Từ lúc đó Laravel **không đọc `.env` nữa**. Sửa bằng:
```bash
$ php artisan config:clear
```
Đây chính là lý do quy tắc "không gọi `env()` ngoài `config/`" tồn tại. Trên production thì ngược lại:
luôn chạy `config:cache` lúc deploy để tiết kiệm việc đọc/parse 11 file config mỗi request.

**5.** Pail in ra lỗi ngay trong khung `logs`, kèm file và số dòng — không phải mở trình duyệt hay
`tail` file log.

</details>

---

Tiếp theo: [01-routing-va-controller.md](./01-routing-va-controller.md) — request đi từ `public/index.php`
đến controller như thế nào.
