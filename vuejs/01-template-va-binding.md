# Bài 01 — Template và binding

Template là nơi bạn mô tả **giao diện trông thế nào theo dữ liệu**. Vue lo phần cập nhật DOM.

Mọi hành vi trong bài này đều kiểm chứng bằng test chạy thật.

---

## 1. Nội suy `{{ }}`

```vue
<script setup lang="ts">
import { ref } from 'vue'
const msg = ref('<b>đậm</b>')
const num = ref(5)
</script>

<template>
  <p>{{ msg }}</p>
  <p>{{ num > 3 ? 'lớn' : 'nhỏ' }}</p>
</template>
```

Kết quả thật:

```
<b>đậm</b>          ← in ra literal, KHÔNG thành chữ đậm
lớn
```

**`{{ }}` tự escape HTML.** Test xác nhận:

```ts
expect(w.get('.interp').text()).toBe('<b>đậm</b>')
expect(w.get('.interp').html()).toContain('&lt;b&gt;')     // đã escape
```

Đây là lá chắn XSS mặc định — dữ liệu người dùng in ra bằng `{{ }}` không bao giờ thành mã chạy được.

Trong `{{ }}` viết được **biểu thức**, không viết được **câu lệnh**:

```vue
{{ num > 3 ? 'lớn' : 'nhỏ' }}    ✅ biểu thức
{{ items.filter(i => i.done).length }}  ✅
{{ const x = 1 }}                ❌ câu lệnh
{{ if (a) { } }}                 ❌
```

Logic phức tạp thì đưa vào `computed` — xem [bài 02](./02-reactivity.md).

### `v-html` — chỉ khi bạn kiểm soát nội dung

```vue
<p v-html="msg"></p>
```

```
<b>đậm</b>          ← thành chữ đậm thật
```

```ts
expect(w.get('.raw').html()).toContain('<b>đậm</b>')       // KHÔNG escape
```

⚠️ `v-html` với dữ liệu người dùng nhập là **lỗ hổng XSS**. Chỉ dùng khi nội dung do bạn sinh ra hoặc
đã lọc bằng thư viện (DOMPurify).

---

## 2. `v-bind` — gắn dữ liệu vào thuộc tính

```vue
<p :title="msg" :class="cls" :style="style">bind</p>
```

`:` là viết tắt của `v-bind:`. Kết quả thật:

```html
<p title="<b>đậm</b>" class="active" style="color: red;">bind</p>
```

### `:class` — ba dạng

```vue
<div :class="cls">                                  <!-- chuỗi -->
<div :class="{ active: isActive, done: isDone }">   <!-- object: key là tên class -->
<div :class="[baseClass, isActive && 'active']">    <!-- mảng -->
<div class="luon-co" :class="{ active: isActive }"> <!-- gộp với class tĩnh -->
```

Dạng object dùng nhiều nhất: `{ tên-class: điều-kiện }`.

### `:style`

```vue
<div :style="{ color: textColor, fontSize: size + 'px' }">
<div :style="[baseStyle, overrideStyle]">
```

Tên thuộc tính viết **camelCase** (`fontSize`), không phải `font-size`.

### Truyền nhiều thuộc tính một lúc

```vue
<script setup>
const attrs = { id: 'x', 'data-role': 'button', title: 'abc' }
</script>

<template>
  <div v-bind="attrs"></div>
</template>
```

---

## 3. `v-if` vs `v-show` — khác nhau thật sự

```vue
<p v-if="show">có</p>
<p v-else>không</p>

<span v-show="show">vshow</span>
```

Test chứng minh khác biệt:

```ts
expect(w.find('.ifp').exists()).toBe(true)
expect(w.find('.elsep').exists()).toBe(false)   // ← KHÔNG có trong DOM
expect(w.find('.showp').exists()).toBe(true)
```

| | `v-if` | `v-show` |
|---|--------|----------|
| Khi false | **Xoá khỏi DOM** | Vẫn trong DOM, chỉ `display: none` |
| Chi phí lúc chuyển | Cao (dựng/huỷ component) | Thấp (đổi CSS) |
| Chi phí lúc đầu | Thấp (không render nếu false) | Cao (luôn render) |
| Có `v-else` | ✅ | ❌ |

**Chọn thế nào:** đổi qua lại thường xuyên (tab, dropdown) → `v-show`. Hiếm khi đổi, hoặc nội dung nặng
→ `v-if`.

⚠️ `v-show` **không** dùng được với `<template>` và không có `v-else`.

