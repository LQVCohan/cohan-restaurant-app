# Design

## Existing flow

`Order.customerRequests` stores request state. Public tracking mutations append `PENDING`, save the order and call `emitRestaurantEvent`. POS queries `customerServiceRequests`; acknowledgement and resolution use restaurant-scoped permission-checked mutations. User notification bells already consume `Notification` records through `useCommunication` and the `notificationCreated` socket.

## Change

1. Extend the notification workflow with one feature-specific dispatcher that resolves manager/admin reviewers and active staff assigned to the restaurant, then creates one deduplicated notification per recipient using the request ID.
2. Invoke that dispatcher at the existing restaurant-event boundary only for `CUSTOMER_STAFF_CALL_REQUESTED` and `CUSTOMER_PAYMENT_REQUESTED`. Database save remains the source of truth and notification delivery does not alter request status.
3. Let the shared queue refetch only for customer-request created/acknowledged/resolved restaurant events.
4. Render the same queue above `/staff/orders`, and surface the existing staff notification bell in the global staff header on pages where the order workspace does not already render it.
5. Refine queue presentation with reusable module styles, explicit state badges and touch-sized actions.

## Safety

- Preserve `requireRestaurantPermission` on query/ack/resolve.
- Reuse `createNotificationOnce` for deduplication and the existing user socket.
- Do not expose tracking tokens or internal recipient IDs.
- Reading a notification only changes `Notification.readAt`; accepting the request remains a separate mutation.
