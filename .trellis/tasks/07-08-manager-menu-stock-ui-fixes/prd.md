# PRD — Hiển thị tồn món và sửa UI quản lý thực đơn

## Hiện trạng

1. Trang khách hiển thị số suất còn có thể đặt, nhưng thẻ món ở trang quản lý chỉ hiển thị trạng thái bán.
2. Menu đổi trạng thái mở phía trên nhưng bị cắt ở biên thẻ.
3. Modal Nhóm thực đơn có một Modal chung bên ngoài và thêm một `modal-container`/`modal-header` bên trong, tạo cảm giác modal chồng modal.
4. Các ô tìm kiếm chưa đồng nhất về khung, icon, focus và nút xóa.
5. Nút “Mở phần định lượng nguyên liệu” điều hướng đến hash `storage`, trong khi page id hợp lệ là `inventory`.

## Luồng thật

### Tồn món

`Recipe + Ingredient + StockItem(onHand - reserved)` → `checkAvailabilityForLinesTx` / `getMenuItemInventoryAvailability` → GraphQL `MenuItem.maxAvailable` → `useMenuManagement` → `MenuItemCard`.

Trang quản lý đã query `maxAvailable`, `inventoryStatus`, `stockWarnings` và `stockShortages`; không cần sửa contract backend.

### UI

`ManagerLayout` → `MenuManagement` → `MenuItemCard` / `CategoryModal` / `Toolbar` / `MenuItemModal`.

## Nguyên nhân gốc

- Thẻ chưa render `maxAvailable` dù dữ liệu đã có.
- `MenuManagementCardCompactFix.scss` ép `overflow: hidden` lên card chứa dropdown absolute.
- `CategoryModal` dựng lại cấu trúc modal bên trong component `Modal` dùng chung.
- Button định lượng dùng route id cũ không còn tồn tại.

## Phạm vi

- Hiển thị số suất khả dụng theo cách chế biến mặc định trên thẻ quản lý.
- Giữ cảnh báo sắp hết/hết nguyên liệu rõ ràng.
- Cho menu trạng thái hiển thị ngoài card mà không bị cắt.
- Dùng một cấu trúc modal duy nhất cho Nhóm thực đơn.
- Đồng bộ search field và focus state.
- Điều hướng nút định lượng sang page `inventory` bằng event điều hướng sẵn có.

## Tiêu chí nghiệm thu

- Món có tracking hiển thị `Còn X suất`; món hết hiển thị `Còn 0 suất` với trạng thái cảnh báo.
- Số lượng lấy từ `MenuItem.maxAvailable`, không tạo query theo từng card.
- Dropdown trạng thái không bị cắt hoặc nằm dưới card kế bên.
- Modal Nhóm thực đơn chỉ có một khung, một header và một nút đóng.
- Ô tìm kiếm modal và toolbar có icon, focus ring và nút xóa thẳng hàng.
- Nút định lượng mở trang Quản lý kho (`inventory`).
- Không thay đổi quyền, mutation, realtime hoặc nghiệp vụ tồn kho.

## Ngoài phạm vi

- Không thêm endpoint hoặc field GraphQL.
- Không tính live state riêng cho từng serving variant trên danh sách quản lý.
- Không thêm dependency hoặc design system mới.
