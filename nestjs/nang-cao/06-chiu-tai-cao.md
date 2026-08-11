# Bài 6 — Chịu tải cao

Bài trước lo việc **dữ liệu lớn**. Bài này lo việc **nhiều request cùng lúc**.

Nguyên tắc nền tảng: **mọi tài nguyên đều phải có giới hạn**. Không giới hạn nghĩa là một request bất thường có thể chiếm hết và làm chết mọi request khác.

---

## 1. Hiểu giới hạn thật sự của Node

Node chạy **một luồng** cho JavaScript. Điều này dẫn tới ba hệ quả cần nhớ:

| Loại việc | Node xử lý thế nào | Giới hạn thực tế |
|---|---|---|
| I/O (DB, HTTP, file) | Không chặn, hàng nghìn việc đồng thời | **Rất tốt** — 10k+ req/s |
| CPU (mã hoá, resize, JSON lớn) | **Chặn toàn bộ** event loop | Rất kém — phải tách ra |
| Bộ nhớ | Heap mặc định ~1.5–4GB | OOM là chết cả process |

Một hàm CPU chạy 200ms nghĩa là **mọi** request khác chờ thêm 200ms. Với 100 req/s, hàng đợi phình vô hạn.

### Đo event loop lag — chỉ số sức khoẻ quan trọng nhất

```ts
// src/shared/observability/event-loop.service.ts
import { monitorEventLoopDelay } from 'node:perf_hooks';

@Injectable()
export class EventLoopMonitor implements OnModuleInit {
  private readonly logger = new Logger(EventLoopMonitor.name);
  private readonly histogram = monitorEventLoopDelay({ resolution: 20 });

  onModuleInit() {
    this.histogram.enable();
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  report() {
    const p99 = this.histogram.percentile(99) / 1e6;   // nano -> mili
    const mean = this.histogram.mean / 1e6;

    if (p99 > 100) {
      this.logger.warn(`⚠️ Event loop lag p99=${p99.toFixed(1)}ms — có code chặn luồng`);
    }
    this.histogram.reset();
  }
}
```

Cách đọc:

| Lag p99 | Ý nghĩa |
|---|---|
| < 10ms | Khoẻ |
| 10–50ms | Bắt đầu có áp lực |
| 50–200ms | Có code CPU nặng đang chặn |
| > 200ms | Sắp sập — request đang xếp hàng |

Khi lag cao, **thêm server không giúp gì** — phải tìm và tách đoạn CPU nặng ra (worker thread hoặc queue, xem [bài 02 mục 6](./02-xu-ly-du-lieu-lon.md)).

---

## 2. Rate limiting — tuyến phòng thủ đầu tiên

```bash
npm i @nestjs/throttler
```

### Cấu hình nhiều tầng

```ts
ThrottlerModule.forRoot([
  { name: 'short',  ttl: 1_000,  limit: 10 },    // chống burst: 10 req/giây
  { name: 'medium', ttl: 60_000, limit: 200 },   // 200 req/phút
  { name: 'long',   ttl: 3600_000, limit: 2000 },// 2000 req/giờ
])
```

```ts
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }]
```

Ba tầng cùng lúc chặn được cả tấn công burst lẫn tấn công rải đều.

### Giới hạn riêng cho endpoint nhạy cảm

```ts
@Throttle({ short: { limit: 3, ttl: 60_000 } })   // 3 lần đăng nhập/phút
@Post('login')
login(@Body() dto: LoginDto) {}

@SkipThrottle()                                   // không giới hạn health check
@Get('health')
health() {}
```

### ⚠️ Lưu trữ dùng chung khi có nhiều instance

Mặc định `@nestjs/throttler` lưu bộ đếm **trong RAM**. Với 5 container, giới hạn thực tế thành 5 lần cấu hình — vô hiệu hoá hoàn toàn.

```bash
npm i @nest-lab/throttler-storage-redis
```

```ts
ThrottlerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (c: ConfigService) => ({
    throttlers: [{ ttl: 60_000, limit: 200 }],
    storage: new ThrottlerStorageRedisService(c.getOrThrow('REDIS_URL')),
  }),
})
```

### Định danh đúng đối tượng bị giới hạn

Mặc định throttler dùng IP. Nhưng nếu app đứng sau proxy/CDN, mọi request đều mang IP của proxy → chặn nhầm toàn bộ người dùng.

