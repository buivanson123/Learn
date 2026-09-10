# Bài 15 — Dự án: tự viết framework reactive

> 267 dòng, **0 thư viện**. Sau bài này bạn đọc mã nguồn Vue/Solid sẽ thấy quen, vì bạn
> vừa dựng lại đúng bốn cơ chế của nó bằng tay.
>
> Mục 5 là phần giá trị nhất: **một bug thật tôi mắc phải khi viết dự án này**, kèm cách nó biểu
> hiện và cách tìm ra.

Code đầy đủ ở [`du-an/mini-framework/`](./du-an/mini-framework/).

```bash
cd du-an/mini-framework
node test/reactive.test.js     # 10/10 test đạt
node server.js                 # http://localhost:5173
```

---

## 1. Bốn tầng, mỗi tầng một bài đã học

| Tầng | File | Dùng kiến thức từ |
|---|---|---|
| Reactivity: `signal`/`effect`/`computed` | `src/reactive.js` | closure (bài 01), `Object.is` (bài 03), microtask (bài 06) |
| Render DOM có keyed diff | `src/dom.js` | DOM (bài 11), `WeakMap` (bài 08) |
| Router | `src/router.js` | Navigation API (bài 10), delegation (bài 11) |
| Ứng dụng demo | `app.js` | `toReversed` (bài 10) |

---

## 2. Trái tim: 3 dòng làm nên reactivity

Toàn bộ ý tưởng nằm ở đây:

```js
const nganXep = [];                     // effect đang chạy

get value() {
  const hienTai = nganXep[nganXep.length - 1];
  if (hienTai) nguoiTheoDoi.add(hienTai);      // ← ĐỌC thì ghi nhận người theo dõi
  return giaTri;
}
set value(v) {
  if (Object.is(v, giaTri)) return;
  giaTri = v;
  for (const e of [...nguoiTheoDoi]) henLich(e);   // ← GHI thì đánh thức họ
}
```

Không có `Proxy`, không có compiler, không có `virtual DOM` ở tầng này. Chỉ là: **ai đang chạy
thì người đó là người phụ thuộc.**

### Vì sao là **ngăn xếp**, không phải một biến

Vì effect lồng nhau được:

```js
effect(() => {
  ngoai.push(a.value);
  effect(() => trong.push(b.value));    // effect trong effect
});
```

Nếu dùng một biến `effectHienTai`, effect trong sẽ ghi đè nó, và sau khi nó xong thì `a` bị gán
cho effect trong. Kết quả: đổi `b` làm effect **ngoài** chạy lại. Test bắt đúng ca này:

```
✅ effect lồng nhau không làm lẫn phụ thuộc
```

### Vì sao `Object.is` chứ không phải `===`

```js
if (Object.is(v, giaTri)) return;
```

Nhớ [bài 03](./03-kieu-du-lieu-va-so-sanh.md) mục 2. Test kiểm cả hai ca biên:

```
✅ Object.is: NaN không kích hoạt chạy lại, -0 thì có
```

Với `===`, `NaN → NaN` sẽ bị coi là **thay đổi** (vì `NaN === NaN` là `false`) và render lại vô
ích mỗi lần. Với `Object.is`, `0 → -0` được coi là thay đổi thật — đúng, vì
`(0).toFixed()` và `(-0).toFixed()` cho kết quả khác nhau khi hiển thị.

---

## 3. Gom cập nhật: đúng cơ chế `nextTick` của Vue

```js
const choChay = new Set();
let daHenLich = false;

function henLich(fn) {
  choChay.add(fn);                       // Set -> không xếp trùng
  if (daHenLich) return;
  daHenLich = true;
  queueMicrotask(() => {                 // gom cả lượt đồng bộ thành 1 lần chạy
    daHenLich = false;
    const dot = [...choChay];            // chép ra: effect có thể xếp thêm việc mới
    choChay.clear();
    for (const fn of dot) fn();
  });
}
```

Đo thật bằng test:

```js
a.value = 1; a.value = 2; a.value = 3;
await nhip();
assert.equal(n, 2);                      // 1 lần chạy đầu + 1 lần gom
```

