# Archive customers per restaurant

## Current behavior

Customer lists always exclude `deletedAt != null`. The only delete mutation is global `softDeleteUser`, which disables the account across every restaurant. The customer page has no archive or restore action.

## Root cause

Customer membership is restaurant-scoped through `refRestaurants`, but deletion state exists only on the shared user account. Reusing global soft delete would hide the customer from every restaurant and block login.

## End-to-end flow

1. `Customer` stores restaurant-specific archive records.
2. `customerListPage` filters active or archived membership for the selected restaurant.
3. Bulk archive/restore mutations validate role, permission, and restaurant access, then use one `updateMany`.
4. `useUserManagement` exposes the query flag and mutations.
5. `CustomerManagement` provides archive, archived-view, and restore actions.
6. Resolver tests prove one restaurant can archive a shared customer without affecting another restaurant or the user account.

## Scope

- Archive all visible customer memberships for one restaurant.
- Keep user account, status, orders, and other restaurant memberships unchanged.
- Let admins view and restore archived customers.
- Require explicit confirmation for bulk archive.

## Files to change

- `cohan-restaurant-backend/models/customer.model.js`: store per-restaurant archive metadata.
- `cohan-restaurant-backend/graphql/schema/user.graphql`: add archived query flag and bulk mutations.
- `cohan-restaurant-backend/graphql/resolvers/user/query.js`: filter active versus archived customer memberships.
- `cohan-restaurant-backend/graphql/resolvers/user/mutation.js`: archive and restore with one scoped update.
- `src/hooks/useUserManagement.js`: expose Apollo operations.
- `src/components/Dashboard_Manager/Customer/CustomerManagement.jsx`: add archive/view/restore actions.
- `cohan-restaurant-backend/tests/resolvers/user-customer-restaurant-access.test.js`: cover restaurant isolation.

## Acceptance criteria

- Archiving restaurant A does not alter `status`, `deletedAt`, or restaurant B visibility.
- Normal customer lists exclude archived memberships.
- Admin archived view returns only archived memberships for the selected restaurant.
- Restore removes the restaurant archive marker and returns customers to the normal list.
- Bulk operations are restaurant-scoped and do not loop one mutation per customer.

## Out of scope

- Hard deletion.
- Global account deactivation.
- Per-customer selection UI.
- Automatic expiry of archived data.

## Validation plan

- Run the targeted customer restaurant-access resolver test.
- Run GraphQL schema validation.
- Run the frontend build if available.