```ts
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Ưu tiên user id — công bằng hơn IP (nhiều người chung một IP văn phòng)
    if (req.user?.id) return `user:${req.user.id}`;
    if (req.headers['x-api-key']) return `key:${req.headers['x-api-key']}`;
    return `ip:${req.ips?.[0] ?? req.ip}`;
  }
}
```

Và bắt buộc bật trust proxy:

```ts
// main.ts
const app = await NestFactory.create<NestExpressApplication>(AppModule);
app.set('trust proxy', 1);     // tin header X-Forwarded-For từ 1 tầng proxy
```

> Không bật `trust proxy` = rate limit theo IP vô dụng. Bật quá rộng (`true`) = kẻ tấn công tự chế `X-Forwarded-For` để né. Đặt đúng số tầng proxy thật của bạn.

---

## 3. Timeout ở mọi tầng

Một request không có timeout có thể treo vĩnh viễn và giữ tài nguyên mãi mãi.

### 3.1 Timeout cho request đến

```ts
// src/shared/interceptors/timeout.interceptor.ts
import { RequestTimeoutException } from '@nestjs/common';
import { timeout, catchError, throwError, TimeoutError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly ms = 15_000) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      timeout(this.ms),
      catchError((err) =>
        throwError(() =>
          err instanceof TimeoutError
            ? new RequestTimeoutException('Yêu cầu xử lý quá lâu')
            : err,
        ),
      ),
    );
  }
}
```

Endpoint nặng cần thời gian riêng:

```ts
@UseInterceptors(new TimeoutInterceptor(60_000))
@Get('report')
heavyReport() {}
```

### 3.2 Timeout cho lời gọi ra ngoài

```ts
HttpModule.register({
  timeout: 5_000,
  maxRedirects: 3,
});
```

Với `fetch` gốc:

```ts
const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 5_000);
try {
  const res = await fetch(url, { signal: controller.signal });
  return res.json();
} finally {
  clearTimeout(t);      // ⚠️ quên dòng này = rò rỉ timer
}
```

### 3.3 Timeout cho database

```ts
extra: {
  statement_timeout: 30_000,      // Postgres tự huỷ query quá 30s
  connectionTimeoutMillis: 5_000, // chờ xin connection tối đa 5s
}
```

### Quy tắc phân bổ ngân sách thời gian

```
Timeout của client        60s
  └─ Timeout của API      30s      ← phải NHỎ HƠN client
      ├─ DB               10s
      ├─ Dịch vụ ngoài     5s
      └─ Cache             1s
```

Timeout tầng trong **luôn phải nhỏ hơn** tầng ngoài. Ngược lại thì client bỏ cuộc trước, còn server vẫn miệt mài xử lý một việc không ai cần nữa.

---

## 4. Circuit breaker — không để dịch vụ hỏng kéo bạn theo

Khi dịch vụ thanh toán chết, mỗi request của bạn chờ 5 giây rồi lỗi. 1000 req/s × 5s = 5000 request treo đồng thời → hết pool, hết RAM, **app của bạn chết theo dù lỗi không phải của bạn**.

Circuit breaker cắt mạch: sau N lỗi liên tiếp, **ngừng gọi** và trả lỗi ngay lập tức.

```bash
npm i opossum
```

```ts
import CircuitBreaker from 'opossum';

@Injectable()
export class PaymentClient implements OnModuleInit {
  private breaker: CircuitBreaker;
  private readonly logger = new Logger(PaymentClient.name);

  onModuleInit() {
    this.breaker = new CircuitBreaker(
      (dto: ChargeDto) => this.doCharge(dto),
      {
        timeout: 5_000,                 // quá 5s coi như lỗi
        errorThresholdPercentage: 50,   // 50% lỗi -> mở mạch
        resetTimeout: 30_000,           // sau 30s thử lại 1 request
        volumeThreshold: 10,            // cần ít nhất 10 request mới đánh giá
      },
    );

    // Khi mạch mở, trả về phương án dự phòng thay vì lỗi
    this.breaker.fallback(() => ({
      status: 'deferred',
      message: 'Hệ thống thanh toán đang bận, đơn hàng sẽ được xử lý sau',
    }));

    this.breaker.on('open', () => this.logger.error('🔴 Mạch thanh toán MỞ'));
    this.breaker.on('halfOpen', () => this.logger.warn('🟡 Đang thử lại...'));
    this.breaker.on('close', () => this.logger.log('🟢 Mạch đã đóng'));
  }

  charge(dto: ChargeDto) {
    return this.breaker.fire(dto);
  }

  private async doCharge(dto: ChargeDto) {
    return firstValueFrom(this.http.post('/charge', dto));
  }
}
```

