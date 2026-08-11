# Bài 5 — Queue & Job nền với BullMQ

Nguyên tắc: **bất cứ việc gì mất hơn ~1 giây đều không nên nằm trong vòng đời request.** Bài này là cách hiện thực nguyên tắc đó.

---

## 1. Vì sao cần queue

```
❌ Không có queue
POST /posts  →  lưu DB (50ms)  →  gửi mail 500 người (30s)  →  đánh index (5s)  →  response
                                   ↑ client chờ 35 giây, proxy timeout ở 30s

✅ Có queue
POST /posts  →  lưu DB (50ms)  →  đẩy job vào queue (2ms)  →  response 201 (52ms)
                                          ↓
                                   Worker xử lý riêng, có retry, không ảnh hưởng API
```

Queue mang lại 4 thứ:

1. **Phản hồi nhanh** — API trả về ngay.
2. **Chịu lỗi** — job thất bại tự thử lại, không mất việc.
3. **Điều tiết tải** — 10.000 job xếp hàng, worker xử lý với tốc độ mà hệ thống chịu được.
4. **Scale độc lập** — thêm worker mà không cần thêm API instance.

---

## 2. Cài đặt

```bash
npm i @nestjs/bullmq bullmq ioredis
```

```ts
// src/shared/queue/queue.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        connection: {
          host: c.getOrThrow('REDIS_HOST'),
          port: c.get<number>('REDIS_PORT', 6379),
          maxRetriesPerRequest: null,     // BẮT BUỘC cho BullMQ
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },  // 2s, 4s, 8s
          removeOnComplete: { age: 3600, count: 1000 },   // dọn job cũ, tránh phình Redis
          removeOnFail: { age: 24 * 3600 },               // giữ job lỗi 24h để điều tra
        },
      }),
    }),
  ],
})
export class QueueModule {}
```

> `removeOnComplete` là bắt buộc. Không có nó, Redis sẽ đầy job đã xong sau vài ngày và hệ thống dừng nhận job mới.

Đăng ký queue trong module tính năng:

```ts
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'export' },
      { name: 'image' },
    ),
  ],
  providers: [EmailProcessor, ExportProcessor],
})
export class JobsModule {}
```

---

## 3. Producer — đẩy job

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class PostsService {
  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async publish(postId: number) {
    const post = await this.repo.save({ id: postId, status: 'published' });

    await this.emailQueue.add(
      'notify-followers',              // tên job
      { postId: post.id },             // payload — GIỮ NHỎ, xem cảnh báo dưới
      {
        jobId: `notify:${post.id}`,    // chống trùng: cùng jobId chỉ vào queue 1 lần
        delay: 5_000,                  // chờ 5 giây rồi mới chạy
        priority: 1,                   // số nhỏ = ưu tiên cao
      },
    );

    return post;
  }
}
```

### Payload phải nhỏ

```ts
// ❌ Nhét cả entity vào Redis — phình bộ nhớ, và dữ liệu đã cũ khi worker chạy
await queue.add('process', { post: fullPostObject, author: fullUserObject });

// ✅ Chỉ gửi id, worker tự load bản mới nhất
await queue.add('process', { postId: 123 });
```

### Thêm hàng loạt job

```ts
// ❌ 10.000 round-trip tới Redis
for (const id of userIds) await queue.add('send', { id });

