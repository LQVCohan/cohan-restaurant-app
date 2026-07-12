# Thiết kế

## Quyết định chính

### Một calculator cho mọi đường ghi công

`calculateAttendanceMetrics` và `deriveAttendanceStatus` là nguồn sự thật duy nhất. Resolver chỉ chịu trách nhiệm xác thực quyền, chọn ca, gán timestamp và lưu kết quả.

Không tạo abstraction mới vì service hiện tại đã có đúng trách nhiệm và đang được luồng chỉnh công sử dụng.

### Công thức chấm công

- `workedMinutes = actualCheckOutAt - actualCheckInAt`, làm tròn theo phút.
- `hours = workedMinutes / 60`, hai chữ số thập phân.
- `latenessMinutes = max(actualCheckInAt - plannedStartTime, 0)`.
- `earlyLeaveMinutes = max(plannedEndTime - actualCheckOutAt, 0)`.
- `overtimeMinutes = max(actualCheckOutAt - plannedEndTime, 0)`.
- Không có grace period và không trừ break vì schema chưa cung cấp hai dữ liệu này.

### Tăng ca và payroll

`overtimeMinutes` là số phút thô. Payroll chỉ lấy `approvedOvertimeMinutes` khi `overtimeApprovalStatus = approved`.

Phân loại payroll:

- ngày thường: hệ số 1,5;
- cuối tuần: hệ số 2;
- ngày lễ: hệ số 3;
- giờ làm đêm: cộng 30%;
- phần OT trùng giờ đêm: cộng thêm 20% theo policy.

### Hoàn tất yêu cầu tăng ca

Request được duyệt trước chỉ là hạn mức dự kiến. Khi hoàn tất, số phút trả mặc định là `min(phút request đã duyệt, phút thực tế trên Timesheet)` và input thủ công cũng không được vượt phút thực tế. Timesheet lưu `overtimeReviewNote`, `overtimeReviewedBy`, `overtimeReviewedAt`.

### Icon staff

Dùng `Fingerprint` từ `lucide-react` cho quick action “Chấm công & chỉnh công”. Icon chỉ mang tính trang trí (`aria-hidden` đã có tại component dùng chung), tên truy cập vẫn do nội dung link cung cấp.
