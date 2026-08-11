# Bài 9 — Microservices

Cảnh báo trước: **microservices giải quyết vấn đề tổ chức, không phải vấn đề kỹ thuật.** Nếu team dưới 10 người, monolith có cấu trúc tốt ([bài 01](./01-kien-truc-quy-mo-lon.md)) gần như luôn là lựa chọn đúng hơn.

Bài này giúp bạn (a) làm đúng khi thật sự cần, và (b) hiểu đủ để từ chối khi chưa cần.

---

## 1. Cái giá phải trả

Chuyển từ 1 service sang 5 service, bạn đánh đổi:

| Việc | Monolith | Microservices |
|---|---|---|
| Gọi hàm module khác | Gọi trực tiếp, 0.001ms, không bao giờ lỗi | Qua mạng, 5–50ms, **có thể lỗi** |
| Transaction nhiều bảng | `BEGIN ... COMMIT` | Saga + bù trừ ([bài 07](./07-cqrs-event-outbox.md)) |
| Sửa một tính năng | Sửa 1 repo, deploy 1 lần | Sửa 3 repo, phối hợp deploy |
| Truy vết một bug | Đọc 1 stack trace | Ghép log 5 service ([bài 10](./10-observability-benchmark.md)) |
| Chạy local | `npm run start:dev` | Docker Compose 8 container |
| Test end-to-end | Dễ | Rất khó |

**Chỉ tách khi:** nhiều team cần deploy độc lập, một phần cần scale khác hẳn phần còn lại (vd: xử lý video), hoặc yêu cầu cách ly về tuân thủ/bảo mật.

**Chưa đủ lý do:** "cho hiện đại", "để scale sau này", "mọi người đều làm vậy".

---

## 2. Transport — chọn cái nào

```bash
npm i @nestjs/microservices
```

| Transport | Độ trễ | Dùng khi | Nhược điểm |
|---|---|---|---|
| **TCP** | Thấp nhất | Nội bộ, ít service | Không có buffer, service chết là mất request |
| **Redis** | Thấp | Đã có Redis, pub/sub đơn giản | Không đảm bảo gửi tới |
| **RabbitMQ** | Trung bình | **Mặc định tốt** — có queue, ack, retry, DLQ | Thêm hạ tầng |
| **Kafka** | Trung bình | Throughput rất lớn, cần lưu lại luồng sự kiện | Vận hành phức tạp |
| **gRPC** | Thấp | Hợp đồng chặt, đa ngôn ngữ, streaming | Cần định nghĩa `.proto` |

Lời khuyên: **bắt đầu với RabbitMQ.** Nó có đầy đủ đảm bảo cần thiết mà không phức tạp như Kafka.

---

## 3. Message pattern vs Event pattern

Đây là phân biệt quan trọng nhất của bài.

```ts
// REQUEST-RESPONSE: gửi và CHỜ kết quả
@MessagePattern({ cmd: 'get-user' })
getUser(@Payload() id: number) {
  return this.usersService.findOne(id);   // giá trị này quay về bên gọi
}

// EVENT: bắn và QUÊN, không chờ, không có kết quả
@EventPattern('order.created')
async handleOrderCreated(@Payload() data: OrderCreatedEvent) {
  await this.inventory.reserve(data);     // không ai chờ hàm này
}
```

| | `@MessagePattern` | `@EventPattern` |
|---|---|---|
| Bên gọi | Chờ kết quả | Không chờ |
| Ghép nối | **Chặt** — bên kia chết là bạn lỗi | **Lỏng** — bên kia chết vẫn OK |
| Số bên nhận | Một | Nhiều |
| Dùng cho | Cần dữ liệu để tiếp tục | Thông báo việc đã xảy ra |

> **Nguyên tắc:** ưu tiên `@EventPattern` bất cứ khi nào có thể. Mỗi lời gọi request-response là một sợi dây buộc hai service lại với nhau — chuỗi 5 lời gọi đồng bộ nghĩa là chỉ cần một service chậm là cả chuỗi timeout.

---

## 4. Dựng một microservice

### Bên nhận

```ts
// apps/inventory/src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    InventoryModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: 'inventory_queue',
        queueOptions: { durable: true },   // queue sống sót qua restart broker
        noAck: false,                      // BẮT BUỘC: tự ack sau khi xử lý xong
        prefetchCount: 10,                 // mỗi consumer giữ tối đa 10 message
      },
    },
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen();
}
bootstrap();
```

`noAck: false` + `prefetchCount` là hai tham số quyết định độ tin cậy và khả năng điều tiết tải:

- `noAck: false` — message chỉ bị xoá khỏi queue **sau khi** xử lý xong. Service chết giữa chừng → message quay lại queue.
- `prefetchCount: 10` — không cho một consumer ôm 1000 message rồi chết. Đây chính là backpressure ở tầng message.

### Xử lý ack thủ công

