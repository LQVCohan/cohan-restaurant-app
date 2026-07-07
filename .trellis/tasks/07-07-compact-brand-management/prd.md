# Compact restaurant chain management layout

## Current behavior

The manager chain-management page repeats selected-chain context in both `ManagementPageHeader` and a second identity panel. The member section also keeps the add-member controls permanently expanded and places the branch scope on a separate row. With realistic data, these repeated surfaces and nested cards increase vertical scrolling without adding new information.

The first compact pass removed clipping, but the header statistics still stretch across the available column and several labels remain longer than the information they communicate. The member filter already receives `fullName`, `user.id`, and `userId`, but its copy advertises email and role instead of the production search contract requested for this screen.

## End-to-end flow reviewed

1. `BrandMembership` validates owner/admin/manager/staff scope.
2. `brand.graphql` exposes `myBrands`, `brandMembers`, `updateBrand`, `addBrandMember`, and `updateBrandMember`.
3. Brand resolvers enforce `canManageBrand`, branch ownership, and one active manager per branch.
4. `useBrandManagement` merges `myBrands` with the current membership and stores selected chain/restaurant scope.
5. `BrandManagement` renders chain settings, branches, member creation, local member filtering, and status actions.
6. `ManagerLayout` mounts the page for `manager#brands` and loads the page-scoped compact stylesheet.

The backend contract is sufficient. The requested change belongs to page wording, local filtering, and page-scoped layout only.

## Scope

- Keep the shared header metrics while rendering them as compact statistics rather than wide cards.
- Shorten repeated Vietnamese copy without removing required labels, validation, or status context.
- Keep the add-member controls compact on one desktop row when space permits.
- Search members by full name or account/user ID.
- Keep manager branch scope, admin chain-wide scope, and staff branch options visible and usable.
- Keep all long branch/member values readable without clipping.
- Reuse the current sage manager palette and component classes.

## Acceptance criteria

- Header statistics use only the width needed by their content and leave no large empty card area.
- Production copy is direct and concise: `Quản lý chuỗi`, `Chuỗi`, `Chi nhánh`, `Thành viên`, `Vai trò`, and `Trạng thái`.
- The member search placeholder clearly says `Tên hoặc mã tài khoản`.
- Searching by a member full name returns that member.
- Searching by `userId` or `user.id` returns that member.
- Email, role, branch scope, and status are not treated as member-search keys.
- Account, role, manager branch scope, and add action fit one row at the reported desktop width when sufficient space is available.
- All branch rows remain visible without an internal scrollbar.
- At 1120px, 820px, 680px, 430px, 390x844, and 430x932, controls wrap without horizontal overflow.
- Keyboard focus, field labels, loading, errors, empty states, and reduced-motion behavior remain intact.
- No schema, resolver, permission, mutation, or restaurant-scope behavior changes.

## Out of scope

- Changing membership rules or owner transfer.
- Adding account autocomplete or server-side search.
- Rebuilding `ManagementPageHeader` or the shared manager layout.
- Adding dependencies, modals, drawers, or new React state.

## Validation plan

- Run the existing `BrandManagement.test.jsx` component suite, including name and ID filtering.
- Run the frontend production build.
- Review the authenticated page at desktop and narrow breakpoints when a browser environment is available.
