# Design

## Luồng checkout
1. Modal gửi `CreateCheckoutOrdersInput` kèm `cartId/cartItemId`.
2. Resolver checkout chính xác thực người dùng, contact, hold, tồn kho và tạo order trong một transaction.
3. Cart item được xóa/đánh dấu checked out trong cùng transaction; không có lớp pre-release bên ngoài.

## Luồng VNPAY
1. Modal tạo order với `paymentMethod: card`.
2. Modal gọi `createOrderPayment` với provider/paymentMethod `vnpay` và danh sách order vừa tạo.
3. Payment resolver cho qua khi toàn bộ order thuộc authenticated user; nếu không thì giữ nguyên kiểm tra `PAYMENT_WRITE`.
4. Client xóa cart local sau khi order đã được tạo, rồi điều hướng tới `PaymentSession.payUrl`.
5. IPN vẫn là nguồn xác nhận thanh toán; ReturnURL chỉ hiển thị kết quả.

## UI
- Contact card ưu tiên hai trường phone/email, thông báo rõ “chỉ cần một”.
- Họ tên có nhãn tùy chọn.
- Giảm khoảng trắng và padding, giữ nút hành động sticky.
- VNPAY dùng card cùng pattern phương thức thanh toán hiện tại.
