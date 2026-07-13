# COHAN merchant payment onboarding

## Mục tiêu vận hành

COHAN là nền tảng SaaS. Chủ nền tảng cấu hình hạ tầng thanh toán một lần; mỗi nhà hàng chỉ nhập bộ mã merchant riêng mà MoMo hoặc VNPAY cấp cho chính nhà hàng đó.

Không yêu cầu nhà hàng nhập domain, endpoint cổng thanh toán, Return URL, IPN/webhook URL, thuật toán ký, thời gian hết hạn hoặc kênh VNPAY. Các giá trị dùng chung này thuộc trách nhiệm của COHAN.

## Phần chủ nền tảng phải cấu hình

```env
NODE_ENV=production
PAYMENT_PUBLIC_BASE_URL=https://api.example.com
PAYMENT_WEB_RETURN_URL=https://app.example.com
PAYMENT_CREDENTIAL_ENCRYPTION_KEY=<stable-32-byte-secret>
PAYMENT_PROVIDER_TIMEOUT_MS=30000
PAYMENT_SESSION_TTL_MINUTES=10

MOMO_ENDPOINT_PRODUCTION=https://payment.momo.vn/v2/gateway/api/create
MOMO_REQUEST_TYPE=captureWallet

VNPAY_URL_PRODUCTION=https://pay.vnpay.vn/vpcpay.html
VNPAY_BANK_CODE=VNPAYQR
```

`PAYMENT_PUBLIC_BASE_URL` phải trỏ tới backend công khai. Từ giá trị này COHAN tạo tự động:

- MoMo Return URL: `/api/payments/return/momo`
- MoMo IPN URL: `/api/payments/webhooks/momo`
- VNPAY Return URL: `/api/payments/return/vnpay`
- VNPAY IPN URL: `/api/payments/webhooks/vnpay`

Production không được dùng localhost và phải dùng HTTPS.

## Phần nhà hàng tự nhập

### MoMo

- Partner Code
- Access Key
- Secret Key
- Chọn đúng bộ mã Sandbox hoặc Production

### VNPAY

- TmnCode
- Hash Secret
- Chọn đúng bộ mã Sandbox hoặc Production

Nhà hàng không nhập `VNPAY_BANK_CODE`. COHAN đặt kênh thanh toán chung bằng `VNPAY_BANK_CODE`; đặt `VNPAYQR` để cổng mở thẳng luồng QR, hoặc để trống để khách tự chọn tại VNPAY.

## Luồng tiền

Khi nhà hàng dùng bộ mã merchant riêng, giao dịch được tạo bằng chính tài khoản merchant đó. Tiền được MoMo/VNPAY đối soát về tài khoản ngân hàng đã đăng ký trong hợp đồng merchant của nhà hàng. COHAN không tự nhận tiền chỉ vì tạo URL thanh toán; COHAN lưu phiên giao dịch, xác minh chữ ký callback và cập nhật trạng thái đơn.

Nếu dùng bộ mã nền tảng làm fallback, tiền sẽ thuộc tài khoản merchant của nền tảng. Mô hình đó chỉ nên bật khi COHAN có quy trình đối soát, chi trả cho nhà hàng và cơ sở pháp lý phù hợp.

## Quy trình đưa một nhà hàng lên Production

1. Nhà hàng hoàn tất hồ sơ doanh nghiệp và ký hợp đồng trực tiếp với MoMo/VNPAY.
2. Chủ nền tảng cung cấp Return URL và IPN URL công khai cho nhà cung cấp khi được yêu cầu.
3. Nhà cung cấp cấp bộ mã Production cho nhà hàng.
4. Nhà hàng vào **Cấu hình cổng thanh toán**, chọn **Tài khoản chính thức** và nhập bộ mã riêng.
5. Trang cấu hình chỉ cho bật phương thức khi hạ tầng COHAN và bộ mã merchant đều sẵn sàng.
6. Thực hiện giao dịch Production giá trị nhỏ, xác nhận IPN, trạng thái đơn và báo cáo đối soát trước khi mở cho khách.

## Bảo mật

- Credential được mã hóa AES-256-GCM trước khi lưu.
- Secret không được trả lại frontend sau khi lưu.
- Mỗi lần cập nhật tạo một phiên bản credential mới và vô hiệu hóa phiên bản cũ.
- Không đặt secret trong biến `VITE_*`, log, ảnh chụp màn hình hoặc ticket hỗ trợ.
- Không thay đổi `PAYMENT_CREDENTIAL_ENCRYPTION_KEY` sau khi đã lưu credential nếu chưa có quy trình xoay khóa.
