# PRD — Tổ chức lại trang thông tin nhà hàng

## Hiện trạng và nguyên nhân

- Trạng thái công khai đứng thành một card riêng phía trên trang, tạo cảm giác tách rời khỏi khu vực chọn chi nhánh và lưu thay đổi.
- Header, tóm tắt hồ sơ, tiến độ hoàn thiện và ba KPI dùng nhiều bề mặt độc lập, làm phần đầu trang dài và đẩy biểu mẫu xuống thấp.
- Vùng ảnh bìa dùng avatar định vị tuyệt đối cùng khoảng đệm lớn, tạo khoảng trắng trước các tab chỉnh sửa.
- Các cột form cố định và thanh tab cần ưu tiên bố cục rõ ràng hơn trên màn hình điện thoại.

Root cause là cách trình bày nhiều khối cùng cấp, không phải contract dữ liệu. DOM hiện có đã chứa đúng thông tin và hành động nên chỉ cần tổ chức lại bằng style theo route, không thêm component hoặc abstraction mới.

## Luồng thật

`Restaurant model` → `restaurant.graphql` → query/mutation và permission của restaurant → Apollo trong `RestaurantInfoManagement.jsx` và `RestaurantPublicationControl.jsx` → chọn chi nhánh, bật công khai, chỉnh hồ sơ, lưu, live preview.

`ManagerLayout.jsx` render `RestaurantPublicationControl` ngay trước `RestaurantInfoManagement`, cho phép hai khối được nối thành một command center mà không đổi GraphQL hoặc state.

## Hướng thiết kế

Compact command center dùng bề mặt sage hiện có: trạng thái công khai nối với header thao tác, tóm tắt–tiến độ–KPI thành một nhóm thông tin, vùng ảnh nối trực tiếp với tab chỉnh sửa và các chi tiết phụ thu gọn theo màn hình.

## Phạm vi

1. Biến thanh công khai thành status bar toàn chiều ngang, nối trực quan với header chọn chi nhánh và nút lưu.
2. Gom tóm tắt hồ sơ, checklist hoàn thiện và KPI thành một cụm phân cấp rõ ràng.
3. Giảm khoảng trống vùng ảnh bìa/avatar và đưa nội dung chỉnh sửa lên cao hơn.
4. Tổ chức lại responsive tại 1180, 900, 768 và 430 px; giữ target và focus hiện có.
5. Giữ nguyên query, mutation, permission, restaurant scoping, upload và live preview.

## Tiêu chí nghiệm thu

- Người quản lý nhìn thấy trạng thái công khai, chi nhánh đang sửa, trạng thái lưu và hành động chính trong cùng khu vực đầu trang.
- Không còn cảm giác năm card rời trước biểu mẫu; phần chỉnh sửa xuất hiện sớm hơn trong viewport.
- Tóm tắt, tiến độ và KPI vẫn đọc được nhưng không cạnh tranh với nút lưu.
- Ảnh bìa, avatar, tên nhà hàng và tab tạo thành một khối liên tục.
- Bố cục không tràn ngang tại 390×844 và 430×932; form chuyển một cột và tab cuộn ngang khi cần.
- Tất cả hành vi GraphQL, quyền, upload, lưu nháp, lưu thay đổi và preview giữ nguyên.

## Ngoài phạm vi

- Không đổi schema, resolver/service, quyền hoặc payload mutation.
- Không đổi JSX khi cấu trúc DOM hiện tại đã đủ cho bố cục mới.
- Không thêm dependency, font, icon set hoặc hệ màu mới.
