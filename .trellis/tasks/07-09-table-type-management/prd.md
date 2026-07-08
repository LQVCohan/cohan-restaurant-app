# PRD — Trang quản lý loại bàn

## Hiện trạng

Mỗi bàn đã lưu trực tiếp trường `type` với sáu mã hệ thống: `standard`, `booth`, `vip`, `outdoor`, `bar`, `private`. Người quản lý có thể đổi loại trong modal chi tiết từng bàn, nhưng chưa có màn hình tập trung để xem số lượng, tìm bàn và phân loại lại hàng loạt theo từng bản ghi.

## Luồng thật

`Table model.type` → `TableType` / `UpdateTableInput.type` → resolver `tables` / `updateTable` → `useTableManagement` → trang Quản lý loại bàn → thao tác đổi loại của một bàn.

Dữ liệu đã đủ ở hợp đồng hiện tại. Không cần thêm model, collection, field cấu hình nhà hàng hoặc mutation mới.

## Nguyên nhân gốc

Thiếu một caller UI tập trung cho dữ liệu `Table.type`; không phải thiếu persistence. Tạo thêm cấu hình loại bàn ở `Restaurant` sẽ trùng nguồn dữ liệu và không giải quyết việc quản lý các bàn đang thuộc từng loại.

## Phạm vi

- Thêm mục `Loại bàn` trong menu quản lý, yêu cầu quyền `table.write`.
- Tạo trang hiển thị đủ sáu loại hệ thống, số bàn và mã bàn thuộc từng loại.
- Cho phép tìm theo mã bàn, lọc theo loại và đổi loại từng bàn bằng mutation `updateTable` hiện có.
- Sau khi cập nhật, refetch danh sách để kết quả phản ánh dữ liệu MongoDB.
- Giữ nhãn hiện tại từ `TABLE_AREA_OPTIONS` và giữ mã hệ thống bất biến.

## Tiêu chí nghiệm thu

- Mục `Loại bàn` xuất hiện riêng trong nhóm Vận hành.
- Trang hiển thị tổng số bàn và số lượng theo cả sáu loại.
- Chọn một loại giúp lọc đúng danh sách bàn.
- Đổi loại một bàn gọi `updateTable({ id, type })`, tải lại dữ liệu và hiển thị kết quả mới.
- Lỗi cập nhật có thông báo rõ ràng và không làm mất danh sách hiện tại.
- Không thay đổi schema, resolver, quyền backend, trạng thái bàn, ghép bàn hoặc đặt bàn.
- Không tạo model con hay field cấu hình trùng lặp.

## File thay đổi

- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.jsx`: màn hình quản lý tập trung và thao tác cập nhật.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.scss`: bố cục responsive theo giao diện quản lý bàn.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.test.jsx`: kiểm tra thống kê và mutation đổi loại.
- `src/layouts/ManagerLayout.jsx`: đăng ký trang, quyền và lazy route.
- `src/components/Dashboard_Manager/Sidebar.jsx`: thêm mục điều hướng.

## Ngoài phạm vi

- Không cho tạo hoặc xóa mã loại bàn tùy ý vì đây là enum dùng chung ở model, GraphQL và các caller.
- Không đổi tên nhãn loại bàn theo từng nhà hàng.
- Không cập nhật nhiều bàn trong một mutation; thao tác từng bàn dùng đúng contract hiện có.
