# Bài 10 — Observability & Benchmark

> Nếu bạn chỉ đọc một bài trong bộ nâng cao, hãy đọc bài này.

Mọi kỹ thuật ở 9 bài trước đều vô nghĩa nếu bạn không đo được. Không có số liệu, tối ưu chỉ là mê tín — bạn sẽ dành cả tuần tối ưu thứ chiếm 2% thời gian, trong khi nút thắt thật nằm ở một query thiếu index.

Ba trụ cột: **Log** (chuyện gì đã xảy ra), **Metrics** (hệ thống đang thế nào), **Trace** (thời gian đi đâu mất).

---

## 1. Log có cấu trúc

`console.log` không dùng được ở production: không lọc được, không tìm được, không cảnh báo được.

```bash
npm i nestjs-pino pino-http pino-pretty
```

```ts
// app.module.ts
import { LoggerModule } from 'nestjs-pino';

LoggerModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (c: ConfigService) => ({
    pinoHttp: {
      level: c.get('LOG_LEVEL', 'info'),

      // Dev: đẹp dễ đọc. Production: JSON một dòng cho máy phân tích
      transport: c.get('NODE_ENV') !== 'production'
        ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
        : undefined,

      // ⚠️ QUAN TRỌNG NHẤT: che dữ liệu nhạy cảm
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.token',
          'res.headers["set-cookie"]',
        ],
        censor: '***',
      },

      // Không log ồn cho health check
      autoLogging: {
        ignore: (req) => req.url?.startsWith('/health') ?? false,
      },

      customProps: (req) => ({
        userId: (req as any).user?.id,
        traceId: (req as any).traceId,
      }),

      // Rút gọn: log đầy đủ req/res làm phình chi phí lưu trữ rất nhanh
      serializers: {
        req: (req) => ({ method: req.method, url: req.url, ip: req.remoteAddress }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    },
  }),
})
```

```ts
// main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

> Log rò rỉ mật khẩu hoặc token là sự cố bảo mật thật, xảy ra thường xuyên. Cấu hình `redact` **trước** khi bật log body, không phải sau.

Dùng trong service:

```ts
constructor(@InjectPinoLogger(PostsService.name) private readonly logger: PinoLogger) {}

async publish(id: number) {
  // Object trước, message sau -> tìm kiếm được theo field
  this.logger.info({ postId: id, action: 'publish' }, 'Đang xuất bản bài viết');
}
```

### Nguyên tắc viết log

| Nên | Không nên |
|---|---|
| Log **quyết định** và **kết quả** | Log mọi bước ("vào hàm", "ra hàm") |
| Kèm id để truy vết (`postId`, `userId`, `traceId`) | Log chuỗi không có ngữ cảnh (`"lỗi rồi"`) |
| `error` khi cần người xử lý | `error` cho lỗi validation của người dùng |
| Log một lần ở nơi xử lý lỗi | Log lại cùng lỗi ở mọi tầng |

---

## 2. Correlation ID — ghép log của một request

Với 5 instance và 20.000 dòng log/phút, không có id chung thì không thể lần ra chuyện gì đã xảy ra với một người dùng cụ thể.

```bash
npm i nestjs-cls
```

```ts
ClsModule.forRoot({
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req: Request) =>
      (req.headers['x-request-id'] as string) ?? randomUUID(),
    setup: (cls, req: Request) => {
      cls.set('userId', (req as any).user?.id);
      cls.set('ip', req.ip);
    },
  },
})
```

`nestjs-cls` dùng `AsyncLocalStorage` — id đi theo suốt chuỗi async mà **không cần truyền tham số** qua từng hàm.

```ts
@Injectable()
export class SomeService {
  constructor(private readonly cls: ClsService) {}

  async doWork() {
    this.logger.info({ traceId: this.cls.getId() }, 'Đang xử lý');
  }
}
```

### Truyền tiếp sang service khác và sang queue

```ts
// HTTP ra ngoài
this.http.get(url, { headers: { 'x-request-id': this.cls.getId() } });

// Queue job — id phải đi theo vào worker
await this.queue.add('task', { ...data, _traceId: this.cls.getId() });

