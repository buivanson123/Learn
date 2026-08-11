# Bài 1 — Kiến trúc cho dự án quy mô lớn

Khi dự án vượt ~30 module, cách tổ chức "controller + service" của phần cơ bản bắt đầu đau ở ba chỗ: service phình to hàng nghìn dòng, các module gọi chéo nhau thành mạng nhện, và đổi ORM thì phải sửa cả trăm file. Bài này xử lý cả ba.

> **Bài này giải thích *tại sao*.** Cần tra cứu *cụ thể phải làm gì* — cây thư mục đầy đủ, bảng "file này để đâu", quy ước đặt tên — xem [cau-truc-chuan.md](../cau-truc-chuan.md).

---

## 1. Vấn đề: Service phình to

Một `PostsService` sau 6 tháng thường trông thế này:

```ts
@Injectable()
export class PostsService {
  // 40 dependency
  constructor(
    @InjectRepository(Post) private repo: Repository<Post>,
    private mailService: MailService,
    private searchService: SearchService,
    private cacheService: CacheService,
    private storageService: StorageService,
    // ... 35 cái nữa
  ) {}

  // 1800 dòng, 40 method, mỗi method vừa validate vừa query vừa gửi mail
}
```

Không test được, không đọc được, hai người sửa cùng lúc là conflict.

### Giải pháp: tách theo tầng, không theo kỹ thuật

```
┌─────────────────────────────────────────────┐
│  PRESENTATION  — Controller, Gateway, CLI   │  Nhận input, trả output
├─────────────────────────────────────────────┤
│  APPLICATION   — Use case / Command handler │  Điều phối: gọi domain + hạ tầng
├─────────────────────────────────────────────┤
│  DOMAIN        — Entity, Value Object, Rule │  Quy tắc nghiệp vụ thuần tuý
├─────────────────────────────────────────────┤
│  INFRASTRUCTURE— Repository, HTTP client... │  Nói chuyện với thế giới bên ngoài
└─────────────────────────────────────────────┘
```

**Quy tắc phụ thuộc:** mũi tên chỉ đi từ **trên xuống dưới** và từ **ngoài vào trong**. Domain không được import bất cứ thứ gì của TypeORM, Redis hay Express.

> ⚠️ Đừng áp dụng đủ 4 tầng cho mọi module. Một module CRUD đơn giản (Tags, Categories) giữ nguyên controller + service là hợp lý. Chỉ tách tầng cho module có **nghiệp vụ phức tạp** (Orders, Billing, Posts).

---

## 2. Ví dụ tách tầng một use case

Nghiệp vụ: *xuất bản một bài viết* — kiểm tra quyền, kiểm tra bài đủ điều kiện, đổi trạng thái, đánh index tìm kiếm, gửi thông báo cho người theo dõi.

### 2.1 Domain — quy tắc thuần tuý, không phụ thuộc gì

```ts
// src/posts/domain/post.model.ts
export class PostModel {
  constructor(
    public readonly id: number,
    public readonly authorId: number,
    public title: string,
    public content: string,
    public status: PostStatus,
    public publishedAt: Date | null,
  ) {}

  /** Quy tắc nghiệp vụ: bài viết đủ điều kiện xuất bản chưa? */
  canBePublished(): { ok: true } | { ok: false; reason: string } {
    if (this.status === PostStatus.PUBLISHED) {
      return { ok: false, reason: 'Bài viết đã được xuất bản' };
    }
    if (this.title.trim().length < 10) {
      return { ok: false, reason: 'Tiêu đề phải từ 10 ký tự' };
    }
    if (this.content.trim().length < 100) {
      return { ok: false, reason: 'Nội dung phải từ 100 ký tự' };
    }
    return { ok: true };
  }

  publish(now: Date): void {
    const check = this.canBePublished();
    if (!check.ok) throw new DomainError(check.reason);
    this.status = PostStatus.PUBLISHED;
    this.publishedAt = now;
  }

  isOwnedBy(userId: number): boolean {
    return this.authorId === userId;
  }
}
```

File này **test được mà không cần database, không cần NestJS**:

```ts
it('không cho xuất bản bài có nội dung quá ngắn', () => {
  const post = new PostModel(1, 1, 'Tiêu đề đủ dài', 'ngắn', PostStatus.DRAFT, null);
  expect(post.canBePublished()).toEqual({ ok: false, reason: 'Nội dung phải từ 100 ký tự' });
});
```

