# PRD — Sửa giá vốn thấp nhất theo quy đổi đơn vị

## Hiện trạng

- Modal công thức hiển thị đúng giá vốn ước tính vì đã quy đổi số lượng từ đơn vị nhập về đơn vị gốc của nguyên liệu bằng `toBaseQty`.
- Danh sách công thức lại tính `minCost` bằng `qty * costPerBaseUnit` trực tiếp.
- Khi công thức nhập `100 g` nhưng nguyên liệu có `baseUnit = kg`, danh sách hiểu thành `100 kg`, làm giá vốn thấp nhất cao hơn rất nhiều so với giá vốn trong modal.
- Giao diện còn trộn tiếng Anh và tiếng Việt ở các nhãn như `Min Cost`, `Variants`, `recipe`, `cost`, `Key`, `ĐVT`.

## Luồng thật

`Ingredient(baseUnit, conversions, costPerBaseUnit)` → `inventory.graphql` / `RecipeIngredientLine` → `recipe.query.js` và type resolver → `recipe.gql.js` → `useRecipes.js` → `RecipeList.jsx` → `RecipeCard.jsx`.

Luồng lưu/chỉnh sửa đi qua `RecipeModal.jsx` → `useRecipes.buildUpsertInput` → `UpsertRecipeInput` → recipe mutation/model.

## Nguyên nhân gốc

`RecipeList.calcVariantCost` bỏ qua `line.unit`, `Ingredient.baseUnit` và `Ingredient.conversions`, trong khi `RecipeModal.calculateVariantCost` đã dùng helper chung `toBaseQty`. Hai màn hình vì vậy tính cùng một công thức theo hai cách khác nhau.

## Phạm vi

- Dùng `toBaseQty` trong `RecipeList` trước khi nhân với `costPerBaseUnit`.
- Giữ nguyên schema, resolver, dữ liệu lưu, quyền truy cập và mutation.
- Thêm regression test cho trường hợp công thức dùng gam còn nguyên liệu định giá theo kilôgam.
- Việt hóa các nhãn trực tiếp liên quan đến công thức, biến thể và giá vốn.

## File thay đổi

- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx`: sửa phép tính giá vốn thấp nhất và tiêu đề/mô tả trang.
- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.test.jsx`: kiểm tra quy đổi `100 g -> 0,1 kg` trước khi tính giá vốn.
- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeCard.jsx`: đổi nhãn trạng thái và chỉ số sang tiếng Việt.
- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx`: làm rõ các nhãn trong modal bằng tiếng Việt tự nhiên.

## Tiêu chí nghiệm thu

- Bánh phở 100 g giá 50 đ/g và thịt bò 100 g giá 220.000 đ/kg cho giá vốn ước tính và giá vốn thấp nhất cùng bằng 27.000 đ.
- Giá bán 30.000 đ không bị dùng để tính giá vốn; hai khái niệm được ghi nhãn rõ ràng.
- Không còn các nhãn `Min Cost`, `Variants`, `Chưa có recipe`, `Thiếu cost`, `Định danh (Key)` và `ĐVT` trong vùng giao diện được sửa.
- Không thay đổi contract GraphQL hoặc cách lưu công thức.

## Validation

- `npm run check:conflicts`
- `vitest run src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.test.jsx`
- `npm run build`

## Ngoài phạm vi

- Không đổi cách nhập giá nguyên liệu.
- Không thêm trường giá vốn vào database.
- Không thiết kế lại toàn bộ trang kho hoặc modal công thức.
