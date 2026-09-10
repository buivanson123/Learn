# Hiệu năng và cách đo — 16 câu

Đây là nhóm câu mà **số liệu thay đổi hoàn toàn chất lượng câu trả lời**. Nói "nên tree-shake" thì
ai cũng nói được; nói "em đo được 26.2 KB xuống 1.4 KB gzip chỉ bằng cách đổi cách import" thì khác
hẳn.

Số đo dưới đây từ esbuild (minify + gzip) và Chromium.

---

## Phần 1 — Kích thước bundle (câu 1–6)

### 1. Cách bạn import một thư viện ảnh hưởng tới bundle thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Rất lớn, và đây là khoản tiết kiệm rẻ nhất trong toàn bộ việc tối ưu. Một `import`
sai cách kéo cả thư viện vào bundle dù bạn chỉ dùng một hàm.

**Giải thích sâu:** Đo thật, cùng một mục tiêu là dùng `debounce`:

| Cách import | minify | gzip |
|---|---|---|
| `import _ from 'lodash'` | 72.1 KB | 26.2 KB |
| `import { debounce } from 'lodash'` | **72.1 KB** | **26.2 KB** |
| `import debounce from 'lodash/debounce'` | 3.4 KB | 1.6 KB |
| `import { debounce } from 'lodash-es'` | 2.8 KB | 1.4 KB |

Dòng thứ hai là điều bất ngờ nhất: **cú pháp named import không tự động tree-shake được.** `lodash`
là CommonJS, và CommonJS phân giải lúc chạy nên bundler không dám cắt bỏ phần nào — kết quả y hệt
việc import cả gói.

Chỉ khi thư viện được phát hành dưới dạng **ESM** (`lodash-es`) thì bundler mới phân tích tĩnh và
loại bỏ được phần không dùng: 26.2 KB → **1.4 KB gzip, nhỏ hơn 18.7 lần**.

Cùng nguyên tắc với thư viện ngày tháng:

| Thư viện | minify | gzip |
|---|---|---|
| `moment` | 60.5 KB | 19.7 KB |
| `date-fns` (1 hàm) | 19.2 KB | 5.6 KB |
| `dayjs` | 7.6 KB | 3.3 KB |

`moment` nặng vì nó gộp sẵn mọi locale và không tree-shake được — đó là lý do chính khiến nó bị coi
là lỗi thời, chứ không phải vì API xấu.

Việc nên làm trong dự án thật: chạy bundle analyzer và **sắp theo kích thước**. Gần như lần nào cũng
có một thư viện chiếm 30–40% bundle mà không ai biết nó ở đó — thường là do một phụ thuộc gián tiếp.

</details>

### 2. Code splitting — tách theo cái gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tách theo **route** trước (mỗi trang một chunk), rồi tới các thành phần nặng chỉ
dùng theo điều kiện (modal, biểu đồ, trình soạn thảo, bản đồ). Dùng `import()` động.

**Giải thích sâu:** Đo thật với một ứng dụng có trang chủ nhẹ và một trang biểu đồ dùng `moment`:

```
### Gộp tất cả (static import)
│ app-static.js       │ 60.6 KB │ 19.8 KB gzip │
  -> Tải ban đầu: 19.8 KB gzip

### Tách chunk (dynamic import)
│ app-lazy.js         │  0.2 KB │  0.2 KB gzip │   ← entry
│ chart-OIC7IEEF.js   │ 59.8 KB │ 19.4 KB gzip │   ← chỉ tải khi vào trang biểu đồ
│ chunk-3RNHDNP5.js   │  0.8 KB │  0.5 KB gzip │   ← phần dùng chung
  -> Tải ban đầu: 0.2 KB gzip
```

**19.8 KB xuống 0.2 KB cho lần tải đầu** — chỉ bằng cách đổi `import` tĩnh thành `import()` động cho
phần không cần ngay.

Trong React:

```jsx
const TrangBieuDo = lazy(() => import('./TrangBieuDo'));
<Suspense fallback={<Skeleton />}><TrangBieuDo /></Suspense>
```

Ứng viên tách chunk theo thứ tự giá trị:

```
1. Route              — mỗi trang một chunk, giá trị cao nhất
2. Modal / dialog     — người dùng có thể không bao giờ mở
3. Biểu đồ, bản đồ    — thư viện rất nặng
4. Trình soạn thảo rich text — thường 100–300 KB
5. Đa ngôn ngữ        — chỉ tải ngôn ngữ đang dùng
6. Polyfill           — chỉ tải cho trình duyệt cần
```

