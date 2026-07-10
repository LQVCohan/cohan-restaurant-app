# Tối ưu lớp phủ và bố cục modal lịch rảnh

## Hiện trạng

Modal **Lịch rảnh đã đăng ký** đã dùng lớp phủ sáng hơn nhưng phần nội dung vẫn chưa ưu tiên đúng công việc chính. KPI, bộ lọc, chú giải và ghi chú chiếm nhiều chiều cao, trong khi bảng lịch chỉ còn một vùng thấp và phải cuộn sớm.

## Luồng thực tế

`ScheduleManagement -> AvailabilitySnapshotModal -> AvailabilitySnapshotModal.scss -> AvailabilitySnapshotOverlayLight.css`.

Không có thay đổi dữ liệu, GraphQL hay hành vi. Component đã có đủ vùng header, KPI, bộ lọc, trạng thái và bảng để bố trí lại bằng CSS.

## Nguyên nhân

- Modal chỉ có `max-height`, không có chiều cao làm việc ổn định nên bảng không nhận phần không gian còn lại.
- Các KPI dùng bố cục card dọc dù mỗi ô chỉ có một nhãn và một con số.
- Khoảng cách giữa bộ lọc, kết quả, chú giải và ghi chú cộng dồn quá lớn.
- `availability-table-shell` bị giới hạn `max-height` thay vì co giãn theo phần còn lại của modal.

## Hướng sửa

- Giữ lớp phủ sage sáng và blur nhẹ.
- Đặt modal desktop ở chiều cao vận hành ổn định, ẩn overflow ngoài và giao phần cuộn cho bảng.
- Chuyển KPI thành dải số liệu thấp với nhãn và số cùng hàng.
- Thu gọn khoảng cách, chiều cao control, chú giải và trạng thái.
- Cho bảng `flex: 1`, bỏ giới hạn `max-height` ở desktop để chiếm toàn bộ không gian còn lại.
- Trên điện thoại cho toàn modal cuộn lại, giữ bảng có chiều cao tối thiểu và không cắt nội dung.
- Không thêm dependency, component, state hoặc GraphQL operation.

## File thay đổi

- `src/styles/AvailabilitySnapshotOverlayLight.css`: lớp override cuối cùng cho overlay và bố cục modal.
- `src/main.jsx`: tiếp tục nạp stylesheet sau các lớp giao diện quản lý hiện có.

## Tiêu chí chấp nhận

- Nền phía sau modal không còn tối xám như dark mode.
- Bảng lịch là vùng lớn nhất trong modal desktop.
- KPI và bộ lọc vẫn đọc rõ nhưng không chiếm quá nhiều chiều cao.
- Header, cột nhân viên và bảng vẫn giữ hành vi sticky/scroll hiện có.
- Mobile không bị cắt nội dung và có thể cuộn toàn modal.
- Không ảnh hưởng modal khác hoặc thay đổi dữ liệu lịch rảnh.

## Kiểm tra dự kiến

- `npm run check:conflicts`
- `npm run build`
- Kiểm tra trực quan tại desktop và 390x844 / 430x932.