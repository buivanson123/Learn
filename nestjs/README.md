# Học NestJS nhanh nhất (dành cho người đã biết JavaScript)

NestJS là framework Node.js để xây dựng backend có cấu trúc. Nó dùng **TypeScript**, **decorator** và **dependency injection** để ép bạn viết code tách bạch: nhận request một nơi, xử lý logic một nơi, truy cập dữ liệu một nơi.

Bạn đã biết JavaScript — nghĩa là bạn đã có `async/await`, module, closure, array method. Đó là 70% những gì cần thiết. Phần còn lại là **TypeScript vừa đủ** và **cách NestJS tổ chức code**, và đó chính là nội dung tài liệu này.

---

## Lộ trình 7 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-chuan-bi.md](./00-chuan-bi.md) | Cài đặt + TypeScript tối thiểu cần biết | 3h |
| 1 | [01-kien-truc-nestjs.md](./01-kien-truc-nestjs.md) | Module / Controller / Provider. **File nền tảng** | 2h |
| 2 | [02-controller-routing-dto.md](./02-controller-routing-dto.md) | Controller, Routing, DTO, Validation | 4h |
| 3 | [03-provider-va-di.md](./03-provider-va-di.md) | Service, Provider, Dependency Injection | 3h |
| 4 | [04-database-typeorm.md](./04-database-typeorm.md) | TypeORM / Prisma, Migration, Quan hệ | 5h |
| 5 | [05-middleware-guard-interceptor.md](./05-middleware-guard-interceptor.md) | Vòng đời request: Guard, Interceptor, Pipe, Filter | 4h |
| 6 | [06-auth-jwt.md](./06-auth-jwt.md) | Đăng ký / Đăng nhập / JWT / Phân quyền | 4h |
| 7 | [07-config-testing.md](./07-config-testing.md) | Config, Swagger, Testing, Deploy | 3h |
| 7+ | [08-du-an-blog-api.md](./08-du-an-blog-api.md) | **Dự án thực hành: Blog API hoàn chỉnh** | 8h |
| — | [09-cheatsheet.md](./09-cheatsheet.md) | Tra cứu nhanh CLI, decorator, operator | — |
| — | [10-loi-thuong-gap.md](./10-loi-thuong-gap.md) | 20 lỗi kinh điển và cách sửa | — |
| 8 | [11-websocket-co-ban.md](./11-websocket-co-ban.md) | **Realtime: WebSocket & SSE cơ bản** (bài mở rộng) | 4h |
| — | [12-so-do-luong-du-lieu.md](./12-so-do-luong-du-lieu.md) | **Sơ đồ luồng dữ liệu**: 8 khối ghép lại thành một bức tranh, thứ tự chứng minh bằng log thật. Kèm 3 sơ đồ `.mmd` rời ở [so-do/](./so-do/) | 2h |

---

## Tài liệu tra cứu

👉 **[cau-truc-chuan.md](./cau-truc-chuan.md)** — sổ tay quy ước cho dự án lớn: cây thư mục đầy đủ,
bảng tra *"file này để đâu"*, quy ước đặt tên, và cách ép cả team tuân thủ bằng `dependency-cruiser` + `plop`.
Mở ra mỗi khi phân vân đặt file ở đâu.

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 55 câu hỏi kèm đáp án hai tầng, 4 bài tập vẽ sơ đồ, và
checklist tự kiểm tra.

Câu hỏi hay gặp nhất khi phỏng vấn NestJS là **thứ tự chạy của Middleware / Guard / Interceptor / Pipe
/ Filter** — nếu chỉ ôn một thứ thì ôn cái đó ([bài 05](./05-middleware-guard-interceptor.md)).

---

## Sau khi xong phần cơ bản

👉 **[nang-cao/](./nang-cao/README.md)** — bộ 10 bài về **xử lý dữ liệu lớn & chịu tải cao**:
stream triệu bản ghi, cursor pagination, index & N+1, cache nhiều tầng, queue BullMQ,
rate limit & circuit breaker, CQRS/Outbox, WebSocket ở quy mô lớn, microservices, đo lường & benchmark.

Điều kiện: đã làm xong dự án Blog API ở bài 08.

---

## Cách học hiệu quả nhất

1. **Đừng đọc hết rồi mới code.** Đọc 1 file → gõ lại code trong file đó → chạy thử → làm bài tập cuối file.
2. **Gõ tay, không copy-paste.** Decorator (`@Injectable()`, `@Get()`) chỉ ngấm khi tay bạn quen.
3. **Chạy `npm run start:dev` liên tục.** Nó tự reload; mỗi thay đổi thấy kết quả ngay.
4. **Làm dự án ở file 08 song song.** Học tới đâu, áp vào Blog API tới đó.

---

## Ba nguyên tắc cốt lõi của NestJS

Hiểu 3 điều này là hiểu được 80% framework.

### 1. Mọi thứ phải được khai báo tường minh

NestJS **không tự tìm** class của bạn. Viết một Service xong, bạn phải đăng ký nó vào `providers` của Module thì mới dùng được. Không có "magic" tự động.

> 90% lỗi của người mới là *"tôi viết Service rồi mà inject không được"* → vì quên đăng ký trong Module. Nhớ điều này tiết kiệm cho bạn vài ngày.

### 2. Class không tự tạo dependency của nó

Bạn **không bao giờ** viết `new UsersService()`. Bạn khai báo nó trong constructor, NestJS tự đưa vào:

```ts
constructor(private readonly usersService: UsersService) {}
```

Đây là **Dependency Injection** — cơ chế trung tâm của NestJS.

### 3. Mỗi tầng một nhiệm vụ

```
Controller  →  chỉ nhận request và trả response. KHÔNG chứa logic.
Service     →  chứa toàn bộ business logic.
Repository  →  chỉ nói chuyện với database.
```

Controller "béo" là dấu hiệu code sai. Nếu controller của bạn dài quá 5 dòng mỗi method, logic đó thuộc về Service.

---

## Yêu cầu môi trường

- Node.js >= 20 (khuyến nghị LTS)
- npm hoặc pnpm
- Docker (tuỳ chọn, để chạy PostgreSQL nhanh)
- VS Code + extension: ESLint, Prettier

Bắt đầu tại 👉 [00-chuan-bi.md](./00-chuan-bi.md)
