# Bài 9 — Cheat Sheet tra cứu nhanh

## 1. Nest CLI

| Việc cần làm | Lệnh |
|---|---|
| Tạo project mới | `nest new app` |
| Chạy dev (tự reload) | `npm run start:dev` |
| Chạy dev + debugger | `npm run start:debug` |
| Sinh cả CRUD cho một tính năng | `nest g resource posts` |
| Sinh riêng module / controller / service | `nest g module posts` · `nest g controller posts` · `nest g service posts` |
| Sinh guard / interceptor / pipe / filter | `nest g guard roles` · `nest g interceptor transform` · `nest g pipe parse-slug` · `nest g filter http-exception` |
| Sinh middleware | `nest g middleware logger` |
| Build production | `npm run build` → `npm run start:prod` |
| Chạy test | `npm run test` · `npm run test:e2e` · `npm run test:cov` |
| Chạy migration | `npm run migration:run` · `npm run migration:revert` |
| Sinh migration từ entity | `npm run migration:generate -- src/migrations/TenMigration` |

Flag hay dùng:

```bash
nest g resource posts --no-spec     # không sinh file test
nest g service posts --flat         # không tạo thư mục con
nest g controller posts --dry-run   # xem trước, không ghi file
```

> Không có lệnh liệt kê route sẵn. Cách xem nhanh nhất là mở Swagger tại `/docs` (bài 7).

---

## 2. Decorator thường dùng

### Class-level
```ts
@Module({ imports, controllers, providers, exports })
@Controller('path')
@Injectable()
@Global()
@Catch(SomeException)
@Entity('table_name')
```

### Method (HTTP)
```ts
@Get() @Post() @Put() @Patch() @Delete() @Head() @Options() @All()
@HttpCode(204)
@Header('Cache-Control', 'none')
@Redirect('url', 301)
```

### Method (behavior)
```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CacheInterceptor)
@UsePipes(new ValidationPipe())
@UseFilters(HttpExceptionFilter)
@SetMetadata('key', value)
```

### Parameter
```ts
@Body() @Body('field')
@Param() @Param('id')
@Query() @Query('page')
@Headers() @Headers('authorization')
@Req() @Res() @Next()
@Ip() @HostParam() @Session()
@UploadedFile() @UploadedFiles()
```

### TypeORM
```ts
@Entity() @PrimaryGeneratedColumn() @PrimaryColumn()
@Column() @Index() @Unique()
@CreateDateColumn() @UpdateDateColumn() @DeleteDateColumn()
@OneToOne() @OneToMany() @ManyToOne() @ManyToMany()
@JoinColumn() @JoinTable()
@InjectRepository(Entity)
```

### class-validator (đầy đủ)
```ts
// Bắt buộc / optional
@IsNotEmpty() @IsOptional() @IsDefined() @Allow()

// Kiểu
@IsString() @IsNumber() @IsInt() @IsBoolean() @IsDate() @IsArray()
@IsObject() @IsEnum(E) @IsJSON()

// Chuỗi
@MinLength(n) @MaxLength(n) @Length(min,max) @Matches(/regex/)
@IsEmail() @IsUrl() @IsUUID() @IsPhoneNumber('VN')
@IsAlpha() @IsAlphanumeric() @IsNumberString() @IsDateString()
@IsStrongPassword() @Contains('x') @IsIn([...]) @IsNotIn([...])

// Số
@Min(n) @Max(n) @IsPositive() @IsNegative() @IsDivisibleBy(n)

// Mảng / lồng nhau
@ArrayNotEmpty() @ArrayMinSize(n) @ArrayMaxSize(n) @ArrayUnique()
@IsString({ each: true })
@ValidateNested({ each: true }) @Type(() => ChildDto)
```

---

## 3. Exception có sẵn

| Class | Status |
|---|---|
| `BadRequestException` | 400 |
| `UnauthorizedException` | 401 |
| `PaymentRequiredException` | 402 |
| `ForbiddenException` | 403 |
| `NotFoundException` | 404 |
| `MethodNotAllowedException` | 405 |
| `RequestTimeoutException` | 408 |
| `ConflictException` | 409 |
| `GoneException` | 410 |
| `PayloadTooLargeException` | 413 |
| `UnsupportedMediaTypeException` | 415 |
| `UnprocessableEntityException` | 422 |
| `TooManyRequestsException` (throttler) | 429 |
| `InternalServerErrorException` | 500 |
| `NotImplementedException` | 501 |
| `BadGatewayException` | 502 |
| `ServiceUnavailableException` | 503 |

---

## 4. TypeORM operators

```ts
import {
  Equal, Not, LessThan, LessThanOrEqual, MoreThan, MoreThanOrEqual,
  Between, In, Any, IsNull, Like, ILike, Raw, ArrayContains,
} from 'typeorm';

where: { age: MoreThan(18) }
where: { id: In([1, 2, 3]) }
where: { name: ILike('%son%') }            // không phân biệt hoa thường
where: { deletedAt: IsNull() }
where: { createdAt: Between(from, to) }
where: { status: Not('draft') }
where: [{ a: 1 }, { b: 2 }]                // OR
where: { views: Raw((alias) => `${alias} > likes`) }
```

