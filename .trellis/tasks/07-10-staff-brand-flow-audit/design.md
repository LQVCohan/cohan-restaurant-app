# Thiết kế sửa luồng

## Luồng chuẩn

`CreateUserInput / AdminUpdateUserInput` → `staff/index.js` domain wrapper → `staff/mutation.js` persistence → `BrandMembership` / role assignment service → `useStaffManagement` → modal và action trang nhân viên.

## Quyết định

- Giữ `staff/mutation.js` là lớp persistence hiện có; không vá trực tiếp file lớn nếu domain wrapper có thể điều phối đúng bằng service sẵn có.
- `staff/index.js` là nơi xác nhận ngữ cảnh brand/restaurant và điều phối role. Wrapper sẽ dùng `requireRestaurantPermission(..., "staff.write")` và `assertAssignableStaffRole` thay cho điều kiện role hệ thống cứng.
- Khi tạo, không truyền `roleId` vào resolver lõi. Tạo tài khoản generic staff, tạo BrandMembership, sau đó gán role bằng `assignStaffRoleWithinRestaurant`; rollback cả hai bản ghi nếu bước đồng bộ thất bại.
- Khi sửa, wrapper kiểm tra quyền theo restaurant của nhân viên, validate role rồi chuyển thành trường `role` nội bộ để resolver lõi lưu trong cùng lần cập nhật. `baseSalary` không đổi sẽ bị loại khỏi input để không kích hoạt guard lương.
- `emergencyContact` được merge với dữ liệu hiện có để bảo toàn `relation`.
- Schema chỉ bổ sung các field mà UI hiện đang gửi; không mở lại field scope cũ.
