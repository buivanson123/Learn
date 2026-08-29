# Bài 10 — Cheatsheet

Tra cứu nhanh. Đúng cho **Vue 3.5 + vue-router 5 + Pinia 4 + Vite 8**.

---

## 1. ⚠️ Môi trường

```bash
$ nvm use 22            # Vite 8 cần Node ^20.19.0 || >=22.12.0
$ node -v
v22.23.2
```

Đổi Node xong **phải** cài lại:

```bash
$ rm -rf node_modules package-lock.json && npm install
```

```bash
$ npm create vue@latest myapp -- --typescript --router --pinia --vitest
# ⚠️ đừng thêm --eslint (xung đột oxlint peer)
```

| Lệnh | Việc |
|------|------|
| `npm run dev` | Server dev |
| `npm run build` | Build (chạy `type-check` song song) |
| `npm run preview` | Xem thử bản build |
| `npm run type-check` | Chỉ kiểm tra kiểu |
| `npm run test:unit` | Chạy test |

---

## 2. ⭐ Vue 2 → Vue 3 (code trên mạng hay sai)

| Việc | Vue 2 / Options API | Vue 3 `<script setup>` |
|------|---------------------|------------------------|
| State | `data() { return { n: 0 } }` | `const n = ref(0)` |
| Giá trị dẫn xuất | `computed: { x() {} }` | `const x = computed(() => ...)` |
| Theo dõi | `watch: { n(v) {} }` | `watch(n, (v) => {})` |
| Method | `methods: { f() {} }` | `function f() {}` |
| Mounted | `mounted() {}` | `onMounted(() => {})` |
| Props | `props: ['x']` | `defineProps<{ x: string }>()` |
| Emit | `this.$emit('e')` | `const emit = defineEmits<...>()` |
| Đăng ký component | `components: { X }` | chỉ cần `import X` |
| Khởi động app | `new Vue({...})` | `createApp(App).mount('#app')` |
| Nhiều thẻ gốc | ❌ | ✅ |
| Store | Vuex + mutations | Pinia, **không** mutations |
| Filter | `{{ x \| upper }}` | **đã bỏ** — dùng computed/method |
| Event bus | `$on`/`$emit` global | **đã bỏ** — dùng Pinia hoặc mitt |
| `.sync` | `:x.sync="y"` | `v-model:x="y"` |

---

## 3. Reactivity

```ts
import { ref, reactive, computed, watch, watchEffect, toRefs, toRef, nextTick } from 'vue'

const n = ref(0)                    // ⭐ dùng cho MỌI thứ
n.value++                            // trong <script> cần .value
                                     // trong <template> KHÔNG cần

const state = reactive({ a: 1 })     // chỉ object, có 3 hạn chế
const { a } = toRefs(state)          // giữ reactivity khi destructure

const double = computed(() => n.value * 2)        // CÓ CACHE
const rw = computed({ get: () => x, set: v => {} })

watch(n, (moi, cu) => {})
watch(n, fn, { immediate: true, deep: true })
watch(() => obj.a, fn)               // ⭐ getter — chính xác, rẻ
watch([a, b], ([a1, b1], [a0, b0]) => {})
watch(x, (v, _o, onCleanup) => { onCleanup(() => abort()) })

watchEffect(() => { console.log(n.value) })       // chạy NGAY, tự tìm phụ thuộc

await nextTick()                     // chờ DOM cập nhật
```

### 7 cái bẫy

| # | Bẫy | Sửa |
|---|-----|-----|
| 1 | Quên `.value` → `[object Object]` | Thêm `.value`; dùng TS |
| 2 | Destructure `reactive` → mất reactivity | `toRefs()` hoặc `ref` |
| 3 | Gán lại object cho `reactive` | Dùng `ref` |
| 4 | `ref` trong **array** không unwrap | `ref` cho cả mảng |
| 5 | `watch` ref object không bắt sửa bên trong | `deep: true` / watch getter |
| 6 | Tác dụng phụ trong `computed` | Chuyển sang `watch` |
| 7 | Đọc DOM ngay sau khi sửa state | `await nextTick()` |

### `computed` vs `watch` vs `watchEffect`

| | Dùng khi | Chạy ngay | Có giá trị cũ |
|---|---|---|---|
| `computed` | Cần **giá trị** dẫn xuất | — | — |
| `watch` | Cần **làm gì đó** khi đổi | ❌ | ✅ |
| `watchEffect` | Đồng bộ nhiều thứ | ✅ | ❌ |

---

## 4. Template

