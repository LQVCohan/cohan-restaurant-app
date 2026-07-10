# PRD — Sửa lỗi Apollo `__typename` trong mutation input

## Hiện trạng

- Khi chỉnh sửa món đã tải từ Apollo cache, `tasteProfile` chứa metadata `__typename: "MenuItemTasteProfile"`.
- `MenuItemModal` dùng object này để dựng biến mutation `UpdateMenuItemInput`.
- GraphQL từ chối trước khi vào resolver vì `MenuItemTasteProfileInput` chỉ chấp nhận `containsOnion`, `containsCilantro`, `sugar` và `spice`.

## Luồng thật

`menuitem.model.js` → `menu.graphql` (`MenuItemTasteProfileInput`) → `menu/mutation.js` (`normalizeTasteProfile`) → `useMenuManagement.js` (`FRAG_MENU_ITEM`, `updateMenuItem`) → `MenuManagement.jsx` → `MenuItemModal.jsx` (`handleSubmit`) → Apollo HTTP link.

Schema, model và resolver đã đồng bộ đúng bốn trường nghiệp vụ. Sai lệch là metadata Apollo từ output object bị gửi ngược vào GraphQL input.

## Nguyên nhân gốc

Apollo cache tự thêm `__typename` vào object kết quả. Ứng dụng hiện chưa có bước loại metadata này khỏi variables trước khi gửi qua HTTP, nên bất kỳ mutation nào tái sử dụng object từ cache đều có thể gặp lỗi input tương tự.

## Phạm vi

- Dùng `removeTypenameFromVariables` có sẵn trong Apollo Client tại link chung trước `HttpLink`.
- Giữ nguyên các link chuẩn hóa enum, idempotency, xác thực và xử lý lỗi hiện tại.
- Thêm kiểm thử xác nhận `__typename` lồng trong `tasteProfile` bị xóa nhưng bốn trường nghiệp vụ vẫn được giữ.

## File thay đổi

- `src/apollo/client.js`: thêm Apollo link loại `__typename` khỏi GraphQL variables.
- `src/apollo/client.test.js`: kiểm tra request body của mutation không còn metadata Apollo.
- `.trellis/tasks/07-10-menu-taste-profile-input/task.json`: cập nhật trạng thái và kết quả validation sau triển khai.

## Tiêu chí nghiệm thu

- Lưu món đã có `tasteProfile.__typename` không còn báo `Field "__typename" is not defined by type "MenuItemTasteProfileInput"`.
- Giá trị hành, ngò, mức ngọt và mức cay vẫn được gửi đúng.
- Không thay đổi schema backend để chấp nhận metadata Apollo.
- Các link idempotency, enum normalization và auth vẫn chạy trước request HTTP.

## Validation

- `npm run check:conflicts`
- `npm run check:graphql`
- `vitest run src/apollo/client.test.js`

## Ngoài phạm vi

- Không đổi giao diện hoặc cấu trúc quản lý menu.
- Không sửa backend vì lỗi xảy ra trước resolver và schema hiện tại là đúng.
- Không thêm dependency mới; dùng API có sẵn của `@apollo/client`.
