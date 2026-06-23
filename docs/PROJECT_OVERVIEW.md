# Project Overview

## Mục tiêu sản phẩm

Cohan Restaurant App là hệ thống quản trị nhà hàng full-stack phục vụ demo/bàn giao cuối: khách hàng đặt bàn/gọi món/đánh giá; nhân viên vận hành đơn hàng, lịch làm và chấm công; quản lý theo dõi menu, khuyến mãi, doanh thu, phân quyền, hiệu suất và cấu hình nhà hàng.

## Công nghệ chính

- Frontend: React 19, Vite, React Router, Apollo Client, Ant Design, SCSS/Tailwind utilities.
- Backend: Node.js ES modules, Fastify/Mercurius GraphQL, MongoDB/Mongoose, Socket.IO, JWT/cookie auth.
- Kiểm thử: Vitest, Playwright, các script seed/verify demo ở frontend và backend.
- Vận hành: health endpoints (`/health/live`, `/health/ready`), metrics (`/metrics`), single-server deployment với reverse proxy/process manager.

## Cấu trúc repo

```text
.
├── src/                         # Frontend React app
│   ├── components/              # UI theo role/module
│   ├── context/                 # Auth/cart/global state
│   ├── hooks/                   # Shared hooks
│   ├── routes/                  # Route guards and route config
│   └── utils/                   # Helpers, role access, API helpers
├── cohan-restaurant-backend/    # Backend Fastify/GraphQL/Mongoose
│   ├── src/                     # Server, schema/resolvers/services/models
│   ├── scripts/                 # Seed/verify/migration utilities
│   └── tests/                   # Backend unit/integration tests
├── docs/                        # Tài liệu sản phẩm đã chuẩn hoá
├── scripts/                     # Frontend/local tooling scripts
└── tests/                       # E2E/smoke tests
```

## Vai trò người dùng

- Customer: xem nhà hàng/menu, đặt bàn, đặt món, theo dõi giao hàng, chat AI, đánh giá.
- Staff: tiếp nhận order/POS, cập nhật trạng thái, in ấn, xử lý ca làm/chấm công theo quyền.
- Manager/Admin: quản lý menu, coupon/promotion, nhân sự, lịch làm, RBAC, báo cáo, cấu hình nhà hàng.

## Luồng nghiệp vụ lõi

1. Khách hàng duyệt nhà hàng/menu và đặt bàn hoặc tạo đơn.
2. POS/Order manager xử lý order theo trạng thái, parent-child lifecycle và trạng thái giao hàng nếu có.
3. Thanh toán/đối soát ghi nhận online payment hoặc chuyển khoản.
4. Coupon/promotion áp dụng vào giỏ hàng/order và được kiểm tra trong analytics/demo.
5. Review/feedback ghi nhận trải nghiệm sau đơn/đặt bàn.
6. Scheduling → attendance → payroll/performance tạo dữ liệu vận hành nhân sự.
7. RBAC bảo vệ màn hình, hành động GraphQL và audit log.
8. Cấu hình nhà hàng, ảnh menu, upload storage và backup/import hỗ trợ vận hành dài hạn.

## Chuẩn bàn giao

- README gốc chỉ giữ quick start và trỏ về Documentation Hub.
- Tất cả tài liệu vận hành/QA/demo/module nằm trong `docs/`.
- Tài liệu theo ngày/audit rời đã được hợp nhất và chỉ còn lưu vết trong `ARCHIVE_INDEX.md`.
