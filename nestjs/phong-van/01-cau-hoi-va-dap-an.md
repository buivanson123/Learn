# 55 câu hỏi phỏng vấn NestJS + đáp án

Đáp án được **gấp lại sẵn** — tự trả lời thành tiếng trước, rồi bấm ▸ *Đáp án* để đối chiếu.
⭐ = rất hay gặp.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--di-provider-module) | DI, Provider, Module | 14 |
| [B](#b--vòng-đời-request) | Vòng đời request | 11 |
| [C](#c--database-và-typeorm) | Database, TypeORM | 10 |
| [D](#d--validation-auth-testing) | Validation, Auth, Testing | 10 |
| [E](#e--hiệu-năng-và-kiến-trúc) | Hiệu năng, kiến trúc | 10 |

---

## A — DI, Provider, Module

### A1 ⭐⭐ Dependency Injection là gì? NestJS làm thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Thay vì class tự `new` thứ nó cần, nó **khai báo** thứ nó cần ở constructor và để container
đưa vào.

**Đào sâu:**

```ts
@Injectable()
export class PostsService {
  constructor(private readonly usersService: UsersService) {}
}
```

Không có dòng `new UsersService()` nào. NestJS đọc kiểu tham số constructor rồi tự dựng.

Cơ chế bên dưới: TypeScript với `emitDecoratorMetadata` sinh ra metadata `design:paramtypes` ghi lại
kiểu của từng tham số. NestJS đọc metadata đó. **Đó là lý do NestJS bắt buộc dùng TypeScript và bắt
buộc có decorator** — không có metadata thì container không biết phải inject gì.

Lợi ích thật: test thay `UsersService` bằng mock chỉ cần đổi provider, không sửa `PostsService`.

</details>

### A2 ⭐ Ba scope của provider? Mặc định là gì?

<details>
<summary>Đáp án</summary>

**Ngắn:** `DEFAULT` (singleton — mặc định), `REQUEST` (mỗi request một instance), `TRANSIENT` (mỗi nơi
inject một instance riêng).

**Đào sâu:**

| Scope | Vòng đời | Dùng khi |
|-------|----------|----------|
| `DEFAULT` | Một instance cho cả ứng dụng | 95% trường hợp |
| `REQUEST` | Mỗi request một instance | Cần dữ liệu riêng của request (tenant, user context) |
| `TRANSIENT` | Mỗi consumer một instance | Provider có state riêng theo chủ sở hữu (logger gắn tên class) |

⚠️ **Bẫy quan trọng:** provider mặc định là **singleton**, nên **đừng lưu dữ liệu của request vào
property của service**. Request thứ hai sẽ đọc được dữ liệu của request thứ nhất.

```ts
@Injectable()
export class BadService {
  private currentUser: User;      // ❌ singleton — rò rỉ giữa các request
}
```

Và `Scope.REQUEST` **lan lên trên**: module nào inject nó thì cũng thành request-scoped, làm chậm cả
nhánh. Cân nhắc kỹ trước khi dùng.

</details>

### A3 ⭐ Bốn kiểu provider: `useClass`, `useValue`, `useFactory`, `useExisting`?

<details>
<summary>Đáp án</summary>

**Ngắn:**

```ts
{ provide: X, useClass: XImpl }        // dựng class
{ provide: 'CONFIG', useValue: {...} } // giá trị có sẵn (hay dùng cho mock trong test)
{ provide: X, useFactory: (dep) => ..., inject: [Dep] }   // cần logic để dựng
{ provide: 'Alias', useExisting: X }   // bí danh cho provider đã có
```

**Đào sâu:** `useFactory` là kiểu linh hoạt nhất — dùng khi việc dựng cần đọc config hoặc phụ thuộc
async:

```ts
{
  provide: 'DATABASE',
  useFactory: async (config: ConfigService) => createConnection(config.get('DB_URL')),
  inject: [ConfigService],
}
```

`useExisting` khác `useClass` ở chỗ nó trỏ vào **cùng một instance**, không tạo instance mới.

</details>

### A4 ⭐ Vì sao phải khai `providers` và `exports` trong module?

<details>
<summary>Đáp án</summary>

**Ngắn:** `providers` = những gì module này dựng được; `exports` = những gì module khác dùng được khi
`imports` module này.

**Đào sâu:** NestJS **đóng gói theo module**. Provider không `exports` thì module khác không thấy, dù
đã `imports`.

Lỗi kinh điển:

```
Nest can't resolve dependencies of the PostsService (?).
Please make sure that the argument UsersService at index [0] is available in the PostsModule context.
```

Checklist ba bước khi gặp lỗi này:
1. `UsersService` có trong `providers` của `UsersModule` không?
2. `UsersModule` có `exports: [UsersService]` không?
3. `PostsModule` có `imports: [UsersModule]` không?

Thiếu bước nào cũng ra đúng thông báo trên.

</details>

### A5 ⭐ Circular dependency là gì? Xử lý thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** A cần B, B cần A. Xử lý bằng `forwardRef()` ở **cả hai phía**.

**Đào sâu:**

```ts
// UsersModule
@Module({ imports: [forwardRef(() => PostsModule)] })

// PostsModule
@Module({ imports: [forwardRef(() => UsersModule)] })

// và trong service
constructor(@Inject(forwardRef(() => PostsService)) private posts: PostsService) {}
```

Nhưng câu trả lời tốt hơn: **`forwardRef` là dấu hiệu thiết kế có vấn đề.** Ba cách tránh:
1. Tách phần dùng chung ra module thứ ba.
2. Dùng event thay vì gọi trực tiếp hai chiều.
3. Xem lại ranh giới module — có thể hai module này thực ra là một.

Nói được phần này ghi điểm hơn nhiều so với chỉ đọc thuộc `forwardRef`.

</details>

### A6 Global module là gì? Khi nào dùng?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@Global()` khiến provider của module đó dùng được ở mọi nơi mà không cần `imports`.

**Đào sâu:** Chỉ dùng cho thứ thật sự dùng khắp nơi: `ConfigModule`, `LoggerModule`, `PrismaModule`.
Lạm dụng thì mất hết lợi ích của việc đóng gói theo module — không ai biết cái gì phụ thuộc cái gì.

</details>

### A7 ⭐ Dynamic module là gì? `forRoot` vs `forFeature` vs `forRootAsync`?

<details>
<summary>Đáp án</summary>

**Ngắn:** Là module nhận cấu hình lúc import và trả về `DynamicModule`.

**Đào sâu:**

```ts
@Module({})
export class MailModule {
  static forRoot(options: MailOptions): DynamicModule {
    return {
      module: MailModule,
      providers: [{ provide: 'MAIL_OPTIONS', useValue: options }, MailService],
      exports: [MailService],
    };
  }
}
```

Quy ước tên trong hệ sinh thái NestJS:

| Tên | Ý nghĩa |
|-----|---------|
| `forRoot()` | Cấu hình toàn cục, gọi **một lần** ở `AppModule` |
| `forFeature()` | Cấu hình cho một feature, gọi nhiều lần (vd `TypeOrmModule.forFeature([Post])`) |
| `forRootAsync()` | Như `forRoot` nhưng cấu hình lấy từ nơi khác (thường là `ConfigService`) |

`forRootAsync` cần khi cấu hình phụ thuộc vào provider khác:

```ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({ url: config.get('DATABASE_URL'), ... }),
})
```

</details>

### A8 Custom provider với token là chuỗi — inject thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Bằng `@Inject('TOKEN')`.

**Đào sâu:**

```ts
constructor(@Inject('MAIL_OPTIONS') private options: MailOptions) {}
```

Vì token là chuỗi (không phải class), TypeScript không sinh được metadata nên phải khai tay. Nên dùng
`Symbol` hoặc hằng số thay vì chuỗi trần để tránh gõ sai.

</details>

### A9 Lifecycle hooks của NestJS?

<details>
<summary>Đáp án</summary>

**Ngắn:** `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`, `BeforeApplicationShutdown`,
`OnApplicationShutdown`.

**Đào sâu:** Dùng thật:

- `OnModuleInit` — kết nối tới dịch vụ ngoài, nạp cache khởi động.
- `OnApplicationShutdown` — đóng kết nối, chờ job đang chạy xong.

```ts
app.enableShutdownHooks();   // ⚠️ phải gọi, nếu không hook shutdown KHÔNG chạy
```

Quan trọng khi chạy trong Docker/Kubernetes: không đóng kết nối tử tế thì request đang dở bị cắt giữa
chừng lúc deploy.

</details>

### A10 `@Injectable()` có bắt buộc không?

<details>
<summary>Đáp án</summary>

**Ngắn:** Bắt buộc nếu class đó **có phụ thuộc cần inject**.

**Đào sâu:** Decorator này là thứ khiến TypeScript sinh metadata `design:paramtypes`. Class không có
constructor dependency thì bỏ được, nhưng cứ thêm cho nhất quán.

</details>

### A11 Module không có `imports` thì dùng được provider của module khác không?

<details>
<summary>Đáp án</summary>

**Ngắn:** Không. Trừ khi module kia là `@Global()`.

</details>

### A12 Vì sao NestJS bắt buộc `reflect-metadata`?

<details>
<summary>Đáp án</summary>

**Ngắn:** Vì DI dựa vào metadata mà decorator sinh ra lúc biên dịch, và `reflect-metadata` là thư viện
đọc/ghi metadata đó.

**Đào sâu:** Phải `import 'reflect-metadata'` ở đầu `main.ts`, và bật `emitDecoratorMetadata` +
`experimentalDecorators` trong `tsconfig.json`. Thiếu là lỗi kiểu "Cannot read properties of undefined"
rất khó hiểu.

</details>

### A13 Bạn tổ chức module trong dự án lớn thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Theo **feature**, không theo tầng kỹ thuật.

**Đào sâu:**

```
src/
├── posts/    { posts.module.ts, posts.controller.ts, posts.service.ts, entities/, dto/ }
├── users/
├── auth/
└── common/   { guards/, interceptors/, filters/, decorators/ }
```

Không phải `controllers/`, `services/`, `entities/` ở tầng gốc — cách đó khiến sửa một tính năng phải
mở 5 thư mục. Chi tiết ở [cau-truc-chuan.md](../cau-truc-chuan.md).

</details>

### A14 NestJS chạy trên Express hay Fastify?

<details>
<summary>Đáp án</summary>

**Ngắn:** Mặc định Express, đổi sang Fastify được bằng `FastifyAdapter`.

**Đào sâu:** Fastify nhanh hơn đáng kể, nhưng đổi lại middleware Express không dùng được và một số thư
viện trong hệ sinh thái chưa hỗ trợ. Chỉ đổi khi đã đo và biết HTTP layer là nút thắt.

</details>

---

## B — Vòng đời request

### B1 ⭐⭐⭐ Thứ tự chạy của 5 thành phần trong vòng đời request?

<details>
<summary>Đáp án</summary>

**Đây là câu hỏi hay gặp nhất của NestJS.** Phải trả lời được không suy nghĩ.

**Ngắn:**

```
Request
  ↓
① Middleware
  ↓
② Guard
  ↓
③ Interceptor (trước)
  ↓
④ Pipe
  ↓
  Controller → Service
  ↓
③ Interceptor (sau)
  ↓
⑤ Exception Filter (nếu có lỗi ở bất kỳ đâu)
  ↓
Response
```

**Đào sâu — vì sao thứ tự như vậy:**

- **Middleware trước nhất** vì nó ở tầng Express, chưa biết gì về NestJS. Nó **không có**
  `ExecutionContext` nên không biết đang chạy cho controller/handler nào.
- **Guard trước Pipe** vì kiểm tra quyền trước rồi mới tốn công validate dữ liệu. Chưa đăng nhập thì
  không cần biết body có hợp lệ không.
- **Interceptor bọc hai đầu** vì nó dùng RxJS — phần "sau" là `.pipe(map(...))` trên Observable trả về.
  Nhờ vậy nó đo được thời gian, bọc transaction, chuẩn hoá response.
- **Pipe sát controller nhất** vì nó biến đổi chính tham số của handler.

**Cách chọn nhanh** (nên nói kèm):

| Cần | Dùng |
|-----|------|
| Chặn request | Guard |
| Biến đổi dữ liệu **vào** | Pipe |
| Biến đổi dữ liệu **ra** | Interceptor |
| Xử lý lỗi | Filter |
| Xử lý thô ở tầng HTTP (cors, helmet, log) | Middleware |

</details>

### B2 ⭐ Middleware khác Guard chỗ nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Middleware ở tầng Express, không biết context; Guard có `ExecutionContext` nên biết đang chạy
cho controller/handler nào và đọc được metadata.

**Đào sâu:** Đó là lý do `@Roles('admin')` phải đọc bằng Guard chứ không bằng Middleware — Guard dùng
`Reflector` để đọc metadata gắn trên handler:

```ts
const roles = this.reflector.getAllAndOverride<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);
```

</details>

### B3 Guard trả về gì? Nhiều Guard chạy theo thứ tự nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Trả `boolean` (hoặc Promise/Observable của boolean). Chạy theo đúng thứ tự khai trong
`@UseGuards()`.

**Đào sâu:**

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
```

`JwtAuthGuard` gán `request.user` trước, `RolesGuard` mới đọc được để so role. Đảo thứ tự là `RolesGuard`
thấy `user` undefined.

Guard trả `false` → NestJS ném `ForbiddenException` (403).

</details>

### B4 ⭐ Interceptor dùng để làm gì? Cho ví dụ thật.

<details>
<summary>Đáp án</summary>

**Ngắn:** Bọc trước và sau handler — chuẩn hoá response, đo thời gian, cache, bọc transaction.

**Đào sâu:** Ví dụ chuẩn hoá response của dự án Blog API:

```ts
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map(data => ({ success: true, data, timestamp: new Date().toISOString() })),
    );
  }
}
```

Nhờ nó mọi endpoint trả cùng một hình dạng `{ success, data, timestamp }` mà controller không phải biết.

</details>

### B5 Pipe làm được gì ngoài validate?

<details>
<summary>Đáp án</summary>

**Ngắn:** Ép kiểu (transform). `ParseIntPipe`, `ParseUUIDPipe`, `DefaultValuePipe`.

**Đào sâu:**

```ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}
```

Không có `ParseIntPipe` thì `id` là **chuỗi** dù bạn khai `number` — TypeScript không kiểm tra lúc chạy.
Đây là bẫy hay gặp: query database với chuỗi thay vì số.

</details>

### B6 ⭐ `ValidationPipe` cấu hình thế nào cho an toàn?

<details>
<summary>Đáp án</summary>

**Ngắn:**

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // loại field không khai trong DTO
  forbidNonWhitelisted: true,   // báo lỗi nếu có field lạ
  transform: true,              // ép kiểu theo DTO
  transformOptions: { enableImplicitConversion: true },
}));
```

