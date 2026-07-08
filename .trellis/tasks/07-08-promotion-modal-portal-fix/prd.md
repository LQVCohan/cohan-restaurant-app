# Fix blurred promotion modal

## Current behavior

Opening the create/edit promotion dialog from the manager promotion page dims and blurs the whole manager viewport, including the modal content itself. The dialog is also positioned through negative-margin viewport overrides instead of a stable viewport boundary.

## Root cause and flow

The promotion data flow is valid and remains unchanged:

`PromotionSchema -> promotion.graphql -> PromotionMutation.createPromotion/updatePromotion -> usePromotions -> PromotionManagement -> PromotionModal`.

The defect is at the UI boundary. `PromotionManagement` mounts the promotion, coupon and coupon-package dialogs inside `manager-layout__content`. Manager layout ancestors use `transform`, `contain: paint` and isolated stacking contexts, so a descendant `position: fixed` overlay is trapped inside that layout. `PromotionModalViewportFix.css` compensates by creating a `body::before` backdrop with blur and moving the dialog upward with a negative margin. Because the modal remains in the transformed subtree, the body-level backdrop can cover and blur the modal itself.

## Requirements

- Portal the promotion, coupon and coupon-package dialogs to `document.body` from their shared page boundary.
- Preserve modal components, form state, validation, permissions, GraphQL inputs, save behavior and refetch behavior.
- Remove the body-level pseudo-element blur and negative-margin stacking workaround.
- Let the existing modal overlay own the dimmed blurred backdrop.
- Keep the current compact modal sizing and mobile viewport rules.
- Add a focused component assertion proving the promotion modal mounts directly under `document.body`.

## Acceptance criteria

- The promotion modal content is sharp while the manager page behind it is dimmed and blurred.
- The overlay covers the viewport and is not clipped by the manager content, header or sidebar.
- Promotion, coupon and coupon-package dialogs use the same portal boundary.
- Existing promotion save/edit behavior and restaurant scoping remain unchanged.
- The focused PromotionManagement test passes.

## Files

- `src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx`
- `src/styles/PromotionModalViewportFix.css`
- `src/components/Dashboard_Manager/Promotion/PromotionManagement.test.jsx`

## Validation

- Targeted Vitest for `PromotionManagement.test.jsx`.
- Frontend build and conflict check when available.
- Manual desktop modal review when a browser runtime is available.

## Out of scope

- Promotion schema, resolver, model, authorization, analytics or mutation payload changes.
- Redesigning the promotion form.
- Replacing the custom promotion modal with the shared modal component in this task.
