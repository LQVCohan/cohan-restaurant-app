# Implementation plan

## Runtime files

1. `cohan-restaurant-backend/models/chat-thread.model.js`
   - add internal `sourceConversationId` and unique sparse index.
2. `cohan-restaurant-backend/src/services/ai/restaurantChatbotCore.service.js`
   - reuse supplied conversations only when status is `open`.
3. `cohan-restaurant-backend/src/services/ai/restaurantChatbotHandoff.service.js`
   - validate active lifecycle and linked-thread integrity;
   - atomically upsert one handoff thread per conversation;
   - conditionally link the conversation and preserve unread state.
4. `cohan-restaurant-backend/src/services/ai/restaurantChatbotResolveHandoff.service.js`
   - reject conflicting IDs;
   - remove the legacy participant/restaurant assignment gate;
   - validate thread restaurant/kind and close idempotently.
5. `cohan-restaurant-backend/src/services/ai/restaurantChatbotGuestReplies.service.js`
   - reject guest writes to closed, wrong-scope or non-handoff threads.
6. `src/components/common/AiChatbotWidget.jsx`
   - clear resolved conversation storage/state.
7. `src/components/communication/AiHandoffInbox.jsx`
   - follow active restaurant context;
   - clear stale selection on restaurant changes;
   - refresh selected active thread;
   - open resolved deep-links correctly.
8. `src/layouts/StaffLayout.jsx`
   - use the effective staff restaurant for the handoff unread badge.

## Test files

1. `cohan-restaurant-backend/tests/services/restaurantChatbot.persistence.service.test.js`
2. `cohan-restaurant-backend/tests/services/restaurantChatbot.handoff.service.test.js`
3. `cohan-restaurant-backend/tests/services/restaurant-chatbot-resolve-handoff.service.test.js`
4. `cohan-restaurant-backend/tests/services/restaurant-chatbot-guest-replies.service.test.js`
5. `src/components/common/AiChatbotWidget.handoff.test.jsx`
6. `src/components/communication/AiHandoffInbox.test.jsx`
7. `src/layouts/StaffLayout.test.jsx`

## Verification commands

```bash
npm --prefix cohan-restaurant-backend test -- tests/services/restaurantChatbot.persistence.service.test.js tests/services/restaurantChatbot.handoff.service.test.js tests/services/restaurant-chatbot-resolve-handoff.service.test.js tests/services/restaurant-chatbot-guest-replies.service.test.js
npx vitest run src/components/common/AiChatbotWidget.handoff.test.jsx src/components/communication/AiHandoffInbox.test.jsx src/layouts/StaffLayout.test.jsx
npm run check:graphql
npm run build
```

## Review checklist

- No public GraphQL schema change.
- No permission-code or recipient-policy change.
- No customer data exposed to staff beyond the existing handoff summary/thread.
- No closed conversation or thread reopened.
- No duplicate thread or duplicate closure message on retry.
- Existing loading, empty, error and permission states remain intact.
