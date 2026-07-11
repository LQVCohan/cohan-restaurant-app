# Chặn cổng thanh toán production khi chạy local

## Hiện trạng và nguyên nhân gốc

- Frontend chỉ mở `payment.payUrl` do backend trả về.
- `PaymentSession` lấy mode từ `Restaurant.paymentSettings` rồi resolve credential theo mode đó.
- Bản sửa trước đã gắn mode thật cho credential nền tảng, nhưng một credential riêng của nhà hàng được lưu dưới mode `production` vẫn được tin cậy tuyệt đối.
- Khi chạy local/development với cấu hình nhà hàng production, backend có thể tạo URL `pay.vnpay.vn`; bộ TmnCode dùng thử bị VNPAY từ chối bằng trang “Không tìm thấy website”.
- `ws proxy socket error: ECONNABORTED` ở Vite là kết nối Socket.IO bị đóng khi backend/tab khởi động lại và không tham gia vào việc tạo URL thanh toán.

## Luồng thật

`Restaurant.paymentSettings.mode -> PaymentSession pre-save -> getRestaurantProviderMode -> resolvePaymentProviderCredential -> providerCredentialMode -> createVnpayPayment -> QRPaymentModal mở payUrl`.

## Phạm vi thay đổi

- `paymentCredential.service.js`: chuẩn hóa runtime mode; local/development luôn sandbox trừ khi `PAYMENT_ALLOW_PRODUCTION_IN_DEVELOPMENT=true`.
- `payment-platform-mode.service.test.js`: test restaurant mode và platform mode production đều bị hạ về sandbox trong development; production runtime vẫn giữ production.
- `.env.example`: tài liệu hóa cờ opt-in.

## Tiêu chí nghiệm thu

- `NODE_ENV=development` không thể mở `pay.vnpay.vn` theo cấu hình production còn sót trong DB.
- Local dùng credential sandbox của nhà hàng nếu có, nếu không fallback platform sandbox.
- `NODE_ENV=production` tiếp tục dùng production bình thường.
- Có thể opt-in rõ ràng bằng `PAYMENT_ALLOW_PRODUCTION_IN_DEVELOPMENT=true` cho kiểm thử đặc biệt.
- Không thay đổi frontend, callback verification, quyền hoặc dữ liệu bí mật.

## Validation

```bash
npx vitest run cohan-restaurant-backend/tests/services/payment-platform-mode.service.test.js
node --check cohan-restaurant-backend/src/services/payment/paymentCredential.service.js
```

## Ngoài phạm vi

- Che log ngắt Socket.IO tạm thời của Vite.
- Cấp mới hoặc xác minh TmnCode/Hash Secret.
- Thay Return URL/IPN localhost bằng hạ tầng public.
