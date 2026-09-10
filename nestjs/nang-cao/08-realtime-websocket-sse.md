# Bài 8 — Realtime: WebSocket & SSE ở quy mô lớn

Realtime dễ làm cho 10 người dùng và khó làm cho 100.000. Bài này tập trung vào phần khó: **scale nhiều instance** và **không sập vì quá nhiều kết nối**.

> Chưa từng làm WebSocket với NestJS? Học phần cơ bản trước: [11-websocket-co-ban.md](../11-websocket-co-ban.md) — gateway, room, xác thực, ví dụ chat chạy được.

---

## 1. Chọn công nghệ nào

| | WebSocket | SSE | Long polling |
|---|---|---|---|
| Chiều truyền | Hai chiều | **Chỉ server → client** | Hai chiều (giả) |
| Giao thức | ws:// riêng | HTTP thường | HTTP thường |
| Tự kết nối lại | Tự viết | **Trình duyệt tự làm** | Tự viết |
| Qua proxy/CDN | Hay bị chặn | **Luôn qua được** | Luôn qua được |
| Nén, HTTP/2 | Không | **Có** | Có |
| Chi phí mỗi kết nối | ~40KB | ~30KB | Cao (tạo lại liên tục) |

**Quy tắc chọn:** client chỉ **nhận** (thông báo, tiến độ job, giá cổ phiếu, log) → dùng **SSE**, đơn giản hơn nhiều. Cần **gửi qua lại** (chat, game, cộng tác) → WebSocket.

Rất nhiều dự án dùng WebSocket cho việc mà SSE làm tốt hơn với 1/3 công sức.

---

## 2. SSE — nhẹ và đủ dùng cho 80% trường hợp

NestJS hỗ trợ sẵn qua decorator `@Sse()`.

### Báo tiến độ job export

```ts
import { Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval, map, takeWhile, switchMap, from } from 'rxjs';

@Controller('exports')
export class ExportsController {
  @Sse(':jobId/progress')
  progress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return interval(1000).pipe(
      switchMap(() => from(this.exportQueue.getJob(jobId))),
      switchMap(async (job) => {
        if (!job) return { state: 'not_found', progress: 0 };
        return {
          state: await job.getState(),
          progress: job.progress,
          result: job.returnvalue,
        };
      }),
      takeWhile((s) => !['completed', 'failed', 'not_found'].includes(s.state), true),
      map((data) => ({ data }) as MessageEvent),
    );
  }
}
```

Client:

```js
const es = new EventSource('/api/exports/123/progress');

es.onmessage = (e) => {
  const { state, progress, result } = JSON.parse(e.data);
  updateBar(progress);
  if (state === 'completed') {
    window.location = result.url;
    es.close();
  }
};

es.onerror = () => { /* trình duyệt TỰ kết nối lại — không cần làm gì */ };
```

### Đẩy sự kiện thay vì polling

Bản trên vẫn hỏi Redis mỗi giây. Với nhiều người xem, dùng Redis Pub/Sub để chỉ đẩy khi có thay đổi thật:

```ts
@Injectable()
export class NotificationStream {
  private readonly subject = new Subject<{ userId: number; payload: unknown }>();

  constructor(@InjectRedis() private readonly sub: Redis) {}

  async onModuleInit() {
    // Nhận thông báo từ MỌI instance qua Redis
    await this.sub.subscribe('notifications');
    this.sub.on('message', (_ch, raw) => this.subject.next(JSON.parse(raw)));
  }

  forUser(userId: number): Observable<MessageEvent> {
    return this.subject.pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ data: e.payload }) as MessageEvent),
    );
  }
}
```

```ts
@Sse('notifications')
notifications(@CurrentUser('id') userId: number) {
  return this.stream.forUser(userId);
}
```

### Ba điều bắt buộc với SSE ở production

```ts
// ① Gửi heartbeat, nếu không proxy sẽ cắt kết nối "im lặng" sau ~60s
merge(
  this.stream.forUser(userId),
  interval(30_000).pipe(map(() => ({ data: '', type: 'ping' } as MessageEvent))),
);
```

```nginx
# ② Nginx bắt buộc phải tắt buffer, nếu không client không nhận được gì
location /api/exports {
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 3600s;
  proxy_set_header Connection '';
  proxy_http_version 1.1;
}
```

