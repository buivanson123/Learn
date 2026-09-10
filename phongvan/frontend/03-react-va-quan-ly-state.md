# React và quản lý state — 16 câu

Ở mức senior, câu hỏi React ít khi là về API. Nó là về **mô hình tinh thần**: khi nào component
render lại, dữ liệu sống ở đâu, và vì sao tối ưu của bạn không có tác dụng.

Mọi con số dưới đây đo bằng React 19.3 (bản production) chạy trong Chromium, đếm số lần thân
component thực thi.

---

### 1. Component render lại khi nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi state của chính nó đổi, khi component cha render lại, khi context nó dùng đổi,
hoặc khi `useSyncExternalStore` báo có thay đổi. **Props đổi không phải là điều kiện** — cha render
thì con render, dù props y hệt.

**Giải thích sâu:** Đo thật. Các component con của một `App` có state:

```
Bấm nút setCount (state của App đổi) -> component nào chạy lại:
┌──────────────────────┬────────┐
│ App                  │ 1      │
│ con-thuong           │ 1      │   ← không memo: render lại theo cha
│ memo-nhan-ham-inline │ 1      │   ← CÓ memo nhưng vẫn render lại
│ ctx-consumer         │ 1      │
└──────────────────────┴────────┘
```

Hai component **vắng mặt** trong bảng — tức là không hề render lại:
- `con-memo`: bọc `memo`, nhận prop là chuỗi tĩnh.
- `memo-nhan-useCallback`: bọc `memo`, nhận hàm được bọc `useCallback`.

Còn `memo-nhan-ham-inline` thì bọc `memo` mà **vẫn render lại**, vì nó nhận `onClick={() => {}}` —
một hàm mới được tạo ở mỗi lần render của cha, nên phép so sánh nông của `memo` thấy prop đã đổi.

Đây là kết quả quan trọng nhất trong cả chương: **`memo` vô tác dụng nếu props chứa object, mảng
hoặc hàm được tạo mới mỗi lần render.** Rất nhiều `memo` trong code thật thuộc loại này — tốn thêm
một phép so sánh mà không ngăn được gì.

Điều cần nói tiếp: render lại **không** đồng nghĩa với cập nhật DOM. React so sánh cây kết quả và
chỉ đụng vào DOM ở chỗ thật sự khác. Một render lại "thừa" của component nhỏ thường rẻ tới mức không
đo được — nên đừng tối ưu trước khi đo.

</details>

### 2. `React.memo` — khi nào dùng, khi nào là lãng phí?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Dùng khi component **đắt để render** và props **thật sự ổn định**. Lãng phí khi
component nhỏ, hoặc khi props đổi tham chiếu mỗi lần render — lúc đó bạn trả tiền so sánh mà không
được gì.

**Giải thích sâu:** Bằng chứng ở câu 1: cùng một component bọc `memo`, nhận hàm inline thì render
lại, nhận `useCallback` thì không.

Nên bọc `memo` khi thoả **cả ba**:
1. Component render tốn kém (danh sách lớn, biểu đồ, soạn thảo).
2. Nó render lại thường xuyên vì cha render.
3. Props của nó ổn định — hoặc bạn sẵn sàng làm cho chúng ổn định.

Nếu thiếu điều 3 thì `memo` chỉ là trang trí.

**Giải pháp thường tốt hơn `memo`: đổi cấu trúc component.** Cách phổ biến nhất là "đẩy state xuống"
hoặc "truyền children":

```jsx
// Trước: state ở trên -> mọi thứ render lại
function App(){
  const [text, setText] = useState('');
  return <><input value={text} onChange={e=>setText(e.target.value)} /><BangNang /></>;
}

// Sau: tách state vào component riêng -> BangNang không liên quan tới text nữa
function ONhap(){ const [text,setText]=useState(''); return <input value={text} onChange={...}/> }
function App(){ return <><ONhap /><BangNang /></> }
```

Cách này không cần `memo`, không cần `useCallback`, và ít code hơn. Nói được điều này ăn điểm cao
hơn nhiều so với việc liệt kê các API tối ưu.

