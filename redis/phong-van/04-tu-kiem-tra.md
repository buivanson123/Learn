# Checklist tự kiểm tra

Đọc từng dòng và tự chấm **thành tiếng**. Nếu ấp úng quá 5 giây thì đánh dấu ❌ và quay lại bài tương ứng.

Cách chấm: mỗi mục 1 điểm. Tổng **90**.

---

## A — Cơ bản (10 điểm)

- [ ] Nói được Redis là gì và 5 việc nó hay được dùng để làm
- [ ] Giải thích được **ba** lý do Redis nhanh, kèm ít nhất một con số đo thật
- [ ] Nói được điểm yếu của mô hình một luồng, kèm ví dụ cụ thể lệnh nào gây tai hoạ
- [ ] Biết `redis-cli --no-raw` để làm gì
- [ ] Biết đọc `INFO memory` — 4 dòng quan trọng
- [ ] Biết đọc `INFO stats` để tính tỉ lệ trúng cache
- [ ] Biết `INFO clients` và ý nghĩa của `blocked_clients`
- [ ] Nói được vì sao **không** nên dùng 16 database của Redis
- [ ] Biết quy ước đặt tên khoá, và biết tên dài tốn RAM thật
- [ ] Nói được **khi nào không nên dùng Redis**

→ Bài [00](../00-cai-dat-va-redis-cli.md), [01](../01-string-va-key.md)

## B — Kiểu dữ liệu (12 điểm)

- [ ] Kể được 5 kiểu cốt lõi + Stream + 3 kiểu đặc biệt
- [ ] Với mỗi kiểu, nói được **một bài toán thật** dùng nó
- [ ] Giải thích được khi nào chọn Hash thay vì String JSON (kèm lý do nguyên tử)
- [ ] Viết được bảng xếp hạng bằng `ZADD` / `ZINCRBY` / `ZREVRANGE` mà không cần tra
- [ ] Biết `ZRANK` đếm từ 0 và theo thứ tự tăng dần
- [ ] Biết `ZADD` có `NX`/`XX`/`GT`/`LT` và dùng để làm gì
- [ ] Biết `SADD` trả về số phần tử **mới** và ứng dụng của nó
- [ ] Biết `SMEMBERS`/`HGETALL`/`LRANGE 0 -1` là O(N) và thay bằng gì
- [ ] Giải thích được `listpack` → `hashtable`/`skiplist` và chi phí khi vượt ngưỡng
- [ ] Biết ngưỡng thật của `hash-max-listpack-entries` trên Redis 8 (**512**, không phải 128)
- [ ] Biết khi nào Bitmap thắng Set và khi nào thua
- [ ] Biết HyperLogLog đánh đổi gì để nhỏ hơn ~300 lần

→ Bài [02](../02-list-hash-set-zset.md)

## C — TTL và bộ nhớ (12 điểm)

- [ ] Phân biệt `TTL` trả `-1` và `-2`
- [ ] Kể được **mọi** lệnh xoá TTL (chỉ có 3)
- [ ] Biết `SET ... KEEPTTL` và khi nào bắt buộc dùng
- [ ] Giải thích được cả **hai** cơ chế xoá khoá hết hạn
- [ ] Biết `EXPIRE ... NX` và vì sao thiếu nó làm hỏng rate limiter
- [ ] Biết `EXPIRE ... GT` và ứng dụng gia hạn session
- [ ] Nói được điều gì xảy ra khi Redis đầy RAM, cả khi có và không có `maxmemory`
- [ ] Kể được 8 chính sách eviction và biết chọn cái nào
- [ ] Giải thích được **cái bẫy `volatile-lru` khi không khoá nào có TTL**
- [ ] Biết LRU của Redis là gần đúng, và LFU đếm theo thang logarit
- [ ] Biết đọc `mem_fragmentation_ratio` và cả trường hợp `< 1.0`
- [ ] Biết `DEL` vs `UNLINK` và con số chênh lệch

→ Bài [03](../03-ttl-va-het-han.md), [09](../09-bo-nho-va-eviction.md)

