# Transfer review dashboard hardening

## Current behavior and root cause

- `PaymentSession.transfer.status` is persisted correctly and the existing verify/reject mutations preserve restaurant permission checks, transactions, audit logs, and realtime events.
- `TransferPaymentReviewPage` initializes its own restaurant from `AuthContext.restaurants[0]` instead of the canonical manager scope shared through `useManagerRestaurantSelection`. Switching the header brand/restaurant can therefore leave the page querying another restaurant.
- KPI values are reduced from the currently filtered queue, so they are not an overview of the full restaurant queue.
- The `ALL` tab sends no status filter. `transferPaymentQueue` treats an omitted filter as the operational default (`SUBMITTED`, `VERIFYING`, `REJECTED`, `VERIFIED`), excluding `FAILED` and `EXPIRED`.
- The screen allocates too much height to decorative surfaces and provides weak loading, empty, and no-restaurant guidance.

## End-to-end flow

1. `models/payment-session.model.js` stores transfer status, proof data, received amount, and variance.
2. `paymentTransfer.graphql` exposes the queue and verify/reject inputs.
3. `bankTransferQuery.js` enforces `payment.read`, expires stale sessions, queries MongoDB, and sanitizes sessions.
4. `transferMutation.js` enforces `payment.write`, updates payment/order state in the existing transaction, logs, and emits realtime events.
5. `useManagerRestaurantSelection.js` resolves and synchronizes the canonical manager brand/restaurant scope used by the header.
6. `TransferPaymentReviewPage.jsx` queries the queue, renders proof/actions, and invokes verify/reject mutations.

## Scope

- Reuse `useManagerRestaurantSelection` directly in the page so the queue follows the same canonical restaurant scope without adding a new prop chain through `ManagerLayout`.
- Add an exact MongoDB-backed queue summary query with the same restaurant permission guard.
- Make `ALL` explicitly request all reviewable terminal and non-terminal statuses represented by the UI.
- Keep queue rows server-filtered while rendering exact global counts in KPI and tab badges.
- Redesign the page into a compact operational workspace using existing sage/warm-neutral direction, Lucide icons, responsive controls, visible focus, and useful loading/error/empty states.
- Add focused resolver and component tests.
- Align the existing dashboard scope regression test with the secure hook contract: a restaurant restored from an old account remains hidden until the current account scope is confirmed.
- Repair the malformed `updateCombo` mock exposed by changed-code CI, keep the Lucide compatibility fallback isolated inside the transfer-review test, and scope the guest smoke locator to the banner because the page legitimately contains two “Nhà hàng” links.

## Files to change

- `cohan-restaurant-backend/graphql/schema/paymentTransfer.graphql`: summary type and query contract.
- `cohan-restaurant-backend/graphql/resolvers/payment/bankTransferQuery.js`: exact grouped counts with restaurant scoping.
- `src/components/Dashboard_Manager/Transactions/TransferPaymentReviewPage.jsx`: canonical scope, query, interaction, and state corrections.
- `src/components/Dashboard_Manager/Transactions/TransferPaymentReviewPagePolish.scss`: compact responsive visual system.
- `cohan-restaurant-backend/tests/resolvers/payment-transfer-queue.test.js`: resolver filtering/summary regression coverage.
- `src/components/Dashboard_Manager/Transactions/TransferPaymentReviewPage.test.jsx`: scope, filter/count rendering, and isolated Lucide test fallback coverage.
- `src/hooks/useDashboard.test.jsx`: update the stale restored-scope assertion to match `useManagerRestaurantSelection`.
- `src/components/Dashboard_Manager/Combo/ComboManagement.test.jsx`: repair the existing malformed `updateCombo` mock so changed component tests can parse.
- `tests/e2e/smoke/guest-home-detail.spec.js`: target the header restaurant link unambiguously.

## Acceptance criteria

- Changing the manager restaurant scope changes the queue variables without a reload.
- The page never silently falls back to an unrelated restaurant when a canonical scope is supplied.
- KPI and tab counts reflect exact database totals for the selected restaurant, independent of the active tab.
- `Tất cả` includes `FAILED` and `EXPIRED` as well as submitted/verifying/rejected/verified records.
- Verify and reject mutation payloads remain compatible with the existing GraphQL inputs.
- Loading, empty, error, read-only, disabled, focus, and mobile states remain understandable.
- No new dependency, payment settlement rewrite, permission relaxation, or realtime behavior change.

## Validation plan

- `npm run check:conflicts`
- `npm run check:graphql`
- `vitest run src/components/Dashboard_Manager/Transactions/TransferPaymentReviewPage.test.jsx`
- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/payment-transfer-queue.test.js tests/resolvers/payment-transfer-resubmit.test.js`
- `npm run build`
- `npm run test:smoke`

## Out of scope

- Changing customer proof upload/retry rules.
- Changing payment settlement, order release, audit logs, or realtime event semantics.
- Pagination or historical export beyond the existing queue limit.
