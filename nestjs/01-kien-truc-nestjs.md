# Bài 1 — Kiến trúc NestJS: Module, Controller, Provider

> Đây là file nền tảng. Hiểu kỹ 3 khối này, mọi thứ còn lại chỉ là chi tiết.

## 1. Ba khối lego của NestJS

Mọi ứng dụng NestJS, dù lớn đến đâu, cũng chỉ gồm 3 loại thành phần:

```
MODULE ─── gom nhóm & khai báo mọi thứ liên quan tới một tính năng
   ├── CONTROLLER ─── nhận HTTP request, trả response. Mỏng, không chứa logic.
   └── PROVIDER  ─── chứa business logic (Service, Repository, Helper...)
```

Một ứng dụng thật sẽ có nhiều module, mỗi module lo một tính năng:

```
AppModule (gốc)
├── UsersModule    → UsersController + UsersService
├── PostsModule    → PostsController + PostsService
├── AuthModule     → AuthController  + AuthService
└── CommentsModule → ...
```

---

## 2. Controller — tầng "lễ tân"

Controller chỉ làm 3 việc: **nhận** request, **gọi** service, **trả** kết quả.

```ts
// src/users/users.controller.ts
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')          // mọi route trong class này có prefix /users
export class UsersController {
  // NestJS tự đưa UsersService vào đây — bạn không cần new
  constructor(private readonly usersService: UsersService) {}

  @Get()                      // GET /users
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')                 // GET /users/1
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);   // dấu + ép string sang number
  }

  @Post()                     // POST /users
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
```

### Ba điều cần nhớ về Controller

1. **Không có file route riêng.** URL được khai báo ngay bằng decorator trên method.
2. **Không cần chuyển sang JSON thủ công.** Cứ `return` object/array, NestJS tự serialize và tự set status code (200 cho `GET`, **201 cho `POST`**).
3. **Controller phải mỏng.** Mỗi method lý tưởng chỉ 1 dòng gọi service. Nếu bạn viết `if/else`, tính toán, hoặc query DB trong controller → chuyển nó xuống Service.

---

## 3. Provider (Service) — nơi chứa toàn bộ logic

```ts
// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()                 // BẮT BUỘC — báo cho Nest biết class này inject được
export class UsersService {
  private users = [{ id: 1, name: 'Sơn' }];

  findAll() {
    return this.users;
  }

  findOne(id: number) {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      // ném exception -> Nest tự trả HTTP 404 kèm JSON lỗi
      throw new NotFoundException(`Không tìm thấy user #${id}`);
    }
    return user;
  }

  create(dto: { name: string }) {
    const user = { id: Date.now(), ...dto };
    this.users.push(user);
    return user;
  }
}
```

`@Injectable()` làm hai việc: đăng ký class vào **IoC container** của NestJS, và cho phép chính nó nhận dependency qua constructor.

### Vì sao tách Service ra khỏi Controller?

- **Tái sử dụng:** `UsersService` dùng được cả trong controller HTTP, trong cron job, trong WebSocket handler.
- **Test dễ:** test một class thuần TypeScript đơn giản hơn nhiều so với test qua HTTP.
- **Thay đổi ít lan:** đổi từ REST sang GraphQL chỉ cần viết lại controller, service giữ nguyên.

---

## 4. Module — nơi lắp ráp

```ts
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [],                     // module này CẦN gì từ module khác
  controllers: [UsersController],  // controller thuộc module này
  providers: [UsersService],       // service dùng được BÊN TRONG module này
  exports: [UsersService],         // cho module KHÁC dùng UsersService
})
export class UsersModule {}
```

Rồi khai báo vào module gốc:

```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [UsersModule, PostsModule],
})
export class AppModule {}
```

`AppModule` là module duy nhất được `main.ts` biết đến. Mọi module khác phải nằm trong chuỗi `imports` bắt nguồn từ nó, nếu không NestJS sẽ **không thấy** chúng.

### Bốn thuộc tính của `@Module` — học thuộc

| Thuộc tính | Nghĩa | Quên thì sao |
|---|---|---|
| `controllers` | Các controller của module | Route không tồn tại → 404 |
| `providers` | Các class được tạo và dùng nội bộ | `Nest can't resolve dependencies` |
| `exports` | Provider mở ra cho module khác | Module khác import vào cũng không dùng được |
| `imports` | Kéo module khác vào để dùng `exports` của nó | `Nest can't resolve dependencies` |

### Quy tắc nhớ đời

> **Muốn module A dùng Service của module B:**
> 1. Module B phải có `exports: [BService]`
> 2. Module A phải có `imports: [BModule]`
>
> Thiếu **một trong hai** → lỗi `Nest can't resolve dependencies of ...`

