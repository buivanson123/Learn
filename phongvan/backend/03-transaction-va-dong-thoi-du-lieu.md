# Transaction và dữ liệu đồng thời — 14 câu

Nhóm câu này lọc rất mạnh. Ai cũng biết `BEGIN`/`COMMIT`, nhưng rất ít người nói được **chính xác
cái gì xảy ra khi hai request chạm cùng một dòng**. Toàn bộ output dưới đây là chạy thật trên
PostgreSQL 17 với hai phiên `psql` song song.

Bảng dùng chung:

```sql
CREATE TABLE accounts(id int primary key, balance int);
INSERT INTO accounts VALUES (1,100),(2,100);
```

---

### 1. ACID — giải thích bằng ví dụ, đừng đọc định nghĩa

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Atomicity: cả cụm chạy hết hoặc không gì cả. Consistency: ràng buộc luôn đúng
trước và sau. Isolation: transaction đồng thời không nhìn thấy trạng thái dở dang của nhau.
Durability: đã `COMMIT` là còn sau khi mất điện.

**Giải thích sâu:** Cách trả lời phân biệt người đã dùng thật — gắn mỗi chữ với một sự cố cụ thể:

- **A** — Chuyển tiền: trừ tài khoản A xong, tiến trình chết trước khi cộng cho B. Không có
  atomicity thì tiền bốc hơi. Đây là lý do hai lệnh `UPDATE` phải nằm trong cùng transaction, chứ
  không phải "cho chắc".
- **C** — Ràng buộc `balance >= 0`, khoá ngoại, unique. Chữ C thực ra là **trách nhiệm của bạn**:
  database chỉ thực thi các ràng buộc bạn khai báo. Nghiệp vụ đúng nhưng không có `CHECK` thì
  database vẫn "consistent" theo nghĩa của nó.
- **I** — Là chữ khó nhất và có nhiều **mức**, xem câu 2–5. Đây gần như luôn là chỗ người phỏng
  vấn đào tiếp.
- **D** — Phụ thuộc cấu hình. Postgres với `synchronous_commit = off` **nhanh hơn nhiều** nhưng
  mất vài trăm ms giao dịch cuối khi mất điện. Đó là một lựa chọn hợp lệ cho bảng log, và tệ hại
  cho bảng thanh toán.

Câu ăn điểm: "ACID không miễn phí và không phải bật/tắt — chữ I có bốn mức và chữ D có công tắc.
Chọn mức nào là quyết định thiết kế, không phải mặc định."

</details>

### 2. READ COMMITTED — chính xác thì nó bảo đảm gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó chỉ bảo đảm bạn **không đọc dữ liệu chưa commit** của người khác. Nó **không**
bảo đảm đọc hai lần trong cùng transaction ra cùng kết quả. Đây là mức mặc định của PostgreSQL,
MySQL(InnoDB) thì mặc định REPEATABLE READ.

**Giải thích sâu:** Chạy thật hai phiên song song:

```
SESSION A (READ COMMITTED)              SESSION B
--------------------------------------  --------------------------------
BEGIN ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM accounts WHERE id=1;
 lan_doc_1
-----------
       100
                                        UPDATE accounts SET balance=balance+50
                                        WHERE id=1;      (auto-commit)
SELECT balance FROM accounts WHERE id=1;
 lan_doc_2
-----------
       150         ← ĐỔI, dù vẫn trong cùng transaction
COMMIT;
```

Đây gọi là **non-repeatable read**, và nó là hành vi **đúng theo đặc tả** của READ COMMITTED, không
phải bug.

Vì sao đây là bẫy trong code thật: rất nhiều logic đọc một giá trị, tính toán, rồi ghi lại dựa trên
giá trị vừa đọc. Ở READ COMMITTED, giá trị đó có thể đã cũ tại thời điểm bạn ghi. Xem câu 4.

