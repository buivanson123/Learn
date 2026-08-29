# Học Vue 3 (dành cho người đã viết JavaScript và TypeScript)

Vue là framework xây giao diện. Nó khác React ở một điểm cốt lõi: **Vue theo dõi dữ liệu của bạn**.
Bạn sửa một biến, Vue biết đúng chỗ nào trên màn hình cần vẽ lại — không cần khai báo dependency, không
cần `useMemo`, không cần lo component render lại vô cớ.

Tài liệu này viết cho **Vue 3.5 + Vite 8 + vue-router 5 + Pinia 4 + TypeScript 7**. Mọi lệnh và output
đều chạy thật trước khi viết ra, gồm **27 bài test** kiểm chứng hành vi reactivity, component, router
và store.

> **Nếu bạn từng viết Vue 2 hoặc đọc blog cũ:** bản này khác nhiều tới mức chép code về sẽ sai. Options
> API đã nhường chỗ cho **Composition API + `<script setup>`**, `vue-router` lên **bản 5**, Pinia lên
> **bản 4** và đã thay hẳn Vuex. Bảng đối chiếu ở [10-cheatsheet.md](./10-cheatsheet.md).

---

## ⚠️ Đọc trước: Node của bạn chưa đủ

Vite 8 yêu cầu **Node `^20.19.0 || >=22.12.0`**. Máy bạn đang chạy **v20.14.0** — không thoả.

```bash
$ node -v
v20.14.0

$ npx vite build
Error: Cannot find module '@rolldown/binding-darwin-universal'
...
Node.js v20.14.0
```

Nó **không chỉ cảnh báo** — nó hỏng thật.

Máy bạn đã có sẵn `nvm` với các bản dùng được:

```bash
$ ls ~/.nvm/versions/node
v20.14.0  v20.19.0  v20.19.5  v22.23.2  v25.2.1

$ nvm use 22
Now using node v22.23.2
```

⚠️ **Đổi bản Node xong phải cài lại `node_modules`** — các gói có binary gốc (rolldown) được biên dịch
theo đúng ABI của Node lúc cài:

```bash
$ rm -rf node_modules package-lock.json && npm install
```

Không làm bước này thì vẫn lỗi y hệt dù đã `nvm use`.

Đặt mặc định để khỏi quên: `nvm alias default 22`.

---

## Lộ trình 7 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-chuan-bi.md](./00-chuan-bi.md) | Node, tạo project, cấu trúc, SFC, `vue-tsc` | 3h |
| 1 | [01-template-va-binding.md](./01-template-va-binding.md) | Template, `v-bind`, `v-if`, `v-for`, `v-on`, `v-model` | 3h |
| 2 | [02-reactivity.md](./02-reactivity.md) | **`ref` vs `reactive`, `computed`, `watch` — và 7 cái bẫy** | 4h |
| 3 | [03-component.md](./03-component.md) | Props, emit, slot, `defineModel`, provide/inject | 4h |
| 4 | [04-composable-va-lifecycle.md](./04-composable-va-lifecycle.md) | Vòng đời, composable tự viết, VueUse | 3h |
| 5 | [05-vue-router-5.md](./05-vue-router-5.md) | Route động, guard, lazy load, layout | 3h |
| 5 | [06-pinia-4.md](./06-pinia-4.md) | Store, `storeToRefs`, persist, test store | 3h |
| 6 | [07-form-va-goi-api.md](./07-form-va-goi-api.md) | Form, validate, gọi API, trạng thái loading/error | 3h |
| 7 | [08-du-an-task-app.md](./08-du-an-task-app.md) | **Dự án: app quản lý công việc, lưu localStorage** | 6h |
| — | [09-loi-thuong-gap.md](./09-loi-thuong-gap.md) | 22 lỗi kinh điển kèm thông báo lỗi thật | — |
| — | [10-cheatsheet.md](./10-cheatsheet.md) | Tra cứu nhanh + bảng "Vue 2 → Vue 3" | — |

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 50 câu hỏi kèm đáp án hai tầng, checklist tự kiểm tra, và
phần **so sánh Vue với React** (câu gần như chắc chắn bị hỏi nếu CV bạn có cả hai).

---

## Môi trường tài liệu này dựa vào

Số liệu đo trên máy, không chép từ tài liệu:

```bash
$ nvm use 22 && node -v
v22.23.2

$ npm create vue@latest taskapp -- --typescript --router --pinia --vitest
$ cd taskapp && npm install
```

Phiên bản thật được cài:

| Gói | Bản |
|-----|-----|
| `vue` | 3.5.40 |
| `vue-router` | **5.2.0** |
| `pinia` | **4.0.2** |
| `vite` | 8.1.5 |
| `vitest` | 4.1.10 |
| `vue-tsc` | 3.3.7 |
| `typescript` | ~6.0.0 (scaffold ghim, không phải 7.x) |

> ⚠️ **Đừng thêm cờ `--eslint` lúc này.** Scaffold hiện tại ghim `oxlint@~1.74.0` trong khi
> `eslint-plugin-oxlint@1.73.0` đòi peer `oxlint@~1.73.0`, nên `npm install` **thất bại**:
> ```
> npm error ERESOLVE unable to resolve dependency tree
> npm error Found: oxlint@1.74.0
> npm error Could not resolve dependency:
> npm error peer oxlint@"~1.73.0" from eslint-plugin-oxlint@1.73.0
> ```
> Cách xử lý ở [bài 00 mục 2](./00-chuan-bi.md).

---

## Ba nguyên tắc cốt lõi của Vue

### 1. Vue theo dõi dữ liệu, bạn không phải khai báo phụ thuộc

```ts
const n = ref(1)
const double = computed(() => n.value * 2)   // Vue tự biết double phụ thuộc n
```

Không có mảng dependency, không có `useMemo`, không có `useCallback`. Vue chặn việc đọc `n.value` và tự
ghi lại quan hệ. Khi `n` đổi, đúng những gì phụ thuộc nó mới chạy lại.

Đo thật — `computed` **có cache**:

```ts
const spy = vi.fn()
const double = computed(() => { spy(); return n.value * 2 })
double.value; double.value; double.value     // đọc 3 lần
expect(spy).toHaveBeenCalledTimes(1)         // ✅ chỉ tính 1 lần
```

### 2. Một component là một file

```vue
<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <button @click="count++">Đã bấm {{ count }} lần</button>
</template>

<style scoped>
button { padding: 8px 16px; }
</style>
```

Ba khối trong một file `.vue`. `<style scoped>` tự động giới hạn CSS trong component đó — không cần
CSS Modules hay styled-components.

`<script setup>` là dạng viết gọn: mọi biến khai ở đây **tự động** dùng được trong template, không cần
`return`.

### 3. Template được biên dịch, nên kiểm tra được kiểu

Template không phải chuỗi — nó được biên dịch thành hàm render, và `vue-tsc` **kiểm tra kiểu bên trong
template**:

```bash
$ npx vue-tsc --noEmit -p tsconfig.app.json
src/lab/Bad.vue(7,34): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/lab/UseBad.vue(6,9): error TS2322: Type 'string' is not assignable to type 'number'.
```

Lỗi đầu là truyền sai kiểu cho `emit`, lỗi sau là truyền sai kiểu cho prop — **cả hai đều bắt được
trước khi chạy**.

---

## Cách học hiệu quả nhất

1. **Gõ tay, đừng copy-paste.** `ref` và `.value` chỉ ngấm khi tay quen.
2. **Mở `npm run dev` suốt buổi học.** Vite hot-reload gần như tức thì, sửa là thấy ngay.
3. **Chạy `npm run type-check` thường xuyên.** Nó bắt lỗi trong template mà trình duyệt không báo.
4. **Đọc [bài 02](./02-reactivity.md) kỹ nhất.** 7 cái bẫy trong đó là nguyên nhân của phần lớn lỗi
   "sao sửa dữ liệu mà giao diện không đổi".
5. **Làm dự án ở [bài 08](./08-du-an-task-app.md) song song.** Học tới đâu áp vào tới đó.

---

## Dự án xuyên suốt

App quản lý công việc, **không cần backend** — dữ liệu lưu `localStorage`:

- Thêm/sửa/xoá/đánh dấu xong công việc
- Lọc theo trạng thái, tìm kiếm, sắp xếp
- Nhiều danh sách, chuyển qua lại bằng router
- Store dùng chung bằng Pinia, tự lưu và nạp lại từ `localStorage`
- Form có validate, hiện lỗi theo từng trường
- Có test cho store và component

Chọn dự án không cần backend để bạn tập trung vào **Vue**, không phải mất thời gian dựng API. Muốn nối
vào API thật thì [bài 07](./07-form-va-goi-api.md) có sẵn phần đó.

---

Liên quan: [TypeScript](../typescript/README.md) · [Next.js](../nextjs/README.md) (React, cùng bài toán frontend)
