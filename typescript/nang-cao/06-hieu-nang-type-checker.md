# Bài A6 — Hiệu năng của trình kiểm kiểu

Khi dự án lớn lên, triệu chứng xuất hiện theo thứ tự: autocomplete chậm dần → hover mất 2 giây mới hiện → "Initializing JS/TS language features" chạy mãi → CI build lâu hơn test.

Bài này dạy cách **đo** thay vì đoán, và những nguyên nhân thật sự gây chậm.

Lưu ý về con số: TypeScript 7 viết lại bằng Go nên nhanh hơn TS 5 khoảng một bậc. Các số tuyệt đối dưới đây rất nhỏ, nhưng **tỉ lệ giữa chúng** mới là thứ áp dụng được cho dự án thật.

---

## 1. Công cụ đo số một: `--extendedDiagnostics`

```bash
$ npx tsc --noEmit --extendedDiagnostics
```
```
Files:             202
Types:            1477
Instantiations:   3555
Memory used:    50987K
Check time:     0.013s
Total time:     0.085s
```

Ý nghĩa từng dòng:

| Dòng | Nghĩa | Khi nào là dấu hiệu xấu |
|---|---|---|
| `Files` | số file được nạp (kể cả `.d.ts`) | vài nghìn file cho một app nhỏ → xem lại `include`/`types` |
| `Types` | số kiểu riêng biệt được tạo | tăng vọt khi thêm một type mới → type đó đang nổ |
| `Instantiations` | số lần một generic được cụ thể hoá | **chỉ số quan trọng nhất**; >1 triệu là chậm rõ rệt |
| `Check time` | thời gian kiểm kiểu | so tương đối giữa các lần đo |

Quy trình chuẩn: **đo trước → sửa → đo lại**. Đừng tối ưu khi chưa có số.

---

## 2. Thủ phạm số một: `skipLibCheck: false`

Đây là thay đổi một dòng cho hiệu quả lớn nhất. File test chỉ có 3 dòng:

```ts
import express from 'express';
export const app = express();
app.get('/', (req, res) => { res.json({ ok: true }); });
```

```bash
$ npx tsc --noEmit --extendedDiagnostics                      # skipLibCheck: true
```
```
Files:             202
Types:            1477
Instantiations:   3555
Check time:     0.013s
Total time:     0.085s
```
```bash
$ npx tsc --noEmit --skipLibCheck false --extendedDiagnostics
```
```
Files:              202
Types:            80198
Instantiations:  104844
Check time:      0.472s
Total time:      0.527s
```

**Cùng số file, nhưng Types gấp 54 lần và Check time gấp 36 lần.** Toàn bộ chi phí đó dùng để kiểm tra tính đúng đắn bên trong `.d.ts` của express và của các dependency — thứ bạn không sửa được.

Khi nào bật `skipLibCheck: true`: app, dịch vụ nội bộ, monorepo. Khi nào để `false`: package bạn publish, và chỉ trong một job CI riêng chạy nightly.

---

## 3. Thủ phạm số hai: generic tính lại cho từng kiểu khác nhau

TypeScript **có cache**: `DeepPartial<Big>` gọi 30 lần với cùng `Big` chỉ tính một lần. Cache đó mất tác dụng khi tham số kiểu khác nhau.

30 type khác nhau, mỗi type 40 field, mỗi field là object lồng:

```ts
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
type Big0 = { f0: { a0: string; b0: number; c0: boolean[] }; /* ... 40 field ... */ };
declare function use0(x: DeepPartial<Big0>): void;
use0({ f0: { a0: 'x' } });
// ... lặp lại cho Big1 .. Big29
```
```
Types:            1933
Instantiations:   1024
Check time:     0.010s
```

Đổi `DeepPartial` (đệ quy) thành `Partial` (một tầng):
```
Types:            1868
Instantiations:    361
Check time:     0.005s
```

**Instantiations giảm 2,8 lần, Check time giảm một nửa, số Types gần như không đổi.** Bài học: chi phí không nằm ở "có bao nhiêu kiểu" mà ở "generic phải chạy lại bao nhiêu lần".

Cách xử lý khi gặp:
- Đặt tên cho kết quả trung gian: `interface PBig extends DeepPartial<Big> {}` — dùng lại 30 chỗ chỉ tính một lần.
- Đừng làm sâu hơn mức cần. `DeepPartial` áp cho DTO 5 tầng là lãng phí nếu chỉ 1 tầng đầu là optional thật.

