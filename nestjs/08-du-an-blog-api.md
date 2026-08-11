# Bài 8 — Dự án thực hành: Blog API hoàn chỉnh

Làm xong dự án này, bạn đủ trình nhận việc NestJS. Ước tính 8–12 giờ.

## Đặc tả

**Thực thể:** User, Post, Category, Tag, Comment

**Quan hệ:**
- User `1—n` Post
- User `1—n` Comment
- Category `1—n` Post
- Post `n—n` Tag
- Post `1—n` Comment

**Chức năng:**
- Đăng ký / đăng nhập / refresh / me (JWT)
- CRUD bài viết (chỉ tác giả hoặc admin được sửa/xoá)
- Phân trang, tìm kiếm, lọc theo category/tag/status
- Bình luận bài viết
- Phân quyền: `user` / `editor` / `admin`
- Soft delete, slug tự sinh, đếm lượt xem
- Swagger docs

---

## Giai đoạn 1 — Khởi tạo (30 phút)

```bash
nest new blog-api && cd blog-api

npm i @nestjs/config @nestjs/typeorm typeorm pg \
      @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt \
      class-validator class-transformer @nestjs/mapped-types \
      @nestjs/swagger @nestjs/throttler joi slugify

npm i -D @types/passport-jwt @types/bcrypt @faker-js/faker
```

`docker-compose.yml` + `.env` (xem bài 4).

Tạo khung module:

```bash
nest g module common
nest g resource users     --no-spec
nest g resource posts     --no-spec
nest g resource categories --no-spec
nest g resource tags      --no-spec
nest g resource comments  --no-spec
nest g module auth
nest g controller auth --no-spec
nest g service auth --no-spec
```

---

## Giai đoạn 2 — `main.ts` hoàn chỉnh (20 phút)

