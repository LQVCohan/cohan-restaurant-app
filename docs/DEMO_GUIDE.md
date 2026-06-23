# Demo & Handover Guide

## Mục tiêu demo cuối

Trình diễn Cohan Restaurant App như một sản phẩm quản trị nhà hàng hoàn chỉnh: cấu hình nhà hàng, menu, đặt bàn/đặt món, POS/order, coupon/promotion, review, AI chatbot, RBAC, scheduling/attendance/payroll/performance và báo cáo/đối soát.

## Chuẩn bị dữ liệu

```bash
npm run seed:demo:menu-management --prefix cohan-restaurant-backend
npm run seed:demo:coupon-promotion --prefix cohan-restaurant-backend
npm run seed:demo:customers --prefix cohan-restaurant-backend
npm run seed:demo:scheduling --prefix cohan-restaurant-backend
npm run seed:demo:payroll-readiness --prefix cohan-restaurant-backend
npm run seed:rbac --prefix cohan-restaurant-backend
```

Sau seed, chạy verify tương ứng nếu demo module nhân sự/performance:

```bash
npm run verify:demo:scheduling-attendance --prefix cohan-restaurant-backend
npm run verify:demo:performance --prefix cohan-restaurant-backend
```

## Kịch bản trình diễn đề xuất

1. **Manager login & dashboard**: giới thiệu cấu trúc hệ thống, health trạng thái demo và các module chính.
2. **Restaurant/menu management**: cập nhật cấu hình, category/item, ảnh menu và trạng thái bán.
3. **Customer flow**: khách xem menu/nearby restaurant, đặt bàn hoặc tạo đơn.
4. **Coupon/promotion**: áp dụng `ACTIVE10`, sau đó trình diễn BOGO/freeship/combo nếu seed có dữ liệu.
5. **POS/order manager**: xử lý đơn, parent-child order nếu có, in bill/kitchen queue và trạng thái giao hàng.
6. **Payment reconciliation**: ghi nhận online payment/chuyển khoản và đối soát.
7. **Review module**: khách gửi review, manager xem/lọc/xử lý feedback.
8. **AI chatbot**: hỏi các intent phổ biến về menu, reservation, promotion, policy; kiểm tra fallback.
9. **RBAC/audit**: chuyển vai trò để chứng minh quyền truy cập và audit log.
10. **Scheduling → attendance → payroll/performance**: published shifts, chấm công, exception/overtime/correction, tính điểm hiệu suất.
11. **Backup/import & operations**: giới thiệu snapshot config, health endpoints và runbook.

## Readiness checklist

- Env local/staging đã đúng endpoint frontend/backend.
- Seed data chạy idempotent và không phụ thuộc dữ liệu cá nhân thật.
- Tài khoản demo cho Customer/Staff/Manager/Admin đã xác nhận.
- Build/test tối thiểu pass theo `QA_GUIDE.md`.
- Browser cache/session được reset trước khi demo.
- Ảnh menu, coupon code, review sample và lịch làm hiển thị đúng.
- Có fallback script nếu AI/payment/storage provider không khả dụng.

## Ghi chú Android/AR

Nếu demo Android/AR, chuẩn bị thiết bị thật hoặc emulator, kiểm tra camera permission, network tới backend, asset 3D/ảnh món và fallback nếu môi trường không hỗ trợ AR.
