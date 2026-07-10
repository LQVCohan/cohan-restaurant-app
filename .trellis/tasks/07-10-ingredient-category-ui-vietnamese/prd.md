# Tối ưu quản lý danh mục nguyên liệu và tên tiếng Việt có dấu

## Hiện trạng

- Modal quản lý danh mục có quá nhiều lớp card, thông tin kỹ thuật và nhãn tiếng Anh nên khó quan sát nhanh.
- Luồng đồng bộ chuẩn hóa danh mục sang tên tiếng Anh, khiến dữ liệu được quét/tạo mới không lưu tên tiếng Việt có dấu.
- Tên danh mục tự nhập cũng bị chuyển sang tiếng Anh hoặc bị bỏ dấu ở một số trường hợp.
- Bố cục desktop dùng đồng thời cuộn ở modal, cột trái và danh sách phải nên dòng cuối bị cắt, tạo cảm giác nội dung bị đè.
- Thông báo quét dùng chuỗi thống kê khô, chưa nêu rõ thao tác đã thành công.
- Dữ liệu cũ còn dùng hai mã `grain` và `dairy`; bộ chuẩn hóa mới chưa nhận hai alias này nên một số danh mục vẫn hiện tiếng Anh.
- Khi alias cũ có slug khác slug chuẩn, lần quét tiếp theo có thể tạo thêm danh mục mới thay vì nâng cấp bản ghi cũ.

## Luồng thực tế

`Ingredient/IngredientCategory model -> ingredientCategory mutation + category classifier -> useIngredients/Apollo mutation -> IngredientList -> IngredientCategoryManagerModal`.

## Nguyên nhân gốc của phần còn tiếng Anh

- `src/utils/constants.js` và script seed cũ dùng `grain`, `dairy`.
- `categoryAi.shared.js` chỉ nhận `starch` và `dairy & egg` nên giữ nguyên hai giá trị cũ.
- `ingredientCategory.mutation.js` dò danh mục theo slug đã lưu, vì vậy `grain` không được coi là cùng nhóm với slug chuẩn `starch`.
- Helper hiển thị frontend cũng thiếu hai alias này nên dữ liệu cũ lộ trực tiếp ra giao diện.

## Phạm vi thay đổi

- `cohan-restaurant-backend/graphql/resolvers/inventory/categoryAi.shared.js`: thêm chuẩn hóa tên danh mục nguyên liệu sang tiếng Việt có dấu, gồm alias cũ `grain` và `dairy`; không thay đổi logic danh mục vật tư.
- `cohan-restaurant-backend/graphql/resolvers/inventory/ingredientCategory.mutation.js`: dùng tên tiếng Việt khi đồng bộ; nâng cấp slug cũ ngay trên bản ghi hiện có và vô hiệu hóa bản ghi alias trùng.
- `src/utils/ingredientCategoryI18n.js`: hiển thị tiếng Việt cho dữ liệu legacy trước khi quét lại.
- `cohan-restaurant-backend/tests/resolvers/ingredient-category-normalization.test.js`: kiểm tra alias backend.
- `src/utils/ingredientCategoryI18n.test.js`: kiểm tra nhãn hiển thị frontend.
- `cohan-restaurant-backend/graphql/resolvers/inventory/ingredient.mutation.js` đã được kiểm tra nhưng không sửa: luồng UI hiện gửi `ingredientCategoryId`, còn lỗi được xử lý đúng tại ranh giới đồng bộ dùng chung.

## Tiêu chí chấp nhận

- Danh mục đồng bộ chuẩn được lưu và trả về dạng `Thịt`, `Hải sản`, `Rau củ`, `Gia vị`, `Tinh bột`, `Sữa & trứng`, `Đồ uống`, `Khác`.
- `grain` được nâng cấp thành `Tinh bột` với slug chuẩn `starch`.
- `dairy` được nâng cấp thành `Sữa & trứng` với slug chuẩn `dairy-egg`.
- Bản ghi alias cũ không còn xuất hiện như một danh mục hoạt động trùng sau khi quét.
- Danh mục tùy chỉnh như `Đồ khô`, `Nước sốt nhà làm` giữ nguyên dấu tiếng Việt.
- Slug vẫn không dấu để chống trùng và truy vấn ổn định.
- Modal hiển thị nhãn tiếng Việt ngay cả với dữ liệu cũ trước khi quét lại.
- Không thay đổi schema GraphQL, quyền kho, phạm vi nhà hàng, audit log hoặc giao thức Apollo.

## Ngoài phạm vi

- Không thay đổi thuật toán phân loại nguyên liệu ngoài việc nhận alias legacy đã tồn tại trong repo.
- Không thêm thư viện UI hoặc dependency.
- Không chạy CI toàn bộ.

## Kiểm tra dự kiến

```bash
npx vitest run src/utils/ingredientCategoryI18n.test.js
npm --prefix cohan-restaurant-backend test -- tests/resolvers/ingredient-category-normalization.test.js
npm run check:conflicts
```
