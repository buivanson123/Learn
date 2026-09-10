# Bài 11 — Realtime với WebSocket (cơ bản)

> Điều kiện: đã xong bài 01–07. Bài này độc lập với dự án Blog API, bạn có thể làm trong project riêng.
>
> Cần scale nhiều instance, giới hạn tài nguyên, chống quá tải → [nang-cao/08](./nang-cao/08-realtime-websocket-sse.md).

---

## 1. WebSocket là gì

HTTP hoạt động theo kiểu **hỏi–đáp**: client hỏi, server trả lời, kết nối đóng. Server **không thể** tự gửi gì cho client.

```
HTTP:       Client ──hỏi──► Server
                   ◄─đáp──
                   (đóng kết nối)

WebSocket:  Client ◄══════► Server
                (kết nối mở liên tục, hai bên gửi bất cứ lúc nào)
```

Vì vậy với HTTP, muốn biết có tin nhắn mới bạn phải **hỏi liên tục** (polling):

```js
setInterval(() => fetch('/api/messages'), 2000);   // 30 request/phút/người, hầu hết trả về rỗng
```

1000 người online = 30.000 request/phút chỉ để hỏi "có gì mới không". WebSocket giải quyết bằng cách để server **chủ động đẩy** khi thật sự có tin.

---

## 2. Khi nào dùng — và khi nào không

| Tình huống | Nên dùng |
|---|---|
| Chat, nhắn tin | **WebSocket** |
| Chơi game, cộng tác cùng lúc (Google Docs) | **WebSocket** |
| Thông báo đẩy, tiến độ upload, giá cổ phiếu | **SSE** (mục 12) — đơn giản hơn nhiều |
| Dữ liệu cập nhật vài phút một lần | HTTP thường + gọi lại khi cần |
| Danh sách có nút "Làm mới" | HTTP thường |

> Sai lầm phổ biến nhất: dùng WebSocket cho thứ chỉ cần server → client một chiều. **SSE** làm việc đó với 1/3 công sức, tự kết nối lại, và không bị proxy chặn.

---

## 3. Gateway đầu tiên

### Cài đặt

```bash
npm i @nestjs/websockets @nestjs/platform-socket.io socket.io
```

> Tài liệu này dùng **Socket.IO** thay vì WebSocket thuần vì nó lo sẵn: tự kết nối lại khi rớt mạng, chia phòng (room), gửi kèm callback, và tự chuyển sang HTTP polling khi mạng chặn WebSocket. Với người mới, đây là lựa chọn tiết kiệm rất nhiều thời gian.

### Gateway = "controller" của WebSocket

```ts
// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';

@WebSocketGateway({
  cors: { origin: '*' },     // dev thôi; production ghi rõ domain
})
export class ChatGateway {
  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: string): string {
    console.log('Client gửi:', data);
    return `Server đã nhận: ${data}`;    // giá trị này quay về client
  }
}
```

```ts
// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

@Module({
  providers: [ChatGateway],   // Gateway khai báo ở providers, KHÔNG phải controllers
})
export class ChatModule {}
```

Nhớ import `ChatModule` vào `AppModule`.

### Đối chiếu với controller

| Controller (HTTP) | Gateway (WebSocket) |
|---|---|
| `@Controller('posts')` | `@WebSocketGateway()` |
| `@Post('publish')` | `@SubscribeMessage('publish')` |
| `@Body()` | `@MessageBody()` |
| `@Req()` | `@ConnectedSocket()` |
| Khai báo ở `controllers: []` | Khai báo ở **`providers: []`** |

Gateway inject service y hệt controller:

```ts
constructor(private readonly chatService: ChatService) {}
```

### Chạy thử

```bash
npm run start:dev
```

```
[Nest] LOG [NestApplication] Nest application successfully started
[Nest] LOG [WebSocketsController] ChatGateway subscribed to the "ping" message
```

Dòng cuối xác nhận gateway đã đăng ký thành công.

---

## 4. Trang HTML để test