```
✅ nhiều lần ghi trong cùng lượt đồng bộ -> MỘT lần chạy lại
```

Ba lần ghi, **một** lần render. Không có `queueMicrotask` thì là ba lần render và ba lần đụng DOM.

Hai chi tiết bắt buộc, mỗi cái ứng với một bug:

- **`Set` chứ không phải mảng** — cùng một effect phụ thuộc vào cả `a` và `b`; ghi cả hai thì nó
  bị xếp hai lần. `Set` loại trùng.
- **Chép ra `[...choChay]` trước khi lặp** — effect đang chạy có thể ghi vào signal khác và xếp
  thêm việc. Lặp trực tiếp trên `Set` đang bị thêm phần tử là vòng lặp không xác định.

Tại sao `queueMicrotask` mà không phải `setTimeout(0)`: nhớ [bài 06](./06-event-loop.md) — với
microtask, DOM được cập nhật **trước khi trình duyệt vẽ khung hình tiếp theo**, nên không có
nháy hình. Với `setTimeout` thì có thể vẽ mất một khung ở trạng thái cũ.

---

## 4. Dọn phụ thuộc cũ: chỗ dễ bỏ sót nhất

```js
const chay = () => {
  if (chay.daHuy) return;
  donPhuThuoc(chay);            // ⚠ dọn phụ thuộc CŨ trước mỗi lần chạy
  nganXep.push(chay);
  try { fn() } finally { nganXep.pop() }
};
```

Vì sao cần: phụ thuộc **thay đổi theo nhánh code**.

```js
effect(() => log.push(co.value ? x.value : y.value));
```

Lần đầu `co` là `true` → phụ thuộc `{co, x}`. Nếu `co` thành `false` → phải thành `{co, y}`.
Không dọn thì `x` vẫn trong danh sách và mọi lần đổi `x` gây render vô ích mãi mãi.

Test kiểm cả bốn giai đoạn:

```
✅ phụ thuộc theo nhánh: đổi biến ở nhánh không chạy -> không chạy lại
```

`finally` ở dòng `nganXep.pop()` cũng không phải cho đẹp — nếu `fn()` ném lỗi mà không `pop`,
ngăn xếp còn rác và **mọi signal đọc sau đó đăng ký sai người theo dõi**. Test:

```
✅ effect ném lỗi vẫn để ngăn xếp sạch
```

---

## 5. ⚠ Bug thật tôi mắc: listener cộng dồn sau mỗi render

Đây là phần đáng đọc nhất của bài.

### Triệu chứng

Bấm checkbox **không có tác dụng gì**. Playwright báo:

```
locator.check: Clicking the checkbox did not change its state
  - click action done
  - navigations have finished
```

Chú ý dòng `click action done` — click **đã xảy ra**, chỉ là trạng thái không đổi. Không có lỗi
nào trong console. Và nghiệt hơn: **lần bấm đầu tiên sau khi tải trang thì hoạt động**, chỉ hỏng
sau khi đã có ít nhất một lần render lại.

### Nguyên nhân

Code sai của tôi trong `ganProps`:

```js
for (const k in moi) {
  const v = moi[k];
  if (cu[k] === v) continue;
  if (k.startsWith('on')) {
    el.addEventListener(k.slice(2).toLowerCase(), v, { signal });   // ⚠ SAI
  }
```

Handler trong vnode là **hàm mới mỗi lần render**:

```js
h('input', { type: 'checkbox', checked: v.xong, onChange: () => doiXong(v.id) })
//                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ hàm mới mỗi lượt
```

Nên `cu.onChange === moi.onChange` **luôn** là `false`, và mỗi lần render tôi lại
`addEventListener` thêm một cái nữa. Sau `n` lần render có `n` listener.

Đó là lý do triệu chứng kỳ lạ: mỗi lần click, **cả `n` handler đều chạy**, mỗi cái toggle một
lần. Với `n` chẵn, toggle chẵn lần → trạng thái về đúng chỗ cũ → **trông như không có gì xảy
ra**.

