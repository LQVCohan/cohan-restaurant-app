# Tối ưu quản lý danh mục nguyên liệu và tên tiếng Việt có dấu

## Hiện trạng

- Modal quản lý danh mục có quá nhiều lớp card, thông tin kỹ thuật và nhãn tiếng Anh nên khó quan sát nhanh.
- Luồng đồng bộ chuẩn hóa danh mục sang tên tiếng Anh, khiến dữ liệu được quét/tạo mới không lưu tên tiếng Việt có dấu.
- Tên danh mục tự nhập cũng bị chuyển sang tiếng Anh hoặc bị bỏ dấu ở một số trường hợp.

## Luồng thực tế

`Ingredient/IngredientCategory model -> ingredientCategory mutation + category classifier -> useIngredients/Apollo mutation -> IngredientList -> IngredientCategoryManagerModal`.

## Phạm vi thay đổi

- `cohan-restaurant-backend/graphql/resolvers/inventory/categoryAi.shared.js`: thêm chuẩn hóa tên danh mục nguyên liệu sang tiếng Việt có dấu, không thay đổi logic danh mục vật tư.
- `cohan-restaurant-backend/graphql/resolvers/inventory/ingredientCategory.mutation.js`: dùng tên tiếng Việt khi tạo, đổi tên và đồng bộ; giữ nguyên tên danh mục tùy chỉnh đã tồn tại.
- `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCategoryManagerModal.jsx`: giảm thông tin kỹ thuật, Việt hóa nhãn, hiển thị tóm tắt đồng bộ dễ đọc và làm rõ hỗ trợ tên có dấu.
- `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCategoryManagerModal.scss`: tinh gọn bố cục, tăng khả năng quan sát và sửa phần nội dung bị chật/cắt.

## Tiêu chí chấp nhận

- Danh mục đồng bộ chuẩn được lưu và trả về dạng `Thịt`, `Hải sản`, `Rau củ`, `Gia vị`, `Tinh bột`, `Sữa & trứng`, `Đồ uống`, `Khác`.
- Danh mục tùy chỉnh như `Đồ khô`, `Nước sốt nhà làm` giữ nguyên dấu tiếng Việt.
- Slug vẫn không dấu để chống trùng và truy vấn ổn định.
- Modal hiển thị nhãn tiếng Việt, tóm tắt đồng bộ dễ đọc, danh sách và hành động chính rõ ràng hơn.
- Không thay đổi schema GraphQL, quyền kho, phạm vi nhà hàng, audit log hoặc giao thức Apollo.

## Ngoài phạm vi

- Không thay đổi thuật toán phân loại nguyên liệu.
- Không thêm thư viện UI hoặc dependency.
- Không chạy CI toàn bộ.
