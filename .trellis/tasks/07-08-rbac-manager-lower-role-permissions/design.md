# Thiết kế

## Luồng đã trace

1. `Role` chứa `permissions`, `parentRole`, `isSystem`; role không có restaurant scope.
2. `RoleMutation.createRole/updateRole` gọi `requirePermission(role.write)` rồi kiểm tra parent role và permission Manager được phép gán.
3. `useRbacManagement` gọi `role`, `parentRoles`, `permissions`, `createRole`, `updateRole` và `assignStaffRole`.
4. `ManagerLayout` và `RbacManagement` cho phép mở trang bằng quyền đọc/gán nhân viên.
5. `RoleManagement` quyết định form chỉ xem bằng `canWriteRoles` và trạng thái protected/system.

## Root cause

Frontend và backend không cùng một contract quyền cho Manager. Backend request thật có Role/ParentRole đã populate, còn frontend user chỉ có `roleName`; legacy frontend map thiếu `role.write`. Ngoài ra backend chỉ kiểm tra parent role protected, chưa diễn đạt rõ rằng Manager chỉ được quản lý role thuộc nhánh `staff`.

## Thay đổi tối thiểu

- Thêm `role.write` vào legacy Manager map ở frontend/backend; không thêm `permission.write`.
- Giữ whitelist permission Manager và bổ sung đúng các permission vận hành đang có trong role nhân viên seed.
- Non-admin chỉ được tạo/sửa role có parent role `staff`.
- UI dùng `isAdminRole/isManagerRole` và `parentRole.slug` để khóa form đúng như backend.
- Danh sách parent role của Manager chỉ hiển thị `staff`.
- Danh sách role có thể gán cho nhân viên chỉ gồm role thuộc nhánh `staff` và không thuộc nhóm protected.

## Không thay đổi

- Role hệ thống vẫn khóa.
- Audit log, GraphQL input/output và restaurant scope của thao tác gán nhân viên giữ nguyên.
- Không thêm model, dependency hoặc abstraction mới.
