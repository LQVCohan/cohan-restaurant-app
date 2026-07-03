# Design — RBAC Vietnamese wording

## Nguyên tắc nội dung

- Dùng động từ rõ ràng: Xem, Tạo, Cập nhật, Quản lý, Xử lý, Xuất, Kiểm duyệt.
- Dùng thuật ngữ sản phẩm nhất quán: vai trò, quyền, mã quyền, trợ lý AI, thực đơn, đánh giá, đối soát.
- Tên hiển thị mô tả việc người dùng được làm; mã kỹ thuật giữ ở dòng phụ để hỗ trợ kiểm tra.
- Không dịch mã quyền hoặc slug vì đây là contract kỹ thuật.

## Cách áp dụng

- Giữ bộ mapping tập trung trong `rbacVietnameseLabels.js`.
- Formatter ưu tiên mapping theo `permission.code` và `role.slug`, sau đó mới dùng dữ liệu backend làm fallback.
- Installer chỉ tác động bên trong `.rbac-page`, không sửa nội dung trang khác.
- Không thay đổi màu sắc, layout hoặc hành vi checkbox.

## Kiểm tra độ đầy đủ

- Số phần tử trước và sau khi format phải bằng nhau.
- Nhóm không có mapping dùng fallback tiếng Việt `Nhóm khác`, không hiển thị raw key cho người dùng cuối.
- Test bao phủ nhóm mới và permission code thuộc hệ thống, tài chính, in ấn, AI, khách hàng và vệ sinh.
