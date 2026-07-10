# Contextual AI page guidance

## Current behavior

The floating chatbot is already mounted on `/staff/...` routes because the app only hides it on login, manager, preview and selected table-session routes. However, the feature map exposes only the staff schedule page, so employees cannot reliably ask for operational guidance and receive direct buttons for dashboard, orders, kitchen, attendance, leave, payslips or other staff screens.

Customer navigation already has broad feature coverage, but staff and customer actions must continue to be filtered by the authenticated role before they are returned to the UI.

## End-to-end flow

`AppRouter staff/customer routes -> ScopedAiChatbotWidget visibility -> AiChatbotWidget pageContext + featureMatches -> AskAiChatbot GraphQL input -> chatbot resolver/service -> sanitizeFeatureMatches -> deterministic actions -> widget action button -> React Router navigation`.

## Scope

- Keep the chatbot visible on the existing staff routes.
- Add feature-map entries for every registered staff page, using the same role lists as `AppRouter`.
- Return role-appropriate shortcut actions for generic help requests on staff and customer pages.
- Resolve staff pages from `pageContext.pathname` at the shared chatbot service boundary so guidance starts from the current screen.
- Enforce backend path-based role filtering for `/staff/...` and `/manager/...` actions because client feature matches are untrusted.
- Preserve customer current-page guidance, deterministic reservation guidance, safety checks, restaurant validation, sources and provider fallback behavior.

## Acceptance criteria

1. A server/host/cashier can receive a direct button to `/staff/orders`, but a kitchen-only role cannot.
2. A chef/cook/kitchen helper/bartender can receive a direct button to `/staff/kitchen`, but a customer cannot.
3. Shared staff roles can receive direct buttons for dashboard, performance, schedule, attendance, leave, profile, notifications, contacts, AI handoff, payslips and settings.
4. Generic staff help returns useful role-appropriate shortcuts instead of only the existing schedule entry.
5. Generic customer help continues to return direct customer shortcuts without exposing staff or manager routes.
6. Staff route pathnames are represented as current-page context for how-to answers.
7. Forged client feature matches cannot expose staff or manager actions to unauthorized roles.
8. Existing customer and reservation behavior remains unchanged.

## Validation

- `npx vitest run src/utils/aiChatbotFeatureMap.test.js`
- `npx vitest run cohan-restaurant-backend/tests/services/restaurantChatbot.pageGuidance.test.js`

## Out of scope

- Automatically performing staff operations, changing order states, approving leave or submitting forms.
- Changing route permissions or backend business-data authorization.
- Enabling the widget on routes where the app intentionally hides it.
