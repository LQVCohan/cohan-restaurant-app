# Design — Kho Coupon

## Hướng thị giác

Một “ví ưu đãi” hiện đại theo nhận diện cam Cohan: nền kem sáng, chi tiết cam có kiểm soát, thẻ coupon có đường xé và vết cắt đặc trưng. Tránh dàn card SaaS đồng đều; hero dùng bố cục lệch với cụm thống kê như các ngăn trong ví.

## Bố cục

- Hero trái: điều hướng quay lại, nhãn ngữ cảnh, tiêu đề và mô tả.
- Hero phải: một khối thống kê dạng wallet rail, số liệu dùng tabular figures.
- Toolbar chồng nhẹ lên đáy hero để giảm khoảng trống và nối mạch tìm kiếm–lọc.
- Empty state thành một “coupon trống” có đường xé, lời nhắc và CTA rõ.
- Khi có dữ liệu, card coupon dùng cột accent hẹp, nội dung linh hoạt và hành động ghim cuối card.

## Responsive

- Dưới 860px: hero một cột, thống kê thành hàng 2×2.
- Dưới 560px: thống kê cuộn ngang hoặc 2 cột, toolbar không sticky, filter cuộn ngang, card một cột.
- Modal chi tiết chiếm gần toàn chiều rộng mobile, giữ nút đóng và focus rõ.
