# PRD — Tối ưu và gia cố trang cấu hình tuỳ chọn món

## Hiện trạng

- Trang `/manager#modifiers` đã có danh sách nhóm, bộ lọc, form tạo / sửa, thống kê và kiểm soát quyền phía giao diện.
- Form hoạt động theo contract `CreateModifierGroupInput` / `UpdateModifierGroupInput`, nhưng một số trường hợp biên chưa đi xuyên suốt đúng từ UI đến resolver.
- Trên màn hình hẹp, người dùng bấm tạo / sửa nhưng editor nằm sau danh sách nên khó nhận biết thao tác đã được mở.

## Luồng thật

`ModifierGroup` Mongoose model → `modifier.graphql` → `ModifierQuery` / `ModifierMutation` + `requireRestaurantAccess` → Apollo query / mutation trong `ModifierManagement.jsx` → bộ lọc, card danh sách và editor → helper / resolver tests.

## Nguyên nhân gốc

- `updateModifierGroup` dùng toán tử `??` khi trộn dữ liệu, làm mất ý nghĩa của `null`; vì vậy người dùng không thể xoá `maxSelected` hoặc ghi chú đã có.
- Các mutation thao tác option riêng chưa đồng nhất với quy tắc của mutation cập nhật cả nhóm: có thể cố xoá option cuối và có thể tạo nhiều option mặc định ở nhóm chọn nhiều.
- Kiểm tra `ingredientId` chỉ xác nhận tồn tại, chưa xác nhận nguyên liệu thuộc cùng nhà hàng.
- UI chưa đưa editor vào vùng nhìn thấy sau thao tác tạo / sửa ở layout một cột; copy lỗi backend còn khó hiểu và form chưa chặn một số cấu hình mâu thuẫn.

## Phạm vi

- Giữ nguyên GraphQL schema và các vai trò hiện tại.
- Sửa contract update để `null` thật sự xoá giới hạn tối đa và ghi chú.
- Đồng bộ quy tắc option mặc định, chặn xoá option cuối và kiểm tra nguyên liệu theo `restaurantId`.
- Cải thiện bố cục editor, trạng thái tóm tắt, empty state, thông báo lỗi và luồng cuộn tới editor trên tablet / mobile.
- Bổ sung validation cho tên option trùng và giới hạn chọn vượt số option.

## File thay đổi

- `cohan-restaurant-backend/graphql/resolvers/modifier/mutation.js`: sửa merge / normalize update, scope nguyên liệu và quy tắc option riêng.
- `cohan-restaurant-backend/tests/resolvers/modifier-mutation.test.js`: kiểm tra các lỗi biên đã sửa.
- `src/components/Dashboard_Manager/Modifier/ModifierManagement.jsx`: sửa payload, validation, luồng tạo / sửa và copy trạng thái.
- `src/components/Dashboard_Manager/Modifier/ModifierManagement.scss`: tối ưu thứ bậc thị giác, editor và responsive.
- `src/components/Dashboard_Manager/Modifier/ModifierManagement.test.js`: kiểm tra payload và validation mới.

## Tiêu chí nghiệm thu

- Tạo, sửa, bật / tắt, lọc, tìm kiếm, đổi chi nhánh và xoá theo quyền vẫn hoạt động.
- Xoá giá trị “Tối đa” hoặc ghi chú rồi lưu phải xoá dữ liệu cũ ở backend.
- Không thể xoá lựa chọn cuối bằng mutation option; chỉ có tối đa một lựa chọn mặc định.
- Modifier không thể tham chiếu nguyên liệu của nhà hàng khác.
- Trên layout một cột, bấm “Tạo mới” hoặc “Sửa” đưa người dùng tới editor.
- Form báo lỗi rõ khi option trùng tên, tối thiểu / tối đa không hợp lệ hoặc thiếu dữ liệu bắt buộc.

## Validation

- `npm run check:conflicts`
- `vitest run src/components/Dashboard_Manager/Modifier/ModifierManagement.test.js`
- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/modifier-mutation.test.js tests/resolvers/category-modifier-restaurant-access.test.js`
- `npm run check:graphql`
- `npm run build`
- Browser smoke ở `/manager#modifiers` với desktop và layout một cột.

## Ngoài phạm vi

- Không thêm dependency.
- Không thay đổi schema GraphQL hoặc mô hình dữ liệu.
- Không mở rộng editor sang cấu hình chi tiết quy tắc tồn kho; dữ liệu quy tắc hiện có vẫn được bảo toàn khi sửa nhóm.
- Không thay đổi quyền xoá chỉ dành cho admin.
