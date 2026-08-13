Token bucket + 100 req/phút/user + 429 kèm Retry-After đúng là combo chuẩn — token bucket cho phép burst ngắn mà vẫn giữ rate trung bình, còn 429/Retry-After là cách client chuẩn để biết khi nào retry mà không cần đoán. Về mặt "chọn thuật toán nào", bạn không sai.

Nhưng cái bẫy ở đây không nằm ở thuật toán, mà ở chỗ bạn đang gọi nó "không có gì đặc biệt custom" — thực ra phần custom quan trọng nhất chưa được nhắc tới: bucket state lưu ở đâu. Nếu service của bạn chạy nhiều instance (load balancer trước nhiều pod/process), mà bucket giữ in-memory trên từng instance, thì limit thật sự sẽ là 100 × số instance req/phút/user, không phải 100. Đây là giả định dễ bị bỏ qua nhất vì lúc code và test local (1 instance) mọi thứ đều đúng, chỉ vỡ khi lên production scale ngang — đúng lúc bạn cần rate limit hoạt động nhất (traffic spike/abuse).

Vài điểm khác cũng đáng kiểm tra trước khi coi đây là "xong":
- "100 req/phút/user" — user được định danh bằng gì? Nếu bằng API key/user ID thì request chưa auth (trước login, hoặc endpoint public không cần key) không có "user" để gắn bucket, cần lớp limit theo IP riêng ở tầng trước.
- Retry-After nên tính động theo thời gian còn lại đến khi bucket có token tiếp theo (dựa trên refill rate), không phải hardcode 60 giây — nếu hardcode, client sẽ retry sai thời điểm, gây thêm một đợt 429 dồn dập ngay sau đó.
- Mọi endpoint đang bị tính "1 request = 1 token" như nhau — nếu có endpoint nặng (query phức tạp, gọi ngoài) lẫn endpoint nhẹ, một user có thể áp đảo hệ thống trong giới hạn 100 req/phút bằng cách chỉ gọi endpoint nặng.

Góc nhìn khác: thay vì tự cài token bucket trong code service, cân nhắc đẩy phần đếm/atomic increment ra Redis (INCR + EXPIRE, hoặc script Lua để atomic hoá check-and-decrement token) hoặc dùng rate limiting có sẵn ở API gateway (Kong, Envoy, Cloudflare, hoặc nginx limit_req nếu đã có nginx trước service) — vừa giải quyết bài toán multi-instance ngay từ đầu, vừa đúng tinh thần "không custom" mà bạn đang nhắm tới, vì logic đếm đã được người khác test kỹ ở scale lớn rồi.

Nếu bỏ qua phần shared state mà vẫn ship: lúc bị abuse hoặc traffic tăng đột biến — tức là lúc rate limit có giá trị nhất — nó lại là lúc kém hiệu quả nhất, vì traffic dồn qua nhiều instance khiến giới hạn thực tế bị nhân lên đúng theo số instance đang chạy.

Hai câu hỏi để tự kiểm tra trước khi triển khai: Service này chạy 1 instance hay sẽ scale ngang (kể cả trong tương lai gần)? Và bucket state định lưu ở đâu — in-memory, hay có store dùng chung (Redis...)? Nếu câu trả lời là "sẽ scale ngang" mà chưa có store dùng chung, đó là chỗ nên xử lý trước khi merge, không phải để sau.
