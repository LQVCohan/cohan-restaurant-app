# Deploy QR bàn

## Mục đích

QR bàn cho khách quét tại bàn để xem món đang phục vụ, gọi nhân viên và gọi thanh toán mà không cần đăng nhập.

## Env frontend

- `VITE_PUBLIC_TABLE_BASE_URL`: domain public mà QR sẽ mở.
- `VITE_PUBLIC_APP_URL`: fallback khi không cấu hình domain QR riêng.

Ưu tiên dùng `VITE_PUBLIC_TABLE_BASE_URL` nếu domain khách khác domain quản lý.

Ví dụ:

- Admin domain: `https://admin.example.com`
- Customer domain: `https://order.example.com`
- Set frontend env:

```env
VITE_PUBLIC_TABLE_BASE_URL=https://order.example.com
```

## Env backend

- `TABLE_ACCESS_TOKEN_SECRET`: secret ký token truy cập bàn.
- `TABLE_ACCESS_TOKEN_EXPIRES_IN`: thời hạn token QR bàn.
- `CORS_ORIGINS`: danh sách domain frontend được phép gọi API/socket.

Nếu dùng Socket.IO realtime cho dashboard, domain frontend quản lý phải nằm trong `CORS_ORIGINS`.

## Quy trình vận hành

1. Set env frontend/backend.
2. Build và deploy frontend.
3. Deploy backend với cùng cấu hình CORS/token.
4. Vào Manager → QR truy cập bàn.
5. Kiểm tra dòng “QR sẽ mở tại”.
6. Bấm “Sinh QR cho bàn thiếu/hết hạn QR”.
7. In QR và dán đúng bàn.
8. Test bằng điện thoại: mở QR, xem món, gọi nhân viên, gọi thanh toán.
9. Mở dashboard quản lý để kiểm tra yêu cầu hỗ trợ hiển thị.

## Lưu ý bảo mật

- Đổi mã bàn sẽ vô hiệu QR cũ.
- Thu hồi QR sẽ làm link cũ không dùng được.
- Không chia sẻ token hoặc link QR trong kênh nội bộ không cần thiết.
- Nếu nghi QR bị lộ, sinh lại QR cho bàn đó.
