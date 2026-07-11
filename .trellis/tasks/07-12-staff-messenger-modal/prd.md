# PRD

## Current behavior

`/staff/contacts` is a dedicated page. Staff must leave the current workspace to inspect conversations. Selecting a thread opens a second centered dialog, so the flow has two navigation layers and is especially awkward on phones. Notification deep-links also navigate away from the current task.

## Root cause

Conversation state is owned by the page-level `ContactsView`, while `StaffLayout` owns the navigation and notification entry points. The UI therefore cannot open messaging in place even though the GraphQL communication contract already supports loading, reading and replying to a thread independently of route state.

## End-to-end flow

`ChatThread` model -> communication GraphQL resolver -> `useCommunication` queries/mutations -> `StaffLayout` launcher/notification action -> `ContactsView` list and selected thread -> `ChatThreadPanel` composer.

## Scope

- Add one messenger-style launcher to every staff workspace.
- Open conversations in a bottom-right modal on desktop and a full-screen modal on phone widths.
- Keep the user on the current staff page.
- Let the existing “Liên lạc” navigation item open the modal instead of changing route.
- Open a specific thread directly from a staff notification.
- Preserve `/staff/contacts?threadId=...` as a compatibility deep-link by redirecting to the staff workspace and opening the modal.
- Reuse the current communication hook, GraphQL operations, tokens and Lucide icons.

## Acceptance criteria

1. Clicking the floating message icon or “Liên lạc” opens the same modal without route navigation.
2. Desktop uses a compact bottom-right conversation surface; mobile uses the full viewport with safe-area padding.
3. A selected conversation replaces the list inside the same modal and provides Back and Close actions.
4. Search, filters, unread state, mark-read and send-message behavior remain functional.
5. Notification thread actions open the modal focused on that thread.
6. Direct legacy contact URLs still reach the correct thread.
7. Keyboard focus is visible; Escape closes the modal; icon buttons have accessible names.
8. No backend schema, resolver, permission or restaurant-scope behavior changes.

## Out of scope

- Calls, presence/online status, attachments, reactions, typing indicators or a new realtime protocol.
- New dependencies or a new communication backend.
- Manager/customer chat redesign outside the shared embedded panel capability.

## Validation plan

- Targeted Vitest for `StaffLayout`, `ContactsView` and embedded `ChatThreadPanel` behavior.
- `npm run check:conflicts`.
- `npm run check:graphql:operations` because existing operations must remain valid.
- `npm run build` when a runnable checkout is available.
- Manual responsive checks at 390x844, 430x932, 768, 1024 and 1440 widths.
