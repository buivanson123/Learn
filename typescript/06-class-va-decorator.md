# Bài 6 — Class và Decorator

Class trong TypeScript vẫn là class JavaScript, thêm vào: modifier truy cập, `abstract`, `implements`, và parameter property. Decorator là phần nền của NestJS, TypeORM, class-validator — bài này giải thích nó thật sự làm gì.

---

## 1. Field và modifier

```ts
class User {
  public id: number;
  private passwordHash: string;
  protected role: string;
  readonly createdAt: Date;

  constructor(id: number, passwordHash: string) {
    this.id = id;
    this.passwordHash = passwordHash;
    this.role = 'user';
    this.createdAt = new Date();
  }
}
```

| Modifier | Ai truy cập được | Có tồn tại lúc runtime? |
|---|---|---|
| `public` (mặc định) | mọi nơi | — |
| `private` | chỉ trong chính class | ❌ chỉ là quy ước lúc biên dịch |
| `protected` | class đó và class con | ❌ |
| `readonly` | đọc mọi nơi, ghi chỉ trong constructor | ❌ |
| `#field` | chỉ trong chính class | ✅ **thật**, JavaScript ép buộc |

Khác biệt giữa `private` và `#`:

```ts
class A {
  private secret = 1;
  #realSecret = 2;
}

const a = new A();
console.log(a.secret);
```
```
error TS2341: Property 'secret' is private and only accessible within class 'A'.
```

Nhưng lúc chạy thì:

```js
const a = new A();
console.log(a.secret);       // 1     ← vẫn đọc được!
console.log(a['secret']);    // 1
console.log(JSON.stringify(a));  // {"secret":1}   ← lộ ra ngoài API luôn
console.log(a.realSecret);   // undefined — # thì thật sự riêng tư
```

Vì thế: `private` để tổ chức code, `#` để **thật sự** giấu. Với entity trả về API, đừng dựa vào `private` để giấu `passwordHash` — dùng `Omit` ở tầng response ([bài 05](./05-utility-va-type-nang-cao.md)).

### `strictPropertyInitialization`

Nằm trong `strict`. Field không optional phải được gán trong constructor:

```ts
class User {
  name: string;
}
```
```
error TS2564: Property 'name' has no initializer and is not definitely assigned in the constructor.
```

Bốn cách sửa, chọn theo ý nghĩa thật:

```ts
class User {
  name: string = '';            // 1. có giá trị mặc định
  email?: string;               // 2. thật sự có thể không có
  id!: number;                  // 3. "tôi cam đoan sẽ có" — dùng khi framework gán hộ
  constructor(public role: string) {}   // 4. gán qua constructor
}
```

Cách 3 (`!`) là chỗ TypeScript ngừng bảo vệ bạn. Nó chính đáng với entity của ORM (TypeORM tự gán khi load từ DB), nhưng nếu bạn tự `new User()` rồi quên gán thì `id` là `undefined` mà kiểu vẫn nói `number`.

---

## 2. Parameter property — cú pháp NestJS dùng ở mọi nơi

```ts
class UsersService {
  constructor(
    private readonly repo: UserRepository,
    private readonly mailer: MailService,
  ) {}

  async find(id: number) {
    return this.repo.findOne(id);     // dùng được ngay, không phải gán tay
  }
}
```

Viết `private` (hoặc `public`/`protected`/`readonly`) trước tham số constructor là TypeScript tự sinh field + gán. Xem code sinh ra:

```bash
$ npx tsc src/svc.ts --outDir /tmp/o --target ESNext && cat /tmp/o/svc.js
```
```js
class UsersService {
    repo;
    mailer;
    constructor(repo, mailer) {
        this.repo = repo;
        this.mailer = mailer;
    }
    async find(id) { return this.repo.findOne(id); }
}
```

Bỏ chữ `private` đi là hết field:

```ts
class UsersService {
  constructor(repo: UserRepository) {}
  find(id: number) { return this.repo.findOne(id); }
}
```
```
error TS2339: Property 'repo' does not exist on type 'UsersService'.
```

Đây là lỗi phổ biến nhất của người mới viết NestJS. Nhớ: **không có modifier thì chỉ là tham số bình thường**.

---

## 3. `implements` — ép class tuân theo một hình dạng

```ts
interface Storage {
  save(key: string, value: string): Promise<void>;
  load(key: string): Promise<string | null>;
}

class RedisStorage implements Storage {
  async save(key: string, value: string) { /* ... */ }
  async load(key: string) { return null; }
}
```

Thiếu method:

