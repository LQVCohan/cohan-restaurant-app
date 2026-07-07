# Compact restaurant chain management layout

## Current behavior

The manager chain-management page repeats selected-chain context in both `ManagementPageHeader` and a second identity panel. The member section also keeps the add-member controls permanently expanded and places the branch scope on a separate row. With realistic data, these repeated surfaces and nested cards increase vertical scrolling without adding new information.

The first compact pass reduced spacing, but it also inherited fixed-height scroll containers and single-line ellipsis rules from `BrandManagement.css`. At the reported desktop width, the final branch row, member search placeholder, long branch names, emails, and scope labels can therefore be clipped or hidden.

## End-to-end flow reviewed

1. `BrandMembership` validates owner/admin/manager/staff scope.
2. `brand.graphql` exposes `myBrands`, `brandMembers`, `updateBrand`, `addBrandMember`, and `updateBrandMember`.
3. Brand resolvers enforce `canManageBrand`, branch ownership, and one active manager per branch.
4. `useBrandManagement` merges `myBrands` with the current membership and stores selected chain/restaurant scope.
5. `BrandManagement` renders chain settings, branches, member creation, filtering, and status actions.
6. `ManagerLayout` mounts the page for `manager#brands` and loads the page-scoped compact stylesheet.

The data contract and authorization path are correct. The root cause is page composition and CSS overflow constraints, so no backend, GraphQL, or React-state change is required.

## Scope

- Remove the duplicated selected-chain identity surface from the visual layout while keeping the shared header metrics, chain selector, role, and status.
- Reduce repeated eyebrow labels and excess card/panel spacing.
- Keep the add-member controls compact on one desktop row when space permits.
- Keep manager branch scope, admin chain-wide scope, and staff branch options visible and usable.
- Remove nested branch-list scrolling and allow long branch/member content to wrap instead of being truncated.
- Reuse the current sage manager palette and component classes.

## Acceptance criteria

- The page shows materially more useful content above the fold on desktop.
- The selected chain, branch count, active-member count, role, and status remain available through the existing header.
- Account, role, manager branch scope, and add action fit one row at the reported desktop width when sufficient space is available.
- All branch rows are visible without an internal scrollbar.
- Branch names, manager names, account names, emails, role labels, scope labels, status labels, button labels, and search placeholder are not clipped or hidden; long values wrap within their container.
- Member cards remain readable while using less vertical space.
- At 1120px, 820px, 680px, 430px, 390x844, and 430x932, controls wrap without horizontal overflow.
- Keyboard focus, field labels, loading, errors, empty states, and reduced-motion behavior remain intact.
- No schema, resolver, permission, mutation, or restaurant-scope behavior changes.

## Out of scope

- Changing membership rules or owner transfer.
- Adding account search/autocomplete.
- Rebuilding `ManagementPageHeader` or the shared manager layout.
- Adding dependencies, modals, drawers, or new React state.

## Validation plan

- Run the existing `BrandManagement.test.jsx` component suite.
- Run the frontend production build.
- Review the authenticated page at desktop and narrow breakpoints when a browser environment is available.
