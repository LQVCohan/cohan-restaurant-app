# Staff order flow audit

## Current behavior

The `/staff/orders` route is scoped by `StaffOrderingScoped`, but the child component resolves the restaurant again from legacy user fields and the first restaurant. Table DTOs are renamed before reaching `TableMap`, while the map reads the original names. Quick table buttons emit action names not handled by the parent. The table status mapper also treats every occupied table as waiting for payment.

Persisted order-item adjustment mutations load orders directly by id. The shared order access guard currently protects creation, payment and reminder operations but not quantity adjustment, void or return mutations. Cashier UI allows payment requests, while backend payment mutations require only `order.update`; seeded cashier roles carry `payment.write` instead.

## Direction

Keep the existing staff POS and backend lifecycle. Repair the shared contracts: one restaurant scope, one table DTO/action vocabulary, accurate operational status, and shared persisted-order permission guards.

## Acceptance criteria

- The restaurant selected by `AuthProvider` is the restaurant used by every staff-order query and mutation.
- Table code and capacity render from the fetched table data.
- Gọi món selects the table and opens menu; Thanh toán selects the table and opens its order sheet.
- Occupied/reserved tables display as being served, not waiting for payment without payment data.
- The staff table card contains no nested buttons.
- Quantity adjustment and void/return request/review operations verify persisted restaurant scope and the correct order permission before mutation logic runs.
- Cashiers with `payment.write` can request payment without receiving a false permission error.
- Existing inventory reservation, kitchen work-item sync, table-customer hydration and realtime event behavior remain unchanged.

## Out of scope

- Implementing the unfinished remote-order queue.
- Implementing table merge/split inside the staff screen.
- Replacing alert/prompt interactions across the whole POS.
- Changing role assignments or restaurant membership rules.
