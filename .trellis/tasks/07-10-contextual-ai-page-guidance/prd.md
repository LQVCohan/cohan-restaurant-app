# Contextual AI page guidance

## Current behavior

The frontend already sends `pageContext.pathname`, but the chatbot previously used it only as raw context. Reservation answers could restart the workflow from the beginning, and other customer pages were not explicitly identified as the page the user was currently viewing.

Example: on `/restaurants`, asking “làm sao để đặt bàn” should begin with choosing a restaurant from the current list. On `/cart`, asking “cách thanh toán” should continue from reviewing the cart instead of explaining how to find the cart.

## Scope

- Resolve customer-facing pages from `pageContext.pathname` at the shared chatbot service boundary.
- Add a safe current-page context entry before calling the AI provider so how-to answers begin from the page already open.
- Derive restaurant scope from restaurant, coupon and table-session routes.
- Derive the selected menu item from `/food/:foodId` so backend ownership/scope verification can run.
- Keep deterministic remaining-step reservation guidance for restaurant list, restaurant detail and table-layout pages.
- Remove the internal current-page action before returning actions to the UI.
- Preserve existing safety, permissions, restaurant validation, sources and provider fallback behavior.

## Acceptance criteria

1. Customer routes registered in `AppRouter` are recognized with a human-readable current-page label.
2. How-to answers identify the current page and continue from it instead of repeating completed navigation.
3. On `/restaurants`, `/restaurant/:id` and `/restaurant/:id/layout`, reservation guidance starts at the correct remaining step.
4. Restaurant IDs in customer URLs are still validated by the existing backend scope resolver.
5. Food-detail URLs supply the menu item ID to the existing backend verification flow.
6. The internal current-page context entry never appears as a visible action.
7. Questions unrelated to navigation/how-to behavior keep their original answer.
8. No schema, resolver or frontend contract change is required.

## Out of scope

- Automatically clicking controls or submitting forms for the user.
- Completing orders, payments, reservations or profile updates on behalf of the user.
- Manager and staff page guidance.
- Changing the existing decision to hide the floating widget on `/scan-table` and `/table/...`; those routes are context-ready for other chatbot callers, but widget visibility remains unchanged.