# Bài 3 — Provider & Dependency Injection

Dependency Injection là cơ chế trung tâm của NestJS. Bài này giải thích nó hoạt động ra sao và bạn điều khiển được những gì.

## 1. Provider là gì?

**Provider** = bất cứ class nào được NestJS **tạo instance và quản lý** trong IoC container: Service, Repository, Factory, Helper, Guard, Interceptor...

Đánh dấu bằng `@Injectable()`:

```ts
@Injectable()
export class MailService {
  send(to: string, subject: string) { /* ... */ }
}
```

Khai báo trong module:

```ts
@Module({
  providers: [MailService],
})
export class MailModule {}
```

Rồi inject ở bất kỳ đâu trong module đó:

```ts
@Injectable()
export class UsersService {
  constructor(private readonly mailService: MailService) {}

  async register(dto: CreateUserDto) {
    const user = await this.repo.save(dto);
    await this.mailService.send(user.email, 'Chào mừng!');
    return user;
  }
}
```

### Cơ chế bên dưới

Lúc khởi động, NestJS đọc kiểu của từng tham số constructor (nhờ `emitDecoratorMetadata`), tra trong **IoC container** xem đã có instance nào của kiểu đó chưa, rồi truyền vào. Container chính là một cái map `{ token → instance }`, với token mặc định là chính class đó.

Vì vậy: class nào không nằm trong `providers` thì không có trong container, và inject sẽ thất bại. NestJS **không tự quét thư mục** để tìm class — bạn phải khai báo.

---

## 2. Scope — vòng đời của provider

| Scope | Ý nghĩa | Khi nào dùng |
|---|---|---|
| `DEFAULT` (mặc định) | **Singleton** — 1 instance dùng chung cho cả app | Gần như luôn luôn |
| `REQUEST` | Mỗi HTTP request tạo 1 instance mới | Cần dữ liệu riêng của request (multi-tenant, request context) |
| `TRANSIENT` | Mỗi nơi inject nhận 1 instance riêng | Provider có state riêng cho từng chủ sở hữu (vd: logger gắn tên class) |

```ts
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  constructor(@Inject(REQUEST) private request: Request) {}
}
```

> ⚠️ `REQUEST` scope **lan truyền lên trên**: nếu `UsersService` inject một provider REQUEST-scoped, thì `UsersService` cũng thành REQUEST-scoped, và `UsersController` cũng vậy → ảnh hưởng hiệu năng. Chỉ dùng khi thật cần.

**Mặc định là singleton** → đừng lưu state riêng của từng request vào property của Service. Đây là lỗi kinh điển:

```ts
@Injectable()
export class BadService {
  private currentUser: User;   // ❌ SAI - dùng chung giữa mọi request!

  setUser(u: User) { this.currentUser = u; }
}
```

---

## 3. Custom Provider — 4 cách bind (giống `$this->app->bind`)

### 3.1 `useClass` — thay implementation

```ts
@Module({
  providers: [
    {
      provide: MailService,
      useClass: process.env.NODE_ENV === 'production'
        ? SendgridMailService
        : FakeMailService,
    },
  ],
})
```

Code inject vẫn viết `constructor(private mail: MailService)` như bình thường, nhưng thứ nhận được là `SendgridMailService` hay `FakeMailService` tuỳ môi trường. Rất tiện cho test.

### 3.2 `useValue` — bind giá trị/object có sẵn

```ts
const stripeClient = new Stripe(process.env.STRIPE_KEY);

@Module({
  providers: [
    { provide: 'STRIPE_CLIENT', useValue: stripeClient },
  ],
})
```

Inject bằng token string → phải dùng `@Inject()`:

```ts
constructor(@Inject('STRIPE_CLIENT') private stripe: Stripe) {}
```

### 3.3 `useFactory` — tạo động, có thể async

```ts
@Module({
  providers: [
    {
      provide: 'DB_CONNECTION',
      inject: [ConfigService],            // dependency cho factory
      useFactory: async (config: ConfigService) => {
        return await createConnection({
          host: config.get('DB_HOST'),
          port: config.get<number>('DB_PORT'),
        });
      },
    },
  ],
})
```

### 3.4 `useExisting` — tạo alias

```ts
{ provide: 'LoggerAlias', useExisting: LoggerService }
```

---

## 4. Interface + Injection Token (chuẩn "code to interface")

TypeScript interface **biến mất khi compile**, nên không dùng interface làm token được. Giải pháp: dùng token string/Symbol.

```ts
// src/payment/payment.interface.ts
export interface PaymentGateway {
  charge(amount: number): Promise<string>;
}
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
```

```ts
// src/payment/stripe.gateway.ts
@Injectable()
export class StripeGateway implements PaymentGateway {
  async charge(amount: number) { return 'stripe_tx_123'; }
}
```

