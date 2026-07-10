# Tối ưu trang lịch lớn

## Hiện trạng

- Bảng tuần đang bị stylesheet nạp cuối ép 7 cột có chiều rộng tối thiểu ở cả màn hình laptop, gây cuộn ngang dài và xung đột với breakpoint cũ.
- Header, 5 KPI và khối ca hôm nay chiếm nhiều chiều cao trước khi người dùng nhìn thấy bảng lịch.
- Thẻ ca chỉ hiển thị giờ bắt đầu/kết thúc, chưa cho biết nhanh đây là block 4 giờ hay ca dài 8 giờ.

## Luồng thực tế

`SchedulingPolicy.shiftTemplates -> schedulingPolicy service/resolver -> useSchedulingPolicy -> ScheduleManagement -> weekly schedule board -> ShiftCard`.

Dữ liệu giờ ca và loại ca đã đúng. Vấn đề nằm ở phân cấp thông tin và CSS responsive của giao diện quản lý.

## Hướng sửa

- Giữ 7 cột trên màn hình desktop rộng.
- Chuyển bảng tuần thành 4 cột trên laptop, 2 cột trên tablet và 1 cột trên điện thoại, không ép cuộn ngang để xem các ngày cơ bản.
- Thu gọn header, KPI, khoảng cách và khối ca hôm nay để bảng lịch xuất hiện sớm hơn.
- Tính thời lượng từ `startTime/endTime` ngay trong `ShiftCard` và hiển thị:
  - khoảng 4 giờ: `Bán thời gian · 4 giờ`;
  - khoảng 8 giờ: `Toàn thời gian · 8 giờ`;
  - thời lượng khác: `Ca linh hoạt · x giờ`.
- Giữ nguyên thao tác tạo ca, mở chi tiết, phân công, quyền, GraphQL và dữ liệu.

## File thay đổi

- `src/components/Dashboard_Manager/Schedule/components/ShiftCard.jsx`
- `src/styles/schedule-manager-sage-upgrade.css`
- `src/components/Dashboard_Manager/Schedule/components/ShiftCard.test.jsx`
- Task Trellis hiện tại.

## Ngoài phạm vi

- Không đổi schema, resolver, service hoặc mutation.
- Không đổi cấu hình ca của nhà hàng.
- Không thêm dependency hoặc component abstraction mới.

## Tiêu chí chấp nhận

- Desktop rộng hiển thị đủ 7 ngày theo một hàng.
- Laptop không còn bị ép 7 cột; bảng chia 4 + 3 ngày theo hai hàng.
- Tablet hiển thị 2 cột, điện thoại 1 cột, không tràn ngang toàn trang.
- Bảng lịch xuất hiện cao hơn trong viewport do header/KPI được thu gọn.
- Mỗi thẻ ca có nhãn thời lượng dễ hiểu và vẫn giữ trạng thái thiếu/đủ người.
- Thẻ ca vẫn là button, focus rõ, click mở chi tiết như trước.

## Kiểm tra dự kiến

- Targeted Vitest cho `ShiftCard`.
- `npm run check:conflicts`.
- `npm run build`.
- Kiểm tra trực quan 1440, 1024, 768 và 390 px.
