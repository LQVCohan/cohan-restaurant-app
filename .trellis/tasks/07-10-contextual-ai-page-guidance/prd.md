# Contextual AI page guidance

## Current behavior

The floating chatbot is already mounted on `/staff/...` routes because the app only hides it on login, manager, preview and selected table-session routes. The UI already renders returned link actions as buttons and navigates with React Router, but the shared service does not recognize staff pages or create role-aware staff shortcuts.

Customer navigation already has broad feature coverage. Both staff and customer actions still need a final backend role filter because client-provided feature matches are untrusted.

## End-to-end flow

`AppRouter route -> ScopedAiChatbotWidget -> AiChatbotWidget pageContext -> AskAiChatbot GraphQL input -> chatbot resolver -> shared chatbot service -> role-aware actions -> existing widget action button -> React Router navigate()`.

## Scope

- Keep the existing widget visibility and action renderer unchanged.
- Resolve every registered staff page from `pageContext.pathname` so guidance starts from the current screen.
- Add direct staff actions for dashboard, orders, reservation changes, kitchen, performance, schedule, attendance, leave, profile, notifications, contacts, AI handoff, payslips and settings.
- Reuse the same role groups as `AppRouter`: shared staff, order staff and kitchen staff.
- Add customer shortcuts for generic help and direct customer navigation questions.
- Filter `/staff/...` and `/manager/...` actions using the authenticated backend user before returning them to the UI.
- Preserve customer current-page guidance, reservation guidance, safety checks, restaurant validation, sources and provider fallback behavior.

## Acceptance criteria

1. A server/host/cashier can receive a direct button to `/staff/orders`, but a kitchen-only role cannot.
2. A chef/cook/kitchen helper/bartender can receive a direct button to `/staff/kitchen`, but a customer cannot.
3. Shared staff roles can receive direct buttons for all shared staff pages.
4. Generic staff help returns useful role-appropriate shortcuts.
5. Generic customer help returns customer shortcuts without exposing staff or manager routes.
6. Staff route pathnames are represented as current-page context for how-to answers.
7. Forged client actions cannot expose staff or manager routes to unauthorized roles.
8. Existing customer and reservation behavior remains unchanged.

## Files

- `cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js`: shared page recognition, role filtering and direct actions.
- `cohan-restaurant-backend/tests/services/restaurantChatbot.pageGuidance.test.js`: customer/staff route and role regression tests.

## Validation

- `npx vitest run cohan-restaurant-backend/tests/services/restaurantChatbot.pageGuidance.test.js`

## Out of scope

- Automatically performing staff operations, changing order states, approving leave or submitting forms.
- Changing route permissions or backend business-data authorization.
- Enabling the widget on routes where the app intentionally hides it.