---

## 4. Thủ phạm số ba: intersection thay vì interface

```ts
type T0 = { p0_0: string; /* 25 field */ };
// ... T0..T29
type All = T0 & T1 & ... & T29;
```
```
Types:             401
Check time:     0.007s
```

Viết lại bằng interface:
```ts
interface I0 { p0_0: string; /* 25 field */ }
// ... I0..I29
interface All extends I0, I1, ..., I29 {}
```
```
Types:             401
Check time:     0.002s
```

Cùng số Types, nhưng **Check time nhanh hơn 3,5 lần**. Lý do: `interface extends` tạo **một** kiểu phẳng có bảng thuộc tính duy nhất. `A & B & C` giữ nguyên cấu trúc cây, và mỗi lần kiểm tra gán, trình biên dịch phải đi qua từng nhánh.

Đây là lý do đội TypeScript khuyến nghị: **khi mô tả hình dạng object và có kế thừa, ưu tiên `interface`.** Không phải vì "interface dành cho object" như câu nói truyền miệng, mà vì lý do đo được này.

---

## 5. Hai mã lỗi báo hiệu type đã nổ

### TS2589 — đệ quy quá sâu
```
error TS2589: Type instantiation is excessively deep and possibly infinite.
```
Kiểu kết quả trở thành **`any`** (xem bài A2 mục 2). Nguy hiểm gấp đôi: vừa chậm vừa mất kiểm tra.

### TS2590 — union quá lớn
```
error TS2590: Expression produces a union type that is too complex to represent.
```
Trần là 100 000 nhánh. Thường gặp khi nhân chéo template literal type.

Một union 10 000 nhánh vẫn "hợp lệ" nhưng đắt:
```
Types:           10578
Check time:     0.010s
```
10 578 kiểu chỉ để mô tả "chuỗi 4 chữ số". Nếu type đó nằm trong một file mà editor phải check lại mỗi lần gõ phím, bạn sẽ cảm nhận được ngay.

---

## 6. `--generateTrace` — khi số tổng không chỉ ra được thủ phạm

```bash
$ npx tsc --noEmit --generateTrace trace
$ ls -la trace/
```
```
legend.json       1858
trace.json      340666
types_0.json     12625
types_1.json     31529
types_2.json     12625
types_3.json     12625
```

**`trace.json`** là timeline theo định dạng Chrome Trace Event. Mở bằng `chrome://tracing` hoặc [ui.perfetto.dev](https://ui.perfetto.dev), kéo file vào là thấy biểu đồ thời gian: `createSourceFile`, `bindSourceFile`, `checkSourceFile`, `structuredTypeRelatedTo`... Thanh nào dài nhất là chỗ cần sửa.

Đếm nhanh loại sự kiện bằng Node:
```bash
$ node -e "
const t=require('./trace/trace.json');
const n={}; for (const e of t) n[e.name]=(n[e.name]||0)+1;
console.log(Object.entries(n).sort((a,b)=>b[1]-a[1]).slice(0,6));
"
```
```
[
  [ 'thread_name', 388 ],
  [ 'createSourceFile', 386 ],
  [ 'bindSourceFile', 386 ],
  [ 'findSourceFile', 101 ],
  [ 'emit', 4 ],
  [ 'createProgram', 2 ]
]
```

**`types_N.json`** liệt kê mọi kiểu đã tạo, kèm `display` là dạng chữ của nó:
```bash
$ node -e "
const t=require('./trace/types_0.json');
console.log('số type ghi lại:', t.length);
console.log(JSON.stringify(t.find(x => x.display && x.display.length > 40)));
"
```
```
số type ghi lại: 85
{"id":33,"recursionId":32,"unionTypes":[10,13,14,15,16,17,19],"flags":["Union"],"display":"string | number | bigint | boolean | null | undefined"}
```

Cách dùng thực dụng: sắp xếp theo độ dài `display` để tìm những kiểu khổng lồ mà bạn vô tình tạo ra.

```bash
$ node -e "
const fs=require('fs');
const all=fs.readdirSync('trace').filter(f=>f.startsWith('types_'))
  .flatMap(f=>require('./trace/'+f));
all.filter(t=>t.display).sort((a,b)=>b.display.length-a.display.length)
  .slice(0,5).forEach(t=>console.log(t.display.length, t.display.slice(0,90)));
"
```
Nếu top đầu là những kiểu dài hàng nghìn ký tự, bạn đã tìm ra thủ phạm.

---

## 7. Editor chậm nhưng `tsc` nhanh — vấn đề khác

`tsc` chạy một lần rồi thoát. Editor giữ **language server** sống và tính lại sau mỗi lần gõ. Ba nguyên nhân riêng của editor:

**a) File quá lớn.** Language server kiểm lại cả file khi bạn gõ. File 3000 dòng có type phức tạp sẽ giật. Tách file.

