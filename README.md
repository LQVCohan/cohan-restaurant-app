# Cohan Restaurant App

Cohan Restaurant App là hệ thống quản trị nhà hàng full-stack phục vụ các luồng: menu, đặt bàn/đặt món, POS/order, coupon/promotion, review, AI chatbot, RBAC, scheduling/attendance/payroll/performance và vận hành production-like.

## Cài đặt và dữ liệu mẫu

Bất kỳ ai muốn tải source code và chạy dự án có thể bắt đầu tại:

- Hướng dẫn cài, restore database và chạy project: [`handover/README.md`](handover/README.md)
- Tài khoản Admin/User và các vai trò kiểm thử: [`handover/Account.md`](handover/Account.md)
- Hướng dẫn xuất Atlas và restore về MongoDB local: [`handover/database/README.md`](handover/database/README.md)
- Database có sample data: `handover/database/cohan-defense.archive.gz`

Dự án có thể được khởi động từ **source code + database backup đã chứa sample data**. Người dùng không cần chạy seed để sử dụng dữ liệu mẫu đã cung cấp.

## Quick start (local development)

### 1) Tải source code

```bash
git clone https://github.com/LQVCohan/cohan-restaurant-app.git
cd cohan-restaurant-app
```

### 2) Cài dependencies và tạo env local

```bash
npm install
npm install --prefix cohan-restaurant-backend
npm run env:local
```

### 3) Restore database mẫu

Làm theo [`handover/database/README.md`](handover/database/README.md).

### 4) Chạy backend

```bash
npm run dev --prefix cohan-restaurant-backend
```

### 5) Chạy frontend

```bash
npm run dev
```

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

```bash
npm run seed:demo:menu-management --prefix cohan-restaurant-backend
npm run seed:demo:coupon-promotion --prefix cohan-restaurant-backend
npm run seed:demo:customers --prefix cohan-restaurant-backend
npm run seed:rbac --prefix cohan-restaurant-backend
```
