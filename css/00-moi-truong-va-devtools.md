# Bài 00 — Dựng chỗ thí nghiệm và học đọc DevTools

Mục tiêu của bài này: từ giờ trở đi, khi gặp bất kỳ câu khẳng định nào về CSS (kể cả trong tài liệu
này), bạn **kiểm tra được trong 30 giây** thay vì phải tin.

---

## 1. Ba cách chạy thử CSS, chọn theo tình huống

| Cách | Dùng khi | Nhược điểm |
|---|---|---|
| Gõ thẳng vào DevTools Console | Kiểm tra nhanh 1 giá trị | Không lưu lại được |
| File HTML + `python3 -m http.server` | Thử một layout | Phải tự nhìn bằng mắt |
| Script Playwright | Cần **số đo chính xác**, so nhiều trường hợp | Phải cài 1 gói |

Tài liệu này dùng cách thứ 3 cho mọi con số. Dựng nó mất 2 phút.

---

## 2. Dựng chỗ đo bằng Playwright

Máy bạn đã có Node v22.23.2 nên chỉ cần:

```bash
$ mkdir css-lab && cd css-lab
$ npm init -y
$ npm i playwright
added 2 packages, and audited 3 packages in 6s
```

⚠️ **Đừng chạy `npx playwright install`.** Gói `playwright` mặc định đòi tải bản Chromium riêng
(~150 MB). Máy bạn **đã có Chrome 152** rồi, dùng luôn bằng `channel: 'chrome'`.

Nếu quên cờ đó, lỗi trông như thế này:

```
$ node probe.js
browserType.launch: Executable doesn't exist at
/Users/vanson/Library/Caches/ms-playwright/chromium_headless_shell-1243/.../chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║     npx playwright install                                 ║
╚════════════════════════════════════════════════════════════╝
```

Sửa bằng một chữ:

```js
const b = await chromium.launch({ channel: 'chrome' });   // ← thêm cái này
```

### File `harness.js` — dùng lại cho mọi bài

```js
const { chromium } = require('playwright');

// Mỗi case: { name, head, html, fn }
// fn chạy BÊN TRONG trang, trả về gì thì in ra cái đó
async function run(cases, opts = {}) {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: opts.viewport || { width: 800, height: 600 } });
  for (const c of cases) {
    await p.setContent(
      `<!doctype html><html><head><meta charset=utf-8>${c.head || ''}</head>` +
      `<body>${c.html}</body></html>`);
    let out;
    try { out = await p.evaluate(c.fn); } catch (e) { out = 'ERROR: ' + e.message; }
    console.log('\n### ' + c.name);
    console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  }
  await b.close();
}
module.exports = { run };
```

### Bài đo đầu tiên

```js
// do.js
const { run } = require('./harness');

run([{
  name: 'id có thắng được 20 class không?',
  head: `<style>
    #id { color: rgb(0,0,255) }
    .c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c.c { color: rgb(0,255,0) }
  </style>`,
  html: `<p id="id" class="c">x</p>`,
  fn: () => getComputedStyle(document.querySelector('p')).color,
}]);
```

```
$ node do.js

### id có thắng được 20 class không?
rgb(0, 0, 255)
```

Xong. Từ đây mọi khẳng định trong tài liệu đều kiểm tra được theo cách này.

---

## 3. `fn` chạy trong trang, không phải trong Node

Đây là lỗi bạn sẽ mắc ngay lần đầu. Hàm truyền vào `p.evaluate()` được **chuyển thành chuỗi** rồi
chạy trong trình duyệt, nên nó **không thấy** biến nào bên ngoài:

```js
const R = id => document.getElementById(id).getBoundingClientRect();   // ← khai ở Node

run([{ name: 'thử', html: `<div id="a"></div>`,
  fn: () => ({ a: R('a') })                                            // ← dùng trong trang
}]);
```

```
### thử
ERROR: page.evaluate: ReferenceError: R is not defined
    at eval (eval at evaluate (:311:30), <anonymous>:1:21)
```

Cách sửa — nhét định nghĩa vào cùng chuỗi hàm:

```js
const RR = `const R = id => { const r = document.getElementById(id).getBoundingClientRect();
  return { w: +r.width.toFixed(2), h: +r.height.toFixed(2) }; };`;

fn: new Function(RR + `return ({ a: R('a') })`)
```

---

## 4. Bốn hàm đo bạn sẽ dùng suốt tài liệu

### `getComputedStyle(el)` — giá trị CUỐI CÙNG sau khi cascade xử lý xong

```js
getComputedStyle(el).color        // -> "rgb(0, 0, 255)"  (luôn là rgb, không phải "blue")
getComputedStyle(el).width        // -> "200px"           (luôn là px, không phải "50%")
getComputedStyle(el, '::after').content   // đọc được cả pseudo-element
```

