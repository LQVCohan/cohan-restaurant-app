# Sửa ghép sai mode và credential VNPAY

## Hiện trạng và nguyên nhân gốc

- `PaymentSession` đã resolve credential riêng của nhà hàng hoặc fallback về credential nền tảng trong pre-save hook.
- Credential nền tảng hiện không có mode thực tế riêng; cùng một `VNPAY_TMN_CODE`/`VNPAY_HASH_SECRET` bị xem là dùng được cho cả sandbox và production.
- Sau khi tạo session, `createReservationPayment` và `createOrderPayment` vẫn tạo URL theo `Restaurant.paymentSettings.mode`, không theo `PaymentSession.providerCredentialMode` đã resolve.
- Khi nhà hàng đang để production nhưng credential nền tảng là sandbox, hệ thống tạo URL `pay.vnpay.vn` với TmnCode sandbox và VNPAY trả “Không tìm thấy website”.

## Luồng thật

`Restaurant.paymentSettings.mode -> PaymentSession pre-save -> resolvePaymentProviderCredential -> providerCredentialMode/$locals credentials -> createReservationPayment hoặc createOrderPayment -> createVnpayPayment -> QRPaymentModal mở payUrl`.

## Phạm vi thay đổi

- `paymentCredential.service.js`: thêm mode thực tế cho credential nền tảng, mặc định sandbox; trạng thái configured chỉ đúng ở mode nền tảng thực tế.
- `paymentSession.service.js`: dùng `payment.providerCredentialMode` để chọn endpoint MoMo/VNPAY.
- `.env.example`: tài liệu hóa `MOMO_PLATFORM_MODE` và `VNPAY_PLATFORM_MODE`.
- Test hồi quy: khi restaurant yêu cầu production nhưng chỉ có platform VNPAY sandbox, resolver trả mode sandbox và production status không bị đánh dấu configured.

## Tiêu chí nghiệm thu

- Không bao giờ ghép platform sandbox TmnCode/Hash Secret với URL VNPAY production.
- Credential riêng của nhà hàng vẫn dùng đúng mode đã lưu.
- Platform credential mặc định là sandbox nếu chưa khai báo mode.
- Có thể đặt `VNPAY_PLATFORM_MODE=production` khi bộ biến môi trường thực sự là production.
- PaymentSession lưu mode thực tế và provider URL dùng đúng mode đó.
- Không thay đổi callback verification, phân quyền hoặc giao diện khách hàng.

## Validation

```bash
npx vitest run cohan-restaurant-backend/tests/services/payment-platform-mode.service.test.js
npx vitest run cohan-restaurant-backend/tests/services/payment-credential.security.test.js
node --check cohan-restaurant-backend/src/services/payment/paymentCredential.service.js
node --check cohan-restaurant-backend/src/services/payment/paymentSession.service.js
```

## Ngoài phạm vi

- Tạo hoặc cấp mới TmnCode/Hash Secret từ VNPAY.
- Tự động xác minh merchant bằng giao dịch thật.
- Thay đổi Return URL/IPN localhost thành hạ tầng public.
