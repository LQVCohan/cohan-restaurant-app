# Sửa quyền order món kèm, cọc 1 đồng và bước thanh toán đặt bàn

## Hiện trạng và nguyên nhân gốc

1. `Table.deposit` có default legacy là `1`. Bàn không cấu hình cọc vì vậy bị tính 1 đồng ở reservation, trong khi `BookingSummary` lại đọc `price/depositAmount` nên hiển thị “Miễn phí”.
2. `TableBooking` gọi `createOrderForTable` với `clientMeta.source=reservation_cart_addon`. Resolver chuẩn đã kiểm tra tài khoản customer, reservation thuộc chính user và cart hold hợp lệ, nhưng `withOrderRestaurantAccessGuards` chặn trước bằng staff restaurant scope nên trả `FORBIDDEN_SCOPE`.
3. Modal thanh toán MoMo/VNPAY chỉ mở sau khi cả reservation và addon order thành công. Lỗi scope làm luồng dừng trước bước này nên người dùng không thấy giao diện thanh toán.
4. Modal thanh toán còn hiển thị các từ kỹ thuật như query, provider, reference, callback và IPN.

## Luồng thật

`Table.deposit schema -> publicTables resolver -> Table GraphQL field -> BookingSummary/BookingModal -> createReservation -> TableBooking createOrderForTable -> outer order access guard -> canonical createOrderForTable customer/reservation/cart validation -> QRPaymentModal`.

## File thay đổi và lý do

- `cohan-restaurant-backend/models/table.model.js`: bàn mới không cấu hình cọc sẽ có giá trị 0.
- `cohan-restaurant-backend/graphql/resolvers/table/query.js`: chuyển các bản ghi legacy `deposit=1` về 0 trước khi trả dữ liệu bàn, nên bước tạo reservation sau đó cũng đọc đúng giá trị.
- `cohan-restaurant-backend/graphql/resolvers/table/index.js`: chuẩn hóa giá trị trả qua GraphQL để mọi màn hình đều hiển thị thống nhất.
- `cohan-restaurant-backend/graphql/resolvers/order/accessGuard.js`: để resolver chuẩn tự xử lý duy nhất nguồn `reservation_cart_addon`; các nguồn tạo order khác vẫn bắt buộc restaurant scope.
- `cohan-restaurant-backend/tests/resolvers/order-reservation-addon-access-guard.test.js`: khóa việc customer addon đi vào resolver chuẩn và order thường vẫn qua staff scope.
- `cohan-restaurant-backend/tests/resolvers/table-legacy-deposit-normalization.test.js`: khóa việc chuyển sentinel 1 đồng về 0.
- `src/components/Customer/TableBooking/BookingSummary/BookingSummary.jsx`: đọc đúng `Table.deposit`, không còn hiển thị miễn phí trong khi backend tính 1 đồng.
- `src/components/Customer/QRPaymentModal/QRPaymentModal.jsx`: đổi toàn bộ wording kỹ thuật và lỗi API thô thành nội dung dành cho khách hàng.

## Tiêu chí nghiệm thu

- Bàn không cấu hình cọc hiển thị và tính cọc bàn 0 đồng, kể cả bản ghi legacy có `deposit=1`.
- Cọc món 50% vẫn giữ nguyên; ví dụ món 90.000 đồng thì tổng cọc là 45.000 đồng, không phải 45.001 đồng.
- Customer tạo addon order chỉ khi reservation thuộc user hiện tại và cart hold hợp lệ.
- Order thông thường của staff vẫn phải qua restaurant scope.
- Xác nhận thành công có tiền cọc tự mở modal chọn MoMo/VNPAY đã có sẵn.
- Luồng khách hàng không còn hiện `FORBIDDEN_SCOPE`, HTTP 403, query, provider, callback hoặc IPN.

## Validation

```bash
npx vitest run cohan-restaurant-backend/tests/resolvers/order-reservation-addon-access-guard.test.js cohan-restaurant-backend/tests/resolvers/table-legacy-deposit-normalization.test.js
npm run check:graphql
npm run build
```

## Ngoài phạm vi

- Thay đổi tỷ lệ cọc món 50%.
- Thay đổi API thanh toán MoMo/VNPAY hoặc webhook xác nhận.
- Cho customer tạo order bàn không gắn reservation/cart hold hợp lệ.