```ts
// ③ Dọn tài nguyên khi client ngắt kết nối
@Sse('stream')
stream(@Req() req: Request): Observable<MessageEvent> {
  return this.source.pipe(
    takeUntil(fromEvent(req, 'close')),   // client đóng tab -> huỷ subscription
  );
}
```

> Trình duyệt giới hạn **6 kết nối SSE mỗi domain** với HTTP/1.1. Dùng HTTP/2 (giới hạn ~100) hoặc gộp mọi thông báo vào **một** stream duy nhất.

---

## 3. WebSocket với Socket.IO

```bash
npm i @nestjs/websockets @nestjs/platform-socket.io socket.io
```

```ts
// src/chat/chat.gateway.ts
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: process.env.CORS_ORIGIN?.split(',') },
  transports: ['websocket'],      // bỏ polling -> nhẹ hơn nhiều
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // ⚠️ Xác thực NGAY khi kết nối, không đợi message đầu tiên
      const token = client.handshake.auth?.token
        ?? client.handshake.headers.authorization?.replace('Bearer ', '');

      const payload = await this.jwt.verifyAsync(token);
      client.data.userId = payload.sub;

      // Room riêng để gửi tin nhắn tới đúng người dùng
      await client.join(`user:${payload.sub}`);
      this.logger.log(`User ${payload.sub} kết nối (${client.id})`);
    } catch {
      client.emit('error', { message: 'Xác thực thất bại' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Ngắt kết nối ${client.id}`);
  }

  @SubscribeMessage('join-room')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId }: { roomId: string },
  ) {
    // Luôn kiểm tra quyền — client có thể gửi bất kỳ roomId nào
    const allowed = await this.chatService.canAccess(client.data.userId, roomId);
    if (!allowed) return { error: 'Không có quyền vào phòng này' };

    await client.join(`room:${roomId}`);
    return { ok: true };
  }

  @SubscribeMessage('send-message')
  async send(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const msg = await this.chatService.create(client.data.userId, dto);
    this.server.to(`room:${dto.roomId}`).emit('new-message', msg);
    return { ok: true, id: msg.id };
  }
}
```

### Validation cho WebSocket

Pipe toàn cục đăng ký bằng `app.useGlobalPipes()` **có** áp dụng cho gateway. Cái bẫy thật nằm ở chỗ khác: khi validation thất bại, exception ném ra **không đi qua HTTP exception filter** của bạn, nên client nhận được một sự kiện `exception` chứ không phải response lỗi như thường lệ.

Vì vậy vẫn nên khai báo tường minh để đọc code là biết ngay handler này có validate:

```ts
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@SubscribeMessage('send-message')
send(@MessageBody() dto: SendMessageDto) {}
```

Và exception filter riêng:

```ts
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const message = exception instanceof WsException
      ? exception.getError()
      : 'Lỗi hệ thống';
    client.emit('error', { message });
  }
}
```

---

## 4. Scale nhiều instance — vấn đề cốt lõi

### Vấn đề

```
User A ──► Instance 1     server.to('room:1').emit(...)  chỉ tới được
User B ──► Instance 2  ❌  các client đang nối vào Instance 1
```

Mỗi instance chỉ biết những socket nối vào chính nó. Với 4 container, tin nhắn chỉ tới được 1/4 số người.

### Giải pháp: Redis adapter

```bash
npm i @socket.io/redis-adapter ioredis
```

```ts
// src/shared/websocket/redis-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(url: string): Promise<void> {
    const pubClient = new Redis(url);
    const subClient = pubClient.duplicate();   // BẮT BUỘC 2 client riêng
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

```ts
// main.ts
const adapter = new RedisIoAdapter(app);
await adapter.connectToRedis(process.env.REDIS_URL);
app.useWebSocketAdapter(adapter);
```

Giờ `server.to('room:1').emit()` được phát qua Redis tới **mọi** instance.

### Cấu hình load balancer

Với `transports: ['websocket']` thuần, **không cần** sticky session — kết nối WebSocket giữ nguyên trên một instance suốt vòng đời.

Nếu cho phép fallback sang polling, **bắt buộc** phải sticky:

```nginx
upstream app {
  ip_hash;                  # hoặc dùng cookie
  server app1:3000;
  server app2:3000;
}

location /socket.io/ {
  proxy_pass http://app;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
```

---

## 5. Giới hạn tài nguyên cho kết nối

Mỗi kết nối WebSocket tốn RAM và một file descriptor. 100.000 kết nối × 40KB ≈ 4GB.

