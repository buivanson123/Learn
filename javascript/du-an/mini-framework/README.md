# mini-framework

signal + effect + keyed diff + router. **267 dòng, 0 thư viện.**

Giải thích từng cơ chế ở [bài 15](../../15-du-an-mini-framework.md).

## Chạy

```bash
node test/reactive.test.js     # 10/10 test đạt, không cần trình duyệt
node server.js                 # http://localhost:5173
```

## Cấu trúc

| File | Dòng | Việc |
|---|---|---|
| `src/reactive.js` | 91 | `signal`, `computed`, `effect`, gom cập nhật vào 1 microtask |
| `src/dom.js` | 125 | `h()`, `mount()`, patch có **keyed diff** |
| `src/router.js` | 51 | Navigation API + bản dự phòng History API |
| `app.js` | — | Ứng dụng demo: danh sách việc + router |
| `server.js` | — | Server tĩnh, trả `index.html` cho mọi route |

## Ba chỗ đáng đọc nhất

1. **`src/reactive.js` — `get value()` / `set value()`.** Toàn bộ reactivity nằm ở đây: đọc thì
   ghi nhận effect đang chạy, ghi thì đánh thức chúng.
2. **`src/dom.js` — `datHandler` + `handlerCuaEl`.** Bản đầu tiên của tôi
   `addEventListener` mỗi lần render, làm listener cộng dồn và checkbox "hoạt động một nửa số
   lần". Bài 15 mục 5 kể lại đầy đủ.
3. **`src/dom.js` — `patchCon` nhánh có key.** Duyệt **ngược** và `insertBefore` để **di
   chuyển** node cũ thay vì tạo lại — đó là thứ giữ được chữ người dùng đang gõ trong `<input>`.

## Giới hạn đã biết

- `computed` **không** lười (tính lại ngay khi nguồn đổi, kể cả khi không ai đọc) — bài tập 1.
- Không phát hiện vòng lặp effect vô hạn — bài tập 2.
- `signal` chỉ theo dõi phép gán `.value`, không theo dõi object sâu — bài tập 3.
- Không có vòng đời component, không SSR.
