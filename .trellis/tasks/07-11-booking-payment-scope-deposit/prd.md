# Sửa quyền order món kèm, cọc 1 đồng và bước thanh toán đặt bàn

## Hiện trạng và nguyên nhân gốc

1. `Table.deposit` có default legacy là `1`. Bàn không cấu hình cọc vì vậy bị tính 1 đồng ở reservation, trong khi `BookingSummary` lại đọc `price/depositAmount` nên hiển thị “Miễn phí”.
2. `TableBooking` gọi `createOrderForTable` với `clientMeta.source=reservation_cart_addon`. Resolver chuẩn đã kiểm tra tài khoản customer, reservation thuộc chính user và cart hold hợp lệ, nhưng `withOrderRestaurantAccessGuards` chặn trước bằng staff restaurant scope nên trả `FORBIDDEN_SCOPE`.
3. Khi order addon lỗi, frontend ghép nguyên `err.message` và lỗi HTTP vào banner. Modal thanh toán MoMo/VNPAY chỉ mở sau khi cả reservation và addon order thành công nên người dùng không thấy bước thanh toán.

## Luồng thật

`Table.deposit schema -> Table GraphQL field -> publicTables Apollo -> BookingSummary/BookingModal -> createReservation -> computeDeposit -> TableBooking createOrderForTable -> outer order access guard -> canonical createOrderForTable customer/reservation/cart validation -> QRPaymentModal`.

## File thay đổi và lý do

- `cohan-restaurant-backend/models/table.model.js`: default cọc mới là 0.
- `cohan-restaurant-backend/graphql/resolvers/table/index.js`: trả 0 cho dữ liệu legacy đúng 1 đồng để các màn hình thống nhất.
- `cohan-restaurant-backend/graphql/resolvers/reservation/mutation.js`: không cộng sentinel 1 đồng vào tiền cọc thực tế.
- `cohan-restaurant-backend/graphql/resolvers/order/accessGuard.js`: để resolver chuẩn tự xử lý duy nhất nguồn `reservation_cart_addon`; các nguồn tạo order khác vẫn bắt buộc restaurant scope.
- `cohan-restaurant-backend/tests/resolvers/order-restaurant-access-guard.test.js`: khóa quyền customer addon và staff guard bình thường.
- `cohan-restaurant-backend/tests/resolvers/capability-gating.mutations.test.js`: khóa phép tính cọc legacy.
- `src/components/Customer/TableBooking/BookingSummary/BookingSummary.jsx`: đọc đúng `Table.deposit`.
- `src/components/Customer/TableBooking/TableBooking.jsx`: không hiển thị lỗi GraphQL/HTTP thô.
- `src/components/Customer/BookingTableModal/BookingModal.jsx`: CTA nói rõ bước thanh toán tiếp theo.
- `src/components/Customer/QRPaymentModal/QRPaymentModal.jsx`: đổi wording kỹ thuật thành nội dung dành cho khách hàng.

## Tiêu chí nghiệm thu

- Bàn không cấu hình cọc hiển thị và tính cọc bàn 0 đồng, kể cả bản ghi legacy có `deposit=1`.
- Cọc món 50% vẫn giữ nguyên; ví dụ món 90.000 đồng thì tổng cọc là 45.000 đồng, không phải 45.001 đồng.
- Customer tạo addon order chỉ khi reservation thuộc user hiện tại và cart hold hợp lệ.
- Order thông thường của staff vẫn phải qua restaurant scope.
- Xác nhận thành công có tiền cọc sẽ tự mở modal chọn MoMo/VNPAY.
- UI không hiện `FORBIDDEN_SCOPE`, HTTP 403, query, provider, callback hay IPN.

## Validation

```bash
npx vitest run cohan-restaurant-backend/tests/resolvers/order-restaurant-access-guard.test.js cohan-restaurant-backend/tests/resolvers/capability-gating.mutations.test.js
npx vitest run src/components/Customer/BookingTableModal/BookingModal.test.jsx
npm run check:graphql
npm run build
```

## Ngoài phạm vi

- Thay đổi tỷ lệ cọc món 50%.
- Thay đổi API thanh toán MoMo/VNPAY hoặc webhook/IPN.
- Cho customer tạo order bàn không gắn reservation/cart hold hợp lệ.