Kiểm chứng bằng cách đếm listener:

| Số lần render trước khi click | Số listener | Số lần toggle | Kết quả |
|---|---|---|---|
| 0 (vừa tải trang) | 1 | 1 | ✅ đổi được |
| 1 | 2 | 2 | ❌ không đổi |
| 2 | 3 | 3 | ✅ đổi được |

Bug "hoạt động một nửa số lần" — loại khó tìm nhất.

Nó cũng là **rò rỉ bộ nhớ**, đúng kiểu 4 ở [bài 08](./08-bo-nho-va-ro-ri.md): mỗi listener giữ
một closure giữ `v`, giữ cả object việc cần làm.

### Cách sửa

`removeEventListener` handler cũ rồi thêm mới thì được, nhưng phải lưu handler cũ ở đâu đó —
và vẫn tốn hai thao tác DOM mỗi render. Cách tốt hơn: gắn **một dispatcher ổn định** cho mỗi
cặp (element, sự kiện), rồi để nó tra handler hiện tại trong `WeakMap`.

```js
const handlerCuaEl = new WeakMap();   // el -> { click: fn, change: fn, ... }

function datHandler(el, tenSuKien, fn, signal) {
  let bang = handlerCuaEl.get(el);
  if (!bang) { bang = {}; handlerCuaEl.set(el, bang) }
  const laMoi = !(tenSuKien in bang);
  bang[tenSuKien] = fn;                       // render lại chỉ THAY giá trị trong map
  if (laMoi) {
    el.addEventListener(tenSuKien, (e) => handlerCuaEl.get(el)?.[tenSuKien]?.(e), { signal });
  }
}
```

Ba lý do dùng `WeakMap` chứ không phải `el._handlers = {}`:

1. **Không làm bẩn DOM node** bằng thuộc tính lạ.
2. **Node bị xoá thì bảng handler tự biến mất** — không rò rỉ. Với `Map` thì mọi node từng
   render sẽ sống mãi ([bài 08](./08-bo-nho-va-ro-ri.md) mục 3: `Map` 103.9 MB so với `WeakMap`
   7.3 MB).
3. Dispatcher gắn **một lần duy nhất** cho mỗi loại sự kiện — số listener không phụ thuộc số
   lần render.

Sau khi sửa:

```
=== 3. Đổi checkbox ===
  title: 2 việc chưa xong | class li[1]: xong
```

### Bài học rút ra

Đây là cùng một bug với bẫy `bind` ở [bài 08](./08-bo-nho-va-ro-ri.md) mục 5
(`removeEventListener('click', f.bind(this))` không gỡ được gì), chỉ khác vỏ ngoài. Gốc rễ ở
cả hai là: **hàm mới mỗi lần gọi thì không so bằng `===` được.**

Mỗi khi bạn thấy `addEventListener` với một hàm được tạo tại chỗ, hãy hỏi: *đoạn code này có
thể chạy hai lần không?*

---

## 6. Keyed diff: chứng minh nó **di chuyển** node, không tạo lại

Đây là điểm khác biệt duy nhất giữa "render lại toàn bộ" và một framework thật.

```js
const mapCu = new Map(conCu.map((v, i) => [v.props.key, { v, el: cha.childNodes[i] }]));
let moc = null;                                    // node đứng sau vị trí đang chèn

for (let i = conMoi.length - 1; i >= 0; i--) {     // ⚠ duyệt NGƯỢC
  const vMoi = conMoi[i];
  const cuCungKey = mapCu.get(vMoi.props.key);
  let el;
  if (cuCungKey && cuCungKey.v.loai === vMoi.loai) {
    el = cuCungKey.el;                             // DÙNG LẠI node cũ
    ganProps(el, cuCungKey.v.props, vMoi.props, signal);
    patchCon(el, cuCungKey.v.con, vMoi.con, signal);
  } else {
    el = taoNode(vMoi, signal);
  }
  if (el.nextSibling !== moc || el.parentNode !== cha) cha.insertBefore(el, moc);
  moc = el;
}
```

