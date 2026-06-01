# Review module advanced production notes

## Kiến trúc

Module Review gồm GraphQL schema `review.graphql`, resolver review/review_comment, models `Review`, `ReviewComment`, `ReviewReport`, `ReviewHelpful`, `ReviewReaction`, `ReviewCommentReaction`, `Notification` và `EventLog`.

## Data flow

1. Customer gửi review → backend validate target/restaurant/rating/content → lưu `pending`.
2. Manager dùng ReviewManagement/Action Center lọc pending/reported/high-risk.
3. Manager approve/reject/hide → ghi `EventLog`, gửi notification customer nếu cần.
4. Public list chỉ thấy `published` và có `firstOfficialReply` để tránh N+1.
5. Manager tạo official reply → customer thấy badge “Phản hồi từ nhà hàng” và notification.
6. Customer report review → tạo/ghép `ReviewReport`, tăng `reportsCount`, notification manager.
7. Manager resolve/reject report → ghi audit timeline, không tự public review hidden/rejected.
8. Analytics dùng aggregation cho counts/trend/top lists và trả insight summary deterministic khi không bật AI.

## Notification flow

UI dùng `NotificationBell` trong ReviewManagement để manager đọc `notifications`/`unreadNotificationCount`, mark read và mark all read. Backend đã tạo notification trực tiếp cho customer (`toUserId`) và component đã có `enabled` guard để có thể gắn vào CustomerLayout ở follow-up mà không query khi guest; hiện customer notification bell chưa được tích hợp toàn cục để tránh đổi layout rộng trong PR này. Backend filter theo `toUserId` hoặc `toRole + restaurantId`, có index cho unread và role scoped access.

## Analytics design/performance

`reviewAnalytics` gom status counts, avg rating, breakdown, trend, top tags/staff, low-rated targets, report breakdown bằng Mongo aggregation `$facet`. Reply rate chỉ aggregate official replies theo review IDs liên quan, hạn chế load rows đầy đủ.

## Permission model

- Customer chỉ đọc notification trực tiếp của mình hoặc public review.
- Manager/staff cần permission `review.read`, `review.analytics.read`, `review.report.read`, `review.report.resolve`, `review.reply` tùy action.
- Manager bị scope bởi `requireRestaurantAccess`; không đọc notification/report/timeline nhà hàng khác.
- `reviewTimeline` chỉ dành cho người có quyền quản trị review, customer không thấy audit nhạy cảm.

## AI insight feature flag

- `REVIEW_AI_INSIGHTS_ENABLED=false` (default): dùng heuristic deterministic, không network/API key.
- `REVIEW_AI_INSIGHTS_ENABLED=true` + provider nội bộ tương lai: có thể generate insight nâng cao nhưng chỉ gửi dữ liệu đã cắt ngắn, không gửi dữ liệu nhạy cảm.
- Provider fail → fallback heuristic.

## Security/abuse notes

- Duplicate report/helpful/reaction tiếp tục idempotent theo DB guard.
- Nội dung AI không gọi network trong unit test.
- Image upload thật chưa được thêm nếu chưa có upload infra thống nhất; URL/path validation nên nằm trong follow-up upload PR.

## Limitations còn lại

- Smoke hiện là API-level do repo chưa có Playwright/Cypress.
- Rate limit middleware chung cho review actions chưa thấy trong repo; nên thêm ở gateway/server layer khi chuẩn hóa rate-limit toàn hệ thống.
- Export hiện là CSV/JSON browser download, chưa có PDF.
