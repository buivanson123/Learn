# Bảo mật — 14 câu

Ở vòng senior, câu hỏi bảo mật hiếm khi là "XSS là gì". Nó thường là **"trong hệ thống bạn từng
làm, chỗ nào dễ bị tấn công nhất và bạn xử lý thế nào"**. Người phỏng vấn tìm dấu hiệu bạn nghĩ tới
kẻ tấn công như một người dùng có thật, chứ không phải một mục trong checklist.

---

### 1. SQL injection — chứng minh và chống

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nó xảy ra khi dữ liệu người dùng được **nối vào chuỗi SQL**, khiến dữ liệu trở
thành mã lệnh. Chống bằng tham số hoá (prepared statement) — không phải bằng cách lọc ký tự.

**Giải thích sâu:** Chạy thật trên bảng `members(id, username, password_hash)`. Câu query bị nối
chuỗi với `username = ' OR '1'='1 --`:

```sql
SELECT id, username FROM members
 WHERE username = '' OR '1'='1' --' AND password_hash = 'gi-cung-duoc';

 id | username
----+----------
  1 | admin
  2 | son                 ← trả về TẤT CẢ user, phần kiểm tra mật khẩu bị -- vô hiệu hoá
(2 rows)
```

Cùng đầu vào đó với tham số hoá:

```sql
PREPARE p(text) AS SELECT id, username FROM members WHERE username = $1;
EXECUTE p(''' OR ''1''=''1 --');

 id | username
----+----------
(0 rows)                  ← chuỗi được coi là DỮ LIỆU, không phải mã
```

Điểm mấu chốt để nói: với tham số hoá, database nhận **cấu trúc câu lệnh trước, giá trị sau**. Giá
trị không bao giờ được phân tích lại thành cú pháp SQL, nên không có ký tự nào cần "lọc".

Vì sao lọc ký tự (escape thủ công, chặn dấu nháy) là cách tiếp cận sai: bạn phải đúng 100% số lần,
kẻ tấn công chỉ cần đúng một lần. Và nó vỡ với mã hoá nhiều byte, với comment lồng nhau, với các
hàm chuyển kiểu.

Chỗ ORM vẫn dính, đáng kể ra vì đây là chỗ thật sự xảy ra trong dự án:

```js
db.query(`SELECT * FROM users ORDER BY ${req.query.sort}`)     // tên cột KHÔNG tham số hoá được
repo.createQueryBuilder().where(`name = '${name}'`)            // raw trong query builder
db.query('SELECT * FROM t WHERE id IN (' + ids.join(',') + ')') // danh sách IN nối tay
```

Với những chỗ không tham số hoá được (tên bảng, tên cột, chiều sắp xếp), cách đúng là **danh sách
trắng**: `const dir = req.query.dir === 'desc' ? 'DESC' : 'ASC'`.

</details>

### 2. XSS — ba loại và cách chống ở backend

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Stored (dữ liệu độc lưu trong DB rồi hiện cho người khác), reflected (dội lại từ
tham số URL), DOM-based (JavaScript phía client tự đưa dữ liệu vào DOM). Chống bằng **escape đúng
theo ngữ cảnh xuất ra** + CSP, không phải bằng lọc đầu vào.

**Giải thích sâu:** Nguyên tắc quan trọng nhất và hay bị hiểu ngược: **escape lúc XUẤT, không phải
lúc NHẬP**. Cùng một chuỗi cần escape khác nhau tuỳ nơi nó xuất hiện:

```
Trong HTML text     <  &lt;
Trong thuộc tính    "  &quot;   (và phải luôn có dấu nháy quanh thuộc tính)
Trong <script>      JSON encode; ký tự < phải thành <
Trong URL           encodeURIComponent
Trong CSS           escape theo CSS
```

Nếu lọc lúc nhập, bạn phá dữ liệu hợp lệ (tên "O'Brien", công thức toán có dấu `<`) và vẫn không
an toàn ở ngữ cảnh bạn chưa nghĩ tới.

