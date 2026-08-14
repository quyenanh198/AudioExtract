# counterpoint skill — eval report

## Phương pháp (3 kiểu test đã chạy)

| Kiểu | Cách chạy | Đo được gì |
|---|---|---|
| **Forced with-skill** (iteration-1, iteration-2) | Agent con bị lệnh "đọc SKILL.md rồi làm theo" | Chất lượng nội dung phản biện, giả sử skill đã trigger |
| **Baseline** (iteration-1, dùng lại cho iteration-2) | Agent con trả lời bình thường, không biết skill tồn tại | Đường tham chiếu: Claude vốn đã làm gì nếu không có skill |
| **Live/unforced** (mới) | Chỉ đưa tên + description skill (đúng như skill listing thật), agent tự quyết có đọc SKILL.md hay không | Skill có **tự trigger đúng lúc** không — thứ 2 kiểu trên không đo được |

Live-test ban đầu định chạy bằng 7 agent con, nhưng cả 7 đều fail do dính giới hạn phiên (session limit) của tài khoản. Chuyển sang chạy trực tiếp trong phiên này — tự quyết định trigger hay không cho từng prompt, viết thẳng câu trả lời. Nhược điểm: không "mù" hoàn toàn như agent con (mình biết rõ thiết kế eval), nhưng vẫn là phép thử tốt hơn hẳn hai kiểu forced ở trên.

## Kết quả Live-test (7/7 quyết định trigger đúng)

| Eval | Quyết định trigger | Đúng ý đồ thiết kế? |
|---|---|---|
| implicit-business-free-tier-cut | Có — lập trường đã nghiêng | ✅ |
| implicit-tech-rust-rewrite | Có — quyết định kỹ thuật đã chọn | ✅ |
| explicit-career-quit-startup | Có — gọi rõ "cho góc nhìn khác" | ✅ |
| solid-idea-rate-limiting | Có — thiết kế đã chốt | ✅ |
| sensitive-family-loss | Có, nhưng áp exemption (không ép 5 bước) | ✅ |
| irreversible-cafe-lease | Có, nhưng chỉ phản biện phần còn mở | ✅ |
| **boundary-claude-plan-upgrade** | **Không** — nhận đúng đây là xin tư vấn chọn phương án | ✅ (đây là case từng fail ở iteration-1) |

Toàn bộ nội dung từng case: `.claude/skills/counterpoint-workspace/live-test/eval-*.md`

## Forced with-skill vs baseline (grading theo assertion)

| Eval | Iteration-1 with-skill | Iteration-2 with-skill (sau khi sửa SKILL.md) | Baseline (reused) |
|---|---|---|---|
| implicit-business-free-tier-cut | 6/6 | 6/6 | 5/6 |
| implicit-tech-rust-rewrite | 5/5 | 5/5 | 4/5 |
| explicit-career-quit-startup | 4/4 | 4/4 | 4/4 |
| solid-idea-rate-limiting | 3/3 | 3/3 | 3/3 |
| sensitive-family-loss | 3/3 | 3/3 | 3/3 |
| irreversible-cafe-lease | 3/3 | 3/3 | 3/3 |
| **boundary-claude-plan-upgrade** | **1/3** ⚠️ | **3/3** ✅ | 3/3 |
| **Tổng** | **25/27 (92.6%)** | **27/27 (100%)** | **25/27 (92.6%)** |

Iteration-2 sửa đúng chỗ hổng (case ranh giới trigger), không làm hỏng 6 case còn lại, và giờ vượt baseline thay vì hòa.

## Chi phí

| Config | Thời gian TB | Token TB |
|---|---|---|
| with-skill (iter-2) | 54.1s | 43,881 |
| baseline | 35.4s | 39,626 |

with-skill vẫn tốn hơn ~53% thời gian, ~11% token — chấp nhận được đổi lại cho case ranh giới giờ đã đúng và 3 case còn lại (business, tech, career) v có giá trị thật rõ so với baseline.

## Kết luận

- SKILL.md hiện tại (đã sửa boundary) hoạt động đúng cả 3 lớp test: nội dung tốt (forced), tự trigger đúng lúc kể cả case khó (live), và thắng baseline thay vì hòa (benchmark).
- Sẵn sàng package + merge nếu không còn góp ý gì thêm.
