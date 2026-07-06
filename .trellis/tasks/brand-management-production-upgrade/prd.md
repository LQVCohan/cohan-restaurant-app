# Restaurant chain management production upgrade

## Current behavior

The manager chain-management page currently renders a small set of generic white cards with utility classes. It exposes internal terminology (`Brand`, `User ID`, `Slug`), has no composed loading/error/empty states, no action feedback, no form validation, and no readable summary of branch/member scope. Mutation calls also trigger both Apollo `refetchQueries` and manual `refetch`, causing duplicate network requests.

## End-to-end flow

`Brand` and `BrandMembership` Mongoose models -> `brand.graphql` -> brand resolvers and restaurant-scope service -> `useBrandManagement` and page-local GraphQL operations -> `BrandManagement` actions -> component tests.

The backend already provides:

- `myBrands` and `myBrandMemberships`;
- `updateBrand` with `canManageBrand` enforcement;
- `createRestaurant` with `brandId`;
- `brandMembers`, `addBrandMember`, and `updateBrandMember`;
- role scope validation and the single-active-manager guard.

No schema or resolver change is required for this upgrade.

## Root causes

- The screen does not reuse `ManagementPageHeader` or shared manager palette variables.
- The component is compressed into one-line handlers and markup, making loading/error/disabled states easy to miss.
- Shared role wording still exposes `Brand` instead of user-facing Vietnamese chain terminology.
- Brand details requested by the form are incomplete even though the existing GraphQL type already provides them.
- Mutation actions do not catch errors or confirm success.
- Apollo refetch and manual refetch are both used for the same actions.

## Implementation

- Replace the generic layout with a scoped `brand-management` screen using `ManagementPageHeader`.
- Add summary metrics, chain selector, clear selected-chain context, structured configuration, branch cards, member search, scope labels, and composed empty/error/loading states.
- Use the shared manager sage palette and responsive CSS without a new dependency.
- Keep stored enum values and backend payloads unchanged while displaying Vietnamese labels.
- Add client-side validation for required chain name/slug, email format, branch name, account id, and membership scope.
- Remove duplicate manual refetches where mutation `refetchQueries` already refreshes the same server truth.
- Request `description` and `businessTaxCode` in the existing brand hook because the upgraded form uses them.
- Update shared role/scope wording from `Brand` to `chuỗi/chi nhánh` and update the existing sidebar assertion.

## Acceptance criteria

- The page matches the manager dashboard sage tone and uses the same surface, border, shadow, text, accent, focus, success, warning, and danger variables.
- The page remains usable at desktop, 390x844, and 430x932 without horizontal overflow.
- Loading, query error, no-chain, no-branch, no-member, and filtered-empty states are explicit.
- Save chain, add branch, add member, and change member status actions show loading, success, and error feedback.
- Empty optional business fields can be cleared while required `name` and `slug` remain validated.
- The page does not display `Brand`, raw membership status values, or raw time/status terminology as primary labels.
- Role and scope validation remains aligned with backend rules: admin is chain-wide, manager has exactly one branch, staff has at least one branch.
- Existing restaurant scoping and backend authorization remain unchanged.
- Targeted component tests, frontend lint, production build, and smoke tests pass.

## Files

- `src/components/Dashboard_Manager/Brand/BrandManagement.jsx`
- `src/components/Dashboard_Manager/Brand/BrandManagement.css`
- `src/components/Dashboard_Manager/Brand/BrandManagement.test.jsx`
- `src/hooks/useBrandManagement.js`
- `src/lib/userRoleDisplay.js`
- `src/components/Dashboard_Manager/Sidebar.test.jsx`

## Out of scope

- Creating a new account-search API.
- Adding brand image upload or address editing.
- Changing membership permission rules or owner-transfer behavior.
- Archiving/restoring a chain.
- Rebuilding the shared manager layout or introducing a new UI library.

## Validation plan

- Run the targeted BrandManagement and Sidebar tests.
- Run conflict-marker check, frontend lint, changed component tests, production build, and Playwright smoke tests through PR CI.
- Review the final diff for duplicated logic and contract drift.
- Manually inspect authenticated desktop and mobile layouts because CI cannot verify final visual contrast with real restaurant assets.
