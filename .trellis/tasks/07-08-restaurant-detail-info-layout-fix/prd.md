# Sắp xếp lại phần thông tin chi tiết nhà hàng

## Hiện trạng và root cause

Ảnh thực tế cho thấy tab Thông tin có ba vấn đề độc lập nhưng cùng nằm ở lớp trình bày:

- `normalizeAmenities` chỉ ánh xạ nhãn khi `amenities` là object; khi API trả mảng, các mã nội bộ như `wifi`, `parking`, `card` bị hiển thị thẳng cho khách.
- Lưới hai cột dùng mặc định `align-items: stretch`, khiến thẻ ngắn bị kéo cao bằng thẻ dài cùng hàng; khối chính sách chỉ chiếm một cột nên phần dưới trang mất cân đối.
- Sidebar vừa `position: sticky` vừa có `max-height` và `overflow-y: auto`, tạo thanh cuộn lồng nhau. Khi sidebar giữ vị trí cuộn riêng, khối “Đặt bàn giữ chỗ” có thể bị cắt như ảnh báo lỗi.

## Luồng đã trace

`cohan-restaurant-backend/models/restaurant.model.js` lưu tiện ích, giờ hoạt động, liên hệ và chính sách → `cohan-restaurant-backend/graphql/schema/restaurant.graphql` công khai các trường → `publicRestaurant` giữ điều kiện nhà hàng được xuất bản → `RestaurantDetail.jsx` lấy dữ liệu bằng Apollo → `RestaurantInfo.jsx` chuẩn hóa nội dung → SCSS bố trí thẻ thông tin và sidebar.

Schema, resolver, quyền và phạm vi nhà hàng đang đúng; không cần thay đổi backend.

## Phạm vi thay đổi

- Chuẩn hóa mã tiện ích từ mảng bằng bảng nhãn hiện có.
- Giữ mỗi thẻ theo chiều cao nội dung thay vì kéo giãn theo hàng.
- Cho khối chính sách dùng toàn bộ chiều ngang và chia hai cột gọn trên desktop, một cột trên mobile.
- Bỏ vùng cuộn riêng của sidebar để trang dùng một luồng cuộn duy nhất.
- Bổ sung kiểm tra nguồn tối thiểu cho các quy tắc trên.

## Tiêu chí chấp nhận

1. `wifi`, `parking`, `card` hiển thị lần lượt là `Wi‑Fi`, `Bãi đỗ xe`, `Thanh toán thẻ` khi dữ liệu là mảng.
2. Thẻ ngắn không còn khoảng trắng lớn bên trong do bị kéo cao theo thẻ bên cạnh.
3. Khối “Chính sách trước khi đặt” cân đối trên toàn chiều ngang nội dung.
4. Sidebar không còn thanh cuộn riêng và không cắt khối đặt bàn.
5. Mobile vẫn là một cột, không tràn ngang và không thay đổi hành động đặt bàn/AI.
6. Không thay đổi GraphQL, quyền, restaurant scoping hoặc dữ liệu nghiệp vụ.

## Ngoài phạm vi

- Không đổi model, schema, resolver hoặc thuật toán giờ hoạt động.
- Không thêm thư viện hoặc abstraction mới.
- Không thiết kế lại hero, thực đơn, đánh giá hay danh sách nhà hàng tương tự.
