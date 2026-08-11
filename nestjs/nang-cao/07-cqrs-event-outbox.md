# Bài 7 — CQRS, Domain Event & Transactional Outbox

Ba kỹ thuật giải quyết ba vấn đề khác nhau nhưng thường đi cùng nhau:

- **CQRS** — tách đường ghi và đường đọc để tối ưu riêng cho từng bên.
- **Domain Event** — gỡ phụ thuộc giữa các module.
- **Outbox** — đảm bảo "đã lưu DB thì chắc chắn event được gửi đi".

---

## 1. Event nội bộ — cách gỡ rối module

### Vấn đề

```ts
@Injectable()
export class PostsService {
  constructor(
    private mail: MailService,           // gửi thông báo
    private search: SearchService,       // đánh index
    private analytics: AnalyticsService, // ghi nhận sự kiện
    private cache: CacheService,         // xoá cache
    private feed: FeedService,           // đẩy lên bảng tin
  ) {}

  async publish(id: number) {
    const post = await this.repo.save({ id, status: 'published' });
    await this.mail.notifyFollowers(post);
    await this.search.index(post);
    await this.analytics.track('post.published', post);
    await this.cache.invalidate(`post:${id}`);
    await this.feed.push(post);
    return post;
  }
}
```

Mỗi tính năng mới lại thêm một dependency. `PostsModule` phải import 5 module. Test `publish()` phải mock 5 thứ. Và nếu `search.index()` lỗi, việc xuất bản cũng lỗi — dù nghiệp vụ chính đã xong.

### Giải pháp: phát event, ai quan tâm thì nghe

```bash
npm i @nestjs/event-emitter
```

```ts
EventEmitterModule.forRoot({
  wildcard: true,           // cho phép nghe 'post.*'
  delimiter: '.',
  maxListeners: 20,
})
```

```ts
// src/posts/events/post-published.event.ts
export class PostPublishedEvent {
  constructor(
    public readonly postId: number,
    public readonly authorId: number,
    public readonly title: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
```

```ts
@Injectable()
export class PostsService {
  constructor(private readonly events: EventEmitter2) {}   // chỉ 1 dependency

  async publish(id: number) {
    const post = await this.repo.save({ id, status: 'published' });

    this.events.emit(
      'post.published',
      new PostPublishedEvent(post.id, post.authorId, post.title),
    );

    return post;      // trả về ngay, không chờ listener
  }
}
```

```ts
// src/search/search.listener.ts — nằm ở module khác hoàn toàn
@Injectable()
export class SearchListener {
  @OnEvent('post.published', { async: true })
  async handle(event: PostPublishedEvent) {
    await this.searchService.index(event.postId);
  }
}
```

`PostsModule` giờ **không biết** `SearchModule` tồn tại. Thêm tính năng mới = thêm một listener, không sửa `PostsService`.

### Ba điều phải nhớ về event nội bộ

1. **`emit()` là đồng bộ theo mặc định.** Listener chạy trên cùng event loop — một listener chậm vẫn làm chậm request. Dùng `{ async: true }` hoặc tốt hơn là đẩy vào queue.

2. **Lỗi trong listener không làm hỏng bên phát**, nhưng cũng **không được nuốt im lặng**:

```ts
@OnEvent('post.published', { async: true })
async handle(event: PostPublishedEvent) {
  try {
    await this.searchService.index(event.postId);
  } catch (err) {
    this.logger.error(`Index thất bại cho post ${event.postId}`, err);
    await this.retryQueue.add('reindex', { postId: event.postId });
  }
}
```

3. **Event nội bộ mất khi process chết.** Nếu việc đó không được phép mất (gửi hoá đơn, trừ tiền), phải dùng Outbox (mục 4).

### Kết hợp event + queue — cách dùng thực tế nhất

```ts
@OnEvent('post.published')
async onPublished(event: PostPublishedEvent) {
  // Listener chỉ làm một việc: đẩy vào queue. Nhanh, khó lỗi.
  await this.queue.add('index-post', { postId: event.postId }, {
    jobId: `index:${event.postId}`,
  });
}
```

Bạn có được sự tách rời của event **và** độ tin cậy của queue.

---

## 2. CQRS — tách lệnh và truy vấn

### Khi nào cần

