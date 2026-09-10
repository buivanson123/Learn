# Kiến trúc, testing và tình huống — 14 câu

Nhóm cuối này ít code nhất nhưng phân biệt mạnh nhất. Nó hỏi những thứ chỉ người **chịu trách nhiệm
cho một codebase trong nhiều năm** mới có câu trả lời cụ thể.

---

## Phần 1 — Kiến trúc (câu 1–6)

### 1. Bạn tổ chức thư mục một dự án frontend lớn thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Theo **tính năng**, không theo loại file. `features/checkout/` chứa component,
hook, API, type của checkout — thay vì rải chúng vào `components/`, `hooks/`, `services/`.

**Giải thích sâu:** Vì sao chia theo loại file hỏng khi dự án lớn:

```
components/   200 file, không biết cái nào thuộc màn hình nào
hooks/         80 file
services/      40 file
utils/        150 file, một nửa không ai dùng nhưng không ai dám xoá
```

Sửa một tính năng phải mở 6 thư mục. Xoá một tính năng thì không biết cái gì xoá được. Và không có
ranh giới nào ngăn `components/Checkout` gọi thẳng vào `components/Admin`.

Chia theo tính năng:

```
src/
  features/
    checkout/
      components/  hooks/  api/  types.ts  index.ts   ← chỉ index.ts được export ra ngoài
    catalog/
    auth/
  shared/          ← chỉ những thứ THẬT SỰ dùng chung: Button, useDebounce, cn()
  app/             ← router, provider, layout
```

Ba luật đi kèm quan trọng hơn cả cấu trúc:

1. **Feature không import trực tiếp file bên trong feature khác** — chỉ qua `index.ts`. Ép được bằng
   ESLint (`eslint-plugin-boundaries`) chứ đừng dựa vào kỷ luật.
2. **`shared` chỉ chứa thứ đã dùng ở ít nhất 3 nơi.** Không thì nó thành bãi rác trong 6 tháng.
3. **Phụ thuộc đi một chiều**: `app` → `features` → `shared`. Không bao giờ ngược lại.

Lợi ích lớn nhất, đáng nói ra: **xoá một tính năng là xoá một thư mục**. Trong một codebase sống
nhiều năm, khả năng xoá được code quan trọng ngang khả năng thêm code.

</details>

### 2. Design system — xây thế nào cho đội dùng thật?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bắt đầu từ token (màu, khoảng cách, cỡ chữ), rồi tới component nguyên thuỷ. Thành
bại nằm ở **quy trình và tài liệu**, không nằm ở code — một design system không ai dùng là một dự án
thất bại dù code có đẹp tới đâu.

**Giải thích sâu:** Ba tầng:

```
1. Token       --color-primary, --space-4, --radius-md   (nguồn sự thật, đồng bộ với Figma)
2. Nguyên thuỷ Button, Input, Select — không chứa nghiệp vụ
3. Ghép        UserCard, CheckoutForm — thuộc về feature, KHÔNG thuộc design system
```

Ranh giới giữa tầng 2 và 3 là chỗ hay hỏng: một khi `Button` bắt đầu có prop `variant="checkout"`
thì design system đã bắt đầu chết.

Những gì làm design system thất bại trong thực tế:

| Vấn đề | Cách chống |
|---|---|
| Không ai biết có component gì | Storybook, tìm kiếm được, có ví dụ dùng |
| Thiếu một biến thể → người ta tự viết | có quy trình đóng góp rõ ràng, phản hồi nhanh |
| Thay đổi phá vỡ ở phiên bản mới | versioning, changelog, codemod đi kèm |
| Không tuỳ biến được → bị bỏ qua | cho phép truyền `className`, dùng `asChild` |
| Khó tiếp cận (accessibility) | dựng trên Radix/React Aria thay vì tự viết từ đầu |