```vue
{{ msg }}                    <!-- escape HTML -->
<p v-html="html">            <!-- KHÔNG escape — cẩn thận XSS -->

:title="x"  :class="cls"  :style="st"       <!-- v-bind -->
:class="{ active: isOn }"  :class="[a, b]"
v-bind="attrsObject"

v-if / v-else-if / v-else    <!-- XOÁ khỏi DOM -->
v-show                        <!-- chỉ display: none -->

v-for="(it, i) in items" :key="it.id"       <!-- ⭐ key BẮT BUỘC -->
v-for="(v, k) in obj"  v-for="n in 10"
<!-- ❌ KHÔNG đặt v-if cùng thẻ với v-for -->

@click="f"  @click="f($event, id)"
@submit.prevent  @click.stop  @click.self  @click.once
@keyup.enter  @keyup.esc  @keydown.ctrl.s.prevent

v-model="x"
v-model.trim  v-model.number  v-model.lazy   <!-- ⭐ .number cho ô số -->

v-once  v-pre  v-cloak  v-text
```

---

## 5. Component

```vue
<script setup lang="ts">
// props
const props = defineProps<{ task: Task; hi?: boolean }>()
const props = withDefaults(defineProps<{ hi?: boolean }>(), { hi: false })

// emit
const emit = defineEmits<{ toggle: [id: number]; remove: [id: number] }>()
emit('toggle', 1)

// v-model (Vue 3.4+)
const model = defineModel<string>({ default: '' })
const first = defineModel<string>('first')      // v-model:first

// mở API cho cha
defineExpose({ show, hide })

// cấu hình
defineOptions({ inheritAttrs: false })
</script>
```

```vue
<!-- slot -->
<slot />                                  <!-- mặc định -->
<slot name="header">fallback</slot>       <!-- có tên + fallback -->
<slot name="row" :item="x" />             <!-- scoped -->
```

```vue
<!-- dùng slot -->
<Card>
  <template #header>...</template>
  <template #row="{ item }">{{ item.name }}</template>
</Card>
```

```ts
// provide / inject
provide('key', value)
const v = inject<T>('key')
const v = inject('key', 'mặc định')

// có kiểu
const key = Symbol() as InjectionKey<Ref<string>>
```

```vue
<component :is="X" />
<KeepAlive><component :is="tab" /></KeepAlive>
```

### Luồng dữ liệu

```
Cha  --props-->  Con
Cha  <--emit--   Con
Cha  --slot-->   Con  (truyền giao diện)
Cha  <--scoped slot--  Con  (con đưa dữ liệu lên)
```

⚠️ Props **readonly ở tầng ngoài cùng**. Sửa lồng (`props.task.title = x`) **không cảnh báo** nhưng vẫn
sai — luôn `emit`.

---

## 6. Vòng đời và composable

```ts
onBeforeMount / onMounted / onBeforeUpdate / onUpdated
onBeforeUnmount / onUnmounted / onErrorCaptured
onActivated / onDeactivated        // với <KeepAlive>
```

```ts
// composable
export function useX(param: MaybeRefOrGetter<string>) {
  const state = ref(0)
  const v = toValue(param)                     // nhận ref/getter/giá trị
  onMounted(() => { /* ... */ })
  onUnmounted(() => { /* ⚠️ dọn dẹp */ })
  return { state }                              // ⭐ trả ref, KHÔNG trả .value
}
```

**Ba quy tắc:** gọi ở cấp cao nhất của `setup` · trả `ref` · dùng `toValue` cho tham số.

```ts
// template ref (Vue 3.5)
const input = useTemplateRef<HTMLInputElement>('search')
onMounted(() => input.value?.focus())
```

```vue
<input ref="search" />
```

### Composable vs Pinia vs provide/inject

| Cần | Dùng |
|-----|------|
| Logic tái dùng, state **riêng mỗi nơi gọi** | Composable |
| State **dùng chung toàn app** | Pinia |
| Truyền xuống một cây component | `provide`/`inject` |

---

## 7. vue-router 5

```ts
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/tasks/:id', name: 'detail', component: Detail, props: true },   // ⭐ props: true
    { path: '/admin', component: Admin, meta: { requiresAuth: true } },
    {
      path: '/tasks',
      component: Layout,
      children: [{ path: '', component: List }],       // route lồng
    },
    { path: '/:pathMatch(.*)*', component: NotFound },  // ⭐ đặt CUỐI
  ],
})
```

```ts
// guard
router.beforeEach((to, from) => {
  if (to.meta.requiresAuth && !ok) return { name: 'login', query: { redirect: to.fullPath } }
  return true                    // true | false | { name: 'x' }
})
router.afterEach((to) => { document.title = to.meta.title })
```

```vue
<script setup>
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
const route = useRoute()      // ĐỌC: params, query, meta
const router = useRouter()    // ĐIỀU HƯỚNG: push, replace, back

router.push({ name: 'detail', params: { id: 42 } })    // ⭐ dùng name
router.replace('/login')

onBeforeRouteLeave(() => confirm('Rời trang?'))
</script>

<template>
  <RouterLink :to="{ name: 'home' }">Trang chủ</RouterLink>   <!-- KHÔNG dùng <a> -->
  <RouterView />
</template>
```