Và ghi chú về tương lai gần: **React Compiler** tự động chèn memo hoá, làm phần lớn `useMemo`/
`useCallback`/`memo` viết tay trở nên không cần thiết. Biết tới nó và nói "em sẽ ưu tiên cấu trúc
đúng, còn memo hoá thủ công chỉ khi đã đo" là câu trả lời cập nhật.

</details>

### 3. `useMemo` và `useCallback` — khác nhau và khi nào thật sự cần?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `useMemo` nhớ **giá trị**, `useCallback` nhớ **hàm** (`useCallback(f, d)` chính là
`useMemo(() => f, d)`). Cả hai chỉ có ích khi kết quả được dùng làm prop cho component đã `memo`,
làm phụ thuộc của hook khác, hoặc khi phép tính thật sự đắt.

**Giải thích sâu:** Ba trường hợp cần thật, và ngoài ba trường hợp này thì thường là thừa:

```jsx
// 1. Giữ tham chiếu ổn định cho component đã memo  (đã chứng minh ở câu 1)
const onClick = useCallback(() => {...}, []);

// 2. Phụ thuộc của useEffect — nếu không, effect chạy lại mỗi render
const opts = useMemo(() => ({ id }), [id]);
useEffect(() => { taiDuLieu(opts) }, [opts]);

// 3. Phép tính thật sự đắt
const daSapXep = useMemo(() => duLieu.sort(soSanhPhucTap), [duLieu]);
```

Trường hợp 2 là chỗ hay gây bug nhất — quên nó thì effect chạy vô hạn, vì mỗi render tạo `opts` mới
→ effect chạy → setState → render → `opts` mới…

Cái giá của việc lạm dụng, phải nói ra để cho thấy bạn cân nhắc hai chiều:
- Mỗi hook lưu giá trị cũ và mảng phụ thuộc → tốn bộ nhớ.
- So sánh mảng phụ thuộc mỗi lần render cũng tốn thời gian.
- **Code khó đọc hơn**, và mảng phụ thuộc sai là nguồn bug âm thầm.

`useMemo(() => a + b, [a, b])` chắc chắn **chậm hơn** `a + b`. Đây là ví dụ nên dùng khi bị hỏi
"lạm dụng thì sao".

Ngoại lệ nên nhớ: `useMemo` còn dùng để giữ **danh tính của object**, không chỉ để tiết kiệm tính
toán. Ví dụ giá trị của context (xem câu 5) — ở đó chi phí tính toán bằng 0 nhưng danh tính ổn định
mới là thứ quan trọng.

</details>

### 4. `useEffect` — dùng sai như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Sai phổ biến nhất là dùng nó để **đồng bộ state với state** hoặc để **biến đổi dữ
liệu cho hiển thị**. `useEffect` sinh ra để đồng bộ với **hệ thống bên ngoài** React (mạng, DOM,
timer, thư viện ngoài).

**Giải thích sâu:** Ba mẫu sai, xếp theo tần suất:

```jsx
// SAI 1: tính toán dẫn xuất bằng effect
const [ho,setHo]=useState(''); const [ten,setTen]=useState('');
const [dayDu,setDayDu]=useState('');
useEffect(() => { setDayDu(ho+' '+ten) }, [ho,ten]);   // thừa một lần render, dễ lệch
// ĐÚNG:
const dayDu = ho + ' ' + ten;

// SAI 2: reset state khi prop đổi
useEffect(() => { setChon(null) }, [userId]);
// ĐÚNG: dùng key để React tự tạo lại component
<HoSo key={userId} userId={userId} />

// SAI 3: xử lý sự kiện bằng effect
useEffect(() => { if (daGui) hienThongBao() }, [daGui]);
// ĐÚNG: gọi thẳng trong hàm xử lý sự kiện
```

Nguyên tắc phân biệt, đáng nói nguyên văn ở phỏng vấn: **"Nếu việc này xảy ra vì người dùng làm gì
đó, nó thuộc về hàm xử lý sự kiện. Nếu nó xảy ra vì component đã hiển thị trên màn hình, nó mới
thuộc về effect."**