```ts
// payment.module.ts
@Module({
  providers: [
    { provide: PAYMENT_GATEWAY, useClass: StripeGateway },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentModule {}
```

```ts
// dùng
@Injectable()
export class OrdersService {
  constructor(
    @Inject(PAYMENT_GATEWAY) private gateway: PaymentGateway,
  ) {}
}
```

Đổi sang cổng thanh toán khác chỉ cần sửa **một dòng** `useClass` — `OrdersService` không phải động vào. Trong test, thay bằng một `FakeGateway` cũng chỉ tốn một dòng.

---

## 5. Global Module — khỏi import lặp lại

Nếu một module (Config, Database, Logger) được dùng khắp nơi:

```ts
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Chỉ cần `imports: [PrismaModule]` **một lần** ở `AppModule`, mọi module khác dùng được ngay.

> Dùng tiết chế — lạm dụng `@Global()` làm mất tính rõ ràng của dependency graph.

---

## 6. Dynamic Module — module nhận cấu hình

Đây là pattern bạn thấy trong `TypeOrmModule.forRoot({...})`, `JwtModule.register({...})`.

```ts
// src/mail/mail.module.ts
import { DynamicModule, Module } from '@nestjs/common';

export interface MailOptions { apiKey: string; from: string }
export const MAIL_OPTIONS = 'MAIL_OPTIONS';

@Module({})
export class MailModule {
  static forRoot(options: MailOptions): DynamicModule {
    return {
      module: MailModule,
      global: true,
      providers: [
        { provide: MAIL_OPTIONS, useValue: options },
        MailService,
      ],
      exports: [MailService],
    };
  }

  // Bản async, đọc từ ConfigService
  static forRootAsync(opts: {
    inject: any[];
    useFactory: (...args: any[]) => Promise<MailOptions> | MailOptions;
  }): DynamicModule {
    return {
      module: MailModule,
      global: true,
      providers: [
        { provide: MAIL_OPTIONS, inject: opts.inject, useFactory: opts.useFactory },
        MailService,
      ],
      exports: [MailService],
    };
  }
}
```

Dùng:

```ts
@Module({
  imports: [
    MailModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        apiKey: c.getOrThrow('MAIL_KEY'),
        from: c.get('MAIL_FROM', 'no-reply@app.com'),
      }),
    }),
  ],
})
export class AppModule {}
```

Quy ước đặt tên:
- `forRoot()` / `forRootAsync()` — cấu hình toàn cục, gọi 1 lần.
- `forFeature()` — đăng ký theo module con (vd: `TypeOrmModule.forFeature([Post])`).
- `register()` / `registerAsync()` — cấu hình cục bộ.

---

## 7. Circular Dependency (phụ thuộc vòng)

`UsersService` cần `PostsService`, `PostsService` lại cần `UsersService` → Nest báo lỗi.

Cách sửa (dùng khi không thể tách được):

```ts
// users.service.ts
@Injectable()
export class UsersService {
  constructor(
    @Inject(forwardRef(() => PostsService))
    private postsService: PostsService,
  ) {}
}
```

```ts
// users.module.ts
@Module({
  imports: [forwardRef(() => PostsModule)],
})
```

Làm ở **cả hai phía**.

> Tốt hơn: tách logic dùng chung ra một service thứ ba. Circular dependency thường là dấu hiệu thiết kế chưa gọn.

---

## 8. Lifecycle hooks

```ts
@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    // chạy khi module khởi tạo xong — vd: kết nối Redis, warm cache
  }
  async onModuleDestroy() {
    // dọn dẹp khi app tắt
  }
}
```

Các hook: `OnModuleInit` → `OnApplicationBootstrap` → (chạy) → `OnModuleDestroy` → `BeforeApplicationShutdown` → `OnApplicationShutdown`.

Muốn hook shutdown chạy khi nhận SIGTERM (quan trọng khi deploy Docker/K8s):

```ts
// main.ts
app.enableShutdownHooks();
```

---

## 9. Bài tập bài 3

1. Tạo `MailModule` có `MailService` với method `send(to, subject, body)` (chỉ `console.log`).
2. Tạo interface `PaymentGateway` + token, 2 implementation `StripeGateway` và `MomoGateway`. Bind bằng `useClass` dựa vào `process.env.PAYMENT_DRIVER`.
3. Biến `MailModule` thành **dynamic module** với `forRoot({ from })`, in ra `from` mỗi lần gửi mail.
4. Trong `UsersService.register()`, gọi `MailService.send()` và `PaymentGateway.charge()`.
5. Thêm `OnModuleInit` vào `MailService`, log `"MailService ready"` khi khởi động.

➡️ Tiếp: [04-database-typeorm.md](./04-database-typeorm.md)