Tạo `public/test.html`. Đây là thứ bạn sẽ dùng suốt bài, hãy làm ngay.

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Test WebSocket</title>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <style>
    body { font-family: system-ui; max-width: 700px; margin: 40px auto; }
    #log { border: 1px solid #ccc; height: 320px; overflow-y: auto; padding: 12px; }
    #log div { padding: 2px 0; border-bottom: 1px solid #f0f0f0; }
    input, button { padding: 8px; font-size: 14px; }
    input { width: 400px; }
  </style>
</head>
<body>
  <h3>Trạng thái: <span id="status">đang kết nối…</span></h3>
  <div id="log"></div>
  <p>
    <input id="msg" placeholder="Nhập tin nhắn rồi Enter">
    <button onclick="send()">Gửi</button>
  </p>

  <script>
    const socket = io('http://localhost:3000');
    const log = (t) => {
      const d = document.createElement('div');
      d.textContent = `${new Date().toLocaleTimeString()} — ${t}`;
      document.getElementById('log').append(d);
      d.scrollIntoView();
    };

    socket.on('connect',    () => { status.textContent = '🟢 đã kết nối ' + socket.id; log('Kết nối thành công'); });
    socket.on('disconnect', (r) => { status.textContent = '🔴 mất kết nối';  log('Ngắt: ' + r); });

    // Lắng nghe sự kiện server đẩy xuống
    socket.on('new-message', (m) => log('📩 ' + JSON.stringify(m)));
    socket.on('exception',   (e) => log('⚠️ Lỗi: ' + JSON.stringify(e)));

    function send() {
      const input = document.getElementById('msg');
      if (!input.value) return;
      // Tham số thứ 3 là callback nhận giá trị handler return về
      socket.emit('ping', input.value, (reply) => log('↩️ ' + reply));
      input.value = '';
    }
    document.getElementById('msg').addEventListener('keydown', (e) => e.key === 'Enter' && send());
  </script>
</body>
</html>
```

Cho Nest phục vụ file tĩnh:

```bash
npm i @nestjs/serve-static
```

```ts
// app.module.ts
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';

ServeStaticModule.forRoot({ rootPath: join(__dirname, '..', 'public') }),
```

Mở http://localhost:3000/test.html, gõ tin nhắn → thấy `↩️ Server đã nhận: ...`.

> **Mở 2 tab trình duyệt** để test broadcast ở các mục sau.

---

## 5. Vòng đời kết nối

```ts
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket,
  OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;                    // đại diện TOÀN BỘ server, dùng để broadcast

  private readonly logger = new Logger(ChatGateway.name);

  afterInit() {
    this.logger.log('Gateway đã khởi tạo');
  }

  handleConnection(client: Socket) {
    this.logger.log(`✅ Kết nối mới: ${client.id}`);
    // Gửi riêng cho client vừa vào
    client.emit('welcome', { message: 'Chào mừng!', socketId: client.id });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`❌ Ngắt kết nối: ${client.id}`);
  }
}
```

Ba khái niệm cần phân biệt rõ ngay từ đầu:

| Đối tượng | Là gì | Dùng để |
|---|---|---|
| `client: Socket` | **Một** kết nối cụ thể | Gửi riêng cho người đó |
| `this.server: Server` | Toàn bộ server | Gửi cho tất cả, quản lý phòng |
| `client.id` | Chuỗi định danh kết nối | Nhận diện tạm thời |

> ⚠️ `client.id` **đổi mỗi lần kết nối lại**. Đừng dùng nó làm định danh người dùng — dùng `userId` từ token (mục 10).

---

## 6. Bốn cách gửi tin

Đây là phần hay nhầm nhất. Bảng này đáng ghi nhớ:

```ts
@SubscribeMessage('demo')
demo(@ConnectedSocket() client: Socket) {

  // ① Chỉ gửi cho CHÍNH client vừa gửi
  client.emit('reply', { text: 'chỉ bạn thấy' });

  // ② Gửi cho TẤT CẢ, kể cả người gửi
  this.server.emit('announcement', { text: 'ai cũng thấy' });

  // ③ Gửi cho tất cả TRỪ người gửi
  client.broadcast.emit('someone-did-something', { by: client.id });

  // ④ Gửi cho một phòng
  this.server.to('room:1').emit('room-message', { text: 'chỉ phòng 1' });

  // ④b Gửi cho phòng, TRỪ người gửi
  client.to('room:1').emit('room-message', { text: '...' });
}
```

Mẹo nhớ: **`this.server.to(...)` bao gồm người gửi, `client.to(...)` thì không.**

Gửi cho một người cụ thể qua `socket.id`:

```ts
this.server.to(socketId).emit('private-message', data);
```

---

## 7. Room — nhóm các kết nối lại

Room chỉ là một cái nhãn dán lên kết nối. Một socket vào được nhiều room cùng lúc.

```ts
@SubscribeMessage('join-room')
async joinRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() roomId: string,
) {
  await client.join(`room:${roomId}`);

  // Báo cho những người đã ở trong phòng
  client.to(`room:${roomId}`).emit('user-joined', { socketId: client.id });

  return { ok: true, room: roomId };
}

