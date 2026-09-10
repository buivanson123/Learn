# Bài 03 — Kiểu dữ liệu và so sánh

> Bài này là danh sách những chỗ JavaScript trả lời khác với trực giác của bạn — kèm output
> thật, để lần sau gặp bạn nhận ra ngay thay vì ngồi `console.log` mò.

---

## 1. Số: JavaScript chỉ có `double`

Mọi số (trừ `BigInt`) là số thực dấu phẩy động 64 bit theo IEEE 754. Không có kiểu integer.

```
0.1+0.2                 = 0.30000000000000004
0.1+0.2 === 0.3         ? false
0.1+0.2-0.3             = 5.551115123125783e-17
Number.EPSILON          = 2.220446049250313e-16
0.57*100                = 56.99999999999999
Math.round(0.57*100)    = 57
(1.005).toFixed(2)      = "1.00"          ← không phải "1.01"
9007199254740992 === 9007199254740993     ? true
```

Bốn dòng đáng chú ý:

**`(1.005).toFixed(2)` cho `"1.00"`.** Vì `1.005` lưu trong máy thật ra là
`1.00499999999999989...`, làm tròn xuống là đúng. Đây là lý do **không bao giờ tính tiền bằng
`Number`**.

**`9007199254740992 === 9007199254740993` là `true`.** Trên `Number.MAX_SAFE_INTEGER`
(9 007 199 254 740 991), hai số nguyên khác nhau có thể cho cùng một biểu diễn. Nếu backend trả
ID kiểu `int64` (Twitter, Discord, nhiều hệ Java), `JSON.parse` sẽ **âm thầm làm hỏng ID**:

```js
JSON.parse('{"id": 9007199254740993}').id
// -> 9007199254740992      ← sai 1 đơn vị, không có cảnh báo nào
```

Cách xử lý: bắt backend trả ID dạng **chuỗi**, hoặc dùng reviver + `BigInt`.

### Tính tiền thế nào cho đúng

Quy về đơn vị nhỏ nhất, dùng số nguyên:

```js
const xu = Math.round(gia * 100);        // lưu 12345 thay vì 123.45
```

Hoặc dùng `BigInt` nếu số quá lớn. So sánh số thực thì so bằng sai số:

```js
const gan = (a, b) => Math.abs(a - b) < Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
gan(0.1 + 0.2, 0.3)   // -> true
```

---

## 2. `NaN`, `-0`, và bốn phép so sánh

```
typeof NaN            : number
NaN === NaN           : false
Object.is(NaN, NaN)   : true
[NaN].includes(NaN)   : true
[NaN].indexOf(NaN)    : -1
0 === -0              : true
Object.is(0, -0)      : false
```

Bảng bốn thuật toán so sánh của JavaScript:

| Thuật toán | Dùng ở | `NaN` vs `NaN` | `0` vs `-0` |
|---|---|---|---|
| Loose (`==`) | `==` | false | true |
| Strict (`===`) | `===`, `indexOf`, `switch` | false | true |
| SameValueZero | `includes`, `Map`, `Set`, `has` | **true** | true |
| SameValue | `Object.is` | **true** | **false** |

Đó là lý do `includes` tìm được `NaN` còn `indexOf` thì không — chúng dùng hai thuật toán
khác nhau. Không phải bug, là thiết kế.

`-0` xuất hiện tự nhiên hơn bạn tưởng: `-1 * 0`, `Math.round(-0.2)`, `0 / -5`. Nếu nó lọt vào
key của `Map` thì `Map` coi `0` và `-0` là **một**.

---

## 3. `==` — bảng đầy đủ của những trường hợp gây sốc

```
0 == "0"                  -> true
0 == false                -> true
0 == ""                   -> true
0 == []                   -> true
0 == null                 -> false      ← chú ý
null == undefined         -> true
[] == false               -> true
[] == ""                  -> true
[1] == 1                  -> true
[1,2] == "1,2"            -> true
"" == false               -> true
{} == "[object Object]"   -> true
null >= 0                 -> true       ← nhưng…
null > 0                  -> false
null == 0                 -> false
```

