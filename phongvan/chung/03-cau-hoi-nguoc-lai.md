# Câu hỏi ngược lại nhà tuyển dụng — 18 câu

Cuối mỗi vòng, người phỏng vấn sẽ hỏi *"Bạn có câu hỏi gì cho chúng tôi không?"*

Trả lời "dạ không" là mất điểm thật, không phải mất điểm hình thức. Ở mức senior, người ta kỳ vọng
bạn **đánh giá ngược lại công ty** — vì bạn sắp bỏ ra hai, ba năm cuộc đời ở đó, và vì một người
senior biết rõ mình cần môi trường thế nào.

Chuẩn bị sẵn **8–10 câu**, chọn 3–4 câu tuỳ người đang ngồi trước mặt.

---

## Hỏi ai, câu gì

| Người phỏng vấn | Hỏi về |
|---|---|
| Kỹ sư sẽ làm cùng | công việc hằng ngày, codebase, quy trình, sự cố |
| Quản lý trực tiếp | kỳ vọng, đánh giá, lộ trình, cách ra quyết định |
| Quản lý cấp cao / CTO | định hướng kỹ thuật, ưu tiên, cách cân bằng với kinh doanh |
| HR / tuyển dụng | quy trình, phúc lợi, các bước tiếp theo |

Đừng hỏi kỹ sư về chính sách lương, và đừng hỏi HR về kiến trúc hệ thống — hỏi sai người làm cả hai
bên khó xử.

---

## Nhóm 1 — Về công việc thật hằng ngày

<details><summary>6 câu và điều cần nghe được</summary>

**1. "Một tuần điển hình của vị trí này trông thế nào? Bao nhiêu thời gian thực sự dành cho code?"**

*Nghe gì:* Nếu câu trả lời là "khoảng 30%" thì đây là vai trò thiên về phối hợp — có thể tốt, nhưng
bạn cần biết trước. Nếu họ ngập ngừng, có thể vai trò chưa được định nghĩa rõ.

**2. "Ba tháng đầu, anh/chị mong em làm được gì?"**

*Nghe gì:* Câu trả lời cụ thể ("giao được tính năng X, hiểu được hệ thống Y") cho thấy họ đã nghĩ kỹ.
Câu trả lời mơ hồ ("hoà nhập với đội") cho thấy vai trò chưa rõ — và bạn sẽ phải tự định nghĩa nó.

**3. "Phần nào của codebase mọi người ngại đụng vào nhất?"**

*Nghe gì:* **Đây là câu hỏi giá trị nhất trong cả danh sách.** Mọi hệ thống đều có một chỗ như vậy.
Nếu họ trả lời thẳng thắn và có kế hoạch xử lý, đó là dấu hiệu văn hoá tốt. Nếu họ nói "không có
đâu, code bọn anh sạch lắm", đó là dấu hiệu cảnh báo — hoặc họ không trung thực, hoặc họ chưa làm ở
đó đủ lâu.

**4. "Lần gần nhất có sự cố production là khi nào, và sau đó có thay đổi gì?"**

*Nghe gì:* Có hậu kiểm không đổ lỗi cá nhân không? Có thay đổi hệ thống sau sự cố không? Câu trả lời
"bọn anh hiếm khi có sự cố" thường có nghĩa là họ không đo, chứ không phải không có.

**5. "Từ lúc merge tới lúc code chạy trên production mất bao lâu?"**

*Nghe gì:* Vài phút tới vài giờ là tốt. Vài tuần nghĩa là quy trình nặng, và mỗi lần deploy sẽ là
một sự kiện đáng sợ. Con số này nói rất nhiều về chất lượng kỹ thuật của đội.

**6. "Đội có trực ngoài giờ (on-call) không? Tần suất thế nào, và bao lâu mới có một lần bị gọi
lúc nửa đêm?"**

*Nghe gì:* Câu hỏi này hoàn toàn chính đáng và người phỏng vấn tử tế sẽ tôn trọng bạn vì hỏi nó. Nếu
bị gọi hằng tuần thì hệ thống đang có vấn đề nghiêm trọng về độ ổn định, và bạn sắp sống chung với nó.

</details>

## Nhóm 2 — Về kỹ thuật và quyết định

<details><summary>5 câu và điều cần nghe được</summary>

**7. "Quyết định kiến trúc nào gần đây khiến đội tranh luận nhiều nhất? Kết quả thế nào?"**

*Nghe gì:* Đội có tranh luận kỹ thuật thật không, và quyết định được đưa ra thế nào — theo lý lẽ hay
theo cấp bậc. Câu trả lời càng cụ thể càng đáng tin.

**8. "Nợ kỹ thuật được xử lý thế nào? Có hạn mức thời gian cho nó không?"**

*Nghe gì:* "Khi nào rảnh thì làm" nghĩa là không bao giờ làm. Câu trả lời tốt có cơ chế cụ thể: hạn
mức phần trăm mỗi sprint, hoặc gắn với tính năng.

**9. "Việc gì trong quy trình hiện tại làm mọi người mất thời gian nhất?"**

*Nghe gì:* Câu này cho bạn thấy điểm đau thật. Nó cũng mở đường để bạn nói về kinh nghiệm giải quyết
đúng vấn đề đó — nhưng chỉ nói nếu tự nhiên, đừng biến câu hỏi thành màn quảng cáo bản thân.

**10. "Đội đo chất lượng bằng gì? Có theo dõi độ trễ, tỷ lệ lỗi, hay Core Web Vitals không?"**

*Nghe gì:* Có văn hoá đo lường không, hay mọi quyết định dựa trên cảm giác. Nếu họ có số liệu cụ
thể, đó thường là đội trưởng thành.

