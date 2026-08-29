# Bài 08 — Dự án: App quản lý công việc

Ghép mọi thứ đã học thành một ứng dụng chạy được. **Không cần backend** — dữ liệu lưu `localStorage`.

Toàn bộ code trong bài này đã được dựng và chạy thật: **15 test pass, `type-check` sạch, build thành công**.

**Tính năng:** thêm/sửa/xoá/đánh dấu xong, lọc theo trạng thái, tìm kiếm, sắp xếp theo độ ưu tiên, tự
lưu và nạp lại sau khi tải lại trang.

---

## 0. Dựng project

```bash
$ nvm use 22                        # ⚠️ Vite 8 cần Node >= 20.19
$ npm create vue@latest taskapp -- --typescript --router --pinia --vitest
$ cd taskapp && npm install
$ npm run dev
```

Cấu trúc sẽ xây:

```
src/
├── types/task.ts                    ← kiểu dùng chung
├── composables/useLocalStorage.ts   ← ref tự đồng bộ localStorage
├── stores/tasks.ts                  ← Pinia store
├── components/
│   ├── TaskForm.vue
│   ├── TaskItem.vue
│   ├── TaskList.vue
│   └── __tests__/TaskList.spec.ts
├── views/HomeView.vue
└── router/index.ts
```

---

## 1. Kiểu dùng chung

```ts
// src/types/task.ts
export type Priority = 'low' | 'normal' | 'high'
export type Filter = 'all' | 'active' | 'done'

export interface Task {
  id: string
  title: string
  done: boolean
  priority: Priority
  createdAt: number
}
```

Dùng **union literal** thay `enum` — bạn đã học lý do ở [bộ TypeScript](../typescript/01-kieu-co-ban.md):
`enum` sinh code runtime, union literal thì biến mất khi biên dịch.

---

## 2. Composable `useLocalStorage`

```ts
// src/composables/useLocalStorage.ts
import { ref, watch, type Ref } from 'vue'

export function useLocalStorage<T>(key: string, initial: T): Ref<T> {
  const raw = localStorage.getItem(key)

  let start = initial
  if (raw !== null) {
    try { start = JSON.parse(raw) as T } catch { start = initial }
  }

  const data = ref(start) as Ref<T>

  watch(data, (v) => {
    localStorage.setItem(key, JSON.stringify(v))
  }, { deep: true })

  return data
}
```

Ba điểm cố ý:

1. **`try/catch` quanh `JSON.parse`.** Dữ liệu trong `localStorage` có thể hỏng (người dùng sửa tay,
   phiên bản cũ). Không bắt lỗi là app trắng màn hình và **không vào lại được** cho tới khi xoá thủ công.
2. **`{ deep: true }` bắt buộc.** Thiếu nó thì `push` vào mảng không được lưu — tham chiếu mảng không đổi
   nên `watch` không chạy ([bẫy 5, bài 02](./02-reactivity.md)).
3. **`as Ref<T>`.** TypeScript suy kiểu `ref()` với generic lồng nhau không chuẩn; ép ở đúng một chỗ này
   để mọi nơi dùng đều có kiểu đúng.

---

## 3. Store

```ts
// src/stores/tasks.ts
import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useLocalStorage } from '@/composables/useLocalStorage'
import type { Task, Filter, Priority } from '@/types/task'

export const useTasksStore = defineStore('tasks', () => {
  const items = useLocalStorage<Task[]>('tasks', [])
  const filter = useLocalStorage<Filter>('filter', 'all')
  const query = useLocalStorage<string>('query', '')

  const remaining = computed(() => items.value.filter(t => !t.done).length)

  const visible = computed(() => {
    let list = items.value

    if (filter.value === 'active') list = list.filter(t => !t.done)
    else if (filter.value === 'done') list = list.filter(t => t.done)

    const q = query.value.trim().toLowerCase()
    if (q) list = list.filter(t => t.title.toLowerCase().includes(q))

    const order: Record<Priority, number> = { high: 0, normal: 1, low: 2 }
    return [...list].sort((a, b) => order[a.priority] - order[b.priority] || b.createdAt - a.createdAt)
  })

  function add(title: string, priority: Priority = 'normal') {
    const t = title.trim()
    if (!t) return
    items.value.push({
      id: crypto.randomUUID(),
      title: t,
      done: false,
      priority,
      createdAt: Date.now(),
    })
  }

  function toggle(id: string) {
    const t = items.value.find(t => t.id === id)
    if (t) t.done = !t.done
  }

  function remove(id: string) {
    items.value = items.value.filter(t => t.id !== id)
  }

  function rename(id: string, title: string) {
    const t = items.value.find(t => t.id === id)
    if (t && title.trim()) t.title = title.trim()
  }

  function clearDone() {
    items.value = items.value.filter(t => !t.done)
  }

  function $reset() {
    items.value = []
    filter.value = 'all'
    query.value = ''
  }

  return { items, filter, query, remaining, visible, add, toggle, remove, rename, clearDone, $reset }
})
```

