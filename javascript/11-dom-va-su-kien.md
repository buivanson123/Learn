# Bài 11 — DOM và sự kiện

> Bài này có con số lớn nhất trong cả bộ: một cách viết chậm hơn cách khác **3877 lần**. Không
> phải 38%, mà 3877 lần. Cả bài là về việc hiểu vì sao.

---

## 1. Sự kiện đi ba pha, không phải hai

```js
for (const id of ['a', 'b', 'c']) {
  const el = document.getElementById(id);
  el.addEventListener('click', () => log.push(`capture ${id}`), true);   // pha 1
  el.addEventListener('click', () => log.push(`bubble  ${id}`));         // pha 3
}
document.getElementById('c').click();     // c nằm trong b, b nằm trong a
```

```
capture a
capture b
capture c
bubble  c
bubble  b
bubble  a
```

Ba pha: **capture** (từ `window` đi xuống), **target** (tại chính element), **bubble** (đi
ngược lên). Tham số thứ ba `true` chọn pha capture.

Khi nào cần capture: khi bạn muốn chặn sự kiện **trước** khi code khác thấy nó (ví dụ một
overlay chặn mọi click), hoặc khi sự kiện **không bubble**.

Bốn sự kiện thường dùng **không bubble** — chỉ bắt được ở capture hoặc ngay trên element:
`focus`, `blur`, `mouseenter`, `mouseleave`.

(Dùng `focusin`/`focusout` nếu cần bản có bubble; `mouseover`/`mouseout` cho chuột.)

---

## 2. `stopPropagation` không chặn được cùng element

```js
c.addEventListener('click', e => { out.push('handler 1'); e.stopPropagation() });
c.addEventListener('click', () => out.push('handler 2'));
b.addEventListener('click', () => out.push('cha b'));
c.click();
```

```
handler 1
handler 2 — VẪN CHẠY (stopPropagation không chặn cùng element)
```

`cha b` không in — đúng như mong đợi. Nhưng `handler 2` **vẫn chạy**.

| Method | Chặn gì |
|---|---|
| `stopPropagation()` | các element **khác** trên đường đi |
| `stopImmediatePropagation()` | các element khác **và** các handler còn lại trên **cùng** element |
| `preventDefault()` | hành vi mặc định của trình duyệt — **không** liên quan gì tới lan truyền |

Sai lầm phổ biến: dùng `preventDefault()` khi thật ra cần `stopPropagation()`, hoặc `return
false` (chỉ có tác dụng trong handler kiểu `onclick=`, không có tác dụng với `addEventListener`).

---

## 3. Event delegation: `target` vs `currentTarget`

