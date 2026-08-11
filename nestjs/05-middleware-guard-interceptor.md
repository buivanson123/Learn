# Bài 5 — Vòng đời Request: Middleware, Guard, Interceptor, Pipe, Filter

Giữa lúc request đến và lúc controller chạy, NestJS cho bạn cài 5 loại thành phần chen vào. Mỗi loại có một nhiệm vụ riêng — dùng đúng loại thì code gọn, dùng sai thì rối.

## 1. Thứ tự chạy — sơ đồ phải nhớ

```
Request
  ↓
① MIDDLEWARE        (Express-level: log, cors, helmet, parse body)
  ↓
② GUARD             (Được vào không? → xác thực, phân quyền)
  ↓
③ INTERCEPTOR (before)  (bọc trước: bắt đầu đo thời gian, transaction)
  ↓
④ PIPE              (validate + ép kiểu dữ liệu đầu vào)
  ↓
   ***  CONTROLLER → SERVICE  ***
  ↓
③ INTERCEPTOR (after)   (bọc sau: format response, cache)
  ↓
⑤ EXCEPTION FILTER  (nếu có lỗi ném ra ở bất kỳ đâu)
  ↓
Response
```

| Loại | Câu hỏi nó trả lời | Ví dụ điển hình |
|---|---|---|
| **Middleware** | "Cần xử lý thô gì trên request?" | log, helmet, cors, parse cookie |
| **Guard** | "Request này có được phép đi tiếp không?" | kiểm tra JWT, kiểm tra role |
| **Interceptor** | "Cần bọc thêm gì trước / sau handler?" | chuẩn hoá response, cache, đo thời gian |
| **Pipe** | "Dữ liệu vào có hợp lệ không? Cần ép kiểu?" | `ValidationPipe`, `ParseIntPipe` |
| **Filter** | "Có lỗi thì trả về gì?" | gom mọi exception về một format JSON |

Cách chọn nhanh:

- Cần **chặn** request → Guard.
- Cần **biến đổi** dữ liệu vào → Pipe.
- Cần **biến đổi** dữ liệu ra → Interceptor.
- Cần xử lý **lỗi** → Filter.
- Không thuộc nhóm nào, chỉ là code Express thuần → Middleware.

---

## 2. Middleware

```ts
// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      console.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`,
      );
    });
    next();
  }
}
```

Đăng ký (không dùng decorator, phải cấu hình trong module):

```ts
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';

@Module({ /* ... */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .exclude({ path: 'health', method: RequestMethod.GET })
      .forRoutes('*');                   // hoặc: PostsController, { path:'posts', method: RequestMethod.POST }
  }
}
```

Middleware toàn cục dạng function (helmet, compression):

```ts
// main.ts
import helmet from 'helmet';
app.use(helmet());
```

> Middleware **không biết** nó đang chạy cho controller/handler nào (không có `ExecutionContext`). Cần biết điều đó → dùng Guard hoặc Interceptor.

---

## 3. Guard — kiểm soát truy cập

Guard trả `true` (cho qua) hoặc `false`/throw (chặn).

```ts
// src/common/guards/api-key.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'];
    if (key !== process.env.API_KEY) {
      throw new UnauthorizedException('API key không hợp lệ');
    }
    return true;
  }
}
```

Gắn:

```ts
@UseGuards(ApiKeyGuard)                 // cho cả controller
@Controller('admin')
export class AdminController {

  @UseGuards(AnotherGuard)              // hoặc cho từng route
  @Get()
  find() {}
}
```

Toàn cục:

```ts
// main.ts
app.useGlobalGuards(new ApiKeyGuard());

// hoặc (khuyến nghị — để guard inject được dependency):
// app.module.ts
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

### Guard phân quyền theo Role

Tạo custom decorator `@Roles()`:

