# Phỏng vấn Senior Frontend — 78 câu

| File | Nội dung | Số câu |
|---|---|---|
| [01-javascript-va-runtime.md](./01-javascript-va-runtime.md) | Event loop, closure, `this`, số học, module, `AbortController` | 16 |
| [02-trinh-duyet-render-va-mang.md](./02-trinh-duyet-render-va-mang.md) | Render pipeline, reflow, CLS, CORS, caching, HTTP/2-3, font, ảnh | 16 |
| [03-react-va-quan-ly-state.md](./03-react-va-quan-ly-state.md) | Render lại, memo, context, effect, server state, RSC, test | 16 |
| [04-hieu-nang-va-do-luong.md](./04-hieu-nang-va-do-luong.md) | Bundle, code splitting, Core Web Vitals, RUM, SSR/SSG | 16 |
| [05-kien-truc-testing-va-tinh-huong.md](./05-kien-truc-testing-va-tinh-huong.md) | Cấu trúc dự án, design system, monorepo, i18n, a11y, 4 tình huống | 14 |

Số đo trong bộ này lấy từ **Chromium chạy qua Playwright**, **React 19.3 bản production**, và
**esbuild** (minify + gzip). Mọi thí nghiệm đều chạy lại được.

---

## 10 câu gần như luôn được hỏi

1. **Component render lại khi nào?** → [03, câu 1](./03-react-va-quan-ly-state.md)
2. **`React.memo`/`useMemo`/`useCallback` — khi nào thật sự cần?** → [03, câu 2–3](./03-react-va-quan-ly-state.md)
3. **`useEffect` dùng sai thế nào?** → [03, câu 4](./03-react-va-quan-ly-state.md)
4. **Vì sao không dùng index làm `key`?** → [03, câu 9](./03-react-va-quan-ly-state.md)
5. **Event loop: microtask và macrotask** → [01, câu 1](./01-javascript-va-runtime.md)
6. **CORS và preflight** → [02, câu 8](./02-trinh-duyet-render-va-mang.md)
7. **Core Web Vitals và ngưỡng** → [04, câu 7](./04-hieu-nang-va-do-luong.md)
8. **Giảm kích thước bundle bằng cách nào?** → [04, câu 1–6](./04-hieu-nang-va-do-luong.md)
9. **Render 10.000 dòng** → [02, câu 5](./02-trinh-duyet-render-va-mang.md)
10. **Server state và client state** → [03, câu 6](./03-react-va-quan-ly-state.md)

---

## Sáu con số đáng thuộc

Đây là những số đo trong bộ này có sức thuyết phục cao nhất khi nói ra ở phỏng vấn:

| Điều bạn nói | Số đo |
|---|---|
| Layout thrashing | 400 phần tử: **29.9 ms → 0.4 ms** chỉ bằng cách tách đọc và ghi (74.8 lần) |
| `innerHTML +=` trong vòng lặp | 2000 phần tử: **606.9 ms → 0.6 ms** (1012 lần) |
| Ảo hoá danh sách | 10.000 dòng: **47.1 ms / 10.000 node → 0.6 ms / 30 node** |
| Long task và INP | long task 500 ms → độ trễ xử lý click **467.7 ms** |
| Tree shaking | `lodash` **26.2 KB gzip → 1.4 KB** với `lodash-es` (18.7 lần) |
| Code splitting | tải ban đầu **19.8 KB → 0.2 KB gzip** |

Chạy lại các thí nghiệm này trên máy mình và ghi số của bạn. "Em đo được X trên máy em" mạnh hơn
nhiều so với "tài liệu nói X".

---

## Ba mức trả lời

Cùng câu hỏi *"Làm sao tối ưu một component chậm?"*:

| Mức | Câu trả lời | Kết luận của người hỏi |
|---|---|---|
| Junior | "Dùng `React.memo` và `useCallback`." | Đã đọc tài liệu |
| Middle | "Profile bằng React DevTools, tìm component render thừa rồi memo hoá." | Đã tối ưu thật |
| **Senior** | "Trước hết em xác định chậm ở đâu — tải trang hay tương tác, vì hai cái khác hẳn. Nếu là render thừa, em mở Profiler xem cột 'Why did this render'. Nhưng em thường tìm cách **đổi cấu trúc** trước khi memo hoá: đẩy state xuống thấp hơn, hoặc truyền children — vì em đo được rằng `memo` **không có tác dụng** khi props chứa hàm inline, và rất nhiều `memo` trong code thật thuộc loại đó." | Đã đo, hiểu cơ chế |

---

## Ba câu bẫy hay làm trượt

**1. "Bọc `React.memo` là component không render lại nữa đúng không?"**
Sai. Đo được: cùng component bọc `memo`, nhận `onClick={() => {}}` thì **vẫn render lại** vì hàm
inline có danh tính mới mỗi lần render. `memo` chỉ hiệu quả khi props ổn định.

**2. "`import { debounce } from 'lodash'` là tree-shake rồi đúng không?"**
Không. Đo được **72.1 KB / 26.2 KB gzip** — y hệt import cả gói, vì `lodash` là CommonJS. Phải dùng
`lodash/debounce` hoặc `lodash-es`.

**3. "CORS bảo vệ API của mình khỏi bị gọi trái phép đúng không?"**
Không. CORS chỉ ngăn **JavaScript trong trình duyệt đọc response**. `curl` bỏ qua nó hoàn toàn, và
với request đơn giản thì request **vẫn tới server** và tác dụng phụ vẫn xảy ra.

---

Quay lại: [../README.md](../README.md) · Sang phần backend: [../backend/README.md](../backend/README.md)
