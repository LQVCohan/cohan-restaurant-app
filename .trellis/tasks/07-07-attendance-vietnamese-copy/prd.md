# Chuẩn hóa tiếng Việt trang chấm công

## Hiện trạng

Trang chấm công đang dùng lẫn tiếng Việt và thuật ngữ tiếng Anh như `No-show`, `check-in`, `check-out`, `review`, `Timesheet`, `overtime`, `payroll`. Một số trạng thái cũng chưa thống nhất, ví dụ cùng một trường hợp được gọi là “Vắng lịch”, “No-show / Vắng lịch” hoặc hiển thị trực tiếp mã kỹ thuật.

Repository đã có `AttendanceWordingTuning.js` dành riêng cho việc chuẩn hóa câu chữ nhưng chưa được khởi chạy từ ứng dụng và mới chỉ bao phủ một phần nội dung.

## Luồng thực tế

`src/main.jsx` khởi chạy các bộ tinh chỉnh giao diện toàn cục -> `AttendancePage.jsx` và `OvertimePanel.jsx` render nội dung chấm công -> `AttendanceWordingTuning.js` chỉ xử lý bên trong `.attendance-management-page` và theo dõi các nội dung động như phản hồi, hộp thoại và đổi tab.

Không thay đổi schema, resolver, hook, biến trạng thái, giá trị enum hoặc payload mutation. Chỉ thay nội dung và thuộc tính hỗ trợ hiển thị cho người dùng.

## File sửa

- `AttendanceWordingTuning.js`: mở rộng bộ từ ngữ cho Bảng chấm công, Yêu cầu chỉnh công và Tăng ca; giữ nguyên icon khi thay chữ; xử lý placeholder, title và aria-label.
- `src/main.jsx`: khởi chạy bộ chuẩn hóa câu chữ theo cùng pattern với RBAC và giờ hoạt động nhà hàng.
- `AttendanceWordingTuning.test.js`: kiểm tra câu chữ tĩnh, nội dung động, placeholder và việc giữ icon.

## Quy ước từ ngữ

- `check-in` -> `giờ vào` hoặc `vào ca` tùy ngữ cảnh.
- `check-out` -> `giờ ra` hoặc `tan ca` tùy ngữ cảnh.
- `No-show / Vắng lịch` -> `Vắng ca`.
- `missed checkout` -> `Quên tan ca`.
- `off schedule` -> `Làm ngoài lịch`.
- `review` -> `duyệt` hoặc `xử lý`.
- `Timesheet` -> `bảng chấm công`.
- `overtime` -> `tăng ca`.
- `payroll` -> `bảng lương`.

## Tiêu chí nghiệm thu

- Các khu vực Bảng chấm công, Yêu cầu chỉnh công và Tăng ca dùng tiếng Việt tự nhiên, nhất quán.
- Không còn thuật ngữ tiếng Anh hiển thị trực tiếp, trừ `Excel` và các giá trị kỹ thuật không hiển thị.
- Icon, cấu trúc nút và hành vi vẫn được giữ nguyên khi thay chữ.
- Nội dung được render sau khi chuyển tab hoặc mở hộp thoại cũng được chuẩn hóa.
- Enum, bộ lọc, quyền, mutation và dữ liệu giữ nguyên.
- Test mục tiêu chạy thành công.

## Kiểm tra

- `npx vitest run src/components/Dashboard_Manager/Staff/components/Attendance/AttendanceWordingTuning.test.js`
- `npm run build`

## Ngoài phạm vi

- Thay đổi cách tính công, điểm đối chiếu hoặc tăng ca.
- Thay đổi quyền duyệt, trạng thái nghiệp vụ hoặc API.
- Thiết kế lại giao diện.
