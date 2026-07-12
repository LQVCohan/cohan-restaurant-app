# Tối ưu modal nhập kho nhanh

## Hiện trạng và root cause

- Modal yêu cầu người dùng quét qua phần giới thiệu lớn và toàn bộ trường truy vết dù thao tác phổ biến chỉ cần số lượng, đơn vị và giá lô.
- Nhà cung cấp và thời gian nhập bị lặp ở từng mặt hàng, làm chậm phiếu nhập nhiều dòng.
- Modal không đưa con trỏ vào ô số lượng và phím Enter không tạo luồng nhập liên tục.
- Gợi ý giá nằm tách khỏi ô giá và có quá nhiều lựa chọn cho một thao tác nhanh.

## Luồng thực tế

`StockItem/StockMovement -> inventory.graphql receiveStock -> stock.mutation receiveStock + stock.write permission -> RECEIVE_STOCK/useIngredients hoặc StorageManagement/SupplyList -> QuickStockModal`.

Schema, resolver, quy đổi đơn vị, quyền và payload hiện tại đã đáp ứng nghiệp vụ. Thay đổi chỉ nằm ở lớp modal và giữ nguyên contract trả về cho mọi caller.

## Hướng giao diện

Modal vận hành gọn theo thứ tự: thông tin phiếu chung -> số lượng/đơn vị/giá -> quy đổi -> chi tiết lô tùy chọn -> xác nhận. Ưu tiên bàn phím và không buộc người dùng mở trường phụ.

## Phạm vi thay đổi

- `QuickStockModal.jsx`
  - Tự focus ô số lượng đầu tiên.
  - Enter từ số lượng chuyển đến giá; Enter từ giá chuyển sang mặt hàng kế tiếp hoặc submit dòng cuối.
  - Gom nhà cung cấp và thời gian nhập thành thông tin chung của phiếu.
  - Giữ khả năng ghi nguồn/thời gian riêng cho từng dòng khi phiếu có nhiều mặt hàng.
  - Thu gọn mã lô, hạn dùng, ghi chú và override riêng bằng native `details`.
  - Đưa tối đa hai gợi ý giá sát trường giá; không tự áp giá cũ.
  - Giữ nguyên payload `qty`, `unit`, `unitPrice`, `supplier`, `datetime`, `lot`, `expiry`, `note`.
- `QuickStockModal.scss`
  - Bỏ hero lớn, giảm chiều cao card, làm rõ luồng bắt buộc và optional.
  - Touch target tối thiểu 44px, focus rõ, không overflow trên mobile.
- `QuickStockModal.test.jsx`
  - Kiểm tra bàn phím hai bước và submit.
  - Kiểm tra thông tin phiếu chung được truyền vào payload.

## Tiêu chí chấp nhận

- Mở modal một mặt hàng sẽ focus vào ô số lượng.
- Có thể nhập `số lượng -> Enter -> giá -> Enter` để hoàn tất.
- Phiếu nhiều dòng chỉ nhập nhà cung cấp và thời gian một lần; dòng riêng vẫn có thể override trong phần chi tiết.
- Trường optional không chiếm chiều cao khi chưa cần.
- Giá cũ chỉ được áp khi người dùng bấm gợi ý, không tự động ghi đè.
- Payload và mọi caller hiện tại không phải thay đổi.
- Không đổi GraphQL, resolver, permission, logic quy đổi hay cách ghi tồn kho.

## Ngoài phạm vi

- Không thêm thư viện hoặc abstraction mới.
- Không thay đổi batch transaction hay cơ chế `Promise.all`/`Promise.allSettled` của caller.
- Không thay đổi nghiệp vụ giá nhập và tồn kho.
