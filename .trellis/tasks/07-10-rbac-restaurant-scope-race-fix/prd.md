# RBAC restaurant scope race fix

## Current behavior and root cause

The manager restaurant selection is initialized from `manager.selectedRestaurantId` in `localStorage`. The stored value may belong to a previous account, brand, or restaurant scope. `useBrandManagement` previously returned that raw state during the first render and only corrected it in a later effect.

The RBAC page consumes the value immediately. `useRbacManagement` includes `staffList(restaurantId)` whenever the id is non-empty, so the stale id can reach the backend before the current `AuthContext` restaurant list has validated it. The backend correctly rejects that request with `FORBIDDEN_SCOPE`. After the selection effect runs, the page retries with a valid id and appears to work, which makes the failure intermittent.

## End-to-end flow traced

1. `BrandMembership` and `Restaurant` determine the restaurant scope exposed through `AuthContext.restaurants`.
2. `useBrandManagement` builds the active restaurant options and restores the previous manager selection from `localStorage`.
3. `useManagerRestaurantSelection` forwards the selected restaurant id to manager pages.
4. `RbacManagement` passes the id to `useRbacManagement`.
5. The GraphQL operation conditionally includes `staffList(restaurantId)` when the id is non-empty.
6. The staff resolver awaits `requireRestaurantAccess`, which checks the active membership scope before reading staff.
7. The RBAC UI renders roles, permissions, staff count, and assignment controls from the query result.

## Files changed and why

- `src/hooks/useBrandManagement.js`: derive the returned restaurant id synchronously from the currently accessible restaurant options. A stale stored id is never exposed to callers while scope is loading or before it has been validated. The existing effect now only synchronizes internal state to the already-resolved safe value.
- `src/hooks/useManagerRestaurantSelection.test.jsx`: add a regression test proving that a stale stored restaurant id is not observed by any caller during the first render.
- `.trellis/tasks/07-10-rbac-restaurant-scope-race-fix/task.json`: track the repository task.
- `.trellis/tasks/07-10-rbac-restaurant-scope-race-fix/prd.md`: record the root cause, flow, scope, and validation plan.

## Acceptance criteria

1. A restaurant id outside the current manager scope is never returned by `useManagerRestaurantSelection`.
2. While restaurant scope is loading, callers receive an empty restaurant id and therefore do not request scoped staff data.
3. Once valid restaurant options are available, the existing valid selection is preserved; otherwise the existing fallback behavior selects a safe option.
4. The backend `requireRestaurantAccess` guard remains unchanged.
5. The focused regression test fails with the previous implementation and passes with the fix.

## Validation plan

- Run `npx vitest run src/hooks/useManagerRestaurantSelection.test.jsx`.
- Run the RBAC component test if available: `npx vitest run src/components/Dashboard_Manager/RBAC/RbacManagement.test.jsx`.
- Run `npm run build` only if a full local checkout is available and broader verification is needed.

## Out of scope

- Weakening or bypassing restaurant authorization.
- Changing the GraphQL schema, staff resolver, Apollo query fields, or RBAC visual design.
- Adding dependencies or a second restaurant-selection state layer.

## Validation status

No test, build, CI workflow, or browser runtime check has been executed in the connector-only environment.