```ts
@EventPattern('order.created')
async handle(@Payload() data: OrderCreatedEvent, @Ctx() ctx: RmqContext) {
  const channel = ctx.getChannelRef();
  const message = ctx.getMessage();

  try {
    await this.inventory.reserve(data);
    channel.ack(message);                      // xong -> xoá khỏi queue
  } catch (err) {
    if (this.isPermanent(err)) {
      channel.nack(message, false, false);     // lỗi vĩnh viễn -> đẩy sang DLQ
    } else {
      channel.nack(message, false, true);      // lỗi tạm thời -> trả lại queue
    }
  }
}
```

> ⚠️ `nack(..., requeue: true)` với lỗi vĩnh viễn tạo **vòng lặp vô tận**: message quay lại, lỗi tiếp, quay lại... làm nghẽn queue và đốt CPU. Luôn phân biệt hai loại lỗi.

### Bên gọi

```ts
ClientsModule.registerAsync([
  {
    name: 'INVENTORY_SERVICE',
    inject: [ConfigService],
    useFactory: (c: ConfigService) => ({
      transport: Transport.RMQ,
      options: {
        urls: [c.getOrThrow('RABBITMQ_URL')],
        queue: 'inventory_queue',
        queueOptions: { durable: true },
      },
    }),
  },
])
```

```ts
@Injectable()
export class OrdersService {
  constructor(@Inject('INVENTORY_SERVICE') private readonly client: ClientProxy) {}

  // Không chờ kết quả
  async createOrder(dto: CreateOrderDto) {
    const order = await this.repo.save(dto);
    this.client.emit('order.created', { orderId: order.id, items: dto.items });
    return order;
  }

  // Chờ kết quả — LUÔN phải có timeout
  async checkStock(productId: number): Promise<number> {
    return firstValueFrom(
      this.client.send<number>({ cmd: 'check-stock' }, { productId }).pipe(
        timeout(3_000),
        catchError((err) => {
          this.logger.error(`Gọi inventory lỗi: ${err.message}`);
          return throwError(() => new ServiceUnavailableException(
            'Dịch vụ kho hàng tạm thời không khả dụng',
          ));
        }),
      ),
    );
  }
}
```

**Không bao giờ gọi `send()` mà không có `timeout()`.** Thiếu nó, một service treo sẽ giữ request của bạn vĩnh viễn cho tới khi hết pool.

### Hybrid app — vừa HTTP vừa microservice

```ts
const app = await NestFactory.create(AppModule);

app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: { urls: [process.env.RABBITMQ_URL], queue: 'orders_queue' },
});

await app.startAllMicroservices();
await app.listen(3000);
```

Rất hữu ích ở giai đoạn chuyển tiếp: service vừa phục vụ REST cho frontend, vừa nhận event từ các service khác.

---

## 5. Vấn đề của giao tiếp đồng bộ chuỗi

```
API Gateway → Orders → Inventory → Pricing → Tax
    (mỗi bước 50ms, mỗi bước có 0.1% khả năng lỗi)
```

Độ khả dụng nhân lên: `99.9%^4 = 99.6%` → gấp 4 lần thời gian chết.
Độ trễ cộng dồn: 200ms trong điều kiện lý tưởng, và **mọi** bước đều có thể timeout.

### Cách sửa 1: song song hoá

```ts
// ❌ Tuần tự: 150ms
const user = await firstValueFrom(this.users.send({ cmd: 'get' }, id));
const prefs = await firstValueFrom(this.prefs.send({ cmd: 'get' }, id));
const stats = await firstValueFrom(this.stats.send({ cmd: 'get' }, id));

// ✅ Song song: 50ms
const [user, prefs, stats] = await Promise.all([
  firstValueFrom(this.users.send({ cmd: 'get' }, id).pipe(timeout(2000))),
  firstValueFrom(this.prefs.send({ cmd: 'get' }, id).pipe(timeout(2000))),
  firstValueFrom(this.stats.send({ cmd: 'get' }, id).pipe(timeout(2000))),
]);
```

### Cách sửa 2: suy giảm mềm (graceful degradation)

Không phải dữ liệu nào cũng bắt buộc. Thiếu phần phụ thì trả về phần chính:

```ts
const [user, recommendations] = await Promise.all([
  firstValueFrom(this.users.send({ cmd: 'get' }, id).pipe(timeout(2000))),   // bắt buộc
  firstValueFrom(
    this.recs.send({ cmd: 'for-user' }, id).pipe(
      timeout(500),
      catchError(() => of([])),      // gợi ý lỗi -> trả mảng rỗng, trang vẫn hiển thị
    ),
  ),
]);
```

### Cách sửa 3: bỏ hẳn lời gọi đồng bộ

Nếu Orders cần biết tên sản phẩm, thay vì gọi Products mỗi lần, hãy **lưu bản sao** tên sản phẩm khi đặt hàng (nó vốn nên là ảnh chụp tại thời điểm mua). Không lời gọi = không lỗi.

---

## 6. API Gateway

Frontend không nên biết về 8 service. Đặt một gateway phía trước:

