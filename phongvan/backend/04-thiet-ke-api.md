# Thiết kế API — 16 câu

Nhóm câu này ít "đúng/sai" hơn nhóm database, nên nó đo **cách bạn lập luận**. Người phỏng vấn
thường không tìm câu trả lời chuẩn mà tìm xem bạn có nghĩ tới người dùng API của mình không:
client cũ, retry, phiên bản, lỗi.

---

### 1. REST, GraphQL, gRPC — chọn cái nào cho việc gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** REST cho API công khai và CRUD (đơn giản, cache HTTP hoạt động sẵn). GraphQL khi
nhiều client cần hình dạng dữ liệu khác nhau và bạn muốn tránh làm endpoint riêng cho từng màn
hình. gRPC cho giao tiếp nội bộ giữa các service, nơi cần tốc độ và hợp đồng chặt.

**Giải thích sâu:**

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Định dạng | JSON | JSON | Protobuf (nhị phân) |
| Hợp đồng | OpenAPI (tuỳ chọn) | schema (bắt buộc) | .proto (bắt buộc) |
| Over-fetching | có | không | không |
| Cache HTTP | dùng được ngay | khó (thường POST) | không |
| Trình duyệt gọi thẳng | có | có | cần grpc-web |
| Debug bằng curl | dễ | được | khó |

Cái giá thật của GraphQL, phải nói ra nếu không sẽ bị cho là chỉ nghe đồn:
- **N+1 là mặc định**, không phải ngoại lệ — mỗi resolver tự đi query. Bắt buộc phải có DataLoader.
- **Query độc hại**: client lồng `friends { friends { friends } }` sâu 10 tầng làm sập server. Cần
  giới hạn độ sâu và tính "chi phí" của query.
- **Mất cache tầng HTTP/CDN** — thứ vốn miễn phí với REST.
- Rate limit theo số request trở nên vô nghĩa, phải rate limit theo độ phức tạp query.

Câu trả lời tốt nhất thường là **kết hợp**: gRPC giữa các service nội bộ, REST cho API công khai và
webhook, GraphQL cho BFF (backend-for-frontend) khi app mobile và web cần dữ liệu khác nhau.

</details>

### 2. Versioning API thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cách bền nhất là **tránh phải version**: chỉ thêm, không đổi, không xoá. Khi buộc
phải phá vỡ, `/v2/` trên URL là lựa chọn thực dụng nhất vì nó hiển hiện trong log, trong cache, và
trong đầu người dùng API.

**Giải thích sâu:** Thay đổi nào là phá vỡ, thay đổi nào không:

| Thay đổi | Phá vỡ? |
|---|---|
| Thêm field vào response | Không — nếu client parse đúng |
| Thêm field **optional** vào request | Không |
| Thêm field **bắt buộc** vào request | **Có** |
| Đổi tên field | **Có** |
| Đổi kiểu (`"123"` → `123`) | **Có** — và là loại tệ nhất vì lặng lẽ |
| Thêm giá trị mới vào enum | **Có** với client dùng `switch` không có `default` |
| Siết validation chặt hơn | **Có** |

Ba cách version và đánh đổi:

```
/v2/orders                      URL   — rõ, dễ route và cache, "bẩn" theo quan điểm REST thuần
Accept: application/vnd.x.v2+json  Header — sạch, nhưng khó test bằng trình duyệt và dễ bị proxy nuốt
?version=2                      Query — đơn giản, dễ quên, làm rối cache key
```

Phần quan trọng hơn cả cách đánh số là **chính sách vòng đời**, và đây là chỗ senior khác junior:

1. Công bố ngày ngừng hỗ trợ ngay khi ra v2.
2. Trả header `Deprecation: true` và `Sunset: Wed, 01 Jul 2026 00:00:00 GMT` trên v1.
3. **Đo xem còn ai dùng v1** — log theo client id. Không có số liệu này thì không bao giờ dám tắt.
4. Thử "brownout": tắt v1 trong 5 phút vào giờ thấp điểm để những client còn sót nhận ra.

