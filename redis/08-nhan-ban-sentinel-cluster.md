# Bài 08 — Nhân bản, Sentinel, Cluster

Ba tầng mở rộng của Redis, giải quyết ba bài toán khác nhau:

| | Giải quyết | Không giải quyết |
|---|---|---|
| **Replication** | Đọc nhiều hơn, có bản sao dữ liệu | Master chết vẫn phải sửa tay |
| **Sentinel** | Tự chuyển master khi master chết | Dữ liệu vẫn phải vừa một máy |
| **Cluster** | Dữ liệu lớn hơn RAM một máy, ghi nhiều hơn | Phức tạp, mất một số lệnh |

---

## 1. Replication — một master, nhiều replica

```bash
$ docker network create redisnet
$ docker run -d --name r-master --network redisnet redis:8-alpine
$ docker run -d --name r-replica --network redisnet \
    redis:8-alpine redis-server --replicaof r-master 6379
```

Ngay sau khi khởi động, replica **chưa** đồng bộ:

```
127.0.0.1:6379> INFO replication      (trên replica, sau 3 giây)
role:slave
master_host:r-master
master_link_status:down          ← chưa xong
master_sync_in_progress:0
```

Đây là điều bình thường, đừng hoảng. Đợi thêm vài giây:

```
role:slave
master_link_status:up
master_last_io_seconds_ago:5
```

Trên master:

```
127.0.0.1:6379> INFO replication
role:master
connected_slaves:1
slave0:ip=172.19.0.3,port=6379,state=online,offset=73,lag=1,io-thread=0
master_repl_offset:73
repl_backlog_size:1048576
```

Kiểm tra dữ liệu đã chảy sang:

```bash
$ docker exec r-master redis-cli SET tin "xin chao"
OK
$ docker exec r-replica redis-cli --no-raw GET tin
"xin chao"
```

### Replica chỉ đọc

```
127.0.0.1:6379> SET tin "sua tu replica"
(error) READONLY You can't write against a read only replica.
```

Đây là mặc định (`replica-read-only yes`) và **đừng đổi**. Ghi vào replica tạo ra dữ liệu chỉ tồn tại ở
đó, và bị xoá sạch ở lần đồng bộ đầy đủ tiếp theo.

### Đồng bộ diễn ra thế nào

Log của replica nói rõ từng bước:

```
* Connecting to MASTER r-master:6379
* MASTER <-> REPLICA sync started
* Master replied to PING, replication can continue...
* Partial resynchronization not possible (no cached master)
* PSYNC is not possible, initialize RDB channel.
* MASTER <-> REPLICA sync: receiving streamed RDB from master with EOF to disk
* MASTER <-> REPLICA sync: Loading DB in memory
* MASTER <-> REPLICA sync: Flushing old data
* Done loading RDB, keys loaded: 1, keys expired: 0.
* MASTER <-> REPLICA sync: Finished with success
```

Hai chế độ:

- **Full sync** — master `BGSAVE` (hoặc stream thẳng RDB), gửi cả dataset. Tốn kém.
- **Partial resync (`PSYNC`)** — nếu replica chỉ mất kết nối một lúc và khoảng trống vẫn còn trong
  `repl_backlog`, master chỉ gửi phần thiếu.

`repl-backlog-size` mặc định **1 MB**:

```
127.0.0.1:6379> CONFIG GET repl-backlog-size
2) "1048576"
```

Trên hệ thống ghi nhiều, 1 MB trôi qua trong chưa tới một giây → mọi lần mạng chớp đều thành **full
sync**, tức là master `fork` liên tục. Tăng lên 64–256 MB là chỉnh sửa production đầu tiên nên làm.

### ⚠️ Nhân bản là **bất đồng bộ**

Master trả `OK` cho client **trước khi** replica nhận được dữ liệu. Master chết ngay lúc đó → dữ liệu
mất, kể cả khi có 3 replica.

`WAIT` cho biết đã có bao nhiêu replica xác nhận:

```
127.0.0.1:6379> SET k1 v1
OK
127.0.0.1:6379> WAIT 1 100
(integer) 1                     ← 1 replica đã nhận, trong vòng 100ms
127.0.0.1:6379> WAIT 2 100
(integer) 1                     ← yêu cầu 2, chỉ có 1. Hết 100ms thì trả về con số thật
```

`WAIT` **không** làm cho việc ghi trở thành đồng bộ — nó chỉ **báo cáo** sau khi ghi xong. Bạn phải tự
xử lý khi số trả về nhỏ hơn yêu cầu (ví dụ: báo lỗi cho người dùng, hoặc ghi lại).

Cách chặn ghi khi không đủ replica:

```
min-replicas-to-write 1
min-replicas-max-lag 10
```

Với cấu hình này, master **từ chối ghi** nếu không có ít nhất 1 replica có lag ≤ 10 giây. Đổi tính sẵn
sàng lấy tính an toàn.

### Khoá hết hạn trên replica

Replica **không tự xoá** khoá hết hạn — nó chờ lệnh `DEL` do master gửi xuống. Nhưng khi có client đọc,
replica vẫn kiểm tra hạn và trả `(nil)` nếu quá hạn. Nghĩa là: kết quả **đọc** luôn đúng, chỉ có
`DBSIZE` và `used_memory` trên replica có thể cao hơn thực tế một lúc.

---

## 2. Sentinel — tự động chuyển master

Replication không tự sửa được gì khi master chết. Sentinel là một tiến trình riêng: giám sát, bầu chọn,
và nâng một replica lên làm master.

Cấu hình tối thiểu (`sentinel.conf`):

```
port 26379
sentinel monitor mymaster 172.19.0.2 6379 2
sentinel down-after-milliseconds mymaster 3000
sentinel failover-timeout mymaster 6000
```

Số `2` cuối dòng `monitor` là **quorum** — cần bao nhiêu Sentinel đồng ý rằng master đã chết.

```bash
$ redis-sentinel /etc/sentinel.conf
```

Hỏi Sentinel master hiện tại là ai — đây là cách **client phải dùng**, không hardcode IP:

```
$ redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
1) "172.19.0.2"
2) "6379"
```

### Failover thật — đo từng mốc thời gian

Dựng 1 master + 2 replica + 3 Sentinel, ghi một khoá, rồi `docker kill -s KILL` master:

```
00:32:34.052 # +sdown master mymaster 172.19.0.2 6379
00:32:34.110 # +odown master mymaster 172.19.0.2 6379 #quorum 2/2
00:32:34.110 # +try-failover master mymaster 172.19.0.2 6379
00:32:34.117 # +vote-for-leader 944673b570ae436c2a632298240b2274c8770423 1
00:32:34.179 # +elected-leader master mymaster 172.19.0.2 6379
00:32:34.279 # +selected-slave slave 172.19.0.4:6379
00:32:34.279 * +failover-state-send-slaveof-noone slave 172.19.0.4:6379
00:32:35.205 # +promoted-slave slave 172.19.0.4:6379
00:32:35.264 * +slave-reconf-sent slave 172.19.0.3:6379
00:32:36.220 * +slave-reconf-done slave 172.19.0.3:6379
00:32:36.325 # +switch-master mymaster 172.19.0.2 6379 172.19.0.4 6379
```

Đọc dòng theo dòng — đây chính là câu trả lời cho "Sentinel hoạt động thế nào":

| Sự kiện | Nghĩa |
|---|---|
| `+sdown` | **S**ubjectively down — *một* Sentinel thấy master không trả lời |
| `+odown` | **O**bjectively down — đủ quorum (2/2) đồng ý master chết |
| `+try-failover` → `+vote-for-leader` → `+elected-leader` | Các Sentinel bầu ra **một** đứa cầm trịch |
| `+selected-slave` | Chọn replica tốt nhất (ưu tiên `replica-priority` thấp, offset cao nhất) |
| `+promoted-slave` | Gửi `REPLICAOF NO ONE` cho replica đó |
| `+slave-reconf-*` | Trỏ các replica còn lại về master mới |
| `+switch-master` | Xong |

Xác nhận:

```bash
$ redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster
1) "172.19.0.4"                  ← đã đổi
2) "6379"

$ docker exec sr2 redis-cli INFO replication | head -2
role:master
$ docker exec sr2 redis-cli --no-raw GET truoc-failover
"co"                             ← dữ liệu còn nguyên
```

**Tổng thời gian: 2.3 giây** kể từ khi phát hiện (`down-after-milliseconds 3000`, nên tổng từ lúc master
chết là ~5.3 giây). Trong khoảng đó, mọi lệnh **ghi** đều thất bại. Client phải retry.

### Ba điều bắt buộc nhớ về Sentinel

1. **Phải có số lẻ Sentinel, tối thiểu 3.** Với 2 Sentinel, mất 1 là không còn đủ để bầu.
2. **Đặt 3 Sentinel trên 3 máy khác nhau.** Ba Sentinel cùng một máy thì máy đó chết là mất hết.
3. **Client phải hỏi Sentinel, không hardcode IP master.** `ioredis` hỗ trợ sẵn:
   ```js
   new Redis({
     sentinels: [{ host: 's1', port: 26379 }, { host: 's2', port: 26379 }, { host: 's3', port: 26379 }],
     name: 'mymaster',
   });
   ```

