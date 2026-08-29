# Bài 09 — 22 lỗi thường gặp

Mỗi mục có **triệu chứng thật**, nguyên nhân, và cách sửa. Chạy trên Vue 3.5 + vue-router 5 + Pinia 4.

⚠️ Lưu ý quan trọng: **nhiều lỗi Vue không có thông báo nào** — chỉ có hành vi sai. Đó là lý do bảng
triệu chứng ở cuối bài đáng nhớ hơn danh sách thông báo lỗi.

---

## Nhóm 1 — Reactivity (7 lỗi)

### 1. ⭐ Giao diện hiện `[object Object]`

**Nguyên nhân:** quên `.value` trong `<script>`.

```ts
const n = ref(1)
console.log(n + 1)        // ❌ không phải 2
```

**Sửa:** `n.value + 1`. Bật TypeScript để bắt lỗi này lúc gõ.

Trong `<template>` thì **không** cần `.value` — Vue tự bỏ.

### 2. ⭐⭐ Sửa dữ liệu mà giao diện không đổi (destructure `reactive`)

```ts
const state = reactive({ count: 0 })
const { count } = state       // ❌ mất reactivity
state.count = 10
// count vẫn là 0
```

**Không có cảnh báo nào.**

**Sửa:** `const { count } = toRefs(state)`, hoặc dùng `ref` ngay từ đầu.

### 3. ⭐⭐ Bấm nút mà store không phản ứng (destructure Pinia store)

```ts
const { remaining, filter } = useTasksStore()    // ❌
```

Cùng nguyên nhân với lỗi 2 — store là object reactive.

**Sửa:**

```ts
const { remaining, filter } = storeToRefs(store)   // state + getters
const { add, toggle } = store                       // actions
```

### 4. Gán lại object cho `reactive` làm mất liên kết

```ts
let state = reactive({ count: 0 })
state = reactive({ count: 99 })     // ❌ template vẫn render object cũ
```

**Sửa:** dùng `ref` — `state.value = { count: 99 }` hoạt động bình thường.

### 5. `watch` không chạy khi sửa bên trong object

```ts
const user = ref({ name: 'a' })
watch(user, fn)
user.value.name = 'b'        // ❌ fn KHÔNG chạy
```

Tham chiếu object không đổi nên `watch` không thấy gì.

**Sửa:**

```ts
watch(user, fn, { deep: true })          // hoặc
watch(() => user.value.name, fn)         // chính xác hơn, rẻ hơn
```

### 6. Dữ liệu không lưu vào localStorage

```ts
watch(items, save)                  // ❌ push không kích hoạt
watch(items, save, { deep: true })  // ✅
```

Cùng gốc với lỗi 5. Đây là lỗi hay gặp nhất khi tự viết `useLocalStorage`.

### 7. Đọc DOM ngay sau khi sửa state ra giá trị cũ

```ts
show.value = true
input.value?.focus()        // ❌ input chưa tồn tại
```

**Sửa:**

```ts
show.value = true
await nextTick()
input.value?.focus()        // ✅
```

Vue gom thay đổi rồi cập nhật DOM **một lần** ở cuối tick.

---

## Nhóm 2 — Component (6 lỗi)

### 8. ⭐ `Failed to resolve component`

```
[Vue warn]: Failed to resolve component: KhongCo
```

**Nguyên nhân:** quên `import`, hoặc gõ sai tên, hoặc sai đường dẫn.

**Sửa:** với `<script setup>` chỉ cần `import` là component dùng được — không cần khai `components: {}`.

### 9. ⭐ `Property "x" was accessed during render but is not defined on instance`

```
[Vue warn]: Property "khongCo" was accessed during render but is not defined on instance.
```

**Nguyên nhân:** template dùng biến chưa khai, gõ sai tên, hoặc quên `return` trong composable/store.

**Sửa:** kiểm tra chính tả; nếu là setup store thì đảm bảo đã `return` giá trị đó.

### 10. Sửa prop không có tác dụng (hoặc có mà không nên)

```ts
props.title = 'moi'          // ❌ có cảnh báo
```
```
[Vue warn] Set operation on key "title" failed: target is readonly.
```

⚠️ Nhưng sửa **lồng bên trong** thì **không** cảnh báo:

```ts
props.task.title = 'moi'     // ⚠️ chạy im lặng, sửa luôn dữ liệu của cha
```

`readonly` của Vue chỉ **nông một tầng**. Trường hợp thứ hai nguy hiểm hơn vì không có dấu hiệu gì.

**Sửa:** `emit` lên cha, hoặc dùng `defineModel`.

### 11. ⭐ `Extraneous non-props attributes were passed to component`