Mỗi câu lệnh trong READ COMMITTED lấy một **snapshot mới**. Hệ quả nữa: một câu `UPDATE ... WHERE`
chạy lâu có thể thấy các dòng được chèn giữa chừng bởi transaction khác vừa commit.

</details>

### 3. REPEATABLE READ khác gì, và lỗi `could not serialize` từ đâu ra?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** REPEATABLE READ chụp **một snapshot cho cả transaction**, nên đọc bao nhiêu lần
cũng ra cùng kết quả. Cái giá: nếu bạn định ghi lên dòng mà người khác đã sửa sau snapshot,
Postgres **huỷ transaction của bạn** với lỗi serialization.

**Giải thích sâu:** Chạy thật:

```
SESSION A (REPEATABLE READ)             SESSION B
--------------------------------------  --------------------------------
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT balance ... WHERE id=1;
 lan_doc_1 = 100
                                        UPDATE accounts SET balance=balance+50
                                        WHERE id=1;      (đã commit)
SELECT balance ... WHERE id=1;
 lan_doc_2 = 100      ← VẪN 100: snapshot giữ nguyên
UPDATE accounts SET balance=balance+10 WHERE id=1;
ERROR:  could not serialize access due to concurrent update
```

Ba điều rút ra, và điều thứ ba là điều hay bị bỏ sót nhất:

1. **Đọc thì nhất quán tuyệt đối** — báo cáo chạy 5 phút ở REPEATABLE READ cho ra con số của một
   thời điểm duy nhất, không bị lẫn dữ liệu mới. Đây là lý do chính để dùng nó.
2. **Ghi thì có thể bị huỷ.** Không phải lỗi hệ thống, mà là hợp đồng của mức isolation này.
3. **Ứng dụng bắt buộc phải retry.** Đây là phần hầu như luôn bị quên: chọn mức isolation cao mà
   không viết vòng retry thì bạn chỉ đổi bug thầm lặng thành lỗi 500 ồn ào. Retry phải bọc **toàn
   bộ** transaction (đọc lại từ đầu), không phải chỉ chạy lại câu `UPDATE`.

Ghi chú so sánh: MySQL/InnoDB ở REPEATABLE READ **không** báo lỗi trong tình huống này — nó dùng
next-key lock và cho `UPDATE` đọc giá trị mới nhất ("current read"), dẫn tới hành vi khác hẳn dù
cùng tên mức isolation. Biết chi tiết này là dấu hiệu rõ của người làm nhiều.

</details>

### 4. Lost update là gì? Chứng minh nó xảy ra.

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hai transaction cùng đọc một giá trị, cùng tính toán, cùng ghi lại — người ghi
sau đè mất kết quả của người ghi trước. Ở READ COMMITTED, database **không** ngăn chuyện này.

**Giải thích sâu:** Chạy thật, số dư ban đầu 100, A cộng 10, B cộng 20:

```
SESSION A                          SESSION B
BEGIN; SELECT balance ... id=1;    BEGIN; SELECT balance ... id=1;
   -> đọc được 100                    -> đọc được 100
UPDATE accounts SET balance=100+10;
COMMIT;
                                   UPDATE accounts SET balance=100+20;
                                   COMMIT;
```
```
Ky vong neu chay tuan tu: 100+10+20 = 130
 balance
---------
     120                            ← MẤT 10
```

Đây là bug làm mất tiền, mất tồn kho, mất điểm thưởng — và nó **không bao giờ xuất hiện khi test
một mình**. Nó chỉ xuất hiện khi có tải, và nó không để lại log lỗi nào.

Bốn cách sửa, theo thứ tự nên ưu tiên:

**1. Để database tự tính (tốt nhất khi làm được):**
```sql
UPDATE accounts SET balance = balance + 10 WHERE id = 1;
```
Câu này khoá dòng và đọc giá trị mới nhất, không có khoảng hở đọc-rồi-ghi. Chạy lại thí nghiệm với
cách này cho ra đúng 130.

