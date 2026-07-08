# Kế hoạch triển khai

## File sẽ sửa và lý do

- `authorization.service.js`: đồng bộ quyền `role.write` cho Manager và whitelist permission role nhân viên.
- `role/mutation.js`: bắt buộc non-admin chỉ tạo/sửa role thuộc nhánh `staff`.
- `staffRoleAssignment.service.js`: không cho gán role ngoài nhánh `staff` cho Staff.
- `frontendPermissionAccess.js`: đồng bộ khả năng ghi RBAC của Manager với backend.
- `RbacManagement.jsx`: khóa/mở form, parent role và role gán theo actor + parent role thực tế.
- Các test tương ứng: khóa contract truy cập và chống vượt quyền.

## Trình tự

1. Fetch lại file mới nhất trên branch.
2. Sửa shared permission contract backend/frontend.
3. Sửa guard mutation/service.
4. Sửa UI affordance theo cùng policy.
5. Cập nhật focused tests.
6. Chạy kiểm tra hẹp rồi GraphQL/build nếu môi trường cho phép.
7. Review diff cho permission gap, scope drift và logic trùng.
