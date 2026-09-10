# TypeScript nâng cao

Phần tiếp nối của [bộ tài liệu chính](../README.md). Bộ chính dạy bạn **dùng** TypeScript; bộ này dạy bạn **thiết kế bằng** TypeScript — viết API mà người khác không thể dùng sai, và giữ dự án lớn không chậm đi.

**Điều kiện tiên quyết:** đã học xong bài 00 → 11 của bộ chính. Bài 04 (generic), 05 (utility & type nâng cao) và 11 (hệ thống kiểu) là nền trực tiếp của phần này.

Mọi mã lỗi, con số đo và output trong bộ này đều **chạy thật** trước khi viết ra, bằng:

| Công cụ | Phiên bản |
|---|---|
| TypeScript | 7.0.2 |
| Node.js | 22.23.2 |
| zod | 4.5.4 |
| @types/node | 26.5.0 |

---

## Lộ trình

| # | File | Nội dung | Thời lượng |
|---|---|---|---|
| A1 | [01-suy-kien-generic-nang-cao.md](./01-suy-kien-generic-nang-cao.md) | Cơ chế suy kiểu, `const` type parameter, `NoInfer`, method bivariance, narrowing trong generic | 3h |
| A2 | [02-lap-trinh-tren-tang-kieu.md](./02-lap-trinh-tren-tang-kieu.md) | Đệ quy trên tuple, giới hạn 47/999/100 000, phân tích chuỗi, kiểm thử kiểu | 4h |
| A3 | [03-kieu-theo-trang-thai.md](./03-kieu-theo-trang-thai.md) | Builder tích luỹ, ép thứ tự gọi, phantom type, mixin, `this` type | 3h |
| A4 | [04-declaration-va-augmentation.md](./04-declaration-va-augmentation.md) | `.d.ts`, wildcard module, module/global augmentation, bẫy `process.env`, `--explainFiles` | 3h |
| A5 | [05-cau-hinh-hien-dai-va-bien-runtime.md](./05-cau-hinh-hien-dai-va-bien-runtime.md) | Node chạy thẳng `.ts`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `z.input` vs `z.output` | 3h |
| A6 | [06-hieu-nang-type-checker.md](./06-hieu-nang-type-checker.md) | `--extendedDiagnostics`, `--generateTrace`, đo và sửa dự án chậm | 2h |
| A7 | [07-monorepo-project-references.md](./07-monorepo-project-references.md) | `composite`, `tsc -b`, build tăng dần, vì sao `paths` là bẫy | 3h |
| A8 | [08-decorator-chuan.md](./08-decorator-chuan.md) | Decorator Stage 3, `accessor`, `Symbol.metadata`, so với legacy của NestJS | 3h |
| A9 | [09-du-an-rpc-type-safe.md](./09-du-an-rpc-type-safe.md) | **Dự án: RPC type-safe từ hợp đồng đến lời gọi** — mã nguồn chạy được ở [`du-an-rpc/`](./du-an-rpc/) | 5h |
| A10 | [10-bay-nang-cao-va-checklist.md](./10-bay-nang-cao-va-checklist.md) | 16 bẫy TypeScript không báo lỗi + checklist tổng | 2h |

Tổng khoảng **31 giờ**. Không cần học liền mạch: A4–A7 độc lập với nhau, đọc theo nhu cầu cũng được. A1 → A2 → A9 là mạch chính, nên theo đúng thứ tự.

---

## Một mẹo dùng suốt bộ này

Cách xem kiểu thật sự mà TypeScript suy ra, ngay trên terminal — cố tình gán vào `never`:

```ts
const arr = [1, 2, 3].map((n) => ({ v: n }));
const _show: never = null as any as typeof arr;
```
```bash
$ npx tsc --noEmit
```
```
error TS2322: Type '{ v: number; }[]' is not assignable to type 'never'.
                    ↑ đây là kiểu thật
```

Nếu kiểu hiện ra dưới dạng tên alias chưa tính (`CamelKeys<Row>`) thì bọc thêm `Prettify`:
```ts
type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

---

## Ba câu hỏi bộ này trả lời

**1. Vì sao generic của tôi suy ra kiểu lạ?**
→ A1. Ngắn gọn: ứng viên đầu tiên thắng, vị trí trả về ưu tiên thấp nhất, và hàm generic không đi xuyên được đối số.

**2. Vì sao editor chậm dần?**
→ A6. Ngắn gọn: đo bằng `--extendedDiagnostics` trước, `skipLibCheck` gần như luôn là thủ phạm lớn nhất (đo được 36× trên một file 3 dòng).

**3. Làm sao viết API mà người khác không dùng sai được?**
→ A3 + A9. Ngắn gọn: đưa trạng thái vào kiểu, rút thông tin từ literal, và parse mọi thứ ở biên.

---

## Sau bộ này

- Đọc được mã nguồn của `zod`, `tRPC`, `drizzle`, `hono` mà không phải đoán.
- Đi phỏng vấn mức Senior: xem thêm [phong-van/](../phong-van/README.md) của bộ chính.
- Học tiếp [NestJS](../../nestjs/README.md) — bài A8 giải thích chính xác vì sao NestJS còn ở lại decorator legacy.

Bắt đầu 👉 [A1 — Suy kiểu generic ở tầng sâu](./01-suy-kien-generic-nang-cao.md)
