# Review/Rating/Feedback Production Hardening

## Tổng quan
Module review hiện hỗ trợ đánh giá nhà hàng/món ăn/dịch vụ, phản hồi chính thức từ nhà hàng, reaction, helpful, report, moderation và analytics deterministic. Backend là source of truth cho danh tính khách hàng, trạng thái moderation, verified purchase và counter.

## Data model
- `Review`: target, restaurant, customer identity derived từ auth, staff reference đã validate, rating/content/images/tags, moderation status, verified evidence (`verifiedSource`, `verifiedSourceId`, `visitedAt`, `orderCompletedAt`), counters, sentiment/topic tags và first official reply timestamp.
- `ReviewComment`: comment/reply theo review, author metadata, `officialReply`, `authorType`, `replyByRestaurantId`, counters và reactions.
- `ReviewReaction` / `ReviewCommentReaction`: unique theo `{reviewId/commentId, userId}` để set/unset/change idempotent.
- `ReviewHelpful`: unique theo `{reviewId, userId}` để helpful toggle không spam count.
- `ReviewReport`: queue report với reason/detail/status/resolution fields.

## GraphQL API chính
- Query: `reviews`, `review`, `reviewStats`, `reviewComments`, `reviewReports`, `reviewReportStats`, `reviewAnalytics`.
- Mutation: `createReview`, `updateReview`, `deleteReview` (soft hide), `setReviewStatus`, `incrementReviewHelpful`, `reactReview`, `reportReview`, `resolveReviewReport`, `createReviewComment`, `updateReviewComment`, `deleteReviewComment`, `setReviewCommentStatus`, `reactReviewComment`. `ReviewInput` và `ReviewCommentInput` chỉ nhận field client-owned; identity/official reply/verified/moderation evidence luôn derive ở backend.
- Backward compatibility: mutation cũ vẫn giữ tên/tham số chính; field/input mới được thêm additive.

## Permission matrix
| Permission | Ý nghĩa |
| --- | --- |
| `review.read` | Xem review trong nhà hàng được phép |
| `review.write` | Khách tạo/cập nhật review của mình |
| `review.reply` | Tạo phản hồi chính thức |
| `review.moderate` | Duyệt/ẩn/reject/mark reported |
| `review.delete` | Soft delete/hide review/comment |
| `review.report.read` | Xem report queue |
| `review.report.resolve` | Resolve/reject report |
| `review.export` | Export CSV review |
| `review.analytics.read` | Xem analytics/queue/SLA |

Admin có toàn quyền. Manager/staff bị ràng buộc bởi `requireRestaurantAccess`. Customer chỉ xem published và thao tác với nội dung của mình.

## Moderation workflow
1. Customer tạo review -> luôn `pending`.
2. Manager có `review.moderate` duyệt thành `published`, ẩn `hidden`, đánh dấu `reported` hoặc `rejected` kèm reason/note.
3. Mọi đổi trạng thái ghi `EventLog` với from/to/reason/actor.
4. Delete mặc định là soft hide để giữ audit trail.

## Report workflow
1. User login gọi `reportReview(id, { reason, detail })`.
2. Mỗi user chỉ có một report cho cùng review/reason.
3. Backend recalc `reportsCount`; reason nghiêm trọng hoặc >= 3 report sẽ chuyển review sang `reported` nhưng không tự hidden.
4. Manager có `review.report.resolve` xử lý report bằng `resolveReviewReport`.

## Verified purchase rule
Backend không tin `verifiedPurchase` từ client. `resolveVerifiedReview` kiểm tra trong 180 ngày:
- Order cùng user/restaurant đã `served`/`completed` hoặc `paid`; food review yêu cầu order item `dishId` trùng target.
- Payment success cùng user/restaurant cho review không phải food.
- Reservation `confirmed`/`seated`/`completed` cho review không phải food.
Nếu không có evidence hợp lệ -> `verifiedPurchase=false`, `verifiedSource=none`.

## Staff performance integration
Review chỉ là evidence tham khảo:
- Chỉ tính review `published`, đúng `staffId`, đúng `restaurantId`, trong kỳ và rating 1–5.
- Lưu `staffRate`, `staffRateCount`, `verifiedStaffRate`, `verifiedStaffRateCount`, `unverifiedStaffRateCount`, `customerRatingScore`.
- Nếu `staffRateCount < 3`: chỉ lưu evidence, `customerRatingScore=0`, không phạt mạnh.
- Không tạo incident tự động từ review; manager phải xác nhận qua luồng incident nếu cần.

## Analytics metrics
`reviewAnalytics` trả về total/avg/status counts, negative count, verified rate, reply rate, average first reply minutes, rating trend, breakdown, top tags/topics, top staff, low-rated targets, report breakdown và queue counts (`needsModeration`, `needsReply`, `highRisk`). Sentiment/topic là heuristic tiếng Việt deterministic, không phụ thuộc AI provider.

## QA checklist thủ công
- [ ] Customer đăng review khi login.
- [ ] Customer không login không đăng được.
- [ ] Review mới vào `pending`.
- [ ] Manager duyệt thì public thấy.
- [ ] Manager ẩn thì public không thấy.
- [ ] Customer report review.
- [ ] Manager resolve report.
- [ ] Official reply hiển thị badge “Phản hồi từ nhà hàng”.
- [ ] Reaction/helpful không spam count khi bấm lặp hoặc đổi reaction.
- [ ] Review gắn staff xuất hiện trong performance factors sau recalc.
- [ ] Manager thấy đúng “Hiển thị X / total đánh giá” khi danh sách bị giới hạn 100 item mới nhất.
- [ ] Export CSV không lỗi tiếng Việt, dấu phẩy hoặc dấu nháy kép.

## Known limitations
- Customer review list hiện load official replies bằng query `reviewComments` riêng cho từng review trong component `OfficialReplies`, nên có pattern N+1 khi danh sách review dài. Đây không phải blocker của PR hardening hiện tại; follow-up nên thêm field `officialReplies`/`firstOfficialReply` trực tiếp vào `Review` query hoặc batch query comments theo `reviewIds`.
- Chưa có notification/email wiring đầy đủ; EventLog đã sẵn để nối notification worker sau.
- Service review chưa có model target chuyên biệt nên hiện validate restaurant tồn tại và không crash.
- Analytics chart UI đang ưu tiên cards/table deterministic; AI summarization nên là PR sau với feature flag.
