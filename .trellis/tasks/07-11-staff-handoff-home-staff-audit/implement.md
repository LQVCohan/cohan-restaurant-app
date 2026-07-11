# Implementation result

## Runtime files

1. `cohan-restaurant-backend/models/chat-thread.model.js`
   - added internal `sourceConversationId`;
   - added a partial unique ObjectId index so one AI conversation maps to at most one handoff thread.
2. `cohan-restaurant-backend/graphql/resolvers/aiChatbot/index.js`
   - added the Home GraphQL lifecycle guard that forwards only an `open` stored conversation ID;
   - drops closed, handoff-requested, invalid, missing and unreadable references before the existing chatbot flow executes.
3. `cohan-restaurant-backend/src/services/ai/restaurantChatbotHandoff.service.js`
   - rejects closed conversations;
   - validates linked thread existence, status, restaurant and handoff identity;
   - recovers a missing legacy link safely;
   - atomically upserts one thread by `sourceConversationId` and preserves recipients/unread state with `$addToSet`;
   - conditionally links only a still-open conversation;
   - makes repeated/concurrent requests converge on the same thread and keeps notification delivery idempotent.
4. `cohan-restaurant-backend/src/services/ai/restaurantChatbotResolveHandoff.service.js`
   - rejects conflicting conversation/thread identifiers;
   - removed the duplicate legacy participant/restaurant-assignment authorization gate;
   - validates thread restaurant and handoff identity;
   - closes conversation and thread in one Mongoose transaction;
   - uses conditional updates to avoid duplicate closure messages and reject concurrent state changes.
5. `cohan-restaurant-backend/src/services/ai/restaurantChatbotGuestReplies.service.js`
   - reports a handoff closed when the linked thread is closed or outside the conversation scope;
   - rejects guest writes to closed, wrong-restaurant and non-handoff threads;
   - performs the final append with an atomic `status: open` condition.
6. `src/hooks/useCommunication.js`
   - tracks the opened thread;
   - refreshes selected thread detail every six seconds;
   - stops refreshing the old selection when restaurant/status scope changes.
7. `src/components/communication/AiHandoffInbox.jsx`
   - follows `activeRestaurantId` before legacy restaurant fields;
   - clears selection, warnings, reply and local resolved state on restaurant change;
   - opens resolved deep-links under the `Đã xử lý` tab;
   - keeps existing permission, loading, empty, reply and resolution UI states.
8. `src/layouts/StaffLayout.jsx`
   - uses the effective active restaurant for the handoff unread badge;
   - injects that restaurant into the handoff inbox and keys it by scope so restaurant changes cannot retain old details.

## Test files

1. `cohan-restaurant-backend/tests/resolvers/ai-chatbot-conversation-lifecycle.test.js`
   - open, handoff-requested, closed, invalid, missing and unreadable Home conversation references.
2. `cohan-restaurant-backend/tests/services/restaurantChatbot.handoff.service.test.js`
   - one-thread creation, repeated request idempotency, closed request rejection, missing-link recovery, closed-linked-thread handling, ownership and unavailable recipients.
3. `cohan-restaurant-backend/tests/services/restaurant-chatbot-resolve-handoff.service.test.js`
   - transactional closure, ID mismatch, restaurant permission without legacy assignment, wrong scope/kind, idempotency, concurrent state conflict and realtime failure.
4. `cohan-restaurant-backend/tests/services/restaurant-chatbot-guest-replies.service.test.js`
   - safe reply filtering, closed-state polling, atomic append, closed/wrong-scope/non-handoff rejection and close/write conflict.
5. `src/hooks/useCommunication.test.js`
   - selected detail polling and reset on restaurant changes.
6. `src/components/communication/AiHandoffInbox.test.jsx`
   - active restaurant priority, resolved tab behavior, resolved deep-link and active resolution flow.
7. `src/layouts/StaffLayout.test.jsx`
   - effective restaurant unread badge and restaurant injection into the staff handoff page.

## Audited unchanged flows

- public AI chatbot and communication GraphQL operations/response fields;
- `ai.chatbot.handoff` and `ai.chatbot.moderate` permission codes;
- active BrandMembership recipient policy;
- guest-safe staff reply filtering;
- notification types and deep-link format;
- Socket.IO room/event contracts;
- current Home chatbot and Staff inbox visual language.

## Validation record

- Traced schema/model → handoff/reply/resolve services → GraphQL → Home widget → communication hook → Staff inbox/layout.
- Re-fetched the changed runtime files from `main` after writes and reviewed current callers, including the actual Home widget send path.
- Confirmed the current Home widget uses `askAiChatbot` GraphQL, so the lifecycle guard covers its stale stored conversation reference before persistence.
- Added focused regression tests and aligned existing handoff tests with the new lifecycle and transaction contracts.
- A local checkout/test run was attempted but could not start because the execution environment could not resolve `github.com`.
- Vitest, GraphQL validation, integration tests and the Vite production build were therefore not executed in this session.

## Review checklist

- No public GraphQL schema change.
- No permission-code or recipient-policy change.
- No customer data exposed beyond the existing handoff summary/thread.
- No closed conversation or thread reopened.
- No duplicate active thread or duplicate closure message on retry.
- Existing loading, empty, error and permission states remain intact.