```ts
class BrokenStorage implements Storage {
  async save(key: string, value: string) {}
}
```
```
error TS2420: Class 'BrokenStorage' incorrectly implements interface 'Storage'.
  Property 'load' is missing in type 'BrokenStorage' but required in type 'Storage'.
```

⚠️ Điểm hay bị hiểu nhầm: **`implements` không thêm kiểu vào class**. Nó chỉ kiểm tra. Tham số vẫn phải tự ghi kiểu:

```ts
class RedisStorage implements Storage {
  async save(key, value) { }
}
```
```
error TS7006: Parameter 'key' implicitly has an 'any' type.
error TS7006: Parameter 'value' implicitly has an 'any' type.
```

Và vì TypeScript dùng structural typing, class **không cần** `implements` vẫn dùng được ở chỗ đòi `Storage`:

```ts
class MemoryStorage {
  async save(k: string, v: string) {}
  async load(k: string) { return null; }
}

function use(s: Storage) {}
use(new MemoryStorage());     // ✅ hợp lệ, dù không có `implements`
```

`implements` chỉ để **báo lỗi sớm tại class** thay vì báo muộn ở chỗ dùng. Vẫn nên viết.

---

## 4. `abstract`

```ts
abstract class BaseRepository<T extends { id: number }> {
  protected abstract tableName: string;
  abstract findById(id: number): Promise<T | null>;

  // method có sẵn, class con dùng luôn
  async findByIdOrFail(id: number): Promise<T> {
    const found = await this.findById(id);
    if (found === null) throw new Error(`Không tìm thấy ${this.tableName}#${id}`);
    return found;
  }
}

class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';
  async findById(id: number) { return null; }
}
```

Không cài đặt đủ:

```ts
class BadRepo extends BaseRepository<User> {
  protected tableName = 'bad';
}
```
```
error TS2515: Non-abstract class 'BadRepo' does not implement inherited abstract member findById from class 'BaseRepository<User>'.
```

`new` thẳng abstract class:

```ts
const r = new BaseRepository();
```
```
error TS2511: Cannot create an instance of an abstract class.
```

### `override` và `noImplicitOverride`

Bật `noImplicitOverride` trong `tsconfig.json`, ghi đè method phải khai báo rõ:

```ts
class UserRepository extends BaseRepository<User> {
  async findByIdOrFail(id: number): Promise<User> { /* ... */ }
}
```
```
error TS4114: This member must have an 'override' modifier because it overrides a member in the base class 'BaseRepository<User>'.
```

Giá trị thật của cờ này: nếu ai đó **đổi tên** method ở class cha, chỗ ghi đè ở class con trở thành method thừa, và TypeScript báo:

```
error TS4113: This member cannot have an 'override' modifier because it is not declared in the base class 'BaseRepository<User>'.
```

Không có cờ này, class con lặng lẽ thành method mồ côi không ai gọi.

---

## 5. Decorator — nó thật sự làm gì

Decorator là **một hàm chạy lúc class được định nghĩa**, nhận vào thứ được trang trí và có thể sửa/ghi metadata.

Bật trong `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Ví dụ tự viết — đo thời gian chạy method

```ts
function LogTime(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    const result = await original.apply(this, args);
    console.log(`${key} mất ${Date.now() - start}ms`);
    return result;
  };

  return descriptor;
}

class ReportService {
  @LogTime
  async generate(month: string) {
    await new Promise(r => setTimeout(r, 120));
    return `báo cáo ${month}`;
  }
}

await new ReportService().generate('2026-08');
```
```
generate mất 121ms
```

Không có gì huyền bí: decorator chỉ là hàm bọc lại method. Mọi thứ NestJS làm đều dựa trên cơ chế này.

### Decorator factory — khi cần tham số

```ts
function Retry(times: number) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let lastErr: unknown;
      for (let i = 0; i < times; i++) {
        try { return await original.apply(this, args); }
        catch (e) { lastErr = e; console.log(`Lần ${i + 1} thất bại, thử lại...`); }
      }
      throw lastErr;
    };
  };
}

class Api {
  @Retry(3)
  async fetchData() { throw new Error('mạng lỗi'); }
}
```
```
Lần 1 thất bại, thử lại...
Lần 2 thất bại, thử lại...
Lần 3 thất bại, thử lại...
Error: mạng lỗi
```

Đây chính là hình dạng của `@Get('/users')`, `@Column({ nullable: true })`, `@IsEmail()`: gọi hàm ngoài trả về decorator thật.

### `emitDecoratorMetadata` — mảnh ghép cuối của DI

Đây là chỗ nhiều người dùng NestJS cả năm mà không biết đang xảy ra chuyện gì.

```ts
@Injectable()
class UsersService {
  constructor(private repo: UserRepository) {}
}
```

