Consulted skill: yes — user trình bày một thiết kế kỹ thuật cụ thể đã chốt (token bucket, 100/phút/user, 429+Retry-After), không phải hỏi chọn giữa các phương án.

---

Token bucket + 429 kèm Retry-After là combo chuẩn — cho phép burst tự nhiên, đúng semantics HTTP để client tự backoff. Chọn thuật toán này không sai.

Nhưng "không có gì đặc biệt custom" là chỗ đáng lo, vì phần khó của rate limiting hiếm khi nằm ở thuật toán:

State lưu ở đâu? Nếu API chạy nhiều instance, bucket in-memory từng instance sẽ cho limit thật là N×100/phút thay vì 100.

"User" định danh bằng gì? Nếu có traffic chưa auth, "user" thực chất là IP — dễ chặn nhầm nhóm sau NAT chung, hoặc dễ bị né bằng cách đổi IP.

Retry-After hardcode hay tính động theo refill rate? Hardcode dễ gây thundering herd khi nhiều client cùng retry sau đúng khoảng thời gian đó.

Góc nhìn khác: đẩy phần đếm ra Redis (atomic script) hoặc dùng rate limiter có sẵn ở gateway (Cloudflare, nginx limit_req...) — đã giải quyết distributed state và atomicity, test ở quy mô lớn hơn code tự viết.

Nếu bỏ qua: rate limiter "trông đúng" khi test 1 instance/traffic thấp, nhưng khi scale ngang hoặc traffic spike thật, limit thực tế bị vượt mà không ai phát hiện — tới khi DB/downstream quá tải đúng giờ cao điểm.

Service sẽ chạy 1 hay nhiều instance? Bucket state định lưu ở đâu? Và đã test concurrent (nhiều request bắn đồng thời) để xem limit thật có đúng 100/phút chưa, hay mới test tuần tự?
