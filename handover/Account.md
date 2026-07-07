# COHAN — Tài khoản kiểm thử

> Chỉ sử dụng cho MongoDB local/staging và buổi phản biện. Không dùng các tài khoản này trên production.

## Đăng nhập nhanh

**Mật khẩu chung của bộ dữ liệu bàn giao:** `Demo@123456`

Giá trị mặc định development này được khai báo tại `DEFAULT_DEMO_PASSWORD` trong `cohan-restaurant-backend/scripts/lib/scriptSafety.js` và có thể được thay bằng biến `DEMO_PASSWORD` khi tạo lại dữ liệu.

Có thể nhập email hoặc username tại màn hình đăng nhập.

| Nhóm kiểm thử | Vai trò | Email | Username |
| --- | --- | --- | --- |
| Quản trị | System Admin + Brand Admin | `admin.demo@cohan.local` | `admin.demo` |
| Doanh nghiệp | Business Owner | `business.owner.demo@cohan.local` | `business.owner.demo` |
| Quản lý | Manager chi nhánh Thủ Đức | `manager.demo@cohan.local` | `manager.demo` |
| Quản lý | Manager chi nhánh Quận 1 | `manager.branch2.demo@cohan.local` | `manager.branch2.demo` |
| Người dùng | Customer/User | `customer.demo@cohan.local` | `customer.demo` |
| Nhân viên | Staff/Server Thủ Đức | `staff.server.demo@cohan.local` | `staff.server.demo` |
| Nhân viên | Staff/Server Quận 1 | `staff.branch2.demo@cohan.local` | `staff.branch2.demo` |

Tối thiểu để kiểm tra yêu cầu **Admin + User**:

```text
Admin: admin.demo@cohan.local
User:  customer.demo@cohan.local
Password chung: Demo@123456
```

## Business và phạm vi truy cập

- Business/Brand: `COHAN Demo Business`.
- Chi nhánh chính: `COHAN Defense Demo Restaurant`.
- Chi nhánh thứ hai: `COHAN Defense Demo Restaurant - Quận 1`.

| Tài khoản | Phạm vi |
| --- | --- |
| `admin.demo@cohan.local` | Toàn hệ thống và toàn Brand |
| `business.owner.demo@cohan.local` | Toàn Brand và cả hai chi nhánh |
| `manager.demo@cohan.local` | Chỉ chi nhánh Thủ Đức |
| `manager.branch2.demo@cohan.local` | Chỉ chi nhánh Quận 1 |
| `customer.demo@cohan.local` | Luồng người dùng/khách hàng tại chi nhánh chính |
| `staff.server.demo@cohan.local` | Nhân viên chi nhánh Thủ Đức |
| `staff.branch2.demo@cohan.local` | Nhân viên chi nhánh Quận 1 |

## Xác nhận trước khi gửi database

Mật khẩu trong file database phải khớp với tài liệu này. Trước khi đóng gói, restore database vào local và đăng nhập thử bằng:

1. `admin.demo@cohan.local`.
2. `customer.demo@cohan.local`.
3. `manager.demo@cohan.local`.

Nếu thay đổi `DEMO_PASSWORD`, phải cập nhật file này và tạo lại database archive để password hash đồng nhất.
