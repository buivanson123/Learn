# Bài 10 — Lỗi thường gặp & cách sửa

Đây là những lỗi hầu như ai học NestJS cũng gặp. Đọc lướt một lần bây giờ, và quay lại tra khi bí.

---

## 1. `Nest can't resolve dependencies of the XService (?)`

**Lỗi đầy đủ:**
```
Error: Nest can't resolve dependencies of the PostsService (?).
Please make sure that the argument UsersService at index [0] is available in the PostsModule context.
```

**Nguyên nhân & cách sửa — kiểm tra theo thứ tự:**

1. **Quên `@Injectable()`** trên class được inject.
```ts
@Injectable()          // <- thiếu dòng này
export class UsersService {}
```

2. **Quên khai báo trong `providers`** của module chứa nó.
```ts
@Module({ providers: [UsersService] })
```

3. **Dùng service của module khác nhưng chưa `exports` + `imports`.**
```ts
// users.module.ts
@Module({ providers: [UsersService], exports: [UsersService] })   // ① export

// posts.module.ts
@Module({ imports: [UsersModule] })                               // ② import
```

4. **Quên `TypeOrmModule.forFeature([Entity])`** khi inject repository.
```ts
@Module({ imports: [TypeOrmModule.forFeature([Post])] })
```

5. **Inject bằng token string/Symbol nhưng quên `@Inject()`.**
```ts
constructor(@Inject('STRIPE') private s: Stripe) {}
```

> Dấu `?` trong thông báo lỗi chính là **vị trí tham số bị lỗi**. `(?, UsersService)` nghĩa là tham số thứ **nhất** có vấn đề.

---

## 2. Validation không chạy — DTO như không tồn tại

**Triệu chứng:** gửi body rác vẫn qua, không báo 400.

**Nguyên nhân:**

1. Quên bật `ValidationPipe`:
```ts
// main.ts
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
```

2. Dùng `interface` thay vì `class` cho DTO. **Interface biến mất khi compile** → không có metadata.
```ts
export interface CreatePostDto {}   // ❌ SAI
export class CreatePostDto {}       // ✅ ĐÚNG
```

3. Thiếu `emitDecoratorMetadata: true` trong `tsconfig.json`.

4. Quên `@Body()`:
```ts
create(dto: CreatePostDto) {}          // ❌ dto sẽ là undefined
create(@Body() dto: CreatePostDto) {}  // ✅
```

---

## 3. `page` trong query vẫn là string `"2"` thay vì number `2`

Query string **luôn** là string. Cần 2 thứ:

```ts
// main.ts
new ValidationPipe({ transform: true })       // ①

// dto
@Type(() => Number)                            // ② từ class-transformer
@IsInt()
page: number;
```

Thiếu bất kỳ cái nào → `page` vẫn là string, và `(page - 1) * limit` cho kết quả sai.

---

## 4. `@Exclude()` không ẩn được password

```ts
@Exclude()
@Column()
password: string;
```

Cần thêm:

1. Bật `ClassSerializerInterceptor`:
```ts
app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
```

2. Service phải trả về **instance của class**, không phải object thường:
```ts
return this.repo.findOne(...);              // ✅ entity instance
return { ...user };                         // ❌ mất metadata -> lộ password
return { id: 1, name: 'x' };                // ❌ object thường
```

3. Nếu dùng `@Res()` thô → interceptor bị bỏ qua hoàn toàn.

**Cách chắc chắn nhất:** đặt `@Column({ select: false })` trên password → DB không trả về từ đầu.

---

## 5. Route `:id` "nuốt" mất route tĩnh

```ts
@Get(':id')          // ❌ khai báo trước
findOne() {}

@Get('featured')     // không bao giờ chạy được — 'featured' bị hiểu là id
findFeatured() {}
```

**Sửa:** route tĩnh luôn đặt **trước** route có tham số.

---

## 6. Service lưu state — dữ liệu lẫn giữa các user

```ts
@Injectable()
export class CartService {
  private items = [];      // ❌ SINGLETON — dùng chung cho MỌI request!
  add(item) { this.items.push(item); }
}
```

Provider mặc định là **singleton**. Đừng lưu dữ liệu riêng của request vào property. Truyền qua tham số, hoặc dùng `Scope.REQUEST` (cân nhắc hiệu năng).

---

## 7. `Circular dependency detected`

```ts
// cả hai phía
@Inject(forwardRef(() => OtherService)) private other: OtherService

// và trong module
imports: [forwardRef(() => OtherModule)]
```

Nhưng tốt nhất: tách phần dùng chung ra service thứ ba.

---

## 8. TypeORM: `relation not found` hoặc quan hệ trả về `undefined`

1. Quên khai báo `relations`:
```ts
this.repo.findOne({ where: { id }, relations: { author: true } });
```

2. Dùng import vòng giữa 2 entity → dùng **arrow function** trong quan hệ:
```ts
@ManyToOne(() => User, (u) => u.posts)     // ✅ lazy reference
@ManyToOne(User)                            // ❌ có thể undefined lúc load
```

3. Quên `autoLoadEntities: true` hoặc chưa liệt kê entity trong `entities: []`.

---

## 9. TypeORM: `synchronize` xoá mất dữ liệu

`synchronize: true` **tự động ALTER/DROP** bảng theo entity. Đổi tên một cột → nó DROP cột cũ, mất sạch dữ liệu.

