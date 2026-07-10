# PRD — Nâng cấp giao diện và luồng quản lý combo

## Hiện trạng

- Trang quản lý combo đã có danh sách, lọc trạng thái, tìm kiếm, tạo, sửa, bật/tắt và xóa.
- Modal tạo/sửa còn dài theo chiều dọc, thiếu vùng xem trước và khó quan sát đồng thời món thành phần, giá món lẻ, giá combo và mức tiết kiệm.
- Giao diện có thể thêm cùng một món ở nhiều dòng.
- Resolver cập nhật combo kiểm tra quyền theo `input.restaurantId` nhưng chưa ràng buộc bản ghi hiện hữu phải thuộc chính nhà hàng đó.
- Số lượng món được ép kiểu bằng `Math.max/Math.floor`; giá trị không phải số có thể trở thành `NaN` và rơi xuống lỗi Mongoose thay vì lỗi nghiệp vụ rõ ràng.
- Từ khóa tìm kiếm được đưa trực tiếp vào biểu thức chính quy.

## Luồng thật

`Combo model` → `customerCombo.graphql` → `customerCombo/index.js` → Apollo operations trong `ComboManagement.jsx` → hành động tìm kiếm/lọc/tạo/sửa/bật-tắt/xóa → `ComboManagement.test.jsx` và resolver test.

Dữ liệu món thành phần đi từ `MenuItem` qua truy vấn `menuItems`, sau đó được dùng để tính giá món lẻ và tạo `ComboItemInput`.

## Nguyên nhân gốc

1. `updateCombo` dùng bộ lọc `{ _id: id }`, vì vậy phạm vi nhà hàng của bản ghi cũ không tham gia điều kiện cập nhật.
2. `validateComboInput` không kiểm tra rõ `qty` là số nguyên dương và không phát hiện `menuItemId` trùng.
3. `addItem` luôn chọn món đầu tiên nên dễ tạo dòng trùng; các lựa chọn đã dùng cũng không bị vô hiệu hóa.
4. Modal chỉ dùng một luồng dọc nên thông tin chính và phần tổng hợp giá bị tách xa nhau.

## Phạm vi

- Giữ nguyên GraphQL schema và model.
- Khóa cập nhật combo theo cả `id` và `restaurantId`.
- Kiểm tra số lượng là số nguyên dương và từ chối món trùng ở trust boundary.
- Escape từ khóa trước khi tạo regex tìm kiếm.
- Ngăn chọn trùng ở giao diện và chọn món chưa dùng khi thêm dòng.
- Nâng modal thành bố cục hai cột: form/món thành phần và vùng xem trước/tổng hợp giá.
- Cải thiện nhãn, trạng thái tải/lỗi và khả năng sử dụng trên màn hình nhỏ.

## File thay đổi

- `src/components/Dashboard_Manager/Combo/ComboManagement.jsx`
- `src/components/Dashboard_Manager/Combo/ComboManagement.scss`
- `src/components/Dashboard_Manager/Combo/ComboManagement.test.jsx`
- `cohan-restaurant-backend/graphql/resolvers/customerCombo/index.js`
- `cohan-restaurant-backend/tests/resolvers/customerCombo/customerCombo.resolver.test.js`
- `.trellis/tasks/07-10-combo-management-upgrade/task.json`

## Tiêu chí nghiệm thu

- Không thể cập nhật combo của nhà hàng A bằng cách gửi `restaurantId` của nhà hàng B.
- Không thể lưu số lượng bằng 0, số âm, số thập phân hoặc giá trị không phải số.
- Một món chỉ xuất hiện một lần trong combo; người dùng tăng số lượng trên cùng dòng khi cần nhiều suất.
- Tìm kiếm có ký tự regex đặc biệt không làm thay đổi ý nghĩa truy vấn hoặc gây lỗi regex.
- Modal hiển thị đồng thời thông tin combo, món thành phần, ảnh xem trước, giá món lẻ, giá combo và mức tiết kiệm.
- Các luồng tạo, sửa, bật/tắt, xóa, lọc, tìm kiếm, trạng thái rỗng/lỗi/tải vẫn giữ nguyên contract GraphQL.

## Validation

- `npm run check:conflicts`
- `npm run check:graphql`
- `vitest run src/components/Dashboard_Manager/Combo/ComboManagement.test.jsx`
- `vitest run cohan-restaurant-backend/tests/resolvers/customerCombo/customerCombo.resolver.test.js`
- `npm run build`

## Ngoài phạm vi

- Không đổi model Combo hoặc GraphQL schema.
- Không thêm thư viện giao diện.
- Không gộp combo cố định với chương trình khuyến mãi.
- Không bổ sung upload ảnh; trường ảnh tiếp tục nhận URL.