Ba dòng cuối là ví dụ đẹp nhất về việc `==` và `>=` chạy **hai thuật toán khác nhau**:

- `null == 0` dùng luật riêng: `null` chỉ `==` với `null` và `undefined`. → `false`.
- `null >= 0` là phép so sánh quan hệ, nó chuyển `null` thành số → `Number(null) === 0`, và
  `0 >= 0` → `true`.

Nên `null` vừa "không bằng 0" vừa "lớn hơn hoặc bằng 0". Không có cách nào làm cho điều đó
hợp lý; chỉ cần **không dùng `==`**.

Ngoại lệ duy nhất đáng dùng: `x == null` để bắt cả `null` và `undefined` trong một phép so:

```js
if (x == null) ...        // tương đương x === null || x === undefined
```

---

## 4. Ép kiểu: `[] + {}` và bạn bè

Object thành primitive đi qua `Symbol.toPrimitive` → `valueOf` → `toString`. Với `+` thì
"hint" là `default`, nên `valueOf` chạy trước:

```js
console.log([] + {});          // "[object Object]"
console.log([] + []);          // ""
console.log([1,2] + [3]);      // "1,23"
console.log({} + []);          // "[object Object]"  (khi là biểu thức)
```

Kiểm soát được nếu muốn:

```js
const tien = {
  xu: 12345,
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return this.xu;
    if (hint === 'string') return (this.xu / 100).toFixed(2) + ' đ';
    return `Tiền(${this.xu})`;
  },
};
console.log(+tien, `${tien}`, tien + '');
```

```
12345 123.45 đ Tiền(12345)
```

Ba hint: `number` (`+x`, `x - 1`), `string` (template literal, `String(x)`), `default`
(`x + y`, `x == y`).

---

## 5. Sắp xếp: bốn điều cần nhớ

```
[1,5,10].sort()                    -> [ 1, 10, 5 ]
[1,5,10].sort((a,b) => a-b)        -> [ 1, 5, 10 ]
```

`sort()` không comparator **chuyển mọi phần tử thành chuỗi** rồi so theo mã ký tự. `"10" <
"5"` vì `"1" < "5"`.

**Ổn định** — từ ES2019 đặc tả bắt buộc, V8 dùng TimSort:

```js
[{k:'a',i:0},{k:'a',i:1},{k:'b',i:2},{k:'a',i:3}].sort((x,y) => x.k < y.k ? -1 : x.k > y.k ? 1 : 0)
```

```
a0 a1 a3 b2        ← thứ tự tương đối của các phần tử bằng nhau được giữ nguyên
```

**`sort()` sửa mảng gốc**, `toSorted()` thì không:

```
a = [3,1] ; b = a.toSorted()   ->   a = 3,1   b = 1,3
```

**`undefined` và lỗ trống luôn bị đẩy xuống cuối**, comparator không được gọi cho chúng:

```
[3, undefined, 1, , 2].sort((a,b) => a-b)
-> [ 1, 2, 3, undefined, <1 empty item> ]
```

### Sắp xếp tiếng Việt

```
['ă','a','â','b'].sort()                              -> "abâă"     ← theo mã Unicode
['ă','a','â','b'].sort((a,b) => a.localeCompare(b,'vi'))  -> "aăâb"  ← theo thứ tự tiếng Việt
```

`sort()` mặc định xếp `â` và `ă` **sau cả `b`** vì chúng có mã Unicode lớn hơn. Danh sách tên
người Việt sắp bằng `sort()` sẽ sai. Luôn dùng `localeCompare(x, 'vi')`, hoặc
`Intl.Collator('vi')` nếu sắp mảng lớn — nó tạo bộ so sánh một lần thay vì mỗi cặp:

```js
const cmp = new Intl.Collator('vi').compare;
ten.sort(cmp);
```

---

## 6. JSON: nó vứt mất những gì

