# PRD — Modal loại bàn và không gian

## Hiện trạng

`table-types` từng được đăng ký như một trang quản lý độc lập. Modal hiện đã được mở đúng từ trang Quản lý bàn, nhưng giao diện trên điện thoại bị vỡ: nút đóng chiếm gần toàn bộ hàng header, phần tiêu đề bị ép còn một ký tự mỗi dòng và vùng nội dung gần như không còn chỗ hiển thị.

## Luồng thật

- Loại bàn: `Table.type` → `TableType` / `UpdateTableInput.type` → resolver `createTable` / `updateTable` / `deleteTable` → `useTableManagement` → modal quản lý.
- Không gian: `Floor` model → `CreateFloorInput` / `UpdateFloorInput` / `deleteFloor` → resolver floor → `useFloorManagement` và mutation Apollo trong modal → thao tác thêm / đổi tên / xóa tầng.
- Điểm mở modal: `TableManagementSettingsEntry` → callback từ `ManagerLayout` → state `showTableSettings` → `TableTypeManagementPage` → shared `Modal` portal.
- Lỗi mobile chỉ nằm ở CSS sau khi modal được render qua portal; không có thay đổi dữ liệu hoặc GraphQL.

## Nguyên nhân gốc

Header của modal chưa có hợp đồng kích thước mobile đủ cô lập trước các lớp CSS modal toàn cục. Nút đóng vì vậy có thể nhận chiều rộng lớn, chiếm hàng flex và ép khối nội dung còn vài pixel. Khi header phình theo phần chữ bị xuống từng ký tự, body cuộn bị co lại và footer chiếm phần còn lại của viewport.

Cách sửa nhỏ nhất là thêm một lớp mobile override chỉ dành cho `.ttm-modal`: dùng grid `minmax(0, 1fr) 44px`, khóa nút đóng 44×44 px, để body là vùng cuộn duy nhất, giữ hai tab trên một hàng và thu gọn footer. Không sửa shared `Modal` vì các modal khác đang dùng contract hiện tại.

## Phạm vi

- Xóa mục `Loại bàn & không gian` khỏi sidebar và tìm kiếm quản trị.
- Thêm một nút `Loại bàn & không gian` ngay trên trang Quản lý bàn.
- Chỉ hiển thị nút khi người dùng có quyền `table.write`.
- Khi bấm nút, URL và page hiện tại vẫn là `tables`; chỉ state `showTableSettings` được bật.
- Hash hoặc giá trị cũ `table-types` trong `localStorage` vẫn được chuẩn hóa về `tables` mà không tự mở modal.
- Trên điện thoại, modal chiếm đúng `100dvh`, header không tràn, nội dung cuộn độc lập và footer tôn trọng safe area.
- Giữ nguyên modal controlled, CRUD bàn, CRUD không gian, restaurant scope và guard backend hiện có.

## Tiêu chí nghiệm thu

- Sidebar và tìm kiếm quản trị không còn lựa chọn `Loại bàn & không gian` độc lập.
- Trang Quản lý bàn có nút mở modal theo quyền `table.write`.
- Bấm nút mở đúng modal và không đổi URL khỏi `#tables`.
- Mở trang Quản lý bàn hoặc reload không tự hiện modal.
- Ở chiều rộng điện thoại, tiêu đề hiển thị theo dòng bình thường và nút đóng luôn là touch target 44×44 px.
- Header, body và footer không chồng lên nhau; body cuộn được và không có tràn ngang.
- Hai tab vẫn nhìn thấy trên cùng một hàng; form, thẻ và thao tác xếp một cột khi cần.
- Phần mô tả footer được ẩn trên điện thoại, nút Đóng luôn nhìn thấy và tôn trọng safe area.
- Không thay đổi Mongoose model, GraphQL schema, resolver, hook hoặc nghiệp vụ CRUD.

## File thay đổi

- `src/components/Dashboard_Manager/Sidebar.jsx`: xóa mục điều hướng riêng.
- `src/layouts/ManagerLayout.jsx`: bỏ action khỏi tìm kiếm/điều hướng và truyền callback mở modal vào trang bàn.
- `src/components/Dashboard_Manager/Table/TableManagementSettingsEntry.jsx`: hiển thị nút mở modal và nạp lớp sửa mobile.
- `src/components/Dashboard_Manager/Table/TableManagementSettingsEntry.scss`: style nút mở modal.
- `src/components/Dashboard_Manager/Table/TableTypeManagementMobileFix.scss`: cô lập layout portal trên điện thoại, khóa header/close button, body scroll và footer safe-area.
- `src/components/Dashboard_Manager/Table/TableManagementSettingsEntry.test.jsx`: kiểm tra mở modal và ẩn nút khi không có quyền/callback.
- `.trellis/tasks/07-10-table-type-space-modal/task.json`: cập nhật phạm vi và kết quả xác minh.

## Ngoài phạm vi

- Không sửa shared `Modal` hoặc các modal khác.
- Không cho tạo mã `TableType` tùy ý vì đây là enum đang được dùng xuyên suốt model, GraphQL và nhiều caller.
- Không thay đổi nghiệp vụ đặt bàn, ghép bàn, POS, trạng thái bàn hoặc sơ đồ kéo thả.