Bốn điểm đáng chú ý:

- **Composable dùng ngay trong store.** `useLocalStorage` trả về `ref`, mà state của setup store chính
  là `ref` — ghép vào nhau tự nhiên. Đây là điểm mạnh của Composition API.
- **`[...list].sort()`** — `sort()` sửa mảng **tại chỗ**. Sắp xếp thẳng `items.value` bên trong
  `computed` là sửa state trong lúc tính toán, dễ gây vòng lặp cập nhật vô hạn.
- **`crypto.randomUUID()`** thay `Date.now()` làm id — thêm hai việc trong cùng mili giây sẽ trùng id,
  và `:key` trùng là nguồn bug rất khó tìm.
- **`$reset` tự viết** — setup store không có sẵn ([bài 06 mục 5](./06-pinia-4.md)).

---

## 4. `TaskForm.vue`

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTasksStore } from '@/stores/tasks'
import type { Priority } from '@/types/task'

const store = useTasksStore()

const title = ref('')
const priority = ref<Priority>('normal')
const touched = ref(false)

const error = computed(() => {
  if (!title.value.trim()) return 'Tên công việc không được để trống'
  if (title.value.length > 100) return 'Tối đa 100 ký tự'
  return ''
})

function onSubmit() {
  touched.value = true
  if (error.value) return

  store.add(title.value, priority.value)
  title.value = ''
  priority.value = 'normal'
  touched.value = false
}
</script>

<template>
  <form class="task-form" @submit.prevent="onSubmit" novalidate>
    <input
      v-model.trim="title"
      class="title-input"
      placeholder="Thêm công việc..."
      @blur="touched = true"
    />

    <select v-model="priority" class="priority">
      <option value="high">Cao</option>
      <option value="normal">Thường</option>
      <option value="low">Thấp</option>
    </select>

    <button type="submit">Thêm</button>

    <p v-if="touched && error" class="error">{{ error }}</p>
  </form>
</template>
```

`touched` khiến lỗi chỉ hiện **sau khi người dùng rời ô hoặc bấm Thêm** — không đỏ lòm ngay khi mở
trang ([bài 07 mục 2](./07-form-va-goi-api.md)).

---

## 5. `TaskItem.vue` — có sửa tại chỗ

```vue
<script setup lang="ts">
import { ref, nextTick, useTemplateRef } from 'vue'
import type { Task } from '@/types/task'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  toggle: [id: string]
  remove: [id: string]
  rename: [id: string, title: string]
}>()

const editing = ref(false)
const draft = ref('')
const input = useTemplateRef<HTMLInputElement>('editInput')

async function startEdit() {
  draft.value = props.task.title
  editing.value = true
  await nextTick()          // ⭐ chờ input xuất hiện trong DOM
  input.value?.focus()
}

function commit() {
  if (draft.value.trim()) emit('rename', props.task.id, draft.value)
  editing.value = false
}
</script>

<template>
  <li class="task-item" :class="[`p-${task.priority}`, { done: task.done }]">
    <input
      type="checkbox"
      class="check"
      :checked="task.done"
      @change="emit('toggle', task.id)"
    />

    <input
      v-if="editing"
      ref="editInput"
      v-model.trim="draft"
      class="edit"
      @blur="commit"
      @keyup.enter="commit"
      @keyup.esc="editing = false"
    />
    <span v-else class="title" @dblclick="startEdit">{{ task.title }}</span>

    <button class="remove" @click="emit('remove', task.id)">Xoá</button>
  </li>
