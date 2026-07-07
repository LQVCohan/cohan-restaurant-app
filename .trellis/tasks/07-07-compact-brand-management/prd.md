# Compact restaurant chain management layout

## Current behavior

The manager chain-management page now uses compact header metrics and readable production wording. The remaining desktop imbalance is in the two-column workspace: `brand-workspace` still inherits `align-items: start`, so the company-information and branch panels end at different vertical positions.

The member section also mixes two different jobs visually. The small unlabeled search box filters existing members, while the account, role, and branch controls below add a member. Because the search control is visually detached and has no visible field label, users can mistake the add-member account field for the member-list search and cannot clearly narrow the displayed member list by role or branch.

## End-to-end flow reviewed

1. `BrandMembership` validates owner/admin/manager/staff scope.
2. `brand.graphql` exposes `myBrands`, `brandMembers`, `updateBrand`, `addBrandMember`, and `updateBrandMember`.
3. Brand resolvers enforce `canManageBrand`, branch ownership, and one active manager per branch.
4. `useBrandManagement` merges `myBrands` with the current membership and stores selected chain/restaurant scope.
5. `BrandManagement` receives each member's `user.fullName`, `user.id`, `userId`, `role`, and `restaurantIds`; these fields are sufficient for local search and filtering.
6. `ManagerLayout` mounts the page for `manager#brands` and loads the page-scoped compact stylesheet.

The backend contract remains correct. The root causes are page composition, missing visible filter labels, and the desktop grid alignment rule.

## Scope

- Keep the shared header metrics compact.
- Make the company-information and branch panels equal height on the desktop two-column layout without fixed pixel heights.
- Separate the existing-member filter toolbar from the add-member form.
- Make account search visibly labeled and searchable by employee full name or account/user ID.
- Add role and branch filters for the displayed member list.
- Treat owner/admin memberships as chain-wide when a branch filter is active.
- Keep manager branch scope, admin chain-wide scope, and staff branch options visible and usable.
- Keep all long branch/member values readable without clipping.
- Reuse the current sage manager palette and component classes.

## Acceptance criteria

- On desktop, the bottom edges of `Thông tin doanh nghiệp` and `Chi nhánh` align.
- Equal height is achieved with grid stretch/flex layout, not a hard-coded panel height.
- The member area has a clearly visible `Tìm và lọc thành viên` toolbar.
- The search field has a visible `Tìm tài khoản` label and placeholder `Tên nhân viên hoặc mã tài khoản`.
- Searching by `user.fullName`, `userId`, or `user.id` returns the matching member.
- The role filter supports all/admin/manager/staff.
- The branch filter supports all branches and each restaurant in the selected chain.
- Selecting a branch keeps chain-wide owner/admin members visible and filters branch-scoped members by `restaurantIds`.
- The add-member controls remain a separate, clearly labeled `Thêm thành viên` area.
- Account, role, manager branch scope, and add action fit one row at the reported desktop width when sufficient space is available.
- At 1120px, 820px, 680px, 430px, 390x844, and 430x932, controls wrap without horizontal overflow.
- Keyboard focus, field labels, loading, errors, empty states, and reduced-motion behavior remain intact.
- No schema, resolver, permission, mutation, or restaurant-scope behavior changes.

## Out of scope

- Changing membership rules or owner transfer.
- Adding server-side member search or account autocomplete for users who are not yet members.
- Rebuilding `ManagementPageHeader` or the shared manager layout.
- Adding dependencies, modals, drawers, or new backend state.

## Validation plan

- Run the existing `BrandManagement.test.jsx` component suite, including name/ID search and role/branch filtering.
- Run the frontend production build.
- Review the authenticated page at desktop and narrow breakpoints when a browser environment is available.