Kiểu `UserRepository` bị xoá khi biên dịch — vậy lúc chạy NestJS làm sao biết phải inject cái gì? Câu trả lời: `emitDecoratorMetadata` **ghi kiểu đó ra JavaScript**.

Không bật cờ, JS sinh ra:

```js
let UsersService = class UsersService {
    constructor(repo) { this.repo = repo; }
};
UsersService = __decorate([ Injectable() ], UsersService);
```

Bật cờ:

```js
UsersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [UserRepository])   // ← kiểu được ghi ra đây
], UsersService);
```

`design:paramtypes` là mảng các class thật. NestJS đọc nó qua `reflect-metadata`, tra IoC container, rồi truyền vào.

Hệ quả thực tế: **decorator phải có mặt thì metadata mới được ghi**. Class không có `@Injectable()` (hoặc bất kỳ decorator nào) sẽ không có `design:paramtypes`, và NestJS chết lúc khởi động:

```
Nest can't resolve dependencies of the UsersService (?).
Please make sure that the argument UserRepository at index [0] is available in the AppModule context.
```

Và một hệ quả nữa: **inject theo interface là không thể**. Interface biến mất hoàn toàn, không có class nào để ghi vào metadata:

```ts
constructor(private storage: Storage) {}    // Storage là interface
```
```
Nest can't resolve dependencies of the FileService (?).
```

Cách xử lý: dùng token.

```ts
export const STORAGE = Symbol('STORAGE');

@Injectable()
class FileService {
  constructor(@Inject(STORAGE) private storage: Storage) {}
}

// trong module
providers: [{ provide: STORAGE, useClass: RedisStorage }]
```

### Decorator chuẩn ES vs decorator cũ

TypeScript 5 hỗ trợ decorator chuẩn ECMAScript với chữ ký khác hẳn:

```ts
// Chuẩn ES (KHÔNG cần experimentalDecorators)
function logged<T, A extends any[], R>(
  target: (this: T, ...args: A) => R,
  context: ClassMethodDecoratorContext,
) {
  return function (this: T, ...args: A): R {
    console.log(`gọi ${String(context.name)}`);
    return target.call(this, ...args);
  };
}
```

Nhưng chuẩn ES **không có parameter decorator**, mà NestJS thì dùng `@Body()`, `@Param()`, `@Inject()` ở khắp nơi. Thiếu `experimentalDecorators`:

```
error TS1239: Unable to resolve signature of parameter decorator when called as an expression.
```

Kết luận thực dụng: **project NestJS/TypeORM giữ nguyên `experimentalDecorators: true`**. Chỉ dùng decorator chuẩn ES cho code mới không dính hai thư viện đó.

---

## 6. Getter, setter, static, index signature trong class

```ts
class Money {
  static readonly CURRENCY = 'VND';
  static fromCents(cents: number) { return new Money(cents / 100); }

  #amount: number;

  constructor(amount: number) { this.#amount = amount; }

  get amount(): number { return this.#amount; }

  set amount(v: number) {
    if (v < 0) throw new Error('Số tiền không được âm');
    this.#amount = v;
  }

  toString() { return `${this.#amount.toLocaleString('vi-VN')} ${Money.CURRENCY}`; }
}

const m = Money.fromCents(150_000);
m.amount = -1;
```
```
Error: Số tiền không được âm
```

Getter chỉ có mà không có setter thì gán là lỗi biên dịch:

```ts
class ReadOnlyBox {
  #v = 1;
  get value() { return this.#v; }
}
new ReadOnlyBox().value = 2;
```
```
error TS2540: Cannot assign to 'value' because it is a read-only property.
```

---

## 7. `this` trong class — bẫy quen thuộc

```ts
class Counter {
  count = 0;
  inc() { this.count++; }
  incArrow = () => { this.count++; };
}

const c = new Counter();
const f = c.inc;
f();
```
```
TypeError: Cannot read properties of undefined (reading 'count')
```

TypeScript **không bắt được** lỗi này mặc định. Muốn nó bắt, khai `this` tường minh:

```ts
class Counter {
  count = 0;
  inc(this: Counter) { this.count++; }
}

const f = c.inc;
f();
```
```
error TS2684: The 'this' context of type 'void' is not assignable to method's 'this' of type 'Counter'.
```

Trong thực tế, cách gọn hơn là dùng arrow property (`incArrow`) khi method sẽ được truyền đi làm callback. Đánh đổi: arrow property nằm trên từng instance chứ không trên prototype, tốn bộ nhớ hơn một chút và không override được bằng `super`.

---

## Bài tập

1. Viết `abstract class Notifier` có `abstract send(to: string, msg: string): Promise<void>` và method sẵn `sendMany(tos: string[], msg: string)`. Cài đặt `EmailNotifier` và `SmsNotifier`.
2. Sửa class sau cho hết TS2564 bằng **ba cách khác nhau**, giải thích khi nào dùng cách nào:
   ```ts
   class Product { name: string; price: number; sku: string; }
   ```
3. Viết decorator `@Memoize` cache kết quả method theo đối số (dùng `JSON.stringify(args)` làm key). Chứng minh nó hoạt động bằng cách log số lần hàm gốc thực sự chạy.
4. Cho class sau, biên dịch với `--target ESNext` rồi đọc file `.js` sinh ra và trả lời: `repo` và `logger` khác nhau ở điểm nào?
   ```ts
   class Svc {
     constructor(private repo: Repo, logger: Logger) {}
   }
   ```
5. Vì sao đoạn NestJS sau chết lúc khởi động, và sửa thế nào?
   ```ts
   interface Cache { get(k: string): string | null }

