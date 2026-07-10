# Homepage restaurant publication fix

## Current behavior

The customer homepage renders `RestaurantGrid`, which executes `restaurantsTop`. The query succeeds but returns no restaurants when every database document is still a draft.

Brand branch creation intentionally initializes new restaurants with `publicationStatus: draft` and `initialSetup.status: pending`. The public resolver correctly filters to active, published restaurants. However, the manager restaurant profile does not query, display or persist `publicationStatus`, leaving no normal UI path to publish a branch after its information is ready.

## End-to-end trace

1. `Restaurant` schema stores `businessStatus`, `publicationStatus` and `operationalStatus`; new brand restaurants start as drafts.
2. `createRestaurant` persists the branch and its default warehouse.
3. `buildPublicRestaurantFilter` allows only active, published restaurants, with a legacy fallback for old documents.
4. `restaurantsTop` applies that filter and supplies the homepage GraphQL operation.
5. `RestaurantGrid` maps `restaurantsTop`; an empty result renders “Chưa có nhà hàng nổi bật”.
6. `RestaurantInfoManagement` already updates the restaurant through `UpdateRestaurantInput`, but omits the existing `publicationStatus` field from query, form and mutation.

## Root cause

The public filtering contract is correct. The missing boundary is the manager publication workflow: database restaurants can remain drafts indefinitely because the existing management UI cannot change `publicationStatus`.

## Scope

- Query `publicationStatus` in the restaurant detail and update response.
- Keep it in local restaurant form state.
- Add one explicit Vietnamese publication control beside the operational controls.
- Save `published` or `draft` through the existing `updateRestaurant` mutation.
- Verify the persisted publication value after refetch.
- Add a focused component regression test.

## Acceptance criteria

- A draft restaurant displays as not publicly visible in the manager profile.
- Turning on “Hiển thị công khai” and saving sends `publicationStatus: published`.
- Turning it off sends `publicationStatus: draft`.
- The refetched value participates in the existing save-consistency check.
- The customer homepage public filter remains unchanged and continues to exclude drafts, hidden, inactive and suspended restaurants.
- No schema, resolver, permission, dependency or database migration is added.

## Out of scope

- Automatically publishing incomplete branches.
- Exposing draft restaurants to public queries.
- Changing onboarding, business status or operational status rules.
- Directly modifying production MongoDB records.

## Validation plan

- Focused Vitest for `RestaurantInfoManagement`.
- GraphQL operation validation.
- Conflict-marker check.
- Frontend production build.