Ví dụ `PostsService` cần `UsersService`:

```ts
// users.module.ts
@Module({
  providers: [UsersService],
  exports: [UsersService],        // ① mở ra
})
export class UsersModule {}

// posts.module.ts
@Module({
  imports: [UsersModule],         // ② kéo vào
  providers: [PostsService],
})
export class PostsModule {}

// posts.service.ts
@Injectable()
export class PostsService {
  constructor(private readonly usersService: UsersService) {}  // ③ dùng
}
```

---

## 5. Dependency Injection hoạt động thế nào

Khi NestJS khởi động:

1. Nó đọc `AppModule`, đi theo `imports` để tìm hết mọi module.
2. Với mỗi module, nó đọc `providers` và **tạo sẵn một instance** cho mỗi class (singleton).
3. Khi cần tạo `PostsController`, nó nhìn constructor:
   ```ts
   constructor(private readonly postsService: PostsService) {}
   ```
   thấy kiểu là `PostsService`, tìm instance đã tạo ở bước 2, và truyền vào.

Nhờ `emitDecoratorMetadata` trong `tsconfig.json`, kiểu `PostsService` vẫn còn sau khi biên dịch — đó là cách Nest "biết" phải inject gì.

**Hệ quả quan trọng:** bạn không bao giờ viết `new PostsService()`. Nếu bạn tự `new`, dependency bên trong nó sẽ là `undefined`.

---

## 6. Sinh code nhanh bằng CLI

```bash
nest g module users        # tạo users.module.ts + tự thêm vào app.module.ts
nest g controller users    # tạo controller + tự thêm vào users.module.ts
nest g service users       # tạo service + tự thêm vào providers

# Hoặc gọn nhất — tạo cả CRUD (module + controller + service + dto + entity):
nest g resource users
# chọn: REST API -> Yes (generate CRUD entry points)
```

`nest g resource` sinh sẵn 5 route CRUD, 2 DTO và 1 entity. Dùng nó liên tục — vừa nhanh vừa tự động khai báo đúng vào Module.

Các flag hữu ích:

```bash
nest g resource users --no-spec     # không sinh file test
nest g service users --flat         # không tạo thư mục con
nest g controller users --dry-run   # xem trước, không ghi file
```

---

## 7. Cấu trúc thư mục nên theo

Chia theo **tính năng**, không chia theo loại file:

```
src/
├── main.ts
├── app.module.ts
├── common/                     # dùng chung toàn app
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
├── config/
│   └── database.config.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/jwt.strategy.ts
│   └── dto/login.dto.ts
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/user.entity.ts
│   └── dto/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
└── posts/
    └── ... (tương tự)
```

**Vì sao?** Khi sửa tính năng "posts", mọi file liên quan nằm cùng một chỗ. Nếu chia theo loại (`controllers/`, `services/`), bạn phải nhảy qua lại 4 thư mục cho một thay đổi.

---

## 8. Luồng đi của một request

```
GET /users/1
   ↓
main.ts  →  AppModule  →  UsersModule
   ↓
UsersController.findOne()      ← decorator @Get(':id') khớp URL
   ↓
this.usersService.findOne(1)   ← controller gọi service
   ↓
UsersService trả về object     ← hoặc throw NotFoundException
   ↓
NestJS serialize thành JSON, set status 200
   ↓
Response
```

---

## 9. Bài tập bài 1

1. Tạo project `blog-api`.
2. Chạy `nest g resource users --no-spec` (chọn REST API, có CRUD).
3. Mở 4 file được sinh ra, đọc từng dòng và tự giải thích được mỗi decorator làm gì.
4. Sửa `UsersService` để lưu user trong mảng in-memory (chưa cần DB). Cài đặt đủ `findAll`, `findOne`, `create`, `update`, `remove`.
5. `findOne` với id không tồn tại phải ném `NotFoundException`.
6. Test đủ 5 endpoint:

```bash
curl -X POST localhost:3000/users -H 'Content-Type: application/json' -d '{"name":"Son"}'
curl localhost:3000/users
curl localhost:3000/users/1
curl -i localhost:3000/users/999      # phải trả 404
```

7. Tạo thêm `nest g resource posts`, rồi làm `PostsService` **inject** `UsersService` để mỗi post biết tên tác giả.
   → Bạn sẽ gặp lỗi `Nest can't resolve dependencies`. Hãy tự sửa bằng `exports` + `imports` (mục 4). **Đây là bài tập quan trọng nhất của bài này.**

➡️ Tiếp: [02-controller-routing-dto.md](./02-controller-routing-dto.md)
