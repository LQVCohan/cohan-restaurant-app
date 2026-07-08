# Thiết kế thay đổi

## Nguyên tắc

- Giữ nguyên React, Apollo và SCSS hiện tại.
- Mở rộng hợp đồng query ở component cha thay vì tạo thêm query con.
- Chỉ hiển thị dữ liệu có thật; không dùng ảnh hoặc nội dung giả để lấp chỗ trống.
- Tách rõ “được xem” và “được mua/đặt”.
- Ưu tiên thông tin ra quyết định trước AI và nội dung phụ.

## Dữ liệu

`GET_PUBLIC_RESTAURANT` bổ sung các trường đã có trong schema:

- `email`, `priceRange`, `seatingCapacity`, `openingHours`, `closingHours`, `notesOnHours`;
- `weeklyOpeningHours`, `specialHours`, `nextOpeningTime`;
- `amenities`, `notesOnAmenities`, `vrTourUrl`;
- `canTableOrder`, `canDelivery`, `canPickup`;
- `reservationPolicy`, `reservationSettings`.

`RestaurantInfo` nhận toàn bộ dữ liệu từ component cha và bỏ query lặp `GET_PUBLIC_RESTAURANT_PROFILE`.

## Trình bày

### Hero

Các chip tóm tắt ưu tiên:

1. khoảng giá;
2. khu vực;
3. loại hình phục vụ đang bật.

Không lặp lại số đánh giá vì đã có cạnh điểm sao.

### Hình ảnh

Khi thiếu ảnh bìa hoặc ảnh món:

- dùng nền/khối chữ thương hiệu trung tính;
- ghi rõ ảnh đang được cập nhật;
- không gọi ảnh ngoài không thuộc nhà hàng.

### Thông tin

`notesOnAmenities` tiếp tục là JSON tương thích ngược. UI đọc các khóa đã có: `story`, `chef`, `chefTitle`, `chefBio`, `dressCode`, `website`, `parkingDetail`, `extraAmenities`, `suitableFor`, `faqs`.

Các nhóm nội dung chỉ render khi có dữ liệu. Giá trị tiền dùng định dạng VND; VAT dùng phần trăm; giờ tuần dùng tên ngày tiếng Việt.

### Không gian bàn

Liên kết chỉ xuất hiện khi có `vrTourUrl`, `spaceImages` hoặc chỉ báo dữ liệu sơ đồ do query cha cung cấp. Với phạm vi hiện tại, `spaceImages`/`vrTourUrl` là tín hiệu công khai tối thiểu; không thêm query tầng/bàn vào tab thông tin.

### Thực đơn

Thẻ món luôn có thể mở chi tiết nếu món được hiển thị. `orderable` chỉ điều khiển nút mua và trạng thái aria, không điều khiển navigation.

### Nút không hoạt động

- Bỏ nút “Xem tất cả ảnh” vì toàn bộ ảnh đã hiển thị trong grid/lightbox.
- Dùng Web Share/clipboard cho chia sẻ ảnh.
- Bỏ nút bình luận đánh giá vì hệ thống chưa có luồng bình luận công khai.

## Responsive và accessibility

- Giữ mobile action bar hiện có.
- Các link ngoài có `rel="noreferrer"`.
- Nút chia sẻ có nhãn truy cập và phản hồi trạng thái ngắn.
- Không dùng CSS zoom hoặc thêm dependency.