Trách nhiệm của backend:
- **Không tự dựng HTML bằng nối chuỗi.** Dùng template engine có auto-escape.
- Với nội dung HTML do người dùng gửi (trình soạn thảo rich text): **sanitize bằng thư viện đã được
  kiểm nghiệm** với danh sách trắng thẻ và thuộc tính (DOMPurify, sanitize-html). Tự viết regex để
  lọc `<script>` chắc chắn sẽ bị vượt qua.
- **Header phòng thủ**:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xyz'
  X-Content-Type-Options: nosniff
  ```
- **Trả đúng `Content-Type`.** Trả JSON với `text/html` là biến response JSON thành trang HTML chạy
  được script.

CSP là lớp phòng thủ có giá trị nhất vì nó chặn cả những XSS bạn không biết mình có. Nhưng nó chỉ
hiệu quả khi không có `unsafe-inline` — mà loại bỏ `unsafe-inline` là phần khó nhất khi áp dụng vào
hệ thống cũ.

</details>

### 3. CSRF là gì? Khi nào cần chống, khi nào không?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Trang web độc khiến trình duyệt của nạn nhân gửi request tới site của bạn **kèm
cookie đăng nhập**. Chỉ nguy hiểm khi xác thực dựa vào thứ trình duyệt **tự động gửi kèm** (cookie,
HTTP Basic). API dùng `Authorization: Bearer` thì không bị.

**Giải thích sâu:** Cơ chế tấn công:

```html
<!-- trên trang doc-hai.com, nạn nhân đang đăng nhập bank.com ở tab khác -->
<form action="https://bank.com/transfer" method="POST" id="f">
  <input name="to" value="ke-tan-cong"><input name="amount" value="10000000">
</form>
<script>f.submit()</script>
```

Trình duyệt gửi kèm cookie của `bank.com`. Server thấy cookie hợp lệ và thực hiện lệnh chuyển tiền.
Kẻ tấn công **không đọc được** response (Same-Origin Policy chặn), nhưng lệnh đã chạy — với chuyển
tiền thì thế là đủ.

Ba lớp phòng thủ, nên có cả ba:

1. **`SameSite=Lax` cho cookie** — mặc định của trình duyệt hiện nay, chặn phần lớn CSRF ngay. Lưu
   ý `Lax` vẫn cho phép điều hướng `GET` từ site khác, nên đây lại là một lý do nữa để `GET` không
   bao giờ có tác dụng phụ.
2. **CSRF token**: token ngẫu nhiên gắn theo phiên, nhúng trong form, kiểm tra ở server. Kẻ tấn công
   không đọc được nó vì Same-Origin Policy.
3. **Kiểm tra `Origin` / `Sec-Fetch-Site`** cho request thay đổi dữ liệu.

Khi nào **không** cần: API thuần dùng `Authorization: Bearer <token>` từ localStorage. Trình duyệt
không tự gắn header đó nên tấn công không thực hiện được.

Nhưng đánh đổi phải nói ra: token trong localStorage **đọc được bằng JavaScript**, nên chỉ cần một
lỗ XSS là mất token. Cookie `HttpOnly` thì XSS không đọc được, đổi lại phải chống CSRF. Không có
lựa chọn nào an toàn tuyệt đối — thực dụng nhất hiện nay là **cookie `HttpOnly` + `SameSite=Lax` +
CSRF token** cho ứng dụng web, và Bearer token cho mobile/máy-tới-máy.

</details>

### 4. JWT — lưu ở đâu, và nhược điểm lớn nhất là gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Nhược điểm lớn nhất: **không thu hồi được**. Token đã cấp thì có hiệu lực tới khi
hết hạn, kể cả khi user đã đăng xuất, đã bị khoá tài khoản, hoặc đã đổi mật khẩu. Nên lưu trong
cookie `HttpOnly`, không phải localStorage.

**Giải thích sâu:** Điều nhiều người không nhận ra — **payload JWT ai cũng đọc được**, nó chỉ được
ký chứ không mã hoá:

```
JWT  : 223 byte
payload giải mã: {"sub":"01H8ZQ3K","email":"user@example.com","roles":["admin","editor"],
                  "iat":1757000000,"exp":1757003600}
