# Thiết kế

## Hướng giao diện

Giữ bảng màu sage/xám ấm của manager dashboard, tăng độ tương phản và khoảng thở. Trang ưu tiên thứ tự: tổng quan → hồ sơ/chi nhánh → thành viên hiện tại → thao tác quản trị. Các bề mặt lớn dùng radius mềm; control bên trong dùng radius nhỏ hơn để hierarchy không bị “mọi thứ đều là card”.

## Cấu trúc

- `ManagementPageHeader`: giữ KPI và bộ chọn chuỗi.
- `brand-workspace`: hồ sơ doanh nghiệp và chi nhánh, 2 cột trên desktop.
- `brand-members-panel`: header + bộ lọc đóng/mở native + danh sách thành viên.
- `brand-member-operations`: 2 cột gồm mời/thêm thành viên và các disclosure đổi quyền/chuyển chủ.
- Mobile: mọi grid chuyển một cột; nút chiếm đủ chiều rộng; trạng thái thành viên không đè nội dung.

## Quyết định tối giản

- Không tạo component mới; cấu trúc hiện có đủ dùng.
- Không thêm state cho tab hoặc điều hướng trong trang.
- Dùng `<details>/<summary>`, CSS Grid và stylesheet sẵn có.
- Xóa lớp compact và membership override, đưa style cần thiết vào `BrandManagement.css` để cascade có một nguồn rõ ràng.
