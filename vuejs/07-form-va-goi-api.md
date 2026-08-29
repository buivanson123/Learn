# Bài 07 — Form, validate và gọi API

Hai việc chiếm phần lớn thời gian viết ứng dụng thật.

---

## 1. Form cơ bản với `v-model`

```vue
<script setup lang="ts">
import { reactive } from 'vue'

const form = reactive({
  title: '',
  priority: 'normal' as 'low' | 'normal' | 'high',
  dueDate: '',
  done: false,
  tags: [] as string[],
})

function onSubmit() {
  console.log(form)
}
</script>

<template>
  <form @submit.prevent="onSubmit">
    <input v-model.trim="form.title" placeholder="Tên công việc" />

    <select v-model="form.priority">
      <option value="low">Thấp</option>
      <option value="normal">Thường</option>
      <option value="high">Cao</option>
    </select>

    <input type="date" v-model="form.dueDate" />
    <label><input type="checkbox" v-model="form.done" /> Đã xong</label>

    <label><input type="checkbox" v-model="form.tags" value="cong-viec" /> Công việc</label>
    <label><input type="checkbox" v-model="form.tags" value="ca-nhan" /> Cá nhân</label>

    <button type="submit">Lưu</button>
  </form>
</template>
```

Ba điều bắt buộc nhớ:

1. **`@submit.prevent`** — thiếu là trang tải lại và mất hết dữ liệu.
2. **`v-model.trim`** — người dùng gõ dấu cách thừa rất thường xuyên.
3. **`v-model.number`** cho ô số — giá trị `<input>` **luôn là chuỗi**, kể cả `type="number"`.

Đây là chỗ hiếm hoi `reactive` tiện hơn `ref`: `form.title` gọn hơn `form.value.title`. Nhưng nhớ
**đừng destructure** nó ([bẫy 2, bài 02](./02-reactivity.md)).

---

## 2. Validate thủ công

Với form nhỏ, không cần thư viện:

```vue
<script setup lang="ts">
import { reactive, computed, ref } from 'vue'

const form = reactive({ title: '', dueDate: '' })
const touched = reactive({ title: false, dueDate: false })

const errors = computed(() => {
  const e: Record<string, string> = {}

  if (!form.title.trim()) e.title = 'Tên công việc không được để trống'
  else if (form.title.length > 100) e.title = 'Tên không quá 100 ký tự'

  if (form.dueDate && new Date(form.dueDate) < new Date()) {
    e.dueDate = 'Hạn phải ở tương lai'
  }

  return e
})

const isValid = computed(() => Object.keys(errors.value).length === 0)

function onSubmit() {
  Object.keys(touched).forEach(k => (touched[k as keyof typeof touched] = true))
  if (!isValid.value) return
  // lưu...
}
</script>

<template>
  <form @submit.prevent="onSubmit" novalidate>
    <input
      v-model.trim="form.title"
      @blur="touched.title = true"
      :class="{ invalid: touched.title && errors.title }"
    />
    <p v-if="touched.title && errors.title" class="error">{{ errors.title }}</p>

    <button type="submit" :disabled="!isValid">Lưu</button>
  </form>
</template>
```

### ⭐ Vì sao cần `touched`

Không có nó, lỗi "không được để trống" hiện **ngay khi form vừa mở** — người dùng chưa gõ gì đã thấy
màu đỏ. Rất khó chịu.

Quy tắc: chỉ hiện lỗi của một trường khi người dùng **đã rời khỏi nó** (`@blur`), hoặc khi **đã bấm
submit**.

### ⚠️ `:disabled="!isValid"` là con dao hai lưỡi

Nút bị khoá mà người dùng không biết vì sao. Cách tốt hơn: **cho bấm**, rồi hiện toàn bộ lỗi:

```vue
<button type="submit">Lưu</button>
```

```ts
function onSubmit() {
  Object.keys(touched).forEach(k => (touched[k] = true))   // hiện hết lỗi
  if (!isValid.value) return
}
```

---

## 3. Validate bằng Zod

Với form phức tạp, dùng Zod — bạn đã học ở [bộ TypeScript](../typescript/07-thuc-chien-api-va-module.md):

```bash
$ npm i zod
```

```ts
import { z } from 'zod'

export const TaskSchema = z.object({
  title: z.string().min(1, 'Tên không được để trống').max(100, 'Tối đa 100 ký tự'),
  priority: z.enum(['low', 'normal', 'high']),
  dueDate: z.iso.date().optional(),
})

export type TaskInput = z.infer<typeof TaskSchema>
```

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { TaskSchema } from '@/schemas/task'

