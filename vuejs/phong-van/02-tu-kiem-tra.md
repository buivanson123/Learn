# Tự kiểm tra Vue

Với mỗi dòng: **"Tôi giải thích được trong 1 phút, kèm ví dụ code không?"**

✅ được · ⚠️ lơ mơ · ❌ không

Ngưỡng đi phỏng vấn: **không còn ❌ ở nhóm A và B**.

---

## A. Reactivity — bộ lọc

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Reactivity hoạt động thế nào (Proxy, tự tìm phụ thuộc) | [02 §1](../02-reactivity.md) |
| ☐ | `ref` vs `reactive` — **3 hạn chế của `reactive`** | [02 §2–3](../02-reactivity.md) |
| ☐ | Vì sao `ref` cần `.value` | [02 §2](../02-reactivity.md) |
| ☐ | `toRefs` giải quyết vấn đề gì | [02 §3](../02-reactivity.md) |
| ☐ | `ref` trong object **unwrap**, trong array **không** | [02 §4](../02-reactivity.md) |
| ☐ | **`computed` có cache** — khác method thế nào | [02 §5](../02-reactivity.md) |
| ☐ | `computed` vs `watch` — dùng cái nào khi nào | [02 §5–6](../02-reactivity.md) |
| ☐ | `watch` vs `watchEffect` (chạy ngay, giá trị cũ) | [02 §7](../02-reactivity.md) |
| ☐ | **`watch` ref object không bắt được sửa bên trong** | [02 §6](../02-reactivity.md) |
| ☐ | 3 cách sửa (deep / getter / reactive) và đánh đổi | [02 §6](../02-reactivity.md) |
| ☐ | `nextTick` — khi nào cần | [02 §8](../02-reactivity.md) |
| ☐ | `shallowRef` / `markRaw` dùng khi nào | [01 A11–A13](./01-cau-hoi-va-dap-an.md) |
| ☐ | Kể được **7 cái bẫy reactivity** | [02 §9](../02-reactivity.md) |

---

## B. Template

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Vì sao `:key` quan trọng** — và Vue **không cảnh báo** khi key trùng | [01 §4](../01-template-va-binding.md) |
| ☐ | Vì sao không dùng index làm key | [01 §4](../01-template-va-binding.md) |
| ☐ | `v-if` vs `v-show` — chọn cái nào khi nào | [01 §3](../01-template-va-binding.md) |
| ☐ | Vì sao không đặt `v-if` cùng thẻ với `v-for` | [01 §4](../01-template-va-binding.md) |
| ☐ | `{{ }}` tự escape; `v-html` thì không | [01 §1](../01-template-va-binding.md) |
| ☐ | `v-model` thực chất là gì | [01 §6](../01-template-va-binding.md) |
| ☐ | **`v-model.number`** — vì sao cần | [01 §6](../01-template-va-binding.md) |
| ☐ | `@submit.prevent` và các modifier hay dùng | [01 §5](../01-template-va-binding.md) |

---

## C. Component

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Props xuống, emit lên, slot truyền giao diện | [03 §1–4](../03-component.md) |
| ☐ | `defineProps`/`defineEmits` là **macro**, không cần import | [03 §1](../03-component.md) |
| ☐ | **Props readonly chỉ nông một tầng** — sửa lồng không cảnh báo | [03 §1](../03-component.md) |
| ☐ | `defineModel` — `v-model` trên component | [03 §3](../03-component.md) |
| ☐ | Slot có tên + fallback | [03 §4](../03-component.md) |
| ☐ | **Scoped slot** — dữ liệu đi ngược lên cha | [03 §4](../03-component.md) |
| ☐ | `provide`/`inject` — khi nào **không** dùng | [03 §5](../03-component.md) |
| ☐ | `defineExpose` — vì sao cần | [03 §6](../03-component.md) |
| ☐ | Vòng đời: `onMounted` / `onUnmounted` và rò rỉ bộ nhớ | [04 §1](../04-composable-va-lifecycle.md) |
| ☐ | Composable — 3 quy tắc | [04 §2](../04-composable-va-lifecycle.md) |
| ☐ | **Composable vs Pinia vs provide/inject** | [04 §3](../04-composable-va-lifecycle.md) |
| ☐ | `<KeepAlive>` để làm gì | [03 §8](../03-component.md) |

---

## D. Router và Pinia

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | `useRoute` vs `useRouter` | [05 §4](../05-vue-router-5.md) |
| ☐ | **`props: true`** — vì sao tốt hơn `useRoute()` | [05 §3](../05-vue-router-5.md) |
| ☐ | `params`/`query` **luôn là chuỗi** | [05 §3](../05-vue-router-5.md) |
| ☐ | Navigation guard — trả về gì | [05 §6](../05-vue-router-5.md) |
| ☐ | **F5 ra 404** — nguyên nhân và 2 cách sửa | [05 §1](../05-vue-router-5.md) |
| ☐ | Lazy load route — kiểm chứng bằng output build | [05 §10](../05-vue-router-5.md) |
| ☐ | Catch-all phải đặt cuối | [05 §8](../05-vue-router-5.md) |
| ☐ | Pinia khác Vuex (không có mutations) | [06 §11](../06-pinia-4.md) |
| ☐ | **Destructure store làm mất reactivity** → `storeToRefs` | [06 §4](../06-pinia-4.md) |
| ☐ | `storeToRefs` cho state/getters, actions lấy thẳng | [06 §4](../06-pinia-4.md) |
| ☐ | Setup store **không có `$reset()`** | [06 §5](../06-pinia-4.md) |
| ☐ | `$patch` — lợi ích | [06 §5](../06-pinia-4.md) |
| ☐ | `setActivePinia` trong test | [06 §9](../06-pinia-4.md) |