// ✅ Một lệnh
await queue.addBulk(
  userIds.map((id) => ({
    name: 'send',
    data: { userId: id },
    opts: { jobId: `send:${campaignId}:${id}` },
  })),
);
```

---

## 4. Consumer — xử lý job

```ts
// src/jobs/email.processor.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('email', {
  concurrency: 5,                       // 5 job song song TRONG process này
  limiter: { max: 100, duration: 60_000 },  // tối đa 100 job/phút (giới hạn của nhà cung cấp mail)
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly postsService: PostsService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case 'notify-followers':
        return this.notifyFollowers(job);
      case 'send-single':
        return this.sendSingle(job);
      default:
        throw new UnrecoverableError(`Job không xác định: ${job.name}`);
    }
  }

  private async notifyFollowers(job: Job<{ postId: number }>) {
    const post = await this.postsService.findOne(job.data.postId);
    const followers = await this.postsService.getFollowers(post.authorId);

    for (let i = 0; i < followers.length; i++) {
      await this.mailService.send(followers[i].email, post.title);
      await job.updateProgress(Math.round(((i + 1) / followers.length) * 100));
    }

    return { sent: followers.length };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`✅ Job ${job.id} (${job.name}) xong sau ${Date.now() - job.processedOn!}ms`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`❌ Job ${job.id} lỗi lần ${job.attemptsMade}/${job.opts.attempts}: ${err.message}`);
  }
}
```

### Lỗi nào nên retry, lỗi nào không

Đây là chỗ hay bị làm sai — retry một lỗi vĩnh viễn chỉ tốn tài nguyên.

```ts
async process(job: Job) {
  try {
    return await this.doWork(job.data);
  } catch (err) {
    // Lỗi vĩnh viễn -> dừng hẳn, KHÔNG retry
    if (err instanceof ValidationError || err.status === 404 || err.status === 400) {
      throw new UnrecoverableError(`Dữ liệu không hợp lệ: ${err.message}`);
    }
    // Lỗi tạm thời (mạng, 503, timeout) -> ném thường để BullMQ retry
    throw err;
  }
}
```

| Loại lỗi | Xử lý |
|---|---|
| Mạng chập chờn, 502/503, DB timeout | Retry (ném lỗi thường) |
| Bị rate limit (429) | Retry với backoff dài hơn |
| Dữ liệu sai, bản ghi không tồn tại, 400/404 | `UnrecoverableError` |
| Bug trong code | `UnrecoverableError` + cảnh báo ngay |

---

## 5. Idempotency — điều kiện sống còn

Job **sẽ** chạy nhiều lần: retry, worker chết giữa chừng, mạng đứt sau khi làm xong nhưng trước khi báo cáo. Nếu job trừ tiền hai lần, bạn có một sự cố nghiêm trọng.

### Cách 1: chống trùng bằng `jobId`

```ts
await queue.add('charge', { orderId }, { jobId: `charge:${orderId}` });
```

BullMQ từ chối job trùng `jobId` khi job cũ còn trong queue. Nhưng nó **không** chống được retry của cùng một job — cần thêm cách 2.

### Cách 2: khoá idempotency trong DB

```ts
async process(job: Job<{ orderId: number }>) {
  const key = `job:charge:${job.data.orderId}`;

  // INSERT ... ON CONFLICT DO NOTHING — nguyên tử, an toàn với chạy song song
  const result = await this.dataSource.query(
    `INSERT INTO processed_jobs (key, created_at) VALUES ($1, now())
     ON CONFLICT (key) DO NOTHING RETURNING key`,
    [key],
  );

  if (result.length === 0) {
    this.logger.warn(`Job ${key} đã xử lý rồi, bỏ qua`);
    return { skipped: true };
  }

  await this.paymentService.charge(job.data.orderId);
}
```

### Cách 3: thiết kế thao tác vốn đã idempotent

Tốt nhất là làm cho việc lặp lại **không gây hại**:

```ts
// ❌ Gọi 2 lần -> cộng 2 lần
await this.repo.increment({ id }, 'balance', amount);

// ✅ Gọi bao nhiêu lần cũng cùng kết quả
await this.repo.update({ id }, { status: 'completed', completedAt: new Date() });
```

---

## 6. Xử lý dữ liệu lớn bằng queue — chia để trị

Job "gửi mail cho 1 triệu người" là job **sai thiết kế**: chạy hàng giờ, lỗi ở người thứ 999.999 thì retry lại từ đầu, không biết tiến độ.

### Pattern: một job điều phối + nhiều job con

```ts
// Job cha: chỉ chia việc, không làm việc
@Processor('campaign')
export class CampaignProcessor extends WorkerHost {
  constructor(@InjectQueue('campaign') private readonly queue: Queue) { super(); }