### Giới hạn số kết nối mỗi user

```ts
async handleConnection(client: Socket) {
  const userId = client.data.userId;
  const count = await this.redis.incr(`ws:count:${userId}`);
  await this.redis.expire(`ws:count:${userId}`, 3600);

  if (count > 5) {
    await this.redis.decr(`ws:count:${userId}`);
    client.emit('error', { message: 'Quá nhiều kết nối đồng thời' });
    client.disconnect(true);
    return;
  }
}

handleDisconnect(client: Socket) {
  if (client.data.userId) {
    this.redis.decr(`ws:count:${client.data.userId}`);
  }
}
```

### Rate limit message

Một client gửi 10.000 message/giây sẽ làm nghẽn cả gateway:

```ts
@SubscribeMessage('send-message')
async send(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  const key = `ws:rate:${client.data.userId}`;
  const count = await this.redis.incr(key);
  if (count === 1) await this.redis.expire(key, 10);

  if (count > 50) {                     // 50 tin/10 giây
    throw new WsException('Bạn gửi quá nhanh, vui lòng chậm lại');
  }
  // ...
}
```

### Tăng giới hạn hệ điều hành

```bash
# Mỗi kết nối là 1 file descriptor — mặc định 1024 là quá ít
ulimit -n 65536
```

```yaml
# docker-compose
services:
  api:
    ulimits:
      nofile: { soft: 65536, hard: 65536 }
```

### Cấu hình Socket.IO cho tải cao

```ts
@WebSocketGateway({
  transports: ['websocket'],
  pingInterval: 25_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 1e5,         // 100KB — chặn message khổng lồ
  perMessageDeflate: false,       // TẮT nén: tốn CPU nhiều hơn lợi
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60_000,   // mạng chập chờn vẫn nhận được tin đã lỡ
  },
})
```

> `perMessageDeflate` bật mặc định ở một số phiên bản và là nguyên nhân phổ biến của CPU cao bất thường. Với message JSON nhỏ, nén không đáng.

---

## 6. Không phát dữ liệu lớn qua WebSocket

```ts
// ❌ Đẩy 10.000 bản ghi qua socket -> nghẽn, client đơ
this.server.emit('data-updated', hugeArray);

// ✅ Chỉ báo hiệu, client tự gọi API để lấy (có phân trang, có cache)
this.server.to(`user:${userId}`).emit('data-updated', {
  type: 'posts',
  count: 10_000,
});
```

WebSocket dùng để **thông báo**, không phải để truyền dữ liệu lớn. HTTP có sẵn cache, nén, phân trang, backpressure — WebSocket không có gì trong số đó.

Với dữ liệu thay đổi liên tục (giá, số liệu), gom lại rồi phát định kỳ thay vì phát từng thay đổi:

```ts
@Injectable()
export class PriceBroadcaster {
  private pending = new Map<string, number>();

  update(symbol: string, price: number) {
    this.pending.set(symbol, price);      // chỉ ghi nhận
  }

  @Cron('*/1 * * * * *')                  // phát gộp mỗi giây
  flush() {
    if (!this.pending.size) return;
    this.server.emit('prices', Object.fromEntries(this.pending));
    this.pending.clear();
  }
}
```

10.000 thay đổi/giây → 1 message/giây thay vì 10.000.

---

## 7. Giám sát

```ts
@Cron(CronExpression.EVERY_30_SECONDS)
async reportConnections() {
  const sockets = await this.server.fetchSockets();   // toàn cluster nếu có Redis adapter
  const rooms = this.server.sockets.adapter.rooms.size;

  this.logger.log(`WS: ${sockets.length} kết nối, ${rooms} phòng`);

  if (sockets.length > 40_000) {
    await this.alerting.notify(`⚠️ Số kết nối WS cao: ${sockets.length}`);
  }
}
```

---

## 8. Bài tập bài 8

