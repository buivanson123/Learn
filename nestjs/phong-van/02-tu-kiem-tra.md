# Tự kiểm tra NestJS

Với mỗi dòng: **"Tôi giải thích được trong 1 phút, kèm ví dụ từ dự án Blog API không?"**

✅ được · ⚠️ lơ mơ · ❌ không

Ngưỡng đi phỏng vấn: **không còn ❌ ở nhóm A và B**.

---

## A. DI, Provider, Module — bộ lọc

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | DI là gì, NestJS đọc metadata nào để inject | [03](../03-provider-va-di.md) |
| ☐ | Vì sao NestJS bắt buộc TypeScript + `emitDecoratorMetadata` | [00](../00-chuan-bi.md) |
| ☐ | Ba scope, mặc định là gì | [03](../03-provider-va-di.md) |
| ☐ | Vì sao **không** lưu dữ liệu request vào property của service | [10](../10-loi-thuong-gap.md) |
| ☐ | `Scope.REQUEST` lan lên trên — hệ quả hiệu năng | [03](../03-provider-va-di.md) |
| ☐ | `useClass` / `useValue` / `useFactory` / `useExisting` | [03](../03-provider-va-di.md) |
| ☐ | `providers` vs `exports` vs `imports` | [01](../01-kien-truc-nestjs.md) |
| ☐ | Ba bước kiểm tra khi gặp "Nest can't resolve dependencies" | [10](../10-loi-thuong-gap.md) |
| ☐ | Circular dependency — `forwardRef` và **cách tránh** | [03](../03-provider-va-di.md) |
| ☐ | Dynamic module: `forRoot` / `forFeature` / `forRootAsync` | [03](../03-provider-va-di.md) |
| ☐ | `@Global()` — khi nào nên, khi nào lạm dụng | [03](../03-provider-va-di.md) |
| ☐ | Inject token dạng chuỗi bằng `@Inject()` | [03](../03-provider-va-di.md) |
| ☐ | Lifecycle hooks + `enableShutdownHooks()` | [07](../07-config-testing.md) |
| ☐ | Tổ chức module theo feature, không theo tầng | [cau-truc-chuan](../cau-truc-chuan.md) |

---