Ba trạng thái:

```
CLOSED (bình thường) ──lỗi vượt ngưỡng──► OPEN (từ chối ngay, 0ms)
       ▲                                      │
       └───thử thành công─── HALF_OPEN ◄──sau resetTimeout
```

Lợi ích lớn nhất không phải là bảo vệ dịch vụ kia, mà là **giải phóng tài nguyên của chính bạn** — request lỗi trong 0ms thay vì 5000ms.

---

## 5. Bulkhead — cô lập tài nguyên

Chia tài nguyên thành các "khoang" riêng để một chỗ chìm không kéo cả tàu.

```ts
@Injectable()
export class BulkheadService {
  // Mỗi dịch vụ ngoài có hạn ngạch riêng
  private readonly limits = {
    payment: pLimit(20),
    search:  pLimit(10),
    email:   pLimit(5),
  };

  run<T>(pool: keyof typeof this.limits, fn: () => Promise<T>): Promise<T> {
    return this.limits[pool](fn);
  }
}
```

Dịch vụ tìm kiếm chậm chỉ làm nghẽn tối đa 10 việc, không chiếm hết khả năng xử lý.

Áp dụng tương tự cho DB: nếu có endpoint báo cáo nặng, cho nó một `DataSource` riêng với pool nhỏ, tách khỏi pool của API chính.

---

## 6. Load shedding — chủ động từ chối khi quá tải

Khi hệ thống quá tải, **từ chối nhanh 20% request tốt hơn là làm chậm 100% request**. Người dùng thà thấy lỗi ngay và thử lại, còn hơn chờ 60 giây rồi cũng lỗi.

```ts
@Injectable()
export class LoadSheddingGuard implements CanActivate {
  private readonly histogram = monitorEventLoopDelay({ resolution: 20 });
  private inFlight = 0;

  constructor() {
    this.histogram.enable();
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();

    // Luôn cho health check đi qua, nếu không orchestrator sẽ giết container
    if (req.url.startsWith('/health')) return true;

    const lagMs = this.histogram.percentile(99) / 1e6;

    if (lagMs > 300 || this.inFlight > 500) {
      throw new ServiceUnavailableException({
        message: 'Hệ thống đang quá tải, vui lòng thử lại sau ít giây',
        retryAfter: 5,
      });
    }

    this.inFlight++;
    ctx.switchToHttp().getResponse().on('finish', () => this.inFlight--);
    return true;
  }
}
```

Nhớ trả header chuẩn để client biết chờ bao lâu:

```ts
res.setHeader('Retry-After', '5');
```

---

## 7. Scale ngang: cluster và nhiều container

### Cluster mode — dùng hết số core của một máy

Một process Node chỉ dùng được **một core**. Máy 8 core mà chạy 1 process là lãng phí 87% CPU.

```ts
// src/cluster.ts
import cluster from 'node:cluster';
import { cpus } from 'node:os';

export function runInCluster(bootstrap: () => Promise<void>) {
  if (cluster.isPrimary && process.env.CLUSTER_MODE === 'true') {
    const count = Number(process.env.WORKERS) || cpus().length;
    Logger.log(`Primary ${process.pid} khởi tạo ${count} worker`);

    for (let i = 0; i < count; i++) cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
      Logger.warn(`Worker ${worker.process.pid} chết (${signal || code}), tạo lại`);
      cluster.fork();
    });
  } else {
    bootstrap();
  }
}
```

```ts
// main.ts
runInCluster(bootstrap);
```

> **Trong container thì đừng dùng cluster.** Chạy nhiều container 1 process dễ quản lý hơn: giới hạn RAM chính xác, rolling update mượt, orchestrator tự restart. Cluster chỉ hợp khi chạy trực tiếp trên VM.

### Điều kiện để scale ngang hoạt động

Ứng dụng phải **stateless**. Kiểm tra 5 điểm sau:

