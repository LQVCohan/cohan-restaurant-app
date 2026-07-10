# PRD — Đồng bộ màu và tách tab phân tích review

## Hiện trạng

- Trang review vẫn tự khai báo nền kem, viền nâu và accent cam/xanh cũ thay vì dùng trực tiếp token sage của manager shell.
- `ManagementPageHeader`, `ManagerCommandBar`, sidebar, danh sách review và modal bị các style cục bộ ghi đè bằng nhiều hệ màu khác nhau.
- Khối phân tích nằm chung với danh sách review, làm trang vận hành quá dài và trộn hai công việc: xử lý review với đọc insight.
- Hàng đợi báo cáo đã lấy đúng cả review `reported` và review còn `published` nhưng có report chờ xử lý.
- Luồng review phía khách, validation và refresh dữ liệu đã được harden ở lần triển khai trước.

## Luồng thật

`review.graphql → Review model → review query/mutation + reviewInsight service → Apollo operations → ReviewManagement state/currentTab → ManagerCommandBar → analytics view hoặc review filters/list → ReviewModal`.

Thay đổi lần này chỉ nằm ở frontend presentation/state. Không đổi schema, resolver, permission, restaurant scoping hoặc payload analytics.

## Hướng xử lý

1. Thêm tab `Phân tích` vào command bar khi người dùng có quyền `review.analytics.read`.
2. Chỉ query và render analytics/report center khi tab `Phân tích` đang mở; tab review chỉ hiển thị bộ lọc và danh sách.
3. Khi bấm một hàng đợi trong tab phân tích, chuyển về tab review tương ứng và giữ bộ lọc hành động.
4. Ở tab phân tích, dùng bộ chọn phạm vi nhà hàng gọn thay cho toàn bộ sidebar vận hành.
5. Bỏ canvas màu riêng của review và ánh xạ toàn bộ surface, border, text, focus, shadow sang `--manager-*`.
6. Xóa màu cam/xanh hard-code còn lại trong sidebar, review card và modal; chỉ giữ vàng/đỏ/xanh cho trạng thái có ý nghĩa.
7. Không thêm dependency hoặc abstraction mới.

## Follow-up — Gộp thông báo review vào chuông tổng

### Hiện trạng và root cause

- `ManagerLayout → ManagerHeaderWithNotifications → Header` đã dùng `useCommunication({ notificationsEnabled: true })`, nên chuông tổng nhận cùng nguồn `notifications`, số chưa đọc và mutation đánh dấu đã đọc.
- `ReviewManagement` lại render thêm `NotificationBell` với `restaurantId`, tạo thêm query, polling, socket listener và một chuông cục bộ trùng chức năng.
- Resolver `notifications` không lọc theo loại notification; review notification được tạo chung trong collection `Notification`, nên không cần thay đổi backend để xuất hiện ở chuông tổng.

### Thay đổi nhỏ nhất

1. Xóa import và khối “Thông báo đánh giá gần đây” khỏi `ReviewManagement.jsx`.
2. Xóa style `.reviews-notification-row` và selector responsive không còn dùng.
3. Bỏ mock `NotificationBell` trong test và kiểm tra trang không render khối thông báo cục bộ.
4. Không sửa `ManagerLayout`, `Header`, `useCommunication`, schema hoặc resolver.

## Tiêu chí nghiệm thu

- Mặc định trang mở ở tab `Tất cả`; không render khối `Tổng quan đánh giá` trong view danh sách.
- Tab `Phân tích` hiển thị insight, hàng đợi, report center và các bảng tổng hợp trên một vùng nội dung toàn chiều rộng.
- Search và các bộ lọc review không xuất hiện trong tab phân tích; phạm vi nhà hàng vẫn chọn được.
- Bấm `Báo cáo cần xử lý`, `Đánh giá cần phản hồi` hoặc hàng đợi khác chuyển về danh sách đúng bộ lọc.
- Người không có `review.analytics.read` không thấy tab phân tích và không gọi analytics query.
- Toàn bộ trang dùng cùng palette `--manager-bg-*`, `--manager-surface*`, `--manager-border*`, `--manager-text`, `--manager-muted`, `--manager-primary` và `--manager-accent`.
- Semantic warning/danger/success vẫn có nhãn chữ, không chỉ dựa vào màu.
- Trang review không còn khối “Thông báo đánh giá gần đây” hoặc chuông thông báo cục bộ.
- Review notification vẫn được hiển thị và đánh dấu đã đọc qua chuông tổng ở header manager.
- Responsive, focus, loading/error/empty state và quyền hiện tại không bị mất.

## Validation

- Targeted Vitest cho `ReviewManagement` tab, query skip và việc không render notification row cục bộ.
- Targeted test cho queue chuyển từ analytics về danh sách.
- Build frontend.
- Browser smoke 375, 768, 1024 và 1440 px.