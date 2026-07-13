# Implementation plan

1. Build a 55-item trace matrix from the report and mark current-main behavior, root cause and existing coverage.
2. Fix shared overlays, toast/error mapping, route history and role-workspace restoration first because they cover multiple report items.
3. Fix order/menu/stock and restaurant/table manager surfaces, preserving existing GraphQL contracts unless the server boundary is wrong.
4. Fix staff/leave/schedule/payroll/customer analytics flows with focused component and resolver tests.
5. Fix promotion/review/customer discovery and booking/session/POS business rules across model/service/resolver/Apollo/UI.
6. Run the narrowest tests after each group, then conflict, GraphQL, build and critical smoke checks.
7. Perform the final UI/accessibility audit, record exact changed files/checks and open one draft PR.

## Implemented

- Completed the 55-item audit in `traceability.md`; avoided duplicating report outcomes already present on the base branch.
- Corrected manager order/menu/stock/table/restaurant flows, staff navigation and leave serialization, promotion/AI copy and timing, and the public QR-to-POS state boundary.
- Kept public QR sessions pre-service until POS accepts the first item batch; preserved static-token validation, device confirmation for ordering, inventory reservation, audit data and restaurant-scoped realtime events.
- Added/updated focused regression tests at each changed service/resolver/Apollo/component boundary.
