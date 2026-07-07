# Chuẩn hóa tiếng Việt trang chấm công

## Hiện trạng

Trang chấm công đang dùng lẫn tiếng Việt và thuật ngữ tiếng Anh như `No-show`, `check-in`, `check-out`, `review`, `Timesheet`, `overtime`, `payroll`. Một số cụm cũng chưa thống nhất, ví dụ cùng một trạng thái được gọi là “Vắng lịch”, “No-show / Vắng lịch” hoặc “scheduled_absent”.

## Luồng thực tế

`StaffManagement.jsx` mở `AttendancePage.jsx` -> `useAttendanceManagement` cung cấp dữ liệu -> `AttendancePage.jsx` hiển thị bảng công, đối chiếu và chỉnh công -> `OvertimePanel.jsx` hiển thị tăng ca. `attendanceReconciliationUtils.js` tạo nhãn cảnh báo; `attendanceCorrectionUtils.js` tạo thông báo kiểm tra biểu mẫu.

Không thay đổi schema, resolver, hook, biến trạng thái, giá trị enum hoặc payload mutation. Chỉ thay nội dung hiển thị cho người dùng.

## File sửa

- `AttendancePage.jsx`: chuẩn hóa toàn bộ câu chữ của bảng công và chỉnh công.
- `OvertimePanel.jsx`: Việt hóa câu chữ tăng ca.
- `attendanceReconciliationUtils.js`: thống nhất nhãn đối chiếu.
- `attendanceCorrectionUtils.js`: Việt hóa thông báo kiểm tra giờ.
- Test liên quan: cập nhật và bổ sung kiểm tra câu chữ.

## Quy ước từ ngữ

- `check-in` -> `giờ vào` hoặc `vào ca` tùy ngữ cảnh.
- `check-out` -> `giờ ra` hoặc `tan ca` tùy ngữ cảnh.
- `No-show / Vắng lịch` -> `Vắng ca`.
- `missed checkout` -> `Quên tan ca`.
- `off schedule` -> `Làm ngoài lịch`.
- `review` -> `duyệt` hoặc `xử lý`.
- `Timesheet` -> `bảng công`.
- `overtime` -> `tăng ca`.
- `payroll` -> `bảng lương`.

## Tiêu chí nghiệm thu

- Các khu vực Bảng chấm công, Yêu cầu chỉnh công và Tăng ca dùng tiếng Việt tự nhiên, nhất quán.
- Không còn thuật ngữ tiếng Anh hiển thị trực tiếp, trừ `Excel` và các giá trị kỹ thuật không hiển thị.
- Nhãn ngắn, không làm thay đổi bố cục hoặc hành vi.
- Enum, bộ lọc, quyền, mutation và dữ liệu giữ nguyên.
- Test mục tiêu chạy thành công.

## Kiểm tra

- `npx vitest run src/components/Dashboard_Manager/Staff/components/Attendance/AttendancePage.test.jsx src/components/Dashboard_Manager/Staff/components/Attendance/attendanceReconciliationUtils.test.js src/components/Dashboard_Manager/Staff/components/Attendance/attendanceCorrectionUtils.test.js`
- `npm run build`

## Ngoài phạm vi

- Thay đổi cách tính công, điểm đối chiếu hoặc tăng ca.
- Thay đổi quyền duyệt, trạng thái nghiệp vụ hoặc API.
- Thiết kế lại giao diện.
