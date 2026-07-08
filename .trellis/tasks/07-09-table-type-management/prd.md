# PRD — Quản lý loại bàn theo nhà hàng

## Hiện trạng

Bàn đã lưu trường `type` với sáu mã hệ thống: `standard`, `booth`, `vip`, `outdoor`, `bar`, `private`. Giao diện chỉ dùng danh sách nhãn tĩnh trong frontend nên quản lý không có nơi đổi tên hiển thị hoặc tạm ngưng một loại bàn.

## Luồng thật

`Restaurant model` → `restaurant.graphql` → `updateRestaurant` → `useRestaurant` → `TableManagement` → modal quản lý loại bàn → form thêm/chỉnh sửa bàn → `Table.type`.

Trang khách dùng `publicRestaurant` và `publicTables` để hiển thị thông tin loại bàn khi đặt chỗ.

## Thiết kế dữ liệu

- Giữ `Table.type` là enum hiện tại để không phá dữ liệu, filter và API cũ.
- Lưu cấu hình tên hiển thị/trạng thái trong `Restaurant.tableTypeSettings` dưới dạng JSON nhúng trực tiếp.
- Không tạo model, collection hoặc quan hệ con mới.
- Sáu mã hệ thống không được đổi; quản lý chỉ thay đổi `label` và `active`.

Ví dụ:

```json
{
  "standard": { "label": "Trong nhà", "active": true },
  "vip": { "label": "Phòng VIP", "active": true }
}
```

## Phạm vi

- Thêm nút `Loại bàn` ở trang Quản lý bàn.
- Modal hiển thị sáu loại, số bàn đang dùng, tên hiển thị và trạng thái bật/tắt.
- Lưu cấu hình qua mutation nhà hàng hiện có, giữ kiểm tra `restaurant.write` và restaurant scope.
- Loại tắt không xuất hiện trong form tạo bàn; form chi tiết vẫn hiển thị loại hiện tại của bàn cũ.
- Bộ lọc vẫn hiển thị mọi loại để quản lý dữ liệu cũ.
- Trang khách dùng nhãn đã cấu hình, fallback về nhãn mặc định nếu chưa có cấu hình.

## Tiêu chí nghiệm thu

- Quản lý có thể mở modal, đổi tên một loại bàn và lưu xuống MongoDB.
- Tải lại trang vẫn giữ tên và trạng thái đã lưu.
- Bật/tắt không làm đổi `type` của các bàn hiện có.
- Không thể lưu nhãn rỗng hoặc tắt toàn bộ sáu loại.
- Không thể gửi mã loại ngoài danh sách hệ thống.
- Không thay đổi quyền, trạng thái bàn, ghép bàn, đặt bàn hoặc cấu trúc collection hiện tại.

## Ngoài phạm vi

- Không cho tạo mã loại bàn tùy ý vì `TableType` đang là enum dùng chung ở backend, GraphQL và nhiều caller.
- Không xóa/migrate dữ liệu bàn cũ khi tắt một loại.
- Không thêm kéo thả sắp xếp hoặc màu tùy chỉnh.
