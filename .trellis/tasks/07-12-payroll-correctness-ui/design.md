# Thiết kế

## Hướng giao diện

Bảng lương vận hành gọn, tương phản rõ, một nguồn dữ liệu đang xem được công bố công khai, cảnh báo bất thường đặt gần bảng và chi tiết được mở tại chỗ thay vì thêm modal.

## Quyết định nghiệp vụ

- `insuranceEligible` mô tả nhân viên thuộc diện BH; nó không đồng nghĩa phải tạo khoản khấu trừ khi phiếu chưa phát sinh thu nhập.
- Calculator chỉ truyền `isEligible=true` vào phép tính BH khi `totalIncome > 0`. Vì vậy không thay đổi tỷ lệ/chính sách, chỉ tránh tạo khoản khấu trừ BH làm âm phiếu chưa có thu nhập.
- Các khoản điều chỉnh thủ công vẫn có thể làm phiếu âm và tiếp tục bị validation chặn; không kẹp `netSalary` từng nhân viên về 0 để che lỗi.
- KPI tổng bảng lương được chặn không hiển thị dưới 0. Phiếu âm vẫn hiện trong bảng, banner và chi tiết để quản lý xử lý.

## Trạng thái xem

- Kỳ chính thức: query có `periodId` và các thao tác tính lại/chốt/khóa dùng snapshot của kỳ.
- Tạm tính theo khoảng ngày: query bỏ `periodId` và tính trực tiếp từ dữ liệu vận hành.
- Chọn kỳ chính thức đồng bộ ngày hiển thị; sửa một ô ngày tự chuyển sang tạm tính để tránh hợp đồng UI/query mâu thuẫn.

## Chi tiết dòng

Nút native trong ô nhân viên mở thêm một hàng `colSpan=10` gồm:

- nguồn thu nhập: thu nhập công, phụ cấp, thưởng, tăng ca;
- khấu trừ: BH, thuế, tạm ứng, điều chỉnh khác;
- kiểm tra dữ liệu: số ca, đi muộn/nghỉ không lương và `warningMessages`.

Dùng dữ liệu đã có trong query, không gọi thêm endpoint và không thêm modal.

## Responsive và accessibility

- Nhãn thật cho tìm kiếm và ngày; trạng thái thao tác dùng `role=status`/`aria-live`.
- Nút mở chi tiết có `aria-expanded` và `aria-controls`.
- Trên điện thoại, bộ lọc và chi tiết xếp một cột; bảng vẫn cuộn ngang, cột nhân viên giữ ngữ cảnh.
- Số tiền dùng tabular figures; màu luôn đi kèm chữ/cảnh báo.
