# Nâng cấp modal thêm ca và cài đặt ca

## Hiện trạng

- `AddShiftModal` dùng modal mặc định cỡ trung bình nhưng CSS hai cột dựa vào viewport, làm bố cục bị ép trên màn hình desktop.
- Thông tin ca, cảnh báo nhân sự, vị trí bắt buộc và danh sách nhân viên chưa có thứ tự ưu tiên rõ.
- Hai lớp `add-shift-modal-polish.css` và `add-shift-modal-fixes.css` đang ghi đè trùng nhau.
- `ShiftRulesModal` dùng nhiều thuật ngữ kỹ thuật và emoji, tab/các khối cài đặt chiếm nhiều chiều cao nhưng chưa giúp người quản lý hiểu ảnh hưởng của thiết lập.
- Component SCSS và stylesheet nạp cuối đang chồng nhiều quy tắc màu tím không còn khớp hệ sage của trang quản lý.

## Luồng thực tế

### Thêm ca

`Shift schema/model -> createStaffShift resolver + assignment validation/lifecycle guard -> CREATE_STAFF_SHIFT/CREATE_STAFF_SHIFTS -> ScheduleManagement.handleConfirmAddShift -> AddShiftModal`.

### Cài đặt ca

`SchedulingPolicy model -> schedulingPolicy service/resolver -> useSchedulingPolicy -> ScheduleManagement.handleApplyShiftRules -> ShiftRulesModal -> updateSchedulingPolicy mutation`.

Không có drift dữ liệu cần sửa trong task này.

## Hướng thiết kế

**Modal vận hành gọn, dùng nền sage sáng, thông tin quan trọng luôn nhìn thấy và wording thuần Việt.**

- Modal thêm ca rộng đúng với bố cục hai cột trên desktop; một cột trên tablet/mobile.
- Tóm tắt ca và mức độ đủ nhân sự đặt cùng vùng đầu modal.
- Vị trí bắt buộc là vùng thiết lập bên trái; danh sách nhân viên là vùng thao tác chính bên phải.
- Bỏ emoji khỏi lựa chọn vị trí, dùng trạng thái khóa/chọn bằng icon Lucide và chữ.
- Modal cài đặt dùng kích thước lớn, header có mô tả và nút đóng, tab rõ ràng/sticky.
- Hiển thị thời lượng từng ca và thay từ kỹ thuật bằng tiếng Việt dễ hiểu.
- Giữ footer hành động luôn nhìn thấy và giữ nguyên payload lưu.

## File thay đổi

- `src/components/Dashboard_Manager/Schedule/components/AddShiftModal.jsx`
- `src/components/Dashboard_Manager/Schedule/components/ShiftRulesModal.jsx`
- `src/styles/add-shift-modal-polish.css`
- `src/styles/add-shift-modal-fixes.css` — xóa sau khi hợp nhất.
- `src/styles/schedule-rules-modal-polish.css`
- `src/styles/schedule-polish.css`
- Test component liên quan.

## Ngoài phạm vi

- Không đổi GraphQL schema, resolver, service hoặc MongoDB model.
- Không thay đổi quy tắc chọn nhân viên, bắt buộc vị trí, availability, lifecycle hay quyền.
- Không thêm dependency hoặc component framework.

## Tiêu chí chấp nhận

- Modal thêm ca không còn hai cột bị ép trong khung 640px.
- Danh sách nhân viên có vùng xem rộng, tìm kiếm và bộ lọc dễ thao tác.
- Các nhãn vị trí không bị cắt vô lý và không dùng emoji làm icon giao diện.
- Modal cài đặt ca hiển thị giờ và thời lượng rõ; không lộ các từ `SchedulingPolicy`, `workingDays`, `rule`, `override` cho người dùng.
- Hai modal dùng cùng hệ màu sage của trang lịch và cuộn đúng trên desktop/mobile.
- Nút đóng, hủy và lưu/tạo luôn hoạt động như trước; payload không thay đổi.
