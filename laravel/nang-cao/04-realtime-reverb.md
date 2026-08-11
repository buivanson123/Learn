# Nâng cao 04 — Realtime với Reverb

Livewire cập nhật giao diện khi **người dùng đó** tương tác. Broadcasting cập nhật giao diện khi
**người khác** làm gì đó — bình luận mới, thông báo, số liệu bảng điều khiển.

Reverb là WebSocket server chính chủ của Laravel, chạy bằng PHP, không cần dịch vụ ngoài.

---

## 1. Cài đặt — và cái bẫy ngay bước đầu

```bash
$ php artisan install:broadcasting --reverb
```

Trên một project Laravel 13.26 mới tinh, lệnh này **thất bại**:

```
 INFO Published 'broadcasting' configuration file.
 INFO Published 'channels' route file.

./composer.json has been updated
Running composer update laravel/reverb
Your requirements could not be resolved to an installable set of packages.
 Problem 1
 - Root composer.json requires laravel/reverb ^1.0 -> satisfiable by laravel/reverb[v1.7.0, .., v1.11.1].
 - laravel/reverb[v1.7.0, .., v1.11.1] require guzzlehttp/psr7 ^2.6 -> found guzzlehttp/psr7[2.6.0, .., 2.13.0]
   but the package is fixed to 3.0.0 (lock file version) by a partial update.

Use the option --with-all-dependencies (-W) to allow upgrades, downgrades and removals.

Installation failed, reverting ./composer.json and ./composer.lock to their original content.

 INFO Reverb installed successfully.        ← ⚠️ NÓI DỐI
```

Đọc kỹ: composer đã **revert**, package **không** được cài, nhưng dòng cuối vẫn báo thành công.

Nguyên nhân: skeleton Laravel 13 khoá `guzzlehttp/psr7` ở bản `3.0.0`, còn Reverb 1.x vẫn yêu cầu
`^2.6`. Composer không tự hạ cấp trong một partial update.

**Cách sửa:**

```bash
$ composer require laravel/reverb -W
```

```bash
$ composer show laravel/reverb
name     : laravel/reverb
versions : * v1.11.1
```

### Lỗi tiếp theo, do lỗi đầu tiên gây ra

Lệnh `install:broadcasting` đã kịp đặt `BROADCAST_CONNECTION=reverb` vào `.env` **trước khi** thất bại,
nhưng chưa kịp ghi các biến `REVERB_*`. Kết quả là mọi lệnh artisan đều nổ:

```
RuntimeException
Failed to create broadcaster for connection "reverb" with error:
Pusher\Pusher::__construct(): Argument #1 ($auth_key) must be of type string, null given
```

Ngay cả `composer install` cũng hỏng, vì nó chạy `php artisan package:discover`.

**Sửa** — thêm tay vào `.env`:

```ini
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=123456
REVERB_APP_KEY=blogkey
REVERB_APP_SECRET=blogsecret
REVERB_HOST="localhost"
REVERB_PORT=8085
REVERB_SCHEME=http

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"
```

```bash
$ php artisan config:clear
$ php artisan package:discover

 INFO Discovering packages.

 laravel/reverb .. DONE
 livewire/livewire .. DONE
 ...
```

Trên production, `REVERB_APP_KEY`/`SECRET` phải là chuỗi ngẫu nhiên dài, không phải `blogkey`.

---

## 2. ⭐ Hai cặp biến cổng khác nhau

Đây là chỗ gây rối nhiều nhất. Reverb đọc **hai** nhóm biến cho hai mục đích khác nhau:

| Biến | Ai dùng | Mặc định | Nghĩa |
|------|---------|----------|-------|
| `REVERB_SERVER_HOST` | Reverb server | `0.0.0.0` | Địa chỉ server **lắng nghe** |
| `REVERB_SERVER_PORT` | Reverb server | `8080` | Cổng server **lắng nghe** |
| `REVERB_HOST` | Laravel + trình duyệt | — | Địa chỉ client **kết nối tới** |
| `REVERB_PORT` | Laravel + trình duyệt | `8080` | Cổng client **kết nối tới** |

