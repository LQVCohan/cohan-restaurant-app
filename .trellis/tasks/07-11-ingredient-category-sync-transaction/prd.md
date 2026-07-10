# PRD — Sửa lỗi transaction khi quét danh mục nguyên liệu

## Hiện trạng

Sau khi xóa một danh mục nhưng vẫn còn các danh mục khác, nút **Quét nguyên liệu** có thể trả lỗi MongoDB:

`Given transaction number ... does not match any in-progress transactions`

Xóa toàn bộ danh mục có thể không tái hiện do thời điểm hoàn thành truy vấn khác nhau.

## Luồng thật

`IngredientCategory/Ingredient model -> inventory GraphQL schema -> ingredientCategory.mutation.js -> inventory.gql.js -> useIngredients -> IngredientList -> IngredientCategoryManagerModal`.

Hai mutation `syncIngredientCategories` và `syncIngredientCategoriesFromIngredients` cùng gọi `runIngredientCategorySync`.

## Nguyên nhân gốc

`runIngredientCategorySync` chạy `Ingredient.find` và `IngredientCategory.find` bằng `Promise.all` trong cùng một transaction session. MongoDB/Mongoose không hỗ trợ các operation chạy song song trên cùng session transaction; dữ liệu sau khi xóa một phần làm race này lộ ra thành lỗi transaction number.

## Phạm vi sửa

- Chạy tuần tự hai truy vấn mở đầu trong transaction.
- Thêm kiểm tra hồi quy ngăn việc đưa `Promise.all` trở lại đoạn đọc dữ liệu transaction.
- Giữ nguyên schema GraphQL, quyền kho, restaurant scope, thuật toán phân loại, audit log và UI.

## File thay đổi

- `cohan-restaurant-backend/graphql/resolvers/inventory/ingredientCategory.mutation.js`
- `cohan-restaurant-backend/tests/resolvers/ingredient-category-normalization.test.js`

## Tiêu chí nghiệm thu

- Xóa một danh mục rồi quét lại không còn lỗi transaction number.
- Xóa toàn bộ rồi quét vẫn tạo lại danh mục bình thường.
- Hai mutation đồng bộ dùng chung vẫn hoạt động.
- Không thay đổi contract frontend/backend.

## Validation

```bash
npm --prefix cohan-restaurant-backend test -- tests/resolvers/ingredient-category-normalization.test.js
npm run check:conflicts
```
