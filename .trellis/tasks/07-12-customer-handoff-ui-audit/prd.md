# Customer handoff interface audit

## Current flow

1. `AiChatbotWidget` is mounted globally outside manager routes.
2. A restaurant-scoped AI conversation supplies the required `conversationId`.
3. `requestAiChatbotHandoff` links the conversation to a staff thread and returns the persisted request state.
4. The widget polls/listens for staff replies and sends later guest messages through the guest-message mutation.
5. A resolved event returns the customer to normal AI messaging.

## Confirmed UI defects

- The fixed handoff button is disabled until a conversation already exists, so a customer cannot call staff directly.
- AI-provided handoff actions and the fixed handoff button can render duplicate controls.
- AI quick replies, action cards, title and input placeholder remain visible after entering staff-support mode.
- Staff messages have no dedicated bubble treatment or clear human sender hierarchy.
- Waiting, active and closed handoff states use the generic AI context treatment.
- A resolved session keeps the stale local conversation reference until another AI request replaces it.
- Mobile panel height does not account for the fixed customer bottom navigation offset.
- The customer chatbot is not excluded from `/staff` routes.

## Direction

A single, direct **Gọi nhân viên hỗ trợ** action with a clear sage human-support mode, distinct staff messages, explicit waiting/active/closed feedback and mobile-safe sizing. Preserve the existing warm customer visual language and all backend contracts.

## Scope

- Allow the handoff CTA to create the required conversation through the existing `askAiChatbot` mutation when needed, then request handoff.
- Keep only one handoff CTA and hide AI-only suggestions while staff support is active.
- Present distinct waiting, active and closed support states in the header and status region.
- Style staff replies as accessible human-support bubbles.
- Clear the resolved conversation reference from component state and local storage.
- Keep input copy aligned with the current mode.
- Ensure controls have visible focus and minimum touch sizing.
- Fit the opened panel above the mobile customer navigation.
- Do not render the customer chatbot in the staff workspace.

## Acceptance criteria

- A customer on a restaurant-scoped page can request staff without first typing an AI message.
- Only one call-staff control is visible.
- While handoff is active, AI action cards and quick replies are hidden.
- The header and input clearly state whether the customer is waiting for or messaging staff.
- Staff replies are visually and semantically distinct from AI replies.
- Closing the handoff removes the stored closed conversation ID and restores a clean flow.
- The panel remains within 390x844 and 430x932 viewports above the bottom navigation.
- The customer chatbot does not appear on `/staff` routes.
- Existing guest messaging, polling, socket events and handoff GraphQL fields remain unchanged.

## Validation

```bash
npx vitest run src/components/common/AiChatbotWidget.handoff.test.jsx src/components/common/AiChatbotWidget.basic.test.jsx
npm run check:graphql
npm run build
```

## Out of scope

- Changing recipient selection, permissions, notification policy or staff inbox behavior.
- Changing public GraphQL operation names or fields.
- Adding assignment, SLA or queue-position features.
- Redesigning unrelated chatbot menu/cart functionality.