```js
JSON.stringify({
  u: undefined, f() {}, s: Symbol('x'), n: NaN, inf: Infinity,
  d: new Date('2026-09-09T00:00:00Z'), m: new Map([[1,2]]), st: new Set([1]),
  r: /ab/g, nul: null, neg: -0,
})
```

```
{"n":null,"inf":null,"d":"2026-09-09T00:00:00.000Z","m":{},"st":{},"r":{},"nul":null,"neg":0}
```

Đọc bảng này thật kỹ, vì mỗi dòng là một bug đã từng xảy ra ở đâu đó:

| Giá trị vào | JSON ra | Hậu quả |
|---|---|---|
| `undefined` | **key biến mất** | phân biệt "không gửi" với "gửi null" là bất khả |
| hàm | **key biến mất** | |
| `Symbol` | **key biến mất** | |
| `NaN`, `Infinity` | `null` | số hỏng thành null, không lỗi |
| `Date` | chuỗi ISO | `JSON.parse` trả lại **chuỗi**, không phải `Date` |
| `Map`, `Set` | `{}` | **mất sạch dữ liệu**, không cảnh báo |
| `RegExp` | `{}` | |
| `-0` | `0` | |
| `BigInt` | **ném lỗi** | `TypeError: Do not know how to serialize a BigInt` |
| vòng lặp | **ném lỗi** | `TypeError: Converting circular structure to JSON` |

Chỗ nguy hiểm nhất là `Map` → `{}`: bạn gửi đi một object rỗng và không có gì báo cho bạn biết.

`toJSON()` cho phép tự quyết định:

```js
JSON.stringify({ a: { toJSON() { return 'THAY THẾ' } } })   // -> {"a":"THAY THẾ"}
```

`Date` chạy được là nhờ `Date.prototype.toJSON` có sẵn.

---

## 7. `structuredClone` — deep clone đúng cách

`JSON.parse(JSON.stringify(x))` là cách clone tệ nhất còn được dùng phổ biến, vì nó mang theo
đúng bảng mất mát ở trên. Từ Node 17 / Chrome 98 đã có `structuredClone`:

```js
const src = { d: new Date(0), m: new Map([['k',{v:1}]]), s: new Set([1]), r: /ab/g,
              u: undefined, nan: NaN, buf: new Uint8Array([1,2]) };
src.self = src;                   // vòng lặp
const sc = structuredClone(src);
```

```
Date=true | Map=true | Set=true | RegExp=true | NaN=NaN | vòng lặp=true | có key `u`? true
```

Giữ được hết, kể cả tham chiếu vòng. Giới hạn duy nhất:

```js
structuredClone({ f() {} })
// DOMException: f(){} could not be cloned.
```

Không clone được **hàm**, `Symbol`, DOM node, và object có prototype tuỳ chỉnh (nó clone dữ
liệu nhưng trả về object thường, mất class).

| Cần gì | Dùng |
|---|---|
| Dữ liệu thuần, có `Date`/`Map`/`Set`/vòng lặp | `structuredClone` |
| Có hàm, class, `Symbol` | tự viết, hoặc `lodash.cloneDeep` |
| Chỉ 1 tầng | `{ ...x }` / `structuredClone` đều được |

---

## 8. `Symbol` dùng để làm gì thật sự

Không phải "hằng số không trùng nhau" — đó là công dụng phụ. Công dụng chính: **thêm thuộc
tính vào object của người khác mà chắc chắn không đụng ai**.

```js
const NGUON = Symbol('nguon');
function danhDau(o) { o[NGUON] = 'api-v2'; return o; }

const u = danhDau({ id: 1, nguon: 'người dùng nhập' });
console.log(Object.keys(u), JSON.stringify(u), u[NGUON]);
```

```
[ 'id', 'nguon' ] {"id":1,"nguon":"người dùng nhập"} api-v2
```

Key `Symbol` **không** lọt vào `Object.keys`, `JSON.stringify`, `for...in`, và không xung đột
với key `'nguon'` sẵn có. Đó là lý do đặc tả dùng chúng cho các "hook" ngôn ngữ:
`Symbol.iterator`, `Symbol.toPrimitive`, `Symbol.asyncIterator`, `Symbol.hasInstance`.

