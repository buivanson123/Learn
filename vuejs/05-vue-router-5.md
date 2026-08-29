# Bài 05 — vue-router 5

Router quyết định URL nào hiện component nào. Bài này dùng **vue-router 5.2** — bản major mới, ra
khoảng tháng 4/2026.

```bash
$ npm view vue-router dist-tags
{ latest: '5.2.0', legacy: '3.6.5', next: '4.0.13', beta: '5.0.0-beta.2' }
```

Tin tốt: **API cơ bản không đổi so với bản 4**. Code `createRouter`/`useRoute`/`useRouter` bạn thấy trên
mạng vẫn dùng được. Bản 5 chủ yếu thêm tính năng mới (mục 9).

Mọi hành vi dưới đây kiểm chứng bằng 5 test chạy thật.

---

## 1. Khai route

```ts
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),   // ← lazy load
    },
  ],
})

export default router
```

```ts
// main.ts
app.use(router)
```

### Ba kiểu history

| Hàm | URL | Cần cấu hình server |
|-----|-----|--------------------|
| `createWebHistory()` | `/tasks/1` | ✅ phải rewrite về `index.html` |
| `createWebHashHistory()` | `/#/tasks/1` | ❌ chạy ngay |
| `createMemoryHistory()` | (không đổi URL) | Dùng cho test/SSR |

⚠️ Dùng `createWebHistory` mà không cấu hình server thì **F5 ở trang con sẽ ra 404** — server đi tìm
file `/tasks/1` không có thật. Xem [bài 09 lỗi 12](./09-loi-thuong-gap.md).

---

## 2. `<RouterLink>` và `<RouterView>`

```vue
<!-- App.vue -->
<template>
  <nav>
    <RouterLink to="/">Trang chủ</RouterLink>
    <RouterLink :to="{ name: 'detail', params: { id: 42 } }">Chi tiết</RouterLink>
  </nav>

  <RouterView />
</template>
```

⚠️ Dùng `<RouterLink>`, **đừng dùng `<a href>`** — thẻ `a` làm trình duyệt tải lại cả trang, mất hết
state và mất luôn lợi ích của SPA.

`<RouterLink>` tự thêm class `router-link-active` và `router-link-exact-active` — dùng để tô sáng menu:

```vue
<style scoped>
.router-link-exact-active { font-weight: bold; }
</style>
```

---

## 3. Route động và params

```ts
{ path: '/tasks/:id', name: 'detail', component: DetailView, props: true }
```

Test:

```ts
await r.push({ name: 'detail', params: { id: '42' } })
expect(r.currentRoute.value.path).toBe('/tasks/42')       // ✅
expect(r.currentRoute.value.params.id).toBe('42')         // ✅
```

### ⭐ `props: true` — cách nên dùng

```vue
<!-- ❌ component phụ thuộc router -->
<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const id = route.params.id
</script>

<!-- ✅ component nhận props như bình thường -->
<script setup lang="ts">
const props = defineProps<{ id: string }>()
</script>
```

Cách thứ hai khiến component **test được mà không cần dựng router**, và tái dùng được ở nơi không có
route. Đây là khác biệt lớn về chất lượng code.

### ⚠️ `params` luôn là **chuỗi**

```ts
expect(r.currentRoute.value.params.id).toBe('42')    // chuỗi, không phải số
```

`route.params.id` không bao giờ là số, kể cả URL là `/tasks/42`. Ép kiểu ở biên:

```ts
const props = defineProps<{ id: string }>()
const taskId = computed(() => Number(props.id))
```

### Các dạng path

```ts
'/tasks/:id'                    // bắt buộc
'/tasks/:id?'                   // tuỳ chọn
'/tasks/:id(\\d+)'              // chỉ khớp số
'/files/:path(.*)'              // khớp cả dấu /
'/:pathMatch(.*)*'              // catch-all → trang 404
```

---

## 4. Query string

```ts
await r.push({ path: '/', query: { q: 'vue', page: '2' } })
expect(r.currentRoute.value.query).toEqual({ q: 'vue', page: '2' })   // ✅
```

```vue
<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const q = computed(() => (route.query.q as string) ?? '')

function search(value: string) {
  router.push({ query: { ...route.query, q: value, page: '1' } })
}
</script>
```

Lợi ích của việc để bộ lọc trong query: người dùng **copy URL gửi cho người khác** là ra đúng kết quả
đó, và nút Back của trình duyệt hoạt động đúng.

