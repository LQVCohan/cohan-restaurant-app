# Testing Guide — Cohan Restaurant App

## 1. Audit test hiện có

### Root `package.json` scripts
- `dev`: chạy Vite development server.
- `build`: build frontend bằng Vite.
- `lint`: lint phạm vi cấu hình hiện tại (`src/config/**/*.{js,jsx}` và `eslint.config.js`).
- `preview`: chạy Vite preview.
- `test`: chạy unit/frontend nhanh và backend/API test qua Vitest.
- `test:unit`: chạy các unit test frontend ở `src/utils`, `src/hooks`, `src/context`, `src/routes`, `src/lib`, `src/__tests__`.
- `test:api`: chạy backend GraphQL/service tests trong đúng working directory `cohan-restaurant-backend`.
- `test:component`: chạy component tests trong `src/components`.
- `test:e2e`: chạy toàn bộ Playwright tests trong `tests/e2e`.
- `test:smoke`: chạy Playwright smoke tests trong `tests/e2e/smoke`.
- `test:ci`: chạy conflict check, lint, build, unit, API, và smoke tests.
- `seed:test`: validate fixture seed test mà không ghi DB.
- `reset:test-db`: dry-run reset plan, không ghi DB thật.
- Các script chuyên biệt giữ nguyên: `test:menu-rbac`, `test:frontend`, `test:backend`, `check:demo`, `test:performance`, `check:conflicts`, `env:local`.

### Vitest/Jest config
- Frontend dùng `vitest.config.js` với environment `jsdom`, setup `src/test/setup.js`, alias `@ -> src`, và include `src/**/*.test|spec.{js,jsx}`.
- Backend dùng `vitest.backend.config.js`, trỏ sang `cohan-restaurant-backend/vitest.config.js`, environment `node`, setup `cohan-restaurant-backend/tests/setup/env.js`.
- Không có Jest config ở repo root; các Jest config tìm thấy chỉ thuộc `node_modules`.

### Playwright/Cypress config
- Repo chưa có Cypress config.
- PR này thêm `playwright.config.js` và smoke tests ở `tests/e2e/smoke`.
- Playwright dùng Vite `build + preview` làm `webServer`, mock network ở từng spec để tránh phụ thuộc dữ liệu thật hoặc thanh toán thật.

### Thư mục tests hiện có
- Frontend: `src/**/*.test.*`, gồm `src/utils`, `src/hooks`, `src/context/__tests__`, `src/routes/__tests__`, `src/__tests__`, và nhiều component tests trong `src/components`.
- Backend: `cohan-restaurant-backend/tests`, gồm `resolvers`, `services`, `server`, `security`, `utils`, `setup`.
- E2E mới: `tests/e2e/smoke`.
- Fixtures mới: `tests/fixtures/test-seed-data.json`.

### Backend test setup
- Backend test chạy bằng Vitest node config tại `cohan-restaurant-backend/vitest.config.js`.
- Setup env nằm ở `cohan-restaurant-backend/tests/setup/env.js`.
- Backend hiện đã có nhiều resolver/security/service tests cho auth, RBAC, user privacy, menu permission, order/payment/cart/security và scheduling domains.

### GitHub Actions workflow
- `.github/workflows/ci.yml` có job `frontend` và `backend` trên push/PR vào `main` và `develop`.
- Job frontend chạy `npm ci`, conflict check, lint, frontend tests, menu RBAC tests, build.
- Job backend chạy `npm ci`, lint, backend tests, backend menu RBAC tests, build.
- `.github/workflows/branch-protection.yml` chỉ chạy thủ công bằng `workflow_dispatch`.

## 2. Cấu trúc test chuẩn đề xuất

```text
src/
  utils/**/*.test.js              # Pure unit tests: auth/role, cart payload, checkout payload, discounts, FOR YOU, formatters
  hooks/**/*.test.js              # Hook unit tests: cart, discounts, promotions, API hooks với mock Apollo/fetch
  context/__tests__/**/*.test.jsx # Provider contract tests
  routes/__tests__/**/*.test.*    # Route guard/protected route tests
  components/**/*.test.jsx        # Component tests bằng React Testing Library
cohan-restaurant-backend/tests/
  resolvers/**/*.test.js          # GraphQL resolver/API tests
  services/**/*.test.js           # Domain service tests
  security/**/*.test.js           # Auth/RBAC/privacy/security regression tests
tests/
  e2e/smoke/**/*.spec.js          # Playwright smoke tests nhanh, mock network hoặc test DB riêng
  fixtures/test-seed-data.json    # Seed fixture an toàn cho test DB
```

Nguyên tắc:
- Unit/component/API tests phải deterministic, không gọi payment/email/SMS thật.
- E2E smoke chỉ cover flow chính trước: guest home/detail, customer cart/checkout, manager menu metadata.
- Full E2E edge cases nên tách phase sau để tránh flaky và thời gian CI dài.

## 3. Cách chạy test

### Unit tests

```bash
npm run test:unit
```

Chạy các test nhanh cho utils/hooks/context/routes/lib. Phù hợp chạy trước khi commit.