Sai lầm thứ tư, về mặt kỹ thuật: **thiếu hàm dọn dẹp**. Mọi thứ đăng ký đều phải huỷ — listener,
timer, observer, request đang bay (xem [01-javascript câu 15](./01-javascript-va-runtime.md)).

Và Strict Mode trong dev **cố tình chạy effect hai lần** để phơi bày effect thiếu dọn dẹp. Effect
viết đúng thì chạy hai lần vẫn cho kết quả đúng. Nếu bạn thấy request bị gửi đôi và muốn "tắt Strict
Mode đi cho đỡ phiền" thì đó là dấu hiệu effect đang thiếu `AbortController`.

</details>

### 5. Context gây render lại như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Mọi** component dùng `useContext` sẽ render lại khi giá trị context đổi **tham
chiếu** — kể cả khi phần dữ liệu nó dùng không đổi, và kể cả khi nó đã bọc `memo`.

**Giải thích sâu:** Đo với hai context, chỉ khác nhau ở chỗ có `useMemo` cho giá trị hay không:

```jsx
const vA = { count };                          // object mới mỗi lần render
const vB = useMemo(() => ({ count }), [count]); // chỉ đổi khi count đổi
```

Bấm nút làm đổi một state **khác** (`count` không đổi):

```
{ App: 1, 'dung-ctx-KHONG-memo-value': 1 }
```

Component dùng context B **hoàn toàn không xuất hiện** — nó không render lại. Component dùng context
A thì có, dù `count` không hề thay đổi, và dù nó đã được bọc `memo`.

Đây là bẫy context phổ biến nhất, và nó lan rộng: một `AppContext` chứa cả user, theme, giỏ hàng,
thông báo — mỗi lần bất cứ thứ gì trong đó đổi là **toàn bộ ứng dụng** render lại.

Ba cách xử lý:

```jsx
// 1. Luôn memo hoá giá trị context
const value = useMemo(() => ({ user, dangNhap, dangXuat }), [user]);

// 2. Tách context theo tần suất thay đổi
<ThemeContext>      {/* gần như không đổi */}
  <UserContext>     {/* đổi khi đăng nhập/đăng xuất */}
    <CartContext>   {/* đổi liên tục */}

// 3. Tách state và hàm cập nhật thành hai context
//    -> component chỉ gọi hàm dispatch sẽ KHÔNG render lại khi state đổi
```

Cách 3 rất hiệu quả và ít người biết: rất nhiều component chỉ cần `dispatch` chứ không cần đọc
state. Tách ra thì chúng hoàn toàn miễn nhiễm với thay đổi state.

Kết luận cần nói: **context là công cụ tiêm phụ thuộc (dependency injection), không phải thư viện
quản lý state.** Với state đổi thường xuyên và được dùng ở nhiều nơi, một store bên ngoài (Zustand,
Jotai, Redux) có cơ chế đăng ký theo từng phần dữ liệu — chỉ component đọc đúng phần đó mới render
lại.

</details>

### 6. Server state và client state khác nhau thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Client state là dữ liệu bạn **sở hữu** (form đang nhập, modal đang mở, bộ lọc).
Server state là **bản sao** của dữ liệu ở nơi khác — nó có thể cũ, cần đồng bộ lại, cần xử lý lỗi
và trạng thái đang tải. Hai thứ này cần công cụ khác nhau.

**Giải thích sâu:** Vì sao nhét server state vào Redux là sai lầm kiến trúc phổ biến nhất của React
những năm qua: bạn phải tự viết lại toàn bộ những thứ sau cho **mỗi** loại dữ liệu:

```
trạng thái đang tải, trạng thái lỗi, cache, vô hiệu hoá cache,
gọi lại khi cửa sổ được focus, gộp request trùng, retry,
cập nhật lạc quan, phân trang, tải thêm khi cuộn
```

TanStack Query / SWR / RTK Query giải quyết sẵn tất cả:

```jsx
const { data, isLoading, error } = useQuery({
  queryKey: ['user', id],
  queryFn: () => layUser(id),
  staleTime: 60_000,
});
```