@SubscribeMessage('leave-room')
async leaveRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
  await client.leave(`room:${roomId}`);
  client.to(`room:${roomId}`).emit('user-left', { socketId: client.id });
  return { ok: true };
}

@SubscribeMessage('room-message')
roomMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody() body: { roomId: string; text: string },
) {
  this.server.to(`room:${body.roomId}`).emit('new-message', {
    from: client.id,
    text: body.text,
    at: new Date().toISOString(),
  });
}
```

Ba điều về room:

1. **Không cần tạo trước.** `join()` một room chưa tồn tại thì nó tự sinh ra; room rỗng tự biến mất.
2. **Mỗi socket tự động ở trong một room mang tên chính `client.id`** — đó là lý do `server.to(socketId).emit()` hoạt động.
3. **Đặt tên có tiền tố** (`room:1`, `user:42`) để tránh trùng giữa các loại room khác nhau.

Đếm số người trong phòng:

```ts
const sockets = await this.server.in(`room:${roomId}`).fetchSockets();
return { count: sockets.length };
```

---

## 8. Nhận kết quả trả về (acknowledgement)

Có hai cách server phản hồi lại đúng client vừa gửi.

### Cách 1 — `return` giá trị (đơn giản nhất)

```ts
@SubscribeMessage('get-time')
getTime(): { time: string } {
  return { time: new Date().toISOString() };
}
```

```js
// Client — tham số cuối là callback
socket.emit('get-time', null, (res) => console.log(res.time));
```

Dùng khi client cần biết "server đã nhận chưa, kết quả thế nào" — giống HTTP request/response.

### Cách 2 — trả về `WsResponse` để phát ra một sự kiện

```ts
import { WsResponse } from '@nestjs/websockets';

@SubscribeMessage('calculate')
calculate(@MessageBody() n: number): WsResponse<number> {
  return { event: 'calculated', data: n * 2 };
}
```

```js
socket.on('calculated', (result) => console.log(result));   // lắng nghe như sự kiện thường
```

### Cách 3 — trả nhiều lần bằng Observable

```ts
import { Observable, interval, map, take } from 'rxjs';

@SubscribeMessage('countdown')
countdown(): Observable<WsResponse<number>> {
  return interval(1000).pipe(
    take(5),
    map((i) => ({ event: 'tick', data: 5 - i })),
  );
}
```

Client nhận 5 sự kiện `tick` liên tiếp, mỗi giây một cái. Hữu ích cho tiến độ.

---

## 9. Validate dữ liệu đầu vào

Client có thể gửi **bất cứ thứ gì**. Đừng tin dữ liệu từ socket hơn dữ liệu từ HTTP.

```ts
// src/chat/dto/send-message.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  @MaxLength(1000)
  text: string;
}
```

```ts
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@SubscribeMessage('send-message')
send(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  this.server.to(`room:${dto.roomId}`).emit('new-message', {
    from: client.id,
    text: dto.text,
  });
  return { ok: true };
}
```

`ValidationPipe` toàn cục trong `main.ts` **có** áp dụng cho gateway. Nhưng khai báo tường minh như trên vẫn đáng làm, vì đọc code là biết ngay handler này có validate.

### Xử lý lỗi

Trong gateway, ném `WsException` thay vì `HttpException`:

```ts
import { WsException } from '@nestjs/websockets';