1. Cài SSE báo tiến độ cho job export ở [bài 05](./05-queue-va-job-nen.md). Xác nhận thanh tiến độ chạy mượt trên trình duyệt.
2. Thêm heartbeat 30 giây, dựng nginx phía trước với `proxy_buffering off` và xác nhận kết nối sống được quá 5 phút.
3. Tắt server giữa chừng, xác nhận trình duyệt **tự kết nối lại** mà không cần code gì thêm.
4. Cài `ChatGateway` có xác thực JWT ngay lúc `handleConnection`. Thử kết nối với token sai → phải bị `disconnect` ngay.
5. **Chứng minh vấn đề scale:** chạy 2 instance sau nginx, kết nối 2 client vào 2 instance khác nhau, gửi tin — xác nhận client kia **không nhận được**.
6. Cài Redis adapter và xác nhận tin nhắn tới được cả hai.
7. Cài giới hạn 5 kết nối/user và rate limit 50 message/10 giây. Test bằng script mở 10 kết nối.
8. Dùng `artillery` hoặc script `socket.io-client` mở **10.000 kết nối đồng thời**. Đo RAM (`process.memoryUsage().rss`) và tính RAM trung bình mỗi kết nối.
9. So sánh CPU khi bật và tắt `perMessageDeflate` với 5.000 kết nối gửi tin liên tục.
10. Cài `PriceBroadcaster` gom message. So sánh số message/giây và CPU trước/sau.

<details>
<summary>Gợi ý đáp án</summary>

**1. SSE báo tiến độ job export.**

```ts
@Sse('exports/:jobId/progress')
progress(@Param('jobId') jobId: string): Observable<MessageEvent> {
  return interval(1000).pipe(
    switchMap(() => this.exportQueue.getJob(jobId)),
    map((job) => ({ data: { progress: job?.progress ?? 0, state: job?.returnvalue ? 'done' : 'running' } })),
    takeWhile((e) => e.data.state !== 'done', true),   // true = phát nốt sự kiện cuối
  );
}
```

```js
const es = new EventSource(`/exports/${jobId}/progress`);
es.onmessage = (e) => {
  const { progress, state } = JSON.parse(e.data);
  thanh.style.width = `${progress}%`;
  if (state === 'done') es.close();          // ← không close thì nó tự kết nối lại mãi
};
```

`takeWhile(..., true)` với tham số thứ hai là chỗ dễ sai: mặc định `takeWhile` **bỏ** phần tử làm điều
kiện sai, nên client không bao giờ nhận được sự kiện `done`.

**2. Heartbeat + nginx.**

```ts
return merge(
  duLieuThat$,
  interval(30_000).pipe(map(() => ({ type: 'ping', data: '' }))),
);
```

```nginx
location /sse/ {
  proxy_pass http://app;
  proxy_http_version 1.1;
  proxy_set_header Connection '';      # bỏ header 'close' mặc định của HTTP/1.0
  proxy_buffering off;                 # ← quan trọng nhất
  proxy_read_timeout 3600s;
}
```

Không có `proxy_buffering off`, nginx **gom** dữ liệu lại chờ đủ buffer mới đẩy đi — thanh tiến trình
đứng im rồi nhảy một phát lên 100%. Triệu chứng này chỉ xuất hiện sau khi lên staging, không bao giờ
thấy khi chạy máy local.

Heartbeat giữ cho proxy và load balancer không cắt kết nối vì "không có dữ liệu".

**3. Tự kết nối lại.**

Tắt server giữa chừng: trình duyệt tự kết nối lại sau ~3 giây, **không cần một dòng code nào**.
Đây là ưu thế lớn nhất của SSE so với WebSocket — với WebSocket bạn phải tự viết vòng lặp reconnect
có backoff.

Server nên gửi kèm `id:` mỗi sự kiện; khi kết nối lại trình duyệt tự gửi `Last-Event-ID` để bạn phát
tiếp từ chỗ dừng thay vì phát lại từ đầu.

**4. Xác thực JWT lúc `handleConnection`.**

```ts
async handleConnection(client: Socket) {
  try {
    const payload = await this.jwt.verifyAsync(client.handshake.auth?.token);
    client.data.userId = payload.sub;
    client.join(`user:${payload.sub}`);
  } catch {
    client.disconnect(true);          // ngắt TRƯỚC khi nhận message nào
  }
}
```

Token sai → bị ngắt ngay. Xác thực ở đây chứ không ở từng handler: một chỗ kiểm tra, và kẻ tấn công
không có cơ hội gửi bất cứ thứ gì.

Token đặt trong `handshake.auth`, **không** trong query string — query string bị ghi vào access log
của nginx và lịch sử trình duyệt.

**5–6. Vấn đề scale và Redis adapter.**

Hai instance sau nginx, client A vào instance 1, client B vào instance 2. A gửi tin → **B không nhận
được**, vì `server.emit()` chỉ phát tới các socket đang giữ **trong tiến trình này**.