```
[Vue warn]: Extraneous non-props attributes (class) were passed to component but could not be
automatically inherited because component renders fragment or text or teleport root nodes.
```

**Nguyên nhân:** component có **nhiều thẻ gốc**, Vue không biết gắn `class` vào đâu.

**Sửa:**

```vue
<script setup>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div>
    <button v-bind="$attrs">...</button>   <!-- chỉ rõ chỗ nhận -->
  </div>
</template>
```

### 12. Gọi method của component con ra `undefined`

```ts
modal.value?.show()      // undefined
```

**Nguyên nhân:** `<script setup>` **đóng kín** mặc định.

**Sửa:** trong component con thêm `defineExpose({ show, hide })`.

### 13. `v-model` trên prop không hoạt động

```vue
<input v-model="task.done">     <!-- ❌ task là prop -->
```

**Sửa:** dùng `:checked` + `@change` rồi emit, hoặc `defineModel` nếu component đó sở hữu giá trị.

---

## Nhóm 3 — Template (4 lỗi)

### 14. ⭐⭐ Danh sách hành xử sai sau khi xoá/sắp xếp

**Triệu chứng:** ô input đang gõ nhảy sang hàng khác; xoá hàng này thì hàng khác biến mất; checkbox
tick nhầm dòng.

**Nguyên nhân:** thiếu `:key`, hoặc `key` **trùng nhau**, hoặc dùng index làm key.

⚠️ **Vue 3.5 không cảnh báo gì trong trường hợp key trùng** — tôi đã thử cả lúc mount lẫn lúc cập nhật,
console hoàn toàn im lặng. Chỉ có hành vi sai.

**Sửa:** `:key` phải **ổn định và duy nhất**. Dùng `crypto.randomUUID()` thay `Date.now()` — hai mục
tạo trong cùng mili giây sẽ trùng id.

### 15. `v-if` và `v-for` trên cùng một thẻ

```vue
<li v-for="t in tasks" v-if="!t.done" :key="t.id">   <!-- ❌ -->
```

Trong Vue 3, `v-if` chạy **trước** `v-for` nên biến `t` chưa tồn tại:

```
[Vue warn]: Property "t" was accessed during render but is not defined on instance.
```

**Sửa:** lọc bằng `computed` (tốt nhất, có cache), hoặc bọc `<template v-for>`.

### 16. Nội dung HTML hiện ra dạng literal

```vue
<p>{{ htmlString }}</p>      <!-- hiện <b>đậm</b> -->
```

`{{ }}` **cố ý** escape để chống XSS.

**Sửa:** `v-html` — nhưng chỉ khi nội dung do bạn kiểm soát. Dữ liệu người dùng thì phải lọc trước.

### 17. `<textarea>` không hai chiều

```vue
<textarea>{{ content }}</textarea>        <!-- ❌ -->
<textarea v-model="content"></textarea>   <!-- ✅ -->
```

---

## Nhóm 4 — Router (3 lỗi)

### 18. ⭐ F5 ở trang con ra 404

**Triệu chứng:** vào `/tasks/1` bằng cách bấm link thì được, nhưng F5 hoặc dán URL thì server trả 404.

**Nguyên nhân:** `createWebHistory` tạo URL thật; server đi tìm file `/tasks/1` không tồn tại.

**Sửa** — cấu hình server rewrite mọi đường dẫn về `index.html`:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

```json
// vercel.json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Hoặc dùng `createWebHashHistory()` — URL thành `/#/tasks/1`, chạy được mọi nơi mà không cần cấu hình.

### 19. `route.params.id` so sánh với số luôn sai

```ts
if (route.params.id === 1) { }       // ❌ luôn false
```

`params` **luôn là chuỗi**, kể cả URL là `/tasks/1`.

**Sửa:** `Number(route.params.id)`.

### 20. Bấm link làm tải lại cả trang

```vue
<a href="/about">Giới thiệu</a>          <!-- ❌ -->
<RouterLink to="/about">Giới thiệu</RouterLink>   <!-- ✅ -->
```

Thẻ `<a>` khiến trình duyệt tải lại toàn bộ, mất hết state.

### 21. Catch-all nuốt hết mọi route

```ts
routes: [
  { path: '/:pathMatch(.*)*', component: NotFound },   // ❌ đặt đầu
  { path: '/', component: Home },
]
```

Router khớp theo **thứ tự khai**. Catch-all phải đặt **cuối cùng**.

---

## Nhóm 5 — Công cụ (1 lỗi + phụ lục)

### 22. ⭐ `npm run build` đỏ dù test xanh

```
src/stores/tasks.spec.ts(29,14): error TS2532: Object is possibly 'undefined'.
ERROR: "type-check" exited with 2.
```