Dòng cuối đáng nhấn mạnh: tự viết `Select`, `Dialog`, `Combobox` đúng chuẩn tiếp cận (bẫy focus,
điều hướng bàn phím, `aria-*`, khôi phục focus) là công việc hàng tháng và rất dễ sai. Dùng thư viện
headless rồi tự tạo kiểu là lựa chọn đúng gần như mọi lúc.

Câu ăn điểm: **"Chỉ số thành công của design system không phải số component, mà là **tỷ lệ giao diện
được dựng từ nó**. Em sẽ đo bằng cách đếm số chỗ dùng màu hardcode thay vì token."**

</details>

### 3. Micro-frontend — khi nào đáng, khi nào không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đáng khi nhiều đội độc lập cần deploy độc lập, hoặc khi phải tích hợp ứng dụng
viết bằng framework khác nhau. Không đáng cho một đội — chi phí vận hành lớn hơn lợi ích rất nhiều.

**Giải thích sâu:** Chi phí thật, phải kể ra đủ:

```
- Trùng lặp phụ thuộc: mỗi micro-frontend mang React của riêng nó
  -> chia sẻ được nhưng phải khớp phiên bản, và đó là ràng buộc rất chặt
- Style xung đột: CSS toàn cục của app A đè lên app B
- Trạng thái dùng chung (user đăng nhập, giỏ hàng) phải có cơ chế riêng
- Router lồng nhau, deep link phức tạp
- Debug xuyên nhiều ứng dụng khó hơn hẳn
- Trải nghiệm không nhất quán nếu design system không được thực thi chặt
```

Lý do **đúng** để dùng:
- 5 đội, mỗi đội sở hữu một phần sản phẩm rõ ràng, cần release theo nhịp riêng.
- Đang chuyển dần từ Angular sang React và cần hai thứ chạy song song trong nhiều tháng.
- Một phần được nhúng vào sản phẩm của bên khác.

Lý do **sai**: "để code sạch hơn", "để tách biệt quan tâm", "vì công ty lớn cũng làm". Những mục
tiêu đó đạt được bằng cấu trúc module tốt trong một repo, với chi phí gần bằng 0.

Phương án trung gian nên nhắc và thường là câu trả lời đúng: **monorepo với ranh giới rõ**
(Nx, Turborepo) — nhiều package, một lần deploy, ranh giới được ép bằng lint và bằng cấu hình build.
Được phần lớn lợi ích của micro-frontend mà không phải trả cái giá lúc chạy.

</details>

### 4. Monorepo hay nhiều repo?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Monorepo khi các phần thay đổi cùng nhau và dùng chung code. Nhiều repo khi các
phần thật sự độc lập, có vòng đời riêng, hoặc thuộc các tổ chức khác nhau.

**Giải thích sâu:**

| | Monorepo | Nhiều repo |
|---|---|---|
| Thay đổi xuyên nhiều package | **một PR** | nhiều PR, phải phối hợp thứ tự |
| Chia sẻ code | import trực tiếp | publish package, cập nhật phiên bản |
| CI | phức tạp — cần build theo phần thay đổi | đơn giản |
| Phân quyền | khó chia nhỏ | tự nhiên |
| Công cụ | cần Nx/Turborepo mới chịu được quy mô | công cụ mặc định là đủ |

Điểm quyết định thường bị bỏ qua: **thay đổi xuyên package**. Đổi một API giữa frontend và một
package dùng chung, trong monorepo là một PR duy nhất chạy test cho cả hai. Với nhiều repo, đó là
PR ở repo A → publish phiên bản mới → PR ở repo B — và trong khoảng giữa, main của repo B đang hỏng
hoặc đang dùng bản cũ.

Cái giá thật của monorepo là **CI**. Không có caching và "chỉ chạy phần bị ảnh hưởng", mỗi PR sẽ
build lại mọi thứ và thời gian CI tăng tới mức không chịu nổi. Đó chính là việc mà Nx/Turborepo làm,
và cũng là lý do monorepo cần đầu tư hạ tầng ngay từ đầu.

