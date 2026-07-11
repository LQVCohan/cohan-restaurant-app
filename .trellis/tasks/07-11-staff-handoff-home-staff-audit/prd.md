# Audit AI handoff from home to staff

## Current flow

1. The Home/customer chatbot persists an `AiChatConversation` and shows a handoff action when a restaurant-scoped request needs a person.
2. `requestAiChatbotHandoff` creates an `ai_chatbot_handoff` `ChatThread`, adds eligible brand members, sends notifications and links the conversation.
3. Staff receive a notification/deep-link and open `AiHandoffInbox` under `/staff/ai-handoff`.
4. Staff read the summary, reply through the communication mutation and close the handoff through `resolveAiChatbotHandoff`.
5. Guest polling/socket events display staff replies and the resolved state in the Home widget.

## Confirmed defects

1. A supplied conversation ID could be reused even when the conversation was `closed`; a Home follow-up could therefore persist messages into a resolved handoff.
2. The Home widget clears the handoff flag after resolution but may still hold the closed conversation ID until the next chatbot response replaces it.
3. Handoff creation did not reject closed conversations and concurrent requests could create duplicate/orphan threads.
4. An existing linked thread was treated as valid without verifying that it existed, belonged to the same restaurant and remained open.
5. Resolution accepted conflicting `conversationId` and `chatThreadId` values.
6. Resolution applied a second legacy participant/`restaurantForStaff` check after the authoritative restaurant permission check, causing valid scoped staff to be denied.
7. Guest post-handoff messages validated the conversation status but not the linked thread status or restaurant.
8. Staff inbox restaurant resolution could prefer a legacy/first restaurant over `activeRestaurantId`.
9. Switching restaurant left the previously selected conversation detail visible.
10. The open detail panel did not refresh when a guest sent another message.
11. A deep-link to a closed handoff did not open the resolved tab.
12. The staff navigation unread badge did not use the same restaurant fallback as the staff workspace.

## Scope

- Ensure the Home GraphQL chatbot entry only forwards an existing conversation reference when that conversation is still open.
- Make one handoff thread uniquely addressable by its source AI conversation.
- Reject resolved conversations and invalid/stale linked threads during handoff creation.
- Make duplicate handoff requests idempotent and prevent duplicate active threads.
- Validate resolution identifiers and use the existing restaurant permission as the single access authority.
- Reject guest writes to closed or cross-restaurant threads.
- Let a stale closed Home storage reference safely roll over to a valid open conversation on the next message.
- Use active restaurant context consistently in the Staff inbox and navigation badge.
- Clear stale selection on restaurant changes, support resolved deep-links and refresh selected details while active.
- Add focused regression tests.

## Acceptance criteria

- A Home message sent after handoff resolution creates/reuses an open conversation, never the closed conversation.
- A resolved conversation cannot request another handoff.
- Repeated or concurrent handoff requests converge on one open thread for the conversation.
- A stale/missing/closed linked thread is not reported as a valid active handoff.
- Conflicting conversation/thread IDs are rejected without closing either record.
- A staff member with `ai.chatbot.handoff` and restaurant scope can resolve the handoff even when not listed in legacy fields.
- A guest cannot append to a closed or wrong-restaurant thread.
- A stale Home conversation ID is ignored server-side and replaced by the valid conversation returned for the next message.
- Staff inbox and unread badge follow the active restaurant.
- Changing restaurants clears the old selected detail.
- Selected active conversation refreshes without requiring a second click.
- A closed handoff deep-link opens the resolved tab.

## Out of scope

- Changing handoff permission codes or recipient eligibility rules.
- Redesigning the chatbot or staff inbox.
- Changing public GraphQL operation names or response fields.
- Replacing Socket.IO or notification infrastructure.
- Adding assignment/claim ownership or SLA workflows.
- Changing the separate experimental `/ai/chatbot/stream` transport, which is not used by the current Home widget.
