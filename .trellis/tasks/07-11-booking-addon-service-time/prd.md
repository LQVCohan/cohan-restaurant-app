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


## Bổ sung — đồng bộ giỏ, order kèm và tiền cọc

### Nguyên nhân gốc mới

- Backend chuẩn hóa khóa khẩu phần legacy `portion` sang khóa recipe thật, nhưng frontend tìm item trả về bằng khóa cũ nên không đồng bộ dòng giỏ dù hold đã thành công.
- Dòng cart phía client chưa phân biệt `serviceAt`.
- Draft bàn/ngày/giờ bị mất khi đi qua trang menu.
- `createOrderForTable` đang dùng guard POS/staff và giữ tồn kho thêm lần nữa thay vì chuyển cart hold sang order.
- Tiền cọc đang tin `depositAmount`/subtotal từ client và subtotal chưa cộng modifier.

### File thay đổi dự kiến

- `FoodDetailV2.jsx`, `CartProvider.jsx`, `useCart.js`: dùng serving key backend đã resolve, giữ `serviceAt`, refetch khi response lệch.
- `BookingModal.jsx`, `RestaurantMenu.jsx`, `TableBooking.jsx`: giữ/khôi phục booking draft và gửi cart refs.
- `discountPreviewPayload.js`: mapper order kèm có cart hold refs.
- Order/reservation GraphQL + resolver: xác thực chủ reservation, chuyển hold sang order một lần, tính subtotal/cọc từ cart server.
- Targeted tests cho serving key, service-time identity và công thức cọc.

### Tiêu chí nghiệm thu bổ sung

- Một lần bấm thêm món tạo đúng một dòng giỏ và một hold; không tăng hold ẩn.
- Quay lại đặt bàn vẫn giữ đúng bàn, ngày, giờ và thông tin khách.
- Khách hàng sở hữu reservation tạo được order kèm; người khác không được phép.
- Cart hold được chuyển sang order trong transaction, không giữ tồn kho hai lần.
- Tiền cọc cuối cùng = tiền cọc bàn + 50% × tổng món (gồm modifiers), do backend tính.
- Nếu tạo order kèm thất bại thì không mở thanh toán cho reservation chưa liên kết món.
