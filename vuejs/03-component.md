# Bài 03 — Component: props, emit, slot, provide/inject

Component là đơn vị tái dùng của Vue. Bài này về **cách chúng nói chuyện với nhau**.

Quy tắc xuyên suốt: **dữ liệu đi xuống qua props, sự kiện đi lên qua emit.** Đây là luồng một chiều, và
nó là lý do ứng dụng Vue dễ lần ra nguồn gốc dữ liệu.

---

## 1. Props — dữ liệu đi xuống

```vue
<!-- TaskItem.vue -->
<script setup lang="ts">
interface Task { id: number; title: string; done: boolean }

const props = withDefaults(defineProps<{
  task: Task
  highlight?: boolean
}>(), { highlight: false })
</script>

<template>
  <li :class="{ done: task.done, highlight: props.highlight }">
    {{ task.title }}
  </li>
</template>
```

```vue
<TaskItem :task="t" highlight />
```

Test xác nhận:

```ts
const w = mount(TaskItem, { props: { task } })
expect(w.text()).toContain('Hoc Vue')
expect(w.classes()).not.toContain('highlight')    // mặc định false
```

### Khai props bằng kiểu TypeScript

```ts
// ✅ khai bằng kiểu — vue-tsc kiểm tra được cả ở component cha
const props = defineProps<{ task: Task; highlight?: boolean }>()

// giá trị mặc định
const props = withDefaults(defineProps<{ highlight?: boolean }>(), {
  highlight: false,
})
```

Dạng runtime (không TypeScript) vẫn dùng được nhưng không có lợi ích kiểm tra kiểu:

```ts
const props = defineProps({ title: { type: String, required: true } })
```

### `defineProps` không cần import

`defineProps`, `defineEmits`, `defineModel`, `defineExpose` là **macro biên dịch** — trình biên dịch SFC
xử lý chúng, không phải hàm chạy lúc runtime. Nên:

- Không cần `import`.
- Chỉ dùng được ở cấp cao nhất của `<script setup>`.
- **Không** dùng được biến bên ngoài trong đối số của chúng.

### ⭐ Props là READONLY — nhưng chỉ ở tầng ngoài cùng

**Gán trực tiếp vào prop** thì Vue cảnh báo:

```ts
props.title = 'moi'
```
```
[Vue warn] Set operation on key "title" failed: target is readonly.
```

Nhưng **sửa thuộc tính lồng bên trong một prop kiểu object thì KHÔNG có cảnh báo nào**:

```ts
props.task.title = 'moi'      // ⚠️ chạy im lặng
```

Đo thật:

```
>>> GÁN TRỰC TIẾP: [Vue warn] Set operation on key "title" failed: target is readonly.
>>> SỬA LỒNG:      (không có cảnh báo)
```

Đây mới là trường hợp **nguy hiểm hơn**: nó thật sự sửa dữ liệu của component cha, giao diện có thể cập
nhật, và bạn tưởng mọi thứ ổn — cho tới khi phải tìm xem ai đã đổi dữ liệu đó. `readonly` của Vue chỉ
**nông một tầng**, giống `readonly` của TypeScript.

Muốn đổi thì **báo lên cha bằng emit** (mục 2), hoặc dùng `defineModel` (mục 3).

Lý do quy tắc này tồn tại: nếu con sửa được props, bạn không còn biết dữ liệu bị đổi ở đâu — luồng một
chiều mất tác dụng, và đó là thứ khiến ứng dụng lớn khó gỡ lỗi.

---

## 2. Emit — sự kiện đi lên

```vue
<script setup lang="ts">
const emit = defineEmits<{
  toggle: [id: number]
  remove: [id: number]
}>()
</script>

<template>
  <button class="toggle" @click="emit('toggle', task.id)">Đổi</button>
  <button class="remove" @click="emit('remove', task.id)">Xoá</button>
</template>
```

```vue
<TaskItem :task="t" @toggle="onToggle" @remove="onRemove" />
```

