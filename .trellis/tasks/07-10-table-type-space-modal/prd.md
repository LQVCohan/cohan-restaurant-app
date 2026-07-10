# PRD — Modal loại bàn và không gian

## Hiện trạng

`TableTypeManagementPage` đang là một trang riêng chỉ cho đổi `Table.type`. Trang quản lý bàn đã có toàn bộ dữ liệu và thao tác bàn, còn dữ liệu không gian phục vụ đang được lưu bằng `Floor` với đủ mutation tạo, cập nhật và xóa tầng trống.

## Luồng thật

- Loại bàn: `Table.type` → `TableType` / `UpdateTableInput.type` → resolver `createTable` / `updateTable` / `deleteTable` → `useTableManagement` → modal quản lý.
- Không gian: `Floor` model → `CreateFloorInput` / `UpdateFloorInput` / `deleteFloor` → resolver floor → `useFloorManagement` và mutation Apollo trong modal → thao tác thêm / đổi tên / xóa tầng.

## Nguyên nhân gốc

UI đang tách một trang phân loại bàn khỏi màn hình vận hành chính, đồng thời chưa tập trung các thao tác quản lý tầng. Không cần thêm model hoặc collection: sáu mã loại bàn là enum dùng chung; CRUD cần thiết là CRUD bàn trong từng loại và CRUD tầng / không gian hiện có.

## Phạm vi

- Khi mở mục `Loại bàn`, hiển thị trang Quản lý bàn ở nền và mở modal `Loại bàn & không gian`.
- Tab Loại bàn: thống kê sáu loại, tìm / lọc bàn, thêm bàn, sửa mã / sức chứa / tầng / loại và xóa bàn qua contract hiện có.
- Tab Không gian: thêm tầng, đổi tên tầng và xóa tầng khi không còn bàn.
- Đóng modal quay lại trang `Bàn ăn` thay vì giữ một trang quản lý loại bàn riêng.
- Giữ nguyên quyền `table.write`, phạm vi nhà hàng, guard xóa bàn và guard xóa tầng ở server.

## Tiêu chí nghiệm thu

- Không còn giao diện trang loại bàn độc lập.
- Modal mở trên nền trang Quản lý bàn và có hai tab Loại bàn / Không gian.
- Thêm, sửa, xóa bàn gọi đúng `createTable`, `updateTable`, `moveTable`, `deleteTable` và refetch.
- Thêm, sửa, xóa tầng gọi đúng mutation hiện có; không cho xóa tầng còn bàn.
- Hiển thị loading, error, empty state và hoạt động trên màn hình nhỏ.
- Không thay đổi Mongoose model, GraphQL schema hoặc resolver backend.

## File thay đổi

- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.jsx`: chuyển trang thành host Quản lý bàn + modal CRUD.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.scss`: bố cục modal, tab, form và responsive.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.test.jsx`: kiểm tra modal, đổi loại và CRUD tầng / bàn.

## Ngoài phạm vi

- Không cho tạo mã `TableType` tùy ý vì đây là enum đang được dùng xuyên suốt model, GraphQL và nhiều caller.
- Không thay đổi nghiệp vụ đặt bàn, ghép bàn, POS, trạng thái bàn hoặc sơ đồ kéo thả.
