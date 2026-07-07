# COHAN demo accounts

> Chỉ sử dụng cho local/staging và buổi phản biện. Không dùng các tài khoản hoặc mật khẩu này trên production.

Sau khi chạy `npm run seed:defense`, các tài khoản sau được chuẩn hóa về trạng thái `active`, đã xác minh email và có thể đăng nhập bằng luồng đăng nhập thật của hệ thống. Tất cả dùng giá trị `DEMO_PASSWORD` trong `cohan-restaurant-backend/.env`; local development dùng giá trị mặc định được script thông báo sau khi seed.

## Brand và chi nhánh

- Business/Brand: `COHAN Demo Business`
- Chi nhánh chính, có đầy đủ dữ liệu nghiệp vụ: `COHAN Defense Demo Restaurant`
- Chi nhánh thứ hai, dùng để demo Brand và phân quyền chi nhánh: `COHAN Defense Demo Restaurant - Quận 1`

| Vai trò | Email | Username | Phạm vi |
| --- | --- | --- | --- |
| System Admin + Brand Admin | `admin.demo@cohan.local` | `admin.demo` | Toàn Brand |
| Business Owner | `business.owner.demo@cohan.local` | `business.owner.demo` | Toàn Brand và cả hai chi nhánh |
| Manager chi nhánh Thủ Đức | `manager.demo@cohan.local` | `manager.demo` | Chỉ `COHAN Defense Demo Restaurant` |
| Manager chi nhánh Quận 1 | `manager.branch2.demo@cohan.local` | `manager.branch2.demo` | Chỉ `COHAN Defense Demo Restaurant - Quận 1` |
| Customer/User | `customer.demo@cohan.local` | `customer.demo` | Dữ liệu khách tại chi nhánh chính |
| Staff/Server Thủ Đức | `staff.server.demo@cohan.local` | `staff.server.demo` | Chi nhánh chính |
| Staff/Server Quận 1 | `staff.branch2.demo@cohan.local` | `staff.branch2.demo` | Chi nhánh thứ hai |

Có thể nhập **email hoặc username** tại màn hình đăng nhập.

## Đổi mật khẩu demo

Đặt `DEMO_PASSWORD` trong `cohan-restaurant-backend/.env`, sau đó chạy lại:

```bash
npm run seed:defense -- --reset
```

Seed ghi lại `passwordHash` cho các tài khoản trên ở mỗi lần chạy, nhờ đó mật khẩu trong tài liệu và dữ liệu luôn đồng nhất.

## Dữ liệu thao tác nhanh

- Dữ liệu menu, kho, khách hàng, đơn hàng, lịch làm và khuyến mãi được seed đầy đủ cho chi nhánh chính.
- Chi nhánh Quận 1 có hồ sơ nhà hàng, liên kết Brand, Manager và Staff riêng để kiểm tra danh sách chi nhánh, chọn chi nhánh và giới hạn quyền truy cập.
- Coupon hợp lệ: `ACTIVE10`
- Coupon số tiền cố định: `FIXED20K`
- Coupon hết hạn để kiểm tra lỗi: `EXPIRED10`
- Tài khoản bếp/thủ quỹ/nhân sự bổ sung được tạo bởi seed lịch làm việc và dùng cùng `DEMO_PASSWORD`; xem log của lệnh seed để đối chiếu danh sách.