Duyệt **ngược** vì `insertBefore` cần biết node đứng **sau**. Đi từ cuối lên thì node đó luôn là
cái ta vừa xử lý.

### Kiểm chứng: đánh dấu từng DOM node thật rồi đảo thứ tự

```js
// Đánh dấu từng <li> ĐANG có trong DOM
[...document.querySelectorAll('li')].forEach((l, i) => l.dataset.dauVet = 'node' + i);
// Bấm "Đảo thứ tự" -> đọc lại xem dấu vết còn không
```

```
trước: Đọc bài 15, Tự viết signal(), Hiểu keyed diff, Viec moi
sau  : Viec moi[node3], Hiểu keyed diff[node2], Tự viết signal()[node1], Đọc bài 15[node0]
-> mỗi node có giữ dấu vết cũ? true  (DI CHUYỂN node, không tạo lại)
```

`data-dauVet` là thuộc tính tôi gắn **sau** khi render, framework không biết gì về nó. Nó vẫn
còn nguyên và **đi theo đúng nội dung** — chứng minh node thật đã được di chuyển.

Nếu keyed diff hỏng, mọi `dauVet` sẽ là `undefined` (node mới tinh) hoặc thứ tự sẽ là
`node0, node1, node2, node3` (nội dung bị ghi lại lên node cũ).

### Vì sao điều này quan trọng — hệ quả thật

```
=== 6. Giữ focus của input khi danh sách đổi thứ tự ===
  value còn lại: "đang gõ dở"
```

Nếu render lại toàn bộ, `<input>` bị thay và người dùng **mất chữ đang gõ**. Đây chính là lý do
React cảnh báo `Warning: Each child in a list should have a unique "key" prop` — không có key,
nó phải so theo vị trí và bạn mất trạng thái DOM.

⚠️ Và đây là lý do **không được dùng chỉ số mảng làm key**:

```js
h('li', { key: i }, ...)         // ❌ đảo thứ tự -> key 0 vẫn là 0, node không di chuyển
h('li', { key: v.id }, ...)      // ✅
```

Với `key: i`, mọi phép so đều "khớp" nên framework chỉ ghi nội dung mới lên node cũ — bạn mất
đúng những gì keyed diff sinh ra để cứu.

---

## 7. Router: Navigation API và bản dự phòng

Chrome 152 có Navigation API ([bài 10](./10-js-hien-dai-2026.md)), Node/Safari thì chưa. Nên:

```js
if (globalThis.navigation) {
  navigation.addEventListener('navigate', (e) => {
    if (!e.canIntercept || e.hashChange || e.downloadRequest !== null) return;
    const url = new URL(e.destination.url);
    if (url.origin !== location.origin) return;
    e.intercept({ handler: async () => { duongDan.value = url.pathname } });
  }, { signal: ac.signal });
} else {
  addEventListener('popstate', () => { duongDan.value = location.pathname }, { signal: ac.signal });
  addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/"]');           // delegation — bài 11 mục 3
    if (!a || a.target || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    history.pushState({}, '', a.href);
    duongDan.value = new URL(a.href).pathname;
  }, { signal: ac.signal });
}
```

Bản Navigation API ngắn hơn và bắt được **cả** click vào `<a>` **và** nút back trong một
listener. Bản dự phòng cần hai listener và phải tự lọc bốn trường hợp: link ngoài site,
`target="_blank"`, Cmd/Ctrl-click (mở tab mới), và tải file.

Điều làm router "reactive" chỉ là một dòng: `duongDan` là **signal**. Mọi effect đọc nó tự chạy
lại khi điều hướng. Không cần hệ thống thông báo riêng.

```
=== 7. Router ===
  URL: /viec/1 | h1: Đọc bài 15
  sau back -> URL: / | số li: 4
```

Nút back hoạt động, và state của danh sách (4 việc, đã thêm 1) **vẫn còn** — vì nó nằm trong
signal, không nằm trong DOM.

---

## 8. Kết quả