**Nguyên nhân:** scaffold bật `noUncheckedIndexedAccess`, nên `items[0]` có kiểu `Task | undefined`.
Vitest **không** kiểm tra kiểu, nên test vẫn xanh.

**Sửa:**

```ts
const first = items.value[0]
if (!first) return              // ✅ trong code thật

s.items[0]!.id                   // chấp nhận được trong test
```

**Bài học:** `npm run test` xanh không có nghĩa `npm run build` xanh. Chạy `npm run type-check` trước
khi commit.

---

## Phụ lục A — Lỗi môi trường

### Vite không chạy trên Node 20.14

```
Error: Cannot find module '@rolldown/binding-darwin-universal'
Node.js v20.14.0
```

Vite 8 cần Node `^20.19.0 || >=22.12.0`.

```bash
$ nvm use 22
$ rm -rf node_modules package-lock.json && npm install    # ⚠️ BẮT BUỘC cài lại
```

Chỉ `nvm use` mà không cài lại thì vẫn lỗi y hệt — binary gốc được biên dịch theo ABI của Node lúc cài.

### `npm create vue` với `--eslint` thất bại

```
npm error code ERESOLVE
npm error Found: oxlint@1.74.0
npm error Could not resolve dependency:
npm error peer oxlint@"~1.73.0" from eslint-plugin-oxlint@1.73.0
```

Xung đột phiên bản trong scaffold. Bỏ cờ `--eslint`, hoặc `npm install --legacy-peer-deps`.

### Pinia: `getActivePinia() was called but there was no active Pinia`

```
[🍍]: "getActivePinia()" was called but there was no active Pinia.
Are you trying to use a store before calling "app.use(pinia)"?
```

**Trong test:** thiếu `setActivePinia(createPinia())` trong `beforeEach`.
**Trong app:** gọi store trước `app.use(createPinia())`, hoặc gọi ngoài `setup`.

### Pinia: `$reset()` không dùng được

```
🍍: Store "tasks" is built using the setup syntax and does not implement $reset().
```

Setup store không có `$reset` sẵn. Tự viết một action gán lại từng giá trị.

### CORS khi gọi API

```
Access to fetch at 'http://localhost:3000/api/tasks' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

Lỗi **phía server**. Bật CORS ở backend, hoặc dùng proxy của Vite khi dev:

```ts
server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }
```

---

## Phụ lục B — ⭐ Bảng tra theo triệu chứng

Đây là bảng đáng nhớ nhất — vì **phần lớn lỗi Vue không có thông báo nào**.

| Triệu chứng | Nghi ngờ đầu tiên |
|-------------|-------------------|
| Hiện `[object Object]` | Quên `.value` |
| Sửa dữ liệu, giao diện đứng yên | Destructure `reactive` hoặc store → `toRefs`/`storeToRefs` |
| Bấm nút lọc không ăn | Destructure Pinia store |
| Không lưu vào localStorage | `watch` thiếu `deep: true` |
| `watch` không chạy | Sửa bên trong object → cần `deep` hoặc watch getter |
| Ô input nhảy sang hàng khác | `:key` thiếu / trùng / dùng index |
| Xoá hàng này, hàng khác biến mất | Như trên |
| `focus()` không có tác dụng | Thiếu `await nextTick()` |
| Sửa prop mà cha không biết | Nên `emit`, không sửa trực tiếp |
| Gọi method con ra `undefined` | Thiếu `defineExpose` |
| F5 ra 404 | Server chưa rewrite về `index.html` |
| Bấm link tải lại cả trang | Dùng `<a>` thay `<RouterLink>` |
| Mọi route ra trang 404 | Catch-all đặt sai vị trí |
| So sánh `params.id` luôn sai | `params` là chuỗi |
| Build đỏ mà test xanh | `type-check` — Vitest không kiểm tra kiểu |
| Spinner quay mãi | `loading = false` không nằm trong `finally` |
| `fetch` không vào `catch` khi 404 | `fetch` không ném lỗi với HTTP 4xx/5xx — phải kiểm `res.ok` |
| Kết quả tìm kiếm không khớp ô input | Race condition — cần `AbortController` |

---

## Phụ lục C — Ba công cụ gỡ lỗi

**1. Vue DevTools → tab Components**
Xem giá trị **thật sự** của state, sửa trực tiếp để thử. Nhanh hơn rải `console.log`.

**2. Vue DevTools → tab Pinia**
State có đổi không? Nếu store đổi mà giao diện đứng yên → chắc chắn là lỗi destructure.

**3. `npm run type-check`**
Bắt lỗi **trong template** mà trình duyệt không báo — sai kiểu prop, sai payload emit.

---

Tiếp theo: [10-cheatsheet.md](./10-cheatsheet.md)