CQRS **không** dành cho mọi dự án. Nó đáng dùng khi:

- Đường đọc và đường ghi có yêu cầu rất khác nhau (ghi cần validate phức tạp, đọc cần nhanh và gộp nhiều bảng).
- Đọc nhiều gấp hàng chục lần ghi, muốn có bảng đọc riêng đã tính sẵn.
- Nghiệp vụ phức tạp, muốn mỗi thao tác là một class rõ ràng.

Nếu chỉ là CRUD, CQRS chỉ làm code dài ra vô ích.

```bash
npm i @nestjs/cqrs
```

### Command — thay đổi trạng thái

```ts
// src/posts/commands/publish-post.command.ts
export class PublishPostCommand {
  constructor(
    public readonly postId: number,
    public readonly userId: number,
  ) {}
}
```

```ts
// src/posts/commands/publish-post.handler.ts
import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';

@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepositoryPort,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: PublishPostCommand): Promise<void> {
    const post = await this.posts.findById(cmd.postId);
    if (!post) throw new NotFoundException();
    if (!post.isOwnedBy(cmd.userId)) throw new ForbiddenException();

    post.publish(new Date());
    await this.posts.save(post);

    // Phát event đã tích luỹ trong aggregate
    this.publisher.mergeObjectContext(post).commit();
  }
}
```

### Query — chỉ đọc, được phép "gian lận"

```ts
export class GetPostFeedQuery {
  constructor(public readonly userId: number, public readonly limit = 20) {}
}

@QueryHandler(GetPostFeedQuery)
export class GetPostFeedHandler implements IQueryHandler<GetPostFeedQuery> {
  constructor(private readonly dataSource: DataSource) {}

  async execute(q: GetPostFeedQuery) {
    // Đường đọc KHÔNG cần đi qua domain model, repository hay entity.
    // Raw SQL vào bảng đã tối ưu sẵn là hoàn toàn hợp lệ.
    return this.dataSource.query(
      `SELECT id, title, author_name, comment_count, published_at
       FROM post_feed_view
       WHERE follower_id = $1
       ORDER BY published_at DESC
       LIMIT $2`,
      [q.userId, q.limit],
    );
  }
}
```

> Đây là giá trị thật của CQRS: **đường đọc được tự do tối ưu** mà không phá vỡ tính đúng đắn của đường ghi. Bảng `post_feed_view` có thể là materialized view, bảng phi chuẩn hoá, hay thậm chí Elasticsearch.

### Controller

```ts
@Controller('posts')
export class PostsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/publish')
  publish(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
    return this.commandBus.execute(new PublishPostCommand(id, userId));
  }

  @Get('feed')
  feed(@CurrentUser('id') userId: number, @Query('limit') limit?: number) {
    return this.queryBus.execute(new GetPostFeedQuery(userId, limit));
  }
}
```

### Module

```ts
@Module({
  imports: [CqrsModule],
  controllers: [PostsController],
  providers: [PublishPostHandler, GetPostFeedHandler, PostPublishedHandler],
})
export class PostsModule {}
```

---

## 3. Bảng đọc (read model) cập nhật bằng event

Đây là chỗ CQRS phát huy giá trị lớn nhất với dữ liệu lớn.

Thay vì mỗi lần đọc bảng tin phải JOIN 5 bảng và đếm bình luận (query 800ms), ta duy trì sẵn một bảng phẳng:

```sql
CREATE TABLE post_feed_view (
  id            bigint PRIMARY KEY,
  follower_id   bigint NOT NULL,
  title         text NOT NULL,
  author_name   text NOT NULL,
  comment_count int DEFAULT 0,
  published_at  timestamptz NOT NULL
);
CREATE INDEX idx_feed ON post_feed_view (follower_id, published_at DESC);
```

Cập nhật bằng event handler:

```ts
@EventsHandler(PostPublishedEvent)
export class UpdateFeedOnPublish implements IEventHandler<PostPublishedEvent> {
  constructor(@InjectQueue('projection') private readonly queue: Queue) {}

  async handle(event: PostPublishedEvent) {
    // Fan-out cho hàng triệu follower là việc nặng -> đẩy vào queue
    await this.queue.add('fanout-feed', { postId: event.postId });
  }
}
```

Đọc bảng tin giờ là một `SELECT` có index — **dưới 5ms** thay vì 800ms.