```

Chỉ cần base64url-decode phần giữa. **Đừng bao giờ đặt dữ liệu nhạy cảm vào JWT.**

So sánh trung thực với session:

| | JWT | Session (id trong Redis) |
|---|---|---|
| Kiểm tra | tự xác minh chữ ký, không cần I/O | phải tra Redis (~1 ms) |
| Thu hồi | **không** (trừ khi có danh sách đen — mà thế thì lại cần tra) | xoá một key là xong |
| Kích thước | 223 byte, gửi kèm **mọi** request | 36 byte |
| Đổi quyền | phải đợi token hết hạn | có hiệu lực ngay |

Nghịch lý đáng nói: lý do chính người ta chọn JWT là "không cần tra database", nhưng ngay khi bạn
cần đăng xuất được hoặc khoá tài khoản được, bạn phải thêm danh sách đen — và lại tra database mỗi
request. Lúc đó session đơn giản hơn mà làm được nhiều hơn.

Mô hình dùng đúng: **access token sống rất ngắn (5–15 phút) + refresh token sống dài, lưu trong DB
và thu hồi được.** Cửa sổ rủi ro thu hẹp còn vài phút, và refresh token thì kiểm soát được.

Kèm theo: **xoay refresh token** (mỗi lần refresh cấp token mới, huỷ token cũ). Nếu một refresh
token cũ bị dùng lại, đó là dấu hiệu bị đánh cắp → huỷ toàn bộ phiên của user đó.

Lỗ hổng kinh điển phải biết: `alg: none` và nhầm lẫn thuật toán (đưa public key RSA vào làm khoá
HMAC). Luôn **chốt cứng thuật toán** khi verify, đừng để nó đọc từ chính header của token.

</details>

### 5. OAuth2 và OIDC — dùng flow nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** **Authorization Code + PKCE** cho mọi ứng dụng có người dùng (web, SPA, mobile).
Client Credentials cho giao tiếp máy-tới-máy. Implicit flow đã bị khai tử — đừng dùng.

**Giải thích sâu:** Phân biệt hay bị hỏi ngay đầu: **OAuth2 là uỷ quyền** ("app này được phép đọc
danh bạ của tôi"), **OIDC là xác thực** ("người này là ai") — OIDC xây trên OAuth2 và bổ sung
`id_token`.

Vì sao PKCE cần thiết ngay cả với web app có backend: nó chống việc `authorization code` bị chặn
giữa đường và dùng lại. Client sinh `code_verifier` ngẫu nhiên, gửi `code_challenge = SHA256(verifier)`
lúc đầu, rồi gửi `verifier` lúc đổi code lấy token. Kẻ chặn được code mà không có verifier thì vô
dụng.

Những chỗ hay sai:
- **Không kiểm tra tham số `state`** → mở đường cho CSRF trên chính luồng đăng nhập, kẻ tấn công có
  thể gắn tài khoản của chúng vào phiên của nạn nhân.
- **`redirect_uri` khớp lỏng lẻo.** Phải so khớp **chính xác toàn bộ chuỗi**; cho phép khớp tiền tố
  là mở đường đánh cắp token qua một URL con.
- **Tin `email_verified` mà không kiểm tra.** Một provider cho phép đăng ký email chưa xác minh có
  thể bị lợi dụng để chiếm tài khoản đã tồn tại của người khác.
- **Lưu access token của bên thứ ba dưới dạng thường.** Phải mã hoá khi lưu.

Câu hỏi nâng cao hay gặp: "user đăng nhập bằng Google, sau đó bằng email/mật khẩu cùng địa chỉ —
xử lý thế nào?" Câu trả lời tốt: liên kết tài khoản dựa trên email **đã xác minh**, và **yêu cầu
xác thực lại** trước khi liên kết. Tự động gộp mà không xác minh là một lỗ hổng chiếm tài khoản.

</details>

### 6. Phân quyền: RBAC hay ABAC? Kiểm tra ở đâu?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** RBAC (theo vai trò) đủ cho phần lớn hệ thống và dễ hiểu. ABAC (theo thuộc tính)
cần khi quyền phụ thuộc quan hệ giữa user và dữ liệu ("chỉ sửa được đơn của chính mình"). Kiểm tra
phải ở **tầng gần dữ liệu nhất**, không phải ở tầng route.

**Giải thích sâu:** Vì sao kiểm tra ở route là không đủ:

```js
// Chỉ kiểm tra vai trò: SAI
router.get('/orders/:id', requireRole('user'), async (req,res) => {
  res.json(await db.getOrder(req.params.id));    // đơn của AI cũng xem được
});
```

Đây là **IDOR** — lỗ hổng phổ biến nhất trong các API thật, và cũng dễ khai thác nhất: chỉ cần đổi
số trong URL. Kiểm tra vai trò trả lời "được làm việc gì", nhưng thiếu vế "trên dữ liệu nào".

Đúng là ràng buộc quyền sở hữu ngay trong truy vấn:

```js
const order = await db.getOrder(req.params.id, { userId: req.user.id });
// SELECT ... WHERE id = $1 AND user_id = $2
if (!order) return res.sendStatus(404);   // 404 chứ không 403: đừng để lộ id nào tồn tại
```

Ba mức triển khai theo quy mô hệ thống:

1. **Kiểm tra trong repository/service** — mọi hàm đọc dữ liệu đều nhận `actor`. Đơn giản, hiệu quả.
2. **Row Level Security của Postgres** — database tự lọc theo `current_setting('app.user_id')`. Không
   thể quên, nhưng khó debug và khó dùng với connection pool.
3. **Policy engine tập trung** (OPA, Cedar) — khi luật phân quyền phức tạp và cần audit riêng.

Điểm cộng lớn: nói về **kiểm thử phân quyền**. Có một bộ test chạy mọi endpoint với vai trò khác
nhau và khẳng định ai bị chặn — đây là loại test rẻ và bắt được lớp lỗi nghiêm trọng nhất.

</details>

### 7. Lưu bí mật (secret) thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Không bao giờ trong git. Biến môi trường là mức tối thiểu; đúng hơn là một secret
manager (Vault, AWS Secrets Manager, Google Secret Manager) với khả năng xoay khoá và ghi lại ai
đã đọc.

**Giải thích sâu:** Thang bậc từ tệ tới tốt:

```
1. Hardcode trong code                     tệ nhất — nằm trong git mãi mãi
2. File .env commit vào git                y hệt như trên
3. File .env KHÔNG commit                  chấp nhận được cho môi trường dev
4. Biến môi trường do CI/CD tiêm vào       mức tối thiểu cho production
5. Secret manager + xoay khoá tự động      đúng
```

Chi tiết hay bị bỏ qua: **secret đã từng commit vào git thì coi như đã lộ vĩnh viễn**, kể cả khi
bạn xoá ở commit sau. Nó vẫn nằm trong lịch sử, trong mọi bản clone, trong cache của GitHub. Cách
xử lý duy nhất đúng là **xoay khoá đó**, không phải xoá commit. Nói được điều này là dấu hiệu rõ
của người từng xử lý sự cố lộ khoá.

Rò rỉ ngoài git, cũng rất thật:
- **Log**: log cả object request kèm header `Authorization`, hoặc log cả body chứa mật khẩu.
- **Thông báo lỗi** gửi lên Sentry kèm biến môi trường.
- **Biến môi trường trong image Docker**: `ENV API_KEY=...` nằm trong layer, ai `docker pull` cũng
  đọc được bằng `docker history`.
- **Response lỗi** trả về connection string đầy đủ.

Nên có: quét secret tự động trong CI (`gitleaks`, `trufflehog`) và pre-commit hook. Nó bắt được lỗi
trước khi lỗi thành vĩnh viễn.

</details>

### 8. Rate limit và chống brute force cho đăng nhập

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Giới hạn theo **cả** tài khoản và IP, tăng độ trễ dần, và thêm CAPTCHA khi vượt
ngưỡng. Quan trọng: thông báo lỗi phải **giống nhau** dù sai email hay sai mật khẩu.

**Giải thích sâu:** Hai kiểu tấn công cần chống khác nhau:

| | Brute force | Credential stuffing |
|---|---|---|
| Cách làm | 1 tài khoản, hàng nghìn mật khẩu | hàng triệu cặp email/mật khẩu rò rỉ, mỗi cặp thử 1 lần |
| Nguồn | thường ít IP | **hàng nghìn IP** (botnet) |
| Giới hạn theo IP có chặn được? | có | **không** |
| Chống bằng | khoá theo tài khoản, tăng độ trễ | phát hiện bất thường, MFA, kiểm tra mật khẩu đã rò rỉ |

Credential stuffing là mối đe doạ thực tế lớn hơn nhiều và không thể chặn bằng rate limit theo IP.
Chống bằng:
- Kiểm tra mật khẩu đăng ký với danh sách đã rò rỉ (Have I Been Pwned k-anonymity API — gửi 5 ký
  tự đầu của hash, không gửi mật khẩu).
- Theo dõi **tỷ lệ đăng nhập thất bại trên toàn hệ thống**; tăng vọt là dấu hiệu đang bị stuffing.
- Bắt buộc MFA cho tài khoản có quyền cao.

Chi tiết về thông báo lỗi:

```
❌ "Email không tồn tại"  /  "Mật khẩu sai"     -> cho phép dò xem ai có tài khoản
✅ "Email hoặc mật khẩu không đúng"
```

Và phải chống **user enumeration qua kênh phụ**: nếu email không tồn tại thì bạn trả lời trong 5 ms,
còn email tồn tại thì mất 100 ms để hash mật khẩu — chênh lệch đó đủ để dò. Cách chữa: **luôn chạy
một lần hash giả** ngay cả khi không tìm thấy user. Cùng nguyên tắc áp cho luồng quên mật khẩu và
luồng đăng ký: luôn trả "nếu email tồn tại, chúng tôi đã gửi hướng dẫn".

Đừng khoá vĩnh viễn tài khoản sau N lần sai — đó chính là một cách để kẻ tấn công khoá tài khoản
người khác (DoS). Dùng khoá tạm có thời hạn tăng dần.

</details>

### 9. SSRF là gì và vì sao nó nguy hiểm trên cloud?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Server bị lừa gửi request tới địa chỉ do kẻ tấn công chọn. Trên cloud nó đặc biệt
nguy hiểm vì server có thể truy cập **metadata endpoint nội bộ** để lấy thông tin xác thực của
chính máy chủ.

**Giải thích sâu:** Chỗ dễ dính nhất: bất kỳ tính năng nào nhận URL từ người dùng — "nhập ảnh từ
URL", webhook do khách hàng cấu hình, trình xem trước link, chuyển PDF từ URL.

```
Kẻ tấn công gửi: http://169.254.169.254/latest/meta-data/iam/security-credentials/
-> lấy được credential IAM của EC2 instance
-> có toàn quyền mà instance đó được cấp
```

Các biến thể phải chặn — đây là chỗ chứng tỏ bạn đã thật sự tìm hiểu:

```
http://127.0.0.1:6379          Redis nội bộ, không cần xác thực
http://[::1]:8080              IPv6 loopback
http://2130706433/             127.0.0.1 dạng số nguyên
http://localtest.me            tên miền công khai TRỎ về 127.0.0.1
http://a.com -> redirect 302 -> http://169.254.169.254   chuyển hướng sau khi đã kiểm tra
```

Vì sao "kiểm tra URL bằng regex" luôn thất bại: bạn kiểm tra chuỗi, còn cái gây hại là **địa chỉ IP
mà nó phân giải ra**, và địa chỉ đó có thể đổi giữa lúc kiểm tra và lúc kết nối (DNS rebinding).

Cách chống đúng, theo thứ tự hiệu quả:

1. **Danh sách trắng domain** nếu nghiệp vụ cho phép — đơn giản và chắc chắn nhất.
2. **Phân giải DNS rồi kiểm tra IP** trước khi kết nối, chặn mọi dải riêng tư (10/8, 172.16/12,
   192.168/16, 127/8, 169.254/16, ::1, fc00::/7). Phải kiểm tra lại sau **mỗi** lần chuyển hướng.
3. **Chặn chuyển hướng** hoặc giới hạn số lần và kiểm tra lại mỗi lần.
4. **Cách ly ở tầng mạng**: cho việc gọi ra ngoài chạy trong một service riêng không có quyền truy
   cập mạng nội bộ và không có IAM role. Đây là lớp phòng thủ đáng tin nhất vì nó không phụ thuộc
   vào việc code kiểm tra đúng.
5. Trên AWS, bắt buộc **IMDSv2** (yêu cầu token qua `PUT`) — nó vô hiệu hoá dạng SSRF đơn giản nhất.

</details>

### 10. Kiểm tra dữ liệu đầu vào ở đâu và như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Ở **biên** của mọi tầng tin cậy, theo **danh sách trắng** (chỉ chấp nhận cái đã
biết là hợp lệ) chứ không phải danh sách đen. Validate ở client là để trải nghiệm; validate ở server
là để an toàn.

**Giải thích sâu:** Nguyên tắc: mọi thứ đến từ ngoài đều không đáng tin — không chỉ body, mà cả:

```
query string, path param, header, cookie, tên file upload, nội dung file,
webhook từ đối tác, dữ liệu đọc từ database do người dùng ghi vào trước đó
```

Mục cuối hay bị quên: dữ liệu trong database **của chính bạn** vẫn có thể chứa mã độc do người dùng
nhập từ 2 năm trước, hoặc do một bug đã được sửa.

Cách làm hiện đại là dùng schema và suy ra kiểu từ đó — validate một lần, có kiểu dùng cho cả code:

```ts
const CreateUser = z.object({
  email: z.string().email().max(254),
  age: z.number().int().min(18).max(120),
  role: z.enum(['user','editor']),          // KHÔNG có 'admin' -> chống leo thang đặc quyền
});
type CreateUser = z.infer<typeof CreateUser>;
```

Ba điểm đáng nói thêm:

- **Mass assignment.** `Object.assign(user, req.body)` cho phép client gửi `{"role":"admin"}` hoặc
  `{"isVerified":true}`. Schema với danh sách trắng field chặn được tận gốc — và đó là lý do phải
  loại bỏ field lạ, chứ không chỉ kiểm tra field đã biết.
- **Giới hạn kích thước ở mọi nơi**: độ dài chuỗi, kích thước mảng, độ sâu JSON, kích thước body.
  Một JSON lồng 10 nghìn tầng có thể làm tràn stack; một mảng 1 triệu phần tử làm hết RAM.
- **Chuẩn hoá trước khi kiểm tra**: chuẩn hoá Unicode, cắt khoảng trắng, chuyển email về chữ thường.
  Nếu không, hai biểu diễn khác nhau của cùng một chuỗi sẽ vượt qua kiểm tra trùng lặp.

</details>

### 11. Upload file — những gì phải kiểm tra?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Kích thước, loại thật (magic bytes chứ không phải phần mở rộng hay `Content-Type`),
tên file đã làm sạch, lưu ngoài web root với tên do server sinh, và phục vụ từ domain riêng.

**Giải thích sâu:** Các đường tấn công cụ thể:

| Tấn công | Cách chống |
|---|---|
| Upload `.php`/`.jsp` rồi gọi để chạy | lưu ngoài thư mục web, **server sinh tên file**, không giữ phần mở rộng do client gửi |
| Path traversal `../../etc/passwd` trong tên file | bỏ hoàn toàn tên client gửi, dùng UUID |
| Upload HTML/SVG chứa script | phục vụ từ **domain riêng**, đặt `Content-Disposition: attachment` |
| Zip bomb / ảnh bom (ảnh nhỏ nhưng giải nén ra khổng lồ) | giới hạn kích thước **sau khi giải nén**, giới hạn số pixel |
| Polyglot (file vừa là ảnh hợp lệ vừa là script) | tái mã hoá ảnh thay vì chỉ kiểm tra |
| Hết dung lượng đĩa | quota theo user, dọn file rác định kỳ |

Ba điểm nhấn:

**Magic bytes chứ không phải phần mở rộng.** `Content-Type` do client gửi và có thể nói dối bất cứ
điều gì; phần mở rộng cũng vậy. Đọc vài byte đầu để xác định loại thật (`file-type` trong Node).

**Tái mã hoá ảnh.** Đưa ảnh qua `sharp`/`imagemagick` để xuất ra file mới — thao tác này loại bỏ
mọi thứ nhét thêm vào (metadata độc, mã lồng trong polyglot) và tiện thể xoá EXIF chứa **toạ độ
GPS**, thứ có thể lộ địa chỉ nhà người dùng.

**Domain riêng cho nội dung người dùng.** Nếu file phục vụ từ `app.com` thì một SVG chứa script sẽ
chạy trong ngữ cảnh cookie của `app.com` — tức là XSS toàn quyền. Từ `usercontent-app.com` thì nó
vô hại.

</details>

### 12. Log những gì và **không** log những gì?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Log đủ để tái hiện một sự cố: ai, làm gì, khi nào, kết quả, `traceId`. Không bao
giờ log mật khẩu, token, số thẻ, CVV, số CMND/CCCD, hay toàn bộ body của request nhạy cảm.

**Giải thích sâu:** Log là một nơi rò rỉ dữ liệu bị đánh giá thấp: nó thường được gửi sang dịch vụ
bên thứ ba, giữ nhiều tháng, và **nhiều người trong công ty đọc được** hơn là database.

Nên có bộ lọc tự động thay vì trông chờ vào kỷ luật của từng người:

```js
const redact = ['password','token','authorization','cookie','creditCard','cvv','ssn','otp'];
// pino có sẵn: logger = pino({ redact: { paths: [...], censor: '[ĐÃ CHE]' } })
```

Lỗi thường gặp và rất thật: `logger.error(err)` với lỗi từ HTTP client — nhiều thư viện gắn cả
object request vào lỗi, gồm cả header `Authorization`. Log lỗi "cho đầy đủ" là cách phổ biến nhất
để token rơi vào hệ thống log.

Nguyên tắc khác:
- **Log có cấu trúc (JSON)**, không phải chuỗi ghép — để tìm kiếm và tổng hợp được.
- **Có `traceId`** xuyên suốt để ghép các log của một request (dùng `AsyncLocalStorage`, xem
  [01-runtime câu 16](./01-runtime-va-dong-thoi.md)).
- **Audit log tách riêng** cho hành động nhạy cảm (đổi quyền, xoá dữ liệu, xem dữ liệu khách hàng),
  với thời hạn lưu dài hơn và quyền truy cập chặt hơn.
- **Đừng log ở mức debug trên production** — vừa tốn tiền vừa tăng rủi ro rò rỉ.

</details>

### 13. Bạn xử lý một lỗ hổng vừa được báo cáo như thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Đánh giá mức độ và phạm vi → chặn tạm thời ngay nếu có thể → sửa → kiểm tra xem
đã bị khai thác chưa → thông báo cho các bên liên quan → hậu kiểm không đổ lỗi cá nhân.

**Giải thích sâu:** Thứ tự này quan trọng, và điểm mấu chốt là **"chặn tạm thời"** đứng trước
"sửa". Ví dụ với một IDOR trên `/api/orders/:id`:

```
1. Trong 10 phút đầu: tắt endpoint bằng feature flag, hoặc chặn ở WAF.
   Downtime của một tính năng chấp nhận được hơn là tiếp tục rò rỉ dữ liệu.