## D — Cache (14 điểm)

- [ ] Viết được cache-aside từ đầu, không tra
- [ ] Kể được 4 mẫu cache (aside / read-through / write-through / write-behind)
- [ ] Giải thích được vì sao **ghi DB trước rồi xoá cache**, và vì sao hai cách kia sai
- [ ] Biết mẫu "khoá theo phiên bản" và khi nào nó đáng dùng
- [ ] Giải thích được cache **stampede** và cách chống, kèm con số
- [ ] Biết ba chi tiết dễ sai khi dùng khoá chống stampede
- [ ] Giải thích được cache **penetration** và cách chống
- [ ] Phân biệt được `null` (miss) với chuỗi `"null"` (hit rỗng) trong code
- [ ] Giải thích được cache **avalanche** và cách thêm nhiễu vào TTL
- [ ] Giải thích được cache **breakdown** (khoá nóng) và cách trải tải
- [ ] Nói được cái gì nên cache và cái gì không
- [ ] Biết vì sao **không** cache giá trị > 1 MB
- [ ] Viết được đoạn code chịu được Redis chết (try/catch + `commandTimeout`)
- [ ] Nói được rủi ro của graceful degradation (dồn tải xuống DB)

→ Bài [04](../04-cache-pattern.md)

## E — Nguyên tử (10 điểm)

- [ ] Nói được `MULTI/EXEC` **không rollback**, và phân biệt hai loại lỗi
- [ ] Phân biệt được **pipeline** và `MULTI`
- [ ] Giải thích được `WATCH` và ý nghĩa của `EXEC` trả `(nil)`
- [ ] Biết `WATCH` tệ dưới tranh chấp cao, và dùng gì thay
- [ ] Viết được bài toán trừ tồn kho đúng bằng **một lệnh** (không transaction)
- [ ] Biết vì sao tên khoá phải ở `KEYS` chứ không phải `ARGV` trong Lua
- [ ] Biết `EVAL "return 3.9"` trả về gì và vì sao
- [ ] Viết được khoá phân tán đúng: `SET NX EX` + token + nhả bằng Lua
- [ ] Giải thích được vì sao nhả khoá bằng `DEL` là sai (kịch bản cụ thể)
- [ ] Kể được **ba** giới hạn của khoá phân tán Redis, kể cả Redlock

→ Bài [05](../05-transaction-va-lua.md)

## F — Nhắn tin (8 điểm)

- [ ] Nói được khác biệt cốt lõi Pub/Sub vs Stream trong một câu
- [ ] Biết `PUBLISH` trả về gì và ý nghĩa của giá trị `0`
- [ ] Kể được 4 giới hạn của Pub/Sub
- [ ] Giải thích được consumer group, PEL, và `XACK`
- [ ] Biết `XAUTOCLAIM` dùng để làm gì
- [ ] Biết Stream **không tự xoá** và phải `MAXLEN`
- [ ] So sánh được List / Stream / Pub/Sub cho bài toán hàng đợi
- [ ] Nói được vì sao **không** dùng keyspace notification làm scheduler

→ Bài [06](../06-pubsub-va-stream.md)

## G — Bền dữ liệu (7 điểm)

- [ ] So sánh được RDB và AOF trên 4 tiêu chí
- [ ] Nói được **mất bao nhiêu dữ liệu** trong từng cấu hình
- [ ] Biết ba mức `appendfsync` và con số đi kèm
- [ ] Giải thích được `BGSAVE` + copy-on-write, và vì sao có thể tốn gấp đôi RAM
- [ ] Biết `vm.overcommit_memory=1` để làm gì
- [ ] Biết lỗi `MISCONF` và cách xử lý
- [ ] Biết AOF từ Redis 7 là **thư mục** chứ không phải một file

→ Bài [07](../07-persistence.md)

## H — Nhân bản và Cluster (10 điểm)