Đọc từ chính `vendor/laravel/reverb/config/reverb.php`:

```php
'host'     => env('REVERB_SERVER_HOST', '0.0.0.0'),
'port'     => env('REVERB_SERVER_PORT', 8080),
'hostname' => env('REVERB_HOST'),
```

Kiểm chứng chúng thật sự khác nhau:

```bash
$ php artisan config:show reverb.servers.reverb
 host .. 0.0.0.0
 port .. 8080                 ← server lắng nghe

$ php artisan config:show broadcasting.connections.reverb
 options ⇁ host .. localhost
 options ⇁ port .. 8085       ← client kết nối tới
```

Ở môi trường dev hai cổng này phải **giống nhau**. Đặt lệch là sự kiện gửi đi vào hư không mà không có
lỗi nào.

Ở production chúng **cố ý khác nhau**: Reverb nghe ở `0.0.0.0:8080` phía sau Nginx, còn trình duyệt nối
tới `wss://blog.test:443`.

---

## 3. Chạy server

```bash
$ php artisan reverb:start --port=8085

 INFO Starting server on 0.0.0.0:8085 (localhost).
```

Cổng bận thì lỗi rất rõ:

```
RuntimeException
Failed to listen on "tcp://0.0.0.0:8080": Address already in use (EADDRINUSE)
```

Kiểm tra server thật sự nói được giao thức WebSocket:

```bash
$ curl -s -o /dev/null -w '%{http_code}\n' \
    -H "Connection: Upgrade" -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    "http://127.0.0.1:8085/app/blogkey" --max-time 3
101
```

**101 Switching Protocols** = server đã chấp nhận nâng cấp lên WebSocket. Nhận **404** nghĩa là
`REVERB_APP_KEY` trong URL không khớp với cấu hình.

Các cờ khác:

```bash
php artisan reverb:start --debug         # in mọi thông điệp qua lại
php artisan reverb:start --host=0.0.0.0 --port=8080
php artisan reverb:restart               # bảo server thoát để supervisor khởi động lại
```

---

## 4. Event broadcast

```php
namespace App\Events;

use App\Models\Comment;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CommentAdded implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Comment $comment) {}

    public function broadcastOn(): array
    {
        return [new Channel('posts.'.$this->comment->post_id)];
    }

    public function broadcastAs(): string
    {
        return 'comment.added';
    }

    public function broadcastWith(): array
    {
        return [
            'id'     => $this->comment->id,
            'body'   => $this->comment->body,
            'author' => $this->comment->author->name,
        ];
    }
}
```

Bốn method, mỗi cái giải quyết một việc:

| Method | Không có nó thì sao |
|--------|--------------------|
| `broadcastOn()` | Bắt buộc — không có thì không biết gửi đi đâu |
| `broadcastAs()` | Tên sự kiện thành `App\Events\CommentAdded` — client phải viết cả namespace |
| `broadcastWith()` | **Gửi toàn bộ thuộc tính public của event** — dễ rò rỉ dữ liệu |
| `broadcastQueue()` | Dùng hàng đợi mặc định |

> ⚠️ `broadcastWith()` là biện pháp bảo mật, không phải tối ưu. Không có nó, Laravel serialize cả model
> `Comment` — kể cả cột bạn không muốn công khai. Luôn khai rõ.

Bắn:

```php
broadcast(new CommentAdded($comment));
broadcast(new CommentAdded($comment))->toOthers();     // trừ chính người vừa gửi
event(new CommentAdded($comment));
```

Kiểm chứng:

```bash
$ php artisan tinker --execute='
    $c = App\Models\Comment::first();
    broadcast(new App\Events\CommentAdded($c));
    echo "da broadcast";
'
da broadcast
```

Không có exception = Laravel đã đẩy được sự kiện tới Reverb qua HTTP API.