if (!allowed) throw new WsException('Bạn không có quyền vào phòng này');
```

Client nhận qua sự kiện `exception`:

```js
socket.on('exception', (err) => console.error(err));
// { status: 'error', message: 'Bạn không có quyền vào phòng này' }
```

Muốn định dạng lại lỗi cho thống nhất:

```ts
// src/chat/ws-exception.filter.ts
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();

    const message =
      exception instanceof WsException
        ? exception.getError()
        : (exception as any)?.message ?? 'Lỗi hệ thống';

    client.emit('exception', { ok: false, message });
  }
}
```

```ts
@UseFilters(new WsExceptionFilter())
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {}
```

---

## 10. Xác thực bằng JWT

Không có xác thực thì bất kỳ ai cũng kết nối và gửi tin được. Kiểm tra **ngay lúc kết nối**, đừng đợi message đầu tiên.

```ts
async handleConnection(client: Socket) {
  try {
    const token =
      client.handshake.auth?.token ??
      client.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new Error('Thiếu token');

    const payload = await this.jwtService.verifyAsync(token);

    // Lưu thông tin vào client.data để các handler sau dùng
    client.data.userId = payload.sub;
    client.data.username = payload.username;

    // Cho vào room riêng của user -> gửi thông báo cá nhân dễ dàng
    await client.join(`user:${payload.sub}`);

    this.logger.log(`User ${payload.sub} kết nối (${client.id})`);
  } catch (err) {
    this.logger.warn(`Từ chối kết nối ${client.id}: ${(err as Error).message}`);
    client.emit('exception', { message: 'Xác thực thất bại' });
    client.disconnect(true);          // ngắt ngay
  }
}
```

Các handler sau đọc `client.data`:

```ts
@SubscribeMessage('send-message')
send(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  this.server.to(`room:${dto.roomId}`).emit('new-message', {
    userId: client.data.userId,       // ✅ tin cậy được, lấy từ token
    username: client.data.username,
    text: dto.text,
  });
}
```

> ⚠️ **Không bao giờ tin `userId` do client gửi trong payload.** Luôn lấy từ `client.data` — thứ được gán từ token đã xác thực. Đây là lỗi bảo mật phổ biến nhất khi làm WebSocket.

Client gửi token:

```js
const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('accessToken') },
});
```

### Guard cho WebSocket

Cách trên đủ cho hầu hết trường hợp. Nếu muốn tách ra guard:

```ts
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const client = ctx.switchToWs().getClient<Socket>();
    if (client.data.userId) return true;              // đã xác thực lúc connect
    throw new WsException('Chưa đăng nhập');
  }
}
```

```ts
@UseGuards(WsJwtGuard)
@SubscribeMessage('send-message')
send() {}
```

---

## 11. Gửi thông báo từ Service (không phải từ gateway)

Đây là nhu cầu thực tế nhất: **ai đó bình luận bài viết qua REST API, và bạn muốn đẩy thông báo realtime cho tác giả.**

```ts
// src/notifications/notification.gateway.ts
@WebSocketGateway({ cors: { origin: '*' } })
export class NotificationGateway {
  @WebSocketServer()
  server: Server;