**Đào sâu:** `whitelist: true` là lá chắn chống **mass assignment** — không có nó, client gửi thêm
`isAdmin: true` và nếu service dùng `Object.assign(entity, dto)` thì lọt.

`transform: true` biến plain object thành instance của DTO class — cần cho `class-transformer` hoạt động.

</details>

### B7 Exception Filter dùng khi nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Khi muốn gom mọi lỗi về một định dạng JSON thống nhất.

**Đào sâu:** Dự án Blog API trả lỗi validation 422 với `errors` gom theo field — đó là việc của filter:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) { /* ... */ }
}
```

`@Catch()` rỗng bắt **mọi** exception; `@Catch(HttpException)` chỉ bắt loại đó.

</details>

### B8 Custom decorator viết thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `createParamDecorator` cho tham số, `SetMetadata` cho metadata.

**Đào sâu:**

```ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

@Get('me')
me(@CurrentUser() user: User) {}
```

```ts
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
```

Gộp nhiều decorator bằng `applyDecorators()`.

</details>

### B9 Đăng ký Guard/Interceptor/Filter toàn cục — hai cách khác nhau ra sao?

<details>
<summary>Đáp án</summary>

**Ngắn:** `app.useGlobalGuards()` không inject được dependency; `APP_GUARD` thì có.

**Đào sâu:**

```ts
// ❌ không inject được Reflector, ConfigService...
app.useGlobalGuards(new JwtAuthGuard());