Test:

```ts
await w.get('.toggle').trigger('click')
expect(w.emitted('toggle')).toEqual([[1]])    // ✅ đã bắn với payload đúng
```

### Khai kiểu cho emit — và vì sao nên làm

Cú pháp `{ tênSựKiện: [kiểu, đối, số] }` cho `vue-tsc` kiểm tra payload:

```bash
$ npx vue-tsc --noEmit
src/lab/Bad.vue(7,34): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```

Lỗi này nằm **trong template**, và trình duyệt không báo. Không khai kiểu thì bạn mất luôn lá chắn này.

---

## 3. `defineModel` — `v-model` cho component

Trước Vue 3.4, làm `v-model` trên component phải viết tay props + emit. Giờ chỉ một dòng:

```vue
<!-- SearchBox.vue -->
<script setup lang="ts">
const model = defineModel<string>({ default: '' })
</script>

<template>
  <input :value="model" @input="model = ($event.target as HTMLInputElement).value" />
</template>
```

```vue
<SearchBox v-model="query" />
```

Test:

```ts
const w = mount(SearchBox, { props: { modelValue: 'a' } })
await w.get('input').setValue('vue')
expect(w.emitted('update:modelValue')).toEqual([['vue']])    // ✅
```

`defineModel` tự sinh prop `modelValue` và sự kiện `update:modelValue`. Bên trong component, `model`
dùng như một `ref` bình thường — **ghi vào nó là tự động emit**.

### Nhiều `v-model` trên một component

```vue
<script setup lang="ts">
const first = defineModel<string>('first')
const last = defineModel<string>('last')
</script>
```

```vue
<NameFields v-model:first="firstName" v-model:last="lastName" />
```

### Cách cũ (để đọc được code cũ)

```vue
<script setup lang="ts">
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <input :value="props.modelValue" @input="emit('update:modelValue', $event.target.value)" />
</template>
```

`defineModel` làm đúng việc này, ngắn hơn nhiều.

---

## 4. Slot — truyền **giao diện** vào component

Props truyền dữ liệu; slot truyền **cả đoạn template**.

```vue
<!-- Card.vue -->
<template>
  <div class="card">
    <header><slot name="header">Tiêu đề mặc định</slot></header>
    <div class="body"><slot>Nội dung mặc định</slot></div>
    <footer><slot name="footer" :count="42" /></footer>
  </div>
</template>
```

### Slot mặc định khi không truyền

```ts
const w = mount(Card, { props: { title: 't' } })
expect(w.text()).toContain('Tiêu đề mặc định')
expect(w.text()).toContain('Nội dung mặc định')
```

Nội dung giữa hai thẻ `<slot>` là **fallback** — hiện khi cha không truyền gì.

### Slot có tên

```vue
<Card title="t">
  <template #header>Tiêu đề của tôi</template>

  Nội dung chính (vào slot mặc định)

  <template #footer="{ count }">
    Có {{ count }} mục
  </template>
</Card>
```

`#header` là viết tắt của `v-slot:header`.

```ts
const w = mount(Card, {
  props: { title: 't' },
  slots: { header: 'H', default: 'B' },
})
expect(w.text()).toContain('H')
expect(w.text()).not.toContain('Tiêu đề mặc định')   // ✅ fallback bị thay
```

### ⭐ Scoped slot — dữ liệu đi **ngược** từ con lên cha

Đây là tính năng mạnh nhất của slot: component con **đưa dữ liệu cho cha** để cha quyết định hiển thị.

```vue
<slot name="footer" :count="42" />
```

```ts
const w = mount(Card, {
  slots: { footer: (p: { count: number }) => `co ${p.count}` },
})
expect(w.text()).toContain('co 42')     // ✅
```

Ứng dụng thật — một component `DataTable` lo phần tải dữ liệu và phân trang, nhưng để cha quyết định
mỗi hàng trông thế nào:

```vue
<DataTable :items="tasks">
  <template #row="{ item }">
    <td>{{ item.title }}</td>
    <td>{{ item.done ? 'Xong' : 'Chưa' }}</td>
  </template>
</DataTable>
```

Nhờ vậy `DataTable` tái dùng được cho mọi loại dữ liệu mà không cần biết gì về chúng.

---

## 5. `provide` / `inject` — xuyên nhiều tầng

Khi dữ liệu phải đi qua 4-5 tầng component, truyền props từng tầng rất mệt (*prop drilling*).

```vue
<!-- Provider.vue -->
<script setup lang="ts">
import { provide, ref } from 'vue'
const theme = ref('dark')
provide('theme', theme)
</script>
```

```vue
<!-- Consumer.vue — ở bất kỳ tầng nào bên dưới -->
<script setup lang="ts">
import { inject, type Ref } from 'vue'
const theme = inject<Ref<string>>('theme')
const missing = inject('khong-co', 'giá-trị-mặc-định')
</script>
```

Test:

```ts
const w = mount(Provider, { slots: { default: () => h(Consumer) } })
expect(w.get('.theme').text()).toBe('dark')      // ✅ xuyên tầng

const w2 = mount(Consumer)
expect(w2.get('.missing').text()).toBe('giá-trị-mặc-định')   // ✅ fallback
```

### Dùng Symbol + kiểu để an toàn

Khoá dạng chuỗi dễ gõ sai và không có kiểu:

```ts
// keys.ts
import type { InjectionKey, Ref } from 'vue'
export const themeKey = Symbol() as InjectionKey<Ref<string>>
```

```ts
provide(themeKey, theme)
const theme = inject(themeKey)     // kiểu tự suy ra Ref<string> | undefined
```

### ⚠️ Khi nào **không** dùng provide/inject

| Tình huống | Dùng |
|-----------|------|
| Truyền qua 1-2 tầng | Props |
| Truyền qua nhiều tầng, phạm vi một cây component | `provide`/`inject` |
| **State dùng chung toàn ứng dụng** | **Pinia** ([bài 06](./06-pinia-4.md)) |

`provide/inject` tạo phụ thuộc **ẩn** — nhìn component con không biết nó cần gì từ đâu. Lạm dụng thì
khó lần ra nguồn dữ liệu. Với state toàn cục, Pinia rõ ràng hơn và có DevTools.

---

## 6. `defineExpose` — mở API cho cha

Mặc định `<script setup>` **đóng kín**: cha lấy `ref` tới con cũng không gọi được gì bên trong.

```vue
<!-- Modal.vue -->
<script setup lang="ts">
import { ref } from 'vue'
const open = ref(false)

function show() { open.value = true }
function hide() { open.value = false }

defineExpose({ show, hide })
</script>
```

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
const modal = useTemplateRef('modal')
</script>

<template>
  <Modal ref="modal" />
  <button @click="modal?.show()">Mở</button>
</template>
```

> `useTemplateRef` là API của Vue 3.5. Trước đó phải khai `const modal = ref(null)` và tên biến **phải
> trùng** thuộc tính `ref` trong template.

Dùng ít thôi — gọi method của con là đi ngược luồng dữ liệu. Ưu tiên props/emit; `defineExpose` hợp cho
những thứ mang tính *lệnh* như mở modal, focus input, reset form.

---

## 7. Thuộc tính rơi xuống (fallthrough attributes)

Thuộc tính không khai trong `defineProps` **tự động** gắn vào thẻ gốc của component:

```vue
<MyButton class="mt-4" id="save" data-test="save-btn" />
```

Cả ba rơi thẳng xuống `<button>` bên trong. Rất tiện — không phải khai lại từng cái.

Component có **nhiều thẻ gốc** thì Vue không biết gắn vào đâu, phải chỉ rõ:

```vue
<script setup>
defineOptions({ inheritAttrs: false })
</script>

<template>
  <div>
    <button v-bind="$attrs">...</button>
  </div>
