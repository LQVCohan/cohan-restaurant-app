# PRD — Món đi kèm đặt bàn dùng đúng giờ phục vụ

## Hiện trạng và nguyên nhân gốc

Luồng `BookingModal -> RestaurantMenu -> FoodDetailV2 -> addCartItem` chỉ truyền `restaurantId` và `returnTo=booking`. Ngày/giờ khách chọn bị mất, nên `publicRestaurant.canOrder` và guard giỏ hàng đều đánh giá bằng thời gian hiện tại. Menu cũng mặc định bữa trưa thay vì khung giờ của lịch bàn.

## Luồng thật

`Restaurant weekly/special hours -> restaurantAvailability -> publicRestaurant/cart capability guard -> BookingModal serviceAt -> RestaurantMenu timeSlot -> FoodDetailV2 -> AddCartItemInput -> CustomerCartMutation -> active Menu/timeSlot + inventory`.

## Phạm vi

- Truyền `serviceAt` từ lịch bàn sang menu, trang món và mutation giỏ hàng.
- Đánh giá khả năng nhận món theo `serviceAt` trên backend, giữ nguyên giờ hiện tại cho đặt món thông thường.
- Tự mở đúng menu sáng/trưa/tối/khuya theo giờ đặt bàn.
- Chặn món thuộc menu khác khung giờ với thông báo rõ ràng.
- Giữ ưu tiên lỗi tồn kho: món hết vẫn báo hết món khi nhà hàng và khung giờ hợp lệ.
- Không thay đổi chính sách giờ mở cửa, tồn kho, thời gian giữ món hoặc thanh toán.

## File thay đổi

- Availability/restaurant GraphQL: hỗ trợ đánh giá public restaurant tại thời điểm yêu cầu.
- Cart schema/model/resolver: lưu và xác thực `serviceAt`, kiểm tra menu đúng khung giờ.
- Booking/menu/food-detail frontend: giữ context giờ đặt bàn và hiển thị trạng thái đúng.
- Targeted tests: khóa ranh giới khung giờ và navigation context.

## Tiêu chí nghiệm thu

- Đang 05:00, lịch bàn 08:00 trong giờ mở cửa: menu sáng và món sáng đặt được.
- Chuyển sang menu tối cho lịch 08:00: nút đặt bị chặn với lý do sai khung giờ.
- Món hết: báo hết món, không báo nhà hàng đóng cửa.
- Thời điểm lịch nằm ngoài giờ hoạt động: backend chặn theo giờ lịch.
- Luồng đặt món thông thường không có `serviceAt` vẫn dùng giờ hiện tại.

## Validation

- Vitest targeted cho availability, navigation context và cart capability.
- GraphQL schema check.
- Frontend build.