// ✅ đi qua DI container
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

Dùng `APP_GUARD` / `APP_INTERCEPTOR` / `APP_PIPE` / `APP_FILTER` khi thành phần đó cần inject gì đó.

</details>

### B10 Bật Guard toàn cục thì route công khai xử lý sao?

<details>
<summary>Đáp án</summary>

**Ngắn:** Dùng metadata `@Public()` và cho Guard bỏ qua.

**Đào sâu:**

```ts
export const Public = () => SetMetadata('isPublic', true);

// trong JwtAuthGuard
const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
  context.getHandler(), context.getClass(),
]);
if (isPublic) return true;
```

Đây là mẫu của dự án Blog API — bật `JwtAuthGuard` toàn cục rồi mở từng route bằng `@Public()`. An toàn
hơn cách ngược lại (mặc định mở, nhớ đóng từng route) vì **quên là lộ**.

</details>

### B11 Middleware áp cho route nào — khai ở đâu?

<details>
<summary>Đáp án</summary>

**Ngắn:** Trong module, qua `configure(consumer: MiddlewareConsumer)`.

**Đào sâu:**

```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
    consumer.apply(AuthMiddleware).exclude('auth/(.*)').forRoutes(PostsController);
  }
}
```

</details>

---

## C — Database và TypeORM

