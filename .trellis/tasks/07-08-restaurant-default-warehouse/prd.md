# Restaurant default warehouse

## Current behavior

`createRestaurant` validates restaurant scope and saves only the `Restaurant` document. Warehouse creation is a separate inventory mutation. The manager storage screen queries `warehouses`, selects the first row when present, and requires a concrete warehouse for stock actions. A restaurant with no warehouse therefore reaches a dead end: the selector is disabled and the page offers no setup action.

## Root cause

The invariant “an operational restaurant starts with one warehouse” is not enforced at the shared restaurant-creation boundary. The UI assumes the invariant but does not recover legacy data created before it exists.

## End-to-end flow

`Restaurant` / `Warehouse` Mongoose models -> `createRestaurant` and inventory warehouse resolvers -> `CREATE_RESTAURANT`, `WAREHOUSES_QUERY`, `createWarehouse` Apollo operations -> Brand restaurant creation and `StorageManagement` / `Header` -> focused backend and component tests.

## Scope

- Create the restaurant and its first active warehouse in one MongoDB transaction.
- Use the existing warehouse model and GraphQL mutation; add no new schema or dependency.
- Name the initial warehouse `Kho chính` with code `MAIN`.
- Show a composed setup state when a scoped legacy restaurant has zero warehouses.
- Allow users with inventory write permission to create the same default warehouse from that state, then select it immediately.
- Keep read-only users informed without showing an unusable action.

## Acceptance criteria

- A successful `createRestaurant` produces exactly one active warehouse belonging to the new restaurant.
- If default warehouse creation fails, the restaurant transaction does not commit.
- Existing authorization and brand scope checks execute before database writes.
- The storage page automatically selects the first warehouse after query/refetch.
- A legacy restaurant with zero warehouses shows a clear setup state instead of empty operational tabs.
- An authorized manager can create `Kho chính` from the setup state and continue without reloading the page.
- A read-only manager sees explanatory copy and no create action.
- Existing stock, ingredient, recipe, supply, permission, currency, and restaurant selection behavior remains unchanged.

## Files

- `cohan-restaurant-backend/graphql/resolvers/restaurant/mutation.js`
- `cohan-restaurant-backend/tests/resolvers/restaurant-mutation-access.test.js`
- `src/components/Dashboard_Manager/Storage/graphql/inventory.gql.js`
- `src/components/Dashboard_Manager/Storage/StorageManagement.jsx`
- `src/components/Dashboard_Manager/Storage/StorageManagement.scss`
- `src/components/Dashboard_Manager/Storage/StorageManagement.test.jsx`

## Out of scope

- Full warehouse CRUD redesign.
- Migrating all historical restaurants automatically in a database script.
- Changing stock movement, recipe consumption, or warehouse deletion rules.
- Adding a default warehouse field to the Restaurant GraphQL type.

## Validation plan

- Focused restaurant mutation resolver test.
- Focused `StorageManagement` component test.
- `npm run check:conflicts`.
- `npm run check:graphql`.
- Relevant frontend/backend unit or component command and production build when the environment is available.