```ts
synchronize: process.env.NODE_ENV !== 'production'
```

Và ngay khi có dữ liệu thật (kể cả dev) → chuyển sang migration.

---

## 10. `Cannot read properties of undefined (reading 'user')`

Bạn dùng `req.user` nhưng guard chưa chạy hoặc chạy sau.

- Kiểm tra `@UseGuards(JwtAuthGuard)` đã gắn chưa.
- Thứ tự guard: `@UseGuards(JwtAuthGuard, RolesGuard)` — auth **trước**, role **sau**.
- **Middleware chạy trước Guard** → không thể đọc `req.user` trong middleware.

---

## 11. `@Public()` không hoạt động, vẫn bị đòi token

Guard toàn cục phải **đọc metadata** qua `Reflector`:

```ts
const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
  context.getHandler(),      // method
  context.getClass(),        // controller
]);
if (isPublic) return true;
```

Dùng `getAllAndOverride` (method thắng class), không phải `get()`.

---

## 12. Guard/Filter/Interceptor toàn cục không inject được dependency

```ts
app.useGlobalGuards(new RolesGuard(???));   // ❌ không có DI
```

Dùng token trong `providers`:

```ts
import { APP_GUARD } from '@nestjs/core';

@Module({
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],   // ✅ có DI
})
```

Tương tự: `APP_INTERCEPTOR`, `APP_FILTER`, `APP_PIPE`.

---

## 13. `forbidNonWhitelisted` chặn cả request hợp lệ

```json
{ "message": ["property xyz should not exist"] }
```

Frontend gửi thừa field (vd: `_token`, `created_at`). Hoặc:
- Thêm field đó vào DTO với `@IsOptional()`
- Hoặc bỏ `forbidNonWhitelisted`, chỉ giữ `whitelist: true` (âm thầm loại bỏ)

---

## 14. Async không await → lỗi im lặng

```ts
create(dto) {
  this.repo.save(dto);      // ❌ không await, không await -> trả về trước khi lưu xong
  return { ok: true };
}

async create(dto) {
  return await this.repo.save(dto);   // ✅
}
```

Bật ESLint rule `@typescript-eslint/no-floating-promises` để bắt lỗi này tự động.

---

## 15. `Converting circular structure to JSON`

Quan hệ 2 chiều `Post.author` ↔ `User.posts` load lẫn nhau vô hạn.

**Sửa:** chỉ load 1 chiều, hoặc dùng `@Exclude()` phía ngược, hoặc chọn field cụ thể:

```ts
this.repo.find({
  relations: { author: true },
  select: { author: { id: true, name: true } },
});
```

---

## 16. Import sai: `Post` của NestJS vs `Post` entity

```ts
import { Post } from '@nestjs/common';       // decorator HTTP POST
import { Post } from './entities/post.entity'; // entity
```

Trùng tên → lỗi khó hiểu. Đổi alias:

```ts
import { Post as HttpPost } from '@nestjs/common';
import { Post } from './entities/post.entity';

@HttpPost()
create(): Promise<Post> {}
```

---

## 17. Test: `Nest can't resolve dependencies` trong file `.spec.ts`

Trong test bạn phải **cung cấp mock** cho mọi dependency:

```ts
Test.createTestingModule({
  providers: [
    PostsService,
    { provide: getRepositoryToken(Post), useValue: mockRepo },
    { provide: ConfigService, useValue: { get: jest.fn() } },
  ],
}).compile();
```

---

## 18. Build production báo lỗi nhưng dev chạy được

- `ts-node` (dev) lỏng hơn `tsc` (build). Chạy `npm run build` thường xuyên.
- Kiểm tra đường dẫn entity trong config: dev là `.ts`, production là `.js` trong `dist/`.
```ts
entities: [__dirname + '/**/*.entity{.ts,.js}']
// hoặc tốt hơn: autoLoadEntities: true
```

---

## 19. Debug hiệu quả

```ts
// Bật log query SQL
TypeOrmModule.forRoot({ logging: true, logger: 'advanced-console' })

// Log toàn bộ route đã đăng ký khi khởi động
const server = app.getHttpServer();
const router = server._events.request._router;
console.log(
  router.stack.filter((l) => l.route).map((l) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`),
);
```

Chạy debugger:

```bash
npm run start:debug     # rồi attach VS Code vào port 9229
```

---

## 20. Bảng phản xạ nhanh

| Triệu chứng | Nghĩ ngay tới |
|---|---|
| `can't resolve dependencies` | thiếu `@Injectable` / `providers` / `exports`+`imports` |
| DTO không validate | thiếu `ValidationPipe`, dùng interface, thiếu `@Body()` |
| Số vẫn là string | thiếu `transform: true` + `@Type(() => Number)` |
| Password lộ ra | thiếu `ClassSerializerInterceptor` hoặc trả object thường |
| `req.user` undefined | guard chưa chạy / sai thứ tự / đang ở middleware |
| Route không khớp | `:id` đặt trước route tĩnh |
| Dữ liệu lẫn giữa user | lưu state trong singleton service |
| Relation undefined | thiếu `relations: {}` |
| Mất dữ liệu DB | `synchronize: true` trên production |
| JSON vòng lặp | quan hệ 2 chiều, dùng `select` giới hạn field |