### C1 ⭐ `@nestjs/typeorm` — `forRoot` vs `forFeature`?

<details>
<summary>Đáp án</summary>

**Ngắn:** `forRoot` khai kết nối (một lần ở `AppModule`); `forFeature` đăng ký repository cho từng
module.

**Đào sâu:** Quên `forFeature([Post])` trong `PostsModule` thì:

```
Nest can't resolve dependencies of the PostsService (?).
Please make sure that the argument PostRepository at index [0] is available in the PostsModule context.
```

</details>

### C2 ⭐ N+1 query trong TypeORM — phát hiện và sửa?

<details>
<summary>Đáp án</summary>

**Ngắn:** Bật `logging: true` để đếm query. Sửa bằng `relations` hoặc `leftJoinAndSelect`.

**Đào sâu:**

```ts
// ❌ N+1
const posts = await this.repo.find();
for (const p of posts) console.log(p.author.name);   // lazy → mỗi bài 1 query

// ✅
const posts = await this.repo.find({ relations: { author: true } });

// ✅ kiểm soát cột
const posts = await this.repo.createQueryBuilder('post')
  .leftJoinAndSelect('post.author', 'author')
  .select(['post.id', 'post.title', 'author.id', 'author.name'])
  .getMany();
```

</details>

### C3 Migration vs `synchronize: true`?

<details>
<summary>Đáp án</summary>

**Ngắn:** `synchronize: true` tự đổi schema theo entity — **chỉ dùng khi dev**. Production dùng migration.

**Đào sâu:** `synchronize` trên production có thể **xoá cột và mất dữ liệu** khi bạn đổi tên field trong
entity. Đây là câu hỏi hay bị hỏi để xem bạn có từng deploy thật chưa.

</details>

### C4 Transaction trong TypeORM viết thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `dataSource.transaction()` hoặc `QueryRunner`.

**Đào sâu:**

```ts
await this.dataSource.transaction(async (manager) => {
  const post = await manager.save(Post, dto);
  await manager.save(Activity, { postId: post.id });
});
```

