# Sửa tính lương âm và cải thiện giao diện bảng lương

## Hiện trạng

- Bản tạm tính theo khoảng ngày vẫn khấu trừ toàn bộ BH bắt buộc trên lương cơ bản dù nhân viên chưa có ngày công, giờ công hoặc thu nhập trong kỳ. Kết quả là `totalIncome = 0`, `totalDeduction > 0` và `netSalary < 0`.
- `payrollValidation` đã xem thực lĩnh âm là lỗi chặn chốt kỳ, nhưng màn hình tạm tính vẫn hiển thị số âm mà không giải thích nguồn khấu trừ.
- Khi đang xem kỳ lương chính thức, query ưu tiên `periodId`; hai ô ngày vẫn sửa được nên giao diện có thể tạo cảm giác dữ liệu đã chuyển sang khoảng ngày mới dù backend vẫn trả snapshot của kỳ.
- Bảng chỉ hiển thị tổng khấu trừ, không cho quản lý kiểm tra nhanh BH, thuế, tạm ứng, điều chỉnh hoặc cảnh báo của từng nhân viên.

## Luồng thực tế

`PayrollItem.breakdown -> payrollCalculator/buildPayrollItem -> payrollRuntime/buildPayrollItemsForRange hoặc snapshot PayrollItem -> staffPayrollOverviewPage -> PayrollManagement Apollo query -> bảng và thao tác kỳ lương`.

Root cause của số âm nằm ở calculator: điều kiện thuộc diện BH được dùng trực tiếp để khấu trừ trên toàn bộ lương cơ bản, không xét phiếu hiện chưa phát sinh thu nhập.

## Phạm vi

- Không khấu trừ BH trong bản tính khi tổng thu nhập của phiếu bằng 0; vẫn giữ thông tin nhân viên thuộc diện BH và vẫn khấu trừ bình thường khi có thu nhập.
- Không để phiếu âm bất thường làm giảm KPI tổng chi phí lương.
- Phân biệt rõ chế độ xem kỳ chính thức và tạm tính theo khoảng ngày.
- Thêm trạng thái cảnh báo dữ liệu và phần mở rộng chi tiết thu nhập/khấu trừ ngay trong bảng.
- Bổ sung kiểm thử backend và component cho các hành vi trên.

## Tiêu chí chấp nhận

1. Nhân viên thuộc diện BH nhưng có `0` thu nhập trong kỳ nhận `insuranceTotal = 0`, `totalDeduction = 0`, `netSalary = 0` và cảnh báo BH đang được hoãn trong bản tạm tính.
2. Khi nhân viên có thu nhập, BH vẫn được tính theo chính sách hiện tại.
3. Tổng bảng lương không bị giảm bởi một phiếu thực lĩnh âm bất thường.
4. Chọn "Tạm tính theo khoảng ngày" khiến query không gửi `periodId`; sửa ngày tự chuyển sang chế độ này.
5. Khi chọn kỳ chính thức, khoảng ngày hiển thị theo kỳ và không giả vờ lọc snapshot bằng ngày khác.
6. Người quản lý có thể mở từng dòng để thấy nguồn thu nhập, BH, thuế, tạm ứng, điều chỉnh và cảnh báo.
7. Bảng dùng nhãn form rõ ràng, trạng thái động có live region, điều khiển bàn phím và responsive trên màn hình hẹp.

## Ngoài phạm vi

- Không thay đổi tỷ lệ hoặc đối tượng BH trong `payrollPolicy.vn.js`.
- Không thay đổi schema GraphQL, quyền payroll, quy trình chốt/khóa/thanh toán hoặc dữ liệu snapshot đã chốt.
- Không thêm thư viện UI hay abstraction mới.
