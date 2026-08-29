# Bài 00 — Chuẩn bị: Node, tạo project, đọc cấu trúc

Mục tiêu: có một project Vue 3 chạy được, hiểu từng file sinh ra để làm gì, và biết cách bắt lỗi kiểu
trước khi chạy.

---

## 1. ⚠️ Node phải >= 20.19 — máy bạn chưa đủ

Vite 8 khai rõ:

```bash
$ npm view vite@8 engines
{ node: '^20.19.0 || >=22.12.0' }
```

Node hiện tại của bạn:

```bash
$ node -v
v20.14.0
```

**Không thoả.** Và nó không chỉ cảnh báo — lúc cài chỉ là warning:

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'rolldown@1.2.5',
npm warn EBADENGINE   required: { node: '^20.19.0 || >=22.12.0' },
npm warn EBADENGINE   current: { node: 'v20.14.0', npm: '10.7.0' }
npm warn EBADENGINE }
```

nhưng lúc chạy thì hỏng thật:

```bash
$ npx vite build
Error: Cannot find module '@rolldown/binding-darwin-universal'
Require stack:
- .../node_modules/rolldown/dist/shared/binding-C__LJDBG.mjs
...
Node.js v20.14.0
```

Vite 8 dùng **rolldown** (viết bằng Rust) làm bundler, và binary gốc của nó chỉ build cho Node >= 20.19.

### Sửa

Máy bạn đã có sẵn `nvm` với nhiều bản dùng được:

```bash
$ ls ~/.nvm/versions/node
v14.16.1  v20.14.0  v20.19.0  v20.19.5  v22.23.2  v25.2.1  v7.10.1

$ nvm use 22
Now using node v22.23.2 (npm v10.9.4)

$ node -v
v22.23.2
```

Đặt mặc định để mở terminal mới không phải gõ lại:

```bash
$ nvm alias default 22
```

### ⚠️ Đổi Node xong phải cài lại `node_modules`

Đây là bước hay bị bỏ qua. Gói có binary gốc được biên dịch theo **ABI của Node lúc cài** — đổi Node mà
giữ `node_modules` cũ thì vẫn lỗi y hệt.

```bash
$ rm -rf node_modules package-lock.json
$ npm install
```

Sau đó build chạy:

```bash
$ npx vite build
transforming...
✓ 9 modules transformed.
dist/index.html                 0.14 kB │ gzip:  0.13 kB
dist/assets/index-C__1Yz04.js  59.58 kB │ gzip: 23.51 kB

✓ built in 88ms
```

> Ghi vào `package.json` để cả team không vấp:
> ```json
> "engines": { "node": ">=20.19.0" }
> ```
> Và tạo file `.nvmrc` chứa `22` — người khác chỉ cần `nvm use`.

---

## 2. Tạo project

Vue có công cụ scaffold chính chủ:

```bash
$ npm create vue@latest taskapp -- --typescript --router --pinia --vitest
```

```
┌  Vue.js - The Progressive JavaScript Framework

Scaffolding project in .../taskapp...
│
└  Done. Now run:

   cd taskapp
   npm install
   npm run dev
```

Bỏ hết cờ thì nó hỏi từng câu một — tiện khi bạn muốn xem có những lựa chọn gì.

```bash
$ cd taskapp && npm install
```

### ⚠️ Đừng thêm `--eslint` lúc này

Scaffold hiện tại có xung đột phiên bản, `npm install` **thất bại**:

```
npm error code ERESOLVE
npm error ERESOLVE unable to resolve dependency tree
npm error
npm error While resolving: taskapp@0.0.0
npm error Found: oxlint@1.74.0
npm error node_modules/oxlint
npm error   dev oxlint@"~1.74.0" from the root project
npm error
npm error Could not resolve dependency:
npm error peer oxlint@"~1.73.0" from eslint-plugin-oxlint@1.73.0
```

Scaffold ghim `oxlint@~1.74.0` nhưng `eslint-plugin-oxlint@1.73.0` đòi peer `oxlint@~1.73.0`.

Ba cách xử lý:

```bash
# 1. Bỏ qua eslint lúc tạo (khuyến nghị khi đang học)
$ npm create vue@latest taskapp -- --typescript --router --pinia --vitest