Đừng gọi API bên ngoài bên trong transaction — nó giữ kết nối và khoá lâu hơn cần thiết.

</details>

### C5 Repository pattern trong NestJS — có cần lớp riêng không?

<details>
<summary>Đáp án</summary>

**Ngắn:** Thường không. `Repository<T>` của TypeORM đã là repository rồi.

**Đào sâu:** Khi cần query phức tạp dùng lại nhiều nơi thì viết **custom repository** thay vì một lớp
bọc chung chung:

```ts
@Injectable()
export class PostsRepository {
  constructor(@InjectRepository(Post) private repo: Repository<Post>) {}

  findPublishedWithAuthor(limit: number) {
    return this.repo.find({ where: { status: 'published' }, relations: { author: true }, take: limit });
  }
}
```

Lợi ích thật: `relations` khai một chỗ, mọi nơi dùng chung — không nơi nào quên và sinh N+1.

</details>

### C6 Soft delete trong TypeORM?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@DeleteDateColumn()` + `softRemove()` / `softDelete()`, đọc lại bằng `withDeleted: true`.

</details>

### C7 Index khai ở đâu? Khi nào cần?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@Index()` trên entity. Cần cho cột trong `WHERE`, `ORDER BY`, `JOIN` và khoá ngoại.

**Đào sâu:**

```ts
@Entity()
@Index(['status', 'publishedAt'])
export class Post { ... }
```

Đo hiệu quả bằng `EXPLAIN ANALYZE` trực tiếp trên PostgreSQL — tìm `Seq Scan` và `Rows Removed by
Filter` lớn.

</details>

### C8 Duyệt bảng rất lớn trong TypeORM?

<details>
<summary>Đáp án</summary>

**Ngắn:** Dùng `stream()` hoặc phân trang theo con trỏ, không `find()` toàn bộ.

**Đào sâu:**

```ts
const stream = await this.repo.createQueryBuilder('p').stream();
```

Hoặc cursor pagination — `WHERE id > :lastId ORDER BY id LIMIT 1000`, nhanh hơn `OFFSET` nhiều trên
bảng lớn. Chi tiết ở [nang-cao/02](../nang-cao/02-xu-ly-du-lieu-lon.md).

</details>

### C9 TypeORM hay Prisma?

<details>
<summary>Đáp án</summary>

**Ngắn:** TypeORM hợp NestJS hơn về mặt tích hợp (decorator, DI); Prisma an toàn kiểu hơn và migration
tốt hơn.

**Đào sâu:** Trả lời tốt là nêu đánh đổi chứ không chọn phe:

> "Em dùng TypeORM vì nó ăn khớp với mô hình decorator + DI của NestJS, và entity dùng chung được cho cả
> validation lẫn schema. Điểm yếu là kiểu trả về của query builder không chặt bằng Prisma, và migration
> phải để ý `synchronize`. Nếu dự án mới ưu tiên an toàn kiểu thì em cân nhắc Prisma."

</details>

### C10 ⭐ TypeORM đang ở phiên bản nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `latest` hiện là **1.1.0**; nhánh `0.3.x` đã mang tag `legacy`.

**Đào sâu:**

```bash
$ npm view typeorm dist-tags
{ latest: '1.1.0', legacy: '0.3.31', beta: '1.0.0-beta.3' }
```

`1.0.0` ra 19/05/2026, `1.1.0` ra 13/07/2026. `@nestjs/typeorm@11.0.3` khai hỗ trợ cả hai
(`typeorm: '^0.3.0 || ^1.0.0-dev'`).

Biết chi tiết này cho thấy bạn theo dõi hệ sinh thái — điểm cộng nhỏ nhưng dễ ăn.

</details>

---

## D — Validation, Auth, Testing

### D1 ⭐ DTO là gì? Vì sao dùng class chứ không interface?

<details>
<summary>Đáp án</summary>

**Ngắn:** DTO mô tả hình dạng dữ liệu vào/ra. Phải là **class** vì interface bị xoá khi biên dịch, còn
`class-validator` cần class tồn tại lúc chạy để đọc decorator.

**Đào sâu:** Đây là câu hỏi rất hay — nó kiểm tra bạn có hiểu "kiểu bị xoá lúc chạy" không.

```ts
export class CreatePostDto {
  @IsString() @MaxLength(200)
  title: string;

  @IsEnum(PostStatus)
  status: PostStatus;
}
```

Interface không giữ được `@IsString()` sau khi biên dịch, nên `ValidationPipe` không có gì để đọc.

</details>

### D2 Validation trả về mã gì? Tuỳ biến thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Mặc định 400. Dự án Blog API đổi thành **422** với `errors` gom theo field.

**Đào sâu:** Làm bằng `exceptionFactory` của `ValidationPipe`, hoặc bằng exception filter.

</details>

### D3 ⭐ JWT trong NestJS — luồng đầy đủ?

<details>
<summary>Đáp án</summary>

