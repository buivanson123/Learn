# Cấu trúc chuẩn cho dự án NestJS lớn

> **Tài liệu này là sổ tay tra cứu, không phải bài học.** Mở ra khi cần biết "file này để đâu, đặt tên thế nào".
>
> Nếu bạn muốn hiểu **tại sao** phải phân tầng → đọc [nang-cao/01-kien-truc-quy-mo-lon.md](./nang-cao/01-kien-truc-quy-mo-lon.md).
> Tài liệu này trả lời **cụ thể phải làm gì**.

---

## 1. Ba nguyên tắc quyết định mọi thứ

Khi phân vân đặt file ở đâu, quay lại ba nguyên tắc này.

### Nguyên tắc 1 — Nhóm theo tính năng, không theo loại file

```
❌ Nhóm theo loại — sửa 1 tính năng phải nhảy 4 thư mục
src/
├── controllers/    posts.controller.ts, users.controller.ts, orders.controller.ts
├── services/       posts.service.ts, users.service.ts, orders.service.ts
├── entities/       post.entity.ts, user.entity.ts, order.entity.ts
└── dto/            create-post.dto.ts, create-user.dto.ts, ...

✅ Nhóm theo tính năng — mọi thứ về "posts" nằm cùng một chỗ
src/modules/
├── posts/          controller + service + entity + dto của posts
├── users/
└── orders/
```

Phép thử: *"Xoá hoàn toàn tính năng Posts cần xoá bao nhiêu thư mục?"* Câu trả lời đúng là **một**.

### Nguyên tắc 2 — Phụ thuộc chỉ đi một chiều

```
modules/  ──có thể dùng──►  shared/  ──có thể dùng──►  config/
   │
   └── KHÔNG được: shared/ import modules/
                   config/ import bất cứ thứ gì
```

`shared/` mà import `modules/posts` là lỗi thiết kế — nó không còn "dùng chung" được nữa.

### Nguyên tắc 3 — Tường minh hơn ngắn gọn

Trong dự án 5 người thì `p.service.ts` là đủ. Trong dự án 50 người và 200 file, tên đầy đủ tiết kiệm nhiều thời gian hơn số ký tự nó tốn thêm.

---

## 2. Cây thư mục chuẩn

Đây là bản tham chiếu đầy đủ. Không phải dự án nào cũng cần hết — mục 3 nói rõ cái nào bắt buộc.