  /** Hàm public để service khác gọi */
  sendToUser(userId: number, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  sendToAll(event: string, data: unknown) {
    this.server.emit(event, data);
  }
}
```

```ts
// src/notifications/notifications.module.ts
@Module({
  providers: [NotificationGateway],
  exports: [NotificationGateway],     // ⚠️ nhớ export
})
export class NotificationsModule {}
```

```ts
// src/comments/comments.service.ts
@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly repo: Repository<Comment>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  async create(dto: CreateCommentDto, authorId: number) {
    const comment = await this.repo.save({ ...dto, authorId });
    const post = await this.postsService.findOne(dto.postId);

    // Đẩy realtime cho tác giả bài viết
    this.notificationGateway.sendToUser(post.authorId, 'new-comment', {
      commentId: comment.id,
      postId: post.id,
      preview: comment.content.slice(0, 80),
    });

    return comment;
  }
}
```

Nhớ `imports: [NotificationsModule]` trong `CommentsModule`.

> Cách này hoạt động tốt khi chạy **một** instance. Chạy nhiều instance thì tin chỉ tới được người đang nối vào đúng instance đó — cần Redis adapter, xem [nang-cao/08 mục 4](./nang-cao/08-realtime-websocket-sse.md).

---

## 12. SSE — lựa chọn nhẹ hơn cho một chiều

Nếu server chỉ **đẩy xuống** mà client không cần gửi lên, SSE đơn giản hơn hẳn và NestJS hỗ trợ sẵn.

```ts
import { Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';

@Controller('notifications')
export class NotificationsController {
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(3000).pipe(
      map(() => ({ data: { time: new Date().toISOString() } })),
    );
  }
}
```

```js
// Client — không cần thư viện gì
const es = new EventSource('/api/notifications/stream');
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

| | WebSocket | SSE |
|---|---|---|
| Chiều | Hai chiều | Chỉ server → client |
| Thư viện client | socket.io-client | **Không cần** |
| Tự kết nối lại | socket.io lo | **Trình duyệt tự lo** |
| Qua proxy/firewall | Đôi khi bị chặn | Luôn qua được |

Với thông báo, tiến độ job, cập nhật trạng thái → **chọn SSE**.

---

## 13. Ví dụ hoàn chỉnh: phòng chat

Gộp tất cả lại thành một gateway chạy được.

```ts
// src/chat/chat.gateway.ts
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { SendMessageDto } from './dto/send-message.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { WsExceptionFilter } from './ws-exception.filter';

@UseFilters(new WsExceptionFilter())
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? '*' },
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
      const token = client.handshake.auth?.token;
      const payload = await this.jwt.verifyAsync(token);

      client.data.userId = payload.sub;
      client.data.username = payload.username;
      await client.join(`user:${payload.sub}`);

      client.emit('connected', { userId: payload.sub });
      this.logger.log(`User ${payload.sub} vào (${client.id})`);
    } catch {
      client.emit('exception', { message: 'Xác thực thất bại' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`User ${client.data?.userId ?? '?'} rời (${client.id})`);
  }

  @SubscribeMessage('join-room')
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() dto: JoinRoomDto) {
    const allowed = await this.chatService.canAccess(client.data.userId, dto.roomId);
    if (!allowed) throw new WsException('Bạn không có quyền vào phòng này');

    await client.join(`room:${dto.roomId}`);

    client.to(`room:${dto.roomId}`).emit('user-joined', {
      userId: client.data.userId,
      username: client.data.username,
    });

    const history = await this.chatService.getRecentMessages(dto.roomId, 50);
    return { ok: true, history };
  }

  @SubscribeMessage('send-message')
  async send(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
    if (!client.rooms.has(`room:${dto.roomId}`)) {
      throw new WsException('Bạn chưa vào phòng này');
    }

    // Lưu DB trước, rồi mới phát — để ai vào sau vẫn đọc được
    const message = await this.chatService.create({
      roomId: dto.roomId,
      userId: client.data.userId,
      text: dto.text,
    });

    this.server.to(`room:${dto.roomId}`).emit('new-message', {
      id: message.id,
      userId: client.data.userId,
      username: client.data.username,
      text: message.text,
      createdAt: message.createdAt,
    });

    return { ok: true, id: message.id };
  }

  @SubscribeMessage('typing')
  typing(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    // Trạng thái tạm thời -> không lưu DB, không gửi lại cho chính mình
    client.to(`room:${roomId}`).emit('user-typing', {
      userId: client.data.userId,
      username: client.data.username,
    });
  }
}
```

Hai chi tiết đáng chú ý:

