# Tự kiểm tra TypeScript

Với mỗi dòng: **"Tôi giải thích được điều này trong 1 phút, kèm code viết tay không?"**

✅ được · ⚠️ lơ mơ · ❌ không

Ngưỡng đi phỏng vấn: **không còn ❌ ở nhóm A–D**.

---

## A. Nền tảng — bắt buộc

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Kiểu bị xoá khi biên dịch — TS **không** bắt lỗi lúc chạy | [01 A1](./01-cau-hoi-va-dap-an.md) |
| ☐ | `any` vs `unknown` — vì sao `unknown` an toàn hơn | [01 §5](../01-kieu-co-ban.md) |
| ☐ | `never` và kiểm tra vét cạn trong `switch` | [01 §6](../01-kieu-co-ban.md) |
| ☐ | Khi nào để TS tự suy, khi nào ghi kiểu tay | [README](../README.md) |
| ☐ | `as const` sinh union từ mảng | [01 §7](../01-kieu-co-ban.md) |
| ☐ | Vì sao dùng union + `as const` thay `enum` | [01 §7](../01-kieu-co-ban.md) |
| ☐ | 3 tuỳ chọn bị gỡ ở TS 7 và mã lỗi tương ứng | [00](../00-cai-dat-va-tsconfig.md) |
| ☐ | Vì sao `@types/node` cài rồi vẫn báo `Cannot find name 'process'` | [00](../00-cai-dat-va-tsconfig.md) |

---

## B. Object, `type` vs `interface`

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Khác biệt **quan trọng nhất**: declaration merging | [11 §2](../11-type-system-sau.md) |
| ☐ | Structural typing — vì sao `implements` gần như không bắt buộc | [11 §1](../11-type-system-sau.md) |
| ☐ | Excess property check chỉ áp cho literal — vì sao | [02 §2](../02-object-interface-type.md) |
| ☐ | `?` khác `\| undefined` | [02](../02-object-interface-type.md) |
| ☐ | `readonly` chỉ nông một tầng | [02](../02-object-interface-type.md) |
| ☐ | Bẫy index signature, cờ `noUncheckedIndexedAccess` | [02](../02-object-interface-type.md) |
| ☐ | `Record<'vi'\|'en', string>` khác `{[k:string]: string}` | [01 B7](./01-cau-hoi-va-dap-an.md) |
| ☐ | Mở rộng `Window` / `ProcessEnv` bằng `declare global` | [11 §2](../11-type-system-sau.md) |

---

## C. Narrowing

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Kể 5 cách narrowing | [03](../03-ham-va-narrowing.md) |
| ☐ | Discriminated union — viết được `Result<T, E>` | [03](../03-ham-va-narrowing.md) |
| ☐ | `x is T` vs `asserts x is T` | [11 §5](../11-type-system-sau.md) |
| ☐ | Type predicate **không** được TS kiểm chứng — hệ quả | [01 C4](./01-cau-hoi-va-dap-an.md) |
| ☐ | `??` khác `\|\|` — bẫy với số 0 và chuỗi rỗng | [03](../03-ham-va-narrowing.md) |
| ☐ | Vì sao narrowing "mất" sau khi gọi hàm khác | [01 C6](./01-cau-hoi-va-dap-an.md) |
| ☐ | `satisfies` vs `as` — vì sao ưu tiên `satisfies` | [05](../05-utility-va-type-nang-cao.md) |

---

## D. Generic và thực chiến

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Generic giải quyết gì mà `any` không | [04](../04-generic.md) |
| ☐ | Ràng buộc `extends` — vì sao cần | [04](../04-generic.md) |
| ☐ | `keyof` + indexed access — viết được hàm `get(obj, key)` | [04](../04-generic.md) |
| ☐ | `typeof` ở tầng kiểu | [04](../04-generic.md) |
| ☐ | **Dữ liệu API chưa có kiểu** — `as` không kiểm tra gì | [07](../07-thuc-chien-api-va-module.md) |
| ☐ | Validate ở biên bằng Zod, `z.infer` là nguồn sự thật | [07](../07-thuc-chien-api-va-module.md) |
| ☐ | Zod 4: `z.email()`, `z.url()`, `z.coerce.number()` | [07](../07-thuc-chien-api-va-module.md) |
| ☐ | Validate env lúc khởi động | [07](../07-thuc-chien-api-va-module.md) |
| ☐ | `Omit` **trước** rồi mới `Partial` khi làm UpdateDto | [05](../05-utility-va-type-nang-cao.md) |
| ☐ | `Pick` an toàn hơn `Omit` cho dữ liệu trả ra ngoài | [01 E2](./01-cau-hoi-va-dap-an.md) |
| ☐ | `catch (e)` có kiểu `unknown` — xử lý thế nào | [01 F2](./01-cau-hoi-va-dap-an.md) |
| ☐ | `import type` khác `import` | [07](../07-thuc-chien-api-va-module.md) |

---

## E. Nâng cao — có thì nổi bật

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Mapped type + key remapping | [05](../05-utility-va-type-nang-cao.md) |
| ☐ | Conditional type + `infer` — viết được `ElementOf<T>` | [05](../05-utility-va-type-nang-cao.md) |
| ☐ | Template literal type | [05](../05-utility-va-type-nang-cao.md) |
| ☐ | Mảng là covariant và **không sound** | [11 §3](../11-type-system-sau.md) |
| ☐ | `strictFunctionTypes` và contravariance của tham số | [11 §3](../11-type-system-sau.md) |
| ☐ | Branded type chặn nhầm `UserId`/`PostId` | [11 §4](../11-type-system-sau.md) |
| ☐ | `moduleResolution` nào còn dùng được ở TS 7 | [11 §6](../11-type-system-sau.md) |
| ☐ | Decorator và `emitDecoratorMetadata` (nền của NestJS) | [06](../06-class-va-decorator.md) |

---

## F. Viết được không?

Gõ trong 5 phút, không nhìn tài liệu:

| | Bài |
|---|---|
| ☐ | `Result<T, E>` discriminated union + hàm dùng nó |
| ☐ | `DeepPartial<T>` đệ quy |
| ☐ | `ElementOf<T>` dùng `infer` |
| ☐ | `pick<T, K extends keyof T>()` |
| ☐ | Branded type `Email` có hàm tạo validate |
| ☐ | Schema Zod + `z.infer` cho một response API |

---

## Chấm

| Kết quả | Nghĩa |
|---------|-------|
| A còn ❌ | Ôn lại [bài 00–01](../00-cai-dat-va-tsconfig.md) trước |
| B hoặc D còn ❌ | Đây là hai nhóm bị hỏi nhiều nhất — ưu tiên |
| C còn ⚠️ | Chấp nhận được nếu viết được `Result<T,E>` |
| E toàn ⚠️ | Không sao ở mức middle — nói "em biết nó giải quyết gì, chưa dùng nhiều" |
| F còn ❌ | **Nguy hiểm.** Câu hỏi TS hay kèm "viết thử xem" |

---

| Lần | Ngày | ❌ | ⚠️ |
|-----|------|----|----|
| 1 | | | |
| 2 | | | |

---

Quay lại [README phỏng vấn](./README.md) · [Bộ TypeScript](../README.md)
