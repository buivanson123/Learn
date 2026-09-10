# Câu hỏi hành vi — 14 câu

Nhiều kỹ sư giỏi coi thường vòng này và trượt vì nó. Ở mức senior, **hơn nửa giá trị bạn mang lại
không nằm ở code**: bạn ảnh hưởng tới quyết định của đội, bạn nâng người khác lên, bạn giữ được bình
tĩnh khi hệ thống cháy.

Người phỏng vấn ở vòng này tìm bằng chứng, không tìm phẩm chất. "Em là người có trách nhiệm" không
phải bằng chứng. Một câu chuyện cụ thể với con số mới là.

---

## Khung STAR + số liệu

```
Tình huống  Bối cảnh vừa đủ để hiểu. 2–3 câu, KHÔNG dài hơn.
Nhiệm vụ    Trách nhiệm của BẠN là gì.
Hành động   Bạn làm gì. Nói "em", đừng nói "team em".
Kết quả     SỐ LIỆU. Trước/sau. Và bạn học được gì.
```

Sai lầm phổ biến nhất: dành 80% thời gian cho phần Tình huống và 10% cho Hành động. Người phỏng vấn
cần biết **bạn** đã làm gì, không cần hiểu hết hệ thống của công ty cũ.

Sai lầm thứ hai: nói "team em đã làm". Họ đang tuyển bạn, không tuyển team cũ của bạn. Dùng "em" cho
phần bạn làm, và ghi nhận người khác ở chỗ xứng đáng — điều đó không làm giảm đóng góp của bạn, nó
làm bạn đáng tin hơn.

---

## Chuẩn bị trước: ngân hàng 6 câu chuyện

Hầu hết câu hỏi hành vi có thể trả lời bằng một trong 6 câu chuyện này. Chuẩn bị kỹ 6 cái, mỗi cái
2 phút, còn hơn chuẩn bị sơ sài 20 cái.

```
1. Một sự cố production bạn xử lý          -> kỹ năng khoanh vùng, bình tĩnh, phòng ngừa
2. Một quyết định kỹ thuật khó có đánh đổi  -> tư duy hệ thống, cân nhắc dài hạn
3. Một lần bạn SAI và sửa                   -> trung thực, khả năng học
4. Một bất đồng với đồng nghiệp/sếp         -> giao tiếp, tôn trọng, tập trung vào vấn đề
5. Một lần bạn giúp người khác giỏi lên     -> ảnh hưởng, mentoring
6. Một dự án bạn dẫn dắt từ đầu tới cuối    -> chủ động, quản lý phạm vi, giao hàng
```

Với mỗi câu, viết ra **ba con số**: quy mô (bao nhiêu người dùng, bao nhiêu request), tác động
(trước/sau), thời gian (bao lâu).

---

### 1. "Kể về một sự cố production bạn từng xử lý"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn khoanh vùng thế nào dưới áp lực, và bạn có biến sự cố thành cải tiến hệ thống
không.

**Cấu trúc:**
```
1. Triệu chứng và mức nghiêm trọng — 1 câu   ("2h chiều, 40% request trả 500")
2. Việc ĐẦU TIÊN bạn làm — thường là giảm thiệt hại, không phải debug
3. Cách khoanh vùng — nhị phân, có số liệu
4. Nguyên nhân gốc
5. Bạn thay đổi gì để nó KHÔNG TÁI DIỄN  ← phần quan trọng nhất
```

**Ví dụ tốt:**

> "Khoảng 2 giờ chiều thứ Ba, cảnh báo báo tỷ lệ 5xx lên 40%. Việc đầu tiên em làm không phải là
> debug mà là kiểm tra xem có deploy nào trong 30 phút trước không — có, và em rollback ngay. Tỷ lệ
> lỗi về bình thường sau 4 phút.
>
> Sau đó mới điều tra. Em thấy lỗi chỉ xảy ra với khoảng 5% user, và điểm chung là họ đều là tài
> khoản tạo trước 2023. Code mới giả định mọi user đều có bản ghi `profile`, còn tài khoản cũ thì
> không — em kiểm chứng bằng một câu count, ra đúng 4.8%.
>
> Sửa thì đơn giản, nhưng phần em quan tâm hơn là vì sao nó lọt qua. Test của bọn em dùng dữ liệu
> giả sinh ra bởi factory, mà factory thì luôn tạo đủ trường. Em đề xuất hai thay đổi: một là canary
> deploy 5% traffic trước khi ra toàn bộ, hai là bổ sung một bộ dữ liệu test dựng từ bản sao ẩn danh
> của production. Sau đó bọn em bắt được hai lỗi tương tự ở giai đoạn canary."