### Cái giá phải trả

Read model **nhất quán cuối cùng** (eventual consistency): có độ trễ vài trăm mili-giây tới vài giây giữa lúc ghi và lúc bảng đọc cập nhật.

Chấp nhận được với: bảng tin, thống kê, kết quả tìm kiếm, danh sách.
**Không** chấp nhận được với: số dư tài khoản, tồn kho lúc thanh toán, quyền hạn.

Luôn có cách dựng lại read model từ đầu (replay), vì nó **sẽ** lệch:

```ts
@Cron('0 4 * * *')
async rebuildFeedView() {
  // Dựng lại từ nguồn sự thật, chạy lúc tải thấp
}
```

---

## 4. Transactional Outbox — vấn đề "dual write"

### Vấn đề

```ts
await this.repo.save(order);                    // ① DB thành công
await this.kafka.emit('order.created', order);  // ② Kafka chết -> event mất VĨNH VIỄN
```

Đơn hàng có trong DB nhưng kho hàng không bao giờ biết. Đảo thứ tự cũng không cứu được: gửi event xong rồi DB lỗi → event nói về đơn hàng không tồn tại.

Không thể có transaction chung giữa DB và message broker. Outbox giải quyết bằng cách **ghi event vào chính DB đó**, trong **cùng transaction**.

### Cài đặt

```sql
CREATE TABLE outbox (
  id            bigserial PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id  text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz,
  attempts      int NOT NULL DEFAULT 0
);
-- Index chỉ trên phần chưa gửi -> luôn nhỏ dù bảng có triệu dòng
CREATE INDEX idx_outbox_pending ON outbox (id) WHERE published_at IS NULL;
```

```ts
// Ghi nghiệp vụ + event trong CÙNG một transaction
async createOrder(dto: CreateOrderDto) {
  return this.dataSource.transaction(async (m) => {
    const order = await m.save(Order, dto);

    await m.save(OutboxEntity, {
      aggregateType: 'order',
      aggregateId: String(order.id),
      eventType: 'order.created',
      payload: { orderId: order.id, userId: order.userId, total: order.total },
    });

    return order;
    // Commit -> CẢ HAI cùng có. Rollback -> CẢ HAI cùng không.
  });
}
```

### Bộ phát (relay)

```ts
@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publish() {
    await this.dataSource.transaction(async (m) => {
      // SKIP LOCKED: nhiều instance chạy song song mà không tranh nhau cùng dòng
      const rows: OutboxEntity[] = await m.query(`
        SELECT * FROM outbox
        WHERE published_at IS NULL AND attempts < 10
        ORDER BY id
        LIMIT 100
        FOR UPDATE SKIP LOCKED
      `);

      for (const row of rows) {
        try {
          await this.broker.emit(row.event_type, row.payload);
          await m.query(`UPDATE outbox SET published_at = now() WHERE id = $1`, [row.id]);
        } catch (err) {
          await m.query(`UPDATE outbox SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
          this.logger.error(`Gửi outbox ${row.id} lỗi (lần ${row.attempts + 1})`, err);
        }
      }
    });
  }

  @Cron('0 * * * *')
  async cleanup() {
    await this.dataSource.query(
      `DELETE FROM outbox WHERE published_at < now() - interval '7 days'`,
    );
  }
}
```

`FOR UPDATE SKIP LOCKED` là chi tiết then chốt — nó cho phép chạy nhiều relay song song mà không gửi trùng.

### Đảm bảo gì và không đảm bảo gì

Outbox cho **at-least-once**: event chắc chắn được gửi, nhưng **có thể gửi nhiều lần** (relay gửi xong rồi chết trước khi kịp `UPDATE`).

Vì vậy **bên nhận bắt buộc phải idempotent** ([bài 05 mục 5](./05-queue-va-job-nen.md)):

```ts
@EventPattern('order.created')
async handle(@Payload() event: OrderCreatedEvent) {
  const inserted = await this.dataSource.query(
    `INSERT INTO processed_events (event_id) VALUES ($1)
     ON CONFLICT DO NOTHING RETURNING event_id`,
    [event.eventId],
  );
  if (!inserted.length) return;    // đã xử lý rồi

  await this.inventory.reserve(event);
}
```

---

## 5. Saga — điều phối quy trình nhiều bước

Khi một nghiệp vụ trải qua nhiều dịch vụ và **không thể** dùng transaction chung, dùng saga: chuỗi bước, mỗi bước có hành động bù trừ khi lỗi.

```
Đặt hàng → Giữ hàng → Thanh toán → Giao hàng
              ↓ lỗi        ↓ lỗi
         (trả hàng về) (hoàn tiền + trả hàng)
