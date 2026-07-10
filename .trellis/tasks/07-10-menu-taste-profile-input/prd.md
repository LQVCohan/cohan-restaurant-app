# PRD — Sửa lỗi lưu hồ sơ khẩu vị món ăn

## Hiện trạng

- Khi chỉnh sửa món đã tải từ Apollo cache, `tasteProfile` chứa metadata `__typename: "MenuItemTasteProfile"`.
- `MenuItemModal` đang trải toàn bộ object này vào biến mutation `UpdateMenuItemInput`.
- GraphQL từ chối trước khi vào resolver vì `MenuItemTasteProfileInput` chỉ chấp nhận `containsOnion`, `containsCilantro`, `sugar` và `spice`.

## Luồng thật

`menuitem.model.js` → `menu.graphql` (`MenuItemTasteProfileInput`) → `menu/mutation.js` (`normalizeTasteProfile`) → `useMenuManagement.js` (`FRAG_MENU_ITEM`, `updateMenuItem`) → `MenuManagement.jsx` → `MenuItemModal.jsx` (`handleSubmit`).

Schema, model và resolver đã đồng bộ đúng bốn trường nghiệp vụ. Sai lệch nằm ở mapper phía giao diện trước khi gọi mutation.

## Nguyên nhân gốc

`MenuItemModal` lấy `currentItem.tasteProfile` từ kết quả GraphQL và lưu trực tiếp vào form state. Apollo tự gắn `__typename`; thao tác spread khi dựng payload làm metadata output bị gửi ngược vào input GraphQL.

## Phạm vi

- Chỉ dựng `tasteProfile` mutation payload bằng bốn trường được schema cho phép.
- Áp dụng cho cả tạo mới và cập nhật món vì hai luồng dùng chung `menuItemPayload`.
- Giữ nguyên validation, quyền menu, restaurant scope, audit log, recipe update và optimistic cache hiện tại.

## File thay đổi

- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx`: allowlist bốn trường `tasteProfile` trước khi gọi `createMenuItem` / `updateMenuItem`.
- `.trellis/tasks/07-10-menu-taste-profile-input/task.json`: cập nhật trạng thái và kết quả validation sau triển khai.

## Tiêu chí nghiệm thu

- Lưu món đã có `tasteProfile.__typename` không còn báo `Field "__typename" is not defined by type "MenuItemTasteProfileInput"`.
- Giá trị hành, ngò, mức ngọt và mức cay vẫn được gửi đúng.
- Không thay đổi schema backend để chấp nhận metadata Apollo.
- Trang quản lý menu và các thao tác recipe tiếp tục hoạt động như hiện tại.

## Validation

- `npm run check:conflicts`
- `npm run check:graphql`
- Targeted Vitest cho payload `tasteProfile` nếu có hạ tầng test phù hợp.

## Ngoài phạm vi

- Không thêm Apollo link toàn cục để xóa `__typename` cho mọi mutation.
- Không thay đổi giao diện hoặc cấu trúc quản lý menu.
- Không sửa backend vì lỗi xảy ra trước resolver và schema hiện tại là đúng.