**Split-brain:** nếu master cũ bị cô lập mạng nhưng vẫn sống, nó tiếp tục nhận ghi từ những client cùng
phía mạng. Khi mạng thông trở lại, master cũ bị hạ xuống replica và **mọi ghi trong lúc đó bị xoá**.
Cấu hình `min-replicas-to-write 1` giới hạn cửa sổ này.

---

## 3. Cluster — chia dữ liệu ra nhiều node

Khi dữ liệu không vừa RAM một máy, hoặc lượng ghi vượt một node.

```bash
$ for i in 1 2 3; do
    docker run -d --name c$i --network cnet redis:8-alpine \
      redis-server --cluster-enabled yes --cluster-config-file nodes.conf \
                   --cluster-node-timeout 5000 --appendonly yes
  done

$ docker exec c1 sh -c 'echo yes | redis-cli --cluster create 172.19.0.2:6379 172.19.0.3:6379 172.19.0.4:6379'
>>> Performing hash slots allocation on 3 nodes...
Master[0] -> Slots 0 - 5460
Master[1] -> Slots 5461 - 10922
Master[2] -> Slots 10923 - 16383
...
[OK] All 16384 slots covered.
```

### 16384 hash slot

Mỗi khoá thuộc về đúng một slot: `CRC16(key) mod 16384`.

```
127.0.0.1:6379> CLUSTER KEYSLOT user:1
(integer) 10778
127.0.0.1:6379> CLUSTER KEYSLOT user:2
(integer) 6777
```

Hai khoá tên gần giống nhau nằm ở **hai node khác nhau**. Đây là điểm thay đổi toàn bộ cách bạn viết code.

### `MOVED` — client bị chuyển hướng

```
127.0.0.1:6379> SET user:1 "an"
(error) MOVED 10778 172.19.0.3:6379
```

Không phải lỗi — là chỉ dẫn "khoá này ở node kia". `redis-cli` bình thường không tự đi theo; thêm `-c`:

```bash
$ redis-cli -c SET user:2 "binh"
OK
$ redis-cli -c GET user:2
"binh"
```

Client thư viện (`ioredis`, `node-redis`) tự xử lý `MOVED`, tự dựng bản đồ slot → node. Nhưng bạn phải
khởi tạo ở chế độ cluster:

```js
new Redis.Cluster([{ host: 'c1', port: 6379 }, { host: 'c2', port: 6379 }]);
```

### `CROSSSLOT` — giới hạn lớn nhất của Cluster

```
127.0.0.1:6379> MGET user:1 user:2
(error) CROSSSLOT Keys in request don't hash to the same slot
127.0.0.1:6379> MSET a 1 b 2
(error) CROSSSLOT Keys in request don't hash to the same slot
```

**Mọi lệnh nhiều khoá đều hỏng** nếu các khoá không cùng slot: `MGET`, `MSET`, `SINTER`, `ZUNIONSTORE`,
`SMOVE`, `RENAME`, và cả Lua script:

```
127.0.0.1:6379> EVAL "return redis.call('MGET',KEYS[1],KEYS[2])" 2 user:1 user:2
(error) CROSSSLOT Keys in request don't hash to the same slot
```

Và `MULTI` chỉ dùng được khi tất cả khoá trong khối cùng slot.

### Hash tag `{...}` — cách ép các khoá về chung slot

Nếu tên khoá có `{...}`, Redis **chỉ băm phần trong ngoặc**:

```
127.0.0.1:6379> CLUSTER KEYSLOT "{user:1}:ten"
(integer) 10778
127.0.0.1:6379> CLUSTER KEYSLOT "{user:1}:tuoi"
(integer) 10778                 ← cùng slot

127.0.0.1:6379> MSET "{user:1}:ten" an "{user:1}:tuoi" 28
OK
127.0.0.1:6379> MGET "{user:1}:ten" "{user:1}:tuoi"
1) "an"
2) "28"
```

⚠️ Dùng hash tag quá tay tạo ra **hot slot**: nếu bạn đặt `{app}` cho mọi khoá thì toàn bộ dữ liệu về
một node và bạn vừa mất hết lợi ích của Cluster.

### Những thứ khác bị mất trong Cluster

```
127.0.0.1:6379> SELECT 1
(error) ERR SELECT is not allowed in cluster mode
```

Chỉ có `db0`. Ngoài ra: Pub/Sub thường phát tán tới mọi node (dùng `SPUBLISH`/`SSUBSCRIBE` thay thế),
và `KEYS`/`SCAN` chỉ trả khoá của **node bạn đang nối tới**.

