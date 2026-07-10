# PRD — Tối ưu danh sách bàn của Order nội bộ trên mobile

## Hiện trạng

Trang `StaffOrdering` truyền danh sách bàn và tầng vào `TableMap`. Trên điện thoại, bộ lọc tầng luôn chiếm chỗ và thẻ bàn còn nhiều khoảng dọc, làm phần chọn bàn dài hơn cần thiết.

## Luồng thật

1. `StaffOrdering` lấy `tables` theo `restaurantId` từ GraphQL và ánh xạ dữ liệu vận hành.
2. `StaffOrdering` truyền `tables`, `floors`, `selectedTable` và `onSelect` vào `TableMap`.
3. `TableMap` lọc bàn theo tầng ở client và phát sự kiện chọn bàn về `StaffOrdering`.
4. Thay đổi này chỉ sửa React/SCSS trình bày; không đổi schema, resolver, Apollo operation, restaurant scope, permission hoặc realtime.

## Nguyên nhân gốc

Bộ lọc tầng luôn mở trên màn hình hẹp, trạng thái bàn nằm thành một dòng riêng và hợp đồng kích thước thẻ chưa đủ chặt. Grid đã có media query hai cột nhưng nội dung thẻ vẫn có thể kéo giãn chiều cao.

## Phạm vi

- Dùng native `<details>` để bộ lọc tầng mặc định thu gọn trên mobile và luôn mở ở desktop.
- Giữ danh sách bàn ở grid hai cột trên màn hình nhỏ.
- Gom tên, trạng thái, sức chứa và khách liên kết vào thẻ ngắn hơn.
- Bổ sung test trực tiếp cho lọc tầng và cấu trúc thẻ.

## Tiêu chí nghiệm thu

- Trên mobile, bộ lọc tầng mặc định thu gọn và có thể mở bằng một chạm.
- Tên tầng đang chọn và số bàn của tầng vẫn nhìn thấy khi bộ lọc đóng.
- Danh sách bàn hiển thị hai cột tại 390×844 và 430×932, không tràn ngang.
- Thẻ bàn không có dòng trạng thái dư thừa, nội dung dài được ellipsis.
- Desktop giữ bố cục và bộ lọc tầng luôn nhìn thấy.
- Không thêm dependency hoặc thay đổi logic nghiệp vụ.

## Ngoài phạm vi

- Thay đổi query/mutation, trạng thái bàn hoặc hành động gọi món/thanh toán.
- Thiết kế lại panel thao tác nhanh, menu, giỏ hàng hoặc bottom navigation.
- Thay đổi component quản lý bàn của manager.

## Xác minh

- `npx vitest run src/components/Staff/components/TableMap.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Kiểm tra trực quan 390×844 và 430×932.
