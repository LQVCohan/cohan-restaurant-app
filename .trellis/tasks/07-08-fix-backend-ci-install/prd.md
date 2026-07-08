# Repair post-merge CI and reported test failures

## Current behavior and root causes

After PR #1272 merged, CI exposed four independent problems:

1. Both jobs stopped before tests because backend `package.json` declared `mongoose-lean-virtuals` as `^0.8.0` while the committed lockfile root manifest records `^2.0.0`.
2. Public search tests still mocked the pre-normalization query flow and the resolver still counted owner/manager restaurants through legacy `refRestaurants` instead of active `BrandMembership`.
3. The logout-cache regression test inspected source text with `readFileSync` instead of exercising `AuthProvider.logout`, so it failed independently of the actual Apollo cache behavior.
4. Promotion-name normalization removed combining accents but did not map Vietnamese `đ` to `d`, so searching `uu dai` did not match `Ưu đãi`.

Vitest was not stuck on the promotion test. By default it continues running the remaining files and prints the detailed failure summary at the end of the unit-test command, which made the GitHub Actions step look like it was running indefinitely.

## End-to-end flows

- `package.json` + `package-lock.json` -> frontend/backend `npm ci` -> lint/tests/build.
- `BrandMembership` + Restaurant -> search resolver -> public/admin search results -> resolver tests.
- `AuthProvider.logout` -> Apollo Client `clearStore` -> account cache removal -> context test.
- Promotion label text -> local normalization -> table promotion filtering -> focused utility test.

## Scope

- Align the stale backend dependency declaration with the existing lockfile.
- Reuse the already validated search fix from PR #1273: compute managed restaurant counts from active `BrandMembership`, preserve public OWNER restrictions, and align search test mocks with the real models.
- Replace the brittle logout source inspection with a behavioral assertion using the existing `AuthProvider.test.jsx` harness.
- Normalize Vietnamese `đ` as `d` in the existing table-promotion search helper.
- Keep staff creation logic from PR #1272 unchanged.

## Constraints

- Do not regenerate or broadly rewrite lockfiles.
- Do not restore authorization use of `refRestaurants`.
- Do not change the GraphQL search contract or public OWNER visibility rules.
- Do not change runtime logout behavior solely to satisfy the test.
- Do not change checkbox state or table mutation contracts while filtering promotions.
- Do not add dependencies.

## Acceptance criteria

1. Frontend and backend backend-dependency installation steps pass.
2. `search-public-safety.test.js` passes with the normalized BrandMembership scope.
3. AuthProvider logout is verified by calling the context action and asserting Apollo `clearStore` is invoked.
4. The standalone source-inspection logout test is removed.
5. Searching Vietnamese promotion names works without accents, including `đ`/`d` equivalence.
6. Temporary diagnostic workflow files are absent from the final diff.

## Validation plan

- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/search-public-safety.test.js`
- `npx vitest run src/context/__tests__/AuthProvider.test.jsx`
- `npx vitest run src/utils/installTablePromotionSearch.test.js`
- Existing GitHub Actions frontend and backend jobs.

## Out of scope

- Changing staff creation behavior.
- Adding fail-fast behavior to every local Vitest command.
- Updating dependency versions beyond the already committed lockfile.
