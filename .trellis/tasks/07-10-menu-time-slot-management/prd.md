# PRD — Hiển thị quản lý thực đơn theo từng khung giờ

## Hiện trạng

- Trang quản lý đã có `CompactMenuStrip`, nhưng chỉ render các menu query trả về và trình bày theo dải cuộn ngang.
- Query `menus(restaurantId)` đang luôn lọc `isActive: true`; menu vừa bị quản lý ẩn sẽ biến mất khỏi danh sách và không thể bật lại từ UI.
- Khung giờ chưa có menu không được biểu diễn riêng, khiến người dùng khó biết bữa sáng/trưa/tối/khuya đang thiếu menu nào.

## Luồng thật

`Menu model/timeSlot unique index → menu.graphql → MenuQuery.menus → useMenuManagement/Q_MENUS → MenuManagement → CompactMenuStrip → chọn/tạo/sửa/ẩn/hiện menu → danh sách món theo selectedTimeSlot`.

## Nguyên nhân gốc

1. Contract query dùng chung cho khách và quản lý không có cờ phân biệt nhu cầu lấy menu đang ẩn.
2. UI dựng danh sách từ các bản ghi hiện có thay vì dựng bốn khung giờ cố định rồi ghép menu vào từng khung giờ.

## Hướng thiết kế

Bảng điều phối 4 khung giờ cố định theo ngôn ngữ sage/neutral hiện có: mỗi ô cho biết đã có/chưa có menu, trạng thái hiển thị, số món và hành động quản lý; không dùng cuộn ngang hoặc hành động chỉ xuất hiện khi hover.

## Phạm vi

- Thêm `includeInactive` tùy chọn cho query `menus`; mặc định `false` để giữ nguyên public browsing.
- Khi `includeInactive: true`, resolver yêu cầu quyền đọc menu trong đúng nhà hàng.
- `useMenuManagement` nhận `includeInactiveMenus`, đồng bộ biến query trong Apollo cache.
- Trang quản lý bật tùy chọn này.
- `CompactMenuStrip` luôn hiển thị bốn khung giờ: sáng, trưa, tối, khuya.
- Khung giờ chưa có menu hiển thị trạng thái trống và nút tạo menu đúng khung giờ.
- Menu đang ẩn vẫn hiện với trạng thái rõ ràng và nút bật lại.
- Responsive: 4 cột desktop, 2 cột tablet, 1 cột mobile; thao tác luôn nhìn thấy và có focus rõ.

## File thay đổi

- `cohan-restaurant-backend/graphql/schema/menu.graphql`: mở rộng query contract.
- `cohan-restaurant-backend/graphql/resolvers/menu/query.js`: phân tách public/manager bằng permission hiện có.
- `cohan-restaurant-backend/tests/resolvers/menu-manager-list-visibility.test.js`: khóa hành vi public và manager.
- `src/hooks/useMenuManagement.js`: thêm option và cache variables đồng nhất.
- `src/components/Dashboard_Manager/Menu/MenuManagement.jsx`: bật manager query và mở modal theo slot.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.jsx`: render 4 slot cố định.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStripPolish.scss`: layout, responsive, focus và reduced motion.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`: kiểm tra đủ slot và thao tác tạo đúng slot.

## Tiêu chí nghiệm thu

- Mở trang quản lý luôn thấy bốn khu vực Bữa sáng, Bữa trưa, Bữa tối, Bữa khuya.
- Slot chưa có menu có nút tạo đúng slot.
- Menu bị ẩn vẫn xuất hiện trong quản lý và có thể bật lại.
- Người chưa có quyền không thể dùng `includeInactive` để đọc menu ẩn.
- Public query không truyền cờ vẫn chỉ trả menu đang hoạt động.
- Không thay đổi unique constraint một menu trên mỗi `(restaurantId, timeSlot)`.
- Không thay đổi dữ liệu món, recipe, tồn kho, audit hoặc quyền mutation.

## Ngoài phạm vi

- Không cho phép nhiều menu trong cùng một khung giờ.
- Không thay đổi mô hình `CategoryMenu`/nhóm thực đơn trong task này.
- Không thiết kế lại danh sách món hoặc modal món ăn.

## Validation

- `npm run check:graphql`
- `npx vitest run cohan-restaurant-backend/tests/resolvers/menu-manager-list-visibility.test.js`
- `npx vitest run src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`
- `npm run build`
- Browser smoke tại 375, 768, 1024 và 1440 px.
