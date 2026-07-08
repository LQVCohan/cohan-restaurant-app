# PRD — Bổ sung danh sách ngang cho giao diện kho

## Hiện trạng

Màn hình Quản lý kho chỉ hiển thị nguyên liệu, vật tư và công thức dưới dạng thẻ. Khi dữ liệu nhiều, mỗi thẻ chiếm nhiều chiều cao nên quản lý khó quét nhanh số lượng lớn nguyên liệu, vật phẩm, món và cách chế biến.

## Luồng thật

- Nguyên liệu: `Ingredient schema` → resolver `ingredients` / `stockItems` → `useIngredients` → `IngredientList` → `IngredientCard`.
- Vật tư/vật phẩm: `Supply schema` → `supply.graphql` → resolver `supplies` / `supplyTrash` → `useSupply` → `SupplyList` → `SupplyCard`.
- Công thức: `Recipe.servingVariants` → resolver `menuItemsWithRecipes` → `useRecipes` → `RecipeList` → `RecipeCard`.
- Các resolver vẫn giữ phạm vi nhà hàng và quyền truy cập hiện có. Dữ liệu cần cho cả hai kiểu hiển thị đã có sẵn, không cần thay đổi backend hoặc GraphQL contract.

## Nguyên nhân gốc

Bố cục danh sách đang được cố định bằng CSS Grid trong từng tab và chưa có lựa chọn kiểu hiển thị ở thanh tab dùng chung.

## Phạm vi thay đổi

- Thêm bộ chuyển native radio `Thẻ / Danh sách` cạnh các tab Nguyên liệu, Vật tư & Khác và Công thức.
- Giữ chế độ đã chọn khi chuyển giữa ba tab danh mục trong cùng phiên màn hình.
- Dùng CSS `:has()` tại shell kho để chuyển các card hiện có thành hàng ngang; không tạo component dữ liệu, state dùng chung hoặc query mới.
- Hàng vật tư vẫn giữ tồn kho, ngưỡng cảnh báo, giá vốn, giá bán, ghi chú và các thao tác nhập/xuất/chuyển/sửa/xóa.
- Trên màn hình nhỏ hơn 900 px, ẩn bộ chuyển và tiếp tục ưu tiên bố cục một cột để tránh hàng ngang bị nén khó đọc.

## Tiêu chí nghiệm thu

- Mặc định vẫn hiển thị dạng thẻ như hiện tại.
- Người dùng có thể chuyển sang danh sách ngang tại tab Nguyên liệu, Vật tư & Khác và Công thức trên màn hình quản lý desktop.
- Danh sách ngang hiển thị nhiều bản ghi hơn trong cùng chiều cao màn hình và vẫn giữ số liệu, trạng thái cùng nút thao tác chính.
- Bộ chuyển dùng radio semantic, focus rõ và không xuất hiện ở tab Kiểm kê.
- Chuyển giữa ba tab danh mục không làm mất lựa chọn bố cục.
- Không thay đổi quyền, mutation, realtime, công thức tính tồn hoặc dữ liệu kho.

## File thay đổi

- `src/components/Dashboard_Manager/Storage/layout/Tabs/Tabs.jsx`: bật bộ chuyển kiểu hiển thị cho cả tab vật tư.
- `src/components/Dashboard_Manager/Storage/layout/Tabs/Tabs.scss`: tạo segmented control và bố cục hàng ngang dùng chung cho thẻ nguyên liệu, vật tư và công thức.
- `src/components/Dashboard_Manager/Storage/layout/Tabs/Tabs.test.jsx`: kiểm tra lựa chọn mặc định, chuyển sang danh sách và duy trì khi đổi qua tab vật tư/công thức.

## Ngoài phạm vi

- Không thêm dependency hoặc design system mới.
- Không lưu lựa chọn bố cục lên server hoặc localStorage.
- Không thay đổi schema, resolver, Apollo query hay hook dữ liệu.
