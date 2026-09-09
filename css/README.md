# Học CSS hiện đại (dành cho người đã viết JavaScript)

CSS không phải là "trang trí". Nó là một **hệ thống tính toán bố cục**: bạn khai báo ràng buộc, trình
duyệt giải bài toán và trả ra vị trí từng pixel. Phần lớn thời gian người ta vật lộn với CSS là vì
đang **đoán** kết quả của bài toán đó thay vì hiểu luật giải.

Tài liệu này dạy đúng cái luật giải ấy.

Viết cho **Chrome 152** (bản đang có trên máy bạn). Mọi con số, mọi output, mọi thông báo lỗi dưới đây
đều **đo thật** bằng Playwright điều khiển Chrome trước khi viết ra — không có câu nào chép từ trí nhớ.

```
$ node -e "const{chromium}=require('playwright');(async()=>{const b=await chromium.launch({channel:'chrome'});
  const p=await b.newPage();console.log(await p.evaluate(()=>navigator.userAgent));await b.close()})()"
Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)
HeadlessChrome/152.0.0.0 Safari/537.36
```

---

## ⚠️ Đọc trước: CSS 2026 khác hẳn CSS bạn từng học

Nếu bạn học CSS trước 2023, có ít nhất 6 thứ trong đầu bạn đã lỗi thời. Đây là bảng đối chiếu, cột phải
là kết quả **đo được trên Chrome 152**:

| Việc cần làm | Cách cũ vẫn được dạy | Cách bây giờ |
|---|---|---|
| Component đổi layout theo chỗ nó đứng | `@media` theo bề rộng **cửa sổ** | `@container` theo bề rộng **ô chứa** ([bài 07](./07-responsive-va-container-query.md)) |
| Chọn cha dựa trên con | Không làm được bằng CSS, phải dùng JS | `:has()` — đo thật ở [bài 01](./01-cascade-va-selector.md) |
| Ghi đè style của thư viện | `!important` | `@layer` — layer sau thắng layer trước bất kể specificity |
| Lồng selector | Phải cài Sass | CSS có nesting gốc, `&` tuỳ chọn |
| Mở/đóng accordion mượt | `max-height: 1000px` (số ma thuật) | `interpolate-size: allow-keywords` + `height: auto` |
| Ẩn/hiện modal có hiệu ứng | `setTimeout` để đợi transition rồi mới `display:none` | `transition-behavior: allow-discrete` + `@starting-style` |
| Thanh tiến trình khi cuộn | JS nghe sự kiện `scroll` | `animation-timeline: scroll()` — 0 dòng JS |
| Đổi màu sáng/tối | Viết 2 bảng màu, nhân đôi mọi biến | `light-dark()` + `color-scheme` |

Có một thứ **chưa** dùng được, đừng tin blog nói đã có:

```
CSS.supports('line-clamp: 2')          -> false     ← vẫn phải dùng -webkit-line-clamp
CSS.supports('display: masonry')       -> false
CSS.supports('shape: circle()')        -> false
```

---

## Lộ trình 7 ngày