### `v-if` với `<template>`

Nhóm nhiều phần tử mà không thêm thẻ bọc:

```vue
<template v-if="show">
  <h1>Tiêu đề</h1>
  <p>Nội dung</p>
</template>
```

`<template>` biến mất khỏi DOM — chỉ hai thẻ con được render.

---

## 4. `v-for` — và vì sao `:key` bắt buộc

```vue
<li v-for="(it, i) in items" :key="it.id">{{ i }}-{{ it.n }}</li>
```

```
0-a
1-b
```

Các dạng:

```vue
<li v-for="item in items">                    <!-- mảng -->
<li v-for="(item, index) in items">           <!-- kèm chỉ số -->
<li v-for="(value, key) in object">           <!-- object -->
<li v-for="(value, key, index) in object">
<li v-for="n in 10">                          <!-- 1 → 10 -->
<template v-for="item in items" :key="item.id">   <!-- nhóm, không thêm thẻ -->
```

### ⭐ `:key` — không phải trang trí

Vue dùng `key` để biết phần tử nào là phần tử nào khi danh sách đổi. Không có nó, Vue **tái sử dụng
DOM theo vị trí** — và trạng thái nội bộ (ô input, checkbox, focus) bị gán nhầm hàng.

```vue
<!-- ❌ xoá hàng đầu thì ô input của hàng 2 hiện giá trị của hàng 1 -->
<li v-for="task in tasks">
  <input v-model="task.title">
</li>

<!-- ✅ -->
<li v-for="task in tasks" :key="task.id">
  <input v-model="task.title">
</li>
```

Quy tắc: **key phải ổn định và duy nhất**. Dùng `id` từ dữ liệu.

⚠️ **Đừng dùng index làm key** khi danh sách có thể sắp xếp lại, chèn hoặc xoá giữa chừng — index đổi
theo vị trí nên vô dụng. Chỉ chấp nhận được với danh sách tĩnh, chỉ đọc.

### Không đặt `v-if` và `v-for` trên cùng một thẻ

```vue
<!-- ❌ Vue 3: v-if chạy TRƯỚC v-for → không truy cập được biến `task` -->
<li v-for="task in tasks" v-if="!task.done" :key="task.id">

<!-- ✅ lọc bằng computed -->
<li v-for="task in activeTasks" :key="task.id">

<!-- ✅ hoặc bọc template -->
<template v-for="task in tasks" :key="task.id">
  <li v-if="!task.done">{{ task.title }}</li>
</template>
```

Cách đầu (computed) tốt hơn: nó có cache và không duyệt lại danh sách mỗi lần render.

---

## 5. `v-on` — bắt sự kiện

```vue
<button @click="count++">Tăng</button>
<button @click="handleClick">Gọi hàm</button>
<button @click="handleClick($event, item.id)">Truyền tham số</button>
```

`@` là viết tắt của `v-on:`.

### Modifier — thứ tiết kiệm nhiều code

```vue
<form @submit.prevent="onSubmit">        <!-- thay event.preventDefault() -->
<div @click.stop="...">                  <!-- thay event.stopPropagation() -->
<div @click.self="...">                  <!-- chỉ khi bấm đúng thẻ này -->
<div @click.once="...">                  <!-- chỉ chạy 1 lần -->
<div @scroll.passive="...">              <!-- tối ưu cuộn -->

<input @keyup.enter="submit">
<input @keyup.esc="cancel">
<input @keydown.ctrl.s.prevent="save">   <!-- tổ hợp phím -->
```

`@submit.prevent` là cái dùng nhiều nhất — mọi form đều cần.

---

## 6. `v-model` — hai chiều

```vue
<input v-model="name">
```

Tương đương:

```vue
<input :value="name" @input="name = $event.target.value">
```

Với các loại input khác nhau, Vue tự chọn đúng thuộc tính và sự kiện:

```vue
<input type="text" v-model="text">
<input type="checkbox" v-model="checked">          <!-- boolean -->
<input type="checkbox" v-model="list" value="a">   <!-- gom vào mảng -->
<input type="radio" v-model="picked" value="a">
<select v-model="selected">
<select v-model="multi" multiple>                  <!-- mảng -->
<textarea v-model="content">
```

### Modifier

```vue
<input v-model.trim="name">      <!-- tự trim -->
<input v-model.number="age">     <!-- ép về số -->
<input v-model.lazy="text">      <!-- cập nhật khi change thay vì input -->
```

