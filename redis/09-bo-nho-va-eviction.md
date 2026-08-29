# Bài 09 — Bộ nhớ, `maxmemory` và eviction

Redis sống trong RAM. Bài này trả lời: **điều gì xảy ra khi hết RAM**, và ba câu hỏi phỏng vấn đi kèm.

---

## 1. Không đặt `maxmemory` — sai lầm số một

```
127.0.0.1:6379> CONFIG GET maxmemory
1) "maxmemory"
2) "0"
127.0.0.1:6379> CONFIG GET maxmemory-policy
2) "noeviction"
```

`0` nghĩa là **không giới hạn**. Redis sẽ ăn RAM cho tới khi hệ điều hành gọi **OOM killer** và giết cả
tiến trình — mất toàn bộ dữ liệu trong RAM, không có cảnh báo, không có cơ hội lưu.

Trong container, giới hạn của Docker cũng làm điều tương tự: exit code **137** (`128 + 9` = bị SIGKILL).

**Luôn đặt `maxmemory`**, và đặt ở mức ~70% RAM khả dụng — chừa chỗ cho `fork()` khi `BGSAVE` (xem
[bài 07](./07-persistence.md)) và cho phân mảnh.

---

## 2. Ba thí nghiệm về eviction

Đặt `maxmemory 8mb` rồi nhồi dữ liệu cho tới khi đầy.

### A) `noeviction` (mặc định) — **ghi báo lỗi, đọc vẫn được**

```bash
$ redis-cli CONFIG SET maxmemory 8mb
$ redis-cli CONFIG SET maxmemory-policy noeviction
$ redis-benchmark -n 200000 -r 200000 -t set -P 50 -q
Error from server: OOM command not allowed when used memory > 'maxmemory'.

$ redis-cli INFO stats | grep -E "evicted_keys"
evicted_keys:0
```

Không khoá nào bị xoá. Ứng dụng của bạn bắt đầu nhận `OOM command not allowed...` cho mọi lệnh ghi. Đọc
thì vẫn bình thường.

### B) `allkeys-lru` — **ghi tiếp được, khoá cũ bị đẩy ra**

```bash
$ redis-cli CONFIG SET maxmemory-policy allkeys-lru
$ redis-benchmark -n 200000 -r 200000 -t set -P 50 -q
(chạy hết, không lỗi)

$ redis-cli DBSIZE
(integer) 60237
$ redis-cli INFO stats | grep evicted_keys
evicted_keys:142778             ← 142.778 khoá đã bị đẩy ra để lấy chỗ
```

### C) `volatile-lru` khi **không khoá nào có TTL** — vẫn OOM

Đây là cái bẫy đắt tiền nhất trong bài này.

```bash
$ redis-cli FLUSHALL
$ redis-cli CONFIG SET maxmemory-policy volatile-lru
$ redis-benchmark -n 200000 -r 200000 -t set -P 50 -q
Error from server: OOM command not allowed when used memory > 'maxmemory'.
```

`volatile-*` chỉ được phép xoá **khoá có TTL**. Không khoá nào có TTL → không có gì để xoá → hành xử y
hệt `noeviction`.

**Kịch bản sự cố thật:** bạn đặt `volatile-lru` vì nghĩ nó "an toàn hơn" (chỉ xoá cache có hạn, giữ
session). Rồi một đoạn code mới `SET` mà quên `EX`. Vài tuần sau Redis đầy, và cả hệ thống ngừng ghi
được. `INFO stats` cho thấy `evicted_keys:0` trong khi bộ nhớ đã chạm trần — dấu hiệu nhận biết.

---

## 3. Tám chính sách eviction

