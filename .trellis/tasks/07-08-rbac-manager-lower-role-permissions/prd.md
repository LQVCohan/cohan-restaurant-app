# Cho Admin và Manager chỉnh quyền vai trò cấp dưới

## Hiện trạng

- Route `/manager#rbac` cho phép người có `role.read`, `permission.read` hoặc `staff.write` truy cập, nên Admin và Manager đều xem được trang.
- `AuthProvider` chỉ đưa `roleName` vào user frontend; helper quyền frontend phải dùng legacy permission map.
- Legacy map của Manager có quyền đọc RBAC nhưng không có `role.write`, vì vậy trang hiển thị Manager ở chế độ chỉ xem dù backend request thật đã nạp Role/ParentRole đầy đủ.
- Backend cho phép mutation khi có `role.write`, nhưng whitelist của Manager thiếu một số quyền đang tồn tại trên các role nhân viên được seed (`table.write`, `staff.read`, `reservation.read`, `reservation.update`). Vì vậy Manager có thể bị từ chối khi lưu lại một role cấp dưới mà không hề tăng quyền.
- Role là danh mục dùng chung toàn hệ thống, không có `restaurantId`. Vì vậy không được mở cho Manager sửa các role hệ thống hoặc role không thuộc nhánh nhân viên.

## Phạm vi quyền an toàn

- Admin: xem trang, tạo/sửa các role tùy chỉnh; role hệ thống vẫn chỉ xem để tránh phá cấu trúc seed và quyền kế thừa.
- Manager: xem trang, tạo/sửa role tùy chỉnh có `parentRole.slug = staff`, và chỉ gán các permission nằm trong whitelist vận hành nhân viên.
- Manager không được sửa role hệ thống, role Admin/Manager/HR/Accountant/Customer hoặc role tùy chỉnh kế thừa ngoài nhánh `staff`.
- Gán role cho nhân viên cũng chỉ nhận role thuộc nhánh `staff`.
- HR, Accountant và Staff không được mở quyền ghi RBAC.

## Tiêu chí nghiệm thu

1. Admin và Manager đều truy cập được trang RBAC.
2. Manager thấy nút tạo/sửa role khả dụng với role tùy chỉnh thuộc nhánh `staff`.
3. Manager không sửa được role hệ thống hoặc role tùy chỉnh không thuộc nhánh `staff`.
4. Manager lưu được các role nhân viên seed hiện tại mà không bị whitelist từ chối vì `table.write`, `staff.read`, `reservation.read` hoặc `reservation.update`.
5. Backend vẫn là nguồn xác thực cuối cùng; request trực tiếp không thể vượt qua giới hạn parent role hoặc permission whitelist.
6. Admin không bị giảm quyền hiện có.
7. Không đổi schema GraphQL hoặc cấu trúc database.

## Ngoài phạm vi

- Không biến Role thành dữ liệu riêng theo từng nhà hàng.
- Không cho Manager chỉnh ParentRole hoặc role hệ thống.
- Không thêm quyền `permission.write` cho Manager.
- Không thay đổi cơ chế audit log hiện có.
