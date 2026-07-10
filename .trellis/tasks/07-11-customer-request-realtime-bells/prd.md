# Customer request realtime bells

## Problem

Customer table requests are persisted and shown in POS, but the POS queue mainly relies on polling. No per-user notification is created for the manager or staff notification channels, and the staff shell has no consistent global bell. The current compact queue also makes pending and already-accepted work difficult to distinguish on mobile.

## Required behavior

- A new `STAFF_CALL` or `PAYMENT_REQUEST` remains `PENDING` until an authorized user explicitly accepts it.
- Creating a request emits the existing restaurant event for POS and creates unread notification records for managers/admins and active staff assigned to the restaurant.
- Manager and staff bells refresh through the existing `notificationCreated` user socket.
- POS and the staff order workspace refresh the shared request queue immediately from restaurant socket events, while polling remains fallback.
- Once any authorized user accepts, all viewers see `ACKNOWLEDGED`; further accepts stay idempotent.
- Staff can reach and accept the same request queue from `/staff/orders`.
- UI must clearly separate waiting and accepted states and remain usable at 390 px width.

## Non-goals

- No new request status or database migration.
- No new notification framework or socket namespace.
- No automatic acknowledgement when a bell item is merely read or opened.