Không có bước 3 thì `/v1` sẽ sống mãi mãi, và đó là kết cục thường thấy nhất.

</details>

### 3. Trả lỗi thế nào cho tử tế?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mã HTTP đúng ngữ nghĩa + body có cấu trúc cố định gồm **mã lỗi dạng chuỗi** để
code xử lý, thông điệp cho người đọc, và chi tiết theo từng field. Không bao giờ lộ stack trace.

**Giải thích sâu:** Định dạng nên theo RFC 9457 (Problem Details) hoặc một cấu trúc riêng nhất quán:

```json
{
  "type": "https://api.x.com/errors/validation",
  "title": "Dữ liệu không hợp lệ",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "traceId": "01H8ZQ3K7Y",
  "errors": [
    { "field": "email", "code": "INVALID_FORMAT", "message": "Email không đúng định dạng" },
    { "field": "age",   "code": "OUT_OF_RANGE",   "message": "Tuổi phải từ 18 tới 100" }
  ]
}
```

Bốn chi tiết làm nên khác biệt:

1. **`code` là chuỗi ổn định**, không phải message. Client `switch` trên `code`; message có thể đổi
   hoặc dịch sang tiếng khác mà không phá client.
2. **Trả về `errors` dạng mảng, không dừng ở lỗi đầu tiên.** Form 10 field mà mỗi lần submit chỉ
   báo một lỗi là trải nghiệm tệ nhất.
3. **`traceId`** khớp với log server. User gửi mã này, bạn tìm ra đúng request trong vài giây.
4. **Không lộ nội bộ.** `duplicate key value violates unique constraint "users_email_key"` cho kẻ
   tấn công biết tên bảng, tên cột, và cả việc email đó đã tồn tại.

Chọn mã HTTP — bảng đủ dùng cho 95% trường hợp:

| Mã | Khi nào |
|---|---|
| 400 | Body không parse được, tham số sai kiểu |
| 401 | Chưa xác thực hoặc token hết hạn |
| 403 | Đã xác thực nhưng không có quyền |
| 404 | Không tồn tại — hoặc **cố tình** giấu 403 để không lộ sự tồn tại |
| 409 | Xung đột trạng thái: trùng, đã bị sửa, hết hàng |
| 422 | Body đúng cú pháp nhưng sai nghiệp vụ |
| 429 | Vượt rate limit — **phải** kèm `Retry-After` |
| 5xx | Lỗi của bạn. Client được phép retry |

Ranh giới 401/403 hay bị hỏi: **401 = "bạn là ai?", 403 = "tôi biết bạn là ai, và bạn không được
phép"**. Trả 401 khi token hết hạn là quan trọng, vì client dựa vào đó để tự refresh token.

</details>

### 4. Phân trang cho API công khai — thiết kế thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cursor-based cho danh sách lớn hoặc thay đổi liên tục; offset chỉ cho dữ liệu nhỏ
và tĩnh. Luôn có giới hạn cứng cho `limit` và luôn có thứ tự sắp xếp ổn định.

**Giải thích sâu:** (Lý do kỹ thuật và số đo — 205 ms so với 0.044 ms — nằm ở
[02-database, câu 10](./02-database-va-truy-van.md).) Ở tầng API, hình dạng nên là:

```json
{
  "data": [ ... ],
  "pagination": {
    "nextCursor": "eyJjIjoiMjAyNi0wOS0wOSIsImkiOjkxMjM0fQ",
    "hasMore": true
  }
}
```

Bốn quy tắc thực dụng:

1. **Cursor là mờ đục (opaque).** Base64 của `(created_at, id)` là được, nhưng phải nói rõ trong
   tài liệu là "đừng parse". Nếu client parse, bạn không đổi được cách phân trang nữa.
2. **`limit` có mặc định và trần cứng** (ví dụ mặc định 20, tối đa 100). Không có trần thì ai đó
   sẽ gọi `?limit=100000` và bạn có một sự cố OOM.