```ts
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```ts
// src/common/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Đọc metadata từ method, nếu không có thì đọc từ class
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;      // route không yêu cầu role

    const { user } = context.switchToHttp().getRequest();
    if (!required.includes(user?.role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
```

Dùng:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)   // thứ tự quan trọng: auth trước, role sau
@Roles('admin')
@Delete(':id')
remove(@Param('id') id: string) {}
```

Thứ tự trong `@UseGuards()` chính là thứ tự chạy: `JwtAuthGuard` gán `request.user` trước, `RolesGuard` mới đọc được để so role.

---

## 4. Interceptor — bọc quanh handler

### 4.1 Chuẩn hoá response

```ts
// src/common/interceptors/transform.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

```ts
// main.ts
app.useGlobalInterceptors(new TransformInterceptor());
```

Mọi response giờ có dạng:

```json
{ "success": true, "data": { "id": 1, "title": "..." }, "timestamp": "2026-08-09T..." }
```

### 4.2 Đo thời gian xử lý

```ts
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const req = ctx.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => console.log(`${req.method} ${req.url} +${Date.now() - now}ms`)),
    );
  }
}
```

### 4.3 Ẩn field nhạy cảm khỏi JSON trả về

```ts
// main.ts
import { ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

```ts
// user.entity.ts
import { Exclude } from 'class-transformer';

@Entity()
export class User {
  @Column()
  email: string;

  @Exclude()              // sẽ không xuất hiện trong JSON
  @Column()
  password: string;
}
```

> Chỉ hoạt động khi Service **trả về instance của class** (`plainToInstance` hoặc entity từ TypeORM), không phải object thường.

### 4.4 Cache

```ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(ctx: ExecutionContext, next: CallHandler) {
    const key = ctx.switchToHttp().getRequest().url;
    if (this.cache.has(key)) return of(this.cache.get(key));  // bỏ qua handler
    return next.handle().pipe(tap((data) => this.cache.set(key, data)));
  }
}
```

---

## 5. Pipe — validate & transform

Pipe có sẵn:

```ts
import {
  ParseIntPipe, ParseBoolPipe, ParseUUIDPipe,
  ParseArrayPipe, ParseFloatPipe, DefaultValuePipe,
} from '@nestjs/common';

@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {}

@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('active', new DefaultValuePipe(false), ParseBoolPipe) active: boolean,
) {}

@Get(':uuid')
byUuid(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {}
```

### Custom Pipe — nhận thẳng entity thay vì id

Thay vì mỗi controller đều phải `const post = await this.service.findOne(+id)`, bạn viết một pipe làm việc đó một lần và dùng lại ở mọi route.

```ts
// src/posts/pipes/post-by-id.pipe.ts
import { Injectable, PipeTransform, NotFoundException } from '@nestjs/common';
import { PostsService } from '../posts.service';
import { Post } from '../entities/post.entity';

@Injectable()
export class PostByIdPipe implements PipeTransform<string, Promise<Post>> {
  constructor(private readonly postsService: PostsService) {}

  async transform(value: string): Promise<Post> {
    const post = await this.postsService.findOne(+value);
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${value}`);
    return post;
  }
}
```

```ts
@Get(':id')
findOne(@Param('id', PostByIdPipe) post: Post) {
  return post;      // đã là entity, không phải id
}
```

---

## 6. Exception Filter — nơi xử lý mọi lỗi

```ts
// src/common/filters/all-exceptions.filter.ts
import {
  ArgumentsHost, Catch, ExceptionFilter,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()                          // không tham số = bắt TẤT CẢ exception
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Lỗi hệ thống';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(typeof payload === 'object' ? payload : { message: payload }),
    });
  }
}
```

```ts
// main.ts
app.useGlobalFilters(new AllExceptionsFilter());
```

Bắt riêng một loại exception:

```ts
@Catch(QueryFailedError)          // lỗi DB của TypeORM
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    // 23505 = unique_violation trong PostgreSQL
    if ((exception as any).code === '23505') {
      return res.status(409).json({ message: 'Dữ liệu đã tồn tại' });
    }
    return res.status(500).json({ message: 'Lỗi cơ sở dữ liệu' });
  }
}
```

---

## 7. Custom Param Decorator — `@CurrentUser()`

Thay vì viết `@Req() req` rồi `req.user` khắp nơi:

```ts
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
```

```ts
@Get('me')
getProfile(@CurrentUser() user: User) {
  return user;
}

@Post()
create(@Body() dto: CreatePostDto, @CurrentUser('id') userId: number) {
  return this.postsService.create(dto, userId);
}
```

Tương đương `auth()->user()` / `$request->user()`.

---

## 8. Bảng đăng ký nhanh

| Phạm vi | Middleware | Guard | Interceptor | Pipe | Filter |
|---|---|---|---|---|---|
| Toàn cục | `consumer.forRoutes('*')` / `app.use()` | `app.useGlobalGuards()` / `APP_GUARD` | `app.useGlobalInterceptors()` / `APP_INTERCEPTOR` | `app.useGlobalPipes()` / `APP_PIPE` | `app.useGlobalFilters()` / `APP_FILTER` |
| Controller | `forRoutes(XController)` | `@UseGuards()` | `@UseInterceptors()` | `@UsePipes()` | `@UseFilters()` |
| Route | — | `@UseGuards()` | `@UseInterceptors()` | `@UsePipes()` | `@UseFilters()` |
| Tham số | — | — | — | `@Param('id', Pipe)` | — |

> Dùng token `APP_GUARD` / `APP_INTERCEPTOR` / `APP_FILTER` / `APP_PIPE` trong `providers` khi cần **inject dependency** vào chúng:

```ts
import { APP_GUARD, APP_FILTER } from '@nestjs/core';

@Module({
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
```

---

## 9. Bài tập bài 5

1. `LoggerMiddleware` log `method url status +ms`, loại trừ route `/health`.
2. `TransformInterceptor` bọc mọi response thành `{ success, data, timestamp }`.
3. `AllExceptionsFilter` chuẩn hoá lỗi, log stack khi status >= 500.
4. `@Roles()` + `RolesGuard`. Fake user bằng middleware gán `req.user = { id:1, role:'admin' }`, rồi test route `@Roles('admin')` và `@Roles('editor')`.
5. `PostByIdPipe` để `@Get(':id')` nhận thẳng entity `Post`.
6. `@CurrentUser()` decorator, dùng trong `@Get('me')`.

➡️ Tiếp: [06-auth-jwt.md](./06-auth-jwt.md)
