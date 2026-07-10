# PRD — Hiển thị rõ danh sách thực đơn trên trang quản lý

## Hiện trạng

- Dữ liệu menu đã được tải qua `useMenuManagement` và đã có component `CompactMenuStrip` hỗ trợ chọn, tạo, sửa, ẩn/hiện, sao chép và xóa menu.
- Khu vực này hiện được đặt sau các KPI, dùng tiêu đề thiên về thống kê “Thực đơn theo khung giờ” và có thể thu gọn, nên người dùng dễ hiểu đây chỉ là dải thống kê thay vì nơi quản lý các menu của nhà hàng.

## Luồng thật

`Menu` schema/resolver → `menus(restaurantId)` → `useMenuManagement` → `MenuManagement.jsx` → `CompactMenuStrip.jsx` → thao tác tạo/sửa/ẩn/hiện/sao chép/xóa.

Không có sai lệch dữ liệu hoặc quyền. Vấn đề nằm ở thứ tự và cách trình bày trên giao diện.

## Nguyên nhân gốc

Chức năng quản lý menu đã tồn tại nhưng bị giảm độ ưu tiên thị giác: nằm sau KPI, có khả năng thu gọn và dùng copy chưa nói rõ đây là danh sách menu của nhà hàng.

## Phạm vi

- Đưa khu vực danh sách menu lên ngay dưới header trang quản lý thực đơn.
- Giữ khu vực này luôn mở trên trang quản lý thực đơn.
- Đổi tiêu đề và mô tả để thể hiện rõ đây là nơi chọn và quản lý các menu của nhà hàng.
- Giữ nguyên query, mutation, quyền, restaurant scope, audit log và các modal hiện tại.

## File thay đổi

- `src/components/Dashboard_Manager/Menu/MenuManagement.jsx`: ưu tiên vị trí khu vực menu, bỏ state thu gọn ở page và truyền chế độ luôn mở.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.jsx`: chỉ hiển thị nút thu gọn khi caller cung cấp hành động thu gọn; cập nhật copy tiêu đề/mô tả.

## Tiêu chí nghiệm thu

- Người dùng mở trang quản lý thực đơn thấy ngay danh sách menu của nhà hàng dưới header.
- Các menu vẫn chọn được theo khung giờ và các nút tạo, sửa, ẩn/hiện, sao chép, xóa hoạt động như trước theo quyền.
- Không còn nút thu gọn chết khi page cố định khu vực ở trạng thái mở.
- Không thay đổi backend hoặc GraphQL contract.

## Validation

- `npm run check:conflicts`
- Targeted Vitest trong module menu nếu có test phù hợp.
- `npm run build`

## Ngoài phạm vi

- Không tạo route quản lý menu mới.
- Không thay đổi schema, resolver hoặc dữ liệu menu.
- Không thiết kế lại toàn bộ trang quản lý thực đơn.
