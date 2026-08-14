Về cơ bản hướng đi này hợp lý — token bucket là thuật toán rate limiting phổ biến vì nó cho phép burst ở một mức độ nhất định thay vì chặn cứng theo cửa sổ cố định, và 429 + Retry-After là đúng chuẩn HTTP (RFC 6585 / RFC 9110) nên client và các thư viện HTTP đều hiểu được để tự retry.

Vài điểm đáng cân nhắc thêm trước khi coi đây là xong:

1. **Lưu state ở đâu**: Nếu API chạy nhiều instance (load balancer, autoscaling), token bucket phải lưu ở nơi tập trung như Redis chứ không được để in-memory trên từng process, không thì mỗi instance sẽ tự cho phép 100 req/phút riêng, tổng cộng vượt xa giới hạn thật. Nếu chỉ chạy 1 instance thì không vấn đề gì, nhưng đáng để xác nhận rõ.

2. **Định danh "user"**: Nếu API có cả traffic chưa đăng nhập (chỉ có IP), cần tính riêng cách limit theo IP hay theo API key/user id, vì IP có thể bị NAT chung (nhiều user sau 1 IP công ty) hoặc bị đổi liên tục.

3. **Header đi kèm**: Ngoài Retry-After, nên cân nhắc thêm X-RateLimit-Limit / X-RateLimit-Remaining / X-RateLimit-Reset (không chuẩn hoá chính thức nhưng gần như quy ước ngầm, nhiều client/dev tool đọc được) để client biết trước khi bị chặn thay vì chỉ biết sau khi dính 429.

4. **Một mức limit chung cho mọi endpoint**: 100 req/phút có thể hợp lý cho endpoint nhẹ nhưng quá thoải mái hoặc quá chặt cho endpoint nặng (ví dụ endpoint tốn nhiều CPU/DB). Có thể không cần làm ngay nhưng nên để chỗ mở rộng sau này thành limit theo từng nhóm endpoint.

5. **Đo lường trước khi launch**: Nên log/monitor số lượng request bị 429 sau khi deploy để biết 100/phút có đang chặn nhầm user bình thường hay không, trước khi coi là con số cuối cùng.

Nếu đã tính đến các điểm trên (đặc biệt là điểm 1 nếu chạy nhiều instance) thì cứ triển khai, không cần thiết kế phức tạp hơn — không có lý do gì để tự chế thuật toán riêng khi token bucket + 429/Retry-After đã giải quyết đúng bài toán.