Câu trả lời cân bằng: **"Em bắt đầu bằng monorepo nếu các phần thay đổi cùng nhau, vì tách ra sau
dễ hơn gộp vào sau. Nhưng em sẽ đầu tư vào caching CI ngay từ đầu, vì đó là chỗ monorepo sụp đổ."**

</details>

### 5. Xử lý đa ngôn ngữ (i18n) thế nào cho đúng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Tách chuỗi ra file riêng, dùng khoá có ngữ nghĩa, xử lý số nhiều và định dạng bằng
`Intl`, tải theo từng ngôn ngữ (không gộp hết), và không bao giờ ghép câu bằng cách nối chuỗi.

**Giải thích sâu:** Lỗi kinh điển — nối chuỗi:

```jsx
// SAI: trật tự từ khác nhau giữa các ngôn ngữ
<span>{t('ban_co')} {n} {t('tin_nhan')}</span>

// ĐÚNG: cả câu là một khoá, có tham số
t('tin_nhan_chua_doc', { count: n })
// vi: "Bạn có {count} tin nhắn chưa đọc"
// en: "You have {count} unread message(s)"
```

Số nhiều không phải chuyện thêm chữ "s". Tiếng Ả Rập có 6 dạng số nhiều, tiếng Nga có 3, tiếng Việt
không có dạng nào. Dùng `Intl.PluralRules` hoặc định dạng ICU MessageFormat thay vì tự viết `if`.

Định dạng phải để `Intl` lo — không tự viết:

```js
new Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'}).format(1234567)  // "1.234.567 ₫"
new Intl.DateTimeFormat('vi-VN', {dateStyle:'long'}).format(new Date())
new Intl.RelativeTimeFormat('vi').format(-3, 'day')                                 // "3 ngày trước"
```

Về hiệu năng: **chỉ tải ngôn ngữ đang dùng.** Gộp 10 ngôn ngữ vào bundle là lãng phí 90%. Dùng
`import()` động theo locale.

Ba thứ hay bị bỏ sót:
- **Chuỗi trong thông báo lỗi từ server** cũng cần dịch — thường bằng cách server trả mã lỗi và
  client tra bảng dịch. Đây là lý do API nên trả `code` ổn định
  ([backend/04 câu 3](../backend/04-thiet-ke-api.md)).
- **Chiều viết RTL** (tiếng Ả Rập, Do Thái): dùng thuộc tính logic của CSS (`margin-inline-start`)
  thay vì `margin-left` thì hỗ trợ RTL gần như miễn phí.
- **Độ dài chuỗi khác nhau**: tiếng Đức dài hơn tiếng Việt đáng kể, giao diện phải chịu được chữ
  tràn.

</details>

### 6. Khả năng tiếp cận (accessibility) — làm những gì tối thiểu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Dùng HTML ngữ nghĩa, bảo đảm mọi thứ dùng được bằng bàn phím, có nhãn cho mọi
input, giữ độ tương phản đủ, và quản lý focus khi nội dung thay đổi. Phần lớn là **miễn phí nếu
dùng đúng thẻ**.

**Giải thích sâu:** Việc có giá trị nhất trên mỗi giờ bỏ ra:

```html
<!-- 1. Dùng đúng thẻ. Cái này giải quyết 80% vấn đề -->
<button onclick=...>       <!-- không phải <div onclick> -->
<a href="/x">              <!-- không phải <div onclick={navigate}> -->
<nav> <main> <h1>-<h6>     <!-- không phải toàn <div> -->

<!-- 2. Nhãn cho input -->
<label for="email">Email</label><input id="email">

<!-- 3. Ảnh có alt; ảnh trang trí thì alt="" -->
```

Vì sao `<div onclick>` sai dù nó "chạy được": không nhận focus bằng Tab, không kích hoạt được bằng
Enter/Space, screen reader không đọc là nút, và không hiện trong danh sách điều khiển. Sửa hết bằng
tay cần `tabindex`, `role`, xử lý bàn phím — hoặc chỉ cần dùng `<button>`.

