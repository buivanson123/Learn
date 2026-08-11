# Học TypeScript nhanh nhất (dành cho người đã viết JavaScript thật)

TypeScript là JavaScript **cộng thêm một lớp kiểm tra chạy lúc bạn gõ code**. Nó không thêm tính năng runtime nào — trình biên dịch xoá hết phần kiểu rồi trả về JavaScript thuần. Giá trị duy nhất nó mang lại: **lỗi hiện ra trong editor thay vì hiện ra trên production lúc 2h sáng**.

Bạn đã viết JavaScript rồi, nên tài liệu này **không dạy lại** `async/await`, closure, array method, module. Nó chỉ dạy đúng phần TypeScript thêm vào, và dạy bằng code chạy được.

---

## Lộ trình 5 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-cai-dat-va-tsconfig.md](./00-cai-dat-va-tsconfig.md) | Cài đặt, 4 cách chạy file `.ts`, đọc hiểu `tsconfig.json` | 2h |
| 1 | [01-kieu-co-ban.md](./01-kieu-co-ban.md) | Kiểu nguyên thuỷ, mảng, tuple, union, literal, `any`/`unknown`/`never` | 3h |
| 2 | [02-object-interface-type.md](./02-object-interface-type.md) | `interface` vs `type`, optional, `readonly`, index signature, lồng nhau | 3h |
| 2 | [03-ham-va-narrowing.md](./03-ham-va-narrowing.md) | Kiểu cho hàm, overload, thu hẹp kiểu, type guard, discriminated union | 3h |
| 3 | [04-generic.md](./04-generic.md) | Generic, ràng buộc `extends`, `keyof`, `typeof`, indexed access | 3h |
| 3 | [05-utility-va-type-nang-cao.md](./05-utility-va-type-nang-cao.md) | `Partial`/`Pick`/`Omit`/`Record`..., mapped type, conditional type, `infer`, `satisfies` | 3h |
| 4 | [06-class-va-decorator.md](./06-class-va-decorator.md) | Class, modifier, `abstract`, `implements`, decorator (nền của NestJS) | 3h |
| 4 | [07-thuc-chien-api-va-module.md](./07-thuc-chien-api-va-module.md) | Gọi API an toàn, validate biên, `.d.ts`, `@types`, cấu hình `env` | 3h |
| 5 | [08-du-an-task-cli.md](./08-du-an-task-cli.md) | **Dự án: CLI quản lý task, type-safe từ đầu đến cuối** | 5h |
| — | [09-loi-thuong-gap.md](./09-loi-thuong-gap.md) | 22 lỗi kinh điển: mã lỗi thật, nguyên nhân, cách sửa | — |
| — | [10-cheatsheet.md](./10-cheatsheet.md) | Tra cứu nhanh cú pháp, utility type, cờ `tsconfig` | — |
| + | [11-type-system-sau.md](./11-type-system-sau.md) | **Bổ sung:** structural typing sâu, declaration merging, variance, branded type, module resolution | 3h |

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 45 câu hỏi kèm đáp án hai tầng, 6 bài viết code trên giấy,
và checklist tự kiểm tra.

Bài 11 ở trên nằm ngoài lộ trình 5 ngày nhưng **cần cho phỏng vấn** — nó chứa những câu hay được dùng
để phân biệt "gắn kiểu cho có" và "hiểu hệ thống kiểu".

Học xong bạn đọc được toàn bộ code trong bộ [NestJS](../nestjs/README.md) mà không phải đoán chỗ nào.

---

## Ba nguyên tắc cốt lõi của TypeScript

Hiểu 3 điều này là hết bỡ ngỡ.

### 1. Kiểu biến mất hoàn toàn khi chạy

Trình biên dịch **xoá kiểu**, không kiểm tra gì lúc runtime. Tự chứng minh:

```bash
$ cat src/demo.ts
```
```ts
interface User { id: number; name: string }

function greet(u: User): string {
  return `Xin chào ${u.name}`;
}

console.log(greet({ id: 1, name: 'Sơn' }));
```
```bash
$ npx tsc src/demo.ts --outFile out.js && cat out.js
```
```js
function greet(u) {                          // ← interface User biến mất sạch
    return "Xin chào " + u.name;
}
console.log(greet({ id: 1, name: 'Sơn' }));
```

Hệ quả trực tiếp: dữ liệu từ `fetch()`, từ `JSON.parse()`, từ `req.body` **không được TypeScript kiểm tra**. Bạn khai `const u: User = await res.json()` thì TS tin bạn, còn API trả về gì thì trời biết:

```ts
const u: User = await res.json();   // TS không báo lỗi
console.log(u.name.toUpperCase());  // 💥 runtime: TypeError: Cannot read properties of undefined
```

Cách xử lý đúng nằm ở [bài 07](./07-thuc-chien-api-va-module.md).

### 2. Kiểu được suy ra, đừng gõ thừa

TypeScript tự đoán kiểu từ giá trị. Chỉ ghi kiểu ở nơi nó **không đoán được**: tham số hàm, dữ liệu từ bên ngoài, và giá trị trả về của API công khai.

```ts
const n = 5;                 // n: 5        (đủ, đừng viết `const n: number = 5`)
const arr = [1, 2, 3];       // arr: number[]
const m = new Map<string, number>();   // ← chỗ này phải ghi, TS không đoán được

function double(x) { }       // ❌ error TS7006: Parameter 'x' implicitly has an 'any' type.
function double(x: number) { }  // ✅
```

### 3. Chỉ bật `strict: true`, đừng bật kiểu nửa vời

Không có `strict`, TypeScript coi mọi thứ có thể là `null` mà không cảnh báo — tức là bạn mất đúng cái lợi ích lớn nhất.

```jsonc
// tsconfig.json — dòng quan trọng nhất trong cả file
"strict": true
```

Không bật:
```ts
function len(s: string) { return s.length; }
len(null);   // ✅ không lỗi → 💥 runtime: Cannot read properties of null
```
Bật:
```
src/demo.ts:2:5 - error TS2345: Argument of type 'null' is not assignable to parameter of type 'string'.
```

---

## Cách học hiệu quả nhất

1. **Mở một terminal chạy `npx tsc --noEmit --watch` suốt buổi học.** Mỗi lần lưu file, lỗi hiện ra ngay — đó là vòng phản hồi nhanh nhất.
2. **Cố tình viết sai.** Mỗi khi tài liệu ghi "cái này sẽ lỗi", hãy gõ đúng đoạn sai đó và xem mã lỗi thật. Nhớ mã lỗi quan trọng hơn nhớ lý thuyết.
3. **Đừng dùng `any` để cho qua.** Mỗi `any` là một chỗ TypeScript ngừng bảo vệ bạn. Bí thì dùng `unknown` rồi thu hẹp ([bài 03](./03-ham-va-narrowing.md)).
4. **Làm bài tập cuối mỗi file** trước khi sang file sau. Đáp án nằm trong thẻ gấp ngay bên dưới.

---

## Chuẩn bị

- Node.js 22 trở lên: `node -v`
- VS Code (hoặc editor bất kỳ có TypeScript language server)
- Khoảng 15h rảnh chia trong 5 ngày

Bắt đầu 👉 [00-cai-dat-va-tsconfig.md](./00-cai-dat-va-tsconfig.md)
