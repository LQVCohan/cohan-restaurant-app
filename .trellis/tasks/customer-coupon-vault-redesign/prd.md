# PRD — Nâng cấp giao diện Kho Coupon

## Hiện trạng

- `CouponPage.jsx` đang dùng `CouponPage.scss`, nhưng `src/index.css` vẫn nạp thêm `CouponPage.product.css` từ phiên bản giao diện cũ.
- Stylesheet cũ chứa các selector như `.coupon-container`, `.dashboard-header`, `.ticket-card` không còn caller; một số selector chung vẫn ghi đè nền, padding và lưới hiện tại.
- Hero dùng bố cục card đối xứng, bốn KPI giống nhau và empty state phẳng nên chưa tạo cảm giác “ví ưu đãi”.
- Toolbar và empty state chiếm nhiều chiều cao khi chưa có dữ liệu.

## Luồng thật

`Coupon/UserCoupon model + schema` → `CouponQuery`/`UserCouponResolvers` → `useUserCoupons` và Apollo `Coupons` query → `CouponPage` → `CouponCard`/`CouponDetailModal` → lưu, bỏ lưu hoặc chuyển sang nhà hàng.

## Phạm vi

1. Hợp nhất giao diện về một stylesheet SCSS đang được component import trực tiếp.
2. Xóa stylesheet coupon cũ không còn caller và bỏ import toàn cục.
3. Thiết kế hero như một ví ưu đãi có chiều sâu, thống kê rõ hơn và toolbar gọn hơn.
4. Nâng cấp card, empty/loading/error state, modal và responsive mà không đổi contract dữ liệu.

## Tiêu chí nghiệm thu

- Không còn CSS coupon cũ ghi đè từ `index.css`.
- Hero, toolbar và empty state tạo thành một bố cục liền mạch ở desktop.
- Coupon card giữ đủ thông tin và hành động, không vỡ khi tên/mô tả dài.
- Trang dùng được ở 390×844, 430×932 và tablet; filter cuộn ngang thay vì tràn.
- Focus rõ, touch target tối thiểu hợp lý và tôn trọng `prefers-reduced-motion`.
- Test lưu/bỏ lưu, route nhà hàng và trạng thái lỗi vẫn giữ nguyên.

## Ngoài phạm vi

- Không đổi schema GraphQL, resolver, quyền truy cập hoặc restaurant scoping.
- Không đổi mutation lưu/bỏ lưu coupon.
- Không thêm dependency, font hoặc asset từ bên ngoài.