---

## E. Thực chiến

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **`fetch` không ném lỗi với HTTP 404/500** | [07 §4](../07-form-va-goi-api.md) |
| ☐ | `loading = false` phải ở `finally` | [07 §4](../07-form-va-goi-api.md) |
| ☐ | Bốn trạng thái: loading/error/có dữ liệu/**rỗng** | [07 §4](../07-form-va-goi-api.md) |
| ☐ | Validate dữ liệu **nhận về** bằng Zod | [07 §5](../07-form-va-goi-api.md) |
| ☐ | **Race condition** + `AbortController` | [07 §6](../07-form-va-goi-api.md) |
| ☐ | Biến `touched` trong form — vì sao cần | [07 §2](../07-form-va-goi-api.md) |
| ☐ | CORS — sửa ở đâu, proxy Vite | [07 §7](../07-form-va-goi-api.md) |
| ☐ | Tối ưu Vue — vì sao **không cần** `memo` như React | [01 E4](./01-cau-hoi-va-dap-an.md) |
| ☐ | Test store + component bằng Vitest | [06 §9](../06-pinia-4.md) |
| ☐ | **Test xanh ≠ build xanh** (`type-check`) | [08 §9](../08-du-an-task-app.md) |

---

## F. So với React

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | **Khác biệt cốt lõi**: cách theo dõi thay đổi | [01 F1](./01-cau-hoi-va-dap-an.md) |
| ☐ | Vue không cần khai dependency — hệ quả | [01 F1](./01-cau-hoi-va-dap-an.md) |
| ☐ | `watch` khác `useEffect` chỗ nào | [01 F2](./01-cau-hoi-va-dap-an.md) |
| ☐ | Template biên dịch được → tối ưu + kiểm kiểu | [01 F3](./01-cau-hoi-va-dap-an.md) |
| ☐ | Trả lời "thích cái nào" **mà không chê cái kia** | [01 F4](./01-cau-hoi-va-dap-an.md) |

---

## G. Môi trường

| | Nội dung | Bài gốc |
|---|---|---|
| ☐ | Vite 8 cần Node >= 20.19 — và phải **cài lại `node_modules`** khi đổi Node | [00 §1](../00-chuan-bi.md) |
| ☐ | `vue-tsc` bắt lỗi kiểu **trong template** | [00 §6](../00-chuan-bi.md) |
| ☐ | Vì sao có 4 file `tsconfig` | [00 §6](../00-chuan-bi.md) |
| ☐ | Biến `VITE_*` bị nhúng vào bundle — không đặt secret | [00 §7](../00-chuan-bi.md) |

---

## H. Làm được không?

Gõ trong 10 phút, không nhìn tài liệu:

| | Bài |
|---|---|
| ☐ | Component có props + emit, khai kiểu đầy đủ |
| ☐ | `defineModel` cho một ô input |
| ☐ | Composable `useLocalStorage` (nhớ `deep: true`) |
| ☐ | Pinia store có state/getter/action + dùng `storeToRefs` |
| ☐ | Route có `props: true` + guard chặn `requiresAuth` |
| ☐ | Gọi API đủ `loading`/`error`/`finally` |
| ☐ | Test store: `setActivePinia` + kiểm tra một action |
| ☐ | Danh sách có `:key` ổn định + lọc bằng `computed` |

---

## I. Kể được không?

| | Nội dung |
|---|---|
| ☐ | Kể dự án Vue trong 2 phút, kèm **con số** (bundle size, số test) |
| ☐ | Một lỗi khó: destructure store / `:key` trùng — **cả hai đều không có cảnh báo** |
| ☐ | Vì sao chọn Vue cho dự án đó |
| ☐ | Thích Vue hay React — trả lời **không chê cái nào** |

---

## Chấm

| Kết quả | Nghĩa |
|---------|-------|
| A còn ❌ | **Chưa nên đi phỏng vấn.** Reactivity là nền tảng của cả framework |
| B còn ❌ | Ôn [bài 01](../01-template-va-binding.md) — `:key` và `v-if`/`v-show` ai cũng hỏi |
| C, D còn ❌ | Ôn 2 ngày — đây là phần thực chiến bị hỏi sâu |
| E còn ⚠️ | Chấp nhận được nếu bạn nói được vấn đề nó giải quyết |
| F còn ❌ | **Ưu tiên nếu CV có cả React** — câu này gần như chắc chắn bị hỏi |
| H còn ❌ | Nguy hiểm — phỏng vấn frontend hay yêu cầu code trực tiếp |

---

| Lần | Ngày | ❌ | ⚠️ | Nhóm yếu nhất |
|-----|------|----|----|----|
| 1 | | | | |
| 2 | | | | |

---

Quay lại [README phỏng vấn](./README.md) · [Bộ Vue](../README.md)
