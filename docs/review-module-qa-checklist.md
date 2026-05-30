# Review module QA checklist

## Customer/public flow

- [ ] Customer đã login submit review thành công và review ở trạng thái `pending`.
- [ ] Customer chưa login không submit review được.
- [ ] Customer chưa login không react/helpful/report được.
- [ ] Review `pending` không xuất hiện ở public list.
- [ ] Review `published` xuất hiện ở public list.
- [ ] Official reply hiển thị badge “Phản hồi từ nhà hàng”.
- [ ] Public review list không gọi `GetReviewComments` cho từng review.
- [ ] Empty state đẹp khi chưa có review.
- [ ] Error state rõ khi reviews query lỗi.
- [ ] Report modal có nút hủy/close và không lặp message inline/modal quá nhiều.

## Moderation flow

- [ ] Manager approve review pending -> public thấy review.
- [ ] Manager reject review pending -> public không thấy review.
- [ ] Manager hide review published -> public không thấy review.
- [ ] Reject/hide có confirm/reason prompt và không crash khi cancel.
- [ ] Status badges rõ màu cho `pending`, `published`, `hidden`, `reported`, `rejected`.
- [ ] Negative review rating <= 2 được highlight.
- [ ] Review <= 2 và chưa có official reply hiển thị badge “Chưa phản hồi”.
- [ ] High risk hiển thị khi `reportsCount >= 3` hoặc negative + report.

## Interaction/report idempotency

- [ ] Helpful bấm lặp không spam count.
- [ ] Reaction bấm lặp/chuyển reaction không âm counter.
- [ ] Report duplicate cùng user/reason không spam count.
- [ ] Resolve report không public nhầm review `hidden`/`rejected`.

## Notification/EventLog evidence

- [ ] Approve review tạo notification/EventLog cho customer.
- [ ] Reject review tạo notification/EventLog cho customer.
- [ ] Official reply tạo notification/EventLog cho customer.
- [ ] Customer report review tạo notification/EventLog cho manager/owner.
- [ ] Review 1–2 sao tạo notification/EventLog “Có đánh giá tiêu cực cần xử lý”.

## Analytics/queue

- [ ] Analytics cards hiển thị tổng review, avg rating, verified rate, negative, pending, needs reply, pending reports, high risk.
- [ ] Empty analytics không crash.
- [ ] Loading/error analytics có state rõ và retry nếu query lỗi.
- [ ] Queue “Cần kiểm duyệt” đếm pending/reported.
- [ ] Queue “Cần phản hồi” đếm published <= 2 sao chưa có official reply.
- [ ] Queue “Rủi ro cao” đếm report cao/negative report.
- [ ] Rating trend theo ngày/tuần hiển thị dạng table.
- [ ] Filter theo nhà hàng cập nhật reviews và analytics.

## Service/staff/export evidence

- [ ] `targetType: service` với `serving_speed` hoặc service id seed pass validation.
- [ ] Invalid service target bị reject.
- [ ] Manager UI hiển thị tên dịch vụ dễ hiểu thay vì ID.
- [ ] Review có `staffId` xuất hiện trong staff performance evidence sau khi tính lại.
- [ ] CSV export mở được trong Excel/Sheets và tiếng Việt không lỗi encoding.
