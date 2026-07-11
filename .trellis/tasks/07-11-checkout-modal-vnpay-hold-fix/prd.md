# Checkout modal, cart hold và VNPAY

## Vấn đề
- Checkout báo giỏ đã thay đổi dù người dùng không sửa món.
- Modal đang bắt buộc họ tên dù nghiệp vụ chỉ cần một kênh liên hệ hợp lệ: email hoặc số điện thoại.
- Modal chưa tạo phiên VNPAY dù backend provider đã có.
- Bố cục modal dày, thông tin liên hệ và thanh toán khó quét nhanh.

## Root cause
`withOrderConflictHardening` đang có một luồng checkout-hold riêng: hủy giữ kho, đổi hold sang `checkout_pending` và xóa cart refs trước khi gọi resolver checkout chính. Resolver chính cũng tự kiểm tra và giải phóng hold trong cùng transaction nên hai luồng xung đột.

`createOrderPayment` hiện chỉ cho actor có `PAYMENT_WRITE`, nên khách hàng không thể tạo phiên thanh toán cho chính đơn vừa tạo.

## Yêu cầu
1. Checkout hold chỉ được xử lý tại resolver checkout chính, trong cùng transaction tạo đơn.
2. Phía client và server chỉ yêu cầu email hợp lệ hoặc số điện thoại hợp lệ; họ tên là tùy chọn.
3. VNPAY chỉ hiển thị khi nhà hàng bật provider và checkout chỉ có một nhà hàng.
4. Khi chọn VNPAY: tạo đơn với trạng thái chờ thanh toán, tạo `PaymentSession`, sau đó chuyển trình duyệt tới `payUrl`.
5. Khách chỉ được tạo payment session cho đơn thuộc chính tài khoản; staff/manager vẫn dùng quyền hiện tại.
6. Modal gọn hơn, có phân cấp rõ cho liên hệ, nhận hàng, món, tổng tiền và thanh toán; responsive không tràn.

## Không làm
- Không thay thuật toán ký số, IPN hay ReturnURL VNPAY đã có.
- Không thêm provider mới.
- Không thay luồng POS thanh toán hiện hữu.
