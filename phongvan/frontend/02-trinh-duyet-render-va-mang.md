# Trình duyệt, render và mạng — 16 câu

Nhóm câu này phân biệt người "viết được React" với người **hiểu cái gì đang chạy bên dưới**. Nó
cũng là nhóm mà câu trả lời có số đo sẽ nổi bật hẳn so với câu trả lời lý thuyết.

Output đo trên Chromium qua Playwright.

---

## Phần 1 — Render pipeline (câu 1–7)

### 1. Từ lúc gõ URL tới lúc thấy chữ trên màn hình, có những bước nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** DNS → TCP → TLS → HTTP request → nhận HTML → phân tích thành DOM (gặp CSS và JS
thì xử lý xen kẽ) → CSSOM → cây render → layout → paint → composite.

**Giải thích sâu:** Người phỏng vấn hỏi câu này để xem bạn dừng ở đâu. Câu trả lời nông dừng ở
"trình duyệt render HTML". Câu trả lời tốt đi vào **chỗ bị chặn**:

```
HTML parse
   ├─ gặp <link rel=stylesheet>  -> CHẶN RENDER (không chặn parse)
   ├─ gặp <script>               -> CHẶN PARSE, và phải đợi CSS phía trên tải xong
   ├─ gặp <script defer>         -> tải song song, chạy sau khi parse xong, đúng thứ tự
   ├─ gặp <script async>         -> tải song song, chạy NGAY khi tải xong, SAI thứ tự
   └─ gặp <img>                  -> không chặn gì
```

Dòng thứ ba là chi tiết ăn điểm: **một thẻ `<script>` đồng bộ phải đợi mọi CSS phía trên nó tải
xong mới chạy** — vì script có thể hỏi `getComputedStyle`, nên trình duyệt phải bảo đảm CSSOM đã
sẵn sàng. Hệ quả: một file CSS chậm không chỉ chặn hiển thị mà còn chặn cả JavaScript.

Kết luận thực dụng rút ra:
- CSS quan trọng đặt trong `<head>`, càng nhỏ càng tốt; phần còn lại tải bất đồng bộ.
- `<script>` dùng `defer` (giữ đúng thứ tự) là mặc định an toàn; `async` chỉ cho script độc lập
  như analytics.
- `<script type="module">` mặc định đã là `defer`.

</details>

### 2. Reflow (layout) và repaint khác nhau thế nào? Cái nào đắt hơn?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Reflow là tính lại **vị trí và kích thước** của các phần tử — đắt, và có thể lan
ra cả cây. Repaint là vẽ lại pixel mà không đổi hình học — rẻ hơn. Rẻ nhất là chỉ **composite**
(`transform`, `opacity`), vì nó chạy trên GPU và không đụng luồng chính.

**Giải thích sâu:**

```
Đổi width, height, top, font-size, thêm/xoá node   -> layout -> paint -> composite  (đắt nhất)
Đổi color, background, box-shadow, visibility      ->          paint -> composite
Đổi transform, opacity                             ->                   composite   (rẻ nhất)
```

Đây là lý do animation phải làm bằng `transform: translateX()` chứ không phải `left`. Đổi `left`
buộc trình duyệt tính lại layout **mỗi khung hình**, ở 60fps là 60 lần/giây; `transform` thì luồng
chính không phải làm gì cả.

Cách kiểm chứng thay vì tin lời: DevTools → Performance → ghi lại → nhìn các dải màu. Dải tím
(Layout) và xanh lá (Paint) xuất hiện đều đặn trong lúc animation nghĩa là bạn đang animate sai
thuộc tính.

Một chi tiết đáng nói thêm: `will-change: transform` đẩy phần tử lên một layer riêng để composite rẻ
hơn, nhưng **mỗi layer tốn bộ nhớ GPU**. Đặt `will-change` cho 500 phần tử là cách làm tụt hiệu năng
chứ không phải tăng. Chỉ đặt cho phần tử sắp animate, và gỡ ra sau khi xong.

</details>

### 3. Layout thrashing là gì? Đo được không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đọc một thuộc tính hình học (`offsetWidth`, `getBoundingClientRect`) ngay sau khi
ghi vào style buộc trình duyệt **tính lại layout ngay lập tức** (forced synchronous layout). Lặp
trong vòng lặp thì mỗi vòng là một lần tính lại toàn bộ.

**Giải thích sâu:** Đo trên 400 phần tử trong Chromium:

```js
// A. Đọc-ghi xen kẽ
for (const el of els) { const w = el.offsetWidth; el.style.width = (w+1)+'px'; }

// B. Đọc hết trước, ghi hết sau
const ws = els.map(el => el.offsetWidth);
els.forEach((el,i) => el.style.width = (ws[i]+1)+'px');
```
```
{ so_element: 400, xen_ke_ms: 29.9, tach_nhom_ms: 0.4, nhanh_hon: 74.8 }
```

**Nhanh hơn 74.8 lần chỉ bằng cách đổi thứ tự các dòng.** Không thay đổi thuật toán, không thay đổi
kết quả.

Cơ chế: trình duyệt gom các thay đổi style vào một hàng chờ và chỉ tính layout một lần trước khi vẽ.
Nhưng khi bạn **đọc** một giá trị phụ thuộc layout, nó buộc phải xả hàng chờ và tính ngay để trả về
số đúng. Ghi → đọc → ghi → đọc là ép nó tính lại 400 lần.

Các thuộc tính gây forced layout khi đọc — đáng thuộc vài cái để nhận ra trong code review:

```
offsetTop/Left/Width/Height    scrollTop/Left/Width/Height    clientTop/Left/Width/Height
getBoundingClientRect()        getComputedStyle()             window.innerHeight (một số trường hợp)
```

Cách phát hiện trên dự án thật: DevTools → Performance, tìm các mục có **tam giác cảnh báo đỏ** ghi
"Forced reflow is a likely performance bottleneck". Nó chỉ thẳng ra dòng code gây ra.

Trong React thì hiếm gặp hơn (React gom cập nhật), nhưng vẫn xảy ra ở code đo kích thước phần tử —
ví dụ thư viện tooltip, kéo-thả, hoặc virtual list tự viết.

</details>

### 4. Vì sao nối chuỗi vào `innerHTML` trong vòng lặp lại chậm?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mỗi lần gán `innerHTML` là trình duyệt **huỷ toàn bộ DOM con và phân tích lại từ
đầu**. Trong vòng lặp thì đó là hành vi bậc hai theo số phần tử.

**Giải thích sâu:** Đo với 2000 phần tử:

```js
for (let i=0;i<n;i++) root.innerHTML += `<div>${i}</div>`;      // A
let s=''; for (let i=0;i<n;i++) s += `<div>${i}</div>`; root.innerHTML = s;  // B
```
```
{ so_phan_tu: 2000, noi_trong_vong_lap_ms: 606.9, gan_mot_lan_ms: 0.6, nhanh_hon: 1012 }
```

**Chậm hơn 1012 lần.** Và con số này còn xấu đi theo bình phương: 4000 phần tử không phải chậm gấp
đôi mà gấp bốn.

`innerHTML +=` thực chất là `innerHTML = innerHTML + '...'` — trình duyệt phải **serialize toàn bộ
DOM hiện có thành chuỗi**, nối thêm, rồi **parse lại tất cả**. Ở phần tử thứ 2000, nó đang parse
lại 2000 phần tử.

Tác dụng phụ nghiêm trọng hơn cả tốc độ: mỗi lần gán, các node cũ bị thay bằng node mới → **mất hết
event listener** đã gắn, mất trạng thái của `<input>`, mất vị trí con trỏ, mất focus.

Ba cách đúng:

```js
root.innerHTML = chuoi;                    // gán một lần
root.insertAdjacentHTML('beforeend', s);   // thêm mà không đụng node cũ
const frag = document.createDocumentFragment();   // dựng ngoài cây rồi gắn một lần
```

Và cảnh báo bảo mật phải nói kèm: `innerHTML` với dữ liệu người dùng là **XSS**. Dùng `textContent`
cho văn bản thuần — vừa an toàn vừa nhanh hơn vì không cần parser HTML.

</details>

### 5. Render 10.000 dòng trong bảng — xử lý thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ảo hoá (virtualization): chỉ tạo DOM cho những dòng đang nằm trong khung nhìn,
cộng một ít đệm hai đầu. Số node DOM là chi phí thật, không chỉ là chi phí tạo ra chúng.

**Giải thích sâu:** Đo trong Chromium:

```
toan_bo: { ms: 47.1, so_node: 10000 }
ao_hoa : { ms:  0.6, so_node:    30 }
nhanh_hon: 78.5
```

47 ms cho một lần render nghe có vẻ chấp nhận được — nhưng đó chỉ là **lần tạo đầu tiên**. Chi phí
thật của 10.000 node là chi phí **liên tục**:

- Mỗi lần layout phải duyệt qua cả 10.000 node.
- Bộ nhớ: mỗi node DOM tốn hàng trăm byte, cộng với style đã tính toán.
- Với React: mỗi lần render là 10.000 phần tử phải so sánh (diff).
- Cuộn trang trở nên giật vì mỗi khung hình phải xử lý cây lớn.

Thư viện nên nhắc tên: `@tanstack/react-virtual`, `react-window`. Tự viết thì phần khó nằm ở dòng
có **chiều cao thay đổi** (phải đo và nhớ), ở việc cuộn tới một vị trí cụ thể, và ở khả năng truy
cập (screen reader cần biết tổng số dòng — dùng `aria-rowcount`).

Giải pháp không cần JavaScript, đáng nói vì nó cho thấy bạn cập nhật:

```css
.row { content-visibility: auto; contain-intrinsic-size: 0 40px; }
```

`content-visibility: auto` bảo trình duyệt bỏ qua việc layout và paint cho phần tử ngoài khung nhìn.
Một dòng CSS, không cần thư viện. Đổi lại: nó không giảm được số node DOM (nên React vẫn phải diff
đủ), và `contain-intrinsic-size` phải ước lượng đúng nếu không thanh cuộn sẽ nhảy.

Và câu hỏi nên hỏi ngược lại: **"người dùng có thật sự cần 10.000 dòng cùng lúc không?"** Thường thì
phân trang, tìm kiếm hoặc lọc là câu trả lời đúng cho nghiệp vụ, và nó rẻ hơn mọi giải pháp kỹ thuật.

</details>

### 6. Long task ảnh hưởng tới người dùng thế nào? Đo được không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trong lúc luồng chính bận, mọi tương tác đều **xếp hàng chờ**. Độ trễ xử lý gần
như bằng đúng phần còn lại của long task — đo được tỷ lệ tuyến tính rất rõ.

**Giải thích sâu:** Đo bằng cách chặn luồng chính rồi click thật (không phải giả lập sự kiện):

```
long task    0 ms  ->  do tre xu ly click:   8.6 ms
long task  100 ms  ->  do tre xu ly click:  67.5 ms
long task  500 ms  ->  do tre xu ly click: 467.7 ms
long task 1000 ms  ->  do tre xu ly click: 968.0 ms
```

Quan hệ gần như 1:1. Đây chính là chỉ số **INP (Interaction to Next Paint)** — chỉ số Core Web Vital
đã thay thế FID từ tháng 3/2024. Ngưỡng "tốt" của Google là **INP ≤ 200 ms**; theo bảng trên, chỉ
cần một long task 250 ms rơi trúng lúc người dùng bấm là bạn đã trượt.

Long task đến từ đâu, theo tần suất thực tế:
1. Chạy và biên dịch JavaScript lúc khởi động — bundle càng lớn càng lâu.
2. Render một danh sách lớn trong React (không ảo hoá).
3. `JSON.parse` một payload lớn.
4. Vòng lặp xử lý dữ liệu (lọc, sắp xếp, tính tổng) trên mảng vài chục nghìn phần tử.
5. Layout thrashing (câu 3).

Cách chia nhỏ, theo thứ tự nên thử:

```js
// 1. Nhường luồng giữa các lô — API mới, đúng chuẩn
for (const lo of cacLo) { xuLy(lo); await scheduler.yield(); }

// 2. Hạ ưu tiên việc không gấp
scheduler.postTask(() => tinhToanPhu(), { priority: 'background' });

// 3. Đẩy hẳn ra khỏi luồng chính
const worker = new Worker('xu-ly.js');   // cho tính toán nặng và thuần dữ liệu
```

Đo trên dự án thật: `PerformanceObserver` với `type: 'longtask'` để ghi lại mọi task > 50 ms, gửi về
hệ thống giám sát cùng với tên route — bạn sẽ biết màn hình nào đang có vấn đề thay vì đoán.

</details>

### 7. CLS là gì và làm sao đưa nó về 0?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** CLS đo mức độ nội dung **nhảy chỗ** trong lúc tải. Cách chống chính: đặt sẵn kích
thước cho mọi thứ tải bất đồng bộ (ảnh, iframe, quảng cáo, font), và không chèn nội dung phía trên
nội dung đã hiển thị.

**Giải thích sâu:** Đo thật với một ảnh không khai báo kích thước:

```
Vi tri chu "Noi dung" truoc khi anh tai: 50 px
Vi tri sau khi anh tai                 : 350 px  (nhay xuong 300 px)
So lan layout shift: 1
CLS do duoc         : 0.0117    | nguong "tot" cua Google: <= 0.1
```

Cùng trang đó với `width`, `height` và `aspect-ratio`:

```
CLS khi anh CO width/height + aspect-ratio: 0.0000
```

Chú ý con số **0.0117** — nó nhỏ dù nội dung nhảy tới 300 px. Đây là chi tiết đáng hiểu, vì nó giải
thích vì sao CLS đôi khi trông "ổn" trong khi trải nghiệm rất tệ:

```
CLS = tỷ lệ vùng bị ảnh hưởng × tỷ lệ khoảng dịch chuyển
```

Ở đây phần tử bị đẩy chỉ là một dòng chữ nhỏ, chiếm phần rất nhỏ khung nhìn → điểm thấp. Nếu cả một
khối nội dung lớn bị đẩy 300 px thì điểm sẽ cao hơn nhiều lần.

Nguồn gây CLS theo thứ tự phổ biến:

| Nguồn | Cách sửa |
|---|---|
| Ảnh không có kích thước | luôn có `width`/`height`, hoặc `aspect-ratio` trong CSS |
| Font chữ tuỳ chỉnh (FOUT) | `font-display: optional`, `size-adjust`, preload font |
| Banner/thông báo chèn vào đầu trang | đặt chỗ sẵn, hoặc dùng `position: fixed` |
| Quảng cáo, embed | đặt chỗ sẵn với chiều cao tối thiểu |
| Nội dung tải sau chèn vào giữa | dùng skeleton **đúng kích thước** với nội dung thật |

Điểm đáng nói cuối: **CLS bỏ qua dịch chuyển xảy ra trong 500 ms sau tương tác của người dùng**
(`hadRecentInput`) — vì mở accordion làm nội dung dịch xuống là điều người dùng mong đợi, không phải
lỗi. Biết chi tiết này cho thấy bạn đã đọc kỹ chứ không chỉ nghe tên chỉ số.

</details>

---

## Phần 2 — Mạng và bảo mật trình duyệt (câu 8–16)

### 8. CORS hoạt động thế nào? Preflight khi nào xảy ra?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** CORS là cơ chế **của trình duyệt** cho phép server nói "tôi cho phép origin này
đọc response của tôi". Preflight (`OPTIONS`) xảy ra khi request không thuộc nhóm "đơn giản" — ví dụ
`Content-Type: application/json` hoặc có header tuỳ chỉnh.

**Giải thích sâu:** Đo thật với trang ở `localhost:4001` gọi API ở `localhost:4000`:

```
=== A. GET đơn giản ===              -> 200
=== B. POST + Content-Type: json ===  -> 200
=== C. POST tới endpoint không khai báo Allow-Headers === -> LỖI: Failed to fetch

Server nhận được những request nào:
┌───────────┬───────────┬─────────────────────────┬────────┬────────────────────────┐
│ method    │ url       │ origin                  │ acrm   │ acrh                   │
├───────────┼───────────┼─────────────────────────┼────────┼────────────────────────┤
│ 'GET'     │ '/simple' │ 'http://localhost:4001' │ '-'    │ '-'                    │
│ 'OPTIONS' │ '/full'   │ 'http://localhost:4001' │ 'POST' │ 'content-type,x-token' │
│ 'POST'    │ '/full'   │ 'http://localhost:4001' │ '-'    │ '-'                    │
│ 'OPTIONS' │ '/simple' │ 'http://localhost:4001' │ 'POST' │ 'content-type'         │
└───────────┴───────────┴─────────────────────────┴────────┴────────────────────────┘
```

Ba điều bảng này chứng minh:

1. **GET đơn giản: 1 request.** Không có preflight.
2. **POST kèm JSON: 2 request.** `OPTIONS` trước để hỏi phép, rồi mới `POST` thật. Đây là lý do một
   API tưởng chừng nhanh lại tốn gấp đôi số vòng mạng — đáng lưu ý trên mạng di động.
3. **Trường hợp C: server chỉ nhận `OPTIONS`, không hề nhận `POST`.** Preflight thất bại nên trình
   duyệt **không gửi** request thật. Đây là điểm quan trọng nhất: khi thấy lỗi CORS, việc "thêm log
   vào handler POST" sẽ không thấy gì — vì nó chưa bao giờ được gọi.