3. **Không trả `total` cho danh sách lớn** — nó buộc phải `COUNT` toàn bảng mỗi request. Nếu client
   thật sự cần, làm endpoint riêng để họ chỉ trả giá khi cần.
4. **Sắp xếp phải ổn định**: luôn kèm tie-breaker `id`, nếu không hai bản ghi cùng thời điểm sẽ gây
   lặp hoặc bỏ sót giữa các trang.

Điểm cộng: nói về giới hạn kích thước response tổng thể. Với JSON 100 bản ghi đo được:

```
JSON  : 13871 byte
gzip  :   948 byte     ← nhỏ hơn 14.6 lần
brotli:   533 byte     ← nhỏ hơn 26 lần
```

Bật nén là thứ rẻ nhất bạn làm được cho API trả JSON — JSON lặp lại tên field nên nén cực tốt.
Brotli tốt hơn gzip nhưng tốn CPU hơn khi nén; thực dụng là dùng brotli mức thấp (4–5) cho response
động, mức cao cho file tĩnh.

</details>

### 5. Rate limiting — thuật toán nào, và giới hạn theo cái gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Sliding window counter hoặc token bucket, lưu trong Redis vì phải dùng chung giữa
các instance. Giới hạn theo **danh tính** (user/API key) là chính, theo IP là phụ — vì IP bị chia
sẻ bởi NAT và dễ giả mạo qua proxy.

**Giải thích sâu:**

| Thuật toán | Cách chạy | Nhược |
|---|---|---|
| Fixed window | đếm theo phút | **cho phép gấp đôi ở ranh giới**: 100 req cuối phút 1 + 100 req đầu phút 2 |
| Sliding log | lưu timestamp từng request | chính xác nhất, tốn bộ nhớ nhất |
| Sliding window counter | nội suy giữa hai cửa sổ | cân bằng tốt — lựa chọn mặc định |
| Token bucket | token nạp đều, cho phép bùng nổ | tốt khi muốn cho phép burst ngắn |

Cài bằng Redis, chú ý tính nguyên tử:

```
INCR ratelimit:user:42:1757000000
EXPIRE ratelimit:user:42:1757000000 60 NX
```

Hai lệnh này phải nằm trong một script Lua hoặc một pipeline — nếu tiến trình chết giữa `INCR` và
`EXPIRE`, key sống mãi và user đó bị chặn vĩnh viễn.

Header bắt buộc trả về, vì client tử tế sẽ tôn trọng nó:

```
RateLimit-Limit: 100
RateLimit-Remaining: 3
RateLimit-Reset: 42
Retry-After: 42          ← khi đã trả 429
```

Ba điểm nâng cao đáng nói:
- **Giới hạn khác nhau cho endpoint khác nhau.** `POST /login` và `POST /password-reset` phải chặt
  hơn `GET /products` rất nhiều — chúng là mục tiêu của brute force và của việc gửi thư rác.
- **Phân biệt rate limit với quota.** Rate limit chống dồn dập tức thời; quota (10 nghìn
  request/tháng) là chuyện thương mại.
- **Nghĩ tới chuyện Redis chết.** Fail-open (cho qua hết) thì mất bảo vệ; fail-closed (chặn hết)
  thì Redis chết kéo sập cả API. Thường chọn fail-open kèm cảnh báo, nhưng **fail-closed cho các
  endpoint nhạy cảm** như đăng nhập.

</details>

### 6. Idempotency ở tầng API — cái gì idempotent sẵn, cái gì phải tự làm?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `GET`, `PUT`, `DELETE`, `HEAD` idempotent theo đặc tả. `POST` thì không — và đó
là lý do mọi API tạo tài nguyên có tác dụng phụ về tiền bạc đều cần `Idempotency-Key`.

**Giải thích sâu:** Cách cài chi tiết nằm ở [01-runtime, câu 15](./01-runtime-va-dong-thoi.md).
Ở đây là phần thiết kế API:

`DELETE` idempotent nghĩa là **gọi lần hai vẫn trả 204**, không phải 404. Trạng thái sau khi gọi là
như nhau — tài nguyên không tồn tại — nên đó mới là hành vi đúng. Trả 404 làm client retry tưởng
mình đã xoá nhầm gì đó.

`PUT` idempotent vì nó thay thế toàn bộ. `PATCH` thì **tuỳ nội dung**: `{"status":"paid"}` là
idempotent, còn `{"op":"increment","field":"views"}` thì không.

Bảng nhanh:

| Method | Idempotent | An toàn (không đổi state) | Cache được |
|---|---|---|---|
| GET | có | có | có |
| HEAD | có | có | có |
| PUT | có | không | không |
| DELETE | có | không | không |
| POST | **không** | không | hiếm khi |
| PATCH | tuỳ | không | không |

Chi tiết đáng nói vì nó xảy ra thật: **retry của tầng hạ tầng**. Load balancer, service mesh, thư
viện HTTP client — nhiều thứ tự động retry `GET`/`PUT` mà không hỏi bạn. Nếu bạn cài `GET
/orders/123/send-invoice` để gửi hoá đơn thật, hạ tầng sẽ gửi nhiều lần. **Đừng để `GET` có tác
dụng phụ** — đây cũng là lý do prefetch của trình duyệt hoặc trình quét link của Slack có thể xoá
dữ liệu nếu bạn làm nút "Xoá" bằng một link `GET`.

</details>

### 7. Webhook — thiết kế phía gửi và phía nhận

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Phía gửi: ký HMAC, có timestamp chống replay, retry với backoff, và có trang cho
người dùng xem lại lần gửi. Phía nhận: xác minh chữ ký, trả 2xx **thật nhanh**, xử lý bất đồng bộ,
và chấp nhận nhận trùng.

**Giải thích sâu:**

**Phía gửi:**
```
X-Signature: t=1757000000,v1=5257a869e7...
             HMAC_SHA256(secret, "1757000000." + raw_body)
```
- Ký trên **raw body**, không phải body đã parse — parse rồi stringify lại làm đổi thứ tự key và
  chữ ký sai.
- Có `t` (timestamp) trong chuỗi ký và bên nhận từ chối nếu lệch quá 5 phút → chống replay.
- Retry theo lịch giãn dần: 1 phút, 5 phút, 30 phút, 2 giờ, 12 giờ. Sau đó vô hiệu hoá endpoint và
  báo cho khách hàng.
- **Timeout ngắn (5–10 giây).** Bên nhận chậm không được phép làm nghẽn hàng đợi của bạn.
- Cho phép **gửi lại thủ công** và xem lịch sử payload. Đây là tính năng cứu hộ, luôn được cảm ơn.

**Phía nhận:**
```js
app.post('/webhook', express.raw({type:'*/*'}), async (req, res) => {
  if (!verify(req.body, req.headers['x-signature'])) return res.sendStatus(400);
  await queue.add('webhook', req.body);     // đẩy vào queue
  res.sendStatus(200);                      // trả về ngay, xử lý sau
});
```
- Dùng `timingSafeEqual` để so chữ ký.
- **Trả 2xx trước, xử lý sau.** Xử lý đồng bộ 30 giây là bên gửi timeout và retry, tạo ra bản sao.
- **Chấp nhận trùng:** lưu `event_id` đã xử lý; thấy lại thì bỏ qua. Webhook là at-least-once.
- **Sự kiện có thể tới sai thứ tự.** Đừng giả định `order.paid` luôn tới sau `order.created`; dùng
  timestamp hoặc số thứ tự trong payload, hoặc gọi ngược lại API để lấy trạng thái hiện tại.

</details>

### 8. Upload file lớn qua API — thiết kế thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đừng cho file đi qua server ứng dụng. Cấp **presigned URL** để client upload
thẳng lên S3/GCS, rồi client báo lại key cho backend.

**Giải thích sâu:** Vì sao không đi qua server: file 500 MB đi qua Node chiếm băng thông, chiếm bộ
nhớ đệm, giữ một kết nối trong nhiều phút, và làm mọi giới hạn body size trở nên khó chịu. Với 20
người upload đồng thời, bạn hết RAM.

