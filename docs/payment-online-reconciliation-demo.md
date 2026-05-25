# Demo online payment & đối soát chuyển khoản

Tài liệu này mô tả luồng online payment cho order sau khi đã có PR #758 và PR #762, dùng cho demo nội bộ.

## Luồng xử lý

1. Nhân viên tạo phiên thanh toán online từ POS (PaymentSession cho order payment).
2. Khách thanh toán qua chuyển khoản ngân hàng hoặc MoMo/VNPay.
3. Ngân hàng/cổng thanh toán gửi webhook/callback về hệ thống.
4. Hệ thống đối chiếu mã tham chiếu và số tiền giao dịch.
5. Nếu hợp lệ, hệ thống tự động tạo `PaymentTransaction`, `Invoice`, `Cashflow` và cập nhật trạng thái order đã thanh toán.
6. Finance Dashboard hiển thị kết quả đối soát (khớp/lệch/chưa khớp).

## Biến môi trường bắt buộc

- `PUBLIC_BASE_URL` hoặc `APP_PUBLIC_URL`
- `BANK_TRANSFER_WEBHOOK_SECRET`
- `BANK_TRANSFER_BANK_NAME`
- `BANK_TRANSFER_ACCOUNT_NUMBER`
- `BANK_TRANSFER_ACCOUNT_NAME`
- `BANK_TRANSFER_BANK_CODE` (mặc định `VCB`)
- `PAYMENT_SESSION_TTL_MINUTES` (mặc định `15`)

## Lưu ý demo an toàn

- Chuyển khoản ngân hàng chỉ được xác nhận qua webhook khớp giao dịch, **không** xác nhận bằng thao tác staff bấm nút.
- Hiển thị QR **không** đồng nghĩa order đã thanh toán.
- Phiên thanh toán online `pending` sẽ hết hạn theo TTL khi được kiểm tra/tái sử dụng sau thời gian cấu hình.
- Staff có thể hủy mã thanh toán `pending` để tạo lại mã mới.
- Khi coupon/promotion thay đổi, hệ thống tạo fingerprint mới nên không tái sử dụng mã pending cũ.
- Phiên `cancelled/expired` không đánh dấu đơn đã thanh toán.
- Chỉ webhook/callback hợp lệ mới chuyển trạng thái thanh toán online sang `success`.
- Giao dịch lệch số tiền **không** được đánh dấu paid.
- Luồng POS tiền mặt/thẻ hiện tại giữ nguyên, không thay đổi trong phạm vi demo này.

## Production hardening sau PR payment-security

- `BANK_TRANSFER_WEBHOOK_SECRET`: legacy static header check (`x-bank-webhook-secret`) for demo/backward compatibility.
- `BANK_TRANSFER_WEBHOOK_HMAC_SECRET`: preferred production mode. When set, webhook requires:
  - `x-bank-webhook-timestamp`
  - `x-bank-webhook-signature`
- Signing payload format: `${timestamp}.${rawBody}` where `rawBody` is Fastify raw body if available, otherwise `JSON.stringify(req.body || {})`.
- Signature algorithm: HMAC-SHA256 hex digest.
- Replay protection: reject when timestamp skew exceeds `BANK_TRANSFER_WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS` (default `300`).
- Duplicate detection:
  - First key: `provider + transactionId` (unique sparse).
  - Fallback: `provider + fingerprint` (unique sparse), fingerprint derived from normalized transaction payload fields.
  - If provider does not send `transactionId`, fingerprint fallback remains stable and does not include server receive time.
- Strict bank account match for order payment settlement:
  - PaymentSession metadata must contain `metadata.bankTransfer.bankAccountNumber`, `bankCode`, `transferContent`.
  - Webhook bank account is normalized and must equal session bank account; mismatch never settles payment.
- Webhook amount must be finite and `> 0`; invalid payloads are ignored and do not settle.
- `providerResponseRaw` and `callbackRaw` are sanitized out from default GraphQL payment session responses.
- Only `matched` reconciliation with exact amount, non-cancelled, non-expired session can settle an order.
- Cancelled/expired sessions never settle even when callback/webhook arrives later.
- Replay webhook events should be rejected by HMAC timestamp window or treated as `duplicate` by transactionId/fingerprint idempotency.
