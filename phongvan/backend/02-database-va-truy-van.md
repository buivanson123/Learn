# Database và truy vấn — 18 câu

Đây là nhóm câu **quyết định** ở phỏng vấn backend senior. Lý do: hầu hết sự cố hiệu năng thật đều
nằm ở đây, và nó là chỗ khó bịa nhất — ai đã từng đọc `EXPLAIN` trên production nghe khác hẳn
người chỉ đọc blog.

Toàn bộ output dưới đây đo trên **PostgreSQL 17** trong Docker, bảng `users` 500.000 dòng và
`orders` 2.000.000 dòng. Dựng lại môi trường:

```bash
docker run -d --name pv-pg -e POSTGRES_PASSWORD=pw -p 55432:5432 postgres:17
docker exec -i pv-pg psql -U postgres <<'SQL'
CREATE TABLE users (id serial PRIMARY KEY, email text NOT NULL, status text NOT NULL,
                    created_at timestamptz DEFAULT now());
CREATE TABLE orders (id serial PRIMARY KEY, user_id int NOT NULL, total numeric(12,2) NOT NULL,
                     status text NOT NULL, created_at timestamptz DEFAULT now());
INSERT INTO users (email, status)
  SELECT 'u'||g||'@x.com', CASE WHEN g%50=0 THEN 'banned' ELSE 'active' END
  FROM generate_series(1,500000) g;
INSERT INTO orders (user_id, total, status)
  SELECT 1+floor(random()*500000), (random()*1000)::numeric(12,2),
         CASE WHEN random()<0.1 THEN 'pending' ELSE 'paid' END
  FROM generate_series(1,2000000);
ANALYZE;
SQL
```

---

## Phần 1 — Index (câu 1–8)

### 1. Index hoạt động thế nào và nó đắt ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** B-tree giữ khoá đã sắp xếp nên tìm một giá trị mất `O(log n)` thay vì quét toàn
bảng. Cái giá: mỗi `INSERT`/`UPDATE`/`DELETE` phải cập nhật **mọi** index của bảng, và index
chiếm dung lượng đĩa + bộ nhớ đệm.

**Giải thích sâu:** Đo chênh lệch thật, cùng một câu query trước và sau khi tạo index:

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE email = 'u499999@x.com';
```

Trước:
```
 Parallel Seq Scan on users (actual rows=0 loops=3)
   Filter: (email = 'u499999@x.com'::text)
   Rows Removed by Filter: 166666
   Buffers: shared hit=4069                    ← đọc 4069 block = ~32 MB
 Execution Time: 21.164 ms
```

Sau `CREATE INDEX idx_users_email ON users(email)`:
```
 Index Scan using idx_users_email on users (actual rows=1 loops=1)
   Index Cond: (email = 'u499999@x.com'::text)
   Buffers: shared hit=1 read=3                ← đọc 4 block
 Execution Time: 0.076 ms
```

**278 lần nhanh hơn, và đọc ít hơn 1000 lần số block.** Con số `Buffers` quan trọng hơn con số
mili giây, vì mili giây phụ thuộc vào cache còn `Buffers` thì không — nó là lượng công việc thật.

Cái giá phải nói ra khi trả lời: bảng có 6 index thì mỗi `INSERT` là 7 lần ghi (1 heap + 6 index).
Với bảng log ghi 10 nghìn dòng/giây, thêm một index có thể là quyết định tệ. Câu hỏi luôn là "bảng
này đọc nhiều hay ghi nhiều?"

</details>

### 2. Khi nào có index mà Postgres vẫn không dùng?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi nó tính ra quét toàn bảng **rẻ hơn**. Điển hình là khi điều kiện khớp với
phần lớn số dòng — lúc đó đi index rồi nhảy về heap từng dòng còn tốn hơn đọc tuần tự.

**Giải thích sâu:** Cột `status` có 98% `active` và 2% `banned`. Cùng một index, hai kết quả trái
ngược:

```sql
CREATE INDEX idx_users_status ON users(status);

EXPLAIN (ANALYZE) SELECT count(*) FROM users WHERE status='active';
 Parallel Seq Scan on users (actual rows=163333 loops=3)     ← BỎ QUA index
   Filter: (status = 'active'::text)
 Execution Time: 18.626 ms

EXPLAIN (ANALYZE) SELECT count(*) FROM users WHERE status='banned';
 Index Only Scan using idx_users_status on users (actual rows=10000 loops=1)
   Heap Fetches: 0
 Execution Time: 0.551 ms                                     ← DÙNG index