  async process(job: Job) {
    if (job.name === 'dispatch') return this.dispatch(job);
    if (job.name === 'send-chunk') return this.sendChunk(job);
  }

  private async dispatch(job: Job<{ campaignId: number }>) {
    const CHUNK = 500;
    let lastId = 0;
    let chunkIndex = 0;

    while (true) {
      const users = await this.userRepo.find({
        where: { id: MoreThan(lastId), subscribed: true },
        order: { id: 'ASC' },
        take: CHUNK,
        select: { id: true },
      });
      if (!users.length) break;

      await this.queue.add(
        'send-chunk',
        { campaignId: job.data.campaignId, userIds: users.map((u) => u.id) },
        { jobId: `campaign:${job.data.campaignId}:chunk:${chunkIndex}` },  // idempotent
      );

      lastId = users.at(-1)!.id;
      chunkIndex++;
    }

    return { chunks: chunkIndex };
  }

  private async sendChunk(job: Job<{ campaignId: number; userIds: number[] }>) {
    let sent = 0;
    for (const userId of job.data.userIds) {
      await this.mailService.sendCampaign(job.data.campaignId, userId);
      sent++;
      if (sent % 50 === 0) await job.updateProgress(sent / job.data.userIds.length * 100);
    }
    return { sent };
  }
}
```

Lợi ích:

- Mỗi job con chỉ mất ~30 giây → retry rẻ.
- 2000 job con chạy song song trên nhiều worker.
- Lỗi 1 chunk chỉ ảnh hưởng 500 người, không phải cả triệu.
- `jobId` cố định → chạy lại `dispatch` không tạo job trùng.

### Flow — job cha chờ tất cả job con xong

```ts
import { FlowProducer } from 'bullmq';

const flow = new FlowProducer({ connection });

await flow.add({
  name: 'finalize-report',
  queueName: 'report',
  data: { reportId },
  children: chunks.map((chunk, i) => ({
    name: 'process-chunk',
    queueName: 'report',
    data: { chunk },
    opts: { jobId: `report:${reportId}:${i}` },
  })),
});
```

`finalize-report` chỉ chạy khi **tất cả** con hoàn tất. Lấy kết quả con:

```ts
async process(job: Job) {
  if (job.name === 'finalize-report') {
    const childResults = await job.getChildrenValues();   // { jobKey: result }
    const total = Object.values(childResults).reduce((s: number, r: any) => s + r.count, 0);
    // ...
  }
}
```

---

## 7. Concurrency và rate limit — điều tiết tải

Ba mức kiểm soát khác nhau, đừng nhầm lẫn:

```ts
@Processor('image', {
  concurrency: 3,                            // ① 3 job song song mỗi worker process
  limiter: { max: 100, duration: 60_000 },   // ② tối đa 100 job/phút TOÀN CỤC (chia sẻ qua Redis)
})
```

```ts
// ③ Giới hạn song song BÊN TRONG một job
const limit = pLimit(10);
await Promise.all(items.map((i) => limit(() => process(i))));
```

### Chọn concurrency thế nào

| Loại việc | concurrency gợi ý |
|---|---|
| Nặng I/O (gọi HTTP, gửi mail) | 10–50 |
| Nặng DB | ≤ pool size ÷ số worker |
| Nặng CPU (resize ảnh, PDF) | = số core, hoặc 1 + dùng `piscina` |
| Nặng RAM (xử lý file lớn) | 1–2 |

> Công thức quan trọng: **`concurrency × số_worker_instance ≤ DB pool size`**. Nếu không, worker sẽ tranh connection với API và làm API timeout. Đây là nguyên nhân phổ biến của sự cố "thêm worker xong API chết".

### Tách queue theo mức độ ưu tiên

Đừng để job export 30 phút chặn mất email đặt lại mật khẩu:

```ts
BullModule.registerQueue(
  { name: 'critical' },   // OTP, đặt lại mật khẩu — concurrency cao, worker riêng
  { name: 'default' },    // thông báo thường
  { name: 'heavy' },      // export, import, sinh báo cáo — concurrency thấp
);
```

---

## 8. Job định kỳ (cron)

```ts
// Đăng ký một lần lúc khởi động
async onModuleInit() {
  await this.queue.add(
    'cleanup-drafts',
    {},
    {
      repeat: { pattern: '0 3 * * *' },     // 3h sáng mỗi ngày
      jobId: 'cleanup-drafts',              // tránh tạo trùng khi restart
    },
  );
}
```

**Vì sao dùng repeatable job của BullMQ thay vì `@Cron` của `@nestjs/schedule`?**

`@Cron` chạy trên **mọi instance** — 5 container nghĩa là job chạy 5 lần. Repeatable job của BullMQ đi qua Redis nên chỉ **một** worker nhận được. Với ứng dụng chạy nhiều instance, đây là khác biệt quyết định.

Nếu vẫn muốn dùng `@Cron`, phải tự khoá:

```ts
@Cron('0 3 * * *')
async cleanup() {
  const lock = await this.redis.set('lock:cleanup', '1', 'EX', 300, 'NX');
  if (!lock) return;      // instance khác đã giành được
  // ...
}
```

---

## 9. Theo dõi tiến độ từ phía client

```ts
// Producer trả jobId cho client
@Post('exports')
@HttpCode(HttpStatus.ACCEPTED)          // 202 = đã nhận, đang xử lý
async createExport(@Body() dto: ExportDto, @CurrentUser('id') userId: number) {
  const job = await this.exportQueue.add('export-posts', { ...dto, userId });
  return { jobId: job.id, status: 'queued' };
}

