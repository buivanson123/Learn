# Bài 06 — Pinia 4

Pinia là thư viện quản lý state chính thức của Vue, thay hẳn Vuex. Bài này dùng **Pinia 4.0** — bản
major mới, ra ngày 14/07/2026.

```bash
$ npm view pinia dist-tags
{ next: '2.0.0-rc.10', beta: '2.1.8-beta.0', latest: '4.0.3' }
```

Mọi hành vi dưới đây kiểm chứng bằng 5 test chạy thật.

---

## 1. Khi nào cần Pinia

Đừng dùng Pinia cho mọi thứ. Thang đo:

| Tình huống | Dùng |
|-----------|------|
| State chỉ một component dùng | `ref` trong chính component |
| Cha truyền xuống con 1–2 tầng | props |
| Logic tái dùng, state riêng mỗi nơi | [composable](./04-composable-va-lifecycle.md) |
| Truyền xuống một cây component | `provide`/`inject` |
| **State dùng chung, nhiều nơi không liên quan cùng đọc/ghi** | **Pinia** |

Ví dụ đáng dùng Pinia: người dùng đang đăng nhập, giỏ hàng, danh sách công việc dùng chung giữa nhiều
trang.

---

## 2. Setup store — cách nên dùng

```ts
// src/stores/tasks.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface Task { id: number; title: string; done: boolean }

export const useTasksStore = defineStore('tasks', () => {
  // state  → ref
  const items = ref<Task[]>([])

  // getters → computed
  const remaining = computed(() => items.value.filter(t => !t.done).length)

  // actions → function
  function add(title: string) {
    items.value.push({ id: Date.now(), title, done: false })
  }

  function toggle(id: number) {
    const t = items.value.find(t => t.id === id)
    if (t) t.done = !t.done
  }

  return { items, remaining, add, toggle }
})
```

Test:

```ts
const s = useTasksStore()
s.add('Hoc Pinia')
expect(s.items).toHaveLength(1)
expect(s.remaining).toBe(1)      // ✅
```

Cú pháp giống hệt `<script setup>` — `ref` là state, `computed` là getter, `function` là action. Không
có khái niệm mới nào phải học.

⚠️ **Phải `return` mọi thứ bạn muốn dùng từ ngoài.** Quên return là component không thấy.

### Options store (cách cũ, vẫn dùng được)

```ts
export const useTasksStore = defineStore('tasks', {
  state: () => ({ items: [] as Task[] }),
  getters: {
    remaining: (state) => state.items.filter(t => !t.done).length,
  },
  actions: {
    add(title: string) { this.items.push({ id: Date.now(), title, done: false }) },
  },
})
```

Giống Vuex hơn nên dễ chuyển từ code cũ. Nhưng setup store hợp với Composition API hơn và không phải
dùng `this` — bộ tài liệu này dùng setup store.

---

## 3. Dùng store trong component

```vue
<script setup lang="ts">
import { useTasksStore } from '@/stores/tasks'

const store = useTasksStore()
</script>

<template>
  <p>Còn {{ store.remaining }} việc</p>
  <button @click="store.add('Việc mới')">Thêm</button>

  <li v-for="t in store.items" :key="t.id" @click="store.toggle(t.id)">
    {{ t.title }}
  </li>
</template>
```

Gọi `useTasksStore()` ở nhiều component đều trả về **cùng một instance** — đó là điểm khác composable.

---

## 4. ⭐ Bẫy lớn nhất: destructure store làm mất reactivity

```ts
const s = useTasksStore()
const { remaining } = s          // ❌ mất reactivity
s.add('a')
```

Test:

```ts
expect(remaining).toBe(0)        // ✅ vẫn là 0!
expect(s.remaining).toBe(1)
```

Đây là [bẫy 2 của bài 02](./02-reactivity.md) lặp lại — store về bản chất là một object reactive.

### Sửa bằng `storeToRefs`

```ts
import { storeToRefs } from 'pinia'

const store = useTasksStore()
const { items, remaining } = storeToRefs(store)   // ✅ state + getters
const { add, toggle } = store                      // ✅ actions lấy trực tiếp
```

Test:

```ts
const { remaining } = storeToRefs(s)
s.add('a')
expect(remaining.value).toBe(1)     // ✅
```

⭐ **Quy tắc:** `storeToRefs` cho **state và getters**; actions destructure thẳng (chúng là hàm, không
cần reactivity).