**11. "Nếu em muốn thay đổi một thứ về mặt kỹ thuật, quy trình sẽ thế nào?"**

*Nghe gì:* Bạn có quyền tự chủ tới đâu. Ở vị trí senior, việc chỉ được thực thi theo lệnh mà không
có tiếng nói là lý do rời đi phổ biến nhất.

</details>

## Nhóm 3 — Về đội và cách làm việc

<details><summary>4 câu và điều cần nghe được</summary>

**12. "Đội hiện có bao nhiêu người, ở những mức nào? Có ai mới rời đi gần đây không, vì sao?"**

*Nghe gì:* Đội toàn junior mà tuyển một senior thì bạn sẽ dành nhiều thời gian mentor — cần biết
trước để không thất vọng. Tỷ lệ nghỉ việc cao là dấu hiệu cần đào sâu thêm.

**13. "Yêu cầu tính năng đi từ đâu tới? Kỹ sư có tham gia vào giai đoạn định hình không?"**

*Nghe gì:* Nếu kỹ sư chỉ nhận đặc tả đã chốt và thực thi, công việc sẽ ít thú vị hơn nhiều và bạn ít
ảnh hưởng tới sản phẩm. Với vị trí senior, đây là điểm quan trọng.

**14. "Code review ở đây diễn ra thế nào? Trung bình bao lâu thì một PR được duyệt?"**

*Nghe gì:* Văn hoá review nói rất nhiều về đội. PR nằm chờ ba ngày nghĩa là mọi người đang quá tải,
hoặc review không được coi là công việc thật.

**15. "Đội làm việc từ xa/lai như thế nào? Các quyết định quan trọng được ghi lại ở đâu?"**

*Nghe gì:* Câu hỏi về nơi ghi lại quyết định quan trọng hơn câu hỏi về chính sách làm việc từ xa —
nó cho biết đội có văn hoá viết không, và người không có mặt trong cuộc họp có bị bỏ lại không.

</details>

## Nhóm 4 — Về phát triển bản thân và các bước tiếp theo

<details><summary>3 câu và điều cần nghe được</summary>

**16. "Ở đây, đi từ mức của em lên mức tiếp theo trông như thế nào? Có ai vừa được thăng gần đây
không?"**

*Nghe gì:* Có lộ trình rõ ràng hay thăng tiến theo cảm tính. Câu "có ai vừa được thăng gần đây
không" là phần quan trọng — nếu không ai được thăng trong hai năm, lộ trình trên giấy không có ý
nghĩa.

**17. "Anh/chị thích nhất điều gì khi làm ở đây? Và điều gì anh/chị muốn thay đổi?"**

*Nghe gì:* Vế thứ hai là vế thật. Người trả lời thẳng thắn về điều họ muốn thay đổi cho bạn thông
tin thật và cho thấy văn hoá cởi mở. Người nói "không có gì cả" thì hoặc đang giữ ý, hoặc chưa suy
nghĩ.

**18. "Các bước tiếp theo là gì, và khi nào em có thể nhận được phản hồi?"**

*Nghe gì:* Câu hỏi thực dụng, luôn nên hỏi ở cuối vòng cuối. Nó cũng giúp bạn biết khi nào nên chủ
động liên hệ lại mà không sốt ruột.

</details>

---

## Sáu dấu hiệu cảnh báo cần chú ý

Không phải câu hỏi để hỏi, mà là những gì cần nghe ra trong lúc họ trả lời:

```
1. Né tránh câu hỏi về sự cố hoặc về nợ kỹ thuật
   -> hoặc không trung thực, hoặc thật sự không biết

2. Mô tả công việc quá rộng: "làm full-stack, kiêm DevOps, kiêm cả data"
   -> thường là đội thiếu người trầm trọng, và bạn sẽ luôn bị kéo căng

3. Không ai trả lời được "ba tháng đầu mong em làm gì"
   -> vai trò chưa được định nghĩa, bạn sẽ phải tự tìm việc để làm

4. "Bọn anh làm việc như một gia đình"
   -> thường đi kèm ranh giới công việc/cá nhân mờ và làm ngoài giờ không được ghi nhận

5. Quy trình phỏng vấn kéo dài, đổi lịch nhiều lần, phản hồi chậm
   -> cách họ đối xử với ứng viên phản ánh cách họ vận hành

6. Người phỏng vấn nói xấu người vừa nghỉ
   -> họ cũng sẽ nói về bạn như vậy
```

---

## Ba câu nên hỏi ở phút cuối

Khi chỉ còn thời gian cho một hoặc hai câu, chọn trong ba câu này — chúng cho nhiều thông tin nhất
trên mỗi câu hỏi:

1. **"Phần nào của codebase mọi người ngại đụng vào nhất?"** — đo độ trung thực và sức khoẻ kỹ thuật.
2. **"Từ lúc merge tới lúc chạy production mất bao lâu?"** — một con số nói lên cả văn hoá kỹ thuật.
3. **"Anh/chị muốn thay đổi điều gì ở đây?"** — đo độ cởi mở và cho bạn thông tin thật nhất.

---

## Và một điều nên nói, không phải hỏi

Trước khi kết thúc, nếu có điểm nào bạn cảm thấy mình trả lời chưa tốt, hãy chủ động nhắc lại:

> "Có một điều em muốn bổ sung. Ở câu về cache lúc nãy em trả lời hơi vội — em muốn nói thêm là..."

Điều này gần như luôn được đánh giá cao: nó cho thấy bạn tự nhận thức được, và nó cho bạn cơ hội sửa
một ấn tượng xấu thay vì để nó nằm im.

---

Tiếp: [04-tu-kiem-tra.md](./04-tu-kiem-tra.md)
