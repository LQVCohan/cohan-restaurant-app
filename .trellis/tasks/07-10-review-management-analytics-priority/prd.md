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

## Tiêu chí nghiệm thu

- Mặc định trang mở ở tab `Tất cả`; không render khối `Tổng quan đánh giá` trong view danh sách.
- Tab `Phân tích` hiển thị insight, hàng đợi, report center và các bảng tổng hợp trên một vùng nội dung toàn chiều rộng.
- Search và các bộ lọc review không xuất hiện trong tab phân tích; phạm vi nhà hàng vẫn chọn được.
- Bấm `Báo cáo cần xử lý`, `Đánh giá cần phản hồi` hoặc hàng đợi khác chuyển về danh sách đúng bộ lọc.
- Người không có `review.analytics.read` không thấy tab phân tích và không gọi analytics query.
- Toàn bộ trang dùng cùng palette `--manager-bg-*`, `--manager-surface*`, `--manager-border*`, `--manager-text`, `--manager-muted`, `--manager-primary` và `--manager-accent`.
- Semantic warning/danger/success vẫn có nhãn chữ, không chỉ dựa vào màu.
- Responsive, focus, loading/error/empty state và quyền hiện tại không bị mất.

## Validation

- Targeted Vitest cho `ReviewManagement` tab và query skip.
- Targeted test cho queue chuyển từ analytics về danh sách.
- Build frontend.
- Browser smoke 375, 768, 1024 và 1440 px.