</template>
```

Ba kỹ thuật:

- **`await nextTick()` trước `focus()`.** `v-if` vừa bật thì DOM chưa có input. Không chờ là
  `input.value` bằng `null` ([bài 04 mục 5](./04-composable-va-lifecycle.md)).
- **Component "câm".** Nó không đụng store — chỉ nhận `task` và **emit** ra ngoài. Nhờ vậy test được
  độc lập và tái dùng được ở nơi khác.
- **`:checked` + `@change`, không dùng `v-model="task.done"`.** `task` là prop, `v-model` lên prop là
  sửa dữ liệu của cha ([bài 03 mục 1](./03-component.md)).

---

## 6. `TaskList.vue`

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useTasksStore } from '@/stores/tasks'
import TaskItem from './TaskItem.vue'

const store = useTasksStore()
const { visible, remaining, filter, query } = storeToRefs(store)   // ⭐ state + getters
const { toggle, remove, rename, clearDone } = store                 // actions lấy thẳng
</script>

<template>
  <div class="toolbar">
    <input v-model.trim="query" class="search" placeholder="Tìm..." />

    <button
      v-for="f in (['all', 'active', 'done'] as const)"
      :key="f"
      class="filter-btn"
      :class="{ active: filter === f }"
      @click="filter = f"
    >
      {{ f === 'all' ? 'Tất cả' : f === 'active' ? 'Chưa xong' : 'Đã xong' }}
    </button>
  </div>

  <p class="remaining">Còn {{ remaining }} việc</p>

  <ul v-if="visible.length" class="list">
    <TaskItem
      v-for="t in visible"
      :key="t.id"
      :task="t"
      @toggle="toggle"
      @remove="remove"
      @rename="rename"
    />
  </ul>
  <p v-else class="empty">Không có công việc nào</p>

  <button class="clear-done" @click="clearDone">Xoá việc đã xong</button>
</template>
```

⭐ `storeToRefs` cho state/getters, actions destructure thẳng. Quên `storeToRefs` là bộ lọc bấm không
ăn ([bài 06 mục 4](./06-pinia-4.md)).

Chú ý `(['all', 'active', 'done'] as const)` — `as const` giúp TypeScript biết đây là union literal chứ
không phải `string[]`, nên `filter = f` không báo lỗi kiểu.

---

## 7. Router

```ts
// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView, meta: { title: 'Công việc' } },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
      meta: { title: 'Giới thiệu' },
    },
    { path: '/:pathMatch(.*)*', name: 'notfound', component: () => import('../views/NotFound.vue') },
  ],
})

router.afterEach((to) => {
  document.title = (to.meta.title as string) ?? 'Task App'
})

export default router
```

`afterEach` đặt tiêu đề trang — việc nhỏ nhưng thường bị quên trong SPA, và ảnh hưởng trải nghiệm lẫn
lịch sử trình duyệt.

---

## 8. Test

### Store — 8 test

```ts
// src/stores/tasks.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTasksStore } from './tasks'

describe('tasks store', () => {
  beforeEach(() => {
    localStorage.clear()              // ⚠️ dọn cả localStorage
    setActivePinia(createPinia())
  })

  it('them viec, bo qua chuoi rong', () => {
    const s = useTasksStore()
    s.add('Hoc Vue')
    s.add('   ')
    expect(s.items).toHaveLength(1)
  })

  it('sap xep theo do uu tien', () => {
    const s = useTasksStore()
    s.add('thap', 'low'); s.add('cao', 'high'); s.add('thuong', 'normal')
    expect(s.visible.map(t => t.title)).toEqual(['cao', 'thuong', 'thap'])
  })

  it('LUU vao localStorage', async () => {
    const s = useTasksStore()
    s.add('Hoc Vue')
    await new Promise(r => setTimeout(r, 10))     // watch chạy bất đồng bộ
    expect(JSON.parse(localStorage.getItem('tasks')!)).toHaveLength(1)
  })

  it('NAP LAI tu localStorage', () => {
    localStorage.setItem('tasks', JSON.stringify([
      { id: 'x', title: 'da luu', done: false, priority: 'normal', createdAt: 1 },
    ]))
    setActivePinia(createPinia())
    const s = useTasksStore()
    expect(s.items[0]!.title).toBe('da luu')
  })
})
```