**Vì sao câu này tốt:** có mốc thời gian cụ thể, hành động đầu tiên đúng (giảm thiệt hại trước), cách
khoanh vùng có số liệu, và **phần lớn nhất dành cho việc phòng ngừa** — đúng thứ người phỏng vấn
senior tìm.

**Tránh:** kể quá chi tiết kỹ thuật mà quên phần quyết định. Và tránh kết thúc ở "rồi em sửa xong" —
không có phần phòng ngừa thì câu chuyện chỉ ở mức middle.

</details>

### 2. "Kể về một quyết định kỹ thuật khó"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có cân nhắc nhiều phương án không, có tính tới chi phí dài hạn không, và bạn có
dám quyết không.

**Điểm mấu chốt là phải nêu được phương án bạn đã *loại bỏ* và vì sao.** Câu chuyện chỉ có một
phương án thì không phải quyết định, chỉ là một việc đã làm.

**Ví dụ tốt:**

> "Bọn em cần thêm xử lý nền cho việc gửi email và đồng bộ dữ liệu. Có ba phương án trên bàn: dựng
> Kafka, dùng RabbitMQ, hoặc làm bảng job ngay trong Postgres đang có.
>
> Đội thiên về Kafka vì nghĩ tới tương lai. Em đo lại nhu cầu thật: khoảng 50 nghìn job mỗi ngày,
> tức chưa tới 1 job/giây, và không có yêu cầu nào cần đọc lại lịch sử. Em chọn bảng job trong
> Postgres với `FOR UPDATE SKIP LOCKED`.
>
> Lý do quyết định không phải hiệu năng mà là **chi phí vận hành**: đội có 4 người, không ai từng
> trực Kafka. Thêm nó là thêm một thứ phải backup, theo dõi, và xử lý lúc 3 giờ sáng. Và có một lợi
> ích kỹ thuật thật: job và dữ liệu nghiệp vụ nằm cùng một transaction, nên không có tình huống đơn
> hàng được tạo mà job xử lý nó biến mất.
>
> Em nói rõ cái giá: nếu vượt vài nghìn job/giây thì phải chuyển. Em viết lại quyết định đó thành
> một ADR, ghi rõ ngưỡng nào thì xem xét lại. Hai năm sau bọn em vẫn dùng nó, và lượng job mới đạt
> khoảng 200 nghìn/ngày."

**Điểm ăn điểm:** đo trước khi quyết, tính tới năng lực đội chứ không chỉ tính kỹ thuật, nêu rõ điều
kiện để đổi ý, và có kết quả theo dõi được sau đó.

**Tránh:** chọn công nghệ vì nó "hiện đại", hoặc kể một quyết định không có ai phản đối — nó không
chứng minh được gì.

</details>

### 3. "Kể về một lần bạn sai"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có tự nhận thức không, có trung thực không, và bạn phản ứng thế nào khi sai.
Đây là câu **ăn điểm cao nhất** nếu trả lời thật, và mất điểm nặng nhất nếu né tránh.

**Ba cách trả lời hỏng:**
```
❌ "Em quá cầu toàn"                    -> né tránh, ai cũng nhận ra
❌ "Em không nhớ có lần nào"            -> hoặc không tự nhận thức, hoặc không trung thực
❌ Kể lỗi của người khác                 -> đổ lỗi, tệ nhất
```

**Ví dụ tốt:**