| Chính sách | Xoá khoá nào | Dùng khi |
|---|---|---|
| `noeviction` | Không xoá, báo lỗi ghi | Redis là kho dữ liệu, mất khoá là hỏng |
| `allkeys-lru` | Ít được dùng gần đây nhất, trong **mọi** khoá | **Cache thuần — mặc định nên chọn** |
| `allkeys-lfu` | Ít được dùng **thường xuyên** nhất | Cache có nhóm khoá nóng ổn định |
| `allkeys-random` | Ngẫu nhiên | Mọi khoá quan trọng như nhau, cần rẻ |
| `volatile-lru` | LRU, chỉ trong khoá **có TTL** | Trộn cache và dữ liệu bền trong cùng instance |
| `volatile-lfu` | LFU, chỉ trong khoá có TTL | như trên |
| `volatile-random` | Ngẫu nhiên trong khoá có TTL | như trên |
| `volatile-ttl` | Khoá sắp hết hạn nhất | Khi TTL phản ánh đúng độ quan trọng |

**Lời khuyên gọn:** dùng `allkeys-lru` cho instance cache thuần. Nếu bạn thấy mình cần `volatile-*`, đó
là dấu hiệu bạn đang trộn cache với dữ liệu quan trọng trong **cùng một Redis** — hãy tách thành hai
instance thay vì tinh chỉnh chính sách.

### LRU trong Redis là **gần đúng**

Redis không giữ danh sách LRU đầy đủ (quá tốn RAM). Nó lấy mẫu ngẫu nhiên:

```
127.0.0.1:6379> CONFIG GET maxmemory-samples
1) "maxmemory-samples"
2) "5"
```

Mỗi lần cần xoá, lấy 5 khoá ngẫu nhiên và bỏ khoá cũ nhất trong 5 khoá đó. Tăng lên 10 thì chính xác
hơn, tốn CPU hơn.

### LFU đếm theo thang **logarit**

```bash
$ redis-cli CONFIG SET maxmemory-policy allkeys-lfu
$ redis-cli SET nong 1; redis-cli SET lanh 1
$ for i in $(seq 1 200); do redis-cli GET nong > /dev/null; done
$ redis-cli OBJECT FREQ nong; redis-cli OBJECT FREQ lanh
11
5
```

Đọc 200 lần chỉ đưa bộ đếm lên **11**, còn khoá chưa đọc lần nào là **5** (giá trị khởi tạo). Bộ đếm
LFU là 8 bit và tăng theo xác suất giảm dần, nên nó phân biệt "nóng" và "lạnh" chứ không phải đếm chính
xác. Nó cũng **giảm dần theo thời gian** (`lfu-decay-time`, mặc định 1 phút) để khoá từng nóng nhưng
giờ nguội sẽ bị đẩy ra.

`OBJECT FREQ` chỉ dùng được khi đang bật LFU:

```
127.0.0.1:6379> CONFIG SET maxmemory-policy noeviction
127.0.0.1:6379> OBJECT IDLETIME nong
(integer) 14860388
127.0.0.1:6379> CONFIG SET maxmemory-policy allkeys-lfu
127.0.0.1:6379> OBJECT IDLETIME nong
(error) ERR An LFU maxmemory policy is selected, idle time not tracked.
```

---

## 4. Tìm khoá bự — thủ phạm số một

Khoá bự gây hai vấn đề: chiếm RAM, và mọi thao tác lên nó đều treo server (`DEL` một hash 3 triệu trường
= **239ms**, xem [bài 01](./01-string-va-key.md)).

```bash
$ redis-cli --memkeys
Biggest   list found "ds-lon" has 2302175 bytes
Biggest   hash found "hash-lon" has 4950737 bytes
Biggest string found "nho" has 32 bytes
```

Đo một khoá cụ thể:

```
127.0.0.1:6379> MEMORY USAGE hash-lon
(integer) 4950737
127.0.0.1:6379> MEMORY USAGE khoa-bu SAMPLES 0
(integer) 162109522             ← SAMPLES 0 = đếm chính xác, không lấy mẫu
```

