# PRD — Chọn nhà hàng còn món trên trang chi tiết

## Hiện trạng

Trang `FoodDetailV2` chỉ tải `customerMenuItem` theo một `menuItemId` và `restaurantId`. Khách không biết cùng món đang có tại nhà hàng nào khác. Khi nhà hàng hiện tại hết món hoặc ngừng nhận đơn, trang chỉ khóa đặt hàng và hiển thị đăng ký nhận nhắc.

Thẻ quản lý lấy `MenuItem.inventoryStatus/maxAvailable` từ `menuItemInventoryAvailability.service`, còn `menuItemLiveState` tự chọn kho và gọi một phép tính khác. Hai đường tính có thể trả kết quả khác nhau cho cùng biến thể mặc định.

## Luồng thật

1. `MenuItem`, `Recipe`, `Ingredient`, `StockItem`, `Warehouse` lưu món, công thức và tồn kho theo nhà hàng.
2. Resolver trường `MenuItem.inventoryStatus/maxAvailable` gọi `getMenuItemInventoryAvailability`.
3. `menuItemLiveState` chọn kho đầu tiên đang hoạt động rồi gọi `checkAvailabilityForLinesTx`.
4. `FoodDetailV2` tải một món, một nhà hàng và trạng thái live; không có query cho các nhà hàng khác bán cùng món.
5. `addCartItem` giữ tồn kho theo đúng `restaurantId`, `menuItemId` và biến thể đã chọn.

## Nguyên nhân gốc

- Thiếu hợp đồng GraphQL công khai để ánh xạ một món sang các MenuItem tương ứng ở những nhà hàng công khai khác.
- Logic kiểm tồn kho bị nhân đôi giữa trường MenuItem và live state, nên dữ liệu hiển thị quản lý và khả năng đặt món có thể lệch nhau.

## Phạm vi

- Dùng một helper tồn kho theo `restaurantId + menuItemId + servingVariantKey` cho cả live state và trường MenuItem.
- Thêm query công khai trả mỗi nhà hàng có món cùng tên/mã, MenuItem tương ứng, trạng thái nhận đơn và tồn khả dụng.
- Chỉ lấy menu đang hoạt động, nhà hàng đang hoạt động và đã công khai; vẫn cho hiển thị nhà hàng đang đóng cửa nhưng không tự chọn để đặt nếu có nơi khác đang mở.
- Trên trang chi tiết, hiển thị toàn bộ lựa chọn nhà hàng và số suất còn lại.
- Lần mở đầu tiên, nếu nhà hàng hiện tại không thể đặt, tự chuyển sang nhà hàng đang nhận đơn và còn món; người dùng vẫn có thể chọn thủ công nhà hàng khác.
- Khi đổi nhà hàng, đổi đồng thời `menuItemId`, `restaurantId` và biến thể mặc định để các query, giỏ hàng và giữ tồn kho không trộn dữ liệu giữa nhà hàng.

## Tiêu chí nghiệm thu

- Cùng biến thể mặc định, số suất trên thẻ quản lý và `menuItemLiveState.maxAvailableQty` dùng cùng phép tính.
- Trang chi tiết hiển thị tất cả nhà hàng công khai có món cùng tên hoặc mã, không lặp nhà hàng.
- Mỗi lựa chọn hiển thị tên, địa chỉ ngắn, trạng thái nhận đơn và số suất còn lại.
- Nhà hàng đang nhận đơn và còn món được ưu tiên chọn tự động khi nhà hàng ban đầu không thể đặt.
- Chọn nhà hàng khác tải đúng MenuItem của nhà hàng đó; thêm giỏ dùng đúng ID và kho của nhà hàng đã chọn.
- Nhà hàng hết món vẫn được hiển thị để khách xem, nhưng không được đánh dấu có thể đặt.
- Không thêm dependency, migration hoặc thay đổi công thức tồn kho.

## Ngoài phạm vi

- Gom nhiều nhà hàng vào cùng một giỏ hàng hoặc một đơn hàng.
- Đồng bộ tên/mã món giữa các nhà hàng bằng một catalog mới.
- Tìm kiếm gần đúng, Atlas Search hoặc xếp hạng theo khoảng cách địa lý.
- Thay đổi nghiệp vụ đóng/mở nhà hàng, đặt bàn hoặc giao hàng.

## Xác minh

```bash
cd cohan-restaurant-backend
npx vitest run tests/services/menu-item-inventory-warehouse-scope.test.js tests/resolvers/customer-menu-item-locations.test.js
cd ..
npx vitest run src/components/Customer/Food/FoodDetailV2.helpers.test.jsx
npm run check:graphql
npm run check:conflicts
npm run build
```
