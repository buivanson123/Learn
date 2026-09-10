# Bài 7 — Config, Logging, Swagger, Testing & Deploy

## 1. Config & biến môi trường

```bash
npm i @nestjs/config joi
```

### 1.1 Config cơ bản

```ts
// app.module.ts
ConfigModule.forRoot({
  isGlobal: true,                          // khỏi import lại ở mọi module
  envFilePath: ['.env.local', '.env'],     // file sau làm fallback
  cache: true,
})
```

```ts
@Injectable()
export class SomeService {
  constructor(private config: ConfigService) {}

  demo() {
    this.config.get('DB_HOST');                    // string | undefined
    this.config.get<number>('DB_PORT');
    this.config.get('APP_NAME', 'Blog API');       // có default
    this.config.getOrThrow('JWT_SECRET');          // thiếu -> throw ngay khi khởi động
  }
}
```

> `getOrThrow()` rất quan trọng: app **fail nhanh** lúc boot thay vì lỗi 500 lúc chạy.

### 1.2 Validate schema `.env` — chặn lỗi cấu hình từ lúc khởi động

```ts
import * as Joi from 'joi';

ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    DB_HOST: Joi.string().required(),
    DB_PORT: Joi.number().default(5432),
    DB_USER: Joi.string().required(),
    DB_PASS: Joi.string().required(),
    DB_NAME: Joi.string().required(),
    JWT_SECRET: Joi.string().min(32).required(),
  }),
  validationOptions: { abortEarly: false },
})
```

Thiếu biến → app **không khởi động được** và báo rõ thiếu cái gì. Rất đáng làm.

### 1.3 Namespaced config — nhóm biến theo chủ đề

```ts
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  name: process.env.DB_NAME,
}));
```

```ts
ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, appConfig] })

// dùng:
this.config.get('database.host');          // truy cập theo namespace
```

---

## 2. Logging

```ts
import { Logger } from '@nestjs/common';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  async create(dto: CreatePostDto) {
    this.logger.log(`Tạo bài viết: ${dto.title}`);
    this.logger.warn('Cảnh báo');
    this.logger.error('Lỗi', error.stack);
    this.logger.debug('Chi tiết debug');
    this.logger.verbose('Rất chi tiết');
  }
}
```

Cấu hình mức log:

```ts
// main.ts
const app = await NestFactory.create(AppModule, {
  logger: process.env.NODE_ENV === 'production'
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug', 'verbose'],
});
```

Production nên dùng **pino** (JSON log, nhanh):

```bash
npm i nestjs-pino pino-http pino-pretty
```

---

## 3. Swagger — tài liệu API tự động

```bash
npm i @nestjs/swagger
```

```ts
// main.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('Blog API')
  .setDescription('API cho hệ thống blog')
  .setVersion('1.0')
  .addBearerAuth()          // nút Authorize để dán JWT
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
```

Mở http://localhost:3000/docs → có UI test API luôn.

Bổ sung metadata:

```ts
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  @ApiOperation({ summary: 'Lấy danh sách bài viết' })
  @ApiResponse({ status: 200, description: 'Thành công' })
  @Get()
  findAll() {}
}

export class CreatePostDto {
  @ApiProperty({ example: 'Học NestJS trong 7 ngày', description: 'Tiêu đề bài viết' })
  @IsString() @MinLength(5)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  thumbnail?: string;
}
```

> Mẹo: bật plugin để **khỏi phải viết `@ApiProperty` cho từng field** — nó tự suy ra từ DTO:

```json
// nest-cli.json
{
  "compilerOptions": {
    "plugins": ["@nestjs/swagger"]
  }
}
```

---

## 4. Unit Test (Jest)

NestJS dựng sẵn Jest. Ý tưởng cốt lõi: bạn dựng một **module test** chỉ chứa class cần kiểm tra, còn mọi dependency của nó thì thay bằng mock.

```ts
// src/posts/posts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

describe('PostsService', () => {
  let service: PostsService;
  let repo: jest.Mocked<Repository<Post>>;

  beforeEach(async () => {
    const mockRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(PostsService);
    repo = module.get(getRepositoryToken(Post));
  });

  it('findAll trả về danh sách bài viết', async () => {
    const posts = [{ id: 1, title: 'Bài 1' }] as Post[];
    repo.find.mockResolvedValue(posts);

    expect(await service.findAll()).toEqual(posts);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });

  it('findOne ném NotFoundException khi không tồn tại', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('create lưu bài viết mới', async () => {
    const dto = { title: 'Mới', content: 'abc' };
    const created = { id: 1, ...dto } as Post;
    repo.create.mockReturnValue(created);
    repo.save.mockResolvedValue(created);

    expect(await service.create(dto as any, 1)).toEqual(created);
    expect(repo.save).toHaveBeenCalledWith(created);
  });
});
```

