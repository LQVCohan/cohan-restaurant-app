# Sắp xếp lại phần thông tin chi tiết nhà hàng

## Hiện trạng và root cause

Ảnh thực tế cho thấy tab Thông tin có các vấn đề cùng nằm ở lớp trình bày:

- `normalizeAmenities` chỉ ánh xạ nhãn khi `amenities` là object; khi API trả mảng, các mã nội bộ như `wifi`, `parking`, `card` bị hiển thị thẳng cho khách.
- Lưới hai cột dùng mặc định `align-items: stretch`, khiến thẻ ngắn bị kéo cao bằng thẻ dài cùng hàng; khối chính sách chỉ chiếm một cột nên phần dưới trang mất cân đối.
- Sidebar vừa `position: sticky` vừa có `max-height` và `overflow-y: auto`, tạo thanh cuộn lồng nhau và có thể cắt khối đặt bàn.
- Khi `avatar` và `coverImage` trống, `RestaurantDetail.jsx` chuyển sang nền gradient, tiêu đề fallback lớn và logo chữ. Các lớp `RestaurantDetail.fallbacks.scss` và `RestaurantDetail.complete.scss` tiếp tục phóng đại trạng thái này, tạo vùng hero xám rộng, nội dung rời rạc và avatar trông như ô giữ chỗ kỹ thuật.

## Luồng đã trace

`cohan-restaurant-backend/models/restaurant.model.js` lưu hồ sơ và ảnh → `cohan-restaurant-backend/graphql/schema/restaurant.graphql` công khai các trường → `publicRestaurant` giữ điều kiện nhà hàng được xuất bản → `RestaurantDetail.jsx` lấy dữ liệu bằng Apollo và chọn ảnh thật hoặc fallback → `RestaurantInfo.jsx` chuẩn hóa nội dung → SCSS bố trí hero, thẻ thông tin và sidebar.

Schema, resolver, quyền và phạm vi nhà hàng đang đúng; không cần thay đổi backend.

## Phạm vi thay đổi

- Chuẩn hóa mã tiện ích từ mảng bằng bảng nhãn hiện có.
- Giữ mỗi thẻ theo chiều cao nội dung thay vì kéo giãn theo hàng.
- Cho khối chính sách dùng toàn bộ chiều ngang và chia hai cột gọn trên desktop, một cột trên mobile.
- Bỏ vùng cuộn riêng của sidebar để trang dùng một luồng cuộn duy nhất.
- Khi thiếu ảnh thật, dùng một ảnh bìa trực tuyến tạm và avatar tạo theo tên nhà hàng; đánh dấu rõ ảnh bìa là ảnh minh họa.
- Bỏ phần chữ fallback lớn và các quy tắc CSS cũ không còn được render.
- Bổ sung kiểm tra nguồn tối thiểu cho các quy tắc trên.

## Tiêu chí chấp nhận

1. `wifi`, `parking`, `card` hiển thị lần lượt là `Wi‑Fi`, `Bãi đỗ xe`, `Thanh toán thẻ` khi dữ liệu là mảng.
2. Thẻ ngắn không còn khoảng trắng lớn bên trong do bị kéo cao theo thẻ bên cạnh.
3. Khối “Chính sách trước khi đặt” cân đối trên toàn chiều ngang nội dung.
4. Sidebar không còn thanh cuộn riêng và không cắt khối đặt bàn.
5. Nhà hàng thiếu ảnh vẫn có cover và avatar dễ nhìn; cover tạm được ghi “Ảnh minh họa”.
6. Không còn tiêu đề “Ẩm thực đang cập nhật” nổi lớn trên nền gradient fallback.
7. Ảnh thật từ hồ sơ nhà hàng luôn được ưu tiên hơn ảnh tạm.
8. Mobile vẫn là một cột, không tràn ngang và không thay đổi hành động đặt bàn/AI.
9. Không thay đổi GraphQL, quyền, restaurant scoping hoặc dữ liệu nghiệp vụ.

## Ngoài phạm vi

- Không đổi model, schema, resolver hoặc thuật toán giờ hoạt động.
- Không thêm thư viện hoặc abstraction mới.
- Không thay đổi thực đơn, đánh giá, khuyến mãi hay danh sách nhà hàng tương tự.
- Ảnh trực tuyến chỉ là fallback tạm; nhà hàng tải ảnh thật sẽ thay thế tự động.