Mặc định `MEMORY USAGE` chỉ lấy mẫu 5 phần tử để ước lượng. Với tập hợp có kích thước phần tử không
đều, `SAMPLES 0` cho số đúng nhưng chạy O(N) — cẩn thận trên production.

Xem tổng thể:

```
127.0.0.1:6379> MEMORY DOCTOR
127.0.0.1:6379> MEMORY STATS
```

### Ngưỡng "khoá bự" nên đặt ở đâu

| Kiểu | Bắt đầu đáng lo |
|---|---|
| String | > 100 KB |
| List / Set / Hash / ZSet | > 5.000 phần tử |
| Bất kỳ | `MEMORY USAGE` > 1 MB |

Cách xử lý khoá bự: **chia nhỏ**. Một hash 1 triệu trường → 1000 hash 1000 trường bằng
`HSET user:shard:<id % 1000> <id> <json>`. Vừa tránh treo, vừa tiết kiệm RAM (giữ được `listpack`, xem
[bài 02 mục 5](./02-list-hash-set-zset.md)).

---

## 5. Phân mảnh bộ nhớ

```
127.0.0.1:6379> INFO memory
used_memory_human:7.92M          ← Redis nghĩ nó dùng
used_memory_rss_human:36.98M     ← hệ điều hành cấp cho tiến trình
used_memory_peak_human:135.10M
mem_fragmentation_ratio:4.68
```

`mem_fragmentation_ratio = RSS / used_memory`.

| Giá trị | Nghĩa |
|---|---|
| ~1.0 – 1.5 | Bình thường |
| **> 1.5** | Phân mảnh — RAM đã cấp nhưng không dùng được |
| **< 1.0** | RSS nhỏ hơn dữ liệu → **đang bị swap**, cực chậm. Tắt swap cho máy Redis |

Ở ví dụ trên tỉ lệ **4.68** trông rất tệ, nhưng nguyên nhân là vừa xoá một khoá 155 MB
(`used_memory_peak_human:135.10M` là dấu vết). Hệ điều hành chưa trả RAM về. Đây là lý do phải đọc cả
`peak` chứ không chỉ tỉ lệ — dataset nhỏ luôn cho tỉ lệ cao vì mẫu số nhỏ.

Chống phân mảnh:

```
activedefrag yes
active-defrag-ignore-bytes 100mb
active-defrag-threshold-lower 10
```

Redis sẽ tự dồn bộ nhớ trong nền. Tốn CPU, chỉ bật khi tỉ lệ thực sự cao và dataset đủ lớn.

---

## 6. Giảm RAM — bốn cách theo thứ tự hiệu quả

**a) Đặt TTL cho mọi thứ.** Kiểm tra:
```
127.0.0.1:6379> INFO keyspace
db0:keys=631658,expires=0,avg_ttl=0,subexpiry=0
```
`expires=0` trên instance cache là báo động.

**b) Rút ngắn tên khoá.** Đo thật với 100.000 khoá:
```
khoá ngắn u:N                             -> used_memory:8224248
khoá dài  ung_dung:nguoi_dung:thong_tin:N -> used_memory:11670824   (+42%)
```

**c) Gom nhiều khoá nhỏ vào hash.** Một khoá string tốn ~32 byte overhead; trường trong `listpack` gần
như không tốn gì. 1000 người dùng × 3 trường:
```
3000 khoá string   : used_memory 3117392
1000 hash 3 trường : used_memory 3020504
```

**d) Chọn đúng kiểu.** Đếm UV bằng HyperLogLog thay vì Set:
```
HyperLogLog 100.000 phần tử :     14357 byte
Set         100.000 phần tử :   4261838 byte      ← lớn hơn 297 lần
```

**e) Nén ở tầng ứng dụng.** JSON lớn thì `gzip` trước khi `SET`. Đổi CPU lấy RAM và băng thông. Chỉ đáng
với giá trị > vài KB.

---

