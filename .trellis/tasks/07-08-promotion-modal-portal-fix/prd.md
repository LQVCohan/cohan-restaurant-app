# Fix blurred promotion modal

## Current behavior

Opening the create/edit promotion dialog from the manager promotion page dims and blurs the whole manager viewport, including the modal content itself. The dialog is also shifted upward through a negative-margin override.

## Root cause and flow

The promotion data flow is valid and remains unchanged:

`PromotionSchema -> promotion.graphql -> PromotionMutation.createPromotion/updatePromotion -> usePromotions -> PromotionManagement -> PromotionModal`.

The defect is at the shared CSS viewport boundary. The promotion, coupon and coupon-package dialogs use the same `.premium-modal-overlay` class and are mounted under `manager-layout__content`. Ancestors in that chain use `transform`, `will-change: transform`, `contain: paint`, isolated stacking contexts and clipping. Those properties turn the descendant fixed overlay into a layout-local layer. `PromotionModalViewportFix.css` then adds a separate body-level pseudo-element with backdrop blur, makes the real overlay transparent and moves the dialog with a negative margin. The body-level layer can therefore sit above and blur the trapped dialog itself.

## Requirements

- Fix the shared `.premium-modal-overlay` viewport boundary once for promotion, coupon and coupon-package dialogs.
- While one of these dialogs is open, neutralize only the manager ancestors that create the containing/stacking/paint-clipping chain.
- Remove the body-level pseudo-element blur, header/sidebar brightness filter and negative-margin workaround.
- Let the existing modal overlay own the dimmed blurred backdrop so its child dialog stays sharp.
- Preserve the current compact modal sizing, form state, validation, permissions, GraphQL inputs, save behavior and mobile rules.

## Acceptance criteria

- The promotion modal content is sharp while the manager page behind it is dimmed and blurred.
- The overlay covers the viewport and is not clipped by the manager content, header or sidebar.
- Promotion, coupon and coupon-package dialogs receive the same fix through their shared class.
- Existing promotion save/edit behavior and restaurant scoping remain unchanged.
- No schema, resolver, hook or component logic changes are required.

## Files

- `src/styles/PromotionModalViewportFix.css`

## Validation

- Review the final CSS against every stacking/containing ancestor in `ManagerLayout.scss` and `PromotionManagement.scss`.
- Frontend build and conflict check when available.
- Manual desktop modal review when a browser runtime is available.

## Out of scope

- Promotion schema, resolver, model, authorization, analytics or mutation payload changes.
- Redesigning the promotion form.
- Migrating the custom promotion dialogs to the shared React portal modal.
