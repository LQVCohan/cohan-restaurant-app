# Kế hoạch triển khai

1. Import calculator chấm công hiện có vào staff mutation resolver.
2. Thay hai block tính thủ công ở `checkShiftAttendanceAction` và `upsertStaffAttendance` bằng calculator + status derivation.
3. Bổ sung regression assertion cho metrics/status giữa check-in và check-out.
4. Tính `overtimeNightExtra` từ `overtimeNightHours` và policy 20%, cộng vào `overtimeTotal`.
5. Bổ sung test calculator cho OT ban đêm.
6. Chuẩn hóa hoàn tất overtime request: không vượt actual, lưu đúng note/reviewer/time và bổ sung test.
7. Đổi quick-action icon staff sang `Fingerprint`, kiểm tra accessible name trong component test.
8. Fetch lại các file đã sửa, kiểm tra diff theo dòng và ghi rõ các test/build không thể chạy qua GitHub connector.