### `ShouldBroadcast` vs `ShouldBroadcastNow`

- `ShouldBroadcast` — đi **qua hàng đợi**. Cần worker đang chạy. Nếu không, sự kiện nằm im trong bảng
  `jobs` và bạn tưởng broadcasting hỏng.
- `ShouldBroadcastNow` — gửi ngay trong request. Dùng khi độ trễ quan trọng hơn thông lượng.

Triệu chứng kinh điển: "broadcast không chạy" trong khi thực ra chỉ là quên `php artisan queue:work`.

---

## 5. Ba loại kênh

| Loại | Class | Ai nghe được | Dùng cho |
|------|-------|-------------|----------|
| Công khai | `Channel` | Bất kỳ ai | Số lượt xem, bình luận trên bài công khai |
| Riêng tư | `PrivateChannel` | Người qua được `routes/channels.php` | Thông báo cá nhân |
| Hiện diện | `PresenceChannel` | Như trên, + biết ai đang online | Chat, "đang gõ..." |

`routes/channels.php` sinh sẵn:

```php
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
```

Thêm kênh của bạn:

```php
// Chỉ tác giả bài viết nghe được
Broadcast::channel('posts.{postId}.admin', function (User $user, int $postId) {
    return Post::where('id', $postId)->where('user_id', $user->id)->exists();
});

// Presence — trả về MẢNG (không phải bool) để client biết ai đang có mặt
Broadcast::channel('posts.{postId}.presence', function (User $user, int $postId) {
    return ['id' => $user->id, 'name' => $user->name];
});
```

> Callback trả `false` hoặc `null` → client bị từ chối. Trả **mảng** ở presence channel là bắt buộc;
> trả `true` thì client kết nối được nhưng danh sách người online rỗng.

Đây là ranh giới bảo mật thật sự. `PrivateChannel` mà callback luôn `return true` thì chẳng riêng tư gì.

---

## 6. Phía trình duyệt

```bash
$ npm install --save-dev laravel-echo pusher-js
```

```js
// resources/js/echo.js
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: import.meta.env.VITE_REVERB_PORT ?? 80,
    wssPort: import.meta.env.VITE_REVERB_PORT ?? 443,
    forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
});
```

```js
// resources/js/app.js
import './echo';
```

Nghe:

```js
Echo.channel(`posts.${postId}`)
    .listen('.comment.added', (e) => {          // ← dấu chấm đầu = tên từ broadcastAs()
        console.log(e.body, e.author);
    });

Echo.private(`App.Models.User.${userId}`)
    .notification((n) => console.log(n));

Echo.join(`posts.${postId}.presence`)
    .here((users)  => console.log('Đang xem:', users))
    .joining((u)   => console.log(u.name, 'vào'))
    .leaving((u)   => console.log(u.name, 'rời'))
    .listenForWhisper('typing', (e) => console.log(e.name, 'đang gõ...'));
```

Dấu chấm ở `.listen('.comment.added')` **bắt buộc** khi bạn dùng `broadcastAs()`. Thiếu nó, Echo đi
tìm sự kiện tên `App\Events\.comment.added` và không bao giờ khớp — không có lỗi nào trong console.

---

## 7. Ghép với Livewire

Cách gọn nhất, không viết JavaScript:

```php
<?php

use App\Models\Post;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\On;
use Livewire\Component;

new class extends Component
{
    #[Locked]
    public Post $post;

    public function getListeners(): array
    {
        return [
            "echo:posts.{$this->post->id},.comment.added" => 'refreshComments',
        ];
    }

    public function refreshComments(): void
    {
        unset($this->comments);
    }

    #[Computed]
    public function comments()
    {
        return $this->post->comments()->with('author:id,name')->latest()->get();
    }
};
?>

<div>
    @foreach ($this->comments as $comment)
        <div wire:key="c-{{ $comment->id }}">
            <strong>{{ $comment->author->name }}</strong>: {{ $comment->body }}
        </div>
    @endforeach
</div>
```

