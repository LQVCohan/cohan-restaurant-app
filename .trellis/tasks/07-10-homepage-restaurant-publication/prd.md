# Homepage restaurant publication fix

## Current behavior

The customer homepage renders `RestaurantGrid`, which executes `restaurantsTop`. The query succeeds but returns no restaurants when every database document is still a draft.

Brand branch creation intentionally initializes new restaurants with `publicationStatus: draft` and `initialSetup.status: pending`. The public resolver correctly filters to active, published restaurants. The manager restaurant information page now exposes a publication action, but the first version used a full-width Ant `Alert` above the page and made this secondary action visually heavier than the profile editor itself.

## End-to-end trace

1. `Restaurant` stores `businessStatus`, `publicationStatus` and `operationalStatus`; new brand restaurants start as drafts.
2. `createRestaurant` persists the branch and its default warehouse.
3. `buildPublicRestaurantFilter` allows only active, published restaurants, with a legacy fallback for old documents.
4. `restaurantsTop` applies that filter and supplies the homepage GraphQL operation.
5. `RestaurantGrid` maps `restaurantsTop`; an empty result renders “Chưa có nhà hàng nổi bật”.
6. `RestaurantPublicationControl` queries and updates `publicationStatus` through the existing scoped `updateRestaurant` mutation.
7. `ManagerLayout` mounts the control immediately before the restaurant information page.

## Root cause

The publication contract is correct. The UI issue was hierarchy and density: a full-width warning banner consumed excessive vertical space even though the action is only a compact binary visibility setting.

## UI direction

Compact right-aligned visibility toolbar using the existing sage manager palette. Keep the status explicit in text, place the switch beside its label, align the toolbar with the restaurant page width, and stack it cleanly on mobile.

## Implementation

- Replace the large Ant `Alert` with a compact status, supporting text and switch layout.
- Keep the control in the existing manager-page position, but constrain it to the same 1440 px page width and align it to the right edge above the profile header.
- Use existing manager semantic tokens for published, draft and error states.
- Preserve the existing GraphQL query, mutation, permission, loading, success and error behavior.
- Add visible focus treatment, a 44 px interaction row and mobile stacking.
- Keep focused component coverage for the draft-to-published mutation contract and the visible draft state.

## Acceptance criteria

- The publication action no longer renders as a full-width alert.
- Desktop shows a compact right-aligned toolbar above the restaurant profile page.
- Mobile expands the toolbar to full width without overflow.
- A draft restaurant clearly displays “Bản nháp”; a published restaurant clearly displays “Đang công khai”.
- Turning on “Hiển thị công khai” immediately sends `publicationStatus: published`.
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
