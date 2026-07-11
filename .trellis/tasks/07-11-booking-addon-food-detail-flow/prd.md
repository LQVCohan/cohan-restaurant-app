# Sửa luồng chi tiết món khi order kèm đặt bàn

## Hiện trạng và nguyên nhân gốc

- Khách mở bước chọn món từ form đặt bàn với `serviceAt` và `bookingDraft`.
- Contract điều hướng sang trang chi tiết món trước đây không giữ rõ `returnTo=booking`.
- `FoodDetailV2` vì vậy dùng hành vi đặt món giao hàng thông thường: cả `Thêm vào giỏ` và `Đặt ngay` đều gọi `addCartItem`, sau đó `Đặt ngay` chuyển `/checkout`.
- Backend `addCartItem` chủ động cộng quantity và giữ thêm tồn kho khi cùng cart identity được gọi lại. Vì thế bấm hai action liên tiếp tạo lần thêm thứ hai đúng theo contract backend nhưng sai ý nghĩa UI của luồng đặt bàn.
- Cart drawer trong trang chi tiết cũng không nhận booking context nên nút tiếp tục mở checkout giao hàng và bắt nhập địa chỉ.

## Luồng thật đã trace

`cart.graphql AddCartItemInput -> CustomerCartMutation.addCartItem -> FoodDetail Apollo mutation -> customerFoodNavigation route state/query -> Cart.handleCheckout -> TableBooking bookingDraft -> BookingModal -> create reservation + addon order`.

## File đã thay đổi

- `src/utils/customerFoodNavigation.js`
  - giữ `returnTo` trong URL và route state;
  - tự gắn `returnTo=booking` khi navigation có `serviceAt`, đồng thời vẫn ưu tiên giá trị explicit.
- `src/components/Customer/Food/FoodDetailV2.jsx`
  - trở thành lớp booking-context mỏng quanh implementation hiện có;
  - nhận diện booking addon qua URL hoặc draft đã khôi phục;
  - trong booking mode ẩn action `Đặt ngay`, chỉ giữ một action thêm món nên không còn lần gọi `addCartItem` thứ hai.
- `src/components/Customer/Food/FoodDetailV2Core.jsx`
  - giữ nguyên implementation chi tiết món trước đó, không sao chép hoặc thay đổi mutation/giữ kho.
- `src/components/Customer/Homepage_Client/components/Cart.jsx`
  - nhận diện booking context từ URL/state khi caller trang chi tiết chưa truyền props;
  - giữ props explicit của `RestaurantMenu` làm nguồn ưu tiên;
  - fallback quay về `/restaurant/:id/layout?fromMenu=1` cùng `bookingDraft` thay vì `/checkout`.
- `src/components/Customer/Homepage_Client/components/CartCore.jsx`
  - giữ nguyên UI và logic kiểm tra giỏ theo nhà hàng, hold hết hạn và nút `Hoàn tất chọn món`.
- Các test điều hướng/context
  - khóa `returnTo=booking` trong URL/state;
  - khóa nhận diện booking mode tại FoodDetail và Cart;
  - khóa việc cart bình thường không bị chuyển thành booking cart.

## Kết quả mong đợi

- Bấm `Thêm vào giỏ` một lần chỉ phát sinh một lần gọi add và một lượng giữ kho tương ứng.
- Trong luồng đặt bàn không còn action `Đặt ngay` trùng chức năng; khách thêm món rồi mở giỏ để kiểm tra.
- Từ giỏ món ở trang chi tiết, `Hoàn tất chọn món` quay về `/restaurant/:id/layout?fromMenu=1`, không mở `/checkout`.
- Booking draft gồm bàn, tầng, ngày giờ và thông tin khách được chuyển lại cho `TableBooking`.
- Không hiển thị form địa chỉ giao hàng hoặc phương thức thanh toán đơn giao hàng trong luồng addon.
- Luồng đặt món thông thường vẫn giữ nguyên `Đặt ngay`: thêm một lần rồi đi checkout.
- Backend cart, giữ kho, order addon, tiền cọc và GraphQL contract không thay đổi.

## Validation

Đã thêm test tập trung:

```bash
npx vitest run src/utils/customerFoodNavigation.test.js src/components/Customer/Food/FoodDetailV2.helpers.test.jsx src/components/Customer/Homepage_Client/components/Cart.booking-context.test.jsx
npm run check:graphql
npm run build
```

Các lệnh trên chưa được chạy cục bộ vì execution container không phân giải được `github.com`, nên không có checkout/dependencies. Commit trực tiếp lên `main` cũng chưa tạo workflow run có thể đọc qua connector.

## Ngoài phạm vi

- Thay đổi semantics cộng quantity của `addCartItem`.
- Thay đổi checkout giao hàng, VNPAY hoặc modal địa chỉ.
- Thay đổi công thức cọc bàn và cọc món.
