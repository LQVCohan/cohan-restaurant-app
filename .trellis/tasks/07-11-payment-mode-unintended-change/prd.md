# Ngăn VNPAY tự đổi loại tài khoản

## Hiện trạng và nguyên nhân gốc

- `Restaurant.paymentSettings.providers[].mode` mặc định là `sandbox`; không có cron hoặc service nào tự chuyển sang `production`.
- Trang cổng thanh toán dùng state radio `modes` làm bản nháp, nhưng thao tác bật/tắt phương thức lại gửi luôn mode bản nháp vào `updateRestaurantPaymentSettings`. Sau `refetch`, mode vừa bị ghi xuống MongoDB được chọn lại nên trông như tự đổi.
- Restaurant configuration backup đang đưa `paymentSettings` vào `restaurantProfile`. Khi restore/copy từ snapshot có mode `production`, cấu hình nhà hàng đích bị ghi đè dù secret merchant không được sao chép.

## Luồng thật

`Restaurant.paymentSettings schema -> getProviderPublicConfig / credential status -> PaymentProviderSettingsPage query -> radio state -> save/toggle mutation -> Restaurant.paymentSettings -> refetch UI`.

Luồng backup liên quan:

`Restaurant.paymentSettings -> restaurantProfile snapshot -> importRestaurantProfileWithConflict -> Restaurant.findByIdAndUpdate -> payment settings query`.

## Phạm vi thay đổi

- `PaymentProviderSettingsPage.jsx`: thao tác bật/tắt chỉ thay đổi `active`, không được thay đổi `mode`; chỉ lưu credential mới được ghi mode.
- `PaymentProviderSettingsPage.test.jsx`: khóa lỗi radio bản nháp bị lưu khi bật/tắt.
- `restaurantConfigBackup.service.js`: loại `paymentSettings` khỏi hồ sơ nhà hàng được export/import, kể cả snapshot cũ.
- `restaurant-config-backup.service.test.js`: khóa việc export/import ghi đè cổng thanh toán.

## Tiêu chí nghiệm thu

- Chọn thử `production` nhưng chỉ bật/tắt VNPAY không làm mode đã lưu đổi khỏi `sandbox`.
- Lưu credential với mode được chọn vẫn cập nhật mode như trước.
- Backup cấu hình mới không chứa `restaurantProfile.paymentSettings`.
- Snapshot cũ có `paymentSettings` cũng không được phép ghi đè target khi restore.
- Không thay đổi credential mã hóa, callback verification, quyền hoặc luồng thanh toán khách hàng.

## Validation

```bash
npx vitest run src/components/Dashboard_Manager/PaymentSettings/PaymentProviderSettingsPage.test.jsx
npm --prefix cohan-restaurant-backend test -- tests/services/restaurant-config-backup.service.test.js
```

## Ngoài phạm vi

- Tự động thay đổi dữ liệu production đã tồn tại trong MongoDB.
- Cấp lại VNPAY TmnCode/Hash Secret.
- Thay đổi cơ chế sandbox guard của PaymentSession.
