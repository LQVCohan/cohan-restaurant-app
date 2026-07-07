# Sửa marker định vị và hoàn thiện hồ sơ bếp trưởng thương hiệu

## Hiện trạng

- Bản đồ đã được chèn bằng Leaflet nhưng marker đang phụ thuộc ảnh mặc định của thư viện, dễ mất biểu tượng khi đường dẫn asset hoặc CSS toàn cục thay đổi.
- Trường `Bếp trưởng điều hành` chỉ là một input ghép nút, bố cục thiếu phân cấp và chưa cho quản lý mô tả vai trò hoặc dấu ấn ẩm thực.
- Dữ liệu bếp trưởng được đóng gói trong `Restaurant.notesOnAmenities`, nhưng truy vấn quản lý chưa lấy trường này sau khi tải lại.
- Trang chi tiết nhà hàng công khai chưa truy vấn hoặc hiển thị thông tin bếp trưởng.

## Nguyên nhân gốc

- Marker dùng `L.Icon.Default` và các file PNG của Leaflet thay vì marker thuộc phạm vi giao diện COHAN.
- Hợp đồng dữ liệu giữa mutation, manager query và public query chưa đồng bộ trường `notesOnAmenities`.
- Component thông tin công khai chưa đọc phần hồ sơ khách hàng đã được quản lý lưu.

## Luồng đã kiểm tra

`restaurant.model.js (notesOnAmenities, address.lat/lng)` → `restaurant.graphql` → `restaurant query/mutation + permission/scope guards` → `RestaurantInfoManagement` → `UpdateRestaurantInput` → `publicRestaurant` → `RestaurantDetail` → `RestaurantInfo`.

## Hướng sửa tối thiểu

- Dùng `L.divIcon` có class riêng và CSS scoped để marker không phụ thuộc ảnh mặc định.
- Giữ cấu trúc JSON hiện có, bổ sung các khóa tương thích ngược: `chefTitle`, `chefBio`, `chefStaffId`; không đổi schema hoặc resolver.
- Bổ sung `notesOnAmenities` vào query/mutation return của màn quản lý và query công khai.
- Cân lại editor bếp trưởng thành một khối rõ ràng gồm tên, chức danh, giới thiệu ngắn và nút chọn nhân viên.
- Trang khách hàng chỉ hiển thị thẻ bếp trưởng khi có tên; dữ liệu cũ dạng chỉ có `chef` vẫn hoạt động.

## Tiêu chí nghiệm thu

- Marker nhà hàng luôn hiển thị rõ, kéo được và click bản đồ vẫn cập nhật tọa độ.
- Nút lấy vị trí dùng biểu tượng đúng ngữ nghĩa và không bị lệch.
- Thông tin bếp trưởng không mất sau khi lưu/refetch.
- Chọn nhân viên tự điền tên, chức danh và mã nhân viên; vẫn cho nhập thủ công.
- Trang công khai hiển thị tên, chức danh và giới thiệu bếp trưởng khi đã cấu hình; không tạo khung rỗng khi chưa có dữ liệu.
- Không thay quyền, phạm vi nhà hàng, schema MongoDB hoặc payload nghiệp vụ khác.

## Ngoài phạm vi

- Ảnh chân dung bếp trưởng riêng.
- Hồ sơ nghề nghiệp nhiều bếp trưởng hoặc lịch sử thay đổi.
- Migration dữ liệu MongoDB.

## Kiểm tra dự kiến

- `npm run check:conflicts`
- `npx vitest run src/utils/installRestaurantInfoMapEnhancement.test.js`
- `npm run build`
- Smoke giao diện quản lý và trang chi tiết công khai.