</template>
```

---

## 8. Đăng ký component

Với `<script setup>`, chỉ cần import:

```vue
<script setup lang="ts">
import TaskItem from '@/components/TaskItem.vue'
</script>

<template>
  <TaskItem :task="t" />
</template>
```

Không cần khai `components: { TaskItem }` như Options API.

### Component động

```vue
<component :is="currentTab" />
<component :is="isLink ? 'a' : 'button'" />
```

### Giữ trạng thái khi chuyển tab

```vue
<KeepAlive>
  <component :is="currentTab" />
</KeepAlive>
```

Không có `KeepAlive`, chuyển tab rồi quay lại là component bị dựng lại từ đầu, mất hết state.

---

## 9. So với React

| Việc | Vue | React |
|------|-----|-------|
| Truyền dữ liệu xuống | props | props |
| Báo lên trên | `emit` | callback prop (`onChange`) |
| Truyền giao diện | slot | `children` / render prop |
| Slot có tên | `#header` | prop nhận JSX |
| Scoped slot | `<slot :item="x">` | render prop |
| Xuyên tầng | `provide`/`inject` | Context |
| Hai chiều | `defineModel` | Tự viết `value` + `onChange` |

Vue tách bạch **props (vào)** và **emit (ra)**; React dùng props cho cả hai. Vue rõ ràng hơn khi đọc,
React linh hoạt hơn khi ghép.

---

## Bài tập

1. Viết `TaskItem` nhận prop `task` và `highlight` (mặc định `false`). Ở cha truyền thiếu `highlight`
   và kiểm tra class.

2. Trong component con, thử **hai** việc: gán trực tiếp `props.title = 'x'`, và sửa lồng
   `props.task.title = 'x'`. Cái nào có cảnh báo? Cái nào nguy hiểm hơn, vì sao?

3. Khai `defineEmits` **có kiểu**, rồi emit sai kiểu payload. Chạy `npm run type-check` và ghi lại lỗi.
   Trình duyệt có báo không?

4. Viết `SearchBox` dùng `defineModel`. Dùng `v-model` từ cha, gõ chữ và kiểm tra biến ở cha có đổi không.

5. Viết `Card` có 3 slot: `header`, mặc định, `footer` (scoped, truyền `count`). Dùng nó hai lần — một
   lần truyền đủ, một lần không truyền gì để thấy fallback.

6. Viết `DataTable` nhận `items` và có scoped slot `row`. Dùng nó cho hai loại dữ liệu khác nhau.

7. Dùng `provide`/`inject` truyền theme qua 3 tầng. Rồi đổi sang `InjectionKey` có kiểu và so sánh gợi ý
   của IDE.

8. Viết `Modal` có `defineExpose({ show, hide })`. Gọi `show()` từ cha bằng `useTemplateRef`. Rồi xoá
   `defineExpose` và xem chuyện gì xảy ra.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Chỉ gán trực tiếp mới cảnh báo:
```
[Vue warn] Set operation on key "title" failed: target is readonly.
```
Sửa lồng (`props.task.title = 'x'`) **không có cảnh báo** — và đó mới là cái nguy hiểm hơn, vì nó âm
thầm sửa dữ liệu của cha. `readonly` chỉ nông một tầng. Cách đúng: `emit('update', newTitle)` rồi để
cha sửa.

**3.**
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
```
Trình duyệt **không** báo — kiểu đã bị xoá lúc biên dịch. Chỉ `vue-tsc` bắt được, và nó bắt được cả
trong template.

**5.** Không truyền slot thì hiện nội dung fallback nằm giữa hai thẻ `<slot>`. Truyền rồi thì fallback
biến mất.

**8.** Không có `defineExpose`, `modal?.show()` là `undefined` — `<script setup>` đóng kín mặc định, cha
không thấy gì bên trong.

</details>

---

Tiếp theo: [04-composable-va-lifecycle.md](./04-composable-va-lifecycle.md)
