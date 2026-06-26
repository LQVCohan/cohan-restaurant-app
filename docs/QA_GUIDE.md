# QA Guide

## Lệnh kiểm thử chuẩn

```bash
npm run check:conflicts
npm run lint
npm run build
npm run test:unit
npm run test:component
npm run test:api
npm run test:smoke
npm run test:p1
npm run test:ci
```

Backend riêng:

```bash
npm --prefix cohan-restaurant-backend test
npm --prefix cohan-restaurant-backend run test:serial
npm --prefix cohan-restaurant-backend run test:menu-rbac
npm --prefix cohan-restaurant-backend run test:performance
```

## P1 end-to-end network guard

P1 dùng Playwright để đi qua từng nút/luồng thật và fail test khi backend trả lỗi dù UI vẫn hiện thành công.

Chạy riêng P1:

```bash
npm run test:p1
```

Khi viết P1 spec mới, import fixture ở `tests/e2e/p1/p1Fixtures.js` rồi gọi `backendGuard.assertNoBackendErrors()` sau các nút quan trọng:

```js
import { expect, test } from "./p1Fixtures.js";

test("manager saves a setting without hidden backend errors", async ({ page, backendGuard }) => {
  await page.goto("/manager#settings");
  backendGuard.clear();
  await page.getByRole("button", { name: /lưu/i }).click();
  backendGuard.assertNoBackendErrors("after save settings");
  await expect(page.getByText(/thành công|đã lưu/i)).toBeVisible();
});
```

Guard hiện bắt:

- HTTP `4xx/5xx` từ `/api/*` hoặc `/graphql`.
- GraphQL response có `errors[]` kể cả HTTP vẫn là `200`.
- Request backend bị fail hẳn.

`/api/auth/refresh` với `204` hoặc `401` được bỏ qua vì đây có thể là trạng thái guest/auth bình thường. Nếu refresh trả `500` thì vẫn fail.

Khi P1 fail, mở report:

```bash
npx playwright show-report
```

Trace/screenshot/video lỗi được giữ theo cấu hình Playwright hiện tại.

## Regression theo module

- Menu management: CRUD category/item, trạng thái publish/availability, ảnh local/upload, quyền manager/staff, dữ liệu seed demo.
- POS/order/reservation: tạo order, cập nhật trạng thái, parent-child lifecycle, reservation time range, in bill/kitchen queue.
- AI chatbot: knowledge base, fallback response, rate/error handling, manual QA các intent quan trọng.
- RBAC: permission matrix, seed roles, route guard frontend, resolver/service authorization, audit log.
- Coupon/promotion: coupon active/inactive, BOGO/combo/freeship, analytics và điều kiện áp dụng.
- Scheduling/attendance/payroll/performance: published shift binding, attendance exception, overtime/correction, scoring policy, appeal/incident.
- Review/rating/feedback: submit, moderate, production hardening, E2E smoke.
- Delivery/payment: status-only tracking, online payment reconciliation.
- Config/backup/import: export/import snapshot idempotent và rollback.

## Production readiness checklist

- Không còn conflict markers, mock/legacy path chưa kiểm soát hoặc draft UI lộ ra production.
- Build frontend thành công và backend pass syntax/build check.
- Các endpoint health/readiness/metrics hoạt động.
- RBAC seed đầy đủ, quyền nhạy cảm có audit log.
- Demo data có script seed và verify rõ ràng.
- Modal/draft persistence chỉ lưu đúng dữ liệu cần thiết, có cleanup khi submit/cancel hợp lý.
- E2E/smoke tối thiểu đi qua manager flow, order/POS, coupon, review và scheduling/performance nếu demo các module này.

## Manual QA trước demo

1. Đăng nhập từng vai trò chính và xác nhận landing page đúng quyền.
2. Chạy manager flow: dashboard → menu → coupon → order/POS → review → staff schedule/performance.
3. Tạo ít nhất một đơn có khuyến mãi và một đánh giá sau đơn.
4. Kiểm tra trạng thái realtime/order status nếu demo giao hàng hoặc POS.
5. Kiểm tra responsive các màn hình demo chính trên desktop và mobile/tablet nếu có AR/Android demo.