Request được coi là "đơn giản" khi: method là `GET`/`HEAD`/`POST`, và `Content-Type` là
`text/plain`, `application/x-www-form-urlencoded` hoặc `multipart/form-data`, và không có header tuỳ
chỉnh.

Hai hiểu nhầm cần đính chính, và người phỏng vấn rất thích nghe:

- **CORS không bảo vệ server.** `curl` và Postman bỏ qua nó hoàn toàn. Nó chỉ ngăn **JavaScript trong
  trình duyệt** đọc response. Bảo vệ server là việc của xác thực và phân quyền.
- **Request vẫn tới server dù bị chặn** (với request đơn giản). Nếu endpoint đó có tác dụng phụ, tác
  dụng phụ **vẫn xảy ra** — trình duyệt chỉ giấu response đi.

Giảm chi phí preflight: đặt `Access-Control-Max-Age: 86400` để trình duyệt nhớ kết quả preflight và
không hỏi lại trong 24 giờ.

</details>

### 9. HTTP caching: `Cache-Control`, `ETag`, `Last-Modified` phối hợp thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `Cache-Control` quyết định **có cần hỏi server không**. `ETag`/`Last-Modified`
dùng khi đã hỏi, để server trả `304 Not Modified` thay vì gửi lại nội dung.

**Giải thích sâu:** Hai chế độ khác hẳn nhau:

```
Cache-Control: max-age=31536000, immutable
   -> trình duyệt KHÔNG gửi request nào cả. 0 byte, 0 ms.

Cache-Control: no-cache
   -> LUÔN hỏi server, nhưng kèm If-None-Match: "abc"
   -> server trả 304 (không có body) nếu chưa đổi -> vẫn tốn một vòng mạng
```

`no-cache` là tên gây hiểu nhầm nhất trong HTTP: nó **không** có nghĩa "đừng cache". Nó có nghĩa
"cache đi, nhưng phải xác thực lại trước khi dùng". Muốn thật sự không lưu thì dùng `no-store`.

Chiến lược chuẩn cho một SPA:

```
index.html          Cache-Control: no-cache
                    -> luôn kiểm tra, để bản deploy mới có hiệu lực ngay

app.9f2c1a.js       Cache-Control: max-age=31536000, immutable
                    -> hash trong tên file: nội dung đổi thì tên đổi -> không cần vô hiệu hoá

/api/*              Cache-Control: private, no-store
                    -> dữ liệu người dùng, không được để CDN hay proxy giữ lại
```

Cụm `private, no-store` cho API là chi tiết bảo mật quan trọng: thiếu nó, một CDN hoặc proxy công ty
có thể cache response chứa dữ liệu cá nhân và phục vụ cho người khác — xem
[backend/07 tình huống 6](../backend/07-tinh-huong-su-co.md).

Còn `stale-while-revalidate=60`: trả bản cũ ngay cho người dùng **và** làm mới ở nền. Người dùng
không phải chờ, và lần sau đã có bản mới. Rất hợp cho dữ liệu ít thay đổi mà lại được đọc nhiều.

</details>

### 10. HTTP/2 và HTTP/3 giải quyết vấn đề gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** HTTP/2 cho phép nhiều request đi song song trên **một** kết nối TCP (multiplexing),
xoá bỏ giới hạn ~6 kết nối của HTTP/1.1. HTTP/3 chuyển sang QUIC trên UDP để xoá nốt hiện tượng
head-of-line blocking ở tầng TCP.

**Giải thích sâu:** Head-of-line blocking ở hai tầng khác nhau — đây là chỗ hay bị lẫn:

```
HTTP/1.1  1 request/kết nối, tối đa ~6 kết nối/domain
          -> request thứ 7 phải CHỜ. Đây là HOL ở tầng ỨNG DỤNG.
HTTP/2    nhiều stream trên 1 kết nối TCP
          -> nhưng MẤT 1 GÓI TIN là cả kết nối phải chờ truyền lại. HOL ở tầng TCP.
HTTP/3    QUIC trên UDP, mỗi stream độc lập
          -> mất gói chỉ ảnh hưởng stream đó.
```

HTTP/3 tạo khác biệt lớn nhất trên **mạng chập chờn** (di động, wifi đông người) — đúng nơi người
dùng đã khổ nhất. Trên mạng tốt trong phòng lab, chênh lệch không đáng kể, và đó là lý do nhiều
người thử rồi kết luận "không thấy khác gì".

Hệ quả thực tế cho cách bạn viết frontend: **các thủ thuật của thời HTTP/1.1 giờ đã phản tác dụng.**

