# Cohan Restaurant App

Cohan Restaurant App là hệ thống quản trị nhà hàng full-stack phục vụ các luồng: menu, đặt bàn/đặt món, POS/order, coupon/promotion, review, AI chatbot, RBAC, scheduling/attendance/payroll/performance và vận hành production-like.

## Bộ bàn giao khóa luận

Người chấm nên bắt đầu tại:

- Hướng dẫn cài, restore database và chạy project: [`handover/README.md`](handover/README.md)
- Tài khoản Admin/User và các vai trò kiểm thử: [`handover/Account.md`](handover/Account.md)
- Hướng dẫn xuất Atlas và restore về MongoDB local: [`handover/database/README.md`](handover/database/README.md)
- File database có sample data sẽ được đặt tại `handover/database/cohan-defense.archive.gz`

Bộ bàn giao sử dụng **source code + database backup đã chứa sample data**. Khi file database đã được cung cấp, người chấm không cần chạy seed để sử dụng dữ liệu mẫu.

## Quick start (local development)

### 1) Tạo env local

```bash
npm run env:local
```

### 2) Chạy frontend

```bash
npm run dev
```

### 3) Chạy backend

```bash
npm run dev --prefix cohan-restaurant-backend
```

## Tài liệu

Bộ tài liệu chính nằm tại [`docs/README.md`](docs/README.md):

- Tổng quan hệ thống: [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md)
- Vận hành/deploy/env/storage/backup: [`docs/OPERATIONS_GUIDE.md`](docs/OPERATIONS_GUIDE.md)
- Kiểm thử và production readiness: [`docs/QA_GUIDE.md`](docs/QA_GUIDE.md)
- Demo/bàn giao cuối: [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md)
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
