# Bài 4 — Database: TypeORM (và Prisma)

NestJS không ép bạn dùng ORM nào. Hai lựa chọn phổ biến nhất là **TypeORM** (tích hợp sẵn qua `@nestjs/typeorm`) và **Prisma**.

TypeORM đi theo mô hình **Data Mapper**, tách làm hai vai trò:

- **Entity** — một class mô tả bảng. Nó chỉ là dữ liệu, **không có** method query.
- **Repository** — đối tượng lo mọi việc đọc/ghi cho một entity: `find()`, `save()`, `delete()`.

```
Service  →  Repository<Post>  →  SQL  →  Database
              ↑
           Post (entity: chỉ mô tả cấu trúc bảng)
```

Cách tách này khiến Service dễ test (chỉ cần mock repository) và entity không dính logic truy vấn.

> Tài liệu này dùng TypeORM xuyên suốt. Mục 9 giới thiệu Prisma để bạn biết khi nào nên chọn nó.

---

## 1. Cài đặt & kết nối

```bash
npm i @nestjs/typeorm typeorm pg          # PostgreSQL
# hoặc: npm i @nestjs/typeorm typeorm mysql2   # MySQL
npm i @nestjs/config
```

> ⚠️ **Ghi chú phiên bản (cập nhật 19/08/2026).** `typeorm` đã lên **1.x**:
>
> ```bash
> $ npm view typeorm dist-tags
> { latest: '1.1.0', legacy: '0.3.31', beta: '1.0.0-beta.3' }
> ```
>
> Bản `1.0.0` ra ngày 19/05/2026, `1.1.0` ngày 13/07/2026, và nhánh `0.3.x` giờ mang tag `legacy`.
> Chạy `npm i typeorm` hôm nay sẽ ra **1.1.0**, không phải 0.3.
>
> **Tài liệu này vẫn dùng được nguyên vẹn.** Tôi đã kiểm tra toàn bộ 13 API mà bài này dùng
> (`Entity`, `Column`, `PrimaryGeneratedColumn`, `ManyToOne`, `OneToMany`, `DataSource`, `Repository`,
> `QueryRunner`, `EntityManager`, `MigrationInterface`, …) — **tất cả đều còn trong 1.1.0**.
>
> Và `@nestjs/typeorm@11.0.3` khai báo hỗ trợ cả hai:
> ```
> peerDependencies = { typeorm: '^0.3.0 || ^1.0.0-dev', ... }
> ```
>
> Hai điều cần biết:
> - `typeorm@1.x` khai `engines: node ^20.19.0 || ^22.13.0 || >=24.11.0`. Máy đang chạy **Node
>   v20.14.0** thì **không thoả** — npm chỉ cảnh báo chứ không chặn, và thư viện vẫn nạp được, nhưng
>   nên nâng Node lên để tránh lỗi khó đoán.
> - Muốn giữ nguyên bản cũ thì ghim: `npm i typeorm@legacy`.


Chạy DB bằng Docker cho nhanh:

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: blog
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
volumes:
  pgdata:
```

```bash
docker compose up -d
```

`.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=secret
DB_NAME=blog
```

`app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres',
        host: c.get('DB_HOST'),
        port: c.get<number>('DB_PORT'),
        username: c.get('DB_USER'),
        password: c.get('DB_PASS'),
        database: c.get('DB_NAME'),
        autoLoadEntities: true,
        synchronize: c.get('NODE_ENV') !== 'production', // ⚠️ chỉ dev
        logging: c.get('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class AppModule {}
```

> ⚠️ **`synchronize: true` tự sửa schema theo entity.** Tiện khi dev, **cấm tuyệt đối** trên production (có thể mất dữ liệu). Production dùng migration.

---

## 2. Entity — mô tả một bảng

Entity là một class gắn `@Entity()`, mỗi property gắn `@Column()` tương ứng một cột. TypeORM đọc nó để biết cấu trúc bảng — dùng cho cả việc sinh migration lẫn việc ánh xạ kết quả query về object.

```ts
// src/posts/entities/post.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('posts')                       // tên bảng
export class Post {
  @PrimaryGeneratedColumn()            // khoá chính, tự tăng
  id: number;

  @Column({ length: 255 })             // varchar(255)
  title: string;

  @Index({ unique: true })             // tạo index để tìm theo slug nhanh
  @Column({ unique: true })
  slug: string;

  @Column({ type: 'text' })            // text, không giới hạn độ dài
  content: string;

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.DRAFT })
  status: PostStatus;

  @Column({ type: 'int', default: 0 })
  viewCount: number;

  @Column({ nullable: true })          // cho phép NULL — nhớ thêm ? ở tên property
  thumbnail?: string;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, any>;

  @CreateDateColumn()                  // created_at, tự set
  createdAt: Date;

  @UpdateDateColumn()                  // updated_at, tự set
  updatedAt: Date;

  @DeleteDateColumn()                  // bật xoá mềm: xoá chỉ set cột này
  deletedAt?: Date;

  // --- Quan hệ ---
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })   // cột khoá ngoại
  author: User;

  @Column({ name: 'author_id' })       // khai báo thêm để truy cập id trực tiếp
  authorId: number;

  @OneToMany(() => Comment, (c) => c.post)
  comments: Comment[];

  @ManyToMany(() => Tag, (t) => t.posts)
  @JoinTable({ name: 'post_tag' })     // bảng pivot
  tags: Tag[];
}
```

### Quy tắc khai báo quan hệ

| Quan hệ | Decorator | Khoá ngoại nằm ở |
|---|---|---|
| Một bài viết thuộc một tác giả | `@ManyToOne` + `@JoinColumn` | **Bảng này** (`posts.author_id`) |
| Một tác giả có nhiều bài viết | `@OneToMany` | Bảng kia — đây chỉ là chiều ngược |
| Một user có một profile | `@OneToOne` + `@JoinColumn` | Bên nào có `@JoinColumn` |
| Bài viết ↔ nhiều tag | `@ManyToMany` + `@JoinTable` | Bảng trung gian (pivot) |

Ba điều dễ sai:

1. **`@JoinColumn` chỉ đặt ở phía `ManyToOne`** (phía giữ khoá ngoại). `@OneToMany` không bao giờ có nó.
2. **`@JoinTable` chỉ đặt ở MỘT phía** của `@ManyToMany`. Đặt cả hai → TypeORM tạo 2 bảng pivot.
3. **Luôn dùng arrow function** `() => User` chứ không phải `User` — để tránh lỗi khi hai entity import lẫn nhau.

### Kiểm soát dữ liệu vào và ra

- **Vào:** entity không có cơ chế chặn field nào được ghi. Việc đó do **DTO** đảm nhiệm — chỉ field khai báo trong DTO mới đi qua được `ValidationPipe` (`whitelist: true`).
- **Ra:** để ẩn field khỏi JSON trả về, dùng `@Exclude()` hoặc `select: false` (bên dưới).

Ẩn password khỏi response:

```ts
@Column({ select: false })   // không lấy ra trừ khi chỉ định rõ
password: string;
```
hoặc
```ts
import { Exclude } from 'class-transformer';