Luồng đúng:

```
1. Client:  POST /uploads/presign  { filename, contentType, size }
2. Server:  kiểm tra quyền + kích thước tối đa + loại file cho phép
            trả về { uploadUrl, key, expiresIn: 900 }
3. Client:  PUT trực tiếp lên uploadUrl  (không qua server của bạn)
4. Client:  POST /uploads/complete { key }
5. Server:  HEAD object để xác nhận có thật + đúng kích thước,
            rồi mới ghi vào DB và đẩy job xử lý (quét virus, tạo thumbnail)
```

Bước 5 là bước bị bỏ qua nhiều nhất và là lỗ hổng: nếu tin lời client ở bước 4 mà không kiểm tra,
client có thể báo một key không tồn tại hoặc key của người khác.

Các chi tiết còn lại:
- **Ràng buộc ngay trong presigned URL**: `content-length-range` và `Content-Type` để client không
  upload 10 GB hay upload file `.html` (dẫn tới XSS nếu bucket phục vụ trực tiếp).
- **File > 100 MB**: multipart upload để có thể tiếp tục khi đứt mạng.
- **Không tin `Content-Type` client gửi.** Kiểm tra magic bytes ở phía server.
- **Không phục vụ file người dùng từ cùng domain với app** — đặt ở domain riêng để một file HTML
  độc hại không chạy được trong ngữ cảnh cookie của bạn.
- **Dọn rác**: những key đã presign nhưng không bao giờ `complete`. Đặt lifecycle rule trên bucket.

</details>

### 9. Trả về dữ liệu chậm — long polling, SSE hay WebSocket?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** SSE khi chỉ cần server → client (thông báo, tiến độ job, stream token của LLM).
WebSocket khi cần hai chiều liên tục (chat, cộng tác, game). Long polling là phương án dự phòng khi
hạ tầng cũ chặn hai cái kia.

**Giải thích sâu:**

| | SSE | WebSocket | Long polling |
|---|---|---|---|
| Chiều | 1 chiều | 2 chiều | 1 chiều mô phỏng |
| Giao thức | HTTP thường | nâng cấp từ HTTP | HTTP thường |
| Tự kết nối lại | **có sẵn** trong trình duyệt | phải tự viết | tự nhiên |
| Qua proxy/CDN | tốt | hay bị chặn | tốt |
| Nén, HTTP/2 multiplex | có | không | có |
| Auth | dùng cookie/header như thường | header bị hạn chế khi khởi tạo | như thường |

SSE bị đánh giá thấp một cách oan uổng. Nó có `Last-Event-ID` để nối lại đúng chỗ bị đứt, tự retry,
và chỉ là một HTTP response `text/event-stream` — mọi tầng hạ tầng đều hiểu nó.

Điều phải nghĩ tới ở mức senior với **cả hai**: kết nối dài hạn làm hỏng mô hình scale không trạng
thái. Cụ thể:

- Kết nối gắn với **một pod**. Deploy là đứt hết → phải có reconnect với backoff **và jitter**,
  nếu không 50 nghìn client cùng kết nối lại một lúc sẽ đánh sập chính bạn.
- Muốn gửi tin cho một user, bạn phải biết **pod nào** đang giữ kết nối của họ → cần Redis pub/sub
  để phát tin ra mọi pod.
- **Đếm kết nối, không đếm request.** 50 nghìn kết nối rỗi vẫn tốn RAM và file descriptor.
- Load balancer có idle timeout (thường 60 giây) → cần heartbeat để nó không cắt.

</details>

### 10. `PUT` hay `PATCH` cho cập nhật? Xử lý cập nhật một phần thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** `PUT` thay thế toàn bộ tài nguyên — field không gửi coi như bị xoá. `PATCH` sửa
một phần. Trong thực tế `PATCH` phổ biến hơn, nhưng phải xử lý rõ ràng ranh giới giữa "không gửi
field" và "gửi field bằng `null`".