- **Kiểm tra `client.rooms.has(...)` trước khi gửi** — client có thể gửi `roomId` bất kỳ mà không cần join.
- **Lưu DB trước khi phát** — nếu chỉ phát qua socket, người vào sau sẽ không thấy tin nhắn cũ.

---

## 14. Lỗi thường gặp

| Triệu chứng | Nguyên nhân |
|---|---|
| Client không kết nối được, lỗi CORS | Thiếu `cors` trong `@WebSocketGateway({ cors: {...} })`. CORS của HTTP **không** áp dụng cho WS |
| `this.server` là `undefined` | Thiếu `@WebSocketServer()`, hoặc gọi nó trong constructor (lúc đó chưa được gán) |
| Gateway không nhận message nào | Quên khai báo gateway trong `providers`, hoặc tên sự kiện không khớp chính xác |
| Handler chạy nhưng client không nhận | Nhầm `client.emit` (chỉ người gửi) với `server.emit` (tất cả). Xem lại mục 6 |
| Chỉ một số người nhận được tin | Đang chạy nhiều instance mà chưa có Redis adapter |
| Client tự ngắt sau ~60 giây | Proxy/nginx đóng kết nối idle — cấu hình `proxy_read_timeout` |
| Kết nối lại liên tục | Sai `transports`, hoặc load balancer không sticky khi dùng polling |
| Không nhận lỗi validation | Client chưa lắng nghe sự kiện `exception` |

### Bật log để debug

```js
// Client
localStorage.debug = '*';     // rồi tải lại trang, xem console
```

```ts
// Server — liệt kê mọi kết nối và phòng hiện có
@SubscribeMessage('debug')
async debug() {
  const sockets = await this.server.fetchSockets();
  return {
    connections: sockets.length,
    rooms: [...this.server.sockets.adapter.rooms.keys()],
  };
}
```

---

## 15. Bài tập

1. Tạo `ChatGateway` với sự kiện `ping`, test bằng `public/test.html`, xác nhận nhận được phản hồi.
2. Cài `handleConnection` / `handleDisconnect` có log. Mở và đóng 3 tab, quan sát log.
3. **Phân biệt 4 cách gửi:** mở 2 tab, thử lần lượt `client.emit`, `server.emit`, `client.broadcast.emit` và ghi lại tab nào nhận được gì.
4. Cài `join-room` / `leave-room` / `room-message`. Mở 3 tab, cho 2 tab vào cùng phòng, xác nhận tab thứ 3 **không** nhận được tin.
5. Thêm `SendMessageDto` có `@MaxLength(1000)`. Gửi chuỗi 2000 ký tự và xác nhận client nhận được sự kiện `exception`.
6. Cài `WsExceptionFilter`, đổi format lỗi thành `{ ok: false, message }`.
7. Thêm xác thực JWT lúc `handleConnection`. Thử kết nối **không có token** → phải bị ngắt ngay.
8. Chứng minh lỗ hổng: cho handler tin `userId` do client gửi, rồi giả mạo `userId` của người khác. Sau đó sửa lại dùng `client.data.userId`.
9. Cài `NotificationGateway` có `sendToUser()`. Gọi REST API `POST /comments` và xác nhận tác giả bài viết nhận được thông báo realtime.
10. Cài chỉ báo "đang gõ…" bằng sự kiện `typing` (không lưu DB, không gửi lại cho chính mình).
11. Làm lại bài 9 bằng **SSE** thay vì WebSocket. So sánh lượng code hai bên.
12. Lưu tin nhắn vào DB, khi `join-room` thì trả về 50 tin gần nhất. Tải lại trang và xác nhận vẫn thấy lịch sử.

---

<details>
<summary>Gợi ý đáp án</summary>

**1–2. Gateway, `ping`, vòng đời kết nối.**

```ts
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('ChatGateway');

  handleConnection(client: Socket) {
    this.logger.log(`+ ${client.id} (tổng ${this.server.engine.clientsCount})`);
  }
  handleDisconnect(client: Socket) {
    this.logger.log(`- ${client.id}`);
  }

  @SubscribeMessage('ping')
  ping(@MessageBody() data: unknown) {
    return { event: 'pong', data };        // return = gửi ack riêng cho client gọi
  }
}
```

