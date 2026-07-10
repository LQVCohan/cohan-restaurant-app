# Homepage restaurant publication fix

## Current behavior

The customer homepage renders `RestaurantGrid`, which executes `restaurantsTop`. The query succeeds but returns no restaurants when every database document is still a draft.

Brand branch creation intentionally initializes new restaurants with `publicationStatus: draft` and `initialSetup.status: pending`. The public resolver correctly filters to active, published restaurants. The manager restaurant information page now exposes a publication action, but it is rendered as a standalone `Alert` by `ManagerLayout`, visually detached from the profile that it controls.

## End-to-end trace

1. `Restaurant` stores `businessStatus`, `publicationStatus` and `operationalStatus`; new brand restaurants start as drafts.
2. `createRestaurant` persists the branch and its default warehouse.
3. `buildPublicRestaurantFilter` allows only active, published restaurants, with a legacy fallback for old documents.
4. `restaurantsTop` applies that filter and supplies the homepage GraphQL operation.
5. `RestaurantGrid` maps `restaurantsTop`; an empty result renders “Chưa có nhà hàng nổi bật”.
6. `RestaurantPublicationControl` queries and updates `publicationStatus` through the existing scoped `updateRestaurant` mutation.
7. `RestaurantInfoManagement` owns the restaurant currently displayed in the profile editor and its customer-visible summary panel.

## Root cause

The publication contract is correct. The remaining UX issue is placement and hierarchy: the action is outside `RestaurantInfoManagement`, consumes a full-width warning banner, and can be driven by a different selected-restaurant source than the profile editor.

## UI direction

Compact contextual visibility control using the existing sage surfaces: place it in the top row of “Hồ sơ hiển thị với khách hàng”, keep the publication state readable without relying on color, and stack it full-width on mobile.

## Implementation

- Move `RestaurantPublicationControl` from `ManagerLayout` into `RestaurantInfoManagement` so it uses the editor's `selectedRestaurantId`.
- Replace the large `Alert` presentation with a compact status-and-switch control.
- Place it beside the profile visibility eyebrow on desktop and above the profile title on narrow screens.
- Preserve the existing query, mutation, permission, loading, success and error behavior.
- Keep focused component coverage for the draft-to-published mutation contract.

## Acceptance criteria

- The publication action appears inside the customer-visible profile summary, not as a detached page banner.
- Desktop keeps the label and action on one balanced top row.
- Mobile stacks the action without overflow and provides a practical touch target.
- A selected draft restaurant clearly displays “Bản nháp”; a published restaurant clearly displays “Đang công khai”.
- Turning on “Hiển thị công khai” immediately sends `publicationStatus: published` for the same restaurant displayed by the profile editor.
- Turning it off sends `publicationStatus: draft`.
- Loading, disabled and error states remain understandable and keyboard accessible.
- The customer homepage public filter remains unchanged.
- No schema, resolver, permission, dependency or database migration is added.

## Out of scope

- Automatically publishing incomplete branches.
- Exposing draft restaurants to public queries.
- Changing onboarding, business status or operational status rules.
- Directly modifying production MongoDB records.
- Redesigning unrelated restaurant profile sections.

## Validation plan

- Focused Vitest for `RestaurantPublicationControl`.
- GraphQL operation validation.
- Conflict-marker check.
- Frontend production build.