Bảng phân chia nên nói ở phỏng vấn:

| Loại dữ liệu | Công cụ |
|---|---|
| Dữ liệu từ API | TanStack Query / SWR / RSC |
| State của một component | `useState` |
| State chia sẻ vài component gần nhau | nâng state lên component cha chung |
| State toàn cục của client (theme, sidebar) | Context, hoặc Zustand |
| State trong URL (bộ lọc, trang, tab đang mở) | **query string** — đừng để trong `useState` |

Dòng cuối đáng nhấn mạnh: bộ lọc và số trang thuộc về **URL**, không thuộc về state. Để trong URL
thì người dùng chia sẻ được link, nút back hoạt động đúng, và F5 không mất kết quả. Đây là chi tiết
mà người phỏng vấn giàu kinh nghiệm rất chú ý, vì nó cho thấy bạn nghĩ từ góc độ người dùng.

</details>

### 7. Cập nhật lạc quan (optimistic update) — làm thế nào cho đúng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cập nhật giao diện ngay lập tức, gọi API ở nền, và **hoàn tác nếu thất bại**. Phần
khó không phải là cập nhật, mà là hoàn tác đúng và xử lý nhiều thao tác chồng nhau.

**Giải thích sâu:** Ví dụ nút "thích":

```jsx
const mutation = useMutation({
  mutationFn: thich,
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['post', id] });  // 1. huỷ request đang bay
    const truoc = queryClient.getQueryData(['post', id]);          // 2. lưu lại để hoàn tác
    queryClient.setQueryData(['post', id], o => ({ ...o, liked: true, likes: o.likes+1 }));
    return { truoc };
  },
  onError: (_e, id, ctx) => queryClient.setQueryData(['post', id], ctx.truoc),  // 3. hoàn tác
  onSettled: (_d, _e, id) => queryClient.invalidateQueries({ queryKey: ['post', id] }), // 4. đồng bộ lại
});
```

Bước 1 là bước hay bị bỏ và gây bug khó hiểu: nếu có một request đọc đang bay, nó sẽ trả về **dữ
liệu cũ** sau khi bạn đã cập nhật lạc quan, ghi đè lên thay đổi của bạn. Người dùng thấy nút bật lên
rồi tự tắt đi.

Khi nào **không** nên dùng cập nhật lạc quan:
- Thao tác hay thất bại (thanh toán, đặt vé số lượng có hạn) — hoàn tác gây bối rối hơn là chờ.
- Kết quả phụ thuộc server (id do server sinh, giá do server tính).
- Thao tác không thể hoàn tác về mặt cảm nhận: đã hiện "Đã gửi email" rồi rút lại là mất niềm tin.

Câu hỏi tiếp hay gặp: **"nhiều thao tác chồng nhau thì sao?"** Người dùng bấm thích/bỏ thích 5 lần
thật nhanh. Cách xử lý: huỷ mutation cũ, hoặc xếp hàng tuần tự, hoặc chỉ giữ thao tác cuối cùng. Nếu
để chạy song song, thứ tự response về không xác định và trạng thái cuối có thể sai.

</details>

### 8. Stale closure trong hooks — nhận ra và sửa

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Callback tạo trong một lần render giữ **giá trị của lần render đó**. Nếu callback
sống lâu hơn (trong `setInterval`, trong listener, trong một promise), nó vẫn đọc giá trị cũ.

**Giải thích sâu:**

```jsx
const [count, setCount] = useState(0);
useEffect(() => {
  const t = setInterval(() => console.log(count), 1000);   // luôn in 0
  return () => clearInterval(t);
}, []);
```

Cùng bản chất với `[3,3,3]` của `var` trong vòng lặp
([01-javascript câu 3](./01-javascript-va-runtime.md)): closure giữ biến của lần render đầu, và
mảng phụ thuộc rỗng nghĩa là effect không bao giờ được tạo lại.

Ba cách sửa, mỗi cách hợp một tình huống:

```jsx
// 1. Dùng dạng hàm cập nhật — không cần đọc giá trị hiện tại
setCount(c => c + 1);

// 2. Khai báo đúng phụ thuộc — effect được tạo lại khi count đổi
useEffect(() => { const t = setInterval(() => console.log(count), 1000);
                  return () => clearInterval(t) }, [count]);

// 3. Ref giữ giá trị mới nhất — khi không muốn tạo lại effect
const ref = useRef(count);
useEffect(() => { ref.current = count });
useEffect(() => { const t = setInterval(() => console.log(ref.current), 1000);
                  return () => clearInterval(t) }, []);
```

Cách 1 là cách tốt nhất khi áp dụng được, vì nó xoá bỏ hoàn toàn nhu cầu đọc giá trị hiện tại.

Cách phòng ngừa quan trọng hơn cả ba cách sửa: **bật `eslint-plugin-react-hooks` và không bao giờ
tắt cảnh báo `exhaustive-deps`**. Gần như mọi stale closure đều bị quy tắc này bắt được. Khi thấy
mình muốn tắt nó, đó là dấu hiệu cần đổi cách viết chứ không phải cần tắt lint.

</details>

### 9. `key` trong danh sách — vì sao không dùng index?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `key` cho React biết phần tử nào là "cùng một phần tử" giữa hai lần render. Dùng
index thì khi danh sách bị chèn/xoá/sắp xếp lại, React ghép nhầm — state và DOM của dòng này dính
sang dòng khác.

**Giải thích sâu:** Ví dụ hỏng cụ thể:

```jsx
{items.map((it, i) => <Row key={i} item={it} />)}
```

Danh sách `[A, B, C]`, mỗi dòng có một ô `<input>` chưa được submit. Xoá A:

```
Trước: key=0 -> A (input: "xin chào")   Sau: key=0 -> B  ← React coi là "vẫn phần tử 0",
       key=1 -> B (input: "")                key=1 -> C     giữ nguyên DOM và state
       key=2 -> C (input: "")
```

Kết quả: chữ "xin chào" người dùng gõ cho A **nhảy sang B**. React không sai — bạn đã nói với nó
rằng "phần tử ở vị trí 0 vẫn là phần tử đó".

Các triệu chứng thường gặp của lỗi này: input giữ giá trị sai sau khi xoá dòng, checkbox tick nhầm
dòng, animation nhấp nháy, component không reset khi lẽ ra phải reset.

Khi nào index **chấp nhận được**: danh sách chỉ đọc, không bao giờ sắp xếp lại, không chèn/xoá ở
giữa, và các phần tử không có state riêng. Ví dụ hiển thị một mảng chuỗi tĩnh. Nhưng vì điều kiện
này dễ bị phá vỡ về sau, dùng id ổn định vẫn là mặc định đúng.

Hai điều liên quan đáng nói:
- **Đừng dùng `Math.random()` làm key.** Mỗi render ra key mới → React huỷ và tạo lại toàn bộ DOM →
  mất state, mất focus, và chậm hơn nhiều.
- **`key` cũng dùng để cố ý reset một component**: `<Form key={userId} />` khiến React tạo mới hoàn
  toàn khi `userId` đổi — cách sạch hơn nhiều so với một `useEffect` reset từng trường (xem câu 4).

</details>

### 10. Component controlled và uncontrolled

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Controlled: React giữ giá trị, mỗi lần gõ là một lần render. Uncontrolled: DOM giữ
giá trị, React chỉ đọc khi cần qua `ref`. Form lớn thường nên uncontrolled vì lý do hiệu năng.

**Giải thích sâu:**

```jsx
<input value={v} onChange={e => setV(e.target.value)} />   // controlled
<input defaultValue="a" ref={ref} />                        // uncontrolled
```

Đánh đổi:

| | Controlled | Uncontrolled |
|---|---|---|
| Validate ngay khi gõ | dễ | phải tự xử lý |
| Định dạng lúc gõ (số điện thoại, tiền) | dễ | khó |
| Số lần render | **mỗi ký tự** | 0 |
| Form 50 trường | có thể giật | mượt |