**Giải thích sâu:** Đây là nguồn bug âm thầm rất hay gặp:

```json
PATCH /users/1  { "phone": null }     // muốn XOÁ số điện thoại
PATCH /users/1  { }                    // không đụng tới số điện thoại
```

Nhiều framework parse cả hai thành `{ phone: undefined }` và bạn mất khả năng phân biệt. Hậu quả
điển hình: `PUT` một form chỉ có 3 field trong khi tài nguyên có 10 field → 7 field kia bị xoá
sạch. Bug này thường được phát hiện bởi khách hàng, không phải bởi test.

Cách xử lý:
- Kiểm tra bằng `'phone' in body` chứ không phải `body.phone !== undefined`.
- Hoặc dùng JSON Merge Patch (RFC 7386) và ghi rõ trong tài liệu: `null` = xoá, vắng mặt = giữ
  nguyên.
- Hoặc thiết kế endpoint theo **hành động** thay vì theo field: `POST /users/1/remove-phone`. Ít
  "REST thuần" hơn nhưng ý định rõ ràng, dễ phân quyền và dễ ghi audit log hơn nhiều.

Kèm theo: chống ghi đè đồng thời bằng `ETag` + `If-Match`:

```
GET /users/1        -> ETag: "v7"
PATCH /users/1      -> If-Match: "v7"
                    -> 412 Precondition Failed nếu người khác đã sửa
```

Đây chính là optimistic locking, chỉ là đưa lên tầng HTTP.

</details>

### 11. API công khai nên có những gì mà API nội bộ không cần?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Cam kết ổn định. Cụ thể: tài liệu, chính sách deprecation, rate limit và quota rõ
ràng, sandbox để thử, thông báo lỗi không lộ nội bộ, và cơ chế xác thực tự phục vụ.

**Giải thích sâu:** Khác biệt gốc rễ: API nội bộ có thể sửa bằng cách nhắn cho team kia. API công
khai thì **bạn không biết ai đang dùng và họ dùng thế nào**, và một số client sẽ không bao giờ cập
nhật.

Danh sách những thứ phải có:

- **OpenAPI spec** là nguồn sự thật, và tài liệu **sinh ra từ code** — tài liệu viết tay luôn lệch
  với thực tế sau 3 tháng.
- **Sandbox / test mode** với dữ liệu giả, tách hẳn khỏi production. Không có nó, khách hàng sẽ
  test trên production của bạn.
- **API key tự tạo được**, xoay được, thu hồi được, có phạm vi (scope) hạn chế.
- **Changelog** và email thông báo thay đổi.
- **Trạng thái hệ thống** (status page) và cam kết SLA.
- **Lỗi ổn định**: `code` không đổi qua các phiên bản, vì client đã `switch` trên nó.

Và một nguyên tắc thiết kế quan trọng: **thà chậm ra hơn ra sai**. Mỗi field bạn phơi ra là một
cam kết gần như vĩnh viễn. Không chắc thì đừng thêm — thêm sau dễ, bỏ đi thì gần như không bao giờ.

</details>

### 12. Thiết kế API cho mobile khác gì cho web?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Mobile có mạng chập chờn, pin hữu hạn và **client không cập nhật được** — phiên
bản app cũ sống trên máy người dùng nhiều năm. Vì vậy API cho mobile cần ít vòng gọi hơn, payload
nhỏ hơn, và tương thích ngược lâu hơn.

**Giải thích sâu:** Những điều chỉnh cụ thể:

- **Gộp endpoint theo màn hình.** Web gọi 5 API cho một trang thì không sao (cùng datacenter, HTTP/2
  multiplex). Mobile trên 4G với RTT 150 ms thì 5 vòng tuần tự là 750 ms chỉ riêng độ trễ.
