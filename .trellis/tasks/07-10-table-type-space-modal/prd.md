# PRD — Modal loại bàn và không gian

## Hiện trạng

`table-types` từng được đăng ký như một trang quản lý độc lập. Component của mục này luôn truyền `isOpen` cho modal, còn `ManagerLayout` lại lưu page hiện tại vào hash URL và `localStorage`. Vì vậy sau khi người dùng đã mở mục này một lần, lần truy cập khu quản lý tiếp theo có thể khôi phục `#table-types` và bật modal ngay cả khi người dùng chỉ muốn vào trang Quản lý bàn.

Modal cũng tự định nghĩa palette be/cam và kế thừa nút primary màu xanh dương từ component dùng chung, không đồng nhất với hệ màu sage của manager shell.

## Luồng thật

- Loại bàn: `Table.type` → `TableType` / `UpdateTableInput.type` → resolver `createTable` / `updateTable` / `deleteTable` → `useTableManagement` → modal quản lý.
- Không gian: `Floor` model → `CreateFloorInput` / `UpdateFloorInput` / `deleteFloor` → resolver floor → `useFloorManagement` và mutation Apollo trong modal → thao tác thêm / đổi tên / xóa tầng.
- Điều hướng: `Sidebar` / tìm kiếm quản trị → `ManagerLayout` → action mở modal có kiểm soát trên page `tables`.

## Nguyên nhân gốc

`table-types` là một hành động mở modal nhưng được xử lý như page có thể khôi phục. Root cause nằm ở `ManagerLayout`, không phải ở việc thêm một điều kiện đóng modal trong component. Palette sai vì stylesheet modal dùng token riêng thay vì tái sử dụng `--manager-*` đã có.

## Phạm vi

- Giữ mục `Loại bàn & không gian` trong sidebar nhưng xử lý nó như action, không phải page.
- Khi action được chọn, page hiện tại và URL vẫn là `tables`; chỉ state `showTableSettings` được bật.
- Hash hoặc giá trị cũ `table-types` trong `localStorage` được chuẩn hóa về `tables` mà không tự mở modal.
- `TableTypeManagementPage` trở thành modal controlled bằng `isOpen`, `onClose`, `restaurantId` và `restaurantName`; không render thêm một bản `TableManagement` bên trong.
- Tab Loại bàn: thống kê sáu loại, tìm / lọc bàn, thêm bàn, sửa mã / sức chứa / tầng / loại và xóa bàn qua contract hiện có.
- Tab Không gian: thêm tầng, đổi tên tầng và xóa tầng khi không còn bàn.
- Giữ nguyên quyền `table.write`, phạm vi nhà hàng, guard xóa bàn và guard xóa tầng ở server.
- Dùng lại palette sage, surface, border, shadow và semantic-state token của manager shell; dùng Lucide đã có, không thêm dependency.

## Tiêu chí nghiệm thu

- Mở trang Quản lý bàn không tự hiện modal.
- Chỉ thao tác `Loại bàn & không gian` mới mở modal.
- Đóng modal vẫn ở trang Quản lý bàn và URL `#tables`.
- Reload URL cũ `#table-types` chuyển về `#tables` nhưng không mở modal.
- Modal dùng hệ màu sage thống nhất với manager shell, không còn CTA xanh dương hoặc accent be/cam riêng.
- Thêm, sửa, xóa bàn gọi đúng `createTable`, `updateTable`, `moveTable`, `deleteTable` và refetch.
- Thêm, sửa, xóa tầng gọi đúng mutation hiện có; không cho xóa tầng còn bàn.
- Hiển thị loading, error, empty state và hoạt động trên màn hình nhỏ.
- Không thay đổi Mongoose model, GraphQL schema hoặc resolver backend.

## File thay đổi

- `src/layouts/ManagerLayout.jsx`: chuyển `table-types` từ page có lưu trạng thái thành action mở modal controlled; chuẩn hóa route cũ.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.jsx`: bỏ host trang trùng lặp, nhận props controlled và giữ nguyên các thao tác CRUD hiện có.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.scss`: tái sử dụng token sage của manager, sửa hierarchy, interaction và responsive.
- `src/components/Dashboard_Manager/Table/TableTypeManagementPage.test.jsx`: kiểm tra trạng thái đóng mặc định, scope query khi mở và CRUD bàn / không gian.
- `src/components/Dashboard_Manager/Sidebar.jsx`: giữ nhãn action `Loại bàn & không gian` với quyền `table.write`.

## Ngoài phạm vi

- Không cho tạo mã `TableType` tùy ý vì đây là enum đang được dùng xuyên suốt model, GraphQL và nhiều caller.
- Không thay đổi nghiệp vụ đặt bàn, ghép bàn, POS, trạng thái bàn hoặc sơ đồ kéo thả.