Chạy trong vài mili-giây. Đây là lợi ích lớn nhất của việc tách domain.

### 2.2 Port — hợp đồng với thế giới bên ngoài

```ts
// src/posts/domain/post.repository.port.ts
export const POST_REPOSITORY = Symbol('POST_REPOSITORY');

export interface PostRepositoryPort {
  findById(id: number): Promise<PostModel | null>;
  save(post: PostModel): Promise<void>;
}
```

```ts
// src/posts/domain/notifier.port.ts
export const NOTIFIER = Symbol('NOTIFIER');

export interface NotifierPort {
  notifyFollowers(authorId: number, postId: number): Promise<void>;
}
```

Đây chỉ là interface — không có dòng code TypeORM nào.

### 2.3 Application — use case điều phối

```ts
// src/posts/application/publish-post.use-case.ts
import { Inject, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';

@Injectable()
export class PublishPostUseCase {
  constructor(
    @Inject(POST_REPOSITORY) private readonly posts: PostRepositoryPort,
    @Inject(NOTIFIER) private readonly notifier: NotifierPort,
  ) {}

  async execute(postId: number, currentUserId: number): Promise<void> {
    const post = await this.posts.findById(postId);
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${postId}`);

    if (!post.isOwnedBy(currentUserId)) {
      throw new ForbiddenException('Bạn không phải tác giả bài viết này');
    }

    post.publish(new Date());          // quy tắc nghiệp vụ nằm trong domain
    await this.posts.save(post);

    // Việc phụ, không nên chặn response — xem bài 05 (queue)
    await this.notifier.notifyFollowers(post.authorId, post.id);
  }
}
```

Một use case = **một class, một method `execute()`**. Dễ đặt tên, dễ tìm, dễ test.

### 2.4 Infrastructure — cài đặt cụ thể

```ts
// src/posts/infrastructure/typeorm-post.repository.ts
@Injectable()
export class TypeormPostRepository implements PostRepositoryPort {
  constructor(@InjectRepository(PostEntity) private readonly repo: Repository<PostEntity>) {}

  async findById(id: number): Promise<PostModel | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? PostMapper.toDomain(row) : null;
  }

  async save(post: PostModel): Promise<void> {
    await this.repo.save(PostMapper.toPersistence(post));
  }
}
```

```ts
// src/posts/infrastructure/post.mapper.ts
export class PostMapper {
  static toDomain(e: PostEntity): PostModel {
    return new PostModel(e.id, e.authorId, e.title, e.content, e.status, e.publishedAt ?? null);
  }

  static toPersistence(m: PostModel): Partial<PostEntity> {
    return {
      id: m.id, authorId: m.authorId, title: m.title,
      content: m.content, status: m.status, publishedAt: m.publishedAt ?? undefined,
    };
  }
}
```

### 2.5 Lắp vào Module

```ts
// src/posts/posts.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([PostEntity])],
  controllers: [PostsController],
  providers: [
    PublishPostUseCase,
    { provide: POST_REPOSITORY, useClass: TypeormPostRepository },
    { provide: NOTIFIER, useClass: BullNotifier },
  ],
})
export class PostsModule {}
```

Đổi TypeORM sang Prisma? Viết `PrismaPostRepository implements PostRepositoryPort` và sửa **một dòng** `useClass`. Domain và use case không đụng tới.

### 2.6 Controller mỏng đi hẳn

```ts
@Post(':id/publish')
@HttpCode(HttpStatus.OK)
publish(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') userId: number) {
  return this.publishPostUseCase.execute(id, userId);
}
```

---

## 3. Cấu trúc thư mục đầy đủ

```
src/
├── main.ts
├── app.module.ts
├── shared/                       # dùng chung, KHÔNG chứa nghiệp vụ
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── database/                 # DataSource, base repository, transaction helper
│   ├── cache/
│   ├── queue/
│   └── observability/            # logger, tracing, metrics
├── config/
│   ├── app.config.ts
│   ├── database.config.ts
│   └── redis.config.ts
└── modules/
    ├── posts/
    │   ├── domain/               # model, port, domain error — KHÔNG import framework
    │   │   ├── post.model.ts
    │   │   ├── post.repository.port.ts
    │   │   └── errors.ts
    │   ├── application/          # use case
    │   │   ├── publish-post.use-case.ts
    │   │   ├── list-posts.use-case.ts
    │   │   └── dto/
    │   ├── infrastructure/       # TypeORM entity, repository, mapper, adapter
    │   │   ├── post.entity.ts
    │   │   ├── typeorm-post.repository.ts
    │   │   └── post.mapper.ts
    │   ├── presentation/         # controller, gateway
    │   │   └── posts.controller.ts
    │   └── posts.module.ts
    └── orders/
        └── ... (tương tự)
