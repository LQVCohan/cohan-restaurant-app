# PRD — Hiển thị danh sách thực đơn trong modal

## Hiện trạng

- Dữ liệu menu đã được tải đúng qua `useMenuManagement` và `CompactMenuStrip` đã có đầy đủ thao tác chọn, tạo, sửa, ẩn/hiện, sao chép, xem lịch sử và xóa.
- Trên phần hành động đầu trang, người dùng dễ nhận ra “Danh mục món” và “Nhóm thực đơn” nhưng không có điểm vào rõ ràng mang tên “Danh sách thực đơn”.
- Danh sách menu đang chiếm một vùng lớn trên trang nên vẫn có thể bị hiểu nhầm là phần tổng quan theo khung giờ thay vì một chức năng quản lý riêng.

## Luồng thật

`Menu` schema/resolver → `menus(restaurantId)` → `useMenuManagement` → `MenuManagement.jsx` → `CompactMenuStrip.jsx` → thao tác tạo/sửa/ẩn/hiện/sao chép/xóa.

Không có sai lệch dữ liệu, quyền hoặc restaurant scope. Vấn đề nằm ở điểm vào và cách trình bày trên giao diện.

## Nguyên nhân gốc

Chức năng quản lý menu đã tồn tại nhưng chưa có một nhãn hành động rõ ràng để phân biệt với “Nhóm thực đơn”. Người dùng nhìn thấy phần nhóm danh mục trước nhưng không nhận ra nơi xem danh sách menu thực tế.

## Phạm vi

- Biến khu vực hiện tại thành một điểm vào rõ ràng mang tên “Danh sách thực đơn”.
- Mở toàn bộ 4 khung giờ và các menu hiện có trong modal kích thước lớn.
- Tái sử dụng nguyên dữ liệu và callback hiện có cho chọn, tạo, sửa, ẩn/hiện, sao chép, lịch sử, xóa và kiểm tra tồn kho.
- Đóng modal danh sách trước khi mở modal tạo/sửa/xóa khác để tránh chồng lớp thao tác.
- Giữ nguyên query, mutation, quyền, restaurant scope, audit log và các modal nghiệp vụ hiện tại.

## File thay đổi

- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.jsx`: thêm điểm vào “Xem danh sách thực đơn” và chuyển lưới quản lý menu vào modal dùng `Modal` chung.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`: kiểm tra mở modal, hiển thị đủ khung giờ, chọn khung giờ trống và khôi phục menu đang ẩn.

## Tiêu chí nghiệm thu

- Người dùng thấy rõ khu vực “Danh sách thực đơn” và nút “Xem danh sách thực đơn”.
- Modal hiển thị đủ 4 khung giờ, kể cả khung giờ chưa có menu.
- Menu đang ẩn vẫn xuất hiện và có thao tác hiển thị lại.
- Chọn menu hoặc khung giờ cập nhật bộ lọc món như trước.
- Các thao tác theo quyền vẫn dùng callback hiện có, không tạo luồng GraphQL mới.
- Không thay đổi backend hoặc GraphQL contract.

## Validation

- `npm run check:conflicts`
- `vitest run src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`
- `npm run build`
- Browser smoke trên trang `/manager#menu`, gồm desktop và mobile.

## Ngoài phạm vi

- Không tạo route quản lý menu mới.
- Không thay đổi schema, resolver hoặc dữ liệu menu.
- Không thiết kế lại danh mục món hoặc nhóm thực đơn.
