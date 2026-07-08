# COHAN — Tài khoản kiểm thử

> Chỉ sử dụng cho MongoDB local, staging hoặc môi trường demo. Không dùng các tài khoản này trên production.

## Đăng nhập nhanh

Tất cả tài khoản trong database mẫu sử dụng mật khẩu chung:

```text
Demo@123456
```

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

Tài khoản tối thiểu để kiểm tra hai nhóm quyền chính:

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

## Kiểm tra database mẫu

Sau khi restore, nên đăng nhập thử bằng:

1. `admin.demo@cohan.local`.
2. `customer.demo@cohan.local`.
3. `manager.demo@cohan.local`.

Mật khẩu trong archive hiện tại phải khớp với `Demo@123456`. Nếu thay đổi `DEMO_PASSWORD`, cần cập nhật tài liệu và tạo lại database archive để password hash đồng nhất.