```
$ node test/reactive.test.js
reactive.js
  ✅ effect chạy ngay một lần
  ✅ nhiều lần ghi trong cùng lượt đồng bộ -> MỘT lần chạy lại
  ✅ ghi lại cùng giá trị -> không chạy lại
  ✅ Object.is: NaN không kích hoạt chạy lại, -0 thì có
  ✅ phụ thuộc theo nhánh: đổi biến ở nhánh không chạy -> không chạy lại
  ✅ hàm dừng gỡ hết phụ thuộc
  ✅ computed cập nhật theo nguồn
  ✅ effect lồng nhau không làm lẫn phụ thuộc
  ✅ khongTheoDoi không đăng ký phụ thuộc
  ✅ effect ném lỗi vẫn để ngăn xếp sạch

10/10 test đạt
```

```
=== Kiểm chứng trong Chrome 152 ===
1. Render ban đầu    : 3 li, title "2 việc chưa xong"
2. Thêm việc         : 4 li, title "3 việc chưa xong"
3. Đổi checkbox      : title "2 việc chưa xong", class="xong"
4. Lọc "chưa"        : 2 li  |  "tất cả": 4 li
5. Keyed diff        : node được DI CHUYỂN, giữ nguyên dấu vết
6. Giữ focus/value   : "đang gõ dở" còn nguyên sau khi đảo danh sách
7. Router + back     : /viec/1 -> back về / , state còn nguyên
8. Lỗi trên trang    : (không có lỗi nào)
```

Tổng: **267 dòng** cho `reactive.js` + `dom.js` + `router.js`.

---

## 9. Những gì framework thật có mà cái này không

Để bạn biết mình đang thiếu gì, và vì sao Vue nặng hơn 300 dòng:

| Thiếu | Vì sao framework thật cần |
|---|---|
| `computed` có cache lười | Bản này tính lại **ngay** khi nguồn đổi, kể cả khi không ai đọc. Vue chỉ tính khi có người đọc. |
| Vòng đời component | `onMounted`/`onUnmounted`, và cây component (bản này chỉ có một effect gốc) |
| Reactive object sâu | `signal` chỉ theo dõi phép gán `.value`. Vue dùng `Proxy` để theo dõi `state.a.b.c = 1` |
| Xử lý lỗi | Lỗi trong một effect không được để đổ cả cây |
| SSR / hydrate | |
| Phát hiện vòng lặp | `effect(() => a.value = a.value + 1)` sẽ chạy vô hạn ở bản này |

Ba việc đáng làm tiếp, theo thứ tự khó tăng dần:

1. **`computed` lười** — thêm cờ `banThiu`; chỉ tính lại trong getter khi cờ bật.
2. **Phát hiện vòng lặp** — đếm số lần chạy lại trong một đợt flush, vượt 100 thì ném lỗi kèm
   tên effect.
3. **`reactive(obj)` bằng `Proxy`** — dùng đúng những gì đã học ở
   [bài 04](./04-object-descriptor-proxy.md): `Reflect` với receiver, `WeakMap` map hai chiều
   target ↔ proxy, và xử lý riêng cho `Map`/`Set` (nhớ `TypeError: Method Map.prototype.get
   called on incompatible receiver`).

---

## 10. Bài tập

### Bài 1 — Thêm cache lười cho `computed`

Bản hiện tại tính lại ngay khi nguồn đổi. Sửa để nó chỉ tính khi có người **đọc**
`.value`. Chứng minh bằng cách đếm số lần hàm tính được gọi.

<details><summary>Gợi ý đáp án</summary>

```js
export function computed(fn) {
  let giaTri, banThiu = true;
  const nguoiTheoDoi = new Set();

  // Effect này KHÔNG tính lại — nó chỉ bật cờ và thông báo lên trên.
  const chay = () => {
    if (banThiu) return;                 // đã thiu rồi thì không cần báo nữa
    banThiu = true;
    for (const e of [...nguoiTheoDoi]) henLich(e);
  };
  chay.phuThuoc = new Set();
  chay.daHuy = false;

  return {
    get value() {
      // Đăng ký người đang đọc computed này
      const hienTai = nganXep[nganXep.length - 1];
      if (hienTai) { nguoiTheoDoi.add(hienTai); hienTai.phuThuoc.add(nguoiTheoDoi) }

      if (banThiu) {
        donPhuThuoc(chay);
        nganXep.push(chay);
        try { giaTri = fn() } finally { nganXep.pop() }
        banThiu = false;
      }
      return giaTri;
    },
  };
}
```