2. Sửa: thêm ràng buộc user_id vào truy vấn.
3. Điều tra: đọc log truy cập, tìm request tới id không thuộc về người gọi.
   -> Đây là lúc bạn phát hiện ra mình có log đủ hay không. Thường là không.
4. Nếu đã bị khai thác: xác định phạm vi dữ liệu bị lộ, và thông báo theo
   nghĩa vụ pháp lý (GDPR yêu cầu báo trong 72 giờ).
5. Hậu kiểm: vì sao review không bắt được? có test cho phân quyền không?
   Còn endpoint nào tương tự? -> quét toàn bộ, không chỉ sửa một chỗ.
```

Bước 5 là bước phân biệt senior: **tìm cả lớp lỗi, không chỉ một trường hợp**. Một IDOR gần như
luôn có anh em ở các endpoint khác viết bởi cùng một khuôn mẫu.

Về văn hoá, nên nói ra: hậu kiểm phải **không đổ lỗi cá nhân**. Câu hỏi đúng không phải "ai viết
dòng này" mà là "vì sao hệ thống của chúng ta cho phép lỗi này lọt tới production". Nếu người ta sợ
bị đổ lỗi, lần sau họ sẽ giấu lỗi — và đó là kết cục tệ hơn nhiều so với bản thân lỗi.

Và nếu lỗ hổng do người ngoài báo: **cảm ơn họ và phản hồi nhanh**, có kênh báo cáo rõ ràng
(`security.txt`). Đối xử tệ với người báo lỗi là cách chắc chắn để lần sau họ công bố công khai
thay vì báo riêng.

</details>

### 14. Phụ thuộc bên thứ ba — quản lý rủi ro thế nào?

<details><summary>Đáp án</summary>

**Trả lời ngắn:** Khoá phiên bản bằng lockfile, quét lỗ hổng tự động trong CI, cập nhật đều đặn
thành thói quen thay vì dồn lại, và **cân nhắc trước khi thêm** một phụ thuộc mới.

**Giải thích sâu:** Rủi ro cụ thể, không chỉ chung chung:

- **Lỗ hổng đã biết** trong thư viện — `npm audit`, Dependabot, Snyk. Điểm quan trọng: rất nhiều
  cảnh báo nằm ở `devDependencies` hoặc ở nhánh code bạn không dùng. Đánh giá theo **khả năng khai
  thác thật**, không chạy theo con số; nếu không, đội sẽ mệt mỏi và bỏ qua tất cả.
- **Chiếm quyền gói (supply chain).** Tác giả bị chiếm tài khoản và phát hành bản độc. Chống bằng:
  lockfile với hash toàn vẹn, `npm ci` thay vì `npm install` trong CI, và **trì hoãn cập nhật** vài
  ngày cho bản mới (`--ignore-scripts` cũng đáng cân nhắc, vì script cài đặt là đường tấn công phổ
  biến).
- **Gói bị bỏ rơi** — không còn ai vá. Vấn đề dài hạn nghiêm trọng hơn người ta tưởng.
- **Typosquatting** — `momentjs` thay vì `moment`. Kiểm tra kỹ tên khi thêm gói mới.

Câu hỏi nên tự đặt trước khi `npm install`: *"Việc này tự viết mất bao lâu?"* Nếu là 20 dòng thì
thường nên tự viết — mỗi phụ thuộc là code bạn không đọc, chạy với đầy đủ quyền của ứng dụng, và
kéo theo cả cây phụ thuộc của nó.

Việc nên làm định kỳ mà nhiều đội bỏ qua: **sinh SBOM** (danh sách thành phần) và lưu lại. Khi một
lỗ hổng nghiêm trọng được công bố, câu hỏi đầu tiên là "chúng ta có dùng nó không, ở đâu, phiên bản
nào" — có SBOM thì trả lời trong 1 phút, không có thì mất cả ngày.

</details>

---

Tiếp: [07-tinh-huong-su-co.md](./07-tinh-huong-su-co.md)
