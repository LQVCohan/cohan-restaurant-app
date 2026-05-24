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

## Lưu ý demo an toàn

- Chuyển khoản ngân hàng chỉ được xác nhận qua webhook khớp giao dịch, **không** xác nhận bằng thao tác staff bấm nút.
- Hiển thị QR **không** đồng nghĩa order đã thanh toán.
- Giao dịch lệch số tiền **không** được đánh dấu paid.
- Luồng POS tiền mặt/thẻ hiện tại giữ nguyên, không thay đổi trong phạm vi demo này.
