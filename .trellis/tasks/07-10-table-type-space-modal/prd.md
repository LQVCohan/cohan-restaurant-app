# PRD — Modal loại bàn và không gian

## Hiện trạng

`table-types` từng được đăng ký như một trang quản lý độc lập. Sau lần sửa trước, nó đã trở thành action mở modal controlled, nhưng action vẫn còn xuất hiện như một lựa chọn riêng trong sidebar và tìm kiếm quản trị.

Điểm mở này không phù hợp với nghiệp vụ: loại bàn và không gian là thiết lập phụ của trang Quản lý bàn, không phải một module điều hướng độc lập.

## Luồng thật

- Loại bàn: `Table.type` → `TableType` / `UpdateTableInput.type` → resolver `createTable` / `updateTable` / `deleteTable` → `useTableManagement` → modal quản lý.
- Không gian: `Floor` model → `CreateFloorInput` / `UpdateFloorInput` / `deleteFloor` → resolver floor → `useFloorManagement` và mutation Apollo trong modal → thao tác thêm / đổi tên / xóa tầng.
- Điểm mở modal: `TableManagement` → callback từ `ManagerLayout` → state `showTableSettings` → `TableTypeManagementPage`.

## Nguyên nhân gốc

Modal là thao tác ngữ cảnh của trang bàn nhưng điểm mở đang nằm trong navigation toàn cục. Cách sửa nhỏ nhất là xóa lựa chọn navigation và truyền callback mở modal trực tiếp vào `TableManagement`; không thêm route, event hoặc state mới.

## Phạm vi

- Xóa mục `Loại bàn & không gian` khỏi sidebar và tìm kiếm quản trị.
- Thêm nút `Loại bàn & không gian` trong header trang Quản lý bàn.
- Chỉ hiển thị nút khi người dùng có quyền `table.write`.
- Khi bấm nút, URL và page hiện tại vẫn là `tables`; chỉ state `showTableSettings` được bật.
- Hash hoặc giá trị cũ `table-types` trong `localStorage` vẫn được chuẩn hóa về `tables` mà không tự mở modal.
- Giữ nguyên modal controlled, CRUD bàn, CRUD không gian, restaurant scope và guard backend hiện có.

## Tiêu chí nghiệm thu

- Sidebar không còn mục `Loại bàn & không gian`.
- Tìm kiếm quản trị không còn trả về lựa chọn này.
- Trang Quản lý bàn có nút mở modal trong cụm thao tác header.
- Người không có `table.write` không thấy nút.
- Bấm nút mở đúng modal và không đổi URL khỏi `#tables`.
- Mở trang Quản lý bàn hoặc reload không tự hiện modal.
- Không thay đổi Mongoose model, GraphQL schema hoặc resolver backend.

## File thay đổi

- `src/components/Dashboard_Manager/Sidebar.jsx`: xóa mục điều hướng riêng.
- `src/layouts/ManagerLayout.jsx`: bỏ action khỏi tìm kiếm/điều hướng và truyền callback mở modal vào trang bàn.
- `src/components/Dashboard_Manager/Table/TableManagement.jsx`: thêm nút mở modal trong header.
- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`: kiểm tra nút gọi đúng callback.
- `.trellis/tasks/07-10-table-type-space-modal/task.json`: cập nhật phạm vi và kết quả xác minh.

## Ngoài phạm vi

- Không thay đổi nội dung, CRUD hoặc style của modal.
- Không cho tạo mã `TableType` tùy ý vì đây là enum đang được dùng xuyên suốt model, GraphQL và nhiều caller.
- Không thay đổi nghiệp vụ đặt bàn, ghép bàn, POS, trạng thái bàn hoặc sơ đồ kéo thả.