⚠️ `route.query` cũng luôn là chuỗi (hoặc mảng chuỗi).

### `useRoute` vs `useRouter`

| | Dùng để |
|---|---|
| `useRoute()` | **Đọc** route hiện tại — `params`, `query`, `meta`, `path` |
| `useRouter()` | **Điều hướng** — `push`, `replace`, `back`, `go` |

Nhớ mẹo: `route` = danh từ (nơi đang ở), `router` = công cụ (đưa bạn đi).

---

## 5. Điều hướng bằng code

```ts
router.push('/tasks')
router.push({ name: 'detail', params: { id: 42 } })     // ✅ nên dùng name
router.push({ path: '/tasks', query: { page: '2' } })
router.replace('/login')      // không thêm vào lịch sử
router.back()
router.go(-2)
```

⭐ **Ưu tiên `name` hơn `path`.** Đổi `/tasks/:id` thành `/cong-viec/:id` chỉ sửa một chỗ trong file
router; mọi `push({ name: 'detail' })` tự đúng theo.

Gõ sai tên route thì nổ ngay, không âm thầm ra link hỏng:

```
Error: No match for {"name":"khong-co"}
```

---

## 6. ⭐ Navigation guard — bảo vệ route

```ts
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !isLoggedIn()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})
```

Test:

```ts
r.beforeEach((to) => {
  if (to.meta.requiresAuth) return { name: 'login' }
  return true
})
await r.push('/admin')
expect(r.currentRoute.value.name).toBe('login')      // ✅ đã bị chặn
```

Guard trả về:

| Trả về | Nghĩa |
|--------|-------|
| `true` / không trả gì | Cho đi tiếp |
| `false` | Huỷ điều hướng |
| `{ name: 'login' }` | Chuyển hướng |

> Bản 4 trở đi dùng **giá trị trả về**, không dùng `next()` nữa. Code cũ dùng `next()` vẫn chạy nhưng
> đừng viết mới theo kiểu đó — dễ quên gọi và bị treo điều hướng.

### `meta` — gắn thông tin vào route

```ts
{ path: '/admin', component: AdminView, meta: { requiresAuth: true, title: 'Quản trị' } }
```

Test xác nhận đọc được trong guard:

```ts
r.beforeEach((to) => { seen.push(to.meta.requiresAuth); return true })
await r.push('/admin')
expect(seen).toContain(true)      // ✅
```

Khai kiểu cho `meta`:

```ts
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    title?: string
  }
}
```

Từ đó `to.meta.requiresAuth` có kiểu, gõ sai tên là báo lỗi.

### Các loại guard

```ts
router.beforeEach((to, from) => {})       // toàn cục, trước mỗi lần
router.afterEach((to, from) => {})        // sau khi xong (đặt title, gửi analytics)

// trong route
{ path: '/admin', beforeEnter: (to) => { /* ... */ } }
```

```vue
<!-- trong component -->
<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'

onBeforeRouteLeave(() => {
  if (hasUnsavedChanges.value) {
    return confirm('Bạn có thay đổi chưa lưu. Rời đi?')
  }
})
</script>
```

`onBeforeRouteLeave` là cách chuẩn để chặn rời trang khi form đang dở.

---

## 7. Route lồng nhau và layout

```ts
{
  path: '/tasks',
  component: TasksLayout,
  children: [
    { path: '', name: 'tasks', component: TaskList },
    { path: ':id', name: 'detail', component: TaskDetail, props: true },
  ],
}
```

```vue
<!-- TasksLayout.vue -->
<template>
  <aside>Menu bên</aside>
  <main><RouterView /></main>   <!-- ← con render ở đây -->
</template>
```

Đây là cách làm layout trong Vue: một component cha có `<RouterView>` bên trong.

---

## 8. Catch-all — trang 404

```ts
{ path: '/:pathMatch(.*)*', name: 'notfound', component: NotFoundView }
```

Test:

```ts
await r.push('/khong-co-dau')
expect(r.currentRoute.value.name).toBe('notfound')   // ✅
```

⚠️ Phải đặt **cuối cùng** trong mảng `routes`.

---

## 9. Có gì mới ở vue-router 5

Bản 5 gộp `unplugin-vue-router` vào lõi — nghĩa là **routing theo file** và **typed routes** giờ có sẵn:

```bash
$ node -e "console.log(Object.keys(require('vue-router/package.json').exports).join('\n'))"
.
./experimental
./experimental/pinia-colada
./auto-resolver
./auto-routes
./auto
./vite
./unplugin
./volar/sfc-typed-router
```

```ts
// vite.config.ts
import VueRouter from 'vue-router/vite'

export default defineConfig({
  plugins: [VueRouter(), vue()],    // ⚠️ VueRouter() phải đứng TRƯỚC vue()
})
```

Khi đó `src/pages/tasks/[id].vue` tự thành route `/tasks/:id` — giống cách Next.js làm.

**Với người mới học thì chưa cần.** Khai route thủ công dễ hiểu hơn và bạn thấy rõ chuyện gì đang xảy
ra. Biết là có để sau này dùng.

---

## 10. Lazy load — và vì sao nó quan trọng

```ts
component: () => import('../views/AboutView.vue')
```

Kiểm chứng bằng output build thật:

```bash
$ npm run build
dist/assets/AboutView-89gx0HCW.js    0.22 kB │ gzip:  0.20 kB
dist/assets/index-Cv5kvEXB.js       99.18 kB │ gzip: 38.37 kB
```

`AboutView` nằm ở **file riêng** — chỉ tải khi người dùng vào trang đó. `HomeView` import tĩnh nên nằm
trong bundle chính.

**Quy tắc:** trang đầu tiên import tĩnh (cần ngay), mọi trang còn lại lazy load.

---

## 11. So với Next.js

Nếu bạn đã học [Next.js](../nextjs/README.md):

| Việc | vue-router | Next.js App Router |
|------|-----------|--------------------|
| Khai route | Thủ công trong mảng `routes` | Theo cấu trúc thư mục |
| Route động | `/tasks/:id` | `app/tasks/[id]/page.tsx` |
| Layout | Route lồng + `<RouterView>` | `layout.tsx` |
| Chặn route | `beforeEach` | `proxy.ts` + kiểm tra trong page |
| Lazy load | `() => import()` | Tự động |
| Đọc params | `route.params.id` | `await params` (Next 16) |
| 404 | Catch-all route | `not-found.tsx` |

Khác biệt lớn nhất: Next.js render trên server nên có SEO và data fetching ở server; Vue + vue-router
là **SPA thuần** — mọi thứ chạy trên trình duyệt. Cần SSR/SEO thì dùng Nuxt.

---

## Bài tập

1. Khai 3 route: `/`, `/tasks/:id` (có `props: true`), và catch-all 404. Kiểm tra cả ba bằng cách gõ URL.

2. Trong `TaskDetail`, đọc id bằng `useRoute()` rồi đổi sang nhận qua `props`. Viết test mount component
   — cách nào test được mà không cần router?

3. In `typeof route.params.id` khi URL là `/tasks/42`. Ra gì? Sửa cho đúng kiểu số.

4. Thêm `meta: { requiresAuth: true }` và một `beforeEach` chặn khi chưa đăng nhập. Thử vào route đó và
   xác nhận bị chuyển sang `/login` kèm `?redirect=`.

5. Dùng `<a href="/about">` thay `<RouterLink>`. Quan sát tab Network khi bấm. Khác gì?

6. Đặt catch-all **đầu tiên** trong mảng `routes`. Chuyện gì xảy ra với các route khác?

7. Chạy `npm run build` với một route import tĩnh và một route lazy load. So sánh số file trong `dist/assets`.

8. Viết `onBeforeRouteLeave` chặn rời trang khi form đang dở. Thử bấm Back của trình duyệt.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Với `props: true`, component chỉ nhận `id` như prop thường nên `mount(TaskDetail, { props: { id: '1' } })`
là xong. Dùng `useRoute()` thì phải cài router giả vào test — phức tạp hơn nhiều và làm component gắn
chặt với router.

**3.** `"string"`. `route.params` **luôn** là chuỗi. Sửa: `const id = computed(() => Number(props.id))`.

**5.** `<a href>` làm trình duyệt **tải lại toàn bộ trang** — Network hiện request document mới, mọi
state trong bộ nhớ mất sạch. `<RouterLink>` chỉ đổi component, không có request nào.

**6.** Catch-all khớp **mọi** URL, nên nó nuốt hết — mọi đường dẫn đều ra trang 404. Router khớp theo
thứ tự khai.

</details>

---

Tiếp theo: [06-pinia-4.md](./06-pinia-4.md)