**Ngắn:** `AuthService` kiểm tra mật khẩu → ký token bằng `JwtService` → `JwtStrategy` (Passport) xác
minh ở request sau → `JwtAuthGuard` chặn route.

**Đào sâu:** Ba điểm hay bị hỏi tiếp:

- **Lưu token ở đâu?** `httpOnly` cookie an toàn hơn localStorage (chống XSS đọc token).
- **Refresh token?** Access token ngắn (15 phút) + refresh token dài, lưu hash refresh token trong DB
  để thu hồi được.
- **Đăng xuất?** JWT không thu hồi được theo bản chất — cần blacklist trong Redis hoặc dùng refresh
  token và xoá nó.

</details>

### D4 Bcrypt hay Argon2? Cost bao nhiêu?

<details>
<summary>Đáp án</summary>

**Ngắn:** Argon2 tốt hơn về lý thuyết; bcrypt phổ biến và đủ dùng. Cost bcrypt 10–12.

**Đào sâu:** Điểm quan trọng hơn: **không tự viết hàm băm**, và **không dùng `===` để so hash** — dùng
`bcrypt.compare()` (so sánh thời gian không đổi).

</details>

### D5 ⭐ Test service trong NestJS viết thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `Test.createTestingModule()` với provider thật thay bằng mock.

**Đào sâu:**

```ts
const module = await Test.createTestingModule({
  providers: [
    PostsService,
    { provide: getRepositoryToken(Post), useValue: mockRepo },
  ],
}).compile();

const service = module.get<PostsService>(PostsService);
```

`getRepositoryToken(Post)` là cách lấy đúng token mà `@InjectRepository(Post)` dùng.

</details>

### D6 E2E test khác unit test chỗ nào trong NestJS?

<details>
<summary>Đáp án</summary>

**Ngắn:** E2E dựng cả ứng dụng qua `createNestApplication()` rồi gọi HTTP thật bằng `supertest`.

**Đào sâu:**

```ts
const app = moduleFixture.createNestApplication();
app.useGlobalPipes(new ValidationPipe({ whitelist: true }));   // ⚠️ phải lặp lại cấu hình của main.ts
await app.init();

await request(app.getHttpServer()).post('/posts').send({...}).expect(201);
```

⚠️ Bẫy: cấu hình global pipe/filter trong `main.ts` **không tự áp** vào test — phải khai lại, nếu không
test không phản ánh production.

</details>

### D7 Mock database trong test — nên hay không?

<details>
<summary>Đáp án</summary>

**Ngắn:** Unit test thì mock; E2E nên dùng database thật (container riêng cho test).

**Đào sâu:** Mock repository quá nhiều thì test chỉ kiểm tra mock của chính bạn. Với luồng quan trọng,
E2E trên database thật (cùng loại với production) đáng giá hơn nhiều.

</details>

### D8 Config trong NestJS quản lý thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@nestjs/config` + validate schema lúc khởi động.

**Đào sâu:**

```ts
ConfigModule.forRoot({
  isGlobal: true,
  validationSchema: Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
    DATABASE_URL: Joi.string().uri().required(),
  }),
})
```

Ứng dụng **chết ngay lúc khởi động** nếu thiếu biến, thay vì chết lúc có request đầu tiên.

</details>

### D9 Swagger tích hợp thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@nestjs/swagger` đọc decorator của DTO để sinh tài liệu tự động.

**Đào sâu:** Có plugin CLI tự suy ra kiểu từ TypeScript nên không phải viết `@ApiProperty()` cho từng
field. Điểm cộng khi kể: tài liệu API sinh từ code nên không bao giờ lệch với thực tế.

</details>

### D10 Xử lý lỗi nghiệp vụ — ném exception hay trả Result?

<details>
<summary>Đáp án</summary>

**Ngắn:** NestJS thiết kế quanh exception (`NotFoundException`, `ConflictException`…) và filter gom lại.

**Đào sâu:** Ném `HttpException` từ service làm service phụ thuộc vào tầng HTTP. Cách sạch hơn: service
ném exception **nghiệp vụ** của riêng bạn, filter dịch sang mã HTTP:

```ts
// service
throw new PostAlreadyPublished(post.id);

// filter
@Catch(PostAlreadyPublished)
export class PostExceptionFilter { /* → 409 Conflict */ }
```

</details>

---

## E — Hiệu năng và kiến trúc

### E1 ⭐ Ứng dụng NestJS chậm — bạn tìm nguyên nhân thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** Đo trước. Bật log query để đếm, rồi mới kết luận.

**Đào sâu:** Thứ tự kiểm tra:

1. **Số query mỗi request** — N+1 là nguyên nhân số một.
2. **Query chậm nhất** — `EXPLAIN ANALYZE`, tìm `Seq Scan`.
3. **Việc đồng bộ đáng lẽ nên vào queue** — gửi mail, gọi API ngoài.
4. **Nạp quá nhiều dữ liệu** — thiếu phân trang.
5. **Mới tới cache.**

