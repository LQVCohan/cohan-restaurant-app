# Tối ưu trải nghiệm thêm, sửa và xóa nguyên liệu

## Hiện trạng

- Modal thêm/sửa chia quá nhiều khối thẻ, chiều cao lớn và phải cuộn nhiều dù số trường không nhiều.
- Nút lưu được đặt bên trong vùng cuộn rồi giữ bằng CSS `position: sticky`, làm cấu trúc modal khó ổn định trên màn hình thấp.
- Trường giá vốn luôn hiển thị biểu tượng đô la dù nhà hàng đang dùng VND.
- Gợi ý đơn vị được mô tả là AI dù thực tế là quy tắc theo tên nguyên liệu.
- Xóa mềm và xóa vĩnh viễn dùng `window.confirm`, không giải thích rõ thời hạn khôi phục hoặc hậu quả không thể hoàn tác.
- Lỗi xóa do nguyên liệu đang được dùng trong món hoạt động hiển thị bằng một overlay riêng, không dùng hành vi focus/keyboard của Modal chung.

## Nguyên nhân gốc

Hợp đồng dữ liệu và quyền truy cập hiện đúng. Vấn đề nằm tại biên UI: `IngredientModal` chưa dùng cấu trúc `Modal.Body` + `Modal.Footer` đúng mục đích, còn `IngredientList` triển khai nhiều kiểu xác nhận xóa riêng thay vì dùng Modal chung.

## Luồng đã đối chiếu

1. Mongoose: `cohan-restaurant-backend/models/ingredient.model.js`.
2. GraphQL schema/resolver/guard: `inventory.graphql` → `ingredient.mutation.js` → `requireRestaurantPermission`.
3. Apollo: `inventory.gql.js` → `useIngredients.js`.
4. UI action: `IngredientCard.jsx` → `IngredientList.jsx` → `IngredientModal.jsx`.
5. Test gần nhất: `IngredientModal.test.jsx`.

## File thay đổi

- `IngredientModal.jsx`: gom nhóm trường, sửa copy/ký hiệu tiền tệ và dùng footer chuẩn.
- `IngredientModalEnhancements.css`: bố cục compact, responsive, focus và footer.
- `IngredientList.jsx`: modal xác nhận xóa mềm/xóa vĩnh viễn và modal bị chặn.
- `IngredientList.scss`: style cho luồng xác nhận xóa.
- `IngredientModal.test.jsx`: kiểm tra trạng thái, ký hiệu tiền và footer.

## Tiêu chí nghiệm thu

- Modal thêm/sửa chỉ còn hai nhóm thông tin chính, dễ quan sát trên desktop và xếp một cột trên mobile.
- Footer hành động luôn tách khỏi vùng cuộn; không che nội dung.
- VND hiển thị `₫`, USD hiển thị `$`.
- Trạng thái dùng ngôn ngữ quản lý kho: “Đang sử dụng” và “Tạm ngưng”.
- Xóa mềm nêu rõ bản ghi vào thùng rác và có thể khôi phục trong 30 ngày.
- Xóa vĩnh viễn nêu rõ không thể hoàn tác.
- Khi xóa bị chặn, modal liệt kê món đang hoạt động đang dùng nguyên liệu.
- Giữ nguyên permission, restaurant scope, refetch, undo và lỗi từ backend.

## Ngoài phạm vi

- Không đổi schema, resolver, mutation hoặc chính sách xóa 30 ngày.
- Không thêm thư viện hay abstraction modal mới.
- Không thiết kế lại toàn bộ trang kho.

## Kiểm tra dự kiến

```bash
npx vitest run src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.test.jsx
npm run check:conflicts
```
