# Design — Sao lưu và Cài đặt

## Hướng thị giác

Hai trang dùng chung ngôn ngữ quản trị Cohan: nền sáng sage–kem, chữ xanh than, điểm nhấn xanh vận hành và hổ phách cho cảnh báo. Tránh dàn card đồng đều; dùng một khối trạng thái chính và các panel nghiệp vụ có nhịp rõ.

## Cài đặt

- Hero như bảng điều khiển vận hành, hiển thị phiên bản, trạng thái đồng bộ, tăng ca và lần cập nhật.
- Form chia thành cấu hình chung, tăng ca, module và ghi chú.
- Chế độ chỉnh sửa được nhận biết bằng viền/trạng thái, không chỉ bằng nút.
- Lối tắt cấu hình gọn, dùng wording tiếng Việt.

## Sao lưu

- Hero nhấn trạng thái sẵn sàng và tiến độ checklist.
- Quy trình ba bước giữ ngắn, hành động sao lưu và khôi phục tách hai panel rõ.
- Phạm vi, điểm cần kiểm tra và lịch sử dùng `<details>` để giảm tải thông tin mặc định.
- Nút hủy dùng semantic nguy hiểm; nút áp dụng khôi phục chỉ nổi bật khi đủ điều kiện.

## Responsive

- Dưới 1100px: workspace một cột, panel phụ không sticky.
- Dưới 720px: metric và card về một cột hoặc cuộn ngang; action full-width khi cần.
- Không dùng CSS zoom; hỗ trợ 430×932 và 390×844.
