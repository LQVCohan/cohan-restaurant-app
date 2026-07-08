# Hoàn thiện trải nghiệm trang chi tiết nhà hàng

## Hiện trạng và root cause

Trang chi tiết đã có hero, thực đơn, đánh giá, khuyến mãi, ảnh và đặt bàn, nhưng hợp đồng `GetPublicRestaurant` chỉ lấy một phần nhỏ dữ liệu mà `Restaurant` đã công khai. Vì vậy khách chưa thấy khoảng giá, lịch mở cửa chi tiết, loại hình phục vụ, sức chứa và điều kiện đặt bàn trước khi tương tác.

Ngoài ra:

- ảnh bìa và ảnh món thiếu dữ liệu đang được thay bằng ảnh Unsplash không thuộc nhà hàng;
- quyền xem chi tiết món bị gắn chung với quyền đặt món;
- dữ liệu `customerInfo` đã lưu trong `notesOnAmenities` nhưng phần lớn chưa xuất hiện ở trang khách hàng;
- nút không gian/360 xuất hiện chỉ dựa vào `restaurant.id`;
- một số nút ảnh và đánh giá đang hiển thị nhưng không có hành động.

## Luồng đã trace

`models/restaurant.model.js` chứa dữ liệu hồ sơ và chính sách → `graphql/schema/restaurant.graphql` công khai các trường → `publicRestaurant` dùng `buildPublicRestaurantFilter` để giữ phạm vi nhà hàng đang xuất bản → `RestaurantDetail.jsx` lấy dữ liệu bằng Apollo → `RestaurantInfo`, `MenuSection`, `PhotoGallery`, `ReviewsSection` hiển thị và xử lý hành động.

Không cần đổi model, schema hoặc resolver vì các trường cần thiết đã tồn tại và resolver công khai đã giữ đúng điều kiện xuất bản.

## Phạm vi thay đổi

- Mở rộng query cha để lấy đủ dữ liệu ra quyết định trước tương tác.
- Dùng trạng thái hình ảnh trung tính thay cho ảnh nhà hàng/món ăn giả định.
- Hiển thị thông tin cần biết: khoảng giá, giờ hoạt động, loại hình phục vụ, sức chứa, liên hệ, bãi xe, trang phục, đối tượng phù hợp, FAQ và chính sách đặt bàn.
- Chỉ hiện liên kết không gian/360 khi có dữ liệu thật.
- Cho phép xem chi tiết món khi không thể đặt; chỉ khóa hành động mua.
- Loại bỏ hoặc hoàn thiện các nút không có hành động.
- Giữ nguyên quyền, restaurant scoping, preview mode, favorite, recent history, đặt bàn và đặt món hiện có.

## Tiêu chí chấp nhận

1. Hero cho khách thấy trạng thái mở cửa, khoảng giá, khu vực và loại hình phục vụ mà không lặp lại số đánh giá.
2. Không dùng ảnh Unsplash hoặc ảnh ngẫu nhiên để giả làm ảnh thật của nhà hàng/món ăn.
3. Tab Thông tin hiển thị dữ liệu có sẵn một cách có điều kiện và không tạo nội dung giả khi thiếu dữ liệu.
4. Lịch mở cửa tuần, giờ đặc biệt và thời điểm mở tiếp theo được trình bày khi có dữ liệu.
5. Tiền cọc, phí đổi giờ/đổi bàn, VAT và phí phục vụ chỉ xuất hiện khi có giá trị phù hợp.
6. Liên kết không gian bàn/360 chỉ xuất hiện khi có ảnh không gian, VR hoặc dữ liệu sơ đồ.
7. Món vẫn mở được trang chi tiết khi nhà hàng đóng cửa hoặc tạm dừng nhận đơn; nút mua vẫn bị khóa đúng trạng thái.
8. Không còn nút “Xem tất cả”, “Chia sẻ ảnh” hoặc “Bình luận đánh giá” không có hành động.
9. Các trạng thái loading, empty, error, keyboard focus và mobile action bar hiện có không bị phá vỡ.
10. Có kiểm tra tự động tối thiểu cho hợp đồng query và các hành vi UX quan trọng.

## Ngoài phạm vi

- Không thêm trường cơ sở dữ liệu mới.
- Không thay đổi thuật toán availability, giá, khuyến mãi hoặc đặt bàn.
- Không thêm thư viện.
- Không tạo hệ thống bình luận đánh giá mới.
- Không tự sinh dữ liệu hồ sơ còn thiếu cho nhà hàng.
