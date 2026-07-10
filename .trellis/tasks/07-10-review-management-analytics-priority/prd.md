# PRD — Ưu tiên phân tích và harden luồng review

## Hiện trạng

- Khối phân tích được render trước danh sách trong JSX nhưng CSS đặt `order: 3`, khiến nó xuất hiện sau danh sách review dài.
- Trang review dùng một theme cam riêng, không đồng bộ sage/warm-neutral của các trang manager.
- Hàng đợi báo cáo chỉ lấy review có `status = reported`, bỏ sót review vẫn công khai nhưng đang có report chờ xử lý.
- UI quản trị hiển thị thao tác xóa review công khai trong khi backend chỉ cho phép hậu kiểm bằng trạng thái ẩn/từ chối có lý do.
- Sau khi phản hồi chính thức, chỉ comment trong modal được refetch; KPI, danh sách và analytics bên ngoài vẫn cũ.
- Phía khách chưa đồng bộ validation với backend, có nút bình luận không có hành động, và một số mutation không cập nhật/hiển thị phản hồi đầy đủ.

## Luồng thật

`review.graphql → Review model → review query/mutation + reviewInsight/reviewHardening service → Apollo operations → ReviewManagement/ReviewModal/ReviewsList → RestaurantDetail/ReviewsSection/PostOrderReviewPrompt → thao tác tạo, phản hồi, report, reaction và helpful`.

## Hướng xử lý

1. Đưa phân tích lên trước danh sách bằng đúng DOM/flex ordering hiện có; giữ insight và hàng đợi ưu tiên nhìn thấy ngay.
2. Đồng bộ màu, surface, border, focus, responsive và motion theo template manager sage/warm-neutral; không thêm dependency.
3. Khi người quản lý lọc báo cáo, trả cả review `reported` và review còn `published` nhưng có `reportsCount > 0`; public vẫn chỉ nhận contract công khai hiện tại.
4. Gỡ nút xóa sai nghiệp vụ khỏi danh sách quản trị; giữ luồng ẩn/từ chối qua moderation.
5. Sau official reply, refetch các operation liên quan để KPI, list và analytics cập nhật ngay.
6. Đồng bộ validation khách với backend, làm mới dữ liệu sau create/report, thay nút bình luận chết bằng chỉ số không tương tác, và hiển thị lỗi ở prompt sau đơn.
7. Với 0 review, trả insight trạng thái chưa có dữ liệu bằng tiếng Việt thay vì câu heuristic pha tiếng Anh.

## Tiêu chí nghiệm thu

- Khối “Tổng quan đánh giá” xuất hiện trước tiêu đề và danh sách review, không phụ thuộc độ dài danh sách.
- Giao diện thống nhất template manager ở desktop/tablet/mobile, có focus rõ và không dùng `transition: all`.
- Hàng đợi report không bỏ sót review công khai đang có report chờ xử lý.
- Không còn nút xóa review công khai gây lỗi backend.
- Gửi phản hồi chính thức cập nhật ngay số review cần phản hồi và nội dung list.
- Khách không thể gửi nội dung dưới 10 ký tự; create/report cập nhật lại dữ liệu; không còn nút bình luận giả.
- Prompt review sau đơn hiển thị lỗi thay vì thất bại im lặng.
- Public visibility, restaurant scoping, quyền moderation/report/reply và notification không bị nới lỏng.

## Validation

- Targeted Vitest cho resolver/service review.
- Targeted Vitest cho ReviewModal, ReviewsSection và PostOrderReviewPrompt.
- Build frontend.
- Browser smoke 375, 768, 1024 và 1440 px.