```
blog-api/
├── src/
│   ├── main.ts                          # Bootstrap: pipe/filter/interceptor toàn cục
│   ├── app.module.ts                    # Module gốc: chỉ import, KHÔNG chứa logic
│   │
│   ├── config/                          # ⚙️ Cấu hình — KHÔNG phụ thuộc gì cả
│   │   ├── app.config.ts                #    registerAs('app', ...)
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── jwt.config.ts
│   │   ├── env.validation.ts            #    Joi schema kiểm tra .env
│   │   └── index.ts                     #    export mảng [appConfig, dbConfig, ...]
│   │
│   ├── shared/                          # 🔧 Hạ tầng dùng chung — KHÔNG chứa nghiệp vụ
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   ├── public.decorator.ts
│   │   │   ├── roles.decorator.ts
│   │   │   └── api-paginated.decorator.ts
│   │   ├── dto/
│   │   │   ├── pagination-query.dto.ts
│   │   │   ├── cursor-query.dto.ts
│   │   │   └── id-param.dto.ts
│   │   ├── entities/
│   │   │   └── base.entity.ts           #    id + timestamps + soft delete
│   │   ├── enums/
│   │   │   └── sort-order.enum.ts
│   │   ├── exceptions/
│   │   │   ├── domain.exception.ts
│   │   │   └── business-rule.exception.ts
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── query-failed.filter.ts   #    bắt lỗi TypeORM (unique violation...)
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts
│   │   │   ├── timeout.interceptor.ts
│   │   │   └── logging.interceptor.ts
│   │   ├── pipes/
│   │   │   └── parse-object-id.pipe.ts
│   │   ├── utils/
│   │   │   ├── slugify.util.ts
│   │   │   ├── pagination.util.ts
│   │   │   └── cursor.util.ts
│   │   └── types/
│   │       ├── paginated-result.type.ts
│   │       └── express-request.d.ts     #    mở rộng Request để có req.user
│   │
│   ├── infrastructure/                  # 🔌 Kết nối thế giới bên ngoài
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   ├── data-source.ts           #    dùng cho TypeORM CLI
│   │   │   ├── transaction.service.ts   #    Unit of Work (xem nang-cao/01)
│   │   │   ├── migrations/
│   │   │   │   └── 1723000000000-CreatePosts.ts
│   │   │   └── seeds/
│   │   │       ├── seed.ts
│   │   │       └── factories/post.factory.ts
│   │   ├── cache/
│   │   │   ├── cache.module.ts
│   │   │   ├── cache.service.ts
│   │   │   └── cache-keys.ts            #    TẬP TRUNG mọi key ở đây
│   │   ├── queue/
│   │   │   ├── queue.module.ts
│   │   │   └── queue-names.ts
│   │   ├── storage/
│   │   │   ├── storage.port.ts          #    interface
│   │   │   ├── s3.storage.ts            #    cài đặt
│   │   │   └── local.storage.ts
│   │   ├── mail/
│   │   └── observability/
│   │       ├── logger.module.ts
│   │       ├── metrics.service.ts
│   │       └── tracing.ts
│   │
│   ├── modules/                         # 🎯 Nghiệp vụ — nơi bạn dành 90% thời gian
│   │   ├── auth/
│   │   ├── users/
│   │   ├── posts/
│   │   ├── comments/
│   │   └── health/
│   │
│   └── jobs/                            # ⏰ Worker & cron (nếu không tách app riêng)
│       ├── processors/
│       │   ├── email.processor.ts
│       │   └── export.processor.ts
│       └── schedulers/
│           └── cleanup.scheduler.ts
│
├── test/
│   ├── e2e/
│   │   ├── posts.e2e-spec.ts
│   │   └── jest-e2e.json
│   ├── fixtures/
│   │   └── post.fixture.ts
│   └── setup/
│       ├── test-db.ts                   #    testcontainers hoặc DB test riêng
│       └── app.factory.ts               #    dựng app cho e2e, dùng lại nhiều nơi
│
├── scripts/
│   ├── seed.ts
│   └── check-env.ts
│
├── docs/
│   ├── architecture.md
│   ├── adr/                             #    Architecture Decision Records
│   │   └── 001-chon-typeorm.md
│   └── api.md
│
├── .env.example                         # ⚠️ luôn commit file này, KHÔNG commit .env
├── .eslintrc.js / eslint.config.js
├── .dependency-cruiser.js               #    ép ranh giới kiến trúc
├── docker-compose.dev.yml
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
└── package.json
```

---

## 3. Cái nào bắt buộc, cái nào tuỳ quy mô

Đừng dựng hết ngay từ đầu. Thêm dần theo nhu cầu thật:

| Thư mục | < 10 module | 10–30 module | > 30 module |
|---|---|---|---|
| `config/` | ✅ Bắt buộc | ✅ | ✅ |
| `shared/` | ✅ Bắt buộc | ✅ | ✅ |
| `modules/<feature>/` | ✅ Bắt buộc | ✅ | ✅ |
| `infrastructure/` | ⬜ Gộp vào `shared/` | ✅ Tách ra | ✅ |
| Phân tầng domain/application | ⬜ Không cần | 🔶 Chỉ module phức tạp | ✅ |
| `jobs/` riêng | ⬜ | ✅ | ✅ Tách app riêng |
| Monorepo | ⬜ | ⬜ | 🔶 Khi có nhiều app |
| `docs/adr/` | ⬜ | ✅ | ✅ |

> Dấu hiệu **cần** nâng cấp cấu trúc: mất hơn 30 giây để tìm file cần sửa, hoặc hai người thường xuyên sửa cùng một file.

---

## 4. Bảng tra: "Tôi vừa viết cái này, để đâu?"

Đây là phần được dùng nhiều nhất trong tài liệu.