**2. Khoá bi quan — `SELECT ... FOR UPDATE`** khi phải tính toán phức tạp trong app (xem câu 5).

**3. Khoá lạc quan — cột version:**
```sql
UPDATE accounts SET balance = ?, version = version + 1 WHERE id = ? AND version = ?;
-- rowCount = 0  ->  có người khác đã sửa, đọc lại và thử lại
```
Hợp khi xung đột hiếm; không giữ khoá nên không chặn ai, đổi lại app phải xử lý retry.

**4. Nâng isolation lên REPEATABLE READ / SERIALIZABLE** + retry — như câu 3 đã đo, Postgres sẽ
báo lỗi thay vì âm thầm mất dữ liệu.

</details>

### 5. `SELECT ... FOR UPDATE` làm gì? Đo thời gian chờ.

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó khoá các dòng được chọn cho tới hết transaction. Transaction khác đụng vào
những dòng đó sẽ **chờ**, không phải lỗi. Đây là khoá bi quan.

**Giải thích sâu:** Chạy thật, A giữ khoá rồi B cố lấy:

```
SESSION A                                    SESSION B
BEGIN;
SELECT balance FROM accounts WHERE id=1
FOR UPDATE;
 balance = 100
                                             BEGIN; SELECT ... id=1 FOR UPDATE;
                                             ... sau 2 giây vẫn CHƯA có kết quả
UPDATE accounts SET balance=balance+10;
COMMIT;
                                             balance = 110    ← mở khoá sau 4.0 giây
                                             UPDATE ... +20; COMMIT;
```
```
 ket_qua
---------
     130          ← ĐÚNG, không mất update nào
```

Điểm mấu chốt: B **không nhận lỗi**, nó chỉ đứng chờ. Trong HTTP request thì "đứng chờ" nghĩa là
giữ một kết nối DB và một luồng app. Nếu 200 request cùng tranh một dòng nóng (ví dụ tồn kho của
một sản phẩm đang flash sale), pool cạn và toàn bộ hệ thống dừng — dù chỉ một dòng bị tranh.

Ba biến thể cần biết, mỗi cái giải một vấn đề khác:

```sql
SELECT ... FOR UPDATE NOWAIT;      -- không chờ, ném lỗi ngay -> trả 409 cho user
SELECT ... FOR UPDATE SKIP LOCKED; -- bỏ qua dòng đang bị khoá -> nền tảng của job queue trên SQL
SELECT ... FOR NO KEY UPDATE;      -- khoá nhẹ hơn, không chặn tạo khoá ngoại trỏ tới
```

Và luôn đặt `SET lock_timeout = '3s'`: thà trả lỗi cho user còn hơn để 500 request cùng treo vô hạn.

Nguyên tắc vàng: **giữ khoá càng ngắn càng tốt**. Không bao giờ gọi API bên ngoài (thanh toán,
email) khi đang giữ khoá — upstream chậm 10 giây là khoá của bạn giữ 10 giây.

</details>

### 6. Deadlock xảy ra thế nào? Postgres xử lý ra sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hai transaction khoá hai tài nguyên theo **thứ tự ngược nhau** rồi chờ nhau vòng
tròn. Postgres phát hiện chu trình chờ và **tự huỷ một trong hai** làm nạn nhân.

**Giải thích sâu:** Tái hiện, A khoá dòng 1 rồi dòng 2, B khoá dòng 2 rồi dòng 1:

```
SESSION A                              SESSION B
BEGIN; UPDATE accounts ... WHERE id=1;
                                       BEGIN; UPDATE accounts ... WHERE id=2;
UPDATE accounts ... WHERE id=2;   (chờ B)
                                       UPDATE accounts ... WHERE id=1;   (chờ A)
```

Sau khoảng 1 giây (`deadlock_timeout` mặc định), session A nhận:

```
ERROR:  deadlock detected
DETAIL:  Process 267 waits for ShareLock on transaction 815; blocked by process 268.
         Process 268 waits for ShareLock on transaction 816; blocked by process 267.
HINT:  See server log for query details.
CONTEXT:  while updating tuple (0,2) in relation "accounts"
```

Session B đi tiếp bình thường. Log server ghi đủ cả hai câu lệnh gây ra — đây là chỗ đầu tiên cần
nhìn khi điều tra:

```bash
docker logs pv-pg 2>&1 | grep -A5 "deadlock detected"
```

Cách phòng, theo thứ tự hiệu quả:

1. **Luôn khoá theo cùng một thứ tự.** Ví dụ chuyển tiền: luôn khoá tài khoản có `id` nhỏ trước,
   bất kể chiều chuyển. Đây là cách sửa gốc rễ và gần như luôn đủ.
   ```sql
   SELECT * FROM accounts WHERE id IN (:a, :b) ORDER BY id FOR UPDATE;
   ```
2. **Rút ngắn transaction.** Deadlock cần hai transaction chồng lấn thời gian; transaction 5 ms
   hầu như không kịp gặp nhau.
3. **Retry.** Deadlock là lỗi tạm thời — bắt SQLSTATE `40P01` và chạy lại toàn bộ transaction với
   backoff nhỏ. Đây là phần nên có sẵn trong tầng repository, không rải rác ở từng chỗ gọi.

Ý cuối cho thấy kinh nghiệm: deadlock **không phải lúc nào cũng cần diệt tận gốc**. Vài chục lần
mỗi ngày trên hệ thống ghi lớn, đã có retry tự động, là chấp nhận được. Đáng lo là khi tần suất
tăng đột biến — đó là dấu hiệu của một luồng code mới đang khoá sai thứ tự.

</details>

### 7. SERIALIZABLE có gì khác? Vì sao ít người dùng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó bảo đảm kết quả **giống hệt như thể các transaction chạy lần lượt**. Postgres
cài bằng SSI — theo dõi phụ thuộc đọc/ghi và huỷ transaction nào phá vỡ tính tuần tự. Ít dùng vì
tỷ lệ bị huỷ cao khi tải lớn, và vì bắt buộc phải viết retry.

**Giải thích sâu:** Nó bắt được loại lỗi mà REPEATABLE READ bỏ sót — **write skew**:

```
Quy định: ca trực phải luôn có ít nhất 1 bác sĩ.
Hiện có: A và B đều đang trực.

A: SELECT count(*) FROM oncall WHERE on_duty = true;  -> 2, "vẫn còn B, mình nghỉ được"
B: SELECT count(*) FROM oncall WHERE on_duty = true;  -> 2, "vẫn còn A, mình nghỉ được"
A: UPDATE oncall SET on_duty=false WHERE id='A';  COMMIT;
B: UPDATE oncall SET on_duty=false WHERE id='B';  COMMIT;

-> 0 bác sĩ trực. Không dòng nào bị hai người cùng ghi, nên FOR UPDATE trên dòng cũng không cứu được.
```

Ở SERIALIZABLE, Postgres phát hiện phụ thuộc đọc-ghi chéo và huỷ một trong hai với
`ERROR: could not serialize access due to read/write dependencies among transactions`.

Đánh đổi cần nói:
- Tốn thêm bộ nhớ để theo dõi predicate lock; có thể "leo thang" từ mức dòng lên mức bảng khi
  nhiều, làm tỷ lệ huỷ tăng vọt.
- Mọi transaction **phải** có retry, kể cả transaction chỉ đọc.
- Đừng bật SERIALIZABLE cho toàn hệ thống. Bật **cho đúng luồng nghiệp vụ cần nó** (đặt chỗ, trừ
  tồn kho, tính hạn mức) là lựa chọn thực dụng.