// Trong worker
async process(job: Job) {
  await this.cls.runWith({ id: job.data._traceId }, async () => {
    await this.doWork();     // log trong này mang đúng traceId của request gốc
  });
}
```

Trả về cho client để hỗ trợ kỹ thuật:

```ts
res.setHeader('X-Request-Id', this.cls.getId());
```

Người dùng báo lỗi kèm mã này → bạn tìm ra chính xác chuỗi log của họ trong vài giây.

---

## 3. Metrics với Prometheus

```bash
npm i @willsoto/nestjs-prometheus prom-client
```

```ts
PrometheusModule.register({
  path: '/metrics',
  defaultMetrics: { enabled: true },   // CPU, RAM, event loop lag, GC
})
```

### Bốn chỉ số vàng

```ts
// src/shared/observability/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requests: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    private readonly duration: Histogram<string>,

    @InjectMetric('db_pool_active')
    private readonly poolActive: Gauge<string>,

    @InjectMetric('queue_waiting_jobs')
    private readonly queueWaiting: Gauge<string>,
  ) {}

  recordRequest(method: string, route: string, status: number, seconds: number) {
    const labels = { method, route, status: String(status) };
    this.requests.inc(labels);
    this.duration.observe(labels, seconds);
  }
}
```

Đăng ký với **bucket phù hợp** — bucket mặc định thường quá thô:

```ts
providers: [
  makeCounterProvider({
    name: 'http_requests_total',
    help: 'Tổng số HTTP request',
    labelNames: ['method', 'route', 'status'],
  }),
  makeHistogramProvider({
    name: 'http_request_duration_seconds',
    help: 'Thời gian xử lý request',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10],
  }),
]
```

Interceptor thu thập tự động:

```ts
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const start = process.hrtime.bigint();
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();

    // ⚠️ Dùng route pattern (/posts/:id), KHÔNG dùng URL thật (/posts/12345)
    const route = req.route?.path ?? 'unknown';

    return next.handle().pipe(
      finalize(() => {
        const seconds = Number(process.hrtime.bigint() - start) / 1e9;
        this.metrics.recordRequest(req.method, route, res.statusCode, seconds);
      }),
    );
  }
}
```

> **Cardinality là cái bẫy chết người.** Dùng `/posts/12345` làm label sẽ tạo hàng triệu chuỗi thời gian riêng biệt và làm sập Prometheus. Label chỉ được nhận giá trị từ một tập hữu hạn và nhỏ.

### Chỉ số nghiệp vụ

Đừng chỉ đo kỹ thuật. Chỉ số nghiệp vụ phát hiện sự cố nhanh hơn nhiều:

```ts
this.ordersCreated.inc({ status: 'success' });
this.paymentAmount.observe(order.total);
this.activeUsers.set(count);
```

Nếu số đơn hàng/phút tụt về 0 trong khi mọi chỉ số kỹ thuật đều xanh, bạn vừa phát hiện một bug logic mà không giám sát kỹ thuật nào bắt được.

### Truy vấn PromQL hay dùng

```promql
# Throughput
sum(rate(http_requests_total[5m])) by (route)

# Tỷ lệ lỗi
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))

# p95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))

# Event loop lag
nodejs_eventloop_lag_p99_seconds
```

---

## 4. Distributed tracing

Metrics cho biết "chậm". Trace cho biết **chậm ở đâu**.

```bash
npm i @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node \
      @opentelemetry/exporter-trace-otlp-http
```

```ts
// src/tracing.ts — PHẢI import TRƯỚC mọi thứ khác trong main.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';

export const otelSDK = new NodeSDK({
  resource: new Resource({
    'service.name': process.env.SERVICE_NAME ?? 'blog-api',
    'service.version': process.env.APP_VERSION ?? '1.0.0',
    'deployment.environment': process.env.NODE_ENV,
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },   // quá ồn
    }),
  ],
});
```

```ts
// main.ts
import { otelSDK } from './tracing';   // ⚠️ dòng import ĐẦU TIÊN

