# Final Demo – Manager Flow

Tài liệu này mô tả luồng demo ngắn gọn cho quản lý, tài chính và hiệu suất nhân sự.

## Luồng demo đề xuất

1. POS tạo đơn hàng mới.
2. Nhân viên chọn phương thức thanh toán.
3. BANK_TRANSFER / MoMo / VNPay tạo `PaymentSession`.
4. Webhook/callback xác nhận trạng thái thanh toán.
5. Finance Dashboard hiển thị giao dịch và kết quả đối soát.
6. Manager Performance hiển thị breakdown điểm và điều chỉnh incident/appeal.
7. Staff Performance hiển thị công thức tính điểm và bằng chứng đi kèm.

## Demo checklist

- Đã chọn đúng nhà hàng cần demo.
- Tài khoản đăng nhập có quyền manager.
- Biến môi trường thanh toán đã cấu hình.
- `BANK_TRANSFER_WEBHOOK_SECRET` đã cấu hình.
- Đơn demo có tổng tiền hợp lệ để theo dõi đối soát.
- Có dữ liệu demo hiệu suất để hiển thị snapshot.

## Lưu ý an toàn khi demo

- Hiển thị QR **không phải** xác nhận thanh toán thành công.
- Chỉ webhook/callback mới xác nhận thanh toán online.
- Trạng thái lệch tiền **không** đánh dấu đơn là đã thanh toán.
- Điểm hiệu suất tuân theo công thức và giữ nguyên điều chỉnh incident/appeal.
- Luồng tiền mặt/thẻ tại POS vẫn là xác nhận thủ công.
