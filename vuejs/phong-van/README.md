# Luyện phỏng vấn Vue

| File | Nội dung |
|------|----------|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | 50 câu hỏi + đáp án hai tầng |
| [02-tu-kiem-tra.md](./02-tu-kiem-tra.md) | Checklist tự chấm |

---

## Đặc thù của phỏng vấn Vue

**Câu gần như chắc chắn bị hỏi nếu CV bạn có cả React:**

> "Vue khác React chỗ nào? Bạn thích cái nào hơn?"

Đây là câu bẫy. Trả lời "Vue dễ hơn" hoặc "React mạnh hơn" đều bị đánh giá thấp — nó cho thấy bạn chưa
hiểu sâu cái nào cả.

Câu trả lời tốt nêu **khác biệt kỹ thuật cụ thể** rồi mới tới sở thích. Xem
[mục F1](./01-cau-hoi-va-dap-an.md#f1--vue-khác-react-chỗ-nào).

---

## Ba nhóm câu hỏi

**Nhóm 1 — Reactivity** (40%)
`ref` vs `reactive`, `computed` vs `watch` vs method, và **các bẫy**. Đây là bộ lọc — Vue được xây quanh
reactivity, không giải thích được là bị coi như chỉ biết cú pháp.

**Nhóm 2 — Component** (30%)
Props/emit, slot, `v-model` trên component, vòng đời, composable.

**Nhóm 3 — Hệ sinh thái và thực chiến** (30%)
Pinia, router, gọi API, tối ưu, test.

---

## Bốn câu hay gặp nhất

1. **`ref` khác `reactive` thế nào? Nên dùng cái nào?**
2. **`computed` khác `watch` khác method thế nào?**
3. **Vì sao `:key` trong `v-for` lại quan trọng?**
4. **Vue khác React chỗ nào?**

Cả bốn có đáp án đầy đủ trong [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md).

---

## Cách trả lời

```
Tầng 1  Định nghĩa ngắn + vấn đề nó giải quyết
Tầng 2  Ví dụ CỤ THỂ từ dự án của bạn
Tầng 3  Cái bẫy / đánh đổi (chỉ nói khi được hỏi thêm)
```

Với Vue, **tầng 3 là chỗ ghi điểm mạnh nhất** — vì phần lớn ứng viên chỉ thuộc định nghĩa. Ví dụ:

> **"`ref` khác `reactive` thế nào?"**
>
> **Tầng 1:** `ref` dùng được cho mọi kiểu và cần `.value`; `reactive` chỉ nhận object và không cần
> `.value`.
>
> **Tầng 2:** Ở dự án task app của em, em dùng `ref` cho tất cả — kể cả mảng công việc.
>
> **Tầng 3:** Vì `reactive` có ba hạn chế em từng vấp: không dùng được cho kiểu nguyên thuỷ, destructure
> ra là mất reactivity, và gán lại cả object thì template mất liên kết. Em đã kiểm chứng bằng test —
> `const { count } = reactive({count: 0})` rồi sửa `state.count = 10` thì `count` vẫn là 0. Cái giá của
> `ref` chỉ là phải gõ `.value`.

---

## Nếu bạn cũng biết React

Bạn có **lợi thế** — nhiều team dùng cả hai. Nhưng phải cẩn thận hai điều:

1. **Đừng chê React** khi phỏng vấn vị trí Vue (và ngược lại).
2. **Đừng nhầm khái niệm.** Vài chỗ hay nhầm:
   - Vue `watch` ≈ React `useEffect`, nhưng `watch` **không chạy ngay** còn `useEffect` thì có.
   - Vue `computed` **có cache**, React `useMemo` cũng có — nhưng Vue tự tìm dependency.
   - Vue component **không render lại cả cây** khi state đổi; React thì có.

Bảng đối chiếu đầy đủ ở [10-cheatsheet.md](../10-cheatsheet.md) mục 11.

---

## Lộ trình 3 ngày

| Ngày | Việc |
|------|------|
| 1 | [02-tu-kiem-tra.md](./02-tu-kiem-tra.md), rồi nhóm A–B (reactivity) |
| 2 | Nhóm C–D (component, hệ sinh thái) |
| 3 | Nhóm E–F (thực chiến, so với React). Làm lại checklist |

---

Quay lại [bộ Vue](../README.md)
