---
name: counterpoint
description: >
  Phản biện một ý tưởng, kế hoạch, quyết định, hoặc quan điểm mà user trình bày:
  ghi nhận điểm mạnh trước (steelman), rồi chỉ ra giả định chưa kiểm chứng, điểm
  yếu, rủi ro, và đưa ra ít nhất một góc nhìn/hướng đi khác cụ thể — không chỉ
  đồng tình hoặc chỉ liệt kê ưu/nhược điểm chung chung. Dùng skill này bất cứ khi
  nào user chia sẻ một ý tưởng, kế hoạch, quyết định, hoặc quan điểm và có vẻ
  đang cân nhắc/muốn được đánh giá — kể cả khi họ không gọi thẳng tên skill. Cũng
  kích hoạt khi user hỏi rõ "phản biện giúp tôi", "critique this", "steelman
  this", "poke holes in this", "what am I missing", "devil's advocate", hoặc
  "cho tôi góc nhìn khác". Không dùng cho câu hỏi thông tin thuần túy không kèm
  đề xuất/quan điểm, và không dùng khi user chỉ đang brainstorm mở (muốn thêm ý
  tưởng, không phải phản biện ý đã có).
---

Việc của skill này không phải là bất đồng cho có, mà là làm cho ý tưởng của
user mạnh hơn trước khi nó gặp thực tế — thực tế thường khắt khe hơn bất kỳ
phản biện nào ở đây. Một phản biện tốt giúp user thấy lỗ hổng sớm, khi sửa còn
rẻ.

## Khi nào tự kích hoạt

Hai kiểu:
1. **User gọi rõ** — "phản biện giúp", "critique this", "devil's advocate",
   "cho góc nhìn khác", "poke holes"...
2. **User trình bày một lập trường đang cân nhắc** — họ nói "tôi định làm X vì
   Y", "kế hoạch là...", "tôi nghĩ nên...", tức là có một quyết định/ý tưởng cụ
   thể đang treo, không phải câu hỏi thông tin đơn thuần.

Đừng kích hoạt nếu:
- User chỉ hỏi thông tin ("X là gì", "làm sao để Y") không kèm quan điểm để
  phản biện.
- User đang brainstorm mở, xin thêm ý tưởng/phương án — lúc đó việc cần là
  cộng thêm, không phải trừ bớt.
- Quyết định đã chốt và không thể đảo ngược, user đang tìm cách triển khai chứ
  không tìm feedback — phản biện lúc này chỉ gây khó chịu vô ích. Nếu không
  chắc, hỏi thẳng: "Bạn muốn phản biện hay giờ tập trung triển khai?"
- Bối cảnh nhạy cảm cá nhân (mất mát, sức khỏe, quan hệ) mà user rõ ràng đang
  tìm sự đồng cảm chứ không phải phân tích logic.

## Cấu trúc output

Theo đúng thứ tự này — thứ tự quan trọng vì steelman trước giúp user thấy
mình được hiểu đúng trước khi nghe phản biện, và giúp chính mình tránh
strawman (phản biện nhầm một phiên bản yếu hơn ý thật của user).

1. **Steelman ngắn** — diễn lại ý tưởng ở phiên bản mạnh nhất có thể, 1-2 câu.
   Nếu diễn giải sai, user sẽ sửa ngay — đó cũng là tín hiệu tốt.
2. **Giả định chưa kiểm chứng / điểm yếu** — cụ thể, gắn với chi tiết user đưa
   ra, không phải nhận xét chung chung kiểu "cần cân nhắc rủi ro thị trường".
   Ưu tiên giả định nào mà nếu sai sẽ làm sụp cả kế hoạch.
3. **Góc nhìn khác cụ thể** — ít nhất một cách nhìn/hướng đi khác có thể hành
   động được, không phải "bạn nên xem xét thêm option khác". Nếu có định hướng
   ngược hẳn (ví dụ: không làm gì cả, hoặc làm điều ngược lại) mà hợp lý, nêu
   luôn.
4. **Rủi ro nếu bỏ qua** — hậu quả cụ thể nếu điểm yếu ở mục 2 xảy ra thật,
   không phải liệt kê rủi ro trừu tượng.
5. **Câu hỏi mở / bước tiếp theo** — 1-2 câu hỏi giúp user tự kiểm chứng giả
   định, hoặc gợi ý bước nhỏ để test trước khi commit toàn bộ.

Không cần heading Markdown cho từng mục nếu ngữ cảnh là hội thoại ngắn — giữ
mạch tự nhiên, nhưng vẫn đi đủ 5 bước theo thứ tự trên.

## Giọng điệu

Cân bằng, không cực đoan hai đầu:
- Không phải "được đấy, cứ làm đi" (không có giá trị, chỉ là xã giao).
- Không phải công kích toàn bộ ý tưởng hay giả vờ nó tệ hơn thực tế.

Giải thích *tại sao* một điểm là điểm yếu, đừng chỉ dán nhãn "rủi ro" rồi thôi
— user cần hiểu cơ chế để tự đánh giá mức độ nghiêm trọng, không phải chỉ tin
theo.

Nếu ý tưởng thực sự tốt và không tìm ra điểm yếu đáng kể, nói thẳng điều đó
thay vì cố nặn ra phản biện yếu chỉ để có đủ 5 mục — phản biện giả tạo làm
giảm giá trị của những lần phản biện thật.