Muốn thấy chúng thì dùng `Reflect.ownKeys` hoặc `Object.getOwnPropertySymbols`.

---

## 9. Bài tập

### Bài 1 — Ba dòng, ba kết quả

Không chạy code, dự đoán:

```js
console.log([10, 9, 1, 100].sort());
console.log([10, 9, 1, 100].sort((a, b) => a > b));
console.log([10, 9, 1, 100].toSorted((a, b) => a - b));
```

<details><summary>Gợi ý đáp án</summary>

```
[ 1, 10, 100, 9 ]
[ 10, 9, 1, 100 ]
[ 1, 9, 10, 100 ]
```

Dòng 1 — so theo chuỗi.

Dòng 2 là bẫy hay gặp: comparator trả về `true`/`false`, nhưng đặc tả cần **số âm / 0 /
dương**. `Number(true) === 1`, `Number(false) === 0` — không bao giờ trả số âm, nên TimSort
không có thông tin để đảo chỗ. Mảng gần như giữ nguyên. Đây là loại bug im lặng: nó chạy,
không lỗi, chỉ là không sắp xếp.

Dòng 3 — đúng, và không đụng vào mảng gốc.

</details>

### Bài 2 — Cứu ID bị hỏng

Backend trả `{"id": 9007199254740993, "ten": "A"}`. Sau `JSON.parse`, `id` sai 1 đơn vị.
Sửa **ở phía frontend** mà không đổi backend.

<details><summary>Gợi ý đáp án</summary>

`JSON.parse` có tham số thứ hai là `reviver`, và từ ES2023 reviver nhận thêm `context.source`
— chuỗi gốc chưa bị chuyển thành số:

```js
const json = '{"id": 9007199254740993, "ten": "A"}';
const o = JSON.parse(json, function (k, v, ctx) {
  if (k === 'id') return BigInt(ctx.source);
  return v;
});
console.log(o.id, typeof o.id);
```

```
9007199254740993n bigint
```

Kiểm chứng tính năng này có trên máy bạn không:

```
$ node -e "console.log(JSON.parse('1', (k,v,c)=>c?.source) )"
1
```

In ra `1` (chuỗi) nghĩa là có `context.source`; in `undefined` nghĩa là runtime quá cũ, khi
đó phải thay bằng cách thô: `json.replace(/"id":\s*(\d+)/, '"id":"$1"')` rồi parse.

Chú ý: `BigInt` không `JSON.stringify` được, nên khi gửi ngược lên server phải chuyển về
chuỗi.

</details>

### Bài 3 — Deep clone nào đúng

Cho object dưới, chọn cách clone và giải thích cái nào hỏng ở đâu:

```js
const state = {
  capNhat: new Date(),
  cache: new Map([['a', 1]]),
  loc: (x) => x > 0,
  soLuong: NaN,
};
```

<details><summary>Gợi ý đáp án</summary>

`JSON.parse(JSON.stringify(state))`:

```
{"capNhat":"1970-01-01T00:00:00.000Z",    ← Date thành chuỗi
 "cache":{},                               ← MẤT sạch dữ liệu
 "soLuong":null}                           ← NaN thành null; `loc` biến mất hẳn
```

`structuredClone(state)`:

```
DOMException: x=>x>0 could not be cloned.
```

Không cách nào có sẵn làm đúng, vì object này trộn **dữ liệu** với **hành vi**. Cách xử lý
đúng là tách chúng ra:

```js
const { loc, ...duLieu } = state;
const ban_sao = { ...structuredClone(duLieu), loc };   // hàm dùng chung, không cần clone
```

Bài học chung: nếu state của bạn không `structuredClone` được, đó thường là dấu hiệu state
đang chứa thứ không nên nằm trong state.

</details>

---

**Tiếp theo:** [Bài 04 — Descriptor, Proxy, Reflect](./04-object-descriptor-proxy.md)
