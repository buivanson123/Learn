# Học JavaScript cho ra máu

Bạn đã viết JavaScript rồi. Bộ này không dạy lại `if`, `for`, `map`. Nó trả lời loại câu hỏi
mà chỉ khi code chạy sai lúc 2 giờ sáng bạn mới cần đến:

- Vì sao đoạn code này giữ **152 MB** trong khi trông chỉ có một hàm ba dòng?
- Vì sao `setTimeout(f, 0)` chạy sau **137 ms**?
- Vì sao `innerHTML +=` trong vòng lặp chậm hơn cách khác **3877 lần**?
- Vì sao `this` là `undefined` chỉ sau khi bạn gán method vào một biến?

Mọi con số, mọi thông báo lỗi, mọi output trong bộ này đều **chạy thật** trên máy bạn trước
khi được viết ra. Không có câu nào chép từ trí nhớ hay từ blog.

```
$ node -e "console.log('Node', process.version, '| V8', process.versions.v8)"
Node v22.23.2 | V8 12.4.254.21-node.56

$ node do/trinh-duyet.js --ua
HeadlessChrome/152.0.0.0
```

---

## ⚠️ Đọc trước: Node 22 và Chrome 152 **không** chạy cùng một JavaScript

Đây là bảng đo thật, không phải bảng caniuse. Cùng một đoạn code, hai kết quả khác nhau:

| Tính năng | Node 22.23 (V8 12.4) | Chrome 152 |
|---|---|---|
| `Temporal` | ❌ `undefined` | ✅ `object` |
| `Promise.try` | ❌ `undefined` | ✅ `function` |
| `RegExp.escape` | ❌ `undefined` | ✅ `function` |
| `Uint8Array.fromBase64` | ❌ `undefined` | ✅ `function` |
| `Error.isError` | ❌ `undefined` | ✅ `function` |
| `Float16Array` | ❌ `undefined` | ✅ `function` |
| cú pháp `using` | ❌ `SyntaxError: Unexpected identifier 'r'` | ✅ chạy được |
| `Symbol.dispose` | ✅ có symbol… | ✅ |
| Iterator helpers (`.values().map()`) | ✅ | ✅ |
| `Set.prototype.union` | ✅ | ✅ |
| `Object.groupBy` | ✅ | ✅ |
| decorator (`@log`) | ❌ `SyntaxError` | ❌ `SyntaxError` |

Hai cái bẫy trong bảng này:

1. **`Symbol.dispose` tồn tại trên Node 22 nhưng cú pháp `using` thì không.** Kiểm tra bằng
   `typeof Symbol.dispose !== 'undefined'` sẽ cho kết quả sai:
   ```
   $ node -e "console.log(typeof Symbol.dispose)"
   symbol                                        ← tưởng là dùng được

   $ node -e "{ using r = { [Symbol.dispose](){} }; }"
   SyntaxError: Unexpected identifier 'r'        ← thực tế không parse nổi
   ```
   Tính năng cú pháp phải kiểm bằng `try { new Function('...') }`, không kiểm bằng `typeof`.

2. **Decorator không chạy ở đâu cả.** Nếu bạn từng thấy `@Injectable()` chạy được, đó là do
   TypeScript/Babel biên dịch nó đi, không phải do runtime hỗ trợ.

Chi tiết ở [bài 10](./10-js-hien-dai-2026.md).

---