## B. Vòng đời request — hỏi nhiều nhất

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Thứ tự 5 thành phần** — vẽ được ra giấy | [05 §1](../05-middleware-guard-interceptor.md) |
| ☐ | **Vì sao** Guard trước Pipe | [01 B1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vì sao Interceptor bọc được hai đầu (RxJS) | [05](../05-middleware-guard-interceptor.md) |
| ☐ | Middleware vs Guard — `ExecutionContext` | [05](../05-middleware-guard-interceptor.md) |
| ☐ | Thứ tự nhiều Guard trong `@UseGuards()` | [05](../05-middleware-guard-interceptor.md) |
| ☐ | `Reflector` đọc metadata của handler | [05](../05-middleware-guard-interceptor.md) |
| ☐ | Pipe làm được gì ngoài validate (`ParseIntPipe`) | [05](../05-middleware-guard-interceptor.md) |
| ☐ | `ValidationPipe` với `whitelist` chống mass assignment | [02](../02-controller-routing-dto.md) |
| ☐ | Exception Filter gom lỗi về một định dạng | [05](../05-middleware-guard-interceptor.md) |
| ☐ | `createParamDecorator` + `SetMetadata` | [05](../05-middleware-guard-interceptor.md) |
| ☐ | `APP_GUARD` khác `useGlobalGuards()` chỗ nào | [05](../05-middleware-guard-interceptor.md) |
| ☐ | Guard toàn cục + `@Public()` — vì sao an toàn hơn cách ngược lại | [06](../06-auth-jwt.md) |

---

## C. Database

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | `forRoot` vs `forFeature` của TypeOrmModule | [04](../04-database-typeorm.md) |
| ☐ | N+1 trong TypeORM — phát hiện và sửa | [nc/03](../nang-cao/03-toi-uu-database.md) |
| ☐ | Vì sao `synchronize: true` nguy hiểm trên production | [04](../04-database-typeorm.md) |
| ☐ | Transaction bằng `dataSource.transaction()` | [04](../04-database-typeorm.md) |
| ☐ | Custom repository — lợi ích với `relations` | [01 C5](./01-cau-hoi-va-dap-an.md) |
| ☐ | Index khai bằng `@Index()`, đo bằng `EXPLAIN ANALYZE` | [nc/03](../nang-cao/03-toi-uu-database.md) |
| ☐ | Duyệt bảng lớn: `stream()` / cursor pagination | [nc/02](../nang-cao/02-xu-ly-du-lieu-lon.md) |
| ☐ | TypeORM vs Prisma — nêu được đánh đổi | [04](../04-database-typeorm.md) |
| ☐ | TypeORM đã lên 1.x, `0.3.x` thành `legacy` | [04 §1](../04-database-typeorm.md) |

---

## D. Validation, Auth, Testing

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Vì sao DTO phải là class, không phải interface** | [02](../02-controller-routing-dto.md) |
| ☐ | `ValidationPipe` cấu hình an toàn | [02](../02-controller-routing-dto.md) |
| ☐ | Luồng JWT đầy đủ: ký → strategy → guard | [06](../06-auth-jwt.md) |
| ☐ | Lưu token ở đâu, refresh token, thu hồi thế nào | [06](../06-auth-jwt.md) |
| ☐ | Vì sao dùng `bcrypt.compare()` chứ không `===` | [06](../06-auth-jwt.md) |
| ☐ | `Test.createTestingModule()` + `getRepositoryToken()` | [07](../07-config-testing.md) |
| ☐ | E2E test phải khai lại global pipe của `main.ts` | [07](../07-config-testing.md) |
| ☐ | Validate env lúc khởi động | [07](../07-config-testing.md) |
| ☐ | Exception nghiệp vụ riêng + filter dịch sang HTTP | [01 D10](./01-cau-hoi-va-dap-an.md) |

---

## E. Hiệu năng, vận hành

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Quy trình 5 bước khi ứng dụng chậm | [nc/10](../nang-cao/10-observability-benchmark.md) |
| ☐ | Cache nhiều tầng, và vấn đề xoá cache | [nc/04](../nang-cao/04-cache-nhieu-tang.md) |
| ☐ | BullMQ: job idempotent, backoff, graceful shutdown | [nc/05](../nang-cao/05-queue-va-job-nen.md) |
| ☐ | Rate limit với nhiều instance phải dùng Redis | [nc/06](../nang-cao/06-chiu-tai-cao.md) |
| ☐ | Liveness vs readiness probe | [01 E5](./01-cau-hoi-va-dap-an.md) |
| ☐ | Log có cấu trúc + `requestId` | [nc/10](../nang-cao/10-observability-benchmark.md) |
| ☐ | Vì sao **không** tách microservices sớm | [nc/09](../nang-cao/09-microservices.md) |
| ☐ | CQRS khi nào đáng dùng | [nc/07](../nang-cao/07-cqrs-event-outbox.md) |
| ☐ | Graceful shutdown khi deploy | [07](../07-config-testing.md) |
| ☐ | WebSocket gateway và scale nhiều instance | [nc/08](../nang-cao/08-realtime-websocket-sse.md) |

---

## F. Vẽ được không?

Trong 3 phút, không nhìn tài liệu:

| | Sơ đồ |
|---|---|
| ☐ | Vòng đời request 5 thành phần, có mũi tên hai chiều của Interceptor |
| ☐ | Cây module của Blog API + quan hệ `imports`/`exports` |
| ☐ | Luồng JWT từ đăng nhập tới `request.user` |
| ☐ | Chỗ sinh N+1 và nơi đặt `relations` |

Đối chiếu với [12-so-do-luong-du-lieu.md](../12-so-do-luong-du-lieu.md).

---

## G. Kể được không?

| | Nội dung |
|---|---|
| ☐ | Kể dự án Blog API trong 2 phút, kèm **con số** |
| ☐ | Một lỗi khó: "Nest can't resolve dependencies" và cách bạn lần ra |
| ☐ | Một quyết định có đánh đổi (TypeORM vs Prisma, monolith vs microservices) |
| ☐ | Thích/không thích gì ở NestJS |

---

## Chấm

| Kết quả | Nghĩa |
|---------|-------|
| A còn ❌ | **Chưa nên đi phỏng vấn.** DI là nền tảng của cả framework |
| B còn ❌ | Ôn ngay [bài 05](../05-middleware-guard-interceptor.md) — đây là câu hỏi hay gặp nhất |
| C hoặc D còn ❌ | Ôn 2 ngày, đây là phần thực chiến bị hỏi sâu |
| E toàn ⚠️ | Chấp nhận được ở middle nếu nói được "em biết vấn đề nó giải quyết" |
| F còn ❌ | Nguy hiểm — phỏng vấn NestJS hay yêu cầu vẽ |

---

| Lần | Ngày | ❌ | ⚠️ |
|-----|------|----|----|
| 1 | | | |
| 2 | | | |

---

Quay lại [README phỏng vấn](./README.md) · [Bộ NestJS](../README.md)
