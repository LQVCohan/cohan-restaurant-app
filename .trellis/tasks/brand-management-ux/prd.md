# Tối ưu trang quản lý chuỗi

## Hiện trạng và nguyên nhân gốc

- Khối “Đổi vai trò và phạm vi” cho phép chọn `staff`, dù thao tác quản lý nhân sự chi tiết đã có khu vực riêng. Đây là lựa chọn dễ gây hạ quyền nhầm từ Quản lý/Quản trị thành Nhân viên.
- Trang đang nạp đồng thời `BrandManagement.css`, `BrandManagementCompact.scss` và `BrandMembershipActions.css`. Hai lớp override sau ép toàn bộ biểu mẫu vào các hàng rất thấp và dùng `display: contents`, khiến màn hình desktop dày đặc, khó quét; responsive phải vá lặp lại ở nhiều breakpoint.
- Danh sách thành viên nằm sau các biểu mẫu quản trị nên người dùng phải đi qua nhiều control trước khi quan sát được trạng thái hiện tại.

## Luồng thật đã kiểm tra

`BrandMembership model (owner/admin/manager/staff)` → `brand.graphql UpdateBrandMemberInput` → `brand/index.js updateBrandMember` → `memberRoleConsistency` kiểm tra loại tài khoản và quyền Brand → mutation Apollo `UpdateBrandMemberAccess` → `BrandMembershipAccessForm` → select “Vai trò mới”.

Backend vẫn phải giữ `staff` để thêm nhân viên mới, đọc membership cũ và phục vụ các luồng nhân sự. Yêu cầu chỉ khóa `staff` làm vai trò đích trong bộ đổi quyền của trang Brand, không thay đổi schema hay resolver toàn hệ thống.

## Phạm vi

1. Select “Vai trò mới” chỉ cho phép `Quản trị chuỗi` và `Quản lý chi nhánh`.
2. Thành viên `staff` hiện có vẫn hiển thị và có thể được nâng lên manager/admin; biểu mẫu buộc chọn vai trò mới trước khi lưu.
3. Đưa danh sách thành viên lên trước các thao tác mời/đổi quyền để ưu tiên quan sát.
4. Chia khu thao tác thành các khối có tiêu đề, khoảng thở và hierarchy rõ ràng.
5. Hợp nhất style Brand về một stylesheet chính; xóa hai lớp override chồng chéo.
6. Giữ native control, focus rõ, touch target tối thiểu, trạng thái loading/error/empty và responsive.

## Tiêu chí nghiệm thu

- Không có lựa chọn “Nhân viên chi nhánh” trong select “Vai trò mới”.
- Chọn thành viên nhân viên hiện tại không tự hạ/nâng quyền; phải chọn manager/admin rồi mới lưu.
- Luồng thêm nhân viên mới vẫn giữ nguyên các vai trò và contract hiện tại.
- Thông tin chuỗi, chi nhánh, bộ lọc, danh sách thành viên và thao tác quyền có thứ tự đọc rõ.
- Desktop không còn một hàng biểu mẫu quá dày; 390×844 và 430×932 chuyển một cột, không tràn ngang.
- Không đổi GraphQL schema, resolver, permission, restaurant scoping hoặc audit/realtime side effect.

## Ngoài phạm vi

- Cấm vai trò `staff` ở API hoặc model.
- Viết lại design system, thêm package, font hoặc animation library.
- Thay đổi luồng chuyển chủ chuỗi, mời qua email hay quản lý nhân sự riêng.
- Chạy GitHub Actions/CI.