### Component — 6 test

```ts
it('them viec qua form roi hien trong list', async () => {
  const form = mount(TaskForm)
  await form.get('.title-input').setValue('Hoc Vue')
  await form.get('form').trigger('submit')

  const list = mount(TaskList)
  expect(list.text()).toContain('Hoc Vue')
  expect(list.get('.remaining').text()).toContain('Còn 1 việc')
})

it('form chan chuoi rong va hien loi', async () => {
  const form = mount(TaskForm)
  await form.get('form').trigger('submit')
  expect(form.get('.error').text()).toContain('không được để trống')
  expect(useTasksStore().items).toHaveLength(0)
})
```

Hai component khác nhau cùng thấy một store — đó là điểm khác biệt với composable.

### Chạy

```bash
$ npx vitest run
 Test Files  3 passed (3)
      Tests  15 passed (15)
```

---

## 9. ⚠️ Bẫy thật gặp khi làm dự án này

Chạy `npm run build` lần đầu bị **đỏ** dù 15 test đều pass:

```bash
$ npm run build
src/stores/tasks.spec.ts(29,14): error TS2532: Object is possibly 'undefined'.
src/components/__tests__/TaskList.spec.ts(41,12): error TS2532: Object is possibly 'undefined'.
ERROR: "type-check" exited with 2.
```

Nguyên nhân: scaffold bật `noUncheckedIndexedAccess`:

```bash
$ grep noUncheckedIndexedAccess tsconfig.app.json
"noUncheckedIndexedAccess": true,
```

Cờ này khiến `items[0]` có kiểu `Task | undefined` — phản ánh đúng thực tế (mảng có thể rỗng). Nên
`s.items[0].id` không hợp lệ.

Sửa trong test:

```ts
s.toggle(s.items[0]!.id)              // ! vì test tự tạo dữ liệu, chắc chắn có
```

Trong code thật thì **đừng dùng `!`** — kiểm tra tử tế:

```ts
const first = items.value[0]
if (!first) return
```

Hai bài học:

1. **Test pass không có nghĩa build pass.** `npm run build` chạy `type-check` song song, nên phải chạy
   nó trước khi commit.
2. `noUncheckedIndexedAccess` là cờ tốt — nó bắt đúng loại lỗi `Cannot read properties of undefined`
   mà bạn chỉ gặp lúc chạy.

---

## 10. Kết quả build

```bash
$ npm run build
dist/index.html                       0.42 kB │ gzip:  0.28 kB
dist/assets/AboutView-CXtZgaLf.css    0.08 kB │ gzip:  0.10 kB
dist/assets/index-DWKbIDX3.css        3.01 kB │ gzip:  1.05 kB
dist/assets/AboutView-Cj4gRaB7.js     0.22 kB │ gzip:  0.20 kB
dist/assets/index-Cii4ujPy.js       101.70 kB │ gzip: 39.82 kB

✓ built in 206ms
```

**~40 kB gzip** cho toàn bộ Vue + router + Pinia + ứng dụng. `AboutView` tách riêng nhờ lazy load.

```bash
$ npm run preview      # xem thử bản build
```

---

## 11. Danh sách kiểm tra thủ công

| Việc | Kỳ vọng |
|------|---------|
| Thêm việc với ô trống | Hiện lỗi, không thêm |
| Thêm việc rồi **tải lại trang** | Dữ liệu còn nguyên |
| Đánh dấu xong | Số "còn N việc" giảm |
| Lọc "Chưa xong" rồi tải lại trang | Bộ lọc vẫn giữ |
| Gõ vào ô tìm | Danh sách lọc ngay |
| Nháy đúp vào tên việc | Thành ô input và **tự focus** |
| Sửa xong bấm Esc | Huỷ, giữ tên cũ |
| Thêm 2 việc trong 1 giây | Không trùng id, không cảnh báo `key` |
| Xoá hết việc | Hiện "Không có công việc nào" |
| Mở DevTools tab Pinia | Thấy state đổi theo thời gian thực |