---

## 5. Sửa state

```ts
// 1. Trực tiếp
store.items.push(newTask)

// 2. Qua action (nên dùng — logic nằm một chỗ)
store.add('Việc mới')

// 3. $patch object — nhiều trường một lần
store.$patch({ filter: 'active', sortBy: 'date' })

// 4. $patch function — khi cần logic
store.$patch((state) => {
  state.items.push(newTask)
  state.lastUpdated = Date.now()
})
```

Test `$patch`:

```ts
s.$patch({ items: [{ id: 1, title: 'x', done: true }] })
expect(s.items).toHaveLength(1)
expect(s.remaining).toBe(0)     // ✅ getter tính lại đúng
```

`$patch` gộp nhiều thay đổi thành **một** lần cập nhật — DevTools hiện một mục thay vì nhiều, và Vue
chỉ render lại một lần.

### ⚠️ `$reset()` KHÔNG dùng được với setup store

```ts
const s = useTasksStore()
s.add('a')
expect(() => s.$reset()).toThrow()     // ✅ ném lỗi
```

Vì Pinia không biết state ban đầu của bạn là gì — setup store chỉ là một hàm trả về object.

**Tự viết action reset:**

```ts
export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const filter = ref<'all' | 'active' | 'done'>('all')

  function $reset() {
    items.value = []
    filter.value = 'all'
  }

  return { items, filter, $reset }
})
```

Options store thì có `$reset()` sẵn — đó là một điểm cộng nhỏ của nó.

---

## 6. Store gọi store khác

```ts
export const useTasksStore = defineStore('tasks', () => {
  const auth = useAuthStore()      // ✅ gọi trong thân store

  const myTasks = computed(() =>
    items.value.filter(t => t.ownerId === auth.userId)
  )

  return { myTasks }
})
```

Pinia không có "module lồng nhau" như Vuex — store nào cũng phẳng và gọi nhau tự do.

⚠️ Cẩn thận vòng lặp: A gọi B, B gọi A. Không lỗi ngay nhưng dễ rối. Nếu gặp, thường là hai store nên
gộp làm một, hoặc tách phần chung ra store thứ ba.

---

## 7. Lưu state vào localStorage

Cách đơn giản nhất — `watch` ngay trong store:

```ts
import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'

const KEY = 'tasks'

export const useTasksStore = defineStore('tasks', () => {
  const stored = localStorage.getItem(KEY)
  const items = ref<Task[]>(stored ? JSON.parse(stored) : [])

  watch(items, (v) => {
    localStorage.setItem(KEY, JSON.stringify(v))
  }, { deep: true })          // ⚠️ BẮT BUỘC có deep

  return { items }
})
```

⚠️ Thiếu `{ deep: true }` thì `push` vào mảng **không được lưu** — tham chiếu mảng không đổi nên `watch`
không chạy ([bẫy 5, bài 02](./02-reactivity.md)).

### Dùng plugin cho nhiều store

```bash
$ npm i pinia-plugin-persistedstate
```

```ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
```

```ts
export const useTasksStore = defineStore('tasks', () => { /* ... */ }, {
  persist: true,
})
```

### Tự viết plugin

```ts
pinia.use(({ store }) => {
  const saved = localStorage.getItem(store.$id)
  if (saved) store.$patch(JSON.parse(saved))

  store.$subscribe((_mutation, state) => {
    localStorage.setItem(store.$id, JSON.stringify(state))
  })
})
```

`$subscribe` chạy mỗi khi state đổi — tiện cho logging, đồng bộ, hoặc gửi analytics.

---

## 8. Gọi API trong store

```ts
export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      items.value = await res.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi không rõ'
    } finally {
      loading.value = false          // ⚠️ finally, không phải try
    }
  }

  return { items, loading, error, fetchAll }
})
```

⭐ **Bộ ba `items` / `loading` / `error`** là mẫu chuẩn. Đặt `loading.value = false` trong `finally` —
để trong `try` thì gặp lỗi là spinner quay mãi.

Chi tiết hơn ở [bài 07](./07-form-va-goi-api.md).

---

## 9. Test store

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTasksStore } from '@/stores/tasks'