⭐ **`.number` rất hay cần**: giá trị của `<input>` **luôn là chuỗi**, kể cả `type="number"`. Không có
`.number` thì `age` là `"25"`, và `age + 1` ra `"251"`.

⚠️ `v-model` trên `<textarea>` phải dùng `v-model`, **không** dùng `{{ }}` giữa hai thẻ:

```vue
<textarea v-model="content"></textarea>       ✅
<textarea>{{ content }}</textarea>            ❌ không hai chiều
```

---

## 7. Các directive còn lại

```vue
<span v-text="msg"></span>       <!-- như {{ msg }} -->
<span v-html="msg"></span>       <!-- không escape -->
<span v-pre>{{ không biên dịch }}</span>
<span v-once>{{ chỉ render 1 lần }}</span>
<span v-cloak>...</span>         <!-- ẩn cho tới khi Vue mount xong -->
```

`v-once` hữu ích cho nội dung tĩnh nặng — Vue bỏ qua nó ở mọi lần render sau.

---

## 8. Bảng đối chiếu nhanh với React

Nếu bạn đã học [Next.js](../nextjs/README.md), bảng này giúp chuyển ý:

| Việc | Vue | React |
|------|-----|-------|
| Nội suy | `{{ x }}` | `{x}` |
| Thuộc tính động | `:title="x"` | `title={x}` |
| Điều kiện | `v-if` / `v-show` | `{cond && <X/>}` hoặc ternary |
| Lặp | `v-for` + `:key` | `.map()` + `key` |
| Sự kiện | `@click="f"` | `onClick={f}` |
| Ngăn mặc định | `@submit.prevent` | `e.preventDefault()` thủ công |
| Hai chiều | `v-model` | `value` + `onChange` thủ công |
| CSS cục bộ | `<style scoped>` | CSS Modules / styled-components |

Khác biệt lớn nhất: Vue có `v-model` và modifier (`.prevent`, `.trim`, `.number`) làm sẵn những việc
React bắt bạn viết tay.

---

## Bài tập

1. Tạo component có `msg = '<b>đậm</b>'`. In bằng `{{ }}` và bằng `v-html`. So sánh HTML sinh ra.
   Giải thích cái nào an toàn hơn và vì sao.

2. Viết `<p v-if="show">có</p><p v-else>không</p>` và `<span v-show="show">`. Đặt `show = false`, mở
   DevTools xem DOM. Hai cái khác nhau chỗ nào?

3. Tạo danh sách 3 công việc, mỗi hàng có một `<input>`. **Không** đặt `:key`, gõ chữ vào ô thứ hai
   rồi xoá hàng đầu. Ô input hiện gì? Thêm `:key="task.id"` và làm lại.

4. Đặt `v-if` và `v-for` trên cùng một thẻ để lọc công việc chưa xong. Ghi lại lỗi. Sửa bằng `computed`.

5. Viết form có `@submit` **không** kèm `.prevent`. Bấm gửi và quan sát trang. Thêm `.prevent` rồi thử lại.

6. Tạo `<input type="number" v-model="age">` không có `.number`. In `typeof age` và `age + 1`. Thêm
   `.number` rồi so sánh.

7. Viết `:class` bằng cả ba dạng (chuỗi, object, mảng) cho cùng một kết quả.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `{{ }}` sinh `&lt;b&gt;đậm&lt;/b&gt;` (escape), `v-html` sinh `<b>đậm</b>` (chạy thật). `{{ }}`
an toàn vì dữ liệu người dùng không thể biến thành mã.

**2.** `v-if` false → thẻ **không tồn tại** trong DOM. `v-show` false → thẻ vẫn có, chỉ thêm
`style="display: none"`.

**3.** Không có `:key`: ô input giữ nguyên vị trí nên chữ bạn gõ **nhảy sang hàng khác** — Vue tái dùng
DOM theo vị trí. Có `:key`: Vue biết đúng hàng nào bị xoá và giữ trạng thái đúng chỗ.

**4.**
```
[Vue warn]: Property "task" was accessed during render but is not defined on instance.
```
Trong Vue 3, `v-if` được đánh giá **trước** `v-for`, nên biến của vòng lặp chưa tồn tại.

**6.** Không có `.number`: `typeof age` là `"string"`, `age + 1` ra `"251"`. Có `.number`:
`typeof age` là `"number"`, `age + 1` ra `26`.

</details>

---

Tiếp theo: [02-reactivity.md](./02-reactivity.md) — bài quan trọng nhất của cả bộ.
