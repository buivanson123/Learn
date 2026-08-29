# Bài 04 — Vòng đời và Composable

Composable là cách Vue tái dùng **logic** (không phải giao diện). Nó là lý do chính khiến Composition
API tồn tại.

---

## 1. Vòng đời component

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, onUpdated, onBeforeMount } from 'vue'

onBeforeMount(() => { /* trước khi gắn vào DOM */ })
onMounted(() => { /* DOM đã sẵn sàng — gọi API, đo kích thước, đăng ký sự kiện */ })
onUpdated(() => { /* sau mỗi lần render lại */ })
onUnmounted(() => { /* dọn dẹp: huỷ timer, gỡ listener */ })
</script>
```

Thứ tự khi component xuất hiện rồi biến mất:

```
setup()            ← thân <script setup> chạy ở đây
  ↓
onBeforeMount
  ↓
  *** DOM được tạo ***
  ↓
onMounted          ← từ đây mới truy cập được DOM
  ↓
(state đổi) → onBeforeUpdate → render lại → onUpdated
  ↓
onBeforeUnmount
  ↓
onUnmounted        ← dọn dẹp ở đây
```

### Hai hook dùng nhiều nhất

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const width = ref(0)

function onResize() { width.value = window.innerWidth }

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)   // ⚠️ BẮT BUỘC
})
</script>
```

⚠️ **Không gỡ listener trong `onUnmounted` là rò rỉ bộ nhớ.** Người dùng chuyển trang qua lại 20 lần
thì có 20 listener còn sống, mỗi cái giữ tham chiếu tới component đã chết.

Cùng nguyên tắc với `setInterval`, `WebSocket`, `IntersectionObserver`, và subscription.

### `onErrorCaptured`

```vue
<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err as Error
  return false        // chặn lỗi lan lên trên
})
</script>
```

Dùng để làm "error boundary" — bọc một nhánh component để lỗi ở đó không làm sập cả trang.

---

## 2. Composable — tái dùng logic

Composable là **một hàm thường** bắt đầu bằng `use`, dùng được API reactivity của Vue.

```ts
// composables/useLocalStorage.ts
import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, initial: T): Ref<T> {
  const stored = localStorage.getItem(key)
  const data = ref<T>(stored ? JSON.parse(stored) : initial) as Ref<T>

  watch(data, (v) => {
    localStorage.setItem(key, JSON.stringify(v))
  }, { deep: true })

  return data
}
```

```vue
<script setup lang="ts">
import { useLocalStorage } from '@/composables/useLocalStorage'

const tasks = useLocalStorage<Task[]>('tasks', [])
// dùng như ref bình thường — và tự lưu vào localStorage
</script>
```

Đây chính là composable dùng trong [dự án bài 08](./08-du-an-task-app.md).

### Composable có state riêng cho từng component

```ts
export function useCounter(start = 0) {
  const count = ref(start)
  function inc() { count.value++ }
  return { count, inc }
}
```

```vue
<script setup>
const a = useCounter()
const b = useCounter(10)     // ← state HOÀN TOÀN riêng
</script>
```

Mỗi lần gọi tạo một bộ state mới. Khác với Pinia — store là **một bản dùng chung** cho toàn ứng dụng.

### Composable dùng được vòng đời

```ts
export function useMouse() {
  const x = ref(0), y = ref(0)

  function update(e: MouseEvent) { x.value = e.clientX; y.value = e.clientY }

  onMounted(() => window.addEventListener('mousemove', update))
  onUnmounted(() => window.removeEventListener('mousemove', update))

  return { x, y }
}
```

Composable tự lo phần dọn dẹp — component dùng nó không cần biết gì.

### ⚠️ Ba quy tắc

**1. Gọi ở cấp cao nhất của `setup`.**

```ts
// ❌ trong if / vòng lặp / callback
if (cond) { const { x } = useMouse() }

// ✅
const { x } = useMouse()
```

Vì `onMounted` bên trong cần biết nó thuộc component nào — Vue xác định điều đó theo *component đang
được thiết lập*, và ngoài `setup` thì không còn context đó.

**2. Trả về `ref`, đừng trả giá trị thường.**

```ts
// ❌ mất reactivity
export function useCounter() {
  const count = ref(0)
  return { count: count.value }
}

// ✅
return { count }
```

Đây chính là [bẫy 2 của bài 02](./02-reactivity.md) ở dạng khác.

**3. Nhận `ref` làm tham số thì dùng `toValue`.**

```ts
import { toValue, type MaybeRefOrGetter } from 'vue'

export function useSearch(query: MaybeRefOrGetter<string>) {
  watchEffect(() => {
    const q = toValue(query)     // nhận được cả ref, getter, lẫn giá trị thường
    // ...
  })
}
```

Nhờ vậy composable dùng được cả `useSearch(myRef)`, `useSearch(() => x.value)` và `useSearch('abc')`.

---

## 3. Composable vs Pinia vs provide/inject

| Cần | Dùng |
|-----|------|
| Logic tái dùng, **state riêng mỗi nơi gọi** | Composable |
| State **dùng chung toàn ứng dụng** | Pinia ([bài 06](./06-pinia-4.md)) |
| Truyền xuống một cây component | `provide`/`inject` |

Ví dụ cụ thể:

- `useLocalStorage`, `useMouse`, `useDebounce` → composable.
- Giỏ hàng, người dùng đăng nhập, danh sách công việc dùng chung → Pinia.
- Theme cho một nhánh giao diện → `provide`/`inject`.