async function bootstrap() {
  otelSDK.start();
  const app = await NestFactory.create(AppModule);
  // ...
}
```

Auto-instrumentation tự tạo span cho HTTP, TypeORM, Redis, RabbitMQ mà bạn không viết dòng nào. Kết quả:

```
POST /api/orders ................................... 1240ms
├── OrdersController.create ........................ 1235ms
│   ├── SELECT products WHERE id IN (...) ..........   15ms
│   ├── HTTP POST payment-service/charge ...........  980ms  ← THỦ PHẠM
│   ├── INSERT INTO orders .........................   12ms
│   └── redis SET order:123 ........................    2ms
```

Nhìn một lần là biết ngay phải tối ưu chỗ nào — thứ mà đọc log cả buổi không ra.

Thêm span thủ công cho đoạn nghiệp vụ quan trọng:

```ts
import { trace, SpanStatusCode } from '@opentelemetry/api';

async calculatePricing(order: Order) {
  return trace.getTracer('blog-api').startActiveSpan('calculate-pricing', async (span) => {
    try {
      span.setAttribute('order.items', order.items.length);
      const result = await this.doCalculate(order);
      span.setAttribute('order.total', result.total);
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### Lấy mẫu — đừng trace 100% ở production

```ts
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base';

sampler: new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1),   // 10% request
})
```

Trace 100% ở tải cao sẽ tốn nhiều tài nguyên hơn cả ứng dụng. 1–10% là đủ để thấy xu hướng; lỗi thì luôn trace (dùng sampler tuỳ biến).

---

## 5. Dashboard cần có gì

Đặt 8 biểu đồ này lên một màn hình, bạn nhìn 10 giây là biết hệ thống có khoẻ không:

| Biểu đồ | Ngưỡng báo động |
|---|---|
| Throughput (req/s) theo route | Tụt đột ngột > 50% |
| Latency p50 / p95 / p99 | p95 > 500ms |
| Tỷ lệ lỗi 5xx | > 1% |
| Event loop lag p99 | > 100ms |
| RAM (heap + rss) | Tăng đều không giảm = rò rỉ |
| DB pool đang dùng / tổng | > 80% |
| Queue: waiting / failed | waiting tăng liên tục |
| Cache hit rate | < 70% |

Thêm 2 chỉ số nghiệp vụ quan trọng nhất của bạn (đơn hàng/phút, đăng ký/giờ).

### Cảnh báo dựa trên triệu chứng, không phải nguyên nhân

```yaml
# ✅ Cảnh báo cái người dùng cảm nhận được
- alert: TyLeLoiCao
  expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
  for: 5m
  annotations:
    summary: "Trên 5% request lỗi trong 5 phút"

- alert: ApiCham
  expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 1
  for: 10m

# ❌ Đừng cảnh báo cái này — CPU 90% mà người dùng vẫn ổn thì không phải sự cố
- alert: CpuCao
  expr: cpu_usage > 90
```

Quá nhiều cảnh báo dẫn tới việc mọi người tắt thông báo, và rồi cảnh báo thật cũng bị bỏ qua. Mỗi cảnh báo phải **cần hành động ngay**, nếu không thì đó là biểu đồ chứ không phải cảnh báo.

---

## 6. Benchmark: đo đúng cách

### Quy trình

```
① Đo baseline (ghi lại con số)
② Đặt mục tiêu cụ thể ("p95 < 300ms tại 500 req/s")
③ Thay đổi MỘT thứ
④ Đo lại
⑤ Giữ nếu tốt hơn, hoàn tác nếu không
```

Đổi 5 thứ cùng lúc rồi thấy nhanh hơn — bạn không biết thứ nào có tác dụng, và có thể 4 thứ kia đang làm hại.

### Sai lầm thường gặp

| Sai lầm | Hậu quả |
|---|---|
| Test trên máy dev | Máy dev có SSD nhanh, không có độ trễ mạng — số liệu vô nghĩa |
| DB rỗng | 100 dòng dữ liệu không phát hiện được vấn đề index |
| Không warm-up | JIT của V8 chưa tối ưu, lần chạy đầu luôn chậm |
| Nhìn trung bình | Che giấu hoàn toàn phần đuôi (p99) |
| Chạy 10 giây | Chưa kịp lộ rò rỉ bộ nhớ hay tích tụ queue |
| Client cùng máy với server | Client tranh CPU với server |

### Kịch bản k6 hoàn chỉnh

```js
// benchmark/scenario.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const listDuration = new Trend('list_duration');
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    warmup:  { executor: 'constant-vus', vus: 5, duration: '30s', gracefulStop: '5s' },
    rampup:  {
      executor: 'ramping-vus',
      startTime: '30s',
      stages: [
        { duration: '1m', target: 100 },
        { duration: '3m', target: 100 },
        { duration: '1m', target: 500 },   // đợt tăng đột biến
        { duration: '2m', target: 500 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{scenario:rampup}': ['p(95)<500', 'p(99)<2000'],
    'errors': ['rate<0.01'],
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000/api';

export default function () {
  // 80% đọc danh sách, 15% đọc chi tiết, 5% ghi — mô phỏng tải thật
  const r = Math.random();

  if (r < 0.8) {
    const res = http.get(`${BASE}/posts?limit=20`);
    listDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
    check(res, { 'danh sách 200': (r) => r.status === 200 });
  } else if (r < 0.95) {
    const res = http.get(`${BASE}/posts/${Math.floor(Math.random() * 1000) + 1}`);
    errorRate.add(res.status >= 500);
  } else {
    const res = http.post(`${BASE}/posts`,
      JSON.stringify({ title: 'Bài viết test số 1', content: 'x'.repeat(200) }),
      { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${__ENV.TOKEN}` } },
    );
    errorRate.add(res.status >= 500);
  }

  sleep(Math.random() * 2);      // think time — người thật không bắn liên tục
}
```

```bash
k6 run -e BASE_URL=http://staging.example.com/api -e TOKEN=$TOKEN benchmark/scenario.js
```

### Mẫu ghi chép kết quả

Luôn ghi lại — trí nhớ không đáng tin và bạn sẽ cần so sánh sau vài tháng:

```markdown
## Benchmark 2026-08-11 — thêm index cho posts.status

