# PRD — Nâng cấp sơ đồ bàn cho khách hàng

## Hiện trạng

- Sơ đồ đã có tầng, layout kiến trúc, trạng thái bàn, zoom, kéo bản đồ và khóa bàn khi khách chọn.
- Bàn đang render bằng `div`, không có vai trò điều khiển và không thuận tiện cho bàn phím.
- Pan chỉ dùng mouse events nên trải nghiệm cảm ứng không đầy đủ.
- Trang hiển thị hai bộ chú thích trạng thái bàn.
- `TableBooking.scss` và `TableBooking.product.css` chồng nhiều override; thiết kế hiện giống dashboard hơn trải nghiệm chọn chỗ.

## Luồng thật

`Floor/Table Mongoose schema` → `publicFloors/publicTables` resolver kiểm tra nhà hàng active + published + có thể xem → `useFloorManagement` public queries → `TableBooking` → `FloorMap` → chọn bàn → `acquireTableViewLock` → mở form đặt bàn.

## Phạm vi

1. Thiết kế lại phần đầu trang, bộ chọn tầng, viewport và panel tóm tắt theo hướng boutique restaurant seating map.
2. Hiển thị số bàn trống, tổng bàn và thông tin tầng từ dữ liệu sẵn có.
3. Chuyển thao tác pan sang Pointer Events để dùng được với chuột, bút và cảm ứng.
4. Làm bàn có thể focus và chọn bằng bàn phím; giữ hành vi mở nhắc nhở với bàn không trống.
5. Chỉ giữ một bộ chú thích trạng thái.
6. Cải thiện popup ảnh/360/3D, focus, reduced motion và responsive.

## Tiêu chí nghiệm thu

- Không đổi query, mutation, khóa bàn hoặc hợp đồng backend.
- Bàn có accessible name, focus ring và kích hoạt bằng Enter/Space.
- Kéo sơ đồ hoạt động qua Pointer Events.
- Không còn hai chú thích trạng thái trùng nhau.
- Số bàn trống và tổng bàn phản ánh đúng dữ liệu tầng hiện tại.
- Giao diện dùng được ở desktop, 430×932 và 390×844.
- Không thêm dependency.

## Ngoài phạm vi

- Không đổi Floor/Table schema, resolver, restaurant availability hoặc booking mutation.
- Không thêm WebGL, thư viện 3D, thư viện gesture hoặc animation.
- Không thay đổi dữ liệu layout do trang quản lý tạo ra.