- **Trả kèm dữ liệu hiển thị**, tránh để client phải gọi thêm để tra tên/ảnh.
- **Hỗ trợ đồng bộ tăng dần**: `GET /sync?since=<timestamp|cursor>` trả về thay đổi kể từ lần
  trước, kể cả bản ghi đã xoá (tombstone) — nếu không, app offline không bao giờ biết cái gì đã bị
  xoá.
- **Mọi thao tác ghi phải idempotent**, vì mobile retry rất nhiều khi mạng chập chờn.
- **Đừng bao giờ xoá field** trong response. App phiên bản 2 năm trước vẫn đang chạy trên điện
  thoại ai đó và sẽ crash.
- **Cơ chế ép nâng cấp**: trả về `minSupportedVersion` để app tự hiện màn hình "vui lòng cập nhật".
  Không có nó, bạn không bao giờ dọn được API cũ.

Đây chính là lý do **BFF (backend-for-frontend)** tồn tại: một tầng mỏng riêng cho mobile, gộp và
định hình dữ liệu, để API lõi không phải chiều theo nhu cầu của từng client.

</details>

### 13. Xác thực giữa các service nội bộ

<details><summary>Đáp án</summary>

**Trả lời ngắn:** mTLS ở tầng hạ tầng (service mesh) là chuẩn hiện nay. Nếu chưa có mesh thì token
ngắn hạn do một service danh tính cấp. Tuyệt đối không dùng "API key chung, cấu hình trong biến môi
trường, không bao giờ đổi".

**Giải thích sâu:** Ba mức từ thấp lên cao:

| Mức | Cách | Vấn đề |
|---|---|---|
| Mạng nội bộ tin nhau | không xác thực gì, chỉ chặn firewall | vào được một pod là vào được tất cả |
| Shared secret | mỗi service một API key | xoay khoá thủ công, hay bị lộ trong log/git |
| mTLS | mỗi service có chứng chỉ riêng, tự động xoay | cần hạ tầng (Istio, Linkerd, SPIFFE) |

Vấn đề thiết kế thú vị hơn — và hay được hỏi tiếp: **truyền danh tính người dùng qua nhiều tầng
service**. Hai lựa chọn:

1. **Chuyển tiếp token của user.** Đơn giản, mỗi service tự kiểm tra quyền. Rủi ro: một service bị
   xâm nhập có ngay token đầy quyền của user để gọi bất cứ đâu.
2. **Token exchange.** Gateway đổi token của user thành token nội bộ có phạm vi hẹp cho từng chặng.
   An toàn hơn, phức tạp hơn.

Nguyên tắc phải nói ra dù chọn cách nào: **service nội bộ không được tin `X-User-Id` trong header.**
Nếu nó tin, bất kỳ ai chạm được vào mạng nội bộ đều có thể giả danh bất kỳ user nào. Danh tính phải
đến từ một thứ **đã ký** mà service tự xác minh được.

</details>

### 14. Response nên có cấu trúc bọc ngoài (envelope) không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không cần cho dữ liệu — HTTP đã có mã trạng thái và header. Nhưng **nhất quán**
quan trọng hơn lựa chọn nào là "đúng": chọn một kiểu và giữ nguyên trong toàn API.

**Giải thích sâu:** Hai trường phái:

```json
// Không envelope — dùng ngữ nghĩa HTTP
[ {...}, {...} ]

// Có envelope
{ "success": true, "data": [...], "meta": { "requestId": "..." } }
```

Envelope hợp lý khi: cần trả kèm metadata (phân trang, cảnh báo, phiên bản), hoặc client chạy trong
môi trường không thấy được HTTP status (một số SDK cũ, JSONP).

Envelope **sai** khi nó thay thế mã HTTP: trả `200 OK` với `{"success": false}` phá vỡ mọi thứ dựa
vào tầng HTTP — retry tự động, cache, monitoring, alert theo tỷ lệ lỗi. Dashboard của bạn sẽ báo
"0% lỗi" trong khi hệ thống hỏng hoàn toàn. Đây là điểm quan trọng nhất trong câu này.

