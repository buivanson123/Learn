# Bài 2 — Controller, Routing, DTO & Validation

## 1. Routing

NestJS không có file khai báo route tập trung. URL được gắn **ngay trên method** bằng decorator, và ghép với prefix của `@Controller()`.

```ts
@Controller('posts')            // prefix chung: /posts
export class PostsController {

  @Get()                        // GET    /posts
  @Get('featured')              // GET    /posts/featured
  @Get(':id')                   // GET    /posts/123
  @Get(':id/comments')          // GET    /posts/123/comments
  @Post()                       // POST   /posts
  @Put(':id')                   // PUT    /posts/123
  @Patch(':id')                 // PATCH  /posts/123
  @Delete(':id')                // DELETE /posts/123
}
```

### ⚠️ Thứ tự route rất quan trọng

```ts
@Get('featured')   // ✅ phải đặt TRƯỚC
@Get(':id')        // nếu đặt trước, 'featured' sẽ bị hiểu là id
```

NestJS duyệt route **từ trên xuống theo thứ tự khai báo** và dừng ở cái khớp đầu tiên. Vì `:id` khớp với mọi chuỗi, nó sẽ nuốt luôn `/posts/featured`. Quy tắc: **route tĩnh luôn đặt trên route có tham số**.

### Wildcard & optional param

```ts
@Get('ab*cd')            // khớp /abXXXcd
@Get([':id', 'me'])      // nhiều path cho 1 handler
```

---

## 2. Lấy dữ liệu từ request

| Cần lấy | Decorator | Ví dụ URL / body |
|---|---|---|
| Toàn bộ body | `@Body() dto: CreateDto` | `{"title":"abc"}` |
| 1 field trong body | `@Body('email') email: string` | `{"email":"a@b.com"}` |
| Route param | `@Param('id') id: string` | `/posts/7` → `'7'` |
| Toàn bộ param | `@Param() params: any` | `{ id: '7' }` |
| Toàn bộ query | `@Query() query: QueryDto` | `?page=2&limit=10` |
| 1 query | `@Query('page') page: number` | `?page=2` → `'2'` |
| Header | `@Headers('authorization') auth: string` | `Authorization: Bearer ...` |
| Object request gốc | `@Req() req: Request` | dùng khi cần thứ Nest chưa bọc |
| Object response gốc | `@Res() res: Response` | hạn chế dùng (xem cảnh báo dưới) |
| IP client | `@Ip() ip: string` | |
| File upload | `@UploadedFile() file` | cần `FileInterceptor` |

```ts
import { Controller, Get, Post, Body, Param, Query, ParseIntPipe } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Get()
  findAll(@Query() query: FindPostsDto) {
    return this.postsService.findAll(query);
  }

  // ParseIntPipe: ép "123" -> 123, sai định dạng thì tự trả 400
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePostDto) {
    return this.postsService.create(dto);
  }
}
```

> ⚠️ **Tránh dùng `@Res()`** trừ khi thật cần (stream file, redirect). Dùng nó là bạn mất tính năng auto-serialize và interceptor của Nest.

---

## 3. Status code & Header

```ts
import { HttpCode, HttpStatus, Header, Redirect } from '@nestjs/common';

@Post()
@HttpCode(HttpStatus.CREATED)          // mặc định POST đã là 201
create() {}

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)       // 204
remove() {}

@Get('download')
@Header('Content-Type', 'text/csv')
download() {}

@Get('old')
@Redirect('https://example.com', 301)
old() {}
```

Mặc định: `GET/PUT/PATCH/DELETE` → **200**, `POST` → **201**.

---

## 4. DTO — validate dữ liệu đầu vào

**DTO (Data Transfer Object)** là một class mô tả hình dạng dữ liệu đi vào ứng dụng. Nó làm hai việc cùng lúc:

1. **Định kiểu** — IDE gợi ý đúng field, TypeScript bắt lỗi khi bạn gõ sai tên.
2. **Validate** — mỗi field gắn decorator quy định ràng buộc; `ValidationPipe` kiểm tra tự động trước khi controller chạy.

> ⚠️ DTO **phải là `class`**, không được là `interface`. Interface bị xoá sạch khi biên dịch nên không còn metadata để validate.

### Cài đặt

```bash
npm i class-validator class-transformer
```

Và bật `ValidationPipe` toàn cục trong `main.ts` (đã làm ở bài 0).

### Ví dụ DTO