> Composable **có thể** tạo state dùng chung nếu bạn khai `ref` **ngoài** hàm. Nhưng lúc đó bạn đang tự
> viết một Pinia thiếu DevTools và thiếu hỗ trợ SSR — dùng Pinia thẳng thì hơn.

---

## 4. VueUse — đừng viết lại thứ đã có

```bash
$ npm i @vueuse/core
```

[VueUse](https://vueuse.org) có hơn 200 composable đã kiểm thử kỹ:

```ts
import { useLocalStorage, useDebounce, useMouse, useFetch, useDark } from '@vueuse/core'

const tasks = useLocalStorage('tasks', [])
const debounced = useDebounce(query, 300)
const { x, y } = useMouse()
const isDark = useDark()
```

Vài cái hay dùng nhất:

| Composable | Việc |
|-----------|------|
| `useLocalStorage` | Đồng bộ ref với localStorage |
| `useDebounce` / `useThrottle` | Giảm tần suất |
| `useFetch` | Gọi API kèm loading/error |
| `useDark` | Chế độ tối |
| `useIntersectionObserver` | Lazy load, infinite scroll |
| `useEventListener` | Tự gỡ listener khi unmount |
| `onClickOutside` | Đóng dropdown/modal |

Bài này vẫn dạy bạn **tự viết** `useLocalStorage` — hiểu cơ chế rồi mới nên dùng thư viện.

---

## 5. Template ref — truy cập DOM

```vue
<script setup lang="ts">
import { useTemplateRef, onMounted } from 'vue'

const input = useTemplateRef<HTMLInputElement>('search')

onMounted(() => {
  input.value?.focus()
})
</script>

<template>
  <input ref="search" />
</template>
```

`useTemplateRef` là API của **Vue 3.5**. Trước đó phải:

```ts
const search = ref<HTMLInputElement | null>(null)   // tên biến PHẢI trùng ref="search"
```

⚠️ Trong `onMounted` mới có DOM. Đọc `input.value` trong thân `setup` sẽ ra `null`.

Cần focus vào phần tử **vừa mới hiện ra** thì phải chờ DOM cập nhật:

```ts
show.value = true
await nextTick()
input.value?.focus()
```

---

## 6. `<Suspense>` và component bất đồng bộ

```vue
<Suspense>
  <template #default>
    <TaskList />          <!-- component có async setup -->
  </template>
  <template #fallback>
    <p>Đang tải...</p>
  </template>
</Suspense>
```

```vue
<!-- TaskList.vue -->
<script setup lang="ts">
const tasks = await fetchTasks()      // await ở cấp cao nhất
</script>
```

⚠️ `<Suspense>` vẫn là **tính năng thử nghiệm**. Với ứng dụng thường, quản lý `loading`/`error` thủ công
rõ ràng hơn — xem [bài 07](./07-form-va-goi-api.md).

---

## 7. Lazy load component

```vue
<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const HeavyChart = defineAsyncComponent(() => import('./HeavyChart.vue'))
</script>
```

Component chỉ được tải khi thật sự cần render. Dùng cho: biểu đồ, trình soạn thảo, modal ít mở.

Với route thì dùng lazy load của router — xem [bài 05](./05-vue-router-5.md).

---

## Bài tập

1. Viết component đăng ký `window.addEventListener('resize')` trong `onMounted` nhưng **không** gỡ
   trong `onUnmounted`. Chuyển trang qua lại vài lần rồi resize cửa sổ — quan sát `console.log` chạy
   mấy lần.

2. Viết `useLocalStorage` theo mục 2. Dùng nó cho một danh sách, thêm vài mục, tải lại trang. Dữ liệu
   còn không?

3. Bỏ `{ deep: true }` khỏi `watch` trong `useLocalStorage`, rồi `push` một mục vào mảng. Có lưu không?
   Vì sao?

4. Viết `useCounter` rồi gọi hai lần trong cùng component. Hai bộ đếm có độc lập không?

5. Viết một composable trả về `{ count: count.value }` thay vì `{ count }`. Giao diện có cập nhật không?
   Giải thích.

6. Dùng `useTemplateRef` để focus vào input khi component mount. Rồi thử đọc `input.value` ngay trong
   thân `setup` — ra gì?

7. Cài `@vueuse/core`, thay `useLocalStorage` tự viết bằng bản của VueUse. So sánh số dòng code.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Listener tích tụ — mỗi lần vào trang lại thêm một cái, và cái cũ không bao giờ bị gỡ. Resize một
lần thì callback chạy nhiều lần. Đây là rò rỉ bộ nhớ điển hình.

**3.** **Không lưu.** `push` sửa bên trong mảng nên tham chiếu không đổi — `watch` trên `ref` của object
không bắt được ([bẫy 5, bài 02](./02-reactivity.md)). Cần `deep: true`.

**4.** Có, hoàn toàn độc lập. Mỗi lần gọi composable tạo một `ref` mới. Đây là khác biệt cốt lõi với
Pinia store (một bản dùng chung).

**5.** Không cập nhật. `count.value` trả về **giá trị tại thời điểm đó**, cắt đứt liên kết reactive.
Phải trả chính `ref`.

**6.** Trong `setup` ra `null` — DOM chưa tồn tại. Chỉ trong `onMounted` (hoặc sau `await nextTick()`)
mới có.

</details>

---

Tiếp theo: [05-vue-router-5.md](./05-vue-router-5.md)