Cái giá phải nói ra: mỗi chunk là một request thêm, và người dùng có thể thấy một khoảng chờ khi
chuyển trang. Cách xử lý là **preload khi có ý định**: bắt đầu tải chunk khi con trỏ chuột di vào
link, hoặc khi link xuất hiện trong khung nhìn.

```jsx
<Link to="/chart" onMouseEnter={() => import('./TrangBieuDo')}>Biểu đồ</Link>
```

Và cảnh báo: **tách quá nhỏ thì phản tác dụng.** 200 chunk nhỏ chậm hơn 10 chunk vừa, vì chi phí
mỗi request và vì các phụ thuộc chung bị nhân bản.

</details>

### 3. Tree shaking hoạt động thế nào? Vì sao nó thất bại?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bundler phân tích tĩnh `import`/`export` của ESM và loại bỏ phần không được dùng
tới. Nó thất bại khi module là CommonJS, khi có tác dụng phụ, hoặc khi gói không khai báo
`sideEffects: false`.

**Giải thích sâu:** Bốn nguyên nhân thất bại, kèm cách nhận biết:

**1. CommonJS.** Đã đo ở câu 1: `import { debounce } from 'lodash'` vẫn ra 26.2 KB gzip.

**2. Tác dụng phụ ở cấp module.** Bundler không dám cắt vì cắt đi có thể làm đổi hành vi:

```js
// trong thư viện
window.viTri = doViTri();       // tác dụng phụ -> module này không thể bị loại bỏ
Array.prototype.last = ...;     // sửa prototype toàn cục
import './styles.css';          // import CSS cũng là tác dụng phụ
```

**3. Gói không khai báo `sideEffects: false` trong `package.json`.** Không có khai báo này, bundler
phải giả định module có tác dụng phụ và giữ lại. Nếu bạn viết thư viện thì đây là một dòng bắt buộc.

**4. Bạn vô tình dùng cả gói:**
```js
import * as utils from './utils';    // namespace import làm khó tree-shaking
export * from './everything';         // barrel file kéo theo mọi thứ
```

Mục cuối đáng nói riêng: **barrel file** (`index.ts` re-export mọi thứ) rất tiện khi viết code nhưng
là kẻ thù của tree-shaking và của tốc độ build. `import { Button } from '@/components'` có thể kéo
theo cả thư mục components. Nhiều đội đã bỏ barrel file vì lý do này — nói ra chi tiết này cho thấy
bạn theo dõi thực tiễn hiện tại.

Cách kiểm chứng thay vì tin tưởng: build rồi tìm chuỗi đặc trưng của thư viện trong file output.
Nếu tìm thấy chuỗi của một hàm bạn không dùng, tree-shaking đã thất bại.

</details>

### 4. Nén: gzip hay brotli?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Brotli nhỏ hơn gzip khoảng 15–25% cho text. Dùng brotli mức nén cao cho file tĩnh
(nén sẵn lúc build), mức thấp cho response động, và luôn giữ gzip làm dự phòng.

**Giải thích sâu:** Đo trên một JSON API 100 bản ghi:

```
JSON gốc : 13871 byte
gzip     :   948 byte    ← nhỏ hơn 14.6 lần
brotli   :   533 byte    ← nhỏ hơn 26 lần
```

Text nén rất tốt vì JSON và JavaScript lặp lại nhiều: tên field, từ khoá, khoảng trắng.

Điểm cần nói để cho thấy bạn hiểu đánh đổi:

- **Nén tốn CPU.** Brotli mức 11 rất chậm — chỉ hợp khi nén **một lần lúc build** cho file tĩnh. Với
  response động, mức 4–5 cho tỷ lệ nén gần bằng mà nhanh hơn nhiều lần.
- **Đừng nén thứ đã nén.** JPEG, PNG, WebP, MP4, file zip — nén lại chỉ tốn CPU và đôi khi còn to
  hơn.
- **Nén sẵn lúc build** là lựa chọn tốt nhất cho tài sản tĩnh: tạo `app.js.br` và `app.js.gz`, server
  chỉ việc chọn file theo header `Accept-Encoding`. CPU lúc chạy bằng 0.

Chi tiết bảo mật đáng nói nếu muốn ghi điểm: nén **response động có chứa cả bí mật lẫn dữ liệu do
người dùng điều khiển** là điều kiện của tấn công BREACH — kẻ tấn công đoán bí mật qua kích thước
response. Đây là lý do một số nơi tắt nén cho response chứa CSRF token, hoặc thêm độ dài ngẫu nhiên
vào response.