Đây là lỗi kinh điển: chạy một instance thì đúng hoàn toàn, lên production nhiều instance thì "thỉnh
thoảng mất tin" — thực ra là mất đúng tỉ lệ `(n-1)/n`.

```ts
const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
app.useWebSocketAdapter(new RedisIoAdapter(app, pubClient, subClient));
```

Adapter phát mỗi lần `emit` qua Redis Pub/Sub, mọi instance nhận được và chuyển tiếp cho socket của
mình. Sau khi bật: B nhận được tin của A.

Nhớ cấu hình nginx `ip_hash` hoặc sticky session cho Socket.IO khi dùng polling fallback — quá trình
handshake nhiều bước cần về đúng một instance.

**7. Giới hạn kết nối và rate limit message.**

```ts
async handleConnection(client: Socket) {
  const userId = client.data.userId;
  const so = await this.redis.incr(`ws:conn:${userId}`);
  await this.redis.expire(`ws:conn:${userId}`, 3600);
  if (so > 5) {
    client.emit('error', { message: 'Quá 5 kết nối' });
    return client.disconnect(true);
  }
}
handleDisconnect(client: Socket) {
  this.redis.decr(`ws:conn:${client.data.userId}`);     // ← đừng quên
}
```

```ts
@SubscribeMessage('message')
async onMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  const key = `ws:rate:${client.data.userId}`;
  const n = await this.redis.incr(key);
  if (n === 1) await this.redis.expire(key, 10);
  if (n > 50) throw new WsException('Gửi quá nhanh');
  ...
}
```

Script mở 10 kết nối: 5 cái đầu vào được, 5 cái sau bị ngắt. Quên `decr` trong `handleDisconnect` là
sau vài giờ người dùng thật không kết nối được nữa dù đã đóng hết tab.

**8. 10.000 kết nối và RAM mỗi kết nối.**

```js
// script đo
const sockets = [];
for (let i = 0; i < 10_000; i++) sockets.push(io(URL, { transports: ['websocket'] }));
```

```ts
setInterval(() => {
  const { rss } = process.memoryUsage();
  console.log(`${io.engine.clientsCount} kết nối, rss=${(rss / 1024 / 1024).toFixed(0)}MB`);
}, 5000);
```

Cách tính: `(rss_có_tải − rss_lúc_rảnh) / số_kết_nối`. Con số này là thứ bạn cần để trả lời câu
"một instance chịu được bao nhiêu người" — và để chọn kích thước máy thay vì đoán.

Bắt buộc dùng `transports: ['websocket']` khi đo: polling tốn RAM khác hẳn và làm sai kết quả.
Nhớ nâng `ulimit -n` trước, nếu không bạn chạm trần file descriptor trước khi chạm trần RAM.

**9. `perMessageDeflate`.**

```ts
@WebSocketGateway({ perMessageDeflate: false })
```

Với 5.000 kết nối gửi tin liên tục, **bật nén tốn CPU đáng kể** và thêm độ trễ, đổi lại tiết kiệm băng
thông. Với tin nhắn JSON nhỏ (dưới ~1KB) thì gần như luôn lỗ — Socket.IO tắt mặc định là có lý do.

Chỉ bật khi payload lớn và người dùng ở mạng chậm, và luôn đo cả hai chiều trước khi quyết định.

**10. Gom message trước khi phát.**

```ts
@Injectable()
export class PriceBroadcaster {
  private cho = new Map<string, number>();

  capNhat(ma: string, gia: number) { this.cho.set(ma, gia) }   // chỉ ghi vào Map

  @Interval(100)                                               // phát 10 lần/giây
  xa() {
    if (!this.cho.size) return;
    this.server.emit('prices', Object.fromEntries(this.cho));
    this.cho.clear();
  }
}
```

Giá đổi 1000 lần/giây, không gom = 1000 message/giây × số client. Gom 100ms = **10 message/giây**,
và mỗi message chứa giá mới nhất của mọi mã.

Giảm khoảng 100 lần lượng message và CPU. Cái giá là độ trễ tối đa 100ms — với bảng giá hiển thị cho
người xem thì không ai nhận ra; với khớp lệnh tự động thì không chấp nhận được. Dùng `Map` để nhiều
lần cập nhật cùng một mã tự động chỉ còn giá cuối.

</details>

➡️ Tiếp: [09-microservices.md](./09-microservices.md)
