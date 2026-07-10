# Tối ưu header quản lý chuỗi

## Hiện trạng và nguyên nhân gốc

- Header dùng `ManagementPageHeader` ở chế độ `compact`, nhưng ba KPI vẫn là ba card tách rời khá lớn.
- `mph-right` dùng `display: contents`, khiến metadata vai trò/trạng thái tự rơi vào một hàng riêng và tạo khoảng trống không cân đối.
- Select chuỗi và nút làm mới nằm trong một cột hành động rộng, chưa tạo được hierarchy rõ giữa thông tin, số liệu và thao tác.
- Icon hiện tại dùng emoji/ký tự hỗn hợp thay vì icon Lucide đã có trong dự án.

## Luồng thật đã kiểm tra

`Brand`/`BrandMembership` model → `brand.graphql` (`myBrands`, `myBrandMemberships`, `brandMembers`) → `brand/index.js` kiểm tra xác thực/phạm vi → `useBrandManagement` chuẩn hóa chuỗi và chi nhánh → `BrandManagement` tính KPI → `ManagementPageHeader` render title, stats, select, refresh và metadata.

Dữ liệu, permission và hành vi chọn chuỗi/làm mới đang đúng. Thay đổi chỉ nằm ở presentation layer.

## Hướng thiết kế

Compact chain operations header: title rõ bên trái, KPI trong một dải thống kê chung, metadata thành chip nhỏ và cụm chọn chuỗi/làm mới gọn bên phải; dùng palette sage/cream hiện có.

## File thay đổi

- `src/components/Dashboard_Manager/Brand/BrandManagement.jsx`: dùng icon Lucide và class header riêng.
- `src/components/Dashboard_Manager/Brand/BrandManagement.css`: layout desktop/tablet/mobile, KPI strip, metadata chips và focus/touch states.

## Tiêu chí nghiệm thu

- Header thấp và cân đối hơn, không còn ba KPI card rời quá lớn.
- Title, KPI, chọn chuỗi và làm mới có thứ tự nhìn rõ.
- Vai trò và trạng thái hiển thị gọn, không tạo hàng trống lớn.
- Select và nút giữ touch target tối thiểu 44px, focus rõ.
- 1440/1024/768/430/390 px không tràn ngang; mobile không biến header thành chuỗi card dài.
- Không thay đổi GraphQL, permission, restaurant scoping hoặc hành vi refresh.

## Kiểm tra

- `vitest run src/components/Dashboard_Manager/Brand/BrandManagement.test.jsx`
- `npm run build`
- Manual responsive code audit tại 1440, 1024, 768, 430 và 390 px.