Cache đặt lên trên một N+1 chỉ giấu vấn đề tới lần cache miss đầu tiên.

</details>

### E2 Cache trong NestJS làm thế nào?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@nestjs/cache-manager` với store Redis, hoặc `CacheInterceptor` cho cache theo route.

**Đào sâu:** Vấn đề khó không phải cache mà là **xoá cache đúng lúc**. Mẹo tránh hẳn: nhét
`updatedAt` vào khoá cache — dữ liệu đổi thì khoá đổi, không cần xoá.

</details>

### E3 Queue trong NestJS?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@nestjs/bullmq` với Redis.

**Đào sâu:** Ba điều phải nói khi được hỏi sâu:
- Job **sẽ** chạy hai lần → phải idempotent.
- `attempts` + backoff tăng dần cho job gọi API ngoài.
- Deploy phải để worker làm nốt job đang chạy (graceful shutdown + `enableShutdownHooks`).

</details>

### E4 ⭐ Rate limiting?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@nestjs/throttler`.

**Đào sâu:** Với nhiều instance phải dùng storage Redis, nếu không mỗi instance đếm riêng và giới hạn
thật là N lần con số bạn đặt.

</details>

### E5 Health check?

<details>
<summary>Đáp án</summary>

**Ngắn:** `@nestjs/terminus` — endpoint `/health` kiểm tra DB, Redis, disk.

**Đào sâu:** Kubernetes cần phân biệt **liveness** (còn sống không → restart) và **readiness** (sẵn
sàng nhận traffic chưa → đưa vào load balancer). Nói được sự khác nhau này là điểm cộng.

</details>

### E6 Logging trong production?

<details>
<summary>Đáp án</summary>

**Ngắn:** Log có cấu trúc (JSON) ra stdout, kèm `requestId` để lần theo một request.

**Đào sâu:** `pino` nhanh hơn logger mặc định đáng kể. Gắn `requestId` bằng middleware +
`AsyncLocalStorage` để mọi dòng log trong request có cùng id.

</details>

### E7 Microservices trong NestJS?

<details>
<summary>Đáp án</summary>

**Ngắn:** NestJS hỗ trợ nhiều transport (TCP, Redis, NATS, Kafka, gRPC) qua cùng một API.

**Đào sâu:** Câu trả lời tốt nên có phần **cảnh báo**:

> "Em sẽ không tách microservices sớm. Một monolith có ranh giới module rõ ràng dễ vận hành hơn nhiều,
> và NestJS ép sẵn ranh giới đó bằng module. Chỉ tách khi có lý do thật — ví dụ một phần cần scale
> riêng hoặc do team khác sở hữu."

</details>

### E8 CQRS khi nào cần?

<details>
<summary>Đáp án</summary>

**Ngắn:** Khi luồng đọc và ghi khác nhau đủ nhiều để mô hình hoá riêng.

**Đào sâu:** `@nestjs/cqrs` có sẵn. Nhưng đừng dùng cho CRUD thường — nó thêm rất nhiều class mà không
giải quyết vấn đề gì.

</details>

### E9 Graceful shutdown?

<details>
<summary>Đáp án</summary>

**Ngắn:** `app.enableShutdownHooks()` + xử lý trong `OnApplicationShutdown`.

**Đào sâu:** Không có nó, deploy sẽ cắt ngang request đang xử lý và job đang chạy. Với Kubernetes,
`terminationGracePeriodSeconds` phải lớn hơn thời gian job dài nhất.

</details>

### E10 Bạn thích và không thích gì ở NestJS?

<details>
<summary>Đáp án</summary>

**Ngắn (mẫu):**

> "Em thích việc nó ép cấu trúc — module, DI, decorator làm dự án nhiều người vẫn nhất quán, và
> chuyển giữa các dự án NestJS gần như không phải học lại.
>
> Điểm khó là **lượng khái niệm phải nắm trước khi viết dòng đầu tiên** — module, provider, guard,
> interceptor, pipe, filter. Người mới hay bối rối. Và DI dựa vào metadata nên lỗi kiểu 'Nest can't
> resolve dependencies' rất hay gặp lúc đầu; em xử lý bằng cách kiểm tra ba bước: có trong `providers`
> chưa, có `exports` chưa, module kia có `imports` chưa."

</details>

---

## Bài tập vẽ trên giấy

Phỏng vấn NestJS hay yêu cầu "vẽ thử kiến trúc". Tập vẽ 4 thứ này trong 3 phút, không nhìn tài liệu:

1. Sơ đồ vòng đời request với 5 thành phần, có mũi tên hai chiều của Interceptor.
2. Sơ đồ module của dự án Blog API: `AppModule` → `AuthModule`, `PostsModule`, `UsersModule` và quan hệ
   `imports`/`exports`.
3. Luồng JWT: đăng nhập → ký token → request sau → guard → strategy → `request.user`.
4. Chỗ nào trong luồng có thể sinh N+1, và đặt `relations` ở đâu để tránh.

