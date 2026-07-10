# PRD — Xác nhận tại bàn trước khi gọi món bằng QR

## Vấn đề

QR in trên bàn là token tĩnh. Người đi ngang có thể quét QR của bàn đang phục vụ và gửi thêm món. Order hiện phải qua POS, nhưng khi quán đông nhân viên vẫn có thể nhận nhầm mà chưa hỏi khách thật tại bàn.

## Luồng thật đã trace

`generateTableAccessQr` → `/table/:restaurantId/:tableId?token=...` → `publicActiveTableSessionOrders` → `TableOrderExperience` → `publicSubmitTableOrder` → order pending → `PosIncomingTableOrderQueue` → `confirmIncomingOrder` → kitchen.

## Phạm vi

1. QR tĩnh chỉ xác định nhà hàng/bàn và cho phép tạo yêu cầu xác nhận.
2. Yêu cầu xác nhận phải gắn với active `table_session` hiện tại và một `deviceId` trình duyệt.
3. POS/staff thấy yêu cầu theo bàn và mã yêu cầu; mã 6 số chỉ hiện sau thao tác rõ ràng “Đã tới bàn – hiện mã”.
4. Khách nhập mã staff đọc tại bàn. Backend mới cấp `orderSessionToken` ngắn hạn.
5. Token phải gắn `restaurantId + tableId + tableSessionId + deviceHash + requestId`.
6. Token cũ mất hiệu lực khi phiên bàn đóng, chuyển sang thanh toán, hoặc phiên mới được mở.
7. Gửi order, xem order, gọi nhân viên, yêu cầu thanh toán và OTP liên kết khách đều phải có token phiên hợp lệ.
8. Một phiên bàn có thể có tối đa 5 yêu cầu xác nhận đang chờ; cùng thiết bị được tái sử dụng yêu cầu chưa hết hạn.

## Ràng buộc

- Không thêm dependency hoặc model mới.
- Lưu các yêu cầu xác nhận ngắn hạn trong `Order.clientMeta` của bản ghi `table_session`.
- Mã xác nhận được suy ra bằng HMAC, không lưu plaintext trong database.
- Không thay đổi quy tắc order QR phải chờ staff/POS nhận trước khi vào bếp.
- Giữ restaurant scoping và quyền `order.read` cho hàng đợi staff.

## Ngoài phạm vi

- Định vị GPS, Bluetooth, Wi-Fi proximity hoặc camera.
- SMS OTP thật.
- Cho nhiều thiết bị cùng gọi món mà không xác nhận riêng từng thiết bị.
- Tự động xác nhận chỉ vì thiết bị đã từng dùng ở phiên bàn cũ.

## Tiêu chí nghiệm thu

- Chỉ QR tĩnh không thể xem chi tiết order hoặc gọi món.
- Khách chưa nhập đúng mã không nhận được session token.
- Staff phải mở mã từ UI hàng đợi; mã khớp đúng request label và bàn.
- Token phiên của bàn A không dùng cho bàn B, phiên khác hoặc device khác.
- Token bị chặn khi phiên bàn `ready_to_pay/closed/cancelled` hoặc đã yêu cầu/đã thanh toán.
- Sau xác nhận một lần, cùng browser có thể gọi nhiều đợt món trong đúng phiên bàn.
- Refresh trang giữ token trong `sessionStorage`; phiên bàn mới không dùng lại token cũ.