describe('tasks store', () => {
  beforeEach(() => setActivePinia(createPinia()))   // ⚠️ BẮT BUỘC

  it('them viec moi', () => {
    const s = useTasksStore()
    s.add('Hoc Pinia')
    expect(s.items).toHaveLength(1)
    expect(s.remaining).toBe(1)
  })
})
```

⚠️ Không có `setActivePinia` thì:

```
[🍍]: "getActivePinia()" was called but there was no active Pinia. Are you trying to use a store before calling "app.use(pinia)"?
```

`beforeEach` tạo pinia **mới** cho mỗi test — nhờ vậy test không dính state của nhau.

Store là chỗ **dễ test nhất** trong ứng dụng Vue: nó là JavaScript thuần, không cần DOM, không cần
mount component. Viết test cho store là đầu tư rẻ nhất.

---

## 10. DevTools

Vue DevTools có tab **Pinia** riêng:

- Xem state mọi store theo thời gian thực
- **Sửa state trực tiếp** để thử giao diện
- Xem lịch sử thay đổi, quay lại trạng thái trước (time-travel)

Khi "bấm nút mà không thấy gì đổi", mở tab Pinia xem state **thật sự** có đổi không — nếu có đổi mà
giao diện đứng yên thì lỗi nằm ở chỗ destructure (mục 4).

---

## 11. So sánh nhanh

### Pinia vs Vuex

| | Pinia | Vuex 4 |
|---|-------|--------|
| Mutations | **Không có** | Bắt buộc |
| TypeScript | Suy kiểu tự động | Phải khai tay nhiều |
| Module lồng nhau | Không (store phẳng) | Có |
| Kích thước | ~1.5 kB | Lớn hơn |
| Trạng thái | Chính thức | Bảo trì |

Pinia bỏ `mutations` — action sửa state trực tiếp được. Ít lớp trung gian, ít code hơn hẳn.

### Pinia vs Redux/Zustand

| | Pinia | Redux Toolkit | Zustand |
|---|-------|---------------|---------|
| Bất biến | Không bắt buộc | Bắt buộc (Immer) | Không bắt buộc |
| Boilerplate | Rất ít | Nhiều | Rất ít |
| DevTools | ✅ | ✅ | ✅ |

Pinia gần Zustand hơn Redux: sửa state trực tiếp, không cần reducer/action type.

---

## Bài tập

1. Viết `useTasksStore` có `items`, `remaining`, `add`, `toggle`, `remove`. Dùng nó ở hai component
   khác nhau và xác nhận cả hai thấy cùng dữ liệu.

2. Destructure `const { remaining } = store` rồi thêm một việc. Giao diện có đổi không? Sửa bằng
   `storeToRefs` và so sánh.

3. Gọi `store.$reset()` trên setup store. Ghi lại lỗi. Tự viết action `$reset` và thử lại.

4. Thêm `watch` lưu vào localStorage **không** có `deep: true`. Thêm việc rồi tải lại trang — dữ liệu
   còn không? Thêm `deep` và thử lại.

5. Viết test cho store nhưng **quên** `setActivePinia`. Ghi lại lỗi.

6. Dùng `$patch` để đổi 3 trường cùng lúc. Mở DevTools tab Pinia và so với việc gán từng trường riêng lẻ.

7. Viết action `fetchAll` có `loading`/`error`. Đặt `loading.value = false` trong `try` thay vì
   `finally`, rồi làm API lỗi. Spinner có tắt không?

8. Viết một store `auth` và cho `tasks` store gọi nó để lọc việc theo người dùng.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Không đổi. Store là object reactive, destructure copy giá trị ra biến thường. `storeToRefs` giữ
được vì mỗi trường thành một `ref`. Nhớ: `storeToRefs` cho state/getters, actions destructure thẳng.

**3.**
```
Error: 🍍: Store "tasks" is built using the setup syntax and does not implement $reset().
```
Pinia không biết state ban đầu là gì. Phải tự viết action gán lại từng giá trị.

**4.** Không lưu. `push` sửa bên trong mảng, tham chiếu không đổi nên `watch` không chạy. Cần `deep: true`.

**5.**
```
[🍍]: "getActivePinia()" was called but there was no active Pinia.
```

**7.** Spinner **quay mãi** — `loading.value = false` nằm sau dòng ném lỗi nên không bao giờ chạy tới.
Đó là lý do phải dùng `finally`.

</details>

---

Tiếp theo: [07-form-va-goi-api.md](./07-form-va-goi-api.md)
