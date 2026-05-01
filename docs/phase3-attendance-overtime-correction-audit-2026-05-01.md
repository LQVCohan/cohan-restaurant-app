# Phase 3 Audit (2026-05-01): Timesheet / Overtime / Attendance Correction

## A. Hiện trạng đã có

### 1) Timesheet / chấm công
- Model `Timesheet` đã có các field cần thiết: `shiftId`, `plannedStartTime`, `plannedEndTime`, `actualCheckInAt`, `actualCheckOutAt`, `latenessMinutes`, `earlyLeaveMinutes`, `workedMinutes`, `overtimeMinutes`, `approvedOvertimeMinutes`, `isOffSchedule`, `approved`, `status`. Status enum có đủ nhóm scheduled + unscheduled (không có `unscheduled_absent` trong enum). 
- Check-in/check-out đang chạy qua mutation `upsertStaffAttendance` trong `graphql/resolvers/staff/mutation.js`.
- Luồng check-in tự tìm shift theo ngày; nếu có shift thì tạo/cập nhật timesheet theo `shiftId`, nếu không có shift thì tạo/cập nhật bản ghi `isOffSchedule: true`.
- Có chặn chỉnh công khi payroll locked/paid qua `assertNoLockedPayrollPeriodOverlap(... action: "attendance")`.
- Có giới hạn trùng bản ghi bằng index unique:
  - unique `(employeeId, workDate, shiftId)` khi có shiftId.
  - unique `(employeeId, workDate, isOffSchedule)` khi `isOffSchedule: true`.

### 2) Off-schedule check-in
- Hệ thống **đang cho phép** check-in khi không có shift (tạo timesheet off-schedule).
- Record off-schedule khởi tạo với `approved: false`.
- Status mapping/query layer đang dùng `unscheduled_absent` khi chưa check-in, `unscheduled_checkin` khi đang mở ca, `unscheduled_completed` khi checkout xong.
- Chưa thấy query/filter chuyên biệt “off-schedule chờ duyệt”; hiện tại chỉ lọc qua trường `isOffSchedule`/status trong client-side hoặc filter tổng quát.

### 3) AttendanceCorrectionRequest / sửa chấm công
- Model có đầy đủ: requested/original check-in/out, metrics snapshot, status workflow (`pending`, `approved`, `rejected`, `cancelled`, `applied`), auditLogs.
- Service có đủ hàm: list/get/create/approve/reject/cancel; approve sẽ apply luôn vào Timesheet rồi chuyển sang `applied`.
- Có validate thời gian requested (check-out > check-in), chặn duplicate pending cùng ngày (và timesheet nếu truyền timesheetId), chặn khi payroll locked.
- Staff chỉ tạo cho chính mình; staff chỉ hủy pending của chính mình. Reviewer role: admin/manager/hr.
- Có EventLog + auditLogs khi create/approve/apply/reject/cancel.

### 4) OvertimeRequest / tăng ca
- Model + service tương đối đầy đủ workflow: create, employee confirm (nếu required), approve, reject, cancel, complete.
- Staff được tự tạo request cho chính mình; reviewer (admin/manager/hr) duyệt.
- Có `plannedOvertimeMinutes`, `actualOvertimeMinutes`, `approvedOvertimeMinutes`, liên kết `timesheetId`/`shiftId`/`workDate`.
- Khi `complete`, service cập nhật `Timesheet.approvedOvertimeMinutes`, `overtimeApprovalStatus=approved`, liên kết `overtimeRequestId`.
- Có chặn payroll locked cho create/approve/complete.
- Có auditLogs + EventLog.

### 5) Payroll integration
- `payrollValidation.service` đã block kỳ lương nếu còn:
  - overtime request pending/approved nhưng chưa complete.
  - timesheet có overtimeMinutes > 0 nhưng chưa approved overtime.
  - attendance correction pending.
- `payrollRuntime.service` có aggregate timesheet để tính giờ công/overtime, nhưng đang có logic không đồng nhất giữa overtime weekday và weekend:
  - weekday dùng `approvedOvertimeMinutes`.
  - weekend đang dùng `overtimeMinutes` raw.

### 6) Performance / incident integration
- Có service staff performance đọc timesheet aggregate (late/early/absence), nhưng chưa thấy workflow event chuẩn kiểu ScheduleIncident/PerformanceEvent riêng cho attendance correction/overtime.
- Chưa thấy mutation attendance/overtime trực tiếp trừ điểm performance (điểm cộng vì đang tách tương đối).

### 7) Test hiện có
- Có test về payroll period setup, scheduling permission, availability/shift acknowledgement regression.
- Chưa thấy bộ test chuyên sâu riêng cho:
  - upsertStaffAttendance off-schedule + scope/permission,
  - attendanceCorrection workflow end-to-end,
  - overtime workflow end-to-end,
  - payroll runtime rule “chỉ approved overtime mới tính lương”.

## B. Vấn đề/rủi ro đang thấy