Chạy:

```bash
npm run test
npm run test:watch
npm run test:cov          # coverage
npm run test -- posts     # chỉ chạy file khớp 'posts'
```

---

## 5. E2E Test — kiểm tra qua HTTP thật

```ts
// test/posts.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Posts (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    // đăng nhập lấy token
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'son@test.com', password: '12345678' });
    token = res.body.accessToken;
  });

  afterAll(async () => await app.close());

  it('GET /api/posts trả 200', () => {
    return request(app.getHttpServer())
      .get('/api/posts')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('POST /api/posts không token trả 401', () => {
    return request(app.getHttpServer())
      .post('/api/posts')
      .send({ title: 'Bài viết mới', content: 'nội dung' })
      .expect(401);
  });

  it('POST /api/posts dữ liệu sai trả 422', () => {
    return request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'abc' })       // quá ngắn + thiếu content
      .expect(422);
  });

  it('POST /api/posts hợp lệ trả 201', () => {
    return request(app.getHttpServer())
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bài viết hợp lệ', content: 'nội dung đầy đủ' })
      .expect(201);
  });
});
```

```bash
npm run test:e2e
```

> Nên dùng DB riêng cho test (`.env.test` với `DB_NAME=blog_test`), reset dữ liệu trước mỗi suite.

### Mock một provider trong e2e

```ts
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(MailService)
  .useValue({ send: jest.fn() })
  .overrideGuard(JwtAuthGuard)
  .useValue({ canActivate: () => true })
  .compile();
```

---

## 6. Các module hữu ích khác

| Nhu cầu | Package |
|---|---|
| Cron / scheduled task | `@nestjs/schedule` → `@Cron('0 0 * * *')` |
| Queue / background job | `@nestjs/bullmq` (cần Redis) |
| Event/Listener | `@nestjs/event-emitter` |
| Cache | `@nestjs/cache-manager` |
| Rate limit | `@nestjs/throttler` |
| Upload file | `@nestjs/platform-express` + `FileInterceptor` |
| WebSocket | `@nestjs/websockets` |
| GraphQL | `@nestjs/graphql` |
| Health check | `@nestjs/terminus` |
| Gửi mail | `@nestjs-modules/mailer` |

Ví dụ cron:

```ts
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupDrafts() {
    // ~ nội dung một Command trong Kernel::schedule()
  }
}
```

Ví dụ upload:

```ts
@Post('upload')
@UseInterceptors(FileInterceptor('file', { dest: './uploads' }))
upload(@UploadedFile() file: Express.Multer.File) {
  return { filename: file.filename, size: file.size };
}
```

---

## 7. Deploy

### Dockerfile (multi-stage)

```dockerfile
# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- run ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
```

### Checklist trước khi lên production

- [ ] `synchronize: false`, chạy migration thay thế
- [ ] `.env` không commit; secret lấy từ biến môi trường của hạ tầng
- [ ] `app.enableShutdownHooks()` để đóng kết nối gọn khi nhận SIGTERM
- [ ] `helmet()` + CORS cấu hình đúng origin (không để `enableCors()` trống)
- [ ] `ValidationPipe` bật `whitelist: true`
- [ ] Exception filter không lộ stack trace ra client
- [ ] Health check endpoint `/health` cho load balancer
- [ ] Log dạng JSON (pino), không `console.log`

---

## 8. Bài tập bài 7

1. Thêm Joi validation cho `.env`, thử xoá `JWT_SECRET` → app phải báo lỗi khi khởi động.
2. Tạo `config/app.config.ts` namespaced, đọc bằng `config.get('app.name')`.
3. Bật Swagger tại `/docs`, thêm `addBearerAuth()`, test được API có auth ngay trên UI.
4. Viết unit test cho `PostsService` (ít nhất 4 case, có case ném exception).
5. Viết e2e test cho luồng: register → login → tạo post → lấy danh sách.
6. Viết Dockerfile và chạy được `docker build` + `docker run`.

<details>
<summary>Gợi ý đáp án</summary>

