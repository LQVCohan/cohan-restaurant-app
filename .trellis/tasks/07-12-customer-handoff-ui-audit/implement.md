# Implementation result

## Runtime changes

1. `src/components/common/AiChatbotWidget.jsx`
   - adds one dedicated `Gọi nhân viên hỗ trợ` action and removes duplicate provider handoff cards from the visible action list;
   - creates the required open AI conversation through the existing `askAiChatbot` mutation when the customer requests staff before sending an AI message;
   - introduces explicit connecting, waiting, active and closed presentation states;
   - changes the header, input label and placeholder while the customer is talking to staff;
   - hides AI quick replies, context cards, menu suggestions and AI actions while a handoff is connecting or active;
   - preserves guest-message delivery through the existing `sendAiChatbotGuestMessage` mutation;
   - distinguishes staff replies from AI replies and tracks only replies received after the current handoff starts;
   - clears the resolved conversation ID, handoff flag and stale AI suggestion state before returning to a clean assistant flow.
2. `src/components/common/AiChatbotHandoffPolish.scss`
   - adds a restrained sage human-support treatment;
   - styles staff messages as distinct support bubbles;
   - adds clear connecting/waiting/active/closed status cards;
   - guarantees 44px touch targets and visible keyboard focus;
   - constrains the panel with `100dvh` above the fixed mobile customer navigation;
   - keeps mobile inputs at 16px and respects reduced-motion preferences.
3. `src/App.jsx`
   - loads the handoff polish stylesheet;
   - prevents the customer chatbot from rendering under `/staff`.

## Regression coverage

`src/components/common/AiChatbotWidget.handoff.test.jsx` now covers:

- direct staff request without a prior AI message;
- one handoff control when the AI provider also returns a handoff action;
- guest messages after handoff;
- safe rate-limit feedback;
- socket room cleanup when the panel closes;
- staff reply deduplication and human-support copy;
- resolved-session storage cleanup and return to normal AI flow.

## Audited unchanged contracts

- public GraphQL operation names and response fields;
- restaurant scope and guest ownership checks;
- handoff recipient and notification policy;
- Socket.IO room/event contracts;
- staff inbox behavior;
- customer menu/cart behavior outside handoff mode.

## Validation record

- Re-fetched the latest changed runtime and test files from `main` after writes and reviewed the active callers.
- Confirmed the customer widget is mounted only through `ScopedAiChatbotWidget` and the new stylesheet is loaded at the same application boundary.
- Confirmed no pull-request workflow run is associated with implementation commit `6e1972b44aef027276f911c896f61e7dee09c022`.
- Vitest, GraphQL validation, Vite build and browser screenshot checks were not executed because this session did not have a runnable repository checkout.

## Review checklist

- No backend or GraphQL schema change.
- No permission or recipient-policy change.
- No duplicate call-staff action.
- No AI-only controls shown during an active handoff.
- No resolved conversation ID retained for the next request.
- Staff and customer workspaces do not share the customer chatbot overlay.
