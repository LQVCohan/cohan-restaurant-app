# Sửa lỗi hiển thị và thêm bản đồ vị trí nhà hàng

## Hiện trạng

Sau lần nâng cấp giao diện, một số control Ant Design bị giảm tương phản hoặc bị CSS áp dụng lồng nhau:

- giá trị đã chọn trong Select gần như không đọc được;
- Input có prefix như trường website xuất hiện hai lớp viền;
- khung giờ thực đơn bị cắt chữ;
- nhóm nhận đơn từ xa thiếu hierarchy, công tắc và mô tả chưa cân hàng;
- các Select trong cài đặt thanh toán bị mờ và các cột dễ chồng nhãn;
- khung xem trước chiếm nhiều chiều cao;
- vĩ độ và kinh độ vẫn là hai ô số kỹ thuật, khó thao tác.

## Nguyên nhân gốc

Lớp `RestaurantInfoPremiumLayout.css` đang style cả wrapper và input con của Ant Design, đồng thời dùng bố cục phụ thuộc thứ tự phần tử. Tọa độ đã có đầy đủ trong schema và mutation nhưng UI chưa dùng bản đồ tương tác.

## Luồng đã kiểm tra

`restaurant.model.js` lưu `address.lat/lng` -> `restaurant.graphql` khai báo `Address` và `AddressInput` -> resolver chuẩn hóa cặp tọa độ -> `GET_RESTAURANT_DETAIL` nạp vào input có nhãn `Vĩ độ/Kinh độ` -> `onSaveRestaurantInfo` gửi lại `UpdateRestaurantInput.address`.

Trang Home đã dùng Leaflet/OpenStreetMap với marker kéo được. Repo đã có `leaflet` và `react-leaflet`, vì vậy không thêm dependency.

## Hướng sửa

- Thu gọn và sửa lớp CSS hiện tại thay vì tiếp tục chồng nhiều theme mới.
- Giữ control gốc của Ant Design và tăng tương phản cho selected/disabled states.
- Loại bỏ border khỏi input con nằm trong `ant-input-affix-wrapper`.
- Căn lại nhóm nhận đơn, menu slot và payment provider bằng CSS Grid.
- Thêm enhancement theo pattern sẵn có của repo: tìm hai input tọa độ, render bản đồ Leaflet ngay dưới nhóm địa chỉ, đồng bộ marker với controlled input bằng native setter + input/change event.
- Giữ hai input làm nguồn dữ liệu thật nhưng chuyển chúng thành thông tin phụ; không thay đổi payload hoặc resolver.

## Tiêu chí nghiệm thu

- Tất cả Select đọc rõ giá trị hiện tại ở trạng thái thường, focus và disabled.
- Website chỉ có một viền control.
- `Bữa trưa`, `MoMo`, `Kiểm thử` không bị cắt hoặc mờ.
- Hai chính sách nhận đơn có tiêu đề, mô tả và công tắc thẳng hàng.
- Bản đồ hiển thị vị trí đã lưu, cho phép click hoặc kéo marker để cập nhật tọa độ.
- Nút lấy vị trí hiện tại tiếp tục cập nhật bản đồ qua chính input hiện có.
- Preview gọn hơn nhưng vẫn đủ chiều cao để kiểm tra giao diện khách hàng.
- Không thay schema, resolver, quyền hoặc mutation payload.

## Kiểm tra dự kiến

- `npm run check:conflicts`
- `vitest run src/utils/installRestaurantInfoMapEnhancement.test.js`
- `npm run build`
- Browser smoke desktop, 430x932 và 390x844