Đây là lý do `react-hook-form` phổ biến: nó dùng uncontrolled + `ref`, nên gõ vào một trường không
làm render lại cả form. Với form đăng ký 30 trường, khác biệt cảm nhận được rõ trên điện thoại.

Cảnh báo kinh điển phải biết:

```
Warning: A component is changing an uncontrolled input to be controlled.
```

Nguyên nhân: `value={data?.name}` với `data` ban đầu là `undefined` → input bắt đầu uncontrolled, rồi
khi dữ liệu về thì thành controlled. Sửa bằng `value={data?.name ?? ''}`. Nhận ra ngay nguyên nhân
của cảnh báo này là dấu hiệu đã làm nhiều.

</details>

### 11. Server Component khác Client Component thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Server Component chạy **chỉ trên server**, không gửi JavaScript của nó xuống trình
duyệt, và truy cập trực tiếp được database. Client Component chạy ở cả hai nơi và có state, effect,
sự kiện.

**Giải thích sâu:**

| | Server Component | Client Component |
|---|---|---|
| JS gửi xuống trình duyệt | **0 byte** | có |
| `useState`, `useEffect` | không | có |
| Bắt sự kiện (`onClick`) | không | có |
| Gọi thẳng database, đọc file | có | không |
| `async`/`await` trong thân component | có | không |

Lợi ích lớn nhất không phải tốc độ render mà là **kích thước bundle**: một component dùng thư viện
markdown 200 KB, nếu là Server Component thì 200 KB đó **không bao giờ** tới trình duyệt.

Quy tắc bố trí quan trọng nhất: **đẩy `'use client'` xuống càng sâu càng tốt**. Đặt nó ở layout gốc
là biến toàn bộ ứng dụng thành client và mất sạch lợi ích.

Mẫu hay dùng: Server Component lấy dữ liệu, truyền xuống Client Component chỉ để xử lý tương tác:

```jsx
// page.tsx — Server Component
export default async function Page() {
  const posts = await db.post.findMany();      // gọi thẳng DB, không cần API
  return <DanhSachTuongTac posts={posts} />;   // component này mới có 'use client'
}
```

Giới hạn phải biết: props truyền từ server sang client phải **serialize được** — không truyền được
hàm, `Date` thì được nhưng class instance thì không. Và Server Component không có state, nên mọi
thứ tương tác đều phải nằm ở một Client Component nào đó.

</details>

### 12. Suspense và error boundary dùng thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Suspense khai báo "trong lúc phần này chưa sẵn sàng thì hiện cái gì". Error
boundary bắt lỗi render của cây con. Cả hai giúp xử lý trạng thái tải và lỗi **theo vùng**, thay vì
rải `if (isLoading)` khắp nơi.

**Giải thích sâu:**

```jsx
<ErrorBoundary fallback={<BaoLoi />}>
  <Suspense fallback={<Skeleton />}>
    <DanhSach />
  </Suspense>
</ErrorBoundary>
```

Giá trị thật nằm ở **vị trí đặt ranh giới**. Một Suspense bọc cả trang nghĩa là người dùng nhìn màn
hình trống cho tới khi thứ chậm nhất tải xong. Nhiều Suspense nhỏ nghĩa là từng phần hiện dần —
trải nghiệm tốt hơn hẳn với cùng tốc độ mạng.

Những gì error boundary **không** bắt được, phải nhớ vì đây là câu hỏi tiếp phổ biến:
- Lỗi trong hàm xử lý sự kiện (dùng `try/catch` bình thường).
- Lỗi trong code bất đồng bộ (`setTimeout`, promise).
- Lỗi trong chính error boundary đó.
- Lỗi khi render trên server (SSR).

Thực dụng: dùng `react-error-boundary` thay vì tự viết class, vì nó có sẵn nút thử lại và cơ chế
reset theo khoá.

Chi tiết đáng nói ở mức senior: **error boundary nên đặt ở nhiều tầng**. Một cái ở gốc để không bao
giờ hiện màn hình trắng, và các cái nhỏ quanh những vùng độc lập — một widget hỏng không được phép
làm sập cả trang. Kèm theo là báo lỗi về hệ thống giám sát (Sentry) trong `componentDidCatch`, vì
nếu không thì lỗi đã bị nuốt và bạn không bao giờ biết.

