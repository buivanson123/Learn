# Bài A8 — Decorator chuẩn (Stage 3) và metadata

Bài 06 dạy decorator ở dạng **legacy** (`experimentalDecorators`) vì đó là thứ NestJS dùng. Bài này dạy dạng **chuẩn** — thứ đã vào ECMAScript và là mặc định của TypeScript từ bản 5.0 — rồi so sánh hai bên để bạn biết đang ở chế độ nào.

Hai chế độ **không** trộn lẫn được. Đọc xong bài này bạn sẽ nhận ra ngay mình đang ở chế độ nào chỉ bằng cách nhìn chữ ký hàm decorator.

---

## 1. Hình dạng của decorator chuẩn

Mọi decorator chuẩn đều nhận đúng **hai tham số**:

```ts
function tênDecorator(value, context) { ... }
```

- `value` — thứ đang bị trang trí (hàm, `undefined` với field, object get/set với accessor).
- `context` — object mô tả, luôn có `kind`, `name`, `static`, `private`, `addInitializer`, `metadata`.

Nhìn vào đây là phân biệt được ngay: **legacy có 3 tham số** (`target, propertyKey, descriptor`), **chuẩn có 2**.

---

## 2. Method decorator — ví dụ chạy được

```ts
function logged<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => R,
  ctx: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => R>
) {
  const name = String(ctx.name);
  return function (this: This, ...args: Args): R {
    console.log(`→ ${name}(${args.join(', ')})`);
    const out = target.call(this, ...args);
    console.log(`← ${name} = ${out}`);
    return out;
  };
}

class Calc {
  @logged
  add(a: number, b: number) { return a + b; }
}

new Calc().add(2, 3);
```
```bash
$ npx tsc --rootDir src --outDir out && node out/e1-decorator.js
```
```
→ add(2, 3)
← add = 5
```

Ba tham số kiểu `This, Args, R` không phải trang trí cho đẹp — chúng giữ nguyên kiểu của method sau khi bọc. Nếu viết `target: Function` thì `Calc.add` sẽ mất kiểu và `new Calc().add('a')` không bị bắt.

---

## 3. Field decorator và `addInitializer`

Field decorator nhận `undefined` làm `value` (lúc trang trí, field chưa có giá trị). Muốn chạy code lúc khởi tạo instance thì dùng `ctx.addInitializer`:

```ts
function track<T, V>(_t: undefined, ctx: ClassFieldDecoratorContext<T, V>) {
  ctx.addInitializer(function () { console.log('init', String(ctx.name)); });
}

class Box { @track value = 1; }
new Box();
```
```
init value
```

`addInitializer` chạy **mỗi lần `new`**, với `this` là instance. Đây là chỗ đăng ký event listener, bind method, hoặc ghi vào registry.

Field decorator cũng có thể trả về hàm để **biến đổi giá trị khởi tạo**:
```ts
function double(_t: undefined, _ctx: ClassFieldDecoratorContext) {
  return (initial: number) => initial * 2;
}
class N { @double x = 5; }   // x = 10
```

---

## 4. `accessor` — từ khoá mới đi cùng decorator

TypeScript 4.9 thêm từ khoá `accessor`. Nó biến một field thành cặp getter/setter với backing field private tự động — và cho phép decorator can thiệp vào cả hai chiều.

```ts
function logged<T, V>(
  target: ClassAccessorDecoratorTarget<T, V>,
  ctx: ClassAccessorDecoratorContext<T, V>
): ClassAccessorDecoratorResult<T, V> {
  return {
    get() { return target.get.call(this); },
    set(v: V) {
      console.log(`set ${String(ctx.name)} =`, v);
      target.set.call(this, v);
    },
  };
}

class B { @logged accessor count = 0; }

const b = new B();
b.count = 5;
console.log(b.count);
```
```
set count = 5
5
```

Dùng khi bạn cần theo dõi việc **ghi** vào thuộc tính: reactive state, dirty tracking, validation lúc gán. Không có `accessor`, decorator trên field thường không chặn được phép gán.

---

## 5. Metadata — thay cho `reflect-metadata`

Từ TS 5.2, `context.metadata` là một object dùng chung cho mọi decorator trên cùng một class, và nó được gắn vào class qua `Symbol.metadata`.

