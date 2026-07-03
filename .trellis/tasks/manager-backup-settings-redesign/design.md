# Design — Sao lưu và Cài đặt

## Hướng thị giác

Hai trang dùng chung ngôn ngữ quản trị Cohan: nền sáng sage–kem, chữ xanh than, điểm nhấn xanh vận hành và hổ phách cho cảnh báo. Tránh dàn card đồng đều; dùng một khối trạng thái chính và các panel nghiệp vụ có nhịp rõ.

## Cài đặt

- Hero như bảng điều khiển vận hành, hiển thị phiên bản, trạng thái đồng bộ, tăng ca và lần cập nhật.
- Form chia thành cấu hình chung, tăng ca, phân hệ và ghi chú.
- Chế độ chỉnh sửa được nhận biết bằng viền và nhãn trạng thái, không chỉ bằng nút.
- Lối tắt cấu hình gọn, dùng wording tiếng Việt.

## Sao lưu

- Hero nhấn trạng thái sẵn sàng và tiến độ checklist.
- Quy trình ba bước giữ ngắn, hành động sao lưu và khôi phục tách hai panel rõ.
- Nút tạo/lưu dùng màu vận hành; nút hủy dùng semantic nguy hiểm.
- File picker, phần xem trước, xung đột, phạm vi, rủi ro và lịch sử có mật độ khác nhau để người dùng nhận ra thứ tự ưu tiên.

## Responsive

- Dưới 1120px: workspace một cột, panel phụ không sticky.
- Dưới 820px: metric, quy trình và form phụ thu về một cột hoặc hai cột phù hợp.
- Dưới 620px: hành động full-width, bộ lọc và wizard xếp dọc.
- Không dùng CSS zoom; hỗ trợ 430×932 và 390×844.