- [ ] Nói được nhân bản là **bất đồng bộ** và hệ quả
- [ ] Biết `WAIT` làm gì và **không** làm gì
- [ ] Biết `min-replicas-to-write` để làm gì
- [ ] Biết `repl-backlog-size` mặc định 1 MB là quá nhỏ, và hậu quả
- [ ] Giải thích được failover của Sentinel qua các mốc `+sdown` → `+switch-master`
- [ ] Biết vì sao cần **số lẻ** Sentinel và tối thiểu 3
- [ ] Biết client phải hỏi Sentinel thay vì hardcode IP
- [ ] Giải thích được hash slot và `CRC16 mod 16384`
- [ ] Biết `CROSSSLOT` ảnh hưởng những lệnh nào, và cách dùng hash tag
- [ ] Nói được khi nào **không** nên dùng Cluster

→ Bài [08](../08-nhan-ban-sentinel-cluster.md)

## I — Node.js và vận hành (7 điểm)

- [ ] Biết ba tuỳ chọn kết nối quan trọng (`commandTimeout`, `maxRetriesPerRequest`, `enableOfflineQueue`)
- [ ] Biết khi nào phải dùng **client riêng**
- [ ] Biết `await` trong vòng lặp chậm gấp bao nhiêu, và ba cách thay thế
- [ ] Kể được 6 cái bẫy khi dùng Redis từ Node (chuỗi vs số, `hgetall` trả `{}`, …)
- [ ] Viết được vòng `SCAN` đúng (kể cả xử lý khoá trùng)
- [ ] Biết mở `SLOWLOG` và `--latency` khi Redis chậm, và ngưỡng mặc định 10ms là quá cao
- [ ] Biết dùng ACL để chặn `KEYS`/`FLUSHALL` trên production

→ Bài [10](../10-thuc-chien-nodejs.md), [11](../11-van-hanh-va-do-luong.md)

---

## Chấm điểm

| Điểm | Đánh giá |
|---|---|
| **78–90** | Sẵn sàng cho vị trí Middle. Tập trung luyện nói trôi chảy và nhớ con số. |
| **62–77** | Gần đủ. Xem lại các mục ❌, ưu tiên nhóm D (cache) và C (bộ nhớ) — hai nhóm bị hỏi nhiều nhất. |
| **45–61** | Cần học lại có hệ thống. Đọc lại giáo trình theo lộ trình 7 ngày, làm bài tập cuối mỗi bài. |
| **< 45** | Bắt đầu từ [README](../README.md) và làm tuần tự. |

---

## Mười con số nên thuộc lòng

Người phỏng vấn không kiểm tra bạn nhớ chính xác, nhưng nói được **một con số bạn tự đo** thay đổi hoàn
toàn ấn tượng.

| Việc | Con số (đo trên Redis 8.10.0) |
|---|---|
| `SET`/`GET` không pipeline | 178k / 164k ops/s, p50 = 0.135ms |
| `SET`/`GET` pipeline 100 | 2.5M / 3.33M ops/s |
| `KEYS *` trên 631.658 khoá | Chặn server **151ms** |
| Độ trễ khi có ai chạy `KEYS *` | max 1.99ms → **61.96ms** |
| `DEL` hash 3 triệu trường (155 MB) | **239ms**; `UNLINK` không lọt slowlog |
| Script Lua nặng đang chạy | `GET` từ 1ms → **1431ms** |
| Cache stampede, 100 request | 100 lần chạm DB → **1** với khoá `NX` |
| Xuyên cache, 200 request | 200 lần chạm DB → **1** khi cache kết quả rỗng |
| 20 client mua 1 món, không nguyên tử | Bán **17/20**, tồn kho **-16** |
| Failover Sentinel | ~**5.3 giây** (3s phát hiện + 2.3s chuyển) |

Chạy lại các thí nghiệm trong [02-bai-tap-thuc-hanh.md](./02-bai-tap-thuc-hanh.md) và thay bằng **con số
của bạn** — nói "em đo được X trên máy em" luôn mạnh hơn "tài liệu nói X".

---

Quay lại: [README phỏng vấn](./README.md) · [Giáo trình](../README.md)