</details>

### 13. Chọn thư viện quản lý state như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bắt đầu bằng `useState` + lifting state. Thêm TanStack Query cho dữ liệu server.
Chỉ thêm store toàn cục khi có state client thật sự dùng chung ở nhiều nhánh xa nhau.

**Giải thích sâu:** Sau khi tách server state ra (câu 6), phần state client toàn cục còn lại thường
rất nhỏ — theme, người dùng hiện tại, trạng thái sidebar, giỏ hàng. Nhiều dự án cài Redux rồi phát
hiện 90% store chỉ là cache của API.

| Thư viện | Điểm mạnh | Cân nhắc |
|---|---|---|
| Context + `useReducer` | không thêm phụ thuộc | render lại rộng (câu 5) |
| Zustand | API nhỏ, chọn lọc theo phần dữ liệu | ít ràng buộc cấu trúc |
| Jotai / Recoil | nguyên tử, hợp state phân mảnh | mô hình tinh thần khác |
| Redux Toolkit | DevTools, middleware, quy ước rõ | nhiều code khuôn mẫu |
| XState | tường minh cho luồng phức tạp | học mất thời gian |

Tiêu chí chọn nên nói ra: **DevTools và khả năng debug**. Với ứng dụng lớn nhiều người làm, việc
"tua lại" các action trong Redux DevTools có giá trị thật khi điều tra bug. Với ứng dụng nhỏ, đó là
chi phí không cần thiết.

Câu chốt ăn điểm: **"Em không chọn thư viện trước. Em xem state nào thuộc về server, state nào thuộc
về URL, state nào thật sự là của client. Sau khi phân loại xong, phần cần store toàn cục thường nhỏ
tới mức Zustand hoặc context là đủ."**

</details>

### 14. Test React component — test cái gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Test **hành vi mà người dùng thấy**, không test chi tiết cài đặt. Truy vấn phần
tử theo vai trò và nhãn (giống cách người dùng và screen reader nhìn thấy), không theo class CSS hay
test-id.

**Giải thích sâu:**

```jsx
// Test chi tiết cài đặt — vỡ khi refactor dù hành vi không đổi
expect(wrapper.state('isOpen')).toBe(true);
expect(wrapper.find('.dropdown-menu')).toHaveLength(1);

// Test hành vi — sống sót qua refactor
await user.click(screen.getByRole('button', { name: 'Mở menu' }));
expect(screen.getByRole('menu')).toBeVisible();
```

Thứ tự ưu tiên khi truy vấn (theo Testing Library): `getByRole` → `getByLabelText` →
`getByPlaceholderText` → `getByText` → `getByTestId` (cuối cùng, chỉ khi không còn cách nào).

Lý do thứ tự này không chỉ là quy ước: nếu bạn **không** truy vấn được bằng `getByRole` thì thường
là component đang có vấn đề về khả năng tiếp cận — thiếu nhãn, dùng `<div>` thay cho `<button>`.
Test kiểu này bắt được lỗi accessibility miễn phí. Đây là ý đáng nói ở phỏng vấn.

Nên test và không nên test:

```
NÊN   luồng người dùng (điền form -> submit -> thấy kết quả)
      trạng thái lỗi và trạng thái rỗng — chỗ bug hay nằm
      logic điều kiện hiển thị
      hook tuỳ chỉnh có logic thật

KHÔNG snapshot toàn bộ cây (vỡ liên tục, không ai đọc, ai cũng bấm cập nhật)
      component thuần trình bày không có logic
      thư viện bên thứ ba
      chi tiết cài đặt: tên state, số lần render
```

Về mock: **mock ở tầng mạng, không mock module**. `msw` chặn ở tầng HTTP nên code của bạn chạy thật,
kể cả tầng data fetching. Mock `useQuery` bằng jest thì bạn đang test cái mock của mình.

</details>

