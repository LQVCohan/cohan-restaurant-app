# Kế hoạch triển khai

1. Sửa `BrandOwnershipTransfer.jsx`: tách nhãn hiển thị khỏi danh sách vai trò đích; loại `staff` khỏi target roles; xóa scope checkbox staff không còn caller.
2. Cập nhật test component để khóa hành vi không cho chuyển sang nhân viên và vẫn cho nâng nhân viên lên quản lý.
3. Tổ chức lại `BrandManagement.jsx`: bỏ state điều khiển disclosure không cần thiết, đưa danh sách thành viên lên trước khu thao tác, thêm heading/semantics cho các nhóm.
4. Hợp nhất style vào `BrandManagement.css`; bỏ import và xóa hai file override.
5. Chạy test component đích và build cục bộ; không chạy CI.