```ts
// src/posts/dto/create-post.dto.ts
import {
  IsString, IsNotEmpty, MinLength, MaxLength,
  IsOptional, IsEmail, IsInt, Min, IsEnum,
  IsBoolean, IsArray, ValidateNested, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MinLength(5, { message: 'Tiêu đề tối thiểu 5 ký tự' })
  @MaxLength(255)
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus = PostStatus.DRAFT;

  @IsArray()
  @IsString({ each: true })     // each: true = validate từng phần tử mảng
  @IsOptional()
  tags?: string[];

  @IsInt()
  @Min(1)
  @Type(() => Number)           // ép kiểu string -> number
  categoryId: number;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
```

### Cách đọc một DTO

Các decorator **cộng dồn** với nhau — field phải thoả **tất cả**:

```ts
@IsString()      // phải là chuỗi
@IsNotEmpty()    // và không rỗng
@MinLength(5)    // và dài ít nhất 5 ký tự
title: string;
```

Ngoại lệ duy nhất là `@IsOptional()`: nếu field vắng mặt (`undefined`), **mọi decorator khác bị bỏ qua**. Nếu field có mặt, chúng vẫn chạy bình thường.

### Bảng tra decorator thường dùng

| Nhu cầu | Decorator |
|---|---|
| Bắt buộc có | `@IsNotEmpty()` |
| Cho phép vắng mặt | `@IsOptional()` |
| Chuỗi | `@IsString()` |
| Số nguyên / số thực | `@IsInt()` / `@IsNumber()` |
| Boolean | `@IsBoolean()` |
| Email / URL / UUID | `@IsEmail()` `@IsUrl()` `@IsUUID()` |
| Ngày dạng chuỗi ISO | `@IsDateString()` |
| Độ dài chuỗi | `@MinLength(5)` `@MaxLength(255)` `@Length(5,255)` |
| Khoảng giá trị số | `@Min(1)` `@Max(100)` |
| Thuộc tập giá trị | `@IsIn(['a','b'])` hoặc `@IsEnum(MyEnum)` |
| Mảng | `@IsArray()` `@ArrayNotEmpty()` `@ArrayMinSize(1)` |
| Kiểm tra từng phần tử mảng | thêm `{ each: true }` — vd `@IsString({ each: true })` |
| Biểu thức chính quy | `@Matches(/^[a-z0-9-]+$/)` |
| Mật khẩu mạnh | `@IsStrongPassword()` |
| Object lồng nhau | `@ValidateNested()` + `@Type(() => ChildDto)` |

Danh sách đầy đủ ở mục 2 của [09-cheatsheet.md](./09-cheatsheet.md).

### Object lồng nhau

```ts
class AddressDto {
  @IsString() street: string;
  @IsString() city: string;
}

export class CreateUserDto {
  @IsString()
  name: string;

  @ValidateNested()            // validate cả bên trong
  @Type(() => AddressDto)      // bắt buộc, để biết class con là gì
  address: AddressDto;

  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  otherAddresses: AddressDto[];
}
```

### Cập nhật: `PartialType` = tất cả field thành optional

```ts
// src/posts/dto/update-post.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
```

```bash
npm i @nestjs/mapped-types
```

Các helper khác: `PickType`, `OmitType`, `IntersectionType`.

```ts
export class LoginDto extends PickType(CreateUserDto, ['email', 'password'] as const) {}
export class PublicUserDto extends OmitType(CreateUserDto, ['password'] as const) {}
```

---

## 5. DTO cho query string (phân trang, lọc)

```ts
// src/posts/dto/find-posts.dto.ts
import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class FindPostsDto {
  @IsOptional()
  @Type(() => Number)          // query string luôn là string -> phải ép kiểu
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';
}
```

> `transform: true` trong `ValidationPipe` là bắt buộc để `@Type()` hoạt động. Nếu quên, `page` sẽ vẫn là string `"2"`.

Dùng:

```ts
@Get()
findAll(@Query() query: FindPostsDto) {
  // query.page đã là number, đã có default
  return this.postsService.findAll(query);
}
```

---

## 6. Custom validator — kiểm tra giá trị chưa tồn tại trong DB

Đôi khi rule phải hỏi database, ví dụ "email này chưa ai dùng". Bạn viết được decorator riêng cho việc đó.