```ts
// src/main.ts
import { NestFactory, Reflector } from '@nestjs/core';
import {
  ValidationPipe, ClassSerializerInterceptor,
  UnprocessableEntityException, Logger,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const formatted = errors.reduce((acc, e) => {
          acc[e.property] = Object.values(e.constraints ?? {});
          return acc;
        }, {} as Record<string, string[]>);
        return new UnprocessableEntityException({
          message: 'Dữ liệu không hợp lệ',
          errors: formatted,
        });
      },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle('Blog API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`🚀 http://localhost:${port}/api — docs: /docs`, 'Bootstrap');
}
bootstrap();
```

---

## Giai đoạn 3 — Entity (1 giờ)

```ts
// src/common/entities/base.entity.ts
import {
  PrimaryGeneratedColumn, CreateDateColumn,
  UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
```

```ts
// src/posts/entities/post.entity.ts
import { Entity, Column, ManyToOne, OneToMany, ManyToMany, JoinTable, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { Comment } from '../../comments/entities/comment.entity';

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('posts')
export class Post extends BaseEntity {
  @Column({ length: 255 })
  title: string;

  @Index({ unique: true })
  @Column({ length: 280 })
  slug: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  excerpt?: string;

  @Column({ type: 'enum', enum: PostStatus, default: PostStatus.DRAFT })
  status: PostStatus;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date;

  @ManyToOne(() => User, (u) => u.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'author_id' })
  authorId: number;

  @ManyToOne(() => Category, (c) => c.posts, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category?: Category;

  @Column({ name: 'category_id', nullable: true })
  categoryId?: number;

  @ManyToMany(() => Tag, (t) => t.posts, { cascade: true })
  @JoinTable({
    name: 'post_tags',
    joinColumn: { name: 'post_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags: Tag[];

  @OneToMany(() => Comment, (c) => c.post)
  comments: Comment[];
}
```

Tự viết nốt: `User` (bài 6), `Category` (id, name, slug), `Tag` (id, name, slug), `Comment` (id, content, postId, authorId, parentId nullable cho reply lồng nhau).

---

## Giai đoạn 4 — PostsService đầy đủ (2 giờ)

```ts
// src/posts/posts.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import slugify from 'slugify';
import { Post, PostStatus } from './entities/post.entity';
import { Tag } from '../tags/entities/tag.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FindPostsDto } from './dto/find-posts.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post) private readonly postRepo: Repository<Post>,
    @InjectRepository(Tag) private readonly tagRepo: Repository<Tag>,
  ) {}

  async create(dto: CreatePostDto, author: User) {
    const post = this.postRepo.create({
      ...dto,
      slug: await this.generateUniqueSlug(dto.title),
      authorId: author.id,
      publishedAt: dto.status === PostStatus.PUBLISHED ? new Date() : null,
      tags: dto.tagIds?.length
        ? await this.tagRepo.findBy({ id: In(dto.tagIds) })
        : [],
    });
    return this.postRepo.save(post);
  }

  async findAll(query: FindPostsDto) {
    const { page, limit, search, status, categoryId, tag, order } = query;

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .leftJoinAndSelect('post.category', 'category')
      .leftJoinAndSelect('post.tags', 'tag');

    if (search) {
      qb.andWhere('(post.title ILIKE :s OR post.content ILIKE :s)', {
        s: `%${search}%`,
      });
    }
    if (status) qb.andWhere('post.status = :status', { status });
    if (categoryId) qb.andWhere('post.categoryId = :categoryId', { categoryId });
    if (tag) qb.andWhere('tag.slug = :tag', { tag });

    const [items, total] = await qb
      .orderBy('post.createdAt', order)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const post = await this.postRepo.findOne({
      where: { id },
      relations: { author: true, category: true, tags: true, comments: { author: true } },
    });
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết #${id}`);
    return post;
  }

  async findBySlug(slug: string) {
    const post = await this.postRepo.findOne({
      where: { slug },
      relations: { author: true, category: true, tags: true },
    });
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết "${slug}"`);
    await this.postRepo.increment({ id: post.id }, 'viewCount', 1);
    return post;
  }

  async update(id: number, dto: UpdatePostDto, user: User) {
    const post = await this.findOne(id);
    this.ensureCanModify(post, user);

    if (dto.title && dto.title !== post.title) {
      post.slug = await this.generateUniqueSlug(dto.title, id);
    }
    if (dto.status === PostStatus.PUBLISHED && !post.publishedAt) {
      post.publishedAt = new Date();
    }
    if (dto.tagIds) {
      post.tags = await this.tagRepo.findBy({ id: In(dto.tagIds) });
    }

    const { tagIds, ...rest } = dto;
    Object.assign(post, rest);
    return this.postRepo.save(post);
  }

  async remove(id: number, user: User) {
    const post = await this.findOne(id);
    this.ensureCanModify(post, user);
    await this.postRepo.softRemove(post);
    return { message: 'Đã xoá bài viết' };
  }

  // --- helpers ---

  private ensureCanModify(post: Post, user: User) {
    const isOwner = post.authorId === user.id;
    const isAdmin = user.role === UserRole.ADMIN;
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền thao tác với bài viết này');
    }
  }

  private async generateUniqueSlug(title: string, excludeId?: number) {
    const base = slugify(title, { lower: true, strict: true, locale: 'vi' });
    let slug = base;
    let i = 1;

    while (true) {
      const existing = await this.postRepo.findOne({
        where: { slug },
        withDeleted: true,
      });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${base}-${i++}`;
    }
  }
}
```

---

## Giai đoạn 5 — Controller (1 giờ)

```ts
// src/posts/posts.controller.ts
import {
  Controller, Get, Post as HttpPost, Body, Patch, Param,
  Delete, Query, ParseIntPipe, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { FindPostsDto } from './dto/find-posts.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Danh sách bài viết (phân trang, tìm kiếm, lọc)' })
  findAll(@Query() query: FindPostsDto) {
    return this.postsService.findAll(query);
  }

  @Public()
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @HttpPost()
  @Roles(UserRole.EDITOR, UserRole.ADMIN)
  create(@Body() dto: CreatePostDto, @CurrentUser() user: User) {
    return this.postsService.create(dto, user);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: User,
  ) {
    return this.postsService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.postsService.remove(id, user);
  }
}
```

DTO `FindPostsDto`:

```ts
// src/posts/dto/find-posts.dto.ts
import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PostStatus } from '../entities/post.entity';

