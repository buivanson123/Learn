# Bài 02 — Reactivity: `ref`, `reactive`, `computed`, `watch`

Đây là **bài quan trọng nhất** của cả bộ. Phần lớn câu hỏi "sao em sửa dữ liệu mà giao diện không đổi"
đều có nguyên nhân nằm trong 7 cái bẫy ở bài này.

Mọi khẳng định dưới đây được kiểm chứng bằng test chạy thật (14 test, tất cả pass).

---

## 1. Reactivity là gì

Bạn sửa một biến, Vue biết **đúng chỗ nào** trên màn hình cần vẽ lại.

Cơ chế: Vue bọc dữ liệu trong `Proxy`. Khi bạn **đọc** một giá trị trong lúc render (hoặc trong
`computed`/`watch`), Vue ghi lại "chỗ này phụ thuộc giá trị kia". Khi bạn **ghi**, Vue chạy lại đúng
những chỗ đã ghi nhận.

Khác React ở chỗ: bạn **không khai báo phụ thuộc**. Không có mảng dependency, không `useMemo`, không
`useCallback`. Vue tự phát hiện.

---

## 2. `ref` — dùng cho mọi thứ

```ts
import { ref } from 'vue'

const count = ref(0)
const name = ref('Sơn')
const user = ref({ id: 1, name: 'Sơn' })
const list = ref<string[]>([])
```

**Trong `<script>` phải có `.value`:**

```ts
count.value++
user.value.name = 'An'
list.value.push('a')
```

**Trong `<template>` thì không cần** — Vue tự bỏ `.value`:

```vue
<template>
  <p>{{ count }}</p>          <!-- không phải count.value -->
  <button @click="count++">+</button>
</template>
```

### ⚠️ Bẫy 1 — quên `.value` trong `<script>`

```ts
const n = ref(1)
n + 1        // ❌ KHÔNG phải 2
```

Test xác nhận:

```ts
const n = ref(1)
expect(n.value).toBe(1)
expect(n + 1).not.toBe(2)     // ✅ pass — n là object, không phải số
```

`n` là một object `{ value: 1 }`, nên `n + 1` cho ra chuỗi vô nghĩa hoặc `NaN`. TypeScript bắt được
việc này — đó là lý do nên dùng TS với Vue.

Dấu hiệu nhận ra: giao diện hiện `[object Object]`.

---

## 3. `reactive` — chỉ dùng cho object

```ts
import { reactive } from 'vue'

const state = reactive({ count: 0, user: { name: 'Sơn' } })
state.count++              // không cần .value
```

Nghe tiện hơn `ref`, nhưng có **ba hạn chế nghiêm trọng**.

### ⚠️ Bẫy 2 — destructure làm MẤT reactivity

```ts
const state = reactive({ count: 0 })
const { count } = state       // ← mất reactivity
state.count = 10
```

Test:

```ts
expect(count).toBe(0)         // ✅ vẫn là 0!
expect(state.count).toBe(10)
```

Vì `count` giờ chỉ là một số bình thường, không còn liên kết với proxy.

**Sửa bằng `toRefs`:**

```ts
import { toRefs } from 'vue'

const state = reactive({ count: 0 })
const { count } = toRefs(state)
state.count = 10
expect(count.value).toBe(10)   // ✅
```

### ⚠️ Bẫy 3 — gán lại cả object làm mất liên kết

```ts
let state = reactive({ count: 0 })
const original = state
state = reactive({ count: 99 })    // biến state trỏ chỗ khác
expect(original.count).toBe(0)     // ✅ object cũ không đổi
```

Template vẫn đang render `original`, nên giao diện **không cập nhật**.

`ref` không bị vấn đề này:

```ts
const state = ref({ count: 0 })
state.value = { count: 99 }
expect(state.value.count).toBe(99)  // ✅ template thấy ngay
```

### Hạn chế thứ ba

`reactive` **chỉ nhận object/array/Map/Set**. Không dùng được cho số, chuỗi, boolean.

### ⭐ Kết luận: dùng `ref` cho mọi thứ

