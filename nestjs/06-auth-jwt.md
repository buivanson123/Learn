# Bài 6 — Authentication & Authorization với JWT

NestJS không có sẵn hệ thống đăng nhập — bạn tự lắp. Nghe có vẻ nhiều việc nhưng chỉ khoảng 6 file, và đổi lại bạn kiểm soát được toàn bộ luồng.

## 1. Cài đặt

```bash
npm i @nestjs/jwt @nestjs/passport passport passport-jwt passport-local bcrypt
npm i -D @types/passport-jwt @types/passport-local @types/bcrypt
```

`.env`:

```env
JWT_SECRET=doi-thanh-chuoi-ngau-nhien-that-dai
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=mot-chuoi-khac-cung-rat-dai
JWT_REFRESH_EXPIRES_IN=7d
```

---

## 2. Entity User

```ts
// src/users/entities/user.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  USER = 'user',
  EDITOR = 'editor',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Exclude()                     // không lộ ra JSON
  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Exclude()
  @Column({ type: 'text', nullable: true })
  hashedRefreshToken?: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Post, (p) => p.author)
  posts: Post[];
}
```

---

## 3. UsersService — thao tác user

```ts
// src/users/users.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  async create(dto: { name: string; email: string; password: string }) {
    const exists = await this.repo.findOneBy({ email: dto.email });
    if (exists) throw new ConflictException('Email đã được sử dụng');

    const user = this.repo.create({
      ...dto,
      password: await bcrypt.hash(dto.password, 10),   // KHÔNG BAO GIỜ lưu plaintext
    });
    return this.repo.save(user);
  }

  // Cần lấy cả password để so sánh -> addSelect
  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: number) {
    const user = await this.repo.findOneBy({ id });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async setRefreshToken(userId: number, token: string | null) {
    await this.repo.update(userId, {
      hashedRefreshToken: token ? await bcrypt.hash(token, 10) : null,
    });
  }
}
```

> Nếu entity có `@Column({ select: false }) password`, mọi query mặc định sẽ bỏ password — an toàn hơn. Khi cần thì `addSelect` như trên.

---

## 4. DTO

```ts
// src/auth/dto/register.dto.ts
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(50)
  name: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString() @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  password: string;
}
```

```ts
// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

---

## 5. AuthService

```ts
// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: number;       // 'sub' là chuẩn JWT cho user id
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    // Thông báo chung chung để không lộ email nào tồn tại
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.issueTokens(user);
  }

  async refresh(userId: number, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user.hashedRefreshToken) throw new UnauthorizedException();

    const valid = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!valid) throw new UnauthorizedException('Refresh token không hợp lệ');

    return this.issueTokens(user);
  }

  async logout(userId: number) {
    await this.usersService.setRefreshToken(userId, null);
    return { message: 'Đã đăng xuất' };
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    await this.usersService.setRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }
}
```

---

## 6. JWT Strategy (Passport)

```ts
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Giá trị return ở đây sẽ được gán vào request.user
  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

```ts
// src/auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Cho phép bỏ qua auth nếu route được đánh dấu @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

```ts
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

> Đây là cách an toàn nhất: bật `JwtAuthGuard` **toàn cục** để mặc định mọi route đều phải đăng nhập, rồi đánh dấu `@Public()` cho vài route mở (login, register, xem bài viết). Nếu làm ngược lại — mặc định mở, gắn guard từng route — chỉ cần quên một chỗ là lộ dữ liệu.

---

## 7. AuthModule

```ts
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,                                   // để dùng UsersService (nhớ exports bên đó!)
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: c.get('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

Bật guard toàn cục:

```ts
// src/app.module.ts
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [/* ... */ AuthModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },   // chạy sau JwtAuthGuard
  ],
})
export class AppModule {}
```

---

## 8. AuthController

```ts
// src/auth/auth.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)          // login trả 200, không phải 201
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { userId: number; refreshToken: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser('id') userId: number) {
    return this.authService.logout(userId);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }
}
```

---

## 9. Phân quyền theo chủ sở hữu

`RolesGuard` chỉ trả lời được câu "user này có role gì". Nó **không** trả lời được "bài viết này có phải của user này không" — vì lúc guard chạy, dữ liệu chưa được load lên.

Vì vậy loại kiểm tra này đặt trong Service, ngay sau khi lấy được bản ghi:

```ts
async update(id: number, dto: UpdatePostDto, currentUser: User) {
  const post = await this.findOne(id);

  const isOwner = post.authorId === currentUser.id;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  if (!isOwner && !isAdmin) {
    throw new ForbiddenException('Bạn không có quyền sửa bài viết này');
  }

  Object.assign(post, dto);
  return this.postRepo.save(post);
}
```

Nếu logic này lặp lại ở nhiều entity, tách ra một hàm dùng chung hoặc một `PolicyGuard` riêng. Với dự án vừa và nhỏ, kiểm tra thẳng trong Service là đủ và dễ test nhất.

---

## 10. Test luồng auth

```bash
# 1. Đăng ký
curl -X POST localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Son","email":"son@test.com","password":"12345678"}'

# 2. Đăng nhập -> lấy accessToken
TOKEN=$(curl -s -X POST localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"son@test.com","password":"12345678"}' | jq -r .accessToken)

# 3. Gọi route bảo vệ
curl localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"

# 4. Không token -> phải trả 401
curl -i localhost:3000/api/auth/me
```

---

## 11. Ghi chú bảo mật

- `JWT_SECRET` phải đủ dài và ngẫu nhiên (`openssl rand -base64 48`), **không commit vào git**.
- Access token nên ngắn hạn (15m), refresh token dài hạn (7d) và **lưu dạng hash** trong DB để thu hồi được.
- Với web app, cân nhắc để refresh token trong **httpOnly cookie** thay vì localStorage (chống XSS).
- Bcrypt salt rounds 10–12 là hợp lý.
- Thêm rate limit cho `/auth/login`:

```bash
npm i @nestjs/throttler
```

```ts
// app.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])],
providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
```

```ts
@Throttle({ default: { limit: 5, ttl: 60000 } })   // 5 lần / phút
@Post('login')
```

---

## 12. Bài tập bài 6

1. Làm đủ `register` / `login` / `me` / `logout`.
2. Bật `JwtAuthGuard` toàn cục + `@Public()` cho register/login.
3. Password **không được** xuất hiện trong bất kỳ response nào (kiểm tra kỹ).
4. Thêm `RolesGuard`, tạo route `DELETE /users/:id` chỉ `admin` gọi được.
5. Thêm refresh token flow hoàn chỉnh.
6. Thêm `@nestjs/throttler`: `/auth/login` tối đa 5 lần/phút.
7. Áp dụng kiểm tra ownership cho `PATCH /posts/:id`.

➡️ Tiếp: [07-config-testing.md](./07-config-testing.md)
