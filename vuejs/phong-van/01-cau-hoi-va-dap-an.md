# 50 câu hỏi phỏng vấn Vue + đáp án

Che đáp án, tự trả lời thành tiếng. ⭐ = rất hay gặp.

Đáp án dựa trên **Vue 3.5 + vue-router 5 + Pinia 4**, kèm kết quả test chạy thật.

| Mục | Chủ đề | Số câu |
|-----|--------|--------|
| [A](#a--reactivity) | Reactivity | 14 |
| [B](#b--template) | Template | 7 |
| [C](#c--component) | Component | 10 |
| [D](#d--hệ-sinh-thái) | Router, Pinia | 9 |
| [E](#e--thực-chiến) | Thực chiến | 6 |
| [F](#f--so-với-react) | So với React | 4 |

---

## A — Reactivity

### A1 ⭐⭐ Reactivity trong Vue hoạt động thế nào?

**Ngắn:** Vue bọc dữ liệu trong `Proxy`. Khi bạn **đọc** một giá trị lúc render, Vue ghi lại "chỗ này
phụ thuộc giá trị kia". Khi bạn **ghi**, Vue chạy lại đúng những chỗ đã ghi nhận.

**Đào sâu:** Khác biệt cốt lõi với React: **bạn không khai báo phụ thuộc**. Không có mảng dependency,
không `useMemo`, không `useCallback` — Vue tự phát hiện lúc chạy.

Vue 2 dùng `Object.defineProperty` nên không phát hiện được việc **thêm thuộc tính mới** (phải dùng
`Vue.set`). Vue 3 dùng `Proxy` nên hết vấn đề đó.

Hệ quả thực tế: khi state đổi, Vue chỉ render lại **component phụ thuộc nó**, không phải cả cây.

### A2 ⭐⭐ `ref` khác `reactive` thế nào? Nên dùng cái nào?

**Ngắn:** `ref` dùng được cho **mọi kiểu** và cần `.value`; `reactive` chỉ nhận object và không cần
`.value`. **Khuyến nghị: dùng `ref` cho mọi thứ.**

**Đào sâu:** `reactive` có **ba hạn chế** đã kiểm chứng bằng test:

**1. Không dùng được cho kiểu nguyên thuỷ.**

**2. Destructure là mất reactivity:**
```ts
const state = reactive({ count: 0 })
const { count } = state
state.count = 10
expect(count).toBe(0)          // ✅ test pass — vẫn là 0!
```

**3. Gán lại cả object thì mất liên kết:**
```ts
let state = reactive({ count: 0 })
const original = state
state = reactive({ count: 99 })
expect(original.count).toBe(0)  // template vẫn render object cũ
```

`ref` không bị cả ba. Cái giá là phải gõ `.value` trong `<script>` — trong `<template>` thì Vue tự bỏ.

### A3 ⭐ Vì sao `ref` cần `.value`?

**Ngắn:** Vì JavaScript không chặn được việc đọc/ghi một **biến** — chỉ chặn được thuộc tính của object.

**Đào sâu:** `ref(0)` trả về object `{ value: 0 }` để Vue có thứ để bọc `Proxy`. Không có `.value` thì
`n = 5` chỉ gán lại biến, Vue không biết gì.

Trong template Vue tự unwrap vì trình biên dịch biết biến nào là `ref`.

### A4 `toRefs` và `toRef` để làm gì?

**Ngắn:** Biến thuộc tính của object reactive thành `ref` để destructure mà không mất reactivity.

```ts
const { count } = toRefs(state)
count.value       // ✅ vẫn liên kết với state
const c = toRef(state, 'count')
```

Hay dùng khi composable nhận `reactive` làm tham số và cần trả về từng phần.

### A5 ⭐ `ref` lồng trong `reactive` — có cần `.value` không?

**Ngắn:** Trong **object** thì không (tự unwrap); trong **array** thì có.

**Đào sâu:** Test:

```ts
const count = ref(0)
const state = reactive({ count })
expect(state.count).toBe(0)        // ✅ tự unwrap
state.count = 5
expect(count.value).toBe(5)        // đồng bộ hai chiều

const arr = reactive([count])
expect(isRef(arr[0])).toBe(true)   // ✅ KHÔNG unwrap
expect(arr[0].value).toBe(0)
```

Đây là chỗ rất dễ nhầm. Cách tránh: đừng nhét `ref` vào array — dùng `ref` cho **cả mảng**.

### A6 ⭐⭐ `computed` khác `watch` khác method thế nào?

**Ngắn:** `computed` trả **giá trị** và **có cache**; `watch` **làm gì đó** khi dữ liệu đổi; method chạy
lại **mỗi lần render**.

**Đào sâu:** Test chứng minh cache:

```ts
const spy = vi.fn()
const double = computed(() => { spy(); return n.value * 2 })
double.value; double.value; double.value
expect(spy).toHaveBeenCalledTimes(1)     // ✅ chỉ tính 1 lần
```

Method trong template thì tính lại **mỗi lần render** — với danh sách lớn là khác biệt lớn.

**Quy tắc:** cần **giá trị** dẫn xuất → `computed`. Cần **làm gì đó** (gọi API, lưu localStorage) →
`watch`. Việc chạy khi người dùng bấm → method.

### A7 `watch` khác `watchEffect` thế nào?

**Ngắn:** `watch` khai nguồn tường minh và **không chạy ngay**; `watchEffect` tự tìm phụ thuộc và **chạy
ngay**.

**Đào sâu:**

```ts
watch(n, spy)
expect(spy).not.toHaveBeenCalled()      // ✅ chưa chạy

watchEffect(() => spy(n.value))
expect(spy).toHaveBeenCalledTimes(1)    // ✅ chạy ngay
```

`watch` cho bạn **giá trị cũ**; `watchEffect` thì không.

⚠️ `watchEffect` chỉ theo dõi thứ đọc **đồng bộ** — giá trị đọc sau `await` không được ghi nhận.

### A8 ⭐ Vì sao `watch` không chạy khi tôi sửa thuộc tính bên trong object?

**Ngắn:** Vì tham chiếu object không đổi.

```ts
const user = ref({ name: 'a' })
watch(user, spy)
user.value.name = 'b'
expect(spy).not.toHaveBeenCalled()     // ✅ KHÔNG chạy
```

**Ba cách sửa:**

```ts
watch(user, spy, { deep: true })       // ✅ nhưng đắt với object lớn
watch(() => user.value.name, spy)      // ✅ chính xác nhất, rẻ nhất
// hoặc dùng reactive() — tự động deep
```

Đây là nguyên nhân số một của "dữ liệu không lưu vào localStorage".

### A9 `deep: true` có nhược điểm gì?

**Ngắn:** Vue phải duyệt **toàn bộ cây object** mỗi lần kiểm tra — đắt với dữ liệu lớn.

**Đào sâu:** Ưu tiên watch getter (`() => obj.a.b`) khi biết chính xác cần theo dõi gì. `deep` chỉ dùng
khi thật sự cần bắt mọi thay đổi ở mọi tầng — ví dụ lưu cả state vào localStorage.

### A10 `nextTick` để làm gì?

**Ngắn:** Chờ Vue cập nhật DOM xong.

**Đào sâu:** Vue gom nhiều thay đổi rồi cập nhật DOM **một lần** ở cuối tick. Nên ngay sau khi sửa
state, DOM vẫn là cũ:

```ts
show.value = true
await nextTick()
input.value?.focus()      // ✅ giờ input mới tồn tại
```

Cần khi: focus vào phần tử vừa hiện, đo kích thước, cuộn tới vị trí mới.

### A11 `shallowRef` và `shallowReactive` dùng khi nào?

**Ngắn:** Khi bạn có object lớn mà chỉ cần biết **cả object bị thay** chứ không cần theo dõi từng tầng.

**Đào sâu:** `ref` sâu phải bọc `Proxy` đệ quy toàn bộ cây — tốn kém với dữ liệu lớn (bảng 10.000 dòng,
instance của thư viện bên thứ ba như bản đồ, biểu đồ).

```ts
const chart = shallowRef(new Chart(...))   // không cần reactivity bên trong
```

### A12 `readonly` để làm gì?

**Ngắn:** Tạo bản chỉ đọc của một object reactive — dùng khi `provide` xuống mà không muốn con sửa.

```ts
provide('state', readonly(state))
```

⚠️ `readonly` sâu, nhưng props thì chỉ **nông một tầng** — xem [C3](#c3--props-có-thật-sự-readonly-không).

### A13 `markRaw` dùng khi nào?

**Ngắn:** Đánh dấu một object để Vue **không** biến nó thành reactive.

**Đào sâu:** Dùng cho instance của thư viện bên thứ ba (bản đồ Leaflet, biểu đồ) — bọc `Proxy` chúng vừa
tốn kém vừa có thể làm hỏng thư viện.

### A14 Vì sao Vue nhanh hơn khi state đổi?

**Ngắn:** Vue theo dõi ở mức **từng giá trị**, nên chỉ render lại component thật sự phụ thuộc nó.

**Đào sâu:** React mặc định render lại cả cây con rồi so sánh — nên cần `memo`/`useMemo`/`useCallback`
để tối ưu. Vue biết chính xác chỗ nào cần đổi nên không cần những thứ đó.

Đánh đổi: Vue phải bọc `Proxy` (tốn bộ nhớ), và có vài bẫy unwrap mà React không có.

---

## B — Template

### B1 ⭐⭐ Vì sao `:key` trong `v-for` quan trọng?

**Ngắn:** Vue dùng `key` để biết phần tử nào là phần tử nào khi danh sách đổi. Không có nó, Vue tái dùng
DOM **theo vị trí**.

**Đào sâu:** Triệu chứng khi thiếu hoặc sai `key`:

- Ô input đang gõ dở **nhảy sang hàng khác**
- Xoá hàng này thì hàng khác biến mất
- Checkbox tick nhầm dòng

⚠️ Điểm quan trọng khi trả lời: **Vue 3.5 không cảnh báo gì khi key trùng.** Tôi đã thử cả lúc mount lẫn
lúc cập nhật — console im lặng. Chỉ có hành vi sai.

**Quy tắc:** `key` phải **ổn định và duy nhất**. Dùng `crypto.randomUUID()` thay `Date.now()` — hai mục
tạo cùng mili giây sẽ trùng.

**Đừng dùng index** khi danh sách có thể sắp xếp lại/chèn/xoá giữa chừng.

### B2 ⭐ `v-if` khác `v-show` thế nào?

**Ngắn:** `v-if` **xoá khỏi DOM**; `v-show` giữ lại và chỉ đặt `display: none`.

| | `v-if` | `v-show` |
|---|--------|----------|
| Chi phí lúc chuyển | Cao | Thấp |
| Chi phí lúc đầu | Thấp | Cao |
| Có `v-else` | ✅ | ❌ |
| Dùng với `<template>` | ✅ | ❌ |

**Chọn:** đổi thường xuyên (tab, dropdown) → `v-show`. Hiếm khi đổi hoặc nội dung nặng → `v-if`.

### B3 Vì sao không đặt `v-if` và `v-for` trên cùng một thẻ?

**Ngắn:** Trong Vue 3, `v-if` chạy **trước** `v-for` nên biến vòng lặp chưa tồn tại.

```
[Vue warn]: Property "t" was accessed during render but is not defined on instance.
```

**Sửa:** lọc bằng `computed` (tốt nhất — có cache), hoặc bọc `<template v-for>`.

> Vue 2 thì ngược lại — `v-for` ưu tiên hơn. Đây là breaking change hay gây nhầm.

### B4 `{{ }}` có an toàn không?

**Ngắn:** Có — nó tự escape HTML.

```ts
expect(w.get('.interp').html()).toContain('&lt;b&gt;')   // ✅ đã escape
```

`v-html` thì **không** escape — dùng với dữ liệu người dùng là lỗ hổng XSS.

### B5 `v-model` thực chất là gì?

**Ngắn:** Đường tắt của `:value` + `@input`.

```vue
<input v-model="name">
<!-- ≈ -->
<input :value="name" @input="name = $event.target.value">
```

Vue tự chọn đúng thuộc tính/sự kiện theo loại input (checkbox dùng `:checked`/`@change`, select dùng
`@change`).

### B6 ⭐ Vì sao cần `v-model.number`?

**Ngắn:** Giá trị `<input>` **luôn là chuỗi**, kể cả `type="number"`.

```ts
// không có .number
typeof age      // "string"
age + 1         // "251"  ← nối chuỗi
```

Tương tự `.trim` rất nên dùng cho ô text.

### B7 Modifier của `v-on` hay dùng?

```vue
@submit.prevent      <!-- thay event.preventDefault() -->
@click.stop          <!-- thay stopPropagation() -->
@click.self          <!-- chỉ khi bấm đúng thẻ này -->
@click.once
@keyup.enter  @keyup.esc  @keydown.ctrl.s.prevent
```

`@submit.prevent` là cái dùng nhiều nhất — thiếu là trang tải lại và mất hết dữ liệu form.

---

## C — Component

### C1 ⭐ Dữ liệu đi giữa component thế nào?

**Ngắn:** Xuống bằng **props**, lên bằng **emit**. Truyền giao diện bằng **slot**. Xuyên nhiều tầng
bằng **provide/inject**.

**Đào sâu:** Luồng một chiều là thứ khiến ứng dụng Vue dễ lần ra nguồn gốc dữ liệu — nhìn là biết ai
sửa cái gì.

### C2 `defineProps`/`defineEmits` có cần import không?

**Ngắn:** Không. Chúng là **macro biên dịch**, không phải hàm runtime.

**Đào sâu:** Hệ quả: chỉ dùng được ở cấp cao nhất của `<script setup>`, và **không** dùng được biến bên
ngoài trong đối số của chúng.

### C3 ⭐ Props có thật sự readonly không?

**Ngắn:** Chỉ ở **tầng ngoài cùng**.

**Đào sâu:** Đã đo thật:

```
props.title = 'moi'        → [Vue warn] Set operation on key "title" failed: target is readonly.
props.task.title = 'moi'   → (KHÔNG có cảnh báo nào)
```

Trường hợp thứ hai **nguy hiểm hơn**: nó thật sự sửa dữ liệu của cha, giao diện có thể cập nhật, và bạn
tưởng mọi thứ ổn — cho tới khi phải tìm xem ai đã đổi dữ liệu.

Nói được chi tiết này là điểm cộng rõ rệt.

### C4 ⭐ `v-model` trên component làm thế nào?

**Ngắn:** `defineModel()` — Vue 3.4+.

```ts
const model = defineModel<string>({ default: '' })
```

Nó tự sinh prop `modelValue` và sự kiện `update:modelValue`. Ghi vào `model` là tự động emit.

Cách cũ phải viết tay props + emit. Nhiều `v-model`: `defineModel('first')` → `v-model:first`.

### C5 Slot để làm gì? Scoped slot khác gì?

**Ngắn:** Slot truyền **giao diện** vào component. Scoped slot cho component con **đưa dữ liệu ngược lên**
cho cha quyết định hiển thị.

**Đào sâu:**

```vue
<slot name="row" :item="x" />
```

```vue
<DataTable :items="tasks">
  <template #row="{ item }">{{ item.title }}</template>
</DataTable>
```

Nhờ vậy `DataTable` lo phân trang/tải dữ liệu mà **không cần biết** dữ liệu trông thế nào — tái dùng
được cho mọi loại.

### C6 `provide`/`inject` khi nào dùng, khi nào không?

**Ngắn:** Dùng khi truyền qua nhiều tầng trong **một cây component**. **Không** dùng cho state toàn cục
— đó là việc của Pinia.

**Đào sâu:** `provide/inject` tạo phụ thuộc **ẩn** — nhìn component con không biết nó cần gì từ đâu.
Pinia rõ ràng hơn và có DevTools.

Dùng `InjectionKey` + `Symbol` để có kiểu và tránh gõ sai khoá.

### C7 Vì sao gọi method của component con ra `undefined`?

**Ngắn:** `<script setup>` **đóng kín** mặc định.

**Sửa:** `defineExpose({ show, hide })` trong component con.

Dùng ít thôi — gọi method của con là đi ngược luồng dữ liệu. Hợp cho việc mang tính *lệnh*: mở modal,
focus input, reset form.

### C8 Kể các hook vòng đời hay dùng.

**Ngắn:** `onMounted` (gọi API, đo DOM, đăng ký listener) và `onUnmounted` (dọn dẹp).

**Đào sâu:** ⚠️ Không gỡ listener/timer trong `onUnmounted` là **rò rỉ bộ nhớ** — vào ra trang 20 lần
thì có 20 listener còn sống.

### C9 Composable là gì? Khác Pinia chỗ nào?

**Ngắn:** Composable là hàm bắt đầu bằng `use`, dùng được API reactivity. **Mỗi lần gọi tạo state mới**;
Pinia store là **một bản dùng chung**.

**Đào sâu:** Ba quy tắc: gọi ở cấp cao nhất của `setup`, trả về `ref` (không trả `.value`), dùng
`toValue` cho tham số nhận `MaybeRefOrGetter`.

### C10 `<KeepAlive>` để làm gì?

**Ngắn:** Giữ state của component khi chuyển đi rồi quay lại.

**Đào sâu:** Không có nó, chuyển tab rồi quay lại là component bị dựng lại từ đầu — mất hết state, ô
input trống, phải gọi API lại.

---

## D — Hệ sinh thái

### D1 ⭐ Pinia là gì? Khác Vuex thế nào?

**Ngắn:** Thư viện state chính thức, thay Vuex. Khác lớn nhất: **không có mutations** — action sửa state
trực tiếp.

| | Pinia | Vuex 4 |
|---|-------|--------|
| Mutations | Không | Bắt buộc |
| TypeScript | Suy kiểu tự động | Khai tay nhiều |
| Module lồng | Không (phẳng) | Có |

### D2 ⭐⭐ Vì sao destructure store làm mất reactivity?

**Ngắn:** Store là object reactive — destructure copy giá trị ra biến thường.

```ts
const { remaining } = store
store.add('a')
expect(remaining).toBe(0)      // ✅ test pass — vẫn 0!
```

**Sửa:** `storeToRefs(store)` cho **state và getters**; actions destructure thẳng (là hàm, không cần
reactivity).

Đây là lỗi hay gặp nhất khi dùng Pinia.

### D3 Setup store khác options store thế nào?

**Ngắn:** Setup store dùng cú pháp giống `<script setup>` (`ref`/`computed`/`function`); options store
giống Vuex (`state`/`getters`/`actions`).

⚠️ Setup store **không có `$reset()`**:

```
🍍: Store "tasks" is built using the setup syntax and does not implement $reset().
```

Phải tự viết action gán lại từng giá trị.

### D4 `$patch` để làm gì?

**Ngắn:** Sửa nhiều trường trong **một** lần cập nhật.

```ts
store.$patch({ filter: 'active', sortBy: 'date' })
store.$patch((s) => { s.items.push(x) })
```

DevTools hiện một mục thay vì nhiều, và Vue chỉ render lại một lần.

### D5 Lưu state vào localStorage thế nào?

**Ngắn:** `watch` với `{ deep: true }`, hoặc plugin `pinia-plugin-persistedstate`.

⚠️ Thiếu `deep: true` thì `push` vào mảng **không được lưu**.

### D6 ⭐ `useRoute` khác `useRouter` thế nào?

**Ngắn:** `useRoute()` để **đọc** (params, query, meta); `useRouter()` để **điều hướng** (push, replace).

Mẹo nhớ: `route` = danh từ (nơi đang ở), `router` = công cụ đưa bạn đi.

### D7 ⭐ Vì sao nên dùng `props: true` trong route?

**Ngắn:** Để component nhận params như **props thường**, không phụ thuộc router.

**Đào sâu:** Nhờ vậy component **test được mà không cần dựng router**, và tái dùng được ở nơi không có
route:

```ts
mount(TaskDetail, { props: { id: '1' } })     // ✅ đơn giản
```

Dùng `useRoute()` thì phải cài router giả vào test.

### D8 ⭐ Vì sao F5 ở trang con ra 404?

**Ngắn:** `createWebHistory` tạo URL thật; server đi tìm file `/tasks/1` không tồn tại.

**Sửa:** cấu hình server rewrite mọi đường dẫn về `index.html`:

```nginx
try_files $uri $uri/ /index.html;
```

Hoặc dùng `createWebHashHistory()` — URL thành `/#/tasks/1`, chạy được mọi nơi.

### D9 Navigation guard viết thế nào?

```ts
router.beforeEach((to) => {
  if (to.meta.requiresAuth && !ok) return { name: 'login', query: { redirect: to.fullPath } }
  return true
})
```

Trả `true`/không gì = cho đi; `false` = huỷ; object = chuyển hướng.

> Từ vue-router 4 trở đi dùng **giá trị trả về**, không dùng `next()` nữa.

---

## E — Thực chiến

### E1 ⭐ Gọi API trong Vue làm thế nào?

**Ngắn:** Bộ ba `data`/`loading`/`error`, đặt `loading = false` trong `finally`.

**Đào sâu:** ⚠️ Hai điều hay sai:

1. **`fetch` KHÔNG ném lỗi với HTTP 404/500** — phải tự kiểm `res.ok`.
2. **`loading = false` phải ở `finally`** — để trong `try` thì gặp lỗi là spinner quay mãi.

Và bốn trạng thái giao diện: loading → error → có dữ liệu → **rỗng**. Thiếu trạng thái rỗng là lỗi UX
hay gặp.

### E2 Chống race condition khi tìm kiếm?

**Ngắn:** `AbortController` + `onCleanup` của `watch`, cộng debounce.

```ts
watch(query, async (q, _o, onCleanup) => {
  const c = new AbortController()
  onCleanup(() => c.abort())
  await fetch(url, { signal: c.signal })
})
```

Không có nó, gõ nhanh sẽ có nhiều request song song và **request cũ về sau ghi đè kết quả mới**.

### E3 Validate form thế nào?

**Ngắn:** Form nhỏ dùng `computed` trả về object lỗi; form lớn dùng Zod hoặc VeeValidate.

**Đào sâu:** ⭐ Cần biến `touched` — không có nó, lỗi "không được để trống" hiện **ngay khi mở form**,
người dùng chưa gõ gì đã thấy đỏ.

### E4 Tối ưu hiệu năng Vue?

**Ngắn:** Theo thứ tự: `computed` thay method trong template · `:key` ổn định · lazy load route và
component nặng · `shallowRef` cho dữ liệu lớn · `v-once` cho nội dung tĩnh.

**Đào sâu:** Vue **không cần** `memo`/`useCallback` như React — nó đã theo dõi ở mức từng giá trị.

Với danh sách rất dài (>1000 dòng) thì dùng virtual scrolling (`vue-virtual-scroller`).

### E5 Test Vue thế nào?

**Ngắn:** Vitest + `@vue/test-utils`. Store test dễ nhất — là JavaScript thuần.

```ts
beforeEach(() => setActivePinia(createPinia()))    // ⚠️ bắt buộc
const w = mount(Comp, { props: {...} })
await w.get('button').trigger('click')
expect(w.emitted('toggle')).toEqual([[1]])
```

⚠️ **Vitest không kiểm tra kiểu.** Test xanh ≠ build xanh — phải chạy `npm run type-check`.

### E6 Tổ chức project Vue lớn thế nào?

**Ngắn:** Theo **feature**, không theo loại file.

```
src/
├── features/tasks/{components,composables,stores,types}
├── shared/{components,composables,utils}
└── views/
```

Cách theo loại (`components/`, `stores/` ở gốc) khiến sửa một tính năng phải mở 5 thư mục.

---

## F — So với React

### F1 ⭐⭐ Vue khác React chỗ nào?

**Đây là câu bẫy.** Đừng trả lời "Vue dễ hơn" — nêu **khác biệt kỹ thuật** trước.

**Ngắn:**

> "Khác biệt cốt lõi là **cách theo dõi thay đổi**. Vue theo dõi ở mức từng giá trị bằng Proxy, nên khi
> state đổi nó biết chính xác chỗ nào cần render lại. React render lại cả cây con rồi so sánh virtual
> DOM.
>
> Hệ quả thực tế: Vue không cần khai dependency — không có `useMemo`, `useCallback`, `React.memo`.
> Đổi lại React linh hoạt hơn vì component chỉ là hàm, và hệ sinh thái lớn hơn."

**Đào sâu** (khi được hỏi thêm):

| | Vue | React |
|---|-----|-------|
| Theo dõi thay đổi | Proxy, từng giá trị | Render lại + so sánh |
| Khai phụ thuộc | Tự động | Bắt buộc (mảng deps) |
| Template | Cú pháp riêng, biên dịch được | JSX, là JavaScript |
| Hai chiều | `v-model` sẵn | Tự viết |
| CSS cục bộ | `<style scoped>` sẵn | Thư viện ngoài |
| State toàn cục | Pinia (chính thức) | Nhiều lựa chọn |
| Đường đi mặc định | Rõ ràng, ít lựa chọn | Nhiều lựa chọn |

### F2 Vue `watch` có giống React `useEffect` không?

**Ngắn:** Gần giống nhưng **khác một điểm quan trọng**: `watch` **không chạy ngay**, `useEffect` thì có.

```ts
watch(n, fn)                       // chỉ chạy khi n đổi
watch(n, fn, { immediate: true })  // giờ mới giống useEffect

useEffect(fn, [n])                 // chạy ngay lần đầu + khi n đổi
```

Và `watch` cho bạn **giá trị cũ**; `useEffect` thì phải tự lưu bằng `useRef`.

### F3 Template của Vue có kém linh hoạt hơn JSX không?

**Ngắn:** Kém linh hoạt hơn, nhưng đổi lại **tối ưu được lúc biên dịch**.

**Đào sâu:** Vì template là cú pháp tĩnh, trình biên dịch Vue biết phần nào **không bao giờ đổi** và bỏ
qua chúng khi so sánh. JSX là JavaScript nên không phân tích được như vậy.

Và template **kiểm tra kiểu được** — `vue-tsc` bắt lỗi sai kiểu prop/emit **ngay trong template**, thứ
trình duyệt không báo.

Cần linh hoạt tối đa thì Vue vẫn dùng được hàm `render()` hoặc JSX.

### F4 Bạn thích Vue hay React hơn?

Không có đáp án đúng. Nhưng **đừng chê cái kia**. Mẫu trả lời tốt:

> "Em thấy chúng giải quyết cùng bài toán theo hai triết lý khác nhau. Em thích Vue ở chỗ đường đi mặc
> định rõ ràng — reactivity không cần khai dependency, `v-model` và `<style scoped>` có sẵn, và Pinia là
> lựa chọn chính thức nên team không phải tranh luận. Với dự án cần ra nhanh và nhiều người cùng làm,
> em thấy điều đó có giá trị.
>
> React mạnh ở hệ sinh thái và ở chỗ component chỉ là hàm nên ghép rất linh hoạt. Nếu team đã dùng React
> thì em không thấy lý do gì phải đổi.
>
> Điểm em thấy khó ở Vue là mấy cái bẫy reactivity — destructure `reactive` hay store là mất reactivity
> mà **không có cảnh báo nào**. Em xử lý bằng cách luôn dùng `ref` và `storeToRefs`."

Câu cuối là phần ghi điểm: nó cho thấy bạn đã **vấp thật** chứ không đọc lý thuyết.

---

## Ba câu chuẩn bị sẵn

1. **Kể một dự án Vue bạn làm** — bối cảnh, vai trò, một khó khăn kỹ thuật, **con số**.
2. **Một lỗi Vue khó nhất bạn gặp** — gợi ý tốt: destructure store làm bộ lọc không ăn (không có cảnh
   báo nào), hoặc `:key` trùng làm ô input nhảy hàng.
3. **Vì sao chọn Vue cho dự án đó.**

---

Tiếp theo: [02-tu-kiem-tra.md](./02-tu-kiem-tra.md)