Đây là khuyến nghị chính thức của Vue và cũng là điều thực dụng nhất:

| | `ref` | `reactive` |
|---|-------|------------|
| Kiểu nguyên thuỷ | ✅ | ❌ |
| Gán lại cả giá trị | ✅ | ❌ mất liên kết |
| Destructure | ✅ (bản thân nó là ref) | ❌ mất reactivity |
| Phải viết `.value` | Có (chỉ trong script) | Không |

Cái giá của `ref` là phải gõ `.value`. Đổi lại bạn không bao giờ vấp bẫy 2 và 3.

---

## 4. Hai hành vi unwrap cần nhớ

### `ref` lồng trong `reactive` được unwrap tự động

```ts
const count = ref(0)
const state = reactive({ count })

expect(state.count).toBe(0)      // ✅ không cần .value
state.count = 5
expect(count.value).toBe(5)      // ✅ đồng bộ hai chiều
```

### ⚠️ Bẫy 4 — `ref` trong ARRAY thì KHÔNG unwrap

```ts
const count = ref(0)
const arr = reactive([count])

expect(arr[0]).not.toBe(0)       // ✅ vẫn là ref object
expect(isRef(arr[0])).toBe(true)
expect(arr[0].value).toBe(0)     // phải có .value
```

Cùng một `ref`, đặt trong object thì tự unwrap, đặt trong array thì không. Đây là chỗ rất dễ nhầm khi
làm việc với danh sách.

Cách tránh: đừng nhét `ref` vào array. Dùng `ref` cho **cả mảng** thay vì mảng các `ref`:

```ts
const items = ref([{ id: 1 }, { id: 2 }])    // ✅
```

---

## 5. `computed` — giá trị dẫn xuất, có cache

```ts
import { ref, computed } from 'vue'

const items = ref([{ done: true }, { done: false }])
const remaining = computed(() => items.value.filter(i => !i.done).length)
```

### ⭐ `computed` có cache — đo thật

```ts
const spy = vi.fn()
const n = ref(1)
const double = computed(() => { spy(); return n.value * 2 })

double.value; double.value; double.value    // đọc 3 lần
expect(spy).toHaveBeenCalledTimes(1)        // ✅ chỉ tính 1 lần

n.value = 2
double.value
expect(spy).toHaveBeenCalledTimes(2)        // ✅ mới tính lại
```

Đây là khác biệt then chốt với **method**:

```vue
<template>
  <p>{{ remaining }}</p>       <!-- computed: tính 1 lần, dùng lại -->
  <p>{{ getRemaining() }}</p>  <!-- method: tính LẠI mỗi lần render -->
</template>
```

Với danh sách lớn hoặc tính toán nặng, khác biệt này rất lớn.

**Quy tắc:** giá trị **dẫn xuất từ state** → `computed`. Việc cần **làm** khi người dùng tương tác →
method.

### `computed` ghi được (ít dùng)

```ts
const fullName = computed({
  get: () => `${first.value} ${last.value}`,
  set: (v: string) => {
    [first.value, last.value] = v.split(' ')
  },
})
```

### ⚠️ Đừng gây tác dụng phụ trong `computed`

```ts
// ❌ computed phải THUẦN
const bad = computed(() => {
  fetch('/api/log')          // gọi API
  count.value++              // sửa state
  return items.value.length
})
```

`computed` có thể chạy lại bất cứ lúc nào Vue thấy cần. Cần tác dụng phụ thì dùng `watch`.

---

## 6. `watch` — phản ứng khi dữ liệu đổi

```ts
import { watch } from 'vue'

watch(searchQuery, async (moi, cu) => {
  results.value = await search(moi)
})
```

### `watch` không chạy ngay

```ts
const n = ref(1)
const spy = vi.fn()
watch(n, spy)

expect(spy).not.toHaveBeenCalled()     // ✅ chưa chạy
n.value = 2
await nextTick()
expect(spy).toHaveBeenCalledWith(2, 1, expect.anything())   // (mới, cũ, onCleanup)
```

Muốn chạy ngay: `{ immediate: true }`.