```

Đây là **hành vi đúng**, không phải lỗi. Đọc tuần tự 500 nghìn dòng nhanh hơn nhảy ngẫu nhiên
490 nghìn lần. Ngưỡng thực tế nằm quanh 5–10% số dòng.

Bài học rút ra để nói: **index trên cột boolean hoặc cột ít giá trị (giới tính, `is_active`)
thường vô dụng** — trừ khi giá trị bạn tìm là giá trị hiếm. Khi chỉ cần tra giá trị hiếm, dùng
**partial index** để index nhỏ hơn hàng chục lần:

```sql
CREATE INDEX idx_users_banned ON users(status) WHERE status = 'banned';
```

Các lý do khác khiến index bị bỏ qua, nên kể thêm 1–2 cái:
- **Sai kiểu dữ liệu**: cột `bigint` mà truyền string, hoặc `varchar` so với `int`.
- **Thống kê cũ**: sau khi nạp dữ liệu lớn mà chưa `ANALYZE`, planner ước lượng sai.
- **`OR` giữa hai cột khác nhau** — thường phải tách thành `UNION` hoặc tạo index phù hợp.

</details>

### 3. Vì sao `WHERE lower(email) = ?` không dùng được index trên `email`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Index lưu giá trị **gốc** của cột. Bọc hàm quanh cột thì giá trị cần tìm không
còn nằm trong index nữa. Sửa bằng expression index: `CREATE INDEX ... ON users(lower(email))`.

**Giải thích sâu:** Đo, dù `idx_users_email` đang tồn tại:

```sql
EXPLAIN (ANALYZE) SELECT * FROM users WHERE lower(email) = 'u499999@x.com';
 Parallel Seq Scan on users (actual rows=0 loops=3)
   Filter: (lower(email) = 'u499999@x.com'::text)
 Execution Time: 55.813 ms         ← so với 0.076 ms khi dùng index
```

**Chậm hơn 730 lần.** Đây là bug hiệu năng phổ biến nhất trong code thật, vì nó trông hoàn toàn vô
hại và thường do ORM sinh ra khi bạn viết `where('LOWER(email)', ...)` để tìm không phân biệt hoa
thường.

Các biến thể cùng bản chất, đáng kể ra để chứng minh mình nắm nguyên tắc chứ không thuộc lòng một
ví dụ:

```sql
WHERE DATE(created_at) = '2026-09-09'         -- hàm bọc cột
WHERE created_at::date = '2026-09-09'         -- cast cũng là hàm
WHERE user_id::text = '42'                    -- cast ngược
WHERE total + 0 > 100                          -- phép toán trên cột
```

Cách sửa chung: **để cột trần một bên, mọi biến đổi dồn sang bên kia**:

```sql
WHERE created_at >= '2026-09-09' AND created_at < '2026-09-10'   -- dùng được index
```

Với tìm kiếm không phân biệt hoa thường, giải pháp sạch hơn cả là dùng kiểu `citext` hoặc chuẩn
hoá email về chữ thường **ngay lúc ghi**.

</details>

### 4. `LIKE 'abc%'` có dùng được index không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Về nguyên tắc có (prefix nằm trong thứ tự sắp xếp của B-tree), nhưng trong
PostgreSQL với collation không phải `C`, index B-tree mặc định **không** phục vụ được `LIKE` —
phải tạo index với `text_pattern_ops`. `LIKE '%abc%'` thì không index nào giúp được.

**Giải thích sâu:** Đây là chỗ đa số câu trả lời "học thuộc" bị sai. Đo thật, database dùng
collation `en_US.utf8` và **đã có** `idx_users_email`:

```sql
EXPLAIN (ANALYZE) SELECT count(*) FROM users WHERE email LIKE 'u49999%';
 Parallel Seq Scan on users                     ← KHÔNG dùng index dù là prefix!
 Execution Time: 15.952 ms
```

Lý do: trong collation `en_US.utf8`, thứ tự sắp xếp không trùng với thứ tự byte, nên Postgres
không suy ra được khoảng giá trị từ tiền tố. Tạo đúng loại index:

```sql
CREATE INDEX idx_users_email_pat ON users(email text_pattern_ops);
EXPLAIN (ANALYZE) SELECT count(*) FROM users WHERE email LIKE 'u49999%';

 Index Only Scan using idx_users_email_pat on users (actual rows=11 loops=1)
   Index Cond: ((email ~>=~ 'u49999'::text) AND (email ~<~ 'u4999:'::text))
   Heap Fetches: 0
 Execution Time: 0.101 ms                       ← nhanh 158 lần
```

Chú ý dòng `Index Cond`: Postgres đã dịch `LIKE 'u49999%'` thành một **khoảng** `>= 'u49999'` và
`< 'u4999:'` (ký tự `:` là ký tự ngay sau `9`). Đó chính là cơ chế "prefix dùng được index".

Còn `LIKE '%49999%'` thì đo được `Seq Scan`, 20.462 ms — và không có index B-tree nào cứu được, vì
không có tiền tố để định khoảng. Lựa chọn cho tìm kiếm giữa chuỗi:
- **pg_trgm + GIN index** — hợp cho "tìm gần đúng" trên vài triệu dòng.
- **Full-text search** (`tsvector` + GIN) — hợp khi tìm theo từ.
- **Elasticsearch / Meilisearch** — khi search là tính năng chính chứ không phải phụ.

Nói được câu "em phải đo mới biết, vì nó phụ thuộc collation của database" là điểm cộng lớn.

</details>

### 5. Thứ tự cột trong composite index quan trọng thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Rất quan trọng. Index `(a, b)` phục vụ được `WHERE a=?` và `WHERE a=? AND b=?`
nhưng **không** phục vụ `WHERE b=?`. Quy tắc: cột lọc bằng (`=`) đứng trước, cột lọc khoảng
(`>`, `<`) và cột dùng để `ORDER BY` đứng sau.

**Giải thích sâu:** Đo với `CREATE INDEX idx_orders_user_status ON orders(user_id, status)`:

```sql
SELECT count(*) FROM orders WHERE user_id = 42;
 Index Only Scan using idx_orders_user_status  ← dùng được, chỉ cần cột đầu
 Execution Time: 0.045 ms

