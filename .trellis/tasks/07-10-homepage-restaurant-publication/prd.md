# Homepage restaurant publication fix

## Current behavior

The customer homepage renders `RestaurantGrid`, which executes `restaurantsTop`. The query succeeds but returns no restaurants when every database document is still a draft.

Brand branch creation intentionally initializes new restaurants with `publicationStatus: draft` and `initialSetup.status: pending`. The public resolver correctly filters to active, published restaurants. The manager restaurant information page previously had no explicit action for publishing a branch after its information was ready.

## End-to-end trace

1. `Restaurant` stores `businessStatus`, `publicationStatus` and `operationalStatus`; new brand restaurants start as drafts.
2. `createRestaurant` persists the branch and its default warehouse.
3. `buildPublicRestaurantFilter` allows only active, published restaurants, with a legacy fallback for old documents.
4. `restaurantsTop` applies that filter and supplies the homepage GraphQL operation.
5. `RestaurantGrid` maps `restaurantsTop`; an empty result renders “Chưa có nhà hàng nổi bật”.
6. The existing `updateRestaurant` mutation already accepts `publicationStatus`, enforces `restaurant.write`, and validates restaurant scope.
7. `ManagerLayout` already owns the active restaurant scope used by the manager workspace.

## Root cause

The public filtering contract is correct. The missing boundary was the manager publication workflow: database restaurants could remain drafts indefinitely because no explicit UI action changed `publicationStatus`.

## Implementation

- Add `RestaurantPublicationControl` to query the selected restaurant's business and publication states.
- Reuse the existing `updateRestaurant` mutation to persist `published` or `draft`.
- Mount the control only on the manager restaurant information page and pass the active restaurant scope from `ManagerLayout`.
- Refetch after mutation and report success or failure beside the affected action.
- Add focused component coverage for the draft-to-published mutation contract.

## Acceptance criteria

- A selected draft restaurant displays as not publicly visible in the manager information page.
- Turning on “Hiển thị công khai” immediately sends `publicationStatus: published` for that restaurant.
- Turning it off sends `publicationStatus: draft`.
- The action uses the same selected restaurant as the manager scope selector.
- The customer homepage public filter remains unchanged and continues to exclude drafts, hidden, inactive and suspended restaurants.
- An inactive restaurant clearly states that publishing alone does not make it public.
- No schema, resolver, permission, dependency or database migration is added.

## Out of scope

- Automatically publishing incomplete branches.
- Exposing draft restaurants to public queries.
- Changing onboarding, business status or operational status rules.
- Directly modifying production MongoDB records.

## Validation plan

- Focused Vitest for `RestaurantPublicationControl`.
- GraphQL operation validation.
- Conflict-marker check.
- Frontend production build.