### Trạng thái cluster

```
127.0.0.1:6379> CLUSTER INFO
cluster_state:ok
cluster_slots_assigned:16384
cluster_slots_ok:16384
cluster_slots_pfail:0
cluster_slots_fail:0
cluster_known_nodes:3
cluster_size:3
```

`cluster_state:fail` xuất hiện khi có slot không được node nào phục vụ — mặc định lúc đó **cả cluster
ngừng phục vụ**, kể cả các slot còn sống (`cluster-require-full-coverage yes`). Đổi thành `no` để các
slot còn lại vẫn chạy.

**Production cần replica cho mỗi master:** 3 master không có replica thì mất 1 node là mất 1/3 dữ liệu
và cluster `fail`. Tối thiểu là 3 master + 3 replica = 6 node.

---

## 4. Chọn kiến trúc nào

| Tình huống | Kiến trúc |
|---|---|
| Cache, mất được, dữ liệu vừa RAM | **Một node**, không persistence |
| Cần đọc nhiều, chấp nhận downtime khi sửa tay | **Master + replica** |
| Cần tự phục hồi khi master chết | **Sentinel** (3 sentinel, 1 master, 2 replica) |
| Dữ liệu > RAM một máy, hoặc ghi > 1 node chịu nổi | **Cluster** (≥3 master + 3 replica) |
| Muốn đỡ vận hành | Dịch vụ quản lý (ElastiCache, Memorystore, Redis Cloud) |

**Đừng dùng Cluster khi chưa cần.** Nó thêm rất nhiều ràng buộc lên code (`CROSSSLOT`, hash tag, không
`SELECT`), và một node Redis hiện đại xử lý ~180.000 lệnh/giây không pipeline, hơn 2 triệu khi có
pipeline ([bài 10](./10-thuc-chien-nodejs.md)). Phần lớn ứng dụng không bao giờ chạm trần đó.

---

## 5. Bài tập

1. Dựng master + replica bằng Docker. Ghi vào master, đọc ở replica. Thử ghi vào replica — lỗi gì?
2. Dựng 1 master + 2 replica + 3 Sentinel. `docker kill -s KILL` master và đo bằng đồng hồ: bao lâu thì
   `SENTINEL get-master-addr-by-name` trả về địa chỉ mới?
3. Dựng cluster 3 node. Tìm hai khoá thuộc hai slot khác nhau, thử `MGET` chúng. Rồi dùng hash tag để
   sửa và `MGET` lại.
4. Trên cluster đó, viết một script Lua đụng 2 khoá và cho thấy nó hỏng khi hai khoá khác slot.
5. Tắt một master trong cluster 3 node (không có replica) và xem `CLUSTER INFO`. `cluster_state` là gì?
   Các khoá ở hai node còn lại có đọc được không?

<details>
<summary>Gợi ý đáp án</summary>

**1.** `(error) READONLY You can't write against a read only replica.`

**2.** Trên máy viết tài liệu này: `down-after-milliseconds 3000` + ~2.3 giây failover = **~5.3 giây**.
Giảm `down-after-milliseconds` thì nhanh hơn nhưng dễ failover nhầm khi mạng chớp.

**3.** `CLUSTER KEYSLOT` từng khoá để xác nhận slot khác nhau trước khi thử.

**4.** `(error) CROSSSLOT Keys in request don't hash to the same slot` — kể cả khi bạn khai báo đúng
`numkeys`. Cluster chặn ngay lúc định tuyến, script chưa hề chạy.

**5.** Đo thật, sau khi `kill -9` node thứ ba:
```
127.0.0.1:6379> CLUSTER INFO
cluster_state:fail
cluster_slots_assigned:16384
cluster_slots_ok:10923            ← chỉ còn 2/3 số slot có người phục vụ

$ redis-cli -c GET k1
(error) CLUSTERDOWN The cluster is down
$ redis-cli -c SET moi v
(error) CLUSTERDOWN The cluster is down
```
Với `cluster-require-full-coverage yes` (mặc định) thì **cả hai node còn sống cũng từ chối phục vụ**.
Đổi sang `no` trên các node còn lại:
```
127.0.0.1:6379> CLUSTER INFO
cluster_state:ok
$ redis-cli -c GET k1
Could not connect to Redis at 172.19.0.4:6379: Host is unreachable
```
Cluster hoạt động lại, nhưng khoá nằm trên node đã chết vẫn không lấy được — client bị `MOVED` tới một
địa chỉ không còn tồn tại. Đây là lý do **mọi master trong Cluster đều cần replica**.
</details>

---

Tiếp theo: [09-bo-nho-va-eviction.md](./09-bo-nho-va-eviction.md)