| Thủ thuật cũ | Với HTTP/2+ |
|---|---|
| Gộp tất cả JS thành một file | **có hại** — sửa một dòng là người dùng tải lại toàn bộ |
| Sprite sheet cho icon | không cần, dùng SVG riêng |
| Chia tài nguyên ra nhiều domain (domain sharding) | **có hại** — mỗi domain là một kết nối + một lần bắt tay TLS |
| Nhúng ảnh dạng base64 vào CSS | có hại — không cache riêng được, và base64 phình 33% |

Chia nhỏ bundle hợp lý giờ là **lợi thế**: sửa một trang chỉ làm mất hiệu lực cache của chunk trang
đó, phần còn lại người dùng vẫn dùng bản đã cache.

</details>

### 11. XSS ở phía frontend — trách nhiệm của bạn là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không bao giờ đưa dữ liệu chưa xử lý vào HTML. Trong React nghĩa là tránh
`dangerouslySetInnerHTML`; nếu buộc phải dùng thì sanitize bằng thư viện đã được kiểm nghiệm.

**Giải thích sâu:** React **tự escape** nội dung trong JSX, nên `{userInput}` an toàn. Nhưng có
những chỗ nó không bảo vệ:

```jsx
<div dangerouslySetInnerHTML={{__html: noiDung}} />      // XSS trực tiếp
<a href={urlNguoiDung}>link</a>                          // javascript:alert(1)
<div style={styleNguoiDung} />                           // ít nguy hiểm hơn nhưng vẫn có rủi ro
element.innerHTML = noiDung                              // thao tác DOM trực tiếp
eval(dataTuServer) / new Function(...)                   // không bao giờ
```

Trường hợp thứ hai hay bị bỏ sót: `href="javascript:alert(1)"` chạy được. Phải kiểm tra scheme:

```js
const an_toan = (u) => { try { return ['http:','https:','mailto:'].includes(new URL(u, location.origin).protocol) } catch { return false } };
```

Với nội dung HTML thật sự cần hiển thị (bài viết từ trình soạn thảo rich text): **DOMPurify**, và
sanitize ở **cả hai phía** — server để lưu sạch, client để phòng dữ liệu cũ đã bẩn từ trước.

Điểm cộng: nhắc tới **Trusted Types** — cơ chế của trình duyệt cấm gán chuỗi thô vào các "sink" nguy
hiểm (`innerHTML`, `eval`) ở cấp nền tảng:

```
Content-Security-Policy: require-trusted-types-for 'script'
```

Nó biến XSS từ "lỗi có thể lọt qua review" thành "lỗi trình duyệt chặn". Hiện chỉ Chromium hỗ trợ,
nhưng biết tới nó là dấu hiệu cập nhật tốt.

</details>

### 12. Service worker dùng để làm gì và nguy hiểm ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó là một proxy chạy giữa trang và mạng — dùng cho hoạt động offline, cache có
kiểm soát, đồng bộ nền, thông báo đẩy. Nguy hiểm vì nó **sống lâu hơn trang** và có thể phục vụ nội
dung cũ vô thời hạn nếu triển khai sai.

**Giải thích sâu:** Vòng đời là phần khó nhất và cũng là nguồn của mọi bug:

```
install   -> activate -> chạy
   ↑ service worker MỚI ở trạng thái "waiting" cho tới khi
     MỌI tab đang mở của trang đó bị đóng
```

Hệ quả rất thật: người dùng mở trang trong một tab suốt cả tuần → họ **không bao giờ** nhận được
bản cập nhật, kể cả khi tải lại trang (F5 không đóng tab). Đây là lý do "tôi đã deploy rồi mà khách
vẫn thấy bản cũ".

Cách xử lý: phát hiện có bản mới rồi **hỏi người dùng**:

```js
reg.addEventListener('updatefound', () => {
  const sw = reg.installing;
  sw.addEventListener('statechange', () => {
    if (sw.state === 'installed' && navigator.serviceWorker.controller) {
      hienThanhThongBao('Đã có phiên bản mới', () => { sw.postMessage('SKIP_WAITING'); location.reload() });
    }
  });
});
```

`skipWaiting()` vô điều kiện thì đơn giản hơn nhưng có rủi ro: trang đang chạy đột ngột bị phục vụ
bởi service worker mới, trong khi các chunk JS lười tải mà nó cần có thể đã bị xoá khỏi cache → lỗi
`ChunkLoadError` giữa chừng.

