# Design

## Direction

Fix state ownership at the shared persistence boundaries rather than hiding stale state in one UI. Reuse the existing conversation, chat-thread, notification, restaurant-scope and communication patterns. Keep the public GraphQL contract unchanged.

## Conversation lifecycle

- The Home `askAiChatbot` resolver forwards a supplied conversation reference only when the stored conversation still has status `open`.
- A stale `handoff_requested`, `closed`, missing or unreadable reference is replaced with `conversationId: null` before the existing chatbot service runs. The existing open-conversation scope filter then finds or creates a valid session, and the Home widget stores the returned ID.
- Handoff creation accepts only `open` or already-valid `handoff_requested` conversations. `closed` conversations return a safe failure.

## Unique handoff thread

Add internal `sourceConversationId` to `ChatThread` with a partial unique index. Handoff creation:

1. validates ownership, restaurant, settings and eligible recipients;
2. returns the linked open thread when an active handoff already exists;
3. finds or atomically upserts one thread by `sourceConversationId`;
4. adds recipients with `$addToSet` instead of replacing participants/unread state;
5. conditionally links the still-open conversation to that thread;
6. creates idempotent notifications only after the link succeeds.

This prevents duplicate active threads without introducing a new collection or lock abstraction.

## Resolution integrity

- When both IDs are supplied, the conversation must be linked to that exact thread.
- The thread restaurant must match the conversation restaurant and it must be an AI handoff thread.
- `requireRestaurantPermission(... AI_CHATBOT_HANDOFF)` is the single authorization boundary; the legacy participant/`restaurantForStaff` gate is removed.
- Conversation and thread close in one Mongoose transaction with conditional updates, so retries do not duplicate the closure system message and concurrent state changes roll back.

## Guest messaging

Guest messages require:

- owned conversation in `handoff_requested`;
- linked thread present;
- thread status `open`;
- matching restaurant and AI handoff kind/marker.

The final append also includes `status: open` in its atomic update to prevent a message from racing with resolution.

## Staff inbox

- Resolve restaurant in this order: explicit prop, local selection, `activeRestaurantId`, active restaurant object, legacy staff restaurant, first available context restaurant, user restaurant fallback.
- `StaffLayout` injects the effective restaurant into the handoff page and keys the child by that scope, so changing restaurant remounts and clears stale details.
- The inbox also clears selected item, reply, warnings and local resolved state whenever restaurant scope changes.
- While a thread is selected, `useCommunication` refreshes its detail on the existing six-second communication cadence.
- Deep-link lookup checks active and resolved items; a resolved match switches tabs before opening.
- The navigation unread badge receives the same effective staff restaurant ID.

## Tests

- Home GraphQL lifecycle keeps open references and drops resolved/missing/invalid references.
- Closed handoff requests are rejected; repeated requests converge on one thread; stale links recover safely.
- Resolution rejects conflicting IDs, accepts valid scoped permission without legacy assignment and rejects concurrent state changes.
- Guest send rejects closed, wrong-scope and non-handoff threads, including an append/close race.
- Staff inbox uses active restaurant context and opens resolved deep-links.
- Selected thread detail refreshes and resets on restaurant changes.
- Staff unread badge and handoff child use the effective restaurant fallback.