```ts
// lazy load — tách chunk riêng
component: () => import('../views/AboutView.vue')
```

⚠️ `route.params` và `route.query` **luôn là chuỗi**.
⚠️ `createWebHistory` cần server rewrite về `index.html`, nếu không F5 ra 404.

---

## 8. Pinia 4

```ts
export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])                              // state
  const remaining = computed(() => items.value.length)       // getter
  function add(t: string) { items.value.push(...) }          // action

  return { items, remaining, add }        // ⭐ PHẢI return
})
```

```ts
// trong component
const store = useTasksStore()
const { items, remaining } = storeToRefs(store)   // ⭐ state + getters
const { add, toggle } = store                      // actions lấy thẳng

store.$patch({ a: 1, b: 2 })
store.$patch((s) => { s.items.push(x) })
store.$subscribe((m, s) => localStorage.setItem('k', JSON.stringify(s)))
```

⚠️ `$reset()` **không** dùng được với setup store — tự viết action.

```ts
// test
beforeEach(() => setActivePinia(createPinia()))    // ⚠️ BẮT BUỘC
```

---

## 9. Form và API

```vue
<form @submit.prevent="onSubmit" novalidate>       <!-- ⭐ .prevent -->
  <input v-model.trim="title" @blur="touched = true" />
  <input type="number" v-model.number="n" />        <!-- ⭐ .number -->
  <p v-if="touched && error">{{ error }}</p>
</form>
```

```ts
// mẫu gọi API
const data = ref<T | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function run() {
  loading.value = true
  error.value = null
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)   // ⭐ fetch KHÔNG tự ném
    data.value = Schema.parse(await res.json())          // validate ở biên
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lỗi'
  } finally {
    loading.value = false                                 // ⭐ finally
  }
}
```

**Bốn trạng thái giao diện:** loading → error → có dữ liệu → **rỗng**.

```ts
// chống race condition
watch(query, async (q, _o, onCleanup) => {
  const c = new AbortController()
  onCleanup(() => c.abort())
  await fetch(url, { signal: c.signal })
})
```

---

## 10. Test

```ts
import { mount } from '@vue/test-utils'

const w = mount(Comp, { props: { x: 1 }, slots: { default: 'a' } })

w.text()  w.html()  w.classes()  w.props('x')
w.get('.sel')  w.find('.sel').exists()  w.findAll('.sel')
await w.get('input').setValue('x')
await w.get('button').trigger('click')
await w.get('form').trigger('submit')
w.emitted('toggle')            // [[1]]
await w.setProps({ x: 2 })
```

```ts
// store
beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()) })
```

⚠️ Vitest **không kiểm tra kiểu**. Test xanh ≠ build xanh → chạy `npm run type-check`.

---

## 11. Vue vs React

| Việc | Vue | React |
|------|-----|-------|
| State | `ref(0)` → `n.value++` | `useState(0)` → `setN(n+1)` |
| Dẫn xuất | `computed(() => ...)` | `useMemo(..., [deps])` |
| Phản ứng | `watch(x, fn)` | `useEffect(fn, [x])` |
| Khai phụ thuộc | **Không cần** | Bắt buộc |
| Điều kiện | `v-if` / `v-show` | `{cond && <X/>}` |
| Lặp | `v-for` + `:key` | `.map()` + `key` |
| Hai chiều | `v-model` | tự viết `value` + `onChange` |
| Sự kiện lên trên | `emit` | callback prop |
| Truyền giao diện | slot | `children` / render prop |
| Xuyên tầng | `provide`/`inject` | Context |
| State toàn cục | Pinia | Redux / Zustand |
| CSS cục bộ | `<style scoped>` | CSS Modules |
| Render lại | Chỉ phần phụ thuộc đổi | Cả cây component |

---

## 12. Tra nhanh theo triệu chứng

| Triệu chứng | Nghi ngờ |
|-------------|----------|
| `[object Object]` | Quên `.value` |
| Sửa dữ liệu, giao diện đứng yên | Destructure `reactive`/store |
| Bấm nút lọc không ăn | Thiếu `storeToRefs` |
| Không lưu localStorage | `watch` thiếu `deep: true` |
| Input nhảy sang hàng khác | `:key` thiếu/trùng |
| `focus()` không tác dụng | Thiếu `await nextTick()` |
| F5 ra 404 | Server chưa rewrite `index.html` |
| Build đỏ, test xanh | Chạy `type-check` |
| Spinner quay mãi | `loading = false` không ở `finally` |
| `fetch` không vào `catch` | Phải kiểm `res.ok` |

Chi tiết ở [09-loi-thuong-gap.md](./09-loi-thuong-gap.md).

---

Quay lại [README](./README.md) · [Luyện phỏng vấn](./phong-van/README.md)
