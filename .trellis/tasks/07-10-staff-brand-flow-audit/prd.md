# Kiểm tra toàn bộ luồng nhân viên theo Brand

## Mục tiêu

Đảm bảo modal thêm nhân viên và trang quản lý nhân viên dùng đúng phạm vi BrandMembership, không gửi input GraphQL sai schema và không chặn nhầm Brand Manager khi thực hiện nghiệp vụ `staff.write`.

## Root cause đã xác định

1. Modal thêm nhân viên gửi đúng `staffBusinessContext`, resolver cũng xác thực nhà hàng thuộc brand và tạo BrandMembership; tuy nhiên resolver lõi yêu cầu role hệ thống `ADMIN` khi input có `roleId`. Modal luôn gửi `roleId`, vì vậy Brand Manager có `staff.write` vẫn bị từ chối.
2. Modal sửa nhân viên gửi các trường nhân sự như `department`, `positionTitle`, `employmentType`, `employmentStatus`, `shiftType`, `dateJoined`, `baseSalary`, `noteInternal`, `emergencyContact`; `AdminUpdateUserInput` chưa khai báo các trường này nên request có thể lỗi trước khi vào resolver.
3. Modal sửa luôn gửi lại `baseSalary`; resolver lõi chỉ cho Admin thay đổi lương, vì vậy một chỉnh sửa không liên quan của Manager vẫn có thể bị chặn dù lương không đổi.
4. Payload liên hệ khẩn cấp không chứa `relation`, có nguy cơ ghi đè mất quan hệ hiện có.

## Tiêu chí nghiệm thu

- Chỉ nhà hàng thuộc brand đang hoạt động mới được chọn khi tạo nhân viên.
- Tạo nhân viên luôn tạo đồng bộ BrandMembership; lỗi gán vai trò phải rollback cả tài khoản và membership mới.
- Brand Manager/HR có quyền `staff.write` được tạo và đổi vai trò nhân viên thuộc nhánh staff, không được gán role hệ thống hoặc role ngoài nhánh staff.
- Mutation sửa nhân viên khớp schema với payload thực tế.
- Lương không đổi không kích hoạt guard Admin-only; thay đổi lương vẫn giữ giới hạn quyền hiện tại.
- Liên hệ khẩn cấp hiện có không mất trường `relation` khi cập nhật trường khác.
- Có test hồi quy cho contract GraphQL và resolver wrapper.

## Ngoài phạm vi

- Không đổi cấu trúc BrandMembership.
- Không đưa `restaurantForStaff` hoặc `refRestaurantIds` trở lại.
- Không mở rộng quyền chỉnh lương cho Manager.
- Không redesign toàn bộ trang nhân viên.