Quản lý focus là phần khó nhất và cũng là phần hay bị bỏ:

```
Mở modal   -> focus vào modal, BẪY focus bên trong, Esc để đóng
Đóng modal -> trả focus về nút đã mở nó
Điều hướng SPA -> thông báo trang mới và đưa focus về đầu nội dung
                  (screen reader không tự biết vì trang không tải lại)
Xoá một dòng -> focus về dòng kế tiếp, đừng để focus rơi vào body
```

Mục thứ ba đặc biệt hay bị quên trong SPA và làm ứng dụng gần như không dùng được bằng screen reader.

Cách kiểm tra thực dụng, theo thứ tự chi phí:
1. **Rút chuột ra, dùng Tab đi hết một luồng.** Nhanh, miễn phí, bắt được rất nhiều lỗi.
2. `axe DevTools` hoặc Lighthouse — bắt được lỗi tự động phát hiện được (khoảng 30–40%).
3. Test bằng screen reader thật (VoiceOver trên macOS, NVDA trên Windows).

Và điểm nên nói ra ở phỏng vấn: **accessibility trùng lặp rất nhiều với chất lượng chung** — HTML
ngữ nghĩa cũng tốt cho SEO, cũng làm test dễ viết hơn (`getByRole` ở
[03-react câu 14](./03-react-va-quan-ly-state.md)), và cũng làm code dễ đọc hơn.

</details>

---

## Phần 2 — Testing và quy trình (câu 7–10)

### 7. Bạn phân bổ test như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nhiều test tích hợp ở tầng component (render thật, mock ở tầng mạng), ít unit test
cho logic thuần, và một số ít E2E cho các luồng quan trọng nhất. "Kim tự tháp" cổ điển không hợp
lắm với frontend — hình dạng thực tế giống **cái cúp** hơn.

**Giải thích sâu:** Vì sao unit test frontend có tỷ lệ giá trị/chi phí thấp: phần lớn lỗi frontend
không nằm trong một hàm mà nằm ở **chỗ ghép nối** — component không truyền đúng prop, state không
được cập nhật, request không được gọi. Unit test một component bằng cách mock hết mọi con của nó
thường chỉ kiểm tra lại đúng cái mock.

```
     ╱ E2E ╲            ít — chỉ luồng quan trọng: đăng nhập, thanh toán
   ╱  Tích  ╲           NHIỀU NHẤT — render thật, mock ở tầng HTTP (msw)
  ╱   hợp    ╲
  ╲  Unit    ╱          logic thuần: hàm tính toán, format, reducer
    ╲ Tĩnh  ╱           TypeScript + ESLint — rẻ nhất, bắt lỗi nhiều nhất
```

Tầng đáy đáng nhấn mạnh: **TypeScript bắt được một lớp lỗi lớn mà không cần viết test nào.** Đổi
tên một field trong API type là mọi chỗ dùng sai đều đỏ lên ngay.

Về E2E: đắt (chậm, hay lỗi vặt, khó bảo trì) nên chỉ dành cho luồng mà **hỏng là mất tiền**. 20 test
E2E ổn định có giá trị hơn 200 test hay đỏ ngẫu nhiên — vì test hay đỏ ngẫu nhiên sẽ khiến cả đội
học được thói quen bấm "chạy lại", và rồi họ bấm "chạy lại" cả khi test đỏ thật.

Về độ phủ (coverage): nó là **chỉ báo, không phải mục tiêu**. Ép 100% coverage tạo ra test vô nghĩa
cho getter/setter. Hữu ích hơn là nhìn coverage của **code mới thêm** trong mỗi PR.

</details>

