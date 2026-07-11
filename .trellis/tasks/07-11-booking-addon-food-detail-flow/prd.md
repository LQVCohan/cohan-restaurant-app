# Sửa luồng chi tiết món khi order kèm đặt bàn

## Hiện trạng và nguyên nhân gốc

- Khách mở bước chọn món từ form đặt bàn với `returnTo=booking`, `serviceAt` và `bookingDraft`.
- `RestaurantMenu` giữ context này, nhưng contract điều hướng sang `FoodDetailV2` không mang `returnTo`.
- `FoodDetailV2` vì vậy dùng hành vi đặt món giao hàng thông thường: nút `Đặt ngay` gọi `addCartItem` rồi chuyển `/checkout`.
- Backend `addCartItem` chủ động cộng quantity và giữ thêm tồn kho khi cùng cart identity được gọi lại. Do đó bấm `Thêm vào giỏ` rồi `Đặt ngay` tạo lần thêm thứ hai đúng theo contract backend nhưng sai ý nghĩa UI của luồng đặt bàn.
- Cart drawer trong `FoodDetailV2` cũng không nhận `bookingAddonMode`, nên nút tiếp tục mở checkout giao hàng và bắt nhập địa chỉ.

## Luồng thật

`Table schema / cart schema -> CustomerCartMutation.addCartItem -> FoodDetailV2 Apollo mutation -> RestaurantMenu/FoodDetail route state -> Cart.handleCheckout -> TableBooking bookingDraft -> BookingModal -> create reservation + addon order`.

## File thay đổi

- `src/utils/customerFoodNavigation.js`
  - mang `returnTo` trong URL và route state của trang chi tiết món.
- `src/components/Customer/RestaurantMenu/RestaurantMenu.jsx`
  - bổ sung `returnTo=booking` khi mở món từ menu order kèm và giữ nguyên `bookingDraft`.
- `src/components/Customer/Food/FoodDetailV2.jsx`
  - nhận diện booking addon context;
  - trong context này, nút chính chỉ mở giỏ để kiểm tra, không gọi `addCartItem` lần hai;
  - truyền booking props cho Cart để nút hoàn tất quay lại `TableBooking` cùng draft;
  - hiển thị số lượng và tổng tiền theo đúng nhà hàng đặt bàn.
- `src/utils/customerFoodNavigation.test.js`
  - khóa việc giữ `returnTo=booking` trong URL và state.

## Tiêu chí nghiệm thu

- Bấm `Thêm vào giỏ` một lần chỉ phát sinh một lần gọi add và một lượng giữ kho tương ứng.
- Trong luồng đặt bàn, nút chính của trang món không thêm lại món; nó mở giỏ món để người dùng kiểm tra.
- Từ giỏ món ở trang chi tiết, `Hoàn tất chọn món` quay về `/restaurant/:id/layout?fromMenu=1`, không mở `/checkout`.
- Booking draft gồm bàn, tầng, ngày giờ và thông tin khách vẫn được khôi phục.
- Không hiển thị form địa chỉ giao hàng hoặc phương thức thanh toán đơn giao hàng trong luồng addon.
- Luồng đặt món thông thường vẫn giữ hành vi `Đặt ngay`: thêm đúng một lần rồi đi checkout.
- Backend cart, giữ kho, order addon, tiền cọc và GraphQL contract không thay đổi.

## Validation dự kiến

```bash
npx vitest run src/utils/customerFoodNavigation.test.js src/components/Customer/Food/FoodDetailV2.helpers.test.jsx
npm run check:graphql
npm run build
```

## Ngoài phạm vi

- Thay đổi semantics cộng quantity của `addCartItem`.
- Thay đổi checkout giao hàng, VNPAY hoặc modal địa chỉ.
- Thay đổi công thức cọc bàn và cọc món.