Môi trường: staging, 2 vCPU / 4GB, Postgres 16, 1.000.000 bản ghi
Kịch bản: 100 VU, 3 phút, tỷ lệ 80/15/5

| Chỉ số | Trước | Sau | Thay đổi |
|---|---|---|---|
| Throughput | 340 req/s | 1.850 req/s | **+444%** |
| p50 | 210 ms | 32 ms | -85% |
| p95 | 890 ms | 78 ms | -91% |
| p99 | 2.400 ms | 190 ms | -92% |
| Tỷ lệ lỗi | 0.4% | 0.0% | — |
| CPU DB | 95% | 22% | -77% |

Thay đổi: `CREATE INDEX CONCURRENTLY idx_posts_status_created ON posts (status, created_at DESC)`
Kết luận: nút thắt tiếp theo chuyển sang serialize JSON (thấy qua trace).
```

---

## 7. Profiling khi không rõ nguyên nhân

### CPU

```bash
node --cpu-prof --cpu-prof-dir=./profiles dist/main.js
# Chạy tải, dừng process, mở file .cpuprofile bằng Chrome DevTools > Performance
```

Hoặc lấy nóng trên production:

```bash
npm i -g clinic
clinic flame -- node dist/main.js
```

Flame graph: cột **rộng** = tốn nhiều thời gian. Tìm cột rộng bất ngờ.

### Rò rỉ bộ nhớ

Dấu hiệu: `heapUsed` tăng đều và **không giảm sau GC**.

```bash
node --inspect dist/main.js
# chrome://inspect -> Memory -> chụp snapshot lúc t=0
# chạy tải 10 phút -> chụp snapshot lúc t=10
# So sánh (Comparison view), sắp xếp theo "Size Delta"
```

Ba nguyên nhân phổ biến nhất trong NestJS:

1. Biến `Map`/mảng cấp module tích luỹ mãi không xoá (cache tự chế không có TTL).
2. Event listener đăng ký trong provider `REQUEST`-scoped mà không gỡ.
3. Timer/interval tạo trong request mà không `clearInterval`.

### Kiểm tra nhanh trước khi profiling

```ts
@Cron(CronExpression.EVERY_MINUTE)
checkMemory() {
  const { heapUsed, heapTotal, rss, external } = process.memoryUsage();
  const mb = (n: number) => Math.round(n / 1024 / 1024);
  this.logger.log({
    heapUsed: mb(heapUsed), heapTotal: mb(heapTotal),
    rss: mb(rss), external: mb(external),
    handles: (process as any)._getActiveHandles?.().length,   // handle tăng = rò rỉ socket/timer
  }, 'memory');
}
```

---

## 8. Checklist observability trước khi lên production

- [ ] Log JSON có cấu trúc, có `redact` cho mật khẩu/token
- [ ] Correlation ID xuyên suốt HTTP → service → queue → worker
- [ ] `X-Request-Id` trả về cho client
- [ ] Endpoint `/metrics` cho Prometheus (có bảo vệ, không public)
- [ ] Bốn chỉ số vàng + 2 chỉ số nghiệp vụ trên dashboard
- [ ] Cảnh báo dựa trên triệu chứng, mỗi cảnh báo đều cần hành động
- [ ] Tracing bật với sampling 1–10%
- [ ] Health check `live` và `ready` tách biệt ([bài 06](./06-chiu-tai-cao.md))
- [ ] Có kết quả benchmark baseline được ghi lại
- [ ] Đã thử một lần: từ "người dùng báo lỗi lúc 14:32" tìm ra đúng chuỗi log trong dưới 2 phút

Mục cuối là bài kiểm tra thật sự. Nếu chưa làm được, phần observability của bạn chưa xong.

---

## 9. Bài tập bài 10

1. Thay toàn bộ `console.log` bằng pino có cấu trúc. Cấu hình `redact` và **chứng minh** mật khẩu không xuất hiện trong log khi gọi `/auth/login`.
2. Cài `nestjs-cls`. Một request phải sinh log ở 3 tầng (controller, service, repository) mang **cùng một** `traceId`.
3. Truyền `traceId` vào BullMQ job và xác nhận log của worker mang đúng id của request gốc.
4. Dựng Prometheus + Grafana bằng Docker. Xuất 4 chỉ số vàng và vẽ dashboard.
5. Thêm 2 chỉ số nghiệp vụ (số bài viết được tạo, số lần đăng nhập thất bại).
6. **Cố tình tạo bẫy cardinality:** dùng URL thật thay vì route pattern làm label, bắn 10.000 request với id khác nhau, quan sát số lượng series trong Prometheus tăng vọt. Sửa lại.
7. Cài OpenTelemetry + Jaeger. Tạo một endpoint gọi DB + Redis + HTTP ngoài, xem trace và chỉ ra bước nào chiếm nhiều thời gian nhất.
8. Viết kịch bản k6 đầy đủ (warm-up + ramp + hỗn hợp 80/15/5) và chạy trên môi trường giống production.
9. **Bài tập tổng hợp:** chạy benchmark baseline, rồi áp dụng lần lượt từng tối ưu của các bài trước (index → cache → queue), đo lại sau **mỗi** bước và lập bảng như mẫu ở mục 6. Xác định tối ưu nào cho hiệu quả trên mỗi giờ công cao nhất.
10. Tạo rò rỉ bộ nhớ có chủ đích (một `Map` cấp module không bao giờ xoá), chạy tải 10 phút, chụp 2 heap snapshot và tìm ra thủ phạm bằng Chrome DevTools.
11. **Diễn tập sự cố:** nhờ ai đó cố ý làm hỏng một thứ (xoá index / tắt Redis / đặt pool = 1) mà không nói cho bạn biết. Dùng dashboard và trace để tìm ra nguyên nhân trong dưới 10 phút.

---

## Kết thúc bộ nâng cao

Bạn đã đi qua 10 bài. Điều quan trọng nhất cần mang theo:

> **Đo trước. Sửa nút thắt thật. Đo lại.**

Mọi kỹ thuật trong bộ tài liệu này — cursor pagination, index, cache, queue, circuit breaker, CQRS — đều là công cụ cho một vấn đề cụ thể. Áp dụng khi chưa có vấn đề chỉ làm hệ thống phức tạp hơn mà không nhanh hơn.

Thứ tự đúng khi hệ thống chậm nằm ở [bài 06 mục 12](./06-chiu-tai-cao.md). In nó ra và dán lên tường.

⬅️ Quay lại [mục lục](./README.md) · [Phần cơ bản](../README.md) · [Docker](../../docker/README.md)