// Client hỏi trạng thái
@Get('exports/:jobId')
async getStatus(@Param('jobId') jobId: string) {
  const job = await this.exportQueue.getJob(jobId);
  if (!job) throw new NotFoundException('Không tìm thấy job');

  return {
    id: job.id,
    state: await job.getState(),          // waiting | active | completed | failed | delayed
    progress: job.progress,
    result: job.returnvalue,              // có url file khi xong
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
  };
}
```

Muốn realtime thay vì polling → dùng SSE ở [bài 08](./08-realtime-websocket-sse.md).

---

## 10. Dead letter queue & job hỏng

Job thất bại hết số lần retry sẽ nằm ở trạng thái `failed`. Đừng để chúng chìm vào quên lãng.

```ts
@OnWorkerEvent('failed')
async onFailed(job: Job, err: Error) {
  if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
    // Đã hết retry -> chuyển sang queue riêng để con người xem xét
    await this.deadLetterQueue.add('dead', {
      originalQueue: job.queueName,
      jobName: job.name,
      data: job.data,
      error: err.message,
      stack: err.stack,
      failedAt: new Date().toISOString(),
    });

    await this.alerting.notify(`Job ${job.name} chết hẳn: ${err.message}`);
  }
}
```

Kiểm tra định kỳ:

```ts
@Cron(CronExpression.EVERY_5_MINUTES)
async checkQueueHealth() {
  const [waiting, active, failed, delayed] = await Promise.all([
    this.queue.getWaitingCount(),
    this.queue.getActiveCount(),
    this.queue.getFailedCount(),
    this.queue.getDelayedCount(),
  ]);

  this.logger.log(`Queue: waiting=${waiting} active=${active} failed=${failed} delayed=${delayed}`);

  if (waiting > 10_000) {
    await this.alerting.notify(`⚠️ Queue tồn đọng ${waiting} job — worker không theo kịp`);
  }
  if (failed > 100) {
    await this.alerting.notify(`⚠️ ${failed} job thất bại`);
  }
}
```

Chạy lại job lỗi sau khi vá bug:

```ts
const failed = await this.queue.getFailed(0, 1000);
for (const job of failed) await job.retry();
```

### Giao diện quản lý

```bash
npm i @bull-board/api @bull-board/express
```

```ts
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(exportQueue)],
  serverAdapter,
});
app.use('/admin/queues', adminAuthMiddleware, serverAdapter.getRouter());
```

> Nhớ đặt xác thực trước route này — nó cho phép xem payload và xoá job.

---

## 11. Chạy worker riêng biệt

Worker nên là process riêng để scale độc lập với API ([bài 01, mục 7](./01-kien-truc-quy-mo-lon.md)).

```ts
// apps/worker/src/main.ts
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();
  Logger.log('Worker đã sẵn sàng', 'Bootstrap');
}
bootstrap();
```

```yaml
# docker-compose.yml
services:
  api:
    build: .
    command: node dist/apps/api/main
    deploy: { replicas: 4 }

  worker-default:
    build: .
    command: node dist/apps/worker/main
    environment:
      QUEUES: email,notification
    deploy: { replicas: 2 }

  worker-heavy:
    build: .
    command: node dist/apps/worker/main
    environment:
      QUEUES: export,import
    deploy: { replicas: 1 }
    mem_limit: 2g               # job nặng RAM -> giới hạn riêng
