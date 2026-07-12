# Tối ưu hàng đợi đơn món và đặt bàn

## Hiện trạng và nguyên nhân gốc

- `DashboardActionQueue` luôn render hai section đơn món và đặt bàn, kể cả khi một section không có dữ liệu.
- CSS chia cố định hai cột nên section rỗng vẫn chiếm nhiều diện tích, trong khi danh sách có dữ liệu bị thu hẹp.
- Tổng số yêu cầu ở header và số lượng ở từng section lặp lại nhưng chưa cho người quản lý thấy nhanh loại yêu cầu nào đang chờ.
- Thông tin tiền, thời gian và nội dung món đang xếp thành các dòng chữ giống nhau nên khó quét khi có nhiều yêu cầu.

## Luồng thật đã kiểm tra

`Order`/`Reservation` model → `managerDashboard` resolver lọc theo `restaurantId` và trạng thái chờ → `GET_MANAGER_DASHBOARD` trong `useDashboard` → `Dashboard` truyền dữ liệu và action từ `useDashboardActionQueue` → `DashboardActionQueue` render và gọi mutation xác nhận/từ chối.

Schema, resolver, permission, restaurant scope và mutation hiện đúng. Thay đổi chỉ nằm ở presentation layer.

## Hướng thiết kế

Compact adaptive operations queue: header hiển thị số đơn món và đặt bàn riêng, chỉ render section có dữ liệu, card ưu tiên mã yêu cầu và thời gian chờ, các fact tiền/thời gian rõ hơn, hành động giữ cùng một hàng trên desktop và xếp gọn trên mobile.

## File thay đổi

- `src/components/Dashboard_Manager/Dashboard/components/DashboardActionQueue/DashboardActionQueue.jsx`: bỏ section rỗng, rút gọn copy và thêm class semantic cho thông tin.
- `src/components/Dashboard_Manager/Dashboard/components/DashboardActionQueue/DashboardActionQueuePolish.scss`: layout một/hai section thích ứng, hierarchy card và responsive.
- `src/components/Dashboard_Manager/Dashboard/Dashboard.test.jsx`: kiểm tra summary và section rỗng không còn render khi section còn lại có dữ liệu.

## Tiêu chí nghiệm thu

- Khi chỉ có đơn món hoặc chỉ có đặt bàn, danh sách dùng toàn bộ chiều rộng và không còn cột rỗng.
- Header cho biết riêng số đơn món và số đặt bàn đang chờ.
- Mã yêu cầu, tuổi hàng đợi, khách/bàn, tiền/thời gian và nội dung được phân cấp rõ.
- Các nút xác nhận, từ chối và mở trang chi tiết vẫn gọi đúng handler, giữ trạng thái disabled/loading.
- Không thay đổi GraphQL, permission, restaurant scoping hoặc nghiệp vụ xác nhận/hủy.
- Không tràn ngang tại 1440, 1024, 768, 430 và 390 px.

## Kiểm tra

- `vitest run src/components/Dashboard_Manager/Dashboard/Dashboard.test.jsx`
- `npm run build`
- Manual responsive audit tại 1440, 1024, 768, 430 và 390 px.
