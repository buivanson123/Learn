# Luyện phỏng vấn JavaScript

Bộ này dùng được **độc lập** với phần giáo trình. Nếu bạn có 3 ngày trước hôm phỏng vấn, đây là
thứ cần đọc.

| File | Nội dung | Thời lượng |
|---|---|---|
| [01-cau-hoi-va-dap-an.md](./01-cau-hoi-va-dap-an.md) | **72 câu hỏi**, mỗi câu có *Trả lời ngắn* (nói ra miệng) và *Giải thích sâu* (đỡ câu hỏi tiếp theo) | 6h |
| [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) | **22 bài gõ tay** — `debounce`, `EventEmitter`, `pLimit`, `deepClone`, `curry`… | 6h |
| [03-tinh-huong-debug.md](./03-tinh-huong-debug.md) | **12 tình huống**: cho code + triệu chứng, tìm nguyên nhân | 3h |
| [04-tu-kiem-tra.md](./04-tu-kiem-tra.md) | Checklist **109 mục** để tự chấm | 1h |

---

## Cách dùng cho đúng

**Đừng đọc đáp án trước.** Với mỗi câu: nói to câu trả lời của bạn trong 30 giây, **rồi** mở
đáp án. Cảm giác "biết rồi" khi đọc đáp án không phải là biết — nó là nhận ra.

Với bài gõ tay có dấu 🖊, làm **trên giấy**: không mở trình duyệt, không tra cứu, không autocomplete.
Phỏng vấn thật đúng là như vậy.

---

## Ba câu hỏi bạn gần như chắc chắn bị hỏi

Chuẩn bị ba câu này thật kỹ trước, vì chúng xuất hiện trong hầu hết buổi phỏng vấn frontend/Node:

1. **"Giải thích event loop."** — Đừng chỉ nói "microtask trước macrotask". Nói được: hai hàng
   đợi, luật *vét sạch* vs *lấy một*, và một hệ quả **cụ thể** (ví dụ: microtask lồng nhau đẩy
   `setTimeout(0)` tới 137 ms). Câu 21–28.

2. **"Closure là gì?"** — Đừng nói "hàm nhớ được biến bên ngoài". Nói: hàm + tham chiếu tới
   **environment record**, và nêu hệ quả bộ nhớ — hai closure cùng scope thì giữ chung mọi biến,
   nên giữ một hàm trả về số `1` có thể giữ 152 MB. Câu 5–9.

3. **"`this` được quyết định thế nào?"** — Đọc 5 luật theo đúng thứ tự xét, và nêu được vì sao
   `bind` lần thứ hai vô tác dụng. Câu 12–18.

Ba câu này là chỗ khác biệt rõ nhất giữa Junior và Middle: Junior kể **định nghĩa**, Middle kể
**hệ quả kèm số**.

---

## Mức độ được kỳ vọng

| | Junior | **Middle** (mục tiêu của bộ này) | Senior |
|---|---|---|---|
| Event loop | biết microtask trước macrotask | giải thích được thứ tự **và** debug được bug do nó | biết CJS/ESM đổi thứ tự `nextTick` |
| Closure | biết định nghĩa | biết hệ quả **bộ nhớ** | tìm được rò rỉ trong heap snapshot |
| Bất đồng bộ | dùng được `async/await` | chọn đúng combinator, xử lý huỷ, biết bốn kiểu nuốt lỗi | thiết kế được backpressure |
| Hiệu năng | "dùng `for` thay `forEach`" | **đo trước**, biết mẹo nào đã lỗi thời | định hình được kiến trúc |

---

## Cần ôn lại chủ đề nào

| Chủ đề | Câu | Bài giáo trình |
|---|---|---|
| Scope, closure, TDZ | 1–11 | [01](../01-scope-closure-tdz.md) |
| `this`, prototype, class | 12–20 | [02](../02-this-va-prototype.md) |
| Event loop | 21–28 | [06](../06-event-loop.md) |
| Promise, async | 29–38 | [07](../07-promise-va-async.md) |
| Kiểu dữ liệu, so sánh, JSON | 39–46 | [03](../03-kieu-du-lieu-va-so-sanh.md) |
| Object, descriptor, Proxy | 47–52 | [04](../04-object-descriptor-proxy.md) |
| Iterator, generator | 53–56 | [05](../05-iterator-va-generator.md) |
| Bộ nhớ, rò rỉ | 57–62 | [08](../08-bo-nho-va-ro-ri.md) |
| Module | 63–66 | [09](../09-module-esm-cjs.md) |
| DOM, browser | 67–70 | [11](../11-dom-va-su-kien.md), [12](../12-browser-api.md) |
| Node runtime | 71–72 | [13](../13-nodejs-runtime.md) |
