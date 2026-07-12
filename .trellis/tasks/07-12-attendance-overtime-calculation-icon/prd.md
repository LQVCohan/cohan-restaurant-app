# Chuẩn hóa tính chấm công, tăng ca và icon staff

## Hiện trạng

- Hai mutation chấm công (`checkInShift/checkOutShift` và `upsertStaffAttendance`) tự lặp công thức phút làm, đi muộn, về sớm và tăng ca thay vì dùng `attendanceCalculation.service.js`.
- Đường `upsertStaffAttendance` không lưu lại `status` đã suy ra, còn đường chấm công theo ca có công thức riêng nên các lần chỉnh công có thể cho kết quả khác.
- Payroll đã có policy `overtimeAtNightExtra = 0.2` nhưng `computeOvertimeComponents` đang trả `overtimeNightExtra: 0` và không cộng khoản này vào tổng tăng ca.
- Hoàn tất yêu cầu tăng ca ghi chú vào field không tồn tại `overtimeApprovalNote`; đồng thời nhánh duyệt cao hơn thời gian thực tế mâu thuẫn với overtime state pre-save và luồng duyệt Timesheet trực tiếp.
- Icon hành động chấm công trên dashboard staff đang dùng `Clock3`, trùng ý nghĩa lịch/ca và chưa thể hiện rõ thao tác xác thực chấm công.

## Luồng thực tế

`Shift + SchedulePublication -> checkInShift/checkOutShift hoặc upsertStaffAttendance -> Timesheet -> attendance overtime approval / OvertimeRequest completion -> payrollRuntime approvedOvertimeMinutes -> payrollCalculator -> staff payroll UI`.

Frontend staff:

`StaffDashboardPage quick action -> /staff/attendance`, còn check-in/check-out thực tế nằm trong `StaffSchedulePage` và gọi mutation theo `shiftId`.

## Yêu cầu

1. Mọi đường ghi chấm công phải dùng chung công thức:
   - phút làm = check-out trừ check-in;
   - đi muộn = check-in sau giờ bắt đầu ca;
   - về sớm = check-out trước giờ kết thúc ca;
   - tăng ca thô = check-out sau giờ kết thúc ca;
   - trạng thái được suy ra từ giờ thực tế và việc có thuộc ca chính thức hay không.
2. Không cho khoảng làm việc âm hoặc vượt 24 giờ.
3. Chỉ phút tăng ca đã duyệt mới đi vào payroll.
4. Tăng ca ban đêm phải cộng đủ phụ trội theo policy hiện hành: tiền OT theo loại ngày + 30% làm đêm + 20% tăng ca ban đêm.
5. Khi hoàn tất yêu cầu tăng ca, phút trả không vượt phút thực tế; ghi đúng note/reviewer vào Timesheet.
6. Đổi icon chấm công trên staff dashboard sang icon vân tay từ `lucide-react`, không thêm dependency.

## Tiêu chí chấp nhận

- Hai mutation chấm công cho cùng timestamp/ca trả cùng metrics.
- Timesheet lưu đúng `status`, `workedMinutes`, `hours`, `latenessMinutes`, `earlyLeaveMinutes`, `overtimeMinutes`.
- Chỉnh công tiếp tục dùng cùng calculator và thay đổi overtime sẽ đưa trạng thái duyệt về pending theo state machine hiện có.
- Một giờ OT ban đêm với hourly rate 100.000đ có thêm 20.000đ phụ trội ban đêm ngoài các thành phần đã có.
- Không thể hoàn tất request với số phút trả lớn hơn số phút tăng ca thực tế.
- Note hoàn tất xuất hiện ở `overtimeReviewNote`, cùng reviewer/time.
- Quick action “Chấm công & chỉnh công” dùng icon vân tay và giữ accessible link name.

## Ngoài phạm vi

- Không thêm grace period đi muộn/về sớm vì repo hiện chưa có cấu hình nghiệp vụ này.
- Không tự trừ thời gian nghỉ giữa ca vì Timesheet/Shift hiện chưa có dữ liệu break.
- Không đổi hệ số ngày thường/cuối tuần/lễ hoặc giới hạn tăng ca theo role.
- Không thay đổi quyền hoặc trạng thái workflow tăng ca.