## 7. Ba câu hỏi phỏng vấn về bộ nhớ

**"Redis đầy RAM thì sao?"**
> Tuỳ `maxmemory-policy`. Mặc định là `noeviction`: mọi lệnh ghi trả
> `OOM command not allowed when used memory > 'maxmemory'`, lệnh đọc vẫn chạy. Nếu là `allkeys-lru` thì
> Redis đẩy khoá cũ ra và tiếp tục ghi — em kiểm tra bằng `evicted_keys` trong `INFO stats`. Nếu không
> đặt `maxmemory` gì cả thì tệ nhất: OOM killer của hệ điều hành giết tiến trình, mất sạch.

**"Vì sao `used_memory_rss` lớn hơn `used_memory` nhiều?"**
> Phân mảnh. Allocator đã trả bộ nhớ về pool nội bộ nhưng chưa trả lại hệ điều hành, thường sau khi xoá
> khoá lớn hoặc eviction hàng loạt. Em nhìn `mem_fragmentation_ratio`; > 1.5 thì cân nhắc `activedefrag
> yes` hoặc restart có kế hoạch. Nhưng phải kiểm tra `used_memory_peak` trước — dataset nhỏ luôn cho tỉ
> lệ cao một cách giả tạo.

**"Làm sao tìm khoá đang ăn hết RAM?"**
> `redis-cli --memkeys` (dùng `SCAN` nên an toàn trên production), rồi `MEMORY USAGE <khoa> SAMPLES 0`
> cho khoá nghi ngờ. Nếu là hash/set lớn thì chia shard theo `id % N`. Tuyệt đối không `KEYS *` — em đo
> rồi, trên 631k khoá nó giữ server 151ms và đẩy độ trễ p-max từ 2ms lên 62ms.

---

## 8. Bài tập

1. Đặt `maxmemory 10mb` + `noeviction`, nhồi đầy bằng `redis-benchmark`, và ghi lại thông báo lỗi.
2. Lặp lại với `allkeys-lru` và so `DBSIZE` + `evicted_keys` giữa hai lần.
3. Tái hiện bẫy `volatile-lru` không có khoá nào TTL. Sau đó thêm TTL cho một nửa số khoá và chạy lại —
   lần này `evicted_keys` có tăng không?
4. Tạo một hash 1 triệu trường, đo `MEMORY USAGE`, rồi chia thành 1000 hash 1000 trường và đo lại tổng.
5. Đo `mem_fragmentation_ratio` trước và sau khi xoá một khoá 100 MB.

<details>
<summary>Gợi ý đáp án</summary>

**1.** `Error from server: OOM command not allowed when used memory > 'maxmemory'.`

**2.** Với `allkeys-lru`, `DBSIZE` ổn định ở mức Redis nhồi vừa `maxmemory`, còn `evicted_keys` tăng
liên tục. Đo trên máy này: `DBSIZE=60237`, `evicted_keys=142778`.

**3.** Có. `volatile-*` chỉ cần **một** khoá có TTL là bắt đầu xoá được. Nhưng nếu số khoá có TTL quá ít
so với lượng cần giải phóng, nó xoá hết chúng rồi lại OOM.

**4.** Hash 1 triệu trường ở `hashtable` tốn nhiều hơn hẳn 1000 hash 1000 trường ở `listpack`. Trên máy
này, hash 3 triệu trường = 162.109.522 byte (155 MB) → ~54 byte/trường; `listpack` với 512 trường tốn
5958 byte → ~11.6 byte/trường. Chênh gần **5 lần**.

**5.** Tỉ lệ nhảy vọt ngay sau khi xoá (đo được 4.68 trên máy này), rồi giảm dần khi allocator tái sử
dụng vùng nhớ đó cho dữ liệu mới.
</details>

---

Tiếp theo: [10-thuc-chien-nodejs.md](./10-thuc-chien-nodejs.md)
