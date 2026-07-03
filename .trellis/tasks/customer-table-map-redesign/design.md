# Design — Sơ đồ bàn boutique

## Hướng thị giác

Không gian chọn bàn mang cảm giác như một bản vẽ nội thất của nhà hàng boutique: nền ngà ấm, xanh than/gỗ tối cho khung, cam đất làm điểm nhấn chọn bàn và xanh lá trầm cho bàn trống. Bề mặt có họa tiết giấy và đường lưới kiến trúc rất nhẹ.

## Bố cục

- Header bất đối xứng: tiêu đề và hướng dẫn bên trái; thống kê bàn trống, tổng bàn và tầng hiện tại bên phải.
- Bộ chọn tầng như dải điều hướng khu vực, không dùng card ngang đồng đều.
- Viewport là khối chính với rail thông tin ở trên, canvas sơ đồ ở giữa và một chú thích duy nhất.
- Panel tóm tắt giữ sticky ở desktop; trên tablet/mobile chuyển về luồng nội dung bình thường để không che sơ đồ hoặc điều khiển.

## Bàn và trạng thái

- Bàn trống: bề mặt sáng, viền xanh trầm, ghế cùng tông.
- Bàn được chọn: cam đất, vòng sáng và nhãn rõ.
- Bàn đã đặt/đang dùng: giảm độ nổi, thêm pattern để không phụ thuộc màu.
- Bàn dọn dẹp/chờ thanh toán: biểu tượng và màu riêng.
- Sức chứa hiển thị trong badge nhỏ, không dùng emoji.

## Tương tác

- Pointer Events cho pan trên chuột và cảm ứng.
- Table control focusable, có focus ring và tên đọc màn hình.
- Zoom/reset có nhãn truy cập và trạng thái phần trăm zoom.
- Popup ảnh/360/3D đóng bằng nút rõ, Escape và trả focus về nút mở.

## Responsive

- Dưới 1100px: summary xuống dưới sơ đồ, không còn fixed bottom sheet.
- Dưới 820px: header metric và tiến trình thích ứng theo chiều ngang; floor rail full-width.
- 430×932 và 390×844: viewport tối thiểu 480px, summary không che legend hoặc zoom.
