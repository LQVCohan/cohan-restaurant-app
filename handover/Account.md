# COHAN demo accounts

> Chỉ sử dụng cho local/staging và buổi phản biện. Không dùng các tài khoản hoặc mật khẩu này trên production.

Sau khi chạy `npm run seed:defense`, các tài khoản sau được chuẩn hóa về trạng thái `active`, đã xác minh email và có thể đăng nhập bằng luồng đăng nhập thật của hệ thống.

| Vai trò | Email | Username | Mật khẩu local mặc định | Trang sau đăng nhập |
| --- | --- | --- | --- | --- |
| Admin | `admin.demo@cohan.local` | `admin.demo` | `Demo@123456` | `/manager` |
| Manager | `manager.demo@cohan.local` | `manager.demo` | `Demo@123456` | `/manager` |
| Customer/User | `customer.demo@cohan.local` | `customer.demo` | `Demo@123456` | `/` |
| Staff/Server | `staff.server.demo@cohan.local` | `staff.server.demo` | `Demo@123456` | `/staff/dashboard` |

Có thể nhập **email hoặc username** tại màn hình đăng nhập.

## Đổi mật khẩu demo

Đặt biến sau trong `cohan-restaurant-backend/.env`, sau đó chạy lại seed:

```env
DEMO_PASSWORD=MatKhauDemoMoi@2026
```

```bash
npm run seed:defense -- --reset
```

Seed ghi lại `passwordHash` cho bốn tài khoản trên ở mỗi lần chạy, nhờ đó mật khẩu trong tài liệu và dữ liệu luôn đồng nhất.

## Dữ liệu thao tác nhanh

- Nhà hàng: `COHAN Defense Demo Restaurant`
- Coupon hợp lệ: `ACTIVE10`
- Coupon số tiền cố định: `FIXED20K`
- Coupon hết hạn để kiểm tra lỗi: `EXPIRED10`
- Tài khoản bếp/thủ quỹ/nhân sự bổ sung được tạo bởi seed lịch làm việc và dùng cùng `DEMO_PASSWORD`; xem log của lệnh seed để đối chiếu danh sách.