**b) Kiểu suy ra khổng lồ ở export.** Mỗi lần hover, editor phải in ra dạng chữ của kiểu. Nếu một hàm export trả về kiểu suy ra dài 5000 ký tự (hay gặp với builder pattern, Zod schema lớn), mọi thao tác liên quan đều chậm. Cách chữa: **ghi kiểu trả về tường minh** cho các export chính.

```ts
// ❌ editor phải suy và in kiểu khổng lồ mỗi lần
export const router = t.router({ /* 50 endpoint */ });

// ✅ chốt kiểu, cắt chuỗi suy luận
export const router: AppRouter = t.router({ /* ... */ });
```

**c) Nạp thừa `@types`.** Nếu `tsconfig` không có `"types"`, TypeScript nạp **mọi** package trong `node_modules/@types`. Khai rõ:
```jsonc
"types": ["node"]     // ← chỉ nạp cái cần
```
Kiểm tra bằng `--explainFiles` (bài A4 mục 6).

---

## 8. Checklist khi dự án chậm

Làm theo đúng thứ tự, đo lại sau mỗi bước:

1. `tsc --noEmit --extendedDiagnostics` — ghi lại 4 số làm mốc.
2. `skipLibCheck: true` chưa? → thường ăn ngay 30–50% (đo được 36× trong ví dụ mục 2).
3. `"types": [...]` đã khai rõ chưa? Xem `Files` có bất thường không.
4. `Instantiations` cao? Tìm generic đệ quy được gọi với nhiều tham số kiểu khác nhau → đặt tên trung gian.
5. Có `TS2589`/`TS2590` nào không? Sửa ngay — chúng vừa chậm vừa làm mất kiểu.
6. Có `type A & B & C...` dài không? Đổi sang `interface extends`.
7. Còn chậm → `--generateTrace`, mở perfetto, tìm thanh dài nhất.
8. Editor vẫn chậm dù `tsc` nhanh → ghi kiểu trả về tường minh cho các export lớn, tách file.

---

## Bài tập

1. Chạy `--extendedDiagnostics` trên một dự án thật của bạn. Ghi lại 4 số. Tắt `skipLibCheck` và đo lại. Tính tỉ lệ.

2. Tạo file có `type A = T0 & ... & T29` (30 type, mỗi type 25 field). Đo. Chuyển sang `interface extends`. Đo lại và tính tỉ lệ Check time.

3. Viết `DeepPartial` áp cho 30 type khác nhau, đo `Instantiations`. Thêm `interface PBig extends DeepPartial<Big> {}` cho từng type, đo lại.

4. Tạo một type template literal nổ (`TS2590`). Rồi giảm dần số nhánh đến khi qua được, ghi lại con số cuối cùng chạy được trên máy bạn.

5. Chạy `--generateTrace`, mở `trace.json` bằng ui.perfetto.dev, chụp lại thanh dài nhất và ghi tên sự kiện đó.

6. Dùng script ở mục 6 tìm 5 kiểu có `display` dài nhất trong dự án bạn. Chúng đến từ đâu?

7. Tìm một hàm export có kiểu trả về suy ra dài. Thêm kiểu tường minh và đo lại `Types`/`Check time`.

<details>
<summary>Gợi ý đáp án</summary>

**2.** Tỉ lệ đo được ở tài liệu này là 0.007s → 0.002s (3,5×), `Types` không đổi. Nếu dự án bạn không thấy khác biệt, nghĩa là intersection chưa phải nút thắt — đừng sửa.

**3.** 1024 → 361 instantiations trong ví dụ ở mục 3. Mức giảm phụ thuộc số lần dùng lại; dùng lại càng nhiều, đặt tên trung gian càng lời.

**6.** Thủ phạm hay gặp: kiểu trả về của builder/Zod schema lớn, `Prettify` áp lên union rộng, và kiểu suy ra của các object cấu hình khổng lồ khai bằng `as const`.

</details>

---

👉 Tiếp: [A7 — Monorepo và project references](./07-monorepo-project-references.md)
