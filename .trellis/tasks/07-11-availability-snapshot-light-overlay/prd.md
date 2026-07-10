# Làm sáng lớp phủ modal lịch rảnh

## Hiện trạng

Modal **Lịch rảnh đã đăng ký** dùng lớp phủ xanh xám tối và blur khá mạnh. Trên giao diện quản lý sáng màu, nền phía sau trông như bị khóa hoặc chuyển sang dark mode, làm modal nặng và tách khỏi hệ thống sage hiện có.

## Luồng thực tế

`ScheduleManagement -> AvailabilitySnapshotModal -> AvailabilitySnapshotModal.scss`.

Không có thay đổi dữ liệu, GraphQL hay hành vi. Lỗi chỉ nằm ở lớp trình bày của overlay và bóng đổ modal.

## Hướng sửa

- Dùng lớp phủ sage sáng, bán trong suốt thay cho màu tối.
- Giảm blur để vẫn nhận biết được ngữ cảnh trang phía sau.
- Giảm độ nặng của bóng modal nhưng vẫn giữ phân tầng rõ.
- Giữ nguyên responsive, focus, scroll, error/loading state và thao tác đóng modal.
- Không thêm dependency hoặc thay đổi component tree.

## File thay đổi

- `src/styles/AvailabilitySnapshotOverlayLight.css`: override thị giác nhỏ, theo pattern stylesheet polish đang có trong repo.
- `src/main.jsx`: nạp stylesheet sau các lớp giao diện quản lý hiện có.

## Tiêu chí chấp nhận

- Nền phía sau modal không còn tối xám như dark mode.
- Modal vẫn nổi bật và nội dung phía sau vẫn được làm dịu vừa đủ.
- Không ảnh hưởng modal khác.
- Không thay đổi dữ liệu hoặc hành vi của lịch rảnh.

## Kiểm tra dự kiến

- `npm run check:conflicts`
- `npm run build`
- Kiểm tra trực quan tại desktop và 390x844 / 430x932.
