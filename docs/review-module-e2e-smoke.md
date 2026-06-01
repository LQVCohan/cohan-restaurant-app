# Review module E2E/API smoke

Repo chưa có Playwright/Cypress dependency ở `package.json`, nên PR này thêm smoke test API nhẹ bằng Node `fetch` tại `scripts/review-flow-smoke.mjs` thay vì cài framework E2E lớn.

## Chuẩn bị

1. Seed demo data:
   ```bash
   SEED_REVIEW_DEMO=true node cohan-restaurant-backend/scripts/seedReviewDemoData.js
   ```
2. Chạy backend/frontend local và lấy JWT customer/manager từ luồng login demo.
3. Export biến môi trường:
   ```bash
   export GRAPHQL_URL=http://localhost:4000/graphql
   export CUSTOMER_TOKEN=<customer jwt>
   export MANAGER_TOKEN=<manager jwt>
   export DEMO_RESTAURANT_ID=<restaurant id>
   ```

## Chạy smoke

```bash
node scripts/review-flow-smoke.mjs
```

## Flow được kiểm tra

- Customer tạo review 2 sao ở trạng thái pending.
- Manager thấy pending review.
- Manager approve review.
- Customer/public query thấy review published.
- Manager gửi official reply.
- Customer thấy `firstOfficialReply` (badge “Phản hồi từ nhà hàng” ở UI).
- Customer report review.
- Manager resolve report.
- Manager query analytics/action queue/insight summary.

Nếu muốn nâng lên Playwright sau này, giữ cùng data-testid/GraphQL checkpoints để tránh brittle theo text UI.