@Exclude()
@Column()
password: string;
```
(cần bật `app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))`).

---

## 3. Đăng ký entity vào module

```ts
// posts.module.ts
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Post, Tag])],  // <- đăng ký repository
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
```

---

## 4. Repository — đọc/ghi dữ liệu

`@InjectRepository(Post)` đưa vào một `Repository<Post>` — object có sẵn mọi method thao tác với bảng `posts`. Đây là nơi duy nhất trong ứng dụng nói chuyện với database.

```ts
// posts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, In, MoreThan, Between } from 'typeorm';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
  ) {}

  // Lấy tất cả
  findAll() {
    return this.postRepo.find();
  }

  // Lọc + eager load quan hệ + sắp xếp + giới hạn
  findPublished() {
    return this.postRepo.find({
      where: { status: PostStatus.PUBLISHED },
      relations: { author: true, tags: true },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  // Lấy 1 bản ghi, không có thì ném 404
  async findOne(id: number) {
    const post = await this.postRepo.findOne({
      where: { id },
      relations: { author: true, comments: true },
    });
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${id}`);
    return post;
  }

  // Tạo mới
  async create(dto: CreatePostDto, authorId: number) {
    const post = this.postRepo.create({ ...dto, authorId }); // chỉ tạo instance
    return this.postRepo.save(post);                          // mới INSERT
  }

  // Cập nhật
  async update(id: number, dto: UpdatePostDto) {
    const post = await this.findOne(id);
    Object.assign(post, dto);
    return this.postRepo.save(post);
  }

  // Xoá mềm — chỉ set deleted_at, bản ghi vẫn còn trong DB
  async remove(id: number) {
    const post = await this.findOne(id);
    await this.postRepo.softRemove(post);
    return { deleted: true };
  }

  // Xoá hẳn khỏi DB
  async forceRemove(id: number) {
    await this.postRepo.delete(id);
  }

  // Tăng một cột số, không cần load bản ghi lên
  async incrementView(id: number) {
    await this.postRepo.increment({ id }, 'viewCount', 1);
  }
}
```

### Bảng tra method của Repository

| Nhu cầu | Cách viết |
|---|---|
| Lấy tất cả | `repo.find()` |
| Lấy 1 bản ghi theo điều kiện | `repo.findOneBy({ id: 1 })` |
| Lấy 1, không có thì throw | `repo.findOneByOrFail({ id: 1 })` |
| Lấy 1 kèm quan hệ | `repo.findOne({ where: { id }, relations: { author: true } })` |
| Đếm | `repo.count({ where: {...} })` |
| Kiểm tra tồn tại | `repo.exists({ where: {...} })` |
| Lấy kèm tổng số (phân trang) | `repo.findAndCount({...})` |
| Tạo instance (chưa lưu) | `repo.create({...})` |
| Lưu (INSERT hoặc UPDATE) | `repo.save(entity)` |
| Cập nhật thẳng, không load | `repo.update(id, { title: 'x' })` |
| Xoá hẳn | `repo.delete(id)` |
| Xoá mềm | `repo.softDelete(id)` / `repo.softRemove(entity)` |
| Khôi phục bản ghi đã xoá mềm | `repo.restore(id)` |
| Tăng/giảm cột số | `repo.increment({ id }, 'viewCount', 1)` |

### Cú pháp `where`

| Nhu cầu | Cách viết |
|---|---|
| Bằng | `where: { status: 'published' }` |
| Thuộc danh sách | `where: { id: In([1, 2, 3]) }` |
| Tìm gần đúng (phân biệt hoa thường) | `where: { title: Like('%a%') }` |
| Tìm gần đúng (không phân biệt) | `where: { title: ILike('%a%') }` |
| Lớn hơn / nhỏ hơn | `where: { views: MoreThan(10) }` `LessThan(10)` |
| Trong khoảng | `where: { createdAt: Between(from, to) }` |
| Là NULL | `where: { deletedAt: IsNull() }` |
| Khác | `where: { status: Not('draft') }` |
| **Điều kiện OR** | `where: [{ a: 1 }, { b: 2 }]` — mảng nghĩa là OR |
| Lấy cả bản ghi đã xoá mềm | thêm `withDeleted: true` |

Các option còn lại của `find()`: `relations`, `order`, `select`, `skip`, `take`.

> Nhớ import operator từ `typeorm`: `import { In, ILike, MoreThan, Between, IsNull, Not } from 'typeorm'`.

### `create()` + `save()` khác gì `save()` trực tiếp?

```ts
const post = this.postRepo.create({ title: 'abc' });  // CHỈ tạo object trong RAM
await this.postRepo.save(post);                       // đến đây mới chạy INSERT
```

`create()` không đụng tới database — nó chỉ dựng một instance của entity (chạy default value, gắn đúng class để `@Exclude()` hoạt động). Bỏ qua `create()` và `save()` thẳng object thường vẫn chạy, nhưng bạn mất những thứ đó.

---

## 5. Phân trang

```ts
async paginate(query: FindPostsDto) {
  const { page, limit, search } = query;

  const [items, total] = await this.postRepo.findAndCount({
    where: search ? { title: ILike(`%${search}%`) } : {},
    relations: { author: true },
    order: { createdAt: 'DESC' },
    skip: (page - 1) * limit,
    take: limit,
  });

  return {
    data: items,
    meta: {
      total,
      page,
      limit,
      lastPage: Math.ceil(total / limit),
    },
  };
}
```

---

## 6. QueryBuilder — cho query phức tạp

```ts
async search(keyword: string) {
  return this.postRepo
    .createQueryBuilder('post')
    .leftJoinAndSelect('post.author', 'author')
    .leftJoinAndSelect('post.tags', 'tag')
    .where('post.status = :status', { status: 'published' })
    .andWhere('(post.title ILIKE :kw OR post.content ILIKE :kw)', {
      kw: `%${keyword}%`,
    })
    .orderBy('post.createdAt', 'DESC')
    .take(20)
    .getMany();
}

// Aggregate
async statsByAuthor() {
  return this.postRepo
    .createQueryBuilder('post')
    .select('post.authorId', 'authorId')
    .addSelect('COUNT(*)', 'total')
    .groupBy('post.authorId')
    .having('COUNT(*) > :min', { min: 5 })
    .getRawMany();
}
```

> Luôn dùng `:param` binding, **không nối chuỗi** → tránh SQL injection.

---

## 7. Transaction

```ts
import { DataSource } from 'typeorm';

@Injectable()
export class OrdersService {
  constructor(private dataSource: DataSource) {}

  async checkout(dto: CheckoutDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.save(Order, { userId: dto.userId });
      await manager.decrement(Product, { id: dto.productId }, 'stock', dto.qty);
      return order;
      // throw ở bất kỳ đâu -> tự rollback
    });
  }
}
```

Tương đương `DB::transaction(function () { ... })`.

---

## 8. Migration (production dùng cái này, không dùng `synchronize`)

Tạo `src/data-source.ts`:

```ts
import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: +process.env.DB_PORT,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
```

Thêm script vào `package.json`:

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:create": "npm run typeorm -- migration:create",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert"
  }
}
```

| Việc cần làm | Lệnh |
|---|---|
| Tạo migration rỗng để tự viết SQL | `npm run migration:create -- src/migrations/CreatePosts` |
| **Tự sinh migration từ thay đổi entity** | `npm run migration:generate -- src/migrations/AddSlugToPosts` |
| Chạy các migration chưa chạy | `npm run migration:run` |
| Quay lui migration gần nhất | `npm run migration:revert` |

`migration:generate` là lệnh bạn dùng nhiều nhất: nó **so sánh entity trong code với schema thật trong DB**, rồi tự viết luôn cả `up()` và `down()`.

Quy trình chuẩn khi sửa cấu trúc bảng:

```bash
# 1. Sửa entity (thêm cột, đổi kiểu...)
# 2. Sinh migration
npm run migration:generate -- src/migrations/AddViewCountToPosts
# 3. ĐỌC file vừa sinh — kiểm tra SQL có đúng ý không
# 4. Chạy
npm run migration:run
```

> Luôn đọc file migration trước khi chạy. `migration:generate` đôi khi hiểu "đổi tên cột" thành "DROP cột cũ + ADD cột mới", làm mất dữ liệu.

---

## 9. Lựa chọn thay thế: Prisma

Nếu thấy TypeORM rườm rà, Prisma đơn giản và type-safe hơn nhiều.

```bash
npm i @prisma/client && npm i -D prisma
npx prisma init
```

```prisma
// prisma/schema.prisma
model Post {
  id        Int      @id @default(autoincrement())
  title     String
  slug      String   @unique
  content   String
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```bash
npx prisma migrate dev --name init     # sinh + chạy migration
npx prisma studio                      # GUI xem DB, rất tiện
```

```ts
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

```ts
@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.post.findMany({
      where: { published: true },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  create(data: CreatePostDto) {
    return this.prisma.post.create({ data });
  }
}
```

**Chọn cái nào?**
- TypeORM: decorator-based, cùng phong cách với phần còn lại của NestJS, entity và code nằm chung một chỗ.
- Prisma: DX tốt hơn, autocomplete chính xác 100%, migration mượt. Xu hướng hiện nay.

Tài liệu này tiếp tục dùng TypeORM cho nhất quán.

---

## 10. Bài tập bài 4

1. Dựng PostgreSQL bằng Docker, kết nối thành công (log thấy query).
2. Tạo 3 entity: `User` (id, name, email unique, password), `Post` (id, title, slug unique, content, status, authorId, softDelete), `Tag` (id, name).
3. Quan hệ: User `1-n` Post, Post `n-n` Tag.
4. `PostsService`: CRUD đầy đủ + `paginate()` có search theo title + eager load author.
5. Viết `search()` bằng QueryBuilder tìm trong cả title lẫn content.
6. Tạo file seed (`src/seed.ts`) tạo 1 user + 20 post bằng `@faker-js/faker`.
7. Tắt `synchronize`, chạy `migration:generate` và `migration:run`.

➡️ Tiếp: [05-middleware-guard-interceptor.md](./05-middleware-guard-interceptor.md)