Cách thay thế thường dùng hơn: ràng buộc ở tầng database (`EXCLUDE` constraint cho đặt phòng
không trùng khoảng thời gian, `CHECK` cho số dư không âm). Ràng buộc thì không thể lách được, còn
mức isolation thì phụ thuộc vào việc mọi lập trình viên đều nhớ đặt đúng.

</details>

### 8. Transaction nên dài bao nhiêu? Đặt ở tầng nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Càng ngắn càng tốt, và **chỉ bao quanh các thao tác ghi database**. Không bao gọi
HTTP, không gửi email, không upload file bên trong transaction.

**Giải thích sâu:** Vì sao transaction dài là độc hại — bốn hậu quả, không chỉ một:

1. Giữ khoá lâu → tăng xác suất deadlock và chờ.
2. Giữ kết nối trong pool → pool cạn.
3. **Chặn `VACUUM`.** Postgres không dọn được các dòng chết mới hơn transaction cũ nhất còn mở.
   Một transaction "idle in transaction" quên `COMMIT` có thể làm bảng phình gấp nhiều lần
   (table bloat) và làm chậm cả hệ thống. Đây là câu trả lời ăn điểm nhất trong nhóm này.
4. Rollback lâu, WAL lớn, replica trễ.

Kiểm tra ngay trên hệ thống thật:

```sql
SELECT pid, state, now()-xact_start AS thoi_gian, left(query,60)
FROM pg_stat_activity
WHERE state <> 'idle' AND xact_start IS NOT NULL
ORDER BY xact_start LIMIT 10;
```

Thấy `state = 'idle in transaction'` kéo dài phút là bug: code đã `BEGIN` rồi đi làm việc khác.
Đặt `idle_in_transaction_session_timeout = '30s'` để database tự cắt.

Sai lầm kiến trúc phổ biến:

```js
await db.transaction(async (tx) => {
  const order = await tx.insert(orders, {...});
  await paymentGateway.charge(order);       // ← SAI: gọi mạng trong transaction
  await tx.update(orders, { status: 'paid' });
});
```

Cổng thanh toán chậm 8 giây là khoá giữ 8 giây. Tệ hơn: nếu transaction rollback **sau khi** đã
charge thành công, tiền đã trừ mà đơn không tồn tại. Cách đúng là tách:
transaction 1 tạo đơn `pending` → gọi thanh toán ngoài transaction → transaction 2 cập nhật kết
quả, có `Idempotency-Key` để retry an toàn.

</details>

### 9. Outbox pattern giải quyết vấn đề gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Vấn đề "ghi database **và** gửi message phải cùng thành công hoặc cùng thất bại"
— hai hệ thống khác nhau nên không có transaction chung. Outbox ghi message vào **cùng database,
cùng transaction**, rồi một tiến trình riêng đọc và gửi đi.

**Giải thích sâu:** Bug nó sửa:

```js
await db.insert(orders, order);        // thành công
await kafka.send('order.created', order);   // tiến trình chết ở ĐÂY
// -> đơn hàng tồn tại nhưng không service nào biết. Kho không xuất, mail không gửi.
```

Đảo thứ tự cũng không cứu được: gửi message trước rồi ghi DB fail thì các service khác xử lý một
đơn hàng không tồn tại.

Outbox:

```sql
CREATE TABLE outbox (
  id bigserial PRIMARY KEY,
  topic text NOT NULL, payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now(), sent_at timestamptz
);
```

```js
await db.transaction(async tx => {
  await tx.insert(orders, order);
  await tx.insert(outbox, { topic:'order.created', payload: order });   // cùng transaction
});
```

Một worker riêng đọc và gửi — dùng đúng `SKIP LOCKED` để nhiều worker chạy song song không giẫm
lên nhau:

```sql
BEGIN;
SELECT * FROM outbox WHERE sent_at IS NULL
 ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED;
-- gửi đi...
UPDATE outbox SET sent_at = now() WHERE id = ANY(:ids);
COMMIT;
```