### 8. Test bị "flaky" (đỏ ngẫu nhiên) — xử lý thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Coi nó là bug, không phải phiền toái. Nguyên nhân gần như luôn là **chờ theo thời
gian thay vì chờ theo điều kiện**, hoặc test phụ thuộc lẫn nhau qua trạng thái dùng chung.

**Giải thích sâu:** Nguyên nhân theo tần suất:

```js
// 1. Chờ cứng theo thời gian — chậm máy CI là đỏ
await sleep(1000);
// -> await screen.findByText('Đã lưu')      (chờ tới khi điều kiện đúng)

// 2. Trạng thái rò rỉ giữa các test
// localStorage, cookie, module đã mock, dữ liệu DB, thời gian giả
// -> reset trong beforeEach, và test phải chạy được theo THỨ TỰ BẤT KỲ

// 3. Phụ thuộc thời gian thật
new Date()          // test chạy lúc 23:59:59 sẽ đỏ
// -> dùng thời gian giả (vi.useFakeTimers)

// 4. Test chạy song song đụng cùng tài nguyên
// -> mỗi test một bộ dữ liệu riêng, tiền tố riêng
```

Quy trình xử lý nên nói ra:

```
1. Đánh dấu và ĐO — ghi lại test nào đỏ bao nhiêu lần trên tổng số lần chạy
2. Cách ly ngay (skip) nếu nó đang chặn cả đội — nhưng phải TẠO ISSUE, có hạn xử lý
3. Sửa nguyên nhân gốc
4. KHÔNG dùng auto-retry như giải pháp lâu dài
```

Bước 4 quan trọng: retry tự động che mất tín hiệu. Một test flaky đôi khi đang chỉ ra một **race
condition có thật trong sản phẩm** — chính là loại bug sẽ xuất hiện với người dùng ở mạng chậm. Retry
đi là bạn vừa vứt bỏ một cảnh báo thật.

Con số đáng nhắc: nếu tỷ lệ đỏ ngẫu nhiên vượt vài phần trăm, cả đội sẽ ngừng tin vào CI — và lúc
đó bộ test không còn giá trị gì nữa dù nó có bao nhiêu test.

</details>

### 9. Code review — bạn nhìn gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đúng đắn và các trường hợp biên trước, rồi tới khả năng bảo trì, rồi mới tới phong
cách — và phong cách thì để công cụ tự động lo. Với người ít kinh nghiệm hơn, review cũng là dạy.

**Giải thích sâu:** Thứ tự ưu tiên:

```
1. Nó có đúng không? Trường hợp biên: mảng rỗng, null, lỗi mạng, người dùng bấm hai lần
2. Có lỗ hổng bảo mật không? dangerouslySetInnerHTML, dữ liệu nhạy cảm lộ ra client
3. Có phá vỡ cái gì không? thay đổi API, thay đổi hành vi component dùng chung
4. Sáu tháng nữa người khác đọc có hiểu không?
5. Có test cho phần logic mới không?
6. Phong cách  -> Prettier + ESLint tự lo, đừng bình luận tay
```

Cách viết bình luận — chi tiết này rất được đánh giá cao ở vị trí senior:

```
❌ "Chỗ này sai."
✅ "Nếu `items` rỗng thì dòng 42 sẽ đọc `items[0].id` và ném lỗi. Mình nghĩ nên
    thêm early return, hoặc dùng optional chaining. Bạn thấy sao?"

Phân loại rõ mức độ:
  [chặn]     phải sửa trước khi merge
  [đề xuất]  nên cân nhắc, không chặn
  [thắc mắc] mình chưa hiểu, giải thích giúp
  [khen]     cách viết này hay, mình sẽ dùng lại
```

Nhãn `[thắc mắc]` rất hiệu quả: nó tránh việc bạn khẳng định sai khi chưa nắm đủ ngữ cảnh, mà vẫn
nêu được vấn đề.

