# PRD — Ổn định giao diện quản lý bàn

## Hướng thiết kế

Bảng điều hành vận hành gọn bằng tông sage/kem: tiêu đề và thao tác chính rõ trước, KPI nằm thành một hàng riêng, bộ lọc dễ quét và thẻ bàn đủ rộng để đọc đủ thông tin.

## Hiện trạng

Trang `TableManagement` đang nạp đồng thời nhiều lớp CSS hoàn thiện muộn. `TableManagementFinalQC.scss`, `TableManagementScorePolish.scss` và `TableManagementHeaderStatsPolish.scss` cùng sửa header compact, KPI, grid và thẻ bàn. Kết quả cuối phụ thuộc thứ tự import thay vì một hợp đồng layout thống nhất.

Biểu hiện trực quan:

- cụm chọn nhà hàng và thao tác bị ép thành cột hẹp, nhãn nút bị cắt;
- KPI bị nén vào dải nhỏ giữa header;
- thẻ bàn bị thu xuống khoảng 176–188 px;
- hai dòng thông tin tầng và tiền cọc bị ẩn bằng `nth-child`;
- vùng danh sách giữ chiều cao lớn dù chỉ có một bàn;
- kích thước nút nhỏ hơn mức thao tác cảm ứng thoải mái.

## Nguyên nhân gốc

Không có lỗi dữ liệu. Nguyên nhân là CSS contract drift: nhiều file override cùng chịu trách nhiệm cho một màn hình và file nạp sau tiếp tục thu nhỏ các giá trị của file trước. `TableManagementScorePolish.scss` còn chủ động ẩn metadata để đạt mật độ cao, trái với công việc chính của màn hình là quan sát trạng thái và thông tin bàn.

## Luồng thật đã kiểm tra

1. `Table` và `Floor` cung cấp mã bàn, sức chứa, trạng thái, loại, tiền cọc, tầng và vị trí.
2. Resolver/service giữ restaurant scope, validation và trạng thái vận hành.
3. `useTableManagement` lấy danh sách bàn và cung cấp mutation tạo, sửa, đổi trạng thái, di chuyển, ghép và tách bàn.
4. `useFloorManagement` cung cấp danh sách tầng và thao tác tạo tầng.
5. `TableManagement` ánh xạ dữ liệu, lọc theo tầng/trạng thái/khu vực và gọi các action hiện có.
6. Thay đổi này chỉ sửa lớp trình bày; không đổi schema, resolver, Apollo operation, permission, audit log hoặc realtime side effect.

## Phạm vi thay đổi

- Dùng `TableManagementFinalQC.scss` làm lớp hoàn thiện duy nhất cho bố cục trang quản lý bàn.
- Bỏ import và xóa hai file override trùng `TableManagementScorePolish.scss` và `TableManagementHeaderStatsPolish.scss`.
- Giữ nguyên component, query, mutation, modal và hành vi nghiệp vụ.

## Tiêu chí nghiệm thu

- Header có thứ bậc rõ: tiêu đề và thao tác ở hàng đầu, KPI ở hàng riêng.
- Chọn nhà hàng và ba thao tác không bị cắt nhãn ở desktop.
- Nút và select chính có chiều cao tối thiểu 44 px.
- Thẻ bàn rộng 280–360 px, hiển thị đủ sức chứa, tầng, loại bàn và tiền cọc.
- Thao tác trạng thái là hành động chính, chiếm một hàng riêng trên thẻ.
- Danh sách không giữ khoảng trắng quá lớn khi có ít bàn.
- Desktop dùng sidebar ổn định; tablet chuyển một cột; mobile không tràn ngang.
- Focus keyboard rõ, trạng thái không chỉ được truyền đạt bằng màu.
- Không thêm dependency, abstraction hoặc thay đổi hợp đồng dữ liệu.

## Ngoài phạm vi

- Thay đổi CRUD bàn/tầng, ghép bàn, POS hoặc đặt bàn.
- Sửa modal chi tiết, modal 360°, trình thiết kế sơ đồ hoặc 3D/AR.
- Thay đổi shared `ManagementPageHeader` cho các màn hình khác.

## Kế hoạch xác minh

- `npx vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
- `npm run build`
- Kiểm tra trực quan tại 375, 768, 1024 và 1440 px.