```

### Saga bằng `@nestjs/cqrs`

```ts
@Injectable()
export class OrderSaga {
  @Saga()
  orderCreated = (events$: Observable<any>): Observable<ICommand> =>
    events$.pipe(
      ofType(OrderCreatedEvent),
      map((e) => new ReserveInventoryCommand(e.orderId, e.items)),
    );

  @Saga()
  inventoryReserved = (events$: Observable<any>): Observable<ICommand> =>
    events$.pipe(
      ofType(InventoryReservedEvent),
      map((e) => new ChargePaymentCommand(e.orderId, e.amount)),
    );

  @Saga()
  paymentFailed = (events$: Observable<any>): Observable<ICommand> =>
    events$.pipe(
      ofType(PaymentFailedEvent),
      map((e) => new ReleaseInventoryCommand(e.orderId)),   // bù trừ
    );
}
```

### Với quy trình dài, dùng state machine tường minh

Saga theo kiểu event chaining khó gỡ lỗi khi có 8 bước. Lúc đó lưu trạng thái vào bảng:

```sql
CREATE TABLE order_saga (
  order_id bigint PRIMARY KEY,
  step     text NOT NULL,       -- created | inventory_reserved | paid | shipped | compensating | failed
  data     jsonb,
  updated_at timestamptz DEFAULT now()
);
```

Bạn luôn trả lời được "đơn hàng này đang kẹt ở bước nào" — điều gần như không thể với saga thuần event.

---

## 6. Khi nào KHÔNG dùng những thứ này

| Kỹ thuật | Bỏ qua nếu |
|---|---|
| Event nội bộ | Chỉ có 1–2 việc phụ, gọi thẳng đơn giản hơn |
| CQRS | Đọc và ghi dùng chung một model là đủ |
| Read model riêng | Query hiện tại đã dưới 100ms |
| Outbox | Event mất cũng không sao (log, analytics) |
| Saga | Mọi thứ nằm trong một database — dùng transaction |

Mỗi kỹ thuật thêm vào là thêm một chỗ có thể hỏng và thêm một thứ người mới phải học. Chỉ thêm khi nỗi đau đã hiện hữu.

---

## 7. Bài tập bài 7

1. Refactor `PostsService.publish()` từ 5 dependency xuống còn 1 bằng `EventEmitter2`. Viết 3 listener ở 3 module khác nhau.
2. Cố tình cho một listener ném lỗi, chứng minh việc xuất bản **vẫn thành công**.
3. Đổi listener thành đẩy job vào BullMQ thay vì làm việc trực tiếp. So sánh thời gian phản hồi API.
4. Cài CQRS cho một nghiệp vụ: `PublishPostCommand` + `GetPostFeedQuery`. Query handler dùng raw SQL, không qua repository.
5. Tạo bảng `post_feed_view`, cập nhật bằng event handler. Đo thời gian query bảng tin **trước** (JOIN 5 bảng) và **sau** (đọc bảng phẳng).
6. Viết job dựng lại `post_feed_view` từ đầu. Cố tình xoá 100 dòng rồi chạy job, xác nhận khôi phục đúng.
7. **Cài Outbox đầy đủ:** bảng, ghi trong transaction, relay có `SKIP LOCKED`. Cố tình `throw` sau khi save order và chứng minh **cả order lẫn outbox đều rollback**.
8. Chạy **2 instance** relay cùng lúc, bắn 1000 event, xác nhận không có event nào bị gửi trùng.
9. Tắt message broker 30 giây, tạo 50 đơn hàng, bật lại và xác nhận đủ 50 event được gửi.
10. Cài saga đặt hàng 3 bước có bù trừ. Cho bước thanh toán thất bại và xác nhận hàng đã giữ được trả về kho.

➡️ Tiếp: [08-realtime-websocket-sse.md](./08-realtime-websocket-sse.md)