Điều nên nói về văn hoá: **review là về code, không về người**. "Hàm này khó theo dõi" khác hẳn "bạn
viết khó hiểu quá". Và nếu một cuộc thảo luận kéo dài quá ba lượt qua lại, hãy gọi nhau nói chuyện
trực tiếp — văn bản làm mọi bất đồng nghe gay gắt hơn thực tế.

Cuối cùng: **review nhanh quan trọng hơn review kỹ.** Một PR nằm chờ hai ngày làm chậm cả đội và
khiến PR sau phình to hơn để "tiện thể". Đặt mục tiêu phản hồi trong vài giờ.

</details>

### 10. Bạn xử lý nợ kỹ thuật thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ghi lại và ưu tiên nó như mọi công việc khác, dựa trên **chi phí nó gây ra**, và
xử lý dần theo từng phần thay vì xin một đợt "viết lại toàn bộ".

**Giải thích sâu:** Vì sao "xin 2 tháng để refactor" gần như luôn bị từ chối và cũng nên bị từ chối:
nó không có kết quả kinh doanh đo được, rủi ro cao, và trong 2 tháng đó sản phẩm đứng yên.

Cách trình bày hiệu quả — **nói bằng chi phí, không bằng tính thẩm mỹ**:

```
❌ "Code này cũ quá, cần viết lại."
✅ "Mỗi lần thêm một loại thanh toán mới, chúng ta phải sửa 7 file và mất trung bình
    3 ngày, trong đó 1 ngày là sửa lỗi phát sinh. Quý này có 4 loại mới.
    Bỏ 5 ngày tách phần này ra thì mỗi loại sau chỉ mất 0.5 ngày."
```

Chiến lược xử lý dần:

```
1. Quy tắc hướng đạo sinh: đụng vào file nào thì để nó tốt hơn một chút
2. Bao vây (strangler fig): code mới viết theo cách mới, code cũ chuyển dần khi có dịp
3. Dành hạn mức cố định: 20% mỗi sprint, hoặc một ngày mỗi tháng
4. Gắn với tính năng: "làm tính năng X, tiện thể dọn phần Y mà nó chạm tới"
```

Cách 4 là hiệu quả nhất trong thực tế vì nó không cần xin phép riêng.

Và điều cần nói để cho thấy sự chín chắn: **không phải nợ kỹ thuật nào cũng đáng trả**. Code xấu
trong một module không ai đụng tới suốt hai năm thì để yên. Ưu tiên theo công thức:

```
Mức ưu tiên = (tần suất thay đổi) × (đau đớn mỗi lần thay đổi) × (rủi ro nếu hỏng)
```

Một file được sửa hàng tuần và mỗi lần sửa đều gây bug là ứng viên số một, dù nó trông không xấu
bằng chỗ khác.

</details>

---

## Phần 3 — Tình huống (câu 11–14)

### 11. "Trang trắng trên production, không lỗi trong log"

<details><summary>Cách tiếp cận</summary>

**Việc đầu tiên: rollback nếu vừa deploy.** Sau đó mới điều tra.

Nguyên nhân theo tần suất:

```
1. Lỗi JavaScript trong lúc render, không có error boundary
   -> Console của trình duyệt có lỗi, nhưng server log thì không.
      Đây là lý do bắt buộc phải có báo lỗi phía client (Sentry).

2. ChunkLoadError — người dùng đang mở tab cũ, bấm vào một route lazy,
   chunk cũ đã bị xoá khỏi CDN sau khi deploy
   -> bắt lỗi này và tự reload trang một lần:
      window.addEventListener('error', e => {
        if (/Loading chunk .* failed/.test(e.message) && !daThuLai()) location.reload();
      });

3. Service worker phục vụ index.html cũ trỏ tới bundle đã bị xoá
   -> xem 02-trình-duyệt câu 12; cần kill switch

4. Biến môi trường thiếu ở bản build production
   -> undefined lan vào code, gây lỗi ở nơi không ngờ

5. Hydration mismatch nghiêm trọng (SSR)
   -> React bỏ HTML server và render lại; nếu render client cũng lỗi thì trắng
```