</details>

### 5. Ngân sách hiệu năng (performance budget) là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Giới hạn số cụ thể mà đội cam kết không vượt — ví dụ "JS lần tải đầu ≤ 170 KB
gzip", "LCP p75 ≤ 2.5 s". Giá trị của nó nằm ở chỗ **được kiểm tra tự động trong CI**, nếu không nó
chỉ là một mong muốn.

**Giải thích sâu:** Vì sao cần: hiệu năng xuống cấp **từ từ**. Không ai thêm 500 KB trong một PR;
người ta thêm 20 KB mỗi tuần, và sau một năm trang chậm gấp đôi mà không có một thay đổi nào để đổ
lỗi.

Ngân sách khởi điểm hợp lý:

```
JavaScript lần tải đầu   ≤ 170 KB gzip
CSS                      ≤  50 KB gzip
Ảnh trên màn hình đầu    ≤ 200 KB
LCP (p75, mobile)        ≤ 2.5 s
INP (p75)                ≤ 200 ms
CLS (p75)                ≤ 0.1
```

Con số 170 KB không tuỳ tiện: trên mạng 4G chậm với điện thoại phổ thông, chừng đó JavaScript mất
khoảng 3–5 giây để tải, phân tích và thực thi. Biết **lý do đằng sau con số** quan trọng hơn con số.

Cách thực thi trong CI:

```yaml
# bundlesize / size-limit / lighthouse-ci
- name: Kiểm tra kích thước bundle
  run: npx size-limit          # thất bại nếu vượt ngưỡng trong package.json
```

Điểm thực dụng đáng nói: đặt ngân sách ban đầu **ở mức hiện tại**, không phải ở mức lý tưởng. Ngân
sách mà PR nào cũng vi phạm sẽ bị bỏ qua trong một tuần. Chốt mức hiện tại để **ngăn nó xấu đi**,
rồi siết dần.

</details>

### 6. Bundle đang lớn — bạn tìm cắt ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Chạy bundle analyzer, sắp theo kích thước, và xử lý từ trên xuống. Gần như lần nào
cũng có 2–3 thư viện chiếm phần lớn, và thường có cách thay thế rẻ hơn nhiều.

**Giải thích sâu:** Quy trình:

```
1. npx vite-bundle-visualizer   (hoặc webpack-bundle-analyzer, source-map-explorer)
2. Sắp theo kích thước, nhìn 10 mục đầu
3. Với mỗi mục hỏi ba câu:
   - Có cần nó trong lần tải đầu không?     -> không: import() động
   - Có dùng hết nó không?                   -> không: import lẻ hoặc chuyển sang bản ESM
   - Có cách nhẹ hơn không?                  -> moment 19.7 -> dayjs 3.3 KB gzip
```

Danh sách thay thế thường gặp, kèm số đo:

| Nặng | Nhẹ hơn | Ghi chú |
|---|---|---|
| `moment` (19.7 KB gzip) | `dayjs` (3.3), `date-fns` (5.6 cho 1 hàm) | dayjs có API gần giống moment |
| `lodash` (26.2) | `lodash-es` (1.4 cho 1 hàm), hoặc JS thuần | nhiều hàm nay đã có sẵn trong ngôn ngữ |
| `axios` | `fetch` có sẵn | axios vẫn hợp lý nếu cần interceptor |
| Toàn bộ icon set | chỉ import icon dùng tới | đây thường là khoản lớn bất ngờ |
| Nhiều thư viện animation | một cái, hoặc CSS thuần | dễ có hai thư viện trùng chức năng |

Ba chỗ hay bị bỏ sót và đáng kiểm tra riêng:

1. **Locale của thư viện ngày tháng và i18n** — thường kéo theo hàng chục ngôn ngữ không dùng.
2. **Polyfill cho trình duyệt không còn hỗ trợ.** Kiểm tra lại `browserslist`; nhiều dự án vẫn đang
   polyfill cho IE11.
3. **Cùng một thư viện bị nhân bản do khác phiên bản** — `npm ls <ten-goi>` để phát hiện.

</details>

---

## Phần 2 — Đo lường và tối ưu lúc chạy (câu 7–16)

### 7. Core Web Vitals gồm những gì và ngưỡng nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** LCP (nội dung lớn nhất hiện ra) ≤ 2.5 s, INP (phản hồi tương tác) ≤ 200 ms, CLS
(dịch chuyển layout) ≤ 0.1. Tất cả đo ở **p75 của người dùng thật**, tách riêng mobile và desktop.