| Ngày | File | Nội dung | Thời lượng |
|------|------|----------|------------|
| 1 | [00-moi-truong-va-devtools.md](./00-moi-truong-va-devtools.md) | Dựng chỗ thí nghiệm, đọc DevTools, tự kiểm chứng mọi khẳng định | 2h |
| 1 | [01-cascade-va-selector.md](./01-cascade-va-selector.md) | **Vì sao rule của bạn không ăn** — specificity, `@layer`, `:has()`, `:is()`, nesting | 4h |
| 2 | [02-box-model.md](./02-box-model.md) | `box-sizing`, margin dính nhau, `%` tính theo cái gì, `min-content`/`fit-content` | 3h |
| 2 | [03-luong-inline-va-chu.md](./03-luong-inline-va-chu.md) | Khoảng trắng bí ẩn, `line-height`, baseline, ngắt chữ, `text-wrap` | 3h |
| 3 | [04-flexbox.md](./04-flexbox.md) | **Toán chia không gian** — `flex: 1` thật ra là gì, bẫy `min-width: auto` | 4h |
| 4 | [05-grid.md](./05-grid.md) | `fr`, `minmax`, `auto-fit` vs `auto-fill`, `subgrid`, vùng đặt tên | 4h |
| 4 | [06-position-va-stacking.md](./06-position-va-stacking.md) | `absolute` neo vào đâu, **stacking context**, vì sao `z-index: 9999` thua | 3h |
| 5 | [07-responsive-va-container-query.md](./07-responsive-va-container-query.md) | `@container`, `cqi`, `clamp()`, cú pháp range, style query | 4h |
| 5 | [08-bien-css-va-theming.md](./08-bien-css-va-theming.md) | Biến CSS, `@property`, `oklch`, `color-mix`, `light-dark()`, chế độ tối | 3h |
| 6 | [09-transition-va-animation.md](./09-transition-va-animation.md) | `transition`, `@starting-style`, `allow-discrete`, `interpolate-size`, cuộn-điều-khiển | 4h |
| 6 | [10-hieu-nang-render.md](./10-hieu-nang-render.md) | Thuộc tính nào gây tính lại layout — **đo bằng số lần layout thật** | 2h |
| 7 | [11-du-an-landing-page.md](./11-du-an-landing-page.md) | Dựng landing page hoàn chỉnh, gồm **4 lỗi tôi mắc phải và cách sửa** | 5h |
| — | [12-loi-thuong-gap.md](./12-loi-thuong-gap.md) | 30 lỗi kèm cách nhận ra và cách sửa | — |
| — | [13-cheatsheet.md](./13-cheatsheet.md) | Tra cứu nhanh | — |

Mỗi bài có **bài tập ở cuối** kèm `<details>` gợi ý đáp án. Làm xong tự mở ra đối chiếu.

---

## Chuẩn bị đi phỏng vấn

👉 **[phong-van/](./phong-van/README.md)** — 60 câu hỏi kèm đáp án hai tầng (trả lời ngắn để nói ra
miệng + phần giải thích sâu), 18 bài tập gõ tay, 10 tình huống debug từ ảnh chụp màn hình lỗi,
và checklist tự chấm 80 mục.

---

## Dự án đi kèm

[`du-an/landing/`](./du-an/landing/) — một trang landing hoàn chỉnh, **CSS thuần, 0 thư viện**,
491 dòng CSS. Nó dùng gần như mọi thứ trong giáo trình: `@layer`, nesting, `@property`, `oklch`,
`light-dark()`, container query, `clamp()`, `subgrid` thay thế, `animation-timeline: scroll()`,
`interpolate-size`, `@starting-style`.

Chạy thử:

```bash
$ cd du-an/landing
$ python3 -m http.server 8123
$ open http://localhost:8123
```

> Phải chạy qua HTTP chứ đừng mở thẳng file. Với `file://`, trình duyệt chặn đọc `cssRules`
> nên DevTools và script kiểm tra sẽ báo
> `SecurityError: Failed to read the 'cssRules' property from 'CSSStyleSheet'`.

Kết quả đã kiểm chứng trên 10 bề rộng màn hình:

```
    320px  tràn ngang=không  cao= 3932  h1=   32px  số cột card=1
    375px  tràn ngang=không  cao= 3871  h1= 32.9px  số cột card=1
    600px  tràn ngang=không  cao= 3327  h1= 39.2px  số cột card=2
    900px  tràn ngang=không  cao= 2446  h1= 47.6px  số cột card=3
   1280px  tràn ngang=không  cao= 2289  h1=   52px  số cột card=3
   1920px  tràn ngang=không  cao= 2289  h1=   52px  số cột card=3
```

---

## Bốn ý tưởng lớn của CSS (và cái giá đi kèm mỗi cái)

### 1. Cascade — nhiều rule cùng nhắm một element, luôn có đúng một cái thắng

Đây là chữ C trong CSS. Trình duyệt không bao giờ "phân vân"; nó có một thuật toán xếp hạng cố định.
Bạn thấy `color` không đổi nghĩa là rule của bạn **thua**, chứ không phải "CSS bị lỗi".

Đo thật — 20 class chồng lên nhau vẫn thua 1 id:

```css
#id { color: rgb(0,0,255) }
.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1.c1 { color: rgb(0,255,0) }
```

```js
getComputedStyle(document.querySelector('p')).color
-> "rgb(0, 0, 255)"        ← id thắng
```

**Cái giá:** thang điểm này khiến người ta leo thang `!important`. `@layer` ở [bài 01](./01-cascade-va-selector.md)
sinh ra để phá vòng luẩn quẩn đó.

### 2. Bố cục là một bài toán ràng buộc, không phải toạ độ

Bạn không nói "đặt hộp này ở x=250". Bạn nói "chia đều phần dư" rồi trình duyệt tính ra 250.

Đo thật — `flex-grow` chia **phần còn thừa**, không chia tổng:

```css
.row { display: flex; width: 500px }
.row > * { flex-basis: 100px }
#a { flex-grow: 1 }   #b { flex-grow: 3 }
```

```
container 500px, tổng basis 200px, còn thừa 300px
a = 100 + 300×(1/4) = 175px      ← đo được: 175
b = 100 + 300×(3/4) = 325px      ← đo được: 325
tỉ lệ bề rộng cuối cùng = 1.86, KHÔNG phải 3
```

Người mới luôn tưởng `flex-grow: 3` nghĩa là "rộng gấp 3". Không phải.

**Cái giá:** khi kết quả sai, bạn phải truy ngược cả bài toán chứ không sửa được một con số.

### 3. Kế thừa — một số thuộc tính chảy xuống, số khác thì không

Đo thật, đặt tất cả lên cha rồi đọc ở con:

```js
{ color: "rgb(0, 100, 0)",  fontSize: "20px",  lineHeight: "40px",   // ✅ kế thừa
  textAlign: "right",       cursor: "pointer", visibility: "hidden",  // ✅ kế thừa
  borderTopWidth: "0px",    paddingTop: "0px" }                       // ❌ không kế thừa
```

Quy luật dễ nhớ: **thuộc tính về chữ thì kế thừa, thuộc tính về hộp thì không.**

**Cái giá:** một `font-size: 1.5em` đặt nhầm chỗ sẽ nhân dồn qua từng tầng —
3 tầng lồng nhau cho ra **54px** từ gốc 16px ([bài 02](./02-box-model.md)).

### 4. Trình duyệt vẽ theo từng lớp, và một số thuộc tính tạo ra lớp mới

Đây là nguồn gốc của câu hỏi kinh điển "sao `z-index: 9999` vẫn bị che".

Đo thật — bảng đầy đủ các thuộc tính tạo **stacking context**:

```
opacity: .99             -> CÓ tạo          transform: scale(1)      -> CÓ tạo
filter: blur(0)          -> CÓ tạo          will-change: transform   -> CÓ tạo
isolation: isolate       -> CÓ tạo          contain: paint           -> CÓ tạo
mix-blend-mode           -> CÓ tạo          backdrop-filter          -> CÓ tạo
position: fixed          -> CÓ tạo          content-visibility: auto -> CÓ tạo
view-transition-name     -> CÓ tạo          container-type           -> KHÔNG tạo
```

**Cái giá:** thêm `opacity: 0.99` cho đẹp có thể phá vỡ z-index của cả một nhánh DOM
([bài 06](./06-position-va-stacking.md)).

---

## Cách dùng tài liệu này

1. **Đừng đọc chay.** Mỗi bài đều có khối `$ node do.js` kèm output. Mở
   [bài 00](./00-moi-truong-va-devtools.md) trước để dựng chỗ chạy thử — mất 5 phút.
2. **Gặp con số lạ thì tự đo lại.** Tài liệu này chỉ ra cách đo, không bắt bạn tin.
3. **Làm bài tập trước khi mở gợi ý.** Phần lớn bài tập là "đoán kết quả rồi chạy để kiểm tra" —
   chỗ bạn đoán sai chính là chỗ mô hình trong đầu bạn đang lệch.

Harness đo đã dựng sẵn ở [`do/`](./do/README.md) — chỉ cần `npm i playwright` là chạy được.

Bắt đầu: [00-moi-truong-va-devtools.md](./00-moi-truong-va-devtools.md)