Điều bắt buộc phải nói kèm: outbox cho bảo đảm **at-least-once**, không phải exactly-once. Worker
có thể gửi xong rồi chết trước khi `UPDATE sent_at` → message được gửi hai lần. Vì vậy **consumer
phải idempotent** — thường bằng cách lưu `message_id` đã xử lý.

Nói được câu "exactly-once trong hệ phân tán về cơ bản là không có; cái ta làm được là at-least-once
cộng với consumer idempotent" là dấu hiệu rõ ràng của senior.

</details>

### 10. Làm sao chống double-submit khi user bấm nút hai lần?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nhiều tầng, và tầng ở client là tầng **kém tin cậy nhất**: disable nút (chỉ chống
nhầm lẫn), `Idempotency-Key` ở API, và cuối cùng là **ràng buộc unique trong database** — tầng duy
nhất không thể lách.

**Giải thích sâu:** Vì sao chỉ disable nút là không đủ: user mở hai tab, mạng chập chờn khiến client
tự retry, hoặc kẻ tấn công gọi thẳng API. Mọi tầng trên database đều có thể bị bỏ qua.

Tầng cuối cùng, luôn phải có:

```sql
-- Mỗi user chỉ có một đơn 'pending' cho một giỏ hàng
CREATE UNIQUE INDEX ON orders (user_id, cart_id) WHERE status = 'pending';
```

Rồi bắt lỗi vi phạm unique và **coi đó là thành công** (trả về đơn đã có), chứ không trả lỗi 500:

```js
try { return await createOrder(...) }
catch (e) {
  if (e.code === '23505') return await findExistingOrder(...);   // 23505 = unique_violation
  throw e;
}
```

Đây là kỹ thuật đáng nói tên: **"insert rồi bắt lỗi trùng"** đúng hơn "kiểm tra tồn tại rồi insert".
Cách thứ hai có khoảng hở giữa `SELECT` và `INSERT` (TOCTOU) và sẽ hỏng khi có tải — chính là biến
thể của lost update ở câu 4.

Hoặc để database làm gọn trong một câu:

```sql
INSERT INTO orders (...) VALUES (...)
ON CONFLICT (user_id, cart_id) WHERE status='pending' DO NOTHING
RETURNING id;
-- không trả về dòng nào = đã tồn tại
```

</details>

### 11. Trừ tồn kho khi 1000 người cùng mua 1 sản phẩm còn 10 cái — thiết kế thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ràng buộc đúng đắn phải nằm ở database (`CHECK (stock >= 0)` + `UPDATE ... WHERE
stock >= qty`), còn việc chống 1000 request cùng đập vào một dòng thì giải ở tầng trước bằng hàng
đợi hoặc bằng Redis.

**Giải thích sâu:** Bắt đầu từ tầng đúng đắn — một câu duy nhất, không cần khoá tường minh:

```sql
UPDATE products SET stock = stock - 2 WHERE id = :id AND stock >= 2;
-- rowCount = 0  ->  hết hàng, trả 409 cho user
```

Câu này an toàn tuyệt đối vì `UPDATE` tự khoá dòng và điều kiện được kiểm tra trên giá trị mới
nhất. Kèm `ALTER TABLE products ADD CHECK (stock >= 0)` làm lưới an toàn cuối cùng.

Vấn đề còn lại là **hiệu năng**, không phải đúng đắn: 1000 request tranh một dòng thì chúng xếp
hàng, mỗi cái giữ một kết nối. Ba cách xử lý theo quy mô:

| Quy mô | Cách làm |
|---|---|
| Bình thường | `UPDATE ... WHERE stock >= qty` là đủ. Đừng tối ưu sớm. |
| Flash sale vừa | Giữ tồn kho trong Redis, `DECRBY` (nguyên tử) để lọc; ai qua được mới vào DB |
| Flash sale lớn | Đẩy toàn bộ vào **queue một chiều**, một consumer xử lý tuần tự; user nhận "đang xử lý" và biết kết quả qua websocket |

Mẹo chia nhỏ điểm nóng đáng nhắc: tách 1 dòng tồn kho thành N dòng "kho con" (mỗi dòng giữ 10 cái),
request rơi ngẫu nhiên vào một kho con → giảm tranh chấp N lần. Đổi lại phải xử lý trường hợp kho
con này hết mà kho con kia còn.

Và phần nghiệp vụ mà người phỏng vấn thật sự chờ nghe: **giữ chỗ có hạn**. Trừ tồn kho lúc thêm vào
giỏ và giữ 15 phút, hết hạn thì trả lại. Nếu chỉ trừ lúc thanh toán thành công thì user điền xong
form mới biết hết hàng — trải nghiệm rất tệ. Nếu trừ vĩnh viễn lúc thêm giỏ thì hàng bị giữ bởi
những giỏ bỏ quên.

</details>

### 12. Distributed lock bằng Redis — an toàn tới đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `SET key value NX PX 30000` là cách đúng cho một Redis node, và nó **đủ dùng cho
việc chống trùng lặp**, nhưng **không** an toàn tuyệt đối cho việc bảo vệ tính đúng đắn — vì
GC pause hoặc mạng chậm có thể khiến hai tiến trình cùng tin mình giữ khoá.

**Giải thích sâu:** Cách làm đúng, từng chi tiết đều có lý do:

```js
const token = randomUUID();
const ok = await redis.set(key, token, 'NX', 'PX', 30000);   // NX: chỉ đặt nếu chưa có
// PX bắt buộc: nếu tiến trình chết, khoá phải tự hết hạn, nếu không cả hệ thống kẹt vĩnh viễn