# 2. Cài với --legacy-peer-deps (chấp nhận rủi ro nhỏ)
$ npm install --legacy-peer-deps

# 3. Sửa package.json cho khớp rồi cài lại
#    "oxlint": "~1.73.0"
```

Đây là lỗi của scaffold ở thời điểm hiện tại, không phải lỗi của bạn. Kiểm tra lại sau vài tuần.

---

## 3. Cấu trúc project

Toàn bộ file sinh ra (bỏ `node_modules`):

```
taskapp/
├── index.html                 ← điểm vào, chứa <div id="app">
├── package.json
├── vite.config.ts             ← cấu hình Vite + alias @
├── vitest.config.ts           ← cấu hình test
├── tsconfig.json              ← file gốc, chỉ tham chiếu 3 file dưới
├── tsconfig.app.json          ← cho code trong src/
├── tsconfig.node.json         ← cho file cấu hình (vite.config.ts)
├── tsconfig.vitest.json       ← cho test
├── env.d.ts                   ← khai kiểu cho *.vue và biến môi trường
├── public/                    ← file tĩnh, copy nguyên si khi build
└── src/
    ├── main.ts                ← khởi động app, cắm plugin
    ├── App.vue                ← component gốc
    ├── router/index.ts        ← khai route
    ├── stores/counter.ts      ← store Pinia mẫu
    ├── views/                 ← component gắn với một route
    │   ├── HomeView.vue
    │   └── AboutView.vue
    ├── components/            ← component tái dùng
    └── assets/                ← CSS, ảnh (được Vite xử lý)
```

### `views/` khác `components/` chỗ nào?

Chỉ là **quy ước**, Vue không ép:

- `views/` — component gắn với một route, thường có tên kết thúc bằng `View`.
- `components/` — mảnh tái dùng được, không biết gì về route.

Quy ước này giúp nhìn thư mục là biết ứng dụng có bao nhiêu trang.

### `main.ts` — nơi cắm mọi thứ

```ts
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
```

`app.use(...)` cắm plugin. Thứ tự không quan trọng ở đây, nhưng **`mount()` phải gọi cuối cùng**.

Khác Vue 2: không còn `new Vue({...})`, và mỗi `createApp` là một instance độc lập — nhờ vậy nhúng
được nhiều app Vue trên cùng một trang mà không đụng nhau.

### `index.html` là điểm vào thật

```html
<div id="app"></div>
<script type="module" src="/src/main.ts"></script>
```

Khác các bundler cũ: với Vite, `index.html` **không** phải template phụ — nó là điểm vào, và Vite đọc
nó để tìm mã nguồn.

---

## 4. Single File Component (SFC)

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <button @click="count++">Đã bấm {{ count }} lần</button>
</template>

<style scoped>
button {
  padding: 8px 16px;
}
</style>
```

Ba khối, đều tuỳ chọn:

| Khối | Vai trò |
|------|---------|
| `<script setup>` | Logic. Mọi biến khai ở đây **tự động** dùng được trong template |
| `<template>` | Giao diện |
| `<style scoped>` | CSS **chỉ áp cho component này** |

### `<script setup>` tiết kiệm bao nhiêu

Không có nó:

```vue
<script lang="ts">
import { ref, defineComponent } from 'vue'

export default defineComponent({
  setup() {
    const count = ref(0)
    return { count }        // ← phải return thủ công
  },
})
</script>
```

Có nó: bỏ được `export default`, bỏ được `return`. Đây là cách viết chuẩn hiện nay — mọi ví dụ trong
bộ tài liệu này đều dùng nó.

### `scoped` hoạt động thế nào

Vue thêm một thuộc tính duy nhất vào mọi thẻ trong component (`data-v-7ba5bd90`) rồi viết lại CSS
selector kèm thuộc tính đó. Nhờ vậy `button { }` ở file này không ảnh hưởng `button` ở file khác.

⚠️ `scoped` **không** ngăn CSS của cha ảnh hưởng con, và không áp cho nội dung sinh bởi `v-html`.

---

## 5. Lệnh cần thuộc

```bash
$ npm run dev          # server dev, hot reload
$ npm run build        # build production (chạy type-check trước)
$ npm run preview      # xem thử bản build
$ npm run type-check   # chỉ kiểm tra kiểu
$ npm run test:unit    # chạy test
```