**Giải thích sâu:**

| Chỉ số | Đo cái gì | Tốt | Kém |
|---|---|---|---|
| **LCP** | thời điểm phần tử lớn nhất hiển thị | ≤ 2.5 s | > 4 s |
| **INP** | độ trễ từ tương tác tới lần vẽ tiếp theo | ≤ 200 ms | > 500 ms |
| **CLS** | tổng điểm dịch chuyển bất ngờ | ≤ 0.1 | > 0.25 |

Điểm cập nhật cần biết: **INP đã thay thế FID từ 3/2024.** FID chỉ đo độ trễ của lần tương tác **đầu
tiên** và chỉ đo phần chờ, nên hầu như trang nào cũng đạt — nó là chỉ số quá dễ. INP đo **mọi** tương
tác và đo tới lúc màn hình thật sự cập nhật, nên nó phản ánh cảm nhận thật và khó đạt hơn nhiều.

Quan hệ giữa INP và long task đã đo ở
[02-trình-duyệt câu 6](./02-trinh-duyet-render-va-mang.md): long task 500 ms → độ trễ 467.7 ms. Nói
cách khác, **một long task 250 ms rơi trúng lúc người dùng bấm là đủ để trượt ngưỡng INP**.

Ba điểm hay bị hỏi tiếp:
- **p75 chứ không phải trung bình** — Google dùng p75 vì nó phản ánh trải nghiệm của phần lớn người
  dùng, kể cả nhóm ở điều kiện kém.
- **Dữ liệu thật (CrUX) chứ không phải Lighthouse.** Lighthouse là mô phỏng trong phòng lab; Search
  Console và CrUX mới là số của người dùng thật, và đó là số Google dùng để xếp hạng.
- **Ngoài ba chỉ số chính**: TTFB (server chậm), FCP (khi có gì đó xuất hiện) hữu ích để **chẩn
  đoán** — LCP chậm mà TTFB đã chậm sẵn thì vấn đề nằm ở backend, không phải ở frontend.

</details>

### 8. LCP chậm — nguyên nhân và cách sửa

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bốn thành phần: TTFB, độ trễ bắt đầu tải tài nguyên, thời gian tải tài nguyên, và
độ trễ render. Phải biết phần nào chiếm nhiều nhất trước khi sửa.

**Giải thích sâu:** Phân rã LCP:

```
[--- TTFB ---][--- chờ bắt đầu tải ---][--- tải ---][--- render ---]
```

Cách sửa theo từng phần:

| Phần | Thường vì | Sửa |
|---|---|---|
| TTFB | server chậm, không cache, xa người dùng | CDN, cache, tối ưu backend |
| Chờ bắt đầu tải | ảnh bị phát hiện muộn (nằm trong CSS, hoặc do JS chèn) | `<link rel=preload>`, `fetchpriority="high"` |
| Tải | ảnh quá nặng, định dạng cũ | AVIF/WebP, `srcset`, nén |
| Render | JS chặn, font chặn, hydration chậm | `defer`, `font-display`, giảm JS |

Sai lầm phổ biến nhất, đáng nói riêng: **lazy load phần tử LCP**. Ảnh hero đặt `loading="lazy"` làm
trình duyệt hoãn tải nó lại — đúng cái ảnh quyết định điểm LCP.

```html
<!-- Ảnh hero -->
<img src="hero.avif" fetchpriority="high" width="1200" height="600" alt="...">
<!-- KHÔNG có loading="lazy" -->
```

Vấn đề thứ hai: **phần tử LCP được chèn bởi JavaScript**. Trình duyệt có bộ quét preload chạy trước
cả khi HTML được parse xong, nhưng nó chỉ thấy được thẻ có sẵn trong HTML. Ảnh do React render sau
khi tải bundle thì phải đợi cả chuỗi: tải JS → chạy JS → render → mới bắt đầu tải ảnh. Đây là lý do
SSR hoặc render sẵn cải thiện LCP rõ rệt.

Cách xác định phần tử LCP là gì: DevTools → Performance → mục "LCP" trong phần Timings, hoặc