// Mở khoá PHẢI kiểm tra token, bằng Lua để nguyên tử:
// if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end
```

Vì sao phải có `token`: nếu công việc chạy quá 30 giây, khoá hết hạn và **tiến trình khác đã lấy
được khoá**. Lúc đó `DEL` trần sẽ xoá khoá của người khác. Đây là lỗi tinh vi mà rất ít người nghĩ
tới, và nói ra nó ăn điểm ngay.

Vì sao vẫn không an toàn tuyệt đối:

```
T0   A lấy khoá, TTL 30s
T1   A bị GC pause 35 giây (hoặc container bị treo I/O)
T31  khoá hết hạn, B lấy được khoá, bắt đầu ghi
T35  A tỉnh dậy, TIN rằng mình vẫn giữ khoá, ghi đè lên việc của B
```

Không có TTL nào sửa được điều này, vì bạn không kiểm soát được lúc nào tiến trình bị treo.
Redlock (nhiều node Redis) cũng không giải quyết được — đây là nội dung tranh luận nổi tiếng giữa
Martin Kleppmann và antirez, và biết tới nó là điểm cộng.

Cách nói cân bằng: **"Em phân biệt hai mục đích. Nếu khoá chỉ để tránh làm việc thừa — hai worker
cùng gửi report — thì Redis lock quá đủ, xấu nhất là tốn công. Nếu khoá để bảo vệ tính đúng đắn của
tiền bạc thì em không dựa vào nó; em đưa ràng buộc xuống database bằng transaction hoặc unique
constraint, nơi có fencing thật."**

Với Postgres có sẵn: `pg_advisory_lock` cho khoá gắn với phiên, không cần thêm hạ tầng.

</details>

### 13. Event sourcing / CQRS — khi nào đáng dùng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** CQRS (tách mô hình đọc khỏi mô hình ghi) đáng dùng khi đọc và ghi có yêu cầu khác
hẳn nhau. Event sourcing (lưu chuỗi sự kiện thay vì trạng thái hiện tại) đáng dùng khi **lịch sử
thay đổi chính là yêu cầu nghiệp vụ**. Cả hai đều đắt và thường bị dùng sai chỗ.

**Giải thích sâu:** Khi nào event sourcing thật sự đúng:
- Kế toán, ngân hàng — sổ cái vốn dĩ đã là chuỗi sự kiện, trạng thái chỉ là tổng hợp.
- Hệ thống cần trả lời "tại thời điểm X, dữ liệu trông thế nào?" và "ai đã đổi cái này, khi nào".
- Nghiệp vụ cần phát lại lịch sử để tính lại theo quy tắc mới.

Cái giá, phải nói ra đầy đủ:
- **Schema của event là vĩnh viễn.** Event đã ghi không sửa được; đổi cấu trúc phải versioning và
  giữ code đọc mọi phiên bản cũ — mãi mãi.
- Truy vấn đơn giản ("cho tôi email của user 5") trở thành phát lại sự kiện hoặc phải có projection.
- Cần snapshot khi chuỗi event dài, thêm một tầng phức tạp nữa.
- **Nhất quán cuối** giữa mô hình ghi và mô hình đọc — user ghi xong đọc lại chưa thấy.

Phiên bản thực dụng đáng đề xuất trong đa số trường hợp: giữ bảng trạng thái bình thường, **thêm
một bảng audit log** ghi mọi thay đổi. Được 80% lợi ích (truy vết, điều tra sự cố, tuân thủ) với
5% chi phí.

Câu trả lời được đánh giá cao nhất ở đây là câu **từ chối**: "Em sẽ hỏi ngược lại — nghiệp vụ có
thật sự cần lịch sử không, hay chỉ cần biết ai sửa gì? Nếu chỉ cần vế sau thì audit log là lựa chọn
đúng, và team sẽ không phải sống với event schema trong 5 năm."

</details>

### 14. Hai service, mỗi cái một database — làm sao giữ nhất quán?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không có transaction chung, nên phải chấp nhận **nhất quán cuối** và thiết kế bù
trừ: saga pattern. Mỗi bước có một hành động hoàn tác tương ứng, và mọi bước đều idempotent.

**Giải thích sâu:** Ví dụ đặt vé máy bay qua 3 service:

```
1. Payment    trừ tiền
2. Inventory  giữ ghế
3. Notify     gửi vé