> "Em từng đẩy một migration đổi kiểu cột trên bảng 30 triệu dòng vào giờ hành chính. Em có test ở
> staging và nó chạy trong 2 giây — nhưng staging chỉ có 50 nghìn dòng. Trên production nó khoá bảng
> 4 phút, và trong 4 phút đó mọi thứ chạm bảng đó đều treo.
>
> Em nhận trách nhiệm ngay trong kênh sự cố thay vì chờ ai đó tìm ra. Trong lúc chờ migration chạy
> xong, em thông báo cho bộ phận chăm sóc khách hàng để họ có câu trả lời sẵn.
>
> Cái em học được không phải là 'phải cẩn thận hơn' — câu đó vô dụng. Em học được rằng **staging
> không giống production về mặt dữ liệu thì mọi test hiệu năng ở đó đều vô nghĩa**. Sau đó em làm ba
> việc: đưa `lock_timeout` vào mọi migration để nó thà fail còn hơn treo hệ thống, viết một checklist
> cho migration trên bảng lớn, và tạo một môi trường có bản sao dữ liệu production về kích thước."

**Vì sao tốt:** lỗi thật và đủ nghiêm trọng, nhận trách nhiệm ngay, có hành động giảm thiệt hại, và
bài học **cụ thể ở mức hệ thống** chứ không phải lời hứa suông.

**Nguyên tắc chọn câu chuyện:** đủ nghiêm trọng để đáng kể (đừng kể lỗi chính tả), nhưng đã được xử
lý và đã có bài học rõ ràng.

</details>

### 4. "Kể về một bất đồng với đồng nghiệp"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn tách được vấn đề khỏi con người không, và bạn xử lý thế nào khi kết quả không
theo ý mình.

**Ví dụ tốt:**

> "Một bạn trong đội muốn chuyển toàn bộ state management sang Redux, em thì thấy phần lớn state của
> bọn em là dữ liệu từ API.
>
> Thay vì tranh luận theo kiểu 'thư viện nào tốt hơn', em đề nghị cùng liệt kê ra: mỗi mẩu state
> trong ứng dụng thuộc loại gì. Làm xong thì thấy rõ — khoảng 80% là cache của API, 15% nằm trong
> URL, chỉ khoảng 5% là state client thật sự dùng chung. Danh sách đó thuyết phục hơn mọi lập luận
> của cả hai bên.
>
> Bọn em chọn TanStack Query cho phần server state và giữ context cho phần nhỏ còn lại. Bạn kia đúng
> ở một điểm mà em ban đầu bỏ qua: cần một chỗ tập trung để debug. Bọn em bổ sung logging cho các
> mutation quan trọng, và đó là ý của bạn ấy.
>
> Điều em rút ra là khi hai bên bất đồng về giải pháp, thường là do chưa thống nhất về **vấn đề**.
> Quay lại làm rõ vấn đề gần như luôn nhanh hơn tranh luận về giải pháp."

**Điểm ăn điểm:** chuyển từ tranh luận ý kiến sang cùng nhìn dữ liệu, và **ghi nhận điểm đúng của
người kia** — chi tiết này quan trọng hơn nhiều người nghĩ.

**Biến thể của câu hỏi:** "khi bạn không đồng ý với quyết định của sếp thì sao?" Câu trả lời tốt:
nêu ý kiến rõ ràng một lần, kèm dữ liệu; nếu quyết định vẫn khác, **cam kết thực hiện hết mình** và
ghi lại rủi ro đã nêu. Đây gọi là "disagree and commit". Nói được cụm này và hành xử theo nó là dấu
hiệu chín chắn.

</details>

### 5. "Bạn giúp người khác giỏi lên thế nào?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có nhân rộng năng lực của mình không, hay chỉ là một cá nhân làm nhiều.

**Ví dụ tốt:**

> "Một bạn junior trong đội hay bị em ghi rất nhiều bình luận trong review, và em nhận ra mình đang
> lặp lại cùng vài điểm. Đó là dấu hiệu vấn đề nằm ở em chứ không ở bạn ấy — em đang sửa từng triệu
> chứng thay vì dạy nguyên tắc.
>
> Em đổi cách: mỗi tuần ngồi 30 phút cùng bạn ấy đọc lại một PR, nhưng thay vì chỉ ra lỗi, em hỏi
> 'nếu `items` rỗng thì dòng này chạy thế nào?' Bạn ấy tự tìm ra, và lần sau tự nhớ.
>
> Em cũng viết lại các điểm hay lặp thành một checklist ngắn cho cả đội, và biến ba trong số đó
> thành luật ESLint — máy bắt được thì không cần người nhắc.
>
> Sau khoảng hai tháng, số bình luận trong PR của bạn ấy giảm rõ, và quan trọng hơn là bạn ấy bắt
> đầu review PR của người khác và bắt được những lỗi cùng loại."

