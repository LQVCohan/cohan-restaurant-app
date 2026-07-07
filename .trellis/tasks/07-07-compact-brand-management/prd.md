# Compact restaurant chain management layout

## Current behavior

The chain-management page has compact filters and searchable account selection. The remaining ownership gap is more than a missing button: `Brand.ownerId` and the `owner` membership must change together, while the previous owner must receive a valid manager scope. Using the generic member mutation could otherwise create two owners or leave `Brand.ownerId` pointing to the old owner.

## End-to-end flow reviewed

1. `Brand.ownerId` stores the current owner reference used by Brand resolvers.
2. `BrandMembership` is the permission source for owner/admin/manager/staff scope; managers require exactly one restaurant.
3. `restaurantScope.service` grants owner/admin brand-wide access and manager access only to assigned restaurants.
4. `brand.graphql` exposes general member mutations but previously had no ownership-transfer contract.
5. The Brand resolver protected ordinary membership writes but did not atomically synchronize both owner records.
6. `useBrandManagement` exposes the current account's selected-brand membership role.
7. `BrandManagement` renders the member workflow and can redirect the previous owner to the assigned branch after transfer.

The root fix is a dedicated transaction-backed ownership mutation. It promotes one active existing member, demotes the current owner to manager, assigns exactly one branch, updates `Brand.ownerId`, and blocks owner changes through generic member mutations.

## Scope

- Keep the existing collapsible member filters and searchable add-member picker.
- Add `TransferBrandOwnershipInput`, payload, and `transferBrandOwnership` mutation.
- Allow only the current active Brand owner to execute the transfer.
- Require the new owner to be a different, active existing member of the same Brand.
- Require exactly one Brand restaurant for the previous owner's manager scope.
- Reject a selected restaurant when another manager would remain assigned to it.
- In one MongoDB transaction:
  - promote the selected membership to `owner` with chain-wide scope;
  - demote the current owner membership to `manager` with one restaurant;
  - update `Brand.ownerId` to the selected user.
- Block adding, promoting, demoting, deactivating, or removing an owner through generic membership mutations.
- Show a compact owner-only transfer disclosure in the member area.
- Require an explicit confirmation checkbox and redirect the previous owner to the assigned branch dashboard after success.
- Reuse the current React, Apollo, SCSS, GraphQL, and manager navigation patterns; add no dependency.

## Acceptance criteria

- Non-owners do not see the ownership-transfer control.
- Only the current active owner can call `transferBrandOwnership`.
- The target must be an active existing member and cannot be the current owner.
- The previous owner must be assigned exactly one restaurant after transfer.
- A branch already occupied by an unrelated active manager cannot be selected.
- A manager target may vacate their current branch by becoming owner, allowing the previous owner to take that branch.
- After success, exactly one membership is `owner`, the previous owner is `manager`, and `Brand.ownerId` matches the new owner.
- All three writes commit or roll back together.
- Generic member mutations direct ownership changes to the dedicated transfer flow.
- The UI displays the consequences, requires explicit confirmation, sends the correct three IDs, selects the previous owner's branch, and navigates to the dashboard.
- Existing member search, filters, add-member behavior, manager uniqueness, and responsive layout remain intact.

## Out of scope

- Creating a new account during transfer; add the account as a member first.
- Multi-owner Brands or co-owner voting/approval.
- Email invitations, OTP confirmation, delayed transfer, or transfer cancellation windows.
- Fuzzy/phonetic search, pagination, or external search services.
- Rebuilding shared manager layout components.

## Validation plan

- Run the focused ownership resolver test for successful atomic transfer and non-owner rejection.
- Run the ownership-transfer component test for owner-only visibility, confirmation, mutation variables, branch selection, and navigation.
- Run the existing BrandManagement component suite and member-candidate resolver suite.
- Run GraphQL schema validation and the frontend production build.
- Review the authenticated owner and admin screens at desktop, 390x844, and 430x932 when a browser environment is available.
