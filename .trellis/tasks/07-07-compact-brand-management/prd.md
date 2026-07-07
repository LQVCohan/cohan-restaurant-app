# Compact restaurant chain management layout

## Current behavior

The chain-management page already supports searchable account selection, adding an admin / manager / staff member, temporarily disabling or reactivating a membership, and an atomic owner-transfer flow. The remaining gap is the existing-member workflow: an owner or administrator cannot edit a non-owner member's role or restaurant scope from the page after the member has been added.

The backend contract already supports this through `updateBrandMember`. Adding another mutation would duplicate validation for restaurant ownership, manager uniqueness, and role scope. The smallest root fix is to expose that existing contract in the member area while keeping ownership changes isolated in `transferBrandOwnership`.

## End-to-end flow reviewed

1. `Brand.ownerId` stores the current owner reference used by Brand resolvers.
2. `BrandMembership` is the permission source for owner / admin / manager / staff scope. Managers require exactly one restaurant; staff require at least one.
3. `restaurantScope.service` grants owner/admin brand-wide access and manager/staff access only to assigned restaurants.
4. `brand.graphql` already exposes `addBrandMember`, `updateBrandMember`, `removeBrandMember`, and `transferBrandOwnership`.
5. The Brand resolver validates restaurant membership, prevents two active managers from sharing a restaurant, and blocks generic mutations from changing an owner.
6. `useBrandManagement` exposes the current account's selected-brand membership role.
7. `BrandManagement` renders add-member and status actions, then delegates owner transfer to the compact member-access component.

## Scope

- Keep the existing member filters and searchable add-member picker.
- Keep the dedicated atomic ownership-transfer mutation and owner-only confirmation flow.
- Add an existing-member access disclosure for the selected Brand.
- Allow active Brand owners and administrators to select a non-owner membership and change it to:
  - `admin`, with chain-wide scope and no restaurant IDs;
  - `manager`, with exactly one restaurant;
  - `staff`, with one or more restaurants.
- Pre-fill the selected member's current role and restaurant scope.
- Disable manager restaurant choices already assigned to another active manager, while allowing the selected manager to keep their current restaurant.
- Submit role and restaurant scope through the existing `updateBrandMember` mutation, then refresh the member list.
- Continue using membership `inactive` / `active` status as the existing revoke / restore operation. Do not add a second UI action backed by `removeBrandMember`, because it performs the same soft-disable behavior.
- Never allow the generic access editor to change the owner membership; ownership remains in the dedicated transfer flow.
- Reuse the existing React, Apollo and manager visual patterns; add no dependency.

## Acceptance criteria

- A Brand owner or administrator sees the existing-member access control; manager and staff memberships do not.
- Owner memberships are absent from the editable-member selector.
- Selecting a member preloads their current role and restaurant IDs.
- Saving an administrator sends `role: "admin"` and `restaurantIds: []`.
- Saving a manager requires exactly one Brand restaurant and sends that single ID.
- Saving staff requires at least one Brand restaurant and sends all selected IDs.
- A restaurant assigned to another active manager cannot be selected for a manager update.
- Backend validation remains the source of truth and errors are shown inline.
- The member list refreshes after a successful update and a success message is shown.
- Existing add-member, status revoke / restore, filters, manager uniqueness, ownership transfer, and responsive layout remain intact.
- Only the current active owner can execute `transferBrandOwnership`; the three ownership writes still commit or roll back together.

## Out of scope

- Changing the global `User.role`, `userType`, or account portal from this Brand-scoped screen.
- Creating a new account from the access editor; the searchable add-member flow remains responsible for membership creation.
- Hard-deleting memberships or adding a second revoke mutation.
- Multi-owner Brands, invitations, OTP confirmation, delayed transfer, or transfer cancellation windows.
- Rebuilding the shared manager layout or adding a UI library.

## Validation plan

- Run the focused ownership resolver tests.
- Run the member-access component tests for owner/admin visibility, existing role preload, admin/manager/staff mutation variables, manager conflict handling, and ownership transfer.
- Run the existing `BrandManagement` component suite to protect add-member, filtering, and status actions.
- Run GraphQL validation and the frontend production build.
- Review the authenticated owner and admin screens at desktop, 390x844, and 430x932 when a browser environment is available.