```ts
@Controller('orders')
export class OrdersGatewayController {
  constructor(
    @Inject('ORDERS_SERVICE') private readonly orders: ClientProxy,
    @Inject('USERS_SERVICE') private readonly users: ClientProxy,
  ) {}

  @Get(':id')
  async getOrderDetail(@Param('id', ParseIntPipe) id: number) {
    const order = await firstValueFrom(
      this.orders.send({ cmd: 'get-order' }, id).pipe(timeout(3000)),
    );

    // Gộp dữ liệu từ nhiều service thành một response cho client
    const user = await firstValueFrom(
      this.users.send({ cmd: 'get-user' }, order.userId).pipe(
        timeout(1000),
        catchError(() => of({ id: order.userId, name: 'Không rõ' })),
      ),
    );

    return { ...order, user };
  }
}
```

Gateway là nơi đặt: xác thực, rate limit, gộp dữ liệu, chuyển đổi định dạng, versioning. **Không** đặt business logic ở đây.

---

## 7. Mỗi service một database

Đây là quy tắc cứng, và cũng là phần khó nhất.

```
❌ Orders và Inventory dùng chung DB
   -> đổi schema là phải deploy đồng thời 2 service
   -> không còn là microservice, chỉ là monolith bị chia nhỏ một cách khổ sở

✅ Mỗi service một DB riêng
   -> cần dữ liệu của nhau thì qua API hoặc event
```

Hệ quả bắt buộc phải chấp nhận: **không còn JOIN xuyên service, không còn transaction xuyên service.**

- Cần dữ liệu tổng hợp → dựng read model bằng event ([bài 07 mục 3](./07-cqrs-event-outbox.md)).
- Cần nhất quán xuyên service → Saga ([bài 07 mục 5](./07-cqrs-event-outbox.md)).
- Cần đảm bảo event được gửi → Outbox ([bài 07 mục 4](./07-cqrs-event-outbox.md)).

Ba kỹ thuật đó không phải tuỳ chọn — chúng là **điều kiện cần** để microservices hoạt động đúng.

---

## 8. Health check và service discovery

```ts
// Mỗi service phải trả lời được "tôi còn sống không"
@MessagePattern({ cmd: 'health' })
health() {
  return { status: 'ok', service: 'inventory', uptime: process.uptime() };
}
```

Với Docker Compose / Kubernetes, DNS nội bộ lo phần discovery — dùng tên service làm hostname:

```env
RABBITMQ_URL=amqp://rabbitmq:5672
INVENTORY_URL=http://inventory:3000
```

Đừng hardcode IP, và đừng vội thêm Consul/Eureka khi orchestrator đã làm việc đó.

---

## 9. Chiến lược tách monolith

Đừng viết lại từ đầu. Dùng **Strangler Fig** — bóp nghẹt dần:

```
Bước 1: Monolith có module rõ ràng (bài 01) — mỗi module DB schema riêng
Bước 2: Chọn module ÍT phụ thuộc nhất, đổi mọi lời gọi trực tiếp thành event
Bước 3: Tách module đó ra service riêng, gateway định tuyến sang
Bước 4: Chạy song song, so sánh kết quả, rồi mới bỏ code cũ
Bước 5: Lặp lại với module tiếp theo
```

Ứng viên tách đầu tiên nên là thứ **ít phụ thuộc và dễ đo**: gửi mail, xử lý ảnh, sinh báo cáo, tìm kiếm. Đừng bắt đầu bằng module trung tâm như Orders hay Users.

---

## 10. Bài tập bài 9

1. Dựng RabbitMQ bằng Docker. Tách `NotificationService` thành microservice riêng nhận `@EventPattern('post.published')`.
2. Cài `noAck: false` + ack thủ công. **Tắt service** giữa lúc đang xử lý, bật lại và xác nhận message không bị mất.
3. Cố tình cho một message lỗi vĩnh viễn với `requeue: true`, quan sát vòng lặp vô tận. Sửa bằng `nack(..., false)` + cấu hình DLQ.
4. Gọi `send()` **không có** timeout tới một service đã tắt. Quan sát request treo. Thêm `timeout(3000)` và đo lại.
5. Viết endpoint gọi 3 service tuần tự, đo thời gian. Đổi sang `Promise.all` và so sánh.
6. Cài suy giảm mềm: service gợi ý chậm 5 giây → trang vẫn trả về trong 500ms với mảng rỗng.
7. Dựng API Gateway gộp dữ liệu từ 2 service thành một response.
8. Cài Outbox ở service Orders ([bài 07](./07-cqrs-event-outbox.md)), **tắt RabbitMQ 1 phút**, tạo 20 đơn hàng, bật lại và xác nhận đủ 20 event tới nơi.
9. Cài idempotency ở bên nhận. Gửi trùng cùng một event 5 lần và xác nhận chỉ xử lý 1 lần.
10. Đặt `prefetchCount: 1` rồi `prefetchCount: 100`, bắn 10.000 message và so sánh throughput cùng RAM của consumer.
11. **Bài tập suy nghĩ:** viết một trang giải thích vì sao dự án hiện tại của bạn *chưa* cần microservices, kèm 3 điều kiện cụ thể sẽ khiến bạn đổi ý.

➡️ Tiếp: [10-observability-benchmark.md](./10-observability-benchmark.md)
