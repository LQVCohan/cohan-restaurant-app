# Ngăn VNPAY tự đổi loại tài khoản

## Hiện trạng và nguyên nhân gốc

- `Restaurant.paymentSettings.providers[].mode` mặc định là `sandbox`; không có cron hoặc service nào tự chuyển sang `production`.
- Trang cổng thanh toán dùng state radio `modes` làm bản nháp, nhưng thao tác bật/tắt phương thức lại gửi luôn mode bản nháp vào `updateRestaurantPaymentSettings`. Sau `refetch`, mode vừa bị ghi xuống MongoDB được chọn lại nên trông như tự đổi.
- Restaurant configuration backup đưa `paymentSettings` vào `restaurantProfile`. Khi restore/copy từ snapshot có mode `production`, một cập nhật hồ sơ hỗn hợp có thể ghi đè mode của nhà hàng đích dù secret merchant không được sao chép.

## Luồng thật

`Restaurant.paymentSettings schema -> getProviderPublicConfig / credential status -> PaymentProviderSettingsPage query -> radio state -> save/toggle mutation -> Restaurant.paymentSettings -> refetch UI`.

Luồng backup liên quan:

`Restaurant.paymentSettings -> restaurantProfile snapshot -> importRestaurantProfileWithConflict -> Restaurant.findByIdAndUpdate -> payment settings query`.

## Phạm vi thay đổi

- `PaymentProviderSettingsPage.jsx`: thao tác bật/tắt chỉ thay đổi `active`, không được thay đổi `mode`; chỉ lưu credential mới được ghi mode.
- `PaymentProviderSettingsPage.test.jsx`: khóa lỗi radio bản nháp bị lưu khi bật/tắt.
- `restaurant.model.js`: tại schema boundary, loại `paymentSettings` khỏi mọi cập nhật hồ sơ hỗn hợp; cập nhật chuyên dụng chỉ chứa `paymentSettings` vẫn hoạt động.
- `restaurant-payment-settings-update.model.test.js`: khóa cả hai hành vi trên.

## Tiêu chí nghiệm thu

- Chọn thử `production` nhưng chỉ bật/tắt VNPAY không làm mode đã lưu đổi khỏi `sandbox`.
- Lưu credential với mode được chọn vẫn cập nhật mode như trước.
- Khôi phục/copy hồ sơ nhà hàng không thể âm thầm ghi đè `paymentSettings` cùng các trường hồ sơ khác.
- Mutation chuyên dụng `updateRestaurantPaymentSettings` vẫn cập nhật được cấu hình.
- Không thay đổi credential mã hóa, callback verification, quyền hoặc luồng thanh toán khách hàng.

## Validation

```bash
npx vitest run src/components/Dashboard_Manager/PaymentSettings/PaymentProviderSettingsPage.test.jsx
npm --prefix cohan-restaurant-backend test -- tests/models/restaurant-payment-settings-update.model.test.js
```

## Ngoài phạm vi

- Tự động thay đổi dữ liệu production đã tồn tại trong MongoDB.
- Cấp lại VNPAY TmnCode/Hash Secret.
- Thay đổi cơ chế sandbox guard của PaymentSession.