Trường hợp 2 rất phổ biến và hay bị bỏ qua: nó chỉ xảy ra với người dùng **đã mở trang từ trước lúc
deploy**, nên không bao giờ tái hiện được trên máy dev.

**Ba việc phải có sau sự cố:**
1. Error boundary ở gốc — không bao giờ để màn hình trắng, luôn có gì đó để người dùng bấm.
2. Báo lỗi phía client về Sentry, kèm phiên bản build và route.
3. Giữ chunk cũ trên CDN thêm vài phiên bản thay vì xoá ngay khi deploy.

</details>

### 12. "Người dùng báo mất dữ liệu form khi mạng chậm"

<details><summary>Cách tiếp cận</summary>

**Câu hỏi đầu tiên:** mất ở bước nào — trước khi gửi, trong lúc gửi, hay sau khi gửi mà không lưu?

```
Trước khi gửi   -> trang bị tải lại, hoặc component bị unmount, hoặc điều hướng nhầm
Trong lúc gửi   -> request timeout, người dùng bấm lại, hoặc đóng tab
Sau khi gửi     -> server nhận nhưng lỗi im lặng, hoặc lỗi validate không hiện ra
```

Cách xử lý theo tầng:

```jsx
// 1. Lưu nháp cục bộ — rẻ nhất và hiệu quả nhất
useEffect(() => {
  const t = setTimeout(() => localStorage.setItem('draft:'+id, JSON.stringify(values)), 500);
  return () => clearTimeout(t);
}, [values]);

// 2. Cảnh báo trước khi rời trang khi còn thay đổi chưa lưu
useEffect(() => {
  const h = (e) => { if (coThayDoi) { e.preventDefault(); e.returnValue = '' } };
  window.addEventListener('beforeunload', h);
  return () => window.removeEventListener('beforeunload', h);
}, [coThayDoi]);

// 3. Trạng thái gửi rõ ràng: vô hiệu hoá nút, hiện tiến trình, KHÔNG xoá form khi lỗi
// 4. Retry với Idempotency-Key để retry không tạo bản ghi trùng
//    (xem backend/01 câu 15)
```

Mục 3 chứa một lỗi rất phổ biến: xoá form **ngay khi bấm gửi** thay vì sau khi có xác nhận thành
công. Mạng chậm hoặc lỗi là dữ liệu biến mất và người dùng phải nhập lại từ đầu.

**Điều nên nói thêm:** với form dài (đơn đăng ký, khai báo), nên **lưu nháp lên server** chứ không
chỉ localStorage — người dùng đổi máy hoặc xoá cache là mất. Và lưu nháp phải là thao tác không
validate, để dữ liệu dở dang vẫn lưu được.

</details>

### 13. "Ứng dụng chậm dần sau vài giờ sử dụng"

<details><summary>Cách tiếp cận</summary>

**Từ khoá quyết định là "dần"** — nó loại trừ hầu hết nguyên nhân và chỉ thẳng tới tích luỹ: memory
leak, hoặc listener/timer chồng chất, hoặc dữ liệu trong bộ nhớ lớn dần.

Cách xác nhận trước khi đoán:

```
1. DevTools > Performance > tick "Memory", ghi 30 giây trong lúc thao tác bình thường
   -> đường JS Heap đi lên bậc thang và không tụt sau GC = leak
2. DevTools > Memory > Heap snapshot: chụp -> thao tác 10 lần -> ép GC -> chụp lại
   -> Comparison, sắp theo Delta
3. Bộ lọc "Detached" -> DOM node đã bị xoá nhưng JS còn giữ = thủ phạm số một
```

Nguyên nhân thường gặp trong SPA (chi tiết ở
[01-javascript câu 12](./01-javascript-va-runtime.md)):