**Điểm ăn điểm:** nhận ra vấn đề nằm ở cách mình làm, dùng câu hỏi thay vì đưa đáp án, và **tự động
hoá thứ tự động hoá được** thay vì dựa vào con người nhớ.

**Nếu bạn chưa từng mentor ai:** vẫn trả lời được bằng những cách khác — viết tài liệu cho phần khó,
chia sẻ nội bộ, cải thiện quy trình onboarding, hoặc đơn giản là viết mô tả PR kỹ để người sau đọc
hiểu. Trung thực rằng bạn chưa mentor chính thức nhưng đã làm những việc này thì tốt hơn là bịa.

</details>

### 6. "Bạn xử lý thế nào khi deadline không khả thi?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn giao tiếp sớm hay giấu tới phút chót, và bạn có đề xuất phương án thay vì chỉ
báo tin xấu không.

**Cấu trúc câu trả lời:**
```
1. Báo SỚM, ngay khi thấy dấu hiệu — không phải trước deadline một ngày
2. Mang theo SỐ, không phải cảm giác: "làm xong 3/8 hạng mục, tốc độ hiện tại còn cần 3 tuần"
3. Đưa ra LỰA CHỌN, không phải chỉ vấn đề:
     - Giao đúng hạn với phạm vi giảm (cụ thể phần nào cắt)
     - Giao đủ, trễ 2 tuần
     - Giao đúng hạn, đủ phạm vi, nhưng nợ kỹ thuật và cần 1 tuần dọn sau
4. Nêu rõ hệ quả của từng lựa chọn để người ra quyết định chọn được
5. Để người có thẩm quyền quyết định phạm vi — đó không phải quyết định của bạn
```

Bước 3 là bước phân biệt: báo "không kịp" là báo cáo vấn đề; đưa ba lựa chọn kèm hệ quả là giúp
người khác ra quyết định.

Bước 5 cũng quan trọng: tự ý cắt tính năng để kịp hạn là vượt quyền, và thường cắt nhầm thứ.

**Điểm cộng nếu nói thêm:** vì sao ước lượng ban đầu sai, và bạn thay đổi gì trong cách ước lượng
sau đó. Ví dụ: chia nhỏ hơn, cộng thêm hệ số cho phần tích hợp, hoặc dựng nguyên mẫu cho phần chưa
rõ trước khi cam kết.

**Tránh:** "em cày đêm cho kịp". Nghe có vẻ tận tâm nhưng nó nói với người phỏng vấn rằng bạn giải
quyết vấn đề quản lý bằng sức khoẻ của mình, và rằng bạn sẽ không báo sớm lần sau.

</details>

### 7. "Vì sao bạn muốn rời công ty hiện tại?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có nói xấu nơi cũ không, và động lực của bạn có khớp với vị trí này không.

**Nguyên tắc: hướng TỚI cái gì, đừng hướng RA KHỎI cái gì.**

```
❌ "Sếp em không biết gì về kỹ thuật, code base thì như bãi rác."
   -> họ sẽ nghĩ: 6 tháng nữa mình cũng bị nói như vậy

✅ "Em đã làm ở đó 3 năm và học được rất nhiều, đặc biệt là mảng thanh toán.
    Nhưng sản phẩm đã ổn định và phần lớn công việc giờ là bảo trì. Em muốn quay lại
    giai đoạn xây dựng, và vị trí này có phần hệ thống thời gian thực mà em chưa
    có cơ hội làm sâu."
```

Nếu lý do thật sự tiêu cực (quản lý tệ, không được tăng lương, môi trường độc hại) thì vẫn nên nói
thật nhưng **trung tính và ngắn**, rồi chuyển nhanh sang phần hướng tới:

> "Có một số thay đổi về định hướng ở công ty mà em thấy không còn phù hợp với hướng em muốn đi.
> Em không muốn đi sâu vào chuyện nội bộ. Điều em tìm kiếm là..."

Câu "em không muốn đi sâu vào chuyện nội bộ" thực ra là một điểm cộng: nó cho thấy bạn giữ được sự
kín đáo về nơi cũ — và người phỏng vấn hiểu rằng bạn cũng sẽ làm vậy với công ty họ.