Điều nguy hiểm nhất phải nói ra: **một service worker cache nhầm `index.html` vĩnh viễn là sự cố rất
khó cứu** — bạn không deploy được bản sửa vì chính bản cũ đang chặn. Vì vậy phải luôn có **kill
switch**: một service worker tối giản chỉ làm `self.registration.unregister()` để deploy trong tình
huống khẩn cấp.

</details>

### 13. `localhost:3000` gọi `api.com` — những gì có thể sai?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** CORS (câu 8), cookie không được gửi kèm nếu thiếu `credentials`, cookie bị chặn vì
`SameSite`, và cookie không đặt được nếu thiếu `Secure` trên HTTPS.

**Giải thích sâu:** Đây là câu hỏi thực tế thường được hỏi vì ai cũng từng vật lộn với nó. Danh sách
kiểm tra theo thứ tự:

```
1. fetch không tự gửi cookie xuyên origin
   -> fetch(url, { credentials: 'include' })

2. Server phải khai báo CHÍNH XÁC origin, không được dùng *
   -> Access-Control-Allow-Origin: http://localhost:3000     (KHÔNG phải *)
      Access-Control-Allow-Credentials: true
   -> dùng '*' cùng với credentials là bị trình duyệt từ chối, đây là lỗi phổ biến nhất

3. Cookie xuyên site cần
   -> Set-Cookie: token=x; SameSite=None; Secure; HttpOnly
   -> SameSite=None BẮT BUỘC đi kèm Secure -> localhost phải chạy HTTPS,
      hoặc dùng proxy để cùng origin

4. Chrome đang siết dần cookie bên thứ ba
   -> giải pháp bền: đặt API và web CÙNG site (api.example.com và app.example.com),
      rồi dùng SameSite=Lax với Domain=.example.com
```

Cách làm thực dụng nhất cho môi trường dev, và nên nói ra vì nó xoá bỏ cả lớp vấn đề: **proxy trong
dev server**. Vite/Next đều hỗ trợ — trang gọi `/api/...` cùng origin, dev server chuyển tiếp sang
backend. Không CORS, không cookie xuyên site, và môi trường dev giống production hơn (vì production
thường cũng đứng sau một reverse proxy).

</details>

### 14. Tối ưu font chữ như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Preload font quan trọng, dùng `font-display` phù hợp, ưu tiên `woff2`, chỉ tải các
subset ký tự cần dùng, và dùng `size-adjust` để font dự phòng có kích thước tương đương — tránh nhảy
layout.

**Giải thích sâu:** Font là nguồn gây CLS và LCP chậm bị đánh giá thấp, đặc biệt với tiếng Việt vì
bộ ký tự có dấu làm file lớn hơn nhiều.

```css
@font-face {
  font-family: 'Inter';
  src: url('/f/inter.woff2') format('woff2');
  font-display: swap;              /* hiện font dự phòng ngay, đổi khi font thật tải xong */
  unicode-range: U+0000-00FF, U+0102-0103, U+0110-0111, U+1EA0-1EF9;  /* Latin + tiếng Việt */
  size-adjust: 107%;               /* chỉnh để font dự phòng có kích thước gần bằng */
}
```

```html
<link rel="preload" href="/f/inter.woff2" as="font" type="font/woff2" crossorigin>
```

Chọn `font-display` — mỗi giá trị là một đánh đổi khác nhau:

| Giá trị | Hành vi | Hợp với |
|---|---|---|
| `swap` | hiện font dự phòng ngay, đổi sau | nội dung — chữ đọc được ngay |
| `optional` | dùng font thật chỉ khi nó tải rất nhanh | **tốt nhất cho CLS** — không bao giờ nhảy |
| `block` | ẩn chữ tối đa 3s | logo, tiêu đề thương hiệu |
| `fallback` | trung gian | ít dùng |

Thuộc tính `crossorigin` trên thẻ preload font là **bắt buộc** kể cả với font cùng origin — thiếu nó
thì font bị tải **hai lần**. Đây là lỗi nhỏ nhưng rất phổ biến, và nói ra nó chứng tỏ bạn đã thật sự
làm việc này.

`size-adjust` cùng với `ascent-override` là kỹ thuật mới nhất để CLS thật sự bằng 0 với `swap`: chỉnh
font dự phòng khớp kích thước font thật, nên lúc hoán đổi không có gì dịch chuyển.

</details>