Kiểm chứng:

```js
const a = signal(1);
let soLanTinh = 0;
const c = computed(() => { soLanTinh++; return a.value * 2 });

console.log('sau khi tạo, chưa đọc:', soLanTinh);        // 0  (bản cũ: 1)
console.log('đọc lần 1:', c.value, '| số lần tính:', soLanTinh);   // 2 | 1
console.log('đọc lần 2:', c.value, '| số lần tính:', soLanTinh);   // 2 | 1  ← có cache
a.value = 5;
console.log('sau khi đổi nguồn, chưa đọc:', soLanTinh);  // 1  ← chưa tính lại
console.log('đọc lại:', c.value, '| số lần tính:', soLanTinh);     // 10 | 2
```

Điểm quan trọng: dòng `if (banThiu) return` ở đầu `chay`. Không có nó, ghi vào nguồn 100 lần sẽ
thông báo lên 100 lần dù giá trị vẫn chưa được tính lại một lần nào.

Đánh đổi bạn vừa nhận: `computed` giờ **không** chạy trong lúc gán mà chạy trong lúc **đọc**.
Nếu `fn` có side effect (nó không nên có), thời điểm chạy thay đổi hoàn toàn.

</details>

### Bài 2 — Phát hiện vòng lặp vô hạn

`effect(() => a.value = a.value + 1)` hiện chạy vô hạn và treo tab. Thêm cơ chế phát hiện, ném
lỗi rõ ràng.

<details><summary>Gợi ý đáp án</summary>

```js
const MAX_DOT = 100;

function henLich(fn) {
  choChay.add(fn);
  if (daHenLich) return;
  daHenLich = true;
  queueMicrotask(() => {
    daHenLich = false;
    let dot = 0;
    // Vòng lặp: chạy tới khi hàng đợi rỗng, nhưng đếm số ĐỢT
    while (choChay.size) {
      if (++dot > MAX_DOT) {
        const ten = [...choChay].map(f => f.ten ?? '(không tên)').join(', ');
        choChay.clear();
        throw new Error(
          `Vòng lặp effect vô hạn: chạy ${MAX_DOT} đợt mà hàng đợi chưa rỗng.\n` +
          `Effect nghi vấn: ${ten}\n` +
          `Thường là do một effect GHI vào signal mà chính nó ĐỌC.`);
      }
      const batch = [...choChay];
      choChay.clear();
      for (const f of batch) f();
    }
  });
}
```

Và đặt tên cho effect để thông báo có ích:

```js
export function effect(fn, ten = fn.name || undefined) {
  const chay = () => { ... };
  chay.ten = ten;
  ...
}
```

Thử:

```js
const a = signal(0);
effect(function tangA() { a.value = a.value + 1 });
```

```
Error: Vòng lặp effect vô hạn: chạy 100 đợt mà hàng đợi chưa rỗng.
Effect nghi vấn: tangA
Thường là do một effect GHI vào signal mà chính nó ĐỌC.
```

Chú ý đây là ví dụ trực tiếp của bài 06 mục 4: **microtask đẻ ra microtask** thì event loop
không bao giờ sang được bước tiếp. Không có cơ chế này, tab đơ hoàn toàn và DevTools không chỉ
được vào đâu.

Vì sao đếm **đợt** chứ không đếm số lần chạy: một app thật có thể có 500 effect chạy trong một
đợt hợp lệ. Nhưng 100 **đợt** liên tiếp mà hàng đợi chưa rỗng thì gần như chắc chắn là vòng lặp.

</details>

### Bài 3 — `reactive(obj)` bằng `Proxy`