```js
new PerformanceObserver(l => {
  const e = l.getEntries().at(-1);
  console.log('Phần tử LCP:', e.element, e.startTime);
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

</details>

### 9. Preload, prefetch, preconnect, dns-prefetch — khác nhau thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `preconnect` mở sẵn kết nối. `dns-prefetch` chỉ phân giải DNS. `preload` tải ngay
một tài nguyên **cần cho trang hiện tại**. `prefetch` tải với độ ưu tiên thấp thứ **có thể cần ở
trang sau**.

**Giải thích sâu:**

```html
<link rel="dns-prefetch" href="https://api.x.com">          <!-- chỉ DNS, rẻ nhất -->
<link rel="preconnect"   href="https://api.x.com" crossorigin> <!-- DNS + TCP + TLS -->
<link rel="preload" href="/f/inter.woff2" as="font" type="font/woff2" crossorigin>
<link rel="prefetch" href="/trang-sau.js">                    <!-- cho điều hướng tiếp theo -->
```

Khi nào dùng cái nào:

| | Dùng khi | Cẩn thận |
|---|---|---|
| `dns-prefetch` | domain bên thứ ba sẽ dùng sau | rất rẻ, dùng thoải mái |
| `preconnect` | domain **chắc chắn** sẽ dùng sớm | mỗi kết nối tốn tài nguyên, giới hạn 2–3 cái |
| `preload` | tài nguyên quan trọng bị phát hiện muộn | **preload sai làm chậm thứ khác** |
| `prefetch` | trang người dùng nhiều khả năng vào tiếp | lãng phí băng thông nếu đoán sai |

Cảnh báo về `preload`: nó nâng độ ưu tiên **lên trên** các tài nguyên khác. Preload 5 thứ nghĩa là 5
thứ đó cạnh tranh với nhau và với cả những thứ thật sự quan trọng — kết quả có thể **chậm hơn** khi
không preload gì. Chrome còn cảnh báo trong console nếu tài nguyên được preload nhưng không dùng
trong vài giây.

Thuộc tính `crossorigin` với font là **bắt buộc**, kể cả font cùng origin — thiếu nó font bị tải hai
lần (đã nói ở [02-trình-duyệt câu 14](./02-trinh-duyet-render-va-mang.md)).

Ứng dụng thực tế mạnh nhất của `prefetch`: prefetch chunk của trang khi link xuất hiện trong khung
nhìn hoặc khi chuột di vào. Next.js làm sẵn điều này cho `<Link>`; với router khác thì bạn tự làm
bằng `IntersectionObserver`.

</details>

### 10. Web Worker dùng khi nào ở frontend?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi có tính toán nặng thuần dữ liệu: xử lý mảng lớn, parse file lớn, mã hoá, xử lý
ảnh, tính toán trong trình soạn thảo. Không dùng được để thao tác DOM.

**Giải thích sâu:** Lợi ích là luồng chính rảnh → giao diện không giật, INP không bị ảnh hưởng.

```js
// main
const w = new Worker(new URL('./xu-ly.js', import.meta.url), { type: 'module' });
w.postMessage(duLieuLon);
w.onmessage = (e) => setKetQua(e.data);
```

Cái giá phải cân nhắc:
- **Chi phí truyền dữ liệu.** Mặc định dữ liệu được **sao chép** (structured clone), nên gửi một
  mảng 50 MB qua lại có thể tốn hơn cả phép tính. Dùng `Transferable` (`ArrayBuffer`) để chuyển
  quyền sở hữu thay vì sao chép, hoặc `SharedArrayBuffer` (cần header COOP/COEP).
- **Khởi tạo worker tốn vài chục ms** — không đáng cho việc nhỏ.
- **Không có DOM, không có `window`.** Worker chỉ tính toán rồi trả kết quả.

Ngưỡng thực dụng: nếu phép tính dưới ~50 ms thì làm ngay trên luồng chính, có chia lô nếu cần. Trên
100 ms và lặp lại thường xuyên thì worker đáng giá.

Ứng dụng thực tế đáng kể tên: parse CSV người dùng upload, tìm kiếm/lọc trên bộ dữ liệu lớn trong
bộ nhớ, tô màu cú pháp cho trình soạn thảo, tính toán trong ứng dụng bảng tính, mã hoá đầu-cuối.

Thư viện `comlink` biến giao tiếp với worker thành gọi hàm bình thường — đáng nhắc vì nó xoá bỏ phần
lớn sự phiền phức của `postMessage`.

</details>

### 11. Virtual list — khi nào cần và cái giá là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cần khi danh sách vượt khoảng vài trăm dòng, hoặc khi mỗi dòng phức tạp. Cái giá:
mất `Ctrl+F` của trình duyệt, khó cuộn tới vị trí, phức tạp với dòng cao thấp khác nhau, và cần chú
ý khả năng tiếp cận.

**Giải thích sâu:** Đo ở [02-trình-duyệt câu 5](./02-trinh-duyet-render-va-mang.md):

```
toan_bo: { ms: 47.1, so_node: 10000 }
ao_hoa : { ms:  0.6, so_node:    30 }
```

Nhưng con số 47 ms không phải lý do chính. Lý do chính là **chi phí liên tục**: 10.000 node phải
được layout lại mỗi lần có thay đổi, tốn bộ nhớ, và với React là 10.000 phần tử phải diff mỗi render.

Những gì bị mất, phải nói ra vì đây là phần người phỏng vấn muốn nghe:

```
- Ctrl+F của trình duyệt không tìm được nội dung chưa render
- In trang chỉ ra phần đang hiển thị
- Screen reader cần aria-rowcount / aria-rowindex để biết tổng số
- Cuộn tới một dòng cụ thể phải tự cài đặt
- Dòng cao thấp khác nhau -> phải đo và nhớ, dễ nhảy thanh cuộn
```

Phương án nhẹ hơn nên cân nhắc trước:

```css
.row { content-visibility: auto; contain-intrinsic-size: 0 40px; }
```

Trình duyệt bỏ qua layout và paint cho phần ngoài khung nhìn. Một dòng CSS, giữ nguyên `Ctrl+F` và
khả năng tiếp cận. Đổi lại nó không giảm số node DOM, nên React vẫn phải diff đủ.

Và câu hỏi nghiệp vụ nên đặt ra trước: **người dùng có thật sự cuộn qua 10.000 dòng không?** Thường
thì tìm kiếm, lọc và phân trang là câu trả lời đúng — và rẻ hơn mọi giải pháp kỹ thuật.

</details>

### 12. Ứng dụng giật khi cuộn — tìm nguyên nhân thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ghi lại bằng tab Performance trong lúc cuộn và tìm các khung hình dài hơn 16 ms.
Thủ phạm thường là: listener `scroll` làm việc nặng, layout thrashing, animate sai thuộc tính, hoặc
quá nhiều node DOM.

**Giải thích sâu:** Quy trình:

```
1. DevTools > Performance > ghi lại 3 giây cuộn
2. Nhìn dải "Frames": khung hình đỏ = quá 16.7 ms (dưới 60fps)
3. Bung một khung hình đỏ ra xem thời gian nằm ở đâu:
   - Scripting (vàng)  -> listener scroll làm quá nhiều việc
   - Rendering (tím)   -> layout, thường do thrashing
   - Painting (xanh)   -> vùng vẽ lại quá lớn, hoặc shadow/filter đắt