---

## 12. Mở rộng

Làm xong phần trên, thử thêm theo thứ tự khó dần:

1. **Nhiều danh sách** — thêm route `/lists/:id`, mỗi danh sách một bộ việc riêng. Luyện route động và
   `props: true`.
2. **Kéo thả sắp xếp** — dùng `vuedraggable`. Chú ý `:key` phải ổn định.
3. **Hoàn tác (undo)** — lưu lịch sử thao tác trong store, thêm nút Ctrl+Z.
4. **Chế độ tối** — `useDark` của VueUse + `provide/inject`.
5. **Xuất/nhập JSON** — tải file về, đọc file lên, validate bằng Zod.
6. **Nối API thật** — đổi `useLocalStorage` thành lời gọi API theo
   [bài 07 mục 7](./07-form-va-goi-api.md). Component **không phải sửa gì**.
7. **Test E2E** bằng Playwright.

---

## Bài tập

1. Dựng toàn bộ dự án. Chạy `npx vitest run` và `npm run build` — cả hai phải xanh.

2. Xoá `{ deep: true }` khỏi `useLocalStorage`. Thêm việc rồi tải lại trang. Dữ liệu còn không? Giải thích.

3. Đổi `crypto.randomUUID()` thành `Date.now()`. Thêm nhanh 3 việc liên tiếp (dùng vòng lặp để chắc
   chắn trùng mili giây). Console có cảnh báo gì không? Thử sửa tên một việc và quan sát các việc khác.

4. Trong `TaskList`, bỏ `storeToRefs` và destructure thẳng `const { filter } = store`. Bấm nút lọc —
   có ăn không?

5. Trong `TaskItem`, xoá `await nextTick()` trước `focus()`. Nháy đúp để sửa — con trỏ có vào ô không?

6. Sắp xếp bằng `list.sort(...)` thay vì `[...list].sort(...)`. Quan sát console.

7. Ghi một chuỗi không phải JSON vào `localStorage.setItem('tasks', 'hong')` rồi tải lại trang. App có
   trắng màn hình không? Kiểm tra `try/catch` trong `useLocalStorage`.

8. Viết thêm test: sửa tên việc bằng `rename` và kiểm tra `localStorage` đã cập nhật.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Mất dữ liệu. `push` sửa bên trong mảng nên tham chiếu không đổi, `watch` không chạy. Cần `deep: true`.

**3.** `Date.now()` cho hai việc thêm trong cùng mili giây sẽ **trùng id**.

⚠️ Điều đáng chú ý: Vue 3.5 **không hề cảnh báo** trong trường hợp này — tôi đã thử cả lúc mount lẫn
lúc cập nhật, console im lặng. Triệu chứng là **hành vi sai**, không phải thông báo lỗi:

- Sửa tên một việc thì việc khác đổi theo.
- Xoá một việc thì việc khác biến mất.
- Ô input đang gõ dở nhảy sang hàng khác.

Đây là loại bug tệ nhất — không có gì chỉ cho bạn nguyên nhân. Cách phòng duy nhất là **dùng id thật sự
duy nhất** (`crypto.randomUUID()`) ngay từ đầu.

**4.** **Không ăn.** Destructure store làm mất reactivity — `filter` chỉ là chuỗi thường, gán vào nó
không ảnh hưởng store. `storeToRefs` giữ được vì mỗi trường thành một `ref`.

**5.** Con trỏ **không** vào ô. `v-if` vừa bật, DOM chưa có input nên `input.value` là `null`, và
`?.focus()` bỏ qua im lặng.

**7.** Không trắng màn hình — `try/catch` bắt lỗi `JSON.parse` và rơi về giá trị mặc định. Bỏ `try/catch`
thì lỗi ném ra ngay lúc khởi tạo store và **cả app không mount được**, người dùng phải tự xoá
localStorage mới vào lại được.

</details>

---

Tiếp theo: [09-loi-thuong-gap.md](./09-loi-thuong-gap.md)
