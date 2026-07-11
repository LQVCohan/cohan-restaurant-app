# Staff role and station access hardening

## Current behavior and root causes

The staff workspace uses fixed frontend role arrays while backend authorization uses restaurant-scoped permissions. Five confirmed drifts exist:

1. Kitchen and bar screens filter by station only in React. A bartender or kitchen role with `order.read`/`order.update` can request another station's items or update them directly through GraphQL.
2. `ordersGroupedByTable` requires `order.read`, while the host role is intentionally read-only in the staff ordering UI and owns `reservation.read` instead.
3. The reservation-change page queries immediately for every role admitted by `STAFF_ORDER_ROLES`, although the resolver requires `reservation.read` and mutations require `reservation.update`.
4. A custom staff role keeps its custom slug, so fixed frontend role sets do not recognize it even when `userType` and department identify a valid operational staff group.
5. The final GraphQL resolver order spreads `OrderCoreRecoveryQuery` after `OrderQuery`; the recovery resolver did not enrich order items from immutable `KitchenOrderWorkItem` snapshots, so the actual KDS response could lose station and timing metadata even though the shadow query implementation contained that logic.

## End-to-end flow

- `Role.department` / authenticated role context
- shared order access guard and final order query resolver
- `OrderItem.prepStation` and `KitchenOrderWorkItem.station` snapshots
- `ordersByRestaurantNow`, `ordersGroupedByTable`, `updateOrderItemStatus`
- Apollo staff kitchen/order/reservation operations
- staff route, navigation, and page actions
- focused backend and frontend regression tests

## Scope

- Derive an optional preparation-station scope from authenticated built-in or custom staff roles.
- Filter station-scoped order query results before returning them.
- Enrich the final staff order query from restaurant-scoped `KitchenOrderWorkItem` snapshots before returning KDS metadata.
- Reject station-crossing item status and priority updates on the backend, and block station roles from generic whole-order/item adjustment workflows.
- Permit the table-order read query through either `order.read` or `reservation.read` so host read-only mode works without granting order mutation rights.
- Prevent the reservation-change page from querying or rendering actions without the corresponding permissions.
- Hide reservation review navigation without `reservation.read`.
- Map unknown custom staff role slugs to the existing operational role for their department, including restored sessions that retain only role name and department.
- Add focused tests for the final resolver, station scope, reservation permissions, navigation, and custom staff role mapping.

## Constraints

- Preserve restaurant scoping and existing GraphQL contracts.
- Do not add new permissions, routes, dependencies, or duplicate order flows.
- Managers/admins retain combined kitchen/bar access.
- Built-in role behavior remains unchanged except for the confirmed permission gaps.
- Change the fewest shared files; do not patch each UI caller separately.

## Acceptance criteria

1. Bartender queries return only bar items; kitchen roles return only kitchen items.
2. Bartender cannot update a kitchen item, and kitchen roles cannot update a bar item.
3. Managers/admins can still view and update both stations.
4. KDS responses preserve station, preparation timing, lateness, and unaccepted-work metadata from the final resolver used by GraphQL.
5. Host can load current orders for a selected table in read-only mode.
6. A staff account without `reservation.read` does not issue the pending-reservation query or see its navigation item.
7. Reservation approve/reject controls require `reservation.update`.
8. A custom staff role with department `bar`, `kitchen`, `service`, `cashier`, `cleaning`, `delivery`, `inventory`, or `management` reaches the matching existing staff workspace behavior.

## Out of scope

- New station-specific permission codes.
- Redesigning staff pages.
- Changing reservation approval ownership beyond existing permissions.
- Database migrations or automatic role reseeding.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/resolvers/order-station-access.test.js tests/resolvers/order-core-recovery-station.test.js`
- `npx vitest run src/utils/frontendRoleAccess.test.js src/layouts/StaffLayout.test.jsx src/components/Dashboard_Manager/Reservations/ReservationChangeReviewPage.test.jsx`
- `npm run check:graphql`
- `npm run build`
