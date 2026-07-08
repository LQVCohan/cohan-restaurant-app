# Complete customer menu availability bell notifications

## Current behavior and root cause

Customers can register a `MenuAvailabilityWatch` from the food detail page or from the global out-of-stock prompt. When stock becomes available, the backend marks the watch as `notified` and emits `menuAvailabilityNotifications` over Socket.IO.

The customer header bell does not consume that event. It reads persistent `Notification` records and updates its unread badge from the `notificationCreated` user-channel event. Therefore availability alerts disappear when the socket is missed, do not survive login/session changes, do not increase the bell badge, and do not appear in notification history.

The registration service also trusts `input.userId` before the authenticated context, allowing a caller to request a watch for a different account.

## End-to-end flow

`MenuAvailabilityWatch model -> register/cancel GraphQL mutations -> menuAvailabilityWatch.service -> notificationWorkflow.service/Notification model -> notificationCreated socket event -> useCommunication -> CustomerNotificationContext -> CustomerNotificationBell`.

## Implementation

- Reuse `createNotificationOnce`; do not introduce a second notification store or socket channel.
- When an authenticated user's watch becomes available, create one persistent `menu_availability` Notification keyed by the watch ID.
- Include a user-facing message and `/food/:id?restaurantId=:id` action URL in the notification payload.
- Keep the existing `menuAvailabilityNotifications` emission for active food/POS screens and table-code watchers.
- If persistence fails after claiming a watch, return the watch to `watching` so a later inventory release can retry.
- Derive user identity from the authenticated context and reject a mismatched requested user ID.
- Let the customer notification mapper honor the existing `payload.actionUrl` convention.

## Acceptance criteria

- Registering a watch for another user is rejected.
- A user watch that becomes available creates exactly one persistent Notification.
- The Notification is emitted through `notificationCreated`, causing the customer bell to refetch and increase unread count.
- The saved notification appears after reconnect/login because it lives in the Notification collection.
- Opening it navigates to the matching food detail page.
- Repeated availability processing does not create duplicate notifications for the same watch.
- Existing restaurant/table realtime events remain unchanged.
- A failed persistent notification write does not permanently consume the watch.

## Out of scope

- Browser push notifications, email, or SMS.
- A separate availability-notification page or notification schema.
- Automatic reservation when the dish becomes available.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/services/menu-availability-watch-notification.test.js
cd ..
npm run build
```