**Tránh tuyệt đối:** kể chi tiết mâu thuẫn cá nhân, chê đồng nghiệp cũ, hoặc nói "lương thấp" như lý
do duy nhất.

</details>

### 8. "Điểm yếu lớn nhất của bạn là gì?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có tự nhận thức không. Câu trả lời giả tạo bị nhận ra ngay và mất điểm nhiều hơn
là một điểm yếu thật.

**Công thức:** điểm yếu **thật** + tác hại cụ thể nó từng gây ra + việc bạn **đang làm** để cải
thiện + bằng chứng đã tiến bộ.

**Ví dụ tốt:**

> "Em có xu hướng tự làm cho nhanh thay vì giao việc. Nó từng gây hậu quả cụ thể: trong một dự án,
> em ôm phần tích hợp thanh toán vì nghĩ giải thích còn lâu hơn tự làm. Kết quả là hai tháng sau em
> đi nghỉ, có sự cố ở phần đó và không ai trong đội đủ hiểu để xử lý — phải gọi em về.
>
> Từ đó em đặt một luật cho bản thân: mỗi phần quan trọng phải có ít nhất hai người hiểu. Em bắt đầu
> pair với người khác ở những phần rủi ro, và viết tài liệu vận hành cho từng phần. Bây giờ phần
> thanh toán có ba người trực được, và lần sự cố gần nhất em không hề phải tham gia.
>
> Em vẫn còn xu hướng đó, nên em kiểm soát bằng luật chứ không bằng ý chí."

**Vì sao tốt:** điểm yếu thật của người senior, hậu quả cụ thể, giải pháp có hệ thống, có bằng chứng
kết quả, và **thừa nhận nó chưa biến mất** — điều đó làm câu trả lời đáng tin.

**Tránh:** "cầu toàn", "làm việc quá nhiều", "quá chú ý tới chi tiết" — đây là những câu trả lời
được ngụy trang thành điểm mạnh và ai cũng nhận ra.

</details>

### 9. "Kể về một dự án bạn tự hào nhất"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn định nghĩa thành công thế nào. Người mới nhấn mạnh độ phức tạp kỹ thuật; người
senior nhấn mạnh **tác động**.

**Cấu trúc:**
```
1. Vấn đề kinh doanh, không phải vấn đề kỹ thuật   ("khách bỏ giỏ hàng ở bước thanh toán 60%")
2. Vai trò của bạn — cụ thể, khác với vai trò của người khác
3. Quyết định khó nhất trong dự án
4. Kết quả có SỐ    ("tỷ lệ hoàn tất tăng từ 40% lên 58% trong 2 tháng")
5. Vì sao bạn tự hào — thường không phải vì code
```

Điểm 5 là chỗ để bộc lộ giá trị của bạn. Câu trả lời hay thường không phải "vì kiến trúc đẹp" mà là
"vì nó vẫn chạy tốt sau hai năm với 4 người khác bảo trì" hoặc "vì nó xoá bỏ được một công việc thủ
công mà bộ phận vận hành phải làm mỗi ngày".

**Nếu không có con số kinh doanh** (nhiều vị trí backend không tiếp cận được): dùng con số kỹ thuật
có ý nghĩa với người dùng — p95 giảm từ 4 giây xuống 300 ms, tỷ lệ lỗi từ 5% xuống 0.1%, thời gian
deploy từ 2 giờ xuống 10 phút.

**Tránh:** kể một dự án bạn chỉ tham gia nhỏ rồi dùng "chúng em" xuyên suốt. Người phỏng vấn sẽ đào
vào chi tiết và khoảng trống sẽ lộ ra.

</details>

### 10. "Bạn cập nhật kiến thức thế nào?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có học chủ động không, và bạn có phân biệt được xu hướng nhất thời với thứ đáng
học không.

**Câu trả lời yếu:** "em đọc blog và xem YouTube." Ai cũng nói vậy, và nó không chứng minh gì.

**Câu trả lời tốt** có ba tầng:

```
1. NGUỒN cụ thể  — không phải "blog" chung chung
   Changelog và RFC của thứ mình dùng hằng ngày, tài liệu chính thức,
   bài viết kỹ thuật của các công ty có quy mô tương tự

2. CÁCH LỌC — quan trọng hơn nguồn
   "Em không chạy theo mọi thứ mới. Em chờ khoảng 6 tháng để xem một công nghệ
    có sống sót không, trừ khi nó giải quyết trực tiếp một vấn đề em đang có."

3. BẰNG CHỨNG bạn đã học thật
   "Ví dụ gần đây em tìm hiểu về `FOR UPDATE SKIP LOCKED`. Em không đọc suông mà dựng
    một Postgres trong Docker, chạy hai phiên song song để xem hành vi thật khác gì khi
    bỏ `SKIP LOCKED` — hoá ra worker thứ hai đứng chờ hoàn toàn thay vì lấy job khác.
    Sau đó em áp dụng vào hàng đợi job của dự án."
```

Tầng 3 là tầng ăn điểm. Nó biến "em có học" thành "đây là bằng chứng em học".

**Điểm cộng:** nói về việc học từ **code của người khác** và từ **sự cố** — hai nguồn học tốt nhất
mà ít người nhắc tới.

</details>

### 11. "Bạn làm gì khi nhận một codebase hoàn toàn xa lạ?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** cách bạn tiếp cận cái chưa biết một cách có hệ thống.

**Quy trình nên trình bày:**

```
1. Chạy được nó đã. Nếu README không đủ để chạy, đó là việc đầu tiên nên sửa
   — và cũng là đóng góp đầu tiên có ích cho người vào sau.
2. Đi theo MỘT luồng từ đầu tới cuối. Chọn luồng quan trọng nhất
   (đăng nhập, hoặc tạo đơn hàng) và lần theo từ HTTP request tới database.
3. Nhìn schema database. Mô hình dữ liệu nói về hệ thống nhiều hơn code.
4. Đọc lịch sử git của các file hay thay đổi nhất -> đó là chỗ nghiệp vụ phức tạp nhất.
5. Sửa một bug nhỏ thật sớm — học nhanh hơn nhiều so với đọc.
6. Ghi lại mọi thứ khó hiểu TRONG TUẦN ĐẦU. Sau hai tuần bạn sẽ quen và không
   còn thấy nó khó nữa — mất cơ hội cải thiện tài liệu cho người sau.
```

Mục 3 đáng nhấn mạnh: schema database là bản đồ trung thực nhất của một hệ thống, vì nó khó thay đổi
nên nó phản ánh mô hình nghiệp vụ thật.

Mục 6 là điểm cộng bất ngờ — nó cho thấy bạn nghĩ tới người vào sau, một dấu hiệu của người senior.

**Kèm theo, nếu muốn ghi điểm:** "Em cũng hỏi nhiều trong tuần đầu, vì đó là lúc hỏi rẻ nhất. Sau
một tháng mà vẫn hỏi những câu đó thì đắt hơn nhiều — cho cả em lẫn người trả lời."

</details>

### 12. "Bạn ưu tiên công việc thế nào khi có quá nhiều việc?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn tự quản lý được không, hay cần người khác sắp xếp cho.

**Khung nên trình bày:**

```
1. Phân loại theo tác động × chi phí, và đặc biệt là theo TÍNH ĐẢO NGƯỢC
   - Không đảo ngược được + tác động lớn  -> cân nhắc kỹ, làm cẩn thận
   - Đảo ngược được + tác động lớn        -> làm nhanh, sai thì sửa
2. Việc CHẶN người khác luôn ưu tiên hơn việc của mình
   — một PR chưa review có thể đang chặn hai người
3. Hỏi lại khi hai việc cùng được gọi là "gấp"
   — thường một trong hai không gấp thật, và người yêu cầu sẽ tự nói ra
4. Nói KHÔNG một cách rõ ràng, kèm giải pháp thay thế:
   "Em làm A trong tuần này được, nhưng vậy thì B lùi sang tuần sau. Anh chọn cái nào?"
```

Mục 2 là điểm phân biệt: người mới ưu tiên việc của mình, người senior nhận ra rằng gỡ điểm nghẽn
cho ba người khác có giá trị hơn tự mình làm xong một việc.

Mục 4 cũng vậy: từ chối bằng cách nêu đánh đổi thay vì nói "không có thời gian" biến một cuộc tranh
cãi thành một quyết định chung.

