# PRD — Tối ưu luồng chọn bàn sang menu trên mobile

## Hiện trạng

Trên `/staff/orders`, chạm một bàn chỉ cập nhật `selectedTableId`. Màn hình vẫn ở tab Bàn và hiển thị panel chi tiết theo mật độ desktop, khiến nhân viên phải cuộn rồi bấm thêm nút `Mở menu`. Khi tải lại trang, bàn đang thao tác không được khôi phục. Các nhánh mở tiếp từ menu như tùy chọn món, giỏ hàng và ảnh minh chứng dùng kích thước `vh`/padding cố định nên dễ bị chật hoặc che bởi thanh trình duyệt và safe area.

## Luồng thật

1. `TABLES_QUERY` lấy `id`, `code`, `floorLevel`, `status`, `capacity` theo `restaurantId`.
2. `StaffOrdering` ánh xạ dữ liệu thành `tableCode`, `name`, `floor`, `status`, `guests`.
3. `StaffOrdering` truyền danh sách và callback chọn bàn vào `TableMap`.
4. `selectedTable` quyết định dữ liệu của `MenuOrdering`, `CartBottomSheet`, khách liên kết và mutation tạo đơn.
5. Thanh điều hướng mobile hiện có sẵn tab `Bàn` và `Menu`.
6. Thay đổi này giữ nguyên GraphQL, mutation, restaurant scope, permission và realtime; chỉ nối tiếp thao tác chọn bàn vào điều hướng hiện có và sửa responsive presentation.

## Nguyên nhân gốc

Luồng chọn bàn và luồng mở menu đang tách thành hai thao tác dù trên mobile đây là một hành động liên tục. Trạng thái bàn chỉ sống trong React state. Đồng thời các sheet con đặt chiều cao theo `vh` và dùng khoảng cách desktop, không theo `dvh`/safe area của trình duyệt di động.

## Phạm vi đã thực hiện

- `TableMap` lưu `id` và `tableCode` của bàn trong `sessionStorage`.
- Khi khôi phục, chỉ chấp nhận bản ghi nếu `id` vẫn tồn tại trong danh sách bàn hiện tại; bản ghi cũ hoặc của danh sách khác bị xóa.
- Sau khi chọn hoặc khôi phục bàn trên mobile, tái sử dụng nút `Menu` của bottom navigation để chuyển tab, không tạo route hay state song song.
- Desktop giữ hành vi chọn bàn và side panel hiện tại.
- Ẩn side panel bàn trên mobile vì luồng đã chuyển thẳng sang Menu; người dùng quay lại bằng tab `Bàn` có sẵn.
- Tối ưu kích thước mobile cho danh sách món, sheet tùy chọn món, giỏ hàng và modal ảnh minh chứng bằng `dvh`, safe area, padding và wrapping phù hợp.
- Bổ sung test trực tiếp cho lưu selection, chuyển Menu, khôi phục và xóa selection không còn hợp lệ.

## Tiêu chí nghiệm thu

- Chạm bàn ở màn hình <= 899px lưu đúng `id`/`tableCode` và chuyển ngay sang Menu.
- Tải lại trang khôi phục bàn nếu `id` vẫn có trong danh sách hiện tại.
- Selection cũ không tồn tại trong danh sách được xóa, không tự chọn nhầm bàn chỉ vì trùng mã.
- Tab `Bàn` trong bottom navigation vẫn đưa người dùng về danh sách bàn.
- Side panel chi tiết không chiếm chiều cao trên mobile; desktop không đổi.
- Menu giữ grid hai cột, không tràn ngang ở 390×844 và 430×932.
- Sheet tùy chọn món, giỏ hàng và ảnh minh chứng nằm trong `100dvh`, không bị che bởi safe area và vẫn cuộn được.
- Không thêm dependency hoặc thay đổi nghiệp vụ đơn hàng.

## Ngoài phạm vi

- Tách `StaffOrdering.jsx` thành module mới.
- Thay đổi query/mutation, quyền, thanh toán, ghép/tách bàn hoặc lifecycle đơn hàng.
- Thiết kế lại thanh bottom navigation hoặc giao diện desktop.

## Xác minh

- `npx vitest run src/components/Staff/components/TableMap.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Kiểm tra thực tế tại 390×844 và 430×932: chọn bàn → menu → chọn món → giỏ hàng → ảnh minh chứng → quay lại tab Bàn.