SELECT count(*) FROM orders WHERE status = 'pending';
 Parallel Seq Scan on orders (actual rows=66683 loops=3)   ← KHÔNG dùng được
 Execution Time: 47.120 ms
```

**Nhanh hơn 1000 lần chỉ vì thứ tự cột.** Hình dung như danh bạ sắp theo (họ, tên): tra "Nguyễn"
thì dễ, tra tất cả người tên "An" thì phải đọc cả quyển.

Quy tắc đặt thứ tự, theo đúng thứ tự ưu tiên:

```
1. Các cột so sánh bằng (=)          -- càng nhiều càng tốt, đặt trước
2. Cột dùng ORDER BY                 -- để tránh bước Sort
3. Cột so sánh khoảng (>, <, BETWEEN) -- chỉ cột khoảng ĐẦU TIÊN có tác dụng
4. Cột chỉ để SELECT ra              -- INCLUDE, để đạt index-only scan
```

Ví dụ query thật `WHERE user_id=? AND created_at > ? ORDER BY created_at DESC LIMIT 20` thì index
đúng là `(user_id, created_at DESC)` — và nó xoá luôn cả bước sort.

Điểm quan trọng cuối: một index `(a, b, c)` đã bao gồm khả năng của `(a, b)` và `(a)`, nên **đừng
tạo cả ba** — đó là cách phổ biến nhất để làm chậm ghi mà không lợi gì cho đọc.

</details>

### 6. Index-only scan là gì? Nó liên quan gì tới `SELECT *`?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi mọi cột query cần đều nằm trong index, Postgres trả kết quả **chỉ từ index**,
không đụng tới bảng. `SELECT *` gần như luôn phá được tối ưu này.

**Giải thích sâu:** Nhìn dòng `Heap Fetches` trong plan:

```
 Index Only Scan using idx_users_status on users (actual rows=10000 loops=1)
   Heap Fetches: 0                   ← 0 = hoàn toàn không đọc bảng
 Execution Time: 0.551 ms
```

`Heap Fetches: 0` là điều bạn muốn thấy. Nếu nó lớn hơn 0 đáng kể, nghĩa là Postgres vẫn phải quay
về heap — thường vì visibility map chưa cập nhật (bảng vừa được ghi nhiều, chưa `VACUUM`).

Cách chủ động đạt index-only scan là dùng `INCLUDE`:

```sql
CREATE INDEX idx_orders_user ON orders(user_id) INCLUDE (total, status);
-- SELECT total, status FROM orders WHERE user_id = ? -> không đụng bảng
```

`INCLUDE` khác với đưa cột vào index chính: các cột `INCLUDE` chỉ được **lưu kèm**, không tham gia
sắp xếp — nên index nhỏ hơn và ghi rẻ hơn.

Nối về `SELECT *`: ngoài chuyện phá index-only scan, nó còn kéo thêm băng thông và làm API vỡ ngầm
khi ai đó thêm cột (một cột `password_hash` mới thêm sẽ tự động lọt ra response nếu tầng serialize
không chặn). Đây là câu trả lời "vì sao không `SELECT *`" ở mức senior — chứ không phải "tốn băng
thông".

</details>

### 7. Bạn nhìn `EXPLAIN ANALYZE` như thế nào? Nhìn cái gì trước?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ba thứ, theo thứ tự: (1) node nào tốn thời gian nhất — đọc **từ trong ra ngoài**;
(2) chênh lệch giữa `rows` ước lượng và `actual rows` — lệch nhiều nghĩa là thống kê sai;
(3) `Buffers` — lượng công việc thật, không bị nhiễu bởi cache.

**Giải thích sâu:** Luôn dùng `EXPLAIN (ANALYZE, BUFFERS)`, không dùng `EXPLAIN` trần —
`EXPLAIN` trần chỉ cho **dự đoán** của planner, còn `ANALYZE` là **chạy thật**.

Bảng đọc nhanh các node hay gặp:

| Thấy gì | Nghĩa là | Đáng lo khi |
|---|---|---|
| `Seq Scan` | quét cả bảng | bảng lớn mà đang lọc ít dòng |
| `Index Scan` | đi index rồi lấy dòng từ heap | hầu như luôn tốt |
| `Index Only Scan`, `Heap Fetches: 0` | chỉ đọc index | lý tưởng |
| `Bitmap Heap Scan` | gom nhiều dòng rồi đọc theo thứ tự đĩa | thường là ổn |
| `Nested Loop` | lặp bảng ngoài, tra bảng trong | `loops` lớn (hàng chục nghìn) |
| `Hash Join` | dựng hash bảng nhỏ | `Batches > 1` = tràn ra đĩa |
| `Sort` + `Sort Method: external merge` | sắp xếp trên **đĩa** | luôn — tăng `work_mem` |
| `Rows Removed by Filter: 166666` | đọc rồi vứt đi | số lớn = thiếu index |

Cụm từ đáng học thuộc để nói ở phỏng vấn: **"em nhìn `Rows Removed by Filter` trước"**. Nó là chỉ
báo trực tiếp của công sức lãng phí. Trong ví dụ ở câu 1, `Rows Removed by Filter: 166666` (× 3
worker) nghĩa là DB đọc 500 nghìn dòng để trả về 1 dòng.

Về `loops`: trong `Nested Loop`, `actual time` của node con là **thời gian trung bình mỗi vòng**,
phải nhân với `loops` mới ra tổng. Rất nhiều người đọc nhầm chỗ này và kết luận sai thủ phạm.

Công cụ nên nhắc: dán plan vào **explain.dalibo.com** hoặc **explain.depesz.com** — nó tô màu node
tốn kém, đọc nhanh hơn nhiều so với đọc text.

</details>

### 8. Tạo index trên bảng đang chạy production thì sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `CREATE INDEX` thường khoá ghi lên toàn bảng cho tới khi xong — với bảng vài chục
triệu dòng là hàng phút downtime ghi. Phải dùng `CREATE INDEX CONCURRENTLY`.

**Giải thích sâu:**

```sql
CREATE INDEX CONCURRENTLY idx_orders_created ON orders(created_at);
```

Cái giá của `CONCURRENTLY`, cần nói ra để chứng tỏ hiểu chứ không chỉ thuộc từ khoá:

- Chậm hơn (quét bảng **hai** lần), tốn CPU/IO nhiều hơn.
- **Không chạy được trong transaction** — nên nhiều công cụ migration cần cấu hình riêng để tắt
  transaction wrapper cho migration này.
- Nếu thất bại giữa chừng, để lại một index **`INVALID`** vẫn tốn chỗ và vẫn được cập nhật khi
  ghi, nhưng không được dùng để đọc. Phải tự phát hiện và dọn:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
DROP INDEX CONCURRENTLY idx_orders_created;
```

