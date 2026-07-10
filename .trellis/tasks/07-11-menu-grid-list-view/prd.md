# PRD — Chế độ lưới và danh sách cho trang quản lý món

## Hiện trạng

Trang quản lý món đã có state `currentView`, hai nút chuyển chế độ trong `Toolbar` và class kết quả `mm-grid--grid` / `mm-grid--list`. Tuy nhiên giao diện hiện không hiển thị nút chuyển và hai chế độ cho ra cùng một bố cục danh sách.

## Luồng thật

1. `MenuManagement` giữ `currentView` và truyền `currentView`, `setCurrentView` vào `Toolbar`.
2. `Toolbar` phát `grid` hoặc `list` khi người quản lý nhấn nút tương ứng.
3. `MenuManagement` gắn `mm-grid--${currentView}` vào vùng kết quả và render cùng dữ liệu `MenuItemCard`.
4. Thay đổi này chỉ sửa lớp trình bày SCSS; không đổi schema, resolver, Apollo, dữ liệu món, restaurant scope, permission hoặc hành động trên món.

## Nguyên nhân gốc

`MenuManagementManagerFixes.scss` đặt `.view-toggle { display: none !important; }` và gom `.mm-grid--grid` với `.mm-grid--list` vào cùng một `display: flex; flex-direction: column`. Các override tiếp theo cũng ép thẻ của cả hai chế độ thành cùng một hàng ngang, làm state React không còn tạo khác biệt trực quan.

## Phạm vi

- Hiện lại bộ chuyển chế độ với nhãn rõ ràng và trạng thái active dễ nhận biết.
- Dạng lưới dùng CSS Grid nhiều cột, thẻ món theo chiều dọc.
- Dạng danh sách giữ hàng ngang toàn chiều rộng để quét thông tin nhanh.
- Trên màn hình nhỏ, tự dùng bố cục một cột an toàn và không tràn ngang.
- Tái sử dụng markup, state và icon hiện có; không thêm dependency.

## Tiêu chí nghiệm thu

- Người dùng nhìn thấy và thao tác được hai lựa chọn `Lưới` và `Danh sách`.
- Chọn `Lưới` hiển thị nhiều thẻ trên một hàng khi đủ chiều rộng.
- Chọn `Danh sách` hiển thị mỗi món thành một hàng toàn chiều rộng.
- Trạng thái được chọn có `aria-pressed`/active rõ ràng và focus keyboard vẫn thấy được.
- Bố cục không tràn ngang tại 390×844, 430×932, 768, 1024 và 1440 px.
- Không thay đổi dữ liệu, lọc, phân trang, quyền hoặc hành động món.

## Ngoài phạm vi

- Lưu lựa chọn chế độ vào tài khoản hoặc local storage.
- Thay đổi query/mutation hay cấu trúc dữ liệu món.
- Thiết kế lại nội dung thẻ, toolbar hoặc toàn bộ trang.

## Xác minh

- `npm run check:conflicts`
- `npm run build`
- Kiểm tra trực quan desktop ở cả hai chế độ.
- Kiểm tra responsive tại 390×844 và 430×932.
