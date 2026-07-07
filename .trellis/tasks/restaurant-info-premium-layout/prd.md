# Nâng cấp bố cục thông tin nhà hàng

## Hiện trạng

Phần `Thông tin cơ bản` đang đặt tên nhà hàng, trạng thái vận hành và hai công tắc nhận đơn trong cùng một hàng. Cột công tắc chứa nhiều mô tả dài nên bị dồn chữ, làm các trường còn lại nhỏ và khó quét. Các trường liên hệ, giới thiệu và bếp trưởng nằm nối tiếp nhau nhưng chưa có phân nhóm trực quan. Tab và vùng ảnh nhận diện cũng chưa tạo được cảm giác của một màn hình cấu hình cao cấp.

## Nguyên nhân gốc

Dữ liệu và luồng lưu đang đúng. Vấn đề nằm ở cấu trúc trình bày: một hàng lưới chịu quá nhiều loại nội dung có chiều cao khác nhau, trong khi lớp polish hiện tại chủ yếu đổi màu và kích thước control, chưa tạo hierarchy theo nhóm nghiệp vụ.

Luồng đã đối chiếu:

`Restaurant Mongoose model` -> `Restaurant/UpdateRestaurantInput GraphQL schema` -> `restaurant query/updateRestaurant resolver + permission/scope guards` -> `GET_RESTAURANT_DETAIL/UPDATE_RESTAURANT` -> form state và `onSaveRestaurantInfo` -> component tests.

## Phạm vi sửa

- `RestaurantInfoManagement.jsx`: chỉ tổ chức lại markup của tab `Thông tin cơ bản`; giữ nguyên state, query, mutation, validation, preview và payload.
- `RestaurantInfoManagementPolish.css`: tạo các section card, bố cục công tắc riêng, tab dạng segmented, ảnh nhận diện rõ hơn, input/focus đồng nhất và responsive.
- `RestaurantInfoManagement.test.jsx`: kiểm tra các nhóm thông tin mới vẫn hiển thị cùng các điều khiển nghiệp vụ hiện có.

## Tiêu chí nghiệm thu

- Tên và trạng thái nhà hàng nằm trong một nhóm nhận diện dễ đọc.
- Hai chính sách nhận đơn nằm trong hai card riêng, không còn dồn chữ vào cột hẹp.
- Liên hệ, giới thiệu và bếp trưởng có hierarchy rõ ràng.
- Tab, ảnh bìa/logo, trường nhập và nút phụ đồng nhất với palette sage của manager dashboard.
- Desktop giữ bố cục form + preview; dưới 1100px chuyển một cột; 430x932 và 390x844 không tràn ngang.
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
