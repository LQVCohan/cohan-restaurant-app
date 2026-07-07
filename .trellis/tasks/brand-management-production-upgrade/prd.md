# Restaurant chain management production upgrade

## Previous behavior

The manager chain-management page rendered a small set of generic white cards with utility classes. It exposed internal terminology such as `Brand`, `User ID`, and `Slug`; had no composed loading, error, or empty states; provided no action feedback or form validation; and did not present branch/member scope clearly. Mutation handlers also combined Apollo `refetchQueries` with manual refetches for the same server data.

## End-to-end flow reviewed

`Brand` and `BrandMembership` Mongoose models -> `brand.graphql` -> brand resolvers and restaurant-scope service -> page-local GraphQL operations -> `BrandManagement` actions -> component tests.

The backend already provides:

- `myBrands` and `myBrandMemberships`;
- `updateBrand` with `canManageBrand` enforcement;
- `createRestaurant` with `brandId`;
- `brandMembers`, `addBrandMember`, and `updateBrandMember`;
- role-scope validation and the single-active-manager guard.

No schema, resolver, service, or permission change is required.

## Root causes

- The page did not reuse `ManagementPageHeader` or shared manager palette variables.
- Dense one-line handlers and markup obscured loading, error, disabled, and validation states.
- Page wording exposed internal Brand terminology instead of production Vietnamese chain/branch labels.
- Mutation actions did not catch errors or confirm success.
- Apollo refetch and manual refetch were both used for the same chain/branch actions.

## Implemented upgrade

- Rebuilt the screen as a page-scoped `brand-management` workspace using `ManagementPageHeader`.
- Added chain metrics, chain selection, selected-chain context, structured business settings, branch cards, member search, scope controls, and explicit loading/error/empty states.
- Added client validation for required chain name/slug, email format, branch name, account id, and membership scope.
- Added loading, success, and error feedback for saving a chain, creating a branch, adding a member, changing member status, and refreshing data.
- Removed duplicate manual refetches where Apollo mutation refetch already refreshes the same server truth.
- Kept role and scope wording local to this page so unrelated dashboard surfaces and tests remain untouched.
- Kept the existing hook, shared role helper, schema, resolvers, enum values, and authorization behavior unchanged.
- Added scoped responsive CSS using the existing manager sage variables without a new dependency.

## Acceptance criteria

- The page matches the manager dashboard sage tone and uses the shared surface, border, shadow, text, accent, focus, success, warning, and danger variables.
- The page remains usable at desktop, 390x844, and 430x932 without horizontal overflow.
- Loading, query error, no-chain, no-branch, no-member, and filtered-empty states are explicit.
- Save chain, add branch, add member, change member status, and refresh actions expose processing, success, and error states.
- Empty optional business fields can be cleared while required `name` and `slug` remain validated.
- User-facing labels use chain/branch wording instead of internal Brand terminology or raw status values.
- Role/scope validation remains aligned with backend rules: admin is chain-wide, manager has exactly one branch, and staff has at least one branch.
- Existing restaurant scoping and backend authorization remain unchanged.
- Targeted component tests, frontend lint, production build, backend checks, and smoke tests pass.

## Changed files

- `src/components/Dashboard_Manager/Brand/BrandManagement.jsx`
- `src/components/Dashboard_Manager/Brand/BrandManagement.css`
- `src/components/Dashboard_Manager/Brand/BrandManagement.test.jsx`

## Automated validation completed

GitHub Actions run `28830462172` passed:

- unresolved conflict-marker check;
- frontend lint and unit tests;
- menu RBAC tests;
- changed component tests for the chain-management flows;
- production frontend build;
- Playwright browser installation and smoke tests;
- backend lint, full tests, menu RBAC tests, and build.

The focused regression suite verifies production wording, optional-field clearing, branch creation and scope selection, manager branch validation, member filtering, and membership-status changes.

## Manual visual validation still required

- Review the authenticated page at desktop width with realistic chain, branch, and member counts.
- Review at 390x844 and 430x932 to confirm the form, branch cards, member controls, and status actions remain single-column without horizontal overflow.
- Confirm logo and branch images retain readable contrast with production assets.

## Out of scope

- Creating a new account-search API.
- Adding chain image upload, tax-profile expansion, or address editing.
- Changing membership permission rules or owner-transfer behavior.
- Archiving/restoring a chain.
- Rebuilding the shared manager layout or introducing a new UI library.