Cùng nhóm rủi ro, đáng kể thêm vì hay bị hỏi tiếp: các migration khác khoá bảng.

| Thao tác | An toàn? |
|---|---|
| `ADD COLUMN ... DEFAULT ...` (PG 11+) | An toàn, chỉ ghi metadata |
| `ADD COLUMN ... NOT NULL` không default | Khoá, phải viết lại bảng |
| `ALTER COLUMN TYPE` | Viết lại cả bảng — nguy hiểm nhất |
| `ADD CONSTRAINT ... CHECK` | Khoá; dùng `NOT VALID` rồi `VALIDATE CONSTRAINT` sau |
| `DROP COLUMN` | Nhanh (chỉ đánh dấu), nhưng không lấy lại chỗ ngay |

Và bẫy chết người ít ai để ý: một `ALTER TABLE` cần `ACCESS EXCLUSIVE LOCK`; nếu có một transaction
cũ đang giữ lock nhẹ trên bảng, `ALTER` sẽ **xếp hàng chờ** — và mọi query mới xếp hàng sau nó.
Một `ALTER` tưởng như tức thời có thể làm đứng cả hệ thống. Luôn đặt `SET lock_timeout = '3s'`
trước migration.

</details>

---

## Phần 2 — Truy vấn và mô hình dữ liệu (câu 9–18)

### 9. N+1 query là gì và nó tệ tới mức nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Lấy danh sách N bản ghi rồi lặp qua để query chi tiết từng cái → 1 + N query.
Vấn đề không nằm ở tổng thời gian DB mà ở **số vòng mạng**, thứ nhân lên theo độ trễ.

**Giải thích sâu:** Đo trên chính máy này, 200 dòng, kết nối qua Unix socket (độ trễ gần như 0):

```
=== N+1: 200 query riêng lẻ ===
so query: 200 | tong thoi gian: 22.514 ms | trung binh: 0.113 ms
=== 1 query gom ===
Time: 0.882 ms
```

**25 lần chậm hơn ngay cả khi không có mạng.** Bây giờ tính lại với thực tế production, DB nằm
ở máy khác, RTT 1 ms:

```
N+1 :  200 × (0.113 + 1.0)  ≈ 223 ms
gom :    1 × (0.882 + 1.0)  ≈   1.9 ms       → chậm hơn 117 lần
```

Và đây mới là 200 dòng. Trang danh sách 1000 dòng thì hơn 1 giây, chỉ để render một bảng.

Cách phát hiện, quan trọng hơn cách sửa:
- Bật log query trong môi trường dev và **đếm số query mỗi request**. Một endpoint tử tế thường
  dưới 10.
