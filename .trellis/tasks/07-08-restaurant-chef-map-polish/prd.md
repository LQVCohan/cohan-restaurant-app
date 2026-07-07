# Sửa marker định vị và hoàn thiện bếp trưởng thương hiệu

## Hiện trạng và nguyên nhân

- Marker Leaflet phụ thuộc ảnh mặc định nên có thể hiện biểu tượng lỗi hoặc mất ghim khi asset bị xử lý khác trong Vite/CSS.
- Khu vực “Bếp trưởng điều hành” chỉ là input ghép nút, chưa có phân cấp thị giác và chưa giải thích dữ liệu nào xuất hiện ở trang khách hàng.
- Tên bếp trưởng đã được lưu trong JSON `Restaurant.notesOnAmenities`, nhưng trang chi tiết công khai chưa truy vấn và chưa hiển thị dữ liệu này.

## Luồng đã trace

`Restaurant.address.lat/lng + notesOnAmenities` → GraphQL `Restaurant` / `publicRestaurant` → resolver giữ kiểm tra trạng thái công khai → màn quản lý lưu hồ sơ → `RestaurantInfo` truy vấn phần hồ sơ công khai → thẻ bếp trưởng trên trang khách hàng.

## Thay đổi tối thiểu

- Dùng `L.divIcon` có class riêng thay cho PNG marker mặc định; vẫn giữ click bản đồ, kéo ghim và đồng bộ input tọa độ.
- Giữ nguyên schema, resolver, mutation và cấu trúc JSON hiện có; dữ liệu cũ chỉ có khóa `chef` vẫn hoạt động.
- Cân lại khu vực chọn bếp trưởng bằng CSS scoped, thêm mô tả rõ dữ liệu sẽ được công khai.
- Trang khách hàng hiển thị thẻ bếp trưởng khi có tên: tên, chức danh mặc định “Bếp trưởng điều hành” và mô tả theo phong cách ẩm thực của nhà hàng. Nếu JSON có `chefTitle` hoặc `chefBio`, giao diện ưu tiên dùng các giá trị đó.
- Truy vấn bổ sung chỉ chạy ở tab Thông tin và dùng `cache-first` để lấy `notesOnAmenities`, `openingHours`, `amenities` còn thiếu từ truy vấn cha.

## Không thay đổi

- Không đổi quyền hoặc phạm vi nhà hàng.
- Không đổi model MongoDB, GraphQL schema hoặc resolver.
- Không thêm thư viện.
- Không tạo hồ sơ nhân sự mới hoặc công khai dữ liệu cá nhân ngoài tên bếp trưởng đã được quản lý cấu hình.

## Kiểm tra dự kiến

- `npm run check:conflicts`
- `npx vitest run src/utils/installRestaurantInfoMapEnhancement.test.js`
- `npm run build`
- Smoke trang quản lý nhà hàng và trang chi tiết công khai ở desktop/mobile.