```

---

## 4. Path alias — hết cảnh `../../../../`

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@/*":        ["src/*"],
      "@shared/*":  ["src/shared/*"],
      "@config/*":  ["src/config/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

```ts
// Trước
import { PostModel } from '../../../posts/domain/post.model';
// Sau
import { PostModel } from '@modules/posts/domain/post.model';
```

Để Jest hiểu alias, thêm vào `package.json`:

```json
"jest": {
  "moduleNameMapper": {
    "^@/(.*)$":        "<rootDir>/$1",
    "^@shared/(.*)$":  "<rootDir>/shared/$1",
    "^@config/(.*)$":  "<rootDir>/config/$1",
    "^@modules/(.*)$": "<rootDir>/modules/$1"
  }
}
```

> `rootDir` của Jest trong project Nest mặc định là `src`, nên đường dẫn không có tiền tố `src/`.

Chạy production cần `tsconfig-paths` hoặc bật `"plugins"` khi build. Cách gọn nhất: dùng SWC hoặc thêm vào `main.ts` production script `node -r tsconfig-paths/register dist/main`.

---

## 5. Ranh giới module — chống "mạng nhện"

Khi có 30 module, thứ giết dự án là **module nào cũng import module nào**.

### Quy tắc 1: chỉ export thứ cần thiết

```ts
@Module({
  providers: [
    ListPostsUseCase,
    PublishPostUseCase,
    TypeormPostRepository,     // chi tiết nội bộ
    PostMapper,                // chi tiết nội bộ
  ],
  exports: [ListPostsUseCase], // CHỈ mở ra thứ module khác thực sự cần
})
export class PostsModule {}
```

Module khác không được chạm vào `TypeormPostRepository` — nếu cần dữ liệu post, gọi qua use case.

### Quy tắc 2: giao tiếp một chiều, hoặc dùng event

Nếu `PostsModule` cần `UsersModule` **và** `UsersModule` cần `PostsModule` → đó là mùi thiết kế sai. Ba cách xử lý, theo thứ tự ưu tiên:

1. **Tách phần dùng chung** ra module thứ ba (`ProfilesModule`).
2. **Đảo chiều bằng event**: `PostsModule` phát `post.published`, `UsersModule` lắng nghe. Hai bên không biết nhau (xem [bài 07](./07-cqrs-event-outbox.md)).
3. `forwardRef()` — chỉ dùng khi hai cách trên bất khả thi.

### Quy tắc 3: ép ranh giới bằng ESLint

Cấu hình này chặn việc import xuyên tầng sai hướng ngay lúc gõ code:

```js
// eslint.config.js
rules: {
  'no-restricted-imports': ['error', {
    patterns: [
      {
        group: ['@modules/*/infrastructure/*', '@modules/*/domain/*'],
        message: 'Không import trực tiếp vào ruột module khác. Dùng thứ module đó export.',
      },
      {
        group: ['typeorm', '@nestjs/*'],
        // chỉ áp dụng cho thư mục domain — cấu hình qua overrides
        message: 'Tầng domain không được phụ thuộc framework.',
      },
    ],
  }],
}
```

Không có rule tự động, ranh giới sẽ bị phá trong vòng 2 tuần.

---

## 6. Transaction xuyên nhiều repository

Vấn đề kinh điển: một use case gọi 3 repository, cần cả 3 nằm trong **một transaction**, nhưng repository lại giấu TypeORM đi.

Giải pháp: dùng `AsyncLocalStorage` để truyền `EntityManager` ngầm.

```ts
// src/shared/database/transaction.service.ts
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class TransactionService {
  private readonly als = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {}

  /** Chạy callback trong 1 transaction; mọi repository bên trong tự dùng chung manager */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      this.als.run(manager, fn),
    );
  }

  /** Repository gọi hàm này để lấy manager đúng ngữ cảnh */
  get manager(): EntityManager {
    return this.als.getStore() ?? this.dataSource.manager;
  }
}
```

Repository dùng `manager` thay vì repo cố định:

```ts
@Injectable()
export class TypeormPostRepository implements PostRepositoryPort {
  constructor(private readonly tx: TransactionService) {}