### API/backend tests

```bash
npm run test:api
```

Chạy backend GraphQL/service/security tests bằng `npm --prefix cohan-restaurant-backend test` để các file-based regression tests dùng đúng working directory. Không dùng production DB. Nếu test nào cần DB, hãy cấu hình MongoDB test riêng trước khi chạy.

### Component tests

```bash
npm run test:component
```

Chạy React Testing Library/Vitest component tests trong `src/components`.

### E2E smoke tests

Lần đầu ở local hoặc CI cần cài browser:

```bash
npx playwright install --with-deps chromium
```

Sau đó chạy:

```bash
npm run test:smoke
```

Smoke tests dùng mock GraphQL/auth trong spec, không phụ thuộc database thật và không gọi payment thật.

### Full E2E

```bash
npm run test:e2e
```

Hiện tại full E2E trùng smoke folder. Khi mở rộng thêm spec ngoài smoke, CI ban đầu vẫn nên chỉ chạy `test:smoke`.

### CI local equivalent

```bash
npm run test:ci
```

Chạy conflict check, lint, build, unit, API, và smoke.

## 4. Seed data test

Fixture an toàn nằm ở:

```text
tests/fixtures/test-seed-data.json
```

Fixture bao gồm tối thiểu:
- 1 customer thường.
- 1 customer có allergy `seafood` và `peanut`.
- 1 manager.
- 1 admin.
- 1 restaurant active và 1 restaurant inactive.
- Menu breakfast/lunch/dinner.
- Category seed.
- Ít nhất 8 món: đủ metadata FOR YOU, thiếu metadata, seafood allergen, vegan, popular `orderCounter` cao, out of stock, breakfast, dessert.
- Promotion/discount: valid, expired, stackable.

Chạy validate fixture:

```bash
npm run seed:test
```

Dry-run reset plan:

```bash
npm run reset:test-db
```

Hai script trên **không ghi database**. Nếu cần seed DB thật, hãy tạo importer riêng cho `NODE_ENV=test` và database riêng, ví dụ `MONGODB_URI=mongodb://localhost:27017/cohan_test`. Không seed vào staging/production.

## 5. Test accounts local

Các email fixture:
- Customer thường: `customer.test@cohan.local`.
- Customer allergy: `allergy.customer.test@cohan.local`.
- Manager: `manager.test@cohan.local`.
- Admin: `admin.test@cohan.local`.

Password không commit vào repo. Dùng secret manager/local `.env.test` khi viết importer DB thật.

## 6. Flow đã cover trong PR này

### Unit/frontend helper
- Cart line identity, add, merge same item/modifier/note, update quantity, remove, total, hold expiry.
- Customer cart payload: serving variant normalize và không leak analytics/FOR YOU local data.
- Checkout/discount preview payload: delivery/order mapping, pricing input, selected modifiers sanitize, hold refs opt-in, không leak analytics/FOR YOU local data.
- FOR YOU metadata bulk patch giữ nguyên field không tick.
- Các FOR YOU ranking/allergy/behavior/analytics tests hiện có được giữ lại.

### Smoke E2E
- Guest home/detail: mở home, thấy menu public, vào detail món, không thấy UI profile/logout customer-only.
- Customer cart/checkout: auth mock customer, mở detail món, thử add cart nếu button có mặt, vào protected checkout, không redirect login/403.
- Manager menu metadata: auth mock manager, mở manager surface, kiểm tra dashboard/menu metadata surface không crash.

## 7. Flow chưa cover / deferred

Phase 2:
- API integration tests sâu cho `createCheckoutOrders`, `addToCart`, `updateCartItem`, `removeCartItem`, `customerMenuItem`, `topMenuItems`, `updateFoodPreferences` với test DB riêng.
- Security API matrix chi tiết: guest/customer/manager/admin trên từng resolver nhạy cảm.

Phase 3:
- Component tests sâu cho Home, HomeForYouSection, FoodDetail, CartDrawer, OrderSummaryModal, Profile/FoodPreferences, Login/Register.
- Component tests sâu cho MenuManagement, MenuItemModal, BulkForYouMetadataModal, ForYouReadinessPanel, inventory status UI, dashboard cards.
- Admin user/restaurant/role management component tests nếu scope UI ổn định.

Phase 4:
- Importer seed/reset DB thật cho `NODE_ENV=test`.
- Full E2E với test DB riêng, bao gồm persisted preferences, checkout success, manager bulk save, admin pages.

## 8. Quy tắc trước khi merge PR

1. Không đổi business logic chỉ để test pass.
2. Không đổi backend schema/model/resolver trừ khi có migration/test setup rõ ràng.
3. Không đổi checkout/order/payment payload ngoài helper đã có test bảo vệ.
4. Không gọi payment/email/SMS thật trong test.
5. Không seed production/staging DB.
6. Chạy tối thiểu:

```bash
npm run test:unit
npm run test:api
npm run test:smoke
```

7. Nếu sửa UI quan trọng, bổ sung component test hoặc smoke test tương ứng.
8. Nếu thêm resolver/permission mới, bổ sung API/security regression test.
