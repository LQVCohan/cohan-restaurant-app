# PRD — Tối ưu luồng chọn bàn sang menu trên mobile

## Hiện trạng

Trên `/staff/orders`, chạm một bàn chỉ cập nhật `selectedTableId`. Màn hình vẫn ở tab Bàn và hiển thị panel chi tiết theo mật độ desktop, khiến nhân viên phải cuộn rồi bấm thêm nút `Mở menu`. Khi tải lại trang, bàn đang thao tác không được khôi phục. Các nhánh mở tiếp từ menu như tùy chọn món, giỏ hàng và ảnh minh chứng dùng kích thước `vh`/padding cố định nên dễ bị chật hoặc che bởi thanh trình duyệt và safe area.

## Luồng thật

1. `TABLES_QUERY` lấy `id`, `code`, `floorLevel`, `status`, `capacity` theo `restaurantId`.
2. `StaffOrdering` ánh xạ dữ liệu thành `tableCode`, `name`, `floor`, `status`, `guests`.
3. `TableMap.onSelect` hiện chỉ gọi `setSelectedTableId`.
4. `selectedTable` quyết định dữ liệu của `MenuOrdering`, `CartBottomSheet`, khách liên kết và mutation tạo đơn.
5. Thay đổi này giữ nguyên GraphQL, mutation, restaurant scope, permission và realtime; chỉ sửa state chuyển tab, session storage và responsive presentation.

## Nguyên nhân gốc

Luồng chọn bàn và luồng mở menu đang tách thành hai thao tác dù trên mobile đây là một hành động liên tục. Trạng thái bàn chỉ sống trong React state và không được lưu theo nhà hàng. Đồng thời các sheet con đặt chiều cao theo `vh` và dùng khoảng cách desktop, không theo `dvh`/safe area của trình duyệt di động.

## Phạm vi

- Khi chọn bàn trên mobile: lưu `id` và `tableCode` theo `restaurantId`, chuyển sang tab Menu và cuộn vùng nội dung lên đầu.
- Khôi phục bàn đã chọn hợp lệ sau khi tải lại; xóa bản ghi lưu nếu bàn không còn tồn tại.
- Desktop giữ hành vi chọn bàn rồi dùng side panel hiện tại.
- Ẩn side panel bàn trên mobile vì luồng đã chuyển thẳng sang Menu.
- Thêm hành động `Đổi bàn` tại đầu Menu.
- Tối ưu kích thước mobile cho danh sách món, sheet tùy chọn món, giỏ hàng và modal ảnh minh chứng bằng `dvh`, safe area, padding và wrapping phù hợp.
- Bổ sung test cho lưu/đọc selection và hành động đổi bàn.

## Tiêu chí nghiệm thu

- Chạm bàn ở màn hình <= 899px chuyển ngay sang Menu.
- Bàn đang chọn hiển thị đúng mã, tầng và sức chứa tại đầu Menu.
- Tải lại trang vẫn khôi phục đúng bàn trong cùng nhà hàng và không dùng selection của nhà hàng khác.
- Nút `Đổi bàn` đưa người dùng về tab Bàn.
- Side panel chi tiết không chiếm chiều cao trên mobile; desktop không đổi.
- Menu giữ grid hai cột, không tràn ngang ở 390×844 và 430×932.
- Sheet tùy chọn món, giỏ hàng và ảnh minh chứng nằm trong `100dvh`, không bị che bởi safe area và vẫn cuộn được.
- Không thêm dependency hoặc thay đổi nghiệp vụ đơn hàng.

## Ngoài phạm vi

- Tách `StaffOrdering.jsx` thành module mới.
- Thay đổi query/mutation, quyền, thanh toán, ghép/tách bàn hoặc lifecycle đơn hàng.
- Thay đổi thiết kế desktop ngoài hành động `Đổi bàn` trong Menu.

## Xác minh

- `npx vitest run src/components/Staff/StaffOrdering.selection.test.jsx src/components/Staff/components/MenuOrdering.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Kiểm tra thực tế tại 390×844 và 430×932: chọn bàn → menu → chọn món → giỏ hàng → ảnh minh chứng → đổi bàn.
