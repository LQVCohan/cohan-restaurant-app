# Design

## Direction

Fix state ownership at the shared persistence boundaries rather than hiding stale state in one UI. Reuse the existing conversation, chat-thread, notification, restaurant-scope and communication patterns. Keep the GraphQL contract unchanged.

## Conversation lifecycle

- The chatbot core may reuse a supplied conversation only when it is owned by the requester, belongs to the same restaurant scope and has status `open`.
- Home removes both the handoff flag and the stored conversation ID when a resolved event/poll result arrives. The next message therefore starts or finds a valid open conversation.
- Handoff creation accepts only `open` or already-valid `handoff_requested` conversations. `closed` conversations return a safe failure.

## Unique handoff thread

Add internal `sourceConversationId` to `ChatThread` with a unique sparse index. Handoff creation will:

1. validate ownership, restaurant, settings and eligible recipients;
2. return the linked open thread when an active handoff already exists;
3. find or atomically upsert one thread by `sourceConversationId`;
4. add recipients with `$addToSet` instead of replacing participants/unread state;
5. conditionally link the still-open conversation to that thread;
6. create idempotent notifications after the link succeeds.

This avoids duplicate/orphan threads without introducing a new collection or lock abstraction.

## Resolution integrity

- When both IDs are supplied, the conversation must be linked to that exact thread.
- The thread restaurant must match the conversation restaurant and it must be an AI handoff thread.
- `requireRestaurantPermission(... AI_CHATBOT_HANDOFF)` remains the single authorization boundary; the legacy participant/`restaurantForStaff` gate is removed.
- Conversation and thread are closed with conditional updates so retries are idempotent and the closure system message is not duplicated.

## Guest messaging

Guest messages require:

- owned conversation in `handoff_requested`;
- linked thread present;
- thread status `open`;
- matching restaurant and AI handoff kind/marker.

## Staff inbox

- Resolve restaurant in this order: explicit prop, local selection, `activeRestaurantId`, active restaurant object, membership restaurant list, legacy fallback.
- Clear selected item, reply and errors whenever restaurant changes.
- While an active thread is selected, refresh its detail on the existing six-second cadence used by communication lists.
- Deep-link lookup checks active and resolved items; a resolved match switches tabs before opening.
- The navigation unread badge receives the same effective staff restaurant ID.

## Tests

- Core persistence does not reuse closed conversations.
- Closed handoff request is rejected; duplicate requests converge on one thread; stale links recover safely.
- Resolution rejects conflicting IDs and accepts valid scoped permission without legacy assignment.
- Guest send rejects closed/wrong-scope threads.
- Home clears closed conversation storage.
- Staff inbox uses active restaurant, clears stale detail, refreshes selected thread and opens resolved deep-links.
- Staff unread badge uses the effective restaurant fallback.