- Đặt ngưỡng cảnh báo trong test: nếu một request bắn quá N query thì test fail.
- APM (Datadog, New Relic, Sentry Performance) tự nhận diện pattern này và gắn nhãn "N+1".

Cách sửa theo tầng:
- ORM: eager loading (`relations` trong TypeORM, `with()` trong Eloquent, `include` trong Prisma).
- GraphQL: **DataLoader** — gom các lời gọi trong cùng một tick thành một `WHERE id IN (...)`.
- Thủ công: lấy hết id, chạy một query `IN`, rồi ghép bằng `Map` trong bộ nhớ.

Bẫy ngược lại đáng nói ra để cho thấy bạn không cực đoan: eager loading vô tội vạ tạo ra một
JOIN khổng lồ nhân bản dữ liệu (cartesian explosion). Với quan hệ 1-n nhiều tầng, hai query riêng
rồi ghép trong app thường **nhanh hơn** một JOIN lớn.

</details>

### 10. Phân trang bằng `OFFSET` sai ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `OFFSET n` buộc DB **đọc và vứt bỏ** n dòng đầu, nên trang càng sâu càng chậm
tuyến tính. Và nếu dữ liệu thay đổi giữa hai trang, user thấy bản ghi bị lặp hoặc bị nhảy cóc.

**Giải thích sâu:** Đo trên `orders` 2 triệu dòng:

```sql
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 1500000;
 Limit (actual rows=20 loops=1)
   ->  Index Scan using orders_pkey on orders (actual rows=1500020 loops=1)
 Execution Time: 205.444 ms          ← đọc 1.5 triệu dòng để lấy 20

SELECT * FROM orders WHERE id > 1500000 ORDER BY id LIMIT 20;
 Limit (actual rows=20 loops=1)
   ->  Index Scan using orders_pkey on orders (actual rows=20 loops=1)
 Execution Time: 0.044 ms            ← nhanh hơn 4670 lần
```

Chú ý dòng `actual rows=1500020` — con số đó nói hết: DB đọc một triệu rưỡi dòng rồi vứt đi.

Vấn đề thứ hai nghiêm trọng hơn về mặt nghiệp vụ: giữa lúc user xem trang 1 và bấm sang trang 2, có
người chèn thêm một bản ghi ở đầu. Mọi thứ dịch xuống một ô → bản ghi cuối trang 1 **xuất hiện lại**
ở đầu trang 2. Với một trang danh sách thì phiền; với một job quét dữ liệu theo trang thì đó là
**bỏ sót hoặc xử lý trùng bản ghi**.

Keyset pagination (cursor) sửa cả hai:

```sql
-- Trang đầu
SELECT * FROM orders ORDER BY created_at DESC, id DESC LIMIT 20;
-- Trang sau, truyền lại giá trị cuối của trang trước
SELECT * FROM orders
 WHERE (created_at, id) < ('2026-09-09 10:00:00', 91234)
 ORDER BY created_at DESC, id DESC LIMIT 20;
```

Phải kèm `id` làm tie-breaker, nếu không hai bản ghi cùng `created_at` sẽ gây bỏ sót.

Nhược điểm phải thừa nhận: keyset **không nhảy tới trang 57 được** và không cho biết tổng số
trang. Trả lời trung thực là: giao diện "trang 1 2 3 … 500" hầu như không ai bấm quá trang 3;
với admin cần nhảy trang thì giữ `OFFSET` nhưng giới hạn cứng (ví dụ tối đa trang 100) và ép lọc
theo khoảng thời gian.

</details>

### 11. `COUNT(*)` trên bảng lớn — vì sao chậm và làm sao?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Postgres phải kiểm tra tính hiển thị (MVCC) của **từng dòng**, nên không có
đường tắt — `COUNT(*)` là quét toàn bộ. Đo được 35.6 ms cho 2 triệu dòng.

**Giải thích sâu:**

```sql
EXPLAIN (ANALYZE) SELECT count(*) FROM orders;
 Finalize Aggregate
   ->  Gather (Workers Launched: 2)
         ->  Parallel Seq Scan on orders (actual rows=666667 loops=3)
 Execution Time: 35.614 ms
```

35 ms nghe không tệ — cho tới khi nhận ra nó chạy **mỗi lần load trang danh sách**, và với 20
triệu dòng thì thành 350 ms, và nó cạnh tranh cache với các query khác.

Lựa chọn theo yêu cầu chính xác, đây là chỗ thể hiện tư duy đánh đổi:

| Cần | Cách làm |
|---|---|
| Số ước lượng để hiển thị "khoảng 2 triệu kết quả" | `SELECT reltuples::bigint FROM pg_class WHERE relname='orders'` — tức thì |
| Chỉ cần biết "có nhiều hơn 100 không" | `SELECT count(*) FROM (SELECT 1 FROM orders LIMIT 101) t` |
| Số chính xác, cập nhật liên tục | Bảng đếm riêng + trigger, hoặc cập nhật trong cùng transaction |
| Số chính xác nhưng chậm vài phút cũng được | Materialized view, refresh định kỳ |

