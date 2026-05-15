# RBAC & Permission Final Report

## Mô hình dữ liệu
- **User**: tài khoản đăng nhập, có thể là admin/manager/staff/customer tùy ngữ cảnh.
- **Role**: vai trò nghiệp vụ trong RBAC, gắn cho nhân sự và đại diện tập quyền.
- **ParentRole**: quan hệ kế thừa giữa role để tái sử dụng nhóm quyền.
- **Permission**: quyền hạt mịn theo module và action (ví dụ `menu.read`, `order.update`).
- **directPermissions**: quyền được gán trực tiếp vào role.
- **inherited permissions**: quyền kế thừa từ cây `ParentRole`.
- **effective permissions**: tập quyền hiệu lực cuối cùng khi hợp nhất direct + inherited.

## Luồng phân quyền
- **Admin** quản trị toàn hệ thống và xử lý nghiệp vụ liên nhà hàng.
- **Manager** quản trị phạm vi nhà hàng được phân công, bao gồm phân quyền nhân viên theo scope.
- **Staff** chỉ thao tác theo quyền được cấp từ role.
- **Customer/Public** không sử dụng nhóm quyền quản trị nội bộ.

## Backend guard
Hệ thống backend đang enforce qua các guard chính:
- `requirePermission`: kiểm tra một quyền cụ thể cho tác vụ hệ thống.
- `requireAnyPermission`: cho phép qua nếu người dùng có ít nhất một quyền trong danh sách.
- `requireRestaurantAccess`: đảm bảo user có quyền truy cập nhà hàng mục tiêu (scope).
- `requireRestaurantPermission`: kết hợp scope nhà hàng + permission theo module/action.

## Permission matrix
| Module | Quyền read | Quyền write / thao tác |
|---|---|---|
| Menu | `menu.read` | `menu.write` |
| Order | `order.read` | `order.create`, `order.update`, `order.cancel` |
| Payment | `payment.read` | `payment.write` |
| Inventory | `inventory.read` | `inventory.write` |
| Stock | `stock.read` | `stock.write` |
| Promotion | `promotion.read` | `promotion.write` |
| Coupon | `coupon.read` | `coupon.write` |
| Table | `table.read` | `table.write` |
| Role | `role.read` | `role.write` |
| Permission | `permission.read` | `permission.write` |
| Staff | `staff.read` | `staff.write` |

## Frontend permission-aware UX
- Sidebar lọc module theo quyền hiệu lực của user.
- Page-level guard: chặn truy cập màn quản trị nếu thiếu quyền cần thiết.
- Button-level guard: action mutate quan trọng dùng helper `hasPermission`/`hasAnyPermission`.
- Khi thiếu quyền, UI ưu tiên ẩn/disable nút kèm thông báo: **“Bạn không có quyền thực hiện thao tác này.”**

## Audit log
- Ghi log các sự kiện RBAC quan trọng: tạo/cập nhật role, gán role cho staff, cập nhật permission liên quan.
- Query `rbacAuditLogs` được bảo vệ bằng permission và restaurant scope.
- Frontend có tab **“Nhật ký phân quyền”** để tra cứu sự kiện.
- Quyền xem audit log không mở cho customer/public; staff chỉ xem khi có quyền phù hợp.

## Demo script
Checklist demo đồ án:
1. Admin tạo role mới.
2. Admin gán permission cho role.
3. Manager gán role cho nhân viên trong nhà hàng.
4. Staff đăng nhập và chỉ thấy đúng chức năng được cấp.
5. Staff thử thao tác thiếu quyền và bị chặn.
6. Admin mở tab “Nhật ký phân quyền” để xác nhận audit trail.

## Đánh giá hoàn thiện
Hệ thống RBAC/Permission đạt mức hoàn thiện cao cho đồ án:
- Backend enforce guard thật ở resolver/service (không phụ thuộc frontend).
- Frontend đóng vai trò hỗ trợ UX và minh bạch trạng thái quyền.
- Audit log đảm bảo truy vết các thay đổi phân quyền quan trọng.