Viết `reactive(obj)` để `state.a = 1` tự kích hoạt effect, không cần `.value`. Xử lý cả object
lồng nhau.

<details><summary>Gợi ý đáp án</summary>

```js
const mapProxy = new WeakMap();        // target -> proxy  (bài 08: WeakMap, không Map)
const mapTarget = new WeakMap();       // proxy  -> target
const sigCuaKhoa = new WeakMap();      // target -> Map<key, signal>

export function reactive(obj) {
  if (mapTarget.has(obj)) return obj;             // đã là proxy rồi
  if (mapProxy.has(obj)) return mapProxy.get(obj); // ⚠ cùng target -> CÙNG một proxy
  if (obj === null || typeof obj !== 'object') return obj;

  const lay = (t, k) => {
    let m = sigCuaKhoa.get(t);
    if (!m) { m = new Map(); sigCuaKhoa.set(t, m) }
    if (!m.has(k)) m.set(k, signal(t[k]));
    return m.get(k);
  };

  const proxy = new Proxy(obj, {
    get(t, k, r) {
      if (typeof k === 'symbol') return Reflect.get(t, k, r);   // bài 04: đừng đụng Symbol
      lay(t, k).value;                              // đăng ký phụ thuộc
      const v = Reflect.get(t, k, r);               // Reflect + receiver, KHÔNG t[k]
      return (v && typeof v === 'object') ? reactive(v) : v;    // lồng nhau
    },
    set(t, k, v, r) {
      const cu = t[k];
      const kq = Reflect.set(t, k, v, r);
      if (!Object.is(cu, v)) lay(t, k).value = v;    // kích hoạt
      return kq;
    },
    deleteProperty(t, k) {
      const co = k in t;
      const kq = Reflect.deleteProperty(t, k);
      if (co) lay(t, k).value = undefined;
      return kq;
    },
  });

  mapProxy.set(obj, proxy);
  mapTarget.set(proxy, obj);
  return proxy;
}
```

Năm chi tiết bắt buộc, mỗi cái là một bug nếu thiếu:

1. **`mapProxy` để cùng target luôn cho cùng proxy.** Không có nó,
   `reactive(o) === reactive(o)` là `false` ([bài 04](./04-object-descriptor-proxy.md) mục 5),
   và `Set`/`includes` hỏng hết.
2. **`WeakMap` chứ không `Map`** — nếu không, mọi object từng đi qua `reactive()` sẽ sống mãi
   (bài 08: 103.9 MB so với 7.3 MB).
3. **Bỏ qua `typeof k === 'symbol'`** — nếu không, `await state` sẽ hỏi `state.then` và bạn tạo
   signal cho nó; `for...of` hỏi `Symbol.iterator`; `JSON.stringify` hỏi `toJSON`.
4. **`Reflect.get(t, k, r)` với receiver**, không phải `t[k]` — getter trong object phải chạy
   với `this` đúng (bài 04 mục 4).
5. **`Object.is`** chứ không `!==`.

Còn hai thứ bản này **vẫn thiếu**, đáng biết:

- **`Map`/`Set` không chạy.** `reactive(new Map())` sẽ ném
  `TypeError: Method Map.prototype.get called on incompatible receiver` (bài 04 mục 5). Phải
  bind method về target thật.
- **Thêm khoá mới không kích hoạt vòng lặp đọc `Object.keys`.** Cần trap `ownKeys` và một
  signal riêng cho "danh sách khoá". Đây là lý do Vue 2 không phát hiện được thuộc tính mới và
  phải có `Vue.set()`.

Chi phí: đo ở [bài 04](./04-object-descriptor-proxy.md) mục 6, đọc qua `Proxy` **đắt gấp 4.2
lần** so với đọc thường (40.14 so với 9.52 ms cho 1 triệu lần đọc). Đó là lý do Solid và bản
`signal` ở dự án này chọn `.value` tường minh thay vì `Proxy` — nhanh hơn, đổi lại cú pháp
kém gọn.

</details>

---

**Tiếp theo:** [Bài 16 — 32 lỗi thường gặp](./16-loi-thuong-gap.md)