export class FindPostsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit = 10;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional() @Type(() => Number) @IsInt()
  categoryId?: number;

  @IsOptional() @IsString()
  tag?: string;

  @IsOptional() @IsIn(['ASC', 'DESC'])
  order: 'ASC' | 'DESC' = 'DESC';
}
```

---

## Giai đoạn 6 — Seed dữ liệu (30 phút)

```ts
// src/seed.ts
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';
import { AppModule } from './app.module';
import { User, UserRole } from './users/entities/user.entity';
import { Post, PostStatus } from './posts/entities/post.entity';
import { Category } from './categories/entities/category.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepo: Repository<User> = app.get(getRepositoryToken(User));
  const postRepo: Repository<Post> = app.get(getRepositoryToken(Post));
  const catRepo: Repository<Category> = app.get(getRepositoryToken(Category));

  const admin = await userRepo.save(
    userRepo.create({
      name: 'Admin',
      email: 'admin@blog.test',
      password: await bcrypt.hash('12345678', 10),
      role: UserRole.ADMIN,
    }),
  );

  const categories = await catRepo.save(
    ['Công nghệ', 'Lập trình', 'Đời sống'].map((name) =>
      catRepo.create({ name, slug: slugify(name, { lower: true, strict: true }) }),
    ),
  );

  for (let i = 0; i < 30; i++) {
    const title = faker.lorem.sentence(6);
    await postRepo.save(
      postRepo.create({
        title,
        slug: slugify(title, { lower: true, strict: true }) + '-' + i,
        content: faker.lorem.paragraphs(5),
        excerpt: faker.lorem.sentence(),
        status: faker.helpers.arrayElement(Object.values(PostStatus)),
        authorId: admin.id,
        categoryId: faker.helpers.arrayElement(categories).id,
        viewCount: faker.number.int({ min: 0, max: 5000 }),
      }),
    );
  }

  console.log('✅ Seed xong: 1 admin, 3 category, 30 bài viết');
  await app.close();
}

seed();
```

```json
// package.json
"scripts": { "seed": "ts-node -r tsconfig-paths/register src/seed.ts" }
```

```bash
npm run seed
```

---

## Giai đoạn 7 — Kiểm thử thủ công

```bash
# Đăng nhập
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@blog.test","password":"12345678"}' | jq -r .data.accessToken)

# Danh sách + phân trang + tìm kiếm
curl "localhost:3000/api/posts?page=1&limit=5&search=lorem&order=ASC" | jq

# Tạo bài
curl -X POST localhost:3000/api/posts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Học NestJS trong 7 ngày","content":"Nội dung bài viết","status":"published"}' | jq

# Xem theo slug (tăng view)
curl localhost:3000/api/posts/slug/hoc-nestjs-trong-7-ngay | jq

# Sửa bài của người khác -> phải 403
# Xoá -> soft delete
```

---

## ✅ Checklist hoàn thành

- [ ] Đăng ký / đăng nhập / refresh / me hoạt động
- [ ] Password không bao giờ lộ trong response
- [ ] CRUD post đầy đủ, slug tự sinh và không trùng
- [ ] Phân trang trả `{ items, meta }`
- [ ] Tìm kiếm theo title/content, lọc theo status/category/tag
- [ ] Chỉ tác giả hoặc admin sửa/xoá được
- [ ] Soft delete hoạt động (bản ghi vẫn còn trong DB)
- [ ] Bình luận có reply lồng nhau
- [ ] Response chuẩn hoá `{ success, data, timestamp }`
- [ ] Lỗi validation trả 422 kèm `errors` theo field
- [ ] Swagger `/docs` đầy đủ, test được với Bearer token
- [ ] Có ít nhất 5 unit test và 3 e2e test
- [ ] Migration chạy được, `synchronize: false`
- [ ] Dockerfile build và chạy được

---

## Mở rộng (nếu còn thời gian)

1. Upload ảnh thumbnail (`FileInterceptor` + lưu S3/local).
2. Full-text search với PostgreSQL `tsvector` hoặc Meilisearch.
3. Cache danh sách bài viết bằng Redis (`@nestjs/cache-manager`).
4. Gửi email khi có bình luận mới (`@nestjs/bullmq` + queue).
5. WebSocket thông báo realtime khi có comment.
6. GitHub Actions: chạy lint + test + build mỗi lần push.

➡️ Tra cứu: [09-cheatsheet.md](./09-cheatsheet.md) · Gỡ lỗi: [10-loi-thuong-gap.md](./10-loi-thuong-gap.md)