### 15. Tối ưu ảnh — những gì cần làm?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Định dạng hiện đại (AVIF/WebP), kích thước đúng theo thiết bị (`srcset`), lazy load
ảnh dưới màn hình, **không** lazy load ảnh LCP, và luôn khai báo kích thước để tránh CLS.

**Giải thích sâu:** Bộ đầy đủ:

```html
<img src="anh-800.jpg"
     srcset="anh-400.avif 400w, anh-800.avif 800w, anh-1600.avif 1600w"
     sizes="(max-width: 600px) 100vw, 800px"
     width="800" height="600"
     loading="lazy" decoding="async" alt="Mô tả thật">
```

Từng thuộc tính giải một vấn đề:
- `srcset` + `sizes`: điện thoại không tải ảnh 1600px. Đây thường là khoản tiết kiệm băng thông lớn
  nhất trên toàn trang.
- `width`/`height`: giữ chỗ → CLS = 0 (đã đo ở câu 7: 0.0117 → 0.0000).
- `loading="lazy"`: không tải ảnh ngoài khung nhìn.
- `decoding="async"`: giải mã ảnh không chặn luồng chính.

Ba sai lầm hay gặp:

1. **Lazy load ảnh LCP.** Ảnh lớn đầu trang là phần tử LCP; đặt `loading="lazy"` cho nó làm LCP tệ
   đi rõ rệt vì trình duyệt hoãn tải. Ảnh đầu trang phải dùng `fetchpriority="high"` và **preload**.
2. **Dùng CSS để thu nhỏ ảnh lớn.** `width: 200px` trên ảnh 2000px: người dùng vẫn tải đủ byte của
   ảnh 2000px.
3. **Quên `alt`.** Vấn đề tiếp cận, và cũng là SEO.

Về định dạng: AVIF nhỏ hơn WebP khoảng 20–30% ở cùng chất lượng, nhưng mã hoá chậm hơn. Dùng
`<picture>` để xuống thang dần:

```html
<picture>
  <source srcset="a.avif" type="image/avif">
  <source srcset="a.webp" type="image/webp">
  <img src="a.jpg" width="800" height="600" alt="...">
</picture>
```

</details>

### 16. Trang chậm trên điện thoại nhưng nhanh trên máy bạn — làm sao tìm ra?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vì máy dev nhanh gấp nhiều lần điện thoại phổ thông và mạng thì gần như hoàn hảo.
Phải đo với **giới hạn CPU và mạng**, và tốt nhất là đo bằng dữ liệu người dùng thật (RUM).

**Giải thích sâu:** Khoảng cách rất lớn: một máy tính dev có CPU nhanh hơn điện thoại tầm trung
khoảng 5–10 lần cho công việc đơn luồng. JavaScript là đơn luồng, nên khoảng cách đó chuyển thẳng
thành thời gian người dùng phải chờ.

Cách tái hiện điều kiện thật:

```
DevTools > Performance > Bánh răng:
   CPU: 4x hoặc 6x slowdown         (6x xấp xỉ điện thoại phổ thông)
   Network: Slow 4G
DevTools > Lighthouse: chọn Mobile
```

Nhưng phòng lab chỉ nói được một nửa. Phải có **RUM** — đo từ người dùng thật:

```js
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(m => gui({ ten: m.name, gia_tri: m.value, route: location.pathname }));
```

Nhìn **p75** như Google, không nhìn trung bình. Và tách theo: loại thiết bị, quốc gia, loại mạng.
Rất thường xuyên, "trang chậm" thật ra là "trang chậm với người dùng Android tầm trung ở tỉnh" —
một nhóm hoàn toàn vô hình trong dữ liệu tổng hợp.

Những gì thường khác biệt nhất giữa máy dev và điện thoại thật:

| | Máy dev | Điện thoại phổ thông |
|---|---|---|
| Chạy JS | nhanh | chậm 5–10 lần |
| Bộ nhớ | dư dả | giới hạn, tab dễ bị đóng |
| Mạng | ổn định, độ trễ thấp | RTT 100–300 ms, chập chờn |
| Cache | đã nóng sau nhiều lần thử | thường là lần đầu |
| Màn hình | rộng, ít nội dung phải xuống dòng | hẹp, nhiều layout hơn |

Câu chốt ăn điểm: **"Em không tin dữ liệu phòng lab để quyết định. Lighthouse dùng để tìm nguyên
nhân, còn để biết có vấn đề hay không thì em nhìn p75 của người dùng thật, tách theo loại thiết bị."**

</details>

---

Tiếp: [03-react-va-quan-ly-state.md](./03-react-va-quan-ly-state.md)
