# Triển khai đã thực hiện

1. Đặt shared attendance calculator tại `TimesheetSchema.pre("save")` để mọi đường ghi Timesheet đều chuẩn hóa metrics/status trước khi lưu.
2. Bổ sung status `unscheduled_absent` đúng với output của `deriveAttendanceStatus`.
3. Giữ state tăng ca chạy sau calculator để thay đổi `overtimeMinutes` có thể hủy approval cũ đúng quy trình.
4. Thêm invariant không cho `approvedOvertimeMinutes` vượt `overtimeMinutes`; correction thay đổi actual OT vẫn được đưa về pending thay vì lỗi.
5. Thêm virtual tương thích `overtimeApprovalNote` để ghi chú từ workflow request được lưu vào `overtimeReviewNote`.
6. Tính `overtimeNightExtra` từ `overtimeNightHours` và policy 20%, cộng vào `overtimeTotal` và breakdown.
7. Đổi quick-action icon staff sang `Fingerprint`, giữ accessible link name.
8. Bổ sung test cho calculator chấm công, state tăng ca, model invariants, premium OT ban đêm và icon dashboard.
9. Fetch lại file sau cập nhật; Vitest/build/browser smoke chưa chạy vì GitHub connector không có executable checkout.
