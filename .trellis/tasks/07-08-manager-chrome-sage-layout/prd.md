# PRD — Đồng bộ màu và layout header/sidebar quản lý

## Hiện trạng

- Nội dung trang quản lý đã dùng palette sage từ `ManagerUnifiedBackground.css`, nhưng header và sidebar vẫn hardcode nền kem, accent nâu/cam và shadow tông ấm.
- Header giới hạn ở 1160 px trong khi page shell rộng đến 1500 px; grid hai cột biên `1fr` làm vùng search bị bó và không thẳng hàng với content.
- Ở khoảng 901–1080 px, bộ chọn phạm vi bị ẩn nhưng header vẫn giữ grid ba cột, tạo một cột trống và làm cụm search/tài khoản lệch.

## Luồng thật

`ManagerLayout.jsx` → truyền `sidebarOpen`, phạm vi Brand/Restaurant và page hiện tại → `Header.jsx` / `Sidebar.jsx` → `HeaderShellFix.scss` / `SidebarShellFix.scss` → hiển thị chrome quản lý.

Thay đổi chỉ thuộc presentation; không đổi schema, resolver/service, GraphQL operation, Apollo hook, quyền, điều hướng hoặc trạng thái component.

## Phạm vi

1. Dùng các CSS custom properties sage có sẵn của manager shell cho header và sidebar.
2. Cân lại grid header để scope, search và tài khoản dùng chiều ngang hợp lý và thẳng hàng với page shell.
3. Chuyển header sang layout hai cột ngay khi scope bị ẩn.
4. Đồng bộ hover, active, focus, border và shadow của sidebar; giữ nguyên kích thước rail và hành vi thu gọn.
5. Giữ responsive mobile và `prefers-reduced-motion` hiện có.

## File thay đổi

- `src/components/Dashboard_Manager/Styles/HeaderShellFix.scss`: palette và grid header.
- `src/components/Dashboard_Manager/Styles/SidebarShellFix.scss`: palette và trạng thái sidebar.

## Tiêu chí nghiệm thu

- Header/sidebar không còn nền cam–kem lệch với phần nội dung sage.
- Header desktop thẳng hàng với page shell, search tận dụng khoảng trống thay vì bị khóa ở 25–30 rem.
- Không còn cột trống ở breakpoint 901–1080 px.
- Active/hover/focus vẫn rõ, không chỉ phụ thuộc màu.
- Sidebar đóng/mở, menu, search, notification và tài khoản giữ nguyên hành vi.
- Không tràn ngang ở 390×844 và 430×932.

## Validation

- `npm run check:conflicts`
- `npm run build`
- Browser smoke desktop, 430×932 và 390×844

## Ngoài phạm vi

- Không đổi logo/wordmark.
- Không thay đổi nội dung trang hồ sơ nhà hàng.
- Không thêm dependency hoặc design system mới.