Xem `package.json`:

```json
{
  "dev": "vite",
  "build": "run-p type-check \"build-only {@}\" --",
  "preview": "vite preview",
  "test:unit": "vitest",
  "build-only": "vite build",
  "type-check": "vue-tsc --build"
}
```

Chú ý `build` chạy **song song** `type-check` và `build-only`. Nghĩa là build sẽ **đỏ** nếu có lỗi kiểu
— đúng như mong muốn.

Chạy thử:

```bash
$ npm run build
dist/index.html                      0.42 kB │ gzip:  0.28 kB
dist/assets/AboutView-CXtZgaLf.css   0.08 kB │ gzip:  0.10 kB
dist/assets/index-DEm2-gV0.css       4.05 kB │ gzip:  1.27 kB
dist/assets/AboutView-89gx0HCW.js    0.22 kB │ gzip:  0.20 kB
dist/assets/index-Cv5kvEXB.js       99.18 kB │ gzip: 38.37 kB

✓ built in 577ms
```

`AboutView` nằm ở file riêng — đó là **code splitting theo route**, nhờ dòng
`component: () => import('../views/AboutView.vue')` trong router. Người dùng chỉ tải mã của trang họ
thật sự vào.

---

## 6. ⭐ `vue-tsc` — kiểm tra kiểu **bên trong template**

Đây là thứ khiến Vue + TypeScript đáng dùng. `tsc` thường không đọc được file `.vue`; `vue-tsc` thì có.

Viết hai component cố tình sai:

```vue
<!-- Bad.vue -->
<script setup lang="ts">
const props = defineProps<{ count: number }>()
const emit = defineEmits<{ change: [value: number] }>()
</script>

<template>
  <button @click="emit('change', 'khong-phai-so')">{{ props.count.toFixed(2) }}</button>
</template>
```

```vue
<!-- UseBad.vue -->
<script setup lang="ts">
import Bad from './Bad.vue'
</script>

<template>
  <Bad :count="'chuoi'" @change="(v: number) => v" />
</template>
```

```bash
$ npx vue-tsc --noEmit -p tsconfig.app.json
src/lab/Bad.vue(7,34): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/lab/UseBad.vue(6,9): error TS2322: Type 'string' is not assignable to type 'number'.
```

Bắt được cả hai:

1. `emit('change', 'khong-phai-so')` — sai kiểu payload, **lỗi nằm trong template**.
2. `:count="'chuoi'"` — truyền sai kiểu cho prop.

Trình duyệt **không** báo hai lỗi này. Chỉ `vue-tsc` bắt được. Chạy nó trước mỗi lần commit.

### Vì sao có tới 4 file `tsconfig`

```
tsconfig.json           ← chỉ chứa "references", không chứa quy tắc
├── tsconfig.app.json   ← src/, chạy trên trình duyệt (DOM)
├── tsconfig.node.json  ← vite.config.ts, chạy trên Node
└── tsconfig.vitest.json ← test, cần cả DOM lẫn API của Vitest
```

Chúng cần **thư viện khác nhau**: `vite.config.ts` được dùng `process`, còn code trong `src/` thì không.
Tách ra để TypeScript biết đúng ngữ cảnh của từng nhóm file.

### `env.d.ts`

```ts
/// <reference types="vite/client" />
```

Dòng này khai kiểu cho `import.meta.env` và cho việc import CSS/ảnh. Xoá đi rồi chạy `type-check`:

```bash
$ npx vue-tsc --noEmit -p tsconfig.app.json
src/main.ts(1,8): error TS2882: Cannot find module or type declarations for side-effect import of './assets/main.css'.
src/router/index.ts(5,41): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
```

(Import file `.vue` vẫn chạy — phần đó do `vue-tsc` và `@vue/tsconfig` lo, không phải dòng này.)

---

## 7. Vite — vài thứ nên biết ngay

