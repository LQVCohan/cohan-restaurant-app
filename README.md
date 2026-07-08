# Cohan Restaurant App

Cohan Restaurant App là hệ thống quản trị nhà hàng full-stack phục vụ các luồng: menu, đặt bàn/đặt món, POS/order, coupon/promotion, review, AI chatbot, RBAC, scheduling/attendance/payroll/performance và vận hành production-like.

## Bắt đầu nhanh trên máy local

Repository đã bao gồm file database mẫu tại `handover/database/cohan-defense.archive.gz`. Database này chứa sample data và các tài khoản kiểm thử, vì vậy không cần chạy seed sau khi restore.

Tài liệu liên quan:

- Hướng dẫn cài đặt và chạy project: [`handover/README.md`](handover/README.md)
- Tài khoản Admin/User và các vai trò kiểm thử: [`handover/Account.md`](handover/Account.md)
- Hướng dẫn restore database về MongoDB local: [`handover/database/README.md`](handover/database/README.md)

### 1. Clone và cài dependencies

```bash
git clone https://github.com/LQVCohan/cohan-restaurant-app.git
cd cohan-restaurant-app
npm install
npm install --prefix cohan-restaurant-backend
npm run env:local
```

### 2. Restore database mẫu

Làm theo [`handover/database/README.md`](handover/database/README.md) để restore:

```text
handover/database/cohan-defense.archive.gz
```

vào MongoDB local với tên database `RestaurantDB`.

### 3. Chạy backend

```bash
npm run dev --prefix cohan-restaurant-backend
```

### 4. Chạy frontend

Mở terminal thứ hai tại thư mục gốc:

```bash
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`. Đăng nhập bằng tài khoản trong [`handover/Account.md`](handover/Account.md).

## Tài liệu

Bộ tài liệu chính nằm tại [`docs/README.md`](docs/README.md):

- Tổng quan hệ thống: [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md)
- Vận hành/deploy/env/storage/backup: [`docs/OPERATIONS_GUIDE.md`](docs/OPERATIONS_GUIDE.md)
- Kiểm thử và production readiness: [`docs/QA_GUIDE.md`](docs/QA_GUIDE.md)
- Hướng dẫn demo và chạy thử: [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md)
- Tổng hợp module chức năng: [`docs/MODULES_GUIDE.md`](docs/MODULES_GUIDE.md)
- Lưu vết tài liệu cũ đã gộp/xoá: [`docs/ARCHIVE_INDEX.md`](docs/ARCHIVE_INDEX.md)

## Health & metrics

- Liveness: `/health/live`
- Readiness: `/health/ready`
- Metrics: `/metrics`

## Demo seed thường dùng

Các lệnh seed dưới đây chỉ dành cho phát triển khi cần tái tạo dữ liệu thử nghiệm:

```bash
npm run seed:demo:menu-management --prefix cohan-restaurant-backend
npm run seed:demo:coupon-promotion --prefix cohan-restaurant-backend
npm run seed:demo:customers --prefix cohan-restaurant-backend
npm run seed:rbac --prefix cohan-restaurant-backend
```
