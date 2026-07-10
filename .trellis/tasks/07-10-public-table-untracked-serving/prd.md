# PRD — Cho phép gọi món không theo dõi tồn kho

## Hiện trạng

Trang gọi món tại bàn hiển thị món có serving variant nhưng chưa khai báo nguyên liệu là có thể đặt. Khi gửi đơn, backend hydrate món thành công nhưng `inventory.service` ném lỗi `ServingVariant has no ingredients...`, khiến toàn bộ đơn không được tạo.

## Nguyên nhân gốc

`menuItemInventoryAvailability.service` phân loại variant không có nguyên liệu là `NOT_TRACKED`. Frontend giữ món này ở trạng thái orderable. Tuy nhiên `buildNeeds` trong `inventory.service` lại coi cùng dữ liệu là lỗi bắt buộc, tạo contract drift giữa bước hiển thị và bước giữ tồn.

## Luồng đã trace

`Recipe.servingVariants.ingredients -> getMenuItemInventoryAvailability -> menuItemsConnection -> TableOrderExperience -> publicSubmitTableOrder -> hydrateOrderItems -> buildInventoryLines -> reserveForOrderTx -> buildNeeds`.

## Phạm vi

- Khi serving variant tồn tại nhưng không có dòng nguyên liệu, coi dòng món là không theo dõi kho và không tạo nhu cầu giữ tồn.
- Vẫn giữ lỗi khi recipe hoặc serving key không tồn tại, vì đó là dữ liệu món không hợp lệ.
- Thêm regression test cho `checkAvailabilityForLinesTx` với variant không có nguyên liệu.

## Tiêu chí nghiệm thu

- Món có serving variant hợp lệ nhưng `ingredients: []` không làm lỗi gửi order.
- Không truy vấn hoặc cập nhật `StockItem` cho dòng món không theo dõi kho.
- Món có định lượng nguyên liệu vẫn kiểm tra và giữ tồn như cũ.
- Không đổi schema, resolver contract, UI hoặc quyền truy cập.

## Kiểm tra

- Chạy test service mục tiêu.
- Chạy CI backend lint, test và build trước khi merge.