| Thứ | ❌ Sai | ✅ Đúng |
|---|---|---|
| Session | Lưu trong RAM | Redis hoặc JWT |
| Cache | Biến `Map` trong service | Redis |
| Upload file | Lưu `./uploads` | S3 / MinIO |
| Cron | `@Cron` chạy mọi instance | BullMQ repeatable job |
| WebSocket | Bộ nhớ cục bộ | Redis adapter ([bài 08](./08-realtime-websocket-sse.md)) |

Một biến `private cache = new Map()` trong service là đủ để phá vỡ toàn bộ khả năng scale.

---

## 8. Health check — để orchestrator biết khi nào gửi tải

```bash
npm i @nestjs/terminus
```

```ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  /** Liveness: process còn sống không? Hỏng -> RESTART container */
  @Get('live')
  @SkipThrottle()
  @HealthCheck()
  live() {
    return this.health.check([]);        // chỉ cần trả 200 là đủ
  }

  /** Readiness: sẵn sàng nhận request chưa? Hỏng -> NGỪNG gửi tải (không restart) */
  @Get('ready')
  @SkipThrottle()
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 2000 }),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),
    ]);
  }
}
```

Phân biệt hai loại là điều quan trọng nhất ở đây:

- **Liveness kiểm tra DB là một lỗi phổ biến và nguy hiểm.** DB chập chờn 10 giây → mọi container bị restart đồng loạt → mất toàn bộ dịch vụ. Liveness chỉ nên trả lời "process có bị treo không".
- **Readiness** thì nên kiểm tra dependency: DB chết → ngừng nhận request mới, nhưng container vẫn sống và tự phục hồi khi DB trở lại.

---

## 9. Graceful shutdown — deploy không rơi request

```ts
// main.ts
app.enableShutdownHooks();
```

```ts
@Injectable()
export class GracefulShutdown implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdown.name);

  constructor(private readonly readiness: ReadinessService) {}

  async onApplicationShutdown(signal: string) {
    this.logger.log(`Nhận ${signal}, bắt đầu tắt an toàn`);

    // ① Báo "không sẵn sàng" để load balancer ngừng gửi request mới
    this.readiness.setNotReady();

    // ② Chờ load balancer cập nhật (thường 5-15 giây)
    await new Promise((r) => setTimeout(r, 10_000));

    // ③ Nest tự đóng HTTP server, chờ request đang xử lý xong
    this.logger.log('Đã tắt an toàn');
  }
}
```

Bước ② hay bị bỏ qua nhưng rất quan trọng: giữa lúc container bắt đầu tắt và lúc load balancer nhận ra, vẫn còn request được gửi tới. Không chờ = rơi request mỗi lần deploy.

```yaml
# docker-compose / k8s
stop_grace_period: 45s      # phải > thời gian chờ ở bước ② + thời gian xử lý request dài nhất
```

---

## 10. Tối ưu tầng HTTP

### Nén response

```bash
npm i compression
```

```ts
app.use(compression({
  threshold: 1024,          // chỉ nén body > 1KB
  filter: (req, res) => {
    // Không nén stream export — sẽ phá backpressure
    if (req.path.includes('/export')) return false;
    return compression.filter(req, res);
  },
}));
```

JSON nén được ~80%. Đánh đổi: tốn CPU. Nếu có CDN/nginx phía trước, để chúng nén thay sẽ tốt hơn.

### Keep-alive cho lời gọi ra ngoài

Mặc định mỗi request HTTP tạo kết nối TCP mới — bắt tay TLS mất 50–100ms.

```ts
import { Agent } from 'node:https';

HttpModule.register({
  httpsAgent: new Agent({
    keepAlive: true,
    maxSockets: 100,
    maxFreeSockets: 20,
    timeout: 60_000,
  }),
});
```

Với dịch vụ gọi nhiều, riêng thay đổi này thường giảm 30–50% độ trễ.

### Giới hạn kích thước body

```ts
app.useBodyParser('json', { limit: '1mb' });
```

Không giới hạn = ai đó gửi body 500MB và làm hết RAM server.

---

## 11. Load test — nghiệm thu bằng số liệu

```bash
npm i -g autocannon
```

```bash
# 100 kết nối đồng thời, 30 giây
autocannon -c 100 -d 30 http://localhost:3000/api/posts

# Có token
autocannon -c 100 -d 30 -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/posts
```