const form = reactive({ title: '', priority: 'normal', dueDate: '' })
const errors = ref<Record<string, string>>({})

function onSubmit() {
  const result = TaskSchema.safeParse(form)

  if (!result.success) {
    errors.value = {}
    for (const issue of result.error.issues) {
      errors.value[issue.path.join('.')] = issue.message
    }
    return
  }

  errors.value = {}
  save(result.data)      // result.data đã có kiểu TaskInput
}
</script>
```

Lợi ích: **một schema dùng cho cả validate lẫn kiểu TypeScript**. Sửa schema là kiểu tự đổi theo.

> Zod 4: dùng `z.email()`, `z.url()`, `z.iso.date()` — không phải `z.string().email()` kiểu Zod 3.

### Thư viện form

Form lớn (nhiều bước, mảng động, field lồng nhau) thì dùng **VeeValidate** — nó tích hợp sẵn Zod:

```bash
$ npm i vee-validate @vee-validate/zod
```

Với form dưới 10 trường, cách thủ công ở mục 2 đủ và ít phụ thuộc hơn.

---

## 4. Gọi API — mẫu chuẩn

```ts
// src/composables/useFetch.ts
import { ref } from 'vue'

export function useApi<T>() {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run(url: string, options?: RequestInit) {
    loading.value = true
    error.value = null

    try {
      const res = await fetch(url, options)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }

      data.value = await res.json()
      return data.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi không xác định'
      return null
    } finally {
      loading.value = false       // ⚠️ finally
    }
  }

  return { data, loading, error, run }
}
```

### ⭐ Bốn điều bắt buộc

**1. `fetch` KHÔNG ném lỗi khi HTTP 404/500.**

```ts
const res = await fetch('/api/khong-co')
// res.ok === false, nhưng KHÔNG có exception
```

Đây là lỗi số một khi mới dùng `fetch`. Phải tự kiểm tra `res.ok`.

**2. `loading = false` trong `finally`.** Đặt trong `try` thì gặp lỗi là spinner quay mãi.

**3. Reset `error` ở đầu mỗi lần gọi.** Không thì lỗi cũ còn hiện sau khi thử lại thành công.

**4. Bắt lỗi mạng.** `fetch` **có** ném exception khi mất mạng hoặc CORS — nên vẫn cần `try/catch`.

### Dùng trong component

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

const { data: tasks, loading, error, run } = useApi<Task[]>()

onMounted(() => run('/api/tasks'))
</script>

<template>
  <p v-if="loading">Đang tải...</p>
  <p v-else-if="error" class="error">
    {{ error }}
    <button @click="run('/api/tasks')">Thử lại</button>
  </p>
  <ul v-else-if="tasks?.length">
    <li v-for="t in tasks" :key="t.id">{{ t.title }}</li>
  </ul>
  <p v-else>Chưa có công việc nào</p>
</template>
```

⭐ Bốn trạng thái: **loading → error → có dữ liệu → rỗng**. Thiếu trạng thái "rỗng" là lỗi UX rất hay
gặp — người dùng thấy màn hình trắng và không biết đang tải hay không có gì.

---

## 5. Validate dữ liệu **nhận về** từ API

```ts
const res = await fetch('/api/tasks')
const tasks = await res.json() as Task[]      // ❌ chỉ là lời hứa với TypeScript
```

`as` không kiểm tra gì lúc chạy. API đổi tên field là ứng dụng vỡ ở chỗ khác, xa nguyên nhân.

```ts
import { z } from 'zod'

const TaskSchema = z.object({
  id: z.number(),
  title: z.string(),
  done: z.boolean(),
})
const TaskListSchema = z.array(TaskSchema)

const tasks = TaskListSchema.parse(await res.json())   // ✅ ném lỗi ngay tại biên
```

Lỗi xuất hiện **đúng chỗ dữ liệu vào**, kèm thông báo chỉ rõ field nào sai.

---

## 6. Race condition khi tìm kiếm

Người dùng gõ nhanh → nhiều request chạy song song → **request cũ về sau ghi đè kết quả mới**.

```ts
import { watch, ref } from 'vue'

const query = ref('')
const results = ref<Task[]>([])

watch(query, async (q, _old, onCleanup) => {
  if (!q) { results.value = []; return }

  const controller = new AbortController()
  onCleanup(() => controller.abort())        // ⭐ huỷ request trước

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
      signal: controller.signal,
    })
    results.value = await res.json()
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e    // bỏ qua lỗi do tự huỷ
  }
})
```

Cộng thêm debounce để giảm số request:

```ts
import { refDebounced } from '@vueuse/core'

const query = ref('')
const debounced = refDebounced(query, 300)
watch(debounced, /* ... */)
```

Không có debounce, gõ "vue router" là 10 request. Có debounce 300ms thì còn 1.

---

## 7. Nối vào backend thật

Dự án ở [bài 08](./08-du-an-task-app.md) dùng `localStorage`. Muốn đổi sang API thật (ví dụ blog-api
NestJS bạn đã làm) thì chỉ cần thay phần lưu trữ trong store:

```ts
export const useTasksStore = defineStore('tasks', () => {
  const items = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true; error.value = null
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/tasks`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      items.value = TaskListSchema.parse(await res.json())
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Lỗi'
    } finally {
      loading.value = false
    }
  }

  async function add(title: string) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    items.value.push(await res.json())
  }

  return { items, loading, error, fetchAll, add }
})
```

Component **không phải sửa gì** — đó là lợi ích của việc để logic dữ liệu trong store.

### CORS

Gọi API khác domain sẽ gặp:

```
Access to fetch at 'http://localhost:3000/api/tasks' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

Đây là lỗi **phía server**, không sửa được ở frontend. Hai cách:

```ts
// 1. Bật CORS ở backend (NestJS)
app.enableCors({ origin: 'http://localhost:5173', credentials: true })
```

```ts
// 2. Proxy qua Vite khi dev — không cần đụng backend
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
```

Cách 2 tiện khi dev: gọi `/api/tasks` là Vite chuyển tiếp, trình duyệt thấy cùng origin nên không có
CORS.

### Cập nhật lạc quan (optimistic update)

```ts
async function toggle(id: number) {
  const t = items.value.find(t => t.id === id)
  if (!t) return

  const truoc = t.done
  t.done = !t.done                      // đổi giao diện NGAY

  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: t.done }),
    })
    if (!res.ok) throw new Error()
  } catch {
    t.done = truoc                      // hỏng thì trả về như cũ
    error.value = 'Không lưu được'
  }
}
```

Giao diện phản hồi tức thì thay vì chờ mạng. Bắt buộc phải có phần **hoàn tác khi lỗi**.

---

## Bài tập

1. Viết form thêm công việc có `title`, `priority`, `dueDate`. Bỏ `@submit.prevent` rồi bấm Lưu —
   chuyện gì xảy ra?

2. Thêm `<input type="number" v-model="estimate">` không có `.number`. In `typeof estimate` và
   `estimate + 1`. Thêm `.number` rồi so sánh.

3. Viết validate bằng `computed` **không** có `touched`. Mở form và quan sát. Thêm `touched` và so sánh
   trải nghiệm.

4. Chuyển validate sang Zod. Gửi form thiếu `title` và map `error.issues` thành object lỗi theo field.

5. Viết `useApi` với `loading.value = false` đặt trong `try`. Gọi một URL trả 500. Spinner có tắt không?
   Chuyển sang `finally`.

6. Gọi `fetch('/api/khong-co')` và chỉ dùng `try/catch`, **không** kiểm tra `res.ok`. Có vào `catch`
   không? Vì sao?

7. Viết ô tìm kiếm gọi API mỗi lần gõ, **không** có `AbortController`. Gõ nhanh rồi xoá — kết quả hiện
   có đúng với ô input không? Thêm `onCleanup` + `abort` và thử lại.

8. Cấu hình proxy trong `vite.config.ts` trỏ sang một API khác cổng. Xác nhận không còn lỗi CORS.

<details>
<summary>Gợi ý đáp án</summary>

**1.** Trang **tải lại** (hành vi mặc định của form HTML), URL thêm query string, và mọi state trong bộ
nhớ mất sạch.

**2.** Không có `.number`: `typeof` ra `"string"`, `estimate + 1` ra `"51"`. Giá trị của `<input>` luôn
là chuỗi kể cả `type="number"`.

**5.** Spinner **quay mãi**. Dòng `loading.value = false` nằm sau chỗ ném lỗi nên không chạy tới. Đó là
lý do phải dùng `finally`.

**6.** **Không** vào `catch`. `fetch` chỉ ném exception khi lỗi mạng/CORS, còn HTTP 404/500 vẫn là
"thành công" ở tầng mạng — `res.ok` là `false` nhưng không có lỗi nào được ném.

**7.** Kết quả có thể **không khớp** ô input: request của "vu" về sau request của "vue" và ghi đè lên.
Đây là race condition. `onCleanup` + `abort` huỷ request cũ trước khi bắn cái mới.

</details>

---

Tiếp theo: [08-du-an-task-app.md](./08-du-an-task-app.md)
