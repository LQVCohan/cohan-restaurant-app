# Promotion flow hardening

## Problem

Promotion management currently permits contract drift between the manager form, GraphQL resolver, stored document and runtime discount selection. Invalid references can be stored, restaurant changes appear to succeed when they do not, exhausted promotions can reach discount calculation, and supported COMBO/FREESHIP promotions are hidden from POS selectors.

## Scope

- Validate and normalize promotion fields at the backend trust boundary.
- Ensure referenced categories and menu items belong to the promotion restaurant.
- Preserve restaurant ownership on update and report attempted moves clearly.
- Exclude exhausted promotions from active runtime queries before preview/payment.
- Use authoritative mutation results in the frontend hook.
- Use the dedicated toggle mutation for status-only changes.
- Make duplicate codes deterministic and collision-resistant within the loaded restaurant list.
- Surface mutation errors through the existing promotion error banner.
- Include COMBO and FREESHIP in active order-promotion selectors.
- Repair focused tests that still mock the removed access guard.

## Acceptance criteria

- Invalid type, scope, discount type, level, dates or cross-restaurant references are rejected before persistence.
- Updating a promotion cannot silently move it to another restaurant.
- Frontend filters follow the restaurant returned by the server, never the submitted restaurant value.
- Status-only changes call `togglePromotion` and do not resubmit the full promotion.
- Promotions at their usage limit are absent from active calculation queries.
- POS selectors can display percentage, fixed, combo and freeship order promotions.
- Create, update, toggle, delete, duplicate, active-query and discount-capacity behavior have focused regression tests.

## Out of scope

- Redesigning the promotion page.
- Changing discount formulas, coupon rules, invoices or payment providers.
- Adding new audience-segmentation semantics that are not currently represented by customer data contracts.
