# Tối ưu quản lý danh mục nguyên liệu và tên tiếng Việt có dấu

## Hiện trạng

- Modal quản lý danh mục có quá nhiều lớp card, thông tin kỹ thuật và nhãn tiếng Anh nên khó quan sát nhanh.
- Luồng đồng bộ chuẩn hóa danh mục sang tên tiếng Anh, khiến dữ liệu được quét/tạo mới không lưu tên tiếng Việt có dấu.
- Tên danh mục tự nhập cũng bị chuyển sang tiếng Anh hoặc bị bỏ dấu ở một số trường hợp.
- Bố cục desktop dùng đồng thời cuộn ở modal, cột trái và danh sách phải nên dòng cuối bị cắt, tạo cảm giác nội dung bị đè.
- Thông báo quét dùng chuỗi thống kê khô, chưa nêu rõ thao tác đã thành công.

## Luồng thực tế

`Ingredient/IngredientCategory model -> ingredientCategory mutation + category classifier -> useIngredients/Apollo mutation -> IngredientList -> IngredientCategoryManagerModal`.

## Phạm vi thay đổi

- `cohan-restaurant-backend/graphql/resolvers/inventory/categoryAi.shared.js`: thêm chuẩn hóa tên danh mục nguyên liệu sang tiếng Việt có dấu, không thay đổi logic danh mục vật tư.
- `cohan-restaurant-backend/graphql/resolvers/inventory/ingredientCategory.mutation.js`: dùng tên tiếng Việt khi tạo, đổi tên và đồng bộ; giữ nguyên tên danh mục tùy chỉnh đã tồn tại; trả thông báo quét thành công bằng câu tiếng Việt dễ đọc.
- `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCategoryManagerModal.jsx`: giảm thông tin kỹ thuật, Việt hóa nhãn, hiển thị tóm tắt đồng bộ dễ đọc, làm rõ hỗ trợ tên có dấu và xóa bản vá đặt lại vị trí cuộn cũ.
- `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCategoryManagerModal.scss`: dùng một vùng cuộn duy nhất ở thân modal, để danh sách tự mở rộng theo nội dung và không cắt nửa dòng.

## Tiêu chí chấp nhận

- Danh mục đồng bộ chuẩn được lưu và trả về dạng `Thịt`, `Hải sản`, `Rau củ`, `Gia vị`, `Tinh bột`, `Sữa & trứng`, `Đồ uống`, `Khác`.
- Danh mục tùy chỉnh như `Đồ khô`, `Nước sốt nhà làm` giữ nguyên dấu tiếng Việt.
- Slug vẫn không dấu để chống trùng và truy vấn ổn định.
- Modal hiển thị nhãn tiếng Việt, tóm tắt đồng bộ dễ đọc, danh sách và hành động chính rõ ràng hơn.
- Danh sách không còn scrollbar lồng và không hiển thị dòng bị cắt phía trên thanh phân trang.
- Thông báo sau khi quét bắt đầu bằng `Quét thành công` và nêu số danh mục mới, danh mục cập nhật, nguyên liệu gán lại và lỗi.
- Không thay đổi schema GraphQL, quyền kho, phạm vi nhà hàng, audit log hoặc giao thức Apollo.

## Ngoài phạm vi

- Không thay đổi thuật toán phân loại nguyên liệu.
- Không thêm thư viện UI hoặc dependency.
- Không chạy CI toàn bộ.