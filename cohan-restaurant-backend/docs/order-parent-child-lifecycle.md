# Order parent-child lifecycle (PR1 foundation)

## Current problem

`currentStatus` currently mixes multiple meanings:
- kitchen/service progress
- payment lifecycle
- order completion/closure

Because of this, values like `completed` can be interpreted as either "served" in operations or "paid/closed" in payment workflows.

## Target model

- `table_session`: one parent order per active dine-in table session.
- `order_batch`: one child order per staff send-to-kitchen round.
- `split_bill`: reserved for future payment grouping and split bill workflows.

## Status separation

- `sessionStatus`: lifecycle of the table/session (`open` -> `dining` -> `ready_to_pay` -> `closed`).
- `kitchenStatus`: lifecycle of child kitchen batches (`pending` -> `preparing` -> `ready` -> `served`).
- `orderPaymentStatus`: payment lifecycle (`unpaid` -> `payment_requested` -> `paid` / refund states).

`currentStatus` remains as a backward-compatible legacy field during migration.

## Intended future flow

1. StaffOrdering creates or fetches the active `table_session` parent order.
2. Each send-to-kitchen action creates a new `order_batch` child order.
3. POS payment loads the active parent session plus its child batches.
4. Parent session closes only after successful payment.

## Scope note for this PR

This PR does **not** change runtime behavior.

No data migration, payment refactor, StaffOrdering flow refactor, POS flow refactor, or order status transition rewiring is included here. Those will be handled in later PRs.