```js
document.getElementById('list').addEventListener('click', function (e) {
  console.log(`e.target = ${e.target.tagName}#${e.target.dataset.id}`,
              `| e.currentTarget = ${e.currentTarget.tagName}`,
              `| this = ${this.tagName}`,
              `| closest('li') = ${e.target.closest('li')?.dataset.id}`);
});
```

```
e.target = LI#2 | e.currentTarget = UL | this = UL | closest('li') = 2
```

- **`e.target`** — element bị click thật sự (sâu nhất).
- **`e.currentTarget`** — element mà handler đang gắn trên. Bằng `this` (nếu handler là
  `function`, không phải arrow).

⚠️ `e.currentTarget` chỉ có giá trị **trong lúc** handler chạy. Sau `await` nó là `null`:

```js
el.addEventListener('click', async (e) => {
  await luu();
  console.log(e.currentTarget);      // -> null
});
```

Lưu lại trước khi `await`: `const el = e.currentTarget;`

**Vì sao luôn dùng `closest()`** trong delegation: nếu `<li>` chứa `<span>Xoá</span>`, click
vào chữ cho `e.target` là `SPAN`, không phải `LI`. `e.target.closest('li')` đi ngược lên tìm
`<li>` gần nhất.

### Cái giá của việc không delegate

```
gắn 10000 listener        : 3.30ms
gắn 1 listener delegate   : 0.000ms
```

3.3 ms không phải vấn đề lớn. Vấn đề thật là **bộ nhớ và việc gỡ**: 10 000 listener giữ 10 000
closure, và mỗi khi bạn render lại danh sách thì phải gỡ đủ 10 000 cái — quên là rò rỉ
([bài 08](./08-bo-nho-va-ro-ri.md) mục 5).

Delegation còn có một lợi thế mà ít ai nói: nó **tự động hoạt động với item mới thêm vào**.
Không cần gắn listener cho row vừa được thêm.

---

## 4. ⚠ `innerHTML +=` trong vòng lặp: 3877 lần chậm hơn

Thêm 5000 `<li>` bằng bốn cách:

```
innerHTML += (nối chuỗi)  7366.4ms
gom chuỗi rồi gán 1 lần      1.9ms
append trực tiếp DOM         3.4ms
DocumentFragment             5.5ms
```

**7366 ms so với 1.9 ms.** Vì mỗi lần `innerHTML +=` thực hiện đủ bốn việc:

1. **Đọc** — serialize toàn bộ cây con hiện tại thành chuỗi HTML.
2. Nối chuỗi.
3. **Phá** — xoá sạch mọi node con hiện có.
4. **Parse lại** toàn bộ chuỗi và dựng lại cây từ đầu.

Đến lần thứ 5000, mỗi vòng phải serialize + parse lại 5000 phần tử. Đó là O(n²).

Hậu quả nghiêm trọng hơn cả tốc độ: **bước 3 phá mọi thứ đang gắn vào node cũ** — event
listener, trạng thái `<input>`, vị trí con trỏ, `<video>` đang phát, tham chiếu từ JS.

### Điều đáng ngạc nhiên: `DocumentFragment` **không** nhanh nhất

Blog cũ dạy "luôn dùng `DocumentFragment` để tránh reflow". Đo trên Chrome 152:

```
append trực tiếp DOM    3.4ms
DocumentFragment        5.5ms      ← CHẬM HƠN
```

Lý do: Chrome hiện đại **không** tính layout lại sau mỗi `append`. Nó gom các thay đổi và chỉ
tính layout khi có ai đó **đọc** một thuộc tính layout (mục 5) hoặc khi tới lúc vẽ khung hình.
`DocumentFragment` giờ chỉ thêm một lớp cấp phát trung gian.

Lời khuyên đó **từng đúng** khoảng năm 2010. Bây giờ:

| Việc | Cách nhanh nhất |
|---|---|
| Dựng HTML từ dữ liệu, không cần giữ trạng thái cũ | **gom chuỗi rồi gán `innerHTML` 1 lần** (1.9 ms) |
| Thêm node nhưng phải giữ listener/state của node cũ | **`append` trực tiếp** (3.4 ms) |
| Không bao giờ | `innerHTML +=` trong vòng lặp |

⚠️ Nếu dữ liệu đến từ người dùng, `innerHTML` là lỗ hổng XSS. Dùng `textContent` cho phần văn
bản, hoặc `setHTML()` khi có (Sanitizer API).

---

## 5. Layout thrashing: 529 lần chậm hơn

```js
// XẤU — đọc và ghi xen kẽ
for (const e of A) { const w = e.offsetWidth; e.style.width = (w + 1) + 'px'; }

// TỐT — đọc hết rồi ghi hết
const ws = B.map(e => e.offsetWidth);
B.forEach((e, i) => e.style.width = (ws[i] + 1) + 'px');
```

```
xen kẽ đọc-ghi        : 635.30ms
đọc hết rồi ghi hết   :   1.20ms
nhanh hơn 529.4 lần
```

Cơ chế: trình duyệt xếp các thay đổi style vào hàng đợi và chỉ tính layout khi buộc phải.
Nhưng khi bạn **đọc** một thuộc tính layout, nó buộc phải tính **ngay lập tức** để trả về số
đúng — gọi là *forced synchronous layout*.

Vòng lặp xen kẽ ép nó tính lại 1000 lần. Vòng lặp tách ra chỉ tính 1 lần.

### Danh sách thuộc tính "ép tính layout"

Đọc bất kỳ cái nào dưới đây là ép tính lại:

```
offsetTop/Left/Width/Height    scrollTop/Left/Width/Height
clientTop/Left/Width/Height    getBoundingClientRect()
getComputedStyle()             focus()
scrollIntoView()               offsetParent
```

Trong React/Vue bạn vẫn gặp lỗi này — thường ở custom hook đo kích thước phần tử trong vòng lặp.

Cách chắc chắn tách hai pha: đọc trong `requestAnimationFrame`, ghi trong lần kế tiếp. Hoặc
dùng `ResizeObserver` / `IntersectionObserver` — chúng cung cấp số đo **đã tính sẵn**, không ép
tính lại.

---

## 6. `MutationObserver` chạy trong microtask

```js
const mo = new MutationObserver(recs => console.log('MO:', recs.length, 'thay đổi'));
mo.observe(el, { childList: true, subtree: true });

