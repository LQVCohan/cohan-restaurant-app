# Nâng cấp bố cục thông tin nhà hàng

## Hiện trạng

Phần `Thông tin cơ bản` đang đặt tên nhà hàng, trạng thái vận hành và hai công tắc nhận đơn trong cùng một hàng. Cột công tắc chứa nhiều mô tả dài nên bị dồn chữ, làm các trường còn lại nhỏ và khó quét. Các trường liên hệ, giới thiệu và bếp trưởng nằm nối tiếp nhau nhưng chưa có phân nhóm trực quan. Tab và vùng ảnh nhận diện cũng chưa tạo được cảm giác của một màn hình cấu hình cao cấp.

## Nguyên nhân gốc

Dữ liệu và luồng lưu đang đúng. Vấn đề nằm ở cấu trúc trình bày: một hàng lưới chịu quá nhiều loại nội dung có chiều cao khác nhau, trong khi lớp giao diện cuối hiện tại chưa phân cấp rõ phần nhận diện, vận hành, liên hệ và nội dung giới thiệu.

Luồng đã đối chiếu:

`Restaurant Mongoose model` -> `Restaurant/UpdateRestaurantInput GraphQL schema` -> `restaurant query/updateRestaurant resolver + permission/scope guards` -> `GET_RESTAURANT_DETAIL/UPDATE_RESTAURANT` -> form state và `onSaveRestaurantInfo` -> DOM hiện có -> lớp CSS cuối.

## Quyết định triển khai

Component đã có đầy đủ nhãn, trường nhập, trạng thái và hành vi. Việc viết lại JSX chỉ để tạo thêm wrapper sẽ làm diff lớn và tăng rủi ro. Vì vậy, thay đổi dùng một lớp CSS có phạm vi hẹp, được import sau lớp `RestaurantInfoUnifiedPage.css`, để tái bố cục DOM hiện có mà không thay đổi hợp đồng dữ liệu.

## Phạm vi sửa

- `RestaurantInfoPremiumLayout.css`: hoàn thiện ảnh nhận diện, tab dạng segmented, bố cục nhận diện và vận hành, chính sách nhận đơn, liên hệ, giới thiệu, bếp trưởng, control states, preview và responsive.
- `src/main.jsx`: nạp lớp giao diện mới ngay sau lớp giao diện nhà hàng hiện tại để thứ tự cascade rõ ràng.

## Tiêu chí nghiệm thu

- Tên và trạng thái nhà hàng nằm trong nhóm nhận diện dễ đọc.
- Chính sách nhận đơn không còn bị dồn chữ vào cột hẹp; mô tả và công tắc được căn theo từng hàng.
- Liên hệ, giới thiệu và bếp trưởng có bề mặt và khoảng cách rõ ràng.
- Tab, ảnh bìa/logo, trường nhập và nút phụ đồng nhất với palette sage của manager dashboard.
- Desktop giữ bố cục form + preview; màn hình nhỏ chuyển một cột và tab có thể cuộn ngang.
- Các switch, nút chọn bếp trưởng, AI rewrite và lưu thay đổi giữ nguyên hành vi.
- Không thay đổi schema, resolver, quyền, payload hoặc thêm dependency.

## Kiểm tra dự kiến

- `npm run check:conflicts`
- Targeted Vitest cho `RestaurantInfoManagement.test.jsx`
- `npm run build`
- Browser smoke ở desktop, 430x932 và 390x844

## Ngoài phạm vi

- Thay đổi dữ liệu nhà hàng hoặc GraphQL contract.
- Thay đổi giao diện trang chi tiết nhà hàng phía khách hàng.
- Viết lại toàn bộ component hoặc thêm design system mới.