```ts
(Symbol as any).metadata ??= Symbol('Symbol.metadata');   // ← polyfill, xem bên dưới

function entity(name: string) {
  return function <T extends new (...a: any[]) => any>(target: T, ctx: ClassDecoratorContext<T>) {
    ctx.metadata!.table = name;
    return target;
  };
}

function column(t: 'text' | 'int') {
  return function (_v: undefined, ctx: ClassFieldDecoratorContext) {
    (ctx.metadata!.columns ??= {} as any)[String(ctx.name)] = t;
  };
}

@entity('users')
class User {
  @column('int') id = 1;
  @column('text') name = 'a';
}

console.log(JSON.stringify((User as any)[Symbol.metadata]));
```
```
{"columns":{"id":"int","name":"text"},"table":"users"}
```

Đây chính là cách một ORM hay một framework DI thu thập thông tin — không cần thư viện `reflect-metadata` nữa.

Ba điều bắt buộc phải làm:

**a) Polyfill `Symbol.metadata`.** Nó là đề xuất Stage 3, chưa có trong Node 22:
```ts
(Symbol as any).metadata ??= Symbol('Symbol.metadata');
```

**b) `lib` phải là `esnext`.** Không có thì:
```
src/d3.ts(10,34): error TS2550: Property 'metadata' does not exist on type 'SymbolConstructor'. Do you need to change your target library? Try changing the 'lib' compiler option to 'esnext' or later.
```

**c) `ctx.metadata` có kiểu là optional.** Không dùng `!` hoặc kiểm tra thì:
```
src/d3.ts(4,5): error TS18048: 'ctx.metadata' is possibly 'undefined'.
```

---

## 6. Thứ tự chạy — quan trọng hơn bạn tưởng

```ts
function log(label: string) {
  console.log('eval', label);
  return function (_v: any, ctx: any) { console.log('apply', label, ctx.kind); };
}

@(log('class') as any)
class C {
  @log('field') f = 1;
  @log('method') m() {}
}
new C();
```
```
eval class
eval field
eval method
apply method method
apply field field
apply class class
```

Hai pha rõ rệt:
1. **Đánh giá biểu thức decorator** — từ trên xuống, theo thứ tự viết trong file.
2. **Áp dụng decorator** — từ trong ra ngoài: thành viên trước, class sau.

Hệ quả thực dụng ở mục 5: khi `@entity` (class decorator) chạy, các `@column` (field decorator) **đã** ghi xong vào `ctx.metadata`. Nếu bạn cần class decorator đọc dữ liệu do field decorator ghi, thứ tự này đảm bảo điều đó — nhưng chiều ngược lại thì không.

---

## 7. Cái decorator chuẩn KHÔNG làm được: parameter decorator

```ts
function Inject(t: any, ctx: any) {}
class A { constructor(@Inject private x: string) {} }
```
```
src/d1.ts(3,23): error TS1206: Decorators are not valid here.
```

Đề xuất ECMAScript **không có** parameter decorator. Đây là khác biệt lớn nhất so với legacy, và là lý do NestJS vẫn phải chạy chế độ legacy — toàn bộ mô hình DI của nó dựa trên `@Inject()` ở tham số constructor.

---

## 8. Legacy: `emitDecoratorMetadata` sinh ra gì

Bài 06 nói `emitDecoratorMetadata` sinh `design:paramtypes`. Xem tận mắt:

```ts
function Injectable(): ClassDecorator { return () => {}; }
class Repo {}

@Injectable()
export class Service { constructor(private repo: Repo) {} }
```
```bash
$ npx tsc --experimentalDecorators --emitDecoratorMetadata --rootDir src --outDir dist
$ cat dist/legacy.js
```
```js
var __decorate = ... ;
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
function Injectable() { return () => { }; }
class Repo {
}
let Service = class Service {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
};
Service = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [Repo])      // ← đây
], Service);
export { Service };
```

Dòng `__metadata("design:paramtypes", [Repo])` là **cách duy nhất** kiểu `Repo` sống sót sau khi biên dịch. Không có nó, `Service` chỉ biết constructor nhận một tham số, không biết tham số đó là gì — và DI container không thể tự tạo `Repo` để truyền vào.

Chú ý điều kiện: `__metadata` chỉ hoạt động khi có `Reflect.metadata`, tức là phải `import 'reflect-metadata'` một lần ở entry point. Thiếu dòng đó là nguyên nhân của lỗi NestJS kinh điển:
```
Nest can't resolve dependencies of the Service (?).
```

---

