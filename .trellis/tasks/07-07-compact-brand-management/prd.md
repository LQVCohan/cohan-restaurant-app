# Compact restaurant chain management layout

## Current behavior

The chain-management page supports searchable account selection, adding an admin / manager / staff member, editing an existing member's role and restaurant scope, temporarily disabling or reactivating a membership, and transferring Brand ownership.

The old ownership flow required the previous owner to choose one restaurant and become that restaurant's manager. This added an unrelated branch decision to a Brand-level action and made the compact panel unnecessarily wide. The ownership transfer now keeps the previous owner as a chain administrator, which already has valid Brand-wide scope with no restaurant IDs.

## End-to-end flow reviewed

1. `Brand.ownerId` stores the current owner reference used by Brand resolvers.
2. `BrandMembership` is the permission source for owner / admin / manager / staff scope. Owner and admin memberships are Brand-wide and do not require restaurants.
3. `restaurantScope.service` grants owner/admin Brand-wide access and manager/staff access only to assigned restaurants.
4. `brand.graphql` exposes `addBrandMember`, `updateBrandMember`, `removeBrandMember`, and `transferBrandOwnership`.
5. The transfer resolver verifies the current owner and target account, then synchronizes both memberships and `Brand.ownerId` in one transaction.
6. `useBrandManagement` exposes the current account's selected-brand membership role.
7. `BrandManagement` renders add-member and status actions, then delegates role editing and owner transfer to the compact member-access component.

## Scope

- Keep the existing member filters and searchable add-member picker.
- Keep the dedicated atomic ownership-transfer mutation and owner-only confirmation flow.
- Allow active Brand owners and administrators to edit non-owner membership roles and restaurant scopes through `updateBrandMember`.
- Transfer ownership with only `brandId` and `newOwnerUserId`.
- Promote the selected active manager/admin membership to `owner` with no restaurant IDs.
- Change the previous owner membership to `admin` with no restaurant IDs, preserving Brand-wide management access.
- Remove the previous-owner restaurant field, restaurant validation, and manager-conflict check from the ownership flow.
- Show a compact two-column transfer row with the member selector and action button, followed by one confirmation control.
- Continue using membership `inactive` / `active` status as the existing revoke / restore operation.
- Never allow the generic access editor to change the owner membership; ownership remains in the dedicated transfer flow.
- Reuse the existing React, Apollo, GraphQL and manager visual patterns; add no dependency.

## Acceptance criteria

- A Brand owner or administrator sees the existing-member access control; manager and staff memberships do not.
- Owner memberships are absent from the editable-member selector.
- Saving an administrator sends `role: "admin"` and `restaurantIds: []`.
- Saving a manager requires exactly one Brand restaurant.
- Saving staff requires at least one Brand restaurant.
- Only the current active owner sees and can execute the ownership-transfer control.
- Ownership transfer does not display or submit a restaurant ID.
- After success, exactly one membership is `owner`, the previous owner is `admin`, both have empty restaurant scopes, and `Brand.ownerId` matches the new owner.
- All ownership writes commit or roll back together.
- The transfer panel remains compact at desktop width and stacks cleanly on mobile.
- Backend validation remains the source of truth and errors are shown inline.
- Existing add-member, status revoke / restore, filters, manager uniqueness and responsive layout remain intact.

## Out of scope

- Changing the global `User.role`, `userType`, or account portal from this Brand-scoped screen.
- Creating a new account from the access editor.
- Hard-deleting memberships or adding a second revoke mutation.
- Multi-owner Brands, invitations, OTP confirmation, delayed transfer, or transfer cancellation windows.
- Rebuilding the shared manager layout or adding a UI library.

## Validation plan

- Run the focused ownership resolver tests for successful branchless transfer, non-owner rejection, and invalid target account role.
- Run the member-access component tests for owner/admin visibility, role editing, manager conflicts, and transfer variables without a restaurant ID.
- Run the existing `BrandManagement` component suite.
- Run GraphQL schema and operation validation and the frontend production build.
- Review the authenticated owner screen at desktop, 390x844, and 430x932 when a browser environment is available.