## Lộ trình 8 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-moi-truong-va-cach-do.md](./00-moi-truong-va-cach-do.md) | Dựng chỗ thí nghiệm; đo thời gian và bộ nhớ cho **đúng** | 2h |
| 1 | [01-scope-closure-tdz.md](./01-scope-closure-tdz.md) | Hoisting, TDZ, và **closure giữ nguyên cả scope** — nguồn của rò rỉ 152 MB | 3h |
| 2 | [02-this-va-prototype.md](./02-this-va-prototype.md) | 5 luật của `this`, chuỗi prototype, `class` thật ra là gì | 3h |
| 2 | [03-kieu-du-lieu-va-so-sanh.md](./03-kieu-du-lieu-va-so-sanh.md) | Số thực, `==`, `NaN`, sort, JSON mất dữ liệu gì | 3h |
| 3 | [04-object-descriptor-proxy.md](./04-object-descriptor-proxy.md) | Property descriptor, `freeze`, `Proxy`/`Reflect`, thứ tự key | 3h |
| 3 | [05-iterator-va-generator.md](./05-iterator-va-generator.md) | Giao thức iterator, generator hai chiều, xử lý lười | 3h |
| 4 | [06-event-loop.md](./06-event-loop.md) | **Đo thật thứ tự chạy**; microtask bỏ đói macrotask; CJS ≠ ESM | 4h |
| 4 | [07-promise-va-async.md](./07-promise-va-async.md) | Promise bên trong, 4 combinator, `AbortController`, lỗi bị nuốt | 3h |
| 5 | [08-bo-nho-va-ro-ri.md](./08-bo-nho-va-ro-ri.md) | GC, `WeakMap`/`WeakRef`, **4 kiểu rò rỉ đo được bằng số** | 4h |
| 5 | [09-module-esm-cjs.md](./09-module-esm-cjs.md) | Live binding, vòng lặp import, `exports` map, tree-shaking | 3h |
| 6 | [10-js-hien-dai-2026.md](./10-js-hien-dai-2026.md) | Cái gì thật sự dùng được ở đâu; `Temporal`; `using` | 3h |
| 6 | [11-dom-va-su-kien.md](./11-dom-va-su-kien.md) | Capture/bubble, delegation, **layout thrashing nhanh hơn 529 lần** | 4h |
| 7 | [12-browser-api.md](./12-browser-api.md) | `fetch`, Observer, Storage, Worker, Web Components | 4h |
| 7 | [13-nodejs-runtime.md](./13-nodejs-runtime.md) | Stream, backpressure, `worker_threads`, `EventEmitter`, cluster | 4h |
| 8 | [14-hieu-nang-va-cong-cu.md](./14-hieu-nang-va-cong-cu.md) | Đo trước khi tối ưu; 6 "mẹo tối ưu" đã sai; bundler, test | 3h |
| 8 | [15-du-an-mini-framework.md](./15-du-an-mini-framework.md) | **Tự viết framework reactive** — signal, effect, DOM, router | 6h |
| — | [16-loi-thuong-gap.md](./16-loi-thuong-gap.md) | 32 lỗi: dấu hiệu → nguyên nhân → cách sửa | — |
| — | [17-cheatsheet.md](./17-cheatsheet.md) | Tra cứu nhanh | — |

Mỗi bài có **bài tập ở cuối** kèm `<details>` gợi ý đáp án. Làm xong tự mở ra đối chiếu.

---

## Chuẩn bị đi phỏng vấn

Thư mục [`phong-van/`](./phong-van/) là bộ riêng, dùng được độc lập:

| File | Nội dung |
|---|---|
| [01-cau-hoi-va-dap-an.md](./phong-van/01-cau-hoi-va-dap-an.md) | **72 câu hỏi**, mỗi câu có *Trả lời ngắn* (nói ra miệng) và *Giải thích sâu* (đỡ câu hỏi tiếp theo) |
| [02-bai-tap-thuc-hanh.md](./phong-van/02-bai-tap-thuc-hanh.md) | **22 bài gõ tay** — tự viết `debounce`, `EventEmitter`, `pLimit`, `deepClone`… |
| [03-tinh-huong-debug.md](./phong-van/03-tinh-huong-debug.md) | **12 tình huống**: cho code sai + triệu chứng, tìm lỗi |
| [04-tu-kiem-tra.md](./phong-van/04-tu-kiem-tra.md) | Checklist 109 mục để tự chấm trước hôm phỏng vấn |

---

## Dự án cuối: tự viết framework reactive

[`du-an/mini-framework/`](./du-an/mini-framework/) — khoảng 400 dòng, **không thư viện nào**:

- `signal()` / `computed()` / `effect()` — theo dõi phụ thuộc tự động bằng `Proxy` + ngăn xếp effect
- Gom cập nhật vào **một microtask** (đúng cơ chế `nextTick` của Vue)
- Render DOM có `keyed diff`
- Router dựa trên Navigation API
- `WeakMap` để không rò rỉ khi component bị huỷ

Sau khi viết xong bạn sẽ đọc mã nguồn Vue/React và thấy quen, vì bạn vừa dựng lại đúng bốn cơ
chế đó bằng tay.

---

## Cách dùng bộ này

1. **Đừng đọc suông.** Mỗi khối `$ node ...` trong bài đều chạy được. Chạy lại, sửa số, chạy nữa.
2. **Nghi ngờ mọi khẳng định.** Kể cả của tôi. Ba "mẹo tối ưu" nổi tiếng trong bài 14 đã bị
   chính máy bạn bác bỏ.
3. **Làm bài tập trước khi mở đáp án.** Đọc đáp án trước là cách chắc chắn nhất để không nhớ gì.

Liên quan: bộ [TypeScript](../typescript/), [Vue](../vuejs/), [Next.js](../nextjs/),
[CSS](../css/) — cùng một quy tắc viết: không có con số nào không đo.