Câu hỏi ngược nên hỏi lại người phỏng vấn: **"tổng số này để làm gì?"** Nếu nó chỉ để tính số
trang mà ta đã chuyển sang keyset pagination, thì câu trả lời tốt nhất là **bỏ hẳn nó đi**.

`COUNT(*)` với `WHERE` có index thì khác — như câu 6 đã đo, `count(*) WHERE status='banned'` chạy
index-only scan hết 0.551 ms.

Ghi chú khi so sánh với MySQL/InnoDB: cũng phải quét, cũng không lưu sẵn tổng. MyISAM ngày xưa lưu
sẵn nên `COUNT(*)` tức thì — đó là nguồn gốc của hiểu lầm "count nhanh mà".

</details>

### 12. Khi nào chuẩn hoá, khi nào chấp nhận dữ liệu lặp?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mặc định chuẩn hoá — vì tính đúng đắn dễ mất hơn tính nhanh. Phi chuẩn hoá khi đã
**đo được** rằng JOIN là nút cổ chai, và khi bạn có cách giữ bản sao đồng bộ.

**Giải thích sâu:** Ba trường hợp phi chuẩn hoá là **đúng**, không phải tối ưu sớm:

1. **Dữ liệu lịch sử phải bất biến.** Đơn hàng lưu `product_name`, `unit_price` tại thời điểm mua.
   Đây không phải phi chuẩn hoá — đây là mô hình đúng: giá hôm nay đổi không được phép sửa hoá
   đơn năm ngoái. Đọc theo `product_id` để lấy giá là **sai nghiệp vụ**.
2. **Trường tổng hợp đọc rất nhiều.** `posts.comment_count`. Đo trước: nếu `COUNT` mỗi lần render
   feed là 40% thời gian query thì cột đếm là hợp lý — kèm cách cập nhật đáng tin (trigger, hoặc
   cùng transaction với insert comment).
3. **Bảng đọc chuyên dụng.** Bảng/materialized view phục vụ báo cáo, chấp nhận trễ vài phút.

Rủi ro phải nói kèm, nếu không sẽ bị hỏi móc: bản sao **sẽ** lệch. Không phải "có thể", mà là
"sẽ" — vì retry, vì job chết giữa chừng, vì ai đó sửa tay trên production. Nên đi kèm:
- Một job **đối soát** chạy đêm, log ra chênh lệch.
- Một cách **tính lại** từ nguồn gốc khi cần.

Câu tóm gọn ăn điểm: "Chuẩn hoá bảo vệ tính đúng đắn, phi chuẩn hoá mua tốc độ bằng nợ nhất quán.
Em chỉ vay khi đã đo và có kế hoạch trả."

</details>

### 13. Soft delete — nên hay không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Hữu ích khi cần khôi phục hoặc cần audit, nhưng nó **nhiễm vào mọi query** và
phá vỡ ràng buộc unique. Ở nhiều hệ thống, chuyển sang bảng lưu trữ (archive) sạch hơn.

**Giải thích sâu:** Ba vấn đề cụ thể, kèm cách xử lý:

**1. Quên `WHERE deleted_at IS NULL`.** Chỉ cần một chỗ quên là dữ liệu đã xoá hiện lại. Đây là
loại bug lọt qua review dễ nhất. Cách chống ở tầng DB — dùng view và cấm truy cập bảng gốc:

```sql
CREATE VIEW users_active AS SELECT * FROM users WHERE deleted_at IS NULL;
```

**2. Unique constraint vỡ.** `UNIQUE(email)` sẽ chặn user đăng ký lại bằng email đã "xoá". Sửa
bằng partial unique index:

```sql
CREATE UNIQUE INDEX ON users(email) WHERE deleted_at IS NULL;
```

**3. Bảng phình mãi.** 90% dòng đã xoá vẫn nằm trong mọi index và mọi lần quét. Index nên là
partial để bỏ qua chúng: `CREATE INDEX ... WHERE deleted_at IS NULL`.

Và vấn đề pháp lý ngày càng quan trọng: **GDPR / Nghị định 13 về bảo vệ dữ liệu cá nhân** yêu cầu
xoá thật khi người dùng yêu cầu. "Soft delete" không phải là xoá. Thiết kế thực dụng: soft delete
30 ngày cho phép khôi phục, sau đó job xoá cứng hoặc ẩn danh hoá (thay email bằng
`deleted-<id>@invalid`, xoá tên, giữ lại id để không vỡ khoá ngoại của đơn hàng).

</details>

### 14. UUID hay auto-increment làm khoá chính?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** UUID khi cần sinh id ở client hoặc gộp dữ liệu từ nhiều nguồn; số tăng dần khi
ưu tiên hiệu năng ghi và dung lượng index. UUIDv4 làm index phình và ghi chậm; **UUIDv7 giải
quyết được phần lớn** vì nó tăng dần theo thời gian.

**Giải thích sâu:** Đánh đổi cụ thể:

| | `bigserial` | UUIDv4 | UUIDv7 |
|---|---|---|---|
| Kích thước | 8 byte | 16 byte | 16 byte |
| Thứ tự ghi | tuần tự | **ngẫu nhiên** | tuần tự theo thời gian |
| Chia tách B-tree | ít | nhiều, index phình | ít |
| Sinh ở client | không | có | có |
| Lộ thông tin | có (đoán được số đơn hàng) | không | lộ thời điểm tạo |

Cơ chế đằng sau "UUIDv4 ghi chậm": B-tree ghi hiệu quả nhất khi khoá mới luôn vào cuối — chỉ một
trang ở cuối index bị bẩn. Khoá ngẫu nhiên rơi vào khắp nơi trong index, làm bẩn nhiều trang, tăng
random write và giảm hiệu quả cache. Với bảng lớn, chênh lệch thông lượng ghi có thể vài lần.

Vấn đề "lộ thông tin" của số tăng dần rất thật: nếu URL là `/orders/1042`, đối thủ đặt hai đơn cách
nhau một ngày là biết bạn có bao nhiêu đơn/ngày. Và nó mời gọi IDOR — thử `/orders/1041` xem có
xem được đơn người khác không.

Giải pháp cân bằng dùng nhiều trong thực tế: **`bigserial` làm khoá chính bên trong, thêm cột
`public_id` (UUID hoặc nanoid) để lộ ra API**. Khoá ngoại và JOIN dùng số 8 byte, còn URL dùng id
không đoán được.

</details>

### 15. Bạn xử lý migration schema trên hệ thống đang chạy thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Bằng nguyên tắc **expand–migrate–contract**: mọi thay đổi phá vỡ đều được tách
thành nhiều bước, mỗi bước tương thích ngược với phiên bản code đang chạy.

**Giải thích sâu:** Vì sao cần: trong lúc rolling deploy, code cũ và code mới **chạy đồng thời**
trong vài phút. Một migration đổi tên cột `name` → `full_name` chạy một phát sẽ làm mọi pod code
cũ lỗi ngay lập tức.

Đổi tên cột an toàn, 4 lần deploy:

```
Deploy 1 (expand)   ADD COLUMN full_name; code ghi CẢ HAI cột, đọc từ `name`
Deploy 2 (migrate)  backfill full_name theo lô; code đọc full_name, vẫn ghi cả hai
Deploy 3            code chỉ dùng full_name
Deploy 4 (contract) DROP COLUMN name
```

Backfill phải **theo lô** chứ không phải một `UPDATE` khổng lồ — một `UPDATE` trên 20 triệu dòng
giữ lock lâu, sinh khối lượng WAL lớn, và làm replica trễ:

```sql
UPDATE users SET full_name = name WHERE id BETWEEN 1 AND 10000 AND full_name IS NULL;
-- lặp, nghỉ vài trăm ms giữa các lô để replica đuổi kịp
```

Vài luật khác nên kể ra:
- **Migration phải chạy được lại** (idempotent) — deploy có thể bị retry.
- **Đừng gộp migration schema và migration dữ liệu** vào một file. Cái đầu nhanh và phải khoá,
  cái sau chậm và không được khoá.
- Luôn `SET lock_timeout` và `statement_timeout` trước migration — thà migration fail còn hơn treo
  cả database.
- **Có kịch bản rollback**, và biết rõ những gì không rollback được (`DROP COLUMN` là mất dữ liệu).

</details>

### 16. Khi nào dùng NoSQL thay vì SQL?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi mô hình truy cập đơn giản và cố định nhưng quy mô rất lớn, hoặc dữ liệu thật
sự không có schema. Không phải "vì nó nhanh hơn" — Postgres điều chỉnh tốt vượt xa mức mà đa số dự
án đạt tới.

**Giải thích sâu:** Trung thực về mặt kỹ thuật là điểm cộng ở đây. Postgres hiện nay làm được phần
lớn việc người ta từng chuyển sang NoSQL để làm:

- `JSONB` + GIN index cho dữ liệu bán cấu trúc, có index và truy vấn được bên trong JSON.
- `LISTEN/NOTIFY` cho pub/sub nhẹ.
- Full-text search với `tsvector`.
- `pgvector` cho tìm kiếm vector.

Các trường hợp NoSQL thật sự đúng:

| Nhu cầu | Lựa chọn | Vì sao |
|---|---|---|
| Ghi rất lớn, truy vấn luôn theo một khoá | Cassandra, DynamoDB | scale ngang tuyến tính, không JOIN |
| Dữ liệu quan hệ nhiều bậc (bạn của bạn) | Neo4j | truy vấn đồ thị trên SQL rất tốn |
| Chuỗi thời gian, ghi liên tục | TimescaleDB, InfluxDB | nén và tổng hợp theo thời gian |
| Search văn bản là tính năng chính | Elasticsearch | ranking, fuzzy, facet |
| Cache / dữ liệu tạm | Redis | trong RAM, cấu trúc dữ liệu phong phú |