```ts
// src/common/validators/is-unique.validator.ts
import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint, ValidatorConstraintInterface,
  ValidationArguments, registerDecorator, ValidationOptions,
} from 'class-validator';
import { DataSource } from 'typeorm';

@ValidatorConstraint({ name: 'IsUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(private dataSource: DataSource) {}

  async validate(value: any, args: ValidationArguments): Promise<boolean> {
    const [entity, column] = args.constraints as [Function, string];
    const found = await this.dataSource
      .getRepository(entity)
      .findOne({ where: { [column]: value } });
    return !found;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} "${args.value}" đã tồn tại`;
  }
}

export function IsUnique(
  entity: Function,
  column: string,
  options?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [entity, column],
      validator: IsUniqueConstraint,
    });
  };
}
```

Đăng ký constraint như một provider (để nó inject được `DataSource`) và bật container:

```ts
// main.ts
import { useContainer } from 'class-validator';
useContainer(app.select(AppModule), { fallbackOnErrors: true });
```

```ts
// app.module.ts -> providers: [IsUniqueConstraint]
```

Dùng:

```ts
export class CreateUserDto {
  @IsEmail()
  @IsUnique(User, 'email', { message: 'Email đã được sử dụng' })
  email: string;
}
```

---

## 7. Định dạng response lỗi validation

Mặc định NestJS trả:

```json
{
  "statusCode": 400,
  "message": ["Tiêu đề tối thiểu 5 ký tự", "content should not be empty"],
  "error": "Bad Request"
}
```

Dạng này bất tiện cho frontend: nó chỉ có một mảng phẳng, không biết lỗi nào thuộc field nào. Gom lỗi theo tên field sẽ dễ hiển thị hơn nhiều:

```ts
// main.ts
new ValidationPipe({
  whitelist: true,
  transform: true,
  exceptionFactory: (errors) => {
    const formatted = errors.reduce((acc, err) => {
      acc[err.property] = Object.values(err.constraints ?? {});
      return acc;
    }, {} as Record<string, string[]>);
    return new UnprocessableEntityException({
      statusCode: 422,
      message: 'Dữ liệu không hợp lệ',
      errors: formatted,
    });
  },
})
```

Kết quả:

```json
{
  "statusCode": 422,
  "message": "Dữ liệu không hợp lệ",
  "errors": {
    "title": ["Tiêu đề tối thiểu 5 ký tự"],
    "content": ["content should not be empty"]
  }
}
```

---

## 8. Ném lỗi HTTP

Bạn không tự tạo response lỗi. Cứ `throw` một exception có sẵn, NestJS bắt và chuyển thành HTTP response đúng status kèm JSON.

```ts
import {
  BadRequestException,        // 400
  UnauthorizedException,      // 401
  ForbiddenException,         // 403
  NotFoundException,          // 404
  ConflictException,          // 409
  UnprocessableEntityException, // 422
  InternalServerErrorException, // 500
  HttpException, HttpStatus,
} from '@nestjs/common';

throw new NotFoundException('Không tìm thấy bài viết');
throw new ForbiddenException('Bạn không có quyền sửa bài này');

// Tuỳ biến hoàn toàn
throw new HttpException(
  { code: 'OUT_OF_STOCK', message: 'Hết hàng' },
  HttpStatus.CONFLICT,
);
```

---

## 9. Bài tập bài 2

Tạo module `posts` với:

1. `CreatePostDto`: `title` (5–255 ký tự, bắt buộc), `content` (bắt buộc), `status` (enum draft/published, mặc định draft), `tags` (mảng string, optional).
2. `UpdatePostDto` dùng `PartialType`.
3. `FindPostsDto`: `page` (default 1), `limit` (default 10, max 50), `search` (optional).
4. Controller đủ 5 route CRUD, dùng `ParseIntPipe` cho `:id`.
5. `findOne` ném `NotFoundException` khi không thấy.
6. Đổi format lỗi validation sang 422 với `errors` gom theo tên field.

Test:

```bash
# phải trả 422 vì title quá ngắn
curl -X POST localhost:3000/posts -H 'Content-Type: application/json' -d '{"title":"abc","content":"x"}'

# phải trả 400 vì id không phải số
curl localhost:3000/posts/abc

# phải bị chặn vì field lạ (whitelist + forbidNonWhitelisted)
curl -X POST localhost:3000/posts -H 'Content-Type: application/json' \
  -d '{"title":"Bai viet dau","content":"noi dung","hacker":"1"}'
```

➡️ Tiếp: [03-provider-va-di.md](./03-provider-va-di.md)