```

Các nguyên nhân và cách sửa:

```js
// 1. Listener scroll đọc layout mỗi sự kiện — scroll bắn hàng chục lần/giây
window.addEventListener('scroll', () => {
  const r = el.getBoundingClientRect();     // forced layout MỖI LẦN
});
// -> Thay bằng IntersectionObserver: trình duyệt tính giúp, không chạy trên luồng chính

// 2. Listener không passive — trình duyệt phải ĐỢI xem bạn có preventDefault không
el.addEventListener('touchstart', f, { passive: true });   // báo trước là không chặn

// 3. Animate top/left thay vì transform  -> layout mỗi khung hình
// 4. box-shadow / filter / backdrop-filter trên vùng lớn -> paint đắt
```

Mục 1 đáng nhấn mạnh: đo được ở
[02-trình-duyệt câu 3](./02-trinh-duyet-render-va-mang.md), forced layout khiến 400 phần tử chậm đi
74.8 lần. Trong listener scroll thì nó xảy ra liên tục.

Mục 2 ít người biết mà tác dụng rất rõ trên di động: không có `passive: true`, trình duyệt phải chờ
JavaScript chạy xong mới biết có được cuộn hay không — cảm giác "dính tay" khi vuốt.

Công cụ nhanh để khoanh vùng: DevTools → Rendering → bật **"Paint flashing"**. Vùng nào nhấp nháy
xanh khi cuộn là vùng đang bị vẽ lại; nếu cả màn hình nhấp nháy thì có gì đó buộc vẽ lại toàn bộ.

</details>

### 13. SSR, SSG, ISR, CSR — chọn cái nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** SSG cho nội dung ít đổi (blog, tài liệu, landing). SSR cho nội dung cá nhân hoá
hoặc luôn phải mới. ISR khi muốn lợi ích của SSG mà nội dung vẫn cập nhật. CSR cho phần sau đăng
nhập, nơi SEO không quan trọng.

**Giải thích sâu:**

| | Render lúc nào | TTFB | SEO | Hợp với |
|---|---|---|---|---|
| **SSG** | lúc build | nhanh nhất (file tĩnh) | tốt | blog, tài liệu, marketing |
| **ISR** | lúc build + làm mới định kỳ | nhanh | tốt | thương mại điện tử, tin tức |
| **SSR** | mỗi request | phụ thuộc server | tốt | dashboard cá nhân hoá, nội dung theo user |
| **CSR** | trên trình duyệt | nhanh (vỏ rỗng) | kém nếu không xử lý | ứng dụng sau đăng nhập |

Trong một ứng dụng thật, câu trả lời gần như luôn là **kết hợp**: trang chủ SSG, trang sản phẩm ISR,
trang tài khoản SSR hoặc CSR. Next.js App Router cho phép chọn theo từng route, và nói được điều
này quan trọng hơn là chọn một cái duy nhất.

Điểm đánh đổi ít người nói tới: **SSR chuyển chi phí từ máy người dùng sang server của bạn**. Nó cải
thiện trải nghiệm trên máy yếu, nhưng làm tăng chi phí vận hành và thêm một thứ có thể sập. Với
lượng traffic lớn, SSG + CDN vừa nhanh hơn vừa rẻ hơn nhiều lần.

Và vấn đề của SSR mà ai đã làm đều gặp: **hydration**. HTML tới nhanh nhưng trang chưa tương tác
được cho tới khi JavaScript tải và hydrate xong. Người dùng thấy nút, bấm vào, không có gì xảy ra —
đôi khi còn tệ hơn là hiện skeleton. Đây là vấn đề mà React Server Components và streaming SSR sinh
ra để giải quyết.

</details>

### 14. Hydration là gì và lỗi hydration mismatch từ đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hydration là việc React gắn trình xử lý sự kiện và state vào HTML đã render sẵn từ
server. Lỗi mismatch xảy ra khi HTML của server khác với cây React dựng ra ở client.

**Giải thích sâu:** Nguyên nhân, theo tần suất:

```jsx
// 1. Thời gian và ngẫu nhiên — server và client chạy ở hai thời điểm khác nhau
<div>{new Date().toLocaleString()}</div>
<div>{Math.random()}</div>