Câu hỏi tự vấn nên nói ra: **"Mất transaction và JOIN có làm nghiệp vụ này khó hơn không?"** Với
thương mại điện tử, tài chính, đặt chỗ — mất transaction là mất tiền, câu trả lời gần như luôn là
SQL. Với log, sự kiện, metrics — không cần transaction, NoSQL hợp lý.

Và ý cuối rất được đánh giá cao: **"nhiều loại database đồng nghĩa nhiều thứ phải vận hành, backup,
theo dõi và tuyển người biết dùng."** Chi phí đó thật và thường bị bỏ qua khi so sánh.

</details>

### 17. Read replica giải quyết vấn đề gì, gây ra vấn đề gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó chia tải **đọc**, không chia tải ghi. Vấn đề nó mang lại là **replication lag**:
ghi xong đọc lại ngay có thể không thấy dữ liệu mình vừa ghi.

**Giải thích sâu:** Kịch bản lỗi kinh điển, và nó xuất hiện ở gần như mọi hệ thống dùng replica:

```
1. POST /profile   -> ghi vào primary
2. Redirect        -> GET /profile đọc từ replica
3. Replica trễ 200 ms -> user thấy dữ liệu CŨ, tưởng lưu hỏng, bấm lưu lại
```

Ba cách xử lý, chọn theo nghiệp vụ:

- **Read-your-writes**: sau khi user ghi, ghim các lần đọc của **user đó** vào primary trong vài
  giây (đánh dấu bằng cookie hoặc key trong Redis). Đây là giải pháp thực dụng nhất.
- **Đọc theo LSN**: primary trả về vị trí WAL sau khi ghi, lần đọc sau chờ replica bắt kịp vị trí
  đó. Chính xác nhưng phức tạp.
- **Phân loại query theo mức chịu trễ**: dashboard, báo cáo, danh sách công khai → replica. Màn
  hình sau khi ghi, kiểm tra tồn kho, xác thực → primary.

Cần theo dõi số nào: `pg_last_xact_replay_timestamp()` để biết replica trễ bao nhiêu giây, và cảnh
báo khi vượt ngưỡng. Lag đột ngột tăng thường là dấu hiệu có một transaction ghi khổng lồ hoặc một
query dài trên replica đang chặn việc áp WAL.

Điểm phải nói rõ để không bị hiểu nhầm: **replica không phải là backup.** Bạn `DROP TABLE` nhầm
thì nó nhân bản lệnh đó sang replica trong một giây. Backup là bản chụp theo thời điểm + WAL để
phục hồi tới một mốc (PITR), và **chỉ được coi là có backup khi đã thử phục hồi thành công**.

</details>

### 18. Sharding — khi nào và chia theo cái gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khi một máy không còn chứa nổi dữ liệu hoặc không chịu nổi lượng ghi — sau khi đã
thử hết index, cache, replica và nâng cấp máy. Chọn shard key theo cách mà **hầu hết query chỉ chạm
một shard**.

**Giải thích sâu:** Thứ tự phải làm trước khi nghĩ tới shard, và nói ra thứ tự này quan trọng hơn
nói về sharding:

```
1. Sửa query chậm và thêm index         (thường thu được 10–100x)
2. Cache những gì đọc nhiều
3. Read replica cho tải đọc
4. Nâng cấp máy (một Postgres trên máy 64 lõi / 512 GB đi rất xa)
5. Tách bảng lớn nhất ra service riêng
6. Partition trong cùng một database    (theo thời gian — dễ hơn shard nhiều)
7. Mới tới sharding
```

Chọn shard key — sai lầm ở đây gần như không sửa được:

| Key | Tốt khi | Rủi ro |
|---|---|---|
| `tenant_id` | SaaS B2B | tenant khổng lồ làm lệch tải (hot shard) |
| `user_id` | mạng xã hội, app tiêu dùng | query kiểu "tất cả đơn hôm nay" phải hỏi mọi shard |
| Theo thời gian | log, sự kiện | mọi lượt ghi dồn vào shard mới nhất |
| Hash ngẫu nhiên | tải ghi đều | mọi truy vấn theo khoảng đều phải fan-out |

Những thứ mất đi khi shard, phải nói ra vì đây là phần "đã từng làm thật":
- **JOIN xuyên shard** — phải gom trong tầng ứng dụng.
- **Transaction xuyên shard** — cần saga hoặc two-phase commit, cả hai đều phức tạp.
- **`AUTO_INCREMENT`** — cần snowflake id hoặc UUID.
- **Rebalance** khi thêm shard — đây là phần khó nhất, nên dùng **consistent hashing** hoặc chia
  sẵn nhiều shard logic (ví dụ 1024) rồi ánh xạ nhiều shard logic vào một máy vật lý.

Câu chốt: "Sharding là quyết định một chiều. Em sẽ hỏi trước: dữ liệu đang tăng bao nhiêu mỗi
tháng, và mốc nào thì máy hiện tại thật sự không đủ? Nếu câu trả lời là 3 năm nữa thì có việc khác
đáng làm hơn."

</details>

---

Tiếp: [03-transaction-va-dong-thoi-du-lieu.md](./03-transaction-va-dong-thoi-du-lieu.md)