| Bạn vừa viết... | Đặt tại | Ví dụ |
|---|---|---|
| Hàm format ngày dùng ở 5 module | `shared/utils/` | `shared/utils/date.util.ts` |
| Hàm tính giá đơn hàng | `modules/orders/` | `modules/orders/domain/pricing.ts` |
| Decorator `@CurrentUser()` | `shared/decorators/` | `shared/decorators/current-user.decorator.ts` |
| DTO phân trang dùng chung | `shared/dto/` | `shared/dto/pagination-query.dto.ts` |
| DTO tạo bài viết | `modules/posts/dto/` | `modules/posts/dto/create-post.dto.ts` |
| Guard kiểm tra JWT | `shared/guards/` | `shared/guards/jwt-auth.guard.ts` |
| Guard kiểm tra "có phải tác giả bài này" | `modules/posts/guards/` | `modules/posts/guards/post-owner.guard.ts` |
| Interface gọi S3 | `infrastructure/storage/` | `infrastructure/storage/storage.port.ts` |
| Enum `PostStatus` | `modules/posts/enums/` | `modules/posts/enums/post-status.enum.ts` |
| Enum `SortOrder` (dùng khắp nơi) | `shared/enums/` | `shared/enums/sort-order.enum.ts` |
| Biến môi trường mới | `config/` + `.env.example` | `config/redis.config.ts` |
| Migration | `infrastructure/database/migrations/` | tự sinh bằng CLI |
| Processor BullMQ | `jobs/processors/` | `jobs/processors/email.processor.ts` |
| Cron job | `jobs/schedulers/` | `jobs/schedulers/cleanup.scheduler.ts` |
| Event class | `modules/<owner>/events/` | `modules/posts/events/post-published.event.ts` |
| Listener của event đó | **Module lắng nghe**, không phải module phát | `modules/search/listeners/post.listener.ts` |
| Test unit | Cạnh file được test | `posts.service.spec.ts` |
| Test e2e | `test/e2e/` | `test/e2e/posts.e2e-spec.ts` |

### Quy tắc phân xử khi vẫn phân vân

> **Hỏi: "Cái này có chứa kiến thức nghiệp vụ không?"**
>
> - **Có** (biết "bài viết cần 100 ký tự mới được xuất bản") → `modules/`
> - **Không** (chỉ là kỹ thuật thuần: format, parse, kết nối) → `shared/` hoặc `infrastructure/`

> **Hỏi: "Bao nhiêu module đang dùng nó?"**
>
> - **1 module** → để trong module đó, kể cả khi trông có vẻ chung chung
> - **2 module** → vẫn để nguyên, copy sang module thứ hai cũng được
> - **3 module trở lên** → lúc này mới tách ra `shared/`

Trừu tượng hoá sớm là sai lầm phổ biến hơn lặp code. Hai đoạn code giống nhau hôm nay có thể tiến hoá theo hai hướng khác nhau vào tháng sau.

---

## 5. Giải phẫu một module

Đây là khuôn mẫu cho **mọi** module. Ba mức độ, chọn theo độ phức tạp.

### Mức 1 — CRUD đơn giản (Tags, Categories, Settings)

```
modules/tags/
├── dto/
│   ├── create-tag.dto.ts
│   └── update-tag.dto.ts
├── entities/
│   └── tag.entity.ts
├── tags.controller.ts
├── tags.service.ts
├── tags.service.spec.ts
└── tags.module.ts
```

Đừng phân tầng cho module kiểu này. Thêm tầng chỉ tăng số file mà không mang lại gì.

### Mức 2 — Có nghiệp vụ (Posts, Comments)

```
modules/posts/
├── dto/
│   ├── create-post.dto.ts
│   ├── update-post.dto.ts
│   └── find-posts.dto.ts
├── entities/
│   └── post.entity.ts
├── enums/
│   └── post-status.enum.ts
├── events/
│   └── post-published.event.ts
├── guards/
│   └── post-owner.guard.ts
├── repositories/
│   └── post.repository.ts           # query phức tạp tách khỏi service
├── posts.controller.ts
├── posts.service.ts
├── posts.service.spec.ts
└── posts.module.ts
```