el.append(document.createElement('div'));
el.append(document.createElement('div'));
console.log('đồng bộ xong');
```

```
đồng bộ xong
MO: 2 thay đổi          ← MỘT lần gọi, gom 2 thay đổi
```

Hai điều: callback chạy **sau** code đồng bộ (nó là microtask, đúng như
[bài 06](./06-event-loop.md)), và các thay đổi được **gom lại** thành một lần gọi.

Đây chính là cơ chế mà framework dùng cho `nextTick` — và là cơ chế bạn sẽ tự dựng lại ở
[bài 15](./15-du-an-mini-framework.md).

⚠️ Nếu bạn sửa DOM **bên trong** callback của `MutationObserver`, bạn tạo ra một vòng lặp
microtask vô hạn — chính xác là kiểu bỏ đói macrotask ở bài 06 mục 4. Luôn có điều kiện dừng.

---

## 7. Bảy cách chọn element, và cái bẫy của hai cái đầu

```js
document.getElementsByClassName('x')     // ⚠ HTMLCollection — SỐNG
document.getElementsByTagName('div')     // ⚠ HTMLCollection — SỐNG
document.querySelectorAll('.x')          // NodeList — tĩnh
document.querySelector('.x')             // element đầu tiên hoặc null
el.closest('.x')                          // đi lên
el.matches('.x')                          // kiểm tra
el.children / el.parentElement            // đi ngang/lên
```

"Sống" nghĩa là danh sách **tự cập nhật khi DOM đổi**. Đó là nguồn của vòng lặp vô hạn kinh
điển:

```js
const items = document.getElementsByClassName('item');
for (let i = 0; i < items.length; i++) {
  items[i].classList.remove('item');      // ⚠ item vừa bị loại khỏi danh sách
}
```

Mỗi lần `remove` làm `items.length` giảm và các phần tử dịch chỉ số → vòng lặp **bỏ sót một
nửa**. Đo thật với 10 phần tử: chỉ xử lý được 5.

Ba cách sửa:

```js
[...document.getElementsByClassName('item')].forEach(e => e.classList.remove('item'));
document.querySelectorAll('.item').forEach(e => e.classList.remove('item'));   // NodeList tĩnh
for (let i = items.length - 1; i >= 0; i--) items[i].classList.remove('item'); // duyệt ngược
```

Quy tắc thực dụng: **luôn dùng `querySelectorAll`** trừ khi bạn thật sự cần danh sách sống.

---

## 8. Bài tập

### Bài 1 — Vì sao nút này ngừng hoạt động

```js
function veLaiDanhSach(items) {
  const ds = document.querySelector('#ds');
  ds.innerHTML = items.map(i => `<li>${i.ten} <button class="xoa">Xoá</button></li>`).join('');
  ds.querySelectorAll('.xoa').forEach(b =>
    b.addEventListener('click', () => xoa(b.closest('li'))));
}
```

Sau vài lần gọi `veLaiDanhSach`, trang chậm dần và dùng nhiều bộ nhớ hơn. Nêu **hai** vấn đề
và viết lại.

<details><summary>Gợi ý đáp án</summary>

**Vấn đề 1 — rò rỉ listener + detached DOM.** `innerHTML = ...` xoá node cũ, nhưng listener đã
gắn trên chúng vẫn tồn tại và closure của chúng giữ `b` (một `<button>` đã bị gỡ) → detached
DOM ([bài 08](./08-bo-nho-va-ro-ri.md) mục 4). Gọi 100 lần với 50 item là 5000 listener chết
kèm 5000 node.

**Vấn đề 2 — XSS.** `i.ten` đi thẳng vào `innerHTML`. Nếu tên là
`<img src=x onerror="fetch('/api/xoa-tat-ca')">` thì nó chạy.

Bản viết lại — delegation một lần + không nhét dữ liệu người dùng vào HTML:

```js
// Gắn MỘT lần, ngoài hàm render
document.querySelector('#ds').addEventListener('click', (e) => {
  const btn = e.target.closest('.xoa');
  if (!btn) return;
  xoa(btn.closest('li'));
});

