# Bài 0 — Chuẩn bị: Cài đặt & TypeScript tối thiểu

## 1. Cài Nest CLI và tạo project

```bash
npm i -g @nestjs/cli

nest new blog-api
# chọn npm (hoặc pnpm)

cd blog-api
npm run start:dev     # chạy chế độ watch, tự reload khi sửa file
```

Mở http://localhost:3000 → thấy `Hello World!`.

### Cấu trúc thư mục sinh ra

```
blog-api/
├── src/
│   ├── main.ts                  # điểm khởi động ứng dụng
│   ├── app.module.ts            # module gốc, nơi lắp ráp mọi thứ
│   ├── app.controller.ts        # nhận HTTP request
│   ├── app.controller.spec.ts   # file test
│   └── app.service.ts           # chứa logic
├── test/                        # test end-to-end
├── nest-cli.json
├── tsconfig.json
└── package.json
```

Bạn sẽ tự tạo `.env` ở bước sau (bài 7).

### Script hay dùng

```bash
npm run start:dev      # dev + tự reload
npm run start:debug    # dev + mở debugger port 9229
npm run build          # biên dịch TypeScript ra dist/
npm run start:prod     # chạy production (node dist/main)
npm run test           # unit test (Jest)
npm run test:e2e       # test end-to-end
npm run lint
```

---

## 2. `main.ts` — điểm khởi động

Đây là file chạy đầu tiên. Nó tạo ứng dụng từ `AppModule` rồi lắng nghe cổng.

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật validation toàn cục — BẮT BUỘC nếu bạn dùng DTO (xem bài 02)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // tự loại bỏ field không khai báo trong DTO
      forbidNonWhitelisted: true, // gửi field lạ => báo lỗi 400
      transform: true,            // tự ép kiểu: "1" => 1
    }),
  );

  app.setGlobalPrefix('api');     // mọi route thành /api/...
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

Mọi cấu hình **toàn cục** (pipe, guard, interceptor, filter, CORS, Swagger) đều đặt ở đây.

---

## 3. TypeScript — chỉ cần biết 6 thứ này là đủ chạy NestJS

Bạn **không cần** học hết TypeScript. Sáu khái niệm sau là đủ để viết NestJS thành thạo.

### 3.1 Khai báo kiểu cơ bản

```ts
let name: string = 'Sơn';
let age: number = 25;
let active: boolean = true;
let tags: string[] = ['nest', 'js'];
let anything: any = 'gì cũng được';   // hạn chế dùng — mất hết lợi ích của TS
```

Thực tế TypeScript **tự suy ra kiểu**, nên bạn chỉ cần ghi kiểu ở nơi nó không đoán được:

```ts
let name = 'Sơn';        // TS tự biết đây là string
```

Hàm:

```ts
function sum(a: number, b: number): number {
  return a + b;
}

// Hàm async LUÔN trả về Promise<T>
async function findUser(id: number): Promise<User> {
  return this.repo.findOne(id);
}
```

Kiểu trả về đặc biệt:

```ts
function log(msg: string): void {}      // không trả gì
function fail(): never { throw new Error(); }  // không bao giờ return
```

### 3.2 `interface` và `type` — mô tả hình dạng dữ liệu

```ts
interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;         // dấu ? = optional, có thể không có
  readonly createdAt: Date; // chỉ đọc
}

type Status = 'draft' | 'published' | 'archived';  // union type, rất hay dùng
type ID = string | number;
```

Dùng:

```ts
const user: User = { id: 1, name: 'Sơn', email: 'a@b.com' };  // avatar bỏ được
let s: Status = 'draft';
s = 'xyz';    // ❌ TS báo lỗi ngay khi gõ
```

Chọn cái nào? `interface` cho object, `type` cho union và alias. Không quan trọng lắm — thống nhất là được.

### 3.3 `class` + access modifier

```ts
export class UsersService {
  private items: User[] = [];       // chỉ dùng trong class này
  protected cache: Map<string, any>; // class này + class kế thừa
  public readonly version = '1.0';   // ai cũng đọc được, không sửa được
}
```

