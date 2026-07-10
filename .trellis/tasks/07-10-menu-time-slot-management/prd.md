# PRD — Hiển thị quản lý thực đơn theo từng khung giờ

## Hiện trạng

- Trang quản lý đã có `CompactMenuStrip`, nhưng chỉ render các menu query trả về và trình bày theo dải cuộn ngang.
- Query `menus(restaurantId)` luôn lọc `isActive: true`; người có quyền quản lý vừa ẩn menu thì menu biến mất khỏi danh sách và không còn chỗ bật lại.
- Khung giờ chưa có menu không được biểu diễn riêng, khiến người dùng khó biết bữa sáng, trưa, tối và khuya đang thiếu menu nào.

## Luồng thật

`Menu model/timeSlot unique index → MenuQuery.menus → useMenuManagement/Q_MENUS → MenuManagement → CompactMenuStrip → chọn/sửa/ẩn/hiện menu → danh sách món theo selectedTimeSlot`.

## Nguyên nhân gốc

1. Resolver không phân biệt người chỉ đọc menu để bán hàng với người có quyền cập nhật menu.
2. UI dựng danh sách từ các bản ghi hiện có thay vì dựng bốn khung giờ cố định rồi ghép menu vào từng khung giờ.
3. Toolbar thao tác cũ phụ thuộc hover, nên khó nhận biết trên màn hình cảm ứng và dễ bị CSS cũ che mất.

## Hướng thiết kế

Bảng điều phối bốn khung giờ cố định theo ngôn ngữ sage/neutral hiện có: mỗi ô cho biết đã có hay chưa có menu, trạng thái hiển thị, số món và hành động quản lý. Không dùng cuộn ngang và không giấu thao tác sau hover.

## Phạm vi thực hiện

- Giữ nguyên GraphQL schema và Apollo hook hiện có.
- Resolver `menus` trả cả menu đang ẩn cho người có `menu.update` hoặc `menu.write` trong đúng nhà hàng.
- Người chỉ có `menu.read` và khách công khai vẫn chỉ nhận menu đang hoạt động.
- `CompactMenuStrip` luôn hiển thị bốn khung giờ: sáng, trưa, tối và khuya.
- Khung giờ chưa có menu hiển thị trạng thái trống và có thể được chọn trước khi mở biểu mẫu tạo menu hiện có.
- Menu đang ẩn vẫn hiện với trạng thái rõ ràng và nút bật lại.
- Responsive: bốn cột desktop, hai cột tablet, một cột mobile; thao tác luôn nhìn thấy, có focus rõ và hỗ trợ reduced motion.

## File thay đổi

- `cohan-restaurant-backend/graphql/resolvers/menu/query.js`: phân tách danh sách public/read-only và danh sách dành cho người quản lý menu.
- `cohan-restaurant-backend/tests/resolvers/menu-manager-list-visibility.test.js`: khóa hành vi menu manager, staff chỉ đọc và public.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.jsx`: render bốn slot cố định, trạng thái trống và menu đang ẩn.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStripPolish.scss`: layout, responsive, focus, reduced motion và thao tác luôn hiển thị.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`: kiểm tra đủ bốn slot, chọn slot trống và khôi phục menu đang ẩn.

## Tiêu chí nghiệm thu

- Mở trang quản lý luôn thấy bốn khu vực Bữa sáng, Bữa trưa, Bữa tối và Bữa khuya.
- Slot chưa có menu hiển thị rõ “Chưa có thực đơn”.
- Menu bị ẩn vẫn xuất hiện với người có quyền cập nhật menu và có thể bật lại.
- Nhân viên chỉ có `menu.read` không nhận menu đang ẩn trong POS hoặc luồng đọc thông thường.
- Public query vẫn chỉ trả menu đang hoạt động.
- Không thay đổi unique constraint một menu trên mỗi `(restaurantId, timeSlot)`.
- Không thay đổi dữ liệu món, recipe, tồn kho, audit hoặc quyền mutation.

## Ngoài phạm vi

- Không cho phép nhiều menu trong cùng một khung giờ.
- Không thay đổi mô hình `CategoryMenu`/nhóm thực đơn trong task này.
- Không thiết kế lại danh sách món hoặc modal món ăn.

## Validation

- `npx vitest run cohan-restaurant-backend/tests/resolvers/menu-manager-list-visibility.test.js`
- `npx vitest run src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`
- `npm run build`
- Browser smoke tại 375, 768, 1024 và 1440 px.