1. **Mismatch status enum**: `deriveAttendanceStatus` và resolver mapping có thể trả `unscheduled_absent`, nhưng `Timesheet.status` enum không chứa giá trị này.
2. **Mutation check-in chưa guard theo actor**: `upsertStaffAttendance` nhận `employeeId`, `restaurantId` trực tiếp, nhưng không kiểm tra actor có quyền thao tác user đó hay không (rủi ro staff chấm công hộ).
3. **Restaurant scope chưa chặt trong correction/overtime list/get**: quyền xem dựa role, nhưng chưa bắt buộc actor phải thuộc restaurant tương ứng trước khi đọc toàn bộ dữ liệu.
4. **Off-schedule payroll gating chưa explicit trong runtime**: tuy validation có cảnh báo/block, runtime aggregate chưa lọc rõ `isOffSchedule && approved=false`.
5. **Overtime payroll inconsistency**: overtime weekend vẫn lấy `overtimeMinutes` raw thay vì approved minutes.
6. **Correction apply tự động khi approve**: chưa có bước “approve nhưng chưa apply” độc lập (nếu nghiệp vụ sau này cần kiểm soát tách bước).
7. **Thiếu phân loại lý do off-schedule**: chưa phân biệt rõ “được gọi hỗ trợ” vs “tự ý đi làm”; chỉ có note text.

## C. Thiếu nghiệp vụ so với yêu cầu đã chốt

- Thiếu policy/permission-level gate rõ ràng cho HR review theo “manager bật quyền hoặc phân công” (hiện là role-based cứng).
- Thiếu read-only enforcement rõ cho Accountant ở mutation layer attendance/overtime/correction (service đã không cho review, nhưng cần test/guard đồng nhất ở resolver).
- Thiếu queue/query chuẩn cho off-schedule pending approval.
- Thiếu cờ approve chuyên biệt cho off-schedule payroll eligibility (đang dùng `approved` chung, nhưng chưa được runtime dùng nhất quán).
- Thiếu đảm bảo runtime payroll chỉ dùng approved overtime cho mọi loại ngày.

## D. Đề xuất thứ tự PR tiếp theo

1. **PR1 (Guard + Scope hardening, low risk)**
   - Thêm authorization guard cho `upsertStaffAttendance` (self-only cho staff, manager/admin trong scope restaurant).
   - Bổ sung restaurant-scope checks cho correction/overtime list/get/approve/reject/cancel/complete.
2. **PR2 (Payroll correctness, medium risk)**
   - Chuẩn hóa runtime overtime chỉ dùng approved minutes (weekday/weekend/holiday policy nhất quán).
   - Bỏ qua off-schedule chưa approved ở runtime (hoặc block cứng từ validation + filter runtime).
3. **PR3 (Off-schedule workflow visibility)**
   - Query/filter riêng off-schedule pending approval, thêm reason category.
4. **PR4 (Correction workflow polish)**
   - (Nếu cần) tách approve vs apply, thêm idempotency guard mạnh hơn cho apply.
5. **PR5 (Integration hooks cho performance/incident)**
   - Chỉ thêm event contract, chưa trừ điểm trực tiếp.

## E. Danh sách file cần sửa theo từng PR

- PR1:
  - `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`
  - `cohan-restaurant-backend/src/services/attendance/attendanceCorrectionWorkflow.service.js`
  - `cohan-restaurant-backend/src/services/overtime/overtimeRequest.service.js`
- PR2:
  - `cohan-restaurant-backend/src/services/payroll/payrollRuntime.service.js`
  - `cohan-restaurant-backend/src/services/payroll/payrollValidation.service.js`
- PR3:
  - `cohan-restaurant-backend/graphql/schema/user.graphql`
  - `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
  - `cohan-restaurant-backend/src/hooks/useAttendanceManagement.js` (nếu cần hiển thị FE)
- PR4:
  - `cohan-restaurant-backend/src/services/attendance/attendanceCorrectionWorkflow.service.js`
  - `cohan-restaurant-backend/models/attendanceCorrectionRequest.model.js` (chỉ nếu cần thêm field trạng thái apply tách biệt)
- PR5:
  - `cohan-restaurant-backend/src/services/staffPerformance/staffPerformance.service.js`
  - service/event-log liên quan

## F. Test regression cần thêm cho Phase 3

1. **Timesheet attendance tests**
   - staff chỉ check-in/out cho chính mình.
   - manager/admin check-in/out trong restaurant scope.
   - không check-in/out khi payroll locked.
   - off-schedule check-in tạo `isOffSchedule=true`, `approved=false`.
2. **Correction workflow tests**
   - create/approve/reject/cancel/apply đầy đủ nhánh.
   - rejected không đổi timesheet.
   - pending duplicate bị chặn.
   - payroll locked chặn create/approve.
3. **Overtime workflow tests**
   - staff create self request.
   - reviewer approve/reject/cancel/complete.
   - complete cập nhật approvedOvertimeMinutes vào timesheet.
   - overtime pending/approved chưa complete bị payroll validation block.
4. **Payroll runtime tests**
   - chỉ approved overtime được cộng lương.
   - off-schedule chưa approved không vào payroll.
5. **Permission tests**
   - HR policy-based review (khi có permission bật/tắt).
   - accountant read-only (mọi mutation bị từ chối).