function veLaiDanhSach(items) {
  const ds = document.querySelector('#ds');
  ds.replaceChildren(...items.map(i => {
    const li = document.createElement('li');
    li.textContent = i.ten;                    // ✅ không parse HTML
    li.dataset.id = i.id;
    const b = document.createElement('button');
    b.className = 'xoa';
    b.textContent = 'Xoá';
    li.append(b);
    return li;
  }));
}
```

Ba cải tiến:

- **Delegation** — 1 listener thay vì `n`, và nó không bị `replaceChildren` phá.
- **`textContent`** — dữ liệu người dùng không bao giờ được parse thành HTML.
- **`replaceChildren`** — thay toàn bộ con trong một thao tác, rõ ý hơn `innerHTML = ''` rồi
  append.

Nếu bạn cần tốc độ của `innerHTML` (1.9 ms so với 3.4 ms ở mục 4) thì vẫn được, nhưng phải
escape:

```js
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
ds.innerHTML = items.map(i => `<li data-id="${esc(i.id)}">${esc(i.ten)} ...</li>`).join('');
```

Với 5000 item, chênh lệch 1.5 ms không đáng để nhận rủi ro XSS. Chỉ chọn `innerHTML` khi đã đo
và thấy nó là điểm nghẽn thật.

</details>

### Bài 2 — Tối ưu vòng lặp đo kích thước

Đoạn này chạy 600 ms với 1000 phần tử. Đưa xuống dưới 5 ms.

```js
function canDeu(els) {
  for (const el of els) {
    const rong = el.getBoundingClientRect().width;
    el.style.paddingLeft = (100 - rong) / 2 + 'px';
  }
}
```

<details><summary>Gợi ý đáp án</summary>

Layout thrashing — `getBoundingClientRect()` ép tính layout, `style.paddingLeft` làm layout bẩn
trở lại, lặp 1000 lần.

```js
function canDeu(els) {
  const rongs = els.map(el => el.getBoundingClientRect().width);   // ĐỌC hết
  els.forEach((el, i) => el.style.paddingLeft = (100 - rongs[i]) / 2 + 'px');  // GHI hết
}
```

```
trước: 635.30ms
sau  :   1.20ms
```

Nếu hàm này được gọi từ nhiều chỗ trong cùng một khung hình, bạn vẫn có thể bị thrash — vì
chỗ khác đọc layout ở giữa. Cách chắc chắn nhất là tách hai pha qua `requestAnimationFrame`:

```js
function canDeu(els) {
  const rongs = els.map(el => el.getBoundingClientRect().width);
  requestAnimationFrame(() => {
    els.forEach((el, i) => el.style.paddingLeft = (100 - rongs[i]) / 2 + 'px');
  });
}
```

Nhưng câu hỏi tốt hơn: **có cần JavaScript không?** Việc căn giữa này CSS làm được bằng
`display: grid; place-items: center` — 0 ms, 0 dòng JS, và tự đúng khi kích thước đổi.

Quy tắc: mỗi lần bạn thấy mình đọc `getBoundingClientRect` để tính một giá trị CSS, hãy kiểm
tra xem CSS đã có công cụ cho việc đó chưa.

</details>

### Bài 3 — Vòng lặp bỏ sót một nửa

```js
const items = document.getElementsByClassName('item');
console.log('trước:', items.length);
for (let i = 0; i < items.length; i++) items[i].classList.remove('item');
console.log('sau:', items.length);
```

Với 10 phần tử, output là gì?

<details><summary>Gợi ý đáp án</summary>

```
trước: 10
sau: 5
```

`getElementsByClassName` trả **HTMLCollection sống**. Lần lặp `i=0` xoá class khỏi phần tử đầu
→ nó rời khỏi collection → mọi phần tử dịch xuống một chỗ, `length` thành 9. Nhưng `i` tăng
thành 1, nên phần tử vừa dịch vào vị trí 0 bị **bỏ qua**.

Kết quả: xử lý các phần tử ở vị trí 0, 2, 4, 6, 8 của danh sách gốc — đúng một nửa.

Cách sửa (đã nêu ở mục 7), và cách gỡ lỗi: nếu thấy một vòng lặp DOM xử lý đúng một nửa hoặc
chạy vô hạn, câu hỏi đầu tiên luôn là **"danh sách này sống hay tĩnh?"**.

Bốn thứ trả về collection **sống**: `getElementsByClassName`, `getElementsByTagName`,
`getElementsByName`, và `element.children`. Riêng `element.children` hay bị quên nhất:

```js
for (const c of el.children) c.remove();     // ⚠ cũng bỏ sót một nửa
[...el.children].forEach(c => c.remove());   // ✅
el.replaceChildren();                         // ✅ gọn nhất
```

</details>

---

**Tiếp theo:** [Bài 12 — Browser API](./12-browser-api.md)