**Điểm cộng:** nhắc tới việc **để lại dấu vết** — ghi lại việc bị hoãn và lý do, để nó không biến
mất rồi quay lại bất ngờ sau ba tháng.

</details>

### 13. "Bạn mong gì ở người quản lý?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có tự chủ không, và bạn có hợp với văn hoá quản lý ở đây không.

**Câu trả lời tốt** cụ thể và có đi có lại:

> "Em cần ba thứ. Một là **ngữ cảnh**: hiểu vì sao việc này quan trọng với công ty, để em tự quyết
> được những chuyện nhỏ mà không phải hỏi lại. Hai là **phản hồi thẳng thắn và sớm** — em thà nghe
> điều khó nghe ngay còn hơn biết sau sáu tháng ở kỳ đánh giá. Ba là **được bảo vệ khỏi nhiễu**:
> nếu yêu cầu đổi liên tục thì em khó giao được thứ có chất lượng.
>
> Ngược lại, em không cần bị theo dõi tiến độ hằng ngày. Em sẽ chủ động báo cáo, và em sẽ báo sớm
> khi có rủi ro chứ không đợi tới hạn."

**Điểm ăn điểm:** phần "ngược lại" — nó cho thấy bạn hiểu quan hệ này có hai chiều.

**Tránh:** "em không cần gì cả, em tự làm được hết" — nghe có vẻ độc lập nhưng thực ra nói rằng bạn
không muốn phản hồi và không hợp tác.

**Đây cũng là cơ hội để bạn tìm hiểu ngược:** cách người phỏng vấn phản ứng với câu trả lời này cho
bạn biết khá nhiều về văn hoá quản lý ở đó.

</details>

### 14. "Năm năm nữa bạn muốn ở đâu?"

<details><summary>Cách trả lời</summary>

**Họ đang đo:** bạn có định hướng không, và định hướng đó có khớp với những gì vị trí này cho được
không.

**Nguyên tắc:** nói về **loại vấn đề bạn muốn giải** và **loại tác động bạn muốn có**, không phải về
chức danh.

```
❌ "Em muốn thành CTO."              -> khó tin, và không nói lên điều gì
❌ "Em chưa nghĩ tới."               -> thiếu định hướng
✅ Cụ thể về hướng đi, linh hoạt về hình thức
```

**Ví dụ:**

> "Em muốn đi sâu hơn theo hướng kỹ thuật — làm những hệ thống mà quyết định thiết kế có hệ quả
> trong nhiều năm, và giúp đội đưa ra những quyết định đó tốt hơn. Em chưa chắc mình muốn đi tiếp
> thành quản lý hay thành kỹ sư chính, nên em đang thử cả hai: em đang mentor hai bạn junior để xem
> mình có thích phần đó không.
>
> Điều em chắc chắn là em muốn ở gần sản phẩm thật, có người dùng thật — chứ không phải làm hạ tầng
> thuần tuý cách xa người dùng."

**Vì sao tốt:** có hướng rõ, thành thật về chỗ chưa quyết, và **đang chủ động thử nghiệm** thay vì
chỉ suy nghĩ.

**Điểm cộng:** nối với vị trí đang ứng tuyển — "và đó là lý do vị trí này hấp dẫn với em, vì nó có
phần X mà em muốn đi sâu."

</details>

---

## Tự luyện

Ghi âm câu trả lời của mình rồi nghe lại. Ba thứ cần kiểm tra:

```
1. Có quá 2 phút cho một câu không?     -> quá dài, người nghe mất tập trung
2. Có ít nhất một con số không?          -> không có số thì nghe như chuyện kể
3. Nói "em" hay nói "team em"?           -> họ tuyển bạn, không tuyển team cũ
```

Và một mẹo thực dụng: chuẩn bị **tiếng Việt trước, tiếng Anh sau** nếu buổi phỏng vấn có thể bằng
tiếng Anh. Nội dung phải chắc trước đã; dịch một câu chuyện đã rõ ràng dễ hơn nhiều so với vừa nghĩ
vừa dịch.

---

Tiếp: [03-cau-hoi-nguoc-lai.md](./03-cau-hoi-nguoc-lai.md)