## 9. Decorator không chạy được bằng `node file.ts`

Cả hai chế độ đều sinh code, nên Node strip-only từ chối:

```bash
$ node src/d3.ts
```
```
@entity('users')
^

SyntaxError: Invalid or unexpected token
```

Phải build trước:
```bash
$ npx tsc --lib esnext --rootDir src --outDir dist && node dist/d3.js
{"columns":{"id":"int","name":"text"},"table":"users"}
```

Đây là hệ quả trực tiếp của bài A5 mục 1. Nếu dự án bạn dùng decorator, đừng bật `erasableSyntaxOnly`.

---

## 10. Bảng so sánh

| | Legacy (`experimentalDecorators`) | Chuẩn (mặc định từ TS 5.0) |
|---|---|---|
| Tham số | 3 (`target, key, descriptor`) | 2 (`value, context`) |
| Parameter decorator | ✅ có | ❌ TS1206 |
| Metadata | `reflect-metadata` + `emitDecoratorMetadata` | `context.metadata` + `Symbol.metadata` |
| `accessor` | ❌ | ✅ |
| `addInitializer` | ❌ | ✅ |
| Chuẩn hoá | không, TS riêng | Stage 3 ECMAScript |
| Ai dùng | NestJS, TypeORM, Angular | code mới, thư viện mới |

**Cách nhận biết dự án đang ở chế độ nào:** mở `tsconfig.json` tìm `experimentalDecorators`. Có và bằng `true` → legacy. Không có → chuẩn.

**Đừng cố chuyển NestJS sang decorator chuẩn.** Chừng nào ECMAScript chưa có parameter decorator, hệ sinh thái DI vẫn ở lại legacy.

---

## Bài tập

1. Viết `@memo` (method decorator chuẩn) cache kết quả theo tham số đầu tiên. Chạy method 3 lần với cùng tham số và in ra số lần thân hàm thật sự chạy.

2. Viết `@bound` dùng `addInitializer` để bind method vào instance. Chứng minh nó hoạt động bằng cách truyền method làm callback (`setTimeout(obj.m, 0)`).

3. Viết `@validate(fn)` cho `accessor`, ném lỗi khi gán giá trị không hợp lệ. Thử gán giá trị đúng và sai.

4. Xây một ORM tí hon: `@table('users')` + `@column('int')` ghi vào `ctx.metadata`, rồi viết `toCreateSQL(cls)` đọc metadata sinh câu `CREATE TABLE`. In ra SQL.

5. Cố viết một parameter decorator ở chế độ chuẩn. Dán lỗi. Bật `experimentalDecorators` và viết lại — nhận xét chữ ký khác nhau thế nào.

6. Chạy ví dụ mục 6 và ghi lại output. Đổi thứ tự `@log('field')` và `@log('method')` trong file — output đổi thế nào ở pha eval, ở pha apply?

7. Build class có decorator rồi mở file `.js` sinh ra. Tìm hàm `__esDecorate` (chế độ chuẩn) và đọc xem nó gọi decorator của bạn ở đâu.

<details>
<summary>Gợi ý đáp án</summary>

**1.**
```ts
function memo<This, A, R>(target: (this: This, a: A) => R, _ctx: ClassMethodDecoratorContext) {
  const cache = new Map<A, R>();
  return function (this: This, a: A): R {
    if (!cache.has(a)) cache.set(a, target.call(this, a));
    return cache.get(a)!;
  };
}
```
Cache nằm ngoài hàm trả về nên dùng chung cho **mọi instance** — nếu muốn cache theo instance, tạo `Map` bên trong `addInitializer`.

**2.**
```ts
function bound<T, F extends Function>(target: F, ctx: ClassMethodDecoratorContext<T>) {
  ctx.addInitializer(function (this: T) { (this as any)[ctx.name] = target.bind(this); });
}
```

**5.** Chuẩn: `error TS1206: Decorators are not valid here.` Legacy: chữ ký là `(target: Object, key: string | symbol | undefined, index: number)` — có `index` là số thứ tự tham số, thứ mà mô hình chuẩn không có khái niệm tương ứng.

**6.** Pha `eval` chạy theo đúng thứ tự dòng trong file, nên đổi chỗ là đổi output. Pha `apply` luôn là thành viên trước, class sau.

</details>

---

👉 Tiếp: [A9 — Dự án: RPC type-safe từ đầu đến cuối](./09-du-an-rpc-type-safe.md)
