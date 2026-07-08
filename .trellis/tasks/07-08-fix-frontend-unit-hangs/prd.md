# Repair frontend unit regressions and dashboard render loop

## Current behavior and root causes

Current `main` still contains four frontend failures that were previously carried by closed PR #1274:

1. `AuthProvider.logout-cache.test.jsx` inspects source text instead of exercising logout behavior.
2. Promotion search removes combining accents but does not normalize Vietnamese `đ` to `d`.
3. `useDashboard` duplicates restaurant auto-selection already owned by `useBrandManagement` and passes a functional updater to a string-only setter, causing repeated selection changes and test timeouts.
4. The table empty-state test queries restored text through a legacy class that cleanup intentionally removes.

## End-to-end flow

- `AuthProvider.logout` -> Apollo `clearStore` -> context behavior test.
- Auth restaurants/BrandMembership -> `useBrandManagement` -> `useManagerRestaurantSelection` -> `useDashboard` -> Dashboard/POS tests.
- Promotion/table DOM utilities -> local enhancement/cleanup -> utility tests.

## Scope

- Mock Apollo Client in the existing AuthProvider test and assert logout calls `clearStore`; remove the source-inspection test.
- Normalize `đ` as `d` in promotion search.
- Keep `useBrandManagement` as the sole owner of restaurant auto-selection, wait while current-account restaurants are loading, and remove the duplicate Dashboard effect.
- Fix the empty-state assertion to select the surviving button text directly.

## Constraints

- Do not change GraphQL/backend/search code covered by PR #1277.
- Do not add dependencies or broad test-runner configuration.
- Do not hide failures with global bail/fail-fast settings.
- Preserve runtime restaurant scoping and logout behavior.

## Acceptance criteria

1. AuthProvider logout behavior test passes and the brittle source test is removed.
2. `installTablePromotionSearch.test.js` passes for `Ưu đãi` queried as `uu dai`.
3. All four `useDashboard.test.jsx` tests complete without render loops.
4. `installTableEmptyStateEnhancement.test.js` passes while still asserting legacy cleanup.
5. Full frontend unit CI exits normally.

## Validation plan

- `npx vitest run src/context/__tests__/AuthProvider.test.jsx`
- `npx vitest run src/hooks/useDashboard.test.jsx`
- `npx vitest run src/utils/installTablePromotionSearch.test.js src/utils/installTableEmptyStateEnhancement.test.js`
- `npm run test:unit`

## Out of scope

- Backend/search/order fixes in PR #1277.
- Component and Playwright failures unrelated to these unit paths.