### ⚠️ Bẫy 5 — `watch` trên `ref` của object không bắt được thay đổi bên trong

```ts
const user = ref({ name: 'a' })
const spy = vi.fn()
watch(user, spy)

user.value.name = 'b'         // sửa BÊN TRONG
await nextTick()
expect(spy).not.toHaveBeenCalled()    // ✅ KHÔNG bắt được
```

Vì `user.value` vẫn là **cùng một object** — tham chiếu không đổi.

**Ba cách sửa:**

```ts
// 1. deep
watch(user, spy, { deep: true })          // ✅ bắt được

// 2. watch đúng thứ cần
watch(() => user.value.name, spy)         // ✅ chỉ bắt name

// 3. dùng reactive (tự động deep)
const state = reactive({ user: { name: 'a' } })
watch(state, spy)                          // ✅ bắt được
```

Test xác nhận cả ba.

⚠️ `deep: true` phải duyệt toàn bộ cây object mỗi lần kiểm tra — **đắt** với dữ liệu lớn. Ưu tiên cách 2.

### Watch getter — chính xác nhất

```ts
const state = reactive({ a: 1, b: 1 })
const spy = vi.fn()
watch(() => state.a, spy)

state.b = 99
await nextTick()
expect(spy).not.toHaveBeenCalled()    // ✅ không bận tâm b

state.a = 2
await nextTick()
expect(spy).toHaveBeenCalled()        // ✅ chỉ phản ứng a
```

### Watch nhiều nguồn

```ts
watch([a, b], ([aMoi, bMoi], [aCu, bCu]) => { /* ... */ })
```

### Dọn dẹp — quan trọng khi gọi API

```ts
watch(query, async (q, _cu, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())      // huỷ request cũ

  results.value = await fetch(`/api?q=${q}`, { signal: controller.signal })
})
```

Không có `onCleanup`, gõ nhanh sẽ có nhiều request chạy song song và **request cũ về sau có thể ghi
đè kết quả mới** (race condition).

---

## 7. `watchEffect` — tự tìm phụ thuộc

```ts
const n = ref(1)
const spy = vi.fn()
watchEffect(() => { spy(n.value) })

expect(spy).toHaveBeenCalledTimes(1)   // ✅ CHẠY NGAY
n.value = 2
await nextTick()
expect(spy).toHaveBeenCalledTimes(2)
```

| | `watch` | `watchEffect` |
|---|---------|---------------|
| Khai nguồn | Tường minh | Tự phát hiện |
| Chạy ngay | Không (trừ `immediate`) | **Có** |
| Có giá trị cũ | ✅ | ❌ |
| Kiểm soát | Chính xác hơn | Ngắn gọn hơn |

**Chọn thế nào:** cần giá trị cũ hoặc muốn kiểm soát chính xác → `watch`. Đồng bộ nhiều thứ và không
quan tâm cái nào đổi → `watchEffect`.

⚠️ `watchEffect` chỉ theo dõi thứ được đọc **đồng bộ**. Giá trị đọc **sau** `await` sẽ không được ghi nhận:

```ts
watchEffect(async () => {
  const a = x.value          // ✅ được theo dõi
  await sleep(100)
  const b = y.value          // ❌ KHÔNG được theo dõi
})
```

---

## 8. `nextTick` — chờ DOM cập nhật

Vue gom nhiều thay đổi rồi cập nhật DOM **một lần** ở cuối tick. Nên ngay sau khi sửa state, DOM chưa đổi:

```ts
count.value++
console.log(el.textContent)      // ❌ vẫn giá trị cũ

await nextTick()
console.log(el.textContent)      // ✅ đã cập nhật
```

Cần khi: đo kích thước phần tử, cuộn tới vị trí mới, focus vào input vừa hiện ra.

---

## 9. Bảng tra 7 cái bẫy

