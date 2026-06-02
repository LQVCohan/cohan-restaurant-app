# Review module E2E/API smoke

Repo chưa có Playwright/Cypress dependency ở `package.json`, nên smoke test API dùng Node native `fetch` tại `scripts/review-flow-smoke.mjs`.

## Chuẩn bị live mode

1. Seed demo data:
   ```bash
   SEED_REVIEW_DEMO=true node cohan-restaurant-backend/scripts/seedReviewDemoData.js
   ```
2. Chạy backend/frontend local và lấy JWT customer/manager từ luồng login demo.
3. Export biến môi trường:
   ```bash
   export GRAPHQL_ENDPOINT=http://localhost:4000/graphql
   # hoặc API_URL / GRAPHQL_URL nếu môi trường cũ đang dùng tên đó
   export CUSTOMER_TOKEN=<customer jwt>
   export MANAGER_TOKEN=<manager jwt>
   export DEMO_RESTAURANT_ID=<restaurant id>
   ```

## Chạy smoke

Dry-run không cần token, chỉ kiểm tra env và in flow:

```bash
node scripts/review-flow-smoke.mjs --dry-run
```

Strict mode fail rõ nếu thiếu env:

```bash
node scripts/review-flow-smoke.mjs --strict
```

Live mode đầy đủ:

```bash
GRAPHQL_ENDPOINT=http://localhost:4000/graphql CUSTOMER_TOKEN=... MANAGER_TOKEN=... DEMO_RESTAURANT_ID=... node scripts/review-flow-smoke.mjs --strict
```

## Flow được kiểm tra

- Customer tạo review 2 sao với prefix `[SMOKE]` và nhận `status = published` ngay.
- Manager thấy review mới trong danh sách công khai/phạm vi nhà hàng.
- Manager không cần approve; manager phản hồi chính thức hoặc xử lý report hậu kiểm.
- Customer/public query thấy review mới ngay, kể cả khi chuyển `reported` vẫn còn public với badge/cảnh báo.
- Manager gửi official reply.
- Customer thấy `firstOfficialReply`.
- Customer report review; report trùng user/reason không làm tăng counter.
- Manager resolve report.
- Manager query analytics/action queue/insight summary tập trung vào đánh giá cần phản hồi, report cần xử lý và high-risk.

## Lưu ý dữ liệu

Script dùng prefix `[SMOKE]` cho title/content/reply/report note để dễ lọc. Hiện chưa có cleanup mutation an toàn cho toàn bộ review/comment/report nên dữ liệu smoke có thể tồn tại trong môi trường demo; dùng nhà hàng demo riêng hoặc xoá thủ công sau khi quay video nếu cần.