Kịch bản phức tạp hơn dùng **k6**:

```js
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 100 },   // tăng dần
    { duration: '3m', target: 100 },   // giữ tải
    { duration: '1m', target: 500 },   // tăng đột ngột
    { duration: '2m', target: 0 },     // giảm dần
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed:   ['rate<0.01'],   // dưới 1% lỗi
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/posts?limit=20');
  check(res, {
    'status 200': (r) => r.status === 200,
    'dưới 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

```bash
k6 run load-test.js
```

### Đọc kết quả thế nào

**Luôn nhìn p95 và p99, đừng nhìn trung bình.** Trung bình 50ms nghe rất đẹp trong khi 5% người dùng chờ 8 giây.

| Chỉ số | Ngưỡng chấp nhận được |
|---|---|
| p95 latency | < 500ms |
| p99 latency | < 1500ms |
| Tỷ lệ lỗi | < 0.1% |
| Throughput | Ổn định, không tụt khi tăng tải |

Dấu hiệu đã chạm trần: **tăng số kết nối nhưng throughput không tăng, chỉ có latency tăng.** Lúc đó phải tìm nút thắt (DB? event loop? pool?) chứ không phải tăng tải tiếp.

---

## 12. Quy trình xử lý khi hệ thống chậm

Theo thứ tự, đừng nhảy cóc:

1. **Đo event loop lag** → cao? Có code CPU chặn luồng → tách ra worker/queue.
2. **Xem log query chậm** → có? Sang [bài 03](./03-toi-uu-database.md).
3. **Kiểm tra pool DB** → đầy? Tăng pool hoặc giảm concurrency worker.
4. **Kiểm tra cache hit rate** → thấp? Sang [bài 04](./04-cache-nhieu-tang.md).
5. **Kiểm tra RAM/GC** → tăng đều? Rò rỉ bộ nhớ, chụp heap snapshot.
6. **Kiểm tra dịch vụ ngoài** → chậm? Thêm circuit breaker.
7. Đến đây vẫn chậm → **mới** nghĩ tới thêm server.

Thêm server khi nút thắt nằm ở DB chỉ làm mọi thứ tệ hơn — nhiều instance hơn nghĩa là nhiều connection hơn tranh nhau cùng một DB.

---

## 13. Bài tập bài 6

1. Cài `EventLoopMonitor`. Viết một endpoint có vòng lặp CPU 500ms, bắn tải và quan sát lag tăng vọt. Sửa bằng `piscina` và đo lại.
2. Cài throttler 3 tầng + Redis storage. Chạy **2 instance**, xác nhận giới hạn được chia sẻ chung (bắn 15 req/s vào giới hạn 10/s phải bị chặn).
3. Bật `trust proxy`, dựng nginx phía trước, xác nhận rate limit nhận đúng IP thật chứ không phải IP nginx.
4. Cài `TimeoutInterceptor` 5 giây. Tạo endpoint ngủ 10 giây, xác nhận trả 408.
5. Dựng một dịch vụ giả luôn lỗi. Gọi nó 1000 lần **không có** circuit breaker và đo thời gian + RAM. Thêm `opossum` và đo lại — so sánh.
6. Cài `LoadSheddingGuard`. Bắn `autocannon -c 1000` và xác nhận server trả 503 nhanh thay vì treo.
7. Cài health check `live` và `ready` tách biệt. **Tắt database** và xác nhận: `ready` trả 503 nhưng `live` vẫn 200.
8. Cài graceful shutdown có bước chờ 10 giây. Chạy `autocannon` liên tục, gửi `SIGTERM` giữa chừng, xác nhận **0 request lỗi**.
9. Bật keep-alive agent cho lời gọi ngoài, đo p95 trước và sau.
10. Viết kịch bản k6 với threshold `p(95)<500`. Chạy và tinh chỉnh hệ thống cho tới khi đạt.
11. **Tìm trần hệ thống:** tăng dần số kết nối (50 → 100 → 200 → 500 → 1000), vẽ đồ thị throughput và p99. Xác định điểm bão hoà và chỉ ra nút thắt nằm ở đâu.

➡️ Tiếp: [07-cqrs-event-outbox.md](./07-cqrs-event-outbox.md)