```ts
// vite.config.ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

**Alias `@`** trỏ vào `src/`. Nhờ vậy:

```ts
import TaskItem from '@/components/TaskItem.vue'     // ✅ rõ ràng
import TaskItem from '../../../components/TaskItem.vue'  // ❌ đếm dấu chấm mệt
```

**Biến môi trường** phải bắt đầu bằng `VITE_`:

```ini
# .env
VITE_API_URL=http://localhost:3000/api
SECRET_KEY=khong-lo-ra                 # ← KHÔNG có tiền tố → không vào bundle
```

```ts
const url = import.meta.env.VITE_API_URL
```

⚠️ Mọi biến `VITE_*` **bị nhúng thẳng vào bundle** lúc build — ai xem source cũng thấy. Đừng bao giờ
đặt secret vào đó.

---

## 8. Vue DevTools

Scaffold đã cài sẵn `vite-plugin-vue-devtools`. Chạy `npm run dev` rồi mở trang, sẽ có một nút nổi ở
góc màn hình.

Ba tab dùng nhiều nhất:

| Tab | Xem được gì |
|-----|-------------|
| **Components** | Cây component, props và state của từng cái, **sửa trực tiếp được** |
| **Pinia** | Nội dung store theo thời gian thực |
| **Timeline** | Sự kiện, thay đổi state theo thời gian |

Khi "sửa dữ liệu mà giao diện không đổi", mở tab Components xem giá trị **thật sự** là gì — nhanh hơn
rải `console.log`.

---

## Bài tập

1. Chạy `node -v`. Nếu chưa >= 20.19 thì `nvm use 22`, rồi thử `npx vite build` **không** cài lại
   `node_modules`. Ghi lại lỗi. Sau đó cài lại và thử lần nữa.

2. Tạo project bằng `npm create vue@latest` **có** cờ `--eslint`. Ghi lại nguyên văn lỗi ERESOLVE. Rồi
   tạo lại không có cờ đó.

3. Chạy `npm run build` và đọc output. Vì sao `AboutView` nằm ở file riêng còn `HomeView` thì không?

4. Viết một component nhận prop `count: number`. Ở component cha, truyền vào một chuỗi. Chạy
   `npm run type-check` và ghi lại lỗi. Trình duyệt có báo lỗi đó không?

5. Thêm `VITE_API_URL` và `SECRET_KEY` vào `.env`. In cả hai bằng `import.meta.env` trong một component.
   Cái nào ra `undefined`? Vì sao?

6. Xoá dòng `/// <reference types="vite/client" />` khỏi `env.d.ts` rồi chạy `type-check`. Ghi lại
   **hai** lỗi. Import file `.vue` có hỏng theo không?

7. Mở Vue DevTools, tìm component `HelloWorld` và sửa prop `msg` trực tiếp trong DevTools. Giao diện
   đổi không?

<details>
<summary>Gợi ý đáp án</summary>

**1.** Chưa cài lại `node_modules`:
```
Error: Cannot find module '@rolldown/binding-darwin-universal'
```
Binary gốc được biên dịch theo ABI của Node lúc cài. `nvm use` không sửa được `node_modules` đã có —
phải `rm -rf node_modules package-lock.json && npm install`.

**3.** Vì router khai `component: () => import('../views/AboutView.vue')` — import động, Vite tách
thành chunk riêng. `HomeView` được import tĩnh ở đầu file nên nằm chung bundle chính. Đây là code
splitting theo route: người dùng chỉ tải mã của trang họ vào.

**4.**
```
error TS2322: Type 'string' is not assignable to type 'number'.
```
Trình duyệt **không** báo — nó chỉ chạy JavaScript, còn kiểu đã bị xoá lúc biên dịch. Đây là lý do phải
chạy `type-check` trước khi commit.

**5.** `SECRET_KEY` ra `undefined` vì Vite chỉ đưa biến có tiền tố `VITE_` vào bundle. Đó là cơ chế bảo
vệ có chủ đích — nhưng ngược lại nghĩa là **mọi biến `VITE_*` đều công khai**.

**6.**
```
src/main.ts(1,8): error TS2882: Cannot find module or type declarations for side-effect import of './assets/main.css'.
src/router/index.ts(5,41): error TS2339: Property 'env' does not exist on type 'ImportMeta'.
```
Import `.vue` **không** hỏng — phần đó do `vue-tsc` xử lý. Dòng reference chỉ lo `import.meta.env` và
import tài nguyên (CSS, ảnh).

</details>

---

Tiếp theo: [01-template-va-binding.md](./01-template-va-binding.md)