Mở/đóng 3 tab cho log tăng rồi giảm đúng 3 lần. Nếu đóng tab mà `handleDisconnect` không chạy ngay:
Socket.IO đợi hết `pingTimeout` (mặc định 20 giây) mới coi là mất kết nối.

**3. Bốn cách gửi — mở 2 tab A và B, thao tác từ A:**

| Lệnh | A nhận | B nhận |
|---|:--:|:--:|
| `client.emit('x')` | ✅ | ❌ |
| `server.emit('x')` | ✅ | ✅ |
| `client.broadcast.emit('x')` | ❌ | ✅ |
| `server.to('phong1').emit('x')` | chỉ khi A trong phòng | chỉ khi B trong phòng |

Nhớ theo một câu: **`client.` là "người gọi", `server.` là "tất cả", `broadcast` là "trừ người gọi"**.
Dùng nhầm `server.emit` cho tin nhắn chat làm người gửi nhận lại tin của chính mình và tin bị nhân đôi
trên giao diện.

**4. Phòng.**

```ts
@SubscribeMessage('join-room')
join(@ConnectedSocket() client: Socket, @MessageBody('room') room: string) {
  client.join(room);
  client.to(room).emit('user-joined', { id: client.id });   // báo người CŨ trong phòng
  return { ok: true, room };
}

@SubscribeMessage('leave-room')
leave(@ConnectedSocket() client: Socket, @MessageBody('room') room: string) {
  client.leave(room);
}

@SubscribeMessage('room-message')
roomMessage(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  this.server.to(dto.room).emit('room-message', { text: dto.text, from: client.data.userId });
}
```

Tab 1 và 2 vào `phong-a`, tab 3 không vào: tab 3 **không** nhận `room-message`. Mỗi socket luôn tự
động ở trong một phòng mang tên chính `client.id` — đó là cách `sendToUser()` ở bài 9 hoạt động.

**5–6. Validate và filter cho WebSocket.**

```ts
// main.ts — ValidationPipe của HTTP KHÔNG tự áp cho gateway
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

Với gateway phải khai riêng:

```ts
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseFilters(new WsExceptionFilter())
@WebSocketGateway()
export class ChatGateway { ... }
```

```ts
export class SendMessageDto {
  @IsString() @MaxLength(1000) text: string;
  @IsString() room: string;
}
```

Gửi chuỗi 2000 ký tự, client nhận sự kiện `exception`:

```json
{ "status": "error", "message": ["text must be shorter than or equal to 1000 characters"] }
```

```ts
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const message = exception instanceof WsException || exception instanceof HttpException
      ? (exception as any).message
      : 'Lỗi hệ thống';
    client.emit('error', { ok: false, message });
  }
}
```

Khác biệt cốt lõi với HTTP: **không có response để trả mã lỗi**. Lỗi phải được `emit` ngược về client
như một sự kiện, và client phải chủ động lắng nghe nó — quên `socket.on('error')` là lỗi biến mất
không dấu vết.

**7–8. Xác thực và lỗ hổng giả mạo `userId`.**

```ts
async handleConnection(client: Socket) {
  try {
    const token = client.handshake.auth?.token;             // KHÔNG lấy từ query string
    const payload = await this.jwt.verifyAsync(token);
    client.data.userId = payload.sub;                       // gắn vào server-side state
    client.join(`user:${payload.sub}`);
  } catch {
    client.emit('error', { message: 'Token không hợp lệ' });
    client.disconnect(true);                                // ngắt NGAY
  }
}
```

Kết nối không token bị ngắt trước khi gửi được message nào.

**Lỗ hổng ở bài 8:**

```ts
// ❌ SAI — tin userId do client gửi
@SubscribeMessage('send')
send(@MessageBody() dto: { userId: number; text: string }) {
  this.server.emit('msg', { from: dto.userId, text: dto.text });
}
```

Mở DevTools và gõ `socket.emit('send', { userId: 1, text: 'chuyển tiền đi' })` là mạo danh được user 1.
Đây là cùng một loại lỗi với việc tin `req.body.userId` ở REST.

```ts
// ✅ ĐÚNG — lấy từ dữ liệu server tự gắn lúc xác thực
send(@ConnectedSocket() client: Socket, @MessageBody() dto: SendMessageDto) {
  this.server.emit('msg', { from: client.data.userId, text: dto.text });
}
```

Nguyên tắc: **danh tính luôn lấy từ `client.data`, không bao giờ từ payload**.

**9. `NotificationGateway.sendToUser()` gọi từ REST.**

```ts
@Injectable()
@WebSocketGateway()
export class NotificationGateway {
  @WebSocketServer() server: Server;