Cú pháp listener: `echo:<tên-kênh>,<tên-sự-kiện>`. Với kênh riêng tư là `echo-private:`, presence là
`echo-presence:`.

`unset($this->comments)` xoá cache của `#[Computed]` để nó truy vấn lại — cùng kỹ thuật ở
[bài 06](../06-livewire-4.md).

---

## 8. Whisper — sự kiện không đi qua server

"Đang gõ..." mà gửi qua Laravel là mỗi phím một request. Whisper đi thẳng qua WebSocket, không chạm
vào PHP:

```js
Echo.join(`posts.${postId}.presence`)
    .listenForWhisper('typing', (e) => showTypingIndicator(e.name));

input.addEventListener('keydown', throttle(() => {
    Echo.join(`posts.${postId}.presence`).whisper('typing', { name: userName });
}, 300));
```

Whisper chỉ dùng được trên kênh private và presence.

---

## 9. Đưa lên production

### Nginx proxy

```nginx
location /app {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 60s;
}
```

Thiếu hai dòng `Upgrade`/`Connection` là WebSocket không bắt tay được — trình duyệt báo
`WebSocket connection failed` mà log Nginx không có gì bất thường.

`.env` production:

```ini
REVERB_SERVER_HOST=0.0.0.0
REVERB_SERVER_PORT=8080

REVERB_HOST=blog.test
REVERB_PORT=443
REVERB_SCHEME=https
```

Client nối tới `wss://blog.test:443/app/...`, Nginx chuyển tiếp về `127.0.0.1:8080`.

### Supervisor

```ini
[program:reverb]
command=php /var/www/blog/artisan reverb:start
autostart=true
autorestart=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/www/blog/storage/logs/reverb.log
stopwaitsecs=3600
```

Deploy: `php artisan reverb:restart`.

### Nhiều server

Reverb giữ kết nối **trong bộ nhớ tiến trình**. Chạy 2 instance thì người nối vào instance A không
nhận được sự kiện phát từ instance B. Bật scaling qua Redis:

```ini
REVERB_SCALING_ENABLED=true
```

```php
// vendor/laravel/reverb/config/reverb.php
'scaling' => [
    'enabled' => env('REVERB_SCALING_ENABLED', false),
    'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
],
```

Redis làm pub/sub giữa các instance.

### Giới hạn kết nối

Mỗi kết nối WebSocket là một file descriptor:

```bash
$ ulimit -n
256                # mặc định trên macOS — quá thấp cho production
```

Đặt `ulimit -n 10000` trở lên trong service file của Reverb.

---

## 10. Khi nào **không** dùng Reverb

| Nhu cầu | Dùng gì |
|---------|---------|
| Thông báo tức thời, chat, presence | Reverb ✅ |
| Cập nhật số liệu mỗi 30 giây | Polling (`wire:poll.30s`) — đơn giản hơn nhiều |
| Luồng dữ liệu một chiều từ server | SSE (`response()->stream()`) — nhẹ hơn WebSocket |
| Không muốn vận hành thêm tiến trình | Pusher/Ably (dịch vụ trả tiền) |

`wire:poll` giải quyết 80% nhu cầu "cập nhật thời gian thực" mà không cần thêm bất kỳ hạ tầng nào:

```blade
<div wire:poll.30s>
    Lượt xem: {{ $this->views }}
</div>
```

Đừng dựng WebSocket cho việc mà một dòng `wire:poll` làm được.

---

## 11. Bảng lỗi Reverb