⚠️ **Bẫy:** `getComputedStyle` trả về giá trị **đã khai báo**, không phải giá trị **đang có tác dụng**.
Đo thật:

```css
.st { width: 100px; height: 100px }
#a { background: red; z-index: 99 }      /* nhưng #a là position: static */
#b { background: blue; margin-top: -50px }
```

```js
{ computed_z_index_cua_a: "99",          ← DevTools vẫn hiện 99
  position_cua_a: "static",
  element_o_tren_tai_diem_giao: "b" }    ← nhưng b vẫn đè lên a
```

`z-index: 99` hiện ra đàng hoàng mà **không có tác dụng gì** vì element là `static`
([bài 06](./06-position-va-stacking.md)).

### `getBoundingClientRect()` — kích thước và vị trí THẬT sau khi vẽ

```js
const r = el.getBoundingClientRect();
r.width, r.height     // đã tính cả transform: scale
r.x, r.y              // toạ độ so với viewport
```

Khác biệt quan trọng so với `offsetWidth`:

| | Tính border/padding | Tính `transform` | Số lẻ |
|---|---|---|---|
| `offsetWidth` | có | **không** | làm tròn |
| `getBoundingClientRect().width` | có | **có** | chính xác (`161.88`) |
| `clientWidth` | padding có, border không | không | làm tròn |

### `elementFromPoint(x, y)` — ai đang nằm TRÊN CÙNG tại điểm đó

Đây là cách duy nhất kiểm tra thứ tự vẽ mà không phải nhìn bằng mắt:

```js
document.elementFromPoint(50, 75).id     // -> "b"
```

### `scrollWidth` vs `clientWidth` — phát hiện tràn ngang

```js
el.scrollWidth > el.clientWidth     // true = có nội dung tràn ra ngoài
```

Đây là kiểm tra bạn nên chạy trên **mọi** trang trước khi giao việc:

```js
const vw = document.documentElement.clientWidth;
for (const e of document.querySelectorAll('*')) {
  const r = e.getBoundingClientRect();
  if (r.right > vw + 0.5) console.log('TRÀN:', e.tagName, e.className, r.right);
}
```

Chạy đúng đoạn này trên dự án landing page ở [bài 11](./11-du-an-landing-page.md), tôi tìm ra thủ phạm
trong 2 giây:

```
### Element nào vượt ra ngoài viewport 320px
{ "viewport": 320, "tong_tran": 1,
  "thu_pham": [ { "the": "button.btn", "left": 254.4, "right": 352.6,
                  "rong": 98.2, "minWidth": "auto" } ] }
```

---

## 5. DevTools: bốn chỗ đáng dùng, phần còn lại bỏ qua

### 5.1 Tab **Computed** → ô "Show all" + kính lúp

Đây là chỗ trả lời "rule nào đang thắng". Bấm mũi tên bên trái một thuộc tính, nó liệt kê **mọi**
rule khai báo thuộc tính đó, cái nào bị gạch ngang là cái đã thua.

Nếu thấy giá trị lạ mà không rule nào của bạn khai — nó đến từ **kế thừa** hoặc từ **user-agent
stylesheet**. Bật `Show all` để thấy cả hai.

### 5.2 Tab **Layout** → "Grid overlays" và "Flexbox overlays"

Tick vào tên grid, trình duyệt vẽ đè số thứ tự đường lên màn hình. Đây là cách nhanh nhất để hiểu vì
sao `grid-column: 2 / 4` lại rơi vào chỗ bạn không ngờ.

### 5.3 Badge cạnh element trong tab Elements

Chrome gắn nhãn ngay cạnh thẻ:

- `grid` / `flex` — bấm vào để bật overlay
- `scroll` — element này đang cuộn được (hữu ích khi tìm tổ tiên cuộn của `position: sticky`)
- `sticky` — **bấm vào để xem nó có thực sự dính hay không**, Chrome sẽ chỉ ra tổ tiên nào phá `sticky`

### 5.4 Ô `:hov` để bật cưỡng bức trạng thái

Bấm `:hov` rồi tick `:hover`, `:focus`, `:focus-visible`, `:active`. Không có nó thì không cách nào
inspect được style của dropdown vì nó biến mất ngay khi bạn rời chuột.

---

## 6. Kiểm tra một tính năng có dùng được không: `CSS.supports()`

Đừng tra bảng tương thích trên mạng — hỏi thẳng trình duyệt trên máy bạn:

```js
CSS.supports('selector(:has(a))')                    // cú pháp cho selector
CSS.supports('container-type', 'inline-size')        // cú pháp 2 tham số
CSS.supports('(display: grid) and (gap: 1px)')       // cú pháp điều kiện
```

