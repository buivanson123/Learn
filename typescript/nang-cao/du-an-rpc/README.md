# Dự án A9 — RPC type-safe

Mã nguồn hoàn chỉnh của [bài A9](../09-du-an-rpc-type-safe.md). Chạy được ngay.

```bash
$ npm install
$ npm run check     # tsc --noEmit  → phải sạch
$ npm run dev       # node src/main.ts
$ npm run build && npm start
```

Yêu cầu Node >= 22.18 (chạy thẳng `.ts` bằng type stripping).

| File | Vai trò |
|---|---|
| `src/contract.ts` | hợp đồng — nguồn sự thật duy nhất |
| `src/types.ts` | máy suy kiểu (`PathParams`, `ParamsOf`, `BodyOf`, `Handler`, `Result`) |
| `src/server.ts` | bộ điều phối + `buildPath` |
| `src/main.ts` | demo, in ra 5 tình huống |

Thử phá: thêm `:tagId` vào `path` của `deletePost` trong `contract.ts`, chạy `npm run check` — mọi
nơi gọi `deletePost` phải đỏ mà không phải sửa file nào khác.
