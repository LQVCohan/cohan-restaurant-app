# PRD — Rà soát và sửa luồng order sau quét QR bàn

## Luồng đã trace

`generateTableAccessQr` → URL `/table/:restaurantId/:tableId?token=...` → `publicActiveTableSessionOrders` → `TableOrderExperience` → menu/category/modifier query → `publicSubmitTableOrder` → phiên bàn + order batch + giữ tồn kho → socket/POS queue → `confirmIncomingOrder` hoặc `rejectIncomingOrder` → kitchen work items.

## Lỗi gốc đã xác định

1. Order QR được commit trong transaction nhưng tracking/status lại được `save()` sau khi session MongoDB đã kết thúc. Client có thể nhận lỗi dù order đã tồn tại, rồi lần thử lại mới trả về order cũ.
2. Trạng thái bàn được đổi sang `occupied` ngoài transaction; lỗi hậu xử lý có thể để order và bàn lệch trạng thái.
3. Idempotency chỉ kiểm tra trước transaction, chưa có unique index nên hai request đồng thời vẫn có thể tạo hai batch.
4. Event xác nhận order bị bọc sai thành `event.order.order`, khiến POS/staff realtime nhận payload không đúng contract.
5. Contract cũ cho phép bàn `payment_pending` gọi thêm món khi yêu cầu thanh toán đã được hủy, nhưng capability hiện chặn tuyệt đối theo trạng thái bàn.

## Phạm vi sửa

- Đưa tracking/public status và cập nhật trạng thái bàn vào cùng transaction tạo order.
- Hậu xử lý socket không được làm request đã commit báo thất bại.
- Bổ sung unique partial index cho idempotency của nguồn `customer_table_qr` và trả lại order đã tạo khi gặp race duplicate.
- Sửa payload realtime của thao tác nhận order.
- Đồng bộ capability của `payment_pending` với trạng thái phiên/thanh toán thực tế.
- Bổ sung regression tests cho transaction sequencing, duplicate idempotency, capability và realtime payload.

## Không thay đổi

- Không cho bàn `available`, `cleaning`, `offline` tự order khi chưa mở phục vụ.
- Không bỏ xác thực token nhà hàng/bàn.
- Không bỏ kiểm tra tồn kho, định lượng, modifier hoặc giới hạn số batch chờ.
- Không chuyển order QR thẳng vào bếp; vẫn phải qua nhân viên/POS xác nhận.

## Tiêu chí nghiệm thu

- Một lần bấm gửi không báo lỗi giả sau khi transaction đã commit.
- Retry cùng idempotency key trả cùng order; request đồng thời không tạo hai batch.
- Bàn và order được commit/rollback cùng nhau.
- POS nhận event xác nhận với `evt.order` là order thật.
- Bàn `payment_pending` chỉ có thể gọi thêm khi session/payment không còn ở trạng thái yêu cầu thanh toán.