### 15. Ứng dụng React chậm — bạn tìm nguyên nhân thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trước hết xác định chậm ở đâu: tải trang lần đầu (bundle), hay tương tác (render).
Hai vấn đề này có công cụ và cách sửa hoàn toàn khác nhau.

**Giải thích sâu:**

```
Chậm khi TẢI TRANG      -> Lighthouse, bundle analyzer, tab Network
   nguyên nhân: bundle lớn, quá nhiều request, ảnh nặng, không code splitting
   -> xem 04-hieu-nang-va-do-luong.md

Chậm khi TƯƠNG TÁC      -> React DevTools Profiler, tab Performance
   nguyên nhân: render lại thừa, danh sách lớn, tính toán nặng trong render
```

Quy trình với React DevTools Profiler:

```
1. Bật "Highlight updates when components render" -> thấy ngay component nào nhấp nháy khi
   lẽ ra không nên
2. Ghi lại một tương tác -> nhìn biểu đồ ngọn lửa
3. Cột "Why did this render?" chỉ đúng lý do: props đổi, state đổi, cha render, context đổi
4. Sửa nguyên nhân lớn nhất -> đo lại
```

Bước 3 là bước quan trọng nhất và ít người dùng tới. Nó trả lời trực tiếp câu hỏi khó nhất, thay
cho việc đoán.

Bốn nguyên nhân theo tần suất thực tế:
1. **Context không memo hoá** → cả ứng dụng render lại (đã đo ở câu 5).
2. **Danh sách lớn không ảo hoá** → xem [02-trình-duyệt câu 5](./02-trinh-duyet-render-va-mang.md),
   đo được 47.1 ms so với 0.6 ms.
3. **Tính toán nặng ngay trong thân component** — sort, filter trên mảng lớn mỗi lần render.
4. **State đặt quá cao** → gõ một ký tự làm render lại nửa ứng dụng.

Và điều nên nói cuối cùng: **đo trong bản production build**. Bản development chậm hơn nhiều lần do
có kiểm tra bổ sung, và Strict Mode render đôi — tối ưu dựa trên số liệu của bản dev là tối ưu nhầm
mục tiêu.

</details>

### 16. Khi nào React **không** phải lựa chọn đúng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi trang chủ yếu là nội dung tĩnh và ít tương tác, khi cần bundle cực nhỏ, hoặc
khi đội không có kinh nghiệm React mà dự án lại gấp.

**Giải thích sâu:** Đây là câu kiểm tra xem bạn có tư duy độc lập hay chỉ theo xu hướng. Trả lời
"React lúc nào cũng tốt" là câu trả lời yếu.

| Tình huống | Lựa chọn hợp hơn |
|---|---|
| Blog, trang tài liệu, landing page | Astro, Eleventy, HTML thuần — gửi 0 KB JS |
| Widget nhúng vào trang của người khác | Preact, Svelte, hoặc web component |
| Ứng dụng nội bộ đơn giản, đội nhỏ | server render + HTMX/Alpine |
| Hiệu năng cực cao, bundle tối thiểu | Svelte, Solid |
| Đội đã giỏi Vue/Angular | giữ nguyên thứ họ giỏi |

Điểm đáng nói: **chi phí lớn nhất của một framework không phải kích thước bundle mà là kiến thức
của đội và hệ sinh thái**. React thắng ở đây trong hầu hết trường hợp — dễ tuyển người, thư viện
sẵn có cho mọi thứ, tài liệu và câu trả lời đầy trên mạng. Đó là lý do hợp lệ để chọn React ngay cả
khi một framework khác nhanh hơn trên biểu đồ.

Câu trả lời cân bằng nhất: **"Với sản phẩm có nhiều tương tác và đội đông người, em chọn React vì
hệ sinh thái và vì dễ tìm người. Với trang thiên về nội dung, em thấy gửi vài trăm KB JavaScript
xuống chỉ để hiển thị chữ là lãng phí — ở đó em chọn thứ render sẵn ở server."**

</details>

---

Tiếp: [04-hieu-nang-va-do-luong.md](./04-hieu-nang-va-do-luong.md)