// 2. Đọc thứ chỉ có ở trình duyệt
<div>{window.innerWidth}</div>          // server không có window
<div>{localStorage.getItem('theme')}</div>

// 3. Múi giờ và locale khác nhau giữa server và trình duyệt người dùng

// 4. HTML không hợp lệ — trình duyệt TỰ SỬA cấu trúc, làm cây khác đi
<p><div>x</div></p>                      // trình duyệt tách <p> ra
```

Nguyên nhân 4 rất khó tìm vì code trông hoàn toàn bình thường: `<div>` không được nằm trong `<p>`,
và `<tr>` phải nằm trong `<tbody>`. Trình duyệt lặng lẽ sửa lại cấu trúc DOM, còn React thì không
biết.

Cách xử lý đúng cho nội dung chỉ có ở client:

```jsx
const [daMount, setDaMount] = useState(false);
useEffect(() => setDaMount(true), []);
return daMount ? <ThoiGianThuc /> : <Skeleton />;
// hoặc
<div suppressHydrationWarning>{new Date().toLocaleString()}</div>
```

`suppressHydrationWarning` chỉ nên dùng khi bạn **biết chắc** khác biệt là vô hại (một dấu thời
gian), không phải để làm im cảnh báo.

Vì sao lỗi này nghiêm trọng chứ không chỉ là cảnh báo: React 18+ khi gặp mismatch sẽ **bỏ HTML của
server và render lại toàn bộ ở client** — mất sạch lợi ích của SSR, và người dùng thấy nội dung nhấp
nháy. Nó biến một tối ưu thành một khoản chi phí thuần.

</details>

### 15. Đo hiệu năng từ người dùng thật — cài thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Dùng thư viện `web-vitals` để thu LCP/INP/CLS, gắn kèm ngữ cảnh (route, loại thiết
bị, loại mạng), gửi về bằng `sendBeacon`, và phân tích theo **p75 chia theo nhóm**.

**Giải thích sâu:**

```js
import { onLCP, onINP, onCLS, onTTFB } from 'web-vitals';
const gui = (m) => {
  navigator.sendBeacon('/rum', JSON.stringify({
    ten: m.name, gia_tri: m.value, rating: m.rating,
    route: location.pathname,
    thiet_bi: navigator.userAgentData?.mobile ? 'mobile' : 'desktop',
    mang: navigator.connection?.effectiveType,      // '4g', '3g'...
    bo_nho: navigator.deviceMemory,                  // GB, gợi ý về sức mạnh máy
  }));
};
[onLCP, onINP, onCLS, onTTFB].forEach(f => f(gui));
```

Ba chi tiết kỹ thuật quan trọng:

1. **`sendBeacon` chứ không phải `fetch`.** Chỉ số cuối cùng thường được ghi nhận lúc người dùng rời
   trang; `fetch` bình thường sẽ bị huỷ, còn `sendBeacon` được trình duyệt bảo đảm gửi đi.
2. **Chỉ số được báo cáo nhiều lần.** CLS tích luỹ dần, INP cập nhật khi có tương tác tệ hơn. Phải
   xử lý cập nhật, không phải chỉ lấy giá trị đầu.
3. **Lấy mẫu nếu lưu lượng lớn** — 10% người dùng đã đủ để có ý nghĩa thống kê và tiết kiệm chi phí
   lưu trữ đáng kể.

Cách phân tích mới là phần tạo ra giá trị: **tách theo route**. "LCP của trang chủ 1.8 s, của trang
sản phẩm 4.2 s" hữu ích; "LCP trung bình toàn site 2.4 s" thì không hành động được. Tách thêm theo
thiết bị và loại mạng thường phơi bày ra một nhóm người dùng đang có trải nghiệm rất tệ mà số tổng
hợp che mất.

Nếu không muốn tự dựng: Sentry, Datadog RUM, Vercel Analytics, hoặc Google Search Console (miễn phí,
dùng dữ liệu CrUX — chính là dữ liệu ảnh hưởng tới xếp hạng tìm kiếm).

</details>

### 16. "Trang chậm" — bạn hỏi lại những gì trước khi bắt tay vào sửa?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Chậm ở đâu (tải trang hay tương tác), với ai (thiết bị, mạng, khu vực), ở màn hình
nào, từ khi nào, và **chậm bao nhiêu là đủ nhanh**. Không có những câu này thì bạn đang tối ưu mù.

**Giải thích sâu:** Đây là câu kiểm tra tư duy chứ không phải kiến thức, và cách bạn mở đầu quan
trọng hơn cách bạn kết thúc.

```
1. "Chậm" là gì?
   - Tải trang lần đầu chậm      -> bundle, mạng, TTFB
   - Bấm vào không phản hồi      -> INP, long task
   - Cuộn giật                   -> render, layout
   - Chuyển trang chậm           -> code splitting, gọi dữ liệu
   Ba nguyên nhân khác nhau, ba cách sửa khác nhau.