**1. Joi validation cho `.env`.**

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    DATABASE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
  }),
  validationOptions: { abortEarly: false },   // báo HẾT lỗi một lượt, không dừng ở cái đầu
})
```

Xoá `JWT_SECRET` rồi khởi động:

```
Error: Config validation error: "JWT_SECRET" is required
```

App **chết ngay lúc khởi động**, không phải lúc user đầu tiên gọi `/auth/login` lúc 2 giờ sáng.
Đó là toàn bộ giá trị của bài này: đổi một lỗi runtime ngẫu nhiên thành một lỗi khởi động chắc chắn.

**2. Config namespaced.**

```ts
// src/config/app.config.ts
export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'blog-api',
  port: parseInt(process.env.PORT ?? '3000', 10),
}));
```

```ts
ConfigModule.forRoot({ isGlobal: true, load: [appConfig, dbConfig] })

// dùng
this.config.get<string>('app.name');
// hoặc có kiểu đầy đủ:
constructor(@Inject(appConfig.KEY) private cfg: ConfigType<typeof appConfig>) {}
this.cfg.name;      // ← có gợi ý và bắt lỗi chính tả
```

Cách thứ hai tốt hơn hẳn: `config.get('app.nmae')` gõ sai trả `undefined` im lặng, còn `cfg.nmae`
không biên dịch nổi.

**3. Swagger + Bearer.**

```ts
// main.ts
const cauHinh = new DocumentBuilder()
  .setTitle('Blog API')
  .setVersion('1.0')
  .addBearerAuth()                       // hiện nút Authorize trên UI
  .build();
SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, cauHinh));
```

Trên controller cần auth thêm `@ApiBearerAuth()`, và DTO cần `@ApiProperty()` thì mới hiện đúng schema
(hoặc bật plugin `@nestjs/swagger` trong `nest-cli.json` để tự suy ra từ kiểu TypeScript).

Nhớ **không mở `/docs` trên production** nếu API không công khai: `if (config.get('NODE_ENV') !== 'production')`.

**4. Unit test `PostsService` — 4 case.**

```ts
describe('PostsService', () => {
  let service: PostsService;
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: repo },  // thay repo thật bằng mock
      ],
    }).compile();
    service = module.get(PostsService);
    jest.clearAllMocks();                  // KHÔNG có dòng này, mock rò từ test trước sang test sau
  });

  it('findAll trả danh sách', async () => {
    repo.find.mockResolvedValue([{ id: 1 }]);
    await expect(service.findAll()).resolves.toEqual([{ id: 1 }]);
  });

  it('findOne trả đúng bài viết', async () => {
    repo.findOne.mockResolvedValue({ id: 1, title: 'a' });
    expect((await service.findOne(1)).title).toBe('a');
  });

  it('findOne ném NotFoundException khi không thấy', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('update ném Forbidden khi không phải tác giả', async () => {
    repo.findOne.mockResolvedValue({ id: 1, authorId: 2 });
    await expect(service.update(1, { title: 'x' }, { id: 99, role: 'user' } as User))
      .rejects.toThrow(ForbiddenException);
  });
});
```

Điểm cần nắm: `getRepositoryToken(Post)` là token mà `@InjectRepository(Post)` đang tìm. Mock đúng
token đó thì service không biết mình đang nói chuyện với đồ giả.

**5. E2E test cả luồng.**

```ts
describe('Blog (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));  // ← phải lặp lại
    await app.init();
  });
  afterAll(() => app.close());

  it('register -> login -> tạo post -> lấy danh sách', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Son', email: 'son@test.dev', password: 'matkhau123' })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'son@test.dev', password: 'matkhau123' })
      .expect(201);
    token = login.body.accessToken;

    const tao = await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bài viết đầu tiên', content: 'nội dung đủ dài' })
      .expect(201);

    const ds = await request(app.getHttpServer()).get('/posts').expect(200);
    expect(ds.body.items.map((p) => p.id)).toContain(tao.body.id);
  });
});
```

Bẫy kinh điển: **`app.useGlobalPipes()` khai trong `main.ts` không tự áp vào e2e test**, vì test dựng
app từ `AppModule` chứ không chạy `bootstrap()`. Kết quả là test pass còn production 422 — hoặc ngược
lại. Cách chắc hơn: gói mọi cấu hình global vào một hàm `capHinhApp(app)` và gọi ở cả hai chỗ, hoặc
khai bằng `APP_PIPE` trong `AppModule`.

DB cho e2e nên là database riêng (`blog_test`) và dọn giữa các lần chạy, đừng dùng chung với dev.

**6. Dockerfile.**

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```bash
docker build -t blog-api .
docker run -p 3000:3000 --env-file .env blog-api
```

Thứ tự `COPY package*.json` **trước** `COPY . .` là điều quan trọng nhất: sửa một dòng code không làm
mất cache của `npm ci`. Chi tiết ở bộ [Docker](../docker/02-dockerfile-nestjs.md).

</details>

➡️ Tiếp: [08-du-an-blog-api.md](./08-du-an-blog-api.md)