Mặc định không ghi gì = `public`.

### 3.4 Constructor shorthand — **quan trọng nhất trong NestJS**

TypeScript cho phép viết tắt: khai báo property + gán giá trị ngay trên tham số constructor.

```ts
// Cách dài
class UsersService {
  private readonly repo: UserRepository;
  constructor(repo: UserRepository) {
    this.repo = repo;
  }
}

// Cách ngắn — NestJS dùng cách này ở khắp nơi
class UsersService {
  constructor(private readonly repo: UserRepository) {}
  // tự động có this.repo, không cần khai báo và gán
}
```

Chỉ cần thêm `private` / `public` / `readonly` vào trước tham số là TypeScript tự tạo property.

👉 Bạn sẽ thấy `constructor(private readonly xxx: Yyy) {}` trong **100% Service** của NestJS. Đây chính là cách khai báo Dependency Injection.

### 3.5 Decorator — hàm gắn "nhãn" vào class

```ts
@Controller('users')
export class UsersController {
  @Get()
  findAll() {}
}
```

Decorator là hàm bắt đầu bằng `@`, gắn **metadata** vào class / method / property. NestJS đọc metadata đó lúc khởi động để biết: class này là controller, method này ứng với `GET /users`.

Bạn **không cần biết cách viết** decorator (dù bài 5 có hướng dẫn), chỉ cần biết **dùng** chúng.

Các decorator gặp nhiều nhất:

| Decorator | Ý nghĩa |
|---|---|
| `@Module({...})` | Khai báo một module |
| `@Controller('path')` | Đánh dấu class là controller, đặt prefix URL |
| `@Get()` `@Post()` `@Put()` `@Patch()` `@Delete()` | Gắn HTTP method cho một hàm |
| `@Injectable()` | Cho phép class được inject vào nơi khác |
| `@Body()` `@Param()` `@Query()` | Lấy dữ liệu từ request |
| `@UseGuards()` | Gắn guard kiểm soát truy cập |

### 3.6 Generic `<T>` — chỉ cần đọc hiểu

```ts
Promise<User>          // Promise trả về một User
Array<string>          // = string[]
Repository<Post>       // Repository làm việc với entity Post
Record<string, any>    // object với key string, value bất kỳ
Partial<User>          // User nhưng mọi field thành optional
```

Không cần tự viết generic. Chỉ cần hiểu `<T>` nghĩa là "chứa gì bên trong".

---

## 4. Cấu hình `tsconfig.json`

```json
{
  "compilerOptions": {
    "strictNullChecks": true,
    "noImplicitAny": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

- `experimentalDecorators` — cho phép dùng cú pháp `@`.
- `emitDecoratorMetadata` — giữ lại thông tin kiểu sau khi biên dịch. **Đây là thứ giúp NestJS tự biết cần inject class nào** vào constructor. Không bao giờ tắt nó.
- `strictNullChecks` — bắt bạn xử lý trường hợp `null`/`undefined`. Hơi phiền lúc đầu nhưng chặn được rất nhiều bug.

---

## 5. Chạy thử tay: sửa `app.controller.ts`

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('chao')
  chao(@Query('ten') ten: string): { message: string } {
    return { message: `Xin chào, ${ten ?? 'bạn'}!` };
  }
}
```

```bash
curl "localhost:3000/chao?ten=Son"
# {"message":"Xin chào, Son!"}
```

Chú ý: bạn `return` một object thường, NestJS **tự chuyển thành JSON** và tự set status 200. Không cần gọi hàm nào để trả response.

---

## ✅ Checklist trước khi sang bài 1

- [ ] Tạo được project bằng `nest new`
- [ ] Chạy được `npm run start:dev`, sửa file thấy tự reload
- [ ] Hiểu `constructor(private readonly x: Y) {}` tạo ra `this.x`
- [ ] Biết decorator là gì và kể được 5 decorator
- [ ] Đã bật `ValidationPipe` trong `main.ts`
- [ ] Tự thêm được một route `@Get('chao')` trả về JSON

➡️ Tiếp: [01-kien-truc-nestjs.md](./01-kien-truc-nestjs.md)