2. Với ai? Mọi người hay một nhóm?
   -> mọi người: vấn đề chung
   -> chỉ Android tầm trung: vấn đề CPU, JavaScript quá nặng
   -> chỉ một khu vực: CDN chưa phủ, hoặc server ở xa

3. Từ khi nào? Có trùng với lần deploy nào không?
   -> nếu có, xem diff. Rẻ hơn nhiều so với điều tra từ đầu.

4. Số nào chứng minh? Có RUM không, hay chỉ là cảm nhận?
   -> nếu chỉ là cảm nhận thì việc đầu tiên là dựng cách đo.

5. Nhanh bao nhiêu là đủ?
   -> không có đích thì tối ưu không bao giờ kết thúc.
```

Sau khi có câu trả lời, thứ tự làm việc:

```
Đo  ->  tìm nút cổ chai lớn nhất  ->  sửa MỘT thứ  ->  đo lại  ->  lặp
```

Sửa năm thứ cùng lúc rồi thấy nhanh hơn 30% thì bạn không biết thứ nào có tác dụng — và lần sau bạn
sẽ lặp lại cả năm thứ, kể cả những thứ vô ích hoặc có hại.

Câu chốt ăn điểm: **"Em muốn tránh tối ưu thứ không ai để ý. Em từng thấy đội bỏ hai tuần cắt 100 KB
bundle trong khi vấn đề thật là một API mất 3 giây. Vì vậy em đo trước, và em đo cái người dùng cảm
nhận được, không phải cái dễ đo."**

</details>

---

Tiếp: [05-kien-truc-testing-va-tinh-huong.md](./05-kien-truc-testing-va-tinh-huong.md)