  sendToUser(userId: number, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
```

```ts
// comments.service.ts
async create(dto: CreateCommentDto, user: User) {
  const comment = await this.repo.save({ ...dto, authorId: user.id });
  const post = await this.postsService.findOne(dto.postId);
  if (post.authorId !== user.id) {
    this.notifications.sendToUser(post.authorId, 'new-comment', { postId: post.id });
  }
  return comment;
}
```

Gateway là một provider bình thường, `exports` ra là service HTTP inject vào được. Gửi theo phòng
`user:<id>` chứ không lưu map `userId -> socketId`: một user mở 3 tab vẫn nhận đủ ở cả ba.

**10. Chỉ báo đang gõ.**

```ts
@SubscribeMessage('typing')
typing(@ConnectedSocket() client: Socket, @MessageBody('room') room: string) {
  client.to(room).emit('typing', { userId: client.data.userId });   // client.to = trừ chính mình
}
```

Không lưu DB, không ack. Phía client nên `debounce` khoảng 300ms và tự ẩn sau 3 giây không có tin mới —
không có sự kiện "hết gõ" nào đáng tin, vì người dùng có thể đóng tab giữa chừng.

**11. Làm lại bài 9 bằng SSE.**

```ts
@Sse('notifications')
notifications(@CurrentUser() user: User): Observable<MessageEvent> {
  return this.notificationsService.streamFor(user.id).pipe(
    map((data) => ({ data }) as MessageEvent),
  );
}
```

```js
const es = new EventSource('/notifications', { withCredentials: true });
es.onmessage = (e) => console.log(JSON.parse(e.data));
```

**So sánh:** SSE ít hơn khoảng 2/3 lượng code — không cần thư viện client, không cần gateway, trình
duyệt **tự kết nối lại** khi đứt. Đổi lại nó **một chiều** (server → client) và mỗi kết nối chiếm một
HTTP connection.

Quy tắc chọn: chỉ đẩy thông báo xuống thì dùng SSE; cần client gửi lên liên tục (chat, game, con trỏ
cộng tác) thì dùng WebSocket.

**12. Lưu lịch sử và trả 50 tin gần nhất.**

```ts
@SubscribeMessage('join-room')
async join(@ConnectedSocket() client: Socket, @MessageBody('room') room: string) {
  client.join(room);
  const lichSu = await this.messagesRepo.find({
    where: { room },
    order: { id: 'DESC' },
    take: 50,
  });
  client.emit('history', lichSu.reverse());     // đảo lại cho đúng thứ tự thời gian
}
```

Lấy `ORDER BY id DESC LIMIT 50` rồi `reverse()` trong bộ nhớ — chứ không `ASC` rồi lấy 50 đầu, vì cách
sau trả về 50 tin **cũ nhất**. Với bảng lớn, thêm index `(room, id)` để truy vấn này không quét bảng.

</details>

## Tiếp theo

Khi ứng dụng chạy nhiều instance hoặc có hàng nghìn kết nối:

👉 [nang-cao/08 — Realtime ở quy mô lớn](./nang-cao/08-realtime-websocket-sse.md): Redis adapter, giới hạn kết nối mỗi user, rate limit message, cấu hình nginx, đo RAM mỗi kết nối, gom message trước khi phát.
