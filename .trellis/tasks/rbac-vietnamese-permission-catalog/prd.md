# PRD — Chuẩn hóa tiếng Việt và kiểm tra danh mục quyền RBAC

## Hiện trạng

- `RbacManagement.jsx` hiển thị trực tiếp `permission.name` và một bảng tên nhóm chưa đầy đủ nên các giá trị như `ai-chatbot`, `customer`, `cleaning` và tên quyền có từ tiếng Anh xuất hiện trên giao diện.
- `rbacVietnameseLabels.js` có mapping nhưng không có caller trong repository, vì vậy không tác động tới trang RBAC.
- `seedPermissions.js` còn wording pha trộn Anh–Việt như role, permission, dashboard, AI chatbot, analytics, handoff, menu và review.
- Người dùng cần xác nhận bảng lựa chọn không làm rơi quyền hợp lệ.

## Luồng thật

`Permission model` → `permissions` GraphQL query → `useRbacManagement.permissions` → `permissionsByGroup` → danh mục/checkbox trong `RbacManagement` → `createRole/updateRole` → `assertManagerAssignablePermissionCodes` và audit log.

## Kết luận kiểm tra danh mục

- Query `permissions` không phân trang và hiện trả toàn bộ bản ghi Permission trong database.
- Hook không lọc bỏ nhóm hoặc quyền trước khi dựng bảng.
- Seed hiện bao phủ các mã quyền RBAC được dùng bởi `PERMISSIONS`, các màn hình manager và resolver RBAC.
- Các action `payroll.*` chi tiết thuộc cơ chế phân quyền riêng theo vai trò của module lương, chưa được thêm vào bảng RBAC để tránh lựa chọn không có hiệu lực ở backend.

## Phạm vi

1. Chuẩn hóa tên nhóm, tên quyền, tên vai trò và mã quyền hiển thị bằng bộ formatter dùng chung.
2. Kích hoạt formatter cho trang RBAC bằng entrypoint hiện có.
3. Chuẩn hóa tên/mô tả trong seed để dữ liệu mới cũng nhất quán.
4. Thêm test bảo vệ các nhóm và quyền dễ bị hiển thị tiếng Anh.

## Tiêu chí nghiệm thu

- Không còn tiêu đề nhóm `ai-chatbot`, `customer`, `cleaning`, `finance`, `print`, `admin-security` trên UI.
- Không còn wording `role`, `permission`, `dashboard`, `analytics`, `handoff`, `menu`, `review` trong tên quyền người dùng nhìn thấy.
- Mã kỹ thuật vẫn hiển thị dưới dạng `Mã quyền: <code>` để quản trị viên đối chiếu.
- Số quyền hiển thị giữ nguyên so với payload GraphQL.
- Không thay đổi quyền hạn, scope nhà hàng, whitelist gán quyền, audit log hoặc mutation contract.

## Ngoài phạm vi

- Không chuyển module payroll từ role-based authorization sang generic RBAC.
- Không thêm quyền mới không được backend thực thi.
- Không đổi schema GraphQL hoặc cấu trúc database.