Options của `find()`:

```ts
{
  where, relations, order, select,
  skip, take,
  withDeleted: true,        // lấy cả bản ghi soft-deleted
  cache: 60000,             // cache 60s
  loadRelationIds: true,
}
```

---

## 5. Mẫu code hay dùng

### Controller CRUD chuẩn

```ts
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()                findAll(@Query() q: FindPostsDto) { return this.postsService.findAll(q); }
  @Get(':id')           findOne(@Param('id', ParseIntPipe) id: number) { return this.postsService.findOne(id); }
  @Post()               create(@Body() dto: CreatePostDto) { return this.postsService.create(dto); }
  @Patch(':id')         update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePostDto) { return this.postsService.update(id, dto); }
  @Delete(':id')        remove(@Param('id', ParseIntPipe) id: number) { return this.postsService.remove(id); }
}
```

### Phân trang

```ts
const [items, total] = await this.repo.findAndCount({
  where: search ? { title: ILike(`%${search}%`) } : {},
  relations: { author: true },
  order: { createdAt: 'DESC' },
  skip: (page - 1) * limit,
  take: limit,
});
return { items, meta: { total, page, limit, lastPage: Math.ceil(total / limit) } };
```

### Lấy 1 bản ghi hoặc ném 404

```ts
const post = await this.repo.findOneBy({ id });
if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${id}`);
return post;
```

### Kiểm tra quyền sở hữu

```ts
if (post.authorId !== user.id && user.role !== UserRole.ADMIN) {
  throw new ForbiddenException('Bạn không có quyền thao tác với bài viết này');
}
```

### Transaction

```ts
return this.dataSource.transaction(async (manager) => {
  const order = await manager.save(Order, { userId });
  await manager.decrement(Product, { id: productId }, 'stock', qty);
  return order;   // throw ở bất kỳ đâu -> tự rollback
});
```

### Hash & so khớp mật khẩu

```ts
const hash = await bcrypt.hash(plain, 10);
const ok   = await bcrypt.compare(plain, hash);
```

### Đọc config an toàn

```ts
this.config.get('DB_HOST');                 // string | undefined
this.config.get('APP_NAME', 'Blog API');    // có giá trị mặc định
this.config.getOrThrow('JWT_SECRET');       // thiếu -> chết ngay lúc boot
```

### Lấy user đang đăng nhập

```ts
@Get('me')
me(@CurrentUser() user: User) { return user; }        // decorator tự viết, xem bài 5
```

### Đăng ký thành phần toàn cục (có DI)

```ts
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER, APP_PIPE } from '@nestjs/core';

@Module({
  providers: [
    { provide: APP_GUARD,       useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER,      useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

---

## 6. Cấu trúc file mẫu

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/    current-user.decorator.ts, roles.decorator.ts, public.decorator.ts
│   ├── entities/      base.entity.ts
│   ├── filters/       all-exceptions.filter.ts
│   ├── guards/        roles.guard.ts
│   ├── interceptors/  transform.interceptor.ts
│   └── pipes/
├── config/            app.config.ts, database.config.ts
├── auth/
│   ├── auth.module.ts / controller / service
│   ├── dto/           login.dto.ts, register.dto.ts
│   ├── guards/        jwt-auth.guard.ts
│   └── strategies/    jwt.strategy.ts
└── <feature>/
    ├── <f>.module.ts / controller.ts / service.ts
    ├── dto/
    └── entities/
```

---

## 7. Quy ước đặt tên

| Loại | File | Class |
|---|---|---|
| Module | `posts.module.ts` | `PostsModule` |
| Controller | `posts.controller.ts` | `PostsController` |
| Service | `posts.service.ts` | `PostsService` |
| Entity | `post.entity.ts` (số ít) | `Post` |
| DTO | `create-post.dto.ts` | `CreatePostDto` |
| Guard | `roles.guard.ts` | `RolesGuard` |
| Interceptor | `transform.interceptor.ts` | `TransformInterceptor` |
| Filter | `http-exception.filter.ts` | `HttpExceptionFilter` |
| Pipe | `parse-slug.pipe.ts` | `ParseSlugPipe` |
| Decorator | `current-user.decorator.ts` | `CurrentUser` |

Tên thư mục & module: **số nhiều** (`posts`). Entity: **số ít** (`Post`).

---

## 8. Tài nguyên

- Docs chính thức: https://docs.nestjs.com (rất tốt, đọc thẳng)
- TypeORM: https://typeorm.io
- Prisma: https://www.prisma.io/docs
- class-validator: https://github.com/typestack/class-validator#validation-decorators
- Awesome NestJS: https://github.com/nestjs/awesome-nestjs