### Mức 3 — Nghiệp vụ phức tạp (Orders, Billing)

```
modules/orders/
├── domain/                          # ⚠️ KHÔNG import @nestjs/* hay typeorm
│   ├── order.model.ts
│   ├── order-status.enum.ts
│   ├── order.repository.port.ts
│   ├── pricing.service.ts
│   └── errors.ts
├── application/
│   ├── commands/
│   │   ├── create-order.use-case.ts
│   │   └── cancel-order.use-case.ts
│   ├── queries/
│   │   └── get-order-detail.query.ts
│   └── dto/
├── infrastructure/
│   ├── order.entity.ts
│   ├── typeorm-order.repository.ts
│   └── order.mapper.ts
├── presentation/
│   ├── orders.controller.ts
│   └── orders.gateway.ts
└── orders.module.ts
```

Chi tiết cách viết từng tầng: [nang-cao/01](./nang-cao/01-kien-truc-quy-mo-lon.md#2-ví-dụ-tách-tầng-một-use-case).

> **Không bắt cả dự án dùng chung một mức.** Hoàn toàn bình thường khi `orders/` ở mức 3 còn `tags/` ở mức 1. Ép mức 3 cho mọi module là cách nhanh nhất để cả team ghét kiến trúc.

---

## 6. File mẫu — nội dung thật

### `src/config/app.config.ts`

```ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'Blog API',
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: process.env.CORS_ORIGIN?.split(',') ?? ['*'],
}));
```

### `src/config/env.validation.ts`

```ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASS: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
});
```

### `src/config/index.ts`

```ts
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';

export const configurations = [appConfig, databaseConfig, redisConfig, jwtConfig];
export { envValidationSchema } from './env.validation';
```

### `src/app.module.ts` — chỉ lắp ráp, không logic

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { configurations, envValidationSchema } from './config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AppCacheModule } from './infrastructure/cache/cache.module';
import { LoggerModule } from './infrastructure/observability/logger.module';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';
import { HealthModule } from './modules/health/health.module';

import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

@Module({
  imports: [
    // 1. Cấu hình luôn đứng đầu
    ConfigModule.forRoot({
      isGlobal: true,
      load: configurations,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),

    // 2. Hạ tầng
    LoggerModule,
    DatabaseModule,
    AppCacheModule,

    // 3. Nghiệp vụ (xếp theo alphabet cho dễ tìm)
    AuthModule,
    HealthModule,
    PostsModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },       // thứ tự có ý nghĩa
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

> `app.module.ts` **không được** có `controllers` hay service nghiệp vụ. Nó chỉ là bảng mạch. Thấy logic ở đây nghĩa là thiếu một module.

### `src/shared/entities/base.entity.ts`

```ts
import {
  PrimaryGeneratedColumn, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
```

### `src/infrastructure/cache/cache-keys.ts` — tập trung một chỗ

```ts
export const CacheKeys = {
  post:      (id: number) => `post:${id}`,
  postList:  (hash: string) => `posts:list:${hash}`,
  userPosts: (userId: number) => `user:${userId}:posts`,
} as const;

export const CacheTtl = {
  SHORT:  30_000,
  MEDIUM: 300_000,
  LONG:   3_600_000,
} as const;
```

Tập trung key ở một file giúp trả lời được câu hỏi *"sửa bài viết thì phải xoá những cache nào?"* — thứ gần như không thể nếu key rải rác trong 50 service.

---

## 7. Quy ước đặt tên

### File và class

| Loại | File (kebab-case) | Class (PascalCase) |
|---|---|---|
| Module | `posts.module.ts` | `PostsModule` |
| Controller | `posts.controller.ts` | `PostsController` |
| Service | `posts.service.ts` | `PostsService` |
| Repository | `post.repository.ts` | `PostRepository` |
| Entity | `post.entity.ts` *(số ít)* | `Post` |
| DTO | `create-post.dto.ts` | `CreatePostDto` |
| Use case | `publish-post.use-case.ts` | `PublishPostUseCase` |
| Guard | `post-owner.guard.ts` | `PostOwnerGuard` |
| Interceptor | `transform.interceptor.ts` | `TransformInterceptor` |
| Filter | `all-exceptions.filter.ts` | `AllExceptionsFilter` |
| Pipe | `parse-slug.pipe.ts` | `ParseSlugPipe` |
| Decorator | `current-user.decorator.ts` | `CurrentUser` |
| Event | `post-published.event.ts` | `PostPublishedEvent` |
| Processor | `email.processor.ts` | `EmailProcessor` |
| Enum | `post-status.enum.ts` | `PostStatus` |
| Interface/Port | `storage.port.ts` | `StoragePort` |
| Type | `paginated-result.type.ts` | `PaginatedResult` |
| Util | `slugify.util.ts` | hàm `slugify()` |
| Test | `posts.service.spec.ts` | — |

**Số nhiều hay số ít:** thư mục và module dùng **số nhiều** (`posts/`, `PostsModule`), entity dùng **số ít** (`Post`). Lý do: module quản lý nhiều bài viết, entity mô tả một bài viết.

### Method trong service — dùng chung một bộ động từ

```ts
findAll()      // danh sách
findOne(id)    // một bản ghi, không có thì throw
findBySlug()   // tìm theo tiêu chí khác
exists(id)     // trả boolean
create(dto)
update(id, dto)
remove(id)     // xoá mềm
restore(id)
```

Đừng để chỗ này `getUsers()`, chỗ kia `fetchUsers()`, chỗ khác `listUsers()`. Một bộ động từ nhất quán giúp đoán được tên hàm mà không cần mở file.

### Các quy ước còn lại

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Bảng DB | snake_case, số nhiều | `posts`, `post_tags` |
| Cột DB | snake_case | `created_at`, `author_id` |
| Property TS | camelCase | `createdAt`, `authorId` |
| Endpoint | kebab-case, danh từ số nhiều | `GET /api/posts/:id/comments` |
| Biến môi trường | SCREAMING_SNAKE_CASE | `DB_HOST`, `JWT_SECRET` |
| Event | `<danh-từ>.<động-từ-quá-khứ>` | `post.published`, `order.cancelled` |
| Queue | kebab-case | `email`, `image-processing` |
| Tên job | kebab-case, động từ | `send-welcome-email` |
| Cache key | `<thực-thể>:<id>:<phần>` | `post:123:comments` |
| Migration | timestamp + PascalCase | `1723000000000-AddSlugToPosts.ts` |
| Nhánh git | `<loại>/<mô-tả>` | `feat/cursor-pagination` |

> Ánh xạ camelCase ↔ snake_case: khai báo `@Column({ name: 'author_id' }) authorId: number`, hoặc bật `namingStrategy` toàn cục bằng `typeorm-naming-strategies` để khỏi ghi tay từng cột.

---

## 8. Quy ước bên trong file

### Thứ tự import — 4 nhóm, cách nhau một dòng trống

```ts
// 1. Thư viện ngoài
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

// 2. Shared / infrastructure
import { CacheService } from '@infrastructure/cache/cache.service';
import { PaginatedResult } from '@shared/types/paginated-result.type';

// 3. Module khác
import { UsersService } from '@modules/users/users.service';

// 4. Trong cùng module (đường dẫn tương đối)
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
```

Ép tự động bằng ESLint thay vì nhắc nhau trong code review:

```js
// eslint.config.js
'import/order': ['error', {
  groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
  pathGroups: [
    { pattern: '@shared/**', group: 'internal', position: 'before' },
    { pattern: '@infrastructure/**', group: 'internal' },
    { pattern: '@modules/**', group: 'internal', position: 'after' },
  ],
  'newlines-between': 'always',
  alphabetize: { order: 'asc' },
}],
```

### Thứ tự thành phần trong class

```ts
@Injectable()
export class PostsService {
  // 1. Hằng số tĩnh
  private static readonly MAX_TITLE_LENGTH = 255;

  // 2. Property
  private readonly logger = new Logger(PostsService.name);

  // 3. Constructor
  constructor(
    @InjectRepository(Post) private readonly repo: Repository<Post>,
    private readonly cache: CacheService,
  ) {}

  // 4. Method public — theo thứ tự CRUD
  async findAll() {}
  async findOne(id: number) {}
  async create(dto: CreatePostDto) {}
  async update(id: number, dto: UpdatePostDto) {}
  async remove(id: number) {}

  // 5. Method private ở cuối
  private async generateSlug(title: string) {}
}
```

### Barrel file (`index.ts`) — dùng có chọn lọc

```ts
// ✅ Nên: gom API công khai của một module
// modules/posts/index.ts
export { PostsModule } from './posts.module';
export { PostsService } from './posts.service';
export type { Post } from './entities/post.entity';
```

```ts
// ❌ Không nên: barrel cho mọi thư mục nhỏ
// shared/utils/index.ts export * from mọi file
```

Lý do tránh lạm dụng: barrel `export *` gây **phụ thuộc vòng** rất khó gỡ (A → index → B → index → A), và làm chậm khởi động vì import cả file không dùng. Chỉ tạo barrel ở **ranh giới module**, đúng một cấp.

---

## 9. Ép tuân thủ bằng công cụ

Quy ước không có công cụ kiểm tra sẽ bị phá trong 2 tuần. Đây là phần quan trọng nhất của tài liệu này.

### 9.1 Path alias

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@config/*":         ["config/*"],
      "@shared/*":         ["shared/*"],
      "@infrastructure/*": ["infrastructure/*"],
      "@modules/*":        ["modules/*"],
      "@jobs/*":           ["jobs/*"]
    }
  }
}
```

```json
// package.json — để Jest hiểu alias
"jest": {
  "rootDir": "src",
  "moduleNameMapper": {
    "^@config/(.*)$":         "<rootDir>/config/$1",
    "^@shared/(.*)$":         "<rootDir>/shared/$1",
    "^@infrastructure/(.*)$": "<rootDir>/infrastructure/$1",
    "^@modules/(.*)$":        "<rootDir>/modules/$1",
    "^@jobs/(.*)$":           "<rootDir>/jobs/$1"
  }
}
```

### 9.2 `dependency-cruiser` — chặn vi phạm ranh giới

```bash
npm i -D dependency-cruiser
npx depcruise --init
```

```js
// .dependency-cruiser.js
module.exports = {
  forbidden: [
    {
      name: 'khong-phu-thuoc-vong',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-khong-dung-modules',
      comment: 'shared/ phải độc lập với nghiệp vụ',
      severity: 'error',
      from: { path: '^src/shared' },
      to: { path: '^src/modules' },
    },
    {
      name: 'config-khong-phu-thuoc-gi',
      severity: 'error',
      from: { path: '^src/config' },
      to: { path: '^src/(modules|shared|infrastructure)' },
    },
    {
      name: 'domain-khong-dung-framework',
      comment: 'Tầng domain phải test được không cần NestJS/TypeORM',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain' },
      to: { path: 'node_modules/(@nestjs|typeorm|ioredis)' },
    },
    {
      name: 'khong-cham-ruot-module-khac',
      comment: 'Chỉ dùng thứ module kia export ở index.ts',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)' },
      to: {
        path: '^src/modules/(?!$1)([^/]+)/(?!index)',
        pathNot: '^src/modules/$1',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
```

```json
// package.json
"scripts": {
  "arch:check": "depcruise src --config .dependency-cruiser.js",
  "arch:graph": "depcruise src --config .dependency-cruiser.js --output-type dot | dot -T svg > docs/architecture.svg"
}
```

Chạy thử trên dự án có vi phạm:

```
  error khong-phu-thuoc-vong: src/modules/posts/posts.service.ts →
      src/modules/users/users.service.ts →
      src/modules/posts/posts.service.ts

  error shared-khong-dung-modules: src/shared/utils/format.util.ts →
      src/modules/posts/entities/post.entity.ts

✘ 2 dependency violations (2 errors, 0 warnings). 148 modules, 312 dependencies cruised.
```

Gắn vào CI để không ai merge được code vi phạm:

```yaml
# .github/workflows/ci.yml
- run: npm run arch:check
```

Lệnh `arch:graph` sinh sơ đồ phụ thuộc — rất hữu ích khi onboarding người mới.

### 9.3 Sinh module mới đúng chuẩn

Nest CLI sinh code theo mẫu mặc định, không theo quy ước của bạn. Dùng `plop` để mọi người tạo module giống hệt nhau:

```bash
npm i -D plop
```

```js
// plopfile.js
module.exports = function (plop) {
  plop.setGenerator('module', {
    description: 'Tạo module theo cấu trúc chuẩn của dự án',
    prompts: [
      { type: 'input', name: 'name', message: 'Tên module (số nhiều, vd: posts):' },
      {
        type: 'list', name: 'level', message: 'Mức độ phức tạp:',
        choices: [
          { name: 'Mức 1 — CRUD đơn giản', value: 'simple' },
          { name: 'Mức 2 — Có nghiệp vụ', value: 'standard' },
          { name: 'Mức 3 — Phân tầng đầy đủ', value: 'layered' },
        ],
      },
    ],
    actions: (data) => {
      const base = 'src/modules/{{kebabCase name}}';
      const common = [
        { type: 'add', path: `${base}/{{kebabCase name}}.module.ts`,     templateFile: 'templates/module.hbs' },
        { type: 'add', path: `${base}/{{kebabCase name}}.controller.ts`, templateFile: 'templates/controller.hbs' },
        { type: 'add', path: `${base}/{{kebabCase name}}.service.ts`,    templateFile: 'templates/service.hbs' },
        { type: 'add', path: `${base}/dto/create-{{kebabCase (singular name)}}.dto.ts`, templateFile: 'templates/create-dto.hbs' },
        { type: 'add', path: `${base}/entities/{{kebabCase (singular name)}}.entity.ts`, templateFile: 'templates/entity.hbs' },
        { type: 'add', path: `${base}/index.ts`, templateFile: 'templates/index.hbs' },
      ];
      if (data.level === 'layered') {
        common.push(
          { type: 'add', path: `${base}/domain/.gitkeep`, template: '' },
          { type: 'add', path: `${base}/application/.gitkeep`, template: '' },
          { type: 'add', path: `${base}/infrastructure/.gitkeep`, template: '' },
        );
      }
      return common;
    },
  });
};
```

```bash
npx plop module
# ? Tên module (số nhiều, vd: posts): orders
# ? Mức độ phức tạp: Mức 3 — Phân tầng đầy đủ
# ✔ ++ src/modules/orders/orders.module.ts
# ✔ ++ src/modules/orders/orders.controller.ts
# ...
```

### 9.4 Chặn vi phạm ngay lúc commit

```bash
npm i -D husky lint-staged
npx husky init
```

```json
// package.json
"lint-staged": {
  "*.ts": ["eslint --fix", "prettier --write"]
}
```

```bash
# .husky/pre-commit
npx lint-staged
npm run arch:check
```

---

## 10. Chỗ đặt test

Hai kiểu, dùng cả hai:

```
src/modules/posts/
├── posts.service.ts
└── posts.service.spec.ts      # ✅ Unit test NẰM CẠNH file được test

test/
├── e2e/
│   └── posts.e2e-spec.ts      # ✅ E2E test tách riêng
├── fixtures/
│   └── post.fixture.ts        # dữ liệu mẫu dùng lại
└── setup/
    └── app.factory.ts         # dựng app cho e2e
```

Vì sao unit test đặt cạnh: xoá module là xoá luôn test của nó, và mở file service thấy ngay test bên cạnh nên khó quên cập nhật.

`test/setup/app.factory.ts` tránh lặp code dựng app ở mọi file e2e:

```ts
export async function createTestApp(overrides?: (b: TestingModuleBuilder) => void) {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  overrides?.(builder);

  const app = (await builder.compile()).createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}
```

---

## 11. Monorepo — khi có nhiều ứng dụng

Chỉ chuyển khi thật sự có **nhiều app** dùng chung code (API + worker + cron + admin).

```bash
nest generate app worker
nest generate library shared-domain
```

```
apps/
├── api/src/          # HTTP API
├── worker/src/       # chỉ chạy BullMQ processor
└── cron/src/         # chỉ chạy scheduled job
libs/
├── shared-domain/    # entity, model, port
├── shared-infra/     # database, cache, queue
└── shared-utils/
```

```ts
import { PostModel } from '@app/shared-domain';
```

```bash
npm run start:dev api
npm run start:dev worker
nest build api
```

Lý do tách worker khỏi API: scale độc lập — 10 container API nhẹ, 2 container worker nặng RAM. Chi tiết ở [nang-cao/05 mục 11](./nang-cao/05-queue-va-job-nen.md).

> Monorepo làm build chậm hơn và cấu hình phức tạp hơn. Một app thì đừng dùng.

---

## 12. Checklist review cấu trúc

Dùng khi review PR hoặc tự kiểm tra định kỳ:

- [ ] File mới nằm đúng chỗ theo bảng ở mục 4
- [ ] Tên file và class theo đúng quy ước mục 7
- [ ] `app.module.ts` không có controller hay logic nghiệp vụ
- [ ] Module chỉ `exports` thứ module khác thực sự cần
- [ ] Không có module nào import trực tiếp vào ruột module khác
- [ ] `shared/` không import `modules/`
- [ ] Thư mục `domain/` không import `@nestjs/*` hay `typeorm`
- [ ] Không có phụ thuộc vòng (`npm run arch:check` xanh)
- [ ] Biến môi trường mới đã có trong `.env.example` **và** `env.validation.ts`
- [ ] Cache key mới khai báo trong `cache-keys.ts`, không viết chuỗi rời rạc
- [ ] Service không vượt 300 dòng hoặc 10 dependency
- [ ] Controller mỗi method dưới 5 dòng
- [ ] Unit test nằm cạnh file được test

---

## 13. Dọn dẹp dự án đang lộn xộn

Đừng viết lại từ đầu. Làm từng bước, mỗi bước là một PR merge được, hệ thống luôn chạy được.

**Bước 1 — Đo hiện trạng.** Cài `dependency-cruiser`, chạy `arch:graph`, xuất sơ đồ. Bạn sẽ thấy rõ chỗ nào rối nhất.

**Bước 2 — Thêm path alias.** Thuần cơ học, không đổi logic, rủi ro gần bằng không. Làm ngay.

**Bước 3 — Gom theo tính năng.** Di chuyển file từ `controllers/`, `services/` về `modules/<feature>/`. Dùng tính năng "Move file" của IDE để nó tự sửa import. Mỗi PR di chuyển **một** module.

**Bước 4 — Tách `shared/` và `infrastructure/`.** Nhặt những thứ dùng chung ra. Áp quy tắc "3 module trở lên mới tách" ở mục 4.

**Bước 5 — Bật rule kiến trúc ở mức `warn`.** Đếm số vi phạm, ghi lại con số.

**Bước 6 — Giảm dần vi phạm.** Mỗi sprint sửa một nhóm. Khi về 0, đổi `warn` thành `error` và gắn vào CI.

**Bước 7 — Chỉ phân tầng module phức tạp nhất.** Một module thôi. Đánh giá sau 1 tháng xem team có thấy dễ làm hơn không, rồi mới quyết định nhân rộng.

> Chống chỉ định: "dừng làm tính năng 2 tháng để refactor kiến trúc". Nó gần như luôn thất bại — nhánh refactor lệch quá xa nhánh chính và không bao giờ merge được.

---

## Tài liệu liên quan

- [Phần cơ bản](./README.md) — nếu bạn chưa quen NestJS
- [nang-cao/01 — Kiến trúc quy mô lớn](./nang-cao/01-kien-truc-quy-mo-lon.md) — *tại sao* phân tầng, Unit of Work, monorepo
- [nang-cao/README](./nang-cao/README.md) — xử lý dữ liệu lớn & chịu tải cao
- [09-cheatsheet.md](./09-cheatsheet.md) — tra nhanh decorator và CLI