```

### Graceful shutdown — không được mất job

Khi deploy, container nhận `SIGTERM`. Worker phải **hoàn thành job đang chạy** trước khi thoát:

```ts
@Injectable()
export class WorkerShutdown implements OnApplicationShutdown {
  constructor(@InjectQueue('email') private readonly queue: Queue) {}

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Nhận ${signal}, đang đóng worker...`);
    await this.queue.close();     // chờ job đang chạy xong, không nhận job mới
    this.logger.log('Worker đã đóng an toàn');
  }
}
```

Cho container đủ thời gian:

```yaml
stop_grace_period: 60s     # Docker chờ 60s trước khi SIGKILL
```

> Không có graceful shutdown, mỗi lần deploy sẽ có job bị cắt ngang giữa chừng. Có `attempts` thì nó sẽ retry — nhưng chỉ an toàn nếu job của bạn idempotent (mục 5).

---

## 12. Bài tập bài 5

1. Dựng BullMQ + Redis. Tạo queue `email`, đẩy job khi xuất bản bài viết, xác nhận API trả về dưới 100ms.
2. Cài retry 3 lần với exponential backoff. Cố tình cho job thất bại 2 lần đầu rồi thành công, quan sát log các lần thử.
3. Phân biệt lỗi tạm thời và vĩnh viễn: ném `UnrecoverableError` cho dữ liệu sai và xác nhận nó **không** retry.
4. **Chia để trị:** viết job gửi thông báo cho 100.000 user, chia thành chunk 500. Đo thời gian với 1 worker vs 4 worker.
5. Cài idempotency bằng bảng `processed_jobs`. Cố tình gọi `job.retry()` sau khi job đã xong, chứng minh không xử lý lại lần hai.
6. Dùng `FlowProducer`: 10 job con xử lý dữ liệu, 1 job cha gộp kết quả và trả về tổng.
7. Cài endpoint `POST /exports` trả 202 + `jobId`, và `GET /exports/:jobId` trả tiến độ. Test với file export 1 triệu dòng ([bài 02](./02-xu-ly-du-lieu-lon.md)).
8. Cài dead letter queue + cảnh báo khi `waiting > 1000`.
9. Cài Bull Board có bảo vệ bằng auth, quan sát job chạy realtime.
10. **Test graceful shutdown:** cho job chạy 20 giây, gửi `SIGTERM` giữa chừng, xác nhận job chạy nốt chứ không bị cắt.
11. Đặt `concurrency` quá cao so với DB pool, bắn tải và quan sát API bắt đầu timeout. Tính lại theo công thức ở mục 7 và xác nhận hết lỗi.

➡️ Tiếp: [06-chiu-tai-cao.md](./06-chiu-tai-cao.md)