Có sẵn 3 sơ đồ ở [12-so-do-luong-du-lieu.md](../12-so-do-luong-du-lieu.md) để đối chiếu.

---

<details>
<summary>Gợi ý đáp án — mô tả bằng lời thứ bạn phải vẽ được</summary>

**1. Vòng lặp request với 5 thành phần.**

```
Request
  │
  ▼
① MIDDLEWARE ──► ② GUARD ──► ③ INTERCEPTOR (trước) ──► ④ PIPE ──► ⑤ HANDLER
                                     ▲                                │
                                     └──────── INTERCEPTOR (sau) ◄────┘
                                                     │
                                                     ▼
                                                 Response
     ✗ bất kỳ chỗ nào ném lỗi ──────────► EXCEPTION FILTER
```

Mũi tên hai chiều của Interceptor là chi tiết người phỏng vấn tìm: nó chạy **hai lần** cho một request,
một lần trước và một lần sau handler, vì nó bọc `next.handle()` chứ không chỉ đứng trước.

Ba điều nên nói thêm khi vẽ xong:

- **Guard chạy trước Pipe.** Nên trong guard, `@Body()` chưa được validate và chưa được ép kiểu.
- Nhiều interceptor lồng nhau kiểu hành tây: `@UseInterceptors(A, B)` cho ra `A trước → B trước →
  handler → B sau → A sau`.
- **Filter không cộng dồn** — chỉ cái gần nhất chạy (method > controller > global), ngược với guard và
  interceptor vốn chạy hết.

**2. Sơ đồ module của Blog API.**

```
                    AppModule
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   AuthModule      PostsModule     UsersModule
        │               │               ▲
        │ imports       │ imports       │ exports: [UsersService]
        └───────────────┴───────────────┘
```

Quy tắc phải nói thành lời: **muốn A dùng service của B thì B phải `exports`, A phải `imports`** —
thiếu một trong hai là `Nest can't resolve dependencies`.

Và cái bẫy đáng nói nhất: thêm thẳng `UsersService` vào `providers` của `PostsModule` cũng hết lỗi,
nhưng tạo ra **hai instance riêng biệt**. Nêu được điều này cho thấy bạn đã gặp thật.

`TypeOrmModule.forFeature([Post])` cũng nằm trong `imports` của `PostsModule` — nó là dynamic module
cung cấp token repository.

**3. Luồng JWT.**

```
POST /auth/login
  └─► AuthService.validate(email, pass)
        └─► bcrypt.compare  ──► ký token: jwt.sign({ sub: user.id, role })
              └─► trả { accessToken (15m), refreshToken (7d) }

Request sau:  Authorization: Bearer <token>
  └─► JwtAuthGuard (toàn cục qua APP_GUARD)
        └─► JwtStrategy.validate(payload)      ← passport giải mã + kiểm chữ ký, hạn
              └─► giá trị trả về được gắn vào request.user
                    └─► @CurrentUser() đọc ra
```

Ba chi tiết ăn điểm: `JwtStrategy.validate()` **chỉ chạy sau khi** chữ ký và hạn đã hợp lệ — nó dùng
để nạp thêm dữ liệu, không phải để xác thực. Guard toàn cục + `@Public()` là "mặc định đóng, mở từng
chỗ", an toàn hơn gắn `@UseGuards()` từng route. Và **logout không huỷ được JWT** — phải xoá ở client,
dùng blacklist `jti`, hoặc quay vòng refresh token.

**4. N+1 sinh ở đâu và đặt `relations` ở đâu.**

```
GET /posts  ──► PostsService.findAll()
                  └─► repo.find()                    ← 1 query lấy 20 bài
                        └─► vòng lặp đọc post.author ← 20 query nữa  ❌ N+1
```

Sửa bằng cách khai quan hệ **ngay tại chỗ truy vấn**:

```ts
this.repo.find({ relations: { author: true }, take: 20 });    // 2 query
```

Ba chỗ nên chỉ ra trên sơ đồ:

- **Danh sách kèm quan hệ** — chỗ kinh điển nhất, như trên.
- **Serializer/DTO chạm vào quan hệ chưa nạp** — code trông sạch, query vẫn nổ, vì lazy relation chỉ
  nạp lúc đọc thuộc tính.
- **Quan hệ lồng hai tầng** (`post.comments[].author`) — phải khai `relations: { comments: { author: true } }`,
  quên tầng trong là N+1 quay lại.

Đừng đặt `eager: true` trên entity để "cho chắc": nó nạp quan hệ ở **mọi** truy vấn, kể cả những chỗ
không cần, và bạn không tắt được. Khai theo từng truy vấn mới đúng.

Cách chứng minh có N+1: bật `logging: true` rồi đếm số dòng query cho một request. Nói được "em bật
log rồi đếm được 51 query" mạnh hơn nhiều so với "em dùng `relations` để tránh N+1".

</details>

Tiếp theo: [02-tu-kiem-tra.md](./02-tu-kiem-tra.md)