Bước 2 thất bại -> phải chạy bù cho bước 1: hoàn tiền.
```

Hai kiểu điều phối, và biết sự khác biệt là điểm cộng:

| | Choreography | Orchestration |
|---|---|---|
| Cách chạy | mỗi service nghe event và tự phản ứng | một orchestrator gọi từng bước |
| Ưu | không có điểm trung tâm, ghép lỏng | thấy được toàn bộ luồng ở một chỗ |
| Nhược | **không ai biết luồng đầy đủ**; debug rất khổ | orchestrator thành điểm chết, dễ phình |
| Hợp với | 2–3 bước đơn giản | luồng nhiều bước, cần theo dõi trạng thái |

Những thứ hay bị quên và người phỏng vấn sẽ hỏi tới:

- **Bù trừ không phải rollback.** Đã gửi email thì không rút lại được; phải gửi email xin lỗi.
  Thiết kế thứ tự bước sao cho **hành động không thể hoàn tác được đặt sau cùng**.
- **Bước bù trừ cũng có thể thất bại.** Cần retry và cuối cùng là hàng đợi cho người xử lý tay —
  không có gì tự động 100%.
- **Trạng thái trung gian phải hiển thị được.** User cần thấy "đang xử lý" chứ không phải màn hình
  trắng hay một thông báo thành công quá sớm.

Và câu hỏi ngược quan trọng nhất: **"Hai thứ này có thật sự cần ở hai service khác nhau không?"**
Rất nhiều saga tồn tại chỉ vì ranh giới service bị chia sai. Nếu hai bảng luôn phải thay đổi cùng
nhau, chúng thuộc về cùng một service và cùng một transaction — và bạn vừa xoá được cả một tầng
phức tạp.

</details>

---

Tiếp: [04-thiet-ke-api.md](./04-thiet-ke-api.md)
