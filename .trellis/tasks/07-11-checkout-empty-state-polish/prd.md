# PRD — Trạng thái checkout khi giỏ hàng trống

## Hiện trạng

Khi khách hàng truy cập `/checkout` với giỏ hàng trống, trang chỉ hiển thị biểu tượng, tiêu đề và hai nút giữa một khoảng nền rất lớn. Hai nút đều dùng cùng kiểu màu cam nên không có thứ bậc hành động, card không có bề mặt rõ ràng và giao diện thiếu cảm giác hoàn thiện so với các trang khách hàng khác.

## Luồng thật

1. `AppRouter` đặt `/checkout` trong `CustomerLayout` và bảo vệ bằng role `customer`.
2. `CheckoutPage` đọc giỏ hàng từ `CartProvider`, kiểm tra đăng nhập, role, backend cart reference và thời hạn giữ món.
3. Khi không có món, `CheckoutPage` render `CheckoutBlockedState` với các class card, icon, eyebrow, actions, primary và secondary.
4. Thay đổi này chỉ hoàn thiện lớp CSS đã có; không đổi schema, resolver, service, GraphQL/Apollo, dữ liệu giỏ hàng hay điều hướng.

## Nguyên nhân gốc

`CheckoutPage.jsx` đã có markup đủ để tạo một empty state hoàn chỉnh, nhưng `CheckoutPage.polish.css` chỉ style phần nền, heading, paragraph và áp cùng gradient cam cho mọi button. Các class `checkout-empty-state__card`, `__icon`, `__eyebrow`, `__actions` và `.btn--secondary` chưa có style tương ứng nên nội dung trông rời rạc và hai hành động không được phân cấp.

## Hướng thiết kế

Card checkout ấm, gọn và có chiều sâu nhẹ; icon là điểm nhấn duy nhất, nút quay lại thực đơn là CTA chính, khám phá nhà hàng là hành động phụ rõ ràng.

## Phạm vi

- Hoàn thiện card trạng thái bị chặn/trống bằng bề mặt, border, shadow và pattern nhẹ phù hợp nhận diện COHAN.
- Tăng phân cấp icon, eyebrow, tiêu đề và mô tả.
- Tách rõ button chính và phụ; thêm hover, active và focus-visible.
- Giữ touch target tối thiểu 44 px và bố cục xếp dọc an toàn trên mobile.
- Tôn trọng `prefers-reduced-motion` và không thêm dependency.

## Tiêu chí nghiệm thu

- Nội dung checkout trống nằm trong một card rõ ràng, cân đối, không còn trôi giữa khoảng nền lớn.
- CTA chính và hành động phụ khác nhau rõ ràng nhưng cùng hệ thiết kế.
- Keyboard focus nhìn thấy được; button có hover/pressed feedback.
- Không tràn ngang tại 390×844, 430×932, 768, 1024 và 1440 px.
- Các trạng thái khác dùng chung `CheckoutBlockedState` vẫn hiển thị đúng.
- Không thay đổi logic checkout, giỏ hàng, quyền, route hoặc dữ liệu.

## Ngoài phạm vi

- Thay đổi nội dung nghiệp vụ hoặc điều kiện chặn checkout.
- Thiết kế lại modal thanh toán có món.
- Thêm minh họa ảnh, animation library hoặc component mới.

## Xác minh

- `npm run check:conflicts`
- `npm run build`
- Kiểm tra trực quan desktop.
- Kiểm tra responsive tại 390×844 và 430×932.