| # | Bẫy | Triệu chứng | Sửa |
|---|-----|-------------|-----|
| 1 | Quên `.value` trong script | Hiện `[object Object]`, phép tính sai | Thêm `.value`; dùng TypeScript |
| 2 | Destructure `reactive()` | Giao diện không đổi | `toRefs()`, hoặc dùng `ref` |
| 3 | Gán lại object cho `reactive` | Giao diện không đổi | Dùng `ref` |
| 4 | `ref` trong array không unwrap | `[object Object]` trong danh sách | Dùng `ref` cho cả mảng |
| 5 | `watch` ref object không deep | Watch không chạy | `deep: true` hoặc watch getter |
| 6 | Tác dụng phụ trong `computed` | Chạy nhiều lần bất ngờ | Chuyển sang `watch` |
| 7 | Đọc DOM ngay sau khi sửa state | Giá trị cũ | `await nextTick()` |

---

## 10. So với React

| Việc | Vue | React |
|------|-----|-------|
| State | `ref(0)` | `useState(0)` |
| Sửa state | `n.value++` | `setN(n + 1)` |
| Giá trị dẫn xuất | `computed(() => ...)` | `useMemo(() => ..., [deps])` |
| Phản ứng khi đổi | `watch(x, fn)` | `useEffect(fn, [x])` |
| Khai phụ thuộc | **Không cần** | Bắt buộc (mảng deps) |
| Component render lại | Chỉ khi phụ thuộc đổi | Mặc định render lại cả cây |

Khác biệt lớn nhất: Vue **theo dõi ở mức từng giá trị**, React render lại cả component rồi so sánh.
Nên Vue không cần `useMemo`/`useCallback` để tránh render thừa.

Đánh đổi: Vue có `.value` và vài cái bẫy unwrap; React thì mọi thứ là giá trị thường nhưng phải tự khai
dependency.

---

## Bài tập

1. Viết `const n = ref(1)` rồi `console.log(n + 1)`. Kết quả là gì? Sửa lại cho đúng.

2. Tạo `reactive({ count: 0 })`, destructure `count` ra, rồi sửa `state.count`. Giao diện có đổi không?
   Sửa bằng `toRefs` và kiểm tra lại.

3. Khai `let state = reactive({ count: 0 })` rồi gán `state = reactive({ count: 99 })`. Vì sao giao diện
   không đổi? Viết lại bằng `ref`.

4. Đặt một `ref` vào trong object reactive và vào trong array reactive. In cả hai ra. Cái nào cần
   `.value`?

5. Viết `computed` có `console.log` bên trong. Đọc nó 5 lần trong template. Log in ra mấy lần? Đổi
   thành method và so sánh.

6. Viết `watch` trên một `ref` chứa object. Sửa một trường bên trong. Watch có chạy không? Thử cả ba
   cách sửa ở mục 6.

7. Viết `watchEffect` đọc `x.value`, rồi `await`, rồi đọc `y.value`. Sửa `y` — effect có chạy lại không?

8. Sửa một `ref` rồi đọc `textContent` của phần tử tương ứng ngay lập tức. Thêm `await nextTick()` và
   so sánh.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `n` là object `{ value: 1 }` nên `n + 1` không phải `2`. Đúng là `n.value + 1`.

**2.** Không đổi. `const { count } = state` copy **giá trị** ra một biến thường, cắt đứt liên kết với
proxy. `toRefs(state)` giữ được vì mỗi trường thành một `ref`.

**3.** `state` giờ trỏ vào object mới, nhưng template vẫn render object cũ. `ref` không bị vì template
luôn đọc qua `.value`.

**4.** Trong object: **không** cần `.value` (tự unwrap). Trong array: **cần** `.value`.

**5.** `computed` in **1 lần**; method in **5 lần**. Đó là cache của `computed`.

**6.** Không chạy — tham chiếu object không đổi. Ba cách: `{ deep: true }`, watch getter
`() => user.value.name`, hoặc dùng `reactive` (tự deep).

**7.** **Không**. `watchEffect` chỉ ghi nhận phụ thuộc đọc **đồng bộ**; mọi thứ sau `await` nằm ngoài
phạm vi theo dõi.

</details>

---

Tiếp theo: [03-component.md](./03-component.md)