| Nguyên nhân | Dấu hiệu |
|---|---|
| Listener trên `window` không gỡ khi unmount | số listener tăng dần (`getEventListeners(window)`) |
| `setInterval` không dừng | CPU cao cả khi không thao tác |
| Đăng ký websocket/store không huỷ | cùng một tin nhắn được xử lý nhiều lần |
| Mảng log/thông báo trong state lớn dần | heap tăng đều theo thời gian sử dụng |
| Cache trong `Map` không giới hạn | tăng theo số lần người dùng thao tác |

Dấu hiệu "cùng một tin nhắn được xử lý nhiều lần" rất đặc trưng: mỗi lần vào lại màn hình lại đăng
ký thêm một listener mà không huỷ cái cũ → lần thứ 10 thì mỗi tin nhắn kích hoạt 10 lần xử lý. Nó
biểu hiện thành "chậm dần" nhưng thực chất là "làm việc gấp N lần".

**Cách phòng ngừa nên nói ra:** trong React, mỗi `useEffect` có đăng ký thì **bắt buộc** có hàm dọn
dẹp — và điều này nên là một mục cố định trong checklist review.

</details>

### 14. "Cần hỗ trợ offline" — bạn thiết kế thế nào?

<details><summary>Cách tiếp cận</summary>

**Câu hỏi đầu tiên và quan trọng nhất: offline nghĩa là gì với sản phẩm này?** Ba mức rất khác nhau
về chi phí:

```
Mức 1  Đọc offline       cache nội dung đã xem  -> service worker + Cache API, vài ngày làm
Mức 2  Ghi offline       xếp hàng thao tác, đồng bộ khi có mạng -> phức tạp hơn nhiều
Mức 3  Offline-first     làm việc hoàn toàn offline, đồng bộ hai chiều -> dự án lớn
```

Rất nhiều yêu cầu "hỗ trợ offline" thực chất chỉ cần mức 1, hoặc thậm chí chỉ cần **báo cho người
dùng biết đang mất mạng và giữ nguyên dữ liệu họ đang nhập**. Làm rõ điều này trước khi thiết kế là
phần được đánh giá cao nhất trong câu trả lời.

Kiến trúc cho mức 2:

```
1. Service worker cache tài sản tĩnh (app shell)
2. IndexedDB lưu dữ liệu và HÀNG ĐỢI THAO TÁC
3. Mỗi thao tác offline: ghi vào hàng đợi + cập nhật lạc quan giao diện
4. Có mạng lại -> gửi hàng đợi theo thứ tự, xử lý xung đột
5. Giao diện luôn hiển thị rõ: đang offline, có N thay đổi chờ đồng bộ
```

Phần khó nhất, và là phần người phỏng vấn muốn đào: **xung đột**. Hai thiết bị cùng sửa một bản ghi
khi offline. Các chiến lược:

| Chiến lược | Ưu | Nhược |
|---|---|---|
| Ghi sau thắng | đơn giản | **mất dữ liệu âm thầm** |
| Hỏi người dùng | không mất gì | phiền, cần giao diện riêng |
| Gộp theo trường | tự động, ít mất | không đúng với mọi loại dữ liệu |
| CRDT (Yjs, Automerge) | tự gộp đúng, hợp cộng tác | nặng, mô hình dữ liệu bị ràng buộc |

Và những thứ bắt buộc phải có dù chọn cách nào:
- **Thao tác idempotent** với id sinh ở client — retry không tạo bản ghi trùng.
- **Giới hạn dung lượng**: IndexedDB có hạn mức và trình duyệt có thể **xoá dữ liệu** khi máy hết
  chỗ. Dữ liệu quan trọng phải được đồng bộ sớm, không giữ mãi ở client.
- **Xử lý được cả trường hợp "có mạng nhưng rất chậm"** — thường tệ hơn mất mạng hẳn, vì code không
  biết mình đang offline.

</details>

---

Quay lại: [README của frontend](./README.md) · Tiếp: [chung/01-system-design.md](../chung/01-system-design.md)
