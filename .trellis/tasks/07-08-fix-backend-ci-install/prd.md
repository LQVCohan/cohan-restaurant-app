# Repair post-merge CI and reported test failures

## Current behavior and root causes

After PR #1272 merged, CI exposed six independent problems:

1. Both jobs stopped before tests because backend `package.json` declared `mongoose-lean-virtuals` as `^0.8.0` while the committed lockfile root manifest records `^2.0.0`.
2. Public search tests still mocked the pre-normalization query flow and the resolver still counted owner/manager restaurants through legacy `refRestaurants` instead of active `BrandMembership`.
3. The logout-cache regression test inspected source text with `readFileSync` instead of exercising `AuthProvider.logout`.
4. Promotion-name normalization removed combining accents but did not map Vietnamese `đ` to `d`.
5. `useDashboard` duplicated restaurant auto-selection already owned by `useBrandManagement`, but passed a functional updater to a setter that accepts only string values. This stored the function source as the selected ID and caused repeated renders/timeouts.
6. The table empty-state test queried restored button text through `.tm-empty__action` after cleanup intentionally removed that legacy class.

Vitest continues running remaining files after a failure before printing the final summary. The dashboard selection loop made this behavior look like the test command was hung.

## End-to-end flows

- `package.json` + `package-lock.json` -> frontend/backend `npm ci` -> lint/tests/build.
- `BrandMembership` + Restaurant -> search resolver -> public/admin search results -> resolver tests.
- `AuthProvider.logout` -> Apollo Client `clearStore` -> account cache removal -> context test.
- Account restaurants/Brand memberships -> `useBrandManagement` -> `useManagerRestaurantSelection` -> `useDashboard` -> manager Dashboard/POS actions -> hook tests.
- Promotion/legacy table DOM -> shared utility cleanup/filtering -> focused utility tests.

## Scope

- Align the stale backend dependency declaration with the existing lockfile.
- Compute managed restaurant counts from active `BrandMembership` and align search test mocks with the real models.
- Replace brittle logout source inspection with a behavioral assertion in the existing AuthProvider test harness.
- Normalize Vietnamese `đ` as `d` in promotion search.
- Remove duplicate dashboard auto-selection and wait for current-account restaurant scope before resetting a restored restaurant ID.
- Update the table empty-state assertion to query the remaining button text without the intentionally removed legacy class.
- Keep staff creation logic from PR #1272 unchanged.

## Constraints

- Do not regenerate or broadly rewrite lockfiles.
- Do not restore authorization use of `refRestaurants`.
- Do not change GraphQL contracts or public OWNER visibility rules.
- Do not change runtime logout behavior solely to satisfy a test.
- Keep `useBrandManagement` as the single owner of manager Brand/restaurant selection.
- Do not add dependencies or global fail-fast behavior.

## Acceptance criteria

1. Frontend and backend dependency installation steps pass.
2. Search public-safety and AuthProvider logout tests pass.
3. Promotion search matches Vietnamese names without accents, including `đ`/`d`.
4. `useDashboard.test.jsx` completes without selection loops and all four tests pass.
5. `installTableEmptyStateEnhancement.test.js` passes while still proving legacy classes/nodes are removed.
6. Temporary diagnostic workflows are absent from the final diff.

## Validation plan

- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/search-public-safety.test.js`
- `npx vitest run src/context/__tests__/AuthProvider.test.jsx`
- `npx vitest run src/utils/installTablePromotionSearch.test.js`
- `npx vitest run src/hooks/useDashboard.test.jsx src/utils/installTableEmptyStateEnhancement.test.js`
- Existing GitHub Actions frontend and backend jobs.

## Out of scope

- Changing staff creation behavior.
- Adding fail-fast behavior to every Vitest command.
- Updating dependency versions beyond the already committed lockfile.