| Triệu chứng | Nguyên nhân | Sửa |
|-------------|-------------|-----|
| `install:broadcasting` báo thành công nhưng package không có | Xung đột `guzzlehttp/psr7` | `composer require laravel/reverb -W` |
| `Pusher\Pusher::__construct(): Argument #1 must be string, null given` | Thiếu `REVERB_APP_KEY` trong `.env` | Thêm đủ 6 biến `REVERB_*` |
| `Failed to listen ... Address already in use` | Cổng bận | Đổi cổng hoặc tắt tiến trình cũ |
| Handshake trả 404 thay vì 101 | Key trong URL khác `REVERB_APP_KEY` | Đồng bộ key |
| Sự kiện gửi đi nhưng client không nhận | `REVERB_SERVER_PORT` ≠ `REVERB_PORT` | Đặt bằng nhau (dev) |
| Sự kiện không gửi đi | `ShouldBroadcast` + không có worker | `php artisan queue:work` hoặc `ShouldBroadcastNow` |
| Client nhận sự kiện nhưng listener không chạy | Thiếu dấu `.` khi dùng `broadcastAs()` | `.listen('.comment.added')` |
| `WebSocket connection failed` sau Nginx | Thiếu header `Upgrade` | Thêm vào block `location` |
| Chạy 2 instance, sự kiện chỉ tới một nửa | Chưa bật scaling | `REVERB_SCALING_ENABLED=true` |

---

## Bài tập

1. Chạy `php artisan install:broadcasting --reverb` trên project mới. Ghi lại **toàn bộ** output, chỉ
   ra dòng nào mâu thuẫn với dòng nào. Sửa bằng `-W`.

2. Sau khi cài xong, chạy bất kỳ lệnh artisan nào **trước khi** thêm biến `REVERB_*`. Ghi lại lỗi và
   giải thích vì sao ngay cả `composer install` cũng hỏng.

3. Khởi động Reverb rồi kiểm tra bằng lệnh `curl` handshake ở mục 3. Ghi lại mã trạng thái. Đổi key
   trong URL thành chuỗi sai và thử lại.

4. Đặt `REVERB_SERVER_PORT=8080` và `REVERB_PORT=8085`. Broadcast một sự kiện. Client có nhận được
   không? Có lỗi nào không? Giải thích.

5. Viết `CommentAdded` **không** có `broadcastWith()`. Mở DevTools tab Network → WS và xem payload gửi
   xuống trình duyệt. Chỉ ra dữ liệu nào không nên lộ. Thêm `broadcastWith()` và so lại.

6. Tạo `PrivateChannel` cho thông báo cá nhân. Viết callback trong `channels.php` luôn `return true`,
   rồi đăng nhập bằng tài khoản khác và thử nghe kênh của người kia. Sửa callback cho đúng.

7. Ghép với Livewire theo mục 7. Mở hai trình duyệt, bình luận ở cửa sổ này và xem cửa sổ kia.

8. Thay Reverb bằng `wire:poll.10s` cho cùng tính năng. So sánh số request và độ phức tạp vận hành.

<details>
<summary>Gợi ý đáp án</summary>

**2.**
```
RuntimeException
Failed to create broadcaster for connection "reverb" with error:
Pusher\Pusher::__construct(): Argument #1 ($auth_key) must be of type string, null given
```
`composer install` chạy script `post-autoload-dump` → `php artisan package:discover` → nạp
`routes/channels.php` → `Broadcast::channel(...)` → dựng broadcaster → nổ. Toàn bộ chuỗi công cụ chết
theo một biến môi trường thiếu.

**3.** Key đúng → `101`. Key sai → `404`.

**4.** Client **không** nhận được và **không có lỗi nào**. Laravel gửi sự kiện tới `localhost:8085`
(theo `REVERB_PORT`) trong khi server nghe ở `8080` (theo `REVERB_SERVER_PORT`). Đây là lỗi im lặng
điển hình của Reverb.

**5.** Không có `broadcastWith()`, Laravel serialize toàn bộ thuộc tính public — cả model `Comment`
kèm mọi cột. Nếu event nhận thêm `User` thì email và các cột nội bộ cũng đi xuống trình duyệt.

</details>

---

Tiếp theo: [05-kien-truc-du-an-lon.md](./05-kien-truc-du-an-lon.md)