Kết quả đo thật trên Chrome 152 của bạn:

```
selector(:has(a))                    -> true       (container-type: inline-size)  -> true
selector(&)                          -> true       (color: oklch(...))            -> true
(view-transition-name: a)            -> true       (grid-template-rows: subgrid)  -> true
(text-wrap: balance)                 -> true       (anchor-name: --a)             -> true
(field-sizing: content)              -> true       (interpolate-size: allow-...)  -> true
(scroll-timeline: --t)               -> true       (content-visibility: auto)     -> true
(transition-behavior: allow-discrete)-> true       (scrollbar-gutter: stable)     -> true

(display: masonry)                   -> false      (shape: circle())              -> false
(line-clamp: 2)                      -> false      ← vẫn phải -webkit-line-clamp
```

Dùng nó ngay trong CSS luôn:

```css
@supports (display: masonry) {
  .grid { display: masonry }         /* chưa chạy ở đâu cả, nhưng khi có sẽ tự bật */
}

@supports not (container-type: inline-size) {
  .card { /* dự phòng cho trình duyệt cũ */ }
}
```

⚠️ Có hai thứ `CSS.supports` **không** kiểm tra được vì chúng là at-rule chứ không phải thuộc tính:

```js
CSS.supports('(@layer)')        // -> false, nhưng @layer VẪN chạy
```

Cách kiểm tra `@layer` thật sự có chạy không: viết một rule trong layer, rồi đọc `getComputedStyle`.

---

## 7. Đọc `document.styleSheets` để soi cấu trúc file CSS

Kiểm tra nhanh xem các `@layer` có được khai đúng thứ tự không:

```js
const s = [...document.styleSheets].find(s => (s.href||'').endsWith('styles.css'));
[...s.cssRules].filter(r => r.constructor.name === 'CSSLayerBlockRule').map(r => r.name)
```

Chạy trên dự án landing page:

```
["reset", "token", "base", "layout", "component", "utility"]
```

⚠️ **Chỉ chạy được qua HTTP.** Mở bằng `file://` sẽ bị chặn:

```
SecurityError: Failed to read the 'cssRules' property from 'CSSStyleSheet':
Cannot access rules
```

Nên dựng server tĩnh khi làm việc với CSS, kể cả trang tĩnh nhất:

```bash
$ python3 -m http.server 8123
```

---

## Bài tập

1. Dựng `harness.js` theo mục 2 và chạy được bài đo đầu tiên. Đổi `#id` thành `.c2` và đoán trước kết
   quả, rồi chạy để đối chiếu.

2. Viết một case đo xem `visibility` và `padding` có kế thừa không. Đặt cả hai lên thẻ cha, đọc ở
   thẻ con.

3. Trên một trang bất kỳ bạn đang làm, chạy đoạn tìm element tràn ngang ở mục 4 với viewport 320px.
   Ghi lại thủ phạm.

4. Tạo một element `position: static` có `z-index: 500`. Dùng `getComputedStyle` và
   `elementFromPoint` để chứng minh `z-index` đó vô nghĩa.

5. Dùng `CSS.supports` kiểm tra 5 tính năng bạn hay dùng. Có cái nào bạn tưởng đã chạy mà thực ra
   chưa không?

6. Đo cùng một element bằng `offsetWidth`, `clientWidth`, và `getBoundingClientRect().width` khi nó có
   `padding: 20px; border: 5px solid; transform: scale(2)`. Ba số này khác nhau thế nào?

<details>
<summary>Gợi ý đáp án</summary>

**2.** `visibility` **có** kế thừa (con nhận `hidden`), `padding` **không** (con nhận `0px`). Nhóm kế
thừa gần như trùng với "thuộc tính liên quan tới chữ": `color`, `font-*`, `line-height`, `text-align`,
`letter-spacing`, `cursor`, `visibility`, `list-style`.

**4.** `getComputedStyle(el).zIndex` trả `"500"` nhưng `elementFromPoint` tại chỗ chồng lấn vẫn trả về
element phía sau. Thêm `position: relative` thì kết quả đảo lại ngay.

**6.** Với `width: 100px; padding: 20px; border: 5px; transform: scale(2)`:
- `clientWidth` = 140 (nội dung 100 + padding 40, không có border, không có transform)
- `offsetWidth` = 150 (thêm border 10, vẫn **không** có transform)
- `getBoundingClientRect().width` = 300 (150 × 2, **có** transform)

Đây là lý do khi đo element có `transform`, chỉ `getBoundingClientRect` mới cho số đúng.

</details>

---

Tiếp theo: [01-cascade-va-selector.md](./01-cascade-va-selector.md)