  async save(post: PostModel): Promise<void> {
    await this.tx.manager.save(PostEntity, PostMapper.toPersistence(post));
  }
}
```

Use case chỉ cần bọc:

```ts
async execute(dto: CheckoutDto) {
  return this.tx.run(async () => {
    await this.orders.save(order);        // cùng transaction
    await this.inventory.decrease(items); // cùng transaction
    await this.payments.charge(amount);   // cùng transaction
  });
}
```

> Đây là pattern **Unit of Work**. Không có nó, bạn sẽ phải truyền `EntityManager` thủ công qua mọi lớp — rất bẩn.

---

## 7. Monorepo — khi có nhiều ứng dụng dùng chung code

Khi bạn có API chính + worker + cron + admin API cùng dùng chung entity và service:

```bash
nest generate app worker
# Nest tự chuyển project sang chế độ monorepo
nest generate library shared-domain
```

```
apps/
├── api/            # HTTP API
├── worker/         # chỉ chạy BullMQ processor, không mở cổng HTTP
└── cron/           # chỉ chạy scheduled job
libs/
├── shared-domain/  # entity, model, port
└── shared-infra/   # repository, cache, queue config
```

```bash
npm run start:dev api
npm run start:dev worker
nest build api
```

Import giữa các phần qua alias tự sinh trong `tsconfig.json`:

```ts
import { PostModel } from '@app/shared-domain';
```

**Vì sao tách worker khỏi API?** Vì bạn muốn scale chúng độc lập: 10 container API (nhẹ, nhiều) nhưng 2 container worker (nặng RAM, ít). Chi tiết ở [bài 05](./05-queue-va-job-nen.md).

Worker không cần HTTP server:

```ts
// apps/worker/src/main.ts
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  // createApplicationContext: KHÔNG mở cổng HTTP, nhẹ hơn nhiều
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
}
bootstrap();
```

---

## 8. Khi nào KHÔNG nên tách tầng

Tách tầng có giá: nhiều file hơn, nhiều mapper hơn, nhiều gõ hơn. Đừng làm nếu:

- Module chỉ là CRUD thuần (Tags, Categories, Settings) → controller + service là đủ.
- Team dưới 3 người và dự án dưới 6 tháng vòng đời.
- Bạn chưa biết nghiệp vụ sẽ đi về đâu — tách sớm dễ tách sai chỗ.

**Dấu hiệu nên tách:**

- Một service vượt 500 dòng hoặc 15 dependency.
- Cùng một quy tắc nghiệp vụ bị viết lại ở 3 nơi.
- Muốn viết unit test nhưng phải mock 10 thứ mới chạy được 1 test.
- Sắp đổi hạ tầng (ORM, message broker, payment gateway).

---

## 9. Bài tập bài 1

1. Chọn một nghiệp vụ phức tạp nhất trong Blog API (gợi ý: xuất bản bài viết, hoặc duyệt bình luận).
2. Tách nó thành 4 tầng: `domain/`, `application/`, `infrastructure/`, `presentation/`.
3. Viết **unit test cho domain model** — test phải chạy được mà không import `@nestjs/testing`, không cần DB. Đo thời gian chạy (phải dưới 50ms).
4. Cấu hình path alias `@modules/*`, `@shared/*` và làm cho cả `npm run start:dev` lẫn `npm run test` đều hiểu.
5. Cài `TransactionService`, viết một use case ghi vào 2 bảng, cố tình `throw` ở giữa và xác nhận **cả hai đều rollback**.
6. Thêm ESLint rule chặn `import ... from 'typeorm'` bên trong thư mục `domain/`.
7. (Nâng cao) Chuyển project sang monorepo, tách một `worker` app chạy bằng `createApplicationContext`.

➡️ Tiếp: [02-xu-ly-du-lieu-lon.md](./02-xu-ly-du-lieu-lon.md)
