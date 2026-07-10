# Bỏ loading giả và tối ưu lịch rảnh part-time

## Hiện trạng

- Trang lịch bị phủ bởi lớp `schedule-polish-hydrating` trong khoảng 620–1250 ms dù Apollo đã có loading state riêng.
- Modal lịch rảnh dùng cùng một ma trận ngày × loại ca cho cả full-time và part-time.
- Full-time được xác định chủ yếu bằng `workingDays`, còn part-time gửi availability theo từng `date + shiftType` và số giờ được tính từ `schedulingPolicy.shiftTemplates`.
- Chính sách/demo hiện hỗ trợ ca full-time 8 giờ và ca part-time 4 giờ, nhưng modal chưa tách hai cách đọc nên khó kiểm tra part-time.

## Luồng thực tế

`SchedulingPolicy.shiftTemplates -> schedulingPolicy resolver/hook -> ScheduleManagement -> AvailabilitySnapshotModal -> availability submission slots -> UI matrix`.

Loading giả đi theo:

`ScheduleManagementPage -> initScheduleHydrationPolish -> schedule-polish-hydrating CSS overlay`.

## Hướng sửa

- Xóa caller, util và stylesheet của `initScheduleHydrationPolish`; giữ các loading/error state thật trong component.
- Modal có hai chế độ xem:
  - **Toàn thời gian**: mỗi ngày một ô, dựa trên `workingDays` và ngoại lệ đã duyệt.
  - **Bán thời gian**: mỗi ngày chia theo các block ca part-time; hiển thị giờ bắt đầu, giờ kết thúc và thời lượng.
- Nhận diện block part-time từ ca 4 giờ/nhãn part-time và luôn giữ các shift type đã xuất hiện trong submission để không làm mất dữ liệu cũ.
- Khi chính sách chưa có block 4 giờ, hiển thị cảnh báo rõ và dùng các ca hiện có thay vì tự tạo key không được backend chấp nhận.
- Giữ tìm kiếm, lọc loại hợp đồng, lọc vai trò/phòng ban, trạng thái thiếu đăng ký, error/loading/empty state và thao tác Escape/Đóng.

## File thay đổi

- `src/components/Dashboard_Manager/Schedule/ScheduleManagementPage.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModalInline.jsx`
- `src/styles/AvailabilitySnapshotOverlayLight.css`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.test.jsx`
- `src/styles/schedule-polish.css`
- Xóa `src/utils/scheduleHydrationPolish.js`.
- Xóa `src/styles/schedule-hydration-polish.css`.
- Task Trellis hiện tại.

## Ngoài phạm vi

- Không đổi GraphQL schema, availability mutation hoặc dữ liệu lịch đã lưu.
- Không tự động sửa chính sách ca của nhà hàng.
- Không thêm dependency.

## Tiêu chí chấp nhận

- Tải trang lịch không còn màn phủ “Đang đồng bộ lịch, nhân sự và đăng ký ca...”.
- Full-time không còn bị nhân bản trạng thái cố định qua mọi loại ca trong ngày.
- Part-time xem được block ca, khung giờ và số giờ; ca 4 giờ được nhận diện rõ.
- Dữ liệu submission cũ vẫn hiển thị kể cả khi cấu hình ca hiện tại chưa chuẩn 4 giờ.
- Modal vẫn phủ viewport, cuộn được và đóng bằng Escape.

## Kiểm tra dự kiến

- Targeted Vitest cho `AvailabilitySnapshotModal`.
- `npm run check:conflicts`.
- `npm run build`.
- Kiểm tra desktop và 390×844 / 430×932.