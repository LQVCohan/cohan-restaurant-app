# PRD — Đồng bộ nền trang quản lý thực đơn

## Hiện trạng

- `ManagerLayout` đã cung cấp nền sage thống nhất cho toàn bộ vùng nội dung quản lý.
- Trang thực đơn vẫn tự tạo một canvas kem tại `.mm-page-container` và một lớp lưới bằng `::before`, nên xuất hiện mảng nền hình chữ nhật khác màu ở giữa trang.

## Luồng thật

`ManagerLayout.jsx` → `manager-page-shell` → `MenuManagement.jsx` → `MenuManagement.scss` / `MenuManagementPolish.scss`.

Thay đổi chỉ thuộc presentation; không đổi schema, resolver/service, GraphQL operation, Apollo hook, quyền, điều hướng hoặc trạng thái component.

## Nguyên nhân gốc

Các lớp SCSS cũ của trang menu đặt `background: ... !important` trực tiếp trên `.mm-page-container` và dùng pseudo-element cố định để vẽ lưới. Hai lớp này che nền do manager shell sở hữu.

## Phạm vi

- Để `.mm-page-container` trong route menu trong suốt.
- Tắt pseudo-element nền của page root.
- Giữ nguyên nền riêng của header, KPI, toolbar, card, modal và các trạng thái nghiệp vụ.

## File thay đổi

- `src/components/Dashboard_Manager/Menu/MenuManagementPolish.scss`: thêm override cuối bundle để manager shell là chủ sở hữu duy nhất của nền trang.

## Tiêu chí nghiệm thu

- Không còn mảng nền kem hình chữ nhật phía sau toàn bộ nội dung menu.
- Nền sage của manager shell hiển thị liên tục từ hai bên vào giữa trang.
- Header, KPI, toolbar và thẻ món vẫn giữ surface riêng, độ tương phản và hành vi hiện tại.
- Không thay đổi layout, dữ liệu, thao tác hoặc responsive.

## Validation

- `npm run check:conflicts`
- `npm run build`
- Browser smoke desktop, 430×932 và 390×844

## Ngoài phạm vi

- Không đổi palette hoặc cấu trúc các card.
- Không sửa backend, GraphQL hoặc dependency.