   @Injectable()
   export class TokenService {
     constructor(private cache: Cache) {}
   }
   ```
6. Class `Account` có `#balance`. Viết getter `balance`, method `deposit(n)`, `withdraw(n)` (ném lỗi nếu không đủ tiền). Chứng minh `#balance` thật sự không đọc được từ ngoài, còn `private balance` thì đọc được (chạy thử bằng `tsx`).

<details>
<summary>Gợi ý đáp án</summary>

```ts
// 1
abstract class Notifier {
  abstract send(to: string, msg: string): Promise<void>;

  async sendMany(tos: string[], msg: string): Promise<void> {
    await Promise.all(tos.map(to => this.send(to, msg)));
  }
}

class EmailNotifier extends Notifier {
  async send(to: string, msg: string) { console.log(`mail → ${to}: ${msg}`); }
}
class SmsNotifier extends Notifier {
  async send(to: string, msg: string) { console.log(`sms → ${to}: ${msg}`); }
}
```

```ts
// 2
class P1 { name = ''; price = 0; sku = ''; }              // có mặc định hợp lý
class P2 { constructor(public name: string, public price: number, public sku: string) {} }  // bắt buộc truyền vào
class P3 { name!: string; price!: number; sku!: string; } // framework (ORM) gán hộ — chỉ dùng khi đúng vậy
```

```ts
// 3
function Memoize(target: any, key: string, descriptor: PropertyDescriptor) {
  const original = descriptor.value;
  const cache = new Map<string, unknown>();
  descriptor.value = function (...args: any[]) {
    const k = JSON.stringify(args);
    if (cache.has(k)) return cache.get(k);
    const result = original.apply(this, args);
    cache.set(k, result);
    return result;
  };
}

class Calc {
  runs = 0;
  @Memoize
  fib(n: number): number { this.runs++; return n < 2 ? n : this.fib(n - 1) + this.fib(n - 2); }
}

const c = new Calc();
c.fib(20); c.fib(20);
console.log(c.runs);   // chạy lần 2 không tăng thêm
```

```
// 4
`repo` có modifier `private` → TypeScript sinh field và dòng `this.repo = repo;`.
`logger` không có modifier → chỉ là tham số bình thường, biến mất sau khi constructor chạy xong.
Truy cập `this.logger` sẽ lỗi: error TS2339: Property 'logger' does not exist on type 'Svc'.
```

```ts
// 5
// `Cache` là interface → bị xoá lúc biên dịch → emitDecoratorMetadata không ghi được class nào
// vào design:paramtypes → NestJS không biết inject gì.
// Sửa bằng token:
export const CACHE = Symbol('CACHE');

@Injectable()
export class TokenService {
  constructor(@Inject(CACHE) private cache: Cache) {}
}
// module: providers: [{ provide: CACHE, useClass: RedisCache }]
```

```ts
// 6
class Account {
  #balance = 0;
  private legacyBalance = 0;

  get balance() { return this.#balance; }
  deposit(n: number) { this.#balance += n; this.legacyBalance += n; }
  withdraw(n: number) {
    if (n > this.#balance) throw new Error('Không đủ số dư');
    this.#balance -= n;
  }
}

const a = new Account();
a.deposit(100);
console.log((a as any).legacyBalance);   // 100  ← private đọc được
console.log((a as any).balance);         // 100  ← qua getter
console.log(JSON.stringify(a));          // {"legacyBalance":100} ← #balance không lộ
```

</details>

---

Tiếp theo 👉 [07-thuc-chien-api-va-module.md](./07-thuc-chien-api-va-module.md)