Điều thật sự đáng quan tâm hơn: **quy ước đặt tên nhất quán** (`camelCase` hay `snake_case` — chọn
một), định dạng thời gian luôn là ISO 8601 UTC, tiền tệ luôn là số nguyên đơn vị nhỏ nhất (đồng, xu)
kèm mã tiền tệ — **không bao giờ dùng số thực cho tiền**, vì `0.1 + 0.2 !== 0.3`.

</details>

### 15. Làm sao đảm bảo API không vỡ khi bạn sửa code?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Contract test và schema là nguồn sự thật. Sinh code hoặc validate từ OpenAPI, và
chạy kiểm tra tương thích ngược ngay trong CI để một thay đổi phá vỡ **không merge được**.

**Giải thích sâu:** Kim tự tháp cho API:

```
1. Schema là nguồn sự thật (OpenAPI / .proto / GraphQL SDL) — commit vào repo
2. CI so schema mới với schema trên nhánh chính, fail nếu có thay đổi phá vỡ
   (oasdiff cho OpenAPI, buf breaking cho protobuf, graphql-inspector cho GraphQL)
3. Test integration chạy thật qua HTTP, không mock tầng route
4. Contract test với consumer (Pact) khi có nhiều team phụ thuộc
```

Bước 2 là bước có giá trị cao nhất trên mỗi giờ bỏ ra và hay bị bỏ qua nhất. Nó biến "hy vọng không
ai phá API" thành một cổng chặn tự động.

Điểm thường bị bỏ sót: **validate cả response**, không chỉ request. Trong môi trường staging, bật
kiểm tra response theo schema và log cảnh báo khi lệch. Rất nhiều lỗi phá vỡ lọt qua vì test chỉ
kiểm tra vài field mà nó quan tâm, còn field bị đổi kiểu thì không ai để ý cho tới khi client gãy.

</details>

### 16. API của bạn đang chậm. Bạn làm gì đầu tiên?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đo trước khi đoán. Nhìn phân vị p50/p95/p99 theo từng endpoint, tìm xem thời gian
nằm ở đâu (DB, upstream, hay CPU của app), rồi mới sửa. Đừng bao giờ bắt đầu bằng việc thêm cache.

**Giải thích sâu:** Quy trình cụ thể:

```
1. "Chậm" là gì? p50 hay p99? Endpoint nào? Từ khi nào? Với ai?
2. Nhìn biểu đồ: chậm đều hay chỉ tăng vọt? Trùng với deploy nào? Traffic có tăng không?
3. Phân rã thời gian một request: app tự xử lý / chờ DB / chờ upstream / chờ lấy kết nối từ pool
4. Sửa nguyên nhân lớn nhất. Đo lại.
```

Vì sao **p99 quan trọng hơn p50**: một trang gọi 20 API thì xác suất user gặp ít nhất một request
rơi vào p99 là `1 - 0.99^20 ≈ 18%`. Gần một phần năm lượt tải trang chạm vào cái đuôi. Tối ưu p50
từ 100 ms xuống 80 ms gần như không ai cảm nhận được; kéo p99 từ 3 giây xuống 500 ms thì thấy ngay.

Những thứ hay là thủ phạm, theo tần suất thực tế:
1. N+1 query (xem 02-database câu 9).
2. Thiếu index hoặc query bị hàm bọc quanh cột (02-database câu 3).
3. Chờ lấy kết nối từ pool — DB không chậm, chỉ là không đủ chỗ để tới DB.
4. Gọi upstream tuần tự trong khi có thể song song.
5. Serialize JSON của một mảng khổng lồ.
6. Log đồng bộ ra stdout khi stdout bị nghẽn.

Câu chốt ăn điểm: **"Em thêm cache sau cùng, không phải đầu tiên. Cache che đi vấn đề chứ không sửa
nó, và nó mang theo một loạt vấn đề mới về invalidation. Nếu một query mất 2 giây, em muốn biết vì
sao trước đã — thường sửa index xong thì không cần cache nữa."**

</details>

---

Tiếp: [05-cache-queue-va-scaling.md](./05-cache-queue-va-scaling.md)
